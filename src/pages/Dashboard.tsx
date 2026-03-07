import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { mesasApi, pedidosApi, productosApi, mercadopagoApi, deliveryApi, takeawayApi } from '@/lib/api'
import { type MesaConPedido, type ItemPedido as WSItemPedido } from '@/hooks/useAdminWebSocket'
import { useAdminContext } from '@/context/AdminContext'
import MesaQRCode from '@/components/MesaQRCode'
import CierreTurno from '@/components/CierreTurno'
import {
  ShoppingCart, Users, Loader2, QrCode, Plus,
  Clock, CheckCircle, Coffee,
  Utensils, ChefHat, Trash2, Archive,
  User, Minus, Search, Package,
  AlertTriangle, Play, LayoutGrid, List, ArrowLeft, Printer, Truck, MapPin, Phone, X, ShoppingBag, CalendarDays
} from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { usePrinter } from '@/context/PrinterContext'
import { formatComanda, formatFactura, commandsToBytes } from '@/utils/printerUtils'

// Types
interface ItemPedidoConEstado extends WSItemPedido {
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
  items: ItemPedidoConEstado[]
  totalItems: number
  nombrePedido?: string | null
  pagado?: boolean
  metodoPago?: string | null
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

interface Etiqueta {
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
  categoriaId?: number | null
  categoria?: string | null
  ingredientes?: Ingrediente[]
  etiquetas?: Etiqueta[]
}

interface KanbanCardData {
  id: string
  pedido: PedidoData
  items: ItemPedidoConEstado[]
  status: string
  tipo: 'mesa' | 'delivery' | 'takeaway'
  direccion?: string
  nombreCliente?: string | null
}

// Delivery Types
interface DeliveryItem {
  id: number
  productoId: number
  cantidad: number
  precioUnitario: string
  nombreProducto: string
  imagenUrl: string | null
  ingredientesExcluidos: number[]
  ingredientesExcluidosNombres?: string[]
}

interface DeliveryPedido {
  id: number
  direccion: string
  nombreCliente: string | null
  telefono: string | null
  estado: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled' | 'archived'
  total: string
  notas: string | null
  createdAt: string
  deliveredAt: string | null
  items: DeliveryItem[]
  totalItems: number
  pagado?: boolean
  metodoPago?: string | null
}

interface TakeawayPedido {
  id: number
  nombreCliente: string | null
  telefono: string | null
  estado: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled' | 'archived'
  total: string
  notas: string | null
  createdAt: string
  deliveredAt: string | null
  items: DeliveryItem[]
  totalItems: number
  pagado?: boolean
  metodoPago?: string | null
}

// Unified order type for the all-orders list
interface UnifiedPedido {
  id: number
  tipo: 'mesa' | 'delivery' | 'takeaway'
  estado: string
  total: string
  createdAt: string
  nombreCliente: string | null
  telefono: string | null
  direccion?: string | null
  mesaNombre?: string | null
  notas?: string | null
  items: DeliveryItem[] | ItemPedidoConEstado[]
  totalItems: number
  pagado?: boolean
  metodoPago?: string | null
}

interface NewDeliveryItem {
  productoId: number
  cantidad: number
  ingredientesExcluidos?: number[]
}

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


// Helper: compute the actual delivery fee for a stored order.
// Since pedido.total already includes the delivery fee from the backend,
// we derive it as: total - sum(item prices)
const getOrderDeliveryFee = (pedido: { total: string; items: { precioUnitario: string; cantidad: number }[] }) => {
  const total = parseFloat(pedido.total)
  const itemsSubtotal = pedido.items.reduce((sum, item) =>
    sum + (parseFloat(item.precioUnitario) * item.cantidad), 0
  )
  return Math.max(0, Math.round((total - itemsSubtotal) * 100) / 100)
}

const COLUMNS = [
  { id: 'pending', title: 'Pendientes', icon: Clock, color: 'text-amber-600', bgHeader: 'bg-amber-100 dark:bg-amber-900/30' },
  { id: 'preparing', title: 'En Cocina', icon: ChefHat, color: 'text-blue-600', bgHeader: 'bg-blue-100 dark:bg-blue-900/30' },
  { id: 'delivered', title: 'Listos', icon: Utensils, color: 'text-emerald-600', bgHeader: 'bg-emerald-100 dark:bg-emerald-900/30' },
  { id: 'served', title: 'Entregados', icon: CheckCircle, color: 'text-indigo-600', bgHeader: 'bg-indigo-100 dark:bg-indigo-900/30' },
  { id: 'closedPending', title: 'Sin Pagar', icon: Clock, color: 'text-orange-600', bgHeader: 'bg-orange-100 dark:bg-orange-900/30' },
  { id: 'closedPaid', title: 'Pagados', icon: CheckCircle, color: 'text-green-600', bgHeader: 'bg-green-100 dark:bg-green-900/30' },
  { id: 'archived', title: 'Archivados', icon: Archive, color: 'text-slate-600', bgHeader: 'bg-slate-100 dark:bg-slate-900/30' },
]

const Dashboard = () => {
  const token = useAuthStore((state) => state.token)
  const restaurante = useAuthStore((state) => state.restaurante)
  const { restaurante: restauranteStore, productos: allProductos, categorias: allCategorias } = useRestauranteStore()
  const splitPayment = restauranteStore?.splitPayment ?? true

  const { printRaw, selectedPrinter } = usePrinter()

  // Ref para rastrear pedidos procesados para impresión automática
  const processedOrdersRef = useRef<Map<string, { status: string, itemIds: Set<number>, pagado?: boolean }>>(new Map())

  const {
    mesas: mesasWS,
    notifications,
    isConnected,
    refresh,
    markAsRead,
    lastUpdate
  } = useAdminContext()

  const [mesas, setMesas] = useState<MesaConPedido[]>([])
  const [pedidos, setPedidos] = useState<PedidoData[]>([])
  const [closedPedidosFromAPI, setClosedPedidosFromAPI] = useState<PedidoData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedMesaId, setSelectedMesaId] = useState<number | null>(null)
  const [selectedPedidoFromKanban, setSelectedPedidoFromKanban] = useState<PedidoData | null>(null)
  const [verQR, setVerQR] = useState(false)
  const [crearMesaDialog, setCrearMesaDialog] = useState(false)
  const [nombreMesa, setNombreMesa] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const [showDeleteMesaDialog, setShowDeleteMesaDialog] = useState(false)
  const [isDeletingMesa, setIsDeletingMesa] = useState(false)

  const [subtotales, setSubtotales] = useState<SubtotalInfo[]>([])
  const [loadingSubtotales, setLoadingSubtotales] = useState(false)
  const [marcandoPagoEfectivo, setMarcandoPagoEfectivo] = useState<string | null>(null)
  const [updatingPedido, setUpdatingPedido] = useState<number | null>(null)

  const [addProductSheet, setAddProductSheet] = useState(false)
  const [productos, setProductos] = useState<Producto[]>([])
  const [loadingProductos, setLoadingProductos] = useState(false)
  const [searchProducto, setSearchProducto] = useState('')
  const [configuringProduct, setConfiguringProduct] = useState<Producto | null>(null)
  const [excludedIngredients, setExcludedIngredients] = useState<number[]>([])

  // Estados para agregar múltiples productos a un pedido existente
  const [productosSeleccionados, setProductosSeleccionados] = useState<NewDeliveryItem[]>([])
  const [expandedProductosSeleccionados, setExpandedProductosSeleccionados] = useState<number[]>([])
  const [addingMultipleProducts, setAddingMultipleProducts] = useState(false)
  const [addProductMobileTab, setAddProductMobileTab] = useState<'carrito' | 'productos'>('productos')

  const [showDeletePedidoDialog, setShowDeletePedidoDialog] = useState(false)
  const [itemAEliminar, setItemAEliminar] = useState<ItemPedidoConEstado | null>(null)

  const [pedidosSubtotales, setPedidosSubtotales] = useState<Record<number, SubtotalInfo[]>>({})
  const [updatingPago, setUpdatingPago] = useState<string | null>(null)

  // Mobile-specific state
  const [mobileView, setMobileView] = useState<'mesas' | 'detail' | 'orders'>('mesas')

  // Dashboard mode: mesas vs pedidos vs nuevoPedido
  const [dashboardMode, setDashboardMode] = useState<'mesas' | 'pedidos' | 'nuevoPedido'>('mesas')
  const previousDashboardMode = useRef<'mesas' | 'pedidos'>('mesas')

  // Cierre de turno
  const [showCierreTurno, setShowCierreTurno] = useState(false)

  const enterNuevoPedidoMode = () => {
    previousDashboardMode.current = dashboardMode === 'nuevoPedido' ? previousDashboardMode.current : (dashboardMode as 'mesas' | 'pedidos')
    setDashboardMode('nuevoPedido')
    setNuevoPedidoMobileTab('info')
  }

  const exitNuevoPedidoMode = () => {
    setDashboardMode(previousDashboardMode.current)
    setNewPedidoMesaId(null)
  }

  // Delivery state
  const [deliveryPedidos, setDeliveryPedidos] = useState<DeliveryPedido[]>([])
  const [loadingDelivery, setLoadingDelivery] = useState(false)
  const [newDeliveryItems, setNewDeliveryItems] = useState<NewDeliveryItem[]>([])
  const [newDeliveryDireccion, setNewDeliveryDireccion] = useState('')
  const [newDeliveryNombre, setNewDeliveryNombre] = useState('')
  const [newDeliveryTelefono, setNewDeliveryTelefono] = useState('')
  const [newDeliveryNotas, setNewDeliveryNotas] = useState('')
  const [newPedidoMesaId, setNewPedidoMesaId] = useState<number | null>(null)
  const [creatingDelivery, setCreatingDelivery] = useState(false)
  const [expandedDeliveryItems, setExpandedDeliveryItems] = useState<number[]>([])
  const [nuevoPedidoMobileTab, setNuevoPedidoMobileTab] = useState<'info' | 'productos'>('info')

  // Takeaway state
  const [takeawayPedidos, setTakeawayPedidos] = useState<TakeawayPedido[]>([])

  // Pedido filter state
  const [pedidoFilter, setPedidoFilter] = useState<'all' | 'mesa' | 'delivery' | 'takeaway'>('all')

  // Desktop left panel tab state
  const [desktopLeftTab, setDesktopLeftTab] = useState<'pedidos' | 'mesas'>('pedidos')

  // Selected unified pedido (for showing delivery/takeaway detail in center)
  const [selectedUnifiedPedido, setSelectedUnifiedPedido] = useState<UnifiedPedido | null>(null)

  const handleToggleDeliveryIngredient = (idx: number, ingredientId: number) => {
    setNewDeliveryItems(prev => prev.map((item, index) => {
      if (index === idx) {
        const currentExclusions = item.ingredientesExcluidos || []
        const newExclusions = currentExclusions.includes(ingredientId)
          ? currentExclusions.filter(id => id !== ingredientId)
          : [...currentExclusions, ingredientId]
        return { ...item, ingredientesExcluidos: newExclusions }
      }
      return item
    }))
  }

  const selectedMesa = useMemo(() => {
    return mesas.find(m => m.id === selectedMesaId) || null
  }, [mesas, selectedMesaId])

  const displayedPedido = useMemo(() => {
    if (selectedPedidoFromKanban) {
      return selectedPedidoFromKanban
    }
    if (selectedMesa?.pedido) {
      return {
        id: selectedMesa.pedido.id,
        mesaId: selectedMesa.id,
        mesaNombre: selectedMesa.nombre,
        estado: selectedMesa.pedido.estado as PedidoData['estado'],
        total: selectedMesa.pedido.total,
        createdAt: selectedMesa.pedido.createdAt,
        closedAt: selectedMesa.pedido.closedAt,
        items: selectedMesa.items as ItemPedidoConEstado[],
        totalItems: selectedMesa.totalItems,
        nombrePedido: selectedMesa.pedido.nombrePedido
      }
    }
    // Fallback: try to find pedido for this mesa in the pedidos array
    if (selectedMesa) {
      const pedidoFromList = pedidos.find(p => p.mesaId === selectedMesa.id)
      if (pedidoFromList) {
        return pedidoFromList
      }
    }
    return null
  }, [selectedPedidoFromKanban, selectedMesa?.pedido, selectedMesa?.items, selectedMesa?.id, selectedMesa?.nombre, selectedMesa?.totalItems, pedidos])

  const mesaNotifications = useMemo(() => {
    const map = new Map<number, number>()
    notifications.filter(n => !n.leida && n.mesaId).forEach(n => {
      const count = map.get(n.mesaId!) || 0
      map.set(n.mesaId!, count + 1)
    })
    return map
  }, [notifications])

  // Efecto para sincronizar pedidos con WS y manejar IMPRESIÓN AUTOMÁTICA
  useEffect(() => {
    if (mesasWS.length > 0) {
      setMesas(mesasWS)
      setIsLoading(false)

      // Lógica de impresión automática
      if (selectedPrinter) {
        mesasWS.forEach(mesa => {
          if (!mesa.pedido) return

          const pedidoId = mesa.pedido.id
          const pedidoKey = `mesa-${pedidoId}`
          const currentStatus = mesa.pedido.estado
          const currentItemIds = new Set(mesa.items.map(i => i.id))
          const currentPagado = mesa.pedido.pagado

          const prevData = processedOrdersRef.current.get(pedidoKey)
          const isCucuruTransfer = restauranteStore?.cucuruConfigurado && ((mesa.pedido as any).metodoPago === 'transferencia' || !(mesa.pedido as any).metodoPago)

          let shouldPrintComanda = false;

          // 1. Detectar transición PENDING -> PREPARING (Confirmación desde App Cliente)
          if (prevData && prevData.status === 'pending' && currentStatus === 'preparing') {
            if (!isCucuruTransfer) {
              shouldPrintComanda = true;
            }
          }

          // Impresión diferida por Cucuru (solo imprimir comanda cuando el pago entra)
          if (isCucuruTransfer && prevData && !prevData.pagado && currentPagado) {
            shouldPrintComanda = true;
          }

          if (shouldPrintComanda) {
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
              console.log("🖨️ [Dashboard] Auto-printing mesa order:", pedidoId)
              const comandaData = formatComanda({ id: mesa.pedido!.id, mesaNombre: mesa.nombre, nombrePedido: mesa.pedido?.nombrePedido, tipo: 'mesa', total: mesa.pedido!.total }, itemsToPrint, restaurante?.nombre || 'Restaurante')
              printRaw(commandsToBytes(comandaData)).catch((err: Error) => console.error("Error printing confirmed order:", err))
            }
          }

          // 2. Detectar NUEVOS ITEMS en pedido ya confirmado (PREPARING)
          if (!shouldPrintComanda && currentStatus === 'preparing' && prevData) {
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
                console.log("🖨️ [Dashboard] Auto-printing new items mesa:", pedidoId)
                const comandaData = formatComanda({ id: mesa.pedido!.id, mesaNombre: mesa.nombre, nombrePedido: mesa.pedido?.nombrePedido, tipo: 'mesa', total: mesa.pedido!.total }, itemsToPrint, restaurante?.nombre || 'Restaurante')
                printRaw(commandsToBytes(comandaData)).catch((err: Error) => console.error("Error printing new items:", err))
              }
            }
          }

          // 3. Detectar transición a CLOSED (Cliente pidió la cuenta) -> Imprimir FACTURA automáticamente
          if (prevData && prevData.status !== 'closed' && currentStatus === 'closed') {
            console.log("🧾 [Dashboard] Auto-printing factura for closed order:", pedidoId)
            const facturaData = formatFactura(
              {
                id: mesa.pedido.id,
                mesaNombre: mesa.nombre,
                nombrePedido: mesa.pedido.nombrePedido,
                tipo: 'mesa',
                total: mesa.pedido.total
              },
              mesa.items,
              restaurante?.nombre || 'Restaurante'
            )
            printRaw(commandsToBytes(facturaData)).catch((err: Error) => console.error("Error printing factura:", err))
          }

          // Actualizar Ref
          processedOrdersRef.current.set(pedidoKey, {
            status: currentStatus,
            itemIds: currentItemIds,
            pagado: currentPagado
          })
        })
      }



