import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuthStore } from '@/store/authStore'
import { pedidosApi } from '@/lib/api'
import {
    X, Loader2, ShoppingCart,
    TrendingUp, Utensils, Truck,
    ShoppingBag, ChevronDown, ChevronRight,
    Package, ArrowLeft
} from 'lucide-react'

interface CierreTurnoItem {
    id: number
    productoId: number
    nombreProducto: string
    cantidad: number
    precioUnitario: string
    clienteNombre?: string
    estado?: string
}

interface CierreTurnoPedidoMesa {
    id: number
    mesaId: number | null
    nombrePedido: string | null
    estado: string
    total: string
    createdAt: string
    closedAt: string | null
    mesaNombre: string | null
    tipo: 'mesa'
    items: CierreTurnoItem[]
    totalItems: number
}

interface CierreTurnoPedidoDelivery {
    id: number
    direccion: string
    nombreCliente: string | null
    telefono: string | null
    estado: string
    total: string
    notas: string | null
    createdAt: string
    deliveredAt: string | null
    tipo: 'delivery'
    items: CierreTurnoItem[]
    totalItems: number
}

interface CierreTurnoPedidoTakeaway {
    id: number
    nombreCliente: string | null
    telefono: string | null
    estado: string
    total: string
    notas: string | null
    createdAt: string
    deliveredAt: string | null
    tipo: 'takeaway'
    items: CierreTurnoItem[]
    totalItems: number
}

type CierreTurnoPedido = CierreTurnoPedidoMesa | CierreTurnoPedidoDelivery | CierreTurnoPedidoTakeaway

interface ProductoVendido {
    nombre: string
    cantidad: number
    totalVendido: number
}

interface CierreTurnoData {
    fecha: string
    pedidosMesa: CierreTurnoPedidoMesa[]
    pedidosDelivery: CierreTurnoPedidoDelivery[]
    pedidosTakeaway: CierreTurnoPedidoTakeaway[]
    totales: {
        mesa: string
        delivery: string
        takeaway: string
        general: string
    }
    cantidades: {
        mesa: number
        delivery: number
        takeaway: number
        total: number
    }
    productosVendidos: ProductoVendido[]
    fechasDisponibles: string[]
}

interface CierreTurnoProps {
    open: boolean
    onClose: () => void
}

const getEstadoLabel = (estado: string) => {
    const map: Record<string, { label: string; color: string }> = {
        pending: { label: 'Pendiente', color: 'bg-amber-500/10 text-amber-700 border-amber-200' },
        preparing: { label: 'Preparando', color: 'bg-blue-500/10 text-blue-700 border-blue-200' },
        delivered: { label: 'Listo', color: 'bg-emerald-500/10 text-emerald-700 border-emerald-200' },
        served: { label: 'Entregado', color: 'bg-indigo-500/10 text-indigo-700 border-indigo-200' },
        closed: { label: 'Cerrado', color: 'bg-violet-500/10 text-violet-700 border-violet-200' },
        ready: { label: 'Listo', color: 'bg-emerald-500/10 text-emerald-700 border-emerald-200' },
        archived: { label: 'Archivado', color: 'bg-slate-500/10 text-slate-700 border-slate-200' },
        cancelled: { label: 'Cancelado', color: 'bg-red-500/10 text-red-700 border-red-200' },
    }
    return map[estado] || { label: estado, color: 'bg-gray-100 text-gray-600' }
}

const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

