import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useRestauranteStore } from '@/store/restauranteStore'
import { AjusteRow } from '../components/AjusteRow'
import { AjusteEditor } from '../components/AjusteEditor'
import { AjusteInput } from '../components/AjusteInput'
import { esAndroid, pedirExcepcionDeBateria } from '@/utils/piruAndroid'
import { DireccionField, SucursalJustInTime, WhatsappPedidosField } from './general/campos'

type EditorId = 'whatsapp' | 'nombre' | 'direccion' | null

/**
 * Tu negocio: el WhatsApp donde llegan los pedidos, el nombre y la dirección. Cada dato es una
 * fila con su «Cambiar», como los de Cuenta. El costo de envío vive en Entregas y zonas, junto con
 * el resto de lo que decide cuánto se cobra por llevar un pedido.
 */
export default function General() {
  const restaurante = useRestauranteStore((s) => s.restaurante)
  const [editor, setEditor] = useState<EditorId>(null)
  const cerrar = (o: boolean) => !o && setEditor(null)

  const telefono = restaurante?.telefono?.trim()
  const nombre = restaurante?.nombre?.trim()
  const direccion = restaurante?.direccionTexto?.trim() || restaurante?.direccion?.trim() || ''

  return (
    <section className="space-y-3">
      <header className="space-y-1">
        <h2 className="text-lg font-medium text-foreground">Tu negocio</h2>
        <p className="text-sm font-normal text-muted-foreground">
          Información del negocio y dónde recibís los pedidos.
        </p>
      </header>

      <div>
        <AjusteRow
          titulo="WhatsApp para recibir pedidos"
          oracion={telefono || 'Sin número: cargalo para que te lleguen los pedidos'}
          estado={telefono ? 'configurado' : 'atencion'}
          onAccion={() => setEditor('whatsapp')}
        />
        <AjusteRow
          titulo="Nombre del local"
          oracion={nombre || 'Todavía no cargaste el nombre de tu local'}
          estado={nombre ? 'configurado' : 'sin-configurar'}
          onAccion={() => setEditor('nombre')}
        />
        <AjusteRow
          titulo="Dirección del local"
          oracion={direccion || 'Sin dirección cargada'}
          estado={direccion ? 'configurado' : 'sin-configurar'}
          onAccion={() => setEditor('direccion')}
        />
        {esAndroid() && <AjusteBateriaAndroid />}
      </div>

      <AjusteEditor
        open={editor === 'whatsapp'}
        onOpenChange={cerrar}
        titulo="WhatsApp para recibir pedidos"
        descripcion="Se guarda solo al salir del campo."
      >
        <WhatsappPedidosField conEtiqueta={false} autoFocus />
      </AjusteEditor>
      <AjusteEditor
        open={editor === 'nombre'}
        onOpenChange={cerrar}
        titulo="Nombre del local"
        descripcion="Se guarda solo al salir del campo."
      >
        <AjusteInput campo="nombre" label="Nombre del local" placeholder="Ej: Burger Bros" />
      </AjusteEditor>
      <AjusteEditor
        open={editor === 'direccion'}
        onOpenChange={cerrar}
        titulo="Dirección del local"
        descripcion="Se guarda sola al elegir la dirección o salir del campo."
      >
        <div className="space-y-5">
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
