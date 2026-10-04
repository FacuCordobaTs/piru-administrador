import { aplicarClienteRespuesta } from '@/lib/directorioClientesPos'
import { nuevoRequestId, reclamarPendiente } from '@/lib/posOffline'
import { leerMeta, guardarRegistro, borrarRegistro } from '@/lib/posLocalDb'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { ApiError, pedidoUnificadoApi, type PedidoUnificadoItemInput } from '@/lib/api'
import { usePrinter } from '@/context/PrinterContext'
import { formatComanda, commandsToBytes } from '@/utils/printerUtils'
import {
    usePosOfflineStore, sincronizarPendientes, registrarPedidoSincronizado,
    esErrorDeConexion, navegadorOffline, nextLocalNumero, deferComandaHastaPagado,
    type PedidoPosPendiente,
} from '@/lib/posOffline'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { POS_TIPOS_ORDER, getPosConfig, posDraftStorageKey, setPosConfig, usePosConfig, type PosMetodoPago } from '@/lib/posConfig'
import { PosConfigDialog } from '@/components/PosConfigDialog'
import { PosCobroQrDialog } from '@/components/PosCobroDialog'
import { mensajeConexionQr, requiereConfirmarCobro } from '@/lib/posCobro'
import { PosMovil } from '@/components/pos-movil/PosMovil'
import { PosPendientes } from '@/components/pos-movil/PosPendientes'
import { PosSelectorProducto } from '@/components/pos-movil/PosSelectorProducto'
import {
    esPantallaTactil, filtrarProductos, opcionesDeBebida, productoTieneOpciones, useVentanaCompacta,
    type OpcionBebida, type PasoPedidoPos, type PosAccionExtra, type PosItemVista, type PosPedidoAcciones, type PosPedidoDatos,
} from '@/components/pos-movil/posMovilLib'
import { X, Search, Plus, Banknote, CreditCard, Landmark, Smartphone } from 'lucide-react'

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
    /** Cobro con QR en curso: el pedido impago ya anotado, para retomarlo si se recarga la pantalla. */
    cobroQr?: { pedidoId: number }
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
    montoDescuento?: string | number | null
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
    /** Avisa antes del autosave que una mesa existente sumó productos. El
     *  Dashboard usa esta señal para reservar ese delta para la impresión
     *  manual de "Imprimir nuevos", sin afectar el claim de esos ítems. */
    onExistingMesaProductsAdded?: (pedidoId: number) => void
    /** Una edición nunca debe disparar la autoimpresión del Dashboard. */
    onExistingPedidoUpdated?: (pedidoId: number) => void
    /** Abre la confirmación para despachar la mesa. */
    onDispatchMesa?: () => void | Promise<void>
    /** Guarda el borrador y manda en una sola comanda el delta aún no impreso. */
    onPrintNewMesa?: () => void | Promise<void>
    onPrintAllMesa?: () => void | Promise<void>
    sucursalActivaId: number | null
    sedeEvento?: boolean
    /** El padre (Dashboard) espeja este borrador en la comanda de la derecha en vivo. */
    onDraftChange?: (draft: PosDraft | null) => void
    /** Volver al grid desde un pedido existente conserva el borrador. */
    onStartDraft?: () => void
    /** Sale del editor y vuelve al detalle de solo lectura del pedido. */
    onViewPedido?: () => void
    mesaAsignada?: { id: number; nombre: string } | null
    /** Desasigna la mesa al cambiar el borrador a delivery o takeaway. */
    onClearMesa?: () => void
    /** Resincroniza el mapa si el backend detecta una ocupación concurrente. */
    onMesaOcupadaDetectada?: () => void
    /** Sólo el borrador activo toma foco automático en el buscador. */
    autoFocusSearch?: boolean
    /** Antes de capturar una escritura rápida, permite al padre volver al borrador. */
    onProductSearchIntent?: () => void
    /** Pedido POS que se carga como borrador editable. */
    initialPedido?: PosEditablePedido | null
    /** Oculta la "x" de cierre: el POS queda siempre abierto (módulo activo en desktop). */
    mostrarBotonCerrar?: boolean
    /** Nombre de la sucursal activa, para la comanda impresa sin conexión. */
    sucursalNombre?: string
    /** En desktop, integra el catálogo como desplegable dentro de la comanda. */
    catalogoCompacto?: boolean
    /** Celular/tablet: vuelve a la lista de pedidos sin descartar el borrador. */
    onVerPedidos?: () => void
    /** Celular/tablet: pedidos activos, para el contador del botón de volver. */
    pedidosActivos?: number
    /** Celular/tablet: atajos del Dashboard (caja, mapa, mesas…) que se suman al menú del POS. */
    accionesExtra?: PosAccionExtra[]
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
    { onClose, onCreated, onUpdated, onExistingMesaProductsAdded, onExistingPedidoUpdated, onDispatchMesa, onPrintNewMesa, onPrintAllMesa, sucursalActivaId, sedeEvento = false, onDraftChange, onStartDraft, onViewPedido, mesaAsignada = null, onClearMesa, onMesaOcupadaDetectada, autoFocusSearch = true, onProductSearchIntent, initialPedido = null, mostrarBotonCerrar = true, sucursalNombre = '', catalogoCompacto = false, onVerPedidos, pedidosActivos, accionesExtra = [] },
    ref
) {
    const token = useAuthStore((s) => s.token)
    // La impresión de comandas es local (Tauri invoke): funciona sin conexión.
    const { printComanda, transferenciaAlias } = usePrinter()
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
    const [configurandoPos, setConfigurandoPos] = useState(false)
    // Cobro en curso con el QR de Mercado Pago.
    const [cobro, setCobro] = useState<{ modo: 'qr'; pedidoIdInicial: number | null } | null>(null)
    // Pedido impago ya anotado para el cobro con QR. Se persiste en el borrador (`cobroQr`).
    const [cobroQrPedidoId, setCobroQrPedidoId] = useState<number | null>(null)
    const cobroQrRef = useRef<{ clientRequestId: string; pedidoId: number | null; datos: (PosEditablePedido & { id?: number }) | null } | null>(null)
    const searchInputRef = useRef<HTMLInputElement>(null)
    // El destino cambia entre la comanda y la tercera columna sin perder el borrador.
    const [catalogoTarget, setCatalogoTarget] = useState<HTMLElement | null>(null)
    // Contenedor scrolleable del listado: mantiene el producto destacado a la vista.
    const scrollRef = useRef<HTMLDivElement>(null)
    const [cart, setCart] = useState<CartItem[]>([])
    const [configProducto, setConfigProducto] = useState<{
        producto: Producto
        anchor: DOMRect
        editKey?: string
        initialItem?: CartItem
    } | null>(null)
    // Celular: el pedido vive en una hoja que sube sobre el catálogo (en tablet es una columna fija).
    // Al abrir un pedido existente para editarlo, lo que se quiere ver primero es el pedido.
    const [hojaAbierta, setHojaAbierta] = useState(() => initialPedido != null)
    // Tablet: el panel del pedido muestra primero los productos y después cliente, entrega y pago.
    const [pasoPedido, setPasoPedido] = useState<PasoPedidoPos>('productos')
    const [categoriaMovil, setCategoriaMovil] = useState<string | null>(null)
    // Celular en vertical: el selector de un producto es una hoja inferior sin columnas de extras ni bebida.
    const ventanaCompacta = useVentanaCompacta()
    // El último intento de anotar un delivery falló por falta de dirección.
    const [direccionFaltante, setDireccionFaltante] = useState(false)
    // Producto destacado del resultado: es el que Enter agrega al pedido y el
    // que las flechitas recorren durante la búsqueda (indicado con el marquito).
    const [indiceSeleccionado, setIndiceSeleccionado] = useState(0)

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
    const enviandoRef = useRef(false)
    const autoSaveRef = useRef<(automatico?: boolean) => Promise<number | null>>(async () => null)
    const lastAutoSaveAttemptRef = useRef<string | null>(null)
    const [hydratedPedidoId, setHydratedPedidoId] = useState<number | null>(null)
    const modoEdicion = initialPedido != null
    // Una edición no comparte almacenamiento con el borrador de alta. El borrador
    // es uno solo por sucursal: asignar una mesa cambia el tipo pero conserva los
    // productos ya cargados, y volver a delivery muestra el mismo borrador.
    const storageKey = modoEdicion
        ? `piru:pos-edit:${initialPedido.id}`
        : posDraftStorageKey(sucursalActivaId, useAuthStore.getState().restaurante?.id)
    const [hydratedStorageKey, setHydratedStorageKey] = useState<string | null>(null)

    // ── Modo offline (sólo del POS) ──
    // Arranca con el estado real del navegador; si un pedido falla por red
    // mientras navigator.onLine sigue en true (servidor caído), se fuerza a
    // offline para que la UI avise y el reintento periódico se encargue.
    const [online, setOnline] = useState<boolean>(() => !navegadorOffline())
    const [showPendientes, setShowPendientes] = useState(false)
    const restauranteId = useAuthStore((s) => s.restaurante?.id ?? null)
    const todosPendientes = usePosOfflineStore((s) => s.pendientes)
    const pendientes = useMemo(() => todosPendientes.filter(p => (p.payload.sucursalId ?? null) === sucursalActivaId), [todosPendientes, sucursalActivaId])
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
        }).catch(() => toast.error('No se pudo acceder a los pedidos guardados en este dispositivo'))
    }, [])

    // La cola se hidrata desde IndexedDB y luego se sincroniza.
    useEffect(() => {
        if (restauranteId == null) return
        void usePosOfflineStore.getState().initPendientes(restauranteId).then(intentarSincronizar)
            .catch(() => toast.error('No se pudo abrir la cola POS; los datos anteriores se conservaron'))
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

    useLayoutEffect(() => {
        setCatalogoTarget(catalogoCompacto ? document.getElementById('pos-catalogo-compacto') : null)
    })

    // En el borrador, el lector/teclado debe poder empezar a buscar sin un click
    // previo. No se roba el foco de campos que el usuario haya elegido de forma
    // explícita, ni del configurador de un producto abierto.
    // En celular y tablet el buscador no se enfoca solo: abriría el teclado en pantalla
    // y taparía el catálogo antes de que el cajero toque nada.
    useEffect(() => {
        if (!autoFocusSearch || configProducto || (!catalogoCompacto && esPantallaTactil())) return
        const frame = window.requestAnimationFrame(focusProductSearch)
        return () => window.cancelAnimationFrame(frame)
    }, [autoFocusSearch, configProducto, catalogoTarget, catalogoCompacto])

    useEffect(() => {
        if (configProducto || hojaAbierta || cobro) return

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return

            const target = event.target as HTMLElement | null
            // Un campo elegido por el usuario conserva siempre la escritura.
            // La excepción es el propio buscador si el catálogo está muteado:
            // puede conservar el foco de antes y la primera tecla debe reactivarlo.
            const escribeEnBuscador = target === searchInputRef.current
            if (target?.closest('input, textarea, select, [contenteditable="true"]') && (!escribeEnBuscador || !onProductSearchIntent)) return
            if (document.activeElement === searchInputRef.current && !onProductSearchIntent) return

            event.preventDefault()
            onProductSearchIntent?.()
            focusProductSearch()
            setQuery((current) => current + event.key)
        }

        window.addEventListener('keydown', handleKeyDown, true)
        return () => window.removeEventListener('keydown', handleKeyDown, true)
    }, [configProducto, hojaAbierta, cobro, onProductSearchIntent])

    // El borrador sobrevive una recarga accidental dentro de la misma pestaña. Se
    // separa por sucursal para no cruzar comandas entre locales del mismo negocio.
    useEffect(() => {
        if (initialPedido) {
            // Cada versión recibida del servidor es una nueva base de edición.
            // Una firma intentada sobre la versión anterior no debe bloquear el
            // siguiente autoguardado.
            lastAutoSaveAttemptRef.current = null
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
            const carritoDelServidor = initialPedido.items.map((item) => {
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
            })
            setCart(carritoDelServidor)
            // El POS no se remonta con cada versión: un ajuste abierto sobre una fila que el
            // servidor renumeró (las nuevas nacen con una key local) ya no tiene dónde aplicarse.
            setConfigProducto((actual) => actual?.editKey != null && !carritoDelServidor.some((fila) => fila.key === actual.editKey) ? null : actual)
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
        setHydratedStorageKey(null)
        // Al volver de una edición a un borrador (p. ej. tras despachar una mesa) el POS móvil no se
        // remonta: la hoja, la categoría, el paso y la búsqueda de la edición anterior no deben quedar puestas.
        setHojaAbierta(false); setCategoriaMovil(null); setPasoPedido('productos'); setQuery(''); setDireccionFaltante(false)
        let cancelado = false
        let hidratado = false
        void (async () => {
        try {
            const saved = sessionStorage.getItem(storageKey)
            if (saved) {
                prefillEnvioRef.current = false
                const parsed = JSON.parse(saved) as Partial<PersistedPosDraft> & { encolado?: string }
                if (parsed.encolado && restauranteId != null) {
                    const marca = await leerMeta(restauranteId, `borradorEncolado:${parsed.encolado}`)
                    if (cancelado) return
                    if (marca?.valor) { resetForm(); hidratado = true; return }
                }
                if (cancelado) return
                setCart(Array.isArray(parsed.cart) ? parsed.cart : [])
                setTipo(mesaAsignada ? 'mesa' : parsed.tipo === 'delivery' ? 'delivery' : 'takeaway')
                setNombre(typeof parsed.nombre === 'string' ? parsed.nombre : '')
                setTelefono(typeof parsed.telefono === 'string' ? parsed.telefono : '')
                setDireccion(typeof parsed.direccion === 'string' ? parsed.direccion : '')
                setNotas(typeof parsed.notas === 'string' ? parsed.notas : '')
                setMetodoPago(typeof parsed.metodoPago === 'string' ? parsed.metodoPago : 'cash')
                setDeliveryFee(typeof parsed.deliveryFee === 'string' ? parsed.deliveryFee : '')
                const pedidoCobroQr = Number(parsed.cobroQr?.pedidoId)
                if (Number.isInteger(pedidoCobroQr) && pedidoCobroQr > 0) {
                    // Se recargó a mitad de un cobro con QR: el pedido impago ya existe, se retoma el mismo cobro.
                    cobroQrRef.current = { clientRequestId: nuevoRequestId(), pedidoId: pedidoCobroQr, datos: null }
                    setCobroQrPedidoId(pedidoCobroQr)
                    setCobro({ modo: 'qr', pedidoIdInicial: pedidoCobroQr })
                }
            } else {
                prefillEnvioRef.current = false
                setCart([]); setNombre(''); setTelefono(''); setDireccion(''); setLat(null); setLng(null)
                setNotas(''); setMetodoPago('cash'); setDeliveryFee(''); setTipo(mesaAsignada ? 'mesa' : 'takeaway')
            }
            hidratado = true
        } catch {
            toast.error('No se pudo recuperar el borrador; se conservó para reintentar')
        } finally {
            if (!cancelado && hidratado) setHydratedStorageKey(storageKey)
        }
        })()
        return () => { cancelado = true }
    }, [storageKey, initialPedido])

    useEffect(() => {
        setTipo((current) => mesaAsignada ? 'mesa' : current === 'mesa' ? 'takeaway' : current)
    }, [mesaAsignada])

    useEffect(() => {
        if (modoEdicion) return
        if (hydratedStorageKey !== storageKey) return
        const persisted: PersistedPosDraft = { cart, tipo, nombre, telefono, direccion, notas, metodoPago, deliveryFee, ...(cobroQrPedidoId != null ? { cobroQr: { pedidoId: cobroQrPedidoId } } : {}) }
        const hasContent = cart.length > 0 || [nombre, telefono, direccion, notas, deliveryFee].some((value) => value.trim() !== '')
        try {
            if (hasContent) sessionStorage.setItem(storageKey, JSON.stringify(persisted))
            else sessionStorage.removeItem(storageKey)
        } catch {
            // sessionStorage puede estar deshabilitado; el POS sigue funcionando en memoria.
        }
    }, [modoEdicion, hydratedStorageKey, storageKey, cart, tipo, nombre, telefono, direccion, notas, metodoPago, deliveryFee, cobroQrPedidoId])

    // Si la configuración del POS deshabilitó el tipo o el método de pago del
    // borrador, se pasa al primero habilitado. Al editar se respeta el pedido.
    useEffect(() => {
        if (modoEdicion || mesaAsignada) return
        setTipo((current) => config.tipos[current]
            ? current
            : (config.tipos.takeaway ? 'takeaway' : (tiposHabilitados[0] ?? 'takeaway')))
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
    const productosActivos = useMemo(() => productos.filter((p) => p.activo !== false && (
        p.eventoSucursalId != null
            ? p.eventoSucursalId === sucursalActivaId
            : !(sedeEvento && config.soloProductosEvento)
    )), [productos, sucursalActivaId, sedeEvento, config.soloProductosEvento])
    const productosFiltrados = useMemo(() => filtrarProductos(productosActivos, query), [productosActivos, query])
    // Celular/tablet: las categorías se muestran en el orden que el local definió en Menú.
    const categoriasStore = useRestauranteStore((s) => s.categorias)
    const cargandoMenu = useRestauranteStore((s) => s.isLoading)
    const ordenCategorias = useMemo(
        () => new Map(categoriasStore.map((categoria) => [categoria.nombre, categoria.orden ?? 0])),
        [categoriasStore],
    )
    // Tablet: bebidas activas que el selector de un producto ofrece sumar en el mismo toque.
    const bebidasActivas = useMemo(() => opcionesDeBebida(productosActivos, ordenCategorias), [productosActivos, ordenCategorias])

    const catalogoEnColumna = catalogoCompacto && config.catalogoEnColumna
    const mostrarListado = catalogoEnColumna || query.trim() !== ''

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
    // No usamos scrollIntoView: el catálogo puede estar renderizado por portal
    // y también mover el panel/página. Ajustamos únicamente su propio scroll.
    useLayoutEffect(() => {
        if (!mostrarListado) return
        const listado = scrollRef.current
        const card = listado?.querySelector<HTMLElement>(`[data-flat-index="${indiceSeleccionado}"]`)
        if (!listado || !card) return

        const listadoRect = listado.getBoundingClientRect()
        const cardRect = card.getBoundingClientRect()
        const margen = 8
        if (cardRect.top < listadoRect.top + margen) {
            listado.scrollTop += cardRect.top - listadoRect.top - margen
        } else if (cardRect.bottom > listadoRect.bottom - margen) {
            listado.scrollTop += cardRect.bottom - listadoRect.bottom + margen
        }
    }, [catalogoTarget, indiceSeleccionado, mostrarListado, productosOrdenados])

    // Columnas reales del grid de resultados: las flechitas verticales saltan
    // de fila en fila y las horizontales de producto en producto.
    const calcularColumnas = () => {
        const contenedor = scrollRef.current
        const tarjeta = contenedor?.querySelector<HTMLElement>('[data-flat-index]')
        const grid = tarjeta?.parentElement
        if (!grid || !tarjeta || tarjeta.offsetWidth === 0) return 1
        const style = window.getComputedStyle(grid)
        if (style.display !== 'grid') return 1
        return Math.max(1, style.gridTemplateColumns.split(' ').filter(Boolean).length)
    }

    const cartTotal = useMemo(
        () => cart.reduce((s, it) => s + itemUnitPrice(it) * it.cantidad, 0),
        [cart]
    )
    const deliveryFeeNum = tipo === 'delivery' ? parseFloat(deliveryFee) || 0 : 0
    const totalFinal = cartTotal + deliveryFeeNum - (Number(initialPedido?.montoDescuento) || 0)

    // La comparación usa únicamente los datos que efectivamente se envían al
    // backend. Así, claves locales del carrito o cambios de formato no habilitan
    // guardado si la comanda sigue siendo idéntica.
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
        ingredientesExcluidos: number[] = [],
        /** Tablet: bebida elegida junto al producto. Entra como una fila propia, justo después. */
        bebida?: OpcionBebida,
    ) => {
        if (submitting) return
        // Cada toque es una fila independiente: dos pedidos iguales pueden requerir
        // cambios distintos después y no deben fusionarse silenciosamente.
        const nuevaFila = (
            productoFila: Producto,
            varianteFila?: { id: number; nombre: string; precio: string },
            secundariaFila?: { id: number; nombre: string; precio: string },
            agregadosFila: CartItem['agregados'] = [],
            excluidosFila: number[] = [],
        ): CartItem => ({
            key: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
            productoId: productoFila.id,
            nombre: productoFila.nombre,
            varianteId: varianteFila?.id,
            varianteNombre: varianteFila?.nombre,
            varianteSecundariaId: secundariaFila?.id,
            varianteSecundariaNombre: secundariaFila?.nombre,
            precioBase: (varianteFila ? parseFloat(varianteFila.precio) : parseFloat(productoFila.precio)) + (secundariaFila ? parseFloat(secundariaFila.precio) : 0),
            ingredientesExcluidos: excluidosFila,
            agregados: agregadosFila,
            cantidad: 1,
        })
        const filas = [nuevaFila(producto, variante, varianteSecundaria, agregados, ingredientesExcluidos)]
        if (bebida) filas.push(nuevaFila(bebida.producto, bebida.variante, bebida.varianteSecundaria))
        setCart((prev) => [...prev, ...filas])
        // Al agregar al borrador se limpia el buscador: el próximo producto
        // se escribe directo, sin borrar el término anterior.
        setQuery('')
        // Esperar al render garantiza que el input siga montado y activo incluso
        // cuando el alta cerró el configurador de variantes. En pantallas táctiles
        // el foco se suelta: así el teclado en pantalla no tapa el catálogo.
        const tactil = !catalogoCompacto && esPantallaTactil()
        if (tactil) {
            try { navigator.vibrate?.(8) } catch { /* sin vibración disponible */ }
        }
        window.requestAnimationFrame(() => {
            if (tactil) searchInputRef.current?.blur()
            else searchInputRef.current?.focus()
        })
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

    // `conservarVista`: la mesa que se abre con su primer producto también pasa por acá, pero quien
    // sigue cargando productos no debe perder la categoría ni la hoja que tenía a la vista.
    const resetForm = (conservarVista = false) => {
        prefillEnvioRef.current = false
        setCart([]); setNombre(''); setTelefono(''); setDireccion(''); setLat(null); setLng(null)
        setNotas(''); setMetodoPago('cash'); setDeliveryFee(''); setTipo(mesaAsignada ? 'mesa' : 'takeaway')
        setQuery(''); setDireccionFaltante(false)
        if (!conservarVista) { setHojaAbierta(false); setCategoriaMovil(null); setPasoPedido('productos') }
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

    const requestViewPedido = () => {
        if (hasChanges && !window.confirm('¿Volver a la vista del pedido sin guardar los cambios?')) return
        onViewPedido?.()
    }

    const requestClearDraft = () => {
        const hasContent = cart.length > 0 || [nombre, telefono, direccion, notas, deliveryFee].some((value) => value.trim() !== '')
        if (hasContent && !window.confirm('¿Limpiar el borrador actual?')) return
        resetForm()
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
            transferenciaAlias,
            sucursalNombre: sucursalNombre || undefined,
            mesaNombre: draft.mesaNombre,
        }, itemsToPrint, restauranteNombre)
        await printComanda(commandsToBytes(comandaData))
    }

    // Se recibe la misma fila durable creada ANTES del primer POST.
    const guardarPedidoOffline = async (pendiente: PedidoPosPendiente, imprimir: boolean) => {
        setOnline(false)
        if (imprimir && (!deferComandaHastaPagado(pendiente.draft.metodoPago, cucuruConfigurado) || pendiente.draft.pagado)) {
            // Persistir el claim antes del efecto físico. Tras un crash, revisión manual.
            pendiente = { ...pendiente, impresion: 'iniciada', payload: { ...pendiente.payload, impresoOffline: true } }
            await usePosOfflineStore.getState().guardarPendiente(pendiente)
            try {
                await imprimirComandaPendiente(pendiente)
                pendiente.impresion = 'impresa'
            } catch {
                pendiente.impresion = 'revisar'
                toast.warning('Pedido guardado; revisá la impresión desde pedidos pendientes')
            }
        }
        await usePosOfflineStore.getState().guardarPendiente({ ...pendiente, estado: 'pendiente', leaseHasta: 0 })
        toast.success('Pedido guardado en este dispositivo', {
            description: imprimir ? 'Se sincronizará al volver la conexión.' : 'La confirmación está pendiente. Se reintentará sin duplicar la venta.',
        })
        resetForm()
        intentarSincronizar()
    }

    const reimprimirPendiente = async (pendiente: PedidoPosPendiente) => {
        try {
            if (restauranteId == null) return
            const reservado = await reclamarPendiente(restauranteId, pendiente.localId, true)
            if (!reservado) return
            const claimed: PedidoPosPendiente = { ...reservado, impresion: 'iniciada', payload: { ...reservado.payload, impresoOffline: true } }
            await usePosOfflineStore.getState().guardarPendiente(claimed)
            try {
                await imprimirComandaPendiente(claimed)
                claimed.impresion = 'impresa'
            } finally {
                await guardarRegistro('pedidosPendientes', { ...claimed, restauranteId, estado: pendiente.estado === 'error_bloqueante' ? 'error_bloqueante' : 'pendiente', impresion: claimed.impresion === 'iniciada' ? 'revisar' : 'impresa', leaseHasta: 0 })
                await usePosOfflineStore.getState().initPendientes(restauranteId)
            }
            toast.success(`Comanda #LOCAL-${pendiente.localNumero} enviada a imprimir`)
        } catch (error) {
            toast.error(`No se pudo imprimir #LOCAL-${pendiente.localNumero}`, {
                description: error instanceof Error ? error.message : undefined,
            })
        }
    }

    const eliminarPendiente = async (pendiente: PedidoPosPendiente) => {
        if ((pendiente.leaseHasta ?? 0) > Date.now()) return
        if (!window.confirm(`¿Eliminar el pendiente #LOCAL-${pendiente.localNumero}? Si estaba esperando confirmación, revisá también los pedidos del local antes de volver a cargarlo.`)) return
        await usePosOfflineStore.getState().eliminarPendiente(pendiente.localId)
    }

    // La comanda del Dashboard (panel derecho) opera el borrador a través de este handle.
    useImperativeHandle(ref, () => ({ removeItem, editItem, updateDraft, requestClose, submitDraft: handleSubmit, clearDraft: () => resetForm(), focusProductSearch, getCartItems }))

    // Datos del alta tal como viajan al backend. `pagadoAlta` distingue el alta común (nace cobrada)
    // del pedido impago de un cobro con QR.
    const armarAlta = (pagadoAlta: boolean) => {
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
            pagado: pagadoAlta,
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
        return { items, data }
    }

    const handleSubmit = async (automatico = false): Promise<number | null> => {
        if (!token || enviandoRef.current) return null
        // Despachar una mesa ya guardada no exige introducir un cambio artificial.
        if (modoEdicion && !hasChanges) return initialPedido.id
        if (cart.length === 0) {
            toast.error('Agregá al menos un producto')
            return null
        }
        if (tipo === 'delivery' && config.camposCliente.direccion && !direccion.trim()) {
            toast.error('Ingresá la dirección de entrega')
            // Un guardado automático no interrumpe: sólo el intento manual marca el campo.
            if (!automatico && !catalogoCompacto) setDireccionFaltante(true)
            return null
        }

        // Sólo Mercado Pago pasa por el cobro con QR; los demás métodos se anotan directamente.
        if (!automatico
            && requiereConfirmarCobro({ config, modoEdicion, tipo, conMesa: mesaAsignada != null, metodoPago })) {
            setCobro({ modo: 'qr', pedidoIdInicial: null })
            return null
        }

        const { items, data } = armarAlta(pagado)

        enviandoRef.current = true
        setSubmitting(true)
        lastAutoSaveAttemptRef.current = currentSignature
        try {
            // Editar un pedido existente requiere el servidor: la cola offline
            // es sólo para altas nuevas del POS.
            if (modoEdicion) {
                // El guardado del editor es silencioso, pero nunca puede
                // convertirse en una impresión automática.
                onExistingPedidoUpdated?.(initialPedido.id)
                const agregoProductosAMesaExistente =
                    initialPedido.tipo === 'mesa' &&
                    initialPedido.items.length > 0 &&
                    cart.some((item) => {
                        if (item.serverItemId == null) return true
                        const itemOriginal = initialPedido.items.find((original) => original.id === item.serverItemId)
                        return !!itemOriginal && item.cantidad > itemOriginal.cantidad
                    })

                // Se avisa antes del request para cubrir la carrera en la que
                // el WebSocket publica la actualización antes que la respuesta
                // de updateFromPos llegue al Dashboard.
                if (agregoProductosAMesaExistente) {
                    onExistingMesaProductsAdded?.(initialPedido.id)
                }
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
                    if (restauranteId != null) await aplicarClienteRespuesta(restauranteId, res)
                    if (!automatico) toast.success('Pedido actualizado correctamente')
                    if (res.data) onUpdated?.(res.data)
                    return res.data?.id ?? initialPedido.id
                } else {
                    lastAutoSaveAttemptRef.current = null
                    toast.error(res.message || 'No se pudo actualizar el pedido')
                    return null
                }
            }

            if (restauranteId == null) throw new Error('Sesión POS no disponible')
            await usePosOfflineStore.getState().initPendientes(restauranteId)
            const clientRequestId = nuevoRequestId()
            const pendiente: PedidoPosPendiente = {
                restauranteId,
                localId: clientRequestId, localNumero: await nextLocalNumero(restauranteId),
                draftKey: storageKey,
                creadoEn: new Date().toISOString(), tipo: data.tipo, estado: 'sincronizando',
                leaseHasta: Date.now() + 120_000, impresion: 'sin_imprimir',
                draft: buildDraftSnapshot(false), payload: { ...data, clientRequestId },
            }
            // Marcador enlazado al commit IDB: al reiniciar no restaurar como
            // borrador nuevo una venta que ya está en la cola (o fue confirmada).
            try {
                const saved = JSON.parse(sessionStorage.getItem(storageKey) || '{}')
                sessionStorage.setItem(storageKey, JSON.stringify({ ...saved, encolado: clientRequestId }))
            } catch { /* El pedido se conserva igualmente en la cola durable. */ }
            // Si falla IndexedDB, el carrito permanece y no se envía ni imprime.
            await usePosOfflineStore.getState().guardarPendiente(pendiente)
            if (useAuthStore.getState().restaurante?.id !== restauranteId) return null
            resetForm(data.tipo === 'mesa')
            if (!online || navegadorOffline()) {
                await guardarPedidoOffline(pendiente, true)
                return null
            }
            let res: { success?: boolean; data?: PosEditablePedido & { id?: number }; message?: string }
            try {
                res = await pedidoUnificadoApi.create(token, pendiente.payload) as typeof res
                if (!res?.success || !res.data?.id) throw new ApiError('Confirmación incompleta', 0)
            } catch (error) {
                if ((error as { response?: { code?: string } })?.response?.code === 'MESA_OCUPADA') onMesaOcupadaDetectada?.()
                if (esErrorDeConexion(error)) {
                    // Ya pudo imprimirse desde el evento del servidor. No imprimir
                    // automáticamente otra copia ante una respuesta ambigua.
                    await guardarPedidoOffline(pendiente, false)
                } else {
                    await guardarRegistro('pedidosPendientes', {
                        ...pendiente, restauranteId, leaseHasta: 0,
                        estado: error instanceof ApiError && error.status === 401 ? 'pendiente' : 'error_bloqueante',
                        errorMessage: error instanceof Error ? error.message : 'No se pudo crear el pedido',
                    })
                    await usePosOfflineStore.getState().initPendientes(restauranteId)
                    resetForm()
                    toast.error('Pedido pendiente de resolución', { description: 'Revisalo en el panel de pedidos guardados.' })
                }
                return null
            }
            await borrarRegistro('pedidosPendientes', restauranteId, pendiente.localId)
            await usePosOfflineStore.getState().initPendientes(restauranteId)
            if (useAuthStore.getState().restaurante?.id !== restauranteId) return null
            await aplicarClienteRespuesta(restauranteId, res)
            if (!automatico) toast.success(data.tipo === 'mesa' ? 'Mesa guardada correctamente' : 'Pedido anotado correctamente')
            if (res.data?.id) await onCreated(res.data.id, res.data)
            return res.data?.id ?? null
        } catch (error: unknown) {
            // Incluye fallos del almacenamiento: no afirmar que se guardó.
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
            toast.error(modoEdicion ? 'Error al actualizar el pedido' : 'No se pudo completar el guardado; revisá los pendientes antes de repetirlo', { description: error instanceof Error ? error.message : undefined })
            return null
        } finally {
            enviandoRef.current = false
            setSubmitting(false)
        }
    }

    // ── Cobro ("Confirmar cobros manualmente") ──
    const cerrarCobro = () => {
        cobroQrRef.current = null
        setCobroQrPedidoId(null)
        setCobro(null)
    }

    // Vuelta de la autorización de Mercado Pago para QR (el servidor redirige a /dashboard?mp_qr_status=…).
    // Se avisa, se limpia la URL y se abre la configuración para continuar o reintentar la conexión.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const resultado = params.get('mp_qr_status')
        if (!resultado) return
        const motivo = params.get('mp_qr_error')
        try { window.history.replaceState({}, '', window.location.pathname + window.location.hash) } catch { /* noop */ }
        if (resultado === 'success') {
            toast.success('Mercado Pago conectado para cobros con QR', { description: 'Ahora vinculá o creá la caja con la que cobrás.' })
        } else {
            toast.error('No se pudo conectar Mercado Pago', { description: mensajeConexionQr(motivo) })
        }
        setConfigurandoPos(true)
    }, [])

    // Cobro con QR: el pedido se anota impago (sin cola offline: sin red no hay cobro posible) y el servidor
    // lo acredita cuando Mercado Pago confirma. El borrador se conserva hasta entonces, así un cobro
    // cancelado o vencido no hace perder lo cargado. Reintentar reutiliza el mismo `clientRequestId`.
    const crearPedidoParaCobroQr = async (): Promise<number | null> => {
        if (!token) return null
        if (cobroQrRef.current?.pedidoId != null) return cobroQrRef.current.pedidoId
        const clientRequestId = cobroQrRef.current?.clientRequestId ?? nuevoRequestId()
        cobroQrRef.current = { clientRequestId, pedidoId: null, datos: null }
        try {
            const res = await pedidoUnificadoApi.create(token, { ...armarAlta(false).data, clientRequestId }) as { success?: boolean; data?: PosEditablePedido & { id?: number } }
            const pedidoId = res?.data?.id
            if (!res?.success || !pedidoId) throw new ApiError('Confirmación incompleta', 0)
            cobroQrRef.current = { clientRequestId, pedidoId, datos: res.data ?? null }
            setCobroQrPedidoId(pedidoId)
            return pedidoId
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo anotar el pedido')
            return null
        }
    }

    // Mercado Pago confirmó el pago: el pedido ya está cobrado en el servidor. Se limpia el borrador y se
    // avisa al Dashboard para que imprima la comanda (diferida hasta que el pedido está pago).
    const finalizarCobroQr = async (pedidoId: number) => {
        const datos = cobroQrRef.current?.datos ?? undefined
        cobroQrRef.current = null
        setCobroQrPedidoId(null)
        resetForm()
        toast.success('Pago recibido: pedido anotado')
        await onCreated(pedidoId, datos)
    }

    // Las mesas nuevas y cualquier pedido abierto en el editor se guardan
    // automáticamente apenas termina una ráfaga de cambios. Este guardado nunca
    // imprime: la impresión siempre es manual.
    autoSaveRef.current = handleSubmit
    useEffect(() => {
        const debeAutoguardar = modoEdicion || (tipo === 'mesa' && !!mesaAsignada)
        if (!online || !debeAutoguardar || cart.length === 0 || !hasChanges || submitting) return
        if (lastAutoSaveAttemptRef.current === currentSignature) return
        const timeout = window.setTimeout(() => {
            // handleSubmit registra la firma sólo después de confirmar que no
            // hay otro envío en curso. Así un timer que coincide con otra acción
            // no deja el borrador bloqueado hasta pulsar Imprimir/Reimprimir.
            void autoSaveRef.current(true)
        }, 800)
        return () => window.clearTimeout(timeout)
    }, [online, modoEdicion, tipo, mesaAsignada?.id, cart.length, hasChanges, submitting, currentSignature])

    // ── Celular y tablet: lo que la pantalla completa (PosMovil) necesita ──
    // El estado sigue siendo de este componente; PosMovil sólo lo dibuja.
    const cantidadesPorProducto = useMemo(() => {
        const mapa = new Map<number, number>()
        cart.forEach((it) => mapa.set(it.productoId, (mapa.get(it.productoId) ?? 0) + it.cantidad))
        return mapa
    }, [cart])

    const itemsVista = useMemo<PosItemVista[]>(() => cart.map((it) => {
        const producto = productos.find((candidato) => candidato.id === it.productoId)
        return {
            key: it.key,
            nombre: it.nombre,
            varianteNombre: it.varianteNombre,
            varianteSecundariaNombre: it.varianteSecundariaNombre,
            agregadosNombres: it.agregados.map((agregado) => agregado.nombre),
            ingredientesExcluidosNombres: producto?.ingredientes
                ?.filter((ingrediente) => it.ingredientesExcluidos.includes(ingrediente.id))
                .map((ingrediente) => ingrediente.nombre) ?? [],
            cantidad: it.cantidad,
            precioUnitario: itemUnitPrice(it),
            editable: !!producto && (
                productoTieneOpciones(producto)
                || (producto.ingredientes?.length ?? 0) > 0
                || (producto.agregados?.length ?? 0) > 0
            ),
        }
    }), [cart, productos])

    const requestVaciar = () => {
        if (submitting || cart.length === 0) return
        if (!window.confirm('¿Quitar todos los productos del pedido?')) return
        setCart([])
    }

    // Ir a la lista de pedidos no descarta el borrador (queda en sessionStorage). Al editar
    // un pedido existente, en cambio, lo no guardado se perdería: se pregunta primero.
    const requestVerPedidos = () => {
        if (modoEdicion && hasChanges && !window.confirm('¿Salir sin guardar los cambios del pedido?')) return
        onVerPedidos?.()
    }

    const tiposMovil = tiposHabilitados.filter((t): t is 'delivery' | 'takeaway' => t !== 'mesa')
    const nombreMesa = mesaAsignada?.nombre ?? initialPedido?.mesaNombre ?? null

    const datosPedido: PosPedidoDatos = {
        tipo,
        tiposHabilitados: tiposMovil,
        mesaNombre: nombreMesa,
        modoEdicion,
        nombre,
        telefono,
        direccion,
        costoEnvio: deliveryFee,
        notas,
        metodoPago,
        metodos: metodosHabilitados,
        campos: config.camposCliente,
        mostrarNotas: config.notas,
        direccionSoloTexto,
        direccionFaltante,
        guardando: submitting,
        hayCambios: hasChanges,
        confirmaCobro: requiereConfirmarCobro({ config, modoEdicion, tipo, conMesa: mesaAsignada != null, metodoPago }),
        subtotal: cartTotal,
        envio: deliveryFeeNum,
        descuento: Number(initialPedido?.montoDescuento) || 0,
        total: totalFinal,
        paso: pasoPedido,
    }

    const accionesPedido: PosPedidoAcciones = {
        onCantidad: changeQty,
        onQuitar: removeItem,
        onEditar: editItem,
        onVaciar: requestVaciar,
        onTipo: (nuevoTipo) => { onClearMesa?.(); setTipo(nuevoTipo); setDireccionFaltante(false) },
        onCliente: updateDraft,
        onDireccion: (texto, latitud, longitud) => { setDireccion(texto); setLat(latitud); setLng(longitud); setDireccionFaltante(false) },
        onCostoEnvio: setDeliveryFee,
        onNotas: setNotas,
        onMetodoPago: setMetodoPago,
        onPaso: setPasoPedido,
        onConfirmar: () => void handleSubmit(),
        onDespacharMesa: onDispatchMesa ? () => void onDispatchMesa() : undefined,
        onImprimirNuevos: onPrintNewMesa ? () => void onPrintNewMesa() : undefined,
        onReimprimirTodo: onPrintAllMesa ? () => void onPrintAllMesa() : undefined,
    }

    const tituloMovil = modoEdicion
        ? (initialPedido.tipo === 'mesa' ? (nombreMesa || 'Mesa') : `Editando pedido #${initialPedido.id}`)
        : (mesaAsignada ? mesaAsignada.nombre : 'Nuevo pedido')

    const volverMovil = modoEdicion && onViewPedido
        ? { etiqueta: 'Volver', onClick: requestViewPedido }
        : onVerPedidos
            ? { etiqueta: 'Pedidos', contador: pedidosActivos, onClick: requestVerPedidos }
            : mostrarBotonCerrar ? { etiqueta: 'Cerrar', onClick: requestClose } : undefined

    const dialogosCobro = (
        <>
            {cobro?.modo === 'qr' && token && (
                <PosCobroQrDialog
                    total={totalFinal}
                    tipoLabel={tipo === 'delivery' ? 'Delivery' : 'Takeaway'}
                    token={token}
                    online={online && !navegadorOffline()}
                    cajaElegidaId={config.cajaMpQrId}
                    crearPedido={crearPedidoParaCobroQr}
                    pedidoIdInicial={cobro.pedidoIdInicial}
                    onPagado={finalizarCobroQr}
                    onCajaElegida={(cajaId) => setPosConfig({ ...getPosConfig(), cajaMpQrId: cajaId })}
                    onConfigurarCajas={() => { cerrarCobro(); setConfigurandoPos(true) }}
                    onCerrar={cerrarCobro}
                />
            )}
        </>
    )

    if (catalogoCompacto) {
        return (
            <>
                {catalogoTarget && createPortal(
                    <div className={cn('flex flex-col overflow-hidden', catalogoEnColumna ? 'h-full min-h-0' : 'relative z-[1000]')}>
                        <div className={cn('shrink-0', catalogoEnColumna ? 'border-b border-border/70 p-3' : mostrarListado && 'border-b border-border/70 pb-2.5')}>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                                <Input
                                    ref={searchInputRef}
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (mostrarListado && (event.key === 'ArrowDown' || event.key === 'ArrowUp' || (catalogoEnColumna && (event.key === 'ArrowLeft' || event.key === 'ArrowRight'))) && productosOrdenados.length > 0) {
                                            event.preventDefault()
                                            setIndiceSeleccionado((current) => {
                                                const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight'
                                                const columnas = horizontal ? 1 : calcularColumnas()
                                                const direccion = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1
                                                return (current + direccion * columnas + productosOrdenados.length) % productosOrdenados.length
                                            })
                                            return
                                        }
                                        if (event.key === 'Enter' && mostrarListado && productosOrdenados.length > 0) {
                                            event.preventDefault()
                                            const producto = productosOrdenados[Math.min(indiceSeleccionado, productosOrdenados.length - 1)] ?? productosOrdenados[0]
                                            handleProductClick(producto, event.currentTarget.getBoundingClientRect())
                                        }
                                    }}
                                    placeholder="Buscar producto o tag..."
                                    className="h-10 rounded-full border-border bg-muted/40 pl-10 shadow-none focus-visible:ring-[#FF7A00]"
                                />
                            </div>
                        </div>
                        {mostrarListado && <div ref={scrollRef} className={cn('overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', catalogoEnColumna ? 'min-h-0 flex-1 p-3' : 'relative z-[1000] mt-2 max-h-[min(45vh,400px)] rounded-xl border border-border bg-background p-2 shadow-2xl')}>
                            {productosFiltrados.length === 0 ? (
                                <p className="py-10 text-center text-sm text-muted-foreground">No se encontraron productos.</p>
                            ) : (
                                <div className={catalogoEnColumna ? 'space-y-5' : 'space-y-0.5'}>
                                    {porCategoria.map(([categoria, items]) => (
                                        <section key={categoria}>
                                            <h3 className={cn('text-[10px] font-bold uppercase tracking-widest text-muted-foreground', catalogoEnColumna ? 'mb-2' : 'px-3 pb-1 pt-2')}>{categoria}</h3>
                                            <div className={catalogoEnColumna ? 'grid grid-cols-[repeat(auto-fill,minmax(min(100%,130px),1fr))] gap-2' : 'flex flex-col'}>
                                                {items.map((producto) => {
                                                    const flatIndex = indicePorId.get(producto.id)
                                                    const seleccionado = flatIndex === indiceSeleccionado
                                                    return (
                                                        <button
                                                            key={producto.id}
                                                            type="button"
                                                            tabIndex={-1}
                                                            data-flat-index={flatIndex}
                                                            onClick={(event) => handleProductClick(producto, event.currentTarget.getBoundingClientRect())}
                                                            className={cn(
                                                                catalogoEnColumna
                                                                    ? 'group flex flex-col overflow-hidden rounded-xl border text-left transition-all hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 active:scale-[0.98]'
                                                                    : 'flex h-10 w-full items-center justify-between gap-3 rounded-lg border px-3 text-left transition-colors',
                                                                catalogoEnColumna && (producto.imagenUrl ? 'min-h-32' : 'min-h-24'),
                                                                seleccionado
                                                                    ? 'border-[#FF7A00] bg-[#FF7A00]/5 ring-1 ring-[#FF7A00]'
                                                                    : catalogoEnColumna ? 'border-border bg-card hover:bg-muted/60' : 'border-transparent hover:bg-muted/60'
                                                            )}
                                                        >
                                                            {catalogoEnColumna && producto.imagenUrl && (
                                                                <div className="aspect-[4/3] w-full shrink-0 overflow-hidden bg-muted">
                                                                    <img
                                                                        src={producto.imagenUrl}
                                                                        alt={producto.nombre}
                                                                        loading="lazy"
                                                                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                                    />
                                                                </div>
                                                            )}
                                                            {catalogoEnColumna ? <div className="flex flex-1 flex-col justify-between gap-1.5 p-2">
                                                                <span className="line-clamp-2 text-xs font-semibold leading-snug text-foreground">{producto.nombre}</span>
                                                                <span className="text-xs font-bold tabular-nums text-[#FF7A00]">
                                                                    ${parseFloat(producto.precio).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                                                </span>
                                                            </div> : <>
                                                                <span className="min-w-0 truncate text-sm font-semibold text-foreground">{producto.nombre}</span>
                                                                <span className="shrink-0 text-sm font-bold tabular-nums text-[#FF7A00]">
                                                                    ${parseFloat(producto.precio).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                                                </span>
                                                            </>}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </section>
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

                {dialogosCobro}
                {/* La comanda de escritorio tiene su propio diálogo; éste sólo se abre desde "Configurar QR" del cobro. */}
                <PosConfigDialog open={configurandoPos} onOpenChange={setConfigurandoPos} />
            </>
        )
    }

    return (
        <>
            <PosMovil
                titulo={tituloMovil}
                subtitulo={sucursalNombre || undefined}
                contexto={modoEdicion ? 'edicion' : mesaAsignada ? 'mesa' : 'nuevo'}
                volver={volverMovil}
                estado={{
                    online,
                    pendientes: pendientes.length,
                    sincronizando,
                    onPendientes: () => setShowPendientes((abierto) => !abierto),
                }}
                panelPendientes={showPendientes ? (
                    <PosPendientes
                        pendientes={pendientes}
                        sincronizando={sincronizando}
                        onCerrar={() => setShowPendientes(false)}
                        onReintentar={(pendiente) => void usePosOfflineStore.getState()
                            .guardarPendiente({ ...pendiente, estado: 'pendiente', leaseHasta: 0, errorMessage: undefined })
                            .then(intentarSincronizar).catch(() => toast.error('No se pudo preparar el reintento'))}
                        onImprimir={(pendiente) => void reimprimirPendiente(pendiente)}
                        onEliminar={(pendiente) => void eliminarPendiente(pendiente).catch(() => toast.error('No se pudo eliminar el pendiente'))}
                    />
                ) : null}
                onCerrarPendientes={() => setShowPendientes(false)}
                menu={{
                    onConfigurar: () => setConfigurandoPos(true),
                    onLimpiar: modoEdicion ? undefined : requestClearDraft,
                    onCancelarEdicion: modoEdicion && onViewPedido ? requestViewPedido : undefined,
                    extras: accionesExtra,
                }}
                catalogo={{
                    productos: productosActivos,
                    ordenCategorias,
                    consulta: query,
                    onConsulta: setQuery,
                    inputRef: searchInputRef,
                    categoria: categoriaMovil,
                    onCategoria: setCategoriaMovil,
                    cantidades: cantidadesPorProducto,
                    onProducto: handleProductClick,
                    cargando: cargandoMenu,
                }}
                items={itemsVista}
                datos={datosPedido}
                acciones={accionesPedido}
                hojaAbierta={hojaAbierta}
                onHoja={setHojaAbierta}
                bloqueado={configProducto != null}
            />

            <PosConfigDialog open={configurandoPos} onOpenChange={setConfigurandoPos} />
            {dialogosCobro}

            {/* ── Alta de un producto con variantes en tablet: extras y bebida en el mismo diálogo ── */}
            {configProducto && !configProducto.editKey && !ventanaCompacta && (
                <PosSelectorProducto
                    producto={configProducto.producto}
                    bebidas={bebidasActivas}
                    onCerrar={() => setConfigProducto(null)}
                    onAgregar={({ variante, varianteSecundaria, agregados, bebida }) => {
                        addToCart(configProducto.producto, variante, varianteSecundaria, agregados, [], bebida)
                        setConfigProducto(null)
                    }}
                />
            )}

            {/* ── Configuración de producto (variantes / ingredientes / extras) ── */}
            {configProducto && (configProducto.editKey || ventanaCompacta) && (
                <ProductConfigOverlay
                    modo="hoja"
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
})

export default PuntoDeVenta

// ─────────────────────────────────────────────
// Popover de configuración: queda anclado a la card en desktop y pasa a hoja inferior
// en touch/viewport chico para que nunca dependa de hover. En el POS móvil ("hoja") es siempre
// una hoja (celular) o un diálogo centrado (tablet): no hay tarjeta a la que anclarse.
// ─────────────────────────────────────────────
function ProductConfigOverlay({
    modo = 'popover',
    producto,
    anchor,
    onClose,
    initialItem,
    onConfirm,
    onChange,
}: {
    /** "popover": anclado a la tarjeta (escritorio). "hoja": hoja inferior en celular y
     *  diálogo centrado en tablet, con filas más grandes para el dedo. */
    modo?: 'popover' | 'hoja'
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
    const tactil = modo === 'hoja'
    const centrado = tactil && !isCompact
    const anclado = !isCompact && !centrado
    const panelClass = isCompact
        ? cn('fixed inset-x-0 bottom-0 rounded-t-3xl border-x border-t', tactil ? 'max-h-[88dvh] pb-[env(safe-area-inset-bottom)]' : 'max-h-[82vh]')
        : centrado
            ? cn('relative max-h-[min(680px,calc(100dvh-32px))] rounded-3xl border', columnasConfiguracion >= 3 ? 'max-w-[min(920px,100%)]' : 'max-w-md')
            : 'fixed max-h-[min(480px,calc(100vh-24px))] rounded-2xl border'
    const panelStyle = anclado ? { left, top, width } : undefined
    // Filas de opciones: más altas en pantallas táctiles.
    const fila = tactil ? 'px-4 py-3.5 text-[15px]' : 'px-3 py-2.5 text-sm'
    // Con un toque la variante se agrega sola: resaltar una "por defecto" sólo confundiría al dedo.
    // El teclado (Enter sobre la resaltada) y los pasos que exigen elegir sí la necesitan.
    const resaltarVariante = !tactil || !!initialItem || variantesSecundarias.length > 0

    return (
        <div
            className={cn(
                'fixed inset-0 z-[1002]',
                tactil ? 'bg-black/45' : isCompact && 'bg-background/60 backdrop-blur-sm',
                centrado && 'flex items-center justify-center p-4',
            )}
            onClick={onClose}
        >
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
                {tactil && isCompact && <div aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/25" />}
                <div className={cn('flex items-center justify-between gap-2 border-b border-border px-4', tactil ? 'py-3' : 'py-3')}>
                    <span className={cn('min-w-0 block truncate font-bold', tactil ? 'text-base' : 'text-sm')}>{producto.nombre}</span>
                    <button
                        type="button"
                        aria-label="Cerrar"
                        onClick={onClose}
                        className={cn('flex shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent', tactil ? 'h-10 w-10 rounded-xl' : 'h-7 w-7')}
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className={cn('space-y-4 overflow-y-auto overscroll-contain p-4', tactil ? 'min-h-0 flex-1' : 'max-h-[55vh]')}>
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
                                        className={cn(`w-full flex items-center justify-between rounded-xl border transition-colors ${fila}`,
                                            resaltarVariante && varianteId === v.id ? 'border-[#FF7A00] bg-[#FF7A00]/10 text-[#FF7A00] font-semibold' : 'border-border hover:bg-accent')}
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
                                        className={cn(`w-full flex items-center justify-between rounded-xl border transition-colors ${fila}`,
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
                                        className={cn(`w-full flex items-center rounded-xl border transition-colors ${fila}`, excluido ? 'border-transparent bg-transparent text-muted-foreground/50 line-through hover:bg-muted/40' : 'border-[#FF7A00] bg-[#FF7A00]/10 text-[#FF7A00] hover:bg-[#FF7A00]/20')}
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
                                            className={cn(`w-full flex items-center justify-between rounded-xl border transition-colors ${fila}`,
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
                            <Button onClick={() => onConfirm(variante, varianteSecundaria, agregadosObj, ingredientesExcluidos)} className={cn('flex-1 rounded-xl bg-[#FF7A00] hover:bg-[#E66E00] text-white font-bold', tactil ? 'h-12 text-base' : 'h-11')}>
                                Agregar
                            </Button>
                        </div>
                    </div>
                )}
                {/* Al ajustar un ítem ya cargado los cambios se aplican en vivo: en pantallas táctiles
                    un botón visible cierra el ajuste sin tener que adivinar que se toca afuera. */}
                {tactil && initialItem && (
                    <div className="border-t border-border p-4">
                        <Button onClick={onClose} className="h-12 w-full rounded-xl bg-[#FF7A00] text-base font-bold text-white hover:bg-[#E66E00]">
                            Listo
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}
