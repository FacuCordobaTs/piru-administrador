import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { restauranteApi } from '@/lib/api'
import { useRestauranteStore } from '@/store/restauranteStore'
import { AjusteRow } from '../components/AjusteRow'
import { AjusteEditor } from '../components/AjusteEditor'
import { AjusteInput } from '../components/AjusteInput'
import { useToggleAjuste } from '../hooks/useToggleAjuste'
import { useAjuste } from '../hooks/useAjuste'
import { usePrinter } from '@/context/PrinterContext'
import {
  DireccionField,
  SucursalJustInTime,
  ColorField,
  LogoField,
  CostoEnvioField,
} from './general/campos'

type EditorId = 'negocio' | 'tienda' | 'envio' | 'logos' | 'avisos' | null

export default function General() {
  const restaurante = useRestauranteStore((s) => s.restaurante)
  const [editor, setEditor] = useState<EditorId>(null)
  const { comandaGrandeMayusculas, setComandaGrandeMayusculas } = usePrinter()

  const nombre = restaurante?.nombre?.trim()
  const dirCorta = restaurante?.direccionTexto?.split(',')[0]?.trim()
  const username = restaurante?.username?.trim()
  const tieneLogo = !!(restaurante?.imagenUrl || restaurante?.imagenLightUrl)
  const avisosOn = restaurante?.whatsappEnabled === true
  const telefono = restaurante?.telefono?.trim()
  const colorUnico = restaurante?.usarColorUnico === true
  const costoEnvioNum = parseFloat(restaurante?.deliveryFee ?? '') || 0

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
              ? `piru.app/${username}`
              : 'Todavía no elegiste el alias de tu link'
          }
          estado={username ? 'configurado' : 'sin-configurar'}
          onAccion={() => setEditor('tienda')}
        />
        <AjusteRow
          titulo="Costo de envío"
          oracion={
            costoEnvioNum > 0
              ? `Cobrás $${costoEnvioNum.toLocaleString('es-AR', { minimumFractionDigits: 0 })} por pedido de delivery`
              : 'Sin costo fijo de envío configurado'
          }
          estado={costoEnvioNum > 0 ? 'configurado' : 'sin-configurar'}
          onAccion={() => setEditor('envio')}
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
        <div className="flex items-center justify-between gap-4 border-b border-border py-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Comandas grandes en mayúsculas</p>
            <p className="mt-0.5 text-[13px] font-normal text-muted-foreground">
              Imprime toda la comanda en mayúsculas y con letras más grandes en este dispositivo.
            </p>
          </div>
          <Switch
            checked={comandaGrandeMayusculas}
            onCheckedChange={setComandaGrandeMayusculas}
            aria-label="Comandas grandes en mayúsculas"
          />
        </div>
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
        descripcion="Tu link público y los colores de tu tienda."
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
          <ModoColorField />
          {colorUnico ? (
            <ColorField campo="colorPrimario" label="Color de botones y detalles" fallback="#FF7A00" />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ColorField campo="colorPrimario" label="Color primario (botones)" fallback="#FF7A00" />
              <ColorField campo="colorSecundario" label="Color secundario (fondos)" fallback="#FFFFFF" />
            </div>
          )}
        </div>
      </AjusteEditor>

      <AjusteEditor
        open={editor === 'envio'}
        onOpenChange={(o) => !o && setEditor(null)}
        titulo="Costo de envío"
        descripcion="Se precarga automáticamente en los pedidos de delivery anotados en el POS."
      >
        <CostoEnvioField />
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

function ModoColorField() {
  const { valor, guardar, status } = useAjuste('usarColorUnico')
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">Usar un solo color</p>
          <span className="text-xs text-muted-foreground">
            {status === 'saving' ? 'Guardando…' : status === 'saved' ? 'Guardado' : ''}
          </span>
        </div>
        <p className="text-[13px] font-normal text-muted-foreground">
          Se aplica a botones y detalles; los fondos y textos siguen en blanco y negro.
        </p>
      </div>
      <Switch checked={valor === true} onCheckedChange={(checked) => void guardar(checked)} />
    </div>
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
