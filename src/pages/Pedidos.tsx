import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuthStore } from '@/store/authStore'
import { pedidosApi, ApiError } from '@/lib/api'
import { useAdminWebSocket } from '@/hooks/useAdminWebSocket'
import { toast } from 'sonner'
import { 
  Loader2, Search, Clock, CheckCircle, ChefHat, Utensils, 
  ShoppingCart, RefreshCw, Wifi, WifiOff, XCircle, Trash2
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
}

// Helper para obtener el badge del estado
const getEstadoBadge = (estado: string | null | undefined) => {
  const estados: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any; color: string }> = {
    pending: { label: 'Pendiente', variant: 'outline', icon: Clock, color: 'text-yellow-600' },
    preparing: { label: 'Preparando', variant: 'default', icon: ChefHat, color: 'text-blue-600' },
    delivered: { label: 'Entregado', variant: 'secondary', icon: Utensils, color: 'text-green-600' },
    closed: { label: 'Cerrado', variant: 'secondary', icon: CheckCircle, color: 'text-gray-500' },
  }
  return estados[estado || 'pending'] || estados.pending
}

// Helper para calcular tiempo transcurrido
const getTimeAgo = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 1) return 'Ahora'
  if (diffMins < 60) return `${diffMins}m`
  
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h`
  
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d`
  
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

