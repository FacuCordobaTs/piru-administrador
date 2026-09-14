import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { restauranteApi } from '@/lib/api'
import { useRestauranteStore } from '@/store/restauranteStore'
import { useModuloActivo } from '@/store/modulosStore'
import { AjusteRow } from '../components/AjusteRow'
import { AjusteEditor } from '../components/AjusteEditor'
import { ToggleConExplicacion } from './AvisosAutomaticos'
import { useWhatsApp } from '../hooks/useWhatsApp'
import { WhatsAppEditor } from './pagos/IntegracionEditors'

type WhatsAppEditorId = 'whatsapp' | 'avisos' | null

export default function WhatsApp() {
  const restaurante = useRestauranteStore((s) => s.restaurante)
  const [editor, setEditor] = useState<WhatsAppEditorId>(null)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const wa = useWhatsApp()

  const avisosActivos = useModuloActivo('avisos_automaticos_whatsapp')
  const avisosOn = restaurante?.notificarClientesWhatsapp !== false

  const waConectado = !!wa.status?.conectado
  const waVencido = waConectado && !!wa.status?.tokenVencido

  // Deep links directos desde Módulos o enlaces previos
  useEffect(() => {
    const config = searchParams.get('config')
    if (config === 'avisos' && avisosActivos) setEditor('avisos')
    if (config === 'whatsapp') setEditor('whatsapp')
  }, [searchParams, avisosActivos])

  return (
    <section className="space-y-8">
      <header className="space-y-3">
        <h2 className="text-xl font-medium tracking-tight text-foreground">
          WhatsApp
        </h2>
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed max-w-2xl">
          <p>
            Conectá tu número oficial de WhatsApp Business a través de Meta para la recepción de pedidos y la atención directa de tus clientes.
          </p>
          <p>
            Mantené a tus comensales informados en tiempo real activando los avisos automáticos de confirmación y despacho de pedidos.
          </p>
        </div>
      </header>

      {/* Ajustes y herramientas */}
      <div className="space-y-1">
        <AjusteRow
          titulo="WhatsApp Business"
          oracion={
            waVencido
              ? 'Token vencido · Reconectá tu número oficial de WhatsApp'
              : waConectado
              ? `Conectado · ${wa.status?.phoneNumber ?? ''}`
              : 'Sin conectar · Conectá tu número oficial para recepción de pedidos'
          }
          estado={waVencido ? 'atencion' : waConectado ? 'configurado' : 'sin-configurar'}
          accionLabel={waVencido ? 'Reconectar' : waConectado ? 'Cambiar' : 'Conectar'}
          onAccion={() => (waConectado ? setEditor('whatsapp') : wa.conectar())}
        />

        {avisosActivos ? (
          <AjusteRow
            titulo="Avisos automáticos por WhatsApp"
            oracion={
              avisosOn
                ? 'Notificaciones activas · El cliente recibe avisos automáticos de pedido confirmado y pedido en camino'
                : 'Notificaciones pausadas'
            }
            estado={avisosOn ? 'configurado' : 'sin-configurar'}
            accionLabel="Configurar"
            onAccion={() => setEditor('avisos')}
          />
        ) : (
          <AjusteRow
            titulo="Avisos automáticos por WhatsApp"
            oracion="Activá el módulo para notificar a tus comensales en tiempo real y eliminar preguntas en caja."
            estado="sin-configurar"
            accionLabel="Ver módulos"
            onAccion={() => {
              navigate({ hash: '#modulos-seccion' })
            }}
          />
        )}
      </div>

      {/* Editores modales */}
      <AjusteEditor
        open={editor === 'whatsapp'}
        onOpenChange={(o) => !o && setEditor(null)}
        titulo="WhatsApp Business"
        descripcion="Conexión de número oficial de WhatsApp para recepción de pedidos."
      >
        <WhatsAppEditor wa={wa} />
      </AjusteEditor>

      <AjusteEditor
        open={editor === 'avisos' && avisosActivos}
        onOpenChange={(o) => !o && setEditor(null)}
        titulo="Avisos automáticos por WhatsApp"
        descripcion="Mantené a tus comensales informados minuto a minuto durante la preparación y entrega."
      >
        <div className="space-y-2">
          <ToggleConExplicacion
            campo="notificarClientesWhatsapp"
            apiFn={restauranteApi.toggleNotificarClientesWhatsapp}
            titulo="Avisar por WhatsApp"
            explicacion="El cliente recibe un mensaje oficial de WhatsApp cuando confirmás su pedido y cuando sale en camino."
            defaultOn
          />
          {avisosOn && (
            <ToggleConExplicacion
              campo="modoConfirmacionManual"
              apiFn={restauranteApi.toggleModoConfirmacionManual}
              titulo="Confirmación manual con demora"
              explicacion="En lugar de enviar el aviso genérico automático, ingresás la demora en minutos desde el panel al aceptar el pedido."
              defaultOn={false}
            />
          )}
        </div>
      </AjusteEditor>
    </section>
  )
}
