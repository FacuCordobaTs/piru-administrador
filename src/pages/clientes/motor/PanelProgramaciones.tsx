import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/authStore'
import {
    clientesApi, ApiError,
    type ConfigMotorRecompra, type EstadoProgramacion, type PlanActivacionRecompra, type ProgramacionResumen,
} from '@/lib/api'
import { toast } from 'sonner'
import {
    CalendarClock, CheckCircle2, Loader2, Pause, Play, Settings2, SlidersHorizontal, Sparkles, X, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
    SEG_META, etiquetaSegmento, formatCurrency, formatDateTime, formatDiaHora, toqueOrdinal,
} from './comun'
import DialogoProgramarEnvio from './DialogoProgramarEnvio'
import DialogoConfigMotor from './DialogoConfigMotor'

// =============================================================================
// LAS TANDAS DEL LOCAL — lo que está programado y todavía no salió
//
// Reemplaza a la pantalla de "encender el motor". El motor ya no se enciende: se programan tandas, y
// esta es la lista de las que están corriendo. Cada tarjeta dice qué segmento agarró, cuánto salió,
// cuánto falta y cuándo vuelve a salir algo; el dueño puede cancelar lo que todavía no salió.
// =============================================================================

const ESTADO_TANDA: Record<EstadoProgramacion, { label: string; clase: string }> = {
    activa: { label: 'En curso', clase: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
    pausada_sin_saldo: { label: 'Pausada sin saldo', clase: 'bg-orange-500/10 text-orange-700 dark:text-orange-400' },
    pausada_manual: { label: 'Pausada', clase: 'bg-muted text-muted-foreground' },
    completada: { label: 'Terminada', clase: 'bg-muted text-muted-foreground' },
    cancelada: { label: 'Cancelada', clase: 'bg-muted text-muted-foreground' },
}

/**
 * El panel de tandas. `compacto` es la versión que va arriba de la cola en la pantalla encendida:
 * mismas tarjetas, sin el bloque de explicación.
 */
export default function PanelProgramaciones({ programaciones, onCambio, onProgramar, onConfig, compacto }: {
    programaciones: ProgramacionResumen[]
    onCambio: () => void
    onProgramar: () => void
    onConfig: () => void
    compacto?: boolean
}) {
    const token = useAuthStore(state => state.token)
    const [cancelandoId, setCancelandoId] = useState<number | null>(null)

    const cancelar = async (tanda: ProgramacionResumen) => {
        if (!token || cancelandoId) return
        setCancelandoId(tanda.id)
        try {
            const res = await clientesApi.cancelarProgramacionRecompra(token, tanda.id)
            if (res.success) {
                const n = res.data?.canceladas ?? 0
                toast.success(n > 0
                    ? `Tanda cancelada: ${n} mensaje${n === 1 ? '' : 's'} que no salieron`
                    : 'Tanda cancelada')
                onCambio()
            }
        } catch (err) {
            if (err instanceof ApiError && err.status === 403) toast.error('Activá el módulo Retención para cancelar tandas')
            else toast.error('No se pudo cancelar la tanda')
        } finally {
            setCancelandoId(null)
        }
    }

    if (programaciones.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 px-4 py-10 text-center">
                <CalendarClock className="mb-2.5 h-7 w-7 text-muted-foreground/30" />
                <p className="text-sm font-medium text-foreground">No hay nada programado</p>
                <p className="mt-0.5 max-w-sm text-xs text-muted-foreground">
                    El motor no manda mensajes por su cuenta: los que salen son los que programás vos.
                </p>
                <Button onClick={onProgramar} size="sm" className="mt-3 gap-2">
                    <Zap className="h-3.5 w-3.5" /> Programar envío
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-2.5">
            {programaciones.map(tanda => {
                const meta = ESTADO_TANDA[tanda.estado] ?? ESTADO_TANDA.completada
                // Las campañas que dejó el goteo viejo no tienen cantidad pedida: se muestran por lo
                // que sí se sabe de ellas (cuántos recibieron, cuánto falta) y sin barra de progreso,
                // que contra un denominador inventado mentiría.
                const objetivo = tanda.cantidadObjetivo
                const avance = objetivo && objetivo > 0 ? Math.min(1, tanda.contactados / objetivo) : null
                const proximo = formatDiaHora(tanda.proximoDespachoAt)
                const cancelable = tanda.estado === 'activa' && tanda.pendientes > 0

                return (
                    <div key={tanda.id} className="rounded-2xl border border-border/40 bg-white/80 p-3.5 shadow-2xs backdrop-blur-xs dark:bg-muted/30">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    {tanda.segmento && <span className={cn("h-2 w-2 shrink-0 rounded-full", SEG_META[tanda.segmento].dot)} />}
                                    <span className="text-sm font-semibold text-foreground">{etiquetaSegmento(tanda.segmento)}</span>
                                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", meta.clase)}>
                                        {meta.label}
                                    </span>
                                    {tanda.origen === 'goteo' && (
                                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">tanda anterior</span>
                                    )}
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                                    {objetivo != null
                                        ? <span><span className="font-medium text-foreground">{tanda.contactados}</span> de {objetivo} contactados</span>
                                        : <span><span className="font-medium text-foreground">{tanda.contactados}</span> contactados</span>}
                                    {tanda.pendientes > 0 && <><span>·</span><span>{tanda.pendientes} en cola</span></>}
                                    {tanda.control > 0 && <><span>·</span><span>{tanda.control} en control</span></>}
                                    {tanda.toqueHasta > 1 && <><span>·</span><span>hasta el {toqueOrdinal(tanda.toqueHasta)} toque</span></>}
                                    {tanda.fallidos > 0 && <><span>·</span><span>{tanda.fallidos} fallidos</span></>}
                                </div>
                                <div className="mt-1 text-[11px] text-muted-foreground/80">
                                    {tanda.pendientes === 0
                                        ? 'No queda nada por salir'
                                        : proximo ? `Próximo despacho: ${proximo}` : 'Próximo despacho: en el próximo ciclo'}
                                    {' · '}programada el {formatDateTime(tanda.programadaAt)}
                                </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-1.5">
                                <Button variant="ghost" size="sm" onClick={onConfig} className="h-7 gap-1.5 px-2 text-xs text-muted-foreground">
                                    <Settings2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Config</span>
                                </Button>
                                {cancelable && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => cancelar(tanda)}
                                        disabled={cancelandoId === tanda.id}
                                        title="Lo que todavía no salió, no sale. Los mensajes ya enviados y el grupo de control se conservan."
                                        className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                                    >
                                        {cancelandoId === tanda.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                                        Cancelar
                                    </Button>
                                )}
                            </div>
                        </div>

                        {avance != null && (
                            <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-muted">
                                <div className="h-full rounded-full bg-foreground/70 transition-all" style={{ width: `${avance * 100}%` }} />
                            </div>
                        )}
                    </div>
                )
            })}

            {!compacto && (
                <Button variant="ghost" size="sm" onClick={onProgramar} className="gap-2 text-xs">
                    <Zap className="h-3.5 w-3.5" /> Programar otro envío
                </Button>
            )}
        </div>
    )
}

