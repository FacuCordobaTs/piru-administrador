import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/store/authStore'
import {
    clientesApi, ApiError,
    type CandidatoLote, type ConfigMotorRecompra, type ModoRecompra, type PreviewProgramacion,
    type SegmentoRecompra,
} from '@/lib/api'
import { toast } from 'sonner'
import { AlertTriangle, Info, Loader2, Search, Send, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
    CANTIDAD_MAX, CANTIDAD_MIN, CONTROL_MAX, CONTROL_MIN, CUPO_MAX, CUPO_MIN, DIAS_TOQUE_MAX,
    DIAS_TOQUE_MIN, PASOS, SEGMENTOS, SEG_META, controlDeLote, copyEnvio, formatCurrency,
    hayCambios, mensajeDeAjuste, toqueOrdinal, type PasoId, type ValoresConfig,
} from './comun'
import { CampoModo, ChipOpcion, Marca, Stepper } from './controles'
import { IndicadorPasos, PiePasos } from './Pasos'
import ListaClientesLote, { ALTO_LISTA, type FilaLote } from './ListaClientesLote'

// =============================================================================
// EL FLUJO DE ENVÍO — la única puerta por la que entran mensajes nuevos
//
// El motor ya no sale a buscar clientes solo. El dueño decide el modo, el ritmo del local, a quiénes,
// cuántos, hasta qué toque y cada cuánto; ve la lista concreta; y recién en el último paso la
// programación viaja al backend, que agenda cada envío con su día y su hora.
//
// Es una pantalla, no un diálogo: ocho pasos, de a un valor cada uno. La forma importa porque en modo
// Manual la acción no es "programar" —el motor prepara los mensajes y los manda el dueño desde su
// WhatsApp—, y el vocabulario tiene que decir eso. Lo elige `copyEnvio(modo)`.
//
// NADA se guarda hasta el botón final, y ahí van dos llamadas EN ESTE ORDEN:
//
//   1. `PUT /config`, sólo si alguno de los cinco valores del local cambió.
//   2. `POST /programar`, con la tanda.
//
// El orden es el seguro. En automático, el tick puede mandar un WhatsApp y descontar créditos apenas
// exista una fila pendiente: si la tanda se creara primero, un fallo al guardar la config dejaría al
// dueño creyendo que está en Manual mientras el motor manda solo. Al revés, un fallo deja el local en
// el modo elegido y nada agendado, que es un estado del que se sale volviendo a apretar el botón.
//
// La cuenta que se muestra acá es la MISMA que va a hacer el backend, a propósito: los candidatos ya
// vienen en orden de prioridad y sin los comprometidos, así que "los primeros N de la lista" es una
// decisión que se puede mostrar antes de tomarla. Si esta cuenta y la del servidor divergieran, el
// resumen del último paso estaría mintiendo, y el dueño programa confiando en ese número.
// (`seleccionarCandidatos` en `backend/src/lib/recompra-programacion.ts`.)
// =============================================================================

interface Props {
    config: ConfigMotorRecompra
    /** Vuelve a la pantalla anterior sin guardar nada. Sin esto, el flujo no ofrece salida. */
    onCancelar?: () => void
    /** La tanda ya está creada: la pantalla recarga y el flujo se cierra. */
    onTerminado: () => void
}

type ToqueHasta = 1 | 2 | 3

/** Lo que explica cada paso, abajo del riel. El título ya está en el encabezado del paso. */
const SUBTITULOS: Record<PasoId, string> = {
    modo: 'Quién manda los mensajes. Es una decisión del local, así que vale para todas las tandas.',
    cupo: 'Cuántos mensajes por día sale el local, sumando todas las tandas. Es el que cuida el número de WhatsApp.',
    dias: 'Cuánto espera el motor entre un toque y el siguiente. El piso son 48 horas y no se puede bajar.',
    'a-quienes': 'De dónde sale la tanda y cuántos mensajes lleva. Los clientes ya vienen ordenados por prioridad.',
    lista: 'La lista concreta de esta tanda. Destildar a alguien no la achica: entra el siguiente de la lista.',
    toques: 'Hasta qué mensaje llega cada cliente. El que vuelve a pedir sale de la tanda al instante.',
    control: 'Qué parte del lote no recibe nada, para poder medir cuánto generó el motor de verdad.',
    resumen: 'Lo que va a pasar si confirmás. Todavía no se guardó nada.',
}

