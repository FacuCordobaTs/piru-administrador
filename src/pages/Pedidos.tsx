import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
import { usePrinter } from '@/context/PrinterContext'
import { formatComanda, commandsToBytes } from '@/utils/printerUtils'
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
    id: 'pending',
    title: 'Pendientes',
    icon: Clock,
    color: 'text-amber-600',
    bgHeader: 'bg-amber-100 dark:bg-amber-900/30',
    description: 'Por confirmar'
  },
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

// Interface para pagos detallados
interface SubtotalInfo {
  clienteNombre: string;
  subtotal: string;
  pagado: boolean;
  metodo?: string;
  estado?: 'pending' | 'pending_cash' | 'paid' | 'failed';
  isMozoItem?: boolean;
  itemId?: number;
  nombreProducto?: string;
}

const Pedidos = () => {
  const navigate = useNavigate()
  const token = useAuthStore((state) => state.token)
  const { restaurante, productos: allProductos, categorias: allCategorias } = useRestauranteStore()
  const esCarrito = restaurante?.esCarrito || false
  const splitPayment = restaurante?.splitPayment ?? true // Default to true if undefined
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
  const [showClosed, setShowClosed] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [updatingPedido, setUpdatingPedido] = useState<number | null>(null)

  // Estado para eliminar pedido
  const [pedidoAEliminar, setPedidoAEliminar] = useState<PedidoData | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Estado para cerrar y pagar pedido
  const [pedidoACerrarYPagar, setPedidoACerrarYPagar] = useState<PedidoData | null>(null)
  const [isClosingAndPaying, setIsClosingAndPaying] = useState(false)

  // Mapa de subtotales por pedidoId para mostrar estado de pagos
  const [pedidosSubtotales, setPedidosSubtotales] = useState<Record<number, SubtotalInfo[]>>({})
  const [updatingPago, setUpdatingPago] = useState<string | null>(null) // clienteNombre que se está actualizando

  // Estados derivados simplificados (ya no necesitamos 'pedidosCerradosPagados' booleano estricto, usamos el mapa)
  const pedidosCerradosPagados = useMemo(() => {
    const setPagados = new Set<number>()
    Object.entries(pedidosSubtotales).forEach(([pedidoId, subs]) => {
      // Si todos los subtotales están pagados y hay al menos uno
      if (subs.length > 0 && subs.every(s => s.pagado)) {
        setPagados.add(Number(pedidoId))
      }
    })
    return setPagados
  }, [pedidosSubtotales])

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
  // Actualizar pedidos activos desde
  // Ref para rastrear el estado anterior de los pedidos y sus items para impresión automática
  const processedOrdersRef = useRef<Map<number, { status: string, itemIds: Set<number> }>>(new Map());

  // Efecto para sincronizar pedidos con WS y manejar IMPRESIÓN AUTOMÁTICA
  useEffect(() => {
    if (mesasWS.length > 0) {

      // Lógica de impresión automática (Side Effect)
      if (selectedPrinter) {
        mesasWS.forEach(mesa => {
          if (!mesa.pedido) return;

          const pedidoId = mesa.pedido.id;
          const currentStatus = mesa.pedido.estado;
          const currentItemIds = new Set(mesa.items.map(i => i.id));

          const prevData = processedOrdersRef.current.get(pedidoId);

          // 1. Detectar transición PENDING -> PREPARING (Confirmación desde App Cliente)
          if (prevData && prevData.status === 'pending' && currentStatus === 'preparing') {
            // Imprimir todo el pedido (filtrando bebidas) y mapeando categoría
            const itemsToPrint = mesa.items
              .map(item => {
                const producto = allProductos.find(p => p.id === item.productoId);
                const categoria = producto && producto.categoriaId
                  ? allCategorias.find(c => c.id === producto.categoriaId)
                  : null;
                return { ...item, producto, categoria };
              })
              .filter(data => {
                if (!data.producto || !data.categoria) return true; // Si falta info, lo dejamos pasar por seguridad (irá a OTROS)
                return !data.categoria.nombre.toLowerCase().includes('bebidas');
              })
              .map(data => ({
                ...data,
                categoriaNombre: data.categoria ? data.categoria.nombre : undefined
              }));

            if (itemsToPrint.length > 0) {
              console.log("🖨️ Auto-printing confirmed order:", pedidoId);
              const comandaData = formatComanda(mesa.pedido, itemsToPrint, restaurante?.nombre || 'Restaurante');
              printRaw(commandsToBytes(comandaData)).catch((err: Error) => console.error("Error printing confirmed order:", err));
              toast.success(`Imprimiendo comanda #${pedidoId}`);
            }
          }

          // 2. Detectar NUEVOS ITEMS en pedido ya confirmado (PREPARING)
          else if (currentStatus === 'preparing' && prevData) {
            // Identificar items nuevos
            const newItems = mesa.items.filter(item => !prevData.itemIds.has(item.id));

            if (newItems.length > 0) {
              const itemsToPrint = newItems
                .map(item => {
                  const producto = allProductos.find(p => p.id === item.productoId);
                  const categoria = producto && producto.categoriaId
                    ? allCategorias.find(c => c.id === producto.categoriaId)
                    : null;
                  return { ...item, producto, categoria };
                })
                .filter(data => {
                  if (!data.producto || !data.categoria) return true;
                  return !data.categoria.nombre.toLowerCase().includes('bebida');
                })
                .map(data => ({
                  ...data,
                  categoriaNombre: data.categoria ? data.categoria.nombre : undefined
                }));

              if (itemsToPrint.length > 0) {
                console.log("🖨️ Auto-printing new items for order:", pedidoId);
                const comandaData = formatComanda(mesa.pedido, itemsToPrint, restaurante?.nombre || 'Restaurante');
                printRaw(commandsToBytes(comandaData)).catch((err: Error) => console.error("Error printing new items:", err));
                toast.info(`Imprimiendo ${itemsToPrint.length} items nuevos`);
              }
            }
          }

          // Actualizar Ref
          processedOrdersRef.current.set(pedidoId, {
            status: currentStatus,
            itemIds: currentItemIds
          });
        });
      }

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
            } else {
              // YA EXISTE EL PEDIDO
              // Aquí antes hacíamos manejo de impresión, ahora se maneja arriba con useRef
              // Simplemente no hacemos nada extra aquí, el pedido se mantiene sincronizado por el map inicial
            }
          }
        });

        return updated;
      });
    }
  }, [mesasWS, selectedPrinter, allProductos, allCategorias, restaurante?.nombre, printRaw]);

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

      // IMPRESIÓN AUTOMÁTICA
      if (nuevoEstado === 'preparing' && selectedPrinter) {
        // Filtrar bebidas y agregar categorías
        const itemsToPrint = pedido.items
          .map(item => {
            const producto = allProductos.find(p => p.id === item.productoId);
            const categoria = producto && producto.categoriaId
              ? allCategorias.find(c => c.id === producto.categoriaId)
              : null;
            return { ...item, producto, categoria };
          })
          .filter(data => {
            if (!data.producto || !data.categoria) return true;
            return !data.categoria.nombre.toLowerCase().includes('bebida');
          })
          .map(data => ({
            ...data,
            categoriaNombre: data.categoria ? data.categoria.nombre : undefined
          }));

        if (itemsToPrint.length > 0) {
          const comandaData = formatComanda(pedido, itemsToPrint, restaurante?.nombre || 'Restaurante');
          printRaw(commandsToBytes(comandaData)).catch((err: Error) => console.error("Error auto-printing:", err));
          toast.success('Comanda enviada a cocina');
        }
      }

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

  // Confirmar pago en efectivo desde el tablero
  const handleConfirmarPagoEfectivo = async (pedidoId: number, clienteNombre: string) => {
    if (!token) return
    const loadingKey = `${pedidoId}-${clienteNombre}`
    setUpdatingPago(loadingKey)
    try {
      const response = await mercadopagoApi.confirmarEfectivo(token, pedidoId, clienteNombre) as { success: boolean; error?: string }
      if (response.success) {
        toast.success(`Pago de ${clienteNombre} confirmado`)
        // Actualizar localmente el subtotal para reflejar pagado
        setPedidosSubtotales(prev => {
          const subs = prev[pedidoId] || []
          return {
            ...prev,
            [pedidoId]: subs.map(s =>
              s.clienteNombre === clienteNombre
                ? { ...s, pagado: true, estado: 'paid', metodo: 'efectivo' }
                : s
            )
          }
        })
      } else {
        toast.error(response.error || 'Error al confirmar pago')
      }
    } catch (error) {
      toast.error('Error de conexión al confirmar pago')
    } finally {
      setUpdatingPago(null)
    }
  }

  // Cerrar y Pagar TODO (Acción masiva)
  const handleCerrarYPagar = async () => {
    if (!token || !pedidoACerrarYPagar) return

    setIsClosingAndPaying(true)
    const pedidoId = pedidoACerrarYPagar.id

    try {
      // 1. Obtener subtotales si no existen (para saber qué pagar)
      let subtotales = pedidosSubtotales[pedidoId]
      if (!subtotales) {
        try {
          const response = await mercadopagoApi.getSubtotales(pedidoId) as any
          if (response.success) {
            let allSubtotales = response.subtotales || []
            if (response.mozoItems && Array.isArray(response.mozoItems)) {
              allSubtotales = [...allSubtotales, ...response.mozoItems.map((m: any) => ({ ...m, isMozoItem: true }))]
            }
            subtotales = allSubtotales
            // Guardamos en estado por si falla algo visualmente, tener la data
            setPedidosSubtotales(prev => ({ ...prev, [pedidoId]: allSubtotales }))
          }
        } catch (e) {
          console.error("Error fetching subtotales for mass close", e)
        }
      }

      if (!subtotales) {
        toast.error("No se pudo obtener información de pagos. Intente nuevamente.")
        return
      }

      toast.message("Procesando cierre...", { description: "Actualizando items y pagos..." })

      // 2. Marcar items como served/entregados (si no lo están)
      // Lo hacemos masivamente si podemos, o item por item. Como no hay endpoint masivo público expuesto aquí (salvo updateEstado que cambia TODO el pedido),
      // usaremos 'updateEstado' a 'served' si queremos mover todo el pedido, pero el usuario pidió "poner todos sus productos en entregados".
      // Si cambiamos el estado del pedido a 'closed', implícitamente se cierra, pero los items pueden quedar en delivered.
      // Vamos a iterar sobre los items que no estén 'served' para marcarlos.
      // O mejor: Si el pedido pasa a 'closed', ya no importa tanto el estado individual visualmente en el kanban activo, 
      // pero para consistencia, marquemos los items.

      const itemsToServe = pedidoACerrarYPagar.items.filter(i => i.estado !== 'served' && i.estado !== 'cancelled')
      if (itemsToServe.length > 0) {
        // Opción A: Llamada paralela (puede ser mucho)
        // Opción B: Si tuviéramos endpoint masivo.
        // Opción C: Asumir que al cerrar el pedido, se dan por entregados.
        // El requerimiento dice: "poner todos sus productos en entregados".
        await Promise.all(itemsToServe.map(i => pedidosApi.updateItemEstado(token, pedidoId, i.id, 'served')))
      }

      // 3. Cerrar pedido (Requisito previo para pagar en efectivo)
      await pedidosApi.cerrar(token, pedidoId)

      // 4. Pagar todo (Efectivo y Confirmar)
      // Copiamos la lógica de handleConfirmarPagoTotal
      const pendientes = subtotales.filter((s: SubtotalInfo) => !s.pagado && s.estado !== 'paid')

      if (pendientes.length > 0) {
        const regularClients: string[] = []
        const mozoItemIds: number[] = []

        pendientes.forEach((p: SubtotalInfo) => {
          if (p.isMozoItem && p.itemId) {
            mozoItemIds.push(p.itemId)
          } else if (p.clienteNombre.startsWith('Mozo:item:')) {
            const id = parseInt(p.clienteNombre.split('Mozo:item:')[1])
            if (!isNaN(id)) mozoItemIds.push(id)
          } else {
            regularClients.push(p.clienteNombre)
          }
        })

        // 4a. Marcar como efectivo
        await mercadopagoApi.pagarEfectivo(pedidoId, regularClients, "", mozoItemIds)

        // 4b. Confirmar pago
        await Promise.all(
          pendientes.map((sub: SubtotalInfo) => mercadopagoApi.confirmarEfectivo(token, pedidoId, sub.clienteNombre))
        )
      }

      toast.success("Pedido cerrado y pagado correctamente")

      // Actualizar estado local
      setPedidos(prev => prev.map(p =>
        p.id === pedidoId
          ? { ...p, estado: 'closed', items: p.items.map(i => ({ ...i, estado: 'served' })) as any }
          : p
      ))

      // Cerrar modal
      setPedidoACerrarYPagar(null)

    } catch (error) {
      console.error(error)
      toast.error("Ocurrió un error al procesar el cierre completo")
    } finally {
      setIsClosingAndPaying(false)
    }
  }

  // Confirmar pago TOTAL (para modo sin split payment)
  const handleConfirmarPagoTotal = async (pedidoId: number, subtotales: SubtotalInfo[]) => {
    if (!token) return
    setUpdatingPago(`all-${pedidoId}`)

    try {
      // Filtrar lo que falta pagar
      const pendientes = subtotales.filter(s => !s.pagado && s.estado !== 'paid')

      if (pendientes.length === 0) {
        toast.info("Ya está todo pagado")
        return
      }

      // 1. Preparar datos para 'pagarEfectivo' (Setear estado pending_cash)
      const regularClients: string[] = []
      const mozoItemIds: number[] = []

      pendientes.forEach(p => {
        if (p.isMozoItem && p.itemId) {
          mozoItemIds.push(p.itemId)
        } else if (p.clienteNombre.startsWith('Mozo:item:')) {
          const id = parseInt(p.clienteNombre.split('Mozo:item:')[1])
          if (!isNaN(id)) mozoItemIds.push(id)
        } else {
          regularClients.push(p.clienteNombre)
        }
      })

      // Paso 1: Marcar como efectivo (pending_cash) GLOBALMENTE
      const responsePagar = await mercadopagoApi.pagarEfectivo(pedidoId, regularClients, "", mozoItemIds) as { success: boolean; error?: string }

      if (!responsePagar.success) {
        toast.error(responsePagar.error || "Error al iniciar pago en efectivo")
        return
      }

      // Paso 2: Confirmar pago (paid) INDIVIDUALMENTE
      const results = await Promise.allSettled(
        pendientes.map(sub => mercadopagoApi.confirmarEfectivo(token, pedidoId, sub.clienteNombre))
      )

      const successCount = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length

      if (successCount > 0) {
        toast.success(`Pago total confirmado (${successCount}/${pendientes.length} cuentas procesadas)`)

        // Actualizar UI localmente marcando TODO como pagado
        setPedidosSubtotales(prev => {
          const subs = prev[pedidoId] || []
          return {
            ...prev,
            [pedidoId]: subs.map(s => ({ ...s, pagado: true, estado: 'paid', metodo: 'efectivo' }))
          }
        })
      } else {
        toast.error("No se pudo confirmar el pago")
      }

    } catch (error) {
      console.error("Error en pago total:", error)
      toast.error('Error al procesar el pago total')
    } finally {
      setUpdatingPago(null)
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

  // Obtener subtotales detallados para pedidos cerrados
  useEffect(() => {
    const verificarPagos = async () => {
      const pedidosAVerificar = esCarrito
        ? filteredPedidos.filter(p => p.estado === 'closed' || p.estado === 'preparing')
        : filteredPedidos.filter(p => p.estado === 'closed')

      if (pedidosAVerificar.length === 0) return

      await Promise.all(
        pedidosAVerificar.map(async (pedido) => {
          try {
            const response = await mercadopagoApi.getSubtotales(pedido.id) as {
              success: boolean
              subtotales?: SubtotalInfo[]
              mozoItems?: SubtotalInfo[]
              resumen?: { todoPagado: boolean }
            }

            if (response.success) {
              let allSubtotales = response.subtotales || []
              if (response.mozoItems && Array.isArray(response.mozoItems)) {
                allSubtotales = [...allSubtotales, ...response.mozoItems.map(m => ({ ...m, isMozoItem: true }))]
              }
              setPedidosSubtotales(prev => ({
                ...prev,
                [pedido.id]: allSubtotales
              }))
            }
          } catch (error) {
            console.error(`Error verificando pagos del pedido ${pedido.id}:`, error)
          }
        })
      )
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
      // 1. Pending: Si el pedido está 'pending' Y tiene items, va entero a pending
      if (pedido.estado === 'pending') {
        // Si no tiene items, ignorar (mesa abierta sin productos)
        if (pedido.items.length === 0) return

        grouped.pending.push({
          id: `${pedido.id}-pending`,
          pedido,
          items: pedido.items, // Todos los items
          status: 'pending'
        })
        return
      }

      // 2. Closed: Solo mover a columnas cerradas si TODOS los items están en 'served' (SOLO para modo restaurante)
      if (pedido.estado === 'closed') {
        const allItemsServed = pedido.items.every(i => i.estado === 'served' || i.estado === 'cancelled')

        // Solo si todos los items están entregados, o si estamos en modo carrito, va a la columna cerrada
        if (allItemsServed || esCarrito) {
          const target = pedidosCerradosPagados.has(pedido.id) ? 'closedPaid' : 'closedPending'
          grouped[target].push({
            id: `${pedido.id}-closed`,
            pedido,
            items: pedido.items,
            status: 'closed'
          })
          return
        }
        // Si no todos están served en modo restaurante, continuamos para distribuir items por estado
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
    const safeItems = Array.isArray(items) ? items : []
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
    const hasExclusions = safeItems.some(i => i.ingredientesExcluidosNombres?.length)

    // --------------------------------------------------------
    // LÓGICA DE PAGOS (Solo para pedidos cerrados)
    // --------------------------------------------------------
    const isClosed = pedido.estado === 'closed'
    const subtotales = pedidosSubtotales[pedido.id] || []

    // Calcular si está todo pagado
    const isFullyPaid = subtotales.length > 0 && subtotales.every(s => s.pagado)
    const totalPedido = subtotales.reduce((acc, curr) => acc + parseFloat(curr.subtotal), 0)

    const itemsByClient = useMemo(() => {
      const grouped: Record<string, ItemPedido[]> = {}
      safeItems.forEach(item => {
        const name = item.clienteNombre || 'Cliente'
        if (!grouped[name]) grouped[name] = []
        grouped[name].push(item)
      })

      // Asegurarnos de que si hay "Mozo" items en los subtotales, aparezcan aunque no tengan items "físicos" en esta vista
      if (isClosed && subtotales.length > 0) {
        subtotales.forEach(sub => {
          if (sub.isMozoItem && !grouped[sub.clienteNombre]) {
            grouped[sub.clienteNombre] = []
          }
        })
      }

      return grouped
    }, [safeItems, isClosed, subtotales])

    // Determinar si mostramos vista UNIFICADA (Sin Split Payment)
    const showUnifiedPayment = !splitPayment && isClosed && !esCarrito

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
              {/* Badge de estado de cuenta - Solo en modo restaurante cuando el pedido está cerrado pero items aún en progreso */}
              {!esCarrito && pedido.estado === 'closed' && (
                <Badge
                  variant="outline"
                  className={isFullyPaid
                    ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 text-[10px] px-1.5 py-0.5"
                    : "bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-700 text-[10px] px-1.5 py-0.5"}
                >
                  {isFullyPaid ? "💳 Pagado" : "📋 Cuenta Pedida"}
                </Badge>
              )}
            </div>
            <span className="text-xs font-mono text-muted-foreground">
              {formatTimeAgo(pedido.createdAt)}
            </span>
          </div>

          {/* VISTA UNIFICADA (SIN SPLIT PAYMENT) */}
          {showUnifiedPayment && (
            <div className="px-3 pb-3 bg-muted/20 mx-1 rounded-md mb-2">
              <div className="flex justify-between items-center py-2 border-b border-dashed border-border/50 mb-2">
                <span className="text-sm font-medium">Total Mesa</span>
                <span className="text-lg font-bold">${totalPedido.toLocaleString()}</span>
              </div>

              {!isFullyPaid ? (
                <Button
                  className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleConfirmarPagoTotal(pedido.id, subtotales);
                  }}
                  disabled={!!updatingPago}
                >
                  {updatingPago === `all-${pedido.id}` ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <div className="flex items-center">
                      <span className="mr-2">💵</span> Confirmar Pago Total
                    </div>
                  )}
                </Button>
              ) : (
                <div className="w-full py-1.5 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-md text-center text-sm font-medium border border-emerald-200 dark:border-emerald-800 flex items-center justify-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Mesa Pagada
                </div>
              )}
            </div>
          )}

          {/* Items agrupados por cliente */}
          <div className="px-3 pb-2 space-y-4">
            {Object.entries(itemsByClient).map(([cliente, clientItems]) => {
              // Lógica de pago para este cliente
              const subtotalData = subtotales.find(s => s.clienteNombre === cliente)
              // Estado de pago
              const isPaid = subtotalData?.pagado
              const isPendingCash = subtotalData?.estado === 'pending_cash'
              const paymentMethod = subtotalData?.metodo

              // Determinar si mostramos controles de pago
              const showPaymentControls = isClosed // Solo mostrar en pedidos cerrados
              const showIndividualPaymentControls = showPaymentControls && !showUnifiedPayment

              const isConfirming = updatingPago === `${pedido.id}-${cliente}`

              return (
                <div key={cliente} className="space-y-1">
                  {/* Header Cliente + Pagos */}
                  <div className="flex items-center justify-between pb-1">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="h-5 px-1.5 gap-1 text-[10px] font-normal text-muted-foreground">
                        <span className="font-semibold">{cliente}</span>
                      </Badge>

                      {/* Badge de Pago - Solo mostramos detalle si es Split Payment. Si es unificado, el badge global manda. */}
                      {showIndividualPaymentControls && (
                        <div className="flex items-center">
                          {isPaid && (
                            <Badge variant="secondary" className="h-5 px-1.5 text-[9px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 gap-1">
                              <CheckCircle className="h-2.5 w-2.5" />
                              {paymentMethod === 'mercadopago' ? 'MP' : 'Efectivo'}
                            </Badge>
                          )}
                          {!isPaid && isPendingCash && (
                            <Badge variant="secondary" className="h-5 px-1.5 text-[9px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 gap-1">
                              <Clock className="h-2.5 w-2.5" /> Efectivo
                            </Badge>
                          )}
                          {!isPaid && !isPendingCash && subtotalData && (
                            <Badge variant="outline" className="h-5 px-1.5 text-[9px] text-muted-foreground border-dashed">
                              Pendiente
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Acción de Cobrar (Solo si está pendiente efectivo y estamos en modo Split Payment) */}
                    {showIndividualPaymentControls && !isPaid && isPendingCash && (
                      <Button
                        size="sm"
                        className="h-6 text-[10px] px-2 bg-green-600 hover:bg-green-700 text-white shadow-sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleConfirmarPagoEfectivo(pedido.id, cliente)
                        }}
                        disabled={isConfirming}
                      >
                        {isConfirming ? <Loader2 className="h-3 w-3 animate-spin" /> : "Cobrar"}
                      </Button>
                    )}

                    {/* Botón manual para marcar pagado en modo individual (si no es pending cash) */}
                    {showIndividualPaymentControls && !isPaid && !isPendingCash && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[10px] px-2 hover:bg-emerald-100 hover:text-emerald-700 text-muted-foreground"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleConfirmarPagoEfectivo(pedido.id, cliente)
                        }}
                        disabled={isConfirming}
                      >
                        {isConfirming ? <Loader2 className="h-3 w-3 animate-spin" /> : "Marcar Pagado"}
                      </Button>
                    )}
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
              )
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-3 pt-2 border-t border-border/50 bg-muted/10">
            <span className="text-xs text-muted-foreground">#{pedido.id}</span>

            <div className="flex gap-2">
              {/* Botón eliminar (visible en pending, preparing, delivered, served) */}
              {(status === 'pending' || status === 'preparing' || status === 'delivered' || status === 'served') && (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground/50 hover:text-destructive"
                    title="Eliminar pedido completo"
                    disabled={isUpdating}
                    onClick={(e) => {
                      e.stopPropagation()
                      setPedidoAEliminar(pedido)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>

                  {/* Botón Confirmar y Cerrar Todo (Check Circle) */}
                  {(status === 'preparing' || status === 'delivered' || status === 'served') && !esCarrito && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground/50 hover:text-emerald-600 hover:bg-emerald-50"
                      title="Cerrar y Confirmar todo Pagado"
                      disabled={isUpdating}
                      onClick={(e) => {
                        e.stopPropagation()
                        setPedidoACerrarYPagar(pedido)
                      }}
                    >
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>
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
        {showClosed && (
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
                {kanbanData.closedPending.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Sin pedidos</p>
                  </div>
                ) : (
                  kanbanData.closedPending.slice(0, 10).map((card) => (
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
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Columna de cerrados pagados */}
        {showClosed && (
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
                {kanbanData.closedPaid.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Sin pedidos</p>
                  </div>
                ) : (
                  <>
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
                  </>
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

          {/* Pedidos cerrados pagados - Mobile */}
          {showClosed && kanbanData.closedPaid.length > 0 && (
            <div>
              {/* Header de sección */}
              <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                <span className="font-bold text-foreground flex-1">Cerrados (Pagados)</span>
                <Badge variant="secondary" className="font-mono font-bold">
                  {kanbanData.closedPaid.length}
                </Badge>
              </div>

              <div className="space-y-3">
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
                      <span className="font-semibold text-emerald-600">${parseFloat(card.pedido.total).toFixed(0)}</span>
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

      {/* Dialog de confirmación para CERRAR Y PAGAR TODO */}
      <Dialog open={!!pedidoACerrarYPagar} onOpenChange={(open) => !open && setPedidoACerrarYPagar(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle className="h-5 w-5" />
              ¿Cerrar y Confirmar Todo?
            </DialogTitle>
            <DialogDescription className="pt-2">
              Se realizarán las siguientes acciones para el pedido de <strong className="text-foreground">{pedidoACerrarYPagar?.mesaNombre || 'la mesa'}</strong>:
              <ul className="list-disc list-inside mt-2 space-y-1 text-foreground/80">
                <li>Marcar todos los productos como <strong>Entregados</strong>.</li>
                <li>Marcar todos los pagos como <strong>Cobrados en Efectivo</strong>.</li>
                <li><strong>Cerrar</strong> el pedido definitivamente.</li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPedidoACerrarYPagar(null)} disabled={isClosingAndPaying}>
              Cancelar
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleCerrarYPagar} disabled={isClosingAndPaying}>
              {isClosingAndPaying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                'Confirmar Todo'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Pedidos
