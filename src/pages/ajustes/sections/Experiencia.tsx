import { useState, type ReactNode } from 'react'
import { Switch } from '@/components/ui/switch'
import { restauranteApi } from '@/lib/api'
import { useRestauranteStore } from '@/store/restauranteStore'
import { AjusteRow } from '../components/AjusteRow'
import { AjusteEditor } from '../components/AjusteEditor'
import { useToggleAjuste } from '../hooks/useToggleAjuste'

type EditorId = 'amigos' | 'codigos' | 'notificaciones' | null

export default function Experiencia() {
  const restaurante = useRestauranteStore((s) => s.restaurante)
  const [editor, setEditor] = useState<EditorId>(null)

  const amigosOn = restaurante?.orderGroupEnabled !== false
  const codigosOn = restaurante?.codigoDescuentoEnabled !== false
  const avisosOn = restaurante?.notificarClientesWhatsapp !== false
  const manualOn = restaurante?.modoConfirmacionManual === true

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-lg font-medium text-foreground">Experiencia</h2>
        <p className="text-sm font-normal text-muted-foreground">
          Cómo viven tus clientes el pedido.
        </p>
      </header>

      <div>
        <AjusteRow
          titulo="Pedidos entre amigos"
          oracion={amigosOn ? 'Activado' : 'Desactivado'}
          estado={amigosOn ? 'configurado' : 'sin-configurar'}
          onAccion={() => setEditor('amigos')}
        />
        <AjusteRow
          titulo="Códigos de descuento"
          oracion={codigosOn ? 'Activado' : 'Desactivado'}
          estado={codigosOn ? 'configurado' : 'sin-configurar'}
          onAccion={() => setEditor('codigos')}
        />
        <AjusteRow
          titulo="Notificaciones"
          oracion={
            avisosOn
              ? manualOn
                ? 'Avisás a tus clientes por WhatsApp, con confirmación manual'
                : 'Avisás a tus clientes por WhatsApp automáticamente'
              : 'Sin avisos automáticos a clientes'
          }
          estado="configurado"
          onAccion={() => setEditor('notificaciones')}
        />
      </div>

      <AjusteEditor
        open={editor === 'amigos'}
        onOpenChange={(o) => !o && setEditor(null)}
        titulo="Pedidos entre amigos"
        descripcion="Qué cambia para el cliente."
      >
        <ToggleConExplicacion
          campo="orderGroupEnabled"
          apiFn={restauranteApi.toggleOrderGroupEnabled}
          titulo="Pedidos entre amigos"
          explicacion="El cliente ve un botón para compartir un link y armar un carrito entre varias personas."
        />
      </AjusteEditor>

      <AjusteEditor
        open={editor === 'codigos'}
        onOpenChange={(o) => !o && setEditor(null)}
        titulo="Códigos de descuento"
        descripcion="Qué cambia para el cliente."
      >
        <ToggleConExplicacion
          campo="codigoDescuentoEnabled"
          apiFn={restauranteApi.toggleCodigoDescuentoEnabled}
          titulo="Códigos de descuento"
          explicacion="El cliente ve un campo para ingresar un código y aplicar su descuento en el checkout."
        />
      </AjusteEditor>

      <AjusteEditor
        open={editor === 'notificaciones'}
        onOpenChange={(o) => !o && setEditor(null)}
        titulo="Notificaciones"
        descripcion="Avisos automáticos a tus clientes."
      >
        <div className="space-y-1">
          <ToggleConExplicacion
            campo="notificarClientesWhatsapp"
            apiFn={restauranteApi.toggleNotificarClientesWhatsapp}
            titulo="Avisar por WhatsApp"
            explicacion="El cliente recibe un WhatsApp cuando confirmás y cuando su pedido va en camino."
            defaultOn
          />
          {avisosOn && (
            <ToggleConExplicacion
              campo="modoConfirmacionManual"
              apiFn={restauranteApi.toggleModoConfirmacionManual}
              titulo="Confirmación manual con demora"
              explicacion="En vez del aviso automático, ingresás la demora y lo enviás vos desde el panel."
              defaultOn={false}
            />
          )}
        </div>
      </AjusteEditor>
    </section>
  )
}

/** Fila de toggle optimista con una línea que explica qué ve el cliente. */
function ToggleConExplicacion({
  campo,
  apiFn,
  titulo,
  explicacion,
  defaultOn = true,
}: {
  campo: Parameters<typeof useToggleAjuste>[0]
  apiFn: (token: string) => Promise<unknown>
  titulo: string
  explicacion: ReactNode
  defaultOn?: boolean
}) {
  const { checked, toggle } = useToggleAjuste(campo, apiFn, { defaultOn })
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{titulo}</p>
        <p className="text-[13px] font-normal text-muted-foreground">{explicacion}</p>
      </div>
      <Switch checked={checked} onCheckedChange={toggle} />
    </div>
  )
}
