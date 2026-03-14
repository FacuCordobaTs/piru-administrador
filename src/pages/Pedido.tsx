import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'

import { pedidosApi, deliveryApi, takeawayApi } from '@/lib/api'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, Archive, Trash2, Truck, MapPin, Phone, User, XCircle, CheckCircle } from 'lucide-react'

interface UnifiedPedidoItem {
  id: number
  productoId: number
  cantidad: number
  precioUnitario: string
  nombreProducto: string
  ingredientesExcluidosNombres?: string[]
}

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
  items: UnifiedPedidoItem[]
  totalItems: number
  pagado?: boolean
  metodoPago?: string | null
  rapiboyTrackingUrl?: string | null
}

const getMinutesAgo = (dateString: string) => {
  const date = new Date(dateString)
  // Adjusted for timezone if needed, as in Dashboard.tsx
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

export default function Pedido() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const token = useAuthStore((state) => state.token)
  const restauranteStore = useRestauranteStore()

  // Compute the per-order delivery fee from the stored total (which already includes it)
  const getOrderDeliveryFee = (p: UnifiedPedido) => {
    const total = parseFloat(p.total)
    const itemsSubtotal = p.items.reduce((sum, item) =>
      sum + (parseFloat(item.precioUnitario) * item.cantidad), 0
    )
    return Math.max(0, Math.round((total - itemsSubtotal) * 100) / 100)
  }

  const [pedido, setPedido] = useState<UnifiedPedido | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [updatingPago, setUpdatingPago] = useState<boolean>(false)
  const [assigningRapiboyId, setAssigningRapiboyId] = useState<number | null>(null)

  const handleAsignarRapiboy = async () => {
    if (!token || !pedido) return
    setAssigningRapiboyId(pedido.id)
    try {
      const response = await deliveryApi.asignarRapiboy(token, pedido.id) as {
        success: boolean;
        message: string;
      }
      if (response.success) {
        toast.success('Cadete Rapiboy asignado exitosamente')
        await fetchPedidoData() // Refresh pedido
      } else {
        toast.error(response.message || 'Error al asignar cadete')
      }
    } catch (error) {
      console.error('Error al asignar Rapiboy:', error)
      toast.error('Ocurrió un error al contactar con la API de Rapiboy')
    } finally {
      setAssigningRapiboyId(null)
    }
  }

  const fetchPedidoData = useCallback(async () => {
    if (!token || !id) return
    setIsLoading(true)

    let found: UnifiedPedido | null = null;
    let fallbackToMesa = true;

    // Intentar buscar como Delivery
    try {
      const resD = await deliveryApi.getById(token, Number(id)) as any;
      if (resD.success && resD.data) {
        found = {
          id: resD.data.id,
          tipo: 'delivery',
          estado: resD.data.estado,
          total: resD.data.total,
          createdAt: resD.data.createdAt,
          nombreCliente: resD.data.nombreCliente,
          telefono: resD.data.telefono,
          direccion: resD.data.direccion,
          notas: resD.data.notas,
          items: resD.data.items,
          totalItems: resD.data.totalItems,
          pagado: resD.data.pagado,
          metodoPago: resD.data.metodoPago,
          rapiboyTrackingUrl: resD.data.rapiboyTrackingUrl
        }
        fallbackToMesa = false;
      }
    } catch (e) { }

    // Intentar buscar como Takeaway si falla Delivery
    if (fallbackToMesa) {
      try {
        const resT = await takeawayApi.getById(token, Number(id)) as any;
        if (resT.success && resT.data) {
          found = {
            id: resT.data.id,
            tipo: 'takeaway',
            estado: resT.data.estado,
            total: resT.data.total,
            createdAt: resT.data.createdAt,
            nombreCliente: resT.data.nombreCliente,
            telefono: resT.data.telefono,
            notas: resT.data.notas,
            items: resT.data.items,
            totalItems: resT.data.totalItems,
            pagado: resT.data.pagado,
            metodoPago: resT.data.metodoPago
          }
          fallbackToMesa = false;
        }
      } catch (e) { }
    }

    // Intentar buscar como Mesa
    if (fallbackToMesa && !found) {
      try {
        const resM = await pedidosApi.getById(token, Number(id)) as any;
        if (resM.success && resM.data) {
          found = {
            id: resM.data.id,
            tipo: 'mesa',
            estado: resM.data.estado,
            total: resM.data.total,
            createdAt: resM.data.createdAt,
            mesaNombre: resM.data.mesaNombre,
            nombreCliente: resM.data.nombrePedido || 'Mesa',
            telefono: null,
            items: resM.data.items,
            totalItems: resM.data.totalItems,
            pagado: resM.data.pago?.estado === 'paid'
          }
        }
      } catch (e) { }
    }

    if (found) setPedido(found)
    setIsLoading(false)
  }, [id, token])

  useEffect(() => {
    fetchPedidoData()
  }, [fetchPedidoData])

  const handleUpdateEstado = async (nuevoEstado: string) => {
    if (!token || !pedido) return;
    setIsUpdating(true)
    try {
      if (pedido.tipo === 'delivery') await deliveryApi.updateEstado(token, pedido.id, nuevoEstado);
      else if (pedido.tipo === 'takeaway') await takeawayApi.updateEstado(token, pedido.id, nuevoEstado);
      else await pedidosApi.updateEstado(token, pedido.id, nuevoEstado);
      toast.success('Estado actualizado')
      setPedido(prev => prev ? { ...prev, estado: nuevoEstado } : null)
    } catch (error) {
      toast.error('Error al actualizar estado')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleTogglePagado = async (metodoPago: string) => {
    if (!token || !pedido) return;
    setUpdatingPago(true)
    try {
      if (pedido.tipo === 'delivery') {
        const res = await deliveryApi.marcarPagado(token, pedido.id, metodoPago) as any;
        if (res.success) {
          toast.success('Pago actualizado');
          setPedido(prev => prev ? { ...prev, pagado: !prev.pagado } : null);
        }
      } else if (pedido.tipo === 'takeaway') {
        const res = await takeawayApi.marcarPagado(token, pedido.id, metodoPago) as any;
        if (res.success) {
          toast.success('Pago actualizado');
          setPedido(prev => prev ? { ...prev, pagado: !prev.pagado } : null);
        }
      } else {
        toast.info("Para gestionar pagos de mesa, dirígete a las configuraciones manuales o mercadopago.");
      }
    } catch (error) {
      toast.error('Error al procesar pago')
    } finally {
      setUpdatingPago(false)
    }
  }

  const handleDelete = async () => {
    if (!token || !pedido) return;
    if (!confirm('¿Seguro que deseas eliminar este pedido?')) return;
    try {
      if (pedido.tipo === 'delivery') await deliveryApi.delete(token, pedido.id);
      else if (pedido.tipo === 'takeaway') await takeawayApi.delete(token, pedido.id);
      else await pedidosApi.delete(token, pedido.id);
      toast.success('Pedido eliminado')
      navigate('/dashboard')
    } catch (e) {
      toast.error('Error al eliminar')
    }
  }

  const handleArchive = async () => {
    await handleUpdateEstado('archived');
    navigate('/dashboard');
  }

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  if (!pedido) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] gap-4">
        <XCircle className="h-12 w-12 text-muted-foreground opacity-30" />
        <p className="text-muted-foreground">Pedido no encontrado.</p>
        <Button onClick={() => navigate('/dashboard')} variant="outline">Volver al Dashboard</Button>
      </div>
    )
  }

  const isDelivery = pedido.tipo === 'delivery'
  const isTakeaway = pedido.tipo === 'takeaway'
  const isMesa = pedido.tipo === 'mesa'

  const finalTotal = parseFloat(pedido.total);

  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10 animate-in fade-in pb-32">
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="-ml-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver al Dashboard
        </Button>
      </div>

      <div className="space-y-4 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl md:text-2xl font-bold truncate">
                {isDelivery && '🚚 Delivery'}
                {isTakeaway && '🛍️ Take Away'}
                {isMesa && `🍽️ Mesa ${pedido.mesaNombre || ''}`}
              </h2>
              {pedido.estado === 'archived' && (
                <Badge variant="outline" className="text-xs text-muted-foreground border-muted-foreground/30">Archivado</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap mt-1">
              <span>Pedido #{pedido.id}</span>
              <span>·</span>
              <span>{getDateLabel(pedido.createdAt)}, {new Date(pedido.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
              <span className="text-muted-foreground/60">({formatTimeAgo(pedido.createdAt)})</span>
            </p>
          </div>

          <div className="flex gap-2 shrink-0">
            {pedido.estado !== 'archived' && (
              <Button variant="outline" size="sm" onClick={handleArchive} className="hidden sm:flex text-muted-foreground hover:text-foreground">
                <Archive className="h-4 w-4 mr-2" /> Archivar
              </Button>
            )}
          </div>
        </div>

        {/* Banner Archivado */}
        {pedido.estado === 'archived' && (
          <div className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg p-4 flex items-center gap-3 mt-4">
            <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
              <Archive className="h-5 w-5 text-slate-500" />
            </div>
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-300">Pedido Archivado</p>
              <p className="text-sm text-slate-500">Este pedido ha sido archivado y no requiere más acciones.</p>
            </div>
          </div>
        )}

        {/* Client Info Card */}
        <Card className="shadow-sm border-0 border-border/40 bg-transparent mt-4">
          <CardContent className="py-4 px-2 space-y-2">
            {isDelivery && pedido.direccion && (
              <div className="flex items-center gap-2 text-xl font-bold">
                <MapPin className="h-5 w-5 text-muted-foreground shrink-0" />
                <span>{pedido.direccion}</span>
              </div>
            )}
            {pedido.nombreCliente && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{pedido.nombreCliente}</span>
              </div>
            )}
            {pedido.telefono && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{pedido.telefono}</span>
              </div>
            )}
            {pedido.notas && (
              <div className="flex items-start gap-2 mt-2 pt-2 text-muted-foreground">
                <span className="text-sm italic">📝 {pedido.notas}</span>
              </div>
            )}
            {!pedido.nombreCliente && !pedido.telefono && !pedido.direccion && !pedido.notas && (
              <p className="text-sm text-muted-foreground">Sin datos del cliente o notas asignadas</p>
            )}
          </CardContent>
        </Card>

        {/* Pedido Breakdown */}
        <div className="space-y-1 mt-6">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">Pedido</h3>
          <div className="rounded-xl p-2 md:p-4">
            {pedido.items.map((item: any, idx: number) => (
              <div key={item.id} className={`flex items-baseline justify-between py-3 ${idx > 0 ? 'border-t border-border/40' : ''}`}>
                <div className="flex items-baseline gap-3 flex-1 min-w-0">
                  <span className="text-muted-foreground text-sm font-mono w-6 shrink-0">{item.cantidad}x</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm">{item.nombreProducto}</span>
                    {item.ingredientesExcluidosNombres && item.ingredientesExcluidosNombres.length > 0 && (
                      <p className="text-[11px] text-orange-500 mt-0.5">Sin: {item.ingredientesExcluidosNombres.join(', ')}</p>
                    )}
                  </div>
                </div>
                <span className="text-sm font-medium tabular-nums shrink-0 ml-4">
                  ${(parseFloat(item.precioUnitario) * item.cantidad).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                </span>
              </div>
            ))}
            {isDelivery && pedido && getOrderDeliveryFee(pedido) > 0 && (
              <div className="flex items-baseline justify-between py-3 border-t border-border/40">
                <div className="flex items-baseline gap-3 flex-1 min-w-0">
                  <span className="text-muted-foreground text-sm font-mono w-6 shrink-0">1x</span>
                  <span className="text-sm flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5 text-foreground inline" />
                    Delivery
                  </span>
                </div>
                <span className="text-sm font-medium tabular-nums shrink-0 ml-4">
                  ${getOrderDeliveryFee(pedido).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 mt-2 border-t border-border">
              <span className="text-base font-medium">Total</span>
              <span className="text-xl font-bold tabular-nums">
                ${finalTotal.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </div>

        {/* Pago Info Section */}
        <div className="space-y-1 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Pago</h3>
            {pedido.pagado && (
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Pagado</span>
              </div>
            )}
          </div>

          {pedido.pagado ? (
            <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-muted/30 border border-border/40">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">{pedido.nombreCliente || (isDelivery ? 'Delivery' : 'Take Away')}</p>
                </div>
              </div>
              <span className="text-sm font-bold tabular-nums">
                ${finalTotal.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-3 w-full">
              {pedido.metodoPago && (
                <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-500 p-3 rounded-lg border border-amber-200 dark:border-amber-800/50 flex items-start gap-2 text-sm font-medium">
                  <span className="mt-0.5">⚠️</span>
                  <p>
                    El cliente seleccionó pagar con <strong>{pedido.metodoPago === 'efectivo' ? 'Efectivo' : pedido.metodoPago === 'transferencia' ? 'Transferencia' : pedido.metodoPago}</strong>. Por favor, confirmá la recepción del pago presionando el botón correspondiente.
                  </p>
                </div>
              )}
              <div className="flex gap-2 w-full">
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => handleTogglePagado('efectivo')}
                  disabled={updatingPago}
                >
                  {updatingPago ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <span className="mr-2">💵</span>}
                  Efectivo
                </Button>
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => handleTogglePagado('transferencia')}
                  disabled={updatingPago}
                >
                  {updatingPago ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <span className="mr-2">🏦</span>}
                  Transf.
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Action Bar Below the Pago area if active context, resembling Dashboard Mobile Style */}
      <div className="fixed bottom-0 left-0 w-full bg-background border-t p-4 z-40 flex items-center justify-between gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">Estado:</span>
          <span className={`text-sm font-bold ${pedido.estado === 'pending' ? 'text-amber-600' : 'text-primary'}`}>
            {pedido.estado === 'pending' && 'Por Preparar'}
            {pedido.estado === 'preparing' && 'En Cocina'}
            {pedido.estado === 'delivered' && 'Finalizado'}
            {pedido.estado === 'archived' && 'Archivado'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {pedido.estado !== 'archived' && (
            <Button size="icon" variant="outline" className="h-12 w-12 text-destructive mr-1 border-dashed" onClick={handleDelete} title="Eliminar Pedido">
              <Trash2 className="h-5 w-5" />
            </Button>
          )}

          {pedido.estado === 'pending' && (
            <Button className="h-12 px-6 rounded-full text-base shadow-lg shadow-primary/20" onClick={() => handleUpdateEstado('preparing')} disabled={isUpdating}>
              {isUpdating ? <Loader2 className="animate-spin" /> : "Empezar"}
            </Button>
          )}

          {pedido.estado === 'preparing' && (
            <Button className="h-12 px-6 rounded-full text-base bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20" onClick={() => handleUpdateEstado('delivered')} disabled={isUpdating}>
              {isUpdating ? <Loader2 className="animate-spin mr-2" /> : null} Listo
            </Button>
          )}

          {isDelivery && restauranteStore.restaurante?.rapiboyToken && pedido.estado !== 'archived' && pedido.estado !== 'delivered' && (
            <Button className="h-12 px-6 rounded-full text-base bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-600/20" onClick={handleAsignarRapiboy} disabled={assigningRapiboyId === pedido.id}>
              {assigningRapiboyId === pedido.id ? <Loader2 className="animate-spin mr-2" /> : <Truck className="h-4 w-4 mr-2" />}
              Asignar Rapiboy
            </Button>
          )}

          {pedido.estado === 'delivered' && (
            <Button variant="secondary" className="h-12 px-6 rounded-full bg-slate-900 text-white hover:bg-slate-800" onClick={handleArchive}>
              <Archive className="mr-2 h-4 w-4" /> Archivar
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}