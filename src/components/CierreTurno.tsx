import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuthStore } from '@/store/authStore'
import { pedidosApi } from '@/lib/api'
import {
  X, Loader2, FileText, Printer, Search, ChevronDown, ChevronRight,
  Wallet, Smartphone, Building2, CheckCircle2, AlertCircle, TrendingUp
} from 'lucide-react'

/* ==========================================================================
   INTERFACES & TYPES
   Cierre de turno: mesas (pedido), delivery/takeaway (pedido_unificado)
   ========================================================================== */
interface CierreTurnoItem { id: number; productoId: number; nombreProducto: string; cantidad: number; precioUnitario: string; clienteNombre?: string; estado?: string; agregados?: any }
interface CierreTurnoPedidoMesa { id: number; mesaId: number | null; nombrePedido: string | null; estado: string; total: string; createdAt: string; closedAt: string | null; mesaNombre: string | null; tipo: 'mesa'; items: CierreTurnoItem[]; totalItems: number; pagado?: boolean; metodoPago?: string | null; pagos?: any[]; pagosSubtotal?: any[] }
interface CierreTurnoPedidoDelivery { id: number; direccion: string; nombreCliente: string | null; telefono: string | null; estado: string; total: string; notas: string | null; createdAt: string; deliveredAt: string | null; tipo: 'delivery'; items: CierreTurnoItem[]; totalItems: number; pagado?: boolean; metodoPago?: string | null }
interface CierreTurnoPedidoTakeaway { id: number; nombreCliente: string | null; telefono: string | null; estado: string; total: string; notas: string | null; createdAt: string; deliveredAt: string | null; tipo: 'takeaway'; items: CierreTurnoItem[]; totalItems: number; pagado?: boolean; metodoPago?: string | null }
type CierreTurnoPedido = CierreTurnoPedidoMesa | CierreTurnoPedidoDelivery | CierreTurnoPedidoTakeaway

interface ProductoVendido { nombre: string; cantidad: number; totalVendido: number }
interface CierreTurnoData {
  fecha: string
  pedidosMesa: CierreTurnoPedidoMesa[]
  pedidosDelivery: CierreTurnoPedidoDelivery[]
  pedidosTakeaway: CierreTurnoPedidoTakeaway[]
  totales: { mesa: string; delivery: string; takeaway: string; general: string }
  cantidades: { mesa: number; delivery: number; takeaway: number; total: number }
  productosVendidos: ProductoVendido[]
  fechasDisponibles: string[]
}
interface CierreTurnoProps { open: boolean; onClose: () => void }

/* ==========================================================================
   HELPERS
   ========================================================================== */
const formatTime = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
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
   NUEVO COMPONENTE: DASHBOARD MÉTRICAS (VISUAL & MINIMALISTA)
   ========================================================================== */
