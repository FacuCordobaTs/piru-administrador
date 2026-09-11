import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { restauranteApi, puntosApi, type ConfiguracionPuntosData } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useModuloActivo } from '@/store/modulosStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { AjusteRow } from '../components/AjusteRow'
import { AjusteEditor } from '../components/AjusteEditor'
import { ToggleConExplicacion } from './AvisosAutomaticos'
import { PuntosConfigEditor } from './PuntosConfigEditor'

export default function Retencion() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const restaurante = useRestauranteStore((s) => s.restaurante)
  const token = useAuthStore((s) => s.token)

  const motorActivo = useModuloActivo('motor_recompra')
  const avisosActivos = useModuloActivo('avisos_automaticos_whatsapp')
  const moduloPuntosActivo = useModuloActivo('puntos_clientes')
  const puntosActivo = moduloPuntosActivo || !!restaurante?.sistemaPuntos

  const avisosOn = restaurante?.notificarClientesWhatsapp !== false
  const [puntosEditor, setPuntosEditor] = useState(false)
  const [avisosEditor, setAvisosEditor] = useState(false)
  const [puntosConfig, setPuntosConfig] = useState<ConfiguracionPuntosData | null>(null)

  useEffect(() => {
    const config = searchParams.get('config')
    if (config === 'puntos' && puntosActivo) setPuntosEditor(true)
    if (config === 'avisos' && avisosActivos) setAvisosEditor(true)
  }, [searchParams, puntosActivo, avisosActivos])

  useEffect(() => {
    if (puntosActivo && token) {
      puntosApi
        .getConfig(token)
        .then((res) => {
          if (res.success && res.data) setPuntosConfig(res.data)
        })
        .catch(() => {})
    }
  }, [puntosActivo, token])

  const describirPuntos = () => {
    if (!puntosConfig) return 'Configurado · Acumulación y canjes activos'
    if (!puntosConfig.activo) return 'Pausado (no se acumulan ni canjean puntos)'
    const canjes: string[] = []
    if (puntosConfig.permiteCanjeEnvioGratis) canjes.push('envío gratis')
    if (puntosConfig.permiteCanjeDescuento) canjes.push('descuentos')
    canjes.push('productos')
    return `Sumá 1 pt cada $${puntosConfig.pesosPorPunto} · Canjes: ${canjes.join(', ')}`
  }

  return (
    <section className="space-y-8">
      <header className="space-y-3">
        <h2 className="text-xl font-medium tracking-tight text-foreground">
          Retención
        </h2>
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed max-w-2xl">
          <p>
            Sistemas automatizados para incentivar la recompra recurrente mediante el análisis de la cadencia individual de cada comensal y toques de WhatsApp con carrito precargado antes de que se enfríe la relación.
          </p>
          <p>
            Configurá los avisos automáticos de estado para mantener informado al cliente durante la preparación y entrega, y administrá el programa de puntos para fidelizar con premios y beneficios.
          </p>
        </div>
      </header>

      {/* Ajustes y herramientas del pilar */}
      <div className="space-y-1">
        {motorActivo ? (
          <AjusteRow
            titulo="Motor de Recompra (Piloto automático)"
            oracion="Piloto automático activo · Goteo individual de mensajes de recupero con grupo de control y atribución."
            estado="configurado"
            accionLabel="Ver campaña"
            onAccion={() => navigate('/dashboard/ajustes/recompra')}
          />
        ) : (
          <AjusteRow
            titulo="Motor de Recompra (Piloto automático)"
            oracion="Activá el módulo para recuperar automáticamente clientes dormidos según su ritmo de compra personal."
            estado="sin-configurar"
            accionLabel="Ver módulos"
            onAccion={() => {
              document.getElementById('modulos-seccion')?.scrollIntoView({ behavior: 'smooth' })
            }}
          />
        )}

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
            onAccion={() => setAvisosEditor(true)}
          />
        ) : (
          <AjusteRow
            titulo="Avisos automáticos por WhatsApp"
            oracion="Activá el módulo para notificar a tus comensales en tiempo real y eliminar preguntas en caja."
            estado="sin-configurar"
            accionLabel="Ver módulos"
            onAccion={() => {
              document.getElementById('modulos-seccion')?.scrollIntoView({ behavior: 'smooth' })
            }}
          />
        )}

        {puntosActivo ? (
          <AjusteRow
            titulo="Club de Puntos"
            oracion={describirPuntos()}
            estado={puntosConfig?.activo ? 'configurado' : 'sin-configurar'}
            accionLabel="Configurar reglas"
            onAccion={() => setPuntosEditor(true)}
          />
        ) : (
          <AjusteRow
            titulo="Club de Puntos"
            oracion="Activá el módulo desde Módulos para fidelizar a tus clientes con acumulación y canje de puntos."
            estado="sin-configurar"
            accionLabel="Ver módulos"
            onAccion={() => {
              document.getElementById('modulos-seccion')?.scrollIntoView({ behavior: 'smooth' })
            }}
          />
        )}
      </div>

      {/* Editor de Avisos Automáticos */}
      <AjusteEditor
        open={avisosEditor && avisosActivos}
        onOpenChange={setAvisosEditor}
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

      {/* Editor de Club de Puntos */}
      <AjusteEditor
        open={puntosEditor}
        onOpenChange={setPuntosEditor}
        titulo="Club de Puntos"
        descripcion="Definí cuánto dinero equivale a un punto y qué recompensas pueden canjear tus comensales."
      >
        <PuntosConfigEditor
          onSaved={() => {
            if (token) {
              puntosApi
                .getConfig(token)
                .then((res) => {
                  if (res.success && res.data) setPuntosConfig(res.data)
                })
                .catch(() => {})
            }
            setPuntosEditor(false)
          }}
        />
      </AjusteEditor>
    </section>
  )
}
