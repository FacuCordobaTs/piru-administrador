import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { pedidosApi, mercadopagoApi, ApiError } from '@/lib/api'
import { useAdminWebSocket } from '@/hooks/useAdminWebSocket'
import { toast } from 'sonner'
import {
  Loader2, Search, Clock, CheckCircle, ChefHat, Utensils,
  ShoppingCart, RefreshCw, Wifi, WifiOff, Trash2,
  AlertTriangle, Play, X
} from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// Types
interface ItemPedido {
  id: number
  productoId: number
  clienteNombre: string
  cantidad: number
  precioUnitario: string
  nombreProducto?: string
  imagenUrl?: string | null
  ingredientesExcluidos?: number[]
  ingredientesExcluidosNombres?: string[]
}

interface PedidoData {
  id: number
  mesaId: number | null
  mesaNombre: string | null
  estado: 'pending' | 'preparing' | 'delivered' | 'closed'
  total: string
  createdAt: string
  closedAt?: string | null
  items: ItemPedido[]
  totalItems: number
  nombrePedido?: string | null  // Carrito mode
}

// Helper para calcular minutos transcurridos
const getMinutesAgo = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  return Math.floor(diffMs / 60000)
}

// Formato de tiempo legible
const formatTimeAgo = (dateString: string) => {
  const minutes = getMinutesAgo(dateString)
  if (minutes < 1) return 'Ahora'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${minutes % 60}m`
  return new Date(dateString).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

// Columnas del Kanban
const COLUMNS = [
  // { 
  //   id: 'pending', 
  //   title: 'Nuevos', 
  //   icon: Clock, 
  //   color: 'text-amber-600',
  //   bgHeader: 'bg-amber-100 dark:bg-amber-900/30',
  //   description: 'Por confirmar'
  // },
  {
    id: 'preparing',
    title: 'En Cocina',
    icon: ChefHat,
    color: 'text-blue-600',
    bgHeader: 'bg-blue-100 dark:bg-blue-900/30',
    description: 'Preparando'
  },
  {
    id: 'delivered',
    title: 'Listos',
    icon: Utensils,
    color: 'text-emerald-600',
    bgHeader: 'bg-emerald-100 dark:bg-emerald-900/30',
    description: 'Para entregar'
  },
]

const Pedidos = () => {
  const navigate = useNavigate()
  const token = useAuthStore((state) => state.token)
  const { restaurante } = useRestauranteStore()
  const esCarrito = restaurante?.esCarrito || false

  // WebSocket para actualizaciones en tiempo real
  const { mesas: mesasWS, isConnected } = useAdminWebSocket()

  // State
  const [pedidos, setPedidos] = useState<PedidoData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showClosed, setShowClosed] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [updatingPedido, setUpdatingPedido] = useState<number | null>(null)

  // Estado para eliminar pedido
  const [pedidoAEliminar, setPedidoAEliminar] = useState<PedidoData | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Estado para trackear qué pedidos cerrados tienen todos los pagos completados
  const [pedidosCerradosPagados, setPedidosCerradosPagados] = useState<Set<number>>(new Set())

  // Actualizar tiempo cada 30 segundos
  const [, setTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000)
    return () => clearInterval(interval)
  }, [])

  // Fetch pedidos desde API REST
  const fetchPedidos = useCallback(async (pageNum = 1, append = false) => {
    if (!token) return

    if (pageNum === 1) setIsLoading(true)
    else setIsLoadingMore(true)

    try {
      const response = await pedidosApi.getAll(token, pageNum, 50) as {
        success: boolean
        data: PedidoData[]
        pagination: { hasMore: boolean }
      }

      if (response.success && response.data) {
        if (append) {
          setPedidos(prev => [...prev, ...response.data])
        } else {
          setPedidos(response.data)
        }
        setHasMore(response.pagination.hasMore)
      }
    } catch (error) {
      console.error('Error fetching pedidos:', error)
      if (error instanceof ApiError) {
        toast.error('Error al cargar pedidos', { description: error.message })
      }
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [token])

  // Initial fetch
  useEffect(() => {
    setPage(1)
    fetchPedidos(1, false)
  }, [token])

  // Actualizar pedidos activos desde WebSocket
  useEffect(() => {
    if (mesasWS.length > 0) {
      setPedidos(prev => {
        let updated = prev.map(pedido => {
          const mesaWS = mesasWS.find(m => m.pedido?.id === pedido.id)
          if (mesaWS && mesaWS.pedido) {
            return {
              ...pedido,
              estado: mesaWS.pedido.estado,
              total: mesaWS.pedido.total,
              items: mesaWS.items,
              totalItems: mesaWS.totalItems
            }
          }
          return pedido
        })

        // Agregar nuevos pedidos que no estaban en la lista
        mesasWS.forEach(mesa => {
          if (mesa.pedido && mesa.pedido.estado !== 'closed') {
            const exists = updated.some(p => p.id === mesa.pedido!.id)
            if (!exists) {
              const newPedido: PedidoData = {
                id: mesa.pedido!.id,
                mesaId: mesa.id,
                mesaNombre: mesa.nombre,
                estado: mesa.pedido!.estado,
                total: mesa.pedido!.total,
                createdAt: mesa.pedido!.createdAt,
                closedAt: mesa.pedido!.closedAt,
                items: mesa.items,
                totalItems: mesa.totalItems,
                nombrePedido: mesa.pedido!.nombrePedido
              }
              updated = [newPedido, ...updated]
            }
          }
        })

        return updated
      })
    }
  }, [mesasWS])

  // Cargar más
  const loadMore = () => {
    if (!isLoadingMore && hasMore) {
      const nextPage = page + 1
      setPage(nextPage)
      fetchPedidos(nextPage, true)
    }
  }

  // Cambiar estado del pedido
  const handleChangeEstado = async (pedido: PedidoData, nuevoEstado: string) => {
    if (!token) return

    setUpdatingPedido(pedido.id)
    try {
      if (nuevoEstado === 'preparing') {
        await pedidosApi.confirmar(token, pedido.id)
      } else {
        await pedidosApi.updateEstado(token, pedido.id, nuevoEstado)
      }

      // Actualizar localmente
      setPedidos(prev => prev.map(p =>
        p.id === pedido.id ? { ...p, estado: nuevoEstado as PedidoData['estado'] } : p
      ))

      const estadoLabels: Record<string, string> = {
        preparing: 'En cocina',
        delivered: 'Listo para entregar',
        closed: 'Cerrado'
      }
      toast.success(`Pedido #${pedido.id} → ${estadoLabels[nuevoEstado]}`)
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error('Error al actualizar', { description: error.message })
      }
    } finally {
      setUpdatingPedido(null)
    }
  }

  // Eliminar pedido
  const handleDeletePedido = async () => {
    if (!token || !pedidoAEliminar) return

    setIsDeleting(true)
    try {
      await pedidosApi.delete(token, pedidoAEliminar.id)
      toast.success('Pedido eliminado', {
        description: `El pedido #${pedidoAEliminar.id} ha sido eliminado`
      })
      setPedidos(prev => prev.filter(p => p.id !== pedidoAEliminar.id))
      setPedidoAEliminar(null)
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error('Error al eliminar', { description: error.message })
      }
    } finally {
      setIsDeleting(false)
    }
  }

  // Filtrar y agrupar pedidos
  const filteredPedidos = useMemo(() => {
    return pedidos.filter(pedido => {
      // Filtrar cerrados si no se quieren ver
      if (!showClosed && pedido.estado === 'closed') return false

      // Filtrar por búsqueda
      if (!searchTerm) return true
      const search = searchTerm.toLowerCase()
      return (
        pedido.mesaNombre?.toLowerCase().includes(search) ||
        pedido.id.toString().includes(search) ||
        pedido.items.some(item =>
          item.clienteNombre?.toLowerCase().includes(search) ||
          item.nombreProducto?.toLowerCase().includes(search)
        )
      )
    })
  }, [pedidos, searchTerm, showClosed])

  // Verificar pagos de pedidos cerrados
  useEffect(() => {
    const verificarPagos = async () => {
      const pedidosCerrados = filteredPedidos.filter(p => p.estado === 'closed')
      if (pedidosCerrados.length === 0) return

      const nuevosPagados = new Set<number>()

      await Promise.all(
        pedidosCerrados.map(async (pedido) => {
          try {
            const response = await mercadopagoApi.getSubtotales(pedido.id) as {
              success: boolean
              resumen?: { todoPagado: boolean }
            }

            if (response.success && response.resumen?.todoPagado) {
              nuevosPagados.add(pedido.id)
            }
          } catch (error) {
            console.error(`Error verificando pagos del pedido ${pedido.id}:`, error)
          }
        })
      )

      setPedidosCerradosPagados(nuevosPagados)
    }

    verificarPagos()
  }, [filteredPedidos])

  // Agrupar por columna
  const pedidosByColumn = useMemo(() => {
    const grouped: Record<string, PedidoData[]> = {
      pending: [],
      preparing: [],
      delivered: [],
      closedPending: [], // Cerrados pero pendientes de pago
      closedPaid: [], // Cerrados y pagados
    }

    filteredPedidos.forEach(pedido => {
      if (pedido.estado === 'closed') {
        // Separar cerrados según si todos pagaron
        if (pedidosCerradosPagados.has(pedido.id)) {
          grouped.closedPaid.push(pedido)
        } else {
          grouped.closedPending.push(pedido)
        }
      } else if (grouped[pedido.estado]) {
        grouped[pedido.estado].push(pedido)
      }
    })

    // Ordenar cada columna por tiempo (más antiguos primero para urgencia)
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
    })

    return grouped
  }, [filteredPedidos, pedidosCerradosPagados])

  // Contar totales
  const counts = useMemo(() => ({
    pending: pedidosByColumn.pending.length,
    preparing: pedidosByColumn.preparing.length,
    delivered: pedidosByColumn.delivered.length,
    total: filteredPedidos.filter(p => p.estado !== 'closed').length
  }), [pedidosByColumn, filteredPedidos])

  // Componente de tarjeta de pedido
  const PedidoCard = ({ pedido, compact = false }: { pedido: PedidoData; compact?: boolean }) => {
    const isUpdating = updatingPedido === pedido.id

    // Acción principal según estado
    const getNextAction = () => {
      switch (pedido.estado) {
        case 'pending':
          return { label: 'Confirmar', icon: Play, estado: 'preparing', color: 'bg-blue-600 hover:bg-blue-700' }
        case 'preparing':
          return { label: 'Listo', icon: CheckCircle, estado: 'delivered', color: 'bg-emerald-600 hover:bg-emerald-700' }
        case 'delivered':
          return { label: 'Cerrar', icon: CheckCircle, estado: 'closed', color: 'bg-slate-600 hover:bg-slate-700' }
        default:
          return null
      }
    }

    const nextAction = getNextAction()
    const maxItems = compact ? 2 : 4
    const hasExclusions = pedido.items.some(i => i.ingredientesExcluidosNombres?.length)

    return (
      <Card
        className={`transition-all duration-200 border-2 cursor-pointer group `}
        onClick={() => navigate(`/dashboard/pedidos/${pedido.id}`)}
      >
        <CardContent className="p-0">
          {/* Header: Mesa + Tiempo */}
          <div className="flex items-center justify-between p-3 pb-2">
            <div className="flex items-center gap-2 min-w-0">
              {/* Mesa/Pedido - GRANDE y prominente */}
              <div className="text-2xl font-black text-foreground truncate">
                {esCarrito && pedido.nombrePedido
                  ? `Pedido de ${pedido.nombrePedido}`
                  : (pedido.mesaNombre || `Mesa ?`)}
              </div>
              {hasExclusions && (
                <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
              )}
            </div>


          </div>

          {/* Items del pedido */}
          <div className="px-3 pb-2 space-y-1">
            {pedido.items.slice(0, maxItems).map((item) => (
              <div key={item.id} className="flex items-start gap-2 text-sm">
                <span className="font-bold text-foreground shrink-0 w-5">
                  {item.cantidad}×
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-foreground/90 font-medium truncate block">
                    {item.nombreProducto}
                  </span>
                  {item.ingredientesExcluidosNombres && item.ingredientesExcluidosNombres.length > 0 && (
                    <span className="text-xs text-orange-600 dark:text-orange-400 font-medium block">
                      ⚠ Sin: {item.ingredientesExcluidosNombres.join(', ')}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {pedido.items.length > maxItems && (
              <p className="text-xs text-muted-foreground pl-7">
                +{pedido.items.length - maxItems} más...
              </p>
            )}
          </div>

          {/* Footer: Total + Acción */}
          <div className="flex items-center justify-between p-3 pt-2 border-t border-border/50 bg-black/5 dark:bg-white/5">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-foreground">
                ${parseFloat(pedido.total || '0').toFixed(0)}
              </span>
              <span className="text-xs text-muted-foreground">
                • #{pedido.id}
              </span>
            </div>

            <div className="flex items-center gap-1">
              {/* Botón eliminar */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => {
                  e.stopPropagation()
                  setPedidoAEliminar(pedido)
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>

              {/* Botón acción principal */}
              {nextAction && (
                <Button
                  size="sm"
                  className={`${nextAction.color} text-white font-semibold h-8 gap-1`}
                  disabled={isUpdating}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleChangeEstado(pedido, nextAction.estado)
                  }}
                >
                  {isUpdating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <nextAction.icon className="h-4 w-4" />
                      {nextAction.label}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isLoading && pedidos.length === 0) {
    return (
      <div className="w-full h-[80vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Cargando pedidos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
      {/* Header compacto */}
      <div className="shrink-0 bg-background border-b px-4 py-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Título + Estado conexión */}
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight">Pedidos</h1>
            {isConnected ? (
              <Badge variant="outline" className="gap-1 text-xs bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700">
                <Wifi className="h-3 w-3 text-emerald-500" />
                En vivo
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-xs bg-orange-50 dark:bg-orange-950/30 border-orange-300">
                <WifiOff className="h-3 w-3 text-orange-500" />
                Offline
              </Badge>
            )}
          </div>

          {/* Controles */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 lg:flex-none">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar mesa, producto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9 w-full lg:w-56"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                  onClick={() => setSearchTerm('')}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <Button
              variant={showClosed ? "default" : "outline"}
              size="sm"
              className="h-9 gap-1 shrink-0"
              onClick={() => setShowClosed(!showClosed)}
            >
              <CheckCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Cerrados</span>
            </Button>
            <Button variant="outline" size="sm" className="h-9 gap-1 shrink-0" onClick={() => fetchPedidos(1, false)}>
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Actualizar</span>
            </Button>
          </div>
        </div>

        {/* Stats rápidos - Solo desktop */}
        <div className="hidden lg:flex items-center gap-4 mt-3 text-sm">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30">
            <Clock className="h-4 w-4 text-amber-600" />
            <span className="font-semibold text-amber-700 dark:text-amber-400">{counts.pending}</span>
            <span className="text-amber-600/80">nuevos</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30">
            <ChefHat className="h-4 w-4 text-blue-600" />
            <span className="font-semibold text-blue-700 dark:text-blue-400">{counts.preparing}</span>
            <span className="text-blue-600/80">en cocina</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <Utensils className="h-4 w-4 text-emerald-600" />
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">{counts.delivered}</span>
            <span className="text-emerald-600/80">listos</span>
          </div>
        </div>
      </div>

      {/* Vista Kanban - Desktop */}
      <div className="flex-1 hidden lg:flex gap-4 p-4 overflow-hidden">
        {COLUMNS.map((column) => {
          const columnPedidos = pedidosByColumn[column.id] || []
          const ColumnIcon = column.icon

          return (
            <div key={column.id} className="flex-1 flex flex-col min-w-[320px] max-w-[400px]">
              {/* Header de columna */}
              <div className={`shrink-0 rounded-t-lg px-4 py-3 ${column.bgHeader}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ColumnIcon className={`h-5 w-5 ${column.color}`} />
                    <span className="font-bold text-foreground">{column.title}</span>
                  </div>
                  <Badge variant="secondary" className="font-mono font-bold">
                    {columnPedidos.length}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{column.description}</p>
              </div>

              {/* Lista de pedidos */}
              <ScrollArea className="flex-1 bg-muted/30 rounded-b-lg border border-t-0">
                <div className="p-3 space-y-3">
                  {columnPedidos.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Sin pedidos</p>
                    </div>
                  ) : (
                    columnPedidos.map((pedido) => (
                      <PedidoCard key={pedido.id} pedido={pedido} />
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          )
        })}

        {/* Columna de cerrados pendientes de pago */}
        {showClosed && pedidosByColumn.closedPending.length > 0 && (
          <div className="flex-1 flex flex-col min-w-[280px] max-w-[320px]">
            <div className="shrink-0 rounded-t-lg px-4 py-3 bg-orange-100 dark:bg-orange-900/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-orange-600" />
                  <span className="font-bold text-foreground">Cerrados (Pendiente pago)</span>
                </div>
                <Badge variant="secondary" className="font-mono">
                  {pedidosByColumn.closedPending.length}
                </Badge>
              </div>
            </div>
            <ScrollArea className="flex-1 bg-muted/20 rounded-b-lg border border-t-0">
              <div className="p-3 space-y-2">
                {pedidosByColumn.closedPending.slice(0, 10).map((pedido) => (
                  <Card
                    key={pedido.id}
                    className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/dashboard/pedidos/${pedido.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold">{pedido.mesaNombre}</span>
                        <span className="text-xs text-muted-foreground ml-2">#{pedido.id}</span>
                      </div>
                      <span className="font-semibold">${parseFloat(pedido.total).toFixed(0)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatTimeAgo(pedido.createdAt)}
                    </p>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Columna de cerrados pagados */}
        {showClosed && pedidosByColumn.closedPaid.length > 0 && (
          <div className="flex-1 flex flex-col min-w-[280px] max-w-[320px] opacity-60">
            <div className="shrink-0 rounded-t-lg px-4 py-3 bg-slate-100 dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-slate-500" />
                  <span className="font-bold text-foreground">Cerrados (Pagados)</span>
                </div>
                <Badge variant="secondary" className="font-mono">
                  {pedidosByColumn.closedPaid.length}
                </Badge>
              </div>
            </div>
            <ScrollArea className="flex-1 bg-muted/20 rounded-b-lg border border-t-0">
              <div className="p-3 space-y-2">
                {pedidosByColumn.closedPaid.slice(0, 10).map((pedido) => (
                  <Card
                    key={pedido.id}
                    className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/dashboard/pedidos/${pedido.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold">{pedido.mesaNombre}</span>
                        <span className="text-xs text-muted-foreground ml-2">#{pedido.id}</span>
                      </div>
                      <span className="font-semibold">${parseFloat(pedido.total).toFixed(0)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatTimeAgo(pedido.createdAt)}
                    </p>
                  </Card>
                ))}
                {hasMore && (
                  <Button variant="ghost" size="sm" className="w-full" onClick={loadMore}>
                    {isLoadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cargar más'}
                  </Button>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Vista Mobile - Lista con secciones colapsables */}
      <div className="flex-1 lg:hidden overflow-auto">
        <div className="p-4 space-y-6">
          {COLUMNS.map((column) => {
            const columnPedidos = pedidosByColumn[column.id] || []
            const ColumnIcon = column.icon

            if (columnPedidos.length === 0) return null

            return (
              <div key={column.id}>
                {/* Header de sección */}
                <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-lg ${column.bgHeader}`}>
                  <ColumnIcon className={`h-5 w-5 ${column.color}`} />
                  <span className="font-bold text-foreground flex-1">{column.title}</span>
                  <Badge variant="secondary" className="font-mono font-bold">
                    {columnPedidos.length}
                  </Badge>
                </div>

                {/* Cards */}
                <div className="space-y-3">
                  {columnPedidos.map((pedido) => (
                    <PedidoCard key={pedido.id} pedido={pedido} compact />
                  ))}
                </div>
              </div>
            )
          })}

          {/* Pedidos cerrados pendientes de pago - Mobile */}
          {showClosed && pedidosByColumn.closedPending.length > 0 && (
            <div>
              {/* Header de sección */}
              <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                <CheckCircle className="h-5 w-5 text-orange-600" />
                <span className="font-bold text-foreground flex-1">Cerrados (Pendiente pago)</span>
                <Badge variant="secondary" className="font-mono font-bold">
                  {pedidosByColumn.closedPending.length}
                </Badge>
              </div>

              {/* Cards de cerrados pendientes */}
              <div className="space-y-2">
                {pedidosByColumn.closedPending.slice(0, 10).map((pedido) => (
                  <Card
                    key={pedido.id}
                    className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/dashboard/pedidos/${pedido.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold">{pedido.mesaNombre}</span>
                        <span className="text-xs text-muted-foreground ml-2">#{pedido.id}</span>
                      </div>
                      <span className="font-semibold">${parseFloat(pedido.total).toFixed(0)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatTimeAgo(pedido.createdAt)}
                    </p>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Pedidos cerrados pagados - Mobile */}
          {showClosed && pedidosByColumn.closedPaid.length > 0 && (
            <div className="opacity-70">
              {/* Header de sección */}
              <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800/50">
                <CheckCircle className="h-5 w-5 text-slate-500" />
                <span className="font-bold text-foreground flex-1">Cerrados (Pagados)</span>
                <Badge variant="secondary" className="font-mono font-bold">
                  {pedidosByColumn.closedPaid.length}
                </Badge>
              </div>

              {/* Cards de cerrados pagados */}
              <div className="space-y-2">
                {pedidosByColumn.closedPaid.slice(0, 10).map((pedido) => (
                  <Card
                    key={pedido.id}
                    className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/dashboard/pedidos/${pedido.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold">{pedido.mesaNombre}</span>
                        <span className="text-xs text-muted-foreground ml-2">#{pedido.id}</span>
                      </div>
                      <span className="font-semibold">${parseFloat(pedido.total).toFixed(0)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatTimeAgo(pedido.createdAt)}
                    </p>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Mensaje vacío */}
          {counts.total === 0 && (
            <div className="text-center py-12">
              <ShoppingCart className="h-16 w-16 mx-auto mb-4 text-muted-foreground/40" />
              <p className="text-lg font-medium text-muted-foreground">No hay pedidos activos</p>
              {searchTerm && (
                <Button variant="ghost" className="mt-4" onClick={() => setSearchTerm('')}>
                  <X className="h-4 w-4 mr-2" />
                  Limpiar búsqueda
                </Button>
              )}
            </div>
          )}

          {/* Load more para mobile */}
          {hasMore && counts.total > 0 && (
            <div className="pt-4 pb-8">
              <Button variant="outline" className="w-full" onClick={loadMore} disabled={isLoadingMore}>
                {isLoadingMore ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cargando...
                  </>
                ) : (
                  'Cargar más pedidos'
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Dialog de confirmación para eliminar */}
      <Dialog open={!!pedidoAEliminar} onOpenChange={(open) => !open && setPedidoAEliminar(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              ¿Eliminar Pedido?
            </DialogTitle>
            <DialogDescription className="pt-2">
              ¿Eliminar el pedido <strong className="text-foreground">#{pedidoAEliminar?.id}</strong> de <strong className="text-foreground">{pedidoAEliminar?.mesaNombre || 'Sin mesa'}</strong>?
              <br /><br />
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPedidoAEliminar(null)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeletePedido} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Eliminar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Pedidos
