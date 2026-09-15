import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useAuthStore } from '@/store/authStore'
import {
    clientesApi,
    ApiError,
    type ClienteMotorRecompra,
    type ColaRecompraItem,
    type HistorialRecompraItem,
    type PaginadoRecompra,
    type ModoRecompra,
    type MensajeColaData,
} from '@/lib/api'
import { toast } from 'sonner'
import {
    Rocket, AlertTriangle, Moon, UserX, Users, DollarSign, ShieldCheck,
    Loader2, CheckCircle2, Zap, Crown, Gauge, TrendingUp, Wallet,
    Pause, Play, Pencil, Repeat, Send, FlaskConical, ListOrdered, History,
    UserRoundCheck, Clock, CircleOff, RefreshCw, Copy, Check, ExternalLink,
    Bot, MessageSquare, Eye, Sparkles,
} from 'lucide-react'

// =============================================================================
// MOTOR DE RECOMPRA · GOTEO (piloto automático)
//
// El motor NO manda campañas masivas ni pide acciones diarias. Tres piezas:
//   1) DECISIÓN — humana, una vez: el dueño enciende (pantalla de PLAN, no formulario).
//   2) EJECUCIÓN — automática, goteada: el backend drena la cola al ritmo del cupo diario.
//   3) RENDICIÓN — visible siempre: el dueño es espectador de un marcador (consumo + retorno),
//      nunca operador de una tarea diaria.
// =============================================================================

type Segmento = 'primer_pedido' | 'en_riesgo' | 'dormido' | 'perdido'
type EstadoCampana = 'activa' | 'pausada_sin_saldo' | 'pausada_manual' | 'completada'

const SEG_META: Record<Segmento, { label: string; icon: typeof Moon; dot: string; text: string }> = {
    primer_pedido: { label: 'Primer pedido', icon: Sparkles, dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
    en_riesgo: { label: 'En riesgo', icon: AlertTriangle, dot: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400' },
    dormido: { label: 'Dormidos', icon: Moon, dot: 'bg-violet-500', text: 'text-violet-600 dark:text-violet-400' },
    perdido: { label: 'Perdidos', icon: UserX, dot: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' },
}

interface PlanSegmento { segmento: Segmento; detectados: number; facturacionEnJuego: number }

interface Plan {
    totalDetectados: number
    totalContactar: number
    totalControl: number
    porSegmento: PlanSegmento[]
    primerSegmento: Segmento | null
    cupoSugerido: number
    saldoMarketing: number
    diasCubiertos: number
}

interface Dashboard {
    estado: EstadoCampana
    modo: ModoRecompra
    cupoDiario: number
    enviadosHoy: number
    totalEnviados: number
    enCola: number
    contactados: number
    volvieron: number
    plataRecuperada: number
    control: number
    controlVolvieron: number
    tasaContactados: number
    tasaControl: number
    saldoMarketing: number
    activadaAt: string | null
    pausadaAt: string | null
}

interface EstadoMotor {
    activa: boolean
    campana: Dashboard | null
    plan: Plan | null
    saldoMarketing: number
}

const CUPO_MIN = 5
const CUPO_MAX = 60

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value)

const pct = (v: number) => `${Math.round(v * 100)}%`

const formatDateTime = (value: string | null) => value
    ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(value))
    : '—'

const formatDay = (value: string | null) => value
    ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(`${value}T12:00:00-03:00`))
    : '—'

export default function MotorRecompra() {
    const token = useAuthStore(state => state.token)
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [estado, setEstado] = useState<EstadoMotor | null>(null)
    const [bloqueadoPlan, setBloqueadoPlan] = useState(false)

    const cargar = useCallback(async () => {
        if (!token) return
        setLoading(true)
        setBloqueadoPlan(false)
        try {
            const res = await clientesApi.recompraEstado(token) as { success: boolean; data: EstadoMotor }
            if (res.success) setEstado(res.data)
        } catch (err) {
            if (err instanceof ApiError && err.status === 403 && err.response?.upgradeRequired) {
                setBloqueadoPlan(true)
            } else {
                toast.error('No se pudo cargar el motor de recompra')
            }
        } finally {
            setLoading(false)
        }
    }, [token])

    useEffect(() => { cargar() }, [cargar])

    return (
        <div className="flex-1 min-h-0 overflow-hidden bg-[#FFFBF0] dark:bg-background">
            <ScrollArea className="h-full">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
                    {loading ? (
                        <Cargando />
                    ) : bloqueadoPlan ? (
                        <PlanBloqueado />
                    ) : estado?.activa && estado.campana ? (
                        <PantallaEncendido
                            campana={estado.campana}
                            onCambio={cargar}
                            onRecargar={() => navigate('/dashboard/mensajes')}
                        />
                    ) : estado?.plan ? (
                        <PantallaApagado plan={estado.plan} onActivado={cargar} />
                    ) : null}
                </div>
            </ScrollArea>
        </div>
    )
}

function Cargando() {
    return (
        <div className="space-y-4">


            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-5 w-full max-w-lg" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
        </div>
    )
}

