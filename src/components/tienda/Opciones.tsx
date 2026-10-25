import type { ReactNode } from 'react'
import { Check } from 'lucide-react'

/** Una decisión del editor: una pregunta, por qué importa y sus opciones. */
export function Decision({ titulo, detalle, children, extra }: { titulo: string; detalle?: string; children: ReactNode; extra?: ReactNode }) {
  return <section className="min-w-0 space-y-4 border-t pt-7 first:border-t-0 first:pt-0">
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <div className="min-w-0">
        <h3 className="text-base font-semibold">{titulo}</h3>
        {detalle && <p className="mt-0.5 text-sm text-muted-foreground">{detalle}</p>}
      </div>
      {extra}
    </div>
    {children}
  </section>
}

/** Una opción elegible como tarjeta. El radio real queda oculto pero accesible por teclado y lector. */
export function Opcion({ nombre, etiqueta, elegida, onElegir, children, className = '' }: {
  nombre: string; etiqueta: string; elegida: boolean; onElegir: () => void; children: ReactNode; className?: string
}) {
  return <label className={`group relative flex min-w-0 cursor-pointer flex-col rounded-2xl border bg-card p-2 text-left transition-[border-color,box-shadow,transform] duration-150 active:scale-[0.98] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${elegida ? 'border-primary shadow-[0_0_0_1px_var(--primary)]' : 'border-border hover:border-foreground/30'} ${className}`}>
    <input type="radio" name={nombre} aria-label={etiqueta} checked={elegida} onChange={onElegir} className="sr-only" />
    {children}
    {elegida && <span aria-hidden className="absolute right-2.5 top-2.5 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm"><Check className="size-3" strokeWidth={3} /></span>}
  </label>
}

/** Un texto propuesto, como un renglón elegible. */
export function OpcionTexto({ nombre, texto, elegida, onElegir }: { nombre: string; texto: string; elegida: boolean; onElegir: () => void }) {
  return <label className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 text-sm leading-snug transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${elegida ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
    <input type="radio" name={nombre} checked={elegida} onChange={onElegir} className="mt-0.5 accent-[var(--primary)]" />
    <span className="min-w-0">{texto}</span>
  </label>
}

export const Muestra = ({ color, className = '' }: { color: string; className?: string }) =>
  <span aria-hidden className={`block rounded-full ring-1 ring-black/10 ${className}`} style={{ background: color }} />
