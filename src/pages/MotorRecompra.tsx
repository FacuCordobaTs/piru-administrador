import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
    type DecisionesRecompra,
    type HistorialRecompraItem,
    type ModalidadLinkRecompra,
    type PaginadoRecompra,
    type ModoRecompra,
    type MensajeColaData,
    type SegmentoRecompra,
} from '@/lib/api'
import { toast } from 'sonner'
import {
    Users, Loader2, CheckCircle2, Zap, Crown, Gauge, Wallet,
    Pause, Play, ListOrdered, History, UserRoundCheck, Clock,
    RefreshCw, Copy, Check, ExternalLink, Bot, MessageSquare,
    Search, X, ArrowLeft, User, Ticket, CheckCheck, ChevronRight as ChevronRightIcon,
    Repeat2, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// =============================================================================
// MOTOR DE RECOMPRA · GOTEO (piloto automático)
//
// Estilo Apple minimalista, componentes flotantes sobre fondo cálido,
// métricas numéricas grandes sin cajas duras ni neon, listado a la izquierda
// y motor + detalle del cliente a la derecha.
// =============================================================================

type Segmento = SegmentoRecompra
type EstadoCampana = 'activa' | 'pausada_sin_saldo' | 'pausada_manual' | 'completada'
type ObservabilidadTab = 'cola' | 'historial' | 'clientes'
type MobileView = 'lista' | 'detalle'

const SEG_META: Record<Segmento, { label: string; dot: string }> = {
    primer_pedido: { label: 'Primer pedido', dot: 'bg-emerald-500' },
    en_riesgo: { label: 'En riesgo', dot: 'bg-orange-500' },
    dormido: { label: 'Dormidos', dot: 'bg-violet-500' },
    perdido: { label: 'Perdidos', dot: 'bg-rose-500' },
}

/** Clave del mensaje cacheado: una entrada por (fila, decisiones del operador). */
function claveMensaje(filaId: number, decisiones: DecisionesRecompra | undefined): string {
    if (!decisiones) return `${filaId}:motor`
    const { segmento, toque, link, descuento } = decisiones
    return `${filaId}:${segmento ?? 'vivo'}:${toque ?? 'escalera'}:${link ?? 'auto'}:${descuento ?? 'auto'}`
}

/** Los tres toques del goteo: el ordinal con el que el operador los nombra. */
const TOQUE_ORDINAL = ['1º', '2º', '3º']

/** "2º toque" · null si la fila no trae toque (las de control). */
function etiquetaToque(toque: number | null | undefined): string | null {
    if (toque == null || !Number.isFinite(toque)) return null
    return `${TOQUE_ORDINAL[toque - 1] ?? `${toque}º`} toque`
}

/** El resumen de lo que se va a mandar, para las filas y el detalle: "2º toque · 10 % OFF". */
function resumenEnvio(toque: number | null | undefined, descuento: number | null | undefined): string {
    const partes = [etiquetaToque(toque)]
    if (descuento != null && descuento > 0) partes.push(`${descuento}% OFF`)
    return partes.filter(Boolean).join(' · ')
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

const iniciales = (nombre: string) =>
    nombre.trim().split(/\s+/).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase()

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

    if (loading) {
        return (
            <div className="mx-auto max-w-[1680px] w-full px-4 sm:px-6 py-6">
                <Cargando />
            </div>
        )
    }

    if (bloqueadoPlan) {
        return (
            <div className="mx-auto max-w-[1680px] w-full px-4 sm:px-6 py-6">
                <PlanBloqueado />
            </div>
        )
    }

    if (estado?.activa && estado.campana) {
        return (
            <PantallaEncendido
                campana={estado.campana}
                onCambio={cargar}
                onRecargar={() => navigate('/dashboard/mensajes')}
            />
        )
    }

    if (estado?.plan) {
        return (
            <ScrollArea className="h-full">
                <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
                    <PantallaApagado plan={estado.plan} onActivado={cargar} />
                </div>
            </ScrollArea>
        )
    }

    return null
}

function Cargando() {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 py-4 border-y border-border/30">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-8 w-24" />
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
                </div>
                <Skeleton className="h-80 rounded-2xl" />
            </div>
        </div>
    )
}

