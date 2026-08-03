import { useState, useEffect, useMemo, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useAuthStore } from '@/store/authStore'
import { clientesApi, ApiError } from '@/lib/api'
import { toast } from 'sonner'
import {
    Search, MapPin, Phone, CalendarDays,
    ShoppingBag, DollarSign, ChevronRight,
    User, TrendingUp, Users,
    MessageCircle, ExternalLink, X,
    Clock, Truck, Package, ArrowUpRight, Star, Ticket,
    Sparkles, Crown, AlertTriangle, Moon, UserX,
    Repeat, Timer, Utensils, Rocket, Gift, Loader2, Send, CheckCircle2, BellOff
} from 'lucide-react'
import CodigosDescuento from './CodigosDescuento'
import MotorRecompra from './MotorRecompra'

// =============================================================================
// ESCALERA DE RECUPERO (Motor de Recompra · 4.2) — espejo del backend (lib/recupero.ts)
// Sólo para describir en la UI qué se va a enviar. La verdad la calcula el backend.
// =============================================================================
interface EscalonMeta {
    nivel: number
    titulo: string
    detalle: string
    descuento: number
}
const ESCALERA_META: EscalonMeta[] = [
    { nivel: 1, descuento: 0, titulo: 'Primer toque · sin descuento', detalle: 'Solo un antojo: la foto de lo que más pide + invitación a repetir su pedido. No se regala margen a quien vuelve gratis.' },
    { nivel: 2, descuento: 10, titulo: 'Segundo toque · 10% de descuento', detalle: 'Si no volvió con el primer toque, un empujón chico: 10% con un código propio.' },
    { nivel: 3, descuento: 20, titulo: 'Último toque · 20% OFF con vencimiento', detalle: 'Oferta fuerte y con urgencia: 20% que vence en 48 hs. Es el último intento.' },
]
// Segmentos donde tiene sentido ofrecer el recupero (el cliente se enfrió).
const SEGMENTOS_RECUPERABLES: Segmento[] = ['en_riesgo', 'dormido', 'perdido']

interface EstadoRecupero {
    totalEnvios: number
    ultimoEnvioAt: string | null
    ultimoNivel: number | null
    proximoNivel: number
    puedeEnviar: boolean
}

// --- Types ---
interface ItemPedido {
    nombreProducto: string
    cantidad: number
    precioUnitario: string
}

interface PedidoHistorial {
    id: number
    total: string
    createdAt: string
    tipo: 'delivery' | 'takeaway'
    items: ItemPedido[]
}

interface ProductoTop {
    nombre: string
    cantidad: number
}

type Segmento = 'nuevo' | 'activo' | 'vip' | 'en_riesgo' | 'dormido' | 'perdido'

interface Cliente {
    id: number
    nombre: string
    telefono: string
    direccion: string | null
    createdAt: string
    cantidadPedidos: number
    totalGastado: number
    ultimoPedidoAt: string | null
    pedidos: PedidoHistorial[]
    puntos?: number
    // ── Motor de Recompra (backend 4.1) — opcionales por retrocompat
    primerPedidoAt?: string | null
    ticketPromedio?: number
    cadenciaDias?: number | null
    diasDesdeUltimo?: number | null
    segmento?: Segmento
    esVip?: boolean
    resumenCadencia?: string | null
    productosTop?: ProductoTop[]
    // ── Estado de la escalera de recupero (Motor de Recompra · 4.2) — opcional por retrocompat
    recupero?: EstadoRecupero
    // ── Protección de la base (Motor de Recompra · 4.5): opt-out de marketing — opcional por retrocompat
    marketingOptOut?: boolean
}

// --- Utility functions ---
const formatCurrency = (value: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(num)
}

const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Sin datos'
    return new Date(dateString).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}

const formatDateLong = (dateString: string | null) => {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleDateString('es-AR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })
}

const formatTime = (dateString: string | null) => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleTimeString('es-AR', {
        hour: '2-digit', minute: '2-digit'
    })
}

const getTimeSince = (dateString: string | null) => {
    if (!dateString) return 'Nunca'
    const diff = Date.now() - new Date(dateString).getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (days === 0) return 'Hoy'
    if (days === 1) return 'Ayer'
    if (days < 7) return `Hace ${days} días`
    if (days < 30) return `Hace ${Math.floor(days / 7)} sem`
    if (days < 365) return `Hace ${Math.floor(days / 30)} meses`
    return `Hace ${Math.floor(days / 365)} años`
}

// "hace X días" a partir del contador que ya calcula el backend (evita líos de timezone)
const diasLabel = (dias: number | null | undefined): string => {
    if (dias == null) return 'Sin pedidos'
    if (dias === 0) return 'Hoy'
    if (dias === 1) return 'Ayer'
    if (dias < 30) return `Hace ${dias} días`
    if (dias < 365) return `Hace ${Math.round(dias / 30)} meses`
    return `Hace ${Math.round(dias / 365)} años`
}

// =============================================================================
// SEGMENTOS RFM — el cerebro del Motor de Recompra, traducido a lenguaje gastro
// =============================================================================
interface SegMeta {
    label: string
    icon: typeof Star
    text: string
    bg: string
    dot: string
    ring: string
    descripcion: string
}