// =============================================================================
// SIN TANDAS — la pantalla que reemplaza al "encender el motor"
//
// Antes acá había un botón que encendía un goteo permanente. Ahora el motor no sale a buscar clientes
// solo: esta pantalla muestra el universo disponible y ofrece programar la primera tanda. La
// diferencia es la del pedido — nada sale sin que el dueño lo programe.
// =============================================================================

export function PantallaProgramacion({ plan, config, onCambio, onRecargar }: {
    plan: PlanActivacionRecompra
    config: ConfigMotorRecompra
    onCambio: () => void
    onRecargar: () => void
}) {
    const token = useAuthStore(state => state.token)
    const [dialogoProgramar, setDialogoProgramar] = useState(false)
    const [dialogoConfig, setDialogoConfig] = useState(false)
    const [accionMotor, setAccionMotor] = useState(false)

    const vacio = plan.totalDetectados === 0
    const pausado = config.estado !== 'activa'

    const reanudar = async () => {
        if (!token || accionMotor) return
        setAccionMotor(true)
        try {
            const res = await clientesApi.reanudarRecompra(token) as { success: boolean }
            if (res.success) { toast.success('Motor reanudado'); onCambio() }
        } catch {
            toast.error('No se pudo reanudar el motor')
        } finally {
            setAccionMotor(false)
        }
    }

    return (
        <>
            <div className="space-y-6">
                <div className="rounded-2xl border border-border/40 bg-white/80 p-6 shadow-2xs backdrop-blur-xs dark:bg-muted/30">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                        <Sparkles className="h-3.5 w-3.5" /> Motor de recompra
                    </div>

                    {vacio ? (
                        <>
                            <h2 className="mt-2 text-xl font-bold tracking-tight text-foreground">Tu base está al día</h2>
                            <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                                No hay clientes enfriados para recuperar en este momento. Cuando alguno baje su
                                ritmo habitual va a aparecer acá, listo para programarle un envío.
                            </p>
                        </>
                    ) : (
                        <>
                            <h2 className="mt-2 text-xl font-bold tracking-tight text-foreground">
                                {plan.totalDetectados} cliente{plan.totalDetectados === 1 ? '' : 's'} para recuperar
                            </h2>
                            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
                                {plan.porSegmento.map((s, i) => (
                                    <span key={s.segmento}>
                                        {i > 0 && (i === plan.porSegmento.length - 1 ? ' y ' : ', ')}
                                        <span className="font-medium text-foreground">{s.detectados} {SEG_META[s.segmento].label.toLowerCase()}</span>
                                    </span>
                                ))}
                                {plan.porSegmento.length > 0 && ', '}
                                por <span className="font-medium text-foreground">{formatCurrency(plan.porSegmento.reduce((acc, s) => acc + s.facturacionEnJuego, 0))}</span> de
                                compra histórica.
                            </p>
                            <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-foreground">
                                <Zap className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                <span>
                                    El motor <strong className="font-semibold">no manda nada por su cuenta</strong>.
                                    Programá una tanda —a quiénes, cuántos y hasta qué toque— y recién ahí salen los
                                    mensajes, de a poco y con el cupo de {config.cupoDiario} por día.
                                </span>
                            </p>
                        </>
                    )}

                    <div className="mt-5 flex flex-wrap items-center gap-2">
                        <Button
                            onClick={() => setDialogoProgramar(true)}
                            size="lg"
                            className="h-11 gap-2 rounded-full px-6 text-sm font-medium shadow-2xs"
                        >
                            <Zap className="h-4 w-4" /> Programar envío
                        </Button>
                        <Button variant="ghost" onClick={() => setDialogoConfig(true)} className="h-11 gap-2 rounded-full px-4 text-sm">
                            <SlidersHorizontal className="h-4 w-4" /> Configuración
                        </Button>
                        {pausado && (
                            <Button variant="ghost" onClick={reanudar} disabled={accionMotor} className="h-11 gap-2 rounded-full px-4 text-sm text-orange-600 dark:text-orange-400">
                                {accionMotor ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                                Reanudar motor
                            </Button>
                        )}
                    </div>

                    {/* El estado del motor, para que "pausado" no sea un misterio */}
                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/30 pt-4 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                            {config.estado === 'activa'
                                ? <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Motor activo</>
                                : <><Pause className="h-3.5 w-3.5 text-orange-500" /> Motor pausado</>}
                        </span>
                        <span>Modo {config.modo === 'manual' ? 'Manual (los enviás vos)' : 'Automático'}</span>
                        <span>Cupo {config.cupoDiario}/día</span>
                        <span>Toques cada {config.diasToque2} días</span>
                        {config.modo === 'automatico' && (
                            <span>
                                Saldo:{' '}
                                <button onClick={onRecargar} className={cn("font-medium hover:underline", plan.saldoMarketing <= 0 ? 'text-orange-600' : 'text-foreground')}>
                                    {plan.saldoMarketing} mensajes
                                </button>
                            </span>
                        )}
                    </div>
                </div>

                {plan.enTanda > 0 && (
                    <p className="text-xs text-muted-foreground">
                        {plan.enTanda} cliente{plan.enTanda === 1 ? '' : 's'} ya está{plan.enTanda === 1 ? '' : 'n'} en una tanda
                        y no se puede{plan.enTanda === 1 ? '' : 'n'} programar de nuevo hasta que termine.
                    </p>
                )}
            </div>

            {dialogoProgramar && (
                <DialogoProgramarEnvio
                    config={config}
                    onCerrar={() => setDialogoProgramar(false)}
                    onProgramado={() => { setDialogoProgramar(false); onCambio() }}
                />
            )}
            {dialogoConfig && (
                <DialogoConfigMotor
                    config={config}
                    onCerrar={() => setDialogoConfig(false)}
                    onGuardado={() => { setDialogoConfig(false); onCambio() }}
                />
            )}
        </>
    )
}
