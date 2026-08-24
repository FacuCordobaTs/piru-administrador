import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { ApiError, pedidoUnificadoApi, type PedidoUnificadoItemInput } from '@/lib/api'
import { AddressAutocomplete } from '@/components/AddressAutocomplete'
import { usePrinter } from '@/context/PrinterContext'
import { formatComanda, commandsToBytes } from '@/utils/printerUtils'
import {
    usePosOfflineStore, sincronizarPendientes, registrarPedidoSincronizado,
    esErrorDeConexion, navegadorOffline, nextLocalNumero, deferComandaHastaPagado,
    type PedidoPosPendiente,
} from '@/lib/posOffline'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { POS_TIPOS_ORDER, posDraftStorageKey, usePosConfig, type PosMetodoPago } from '@/lib/posConfig'
import {
    X, Search, Plus, Minus, Trash2, ShoppingBag, Truck, Loader2,
    Banknote, CreditCard, Landmark, Smartphone, ShoppingCart, User, Phone, MapPin, ChevronRight,
    WifiOff, Printer, CheckCircle,
} from 'lucide-react'

type Producto = ReturnType<typeof useRestauranteStore.getState>['productos'][number]

interface CartItem {
    key: string
    serverItemId?: number
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
    nota?: string
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
    /** Extras aplicados: la comanda sin conexión los imprime como "CON: +...". */
    agregados?: Array<{ nombre: string }>
    cantidad: number
    precioUnitario: number
    categoriaEsBebida?: boolean
    nota?: string
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
    /** En edición, indica si la comanda difiere del pedido que se cargó. */
    hasChanges: boolean
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
        cantidadImpresa?: number
        precioUnitario: string | number
        ingredientesExcluidos?: number[] | null
        ingredientesExcluidosNombres?: string[]
        agregados?: unknown
        nota?: string | null
    }>
    /** El pedido se cargó con cambios locales ya aplicados (p. ej. fusión de mesa). */
    dirtyOnLoad?: boolean
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
    /** Guarda el borrador y devuelve el id persistido; permite encadenar acciones. */
    submitDraft: () => Promise<number | null>
    /** Limpia el borrador desde la comanda desktop, sin confirmación. */
    clearDraft: () => void
    /** Lleva el cursor al buscador de productos. */
    focusProductSearch: () => void
    /** Exporta los ítems del borrador como ítems de pedido editable, para
     *  fusionarlos en la edición del pedido de una mesa ocupada. */
    getCartItems: () => PosEditablePedido['items']
}

interface PuntoDeVentaProps {
    onClose: () => void
    onCreated: (pedidoId: number, pedido?: Partial<PosEditablePedido>) => void | Promise<void>
    onUpdated?: (pedido: PosEditablePedido) => void
    /** Solicita eliminar el pedido persistido que se está editando. */
    onDeletePedido?: (pedidoId: number) => void
    onPrintNewMesa?: () => void | Promise<void>
    onPrintAllMesa?: () => void | Promise<void>
    sucursalActivaId: number | null
    /** El padre (Dashboard) espeja este borrador en la comanda de la derecha en vivo. */
    onDraftChange?: (draft: PosDraft | null) => void
    /** Volver al grid desde un pedido existente conserva el borrador. */
    onStartDraft?: () => void
    mesaAsignada?: { id: number; nombre: string } | null
    /** Desasigna la mesa al cambiar el borrador a delivery o takeaway. */
    onClearMesa?: () => void
    /** Resincroniza el mapa si el backend detecta una ocupación concurrente. */
    onMesaOcupadaDetectada?: () => void
    /** Sólo el borrador activo captura la escritura rápida para buscar productos. */
    autoFocusSearch?: boolean
    /** Pedido POS que se carga como borrador editable. */
    initialPedido?: PosEditablePedido | null
    /** Oculta la "x" de cierre: el POS queda siempre abierto (módulo activo en desktop). */
    mostrarBotonCerrar?: boolean
    /** Nombre de la sucursal activa, para la comanda impresa sin conexión. */
    sucursalNombre?: string
    /** En desktop, integra el catálogo como desplegable dentro de la comanda. */
    catalogoCompacto?: boolean
}

