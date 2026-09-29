import { useLayoutEffect, useState, type ElementType, type ReactNode, type RefObject } from 'react'
import type { useRestauranteStore } from '@/store/restauranteStore'

/** Producto tal como lo entrega el store (misma forma que usa el POS de escritorio). */
export type ProductoPos = ReturnType<typeof useRestauranteStore.getState>['productos'][number]

export type TipoPedidoPos = 'delivery' | 'takeaway' | 'mesa'

/** Acción del Dashboard que el menú del POS móvil ofrece (caja, mapa, mesas…). */
export interface PosAccionExtra {
    id: string
    label: string
    icon: ElementType
    onSelect: () => void
}

/** Fila del pedido tal como la necesita la UI móvil (sin detalles internos del carrito). */
export interface PosItemVista {
    key: string
    nombre: string
    varianteNombre?: string
    varianteSecundariaNombre?: string
    agregadosNombres: string[]
    ingredientesExcluidosNombres: string[]
    cantidad: number
    precioUnitario: number
    /** El producto tiene variantes, ingredientes o extras para ajustar. */
    editable: boolean
}

export const formatoPesos = (valor: number) =>
    `$${valor.toLocaleString('es-AR', { minimumFractionDigits: 0 })}`

export interface PosMetodoVista {
    id: string
    label: string
    icon: ElementType
}

/** Todo lo que el panel de pedido muestra; PuntoDeVenta sigue siendo dueño del estado. */
export interface PosPedidoDatos {
    tipo: TipoPedidoPos
    /** Tipos que el local habilitó para el POS (sin "mesa", que sólo se asigna desde el plano). */
    tiposHabilitados: Array<'delivery' | 'takeaway'>
    mesaNombre: string | null
    modoEdicion: boolean
    nombre: string
    telefono: string
    direccion: string
    costoEnvio: string
    notas: string
    metodoPago: string
    metodos: PosMetodoVista[]
    campos: { nombre: boolean; telefono: boolean; direccion: boolean }
    mostrarNotas: boolean
    direccionSoloTexto: boolean
    /** El último intento de anotar un delivery falló por falta de dirección. */
    direccionFaltante: boolean
    guardando: boolean
    hayCambios: boolean
    /** "Confirmar cobros manualmente": confirmar el alta pasa por el cobro y el botón se llama "Cobrar". */
    confirmaCobro?: boolean
    subtotal: number
    envio: number
    descuento: number
    total: number
}

export interface PosPedidoAcciones {
    onCantidad: (key: string, delta: number) => void
    onQuitar: (key: string) => void
    onEditar: (key: string) => void
    onVaciar: () => void
    onTipo: (tipo: 'delivery' | 'takeaway') => void
    onCliente: (datos: { nombreCliente: string; telefono: string }) => void
    onDireccion: (direccion: string, lat: number | null, lng: number | null) => void
    onCostoEnvio: (valor: string) => void
    onNotas: (valor: string) => void
    onMetodoPago: (id: string) => void
    onConfirmar: () => void
    onDespacharMesa?: () => void
    onImprimirNuevos?: () => void
    onReimprimirTodo?: () => void
}

// ─────────────────────────────────────────────
// Layout: dos paneles a partir de un ancho de contenedor
// ─────────────────────────────────────────────
/** Ancho del contenedor (no de la ventana: el menú lateral también le resta lugar) desde el
 *  cual el POS muestra catálogo y pedido lado a lado. Debajo, el pedido va en una hoja. */
export const ANCHO_DOS_PANELES = 700

export type LayoutPosMovil = 'telefono' | 'tablet'

const layoutPorAncho = (ancho: number): LayoutPosMovil => ancho >= ANCHO_DOS_PANELES ? 'tablet' : 'telefono'

/** Layout según el ancho real del contenedor. La primera medición ocurre antes del primer
 *  pintado, así que no hay un parpadeo entre el diseño de celular y el de tablet. */
export function useLayoutPosMovil(ref: RefObject<HTMLElement | null>): LayoutPosMovil {
    const [layout, setLayout] = useState<LayoutPosMovil>(() =>
        layoutPorAncho(typeof window === 'undefined' ? 0 : window.innerWidth))

    useLayoutEffect(() => {
        const elemento = ref.current
        if (!elemento) return
        const medir = (ancho: number) => { if (ancho > 0) setLayout(layoutPorAncho(ancho)) }
        medir(elemento.clientWidth)
        if (typeof ResizeObserver === 'undefined') return
        const observer = new ResizeObserver((entries) => medir(entries[0]?.contentRect.width ?? 0))
        observer.observe(elemento)
        return () => observer.disconnect()
    }, [ref])

    return layout
}

/** Pantallas táctiles: el buscador no debe abrir el teclado en pantalla sin que se lo toque. */
export const esPantallaTactil = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches

