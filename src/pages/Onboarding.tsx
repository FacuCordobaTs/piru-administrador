import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router'
import { MapContainer, TileLayer, Circle, CircleMarker, Polygon, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'
import 'leaflet-draw'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ArrowRight, ArrowLeft, Check, Camera, FileText, Link2,
  Clock, Plus, Trash2, MapPin, Sparkles, Loader2, Copy,
  Banknote, ArrowDownToLine, Store, Utensils, Target, PencilRuler, Save, X,
  ImagePlus, Lock, RefreshCw, Pencil
} from 'lucide-react'
import { cn } from '@/lib/utils'
import ImageUpload from '@/components/ImageUpload'
import { toast } from 'sonner'
import { onboardingApi, productosApi, pedidoUnificadoApi, zonasDeliveryApi, cartaIaApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { AddressAutocomplete } from '@/components/AddressAutocomplete'
import { TiendaPreview } from '@/components/TiendaPreview'

const MP_APP_ID = 38638191854826
const MP_REDIRECT_URI = import.meta.env.VITE_MP_REDIRECT_URI || 'https://api.piru.app/api/mp/callback'

// ── Fases del onboarding. No se muestran como "pasos"; sólo alimentan la barra de progreso ──
// La lectura de la carta con IA (lenta) corre en segundo plano desde 'creando'; mientras tanto
// el usuario avanza por 'preparativos' (logo/horarios) y 'entrega' (delivery/pago). Recién en
// 'revision' se confirman los productos ya detectados.
const PHASES = ['nombre', 'ownership', 'carta', 'creando', 'preparativos', 'entrega', 'revision', 'prueba', 'final'] as const
type Phase = typeof PHASES[number]
const phaseIndex = (p: Phase) => PHASES.indexOf(p)

// Convierte la dirección en un slug de URL: sin espacios, minúsculas, sin símbolos raros
const toSlug = (v: string) =>
  (v || '').toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // saca acentos
    .replace(/[^a-z0-9]+/g, '')                        // saca todo lo no alfanumérico (incluye espacios)

// Redimensiona una imagen a un máximo de MAX_DIM px por lado y la exporta como JPEG.
// Reduce el peso del payload que va a la IA sin perder legibilidad de la carta.
async function fileToResizedDataUrl(file: File, maxDim = 1600, quality = 0.82): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = dataUrl
  })
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', quality)
}

// Menú ficticio que "detecta la IA" (simulado). Al confirmar se crean como productos reales.
const MENU_SIMULADO = [
  { nombre: 'Hamburguesa Clásica', descripcion: 'Carne, cheddar, lechuga, tomate y salsa de la casa', precio: 7200, ambiguo: '¿Viene con papas?' },
  { nombre: 'Doble Bacon', descripcion: 'Doble carne, doble cheddar y bacon crocante', precio: 8900, ambiguo: null },
  { nombre: 'Papas Fritas', descripcion: 'Porción abundante con cheddar y verdeo', precio: 3800, ambiguo: null },
  { nombre: 'Coca-Cola 500ml', descripcion: 'Gaseosa línea Coca-Cola bien fría', precio: 1800, ambiguo: null },
]

// ── Círculo → polígono, para guardar el radio como zona de delivery ──
function circleToPolygon(center: { lat: number; lng: number }, radiusMeters: number, points = 36) {
  const coords: { lat: number; lng: number }[] = []
  const R = 6378137
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * 2 * Math.PI
    const dx = radiusMeters * Math.cos(angle)
    const dy = radiusMeters * Math.sin(angle)
    const dLat = (dy / R) * (180 / Math.PI)
    const dLng = (dx / (R * Math.cos((center.lat * Math.PI) / 180))) * (180 / Math.PI)
    coords.push({ lat: center.lat + dLat, lng: center.lng + dLng })
  }
  return coords
}

function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center)
    const t = setTimeout(() => map.invalidateSize(), 200)
    return () => clearTimeout(t)
  }, [center, map])
  return null
}

// ── Fix clásico de Leaflet: recalcula el tamaño del mapa al montar/cambiar layout ──
function MapResizer({ dep }: { dep?: unknown }) {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 250)
    return () => clearTimeout(t)
  }, [dep, map])
  return null
}

