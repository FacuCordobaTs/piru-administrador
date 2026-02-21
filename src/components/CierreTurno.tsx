import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuthStore } from '@/store/authStore'
import { pedidosApi } from '@/lib/api'
import { X, Loader2, FileText, Printer, Search, ChevronDown, ChevronRight } from 'lucide-react'

/* ---------- tus interfaces (copiadas) ---------- */
interface CierreTurnoItem { id: number; productoId: number; nombreProducto: string; cantidad: number; precioUnitario: string; clienteNombre?: string; estado?: string }
interface CierreTurnoPedidoMesa { id: number; mesaId: number | null; nombrePedido: string | null; estado: string; total: string; createdAt: string; closedAt: string | null; mesaNombre: string | null; tipo: 'mesa'; items: CierreTurnoItem[]; totalItems: number; pagado?: boolean }
interface CierreTurnoPedidoDelivery { id: number; direccion: string; nombreCliente: string | null; telefono: string | null; estado: string; total: string; notas: string | null; createdAt: string; deliveredAt: string | null; tipo: 'delivery'; items: CierreTurnoItem[]; totalItems: number; pagado?: boolean }
interface CierreTurnoPedidoTakeaway { id: number; nombreCliente: string | null; telefono: string | null; estado: string; total: string; notas: string | null; createdAt: string; deliveredAt: string | null; tipo: 'takeaway'; items: CierreTurnoItem[]; totalItems: number; pagado?: boolean }
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

/* ---------- helpers ---------- */
const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}
const formatDateLabel = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    const today = new Date(); today.setHours(0,0,0,0)
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
    if (date.getTime() === today.getTime()) return 'Hoy'
    if (date.getTime() === yesterday.getTime()) return 'Ayer'
    return date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

/* ---------- PedidoCard Component ---------- */
interface PedidoCardProps {
  pedido: CierreTurnoPedido
  isOpen: boolean
  onToggle: (key: string) => void
}

/**
 * PedidoCard
 *
 * - Agrupa items por clienteNombre (si existen) y los muestra como:
 *     NombreCliente
 *       └─ Tabla de productos (Producto | Cant | P.Unit | Subtotal)
 *
 * - Si no hay clienteNombre (delivery / takeaway / items sin asignar),
 *   se muestra una única sección "Items".
 *
 * - Filas con separación clara, paddings amplios y tipografía legible,
 *   para facilitar copiar del móvil/pantalla al papel sin equivocaciones.
 */