      const pedidosFromMesas: PedidoData[] = mesasWS
        .filter(m => m.pedido)
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
          nombrePedido: m.pedido!.nombrePedido,
          pagado: m.pedido!.pagado,
          metodoPago: (m.pedido as any).metodoPago
        }))
      setPedidos(pedidosFromMesas)
    }
  }, [mesasWS, selectedPrinter, allProductos, allCategorias, restaurante?.nombre, printRaw])

  // ==== AUTO-PRINT PARA DELIVERY Y TAKEAWAY ====
  useEffect(() => {
    if (!selectedPrinter) return

    const unifiedDT = [
      ...deliveryPedidos.map(p => ({ ...p, tipo: 'delivery' as const })),
      ...takeawayPedidos.map(p => ({ ...p, tipo: 'takeaway' as const }))
    ]

    unifiedDT.forEach(pedido => {
      const pedidoKey = `${pedido.tipo}-${pedido.id}`
      const currentStatus = pedido.estado
      const currentItemIds = new Set(pedido.items.map(i => i.id))
      const currentPagado = pedido.pagado
      const prevData = processedOrdersRef.current.get(pedidoKey)
      const isCucuruTransfer = restauranteStore?.cucuruConfigurado && (pedido.metodoPago === 'transferencia' || !pedido.metodoPago)

      let shouldPrintComanda = false

      // 1. Detectar transición PENDING -> PREPARING (Confirmación desde admin o trigger auto)
      if (prevData && prevData.status === 'pending' && currentStatus === 'preparing') {
        if (!isCucuruTransfer) {
          shouldPrintComanda = true
        }
      }

      // Impresión diferida por Cucuru (solo imprimir comanda cuando el pago entra)
      if (isCucuruTransfer && prevData && !prevData.pagado && currentPagado) {
        shouldPrintComanda = true
      }

      if (shouldPrintComanda) {
        const itemsToPrint = pedido.items
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
          console.log(`🖨️ [Dashboard] Auto-printing new ${pedido.tipo} order:`, pedido.id)
          const deliveryFee = pedido.tipo === 'delivery' ? getOrderDeliveryFee(pedido) : 0;
          const comandaData = formatComanda({
            id: pedido.id,
            nombrePedido: pedido.nombreCliente,
            telefono: pedido.telefono,
            direccion: pedido.tipo === 'delivery' ? (pedido as any).direccion : undefined,
            tipo: pedido.tipo,
            total: pedido.total,
            deliveryFee
          }, itemsToPrint, restaurante?.nombre || 'Restaurante')
          printRaw(commandsToBytes(comandaData)).catch((err: Error) => console.error("Error printing DT order:", err))
        }
      }

      // 2. Factura al entregarse o estar listo
      if (prevData && prevData.status !== 'ready' && prevData.status !== 'delivered' && (currentStatus === 'ready' || currentStatus === 'delivered')) {
        console.log(`🧾 [Dashboard] Auto-printing factura for ${pedido.tipo}:`, pedido.id)
        const deliveryFee = pedido.tipo === 'delivery' ? getOrderDeliveryFee(pedido) : 0;
        const facturaData = formatFactura({
          id: pedido.id,
          nombrePedido: pedido.nombreCliente,
          telefono: pedido.telefono,
          direccion: pedido.tipo === 'delivery' ? (pedido as any).direccion : undefined,
          tipo: pedido.tipo,
          total: pedido.total,
          deliveryFee
        },
          pedido.items,
          restaurante?.nombre || 'Restaurante'
        )
        printRaw(commandsToBytes(facturaData)).catch((err: Error) => console.error("Error printing DT factura:", err))
      }

      processedOrdersRef.current.set(pedidoKey, { status: currentStatus, itemIds: currentItemIds, pagado: currentPagado })
    })
  }, [deliveryPedidos, takeawayPedidos, selectedPrinter, allProductos, allCategorias, restaurante?.nombre, printRaw])

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

  const fetchClosedPedidos = useCallback(async () => {
    if (!token) return

    try {
      const response = await pedidosApi.getAll(token, 1, 50) as {
        success: boolean
        data: PedidoData[]
      }

      if (response.success && response.data) {
        setClosedPedidosFromAPI(response.data)
      }
    } catch (error) {
      console.error('Error fetching pedidos:', error)
    }
  }, [token])

  useEffect(() => {
    fetchMesasREST()
    fetchClosedPedidos()
  }, [fetchMesasREST, fetchClosedPedidos])

  const handleSelectMesa = (mesaId: number) => {
    setSelectedMesaId(mesaId)
    setSelectedPedidoFromKanban(null)
    setSelectedUnifiedPedido(null)

    // On mobile, switch to detail view
    if (window.innerWidth < 1024) {
      setMobileView('detail')
    }

    notifications
      .filter(n => n.mesaId === mesaId && !n.leida)
      .forEach(n => markAsRead(n.id))
  }

  const fetchSubtotales = useCallback(async () => {
    if (!displayedPedido) return
    setLoadingSubtotales(true)
    try {
      const response = await mercadopagoApi.getSubtotales(displayedPedido.id) as {
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
  }, [displayedPedido])

  useEffect(() => {
    if (displayedPedido?.estado === 'closed') {
      fetchSubtotales()
    } else {
      setSubtotales([])
    }
  }, [displayedPedido?.estado, fetchSubtotales])

  useEffect(() => {
    const fetchKanbanSubtotales = async () => {
      const closedFromWS = pedidos.filter(p => p.estado === 'closed')
      const allClosedIds = new Set<number>()
      const allClosedPedidos: PedidoData[] = []

      closedFromWS.forEach(p => {
        if (!allClosedIds.has(p.id)) {
          allClosedIds.add(p.id)
          allClosedPedidos.push(p)
        }
      })

      closedPedidosFromAPI.filter(p => p.estado === 'closed').forEach(p => {
        if (!allClosedIds.has(p.id)) {
          allClosedIds.add(p.id)
          allClosedPedidos.push(p)
        }
      })

      if (allClosedPedidos.length === 0) return

      await Promise.all(
        allClosedPedidos.map(async (pedido) => {
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

  const pedidosCerradosPagados = useMemo(() => {
    const setPagados = new Set<number>()
    Object.entries(pedidosSubtotales).forEach(([pedidoId, subs]) => {
      if (subs.length > 0 && subs.every(s => s.pagado)) {
        setPagados.add(Number(pedidoId))
      }
    })
    return setPagados
  }, [pedidosSubtotales])

  const kanbanData = useMemo(() => {
    const grouped: Record<string, KanbanCardData[]> = {
      pending: [],
      preparing: [],
      delivered: [],
      served: [],
      closedPending: [],
      closedPaid: [],
      archived: [],
    }

    const allPedidosMap = new Map<number, PedidoData>()

    pedidos.forEach(p => allPedidosMap.set(p.id, p))

    closedPedidosFromAPI.forEach(p => {
      if (!allPedidosMap.has(p.id)) {
        allPedidosMap.set(p.id, p)
      }
    })

    const allPedidos = Array.from(allPedidosMap.values())

    // Process mesa pedidos
    allPedidos.forEach(pedido => {
      if (restauranteStore?.cucuruConfigurado && (pedido.metodoPago === 'transferencia' || !pedido.metodoPago) && !pedido.pagado) return;

      if (pedido.estado === 'archived') {
        grouped.archived.push({
          id: `mesa-${pedido.id}-archived`,
          pedido,
          items: pedido.items,
          status: 'archived',
          tipo: 'mesa',
        })
        return
      }

      if (pedido.estado === 'pending' && pedido.items.length > 0) {
        grouped.pending.push({ id: `mesa-${pedido.id}-pending`, pedido, items: pedido.items, status: 'pending', tipo: 'mesa' })
        return
      }

      if (pedido.estado === 'closed') {
        const allItemsServed = pedido.items.every(i => i.estado === 'served' || i.estado === 'cancelled')

        if (allItemsServed) {
          const target = pedidosCerradosPagados.has(pedido.id) ? 'closedPaid' : 'closedPending'
          grouped[target].push({
            id: `mesa-${pedido.id}-closed`,
            pedido,
            items: pedido.items,
            status: 'closed',
            tipo: 'mesa',
          })
          return
        }
      }

      const itemsPreparing = pedido.items.filter(i => !i.estado || i.estado === 'preparing' || i.estado === 'pending')
      if (itemsPreparing.length > 0) {
        grouped.preparing.push({ id: `mesa-${pedido.id}-preparing`, pedido, items: itemsPreparing, status: 'preparing', tipo: 'mesa' })
      }

      const itemsDelivered = pedido.items.filter(i => i.estado === 'delivered')
      if (itemsDelivered.length > 0) {
        grouped.delivered.push({ id: `mesa-${pedido.id}-delivered`, pedido, items: itemsDelivered, status: 'delivered', tipo: 'mesa' })
      }

      const itemsServed = pedido.items.filter(i => i.estado === 'served')
      if (itemsServed.length > 0) {
        grouped.served.push({ id: `mesa-${pedido.id}-served`, pedido, items: itemsServed, status: 'served', tipo: 'mesa' })
      }
    })

    // Helper: map delivery/takeaway estado to kanban column
    const mapEstadoToColumn = (estado: string): string | null => {
      switch (estado) {
        case 'pending': return 'pending'
        case 'preparing': return 'preparing'
        case 'ready': return 'delivered'
        case 'delivered': return 'served'
        case 'archived': return 'archived'
        default: return null // cancelled or unknown
      }
    }

    // Helper: map delivery/takeaway estado to item-level estado
    const mapEstadoToItemEstado = (estado: string): ItemPedidoConEstado['estado'] => {
      switch (estado) {
        case 'pending': return 'pending'
        case 'preparing': return 'preparing'
        case 'ready': return 'delivered'
        case 'delivered': return 'served'
        default: return 'preparing'
      }
    }

    // Process delivery pedidos
    deliveryPedidos.forEach(dp => {
      if (restauranteStore?.cucuruConfigurado && (dp.metodoPago === 'transferencia' || !dp.metodoPago) && !dp.pagado) return;

      const column = mapEstadoToColumn(dp.estado)
      if (!column || !grouped[column]) return

      const itemEstado = mapEstadoToItemEstado(dp.estado)
      const items: ItemPedidoConEstado[] = dp.items.map(i => ({
        ...i,
        clienteNombre: dp.nombreCliente || 'Delivery',
        estado: itemEstado,
      }))

      const pseudoPedido: PedidoData = {
        id: dp.id,
        mesaId: null,
        mesaNombre: null,
        estado: dp.estado === 'ready' ? 'delivered' : dp.estado as PedidoData['estado'],
        total: dp.total,
        createdAt: dp.createdAt,
        closedAt: dp.deliveredAt,
        items,
        totalItems: dp.totalItems,
        nombrePedido: dp.nombreCliente,
      }

      grouped[column].push({
        id: `delivery-${dp.id}-${column}`,
        pedido: pseudoPedido,
        items,
        status: column === 'archived' ? 'archived' : dp.estado === 'pending' ? 'pending' : dp.estado === 'preparing' ? 'preparing' : dp.estado === 'ready' ? 'delivered' : 'served',
        tipo: 'delivery',
        direccion: dp.direccion,
        nombreCliente: dp.nombreCliente,
      })
    })

    // Process takeaway pedidos
    takeawayPedidos.forEach(tp => {
      if (restauranteStore?.cucuruConfigurado && (tp.metodoPago === 'transferencia' || !tp.metodoPago) && !tp.pagado) return;

      const column = mapEstadoToColumn(tp.estado)
      if (!column || !grouped[column]) return

      const itemEstado = mapEstadoToItemEstado(tp.estado)
      const items: ItemPedidoConEstado[] = tp.items.map(i => ({
        ...i,
        clienteNombre: tp.nombreCliente || 'Take Away',
        estado: itemEstado,
      }))

      const pseudoPedido: PedidoData = {
        id: tp.id,
        mesaId: null,
        mesaNombre: null,
        estado: tp.estado === 'ready' ? 'delivered' : tp.estado as PedidoData['estado'],
        total: tp.total,
        createdAt: tp.createdAt,
        closedAt: tp.deliveredAt,
        items,
        totalItems: tp.totalItems,
        nombrePedido: tp.nombreCliente,
      }

      grouped[column].push({
        id: `takeaway-${tp.id}-${column}`,
        pedido: pseudoPedido,
        items,
        status: column === 'archived' ? 'archived' : tp.estado === 'pending' ? 'pending' : tp.estado === 'preparing' ? 'preparing' : tp.estado === 'ready' ? 'delivered' : 'served',
        tipo: 'takeaway',
        nombreCliente: tp.nombreCliente,
      })
    })

    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => {
        const dateA = new Date(a.pedido.createdAt).getTime()
        const dateB = new Date(b.pedido.createdAt).getTime()
        if (key === 'closedPending' || key === 'closedPaid') {
          return dateB - dateA
        }
        return dateA - dateB
      })
    })

    return grouped
  }, [pedidos, closedPedidosFromAPI, pedidosCerradosPagados, deliveryPedidos, takeawayPedidos])

  const handleDeleteMesa = async (mesaId: number) => {
    if (!token) return
    setIsDeletingMesa(true)
    try {
      const response = await mesasApi.delete(token, mesaId) as { success: boolean }
      if (response.success) {
        setMesas(prev => prev.filter(m => m.id !== mesaId))
        if (selectedMesaId === mesaId) {
          setSelectedMesaId(null)
          if (window.innerWidth < 1024) {
            setMobileView('mesas')
          }
        }
        setShowDeleteMesaDialog(false)
      }
    } catch (error) {
      console.error('Error deleting mesa:', error)
    } finally {
      setIsDeletingMesa(false)
    }
  }

  const handleCrearMesa = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !nombreMesa.trim()) {
      return
    }
    setIsCreating(true)
    try {
      await mesasApi.create(token, nombreMesa)
      setCrearMesaDialog(false)
      setNombreMesa('')
      refresh()
      await fetchMesasREST()
    } catch (error) {
    } finally {
      setIsCreating(false)
    }
  }

  // Change estado for delivery/takeaway orders (order-level, since they don't have per-item tracking)
  const handleDeliveryTakeawayEstadoChange = async (tipo: 'delivery' | 'takeaway', id: number, nuevoEstado: string) => {
    if (!token) return
    try {
      if (tipo === 'delivery') {
        await deliveryApi.updateEstado(token, id, nuevoEstado)
        setDeliveryPedidos(prev => prev.map(p => p.id === id ? { ...p, estado: nuevoEstado as DeliveryPedido['estado'] } : p))
      } else {
        await takeawayApi.updateEstado(token, id, nuevoEstado)
        setTakeawayPedidos(prev => prev.map(p => p.id === id ? { ...p, estado: nuevoEstado as TakeawayPedido['estado'] } : p))
      }
    } catch (error) {
      console.error('Error al actualizar estado:', error)
    }
  }

  const handleChangeItemEstado = async (pedidoId: number, itemId: number, nuevoEstado: string) => {
    if (!token) return

    setPedidos(prev => prev.map(p => {
      if (p.id !== pedidoId) return p
      return { ...p, items: p.items.map(i => i.id === itemId ? { ...i, estado: nuevoEstado as any } : i) }
    }))

    try {
      await pedidosApi.updateItemEstado(token, pedidoId, itemId, nuevoEstado)
    } catch (error) {
      refresh()
    }
  }

  const handleConfirmarPedido = async (pedido: PedidoData) => {
    if (!token) return
    setUpdatingPedido(pedido.id)
    try {
      await pedidosApi.confirmar(token, pedido.id)
      refresh()
    } catch (error) {
    } finally {
      setUpdatingPedido(null)
    }
  }

  const handleCerrarPedido = async (pedidoId: number) => {
    if (!token) return
    setUpdatingPedido(pedidoId)
    try {
      await pedidosApi.cerrar(token, pedidoId)
      refresh()
    } catch (error) {
      console.error('Error cerrando pedido:', error)
    } finally {
      setUpdatingPedido(null)
    }
  }

  const handleConfirmarPagoEfectivo = async (clienteNombre: string) => {
    if (!token || !selectedMesa?.pedido) return
    setMarcandoPagoEfectivo(clienteNombre)
    try {
      const response = await mercadopagoApi.confirmarEfectivo(token, selectedMesa.pedido.id, clienteNombre) as { success: boolean; error?: string }
      if (response.success) {
        await fetchSubtotales()
        const subtotalesAux = subtotales.map(s => s.clienteNombre === clienteNombre ? { ...s, pagado: true, estado: 'paid', metodo: 'efectivo' } : s)
        if (subtotalesAux.every(s => s.pagado)) {
          handleTogglePagado({ id: selectedMesa.pedido.id, tipo: 'mesa', mesaNombre: displayedPedido?.mesaNombre || '', pagado: true } as UnifiedPedido)
        }
      } else {
      }
    } catch (error) {
    } finally {
      setMarcandoPagoEfectivo(null)
    }
  }

  const handleConfirmarPagoTotal = async (pedidoId: number, subtotalesData: SubtotalInfo[], metodoPago: 'efectivo' | 'transferencia' = 'efectivo') => {
    if (!token) return
    setUpdatingPago(`all-${pedidoId}-${metodoPago}`)

    try {
      const pendientes = subtotalesData.filter(s => !s.pagado && s.estado !== 'paid')

      if (pendientes.length === 0) {
        return
      }

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

      const responsePagar = await mercadopagoApi.pagarEfectivo(pedidoId, regularClients, '', mozoItemIds, metodoPago) as { success: boolean; error?: string }

      if (!responsePagar.success) {
        return
      }

      const results = await Promise.allSettled(
        pendientes.map(sub => mercadopagoApi.confirmarEfectivo(token, pedidoId, sub.clienteNombre, metodoPago))
      )

      const successCount = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length

      if (successCount > 0) {

        setPedidosSubtotales(prev => {
          const subs = prev[pedidoId] || []
          return {
            ...prev,
            [pedidoId]: subs.map(s => ({ ...s, pagado: true, estado: 'paid', metodo: metodoPago }))
          }
        })
        handleTogglePagado({ id: pedidoId, tipo: 'mesa', mesaNombre: displayedPedido?.mesaNombre || '', pagado: true } as UnifiedPedido, metodoPago)
      } else {
      }

    } catch (error) {
      console.error('Error en pago total:', error)
    } finally {
      setUpdatingPago(null)
    }
  }


  // Toggle pagado for any order type (mesa, delivery, takeaway)
  const handleTogglePagado = async (pedido: UnifiedPedido, metodoPago: 'efectivo' | 'transferencia' = 'efectivo') => {
    if (!token) return
    try {
      let response: any
      if (pedido.tipo === 'delivery') {
        response = await deliveryApi.marcarPagado(token, pedido.id, metodoPago)
      } else if (pedido.tipo === 'takeaway') {
        response = await takeawayApi.marcarPagado(token, pedido.id, metodoPago)
      } else {
        response = await pedidosApi.marcarPagado(token, pedido.id, metodoPago)
      }

      if (response.success) {
        const newPagado = response.data?.pagado ?? !pedido.pagado
        // Update delivery/takeaway local state
        if (pedido.tipo === 'delivery') {
          setDeliveryPedidos(prev => prev.map(p => p.id === pedido.id ? { ...p, pagado: newPagado } : p))
        } else if (pedido.tipo === 'takeaway') {
          setTakeawayPedidos(prev => prev.map(p => p.id === pedido.id ? { ...p, pagado: newPagado } : p))
        } else {
          // For mesa pedidos from API
          setClosedPedidosFromAPI(prev => prev.map(p => p.id === pedido.id ? { ...p, pagado: newPagado } : p))
          // Also update active pedidos (from WS) optimistically
          setPedidos(prev => prev.map(p => p.id === pedido.id ? { ...p, pagado: newPagado } : p))
        }
      }
    } catch (error) {
      console.error('Error toggling pagado:', error)
    }
  }

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

  // Limpiar productos seleccionados al cerrar el sheet
  useEffect(() => {
    if (!addProductSheet) {
      setProductosSeleccionados([])
      setExpandedProductosSeleccionados([])
      setSearchProducto('')
      setAddProductMobileTab('productos')
    }
  }, [addProductSheet])



  // Funciones para agregar múltiples productos a un pedido existente
  const handleAddProductoToCart = (producto: Producto, exclusiones?: number[]) => {
    const exclusionesToUse = exclusiones || []
    const existingIndex = productosSeleccionados.findIndex(i =>
      i.productoId === producto.id &&
      JSON.stringify(i.ingredientesExcluidos || []) === JSON.stringify(exclusionesToUse)
    )
    if (existingIndex >= 0) {
      setProductosSeleccionados(prev => prev.map((item, idx) =>
        idx === existingIndex ? { ...item, cantidad: item.cantidad + 1 } : item
      ))
    } else {
      setProductosSeleccionados(prev => [...prev, { productoId: producto.id, cantidad: 1, ingredientesExcluidos: exclusionesToUse }])
    }
  }

  const handleAddProductoToCartWithConfig = (producto: Producto) => {
    // Agregar directamente al carrito, sin abrir diálogo
    // El usuario puede configurar ingredientes desde el carrito
    handleAddProductoToCart(producto)
  }

  const handleRemoveProductoFromCart = (productoId: number, exclusiones?: number[]) => {
    setProductosSeleccionados(prev => prev.filter(i =>
      !(i.productoId === productoId && JSON.stringify(i.ingredientesExcluidos || []) === JSON.stringify(exclusiones || []))
    ))
  }

  const handleUpdateProductoCantidad = (productoId: number, cantidad: number, exclusiones?: number[]) => {
    if (cantidad <= 0) {
      handleRemoveProductoFromCart(productoId, exclusiones)
      return
    }
    setProductosSeleccionados(prev => prev.map(item =>
      (item.productoId === productoId && JSON.stringify(item.ingredientesExcluidos || []) === JSON.stringify(exclusiones || []))
        ? { ...item, cantidad }
        : item
    ))
  }

  const handleToggleProductoIngredient = (idx: number, ingredientId: number) => {
    setProductosSeleccionados(prev => prev.map((item, index) => {
      if (index === idx) {
        const currentExclusions = item.ingredientesExcluidos || []
        const newExclusions = currentExclusions.includes(ingredientId)
          ? currentExclusions.filter(id => id !== ingredientId)
          : [...currentExclusions, ingredientId]
        return { ...item, ingredientesExcluidos: newExclusions }
      }
      return item
    }))
  }

  const handleConfirmMultipleProducts = async () => {
    if (!token || !selectedMesa?.pedido || productosSeleccionados.length === 0) return
    setAddingMultipleProducts(true)
    try {
      for (const item of productosSeleccionados) {
        await pedidosApi.addItem(token, selectedMesa.pedido.id, {
          productoId: item.productoId,
          cantidad: item.cantidad,
          clienteNombre: 'Mozo',
          ingredientesExcluidos: item.ingredientesExcluidos && item.ingredientesExcluidos.length > 0 ? item.ingredientesExcluidos : undefined
        })
      }
      setProductosSeleccionados([])
      setAddProductSheet(false)
      refresh()
    } catch (error: any) {
      console.error('Error agregando productos:', error)
    } finally {
      setAddingMultipleProducts(false)
    }
  }

  const handleDeletePedido = async () => {
    if (!token || !selectedMesa?.pedido) return
    try {
      await pedidosApi.delete(token, selectedMesa.pedido.id)
      setShowDeletePedidoDialog(false)
      setSelectedMesaId(null)
      refresh()
    } catch (error) {
    }
  }

  const handleDeleteItem = async () => {
    if (!token || !selectedMesa?.pedido || !itemAEliminar) return
    try {
      await pedidosApi.deleteItem(token, selectedMesa.pedido.id, itemAEliminar.id)
      setItemAEliminar(null)
      refresh()
    } catch (error) {
    }
  }

  const handleKanbanCardClick = (pedido: PedidoData) => {
    if (pedido.mesaId) {
      setSelectedMesaId(pedido.mesaId)
      setSelectedPedidoFromKanban(pedido)
      setSelectedUnifiedPedido(null)

      // On mobile, switch to detail view when clicking a kanban card
      if (window.innerWidth < 1024) {
        setMobileView('detail')
      }

      notifications
        .filter(n => n.mesaId === pedido.mesaId && !n.leida)
        .forEach(n => markAsRead(n.id))
    }
  }

  const handleUnifiedPedidoClick = (pedido: UnifiedPedido) => {
    if (pedido.tipo === 'mesa') {
      // For mesa orders, find the mesa and use existing flow
      const mesa = mesas.find(m => m.nombre === pedido.mesaNombre)
      if (mesa) {
        setSelectedMesaId(mesa.id)
        const pedidoData = pedidos.find(p => p.id === pedido.id)
        if (pedidoData) {
          setSelectedPedidoFromKanban(pedidoData)
        }
        setSelectedUnifiedPedido(null)
      }
    } else {
      // For delivery/takeaway, show in center with dedicated view
      setSelectedUnifiedPedido(pedido)
      setSelectedMesaId(null)
      setSelectedPedidoFromKanban(null)
    }
    // On mobile, switch to detail view
    if (window.innerWidth < 1024) {
      setMobileView('detail')
    }
  }

  const productosFiltrados = productos.filter(p => {
    const term = searchProducto.toLowerCase()
    return p.nombre.toLowerCase().includes(term) ||
      p.descripcion?.toLowerCase().includes(term) ||
      (p.etiquetas && p.etiquetas.some(e => e.nombre.toLowerCase().includes(term)))
  })

  const itemsPorCliente = useMemo(() => {
    if (!displayedPedido) return {} as Record<string, ItemPedidoConEstado[]>
    const items = displayedPedido.items as ItemPedidoConEstado[]
    return items.reduce((acc, item) => {
      const cliente = item.clienteNombre || 'Sin nombre'
      if (!acc[cliente]) acc[cliente] = []
      acc[cliente].push(item)
      return acc
    }, {} as Record<string, ItemPedidoConEstado[]>)
  }, [displayedPedido])

  // Mobile back button handler
  const handleBackToMesas = () => {
    setMobileView('mesas')
    setSelectedMesaId(null)
    setSelectedPedidoFromKanban(null)
  }

  // Calculate active orders count for badge
  const activeOrdersCount = useMemo(() => {
    return Object.values(kanbanData).reduce((acc, arr) => acc + arr.length, 0)
  }, [kanbanData])

  // ==================== DELIVERY FUNCTIONS ====================

  const fetchDeliveryPedidos = useCallback(async () => {
    if (!token) return
    setLoadingDelivery(true)
    try {
      const response = await deliveryApi.getAll(token) as {
        success: boolean
        data: DeliveryPedido[]
      }
      if (response.success && response.data) {
        setDeliveryPedidos(response.data)
      }
    } catch (error) {
      console.error('Error fetching delivery pedidos:', error)
    } finally {
      setLoadingDelivery(false)
    }
  }, [token])

  const fetchTakeawayPedidos = useCallback(async () => {
    if (!token) return
    try {
      const response = await takeawayApi.getAll(token) as {
        success: boolean
        data: TakeawayPedido[]
      }
      if (response.success && response.data) {
        setTakeawayPedidos(response.data)
      }
    } catch (error) {
      console.error('Error fetching takeaway pedidos:', error)
    }
  }, [token])

  useEffect(() => {
    fetchDeliveryPedidos()
    fetchTakeawayPedidos()
  }, [fetchDeliveryPedidos, fetchTakeawayPedidos])

  useEffect(() => {
    if (lastUpdate) {
      if (lastUpdate.type === 'delivery') fetchDeliveryPedidos()
      if (lastUpdate.type === 'takeaway') fetchTakeawayPedidos()
    }
  }, [lastUpdate, fetchDeliveryPedidos, fetchTakeawayPedidos])

  useEffect(() => {
    if (dashboardMode === 'nuevoPedido' && productos.length === 0) fetchProductos()
  }, [dashboardMode, fetchProductos, productos.length])

  const handleAddDeliveryItem = (producto: Producto) => {
    const existingIndex = newDeliveryItems.findIndex(i => i.productoId === producto.id)
    if (existingIndex >= 0) {
      setNewDeliveryItems(prev => prev.map((item, idx) =>
        idx === existingIndex ? { ...item, cantidad: item.cantidad + 1 } : item
      ))
    } else {
      setNewDeliveryItems(prev => [...prev, { productoId: producto.id, cantidad: 1 }])
    }
  }

  const handleRemoveDeliveryItem = (productoId: number) => {
    setNewDeliveryItems(prev => prev.filter(i => i.productoId !== productoId))
  }

  const handleUpdateDeliveryItemCantidad = (productoId: number, cantidad: number) => {
    if (cantidad <= 0) {
      handleRemoveDeliveryItem(productoId)
      return
    }
    setNewDeliveryItems(prev => prev.map(item =>
      item.productoId === productoId ? { ...item, cantidad } : item
    ))
  }

  const handleCreatePedido = async () => {
    if (!token || newDeliveryItems.length === 0) {
      return
    }
    const isMesa = newPedidoMesaId !== null
    const isDelivery = !isMesa && newDeliveryDireccion.trim().length > 0
    setCreatingDelivery(true)
    try {
      let success = false

      if (isMesa) {
        // Create mesa pedido: first create the pedido, then add items
        const createRes = await pedidosApi.createManual(token, newPedidoMesaId) as { success: boolean; data?: { pedidoId: number } }
        if (createRes.success && createRes.data?.pedidoId) {
          const pedidoId = createRes.data.pedidoId
          // Add all items to the pedido
          for (const item of newDeliveryItems) {
            await pedidosApi.addItem(token, pedidoId, {
              productoId: item.productoId,
              cantidad: item.cantidad,
              clienteNombre: newDeliveryNombre || 'Mozo',
              ingredientesExcluidos: item.ingredientesExcluidos
            })
          }
          success = true
        }
      } else if (isDelivery) {
        const response = await deliveryApi.create(token, {
          direccion: newDeliveryDireccion,
          nombreCliente: newDeliveryNombre || undefined,
          telefono: newDeliveryTelefono || undefined,
          notas: newDeliveryNotas || undefined,
          items: newDeliveryItems
        }) as { success: boolean }
        success = response.success
      } else {
        const response = await takeawayApi.create(token, {
          nombreCliente: newDeliveryNombre || undefined,
          telefono: newDeliveryTelefono || undefined,
          notas: newDeliveryNotas || undefined,
          items: newDeliveryItems
        }) as { success: boolean }
        success = response.success
      }

      if (success) {
        // Print factura automatically (full invoice with all items including beverages)
        if (selectedPrinter) {
          const itemsForPrint = newDeliveryItems.map(item => {
            const producto = productos.find(p => p.id === item.productoId)
            return {
              id: item.productoId,
              nombreProducto: producto?.nombre || 'Producto',
              cantidad: item.cantidad,
              precioUnitario: producto?.precio || '0',
              ingredientesExcluidosNombres: producto?.ingredientes
                ?.filter(ing => item.ingredientesExcluidos?.includes(ing.id))
                .map(ing => ing.nombre) || []
            }
          })

          // Add delivery fee item for delivery orders
          if (isDelivery) {
            const fee = DELIVERY_FEE
            itemsForPrint.push({
              id: 0,
              nombreProducto: fee === 0 ? 'Delivery GRATIS' : 'Delivery',
              cantidad: 1,
              precioUnitario: String(fee),
              ingredientesExcluidosNombres: []
            })
          }

          const total = itemsForPrint.reduce((sum, item) =>
            sum + (parseFloat(item.precioUnitario) * item.cantidad), 0
          ).toFixed(2)

          const mesaNombre = isMesa
            ? (mesas.find(m => m.id === newPedidoMesaId)?.nombre || 'Mesa')
            : isDelivery ? `Delivery: ${newDeliveryDireccion}` : 'Take Away'

          const facturaData = formatFactura(
            {
              id: Date.now(),
              mesaNombre,
              nombrePedido: newDeliveryNombre || (isMesa ? 'Mesa' : isDelivery ? 'Delivery' : 'Take Away'),
              total
            },
            itemsForPrint,
            restaurante?.nombre || 'Restaurante'
          )

          printRaw(commandsToBytes(facturaData))
        }

        exitNuevoPedidoMode()
        setNewDeliveryItems([])
        setNewDeliveryDireccion('')
        setNewDeliveryNombre('')
        setNewDeliveryTelefono('')
        setNewDeliveryNotas('')
        setNewPedidoMesaId(null)
        if (isMesa) {
          fetchMesasREST()
        }
        fetchDeliveryPedidos()
        fetchTakeawayPedidos()
      }
    } catch (error) {
    } finally {
      setCreatingDelivery(false)
    }
  }


  const handleDeleteDelivery = async (pedidoId: number) => {
    if (!token) return
    try {
      const response = await deliveryApi.delete(token, pedidoId) as { success: boolean }
      if (response.success) {
        setDeliveryPedidos(prev => prev.filter(p => p.id !== pedidoId))
      }
    } catch (error) {
    }
  }
  const DELIVERY_FEE = restaurante?.deliveryFee ? parseFloat(restaurante.deliveryFee) : 0

  const deliveryItemsTotal = useMemo(() => {
    const itemsTotal = newDeliveryItems.reduce((total, item) => {
      const producto = productos.find(p => p.id === item.productoId)
      return total + (producto ? parseFloat(producto.precio) * item.cantidad : 0)
    }, 0)
    const deliveryFee = newDeliveryDireccion.trim() ? DELIVERY_FEE : 0
    return itemsTotal + deliveryFee
  }, [newDeliveryItems, productos, newDeliveryDireccion])

  const productosSeleccionadosTotal = useMemo(() => {
    return productosSeleccionados.reduce((total, item) => {
      const producto = productos.find(p => p.id === item.productoId)
      return total + (producto ? parseFloat(producto.precio) * item.cantidad : 0)
    }, 0)
  }, [productosSeleccionados, productos])


  const handleDeleteTakeaway = async (pedidoId: number) => {
    if (!token) return
    try {
      const response = await takeawayApi.delete(token, pedidoId) as { success: boolean }
      if (response.success) {
        setTakeawayPedidos(prev => prev.filter(p => p.id !== pedidoId))
      }
    } catch (error) {
    }
  }

  // Archive handlers
  const handleArchiveDelivery = async (pedidoId: number) => {
    if (!token) return
    try {
      const response = await deliveryApi.updateEstado(token, pedidoId, 'archived') as { success: boolean }
      if (response.success) {
        setDeliveryPedidos(prev => prev.map(p =>
          p.id === pedidoId ? { ...p, estado: 'archived' as DeliveryPedido['estado'] } : p
        ))
      }
    } catch (error) {
    }
  }

  const handleArchiveTakeaway = async (pedidoId: number) => {
    if (!token) return
    try {
      const response = await takeawayApi.updateEstado(token, pedidoId, 'archived') as { success: boolean }
      if (response.success) {
        setTakeawayPedidos(prev => prev.map(p =>
          p.id === pedidoId ? { ...p, estado: 'archived' as TakeawayPedido['estado'] } : p
        ))
      }
    } catch (error) {
    }
  }

  const handleArchiveMesaPedido = async (pedidoId: number) => {
    if (!token) return
    try {
      const response = await pedidosApi.updateEstado(token, pedidoId, 'archived') as { success: boolean }
      if (response.success) {
        setPedidos(prev => prev.map(p =>
          p.id === pedidoId ? { ...p, estado: 'archived' as PedidoData['estado'] } : p
        ))
      }
    } catch (error) {
    }
  }

  // Helper function to get the date of the last item added for mesa pedidos
  const getLastItemDate = (items: any[], pedidoCreatedAt: string): string => {
    if (!items || items.length === 0) return pedidoCreatedAt

    // Find the most recent item by createdAt
    const itemsWithDates = items.filter(item => item.createdAt)
    if (itemsWithDates.length === 0) return pedidoCreatedAt

    const lastItem = itemsWithDates.reduce((latest, item) => {
      const itemDate = new Date(item.createdAt).getTime()
      const latestDate = new Date(latest.createdAt).getTime()
      return itemDate > latestDate ? item : latest
    })

    return lastItem.createdAt
  }

  // Unified all-orders list
  const { allUnifiedPedidos, archivedUnifiedPedidos } = useMemo(() => {
    const unified: UnifiedPedido[] = []
    const addedMesaPedidoIds = new Set<number>()

    // Add mesa pedidos from WS (real-time, only those with at least 1 item)
    pedidos.forEach(p => {
      if (restauranteStore?.cucuruConfigurado && ((p as any).metodoPago === 'transferencia' || !(p as any).metodoPago) && !p.pagado) return;
      if (p.totalItems === 0) return
      addedMesaPedidoIds.add(p.id)
      // For mesa pedidos, use the date of the last item added
      const lastItemDate = getLastItemDate(p.items, p.createdAt)
      unified.push({
        id: p.id,
        tipo: 'mesa',
        estado: p.estado,
        total: p.total,
        createdAt: lastItemDate,
        nombreCliente: p.nombrePedido || null,
        telefono: null,
        mesaNombre: p.mesaNombre,
        items: p.items,
        totalItems: p.totalItems,
        pagado: p.pagado,
      })
    })

    // Add historical mesa pedidos from API (closed, archived, etc. not already in WS)
    // The backend already returns createdAt as the last item date, but we'll recalculate
    // in case items have createdAt and we want to be sure
    closedPedidosFromAPI.forEach(p => {
      if (restauranteStore?.cucuruConfigurado && ((p as any).metodoPago === 'transferencia' || !(p as any).metodoPago) && !p.pagado) return;
      if (addedMesaPedidoIds.has(p.id)) return
      if (p.totalItems === 0) return
      // For mesa pedidos, use the date of the last item added
      const lastItemDate = getLastItemDate(p.items, p.createdAt)
      unified.push({
        id: p.id,
        tipo: 'mesa',
        estado: p.estado,
        total: p.total,
        createdAt: lastItemDate,
        nombreCliente: p.nombrePedido || null,
        telefono: null,
        mesaNombre: p.mesaNombre,
        items: p.items,
        totalItems: p.totalItems,
        pagado: p.pagado,
      })
    })

    // Add delivery pedidos
    deliveryPedidos.forEach(p => {
      if (restauranteStore?.cucuruConfigurado && (p.metodoPago === 'transferencia' || !p.metodoPago) && !p.pagado) return;
      unified.push({
        id: p.id,
        tipo: 'delivery',
        estado: p.estado,
        total: p.total,
        createdAt: p.createdAt,
        nombreCliente: p.nombreCliente,
        telefono: p.telefono,
        direccion: p.direccion,
        notas: p.notas,
        items: p.items,
        totalItems: p.totalItems,
        pagado: p.pagado,
      })
    })

    // Add takeaway pedidos
    takeawayPedidos.forEach(p => {
      if (restauranteStore?.cucuruConfigurado && (p.metodoPago === 'transferencia' || !p.metodoPago) && !p.pagado) return;
      unified.push({
        id: p.id,
        tipo: 'takeaway',
        estado: p.estado,
        total: p.total,
        createdAt: p.createdAt,
        nombreCliente: p.nombreCliente,
        telefono: p.telefono,
        notas: p.notas,
        items: p.items,
        totalItems: p.totalItems,
        pagado: p.pagado,
      })
    })

    // Sort chronologically (newest first)
    unified.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return {
      allUnifiedPedidos: unified.filter(p => p.estado !== 'archived'),
      archivedUnifiedPedidos: unified.filter(p => p.estado === 'archived'),
    }
  }, [pedidos, closedPedidosFromAPI, deliveryPedidos, takeawayPedidos])

  const filteredUnifiedPedidos = useMemo(() => {
    if (pedidoFilter === 'all') return allUnifiedPedidos
    return allUnifiedPedidos.filter(p => p.tipo === pedidoFilter)
  }, [allUnifiedPedidos, pedidoFilter])

  const filteredArchivedPedidos = useMemo(() => {
    if (pedidoFilter === 'all') return archivedUnifiedPedidos
    return archivedUnifiedPedidos.filter(p => p.tipo === pedidoFilter)
  }, [archivedUnifiedPedidos, pedidoFilter])

  // Keep selectedUnifiedPedido in sync with latest data
  const displayedUnifiedPedido = useMemo(() => {
    if (!selectedUnifiedPedido) return null
    const allPedidos = [...allUnifiedPedidos, ...archivedUnifiedPedidos]
    return allPedidos.find(p => p.id === selectedUnifiedPedido.id && p.tipo === selectedUnifiedPedido.tipo) || selectedUnifiedPedido
  }, [selectedUnifiedPedido, allUnifiedPedidos, archivedUnifiedPedidos])

  const pedidoCounts = useMemo(() => ({
    all: allUnifiedPedidos.length,
    mesa: allUnifiedPedidos.filter(p => p.tipo === 'mesa').length,
    delivery: allUnifiedPedidos.filter(p => p.tipo === 'delivery').length,
    takeaway: allUnifiedPedidos.filter(p => p.tipo === 'takeaway').length,
  }), [allUnifiedPedidos])

  const getTipoBadge = (tipo: 'mesa' | 'delivery' | 'takeaway') => {
    switch (tipo) {
      case 'mesa': return { label: '🍽️ Mesa', className: '' }
      case 'delivery': return { label: '🚚 Delivery', className: '' }
      case 'takeaway': return { label: '🛍️ Take Away', className: '' }
    }
  }

  if (isLoading && mesas.length === 0) {
    return (
      <div className="w-full h-[calc(100vh-4rem)] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden bg-background">
      {/* Header - Responsive */}
      <div className="shrink-0 bg-background border-b px-3 py-2 lg:px-4 lg:py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 lg:gap-3">
            {/* Mobile back button */}
            {mobileView !== 'mesas' && (
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden h-8 w-8 -ml-2"
                onClick={handleBackToMesas}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <h1 className="text-lg lg:text-xl font-bold tracking-tight truncate">
              {mobileView === 'detail' && selectedMesa ? selectedMesa.nombre : (restaurante?.nombre || 'Dashboard')}
            </h1>
            {isConnected ? (
              <Badge variant="outline" className="gap-1 text-[10px] lg:text-xs bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 hidden sm:flex">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                En vivo
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-[10px] lg:text-xs bg-orange-50 dark:bg-orange-950/30 border-orange-300 hidden sm:flex">
                Offline
              </Badge>
            )}
          </div>

          {/* Desktop Create Button and Mode Toggle */}
          <div className="hidden lg:flex gap-2">
            <>
              {dashboardMode !== 'nuevoPedido' && (
                <Button size="sm" onClick={enterNuevoPedidoMode}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Pedido
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setShowCierreTurno(true)}>
                <CalendarDays className="mr-2 h-4 w-4" />
                Cerrar Turno
              </Button>
            </>
          </div>

          {/* Mobile Buttons (Icon only) */}
          <div className="flex items-center gap-1 lg:hidden">
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              onClick={() => setShowCierreTurno(true)}
            >
              <CalendarDays className="h-4 w-4" />
            </Button>
            {dashboardMode === 'nuevoPedido' ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={exitNuevoPedidoMode}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                className="h-8 w-8"
                onClick={enterNuevoPedidoMode}
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Mobile Navigation Tabs */}
        {dashboardMode === 'nuevoPedido' ? (
          <div className="lg:hidden mt-2 -mx-3 px-3 border-t pt-2">
            <div className="flex gap-1 bg-muted/50 p-1 rounded-lg">
              <Button
                variant={nuevoPedidoMobileTab === 'info' ? 'secondary' : 'ghost'}
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={() => setNuevoPedidoMobileTab('info')}
              >
                <List className="h-3.5 w-3.5 mr-1.5" />
                Pedido
                {newDeliveryItems.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 min-w-4 px-1">{newDeliveryItems.length}</Badge>
                )}
              </Button>
              <Button
                variant={nuevoPedidoMobileTab === 'productos' ? 'secondary' : 'ghost'}
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={() => setNuevoPedidoMobileTab('productos')}
              >
                <Package className="h-3.5 w-3.5 mr-1.5" />
                Productos
              </Button>
            </div>
          </div>
        ) : (
          <div className="lg:hidden mt-2 -mx-3 px-3 border-t pt-2">
            <div className="flex gap-1 bg-muted/50 p-1 rounded-lg">
              <Button
                variant={mobileView === 'mesas' ? 'secondary' : 'ghost'}
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={() => setMobileView('mesas')}
              >
                <LayoutGrid className="h-3.5 w-3.5 mr-1.5" />
                Mesas
              </Button>
              <Button
                variant={mobileView === 'detail' ? 'secondary' : 'ghost'}
                size="sm"
                className="flex-1 h-8 text-xs relative"
                onClick={() => (selectedMesaId || selectedUnifiedPedido) ? setMobileView('detail') : null}
                disabled={!selectedMesaId && !selectedUnifiedPedido}
              >
                <List className="h-3.5 w-3.5 mr-1.5" />
                Detalle
              </Button>
              <Button
                variant={mobileView === 'orders' ? 'secondary' : 'ghost'}
                size="sm"
                className="flex-1 h-8 text-xs relative"
                onClick={() => setMobileView('orders')}
              >
                <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
                Pedidos
                {activeOrdersCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                    {activeOrdersCount}
                  </span>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content - Desktop: 2 columns (left tabs + right detail), Mobile: Single view based on state */}
      <div className="flex-1 flex overflow-hidden">

        {/* PEDIDOS (UNIFIED) MODE VIEW */}
        {dashboardMode === 'pedidos' && (
          <div className={`
            ${mobileView === 'orders' ? 'flex' : 'hidden'} 
            lg:flex lg:w-80 flex-col border-l bg-muted/10 overflow-hidden
            w-full
          `}>
            <div className="p-3 border-b sticky top-0 bg-background/95 backdrop-blur z-10 flex items-center justify-between">
              <p className="text-sm font-semibold">Pedidos</p>
              <Badge variant="secondary" className="text-xs">{activeOrdersCount}</Badge>
            </div>
            <div className="flex-1 overflow-auto p-3 space-y-4">
              {COLUMNS.map((column) => {
                const columnCards = kanbanData[column.id] || []
                const ColumnIcon = column.icon

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
                          const hasExclusions = card.items.some((i: any) => i.ingredientesExcluidosNombres?.length || i.agregados?.length)
                          const isUpdating = updatingPedido === card.pedido.id
                          const isMesa = card.tipo === 'mesa'

                          const isClosed = card.pedido.estado === 'closed'
                          const subtotalesData = isMesa ? (pedidosSubtotales[card.pedido.id] || []) : []
                          const isFullyPaid = subtotalesData.length > 0 && subtotalesData.every(s => s.pagado)
                          const totalPedido = subtotalesData.reduce((acc, curr) => acc + parseFloat(curr.subtotal), 0)
                          const showUnifiedPayment = !splitPayment && isClosed && isMesa

                          // Card title based on tipo
                          const cardTitle = card.tipo === 'delivery'
                            ? `🚚 ${card.nombreCliente || 'Delivery'}`
                            : card.tipo === 'takeaway'
                              ? `🛍️ ${card.nombreCliente || 'Take Away'}`
                              : `🍽️ ${card.pedido.mesaNombre || 'Sin mesa'}`

                          // Next estado for delivery/takeaway order-level actions
                          const getNextEstado = () => {
                            if (card.status === 'preparing') return { label: 'Marcar Listo', estado: 'ready', color: 'bg-emerald-600 hover:bg-emerald-700' }
                            if (card.status === 'delivered') return { label: 'Marcar Entregado', estado: 'delivered', color: 'bg-indigo-600 hover:bg-indigo-700' }
                            return null
                          }
                          const nextAction = !isMesa ? getNextEstado() : null

                          return (
                            <Card
                              key={card.id}
                              className={`cursor-pointer transition-all hover:border-primary/50 active:scale-[0.98] ${isMesa && selectedMesaId === card.pedido.mesaId ? 'ring-2 ring-primary' : ''
                                }`}
                              onClick={() => {
                                if (isMesa) {
                                  handleKanbanCardClick(card.pedido)
                                } else {
                                  const unified: UnifiedPedido = {
                                    id: card.pedido.id,
                                    tipo: card.tipo,
                                    estado: card.pedido.estado,
                                    total: card.pedido.total,
                                    createdAt: card.pedido.createdAt,
                                    nombreCliente: card.nombreCliente || null,
                                    telefono: null,
                                    direccion: card.direccion,
                                    mesaNombre: null,
                                    items: card.items,
                                    totalItems: card.items.length,
                                  }
                                  handleUnifiedPedidoClick(unified)
                                }
                              }}
                            >
                              <CardContent className="p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-sm">{cardTitle}</span>
                                    {hasExclusions && <AlertTriangle className="h-3 w-3 text-orange-500" />}
                                    {isClosed && isMesa && (
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
                                  <span className="text-xs text-muted-foreground shrink-0">{formatTimeAgo(card.pedido.createdAt)}</span>
                                </div>

                                {card.tipo === 'delivery' && card.direccion && (
                                  <div className="flex items-start gap-1.5 mb-2">
                                    <MapPin className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                                    <span className="text-xs text-muted-foreground truncate">{card.direccion}</span>
                                  </div>
                                )}

                                {showUnifiedPayment && subtotalesData.length > 0 && (
                                  <div className="mb-2 p-2 bg-muted/30 rounded-md">
                                    <div className="flex justify-between items-center mb-1">
                                      <span className="text-xs font-medium">Total Mesa</span>
                                      <span className="text-sm font-bold">${totalPedido.toLocaleString()}</span>
                                    </div>
                                    {!isFullyPaid ? (
                                      <div className="flex gap-1 w-full">
                                        <Button
                                          className="flex-1 h-7 px-1 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleConfirmarPagoTotal(card.pedido.id, subtotalesData, 'efectivo')
                                          }}
                                          disabled={updatingPago === `all-${card.pedido.id}-efectivo` || updatingPago === `all-${card.pedido.id}-transferencia`}
                                          title="Efectivo"
                                        >
                                          {updatingPago === `all-${card.pedido.id}-efectivo` ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            <span>💵 Efectivo</span>
                                          )}
                                        </Button>
                                        <Button
                                          className="flex-1 h-7 px-1 text-[10px] bg-blue-600 hover:bg-blue-700 text-white"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleConfirmarPagoTotal(card.pedido.id, subtotalesData, 'transferencia')
                                          }}
                                          disabled={updatingPago === `all-${card.pedido.id}-transferencia` || updatingPago === `all-${card.pedido.id}-efectivo`}
                                          title="Transferencia"
                                        >
                                          {updatingPago === `all-${card.pedido.id}-transferencia` ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            <span>🏦 Transf.</span>
                                          )}
                                        </Button>
                                      </div>
                                    ) : (
                                      <div className="w-full py-1 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded text-center text-xs font-medium flex items-center justify-center gap-1">
                                        <CheckCircle className="h-3 w-3" />
                                        Pagado
                                      </div>
                                    )}
                                  </div>
                                )}

                                <div className="space-y-1.5">
                                  {card.items.slice(0, 3).map((item) => (
                                    <div key={item.id} className="flex items-start gap-2 text-xs">
                                      <span className="font-bold bg-muted rounded px-1 shrink-0">{item.cantidad}</span>
                                      <div className="flex-1 min-w-0">
                                        <span className="truncate block">{item.nombreProducto}</span>
                                        {item.ingredientesExcluidosNombres && item.ingredientesExcluidosNombres.length > 0 && (
                                          <span className="text-orange-600 text-[10px]">Sin {item.ingredientesExcluidosNombres[0]}</span>
                                        )}
                                        {(item as any).agregados && (item as any).agregados.length > 0 && (
                                          <span className="text-blue-600 text-[10px] ml-1">Con {(item as any).agregados[0].nombre}</span>
                                        )}
                                      </div>
                                      {/* Per-item actions only for mesa orders */}
                                      {(isMesa) && (
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
                                      )}
                                    </div>
                                  ))}
                                  {card.items.length > 3 && (
                                    <p className="text-[10px] text-muted-foreground">+{card.items.length - 3} más</p>
                                  )}
                                </div>

                                {/* Order-level action for delivery/takeaway */}
                                {!isMesa && nextAction && (
                                  <Button
                                    size="sm"
                                    className={`w-full mt-2 h-7 text-xs text-white ${nextAction.color}`}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDeliveryTakeawayEstadoChange(card.tipo as 'delivery' | 'takeaway', card.pedido.id, nextAction.estado)
                                    }}
                                  >
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    {nextAction.label}
                                  </Button>
                                )}

                                {card.status === 'pending' && (
                                  <Button
                                    size="sm"
                                    className="w-full mt-2 h-7 text-xs bg-blue-600 hover:bg-blue-700"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (isMesa) {
                                        handleConfirmarPedido(card.pedido)
                                      } else {
                                        handleDeliveryTakeawayEstadoChange(card.tipo as 'delivery' | 'takeaway', card.pedido.id, 'preparing')
                                      }
                                    }}
                                    disabled={isUpdating}
                                  >
                                    {isUpdating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Play className="h-3 w-3 mr-1" />}
                                    Confirmar
                                  </Button>
                                )}

                                {card.status !== 'archived' && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="w-full mt-1 h-6 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (card.tipo === 'delivery') handleArchiveDelivery(card.pedido.id)
                                      else if (card.tipo === 'takeaway') handleArchiveTakeaway(card.pedido.id)
                                      else handleArchiveMesaPedido(card.pedido.id)
                                    }}
                                  >
                                    <Archive className="h-3 w-3 mr-1" />
                                    Archivar
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
        )}

        {/* NUEVO PEDIDO MODE VIEW - Full screen 3-column layout */}
        {dashboardMode === 'nuevoPedido' && (
          <div className="flex-1 flex overflow-hidden">

            {/* COLUMN 1 (Desktop only): Client Info */}
            <div className="hidden lg:flex lg:w-[280px] xl:w-[300px] flex-col border-r overflow-hidden bg-background shrink-0">
              <div className="p-3 border-b flex items-center gap-2 sticky top-0 bg-background/95 backdrop-blur z-10 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8 -ml-1" onClick={exitNuevoPedidoMode}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <h2 className="font-semibold text-sm">Nuevo Pedido</h2>
              </div>
              <div className="flex-1 overflow-auto p-4 space-y-5">
                {/* Mesa selector */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Tipo de Pedido</h3>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-2 text-sm">
                      <Utensils className="h-3.5 w-3.5" />
                      Mesa
                      <span className="text-muted-foreground text-xs font-normal">(opcional)</span>
                    </Label>
                    <Select
                      value={newPedidoMesaId ? String(newPedidoMesaId) : 'none'}
                      onValueChange={(val) => {
                        if (val === 'none') {
                          setNewPedidoMesaId(null)
                        } else {
                          setNewPedidoMesaId(Number(val))
                          setNewDeliveryDireccion('')
                        }
                      }}
                    >
                      <SelectTrigger className="w-full h-10">
                        <SelectValue placeholder="Sin mesa (Delivery / Take Away)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin mesa (Delivery / Take Away)</SelectItem>
                        {mesas.map((mesa) => (
                          <SelectItem key={mesa.id} value={String(mesa.id)}>
                            {mesa.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Datos del Cliente */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Datos del Cliente</h3>
                  <div className="space-y-3">
                    {!newPedidoMesaId && (
                      <div className="space-y-1.5">
                        <Label htmlFor="dt-direccion" className="flex items-center gap-2 text-sm">
                          <MapPin className="h-3.5 w-3.5" />
                          Dirección
                          <span className="text-muted-foreground text-xs font-normal">(vacío = Take Away)</span>
                        </Label>
                        <Input
                          id="dt-direccion"
                          placeholder="Ej: Av. Principal 123"
                          value={newDeliveryDireccion}
                          onChange={(e) => setNewDeliveryDireccion(e.target.value)}
                          className="h-10"
                        />
                      </div>
                    )}
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="dt-nombre" className="text-sm">
                          <User className="h-3.5 w-3.5 inline mr-1" />
                          Nombre
                        </Label>
                        <Input
                          id="dt-nombre"
                          placeholder="Nombre del cliente"
                          value={newDeliveryNombre}
                          onChange={(e) => setNewDeliveryNombre(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="dt-telefono" className="text-sm">
                          <Phone className="h-3.5 w-3.5 inline mr-1" />
                          Teléfono
                        </Label>
                        <Input
                          id="dt-telefono"
                          placeholder="Ej: 11-1234-5678"
                          value={newDeliveryTelefono}
                          onChange={(e) => setNewDeliveryTelefono(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="dt-notas" className="text-sm">Notas</Label>
                      <Input
                        id="dt-notas"
                        placeholder="Instrucciones especiales..."
                        value={newDeliveryNotas}
                        onChange={(e) => setNewDeliveryNotas(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Tipo badge indicator */}
                <div className="flex items-center gap-2">
                  {newPedidoMesaId ? (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 border">
                      <Utensils className="h-3 w-3 mr-1" />
                      Mesa {mesas.find(m => m.id === newPedidoMesaId)?.nombre || ''}
                    </Badge>
                  ) : newDeliveryDireccion.trim() ? (
                    <Badge className="bg-sky-100 text-sky-700 border-sky-300 border">
                      <Truck className="h-3 w-3 mr-1" />
                      Delivery
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-300 border">
                      <ShoppingBag className="h-3 w-3 mr-1" />
                      Take Away
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* COLUMN 2: Cart + Submit (Mobile info tab includes client info) */}
            <div className={`${nuevoPedidoMobileTab === 'info' ? 'flex' : 'hidden'} lg:flex w-full lg:w-[350px] xl:w-[380px] flex-col border-r overflow-hidden bg-background`}>
              <div className="flex-1 overflow-auto p-4 space-y-5">

                {/* Mobile only: Client info */}
                <div className="lg:hidden space-y-5">
                  {/* Mesa selector */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Tipo de Pedido</h3>
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-2 text-sm">
                        <Utensils className="h-3.5 w-3.5" />
                        Mesa
                        <span className="text-muted-foreground text-xs font-normal">(opcional)</span>
                      </Label>
                      <Select
                        value={newPedidoMesaId ? String(newPedidoMesaId) : 'none'}
                        onValueChange={(val) => {
                          if (val === 'none') {
                            setNewPedidoMesaId(null)
                          } else {
                            setNewPedidoMesaId(Number(val))
                            setNewDeliveryDireccion('')
                          }
                        }}
                      >
                        <SelectTrigger className="w-full h-10">
                          <SelectValue placeholder="Sin mesa (Delivery / Take Away)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin mesa (Delivery / Take Away)</SelectItem>
                          {mesas.map((mesa) => (
                            <SelectItem key={mesa.id} value={String(mesa.id)}>
                              {mesa.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Datos del Cliente */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Datos del Cliente</h3>
                    <div className="space-y-3">
                      {!newPedidoMesaId && (
                        <div className="space-y-1.5">
                          <Label htmlFor="np-direccion" className="flex items-center gap-2 text-sm">
                            <MapPin className="h-3.5 w-3.5" />
                            Dirección
                            <span className="text-muted-foreground text-xs font-normal">(vacío = Take Away)</span>
                          </Label>
                          <Input
                            id="np-direccion"
                            placeholder="Ej: Av. Principal 123"
                            value={newDeliveryDireccion}
                            onChange={(e) => setNewDeliveryDireccion(e.target.value)}
                            className="h-10"
                          />
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="np-nombre" className="text-sm">
                            <User className="h-3.5 w-3.5 inline mr-1" />
                            Nombre
                          </Label>
                          <Input
                            id="np-nombre"
                            placeholder="Nombre del cliente"
                            value={newDeliveryNombre}
                            onChange={(e) => setNewDeliveryNombre(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="np-telefono" className="text-sm">
                            <Phone className="h-3.5 w-3.5 inline mr-1" />
                            Teléfono
                          </Label>
                          <Input
                            id="np-telefono"
                            placeholder="Ej: 11-1234-5678"
                            value={newDeliveryTelefono}
                            onChange={(e) => setNewDeliveryTelefono(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="np-notas" className="text-sm">Notas</Label>
                        <Input
                          id="np-notas"
                          placeholder="Instrucciones especiales..."
                          value={newDeliveryNotas}
                          onChange={(e) => setNewDeliveryNotas(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Tipo badge indicator */}
                  <div className="flex items-center gap-2">
                    {newPedidoMesaId ? (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 border">
                        <Utensils className="h-3 w-3 mr-1" />
                        Mesa {mesas.find(m => m.id === newPedidoMesaId)?.nombre || ''}
                      </Badge>
                    ) : newDeliveryDireccion.trim() ? (
                      <Badge className="bg-sky-100 text-sky-700 border-sky-300 border">
                        <Truck className="h-3 w-3 mr-1" />
                        Delivery
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-300 border">
                        <ShoppingBag className="h-3 w-3 mr-1" />
                        Take Away
                      </Badge>
                    )}
                  </div>

                  <Separator />
                </div>

                {/* Productos seleccionados */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Productos Seleccionados</h3>
                    {newDeliveryItems.length > 0 && (
                      <Badge variant="secondary" className="text-xs">{newDeliveryItems.length}</Badge>
                    )}
                  </div>
                  {newDeliveryItems.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Seleccioná productos de la lista</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 lg:hidden"
                        onClick={() => setNuevoPedidoMobileTab('productos')}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                        Agregar Productos
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        {newDeliveryItems.map((item, idx) => {
                          const producto = productos.find(p => p.id === item.productoId)
                          if (!producto) return null
                          const isExpanded = !expandedDeliveryItems.includes(idx)
                          return (
                            <div key={`${item.productoId}-${idx}`} className="flex flex-col gap-2 p-3 rounded-lg border bg-card">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate text-sm">{producto.nombre}</p>
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs text-muted-foreground">${parseFloat(producto.precio).toFixed(2)} c/u</p>
                                    {producto.ingredientes && producto.ingredientes.length > 0 && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 text-[10px] px-1.5 text-muted-foreground hover:text-foreground"
                                        onClick={() => setExpandedDeliveryItems(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx])}
                                      >
                                        {isExpanded ? 'Ocultar' : 'Ingredientes'}
                                      </Button>
                                    )}
                                  </div>
                                  {item.ingredientesExcluidos && item.ingredientesExcluidos.length > 0 && !isExpanded && (
                                    <p className="text-[10px] text-orange-600 mt-0.5">Sin: {producto.ingredientes?.filter(i => item.ingredientesExcluidos?.includes(i.id)).map(i => i.nombre).join(', ')}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <div className="flex items-center border rounded-lg bg-background h-7">
                                    <Button type="button" variant="ghost" size="icon" className="h-full w-6 rounded-none" onClick={() => handleUpdateDeliveryItemCantidad(item.productoId, item.cantidad - 1)}>
                                      <Minus className="h-3 w-3" />
                                    </Button>
                                    <span className="w-5 text-center text-xs font-medium">{item.cantidad}</span>
                                    <Button type="button" variant="ghost" size="icon" className="h-full w-6 rounded-none" onClick={() => handleUpdateDeliveryItemCantidad(item.productoId, item.cantidad + 1)}>
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleRemoveDeliveryItem(item.productoId)}>
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                              {isExpanded && producto.ingredientes && (
                                <div className="space-y-1 pl-1 border-l-2 border-muted ml-1">
                                  {producto.ingredientes.map(ing => {
                                    const isExcluded = item.ingredientesExcluidos?.includes(ing.id)
                                    return (
                                      <div
                                        key={ing.id}
                                        className={`flex items-center gap-2 p-1 rounded cursor-pointer text-xs ${isExcluded ? 'text-muted-foreground line-through opacity-70' : ''}`}
                                        onClick={() => handleToggleDeliveryIngredient(idx, ing.id)}
                                      >
                                        <Checkbox checked={!isExcluded} className="h-3 w-3" />
                                        <span>{ing.nombre}</span>
                                        {isExcluded && <span className="text-[10px] text-destructive ml-auto font-medium">Excluido</span>}
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      {/* Delivery fee line item */}
                      {newDeliveryDireccion.trim() && (
                        <div className="flex items-center gap-3 p-3 rounded-lg border bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm flex items-center gap-1.5">
                              <Truck className="h-3.5 w-3.5 text-sky-600" />
                              Delivery
                            </p>
                            <p className="text-xs text-muted-foreground">Costo de envío</p>
                          </div>
                          <span className="font-bold text-sm">${DELIVERY_FEE.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                        <span className="font-semibold">Total:</span>
                        <span className="text-xl font-bold text-primary">${deliveryItemsTotal.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Submit button fixed at bottom */}
              <div className="p-4 border-t bg-background shrink-0">
                <Button
                  className="w-full h-11"
                  onClick={handleCreatePedido}
                  disabled={creatingDelivery || newDeliveryItems.length === 0}
                >
                  {creatingDelivery ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : newPedidoMesaId ? (
                    <Utensils className="h-4 w-4 mr-2" />
                  ) : newDeliveryDireccion.trim() ? (
                    <Truck className="h-4 w-4 mr-2" />
                  ) : (
                    <ShoppingBag className="h-4 w-4 mr-2" />
                  )}
                  {newPedidoMesaId
                    ? `Crear Pedido Mesa ${mesas.find(m => m.id === newPedidoMesaId)?.nombre || ''}`
                    : newDeliveryDireccion.trim() ? 'Crear Pedido Delivery' : 'Crear Pedido Take Away'}
                  {newDeliveryItems.length > 0 && ` \u2022 $${deliveryItemsTotal.toFixed(2)}`}
                </Button>
              </div>
            </div>

            {/* COLUMN 3: Product catalog */}
            <div className={`${nuevoPedidoMobileTab === 'productos' ? 'flex' : 'hidden'} lg:flex flex-1 flex-col overflow-hidden bg-muted/10`}>
              <div className="p-4 border-b bg-background/95 backdrop-blur shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Agregar Productos</h3>
                  <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2" onClick={exitNuevoPedidoMode}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar producto o etiqueta... (Enter para agregar)"
                    value={searchProducto}
                    onChange={(e) => setSearchProducto(e.target.value)}
                    className="pl-10 h-10"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchProducto.trim()) {
                        e.preventDefault()
                        const term = searchProducto.trim().toLowerCase()
                        // Buscar por match exacto de etiqueta primero
                        const matchByTag = productos.find(p =>
                          p.etiquetas?.some(et => et.nombre.toLowerCase() === term)
                        )
                        // Si no hay match exacto por etiqueta, usar el primer resultado filtrado
                        const matchProduct = matchByTag || productosFiltrados[0]
                        if (matchProduct) {
                          handleAddDeliveryItem(matchProduct)
                          setSearchProducto('')
                        }
                      }
                    }}
                  />
                </div>
              </div>
              <div className="flex-1 overflow-auto p-4">
                {loadingProductos ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {(() => {
                      const porCategoria = productosFiltrados.reduce((acc, producto) => {
                        const cat = producto.categoria || 'Sin categoría'
                        if (!acc[cat]) acc[cat] = []
                        acc[cat].push(producto)
                        return acc
                      }, {} as Record<string, Producto[]>)

                      const categoriasOrdenadas = Object.keys(porCategoria).sort((a, b) => {
                        if (a === 'Sin categoría') return 1
                        if (b === 'Sin categoría') return -1
                        return a.localeCompare(b)
                      })

                      return categoriasOrdenadas.map((categoriaNombre) => (
                        <div key={categoriaNombre} className="space-y-2">
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 sticky top-0 bg-muted/10 py-1 backdrop-blur-sm z-1">
                            {categoriaNombre}
                            <Badge variant="secondary" className="ml-2 text-[10px] font-normal">{porCategoria[categoriaNombre].length}</Badge>
                          </h4>
                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                            {porCategoria[categoriaNombre].map((producto) => {
                              const existingItem = newDeliveryItems.find(i => i.productoId === producto.id)
                              return (
                                <div
                                  key={producto.id}
                                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${existingItem ? 'bg-primary/5 border-primary/30' : 'bg-card hover:bg-accent/50'}`}
                                  onClick={() => handleAddDeliveryItem(producto)}
                                >
                                  <div className="shrink-0">
                                    {producto.imagenUrl ? (
                                      <img src={producto.imagenUrl} alt={producto.nombre} className="w-12 h-12 rounded-lg object-cover bg-muted" />
                                    ) : (
                                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                                        <Package className="h-5 w-5 text-muted-foreground/40" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <p className="font-medium truncate">{producto.nombre}</p>
                                      {producto.etiquetas && producto.etiquetas.map(et => (
                                        <Badge key={et.id} variant="outline" className="text-[10px] px-1 py-0 h-4 bg-violet-50 dark:bg-violet-950/30 border-violet-300 text-violet-700 dark:text-violet-400 font-mono">
                                          {et.nombre}
                                        </Badge>
                                      ))}
                                    </div>
                                    <p className="font-bold text-primary text-sm">${parseFloat(producto.precio).toFixed(2)}</p>
                                  </div>
                                  {existingItem && (
                                    <Badge variant="secondary" className="font-mono">{existingItem.cantidad}</Badge>
                                  )}
                                  <Plus className="h-5 w-5 text-muted-foreground shrink-0" />
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))
                    })()}
                  </div>
                )}
              </div>
              {/* Mobile floating cart summary */}
              {newDeliveryItems.length > 0 && (
                <div className="lg:hidden p-3 border-t bg-background shrink-0">
                  <Button
                    className="w-full h-11"
                    onClick={() => setNuevoPedidoMobileTab('info')}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Ver Pedido • {newDeliveryItems.reduce((sum, i) => sum + i.cantidad, 0)} {newDeliveryItems.reduce((sum, i) => sum + i.cantidad, 0) === 1 ? 'item' : 'items'} • ${deliveryItemsTotal.toFixed(2)}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MESAS MODE VIEW */}
        {dashboardMode === 'mesas' && (
          <>
            {/* LEFT: Tabbed Panel (Pedidos/Mesas) - Desktop, Mesa grid on Mobile */}
            <div className={`
          ${mobileView === 'mesas' ? 'flex' : 'hidden'} 
          lg:flex lg:w-[380px] xl:w-[420px] flex-col border-r bg-muted/20 overflow-hidden
          w-full
        `}>
              {/* Desktop Tab Switcher */}
              <div className="hidden lg:flex items-center gap-1 p-2 border-b bg-background/95 backdrop-blur shrink-0">
                <button
                  onClick={() => setDesktopLeftTab('pedidos')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${desktopLeftTab === 'pedidos'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                >
                  <ShoppingCart className="h-4 w-4" />
                  Pedidos
                  {allUnifiedPedidos.length > 0 && (
                    <Badge className={`ml-1 text-[10px] px-1.5 py-0 h-4 min-w-5 justify-center ${desktopLeftTab === 'pedidos' ? 'bg-primary-foreground/20 text-primary-foreground' : ''}`}>
                      {allUnifiedPedidos.length}
                    </Badge>
                  )}
                </button>
                <button
                  onClick={() => setDesktopLeftTab('mesas')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${desktopLeftTab === 'mesas'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                >
                  <Utensils className="h-4 w-4" />
                  Mesas
                </button>
              </div>

              {/* DESKTOP: Pedidos Tab Content */}
              <div className={`${desktopLeftTab === 'pedidos' ? 'hidden lg:flex' : 'hidden'} flex-col flex-1 overflow-hidden`}>
                {/* Filter tabs */}
                <div className="border-b bg-background/95 backdrop-blur shrink-0 px-3 pt-2 pb-0">
                  <div className="grid grid-cols-4 gap-1">
                    {([
                      { key: 'all', label: 'Todos', icon: '📋' },
                      { key: 'mesa', label: 'Mesas', icon: '🍽️' },
                      { key: 'delivery', label: 'Delivery', icon: '🚚' },
                      { key: 'takeaway', label: 'T.Away', icon: '🛍️' },
                    ] as const).map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setPedidoFilter(tab.key)}
                        className={`flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${pedidoFilter === tab.key
                          ? 'text-foreground bg-accent'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                          }`}
                      >
                        <span className="hidden xl:inline">{tab.icon}</span>
                        {tab.label}
                        {pedidoCounts[tab.key] > 0 && (
                          <Badge className="ml-0.5 text-[9px] px-1 py-0 h-3.5 min-w-4 justify-center">
                            {pedidoCounts[tab.key]}
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1 overflow-auto p-3">
                  {loadingDelivery ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : allUnifiedPedidos.length === 0 && archivedUnifiedPedidos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
                      <ShoppingCart className="h-12 w-12 text-muted-foreground/30" />
                      <p className="text-sm font-medium">No hay pedidos</p>
                      <Button size="sm" onClick={enterNuevoPedidoMode}>
                        <Plus className="mr-2 h-4 w-4" />
                        Crear primer pedido
                      </Button>
                    </div>
                  ) : filteredUnifiedPedidos.length === 0 && filteredArchivedPedidos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
                      <ShoppingCart className="h-12 w-12 text-muted-foreground/30" />
                      <p className="text-sm font-medium">No hay pedidos de este tipo</p>
                      <Button variant="outline" size="sm" onClick={() => setPedidoFilter('all')}>
                        Ver todos
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredUnifiedPedidos.map((pedido, index) => {
                        const tipoBadge = getTipoBadge(pedido.tipo)
                        const isSelected = selectedUnifiedPedido?.id === pedido.id && selectedUnifiedPedido?.tipo === pedido.tipo
                          || (pedido.tipo === 'mesa' && selectedMesaId !== null && mesas.find(m => m.id === selectedMesaId)?.nombre === pedido.mesaNombre)
                        const dateLabel = getDateLabel(pedido.createdAt)
                        const prevDateLabel = index > 0 ? getDateLabel(filteredUnifiedPedidos[index - 1].createdAt) : null
                        const showDateSeparator = dateLabel !== prevDateLabel
                        return (
                          <Fragment key={`${pedido.tipo}-${pedido.id}`}>
                            {showDateSeparator && (
                              <div className={`flex items-center gap-3 ${index === 0 ? '' : 'pt-2'}`}>
                                <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">{dateLabel}</span>
                                <Separator className="flex-1" />
                              </div>
                            )}
                            <div
                              className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm active:scale-[0.99] ${isSelected ? 'ring-2 ring-primary bg-primary/5 border-primary/30' : 'bg-card hover:bg-accent/50'}`}
                              onClick={() => handleUnifiedPedidoClick(pedido)}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                    <span className={`${tipoBadge.className} text-sm font-semibold`}>
                                      {tipoBadge.label} {pedido.tipo === 'mesa' && pedido.mesaNombre && (
                                        <span className="text-xs font-normal">{pedido.mesaNombre}</span>
                                      )}
                                    </span>
                                    {pedido.pagado && (
                                      <Badge variant="outline" className="text-[9px] bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-300 px-1 py-0 h-4">
                                        💳 Pagado
                                      </Badge>
                                    )}
                                  </div>
                                  {pedido.tipo === 'delivery' && pedido.direccion && (
                                    <div className="flex items-start gap-1 mb-0.5">
                                      <MapPin className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                                      <p className="text-xs text-muted-foreground truncate">{pedido.direccion}</p>
                                    </div>
                                  )}
                                  {pedido.nombreCliente && (
                                    <p className="text-xs text-muted-foreground truncate">{pedido.nombreCliente}</p>
                                  )}
                                  {pedido.telefono && (
                                    <div className="flex items-center gap-1">
                                      <Phone className="h-3 w-3 text-muted-foreground" />
                                      <p className="text-xs text-muted-foreground">{pedido.telefono}</p>
                                    </div>
                                  )}
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="font-bold text-sm">
                                    ${parseFloat(pedido.total).toFixed(2)}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">{formatTimeAgo(pedido.createdAt)}</p>
                                </div>
                              </div>
                            </div>
                          </Fragment>
                        )
                      })}

                      {/* Archived orders section */}
                      {filteredArchivedPedidos.length > 0 && (
                        <>
                          <Separator className="my-3" />
                          <div className="flex items-center gap-2 mb-2">
                            <Archive className="h-3.5 w-3.5 text-muted-foreground/60" />
                            <h3 className="text-xs font-medium text-muted-foreground">Archivados ({filteredArchivedPedidos.length})</h3>
                          </div>
                          {filteredArchivedPedidos.map((pedido, index) => {
                            const tipoBadge = getTipoBadge(pedido.tipo)
                            const isSelected = selectedUnifiedPedido?.id === pedido.id && selectedUnifiedPedido?.tipo === pedido.tipo
                              || (pedido.tipo === 'mesa' && selectedMesaId !== null && mesas.find(m => m.id === selectedMesaId)?.nombre === pedido.mesaNombre)
                            const dateLabel = getDateLabel(pedido.createdAt)
                            const prevDateLabel = index > 0 ? getDateLabel(filteredArchivedPedidos[index - 1].createdAt) : null
                            const showDateSeparator = dateLabel !== prevDateLabel
                            return (
                              <Fragment key={`archived-${pedido.tipo}-${pedido.id}`}>
                                {showDateSeparator && (
                                  <div className={`flex items-center gap-3 ${index === 0 ? '' : 'pt-2'}`}>
                                    <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">{dateLabel}</span>
                                    <Separator className="flex-1" />
                                  </div>
                                )}
                                <div
                                  className={`p-2.5 rounded-lg border cursor-pointer transition-all opacity-50 hover:opacity-70 active:scale-[0.99] ${isSelected ? 'ring-2 ring-primary opacity-70' : 'bg-card'}`}
                                  onClick={() => handleUnifiedPedidoClick(pedido)}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                        <span className={`${tipoBadge.className} text-xs font-medium`}>
                                          {tipoBadge.label} {pedido.tipo === 'mesa' && pedido.mesaNombre && (
                                            <span className="text-[10px]">{pedido.mesaNombre}</span>
                                          )}
                                        </span>
                                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 text-muted-foreground border-muted-foreground/30">
                                          Archivado
                                        </Badge>
                                      </div>
                                      {pedido.tipo === 'delivery' && pedido.direccion && (
                                        <p className="text-[10px] text-muted-foreground truncate">{pedido.direccion}</p>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground shrink-0">
                                      ${parseFloat(pedido.total).toFixed(2)}
                                    </p>
                                  </div>
                                </div>
                              </Fragment>
                            )
                          })}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* DESKTOP: Mesas Tab Content / MOBILE: Mesas grid (shown via mobileView) */}
              <div className={`
                ${mobileView === 'mesas' ? 'flex' : 'hidden'}
                ${desktopLeftTab === 'mesas' ? 'lg:flex' : 'lg:hidden'}
                flex-col flex-1 overflow-hidden
              `}>
                <div className="p-3 lg:p-3 overflow-auto flex-1">
                  <div className="items-center justify-between mb-3 hidden lg:flex">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mesas</p>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => setCrearMesaDialog(true)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-2 gap-2 lg:gap-2">
                    {mesas.map((mesa) => {
                      const hasActiveOrder = mesa.pedido && mesa.pedido.estado !== 'closed' && mesa.pedido.estado !== 'archived' && mesa.totalItems > 0
                      const notifCount = mesaNotifications.get(mesa.id) || 0
                      const isSelected = selectedMesaId === mesa.id

                      return (
                        <button
                          key={mesa.id}
                          onClick={() => handleSelectMesa(mesa.id)}
                          className={`relative aspect-square rounded-lg border-2 flex flex-col items-center justify-center text-center p-1 transition-all active:scale-95 lg:hover:scale-105 ${isSelected
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
                          <span className="font-semibold text-xs truncate w-full px-1">{mesa.nombre}</span>
                          {mesa.clientesConectados.length > 0 && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-1">
                              <Users className="h-2.5 w-2.5" />
                              {mesa.clientesConectados.length}
                            </span>
                          )}
                          {/* Mobile-only: show mini status indicator */}
                          <div className="lg:hidden mt-1">
                            {hasActiveOrder ? (
                              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            ) : (
                              <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT: Detail View - Desktop always visible, Mobile conditional */}
            <div className={`
              ${mobileView === 'detail' ? 'flex' : 'hidden'} 
              lg:flex lg:flex-1 flex-col overflow-hidden
              w-full
            `}>
              <div className="flex-1 overflow-auto p-3 lg:p-4">
                {/* Delivery/Takeaway Detail View */}
                {displayedUnifiedPedido && displayedUnifiedPedido.tipo !== 'mesa' ? (
                  <div className="space-y-3 lg:space-y-4 max-w-3xl mx-auto pb-20 lg:pb-0">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-xl lg:text-2xl font-bold truncate">
                            {displayedUnifiedPedido.tipo === 'delivery' ? '🚚 Delivery' : '🛍️ Take Away'}
                          </h2>
                          {displayedUnifiedPedido.estado === 'archived' && (
                            <Badge variant="outline" className="text-xs text-muted-foreground border-muted-foreground/30">Archivado</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap mt-1">
                          <span>Pedido #{displayedUnifiedPedido.id}</span>
                          <span>·</span>
                          <span>{getDateLabel(displayedUnifiedPedido.createdAt)}, {new Date(displayedUnifiedPedido.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="text-muted-foreground/60">({formatTimeAgo(displayedUnifiedPedido.createdAt)})</span>
                        </p>
                      </div>
                      <div className="flex gap-1 lg:gap-2 shrink-0">
                        {/* Print */}
                        {selectedPrinter && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="hidden lg:flex"
                            onClick={() => {
                              const facturaItems: any[] = displayedUnifiedPedido.items.map((item: any) => ({
                                ...item,
                                precioUnitario: item.precioUnitario || '0'
                              }))
                              if (displayedUnifiedPedido.tipo === 'delivery') {
                                const fee = getOrderDeliveryFee(displayedUnifiedPedido)
                                facturaItems.push({
                                  id: 0,
                                  nombreProducto: fee === 0 ? 'Delivery GRATIS' : 'Delivery',
                                  cantidad: 1,
                                  precioUnitario: String(fee),
                                  ingredientesExcluidosNombres: []
                                })
                              }
                              const total = displayedUnifiedPedido.total
                              const facturaData = formatFactura(
                                {
                                  id: displayedUnifiedPedido.id,
                                  mesaNombre: displayedUnifiedPedido.tipo === 'delivery' ? `Delivery: ${displayedUnifiedPedido.direccion}` : 'Take Away',
                                  nombrePedido: displayedUnifiedPedido.nombreCliente || (displayedUnifiedPedido.tipo === 'delivery' ? 'Delivery' : 'Take Away'),
                                  total
                                },
                                facturaItems,
                                restaurante?.nombre || 'Restaurante'
                              )
                              printRaw(commandsToBytes(facturaData))
                            }}
                          >
                            <Printer className="mr-2 h-4 w-4" />
                            Factura
                          </Button>
                        )}
                        {selectedPrinter && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="lg:hidden h-9 w-9"
                            onClick={() => {
                              const facturaItems: any[] = displayedUnifiedPedido.items.map((item: any) => ({
                                ...item,
                                precioUnitario: item.precioUnitario || '0'
                              }))
                              if (displayedUnifiedPedido.tipo === 'delivery') {
                                const fee = getOrderDeliveryFee(displayedUnifiedPedido)
                                facturaItems.push({
                                  id: 0,
                                  nombreProducto: fee === 0 ? 'Delivery GRATIS' : 'Delivery',
                                  cantidad: 1,
                                  precioUnitario: String(fee),
                                  ingredientesExcluidosNombres: []
                                })
                              }
                              const total = displayedUnifiedPedido.total
                              const facturaData = formatFactura(
                                {
                                  id: displayedUnifiedPedido.id,
                                  mesaNombre: displayedUnifiedPedido.tipo === 'delivery' ? `Delivery: ${displayedUnifiedPedido.direccion}` : 'Take Away',
                                  nombrePedido: displayedUnifiedPedido.nombreCliente || (displayedUnifiedPedido.tipo === 'delivery' ? 'Delivery' : 'Take Away'),
                                  total
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

                        {/* Archive */}
                        {displayedUnifiedPedido.estado !== 'archived' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-muted-foreground hover:text-foreground hidden lg:flex"
                              onClick={(e) => {
                                e.preventDefault()
                                if (displayedUnifiedPedido.tipo === 'delivery') handleArchiveDelivery(displayedUnifiedPedido.id)
                                else handleArchiveTakeaway(displayedUnifiedPedido.id)
                                setSelectedUnifiedPedido(null)
                              }}
                            >
                              <Archive className="mr-2 h-4 w-4" />
                              Archivar
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="text-muted-foreground hover:text-foreground lg:hidden h-9 w-9"
                              onClick={(e) => {
                                e.preventDefault()
                                if (displayedUnifiedPedido.tipo === 'delivery') handleArchiveDelivery(displayedUnifiedPedido.id)
                                else handleArchiveTakeaway(displayedUnifiedPedido.id)
                                setSelectedUnifiedPedido(null)
                              }}
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                          </>
                        )}

                        {/* Delete */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hidden lg:flex"
                          onClick={() => {
                            if (displayedUnifiedPedido.tipo === 'delivery') handleDeleteDelivery(displayedUnifiedPedido.id)
                            else handleDeleteTakeaway(displayedUnifiedPedido.id)
                            setSelectedUnifiedPedido(null)
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="text-destructive lg:hidden h-9 w-9"
                          onClick={() => {
                            if (displayedUnifiedPedido.tipo === 'delivery') handleDeleteDelivery(displayedUnifiedPedido.id)
                            else handleDeleteTakeaway(displayedUnifiedPedido.id)
                            setSelectedUnifiedPedido(null)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Archived banner */}
                    {displayedUnifiedPedido.estado === 'archived' && (
                      <div className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg p-4 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                          <Archive className="h-5 w-5 text-slate-500" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-700 dark:text-slate-300">Pedido Archivado</p>
                          <p className="text-sm text-slate-500">Este pedido ha sido archivado.</p>
                        </div>
                      </div>
                    )}

                    {/* Client Info */}
                    <Card className="lg:shadow-sm border-0 bg-transparent">
                      <CardContent className="py-4 px-3 lg:px-6 space-y-2">
                        {displayedUnifiedPedido.tipo === 'delivery' && displayedUnifiedPedido.direccion && (
                          <div className="flex items-center gap-2 text-xl font-bold">
                            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span>{displayedUnifiedPedido.direccion}</span>
                          </div>
                        )}
                        {displayedUnifiedPedido.nombreCliente && (
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span>{displayedUnifiedPedido.nombreCliente}</span>
                          </div>
                        )}
                        {displayedUnifiedPedido.telefono && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span>{displayedUnifiedPedido.telefono}</span>
                          </div>
                        )}
                        {displayedUnifiedPedido.notas && (
                          <div className="flex items-start gap-2 text-muted-foreground">
                            <span className="text-sm italic">📝 {displayedUnifiedPedido.notas}</span>
                          </div>
                        )}
                        {!displayedUnifiedPedido.nombreCliente && !displayedUnifiedPedido.telefono && !displayedUnifiedPedido.direccion && !displayedUnifiedPedido.notas && (
                          <p className="text-sm text-muted-foreground">Sin datos del cliente</p>
                        )}
                      </CardContent>
                    </Card>

                    {/* PEDIDO */}
                    <div className="space-y-1">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">Pedido</h3>
                      <div className="space-y-0">
                        {displayedUnifiedPedido.items.map((item: any, idx: number) => (
                          <div key={item.id} className={`flex items-baseline justify-between py-3 ${idx > 0 ? 'border-t border-border/40' : ''}`}>
                            <div className="flex items-baseline gap-3 flex-1 min-w-0">
                              <span className="text-muted-foreground text-sm font-mono w-6 shrink-0">{item.cantidad}x</span>
                              <div className="flex-1 min-w-0">
                                <span className="text-sm">{item.nombreProducto}</span>
                                {item.ingredientesExcluidosNombres && item.ingredientesExcluidosNombres.length > 0 && (
                                  <p className="text-[11px] text-orange-500 mt-0.5">Sin: {item.ingredientesExcluidosNombres.join(', ')}</p>
                                )}
                                {(item as any).agregados && (item as any).agregados.length > 0 && (
                                  <p className="text-[11px] text-blue-500 mt-0.5">Con: {(item as any).agregados.map((a: any) => a.nombre).join(', ')}</p>
                                )}
                              </div>
                            </div>
                            <span className="text-sm font-medium tabular-nums shrink-0 ml-4">
                              ${(parseFloat(item.precioUnitario) * item.cantidad).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                            </span>
                          </div>
                        ))}
                        {displayedUnifiedPedido.tipo === 'delivery' && (
                          <div className="flex items-baseline justify-between py-3 border-t border-border/40">
                            <div className="flex items-baseline gap-3 flex-1 min-w-0">
                              <span className="text-muted-foreground text-sm font-mono w-6 shrink-0">1x</span>
                              <span className="text-sm flex items-center gap-1.5">
                                <Truck className="h-3.5 w-3.5 inline" />
                                Delivery
                              </span>
                            </div>
                            <span className="text-sm font-medium tabular-nums shrink-0 ml-4">
                              ${getOrderDeliveryFee(displayedUnifiedPedido).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Total row */}
                      <div className="flex items-center justify-between pt-4 mt-2 border-t border-border">
                        <span className="text-base font-medium">Total</span>
                        <span className="text-xl font-bold tabular-nums">
                          ${parseFloat(displayedUnifiedPedido.total).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                        </span>
                      </div>
                    </div>

                    {/* PAGO */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Pago</h3>
                        {displayedUnifiedPedido.pagado && (
                          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-sm font-medium">Pagado</span>
                          </div>
                        )}
                      </div>

                      {displayedUnifiedPedido.pagado ? (
                        <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-muted/30 border border-border/40">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                              <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{displayedUnifiedPedido.nombreCliente || (displayedUnifiedPedido.tipo === 'delivery' ? 'Delivery' : 'Take Away')}</p>
                            </div>
                          </div>
                          <span className="text-sm font-bold tabular-nums">
                            ${parseFloat(displayedUnifiedPedido.total).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                          </span>
                        </div>
                      ) : (
                        <div className="flex gap-2 w-full">
                          <Button
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => handleTogglePagado(displayedUnifiedPedido, 'efectivo')}
                            disabled={updatingPago === `all-${displayedUnifiedPedido.id}`}
                          >
                            {updatingPago === `all-${displayedUnifiedPedido.id}` ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <span className="mr-2">💵</span>
                            )}
                            Efectivo
                          </Button>
                          <Button
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={() => handleTogglePagado(displayedUnifiedPedido, 'transferencia')}
                            disabled={updatingPago === `all-${displayedUnifiedPedido.id}`}
                          >
                            {updatingPago === `all-${displayedUnifiedPedido.id}` ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <span className="mr-2">🏦</span>
                            )}
                            Transf.
                          </Button>
                        </div>
                      )}
                    </div>

                  </div>
                ) : selectedMesa ? (
                  <div className={`space-y-3 lg:space-y-4 max-w-3xl mx-auto pb-10  ${(displayedPedido?.estado === 'closed' || displayedPedido?.estado === 'archived') ? 'relative' : ''}`}>
                    {/* Banner de pedido archivado */}
                    {displayedPedido?.estado === 'archived' && (
                      <div className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg p-4 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                          <Archive className="h-5 w-5 text-slate-500" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-700 dark:text-slate-300">Pedido Archivado</p>
                          <p className="text-sm text-slate-500">Este pedido ha sido archivado.</p>
                        </div>
                      </div>
                    )}
                    {/* Mobile: Compact Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="text-xl lg:text-2xl font-bold truncate">{selectedMesa?.nombre}</h2>
                        <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                          {displayedPedido ? (
                            <>
                              <span className="truncate">Pedido #{displayedPedido.id}</span>
                              {selectedPedidoFromKanban && selectedMesa?.pedido && selectedPedidoFromKanban.id !== selectedMesa.pedido.id && (
                                <Badge variant="outline" className="text-[10px]">Historial</Badge>
                              )}
                            </>
                          ) : 'Sin pedido activo'}
                        </p>
                        {displayedPedido && (
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                            <Clock className="h-3 w-3" />
                            <span>{getDateLabel(displayedPedido.createdAt)}, {new Date(displayedPedido.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                            <span className="text-muted-foreground/60">({formatTimeAgo(displayedPedido.createdAt)})</span>
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1 lg:gap-2 shrink-0">
                        <Button variant="outline" size="icon" className="lg:hidden h-9 w-9 text-red-600 hover:text-red-700 hover:bg-red-50 border-transparent shadow-none" onClick={() => setShowDeleteMesaDialog(true)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" className="hidden lg:flex text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 shadow-sm" onClick={() => setShowDeleteMesaDialog(true)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar Mesa
                        </Button>
                        <Button variant="outline" size="icon" className="lg:hidden h-9 w-9" onClick={() => setVerQR(true)}>
                          <QrCode className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" className="hidden lg:flex" onClick={() => setVerQR(true)}>
                          <QrCode className="mr-2 h-4 w-4" />
                          QR
                        </Button>

                        {displayedPedido && (
                          <>
                            <Button variant="outline" size="icon" className="lg:hidden h-9 w-9" onClick={() => setAddProductSheet(true)}>
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" className="hidden lg:flex" onClick={() => setAddProductSheet(true)}>
                              <Plus className="mr-2 h-4 w-4" />
                              Agregar
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Banner de pedido cerrado */}
                    {displayedPedido?.estado === 'closed' && (
                      <div className=" p-4 flex items-center gap-3">
                        <div>
                          <p className="font-semibold ">Cuenta Pedida 📋</p>
                          <p className="text-sm text-neutral-500">Para este pedido los clientes ya pidieron la cuenta</p>
                        </div>
                      </div>
                    )}


                    {/* Connected Clients - Compact on mobile */}
                    {(selectedMesa?.clientesConectados?.length ?? 0) > 0 && (
                      <Card className="bg-transparent border-0">
                        <CardHeader className="lg:px-6">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            <span className="hidden sm:inline">Clientes Conectados</span>
                            <span className="sm:hidden">Conectados</span>
                            <span className="text-muted-foreground">({selectedMesa?.clientesConectados?.length ?? 0})</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 lg:px-6 mt-[-10px]">
                          <div className="flex flex-wrap gap-1.5 lg:gap-2">
                            {selectedMesa?.clientesConectados?.map((cliente) => (
                              <div key={cliente.id} className="text-xs bg-muted p-2 rounded-sm">
                                {cliente.nombre}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Mesa Actions Button (Confirm / Close) */}
                    {displayedPedido && displayedPedido.estado !== 'closed' && displayedPedido.estado !== 'archived' && (
                      <div className="w-full px-6 mb-4">
                        {displayedPedido.estado === 'pending' ? (
                          <Button
                            className="w-full bg-blue-600 hover:bg-blue-700 font-bold shadow-sm h-12 text-md"
                            onClick={() => handleConfirmarPedido({ id: displayedPedido.id } as any)}
                            disabled={updatingPedido === displayedPedido.id}
                          >
                            {updatingPedido === displayedPedido.id ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Play className="mr-2 h-5 w-5" />}
                            Confirmar Pedido
                          </Button>
                        ) : (
                          <Button
                            className="w-full bg-emerald-600 hover:bg-emerald-700 font-bold shadow-sm h-12 text-md"
                            onClick={() => handleCerrarPedido(displayedPedido.id)}
                            disabled={updatingPedido === displayedPedido.id}
                          >
                            {updatingPedido === displayedPedido.id ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle className="mr-2 h-5 w-5" />}
                            Cerrar Pedido
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Order Items */}
                    {displayedPedido ? (
                      <>
                        <Card className={`bg-transparent border-0`}>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-xl flex items-center gap-2">
                              <ShoppingCart className="h-8 w-8" />
                              Productos ({displayedPedido.totalItems})
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3 lg:space-y-4 px-3 lg:px-6 pb-3 lg:pb-6">
                            {Object.keys(itemsPorCliente).length === 0 ? (
                              <div className="text-center py-8 text-muted-foreground">
                                <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p>No hay productos</p>
                              </div>
                            ) : (
                              Object.entries(itemsPorCliente).map(([cliente, items]) => (
                                <div key={cliente}>
                                  <div className="flex items-center justify-between mb-2">
                                    <div key={cliente} className="text-sm bg-muted p-2 rounded-sm flex items-center">
                                      <User className="h-4 w-4 mr-1" />
                                      {cliente}
                                    </div>
                                    <span className="text-sm font-medium">
                                      ${items.reduce((sum, i) => sum + (parseFloat(i.precioUnitario) * i.cantidad), 0).toFixed(2)}
                                    </span>
                                  </div>
                                  <div className="space-y-2 ml-0 lg:ml-2">
                                    {items.map((item) => {
                                      return (
                                        <div key={item.id} className={`flex items-start lg:items-center justify-between p-2 rounded-lg gap-2 ${item.postConfirmacion ? 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200' : 'bg-muted/50'}`}>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className="font-medium text-sm">{item.cantidad}x {item.nombreProducto}</span>

                                              {item.postConfirmacion && <Badge variant="outline" className="h-5 text-[10px] border-amber-500 text-amber-600">Nuevo</Badge>}
                                            </div>
                                            {item.ingredientesExcluidosNombres && item.ingredientesExcluidosNombres.length > 0 && (
                                              <p className="text-xs text-orange-600 mt-1">⚠️ Sin: {item.ingredientesExcluidosNombres.join(', ')}</p>
                                            )}
                                            {(item as any).agregados && (item as any).agregados.length > 0 && (
                                              <p className="text-xs text-blue-600 mt-1">➕ Con: {(item as any).agregados.map((a: any) => a.nombre).join(', ')}</p>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-2 shrink-0">
                                            <span className="font-bold text-sm">${(parseFloat(item.precioUnitario) * item.cantidad).toFixed(2)}</span>
                                            <div className="flex gap-1">
                                              {(displayedPedido?.estado !== 'closed' && displayedPedido?.estado !== 'archived') && (
                                                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hidden lg:flex" onClick={() => setItemAEliminar(item)}>
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


                        {/* Payments (when closed) */}
                        {displayedPedido.estado === 'closed' && (
                          <Card className="lg:shadow-sm border-0 bg-transparent">
                            <CardHeader className="pb-2 px-3 lg:px-6">
                              <CardTitle className="text-xl flex items-center gap-2">
                                <Users className="h-6 w-6" />
                                Pagos
                                {subtotales.length > 0 && subtotales.every(s => s.pagado) ? (
                                  <Badge className="text-lg rounded-sm bg-green-500">
                                    💳 Pagado
                                  </Badge>
                                ) : (
                                  <Badge className=" text-lg rounded-sm">
                                    📋 Cuenta Pedida
                                  </Badge>
                                )}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="px-3 lg:px-6 pb-3 lg:pb-6">
                              {loadingSubtotales ? (
                                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                              ) : (
                                <div className="space-y-3">
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
                                            ? ' border-amber-200 '
                                            : 'bg-card'
                                          }`}
                                      >
                                        <div className="min-w-0">
                                          <span className={`font-medium text-sm block `}>
                                            {cliente}
                                          </span>
                                          {esperandoConfirmacion && <span className="">Paga en efectivo</span>}
                                          {estaPagado && <span className="text-md text-green-500">✓ Pagado</span>}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                          <span className={`font-semibold`}>
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

                                  <div className="p-3">
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
                                      <div className="flex gap-2 w-full">
                                        <Button
                                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                          onClick={() => handleConfirmarPagoTotal(displayedPedido.id, subtotales, 'efectivo')}
                                          disabled={updatingPago === `all-${displayedPedido.id}-efectivo` || updatingPago === `all-${displayedPedido.id}-transferencia`}
                                        >
                                          {updatingPago === `all-${displayedPedido.id}-efectivo` ? (
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                          ) : (
                                            <span className="mr-2">💵</span>
                                          )}
                                          Efectivo
                                        </Button>
                                        <Button
                                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                                          onClick={() => handleConfirmarPagoTotal(displayedPedido.id, subtotales, 'transferencia')}
                                          disabled={updatingPago === `all-${displayedPedido.id}-transferencia` || updatingPago === `all-${displayedPedido.id}-efectivo`}
                                        >
                                          {updatingPago === `all-${displayedPedido.id}-transferencia` ? (
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                          ) : (
                                            <span className="mr-2">🏦</span>
                                          )}
                                          Transf.
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )}

                        {/* Total & Payments */}
                        <Card className={`border-0`}>
                          <CardContent className="py-4 px-3 lg:px-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xl font-medium">Total del Pedido</p>
                                <p className="text-xs text-muted-foreground">{displayedPedido.totalItems} productos</p>
                              </div>
                              <p className={`text-2xl lg:text-3xl font-bold`}>
                                ${parseFloat(displayedPedido.total).toFixed(2)}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      </>
                    ) : (
                      <Card className="lg:shadow-sm">
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
                      <p className="text-lg">Selecciona una mesa o pedido</p>
                      <p className="text-sm">para ver su detalle</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile: Orders Panel - visible only on mobile */}
            <div className={`flex flex-col overflow-hidden ${mobileView == 'orders' ? 'w-full' : 'hidden'} lg:hidden`}>
              {/* Filter tabs */}
              <div className="border-b bg-background/95 backdrop-blur shrink-0 px-4 pt-3 pb-0">
                <div className="grid grid-cols-2 gap-1 overflow-x-auto">
                  {([
                    { key: 'all' as const, label: 'Todos' },
                    { key: 'mesa' as const, label: 'Mesas' },
                    { key: 'delivery' as const, label: 'Delivery' },
                    { key: 'takeaway' as const, label: 'Take Away' },
                  ]).map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setPedidoFilter(tab.key)}
                      className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${pedidoFilter === tab.key
                        ? 'text-foreground bg-accent'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                        }`}
                    >
                      {tab.label}
                      {pedidoCounts[tab.key] > 0 && (
                        <Badge className="ml-1 text-[10px] px-1.5 py-0 h-4 min-w-5 justify-center">
                          {pedidoCounts[tab.key]}
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-auto p-4">
                {loadingDelivery ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : filteredUnifiedPedidos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
                    <ShoppingCart className="h-16 w-16 text-muted-foreground/30" />
                    <p className="text-lg font-medium">No hay pedidos</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredUnifiedPedidos.map((pedido) => {
                      const tipoBadge = getTipoBadge(pedido.tipo)
                      const isSelected = selectedUnifiedPedido?.id === pedido.id && selectedUnifiedPedido?.tipo === pedido.tipo
                      return (
                        <Card
                          key={`mob-${pedido.tipo}-${pedido.id}`}
                          className={`overflow-hidden hover:shadow-md transition-all cursor-pointer active:scale-[0.99] ${isSelected ? 'ring-2 ring-primary shadow-md' : ''}`}
                          onClick={() => handleUnifiedPedidoClick(pedido)}
                        >
                          <div className="p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <span className={`${tipoBadge.className} text-sm font-semibold`}>
                                  {tipoBadge.label}
                                </span>
                                {pedido.tipo === 'delivery' && pedido.direccion && (
                                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{pedido.direccion}</p>
                                )}
                                <p className="text-xs text-muted-foreground">{formatTimeAgo(pedido.createdAt)}</p>
                              </div>
                              <p className="font-bold shrink-0">
                                ${parseFloat(pedido.total).toFixed(2)}
                              </p>
                            </div>
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Dialogs */}
      {
        verQR && selectedMesa && (
          <Dialog open={verQR} onOpenChange={(open) => setVerQR(open)}>
            <DialogContent className="max-w-md mx-4">
              <MesaQRCode qrToken={selectedMesa?.qrToken ?? ''} mesaNombre={selectedMesa?.nombre ?? ''} />
            </DialogContent>
          </Dialog>
        )
      }

      <Dialog open={crearMesaDialog} onOpenChange={setCrearMesaDialog}>
        <DialogContent className="max-w-md mx-4">
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

      <Dialog open={showDeleteMesaDialog} onOpenChange={setShowDeleteMesaDialog}>
        <DialogContent className="max-w-md mx-4">
          <DialogHeader>
            <DialogTitle className="text-destructive">¿Eliminar la mesa "{selectedMesa?.nombre}"?</DialogTitle>
            <DialogDescription>
              Esta acción eliminará de forma completa la <b>mesa seleccionada</b>.
              <br /><br />
              <b>Nota:</b> Si deseas eliminar o cerrar un <em>pedido</em>, por favor hazlo desde "Cerrar Pedido" o el botón de eliminar pedido individual.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowDeleteMesaDialog(false)} disabled={isDeletingMesa}>Cancelar</Button>
            <Button variant="destructive" onClick={() => selectedMesa && handleDeleteMesa(selectedMesa.id)} disabled={isDeletingMesa}>
              {isDeletingMesa ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Eliminando...</> : 'Sí, Eliminar Mesa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeletePedidoDialog} onOpenChange={setShowDeletePedidoDialog}>
        <DialogContent className="max-w-md mx-4">
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

      <Dialog open={!!itemAEliminar} onOpenChange={(open) => !open && setItemAEliminar(null)}>
        <DialogContent className="max-w-md mx-4">
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

      <Dialog open={!!configuringProduct} onOpenChange={(open) => !open && setConfiguringProduct(null)}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col mx-4">
          <DialogHeader>
            <DialogTitle>Personalizar {configuringProduct?.nombre}</DialogTitle>
            <DialogDescription>Selecciona los ingredientes para EXCLUIR.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-2">
            {configuringProduct?.ingredientes?.length ? (
              <div className="space-y-2">
                {configuringProduct?.ingredientes?.map(ing => {
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
            <Button onClick={() => {
              if (configuringProduct) {
                handleAddProductoToCart(configuringProduct, excludedIngredients)
                setConfiguringProduct(null)
                setExcludedIngredients([])
              }
            }}>
              <Plus className="mr-2 h-4 w-4" />
              Agregar al Carrito
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Product Sheet - Full screen on mobile */}
      <Sheet open={addProductSheet} onOpenChange={setAddProductSheet}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0">
          <div className="flex flex-col h-full">
            <SheetHeader className="text-left p-4 pb-2 border-b shrink-0">
              <SheetTitle className="flex items-center gap-2"><Package className="h-5 w-5" />Agregar Productos</SheetTitle>
              <SheetDescription>Selecciona los productos para agregar al pedido.</SheetDescription>
            </SheetHeader>

            {/* Mobile Tabs */}
            <div className="lg:hidden px-4 pt-2 border-b shrink-0">
              <div className="flex gap-1 bg-muted/50 p-1 rounded-lg">
                <Button
                  variant={addProductMobileTab === 'carrito' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={() => setAddProductMobileTab('carrito')}
                >
                  <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
                  Carrito
                  {productosSeleccionados.length > 0 && (
                    <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 min-w-4 px-1">{productosSeleccionados.length}</Badge>
                  )}
                </Button>
                <Button
                  variant={addProductMobileTab === 'productos' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={() => setAddProductMobileTab('productos')}
                >
                  <Package className="h-3.5 w-3.5 mr-1.5" />
                  Productos
                </Button>
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* COLUMN 1: Productos Seleccionados */}
              <div className={`${addProductMobileTab === 'carrito' ? 'flex' : 'hidden'} lg:flex w-full sm:w-[350px] flex-col border-r overflow-hidden bg-background shrink-0`}>
                <div className="flex-1 overflow-auto p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Productos Seleccionados</h3>
                    {productosSeleccionados.length > 0 && (
                      <Badge variant="secondary" className="text-xs">{productosSeleccionados.length}</Badge>
                    )}
                  </div>
                  {productosSeleccionados.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Seleccioná productos de la lista</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        {productosSeleccionados.map((item, idx) => {
                          const producto = productos.find(p => p.id === item.productoId)
                          if (!producto) return null
                          const isExpanded = !expandedProductosSeleccionados.includes(idx)
                          return (
                            <div key={`${item.productoId}-${idx}`} className="flex flex-col gap-2 p-3 rounded-lg border bg-card">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate text-sm">{producto.nombre}</p>
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs text-muted-foreground">${parseFloat(producto.precio).toFixed(2)} c/u</p>
                                    {producto.ingredientes && producto.ingredientes.length > 0 && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 text-[10px] px-1.5 text-muted-foreground hover:text-foreground"
                                        onClick={() => setExpandedProductosSeleccionados(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx])}
                                      >
                                        {isExpanded ? 'Ocultar' : 'Ingredientes'}
                                      </Button>
                                    )}
                                  </div>
                                  {item.ingredientesExcluidos && item.ingredientesExcluidos.length > 0 && !isExpanded && (
                                    <p className="text-[10px] text-orange-600 mt-0.5">Sin: {producto.ingredientes?.filter(i => item.ingredientesExcluidos?.includes(i.id)).map(i => i.nombre).join(', ')}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <div className="flex items-center border rounded-lg bg-background h-7">
                                    <Button type="button" variant="ghost" size="icon" className="h-full w-6 rounded-none" onClick={() => handleUpdateProductoCantidad(item.productoId, item.cantidad - 1, item.ingredientesExcluidos)}>
                                      <Minus className="h-3 w-3" />
                                    </Button>
                                    <span className="w-5 text-center text-xs font-medium">{item.cantidad}</span>
                                    <Button type="button" variant="ghost" size="icon" className="h-full w-6 rounded-none" onClick={() => handleUpdateProductoCantidad(item.productoId, item.cantidad + 1, item.ingredientesExcluidos)}>
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleRemoveProductoFromCart(item.productoId, item.ingredientesExcluidos)}>
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                              {isExpanded && producto.ingredientes && (
                                <div className="space-y-1 pl-1 border-l-2 border-muted ml-1">
                                  {producto.ingredientes.map(ing => {
                                    const isExcluded = item.ingredientesExcluidos?.includes(ing.id)
                                    return (
                                      <div
                                        key={ing.id}
                                        className={`flex items-center gap-2 p-1 rounded cursor-pointer text-xs ${isExcluded ? 'text-muted-foreground line-through opacity-70' : ''}`}
                                        onClick={() => handleToggleProductoIngredient(idx, ing.id)}
                                      >
                                        <Checkbox checked={!isExcluded} className="h-3 w-3" />
                                        <span>{ing.nombre}</span>
                                        {isExcluded && <span className="text-[10px] text-destructive ml-auto font-medium">Excluido</span>}
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                        <span className="font-semibold">Total:</span>
                        <span className="text-xl font-bold text-primary">${productosSeleccionadosTotal.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Submit button fixed at bottom */}
                <div className="p-4 border-t bg-background shrink-0">
                  <Button
                    className="w-full h-11"
                    onClick={handleConfirmMultipleProducts}
                    disabled={addingMultipleProducts || productosSeleccionados.length === 0}
                  >
                    {addingMultipleProducts ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Agregar {productosSeleccionados.length > 0 && `${productosSeleccionados.length} producto${productosSeleccionados.length !== 1 ? 's' : ''}`}
                    {productosSeleccionados.length > 0 && ` \u2022 $${productosSeleccionadosTotal.toFixed(2)}`}
                  </Button>
                </div>
              </div>

              {/* COLUMN 2: Catálogo de Productos */}
              <div className={`${addProductMobileTab === 'productos' ? 'flex' : 'hidden'} lg:flex flex-1 flex-col overflow-hidden bg-muted/10`}>
                <div className="p-4 border-b bg-background/95 backdrop-blur shrink-0">
                  <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">Agregar Productos</h3>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar producto o etiqueta... (Enter para agregar)"
                      value={searchProducto}
                      onChange={(e) => setSearchProducto(e.target.value)}
                      className="pl-10 h-10"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && searchProducto.trim()) {
                          e.preventDefault()
                          const term = searchProducto.trim().toLowerCase()
                          const matchByTag = productos.find(p =>
                            p.etiquetas?.some(et => et.nombre.toLowerCase() === term)
                          )
                          const matchProduct = matchByTag || productosFiltrados[0]
                          if (matchProduct) {
                            handleAddProductoToCartWithConfig(matchProduct)
                            setSearchProducto('')
                          }
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-auto p-4">
                  {loadingProductos ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {(() => {
                        const porCategoria = productosFiltrados.reduce((acc, producto) => {
                          const cat = producto.categoria || 'Sin categoría'
                          if (!acc[cat]) acc[cat] = []
                          acc[cat].push(producto)
                          return acc
                        }, {} as Record<string, Producto[]>)

                        const categoriasOrdenadas = Object.keys(porCategoria).sort((a, b) => {
                          if (a === 'Sin categoría') return 1
                          if (b === 'Sin categoría') return -1
                          return a.localeCompare(b)
                        })

                        return categoriasOrdenadas.map((categoriaNombre) => (
                          <div key={categoriaNombre} className="space-y-2">
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 sticky top-0 bg-muted/10 py-1 backdrop-blur-sm z-1">
                              {categoriaNombre}
                              <Badge variant="secondary" className="ml-2 text-[10px] font-normal">{porCategoria[categoriaNombre].length}</Badge>
                            </h4>
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                              {porCategoria[categoriaNombre].map((producto) => {
                                // Solo mostrar badge si hay un item sin ingredientes excluidos
                                const existingItem = productosSeleccionados.find(i =>
                                  i.productoId === producto.id &&
                                  (!i.ingredientesExcluidos || i.ingredientesExcluidos.length === 0)
                                )
                                return (
                                  <div
                                    key={producto.id}
                                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${existingItem ? 'bg-primary/5 border-primary/30' : 'bg-card hover:bg-accent/50'}`}
                                    onClick={() => handleAddProductoToCartWithConfig(producto)}
                                  >
                                    <div className="shrink-0">
                                      {producto.imagenUrl ? (
                                        <img src={producto.imagenUrl} alt={producto.nombre} className="w-12 h-12 rounded-lg object-cover bg-muted" />
                                      ) : (
                                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                                          <Package className="h-5 w-5 text-muted-foreground/40" />
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <p className="font-medium truncate">{producto.nombre}</p>
                                        {producto.etiquetas && producto.etiquetas.map(et => (
                                          <Badge key={et.id} variant="outline" className="text-[10px] px-1 py-0 h-4 bg-violet-50 dark:bg-violet-950/30 border-violet-300 text-violet-700 dark:text-violet-400 font-mono">
                                            {et.nombre}
                                          </Badge>
                                        ))}
                                      </div>
                                      <p className="font-bold text-primary text-sm">${parseFloat(producto.precio).toFixed(2)}</p>
                                    </div>
                                    {existingItem && (
                                      <Badge variant="secondary" className="font-mono">{existingItem.cantidad}</Badge>
                                    )}
                                    <Plus className="h-5 w-5 text-muted-foreground shrink-0" />
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))
                      })()}
                    </div>
                  )}
                </div>
                {/* Mobile floating cart summary */}
                {productosSeleccionados.length > 0 && (
                  <div className="lg:hidden p-3 border-t bg-background shrink-0">
                    <Button
                      className="w-full h-11"
                      onClick={() => setAddProductMobileTab('carrito')}
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Ver Carrito • {productosSeleccionados.reduce((sum, i) => sum + i.cantidad, 0)} {productosSeleccionados.reduce((sum, i) => sum + i.cantidad, 0) === 1 ? 'item' : 'items'} • ${productosSeleccionadosTotal.toFixed(2)}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Cierre de Turno */}
      <CierreTurno open={showCierreTurno} onClose={() => setShowCierreTurno(false)} />

    </div >
  )
}

export default Dashboard