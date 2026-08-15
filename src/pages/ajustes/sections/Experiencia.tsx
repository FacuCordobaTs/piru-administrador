import { useState } from 'react'
import { useRestauranteStore } from '@/store/restauranteStore'
import { AjusteRow } from '../components/AjusteRow'
import { AjusteEditor } from '../components/AjusteEditor'

type EditorId = 'amigos' | null

export default function Experiencia() {
  const restaurante = useRestauranteStore((s) => s.restaurante)
  const [editor, setEditor] = useState<EditorId>(null)

  const amigosOn = restaurante?.orderGroupEnabled !== false

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

    </section>
  )
}
