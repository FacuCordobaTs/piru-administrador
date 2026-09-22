import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// =============================================================================
// MOTOR DE RECOMPRA · LOS CONTROLES
//
// Los cuatro controles chicos que arman los diálogos del motor. Están separados de `./comun` (que es
// el vocabulario y no tiene JSX) para que ese módulo lo puedan importar también los archivos que no
// son de React sin arrastrar componentes.
// =============================================================================

/** Título de un paso del diálogo: una línea, sin explicaciones al lado. */
export function Campo({ titulo, children, accion }: { titulo: string; children: ReactNode; accion?: ReactNode }) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">{titulo}</span>
                {accion}
            </div>
            {children}
        </div>
    )
}

/** Una opción del diálogo. La explicación larga vive en el `title`, no en el cuerpo. */
export function ChipOpcion({ activo, onClick, title, disabled, children }: {
    activo: boolean
    onClick: () => void
    title?: string
    disabled?: boolean
    children: ReactNode
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            disabled={disabled}
            aria-pressed={activo}
            className={cn(
                "inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                disabled && "cursor-not-allowed opacity-40",
                activo
                    ? "border-foreground bg-foreground text-background"
                    : "border-border/40 bg-background/60 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
        >
            {children}
        </button>
    )
}

/** Marca chica dentro de un chip ("hoy", "le toca"), legible en chip claro y en chip lleno. */
export function Marca({ children }: { children: ReactNode }) {
    return <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wider opacity-60">{children}</span>
}

/**
 * Un contador con −/+ para los valores de configuración (cupo, días, %). El paso y los topes se
 * pasan por props porque cada uno tiene los suyos; el valor que se muestra es siempre el acotado.
 */
export function Stepper({ value, onChange, min, max, paso = 5, sufijo }: {
    value: number
    onChange: (v: number) => void
    min: number
    max: number
    paso?: number
    sufijo?: string
}) {
    const clamp = (v: number) => Math.max(min, Math.min(max, v))
    return (
        <div className="inline-flex items-center rounded-full border border-border/60 bg-background shadow-2xs">
            <button
                type="button"
                className="h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-40"
                disabled={value <= min}
                onClick={() => onChange(clamp(value - paso))}
            >−</button>
            <span className="min-w-7 px-0.5 text-center text-xs font-semibold text-foreground tabular-nums">
                {value}{sufijo}
            </span>
            <button
                type="button"
                className="h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-40"
                disabled={value >= max}
                onClick={() => onChange(clamp(value + paso))}
            >+</button>
        </div>
    )
}
