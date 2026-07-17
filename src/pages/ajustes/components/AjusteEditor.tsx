import { useEffect, useState, type ReactNode } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { SavedIndicator } from './SavedIndicator'
import type { AjusteStatus } from '../hooks/useAjuste'

function useIsWide() {
  const query = '(min-width: 640px)'
  const [wide, setWide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  )
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setWide(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return wide
}

interface AjusteEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  titulo: string
  descripcion?: string
  children: ReactNode
  /**
   * Footer opcional SOLO para editores transaccionales (credenciales):
   * ahí los botones sí tienen sentido. Los editores comunes usan autosave
   * (useAjuste/useToggleAjuste) y no llevan botón Guardar: cerrar es cerrar.
   */
  footer?: ReactNode
  /** Indicador "Guardando…/Guardado ✓" junto al título (ej: horarios con debounce). */
  status?: AjusteStatus
}

/**
 * Contenedor del editor que se abre al tocar "Cambiar".
 * - ≥640px: Sheet lateral derecho.
 * - <640px: hoja desde abajo (drawer).
 * Header con título + X (provista por Sheet), contenido scrolleable, Esc cierra
 * siempre (Radix Dialog). Sin botón Guardar salvo `footer` transaccional.
 */
export function AjusteEditor({
  open,
  onOpenChange,
  titulo,
  descripcion,
  children,
  footer,
  status,
}: AjusteEditorProps) {
  const wide = useIsWide()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={wide ? 'right' : 'bottom'}
        className={
          wide
            ? 'w-full gap-0 p-0 sm:max-w-md'
            : 'max-h-[85vh] gap-0 rounded-t-2xl p-0'
        }
      >
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="flex items-center gap-2 text-base font-medium text-foreground">
            {titulo}
            {status && <SavedIndicator status={status} />}
          </SheetTitle>
          {descripcion && (
            <SheetDescription className="text-[13px] font-normal">
              {descripcion}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer && (
          <div className="mt-auto flex items-center justify-end gap-2 border-t border-border px-5 py-4">
            {footer}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
