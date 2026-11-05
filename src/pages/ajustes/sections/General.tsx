import { useEffect, useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { restauranteApi, zonasDeliveryApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { AjusteRow } from '../components/AjusteRow'
import { AjusteEditor } from '../components/AjusteEditor'
import { AjusteInput } from '../components/AjusteInput'
import { useToggleAjuste } from '../hooks/useToggleAjuste'
import { esAndroid, pedirExcepcionDeBateria } from '@/utils/piruAndroid'
import {
  DireccionField,
  SucursalJustInTime,
  CostoEnvioField,
} from './general/campos'

type EditorId = 'negocio' | 'envio' | 'avisos' | null

export default function General() {
  const restaurante = useRestauranteStore((s) => s.restaurante)
  const token = useAuthStore((s) => s.token)
  const [editor, setEditor] = useState<EditorId>(null)
  // Con zonas de delivery cargadas el envío se cobra por zona: el costo fijo
  // queda escondido para no ofrecer dos configuraciones contradictorias.
  const [hayZonas, setHayZonas] = useState<boolean | null>(null)

  const nombre = restaurante?.nombre?.trim()
  const direccion = restaurante?.direccionTexto?.trim() || restaurante?.direccion?.trim() || ''
  const dirCorta = direccion.split(',')[0]?.trim()
  const avisosOn = restaurante?.whatsappEnabled === true
  const telefono = restaurante?.telefono?.trim()
  const costoEnvioNum = parseFloat(restaurante?.deliveryFee ?? '') || 0

  useEffect(() => {
    if (!token) return
    let cancelado = false
    zonasDeliveryApi
      .getAll(token)
      .then((res: unknown) => {
        if (cancelado) return
        const respuesta = res as { success?: boolean; data?: unknown[] }
        const zonas = respuesta.success ? respuesta.data ?? [] : []
        setHayZonas(zonas.length > 0)
      })
      .catch(() => {
        if (!cancelado) setHayZonas(false)
      })
    return () => { cancelado = true }
  }, [token])

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-lg font-medium text-foreground">General</h2>
        <p className="text-sm font-normal text-muted-foreground">
          Información del negocio y cómo recibís los pedidos.
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
        {hayZonas === false && (
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
        )}
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
        {esAndroid() && <AjusteBateriaAndroid />}
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
        open={editor === 'envio'}
        onOpenChange={(o) => !o && setEditor(null)}
        titulo="Costo de envío"
        descripcion="Se precarga automáticamente en los pedidos de delivery anotados en el POS."
      >
        <CostoEnvioField />
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
