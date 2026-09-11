import { useState } from 'react'
import { useNavigate } from 'react-router'
import { restauranteApi } from '@/lib/api'
import { useRestauranteStore } from '@/store/restauranteStore'
import { AjusteRow } from '../components/AjusteRow'
import { AjusteEditor } from '../components/AjusteEditor'
import { ToggleConExplicacion } from './AvisosAutomaticos'

export default function Activacion() {
  const restaurante = useRestauranteStore((s) => s.restaurante)
  const navigate = useNavigate()
  const [salaEditor, setSalaEditor] = useState(false)

  const amigosOn = restaurante?.orderGroupEnabled !== false
  const username = restaurante?.username?.trim()
  const linkTienda = username ? `https://piru.app/${username}` : null

  return (
    <section className="space-y-8">
      <header className="space-y-3">
        <h2 className="text-xl font-medium tracking-tight text-foreground">
          Activación
        </h2>
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed max-w-2xl">
          <p>
            Tu tienda opera 100% en el navegador web del celular (Safari y Chrome), sin descargas de aplicaciones ni registros de usuario obligatorios, permitiendo que el cliente vea tu carta y elija sus productos de inmediato.
          </p>
          <p>
            Podés habilitar pedidos en grupo mediante una sala compartida por WhatsApp para que varios comensales agreguen platos en tiempo real a una misma orden, además de definir tus horarios de apertura y zonas de delivery.
          </p>
        </div>
      </header>

      {/* Ajustes y herramientas del pilar */}
      <div className="space-y-1">
        <AjusteRow
          titulo="Tienda web en el navegador"
          oracion={
            linkTienda
              ? `piru.app/${username} · 100% web en Safari y Chrome, sin apps ni contraseñas obligatorias`
              : 'Configurá el alias de tu tienda en General para habilitar tu link'
          }
          estado={linkTienda ? 'configurado' : 'sin-configurar'}
          accionLabel="Abrir tienda"
          onAccion={() => {
            if (linkTienda) window.open(linkTienda, '_blank')
            else navigate('/dashboard/ajustes/general')
          }}
        />

        <AjusteRow
          titulo="Pedidos entre amigos (Sala grupal)"
          oracion={
            amigosOn
              ? 'Activado · El loop viral permite a comensales armar un único pedido grupal compartido por WhatsApp'
              : 'Desactivado · Los clientes solo pueden pedir de forma individual'
          }
          estado={amigosOn ? 'configurado' : 'sin-configurar'}
          accionLabel={amigosOn ? 'Cambiar' : 'Activar'}
          onAccion={() => setSalaEditor(true)}
        />

        <AjusteRow
          titulo="Horarios de apertura y pedidos diferidos"
          oracion="Gestioná los días y turnos de atención y habilitá pedidos programados para más tarde."
          estado="configurado"
          accionLabel="Configurar horarios"
          onAccion={() => navigate('/dashboard/ajustes/horarios')}
        />

        <AjusteRow
          titulo="Entregas y zonas de cobertura"
          oracion="Tipos de entrega (delivery / takeaway), trazado de zonas con validación automática y sucursales."
          estado="configurado"
          accionLabel="Configurar entregas"
          onAccion={() => navigate('/dashboard/ajustes/entregas')}
        />
      </div>

      {/* Editor de Pedidos en Grupo */}
      <AjusteEditor
        open={salaEditor}
        onOpenChange={setSalaEditor}
        titulo="Pedidos entre amigos (Sala grupal)"
        descripcion="Coordinación de pedidos compartidos en tiempo real."
      >
        <div className="space-y-4">
          <ToggleConExplicacion
            campo="orderGroupEnabled"
            apiFn={restauranteApi.toggleOrderGroupEnabled}
            titulo="Permitir pedidos en grupo"
            explicacion="Habilita un botón en la tienda para que un cliente inicie una sala compartida y envíe el link a otros comensales."
          />
          <div className="pt-2 text-xs text-muted-foreground leading-relaxed space-y-1">
            <p className="font-medium text-foreground">Cómo funciona</p>
            <p>
              El anfitrión comparte el enlace por WhatsApp. Cada integrante suma sus productos desde su teléfono y la orden se consolida en una sola entrega (delivery o takeaway) para cocina y caja.
            </p>
          </div>
        </div>
      </AjusteEditor>
    </section>
  )
}
