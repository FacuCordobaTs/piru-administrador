import { DeliveryAddressSettings } from '../components/DeliveryAddressSettings'
import { lazy, Suspense, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Loader2, Truck, Package } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { esSesionDemo, restauranteApi, zonasDeliveryApi, zonasEspecialesApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { AjusteRow } from '../components/AjusteRow'
import { AjusteEditor } from '../components/AjusteEditor'
import { SucursalesLista } from '../components/SucursalesLista'
import { ZonasEspecialesPanel } from '../components/ZonasEspecialesPanel'
import { useToggleAjuste } from '../hooks/useToggleAjuste'
import { useSucursales } from '../hooks/useSucursales'
import { useModuloActivo } from '@/store/modulosStore'

// El mapa (Leaflet, ~25KB) se carga solo al entrar a su editor.
const ZonasDeliveryMap = lazy(() => import('@/components/ZonasDeliveryMap'))

type EditorId = 'tipos' | 'sucursales' | 'zonas-especiales' | null

export default function Entregas() {
  const restaurante = useRestauranteStore((s) => s.restaurante)
  const [editor, setEditor] = useState<EditorId>(null)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [zonasOpen, setZonasOpen] = useState(false)
  const { sucursales, loaded: sucLoaded, recargar } = useSucursales()

  const token = useAuthStore((s) => s.token)
  const esDemo = esSesionDemo(token)
  const deliveryOn = restaurante?.deliveryEnabled !== false
  const takeawayOn = restaurante?.takeawayEnabled !== false
  const tiposOracion = describirTipos(deliveryOn, takeawayOn)

  const { texto: zonasOracion, estado: zonasEstado } = useZonasResumen()

  const mostrarSucursales = sucLoaded && sucursales.filter(s => !s.soloPos).length >= 2
  const multisucursalActiva = useModuloActivo('multisucursal')
  const avisosWhatsappActivos = useModuloActivo('avisos_automaticos_whatsapp')
  const zonasEspecialesHabilitadas = restaurante?.zonasEspecialesHabilitadas === true
  const { texto: zonasEspecialesOracion, estado: zonasEspecialesEstado } = useZonasEspecialesResumen(
    avisosWhatsappActivos && !esDemo && zonasEspecialesHabilitadas,
    editor === null,
  )

  useEffect(() => {
    const config = searchParams.get('config')
    if (config === 'sucursales' && multisucursalActiva) setEditor('sucursales')
    else if (config === 'zonas-especiales' && avisosWhatsappActivos && !esDemo) setEditor('zonas-especiales')
  }, [multisucursalActiva, avisosWhatsappActivos, esDemo, searchParams])

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-lg font-medium text-foreground">Entregas</h2>
        <p className="text-sm font-normal text-muted-foreground">
          Cómo entregás: tipos de pedido, zonas y locales.
        </p>
      </header>

      <div>
        <AjusteRow
          titulo="Tipos de pedido"
          oracion={tiposOracion}
          estado={deliveryOn || takeawayOn ? 'configurado' : 'atencion'}
          onAccion={() => setEditor('tipos')}
        />
        <AjusteRow
          titulo="Zonas de delivery"
          oracion={zonasOracion}
          estado={zonasEstado}
          onAccion={() => setZonasOpen(true)}
        />
        {!esDemo && (
          <AjusteRow
            titulo="Zonas especiales"
            oracion={!avisosWhatsappActivos
              ? 'Activá Avisos automáticos por WhatsApp para habilitar countries y barrios cerrados'
              : !zonasEspecialesHabilitadas
                ? 'Apagado: no se muestra nada de countries en la tienda'
                : zonasEspecialesOracion}
            estado={avisosWhatsappActivos && zonasEspecialesHabilitadas ? zonasEspecialesEstado : 'sin-configurar'}
            accionLabel={!avisosWhatsappActivos
              ? 'Ver WhatsApp'
              : zonasEspecialesHabilitadas && zonasEspecialesEstado === 'configurado'
                ? 'Administrar'
                : 'Configurar'}
            onAccion={() => avisosWhatsappActivos
              ? setEditor('zonas-especiales')
              : navigate('/dashboard/ajustes/whatsapp')}
          />
        )}
        {multisucursalActiva && mostrarSucursales && (
          <AjusteRow
            titulo="Sucursales"
            oracion={`${sucursales.filter(s => !s.soloPos).length} sucursales`}
            estado="configurado"
            onAccion={() => setEditor('sucursales')}
          />
        )}
        {!multisucursalActiva && (
          <AjusteRow
            titulo="Múltiples sucursales"
            oracion="Activá el módulo para administrar más de un local"
            estado="sin-configurar"
            accionLabel="Ver módulos"
            onAccion={() => navigate('/dashboard/modulos')}
          />
        )}
      </div>

      {deliveryOn && <DeliveryAddressSettings />}

      {/* Tipos de pedido */}
      <AjusteEditor
        open={editor === 'tipos'}
        onOpenChange={(o) => !o && setEditor(null)}
        titulo="Tipos de pedido"
        descripcion="Qué formas de entrega ofrecés."
      >
        <TiposEditor />
      </AjusteEditor>

      {/* Sucursales (solo con 2+) */}
      <AjusteEditor
        open={editor === 'sucursales'}
        onOpenChange={(o) => !o && setEditor(null)}
        titulo="Sucursales"
        descripcion="Tus locales y su ruteo de pedidos."
      >
        <SucursalesLista sucursales={sucursales.filter(s => !s.soloPos)} onChanged={recargar} />
      </AjusteEditor>

      {/* Zonas: pantalla propia con el mapa lazy */}
      <AjusteEditor open={zonasOpen} onOpenChange={setZonasOpen} titulo="Zonas de delivery">
        <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
          <ZonasDeliveryMap />
        </Suspense>
      </AjusteEditor>

      <AjusteEditor
        open={editor === 'zonas-especiales' && avisosWhatsappActivos && !esDemo}
        onOpenChange={(o) => !o && setEditor(null)}
        titulo="Zonas especiales"
        descripcion="Countries y barrios cerrados con una ventana horaria de entrega."
      >
        <ZonasEspecialesPanel />
      </AjusteEditor>
    </section>
  )
}

