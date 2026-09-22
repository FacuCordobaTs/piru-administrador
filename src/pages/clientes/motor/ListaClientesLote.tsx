import type { CandidatoLote } from '@/lib/api'
import { Checkbox } from '@/components/ui/checkbox'
import { Lock, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SEG_META, etiquetaDias, formatCurrency } from './comun'

// =============================================================================
// LA LISTA DEL LOTE — quién recibe los mensajes, quién queda de control y quién espera
//
// Es el paso 2 del asistente. La lista NO se reordena ni se filtra acá: llega en el orden de
// prioridad en que el motor la va a recorrer y lo único que hace cada fila es decir en qué tramo
// cayó. Así lo que el dueño ve es literalmente la decisión: los de arriba con tilde son los que
// reciben, los siguientes son el control y el resto espera su turno.
//
// El botón de cada fila es el mismo en los tres tramos (destildar/agregar) porque el backend tiene
// los dos movimientos: sacar a alguien lo manda a `excluirIds` y agregarlo a mano lo manda a
// `incluirIds`, que entra ADEMÁS de la cantidad pedida.
// =============================================================================

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

const ROL_META: Record<RolLote, { label: string; clase: string }> = {
    contactar: { label: 'Recibe', clase: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
    control: { label: 'Control', clase: 'bg-muted text-muted-foreground' },
    espera: { label: 'Espera', clase: 'bg-muted/60 text-muted-foreground/70' },
}

export default function ListaClientesLote({ filas, onAlternar, vacioTexto, vacioSubtexto }: {
    filas: FilaLote[]
    /** Destildar saca al cliente; tildar a uno sin tilde lo agrega a mano. */
    onAlternar: (clienteId: number) => void
    vacioTexto?: string
    vacioSubtexto?: string
}) {
    if (filas.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 py-10 px-4 text-center">
                <User className="mb-2.5 h-7 w-7 text-muted-foreground/30" />
                <p className="text-sm font-medium text-foreground">{vacioTexto ?? 'No hay clientes para mostrar'}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{vacioSubtexto ?? 'Probá con otro segmento.'}</p>
            </div>
        )
    }

    return (
        <div className="divide-y divide-border/30 overflow-hidden rounded-xl border border-border/40 bg-background/60">
            {filas.map(({ cliente, rol, incluido, manual, origen }) => {
                const meta = SEG_META[cliente.segmento]
                const bloqueado = !cliente.elegible
                const rolMeta = ROL_META[rol]
                return (
                    <label
                        key={`${origen ?? 'lote'}-${cliente.clienteId}`}
                        title={bloqueado ? 'Ya está comprometido en otra tanda viva: no se puede programar de nuevo sin mandarle el mismo toque dos veces.' : undefined}
                        className={cn(
                            "flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors",
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
                                <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                                    <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                                    {meta.label}
                                </span>
                                {bloqueado && <Lock className="h-3 w-3 shrink-0 text-muted-foreground/60" />}
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground/80">
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

                        <div className="hidden shrink-0 text-right sm:block">
                            <div className="text-[11px] font-medium text-foreground">{cliente.horarioSugerido}</div>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">sale</div>
                        </div>

                        <span className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                            rolMeta.clase,
                        )}>
                            {manual ? 'A mano' : rolMeta.label}
                        </span>
                    </label>
                )
            })}
        </div>
    )
}
