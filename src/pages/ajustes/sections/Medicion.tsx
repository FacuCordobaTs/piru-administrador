import { useState } from 'react'
import { useRestauranteStore } from '@/store/restauranteStore'
import { AjusteRow } from '../components/AjusteRow'
import { AjusteEditor } from '../components/AjusteEditor'
import { AjusteInput } from '../components/AjusteInput'

type EditorId = 'gtm' | 'pixel' | null

const formatoGtm = (value: string) => value.trim().toUpperCase()
const validarGtm = (value: string) => {
  if (value === '') return null
  return /^GTM-[A-Z0-9]{4,32}$/.test(value)
    ? null
    : 'Usá el ID del contenedor, por ejemplo GTM-ABC123.'
}

// Se pega muy seguido el snippet entero en vez del número: quedarse con los
// dígitos deja pasar ese caso, y si no alcanzan los 15-16 la validación avisa.
const formatoPixel = (value: string) => value.trim().replace(/\D/g, '')
const validarPixel = (value: string) => {
  if (value === '') return null
  return /^\d{15,16}$/.test(value)
    ? null
    : 'Usá sólo el número de tu pixel, sin el código, por ejemplo 2426435001137598.'
}

/** Medición de la tienda: GTM y Meta Pixel, disponibles con Campañas activas. */
export default function Medicion() {
  const restaurante = useRestauranteStore((s) => s.restaurante)
  const [editor, setEditor] = useState<EditorId>(null)

  const gtmContainerId = restaurante?.gtmContainerId?.trim() || ''
  const metaPixelId = restaurante?.metaPixelId?.trim() || ''

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-lg font-medium text-foreground">Medición</h2>
        <p className="text-sm font-normal text-muted-foreground">
          Conectá tus herramientas de medición para las campañas y la tienda.
        </p>
      </header>

      <div>
        <AjusteRow
          titulo="Google Tag Manager"
          oracion={
            gtmContainerId
              ? `Contenedor ${gtmContainerId} conectado · Medición de visitas y conversiones activa`
              : 'Sin contenedor configurado — conectá tu ID de GTM para medir pauta digital'
          }
          estado={gtmContainerId ? 'configurado' : 'sin-configurar'}
          accionLabel={gtmContainerId ? 'Editar' : 'Configurar'}
          onAccion={() => setEditor('gtm')}
        />
        <AjusteRow
          titulo="Meta Pixel"
          oracion={
            metaPixelId
              ? `Pixel ${metaPixelId} conectado · Conversiones de Meta activas`
              : 'Sin pixel configurado — cargá tu ID para medir conversiones de Meta'
          }
          estado={metaPixelId ? 'configurado' : 'sin-configurar'}
          accionLabel={metaPixelId ? 'Editar' : 'Configurar'}
          onAccion={() => setEditor('pixel')}
        />
      </div>

      <AjusteEditor
        open={editor === 'gtm'}
        onOpenChange={(o) => !o && setEditor(null)}
        titulo="Google Tag Manager"
        descripcion="Pegá el ID de tu contenedor para medir visitas y conversiones de tu tienda."
      >
        <div className="space-y-3">
          <AjusteInput
            campo="gtmContainerId"
            label="ID del contenedor"
            placeholder="GTM-ABC123"
            mono
            transform={formatoGtm}
            validate={validarGtm}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Piru no inyecta scripts pesados por defecto para que la tienda cargue en milisegundos. Usá el contenedor para Google Analytics 4, TikTok Pixel y otras herramientas que administres vos.
          </p>
        </div>
      </AjusteEditor>

      <AjusteEditor
        open={editor === 'pixel'}
        onOpenChange={(o) => !o && setEditor(null)}
        titulo="Meta Pixel"
        descripcion="Pegá el ID de tu pixel para medir conversiones de tu tienda."
      >
        <div className="space-y-3">
          <AjusteInput
            campo="metaPixelId"
            label="ID del pixel"
            placeholder="2426435001137598"
            mono
            inputMode="tel"
            transform={formatoPixel}
            validate={validarPixel}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Lo encontrás en Meta Events Manager → Orígenes de datos, al lado del nombre de tu pixel: es sólo el número, no el código completo. Con esto la tienda mide visitas, productos vistos, agregados al carrito, inicios de compra y compras.
          </p>
        </div>
      </AjusteEditor>
    </section>
  )
}
