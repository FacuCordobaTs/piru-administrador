import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { pedidoUnificadoApi } from '@/lib/api'
import { toast } from 'sonner'
import {
  Loader2, ArrowLeft, Trash2, Truck,
  Phone, XCircle, CheckCircle, MessageCircle
} from 'lucide-react'

const getMetodoPagoDisplay = (metodoPago: string | null | undefined) => {
  if (metodoPago === 'mercadopago' || metodoPago === 'mercadopago_checkout' || metodoPago === 'mercadopago_bricks') {
    return { name: metodoPago === 'mercadopago_checkout' ? 'MP Checkout' : 'Tarjeta (Bricks)', icon: '💳' }
  }
  if (metodoPago === 'transferencia' || metodoPago === 'transferencia_automatica_cucuru' || metodoPago === 'transferencia_automatica_talo') {
    return {
      name: metodoPago === 'transferencia_automatica_talo' ? 'Transf. auto (Talo)'
        : metodoPago === 'transferencia_automatica_cucuru' ? 'Transf. auto'
          : 'Transferencia',
      icon: '🏦'
    }
  }
  if (metodoPago === 'manual_transfer') return { name: 'Transf. manual', icon: '🏦' }
  if (metodoPago === 'cash' || metodoPago === 'efectivo') return { name: 'Efectivo', icon: '💵' }
  return { name: metodoPago || 'No especificado', icon: '💳' }
}

interface UnifiedPedidoItem {
  id: number
  productoId: number
  cantidad: number
  precioUnitario: string
  nombreProducto: string
  ingredientesExcluidosNombres?: string[]
  agregados?: any[]
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
  const adjustedDate = new Date(date.getTime() + 3 * 60 * 60 * 1000)
  const now = new Date()
  return Math.floor((now.getTime() - adjustedDate.getTime()) / 60000)
}

