import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useAuthStore } from '@/store/authStore'
import {
    clientesApi,
    ApiError,
    type ColaRecompraItem,
    type ConfigMotorRecompra,
    type DashboardRecompra,
    type DecisionesRecompra,
    type EstadoMotorLocal,
    type HistorialRecompraItem,
    type ModalidadLinkRecompra,
    type PaginadoRecompra,
    type PlanActivacionRecompra,
    type ModoRecompra,
    type MensajeColaData,
    type ProgramacionResumen,
} from '@/lib/api'
import { toast } from 'sonner'
import {
    Users, Loader2, CheckCircle2, Zap, Crown, Gauge, Wallet,
    Pause, Play, ListOrdered, History, Clock, CircleHelp,
    RefreshCw, Copy, Check, ExternalLink, Bot, MessageSquare,
    Search, X, ArrowLeft, User, Ticket, CheckCheck, ChevronRight as ChevronRightIcon,
    Repeat2, SlidersHorizontal, CalendarClock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ModuloComercial } from '@/components/ModuloComercial'
import {
    SEG_META, etiquetaSegmento, formatCurrency, formatDateTime,
    type Segmento,
} from './clientes/motor/comun'
import { Campo, ChipOpcion, Marca } from './clientes/motor/controles'
import PanelProgramaciones, { PantallaProgramacion } from './clientes/motor/PanelProgramaciones'
import DialogoProgramarEnvio from './clientes/motor/DialogoProgramarEnvio'
import DialogoConfigMotor from './clientes/motor/DialogoConfigMotor'

// =============================================================================
// MOTOR DE RECOMPRA · TANDAS PROGRAMADAS
//
// El motor ya no se enciende y gotea solo: el dueño PROGRAMA una tanda (a quiénes, cuántos, hasta qué
// toque y cada cuánto) y el backend agenda esos envíos con su día y su hora. Esta pantalla es la cola
// del local —lo que está por salir y lo que ya salió— más el acceso a programar la próxima tanda.
//
// Estilo Apple minimalista, componentes flotantes sobre fondo cálido,
// métricas numéricas grandes sin cajas duras ni neon, listado a la izquierda
// y motor + detalle del cliente a la derecha.
// =============================================================================

type ObservabilidadTab = 'cola' | 'historial'
type MobileView = 'lista' | 'detalle'

type Plan = PlanActivacionRecompra
type Dashboard = DashboardRecompra
type EstadoMotor = {
    activa: boolean
    config: ConfigMotorRecompra
    campana: Dashboard | null
    programaciones: ProgramacionResumen[]
    plan: Plan
    saldoMarketing: number
}

/** Clave del mensaje cacheado: una entrada por (fila, decisiones del operador). */
function claveMensaje(filaId: number, decisiones: DecisionesRecompra | undefined): string {
    if (!decisiones) return `${filaId}:motor`
    const { segmento, toque, link, descuento } = decisiones
    return `${filaId}:${segmento ?? 'vivo'}:${toque ?? 'escalera'}:${link ?? 'auto'}:${descuento ?? 'auto'}`
}

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

/**
 * El link a la tienda es larguísimo (base + slug + token cifrado) y en la vista previa se comía
 * media pantalla. Se muestra el arranque y el resto se corta con puntos suspensivos, cortando en el
 * borde de un path o de la query y nunca en medio de una palabra. El link entero no se pierde: la
 * vista previa lo pone en el `href` y en el `title`.
 */
function acortarUrl(url: string, max = 52): string {
    if (url.length <= max) return url
    const borde = Math.max(url.lastIndexOf('/', max), url.lastIndexOf('?', max))
    return `${url.slice(0, borde > 24 ? borde : max)}…`
}

