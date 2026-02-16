import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import { useNavigate } from 'react-router'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { pedidosApi, ApiError } from '@/lib/api'
import { useAdminContext } from '@/context/AdminContext'
import { toast } from 'sonner'
import { NotificationSheet } from '@/components/NotificationSheet'
import {
  Loader2, Search, Clock,
  ShoppingCart, RefreshCw, Wifi, WifiOff, Trash2,
  AlertTriangle, Archive, X, Printer
} from 'lucide-react'
import { usePrinter } from '@/context/PrinterContext'
import { formatComanda, formatFactura, commandsToBytes } from '@/utils/printerUtils'
import { useRef } from 'react'

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
  estado?: 'pending' | 'preparing' | 'delivered' | 'served' | 'cancelled'
}

interface PedidoData {
  id: number
  mesaId: number | null
  mesaNombre: string | null
  estado: 'pending' | 'preparing' | 'delivered' | 'served' | 'closed' | 'archived'
  total: string
  createdAt: string
  closedAt?: string | null
  items: ItemPedido[]
  totalItems: number
  nombrePedido?: string | null
}

// Formato de tiempo legible
const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString)
  const adjustedDate = new Date(date.getTime() + 3 * 60 * 60 * 1000)
  const now = new Date()
  const diffMs = now.getTime() - adjustedDate.getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'Ahora'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${minutes % 60}m`
  return new Date(dateString).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

// Etiqueta de fecha para separadores
const getDateLabel = (dateString: string) => {
  const date = new Date(dateString)
  const today = new Date()
  if (date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate()) {
    return 'Hoy'
  }
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.getFullYear() === yesterday.getFullYear() && date.getMonth() === yesterday.getMonth() && date.getDate() === yesterday.getDate()) {
    return 'Ayer'
  }
  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`
}

