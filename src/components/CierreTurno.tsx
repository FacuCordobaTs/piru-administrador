import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAuthStore } from '@/store/authStore'
import { pedidosApi, facturacionApi } from '@/lib/api'
import {
  X, Loader2, FileText, Search, ChevronDown, ArrowLeft,
  Truck, TrendingUp, Banknote, Smartphone, Landmark, Receipt, ShoppingBag, UtensilsCrossed
} from 'lucide-react'
import FacturacionBatchCierre from '@/components/FacturacionBatchCierre'
import { cn } from '@/lib/utils'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip
} from 'recharts'

/* ==========================================================================
   INTERFACES & TYPES
   ========================================================================== */
interface CierreTurnoItem { id: number; productoId: number; nombreProducto: string; cantidad: number; precioUnitario: string; clienteNombre?: string; estado?: string; agregados?: any }
interface CierreTurnoPedidoMesa { id: number; mesaId: number | null; nombrePedido: string | null; estado: string; total: string; createdAt: string; closedAt: string | null; mesaNombre: string | null; tipo: 'mesa'; items: CierreTurnoItem[]; totalItems: number; pagado?: boolean; metodoPago?: string | null; pagos?: any[]; pagosSubtotal?: any[] }
interface CierreTurnoPedidoDelivery { id: number; direccion: string; nombreCliente: string | null; telefono: string | null; estado: string; total: string; notas: string | null; createdAt: string; deliveredAt: string | null; tipo: 'delivery'; items: CierreTurnoItem[]; totalItems: number; pagado?: boolean; metodoPago?: string | null; montoDescuento?: string | null; deliveryFee?: string | null; repartidorId?: number | null; repartidorNombre?: string | null; afipFacturado?: boolean; afipCae?: string | null; afipNumeroComprobante?: number | null; afipPdfUrl?: string | null; anotadoManualmente?: boolean }
interface CierreTurnoPedidoTakeaway { id: number; nombreCliente: string | null; telefono: string | null; estado: string; total: string; notas: string | null; createdAt: string; deliveredAt: string | null; tipo: 'takeaway'; items: CierreTurnoItem[]; totalItems: number; pagado?: boolean; metodoPago?: string | null; montoDescuento?: string | null; afipFacturado?: boolean; afipCae?: string | null; afipNumeroComprobante?: number | null; afipPdfUrl?: string | null; anotadoManualmente?: boolean }
type CierreTurnoPedido = CierreTurnoPedidoMesa | CierreTurnoPedidoDelivery | CierreTurnoPedidoTakeaway

interface ProductoVendido { nombre: string; cantidad: number; totalVendido: number }
interface CierreTurnoData {
  fecha: string
  pedidosMesa: CierreTurnoPedidoMesa[]
  pedidosDelivery: CierreTurnoPedidoDelivery[]
  pedidosTakeaway: CierreTurnoPedidoTakeaway[]
  totales: { mesa: string; delivery: string; takeaway: string; general: string; manual?: string; web?: string }
  cantidades: { mesa: number; delivery: number; takeaway: number; total: number; manual?: number; web?: number }
  productosVendidos: ProductoVendido[]
  fechasDisponibles: string[]
}
interface CierreTurnoProps { open: boolean; onClose: () => void }

/* ==========================================================================
   HELPERS
   ========================================================================== */