function describirTipos(delivery: boolean, takeaway: boolean): string {
  if (delivery && takeaway) return 'Delivery y takeaway activos'
  if (delivery) return 'Solo delivery activo'
  if (takeaway) return 'Solo takeaway activo'
  return 'Sin tipos de pedido activos'
}

/** Oración de zonas: "{n} zonas, envío desde ${min}". */
function useZonasResumen() {
  const [texto, setTexto] = useState('Cargando…')
  const [estado, setEstado] = useState<'configurado' | 'sin-configurar'>('sin-configurar')

  useEffect(() => {
    const cargar = async () => {
      const token = useAuthStore.getState().token
      if (!token) return
      try {
        const res = (await zonasDeliveryApi.getAll(token)) as {
          success: boolean
          data: Array<{ precio: string }>
        }
        const zonas = res.success ? res.data : []
        if (zonas.length === 0) {
          setTexto('Todavía no definiste zonas de delivery')
          setEstado('sin-configurar')
          return
        }
        const min = Math.min(...zonas.map((z) => parseFloat(z.precio) || 0))
        setTexto(`${zonas.length} ${zonas.length === 1 ? 'zona' : 'zonas'}, envío desde $${min.toLocaleString('es-AR')}`)
        setEstado('configurado')
      } catch {
        setTexto('No se pudieron cargar las zonas')
        setEstado('sin-configurar')
      }
    }
    void cargar()
  }, [])

  return { texto, estado }
}

/** Oración de zonas especiales: "{n} countries, entrega 17:00 a 20:00". */
function useZonasEspecialesResumen(activo: boolean, refrescar: boolean) {
  const [texto, setTexto] = useState('Cargando…')
  const [estado, setEstado] = useState<'configurado' | 'sin-configurar'>('sin-configurar')

  useEffect(() => {
    if (!activo || !refrescar) return
    const cargar = async () => {
      const token = useAuthStore.getState().token
      if (!token) return
      try {
        const res = await zonasEspecialesApi.getAll(token)
        const zonas = res.success ? res.data.filter((zona) => zona.activa) : []
        if (zonas.length === 0) {
          setTexto('Todavía no cargaste countries ni barrios cerrados')
          setEstado('sin-configurar')
          return
        }
        const primera = zonas[0]
        setTexto(`${zonas.length} ${zonas.length === 1 ? 'zona' : 'zonas'}, entrega ${primera.horaInicio.slice(0, 5)} a ${primera.horaFin.slice(0, 5)}`)
        setEstado('configurado')
      } catch {
        setTexto('No se pudieron cargar las zonas especiales')
        setEstado('sin-configurar')
      }
    }
    void cargar()
  }, [activo, refrescar])

  return { texto, estado }
}

function TiposEditor() {
  const delivery = useToggleAjuste('deliveryEnabled', restauranteApi.toggleDeliveryEnabled, {
    defaultOn: true,
  })
  const takeaway = useToggleAjuste('takeawayEnabled', restauranteApi.toggleTakeawayEnabled, {
    defaultOn: true,
  })
  return (
    <div className="space-y-1">
      <ToggleFila
        icon={<Truck className="h-5 w-5 text-muted-foreground" />}
        titulo="Delivery"
        descripcion="Llevás el pedido a domicilio dentro de tus zonas."
        checked={delivery.checked}
        onToggle={delivery.toggle}
      />
      <ToggleFila
        icon={<Package className="h-5 w-5 text-muted-foreground" />}
        titulo="Takeaway"
        descripcion="El cliente retira su pedido en el local."
        checked={takeaway.checked}
        onToggle={takeaway.toggle}
      />
    </div>
  )
}

function ToggleFila({
  icon,
  titulo,
  descripcion,
  checked,
  onToggle,
}: {
  icon: React.ReactNode
  titulo: string
  descripcion: string
  checked: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        {icon}
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{titulo}</p>
          <p className="text-[13px] font-normal text-muted-foreground">{descripcion}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onToggle} />
    </div>
  )
}


