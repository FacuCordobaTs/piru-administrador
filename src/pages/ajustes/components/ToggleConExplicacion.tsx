import { type ReactNode } from 'react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { useToggleAjuste } from '../hooks/useToggleAjuste'

interface ToggleConExplicacionProps {
  campo: Parameters<typeof useToggleAjuste>[0]
  apiFn: (token: string) => Promise<unknown>
  titulo: string
  explicacion: ReactNode
  defaultOn?: boolean
  /** Clases de la fila. Por defecto `py-3`, para listas sin separadores. */
  className?: string
}

/** Fila de switch con su explicación, para booleanos que no ameritan un editor. */
export function ToggleConExplicacion({
  campo,
  apiFn,
  titulo,
  explicacion,
  defaultOn = true,
  className,
}: ToggleConExplicacionProps) {
  const { checked, toggle } = useToggleAjuste(campo, apiFn, { defaultOn })
  return (
    <div className={cn('flex items-center justify-between gap-4 py-3', className)}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{titulo}</p>
        <p className="text-[13px] font-normal text-muted-foreground">{explicacion}</p>
      </div>
      <Switch checked={checked} onCheckedChange={toggle} aria-label={titulo} />
    </div>
  )
}