const formatTime = (dateString: string) => {
  const date = new Date(dateString)
  date.setHours(date.getHours() + 3)
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
}
const formatDateLabel = (dateString: string) => {
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
  if (date.getTime() === today.getTime()) return 'Hoy'
  if (date.getTime() === yesterday.getTime()) return 'Ayer'
  return date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

/* ==========================================================================
   DASHBOARD MÉTRICAS
   ========================================================================== */
interface DashboardMetricasProps {
  total: number
  pagos: { efectivo: number; mercadopago: number; transferencia: number }
  pedidosTotal: number
  pedidosPagados: number
  fechaLabel: string
  onDateClick: () => void
}

function PaymentCard({ label, amount, icon: Icon }: { label: string; amount: number; icon: React.ElementType }) {
  const isZero = amount === 0
  return (
    <div className={cn('flex-1 flex flex-col gap-4 px-5 py-5 rounded-xl bg-muted', isZero ? 'opacity-40' : '')}>
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm font-bold text-foreground">{label}</p>
      </div>
      <p className="text-2xl font-extrabold text-foreground leading-none">
        ${amount.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </p>
    </div>
  )
}

function DashboardMetricas({ total, pagos, pedidosTotal, pedidosPagados, fechaLabel, onDateClick }: DashboardMetricasProps) {
  const pedidosPendientes = pedidosTotal - pedidosPagados
  const intPart = Math.floor(total)
  const decPart = (total % 1).toFixed(2).split('.')[1]

  return (
    <div className="space-y-10">
      <div className="text-center">
        <button
          onClick={onDateClick}
          className="inline-flex items-center gap-1.5 text-xs mb-1 px-3 py-1.5 rounded-full bg-muted hover:bg-muted/70 transition-colors text-muted-foreground hover:text-foreground"
        >
          {fechaLabel}
          <ChevronDown className="h-3 w-3" />
        </button>
        <p className="text-xs font-bold mb-4 text-foreground uppercase tracking-widest">Total</p>
        <h2 className="text-6xl sm:text-8xl font-bold tracking-tight leading-none text-foreground">
          ${intPart.toLocaleString('es-AR')}
          <span className="text-3xl font-normal text-muted-foreground/50">,{decPart}</span>
        </h2>
        {pedidosPendientes > 0 && (
          <p className="mt-3 text-sm" style={{ color: '#FF7A00' }}>
            {pedidosPendientes} {pedidosPendientes === 1 ? 'orden pendiente de cobro' : 'órdenes pendientes de cobro'}
          </p>
        )}
      </div>

      <div>
        <div className="flex gap-3">
          <PaymentCard label="Efectivo" amount={pagos.efectivo} icon={Banknote} />
          <PaymentCard label="Mercado Pago" amount={pagos.mercadopago} icon={Smartphone} />
          <PaymentCard label="Transferencia" amount={pagos.transferencia} icon={Landmark} />
        </div>
      </div>
    </div>
  )
}

/* ==========================================================================
   PEDIDO CARD COMPONENT
   ========================================================================== */
interface PedidoCardProps {
  pedido: CierreTurnoPedido
  isOpen: boolean
  onToggle: (key: string) => void
}

function PedidoCard({ pedido, isOpen, onToggle }: PedidoCardProps) {
  const key = `${pedido.tipo}-${pedido.id}`
  const token = useAuthStore(s => s.token)
  const [pdfLoading, setPdfLoading] = useState(false)

  const handleVerFactura = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!token) return
    setPdfLoading(true)
    try {
      const res: any = await facturacionApi.getPdfUrl(token, pedido.id)
      if (res.success && res.url) window.open(res.url, '_blank')
    } catch { }
    finally { setPdfLoading(false) }
  }

  const getMetodoPagoIcons = (): React.ElementType[] => {
    const mapIcon = (raw: string | null | undefined): React.ElementType | null => {
      if (!raw) return null
      const low = raw.toLowerCase()
      if (low === 'efectivo' || low === 'cash') return Banknote
      if (low.includes('mercadopago')) return Smartphone
      if (low.includes('transfer')) return Landmark
      return null
    }
    if (!pedido.pagado) return []
    if (pedido.tipo === 'mesa') {
      const mesaP = pedido as CierreTurnoPedidoMesa
      const paidSub = mesaP.pagosSubtotal?.filter((ps: any) => ps.estado === 'paid') || []
      const paidBase = mesaP.pagos?.filter((pg: any) => pg.estado === 'paid') || []
      const methods = paidSub.length > 0 ? paidSub.map((ps: any) => ps.metodo)
        : paidBase.length > 0 ? paidBase.map((pg: any) => pg.metodo)
        : mesaP.metodoPago ? [mesaP.metodoPago] : []
      return [...new Set(methods.map(mapIcon).filter(Boolean))] as React.ElementType[]
    }
    const icon = mapIcon(pedido.metodoPago)
    return icon ? [icon] : []
  }

  const itemSubtotal = (it: CierreTurnoItem) => {
    const unit = parseFloat(it.precioUnitario || '0')
    return unit * (it.cantidad || 1)
  }

  const sumItems = pedido.items.reduce((acc, it) => acc + itemSubtotal(it), 0)
  const montoDescuento = (pedido.tipo === 'delivery' || pedido.tipo === 'takeaway')
    ? parseFloat(String((pedido as CierreTurnoPedidoDelivery | CierreTurnoPedidoTakeaway).montoDescuento ?? 0)) || 0
    : 0
  const dynamicDeliveryFee = pedido.tipo === 'delivery' ? Math.max(0, parseFloat(pedido.total) + montoDescuento - sumItems) : 0

  const groups: { cliente: string; items: CierreTurnoItem[] }[] = (() => {
    const map = new Map<string, CierreTurnoItem[]>()
    const defaultCliente = (pedido.tipo === 'delivery' || pedido.tipo === 'takeaway')
      ? (pedido.tipo === 'delivery' ? (pedido as CierreTurnoPedidoDelivery).nombreCliente || 'Delivery' : (pedido as CierreTurnoPedidoTakeaway).nombreCliente || 'Takeaway')
      : ''

    pedido.items.forEach(it => {
      const cliente = (it.clienteNombre && it.clienteNombre.trim()) ? it.clienteNombre.trim() : defaultCliente
      if (!map.has(cliente)) map.set(cliente, [])
      map.get(cliente)!.push(it)
    })

    if (pedido.tipo === 'delivery') {
      const envioItem: CierreTurnoItem = {
        id: -1,
        productoId: -1,
        nombreProducto: dynamicDeliveryFee > 0.01 ? 'Envío' : 'Envío GRATIS',
        cantidad: 1,
        precioUnitario: String(dynamicDeliveryFee),
        clienteNombre: undefined,
        estado: undefined
      }
      if (!map.has(defaultCliente)) map.set(defaultCliente, [])
      map.get(defaultCliente)!.push(envioItem)
    }

    if (map.size === 1 && map.has(defaultCliente)) {
      return [{ cliente: defaultCliente || 'Items', items: map.get(defaultCliente)! }]
    }
    const arr: { cliente: string; items: CierreTurnoItem[] }[] = []
    map.forEach((items, cliente) => {
      arr.push({ cliente: cliente === '' ? 'Sin nombre' : cliente, items })
    })
    return arr
  })()

  const totalConEnvio = pedido.tipo === 'delivery'
    ? sumItems + dynamicDeliveryFee - montoDescuento
    : parseFloat(pedido.total)

  const renderAgregadosUI = (agregadosRaw: any) => {
    if (!agregadosRaw) return null
    let arr: any[] = []
    if (typeof agregadosRaw === 'string') {
      try { arr = JSON.parse(agregadosRaw) } catch (e) { }
    } else if (Array.isArray(agregadosRaw)) {
      arr = agregadosRaw
    }
    if (arr.length === 0) return null
    return (
      <div className="mt-0.5 flex flex-col gap-0.5">
        {arr.map((ag: any, idx: number) => (
          <span key={idx} className="text-xs text-muted-foreground/60">
            + {ag.nombre} (${parseFloat(ag.precio).toLocaleString('es-AR')})
          </span>
        ))}
      </div>
    )
  }

  const pedidoLabel = pedido.tipo === 'mesa'
    ? (pedido as CierreTurnoPedidoMesa).mesaNombre || 'Mesa'
    : pedido.tipo === 'delivery'
      ? (pedido as CierreTurnoPedidoDelivery).nombreCliente || 'Delivery'
      : (pedido as CierreTurnoPedidoTakeaway).nombreCliente || 'Takeaway'

  const hasFactura = pedido.tipo !== 'mesa' && (pedido as CierreTurnoPedidoDelivery | CierreTurnoPedidoTakeaway).afipFacturado

  return (
    <div className="rounded-lg bg-muted/40">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/60 transition-colors rounded-lg"
        onClick={() => onToggle(key)}
      >
        <span className="w-6 shrink-0 flex items-center justify-center text-muted-foreground/40">
          {pedido.tipo === 'mesa'
            ? <UtensilsCrossed className="h-3.5 w-3.5" />
            : pedido.tipo === 'delivery'
              ? <Truck className="h-3.5 w-3.5" />
              : <ShoppingBag className="h-3.5 w-3.5" />}
        </span>
        <span className="text-sm font-medium flex-1 truncate text-foreground">{pedidoLabel}</span>
        {pedido.tipo !== 'mesa' && (pedido as CierreTurnoPedidoDelivery | CierreTurnoPedidoTakeaway).anotadoManualmente && (
          <span className="text-[10px] shrink-0 px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 font-semibold">Manual</span>
        )}
        {!pedido.pagado && (
          <span className="text-xs shrink-0 text-orange-500">Pendiente</span>
        )}
        {hasFactura && (
          <button
            onClick={handleVerFactura}
            disabled={pdfLoading}
            className="flex items-center gap-1 text-xs shrink-0 transition-opacity hover:opacity-70 disabled:opacity-30 text-muted-foreground/60"
          >
            {pdfLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
            Factura
          </button>
        )}
        <span className="text-sm font-semibold text-foreground shrink-0">
          ${totalConEnvio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
        </span>
        {pedido.pagado && (
          <div className="flex items-center gap-0.5 shrink-0">
            {getMetodoPagoIcons().map((Icon, i) => <Icon key={i} className="h-3.5 w-3.5 text-foreground" />)}
          </div>
        )}
        <span className="text-xs text-muted-foreground/50 w-10 text-right shrink-0">{formatTime(pedido.createdAt)}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground/40 transition-transform shrink-0', isOpen && 'rotate-180')} />
      </div>

      {isOpen && (
        <div className="px-4 pb-4 pt-1 space-y-6">
          {groups.map((grp, gi) => (
            <div key={`${key}-grp-${gi}`}>
              {groups.length > 1 && (
                <p className="text-xs mb-2 text-muted-foreground">{grp.cliente}</p>
              )}
              <div>
                {grp.items.map((it) => (
                  <div key={it.id} className="flex items-start justify-between py-1.5">
                    <div className="flex-1 min-w-0 pr-6">
                      <span className="text-sm text-muted-foreground">
                        {it.nombreProducto || `Producto #${it.productoId}`}
                      </span>
                      {it.estado && (
                        <div className="text-xs mt-0.5 text-muted-foreground/60">{it.estado}</div>
                      )}
                      {renderAgregadosUI(it.agregados)}
                    </div>
                    <div className="flex items-start gap-6 shrink-0">
                      <span className="text-sm w-24 text-right text-foreground/70">
                        ${itemSubtotal(it).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ))}
                <div className="h-px bg-border/50 my-1" />
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-sm font-semibold text-foreground">Total</span>
                  <span className="text-sm font-semibold text-foreground">
                    ${grp.items.reduce((s, it) => s + itemSubtotal(it), 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ==========================================================================
   HOURLY CHART
   ========================================================================== */
function HourlyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-background border border-border rounded-xl px-3.5 py-2.5 shadow-xl space-y-1.5">
      <p className="text-xs font-semibold text-foreground">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: entry.color }} />
          <span className="text-muted-foreground">
            {entry.dataKey === 'orders' ? 'Pedidos' : 'Facturado'}:
          </span>
          <span className="font-semibold text-foreground">
            {entry.dataKey === 'orders'
              ? entry.value
              : `$${Number(entry.value).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`}
          </span>
        </div>
      ))}
    </div>
  )
}

function HourlyChart({ pedidos }: { pedidos: CierreTurnoPedido[] }) {
  const data = useMemo(() => {
    const buckets: Record<number, { orders: number; total: number }> = {}
    pedidos.forEach(p => {
      const date = new Date(p.createdAt)
      date.setHours(date.getHours() + 3)
      const hour = date.getHours()
      if (!buckets[hour]) buckets[hour] = { orders: 0, total: 0 }
      buckets[hour].orders++
      buckets[hour].total += parseFloat(p.total) || 0
    })
    const hours = Object.keys(buckets).map(Number).sort((a, b) => a - b)
    if (!hours.length) return []
    const minHour = Math.max(0, hours[0] - 1)
    const maxHour = Math.min(23, hours[hours.length - 1] + 1)
    const result = []
    for (let h = minHour; h <= maxHour; h++) {
      result.push({
        hour: `${String(h).padStart(2, '0')}h`,
        orders: buckets[h]?.orders ?? 0,
        total: Math.round(buckets[h]?.total ?? 0),
      })
    }
    return result
  }, [pedidos])

  if (data.length < 2) return null

  const maxTotal = Math.max(...data.map(d => d.total))
  const fmtTotal = (v: number) => {
    if (maxTotal >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
    if (maxTotal >= 1_000) return `$${(v / 1_000).toFixed(0)}k`
    return `$${v}`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-foreground">Actividad por hora</p>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-0.5 bg-foreground rounded-full" />
            <span className="text-xs text-muted-foreground">Pedidos</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-0.5 rounded-full" style={{ background: '#FF7A00' }} />
            <span className="text-xs text-muted-foreground">Facturado</span>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="4 4"
            stroke="currentColor"
            strokeOpacity={0.08}
            vertical={false}
          />
          <XAxis
            dataKey="hour"
            tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.4 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="orders"
            orientation="left"
            tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.4 }}
            axisLine={false}
            tickLine={false}
            width={22}
            allowDecimals={false}
          />
          <YAxis
            yAxisId="total"
            orientation="right"
            tick={{ fontSize: 11, fill: '#FF7A00', opacity: 0.7 }}
            axisLine={false}
            tickLine={false}
            width={46}
            tickFormatter={fmtTotal}
          />
          <Tooltip content={<HourlyTooltip />} cursor={{ stroke: 'currentColor', strokeOpacity: 0.12, strokeWidth: 1 }} />
          <Line
            yAxisId="orders"
            type="monotone"
            dataKey="orders"
            stroke="currentColor"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
            animationDuration={1000}
            animationEasing="ease-out"
          />
          <Line
            yAxisId="total"
            type="monotone"
            dataKey="total"
            stroke="#FF7A00"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#FF7A00', strokeWidth: 0 }}
            animationDuration={1300}
            animationEasing="ease-out"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ==========================================================================
   MAIN COMPONENT
   ========================================================================== */
export default function CierreTurnoSimple({ open, onClose }: CierreTurnoProps) {
  const token = useAuthStore(s => s.token)
  const [data, setData] = useState<CierreTurnoData | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedFecha, setSelectedFecha] = useState<string>('')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [filterTipo, setFilterTipo] = useState<'takeaway' | 'delivery' | null>(null)
  const [filterOrigen, setFilterOrigen] = useState<'manual' | 'web' | null>(null)
  const [afipHabilitado, setAfipHabilitado] = useState(false)
  const [activeModal, setActiveModal] = useState<'facturacion' | 'envios' | 'ranking' | null>(null)
  const [showDateModal, setShowDateModal] = useState(false)

  const fetchCierreTurno = useCallback(async (fecha?: string) => {
    if (!token) return
    setLoading(true)
    try {
      const res = await pedidosApi.cierreTurno(token, fecha) as { success: boolean; data: CierreTurnoData }
      if (res.success) {
        setData(res.data)
        if (!selectedFecha) setSelectedFecha(res.data.fecha)
      }
    } catch (e) {
      console.error(e)
    } finally { setLoading(false) }
  }, [token, selectedFecha])

  useEffect(() => {
    if (!open) return
    setQuery(''); setExpanded(new Set()); setSelectedFecha(''); setFilterTipo(null); setFilterOrigen(null)
    fetchCierreTurno()
    if (token) {
      facturacionApi.getEstado(token)
        .then((res: any) => { if (res.success) setAfipHabilitado(res.data.habilitado) })
        .catch(() => { })
    }
  }, [open])

  const toggle = (k: string) => {
    setExpanded(prev => { const next = new Set(prev); next.has(k) ? next.delete(k) : next.add(k); return next })
  }

  const allPedidos = useMemo<CierreTurnoPedido[]>(() => {
    if (!data) return []
    return [...data.pedidosMesa.filter(p => p.totalItems > 0), ...data.pedidosDelivery, ...data.pedidosTakeaway]
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
  }, [data])

  const filtered = useMemo(() => {
    let result = allPedidos
    if (filterTipo) result = result.filter(p => p.tipo === filterTipo)
    if (filterOrigen) {
      result = result.filter(p => {
        const manual = (p.tipo !== 'mesa') && (p as CierreTurnoPedidoDelivery | CierreTurnoPedidoTakeaway).anotadoManualmente === true
        return filterOrigen === 'manual' ? manual : !manual
      })
    }
    if (!query) return result
    const q = query.toLowerCase()
    return result.filter(p => {
      const label = p.tipo === 'mesa' ? (p as CierreTurnoPedidoMesa).mesaNombre || '' :
        p.tipo === 'delivery' ? (p as CierreTurnoPedidoDelivery).nombreCliente || '' :
          (p as CierreTurnoPedidoTakeaway).nombreCliente || ''
      if (label.toLowerCase().includes(q)) return true
      return p.items.some(i => (i.nombreProducto || '').toLowerCase().includes(q))
    })
  }, [allPedidos, query, filterTipo, filterOrigen])

  const allExpanded = filtered.length > 0 && filtered.every(p => expanded.has(`${p.tipo}-${p.id}`))

  const toggleAll = () => {
    if (allExpanded) {
      setExpanded(new Set())
    } else {
      setExpanded(new Set(filtered.map(p => `${p.tipo}-${p.id}`)))
    }
  }

  const total = useMemo(() => data ? parseFloat(data.totales.general) : 0, [data])

  // Diferenciación origen: pedidos anotados manualmente (POS local, sin comisión) vs tomados por la web
  const origenStats = useMemo(() => {
    const esManual = (p: CierreTurnoPedido) =>
      p.tipo !== 'mesa' && (p as CierreTurnoPedidoDelivery | CierreTurnoPedidoTakeaway).anotadoManualmente === true
    const manualPedidos = allPedidos.filter(esManual)
    const webPedidos = allPedidos.filter(p => !esManual(p))
    const sum = (arr: CierreTurnoPedido[]) => arr.reduce((s, p) => s + (parseFloat(p.total) || 0), 0)
    return {
      manualTotal: data?.totales.manual != null ? parseFloat(data.totales.manual) : sum(manualPedidos),
      webTotal: data?.totales.web != null ? parseFloat(data.totales.web) : sum(webPedidos),
      manualCount: data?.cantidades.manual ?? manualPedidos.length,
      webCount: data?.cantidades.web ?? webPedidos.length,
    }
  }, [allPedidos, data])

  const pagosDesglosados = useMemo(() => {
    const res = { efectivo: 0, mercadopago: 0, transferencia: 0 };
    if (!data) return res;

    allPedidos.forEach(p => {
      const baseMonto = parseFloat(p.total);

      const mapMetodo = (raw: string | null | undefined) => {
        if (!raw) return null;
        const low = raw.toLowerCase();
        if (low === 'efectivo' || low === 'cash') return 'efectivo';
        if (low.includes('mercadopago') || low === 'mercadopago') return 'mercadopago';
        if (low.includes('transfer') || low === 'transferencia') return 'transferencia';
        return null;
      };

      if (p.tipo === 'mesa') {
        const mesaP = p as CierreTurnoPedidoMesa;
        const paidSub = mesaP.pagosSubtotal?.filter(ps => ps.estado === 'paid') || [];
        const paidBase = mesaP.pagos?.filter(pg => pg.estado === 'paid') || [];

        if (paidSub.length > 0) {
          paidSub.forEach(ps => {
            const mapped = mapMetodo(ps.metodo);
            if (mapped === 'efectivo') res.efectivo += parseFloat(ps.monto);
            if (mapped === 'mercadopago') res.mercadopago += parseFloat(ps.monto);
            if (mapped === 'transferencia') res.transferencia += parseFloat(ps.monto);
          })
        } else if (paidBase.length > 0) {
          paidBase.forEach(pg => {
            const mapped = mapMetodo(pg.metodo);
            if (mapped === 'efectivo') res.efectivo += parseFloat(pg.monto);
            if (mapped === 'mercadopago') res.mercadopago += parseFloat(pg.monto);
            if (mapped === 'transferencia') res.transferencia += parseFloat(pg.monto);
          })
        } else if (mesaP.pagado && mesaP.metodoPago) {
          const mapped = mapMetodo(mesaP.metodoPago);
          if (mapped === 'efectivo') res.efectivo += baseMonto;
          if (mapped === 'mercadopago') res.mercadopago += baseMonto;
          if (mapped === 'transferencia') res.transferencia += baseMonto;
        }
      } else {
        if (p.pagado && p.metodoPago) {
          const mapped = mapMetodo(p.metodoPago);
          if (mapped === 'efectivo') res.efectivo += baseMonto;
          if (mapped === 'mercadopago') res.mercadopago += baseMonto;
          if (mapped === 'transferencia') res.transferencia += baseMonto;
        }
      }
    })
    return res;
  }, [allPedidos, data])

  const topProducts = useMemo(() => {
    if (!data) return []
    return data.productosVendidos.filter(p => !p.nombre.startsWith('[Extra]') && !p.nombre.startsWith('Envío') && p.nombre !== 'Delivery')
  }, [data])

  const repartidorStats = useMemo(() => {
    if (!data) return { totalDeliveryFee: 0, porRepartidor: [] as { nombre: string; cantidad: number; totalFee: number }[], sinAsignar: 0 }
    const map = new Map<string, { nombre: string; cantidad: number; totalFee: number }>()
    let sinAsignar = 0
    let totalDeliveryFee = 0
    data.pedidosDelivery.forEach(p => {
      const fee = parseFloat(String(p.deliveryFee ?? 0)) || 0
      totalDeliveryFee += fee
      if (p.repartidorNombre) {
        const key = p.repartidorNombre
        const existing = map.get(key)
        if (existing) {
          existing.cantidad++
          existing.totalFee += fee
        } else {
          map.set(key, { nombre: p.repartidorNombre, cantidad: 1, totalFee: fee })
        }
      } else {
        sinAsignar++
      }
    })
    return {
      totalDeliveryFee,
      porRepartidor: Array.from(map.values()).sort((a, b) => b.cantidad - a.cantidad),
      sinAsignar,
    }
  }, [data])

  const groupedFechas = useMemo(() => {
    if (!data?.fechasDisponibles) return []
    const groups = new Map<string, string[]>()
    data.fechasDisponibles.forEach(f => {
      const [year, month] = f.split('-')
      const key = `${year}-${month}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(f)
    })
    return Array.from(groups.entries()).map(([key, dates]) => {
      const [year, month] = key.split('-').map(Number)
      const raw = new Date(year, month - 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
      return { label: raw.charAt(0).toUpperCase() + raw.slice(1), dates }
    })
  }, [data?.fechasDisponibles])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-auto bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center px-6 py-4 sticky top-0 z-20 bg-background border-b border-border">
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg transition-opacity hover:opacity-70 text-muted-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/30" />
        </div>
      ) : !data ? (
        <div className="flex-1 flex items-center justify-center p-4 text-sm text-muted-foreground/60">
          Sin datos para mostrar
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="max-w-3xl mx-auto px-6 sm:px-10 py-12 space-y-16">

            <DashboardMetricas
              total={total}
              pagos={pagosDesglosados}
              pedidosTotal={allPedidos.length}
              pedidosPagados={allPedidos.filter(p => p.pagado).length}
              fechaLabel={formatDateLabel(data.fecha)}
              onDateClick={() => setShowDateModal(true)}
            />

            <HourlyChart pedidos={allPedidos} />

            {/* Diferenciación: pedidos por la web (cobrados) vs anotados manualmente (sin comisión) */}
            {(origenStats.manualCount > 0 || origenStats.webCount > 0) && (
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2 px-5 py-5 rounded-xl bg-muted">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5 text-muted-foreground" />
                    <p className="text-sm font-bold text-foreground">Por la web</p>
                  </div>
                  <p className="text-2xl font-extrabold text-foreground leading-none">
                    ${origenStats.webTotal.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {origenStats.webCount} {origenStats.webCount === 1 ? 'pedido' : 'pedidos'} · se cobra comisión
                  </p>
                </div>
                <div className="flex flex-col gap-2 px-5 py-5 rounded-xl bg-sky-500/10 border border-sky-500/20">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                    <p className="text-sm font-bold text-sky-700 dark:text-sky-300">Anotados manualmente</p>
                  </div>
                  <p className="text-2xl font-extrabold text-sky-700 dark:text-sky-300 leading-none">
                    ${origenStats.manualTotal.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-sky-600/80 dark:text-sky-400/80">
                    {origenStats.manualCount} {origenStats.manualCount === 1 ? 'pedido' : 'pedidos'} · sin comisión
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3 flex-wrap">
              {afipHabilitado && (
                <button
                  onClick={() => setActiveModal('facturacion')}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-muted text-sm text-foreground hover:opacity-70 transition-opacity cursor-pointer"
                >
                  <Receipt className="h-4 w-4 text-muted-foreground/60" />
                  Facturación
                </button>
              )}
              <button
                onClick={() => setActiveModal('envios')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-muted text-sm text-foreground hover:opacity-70 transition-opacity cursor-pointer"
              >
                <Truck className="h-4 w-4 text-muted-foreground/60" />
                Envíos del día
              </button>
              <button
                onClick={() => setActiveModal('ranking')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-muted text-sm text-foreground hover:opacity-70 transition-opacity cursor-pointer"
              >
                <TrendingUp className="h-4 w-4 text-muted-foreground/60" />
                Productos vendidos
              </button>
            </div>

            <div>
              <div className="relative mb-8">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Buscar mesa, cliente o producto..."
                  className="w-full h-10 pl-10 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 bg-card border border-border rounded-lg text-foreground focus:border-border"
                />
              </div>

              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFilterTipo(filterTipo === 'takeaway' ? null : 'takeaway')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      filterTipo === 'takeaway'
                        ? 'bg-foreground text-background'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {filterTipo === 'takeaway' ? <X className="h-3 w-3" /> : <ShoppingBag className="h-3 w-3" />}
                    Takeaway
                  </button>
                  <button
                    onClick={() => setFilterTipo(filterTipo === 'delivery' ? null : 'delivery')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      filterTipo === 'delivery'
                        ? 'bg-foreground text-background'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {filterTipo === 'delivery' ? <X className="h-3 w-3" /> : <Truck className="h-3 w-3" />}
                    Delivery
                  </button>
                  <button
                    onClick={() => setFilterOrigen(filterOrigen === 'web' ? null : 'web')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      filterOrigen === 'web'
                        ? 'bg-foreground text-background'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {filterOrigen === 'web' ? <X className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />}
                    Web
                  </button>
                  <button
                    onClick={() => setFilterOrigen(filterOrigen === 'manual' ? null : 'manual')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      filterOrigen === 'manual'
                        ? 'bg-sky-500 text-white'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {filterOrigen === 'manual' ? <X className="h-3 w-3" /> : <ShoppingBag className="h-3 w-3" />}
                    Manual
                  </button>
                </div>
                {filtered.length > 0 && (
                  <button
                    onClick={toggleAll}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {allExpanded ? 'Contraer todo' : 'Expandir todo'}
                  </button>
                )}
              </div>

              {filtered.length === 0 ? (
                <p className="text-sm py-12 text-center text-muted-foreground/60">
                  No se encontraron pedidos con ese criterio.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {filtered.map((p) => {
                    const key = `${p.tipo}-${p.id}`
                    return (
                      <PedidoCard
                        key={key}
                        pedido={p}
                        isOpen={expanded.has(key)}
                        onToggle={toggle}
                      />
                    )
                  })}
                </div>
              )}
            </div>

          </div>
        </ScrollArea>
      )}

      {showDateModal && data && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 p-4"
          onClick={() => setShowDateModal(false)}
        >
          <div
            className="w-full max-w-sm bg-background rounded-xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <span className="text-sm font-semibold text-foreground">Seleccionar día</span>
              <button onClick={() => setShowDateModal(false)} className="p-1.5 rounded-lg hover:opacity-70 text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-3 max-h-[60vh] overflow-auto">
              {groupedFechas.map(({ label, dates }) => (
                <div key={label} className="mb-4 last:mb-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 px-2 mb-1.5">{label}</p>
                  <div className="space-y-0.5">
                    {dates.map(f => (
                      <button
                        key={f}
                        onClick={() => { setSelectedFecha(f); fetchCierreTurno(f); setShowDateModal(false) }}
                        className={cn(
                          'w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors',
                          f === selectedFecha
                            ? 'bg-foreground text-background font-medium'
                            : 'text-foreground hover:bg-muted'
                        )}
                      >
                        {formatDateLabel(f)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeModal && data && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 p-4"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-w-lg bg-background rounded-xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <span className="text-sm font-semibold text-foreground">
                {activeModal === 'facturacion' ? 'Facturación' : activeModal === 'envios' ? 'Envíos del día' : 'Ranking de productos'}
              </span>
              <button onClick={() => setActiveModal(null)} className="p-1.5 rounded-lg hover:opacity-70 text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 max-h-[70vh] overflow-auto">
              {activeModal === 'facturacion' && (
                <FacturacionBatchCierre pedidos={allPedidos} />
              )}
              {activeModal === 'envios' && (
                data.pedidosDelivery.length === 0 ? (
                  <p className="text-sm text-muted-foreground/60">Sin envíos registrados</p>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-5">
                      <span className="text-sm font-semibold text-foreground">Total envíos</span>
                      <span className="text-sm text-muted-foreground">
                        ${repartidorStats.totalDeliveryFee.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    {repartidorStats.porRepartidor.map(r => (
                      <div key={r.nombre} className="flex items-center justify-between py-2.5">
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-foreground">{r.nombre}</span>
                          <span className="text-xs text-muted-foreground">
                            {r.cantidad} {r.cantidad === 1 ? 'envío' : 'envíos'}
                          </span>
                        </div>
                        <span className="text-sm text-foreground">
                          ${r.totalFee.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                    {repartidorStats.sinAsignar > 0 && (
                      <p className="text-xs py-2 text-muted-foreground">
                        {repartidorStats.sinAsignar} {repartidorStats.sinAsignar === 1 ? 'envío' : 'envíos'} sin repartidor asignado
                      </p>
                    )}
                  </div>
                )
              )}
              {activeModal === 'ranking' && (
                topProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground/60">Sin ventas registradas</p>
                ) : (
                  <div>
                    {topProducts.map((tp, idx) => {
                      const percentage = total > 0 ? (tp.totalVendido / total) * 100 : 0
                      return (
                        <div key={tp.nombre} className="py-3 border-b border-border/30">
                          <div className="flex items-baseline gap-4">
                            <span className="text-xs w-5 shrink-0 text-right tabular-nums text-muted-foreground/60">
                              {idx + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-4 mb-2">
                                <span className="text-sm font-medium truncate text-foreground" title={tp.nombre}>
                                  {tp.nombre}
                                </span>
                                <div className="flex items-center gap-4 shrink-0">
                                  <span className="text-xs text-muted-foreground">{tp.cantidad} u.</span>
                                  <span className="text-sm text-foreground">
                                    ${tp.totalVendido.toLocaleString('es-AR')}
                                  </span>
                                  <span className="text-xs w-10 text-right tabular-nums text-muted-foreground">
                                    {percentage.toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                              <div className="h-0.5 bg-muted rounded-sm">
                                <div
                                  className="h-full bg-muted-foreground/50 rounded-sm transition-[width] duration-500 ease-in-out"
                                  style={{ width: `${Math.max(2, percentage)}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
