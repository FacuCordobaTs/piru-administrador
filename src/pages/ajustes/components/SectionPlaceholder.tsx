import { SectionSkeleton } from './SectionSkeleton'

/**
 * Placeholder temporal de una sección de ajustes, mientras se migra el
 * contenido real desde Perfil.tsx. Muestra el título de sección (h2) y el
 * skeleton de carga con el layout final.
 */
export function SectionPlaceholder({
  title,
  descripcion,
  rows,
}: {
  title: string
  descripcion?: string
  rows?: number
}) {
  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-lg font-medium text-foreground">{title}</h2>
        {descripcion && (
          <p className="text-sm font-normal text-muted-foreground">{descripcion}</p>
        )}
      </header>
      <SectionSkeleton rows={rows} />
    </section>
  )
}
