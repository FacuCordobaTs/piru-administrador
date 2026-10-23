import { Star } from 'lucide-react'
import ImageUpload from '@/components/ImageUpload'

/** Fotos adicionales por producto, además de la portada (mismo tope que el backend). */
export const MAX_FOTOS_EXTRA = 5

interface FotosProductoProps {
  /** Portada: data URL nueva o URL ya subida. */
  portada: string | null
  /** Fotos adicionales en orden: data URL nueva o URL ya subida. */
  extras: string[]
  onChange: (portada: string | null, extras: string[]) => void
}

/**
 * Portada + galería opcional del producto. La portada es la que se ve en la carta, el carrito y
 * el POS; las demás sólo aparecen en el detalle de la tienda, en este orden.
 */
export default function FotosProducto({ portada, extras, onChange }: FotosProductoProps) {
  const cambiarPortada = (img: string | null) => {
    // Sin portada, la primera foto adicional pasa a ser la portada: nunca queda galería sin tapa.
    if (img === null && extras.length > 0) onChange(extras[0], extras.slice(1))
    else onChange(img, extras)
  }

  const cambiarExtra = (i: number, img: string | null) => {
    const siguiente = [...extras]
    if (img === null) siguiente.splice(i, 1)
    else siguiente[i] = img
    onChange(portada, siguiente)
  }

  const usarComoPortada = (i: number) => {
    const siguiente = [...extras]
    const [elegida] = siguiente.splice(i, 1, ...(portada ? [portada] : []))
    onChange(elegida, siguiente)
  }

  const casilleros = Math.min(MAX_FOTOS_EXTRA, extras.length + 1)

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Portada · la que se ve en la carta</p>
        <ImageUpload onImageChange={cambiarPortada} currentImage={portada} maxSize={5} />
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-xs font-medium text-muted-foreground">Más fotos (opcional)</p>
          <span className="text-xs tabular-nums text-muted-foreground">{extras.length}/{MAX_FOTOS_EXTRA}</span>
        </div>
        {portada ? (
          <>
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: casilleros }).map((_, i) => (
                <div key={i} className="relative">
                  <ImageUpload
                    square
                    compact
                    maxSize={5}
                    currentImage={extras[i] ?? null}
                    onImageChange={(img) => cambiarExtra(i, img)}
                  />
                  {extras[i] && (
                    <button
                      type="button"
                      onClick={() => usarComoPortada(i)}
                      aria-label="Usar como portada"
                      title="Usar como portada"
                      className="absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-black/80"
                    >
                      <Star className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Se ven en el detalle del producto: el cliente las pasa deslizando la foto.
            </p>
          </>
        ) : (
          <p className="rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
            Subí primero la portada para agregar más fotos.
          </p>
        )}
      </div>
    </div>
  )
}
