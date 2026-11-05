import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { CircleMarker, MapContainer, Marker, Polygon, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { toast } from 'sonner'
import { ArrowLeft, Check, Loader2, MapPin, Pencil, Plus, Trash2, Undo2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { sucursalesApi, zonasDeliveryApi } from '@/lib/api'
import { ConfirmDialog } from '../components/ConfirmDialog'

interface Coordenada { lat: number; lng: number }

interface ZonaDelivery {
  id: number
  nombre: string
  precio: string
  poligono: Coordenada[]
  color: string | null
  sucursalId: number | null
}

interface Sucursal { id: number; nombre: string; activo: boolean; soloPos?: boolean }

/** Zona abierta en el panel: una existente (con `id`) o una recién dibujada. */
interface Borrador {
  id: number | null
  nombre: string
  precio: string
  color: string
  sucursalId: number | null
  poligono: Coordenada[]
}

type Modo =
  | { tipo: 'lista' }
  | { tipo: 'dibujando'; puntos: Coordenada[] }
  | { tipo: 'zona'; borrador: Borrador; original: Borrador | null; forma: boolean; historial: Coordenada[][] }

const COLORES = ['#FF7A00', '#3b82f6', '#ef4444', '#22c55e', '#8b5cf6', '#ec4899', '#06b6d4', '#eab308']
const CENTRO_POR_DEFECTO: [number, number] = [-31.6333, -60.7]
const VOLVER_A = '/dashboard/ajustes/entregas'

function siguienteColor(zonas: ZonaDelivery[]) {
  const usados = new Set(zonas.map(z => z.color))
  return COLORES.find(c => !usados.has(c)) ?? COLORES[zonas.length % COLORES.length]
}

function aBorrador(zona: ZonaDelivery): Borrador {
  return {
    id: zona.id,
    nombre: zona.nombre,
    precio: String(parseFloat(zona.precio) || 0),
    color: zona.color || COLORES[1],
    sucursalId: zona.sucursalId ?? null,
    poligono: Array.isArray(zona.poligono) ? zona.poligono : [],
  }
}

const aLatLng = (c: Coordenada) => [c.lat, c.lng] as [number, number]
const formatoPrecio = (precio: string) => `$${(parseFloat(precio) || 0).toLocaleString('es-AR')}`

function mismaZona(a: Borrador, b: Borrador | null) {
  return !!b && a.nombre === b.nombre && a.precio === b.precio && a.color === b.color
    && a.sucursalId === b.sucursalId && JSON.stringify(a.poligono) === JSON.stringify(b.poligono)
}

/** Pantalla completa para dibujar y editar las zonas de reparto; pensada primero para el celular. */
export default function ZonasDeliveryPage() {
  const navigate = useNavigate()
  const token = useAuthStore(s => s.token)
  const restaurante = useRestauranteStore(s => s.restaurante)
  const [zonas, setZonas] = useState<ZonaDelivery[]>([])
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [modo, setModo] = useState<Modo>({ tipo: 'lista' })
  const [confirmarBorrar, setConfirmarBorrar] = useState(false)
  const [confirmarDescartar, setConfirmarDescartar] = useState<null | (() => void)>(null)
  const [encuadre, setEncuadre] = useState<{ puntos: Coordenada[]; n: number } | null>(null)

  const centro = useMemo<[number, number]>(() => {
    const lat = parseFloat(restaurante?.direccionLat ?? '')
    const lng = parseFloat(restaurante?.direccionLng ?? '')
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : CENTRO_POR_DEFECTO
  }, [restaurante?.direccionLat, restaurante?.direccionLng])

  const encuadrar = useCallback((puntos: Coordenada[]) => {
    if (puntos.length > 0) setEncuadre(prev => ({ puntos, n: (prev?.n ?? 0) + 1 }))
  }, [])

  useEffect(() => {
    if (!token) return
    let cancelado = false
    zonasDeliveryApi.getAll(token)
      .then((res) => {
        const r = res as { success: boolean; data: ZonaDelivery[] }
        if (cancelado || !r.success) return
        setZonas(r.data)
        encuadrar(r.data.flatMap(z => z.poligono ?? []))
      })
      .catch(() => toast.error('No se pudieron cargar las zonas'))
      .finally(() => { if (!cancelado) setCargando(false) })
    sucursalesApi.list(token)
      .then((res) => {
        const r = res as { success: boolean; data: Sucursal[] }
        if (!cancelado && r.success) setSucursales(r.data.filter(s => s.activo && !s.soloPos))
      })
      .catch(() => { /* sin sucursales no se muestra el selector */ })
    return () => { cancelado = true }
  }, [token, encuadrar])

  const hayCambios = (modo.tipo === 'dibujando' && modo.puntos.length > 0)
    || (modo.tipo === 'zona' && !mismaZona(modo.borrador, modo.original))

  /** Ejecuta `accion` pidiendo confirmación si se perdería algo sin guardar. */
  const salirDelModo = (accion: () => void) => {
    if (hayCambios) setConfirmarDescartar(() => accion)
    else accion()
  }

  const volver = () => {
    if (modo.tipo !== 'lista') salirDelModo(() => setModo({ tipo: 'lista' }))
    else navigate(VOLVER_A)
  }

  const abrirZona = (zona: ZonaDelivery) => {
    const borrador = aBorrador(zona)
    setModo({ tipo: 'zona', borrador, original: borrador, forma: false, historial: [] })
    encuadrar(borrador.poligono)
  }

  const terminarDibujo = (puntos: Coordenada[]) => {
    if (puntos.length < 3) return
    const borrador: Borrador = { id: null, nombre: '', precio: '', color: siguienteColor(zonas), sucursalId: null, poligono: puntos }
    setModo({ tipo: 'zona', borrador, original: null, forma: false, historial: [] })
  }

  const editarBorrador = (cambios: Partial<Borrador>) => {
    setModo(m => m.tipo === 'zona' ? { ...m, borrador: { ...m.borrador, ...cambios } } : m)
  }

  const moverForma = (poligono: Coordenada[]) => {
    setModo(m => m.tipo === 'zona' ? { ...m, historial: [...m.historial, m.borrador.poligono], borrador: { ...m.borrador, poligono } } : m)
  }

  const deshacerForma = () => {
    setModo(m => m.tipo === 'zona' && m.historial.length > 0
      ? { ...m, borrador: { ...m.borrador, poligono: m.historial.at(-1)! }, historial: m.historial.slice(0, -1) }
      : m)
  }

  const guardar = async () => {
    if (!token || modo.tipo !== 'zona') return
    const { borrador, original } = modo
    const precio = Number(borrador.precio.replace(',', '.'))
    if (!borrador.nombre.trim()) return toast.error('Poné un nombre a la zona')
    if (!borrador.precio.trim() || !Number.isFinite(precio) || precio < 0) return toast.error('Ingresá un costo de envío válido')
    if (borrador.poligono.length < 3) return toast.error('La zona necesita al menos 3 puntos')

    const datos = {
      nombre: borrador.nombre.trim(),
      precio: precio.toFixed(2),
      color: borrador.color,
      sucursalId: borrador.sucursalId,
    }
    setGuardando(true)
    try {
      if (borrador.id != null) {
        const cambioForma = JSON.stringify(borrador.poligono) !== JSON.stringify(original?.poligono)
        const res = await zonasDeliveryApi.update(token, borrador.id, { ...datos, ...(cambioForma ? { poligono: borrador.poligono } : {}) }) as { success: boolean; data: ZonaDelivery }
        if (!res.success) throw new Error()
        setZonas(prev => prev.map(z => z.id === borrador.id ? res.data : z))
        toast.success('Zona guardada')
      } else {
        const res = await zonasDeliveryApi.create(token, { ...datos, poligono: borrador.poligono }) as { success: boolean; data: ZonaDelivery }
        if (!res.success) throw new Error()
        setZonas(prev => [...prev, res.data])
        toast.success('Zona creada')
      }
      setModo({ tipo: 'lista' })
    } catch {
      toast.error('No se pudo guardar la zona')
    } finally {
      setGuardando(false)
    }
  }

  const borrar = async () => {
    if (!token || modo.tipo !== 'zona' || modo.borrador.id == null) return
    const id = modo.borrador.id
    try {
      const res = await zonasDeliveryApi.delete(token, id) as { success: boolean }
      if (!res.success) throw new Error()
      setZonas(prev => prev.filter(z => z.id !== id))
      setModo({ tipo: 'lista' })
      toast.success('Zona eliminada')
    } catch {
      toast.error('No se pudo eliminar la zona')
    }
  }

  const zonaAbiertaId = modo.tipo === 'zona' ? modo.borrador.id : null
  const titulo = modo.tipo === 'dibujando' ? 'Nueva zona'
    : modo.tipo === 'zona' ? (modo.borrador.id == null ? 'Nueva zona' : modo.original?.nombre || 'Zona')
      : 'Zonas de delivery'

  return (
    <div className="fixed inset-0 z-40 flex h-dvh flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-2 md:px-4">
        <Button variant="ghost" size="icon" className="size-11" onClick={volver} aria-label="Volver">
          <ArrowLeft className="size-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold text-foreground">{titulo}</h1>
          {modo.tipo === 'lista' && !cargando && (
            <p className="truncate text-xs text-muted-foreground">
              {zonas.length === 0 ? 'Sin zonas todavía' : `${zonas.length} ${zonas.length === 1 ? 'zona' : 'zonas'}`}
            </p>
          )}
        </div>
        {modo.tipo === 'lista' && (
          <Button onClick={() => setModo({ tipo: 'dibujando', puntos: [] })} className="h-10 gap-1.5 rounded-full bg-brand px-4 text-white hover:bg-brand/90">
            <Plus className="size-4" />Nueva zona
          </Button>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row-reverse">
        <div className="relative min-h-0 flex-1 bg-muted">
          <MapContainer center={centro} zoom={13} zoomControl={false} className="size-full" style={{ zIndex: 0 }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <AjustarTamano />
            <Encuadre encuadre={encuadre} />
            {zonas.map(zona => zona.id === zonaAbiertaId ? null : (
              <Polygon
                key={zona.id}
                positions={(zona.poligono ?? []).map(aLatLng)}
                pathOptions={{
                  color: zona.color || COLORES[1],
                  fillOpacity: modo.tipo === 'lista' ? 0.25 : 0.1,
                  opacity: modo.tipo === 'lista' ? 1 : 0.5,
                  weight: 2,
                }}
                eventHandlers={modo.tipo === 'lista' ? { click: () => abrirZona(zona) } : {}}
              />
            ))}
            {modo.tipo === 'dibujando' && (
              <Dibujo puntos={modo.puntos} onAgregar={p => setModo({ tipo: 'dibujando', puntos: [...modo.puntos, p] })} onCerrar={() => terminarDibujo(modo.puntos)} />
            )}
            {modo.tipo === 'zona' && (
              <ZonaEnEdicion borrador={modo.borrador} editable={modo.forma} onCambiar={moverForma} />
            )}
          </MapContainer>

          {modo.tipo === 'dibujando' && (
            <BarraDibujo
              puntos={modo.puntos.length}
              onDeshacer={() => setModo({ tipo: 'dibujando', puntos: modo.puntos.slice(0, -1) })}
              onCancelar={() => salirDelModo(() => setModo({ tipo: 'lista' }))}
              onTerminar={() => terminarDibujo(modo.puntos)}
            />
          )}
          {modo.tipo === 'zona' && modo.forma && (
            <div className="pointer-events-none absolute inset-x-0 top-3 z-[1000] flex justify-center px-3">
              <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-background/95 p-1 pl-4 shadow-lg backdrop-blur">
                <span className="text-xs text-muted-foreground">Arrastrá los puntos</span>
                <Button variant="ghost" size="icon" className="size-10 rounded-full" disabled={modo.historial.length === 0} onClick={deshacerForma} aria-label="Deshacer">
                  <Undo2 className="size-4" />
                </Button>
                <Button size="sm" className="h-10 rounded-full px-4" onClick={() => setModo({ ...modo, forma: false })}>
                  <Check className="size-4" />Listo
                </Button>
              </div>
            </div>
          )}
          {cargando && (
            <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-background/40">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        {modo.tipo !== 'dibujando' && !(modo.tipo === 'zona' && modo.forma) && (
          <aside className="flex max-h-[48dvh] shrink-0 flex-col overflow-hidden rounded-t-3xl border-t border-border bg-background shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.15)] md:max-h-none md:w-96 md:rounded-none md:border-r md:border-t-0 md:shadow-none">
            <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border md:hidden" aria-hidden />
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {modo.tipo === 'lista' ? (
                <ListaZonas zonas={zonas} sucursales={sucursales} cargando={cargando} onAbrir={abrirZona} onNueva={() => setModo({ tipo: 'dibujando', puntos: [] })} />
              ) : (
                <FormularioZona
                  borrador={modo.borrador}
                  sucursales={sucursales}
                  guardando={guardando}
                  onCambiar={editarBorrador}
                  onEditarForma={() => setModo({ ...modo, forma: true })}
                  onBorrar={modo.borrador.id != null ? () => setConfirmarBorrar(true) : undefined}
                  onCancelar={() => salirDelModo(() => setModo({ tipo: 'lista' }))}
                  onGuardar={() => void guardar()}
                />
              )}
            </div>
          </aside>
        )}
      </div>

      <ConfirmDialog
        open={confirmarBorrar}
        onOpenChange={setConfirmarBorrar}
        titulo="¿Eliminar esta zona?"
        descripcion="Los clientes de esta área ya no van a poder pedir delivery, salvo que esté cubierta por otra zona."
        confirmLabel="Eliminar"
        destructivo
        onConfirm={borrar}
      />
      <ConfirmDialog
        open={confirmarDescartar !== null}
        onOpenChange={(o) => !o && setConfirmarDescartar(null)}
        titulo="¿Descartar los cambios?"
        descripcion="Lo que cambiaste en esta zona no se guardó."
        confirmLabel="Descartar"
        destructivo
        onConfirm={() => { confirmarDescartar?.(); setConfirmarDescartar(null) }}
      />
    </div>
  )
}

function ListaZonas({ zonas, sucursales, cargando, onAbrir, onNueva }: {
  zonas: ZonaDelivery[]
  sucursales: Sucursal[]
  cargando: boolean
  onAbrir: (zona: ZonaDelivery) => void
  onNueva: () => void
}) {
  if (cargando) return null
  if (zonas.length === 0) {
    return (
      <div className="flex flex-col items-center px-4 py-6 text-center">
        <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-brand/10 text-brand"><MapPin className="size-6" /></span>
        <h2 className="font-semibold text-foreground">Dibujá tu primera zona</h2>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">Marcá en el mapa hasta dónde llevás pedidos y cuánto cobrás el envío.</p>
        <Button onClick={onNueva} className="mt-4 h-11 gap-1.5 rounded-full bg-brand px-5 text-white hover:bg-brand/90">
          <Plus className="size-4" />Nueva zona
        </Button>
      </div>
    )
  }
  const nombreSucursal = (id: number | null) => sucursales.length > 1 && id != null ? sucursales.find(s => s.id === id)?.nombre : undefined
  return (
    <div>
      <p className="mb-2 px-1 text-xs text-muted-foreground">Tocá una zona, en la lista o en el mapa, para editarla.</p>
      <ul className="divide-y divide-border">
        {zonas.map(zona => (
          <li key={zona.id}>
            <button type="button" onClick={() => onAbrir(zona)} className="flex min-h-14 w-full items-center gap-3 rounded-xl px-1 py-2 text-left transition-colors hover:bg-muted">
              <span className="size-4 shrink-0 rounded-md" style={{ backgroundColor: zona.color || COLORES[1] }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{zona.nombre}</span>
                {nombreSucursal(zona.sucursalId) && <span className="block truncate text-xs text-muted-foreground">{nombreSucursal(zona.sucursalId)}</span>}
              </span>
              <span className="text-sm font-semibold tabular-nums text-foreground">{formatoPrecio(zona.precio)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function FormularioZona({ borrador, sucursales, guardando, onCambiar, onEditarForma, onBorrar, onCancelar, onGuardar }: {
  borrador: Borrador
  sucursales: Sucursal[]
  guardando: boolean
  onCambiar: (cambios: Partial<Borrador>) => void
  onEditarForma: () => void
  onBorrar?: () => void
  onCancelar: () => void
  onGuardar: () => void
}) {
  return (
    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); onGuardar() }}>
      <div className="grid grid-cols-[1fr_8rem] gap-3">
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-foreground">Nombre</span>
          <Input value={borrador.nombre} onChange={e => onCambiar({ nombre: e.target.value })} placeholder="Ej: Centro" className="h-11 text-base" autoFocus={borrador.id == null} />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-foreground">Envío</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
            <Input
              value={borrador.precio}
              onChange={e => onCambiar({ precio: e.target.value.replace(/[^\d.,]/g, '') })}
              inputMode="decimal"
              placeholder="0"
              className="h-11 pl-7 text-base tabular-nums"
            />
          </div>
        </label>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-foreground">Color en el mapa</legend>
        <div className="flex flex-wrap gap-2">
          {COLORES.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => onCambiar({ color: c })}
              aria-label={`Color ${c}`}
              aria-pressed={borrador.color === c}
              className={cn('size-9 rounded-full ring-offset-2 ring-offset-background transition', borrador.color === c && 'ring-2 ring-foreground')}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </fieldset>

      {sucursales.length > 1 && (
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-foreground">Sucursal que entrega</span>
          <select
            value={borrador.sucursalId ?? ''}
            onChange={e => onCambiar({ sucursalId: e.target.value ? Number(e.target.value) : null })}
            className="h-11 w-full rounded-md border border-input bg-background px-3 text-base"
          >
            <option value="">Cualquiera (sin asignar)</option>
            {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </label>
      )}

      <Button type="button" variant="outline" onClick={onEditarForma} className="h-11 w-full gap-2">
        <Pencil className="size-4" />Cambiar la forma en el mapa
      </Button>

      <div className="flex items-center gap-2 border-t border-border pt-4">
        {onBorrar && (
          <Button type="button" variant="ghost" size="icon" onClick={onBorrar} className="size-11 text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label="Eliminar zona">
            <Trash2 className="size-5" />
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={onCancelar} className="h-11 flex-1">Cancelar</Button>
        <Button type="submit" disabled={guardando} className="h-11 flex-1 bg-brand text-white hover:bg-brand/90">
          {guardando && <Loader2 className="size-4 animate-spin" />}
          {borrador.id == null ? 'Crear zona' : 'Guardar'}
        </Button>
      </div>
    </form>
  )
}

function BarraDibujo({ puntos, onDeshacer, onCancelar, onTerminar }: {
  puntos: number
  onDeshacer: () => void
  onCancelar: () => void
  onTerminar: () => void
}) {
  const ayuda = puntos === 0 ? 'Tocá el mapa para marcar el primer punto del borde'
    : puntos < 3 ? `Seguí marcando el borde (faltan ${3 - puntos})`
      : 'Seguí marcando o terminá la zona'
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-3 z-[1000] flex justify-center px-3">
        <p className="rounded-full bg-foreground/90 px-4 py-2 text-center text-sm text-background shadow-lg">{ayuda}</p>
      </div>
      <div className="absolute inset-x-0 bottom-0 z-[1000] flex gap-2 border-t border-border bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:inset-x-auto md:bottom-4 md:left-1/2 md:-translate-x-1/2 md:rounded-full md:border md:p-1.5 md:shadow-lg">
        <Button variant="ghost" onClick={onCancelar} className="h-12 gap-1.5 md:h-10 md:rounded-full"><X className="size-4" />Cancelar</Button>
        <Button variant="outline" onClick={onDeshacer} disabled={puntos === 0} className="h-12 gap-1.5 md:h-10 md:rounded-full"><Undo2 className="size-4" />Deshacer</Button>
        <Button onClick={onTerminar} disabled={puntos < 3} className="h-12 flex-1 gap-1.5 bg-brand text-white hover:bg-brand/90 md:h-10 md:flex-none md:rounded-full md:px-5">
          <Check className="size-4" />Terminar
        </Button>
      </div>
    </>
  )
}

// ── Piezas del mapa ─────────────────────────────────────────

/** Leaflet no se entera solo de que el contenedor cambió (el panel aparece y desaparece). */
function AjustarTamano() {
  const map = useMap()
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map])
  return null
}

function Encuadre({ encuadre }: { encuadre: { puntos: Coordenada[]; n: number } | null }) {
  const map = useMap()
  useEffect(() => {
    if (!encuadre) return
    // Espera a que el panel termine de acomodarse para encuadrar sobre el tamaño final.
    const t = setTimeout(() => {
      map.invalidateSize()
      map.fitBounds(L.latLngBounds(encuadre.puntos.map(aLatLng)), { padding: [32, 32], maxZoom: 16 })
    }, 60)
    return () => clearTimeout(t)
  }, [encuadre, map])
  return null
}

const iconoVertice = L.divIcon({
  className: '',
  html: '<span style="display:block;width:22px;height:22px;border-radius:9999px;background:#fff;border:3px solid currentColor;box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
})

const iconoMedio = L.divIcon({
  className: '',
  html: '<span style="display:block;width:16px;height:16px;border-radius:9999px;background:rgba(255,255,255,.85);border:2px dashed currentColor"></span>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

/** Dibujo por toques: cada toque agrega un punto; tocar el primero (con 3 o más) cierra la zona. */
function Dibujo({ puntos, onAgregar, onCerrar }: { puntos: Coordenada[]; onAgregar: (p: Coordenada) => void; onCerrar: () => void }) {
  const map = useMap()
  useEffect(() => {
    map.doubleClickZoom.disable()
    map.getContainer().style.cursor = 'crosshair'
    return () => {
      map.doubleClickZoom.enable()
      map.getContainer().style.cursor = ''
    }
  }, [map])
  useMapEvents({ click: (e) => onAgregar({ lat: e.latlng.lat, lng: e.latlng.lng }) })

  return (
    <>
      {puntos.length >= 3 && <Polygon positions={puntos.map(aLatLng)} pathOptions={{ color: '#FF7A00', weight: 0, fillOpacity: 0.15 }} interactive={false} />}
      {puntos.length >= 2 && <Polyline positions={puntos.map(aLatLng)} pathOptions={{ color: '#FF7A00', weight: 3, dashArray: '6 6' }} interactive={false} />}
      {puntos.map((p, i) => (
        <CircleMarker
          key={i}
          center={aLatLng(p)}
          radius={i === 0 && puntos.length >= 3 ? 11 : 7}
          pathOptions={{ color: '#FF7A00', fillColor: '#fff', fillOpacity: 1, weight: 3 }}
          eventHandlers={i === 0 && puntos.length >= 3 ? { click: (e) => { L.DomEvent.stopPropagation(e); onCerrar() } } : {}}
        />
      ))}
    </>
  )
}

/** Zona abierta: con `editable`, cada punto se arrastra y los puntos intermedios agregan uno nuevo. */
function ZonaEnEdicion({ borrador, editable, onCambiar }: { borrador: Borrador; editable: boolean; onCambiar: (p: Coordenada[]) => void }) {
  const [arrastre, setArrastre] = useState<Coordenada[] | null>(null)
  const poligono = arrastre ?? borrador.poligono

  const medios = poligono.map((p, i) => {
    const q = poligono[(i + 1) % poligono.length]
    return { lat: (p.lat + q.lat) / 2, lng: (p.lng + q.lng) / 2 }
  })

  const conPunto = (i: number, latlng: L.LatLng) =>
    borrador.poligono.map((p, j) => j === i ? { lat: latlng.lat, lng: latlng.lng } : p)
  const mover = (i: number, latlng: L.LatLng) => setArrastre(conPunto(i, latlng))
  const soltar = (i: number, latlng: L.LatLng) => {
    onCambiar(conPunto(i, latlng))
    setArrastre(null)
  }
  const insertar = (i: number, latlng: L.LatLng) => {
    const nuevo = [...borrador.poligono]
    nuevo.splice(i + 1, 0, { lat: latlng.lat, lng: latlng.lng })
    onCambiar(nuevo)
  }

  return (
    <>
      <Polygon positions={poligono.map(aLatLng)} pathOptions={{ color: borrador.color, fillOpacity: 0.3, weight: 3 }} interactive={false} />
      {editable && medios.map((m, i) => (
        <Marker
          key={`m${i}-${poligono.length}`}
          position={aLatLng(m)}
          icon={iconoMedio}
          eventHandlers={{ click: (e) => insertar(i, e.latlng) }}
          // El color de los íconos sale de `currentColor`.
          ref={(mk) => { const el = mk?.getElement(); if (el) el.style.color = borrador.color }}
        />
      ))}
      {editable && poligono.map((p, i) => (
        <Marker
          key={`v${i}-${poligono.length}`}
          position={aLatLng(p)}
          icon={iconoVertice}
          draggable
          eventHandlers={{ drag: (e) => mover(i, (e.target as L.Marker).getLatLng()), dragend: (e) => soltar(i, (e.target as L.Marker).getLatLng()) }}
          ref={(mk) => { const el = mk?.getElement(); if (el) el.style.color = borrador.color }}
        />
      ))}
    </>
  )
}
