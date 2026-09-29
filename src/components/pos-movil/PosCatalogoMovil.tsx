import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
    SIN_CATEGORIA, agruparCatalogo, filtrarProductos, formatoPesos, productoTieneOpciones,
    type ProductoPos,
} from './posMovilLib'

interface PosCatalogoMovilProps {
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
    /** Muestra las fotos de los productos (el local puede apagarlas para ver más opciones). */
    conFotos: boolean
    /** Si se indica, el buscador se dibuja ahí (la barra superior del celular) en vez de sobre la grilla. */
    slotBuscador?: HTMLElement | null
    buscadorEnBarra?: boolean
}

function Chip({ activo, marcado, onClick, children }: { activo: boolean; marcado?: boolean; onClick: () => void; children: string }) {
    return (
        <button
            type="button"
            aria-pressed={activo}
            onClick={onClick}
            className={cn(
                'flex h-9 shrink-0 touch-manipulation items-center gap-1.5 rounded-full border px-4 text-[13px] font-semibold transition-colors active:scale-[0.97]',
                activo
                    ? 'border-[#FF7A00] bg-[#FF7A00] text-white shadow-sm'
                    : 'border-border bg-card text-foreground/80 hover:bg-muted',
            )}
        >
            {children}
            {marcado && <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', activo ? 'bg-white' : 'bg-[#FF7A00]')} />}
        </button>
    )
}

function TarjetaProducto({ producto, cantidad, conFotos, resaltado, indice, onSeleccionar }: {
    producto: ProductoPos
    cantidad: number
    conFotos: boolean
    resaltado: boolean
    indice: number
    onSeleccionar: (producto: ProductoPos, anchor: DOMRect) => void
}) {
    const [fotoRota, setFotoRota] = useState(false)
    const precio = parseFloat(producto.precio) || 0
    const opciones = producto.variantes?.length ?? 0
    return (
        <button
            type="button"
            tabIndex={-1}
            data-flat-index={indice}
            aria-label={`${producto.nombre}, ${formatoPesos(precio)}${cantidad > 0 ? `, ${cantidad} en el pedido` : ''}`}
            onClick={(event) => onSeleccionar(producto, event.currentTarget.getBoundingClientRect())}
            className={cn(
                'relative flex min-h-[88px] w-full touch-manipulation select-none flex-col overflow-hidden rounded-2xl border bg-card text-left shadow-sm transition-all',
                'active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7A00]',
                cantidad > 0 ? 'border-[#FF7A00]/70 bg-[#FF7A00]/[0.04]' : 'border-border/70',
                resaltado && 'ring-2 ring-[#FF7A00]',
            )}
        >
            {conFotos && (
                <div className="flex aspect-[2/1] w-full shrink-0 items-center justify-center overflow-hidden bg-[#FF7A00]/10 min-[520px]:aspect-[16/10]">
                    {producto.imagenUrl && !fotoRota ? (
                        <img
                            src={producto.imagenUrl}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            draggable={false}
                            onError={() => setFotoRota(true)}
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <span aria-hidden className="select-none text-3xl font-black text-[#FF7A00]/35">
                            {producto.nombre.trim().charAt(0).toUpperCase()}
                        </span>
                    )}
                </div>
            )}
            <div className="flex flex-1 flex-col justify-between gap-1.5 p-2.5">
                <span className={cn('line-clamp-2 text-[13.5px] font-semibold leading-snug text-foreground', cantidad > 0 && !conFotos && 'pr-6')}>
                    {producto.nombre}
                </span>
                <span className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-bold tabular-nums text-[#FF7A00]">{formatoPesos(precio)}</span>
                    {productoTieneOpciones(producto) && opciones > 0 && (
                        <span className="text-[10px] font-medium text-muted-foreground">{opciones} opciones</span>
                    )}
                </span>
            </div>
            {cantidad > 0 && (
                <span
                    aria-hidden
                    className="absolute right-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#FF7A00] px-1.5 text-xs font-black tabular-nums text-white shadow-md ring-2 ring-card"
                >
                    {cantidad}
                </span>
            )}
        </button>
    )
}

export function PosCatalogoMovil({
    productos, ordenCategorias, consulta, onConsulta, inputRef, categoria, onCategoria, cantidades, onProducto,
    conFotos, cargando = false, slotBuscador = null, buscadorEnBarra = false,
}: PosCatalogoMovilProps) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const chipsRef = useRef<HTMLDivElement>(null)
    const [indice, setIndice] = useState(0)
    const buscando = consulta.trim() !== ''

    const categorias = useMemo(
        () => agruparCatalogo(productos, ordenCategorias).map((grupo) => grupo.categoria),
        [productos, ordenCategorias],
    )
    // Si la categoría elegida desaparece (el catálogo se refrescó), se vuelve a "Todo".
    const categoriaActiva = categoria != null && categorias.includes(categoria) ? categoria : null

    const categoriasConItems = useMemo(() => {
        const marcadas = new Set<string>()
        for (const producto of productos) {
            if ((cantidades.get(producto.id) ?? 0) > 0) marcadas.add(producto.categoria || SIN_CATEGORIA)
        }
        return marcadas
    }, [productos, cantidades])

    const grupos = useMemo(() => {
        const base = buscando
            ? filtrarProductos(productos, consulta)
            : categoriaActiva != null
                ? productos.filter((producto) => (producto.categoria || SIN_CATEGORIA) === categoriaActiva)
                : productos
        return agruparCatalogo(base, ordenCategorias)
    }, [productos, consulta, buscando, categoriaActiva, ordenCategorias])

    const planos = useMemo(() => grupos.flatMap((grupo) => grupo.productos), [grupos])
    const indicePorId = useMemo(() => new Map(planos.map((producto, posicion) => [producto.id, posicion])), [planos])
    const mostrarTitulos = buscando || categoriaActiva == null

    // Al cambiar el resultado (búsqueda o categoría) el resaltado vuelve al primer producto.
    // Se ajusta durante el render, no en un efecto, para no pintar un cuadro con el índice viejo.
    const [planosPrevios, setPlanosPrevios] = useState(planos)
    if (planos !== planosPrevios) {
        setPlanosPrevios(planos)
        setIndice(0)
    }
    useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }) }, [categoriaActiva])

    // El chip elegido se mantiene a la vista aunque la fila de categorías haya hecho scroll.
    useLayoutEffect(() => {
        chipsRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' })
    }, [categoriaActiva, buscando])

    // El resaltado por teclado (tablets con teclado) se mantiene a la vista dentro de su propio scroll.
    useLayoutEffect(() => {
        if (!buscando) return
        const contenedor = scrollRef.current
        const tarjeta = contenedor?.querySelector<HTMLElement>(`[data-flat-index="${indice}"]`)
        if (!contenedor || !tarjeta) return
        const rectContenedor = contenedor.getBoundingClientRect()
        const rectTarjeta = tarjeta.getBoundingClientRect()
        const margen = 8
        if (rectTarjeta.top < rectContenedor.top + margen) contenedor.scrollTop += rectTarjeta.top - rectContenedor.top - margen
        else if (rectTarjeta.bottom > rectContenedor.bottom - margen) contenedor.scrollTop += rectTarjeta.bottom - rectContenedor.bottom + margen
    }, [buscando, indice, planos])

    const columnas = () => {
        const tarjeta = scrollRef.current?.querySelector<HTMLElement>('[data-flat-index]')
        const grilla = tarjeta?.parentElement
        if (!grilla || tarjeta.offsetWidth === 0) return 1
        return Math.max(1, window.getComputedStyle(grilla).gridTemplateColumns.split(' ').filter(Boolean).length)
    }

    const buscador: ReactNode = (
        <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
            <Input
                ref={inputRef}
                value={consulta}
                onChange={(event) => onConsulta(event.target.value)}
                onKeyDown={(event) => {
                    // Las flechas y Enter sirven a quien usa teclado físico (tablet con base o lector).
                    if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
                        if (!buscando || planos.length === 0) return
                        event.preventDefault()
                        const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight'
                        const paso = (event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1) * (horizontal ? 1 : columnas())
                        setIndice((actual) => (actual + paso + planos.length) % planos.length)
                        return
                    }
                    if (event.key === 'Enter' && buscando && planos.length > 0) {
                        event.preventDefault()
                        const producto = planos[Math.min(indice, planos.length - 1)] ?? planos[0]
                        onProducto(producto, event.currentTarget.getBoundingClientRect())
                    }
                }}
                placeholder="Buscar producto o tag..."
                enterKeyHint="search"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="h-11 rounded-2xl border-border/70 bg-card pl-10 pr-10 text-base shadow-sm focus-visible:border-[#FF7A00] focus-visible:ring-[#FF7A00]/30 dark:bg-card"
            />
            {consulta !== '' && (
                <button
                    type="button"
                    aria-label="Borrar búsqueda"
                    onClick={() => { onConsulta(''); inputRef.current?.focus() }}
                    className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                    <X className="h-4 w-4" />
                </button>
            )}
        </div>
    )

    const mostrarChips = !buscando && categorias.length > 1

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {/* En celular el buscador vive en la barra superior (portal): el catálogo gana una fila entera. */}
            {buscadorEnBarra ? (slotBuscador ? createPortal(buscador, slotBuscador) : null) : (
                <div className="shrink-0 px-3 pb-1 pt-3">{buscador}</div>
            )}

            {mostrarChips && (
                <div
                    ref={chipsRef}
                    role="group"
                    aria-label="Categorías"
                    className="flex shrink-0 gap-2 overflow-x-auto px-3 pb-2 pt-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                    <Chip activo={categoriaActiva == null} onClick={() => onCategoria(null)}>Todo</Chip>
                    {categorias.map((nombre) => (
                        <Chip
                            key={nombre}
                            activo={nombre === categoriaActiva}
                            marcado={categoriasConItems.has(nombre)}
                            onClick={() => onCategoria(nombre)}
                        >
                            {nombre}
                        </Chip>
                    ))}
                </div>
            )}

            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {cargando && productos.length === 0 ? (
                    <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm font-medium text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Cargando menú…
                    </div>
                ) : planos.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
                        <Search className="h-8 w-8 opacity-30" />
                        <p className="text-sm font-medium">
                            {productos.length === 0 ? 'Todavía no hay productos disponibles. Cargalos desde Menú.' : 'No se encontraron productos.'}
                        </p>
                        {buscando && (
                            <button
                                type="button"
                                onClick={() => onConsulta('')}
                                className="h-10 rounded-full border border-border bg-card px-5 text-sm font-semibold text-foreground"
                            >
                                Borrar búsqueda
                            </button>
                        )}
                    </div>
                ) : grupos.map(({ categoria: nombreCategoria, productos: lista }) => (
                    <section key={nombreCategoria} aria-label={nombreCategoria} className="mb-5 last:mb-0">
                        {mostrarTitulos && (
                            <h3 className="mb-2 flex items-baseline gap-2 px-0.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                                {nombreCategoria}
                                <span className="font-semibold normal-case tracking-normal text-muted-foreground/60">{lista.length}</span>
                            </h3>
                        )}
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-2.5">
                            {lista.map((producto) => {
                                const posicion = indicePorId.get(producto.id) ?? 0
                                return (
                                    <TarjetaProducto
                                        key={producto.id}
                                        producto={producto}
                                        cantidad={cantidades.get(producto.id) ?? 0}
                                        conFotos={conFotos}
                                        resaltado={buscando && posicion === indice}
                                        indice={posicion}
                                        onSeleccionar={onProducto}
                                    />
                                )
                            })}
                        </div>
                    </section>
                ))}
            </div>
        </div>
    )
}