const METODOS_PAGO: Array<{ id: PosMetodoPago; label: string; icon: React.ElementType }> = [
    { id: 'cash', label: 'Efectivo', icon: Banknote },
    { id: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
    { id: 'manual_transfer', label: 'Transferencia', icon: Landmark },
    { id: 'mercadopago', label: 'Mercado Pago', icon: Smartphone },
]

const itemUnitPrice = (it: CartItem) =>
    it.precioBase + it.agregados.reduce((s, a) => s + (parseFloat(String(a.precio)) || 0), 0)

interface PedidoSignatureValues {
    tipo: 'delivery' | 'takeaway' | 'mesa'
    mesaLocalId?: number | null
    nombre: string
    telefono: string
    direccion: string
    latitud?: number | string | null
    longitud?: number | string | null
    notas: string
    metodoPago: string
    pagado: boolean
    deliveryFee?: number | string | null
    items: Array<{
        productoId: number
        varianteId?: number | null
        varianteSecundariaId?: number | null
        cantidad: number
        ingredientesExcluidos?: number[] | null
        agregados?: unknown
        nota?: string | null
    }>
}

const normalizeAgregadosForSignature = (value: unknown): Array<{ id: number; nombre: string; precio: string }> => {
    if (typeof value === 'string') {
        try { return normalizeAgregadosForSignature(JSON.parse(value)) } catch { return [] }
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

const pedidoSignature = (values: PedidoSignatureValues) => JSON.stringify({
    tipo: values.tipo,
    mesaLocalId: values.tipo === 'mesa' ? values.mesaLocalId ?? null : null,
    nombreCliente: values.nombre.trim(),
    telefono: values.telefono.trim(),
    direccion: values.tipo === 'delivery' ? values.direccion.trim() : null,
    latitud: values.tipo === 'delivery' && values.latitud != null ? Number(values.latitud) : null,
    longitud: values.tipo === 'delivery' && values.longitud != null ? Number(values.longitud) : null,
    notas: values.notas.trim(),
    metodoPago: values.metodoPago,
    pagado: values.pagado,
    deliveryFee: values.tipo === 'delivery' ? Number(values.deliveryFee) || 0 : 0,
    items: values.items.map((item) => ({
        productoId: item.productoId,
        varianteId: item.varianteId ?? null,
        varianteSecundariaId: item.varianteSecundariaId ?? null,
        cantidad: item.cantidad,
        ingredientesExcluidos: item.ingredientesExcluidos ?? [],
        agregados: normalizeAgregadosForSignature(item.agregados),
        nota: item.nota ?? null,
    })),
})

const PuntoDeVenta = forwardRef<PuntoDeVentaHandle, PuntoDeVentaProps>(function PuntoDeVenta(
    { onClose, onCreated, onUpdated, onDeletePedido, onPrintNewMesa, onPrintAllMesa, sucursalActivaId, onDraftChange, onStartDraft, mesaAsignada = null, onClearMesa, onMesaOcupadaDetectada, autoFocusSearch = true, initialPedido = null, mostrarBotonCerrar = true, sucursalNombre = '', catalogoCompacto = false },
    ref
) {
    const token = useAuthStore((s) => s.token)
    // La impresión de comandas es local (Tauri invoke): funciona sin conexión.
    const { printRaw } = usePrinter()
    const restauranteNombre = useAuthStore((s) => s.restaurante?.nombre) || 'Restaurante'
    const { productos } = useRestauranteStore()
    const cucuruConfigurado = useRestauranteStore((s) => s.restaurante?.cucuruConfigurado) ?? false
    const direccionSoloTexto = useRestauranteStore((s) => s.restaurante?.direccionSoloTexto === true)
    // La configuración del POS (qué datos/opciones se cargan) vive en localStorage.
    const config = usePosConfig()
    const tiposHabilitados = useMemo(
        () => POS_TIPOS_ORDER.filter((tipo) => tipo !== 'mesa' && config.tipos[tipo]),
        [config],
    )
    const metodosHabilitados = useMemo(
        () => METODOS_PAGO.filter((metodo) => config.metodosPago[metodo.id]),
        [config],
    )

    const [query, setQuery] = useState('')
    const searchInputRef = useRef<HTMLInputElement>(null)
    // El destino del portal vive en la comanda hermana y aparece recién después
    // del primer commit. Este estado fuerza el render que monta el buscador ahí.
    const [catalogoPortalReady, setCatalogoPortalReady] = useState(false)
    // Contenedor scrolleable del listado: mantiene el producto destacado a la vista.
    const scrollRef = useRef<HTMLDivElement>(null)
    const [cart, setCart] = useState<CartItem[]>([])
    const [configProducto, setConfigProducto] = useState<{
        producto: Producto
        anchor: DOMRect
        editKey?: string
        initialItem?: CartItem
    } | null>(null)
    const [mobileStep, setMobileStep] = useState<'productos' | 'checkout'>('productos')
    // Producto destacado del resultado: es el que Enter agrega al pedido y el
    // que las flechitas recorren durante la búsqueda (indicado con el marquito).
    const [indiceSeleccionado, setIndiceSeleccionado] = useState(0)
    const navegacionTecladoRef = useRef(false)

    // Datos del cliente
    const [tipo, setTipo] = useState<'delivery' | 'takeaway' | 'mesa'>('takeaway')
    const [nombre, setNombre] = useState('')
    const [telefono, setTelefono] = useState('')
    const [direccion, setDireccion] = useState('')
    const [lat, setLat] = useState<number | null>(null)
    const [lng, setLng] = useState<number | null>(null)
    const [notas, setNotas] = useState('')
    const [metodoPago, setMetodoPago] = useState<string>('cash')
    // Las altas manuales nacen cobradas. Al editar se conserva el estado de
    // pago existente: cambiar productos o datos del cliente no confirma cobros.
    const pagado = initialPedido?.pagado ?? true
    const [deliveryFee, setDeliveryFee] = useState('')
    // Costo fijo de envío del restaurante (Ajustes → General): precarga los
    // pedidos de delivery nuevos para no volver a preguntar lo ya decidido.
    const costoEnvioFijoNum = parseFloat(useRestauranteStore((s) => s.restaurante?.deliveryFee) ?? '') || 0
    // El prefill se aplica una sola vez por borrador: si el cajero vacía el
    // costo a propósito (envío gratis puntual), no se vuelve a reponer.
    const prefillEnvioRef = useRef(false)
    const [submitting, setSubmitting] = useState(false)
    const autoSaveRef = useRef<(automatico?: boolean) => Promise<number | null>>(async () => null)
    const lastAutoSaveAttemptRef = useRef<string | null>(null)
    const [hydratedPedidoId, setHydratedPedidoId] = useState<number | null>(null)
    const modoEdicion = initialPedido != null
    // Una edición no comparte almacenamiento con el borrador de alta. El borrador
    // es uno solo por sucursal: asignar una mesa cambia el tipo pero conserva los
    // productos ya cargados, y volver a delivery muestra el mismo borrador.
    const storageKey = modoEdicion
        ? `piru:pos-edit:${initialPedido.id}`
        : posDraftStorageKey(sucursalActivaId)
    const [hydratedStorageKey, setHydratedStorageKey] = useState<string | null>(null)

    // ── Modo offline (sólo del POS) ──
    // Arranca con el estado real del navegador; si un pedido falla por red
    // mientras navigator.onLine sigue en true (servidor caído), se fuerza a
    // offline para que la UI avise y el reintento periódico se encargue.
    const [online, setOnline] = useState<boolean>(() => !navegadorOffline())
    const [showPendientes, setShowPendientes] = useState(false)
    const restauranteId = useAuthStore((s) => s.restaurante?.id ?? null)
    const pendientes = usePosOfflineStore((s) => s.pendientes)
    const sincronizando = usePosOfflineStore((s) => s.sincronizando)

    useEffect(() => {
        const onOnline = () => setOnline(true)
        const onOffline = () => setOnline(false)
        window.addEventListener('online', onOnline)
        window.addEventListener('offline', onOffline)
        return () => {
            window.removeEventListener('online', onOnline)
            window.removeEventListener('offline', onOffline)
        }
    }, [])

    // Disparar una sincronización: si el servidor volvió (aunque navigator.onLine
    // nunca lo haya notado), el chip "Sin conexión" se apaga.
    const intentarSincronizar = useCallback(() => {
        void sincronizarPendientes().then((sincronizo) => {
            if (sincronizo) setOnline(true)
        })
    }, [])

    // La cola de pendientes vive por restaurante en localStorage.
    useEffect(() => {
        if (restauranteId == null) return
        usePosOfflineStore.getState().initPendientes(restauranteId)
    }, [restauranteId])

    // Cuando vuelve la conexión, sincronizar todo lo guardado.
    useEffect(() => {
        if (!online || !token) return
        intentarSincronizar()
    }, [online, token, intentarSincronizar])

    // Reintento periódico: cubre el caso "navegador online pero servidor caído",
    // donde el evento `online` del navegador nunca se dispara.
    useEffect(() => {
        if (!token) return
        const interval = window.setInterval(() => {
            if (usePosOfflineStore.getState().pendientes.length === 0) return
            intentarSincronizar()
        }, 45_000)
        return () => window.clearInterval(interval)
    }, [token, intentarSincronizar])

    // Cada pedido sincronizado refresca el listado del Dashboard (onCreated),
    // igual que cuando el alta se hace online.
    useEffect(() => {
        return registrarPedidoSincronizado((pedidoId) => {
            onCreated(pedidoId)
        })
    }, [onCreated])

    const focusProductSearch = () => searchInputRef.current?.focus()

    useEffect(() => {
        setCatalogoPortalReady(catalogoCompacto)
    }, [catalogoCompacto])

    // En el borrador, el lector/teclado debe poder empezar a buscar sin un click
    // previo. No se roba el foco de campos que el usuario haya elegido de forma
    // explícita, ni del configurador de un producto abierto.
    useEffect(() => {
        if (!autoFocusSearch || configProducto) return
        const frame = window.requestAnimationFrame(focusProductSearch)
        return () => window.cancelAnimationFrame(frame)
    }, [autoFocusSearch, configProducto, catalogoPortalReady])

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
                    serverItemId: item.id > 0 ? item.id : undefined,
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
                    nota: item.nota ?? undefined,
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
            setHydratedPedidoId(initialPedido.id)
            return
        }
        setHydratedPedidoId(null)
        try {
            const saved = sessionStorage.getItem(storageKey)
            if (saved) {
                prefillEnvioRef.current = false
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
                prefillEnvioRef.current = false
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

    // Un delivery nuevo nace con el costo fijo del restaurante precargado; el
    // cajero igual puede ajustarlo o vaciarlo por pedido. Cubre también el
    // caso "el perfil todavía no cargó": cuando llega el costo y el borrador
    // sigue en delivery sin fee, se rellena en ese momento.
    useEffect(() => {
        if (modoEdicion || tipo !== 'delivery' || prefillEnvioRef.current) return
        if (deliveryFee.trim() === '') {
            if (costoEnvioFijoNum > 0) {
                prefillEnvioRef.current = true
                setDeliveryFee(String(costoEnvioFijoNum))
            }
        } else {
            // El cajero ya escribió un valor: respetarlo, sin volver a mirar.
            prefillEnvioRef.current = true
        }
    }, [tipo, deliveryFee, costoEnvioFijoNum, modoEdicion])

    // ── Productos filtrados por búsqueda ──
    // Cada término debe coincidir en algún lado (nombre, descripción, categoría
    // o etiquetas/tags), sin importar el orden: "gratinado milanesa" encuentra un
    // "Sandwich gratinado" de categoría "Milanesa", igual que "gratinado sandwich".
    const productosFiltrados = useMemo(() => {
        const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
        const activos = productos.filter((p) => p.activo !== false)
        if (terms.length === 0) return activos
        return activos.filter((p) => {
            const texto = [
                p.nombre,
                p.descripcion,
                p.categoria,
                ...(p.etiquetas ?? []).map((e) => e.nombre),
            ].filter(Boolean).join(' ').toLowerCase()
            return terms.every((term) => texto.includes(term))
        })
    }, [productos, query])

    // El catálogo aparece solamente cuando hay una búsqueda en curso.
    const mostrarListado = query.trim() !== ''

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

    // Orden plano de los productos tal como se muestran en pantalla (agrupados
    // por categoría): Enter agrega el primero visible, no el primero del store.
    const productosOrdenados = useMemo(
        () => porCategoria.flatMap(([, items]) => items),
        [porCategoria]
    )
    const indicePorId = useMemo(() => {
        const map = new Map<number, number>()
        productosOrdenados.forEach((producto, index) => map.set(producto.id, index))
        return map
    }, [productosOrdenados])

    // Al cambiar el resultado (búsqueda o menú) la selección vuelve al primer producto.
    useEffect(() => {
        setIndiceSeleccionado(0)
    }, [productosOrdenados])

    // El producto destacado se mantiene a la vista aunque el listado haya hecho scroll.
    // No usamos scrollIntoView: en el catálogo compacto (renderizado por portal)
    // también puede mover el panel/página. Ajustamos únicamente el scroll del listado.
    useEffect(() => {
        if (!mostrarListado) return
        const listado = scrollRef.current
        const card = listado?.querySelector<HTMLElement>(`[data-flat-index="${indiceSeleccionado}"]`)
        if (!listado || !card) return

        let listadoRect = listado.getBoundingClientRect()
        if (catalogoCompacto) {
            const footer = document.querySelector<HTMLElement>('[data-pos-comanda-footer]')
            if (footer) {
                // En Dashboard el footer de cobro es absoluto: no reduce la altura
                // del portal y puede tapar resultados que el listado cree visibles.
                // Convertimos el espacio realmente libre en su altura máxima para
                // que exista overflow y las flechas puedan desplazar los productos.
                const alturaVisible = Math.floor(footer.getBoundingClientRect().top - listadoRect.top - 8)
                if (alturaVisible > 80) {
                    listado.style.maxHeight = `${alturaVisible}px`
                    listadoRect = listado.getBoundingClientRect()
                }
            }
        }
        const cardRect = card.getBoundingClientRect()
        if (navegacionTecladoRef.current) {
            navegacionTecladoRef.current = false
            // El footer del POS se superpone visualmente al catálogo compacto.
            // Al navegar con flechas, subimos el resultado activo hasta el borde
            // superior para que nunca quede escondido detrás de esos controles.
            listado.scrollTop += cardRect.top - listadoRect.top - 8
            return
        }
        if (cardRect.top < listadoRect.top) {
            listado.scrollTop -= listadoRect.top - cardRect.top
        } else if (cardRect.bottom > listadoRect.bottom) {
            listado.scrollTop += cardRect.bottom - listadoRect.bottom
        }
    }, [catalogoCompacto, indiceSeleccionado, mostrarListado])

    // Columnas reales del grid de resultados: las flechitas verticales saltan
    // de fila en fila y las horizontales de producto en producto.
    const calcularColumnas = () => {
        const contenedor = scrollRef.current
        const tarjeta = contenedor?.querySelector<HTMLElement>('[data-flat-index]')
        if (!contenedor || !tarjeta || tarjeta.offsetWidth === 0) return 1
        const gap = 12 // gap-3 entre tarjetas del grid
        return Math.max(1, Math.round((contenedor.clientWidth + gap) / (tarjeta.offsetWidth + gap)))
    }

    const cartTotal = useMemo(
        () => cart.reduce((s, it) => s + itemUnitPrice(it) * it.cantidad, 0),
        [cart]
    )
    const totalItems = useMemo(() => cart.reduce((s, it) => s + it.cantidad, 0), [cart])
    const deliveryFeeNum = tipo === 'delivery' ? parseFloat(deliveryFee) || 0 : 0
    const totalFinal = cartTotal + deliveryFeeNum

    // La comparación usa únicamente los datos que efectivamente se envían al
    // backend. Así, claves locales del carrito o cambios de formato no habilitan
    // "Guardar cambios" si la comanda sigue siendo idéntica.
    const currentSignature = useMemo(() => pedidoSignature({
            tipo,
            mesaLocalId: mesaAsignada?.id,
            nombre,
            telefono,
            direccion,
            latitud: lat,
            longitud: lng,
            notas,
            metodoPago,
            pagado,
            deliveryFee: deliveryFeeNum,
            items: cart,
        }), [tipo, mesaAsignada?.id, nombre, telefono, direccion, lat, lng, notas, metodoPago, pagado, deliveryFeeNum, cart])

    const hasChanges = useMemo(() => {
        if (!initialPedido || hydratedPedidoId !== initialPedido.id) return !initialPedido
        if (initialPedido.dirtyOnLoad) return true
        const original = pedidoSignature({
            tipo: initialPedido.tipo,
            mesaLocalId: initialPedido.mesaLocalId,
            nombre: initialPedido.nombreCliente || '',
            telefono: initialPedido.telefono || '',
            direccion: initialPedido.direccion || '',
            latitud: initialPedido.latitud,
            longitud: initialPedido.longitud,
            notas: initialPedido.notas || '',
            metodoPago: initialPedido.metodoPago || 'cash',
            pagado: initialPedido.pagado ?? true,
            deliveryFee: initialPedido.deliveryFee,
            items: initialPedido.items,
        })
        return currentSignature !== original
    }, [initialPedido, hydratedPedidoId, currentSignature])

    // ── Borrador en vivo ──
    // Snapshot del borrador tal como se ve: lo espeja el padre en la comanda
    // de la derecha y, en modo offline, se guarda junto al pedido pendiente
    // para reimprimir la comanda sin depender del carrito.
    const buildDraftSnapshot = (submitting: boolean): PosDraft => ({
        tipo,
        // Se espejan los valores tal cual se tipean: si se recortan acá, el
        // input controlado de la comanda pierde el espacio final al escribir
        // (p. ej. "Salta 640" queda "Salta640"). El recorte se hace al validar y enviar.
        nombreCliente: nombre,
        telefono: telefono.trim(),
        direccion,
        notas,
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
            agregados: it.agregados.map((agregado) => ({ nombre: agregado.nombre })),
            nota: it.nota,
            cantidad: it.cantidad,
            precioUnitario: itemUnitPrice(it),
            categoriaEsBebida: productos.find((producto) => producto.id === it.productoId)?.categoriaEsBebida ?? false,
        })),
        subtotal: cartTotal,
        total: totalFinal,
        submitting,
        hasChanges,
        mesaLocalId: mesaAsignada?.id,
        mesaNombre: mesaAsignada?.nombre,
    })

    useEffect(() => {
        if (!onDraftChange) return
        onDraftChange(buildDraftSnapshot(submitting))
    }, [onDraftChange, tipo, nombre, telefono, direccion, notas, metodoPago, pagado, deliveryFeeNum, cart, cartTotal, totalFinal, submitting, hasChanges, mesaAsignada?.nombre, productos])

    const addToCart = (
        producto: Producto,
        variante?: { id: number; nombre: string; precio: string },
        varianteSecundaria?: { id: number; nombre: string; precio: string },
        agregados: CartItem['agregados'] = [],
        ingredientesExcluidos: number[] = []
    ) => {
        if (submitting) return
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
        // Al agregar al borrador se limpia el buscador: el próximo producto
        // se escribe directo, sin borrar el término anterior.
        setQuery('')
        // Esperar al render garantiza que el input siga montado y activo incluso
        // cuando el alta cerró el configurador de variantes.
        window.requestAnimationFrame(() => searchInputRef.current?.focus())
    }

    const handleProductClick = (producto: Producto, anchor: DOMRect) => {
        onStartDraft?.()
        const tieneVariantes = (producto.variantes?.length ?? 0) > 0 || (producto.variantesSecundarias?.length ?? 0) > 0
        // Durante la carga sólo las variantes requieren elegir una opción. Los
        // ingredientes y extras se ajustan después, desde la edición del ítem
        // agregado en la comanda.
        if (tieneVariantes) {
            setConfigProducto({ producto, anchor })
        } else {
            addToCart(producto)
        }
    }

    const changeQty = (key: string, delta: number) => {
        if (submitting) return
        setCart((prev) =>
            prev
                .map((it) => (it.key === key ? { ...it, cantidad: it.cantidad + delta } : it))
                .filter((it) => it.cantidad > 0)
        )
    }

    const removeItem = (key: string) => {
        if (submitting) return
        setCart((prev) => prev.filter((it) => it.key !== key))
    }

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
        if (submitting) return
        if (changes.tipo) setTipo(changes.tipo)
        if (changes.nombreCliente !== undefined) setNombre(changes.nombreCliente)
        if (changes.telefono !== undefined) setTelefono(changes.telefono.replace(/\D/g, ''))
        if (changes.direccion !== undefined) { setDireccion(changes.direccion); setLat(null); setLng(null) }
        if (changes.notas !== undefined) setNotas(changes.notas)
        if (changes.metodoPago !== undefined) setMetodoPago(changes.metodoPago)
        if (changes.deliveryFee !== undefined) setDeliveryFee(String(changes.deliveryFee))
    }

    const resetForm = () => {
        prefillEnvioRef.current = false
        setCart([]); setNombre(''); setTelefono(''); setDireccion(''); setLat(null); setLng(null)
        setNotas(''); setMetodoPago('cash'); setDeliveryFee(''); setTipo(mesaAsignada ? 'mesa' : 'takeaway')
        setQuery(''); setMobileStep('productos')
        if (!modoEdicion) {
            try { sessionStorage.removeItem(storageKey) } catch { /* noop */ }
        }
    }

    // Los ítems del borrador convertidos al formato de pedido editable: el
    // Dashboard los fusiona en la edición del pedido de una mesa ocupada. Las
    // filas persistidas conservan su id; las nuevas usan uno negativo sólo en
    // memoria hasta que el backend les asigna su identidad definitiva.
    const getCartItems = (): PosEditablePedido['items'] => cart.map((it, index) => ({
        id: it.serverItemId ?? -1 - index,
        productoId: it.productoId,
        nombreProducto: it.nombre,
        varianteId: it.varianteId ?? null,
        varianteNombre: it.varianteNombre ?? null,
        varianteSecundariaId: it.varianteSecundariaId ?? null,
        varianteSecundariaNombre: it.varianteSecundariaNombre ?? null,
        cantidad: it.cantidad,
        precioUnitario: itemUnitPrice(it),
        ingredientesExcluidos: it.ingredientesExcluidos,
        agregados: it.agregados,
        nota: it.nota,
    }))

    const requestClose = () => {
        const hasContent = cart.length > 0 || [nombre, telefono, direccion, notas, deliveryFee].some((value) => value.trim() !== '')
        if (hasContent && !window.confirm(modoEdicion ? '¿Salir sin guardar los cambios del pedido?' : '¿Descartar este borrador? Los productos y datos cargados se perderán.')) return
        resetForm()
        onClose()
    }

    // ── Modo offline: comanda local y cola de pendientes ──
    // La impresión usa el plugin local de Tauri (no la red), así que un pedido
    // guardado sin conexión imprime la comanda igual que uno online. El número
    // "LOCAL-{n}" distingue la comanda pendiente de las reales en la cocina.
    const imprimirComandaPendiente = async (pendiente: PedidoPosPendiente) => {
        const draft = pendiente.draft
        const itemsToPrint = draft.items.map((it) => ({
            cantidad: it.cantidad,
            precioUnitario: it.precioUnitario,
            nombreProducto: it.nombre,
            varianteNombre: it.varianteNombre,
            varianteSecundariaNombre: it.varianteSecundariaNombre,
            ingredientesExcluidosNombres: it.ingredientesExcluidosNombres,
            agregados: it.agregados,
            categoriaEsBebida: it.categoriaEsBebida,
        }))
        const comandaData = formatComanda({
            id: `LOCAL-${pendiente.localNumero}`,
            nombrePedido: draft.nombreCliente,
            telefono: draft.telefono,
            direccion: draft.tipo === 'delivery' ? draft.direccion : undefined,
            tipo: draft.tipo,
            total: String(draft.total),
            deliveryFee: draft.deliveryFee,
            notas: draft.notas ? `SIN CONEXIÓN - ${draft.notas}` : 'SIN CONEXIÓN',
            metodoPago: draft.metodoPago,
            sucursalNombre: sucursalNombre || undefined,
            mesaNombre: draft.mesaNombre,
        }, itemsToPrint, restauranteNombre)
        await printRaw(commandsToBytes(comandaData))
    }

    const guardarPedidoOffline = async (data: Parameters<typeof pedidoUnificadoApi.create>[1]) => {
        if (restauranteId == null) {
            toast.error('No se pudo guardar el pedido sin conexión')
            return
        }
        const pendiente: PedidoPosPendiente = {
            localId: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
            localNumero: nextLocalNumero(restauranteId),
            creadoEn: new Date().toISOString(),
            tipo: data.tipo,
            estado: 'pendiente',
            draft: buildDraftSnapshot(false),
            payload: data,
        }
        usePosOfflineStore.getState().guardarPendiente(pendiente)
        // Si navigator.onLine sigue en true pero el servidor está caído, la UI
        // debe igual mostrar el estado sin conexión.
        setOnline(false)

        // La comanda se imprime en el acto, como el auto-print online. Si la
        // impresión falla el pedido queda igual guardado y se reimprime desde
        // el panel de pendientes.
        if (!deferComandaHastaPagado(pendiente.draft.metodoPago, cucuruConfigurado) || pendiente.draft.pagado) {
            try {
                await imprimirComandaPendiente(pendiente)
            } catch {
                toast.warning('Pedido guardado, pero la comanda no se pudo imprimir', {
                    description: `Reimprimila desde el panel de pedidos sin conexión (#LOCAL-${pendiente.localNumero}).`,
                })
            }
        }

        toast.success('Pedido guardado sin conexión', {
            description: `Se sincronizará automáticamente cuando vuelva el internet (#LOCAL-${pendiente.localNumero}).`,
        })
        resetForm()
        // Recién guardado puede haber vuelto la conexión: intentar ya.
        intentarSincronizar()
    }

    const reimprimirPendiente = async (pendiente: PedidoPosPendiente) => {
        try {
            await imprimirComandaPendiente(pendiente)
            toast.success(`Comanda #LOCAL-${pendiente.localNumero} enviada a imprimir`)
        } catch (error) {
            toast.error(`No se pudo imprimir #LOCAL-${pendiente.localNumero}`, {
                description: error instanceof Error ? error.message : undefined,
            })
        }
    }

    const eliminarPendiente = (pendiente: PedidoPosPendiente) => {
        if (!window.confirm(`¿Eliminar el pedido #LOCAL-${pendiente.localNumero}? Todavía no se sincronizó: si lo eliminás se pierde.`)) return
        usePosOfflineStore.getState().eliminarPendiente(pendiente.localId)
    }

    // La comanda del Dashboard (panel derecho) opera el borrador a través de este handle.
    useImperativeHandle(ref, () => ({ removeItem, editItem, updateDraft, requestClose, submitDraft: handleSubmit, clearDraft: resetForm, focusProductSearch, getCartItems }))

    const handleSubmit = async (automatico = false): Promise<number | null> => {
        if (!token) return null
        // Despachar una mesa ya guardada no exige introducir un cambio artificial.
        if (modoEdicion && !hasChanges) return initialPedido.id
        if (cart.length === 0) {
            toast.error('Agregá al menos un producto')
            return null
        }
        if (tipo === 'delivery' && config.camposCliente.direccion && !direccion.trim()) {
            toast.error('Ingresá la dirección de entrega')
            return null
        }

        const items: PedidoUnificadoItemInput[] = cart.map((it) => ({
            id: it.serverItemId,
            productoId: it.productoId,
            varianteId: it.varianteId,
            varianteSecundariaId: it.varianteSecundariaId,
            cantidad: it.cantidad,
            ingredientesExcluidos: it.ingredientesExcluidos.length ? it.ingredientesExcluidos : undefined,
            agregados: it.agregados.length ? it.agregados : undefined,
            nota: it.nota,
        }))

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

        setSubmitting(true)
        try {
            // Editar un pedido existente requiere el servidor: la cola offline
            // es sólo para altas nuevas del POS.
            if (modoEdicion) {
                const res = await pedidoUnificadoApi.updateFromPos(token, initialPedido.id, {
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
                }) as { success?: boolean; data?: PosEditablePedido & { id?: number }; message?: string }
                if (res.success) {
                    if (!automatico) toast.success('Pedido actualizado correctamente')
                    if (res.data) onUpdated?.(res.data)
                    return res.data?.id ?? initialPedido.id
                } else {
                    toast.error(res.message || 'No se pudo actualizar el pedido')
                    return null
                }
            }

            // Sin conexión el pedido va directo a la cola local y la comanda se
            // imprime en el acto: el local nunca deja de anotar.
            if (!online) {
                await guardarPedidoOffline(data)
                return null
            }

            try {
                const res = await pedidoUnificadoApi.create(token, data) as { success?: boolean; data?: PosEditablePedido & { id?: number }; message?: string }
                if (res.success) {
                    if (!automatico) toast.success('Pedido anotado correctamente')
                    const esMesa = data.tipo === 'mesa'
                    if (!esMesa) resetForm()
                    // El POS queda listo para anotar el siguiente pedido. El Dashboard
                    // sólo sincroniza el listado; cerrar el POS acá interrumpía ese flujo.
                    if (res.data?.id) await onCreated(res.data.id, res.data)
                    return res.data?.id ?? null
                } else {
                    toast.error(res.message || 'No se pudo crear el pedido')
                    return null
                }
            } catch (error: unknown) {
                if ((error as { response?: { code?: string } })?.response?.code === 'MESA_OCUPADA') {
                    onMesaOcupadaDetectada?.()
                }
                if (esErrorDeConexion(error)) {
                    // El servidor está caído aunque navigator.onLine siga en true:
                    // mismo camino que sin conexión (cola local + comanda).
                    await guardarPedidoOffline(data)
                    return null
                } else {
                    toast.error('Error al crear el pedido', { description: error instanceof Error ? error.message : undefined })
                    return null
                }
            }
        } catch (error: unknown) {
            // Sólo llega acá el path de edición: el de alta ya manejó sus errores.
            if (modoEdicion && error instanceof ApiError && error.response?.code === 'VERSION_CONFLICT') {
                const latest = error.response?.data?.pedido as PosEditablePedido | undefined
                if (latest) {
                    const locales = getCartItems()
                    const localesPorId = new Map(locales.filter((item) => item.id > 0).map((item) => [item.id, item]))
                    const fusionados = latest.items.map((item) => localesPorId.get(item.id) ?? item)
                    fusionados.push(...locales.filter((item) => item.id <= 0))
                    onUpdated?.({ ...latest, items: fusionados, dirtyOnLoad: true })
                    toast.info('La mesa cambió en otro equipo; combinamos los cambios y volvemos a guardarlos')
                    return null
                }
            }
            // Un fallo transitorio no bloquea para siempre esta misma firma:
            // al salir de `submitting`, el autosave vuelve a intentarla.
            lastAutoSaveAttemptRef.current = null
            toast.error('Error al actualizar el pedido', { description: error instanceof Error ? error.message : undefined })
            return null
        } finally {
            setSubmitting(false)
        }
    }

    // Las comandas de mesa son persistentes: una mesa libre se crea al agregar
    // el primer producto y las mesas ocupadas actualizan su pedido después de
    // cada cambio. El pequeño debounce agrupa ediciones rápidas de una misma
    // fila y evita una petición por cada pulsación en campos de texto.
    autoSaveRef.current = handleSubmit
    useEffect(() => {
        if (!online || tipo !== 'mesa' || !mesaAsignada || cart.length === 0 || !hasChanges || submitting) return
        if (lastAutoSaveAttemptRef.current === currentSignature) return
        const timeout = window.setTimeout(() => {
            lastAutoSaveAttemptRef.current = currentSignature
            void autoSaveRef.current(true)
        }, 450)
        return () => window.clearTimeout(timeout)
    }, [online, tipo, mesaAsignada?.id, cart.length, hasChanges, submitting, currentSignature])

    // Con la configuración del POS, un campo desactivado se oculta por completo
    // y no participa de los datos del borrador.
    const nombreEditable = config.camposCliente.nombre
    const telefonoEditable = config.camposCliente.telefono

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
                {tipo !== 'mesa' && tiposHabilitados.length > 0 && <div className="lg:hidden">
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
                </div>}
                {/* Datos del cliente */}
                <div className="relative space-y-3 lg:hidden">
                    {nombreEditable && <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><User className="h-3.5 w-3.5" />Nombre</Label>
                        </div>
                        <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del cliente" className="h-11 rounded-xl bg-transparent dark:bg-transparent" />
                    </div>}
                    {tipo !== 'mesa' && config.camposCliente.direccion && <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />Dirección</Label>
                        {direccionSoloTexto ? (
                            <Input
                                value={direccion}
                                onChange={(event) => { setDireccion(event.target.value); setLat(null); setLng(null) }}
                                placeholder="Calle, número, barrio y ciudad..."
                                disabled={tipo !== 'delivery'}
                                autoComplete="street-address"
                                className="h-11 rounded-xl bg-transparent dark:bg-transparent"
                            />
                        ) : (
                            <AddressAutocomplete
                                value={direccion}
                                onChange={(addr, newLat, newLng) => { setDireccion(addr); setLat(newLat); setLng(newLng) }}
                                placeholder="Calle y número..."
                                disabled={tipo !== 'delivery'}
                            />
                        )}
                    </div>}
                    {tipo === 'delivery' && (
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-muted-foreground">Costo de envío</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">$</span>
                                <Input value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0" inputMode="decimal" className="h-11 rounded-xl pl-7 bg-transparent dark:bg-transparent" />
                            </div>
                        </div>
                    )}
                    {telefonoEditable && <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />Celular</Label>
                        </div>
                        <Input value={telefono} onChange={(e) => setTelefono(e.target.value.replace(/\D/g, ''))} placeholder="Ej: 3415123456" inputMode="tel" className="h-11 rounded-xl bg-transparent dark:bg-transparent" />
                    </div>}
                    {config.notas && <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground">Notas</Label>
                        <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Aclaraciones..." className="rounded-xl resize-none min-h-[60px]" />
                    </div>}
                </div>

                {/* Método de pago. Con un único método habilitado no se muestra
                    ningún botón: el pedido se guarda directo con ese método. */}
                {metodosHabilitados.length > 1 && (
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
                {modoEdicion && tipo === 'mesa' && (onPrintNewMesa || onPrintAllMesa) && (
                    <div className="mb-2 grid grid-cols-2 gap-2">
                        <Button type="button" variant="outline" className="h-11 rounded-xl px-2 text-xs font-bold" disabled={submitting} onClick={() => void onPrintNewMesa?.()}>
                            <Printer className="mr-1.5 h-4 w-4" /> Nuevos productos
                        </Button>
                        <Button type="button" variant="outline" className="h-11 rounded-xl px-2 text-xs font-bold" disabled={submitting} onClick={() => void onPrintAllMesa?.()}>
                            <Printer className="mr-1.5 h-4 w-4" /> Toda la comanda
                        </Button>
                    </div>
                )}
                <div className="flex items-center gap-2">
                    {modoEdicion && onDeletePedido && (
                        <button
                            type="button"
                            onClick={() => onDeletePedido(initialPedido.id)}
                            disabled={submitting}
                            aria-label={`Eliminar pedido #${initialPedido.id}`}
                            title="Eliminar pedido"
                            className="h-12 w-12 rounded-xl bg-secondary/30 border border-border/50 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0 disabled:opacity-50"
                        >
                            <Trash2 className="h-5 w-5" />
                        </button>
                    )}
                    {tipo === 'mesa' ? (
                        <div className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                            {submitting ? 'Guardando…' : cart.length === 0 ? 'Agregá un producto para abrir la mesa' : hasChanges ? 'Guardado pendiente…' : 'Guardado automáticamente'}
                        </div>
                    ) : (
                        <Button
                            onClick={() => void handleSubmit()}
                            disabled={submitting || cart.length === 0 || (modoEdicion && !hasChanges)}
                            className="flex-1 h-12 rounded-xl bg-[#FF7A00] hover:bg-[#E66E00] text-white font-bold text-base"
                        >
                            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : modoEdicion ? 'Guardar cambios' : 'Anotar pedido'}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )

    if (catalogoCompacto) {
        const catalogoTarget = catalogoPortalReady && typeof document !== 'undefined'
            ? document.getElementById('pos-catalogo-compacto')
            : null
        return (
            <>
                {catalogoTarget && createPortal(
                    <div className="flex flex-col overflow-hidden">
                        <div className={cn('shrink-0', mostrarListado && 'border-b border-border/70 pb-2.5')}>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                                <Input
                                    ref={searchInputRef}
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (mostrarListado && (event.key === 'ArrowDown' || event.key === 'ArrowUp') && productosOrdenados.length > 0) {
                                            event.preventDefault()
                                            navegacionTecladoRef.current = true
                                            const delta = event.key === 'ArrowDown' ? 1 : -1
                                            setIndiceSeleccionado((current) => (current + delta + productosOrdenados.length) % productosOrdenados.length)
                                            return
                                        }
                                        if (event.key === 'Enter' && mostrarListado && productosOrdenados.length > 0) {
                                            event.preventDefault()
                                            const producto = productosOrdenados[Math.min(indiceSeleccionado, productosOrdenados.length - 1)] ?? productosOrdenados[0]
                                            handleProductClick(producto, event.currentTarget.getBoundingClientRect())
                                        }
                                    }}
                                    placeholder="Buscar productos..."
                                    className="h-10 rounded-full border-border bg-muted/40 pl-10 shadow-none focus-visible:ring-[#FF7A00]"
                                />
                            </div>
                        </div>
                        {mostrarListado && <div ref={scrollRef} className="mt-2 max-h-[min(70vh,640px)] overflow-y-auto rounded-xl border border-border bg-background p-2 shadow-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {productosFiltrados.length === 0 ? (
                                <p className="py-10 text-center text-sm text-muted-foreground">No se encontraron productos.</p>
                            ) : (
                                <div className="space-y-0.5">
                                    {porCategoria.map(([categoria, items]) => (
                                        <div key={categoria}>
                                            <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{categoria}</p>
                                            {items.map((producto) => {
                                                const flatIndex = indicePorId.get(producto.id)
                                                const seleccionado = flatIndex === indiceSeleccionado
                                                return (
                                                    <button
                                                        key={producto.id}
                                                        type="button"
                                                        tabIndex={-1}
                                                        data-flat-index={flatIndex}
                                                        onMouseEnter={() => flatIndex != null && setIndiceSeleccionado(flatIndex)}
                                                        onClick={(event) => handleProductClick(producto, event.currentTarget.getBoundingClientRect())}
                                                        className={cn(
                                                            'flex h-10 w-full items-center justify-between gap-3 rounded-lg border px-3 text-left transition-colors',
                                                            seleccionado
                                                                ? 'border-[#FF7A00] bg-[#FF7A00]/5'
                                                                : 'border-transparent hover:bg-muted/60'
                                                        )}
                                                    >
                                                        <span className="min-w-0 truncate text-sm font-semibold text-foreground">{producto.nombre}</span>
                                                        <span className="shrink-0 text-sm font-bold tabular-nums text-[#FF7A00]">
                                                            ${parseFloat(producto.precio).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                                        </span>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>}
                    </div>,
                    catalogoTarget,
                )}

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
            </>
        )
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
            <div className="relative shrink-0 flex items-center justify-between gap-2 px-4 pt-2 bg-background">
                <span className="min-w-0 truncate text-xs font-bold text-muted-foreground">{modoEdicion ? `Editando pedido #${initialPedido.id}` : 'Nuevo pedido'}</span>
                <div className="flex items-center gap-2 shrink-0">
                    {/* Sin conexión: el POS sigue anotando pedidos en la cola local. */}
                    {!online && (
                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600 bg-amber-500/10 border border-amber-500/30 rounded-full px-2.5 py-1">
                            <WifiOff className="h-3.5 w-3.5" /> Sin conexión
                        </span>
                    )}
                    {/* Pedidos guardados sin conexión: pendientes de sincronizar. */}
                    {pendientes.length > 0 && (
                        <button
                            onClick={() => setShowPendientes((s) => !s)}
                            title="Pedidos guardados sin conexión"
                            className={cn(
                                'flex items-center gap-1.5 text-[11px] font-bold rounded-full px-2.5 py-1 border transition-colors',
                                showPendientes
                                    ? 'bg-[#FF7A00]/20 border-[#FF7A00]/40 text-[#FF7A00]'
                                    : 'bg-[#FF7A00]/10 border-[#FF7A00]/30 text-[#FF7A00] hover:bg-[#FF7A00]/20'
                            )}
                        >
                            {sincronizando
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <WifiOff className="h-3.5 w-3.5" />}
                            {pendientes.length} pendiente{pendientes.length === 1 ? '' : 's'}
                        </button>
                    )}
                    {/* En el modo siempre abierto (módulo POS activo en desktop) no hay
                        cierre posible: la "x" sólo se muestra cuando el padre la habilita. */}
                    {mostrarBotonCerrar && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={requestClose}>
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>

                {/* ── Panel de pedidos sin conexión ── */}
                {showPendientes && (
                    <div className="absolute right-0 top-full mt-1 w-[340px] max-h-[65vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl z-[1001] p-2 space-y-1.5">
                        <div className="flex items-center justify-between px-2 pt-1.5 pb-1">
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Pedidos sin conexión</p>
                            <button onClick={() => setShowPendientes(false)} className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted">
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                        {pendientes.length === 0 ? (
                            <p className="text-sm text-muted-foreground/60 py-6 text-center">No hay pedidos sin conexión.</p>
                        ) : (
                            pendientes.map((p) => {
                                const hora = new Date(p.creadoEn).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                                const tipoLabel = p.tipo === 'delivery' ? 'Delivery' : p.tipo === 'mesa' ? 'Mesa' : 'Takeaway'
                                return (
                                    <div key={p.localId} className="rounded-xl border border-border p-2.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-sm font-bold">#LOCAL-{p.localNumero}</span>
                                            <span className={cn('text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5', p.estado === 'pendiente' ? 'bg-amber-500/10 text-amber-600' : 'bg-red-500/10 text-red-600')}>
                                                {p.estado === 'pendiente' ? 'Pendiente' : 'Error'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {hora} · {tipoLabel} · ${p.draft.total.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                        </p>
                                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                                            {p.draft.items.map((it) => `${it.cantidad}x ${it.nombre}`).join(', ')}
                                        </p>
                                        {p.estado === 'error' && p.errorMessage && (
                                            <p className="text-[11px] text-red-600 mt-1">{p.errorMessage}</p>
                                        )}
                                        <div className="flex items-center gap-1.5 mt-2">
                                            <button
                                                onClick={() => void reimprimirPendiente(p)}
                                                className="flex-1 h-8 rounded-lg bg-muted hover:bg-accent text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                                            >
                                                <Printer className="h-3.5 w-3.5" /> Imprimir
                                            </button>
                                            <button
                                                onClick={() => eliminarPendiente(p)}
                                                title="Eliminar pedido sin conexión"
                                                className="h-8 px-2.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs font-semibold flex items-center justify-center transition-colors"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                        {sincronizando && (
                            <p className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-muted-foreground py-2">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sincronizando…
                            </p>
                        )}
                    </div>
                )}
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
                                    // Las flechitas recorren el resultado: el producto destacado
                                    // (el del marquito) es el que Enter agrega al pedido.
                                    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                                        if (!mostrarListado || productosOrdenados.length === 0) return
                                        e.preventDefault()
                                        navegacionTecladoRef.current = true
                                        setIndiceSeleccionado((prev) => {
                                            const horizontal = e.key === 'ArrowLeft' || e.key === 'ArrowRight'
                                            const columnas = horizontal ? 1 : calcularColumnas()
                                            const direccion = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1
                                            return (prev + direccion * columnas + productosOrdenados.length) % productosOrdenados.length
                                        })
                                        return
                                    }
                                    // Enter agrega el primer producto visible del resultado filtrado
                                    // (primera categoría del listado), no el primero del store.
                                    // Con el listado oculto se exige una búsqueda: no se agrega algo invisible.
                                    if (e.key === 'Enter' && mostrarListado && productosOrdenados.length > 0) {
                                        e.preventDefault()
                                        const producto = productosOrdenados[Math.min(indiceSeleccionado, productosOrdenados.length - 1)] ?? productosOrdenados[0]
                                        handleProductClick(producto, e.currentTarget.getBoundingClientRect())
                                    }
                                }}
                                placeholder="Buscar producto o tag..."
                                className="h-10 pl-10 pr-10 rounded-xl border-0 shadow-sm"
                            />
                        </div>
                    </div>
                    {/* Scroll con scrollbar nunca visible: el scroll entre productos sigue funcionando. */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {!mostrarListado ? (
                            <p className="text-sm text-muted-foreground/60 py-12 text-center">Escribí para buscar un producto.</p>
                        ) : productosFiltrados.length === 0 ? (
                            <p className="text-sm text-muted-foreground/60 py-12 text-center">No se encontraron productos.</p>
                        ) : (
                            porCategoria.map(([cat, items]) => (
                                <div key={cat} className="mb-5">
                                    <h4 className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-2">{cat}</h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                        {items.map((p) => {
                                            const flatIndex = indicePorId.get(p.id)
                                            return (
                                                <button
                                                    key={p.id}
                                                    tabIndex={-1}
                                                    data-flat-index={flatIndex}
                                                    onClick={(event) => handleProductClick(p, event.currentTarget.getBoundingClientRect())}
                                                    className={cn(
                                                        'group min-h-28 text-left rounded-2xl bg-card p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7A00] active:translate-y-0 active:scale-[0.98]',
                                                        flatIndex === indiceSeleccionado && 'ring-2 ring-[#FF7A00]'
                                                    )}
                                                >
                                                    <p className="min-h-[3.5rem] text-base font-semibold leading-snug text-foreground line-clamp-3">{p.nombre}</p>
                                                    <div className="flex items-center justify-between mt-3">
                                                        <span className="text-base font-bold text-[#FF7A00]">
                                                            ${parseFloat(p.precio).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                                        </span>
                                                    </div>
                                                </button>
                                            )
                                        })}
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
    // Los ingredientes y extras se modifican sobre un ítem ya agregado. Al
    // cargar uno nuevo, el configurador sólo muestra las variantes.
    const mostrarIngredientes = !!initialItem && ingredientes.length > 0
    const mostrarExtras = !!initialItem && agregadosDisp.length > 0
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

    const columnasConfiguracion = [
        variantes.length > 0,
        variantesSecundarias.length > 0,
        mostrarIngredientes,
        mostrarExtras,
    ].filter(Boolean).length
    // En edición, ingredientes y extras ocupan columnas propias. El ancho extra
    // evita que "Extras" se vaya a una segunda fila cuando hay tres secciones.
    const width = columnasConfiguracion >= 4
        ? Math.min(1120, window.innerWidth - 24)
        : columnasConfiguracion >= 3
            ? Math.min(920, window.innerWidth - 24)
            : 360
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
                        columnasConfiguracion >= 4
                            ? 'grid grid-cols-1 gap-4 sm:grid-cols-4'
                            : columnasConfiguracion >= 3
                            ? 'grid grid-cols-1 gap-4 sm:grid-cols-3'
                            : columnasConfiguracion === 2
                                ? 'grid grid-cols-1 gap-4 sm:grid-cols-2'
                                : 'space-y-4'
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
                    {mostrarExtras && (
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