export default function FlujoEnvioTanda({ config, onCancelar, onTerminado }: Props) {
    const token = useAuthStore(state => state.token)

    const [paso, setPaso] = useState(0)
    const pasoId = PASOS[paso].id

    // Paso 1 — el modo del local. Arranca en el que ya tiene y no se guarda hasta confirmar.
    const [modo, setModo] = useState<ModoRecompra>(config.modo)
    const copy = copyEnvio(modo)

    // Paso 2 — el cupo diario. Es del LOCAL: protege el número y se reparte entre las tandas vivas.
    const [cupoDiario, setCupoDiario] = useState(config.cupoDiario)

    // Paso 3 — cada cuánto se puede repetir el toque. También es del local, como default de las tandas.
    const [diasToque2, setDiasToque2] = useState(config.diasToque2)
    const [diasToque3, setDiasToque3] = useState(config.diasToque3)

    // Paso 4 — a quiénes y cuántos.
    const [segmento, setSegmento] = useState<SegmentoRecompra | null>(null)
    const [cantidad, setCantidad] = useState(50)

    // Paso 5 — la lista. `excluidos` saca del lote; `manuales` agrega ADEMÁS de la cantidad pedida.
    const [excluidos, setExcluidos] = useState<Set<number>>(new Set())
    const [manuales, setManuales] = useState<Set<number>>(new Set())
    const [busqueda, setBusqueda] = useState('')

    // Paso 6 — hasta qué toque llega la tanda.
    const [toqueHasta, setToqueHasta] = useState<ToqueHasta>(1)

    // Paso 7 — el % de control. Arranca en el del local: cambiarlo acá es una decisión de esta tanda.
    const [porcentajeControl, setPorcentajeControl] = useState(config.porcentajeControl)

    const [preview, setPreview] = useState<PreviewProgramacion | null>(null)
    const [cargandoPreview, setCargandoPreview] = useState(true)
    const [enviando, setEnviando] = useState(false)

    // Todo cliente que alguna vez apareció en pantalla, para poder resolver los `manuales` aunque el
    // buscador se haya vaciado después: el id sigue en la programación, y el resumen tiene que seguir
    // contándolo.
    const vistos = useRef<Map<number, CandidatoLote>>(new Map())

    // El universo del flujo. No depende de la cantidad: la lista viene con lugar de sobra (500
    // candidatos, el tope del backend) y el recorte por N se hace acá, sin volver a preguntar.
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

    // Debounce: el segmento cambia de a un clic, pero el buscador de a una tecla. El pedido sale una
    // vez al montar —así los pasos muestran números reales y no literales— y después con cada tecla.
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

    const valores: ValoresConfig = { cupoDiario, diasToque2, diasToque3, porcentajeControl, modo }
    const configCambia = hayCambios(valores, config)

    const avanzar = () => setPaso(p => Math.min(PASOS.length - 1, p + 1))
    const atras = () => setPaso(p => Math.max(0, p - 1))

    // El único paso que puede quedar sin con qué seguir: la lista vacía. Los demás tienen un valor
    // puesto por defecto, así que trabar el avance ahí sería un botón muerto sin explicación.
    const sinLista = seleccion.contactar.length === 0

    const confirmar = async () => {
        if (!token || enviando || sinLista) return
        setEnviando(true)
        try {
            // 1) La config del local, sólo si cambió. Va primero por lo que explica el encabezado.
            if (configCambia) {
                const res = await clientesApi.configRecompra(token, valores)
                if (!res.success) {
                    toast.error('No se pudo guardar la configuración del motor. No se guardó nada.')
                    return
                }
                toast.success(mensajeDeAjuste(valores, res.data?.config))
            }

            // 2) La tanda. Los días sólo viajan si la tanda llega a ese toque: si no, quedarían
            //    escritos en la campaña como si fueran a usarse.
            const res = await clientesApi.programarRecompra(token, {
                segmento,
                cantidad,
                toqueHasta,
                diasToque2: toqueHasta >= 2 ? diasToque2 : null,
                diasToque3: toqueHasta >= 3 ? diasToque3 : null,
                porcentajeControl,
                incluirIds: [...manuales],
                excluirIds: [...excluidos],
            })
            if (!res.success) {
                // `vacio` viene con 200: no es un error, es "no hay a quién".
                toast.info(res.message || `No hay clientes elegibles para ${copy.infinitivo}`)
                void cargarPreview(busqueda)
                return
            }
            // Confirmar es la última pantalla: no hay paso de resultado que repita lo que el dueño
            // acaba de decidir. La tanda queda a la vista en el tablero, que es adonde vuelve la
            // pantalla, con lo agendado y su próximo despacho.
            onTerminado()
        } catch (err) {
            if (err instanceof ApiError && err.status === 403) toast.error('Activá el módulo Retención para configurar el motor')
            else if (err instanceof ApiError && err.status === 400) toast.error('La tanda no es válida. Revisá los valores.')
            else toast.error(`No se pudieron ${copy.infinitivo} los mensajes`)
        } finally {
            setEnviando(false)
        }
    }

    return (
        <div data-testid="asistente-envio" data-paso={pasoId} className="rounded-2xl border border-border/40 bg-white/80 p-5 shadow-2xs backdrop-blur-xs dark:bg-muted/30">
            <div className="space-y-1.5">
                <IndicadorPasos actual={paso} />
                <p className="text-xs leading-relaxed text-muted-foreground">{SUBTITULOS[pasoId]}</p>
            </div>

            <div className="space-y-3 py-4">
                {pasoId === 'modo' && (
                    <>
                        <CampoModo valor={modo} onChange={setModo} />
                        {modo === 'automatico' && (
                            <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground/80">
                                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                <span>Cada mensaje usa un crédito de marketing{resumen ? ` y hoy tenés ${resumen.saldoMarketing}` : ''}. El motor los manda solo, de a poco y con el cupo del día.</span>
                            </p>
                        )}
                    </>
                )}

                {pasoId === 'cupo' && (
                    <div className="flex justify-center py-4">
                        <Stepper
                            value={cupoDiario}
                            onChange={setCupoDiario}
                            min={CUPO_MIN}
                            max={CUPO_MAX}
                            ariaLabel="Cupo diario"
                        />
                    </div>
                )}

                {pasoId === 'dias' && (
                    <div className="space-y-3 py-2">
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="w-36 text-sm text-foreground">1º → 2º toque</span>
                            <Stepper
                                value={diasToque2}
                                onChange={setDiasToque2}
                                min={diasMin}
                                max={DIAS_TOQUE_MAX}
                                paso={1}
                                ariaLabel="Días hasta el 2º toque"
                            />
                            <span className="text-sm text-muted-foreground">días</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="w-36 text-sm text-foreground">2º → 3º toque</span>
                            <Stepper
                                value={diasToque3}
                                onChange={setDiasToque3}
                                min={diasMin}
                                max={DIAS_TOQUE_MAX}
                                paso={1}
                                ariaLabel="Días hasta el 3º toque"
                            />
                            <span className="text-sm text-muted-foreground">días</span>
                        </div>
                    </div>
                )}

                {pasoId === 'a-quienes' && (
                    <>
                        {/* Tres columnas y sin recortar la etiqueta: "Primer pedido" y "En riesgo" se
                            leen enteros, que es lo que el dueño está eligiendo. */}
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            <ChipOpcion
                                activo={segmento === null}
                                onClick={() => setSegmento(null)}
                                title="Todos los segmentos recuperables, mezclados por prioridad"
                            >
                                En general
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
                                        <span className={cn("h-2 w-2 shrink-0 rounded-full", SEG_META[s].dot)} />
                                        <span>{SEG_META[s].label}</span>
                                        <span className="shrink-0 tabular-nums opacity-60">{cuantos}</span>
                                    </ChipOpcion>
                                )
                            })}
                        </div>
                        {resumen && (
                            <p className="text-xs text-muted-foreground/70">
                                {resumen.totalElegibles} disponibles
                                {resumen.totalEnTanda > 0 && ` · ${resumen.totalEnTanda} ya en una tanda`}
                            </p>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm text-muted-foreground">Cantidad</span>
                            <Input
                                type="number"
                                value={cantidad}
                                min={CANTIDAD_MIN}
                                max={cantidadMax}
                                aria-label="Cantidad de mensajes"
                                onChange={(e) => {
                                    const n = Number(e.target.value)
                                    setCantidad(Number.isFinite(n) ? Math.max(CANTIDAD_MIN, Math.min(cantidadMax, Math.trunc(n))) : CANTIDAD_MIN)
                                }}
                                className="h-10 w-24 text-center text-base tabular-nums"
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
                    </>
                )}

                {pasoId === 'lista' && (
                    <>
                        {/* Buscador para agregar a alguien puntual, aunque no esté entre los primeros.
                            Mientras hay búsqueda los resultados OCUPAN LA MISMA CAJA que el lote: el paso
                            nunca apila dos listas y el alto no depende de cuántos coincidan. */}
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                            <Input
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                placeholder="Agregar a un cliente puntual (nombre o teléfono)"
                                className="h-10 pl-9 text-sm"
                            />
                            {busqueda && (
                                <button
                                    type="button"
                                    aria-label="Limpiar búsqueda"
                                    onClick={() => setBusqueda('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>

                        {busqueda.trim().length >= 2 ? (
                            resultadosBusqueda.length > 0 ? (
                                <ListaClientesLote filas={resultadosBusqueda} onAlternar={alternar} alto={ALTO_LISTA} vacioTexto="Sin coincidencias" />
                            ) : (
                                <CajaAlta>
                                    <p className="text-sm font-medium text-foreground">
                                        {cargandoPreview ? 'Buscando…' : 'Sin coincidencias'}
                                    </p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                        Nadie con ese nombre o teléfono. Los que ya están en otra tanda no se pueden agregar.
                                    </p>
                                </CajaAlta>
                            )
                        ) : cargandoPreview && !preview ? (
                            <CajaAlta>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                <span className="text-xs text-muted-foreground">Armando la lista…</span>
                            </CajaAlta>
                        ) : (
                            <ListaClientesLote
                                filas={filas}
                                onAlternar={alternar}
                                alto={ALTO_LISTA}
                                vacioTexto="No hay clientes elegibles en ese segmento"
                                vacioSubtexto="Los que ya están en otra tanda, o los que recibieron un toque hace menos de 48 hs, no se pueden programar de nuevo."
                            />
                        )}
                    </>
                )}

                {pasoId === 'toques' && (
                    <>
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

                        {toqueHasta > 1 && (
                            <p className="text-xs leading-relaxed text-muted-foreground/70">
                                El {toqueOrdinal(2)} toque sale {diasToque2} días después del primero
                                {toqueHasta >= 3 && <> y el {toqueOrdinal(3)}, {diasToque3} días después del segundo</>}.
                                {' '}Se cambian en el paso <button type="button" onClick={() => setPaso(2)} className="font-medium text-foreground hover:underline">Días entre toques</button>.
                            </p>
                        )}
                    </>
                )}

                {pasoId === 'control' && (
                    <div className="flex flex-wrap items-center justify-center gap-3 py-4">
                        <Stepper
                            value={porcentajeControl}
                            onChange={setPorcentajeControl}
                            min={CONTROL_MIN}
                            max={CONTROL_MAX}
                            ariaLabel="Porcentaje del grupo de control"
                        />
                        <span className="text-sm text-muted-foreground">
                            % apartado del lote
                            {seleccion.nControl > 0 && ` · ${seleccion.nControl} cliente${seleccion.nControl === 1 ? '' : 's'}`}
                        </span>
                    </div>
                )}

                {pasoId === 'resumen' && (
                    <>
                        <Resumen
                            contactar={seleccion.contactar.length}
                            manuales={seleccion.manualesClientes.length}
                            control={seleccion.nControl}
                            toqueHasta={toqueHasta}
                            diasToque2={diasToque2}
                            diasToque3={diasToque3}
                            primerHorario={seleccion.contactar[0]?.horarioSugerido ?? null}
                            saldo={resumen?.saldoMarketing ?? 0}
                            modo={modo}
                            enHorarioSilencio={resumen?.horarioSilencio ?? false}
                            facturacion={seleccion.contactar.reduce((acc, c) => acc + c.totalGastado, 0)}
                        />
                        {configCambia && (
                            <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground/80">
                                <Info className="mt-0.5 h-3 w-3 shrink-0" />
                                <span>
                                    Al confirmar también se guardan los valores del local de este flujo: modo{' '}
                                    <span className="font-medium text-foreground">{modo === 'manual' ? 'Manual' : 'Automático'}</span>,{' '}
                                    cupo <span className="font-medium text-foreground">{cupoDiario}/día</span>, toques cada{' '}
                                    <span className="font-medium text-foreground">{diasToque2} y {diasToque3} días</span> y{' '}
                                    <span className="font-medium text-foreground">{porcentajeControl}%</span> de control.
                                    Van a valer para las próximas tandas; el cupo, para todas.
                                </span>
                            </p>
                        )}
                    </>
                )}
            </div>

            <PiePasos
                actual={paso}
                etiquetaFinal={copy.final(seleccion.contactar.length)}
                iconoFinal={<Send className="h-4 w-4" />}
                onAtras={atras}
                onCancelar={onCancelar}
                onAvanzar={pasoId === 'resumen' ? () => void confirmar() : avanzar}
                deshabilitado={pasoId === 'lista' && sinLista}
                ocupado={enviando}
            />
        </div>
    )
}

/** La caja del mismo alto que la lista, para lo que la reemplaza (el buscador, el vacío, el loader). */
function CajaAlta({ children }: { children: ReactNode }) {
    return (
        <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 px-4 text-center", ALTO_LISTA)}>
            {children}
        </div>
    )
}

/**
 * El resumen que reemplaza al muro de texto: qué va a pasar si se confirma. Dice lo que va a hacer el
 * motor, no lo que el dueño querría leer: si hay poca plata o la tanda es más grande que el cupo del
 * día, lo dice acá y no después.
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
                Vas a {copyEnvio(modo).infinitivo} <strong className="font-semibold">{contactar} mensaje{contactar === 1 ? '' : 's'}</strong>
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
                    <span>El motor va a quedar en modo Manual: los mensajes se preparan en la cola y los enviás vos, sin gastar créditos.</span>
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