const SEGMENTOS: Record<Segmento, SegMeta> = {
    nuevo: {
        label: 'Nuevo', icon: Sparkles,
        text: 'text-emerald-700 dark:text-emerald-400',
        bg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800',
        dot: 'bg-emerald-500', ring: 'ring-emerald-500/30',
        descripcion: 'Hizo su primer pedido hace poco. Todavía no es habitual.',
    },
    activo: {
        label: 'Activo', icon: TrendingUp,
        text: 'text-blue-700 dark:text-blue-400',
        bg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800',
        dot: 'bg-blue-500', ring: 'ring-blue-500/30',
        descripcion: 'Pide dentro de su ritmo habitual. Todo en orden.',
    },
    vip: {
        label: 'VIP', icon: Crown,
        text: 'text-amber-700 dark:text-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800',
        dot: 'bg-amber-500', ring: 'ring-amber-500/30',
        descripcion: 'Concentra facturación o pide muy seguido. Cuidalo.',
    },
    en_riesgo: {
        label: 'En riesgo', icon: AlertTriangle,
        text: 'text-orange-700 dark:text-orange-400',
        bg: 'bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800',
        dot: 'bg-orange-500', ring: 'ring-orange-500/30',
        descripcion: 'Se está pasando de su ritmo habitual. Momento de un empujón.',
    },
    dormido: {
        label: 'Dormido', icon: Moon,
        text: 'text-violet-700 dark:text-violet-400',
        bg: 'bg-violet-50 dark:bg-violet-950/50 border-violet-200 dark:border-violet-800',
        dot: 'bg-violet-500', ring: 'ring-violet-500/30',
        descripcion: 'Hace rato que no pide para lo que suele. Candidato a recupero.',
    },
    perdido: {
        label: 'Perdido', icon: UserX,
        text: 'text-rose-700 dark:text-rose-400',
        bg: 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800',
        dot: 'bg-rose-500', ring: 'ring-rose-500/30',
        descripcion: 'Muy pasado de su ritmo. Difícil, pero no imposible.',
    },
}

// Orden en que se muestran los chips de segmento (los accionables primero).
const SEGMENTO_ORDEN: Segmento[] = ['en_riesgo', 'dormido', 'vip', 'activo', 'nuevo', 'perdido']

// Deriva el segmento aunque el backend sea viejo (fallback heurístico simple).
const getSegmento = (c: Cliente): Segmento => {
    if (c.segmento) return c.segmento
    if (c.cantidadPedidos > 10 || c.totalGastado > 100000) return 'vip'
    if (c.cantidadPedidos > 3) return 'activo'
    return 'nuevo'
}

// Prioridad de atención para el sort "Necesitan atención": recupero primero, ponderado por valor.
const PESO_SEGMENTO: Record<Segmento, number> = {
    dormido: 4, en_riesgo: 3, perdido: 1, nuevo: 0.5, vip: 0.3, activo: 0.2,
}
const prioridadAtencion = (c: Cliente): number => {
    const seg = getSegmento(c)
    const base = PESO_SEGMENTO[seg]
    const valor = 1 + c.totalGastado / 20000
    const vipBonus = c.esVip ? 2 : 1
    return base * valor * vipBonus
}

const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return name.slice(0, 2).toUpperCase()
}

const avatarColors = [
    'from-violet-500 to-purple-600',
    'from-blue-500 to-cyan-500',
    'from-emerald-500 to-teal-500',
    'from-orange-500 to-amber-500',
    'from-rose-500 to-pink-500',
    'from-indigo-500 to-blue-500',
    'from-fuchsia-500 to-purple-500',
    'from-teal-500 to-emerald-500',
]

const getAvatarColor = (id: number) => avatarColors[id % avatarColors.length]

// =============================================================================
// MAIN COMPONENT (con tabs: Clientes / Cupones)
// =============================================================================
export default function Clientes() {
    const [tab, setTab] = useState<'clientes' | 'motor' | 'cupones'>('clientes')

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
            {/* Tab switcher */}
            <div className="border-b bg-background px-4 sm:px-6 shrink-0">
                <div className="flex items-center gap-1 h-12">
                    <TabButton active={tab === 'clientes'} onClick={() => setTab('clientes')} icon={Users}>
                        Clientes
                    </TabButton>
                    <TabButton active={tab === 'motor'} onClick={() => setTab('motor')} icon={Rocket}>
                        Motor de Recompra
                    </TabButton>
                    <TabButton active={tab === 'cupones'} onClick={() => setTab('cupones')} icon={Ticket}>
                        Cupones
                    </TabButton>
                </div>
            </div>

            {/* Panel activo */}
            <div className="flex-1 min-h-0 flex flex-col">
                {tab === 'clientes' ? <ClientesPanel /> : tab === 'motor' ? <MotorRecompra /> : <CodigosDescuento />}
            </div>
        </div>
    )
}

