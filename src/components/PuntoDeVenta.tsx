import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { pedidoUnificadoApi, type PedidoUnificadoItemInput } from '@/lib/api'
import { AddressAutocomplete } from '@/components/AddressAutocomplete'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { POS_TIPOS_ORDER, usePosConfig, type PosMetodoPago } from '@/lib/posConfig'
import {
    X, Search, Plus, Minus, Trash2, ShoppingBag, Truck, Loader2, Armchair,
    Banknote, CreditCard, Landmark, Smartphone, ShoppingCart, User, Phone, MapPin, ChevronRight, Eye, EyeOff,
} from 'lucide-react'

type Producto = ReturnType<typeof useRestauranteStore.getState>['productos'][number]

interface CartItem {
    key: string
    productoId: number
    nombre: string
    varianteId?: number
    varianteNombre?: string
    varianteSecundariaId?: number
    varianteSecundariaNombre?: string
    precioBase: number
    ingredientesExcluidos: number[]
    agregados: Array<{ id: number; nombre: string; precio: string }>
    cantidad: number
}

interface PersistedPosDraft {
    cart: CartItem[]
    tipo: 'delivery' | 'takeaway' | 'mesa'
    nombre: string
    telefono: string
    direccion: string
    notas: string
    metodoPago: string
    deliveryFee: string
}

export interface PosDraftItem {
    key: string
    nombre: string
    varianteNombre?: string
    varianteSecundariaNombre?: string
    ingredientesExcluidosNombres?: string[]
    cantidad: number
    precioUnitario: number
}

export interface PosDraft {
    tipo: 'delivery' | 'takeaway' | 'mesa'
    nombreCliente: string
    telefono: string
    direccion: string
    notas: string
    metodoPago: string
    pagado: boolean
    deliveryFee: number
    items: PosDraftItem[]
    subtotal: number
    total: number
    submitting: boolean
    mesaLocalId?: number
    mesaNombre?: string
}

export interface PosEditablePedido {
    id: number
    version: number
    tipo: 'delivery' | 'takeaway' | 'mesa'
    nombreCliente?: string | null
    telefono?: string | null
    direccion?: string | null
    latitud?: string | number | null
    longitud?: string | number | null
    notas?: string | null
    metodoPago?: string | null
    pagado?: boolean
    deliveryFee?: string | number | null
    mesaLocalId?: number | null
    mesaNombre?: string | null
    items: Array<{
        id: number
        productoId: number
        nombreProducto: string
        varianteId?: number | null
        varianteNombre?: string | null
        varianteSecundariaId?: number | null
        varianteSecundariaNombre?: string | null
        cantidad: number
        precioUnitario: string | number
        ingredientesExcluidos?: number[] | null
        agregados?: unknown
    }>
}

export type PosDraftUpdate = Partial<Pick<PosDraft,
    'tipo' | 'nombreCliente' | 'telefono' | 'direccion' | 'notas' | 'metodoPago' | 'deliveryFee'
>>

/** Handle expuesto al padre (Dashboard) para operar el borrador del POS desde la comanda. */
export interface PuntoDeVentaHandle {
    /** Quita un ítem del borrador por su key. */
    removeItem: (key: string) => void
    /** Abre la edición de una fila concreta, sin mezclarla con otra igual. */
    editItem: (key: string) => void
    /** Actualiza los datos que se editan inline en la comanda desktop. */
    updateDraft: (changes: PosDraftUpdate) => void
    /** Pide descartar el borrador actual antes de cerrar el POS. */
    requestClose: () => void
    /** Confirma el borrador desde la comanda desktop. */
    submitDraft: () => void
    /** Limpia el borrador desde la comanda desktop, sin confirmación. */
    clearDraft: () => void
    /** Lleva el cursor al buscador de productos. */
    focusProductSearch: () => void
}

interface PuntoDeVentaProps {
    onClose: () => void
    onCreated: (pedidoId: number) => void
    onUpdated?: (pedido: PosEditablePedido) => void
    sucursalActivaId: number | null
    /** El padre (Dashboard) espeja este borrador en la comanda de la derecha en vivo. */
    onDraftChange?: (draft: PosDraft | null) => void
    /** Volver al grid desde un pedido existente conserva el borrador. */
    onStartDraft?: () => void
    mesaAsignada?: { id: number; nombre: string } | null
    /** Abre el plano para elegir una mesa libre sin alterar todavía el borrador. */
    onRequestMesa?: () => void
    /** Desasigna la mesa al cambiar el borrador a delivery o takeaway. */
    onClearMesa?: () => void
    /** Sólo el borrador activo captura la escritura rápida para buscar productos. */
    autoFocusSearch?: boolean
    /** Pedido POS que se carga como borrador editable. */
    initialPedido?: PosEditablePedido | null
}

