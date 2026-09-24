import type { CandidatoLote } from '@/lib/api'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { Lock, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SEG_META, etiquetaDias, formatCurrency } from './comun'

// =============================================================================
// LA LISTA DEL LOTE — quién recibe los mensajes, quién queda de control y quién espera
//
// Es el paso de la lista. La lista NO se reordena ni se filtra acá: llega en el orden de prioridad en
// que el motor la va a recorrer y lo único que hace cada fila es decir en qué tramo cayó. Así lo que
// el dueño ve es literalmente la decisión: los de arriba con tilde son los que reciben, los
// siguientes son el control y el resto espera su turno.
//
// El botón de cada fila es el mismo en los tres tramos (destildar/agregar) porque el backend tiene
// los dos movimientos: sacar a alguien lo manda a `excluirIds` y agregarlo a mano lo manda a
// `incluirIds`, que entra ADEMÁS de la cantidad pedida.
//
// Con `alto` la caja mide siempre lo mismo y scrollea por dentro. Es lo que necesita el flujo por
// pasos, donde la lista convive con el resto del paso en una pantalla que ya scrollea: si la caja
// creciera con la cantidad de elegidos, el pie con el botón de confirmar quedaría a un scroll de
// distancia. El vacío usa el mismo alto para que la pantalla no salte al cambiar de segmento.
// =============================================================================

/** El alto de la caja de la lista en el flujo por pasos (~6 filas en escritorio, ~5 en celular). */
export const ALTO_LISTA = 'h-[22rem]'

export type RolLote = 'contactar' | 'control' | 'espera'

export interface FilaLote {
    cliente: CandidatoLote
    rol: RolLote
    /** Tilde puesta: recibe el mensaje. */
    incluido: boolean
    /** Lo agregó el dueño a mano: va aparte de la cantidad automática, no la descuenta. */
    manual?: boolean
    /** Desde dónde salió la fila: la búsqueda de un cliente puntual, o el lote del segmento. */
    origen?: 'lote' | 'busqueda'
}

// El tramo que recibe no lleva etiqueta: la tilde ya lo dice y la palabra competía con el nombre del
// cliente. El control y la espera sí, porque no hay tilde que los distinga.
const ROL_META: Record<RolLote, { label: string | null; clase: string }> = {
    contactar: { label: null, clase: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
    control: { label: 'Control', clase: 'bg-muted text-muted-foreground' },
    espera: { label: 'Espera', clase: 'bg-muted/60 text-muted-foreground/70' },
}

export default function ListaClientesLote({ filas, onAlternar, vacioTexto, vacioSubtexto, alto }: {
    filas: FilaLote[]
    /** Destildar saca al cliente; tildar a uno sin tilde lo agrega a mano. */
    onAlternar: (clienteId: number) => void
    vacioTexto?: string
    vacioSubtexto?: string
    /** Clase de alto fijo (`ALTO_LISTA`). Sin esto la caja crece con el contenido. */
    alto?: string
}) {
    if (filas.length === 0) {
        return (
            <div
                data-lista-lote
                className={cn(
                    "flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 px-4 text-center",
                    alto ?? 'py-10',
                )}
            >
                <User className="mb-2.5 h-7 w-7 text-muted-foreground/30" />
                <p className="text-sm font-medium text-foreground">{vacioTexto ?? 'No hay clientes para mostrar'}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{vacioSubtexto ?? 'Probá con otro segmento.'}</p>
            </div>
        )
    }

    return (
        <div
            data-lista-lote
            className={cn("overflow-hidden rounded-xl border border-border/40 bg-background/60", alto)}
        >
            {/* `data-scroll-lote` es el scroller que se mide en los tests: la caja de afuera mide fijo. */}
            <ScrollArea data-scroll-lote className={cn("divide-y divide-border/30", alto && "h-full")}>
                {filas.map(({ cliente, rol, incluido, manual, origen }) => {
                    const meta = SEG_META[cliente.segmento]
                    const bloqueado = !cliente.elegible
                    const rolMeta = ROL_META[rol]
                    const etiquetaRol = manual ? 'A mano' : rolMeta.label
                    return (
                        <label
                            key={`${origen ?? 'lote'}-${cliente.clienteId}`}
                            title={bloqueado ? 'Ya está comprometido en otra tanda viva: no se puede programar de nuevo sin mandarle el mismo toque dos veces.' : undefined}
                            className={cn(
                                "flex cursor-pointer items-center gap-3 px-3.5 py-3 transition-colors",
                                bloqueado ? "cursor-not-allowed opacity-50" : "hover:bg-muted/40",
                            )}
                        >
                            <Checkbox
                                checked={incluido}
                                disabled={bloqueado}
                                onChange={() => { if (!bloqueado) onAlternar(cliente.clienteId) }}
                            />

                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="truncate text-sm font-medium text-foreground">{cliente.nombre}</span>
                                    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                                        <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
                                        {meta.label}
                                    </span>
                                    {bloqueado && <Lock className="h-3 w-3 shrink-0 text-muted-foreground/60" />}
                                </div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground/80">
                                    <span>{etiquetaDias(cliente.diasDesdeUltimo)}</span>
                                    <span>·</span>
                                    <span>{formatCurrency(cliente.totalGastado)} histórico</span>
                                    {cliente.toquesDesdeUltimoPedido > 0 && (
                                        <>
                                            <span>·</span>
                                            <span>{cliente.toquesDesdeUltimoPedido} toque{cliente.toquesDesdeUltimoPedido === 1 ? '' : 's'} ya enviados</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {etiquetaRol && (
                                <span className={cn(
                                    "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider",
                                    rolMeta.clase,
                                )}>
                                    {etiquetaRol}
                                </span>
                            )}
                        </label>
                    )
                })}
            </ScrollArea>
        </div>
    )
}
