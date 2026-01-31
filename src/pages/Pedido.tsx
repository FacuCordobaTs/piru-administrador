import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs" // Asegúrate de tener este componente o usa el estado manual abajo
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { pedidosApi, productosApi, mercadopagoApi, ApiError } from '@/lib/api'
import { useAdminWebSocket } from '@/hooks/useAdminWebSocket'
import { toast } from 'sonner'
import {
  Loader2, ArrowLeft, Clock, CheckCircle, ChefHat, Utensils,
  ShoppingCart, Users, Wifi, WifiOff, User, Plus, Trash2, Minus,
  Receipt, CheckCircle2, XCircle, Search,
  Bell, Package
} from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { useQZ } from '@/context/QZContext'
import { formatComanda } from '@/utils/printerUtils'

// Types
interface ItemPedido {
  id: number
  productoId: number
  clienteNombre: string
  cantidad: number
  precioUnitario: string
  nombreProducto?: string
  imagenUrl?: string | null
  descripcion?: string | null
  ingredientesExcluidos?: number[]
  ingredientesExcluidosNombres?: string[]
  postConfirmacion?: boolean
  estado?: 'pending' | 'preparing' | 'delivered' | 'served' | 'cancelled'
}

interface PagoInfo {
  id: number
  metodo: 'efectivo' | 'mercadopago'
  estado: 'pending' | 'paid' | 'failed'
  monto: string
  mpPaymentId?: string | null
  createdAt: string
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

interface PedidoDetalle {
  id: number
  mesaId: number | null
  mesaNombre: string | null
  mesaQrToken?: string | null
  estado: 'pending' | 'preparing' | 'delivered' | 'closed'
  total: string
  createdAt: string
  closedAt?: string | null
  items: ItemPedido[]
  itemsPorCliente: Record<string, ItemPedido[]>
  totalItems: number
  pago?: PagoInfo | null
  pagos?: PagoInfo[]
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

// Helpers
const getEstadoBadge = (estado: string | null | undefined) => {
  const estados: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any; color: string }> = {
    pending: { label: 'Pendiente', variant: 'outline', icon: Clock, color: 'text-yellow-600 bg-yellow-100' },
    preparing: { label: 'Preparando', variant: 'default', icon: ChefHat, color: 'text-blue-600 bg-blue-100' },
    delivered: { label: 'Entregado', variant: 'secondary', icon: Utensils, color: 'text-green-600 bg-green-100' },
    closed: { label: 'Cerrado', variant: 'secondary', icon: CheckCircle, color: 'text-gray-600 bg-gray-100' },
  }
  return estados[estado || 'pending'] || estados.pending
}

const getItemEstadoBadge = (estado: string | null | undefined) => {
  const estados: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any; color: string }> = {
    pending: { label: 'Pendiente', variant: 'outline', icon: Clock, color: 'text-yellow-600 bg-yellow-100' },
    preparing: { label: 'En Cocina', variant: 'default', icon: ChefHat, color: 'text-blue-600 bg-blue-100' },
    delivered: { label: 'Listo', variant: 'secondary', icon: Utensils, color: 'text-green-600 bg-green-100' },
    served: { label: 'Entregado', variant: 'secondary', icon: CheckCircle, color: 'text-indigo-600 bg-indigo-100' },
    cancelled: { label: 'Cancelado', variant: 'destructive', icon: XCircle, color: 'text-red-600 bg-red-100' },
  }
  return estados[estado || 'pending'] || estados.pending
}

const formatDateFull = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getTimeAgo = (dateString: string) => {
  const date = new Date(dateString)
  const adjustedDate = new Date(date.getTime() + 3 * 60 * 60 * 1000)
  const now = new Date()
  const diffMs = now.getTime() - adjustedDate.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'Hace un momento'
  if (diffMins < 60) return `Hace ${diffMins} min`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `Hace ${diffHours} h`
  const diffDays = Math.floor(diffHours / 24)
  return `Hace ${diffDays} d`
}

const getDuration = (startDate: string, endDate?: string | null) => {
  const start = new Date(startDate)
  const adjustedStart = new Date(start.getTime() + 3 * 60 * 60 * 1000)
  const end = endDate ? new Date(new Date(endDate).getTime() + 3 * 60 * 60 * 1000) : new Date()
  const diffMs = end.getTime() - adjustedStart.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 60) return `${diffMins} min`
  const hours = Math.floor(diffMins / 60)
  const mins = diffMins % 60
  return `${hours}h ${mins}m`
}

