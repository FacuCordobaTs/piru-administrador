import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { mesasApi, pedidosApi, productosApi, mercadopagoApi, ApiError } from '@/lib/api'
import { type MesaConPedido, type ItemPedido as WSItemPedido } from '@/hooks/useAdminWebSocket'
import { useAdminContext } from '@/context/AdminContext'
import { toast } from 'sonner'
import MesaQRCode from '@/components/MesaQRCode'
import {
  ShoppingCart, Users, Loader2, QrCode, Plus,
  Clock, CheckCircle, Coffee,
  Utensils, ChefHat, RefreshCw, Trash2,
  User, Minus, Search, Package,
  AlertTriangle, Play
} from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'

// Types
// Extended ItemPedido with estado for kanban
interface ItemPedidoConEstado extends WSItemPedido {
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
  items: ItemPedidoConEstado[]
  totalItems: number
  nombrePedido?: string | null
}

interface SubtotalInfo {
  clienteNombre: string
  subtotal: string
  pagado: boolean
  metodo?: string
  estado?: 'pending' | 'pending_cash' | 'paid' | 'failed'
  isMozoItem?: boolean
  itemId?: number
  nombreProducto?: string
}

interface Ingrediente {
  id: number
  nombre: string
}

interface Producto {
  id: number
  nombre: string
  descripcion: string | null
  precio: string
  activo: boolean
  imagenUrl: string | null
  ingredientes?: Ingrediente[]
}

interface KanbanCardData {
  id: string
  pedido: PedidoData
  items: ItemPedidoConEstado[]
  status: string
}

// Helper functions
const getMinutesAgo = (dateString: string) => {
  const date = new Date(dateString)
  const adjustedDate = new Date(date.getTime() + 3 * 60 * 60 * 1000)
  const now = new Date()
  const diffMs = now.getTime() - adjustedDate.getTime()
  return Math.floor(diffMs / 60000)
}

