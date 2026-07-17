import { useMemo, useState } from 'react'
import {
  Store, Utensils, Plus, Receipt, Trash2, Package, ChevronLeft,
  MapPin, Truck, Banknote, Wallet, ArrowDownToLine, Check,
  Loader2, UtensilsCrossed, Users, ChevronRight, ShoppingBag,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ── Tipos livianos: los productos del onboarding son simples (sin imagen, variantes ni agregados) ──
export type PreviewProduct = { id: number; nombre: string; descripcion?: string | null; precio: string | number }

// Cada línea del carrito es un item independiente (no se stackean por cantidad)
type CartLine = { uid: string; productoId: number }

type MetodoPreview = { id: string; label: string; desc: string; icon: any }

type PasoCheckout = 'tipo' | 'datos' | 'ubicacion' | 'extras'
const PASOS: PasoCheckout[] = ['tipo', 'datos', 'ubicacion', 'extras']

interface TiendaPreviewProps {
  nombre: string
  logo: string | null
  slug: string
  direccion: string
  deliveryPrice: string
  metodosPago: { transferenciaManual: boolean; efectivo: boolean }
  proveedorPago: string
  productos: PreviewProduct[]
  /** Crea el pedido de prueba real. Recibe los items agregados. Devuelve una promesa. */
  onConfirmar: (items: { productoId: number; cantidad: number }[], meta: { nombreCliente: string; notas: string }) => Promise<void>
}

// ── Espejo minimalista de la tienda del cliente (MenuDelivery + CheckoutDeliveryGrupal).
//    Vive dentro de un "marco de navegador" para que el dueño vea exactamente cómo lucirá
//    y cómo funciona su tienda antes de publicarla. Se le ahorran pasos (datos precargados,
//    takeaway por defecto) sin perder la fidelidad visual. ──
export function TiendaPreview({
  nombre, logo, slug, direccion, deliveryPrice, metodosPago, proveedorPago, productos, onConfirmar,
}: TiendaPreviewProps) {
  const [cart, setCart] = useState<CartLine[]>([])
  const [detalle, setDetalle] = useState<PreviewProduct | null>(null)
  const [addCount, setAddCount] = useState(0) // veces que se agregó el producto abierto (para "Agregar otro igual")
  const [carritoAbierto, setCarritoAbierto] = useState(false)
  const [enCheckout, setEnCheckout] = useState(false)
  const [paso, setPaso] = useState(0)
  const [enviando, setEnviando] = useState(false)

  // ── Checkout (precargado para ir rápido, pero con el mismo aspecto que la tienda real) ──
  const [tipoPedido, setTipoPedido] = useState<'delivery' | 'takeaway'>('takeaway')
  const [nombreCliente, setNombreCliente] = useState('')
  const [telefono, setTelefono] = useState('')
  const [notas, setNotas] = useState('')

  const metodos = useMemo<MetodoPreview[]>(() => {
    const list: MetodoPreview[] = []
    if (proveedorPago === 'mercadopago') list.push({ id: 'mp', label: 'Mercado Pago', desc: 'Tarjeta · se acredita solo', icon: Wallet })
    if (metodosPago.transferenciaManual) list.push({ id: 'transfer', label: 'Transferencia', desc: 'Mostrás tu alias', icon: ArrowDownToLine })
    if (metodosPago.efectivo) list.push({ id: 'cash', label: 'Efectivo', desc: 'Al recibir', icon: Banknote })
    if (list.length === 0) list.push({ id: 'cash', label: 'Efectivo', desc: 'Al recibir', icon: Banknote })
    return list
  }, [proveedorPago, metodosPago.transferenciaManual, metodosPago.efectivo])

  const [metodoPago, setMetodoPago] = useState(metodos[0].id)

  const findProducto = (id: number) => productos.find(p => p.id === id)
  const cartCount = cart.length
  const itemsTotal = cart.reduce((sum, l) => sum + Number(findProducto(l.productoId)?.precio || 0), 0)
  const envio = tipoPedido === 'delivery' ? (parseInt(deliveryPrice) || 0) : 0
  const total = itemsTotal + envio

  const money = (n: number) => `$${n.toLocaleString('es-AR')}`

  const addLine = (productoId: number) =>
    setCart(c => [...c, { uid: Math.random().toString(36).slice(2), productoId }])
  const removeLine = (uid: string) => setCart(c => c.filter(l => l.uid !== uid))

  const abrirDetalle = (p: PreviewProduct) => { setDetalle(p); setAddCount(0) }
  const cerrarDetalle = () => setDetalle(null)
  const agregarDesdeDetalle = () => {
    if (!detalle) return
    addLine(detalle.id)
    setAddCount(c => c + 1)
  }

  const cerrarCarrito = () => { setCarritoAbierto(false); setEnCheckout(false); setPaso(0) }

  const irACheckout = () => { setEnCheckout(true); setPaso(0) }
  const handleSiguiente = () => {
    if (paso < PASOS.length - 1) setPaso(paso + 1)
    else confirmar()
  }
  const handleAtras = () => {
    if (paso > 0) setPaso(paso - 1)
    else { setEnCheckout(false); setPaso(0) }
  }

  const confirmar = async () => {
    if (cartCount === 0 || enviando) return
    setEnviando(true)
    try {
      // Agregamos las líneas por producto para el pedido real
      const agrupado = cart.reduce<Record<number, number>>((acc, l) => {
        acc[l.productoId] = (acc[l.productoId] || 0) + 1
        return acc
      }, {})
      const items = Object.entries(agrupado).map(([id, cantidad]) => ({ productoId: Number(id), cantidad }))
      const nombreFinal = nombreCliente.trim() || 'Pedido de prueba'
      const notasPref = tipoPedido === 'delivery' ? 'Delivery' : 'Take away'
      const notasFinal = [notasPref, notas.trim()].filter(Boolean).join(' · ')
      await onConfirmar(items, { nombreCliente: nombreFinal, notas: notasFinal })
      // Si el pedido se creó, el padre cambia de fase y este componente se desmonta.
    } finally {
      setEnviando(false)
    }
  }

  const inputCls = "w-full h-11 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border-0 outline-none focus:ring-2 focus:ring-[#FF7A00]/30 text-sm px-4 transition-all"

  const tituloPaso: Record<PasoCheckout, string> = {
    tipo: '¿Cómo lo querés?',
    datos: 'Tus datos',
    ubicacion: tipoPedido === 'delivery' ? 'Dirección de entrega' : 'Retiro',
    extras: 'Pago y detalles',
  }

  return (
    <div className="mt-6 rounded-[24px] border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-950 shadow-lg shadow-zinc-200/40 dark:shadow-none">
      {/* Chrome del "navegador" */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <span className="ml-2 text-xs font-mono text-muted-foreground truncate">my.piru.app/{slug}</span>
      </div>

      {/* Viewport tipo teléfono: todo (menú, carrito, detalle) vive acá dentro */}
      <div className="relative overflow-hidden bg-white dark:bg-zinc-950" style={{ height: 564 }}>
        {/* ─────────────── MENÚ (scrolleable) ─────────────── */}
        <div className="absolute inset-0 overflow-y-auto">
          {/* Barra superior sticky */}
          <div className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="h-7 w-7 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                <Store className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <button
                onClick={() => toast.info('Acá tus clientes ven el historial de sus pedidos')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-[#FF7A00] border border-[#FF7A00]/20 hover:bg-[#FF7A00]/10 transition-colors"
              >
                <Package className="h-3.5 w-3.5" /> Mis Pedidos
              </button>
            </div>
          </div>

          <div className="px-4 pt-4 pb-28 space-y-5">
            {/* Cabecera del local */}
            <div className="flex flex-col items-center gap-2 pt-1">
              <div className="h-24 w-24 rounded-2xl bg-[#FF7A00]/10 flex items-center justify-center overflow-hidden">
                {logo ? <img src={logo} alt="" className="h-full w-full object-cover" /> : <Store className="h-9 w-9 text-[#FF7A00]" />}
              </div>
              <p className="text-base font-bold leading-tight text-center">{nombre || 'Tu local'}</p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Abierto ahora
              </p>
            </div>

            {/* Pedido entre amigos (fiel, informativo en el preview) */}
            <button
              onClick={() => toast.info('Tus clientes pueden armar un pedido en grupo compartiendo un link')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 hover:border-zinc-300 transition-all active:scale-[0.98] text-left"
            >
              <div className="h-9 w-9 rounded-xl bg-zinc-200/70 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold leading-tight">Pedido entre amigos</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">Compartí un link · cada uno elige lo suyo</p>
              </div>
              <span className="flex items-center gap-0.5 text-[11px] font-semibold text-muted-foreground border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5">
                Crear <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </button>

            {/* Productos */}
            {productos.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Menú</h3>
                <div className="grid grid-cols-1 gap-3">
                  {productos.map(p => (
                    <ProductoCard key={p.id} producto={p} onClick={() => abrirDetalle(p)} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground opacity-60">
                <Package className="h-9 w-9 mb-2" />
                <p className="text-sm">Sin productos cargados.</p>
              </div>
            )}
          </div>
        </div>

        {/* ─────────────── Botón flotante "Ver Pedido" ─────────────── */}
        <div className={cn(
          "absolute bottom-5 left-0 right-0 flex justify-center z-20 transition-all duration-500",
          cartCount > 0 && !carritoAbierto && !detalle ? "translate-y-0 opacity-100" : "translate-y-24 opacity-0 pointer-events-none"
        )}>
          <button
            onClick={() => setCarritoAbierto(true)}
            className="group relative flex items-center gap-3.5 pl-5 pr-6 py-3 rounded-full shadow-2xl bg-zinc-900 text-white active:scale-95 transition-all duration-300"
          >
            <span className="absolute -top-2 -right-1 bg-red-500 text-white text-[10px] font-bold h-5 min-w-[20px] px-1 flex items-center justify-center rounded-full border-2 border-white dark:border-zinc-950">
              {cartCount}
            </span>
            <div className="flex items-center gap-2">
              <Receipt className="h-4.5 w-4.5 opacity-90" />
              <span className="font-semibold text-sm">Ver Pedido</span>
            </div>
            <span className="h-4 w-px bg-white/20" />
            <span className="font-bold text-sm font-mono">{money(itemsTotal)}</span>
          </button>
        </div>

        {/* ─────────────── Drawer de detalle de producto ─────────────── */}
        {detalle && (
          <div className="absolute inset-0 z-30 bg-black/40 animate-in fade-in duration-200" onClick={cerrarDetalle} />
        )}
        <div className={cn(
          "absolute inset-x-0 bottom-0 z-40 transition-transform duration-300 ease-out",
          detalle ? "translate-y-0" : "translate-y-full pointer-events-none"
        )}>
          {detalle && (
            <div className="bg-white dark:bg-zinc-950 rounded-t-3xl overflow-hidden shadow-[0_-12px_40px_rgba(0,0,0,0.28)]">
              {/* Imagen/placeholder */}
              <div className="relative h-40 w-full bg-gradient-to-br from-[#FF7A00]/25 via-[#FF7A00]/10 to-transparent flex items-center justify-center">
                <span className="text-[90px] font-black leading-none text-[#FF7A00]/20 select-none">
                  {(detalle.nombre || '?').charAt(0).toUpperCase()}
                </span>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 px-5 pb-4 flex items-end justify-between">
                  <h3 className="text-xl font-bold text-white drop-shadow">{detalle.nombre}</h3>
                  <p className="text-lg font-bold text-white drop-shadow">{money(Number(detalle.precio))}</p>
                </div>
                <div className="pointer-events-none absolute inset-x-0 top-2.5 flex justify-center">
                  <span className="h-1.5 w-10 rounded-full bg-white/60" />
                </div>
              </div>

              <div className="px-5 pt-4 pb-6 space-y-4">
                <p className="text-sm leading-relaxed text-muted-foreground">{detalle.descripcion || 'Sin descripción.'}</p>

                {addCount === 0 ? (
                  <button
                    onClick={agregarDesdeDetalle}
                    className="w-full h-14 rounded-2xl bg-[#FF7A00] text-white font-semibold text-[15px] active:scale-[0.98] transition-all"
                  >
                    Agregar · {money(Number(detalle.precio))}
                  </button>
                ) : (
                  <div className="space-y-2 animate-in fade-in">
                    <button
                      onClick={agregarDesdeDetalle}
                      className="w-full h-14 rounded-2xl bg-emerald-500 text-white font-semibold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                    >
                      <Check className="h-5 w-5" /> Agregar otro igual{addCount > 1 ? ` · x${addCount}` : ''}
                    </button>
                    <button
                      onClick={cerrarDetalle}
                      className="w-full h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 font-semibold text-[15px] active:scale-[0.98] transition-all"
                    >
                      Cerrar
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─────────────── Drawer del carrito / checkout ─────────────── */}
        {carritoAbierto && (
          <div className="absolute inset-0 z-30 bg-black/40 animate-in fade-in duration-200" onClick={cerrarCarrito} />
        )}
        <div className={cn(
          "absolute inset-x-0 bottom-0 z-40 transition-transform duration-300 ease-out",
          carritoAbierto ? "translate-y-0" : "translate-y-full pointer-events-none"
        )}>
          <div className="relative bg-white dark:bg-zinc-950 rounded-t-3xl shadow-[0_-12px_40px_rgba(0,0,0,0.28)] flex flex-col overflow-hidden" style={{ maxHeight: 524 }}>
            {enviando && (
              <div className="absolute inset-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm z-20 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-7 w-7 animate-spin text-[#FF7A00]" />
                  <p className="text-sm font-medium">Enviando pedido…</p>
                </div>
              </div>
            )}

            {/* Handle */}
            <div className="shrink-0 pt-2.5">
              <div className="flex justify-center pb-1"><span className="h-1.5 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700" /></div>
            </div>

            {!enCheckout ? (
              /* ---- Lista de items (cada agregado es un item independiente) ---- */
              <>
                <div className="flex items-center justify-between px-4 py-2 shrink-0">
                  <span className="w-8" />
                  <span className="text-lg font-extrabold">Tu Pedido</span>
                  <span className="w-8" />
                </div>

                {cartCount === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center gap-3 opacity-60 px-5 py-12">
                    <div className="bg-zinc-100 dark:bg-zinc-800 p-5 rounded-full"><UtensilsCrossed className="h-8 w-8" /></div>
                    <p className="text-sm font-medium">El pedido está vacío.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 min-h-0">
                      {cart.map(line => {
                        const p = findProducto(line.productoId)
                        if (!p) return null
                        return (
                          <div key={line.uid} className="flex gap-3 p-3 rounded-2xl border border-[#FF7A00]/20 bg-zinc-50 dark:bg-zinc-900">
                            <div className="h-16 w-16 shrink-0 rounded-xl bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                              <Utensils className="h-5 w-5 text-[#FF7A00]" />
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                              <div className="flex justify-between items-start gap-2">
                                <p className="font-bold text-sm truncate">{p.nombre}</p>
                                <p className="font-bold text-sm shrink-0">{money(Number(p.precio))}</p>
                              </div>
                              <div className="flex items-center justify-end mt-2">
                                <button onClick={() => removeLine(line.uid)} className="h-8 w-8 flex items-center justify-center rounded-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="shrink-0 p-4 border-t border-zinc-100 dark:border-zinc-800">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-muted-foreground text-sm">Total a pagar</span>
                        <span className="text-2xl font-black tracking-tight">{money(itemsTotal)}</span>
                      </div>
                      <button onClick={irACheckout} className="w-full h-12 rounded-xl bg-[#FF7A00] text-white font-bold text-[15px] active:scale-[0.98] transition-all">
                        Continuar
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : (
              /* ---- Checkout por pasos ---- */
              <>
                {/* Header: atrás + título + progreso */}
                <div className="shrink-0">
                  <div className="flex items-center justify-between px-3 py-2">
                    <button onClick={handleAtras} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <span className="text-lg font-extrabold">{tituloPaso[PASOS[paso]]}</span>
                    <span className="text-xs font-semibold text-muted-foreground w-8 text-center">{paso + 1}/{PASOS.length}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-4 pb-3">
                    {PASOS.map((_, i) => (
                      <div key={i} className={cn("h-1 rounded-full flex-1 transition-all duration-300", i <= paso ? "bg-[#FF7A00]" : "bg-zinc-200 dark:bg-zinc-800")} />
                    ))}
                  </div>
                </div>

                {/* Contenido del paso */}
                <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0">
                  {PASOS[paso] === 'tipo' && (
                    <div className="bg-zinc-100 dark:bg-zinc-900 rounded-2xl p-1 grid grid-cols-2 gap-1 animate-in fade-in">
                      {([
                        { id: 'delivery', icon: MapPin, label: 'Delivery' },
                        { id: 'takeaway', icon: Store, label: 'Take Away' },
                      ] as const).map(t => (
                        <button
                          key={t.id}
                          onClick={() => setTipoPedido(t.id)}
                          className={cn(
                            "flex items-center justify-center gap-2 py-4 rounded-xl transition-all",
                            tipoPedido === t.id ? "bg-white dark:bg-zinc-800 shadow-sm" : ""
                          )}
                        >
                          <t.icon className={cn("h-4 w-4", tipoPedido === t.id ? "text-[#FF7A00]" : "text-muted-foreground")} />
                          <span className={cn("text-sm font-semibold", tipoPedido === t.id ? "text-foreground" : "text-muted-foreground")}>{t.label}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {PASOS[paso] === 'datos' && (
                    <div className="space-y-3 animate-in fade-in">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">Nombre</label>
                        <input value={nombreCliente} onChange={e => setNombreCliente(e.target.value)} placeholder="Quien recibe el pedido" className={inputCls} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">Celular</label>
                        <input value={telefono} onChange={e => setTelefono(e.target.value.replace(/\D/g, ''))} type="tel" placeholder="Ej: 5491112345678" className={inputCls} />
                      </div>
                    </div>
                  )}

                  {PASOS[paso] === 'ubicacion' && (
                    tipoPedido === 'delivery' ? (
                      <div className="space-y-3 animate-in fade-in">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">Dirección de entrega</label>
                          <input placeholder="Ej: Av. Corrientes 1234" className={inputCls} />
                        </div>
                        <div className="flex items-center justify-between px-4 py-3 bg-zinc-100 dark:bg-zinc-900 rounded-2xl">
                          <span className="flex items-center gap-2.5 text-sm font-medium">
                            <Truck className="h-4 w-4 text-muted-foreground" /> Envío
                          </span>
                          <span className="text-sm font-bold">{envio === 0 ? 'Gratis' : money(envio)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="animate-in fade-in">
                        {direccion ? (
                          <div className="flex items-center gap-2.5 px-4 py-3.5 bg-zinc-100 dark:bg-zinc-900 rounded-2xl">
                            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-sm text-muted-foreground">Retirás en <span className="font-semibold text-foreground">{direccion}</span></span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2.5 px-4 py-3.5 bg-zinc-100 dark:bg-zinc-900 rounded-2xl">
                            <Store className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-sm text-muted-foreground">Retirás en el local</span>
                          </div>
                        )}
                      </div>
                    )
                  )}

                  {PASOS[paso] === 'extras' && (
                    <div className="space-y-4 animate-in fade-in">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">Notas <span className="normal-case font-normal">(opcional)</span></label>
                        <textarea value={notas} onChange={e => setNotas(e.target.value)} placeholder="Ej: El timbre no anda…" rows={2}
                          className="w-full rounded-2xl bg-zinc-100 dark:bg-zinc-800 border-0 outline-none focus:ring-2 focus:ring-[#FF7A00]/30 resize-none text-sm px-4 py-3 transition-all" />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">Método de pago</label>
                        <div className="space-y-1.5">
                          {metodos.map(m => {
                            const sel = metodoPago === m.id
                            return (
                              <button key={m.id} onClick={() => setMetodoPago(m.id)}
                                className={cn("w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all", sel ? "bg-[#FF7A00]/10" : "bg-zinc-100 dark:bg-zinc-900")}>
                                <span className="flex items-center gap-3">
                                  <m.icon className={cn("h-4 w-4", sel ? "text-[#FF7A00]" : "text-muted-foreground")} />
                                  <span className="text-left">
                                    <span className="block text-sm font-semibold">{m.label}</span>
                                    <span className="block text-[11px] text-muted-foreground">{m.desc}</span>
                                  </span>
                                </span>
                                {sel && <Check className="h-4 w-4 text-[#FF7A00] shrink-0" />}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      <div className="bg-zinc-100 dark:bg-zinc-900 rounded-2xl px-4 py-3.5 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal · {cartCount} items</span>
                          <span className="font-semibold">{money(itemsTotal)}</span>
                        </div>
                        {tipoPedido === 'delivery' && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Delivery</span>
                            <span className="font-semibold">{envio === 0 ? 'Gratis' : money(envio)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-base pt-2 border-t border-zinc-200 dark:border-zinc-800">
                          <span>Total</span>
                          <span>{money(total)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="shrink-0 p-4 border-t border-zinc-100 dark:border-zinc-800 space-y-2.5">
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-muted-foreground">Total</span>
                    <span className="text-2xl font-black tracking-tight">{money(total)}</span>
                  </div>
                  <button onClick={handleSiguiente} disabled={enviando}
                    className="w-full h-12 rounded-xl bg-[#FF7A00] text-white font-bold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50">
                    {paso < PASOS.length - 1 ? (
                      'Continuar'
                    ) : enviando ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <><ShoppingBag className="h-4 w-4" /> Confirmar y pedir</>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Tarjeta de producto (réplica del diseño "text-only" de la tienda del cliente) ──
function ProductoCard({ producto, onClick }: { producto: PreviewProduct; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group text-left w-full flex flex-col justify-between min-h-[92px] p-4 rounded-[22px] bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 hover:border-[#FF7A00]/40 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/60 transition-all active:scale-[0.98]"
    >
      <div className="flex-1">
        <h3 className="font-bold text-[15px] leading-snug line-clamp-2">{producto.nombre}</h3>
        {producto.descripcion && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mt-1">{producto.descripcion}</p>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="font-black text-[17px] text-[#FF7A00]">${Number(producto.precio).toLocaleString('es-AR')}</span>
        <span className="h-8 w-8 rounded-full bg-[#FF7A00] text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
          <Plus className="h-4 w-4" />
        </span>
      </div>
    </button>
  )
}
