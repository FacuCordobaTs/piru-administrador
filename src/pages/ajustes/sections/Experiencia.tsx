import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useRestauranteStore } from '@/store/restauranteStore'
import { useModuloActivo } from '@/store/modulosStore'
import { restauranteApi, puntosApi, type ConfiguracionPuntosData } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { AjusteRow } from '../components/AjusteRow'
import { AjusteEditor } from '../components/AjusteEditor'
import { ToggleConExplicacion } from './AvisosAutomaticos'
import { PuntosConfigEditor } from './PuntosConfigEditor'

type EditorId = 'amigos' | 'puntos' | null

export default function Experiencia() {
  const restaurante = useRestauranteStore((s) => s.restaurante)
  const token = useAuthStore((s) => s.token)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [editor, setEditor] = useState<EditorId>(null)
  const [puntosConfig, setPuntosConfig] = useState<ConfiguracionPuntosData | null>(null)

  const moduloPuntosActivo = useModuloActivo('puntos_clientes')
  const puntosActivo = moduloPuntosActivo || !!restaurante?.sistemaPuntos
  const amigosOn = restaurante?.orderGroupEnabled !== false

  useEffect(() => {
    if (searchParams.get('config') === 'puntos' && puntosActivo) {
      setEditor('puntos')
    }
  }, [searchParams, puntosActivo])

  useEffect(() => {
    if (puntosActivo && token) {
      puntosApi.getConfig(token).then((res) => {
        if (res.success && res.data) {
          setPuntosConfig(res.data)
        }
      }).catch(() => {})
    }
  }, [puntosActivo, token])

  const describirPuntos = () => {
    if (!puntosConfig) return 'Configurado • Acumulación y canjes activos'
    if (!puntosConfig.activo) return 'Pausado (no se acumulan ni canjean puntos)'
    const canjes: string[] = []
    if (puntosConfig.permiteCanjeEnvioGratis) canjes.push('envío gratis')
    if (puntosConfig.permiteCanjeDescuento) canjes.push('descuentos')
    canjes.push('productos')
    return `Sumá 1 pt cada $${puntosConfig.pesosPorPunto} • Canjes: ${canjes.join(', ')}`
  }

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-lg font-medium text-foreground">Experiencia</h2>
        <p className="text-sm font-normal text-muted-foreground">
          Cómo viven tus clientes el pedido en tu tienda online.
        </p>
      </header>

      <div className="space-y-2">
        <AjusteRow
          titulo="Pedidos entre amigos"
          oracion={amigosOn ? 'Activado' : 'Desactivado'}
          estado={amigosOn ? 'configurado' : 'sin-configurar'}
          onAccion={() => setEditor('amigos')}
        />

        {puntosActivo ? (
          <AjusteRow
            titulo="Club de Puntos"
            oracion={describirPuntos()}
            estado={puntosConfig?.activo ? 'configurado' : 'sin-configurar'}
            onAccion={() => setEditor('puntos')}
          />
        ) : (
          <AjusteRow
            titulo="Club de Puntos"
            oracion="Activá el módulo desde Módulos para fidelizar a tus clientes con acumulación y canje de puntos."
            estado="sin-configurar"
            accionLabel="Ver módulos"
            onAccion={() => navigate('/dashboard/ajustes/modulos')}
          />
        )}
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
        open={editor === 'puntos'}
        onOpenChange={(o) => !o && setEditor(null)}
        titulo="Club de Puntos"
        descripcion="Configurá las reglas de acumulación y los canjes disponibles para tus clientes."
      >
        <PuntosConfigEditor
          onSaved={() => {
            if (token) {
              puntosApi.getConfig(token).then((res) => {
                if (res.success && res.data) setPuntosConfig(res.data)
              }).catch(() => {})
            }
            setEditor(null)
          }}
        />
      </AjusteEditor>
    </section>
  )
}