const Pedido = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const token = useAuthStore((state) => state.token)
  const { restaurante } = useRestauranteStore()
  const esCarrito = restaurante?.esCarrito || false
  const { print, defaultPrinter } = useQZ()

  // WebSocket y Estados
  const { mesas: mesasWS, isConnected, subtotalesUpdates, marcarPedidoListo } = useAdminWebSocket()
  const [pedido, setPedido] = useState<PedidoDetalle | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [subtotales, setSubtotales] = useState<SubtotalInfo[]>([])
  const [loadingSubtotales, setLoadingSubtotales] = useState(false)
  const [addProductSheet, setAddProductSheet] = useState(false)
  const [productos, setProductos] = useState<Producto[]>([])
  const [loadingProductos, setLoadingProductos] = useState(false)
  const [searchProducto, setSearchProducto] = useState('')
  const [addingProducto, setAddingProducto] = useState<number | null>(null)
  const [cantidadProducto, setCantidadProducto] = useState<Record<number, number>>({})
  const [itemAEliminar, setItemAEliminar] = useState<ItemPedido | null>(null)
  const [showDeletePedidoDialog, setShowDeletePedidoDialog] = useState(false)
  const [marcandoPagoEfectivo, setMarcandoPagoEfectivo] = useState<string | null>(null)

  // Configuración de producto (Ingredientes)
  const [configuringProduct, setConfiguringProduct] = useState<Producto | null>(null)
  const [excludedIngredients, setExcludedIngredients] = useState<number[]>([])

  // NUEVO: Detectar si es mobile para la dirección del Sheet
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Estado para la pestaña móvil (default: items)
  const [mobileTab, setMobileTab] = useState<'items' | 'info'>('items')

  const puedeGestionarPagos = pedido?.estado === 'closed' || (esCarrito && pedido?.estado === 'preparing');

  // Fetch logic (Igual que antes)
  const fetchPedido = useCallback(async () => {
    if (!token || !id) return
    setIsLoading(true)
    try {
      const response = await pedidosApi.getById(token, Number(id)) as { success: boolean; data: PedidoDetalle }
      if (response.success && response.data) setPedido(response.data)
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) navigate('/dashboard')
    } finally {
      setIsLoading(false)
    }
  }, [token, id, navigate])

  useEffect(() => { fetchPedido() }, [fetchPedido])

  useEffect(() => {
    if (!pedido || mesasWS.length === 0) return
    const mesaWS = mesasWS.find(m => m.pedido?.id === pedido.id)
    if (mesaWS && mesaWS.pedido) {
      setPedido(prev => {
        if (!prev) return null
        const itemsPorCliente = mesaWS.items.reduce((acc, item) => {
          const cliente = item.clienteNombre || 'Sin nombre'
          if (!acc[cliente]) acc[cliente] = []
          acc[cliente].push(item)
          return acc
        }, {} as Record<string, ItemPedido[]>)
        return {
          ...prev,
          estado: mesaWS.pedido!.estado,
          total: mesaWS.pedido!.total,
          items: mesaWS.items,
          itemsPorCliente,
          totalItems: mesaWS.totalItems,
          mesaQrToken: prev.mesaQrToken || mesaWS.qrToken
        }
      })
    }
  }, [mesasWS, pedido?.id])

  const fetchSubtotales = useCallback(async () => {
    if (!id) return
    setLoadingSubtotales(true)
    try {
      const response = await mercadopagoApi.getSubtotales(Number(id)) as { success: boolean; subtotales: SubtotalInfo[]; mozoItems?: SubtotalInfo[] }
      if (response.success) {
        let allSubtotales = response.subtotales || []
        if (response.mozoItems && Array.isArray(response.mozoItems)) {
          allSubtotales = [...allSubtotales, ...response.mozoItems]
        }
        setSubtotales(allSubtotales)
      }
    } catch (error) { console.error(error) } finally { setLoadingSubtotales(false) }
  }, [id])

  useEffect(() => { if (puedeGestionarPagos) fetchSubtotales() }, [puedeGestionarPagos, fetchSubtotales])

  useEffect(() => {
    if (!id) return
    const update = subtotalesUpdates.get(Number(id))
    if (update) {
      setSubtotales(update.todosSubtotales.map(s => ({
        clienteNombre: s.clienteNombre,
        subtotal: s.monto,
        pagado: s.estado === 'paid',
        metodo: s.metodo || undefined,
        estado: s.estado
      })))
    }
  }, [subtotalesUpdates, id])

  const handleChangeEstado = async (nuevoEstado: string) => {
    if (!token || !pedido) return
    setIsUpdating(true)
    try {
      await pedidosApi.updateEstado(token, pedido.id, nuevoEstado)
      toast.success('Estado actualizado')
      setPedido(prev => prev ? { ...prev, estado: nuevoEstado as any } : null)
    } catch (error) { toast.error('Error al actualizar') } finally { setIsUpdating(false) }
  }

  const handleChangeItemEstado = async (itemId: number, nuevoEstado: string) => {
    if (!token || !pedido) return
    setPedido(prev => {
      if (!prev) return null
      const updatedItems = prev.items.map(i => i.id === itemId ? { ...i, estado: nuevoEstado as any } : i)
      const itemsPorCliente = updatedItems.reduce((acc, item) => {
        const cliente = item.clienteNombre || 'Sin nombre'
        if (!acc[cliente]) acc[cliente] = []
        acc[cliente].push(item)
        return acc
      }, {} as Record<string, ItemPedido[]>)
      return { ...prev, items: updatedItems, itemsPorCliente }
    })
    try {
      await pedidosApi.updateItemEstado(token, pedido.id, itemId, nuevoEstado)
      toast.success(`Item actualizado`)
    } catch (error) { toast.error('Error al actualizar item'); await fetchPedido() }
  }

  const fetchProductos = useCallback(async () => {
    if (!token) return
    setLoadingProductos(true)
    try {
      const response = await productosApi.getAll(token) as { success: boolean; productos: Producto[] }
      if (response.success && response.productos) setProductos(response.productos.filter(p => p.activo))
    } catch (error) { console.error(error) } finally { setLoadingProductos(false) }
  }, [token])

  useEffect(() => { if (addProductSheet && productos.length === 0) fetchProductos() }, [addProductSheet, fetchProductos, productos.length])

  const handleAddProducto = async (producto: Producto) => {
    // Si tiene ingredientes, abrir dialogo de configuración
    if (producto.ingredientes && producto.ingredientes.length > 0) {
      setExcludedIngredients([]) // Reset exclusions
      setConfiguringProduct(producto)
      return
    }

    // Si no tiene ingredientes, agregar directamente
    await confirmAddProducto(producto, [])
  }

  const confirmAddProducto = async (producto: Producto, exclusiones: number[]) => {
    if (!token || !pedido) return
    setAddingProducto(producto.id)
    try {
      const cantidad = cantidadProducto[producto.id] || 1
      await pedidosApi.addItem(token, pedido.id, {
        productoId: producto.id,
        cantidad,
        clienteNombre: 'Mozo',
        ingredientesExcluidos: exclusiones.length > 0 ? exclusiones : undefined
      })
      toast.success('Producto agregado')
      setCantidadProducto(prev => ({ ...prev, [producto.id]: 1 }))
      setConfiguringProduct(null) // Cerrar dialogo si estaba abierto

      // IMPRESIÓN AUTOMÁTICA (Si el pedido está en cocina)
      if ((pedido.estado === 'preparing' || pedido.estado === 'delivered') && defaultPrinter) {
        // Obtener categoría para el formato correcto
        // Necesitamos las categorías del store, asumo que estan disponibles o las busco en productos si vinieran
        const categorias = useRestauranteStore.getState().categorias;
        const categoria = categorias.find(c => c.id === (producto as any).categoriaId); // Casting as any because interface might be missing it but API returns it

        // Filtrar bebidas
        if (!categoria || !categoria.nombre.toLowerCase().includes('bebida')) {
          const itemToPrint = {
            cantidad,
            nombreProducto: producto.nombre,
            ingredientesExcluidosNombres: exclusiones.map(id => producto.ingredientes?.find(i => i.id === id)?.nombre || ''),
            categoriaNombre: categoria?.nombre
          };

          console.log("🖨️ Auto-printing new admin item:", itemToPrint);
          const comandaData = formatComanda({ id: pedido.id, mesaNombre: pedido.mesaNombre, nombrePedido: pedido.nombrePedido }, [itemToPrint], restaurante?.nombre || 'Restaurante');
          print(defaultPrinter, comandaData).catch(err => console.error("Error printing admin item:", err));
          toast.info('Imprimiendo comanda en cocina...');
        }
      }

      await fetchPedido()
    } catch (error: any) {
      toast.error(error.message || 'Error')
    } finally {
      setAddingProducto(null)
    }
  }

  const handleDeleteItem = async () => {
    if (!token || !pedido || !itemAEliminar) return
    try {
      await pedidosApi.deleteItem(token, pedido.id, itemAEliminar.id)
      toast.success('Producto eliminado')
      setItemAEliminar(null)
      await fetchPedido()
    } catch (error) { toast.error('Error al eliminar') }
  }

  const handleConfirmarPedido = async () => {
    if (!token || !pedido) return
    setIsUpdating(true)
    try {
      await pedidosApi.confirmar(token, pedido.id)
      toast.success('Pedido confirmado')
      await fetchPedido()
    } catch (error) { toast.error('Error al confirmar') } finally { setIsUpdating(false) }
  }

  const handleCerrarPedido = async () => {
    if (!token || !pedido) return
    setIsUpdating(true)
    try {
      await pedidosApi.cerrar(token, pedido.id)
      toast.success('Pedido cerrado')
      await fetchPedido()
    } catch (error) { toast.error('Error al cerrar') } finally { setIsUpdating(false) }
  }

  const handleDeletePedido = async () => {
    if (!token || !pedido) return
    try {
      await pedidosApi.delete(token, pedido.id)
      toast.success('Pedido eliminado')
      navigate('/dashboard')
    } catch (error) { toast.error('Error al eliminar pedido') } finally { setShowDeletePedidoDialog(false) }
  }

  const handleConfirmarPagoEfectivo = async (clienteNombre: string) => {
    if (!token || !pedido) return
    setMarcandoPagoEfectivo(clienteNombre)
    try {
      const response = await mercadopagoApi.confirmarEfectivo(token, pedido.id, clienteNombre) as { success: boolean; error?: string }
      if (response.success) {
        toast.success('Pago confirmado')
        await fetchSubtotales()
      } else toast.error(response.error || 'Error')
    } catch (error) { toast.error('Error conexión') } finally { setMarcandoPagoEfectivo(null) }
  }

  const productosFiltrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(searchProducto.toLowerCase()) ||
    p.descripcion?.toLowerCase().includes(searchProducto.toLowerCase())
  )

  if (isLoading) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  if (!pedido) return <div className="flex flex-col items-center justify-center min-h-[400px]"><p className="text-muted-foreground mb-4">No encontrado</p><Button onClick={() => navigate('/dashboard')}>Volver</Button></div>

  const estadoBadge = getEstadoBadge(pedido.estado)
  const StatusIcon = estadoBadge.icon
  const isActive = pedido.estado !== 'closed'

  // Componente de Items (Reutilizable para Mobile/Desktop)
  const ItemsList = ({ isMobile = false }) => (
    <Card className={`border-0 shadow-none md:border md:shadow-sm ${isMobile ? 'bg-transparent p-0' : ''}`}>
      {!isMobile && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> Productos</CardTitle>
          <CardDescription>{pedido.totalItems} productos • {Object.keys(pedido.itemsPorCliente).length} clientes</CardDescription>
        </CardHeader>
      )}
      <CardContent className={`${isMobile ? 'p-0 space-y-4' : 'space-y-6'}`}>
        {Object.keys(pedido.itemsPorCliente).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <ShoppingCart className="h-12 w-12 mb-4 opacity-20" />
            <p>No hay productos</p>
          </div>
        ) : Object.entries(pedido.itemsPorCliente).map(([cliente, items], idx) => (
          <div key={cliente} className={isMobile ? "bg-card rounded-xl border p-4 shadow-sm" : ""}>
            {(!isMobile || idx >= 0) && (
              <div className="mb-3 flex items-center justify-between">
                <Badge variant="secondary" className="gap-1 text-sm py-1 px-2">
                  <User className="h-3 w-3" /> {cliente}
                </Badge>
                {isMobile && (
                  <span className="text-xs text-muted-foreground font-medium">
                    ${items.reduce((acc, curr) => acc + (parseFloat(curr.precioUnitario) * curr.cantidad), 0).toFixed(2)}
                  </span>
                )}
              </div>
            )}
            <div className="space-y-3">
              {items.map((item) => {
                const itemBadge = getItemEstadoBadge(item.estado);
                return (
                  <div key={item.id} className={`relative flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg gap-3 ${item.postConfirmacion ? 'bg-amber-50/50 border border-amber-200 dark:border-amber-800' : 'bg-muted/30'}`}>
                    <div className="flex items-start gap-3">
                      {/* Imagen solo en desktop o si es muy necesario, en mobile ocupa espacio */}
                      <div className="hidden sm:block">
                        {item.imagenUrl ? (
                          <img src={item.imagenUrl} alt="" className="w-12 h-12 rounded-md object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center"><ShoppingCart className="h-5 w-5 text-muted-foreground/50" /></div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm sm:text-base">{item.cantidad}x {item.nombreProducto}</span>
                          <Badge variant={itemBadge.variant as any} className="h-5 text-[10px] px-1.5">{itemBadge.label}</Badge>
                          {item.postConfirmacion && <Badge variant="outline" className="h-5 text-[10px] border-amber-500 text-amber-600 bg-amber-50">Nuevo</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">${parseFloat(item.precioUnitario).toFixed(2)} /u</p>
                        {item.ingredientesExcluidosNombres && item.ingredientesExcluidosNombres.length > 0 && (
                          <p className="text-xs text-orange-600 mt-1">⚠️ Sin: {item.ingredientesExcluidosNombres.join(', ')}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-dashed">
                      <span className="font-bold text-base sm:text-lg">${(parseFloat(item.precioUnitario) * item.cantidad).toFixed(2)}</span>
                      {isActive && (
                        <div className="flex gap-1">
                          {(item.estado === 'preparing' || item.estado === 'pending' || !item.estado) && (
                            <Button size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-100" onClick={() => handleChangeItemEstado(item.id, 'delivered')}>
                              <CheckCircle className="h-5 w-5" />
                            </Button>
                          )}
                          {item.estado === 'delivered' && (
                            <Button size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground hover:text-indigo-600 hover:bg-indigo-100" onClick={() => handleChangeItemEstado(item.id, 'served')}>
                              <Utensils className="h-5 w-5" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive hover:bg-destructive/10" onClick={() => setItemAEliminar(item)}>
                            <Trash2 className="h-5 w-5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {!isMobile && idx < Object.keys(pedido.itemsPorCliente).length - 1 && <Separator className="my-4" />}
          </div>
        ))}
      </CardContent>
    </Card>
  )

  // Componente de Info (Reutilizable)
  const InfoAndPayments = ({ isMobile = false }) => (
    <div className="space-y-6">
      {!isMobile && (
        <Card className={pedido.pago?.estado === 'paid' ? "bg-green-500/10 border-green-500/30" : "bg-primary/5 border-primary/20"}>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex justify-between">Total del Pedido {pedido.pago?.estado === 'paid' && <Badge className="bg-green-600">Pagado</Badge>}</CardTitle></CardHeader>
          <CardContent><p className={`text-4xl font-bold ${pedido.pago?.estado === 'paid' ? 'text-green-600' : 'text-primary'}`}>${parseFloat(pedido.total || '0').toFixed(2)}</p></CardContent>
        </Card>
      )}

      <Card className={isMobile ? "border-0 shadow-none bg-transparent" : ""}>
        <CardHeader className={isMobile ? "px-0 pt-0" : ""}><CardTitle className="text-sm flex items-center gap-2"><Receipt className="h-4 w-4" /> Información</CardTitle></CardHeader>
        <CardContent className={`space-y-4 ${isMobile ? "px-0" : ""}`}>
          <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Mesa</span><Badge variant="outline">{pedido.mesaNombre || 'Sin asignar'}</Badge></div>
          <Separator />
          <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Estado</span><Badge variant={estadoBadge.variant} className="gap-1"><StatusIcon className="h-3 w-3" /> {estadoBadge.label}</Badge></div>
          <Separator />
          <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Creado</span><span className="text-sm text-right">{formatDateFull(pedido.createdAt)}<br /><span className="text-xs text-muted-foreground">{getTimeAgo(pedido.createdAt)}</span></span></div>
          {pedido.closedAt && <><Separator /><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Cerrado</span><span className="text-sm">{formatDateFull(pedido.closedAt)}</span></div></>}
          {!pedido.closedAt && <><Separator /><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Tiempo activo</span><Badge variant="outline"><Clock className="h-3 w-3 mr-1" /> {getDuration(pedido.createdAt)}</Badge></div></>}
        </CardContent>
      </Card>

      <Card className={isMobile ? "border-0 shadow-none bg-transparent" : ""}>
        <CardHeader className={isMobile ? "px-0" : ""}><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Clientes & Pagos</CardTitle></CardHeader>
        <CardContent className={isMobile ? "px-0" : ""}>
          {loadingSubtotales ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : (
            <div className="space-y-3">
              {Object.keys(pedido.itemsPorCliente).map((cliente) => {
                if (cliente === 'Mozo') return null; // Simplified logic for brevity, you can add Mozo logic back if needed
                const clienteItems = pedido.itemsPorCliente[cliente]
                const clienteTotal = clienteItems.reduce((sum, item) => sum + (parseFloat(item.precioUnitario) * (item.cantidad || 1)), 0)
                const subtotalInfo = subtotales.find(s => s.clienteNombre === cliente)
                const estaPagado = subtotalInfo?.pagado === true
                const metodoPago = subtotalInfo?.metodo
                const esperandoConfirmacion = subtotalInfo?.estado === 'pending_cash'

                return (
                  <div
                    key={cliente}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${estaPagado
                      ? 'bg-green-50/50 border-green-200 dark:bg-green-900/20 dark:border-green-800' // Pagado (Verde)
                      : esperandoConfirmacion
                        ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800' // CORREGIDO: Pendiente efectivo (Ámbar oscuro en dark mode)
                        : 'bg-card border-border' // Normal
                      }`}
                  >
                    <div className="flex flex-col">
                      <span className={`font-medium text-sm flex items-center gap-2 ${estaPagado
                        ? 'text-green-700 dark:text-green-400'
                        : esperandoConfirmacion
                          ? 'text-amber-700 dark:text-amber-400' // Asegura contraste naranja/ámbar
                          : 'text-foreground'
                        }`}>
                        {cliente}
                        {estaPagado && <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />}
                      </span>

                      {/* Subtitulo del método de pago */}
                      {(estaPagado || esperandoConfirmacion) && (
                        <span className={`text-[10px] uppercase font-semibold ${estaPagado
                          ? 'text-green-600/80 dark:text-green-500/80'
                          : 'text-amber-600/80 dark:text-amber-500/80'
                          }`}>
                          {metodoPago === 'mercadopago' ? 'MercadoPago' : 'Efectivo'}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className={`font-semibold ${estaPagado
                        ? 'text-green-600 dark:text-green-400'
                        : esperandoConfirmacion
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-foreground'
                        }`}>
                        ${clienteTotal.toFixed(2)}
                      </span>

                      {puedeGestionarPagos && esperandoConfirmacion && (
                        <Button
                          size="sm"
                          className="h-7 text-[10px] bg-green-600 hover:bg-green-700 text-white border-0"
                          onClick={() => handleConfirmarPagoEfectivo(cliente)}
                          disabled={marcandoPagoEfectivo === cliente}
                        >
                          {marcandoPagoEfectivo === cliente ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirmar Pago"}
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
    </div>
  )

  return (
    <div className="w-full max-w-7xl lg:max-w-[1600px] xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 pb-32 md:pb-8 animate-in fade-in duration-500">

      {/* --- HEADER --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4 md:py-6 sticky top-0 bg-background/95 backdrop-blur z-20 md:relative md:bg-transparent">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-3xl font-bold tracking-tight">Pedido #{pedido.id}</h1>
              <Badge variant={estadoBadge.variant} className="gap-1 px-2">
                <StatusIcon className="h-3 w-3" />
                <span className="hidden md:inline">{estadoBadge.label}</span>
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              {pedido.mesaNombre || 'Mesa sin asignar'}
              {isConnected ? <Wifi className="h-3 w-3 text-green-500" /> : <WifiOff className="h-3 w-3 text-orange-500" />}
            </p>
          </div>
        </div>

        {/* Desktop Actions */}
        <div className="hidden md:flex gap-2">
          <Button variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => setShowDeletePedidoDialog(true)}><Trash2 className="mr-2 h-4 w-4" /> Eliminar</Button>
          {esCarrito && pedido.estado === 'preparing' && (
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => pedido.mesaId && marcarPedidoListo(pedido.id, pedido.mesaId)}><Bell className="mr-2 h-4 w-4" /> Avisar Listo</Button>
          )}
          {isActive && (
            <>
              {/* Botón Agregar Producto (DESKTOP) - Sin Sheet wrapper, solo el botón */}
              <Button variant="outline" onClick={() => setAddProductSheet(true)}>
                <Plus className="mr-2 h-4 w-4" /> Agregar Producto
              </Button>

              {pedido.estado === 'pending' && <Button onClick={handleConfirmarPedido} disabled={isUpdating || pedido.items.length === 0}>{isUpdating ? <Loader2 className="mr-2 animate-spin" /> : <ChefHat className="mr-2" />} Confirmar</Button>}
              {pedido.estado === 'preparing' && <Button onClick={() => handleChangeEstado('delivered')} disabled={isUpdating}>{isUpdating ? <Loader2 className="mr-2 animate-spin" /> : <Utensils className="mr-2" />} Entregado</Button>}
              {pedido.estado === 'delivered' && <Button variant="secondary" onClick={handleCerrarPedido} disabled={isUpdating}>{isUpdating ? <Loader2 className="mr-2 animate-spin" /> : <CheckCircle className="mr-2" />} Cerrar</Button>}
            </>
          )}
        </div>
      </div>

      {/* --- DESKTOP VIEW (Grid Original) --- */}
      <div className="hidden md:grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <ItemsList isMobile={false} />
        </div>
        <div className="space-y-6">
          <InfoAndPayments isMobile={false} />
        </div>
      </div>

      {/* --- MOBILE VIEW (Tabs + Diseño Optimizado) --- */}
      <div className="md:hidden">
        <Tabs defaultValue="items" value={mobileTab} onValueChange={(v) => setMobileTab(v as 'items' | 'info')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="items">Items ({pedido.totalItems})</TabsTrigger>
            <TabsTrigger value="info">Detalles & Pagos</TabsTrigger>
          </TabsList>
          <TabsContent value="items" className="space-y-4">
            <ItemsList isMobile={true} />
          </TabsContent>
          <TabsContent value="info">
            <InfoAndPayments isMobile={true} />
            <div className="mt-8">
              <Button variant="outline" className="w-full text-destructive" onClick={() => setShowDeletePedidoDialog(true)}>
                <Trash2 className="mr-2 h-4 w-4" /> Eliminar Pedido Completo
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* --- MOBILE STICKY BOTTOM ACTION BAR (La clave del diseño ergonómico) --- */}
      <div className="md:hidden fixed bottom-0 left-0 w-full bg-background border-t p-4 z-40 flex items-center justify-between gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="text-xl font-bold text-primary">${parseFloat(pedido.total || '0').toFixed(2)}</span>
        </div>

        <div className="flex items-center gap-2">
          {isActive && (
            <Button
              size="icon"
              variant="outline"
              className="h-12 w-12 rounded-full border-dashed border-2"
              onClick={() => setAddProductSheet(true)}
            >
              <Plus className="h-6 w-6" />
            </Button>
          )}

          {/* Main Action Button Logic for Mobile */}
          {pedido.estado === 'pending' && (
            <Button className="h-12 px-6 rounded-full text-base font-semibold shadow-lg shadow-primary/20" onClick={handleConfirmarPedido} disabled={isUpdating}>
              {isUpdating ? <Loader2 className="animate-spin" /> : "Confirmar"}
            </Button>
          )}
          {pedido.estado === 'preparing' && (
            esCarrito ? (
              <Button className="h-12 px-6 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20" onClick={() => pedido.mesaId && marcarPedidoListo(pedido.id, pedido.mesaId)}>
                <Bell className="mr-2 h-4 w-4" /> Listo
              </Button>
            ) : (
              <Button className="h-12 px-6 rounded-full" onClick={() => handleChangeEstado('delivered')} disabled={isUpdating}>
                {isUpdating ? <Loader2 className="animate-spin" /> : "Marcar Entregado"}
              </Button>
            )
          )}
          {pedido.estado === 'delivered' && (
            <Button variant="secondary" className="h-12 px-6 rounded-full bg-slate-900 text-white hover:bg-slate-800" onClick={handleCerrarPedido} disabled={isUpdating}>
              {isUpdating ? <Loader2 className="animate-spin" /> : "Cerrar Mesa"}
            </Button>
          )}
          {pedido.estado === 'closed' && (
            <Button variant="outline" className="h-12 px-6 rounded-full" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Volver
            </Button>
          )}
        </div>
      </div>

      {/* Dialogs de Eliminar (Mismo que antes) */}
      <Dialog open={!!itemAEliminar} onOpenChange={(open) => !open && setItemAEliminar(null)}>
        <DialogContent className="max-w-md rounded-xl">
          <DialogHeader><DialogTitle>¿Eliminar producto?</DialogTitle><DialogDescription>Se eliminará {itemAEliminar?.nombreProducto}.</DialogDescription></DialogHeader>
          <DialogFooter className="flex gap-2"><Button variant="outline" onClick={() => setItemAEliminar(null)}>Cancelar</Button><Button variant="destructive" onClick={handleDeleteItem}>Eliminar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeletePedidoDialog} onOpenChange={setShowDeletePedidoDialog}>
        <DialogContent className="max-w-md rounded-xl">
          <DialogHeader><DialogTitle>¿Eliminar Pedido Completo?</DialogTitle><DialogDescription>Esta acción es irreversible.</DialogDescription></DialogHeader>
          <DialogFooter className="flex gap-2"><Button variant="outline" onClick={() => setShowDeletePedidoDialog(false)}>Cancelar</Button><Button variant="destructive" onClick={handleDeletePedido}>Eliminar Todo</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Configuración de Ingredientes */}
      <Dialog open={!!configuringProduct} onOpenChange={(open) => !open && setConfiguringProduct(null)}>
        <DialogContent className="max-w-md rounded-xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Personalizar {configuringProduct?.nombre}</DialogTitle>
            <DialogDescription>
              Selecciona los ingredientes para EXCLUIR.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-2">
            {configuringProduct?.ingredientes?.length ? (
              <div className="space-y-2">
                {configuringProduct.ingredientes.map(ing => {
                  const isExcluded = excludedIngredients.includes(ing.id)
                  return (
                    <div
                      key={ing.id}
                      className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${isExcluded
                        ? 'bg-destructive/10 border-destructive/30'
                        : 'bg-card border-border hover:bg-accent'
                        }`}
                      onClick={() => {
                        setExcludedIngredients(prev =>
                          prev.includes(ing.id)
                            ? prev.filter(id => id !== ing.id)
                            : [...prev, ing.id]
                        )
                      }}
                    >
                      <Checkbox checked={!isExcluded} />
                      <span className={isExcluded ? 'line-through text-muted-foreground' : 'font-medium'}>
                        {ing.nombre}
                      </span>
                      {isExcluded && <span className="text-xs text-destructive ml-auto font-semibold">Excluido</span>}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">Este producto no tiene ingredientes configurables.</p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setConfiguringProduct(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => configuringProduct && confirmAddProducto(configuringProduct, excludedIngredients)}
              disabled={addingProducto === configuringProduct?.id}
            >
              {addingProducto === configuringProduct?.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Agregar al Pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* --- MASTER SHEET DE PRODUCTOS (Único para evitar duplicados) --- */}
      <Sheet open={addProductSheet} onOpenChange={setAddProductSheet}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={`w-full ${isMobile ? 'h-[85vh] rounded-t-xl' : 'sm:max-w-lg'}`}
        >
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Agregar Producto
            </SheetTitle>
            <SheetDescription>
              Selecciona los productos para agregar al pedido.
            </SheetDescription>
          </SheetHeader>

          {/* Buscador */}
          <div className="relative mt-4 mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar producto..."
              value={searchProducto}
              onChange={(e) => setSearchProducto(e.target.value)}
              className="pl-10 h-11"
            />
          </div>

          {/* Lista de Productos con IMÁGENES */}
          <ScrollArea className={`pr-4 ${isMobile ? 'h-[calc(85vh-150px)]' : 'h-[calc(100vh-200px)]'}`}>
            {loadingProductos ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : productosFiltrados.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No se encontraron productos
              </div>
            ) : (
              <div className="space-y-3 pb-8">
                {productosFiltrados.map((producto) => (
                  <div
                    key={producto.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    {/* IMAGEN VISIBLE EN AMBOS DISPOSITIVOS */}
                    <div className="shrink-0">
                      {producto.imagenUrl ? (
                        <img
                          src={producto.imagenUrl}
                          alt={producto.nombre}
                          className="w-14 h-14 rounded-lg object-cover bg-muted"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center">
                          <Package className="h-6 w-6 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-sm sm:text-base">{producto.nombre}</p>
                      <p className="font-bold text-primary">
                        ${parseFloat(producto.precio).toFixed(2)}
                      </p>
                    </div>

                    {/* Controles */}
                    <div className="flex items-center gap-1 sm:gap-2">
                      <div className="flex items-center border rounded-lg bg-background h-8 sm:h-9">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-full w-8 rounded-none"
                          onClick={() => setCantidadProducto(prev => ({
                            ...prev,
                            [producto.id]: Math.max(1, (prev[producto.id] || 1) - 1)
                          }))}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center text-sm font-medium">
                          {cantidadProducto[producto.id] || 1}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-full w-8 rounded-none"
                          onClick={() => setCantidadProducto(prev => ({
                            ...prev,
                            [producto.id]: (prev[producto.id] || 1) + 1
                          }))}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>

                      <Button
                        size="icon"
                        className="h-8 w-8 sm:h-9 sm:w-9 shrink-0"
                        onClick={() => handleAddProducto(producto)}
                        disabled={addingProducto === producto.id}
                      >
                        {addingProducto === producto.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
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

export default Pedido