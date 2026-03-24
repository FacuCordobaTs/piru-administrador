import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'

import { pedidoUnificadoApi } from '@/lib/api'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, Archive, Trash2, Truck, MapPin, Phone, User, XCircle, CheckCircle, Package } from 'lucide-react'

const getMetodoPagoDisplay = (metodoPago: string | null | undefined) => {
  if (
    metodoPago === 'mercadopago' ||
    metodoPago === 'mercadopago_checkout' ||
    metodoPago === 'mercadopago_bricks'
  ) {
    return { name: metodoPago === 'mercadopago_checkout' ? 'MP Checkout' : 'Tarjeta (Bricks)', icon: '💳' };
  }
  if (
    metodoPago === 'transferencia' ||
    metodoPago === 'transferencia_automatica_cucuru' ||
    metodoPago === 'transferencia_automatica_talo'
  ) {
    return { name: metodoPago === 'transferencia_automatica_talo' ? 'Transf. auto (Talo)' : metodoPago === 'transferencia_automatica_cucuru' ? 'Transf. auto' : 'Transferencia', icon: '🏦' };
  }
  if (metodoPago === 'manual_transfer') {
    return { name: 'Transf. manual', icon: '🏦' };
  }
  if (metodoPago === 'cash' || metodoPago === 'efectivo') {
    return { name: 'Efectivo', icon: '💵' };
  }
  return { name: metodoPago || 'No especificado', icon: '💳' };
};

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
  montoDescuento?: string | number | null
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
      const response = await pedidoUnificadoApi.asignarRapiboy(token, pedido.id) as {
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

    try {
      const res = await pedidoUnificadoApi.getById(token, Number(id)) as any;
      if (res.success && res.data) {
        setPedido({
          id: res.data.id,
          tipo: res.data.tipo,
          estado: res.data.estado,
          total: res.data.total,
          createdAt: res.data.createdAt,
          nombreCliente: res.data.nombreCliente,
          telefono: res.data.telefono,
          direccion: res.data.direccion,
          notas: res.data.notas,
          items: res.data.items,
          totalItems: res.data.totalItems,
          pagado: res.data.pagado,
          metodoPago: res.data.metodoPago,
          rapiboyTrackingUrl: res.data.rapiboyTrackingUrl,
          montoDescuento: res.data.montoDescuento
        })
      }
    } catch (e) {
      console.error('Error fetching pedido unificado:', e)
    }

    setIsLoading(false)
  }, [id, token])

  useEffect(() => {
    fetchPedidoData()
  }, [fetchPedidoData])

  const handleUpdateEstado = async (nuevoEstado: string) => {
    if (!token || !pedido) return;
    setIsUpdating(true)
    try {
      await pedidoUnificadoApi.updateEstado(token, pedido.id, nuevoEstado);
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
      if (pedido.tipo === 'mesa') {
        toast.info("Para gestionar pagos de mesa, usa el dashboard viejo.");
      } else {
        const res = await pedidoUnificadoApi.marcarPagado(token, pedido.id, metodoPago) as any;
        if (res.success) {
          toast.success('Pago actualizado');
          setPedido(prev => prev ? { ...prev, pagado: !prev.pagado, metodoPago } : null);
        }
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
      await pedidoUnificadoApi.delete(token, pedido.id);
      toast.success('Pedido eliminado')
      navigate('/dashboard')
    } catch (e) {
      toast.error('Error al eliminar')
    }
  }

  const handleArchive = async () => {
    await handleUpdateEstado('archived');
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
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap mt-1">
              <span>Pedido #{pedido.id}</span>
              <span>·</span>
              <span>{getDateLabel(pedido.createdAt)}, {new Date(pedido.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
              <span className="text-muted-foreground/60">({formatTimeAgo(pedido.createdAt)})</span>
            </p>
          </div>
        </div>

        {/* Banner Archivado */}
        {pedido.estado === 'archived' && (
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 w-fit px-3 py-1.5 rounded-md mt-2">
            <Archive className="h-4 w-4" />
            <span>Pedido Archivado</span>
          </div>
        )}


        {/* Pago Info Section */}
        <div className="space-y-3 mt-6">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Pago</h3>

          {pedido.pagado ? (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle className="h-4 w-4" />
                <span>Pagado {pedido.metodoPago ? `con ${getMetodoPagoDisplay(pedido.metodoPago).name}` : ''}</span>
              </div>
              <span className="font-bold tabular-nums">
                ${finalTotal.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {pedido.metodoPago && (
                <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-500">
                  <span className="text-base">⚠️</span>
                  <span>Aguardando pago por <strong>{getMetodoPagoDisplay(pedido.metodoPago).name}</strong></span>
                </div>
              )}
              <div className="flex gap-2 w-full">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 border-dashed bg-transparent hover:bg-muted/50"
                  onClick={() => handleTogglePagado('efectivo')}
                  disabled={updatingPago}
                >
                  {updatingPago ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <span className="mr-1.5">💵</span>}
                  Confirmar Efectivo
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 border-dashed bg-transparent hover:bg-muted/50"
                  onClick={() => handleTogglePagado('transferencia')}
                  disabled={updatingPago}
                >
                  {updatingPago ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <span className="mr-1.5">🏦</span>}
                  Confirmar Transf.
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Client Info Card */}
        <Card className="shadow-sm border-0 border-border/40 bg-transparent">
          <CardContent className="pb-4 px-2 space-y-2">
            {isDelivery && pedido.direccion && (
              <div className="flex items-center gap-2 font-bold">
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
            {(isDelivery || isTakeaway) && pedido.montoDescuento != null && parseFloat(String(pedido.montoDescuento)) > 0 && (
              <div className="flex items-baseline justify-between py-3 border-t border-border/40">
                <div className="flex items-baseline gap-3 flex-1 min-w-0">
                  <span className="text-muted-foreground text-sm font-mono w-6 shrink-0"></span>
                  <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Código de descuento</span>
                </div>
                <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium shrink-0 ml-4">
                  -${parseFloat(String(pedido.montoDescuento)).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
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
      </div>

      {/* Mobile Action Bar Below the Pago area if active context, resembling Dashboard Mobile Style */}
      <div className="fixed bottom-0 left-0 w-full bg-background border-t p-4 z-40 flex items-center justify-end gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <div className="flex items-center gap-2">
          {pedido.estado !== 'archived' && (
            <Button size="icon" variant="outline" className="h-12 w-12 text-destructive mr-1 border-dashed" onClick={handleDelete} title="Eliminar Pedido">
              <Trash2 className="h-5 w-5" />
            </Button>
          )}

          {isDelivery && restauranteStore.restaurante?.rapiboyToken && pedido.estado !== 'archived' && (
            <Button className="h-12 px-6 rounded-full text-base bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-600/20" onClick={handleAsignarRapiboy} disabled={assigningRapiboyId === pedido.id}>
              {assigningRapiboyId === pedido.id ? <Loader2 className="animate-spin mr-2" /> : <Truck className="h-4 w-4 mr-2" />}
              Asignar Rapiboy
            </Button>
          )}

          {pedido.estado !== 'archived' && (
            <Button className="h-12 px-6 rounded-full text-base bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20" onClick={handleArchive} disabled={isUpdating}>
              {isUpdating ? <Loader2 className="animate-spin mr-2" /> : <Package className="h-4 w-4 mr-2" />} Despachar
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}