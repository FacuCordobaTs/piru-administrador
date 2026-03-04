import { useState, useEffect, useMemo, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAuthStore } from '@/store/authStore'
import { clientesApi } from '@/lib/api'
import {
    Search, MapPin, Phone, CalendarDays,
    ShoppingBag, DollarSign, ChevronRight,
    User, TrendingUp, Users,
    MessageCircle, ExternalLink, X,
    Clock, Truck, Package, ArrowUpRight, Star
} from 'lucide-react'

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

const getClientTier = (orders: number, spent: number): { label: string, color: string, bg: string, icon: typeof Star } => {
    if (orders > 10 || spent > 100000)
        return { label: 'VIP', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800', icon: Star }
    if (orders > 3)
        return { label: 'Recurrente', color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800', icon: TrendingUp }
    return { label: 'Nuevo', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800', icon: User }
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
// MAIN COMPONENT
// =============================================================================
export default function Clientes() {
    const token = useAuthStore(state => state.token)
    const [clientes, setClientes] = useState<Cliente[]>([])
    const [loading, setLoading] = useState(true)
    const [query, setQuery] = useState('')
    const [sortBy, setSortBy] = useState('recent')
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

    // Filter + Sort
    const filteredAndSorted = useMemo(() => {
        let result = [...clientes]

        if (query) {
            const q = query.toLowerCase()
            result = result.filter(c =>
                c.nombre.toLowerCase().includes(q) ||
                c.telefono.includes(q) ||
                (c.direccion && c.direccion.toLowerCase().includes(q))
            )
        }

        result.sort((a, b) => {
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
    }, [clientes, query, sortBy])

    // Stats
    const stats = useMemo(() => {
        const totalClients = clientes.length
        const totalRevenue = clientes.reduce((acc, c) => acc + c.totalGastado, 0)
        const totalOrders = clientes.reduce((acc, c) => acc + c.cantidadPedidos, 0)
        const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0
        const vipCount = clientes.filter(c => c.cantidadPedidos > 10 || c.totalGastado > 100000).length
        return { totalClients, totalRevenue, avgTicket, totalOrders, vipCount }
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

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
            {/* ============================================================= */}
            {/* TOP HEADER — KPI Strip */}
            {/* ============================================================= */}
            <div className="border-b bg-background/80 backdrop-blur-xl sticky top-0 z-20">
                <div className="px-6 py-5">
                    {/* Title Row */}
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h1 className="text-xl font-semibold tracking-tight text-foreground">Clientes</h1>
                            <p className="text-[13px] text-muted-foreground mt-0.5">
                                {stats.totalClients} clientes · {stats.totalOrders} pedidos totales
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
                            label="Ingresos"
                            value={formatCurrency(stats.totalRevenue)}
                            icon={<DollarSign className="w-4 h-4" />}
                            color="text-emerald-600 dark:text-emerald-400"
                            bgColor="bg-emerald-50 dark:bg-emerald-950/50"
                        />
                        <KPICard
                            label="Ticket Promedio"
                            value={formatCurrency(stats.avgTicket || 0)}
                            icon={<TrendingUp className="w-4 h-4" />}
                            color="text-violet-600 dark:text-violet-400"
                            bgColor="bg-violet-50 dark:bg-violet-950/50"
                        />
                        <KPICard
                            label="Clientes VIP"
                            value={stats.vipCount.toString()}
                            icon={<Star className="w-4 h-4" />}
                            color="text-amber-600 dark:text-amber-400"
                            bgColor="bg-amber-50 dark:bg-amber-950/50"
                        />
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
                                <SelectTrigger className="w-[150px] h-9 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
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
                                    No se encontraron clientes. Probá ajustando tu búsqueda.
                                </p>
                            </div>
                        ) : (
                            <div className="py-1">
                                {filteredAndSorted.map(cliente => {
                                    const tier = getClientTier(cliente.cantidadPedidos, cliente.totalGastado)
                                    const isSelected = selectedClientId === cliente.id

                                    return (
                                        <button
                                            key={cliente.id}
                                            onClick={() => setSelectedClientId(cliente.id)}
                                            className={`
                                                w-full text-left px-4 py-3 flex items-center gap-3
                                                transition-all duration-150 cursor-pointer border-b border-transparent
                                                ${isSelected
                                                    ? 'bg-primary/6 dark:bg-primary/12 border-b-border/50'
                                                    : 'hover:bg-muted/50 border-b-border/30'
                                                }
                                            `}
                                        >
                                            {/* Avatar */}
                                            <div className={`
                                                w-10 h-10 rounded-full bg-linear-to-br ${getAvatarColor(cliente.id)}
                                                flex items-center justify-center text-white text-sm font-semibold
                                                shrink-0 shadow-sm
                                            `}>
                                                {getInitials(cliente.nombre)}
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-sm font-medium truncate ${isSelected ? 'text-foreground' : 'text-foreground/90'}`}>
                                                        {cliente.nombre}
                                                    </span>
                                                    {tier.label === 'VIP' && (
                                                        <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded-md">
                                                            VIP
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                                                    <span>{cliente.cantidadPedidos} pedidos</span>
                                                    <span className="text-border">·</span>
                                                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                                        {formatCurrency(cliente.totalGastado)}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Right side */}
                                            <div className="flex flex-col items-end gap-1 shrink-0">
                                                <span className="text-[11px] text-muted-foreground">
                                                    {getTimeSince(cliente.ultimoPedidoAt)}
                                                </span>
                                                <ChevronRight className={`w-3.5 h-3.5 transition-colors ${isSelected ? 'text-primary' : 'text-muted-foreground/30'}`} />
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </ScrollArea>
                </div>

                {/* ===== RIGHT PANEL — Client Detail ===== */}
                {selectedClient ? (
                    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-muted/20">
                        {/* Detail Header */}
                        <div className="px-6 py-5 bg-background border-b">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    {/* Mobile back button */}
                                    <button
                                        onClick={() => setSelectedClientId(null)}
                                        className="lg:hidden p-1.5 -ml-1 rounded-lg hover:bg-muted transition-colors"
                                    >
                                        <ChevronRight className="w-4 h-4 rotate-180" />
                                    </button>

                                    {/* Large avatar */}
                                    <div className={`
                                        w-14 h-14 rounded-2xl bg-linear-to-br ${getAvatarColor(selectedClient.id)}
                                        flex items-center justify-center text-white text-lg font-bold
                                        shadow-lg shadow-black/10
                                    `}>
                                        {getInitials(selectedClient.nombre)}
                                    </div>

                                    <div>
                                        <div className="flex items-center gap-2.5">
                                            <h2 className="text-lg font-semibold text-foreground">
                                                {selectedClient.nombre}
                                            </h2>
                                            {(() => {
                                                const tier = getClientTier(selectedClient.cantidadPedidos, selectedClient.totalGastado)
                                                return (
                                                    <Badge
                                                        variant="outline"
                                                        className={`text-[10px] h-5 px-2 font-semibold ${tier.bg} ${tier.color} border`}
                                                    >
                                                        {tier.label}
                                                    </Badge>
                                                )
                                            })()}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Cliente desde {formatDate(selectedClient.createdAt)}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1.5">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => openWhatsApp(selectedClient.telefono, e)}
                                        className="h-8 px-3 gap-1.5 text-xs font-medium text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-950/30"
                                    >
                                        <MessageCircle className="w-3.5 h-3.5" />
                                        WhatsApp
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => setSelectedClientId(null)}
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

                                {/* ---- Metrics Row ---- */}
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                    <MetricCard
                                        label="Total Pedidos"
                                        value={selectedClient.cantidadPedidos.toString()}
                                        icon={<ShoppingBag className="w-4 h-4" />}
                                        color="text-blue-600 dark:text-blue-400"
                                    />
                                    <MetricCard
                                        label="Total Gastado"
                                        value={formatCurrency(selectedClient.totalGastado)}
                                        icon={<DollarSign className="w-4 h-4" />}
                                        color="text-emerald-600 dark:text-emerald-400"
                                    />
                                    <MetricCard
                                        label="Ticket Prom."
                                        value={selectedClient.cantidadPedidos > 0
                                            ? formatCurrency(selectedClient.totalGastado / selectedClient.cantidadPedidos)
                                            : '$0'
                                        }
                                        icon={<TrendingUp className="w-4 h-4" />}
                                        color="text-violet-600 dark:text-violet-400"
                                    />
                                    <MetricCard
                                        label="Puntos"
                                        value={(selectedClient.puntos || 0).toString()}
                                        icon={<Star className="w-4 h-4" />}
                                        color="text-orange-600 dark:text-orange-400"
                                    />
                                </div>

                                {/* ---- Contact Info Card ---- */}
                                <div className="bg-background rounded-xl border border-border/60 overflow-hidden">
                                    <div className="px-4 py-3 border-b border-border/40">
                                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                            Información de Contacto
                                        </h3>
                                    </div>
                                    <div className="divide-y divide-border/40">
                                        <ContactRow
                                            icon={<Phone className="w-4 h-4" />}
                                            label="Teléfono"
                                            value={selectedClient.telefono}
                                            action={
                                                <button
                                                    onClick={(e) => openWhatsApp(selectedClient.telefono, e)}
                                                    className="text-xs text-green-600 dark:text-green-400 hover:underline flex items-center gap-1 font-medium"
                                                >
                                                    Enviar mensaje <ArrowUpRight className="w-3 h-3" />
                                                </button>
                                            }
                                        />
                                        <ContactRow
                                            icon={<MapPin className="w-4 h-4" />}
                                            label="Dirección"
                                            value={selectedClient.direccion || 'Retira en local'}
                                        />
                                        <ContactRow
                                            icon={<CalendarDays className="w-4 h-4" />}
                                            label="Primer Pedido"
                                            value={formatDateLong(selectedClient.createdAt)}
                                        />
                                        <ContactRow
                                            icon={<Clock className="w-4 h-4" />}
                                            label="Último Pedido"
                                            value={selectedClient.ultimoPedidoAt
                                                ? `${formatDateLong(selectedClient.ultimoPedidoAt)} — ${getTimeSince(selectedClient.ultimoPedidoAt)}`
                                                : 'Sin pedidos'
                                            }
                                        />
                                    </div>
                                </div>

                                {/* ---- Order History ---- */}
                                <div className="bg-background rounded-xl border border-border/60 overflow-hidden">
                                    <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
                                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                            Historial de Pedidos
                                        </h3>
                                        <span className="text-xs text-muted-foreground tabular-nums">
                                            {selectedClient.pedidos.length} pedidos
                                        </span>
                                    </div>

                                    {selectedClient.pedidos.length === 0 ? (
                                        <div className="px-4 py-10 text-center">
                                            <Package className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                                            <p className="text-sm text-muted-foreground">Sin pedidos registrados</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-border/30">
                                            {selectedClient.pedidos.map((pedido) => (
                                                <OrderRow key={pedido.id} pedido={pedido} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </ScrollArea>
                    </div>
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
                                Elegí un cliente de la lista para ver su información de contacto, historial de pedidos y métricas.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function KPICard({ label, value, icon, color, bgColor }: {
    label: string
    value: string
    icon: React.ReactNode
    color: string
    bgColor: string
}) {
    return (
        <div className="flex items-center gap-3 bg-background border border-border/50 rounded-xl px-4 py-3">
            <div className={`w-9 h-9 rounded-lg ${bgColor} flex items-center justify-center ${color} shrink-0`}>
                {icon}
            </div>
            <div className="min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">{label}</p>
                <p className="text-base font-bold text-foreground tabular-nums truncate mt-0.5">{value}</p>
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