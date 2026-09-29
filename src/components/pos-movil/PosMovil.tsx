import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Armchair, ChevronLeft, Loader2, MoreVertical, Pencil, Settings, ShoppingCart, Trash2, WifiOff, X } from 'lucide-react'
import {
    DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { PosCatalogoMovil } from './PosCatalogoMovil'
import { PosPedidoPanel } from './PosPedidoPanel'
import { formatoPesos, guardarVerFotos, leerVerFotos, useLayoutPosMovil, type PosMovilProps } from './posMovilLib'

/** Hoja que sube desde abajo (celular). Sin Radix a propósito: el autocompletado de
 *  direcciones de Google pinta su lista fuera de la hoja y un diálogo modal la bloquearía. */
function HojaInferior({ etiqueta, onCerrar, bloqueada, children }: {
    etiqueta: string
    onCerrar: () => void
    bloqueada: boolean
    children: ReactNode
}) {
    const hoja = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const anterior = document.activeElement as HTMLElement | null
        hoja.current?.focus({ preventScroll: true })
        return () => anterior?.focus?.({ preventScroll: true })
    }, [])

    useEffect(() => {
        if (bloqueada) return
        const alTeclear = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented) onCerrar() }
        window.addEventListener('keydown', alTeclear)
        return () => window.removeEventListener('keydown', alTeclear)
    }, [bloqueada, onCerrar])

    return (
        <div className="absolute inset-0 z-30">
            <div aria-hidden onClick={onCerrar} className="absolute inset-0 animate-in bg-black/45 duration-200 fade-in" />
            <div
                ref={hoja}
                role="dialog"
                aria-modal="true"
                aria-label={etiqueta}
                tabIndex={-1}
                className="absolute inset-x-0 bottom-0 top-6 flex animate-in flex-col overflow-hidden rounded-t-3xl bg-background shadow-2xl outline-none duration-300 ease-out slide-in-from-bottom"
            >
                <div aria-hidden className="mx-auto mb-1 mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/25" />
                {children}
            </div>
        </div>
    )
}

// En un celular apaisado sobra ancho y falta alto: las barras se compactan.
const BAJO = '[@media(max-height:480px)]'

function BarraPedido({ unidades, total, onAbrir }: { unidades: number; total: number; onAbrir: () => void }) {
    const conItems = unidades > 0
    return (
        <div className={cn('shrink-0 border-t border-border/50 bg-background/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur', `${BAJO}:pb-2 ${BAJO}:pt-1.5`)}>
            <button
                type="button"
                aria-haspopup="dialog"
                onClick={onAbrir}
                className={cn(
                    'flex h-14 w-full touch-manipulation items-center justify-between gap-3 rounded-2xl px-4 text-white shadow-lg transition-all active:scale-[0.99]',
                    `${BAJO}:h-11`,
                    conItems ? 'bg-[#FF7A00] shadow-[#FF7A00]/25' : 'bg-foreground/75 shadow-black/10',
                )}
            >
                <span className="flex items-center gap-3">
                    <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                        <ShoppingCart className="h-[18px] w-[18px]" />
                        {conItems && (
                            <span aria-hidden className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] font-black tabular-nums text-[#FF7A00] shadow">
                                {unidades}
                            </span>
                        )}
                    </span>
                    <span className="text-[15px] font-bold">{conItems ? `Ver pedido (${unidades})` : 'Pedido vacío'}</span>
                </span>
                <span className="text-lg font-black tabular-nums">{formatoPesos(total)}</span>
            </button>
        </div>
    )
}

