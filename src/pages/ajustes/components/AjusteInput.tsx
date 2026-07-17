import { useEffect, useId, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useAjuste } from '../hooks/useAjuste'
import { SavedIndicator } from './SavedIndicator'
import type { RestauranteData } from '@/store/restauranteStore'

interface AjusteInputProps {
  campo: keyof RestauranteData
  label: string
  placeholder?: string
  /** Prefijo fijo dentro del campo, ej: "piru.app/". */
  prefix?: string
  mono?: boolean
  /** Normaliza el texto en cada cambio (ej: minúsculas para el alias). */
  transform?: (v: string) => string
  /** Devuelve un mensaje de error para bloquear el guardado, o null. */
  validate?: (v: string) => string | null
  inputMode?: 'text' | 'tel'
}

/** Input de texto con autosave onBlur + Enter. Modo lectura vive afuera. */
export function AjusteInput({
  campo,
  label,
  placeholder,
  prefix,
  mono,
  transform,
  validate,
  inputMode = 'text',
}: AjusteInputProps) {
  const id = useId()
  const { valor, guardar, status } = useAjuste(campo)
  const [draft, setDraft] = useState(String(valor ?? ''))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDraft(String(valor ?? ''))
  }, [valor])

  const commit = () => {
    const v = transform ? transform(draft) : draft
    if (validate) {
      const msg = validate(v)
      if (msg) {
        setError(msg)
        return
      }
    }
    setError(null)
    guardar(v)
  }

  const field = (
    <Input
      id={id}
      value={draft}
      inputMode={inputMode}
      onChange={(e) => setDraft(transform ? transform(e.target.value) : e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        }
      }}
      placeholder={placeholder}
      aria-invalid={!!error}
      className={cn('h-11', mono && 'font-mono', prefix && 'rounded-l-none border-l-0 pl-0')}
    />
  )

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Label htmlFor={id} className="font-medium">
          {label}
        </Label>
        <SavedIndicator status={status} />
      </div>
      {prefix ? (
        <div className="flex items-center overflow-hidden rounded-md border border-input">
          <span className="select-none pl-3 pr-0.5 font-mono text-sm text-muted-foreground">
            {prefix}
          </span>
          {field}
        </div>
      ) : (
        field
      )}
      {error && <p className="text-xs font-normal text-destructive">{error}</p>}
    </div>
  )
}
