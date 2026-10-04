import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatoPesos, type OpcionBebida, type ProductoPos, type SeleccionProductoPos, type VariantePos } from './posMovilLib'

interface PosSelectorProductoProps {
    producto: ProductoPos
    /** Bebidas activas del local, para sumar una junto al producto. Vacío si no hay ninguna. */
    bebidas: OpcionBebida[]
    onCerrar: () => void
    onAgregar: (seleccion: SeleccionProductoPos) => void
}

const aNumero = (precio: string) => parseFloat(precio) || 0

const FILA = 'flex min-h-[52px] w-full touch-manipulation items-center justify-between gap-3 rounded-xl border px-3.5 py-2 text-left text-[15px] leading-snug transition-all active:scale-[0.98]'

function Columna({ titulo, nota, fija = false, children }: { titulo: string; nota?: string; fija?: boolean; children: ReactNode }) {
    return (
        // La columna que agrega queda fija arriba mientras se recorre una lista larga de extras o bebidas.
        <section aria-label={titulo} className={cn('min-w-0', fija && 'sticky top-0')}>
            <h3 className="mb-2 flex min-w-0 items-baseline gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                <span className="shrink-0">{titulo}</span>
                {nota && <span className="truncate text-[11px] font-semibold normal-case tracking-normal text-muted-foreground/70">{nota}</span>}
            </h3>
            <div className="space-y-1.5">{children}</div>
        </section>
    )
}

/** Marca de selección: cuadrada para lo que se suma (extras), redonda para lo que se elige uno (bebida). */
function Marca({ activa, redonda = false, color }: { activa: boolean; redonda?: boolean; color: 'verde' | 'naranja' }) {
    return (
        <span
            aria-hidden
            className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center border transition-colors',
                redonda ? 'rounded-full' : 'rounded-md',
                !activa && 'border-muted-foreground/40',
                activa && color === 'verde' && 'border-emerald-500 bg-emerald-500 text-white',
                activa && color === 'naranja' && 'border-[#FF7A00] bg-[#FF7A00] text-white',
            )}
        >
            {activa && <Check className="h-3.5 w-3.5" />}
        </span>
    )
}

/**
 * Alta de un producto con variantes en tablet: junto a la variante se ofrecen sus extras y una bebida.
 * Sin botón de confirmar: los extras y la bebida se marcan antes y tocar la variante agrega todo junto
 * (el producto con sus extras y la bebida como otra fila). Por eso la variante va en la última columna:
 * de izquierda a derecha se lee lo opcional y se termina en lo que agrega. Si el producto lleva además
 * segunda variante hay dos elecciones obligatorias y, como en el selector común, cierra "Agregar".
 */