// =============================================================================
// APAGADO — el PLAN (la decisión humana, una vez). No un formulario: una propuesta.
// =============================================================================
function PantallaApagado({ plan, onActivado }: { plan: Plan; onActivado: () => void }) {
    const token = useAuthStore(state => state.token)
    const [cupo, setCupo] = useState(plan.cupoSugerido)
    const [modo, setModo] = useState<ModoRecompra>('automatico')
    const [editandoCupo, setEditandoCupo] = useState(false)
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [activando, setActivando] = useState(false)

    const vacio = plan.totalDetectados === 0
    const primer = plan.primerSegmento ? SEG_META[plan.primerSegmento] : null
    const primerCount = plan.primerSegmento
        ? plan.porSegmento.find(s => s.segmento === plan.primerSegmento)?.detectados ?? 0
        : 0

    const activar = async () => {
        if (!token) return
        setActivando(true)
        try {
            const res = await clientesApi.activarRecompra(token, { cupoDiario: cupo, modo }) as { success: boolean; data?: { vacio?: boolean } }
            if (res.success) {
                setConfirmOpen(false)
                if (res.data?.vacio) toast.info('No hay clientes para recuperar ahora mismo')
                else toast.success(modo === 'automatico' ? 'Motor de recompra encendido. Empezó a gotear con tu marca.' : 'Motor de recompra encendido en modo manual.')
                onActivado()
            }
        } catch (err) {
            if (err instanceof ApiError && err.status === 403 && err.response?.upgradeRequired) {
                toast.error('Activá el módulo Motor de Recompra para usarlo')
            } else {
                toast.error('No se pudo encender el motor')
            }
            setConfirmOpen(false)
        } finally {
            setActivando(false)
        }
    }

    if (vacio) {
        return (
            <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h1 className="text-xl font-semibold text-foreground">Tu base está al día</h1>
                <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                    No hay clientes enfriados para recuperar en este momento. Cuando alguno se pase de su ritmo,
                    el motor lo va a detectar solo. Volvé más adelante.
                </p>
            </div>
        )
    }

    return (
        <div>
            {/* Hero */}
            <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-muted flex items-center justify-center text-foreground shrink-0">
                    <Rocket className="w-6 h-6" />
                </div>
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">Motor de Recompra</h1>
                    <p className="text-[13px] text-muted-foreground">Encendelo una vez. El resto es automático o manual con un clic.</p>
                </div>
            </div>

            {/* El PLAN en prosa (no un formulario) */}
            <div className="rounded-2xl border border-border/60 bg-white dark:bg-muted/30 p-5 sm:p-6">
                <p className="text-[15px] leading-relaxed text-foreground">
                    Encontré <span className="font-semibold">{plan.totalDetectados} clientes</span> que se enfriaron
                    {plan.porSegmento.length > 0 && (
                        <>: {plan.porSegmento.map((s, i) => (
                            <span key={s.segmento}>
                                {i > 0 && (i === plan.porSegmento.length - 1 ? ' y ' : ', ')}
                                <span className="font-medium">{s.detectados} {SEG_META[s.segmento].label.toLowerCase()}</span>
                            </span>
                        ))}</>
                    )}.
                    {primer && (
                        <> Propongo <span className="font-semibold">arrancar por los {primerCount} {primer.label.toLowerCase()}</span> —
                        los más fáciles de recuperar — a un ritmo de <span className="font-semibold">hasta {cupo} por día</span>,
                        priorizando los de mayor ticket.</>
                    )}
                    {plan.diasCubiertos > 0 ? (
                        <> Con tus <span className="font-semibold">{plan.saldoMarketing} mensajes</span> cubrimos
                        los primeros <span className="font-semibold">{plan.diasCubiertos} {plan.diasCubiertos === 1 ? 'día' : 'días'}</span> en modo automático.</>
                    ) : (
                        <> <span className="font-medium text-orange-600 dark:text-orange-400">No te quedan mensajes de campaña</span>: podés usar el <span className="font-medium">Modo Manual</span> gratis o recargar para el automático.</>
                    )}
                </p>

                {/* Config en modo lectura (una oración + Cambiar), no un panel de ajustes */}
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Gauge className="w-4 h-4 shrink-0" />
                    {editandoCupo ? (
                        <div className="flex items-center gap-2">
                            <span>Enviando hasta</span>
                            <StepperCupo value={cupo} onChange={setCupo} />
                            <span>por día</span>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditandoCupo(false)}>Listo</Button>
                        </div>
                    ) : (
                        <span>
                            Enviando hasta <span className="font-medium text-foreground">{cupo}/día</span>, primero {primer?.label.toLowerCase() ?? 'los más fáciles'}
                            {' · '}
                            <button onClick={() => setEditandoCupo(true)} className="text-foreground hover:underline font-medium">Cambiar</button>
                        </span>
                    )}
                </div>

                {/* Selector de Modo */}
                <div className="mt-5 pt-4 border-t border-border/50">
                    <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Elegí cómo querés enviar</p>
                    <div className="grid sm:grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => setModo('automatico')}
                            className={`text-left p-3.5 rounded-xl border transition-all ${modo === 'automatico' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-muted/20 hover:border-border/80'}`}
                        >
                            <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
                                <Bot className="w-4 h-4 text-primary" />
                                Modo Automático
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                El motor envía solo vía WhatsApp oficial según el cupo diario. Consume créditos de marketing.
                            </p>
                        </button>
                        <button
                            type="button"
                            onClick={() => setModo('manual')}
                            className={`text-left p-3.5 rounded-xl border transition-all ${modo === 'manual' ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 ring-1 ring-emerald-600' : 'border-border bg-muted/20 hover:border-border/80'}`}
                        >
                            <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
                                <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                Modo Manual
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                El motor prepara los textos y cupones. Vos los copiás y enviás desde tu propio WhatsApp. <strong className="text-emerald-700 dark:text-emerald-400">Sin costo de créditos</strong>.
                            </p>
                        </button>
                    </div>
                </div>

                <Button
                    onClick={() => setConfirmOpen(true)}
                    size="lg"
                    className="mt-5 h-12 px-8 gap-2 text-base w-full sm:w-auto"
                >
                    <Zap className="w-5 h-5" /> Activar motor {modo === 'manual' ? '(Modo Manual)' : '(Modo Automático)'}
                </Button>
            </div>

            {/* Por qué gotea (feature, no restricción) + grupo de control */}
            <div className="grid sm:grid-cols-2 gap-3 mt-4">
                <ExplainCard icon={Gauge} title="Gotea, no satura"
                    text={`Manda de a poco (hasta ${cupo}/día) para cuidar tu número y no llenarte la cocina de golpe. Cada día prioriza a quien más conviene.`} />
                <ExplainCard icon={FlaskConical} title="Mide de verdad"
                    text={`Aparta ${plan.totalControl} clientes sin contactar (grupo de control). Comparando cuántos vuelven con y sin mensaje, vas a ver la plata real que generó — no un número inflado.`} />
            </div>

            {/* Confirmación */}
            <Dialog open={confirmOpen} onOpenChange={(o) => !activando && setConfirmOpen(o)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-muted-foreground" /> Encender el motor ({modo === 'automatico' ? 'Automático' : 'Manual'})
                        </DialogTitle>
                        <DialogDescription>
                            {modo === 'automatico' ? (
                                <>
                                    A partir de ahora el motor va a ir contactando solo a los {plan.totalContactar} clientes,
                                    hasta {cupo} por día, empezando por los de mejor retorno. Apartamos {plan.totalControl} como
                                    grupo de control. No tenés que hacer nada más: podés pausarlo cuando quieras.
                                </>
                            ) : (
                                <>
                                    El motor va a organizar y priorizar tu cola diaria de hasta {cupo} clientes.
                                    Podrás ver los mensajes armados con cupón y carrito listo, copiarlos o abrirlos directamente en WhatsApp
                                    y marcarlos como enviados para medir el retorno generado.
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    {modo === 'automatico' ? (
                        <div className="rounded-lg border bg-white dark:bg-muted/40 p-3">
                            <p className="text-[11px] text-muted-foreground">
                                Cada mensaje consume 1 crédito de <span className="font-medium">campaña (marketing)</span>. Si se agotan,
                                el motor se <span className="font-medium">pausa solo</span> (nunca genera deuda) y te avisa una vez con el resultado.
                            </p>
                        </div>
                    ) : (
                        <div className="rounded-lg border bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 p-3">
                            <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                                <span className="font-semibold">Sin costo de créditos:</span> en modo manual vos enviás desde tu WhatsApp y no se descuentan créditos de tu saldo de marketing.
                            </p>
                        </div>
                    )}
                    <DialogFooter className="gap-2 sm:gap-2">
                        <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={activando}>Cancelar</Button>
                        <Button onClick={activar} disabled={activando} className="gap-2">
                            {activando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                            {activando ? 'Encendiendo…' : 'Activar motor'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

// =============================================================================
// ENCENDIDO — el DASHBOARD (marcador diario). El dueño mira, no opera.
// =============================================================================
function PantallaEncendido({ campana, onCambio, onRecargar }: {
    campana: Dashboard
    onCambio: () => void
    onRecargar: () => void
}) {
    const token = useAuthStore(state => state.token)
    const [accion, setAccion] = useState(false)
    const [cambiandoModo, setCambiandoModo] = useState(false)
    const [editandoCupo, setEditandoCupo] = useState(false)
    const [cupo, setCupo] = useState(campana.cupoDiario)

    const sinSaldo = campana.estado === 'pausada_sin_saldo'
    const pausadaManual = campana.estado === 'pausada_manual'
    const activa = campana.estado === 'activa' || campana.estado === 'completada'
    const diasCubiertos = campana.cupoDiario > 0 ? Math.floor(campana.saldoMarketing / campana.cupoDiario) : 0

    const doAccion = async (fn: () => Promise<unknown>, okMsg: string) => {
        if (!token) return
        setAccion(true)
        try {
            const res = await fn() as { success: boolean }
            if (res.success) { toast.success(okMsg); onCambio() }
        } catch {
            toast.error('No se pudo completar la acción')
        } finally {
            setAccion(false)
        }
    }

    const alternarModo = async (nuevoModo: ModoRecompra) => {
        if (!token || cambiandoModo) return
        setCambiandoModo(true)
        try {
            const res = await clientesApi.modoRecompra(token, nuevoModo) as { success: boolean }
            if (res.success) {
                toast.success(`Cambiado a Modo ${nuevoModo === 'automatico' ? 'Automático' : 'Manual'}`)
                onCambio()
            }
        } catch {
            toast.error('No se pudo cambiar el modo del motor')
        } finally {
            setCambiandoModo(false)
        }
    }

    const guardarCupo = async () => {
        if (!token) return
        setAccion(true)
        try {
            const res = await clientesApi.configRecompra(token, cupo) as { success: boolean; data?: { cupoDiario: number } }
            if (res.success) { toast.success('Cupo actualizado'); setEditandoCupo(false); onCambio() }
        } catch {
            toast.error('No se pudo actualizar el cupo')
        } finally {
            setAccion(false)
        }
    }

    const uplift = campana.tasaContactados - campana.tasaControl

    return (
        <div>
            {/* Encabezado con estado + modo + pausa/reanudación */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2.5 flex-wrap">
                    <EstadoBadge estado={campana.estado} />
                    <div className="inline-flex items-center rounded-lg border border-border/80 bg-white dark:bg-muted/40 p-0.5 text-xs shadow-sm">
                        <button
                            type="button"
                            disabled={cambiandoModo || accion}
                            onClick={() => campana.modo !== 'automatico' && alternarModo('automatico')}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all ${campana.modo === 'automatico' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <Bot className="w-3.5 h-3.5" /> Automático
                        </button>
                        <button
                            type="button"
                            disabled={cambiandoModo || accion}
                            onClick={() => campana.modo !== 'manual' && alternarModo('manual')}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all ${campana.modo === 'manual' ? 'bg-emerald-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <MessageSquare className="w-3.5 h-3.5" /> Manual
                        </button>
                    </div>
                    <h1 className="text-xl font-semibold tracking-tight text-foreground">Motor de Recompra</h1>
                </div>
                <div className="flex items-center gap-2">
                    {activa && (
                        <Button variant="outline" size="sm" disabled={accion || cambiandoModo}
                            onClick={() => doAccion(() => clientesApi.pausarRecompra(token!), 'Motor pausado')}
                            className="h-8 gap-1.5 text-xs">
                            <Pause className="w-3.5 h-3.5" /> Pausar
                        </Button>
                    )}
                    {pausadaManual && (
                        <Button size="sm" disabled={accion || cambiandoModo}
                            onClick={() => doAccion(() => clientesApi.reanudarRecompra(token!), 'Motor reanudado')}
                            className="h-8 gap-1.5 text-xs">
                            <Play className="w-3.5 h-3.5" /> Reanudar
                        </Button>
                    )}
                </div>
            </div>
            <p className="text-[13px] text-muted-foreground mb-5">
                {campana.contactados} contactados · <span className="text-foreground font-medium">{campana.volvieron} volvieron a pedir</span> · {formatCurrency(campana.plataRecuperada)} recuperados
            </p>

            {/* Banner de Modo Manual */}
            {campana.modo === 'manual' && (
                <div className="mb-5 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/80 dark:bg-emerald-950/30 p-4">
                    <div className="flex items-start gap-3">
                        <MessageSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">Modo Manual activo: vos enviás con un clic</p>
                            <p className="text-xs text-emerald-800/90 dark:text-emerald-300/90 mt-0.5 leading-relaxed">
                                El motor arma y prioriza la cola de clientes a recuperar pero <span className="font-semibold">no envía mensajes automáticamente ni consume créditos de marketing</span>.
                                En la pestaña <span className="font-semibold">Próximos</span> podés copiar el mensaje prearmado con cupón y carrito listo, abrirlo en WhatsApp y marcarlo como enviado.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Aviso de saldo agotado (solo relevante en modo automático) */}
            {sinSaldo && campana.modo === 'automatico' && (
                <div className="mb-5 rounded-xl border border-orange-200 dark:border-orange-900 bg-orange-50/70 dark:bg-orange-950/30 p-4">
                    <div className="flex items-start gap-3">
                        <Wallet className="w-5 h-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-orange-900 dark:text-orange-200">Pausado: se terminaron tus mensajes de campaña</p>
                            <p className="text-xs text-orange-800/80 dark:text-orange-300/80 mt-0.5 leading-relaxed">
                                Los que enviaste generaron <span className="font-semibold">{campana.volvieron} {campana.volvieron === 1 ? 'pedido' : 'pedidos'} por {formatCurrency(campana.plataRecuperada)}</span>.
                                {campana.enCola > 0 && <> Quedan <span className="font-semibold">{campana.enCola} clientes en cola</span>.</>} Recargá mensajes o cambiá a <span className="font-semibold">Modo Manual</span> para continuar enviando por tu cuenta sin costo.
                            </p>
                            <div className="flex items-center gap-2 mt-3">
                                <Button size="sm" onClick={onRecargar} className="h-8 gap-1.5 text-xs bg-orange-600 hover:bg-orange-700 text-white">
                                    <Wallet className="w-3.5 h-3.5" /> Recargar mensajes
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => alternarModo('manual')} className="h-8 gap-1.5 text-xs">
                                    <MessageSquare className="w-3.5 h-3.5" /> Cambiar a Modo Manual
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {pausadaManual && (
                <div className="mb-5 rounded-xl border border-border bg-white dark:bg-muted/40 p-4 flex items-start gap-3">
                    <Pause className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        El motor está pausado. No se pierde nada: los {campana.enCola} clientes en cola te esperan.
                        Cuando reanudes, sigue goteando desde donde quedó.
                    </p>
                </div>
            )}

            {/* Marcador: consumo SIEMPRE junto a retorno */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label="Contactados" value={campana.contactados.toString()}
                    hint={campana.modo === 'manual' ? 'enviados manualmente' : `${campana.totalEnviados} mensajes usados`} icon={<Send className="w-4 h-4" />} />
                <StatCard label="Volvieron a pedir" value={campana.volvieron.toString()}
                    hint={campana.contactados > 0 ? `${pct(campana.tasaContactados)} de los contactados` : 'todavía sin datos'}
                    icon={<Repeat className="w-4 h-4" />} />
                <StatCard label="Recuperado" value={formatCurrency(campana.plataRecuperada)}
                    hint="facturación de los que volvieron" icon={<DollarSign className="w-4 h-4" />} />
                <StatCard label="En cola" value={campana.enCola.toString()}
                    hint={activa ? `hasta ${campana.cupoDiario} por día` : 'en espera'} icon={<Users className="w-4 h-4" />} />
            </div>

            {/* Atribución honesta: contactados vs control */}
            {campana.control > 0 && (
                <div className="mt-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/30 p-4">
                    <div className="flex items-start gap-3">
                        <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">Atribución honesta</p>
                            <p className="text-xs text-blue-800/80 dark:text-blue-300/80 mt-0.5 leading-relaxed">
                                Los contactados vuelven al <span className="font-semibold">{pct(campana.tasaContactados)}</span>;
                                el grupo de control ({campana.control} sin contactar), al <span className="font-semibold">{pct(campana.tasaControl)}</span>.
                                {uplift > 0
                                    ? <> El motor sumó <span className="font-semibold">+{pct(uplift)}</span> de recompra por encima de lo que pasaba solo.</>
                                    : <> Todavía es pronto para leer el impacto: la recompra se mide en semanas.</>}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Config en modo lectura: "Enviando hasta N/día · Cambiar" */}
            <div className="mt-5 rounded-xl border border-border/60 bg-[#FFFBF0] dark:bg-background p-4">
                <div className="flex items-center gap-2 text-sm">
                    <Gauge className="w-4 h-4 text-muted-foreground shrink-0" />
                    {editandoCupo ? (
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-muted-foreground">Procesando hasta</span>
                            <StepperCupo value={cupo} onChange={setCupo} />
                            <span className="text-muted-foreground">por día</span>
                            <Button size="sm" disabled={accion} onClick={guardarCupo} className="h-7 px-3 text-xs">
                                {accion ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Guardar'}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setEditandoCupo(false); setCupo(campana.cupoDiario) }}>Cancelar</Button>
                        </div>
                    ) : (
                        <span className="text-muted-foreground">
                            {campana.modo === 'automatico' ? 'Enviando' : 'Procesando'} hasta <span className="font-medium text-foreground">{campana.cupoDiario}/día</span> (máx. {CUPO_MAX} por seguridad)
                            {' · '}
                            <button onClick={() => setEditandoCupo(true)} className="text-foreground hover:underline font-medium inline-flex items-center gap-1">
                                <Pencil className="w-3 h-3" /> Cambiar
                            </button>
                        </span>
                    )}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    <Wallet className="w-3.5 h-3.5 shrink-0" />
                    {campana.modo === 'automatico' ? (
                        <>
                            Saldo de campaña: <span className={`font-medium ${campana.saldoMarketing <= 0 ? 'text-orange-600 dark:text-orange-400' : 'text-foreground'}`}>{campana.saldoMarketing} mensajes</span>
                            <span>· {diasCubiertos} {diasCubiertos === 1 ? 'día cubierto' : 'días cubiertos'} al ritmo actual</span>
                            {campana.saldoMarketing <= 0 && (
                                <button onClick={onRecargar} className="text-foreground hover:underline font-medium">· Recargar</button>
                            )}
                        </>
                    ) : (
                        <span className="text-emerald-700 dark:text-emerald-400 font-medium">Modo Manual: sin costo ni consumo de créditos</span>
                    )}
                </div>
            </div>

            {campana.estado === 'completada' && (
                <p className="mt-4 text-xs text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    Ya recuperaste todo el backlog. El motor sigue encendido: cada vez que un cliente se pase de su ritmo, entra a la cola {campana.modo === 'automatico' ? 'para enviarse solo' : 'para que lo envíes con un clic'}.
                </p>
            )}

            <ObservabilidadMotor modo={campana.modo} onCambio={onCambio} />
        </div>
    )
}

type ObservabilidadTab = 'cola' | 'historial' | 'clientes'

function ObservabilidadMotor({ modo, onCambio }: { modo: ModoRecompra; onCambio: () => void }) {
    const token = useAuthStore(state => state.token)
    const [tab, setTab] = useState<ObservabilidadTab>('cola')
    const [pagina, setPagina] = useState(1)
    const [segmento, setSegmento] = useState('')
    const [poblacion, setPoblacion] = useState('')
    const [estadoCliente, setEstadoCliente] = useState('')
    const [loading, setLoading] = useState(true)
    const [errorCarga, setErrorCarga] = useState<string | null>(null)
    const [cola, setCola] = useState<PaginadoRecompra<ColaRecompraItem> | null>(null)
    const [historial, setHistorial] = useState<PaginadoRecompra<HistorialRecompraItem> | null>(null)
    const [clientes, setClientes] = useState<PaginadoRecompra<ClienteMotorRecompra> | null>(null)

    const cargar = useCallback(async (silencioso = false) => {
        if (!token) return
        if (!silencioso) setLoading(true)
        try {
            if (tab === 'cola') {
                const res = await clientesApi.recompraCola(token, { pagina, limite: 25, segmento, poblacion })
                setCola(res.data)
            } else if (tab === 'historial') {
                const res = await clientesApi.recompraHistorial(token, { pagina, limite: 25, segmento })
                setHistorial(res.data)
            } else {
                const res = await clientesApi.recompraClientes(token, { pagina, limite: 25, segmento, poblacion, estado: estadoCliente })
                setClientes(res.data)
            }
            setErrorCarga(null)
        } catch (error) {
            const mensaje = error instanceof ApiError && typeof error.response?.message === 'string'
                ? error.response.message
                : 'No se pudo actualizar la observabilidad del motor'
            setErrorCarga(mensaje)
            if (!silencioso) toast.error(mensaje)
        } finally {
            if (!silencioso) setLoading(false)
        }
    }, [token, tab, pagina, segmento, poblacion, estadoCliente])

    useEffect(() => {
        void cargar()
        const interval = window.setInterval(() => void cargar(true), 30_000)
        return () => window.clearInterval(interval)
    }, [cargar])

    const cambiarTab = (siguiente: ObservabilidadTab) => { setTab(siguiente); setPagina(1) }
    const data = tab === 'cola' ? cola : tab === 'historial' ? historial : clientes

    return (
        <section className="mt-8 border-t border-border/70 pt-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">Control y observabilidad</h2>
                    <p className="mt-1 text-xs text-muted-foreground">Auditoría del goteo, próximos despachos y estado individual. Se actualiza cada 30 segundos.</p>
                </div>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 self-start text-xs" onClick={() => void cargar()} disabled={loading}>
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualizar
                </Button>
            </div>

            <div className="mt-4 flex gap-1 overflow-x-auto rounded-xl border bg-white p-1 dark:bg-muted/20">
                <ObservabilidadTabButton active={tab === 'cola'} onClick={() => cambiarTab('cola')} icon={<ListOrdered className="h-4 w-4" />}>Próximos</ObservabilidadTabButton>
                <ObservabilidadTabButton active={tab === 'historial'} onClick={() => cambiarTab('historial')} icon={<History className="h-4 w-4" />}>Historial</ObservabilidadTabButton>
                <ObservabilidadTabButton active={tab === 'clientes'} onClick={() => cambiarTab('clientes')} icon={<UserRoundCheck className="h-4 w-4" />}>Clientes del motor</ObservabilidadTabButton>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
                <FiltroSelect value={segmento} onChange={(value) => { setSegmento(value); setPagina(1) }} label="Todos los segmentos" options={[
                    ['primer_pedido', 'Primer pedido'], ['en_riesgo', 'En riesgo'], ['dormido', 'Dormidos'], ['perdido', 'Perdidos'],
                ]} />
                {tab !== 'historial' && <FiltroSelect value={poblacion} onChange={(value) => { setPoblacion(value); setPagina(1) }} label="Flujo y stock" options={[
                    ['flujo', 'Flujo'], ['stock', 'Stock'],
                ]} />}
                {tab === 'clientes' && <FiltroSelect value={estadoCliente} onChange={(value) => { setEstadoCliente(value); setPagina(1) }} label="Todos los estados" options={[
                    ['pendiente', 'Pendiente'], ['enviado', 'Enviado'], ['control', 'Control'], ['salido_por_pedido', 'Salió por pedido'], ['fallido', 'Fallido'],
                ]} />}
            </div>

            {tab === 'cola' && (
                <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-xs leading-relaxed text-blue-900 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-200">
                    <strong>Prioridad transparente:</strong> Flujo siempre sale primero. Después se drena Stock por <code>peso de segmento × 10.000.000 + ticket histórico</code>: primer pedido (4), en riesgo (3), dormido (2), perdido (1). Cada envío respeta el día y horario habitual del comensal (y días valle para clientes perdidos).
                    {modo === 'manual' && (
                        <span className="block mt-1 font-semibold text-emerald-800 dark:text-emerald-300">
                            Modo manual activo: podés copiar el mensaje de cada cliente, abrir WhatsApp y marcarlo como enviado para registrar la métrica.
                        </span>
                    )}
                </div>
            )}
            {tab === 'clientes' && (
                <div className="mt-3 rounded-xl border bg-white p-3 text-xs leading-relaxed text-muted-foreground dark:bg-muted/20">
                    <strong className="text-foreground">Protecciones activas:</strong> silencio de 22:00 a 09:00 ART, cooldown de 48 horas, máximo 4 toques cada 30 días, opt-out y salida inmediata cuando entra un pedido nuevo. El grupo de control nunca es contactable.
                </div>
            )}

            <div className="mt-3 overflow-hidden rounded-xl border bg-white dark:bg-muted/20">
                {errorCarga && !data ? <div className="flex flex-col items-center gap-3 p-8 text-center"><AlertTriangle className="h-6 w-6 text-orange-500" /><div><p className="text-sm font-medium text-foreground">No pudimos cargar estos datos</p><p className="mt-1 text-xs text-muted-foreground">{errorCarga}</p></div><Button variant="outline" size="sm" onClick={() => void cargar()}>Reintentar</Button></div>
                    : loading && !data ? <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                    : tab === 'cola' ? <TablaCola items={cola?.items ?? []} modo={modo} onActualizar={() => { void cargar(true); onCambio(); }} />
                        : tab === 'historial' ? <TablaHistorial items={historial?.items ?? []} />
                            : <TablaClientesMotor items={clientes?.items ?? []} />}
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{data?.total ?? 0} registros · página {data?.pagina ?? pagina} de {Math.max(1, data?.paginas ?? 1)}</span>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="h-8 text-xs" disabled={pagina <= 1 || loading} onClick={() => setPagina((actual) => actual - 1)}>Anterior</Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs" disabled={pagina >= (data?.paginas ?? 1) || loading} onClick={() => setPagina((actual) => actual + 1)}>Siguiente</Button>
                </div>
            </div>
        </section>
    )
}

function ObservabilidadTabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
    return <button type="button" onClick={onClick} className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition-colors ${active ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>{icon}{children}</button>
}

function FiltroSelect({ value, onChange, label, options }: { value: string; onChange: (value: string) => void; label: string; options: Array<[string, string]> }) {
    return <select value={value} onChange={(event) => onChange(event.target.value)} className="h-8 rounded-full border border-border bg-background px-3 text-xs text-foreground"><option value="">{label}</option>{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select>
}

function SegmentoTexto({ segmento }: { segmento: string }) {
    const meta = SEG_META[segmento as Segmento]
    return <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><span className={`h-1.5 w-1.5 rounded-full ${meta?.dot ?? 'bg-muted-foreground'}`} />{meta?.label ?? segmento}</span>
}

function TablaCola({
    items,
    modo,
    onActualizar,
}: {
    items: ColaRecompraItem[]
    modo: ModoRecompra
    onActualizar: () => void
}) {
    const token = useAuthStore(state => state.token)
    const [modalInfo, setModalInfo] = useState<{ filaId: number; data: MensajeColaData } | null>(null)
    const [cargandoId, setCargandoId] = useState<number | null>(null)
    const [marcandoId, setMarcandoId] = useState<number | null>(null)
    const [copiadoId, setCopiadoId] = useState<number | null>(null)

    if (items.length === 0) return <EstadoTablaVacia texto="No hay mensajes pendientes con estos filtros." />

    const abrirMensaje = async (filaId: number) => {
        if (!token) return
        setCargandoId(filaId)
        try {
            const res = await clientesApi.mensajeColaRecompra(token, filaId) as { success: boolean; data: MensajeColaData }
            if (res.success && res.data) {
                setModalInfo({ filaId, data: res.data })
            }
        } catch {
            toast.error('No se pudo cargar el mensaje del cliente')
        } finally {
            setCargandoId(null)
        }
    }

    const copiarTexto = async (texto: string, filaId?: number) => {
        try {
            await navigator.clipboard.writeText(texto)
            if (filaId) {
                setCopiadoId(filaId)
                setTimeout(() => setCopiadoId(null), 2000)
            }
            toast.success('Mensaje copiado al portapapeles')
        } catch {
            toast.error('No se pudo copiar al portapapeles')
        }
    }

    const copiarDirecto = async (filaId: number) => {
        if (!token) return
        setCargandoId(filaId)
        try {
            const res = await clientesApi.mensajeColaRecompra(token, filaId) as { success: boolean; data: MensajeColaData }
            if (res.success && res.data?.texto) {
                await copiarTexto(res.data.texto, filaId)
            }
        } catch {
            toast.error('No se pudo obtener el mensaje')
        } finally {
            setCargandoId(null)
        }
    }

    const marcarEnviado = async (filaId: number) => {
        if (!token || marcandoId) return
        setMarcandoId(filaId)
        try {
            const res = await clientesApi.marcarEnviadoColaRecompra(token, filaId) as { success: boolean }
            if (res.success) {
                toast.success('Marcado como enviado exitosamente')
                if (modalInfo?.filaId === filaId) setModalInfo(null)
                onActualizar()
            }
        } catch {
            toast.error('No se pudo marcar como enviado')
        } finally {
            setMarcandoId(null)
        }
    }

    return (
        <>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-xs">
                    <thead className="border-b bg-muted/40 text-muted-foreground">
                        <tr>
                            <th className="px-3 py-2.5">Prioridad</th>
                            <th className="px-3 py-2.5">Cliente</th>
                            <th className="px-3 py-2.5">Segmento</th>
                            <th className="px-3 py-2.5">Población</th>
                            <th className="px-3 py-2.5">Programado</th>
                            <th className="px-3 py-2.5 text-right">Score</th>
                            <th className="px-3 py-2.5 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item) => (
                            <tr key={item.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                                <td className="px-3 py-3 font-semibold tabular-nums">#{item.posicionPrioridad}</td>
                                <td className="px-3 py-3">
                                    <p className="font-medium text-foreground">{item.clienteNombre}</p>
                                    <p className="text-[11px] text-muted-foreground">{item.telefono ?? 'Sin teléfono'}</p>
                                </td>
                                <td className="px-3 py-3"><SegmentoTexto segmento={item.segmento} /></td>
                                <td className="px-3 py-3">
                                    <span className={`rounded-full px-2 py-1 font-semibold ${item.poblacion === 'flujo' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : 'bg-muted text-muted-foreground'}`}>
                                        {item.poblacion === 'flujo' ? 'Flujo' : 'Stock'}
                                    </span>
                                </td>
                                <td className="px-3 py-3">
                                    <p className="font-medium text-foreground">{item.horarioSugerido ?? formatDay(item.fechaProyectada)}</p>
                                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                        <Clock className="w-3 h-3 inline" />
                                        <span>{formatDay(item.fechaProyectada)}</span>
                                    </p>
                                </td>
                                <td className="px-3 py-3 text-right font-mono">{item.prioridad.toLocaleString('es-AR')}</td>
                                <td className="px-3 py-3 text-right">
                                    <div className="inline-flex items-center justify-end gap-1">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7 px-2 text-xs gap-1"
                                            disabled={cargandoId === item.id || marcandoId === item.id}
                                            onClick={() => abrirMensaje(item.id)}
                                            title="Ver mensaje completo y opciones"
                                        >
                                            {cargandoId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
                                            <span className="hidden sm:inline">Ver</span>
                                        </Button>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7 px-2 text-xs gap-1"
                                            disabled={cargandoId === item.id || marcandoId === item.id}
                                            onClick={() => copiarDirecto(item.id)}
                                            title="Copiar mensaje al portapapeles"
                                        >
                                            {copiadoId === item.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                            <span className="hidden sm:inline">{copiadoId === item.id ? 'Copiado' : 'Copiar'}</span>
                                        </Button>

                                        <Button
                                            size="sm"
                                            variant={modo === 'manual' ? 'default' : 'secondary'}
                                            className="h-7 px-2 text-xs gap-1"
                                            disabled={marcandoId === item.id}
                                            onClick={() => marcarEnviado(item.id)}
                                            title="Marcar como enviado manualmente"
                                        >
                                            {marcandoId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                            <span className="hidden md:inline">Enviado</span>
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal para ver, copiar, abrir en WhatsApp y marcar enviado */}
            <Dialog open={!!modalInfo} onOpenChange={(open) => !open && setModalInfo(null)}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-primary" /> Mensaje para {modalInfo?.data.clienteNombre}
                        </DialogTitle>
                        <DialogDescription>
                            {modalInfo?.data.telefono ? `WhatsApp: ${modalInfo.data.telefono}` : 'Sin teléfono cargado'} · {modalInfo?.data.incentivo}
                        </DialogDescription>
                    </DialogHeader>

                    {modalInfo && (
                        <div className="space-y-3 py-2">
                            {modalInfo.data.horarioSugerido && (
                                <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/60 dark:border-blue-900/50 dark:bg-blue-950/30 px-3 py-2 text-xs text-blue-950 dark:text-blue-200">
                                    <Clock className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
                                    <div>
                                        <span className="font-semibold">Momento recomendado: </span>
                                        <span>{modalInfo.data.horarioSugerido}</span>
                                    </div>
                                </div>
                            )}

                            {modalInfo.data.codigoDescuento && (
                                <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-xs">
                                    <div>
                                        <span className="text-muted-foreground">Cupón generado: </span>
                                        <span className="font-mono font-semibold text-foreground">{modalInfo.data.codigoDescuento}</span>
                                        <span className="text-muted-foreground"> ({modalInfo.data.descuento}% OFF)</span>
                                    </div>
                                    <span className="text-[11px] text-muted-foreground">Vence en 48hs</span>
                                </div>
                            )}

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-semibold text-foreground">Texto del mensaje a enviar:</label>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-xs gap-1"
                                        onClick={() => copiarTexto(modalInfo.data.texto)}
                                    >
                                        <Copy className="w-3 h-3" /> Copiar texto
                                    </Button>
                                </div>
                                <div className="rounded-lg border bg-muted/20 p-3 text-xs whitespace-pre-wrap font-sans text-foreground leading-relaxed max-h-48 overflow-y-auto select-all">
                                    {modalInfo.data.texto}
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        {modalInfo?.data.waMeUrl && (
                            <Button
                                type="button"
                                variant="outline"
                                className="gap-1.5 text-xs sm:mr-auto"
                                onClick={() => window.open(modalInfo.data.waMeUrl!, '_blank')}
                            >
                                <ExternalLink className="w-3.5 h-3.5" /> Abrir WhatsApp
                            </Button>
                        )}
                        <Button
                            type="button"
                            variant="secondary"
                            className="gap-1.5 text-xs"
                            onClick={() => modalInfo && copiarTexto(modalInfo.data.texto)}
                        >
                            <Copy className="w-3.5 h-3.5" /> Copiar mensaje
                        </Button>
                        <Button
                            type="button"
                            className="gap-1.5 text-xs"
                            disabled={marcandoId === modalInfo?.filaId}
                            onClick={() => {
                                if (modalInfo) void marcarEnviado(modalInfo.filaId)
                            }}
                        >
                            {marcandoId === modalInfo?.filaId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            Marcar como enviado
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

function TablaHistorial({ items }: { items: HistorialRecompraItem[] }) {
    if (items.length === 0) return <EstadoTablaVacia texto="Todavía no hay despachos para mostrar." />
    return <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-xs"><thead className="border-b bg-muted/40 text-muted-foreground"><tr><th className="px-3 py-2.5">Fecha y hora</th><th className="px-3 py-2.5">Cliente</th><th className="px-3 py-2.5">Segmento</th><th className="px-3 py-2.5">Cupón</th><th className="px-3 py-2.5">Plantilla</th><th className="px-3 py-2.5">Origen</th><th className="px-3 py-2.5">Estado</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-b last:border-0"><td className="whitespace-nowrap px-3 py-3">{formatDateTime(item.fechaHora)}</td><td className="px-3 py-3"><p className="font-medium">{item.clienteNombre}</p><p className="text-[11px] text-muted-foreground">{item.telefono ?? 'Sin teléfono'}</p></td><td className="px-3 py-3"><SegmentoTexto segmento={item.segmento} /></td><td className="px-3 py-3 font-mono">{item.codigoDescuento ?? '—'}</td><td className="px-3 py-3 font-mono text-[11px]">{item.plantillaWhatsapp}</td><td className="px-3 py-3 capitalize">{item.origenContacto}</td><td className="px-3 py-3"><span title={item.errorEnvio ?? undefined} className={`rounded-full px-2 py-1 font-semibold ${item.estadoDespacho === 'entregado' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'}`}>{item.estadoDespacho === 'entregado' ? 'Entregado' : 'Fallido'}</span></td></tr>)}</tbody></table></div>
}

function TablaClientesMotor({ items }: { items: ClienteMotorRecompra[] }) {
    if (items.length === 0) return <EstadoTablaVacia texto="No hay clientes del motor con estos filtros." />
    return <div className="overflow-x-auto"><table className="w-full min-w-[940px] text-left text-xs"><thead className="border-b bg-muted/40 text-muted-foreground"><tr><th className="px-3 py-2.5">Cliente</th><th className="px-3 py-2.5">Rol</th><th className="px-3 py-2.5">Segmento</th><th className="px-3 py-2.5 text-right">Ticket promedio</th><th className="px-3 py-2.5">Último pedido</th><th className="px-3 py-2.5">Estado</th><th className="px-3 py-2.5">Protecciones</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-b last:border-0"><td className="px-3 py-3"><p className="font-medium">{item.clienteNombre}</p><p className="text-[11px] text-muted-foreground">{item.telefono ?? 'Sin teléfono'}</p></td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 font-semibold ${item.rol === 'control' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : 'bg-muted text-foreground'}`}>{item.rol === 'control' ? 'Control · no contactar' : 'Contactado'}</span></td><td className="px-3 py-3"><SegmentoTexto segmento={item.segmento} /></td><td className="px-3 py-3 text-right font-medium">{formatCurrency(item.ticketPromedio)}</td><td className="whitespace-nowrap px-3 py-3">{formatDateTime(item.ultimoPedidoAt)}</td><td className="px-3 py-3"><EstadoClienteBadge estado={item.estado} /></td><td className="px-3 py-3"><ProteccionesCliente item={item} /></td></tr>)}</tbody></table></div>
}

function EstadoClienteBadge({ estado }: { estado: ClienteMotorRecompra['estado'] }) {
    const labels: Record<ClienteMotorRecompra['estado'], string> = { pendiente: 'Pendiente', enviado: 'Enviado', control: 'Control', salido_por_pedido: 'Salió por pedido', fallido: 'Fallido' }
    return <span className="whitespace-nowrap rounded-full bg-muted px-2 py-1 font-semibold text-foreground">{labels[estado]}</span>
}

function ProteccionesCliente({ item }: { item: ClienteMotorRecompra }) {
    const protecciones = item.protecciones
    const labels = [
        protecciones.optOut ? 'Opt-out' : null,
        protecciones.cooldownHasta ? `Cooldown hasta ${formatDateTime(protecciones.cooldownHasta)}` : null,
        protecciones.topeFrecuenciaAlcanzado ? `Tope ${protecciones.toques30Dias}/${protecciones.maximoToques30Dias}` : null,
        protecciones.horarioSilencioActivo ? 'Horario de silencio' : null,
    ].filter(Boolean)
    return labels.length > 0 ? <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300"><CircleOff className="h-3.5 w-3.5" />{labels.join(' · ')}</span> : <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" />Contactable</span>
}

function EstadoTablaVacia({ texto }: { texto: string }) {
    return <div className="flex flex-col items-center px-4 py-10 text-center text-muted-foreground"><Clock className="h-6 w-6 opacity-40" /><p className="mt-2 text-xs">{texto}</p></div>
}

// =============================================================================
// Sub-componentes
// =============================================================================
function EstadoBadge({ estado }: { estado: EstadoCampana }) {
    const map: Record<EstadoCampana, { label: string; dot: string; cls: string }> = {
        activa: { label: 'Activa', dot: 'bg-emerald-500', cls: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800' },
        completada: { label: 'Automático', dot: 'bg-emerald-500', cls: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800' },
        pausada_manual: { label: 'Pausado', dot: 'bg-muted-foreground', cls: 'text-muted-foreground bg-white dark:bg-muted border-border' },
        pausada_sin_saldo: { label: 'Pausado · sin saldo', dot: 'bg-orange-500', cls: 'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800' },
    }
    const m = map[estado]
    return (
        <span className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-semibold border ${m.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${m.dot} ${estado === 'activa' ? 'animate-pulse' : ''}`} />
            {m.label}
        </span>
    )
}

function StepperCupo({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    const clamp = (v: number) => Math.max(CUPO_MIN, Math.min(CUPO_MAX, v))
    return (
        <div className="inline-flex items-center rounded-lg border border-input bg-background">
            <button className="w-7 h-8 text-muted-foreground hover:text-foreground disabled:opacity-40" disabled={value <= CUPO_MIN} onClick={() => onChange(clamp(value - 5))}>−</button>
            <span className="w-9 text-center text-sm font-semibold text-foreground tabular-nums">{value}</span>
            <button className="w-7 h-8 text-muted-foreground hover:text-foreground disabled:opacity-40" disabled={value >= CUPO_MAX} onClick={() => onChange(clamp(value + 5))}>+</button>
        </div>
    )
}

function StatCard({ label, value, hint, icon }: {
    label: string; value: string; hint?: string; icon: React.ReactNode
}) {
    return (
        <div className="bg-[#FFFBF0] dark:bg-background border border-border/50 rounded-xl p-4">
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white dark:bg-muted text-muted-foreground mb-2">{icon}</div>
            <p className="text-lg font-bold text-foreground tabular-nums leading-tight">{value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">{label}</p>
            {hint && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{hint}</p>}
        </div>
    )
}

function ExplainCard({ icon: Icon, title, text }: { icon: typeof Users; title: string; text: string }) {
    return (
        <div className="rounded-xl border border-border/60 bg-[#FFFBF0] dark:bg-background p-4">
            <div className="w-9 h-9 rounded-lg bg-white dark:bg-muted flex items-center justify-center text-muted-foreground mb-3">
                <Icon className="w-4.5 h-4.5" />
            </div>
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{text}</p>
        </div>
    )
}

function PlanBloqueado() {
    return (
        <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-white dark:bg-muted flex items-center justify-center mx-auto mb-5 text-foreground">
                <Crown className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Activ? el Motor de Recompra</h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
                Convertí tu base de clientes en recompra automática: detección de quién se está por perder, mensajes con
                tu marca goteados a su ritmo y atribución honesta con grupo de control. Activá el módulo para encenderlo.
            </p>
            <div className="grid sm:grid-cols-3 gap-3 mt-8 text-left max-w-2xl mx-auto">
                <ExplainCard icon={TrendingUp} title="Detecta solo" text="Encuentra a los que se están por perder según la cadencia de cada uno." />
                <ExplainCard icon={Gauge} title="Gotea a su ritmo" text="Manda de a poco, en el día justo de cada cliente. Cero campañas masivas." />
                <ExplainCard icon={FlaskConical} title="Mide de verdad" text="Grupo de control para saber la plata real que generó, sin inflar." />
            </div>
        </div>
    )
}