// =============================================================================
// ENCENDIDO — SPLIT PANE CON ESTILO APPLE (LISTA + DETALLE FLOTANTE)
// =============================================================================
function PantallaEncendido({ campana, onCambio, onRecargar }: {
    campana: Dashboard
    onCambio: () => void
    onRecargar: () => void
}) {
    const token = useAuthStore(state => state.token)

    // Navegación responsive
    const [mobileView, setMobileView] = useState<MobileView>('lista')
    const [tab, setTab] = useState<ObservabilidadTab>('cola')
    const [pagina, setPagina] = useState(1)
    const [segmento, setSegmento] = useState<string>('todos')
    const [query, setQuery] = useState('')

    // Observabilidad
    const [loadingObservabilidad, setLoadingObservabilidad] = useState(true)
    const [cola, setCola] = useState<PaginadoRecompra<ColaRecompraItem> | null>(null)
    const [historial, setHistorial] = useState<PaginadoRecompra<HistorialRecompraItem> | null>(null)
    const [clientes, setClientes] = useState<PaginadoRecompra<ClienteMotorRecompra> | null>(null)

    // Selección
    const [selectedColaId, setSelectedColaId] = useState<number | null>(null)
    const [selectedHistorialId, setSelectedHistorialId] = useState<number | null>(null)
    const [selectedClienteId, setSelectedClienteId] = useState<number | null>(null)

    // Mensajes para la cola. Cada fila recuerda con QUÉ decisiones se generó el mensaje cacheado, para
    // poder refrescarlo cuando el operador cambia de mensaje, de link o de descuento (el texto, el
    // cupón y la URL cambian con cada una). `data: null` = ese mensaje no se pudo preparar; se recuerda
    // para no reintentar en loop y poder decir la verdad en pantalla en lugar de dejar un esqueleto.
    const [mensajeCache, setMensajeCache] = useState<Record<number, { clave: string; data: MensajeColaData | null }>>({})
    // Decisiones a mano por fila. Ausente = las del motor (segmento recalculado en vivo, toque de la
    // escalera, `%` de ese escalón): es el default y el estado natural de la fila.
    const [decisionesPorFila, setDecisionesPorFila] = useState<Record<number, DecisionesRecompra>>({})
    const [cargandoMensajeId, setCargandoMensajeId] = useState<number | null>(null)
    const [marcandoId, setMarcandoId] = useState<number | null>(null)
    const [copiadoId, setCopiadoId] = useState<number | null>(null)

    // Control del motor
    const [accionMotor, setAccionMotor] = useState(false)
    const [cambiandoModo, setCambiandoModo] = useState(false)
    const [editandoCupo, setEditandoCupo] = useState(false)
    const [cupo, setCupo] = useState(campana.cupoDiario)

    const doAccion = async (fn: () => Promise<unknown>, okMsg: string) => {
        if (!token) return
        setAccionMotor(true)
        try {
            const res = await fn() as { success: boolean }
            if (res.success) { toast.success(okMsg); onCambio() }
        } catch {
            toast.error('No se pudo completar la acción')
        } finally {
            setAccionMotor(false)
        }
    }

    const alternarModo = async (nuevoModo: ModoRecompra) => {
        if (!token || cambiandoModo) return
        setCambiandoModo(true)
        try {
            const res = await clientesApi.modoRecompra(token, nuevoModo) as { success: boolean }
            if (res.success) {
                toast.success(`Modo ${nuevoModo === 'automatico' ? 'Automático' : 'Manual'} activado`)
                onCambio()
            }
        } catch {
            toast.error('No se pudo cambiar el modo')
        } finally {
            setCambiandoModo(false)
        }
    }

    const guardarCupo = async () => {
        if (!token) return
        setAccionMotor(true)
        try {
            const res = await clientesApi.configRecompra(token, cupo) as { success: boolean }
            if (res.success) { toast.success('Cupo diario actualizado'); setEditandoCupo(false); onCambio() }
        } catch {
            toast.error('No se pudo actualizar el cupo')
        } finally {
            setAccionMotor(false)
        }
    }

    // Carga de datos
    const cargarObservabilidad = useCallback(async (silencioso = false) => {
        if (!token) return
        if (!silencioso) setLoadingObservabilidad(true)
        try {
            const segParam = segmento !== 'todos' ? segmento : undefined
            if (tab === 'cola') {
                const res = await clientesApi.recompraCola(token, { pagina, limite: 25, segmento: segParam })
                setCola(res.data)
                if (res.data.items.length > 0) {
                    setSelectedColaId(prev => (prev && res.data.items.some(i => i.id === prev) ? prev : res.data.items[0].id))
                } else {
                    setSelectedColaId(null)
                }
            } else if (tab === 'historial') {
                const res = await clientesApi.recompraHistorial(token, { pagina, limite: 25, segmento: segParam })
                setHistorial(res.data)
                if (res.data.items.length > 0) {
                    setSelectedHistorialId(prev => (prev && res.data.items.some(i => i.id === prev) ? prev : res.data.items[0].id))
                } else {
                    setSelectedHistorialId(null)
                }
            } else {
                const res = await clientesApi.recompraClientes(token, { pagina, limite: 25, segmento: segParam })
                setClientes(res.data)
                if (res.data.items.length > 0) {
                    setSelectedClienteId(prev => (prev && res.data.items.some(i => i.id === prev) ? prev : res.data.items[0].id))
                } else {
                    setSelectedClienteId(null)
                }
            }
        } catch {
            if (!silencioso) toast.error('No se pudo actualizar la lista')
        } finally {
            if (!silencioso) setLoadingObservabilidad(false)
        }
    }, [token, tab, pagina, segmento])

    useEffect(() => {
        void cargarObservabilidad()
        const timer = window.setInterval(() => void cargarObservabilidad(true), 30_000)
        return () => window.clearInterval(timer)
    }, [cargarObservabilidad])

    // Cargar el mensaje del cliente seleccionado (y regenerarlo si el operador cambió las decisiones)
    useEffect(() => {
        if (!token || tab !== 'cola' || !selectedColaId) return
        const decisiones = decisionesPorFila[selectedColaId]
        const clave = claveMensaje(selectedColaId, decisiones)
        if (mensajeCache[selectedColaId]?.clave === clave) return

        let mounted = true
        setCargandoMensajeId(selectedColaId)
        // Guardar el resultado bajo la clave pedida, incluso si falló (`data: null`): así el efecto no
        // reintenta en loop y la pantalla puede distinguir "no se pudo" de "todavía no llegó".
        const guardar = (data: MensajeColaData | null) => {
            setMensajeCache(prev => ({ ...prev, [selectedColaId]: { clave, data } }))
        }
        // Volver a los defaults del motor para no dejar la selección apuntando a un mensaje que nunca
        // va a llegar; si ya estaba en los defaults no hay nada que revertir.
        const volverAlMotor = () => {
            toast.error('No se pudo preparar ese mensaje. Volvimos a las decisiones del motor.')
            setDecisionesPorFila(prev => {
                if (!(selectedColaId in prev)) return prev
                const siguiente = { ...prev }
                delete siguiente[selectedColaId]
                return siguiente
            })
        }
        clientesApi.mensajeColaRecompra(token, selectedColaId, decisiones)
            .then(res => {
                if (!mounted) return
                const data = res.success && res.data ? res.data : null
                guardar(data)
                if (!data && decisiones) volverAlMotor()
            })
            .catch(() => {
                if (!mounted) return
                guardar(null)
                if (decisiones) volverAlMotor()
            })
            .finally(() => {
                if (mounted) setCargandoMensajeId(null)
            })

        return () => { mounted = false }
    }, [token, tab, selectedColaId, decisionesPorFila, mensajeCache])

    const cambiarTab = (siguiente: ObservabilidadTab) => {
        setTab(siguiente)
        setPagina(1)
        setQuery('')
    }

    // Filtrado por query local
    const colaFiltrada = useMemo(() => {
        const items = cola?.items ?? []
        if (!query.trim()) return items
        const q = query.toLowerCase().trim()
        return items.filter(i => i.clienteNombre.toLowerCase().includes(q) || (i.telefono && i.telefono.includes(q)))
    }, [cola, query])

    const historialFiltrado = useMemo(() => {
        const items = historial?.items ?? []
        if (!query.trim()) return items
        const q = query.toLowerCase().trim()
        return items.filter(i => i.clienteNombre.toLowerCase().includes(q) || (i.telefono && i.telefono.includes(q)))
    }, [historial, query])

    const clientesFiltrados = useMemo(() => {
        const items = clientes?.items ?? []
        if (!query.trim()) return items
        const q = query.toLowerCase().trim()
        return items.filter(i => i.clienteNombre.toLowerCase().includes(q) || (i.telefono && i.telefono.includes(q)))
    }, [clientes, query])

    const totalRegistros = tab === 'cola' ? (cola?.total ?? 0) : tab === 'historial' ? (historial?.total ?? 0) : (clientes?.total ?? 0)
    const paginasTotal = tab === 'cola' ? (cola?.paginas ?? 1) : tab === 'historial' ? (historial?.paginas ?? 1) : (clientes?.paginas ?? 1)

    // Acciones de contacto
    const copiarTexto = async (texto: string, id?: number) => {
        try {
            await navigator.clipboard.writeText(texto)
            if (id) {
                setCopiadoId(id)
                setTimeout(() => setCopiadoId(null), 2000)
            }
            toast.success('Mensaje copiado al portapapeles')
        } catch {
            toast.error('No se pudo copiar al portapapeles')
        }
    }

    // Se registran las decisiones que el operador realmente mandó: pueden no llevar descuento. El
    // backend devuelve lo que quedó escrito en la fila, así el toast dice el toque y el `%` reales y
    // no lo que la UI creía.
    const marcarEnviado = async (filaId: number, decisiones?: DecisionesRecompra) => {
        if (!token || marcandoId) return
        setMarcandoId(filaId)
        try {
            const res = await clientesApi.marcarEnviadoColaRecompra(token, filaId, decisiones)
            if (res.success) {
                const registro = res.data
                const detalle = registro?.toque
                    ? `${registro.toque}º toque${registro.descuento > 0 ? ` · ${registro.descuento}% OFF` : ' · sin descuento'}`
                    : null
                toast.success(detalle ? `Registrado: ${detalle}` : 'Registrado como enviado')
                void cargarObservabilidad(true)
                onCambio()
            }
        } catch {
            toast.error('No se pudo marcar como enviado')
        } finally {
            setMarcandoId(null)
        }
    }

    const cambiarDecisiones = (filaId: number, decisiones: DecisionesRecompra | null) => {
        setDecisionesPorFila(prev => {
            const siguiente = { ...prev }
            if (decisiones) siguiente[filaId] = decisiones
            else delete siguiente[filaId]
            return siguiente
        })
    }

    const itemCola = useMemo(() => cola?.items.find(i => i.id === selectedColaId) ?? null, [cola, selectedColaId])
    const itemHistorial = useMemo(() => historial?.items.find(i => i.id === selectedHistorialId) ?? null, [historial, selectedHistorialId])
    const itemCliente = useMemo(() => clientes?.items.find(i => i.id === selectedClienteId) ?? null, [clientes, selectedClienteId])

    return (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Navegación móvil estilo Apple */}
            <div className="xl:hidden shrink-0 border-b border-border/30 bg-background/80 px-4 py-2 backdrop-blur-xs">
                <div className="mx-auto flex max-w-xs items-center justify-center gap-1 rounded-full bg-muted/70 p-1">
                    <button
                        type="button"
                        onClick={() => setMobileView('lista')}
                        className={cn(
                            "flex-1 rounded-full px-3 py-1 text-xs font-medium transition-all",
                            mobileView === 'lista' ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Listado ({totalRegistros})
                    </button>
                    <button
                        type="button"
                        onClick={() => setMobileView('detalle')}
                        className={cn(
                            "flex-1 rounded-full px-3 py-1 text-xs font-medium transition-all",
                            mobileView === 'detalle' ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Motor y Detalle
                    </button>
                </div>
            </div>

            {/* Layout principal a 2 columnas */}
            <main className="flex-1 min-h-0 px-4 pb-4 sm:px-6 overflow-hidden">
                <div className="mx-auto grid h-full max-w-[1680px] gap-6 xl:grid-cols-[minmax(320px,380px)_1fr]">
                    {/* ===================================================================== */}
                    {/* COLUMNA IZQUIERDA: LISTADO FLOTANTE DE CLIENTES                      */}
                    {/* ===================================================================== */}
                    <section className={cn(
                        "flex-col overflow-hidden min-h-0",
                        mobileView === 'lista' ? "flex" : "hidden xl:flex"
                    )}>
                        {/* Selector de pestañas + Búsqueda + Filtros rápidos */}
                        <div className="space-y-3 pb-3">
                            {/* Pestañas estilo Apple */}
                            <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
                                <TabPill active={tab === 'cola'} onClick={() => cambiarTab('cola')} icon={<ListOrdered className="h-3.5 w-3.5" />}>
                                    Próximos
                                </TabPill>
                                <TabPill active={tab === 'historial'} onClick={() => cambiarTab('historial')} icon={<History className="h-3.5 w-3.5" />}>
                                    Historial
                                </TabPill>
                                <TabPill active={tab === 'clientes'} onClick={() => cambiarTab('clientes')} icon={<UserRoundCheck className="h-3.5 w-3.5" />}>
                                    Base
                                </TabPill>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => void cargarObservabilidad()}
                                    className="ml-auto h-8 w-8 rounded-full text-muted-foreground/60 hover:text-foreground"
                                    title="Actualizar"
                                >
                                    <RefreshCw className={cn("h-3.5 w-3.5", loadingObservabilidad && "animate-spin")} />
                                </Button>
                            </div>

                            {/* Buscador redondeado Apple */}
                            <div className="relative">
                                <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                                <Input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Buscar por nombre o teléfono…"
                                    className="h-9 rounded-full border-border/40 bg-background/80 pl-9 pr-8 text-xs shadow-2xs backdrop-blur-xs transition-all placeholder:text-muted-foreground/50 focus-visible:ring-1"
                                />
                                {query && (
                                    <button
                                        type="button"
                                        onClick={() => setQuery('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                )}
                            </div>

                            {/* Filtros de segmento en píldoras */}
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
                                <button
                                    type="button"
                                    onClick={() => setSegmento('todos')}
                                    className={cn(
                                        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all shadow-2xs",
                                        segmento === 'todos'
                                            ? "bg-foreground text-background"
                                            : "border border-border/40 bg-background/80 text-muted-foreground hover:text-foreground backdrop-blur-xs"
                                    )}
                                >
                                    Todos
                                </button>
                                {(Object.keys(SEG_META) as Segmento[]).map((seg) => {
                                    const active = segmento === seg
                                    const meta = SEG_META[seg]
                                    return (
                                        <button
                                            key={seg}
                                            type="button"
                                            onClick={() => setSegmento(seg)}
                                            className={cn(
                                                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all shadow-2xs",
                                                active
                                                    ? "bg-foreground text-background"
                                                    : "border border-border/40 bg-background/80 text-muted-foreground hover:text-foreground backdrop-blur-xs"
                                            )}
                                        >
                                            <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                                            <span>{meta.label}</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Lista de filas flotantes */}
                        <ScrollArea className="flex-1 min-h-0">
                            <div className="space-y-1.5 pr-2">
                                {loadingObservabilidad && !cola && !historial && !clientes ? (
                                    <div className="space-y-2 p-1">
                                        {Array.from({ length: 6 }).map((_, i) => (
                                            <Skeleton key={i} className="h-16 rounded-xl" />
                                        ))}
                                    </div>
                                ) : tab === 'cola' ? (
                                    colaFiltrada.length === 0 ? (
                                        <EmptyList texto="No hay clientes en cola" subtexto="Cuando alguno se enfríe, el motor lo incorporará." />
                                    ) : (
                                        colaFiltrada.map((item) => (
                                            <RowCola
                                                key={item.id}
                                                item={item}
                                                selected={item.id === selectedColaId}
                                                onClick={() => {
                                                    setSelectedColaId(item.id)
                                                    setMobileView('detalle')
                                                }}
                                            />
                                        ))
                                    )
                                ) : tab === 'historial' ? (
                                    historialFiltrado.length === 0 ? (
                                        <EmptyList texto="Sin despachos registrados" subtexto="Los mensajes enviados quedarán registrados acá." />
                                    ) : (
                                        historialFiltrado.map((item) => (
                                            <RowHistorial
                                                key={item.id}
                                                item={item}
                                                selected={item.id === selectedHistorialId}
                                                onClick={() => {
                                                    setSelectedHistorialId(item.id)
                                                    setMobileView('detalle')
                                                }}
                                            />
                                        ))
                                    )
                                ) : (
                                    clientesFiltrados.length === 0 ? (
                                        <EmptyList texto="No hay clientes con estos filtros" subtexto="Probá con otros segmentos." />
                                    ) : (
                                        clientesFiltrados.map((item) => (
                                            <RowCliente
                                                key={item.id}
                                                item={item}
                                                selected={item.id === selectedClienteId}
                                                onClick={() => {
                                                    setSelectedClienteId(item.id)
                                                    setMobileView('detalle')
                                                }}
                                            />
                                        ))
                                    )
                                )}
                            </div>
                        </ScrollArea>

                        {/* Paginación minimalista */}
                        <div className="shrink-0 pt-3 flex items-center justify-between text-xs text-muted-foreground">
                            <span className="text-[11px] tabular-nums">
                                {totalRegistros} total · Pág. {pagina} de {Math.max(1, paginasTotal)}
                            </span>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={pagina <= 1 || loadingObservabilidad}
                                    onClick={() => setPagina(p => Math.max(1, p - 1))}
                                    className="h-7 px-2.5 rounded-full text-xs text-muted-foreground hover:text-foreground"
                                >
                                    Anterior
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={pagina >= paginasTotal || loadingObservabilidad}
                                    onClick={() => setPagina(p => p + 1)}
                                    className="h-7 px-2.5 rounded-full text-xs text-muted-foreground hover:text-foreground"
                                >
                                    Siguiente
                                </Button>
                            </div>
                        </div>
                    </section>

                    {/* ===================================================================== */}
                    {/* COLUMNA DERECHA: MOTOR ARRIBA + DETALLE DEL CLIENTE ABAJO           */}
                    {/* ===================================================================== */}
                    <section className={cn(
                        "flex-col overflow-hidden min-h-0",
                        mobileView === 'detalle' ? "flex" : "hidden xl:flex"
                    )}>
                        {/* Botón para volver en vista móvil */}
                        <div className="xl:hidden pb-3">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setMobileView('lista')}
                                className="h-8 -ml-2 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                            >
                                <ArrowLeft className="h-3.5 w-3.5" />
                                Volver al listado
                            </Button>
                        </div>

                        <ScrollArea className="h-full">
                            <div className="space-y-6 pb-12 pr-4">
                                {/* SECCIÓN 1: ESTADO, MÉTRICAS FLOTANTES Y CONFIGURACIÓN DEL MOTOR */}
                                <div className="space-y-4">
                                    {/* Fila superior de controles */}
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex items-center gap-2.5">
                                            <EstadoBadge estado={campana.estado} />

                                            {/* Selector de modo flotante */}
                                            <div className="inline-flex items-center rounded-full border border-border/40 bg-background/80 p-0.5 text-xs shadow-2xs backdrop-blur-xs">
                                                <button
                                                    type="button"
                                                    disabled={cambiandoModo || accionMotor}
                                                    onClick={() => campana.modo !== 'automatico' && alternarModo('automatico')}
                                                    className={cn(
                                                        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all",
                                                        campana.modo === 'automatico'
                                                            ? "bg-foreground text-background shadow-2xs font-semibold"
                                                            : "text-muted-foreground hover:text-foreground"
                                                    )}
                                                >
                                                    <Bot className="h-3.5 w-3.5" /> Automático
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={cambiandoModo || accionMotor}
                                                    onClick={() => campana.modo !== 'manual' && alternarModo('manual')}
                                                    className={cn(
                                                        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all",
                                                        campana.modo === 'manual'
                                                            ? "bg-foreground text-background shadow-2xs font-semibold"
                                                            : "text-muted-foreground hover:text-foreground"
                                                    )}
                                                >
                                                    <MessageSquare className="h-3.5 w-3.5" /> Manual
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {campana.estado === 'activa' || campana.estado === 'completada' ? (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={accionMotor || cambiandoModo}
                                                    onClick={() => doAccion(() => clientesApi.pausarRecompra(token!), 'Motor pausado')}
                                                    className="h-8 gap-1.5 rounded-full border-border/60 bg-background/80 px-3.5 text-xs font-medium shadow-2xs hover:bg-muted/50"
                                                >
                                                    <Pause className="h-3 w-3" /> Pausar
                                                </Button>
                                            ) : campana.estado === 'pausada_manual' ? (
                                                <Button
                                                    size="sm"
                                                    disabled={accionMotor || cambiandoModo}
                                                    onClick={() => doAccion(() => clientesApi.reanudarRecompra(token!), 'Motor reanudado')}
                                                    className="h-8 gap-1.5 rounded-full px-3.5 text-xs font-medium shadow-2xs"
                                                >
                                                    <Play className="h-3 w-3" /> Reanudar
                                                </Button>
                                            ) : null}
                                        </div>
                                    </div>

                                    {/* Métricas flotantes Apple (sin cajas ni bordes pesados) */}
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-y border-border/30 py-5 sm:grid-cols-4">
                                        <FloatingMetric
                                            label="Contactados"
                                            value={campana.contactados}
                                            sublabel={campana.modo === 'manual' ? 'enviados a mano' : `${campana.totalEnviados} mensajes usados`}
                                        />
                                        <FloatingMetric
                                            label="Volvieron"
                                            value={campana.volvieron}
                                            sublabel={campana.contactados > 0 ? `${pct(campana.tasaContactados)} de retorno` : 'aún sin datos'}
                                        />
                                        <FloatingMetric
                                            label="Recuperado"
                                            value={formatCurrency(campana.plataRecuperada)}
                                            sublabel="facturación atribuida"
                                        />
                                        <FloatingMetric
                                            label="En cola"
                                            value={campana.enCola}
                                            sublabel={`hasta ${campana.cupoDiario}/día`}
                                        />
                                    </div>

                                    {/* Ajuste de cupo y saldo flotante */}
                                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground pt-0.5">
                                        <div className="flex items-center gap-2">
                                            <Gauge className="h-3.5 w-3.5 text-muted-foreground/70" />
                                            {editandoCupo ? (
                                                <div className="flex items-center gap-2">
                                                    <span>Hasta</span>
                                                    <StepperCupo value={cupo} onChange={setCupo} />
                                                    <span>por día</span>
                                                    <Button size="sm" disabled={accionMotor} onClick={guardarCupo} className="h-6 px-2.5 rounded-full text-xs">
                                                        {accionMotor ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Listo'}
                                                    </Button>
                                                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => { setEditandoCupo(false); setCupo(campana.cupoDiario) }}>
                                                        Cancelar
                                                    </Button>
                                                </div>
                                            ) : (
                                                <span>
                                                    Ritmo: <strong className="text-foreground font-medium">{campana.cupoDiario} clientes/día</strong>
                                                    {' · '}
                                                    <button onClick={() => setEditandoCupo(true)} className="text-foreground hover:underline font-medium">
                                                        Cambiar
                                                    </button>
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Wallet className="h-3.5 w-3.5 text-muted-foreground/70" />
                                            {campana.modo === 'automatico' ? (
                                                <span>
                                                    Saldo: <strong className={campana.saldoMarketing <= 0 ? 'text-orange-600' : 'text-foreground font-medium'}>{campana.saldoMarketing} mensajes</strong>
                                                    {campana.saldoMarketing <= 0 && (
                                                        <button onClick={onRecargar} className="text-foreground hover:underline ml-1 font-semibold">· Recargar</button>
                                                    )}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">Modo Manual · Sin costo de créditos</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Avisos contextuales sutiles */}
                                    {campana.modo === 'manual' && (
                                        <div className="rounded-xl border border-border/40 bg-background/80 p-3.5 text-xs text-muted-foreground shadow-2xs backdrop-blur-xs">
                                            <span className="font-semibold text-foreground">Modo Manual: </span>
                                            <span>Cada cliente llega con el mensaje de su segmento ya preparado (cupón y link incluidos). Podés cambiar la receta antes de enviar —por ejemplo, cambiar el descuento por un mensaje sin cupón— y después copiarlo y enviarlo desde tu WhatsApp, sin costo de créditos.</span>
                                        </div>
                                    )}

                                    {campana.estado === 'pausada_sin_saldo' && campana.modo === 'automatico' && (
                                        <div className="rounded-xl border border-orange-200/50 bg-orange-50/50 dark:border-orange-950 dark:bg-orange-950/20 p-3.5 text-xs text-orange-900 dark:text-orange-200">
                                            <span className="font-semibold">Créditos de marketing agotados: </span>
                                            <span>Los que enviaste generaron {campana.volvieron} pedidos por {formatCurrency(campana.plataRecuperada)}. Recargá mensajes o cambiá a Modo Manual para seguir sin costo.</span>
                                        </div>
                                    )}

                                    {campana.control > 0 && (
                                        <div className="rounded-xl border border-border/30 bg-muted/20 p-3 text-xs text-muted-foreground">
                                            <span className="font-semibold text-foreground">Atribución honesta: </span>
                                            <span>Contactados al {pct(campana.tasaContactados)} vs Grupo de control al {pct(campana.tasaControl)} ({campana.control} comensales sin contactar). Recompra real generada por el motor.</span>
                                        </div>
                                    )}
                                </div>

                                {/* SECCIÓN 2: DETALLE DEL CLIENTE SELECCIONADO */}
                                <div className="border-t border-border/30 pt-6 space-y-4">
                                    {tab === 'cola' ? (
                                        itemCola ? (
                                            <DetalleColaCliente
                                                token={token}
                                                item={itemCola}
                                                mensaje={mensajeCache[itemCola.id]?.data ?? null}
                                                alDia={mensajeCache[itemCola.id]?.clave === claveMensaje(itemCola.id, decisionesPorFila[itemCola.id])}
                                                decisiones={decisionesPorFila[itemCola.id]}
                                                cargandoMensaje={cargandoMensajeId === itemCola.id || mensajeCache[itemCola.id] === undefined}
                                                marcandoId={marcandoId}
                                                copiadoId={copiadoId}
                                                onCopiar={(txt) => void copiarTexto(txt, itemCola.id)}
                                                onCambiarDecisiones={(d) => cambiarDecisiones(itemCola.id, d)}
                                                onMarcarEnviado={() => void marcarEnviado(itemCola.id, decisionesPorFila[itemCola.id])}
                                            />
                                        ) : (
                                            <EmptyDetail texto="Seleccioná un cliente de la lista para ver su mensaje listo." />
                                        )
                                    ) : tab === 'historial' ? (
                                        itemHistorial ? (
                                            <DetalleHistorialCliente item={itemHistorial} />
                                        ) : (
                                            <EmptyDetail texto="Seleccioná un despacho para consultar su estado y entrega." />
                                        )
                                    ) : (
                                        itemCliente ? (
                                            <DetalleClienteMotor item={itemCliente} />
                                        ) : (
                                            <EmptyDetail texto="Seleccioná un cliente para consultar sus protecciones y métricas." />
                                        )
                                    )}
                                </div>
                            </div>
                        </ScrollArea>
                    </section>
                </div>
            </main>
        </div>
    )
}

// =============================================================================
// SUB-COMPONENTES DEL DETALLE FLOTANTE (ESTILO APPLE)
// =============================================================================

// =============================================================================
// DIÁLOGO DE LAS TRES DECISIONES
//
// El operador decide tres cosas independientes: el SEGMENTO (la voz del mensaje), el TOQUE (el
// trabajo: relato y antojo, recordatorio corto o cierre) y el LINK con su DESCUENTO. La escalera
// sigue siendo la dueña del beneficio: el `%` arranca en el que el cliente ya se ganó y sólo se
// registra como decisión manual si el operador lo toca.
//
// La vista previa sale del MISMO endpoint que alimenta el envío, así que muestra el texto exacto que
// se va a copiar y el `%` exacto que se va a prometer. El cupón se emite al registrar el envío.
// =============================================================================

function DialogoDecisionesRecompra({
    token, item, mensaje, decisiones, onCerrar, onAplicar,
}: {
    token: string | null
    item: ColaRecompraItem
    mensaje: MensajeColaData
    decisiones: DecisionesRecompra | undefined
    onCerrar: () => void
    onAplicar: (decisiones: DecisionesRecompra) => void
}) {
    const opciones = mensaje.opciones
    // El segmento RECALCULADO en vivo (con los pedidos de hoy) es el default del diálogo: la fila se
    // encoló con el segmento de ayer y el cliente pudo cambiar de hábito desde entonces.
    const segmentoVivo = opciones.segmentos.find(s => s.esDelCliente)?.codigo ?? mensaje.segmento
    const [segmento, setSegmento] = useState<Segmento>(decisiones?.segmento ?? segmentoVivo)
    const [toque, setToque] = useState<number>(decisiones?.toque ?? mensaje.toque)
    const [link, setLink] = useState<ModalidadLinkRecompra>(decisiones?.link ?? mensaje.link)
    const [descuento, setDescuento] = useState<number>(decisiones?.descuento ?? opciones.descuentos.recomendado)
    // Sólo cuenta como decisión MANUAL si el operador la eligió: dejarla como venía la registra como
    // el `%` de la escalera, que es la verdad de por qué se mandó ese número.
    const [descuentoAMano, setDescuentoAMano] = useState(decisiones?.descuento != null)
    const [vista, setVista] = useState<MensajeColaData | null>(null)
    const [cargandoVista, setCargandoVista] = useState(true)

    const decisionesPendientes = useMemo<DecisionesRecompra>(() => {
        const siguientes: DecisionesRecompra = { segmento, toque, link }
        if (link === 'reactivacion' && descuentoAMano) siguientes.descuento = descuento
        return siguientes
    }, [segmento, toque, link, descuento, descuentoAMano])

    // Vista previa con debounce: el operador puede escribir el `%` y no queremos una consulta por
    // tecla. El contador de secuencia descarta respuestas que llegan fuera de orden.
    useEffect(() => {
        if (!token) return
        const pedido = decisionesPendientes
        let vigente = true
        setCargandoVista(true)
        const timer = window.setTimeout(() => {
            clientesApi.mensajeColaRecompra(token, item.id, pedido)
                .then(res => {
                    if (!vigente) return
                    setVista(res.success && res.data ? res.data : null)
                })
                .catch(() => { if (vigente) setVista(null) })
                .finally(() => { if (vigente) setCargandoVista(false) })
        }, 220)
        return () => { vigente = false; window.clearTimeout(timer) }
    }, [token, item.id, decisionesPendientes])

    const descuentoEfectivo = link === 'reactivacion' ? descuento : 0
    const sinBeneficio = link === 'reactivacion' && descuentoEfectivo === 0
    const vivoSugerido = opciones.segmentos.find(s => s.esDelCliente)?.codigo

    return (
        <Dialog open onOpenChange={(abierto) => { if (!abierto) onCerrar() }}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Armá el mensaje de {item.clienteNombre}</DialogTitle>
                    <DialogDescription>
                        El segmento elige la voz y el toque elige el trabajo; el link y el descuento van aparte.
                        El beneficio que el cliente ya se ganó por la escalera no se reinicia al cambiar de mensaje.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-1">
                    {/* 1. SEGMENTO — la voz */}
                    <div className="space-y-2">
                        <FilaTitulo icono={<MessageSquare className="h-3.5 w-3.5" />} titulo="Voz del mensaje" detalle="Con qué relato le hablás" />
                        <div className="grid gap-2 sm:grid-cols-2">
                            {opciones.segmentos.map(s => (
                                <button
                                    key={s.codigo}
                                    type="button"
                                    onClick={() => setSegmento(s.codigo)}
                                    className={cn(
                                        "rounded-xl border p-3 text-left transition-colors",
                                        segmento === s.codigo
                                            ? "border-foreground/30 bg-background shadow-2xs"
                                            : "border-border/40 bg-background/50 hover:bg-muted/50",
                                    )}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span className={cn("h-1.5 w-1.5 rounded-full", SEG_META[s.codigo].dot)} />
                                        <span className="text-xs font-semibold text-foreground">{SEG_META[s.codigo].label}</span>
                                        {s.esDelCliente && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                                                <Sparkles className="h-2.5 w-2.5" />
                                                Hoy
                                            </span>
                                        )}
                                        {segmento === s.codigo && <Check className="ml-auto h-3 w-3 text-foreground" />}
                                    </div>
                                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground/70">{s.nombre}</p>
                                </button>
                            ))}
                        </div>
                        {vivoSugerido && vivoSugerido !== segmento && (
                            <p className="text-[11px] leading-snug text-muted-foreground/70">
                                La campaña lo clasificó como <span className="font-semibold text-foreground">{SEG_META[item.segmento].label}</span>{' '}
                                y hoy se reclasificaría como <span className="font-semibold text-foreground">{SEG_META[vivoSugerido].label}</span>.
                            </p>
                        )}
                    </div>

                    {/* 2. TOQUE — el trabajo del mensaje */}
                    <div className="space-y-2">
                        <FilaTitulo icono={<Clock className="h-3.5 w-3.5" />} titulo="Toque del goteo" detalle="Qué trabajo hace el mensaje" />
                        <div className="grid gap-2 sm:grid-cols-3">
                            {opciones.toques.map(t => (
                                <button
                                    key={t.toque}
                                    type="button"
                                    onClick={() => setToque(t.toque)}
                                    className={cn(
                                        "rounded-xl border p-3 text-left transition-colors",
                                        toque === t.toque
                                            ? "border-foreground/30 bg-background shadow-2xs"
                                            : "border-border/40 bg-background/50 hover:bg-muted/50",
                                    )}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-semibold text-foreground">{t.titulo}</span>
                                        {t.esDeLaEscalera && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                                                Le toca
                                            </span>
                                        )}
                                        {toque === t.toque && <Check className="ml-auto h-3 w-3 text-foreground" />}
                                    </div>
                                    <p className="mt-1 text-[11px] font-medium text-muted-foreground">{t.descripcion}</p>
                                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground/70">
                                        {t.descuento > 0
                                            ? `En este escalón la escalera da ${t.descuento}%${t.expiraHoras != null ? ` · vence en ${t.expiraHoras} hs` : ''}`
                                            : 'En este escalón no hay descuento'}
                                        {t.toque === 1 ? ' · con foto del producto' : ' · sin encabezado'}
                                    </p>
                                </button>
                            ))}
                        </div>
                        <p className="text-[11px] leading-snug text-muted-foreground/70">
                            El toque elige el texto, no el avance: el nivel del cliente sigue donde estaba.
                        </p>
                    </div>

                    {/* 3. LINK + DESCUENTO — lo que el cliente ve al tocar */}
                    <div className="space-y-2">
                        <FilaTitulo icono={<ExternalLink className="h-3.5 w-3.5" />} titulo="A dónde entra" detalle="Cómo abre la tienda" />
                        <div className="grid gap-2 sm:grid-cols-2">
                            {opciones.links.map(l => (
                                <button
                                    key={l.modalidad}
                                    type="button"
                                    onClick={() => setLink(l.modalidad)}
                                    className={cn(
                                        "rounded-xl border p-3 text-left transition-colors",
                                        link === l.modalidad
                                            ? "border-foreground/30 bg-background shadow-2xs"
                                            : "border-border/40 bg-background/50 hover:bg-muted/50",
                                    )}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-semibold text-foreground">{l.titulo}</span>
                                        {link === l.modalidad && <Check className="ml-auto h-3 w-3 text-foreground" />}
                                    </div>
                                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground/70">{l.descripcion}</p>
                                </button>
                            ))}
                        </div>

                        {link === 'reactivacion' ? (
                            <div className="rounded-xl border border-border/40 bg-muted/20 p-3 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                                        Descuento
                                    </span>
                                    {opciones.descuentos.sugeridos.map(s => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => { setDescuento(s); setDescuentoAMano(true) }}
                                            className={cn(
                                                "h-7 rounded-full px-3 text-xs font-medium transition-colors",
                                                descuentoEfectivo === s
                                                    ? "bg-foreground text-background"
                                                    : "bg-background text-muted-foreground hover:text-foreground shadow-2xs",
                                            )}
                                        >
                                            {s}%
                                        </button>
                                    ))}
                                    <div className="ml-auto flex items-center gap-1.5">
                                        <Input
                                            type="number"
                                            min={0}
                                            max={opciones.descuentos.max}
                                            value={descuento}
                                            onChange={(e) => {
                                                const n = Number(e.target.value)
                                                setDescuento(Number.isFinite(n) ? Math.min(Math.max(Math.trunc(n), 0), opciones.descuentos.max) : 0)
                                                setDescuentoAMano(true)
                                            }}
                                            className="h-7 w-16 rounded-full text-center text-xs"
                                        />
                                        <span className="text-xs text-muted-foreground">%</span>
                                    </div>
                                </div>
                                <p className="text-[11px] leading-snug text-muted-foreground/70">
                                    {descuentoAMano
                                        ? `Lo elegís vos (el rango es ${opciones.descuentos.min}–${opciones.descuentos.max}%).`
                                        : `Es el que ya se ganó por la escalera (nivel ${mensaje.nivel}).`}
                                    {descuentoEfectivo > 0 && (vista?.expiraHoras ?? mensaje.expiraHoras) != null
                                        ? ` Vence en ${vista?.expiraHoras ?? mensaje.expiraHoras} hs.`
                                        : ''}
                                    {' '}El cliente no tipea ningún código.
                                </p>
                                {sinBeneficio && (
                                    <p className="text-[11px] leading-snug text-amber-600 dark:text-amber-400">
                                        Con 0% el link abre igual, pero la tienda no muestra ningún beneficio: para eso está «volver a pedir lo mismo».
                                    </p>
                                )}
                            </div>
                        ) : (
                            <p className="text-[11px] leading-snug text-muted-foreground/70">
                                «Volver a pedir lo mismo» no lleva descuento: abre su último pedido ya cargado.
                            </p>
                        )}
                    </div>

                    {/* 4. VISTA PREVIA — el mismo texto que se copia */}
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <FilaTitulo icono={<Ticket className="h-3.5 w-3.5" />} titulo="Vista previa" detalle="Lo que se manda, tal cual" />
                            {vista && (
                                <span className="font-mono text-[10px] text-muted-foreground/70">
                                    {vista.plantillaWhatsapp}{vista.conImagen ? ' · con foto' : ' · sin encabezado'}
                                </span>
                            )}
                        </div>
                        {cargandoVista ? (
                            <div className="space-y-2 rounded-2xl bg-muted/20 p-4">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-1/2" />
                            </div>
                        ) : vista?.texto ? (
                            <div className="rounded-2xl border border-border/30 bg-white dark:bg-muted/30 p-4 text-xs font-sans leading-relaxed text-foreground whitespace-pre-wrap break-words [overflow-wrap:anywhere] select-all shadow-2xs">
                                {vista.texto}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-border/30 bg-muted/20 p-4 text-xs text-muted-foreground">
                                No se pudo previsualizar esa combinación. Probá con otro toque o segmento.
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="ghost" onClick={onCerrar}>Cancelar</Button>
                    <Button onClick={() => onAplicar(decisionesPendientes)} disabled={!vista} className="gap-2">
                        <Check className="h-4 w-4" />
                        Usar este mensaje
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function FilaTitulo({ icono, titulo, detalle }: { icono: React.ReactNode; titulo: string; detalle: string }) {
    return (
        <div className="flex items-baseline gap-2">
            <span className="text-muted-foreground/70">{icono}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">{titulo}</span>
            <span className="text-[11px] text-muted-foreground/60">{detalle}</span>
        </div>
    )
}

function DetalleColaCliente({
    token,
    item,
    mensaje,
    alDia,
    decisiones,
    cargandoMensaje,
    marcandoId,
    copiadoId,
    onCopiar,
    onCambiarDecisiones,
    onMarcarEnviado,
}: {
    token: string | null
    item: ColaRecompraItem
    mensaje: MensajeColaData | null
    /** false mientras se regenera el mensaje con las decisiones recién elegidas. */
    alDia: boolean
    /** Decisiones elegidas a mano (undefined = las que propone el motor). */
    decisiones: DecisionesRecompra | undefined
    cargandoMensaje: boolean
    marcandoId: number | null
    copiadoId: number | null
    onCopiar: (txt: string) => void
    onCambiarDecisiones: (decisiones: DecisionesRecompra | null) => void
    onMarcarEnviado: () => void
}) {
    const meta = SEG_META[item.segmento]
    const [dialogoAbierto, setDialogoAbierto] = useState(false)

    const listo = !!mensaje?.texto && alDia
    // Mientras llega el mensaje mostramos el toque planificado de la fila: nunca menos de lo que la
    // fila ya sabe de sí misma.
    const toque = mensaje?.toque ?? item.toque
    const badgeToque = etiquetaToque(toque)
    const descuentoVisible = mensaje?.descuento ?? 0

    return (
        <div className="space-y-5">
            {/* Cabecera del cliente */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted/80 text-sm font-semibold tracking-tight text-foreground">
                        {iniciales(item.clienteNombre || 'Cliente')}
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                                {item.clienteNombre}
                            </h2>
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background/80 px-2.5 py-0.5 text-xs font-medium text-foreground backdrop-blur-xs">
                                <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                                {meta.label}
                            </span>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                                {item.poblacion === 'flujo' ? 'Flujo nuevo' : 'Stock'}
                            </span>
                            {badgeToque && (
                                <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold text-background uppercase tracking-wider">
                                    {badgeToque}{descuentoVisible > 0 ? ` · ${descuentoVisible}%` : ''}
                                </span>
                            )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground/80">
                            {item.telefono ? `${item.telefono} · ` : ''}Prioridad #{item.posicionPrioridad} en cola
                        </p>
                    </div>
                </div>
            </div>

            {/* Metadatos de recomendación */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
                {(mensaje?.horarioSugerido ?? item.horarioSugerido) && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-xs">
                        <Clock className="h-3 w-3 text-muted-foreground/70" />
                        <span>Recomendado: {mensaje?.horarioSugerido ?? item.horarioSugerido}</span>
                    </span>
                )}
                {mensaje && (mensaje.codigoDescuento ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-xs">
                        <Ticket className="h-3 w-3 text-muted-foreground/70" />
                        <span className="font-mono text-foreground font-semibold">{mensaje.codigoDescuento}</span>
                        <span>({mensaje.descuento}% OFF)</span>
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-xs">
                        <Ticket className="h-3 w-3 text-muted-foreground/70" />
                        <span>Sin descuento: no se emite cupón</span>
                    </span>
                ))}
            </div>

            {/* Las tres decisiones: mensaje (segmento × toque), link y descuento */}
            <div className="rounded-2xl border border-border/30 bg-muted/20 p-3.5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                            Mensaje, link y descuento
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {mensaje ? (
                                <>
                                    Va el <span className="font-semibold text-foreground">{badgeToque ?? 'mensaje del motor'}</span>
                                    {' '}con el relato de <span className="font-semibold text-foreground">{SEG_META[mensaje.segmento].label}</span>
                                    {mensaje.link === 'reactivacion'
                                        ? <> y el link abre la tienda con <span className="font-semibold text-foreground">{descuentoVisible > 0 ? `${descuentoVisible}% OFF` : 'sin descuento'}</span>.</>
                                        : <> y el link abre su último pedido tal como estaba.</>}
                                </>
                            ) : (
                                'Preparando el mensaje…'
                            )}
                        </p>
                        {mensaje && (
                            <p className="mt-1 text-[11px] leading-snug text-muted-foreground/70">
                                {mensaje.descuentoOrigen === 'manual'
                                    ? `El ${mensaje.descuento}% lo elegiste vos.`
                                    : mensaje.descuento > 0
                                        ? `El ${mensaje.descuento}% es el que ya se ganó por la escalera (nivel ${mensaje.nivel}).`
                                        : 'Sin descuento: no se emite cupón.'}
                                {mensaje.descuento > 0 && mensaje.expiraHoras != null ? ` Vence en ${mensaje.expiraHoras} hs.` : ''}
                            </p>
                        )}
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!mensaje || !alDia}
                        onClick={() => setDialogoAbierto(true)}
                        className="h-7 shrink-0 rounded-full px-3 text-xs font-medium border-border/60 bg-background/80 hover:bg-muted/50 gap-1.5"
                    >
                        <Repeat2 className="h-3 w-3" />
                        Cambiar mensaje
                    </Button>
                </div>

                {/* El operador se fue del default del motor: que se vea y que se pueda volver. */}
                {decisiones && (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-muted-foreground">
                        <span>Estás usando decisiones a mano: ni el mensaje ni el link son los que propone el motor.</span>
                        <button
                            type="button"
                            onClick={() => onCambiarDecisiones(null)}
                            className="font-semibold text-foreground underline underline-offset-2"
                        >
                            Volver a lo que propone el motor
                        </button>
                    </div>
                )}

                {/* El toque de la fila es el que la campaña planificó; mandar otro es válido, pero explícito. */}
                {mensaje?.toquePlanificado != null && mensaje.toque !== mensaje.toquePlanificado && (
                    <p className="text-[11px] leading-snug text-muted-foreground/70">
                        La fila venía planificada como {etiquetaToque(mensaje.toquePlanificado)} y estás mandando el{' '}
                        {etiquetaToque(mensaje.toque)}: cambia el texto, no el nivel del cliente.
                    </p>
                )}
            </div>

            {/* Diálogo: las tres decisiones + vista previa del texto final */}
            {dialogoAbierto && mensaje && (
                <DialogoDecisionesRecompra
                    token={token}
                    item={item}
                    mensaje={mensaje}
                    decisiones={decisiones}
                    onCerrar={() => setDialogoAbierto(false)}
                    onAplicar={(elegidas) => { onCambiarDecisiones(elegidas); setDialogoAbierto(false) }}
                />
            )}

            {/* Mensaje preparado para enviar */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                        Mensaje sugerido para WhatsApp{mensaje ? ` · ${badgeToque ?? 'toque 1'}` : ''}
                        {mensaje && !mensaje.conImagen ? ' · sin encabezado' : ''}
                    </span>
                    {listo && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onCopiar(mensaje!.texto)}
                            className="h-6 px-2 rounded-full text-xs text-muted-foreground hover:text-foreground gap-1"
                        >
                            {copiadoId === item.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            <span>{copiadoId === item.id ? 'Copiado' : 'Copiar'}</span>
                        </Button>
                    )}
                </div>

                {cargandoMensaje || (!alDia && !!mensaje) ? (
                    <div className="space-y-2 p-4 rounded-2xl bg-white/60 dark:bg-muted/20">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-1/2" />
                    </div>
                ) : mensaje?.texto ? (
                    <div className="rounded-2xl border border-border/30 bg-white dark:bg-muted/30 p-4 text-xs font-sans leading-relaxed text-foreground whitespace-pre-wrap break-words [overflow-wrap:anywhere] select-all shadow-2xs">
                        {mensaje.texto}
                    </div>
                ) : (
                    <div className="p-4 text-xs text-muted-foreground">
                        No se pudo previsualizar el mensaje.
                    </div>
                )}
            </div>

            {/* Acciones operativas estilo Apple */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
                {listo && mensaje?.waMeUrl && (
                    <Button
                        type="button"
                        onClick={() => window.open(mensaje.waMeUrl!, '_blank')}
                        className="h-9 rounded-full px-5 text-xs font-medium bg-foreground text-background hover:bg-foreground/90 shadow-2xs gap-1.5"
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Abrir en WhatsApp
                    </Button>
                )}

                {listo && (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onCopiar(mensaje!.texto)}
                        className="h-9 rounded-full px-4 text-xs font-medium border-border/60 bg-background/80 hover:bg-muted/50 shadow-2xs gap-1.5"
                    >
                        {copiadoId === item.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiadoId === item.id ? 'Copiado' : 'Copiar mensaje'}
                    </Button>
                )}

                <Button
                    type="button"
                    variant="secondary"
                    disabled={marcandoId === item.id || !listo}
                    onClick={onMarcarEnviado}
                    className="h-9 rounded-full px-4 text-xs font-medium shadow-2xs gap-1.5 ml-auto"
                >
                    {marcandoId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
                    Marcar como enviado
                </Button>
            </div>
        </div>
    )
}

function DetalleHistorialCliente({ item }: { item: HistorialRecompraItem }) {
    const meta = SEG_META[item.segmento]

    return (
        <div className="space-y-5">
            <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted/80 text-sm font-semibold tracking-tight text-foreground">
                    {iniciales(item.clienteNombre || 'Cliente')}
                </div>
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                            {item.clienteNombre}
                        </h2>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background/80 px-2.5 py-0.5 text-xs font-medium text-foreground backdrop-blur-xs">
                            <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                            {meta.label}
                        </span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
                            {item.estadoDespacho === 'entregado' ? 'Entregado' : 'Fallido'}
                        </span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
                            {item.poblacion === 'flujo' ? 'Flujo' : 'Stock'}
                        </span>
                        {etiquetaToque(item.toque) && (
                            <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold text-background uppercase tracking-wider">
                                {resumenEnvio(item.toque, item.descuentoEnviado)}
                            </span>
                        )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground/80">
                        {item.telefono ? `${item.telefono} · ` : ''}Enviado el {formatDateTime(item.fechaHora)}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-y border-border/30 py-4 sm:grid-cols-4">
                <FloatingMetric label="Origen" value={item.origenContacto === 'automatico' ? 'Goteo' : 'Manual'} />
                <FloatingMetric label="Toque" value={etiquetaToque(item.toque) ?? 'Sin dato'} />
                <FloatingMetric label="Cupón" value={item.codigoDescuento ?? 'Sin cupón'} />
                <FloatingMetric
                    label="A dónde entró"
                    value={item.linkModalidad === 'reactivacion' ? 'Con descuento' : item.linkModalidad === 'lo-mismo' ? 'Lo mismo' : 'Sin dato'}
                />
            </div>

            {item.errorEnvio && (
                <div className="rounded-xl border border-rose-200/50 bg-rose-50/50 dark:bg-rose-950/20 p-3.5 text-xs text-rose-800 dark:text-rose-300">
                    <span className="font-semibold">Detalle de error: </span>
                    <span>{item.errorEnvio}</span>
                </div>
            )}
        </div>
    )
}

function DetalleClienteMotor({ item }: { item: ClienteMotorRecompra }) {
    const meta = SEG_META[item.segmento]

    return (
        <div className="space-y-5">
            <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted/80 text-sm font-semibold tracking-tight text-foreground">
                    {iniciales(item.clienteNombre || 'Cliente')}
                </div>
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                            {item.clienteNombre}
                        </h2>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background/80 px-2.5 py-0.5 text-xs font-medium text-foreground backdrop-blur-xs">
                            <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                            {meta.label}
                        </span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
                            {item.rol === 'control' ? 'Control' : 'Contactable'}
                        </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground/80">
                        {item.telefono ? `${item.telefono} · ` : ''}Estado: {item.estado}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-y border-border/30 py-4 sm:grid-cols-3">
                <FloatingMetric label="Ticket promedio" value={formatCurrency(item.ticketPromedio)} />
                <FloatingMetric label="Último pedido" value={formatDateTime(item.ultimoPedidoAt)} />
                <FloatingMetric label="Score prioridad" value={item.prioridad.toLocaleString('es-AR')} />
            </div>

            {/* Recorrido del goteo: los toques van 1 → 2 → 3 y este cliente está en alguno de ellos. */}
            <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                    Recorrido del goteo
                </span>
                <div className="flex flex-wrap gap-2 pt-1">
                    {[1, 2, 3].map(n => {
                        const enviado = n <= item.toquesDesdeUltimoPedido
                        const enCola = item.toque === n
                        return (
                            <span
                                key={n}
                                className={cn(
                                    "rounded-full px-2.5 py-0.5 text-xs font-medium",
                                    enviado
                                        ? "bg-foreground text-background"
                                        : enCola
                                            ? "bg-muted text-foreground ring-1 ring-border/60"
                                            : "bg-muted/50 text-muted-foreground/70",
                                )}
                            >
                                {etiquetaToque(n)}{enviado ? ' · enviado' : enCola ? ' · en cola' : ''}
                            </span>
                        )
                    })}
                </div>
                <p className="text-[11px] leading-snug text-muted-foreground/70">
                    {item.toquesDesdeUltimoPedido === 0
                        ? 'Todavía no recibió ningún toque desde su último pedido.'
                        : `Recibió ${item.toquesDesdeUltimoPedido} ${item.toquesDesdeUltimoPedido === 1 ? 'toque' : 'toques'} desde su último pedido.`}
                    {item.rol === 'control' ? ' Está en el grupo de control: no se lo contacta.' : ''}
                </p>
            </div>

            <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                    Protecciones activas
                </span>
                <div className="flex flex-wrap gap-2 pt-1">
                    {item.protecciones.optOut && (
                        <span className="rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                            Opt-out
                        </span>
                    )}
                    {item.protecciones.cooldownHasta && (
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                            Cooldown activo
                        </span>
                    )}
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        {item.protecciones.toques30Dias}/{item.protecciones.maximoToques30Dias} toques en 30 días
                    </span>
                    {!item.protecciones.optOut && !item.protecciones.cooldownHasta && (
                        <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            Disponible para contactar
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}

// =============================================================================
// SUB-COMPONENTES DE FILAS FLOTANTES (ESTILO CLIENTROW EN CLIENTES.TSX)
// =============================================================================

function RowCola({ item, selected, onClick }: { item: ColaRecompraItem; selected: boolean; onClick: () => void }) {
    const meta = SEG_META[item.segmento]

    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "flex w-full items-center gap-3 rounded-xl border-0 p-3 text-left transition-colors",
                selected
                    ? "border-l-[3px] border-l-primary bg-muted/40 shadow-2xs"
                    : "bg-white hover:bg-muted/40 dark:bg-muted/20 shadow-2xs"
            )}
        >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground">
                {iniciales(item.clienteNombre || 'Cliente')}
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{item.clienteNombre}</p>
                    <span className="text-[10px] font-mono text-muted-foreground/60 shrink-0">#{item.posicionPrioridad}</span>
                </div>

                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                    <span>{meta.label}</span>
                    {item.toque != null && (
                        <>
                            <span>·</span>
                            <span className="font-medium text-foreground">{etiquetaToque(item.toque)}</span>
                        </>
                    )}
                    <span>·</span>
                    <span>{item.horarioSugerido ?? formatDay(item.fechaProyectada)}</span>
                </div>
            </div>

            <ChevronRightIcon className={cn("h-4 w-4 shrink-0", selected ? "text-primary" : "text-muted-foreground/30")} />
        </button>
    )
}

function RowHistorial({ item, selected, onClick }: { item: HistorialRecompraItem; selected: boolean; onClick: () => void }) {
    const meta = SEG_META[item.segmento]

    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "flex w-full items-center gap-3 rounded-xl border-0 p-3 text-left transition-colors",
                selected
                    ? "border-l-[3px] border-l-primary bg-muted/40 shadow-2xs"
                    : "bg-white hover:bg-muted/40 dark:bg-muted/20 shadow-2xs"
            )}
        >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground">
                {iniciales(item.clienteNombre || 'Cliente')}
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{item.clienteNombre}</p>
                    <span className="text-[10px] text-muted-foreground/70 shrink-0">
                        {item.estadoDespacho === 'entregado' ? 'Entregado' : 'Falló'}
                    </span>
                </div>

                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                    <span>{meta.label}</span>
                    {item.toque != null && (
                        <>
                            <span>·</span>
                            <span className="font-medium text-foreground">{resumenEnvio(item.toque, item.descuentoEnviado)}</span>
                        </>
                    )}
                    <span>·</span>
                    <span>{formatDateTime(item.fechaHora)}</span>
                </div>
            </div>

            <ChevronRightIcon className={cn("h-4 w-4 shrink-0", selected ? "text-primary" : "text-muted-foreground/30")} />
        </button>
    )
}

function RowCliente({ item, selected, onClick }: { item: ClienteMotorRecompra; selected: boolean; onClick: () => void }) {
    const meta = SEG_META[item.segmento]

    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "flex w-full items-center gap-3 rounded-xl border-0 p-3 text-left transition-colors",
                selected
                    ? "border-l-[3px] border-l-primary bg-muted/40 shadow-2xs"
                    : "bg-white hover:bg-muted/40 dark:bg-muted/20 shadow-2xs"
            )}
        >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground">
                {iniciales(item.clienteNombre || 'Cliente')}
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{item.clienteNombre}</p>
                    <span className="text-[10px] text-muted-foreground/60 shrink-0">
                        {item.rol === 'control' ? 'Control' : 'Contactable'}
                    </span>
                </div>

                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                    <span>{meta.label}</span>
                    <span>·</span>
                    <span>Ticket {formatCurrency(item.ticketPromedio)}</span>
                </div>
            </div>

            <ChevronRightIcon className={cn("h-4 w-4 shrink-0", selected ? "text-primary" : "text-muted-foreground/30")} />
        </button>
    )
}

// =============================================================================
// SUB-COMPONENTES AUXILIARES
// =============================================================================

function TabPill({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition-colors shrink-0",
                active
                    ? "bg-foreground text-background shadow-2xs"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
        >
            {icon}
            <span>{children}</span>
        </button>
    )
}

function FloatingMetric({ label, value, sublabel }: { label: string; value: string | number; sublabel?: string }) {
    return (
        <div className="flex flex-col">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">{label}</span>
            <span className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-foreground sm:text-3xl">{value}</span>
            {sublabel && <span className="mt-0.5 text-[11px] text-muted-foreground">{sublabel}</span>}
        </div>
    )
}

function EstadoBadge({ estado }: { estado: EstadoCampana }) {
    const map: Record<EstadoCampana, { label: string; dot: string }> = {
        activa: { label: 'Activo', dot: 'bg-emerald-500' },
        completada: { label: 'Automático', dot: 'bg-emerald-500' },
        pausada_manual: { label: 'Pausado', dot: 'bg-muted-foreground' },
        pausada_sin_saldo: { label: 'Pausado sin saldo', dot: 'bg-orange-500' },
    }
    const m = map[estado]
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background/80 px-2.5 py-1 text-xs font-medium text-foreground backdrop-blur-xs">
            <span className={cn("h-1.5 w-1.5 rounded-full", m.dot, estado === 'activa' && "animate-pulse")} />
            {m.label}
        </span>
    )
}

function StepperCupo({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    const clamp = (v: number) => Math.max(CUPO_MIN, Math.min(CUPO_MAX, v))
    return (
        <div className="inline-flex items-center rounded-full border border-border/60 bg-background shadow-2xs">
            <button className="w-6 h-6 text-muted-foreground hover:text-foreground disabled:opacity-40" disabled={value <= CUPO_MIN} onClick={() => onChange(clamp(value - 5))}>−</button>
            <span className="w-7 text-center text-xs font-semibold text-foreground tabular-nums">{value}</span>
            <button className="w-6 h-6 text-muted-foreground hover:text-foreground disabled:opacity-40" disabled={value >= CUPO_MAX} onClick={() => onChange(clamp(value + 5))}>+</button>
        </div>
    )
}

function EmptyList({ texto, subtexto }: { texto: string; subtexto: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <Users className="h-8 w-8 text-muted-foreground/30 mb-2.5" />
            <p className="text-sm font-medium text-foreground">{texto}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{subtexto}</p>
        </div>
    )
}

function EmptyDetail({ texto }: { texto: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <User className="h-8 w-8 text-muted-foreground/30 mb-2.5" />
            <p className="text-sm font-medium text-foreground">Ningún cliente seleccionado</p>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">{texto}</p>
        </div>
    )
}

// =============================================================================
// APAGADO — EL PLAN DE ENCENDIDO (ESTILO APPLE)
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
                if (res.data?.vacio) toast.info('No hay clientes para recuperar en este momento')
                else toast.success(modo === 'automatico' ? 'Motor de recompra encendido en automático.' : 'Motor encendido en modo manual.')
                onActivado()
            }
        } catch (err) {
            if (err instanceof ApiError && err.status === 403 && err.response?.upgradeRequired) {
                toast.error('Activá el módulo Retención para usarlo')
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
            <div className="text-center py-20">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-7 h-7 text-foreground" />
                </div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">Tu base está al día</h2>
                <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto">
                    No hay clientes enfriados para recuperar en este momento. Cuando alguno baje su ritmo habitual,
                    el motor lo detectará solo.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-border/40 bg-white/80 dark:bg-muted/30 p-6 shadow-2xs backdrop-blur-xs">
                <p className="text-base leading-relaxed text-foreground">
                    Encontré <strong className="font-semibold">{plan.totalDetectados} clientes</strong> que se enfriaron
                    {plan.porSegmento.length > 0 && (
                        <>: {plan.porSegmento.map((s, i) => (
                            <span key={s.segmento}>
                                {i > 0 && (i === plan.porSegmento.length - 1 ? ' y ' : ', ')}
                                <span className="font-medium">{s.detectados} {SEG_META[s.segmento].label.toLowerCase()}</span>
                            </span>
                        ))}</>
                    )}.
                    {primer && (
                        <> Propongo arrancar por los <strong className="font-semibold">{primerCount} {primer.label.toLowerCase()}</strong> a un ritmo de <strong className="font-semibold">hasta {cupo} por día</strong>, priorizando mayor ticket histórico.</>
                    )}
                </p>

                {/* Ajuste de ritmo */}
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Gauge className="w-4 h-4 text-muted-foreground/70" />
                    {editandoCupo ? (
                        <div className="flex items-center gap-2">
                            <span>Hasta</span>
                            <StepperCupo value={cupo} onChange={setCupo} />
                            <span>por día</span>
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setEditandoCupo(false)}>Listo</Button>
                        </div>
                    ) : (
                        <span>
                            Enviando hasta <span className="font-medium text-foreground">{cupo}/día</span>
                            {' · '}
                            <button onClick={() => setEditandoCupo(true)} className="text-foreground hover:underline font-medium">Cambiar</button>
                        </span>
                    )}
                </div>

                {/* Selector de modo */}
                <div className="mt-6 pt-5 border-t border-border/30">
                    <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">Modalidad de envío</p>
                    <div className="grid sm:grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => setModo('automatico')}
                            className={cn(
                                "text-left p-4 rounded-xl border transition-all",
                                modo === 'automatico'
                                    ? "border-foreground bg-foreground/5 ring-1 ring-foreground"
                                    : "border-border/60 bg-muted/20 hover:border-border"
                            )}
                        >
                            <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
                                <Bot className="w-4 h-4" />
                                Modo Automático
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                El motor envía los mensajes solo según el cupo diario. Consume créditos de marketing.
                            </p>
                        </button>

                        <button
                            type="button"
                            onClick={() => setModo('manual')}
                            className={cn(
                                "text-left p-4 rounded-xl border transition-all",
                                modo === 'manual'
                                    ? "border-foreground bg-foreground/5 ring-1 ring-foreground"
                                    : "border-border/60 bg-muted/20 hover:border-border"
                            )}
                        >
                            <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
                                <MessageSquare className="w-4 h-4" />
                                Modo Manual
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                El motor arma los mensajes con cupón. Vos los enviás por WhatsApp sin costo de créditos.
                            </p>
                        </button>
                    </div>
                </div>

                <Button
                    onClick={() => setConfirmOpen(true)}
                    size="lg"
                    className="mt-6 h-11 px-6 rounded-full text-sm font-medium shadow-2xs gap-2"
                >
                    <Zap className="w-4 h-4" /> Activar motor {modo === 'manual' ? '(Manual)' : '(Automático)'}
                </Button>
            </div>

            {/* Diálogo de confirmación */}
            <Dialog open={confirmOpen} onOpenChange={(o) => !activando && setConfirmOpen(o)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Encender el motor de recompra</DialogTitle>
                        <DialogDescription>
                            {modo === 'automatico'
                                ? `El motor contactará hasta ${cupo} clientes por día de forma automática. Podés pausarlo cuando quieras.`
                                : `El motor preparará la cola de hasta ${cupo} clientes diarios para que los envíes manualmente.`}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={activando}>Cancelar</Button>
                        <Button onClick={activar} disabled={activando} className="gap-2">
                            {activando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                            Confirmar activación
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function PlanBloqueado() {
    return (
        <div className="text-center py-20">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Crown className="w-7 h-7 text-foreground" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">Activá Retención</h2>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto leading-relaxed">
                Convertí tu base de clientes en recompra automática: detección de ritmo habitual, mensajes personalizados
                goteados y atribución con grupo de control.
            </p>
        </div>
    )
}
