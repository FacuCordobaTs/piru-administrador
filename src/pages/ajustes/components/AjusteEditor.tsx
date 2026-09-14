import { useId, type ReactNode } from 'react'
import { SettingsDetail } from '@/components/SettingsNavigation'
import { SavedIndicator } from './SavedIndicator'
import type { AjusteStatus } from '../hooks/useAjuste'

interface AjusteEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  titulo: string
  descripcion?: string
  children: ReactNode
  /** Acciones para credenciales y otros editores transaccionales. */
  footer?: ReactNode
  status?: AjusteStatus
}

/** Cada ajuste ocupa la sección completa; volver conserva la pantalla de origen. */
export function AjusteEditor({ open, onOpenChange, titulo, descripcion, children, footer, status }: AjusteEditorProps) {
  const titleId = useId()
  if (!open) return null
  return <SettingsDetail onBack={() => onOpenChange(false)}>
    <div role="region" aria-labelledby={titleId} className="space-y-6">
      <header className="space-y-2">
        <h2 id={titleId} className="flex flex-wrap items-center gap-2 text-lg font-medium text-foreground">
          {titulo}{status && <SavedIndicator status={status} />}
        </h2>
        {descripcion && <p className="text-sm text-muted-foreground">{descripcion}</p>}
      </header>
      <div className="min-w-0">{children}</div>
      {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">{footer}</div>}
    </div>
  </SettingsDetail>
}