const Pedidos = () => {
  const navigate = useNavigate()
  const token = useAuthStore((state) => state.token)
  const { restaurante, productos: allProductos, categorias: allCategorias } = useRestauranteStore()
  const { printRaw, selectedPrinter } = usePrinter()

  const {
    mesas: mesasWS,
    isConnected,
    notifications,
    unreadCount,
    markAsRead,
    deleteNotification,
    clearNotifications,
    soundEnabled,
    setSoundEnabled
  } = useAdminContext()

  // State
  const [pedidos, setPedidos] = useState<PedidoData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // Estado para eliminar pedido
  const [pedidoAEliminar, setPedidoAEliminar] = useState<PedidoData | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

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

  // Ref para impresión automática
  const processedOrdersRef = useRef<Map<number, { status: string, itemIds: Set<number> }>>(new Map())

  // Sincronizar pedidos con WS y manejar IMPRESIÓN AUTOMÁTICA
  useEffect(() => {
    if (mesasWS.length > 0) {
      // Lógica de impresión automática
      if (selectedPrinter) {
        mesasWS.forEach(mesa => {
          if (!mesa.pedido) return
          const pedidoId = mesa.pedido.id
          const currentStatus = mesa.pedido.estado
          const currentItemIds = new Set(mesa.items.map(i => i.id))
          const prevData = processedOrdersRef.current.get(pedidoId)

          // Detectar transición PENDING -> PREPARING
          if (prevData && prevData.status === 'pending' && currentStatus === 'preparing') {
            const itemsToPrint = mesa.items
              .map(item => {
                const producto = allProductos.find(p => p.id === item.productoId)
                const categoria = producto && producto.categoriaId
                  ? allCategorias.find(c => c.id === producto.categoriaId)
                  : null
                return { ...item, producto, categoria }
              })
              .filter(data => {
                if (!data.producto || !data.categoria) return true
                return !data.categoria.nombre.toLowerCase().includes('bebidas')
              })
              .map(data => ({
                ...data,
                categoriaNombre: data.categoria ? data.categoria.nombre : undefined
              }))

            if (itemsToPrint.length > 0) {
              const comandaData = formatComanda(mesa.pedido, itemsToPrint, restaurante?.nombre || 'Restaurante')
              printRaw(commandsToBytes(comandaData)).catch((err: Error) => console.error("Error printing confirmed order:", err))
              toast.success(`Imprimiendo comanda #${pedidoId}`)
            }
          }
          // Detectar NUEVOS ITEMS en pedido ya confirmado
          else if (currentStatus === 'preparing' && prevData) {
            const newItems = mesa.items.filter(item => !prevData.itemIds.has(item.id))
            if (newItems.length > 0) {
              const itemsToPrint = newItems
                .map(item => {
                  const producto = allProductos.find(p => p.id === item.productoId)
                  const categoria = producto && producto.categoriaId
                    ? allCategorias.find(c => c.id === producto.categoriaId)
                    : null
                  return { ...item, producto, categoria }
                })
                .filter(data => {
                  if (!data.producto || !data.categoria) return true
                  return !data.categoria.nombre.toLowerCase().includes('bebida')
                })
                .map(data => ({
                  ...data,
                  categoriaNombre: data.categoria ? data.categoria.nombre : undefined
                }))

              if (itemsToPrint.length > 0) {
                const comandaData = formatComanda(mesa.pedido, itemsToPrint, restaurante?.nombre || 'Restaurante')
                printRaw(commandsToBytes(comandaData)).catch((err: Error) => console.error("Error printing new items:", err))
                toast.info(`Imprimiendo ${itemsToPrint.length} items nuevos`)
              }
            }
          }

          processedOrdersRef.current.set(pedidoId, { status: currentStatus, itemIds: currentItemIds })
        })
      }

      setPedidos(prev => {
        const wsMap = new Map(mesasWS.map(m => [m.pedido?.id, m]))

        let updated = prev.map(pedidoLocal => {
          const mesaWS = wsMap.get(pedidoLocal.id)
          if (!mesaWS || !mesaWS.pedido) return pedidoLocal
          if (pedidoLocal.estado === 'closed' && mesaWS.pedido.estado === 'closed') return pedidoLocal

          const currentItemsMap = new Map(pedidoLocal.items.map(i => [i.id, i]))
          const wsItemsMap = new Map(mesaWS.items.map(i => [i.id, i]))

          const mergedExistingItems = pedidoLocal.items.map(localItem => {
            const wsItem = wsItemsMap.get(localItem.id)
            if (!wsItem) return localItem
            const estadoLocal = localItem.estado
            const estadoWS = (wsItem as any).estado
            let estadoFinal = estadoWS || estadoLocal
            const estadosAvanzados = ['delivered', 'served', 'cancelled']
            const estadosBasicos = ['pending', 'preparing']
            if (estadosAvanzados.includes(estadoLocal || '') && (!estadoWS || estadosBasicos.includes(estadoWS))) {
              estadoFinal = estadoLocal
            }
            return { ...localItem, ...wsItem, estado: estadoFinal }
          })

          const newItemsFromWS = mesaWS.items
            .filter(wsItem => !currentItemsMap.has(wsItem.id))
            .map(wsItem => ({ ...wsItem, estado: (wsItem as any).estado || 'preparing' }))

          return {
            ...pedidoLocal,
            estado: mesaWS.pedido.estado,
            total: mesaWS.pedido.total,
            totalItems: mesaWS.totalItems,
            items: [...mergedExistingItems, ...newItemsFromWS]
          }
        })

        mesasWS.forEach(mesa => {
          if (mesa.pedido && mesa.pedido.estado !== 'closed') {
            const exists = prev.some(p => p.id == mesa.pedido!.id)
            if (!exists) {
              const newPedido: PedidoData = {
                id: mesa.pedido!.id,
                mesaId: mesa.id,
                mesaNombre: mesa.nombre,
                estado: mesa.pedido!.estado,
                total: mesa.pedido!.total,
                createdAt: mesa.pedido!.createdAt,
                closedAt: mesa.pedido!.closedAt,
                items: mesa.items.map(i => ({ ...i, estado: (i as any).estado || 'preparing' })),
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
  }, [mesasWS, selectedPrinter, allProductos, allCategorias, restaurante?.nombre, printRaw])

  // Cargar más
  const loadMore = () => {
    if (!isLoadingMore && hasMore) {
      const nextPage = page + 1
      setPage(nextPage)
      fetchPedidos(nextPage, true)
    }
  }

  // Archivar pedido
  const handleArchivePedido = async (pedidoId: number) => {
    if (!token) return
    try {
      const response = await pedidosApi.updateEstado(token, pedidoId, 'archived') as { success: boolean }
      if (response.success) {
        setPedidos(prev => prev.map(p =>
          p.id === pedidoId ? { ...p, estado: 'archived' as PedidoData['estado'] } : p
        ))
        toast.success('Pedido archivado')
      }
    } catch (error) {
      toast.error('Error al archivar pedido')
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

  // Filtrar pedidos
  const filteredPedidos = useMemo(() => {
    return pedidos.filter(pedido => {
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
  }, [pedidos, searchTerm])

  // Separar en activos y archivados
  const activePedidos = useMemo(() => {
    return filteredPedidos
      .filter(p => p.estado !== 'archived')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [filteredPedidos])

  const archivedPedidos = useMemo(() => {
    return filteredPedidos
      .filter(p => p.estado === 'archived')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [filteredPedidos])

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
      {/* Header */}
      <div className="shrink-0 bg-background border-b px-4 py-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
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
            <Badge variant="secondary" className="text-xs">{activePedidos.length} activos</Badge>
          </div>

          <div className="flex items-center gap-2">
            <NotificationSheet
              notifications={notifications}
              unreadCount={unreadCount}
              soundEnabled={soundEnabled}
              setSoundEnabled={setSoundEnabled}
              markAsRead={markAsRead}
              deleteNotification={deleteNotification}
              clearNotifications={clearNotifications}
            />
            <div className="relative flex-1 lg:flex-none">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar mesa, producto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9 w-full lg:w-56"
              />
              {searchTerm && (
                <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6" onClick={() => setSearchTerm('')}>
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <Button variant="outline" size="sm" className="h-9 gap-1 shrink-0" onClick={() => fetchPedidos(1, false)}>
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Actualizar</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Lista de pedidos */}
      <div className="flex-1 overflow-auto p-4">
        {activePedidos.length === 0 && archivedPedidos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
            <ShoppingCart className="h-16 w-16 text-muted-foreground/30" />
            <p className="text-lg font-medium">No hay pedidos</p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Todos los Pedidos ({activePedidos.length})</h2>
            </div>

            {activePedidos.map((pedido, index) => {
              const dateLabel = getDateLabel(pedido.createdAt)
              const prevDateLabel = index > 0 ? getDateLabel(activePedidos[index - 1].createdAt) : null
              const showDateSeparator = dateLabel !== prevDateLabel

              return (
                <Fragment key={`pedido-${pedido.id}`}>
                  {showDateSeparator && (
                    <div className={`flex items-center gap-3 ${index === 0 ? '' : 'pt-3'}`}>
                      <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">{dateLabel}</span>
                      <Separator className="flex-1" />
                    </div>
                  )}
                  <Card
                    className="overflow-hidden hover:shadow-md transition-all pl-4 pr-8 min-w-[330px] cursor-pointer active:scale-[0.99]"
                    onClick={() => navigate(`/dashboard/pedidos/${pedido.id}`)}
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <CardTitle className="text-lg">
                              🍽️ {pedido.mesaNombre || `Pedido #${pedido.id}`}
                            </CardTitle>
                          </div>
                          <div className="flex items-start gap-2 mb-1 text-muted-foreground">
                            <Clock className="h-4 w-4 shrink-0 mt-0.5" />
                            <p className="text-sm">{formatTimeAgo(pedido.createdAt)}</p>
                          </div>
                          <p className="mt-2">
                            <span className="font-semibold text-foreground text-lg">
                              ${parseFloat(pedido.total).toFixed(2)}
                            </span>
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          <div className="flex gap-1">
                            {selectedPrinter && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-muted-foreground hover:text-foreground"
                                title="Imprimir factura"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const facturaItems: any[] = pedido.items.map((item: any) => ({
                                    ...item,
                                    precioUnitario: item.precioUnitario || '0'
                                  }))
                                  const facturaData = formatFactura(
                                    {
                                      id: pedido.id,
                                      mesaNombre: pedido.mesaNombre,
                                      nombrePedido: pedido.nombrePedido || undefined,
                                      total: pedido.total
                                    },
                                    facturaItems,
                                    restaurante?.nombre || 'Restaurante'
                                  )
                                  printRaw(commandsToBytes(facturaData))
                                }}
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-muted-foreground hover:text-foreground"
                              title="Archivar pedido"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleArchivePedido(pedido.id)
                              }}
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              title="Eliminar pedido"
                              onClick={(e) => {
                                e.stopPropagation()
                                setPedidoAEliminar(pedido)
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      {/* Items Preview */}
                      <div className="mt-3 pt-3 border-t">
                        <div className="space-y-1.5">
                          {pedido.items.map((item: any) => (
                            <div key={item.id} className="flex flex-col bg-muted p-3 rounded-sm mb-2">
                              <div className="flex items-center gap-2">
                                <div className="font-normal text-sm">
                                  {item.cantidad}x {item.nombreProducto}
                                </div>
                                {item.ingredientesExcluidosNombres && item.ingredientesExcluidosNombres.length > 0 && (
                                  <AlertTriangle className="h-3 w-3 text-orange-500 shrink-0" />
                                )}
                              </div>
                              {item.ingredientesExcluidosNombres && item.ingredientesExcluidosNombres.length > 0 && (
                                <p className="text-[10px] text-orange-600 ml-1 mt-0.5">
                                  ⚠️ Sin: {item.ingredientesExcluidosNombres.join(', ')}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Card>
                </Fragment>
              )
            })}

            {/* Cargar más */}
            {hasMore && (
              <div className="text-center pt-4">
                <Button variant="outline" onClick={loadMore} disabled={isLoadingMore}>
                  {isLoadingMore ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Cargar más
                </Button>
              </div>
            )}

            {/* Sección de archivados */}
            {archivedPedidos.length > 0 && (
              <>
                <Separator className="my-6" />
                <div className="flex items-center gap-2 mb-3">
                  <Archive className="h-4 w-4 text-muted-foreground/60" />
                  <h3 className="text-sm font-medium text-muted-foreground">Archivados ({archivedPedidos.length})</h3>
                </div>
                {archivedPedidos.map((pedido, index) => {
                  const dateLabel = getDateLabel(pedido.createdAt)
                  const prevDateLabel = index > 0 ? getDateLabel(archivedPedidos[index - 1].createdAt) : null
                  const showDateSeparator = dateLabel !== prevDateLabel
                  return (
                    <Fragment key={`archived-${pedido.id}`}>
                      {showDateSeparator && (
                        <div className={`flex items-center gap-3 ${index === 0 ? '' : 'pt-3'}`}>
                          <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">{dateLabel}</span>
                          <Separator className="flex-1" />
                        </div>
                      )}
                      <Card
                        className="overflow-hidden opacity-50 hover:opacity-70 transition-all min-w-[330px] cursor-pointer active:scale-[0.99]"
                        onClick={() => navigate(`/dashboard/pedidos/${pedido.id}`)}
                      >
                        <div className="p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="text-sm font-medium">
                                  🍽️ {pedido.mesaNombre || `Pedido #${pedido.id}`}
                                </span>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground border-muted-foreground/30">
                                  Archivado
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                ${parseFloat(pedido.total).toFixed(2)}
                              </p>
                            </div>
                            <div className="shrink-0">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive/60 hover:text-destructive h-8 w-8 p-0"
                                title="Eliminar pedido"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setPedidoAEliminar(pedido)
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                          {/* Compact items list */}
                          <div className="mt-2 pt-2 border-t border-muted/50">
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                              {pedido.items.map((item: any) => (
                                <span key={item.id} className="text-xs text-muted-foreground">
                                  {item.cantidad}x {item.nombreProducto}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </Card>
                    </Fragment>
                  )
                })}
              </>
            )}
          </div>
        )}
      </div>

      {/* Dialog de confirmación para eliminar pedido */}
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
              Esta acción no se puede deshacer. Los productos pendientes se eliminarán.
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