function PedidoCard({ pedido, isOpen, onToggle }: PedidoCardProps) {
  const key = `${pedido.tipo}-${pedido.id}`

  // Agrupar items por clienteNombre; usar "Pedido" si no hay clienteNombre en ningún item
  const groups: { cliente: string; items: CierreTurnoItem[] }[] = (() => {
    const map = new Map<string, CierreTurnoItem[]>()
    pedido.items.forEach(it => {
      const cliente = (it.clienteNombre && it.clienteNombre.trim()) ? it.clienteNombre.trim() : ''
      if (!map.has(cliente)) map.set(cliente, [])
      map.get(cliente)!.push(it)
    })
    
    // Si es pedido DELIVERY, agregar item "Envio" de 800 pesos
    if (pedido.tipo === 'delivery') {
      const envioItem: CierreTurnoItem = {
        id: -1, // ID especial para el item de envío
        productoId: -1,
        nombreProducto: 'Envio',
        cantidad: 1,
        precioUnitario: '800',
        clienteNombre: undefined,
        estado: undefined
      }
      // Agregar el envío al grupo vacío o crear uno nuevo
      if (!map.has('')) {
        map.set('', [])
      }
      map.get('')!.push(envioItem)
    }
    
    // Si todos los items tienen cliente == '' -> single group named 'Items'
    if (map.size === 1 && map.has('')) {
      return [{ cliente: 'Items', items: map.get('')! }]
    }
    // Otherwise convert map to array and prefer showing unnamed group as "Sin nombre"
    const arr: { cliente: string; items: CierreTurnoItem[] }[] = []
    map.forEach((items, cliente) => {
      arr.push({ cliente: cliente === '' ? 'Sin nombre' : cliente, items })
    })
    return arr
  })()

  // pequeño helper para calcular subtotal por item
  const itemSubtotal = (it: CierreTurnoItem) => {
    const unit = parseFloat(it.precioUnitario || '0')
    return (unit * (it.cantidad || 1))
  }

  // Calcular total incluyendo envío si es delivery
  const totalConEnvio = pedido.tipo === 'delivery' 
    ? parseFloat(pedido.total) + 800 
    : parseFloat(pedido.total)

  return (
    <Card className="shadow-sm">
      <CardContent className="p-3">
        {/* Header row */}
        <div className="flex items-start gap-3">
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

              {/* estado + pagado + total + hora */}
              <div className="ml-auto flex items-center gap-3">
                <div className="text-xs">{pedido.pagado ? 'Pagado ✅' : 'Pendiente de pago❌'}</div>
                <div className="text-base font-bold text-primary">
                  ${totalConEnvio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-muted-foreground">{formatTime(pedido.createdAt)}</div>
                <button
                  onClick={() => onToggle(key)}
                  className="p-1 rounded hover:bg-muted/10"
                  aria-expanded={isOpen}
                  aria-controls={`pedido-items-${key}`}
                >
                  {!isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* compacto: cantidad total y nota */}
            <div className="mt-2 text-xs text-muted-foreground">
              {pedido.totalItems + (pedido.tipo === 'delivery' ? 1 : 0)} item{(pedido.totalItems + (pedido.tipo === 'delivery' ? 1 : 0)) !== 1 ? 's' : ''}
            </div>

            {/* Expandable detail: agrupado por cliente con tablas legibles */}
            {!isOpen && (
              <div id={`pedido-items-${key}`} className="mt-3 space-y-4">
                {groups.map((grp, gi) => (
                  <div key={`${key}-grp-${gi}`} className="rounded-md border overflow-hidden">
                    {/* Cliente header */}
                    <div className="px-3 py-2 bg-muted/10 flex items-center justify-between">
                      <div className="text-sm font-medium">{grp.cliente}</div>
                      <div className="text-xs text-muted-foreground">{grp.items.length} artículo{grp.items.length !== 1 ? 's' : ''}</div>
                    </div>

                    {/* Tabla de items */}
                    <div className="w-full overflow-x-auto">
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
                            <tr
                              key={it.id}
                              className={`border-t bg-background`}
                            >
                              <td className="py-3 px-3 align-top min-w-0">
                                <div className="truncate font-medium">{it.nombreProducto}</div>
                                {it.estado && <div className="text-[12px] text-muted-foreground mt-0.5">{it.estado}</div>}
                              </td>
                              <td className="py-3 px-3 text-center font-mono">{it.cantidad}</td>
                              <td className="py-3 px-3 text-right font-mono">${parseFloat(it.precioUnitario).toFixed(2)}</td>
                              <td className="py-3 px-3 text-right font-semibold">${itemSubtotal(it).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t bg-muted/10">
                            <td className="py-2 px-3 text-sm font-semibold">Total {grp.cliente !== 'Items' && `— ${grp.cliente}`}</td>
                            <td />
                            <td />
                            <td className="py-2 px-3 text-right font-semibold">
                              ${grp.items.reduce((s, it) => s + itemSubtotal(it), 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
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

/* ---------- Componente minimalista ---------- */
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
            .sort((a,b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    }, [data])

    const filtered = useMemo(() => {
        if (!query) return allPedidos
        const q = query.toLowerCase()
        return allPedidos.filter(p => {
            const label = p.tipo === 'mesa' ? (p as CierreTurnoPedidoMesa).mesaNombre || '' :
                          p.tipo === 'delivery' ? (p as CierreTurnoPedidoDelivery).nombreCliente || '' :
                          (p as CierreTurnoPedidoTakeaway).nombreCliente || ''
            if (label.toLowerCase().includes(q)) return true
            return p.items.some(i => i.nombreProducto.toLowerCase().includes(q))
        })
    }, [allPedidos, query])

    const total = useMemo(() => data ? parseFloat(data.totales.general) : 0, [data])
    const topProducts = useMemo(() => {
        if (!data) return []
        return data.productosVendidos.slice(0,5)
    }, [data])

    const exportCSV = () => {
        if (!data) return
        const rows = [['tipo','id','label','estado','total','items','hora'].join(',')]
        allPedidos.forEach(p => {
            const label = p.tipo === 'mesa' ? (p as CierreTurnoPedidoMesa).mesaNombre || '' :
                          p.tipo === 'delivery' ? (p as CierreTurnoPedidoDelivery).nombreCliente || '' :
                          (p as CierreTurnoPedidoTakeaway).nombreCliente || ''
            rows.push([p.tipo,p.id,`"${label}"`,p.estado,p.total,p.totalItems,new Date(p.createdAt).toISOString()].join(','))
        })
        const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
        const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `cierre_${data.fecha}.csv`; a.click(); URL.revokeObjectURL(url)
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
            {/* header */}
            <div className="flex items-center justify-between p-3 border-b bg-background/95">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="p-1 rounded hover:bg-muted/20"><X className="h-5 w-5" /></button>
                    <div>
                        <div className="text-lg font-bold">Cierre de Turno</div>
                        <div className="text-xs text-muted-foreground">{restaurante?.nombre || 'Restaurante'}</div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Select value={selectedFecha} onValueChange={(v: string) => { setSelectedFecha(v); fetchCierreTurno(v) }}>
                        <SelectTrigger className="h-9 w-44 text-sm"><SelectValue placeholder="Seleccionar día" /></SelectTrigger>
                        <SelectContent>
                            {data?.fechasDisponibles.map(f => <SelectItem key={f} value={f}>{formatDateLabel(f)}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <button onClick={exportCSV} title="Exportar CSV" className="p-2 rounded hover:bg-muted/10"><FileText className="h-4 w-4" /></button>
                    <button onClick={() => window.print()} title="Imprimir" className="p-2 rounded hover:bg-muted/10"><Printer className="h-4 w-4" /></button>
                </div>
            </div>

            {/* content */}
            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                        <p className="text-sm text-muted-foreground mt-2">Cargando...</p>
                    </div>
                </div>
            ) : !data ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">Sin datos</div>
            ) : (
                <ScrollArea className="flex-1">
                    <div className="max-w-4xl mx-auto p-4 space-y-4">

                        {/* Total grande */}
                        <div className="rounded-xl border bg-muted/10 p-4 flex items-center justify-between mb-4">
                            <div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                                    Total vendido
                                </div>
                                <div className="text-4xl font-extrabold text-primary mt-1">
                                    ${total.toLocaleString('es-AR',{minimumFractionDigits:2})}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    {data.cantidades.total} pedido{data.cantidades.total !== 1 ? 's' : ''} · {formatDateLabel(data.fecha)}
                                </div>
                            </div>

                            <div className="text-right text-sm">
                                <div className="text-muted-foreground">Pagados</div>
                                <div className="font-bold">
                                    {allPedidos.filter(p => p.pagado).length}
                                </div>
                            </div>
                        </div>

                        <div className="w-full mb-4">
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><Search className="h-4 w-4"/></div>
                                <input
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    placeholder="Buscar mesa / cliente / producto..."
                                    className="w-full h-10 pl-10 pr-3 rounded border bg-background text-sm"
                                />
                            </div>
                        </div>

                        {/* Pedidos list */}
                        <div className="space-y-2">
                            {filtered.length === 0 ? (
                                <div className="text-center py-10 text-muted-foreground">No hay pedidos</div>
                            ) : filtered.map((p) => {
                                const key = `${p.tipo}-${p.id}`
                                const isOpen = expanded.has(key)
                                return (
                                    <PedidoCard
                                        key={key}
                                        pedido={p}
                                        isOpen={isOpen}
                                        onToggle={toggle}
                                    />
                                )
                            })}
                        </div>

                        {/* Top products compact */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <div className="text-sm font-semibold">Top 5 productos</div>
                                <div className="text-xs text-muted-foreground">
                                    {topProducts.length} activos
                                </div>
                            </div>

                            <div className="space-y-3">
                                {topProducts.length === 0 ? (
                                    <div className="text-xs text-muted-foreground">Sin ventas</div>
                                ) : topProducts.map((tp, idx) => {
                                    const percentage = total > 0 ? (tp.totalVendido / total) * 100 : 0

                                    return (
                                        <div key={tp.nombre} className="rounded-lg border p-3 hover:bg-muted/10 transition-colors">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className="text-xs font-bold text-muted-foreground w-5">
                                                        #{idx + 1}
                                                    </div>
                                                    <div className="text-sm font-medium truncate">
                                                        {tp.nombre}
                                                    </div>
                                                </div>

                                                <div className="text-sm font-bold">
                                                    ${tp.totalVendido.toLocaleString('es-AR',{minimumFractionDigits:2})}
                                                </div>
                                            </div>

                                            <div className="mt-2">
                                                <div className="h-2 bg-muted/20 rounded overflow-hidden">
                                                    <div
                                                        style={{ width: `${Math.max(6, percentage)}%` }}
                                                        className="h-full bg-primary transition-all"
                                                    />
                                                </div>
                                                <div className="text-[11px] text-muted-foreground mt-1">
                                                    {tp.cantidad} unidades · {percentage.toFixed(1)}%
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