const formatTimeAgo = (dateString: string) => {
  const minutes = getMinutesAgo(dateString)
  if (minutes < 1) return 'ahora'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours}h ${minutes % 60}m`
  return new Date(dateString).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

const simplifyAddress = (address: string) => {
  if (!address) return ''
  const parts = address.split(',')
  const keptParts = []

  for (let part of parts) {
    const p = part.trim().toLowerCase()
    if (p === 'argentina' || p === 'santa fe' || p === 'santa fe de la vera cruz') continue
    if (/\b[a-z]\d{4}\b/i.test(p)) continue
    if (/\b\d{4}\b/.test(p) && p.includes('santa fe')) continue
    keptParts.push(part.trim())
  }

  return keptParts.join(', ') || address
}

export default function Pedido() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const token = useAuthStore((state) => state.token)
  const restauranteStore = useRestauranteStore()

  const getOrderDeliveryFee = (p: UnifiedPedido) => {
    const total = parseFloat(p.total)
    const itemsSubtotal = p.items.reduce((sum, item) => {
      const basePrice = parseFloat(item.precioUnitario || '0')
      let agregadosTotal = 0
      if (item.agregados && Array.isArray(item.agregados)) {
        item.agregados.forEach((ag: any) => {
          agregadosTotal += parseFloat(ag.precio || '0')
        })
      }
      return sum + ((basePrice + agregadosTotal) * item.cantidad)
    }, 0)
    return Math.max(0, Math.round((total - itemsSubtotal) * 100) / 100)
  }

  const [pedido, setPedido] = useState<UnifiedPedido | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [updatingPago, setUpdatingPago] = useState(false)
  const [assigningRapiboyId, setAssigningRapiboyId] = useState<number | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [sendingNotification, setSendingNotification] = useState(false)

  // Ajustar tema según el dispositivo del usuario
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }

    applyTheme(mediaQuery)
    mediaQuery.addEventListener('change', applyTheme)

    return () => mediaQuery.removeEventListener('change', applyTheme)
  }, [])

  const handleAsignarRapiboy = async () => {
    if (!token || !pedido) return
    setAssigningRapiboyId(pedido.id)
    try {
      const response = await pedidoUnificadoApi.asignarRapiboy(token, pedido.id) as { success: boolean; message: string }
      if (response.success) {
        toast.success('Cadete Rapiboy asignado')
        await fetchPedidoData()
      } else {
        toast.error(response.message || 'Error al asignar cadete')
      }
    } catch {
      toast.error('Error al contactar Rapiboy')
    } finally {
      setAssigningRapiboyId(null)
    }
  }

  const fetchPedidoData = useCallback(async () => {
    if (!token || !id) return
    setIsLoading(true)
    try {
      const res = await pedidoUnificadoApi.getById(token, Number(id)) as any
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
          montoDescuento: res.data.montoDescuento,
        })
      }
    } catch (e) {
      console.error('Error fetching pedido:', e)
    }
    setIsLoading(false)
  }, [id, token])

  useEffect(() => { fetchPedidoData() }, [fetchPedidoData])

  const handleUpdateEstado = async (nuevoEstado: string) => {
    if (!token || !pedido) return
    setIsUpdating(true)
    try {
      await pedidoUnificadoApi.updateEstado(token, pedido.id, nuevoEstado)
      toast.success('Pedido despachado')
      setPedido(prev => prev ? { ...prev, estado: nuevoEstado } : null)
    } catch {
      toast.error('Error al actualizar estado')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleTogglePagado = async (metodoPago: string) => {
    if (!token || !pedido) return
    setUpdatingPago(true)
    try {
      if (pedido.tipo === 'mesa') {
        toast.info('Para gestionar pagos de mesa, usá el dashboard viejo.')
      } else {
        const res = await pedidoUnificadoApi.marcarPagado(token, pedido.id, metodoPago) as any
        if (res.success) {
          toast.success('Pago confirmado')
          setPedido(prev => prev ? { ...prev, pagado: !prev.pagado, metodoPago } : null)
        }
      }
    } catch {
      toast.error('Error al procesar pago')
    } finally {
      setUpdatingPago(false)
    }
  }

  const handleDelete = async () => {
    if (!token || !pedido) return
    try {
      await pedidoUnificadoApi.delete(token, pedido.id)
      toast.success('Pedido eliminado')
      navigate('/dashboard')
    } catch {
      toast.error('Error al eliminar')
    }
  }

  const handleNotificarCliente = async () => {
    if (!token || !pedido) return
    setSendingNotification(true)
    try {
      const res: any = await pedidoUnificadoApi.notificarCliente(token, pedido.id)
      if (res.success) {
        toast.success('Mensaje de WhatsApp enviado al cliente')
      } else {
        toast.error(res.message || 'No se pudo enviar la notificación')
      }
    } catch {
      toast.error('Error al enviar la notificación')
    } finally {
      setSendingNotification(false)
    }
  }

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!pedido) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] gap-4">
        <XCircle className="h-10 w-10 text-muted-foreground opacity-20" />
        <p className="text-sm text-muted-foreground">Pedido no encontrado.</p>
        <Button onClick={() => navigate('/dashboard')} variant="ghost" size="sm">
          Volver al Dashboard
        </Button>
      </div>
    )
  }

  const isDelivery = pedido.tipo === 'delivery'
  const isTakeaway = pedido.tipo === 'takeaway'
  const finalTotal = parseFloat(pedido.total)
  const isArchived = pedido.estado === 'archived'

  const tipoLabel = isDelivery ? 'Delivery' : isTakeaway ? 'Take Away' : `Mesa ${pedido.mesaNombre || ''}`
  const tipoEmoji = isDelivery ? '🚚' : isTakeaway ? '🛍️' : '🍽️'

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full max-w-lg mx-auto px-5 pt-5 pb-40">

        {/* ── Top Nav ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2">
            {isArchived && (
              <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                Archivado
              </span>
            )}
            {pedido.pagado ? (
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Pagado
              </span>
            ) : (
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full">
                Sin cobrar
              </span>
            )}
          </div>
        </div>

        {/* ── Hero: Total + Cliente ────────────────────────────── */}
        <div className="text-center mb-10">
          <p className="text-sm text-muted-foreground mb-1">
            {tipoEmoji} {tipoLabel}
          </p>
          <p className="text-5xl font-bold tracking-tight mb-3">
            ${finalTotal.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
          </p>
          <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
            {isDelivery && pedido.direccion && (
              <span className="font-medium text-foreground text-center leading-snug max-w-xs">
                {simplifyAddress(pedido.direccion)}
              </span>
            )}
            <span className="text-xs text-muted-foreground/60 mt-0.5">
              {formatTimeAgo(pedido.createdAt)}
            </span>
          </div>
        </div>

        {/* ── Separador ───────────────────────────────────────── */}
        <div className="h-px bg-border/50 mb-8" />

        {/* ── Pago pendiente (solo si no pagado) ──────────────── */}
        {!pedido.pagado && (
          <div className="mb-8">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
              Confirmar pago
            </p>
            <div className="flex gap-2">
              {(!pedido.metodoPago || pedido.metodoPago === 'cash' || pedido.metodoPago === 'efectivo') && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-10 rounded-xl bg-transparent border-border/60 hover:bg-muted/50 text-sm"
                  onClick={() => handleTogglePagado('efectivo')}
                  disabled={updatingPago}
                >
                  {updatingPago ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <span className="mr-1.5">💵</span>}
                  Confirmar Efectivo
                </Button>
              )}
              {(!pedido.metodoPago || pedido.metodoPago === 'transferencia' || pedido.metodoPago === 'manual_transfer') && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-10 rounded-xl bg-transparent border-border/60 hover:bg-muted/50 text-sm"
                  onClick={() => handleTogglePagado('transferencia')}
                  disabled={updatingPago}
                >
                  {updatingPago ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <span className="mr-1.5">🏦</span>}
                  Confirmar Transferencia
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ── Datos de contacto extra (notas) ──────── */}
        {pedido.notas && (
          <div className="mb-8">
            <p className="text-sm text-muted-foreground italic leading-snug">
              📝 {pedido.notas}
            </p>
          </div>
        )}

        {/* ── Separador ───────────────────────────────────────── */}
        {(pedido.notas || !pedido.pagado) && (
          <div className="h-px bg-border/50 mb-8" />
        )}

        {/* ── Items ───────────────────────────────────────────── */}
        <div className="rounded-xl p-2 md:p-4">
          {pedido.items.map((item: any, idx: number) => {
            const basePrice = parseFloat(item.precioUnitario || '0')
            let agregadosTotal = 0
            if (item.agregados && Array.isArray(item.agregados)) {
              item.agregados.forEach((ag: any) => {
                agregadosTotal += parseFloat(ag.precio || '0')
              })
            }
            const lineTotal = (basePrice + agregadosTotal) * item.cantidad

            return (
              <div key={item.id} className={`flex items-baseline justify-between py-3 ${idx > 0 ? 'border-t border-border/40' : ''}`}>
                <div className="flex items-baseline gap-3 flex-1 min-w-0">
                  <span className="text-muted-foreground text-sm font-mono w-6 shrink-0">{item.cantidad}x</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm">{item.nombreProducto}</span>
                    {item.ingredientesExcluidosNombres && item.ingredientesExcluidosNombres.length > 0 && (
                      <p className="text-[11px] text-orange-500 mt-0.5">Sin: {item.ingredientesExcluidosNombres.join(', ')}</p>
                    )}
                    {item.agregados && Array.isArray(item.agregados) && item.agregados.map((ag: any, i: number) => (
                      <div key={i} className="flex items-baseline gap-1.5 mt-1.5">
                        <span className="text-[9px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                          Extra
                        </span>
                        <span className="text-xs font-medium text-foreground">
                          {ag.nombre}
                        </span>
                        {parseFloat(ag.precio || '0') > 0 && (
                          <span className="text-[11px] font-semibold text-emerald-600/90 dark:text-emerald-400/90 ml-1">
                            (+${parseFloat(ag.precio || '0').toLocaleString('es-AR', { minimumFractionDigits: 0 })})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <span className="text-sm font-medium tabular-nums shrink-0 ml-4">
                  ${lineTotal.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                </span>
              </div>
            )
          })}
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

        {/* ── Info Extra Abajo ─────────────────────────────────── */}
        <div className="mt-8 mb-4 p-4 rounded-2xl bg-muted/30 border border-border/40 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">ID Pedido</span>
            <span className="text-sm font-mono font-medium text-foreground">#{pedido.id}</span>
          </div>

          {pedido.nombreCliente && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Cliente</span>
              <span className="text-sm font-medium text-foreground">{pedido.nombreCliente}</span>
            </div>
          )}

          {pedido.telefono && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Teléfono</span>
              <a
                href={`tel:${pedido.telefono}`}
                className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-orange-500 transition-colors"
              >
                <Phone className="h-3.5 w-3.5" />
                {pedido.telefono}
              </a>
            </div>
          )}

          {pedido.pagado && pedido.metodoPago && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Método de pago</span>
              <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                {getMetodoPagoDisplay(pedido.metodoPago).icon} {getMetodoPagoDisplay(pedido.metodoPago).name}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Bar ──────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 w-full z-40">
        <div className="bg-background/90 backdrop-blur-xl border-t border-border/50 p-4 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
          <div className="max-w-xl mx-auto flex flex-col gap-3">

            <div className="flex items-end justify-between px-1 mb-1">
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
                {pedido.pagado ? 'Total cobrado' : 'Total a cobrar'}
              </span>
              <span className="text-3xl font-black tracking-tight text-foreground">
                ${finalTotal.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {isDelivery && restauranteStore.restaurante?.rapiboyToken && !isArchived && (
                <Button
                  variant="outline"
                  className="w-full h-12 rounded-2xl bg-secondary/50 border-border/50 text-secondary-foreground hover:bg-secondary hover:text-foreground font-semibold text-base transition-all"
                  onClick={handleAsignarRapiboy}
                  disabled={assigningRapiboyId === pedido.id}
                >
                  {assigningRapiboyId === pedido.id ? <Loader2 className="animate-spin mr-2" /> : <Truck className="h-4 w-4 mr-2" />}
                  Asignar Rapiboy
                </Button>
              )}

              {!isArchived ? (
                <div className="flex items-center gap-2">
                  {!showDeleteConfirm ? (
                    <>
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="h-14 w-14 rounded-2xl bg-secondary/30 border border-border/50 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30 transition-colors shrink-0"
                        title="Eliminar pedido"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                      {pedido.pagado && (
                        <Button
                          variant="outline"
                          onClick={handleNotificarCliente}
                          disabled={sendingNotification}
                          className="flex-1 h-14 rounded-2xl border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold active:scale-[0.98] transition-transform"
                        >
                          {sendingNotification
                            ? <Loader2 className="h-5 w-5 animate-spin mr-2" />
                            : <MessageCircle className="h-5 w-5 mr-2" />}
                          Avisar Cliente
                        </Button>
                      )}
                      <Button
                        className="flex-1 h-14 rounded-2xl bg-[#F97316] hover:bg-[#EA580C] text-white font-bold text-lg shadow-[0_0_20px_rgba(249,115,22,0.15)] transition-all active:scale-[0.98]"
                        onClick={() => handleUpdateEstado('archived')}
                        disabled={isUpdating}
                      >
                        {isUpdating ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : null}
                        {isUpdating ? 'Procesando...' : 'Despachar Pedido'}
                      </Button>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 w-full animate-in fade-in slide-in-from-bottom-2">
                      <Button
                        variant="outline"
                        className="flex-1 h-14 rounded-2xl bg-secondary/50 border-border/50 text-foreground hover:bg-secondary"
                        onClick={() => setShowDeleteConfirm(false)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1 h-14 rounded-2xl font-bold"
                        onClick={handleDelete}
                      >
                        Sí, eliminar
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full h-14 rounded-2xl bg-secondary/50 border-border/50 text-foreground hover:bg-secondary hover:text-foreground font-semibold text-base transition-all"
                  onClick={() => navigate('/dashboard')}
                >
                  Volver al Dashboard
                </Button>
              )}
            </div>

            {/* Timestamp sutil */}
            {!showDeleteConfirm && !isArchived && (
              <p className="text-center text-xs text-muted-foreground/40 mt-1 max-w-lg mx-auto">
                Recibido {formatTimeAgo(pedido.createdAt)}
              </p>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}

