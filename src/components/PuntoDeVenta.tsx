import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { pedidoUnificadoApi, type PedidoUnificadoItemInput } from '@/lib/api'
import { AddressAutocomplete } from '@/components/AddressAutocomplete'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
    X, Search, Plus, Minus, Trash2, ShoppingBag, Truck, Loader2,
    Banknote, CreditCard, Landmark, Smartphone, ShoppingCart, User, Phone, MapPin, ChevronRight,
} from 'lucide-react'

type Producto = ReturnType<typeof useRestauranteStore.getState>['productos'][number]

interface CartItem {
    key: string
    productoId: number
    nombre: string
    varianteId?: number
    varianteNombre?: string
    precioBase: number
    agregados: Array<{ id: number; nombre: string; precio: string }>
    cantidad: number
}

interface PuntoDeVentaProps {
    onClose: () => void
    onCreated: (pedidoId: number) => void
    sucursalActivaId: number | null
}

const METODOS_PAGO: Array<{ id: string; label: string; icon: React.ElementType }> = [
    { id: 'cash', label: 'Efectivo', icon: Banknote },
    { id: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
    { id: 'manual_transfer', label: 'Transferencia', icon: Landmark },
    { id: 'mercadopago', label: 'Mercado Pago', icon: Smartphone },
]

const itemUnitPrice = (it: CartItem) =>
    it.precioBase + it.agregados.reduce((s, a) => s + (parseFloat(String(a.precio)) || 0), 0)

export default function PuntoDeVenta({ onClose, onCreated, sucursalActivaId }: PuntoDeVentaProps) {
    const token = useAuthStore((s) => s.token)
    const { productos } = useRestauranteStore()

    const [query, setQuery] = useState('')
    const [cart, setCart] = useState<CartItem[]>([])
    const [configProducto, setConfigProducto] = useState<Producto | null>(null)
    const [mobileStep, setMobileStep] = useState<'productos' | 'checkout'>('productos')

    // Datos del cliente
    const [tipo, setTipo] = useState<'delivery' | 'takeaway'>('takeaway')
    const [nombre, setNombre] = useState('')
    const [telefono, setTelefono] = useState('')
    const [direccion, setDireccion] = useState('')
    const [lat, setLat] = useState<number | null>(null)
    const [lng, setLng] = useState<number | null>(null)
    const [notas, setNotas] = useState('')
    const [metodoPago, setMetodoPago] = useState<string>('cash')
    const [pagado, setPagado] = useState(true)
    const [deliveryFee, setDeliveryFee] = useState('')
    const [submitting, setSubmitting] = useState(false)

    // ── Productos filtrados por búsqueda (nombre, descripción o etiquetas/tags) ──
    const productosFiltrados = useMemo(() => {
        const term = query.trim().toLowerCase()
        const activos = productos.filter((p) => p.activo !== false)
        if (!term) return activos
        return activos.filter((p) =>
            p.nombre.toLowerCase().includes(term) ||
            (p.descripcion && p.descripcion.toLowerCase().includes(term)) ||
            (p.etiquetas && p.etiquetas.some((e) => e.nombre.toLowerCase().includes(term)))
        )
    }, [productos, query])

    const porCategoria = useMemo(() => {
        const map: Record<string, Producto[]> = {}
        productosFiltrados.forEach((p) => {
            const cat = p.categoria || 'Sin categoría'
            if (!map[cat]) map[cat] = []
            map[cat].push(p)
        })
        return Object.entries(map).sort((a, b) => {
            if (a[0] === 'Sin categoría') return 1
            if (b[0] === 'Sin categoría') return -1
            return a[0].localeCompare(b[0])
        })
    }, [productosFiltrados])

    const cartTotal = useMemo(
        () => cart.reduce((s, it) => s + itemUnitPrice(it) * it.cantidad, 0),
        [cart]
    )
    const totalItems = useMemo(() => cart.reduce((s, it) => s + it.cantidad, 0), [cart])
    const deliveryFeeNum = tipo === 'delivery' ? parseFloat(deliveryFee) || 0 : 0
    const totalFinal = cartTotal + deliveryFeeNum

    const buildKey = (productoId: number, varianteId: number | undefined, agregados: CartItem['agregados']) =>
        `${productoId}-${varianteId ?? 0}-${agregados.map((a) => a.id).sort((x, y) => x - y).join(',')}`

    const addToCart = (
        producto: Producto,
        variante?: { id: number; nombre: string; precio: string },
        agregados: CartItem['agregados'] = []
    ) => {
        const precioBase = variante ? parseFloat(variante.precio) : parseFloat(producto.precio)
        const key = buildKey(producto.id, variante?.id, agregados)
        setCart((prev) => {
            const existing = prev.find((it) => it.key === key)
            if (existing) {
                return prev.map((it) => (it.key === key ? { ...it, cantidad: it.cantidad + 1 } : it))
            }
            return [
                ...prev,
                {
                    key,
                    productoId: producto.id,
                    nombre: producto.nombre,
                    varianteId: variante?.id,
                    varianteNombre: variante?.nombre,
                    precioBase,
                    agregados,
                    cantidad: 1,
                },
            ]
        })
    }

    const handleProductClick = (producto: Producto) => {
        const tieneVariantes = !!producto.variantes && producto.variantes.length > 0
        const tieneAgregados = !!producto.agregados && producto.agregados.length > 0
        if (tieneVariantes || tieneAgregados) {
            setConfigProducto(producto)
        } else {
            addToCart(producto)
        }
    }

    const changeQty = (key: string, delta: number) => {
        setCart((prev) =>
            prev
                .map((it) => (it.key === key ? { ...it, cantidad: it.cantidad + delta } : it))
                .filter((it) => it.cantidad > 0)
        )
    }

    const removeItem = (key: string) => setCart((prev) => prev.filter((it) => it.key !== key))

    const resetForm = () => {
        setCart([]); setNombre(''); setTelefono(''); setDireccion(''); setLat(null); setLng(null)
        setNotas(''); setMetodoPago('cash'); setPagado(true); setDeliveryFee(''); setTipo('takeaway')
        setQuery(''); setMobileStep('productos')
    }

    const handleSubmit = async () => {
        if (!token) return
        if (cart.length === 0) return toast.error('Agregá al menos un producto')
        if (tipo === 'delivery' && !direccion.trim()) return toast.error('Ingresá la dirección de entrega')

        const items: PedidoUnificadoItemInput[] = cart.map((it) => ({
            productoId: it.productoId,
            varianteId: it.varianteId,
            cantidad: it.cantidad,
            agregados: it.agregados.length ? it.agregados : undefined,
        }))

        setSubmitting(true)
        try {
            const common = {
                nombreCliente: nombre.trim() || undefined,
                telefono: telefono.trim() || undefined,
                notas: notas.trim() || undefined,
                anotadoManualmente: true,
                pagado,
                metodoPago,
                sucursalId: sucursalActivaId ?? undefined,
                items,
            }
            const data =
                tipo === 'delivery'
                    ? {
                          tipo: 'delivery' as const,
                          direccion: direccion.trim(),
                          latitud: lat ?? undefined,
                          longitud: lng ?? undefined,
                          deliveryFee: deliveryFeeNum || undefined,
                          ...common,
                      }
                    : { tipo: 'takeaway' as const, ...common }

            const res: any = await pedidoUnificadoApi.create(token, data)
            if (res.success) {
                toast.success('Pedido anotado correctamente')
                const newId = res.data?.id
                resetForm()
                if (newId) onCreated(newId)
                else onClose()
            } else {
                toast.error(res.message || 'No se pudo crear el pedido')
            }
        } catch (e: any) {
            toast.error('Error al crear el pedido', { description: e?.message })
        } finally {
            setSubmitting(false)
        }
    }

    // ── Sub-componente: panel de checkout (carrito + datos) ──
    const CheckoutPanel = (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {/* Carrito */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                            <ShoppingCart className="h-3.5 w-3.5" /> Pedido ({totalItems})
                        </h3>
                        {cart.length > 0 && (
                            <button onClick={() => setCart([])} className="text-[11px] text-muted-foreground hover:text-red-500 transition-colors">
                                Vaciar
                            </button>
                        )}
                    </div>
                    {cart.length === 0 ? (
                        <p className="text-sm text-muted-foreground/60 py-6 text-center border border-dashed border-border rounded-xl">
                            Tocá productos para agregarlos
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {cart.map((it) => (
                                <div key={it.key} className="flex items-start gap-2 p-2.5 rounded-xl bg-muted/40">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-foreground truncate">
                                            {it.nombre}
                                            {it.varianteNombre && <span className="text-[#FF7A00] text-xs font-medium"> ({it.varianteNombre})</span>}
                                        </p>
                                        {it.agregados.length > 0 && (
                                            <p className="text-[11px] text-muted-foreground truncate">
                                                {it.agregados.map((a) => `+ ${a.nombre}`).join(', ')}
                                            </p>
                                        )}
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            ${itemUnitPrice(it).toLocaleString('es-AR', { minimumFractionDigits: 0 })} c/u
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button onClick={() => changeQty(it.key, -1)} className="h-7 w-7 rounded-lg bg-background border border-border flex items-center justify-center hover:bg-accent">
                                            <Minus className="h-3.5 w-3.5" />
                                        </button>
                                        <span className="w-5 text-center text-sm font-bold">{it.cantidad}</span>
                                        <button onClick={() => changeQty(it.key, 1)} className="h-7 w-7 rounded-lg bg-background border border-border flex items-center justify-center hover:bg-accent">
                                            <Plus className="h-3.5 w-3.5" />
                                        </button>
                                        <button onClick={() => removeItem(it.key)} className="h-7 w-7 rounded-lg text-red-500 hover:bg-red-500/10 flex items-center justify-center">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Tipo de pedido */}
                <div>
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Tipo</Label>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => setTipo('takeaway')}
                            className={cn('flex items-center justify-center gap-1.5 h-10 rounded-xl border text-sm font-semibold transition-colors',
                                tipo === 'takeaway' ? 'border-[#FF7A00] bg-[#FF7A00]/10 text-[#FF7A00]' : 'border-border text-muted-foreground hover:bg-accent')}
                        >
                            <ShoppingBag className="h-4 w-4" /> Takeaway
                        </button>
                        <button
                            onClick={() => setTipo('delivery')}
                            className={cn('flex items-center justify-center gap-1.5 h-10 rounded-xl border text-sm font-semibold transition-colors',
                                tipo === 'delivery' ? 'border-[#FF7A00] bg-[#FF7A00]/10 text-[#FF7A00]' : 'border-border text-muted-foreground hover:bg-accent')}
                        >
                            <Truck className="h-4 w-4" /> Delivery
                        </button>
                    </div>
                </div>

                {/* Datos del cliente */}
                <div className="space-y-3">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><User className="h-3.5 w-3.5" />Nombre</Label>
                        <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del cliente" className="h-11 rounded-xl" />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />Celular</Label>
                        <Input value={telefono} onChange={(e) => setTelefono(e.target.value.replace(/\D/g, ''))} placeholder="Ej: 3415123456" inputMode="tel" className="h-11 rounded-xl" />
                    </div>
                    {tipo === 'delivery' && (
                        <>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />Dirección</Label>
                                <AddressAutocomplete
                                    value={direccion}
                                    onChange={(addr, newLat, newLng) => { setDireccion(addr); setLat(newLat); setLng(newLng) }}
                                    placeholder="Calle y número..."
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-muted-foreground">Costo de envío</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">$</span>
                                    <Input value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0" inputMode="decimal" className="h-11 rounded-xl pl-7" />
                                </div>
                            </div>
                        </>
                    )}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground">Notas</Label>
                        <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Aclaraciones..." className="rounded-xl resize-none min-h-[60px]" />
                    </div>
                </div>

                {/* Método de pago */}
                <div>
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Método de pago</Label>
                    <div className="grid grid-cols-2 gap-2">
                        {METODOS_PAGO.map((m) => {
                            const Icon = m.icon
                            const selected = metodoPago === m.id
                            return (
                                <button
                                    key={m.id}
                                    onClick={() => setMetodoPago(m.id)}
                                    className={cn('flex items-center gap-2 h-10 px-3 rounded-xl border text-sm font-semibold transition-colors',
                                        selected ? 'border-[#FF7A00] bg-[#FF7A00]/10 text-[#FF7A00]' : 'border-border text-muted-foreground hover:bg-accent')}
                                >
                                    <Icon className="h-4 w-4 shrink-0" /> {m.label}
                                </button>
                            )
                        })}
                    </div>
                    <div className="flex items-center justify-between mt-3 px-1">
                        <span className="text-sm font-medium text-foreground">Pedido pagado</span>
                        <Switch checked={pagado} onCheckedChange={setPagado} />
                    </div>
                </div>
            </div>

            {/* Footer total + confirmar */}
            <div className="shrink-0 border-t border-border p-4 bg-background">
                {tipo === 'delivery' && deliveryFeeNum > 0 && (
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Productos</span><span>${cartTotal.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
                    </div>
                )}
                {tipo === 'delivery' && deliveryFeeNum > 0 && (
                    <div className="flex justify-between text-xs text-muted-foreground mb-2">
                        <span>Envío</span><span>${deliveryFeeNum.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
                    </div>
                )}
                <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-foreground">Total</span>
                    <span className="text-2xl font-black text-[#FF7A00]">${totalFinal.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
                </div>
                <Button
                    onClick={handleSubmit}
                    disabled={submitting || cart.length === 0}
                    className="w-full h-12 rounded-xl bg-[#FF7A00] hover:bg-[#E66E00] text-white font-bold text-base"
                >
                    {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Anotar pedido'}
                </Button>
            </div>
        </div>
    )

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-border bg-background">
                <div className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-[#FF7A00]" />
                    <span className="font-bold text-sm">Anotar pedido (POS)</span>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* ── Productos ── */}
                <div className={cn('flex-1 flex-col overflow-hidden', mobileStep === 'productos' ? 'flex' : 'hidden lg:flex')}>
                    <div className="p-3 border-b border-border">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                            <Input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Buscar producto o tag..."
                                className="h-10 pl-10 rounded-xl"
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3">
                        {productosFiltrados.length === 0 ? (
                            <p className="text-sm text-muted-foreground/60 py-12 text-center">No se encontraron productos.</p>
                        ) : (
                            porCategoria.map(([cat, items]) => (
                                <div key={cat} className="mb-5">
                                    <h4 className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-2">{cat}</h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {items.map((p) => (
                                            <button
                                                key={p.id}
                                                onClick={() => handleProductClick(p)}
                                                className="text-left rounded-xl border border-border bg-muted/30 hover:bg-muted/60 hover:border-[#FF7A00]/40 transition-all p-2.5 active:scale-[0.98]"
                                            >
                                                <p className="text-xs font-semibold text-foreground leading-tight line-clamp-2 min-h-[2rem]">{p.nombre}</p>
                                                <div className="flex items-center justify-between mt-1.5">
                                                    <span className="text-sm font-bold text-[#FF7A00]">
                                                        ${parseFloat(p.precio).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                                    </span>
                                                    {((p.variantes?.length ?? 0) > 0 || (p.agregados?.length ?? 0) > 0) ? (
                                                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                                    ) : (
                                                        <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    {/* Botón flotante mobile para ir al checkout */}
                    <div className="lg:hidden shrink-0 p-3 border-t border-border">
                        <Button onClick={() => setMobileStep('checkout')} className="w-full h-12 rounded-xl bg-[#FF7A00] hover:bg-[#E66E00] text-white font-bold">
                            Ver pedido ({totalItems}) · ${totalFinal.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                        </Button>
                    </div>
                </div>

                {/* ── Checkout (sidebar desktop / paso mobile) ── */}
                <div className={cn('w-full lg:w-[380px] xl:w-[420px] shrink-0 lg:border-l border-border bg-muted/10',
                    mobileStep === 'checkout' ? 'flex flex-col' : 'hidden lg:flex lg:flex-col')}>
                    <div className="lg:hidden shrink-0 p-2 border-b border-border">
                        <button onClick={() => setMobileStep('productos')} className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground px-2 py-1">
                            <ChevronRight className="h-4 w-4 rotate-180" /> Seguir agregando
                        </button>
                    </div>
                    {CheckoutPanel}
                </div>
            </div>

            {/* ── Overlay configuración de producto (variantes / agregados) ── */}
            {configProducto && (
                <ProductConfigOverlay
                    producto={configProducto}
                    onClose={() => setConfigProducto(null)}
                    onConfirm={(variante, agregados) => { addToCart(configProducto, variante, agregados); setConfigProducto(null) }}
                />
            )}
        </div>
    )
}

// ─────────────────────────────────────────────
// OVERLAY: selección de variante + agregados
// ─────────────────────────────────────────────
function ProductConfigOverlay({
    producto,
    onClose,
    onConfirm,
}: {
    producto: Producto
    onClose: () => void
    onConfirm: (
        variante: { id: number; nombre: string; precio: string } | undefined,
        agregados: Array<{ id: number; nombre: string; precio: string }>
    ) => void
}) {
    const variantes = producto.variantes ?? []
    const agregadosDisp = producto.agregados ?? []
    const [varianteId, setVarianteId] = useState<number | null>(variantes.length > 0 ? variantes[0].id : null)
    const [agregadosSel, setAgregadosSel] = useState<number[]>([])

    const variante = variantes.find((v) => v.id === varianteId)
    const precioBase = variante ? parseFloat(variante.precio) : parseFloat(producto.precio)
    const agregadosObj = agregadosDisp.filter((a) => agregadosSel.includes(a.id))
    const precioTotal = precioBase + agregadosObj.reduce((s, a) => s + (parseFloat(a.precio) || 0), 0)

    return (
        <div className="absolute inset-0 z-[1002] bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={onClose}>
            <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <span className="font-bold text-sm truncate">{producto.nombre}</span>
                    <button onClick={onClose} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-accent text-muted-foreground">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="p-4 space-y-4 max-h-[55vh] overflow-y-auto">
                    {variantes.length > 0 && (
                        <div>
                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Variante</Label>
                            <div className="space-y-1.5">
                                {variantes.map((v) => (
                                    <button
                                        key={v.id}
                                        onClick={() => setVarianteId(v.id)}
                                        className={cn('w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-colors',
                                            varianteId === v.id ? 'border-[#FF7A00] bg-[#FF7A00]/10 text-[#FF7A00] font-semibold' : 'border-border hover:bg-accent')}
                                    >
                                        <span>{v.nombre}</span>
                                        <span className="font-bold">${parseFloat(v.precio).toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {agregadosDisp.length > 0 && (
                        <div>
                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Agregados</Label>
                            <div className="space-y-1.5">
                                {agregadosDisp.map((a) => {
                                    const sel = agregadosSel.includes(a.id)
                                    return (
                                        <button
                                            key={a.id}
                                            onClick={() => setAgregadosSel((prev) => sel ? prev.filter((x) => x !== a.id) : [...prev, a.id])}
                                            className={cn('w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-colors',
                                                sel ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold' : 'border-border hover:bg-accent')}
                                        >
                                            <span className="flex items-center gap-2">
                                                <span className={cn('h-4 w-4 rounded border flex items-center justify-center', sel ? 'bg-emerald-500 border-emerald-500' : 'border-muted-foreground/40')}>
                                                    {sel && <Plus className="h-3 w-3 text-white rotate-45" />}
                                                </span>
                                                {a.nombre}
                                            </span>
                                            <span className="font-bold">+${parseFloat(a.precio).toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-border">
                    <Button
                        onClick={() => onConfirm(variante, agregadosObj)}
                        className="w-full h-11 rounded-xl bg-[#FF7A00] hover:bg-[#E66E00] text-white font-bold"
                    >
                        Agregar · ${precioTotal.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                    </Button>
                </div>
            </div>
        </div>
    )
}