export function PosMovil({
    titulo, subtitulo, contexto, volver, estado, panelPendientes, onCerrarPendientes, menu, catalogo, items, datos, acciones,
    hojaAbierta, onHoja, bloqueado,
}: PosMovilProps) {
    const raiz = useRef<HTMLDivElement>(null)
    const layout = useLayoutPosMovil(raiz)
    const tablet = layout === 'tablet'
    const unidades = items.reduce((suma, item) => suma + item.cantidad, 0)
    const cerrarHoja = () => onHoja(false)
    // En celular el buscador se dibuja dentro de la barra superior (portal desde el catálogo).
    const [slotBuscador, setSlotBuscador] = useState<HTMLElement | null>(null)
    const [verFotos, setVerFotos] = useState(leerVerFotos)
    const hayFotos = useMemo(() => catalogo.productos.some((producto) => !!producto.imagenUrl), [catalogo.productos])

    // Al pasar a dos paneles (rotar la tablet, cerrar el menú lateral) la hoja ya no tiene sentido.
    useEffect(() => { if (tablet && hojaAbierta) onHoja(false) }, [tablet, hojaAbierta, onHoja])

    const hayEstado = !estado.online || estado.pendientes > 0

    return (
        <div ref={raiz} className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background [-webkit-tap-highlight-color:transparent]">
            <header className={cn('flex h-14 shrink-0 items-center gap-1.5 border-b border-border/60 bg-background px-2.5 box-content pt-[env(safe-area-inset-top)]', `${BAJO}:h-12`)}>
                {volver && (
                    <button
                        type="button"
                        onClick={volver.onClick}
                        className="flex h-10 shrink-0 touch-manipulation items-center gap-1 rounded-xl pl-1 pr-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted active:bg-muted"
                    >
                        <ChevronLeft className="h-5 w-5" />
                        {volver.etiqueta}
                        {volver.contador != null && volver.contador > 0 && (
                            <span className="ml-0.5 min-w-5 rounded-full bg-[#FF7A00] px-1.5 text-center text-[11px] font-bold leading-5 text-white">{volver.contador}</span>
                        )}
                    </button>
                )}
                {tablet ? (
                    <div className={cn('min-w-0 flex-1', !volver && 'pl-2')}>
                        <h1 className="truncate text-base font-black leading-tight tracking-tight text-foreground">{titulo}</h1>
                        {subtitulo && <p className="truncate text-[11px] leading-tight text-muted-foreground">{subtitulo}</p>}
                    </div>
                ) : (
                    <>
                        <h1 className="sr-only">{titulo}</h1>
                        <div ref={setSlotBuscador} className="min-w-0 flex-1" />
                    </>
                )}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            aria-label="Más opciones del punto de venta"
                            className="flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[state=open]:bg-muted"
                        >
                            <MoreVertical className="h-5 w-5" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-60 rounded-2xl p-1.5">
                        {menu.extras.map(({ id, label, icon: Icono, onSelect }) => (
                            <DropdownMenuItem key={id} onSelect={onSelect} className="h-11 gap-3 rounded-xl text-sm font-medium">
                                <Icono className="h-4 w-4" /> {label}
                            </DropdownMenuItem>
                        ))}
                        {menu.extras.length > 0 && <DropdownMenuSeparator />}
                        {hayFotos && (
                            <DropdownMenuCheckboxItem
                                checked={verFotos}
                                onCheckedChange={(ver) => { setVerFotos(ver); guardarVerFotos(ver) }}
                                className="h-11 rounded-xl text-sm font-medium"
                            >
                                Mostrar fotos
                            </DropdownMenuCheckboxItem>
                        )}
                        <DropdownMenuItem onSelect={menu.onConfigurar} className="h-11 gap-3 rounded-xl text-sm font-medium">
                            <Settings className="h-4 w-4" /> Configurar punto de venta
                        </DropdownMenuItem>
                        {menu.onLimpiar && (
                            <DropdownMenuItem onSelect={menu.onLimpiar} variant="destructive" className="h-11 gap-3 rounded-xl text-sm font-medium">
                                <Trash2 className="h-4 w-4" /> Limpiar pedido
                            </DropdownMenuItem>
                        )}
                        {menu.onCancelarEdicion && (
                            <DropdownMenuItem onSelect={menu.onCancelarEdicion} className="h-11 gap-3 rounded-xl text-sm font-medium">
                                <X className="h-4 w-4" /> Cancelar edición
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </header>

            {/* En celular el título no cabe en la barra (ahí va el buscador): mesa y edición se avisan aparte. */}
            {!tablet && contexto !== 'nuevo' && (
                <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border/60 bg-[#FF7A00]/10 px-4 text-[13px] font-bold text-foreground">
                    {contexto === 'mesa' ? <Armchair className="h-4 w-4 text-[#FF7A00]" /> : <Pencil className="h-4 w-4 text-[#FF7A00]" />}
                    <span className="truncate">{titulo}</span>
                </div>
            )}

            {/* Sin conexión el POS sigue anotando en la cola local. */}
            {hayEstado && (
                <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-border/60 bg-muted/30 px-3 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {!estado.online && (
                        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-600">
                            <WifiOff className="h-3.5 w-3.5" /> Sin conexión
                        </span>
                    )}
                    {estado.pendientes > 0 && (
                        <button
                            type="button"
                            onClick={estado.onPendientes}
                            title="Pedidos guardados sin conexión"
                            className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#FF7A00]/30 bg-[#FF7A00]/10 px-2.5 py-1 text-[11px] font-bold text-[#FF7A00] transition-colors hover:bg-[#FF7A00]/20"
                        >
                            {estado.sincronizando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <WifiOff className="h-3.5 w-3.5" />}
                            {estado.pendientes} pendiente{estado.pendientes === 1 ? '' : 's'}
                        </button>
                    )}
                </div>
            )}

            <div className="flex min-h-0 flex-1">
                <PosCatalogoMovil
                    {...catalogo}
                    conFotos={hayFotos && verFotos}
                    buscadorEnBarra={!tablet}
                    slotBuscador={slotBuscador}
                />
                {tablet && (
                    <aside className="w-[clamp(320px,40%,400px)] shrink-0 border-l border-border/70">
                        <PosPedidoPanel variante="lateral" items={items} datos={datos} acciones={acciones} />
                    </aside>
                )}
            </div>

            {!tablet && <BarraPedido unidades={unidades} total={datos.total} onAbrir={() => onHoja(true)} />}

            {!tablet && hojaAbierta && (
                <HojaInferior etiqueta="Pedido" onCerrar={cerrarHoja} bloqueada={bloqueado}>
                    <PosPedidoPanel variante="hoja" items={items} datos={datos} acciones={acciones} onCerrar={cerrarHoja} />
                </HojaInferior>
            )}

            {panelPendientes && (
                <>
                    <div aria-hidden onClick={onCerrarPendientes} className="absolute inset-0 z-40" />
                    <div className="absolute inset-x-3 top-14 z-40 flex justify-end">{panelPendientes}</div>
                </>
            )}
        </div>
    )
}
