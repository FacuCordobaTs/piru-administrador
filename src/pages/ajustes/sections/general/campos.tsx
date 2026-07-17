import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import ImageUpload from '@/components/ImageUpload'
import { restauranteApi } from '@/lib/api'
import type { RestauranteData } from '@/store/restauranteStore'
import { SavedIndicator } from '../../components/SavedIndicator'
import { SucursalDialog } from '../../components/SucursalDialog'
import { useAjuste } from '../../hooks/useAjuste'
import { useToggleAjuste } from '../../hooks/useToggleAjuste'
import { useOptimisticUpdate } from '../../hooks/useOptimisticUpdate'
import { useDireccionAutocomplete } from '../../hooks/useDireccionAutocomplete'
import { useSucursales } from '../../hooks/useSucursales'

/** Dirección con autocomplete de Google + autosave onBlur. */
export function DireccionField() {
  const { inputRef, direccion, onChange, geocodificada, guardar, status } = useDireccionAutocomplete()
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Label htmlFor="ajuste-direccion" className="font-medium">
          Dirección del local
        </Label>
        <SavedIndicator status={status} />
      </div>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          id="ajuste-direccion"
          type="text"
          value={direccion}
          onChange={(e) => onChange(e.target.value)}
          onBlur={guardar}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              e.currentTarget.blur()
            }
          }}
          autoComplete="off"
          placeholder="Buscá la dirección exacta del local…"
          className="flex h-11 w-full rounded-md border border-input bg-transparent pl-9 pr-24 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        {geocodificada && (
          <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400">Ubicada</span>
          </div>
        )}
      </div>
      <p className="text-xs font-normal text-muted-foreground">Se usa para takeaway y el chatbot.</p>
    </div>
  )
}

/**
 * Sucursales just-in-time (regla 11): con 0 o 1 local no hay fila propia en
 * Entregas; se ofrece agregar sucursal acá, donde ya se piensa en el negocio.
 * Con 2+, esto desaparece y la fila vive en Entregas.
 */
export function SucursalJustInTime() {
  const { sucursales, loaded, recargar } = useSucursales()
  const [dialogOpen, setDialogOpen] = useState(false)

  if (!loaded || sucursales.length >= 2) return null

  return (
    <div className="border-t border-border pt-4">
      <button
        onClick={() => setDialogOpen(true)}
        className="text-sm font-normal text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        ¿Tenés más de un local? Agregar sucursal
      </button>
      <SucursalDialog open={dialogOpen} onOpenChange={setDialogOpen} editando={null} onSaved={recargar} />
    </div>
  )
}

/** Selector visual del diseño del menú: dos previews clickeables. */
export function DisenoSelector() {
  const { checked, toggle, status } = useToggleAjuste(
    'disenoAlternativo',
    restauranteApi.toggleDisenoAlternativo
  )
  // checked === true → diseño glass (alternativo).
  const elegir = (glass: boolean) => {
    if (glass !== checked) toggle()
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label className="font-medium">Diseño del menú</Label>
        <SavedIndicator status={status} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <DisenoPreview nombre="Sólido" seleccionado={!checked} onClick={() => elegir(false)} variante="solido" />
        <DisenoPreview nombre="Glass" seleccionado={checked} onClick={() => elegir(true)} variante="glass" />
      </div>
    </div>
  )
}

function DisenoPreview({
  nombre,
  seleccionado,
  onClick,
  variante,
}: {
  nombre: string
  seleccionado: boolean
  onClick: () => void
  variante: 'solido' | 'glass'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={seleccionado}
      className={cn(
        'flex min-h-[44px] flex-col gap-2 rounded-xl border p-2 text-left transition-all',
        seleccionado ? 'border-brand ring-2 ring-brand/40' : 'border-input hover:border-ring'
      )}
    >
      <div
        className={cn(
          'flex h-16 items-end gap-1 overflow-hidden rounded-lg p-2',
          variante === 'solido'
            ? 'bg-zinc-800'
            : 'bg-gradient-to-br from-zinc-700/60 to-zinc-900/60 backdrop-blur'
        )}
      >
        <span
          className={cn('h-6 flex-1 rounded', variante === 'solido' ? 'bg-brand' : 'bg-white/20 ring-1 ring-white/30')}
        />
        <span
          className={cn('h-9 flex-1 rounded', variante === 'solido' ? 'bg-zinc-600' : 'bg-white/10 ring-1 ring-white/20')}
        />
      </div>
      <span className="px-1 text-sm font-medium text-foreground">{nombre}</span>
    </button>
  )
}

/** Campo de color con swatch + hex, autosave onBlur. */
export function ColorField({
  campo,
  label,
  fallback,
}: {
  campo: 'colorPrimario' | 'colorSecundario'
  label: string
  fallback: string
}) {
  const { valor, guardar, status } = useAjuste(campo)
  const [draft, setDraft] = useState(String(valor ?? ''))
  useEffect(() => {
    setDraft(String(valor ?? ''))
  }, [valor])
  const commit = () => guardar(draft)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Label className="font-medium">{label}</Label>
        <SavedIndicator status={status} />
      </div>
      <div className="flex gap-2">
        <input
          type="color"
          value={draft || fallback}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          className="h-11 w-11 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-1"
          aria-label={`${label} — selector`}
        />
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          placeholder={fallback}
          className="h-11 font-mono uppercase"
        />
      </div>
    </div>
  )
}

/** ImageUpload con guardado inmediato optimista. */
export function LogoField({
  which,
  campoLocal,
  label,
  current,
  dark,
}: {
  which: 'image' | 'imageLight'
  campoLocal: keyof RestauranteData
  label: string
  current: string | null
  dark?: boolean
}) {
  const { run, status } = useOptimisticUpdate()
  const onImageChange = (base64: string | null) => {
    if (!base64 || !base64.startsWith('data:image')) return
    void run({ [campoLocal]: base64 } as Partial<RestauranteData>, { [which]: base64 })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label className="font-medium">{label}</Label>
        <SavedIndicator status={status} />
      </div>
      <div
        className={cn(
          'rounded-2xl border-2 border-dashed p-2 transition-colors',
          dark ? 'border-zinc-700 bg-zinc-900' : 'border-input bg-muted'
        )}
      >
        <ImageUpload onImageChange={onImageChange} currentImage={current} maxSize={5} />
      </div>
    </div>
  )
}
