import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useAuthStore } from '@/store/authStore'
import {
    clientesApi, ApiError,
    type CandidatoLote, type ConfigMotorRecompra, type ModoRecompra, type PreviewProgramacion,
    type ResultadoProgramacion, type SegmentoRecompra,
} from '@/lib/api'
import { toast } from 'sonner'
import { Loader2, Search, Send, X, Users, Info, CheckCircle2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
    CANTIDAD_MAX, CANTIDAD_MIN, CONTROL_MAX, CONTROL_MIN, DIAS_TOQUE_MAX, DIAS_TOQUE_MIN,
    SEGMENTOS, SEG_META, controlDeLote, formatCurrency, formatDiaHora, toqueOrdinal,
} from './comun'
import { Campo, ChipOpcion, Marca, Stepper } from './controles'
import ListaClientesLote, { type FilaLote } from './ListaClientesLote'

// =============================================================================
// PROGRAMAR UN ENVÍO — el asistente
//
// El motor ya no sale a buscar clientes solo: esta es la única puerta por la que entran mensajes
// nuevos. El dueño decide a quiénes, cuántos, hasta qué toque y cada cuánto, ve la lista concreta y
// recién ahí la programación viaja al backend, que agenda cada envío con su día y su hora.
//
// La cuenta que se muestra acá es la MISMA que va a hacer el backend, a propósito: los candidatos ya
// vienen en orden de prioridad y sin los comprometidos, así que "los primeros N de la lista" es una
// decisión que se puede mostrar antes de tomarla. Si esta cuenta y la del servidor divergieran, el
// resumen del paso 4 estaría mintiendo, y el dueño programa confiando en ese número.
// (`seleccionarCandidatos` en `backend/src/lib/recompra-programacion.ts`.)
// =============================================================================

interface Props {
    config: ConfigMotorRecompra
    onCerrar: () => void
    /** La tanda ya está creada: la pantalla recarga y el asistente se cierra. */
    onProgramado: () => void
}

type ToqueHasta = 1 | 2 | 3