const METODOS_PAGO: Array<{ id: PosMetodoPago; label: string; icon: React.ElementType }> = [
    { id: 'cash', label: 'Efectivo', icon: Banknote },
    { id: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
    { id: 'manual_transfer', label: 'Transferencia', icon: Landmark },
    { id: 'mercadopago', label: 'Mercado Pago', icon: Smartphone },
]

const itemUnitPrice = (it: CartItem) =>
    it.precioBase + it.agregados.reduce((s, a) => s + (parseFloat(String(a.precio)) || 0), 0)

/** El toggle se usa sólo con puntero: no interrumpe el recorrido de carga del pedido. */
const FieldVisibilityButton = ({ visible, fieldName, onToggle }: { visible: boolean; fieldName: string; onToggle: () => void }) => (
    <button
        type="button"
        tabIndex={-1}
        aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${fieldName}`}
        title={`${visible ? 'Ocultar' : 'Mostrar'} ${fieldName}`}
        onClick={onToggle}
        className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
    >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
)

const PuntoDeVenta = forwardRef<PuntoDeVentaHandle, PuntoDeVentaProps>(function PuntoDeVenta(
    { onClose, onCreated, onUpdated, sucursalActivaId, onDraftChange, onStartDraft, mesaAsignada = null, onRequestMesa, onClearMesa, autoFocusSearch = true, initialPedido = null },
    ref
) {
    const token = useAuthStore((s) => s.token)
    const { productos } = useRestauranteStore()
    // La configuración del POS (qué datos/opciones se cargan) vive en localStorage.
    const config = usePosConfig()
    const tiposHabilitados = useMemo(
        () => POS_TIPOS_ORDER.filter((tipo) => config.tipos[tipo]),
        [config],
    )
    const metodosHabilitados = useMemo(
        () => METODOS_PAGO.filter((metodo) => config.metodosPago[metodo.id]),
        [config],
    )

    const [query, setQuery] = useState('')
    const searchInputRef = useRef<HTMLInputElement>(null)
    const [cart, setCart] = useState<CartItem[]>([])
    const [configProducto, setConfigProducto] = useState<{
        producto: Producto
        anchor: DOMRect
        editKey?: string
        initialItem?: CartItem
    } | null>(null)
    const [mobileStep, setMobileStep] = useState<'productos' | 'checkout'>('productos')

    // Datos del cliente
    const [tipo, setTipo] = useState<'delivery' | 'takeaway' | 'mesa'>('takeaway')
    const [nombre, setNombre] = useState('')
    const [telefono, setTelefono] = useState('')
    const [nombreVisible, setNombreVisible] = useState(true)
    const [telefonoVisible, setTelefonoVisible] = useState(true)
    const [direccion, setDireccion] = useState('')
    const [lat, setLat] = useState<number | null>(null)
    const [lng, setLng] = useState<number | null>(null)
    const [notas, setNotas] = useState('')
    const [metodoPago, setMetodoPago] = useState<string>('cash')
    // Las altas manuales nacen cobradas. Al editar se conserva el estado de
    // pago existente: cambiar productos o datos del cliente no confirma cobros.
    const pagado = initialPedido?.pagado ?? true
    const [deliveryFee, setDeliveryFee] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const modoEdicion = initialPedido != null
    // Una edición no comparte almacenamiento con el borrador de alta ni cambia
    // de clave al reasignar la mesa; eso evita rehidratar y perder cambios.
    const storageKey = modoEdicion
        ? `piru:pos-edit:${initialPedido.id}`
        : `piru:pos-draft:${sucursalActivaId ?? 'sin-sucursal'}:${mesaAsignada?.id ?? 'sin-mesa'}`
    const [hydratedStorageKey, setHydratedStorageKey] = useState<string | null>(null)

    const focusProductSearch = () => searchInputRef.current?.focus()

    // En el borrador, el lector/teclado debe poder empezar a buscar sin un click
    // previo. No se roba el foco de campos que el usuario haya elegido de forma
    // explícita, ni del configurador de un producto abierto.
    useEffect(() => {
        if (!autoFocusSearch || configProducto) return
        const frame = window.requestAnimationFrame(focusProductSearch)
        return () => window.cancelAnimationFrame(frame)
    }, [autoFocusSearch, configProducto])

    useEffect(() => {
        if (!autoFocusSearch || configProducto) return

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return

            const target = event.target as HTMLElement | null
            // Un campo elegido por el usuario conserva siempre la escritura.
            if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
            if (document.activeElement === searchInputRef.current) return

            event.preventDefault()
            focusProductSearch()
            setQuery((current) => current + event.key)
        }

        window.addEventListener('keydown', handleKeyDown, true)
        return () => window.removeEventListener('keydown', handleKeyDown, true)
    }, [autoFocusSearch, configProducto])

    // El borrador sobrevive una recarga accidental dentro de la misma pestaña. Se
    // separa por sucursal para no cruzar comandas entre locales del mismo negocio.
    useEffect(() => {
        if (initialPedido) {
            const parseAgregados = (value: unknown): CartItem['agregados'] => {
                if (typeof value === 'string') {
                    try { return parseAgregados(JSON.parse(value)) } catch { return [] }
                }
                if (!Array.isArray(value)) return []
                return value.flatMap((agregado) => {
                    if (!agregado || typeof agregado !== 'object') return []
                    const candidate = agregado as { id?: unknown; nombre?: unknown; precio?: unknown }
                    const id = Number(candidate.id)
                    if (!Number.isInteger(id) || id <= 0) return []
                    return [{ id, nombre: String(candidate.nombre ?? ''), precio: String(candidate.precio ?? 0) }]
                })
            }
            setCart(initialPedido.items.map((item) => {
                const agregados = parseAgregados(item.agregados)
                const precioUnitario = Number(item.precioUnitario) || 0
                return {
                    key: `pedido-${initialPedido.id}-item-${item.id}`,
                    productoId: item.productoId,
                    nombre: item.nombreProducto,
                    varianteId: item.varianteId ?? undefined,
                    varianteNombre: item.varianteNombre ?? undefined,
                    varianteSecundariaId: item.varianteSecundariaId ?? undefined,
                    varianteSecundariaNombre: item.varianteSecundariaNombre ?? undefined,
                    precioBase: Math.max(0, precioUnitario - agregados.reduce((sum, agregado) => sum + (Number(agregado.precio) || 0), 0)),
                    ingredientesExcluidos: Array.isArray(item.ingredientesExcluidos) ? item.ingredientesExcluidos : [],
                    agregados,
                    cantidad: item.cantidad,
                }
            }))
            setTipo(initialPedido.tipo)
            setNombre(initialPedido.nombreCliente || '')
            setTelefono(initialPedido.telefono || '')
            setDireccion(initialPedido.direccion || '')
            setLat(initialPedido.latitud == null ? null : Number(initialPedido.latitud))
            setLng(initialPedido.longitud == null ? null : Number(initialPedido.longitud))
            setNotas(initialPedido.notas || '')
            setMetodoPago(initialPedido.metodoPago || 'cash')
            setDeliveryFee(initialPedido.deliveryFee == null ? '' : String(initialPedido.deliveryFee))
            setHydratedStorageKey(null)
            return
        }
        try {
            const saved = sessionStorage.getItem(storageKey)
            if (saved) {
                const parsed = JSON.parse(saved) as Partial<PersistedPosDraft>
                setCart(Array.isArray(parsed.cart) ? parsed.cart : [])
                setTipo(mesaAsignada ? 'mesa' : parsed.tipo === 'delivery' ? 'delivery' : 'takeaway')
                setNombre(typeof parsed.nombre === 'string' ? parsed.nombre : '')
                setTelefono(typeof parsed.telefono === 'string' ? parsed.telefono : '')
                setDireccion(typeof parsed.direccion === 'string' ? parsed.direccion : '')
                setNotas(typeof parsed.notas === 'string' ? parsed.notas : '')
                setMetodoPago(typeof parsed.metodoPago === 'string' ? parsed.metodoPago : 'cash')
                setDeliveryFee(typeof parsed.deliveryFee === 'string' ? parsed.deliveryFee : '')
            } else {
                setCart([]); setNombre(''); setTelefono(''); setDireccion(''); setLat(null); setLng(null)
                setNotas(''); setMetodoPago('cash'); setDeliveryFee(''); setTipo(mesaAsignada ? 'mesa' : 'takeaway')
            }
        } catch {
            sessionStorage.removeItem(storageKey)
        } finally {
            setHydratedStorageKey(storageKey)
        }
    }, [storageKey, initialPedido])

    useEffect(() => {
        setTipo((current) => mesaAsignada ? 'mesa' : current === 'mesa' ? 'takeaway' : current)
    }, [mesaAsignada])

    useEffect(() => {
        if (modoEdicion) return
        if (hydratedStorageKey !== storageKey) return
        const persisted: PersistedPosDraft = { cart, tipo, nombre, telefono, direccion, notas, metodoPago, deliveryFee }
        const hasContent = cart.length > 0 || [nombre, telefono, direccion, notas, deliveryFee].some((value) => value.trim() !== '')
        try {
            if (hasContent) sessionStorage.setItem(storageKey, JSON.stringify(persisted))
            else sessionStorage.removeItem(storageKey)
        } catch {
            // sessionStorage puede estar deshabilitado; el POS sigue funcionando en memoria.
        }
    }, [modoEdicion, hydratedStorageKey, storageKey, cart, tipo, nombre, telefono, direccion, notas, metodoPago, deliveryFee])

    // Si la configuración del POS deshabilitó el tipo o el método de pago del
    // borrador, se pasa al primero habilitado. Al editar se respeta el pedido.
    useEffect(() => {
        if (modoEdicion || mesaAsignada) return
        setTipo((current) => config.tipos[current] ? current : (tiposHabilitados[0] ?? 'takeaway'))
    }, [modoEdicion, mesaAsignada, config, tiposHabilitados])

    useEffect(() => {
        if (modoEdicion) return
        setMetodoPago((current) => config.metodosPago[current as PosMetodoPago] ? current : (metodosHabilitados[0]?.id ?? 'cash'))
    }, [modoEdicion, config, metodosHabilitados])

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

    // ── Borrador en vivo ──
    // Reporta al padre (Dashboard) todo lo anotado hasta ahora para espejarlo
    // en la comanda de la derecha mientras se carga el pedido.
    useEffect(() => {
        if (!onDraftChange) return
        onDraftChange({
            tipo,
            nombreCliente: nombre.trim(),
            telefono: telefono.trim(),
            direccion: direccion.trim(),
            notas: notas.trim(),
            metodoPago,
            pagado,
            deliveryFee: deliveryFeeNum,
            items: cart.map((it) => ({
                key: it.key,
                nombre: it.nombre,
                varianteNombre: it.varianteNombre,
                varianteSecundariaNombre: it.varianteSecundariaNombre,
                ingredientesExcluidosNombres: productos
                    .find((producto) => producto.id === it.productoId)
                    ?.ingredientes
                    ?.filter((ingrediente) => it.ingredientesExcluidos.includes(ingrediente.id))
                    .map((ingrediente) => ingrediente.nombre),
                cantidad: it.cantidad,
                precioUnitario: itemUnitPrice(it),
            })),
            subtotal: cartTotal,
            total: totalFinal,
            submitting,
            mesaLocalId: mesaAsignada?.id,
            mesaNombre: mesaAsignada?.nombre,
        })
    }, [onDraftChange, tipo, nombre, telefono, direccion, notas, metodoPago, pagado, deliveryFeeNum, cart, cartTotal, totalFinal, submitting, mesaAsignada?.nombre, productos])

    const addToCart = (
        producto: Producto,
        variante?: { id: number; nombre: string; precio: string },
        varianteSecundaria?: { id: number; nombre: string; precio: string },
        agregados: CartItem['agregados'] = [],
        ingredientesExcluidos: number[] = []
    ) => {
        const precioBase = (variante ? parseFloat(variante.precio) : parseFloat(producto.precio)) + (varianteSecundaria ? parseFloat(varianteSecundaria.precio) : 0)
        // Cada toque es una fila independiente: dos pedidos iguales pueden requerir
        // cambios distintos después y no deben fusionarse silenciosamente.
        const key = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
        setCart((prev) => [...prev, {
            key,
            productoId: producto.id,
            nombre: producto.nombre,
            varianteId: variante?.id,
            varianteNombre: variante?.nombre,
            varianteSecundariaId: varianteSecundaria?.id,
            varianteSecundariaNombre: varianteSecundaria?.nombre,
            precioBase,
            ingredientesExcluidos,
            agregados,
            cantidad: 1,
        }])
    }

    const handleProductClick = (producto: Producto, anchor: DOMRect) => {
        onStartDraft?.()
        const tieneVariantes = !!producto.variantes && producto.variantes.length > 0
        // Durante la carga sólo las variantes requieren elegir una opción. Los
        // ingredientes se ajustan después, desde la edición del ítem agregado.
        if (tieneVariantes) {
            setConfigProducto({ producto, anchor })
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

    const editItem = (key: string) => {
        const item = cart.find((candidate) => candidate.key === key)
        const producto = item && productos.find((candidate) => candidate.id === item.productoId)
        if (!item || !producto) return
        const centerX = typeof window === 'undefined' ? 0 : window.innerWidth / 2
        const centerY = typeof window === 'undefined' ? 0 : window.innerHeight / 3
        setConfigProducto({
            producto,
            anchor: new DOMRect(centerX, centerY, 0, 0),
            editKey: key,
            initialItem: item,
        })
    }

    const updateDraft = (changes: PosDraftUpdate) => {
        if (changes.tipo) setTipo(changes.tipo)
        if (changes.nombreCliente !== undefined) setNombre(changes.nombreCliente)
        if (changes.telefono !== undefined) setTelefono(changes.telefono.replace(/\D/g, ''))
        if (changes.direccion !== undefined) { setDireccion(changes.direccion); setLat(null); setLng(null) }
        if (changes.notas !== undefined) setNotas(changes.notas)
        if (changes.metodoPago !== undefined) setMetodoPago(changes.metodoPago)
        if (changes.deliveryFee !== undefined) setDeliveryFee(String(changes.deliveryFee))
    }

    const resetForm = () => {
        setCart([]); setNombre(''); setTelefono(''); setDireccion(''); setLat(null); setLng(null)
        setNotas(''); setMetodoPago('cash'); setDeliveryFee(''); setTipo(mesaAsignada ? 'mesa' : 'takeaway')
        setQuery(''); setMobileStep('productos')
        if (!modoEdicion) {
            try { sessionStorage.removeItem(storageKey) } catch { /* noop */ }
        }
    }

    const requestClose = () => {
        const hasContent = cart.length > 0 || [nombre, telefono, direccion, notas, deliveryFee].some((value) => value.trim() !== '')
        if (hasContent && !window.confirm(modoEdicion ? '¿Salir sin guardar los cambios del pedido?' : '¿Descartar este borrador? Los productos y datos cargados se perderán.')) return
        resetForm()
        onClose()
    }

    // La comanda del Dashboard (panel derecho) opera el borrador a través de este handle.
    useImperativeHandle(ref, () => ({ removeItem, editItem, updateDraft, requestClose, submitDraft: handleSubmit, clearDraft: resetForm, focusProductSearch }))

    const handleSubmit = async () => {
        if (!token) return
        if (cart.length === 0) return toast.error('Agregá al menos un producto')
        if (tipo === 'delivery' && config.camposCliente.direccion && !direccion.trim()) return toast.error('Ingresá la dirección de entrega')

        const items: PedidoUnificadoItemInput[] = cart.map((it) => ({
            productoId: it.productoId,
            varianteId: it.varianteId,
            varianteSecundariaId: it.varianteSecundariaId,
            cantidad: it.cantidad,
            ingredientesExcluidos: it.ingredientesExcluidos.length ? it.ingredientesExcluidos : undefined,
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
                tipo === 'delivery' && !mesaAsignada
                    ? {
                          tipo: 'delivery' as const,
                          direccion: direccion.trim(),
                          latitud: lat ?? undefined,
                          longitud: lng ?? undefined,
                          deliveryFee: deliveryFeeNum || undefined,
                          ...common,
                      }
                    : mesaAsignada
                      ? { tipo: 'mesa' as const, mesaLocalId: mesaAsignada.id, consumoEnLocal: true as const, ...common }
                      : { tipo: 'takeaway' as const, ...common }

            const res = (modoEdicion
                ? await pedidoUnificadoApi.updateFromPos(token, initialPedido.id, {
                      version: initialPedido.version,
                      tipo: data.tipo,
                      mesaLocalId: data.tipo === 'mesa' ? data.mesaLocalId : null,
                      nombreCliente: nombre.trim() || null,
                      telefono: telefono.trim() || null,
                      notas: notas.trim() || null,
                      direccion: data.tipo === 'delivery' ? data.direccion : null,
                      latitud: data.tipo === 'delivery' ? data.latitud ?? null : null,
                      longitud: data.tipo === 'delivery' ? data.longitud ?? null : null,
                      deliveryFee: data.tipo === 'delivery' ? deliveryFeeNum : null,
                      metodoPago,
                      pagado,
                      items,
                  })
                : await pedidoUnificadoApi.create(token, data)) as { success?: boolean; data?: PosEditablePedido & { id?: number }; message?: string }
            if (res.success) {
                toast.success(modoEdicion ? 'Pedido actualizado correctamente' : 'Pedido anotado correctamente')
                const newId = res.data?.id
                if (modoEdicion && res.data) onUpdated?.(res.data)
                else {
                    resetForm()
                    // El POS queda listo para anotar el siguiente pedido. El Dashboard
                    // sólo sincroniza el listado; cerrar el POS acá interrumpía ese flujo.
                    if (newId) onCreated(newId)
                }
            } else {
                toast.error(res.message || 'No se pudo crear el pedido')
            }
        } catch (error: unknown) {
            toast.error(modoEdicion ? 'Error al actualizar el pedido' : 'Error al crear el pedido', { description: error instanceof Error ? error.message : undefined })
        } finally {
            setSubmitting(false)
        }
    }

    // Con la configuración del POS, un campo desactivado se oculta por completo
    // (no sólo con el toggle de ojo) y no participa de los datos del borrador.
    const nombreEditable = config.camposCliente.nombre && nombreVisible
    const telefonoEditable = config.camposCliente.telefono && telefonoVisible

    // ── Sub-componente: panel de checkout (carrito + datos) ──
    const CheckoutPanel = (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {/* Carrito — solo mobile. En desktop el borrador vive en la comanda del
                    panel derecho (Dashboard), donde también se quitan ítems. */}
                <div className="lg:hidden">
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
                                            {(it.varianteNombre || it.varianteSecundariaNombre) && <span className="text-[#FF7A00] text-xs font-medium"> ({[it.varianteNombre, it.varianteSecundariaNombre].filter(Boolean).join(' · ')})</span>}
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

                {/* En desktop estos controles viven en la comanda; en mobile este panel es la comanda. */}
                <div className="lg:hidden">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Tipo</Label>
                    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${tiposHabilitados.length}, minmax(0, 1fr))` }}>
                        {tiposHabilitados.includes('delivery') && (
                            <button
                                onClick={() => { onClearMesa?.(); setTipo('delivery') }}
                                className={cn('flex items-center justify-center gap-1.5 h-10 rounded-xl border text-sm font-semibold transition-colors',
                                    tipo === 'delivery' ? 'border-[#FF7A00] bg-[#FF7A00]/10 text-black dark:text-white' : 'border-border text-muted-foreground hover:bg-accent')}
                            >
                                <Truck className="h-4 w-4" /> Delivery
                            </button>
                        )}
                        {tiposHabilitados.includes('mesa') && (
                            <button
                                onClick={onRequestMesa}
                                className={cn('flex items-center justify-center gap-1.5 h-10 rounded-xl border text-sm font-semibold transition-colors',
                                    tipo === 'mesa' ? 'border-[#FF7A00] bg-[#FF7A00]/10 text-black dark:text-white' : 'border-border text-muted-foreground hover:bg-accent')}
                            >
                                <Armchair className="h-4 w-4" /> Mesa
                            </button>
                        )}
                        {tiposHabilitados.includes('takeaway') && (
                            <button
                                onClick={() => { onClearMesa?.(); setTipo('takeaway') }}
                                className={cn('flex items-center justify-center gap-1.5 h-10 rounded-xl border text-sm font-semibold transition-colors',
                                    tipo === 'takeaway' ? 'border-[#FF7A00] bg-[#FF7A00]/10 text-black dark:text-white' : 'border-border text-muted-foreground hover:bg-accent')}
                            >
                                <ShoppingBag className="h-4 w-4" /> Takeaway
                            </button>
                        )}
                    </div>
                    {mesaAsignada && <p className="mt-2 text-center text-xs font-semibold text-[#FF7A00]">Asignado a {mesaAsignada.nombre}</p>}
                </div>

                {/* Datos del cliente */}
                <div className="relative space-y-3 lg:hidden">
                    {nombreEditable && <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><User className="h-3.5 w-3.5" />Nombre</Label>
                            <div className="flex items-center gap-1">
                                <FieldVisibilityButton visible={nombreVisible} fieldName="nombre del cliente" onToggle={() => setNombreVisible((visible) => !visible)} />
                                {config.camposCliente.telefono && <FieldVisibilityButton visible={telefonoVisible} fieldName="celular" onToggle={() => setTelefonoVisible((visible) => !visible)} />}
                            </div>
                        </div>
                        <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del cliente" className="h-11 rounded-xl bg-transparent dark:bg-transparent" />
                    </div>}
                    {telefonoEditable && <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />Celular</Label>
                            {!nombreEditable && <div className="flex items-center gap-1">
                                {config.camposCliente.nombre && <FieldVisibilityButton visible={nombreVisible} fieldName="nombre del cliente" onToggle={() => setNombreVisible((visible) => !visible)} />}
                                <FieldVisibilityButton visible={telefonoVisible} fieldName="celular" onToggle={() => setTelefonoVisible((visible) => !visible)} />
                            </div>}
                        </div>
                        <Input value={telefono} onChange={(e) => setTelefono(e.target.value.replace(/\D/g, ''))} placeholder="Ej: 3415123456" inputMode="tel" className="h-11 rounded-xl bg-transparent dark:bg-transparent" />
                    </div>}
                    {(config.camposCliente.nombre || config.camposCliente.telefono) && !nombreEditable && !telefonoEditable && <div className="absolute right-0 top-0 flex items-center gap-1">
                        {config.camposCliente.nombre && <FieldVisibilityButton visible={nombreVisible} fieldName="nombre del cliente" onToggle={() => setNombreVisible((visible) => !visible)} />}
                        {config.camposCliente.telefono && <FieldVisibilityButton visible={telefonoVisible} fieldName="celular" onToggle={() => setTelefonoVisible((visible) => !visible)} />}
                    </div>}
                    {tipo === 'delivery' && config.camposCliente.direccion && (
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
                                    <Input value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0" inputMode="decimal" className="h-11 rounded-xl pl-7 bg-transparent dark:bg-transparent" />
                                </div>
                            </div>
                        </>
                    )}
                    {config.notas && <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground">Notas</Label>
                        <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Aclaraciones..." className="rounded-xl resize-none min-h-[60px]" />
                    </div>}
                </div>

                {/* Método de pago */}
                {metodosHabilitados.length > 0 && (
                    <div className="lg:hidden">
                        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Método de pago</Label>
                        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${metodosHabilitados.length}, minmax(0, 1fr))` }}>
                            {metodosHabilitados.map((m) => {
                                const Icon = m.icon
                                const selected = metodoPago === m.id
                                return (
                                    <button
                                        key={m.id}
                                        onClick={() => setMetodoPago(m.id)}
                                        className={cn('flex items-center gap-2 h-10 px-3 rounded-xl border text-sm font-semibold transition-colors',
                                            selected ? 'border-[#FF7A00] bg-[#FF7A00]/10 text-black dark:text-white' : 'border-border text-muted-foreground hover:bg-accent')}
                                    >
                                        <Icon className="h-4 w-4 shrink-0" /> {m.label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* En desktop el total y la confirmación viven en la comanda del Dashboard. */}
            <div className="lg:hidden shrink-0 border-t border-border p-4 bg-background">
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
                    {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : modoEdicion ? 'Guardar cambios' : 'Anotar pedido'}
                </Button>
            </div>
        </div>
    )

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
            <div className="shrink-0 flex items-center justify-between px-4 pt-2 bg-background">
                <span className="text-xs font-bold text-muted-foreground">{modoEdicion ? `Editando pedido #${initialPedido.id}` : 'Nuevo pedido'}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={requestClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* ── Productos ── */}
                <div className={cn('flex-1 flex-col overflow-hidden', mobileStep === 'productos' ? 'flex' : 'hidden lg:flex')}>
                    <div className="p-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                            <Input
                                ref={searchInputRef}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    // Enter agrega el primer producto del resultado filtrado directamente al pedido.
                                    if (e.key === 'Enter' && productosFiltrados.length > 0) {
                                        e.preventDefault()
                                        handleProductClick(productosFiltrados[0], e.currentTarget.getBoundingClientRect())
                                    }
                                }}
                                placeholder="Buscar producto o tag..."
                                className="h-10 pl-10 rounded-xl border-0 shadow-sm"
                            />
                        </div>
                    </div>
                    {/* Scroll con scrollbar nunca visible: el scroll entre productos sigue funcionando. */}
                    <div className="flex-1 overflow-y-auto p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {productosFiltrados.length === 0 ? (
                            <p className="text-sm text-muted-foreground/60 py-12 text-center">No se encontraron productos.</p>
                        ) : (
                            porCategoria.map(([cat, items]) => (
                                <div key={cat} className="mb-5">
                                    <h4 className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-2">{cat}</h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                        {items.map((p) => (
                                            <button
                                                key={p.id}
                                                tabIndex={-1}
                                                onClick={(event) => handleProductClick(p, event.currentTarget.getBoundingClientRect())}
                                                className="group min-h-28 text-left rounded-2xl bg-card p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7A00] active:translate-y-0 active:scale-[0.98]"
                                            >
                                                <p className="min-h-[3.5rem] text-base font-semibold leading-snug text-foreground line-clamp-3">{p.nombre}</p>
                                                <div className="flex items-center justify-between mt-3">
                                                    <span className="text-base font-bold text-[#FF7A00]">
                                                        ${parseFloat(p.precio).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                                    </span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    {/* Botón flotante mobile para ir al checkout */}
                    <div className="lg:hidden shrink-0 p-3">
                        <Button onClick={() => setMobileStep('checkout')} className="w-full h-12 rounded-xl bg-[#FF7A00] hover:bg-[#E66E00] text-white font-bold">
                            Ver pedido ({totalItems}) · ${totalFinal.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                        </Button>
                    </div>
                </div>

                {/* ── Checkout (solo paso mobile) ──
                    En desktop la comanda del Dashboard concentra el borrador y la acción. */}
                <div className={cn('w-full shrink-0 bg-muted/10 lg:hidden',
                    mobileStep === 'checkout' ? 'flex flex-col' : 'hidden')}>
                    <div className="lg:hidden shrink-0 p-2">
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
                    producto={configProducto.producto}
                    anchor={configProducto.anchor}
                    onClose={() => setConfigProducto(null)}
                    initialItem={configProducto.initialItem}
                    onConfirm={(variante, varianteSecundaria, agregados, ingredientesExcluidos) => {
                        addToCart(configProducto.producto, variante, varianteSecundaria, agregados, ingredientesExcluidos)
                        setConfigProducto(null)
                    }}
                    onChange={configProducto.editKey ? (variante, varianteSecundaria, agregados, ingredientesExcluidos) => {
                        const precioBase = (variante ? parseFloat(variante.precio) : parseFloat(configProducto.producto.precio)) + (varianteSecundaria ? parseFloat(varianteSecundaria.precio) : 0)
                        setCart((prev) => prev.map((item) => item.key === configProducto.editKey ? {
                            ...item, varianteId: variante?.id, varianteNombre: variante?.nombre, varianteSecundariaId: varianteSecundaria?.id, varianteSecundariaNombre: varianteSecundaria?.nombre, precioBase, agregados, ingredientesExcluidos,
                        } : item))
                    } : undefined}
                />
            )}
        </div>
    )
})