export function PosSelectorProducto({ producto, bebidas, onCerrar, onAgregar }: PosSelectorProductoProps) {
    const dialogo = useRef<HTMLDivElement>(null)
    const variantes = producto.variantes ?? []
    const secundarias = producto.variantesSecundarias ?? []
    const extras = producto.agregados ?? []
    // Una bebida no se acompaña con otra bebida.
    const opcionesBebida = producto.categoriaEsBebida ? [] : bebidas
    const agregaAlTocar = variantes.length > 0 && secundarias.length === 0
    // Con un toque la variante se agrega sola: no se resalta ninguna de entrada (sólo el teclado la marca).
    const [varianteId, setVarianteId] = useState<number | null>(agregaAlTocar ? null : (variantes[0]?.id ?? null))
    const [secundariaId, setSecundariaId] = useState<number | null>(secundarias[0]?.id ?? null)
    const [extrasIds, setExtrasIds] = useState<number[]>([])
    const [bebidaClave, setBebidaClave] = useState<string | null>(null)

    useEffect(() => { dialogo.current?.focus({ preventScroll: true }) }, [])

    const agregados = extras.filter((extra) => extrasIds.includes(extra.id))
    const bebida = opcionesBebida.find((opcion) => opcion.clave === bebidaClave)
    const conOpcionales = extras.length > 0 || opcionesBebida.length > 0
    const columnas = [extras.length > 0, opcionesBebida.length > 0, variantes.length > 0, secundarias.length > 0].filter(Boolean).length
    const acompanamientos = [
        ...agregados.map((extra) => extra.nombre),
        ...(bebida ? [[bebida.producto.nombre, bebida.detalle].filter(Boolean).join(' ')] : []),
    ]
    const adicional = agregados.reduce((suma, extra) => suma + aNumero(extra.precio), 0) + (bebida?.precio ?? 0)
    const ayuda = !agregaAlTocar
        ? 'Elegí las opciones y tocá Agregar.'
        : extras.length > 0 && opcionesBebida.length > 0
            ? 'Marcá extras o bebida si hacen falta y tocá la variante: se agrega todo junto.'
            : extras.length > 0
                ? 'Marcá los extras que lleve y tocá la variante: se agrega todo junto.'
                : 'Marcá una bebida si la pide y tocá la variante: se agrega todo junto.'

    const agregar = (variante: VariantePos | undefined) => onAgregar({
        variante,
        varianteSecundaria: secundarias.find((opcion) => opcion.id === secundariaId),
        agregados,
        bebida,
    })

    const alternarExtra = (id: number) =>
        setExtrasIds((actuales) => actuales.includes(id) ? actuales.filter((actual) => actual !== id) : [...actuales, id])

    // Tablet con teclado: las flechas recorren las variantes, Enter agrega y Escape cierra. Un control
    // con foco conserva sus propias teclas (Enter sobre un extra lo marca, no agrega).
    const alTeclear = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Escape') {
            event.preventDefault()
            onCerrar()
            return
        }
        if ((event.target as HTMLElement).closest('button')) return
        if (variantes.length > 0 && ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
            event.preventDefault()
            const paso = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1
            const actual = variantes.findIndex((variante) => variante.id === varianteId)
            const siguiente = actual < 0 ? (paso > 0 ? 0 : variantes.length - 1) : (actual + paso + variantes.length) % variantes.length
            setVarianteId(variantes[siguiente].id)
            return
        }
        if (event.key === 'Enter') {
            event.preventDefault()
            agregar(variantes.find((variante) => variante.id === varianteId) ?? variantes[0])
        }
    }

    return (
        <div className="fixed inset-0 z-[1002] flex animate-in items-center justify-center bg-black/45 p-4 duration-150 fade-in" onClick={onCerrar}>
            <div
                ref={dialogo}
                role="dialog"
                aria-modal="true"
                aria-label={`Configurar ${producto.nombre}`}
                tabIndex={-1}
                onKeyDown={alTeclear}
                onClick={(event) => event.stopPropagation()}
                className={cn(
                    'flex max-h-[min(680px,calc(100dvh-32px))] w-full animate-in flex-col overflow-hidden rounded-3xl border bg-card shadow-2xl outline-none duration-200 fade-in zoom-in-95',
                    columnas >= 3 ? 'max-w-[min(1040px,100%)]' : columnas === 2 ? 'max-w-2xl' : 'max-w-md',
                )}
            >
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-2.5">
                    <span className="min-w-0 truncate text-base font-bold">{producto.nombre}</span>
                    <button
                        type="button"
                        aria-label="Cerrar"
                        onClick={onCerrar}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
                    <div className="grid items-start gap-4" style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}>
                        {extras.length > 0 && (
                            <Columna titulo="Extras" nota="opcional">
                                {extras.map((extra) => {
                                    const marcado = extrasIds.includes(extra.id)
                                    return (
                                        <button
                                            key={extra.id}
                                            type="button"
                                            aria-pressed={marcado}
                                            onClick={() => alternarExtra(extra.id)}
                                            className={cn(FILA, marcado
                                                ? 'border-emerald-500 bg-emerald-500/10 font-semibold text-emerald-700 dark:text-emerald-400'
                                                : 'border-border hover:bg-accent')}
                                        >
                                            <span className="flex min-w-0 items-center gap-2.5">
                                                <Marca activa={marcado} color="verde" />
                                                <span className="line-clamp-2">{extra.nombre}</span>
                                            </span>
                                            <span className="shrink-0 font-bold tabular-nums">+{formatoPesos(aNumero(extra.precio))}</span>
                                        </button>
                                    )
                                })}
                            </Columna>
                        )}

                        {opcionesBebida.length > 0 && (
                            <Columna titulo="Bebida" nota="opcional">
                                {opcionesBebida.map((opcion) => {
                                    const elegida = opcion.clave === bebidaClave
                                    return (
                                        <button
                                            key={opcion.clave}
                                            type="button"
                                            aria-pressed={elegida}
                                            onClick={() => setBebidaClave(elegida ? null : opcion.clave)}
                                            className={cn(FILA, elegida
                                                ? 'border-[#FF7A00] bg-[#FF7A00]/10 font-semibold text-foreground'
                                                : 'border-border hover:bg-accent')}
                                        >
                                            <span className="flex min-w-0 items-center gap-2.5">
                                                <Marca activa={elegida} redonda color="naranja" />
                                                <span className="min-w-0">
                                                    <span className="line-clamp-2">{opcion.producto.nombre}</span>
                                                    {opcion.detalle && <span className="block truncate text-xs font-medium text-muted-foreground">{opcion.detalle}</span>}
                                                </span>
                                            </span>
                                            <span className="shrink-0 font-bold tabular-nums">{formatoPesos(opcion.precio)}</span>
                                        </button>
                                    )
                                })}
                            </Columna>
                        )}

                        {variantes.length > 0 && (
                            <Columna titulo="Variante" nota={agregaAlTocar && conOpcionales ? 'tocá para agregar' : undefined} fija>
                                {variantes.map((variante) => {
                                    const marcada = variante.id === varianteId
                                    return agregaAlTocar ? (
                                        <button
                                            key={variante.id}
                                            type="button"
                                            onClick={() => agregar(variante)}
                                            className={cn(FILA, 'font-semibold text-foreground', marcada
                                                ? 'border-[#FF7A00] bg-[#FF7A00]/15 ring-2 ring-[#FF7A00]/40'
                                                : 'border-[#FF7A00]/40 bg-[#FF7A00]/[0.07] hover:bg-[#FF7A00]/15')}
                                        >
                                            <span className="line-clamp-2 min-w-0">{variante.nombre}</span>
                                            <span className="flex shrink-0 items-center gap-2.5">
                                                <span className="font-bold tabular-nums">{formatoPesos(aNumero(variante.precio))}</span>
                                                <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FF7A00] text-white shadow-sm">
                                                    <Plus className="h-4 w-4" />
                                                </span>
                                            </span>
                                        </button>
                                    ) : (
                                        <button
                                            key={variante.id}
                                            type="button"
                                            aria-pressed={marcada}
                                            onClick={() => setVarianteId(variante.id)}
                                            className={cn(FILA, marcada
                                                ? 'border-[#FF7A00] bg-[#FF7A00]/10 font-semibold text-[#FF7A00]'
                                                : 'border-border hover:bg-accent')}
                                        >
                                            <span className="line-clamp-2 min-w-0">{variante.nombre}</span>
                                            <span className="shrink-0 font-bold tabular-nums">{formatoPesos(aNumero(variante.precio))}</span>
                                        </button>
                                    )
                                })}
                            </Columna>
                        )}

                        {secundarias.length > 0 && (
                            <Columna titulo="Segunda variante" fija>
                                {secundarias.map((opcion) => {
                                    const marcada = opcion.id === secundariaId
                                    const recargo = aNumero(opcion.precio)
                                    return (
                                        <button
                                            key={opcion.id}
                                            type="button"
                                            aria-pressed={marcada}
                                            onClick={() => setSecundariaId(opcion.id)}
                                            className={cn(FILA, marcada
                                                ? 'border-[#FF7A00] bg-[#FF7A00]/10 font-semibold text-[#FF7A00]'
                                                : 'border-border hover:bg-accent')}
                                        >
                                            <span className="line-clamp-2 min-w-0">{opcion.nombre}</span>
                                            <span className="shrink-0 font-bold tabular-nums">{recargo > 0 ? `+${formatoPesos(recargo)}` : 'Sin adicional'}</span>
                                        </button>
                                    )
                                })}
                            </Columna>
                        )}
                    </div>
                </div>

                {/* Siempre presente cuando hay opcionales: que aparezca al marcar algo movería el diálogo
                    (está centrado) justo antes de tocar la variante. */}
                {(conOpcionales || !agregaAlTocar) && (
                    <div className="flex min-h-16 shrink-0 items-center gap-3 border-t border-border bg-muted/30 px-5 py-2.5">
                        <p aria-live="polite" className="min-w-0 flex-1 text-sm leading-snug">
                            {acompanamientos.length > 0 ? (
                                <>
                                    <span className="text-muted-foreground">Se agrega con </span>
                                    <span className="font-semibold text-foreground">{acompanamientos.join(', ')}</span>
                                    <span className="ml-1.5 whitespace-nowrap font-bold tabular-nums text-[#FF7A00]">+{formatoPesos(adicional)}</span>
                                </>
                            ) : (
                                <span className="text-muted-foreground">{ayuda}</span>
                            )}
                        </p>
                        {!agregaAlTocar && (
                            <Button
                                type="button"
                                onClick={() => agregar(variantes.find((variante) => variante.id === varianteId))}
                                className="h-12 shrink-0 touch-manipulation rounded-xl bg-[#FF7A00] px-8 text-base font-bold text-white hover:bg-[#E66E00]"
                            >
                                Agregar
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