const formatTimeAgo = (dateString: string) => {
  const minutes = getMinutesAgo(dateString)
  if (minutes < 1) return 'Ahora'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${minutes % 60}m`
  return new Date(dateString).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

const getEstadoBadge = (estado: string | null | undefined) => {
  const estados: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
    pending: { label: 'Pendiente', variant: 'outline', icon: Clock },
    preparing: { label: 'Preparando', variant: 'default', icon: ChefHat },
    delivered: { label: 'Listo', variant: 'secondary', icon: Utensils },
    served: { label: 'Entregado', variant: 'secondary', icon: CheckCircle },
    closed: { label: 'Cerrado', variant: 'secondary', icon: CheckCircle },
  }
  return estados[estado || 'pending'] || { label: 'Disponible', variant: 'outline', icon: Coffee }
}

// Columns for Kanban
const COLUMNS = [
  { id: 'pending', title: 'Pendientes', icon: Clock, color: 'text-amber-600', bgHeader: 'bg-amber-100 dark:bg-amber-900/30' },
  { id: 'preparing', title: 'En Cocina', icon: ChefHat, color: 'text-blue-600', bgHeader: 'bg-blue-100 dark:bg-blue-900/30' },
  { id: 'delivered', title: 'Listos', icon: Utensils, color: 'text-emerald-600', bgHeader: 'bg-emerald-100 dark:bg-emerald-900/30' },
  { id: 'served', title: 'Entregados', icon: CheckCircle, color: 'text-indigo-600', bgHeader: 'bg-indigo-100 dark:bg-indigo-900/30' },
  { id: 'closedPending', title: 'Sin Pagar', icon: Clock, color: 'text-orange-600', bgHeader: 'bg-orange-100 dark:bg-orange-900/30' },
  { id: 'closedPaid', title: 'Pagados', icon: CheckCircle, color: 'text-green-600', bgHeader: 'bg-green-100 dark:bg-green-900/30' },
]

const Dashboard = () => {
  const token = useAuthStore((state) => state.token)
  const restaurante = useAuthStore((state) => state.restaurante)
  const { restaurante: restauranteStore } = useRestauranteStore()
  const splitPayment = restauranteStore?.splitPayment ?? true // Default to split payment

  // Admin WebSocket for real-time updates
  const {
    mesas: mesasWS,
    notifications,
    isConnected,
    refresh,
    markAsRead
  } = useAdminContext()

  // Local state
  const [mesas, setMesas] = useState<MesaConPedido[]>([])
  const [pedidos, setPedidos] = useState<PedidoData[]>([])
  const [closedPedidosFromAPI, setClosedPedidosFromAPI] = useState<PedidoData[]>([]) // Closed orders from REST API
  const [isLoading, setIsLoading] = useState(true)
  const [selectedMesaId, setSelectedMesaId] = useState<number | null>(null)
  const [verQR, setVerQR] = useState(false)
  const [crearMesaDialog, setCrearMesaDialog] = useState(false)
  const [nombreMesa, setNombreMesa] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // Pedido detail state
  const [subtotales, setSubtotales] = useState<SubtotalInfo[]>([])
  const [loadingSubtotales, setLoadingSubtotales] = useState(false)
  const [marcandoPagoEfectivo, setMarcandoPagoEfectivo] = useState<string | null>(null)
  const [updatingPedido, setUpdatingPedido] = useState<number | null>(null)

  // Add product state
  const [addProductSheet, setAddProductSheet] = useState(false)
  const [productos, setProductos] = useState<Producto[]>([])
  const [loadingProductos, setLoadingProductos] = useState(false)
  const [searchProducto, setSearchProducto] = useState('')
  const [addingProducto, setAddingProducto] = useState<number | null>(null)
  const [cantidadProducto, setCantidadProducto] = useState<Record<number, number>>({})
  const [configuringProduct, setConfiguringProduct] = useState<Producto | null>(null)
  const [excludedIngredients, setExcludedIngredients] = useState<number[]>([])

  // Delete states
  const [showDeletePedidoDialog, setShowDeletePedidoDialog] = useState(false)
  const [itemAEliminar, setItemAEliminar] = useState<ItemPedidoConEstado | null>(null)

  // Payment states for kanban
  const [pedidosSubtotales, setPedidosSubtotales] = useState<Record<number, SubtotalInfo[]>>({})
  const [updatingPago, setUpdatingPago] = useState<string | null>(null)

  // Get selected mesa
  const selectedMesa = useMemo(() => {
    return mesas.find(m => m.id === selectedMesaId) || null
  }, [mesas, selectedMesaId])

  // Get notifications grouped by mesa
  const mesaNotifications = useMemo(() => {
    const map = new Map<number, number>()
    notifications.filter(n => !n.leida && n.mesaId).forEach(n => {
      const count = map.get(n.mesaId!) || 0
      map.set(n.mesaId!, count + 1)
    })
    return map
  }, [notifications])

  // Update mesas from WebSocket
  useEffect(() => {
    if (mesasWS.length > 0) {
      setMesas(mesasWS)
      setIsLoading(false)

      // Also update pedidos for kanban - include closed orders since we need to show items not yet served
      const pedidosFromMesas: PedidoData[] = mesasWS
        .filter(m => m.pedido) // Include all orders including closed
        .map(m => ({
          id: m.pedido!.id,
          mesaId: m.id,
          mesaNombre: m.nombre,
          estado: m.pedido!.estado as PedidoData['estado'],
          total: m.pedido!.total,
          createdAt: m.pedido!.createdAt,
          closedAt: m.pedido!.closedAt,
          items: m.items.map(i => ({ ...i, estado: (i as any).estado || 'preparing' })),
          totalItems: m.totalItems,
          nombrePedido: m.pedido!.nombrePedido
        }))
      setPedidos(pedidosFromMesas)
    }
  }, [mesasWS])

  // Fetch mesas via REST API
  const fetchMesasREST = useCallback(async () => {
    if (!token) return

    try {
      const response = await mesasApi.getAllWithPedidos(token) as { success: boolean; data: any[] }
      if (response.success && response.data) {
        const transformed = response.data.map(m => ({
          ...m,
          clientesConectados: [],
          totalItems: m.items?.reduce((sum: number, item: any) => sum + (item.cantidad || 1), 0) || 0
        }))
        setMesas(transformed)
      }
    } catch (error) {
      console.error('Error fetching mesas:', error)
    } finally {
      setIsLoading(false)
    }
  }, [token])

  // Fetch closed orders from REST API (these may not be in mesasWS anymore)
  const fetchClosedPedidos = useCallback(async () => {
    if (!token) return

    try {
      const response = await pedidosApi.getAll(token, 1, 50) as {
        success: boolean
        data: PedidoData[]
      }

      if (response.success && response.data) {
        // Filter only closed orders
        const closed = response.data.filter(p => p.estado === 'closed')
        setClosedPedidosFromAPI(closed)
      }
    } catch (error) {
      console.error('Error fetching closed pedidos:', error)
    }
  }, [token])

  // Initial fetch
  useEffect(() => {
    fetchMesasREST()
    fetchClosedPedidos()
  }, [fetchMesasREST, fetchClosedPedidos])

  // Handle mesa selection - mark notifications as read
  const handleSelectMesa = (mesaId: number) => {
    setSelectedMesaId(mesaId)

    // Mark notifications for this mesa as read
    notifications
      .filter(n => n.mesaId === mesaId && !n.leida)
      .forEach(n => markAsRead(n.id))
  }

  // Fetch subtotales for selected mesa
  const fetchSubtotales = useCallback(async () => {
    if (!selectedMesa?.pedido) return
    setLoadingSubtotales(true)
    try {
      const response = await mercadopagoApi.getSubtotales(selectedMesa.pedido.id) as {
        success: boolean
        subtotales: SubtotalInfo[]
        mozoItems?: SubtotalInfo[]
      }
      if (response.success) {
        let allSubtotales = response.subtotales || []
        if (response.mozoItems && Array.isArray(response.mozoItems)) {
          allSubtotales = [...allSubtotales, ...response.mozoItems]
        }
        setSubtotales(allSubtotales)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoadingSubtotales(false)
    }
  }, [selectedMesa?.pedido])

  useEffect(() => {
    if (selectedMesa?.pedido?.estado === 'closed') {
      fetchSubtotales()
    } else {
      setSubtotales([])
    }
  }, [selectedMesa?.pedido?.estado, fetchSubtotales])

  // Fetch subtotales for closed orders in kanban
  useEffect(() => {
    const fetchKanbanSubtotales = async () => {
      // Merge closed orders from both sources
      const closedFromWS = pedidos.filter(p => p.estado === 'closed')
      const allClosedIds = new Set<number>()
      const allClosedPedidos: PedidoData[] = []

      closedFromWS.forEach(p => {
        if (!allClosedIds.has(p.id)) {
          allClosedIds.add(p.id)
          allClosedPedidos.push(p)
        }
      })

      closedPedidosFromAPI.forEach(p => {
        if (!allClosedIds.has(p.id)) {
          allClosedIds.add(p.id)
          allClosedPedidos.push(p)
        }
      })

      if (allClosedPedidos.length === 0) return

      await Promise.all(
        allClosedPedidos.map(async (pedido) => {
          // Skip if already fetched
          if (pedidosSubtotales[pedido.id]) return

          try {
            const response = await mercadopagoApi.getSubtotales(pedido.id) as {
              success: boolean
              subtotales?: SubtotalInfo[]
              mozoItems?: SubtotalInfo[]
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
            console.error(`Error fetching subtotales for pedido ${pedido.id}:`, error)
          }
        })
      )
    }

    fetchKanbanSubtotales()
  }, [pedidos, closedPedidosFromAPI, pedidosSubtotales])

  // Compute which closed pedidos are fully paid
  const pedidosCerradosPagados = useMemo(() => {
    const setPagados = new Set<number>()
    Object.entries(pedidosSubtotales).forEach(([pedidoId, subs]) => {
      if (subs.length > 0 && subs.every(s => s.pagado)) {
        setPagados.add(Number(pedidoId))
      }
    })
    return setPagados
  }, [pedidosSubtotales])

  // Kanban data - includes closed orders when items not all served
  const kanbanData = useMemo(() => {
    const grouped: Record<string, KanbanCardData[]> = {
      pending: [],
      preparing: [],
      delivered: [],
      served: [],
      closedPending: [],
      closedPaid: [],
    }

    // Merge pedidos from WebSocket with closed orders from API
    // Use a Map to deduplicate by pedido.id
    const allPedidosMap = new Map<number, PedidoData>()

    // First add WebSocket pedidos (these have the most up-to-date item states)
    pedidos.forEach(p => allPedidosMap.set(p.id, p))

    // Then add closed orders from API (only if not already in map)
    closedPedidosFromAPI.forEach(p => {
      if (!allPedidosMap.has(p.id)) {
        allPedidosMap.set(p.id, p)
      }
    })

    const allPedidos = Array.from(allPedidosMap.values())

    allPedidos.forEach(pedido => {
      // 1. Pending: If order is pending with items, goes to pending column
      if (pedido.estado === 'pending' && pedido.items.length > 0) {
        grouped.pending.push({ id: `${pedido.id}-pending`, pedido, items: pedido.items, status: 'pending' })
        return
      }

      // 2. Closed: Only move to closed columns if ALL items are served
      if (pedido.estado === 'closed') {
        const allItemsServed = pedido.items.every(i => i.estado === 'served' || i.estado === 'cancelled')

        if (allItemsServed) {
          // All items served - move to closed columns
          const target = pedidosCerradosPagados.has(pedido.id) ? 'closedPaid' : 'closedPending'
          grouped[target].push({
            id: `${pedido.id}-closed`,
            pedido,
            items: pedido.items,
            status: 'closed'
          })
          return
        }
        // If not all items served, continue to distribute items by estado
      }

      // 3. Active or closed with items not served: Separate items by estado
      const itemsPreparing = pedido.items.filter(i => !i.estado || i.estado === 'preparing' || i.estado === 'pending')
      if (itemsPreparing.length > 0) {
        grouped.preparing.push({ id: `${pedido.id}-preparing`, pedido, items: itemsPreparing, status: 'preparing' })
      }

      const itemsDelivered = pedido.items.filter(i => i.estado === 'delivered')
      if (itemsDelivered.length > 0) {
        grouped.delivered.push({ id: `${pedido.id}-delivered`, pedido, items: itemsDelivered, status: 'delivered' })
      }

      const itemsServed = pedido.items.filter(i => i.estado === 'served')
      if (itemsServed.length > 0) {
        grouped.served.push({ id: `${pedido.id}-served`, pedido, items: itemsServed, status: 'served' })
      }
    })

    // Sort by time
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => {
        const dateA = new Date(a.pedido.createdAt).getTime()
        const dateB = new Date(b.pedido.createdAt).getTime()
        // For closed columns, newest first
        if (key === 'closedPending' || key === 'closedPaid') {
          return dateB - dateA
        }
        // For active columns, oldest first (FIFO)
        return dateA - dateB
      })
    })

    return grouped
  }, [pedidos, closedPedidosFromAPI, pedidosCerradosPagados])

  // Handle create mesa
  const handleCrearMesa = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !nombreMesa.trim()) {
      toast.error('El nombre de la mesa es requerido')
      return
    }
    setIsCreating(true)
    try {
      await mesasApi.create(token, nombreMesa)
      toast.success('Mesa creada correctamente')
      setCrearMesaDialog(false)
      setNombreMesa('')
      refresh()
      await fetchMesasREST()
    } catch (error) {
      if (error instanceof ApiError) toast.error(error.message)
    } finally {
      setIsCreating(false)
    }
  }

  // Change item estado
  const handleChangeItemEstado = async (pedidoId: number, itemId: number, nuevoEstado: string) => {
    if (!token) return

    // Optimistic update
    setPedidos(prev => prev.map(p => {
      if (p.id !== pedidoId) return p
      return { ...p, items: p.items.map(i => i.id === itemId ? { ...i, estado: nuevoEstado as any } : i) }
    }))

    try {
      await pedidosApi.updateItemEstado(token, pedidoId, itemId, nuevoEstado)
      toast.success('Item actualizado')
    } catch (error) {
      toast.error('Error al actualizar item')
      refresh()
    }
  }

  // Confirm pedido
  const handleConfirmarPedido = async (pedido: PedidoData) => {
    if (!token) return
    setUpdatingPedido(pedido.id)
    try {
      await pedidosApi.confirmar(token, pedido.id)
      toast.success('Pedido confirmado')
      refresh()
    } catch (error) {
      toast.error('Error al confirmar')
    } finally {
      setUpdatingPedido(null)
    }
  }

  // Confirm pago efectivo
  const handleConfirmarPagoEfectivo = async (clienteNombre: string) => {
    if (!token || !selectedMesa?.pedido) return
    setMarcandoPagoEfectivo(clienteNombre)
    try {
      const response = await mercadopagoApi.confirmarEfectivo(token, selectedMesa.pedido.id, clienteNombre) as { success: boolean; error?: string }
      if (response.success) {
        toast.success('Pago confirmado')
        await fetchSubtotales()
      } else {
        toast.error(response.error || 'Error')
      }
    } catch (error) {
      toast.error('Error conexión')
    } finally {
      setMarcandoPagoEfectivo(null)
    }
  }


  // Confirm pago total (for non-split payment mode)
  const handleConfirmarPagoTotal = async (pedidoId: number, subtotalesData: SubtotalInfo[]) => {
    if (!token) return
    setUpdatingPago(`all-${pedidoId}`)

    try {
      // Filter pending payments
      const pendientes = subtotalesData.filter(s => !s.pagado && s.estado !== 'paid')

      if (pendientes.length === 0) {
        toast.info('Ya está todo pagado')
        return
      }

      // Prepare data for pagarEfectivo
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

      // Step 1: Mark as cash payment (pending_cash)
      const responsePagar = await mercadopagoApi.pagarEfectivo(pedidoId, regularClients, '', mozoItemIds) as { success: boolean; error?: string }

      if (!responsePagar.success) {
        toast.error(responsePagar.error || 'Error al iniciar pago en efectivo')
        return
      }

      // Step 2: Confirm payment (paid) individually
      const results = await Promise.allSettled(
        pendientes.map(sub => mercadopagoApi.confirmarEfectivo(token, pedidoId, sub.clienteNombre))
      )

      const successCount = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length

      if (successCount > 0) {
        toast.success(`Pago total confirmado (${successCount}/${pendientes.length} cuentas procesadas)`)

        // Update UI locally
        setPedidosSubtotales(prev => {
          const subs = prev[pedidoId] || []
          return {
            ...prev,
            [pedidoId]: subs.map(s => ({ ...s, pagado: true, estado: 'paid', metodo: 'efectivo' }))
          }
        })
      } else {
        toast.error('No se pudo confirmar el pago')
      }

    } catch (error) {
      console.error('Error en pago total:', error)
      toast.error('Error al procesar el pago total')
    } finally {
      setUpdatingPago(null)
    }
  }

  // Fetch productos
  const fetchProductos = useCallback(async () => {
    if (!token) return
    setLoadingProductos(true)
    try {
      const response = await productosApi.getAll(token) as { success: boolean; productos: Producto[] }
      if (response.success && response.productos) {
        setProductos(response.productos.filter(p => p.activo))
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoadingProductos(false)
    }
  }, [token])

  useEffect(() => {
    if (addProductSheet && productos.length === 0) fetchProductos()
  }, [addProductSheet, fetchProductos, productos.length])

  // Add producto
  const handleAddProducto = async (producto: Producto) => {
    if (producto.ingredientes && producto.ingredientes.length > 0) {
      setExcludedIngredients([])
      setConfiguringProduct(producto)
      return
    }
    await confirmAddProducto(producto, [])
  }

  const confirmAddProducto = async (producto: Producto, exclusiones: number[]) => {
    if (!token || !selectedMesa?.pedido) return
    setAddingProducto(producto.id)
    try {
      const cantidad = cantidadProducto[producto.id] || 1
      await pedidosApi.addItem(token, selectedMesa.pedido.id, {
        productoId: producto.id,
        cantidad,
        clienteNombre: 'Mozo',
        ingredientesExcluidos: exclusiones.length > 0 ? exclusiones : undefined
      })
      toast.success('Producto agregado')
      setCantidadProducto(prev => ({ ...prev, [producto.id]: 1 }))
      setConfiguringProduct(null)
      refresh()
    } catch (error: any) {
      toast.error(error.message || 'Error')
    } finally {
      setAddingProducto(null)
    }
  }

  // Delete pedido
  const handleDeletePedido = async () => {
    if (!token || !selectedMesa?.pedido) return
    try {
      await pedidosApi.delete(token, selectedMesa.pedido.id)
      toast.success('Pedido eliminado')
      setShowDeletePedidoDialog(false)
      setSelectedMesaId(null)
      refresh()
    } catch (error) {
      toast.error('Error al eliminar pedido')
    }
  }

  // Delete item
  const handleDeleteItem = async () => {
    if (!token || !selectedMesa?.pedido || !itemAEliminar) return
    try {
      await pedidosApi.deleteItem(token, selectedMesa.pedido.id, itemAEliminar.id)
      toast.success('Producto eliminado')
      setItemAEliminar(null)
      refresh()
    } catch (error) {
      toast.error('Error al eliminar')
    }
  }

  // Kanban card click - select mesa
  const handleKanbanCardClick = (pedido: PedidoData) => {
    if (pedido.mesaId) {
      handleSelectMesa(pedido.mesaId)
    }
  }

  const productosFiltrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(searchProducto.toLowerCase()) ||
    p.descripcion?.toLowerCase().includes(searchProducto.toLowerCase())
  )

  // Group items by client for selected mesa
  const itemsPorCliente = useMemo(() => {
    if (!selectedMesa) return {} as Record<string, ItemPedidoConEstado[]>
    // Cast items to include estado property (may come from WebSocket or API)
    const items = selectedMesa.items as ItemPedidoConEstado[]
    return items.reduce((acc, item) => {
      const cliente = item.clienteNombre || 'Sin nombre'
      if (!acc[cliente]) acc[cliente] = []
      acc[cliente].push(item)
      return acc
    }, {} as Record<string, ItemPedidoConEstado[]>)
  }, [selectedMesa])

  if (isLoading && mesas.length === 0) {
    return (
      <div className="w-full h-[calc(100vh-4rem)] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-background border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight">{restaurante?.nombre || 'Dashboard'}</h1>
            {isConnected ? (
              <Badge variant="outline" className="gap-1 text-xs bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                En vivo
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-xs bg-orange-50 dark:bg-orange-950/30 border-orange-300">
                Offline
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { refresh(); fetchMesasREST() }}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualizar
            </Button>
            <Button size="sm" onClick={() => setCrearMesaDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Mesa
            </Button>
          </div>
        </div>
      </div>

      {/* Main 3-Column Layout */}
      <div className="flex-1 flex overflow-hidden">

        {/* LEFT: Mesa Selector */}
        <div className="w-48 shrink-0 border-r bg-muted/20 p-3 overflow-auto">
          <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Mesas</p>
          <div className="grid grid-cols-2 gap-2">
            {mesas.map((mesa) => {
              const hasActiveOrder = mesa.pedido && mesa.pedido.estado !== 'closed'
              const notifCount = mesaNotifications.get(mesa.id) || 0
              const isSelected = selectedMesaId === mesa.id

              return (
                <button
                  key={mesa.id}
                  onClick={() => handleSelectMesa(mesa.id)}
                  className={`relative aspect-square rounded-lg border-2 flex flex-col items-center justify-center text-center p-1 transition-all hover:scale-105 ${isSelected
                    ? 'border-primary bg-primary/10 shadow-md'
                    : hasActiveOrder
                      ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30'
                      : 'border-border bg-card hover:bg-accent'
                    }`}
                >
                  {notifCount > 0 && (
                    <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                      {notifCount}
                    </div>
                  )}
                  <span className="font-semibold text-xs truncate w-full">{mesa.nombre}</span>
                  {mesa.clientesConectados.length > 0 && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <Users className="h-2.5 w-2.5" />
                      {mesa.clientesConectados.length}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* CENTER: Detail View */}
        <div className="flex-1 overflow-auto p-4">
          {selectedMesa ? (
            <div className="space-y-4 max-w-3xl mx-auto">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{selectedMesa.nombre}</h2>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    {selectedMesa.pedido ? (
                      <>
                        Pedido #{selectedMesa.pedido.id}
                        <Badge variant={getEstadoBadge(selectedMesa.pedido.estado).variant}>
                          {getEstadoBadge(selectedMesa.pedido.estado).label}
                        </Badge>
                      </>
                    ) : 'Sin pedido activo'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setVerQR(true)}>
                    <QrCode className="mr-2 h-4 w-4" />
                    QR
                  </Button>
                  {selectedMesa.pedido && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setAddProductSheet(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Agregar
                      </Button>
                      <Button variant="outline" size="sm" className="text-destructive" onClick={() => setShowDeletePedidoDialog(true)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Connected Clients */}
              {selectedMesa.clientesConectados.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Clientes Conectados ({selectedMesa.clientesConectados.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {selectedMesa.clientesConectados.map((cliente) => (
                        <Badge key={cliente.id} variant="secondary">{cliente.nombre}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Order Items */}
              {selectedMesa.pedido ? (
                <>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <ShoppingCart className="h-4 w-4" />
                        Productos ({selectedMesa.totalItems})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {Object.keys(itemsPorCliente).length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>No hay productos</p>
                        </div>
                      ) : (
                        Object.entries(itemsPorCliente).map(([cliente, items]) => (
                          <div key={cliente}>
                            <div className="flex items-center justify-between mb-2">
                              <Badge variant="secondary" className="gap-1">
                                <User className="h-3 w-3" />
                                {cliente}
                              </Badge>
                              <span className="text-sm font-medium">
                                ${items.reduce((sum, i) => sum + (parseFloat(i.precioUnitario) * i.cantidad), 0).toFixed(2)}
                              </span>
                            </div>
                            <div className="space-y-2 ml-2">
                              {items.map((item) => {
                                const estadoBadge = getEstadoBadge(item.estado)
                                return (
                                  <div key={item.id} className={`flex items-center justify-between p-2 rounded-lg ${item.postConfirmacion ? 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200' : 'bg-muted/50'}`}>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-sm">{item.cantidad}x {item.nombreProducto}</span>
                                        <Badge variant={estadoBadge.variant} className="h-5 text-[10px]">{estadoBadge.label}</Badge>
                                        {item.postConfirmacion && <Badge variant="outline" className="h-5 text-[10px] border-amber-500 text-amber-600">Nuevo</Badge>}
                                      </div>
                                      {item.ingredientesExcluidosNombres && item.ingredientesExcluidosNombres.length > 0 && (
                                        <p className="text-xs text-orange-600 mt-1">⚠️ Sin: {item.ingredientesExcluidosNombres.join(', ')}</p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold">${(parseFloat(item.precioUnitario) * item.cantidad).toFixed(2)}</span>
                                      {/* Always show item action buttons (including for closed orders) */}
                                      <div className="flex gap-1">
                                        {(item.estado === 'preparing' || item.estado === 'pending' || !item.estado) && (
                                          <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-emerald-600" onClick={() => handleChangeItemEstado(selectedMesa.pedido!.id, item.id, 'delivered')}>
                                            <CheckCircle className="h-4 w-4" />
                                          </Button>
                                        )}
                                        {item.estado === 'delivered' && (
                                          <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-indigo-600" onClick={() => handleChangeItemEstado(selectedMesa.pedido!.id, item.id, 'served')}>
                                            <Utensils className="h-4 w-4" />
                                          </Button>
                                        )}
                                        {selectedMesa.pedido?.estado !== 'closed' && (
                                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setItemAEliminar(item)}>
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                            <Separator className="my-3" />
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  {/* Total & Payments */}
                  <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Total del Pedido</p>
                          <p className="text-xs text-muted-foreground">{selectedMesa.totalItems} productos</p>
                        </div>
                        <p className="text-3xl font-bold text-primary">
                          ${parseFloat(selectedMesa.pedido.total).toFixed(2)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Payments (when closed) */}
                  {selectedMesa.pedido.estado === 'closed' && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Pagos
                          {/* Badge for payment status */}
                          {subtotales.length > 0 && subtotales.every(s => s.pagado) ? (
                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-300 text-[10px]">
                              💳 Pagado
                            </Badge>
                          ) : (
                            <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-300 text-[10px]">
                              📋 Cuenta Pedida
                            </Badge>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {loadingSubtotales ? (
                          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                        ) : (
                          <div className="space-y-3">
                            {/* Unified Payment (Non-Split Payment Mode) */}
                            {!splitPayment && subtotales.length > 0 && (
                              <div className="p-3 bg-muted/30 rounded-lg border">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="font-medium">Total Mesa</span>
                                  <span className="text-xl font-bold">
                                    ${subtotales.reduce((acc, s) => acc + parseFloat(s.subtotal), 0).toLocaleString()}
                                  </span>
                                </div>
                                {subtotales.every(s => s.pagado) ? (
                                  <div className="w-full py-2 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-md text-center font-medium flex items-center justify-center gap-2">
                                    <CheckCircle className="h-4 w-4" />
                                    Mesa Pagada
                                  </div>
                                ) : (
                                  <Button
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                                    onClick={() => handleConfirmarPagoTotal(selectedMesa.pedido!.id, subtotales)}
                                    disabled={updatingPago === `all-${selectedMesa.pedido!.id}`}
                                  >
                                    {updatingPago === `all-${selectedMesa.pedido!.id}` ? (
                                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : (
                                      <span className="mr-2">💵</span>
                                    )}
                                    Confirmar Pago Total
                                  </Button>
                                )}
                              </div>
                            )}

                            {/* Split Payment Mode - Show individual clients */}
                            {splitPayment && Object.keys(itemsPorCliente).map((cliente) => {
                              if (cliente === 'Mozo') return null
                              const clienteItems = itemsPorCliente[cliente]
                              const clienteTotal = clienteItems.reduce((sum, item) => sum + (parseFloat(item.precioUnitario) * item.cantidad), 0)
                              const subtotalInfo = subtotales.find(s => s.clienteNombre === cliente)
                              const estaPagado = subtotalInfo?.pagado === true
                              const esperandoConfirmacion = subtotalInfo?.estado === 'pending_cash'

                              return (
                                <div
                                  key={cliente}
                                  className={`flex items-center justify-between p-3 rounded-lg border ${estaPagado
                                    ? 'bg-green-50 border-green-200 dark:bg-green-900/20'
                                    : esperandoConfirmacion
                                      ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/40'
                                      : 'bg-card'
                                    }`}
                                >
                                  <div>
                                    <span className={`font-medium text-sm ${estaPagado ? 'text-green-700' : esperandoConfirmacion ? 'text-amber-700' : ''}`}>
                                      {cliente}
                                    </span>
                                    {estaPagado && <span className="text-[10px] text-green-600 ml-2">✓ Pagado</span>}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className={`font-semibold ${estaPagado ? 'text-green-600' : esperandoConfirmacion ? 'text-amber-600' : ''}`}>
                                      ${clienteTotal.toFixed(2)}
                                    </span>
                                    {esperandoConfirmacion && (
                                      <Button
                                        size="sm"
                                        className="h-7 text-xs bg-green-600 hover:bg-green-700"
                                        onClick={() => handleConfirmarPagoEfectivo(cliente)}
                                        disabled={marcandoPagoEfectivo === cliente}
                                      >
                                        {marcandoPagoEfectivo === cliente ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Confirmar Pago'}
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Coffee className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium">Sin pedido actual</p>
                    <p className="text-sm">Esta mesa está disponible</p>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <ShoppingCart className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg">Selecciona una mesa</p>
                <p className="text-sm">para ver su detalle</p>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Kanban Panel (Mobile Style) */}
        <div className="w-80 shrink-0 border-l bg-muted/10 overflow-auto">
          <div className="p-3 border-b sticky top-0 bg-background/95 backdrop-blur z-10">
            <p className="text-sm font-semibold">Pedidos</p>
          </div>
          <div className="p-3 space-y-4">
            {COLUMNS.map((column) => {
              const columnCards = kanbanData[column.id] || []
              const ColumnIcon = column.icon

              // Always show all columns (even if empty)
              return (
                <div key={column.id}>
                  <div className={`flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg ${column.bgHeader}`}>
                    <ColumnIcon className={`h-4 w-4 ${column.color}`} />
                    <span className="font-semibold text-sm flex-1">{column.title}</span>
                    <Badge variant="secondary" className="font-mono text-xs">{columnCards.length}</Badge>
                  </div>

                  {columnCards.length === 0 ? (
                    <div className="text-center py-3 text-muted-foreground text-xs opacity-50">
                      Sin pedidos
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {columnCards.map((card) => {
                        const hasExclusions = card.items.some(i => i.ingredientesExcluidosNombres?.length)
                        const isUpdating = updatingPedido === card.pedido.id

                        // Payment info for closed orders
                        const isClosed = card.pedido.estado === 'closed'
                        const subtotalesData = pedidosSubtotales[card.pedido.id] || []
                        const isFullyPaid = subtotalesData.length > 0 && subtotalesData.every(s => s.pagado)
                        const totalPedido = subtotalesData.reduce((acc, curr) => acc + parseFloat(curr.subtotal), 0)
                        const showUnifiedPayment = !splitPayment && isClosed

                        return (
                          <Card
                            key={card.id}
                            className={`cursor-pointer transition-all hover:border-primary/50 ${selectedMesaId === card.pedido.mesaId ? 'ring-2 ring-primary' : ''
                              }`}
                            onClick={() => handleKanbanCardClick(card.pedido)}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-sm">{card.pedido.mesaNombre || 'Sin mesa'}</span>
                                  {hasExclusions && <AlertTriangle className="h-3 w-3 text-orange-500" />}
                                  {/* Badge for closed orders */}
                                  {isClosed && (
                                    <Badge
                                      variant="outline"
                                      className={isFullyPaid
                                        ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-300 text-[10px] px-1.5 py-0"
                                        : "bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border-orange-300 text-[10px] px-1.5 py-0"}
                                    >
                                      {isFullyPaid ? "💳 Pagado" : "📋 Cuenta"}
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground">{formatTimeAgo(card.pedido.createdAt)}</span>
                              </div>

                              {/* Unified Payment for closed orders (non-split mode) */}
                              {showUnifiedPayment && subtotalesData.length > 0 && (
                                <div className="mb-2 p-2 bg-muted/30 rounded-md">
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-medium">Total Mesa</span>
                                    <span className="text-sm font-bold">${totalPedido.toLocaleString()}</span>
                                  </div>
                                  {!isFullyPaid ? (
                                    <Button
                                      className="w-full h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleConfirmarPagoTotal(card.pedido.id, subtotalesData)
                                      }}
                                      disabled={updatingPago === `all-${card.pedido.id}`}
                                    >
                                      {updatingPago === `all-${card.pedido.id}` ? (
                                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                      ) : (
                                        <span className="mr-1">💵</span>
                                      )}
                                      Confirmar Pago Total
                                    </Button>
                                  ) : (
                                    <div className="w-full py-1 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded text-center text-xs font-medium flex items-center justify-center gap-1">
                                      <CheckCircle className="h-3 w-3" />
                                      Pagado
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Items */}
                              <div className="space-y-1.5">
                                {card.items.slice(0, 3).map((item) => (
                                  <div key={item.id} className="flex items-start gap-2 text-xs">
                                    <span className="font-bold bg-muted rounded px-1">{item.cantidad}</span>
                                    <div className="flex-1 min-w-0">
                                      <span className="truncate block">{item.nombreProducto}</span>
                                      {item.ingredientesExcluidosNombres && item.ingredientesExcluidosNombres.length > 0 && (
                                        <span className="text-orange-600 text-[10px]">Sin {item.ingredientesExcluidosNombres[0]}</span>
                                      )}
                                    </div>
                                    <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                                      {card.status === 'preparing' && (
                                        <Button size="icon" variant="ghost" className="h-6 w-6 hover:text-emerald-600" onClick={() => handleChangeItemEstado(card.pedido.id, item.id, 'delivered')}>
                                          <CheckCircle className="h-3 w-3" />
                                        </Button>
                                      )}
                                      {card.status === 'delivered' && (
                                        <Button size="icon" variant="ghost" className="h-6 w-6 hover:text-indigo-600" onClick={() => handleChangeItemEstado(card.pedido.id, item.id, 'served')}>
                                          <Utensils className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                                {card.items.length > 3 && (
                                  <p className="text-[10px] text-muted-foreground">+{card.items.length - 3} más</p>
                                )}
                              </div>

                              {/* Action */}
                              {card.status === 'pending' && (
                                <Button
                                  size="sm"
                                  className="w-full mt-2 h-7 text-xs bg-blue-600 hover:bg-blue-700"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleConfirmarPedido(card.pedido)
                                  }}
                                  disabled={isUpdating}
                                >
                                  {isUpdating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Play className="h-3 w-3 mr-1" />}
                                  Confirmar
                                </Button>
                              )}
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}

            {Object.values(kanbanData).every(arr => arr.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                <Coffee className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Sin pedidos activos</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      {/* QR Dialog */}
      {verQR && selectedMesa && (
        <Dialog open={verQR} onOpenChange={(open) => setVerQR(open)}>
          <DialogContent className="max-w-md">
            <MesaQRCode qrToken={selectedMesa.qrToken} mesaNombre={selectedMesa.nombre} />
          </DialogContent>
        </Dialog>
      )}

      {/* Create Mesa Dialog */}
      <Dialog open={crearMesaDialog} onOpenChange={setCrearMesaDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Crear Nueva Mesa</DialogTitle>
            <DialogDescription>Agrega una nueva mesa a tu restaurante</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCrearMesa} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombreMesa">Nombre de la mesa *</Label>
              <Input
                id="nombreMesa"
                value={nombreMesa}
                onChange={(e) => setNombreMesa(e.target.value)}
                placeholder="Ej: Mesa 1, Mesa VIP..."
                required
                disabled={isCreating}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setCrearMesaDialog(false)} disabled={isCreating}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creando...</> : <><Plus className="mr-2 h-4 w-4" />Crear Mesa</>}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Pedido Dialog */}
      <Dialog open={showDeletePedidoDialog} onOpenChange={setShowDeletePedidoDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>¿Eliminar Pedido?</DialogTitle>
            <DialogDescription>Esta acción es irreversible.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowDeletePedidoDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeletePedido}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Item Dialog */}
      <Dialog open={!!itemAEliminar} onOpenChange={(open) => !open && setItemAEliminar(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>¿Eliminar producto?</DialogTitle>
            <DialogDescription>Se eliminará {itemAEliminar?.nombreProducto}.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setItemAEliminar(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteItem}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ingredient Config Dialog */}
      <Dialog open={!!configuringProduct} onOpenChange={(open) => !open && setConfiguringProduct(null)}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Personalizar {configuringProduct?.nombre}</DialogTitle>
            <DialogDescription>Selecciona los ingredientes para EXCLUIR.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-2">
            {configuringProduct?.ingredientes?.length ? (
              <div className="space-y-2">
                {configuringProduct.ingredientes.map(ing => {
                  const isExcluded = excludedIngredients.includes(ing.id)
                  return (
                    <div
                      key={ing.id}
                      className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${isExcluded ? 'bg-destructive/10 border-destructive/30' : 'bg-card border-border hover:bg-accent'}`}
                      onClick={() => setExcludedIngredients(prev => prev.includes(ing.id) ? prev.filter(id => id !== ing.id) : [...prev, ing.id])}
                    >
                      <Checkbox checked={!isExcluded} />
                      <span className={isExcluded ? 'line-through text-muted-foreground' : 'font-medium'}>{ing.nombre}</span>
                      {isExcluded && <span className="text-xs text-destructive ml-auto font-semibold">Excluido</span>}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">Sin ingredientes configurables.</p>
            )}
          </div>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setConfiguringProduct(null)}>Cancelar</Button>
            <Button onClick={() => configuringProduct && confirmAddProducto(configuringProduct, excludedIngredients)} disabled={addingProducto === configuringProduct?.id}>
              {addingProducto === configuringProduct?.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Agregar al Pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Product Sheet */}
      <Sheet open={addProductSheet} onOpenChange={setAddProductSheet}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2"><Package className="h-5 w-5" />Agregar Producto</SheetTitle>
            <SheetDescription>Selecciona los productos para agregar al pedido.</SheetDescription>
          </SheetHeader>

          <div className="relative mt-4 mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar producto..." value={searchProducto} onChange={(e) => setSearchProducto(e.target.value)} className="pl-10 h-11" />
          </div>

          <ScrollArea className="h-[calc(100vh-200px)] pr-4">
            {loadingProductos ? (
              <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : productosFiltrados.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No se encontraron productos</div>
            ) : (
              <div className="space-y-3 pb-8">
                {productosFiltrados.map((producto) => (
                  <div key={producto.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                    <div className="shrink-0">
                      {producto.imagenUrl ? (
                        <img src={producto.imagenUrl} alt={producto.nombre} className="w-14 h-14 rounded-lg object-cover bg-muted" />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center">
                          <Package className="h-6 w-6 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{producto.nombre}</p>
                      <p className="font-bold text-primary">${parseFloat(producto.precio).toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center border rounded-lg bg-background h-9">
                        <Button variant="ghost" size="icon" className="h-full w-8 rounded-none" onClick={() => setCantidadProducto(prev => ({ ...prev, [producto.id]: Math.max(1, (prev[producto.id] || 1) - 1) }))}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center text-sm font-medium">{cantidadProducto[producto.id] || 1}</span>
                        <Button variant="ghost" size="icon" className="h-full w-8 rounded-none" onClick={() => setCantidadProducto(prev => ({ ...prev, [producto.id]: (prev[producto.id] || 1) + 1 }))}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <Button size="icon" className="h-9 w-9" onClick={() => handleAddProducto(producto)} disabled={addingProducto === producto.id}>
                        {addingProducto === producto.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  )
}

export default Dashboard