// ── Paleta de colores para las zonas dibujadas ──
const ZONE_COLORS = ['#FF7A00', '#3b82f6', '#ef4444', '#22c55e', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']
function getNextColor(usados: (string | null)[]): string {
  const disponibles = ZONE_COLORS.filter(c => !usados.includes(c))
  return disponibles.length > 0 ? disponibles[0] : ZONE_COLORS[usados.length % ZONE_COLORS.length]
}

// ── Control de dibujo de polígonos (leaflet-draw). Al terminar un polígono emite sus vértices ──
function DrawControl({ onPolygonCreated }: { onPolygonCreated: (coords: { lat: number; lng: number }[]) => void }) {
  const map = useMap()
  useEffect(() => {
    const drawnItems = new L.FeatureGroup()
    map.addLayer(drawnItems)

    const drawControl = new L.Control.Draw({
      draw: {
        polygon: {
          allowIntersection: true,
          showArea: true,
          shapeOptions: { color: '#FF7A00', weight: 2, fillOpacity: 0.15 },
        },
        polyline: false, rectangle: false, circle: false, marker: false, circlemarker: false,
      },
      edit: { featureGroup: drawnItems, remove: false, edit: false },
    })
    map.addControl(drawControl)

    const handler = (event: any) => {
      const latLngs = event.layer.getLatLngs()[0] as L.LatLng[]
      onPolygonCreated(latLngs.map((ll) => ({ lat: ll.lat, lng: ll.lng })))
    }
    map.on(L.Draw.Event.CREATED, handler)

    return () => {
      map.off(L.Draw.Event.CREATED, handler)
      map.removeControl(drawControl)
      map.removeLayer(drawnItems)
    }
  }, [map, onPolygonCreated])
  return null
}

function FitBounds({ zonas }: { zonas: { poligono: { lat: number; lng: number }[] }[] }) {
  const map = useMap()
  useEffect(() => {
    const coords: L.LatLngExpression[] = []
    zonas.forEach(z => Array.isArray(z.poligono) && z.poligono.forEach(c => coords.push([c.lat, c.lng])))
    if (coords.length > 0) map.fitBounds(L.latLngBounds(coords), { padding: [30, 30] })
  }, [zonas, map])
  return null
}

type ZonaLite = { id: number; nombre: string; precio: string; poligono: { lat: number; lng: number }[]; color: string | null }

// ── Sección de dibujo de áreas de delivery. Cada zona se guarda en vivo contra el backend
//    (el restaurante ya existe en esta etapa del onboarding), igual que en ZonasDeliveryMap ──
function DrawZonasSection({ token, center }: { token: string | null; center: [number, number] }) {
  const [zonas, setZonas] = useState<ZonaLite[]>([])
  const [pending, setPending] = useState<{ lat: number; lng: number }[] | null>(null)
  const [nombre, setNombre] = useState('')
  const [precio, setPrecio] = useState('')
  const [color, setColor] = useState('#FF7A00')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!token) return
    zonasDeliveryApi.getAll(token)
      .then((res: any) => { if (res?.success) setZonas(res.data) })
      .catch(() => { /* ignore */ })
  }, [token])

  const onPolygonCreated = (coords: { lat: number; lng: number }[]) => {
    setColor(getNextColor(zonas.map(z => z.color)))
    setNombre('')
    setPrecio('')
    setPending(coords)
  }

  const cancelPending = () => { setPending(null); setNombre(''); setPrecio('') }

  const guardar = async () => {
    if (!token || !pending) return
    if (!nombre.trim()) return toast.error('Poné un nombre a la zona')
    if (!precio.trim()) return toast.error('Poné el precio del envío')
    setSaving(true)
    try {
      const res = await zonasDeliveryApi.create(token, {
        nombre: nombre.trim(), precio, poligono: pending, color,
      }) as { success: boolean; data: ZonaLite }
      if (res.success) {
        setZonas(prev => [...prev, res.data])
        cancelPending()
        toast.success('Zona agregada')
      }
    } catch { toast.error('No se pudo guardar la zona') }
    finally { setSaving(false) }
  }

  const eliminar = async (id: number) => {
    if (!token) return
    try {
      const res = await zonasDeliveryApi.delete(token, id) as { success: boolean }
      if (res.success) setZonas(prev => prev.filter(z => z.id !== id))
    } catch { toast.error('No se pudo eliminar la zona') }
  }

  return (
    <div>
      <div className="rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 h-72 relative">
        <MapContainer center={center} zoom={14} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapResizer dep={pending} />
          <DrawControl onPolygonCreated={onPolygonCreated} />
          <FitBounds zonas={zonas} />
          {zonas.map((z) => (
            <Polygon
              key={z.id}
              positions={z.poligono.map(c => [c.lat, c.lng] as [number, number])}
              pathOptions={{ color: z.color || '#3b82f6', fillColor: z.color || '#3b82f6', fillOpacity: 0.25, weight: 2 }}
            />
          ))}
          {pending && (
            <Polygon
              positions={pending.map(c => [c.lat, c.lng] as [number, number])}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.3, weight: 2, dashArray: '5 5' }}
            />
          )}
        </MapContainer>
      </div>

      {/* Formulario inline al terminar de dibujar un polígono */}
      {pending ? (
        <div className="mt-3 rounded-2xl bg-zinc-100 dark:bg-zinc-900 p-3.5 space-y-3 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: color }} /> Nueva zona</p>
            <button onClick={cancelPending} className="h-7 w-7 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
          </div>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre (ej: Zona Centro)"
            className="h-10 bg-white dark:bg-zinc-800 border-0 text-sm rounded-xl" />
          <div className="flex items-center rounded-xl bg-white dark:bg-zinc-800 px-4 h-10">
            <span className="text-muted-foreground text-sm">$</span>
            <input type="number" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="Costo de envío"
              className="flex-1 bg-transparent outline-none text-sm px-1" />
          </div>
          <Button onClick={guardar} disabled={saving}
            className="w-full h-11 rounded-xl bg-[#FF7A00] hover:bg-[#E66E00] text-white font-semibold disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" /> Guardar zona</>}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
          <PencilRuler className="h-3.5 w-3.5 shrink-0" /> Tocá el ícono del polígono (⬟) arriba a la izquierda del mapa y marcá los límites de una zona. Podés crear varias.
        </p>
      )}

      {/* Lista de zonas ya creadas */}
      {zonas.length > 0 && (
        <div className="mt-3 space-y-2">
          {zonas.map((z) => (
            <div key={z.id} className="flex items-center gap-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 px-3.5 h-12">
              <span className="h-3 w-3 rounded-full shrink-0" style={{ background: z.color || '#3b82f6' }} />
              <span className="text-sm font-semibold flex-1 truncate">{z.nombre}</span>
              <span className="text-sm font-semibold tabular-nums">${parseFloat(z.precio).toFixed(0)}</span>
              <button onClick={() => eliminar(z.id)} className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 shrink-0"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Confeti minimalista, sin dependencias ──
function Confetti() {
  const colors = ['#FF7A00', '#22c55e', '#3b82f6', '#eab308', '#ec4899']
  const pieces = useMemo(() => Array.from({ length: 70 }).map((_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.6,
    duration: 1.8 + Math.random() * 1.4,
    color: colors[i % colors.length],
    size: 6 + Math.random() * 6,
    rotate: Math.random() * 360,
  })), [])
  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      <style>{`@keyframes piru-confetti { 0% { transform: translateY(-10vh) rotate(0deg); opacity: 1 } 100% { transform: translateY(110vh) rotate(720deg); opacity: 0 } }`}</style>
      {pieces.map(p => (
        <span key={p.id} style={{
          position: 'absolute', top: 0, left: `${p.left}%`, width: p.size, height: p.size * 1.6,
          background: p.color, borderRadius: 2, transform: `rotate(${p.rotate}deg)`,
          animation: `piru-confetti ${p.duration}s ${p.delay}s ease-in forwards`,
        }} />
      ))}
    </div>
  )
}

type DetectedProduct = { nombre: string; descripcion: string; precio: number; ambiguo?: string | null; conPapas?: boolean }
type StoreProduct = { id: number; nombre: string; descripcion: string; precio: string }

// ── Estructura de la carta detectada por la IA (coincide con el backend carta-ia) ──
type VarianteExtraida = { nombre: string; precio: number }
type ExtraExtraido = { nombre: string; precio: number }
type ProductoExtraido = {
  nombre: string
  descripcion?: string | null
  precio?: number | null
  ingredientes?: string[]
  variantes?: VarianteExtraida[]
  extras?: ExtraExtraido[]
}
type CategoriaExtraida = { nombre: string; productos: ProductoExtraido[] }
type CartaExtraida = { categorias: CategoriaExtraida[] }

// Formatea un número a pesos con separador de miles (es-AR), sin decimales.
const fmtPrecio = (n: number | null | undefined) => (n ?? 0).toLocaleString('es-AR')

// ── Etiqueta discreta para los campos del editor ──
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1.5">{children}</p>
}

// ── Input de precio sin flechas de spinner: acepta sólo dígitos y muestra el $ como prefijo ──
function MoneyInput({ value, onChange, placeholder, className }: {
  value: number | null | undefined; onChange: (n: number) => void; placeholder?: string; className?: string
}) {
  return (
    <div className={cn("flex items-center rounded-xl bg-zinc-100 dark:bg-zinc-800 px-3 h-10 focus-within:ring-2 focus-within:ring-[#FF7A00]/30 transition-shadow", className)}>
      <span className="text-muted-foreground text-sm">$</span>
      <input
        type="text"
        inputMode="numeric"
        value={value ?? ''}
        onChange={(e) => { const d = e.target.value.replace(/[^\d]/g, ''); onChange(d ? Number(d) : 0) }}
        placeholder={placeholder}
        className="flex-1 bg-transparent outline-none text-sm font-semibold text-right px-1 min-w-0"
      />
    </div>
  )
}

// ── Tarjeta de un producto detectado por la IA, con dos vistas: lectura (default) y edición ──
function ProductoRevisionCard({ p, onChange, onRemove }: {
  p: ProductoExtraido; onChange: (patch: Partial<ProductoExtraido>) => void; onRemove: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [nuevoIng, setNuevoIng] = useState('')

  const variantes = p.variantes ?? []
  const ingredientes = p.ingredientes ?? []
  const extras = p.extras ?? []
  const tieneVariantes = variantes.length > 0

  const setVariante = (i: number, patch: Partial<VarianteExtraida>) =>
    onChange({ variantes: variantes.map((v, k) => k === i ? { ...v, ...patch } : v) })
  const removeVariante = (i: number) => onChange({ variantes: variantes.filter((_, k) => k !== i) })

  const setExtra = (i: number, patch: Partial<ExtraExtraido>) =>
    onChange({ extras: extras.map((e, k) => k === i ? { ...e, ...patch } : e) })
  const removeExtra = (i: number) => onChange({ extras: extras.filter((_, k) => k !== i) })

  const addIngrediente = () => {
    const v = nuevoIng.trim()
    if (!v) return
    onChange({ ingredientes: [...ingredientes, v] })
    setNuevoIng('')
  }
  const removeIngrediente = (i: number) => onChange({ ingredientes: ingredientes.filter((_, k) => k !== i) })

  // ─────────────── Vista de lectura (default) ───────────────
  if (!editing) {
    const hr = <div className="h-px bg-black/[0.06] dark:bg-white/[0.08] my-4" />
    return (
      <div className="relative rounded-2xl bg-zinc-100 dark:bg-zinc-900 px-5 py-5 text-center transition-colors">
        <button
          onClick={() => setEditing(true)}
          aria-label="Editar producto"
          className="absolute top-3 right-3 h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white dark:hover:bg-zinc-800 transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>

        {/* Encabezado protagonista: nombre grande + precio como acento de marca */}
        <h3 className="text-[21px] font-semibold leading-tight tracking-tight px-6">{p.nombre}</h3>

        {!tieneVariantes && (
          <p className="mt-2 text-[17px] font-semibold tabular-nums tracking-tight text-[#FF7A00]">${fmtPrecio(p.precio)}</p>
        )}

        {p.descripcion && (
          <p className="text-[13.5px] text-muted-foreground mt-2 leading-relaxed max-w-[44ch] mx-auto">{p.descripcion}</p>
        )}

        {/* Variantes al estilo carta: nombre … precio con línea de puntos */}
        {tieneVariantes && (
          <div className="mt-4 max-w-xs mx-auto space-y-2 text-left">
            {variantes.map((v, vi) => (
              <div key={vi} className="flex items-baseline gap-2">
                <span className="text-[13.5px] text-foreground/80 truncate">{v.nombre}</span>
                <span className="flex-1 border-b border-dotted border-black/20 dark:border-white/20 -translate-y-[3px]" />
                <span className="text-[13.5px] font-semibold tabular-nums shrink-0">${fmtPrecio(v.precio)}</span>
              </div>
            ))}
          </div>
        )}

        {ingredientes.length > 0 && (
          <>
            {hr}
            <FieldLabel>Ingredientes</FieldLabel>
            <p className="text-[13px] text-muted-foreground leading-relaxed max-w-[44ch] mx-auto">{ingredientes.join(' · ')}</p>
          </>
        )}

        {extras.length > 0 && (
          <>
            {hr}
            <FieldLabel>Para agregar</FieldLabel>
            <div className="max-w-xs mx-auto space-y-1.5 text-left">
              {extras.map((ex, k) => (
                <div key={k} className="flex items-baseline gap-2">
                  <span className="text-[13.5px] text-foreground/80 truncate">{ex.nombre}</span>
                  <span className="flex-1 border-b border-dotted border-black/20 dark:border-white/20 -translate-y-[3px]" />
                  <span className="text-[13.5px] font-medium tabular-nums shrink-0 text-[#FF7A00]">+${fmtPrecio(ex.precio)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  // ─────────────── Vista de edición ───────────────
  return (
    <div className="rounded-2xl bg-white dark:bg-zinc-900 p-4 ring-1 ring-black/[0.05] dark:ring-white/[0.08] shadow-sm space-y-4 animate-in fade-in duration-200">
      <div>
        <FieldLabel>Nombre</FieldLabel>
        <input
          value={p.nombre}
          onChange={(e) => onChange({ nombre: e.target.value })}
          className="w-full h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#FF7A00]/30 transition-shadow"
        />
      </div>

      <div>
        <FieldLabel>Descripción</FieldLabel>
        <textarea
          value={p.descripcion ?? ''}
          onChange={(e) => onChange({ descripcion: e.target.value })}
          rows={2}
          placeholder="Sin descripción"
          className="w-full rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#FF7A00]/30 resize-none leading-relaxed transition-shadow"
        />
      </div>

      {tieneVariantes ? (
        <div>
          <FieldLabel>Variantes</FieldLabel>
          <div className="space-y-2">
            {variantes.map((v, vi) => (
              <div key={vi} className="flex items-center gap-2">
                <input
                  value={v.nombre}
                  onChange={(e) => setVariante(vi, { nombre: e.target.value })}
                  className="flex-1 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 px-3 text-sm outline-none focus:ring-2 focus:ring-[#FF7A00]/30 transition-shadow min-w-0"
                />
                <MoneyInput value={v.precio} onChange={(n) => setVariante(vi, { precio: n })} className="w-28 shrink-0" />
                <button onClick={() => removeVariante(vi)} aria-label="Quitar variante"
                  className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 shrink-0 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <FieldLabel>Precio</FieldLabel>
          <MoneyInput value={p.precio} onChange={(n) => onChange({ precio: n })} placeholder="0" />
        </div>
      )}

      <div>
        <FieldLabel>Ingredientes</FieldLabel>
        {ingredientes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {ingredientes.map((ing, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-[13px] pl-2.5 pr-1.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-foreground">
                {ing}
                <button onClick={() => removeIngrediente(i)} aria-label={`Quitar ${ing}`}
                  className="h-4 w-4 rounded-full flex items-center justify-center text-muted-foreground hover:text-red-500 transition-colors">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          value={nuevoIng}
          onChange={(e) => setNuevoIng(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addIngrediente() } }}
          onBlur={addIngrediente}
          placeholder="Escribí y Enter para sumar un ingrediente"
          className="w-full h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 px-3 text-[13px] outline-none focus:ring-2 focus:ring-[#FF7A00]/30 transition-shadow"
        />
      </div>

      {extras.length > 0 && (
        <div>
          <FieldLabel>Para agregar</FieldLabel>
          <div className="space-y-2">
            {extras.map((ex, ei) => (
              <div key={ei} className="flex items-center gap-2">
                <input
                  value={ex.nombre}
                  onChange={(e) => setExtra(ei, { nombre: e.target.value })}
                  className="flex-1 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 px-3 text-sm outline-none focus:ring-2 focus:ring-[#FF7A00]/30 transition-shadow min-w-0"
                />
                <MoneyInput value={ex.precio} onChange={(n) => setExtra(ei, { precio: n })} className="w-28 shrink-0" />
                <button onClick={() => removeExtra(ei)} aria-label="Quitar extra"
                  className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 shrink-0 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <button onClick={onRemove}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-red-500 transition-colors">
          <Trash2 className="h-3.5 w-3.5" /> Eliminar
        </button>
        <button onClick={() => setEditing(false)}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[#FF7A00] hover:bg-[#E66E00] text-white text-sm font-semibold active:scale-[0.97] transition-all">
          <Check className="h-4 w-4" /> Listo
        </button>
      </div>
    </div>
  )
}

const Onboarding = () => {
  const navigate = useNavigate()
  const { token } = useAuthStore()
  const restauranteStore = useRestauranteStore()
  const restaurante = restauranteStore.restaurante as any

  const [phase, setPhase] = useState<Phase>('nombre')
  const [busy, setBusy] = useState(false)
  const persistedRef = useRef(false)

  // Flujo "Sacale una foto": imágenes subidas + modo del paso "carta" (opciones vs uploader).
  // Las imágenes NO se persisten en localStorage (son pesadas); viven sólo en memoria.
  const [cartaImagenes, setCartaImagenes] = useState<string[]>([])
  const [cartaModo, setCartaModo] = useState<'opciones' | 'foto'>('opciones')

  // ── Estado de la lectura de la carta con IA. Vive en el padre para poder correr en segundo
  //    plano mientras el usuario configura logo/horarios y delivery/pago (fases posteriores). ──
  const [iaEstado, setIaEstado] = useState<'idle' | 'procesando' | 'listo' | 'error'>('idle')
  const [iaProgress, setIaProgress] = useState(0)
  const [iaTotal, setIaTotal] = useState(0)
  const [iaError, setIaError] = useState('')

  useEffect(() => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle('dark', isDark)
  }, [])

  const [formData, setFormData] = useState(() => {
    const defaults = {
      nombre: restaurante?.nombre || '',
      username: restaurante?.username || '',
      address: restaurante?.direccion || '',
      lat: null as number | null,
      lng: null as number | null,
      deliveryMode: 'radio' as 'radio' | 'zonas',
      deliveryRadius: 2500,
      deliveryPrice: restaurante?.deliveryFee || '0',
      logo: null as string | null,
      turnos: [{ horaApertura: '19:00', horaCierre: '23:30' }],
      proveedorPago: restaurante?.proveedorPago || 'manual',
      metodosPago: { transferenciaManual: true, efectivo: true },
      transferenciaAlias: restaurante?.transferenciaAlias || '',
      detected: MENU_SIMULADO as DetectedProduct[],
      // Carta detectada por la IA a partir de las fotos (estructura completa).
      cartaDetectada: null as CartaExtraida | null,
    }
    // Mergeamos sobre los defaults para tolerar datos guardados con formato viejo
    try {
      const saved = localStorage.getItem('piru_onboarding_data')
      if (saved) {
        const parsed = JSON.parse(saved)
        return {
          ...defaults,
          ...parsed,
          metodosPago: { ...defaults.metodosPago, ...(parsed.metodosPago || {}) },
          turnos: Array.isArray(parsed.turnos) && parsed.turnos.length > 0 ? parsed.turnos : defaults.turnos,
          detected: Array.isArray(parsed.detected) && parsed.detected.length > 0 ? parsed.detected : defaults.detected,
        }
      }
    } catch { /* si el guardado está corrupto, usamos defaults */ }
    return defaults
  })

  // Productos reales ya creados + carrito de la tienda de prueba
  const [storeProducts, setStoreProducts] = useState<StoreProduct[]>([])
  const [pedidoOk, setPedidoOk] = useState(false)

  // Regreso desde MercadoPago → aterrizar en la pantalla de entrega/pago
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const mpStatus = params.get('mp_status')
    if (mpStatus === 'success') {
      toast.success('¡MercadoPago conectado!')
      const saved = localStorage.getItem('piru_onboarding_data')
      if (saved) setFormData((prev: any) => ({ ...prev, ...JSON.parse(saved), proveedorPago: 'mercadopago' }))
      setPhase('entrega')
      window.history.replaceState({}, '', window.location.pathname)
    } else if (mpStatus === 'error') {
      toast.error('No se pudo conectar MercadoPago', { description: params.get('mp_error') || undefined })
      setPhase('entrega')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('piru_onboarding_data', JSON.stringify(formData))
  }, [formData])

  // Al llegar a la prueba (p. ej. tras recargar por el redirect de MercadoPago) nos
  // aseguramos de tener los productos reales cargados en la tienda.
  useEffect(() => {
    if (phase === 'prueba' && storeProducts.length === 0 && token) {
      productosApi.getAll(token)
        .then((res: any) => setStoreProducts(res.productos || []))
        .catch(() => { /* ignore */ })
    }
  }, [phase, token]) // eslint-disable-line react-hooks/exhaustive-deps

  const patch = (p: Partial<typeof formData>) => setFormData((prev: any) => ({ ...prev, ...p }))

  // ── Lanza (o relanza) la lectura de la carta con IA en segundo plano. El usuario sigue
  //    configurando mientras esto corre; el resultado se guarda en formData.cartaDetectada. ──
  const lanzarExtraccion = async () => {
    if (!token || cartaImagenes.length === 0) { toast.error('Subí al menos una foto'); return }
    setIaEstado('procesando'); setIaProgress(0); setIaError('')
    try {
      const res = await cartaIaApi.extraer(token, cartaImagenes) as { success: boolean; carta?: CartaExtraida; totalProductos?: number; message?: string }
      if (!res.success || !res.carta) throw new Error(res.message || 'No se pudo leer la carta')
      patch({ cartaDetectada: res.carta })
      setIaTotal(res.totalProductos ?? 0)
      setIaProgress(100)
      setIaEstado('listo')
    } catch (e: any) {
      setIaError(e?.message || 'No se pudo procesar la carta')
      setIaEstado('error')
      toast.error('No pudimos leer tu carta', { description: e?.message })
    }
  }

  // Progreso indeterminado mientras la IA lee: curva lenta que se acerca a 95% (puede tardar minutos).
  useEffect(() => {
    if (iaEstado !== 'procesando') return
    const start = Date.now()
    const timer = setInterval(() => {
      const t = (Date.now() - start) / 1000
      setIaProgress(95 * (1 - Math.exp(-t / 55)))
    }, 200)
    return () => clearInterval(timer)
  }, [iaEstado])

  // Si al montar ya hay una carta detectada persistida (p. ej. tras volver de MercadoPago),
  // la damos por lista sin re-ejecutar la IA.
  useEffect(() => {
    if (formData.cartaDetectada) {
      const total = formData.cartaDetectada.categorias.reduce((a: number, cat: CategoriaExtraida) => a + cat.productos.length, 0)
      setIaTotal(total); setIaProgress(100); setIaEstado('listo')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const renderIaIndicator = () => (
    <IaWaitIndicator estado={iaEstado} progress={iaProgress} total={iaTotal} errorMsg={iaError} onRetry={lanzarExtraccion} />
  )

  const goTo = (p: Phase) => { setPhase(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const next = () => { const i = phaseIndex(phase); if (i < PHASES.length - 1) goTo(PHASES[i + 1]) }
  const back = () => {
    // Dentro del paso "carta", si estamos en el uploader volvemos a elegir la forma de carga
    if (phase === 'carta' && cartaModo === 'foto') return setCartaModo('opciones')
    const i = phaseIndex(phase); if (i > 0) goTo(PHASES[i - 1])
  }

  const progress = ((phaseIndex(phase) + 1) / PHASES.length) * 100

  const handleConnectMP = () => {
    if (!MP_APP_ID || !restaurante?.id) return
    localStorage.setItem('piru_onboarding_data', JSON.stringify(formData))
    const state = `${restaurante.id}_onboarding`
    window.location.href = `https://auth.mercadopago.com.ar/authorization?client_id=${MP_APP_ID}&response_type=code&platform_id=mp&state=${state}&redirect_uri=${encodeURIComponent(MP_REDIRECT_URI)}`
  }

  // ── Crear la carta detectada (categorías, productos, variantes, ingredientes, extras) ──
  const confirmarMenu = async () => {
    if (!token) return
    const carta = formData.cartaDetectada as CartaExtraida | null
    if (!carta || carta.categorias.length === 0) {
      toast.error('No hay productos para crear')
      return
    }
    setBusy(true)
    try {
      const res = await cartaIaApi.crear(token, carta) as { success: boolean; productosCreados?: number; message?: string }
      if (!res.success) throw new Error(res.message || 'No se pudo crear la carta')
      const prods = await productosApi.getAll(token) as { productos: StoreProduct[] }
      setStoreProducts(prods.productos || [])
      toast.success('Menú cargado', { description: `${res.productosCreados ?? prods.productos?.length ?? 0} productos listos` })
      goTo('prueba')
    } catch (e: any) {
      toast.error('No se pudo cargar el menú', { description: e?.message })
    } finally {
      setBusy(false)
    }
  }

  // ── Persistir todo el onboarding (username, dirección, logo, horarios, pago) + zona ──
  const persistOnboarding = async () => {
    if (!token || persistedRef.current) return true
    setBusy(true)
    try {
      const waNumber = (restaurante?.whatsappNumber || restaurante?.telefono || '').toString().replace(/\D/g, '')
      await onboardingApi.complete(token, {
        username: formData.username,
        nombre: formData.nombre,
        address: formData.address,
        notifyWhatsapp: true,
        whatsappNumber: waNumber,
        notifyPrinter: false,
        turnos: formData.turnos,
        deliveryPrice: formData.deliveryPrice || '0',
        friendsOrdering: true,
        imageLight: formData.logo,
        imageDark: formData.logo,
        proveedorPago: formData.proveedorPago,
        metodosPago: formData.metodosPago,
        // Alias/CBU solo si la transferencia manual quedó activada.
        transferenciaAlias: formData.metodosPago.transferenciaManual ? formData.transferenciaAlias : '',
      })

      // Guardar el radio de reparto como zona (best-effort). En modo "zonas" las áreas
      // dibujadas ya se guardaron en vivo, así que acá no creamos el círculo.
      if (formData.deliveryMode === 'radio' && formData.lat != null && formData.lng != null) {
        try {
          await zonasDeliveryApi.create(token, {
            nombre: 'Radio de reparto',
            precio: String(formData.deliveryPrice || '0'),
            poligono: circleToPolygon({ lat: formData.lat, lng: formData.lng }, formData.deliveryRadius),
            color: '#FF7A00',
          })
        } catch { /* no bloqueamos el onboarding si falla la zona */ }
      }

      // Ojo: NO refrescamos el store acá. Al marcar completedOnboarding=true,
      // ProtectedLayout redirige /onboarding → /dashboard y nos saltaría las
      // pantallas de prueba y final. El refresh se hace recién en finalizar().
      persistedRef.current = true
      return true
    } catch (e: any) {
      toast.error('No se pudo guardar', { description: e?.message })
      return false
    } finally {
      setBusy(false)
    }
  }

  const irARevision = async () => {
    const ok = await persistOnboarding()
    if (ok) goTo('revision')
  }

  const finalizar = async () => {
    localStorage.removeItem('piru_onboarding_data')
    // Recién ahora sincronizamos el store (completedOnboarding=true) y entramos al panel
    await restauranteStore.fetchData()
    navigate('/dashboard')
  }

  // ────────────────────────────── RENDER DE FASES ──────────────────────────────

  const renderNombre = () => {
    const slug = toSlug(formData.nombre)
    const ok = slug.length >= 3
    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-tight">¿Cómo se llama tu local?</h1>
        <p className="text-[15px] text-muted-foreground mt-3">Con esto armamos tu link para compartir.</p>

        <Input
          autoFocus
          value={formData.nombre}
          onChange={(e) => patch({ nombre: e.target.value, username: toSlug(e.target.value) })}
          placeholder="Burger Bros"
          className="h-16 mt-8 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border-0 focus-visible:ring-2 focus-visible:ring-[#FF7A00]/30 text-lg px-5"
        />

        {/* Preview del link armándose en vivo */}
        <div className="mt-5 flex items-center gap-2 text-lg font-mono">
          <span className="text-muted-foreground/60">my.piru.app/</span>
          <span className="relative">
            <span className="font-semibold text-[#FF7A00]">{slug || 'tulocal'}</span>
            {formData.nombre && <span className="inline-block w-0.5 h-5 bg-[#FF7A00] ml-0.5 align-middle animate-pulse" />}
          </span>
          {ok && <Check className="h-5 w-5 text-emerald-500 ml-1 animate-in zoom-in duration-200" />}
        </div>
        {formData.nombre && !ok && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">Necesitamos al menos 3 letras o números.</p>
        )}

        <Button onClick={next} disabled={!ok} className="w-full h-14 mt-8 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white disabled:opacity-40 active:scale-[0.985] transition-all">
          Continuar <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    )
  }

  const renderOwnership = () => {
    const slug = toSlug(formData.nombre) || 'tulocal'
    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 text-center flex flex-col items-center">
        {/* Icono discreto y centrado: caja neutra con la tienda como acento sutil */}
        <div className="mb-7 h-14 w-14 rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
          <Store className="h-6 w-6 text-[#FF7A00]" strokeWidth={2} />
        </div>

        <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-tight">Este link ya es tuyo</h1>
        <p className="text-[15px] text-muted-foreground mt-3 max-w-sm">
          Nadie más lo puede usar. Es la dirección de tu local en internet.
        </p>

        <div className="mt-7 w-full rounded-2xl bg-zinc-100 dark:bg-zinc-900 p-4 font-mono text-base">
          <span className="text-muted-foreground/60">my.piru.app/</span>
          <span className="font-semibold text-[#FF7A00]">{slug}</span>
        </div>

        <Button onClick={next} className="w-full h-14 mt-8 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white active:scale-[0.985] transition-all">
          Cargar mi carta <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    )
  }

  // Agrega imágenes (redimensionadas) al set de fotos de la carta.
  const agregarImagenesCarta = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const restantes = 12 - cartaImagenes.length
    const aProcesar = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, Math.max(0, restantes))
    if (aProcesar.length === 0) {
      toast.error('Podés subir hasta 12 imágenes')
      return
    }
    try {
      const nuevas = await Promise.all(aProcesar.map(f => fileToResizedDataUrl(f)))
      setCartaImagenes(prev => [...prev, ...nuevas])
    } catch {
      toast.error('No se pudo procesar alguna imagen')
    }
  }

  const renderCarta = () => {
    const opciones = [
      { id: 'foto', icon: Camera, title: 'Sacale una foto', desc: 'A tu carta impresa o pizarra', hint: 'Lo más rápido', activa: true },
      { id: 'pdf', icon: FileText, title: 'Subir un PDF', desc: 'Tu menú en archivo', hint: null, activa: false },
      { id: 'link', icon: Link2, title: 'Pegar un link', desc: 'De Instagram o PedidosYa', hint: null, activa: false },
      { id: 'mano', icon: Utensils, title: 'Cargar a mano', desc: 'Escribís los productos vos', hint: null, activa: false },
    ]

    // ── Modo uploader: subir una o varias fotos del menú ──
    if (cartaModo === 'foto') {
      return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-tight">Subí las fotos de tu carta</h1>
          <p className="text-[15px] text-muted-foreground mt-3">Sacale una foto a cada página o subí los diseños de tu menú. La IA lee nombres, precios, variantes, ingredientes y extras.</p>

          {/* Zona para subir imágenes */}
          <label className="mt-7 block cursor-pointer">
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { agregarImagenesCarta(e.target.files); e.currentTarget.value = '' }}
            />
            <div className="rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-[#FF7A00] transition-colors p-8 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-xl bg-orange-50 dark:bg-orange-950/40 flex items-center justify-center mb-3">
                <ImagePlus className="h-6 w-6 text-[#FF7A00]" />
              </div>
              <p className="text-sm font-semibold">Tocá para elegir imágenes</p>
              <p className="text-xs text-muted-foreground mt-1">JPG o PNG · hasta 12 fotos</p>
            </div>
          </label>

          {/* Miniaturas de las imágenes cargadas */}
          {cartaImagenes.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-4">
              {cartaImagenes.map((src, idx) => (
                <div key={idx} className="relative aspect-square rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-900 group">
                  <img src={src} alt={`Carta ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => setCartaImagenes(prev => prev.filter((_, i) => i !== idx))}
                    className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Quitar imagen"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Button
            onClick={() => { if (cartaImagenes.length === 0) return toast.error('Subí al menos una foto'); lanzarExtraccion(); goTo('creando') }}
            disabled={cartaImagenes.length === 0}
            className="w-full h-14 mt-7 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white active:scale-[0.985] transition-all disabled:opacity-40"
          >
            <Sparkles className="mr-2 h-4 w-4" /> Leer mi carta {cartaImagenes.length > 0 && `(${cartaImagenes.length})`}
          </Button>
          <button onClick={() => setCartaModo('opciones')} className="w-full text-center text-sm text-muted-foreground hover:text-foreground mt-4 transition-colors">
            Elegir otra forma
          </button>
        </div>
      )
    }

    // ── Modo opciones: elegir cómo cargar la carta ──
    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-tight">Cargá tu carta</h1>
        <p className="text-[15px] text-muted-foreground mt-3">Sacale una foto y la leemos con IA en segundos. Las demás formas llegan pronto.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-7">
          {opciones.map((o) => (
            <button
              key={o.id}
              disabled={!o.activa}
              onClick={() => { if (o.activa) setCartaModo('foto') }}
              className={cn(
                "group text-left p-4 rounded-2xl relative transition-all",
                o.activa
                  ? "bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 active:scale-[0.98] cursor-pointer"
                  : "bg-zinc-50 dark:bg-zinc-900/40 opacity-60 cursor-not-allowed"
              )}
            >
              {o.hint && o.activa && (
                <span className="absolute top-3 right-3 text-[10px] font-semibold text-[#FF7A00] bg-orange-50 dark:bg-orange-950/40 px-2 py-0.5 rounded-full">{o.hint}</span>
              )}
              {!o.activa && (
                <span className="absolute top-3 right-3 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Lock className="h-2.5 w-2.5" /> Próximamente
                </span>
              )}
              <div className={cn(
                "w-11 h-11 rounded-xl flex items-center justify-center mb-3 transition-transform",
                o.activa ? "bg-white dark:bg-zinc-800 shadow-sm group-hover:scale-105" : "bg-zinc-100 dark:bg-zinc-800/60"
              )}>
                <o.icon className={cn("h-5 w-5", o.activa ? "text-[#FF7A00]" : "text-zinc-400 dark:text-zinc-500")} />
              </div>
              <p className="text-sm font-semibold">{o.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{o.desc}</p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Paso intermedio sin interacción: avisamos que la IA está creando los productos y que
  // puede seguir configurando mientras tanto (el trabajo pesado corre en segundo plano).
  const renderCreando = () => (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 text-center flex flex-col items-center">
      <div className="mb-7 h-14 w-14 rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
        <Sparkles className="h-6 w-6 text-[#FF7A00]" strokeWidth={2} />
      </div>

      <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-tight">Estamos creando tus productos</h1>
      <p className="text-[15px] text-muted-foreground mt-3 max-w-sm">
        La IA está leyendo tu carta y cargando todo. Puede tardar hasta 3 minutos, no hace falta que esperes acá.
      </p>

      <div className="mt-7 w-full text-left">{renderIaIndicator()}</div>

      <p className="text-[13px] text-muted-foreground mt-4 max-w-sm">
        Mientras tanto, terminá de configurar tu local. Cuando termine, tus productos van a estar listos.
      </p>

      <Button onClick={next} className="w-full h-14 mt-7 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white active:scale-[0.985] transition-all">
        Seguir configurando <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  )

  const renderPreparativos = () => (
    <PreparativosScreen
      formData={formData}
      patch={patch}
      indicator={renderIaIndicator()}
      onContinue={() => goTo('entrega')}
    />
  )

  const renderRevision = () => {
    const carta = (formData.cartaDetectada as CartaExtraida | null) ?? { categorias: [] }
    const setCarta = (next: CartaExtraida) => patch({ cartaDetectada: next })
    const totalProductos = carta.categorias.reduce((acc, c) => acc + c.productos.length, 0)

    // Actualiza un producto de forma inmutable
    const updateProducto = (ci: number, pi: number, p: Partial<ProductoExtraido>) => {
      const categorias = carta.categorias.map((cat, i) => i !== ci ? cat : {
        ...cat,
        productos: cat.productos.map((prod, j) => j !== pi ? prod : { ...prod, ...p }),
      })
      setCarta({ categorias })
    }
    // Elimina un producto (y su categoría si queda vacía)
    const removeProducto = (ci: number, pi: number) => {
      const categorias = carta.categorias
        .map((cat, i) => i !== ci ? cat : { ...cat, productos: cat.productos.filter((_, j) => j !== pi) })
        .filter(cat => cat.productos.length > 0)
      setCarta({ categorias })
    }

    // La IA todavía está leyendo (o falló): mostramos el indicador en vez de los productos.
    // Cuando pase a 'listo', este render se reemplaza solo por la lista editable.
    if (iaEstado !== 'listo') {
      return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#FF7A00]" />
            <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-tight">Esto detectamos</h1>
          </div>
          <p className="text-[15px] text-muted-foreground mt-3">
            {iaEstado === 'error'
              ? 'No pudimos leer tu carta. Probá de nuevo o cargá otras fotos.'
              : 'Estamos terminando de leer tu carta. Falta poquito…'}
          </p>
          <div className="mt-6">{renderIaIndicator()}</div>
          {iaEstado === 'error' && (
            <button onClick={() => goTo('carta')} className="w-full text-center text-sm text-muted-foreground hover:text-foreground mt-5 transition-colors">
              Cargar otras fotos
            </button>
          )}
        </div>
      )
    }

    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[#FF7A00]" />
          <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-tight">Esto detectamos</h1>
        </div>
        <p className="text-[15px] text-muted-foreground mt-3">
          {totalProductos > 0
            ? 'Revisá nombres y precios. Después podés ajustar todo desde el panel.'
            : 'No quedaron productos. Volvé y probá con otras fotos.'}
        </p>

        <div className="mt-6 space-y-5">
          {carta.categorias.map((cat, ci) => (
            <div key={ci}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{cat.nombre}</span>
                <span className="text-[10px] font-semibold text-muted-foreground/70 bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded-full">{cat.productos.length}</span>
              </div>
              <div className="space-y-3">
                {cat.productos.map((p, pi) => (
                  <ProductoRevisionCard
                    key={pi}
                    p={p}
                    onChange={(patch) => updateProducto(ci, pi, patch)}
                    onRemove={() => removeProducto(ci, pi)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <Button onClick={confirmarMenu} disabled={busy || totalProductos === 0}
          className="w-full h-14 mt-7 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white active:scale-[0.985] transition-all disabled:opacity-50">
          {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando tu menú…</> : <>Confirmar menú <ArrowRight className="ml-2 h-4 w-4" /></>}
        </Button>
      </div>
    )
  }

  const renderEntrega = () => {
    const center: [number, number] = [formData.lat ?? -34.6037, formData.lng ?? -58.3816]
    const gratis = (parseInt(formData.deliveryPrice) || 0) === 0
    // El mapa (radio/zonas) recién aparece cuando hay una dirección geolocalizada,
    // así lo podemos centrar exactamente en el local en vez de en un punto genérico.
    const tieneUbicacion = formData.lat != null && formData.lng != null
    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-6">
        {/* La lectura de la carta sigue corriendo en segundo plano: mostramos su estado acá también. */}
        {renderIaIndicator()}

        <div>
          <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-tight">¿Desde dónde entregás?</h1>
          <p className="text-[15px] text-muted-foreground mt-3">Escribí tu dirección y armamos el mapa de reparto centrado en tu local.</p>
        </div>

        <AddressAutocomplete
          value={formData.address}
          onChange={(address, lat, lng) => patch({ address, lat, lng })}
          placeholder="Av. Corrientes 1234, CABA"
        />

        {!tieneUbicacion ? (
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground rounded-2xl bg-zinc-100 dark:bg-zinc-900 px-4 py-3.5">
            <MapPin className="h-4 w-4 text-[#FF7A00] shrink-0" />
            Elegí tu dirección de la lista para dibujar tu zona de reparto.
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Selector de modo: radio simple vs. áreas dibujadas a medida */}
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-zinc-100 dark:bg-zinc-900 p-1">
              {([
                { id: 'radio', icon: Target, label: 'Radio de reparto' },
                { id: 'zonas', icon: PencilRuler, label: 'Dibujar zonas' },
              ] as const).map((m) => (
                <button
                  key={m.id}
                  onClick={() => patch({ deliveryMode: m.id })}
                  className={cn(
                    "flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold transition-all",
                    formData.deliveryMode === m.id
                      ? "bg-white dark:bg-zinc-800 text-[#FF7A00] shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <m.icon className="h-4 w-4" /> {m.label}
                </button>
              ))}
            </div>

            {formData.deliveryMode === 'radio' ? (
              <>
                {/* Mapa integrado con el radio editable (con zoom) */}
                <div>
                  <div className="rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 h-56">
                    <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true} dragging={true} zoomControl={true}>
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <RecenterMap center={center} />
                      <Circle center={center} radius={formData.deliveryRadius} pathOptions={{ color: '#FF7A00', fillColor: '#FF7A00', fillOpacity: 0.15, weight: 2 }} />
                      <CircleMarker center={center} radius={6} pathOptions={{ color: '#fff', weight: 2, fillColor: '#FF7A00', fillOpacity: 1 }} />
                    </MapContainer>
                  </div>
                  <div className="flex items-center gap-3 mt-3">
                    <MapPin className="h-4 w-4 text-[#FF7A00] shrink-0" />
                    <input type="range" min={500} max={8000} step={250} value={formData.deliveryRadius}
                      onChange={(e) => patch({ deliveryRadius: Number(e.target.value) })}
                      className="flex-1 accent-[#FF7A00]" />
                    <span className="text-sm font-semibold tabular-nums w-16 text-right">{(formData.deliveryRadius / 1000).toFixed(1)} km</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">Arrastrá para ajustar el radio. Usá la rueda o los botones + / − para acercar el mapa.</p>
                </div>

                {/* Costo de envío (único para todo el radio) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-sm font-medium text-muted-foreground">Costo de envío</Label>
                    {gratis && <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Gratis</span>}
                  </div>
                  <div className="flex items-center rounded-xl bg-zinc-100 dark:bg-zinc-900 px-4 h-11">
                    <span className="text-muted-foreground text-sm">$</span>
                    <input type="number" value={formData.deliveryPrice} onChange={(e) => patch({ deliveryPrice: e.target.value })}
                      placeholder="0" className="flex-1 bg-transparent outline-none text-sm px-1" />
                  </div>
                </div>
              </>
            ) : (
              <DrawZonasSection token={token} center={center} />
            )}
          </div>
        )}

        {/* Pagos */}
        <div className="pt-2">
          <h2 className="text-[2rem] leading-[1.1] font-semibold tracking-tight">¿Y cómo cobrás?</h2>
          <p className="text-[15px] text-muted-foreground mt-3 mb-4">Prendé los medios que aceptás hoy. Sumás más cuando quieras, en un toque.</p>
          <div className="rounded-2xl bg-zinc-100 dark:bg-zinc-900 divide-y divide-zinc-200 dark:divide-zinc-800">
            <PayRow icon={Banknote} label="Efectivo" desc="Al entregar" checked={formData.metodosPago.efectivo}
              onToggle={() => patch({ metodosPago: { ...formData.metodosPago, efectivo: !formData.metodosPago.efectivo } })} />
            <PayRow icon={ArrowDownToLine} label="Transferencia" desc="Mostrás tu alias" checked={formData.metodosPago.transferenciaManual}
              onToggle={() => patch({ metodosPago: { ...formData.metodosPago, transferenciaManual: !formData.metodosPago.transferenciaManual } })} />
            {formData.metodosPago.transferenciaManual && (
              <div className="p-3.5 animate-in fade-in slide-in-from-top-1 duration-200">
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Alias o CBU para transferencias</Label>
                <input
                  value={formData.transferenciaAlias}
                  onChange={(e) => patch({ transferenciaAlias: e.target.value })}
                  placeholder="tu.alias.mp"
                  className="w-full h-11 rounded-xl bg-white dark:bg-zinc-800 border-0 px-3 text-sm font-mono outline-none focus:ring-2 focus:ring-[#FF7A00]/30 transition-shadow"
                />
                <p className="text-xs text-muted-foreground mt-1.5">Se lo mostramos al cliente para que te transfiera.</p>
              </div>
            )}
          </div>

          <button onClick={handleConnectMP}
            className={cn("mt-3 w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all",
              formData.proveedorPago === 'mercadopago' ? "border-[#009EE3] bg-[#009EE3]/5" : "border-zinc-200 dark:border-zinc-800 hover:border-[#009EE3]/50")}>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-[#009EE3] flex items-center justify-center"><span className="text-white font-bold text-[10px]">MP</span></div>
              <div className="text-left">
                <p className="text-sm font-semibold">Conectar Mercado Pago</p>
                <p className="text-xs text-muted-foreground">Cobrás con tarjeta, se acredita solo · Opcional</p>
              </div>
            </div>
            {formData.proveedorPago === 'mercadopago' ? <Check className="h-5 w-5 text-[#009EE3]" /> : <ArrowRight className="h-4 w-4 text-muted-foreground" />}
          </button>
        </div>

        <Button onClick={irARevision} disabled={busy}
          className="w-full h-14 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white active:scale-[0.985] transition-all disabled:opacity-50">
          {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando…</> : <>Casi listo <ArrowRight className="ml-2 h-4 w-4" /></>}
        </Button>
      </div>
    )
  }

  // Crea el pedido de prueba real a partir de los items del preview de tienda.
  const hacerPedidoPrueba = async (
    items: { productoId: number; cantidad: number }[],
    meta: { nombreCliente: string; notas: string },
  ) => {
    if (!token || items.length === 0) return
    try {
      // notificarWhatsappPrueba: el backend envía el pedido al WhatsApp del dueño (await server-side)
      await pedidoUnificadoApi.create(token, {
        tipo: 'takeaway',
        nombreCliente: meta.nombreCliente || 'Pedido de prueba',
        notas: meta.notas || 'Pedido de prueba generado en el onboarding',
        anotadoManualmente: true,
        notificarWhatsappPrueba: true,
        items,
      })
      // Damos unos segundos extra para asegurarnos de que el mensaje realmente llegó al WhatsApp
      // antes de mostrar la pantalla de celebración. Mientras tanto, el preview sigue en "Enviando…".
      await new Promise((r) => setTimeout(r, 3500))
      setPedidoOk(true)
      setTimeout(() => goTo('final'), 2600)
    } catch (e: any) {
      toast.error('No se pudo crear el pedido', { description: e?.message })
      throw e
    }
  }

  const renderPrueba = () => {
    if (pedidoOk) {
      return (
        <div className="text-center flex flex-col items-center animate-in fade-in duration-500 py-6">
          <Confetti />
          <div className="w-16 h-16 rounded-2xl bg-[#25D366] flex items-center justify-center mb-6">
            <svg viewBox="0 0 24 24" className="h-8 w-8 fill-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884Z" /></svg>
          </div>
          <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-tight">Te llegó el pedido</h1>
          <p className="text-[15px] text-muted-foreground mt-3 max-w-sm">Así vas a recibir cada pedido real: al toque, en tu WhatsApp y en el panel.</p>
        </div>
      )
    }

    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-tight">Probá tu tienda</h1>
        <p className="text-[15px] text-muted-foreground mt-3">Recorré tu tienda tal como la verán tus clientes y hacé un pedido de prueba para ver cómo te llega.</p>

        {/* Espejo real de la tienda del cliente (menú + carrito + checkout) */}
        <TiendaPreview
          nombre={formData.nombre}
          logo={formData.logo}
          slug={toSlug(formData.nombre) || 'tulocal'}
          direccion={formData.address}
          deliveryPrice={formData.deliveryPrice || '0'}
          metodosPago={formData.metodosPago}
          proveedorPago={formData.proveedorPago}
          productos={storeProducts}
          onConfirmar={hacerPedidoPrueba}
        />

        <button onClick={() => goTo('final')} className="w-full text-center text-sm text-muted-foreground hover:text-foreground mt-5 transition-colors">
          Omitir la prueba
        </button>
      </div>
    )
  }

  const renderFinal = () => {
    const link = `my.piru.app/${toSlug(formData.nombre) || 'tulocal'}`
    const copiar = () => { navigator.clipboard.writeText(`https://${link}`); toast.success('Link copiado') }
    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 text-center flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-[#FF7A00] flex items-center justify-center mb-6">
          <Sparkles className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-tight">Tu local está en vivo</h1>
        <p className="text-[15px] text-muted-foreground mt-3 max-w-sm">Compartí tu link y empezá a recibir pedidos. Todo lo demás lo ajustás desde el panel.</p>

        <button onClick={copiar} className="mt-7 w-full flex items-center justify-between rounded-2xl bg-zinc-100 dark:bg-zinc-900 p-4 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 transition-colors group">
          <span className="font-mono text-sm truncate"><span className="text-muted-foreground/60">my.piru.app/</span><span className="font-semibold text-[#FF7A00]">{toSlug(formData.nombre) || 'tulocal'}</span></span>
          <Copy className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0" />
        </button>

        <Button onClick={finalizar} className="w-full h-14 mt-4 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white active:scale-[0.985] transition-all">
          Ir a mi panel <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    )
  }

  const renderPhase = () => {
    switch (phase) {
      case 'nombre': return renderNombre()
      case 'ownership': return renderOwnership()
      case 'carta': return renderCarta()
      case 'creando': return renderCreando()
      case 'preparativos': return renderPreparativos()
      case 'revision': return renderRevision()
      case 'entrega': return renderEntrega()
      case 'prueba': return renderPrueba()
      case 'final': return renderFinal()
    }
  }

  // Fases donde tiene sentido volver atrás (no en pantallas de proceso/éxito)
  const canGoBack = ['ownership', 'carta', 'creando', 'preparativos', 'entrega', 'revision'].includes(phase)

  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-6 py-6 relative selection:bg-orange-500/10 selection:text-[#FF7A00]">
      {/* Flecha de volver: botón flotante arriba a la izquierda, separado del bloque.
          Sólo aparece en las fases donde tiene sentido retroceder. */}
      {canGoBack && (
        <button onClick={back} aria-label="Volver"
          className="absolute top-5 left-5 h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors z-50">
          <ArrowLeft className="h-4 w-4" />
        </button>
      )}

      {/* El bloque (logo + barra + contenido) queda centrado verticalmente en toda
          pantalla, con la barra de progreso justo encima del título. */}
      <div className="w-full max-w-md mx-auto">
        {/* Header: logo Piru + barra de progreso continua (sin enumerar pasos) */}
        <header className="pb-3">
          <div className="flex items-center gap-3">
            <img src="/logopiru.jpeg" alt="Piru" className="h-8 w-auto rounded-lg shrink-0" />
            <div className="flex-1 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-[#FF7A00] to-[#FF9E44] transition-all duration-700 ease-out relative"
                style={{ width: `${progress}%` }}>
                <span className="absolute right-0 top-0 h-full w-4 bg-white/40 blur-sm animate-pulse" />
              </div>
            </div>
          </div>
        </header>

        <main className="py-2">
          {renderPhase()}
        </main>
      </div>
    </div>
  )
}

// ── Fila de método de pago (toggle) ──
function PayRow({ icon: Icon, label, desc, checked, onToggle }: { icon: any; label: string; desc: string; checked: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="w-full flex items-center gap-3 p-3.5 text-left">
      <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0"><Icon className="h-4 w-4" /></div>
      <div className="flex-1">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <div className={cn("h-6 w-11 rounded-full p-0.5 transition-colors shrink-0", checked ? "bg-[#FF7A00]" : "bg-zinc-300 dark:bg-zinc-700")}>
        <div className={cn("h-5 w-5 rounded-full bg-white transition-transform", checked ? "translate-x-5" : "translate-x-0")} />
      </div>
    </button>
  )
}

// Frases que se van turnando mientras la IA procesa las imágenes
const PROCESANDO_FRASES = ['Leyendo tu carta…', 'Detectando productos…', 'Ordenando el menú…']

// Frase con las letras rebotando en cascada. La transición entre frases se logra
// remontando el componente (key) para disparar la animación de entrada.
function FraseAnimada({ text }: { text: string }) {
  return (
    <span className="inline-flex animate-in fade-in slide-in-from-bottom-2 duration-300">
      {Array.from(text).map((ch, i) => (
        <span
          key={i}
          className="inline-block"
          style={{
            animation: 'piru-bounce 1.5s ease-in-out infinite',
            animationDelay: `${i * 0.045}s`,
            whiteSpace: 'pre',
          }}
        >
          {ch === ' ' ? ' ' : ch}
        </span>
      ))}
    </span>
  )
}

// ── Indicador reutilizable del estado de la lectura de la carta con IA. Se muestra en las
//    fases 'creando', 'preparativos', 'entrega' y 'revision' mientras el trabajo corre en
//    segundo plano. El progreso vive en un anillo alrededor del icono. ──
function IaWaitIndicator({ estado, progress, total, errorMsg, onRetry }: {
  estado: 'idle' | 'procesando' | 'listo' | 'error'; progress: number; total: number; errorMsg?: string; onRetry?: () => void
}) {
  const [fraseIdx, setFraseIdx] = useState(0)
  const listo = estado === 'listo'
  const hayError = estado === 'error'

  // Rotación de frases mientras procesa; se queda fija en la última
  useEffect(() => {
    if (estado !== 'procesando') return
    setFraseIdx(0)
    const id = setInterval(() => setFraseIdx((i) => Math.min(i + 1, PROCESANDO_FRASES.length - 1)), 2200)
    return () => clearInterval(id)
  }, [estado])

  return (
    <div className="flex items-center gap-3.5 rounded-2xl bg-zinc-100 dark:bg-zinc-900 p-3.5">
      <style>{`@keyframes piru-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-4px)}}`}</style>
      <div className="relative h-12 w-12 shrink-0">
        <svg className="h-12 w-12 -rotate-90" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="21" fill="none" strokeWidth="3" className="stroke-zinc-200 dark:stroke-zinc-800" />
          <circle
            cx="24" cy="24" r="21" fill="none" strokeWidth="3" strokeLinecap="round"
            className="stroke-[#FF7A00] transition-[stroke-dashoffset] duration-200 ease-linear"
            style={{ strokeDasharray: 2 * Math.PI * 21, strokeDashoffset: 2 * Math.PI * 21 * (1 - progress / 100) }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {listo ? (
            <div className="h-10 w-10 rounded-full bg-[#FF7A00] flex items-center justify-center animate-in zoom-in-75 duration-300">
              <Check className="h-[18px] w-[18px] text-white" strokeWidth={3} />
            </div>
          ) : hayError ? (
            <div className="h-10 w-10 rounded-full bg-red-500 flex items-center justify-center">
              <X className="h-[18px] w-[18px] text-white" strokeWidth={2.5} />
            </div>
          ) : (
            <Sparkles className="h-[18px] w-[18px] text-[#FF7A00]" />
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold">
          {listo
            ? 'Productos listos'
            : hayError
            ? 'No pudimos leer la carta'
            : <FraseAnimada key={PROCESANDO_FRASES[fraseIdx]} text={PROCESANDO_FRASES[fraseIdx]} />}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {listo
            ? `${total} producto${total === 1 ? '' : 's'} cargado${total === 1 ? '' : 's'}`
            : hayError
            ? (errorMsg || 'Probá con fotos más nítidas')
            : 'Puede tardar unos minutos · seguí configurando'}
        </p>
      </div>
      {hayError && onRetry && (
        <button onClick={onRetry}
          className="h-9 px-3 rounded-xl bg-white dark:bg-zinc-800 text-xs font-semibold text-[#FF7A00] flex items-center gap-1.5 shrink-0 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors">
          <RefreshCw className="h-3.5 w-3.5" /> Reintentar
        </button>
      )}
    </div>
  )
}

// ── Paso "preparativos": mientras la IA lee la carta en segundo plano, el usuario carga
//    su logo y horarios. El botón avanza siempre (no espera a la IA). ──
function PreparativosScreen({ formData, patch, indicator, onContinue }: {
  formData: any; patch: (p: any) => void; indicator: React.ReactNode; onContinue: () => void
}) {
  const agregarTurno = () => patch({ turnos: [...formData.turnos, { horaApertura: '09:00', horaCierre: '18:00' }] })
  const setTurno = (idx: number, field: string, value: string) => {
    const t = [...formData.turnos]; t[idx] = { ...t[idx], [field]: value }; patch({ turnos: t })
  }
  const delTurno = (idx: number) => patch({ turnos: formData.turnos.filter((_: any, i: number) => i !== idx) })

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Estado de la lectura de la carta (corre en segundo plano) */}
      {indicator}

      {/* Tiempo muerto aprovechado: logo + horarios */}
      <p className="text-sm text-muted-foreground mt-8 mb-4">Mientras tanto, dejemos tu local listo:</p>

      <div className="space-y-6">
        <div>
          <Label className="text-sm font-medium text-muted-foreground mb-2 block text-center">Tu logo</Label>
          <div className="mx-auto w-60">
            <ImageUpload square onImageChange={(b64) => patch({ logo: b64 })} currentImage={formData.logo} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium text-muted-foreground">Horarios de atención</Label>
            <Button variant="ghost" size="sm" onClick={agregarTurno} className="text-[#FF7A00] h-7 text-xs px-2"><Plus className="h-3 w-3 mr-1" />Turno</Button>
          </div>
          <div className="space-y-2">
            {formData.turnos.map((t: any, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <input type="time" value={t.horaApertura} onChange={(e) => setTurno(i, 'horaApertura', e.target.value)} className="flex-1 h-11 rounded-xl bg-zinc-100 dark:bg-zinc-900 border-0 px-3 text-sm outline-none focus:ring-2 focus:ring-[#FF7A00]/30" />
                <span className="text-muted-foreground text-sm">a</span>
                <input type="time" value={t.horaCierre} onChange={(e) => setTurno(i, 'horaCierre', e.target.value)} className="flex-1 h-11 rounded-xl bg-zinc-100 dark:bg-zinc-900 border-0 px-3 text-sm outline-none focus:ring-2 focus:ring-[#FF7A00]/30" />
                <Button variant="ghost" size="icon" onClick={() => delTurno(i)} className="h-11 w-11 text-muted-foreground hover:text-red-500 shrink-0"><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
              <Clock className="h-3.5 w-3.5" /> Se aplica a todos los días. Lo cambiás después.
            </div>
          </div>
        </div>
      </div>

      <Button onClick={onContinue}
        className="w-full h-14 mt-8 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white active:scale-[0.985] transition-all">
        Continuar <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  )
}

export default Onboarding
