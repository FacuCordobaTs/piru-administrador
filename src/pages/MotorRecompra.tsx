import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useAuthStore } from '@/store/authStore'
import { clientesApi, ApiError } from '@/lib/api'
import { toast } from 'sonner'
import {
    Rocket, AlertTriangle, Moon, UserX, Users, DollarSign, ShieldCheck,
    Loader2, CheckCircle2, Zap, Crown, Gauge, TrendingUp, Wallet,
    Pause, Play, Pencil, Repeat, Send, FlaskConical,
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

type Segmento = 'en_riesgo' | 'dormido' | 'perdido'
type EstadoCampana = 'activa' | 'pausada_sin_saldo' | 'pausada_manual' | 'completada'

const SEG_META: Record<Segmento, { label: string; icon: typeof Moon; dot: string; text: string }> = {
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
        <div className="flex-1 min-h-0 overflow-hidden bg-background">
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
                            onRecargar={() => navigate('/dashboard/ajustes/plan')}
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
            const res = await clientesApi.activarRecompra(token, cupo) as { success: boolean; data: any }
            if (res.success) {
                setConfirmOpen(false)
                if (res.data?.vacio) toast.info('No hay clientes para recuperar ahora mismo')
                else toast.success('Motor de recompra encendido. Empezó a gotear con tu marca.')
                onActivado()
            }
        } catch (err) {
            if (err instanceof ApiError && err.status === 403 && err.response?.upgradeRequired) {
                toast.error('El Motor de Recompra está disponible en el plan Avanzado')
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
                <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20 shrink-0">
                    <Rocket className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">Motor de Recompra</h1>
                    <p className="text-[13px] text-muted-foreground">Encendelo una vez. El resto es automático.</p>
                </div>
            </div>

            {/* El PLAN en prosa (no un formulario) */}
            <div className="rounded-2xl border border-violet-200 dark:border-violet-900 bg-linear-to-br from-violet-50/80 to-background dark:from-violet-950/40 dark:to-background p-5 sm:p-6">
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
                        los primeros <span className="font-semibold">{plan.diasCubiertos} {plan.diasCubiertos === 1 ? 'día' : 'días'}</span>.</>
                    ) : (
                        <> <span className="font-medium text-orange-600 dark:text-orange-400">No te quedan mensajes de campaña</span>: recargá para que el motor pueda arrancar.</>
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
                            <button onClick={() => setEditandoCupo(true)} className="text-violet-600 dark:text-violet-400 hover:underline font-medium">Cambiar</button>
                        </span>
                    )}
                </div>

                <Button
                    onClick={() => setConfirmOpen(true)}
                    size="lg"
                    className="mt-5 h-12 px-8 gap-2 bg-violet-600 hover:bg-violet-700 text-white text-base w-full sm:w-auto"
                >
                    <Zap className="w-5 h-5" /> Activar
                </Button>
            </div>

            {/* Por qué gotea (feature, no restricción) + grupo de control */}
            <div className="grid sm:grid-cols-2 gap-3 mt-4">
                <ExplainCard icon={Gauge} title="Gotea, no satura"
                    text={`Manda de a poco (hasta ${cupo}/día) para cuidar tu número ante WhatsApp y no llenarte la cocina de golpe. Cada día prioriza a quien más conviene.`} />
                <ExplainCard icon={FlaskConical} title="Mide de verdad"
                    text={`Aparta ${plan.totalControl} clientes sin contactar (grupo de control). Comparando cuántos vuelven con y sin mensaje, vas a ver la plata real que generó — no un número inflado.`} />
            </div>

            {/* Confirmación */}
            <Dialog open={confirmOpen} onOpenChange={(o) => !activando && setConfirmOpen(o)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-violet-600" /> Encender el motor
                        </DialogTitle>
                        <DialogDescription>
                            A partir de ahora el motor va a ir contactando solo a los {plan.totalContactar} clientes,
                            hasta {cupo} por día, empezando por los de mejor retorno. Apartamos {plan.totalControl} como
                            grupo de control. No tenés que hacer nada más: podés pausarlo cuando quieras.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-lg border bg-muted/40 p-3">
                        <p className="text-[11px] text-muted-foreground">
                            Cada mensaje consume 1 crédito de <span className="font-medium">campaña (marketing)</span>. Si se agotan,
                            el motor se <span className="font-medium">pausa solo</span> (nunca genera deuda) y te avisa una vez con el resultado.
                        </p>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-2">
                        <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={activando}>Cancelar</Button>
                        <Button onClick={activar} disabled={activando} className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
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
    const [editandoCupo, setEditandoCupo] = useState(false)
    const [cupo, setCupo] = useState(campana.cupoDiario)

    const sinSaldo = campana.estado === 'pausada_sin_saldo'
    const pausadaManual = campana.estado === 'pausada_manual'
    const activa = campana.estado === 'activa' || campana.estado === 'completada'

    const doAccion = async (fn: () => Promise<any>, okMsg: string) => {
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
            {/* Encabezado con estado + marcador en una línea (el "hit" diario es de resultados) */}
            <div className="flex items-start justify-between gap-3 mb-1">
                <div className="flex items-center gap-2.5">
                    <EstadoBadge estado={campana.estado} />
                    <h1 className="text-xl font-semibold tracking-tight text-foreground">Motor de Recompra</h1>
                </div>
                {activa && (
                    <Button variant="outline" size="sm" disabled={accion}
                        onClick={() => doAccion(() => clientesApi.pausarRecompra(token!), 'Motor pausado')}
                        className="h-8 gap-1.5 text-xs">
                        <Pause className="w-3.5 h-3.5" /> Pausar
                    </Button>
                )}
                {pausadaManual && (
                    <Button size="sm" disabled={accion}
                        onClick={() => doAccion(() => clientesApi.reanudarRecompra(token!), 'Motor reanudado')}
                        className="h-8 gap-1.5 text-xs bg-violet-600 hover:bg-violet-700 text-white">
                        <Play className="w-3.5 h-3.5" /> Reanudar
                    </Button>
                )}
            </div>
            <p className="text-[13px] text-muted-foreground mb-5">
                {campana.contactados} contactados · <span className="text-foreground font-medium">{campana.volvieron} volvieron a pedir</span> · {formatCurrency(campana.plataRecuperada)} recuperados
            </p>

            {/* Aviso de saldo agotado (pausa por saldo): continuación de algo que funciona, con el retorno al lado */}
            {sinSaldo && (
                <div className="mb-5 rounded-xl border border-orange-200 dark:border-orange-900 bg-orange-50/70 dark:bg-orange-950/30 p-4">
                    <div className="flex items-start gap-3">
                        <Wallet className="w-5 h-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-orange-900 dark:text-orange-200">Pausado: se terminaron tus mensajes de campaña</p>
                            <p className="text-xs text-orange-800/80 dark:text-orange-300/80 mt-0.5 leading-relaxed">
                                Los que enviaste generaron <span className="font-semibold">{campana.volvieron} {campana.volvieron === 1 ? 'pedido' : 'pedidos'} por {formatCurrency(campana.plataRecuperada)}</span>.
                                {campana.enCola > 0 && <> Quedan <span className="font-semibold">{campana.enCola} clientes en cola</span>.</>} Recargá y sigue solo desde donde quedó.
                            </p>
                            <Button size="sm" onClick={onRecargar} className="mt-3 h-8 gap-1.5 text-xs bg-orange-600 hover:bg-orange-700 text-white">
                                <Wallet className="w-3.5 h-3.5" /> Recargar mensajes
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {pausadaManual && (
                <div className="mb-5 rounded-xl border border-border bg-muted/40 p-4 flex items-start gap-3">
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
                    hint={`${campana.totalEnviados} mensajes usados`} icon={<Send className="w-4 h-4" />}
                    color="text-violet-600 dark:text-violet-400" bg="bg-violet-50 dark:bg-violet-950/50" />
                <StatCard label="Volvieron a pedir" value={campana.volvieron.toString()}
                    hint={campana.contactados > 0 ? `${pct(campana.tasaContactados)} de los contactados` : 'todavía sin datos'}
                    icon={<Repeat className="w-4 h-4" />} color="text-emerald-600 dark:text-emerald-400" bg="bg-emerald-50 dark:bg-emerald-950/50" />
                <StatCard label="Recuperado" value={formatCurrency(campana.plataRecuperada)}
                    hint="facturación de los que volvieron" icon={<DollarSign className="w-4 h-4" />}
                    color="text-blue-600 dark:text-blue-400" bg="bg-blue-50 dark:bg-blue-950/50" />
                <StatCard label="En cola" value={campana.enCola.toString()}
                    hint={activa ? `goteando ${campana.enviadosHoy} hoy` : 'en espera'} icon={<Users className="w-4 h-4" />}
                    color="text-amber-600 dark:text-amber-400" bg="bg-amber-50 dark:bg-amber-950/50" />
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
            <div className="mt-5 rounded-xl border border-border/60 bg-background p-4">
                <div className="flex items-center gap-2 text-sm">
                    <Gauge className="w-4 h-4 text-muted-foreground shrink-0" />
                    {editandoCupo ? (
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-muted-foreground">Enviando hasta</span>
                            <StepperCupo value={cupo} onChange={setCupo} />
                            <span className="text-muted-foreground">por día</span>
                            <Button size="sm" disabled={accion} onClick={guardarCupo} className="h-7 px-3 text-xs bg-violet-600 hover:bg-violet-700 text-white">
                                {accion ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Guardar'}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setEditandoCupo(false); setCupo(campana.cupoDiario) }}>Cancelar</Button>
                        </div>
                    ) : (
                        <span className="text-muted-foreground">
                            Enviando hasta <span className="font-medium text-foreground">{campana.cupoDiario}/día</span> (máx. {CUPO_MAX} por seguridad del número)
                            {' · '}
                            <button onClick={() => setEditandoCupo(true)} className="text-violet-600 dark:text-violet-400 hover:underline font-medium inline-flex items-center gap-1">
                                <Pencil className="w-3 h-3" /> Cambiar
                            </button>
                        </span>
                    )}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <Wallet className="w-3.5 h-3.5 shrink-0" />
                    Saldo de campaña: <span className={`font-medium ${campana.saldoMarketing <= 0 ? 'text-orange-600 dark:text-orange-400' : 'text-foreground'}`}>{campana.saldoMarketing} mensajes</span>
                    {campana.saldoMarketing <= 0 && (
                        <button onClick={onRecargar} className="text-violet-600 dark:text-violet-400 hover:underline font-medium">· Recargar</button>
                    )}
                </div>
            </div>

            {campana.estado === 'completada' && (
                <p className="mt-4 text-xs text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    Ya recuperaste todo el backlog. El motor sigue encendido en modo automático: cada vez que un cliente se pase de su ritmo, lo contacta solo.
                </p>
            )}
        </div>
    )
}

// =============================================================================
// Sub-componentes
// =============================================================================
function EstadoBadge({ estado }: { estado: EstadoCampana }) {
    const map: Record<EstadoCampana, { label: string; dot: string; cls: string }> = {
        activa: { label: 'Activa', dot: 'bg-emerald-500', cls: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800' },
        completada: { label: 'Automático', dot: 'bg-emerald-500', cls: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800' },
        pausada_manual: { label: 'Pausado', dot: 'bg-muted-foreground', cls: 'text-muted-foreground bg-muted border-border' },
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

function StatCard({ label, value, hint, icon, color, bg }: {
    label: string; value: string; hint?: string; icon: React.ReactNode; color: string; bg: string
}) {
    return (
        <div className="bg-background border border-border/50 rounded-xl p-4">
            <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${bg} ${color} mb-2`}>{icon}</div>
            <p className="text-lg font-bold text-foreground tabular-nums leading-tight">{value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">{label}</p>
            {hint && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{hint}</p>}
        </div>
    )
}

function ExplainCard({ icon: Icon, title, text }: { icon: typeof Users; title: string; text: string }) {
    return (
        <div className="rounded-xl border border-border/60 bg-background p-4">
            <div className="w-9 h-9 rounded-lg bg-violet-50 dark:bg-violet-950/50 flex items-center justify-center text-violet-600 dark:text-violet-400 mb-3">
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
            <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-amber-500/20">
                <Crown className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">El Motor de Recompra es del plan Avanzado</h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
                Convertí tu base de clientes en recompra automática: detección de quién se está por perder, mensajes con
                tu marca goteados a su ritmo y atribución honesta con grupo de control. Subí al plan Avanzado para encenderlo.
            </p>
            <div className="grid sm:grid-cols-3 gap-3 mt-8 text-left max-w-2xl mx-auto">
                <ExplainCard icon={TrendingUp} title="Detecta solo" text="Encuentra a los que se están por perder según la cadencia de cada uno." />
                <ExplainCard icon={Gauge} title="Gotea a su ritmo" text="Manda de a poco, en el día justo de cada cliente. Cero campañas masivas." />
                <ExplainCard icon={FlaskConical} title="Mide de verdad" text="Grupo de control para saber la plata real que generó, sin inflar." />
            </div>
        </div>
    )
}
