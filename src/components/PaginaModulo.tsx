import { type ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useModuloActivo, useModulosStore } from '@/store/modulosStore'
import { cn } from '@/lib/utils'

/**
 * Marco de una pantalla de módulo del navbar: título, descripción y el estado
 * de "módulo sin activar". Cada módulo vive en su propia página; acá sólo se
 * resuelve el acceso, no se duplica la configuración.
 */
export function PaginaModulo({
  titulo,
  descripcion,
  modulo,
  ancho = 'max-w-4xl',
  children,
}: {
  titulo: string
  descripcion: string
  modulo: string
  /** Ancho del contenedor; las pantallas con tablas usan `max-w-6xl`. */
  ancho?: string
  children: ReactNode
}) {
  // `useModuloActivo` ya dispara la carga del catálogo. Mientras no haya
  // catálogo ni error no se puede distinguir "apagado" de "cargando": no
  // mostramos el cartel de activación antes de tiempo.
  const activo = useModuloActivo(modulo)
  const categorias = useModulosStore((state) => state.categorias)
  const error = useModulosStore((state) => state.error)
  const resolviendo = categorias.length === 0 && !error

  return (
    <div className={cn('mx-auto w-full px-4 py-8 sm:px-6 lg:py-12', ancho)}>
      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{titulo}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{descripcion}</p>
      </header>

      {resolviendo ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-brand" />
        </div>
      ) : activo ? (
        children
      ) : (
        <div className="rounded-2xl border border-border/70 bg-background p-6">
          <p className="text-sm font-medium text-foreground">Activá el módulo para configurarlo.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuando esté activo, esta pantalla te deja dejarlo listo para tu local.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/dashboard/modulos">
              Ver módulos
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}
