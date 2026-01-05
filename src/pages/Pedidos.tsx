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
      <div className="w-full max-w-7xl lg:max-w-[1600px] xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="w-full max-w-7xl lg:max-w-[1600px] xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 space-y-4 md:space-y-6 animate-in fade-in duration-500 pb-20 md:pb-0">
      
      {/* Header Sticky para Mobile */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 py-4 md:py-6 md:static md:bg-transparent -mx-4 sm:-mx-6 lg:-mx-8 xl:-mx-12 px-4 sm:px-6 lg:px-8 xl:px-12 md:mx-0 md:px-0 border-b md:border-none">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Pedidos</h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm md:text-base text-muted-foreground">
                  Gestión de pedidos
                </p>
                {isConnected ? (
                  <Badge variant="outline" className="gap-1 text-[10px] h-5">
                    <Wifi className="h-3 w-3 text-green-500" />
                    <span className="hidden sm:inline">En vivo</span>
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-[10px] h-5">
                    <WifiOff className="h-3 w-3 text-orange-500" />
                    Offline
                  </Badge>
                )}
              </div>
            </div>
            
            {/* Botón Actualizar solo visible en mobile para ahorrar espacio */}
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => fetchPedidos(1, false)}>
              <RefreshCw className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:flex-none">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar pedido, mesa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full md:w-64"
              />
            </div>
            <Button variant="outline" className="hidden md:flex" onClick={() => fetchPedidos(1, false)}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualizar
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs de estado - Scroll Horizontal en Mobile */}
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 xl:-mx-12 px-4 sm:px-6 lg:px-8 xl:px-12 md:mx-0 md:px-0">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start overflow-x-auto flex-nowrap h-auto p-1 scrollbar-hide">
            <TabsTrigger value="all" className="gap-2 shrink-0">
              Todos
              <Badge variant="secondary" className="ml-1 text-[10px] px-1 h-4 min-w-5">{countByEstado.all}</Badge>
            </TabsTrigger>
            <TabsTrigger value="preparing" className="gap-2 shrink-0">
              <ChefHat className="h-3.5 w-3.5" />
              Preparando
              {countByEstado.preparing > 0 && (
                <Badge variant="default" className="ml-1 text-[10px] px-1 h-4 min-w-5">{countByEstado.preparing}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="pending" className="gap-2 shrink-0">
              <Clock className="h-3.5 w-3.5" />
              Pendientes
              {countByEstado.pending > 0 && (
                <Badge variant="outline" className="ml-1 text-[10px] px-1 h-4 min-w-5">{countByEstado.pending}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="delivered" className="gap-2 shrink-0">
              <Utensils className="h-3.5 w-3.5" />
              Entregados
            </TabsTrigger>
            <TabsTrigger value="closed" className="gap-2 shrink-0">
              <CheckCircle className="h-3.5 w-3.5" />
              Cerrados
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Lista de Pedidos - Grilla Responsiva */}
      {filteredPedidos.length === 0 ? (
        <Card className="max-w-md mx-auto mt-8">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <p className="text-muted-foreground text-center mb-4">
              {searchTerm ? 'No se encontraron pedidos con esa búsqueda' : 'No hay pedidos en este estado'}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {filteredPedidos.map((pedido) => {
              const estadoBadge = getEstadoBadge(pedido.estado)
              const StatusIcon = estadoBadge.icon
              const isActive = pedido.estado === 'preparing' || pedido.estado === 'pending'
              const maxItemsToShow = 3
              const remainingItems = pedido.items.length - maxItemsToShow
              
              return (
                <Card 
                  key={pedido.id}
                  className={`transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer flex flex-col group ${
                    isActive ? 'border-primary/40' : ''
                  } ${pedido.estado === 'preparing' ? 'ring-1 ring-primary/20' : ''}`}
                  onClick={() => navigate(`/dashboard/pedidos/${pedido.id}`)}
                >
                  {/* Header: Mesa + ID + Estado */}
                  <CardHeader className="p-4 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg font-bold truncate group-hover:text-primary transition-colors">
                            Pedido #{pedido.id}
                          </CardTitle>
                        </div>
                        <CardDescription className="text-sm font-medium text-foreground/80 mt-1">
                          {pedido.mesaNombre || 'Sin mesa asignada'}
                        </CardDescription>
                      </div>
                      <Badge 
                        variant={estadoBadge.variant} 
                        className="gap-1 shrink-0 h-6 px-2"
                      >
                        <StatusIcon className="h-3 w-3" />
                        <span className="hidden sm:inline">{estadoBadge.label}</span>
                      </Badge>
                    </div>
                  </CardHeader>

                  {/* Content: Items del pedido */}
                  <CardContent className="p-4 pt-0 flex-1">
                    <div className="space-y-2 mt-1">
                      {pedido.items.slice(0, maxItemsToShow).map((item) => (
                        <div 
                          key={item.id} 
                          className="flex items-center justify-between text-sm"
                        >
                          <div className="text-muted-foreground truncate flex-1 mr-2">
                            <span>{item.nombreProducto}</span>
                            {item.ingredientesExcluidosNombres && item.ingredientesExcluidosNombres.length > 0 && (
                              <div className="mt-1 p-1.5 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded">
                                <p className="text-xs text-orange-700 dark:text-orange-300 font-medium">
                                  ⚠️ Sin: {item.ingredientesExcluidosNombres.join(', ')}
                                </p>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3 shrink-0 text-foreground">
                            <span className="text-xs text-muted-foreground">
                              x{item.cantidad}
                            </span>
                            <span className="font-medium min-w-12 text-right">
                              ${(parseFloat(item.precioUnitario) * item.cantidad).toFixed(0)}
                            </span>
                          </div>
                        </div>
                      ))}
                      {remainingItems > 0 && (
                        <p className="text-xs text-muted-foreground pt-1 italic">
                          +{remainingItems} productos más...
                        </p>
                      )}
                    </div>
                  </CardContent>

                  <Separator />

                  {/* Footer: Tiempo + Total + Acciones */}
                  <CardFooter className="p-3 bg-muted/20">
                    <div className="flex items-center justify-between w-full">
                      {/* Tiempo */}
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">{getTimeAgo(pedido.createdAt)}</span>
                      </div>

                      {/* Acciones + Total */}
                      <div className="flex items-center gap-3">
                         {/* Botón eliminar sutil */}
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mr-2"
                          onClick={(e) => {
                            e.stopPropagation()
                            setPedidoAEliminar(pedido)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
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
            <div className="flex justify-center pt-8 pb-8">
              <Button 
                variant="outline" 
                onClick={loadMore}
                disabled={isLoadingMore}
                className="w-full md:w-auto"
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
        <DialogContent className="max-w-md mx-4 rounded-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              ¿Eliminar Pedido?
            </DialogTitle>
            <DialogDescription className="pt-2">
              ¿Estás seguro de eliminar el pedido <strong className="text-foreground">#{pedidoAEliminar?.id}</strong> de la mesa <strong className="text-foreground">{pedidoAEliminar?.mesaNombre || 'Sin asignar'}</strong>?
              <br /><br />
              Esta acción eliminará permanentemente el pedido y todos sus items asociados. No se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
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
                'Eliminar definitivamente'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Pedidos