const Pedidos = () => {
  const navigate = useNavigate()
  const token = useAuthStore((state) => state.token)
  
  // WebSocket para actualizaciones en tiempo real
  const { mesas: mesasWS, isConnected } = useAdminWebSocket()
  
  // State
  const [pedidos, setPedidos] = useState<PedidoData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  
  // Estado para eliminar pedido
  const [pedidoAEliminar, setPedidoAEliminar] = useState<PedidoData | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Fetch pedidos desde API REST
  const fetchPedidos = useCallback(async (pageNum = 1, append = false) => {
    if (!token) return
    
    if (pageNum === 1) setIsLoading(true)
    else setIsLoadingMore(true)
    
    try {
      const estado = activeTab === 'all' ? undefined : activeTab
      const response = await pedidosApi.getAll(token, pageNum, 20, estado) as {
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
  }, [token, activeTab])

  // Initial fetch y cuando cambia el tab
  useEffect(() => {
    setPage(1)
    fetchPedidos(1, false)
  }, [activeTab, token])

  // Actualizar pedidos activos desde WebSocket
  useEffect(() => {
    if (mesasWS.length > 0) {
      // Actualizar pedidos que están en la lista con datos del WebSocket
      setPedidos(prev => {
        return prev.map(pedido => {
          // Buscar si este pedido está en alguna mesa del WebSocket
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
      })

      // También agregar nuevos pedidos que no estaban en la lista
      mesasWS.forEach(mesa => {
        if (mesa.pedido && mesa.pedido.estado !== 'closed') {
          setPedidos(prev => {
            const exists = prev.some(p => p.id === mesa.pedido!.id)
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
                totalItems: mesa.totalItems
              }
              return [newPedido, ...prev]
            }
            return prev
          })
        }
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

  // Eliminar pedido
  const handleDeletePedido = async () => {
    if (!token || !pedidoAEliminar) return
    
    setIsDeleting(true)
    try {
      await pedidosApi.delete(token, pedidoAEliminar.id)
      toast.success('Pedido eliminado', {
        description: `El pedido #${pedidoAEliminar.id} ha sido eliminado correctamente`
      })
      // Remover de la lista local
      setPedidos(prev => prev.filter(p => p.id !== pedidoAEliminar.id))
      setPedidoAEliminar(null)
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error('Error al eliminar pedido', { description: error.message })
      }
    } finally {
      setIsDeleting(false)
    }
  }

  // Filtrar por búsqueda
  const filteredPedidos = pedidos.filter(pedido => {
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

  // Contar por estado
  const countByEstado = {
    all: pedidos.length,
    pending: pedidos.filter(p => p.estado === 'pending').length,
    preparing: pedidos.filter(p => p.estado === 'preparing').length,
    delivered: pedidos.filter(p => p.estado === 'delivered').length,
    closed: pedidos.filter(p => p.estado === 'closed').length,
  }

  if (isLoading && pedidos.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pedidos</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            Gestiona todos los pedidos de tu restaurante
            {isConnected ? (
              <Badge variant="outline" className="gap-1 text-xs">
                <Wifi className="h-3 w-3 text-green-500" />
                En vivo
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-xs">
                <WifiOff className="h-3 w-3 text-orange-500" />
                Offline
              </Badge>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar pedido, mesa, cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          <Button variant="outline" onClick={() => fetchPedidos(1, false)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Tabs de estado */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-flex">
          <TabsTrigger value="all" className="gap-2">
            Todos
            <Badge variant="secondary" className="ml-1">{countByEstado.all}</Badge>
          </TabsTrigger>
          <TabsTrigger value="preparing" className="gap-2">
            <ChefHat className="h-4 w-4" />
            Preparando
            {countByEstado.preparing > 0 && (
              <Badge variant="default" className="ml-1">{countByEstado.preparing}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            Pendientes
            {countByEstado.pending > 0 && (
              <Badge variant="outline" className="ml-1">{countByEstado.pending}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="delivered" className="gap-2">
            <Utensils className="h-4 w-4" />
            Entregados
          </TabsTrigger>
          <TabsTrigger value="closed" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Cerrados
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Lista de Pedidos - Grilla Responsiva */}
      {filteredPedidos.length === 0 ? (
        <Card className="max-w-md mx-auto">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center mb-2">
              {searchTerm ? 'No se encontraron pedidos' : 'No hay pedidos en este estado'}
            </p>
            {searchTerm && (
              <Button variant="ghost" onClick={() => setSearchTerm('')}>
                <XCircle className="mr-2 h-4 w-4" />
                Limpiar búsqueda
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredPedidos.map((pedido) => {
              const estadoBadge = getEstadoBadge(pedido.estado)
              const StatusIcon = estadoBadge.icon
              const isActive = pedido.estado === 'preparing' || pedido.estado === 'pending'
              const maxItemsToShow = 3
              const remainingItems = pedido.items.length - maxItemsToShow
              
              return (
                <Card 
                  key={pedido.id}
                  className={`transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer flex flex-col ${
                    isActive ? 'border-primary/40' : ''
                  } ${pedido.estado === 'preparing' ? 'ring-2 ring-primary/20' : ''}`}
                  onClick={() => navigate(`/dashboard/pedidos/${pedido.id}`)}
                >
                  {/* Header: Mesa + ID + Estado */}
                  <CardHeader className="p-4 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-xl font-bold truncate">
                        Pedido #{pedido.id}
                        </CardTitle>
                        <CardDescription className="text-md mt-0.5 text-primary">
                        {pedido.mesaNombre || 'Sin mesa'}
                        </CardDescription>
                      </div>
                      <Badge 
                        variant={estadoBadge.variant} 
                        className="gap-1 shrink-0"
                      >
                        <StatusIcon className="h-3 w-3" />
                        {estadoBadge.label}
                      </Badge>
                    </div>
                  </CardHeader>

                  {/* Content: Items del pedido */}
                  <CardContent className="p-4 pt-0 flex-1">
                    <div className="space-y-2">
                      {pedido.items.slice(0, maxItemsToShow).map((item) => (
                        <div 
                          key={item.id} 
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-foreground truncate flex-1 mr-2">
                            {item.nombreProducto}
                          </span>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-muted-foreground">
                              x{item.cantidad}
                            </span>
                            <span className="font-medium w-16 text-right">
                              ${(parseFloat(item.precioUnitario) * item.cantidad).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                      {remainingItems > 0 && (
                        <p className="text-xs text-muted-foreground pt-1">
                          Ver {remainingItems} más...
                        </p>
                      )}
                    </div>
                  </CardContent>

                  <Separator />

                  {/* Footer: Tiempo + Total + Acciones */}
                  <CardFooter className="p-4 pt-3">
                    <div className="flex items-center justify-between w-full">
                      {/* Tiempo */}
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="text-xs">{getTimeAgo(pedido.createdAt)}</span>
                      </div>

                      {/* Acciones + Total */}
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation()
                            setPedidoAEliminar(pedido)
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <span className="text-lg font-bold text-primary">
                          ${parseFloat(pedido.total || '0').toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
          
          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center pt-8">
              <Button 
                variant="outline" 
                onClick={loadMore}
                disabled={isLoadingMore}
              >
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
        </>
      )}

      {/* Dialog de confirmación para eliminar pedido */}
      <Dialog open={!!pedidoAEliminar} onOpenChange={(open) => !open && setPedidoAEliminar(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              ¿Eliminar Pedido?
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de eliminar el pedido <strong>#{pedidoAEliminar?.id}</strong> de la mesa <strong>{pedidoAEliminar?.mesaNombre || 'Sin asignar'}</strong>?
              <br /><br />
              Esta acción eliminará permanentemente el pedido y todos sus items asociados. No se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setPedidoAEliminar(null)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeletePedido}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar Pedido
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Pedidos