interface DashboardMetricasProps {
  total: number
  pagos: { efectivo: number; mercadopago: number; transferencia: number }
  pedidosTotal: number
  pedidosPagados: number
  fechaLabel: string
}
function DashboardMetricas({ total, pagos, pedidosTotal, pedidosPagados, fechaLabel }: DashboardMetricasProps) {
  // Cálculos de porcentajes para la barra visual
  const pctEfectivo = total > 0 ? (pagos.efectivo / total) * 100 : 0
  const pctMP = total > 0 ? (pagos.mercadopago / total) * 100 : 0
  const pctTransf = total > 0 ? (pagos.transferencia / total) * 100 : 0

  // Porcentaje de cobro (eficiencia)
  const pctCobrado = pedidosTotal > 0 ? Math.round((pedidosPagados / pedidosTotal) * 100) : 0
  const pedidosPendientes = pedidosTotal - pedidosPagados

  return (
    <div className="space-y-4 mb-6 animate-in fade-in slide-in-from-top-4 duration-500">

      {/* 1. Bloque Principal: Total y Barra de Composición */}
      <div className="bg-card rounded-xl border shadow-sm p-4 sm:p-5 relative overflow-hidden">
        {/* Fondo decorativo sutil */}
        <div className="absolute top-0 right-0 p-10 opacity-[0.03] dark:opacity-[0.05] pointer-events-none">
          <TrendingUp size={120} />
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ventas Totales</span>
              <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground border border-transparent dark:border-border">{fechaLabel}</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-foreground tracking-tight">
              ${total.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              <span className="text-xl sm:text-2xl text-muted-foreground/50 font-medium">,{(total % 1).toFixed(2).split('.')[1]}</span>
            </h2>
          </div>

          <div className={`flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-full border 
            ${pctCobrado === 100
              ? 'bg-green-500/10 text-green-700 border-green-200 dark:text-green-400 dark:border-green-800/50'
              : 'bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-400 dark:border-amber-800/50'
            }`}>
            {pctCobrado === 100 ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{pctCobrado}% cobrado</span>
          </div>
        </div>

        {/* Barra Visual de Distribución */}
        <div className="relative z-10">
          <div className="h-4 w-full flex rounded-full overflow-hidden bg-muted/50 dark:bg-muted mb-2">
            {pctEfectivo > 0 && (
              <div style={{ width: `${pctEfectivo}%` }} className="bg-emerald-500 dark:bg-emerald-600 transition-all duration-700 hover:brightness-110" title={`Efectivo: ${pctEfectivo.toFixed(1)}%`} />
            )}
            {pctMP > 0 && (
              <div style={{ width: `${pctMP}%` }} className="bg-sky-500 dark:bg-sky-600 transition-all duration-700 hover:brightness-110" title={`MercadoPago: ${pctMP.toFixed(1)}%`} />
            )}
            {pctTransf > 0 && (
              <div style={{ width: `${pctTransf}%` }} className="bg-violet-500 dark:bg-violet-600 transition-all duration-700 hover:brightness-110" title={`Transferencia: ${pctTransf.toFixed(1)}%`} />
            )}
          </div>

          {/* Leyenda inteligente */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground font-medium">
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div>Efectivo ({Math.round(pctEfectivo)}%)</div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-sky-500"></div>Mercado Pago ({Math.round(pctMP)}%)</div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-violet-500"></div>Transferencias ({Math.round(pctTransf)}%)</div>
          </div>
        </div>
      </div>

      {/* 2. Grid de Detalles (Tarjetas) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

        <MetricaCard
          title="Efectivo"
          amount={pagos.efectivo}
          icon={<Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
          colorClass="border-emerald-500 bg-emerald-50/50 dark:bg-emerald-500/10 hover:bg-emerald-100/50 dark:hover:bg-emerald-500/20"
          barColor="bg-emerald-500"
        />

        <MetricaCard
          title="Mercado Pago"
          amount={pagos.mercadopago}
          icon={<Smartphone className="w-4 h-4 text-sky-600 dark:text-sky-400" />}
          colorClass="border-sky-500 bg-sky-50/50 dark:bg-sky-500/10 hover:bg-sky-100/50 dark:hover:bg-sky-500/20"
          barColor="bg-sky-500"
        />

        <MetricaCard
          title="Transferencias"
          amount={pagos.transferencia}
          icon={<Building2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />}
          colorClass="border-violet-500 bg-violet-50/50 dark:bg-violet-500/10 hover:bg-violet-100/50 dark:hover:bg-violet-500/20"
          barColor="bg-violet-500"
        />

        {/* Card Estado de Órdenes */}
        <Card className={`p-4 flex flex-col justify-between border-l-4 shadow-sm relative overflow-hidden transition-colors 
          ${pedidosPendientes > 0
            ? 'border-l-amber-500 bg-amber-50/30 dark:bg-amber-500/10'
            : 'border-l-slate-400 bg-card'
          }`}>
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-muted-foreground uppercase">Órdenes</span>
            <div className="text-muted-foreground opacity-50">#</div>
          </div>
          <div className="mt-3">
            <div className="text-xl font-bold text-foreground">
              {pedidosPagados} <span className="text-muted-foreground text-sm font-normal">/ {pedidosTotal}</span>
            </div>
            <div className={`text-xs mt-1 font-medium ${pedidosPendientes > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
              {pedidosPendientes > 0
                ? `⚠️ ${pedidosPendientes} por cobrar`
                : '✅ Todo cobrado'}
            </div>
          </div>
        </Card>

      </div>
    </div>
  )
}

function MetricaCard({ title, amount, icon, colorClass, barColor }: { title: string, amount: number, icon: React.ReactNode, colorClass: string, barColor: string }) {
  return (
    <Card className={`p-4 flex flex-col justify-between shadow-sm border-l-4 transition-all ${colorClass}`}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-bold text-muted-foreground uppercase truncate">{title}</span>
        {icon}
      </div>
      <div>
        <div className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
          ${amount.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </div>
      </div>
      {/* Mini barra decorativa */}
      <div className={`h-1 w-8 rounded-full mt-3 opacity-30 ${barColor}`} />
    </Card>
  )
}

/* ==========================================================================
   PEDIDO CARD COMPONENT (EXISTENTE, LIGERAMENTE RETOCADO)
   ========================================================================== */
interface PedidoCardProps {
  pedido: CierreTurnoPedido
  isOpen: boolean
  onToggle: (key: string) => void
}

function PedidoCard({ pedido, isOpen, onToggle }: PedidoCardProps) {
  const key = `${pedido.tipo}-${pedido.id}`

  // 1. Calcular subtotal de cada ítem (Precio Base + Agregados) * Cantidad
  const itemSubtotal = (it: CierreTurnoItem) => {
    const unit = parseFloat(it.precioUnitario || '0')
    let extras = 0
    if (it.agregados) {
      let arr: any[] = []
      if (typeof it.agregados === 'string') {
        try { arr = JSON.parse(it.agregados) } catch(e){}
      } else if (Array.isArray(it.agregados)) {
        arr = it.agregados
      }
      arr.forEach((ag: any) => { extras += parseFloat(ag.precio || '0') })
    }
    return ((unit + extras) * (it.cantidad || 1))
  }

  // 2. Deducir costo dinámico de envío (Total - Suma de todos los ítems)
  const sumItems = pedido.items.reduce((acc, it) => acc + itemSubtotal(it), 0)
  const dynamicDeliveryFee = pedido.tipo === 'delivery' ? Math.max(0, parseFloat(pedido.total) - sumItems) : 0

  // 3. Agrupar ítems (pedido_unificado: delivery/takeaway no tienen clienteNombre por ítem)
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

    // Si es pedido DELIVERY, agregar el costo de zona calculado dinámicamente
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

  // El total real ya viene del backend, no le sumamos más nada
  const totalConEnvio = parseFloat(pedido.total)

  // Helper para renderizar la lista de agregados visualmente
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
      <div className="mt-1 flex flex-col gap-0.5">
        {arr.map((ag: any, idx: number) => (
          <span key={idx} className="text-[11px] text-muted-foreground/80">
            + {ag.nombre} (${parseFloat(ag.precio).toLocaleString('es-AR')})
          </span>
        ))}
      </div>
    )
  }

  return (
    <Card className="shadow-sm">
      <CardContent className="p-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="text-lg leading-none">{pedido.tipo === 'mesa' ? '🍽️' : pedido.tipo === 'delivery' ? '🚚' : '🛍️'}</div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {pedido.tipo === 'mesa' ? (pedido as CierreTurnoPedidoMesa).mesaNombre || 'Mesa' :
                      pedido.tipo === 'delivery' ? (pedido as CierreTurnoPedidoDelivery).nombreCliente || 'Delivery' :
                        (pedido as CierreTurnoPedidoTakeaway).nombreCliente || 'Takeaway'}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {pedido.tipo === 'mesa' ? (pedido as CierreTurnoPedidoMesa).nombrePedido || '' : ''}
                  </div>
                </div>
              </div>

              <div className="ml-auto flex items-center gap-3">
                <div className="text-xs">{pedido.pagado ? 'Pagado ✅' : 'Pendiente de pago❌'}</div>
                <div className="text-base font-bold text-primary">
                  ${totalConEnvio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-muted-foreground">{formatTime(pedido.createdAt)}</div>
                <button onClick={() => onToggle(key)} className="p-1 rounded hover:bg-muted/10">
                  {!isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="mt-2 text-xs text-muted-foreground">
              {pedido.totalItems + (pedido.tipo === 'delivery' ? 1 : 0)} item{(pedido.totalItems + (pedido.tipo === 'delivery' ? 1 : 0)) !== 1 ? 's' : ''}
            </div>

            {!isOpen && (
              <div id={`pedido-items-${key}`} className="mt-3 space-y-4">
                {groups.map((grp, gi) => (
                  <div key={`${key}-grp-${gi}`} className="rounded-md border overflow-hidden">
                    <div className="px-3 py-2 bg-muted/10 flex items-center justify-between">
                      <div className="text-sm font-medium">{grp.cliente}</div>
                      <div className="text-xs text-muted-foreground">{grp.items.length} artículo{grp.items.length !== 1 ? 's' : ''}</div>
                    </div>

                    {/* VISTA DESKTOP */}
                    <div className="w-full overflow-x-auto hidden sm:block">
                      <table className="w-full table-fixed text-sm">
                        <thead>
                          <tr className="bg-muted/5 text-[13px] text-muted-foreground">
                            <th className="py-2 px-3 text-left w-[60%]">Producto</th>
                            <th className="py-2 px-3 text-center w-[10%]">Cant.</th>
                            <th className="py-2 px-3 text-right w-[15%]">P. Unit.</th>
                            <th className="py-2 px-3 text-right w-[15%]">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {grp.items.map((it) => (
                            <tr key={it.id} className="border-t bg-background">
                              <td className="py-3 px-3 align-top min-w-0">
                                <div className="truncate font-medium">{it.nombreProducto || `Producto #${it.productoId}`}</div>
                                {it.estado && <div className="text-[12px] text-muted-foreground mt-0.5">{it.estado}</div>}
                                {renderAgregadosUI(it.agregados)}
                              </td>
                              <td className="py-3 px-3 text-center font-mono align-top">{it.cantidad}</td>
                              <td className="py-3 px-3 text-right font-mono align-top">${parseFloat(it.precioUnitario).toFixed(2)}</td>
                              <td className="py-3 px-3 text-right font-semibold align-top">${itemSubtotal(it).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t bg-muted/10">
                            <td className="py-2 px-3 text-sm font-semibold">Total</td>
                            <td />
                            <td />
                            <td className="py-2 px-3 text-right font-semibold">
                              ${grp.items.reduce((s, it) => s + itemSubtotal(it), 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* VISTA MOBILE */}
                    <div className="w-full block sm:hidden px-3 py-2 space-y-2">
                      {grp.items.map((it) => (
                        <div key={`mobile-${it.id}`} className="rounded-md border p-3 bg-background">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">{it.nombreProducto || `Producto #${it.productoId}`}</div>
                              {it.estado && <div className="text-xs text-muted-foreground mt-1">{it.estado}</div>}
                              {renderAgregadosUI(it.agregados)}
                            </div>
                            <div className="text-sm font-mono text-right min-w-[70px]">
                              x{it.cantidad}
                            </div>
                          </div>
                          <div className="mt-2 flex items-center justify-between text-xs font-mono text-muted-foreground">
                            <div>P.Unit. ${parseFloat(it.precioUnitario).toFixed(2)}</div>
                            <div>Subtotal ${itemSubtotal(it).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                          </div>
                        </div>
                      ))}
                      <div className="pt-2 border-t">
                        <div className="flex items-center justify-between text-sm font-semibold">
                          <div>Total</div>
                          <div>${grp.items.reduce((s, it) => s + itemSubtotal(it), 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/* ==========================================================================
   MAIN COMPONENT
   ========================================================================== */
export default function CierreTurnoSimple({ open, onClose }: CierreTurnoProps) {
  const token = useAuthStore(s => s.token)
  const restaurante = useAuthStore(s => s.restaurante)
  const [data, setData] = useState<CierreTurnoData | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedFecha, setSelectedFecha] = useState<string>('')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

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
    setQuery(''); setExpanded(new Set()); setSelectedFecha('')
    fetchCierreTurno()
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
    if (!query) return allPedidos
    const q = query.toLowerCase()
    return allPedidos.filter(p => {
      const label = p.tipo === 'mesa' ? (p as CierreTurnoPedidoMesa).mesaNombre || '' :
        p.tipo === 'delivery' ? (p as CierreTurnoPedidoDelivery).nombreCliente || '' :
          (p as CierreTurnoPedidoTakeaway).nombreCliente || ''
      if (label.toLowerCase().includes(q)) return true
      return p.items.some(i => (i.nombreProducto || '').toLowerCase().includes(q))
    })
  }, [allPedidos, query])

  const total = useMemo(() => data ? parseFloat(data.totales.general) : 0, [data])

  const pagosDesglosados = useMemo(() => {
    const res = { efectivo: 0, mercadopago: 0, transferencia: 0 };
    if (!data) return res;

    allPedidos.forEach(p => {
      // Usamos directamente p.total. Ya incluye ítems, agregados y envío de zona.
      const baseMonto = parseFloat(p.total);

      if (p.tipo === 'mesa') {
        const mesaP = p as CierreTurnoPedidoMesa;
        const paidSub = mesaP.pagosSubtotal?.filter(ps => ps.estado === 'paid') || [];
        const paidBase = mesaP.pagos?.filter(pg => pg.estado === 'paid') || [];

        if (paidSub.length > 0) {
          paidSub.forEach(ps => {
            const mp = ps.metodo?.toLowerCase();
            if (mp === 'efectivo') res.efectivo += parseFloat(ps.monto);
            if (mp === 'mercadopago') res.mercadopago += parseFloat(ps.monto);
            if (mp === 'transferencia') res.transferencia += parseFloat(ps.monto);
          })
        } else if (paidBase.length > 0) {
          paidBase.forEach(pg => {
            const mp = pg.metodo?.toLowerCase();
            if (mp === 'efectivo') res.efectivo += parseFloat(pg.monto);
            if (mp === 'mercadopago') res.mercadopago += parseFloat(pg.monto);
            if (mp === 'transferencia') res.transferencia += parseFloat(pg.monto);
          })
        } else if (mesaP.pagado && mesaP.metodoPago) {
          const mp = mesaP.metodoPago.toLowerCase();
          if (mp === 'efectivo') res.efectivo += baseMonto;
          if (mp === 'mercadopago') res.mercadopago += baseMonto;
          if (mp === 'transferencia') res.transferencia += baseMonto;
        }
      } else {
        if (p.pagado && p.metodoPago) {
          const mp = p.metodoPago.toLowerCase();
          if (mp === 'efectivo') res.efectivo += baseMonto;
          if (mp === 'mercadopago') res.mercadopago += baseMonto;
          if (mp === 'transferencia') res.transferencia += baseMonto;
        }
      }
    })
    return res;
  }, [allPedidos, data])

  const topProducts = useMemo(() => {
    if (!data) return []
    return data.productosVendidos.filter(p => !p.nombre.startsWith('[Extra]'))
  }, [data])

  const exportCSV = () => {
    if (!data) return
    const rows = [['tipo', 'id', 'label', 'estado', 'total', 'items', 'hora'].join(',')]
    allPedidos.forEach(p => {
      const label = p.tipo === 'mesa' ? (p as CierreTurnoPedidoMesa).mesaNombre || '' :
        p.tipo === 'delivery' ? (p as CierreTurnoPedidoDelivery).nombreCliente || '' :
          (p as CierreTurnoPedidoTakeaway).nombreCliente || ''
      rows.push([p.tipo, p.id, `"${label}"`, p.estado, p.total, p.totalItems, new Date(p.createdAt).toISOString()].join(','))
    })
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `cierre_${data.fecha}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-auto">
      {/* Header Fijo */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 border-b bg-background/95 gap-3 sticky top-0 z-20 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button onClick={onClose} className="p-2 rounded hover:bg-muted/50 transition-colors"><X className="h-5 w-5" /></button>
          <div>
            <div className="text-lg font-bold">Cierre de Turno</div>
            <div className="text-xs text-muted-foreground">{restaurante?.nombre || 'Restaurante'}</div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
          <Select value={selectedFecha} onValueChange={(v: string) => { setSelectedFecha(v); fetchCierreTurno(v) }}>
            <SelectTrigger className="h-9 w-full sm:w-44 text-sm"><SelectValue placeholder="Seleccionar día" /></SelectTrigger>
            <SelectContent>
              {data?.fechasDisponibles.map(f => <SelectItem key={f} value={f}>{formatDateLabel(f)}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1 mt-2 sm:mt-0 self-end sm:self-auto">
            <button onClick={exportCSV} title="Exportar CSV" className="p-2 rounded hover:bg-muted/50 border"><FileText className="h-4 w-4" /></button>
            <button onClick={() => window.print()} title="Imprimir" className="p-2 rounded hover:bg-muted/50 border"><Printer className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground mt-2">Calculando métricas...</p>
          </div>
        </div>
      ) : !data ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground p-4">Sin datos para mostrar</div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">

            {/* ---> COMPONENTE REDISEÑADO <--- */}
            <DashboardMetricas
              total={total}
              pagos={pagosDesglosados}
              pedidosTotal={allPedidos.length}
              pedidosPagados={allPedidos.filter(p => p.pagado).length}
              fechaLabel={formatDateLabel(data.fecha)}
            />

            {/* Buscador & Lista */}
            <div className="space-y-4">
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><Search className="h-4 w-4" /></div>
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Buscar mesa, cliente o producto..."
                  className="w-full h-11 pl-10 pr-3 rounded-lg border bg-background text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-shadow"
                />
              </div>

              <div className="space-y-3">
                {filtered.length === 0 ? (
                  <div className="text-center py-12 border rounded-xl border-dashed">
                    <p className="text-muted-foreground text-sm">No se encontraron pedidos con ese criterio.</p>
                  </div>
                ) : filtered.map((p) => {
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
            </div>

            {/* Top Products (Estilizado) */}
            <div className="pt-6 border-t mt-8">
              <div className="flex items-center justify-between mb-4">
                <div className="text-base font-semibold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Ranking de productos
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {topProducts.length === 0 ? (
                  <div className="text-xs text-muted-foreground col-span-full">Sin ventas registradas</div>
                ) : topProducts.slice(0, 9).map((tp, idx) => {
                  const percentage = total > 0 ? (tp.totalVendido / total) * 100 : 0
                  return (
                    <div key={tp.nombre} className="rounded-lg border p-3 bg-card hover:shadow-sm transition-all flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-xs font-bold text-muted-foreground/50">#{idx + 1}</span>
                          <span className="text-xs font-mono font-medium">${tp.totalVendido.toLocaleString('es-AR')}</span>
                        </div>
                        <div className="font-medium text-sm truncate" title={tp.nombre}>{tp.nombre}</div>
                      </div>
                      <div className="mt-2">
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                          <span>{tp.cantidad} u.</span>
                          <span>{percentage.toFixed(1)}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div style={{ width: `${Math.max(5, percentage)}%` }} className="h-full bg-primary/70" />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

          </div>
        </ScrollArea>
      )}
    </div>
  )
}