function TabButton({ active, onClick, icon: Icon, children }: {
    active: boolean
    onClick: () => void
    icon: typeof Users
    children: React.ReactNode
}) {
    return (
        <button
            onClick={onClick}
            className={`relative flex items-center gap-2 px-3 h-12 text-sm font-medium transition-colors ${
                active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
        >
            <Icon className="w-4 h-4" />
            {children}
            {active && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
        </button>
    )
}

function ClientesPanel() {
    const token = useAuthStore(state => state.token)
    const [clientes, setClientes] = useState<Cliente[]>([])
    const [loading, setLoading] = useState(true)
    const [query, setQuery] = useState('')
    const [sortBy, setSortBy] = useState('attention')
    const [segmentoFiltro, setSegmentoFiltro] = useState<Segmento | 'todos'>('todos')
    const [selectedClientId, setSelectedClientId] = useState<number | null>(null)

    // Fetch
    const fetchClientes = useCallback(async () => {
        if (!token) return
        setLoading(true)
        try {
            const response = await clientesApi.getAll(token) as { success: boolean, data: Cliente[] }
            if (response.success && response.data) {
                setClientes(response.data)
            }
        } catch (error) {
            console.error('Error fetching clientes:', error)
        } finally {
            setLoading(false)
        }
    }, [token])

    useEffect(() => {
        fetchClientes()
    }, [fetchClientes])

    // Conteo por segmento (para los chips de arriba)
    const conteoSegmentos = useMemo(() => {
        const base: Record<Segmento, number> = { nuevo: 0, activo: 0, vip: 0, en_riesgo: 0, dormido: 0, perdido: 0 }
        for (const c of clientes) base[getSegmento(c)]++
        return base
    }, [clientes])

    // Filter + Sort
    const filteredAndSorted = useMemo(() => {
        let result = [...clientes]

        if (segmentoFiltro !== 'todos') {
            result = result.filter(c => getSegmento(c) === segmentoFiltro)
        }

        if (query) {
            const q = query.toLowerCase()
            result = result.filter(c =>
                c.nombre.toLowerCase().includes(q) ||
                c.telefono.includes(q) ||
                (c.direccion && c.direccion.toLowerCase().includes(q))
            )
        }

        result.sort((a, b) => {
            if (sortBy === 'attention') return prioridadAtencion(b) - prioridadAtencion(a)
            if (sortBy === 'recent') {
                const dateA = a.ultimoPedidoAt ? new Date(a.ultimoPedidoAt).getTime() : 0
                const dateB = b.ultimoPedidoAt ? new Date(b.ultimoPedidoAt).getTime() : 0
                return dateB - dateA
            }
            if (sortBy === 'most_orders') return b.cantidadPedidos - a.cantidadPedidos
            if (sortBy === 'highest_spender') return b.totalGastado - a.totalGastado
            if (sortBy === 'alphabetical') return a.nombre.localeCompare(b.nombre)
            return 0
        })

        return result
    }, [clientes, query, sortBy, segmentoFiltro])

    // Stats
    const stats = useMemo(() => {
        const totalClients = clientes.length
        const totalRevenue = clientes.reduce((acc, c) => acc + c.totalGastado, 0)
        const totalOrders = clientes.reduce((acc, c) => acc + c.cantidadPedidos, 0)
        const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0
        // Foco del motor: clientes por recuperar (en riesgo + dormidos) y cuánta plata representan.
        const porRecuperar = clientes.filter(c => {
            const s = getSegmento(c)
            return s === 'en_riesgo' || s === 'dormido'
        })
        const revenueEnJuego = porRecuperar.reduce((acc, c) => acc + c.totalGastado, 0)
        return { totalClients, totalRevenue, avgTicket, totalOrders, porRecuperar: porRecuperar.length, revenueEnJuego }
    }, [clientes])

    // Selected Client
    const selectedClient = useMemo(() => {
        return clientes.find(c => c.id === selectedClientId) || null
    }, [clientes, selectedClientId])

    const openWhatsApp = (phone: string, e?: React.MouseEvent) => {
        e?.stopPropagation()
        const cleanPhone = phone.replace(/\D/g, '')
        window.open(`https://wa.me/${cleanPhone}`, '_blank')
    }

    // Actualiza en memoria el estado de recupero de un cliente tras enviarle un toque.
    const actualizarRecupero = useCallback((clienteId: number, recupero: EstadoRecupero) => {
        setClientes(prev => prev.map(c => c.id === clienteId ? { ...c, recupero } : c))
    }, [])

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
            {/* ============================================================= */}
            {/* TOP HEADER — KPIs del motor + segmentos */}
            {/* ============================================================= */}
            <div className="border-b bg-background/80 backdrop-blur-xl sticky top-0 z-20">
                <div className="px-6 py-5">
                    {/* Title Row */}
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-xl font-semibold tracking-tight text-foreground">Base de clientes</h1>
                            <p className="text-[13px] text-muted-foreground mt-0.5">
                                {stats.totalClients} clientes · el cerebro del motor de recompra: cada cliente clasificado por su propio ritmo de pedidos
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs font-medium gap-1.5 hidden sm:flex"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Exportar
                        </Button>
                    </div>

                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <KPICard
                            label="Clientes"
                            value={stats.totalClients.toString()}
                            icon={<Users className="w-4 h-4" />}
                            color="text-blue-600 dark:text-blue-400"
                            bgColor="bg-blue-50 dark:bg-blue-950/50"
                        />
                        <KPICard
                            label="Por recuperar"
                            value={stats.porRecuperar.toString()}
                            hint="en riesgo + dormidos"
                            icon={<AlertTriangle className="w-4 h-4" />}
                            color="text-orange-600 dark:text-orange-400"
                            bgColor="bg-orange-50 dark:bg-orange-950/50"
                        />
                        <KPICard
                            label="Facturación en juego"
                            value={formatCurrency(stats.revenueEnJuego)}
                            hint="lo que gastaron los que se enfrían"
                            icon={<DollarSign className="w-4 h-4" />}
                            color="text-violet-600 dark:text-violet-400"
                            bgColor="bg-violet-50 dark:bg-violet-950/50"
                        />
                        <KPICard
                            label="Ticket promedio"
                            value={formatCurrency(stats.avgTicket || 0)}
                            icon={<TrendingUp className="w-4 h-4" />}
                            color="text-emerald-600 dark:text-emerald-400"
                            bgColor="bg-emerald-50 dark:bg-emerald-950/50"
                        />
                    </div>

                    {/* Segment filter chips */}
                    <div className="flex flex-wrap items-center gap-2 mt-4">
                        <SegmentoChip
                            label="Todos"
                            count={stats.totalClients}
                            active={segmentoFiltro === 'todos'}
                            onClick={() => setSegmentoFiltro('todos')}
                        />
                        {SEGMENTO_ORDEN.map(seg => (
                            <SegmentoChip
                                key={seg}
                                label={SEGMENTOS[seg].label}
                                count={conteoSegmentos[seg]}
                                dot={SEGMENTOS[seg].dot}
                                active={segmentoFiltro === seg}
                                onClick={() => setSegmentoFiltro(segmentoFiltro === seg ? 'todos' : seg)}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* ============================================================= */}
            {/* MAIN CONTENT — Master / Detail split */}
            {/* ============================================================= */}
            <div className="flex-1 flex min-h-0 overflow-hidden">
                {/* ===== LEFT PANEL — Client List ===== */}
                <div className={`
                    flex flex-col border-r bg-background
                    ${selectedClient ? 'hidden lg:flex' : 'flex'}
                    w-full lg:w-[420px] xl:w-[480px] lg:shrink-0
                    transition-all duration-200
                `}>
                    {/* Search + Filter */}
                    <div className="px-4 py-3 border-b bg-muted/30">
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <input
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    placeholder="Buscar cliente..."
                                    className="w-full h-9 pl-9 pr-4 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 transition-all"
                                />
                            </div>
                            <Select value={sortBy} onValueChange={setSortBy}>
                                <SelectTrigger className="w-[170px] h-9 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="attention">Necesitan atención</SelectItem>
                                    <SelectItem value="recent">Más recientes</SelectItem>
                                    <SelectItem value="most_orders">Más pedidos</SelectItem>
                                    <SelectItem value="highest_spender">Mayor gasto</SelectItem>
                                    <SelectItem value="alphabetical">A → Z</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Client Rows */}
                    <ScrollArea className="flex-1">
                        {loading ? (
                            <div className="p-4 space-y-2">
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <Skeleton key={i} className="h-[72px] w-full rounded-lg" />
                                ))}
                            </div>
                        ) : filteredAndSorted.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                                    <User className="w-5 h-5 text-muted-foreground" />
                                </div>
                                <h3 className="text-sm font-medium text-foreground">Sin resultados</h3>
                                <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                                    {segmentoFiltro !== 'todos'
                                        ? 'No hay clientes en este segmento.'
                                        : 'No se encontraron clientes. Probá ajustando tu búsqueda.'}
                                </p>
                            </div>
                        ) : (
                            <div className="py-1">
                                {filteredAndSorted.map(cliente => (
                                    <ClienteRow
                                        key={cliente.id}
                                        cliente={cliente}
                                        selected={selectedClientId === cliente.id}
                                        onSelect={() => setSelectedClientId(cliente.id)}
                                    />
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </div>

                {/* ===== RIGHT PANEL — Client Detail ===== */}
                {selectedClient ? (
                    <ClienteDetalle
                        cliente={selectedClient}
                        onClose={() => setSelectedClientId(null)}
                        openWhatsApp={openWhatsApp}
                        onRecuperoSent={actualizarRecupero}
                    />
                ) : (
                    /* ===== EMPTY STATE — No client selected (desktop) ===== */
                    <div className="hidden lg:flex flex-1 items-center justify-center bg-muted/20">
                        <div className="text-center max-w-xs">
                            <div className="w-16 h-16 rounded-2xl bg-muted/80 flex items-center justify-center mx-auto mb-4">
                                <Users className="w-7 h-7 text-muted-foreground/40" />
                            </div>
                            <h3 className="text-sm font-medium text-foreground mb-1">
                                Seleccioná un cliente
                            </h3>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Elegí un cliente para ver su ritmo de pedidos, en qué momento de su ciclo está y qué le conviene enviarle.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

// =============================================================================
// CLIENT ROW (lista)
// =============================================================================
function ClienteRow({ cliente, selected, onSelect }: {
    cliente: Cliente
    selected: boolean
    onSelect: () => void
}) {
    const seg = getSegmento(cliente)
    const meta = SEGMENTOS[seg]

    return (
        <button
            onClick={onSelect}
            className={`
                w-full text-left px-4 py-3 flex items-center gap-3
                transition-all duration-150 cursor-pointer border-b
                ${selected
                    ? 'bg-primary/6 dark:bg-primary/12 border-b-border/50'
                    : 'hover:bg-muted/50 border-b-border/30'
                }
            `}
        >
            {/* Avatar con punto de segmento */}
            <div className="relative shrink-0">
                <div className={`
                    w-10 h-10 rounded-full bg-linear-to-br ${getAvatarColor(cliente.id)}
                    flex items-center justify-center text-white text-sm font-semibold shadow-sm
                `}>
                    {getInitials(cliente.nombre)}
                </div>
                <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ${meta.dot} ring-2 ring-background`}
                    title={meta.label}
                />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium truncate ${selected ? 'text-foreground' : 'text-foreground/90'}`}>
                        {cliente.nombre}
                    </span>
                    {cliente.esVip && seg !== 'vip' && (
                        <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    )}
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${meta.bg} ${meta.text}`}>
                        {meta.label}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                        {cliente.cantidadPedidos} ped · {formatCurrency(cliente.totalGastado)}
                    </span>
                </div>
            </div>

            {/* Right side */}
            <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-[11px] text-muted-foreground">
                    {cliente.diasDesdeUltimo != null ? diasLabel(cliente.diasDesdeUltimo) : getTimeSince(cliente.ultimoPedidoAt)}
                </span>
                {cliente.cadenciaDias != null && (
                    <span className="text-[10px] text-muted-foreground/70 flex items-center gap-0.5">
                        <Repeat className="w-2.5 h-2.5" />~{cliente.cadenciaDias}d
                    </span>
                )}
            </div>
        </button>
    )
}

// =============================================================================
// CLIENT DETAIL (panel derecho)
// =============================================================================
function ClienteDetalle({ cliente, onClose, openWhatsApp, onRecuperoSent }: {
    cliente: Cliente
    onClose: () => void
    openWhatsApp: (phone: string, e?: React.MouseEvent) => void
    onRecuperoSent: (clienteId: number, recupero: EstadoRecupero) => void
}) {
    const seg = getSegmento(cliente)
    const meta = SEGMENTOS[seg]
    const SegIcon = meta.icon
    const ticket = cliente.ticketPromedio ?? (cliente.cantidadPedidos > 0 ? Math.round(cliente.totalGastado / cliente.cantidadPedidos) : 0)

    const token = useAuthStore(state => state.token)
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [enviando, setEnviando] = useState(false)

    const recupero = cliente.recupero
    const proximoNivel = recupero?.proximoNivel ?? 1
    const escalon = ESCALERA_META[Math.min(proximoNivel, ESCALERA_META.length) - 1]
    const mostrarRecupero = SEGMENTOS_RECUPERABLES.includes(seg)
    const optOut = !!cliente.marketingOptOut // protección de la base (4.5): pidió no recibir marketing
    const productoAntojo = cliente.productosTop?.[0]?.nombre ?? 'su pedido de siempre'

    const handleEnviarRecupero = async () => {
        if (!token) return
        setEnviando(true)
        try {
            const res = await clientesApi.enviarRecupero(token, cliente.id) as {
                success: boolean; data?: { nivel: number; recupero: EstadoRecupero }
            }
            if (res.success && res.data) {
                onRecuperoSent(cliente.id, res.data.recupero)
                toast.success(`Mensaje de recupero enviado (nivel ${res.data.nivel})`, {
                    description: 'Se envió con la marca de tu local por WhatsApp.',
                })
                setConfirmOpen(false)
            }
        } catch (err) {
            if (err instanceof ApiError) {
                if (err.status === 403 && err.response?.upgradeRequired) {
                    toast.error('El Motor de Recompra está disponible en el plan Avanzado')
                } else {
                    toast.error(err.message || 'No se pudo enviar el mensaje')
                }
            } else {
                toast.error('No se pudo enviar el mensaje')
            }
            setConfirmOpen(false)
        } finally {
            setEnviando(false)
        }
    }

    return (
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-muted/20">
            {/* Detail Header */}
            <div className="px-6 py-5 bg-background border-b">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        {/* Mobile back button */}
                        <button
                            onClick={onClose}
                            className="lg:hidden p-1.5 -ml-1 rounded-lg hover:bg-muted transition-colors"
                        >
                            <ChevronRight className="w-4 h-4 rotate-180" />
                        </button>

                        {/* Large avatar */}
                        <div className="relative shrink-0">
                            <div className={`
                                w-14 h-14 rounded-2xl bg-linear-to-br ${getAvatarColor(cliente.id)}
                                flex items-center justify-center text-white text-lg font-bold
                                shadow-lg shadow-black/10
                            `}>
                                {getInitials(cliente.nombre)}
                            </div>
                            <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full ${meta.dot} ring-2 ring-background`} />
                        </div>

                        <div>
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h2 className="text-lg font-semibold text-foreground">
                                    {cliente.nombre}
                                </h2>
                                <Badge
                                    variant="outline"
                                    className={`text-[10px] h-5 px-2 font-semibold ${meta.bg} ${meta.text} border gap-1`}
                                >
                                    <SegIcon className="w-3 h-3" />
                                    {meta.label}
                                </Badge>
                                {cliente.esVip && seg !== 'vip' && (
                                    <Badge variant="outline" className="text-[10px] h-5 px-2 font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 gap-1">
                                        <Crown className="w-3 h-3" /> VIP
                                    </Badge>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Cliente desde {formatDate(cliente.primerPedidoAt || cliente.createdAt)}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => openWhatsApp(cliente.telefono, e)}
                            className="h-8 px-3 gap-1.5 text-xs font-medium text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-950/30"
                        >
                            <MessageCircle className="w-3.5 h-3.5" />
                            WhatsApp
                        </Button>
                        <Button
                            size="icon"
                            variant="ghost"
                            onClick={onClose}
                            className="h-8 w-8 hidden lg:flex"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Detail scrollable body */}
            <ScrollArea className="flex-1">
                <div className="p-6 space-y-6 max-w-3xl">

                    {/* ---- Diagnóstico del ciclo de vida ---- */}
                    <div className={`rounded-xl border p-4 ${meta.bg}`}>
                        <div className="flex items-start gap-3">
                            <div className={`w-9 h-9 rounded-lg bg-background/60 flex items-center justify-center ${meta.text} shrink-0`}>
                                <SegIcon className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <p className={`text-sm font-semibold ${meta.text}`}>{meta.label}</p>
                                <p className="text-xs text-foreground/70 mt-0.5">{meta.descripcion}</p>
                                <p className="text-xs text-foreground/80 mt-2 font-medium">
                                    {cliente.resumenCadencia
                                        ? `${cliente.resumenCadencia} · ${diasLabel(cliente.diasDesdeUltimo).toLowerCase()} pidió`
                                        : cliente.diasDesdeUltimo != null
                                            ? `${diasLabel(cliente.diasDesdeUltimo)} · todavía sin un ritmo definido`
                                            : 'Sin pedidos registrados'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* ---- Motor de Recompra · playbook de recupero (4.2) ---- */}
                    {mostrarRecupero && (
                        <div className="rounded-xl border border-violet-200 dark:border-violet-900 bg-linear-to-br from-violet-50 to-background dark:from-violet-950/40 dark:to-background overflow-hidden">
                            <div className="px-4 py-3 border-b border-violet-100 dark:border-violet-900/60 flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center text-violet-600 dark:text-violet-400">
                                    <Rocket className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-sm font-semibold text-foreground">Recuperar a este cliente</h3>
                                    <p className="text-[11px] text-muted-foreground -mt-0.5">Motor de Recompra · escalera de incentivos</p>
                                </div>
                            </div>
                            <div className="p-4 space-y-3">
                                {/* Próximo escalón */}
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-background border border-violet-200 dark:border-violet-800 flex items-center justify-center shrink-0 text-violet-600 dark:text-violet-400 text-xs font-bold tabular-nums">
                                        {escalon.nivel}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                                            {escalon.descuento > 0 && <Gift className="w-3.5 h-3.5 text-violet-500" />}
                                            {escalon.titulo}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-0.5">{escalon.detalle}</p>
                                        <p className="text-[11px] text-muted-foreground/80 mt-1.5">
                                            Se le mostrará <span className="font-medium text-foreground/80">{productoAntojo}</span> y un botón para volver a pedir en tu tienda.
                                        </p>
                                    </div>
                                </div>

                                {/* Historial de toques */}
                                {recupero && recupero.totalEnvios > 0 && (
                                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/50 rounded-lg px-2.5 py-1.5">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                                        Le enviaste {recupero.totalEnvios} {recupero.totalEnvios === 1 ? 'recordatorio' : 'recordatorios'}
                                        {recupero.ultimoEnvioAt && ` · último ${getTimeSince(recupero.ultimoEnvioAt).toLowerCase()}`}
                                    </div>
                                )}

                                {/* Acción */}
                                {optOut ? (
                                    <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-muted/50 rounded-lg px-2.5 py-2">
                                        <BellOff className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />
                                        <span>
                                            Este cliente pidió no recibir mensajes promocionales (respondió “BAJA”).
                                            No se lo puede contactar por el motor hasta que se reactive.
                                        </span>
                                    </div>
                                ) : recupero && !recupero.puedeEnviar ? (
                                    <p className="text-[11px] text-muted-foreground italic">
                                        Ya le escribiste hace poco. Esperá antes de insistir para no saturarlo.
                                    </p>
                                ) : (
                                    <Button
                                        size="sm"
                                        onClick={() => setConfirmOpen(true)}
                                        className="w-full h-9 gap-2 bg-violet-600 hover:bg-violet-700 text-white"
                                    >
                                        <Send className="w-3.5 h-3.5" />
                                        {recupero && recupero.totalEnvios > 0 ? 'Enviar el siguiente toque' : 'Enviar mensaje de recupero'}
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ---- Metrics Row (RFM) ---- */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <MetricCard
                            label="Pedidos"
                            value={cliente.cantidadPedidos.toString()}
                            icon={<ShoppingBag className="w-4 h-4" />}
                            color="text-blue-600 dark:text-blue-400"
                        />
                        <MetricCard
                            label="Total gastado"
                            value={formatCurrency(cliente.totalGastado)}
                            icon={<DollarSign className="w-4 h-4" />}
                            color="text-emerald-600 dark:text-emerald-400"
                        />
                        <MetricCard
                            label="Ticket prom."
                            value={ticket > 0 ? formatCurrency(ticket) : '$0'}
                            icon={<TrendingUp className="w-4 h-4" />}
                            color="text-violet-600 dark:text-violet-400"
                        />
                        <MetricCard
                            label="Cadencia"
                            value={cliente.cadenciaDias != null ? `~${cliente.cadenciaDias} días` : '—'}
                            icon={<Timer className="w-4 h-4" />}
                            color="text-orange-600 dark:text-orange-400"
                        />
                    </div>

                    {/* ---- Productos que más pide (base del "repetí tu pedido") ---- */}
                    {cliente.productosTop && cliente.productosTop.length > 0 && (
                        <div className="bg-background rounded-xl border border-border/60 overflow-hidden">
                            <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
                                <Utensils className="w-3.5 h-3.5 text-muted-foreground" />
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Lo que más pide
                                </h3>
                            </div>
                            <div className="p-3 flex flex-wrap gap-2">
                                {cliente.productosTop.map((p, i) => (
                                    <span
                                        key={i}
                                        className="inline-flex items-center gap-1.5 text-xs font-medium bg-muted/60 text-foreground px-2.5 py-1.5 rounded-lg border border-border/40"
                                    >
                                        <span className="text-[10px] font-bold text-muted-foreground bg-background w-4 h-4 rounded flex items-center justify-center tabular-nums">
                                            {p.cantidad}
                                        </span>
                                        {p.nombre}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ---- Contact Info Card ---- */}
                    <div className="bg-background rounded-xl border border-border/60 overflow-hidden">
                        <div className="px-4 py-3 border-b border-border/40">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Información de contacto
                            </h3>
                        </div>
                        <div className="divide-y divide-border/40">
                            <ContactRow
                                icon={<Phone className="w-4 h-4" />}
                                label="Teléfono"
                                value={cliente.telefono}
                                action={
                                    <button
                                        onClick={(e) => openWhatsApp(cliente.telefono, e)}
                                        className="text-xs text-green-600 dark:text-green-400 hover:underline flex items-center gap-1 font-medium"
                                    >
                                        Enviar mensaje <ArrowUpRight className="w-3 h-3" />
                                    </button>
                                }
                            />
                            <ContactRow
                                icon={<MapPin className="w-4 h-4" />}
                                label="Dirección"
                                value={cliente.direccion || 'Retira en local'}
                            />
                            <ContactRow
                                icon={<CalendarDays className="w-4 h-4" />}
                                label="Primer pedido"
                                value={formatDateLong(cliente.primerPedidoAt || cliente.createdAt)}
                            />
                            <ContactRow
                                icon={<Clock className="w-4 h-4" />}
                                label="Último pedido"
                                value={cliente.ultimoPedidoAt
                                    ? `${formatDateLong(cliente.ultimoPedidoAt)} — ${diasLabel(cliente.diasDesdeUltimo)}`
                                    : 'Sin pedidos'
                                }
                            />
                        </div>
                    </div>

                    {/* ---- Order History ---- */}
                    <div className="bg-background rounded-xl border border-border/60 overflow-hidden">
                        <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Historial de pedidos
                            </h3>
                            <span className="text-xs text-muted-foreground tabular-nums">
                                {cliente.pedidos.length} pedidos
                            </span>
                        </div>

                        {cliente.pedidos.length === 0 ? (
                            <div className="px-4 py-10 text-center">
                                <Package className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                                <p className="text-sm text-muted-foreground">Sin pedidos registrados</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border/30">
                                {cliente.pedidos.map((pedido) => (
                                    <OrderRow key={pedido.id} pedido={pedido} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </ScrollArea>

            {/* ---- Confirmación del envío de recupero ---- */}
            <Dialog open={confirmOpen} onOpenChange={(o) => !enviando && setConfirmOpen(o)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Rocket className="w-4 h-4 text-violet-600" />
                            Enviar recupero a {cliente.nombre}
                        </DialogTitle>
                        <DialogDescription>
                            Se enviará un WhatsApp con la marca de tu local. {escalon.descuento > 0
                                ? `Incluye un cupón de ${escalon.descuento}% de descuento${escalon.nivel === 3 ? ' con vencimiento en 48 hs' : ''}.`
                                : 'Sin descuento: solo el antojo para que vuelva a pedir.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5">
                        <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400 flex items-center justify-center text-[10px] font-bold">{escalon.nivel}</span>
                            {escalon.titulo}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{escalon.detalle}</p>
                        <p className="text-[11px] text-muted-foreground/80">
                            Este mensaje consume 1 crédito del saldo <span className="font-medium">marketing</span>. Nunca se corta por saldo: si no te quedan, sale igual y queda a descontar de la próxima recarga.
                        </p>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-2">
                        <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={enviando}>
                            Cancelar
                        </Button>
                        <Button onClick={handleEnviarRecupero} disabled={enviando} className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
                            {enviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                            {enviando ? 'Enviando…' : 'Enviar ahora'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function SegmentoChip({ label, count, dot, active, onClick }: {
    label: string
    count: number
    dot?: string
    active: boolean
    onClick: () => void
}) {
    return (
        <button
            onClick={onClick}
            className={`
                inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium border transition-all
                ${active
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                }
            `}
        >
            {dot && <span className={`w-2 h-2 rounded-full ${active ? 'bg-background' : dot}`} />}
            {label}
            <span className={`tabular-nums font-semibold ${active ? 'opacity-80' : 'text-foreground/70'}`}>{count}</span>
        </button>
    )
}

function KPICard({ label, value, icon, color, bgColor, hint }: {
    label: string
    value: string
    icon: React.ReactNode
    color: string
    bgColor: string
    hint?: string
}) {
    return (
        <div className="flex items-center gap-3 bg-background border border-border/50 rounded-xl px-4 py-3">
            <div className={`w-9 h-9 rounded-lg ${bgColor} flex items-center justify-center ${color} shrink-0`}>
                {icon}
            </div>
            <div className="min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">{label}</p>
                <p className="text-base font-bold text-foreground tabular-nums truncate mt-0.5">{value}</p>
                {hint && <p className="text-[10px] text-muted-foreground/70 truncate -mt-0.5">{hint}</p>}
            </div>
        </div>
    )
}

function MetricCard({ label, value, icon, color }: {
    label: string
    value: string
    icon: React.ReactNode
    color: string
}) {
    return (
        <div className="bg-background border border-border/50 rounded-xl p-4 text-center">
            <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-muted/60 ${color} mb-2`}>
                {icon}
            </div>
            <p className="text-base font-bold text-foreground tabular-nums">{value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">{label}</p>
        </div>
    )
}

function ContactRow({ icon, label, value, action }: {
    icon: React.ReactNode
    label: string
    value: string
    action?: React.ReactNode
}) {
    return (
        <div className="px-4 py-3 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground shrink-0 mt-0.5">
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
                <p className="text-sm text-foreground mt-0.5 wrap-break-word">{value}</p>
                {action && <div className="mt-1">{action}</div>}
            </div>
        </div>
    )
}

function OrderRow({ pedido }: { pedido: PedidoHistorial }) {
    const [expanded, setExpanded] = useState(false)
    const isDelivery = pedido.tipo === 'delivery'
    const hasItems = pedido.items && pedido.items.length > 0

    return (
        <div>
            <button
                onClick={() => hasItems && setExpanded(!expanded)}
                className={`
                    w-full text-left px-4 py-3.5 flex items-center gap-3
                    transition-colors duration-100
                    ${hasItems ? 'cursor-pointer hover:bg-muted/30' : 'cursor-default'}
                    ${expanded ? 'bg-muted/20' : ''}
                `}
            >
                {/* Order Type Icon */}
                <div className={`
                    w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-sm
                    ${isDelivery
                        ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400'
                        : 'bg-sky-50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-400'
                    }
                `}>
                    {isDelivery ? <Truck className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
                </div>

                {/* Order Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                            {isDelivery ? 'Delivery' : 'Take Away'}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                            #{pedido.id}
                        </span>
                        {hasItems && (
                            <span className="text-[10px] text-muted-foreground">
                                · {pedido.items.reduce((acc, i) => acc + i.cantidad, 0)} items
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                        <CalendarDays className="w-3 h-3" />
                        <span>{formatDate(pedido.createdAt)}</span>
                        <span className="text-border">·</span>
                        <span>{formatTime(pedido.createdAt)}</span>
                    </div>
                </div>

                {/* Total + chevron */}
                <div className="flex items-center gap-2 shrink-0">
                    <p className="text-sm font-semibold text-foreground tabular-nums">
                        {formatCurrency(pedido.total)}
                    </p>
                    {hasItems && (
                        <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground/40 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />
                    )}
                </div>
            </button>

            {/* Expanded Items */}
            {expanded && hasItems && (
                <div className="px-4 pb-3 pt-0 ml-[52px]">
                    <div className="bg-muted/30 rounded-lg border border-border/40 divide-y divide-border/30 overflow-hidden">
                        {pedido.items.map((item, idx) => (
                            <div key={idx} className="px-3 py-2 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-xs font-medium text-muted-foreground bg-muted/80 w-5 h-5 rounded flex items-center justify-center shrink-0 tabular-nums">
                                        {item.cantidad}
                                    </span>
                                    <span className="text-sm text-foreground truncate">
                                        {item.nombreProducto}
                                    </span>
                                </div>
                                <span className="text-xs font-medium text-muted-foreground tabular-nums shrink-0">
                                    {formatCurrency(parseFloat(item.precioUnitario) * item.cantidad)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
