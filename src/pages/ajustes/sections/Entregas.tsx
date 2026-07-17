import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Plus, Loader2, Edit, Store, ArrowLeft, Truck, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { restauranteApi, zonasDeliveryApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { AjusteRow } from '../components/AjusteRow'
import { AjusteEditor } from '../components/AjusteEditor'
import { SucursalDialog } from '../components/SucursalDialog'
import { useToggleAjuste } from '../hooks/useToggleAjuste'
import { useSucursales, type Sucursal } from '../hooks/useSucursales'

// El mapa (Leaflet, ~25KB) se carga solo al entrar a su editor.
const ZonasDeliveryMap = lazy(() => import('@/components/ZonasDeliveryMap'))

type EditorId = 'tipos' | 'sucursales' | null

export default function Entregas() {
  const restaurante = useRestauranteStore((s) => s.restaurante)
  const [editor, setEditor] = useState<EditorId>(null)
  const [zonasOpen, setZonasOpen] = useState(false)
  const { sucursales, loaded: sucLoaded, recargar } = useSucursales()

  const deliveryOn = restaurante?.deliveryEnabled !== false
  const takeawayOn = restaurante?.takeawayEnabled !== false
  const tiposOracion = describirTipos(deliveryOn, takeawayOn)

  const { texto: zonasOracion, estado: zonasEstado } = useZonasResumen()

  const mostrarSucursales = sucLoaded && sucursales.length >= 2

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
        {mostrarSucursales && (
          <AjusteRow
            titulo="Sucursales"
            oracion={`${sucursales.length} sucursales`}
            estado="configurado"
            onAccion={() => setEditor('sucursales')}
          />
        )}
      </div>

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
        <SucursalesLista sucursales={sucursales} onChanged={recargar} />
      </AjusteEditor>

      {/* Zonas: pantalla propia con el mapa lazy */}
      {zonasOpen && <ZonasFullScreen onClose={() => setZonasOpen(false)} />}
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

function SucursalesLista({
  sucursales,
  onChanged,
}: {
  sucursales: Sucursal[]
  onChanged: () => void
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<Sucursal | null>(null)

  const abrir = useCallback((s: Sucursal | null) => {
    setEditando(s)
    setDialogOpen(true)
  }, [])

  return (
    <div className="space-y-4">
      <Button
        variant="outline"
        onClick={() => abrir(null)}
        className="h-11 min-h-[44px] w-full font-medium"
      >
        <Plus className="mr-2 h-4 w-4" /> Nueva sucursal
      </Button>
      <div className="divide-y divide-border">
        {sucursales.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-3 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <Store className={cn('h-5 w-5 shrink-0', s.activo ? 'text-brand' : 'text-muted-foreground')} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {s.nombre}
                  {!s.activo && <span className="font-normal text-muted-foreground"> · inactiva</span>}
                </p>
                {s.direccion && (
                  <p className="truncate text-xs font-normal text-muted-foreground">{s.direccion}</p>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => abrir(s)}>
              <Edit className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <SucursalDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editando={editando}
        onSaved={onChanged}
      />
    </div>
  )
}

/** Pantalla propia (full screen) para el mapa de zonas. */
function ZonasFullScreen({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Button variant="ghost" size="icon" className="h-10 w-10" onClick={onClose}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-base font-medium text-foreground">Zonas de delivery</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <ZonasDeliveryMap />
        </Suspense>
      </div>
    </div>
  )
}
