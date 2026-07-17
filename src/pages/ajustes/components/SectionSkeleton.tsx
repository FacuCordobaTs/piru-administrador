/**
 * Skeleton de una sección de ajustes: filas grises que imitan el layout final
 * (label + control), nunca un spinner centrado. Se usa como fallback de
 * React.lazy y como estado de carga de cada sección.
 */
export function SectionSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-6" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="h-4 w-40 rounded bg-muted animate-pulse" />
            <div className="h-3 w-56 max-w-full rounded bg-muted/60 animate-pulse" />
          </div>
          <div className="h-9 w-28 shrink-0 rounded-lg bg-muted animate-pulse" />
        </div>
      ))}
    </div>
  )
}