export default function DialogoProgramarEnvio({ config, onCerrar, onProgramado }: Props) {
    const token = useAuthStore(state => state.token)

    // Paso 1 — a quiénes y cuántos
    const [segmento, setSegmento] = useState<SegmentoRecompra | null>(null)
    const [cantidad, setCantidad] = useState(50)

    // Paso 2 — la lista. `excluidos` saca del lote; `manuales` agrega ADEMÁS de la cantidad pedida.
    const [excluidos, setExcluidos] = useState<Set<number>>(new Set())
    const [manuales, setManuales] = useState<Set<number>>(new Set())
    const [busqueda, setBusqueda] = useState('')

    // Paso 3 — hasta qué toque y cada cuánto
    const [toqueHasta, setToqueHasta] = useState<ToqueHasta>(1)
    const [diasToque2, setDiasToque2] = useState(config.diasToque2)
    const [diasToque3, setDiasToque3] = useState(config.diasToque3)

    // El % de control arranca en el del local: cambiarlo acá es una decisión de esta tanda.
    const [porcentajeControl, setPorcentajeControl] = useState(config.porcentajeControl)

    const [preview, setPreview] = useState<PreviewProgramacion | null>(null)
    const [cargandoPreview, setCargandoPreview] = useState(true)
    const [enviando, setEnviando] = useState(false)
    const [resultado, setResultado] = useState<ResultadoProgramacion | null>(null)

    // Todo cliente que alguna vez apareció en pantalla, para poder resolver los `manuales` aunque el
    // buscador se haya vaciado después: el id sigue en la programación, y el resumen tiene que seguir
    // contándolo.
    const vistos = useRef<Map<number, CandidatoLote>>(new Map())

    // El universo del asistente. No depende de la cantidad: la lista viene con lugar de sobra
    // (500 candidatos, el tope del backend) y el recorte por N se hace acá, sin volver a preguntar.
    const cargarPreview = useCallback(async (texto: string) => {
        if (!token) return
        setCargandoPreview(true)
        try {
            const res = await clientesApi.previewProgramacionRecompra(token, {
                segmento,
                limite: CANTIDAD_MAX,
                buscar: texto.trim().length >= 2 ? texto.trim() : null,
            })
            if (!res.success) return
            setPreview(res.data)
            for (const c of [...res.data.candidatos, ...res.data.busqueda]) vistos.current.set(c.clienteId, c)
        } catch (err) {
            if (err instanceof ApiError && err.status === 403) toast.error('Activá el módulo Retención para programar envíos')
            else toast.error('No se pudo cargar la lista de clientes')
        } finally {
            setCargandoPreview(false)
        }
    }, [token, segmento])

    // Debounce: el segmento y el buscador cambian de a un clic, pero el buscador cambia de a una
    // tecla. Un contador de secuencia descarta las respuestas que llegan fuera de orden.
    useEffect(() => {
        const timer = window.setTimeout(() => void cargarPreview(busqueda), 250)
        return () => window.clearTimeout(timer)
    }, [cargarPreview, busqueda])

    const pool = useMemo(() => preview?.candidatos ?? [], [preview])

    // ── La cuenta, idéntica a la del backend ────────────────────────────────────
    const seleccion = useMemo(() => {
        const manualesClientes = [...manuales]
            .map(id => vistos.current.get(id))
            .filter((c): c is CandidatoLote => !!c)

        const resto = pool.filter(c => !excluidos.has(c.clienteId) && !manuales.has(c.clienteId))
        const automaticos = resto.slice(0, cantidad)
        const contactar = [...manualesClientes, ...automaticos]
        // El control sale de los SIGUIENTES de la misma lista: no descuenta de la cantidad pedida ni
        // gasta cupo. Es lo que lo mantiene comparable con los contactados.
        const nControl = controlDeLote(contactar.length, porcentajeControl)
        const control = resto.slice(automaticos.length, automaticos.length + nControl)
        return { manualesClientes, automaticos, contactar, control, nControl }
    }, [pool, excluidos, manuales, cantidad, porcentajeControl])

    const idsAutomaticos = useMemo(() => new Set(seleccion.automaticos.map(c => c.clienteId)), [seleccion])
    const idsControl = useMemo(() => new Set(seleccion.control.map(c => c.clienteId)), [seleccion])

    /**
     * El único movimiento de la lista, con los dos sentidos que el backend entiende:
     * - destildar a uno del lote → `excluirIds`: sale y entra el siguiente de la lista.
     * - tildar a uno que no estaba → `incluirIds`: entra ADEMÁS, sin correr a nadie.
     * Volver a tildar al que se había sacado lo devuelve al lote automático en vez de contarlo como
     * agregado a mano: si no, el resumen inflaría la cuenta con un cliente que ya estaba en los N.
     *
     * El control destilda como el lote y no como un agregado: también está tildado, así que el clic
     * significa "sacarlo de la tanda". Tratarlo como agregado a mano lo convertiría en contactado —el
     * reverso de lo que pidió el clic— y encima le bajaría un cliente al control sin que nadie lo pida.
     */
    const alternar = (clienteId: number) => {
        if (idsAutomaticos.has(clienteId) || idsControl.has(clienteId)) {
            setExcluidos(prev => new Set(prev).add(clienteId))
            setManuales(prev => { const s = new Set(prev); s.delete(clienteId); return s })
            return
        }
        if (manuales.has(clienteId)) {
            setManuales(prev => { const s = new Set(prev); s.delete(clienteId); return s })
            return
        }
        if (excluidos.has(clienteId)) {
            setExcluidos(prev => { const s = new Set(prev); s.delete(clienteId); return s })
            return
        }
        setManuales(prev => new Set(prev).add(clienteId))
    }

    // La lista que se ve: los agregados a mano primero (así viajan al backend), después el lote con
    // el control y unos cuantos en espera, para que se entienda de dónde sale el que entra si sacás a
    // alguien. El `+5` es sólo contexto visual.
    const filas = useMemo<FilaLote[]>(() => {
        const deLaLista = pool.slice(0, Math.min(pool.length, cantidad + seleccion.nControl + 5))
        const idsMostrados = new Set(deLaLista.map(c => c.clienteId))
        return [
            ...seleccion.manualesClientes
                .filter(c => !idsMostrados.has(c.clienteId))
                .map(c => ({ cliente: c, rol: 'contactar' as const, incluido: true, manual: true, origen: 'busqueda' as const })),
            ...deLaLista.map(c => ({
                cliente: c,
                rol: idsAutomaticos.has(c.clienteId) ? 'contactar' as const : idsControl.has(c.clienteId) ? 'control' as const : 'espera' as const,
                incluido: !excluidos.has(c.clienteId),
                // El agregado a mano se marca aunque caiga dentro de la ventana que ya se veía: el
                // resumen lo cuenta aparte de los N, y la fila tiene que decir lo mismo que el resumen.
                manual: manuales.has(c.clienteId),
                origen: 'lote' as const,
            })),
        ]
    }, [pool, cantidad, seleccion, excluidos, manuales, idsAutomaticos, idsControl])

    const resultadosBusqueda = useMemo<FilaLote[]>(() => {
        return (preview?.busqueda ?? []).map(c => ({
            cliente: c,
            rol: idsAutomaticos.has(c.clienteId) ? 'contactar' as const : 'espera' as const,
            // Tildado si ya está en el lote o si el dueño lo agregó a mano; destildado si lo sacó.
            incluido: manuales.has(c.clienteId) || (idsAutomaticos.has(c.clienteId) && !excluidos.has(c.clienteId)),
            manual: manuales.has(c.clienteId),
            origen: 'busqueda' as const,
        }))
    }, [preview, idsAutomaticos, excluidos, manuales])

    const resumen = preview?.resumen
    const cantidadMax = resumen?.cantidadMax ?? CANTIDAD_MAX
    const diasMin = resumen?.diasMinEntreToques ?? DIAS_TOQUE_MIN
    const elegiblesDelSegmento = segmento
        ? (resumen?.porSegmento.find(s => s.segmento === segmento)?.elegibles ?? 0)
        : (resumen?.totalElegibles ?? 0)

    const programar = async () => {
        if (!token || enviando) return
        setEnviando(true)
        try {
            const res = await clientesApi.programarRecompra(token, {
                segmento,
                cantidad,
                toqueHasta,
                // Los días sólo viajan si la tanda llega a ese toque: si no, quedarían escritos en la
                // campaña como si fueran a usarse.
                diasToque2: toqueHasta >= 2 ? diasToque2 : null,
                diasToque3: toqueHasta >= 3 ? diasToque3 : null,
                porcentajeControl,
                incluirIds: [...manuales],
                excluirIds: [...excluidos],
            })
            if (!res.success) {
                // `vacio` viene con 200: no es un error, es "no hay a quién".
                toast.info(res.message || 'No hay clientes elegibles para programar')
                void cargarPreview(busqueda)
                return
            }
            setResultado(res.data)
        } catch (err) {
            if (err instanceof ApiError && err.status === 403) toast.error('Activá el módulo Retención para programar envíos')
            else if (err instanceof ApiError && err.status === 400) toast.error('La programación no es válida. Revisá los valores.')
            else toast.error('No se pudo programar el envío')
        } finally {
            setEnviando(false)
        }
    }

    return (
        <Dialog open onOpenChange={(abierto) => { if (!abierto && !enviando) onCerrar() }}>
            <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
                {resultado ? (
                    <Resultado resultado={resultado} onListo={onProgramado} />
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle>Programar envío</DialogTitle>
                            <DialogDescription>
                                Elegí a quiénes y cuántos. Los mensajes quedan agendados con su día y su hora;
                                el motor los manda de a poco, respetando el cupo diario.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-5 py-1">
                            {/* 1. A QUIÉNES */}
                            <Campo
                                titulo="1 · A quiénes"
                                accion={resumen && (
                                    <span className="text-[11px] text-muted-foreground/70">
                                        {resumen.totalElegibles} disponibles
                                        {resumen.totalEnTanda > 0 && ` · ${resumen.totalEnTanda} ya en una tanda`}
                                    </span>
                                )}
                            >
                                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                                    <ChipOpcion
                                        activo={segmento === null}
                                        onClick={() => setSegmento(null)}
                                        title="Todos los segmentos recuperables, mezclados por prioridad"
                                    >
                                        <span className="truncate">En general</span>
                                    </ChipOpcion>
                                    {SEGMENTOS.map(s => {
                                        const cuantos = resumen?.porSegmento.find(p => p.segmento === s)?.elegibles ?? 0
                                        return (
                                            <ChipOpcion
                                                key={s}
                                                activo={segmento === s}
                                                onClick={() => setSegmento(s)}
                                                title={`${SEG_META[s].label}: ${cuantos} clientes disponibles`}
                                            >
                                                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", SEG_META[s].dot)} />
                                                <span className="truncate">{SEG_META[s].label}</span>
                                                <span className="shrink-0 tabular-nums opacity-60">{cuantos}</span>
                                            </ChipOpcion>
                                        )
                                    })}
                                </div>

                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                    <span className="text-xs text-muted-foreground">Cantidad</span>
                                    <Input
                                        type="number"
                                        value={cantidad}
                                        min={CANTIDAD_MIN}
                                        max={cantidadMax}
                                        onChange={(e) => {
                                            const n = Number(e.target.value)
                                            setCantidad(Number.isFinite(n) ? Math.max(CANTIDAD_MIN, Math.min(cantidadMax, Math.trunc(n))) : CANTIDAD_MIN)
                                        }}
                                        className="h-8 w-20 text-center text-sm tabular-nums"
                                    />
                                    {[20, 50, 100].map(n => (
                                        <ChipOpcion key={n} activo={cantidad === n} onClick={() => setCantidad(n)}>{n}</ChipOpcion>
                                    ))}
                                    <ChipOpcion
                                        activo={false}
                                        onClick={() => setCantidad(Math.max(CANTIDAD_MIN, Math.min(cantidadMax, elegiblesDelSegmento)))}
                                        title="Todos los que hoy pueden recibir un mensaje sin repetir el mismo toque"
                                    >
                                        Todos
                                    </ChipOpcion>
                                </div>
                                <p className="text-[11px] text-muted-foreground/70">
                                    Salen hasta {resumen?.cupoDiario ?? config.cupoDiario} por día
                                    {resumen && ` (hoy ya salieron ${resumen.enviadosHoy})`} y cada cliente cae en su día y su horario.
                                    {resumen && resumen.cantidad > resumen.cupoRestanteHoy && ' La tanda tarda más de un día.'}
                                </p>
                            </Campo>

                            {/* 2. LA LISTA */}
                            <Campo
                                titulo="2 · La lista"
                                accion={(
                                    <span className="text-[11px] font-medium text-foreground">
                                        {seleccion.contactar.length} seleccionado{seleccion.contactar.length === 1 ? '' : 's'}
                                        {seleccion.manualesClientes.length > 0 && ` (incluye ${seleccion.manualesClientes.length} a mano)`}
                                    </span>
                                )}
                            >
                                {cargandoPreview && !preview ? (
                                    <div className="flex items-center justify-center gap-2 rounded-xl border border-border/40 py-10 text-xs text-muted-foreground">
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Armando la lista…
                                    </div>
                                ) : (
                                    <ListaClientesLote
                                        filas={filas}
                                        onAlternar={alternar}
                                        vacioTexto="No hay clientes elegibles en ese segmento"
                                        vacioSubtexto="Los que ya están en otra tanda, o los que recibieron un toque hace menos de 48 hs, no se pueden programar de nuevo."
                                    />
                                )}

                                <div className="flex items-start gap-2 pt-1 text-[11px] text-muted-foreground/70">
                                    <Info className="mt-0.5 h-3 w-3 shrink-0" />
                                    <span>
                                        Destildar a alguien no achica la tanda: entra el siguiente de la lista. Los
                                        marcados <span className="font-medium text-foreground">Control</span> no reciben
                                        nada y son los que después muestran cuánto generó el motor de verdad.
                                    </span>
                                </div>

                                {/* Buscador para agregar a alguien puntual, aunque no esté entre los primeros */}
                                <div className="relative pt-1">
                                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                                    <Input
                                        value={busqueda}
                                        onChange={(e) => setBusqueda(e.target.value)}
                                        placeholder="Agregar a un cliente puntual (nombre o teléfono)"
                                        className="h-8 pl-8 text-sm"
                                    />
                                    {busqueda && (
                                        <button
                                            type="button"
                                            onClick={() => setBusqueda('')}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                                {busqueda.trim().length >= 2 && (
                                    resultadosBusqueda.length > 0 ? (
                                        <ListaClientesLote
                                            filas={resultadosBusqueda}
                                            onAlternar={alternar}
                                            vacioTexto="Sin coincidencias"
                                        />
                                    ) : (
                                        <p className="text-[11px] text-muted-foreground/70">
                                            {cargandoPreview ? 'Buscando…' : 'Nadie con ese nombre o teléfono. Los clientes que ya están en otra tanda no se pueden agregar.'}
                                        </p>
                                    )
                                )}
                            </Campo>

                            {/* 3. HASTA QUÉ TOQUE Y CADA CUÁNTO */}
                            <Campo titulo="3 · Toques">
                                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                                    <ChipOpcion activo={toqueHasta === 1} onClick={() => setToqueHasta(1)}
                                        title="Un solo mensaje por cliente. La tanda termina cuando sale el último primero.">
                                        <span className="truncate">Sólo el 1º</span>
                                    </ChipOpcion>
                                    <ChipOpcion activo={toqueHasta === 2} onClick={() => setToqueHasta(2)}
                                        title="Al que no volvió a pedir se le manda un recordatorio.">
                                        <span className="truncate">1º y 2º</span>
                                    </ChipOpcion>
                                    <ChipOpcion activo={toqueHasta === 3} onClick={() => setToqueHasta(3)}
                                        title="Recordatorio y cierre. El 3º es el último que existe.">
                                        <span className="truncate">Los tres</span>
                                        <Marca>máx</Marca>
                                    </ChipOpcion>
                                </div>

                                {toqueHasta >= 2 && (
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
                                        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                                            <span className="text-foreground">{toqueOrdinal(2)} toque a los</span>
                                            <Stepper value={diasToque2} onChange={setDiasToque2} min={diasMin} max={DIAS_TOQUE_MAX} paso={1} />
                                            <span>días</span>
                                        </span>
                                        {toqueHasta >= 3 && (
                                            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                                                <span className="text-foreground">{toqueOrdinal(3)} toque a los</span>
                                                <Stepper value={diasToque3} onChange={setDiasToque3} min={diasMin} max={DIAS_TOQUE_MAX} paso={1} />
                                                <span>días</span>
                                            </span>
                                        )}
                                    </div>
                                )}
                                <p className="text-[11px] text-muted-foreground/70">
                                    El mínimo son {diasMin} días (48 hs) y no se puede bajar: es la protección contra
                                    insistir de más. El que vuelve a pedir sale de la tanda al instante.
                                </p>
                            </Campo>

                            {/* 4. CONTROL */}
                            <Campo
                                titulo="4 · Grupo de control"
                                accion={<span className="text-[11px] text-muted-foreground/70">para medir el resultado real</span>}
                            >
                                <div className="flex flex-wrap items-center gap-2">
                                    <Stepper value={porcentajeControl} onChange={setPorcentajeControl} min={CONTROL_MIN} max={CONTROL_MAX} />
                                    <span className="text-xs text-muted-foreground">
                                        % apartado del lote
                                        {seleccion.nControl > 0 && ` · ${seleccion.nControl} clientes`}
                                    </span>
                                    {porcentajeControl === 0 && (
                                        <span className="text-[11px] text-muted-foreground/70">
                                            Sin control no vas a poder comparar contra quienes no recibieron nada.
                                        </span>
                                    )}
                                </div>
                            </Campo>

                            {/* RESUMEN */}
                            <Resumen
                                contactar={seleccion.contactar.length}
                                manuales={seleccion.manualesClientes.length}
                                control={seleccion.nControl}
                                toqueHasta={toqueHasta}
                                diasToque2={diasToque2}
                                diasToque3={diasToque3}
                                primerHorario={seleccion.contactar[0]?.horarioSugerido ?? null}
                                saldo={resumen?.saldoMarketing ?? 0}
                                modo={resumen?.modo ?? config.modo}
                                enHorarioSilencio={resumen?.horarioSilencio ?? false}
                                facturacion={seleccion.contactar.reduce((acc, c) => acc + c.totalGastado, 0)}
                            />
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button variant="ghost" onClick={onCerrar} disabled={enviando}>Cancelar</Button>
                            <Button
                                onClick={programar}
                                disabled={enviando || seleccion.contactar.length === 0 || cargandoPreview}
                                className="gap-2"
                            >
                                {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                Programar {seleccion.contactar.length} mensaje{seleccion.contactar.length === 1 ? '' : 's'}
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}

/**
 * El resumen de una línea que reemplaza al muro de texto: qué va a pasar si se confirma. Dice lo que
 * va a hacer el motor, no lo que el dueño querría leer: si hay poca plata o la tanda es más grande
 * que el cupo del día, lo dice acá y no después.
 */
function Resumen({
    contactar, manuales, control, toqueHasta, diasToque2, diasToque3, primerHorario,
    saldo, modo, enHorarioSilencio, facturacion,
}: {
    contactar: number
    manuales: number
    control: number
    toqueHasta: ToqueHasta
    diasToque2: number
    diasToque3: number
    primerHorario: string | null
    saldo: number
    modo: ModoRecompra
    enHorarioSilencio: boolean
    facturacion: number
}) {
    const automaticos = Math.max(0, contactar - manuales)
    const sinSaldo = modo === 'automatico' && saldo < contactar
    const toques = toqueHasta === 1
        ? 'un mensaje por cliente'
        : toqueHasta === 2
            ? `un mensaje por cliente y un recordatorio a los ${diasToque2} días`
            : `un mensaje por cliente, un recordatorio a los ${diasToque2} días y un cierre a los ${diasToque3}`

    return (
        <div className="space-y-2 rounded-xl border border-border/40 bg-muted/30 p-3.5">
            <p className="text-sm leading-relaxed text-foreground">
                Vas a programar <strong className="font-semibold">{contactar} mensaje{contactar === 1 ? '' : 's'}</strong>
                {manuales > 0 && <> ({automaticos} de la lista + {manuales} que agregaste vos)</>}
                {control > 0 && <>, más <strong className="font-semibold">{control}</strong> en el grupo de control</>}.
                Sale {toques}.
            </p>
            <p className="text-xs text-muted-foreground">
                {primerHorario ? `El primero sale ${primerHorario}.` : 'Arranca hoy.'}
                {' '}Son {formatCurrency(facturacion)} de compra histórica.
            </p>

            {sinSaldo && (
                <p className="flex items-start gap-1.5 text-xs text-orange-600 dark:text-orange-400">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>
                        Te quedan {saldo} créditos de marketing y la tanda es más grande: los que no alcancen
                        quedan esperando en la cola hasta que recargues.
                    </span>
                </p>
            )}
            {modo === 'manual' && (
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Info className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>El motor está en modo Manual: los mensajes se preparan en la cola y los enviás vos, sin gastar créditos.</span>
                </p>
            )}
            {enHorarioSilencio && (
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Info className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>Ahora es horario de silencio (22 a 9): lo que venza en este rato sale después de las 9.</span>
                </p>
            )}
        </div>
    )
}

/** Lo que quedó agendado de verdad, según el backend. Es la única versión que no puede mentir. */
function Resultado({ resultado, onListo }: { resultado: ResultadoProgramacion; onListo: () => void }) {
    const ignorados = resultado.omitidos.length
    return (
        <>
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    Programado
                </DialogTitle>
                <DialogDescription>
                    No salió ningún mensaje todavía: quedaron agendados y el motor los manda de a poco.
                </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-1">
                <div className="grid grid-cols-3 gap-4 border-y border-border/30 py-4">
                    <Metrica etiqueta="Mensajes" valor={resultado.cantidad} />
                    <Metrica etiqueta="Control" valor={resultado.control} />
                    <Metrica etiqueta="En cola" valor={resultado.filasCreadas} />
                </div>

                {resultado.porSegmento.length > 1 && (
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {resultado.porSegmento.map(s => (
                            <span key={s.segmento} className="inline-flex items-center gap-1.5">
                                <span className={cn("h-1.5 w-1.5 rounded-full", SEG_META[s.segmento].dot)} />
                                {SEG_META[s.segmento].label}: {s.contactar}
                            </span>
                        ))}
                    </div>
                )}

                <p className="text-sm text-muted-foreground">
                    {resultado.primerDespachoAt
                        ? <>El primero sale {formatDiaHora(resultado.primerDespachoAt)}.</>
                        : 'Arranca en el próximo despacho.'}
                    {' '}Hasta {resultado.cupoDiario} por día.
                    {resultado.toqueHasta > 1 && ` Cada cliente llega hasta el ${toqueOrdinal(resultado.toqueHasta)} toque.`}
                </p>

                {ignorados > 0 && (
                    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <Info className="mt-0.5 h-3 w-3 shrink-0" />
                        <span>
                            {ignorados} cliente{ignorados === 1 ? '' : 's'} quedó afuera: ya estaba en otra tanda,
                            se había dado de baja o no se podía contactar.
                        </span>
                    </p>
                )}
            </div>

            <DialogFooter>
                <Button onClick={onListo} className="gap-2">
                    <Users className="h-4 w-4" /> Ver las tandas
                </Button>
            </DialogFooter>
        </>
    )
}

function Metrica({ etiqueta, valor }: { etiqueta: string; valor: number }) {
    return (
        <div className="flex flex-col">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">{etiqueta}</span>
            <span className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-foreground">{valor}</span>
        </div>
    )
}
