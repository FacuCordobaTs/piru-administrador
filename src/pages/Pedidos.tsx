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
import { useAdminContext } from '@/context/AdminContext'
import { toast } from 'sonner'
import { NotificationSheet } from '@/components/NotificationSheet'
import {
  Loader2, Search, Clock, CheckCircle, ChefHat, Utensils,
  ShoppingCart, RefreshCw, Wifi, WifiOff, Trash2,
  AlertTriangle, Play, X
} from 'lucide-react'

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
  estado: 'pending' | 'preparing' | 'delivered' | 'served' | 'closed'
  total: string
  createdAt: string
  closedAt?: string | null
  items: ItemPedido[]
  totalItems: number
  nombrePedido?: string | null  // Carrito mode
}

// Estructura para items en el tablero (que envuelve un pedido y sus items específicos para esa columna)
interface KanbanCardData {
  id: string // composite id: pedidoId-status
  pedido: PedidoData
  items: ItemPedido[]
  status: string
}

// Helper para calcular minutos transcurridos
const getMinutesAgo = (dateString: string) => {
  const date = new Date(dateString)
  // Ajuste manual: El servidor está 3 horas adelantado (o la fecha viene como UTC y la mostramos local),
  // así que sumamos 3 horas para que "3h ago" sean "0m ago".
  const adjustedDate = new Date(date.getTime() + 3 * 60 * 60 * 1000)

  const now = new Date()
  const diffMs = now.getTime() - adjustedDate.getTime()
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

// Columnas del Kanban - Restaurante normal
const COLUMNS = [
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
  {
    id: 'served',
    title: 'Entregados',
    icon: CheckCircle,
    color: 'text-indigo-600',
    bgHeader: 'bg-indigo-100 dark:bg-indigo-900/30',
    description: 'En mesa'
  },
]

// Columnas del Kanban - Modo Carrito
const CARRITO_COLUMNS = [
  {
    id: 'preparingSinPagar',
    title: 'Preparando (Sin Pagar)',
    icon: Clock,
    color: 'text-orange-600',
    bgHeader: 'bg-orange-100 dark:bg-orange-900/30',
    description: 'Esperando pago'
  },
  {
    id: 'preparingPagado',
    title: 'Preparando (Pagado)',
    icon: ChefHat,
    color: 'text-blue-600',
    bgHeader: 'bg-blue-100 dark:bg-blue-900/30',
    description: 'En cocina'
  },
  {
    id: 'delivered',
    title: 'Listos para Retirar',
    icon: Utensils,
    color: 'text-emerald-600',
    bgHeader: 'bg-emerald-100 dark:bg-emerald-900/30',
    description: 'Notificar cliente'
  },
]

const Pedidos = () => {
  const navigate = useNavigate()
  const token = useAuthStore((state) => state.token)
  const { restaurante } = useRestauranteStore()
  const esCarrito = restaurante?.esCarrito || false

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
  const [showClosed, setShowClosed] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [updatingPedido, setUpdatingPedido] = useState<number | null>(null)


  // // Estado para eliminar pedido
  // const [pedidoAEliminar, setPedidoAEliminar] = useState<PedidoData | null>(null)
  // const [isDeleting, setIsDeleting] = useState(false)

  // Estado para trackear qué pedidos cerrados tienen todos los pagos completados
  const [pedidosCerradosPagados, setPedidosCerradosPagados] = useState<Set<number>>(new Set())

  // Actualizar tiempo cada 30 segundos
  const [, setTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000)
    return () => clearInterval(interval)
  }, [])

  // Play sound on new important notifications


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
  // Actualizar pedidos activos desde WebSocket (ESTRATEGIA DEFENSIVA)
  useEffect(() => {
    if (mesasWS.length > 0) {
      setPedidos(prev => {
        // Creamos un mapa de los pedidos que vienen por WS para acceso rápido
        const wsMap = new Map(mesasWS.map(m => [m.pedido?.id, m]));

        // 1. Actualizamos los pedidos existentes (Conservando la verdad local)
        let updated = prev.map(pedidoLocal => {
          const mesaWS = wsMap.get(pedidoLocal.id);

          // Si este pedido no viene en el WS, no lo tocamos
          if (!mesaWS || !mesaWS.pedido) return pedidoLocal;

          // Si el pedido está cerrado en local y el WS dice lo mismo, ignoramos para no causar saltos
          if (pedidoLocal.estado === 'closed' && mesaWS.pedido.estado === 'closed') return pedidoLocal;

          // MERGE INTELIGENTE DE ITEMS
          // Estrategia: Iteramos sobre los items LOCALES para asegurar que no perdemos datos.
          // Solo actualizamos si el WS trae información nueva y válida.
          const currentItemsMap = new Map(pedidoLocal.items.map(i => [i.id, i]));
          const wsItemsMap = new Map(mesaWS.items.map(i => [i.id, i]));

          // a) Revisar items existentes
          const mergedExistingItems = pedidoLocal.items.map(localItem => {
            const wsItem = wsItemsMap.get(localItem.id);

            // Si el item no está en el WS (y no fue borrado), mantenemos el local
            if (!wsItem) return localItem;

            // PROTECCIÓN DE ESTADO (El corazón del arreglo):
            // Si localmente ya está avanzado (Listos/Entregados) y el WS dice "preparing" (o nada),
            // asumimos que el WS trae datos viejos/básicos y PROTEGEMOS el estado local.
            const estadoLocal = localItem.estado;
            const estadoWS = (wsItem as any).estado; // A veces viene como propiedad directa

            let estadoFinal = estadoWS || estadoLocal; // Si WS no tiene estado, usa local

            const estadosAvanzados = ['delivered', 'served', 'cancelled'];
            const estadosBasicos = ['pending', 'preparing'];

            // Si yo tengo un estado avanzado y el WS me quiere regresar a uno básico...
            if (estadosAvanzados.includes(estadoLocal || '') &&
              (!estadoWS || estadosBasicos.includes(estadoWS))) {
              // ...¡LE DIGO QUE NO! Me quedo con mi estado local.
              estadoFinal = estadoLocal;
            }

            return {
              ...localItem, // Mantenemos fotos, nombres, notas locales
              ...wsItem,    // Actualizamos cantidades o datos cambiantes
              estado: estadoFinal // Forzamos el estado decidido
            };
          });

          // b) Detectar items NUEVOS que vienen en el WS pero no tengo en local
          // (Ej: El cliente agregó una bebida desde su cel)
          const newItemsFromWS = mesaWS.items
            .filter(wsItem => !currentItemsMap.has(wsItem.id))
            .map(wsItem => ({
              ...wsItem,
              // Si es nuevo, confiamos en el estado que traiga o preparing por defecto
              estado: (wsItem as any).estado || 'preparing'
            }));

          return {
            ...pedidoLocal,
            estado: mesaWS.pedido.estado, // El estado general del pedido sí confiamos en el WS
            total: mesaWS.pedido.total,
            totalItems: mesaWS.totalItems,
            items: [...mergedExistingItems, ...newItemsFromWS] // Unimos protegidos + nuevos
          };
        });

        // 2. Agregar pedidos NUEVOS que vienen por WS y no están en local
        mesasWS.forEach(mesa => {
          if (mesa.pedido && mesa.pedido.estado !== 'closed') {
            const exists = prev.some(p => p.id == mesa.pedido!.id);
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
              };
              updated = [newPedido, ...updated];
            }
          }
        });

        return updated;
      });
    }
  }, [mesasWS]);

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
      } else if (nuevoEstado === 'closed') {
        await pedidosApi.cerrar(token, pedido.id)
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
        served: 'Entregado',
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

  // Cambiar estado de un item específico
  const handleChangeItemEstado = async (pedido: PedidoData, itemId: number, nuevoEstado: string) => {
    if (!token) return

    // Actualizar localmente optimísticamente
    setPedidos(prev => prev.map(p => {
      if (p.id !== pedido.id) return p
      return {
        ...p,
        items: p.items.map(i => i.id === itemId ? { ...i, estado: nuevoEstado as any } : i)
      }
    }))

    try {
      await pedidosApi.updateItemEstado(token, pedido.id, itemId, nuevoEstado)
      toast.success(`Item actualizado`)
    } catch (error) {
      console.error(error)
      toast.error('Error al actualizar item')
      // Revertir si hay error (podríamos implementar revert aquí)
      fetchPedidos(page, false) // Recargar para asegurar consistencia
    }
  }

  // Cambiar estado de TODOS los items de un pedido (para modo carrito)
  const handleChangeAllItemsEstado = async (pedido: PedidoData, items: ItemPedido[], nuevoEstado: string) => {
    if (!token) return

    setUpdatingPedido(pedido.id)

    // Actualizar localmente optimísticamente
    setPedidos(prev => prev.map(p => {
      if (p.id !== pedido.id) return p
      const itemIds = new Set(items.map(i => i.id))
      return {
        ...p,
        items: p.items.map(i => itemIds.has(i.id) ? { ...i, estado: nuevoEstado as any } : i)
      }
    }))

    try {
      // Actualizar cada item en el backend
      await Promise.all(
        items.map(item => pedidosApi.updateItemEstado(token, pedido.id, item.id, nuevoEstado))
      )
      const estadoLabels: Record<string, string> = {
        delivered: 'Listo',
        served: 'Entregado'
      }
      toast.success(`Pedido #${pedido.id} → ${estadoLabels[nuevoEstado] || nuevoEstado}`)
    } catch (error) {
      console.error(error)
      toast.error('Error al actualizar pedido')
      fetchPedidos(page, false)
    } finally {
      setUpdatingPedido(null)
    }
  }

  // // Eliminar pedido
  // const handleDeletePedido = async () => {
  //   if (!token || !pedidoAEliminar) return

  //   setIsDeleting(true)
  //   try {
  //     await pedidosApi.delete(token, pedidoAEliminar.id)
  //     toast.success('Pedido eliminado', {
  //       description: `El pedido #${pedidoAEliminar.id} ha sido eliminado`
  //     })
  //     setPedidos(prev => prev.filter(p => p.id !== pedidoAEliminar.id))
  //     setPedidoAEliminar(null)
  //   } catch (error) {
  //     if (error instanceof ApiError) {
  //       toast.error('Error al eliminar', { description: error.message })
  //     }
  //   } finally {
  //     setIsDeleting(false)
  //   }
  // }

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

  // Verificar pagos de pedidos cerrados (y preparing para carritos)
  useEffect(() => {
    const verificarPagos = async () => {
      // Para carritos, verificar también los pedidos en preparing
      const pedidosAVerificar = esCarrito
        ? filteredPedidos.filter(p => p.estado === 'closed' || p.estado === 'preparing')
        : filteredPedidos.filter(p => p.estado === 'closed')
      if (pedidosAVerificar.length === 0) return

      const nuevosPagados = new Set<number>()

      await Promise.all(
        pedidosAVerificar.map(async (pedido) => {
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
  }, [filteredPedidos, esCarrito])

  // Agrupar por columna - REFACTORIZADO para Items
  const kanbanData = useMemo(() => {
    const grouped: Record<string, KanbanCardData[]> = {
      pending: [],
      preparing: [],
      preparingSinPagar: [],
      preparingPagado: [],
      delivered: [],
      served: [],
      closedPending: [],
      closedPaid: [],
    }

    filteredPedidos.forEach(pedido => {
      // 1. Pending: Si el pedido está 'pending', va entero a pending
      if (pedido.estado === 'pending') {
        grouped.pending.push({
          id: `${pedido.id}-pending`,
          pedido,
          items: pedido.items, // Todos los items
          status: 'pending'
        })
        return
      }

      // 2. Closed: Si está cerrado, va entero a closed
      if (pedido.estado === 'closed') {
        const target = pedidosCerradosPagados.has(pedido.id) ? 'closedPaid' : 'closedPending'
        grouped[target].push({
          id: `${pedido.id}-closed`,
          pedido,
          items: pedido.items,
          status: 'closed'
        })
        return
      }

      // 3. Active (preparing/delivered/served): Separar items por estado

      // Items en cocina (preparing)
      // Items que no tienen estado o están en preparing o pending (si el pedido ya no es pending)
      const itemsPreparing = pedido.items.filter(i => !i.estado || i.estado === 'preparing' || i.estado === 'pending')
      if (itemsPreparing.length > 0) {
        if (esCarrito) {
          const target = pedidosCerradosPagados.has(pedido.id) ? 'preparingPagado' : 'preparingSinPagar'
          grouped[target].push({
            id: `${pedido.id}-preparing`,
            pedido,
            items: itemsPreparing,
            status: 'preparing'
          })
        } else {
          grouped.preparing.push({
            id: `${pedido.id}-preparing`,
            pedido,
            items: itemsPreparing,
            status: 'preparing'
          })
        }
      }

      // Items listos (delivered)
      const itemsDelivered = pedido.items.filter(i => i.estado === 'delivered')
      if (itemsDelivered.length > 0) {
        grouped.delivered.push({
          id: `${pedido.id}-delivered`,
          pedido,
          items: itemsDelivered,
          status: 'delivered'
        })
      }

      // Items entregados (served)
      const itemsServed = pedido.items.filter(i => i.estado === 'served')
      if (itemsServed.length > 0) {
        grouped.served.push({
          id: `${pedido.id}-served`,
          pedido,
          items: itemsServed,
          status: 'served'
        })
      }
    })

    // Ordenar
    // Ordenar
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => {
        const dateA = new Date(a.pedido.createdAt).getTime()
        const dateB = new Date(b.pedido.createdAt).getTime()

        // Para columnas cerradas, orden descendente (más recientes arriba)
        if (key === 'closedPending' || key === 'closedPaid') {
          return dateB - dateA
        }

        // Para columnas activas, orden ascendente (más antiguos arriba - FIFO)
        return dateA - dateB
      })
    })

    return grouped
  }, [filteredPedidos, pedidosCerradosPagados, esCarrito])

  // Contar totales items/tarjetas
  const counts = useMemo(() => ({
    pending: kanbanData.pending.length,
    preparing: kanbanData.preparing.length,
    delivered: kanbanData.delivered.length,
    served: kanbanData.served.length,
    total: filteredPedidos.filter(p => p.estado !== 'closed').length
  }), [kanbanData, filteredPedidos])

  // Componente de tarjeta de pedido
  const PedidoCard = ({ data, compact = false }: { data: KanbanCardData; compact?: boolean }) => {
    const { pedido, items, status } = data
    const isUpdating = updatingPedido === pedido.id

    // Acción principal para todo el grupo
    const getGroupAction = () => {
      if (status === 'pending') {
        return { label: 'Confirmar Todo', icon: Play, action: () => handleChangeEstado(pedido, 'preparing'), color: 'bg-blue-600 hover:bg-blue-700' }
      }
      if (status === 'served') {
        // Verificar si todos los items del pedido están served
        const allItemsProcessed = pedido.items.every(i => i.estado === 'served' || i.estado === 'cancelled')
        if (allItemsProcessed) {
          return { label: 'Cerrar Pedido', icon: CheckCircle, action: () => handleChangeEstado(pedido, 'closed'), color: 'bg-slate-600 hover:bg-slate-700' }
        }
      }
      return null
    }

    const groupAction = getGroupAction()
    const maxItems = compact ? 2 : 100
    const hasExclusions = items.some(i => i.ingredientesExcluidosNombres?.length)

    const itemsByClient = useMemo(() => {
      const grouped: Record<string, ItemPedido[]> = {}
      items.forEach(item => {
        const name = item.clienteNombre || 'Cliente'
        if (!grouped[name]) grouped[name] = []
        grouped[name].push(item)
      })
      return grouped
    }, [items])

    return (
      <Card
        className={`transition-all duration-200 border-2 cursor-pointer group hover:border-primary/50 relative overflow-hidden`}
        onClick={() => navigate(`/dashboard/pedidos/${pedido.id}`)}
      >
        {/* Color stripe based on status */}
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${status === 'preparing' ? 'bg-blue-500' :
          status === 'delivered' ? 'bg-emerald-500' :
            status === 'served' ? 'bg-indigo-500' :
              'bg-transparent'
          }`} />

        <CardContent className="p-0 pl-1">
          {/* Header */}
          <div className="flex items-center justify-between p-3 pb-2 border-b border-border/40 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="text-xl font-bold text-foreground truncate">
                {esCarrito && pedido.nombrePedido
                  ? `${pedido.nombrePedido}`
                  : (pedido.mesaNombre || `Mesa ?`)}
              </div>
              {hasExclusions && <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />}
            </div>
            <span className="text-xs font-mono text-muted-foreground">
              {formatTimeAgo(pedido.createdAt)}
            </span>
          </div>

          {/* Items agrupados por cliente */}
          <div className="px-3 pb-2 space-y-4">
            {Object.entries(itemsByClient).map(([cliente, clientItems]) => (
              <div key={cliente} className="space-y-1">
                {/* Header Cliente */}
                <div className="flex items-center gap-1.5 pb-1">
                  <Badge variant="outline" className="h-5 px-1.5 gap-1 text-[10px] font-normal text-muted-foreground">
                    <span className="font-semibold">{cliente}</span>
                  </Badge>
                </div>

                {/* Items del cliente */}
                <div className="space-y-2 pl-1">
                  {clientItems.slice(0, maxItems).map((item) => (
                    <div key={item.id} className="flex items-start gap-2 text-sm group/item">
                      <span className="font-bold text-foreground shrink-0 w-6 text-center bg-muted rounded-md py-0.5 text-xs">
                        {item.cantidad}
                      </span>

                      <div className="flex-1 min-w-0">
                        <span className="text-foreground/90 font-medium truncate block leading-tight">
                          {item.nombreProducto}
                        </span>
                        {item.ingredientesExcluidosNombres && item.ingredientesExcluidosNombres.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {item.ingredientesExcluidosNombres.map((ing, i) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 font-medium border border-orange-200 dark:border-orange-800/50">
                                Sin {ing}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Acciones por item - Solo en modo RESTAURANTE */}
                      {!esCarrito && (
                        <div onClick={(e) => e.stopPropagation()} className="shrink-0 flex gap-1">
                          {status === 'preparing' && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-100"
                              title="Marcar Listo"
                              onClick={() => handleChangeItemEstado(pedido, item.id, 'delivered')}
                              disabled={isUpdating}
                            >
                              {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                            </Button>
                          )}
                          {status === 'delivered' && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-indigo-600 hover:bg-indigo-100"
                              title="Marcar Entregado"
                              onClick={() => handleChangeItemEstado(pedido, item.id, 'served')}
                              disabled={isUpdating}
                            >
                              {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Utensils className="h-4 w-4" />}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-3 pt-2 border-t border-border/50 bg-muted/10">
            <span className="text-xs text-muted-foreground">#{pedido.id}</span>

            <div className="flex gap-2">
              {/* Botón eliminar (solo en pending?) */}
              {status === 'pending' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground/50 hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    // setPedidoAEliminar(pedido)
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}

              {groupAction && (
                <Button
                  size="sm"
                  className={`${groupAction.color} text-white font-semibold h-7 text-xs`}
                  disabled={isUpdating}
                  onClick={(e) => {
                    e.stopPropagation()
                    groupAction.action()
                  }}
                >
                  {isUpdating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  {groupAction.label}
                </Button>
              )}

              {/* Botones de acción global para modo CARRITO */}
              {esCarrito && status === 'preparing' && (
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-7 text-xs gap-1"
                  disabled={isUpdating}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleChangeAllItemsEstado(pedido, items, 'delivered')
                  }}
                >
                  {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                  Listo
                </Button>
              )}
              {esCarrito && status === 'delivered' && (
                <Button
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold h-7 text-xs gap-1"
                  disabled={isUpdating}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleChangeAllItemsEstado(pedido, items, 'served')
                  }}
                >
                  {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Utensils className="h-3 w-3" />}
                  Entregado
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

          {/* Controles para Mobile y Desktop */}
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
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30">
            <CheckCircle className="h-4 w-4 text-indigo-600" />
            <span className="font-semibold text-indigo-700 dark:text-indigo-400">{counts.served}</span>
            <span className="text-indigo-600/80">entregados</span>
          </div>
        </div>
      </div>

      {/* Vista Kanban - Desktop */}
      <div className="flex-1 hidden lg:flex gap-4 p-4 overflow-x-auto">
        {(esCarrito ? CARRITO_COLUMNS : COLUMNS).map((column) => {
          const columnCards = kanbanData[column.id] || []
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
                    {columnCards.length}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{column.description}</p>
              </div>

              {/* Lista de tarjetas */}
              <ScrollArea className="flex-1 bg-muted/30 rounded-b-lg border border-t-0">
                <div className="p-3 space-y-3">
                  {columnCards.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Sin pedidos</p>
                    </div>
                  ) : (
                    columnCards.map((card) => (
                      <PedidoCard key={card.id} data={card} />
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          )
        })}

        {/* Columna de cerrados pendientes de pago */}
        {showClosed && kanbanData.closedPending.length > 0 && (
          <div className="flex-1 flex flex-col min-w-[280px] max-w-[320px]">
            <div className="shrink-0 rounded-t-lg px-4 py-3 bg-orange-100 dark:bg-orange-900/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-orange-600" />
                  <span className="font-bold text-foreground">Cerrados (Pendiente pago)</span>
                </div>
                <Badge variant="secondary" className="font-mono">
                  {kanbanData.closedPending.length}
                </Badge>
              </div>
            </div>
            <ScrollArea className="flex-1 bg-muted/20 rounded-b-lg border border-t-0">
              <div className="p-3 space-y-2">
                {kanbanData.closedPending.slice(0, 10).map((card) => (
                  <Card
                    key={card.id}
                    className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/dashboard/pedidos/${card.pedido.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold">{card.pedido.mesaNombre}</span>
                        <span className="text-xs text-muted-foreground ml-2">#{card.pedido.id}</span>
                      </div>
                      <span className="font-semibold">${parseFloat(card.pedido.total).toFixed(0)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatTimeAgo(card.pedido.createdAt)}
                    </p>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Columna de cerrados pagados */}
        {showClosed && kanbanData.closedPaid.length > 0 && (
          <div className="flex-1 flex flex-col min-w-[280px] max-w-[320px] opacity-60">
            <div className="shrink-0 rounded-t-lg px-4 py-3 bg-slate-100 dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-slate-500" />
                  <span className="font-bold text-foreground">Cerrados (Pagados)</span>
                </div>
                <Badge variant="secondary" className="font-mono">
                  {kanbanData.closedPaid.length}
                </Badge>
              </div>
            </div>
            <ScrollArea className="flex-1 bg-muted/20 rounded-b-lg border border-t-0">
              <div className="p-3 space-y-2">
                {kanbanData.closedPaid.slice(0, 10).map((card) => (
                  <Card
                    key={card.id}
                    className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/dashboard/pedidos/${card.pedido.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold">{card.pedido.mesaNombre}</span>
                        <span className="text-xs text-muted-foreground ml-2">#{card.pedido.id}</span>
                      </div>
                      <span className="font-semibold">${parseFloat(card.pedido.total).toFixed(0)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatTimeAgo(card.pedido.createdAt)}
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
          {(esCarrito ? CARRITO_COLUMNS : COLUMNS).map((column) => {
            const columnCards = kanbanData[column.id] || []
            const ColumnIcon = column.icon

            if (columnCards.length === 0) return null

            return (
              <div key={column.id}>
                {/* Header de sección */}
                <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-lg ${column.bgHeader}`}>
                  <ColumnIcon className={`h-5 w-5 ${column.color}`} />
                  <span className="font-bold text-foreground flex-1">{column.title}</span>
                  <Badge variant="secondary" className="font-mono font-bold">
                    {columnCards.length}
                  </Badge>
                </div>

                {/* Cards */}
                <div className="space-y-3">
                  {columnCards.map((card) => (
                    <PedidoCard key={card.id} data={card} compact />
                  ))}
                </div>
              </div>
            )
          })}

          {/* Pedidos cerrados pendientes de pago - Mobile */}
          {showClosed && kanbanData.closedPending.length > 0 && (
            <div>
              {/* Header de sección */}
              <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                <CheckCircle className="h-5 w-5 text-orange-600" />
                <span className="font-bold text-foreground flex-1">Cerrados (Pendiente pago)</span>
                <Badge variant="secondary" className="font-mono font-bold">
                  {kanbanData.closedPending.length}
                </Badge>
              </div>

              <div className="space-y-3">
                {kanbanData.closedPending.slice(0, 10).map((card) => (
                  <Card
                    key={card.id}
                    className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/dashboard/pedidos/${card.pedido.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold">{card.pedido.mesaNombre}</span>
                        <span className="text-xs text-muted-foreground ml-2">#{card.pedido.id}</span>
                      </div>
                      <span className="font-semibold">${parseFloat(card.pedido.total).toFixed(0)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatTimeAgo(card.pedido.createdAt)}
                    </p>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Pedidos