const pct = (v: number) => `${Math.round(v * 100)}%`

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
            const res = await clientesApi.recompraEstado(token)
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
                <PlanBloqueado onCambioEstado={cargar} />
            </div>
        )
    }

    // Con tandas vivas la pantalla es el tablero: lo que está programado y cómo viene. Sin tandas es
    // el universo disponible y el asistente para programar la primera. El `plan` viene siempre, así
    // que la pantalla nunca queda en blanco.
    if (estado?.activa && estado.campana) {
        return (
            <PantallaEncendido
                campana={estado.campana}
                config={estado.config}
                programaciones={estado.programaciones}
                onCambio={cargar}
                onRecargar={() => navigate('/dashboard/mensajes')}
            />
        )
    }

    if (estado?.plan) {
        return (
            <ScrollArea className="h-full">
                <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
                    <PantallaProgramacion
                        plan={estado.plan}
                        config={estado.config}
                        onCambio={cargar}
                        onRecargar={() => navigate('/dashboard/mensajes')}
                    />
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
function PantallaEncendido({ campana, config, programaciones, onCambio, onRecargar }: {
    campana: Dashboard
    config: ConfigMotorRecompra
    programaciones: ProgramacionResumen[]
    onCambio: () => void
    onRecargar: () => void
}) {
    const token = useAuthStore(state => state.token)

    // Navegación responsive
    const [mobileView, setMobileView] = useState<MobileView>('lista')
    const [tab, setTab] = useState<ObservabilidadTab>('cola')
    const [pagina, setPagina] = useState(1)
    const [segmento, setSegmento] = useState<string>('todos')
    /** `'todas'` o el id de una tanda: la cola del local se puede mirar entera o tanda por tanda. */
    const [campanaFiltro, setCampanaFiltro] = useState<number | 'todas'>('todas')
    const [query, setQuery] = useState('')

    // Observabilidad
    const [loadingObservabilidad, setLoadingObservabilidad] = useState(true)
    const [cola, setCola] = useState<PaginadoRecompra<ColaRecompraItem> | null>(null)
    const [historial, setHistorial] = useState<PaginadoRecompra<HistorialRecompraItem> | null>(null)

    // Selección
    const [selectedColaId, setSelectedColaId] = useState<number | null>(null)
    const [selectedHistorialId, setSelectedHistorialId] = useState<number | null>(null)

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
    const [ayudaAbierta, setAyudaAbierta] = useState(false)
    // Programar otra tanda y ajustar la config del local viven acá, no en el panel: el panel muestra
    // las tandas, y estos son los dos botones que salen de esa lista.
    const [dialogoProgramar, setDialogoProgramar] = useState(false)
    const [dialogoConfig, setDialogoConfig] = useState(false)

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

    // Carga de datos
    const cargarObservabilidad = useCallback(async (silencioso = false) => {
        if (!token) return
        if (!silencioso) setLoadingObservabilidad(true)
        try {
            const segParam = segmento !== 'todos' ? segmento : undefined
            const campanaParam = campanaFiltro !== 'todas' ? campanaFiltro : undefined
            if (tab === 'cola') {
                const res = await clientesApi.recompraCola(token, { pagina, limite: 25, segmento: segParam, campanaId: campanaParam })
                setCola(res.data)
                if (res.data.items.length > 0) {
                    setSelectedColaId(prev => (prev && res.data.items.some(i => i.id === prev) ? prev : res.data.items[0].id))
                } else {
                    setSelectedColaId(null)
                }
            } else {
                const res = await clientesApi.recompraHistorial(token, { pagina, limite: 25, segmento: segParam, campanaId: campanaParam })
                setHistorial(res.data)
                if (res.data.items.length > 0) {
                    setSelectedHistorialId(prev => (prev && res.data.items.some(i => i.id === prev) ? prev : res.data.items[0].id))
                } else {
                    setSelectedHistorialId(null)
                }
            }
        } catch {
            if (!silencioso) toast.error('No se pudo actualizar la lista')
        } finally {
            if (!silencioso) setLoadingObservabilidad(false)
        }
    }, [token, tab, pagina, segmento, campanaFiltro])

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

    const totalRegistros = tab === 'cola' ? (cola?.total ?? 0) : (historial?.total ?? 0)
    const paginasTotal = tab === 'cola' ? (cola?.paginas ?? 1) : (historial?.paginas ?? 1)

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

                            {/* Filtros: segmento y tanda. La cola es del LOCAL, así que se puede
                                mirar entera o sólo lo que programó una tanda. */}
                            <div className="grid grid-cols-2 gap-2">
                                <Select value={segmento} onValueChange={(valor) => { setSegmento(valor); setPagina(1) }}>
                                    <SelectTrigger
                                        aria-label="Segmento de clientes"
                                        className="h-9 w-full rounded-full border-border/40 bg-background/80 text-xs font-medium shadow-2xs backdrop-blur-xs"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todos los segmentos</SelectItem>
                                        {(Object.keys(SEG_META) as Segmento[]).map((seg) => (
                                            <SelectItem key={seg} value={seg}>
                                                <span className="flex items-center gap-2">
                                                    <span className={cn("h-1.5 w-1.5 rounded-full", SEG_META[seg].dot)} />
                                                    {SEG_META[seg].label}
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select
                                    value={String(campanaFiltro)}
                                    onValueChange={(valor) => {
                                        setCampanaFiltro(valor === 'todas' ? 'todas' : Number(valor))
                                        setPagina(1)
                                    }}
                                >
                                    <SelectTrigger
                                        aria-label="Tanda"
                                        className="h-9 w-full rounded-full border-border/40 bg-background/80 text-xs font-medium shadow-2xs backdrop-blur-xs"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todas">Todas las tandas</SelectItem>
                                        {programaciones.map(tanda => (
                                            <SelectItem key={tanda.id} value={String(tanda.id)}>
                                                {etiquetaSegmento(tanda.segmento)} · {formatDay(tanda.programadaAt?.slice(0, 10) ?? null)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Lista de filas flotantes */}
                        <ScrollArea className="flex-1 min-h-0">
                            <div className="space-y-1.5 pr-2">
                                {loadingObservabilidad && !cola && !historial ? (
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
                                ) : historialFiltrado.length === 0 ? (
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
                                {/* SECCIÓN 0: LAS TANDAS PROGRAMADAS — qué está agendado y cuánto falta */}
                                <div className="space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                                            <CalendarClock className="h-3.5 w-3.5" /> Tandas programadas
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setDialogoConfig(true)}
                                                className="h-8 gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
                                            >
                                                <SlidersHorizontal className="h-3.5 w-3.5" /> Configuración
                                            </Button>
                                            <Button
                                                size="sm"
                                                onClick={() => setDialogoProgramar(true)}
                                                className="h-8 gap-1.5 rounded-full px-3.5 text-xs font-medium shadow-2xs"
                                            >
                                                <Zap className="h-3 w-3" /> Programar envío
                                            </Button>
                                        </div>
                                    </div>
                                    <PanelProgramaciones
                                        programaciones={programaciones}
                                        onCambio={onCambio}
                                        onProgramar={() => setDialogoProgramar(true)}
                                        onConfig={() => setDialogoConfig(true)}
                                        compacto
                                    />
                                </div>

                                {/* SECCIÓN 1: ESTADO, MÉTRICAS FLOTANTES Y CONFIGURACIÓN DEL MOTOR */}
                                <div className="space-y-4 border-t border-border/30 pt-6">
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
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setAyudaAbierta(true)}
                                                className="h-8 gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
                                            >
                                                <CircleHelp className="h-3.5 w-3.5" /> ¿Cómo funciona?
                                            </Button>

                                            {/* Pausar/Reanudar el motor del LOCAL: la pausa es del local
                                                entero, no de una tanda. El estado "pausado sin saldo"
                                                también se puede reanudar: si sigue sin crédito, el motor
                                                vuelve a pausarse solo en el próximo tick y no se pierde
                                                nada. */}
                                            {campana.estado === 'activa' ? (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={accionMotor || cambiandoModo}
                                                    onClick={() => doAccion(() => clientesApi.pausarRecompra(token!), 'Motor pausado')}
                                                    className="h-8 gap-1.5 rounded-full border-border/60 bg-background/80 px-3.5 text-xs font-medium shadow-2xs hover:bg-muted/50"
                                                >
                                                    <Pause className="h-3 w-3" /> Pausar
                                                </Button>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    disabled={accionMotor || cambiandoModo}
                                                    onClick={() => doAccion(() => clientesApi.reanudarRecompra(token!), 'Motor reanudado')}
                                                    className="h-8 gap-1.5 rounded-full px-3.5 text-xs font-medium shadow-2xs"
                                                >
                                                    <Play className="h-3 w-3" /> Reanudar
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Métricas flotantes Apple (sin cajas ni bordes pesados) */}
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-y border-border/30 py-5 sm:grid-cols-3 lg:grid-cols-5">
                                        <FloatingMetric
                                            label="Contactados"
                                            value={campana.contactados}
                                            // `contactados` son personas y `toquesEnviados` son mensajes: el
                                            // mismo cliente puede haber recibido hasta 3. Se muestran los
                                            // dos para que el número grande sea "cuánta gente" y no "cuántos
                                            // mensajes", que es lo que el cupo limita.
                                            sublabel={`${campana.toquesEnviados} mensaje${campana.toquesEnviados === 1 ? '' : 's'} enviado${campana.toquesEnviados === 1 ? '' : 's'}`}
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
                                            sublabel="por contactar"
                                        />
                                        {/* El ritmo es del LOCAL y se ajusta en un solo lugar: la
                                            configuración del motor. Tenerlo editable acá además del
                                            diálogo sería dos fuentes para el mismo número. */}
                                        <div className="flex flex-col">
                                            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Ritmo</span>
                                            <span className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-foreground sm:text-3xl">
                                                {campana.cupoDiario}
                                                <span className="ml-0.5 text-sm font-medium text-muted-foreground">/día</span>
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setDialogoConfig(true)}
                                                className="mt-0.5 self-start text-[11px] font-medium text-foreground hover:underline"
                                            >
                                                Ajustar
                                            </button>
                                        </div>
                                    </div>

                                    {/* Saldo flotante */}
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pt-0.5">
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

                                    {/* Avisos contextuales sutiles */}
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
                                    ) : itemHistorial ? (
                                        <DetalleHistorialCliente item={itemHistorial} />
                                    ) : (
                                        <EmptyDetail texto="Seleccioná un despacho para consultar su estado y entrega." />
                                    )}
                                </div>
                            </div>
                        </ScrollArea>
                    </section>
                </div>
            </main>

            {ayudaAbierta && (
                <DialogoAyudaMotor
                    campana={campana}
                    onCerrar={() => setAyudaAbierta(false)}
                />
            )}

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
        </div>
    )
}

// =============================================================================
// SUB-COMPONENTES DEL DETALLE FLOTANTE (ESTILO APPLE)
// =============================================================================

// =============================================================================
// AYUDA — CÓMO FUNCIONA EL MOTOR
//
// Esta ayuda prioriza una lectura rápida: explica el recorrido y los límites sin duplicar cada
// detalle operativo que ya se ve en la pantalla.
//
// Los números son los de la configuración vigente del backend, no copy suelto: la escalera manda en
// `backend/src/lib/recetas-recompra.ts` (`ESCALERA`), los segmentos en `clientes-rfm.ts` (múltiplos
// de la cadencia propia de cada cliente), la protección de la base en `proteccion-base.ts` y el
// ritmo diario en `motor-recompra.ts`. Si cambian allá, se actualizan acá en la misma tarea.
// =============================================================================

/** Los tres toques del goteo, con el escalón que les toca por defecto (`ESCALERA[nivel - 1]`). */
const TOQUES_AYUDA: { toque: number; trabajo: string; descuento: number; expiraHoras: number | null }[] = [
    { toque: 1, trabajo: 'Antojo e invitación a repetir.', descuento: 0, expiraHoras: null },
    { toque: 2, trabajo: 'Recordatorio con beneficio.', descuento: 10, expiraHoras: null },
    { toque: 3, trabajo: 'Último llamado con vencimiento.', descuento: 20, expiraHoras: 48 },
]

function DialogoAyudaMotor({ campana, onCerrar }: {
    campana: Dashboard
    onCerrar: () => void
}) {
    const automatico = campana.modo === 'automatico'
    // La comparación contra el grupo de control sólo se muestra cuando hay control medido: sin
    // control, esa frase sería una promesa y no un dato.
    const hayControl = campana.control > 0

    return (
        <Dialog open onOpenChange={(abierto) => { if (!abierto) onCerrar() }}>
            <DialogContent className="flex max-h-[85vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
                <DialogHeader className="shrink-0 border-b border-border/40 px-6 py-5 pr-14">
                    <DialogTitle className="text-xl">Cómo funciona el motor</DialogTitle>
                    <DialogDescription className="text-sm leading-relaxed">
                        Le habla a los clientes que dejaron de pedir. Nada sale sin que vos lo programes.
                    </DialogDescription>
                </DialogHeader>

                <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">

                    {/* 0. QUIÉN DECIDE — la diferencia con el goteo viejo */}
                    <SeccionAyuda icono={<CalendarClock className="h-3.5 w-3.5" />} titulo="Vos programás, el motor envía">
                        <p className="text-sm leading-relaxed text-muted-foreground">
                            El motor no sale a buscar clientes por su cuenta. Vos elegís a quiénes y cuántos
                            (una tanda), y el motor la manda de a poco respetando el cupo diario. El que vuelve
                            a pedir sale de la tanda al instante, y lo que ya salió no se puede deshacer.
                        </p>
                    </SeccionAyuda>

                    {/* 1. A QUIÉN LE HABLA */}
                    <SeccionAyuda icono={<Users className="h-3.5 w-3.5" />} titulo="A quién le habla">
                        <p className="text-sm leading-relaxed text-muted-foreground">
                            Aprende el ritmo de compra de cada persona. Actúa cuando ese ritmo se corta; si alguien
                            sigue comprando con normalidad, no lo contacta.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {(['primer_pedido', 'en_riesgo', 'dormido', 'perdido'] as Segmento[]).map((codigo) => (
                                <span key={codigo} className="inline-flex items-center gap-2 rounded-full border border-border/50 px-3 py-1.5 text-sm text-foreground">
                                    <span className={cn('h-2 w-2 rounded-full', SEG_META[codigo].dot)} />
                                    {SEG_META[codigo].label}
                                </span>
                            ))}
                        </div>
                    </SeccionAyuda>

                    {/* 2. EL GOTEO */}
                    <SeccionAyuda icono={<Repeat2 className="h-3.5 w-3.5" />} titulo="Hasta 3 intentos">
                        <p className="text-sm leading-relaxed text-muted-foreground">
                            Hasta 3 mensajes por cliente, con al menos 48 horas entre uno y otro. Cada tanda elige
                            hasta qué toque llega: si programaste sólo el primero, no hay recordatorio.
                        </p>
                        <ol className="space-y-2">
                            {TOQUES_AYUDA.map(({ toque, trabajo, descuento, expiraHoras }) => (
                                <li key={toque} className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/20 px-4 py-3">
                                    <span className="w-20 shrink-0 text-sm font-semibold text-foreground">
                                        {etiquetaToque(toque)}
                                    </span>
                                    <span className="min-w-0 flex-1 text-sm leading-relaxed text-muted-foreground">{trabajo}</span>
                                    <span className="shrink-0 text-right text-sm font-medium tabular-nums text-foreground">
                                        {descuento > 0 ? `${descuento}%` : 'Sin descuento'}
                                        {expiraHoras != null && (
                                            <span className="block text-xs font-normal text-muted-foreground">vence en {expiraHoras} hs</span>
                                        )}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    </SeccionAyuda>

                    {/* 3. LOS DOS MODOS */}
                    <SeccionAyuda icono={<Gauge className="h-3.5 w-3.5" />} titulo="Cómo sale el mensaje">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className={cn(
                                'rounded-xl border p-3.5',
                                automatico ? 'border-foreground/25 bg-muted/30' : 'border-border/40',
                            )}>
                                <div className="flex items-center gap-1.5">
                                    <Bot className="h-4 w-4 text-foreground" />
                                    <h4 className="text-sm font-semibold text-foreground">Automático</h4>
                                    {automatico && <EtiquetaActivo />}
                                </div>
                                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                    Envía los mensajes que programaste, hasta {campana.cupoDiario} por día. Cada uno usa 1
                                    crédito de marketing; hoy tenés {campana.saldoMarketing}.
                                </p>
                            </div>

                            <div className={cn(
                                'rounded-xl border p-3.5',
                                !automatico ? 'border-foreground/25 bg-muted/30' : 'border-border/40',
                            )}>
                                <div className="flex items-center gap-1.5">
                                    <MessageSquare className="h-4 w-4 text-foreground" />
                                    <h4 className="text-sm font-semibold text-foreground">Manual</h4>
                                    {!automatico && <EtiquetaActivo />}
                                </div>
                                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                    Prepara mensaje, cupón y link para que los envíes desde tu WhatsApp. No consume créditos.
                                </p>
                            </div>
                        </div>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                            Podés cambiar de modo sin perder el avance de ningún cliente.
                        </p>
                    </SeccionAyuda>

                    {/* 4. MEDICIÓN Y PROTECCIÓN */}
                    <SeccionAyuda icono={<CheckCircle2 className="h-3.5 w-3.5" />} titulo="Medición y límites">
                        <p className="text-sm leading-relaxed text-muted-foreground">
                            Un 10% de cada tanda queda sin contactar para comparar resultados. Además, el motor respeta
                            BAJA/STOP, evita la madrugada y limita el contacto a 4 mensajes de marketing cada 30 días.
                        </p>
                        {hayControl && (
                            <p className="rounded-xl border border-border/40 bg-muted/20 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                                Hoy volvieron <span className="font-semibold text-foreground">{pct(campana.tasaContactados)}</span> de
                                los contactados vs. <span className="font-semibold text-foreground">{pct(campana.tasaControl)}</span> del
                                grupo de control.
                            </p>
                        )}
                    </SeccionAyuda>
                </div>

                <DialogFooter className="shrink-0 border-t border-border/40 px-6 py-3.5">
                    <Button onClick={onCerrar}>Entendido</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

/** Un bloque de la ayuda: título legible y contenido breve. */
function SeccionAyuda({ icono, titulo, children }: {
    icono: React.ReactNode
    titulo: string
    children: React.ReactNode
}) {
    return (
        <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                {icono}
                {titulo}
            </h3>
            {children}
        </section>
    )
}

function EtiquetaActivo() {
    return (
        <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            activo
        </span>
    )
}

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
    const navigate = useNavigate()
    // Las campañas maestras del motor (`lo-mismo` y `reactivacion`) viven en Campañas de Adquisición,
    // que es donde está explicado qué pasa cuando el cliente abre el link de un toque.
    const verComoFuncionaElLink = () => {
        onCerrar()
        navigate('/dashboard/clientes?tab=adquisicion&vista=campanas')
    }
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
    // El resumen de una línea que reemplaza al muro de texto: qué se manda, según lo elegido.
    const resumenElegido = [
        etiquetaToque(toque),
        SEG_META[segmento].label,
        link === 'reactivacion'
            ? (descuentoEfectivo > 0 ? `${descuentoEfectivo}% OFF` : 'sin descuento')
            : 'lo mismo',
    ].filter(Boolean).join(' · ')
    const expira = vista?.expiraHoras ?? mensaje.expiraHoras
    // El texto viene con el link pegado al final (`cuerpo\n\nurl`): se parte para poder mostrarlo
    // acortado en la vista previa sin tocar el mensaje que se copia.
    const urlVista = vista && vista.urlTienda && vista.texto.includes(vista.urlTienda) ? vista.urlTienda : null
    const cuerpoVista = vista ? (urlVista ? vista.texto.slice(0, vista.texto.indexOf(urlVista)) : vista.texto) : ''

    return (
        <Dialog open onOpenChange={(abierto) => { if (!abierto) onCerrar() }}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Mensaje para {item.clienteNombre}</DialogTitle>
                    <DialogDescription>
                        Elegí la voz y el toque. El descuento que ya se ganó no se reinicia.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-1">
                    {/* 1. VOZ — el segmento */}
                    <Campo titulo="Voz">
                        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                            {opciones.segmentos.map(s => (
                                <ChipOpcion
                                    key={s.codigo}
                                    activo={segmento === s.codigo}
                                    onClick={() => setSegmento(s.codigo)}
                                    title={s.nombre}
                                >
                                    <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", SEG_META[s.codigo].dot)} />
                                    <span className="truncate">{SEG_META[s.codigo].label}</span>
                                    {s.esDelCliente && <Marca>hoy</Marca>}
                                </ChipOpcion>
                            ))}
                        </div>
                        {vivoSugerido && vivoSugerido !== segmento && (
                            <p className="text-[11px] text-muted-foreground/70">
                                Hoy se reclasificaría como {SEG_META[vivoSugerido].label}.
                            </p>
                        )}
                    </Campo>

                    {/* 2. TOQUE — qué trabajo hace el mensaje (el detalle, en el tooltip) */}
                    <Campo titulo="Toque">
                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                            {opciones.toques.map(t => (
                                <ChipOpcion
                                    key={t.toque}
                                    activo={toque === t.toque}
                                    onClick={() => setToque(t.toque)}
                                    title={t.descripcion}
                                >
                                    <span className="truncate">{etiquetaToque(t.toque)}</span>
                                    {t.descuento > 0 && <span className="shrink-0 opacity-60">{t.descuento}%</span>}
                                    {t.esDeLaEscalera && <Marca>le toca</Marca>}
                                </ChipOpcion>
                            ))}
                        </div>
                    </Campo>

                    {/* 3. LINK + DESCUENTO — a dónde entra el cliente */}
                    <Campo titulo="Link">
                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                            {opciones.links.map(l => (
                                <ChipOpcion
                                    key={l.modalidad}
                                    activo={link === l.modalidad}
                                    onClick={() => setLink(l.modalidad)}
                                    title={l.descripcion}
                                >
                                    <span className="truncate">{l.titulo}</span>
                                </ChipOpcion>
                            ))}
                        </div>

                        {link === 'reactivacion' && (
                            <div className="mt-1.5 space-y-1.5 rounded-xl border border-border/40 bg-muted/20 p-2.5">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-[11px] font-medium text-muted-foreground">Descuento</span>
                                    {opciones.descuentos.sugeridos.map(s => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => { setDescuento(s); setDescuentoAMano(true) }}
                                            className={cn(
                                                "h-6 rounded-full px-2.5 text-[11px] font-medium transition-colors",
                                                descuentoEfectivo === s
                                                    ? "bg-foreground text-background"
                                                    : "bg-background text-muted-foreground hover:text-foreground shadow-2xs",
                                            )}
                                        >
                                            {s}%
                                        </button>
                                    ))}
                                    <div className="ml-auto flex items-center gap-1">
                                        <Input
                                            type="number"
                                            min={0}
                                            max={opciones.descuentos.max}
                                            value={descuento}
                                            aria-label="Descuento a mano"
                                            onChange={(e) => {
                                                const n = Number(e.target.value)
                                                setDescuento(Number.isFinite(n) ? Math.min(Math.max(Math.trunc(n), 0), opciones.descuentos.max) : 0)
                                                setDescuentoAMano(true)
                                            }}
                                            className="h-6 w-14 rounded-full text-center text-[11px]"
                                        />
                                        <span className="text-[11px] text-muted-foreground">%</span>
                                    </div>
                                </div>
                                <p className="text-[11px] text-muted-foreground/70">
                                    {descuentoAMano
                                        ? `Elegido por vos (${opciones.descuentos.min}–${opciones.descuentos.max}%).`
                                        : `Se lo ganó por la escalera (nivel ${mensaje.nivel}).`}
                                    {descuentoEfectivo > 0 && expira != null ? ` Vence en ${expira} hs.` : ''}
                                </p>
                                {sinBeneficio && (
                                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                                        0% abre el link sin beneficio: para eso está «lo mismo».
                                    </p>
                                )}
                            </div>
                        )}
                    </Campo>

                    {/* 4. MENSAJE — siempre a la vista y rearmado con cada cambio: el operador ve lo
                        que va a mandar mientras lo arma, sin tener que abrirlo a mano. El atajo lleva
                        a las dos campañas maestras, que es donde está explicado el link que va abajo:
                        se cierra el diálogo porque el destino es otra tab del workspace. */}
                    <Campo
                        titulo="Mensaje"
                        accion={
                            <button
                                type="button"
                                onClick={verComoFuncionaElLink}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                            >
                                <CircleHelp className="h-3 w-3" />
                                Entender cómo funciona el link
                            </button>
                        }
                    >
                        <div className="flex items-center gap-2">
                            <Ticket className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                            <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{resumenElegido}</span>
                            {/* Se sigue mostrando el texto anterior mientras llega el nuevo: cambiar de
                                opción no debe vaciar la vista previa. */}
                            {cargandoVista && vista && (
                                <span className="shrink-0 text-[11px] text-muted-foreground/70">Actualizando…</span>
                            )}
                        </div>
                        {vista?.texto ? (
                            // El link va acortado con puntos suspensivos: es una palabra larguísima
                            // que se comía media vista previa. El real vive en el `href` y en el
                            // `title`, así que se puede abrir y ver entero. `overflow-wrap: anywhere`
                            // queda como red de seguridad (sólo `anywhere` achica el ancho mínimo del
                            // bloque, que es lo que evita que el texto estire el diálogo). Sin
                            // `select-all`: lo que se copia es el texto real, y para eso están los
                            // botones de copiar.
                            <div className={cn(
                                "max-h-56 min-w-0 overflow-y-auto rounded-xl border border-border/30 bg-white p-3 text-xs leading-relaxed text-foreground [overflow-wrap:anywhere] whitespace-pre-wrap dark:bg-muted/30",
                                cargandoVista && "opacity-60",
                            )}>
                                {cuerpoVista}
                                {urlVista && (
                                    <a
                                        href={urlVista}
                                        target="_blank"
                                        rel="noreferrer"
                                        title={urlVista}
                                        className="underline decoration-dotted underline-offset-2 hover:text-primary"
                                    >
                                        {acortarUrl(urlVista)}
                                    </a>
                                )}
                            </div>
                        ) : cargandoVista ? (
                            <div className="space-y-2 rounded-xl bg-muted/20 p-3">
                                <Skeleton className="h-3.5 w-3/4" />
                                <Skeleton className="h-3.5 w-full" />
                                <Skeleton className="h-3.5 w-1/2" />
                            </div>
                        ) : (
                            <p className="rounded-xl bg-muted/20 p-3 text-xs text-muted-foreground">
                                No se pudo previsualizar esa combinación. Probá con otro toque o segmento.
                            </p>
                        )}
                    </Campo>
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

/**
 * Una de las TRES DECISIONES ya tomadas (voz, toque, link) en el detalle del cliente: se leen sin
 * abrir el diálogo, con la misma etiqueta y el mismo vocabulario que usa el diálogo para elegirlas.
 */
function DatoDecision({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
    return (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border/40 bg-background/80 px-2.5 py-1 text-xs shadow-2xs backdrop-blur-xs">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{etiqueta}</span>
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">{children}</span>
        </span>
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
                        {/* Las tres decisiones, a la vista: la prosa obligaba a leer una frase para
                            saber qué se manda. */}
                        {mensaje ? (
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                <DatoDecision etiqueta="Voz">
                                    <span className={cn("h-1.5 w-1.5 rounded-full", SEG_META[mensaje.segmento].dot)} />
                                    {SEG_META[mensaje.segmento].label}
                                </DatoDecision>
                                <DatoDecision etiqueta="Toque">{badgeToque ?? '—'}</DatoDecision>
                                <DatoDecision etiqueta="Link">
                                    {mensaje.link === 'reactivacion'
                                        ? `Reactivación${descuentoVisible > 0 ? ` · ${descuentoVisible}% OFF` : ' · sin descuento'}`
                                        : 'Lo mismo'}
                                </DatoDecision>
                            </div>
                        ) : (
                            <p className="mt-1 text-xs text-muted-foreground">Preparando el mensaje…</p>
                        )}
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
                    disabled={marcandoId === item.id || !listo}
                    onClick={onMarcarEnviado}
                    className="ml-auto h-9 rounded-full bg-orange-500 px-4 text-xs font-medium text-white shadow-2xs gap-1.5 hover:bg-orange-600"
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

function EstadoBadge({ estado }: { estado: EstadoMotorLocal }) {
    // "Pausado sin saldo" no se rotula: el punto naranja ya lo distingue y el aviso de créditos
    // agotados —que es el que explica qué hacer— aparece unas líneas más abajo.
    const map: Record<EstadoMotorLocal, { label: string; dot: string }> = {
        activa: { label: 'Activo', dot: 'bg-emerald-500' },
        pausada_manual: { label: 'Pausado', dot: 'bg-muted-foreground' },
        pausada_sin_saldo: { label: 'Pausado', dot: 'bg-orange-500' },
    }
    const m = map[estado]
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background/80 px-2.5 py-1 text-xs font-medium text-foreground backdrop-blur-xs">
            <span className={cn("h-1.5 w-1.5 rounded-full", m.dot, estado === 'activa' && "animate-pulse")} />
            {m.label}
        </span>
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

function PlanBloqueado({ onCambioEstado }: { onCambioEstado: () => void }) {
    return (
        <div className="text-center py-20">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Crown className="w-7 h-7 text-foreground" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">Activá Retención</h2>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto leading-relaxed">
                Convertí tu base de clientes en recompra: segmentos por ritmo de compra, tandas de mensajes
                personalizados con su día y su hora, y atribución con grupo de control.
            </p>
            <div className="mx-auto mt-6 max-w-sm text-left">
                <ModuloComercial
                    codigo="motor_recompra"
                    variante="tarjeta"
                    tipo="pago"
                    titulo="Retención"
                    nombreComercial="Retención"
                    descripcion="Motor de recompra, club de puntos y campañas de recuperación sobre tu propia base de clientes."
                    icono={Crown}
                    onCambioEstado={onCambioEstado}
                />
            </div>
        </div>
    )
}
