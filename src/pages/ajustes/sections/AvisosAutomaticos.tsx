import { type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Switch } from '@/components/ui/switch'
import { restauranteApi } from '@/lib/api'
import { useRestauranteStore } from '@/store/restauranteStore'
import { useModuloActivo } from '@/store/modulosStore'
import { AjusteRow } from '../components/AjusteRow'
import { useToggleAjuste } from '../hooks/useToggleAjuste'

/** Configuración del módulo; su activación y cobro viven exclusivamente en Módulos. */
export default function AvisosAutomaticos() {
  const restaurante = useRestauranteStore((s) => s.restaurante)
  const navigate = useNavigate()
  const avisosActivos = useModuloActivo('avisos_automaticos_whatsapp')
  const avisosOn = restaurante?.notificarClientesWhatsapp !== false

  if (!avisosActivos) {
    return (
      <section className="space-y-6">
        <header className="space-y-1">
          <h2 className="text-lg font-medium text-foreground">Avisos automáticos</h2>
        </header>
        <AjusteRow
          titulo="Avisos por WhatsApp"
          oracion="Activá el módulo desde Módulos para configurar tus avisos"
          estado="sin-configurar"
          accionLabel="Ver módulos"
          onAccion={() => navigate('/dashboard/modulos')}
        />
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-lg font-medium text-foreground">Avisos automáticos</h2>
        <p className="text-sm font-normal text-muted-foreground">Cómo se comunican los estados de pedido a tus clientes.</p>
      </header>
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
    </section>
  )
}

export function ToggleConExplicacion({
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