const formatDateLabel = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.getTime() === today.getTime()) return 'Hoy'
    if (date.getTime() === yesterday.getTime()) return 'Ayer'
    return date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export default function CierreTurno({ open, onClose }: CierreTurnoProps) {
    const token = useAuthStore((state) => state.token)
    const restaurante = useAuthStore((state) => state.restaurante)
    const [data, setData] = useState<CierreTurnoData | null>(null)
    const [loading, setLoading] = useState(false)
    const [selectedFecha, setSelectedFecha] = useState<string>('')
    const [expandedPedidos, setExpandedPedidos] = useState<Set<string>>(new Set())
    const [activeTab, setActiveTab] = useState<'resumen' | 'pedidos' | 'productos'>('resumen')

    const fetchCierreTurno = useCallback(async (fecha?: string) => {
        if (!token) return
        setLoading(true)
        try {
            const response = await pedidosApi.cierreTurno(token, fecha) as {
                success: boolean
                data: CierreTurnoData
            }
            if (response.success && response.data) {
                setData(response.data)
                if (!selectedFecha) {
                    setSelectedFecha(response.data.fecha)
                }
            }
        } catch (error) {
            console.error('Error fetching cierre de turno:', error)
        } finally {
            setLoading(false)
        }
    }, [token, selectedFecha])

    useEffect(() => {
        if (open) {
            setSelectedFecha('')
            setExpandedPedidos(new Set())
            setActiveTab('resumen')
            fetchCierreTurno()
        }
    }, [open])

    const handleFechaChange = (fecha: string) => {
        setSelectedFecha(fecha)
        setExpandedPedidos(new Set())
        fetchCierreTurno(fecha)
    }

    const togglePedido = (key: string) => {
        setExpandedPedidos(prev => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    const allPedidos = useMemo<CierreTurnoPedido[]>(() => {
        if (!data) return []
        return [
            ...data.pedidosMesa.filter(p => p.totalItems > 0),
            ...data.pedidosDelivery,
            ...data.pedidosTakeaway,
        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }, [data])

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
            {/* Header */}
            <div className="shrink-0 border-b bg-background/95 backdrop-blur">
                <div className="flex items-center justify-between px-3 py-2.5 sm:px-4 sm:py-3 lg:px-6">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 shrink-0" onClick={onClose}>
                            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                        </Button>
                        <div className="min-w-0">
                            <h1 className="text-base sm:text-lg lg:text-xl font-bold tracking-tight truncate">Cierre de Turno</h1>
                            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{restaurante?.nombre || 'Restaurante'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        {/* Date Picker */}
                        <Select value={selectedFecha} onValueChange={handleFechaChange}>
                            <SelectTrigger className="w-[130px] sm:w-[180px] lg:w-[220px] h-8 sm:h-9 text-xs sm:text-sm">
                                <SelectValue placeholder="Seleccionar día" />
                            </SelectTrigger>
                            <SelectContent>
                                {data?.fechasDisponibles.map(fecha => (
                                    <SelectItem key={fecha} value={fecha}>
                                        {formatDateLabel(fecha)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 hidden sm:flex" onClick={onClose}>
                            <X className="h-4 w-4 sm:h-5 sm:w-5" />
                        </Button>
                    </div>
                </div>

                {/* Tab navigation */}
                <div className="px-3 sm:px-4 lg:px-6 pb-2">
                    <div className="flex gap-1 bg-muted/50 p-1 rounded-lg w-full sm:w-fit">
                        <Button
                            variant={activeTab === 'resumen' ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-8 text-xs flex-1 sm:flex-none"
                            onClick={() => setActiveTab('resumen')}
                        >
                            <TrendingUp className="h-3.5 w-3.5 mr-1 sm:mr-1.5" />
                            <span className="hidden xs:inline">Resumen</span>
                            <span className="xs:hidden">📊</span>
                        </Button>
                        <Button
                            variant={activeTab === 'pedidos' ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-8 text-xs flex-1 sm:flex-none"
                            onClick={() => setActiveTab('pedidos')}
                        >
                            <ShoppingCart className="h-3.5 w-3.5 mr-1 sm:mr-1.5" />
                            Pedidos
                            {data && <Badge variant="secondary" className="ml-1 sm:ml-1.5 text-[10px] h-4 px-1">{data.cantidades.total}</Badge>}
                        </Button>
                        <Button
                            variant={activeTab === 'productos' ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-8 text-xs flex-1 sm:flex-none"
                            onClick={() => setActiveTab('productos')}
                        >
                            <Package className="h-3.5 w-3.5 mr-1 sm:mr-1.5" />
                            <span className="hidden sm:inline">Productos</span>
                            <span className="sm:hidden">Prod.</span>
                            {data && <Badge variant="secondary" className="ml-1 sm:ml-1.5 text-[10px] h-4 px-1">{data.productosVendidos.length}</Badge>}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center space-y-3">
                        <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                        <p className="text-sm text-muted-foreground">Cargando datos del turno...</p>
                    </div>
                </div>
            ) : !data ? (
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-muted-foreground">No hay datos disponibles</p>
                </div>
            ) : (
                <ScrollArea className="flex-1">
                    <div className="p-3 sm:p-4 lg:p-6 max-w-7xl mx-auto w-full space-y-4 sm:space-y-6">

                        {/* ==================== RESUMEN TAB ==================== */}
                        {activeTab === 'resumen' && (
                            <>
                                {/* Date title */}
                                <div className="text-center space-y-1 pb-1 sm:pb-2">
                                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold capitalize">
                                        {formatDateLabel(data.fecha)}
                                    </h2>
                                    <p className="text-xs sm:text-sm text-muted-foreground">
                                        {data.fecha}
                                    </p>
                                </div>

                                {/* Grand Total Card */}
                                <Card className="bg-linear-to-br from-primary/5 via-primary/10 to-primary/5 border-primary/20">
                                    <CardContent className="pt-4 sm:pt-6">
                                        <div className="text-center space-y-1 sm:space-y-2">
                                            <p className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Vendido</p>
                                            <p className="text-3xl sm:text-4xl lg:text-5xl font-bold text-primary">
                                                ${parseFloat(data.totales.general).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                            </p>
                                            <p className="text-[11px] sm:text-xs text-muted-foreground">
                                                {data.cantidades.total} pedido{data.cantidades.total !== 1 ? 's' : ''} en total
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Breakdown Cards */}
                                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                                    <Card>
                                        <CardContent className="p-3 sm:pt-5 sm:pb-4 sm:px-4">
                                            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-3">
                                                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                                    <Utensils className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                                                </div>
                                                <div className="min-w-0 text-center sm:text-left">
                                                    <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Mesas</p>
                                                    <p className="text-sm sm:text-xl font-bold">${parseFloat(data.totales.mesa).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                                                    <p className="text-[10px] sm:text-[11px] text-muted-foreground">{data.cantidades.mesa} pedido{data.cantidades.mesa !== 1 ? 's' : ''}</p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardContent className="p-3 sm:pt-5 sm:pb-4 sm:px-4">
                                            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-3">
                                                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                                                    <Truck className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
                                                </div>
                                                <div className="min-w-0 text-center sm:text-left">
                                                    <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Delivery</p>
                                                    <p className="text-sm sm:text-xl font-bold">${parseFloat(data.totales.delivery).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                                                    <p className="text-[10px] sm:text-[11px] text-muted-foreground">{data.cantidades.delivery} pedido{data.cantidades.delivery !== 1 ? 's' : ''}</p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardContent className="p-3 sm:pt-5 sm:pb-4 sm:px-4">
                                            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-3">
                                                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                                                    <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5 text-violet-600" />
                                                </div>
                                                <div className="min-w-0 text-center sm:text-left">
                                                    <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Take Away</p>
                                                    <p className="text-sm sm:text-xl font-bold">${parseFloat(data.totales.takeaway).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                                                    <p className="text-[10px] sm:text-[11px] text-muted-foreground">{data.cantidades.takeaway} pedido{data.cantidades.takeaway !== 1 ? 's' : ''}</p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Top Products quick view */}
                                {data.productosVendidos.length > 0 && (
                                    <Card>
                                        <CardHeader className="pb-3 px-3 sm:px-6">
                                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                                <TrendingUp className="h-4 w-4 text-primary" />
                                                Productos más vendidos
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="pt-0 px-3 sm:px-6">
                                            <div className="space-y-2">
                                                {data.productosVendidos.slice(0, 10).map((producto, i) => (
                                                    <div key={producto.nombre} className="flex items-center gap-2 sm:gap-3 py-1.5">
                                                        <span className="text-xs font-bold text-muted-foreground w-4 sm:w-5 text-right shrink-0">
                                                            {i + 1}.
                                                        </span>
                                                        <span className="text-xs sm:text-sm flex-1 truncate">{producto.nombre}</span>
                                                        <Badge variant="secondary" className="text-[10px] sm:text-xs shrink-0 font-mono">
                                                            x{producto.cantidad}
                                                        </Badge>
                                                        <span className="text-xs sm:text-sm font-semibold w-16 sm:w-24 text-right shrink-0">
                                                            ${producto.totalVendido.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                            {data.productosVendidos.length > 10 && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="w-full mt-2 text-xs"
                                                    onClick={() => setActiveTab('productos')}
                                                >
                                                    Ver todos ({data.productosVendidos.length} productos)
                                                </Button>
                                            )}
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Recent orders quick view */}
                                {allPedidos.length > 0 && (
                                    <Card>
                                        <CardHeader className="pb-3 px-3 sm:px-6">
                                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                                <ShoppingCart className="h-4 w-4 text-primary" />
                                                Últimos pedidos del día
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="pt-0 px-3 sm:px-6">
                                            <div className="space-y-2">
                                                {allPedidos.slice(0, 5).map(pedido => {
                                                    const estadoInfo = getEstadoLabel(pedido.estado)
                                                    const tipoIcon = pedido.tipo === 'mesa' ? '🍽️' : pedido.tipo === 'delivery' ? '🚚' : '🛍️'
                                                    const label = pedido.tipo === 'mesa'
                                                        ? ((pedido as CierreTurnoPedidoMesa).mesaNombre || 'Mesa')
                                                        : pedido.tipo === 'delivery'
                                                            ? ((pedido as CierreTurnoPedidoDelivery).nombreCliente || 'Delivery')
                                                            : ((pedido as CierreTurnoPedidoTakeaway).nombreCliente || 'Take Away')

                                                    return (
                                                        <div key={`${pedido.tipo}-${pedido.id}`} className="flex items-center gap-2 sm:gap-3 py-1.5">
                                                            <span className="text-sm sm:text-base shrink-0">{tipoIcon}</span>
                                                            <span className="text-xs sm:text-sm flex-1 truncate">{label}</span>
                                                            <Badge variant="outline" className={`text-[9px] sm:text-[10px] ${estadoInfo.color} shrink-0 hidden sm:flex`}>
                                                                {estadoInfo.label}
                                                            </Badge>
                                                            <span className="text-xs sm:text-sm font-semibold w-16 sm:w-24 text-right shrink-0">
                                                                ${parseFloat(pedido.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                            </span>
                                                            <span className="text-[10px] sm:text-xs text-muted-foreground w-10 sm:w-12 text-right shrink-0">
                                                                {formatTime(pedido.createdAt)}
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                            {allPedidos.length > 5 && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="w-full mt-2 text-xs"
                                                    onClick={() => setActiveTab('pedidos')}
                                                >
                                                    Ver todos ({allPedidos.length} pedidos)
                                                </Button>
                                            )}
                                        </CardContent>
                                    </Card>
                                )}
                            </>
                        )}

                        {/* ==================== PEDIDOS TAB ==================== */}
                        {activeTab === 'pedidos' && (
                            <>
                                <div className="flex items-center justify-between">
                                    <h2 className="text-sm sm:text-lg font-bold">
                                        Pedidos — <span className="capitalize">{formatDateLabel(data.fecha)}</span>
                                    </h2>
                                    <Badge variant="secondary" className="font-mono">{allPedidos.length}</Badge>
                                </div>

                                {allPedidos.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground">
                                        <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                        <p>No hay pedidos para este día</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Desktop: Spreadsheet table */}
                                        <div className="hidden sm:block border rounded-lg overflow-hidden bg-card">
                                            {/* Table header */}
                                            <div className="grid grid-cols-[40px_1fr_100px_90px_80px_60px] lg:grid-cols-[50px_1fr_120px_100px_110px_80px] bg-muted/50 border-b px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                <span>#</span>
                                                <span>Pedido</span>
                                                <span>Estado</span>
                                                <span className="text-right">Total</span>
                                                <span className="text-right">Hora</span>
                                                <span className="text-center">Items</span>
                                            </div>

                                            {/* Table rows */}
                                            <div className="divide-y">
                                                {allPedidos.map((pedido, index) => {
                                                    const key = `${pedido.tipo}-${pedido.id}`
                                                    const isExpanded = expandedPedidos.has(key)
                                                    const estadoInfo = getEstadoLabel(pedido.estado)
                                                    const tipoIcon = pedido.tipo === 'mesa' ? '🍽️' : pedido.tipo === 'delivery' ? '🚚' : '🛍️'
                                                    const label = pedido.tipo === 'mesa'
                                                        ? ((pedido as CierreTurnoPedidoMesa).mesaNombre || 'Mesa')
                                                        : pedido.tipo === 'delivery'
                                                            ? ((pedido as CierreTurnoPedidoDelivery).nombreCliente || 'Delivery')
                                                            : ((pedido as CierreTurnoPedidoTakeaway).nombreCliente || 'Take Away')
                                                    const subtitle = pedido.tipo === 'mesa'
                                                        ? ((pedido as CierreTurnoPedidoMesa).nombrePedido || '')
                                                        : pedido.tipo === 'delivery'
                                                            ? ((pedido as CierreTurnoPedidoDelivery).direccion || '')
                                                            : ''

                                                    return (
                                                        <div key={key}>
                                                            {/* Main Row */}
                                                            <div
                                                                className="grid grid-cols-[40px_1fr_100px_90px_80px_60px] lg:grid-cols-[50px_1fr_120px_100px_110px_80px] px-3 py-2.5 hover:bg-muted/30 cursor-pointer transition-colors items-center"
                                                                onClick={() => togglePedido(key)}
                                                            >
                                                                <span className="text-xs text-muted-foreground font-mono">{index + 1}</span>
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                                                                    <span className="text-sm shrink-0">{tipoIcon}</span>
                                                                    <div className="min-w-0">
                                                                        <p className="text-sm font-medium truncate">{label}</p>
                                                                        {subtitle && <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>}
                                                                    </div>
                                                                </div>
                                                                <Badge variant="outline" className={`text-[10px] w-fit ${estadoInfo.color}`}>
                                                                    {estadoInfo.label}
                                                                </Badge>
                                                                <span className="text-sm font-semibold text-right">
                                                                    ${parseFloat(pedido.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                                </span>
                                                                <span className="text-xs text-muted-foreground text-right">
                                                                    {formatTime(pedido.createdAt)}
                                                                </span>
                                                                <span className="text-xs font-mono text-center">
                                                                    {pedido.totalItems}
                                                                </span>
                                                            </div>

                                                            {/* Expanded Detail */}
                                                            {isExpanded && (
                                                                <div className="bg-muted/20 border-t px-3 py-3">
                                                                    <div className="ml-6 lg:ml-8">
                                                                        <div className="rounded-md border bg-background overflow-hidden">
                                                                            <div className="grid grid-cols-[1fr_60px_80px_90px] bg-muted/40 px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b">
                                                                                <span>Producto</span>
                                                                                <span className="text-center">Cant.</span>
                                                                                <span className="text-right">P. Unit.</span>
                                                                                <span className="text-right">Subtotal</span>
                                                                            </div>
                                                                            <div className="divide-y">
                                                                                {pedido.items.map(item => (
                                                                                    <div key={item.id} className="grid grid-cols-[1fr_60px_80px_90px] px-3 py-2 text-sm items-center">
                                                                                        <div className="min-w-0">
                                                                                            <p className="truncate text-sm">{item.nombreProducto}</p>
                                                                                            {item.clienteNombre && (
                                                                                                <p className="text-[11px] text-muted-foreground truncate">por {item.clienteNombre}</p>
                                                                                            )}
                                                                                        </div>
                                                                                        <span className="text-center text-xs font-mono">{item.cantidad}</span>
                                                                                        <span className="text-right text-xs">${parseFloat(item.precioUnitario).toFixed(2)}</span>
                                                                                        <span className="text-right text-xs font-semibold">
                                                                                            ${(parseFloat(item.precioUnitario) * (item.cantidad || 1)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                                                        </span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                            <div className="grid grid-cols-[1fr_60px_80px_90px] px-3 py-2 border-t bg-muted/30 font-semibold text-sm">
                                                                                <span>Total</span>
                                                                                <span className="text-center text-xs font-mono">{pedido.totalItems}</span>
                                                                                <span></span>
                                                                                <span className="text-right">${parseFloat(pedido.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                                                            </div>
                                                                        </div>

                                                                        {pedido.tipo === 'delivery' && (
                                                                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                                                                {(pedido as CierreTurnoPedidoDelivery).direccion && (
                                                                                    <span>📍 {(pedido as CierreTurnoPedidoDelivery).direccion}</span>
                                                                                )}
                                                                                {(pedido as CierreTurnoPedidoDelivery).telefono && (
                                                                                    <span>📞 {(pedido as CierreTurnoPedidoDelivery).telefono}</span>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>

                                            {/* Grand total footer */}
                                            <div className="grid grid-cols-[40px_1fr_100px_90px_80px_60px] lg:grid-cols-[50px_1fr_120px_100px_110px_80px] px-3 py-3 bg-primary/5 border-t-2 border-primary/20 font-bold text-sm">
                                                <span></span>
                                                <span>Total General</span>
                                                <span></span>
                                                <span className="text-right text-primary">
                                                    ${parseFloat(data.totales.general).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                </span>
                                                <span></span>
                                                <span></span>
                                            </div>
                                        </div>

                                        {/* Mobile: Card-based layout */}
                                        <div className="sm:hidden space-y-2">
                                            {allPedidos.map((pedido, index) => {
                                                const key = `${pedido.tipo}-${pedido.id}`
                                                const isExpanded = expandedPedidos.has(key)
                                                const estadoInfo = getEstadoLabel(pedido.estado)
                                                const tipoIcon = pedido.tipo === 'mesa' ? '🍽️' : pedido.tipo === 'delivery' ? '🚚' : '🛍️'
                                                const label = pedido.tipo === 'mesa'
                                                    ? ((pedido as CierreTurnoPedidoMesa).mesaNombre || 'Mesa')
                                                    : pedido.tipo === 'delivery'
                                                        ? ((pedido as CierreTurnoPedidoDelivery).nombreCliente || 'Delivery')
                                                        : ((pedido as CierreTurnoPedidoTakeaway).nombreCliente || 'Take Away')

                                                return (
                                                    <div key={key} className="border rounded-lg bg-card overflow-hidden">
                                                        {/* Card header */}
                                                        <div
                                                            className="flex items-center gap-2 p-3 cursor-pointer active:bg-muted/30 transition-colors"
                                                            onClick={() => togglePedido(key)}
                                                        >
                                                            {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                                                            <span className="text-xs text-muted-foreground font-mono shrink-0">#{index + 1}</span>
                                                            <span className="shrink-0">{tipoIcon}</span>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-medium truncate">{label}</p>
                                                            </div>
                                                            <div className="flex flex-col items-end gap-0.5 shrink-0">
                                                                <span className="text-sm font-bold">
                                                                    ${parseFloat(pedido.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                                </span>
                                                                <div className="flex items-center gap-1.5">
                                                                    <Badge variant="outline" className={`text-[9px] py-0 h-4 ${estadoInfo.color}`}>
                                                                        {estadoInfo.label}
                                                                    </Badge>
                                                                    <span className="text-[10px] text-muted-foreground">{formatTime(pedido.createdAt)}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Expanded items */}
                                                        {isExpanded && (
                                                            <div className="border-t bg-muted/10">
                                                                <div className="divide-y">
                                                                    {pedido.items.map(item => (
                                                                        <div key={item.id} className="flex items-center justify-between px-3 py-2">
                                                                            <div className="flex-1 min-w-0 mr-2">
                                                                                <p className="text-xs font-medium truncate">{item.nombreProducto}</p>
                                                                                {item.clienteNombre && (
                                                                                    <p className="text-[10px] text-muted-foreground">por {item.clienteNombre}</p>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex items-center gap-2 shrink-0">
                                                                                <span className="text-[10px] text-muted-foreground font-mono">x{item.cantidad}</span>
                                                                                <span className="text-xs font-semibold w-16 text-right">
                                                                                    ${(parseFloat(item.precioUnitario) * (item.cantidad || 1)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                {/* Total */}
                                                                <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/30 font-semibold">
                                                                    <span className="text-xs">Total ({pedido.totalItems} items)</span>
                                                                    <span className="text-sm">${parseFloat(pedido.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                                                </div>

                                                                {/* Extra info for delivery */}
                                                                {pedido.tipo === 'delivery' && (
                                                                    <div className="px-3 py-2 border-t flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                                                                        {(pedido as CierreTurnoPedidoDelivery).direccion && (
                                                                            <span>📍 {(pedido as CierreTurnoPedidoDelivery).direccion}</span>
                                                                        )}
                                                                        {(pedido as CierreTurnoPedidoDelivery).telefono && (
                                                                            <span>📞 {(pedido as CierreTurnoPedidoDelivery).telefono}</span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}

                                            {/* Mobile grand total */}
                                            <div className="border rounded-lg bg-primary/5 border-primary/20 p-3 flex items-center justify-between font-bold">
                                                <span className="text-sm">Total General</span>
                                                <span className="text-lg text-primary">
                                                    ${parseFloat(data.totales.general).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </>
                        )}

                        {/* ==================== PRODUCTOS TAB ==================== */}
                        {activeTab === 'productos' && (
                            <>
                                <div className="flex items-center justify-between">
                                    <h2 className="text-sm sm:text-lg font-bold">
                                        Productos — <span className="capitalize">{formatDateLabel(data.fecha)}</span>
                                    </h2>
                                    <Badge variant="secondary" className="font-mono">{data.productosVendidos.length}</Badge>
                                </div>

                                {data.productosVendidos.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground">
                                        <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                        <p>No hay productos vendidos este día</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Desktop: Table */}
                                        <div className="hidden sm:block border rounded-lg overflow-hidden bg-card">
                                            <div className="grid grid-cols-[50px_1fr_80px_120px_80px] lg:grid-cols-[60px_1fr_100px_140px_80px] bg-muted/50 border-b px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                <span>#</span>
                                                <span>Producto</span>
                                                <span className="text-center">Cantidad</span>
                                                <span className="text-right">Total Vendido</span>
                                                <span className="text-right">% del Total</span>
                                            </div>

                                            <div className="divide-y">
                                                {data.productosVendidos.map((producto, index) => {
                                                    const totalGeneral = parseFloat(data.totales.general)
                                                    const porcentaje = totalGeneral > 0 ? (producto.totalVendido / totalGeneral * 100) : 0

                                                    return (
                                                        <div
                                                            key={producto.nombre}
                                                            className="grid grid-cols-[50px_1fr_80px_120px_80px] lg:grid-cols-[60px_1fr_100px_140px_80px] px-3 py-2.5 hover:bg-muted/30 transition-colors items-center"
                                                        >
                                                            <span className="text-xs text-muted-foreground font-mono">{index + 1}</span>
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-medium truncate">{producto.nombre}</p>
                                                            </div>
                                                            <div className="text-center">
                                                                <Badge variant="secondary" className="font-mono text-xs">x{producto.cantidad}</Badge>
                                                            </div>
                                                            <span className="text-sm font-semibold text-right">
                                                                ${producto.totalVendido.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground text-right">
                                                                {porcentaje.toFixed(1)}%
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                            </div>

                                            <div className="grid grid-cols-[50px_1fr_80px_120px_80px] lg:grid-cols-[60px_1fr_100px_140px_80px] px-3 py-3 bg-primary/5 border-t-2 border-primary/20 font-bold text-sm">
                                                <span></span>
                                                <span>Total</span>
                                                <div className="text-center">
                                                    <Badge variant="secondary" className="font-mono text-xs">
                                                        x{data.productosVendidos.reduce((sum, p) => sum + p.cantidad, 0)}
                                                    </Badge>
                                                </div>
                                                <span className="text-right text-primary">
                                                    ${parseFloat(data.totales.general).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                </span>
                                                <span className="text-right text-xs">100%</span>
                                            </div>
                                        </div>

                                        {/* Mobile: Product list */}
                                        <div className="sm:hidden space-y-1">
                                            {data.productosVendidos.map((producto, index) => {
                                                const totalGeneral = parseFloat(data.totales.general)
                                                const porcentaje = totalGeneral > 0 ? (producto.totalVendido / totalGeneral * 100) : 0

                                                return (
                                                    <div key={producto.nombre} className="flex items-center gap-2 py-2.5 px-1 border-b border-border/40 last:border-0">
                                                        <span className="text-[10px] font-bold text-muted-foreground w-5 text-right shrink-0">
                                                            {index + 1}.
                                                        </span>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-medium truncate">{producto.nombre}</p>
                                                            <p className="text-[10px] text-muted-foreground">{porcentaje.toFixed(1)}% del total</p>
                                                        </div>
                                                        <Badge variant="secondary" className="font-mono text-[10px] shrink-0">x{producto.cantidad}</Badge>
                                                        <span className="text-xs font-semibold w-16 text-right shrink-0">
                                                            ${producto.totalVendido.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                )
                                            })}

                                            {/* Mobile total */}
                                            <div className="border rounded-lg bg-primary/5 border-primary/20 p-3 flex items-center justify-between font-bold mt-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm">Total</span>
                                                    <Badge variant="secondary" className="font-mono text-[10px]">
                                                        x{data.productosVendidos.reduce((sum, p) => sum + p.cantidad, 0)}
                                                    </Badge>
                                                </div>
                                                <span className="text-lg text-primary">
                                                    ${parseFloat(data.totales.general).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </>
                        )}

                    </div>
                </ScrollArea>
            )}
        </div>
    )
}
