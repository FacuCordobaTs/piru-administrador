import type { ReactNode } from 'react'
import type { ModoRecompra } from '@/lib/api'
import { Bot, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

// =============================================================================
// MOTOR DE RECOMPRA · LOS CONTROLES
//
// Los controles chicos que arman los diálogos y los pasos del motor: las dos tarjetas de modo, el
// título de un campo, una opción, una marca y un contador. Están separados de `./comun` (que es el
// vocabulario y no tiene JSX) para que ese módulo lo puedan importar también los archivos que no son
// de React sin arrastrar componentes.
// =============================================================================

/** Las dos modalidades, con lo que implica cada una. El orden es el del diálogo y el del paso 1. */
const MODOS: { valor: ModoRecompra; titulo: string; icono: typeof Bot; texto: string }[] = [
    {
        valor: 'automatico',
        titulo: 'Automático',
        icono: Bot,
        texto: 'El motor manda los mensajes agendados solo, de a poco. Cada uno usa un crédito.',
    },
    {
        valor: 'manual',
        titulo: 'Manual',
        icono: MessageSquare,
        texto: 'El motor prepara los mensajes en la cola y los enviás vos, sin gastar créditos.',
    },
]

/** Las dos tarjetas grandes de modo: la misma decisión en la config del motor y en el paso 1. */
export function CampoModo({ valor, onChange }: { valor: ModoRecompra; onChange: (v: ModoRecompra) => void }) {
    return (
        <div className="grid gap-3 sm:grid-cols-2">
            {MODOS.map(({ valor: v, titulo, icono: Icono, texto }) => (
                <button
                    key={v}
                    type="button"
                    onClick={() => onChange(v)}
                    aria-pressed={valor === v}
                    className={cn(
                        "rounded-xl border p-3.5 text-left transition-all",
                        valor === v
                            ? "border-foreground bg-foreground/5 ring-1 ring-foreground"
                            : "border-border/60 bg-muted/20 hover:border-border",
                    )}
                >
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Icono className="h-4 w-4" /> {titulo}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{texto}</p>
                </button>
            ))}
        </div>
    )
}

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
                "inline-flex min-w-0 items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
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
    return <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider opacity-60">{children}</span>
}

/**
 * Un contador con −/+ para los valores de configuración (cupo, días, %). El paso y los topes se
 * pasan por props porque cada uno tiene los suyos; el valor que se muestra es siempre el acotado.
 *
 * Es el control grande de los pasos: el número es el dato del paso y se lee de lejos. `ariaLabel`
 * nombra el valor para que el control se pueda ubicar y entender sin depender del texto de al lado,
 * que cada paso escribe distinto.
 */
export function Stepper({ value, onChange, min, max, paso = 5, sufijo, ariaLabel }: {
    value: number
    onChange: (v: number) => void
    min: number
    max: number
    paso?: number
    sufijo?: string
    ariaLabel?: string
}) {
    const clamp = (v: number) => Math.max(min, Math.min(max, v))
    return (
        <div
            role="group"
            aria-label={ariaLabel}
            className="inline-flex items-center rounded-full border border-border/60 bg-background shadow-2xs"
        >
            <button
                type="button"
                className="h-12 w-12 rounded-l-full text-2xl leading-none text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                disabled={value <= min}
                onClick={() => onChange(clamp(value - paso))}
            >−</button>
            <span className="min-w-20 px-2 text-center text-2xl font-semibold text-foreground tabular-nums">
                {value}{sufijo}
            </span>
            <button
                type="button"
                className="h-12 w-12 rounded-r-full text-2xl leading-none text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                disabled={value >= max}
                onClick={() => onChange(clamp(value + paso))}
            >+</button>
        </div>
    )
}