// ─────────────────────────────────────────────
// Catálogo: búsqueda y agrupación por categoría
// ─────────────────────────────────────────────
export const SIN_CATEGORIA = 'Sin categoría'

/** Cada término debe aparecer en el nombre, la descripción, la categoría o las etiquetas,
 *  sin importar el orden: "gratinado milanesa" encuentra un "Sandwich gratinado" de "Milanesa". */
export function filtrarProductos(productos: ProductoPos[], consulta: string): ProductoPos[] {
    const terminos = consulta.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (terminos.length === 0) return productos
    return productos.filter((producto) => {
        const texto = [
            producto.nombre,
            producto.descripcion,
            producto.categoria,
            ...(producto.etiquetas ?? []).map((etiqueta) => etiqueta.nombre),
        ].filter(Boolean).join(' ').toLowerCase()
        return terminos.every((termino) => texto.includes(termino))
    })
}

export interface GrupoCatalogo {
    categoria: string
    productos: ProductoPos[]
}

/** Categorías en el orden que definió el local (Menú → Categorías) y productos en el orden
 *  de su categoría; lo que no tiene categoría va al final. */
export function agruparCatalogo(productos: ProductoPos[], ordenCategorias: Map<string, number>): GrupoCatalogo[] {
    const grupos = new Map<string, ProductoPos[]>()
    for (const producto of productos) {
        const categoria = producto.categoria || SIN_CATEGORIA
        const lista = grupos.get(categoria)
        if (lista) lista.push(producto)
        else grupos.set(categoria, [producto])
    }
    const posicion = (categoria: string) => categoria === SIN_CATEGORIA ? Number.MAX_SAFE_INTEGER : (ordenCategorias.get(categoria) ?? 0)
    return [...grupos.entries()]
        .sort(([a], [b]) => posicion(a) - posicion(b) || a.localeCompare(b))
        .map(([categoria, lista]) => ({
            categoria,
            productos: [...lista].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.nombre.localeCompare(b.nombre) || a.id - b.id),
        }))
}

const CLAVE_FOTOS = 'piru:pos-movil-fotos'

/** Preferencia del cajero: ver las fotos de los productos o una grilla más densa sin ellas. */
export const leerVerFotos = () => {
    try { return localStorage.getItem(CLAVE_FOTOS) !== '0' } catch { return true }
}

export const guardarVerFotos = (ver: boolean) => {
    try { localStorage.setItem(CLAVE_FOTOS, ver ? '1' : '0') } catch { /* la preferencia sólo dura esta sesión */ }
}

/** El producto abre un selector antes de sumarse (tiene variantes). */
export const productoTieneOpciones = (producto: ProductoPos) =>
    (producto.variantes?.length ?? 0) > 0 || (producto.variantesSecundarias?.length ?? 0) > 0

// ─────────────────────────────────────────────
// Contrato de la pantalla completa (PosMovil)
// ─────────────────────────────────────────────
export interface PosMovilCatalogo {
    /** Productos disponibles en esta sede, sin filtrar por búsqueda ni por categoría. */
    productos: ProductoPos[]
    ordenCategorias: Map<string, number>
    consulta: string
    onConsulta: (valor: string) => void
    inputRef: RefObject<HTMLInputElement | null>
    categoria: string | null
    onCategoria: (categoria: string | null) => void
    /** Unidades ya cargadas en el pedido, por producto. */
    cantidades: Map<number, number>
    onProducto: (producto: ProductoPos, anchor: DOMRect) => void
    /** El menú todavía se está descargando: no es lo mismo que "no hay productos". */
    cargando?: boolean
}

export interface PosMovilProps {
    titulo: string
    subtitulo?: string
    /** Qué se está armando: un pedido nuevo, una mesa o la edición de un pedido existente. */
    contexto: 'nuevo' | 'mesa' | 'edicion'
    /** Botón de la izquierda: vuelve a la lista de pedidos (o al detalle, al editar). */
    volver?: { etiqueta: string; contador?: number; onClick: () => void }
    estado: {
        online: boolean
        pendientes: number
        sincronizando: boolean
        onPendientes: () => void
    }
    /** Panel de pedidos guardados sin conexión, ya armado; se muestra bajo la barra. */
    panelPendientes: ReactNode
    onCerrarPendientes: () => void
    menu: {
        onConfigurar: () => void
        onLimpiar?: () => void
        onCancelarEdicion?: () => void
        extras: PosAccionExtra[]
    }
    catalogo: PosMovilCatalogo
    items: PosItemVista[]
    datos: PosPedidoDatos
    acciones: PosPedidoAcciones
    hojaAbierta: boolean
    onHoja: (abierta: boolean) => void
    /** Hay un selector de producto encima: la hoja no debe reaccionar a Escape. */
    bloqueado: boolean
}
