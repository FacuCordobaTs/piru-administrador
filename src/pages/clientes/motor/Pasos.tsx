import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PASOS } from './comun'

// =============================================================================
// EL FLUJO DE ENVÍO · EL RIEL Y EL PIE
//
// El flujo muestra de a un valor por pantalla, así que necesita dos cosas que no son de ningún paso en
// particular: dónde está parado (el riel) y cómo se mueve (el pie). Viven acá para que el flujo se lea
// como ocho pasos y no como ocho bloques de layout repetido. Los pasos en sí —id y título— están en
// `./comun`, que es datos y no componentes.
//
// El riel es el mismo del avance de una tanda (`PanelProgramaciones`): segmentos `bg-muted` que se
// llenan con `bg-foreground/70`. El naranja del onboarding es para otra cosa.
//
// El pie es `sticky`: los pasos que scrollean (la lista, el resumen) dejan el botón de confirmar a la
// vista. Donde no hay nada que cancelar —la pantalla sin tandas, que ES el flujo— el pie se achica
// solo: sin `onCancelar` no hay "Cancelar", y en el paso 1 tampoco hay "Atrás".
// =============================================================================

/**
 * El título del paso ("Días entre toques") y el riel de segmentos debajo. Sin el "Paso 3 de 8": el
 * riel ya dice dónde se está y cuánto falta, y el contador competía con el nombre del paso.
 */
export function IndicadorPasos({ actual }: { actual: number }) {
    const paso = PASOS[actual]
    return (
        <div className="space-y-2">
            <h3 className="text-base font-semibold tracking-tight text-foreground">
                {paso.titulo}
            </h3>
            <div
                role="progressbar"
                aria-label="Progreso del asistente"
                aria-valuemin={1}
                aria-valuemax={PASOS.length}
                aria-valuenow={actual + 1}
                aria-valuetext={paso.titulo}
                className="flex gap-1"
            >
                {PASOS.map((p, i) => (
                    <span
                        key={p.id}
                        className={cn(
                            "h-1 flex-1 rounded-full transition-colors",
                            i <= actual ? "bg-foreground/70" : "bg-muted",
                        )}
                    />
                ))}
            </div>
        </div>
    )
}

/**
 * El pie del flujo.
 *
 * Los márgenes negativos son para que la barra cruce de lado a lado la tarjeta del flujo, que tiene
 * `p-5`: el `-mb-5` la pega al borde de abajo y el `rounded-b-2xl` sigue la esquina. Por eso la
 * tarjeta NO puede llevar `overflow-hidden` —el `overflow` crea un scrollport propio y el `sticky`
 * dejaría de seguir a la pantalla que scrollea—.
 */
export function PiePasos({ actual, etiquetaFinal, iconoFinal, onAtras, onCancelar, onAvanzar, deshabilitado, ocupado }: {
    actual: number
    /** El copy del último paso: "Programar 6 mensajes". */
    etiquetaFinal: string
    iconoFinal: ReactNode
    onAtras: () => void
    /** Sin esto el pie no ofrece salida: la pantalla ES el flujo y no hay a dónde volver. */
    onCancelar?: () => void
    onAvanzar: () => void
    /** El paso no tiene con qué seguir: la lista sin nadie seleccionado, por ejemplo. */
    deshabilitado?: boolean
    /** El pedido está en vuelo. */
    ocupado?: boolean
}) {
    const esUltimo = actual === PASOS.length - 1
    return (
        <div className="sticky bottom-0 z-10 -mx-5 -mb-5 mt-1 flex flex-wrap items-center gap-2 rounded-b-2xl border-t border-border/40 bg-background px-5 py-3">
            {onCancelar && (
                <Button
                    variant="ghost"
                    onClick={onCancelar}
                    disabled={ocupado}
                    className="h-9 rounded-full px-3 text-xs text-muted-foreground hover:text-foreground"
                >
                    Cancelar
                </Button>
            )}
            {actual > 0 && (
                <Button variant="ghost" onClick={onAtras} disabled={ocupado} className="h-9 gap-1.5 rounded-full px-3 text-xs">
                    <ArrowLeft className="h-3.5 w-3.5" /> Atrás
                </Button>
            )}
            <Button
                onClick={onAvanzar}
                disabled={deshabilitado || ocupado}
                className="ml-auto h-9 gap-2 rounded-full px-5 text-sm font-medium shadow-2xs"
            >
                {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : esUltimo ? iconoFinal : null}
                {esUltimo ? etiquetaFinal : 'Siguiente'}
                {!esUltimo && <ArrowRight className="h-3.5 w-3.5" />}
            </Button>
        </div>
    )
}
