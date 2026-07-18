import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { restauranteApi } from '@/lib/api'
import { useRestauranteStore } from '@/store/restauranteStore'
import { AjusteRow } from '../components/AjusteRow'
import { AjusteEditor } from '../components/AjusteEditor'
import { AjusteInput } from '../components/AjusteInput'
import { useToggleAjuste } from '../hooks/useToggleAjuste'
import {
  DireccionField,
  SucursalJustInTime,
  DisenoSelector,
  ColorField,
  LogoField,
} from './general/campos'

type EditorId = 'negocio' | 'tienda' | 'logos' | 'avisos' | null

export default function General() {
  const restaurante = useRestauranteStore((s) => s.restaurante)
  const [editor, setEditor] = useState<EditorId>(null)

  const nombre = restaurante?.nombre?.trim()
  const dirCorta = restaurante?.direccionTexto?.split(',')[0]?.trim()
  const username = restaurante?.username?.trim()
  const diseno = restaurante?.disenoAlternativo ? 'glass' : 'sólido'
  const tieneLogo = !!(restaurante?.imagenUrl || restaurante?.imagenLightUrl)
  const avisosOn = restaurante?.whatsappEnabled === true
  const telefono = restaurante?.telefono?.trim()

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-lg font-medium text-foreground">General</h2>
        <p className="text-sm font-normal text-muted-foreground">
          Información del negocio, tu link y tu identidad visual.
        </p>
      </header>

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
        <AjusteRow
          titulo="Tu tienda"
          oracion={
            username
              ? `piru.app/${username} · diseño ${diseno}`
              : 'Todavía no elegiste el alias de tu link'
          }
          estado={username ? 'configurado' : 'sin-configurar'}
          onAccion={() => setEditor('tienda')}
        />
        <AjusteRow
          titulo="Avisos de pedidos"
          oracion={
            avisosOn
              ? telefono
                ? `Recibís los pedidos nuevos por WhatsApp al ${telefono}`
                : 'Activado, pero falta cargar el número donde recibirlos'
              : 'No recibís avisos de pedidos nuevos por WhatsApp'
          }
          estado={avisosOn ? (telefono ? 'configurado' : 'atencion') : 'sin-configurar'}
          onAccion={() => setEditor('avisos')}
        />
        <AjusteRow
          titulo="Logos"
          oracion={tieneLogo ? 'Logo cargado' : 'Sin logo para el link público'}
          estado={tieneLogo ? 'configurado' : 'atencion'}
          onAccion={() => setEditor('logos')}
        />
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
          <AjusteInput campo="telefono" label="Teléfono" placeholder="Ej: 11 2345 6789" inputMode="tel" />
          <SucursalJustInTime />
        </div>
      </AjusteEditor>

      <AjusteEditor
        open={editor === 'tienda'}
        onOpenChange={(o) => !o && setEditor(null)}
        titulo="Tu tienda"
        descripcion="Tu link público, el diseño del menú y los colores."
      >
        <div className="space-y-6">
          <AjusteInput
            campo="username"
            label="Alias de tu link"
            prefix="piru.app/"
            mono
            transform={(v) => v.toLowerCase().replace(/[^a-z0-9-]/g, '')}
            validate={(v) =>
              !v ? 'El alias no puede quedar vacío' : v.length < 3 ? 'Usá al menos 3 caracteres' : null
            }
          />
          <DisenoSelector />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ColorField campo="colorPrimario" label="Color primario (botones)" fallback="#FF7A00" />
            <ColorField campo="colorSecundario" label="Color secundario (fondos)" fallback="#FFFFFF" />
          </div>
        </div>
      </AjusteEditor>

      <AjusteEditor
        open={editor === 'logos'}
        onOpenChange={(o) => !o && setEditor(null)}
        titulo="Logos"
        descripcion="Se guardan apenas los subís."
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <LogoField which="image" campoLocal="imagenUrl" label="Logo (modo oscuro)" current={restaurante?.imagenUrl ?? null} dark />
          <LogoField which="imageLight" campoLocal="imagenLightUrl" label="Logo (modo claro)" current={restaurante?.imagenLightUrl ?? null} />
        </div>
      </AjusteEditor>

      <AjusteEditor
        open={editor === 'avisos'}
        onOpenChange={(o) => !o && setEditor(null)}
        titulo="Avisos de pedidos"
        descripcion="Recibí un WhatsApp cada vez que entra un pedido nuevo."
      >
        <div className="space-y-5">
          <AvisosToggle />
          {avisosOn && (
            <AjusteInput
              campo="telefono"
              label="Número donde recibís los avisos"
              placeholder="Ej: 11 2345 6789"
              inputMode="tel"
            />
          )}
        </div>
      </AjusteEditor>
    </section>
  )
}

/** Toggle optimista de las notificaciones de pedidos nuevos al local (WhatsApp). */
function AvisosToggle() {
  const { checked, toggle } = useToggleAjuste('whatsappEnabled', restauranteApi.toggleWhatsappEnabled)
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">Avisarme por WhatsApp</p>
        <p className="text-[13px] font-normal text-muted-foreground">
          Te llega un mensaje con el detalle apenas se confirma cada pedido.
        </p>
      </div>
      <Switch checked={checked} onCheckedChange={toggle} />
    </div>
  )
}