export default PuntoDeVenta

// ─────────────────────────────────────────────
// Popover de configuración: queda anclado a la card en desktop y pasa a hoja inferior
// en touch/viewport chico para que nunca dependa de hover.
// ─────────────────────────────────────────────
function ProductConfigOverlay({
    producto,
    anchor,
    onClose,
    initialItem,
    onConfirm,
    onChange,
}: {
    producto: Producto
    anchor: DOMRect
    onClose: () => void
    initialItem?: CartItem
    onConfirm: (
        variante: { id: number; nombre: string; precio: string } | undefined,
        varianteSecundaria: { id: number; nombre: string; precio: string } | undefined,
        agregados: Array<{ id: number; nombre: string; precio: string }>,
        ingredientesExcluidos: number[]
    ) => void
    onChange?: (
        variante: { id: number; nombre: string; precio: string } | undefined,
        varianteSecundaria: { id: number; nombre: string; precio: string } | undefined,
        agregados: Array<{ id: number; nombre: string; precio: string }>,
        ingredientesExcluidos: number[]
    ) => void
}) {
    const dialogRef = useRef<HTMLDivElement>(null)
    const variantes = producto.variantes ?? []
    const variantesSecundarias = producto.variantesSecundarias ?? []
    const ingredientes = producto.ingredientes ?? []
    const agregadosDisp = producto.agregados ?? []
    // Los ingredientes se modifican sobre un ítem ya agregado. Al cargar uno
    // nuevo, las variantes se confirman directamente sin abrir esa columna.
    const mostrarIngredientes = !!initialItem && ingredientes.length > 0
    const [varianteId, setVarianteId] = useState<number | null>(initialItem?.varianteId ?? (variantes.length > 0 ? variantes[0].id : null))
    const [varianteSecundariaId, setVarianteSecundariaId] = useState<number | null>(initialItem?.varianteSecundariaId ?? (variantesSecundarias.length > 0 ? variantesSecundarias[0].id : null))
    const [ingredientesExcluidos, setIngredientesExcluidos] = useState<number[]>(initialItem?.ingredientesExcluidos ?? [])
    const [agregadosSel, setAgregadosSel] = useState<number[]>(initialItem?.agregados.map((agregado) => agregado.id) ?? [])
    const [isCompact, setIsCompact] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640)

    useEffect(() => {
        const syncViewport = () => setIsCompact(window.innerWidth < 640)
        syncViewport()
        window.addEventListener('resize', syncViewport)
        return () => window.removeEventListener('resize', syncViewport)
    }, [])
    useEffect(() => {
        dialogRef.current?.focus()
    }, [])
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [onClose])

    const variante = variantes.find((v) => v.id === varianteId)
    const varianteSecundaria = variantesSecundarias.find((v) => v.id === varianteSecundariaId)
    const agregadosObj = agregadosDisp.filter((a) => agregadosSel.includes(a.id))
    const confirmarVariante = (seleccionada: typeof variantes[number]) => {
        if (variantesSecundarias.length > 0 && !initialItem) return
        if (initialItem && onChange) onChange(seleccionada, varianteSecundaria, agregadosObj, ingredientesExcluidos)
        else onConfirm(seleccionada, varianteSecundaria, agregadosObj, ingredientesExcluidos)
    }

    useEffect(() => {
        if (variantes.length === 0) return

        const onKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null
            // Si el foco ya está en otro control del configurador, ese control
            // conserva sus propias teclas (por ejemplo Enter en un extra).
            if (target?.closest('button, input, textarea, select')) return

            if (event.key === 'ArrowDown' || event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
                event.preventDefault()
                const direction = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1
                setVarianteId((currentId) => {
                    const currentIndex = variantes.findIndex((item) => item.id === currentId)
                    const nextIndex = (Math.max(currentIndex, 0) + direction + variantes.length) % variantes.length
                    return variantes[nextIndex].id
                })
                return
            }

            if (event.key === 'Enter') {
                const seleccionada = variantes.find((item) => item.id === varianteId) ?? variantes[0]
                event.preventDefault()
                confirmarVariante(seleccionada)
            }
        }

        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [variantes, varianteId, agregadosObj, ingredientesExcluidos])

    const width = 360
    const left = Math.max(12, Math.min(anchor.left, window.innerWidth - width - 12))
    const top = Math.max(12, Math.min(anchor.bottom + 10, window.innerHeight - 480))
    const panelClass = isCompact
        ? 'fixed inset-x-0 bottom-0 max-h-[82vh] rounded-t-3xl border-x border-t'
        : 'fixed max-h-[min(480px,calc(100vh-24px))] rounded-2xl border'
    const panelStyle = isCompact ? undefined : { left, top, width }

    return (
        <div className={cn('fixed inset-0 z-[1002]', isCompact && 'bg-background/60 backdrop-blur-sm')} onClick={onClose}>
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label={`Configurar ${producto.nombre}`}
                tabIndex={-1}
                className={cn('flex w-full flex-col overflow-hidden bg-card shadow-2xl', panelClass)}
                style={panelStyle}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <span className="min-w-0 block font-bold text-sm truncate">{producto.nombre}</span>
                    <button onClick={onClose} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-accent text-muted-foreground">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="p-4 space-y-4 max-h-[55vh] overflow-y-auto">
                    <div className={cn(
                        variantes.length > 0 && mostrarIngredientes ? 'grid grid-cols-2 gap-4' : 'space-y-4'
                    )}>
                    {variantes.length > 0 && (
                        <div>
                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Variante</Label>
                            <div className="space-y-1.5">
                                {variantes.map((v) => (
                                    <button
                                        key={v.id}
                                        onClick={() => { setVarianteId(v.id); confirmarVariante(v) }}
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
                    {variantesSecundarias.length > 0 && (
                        <div>
                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Segunda variante</Label>
                            <div className="space-y-1.5">
                                {variantesSecundarias.map((v) => (
                                    <button
                                        key={v.id}
                                        onClick={() => {
                                            setVarianteSecundariaId(v.id)
                                            if (initialItem && onChange) onChange(variante, v, agregadosObj, ingredientesExcluidos)
                                        }}
                                        className={cn('w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-colors',
                                            varianteSecundariaId === v.id ? 'border-[#FF7A00] bg-[#FF7A00]/10 text-[#FF7A00] font-semibold' : 'border-border hover:bg-accent')}
                                    >
                                        <span>{v.nombre}</span>
                                        <span className="font-bold">{parseFloat(v.precio) > 0 ? `+$${parseFloat(v.precio).toLocaleString('es-AR')}` : 'Sin adicional'}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {mostrarIngredientes && (
                        <div>
                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Ingredientes</Label>
                            <div className="space-y-1.5">
                                {ingredientes.map((ingrediente) => {
                                    const excluido = ingredientesExcluidos.includes(ingrediente.id)
                                    return <button
                                        key={ingrediente.id}
                                        onClick={() => {
                                            const next = excluido ? ingredientesExcluidos.filter((id) => id !== ingrediente.id) : [...ingredientesExcluidos, ingrediente.id]
                                            setIngredientesExcluidos(next)
                                            if (initialItem && onChange) onChange(variante, varianteSecundaria, agregadosObj, next)
                                        }}
                                        className={cn('w-full flex items-center px-3 py-2.5 rounded-xl border text-sm transition-colors', excluido ? 'border-transparent bg-transparent text-muted-foreground/50 line-through hover:bg-muted/40' : 'border-[#FF7A00] bg-[#FF7A00]/10 text-[#FF7A00] hover:bg-[#FF7A00]/20')}
                                    >
                                        <span>{ingrediente.nombre}</span>
                                    </button>
                                })}
                            </div>
                        </div>
                    )}
                    </div>
                    {agregadosDisp.length > 0 && (
                        <div>
                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Extras</Label>
                            <div className="space-y-1.5">
                                {agregadosDisp.map((a) => {
                                    const sel = agregadosSel.includes(a.id)
                                    return (
                                        <button
                                            key={a.id}
                                            onClick={() => {
                                                const next = sel ? agregadosSel.filter((id) => id !== a.id) : [...agregadosSel, a.id]
                                                setAgregadosSel(next)
                                                if (initialItem && onChange) onChange(variante, varianteSecundaria, agregadosDisp.filter((item) => next.includes(item.id)), ingredientesExcluidos)
                                            }}
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
                {(!initialItem && (variantes.length === 0 || variantesSecundarias.length > 0)) && (
                    <div className="p-4 border-t border-border">
                        <div className="flex gap-2">
                            <Button onClick={() => onConfirm(variante, varianteSecundaria, agregadosObj, ingredientesExcluidos)} className="flex-1 h-11 rounded-xl bg-[#FF7A00] hover:bg-[#E66E00] text-white font-bold">
                                Agregar
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
