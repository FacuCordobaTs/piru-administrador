import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useRestauranteStore } from '@/store/restauranteStore'
import { AjusteRow } from '../components/AjusteRow'
import { AjusteEditor } from '../components/AjusteEditor'
import { AjusteInput } from '../components/AjusteInput'
import { esAndroid, pedirExcepcionDeBateria } from '@/utils/piruAndroid'
import { DireccionField, SucursalJustInTime, WhatsappPedidosField } from './general/campos'

type EditorId = 'negocio' | null

/**
 * Datos del negocio y el WhatsApp donde llegan los pedidos. El costo de envío vive en Entregas y
 * zonas, junto con el resto de lo que decide cuánto se cobra por llevar un pedido.
 */
export default function General() {
  const restaurante = useRestauranteStore((s) => s.restaurante)
  const [editor, setEditor] = useState<EditorId>(null)

  const nombre = restaurante?.nombre?.trim()
  const direccion = restaurante?.direccionTexto?.trim() || restaurante?.direccion?.trim() || ''
  const dirCorta = direccion.split(',')[0]?.trim()

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-lg font-medium text-foreground">General</h2>
        <p className="text-sm font-normal text-muted-foreground">
          Información del negocio y dónde recibís los pedidos.
        </p>
      </header>

      <div className="border-b border-border/50 pb-5">
        <WhatsappPedidosField />
      </div>

      <div>
        <AjusteRow
          titulo="Tu negocio"
          oracion={
            nombre
              ? `${nombre}${dirCorta ? ` · ${dirCorta}` : ' · sin dirección cargada'}`
              : 'Todavía no cargaste el nombre de tu local'
          }
          estado={nombre ? 'configurado' : 'sin-configurar'}
          onAccion={() => setEditor('negocio')}
        />
        {esAndroid() && <AjusteBateriaAndroid />}
      </div>

      <AjusteEditor
        open={editor === 'negocio'}
        onOpenChange={(o) => !o && setEditor(null)}
        titulo="Tu negocio"
        descripcion="Se guarda solo al salir de cada campo."
      >
        <div className="space-y-5">
          <AjusteInput campo="nombre" label="Nombre del local" placeholder="Ej: Burger Bros" />
          <DireccionField />
          <SucursalJustInTime />
        </div>
      </AjusteEditor>
    </section>
  )
}

/**
 * Excepción de optimización de batería (sólo Android, o sea la tablet del local).
 *
 * Android duerme las apps en segundo plano para ahorrar batería, y una app dormida puede cortar
 * una comanda a mitad de camino. Se pide la excepción del sistema en vez de un foreground service
 * —que dejaría una notificación permanente—: con la excepción, la app sigue viva sin que nadie la
 * mire. El puente no devuelve nada, así que no hay estado que guardar: se avisa que se abrió el
 * diálogo y el usuario decide ahí.
 */
function AjusteBateriaAndroid() {
  const [aviso, setAviso] = useState<string | null>(null)

  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">Que Android no duerma la app</p>
        <p className="mt-0.5 text-[13px] font-normal text-muted-foreground">
          Para ahorrar batería, Android suspende las apps en segundo plano y eso puede cortar una
          impresión a mitad de camino. Con la excepción de batería la app sigue viva aunque nadie
          la esté mirando. Se abre el ajuste del sistema: elegí «No optimizar» o
          «Sin restricciones» para Piru.
        </p>
        {aviso && <p className="mt-1 text-xs font-normal text-muted-foreground">{aviso}</p>}
      </div>
      <Button
        variant="outline"
        className="h-11 min-h-[44px] shrink-0 font-medium"
        onClick={() =>
          setAviso(
            pedirExcepcionDeBateria()
              ? 'Listo: elegí «No optimizar» en el diálogo de Android.'
              : 'Esta versión de la app no lo incluye. Actualizá Piru para configurarlo.',
          )
        }
      >
        Abrir ajuste
      </Button>
    </div>
  )
}
