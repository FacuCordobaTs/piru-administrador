import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import ImageUpload from '@/components/ImageUpload'
import type { RestauranteData } from '@/store/restauranteStore'
import { SavedIndicator } from '../../components/SavedIndicator'
import { SucursalDialog } from '../../components/SucursalDialog'
import { useAjuste } from '../../hooks/useAjuste'
import { useOptimisticUpdate } from '../../hooks/useOptimisticUpdate'
import { useDireccionAutocomplete } from '../../hooks/useDireccionAutocomplete'
import { useSucursales } from '../../hooks/useSucursales'
import { useModuloActivo } from '@/store/modulosStore'

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
  const multisucursalActiva = useModuloActivo('multisucursal')

  if (!loaded || sucursales.length >= 2 || !multisucursalActiva) return null

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

/** Costo fijo de envío: autosave onBlur, sólo números. Vacío = sin costo. */
export function CostoEnvioField() {
  const { valor, guardar, status } = useAjuste('deliveryFee')
  const [draft, setDraft] = useState(String(valor ?? ''))
  useEffect(() => {
    setDraft(String(valor ?? ''))
  }, [valor])
  const commit = () => guardar(draft)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Label htmlFor="ajuste-costo-envio" className="font-medium">
          Costo fijo por envío
        </Label>
        <SavedIndicator status={status} />
      </div>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">$</span>
        <Input
          id="ajuste-costo-envio"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/[^\d.]/g, ''))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              e.currentTarget.blur()
            }
          }}
          placeholder="0"
          inputMode="decimal"
          className="h-11 rounded-xl pl-7"
        />
      </div>
      <p className="text-xs font-normal text-muted-foreground">
        Se suma automáticamente a cada pedido de delivery del POS. Dejalo en 0 para no cobrar envío.
      </p>
    </div>
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
          dark ? 'border-zinc-700 bg-zinc-900' : 'border-input bg-white dark:bg-muted'
        )}
      >
        <ImageUpload onImageChange={onImageChange} currentImage={current} maxSize={5} />
      </div>
    </div>
  )
}
