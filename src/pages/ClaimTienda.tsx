import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams } from 'react-router'
import { MapContainer, TileLayer, Circle, Polygon, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'
import 'leaflet-draw'
import {
  Loader2, Check, Store, MessageCircle, ArrowLeft, Pencil, ImagePlus, X, Save,
  Banknote, MapPin, UtensilsCrossed, CreditCard, Wallet, Minus, Plus,
  ShoppingBag, ArrowRight, Mail, Eye, EyeOff, CircleHelp,
  Printer, MonitorSmartphone, Armchair, ChevronDown, CircleCheck, Maximize2, Download,
  Package, Bike, Calculator, Ticket,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/authStore'
import { AddressAutocomplete } from '@/components/AddressAutocomplete'
import {
  claimApi, restauranteApi, zonasDeliveryApi, suscripcionApi, modulosApi, sucursalesApi, mesasLocalesApi, ApiError,
  pedidoUnificadoApi, productosApi,
  type ClaimTienda as ClaimTiendaData, type ClaimInventario, type ClaimConfig, type MiSuscripcion, type Modulo,
} from '@/lib/api'
import { TiendaPreview } from '@/components/TiendaPreview'
import { marcarRecorridoVisto } from '@/lib/recorridoPanel'
import { IntroZonas } from './claim/IntroZonas'
import { AprenderPanel } from './claim/AprenderPanel'

const CODE_LENGTH = 6
const RESEND_COOLDOWN = 45 // segundos
// Centro por defecto del mapa cuando la tienda no tiene dirección geocodificada (Córdoba capital).
const DEFAULT_CENTER: [number, number] = [-31.4201, -64.1888]

/**
 * Claim de tienda (onboarding outbound) — ruta pública `/mi-tienda/:token`, SIN login.
 *
 * El dueño llega por el link que Facu le mandó por WhatsApp. Ya es cliente (la venta está cerrada) y
 * la tienda ya está construida: esta pantalla NO le vende nada. Lo lleva a completar lo que sólo él
 * sabe y a aprender a manejar el panel.
 *
 * - Lo que Facu nunca conoce (el alias, las zonas de delivery) se abre directo para completar.
 * - Lo que ya está cargado (la dirección, el WhatsApp) se muestra como listo, con opción a cambiarlo.
 * - Si el local tiene página propia (`<tienda>.piru.app`), nunca se le muestra el link compartido.
 *
 * Los cambios NO se guardan en el momento (todavía no hay sesión): quedan en un borrador local
 * (`draft`) y se persisten de una vez cuando el dueño crea su acceso.
 *
 * Flujo: recorrido (`walk`: local, carta, sucursales, cobros, entregas, WhatsApp, acceso) → código
 * por WhatsApp (`codigo`) o mail y contraseña → persistir borrador → cómo trabaja (`modos`, con
 * impresión, POS, mesas y herramientas incluidas) → configuración elegida (impresión y/o mesas) →
 * pedido de prueba (`prueba`) → aprender el panel (`aprender`) → panel.
 */
type Paso = 'walk' | 'codigo' | 'modos' | 'configImpresion' | 'configMesas' | 'prueba' | 'aprender'
type ModoUso = 'impresion' | 'pos'
type PasoPostClaim = Exclude<Paso, 'walk' | 'codigo'>

type ProgresoClaim = {
  restauranteId: number
  paso: PasoPostClaim
  tienda: ClaimTiendaData
  telefono: string
  modosActivos: ModoUso[]
  activarMesasConPos: boolean
  mesasActivas: boolean
  cantidadMesas: number
}

// Base de la tienda pública del local (mismo formato que el link que ve el dueño en el recorrido).
const STORE_BASE = 'https://piru.app'
const WHATSAPP_HELP_NUMBER = '5493408681915'
const LATEST_DESKTOP_JSON_URL = 'https://api.piru.app/public/updates/latest.json'
const DESKTOP_DOWNLOAD_FALLBACK = 'https://piru.app'
const PASOS_POST_CLAIM: PasoPostClaim[] = ['modos', 'configImpresion', 'configMesas', 'prueba', 'aprender']
// Progreso guardado por una versión anterior del claim, que tenía otros pasos.
const PASOS_RENOMBRADOS: Record<string, PasoPostClaim> = { crecimiento: 'modos', plan: 'aprender' }

const progresoClaimKey = (claimToken: string) => `piru:claim-progress:${claimToken}`

function leerProgresoClaim(claimToken: string, restauranteId?: number): ProgresoClaim | null {
  if (!claimToken || !restauranteId || typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(progresoClaimKey(claimToken))
    if (!raw) return null
    const progreso = JSON.parse(raw) as Partial<ProgresoClaim>
    if (progreso.restauranteId !== restauranteId) return null
    const paso = PASOS_RENOMBRADOS[progreso.paso as string] ?? progreso.paso
    if (!paso || !PASOS_POST_CLAIM.includes(paso as PasoPostClaim)) return null
    if (!progreso.tienda || typeof progreso.tienda !== 'object') return null
    return {
      restauranteId,
      paso: paso as PasoPostClaim,
      tienda: progreso.tienda as ClaimTiendaData,
      telefono: typeof progreso.telefono === 'string' ? progreso.telefono : '',
      modosActivos: Array.isArray(progreso.modosActivos)
        ? progreso.modosActivos.filter((modo): modo is ModoUso => modo === 'impresion' || modo === 'pos')
        : [],
      activarMesasConPos: progreso.activarMesasConPos === true,
      mesasActivas: progreso.mesasActivas === true,
      cantidadMesas: Math.min(100, Math.max(1, Number(progreso.cantidadMesas) || 10)),
    }
  } catch {
    return null
  }
}

// Motivos de link no reclamable, para mostrar el mensaje correcto (y a dónde mandar al dueño).
type Bloqueo = { titulo: string; detalle: string; irALogin?: boolean } | null
type WhatsAppHelp = { label: string; message: string }

// ── Borrador local de ediciones (se persiste al confirmar el WhatsApp) ──
type PagosDraft = { efectivo: boolean; transferenciaManual: boolean; transferenciaAlias: string }
type ZonaDraft = { nombre: string; precio: string; poligono: { lat: number; lng: number }[]; color: string }
type TiposPedidoDraft = { delivery: boolean; takeaway: boolean }
type DeliveryDraft =
  | { mode: 'radio'; precio: string; radius: number; center: { lat: number; lng: number }; address: string }
  | { mode: 'zonas'; zonas: ZonaDraft[]; center: { lat: number; lng: number }; address: string }
type ModalidadSucursales = 'unica' | 'multiple'
type SucursalDraft = {
  localId: string
  nombre: string
  address: string
  center: { lat: number; lng: number } | null
  pagos: PagosDraft
  whatsappNumber: string
  delivery?: DeliveryDraft
}
type Draft = {
  nombre?: string
  logo?: string
  pagos?: PagosDraft
  tiposPedido?: TiposPedidoDraft
  delivery?: DeliveryDraft
  modalidadSucursales?: ModalidadSucursales
  sucursales?: SucursalDraft[]
}

// ── Tarjeta del recorrido ──
type Card =
  | { kind: 'intro' }
  | { kind: 'productos' }
  | { kind: 'modalidadSucursales' }
  | { kind: 'sucursales' }
  | { kind: 'pagos' }
  | { kind: 'delivery' }
  | { kind: 'pagosSucursal'; sucursalIdx: number }
  | { kind: 'deliverySucursal'; sucursalIdx: number }
  | { kind: 'mensaje' }
  | { kind: 'whatsapps' }
  | { kind: 'reassure'; id: string; icon: LucideIcon; titulo: string; valor: string }
  | { kind: 'acceso' }

// En qué parte del recorrido está cada tarjeta: se muestra arriba, junto a la barra de progreso.
const SECCION: Record<Card['kind'], string> = {
  intro: 'Bienvenida',
  productos: 'Tu carta',
  modalidadSucursales: 'Tu local',
  sucursales: 'Tu local',
  pagos: 'Cobros',
  pagosSucursal: 'Cobros',
  delivery: 'Entregas',
  deliverySucursal: 'Entregas',
  reassure: 'Tu local',
  mensaje: 'Pedidos',
  whatsapps: 'Pedidos',
  acceso: 'Tu acceso',
}

// Herramientas incluidas que se pueden prender en el paso "Cómo trabajás" (además de impresión y
// POS). El catálogo real (`misModulos`) decide cuáles están disponibles para la cuenta.
const HERRAMIENTAS_INCLUIDAS: Array<{ codigo: string; icon: LucideIcon; titulo: string; texto: string }> = [
  { codigo: 'gestion_cadetes', icon: Bike, titulo: 'Tengo repartidores propios', texto: 'Asignás cada envío a un cadete y al cierre sabés cuánto rinde cada uno.' },
  { codigo: 'cierre_turno_manual', icon: Calculator, titulo: 'Abro y cierro la caja por turno', texto: 'Ves qué entró por cada medio de pago y las diferencias del turno.' },
  { codigo: 'gestion_stock', icon: Package, titulo: 'Quiero controlar el stock', texto: 'Cada venta descuenta los insumos de la receta y te avisa antes de quedarte sin nada.' },
  { codigo: 'codigos_descuento', icon: Ticket, titulo: 'Voy a usar cupones', texto: 'Promos como MARTES20, con vencimiento y límite de usos.' },
]

const fmtPrecio = (n: number | string | null | undefined) => Number(n ?? 0).toLocaleString('es-AR')

// Redimensiona una imagen a máx. 800px por lado y la exporta como JPEG (mantiene liviano el borrador).
async function fileToLogoDataUrl(file: File, maxDim = 800, quality = 0.85): Promise<string> {
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

// Recentra el mapa cuando cambia el centro (p. ej. al elegir otra dirección).
function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center)
    const t = setTimeout(() => map.invalidateSize(), 200)
    return () => clearTimeout(t)
  }, [center, map])
  return null
}

// Recalcula el tamaño del mapa al montar/cambiar layout (fix clásico de Leaflet).
function MapResizer({ dep }: { dep?: unknown }) {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 250)
    return () => clearTimeout(t)
  }, [dep, map])
  return null
}

const ZONE_COLORS = ['#FF7A00', '#3b82f6', '#ef4444', '#22c55e', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']
function getNextColor(usados: (string | null)[]): string {
  const disponibles = ZONE_COLORS.filter((c) => !usados.includes(c))
  return disponibles.length > 0 ? disponibles[0] : ZONE_COLORS[usados.length % ZONE_COLORS.length]
}

// leaflet-draw viene en inglés: el dueño ve los mismos textos que le explica IntroZonas.
const drawLocal = (L as any).drawLocal
if (drawLocal) {
  drawLocal.draw.toolbar.buttons.polygon = 'Dibujar una zona'
  drawLocal.draw.toolbar.actions = { title: 'Cancelar el dibujo', text: 'Cancelar' }
  drawLocal.draw.toolbar.finish = { title: 'Terminar la zona', text: 'Terminar' }
  drawLocal.draw.toolbar.undo = { title: 'Borrar el último punto', text: 'Borrar último punto' }
  drawLocal.draw.handlers.polygon.tooltip = {
    start: 'Tocá el mapa en la primera esquina de la zona.',
    cont: 'Tocá la siguiente esquina.',
    end: 'Tocá el primer punto para cerrar la zona.',
  }
}

// Control de dibujo de polígonos (leaflet-draw). Al terminar un polígono emite sus vértices.
function DrawControl({ onPolygonCreated }: { onPolygonCreated: (coords: { lat: number; lng: number }[]) => void }) {
  const map = useMap()
  useEffect(() => {
    const drawnItems = new L.FeatureGroup()
    map.addLayer(drawnItems)
    const drawControl = new (L.Control as any).Draw({
      draw: {
        polygon: { allowIntersection: true, showArea: true, shapeOptions: { color: '#FF7A00', weight: 2, fillOpacity: 0.15 } },
        polyline: false, rectangle: false, circle: false, marker: false, circlemarker: false,
      },
      edit: { featureGroup: drawnItems, remove: false, edit: false },
    })
    map.addControl(drawControl)
    const handler = (event: any) => {
      const latLngs = event.layer.getLatLngs()[0] as L.LatLng[]
      onPolygonCreated(latLngs.map((ll) => ({ lat: ll.lat, lng: ll.lng })))
    }
    map.on((L as any).Draw.Event.CREATED, handler)
    return () => {
      map.off((L as any).Draw.Event.CREATED, handler)
      map.removeControl(drawControl)
      map.removeLayer(drawnItems)
    }
  }, [map, onPolygonCreated])
  return null
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

export default function ClaimTienda() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const restauranteAutenticado = useAuthStore((s) => s.restaurante)
  const progresoInicial = useRef<ProgresoClaim | null>(leerProgresoClaim(token, restauranteAutenticado?.id))

  const [loading, setLoading] = useState(true)
  const [bloqueo, setBloqueo] = useState<Bloqueo>(null)
  const [tienda, setTienda] = useState<ClaimTiendaData | null>(progresoInicial.current?.tienda ?? null)
  const [inventario, setInventario] = useState<ClaimInventario | null>(null)
  const [config, setConfig] = useState<ClaimConfig | null>(null)
  const [storeProducts, setStoreProducts] = useState<any[]>([])
  const [pedidoOk, setPedidoOk] = useState(false)

  const [paso, setPaso] = useState<Paso>(progresoInicial.current?.paso ?? 'walk')
  const [cardIdx, setCardIdx] = useState(0)
  const [enviando, setEnviando] = useState(false)
  // Suscripción base + trial para la pantalla informativa final; se trae tras verificar.
  const [miSusc, setMiSusc] = useState<MiSuscripcion | null>(null)
  // Pago inmediato de la suscripción base desde el claim (opcional: saltear la prueba y pagar ya).
  const [pagandoSuscripcion, setPagandoSuscripcion] = useState(false)

  // WhatsApp es el funcionamiento base y siempre está disponible. Sólo Impresión y POS son
  // alternativas desplegables que activan módulos incluidos.
  const [modosAbiertos, setModosAbiertos] = useState<ModoUso[]>([])
  const [modosActivos, setModosActivos] = useState<ModoUso[]>(progresoInicial.current?.modosActivos ?? [])
  const [activandoModo, setActivandoModo] = useState<ModoUso | null>(null)
  const [activarMesasConPos, setActivarMesasConPos] = useState(progresoInicial.current?.activarMesasConPos ?? false)
  const [mesasActivas, setMesasActivas] = useState(progresoInicial.current?.mesasActivas ?? false)
  const [cantidadMesas, setCantidadMesas] = useState(progresoInicial.current?.cantidadMesas ?? 10)
  const [creandoMesas, setCreandoMesas] = useState(false)
  const [desktopDownloadUrl, setDesktopDownloadUrl] = useState(DESKTOP_DOWNLOAD_FALLBACK)
  const [desktopVersion, setDesktopVersion] = useState<string | null>(null)
  const [buscandoDescarga, setBuscandoDescarga] = useState(false)

  // Borrador de ediciones inline, se persiste al confirmar el WhatsApp.
  const [draft, setDraft] = useState<Draft>({})
  // Qué tarjeta está en modo edición, y buffers del editor de nombre y logo.
  const [editing, setEditing] = useState<string | null>(null)
  const [tmpText, setTmpText] = useState('')
  const [tmpLogo, setTmpLogo] = useState<string | null>(null)
  const [subiendoLogo, setSubiendoLogo] = useState(false)

  const [telefono, setTelefono] = useState(progresoInicial.current?.telefono ?? '')
  // Con un WhatsApp ya cargado se muestra como listo; "Usar otro número" abre el campo.
  const [usarOtroNumero, setUsarOtroNumero] = useState(false)
  // Cómo va a entrar al panel: código por WhatsApp o mail y contraseña.
  const [metodoAcceso, setMetodoAcceso] = useState<'whatsapp' | 'email' | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verPassword, setVerPassword] = useState(false)

  // Estado del OTP (paso 2)
  const [verificationId, setVerificationId] = useState<string | null>(null)
  const [telefonoEnmascarado, setTelefonoEnmascarado] = useState<string | null>(null)
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''))
  const [verificando, setVerificando] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const inputsRef = useRef<Array<HTMLInputElement | null>>([])
  const submittingRef = useRef(false)

  // Esta ruta pública vive fuera de DashboardLayout, así que aplica por sí misma la preferencia
  // guardada del panel. También escucha cambios para mantenerse sincronizada si Ajustes está
  // abierto en otra pestaña.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = () => {
      const stored = localStorage.getItem('piru-theme')
      document.documentElement.classList.toggle('dark', stored ? stored === 'dark' : media.matches)
    }
    const handleStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === 'piru-theme') applyTheme()
    }
    const handleSystemTheme = () => {
      if (!localStorage.getItem('piru-theme')) applyTheme()
    }

    applyTheme()
    window.addEventListener('storage', handleStorage)
    media.addEventListener('change', handleSystemTheme)
    return () => {
      window.removeEventListener('storage', handleStorage)
      media.removeEventListener('change', handleSystemTheme)
    }
  }, [])

  // Preview de la tienda reclamable
  useEffect(() => {
    // Después de verificar el teléfono el preview público deja de estar disponible por diseño. Si
    // este navegador conserva la sesión del mismo restaurante, retomamos el progreso guardado sin
    // volver a consultar el endpoint público ni mostrar el falso bloqueo "ya es tuya".
    const tokenReanudacion = useAuthStore.getState().token
    if (progresoInicial.current && tokenReanudacion) {
      setLoading(false)
      suscripcionApi.miSuscripcion(tokenReanudacion).then((res) => setMiSusc(res.data)).catch(() => {})
      return
    }
    let cancel = false
    setLoading(true)
    claimApi
      .preview(token)
      .then((r) => {
        if (cancel) return
        setTienda(r.tienda)
        setInventario(r.inventario)
        setConfig(r.config ?? null)
      })
      .catch((e) => {
        if (cancel) return
        setBloqueo(mapBloqueo(e))
      })
      .finally(() => !cancel && setLoading(false))
    return () => {
      cancel = true
    }
  }, [token])

  // Guarda sólo el tramo autenticado. El ID evita que una sesión de otro restaurante pueda
  // reanudar el claim aunque conozca o abra este mismo link.
  useEffect(() => {
    if (!restauranteAutenticado?.id || !tienda || !PASOS_POST_CLAIM.includes(paso as PasoPostClaim)) return
    const progreso: ProgresoClaim = {
      restauranteId: restauranteAutenticado.id,
      paso: paso as PasoPostClaim,
      tienda,
      telefono,
      modosActivos,
      activarMesasConPos,
      mesasActivas,
      cantidadMesas,
    }
    localStorage.setItem(progresoClaimKey(token), JSON.stringify(progreso))
  }, [token, restauranteAutenticado?.id, tienda, telefono, paso, modosActivos, activarMesasConPos, mesasActivas, cantidadMesas])

  // Cuenta regresiva para reenviar el código
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  useEffect(() => {
    const authToken = useAuthStore.getState().token
    if (paso === 'prueba' && storeProducts.length === 0) {
      if (authToken) {
        productosApi.getAll(authToken)
          .then((res: any) => setStoreProducts(res.productos || []))
          .catch(() => {})
      } else if (config?.productos) {
        setStoreProducts(config.productos.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          descripcion: p.descripcion || '',
          precio: p.precio,
        })))
      }
    }
  }, [paso, config, storeProducts.length])

  const hacerPedidoPrueba = async (
    items: { productoId: number; cantidad: number }[],
    meta: { nombreCliente: string; notas: string },
  ) => {
    const authToken = useAuthStore.getState().token
    if (!authToken || items.length === 0) return
    try {
      await pedidoUnificadoApi.create(authToken, {
        tipo: 'takeaway',
        nombreCliente: meta.nombreCliente || 'Pedido de prueba',
        notas: meta.notas || 'Pedido de prueba generado en el claim',
        anotadoManualmente: true,
        notificarWhatsappPrueba: true,
        items,
      })
      await new Promise((r) => setTimeout(r, 3500))
      setPedidoOk(true)
    } catch (e: any) {
      toast.error('No se pudo crear el pedido', { description: e?.message })
      throw e
    }
  }

  // La URL del instalador cambia con cada release. Usamos la misma fuente que el banner de Ajustes
  // y conservamos la landing como fallback si el manifiesto no responde.
  useEffect(() => {
    if (paso !== 'configImpresion') return
    let vigente = true
    setBuscandoDescarga(true)
    fetch(LATEST_DESKTOP_JSON_URL)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { version?: string; platforms?: { 'windows-x86_64'?: { url?: string } } }) => {
        if (!vigente) return
        const url = data.platforms?.['windows-x86_64']?.url
        if (url) setDesktopDownloadUrl(url)
        if (data.version) setDesktopVersion(data.version)
      })
      .catch(() => {})
      .finally(() => vigente && setBuscandoDescarga(false))
    return () => { vigente = false }
  }, [paso])

  // Valores mostrados: el borrador pisa lo que vino del backend.
  const dispNombre = draft.nombre ?? tienda?.nombre ?? ''
  const dispUsername = tienda?.username ?? ''
  const dispLogo = draft.logo ?? tienda?.imagenUrl ?? tienda?.imagenLightUrl ?? null
  // Dónde vive la tienda: su página propia (`<tienda>.piru.app`) o la compartida.
  const urlTienda = tienda?.urlTienda ?? (dispUsername ? `${STORE_BASE}/${dispUsername}` : null)
  // El WhatsApp que ya tiene la tienda, completo (el enmascarado sólo si el backend es anterior).
  const numeroCargado = tienda?.telefono
    ? `+${tienda.telefono}`
    : tienda?.telefonoEnmascarado ? `+54 ${tienda.telefonoEnmascarado}` : null
  const usaNumeroCargado = !!numeroCargado && !usarOtroNumero && draft.modalidadSucursales !== 'multiple'

  // Estado de pagos mostrado (borrador o config del backend).
  const pagosView: PagosDraft = draft.pagos ?? {
    efectivo: config?.pagos.efectivo ?? true,
    transferenciaManual: config?.pagos.transferenciaManual ?? false,
    transferenciaAlias: config?.pagos.transferenciaAlias ?? '',
  }
  const tiposPedidoView: TiposPedidoDraft = draft.tiposPedido ?? {
    delivery: config?.delivery.deliveryEnabled ?? true,
    takeaway: config?.delivery.takeawayEnabled ?? true,
  }

  // La dirección que ya tiene el local, para mostrarla como cargada en Entregas.
  const direccionCargada = useMemo(() => {
    const lat = config?.delivery.lat
    const lng = config?.delivery.lng
    if (lat == null || lng == null) return null
    return { address: config?.delivery.direccion ?? '', center: { lat, lng } }
  }, [config])

  // Centro del mapa: dirección del local → 1ª zona → default.
  const mapCenter = useMemo<[number, number]>(() => {
    if (config?.delivery.lat != null && config?.delivery.lng != null) return [config.delivery.lat, config.delivery.lng]
    const p = config?.delivery.zonas?.[0]?.poligono?.[0]
    if (p) return [p.lat, p.lng]
    return DEFAULT_CENTER
  }, [config])

  // ── Recorrido: después de la carta se bifurca entre local único y múltiples sucursales. ──
  const cards = useMemo<Card[]>(() => {
    if (!tienda) return []
    const inv = inventario
    const list: Card[] = [{ kind: 'intro' }]

    if (config) {
      if (config.productos.length > 0) list.push({ kind: 'productos' })
      list.push({ kind: 'modalidadSucursales' })
      if (draft.modalidadSucursales === 'multiple') {
        list.push({ kind: 'sucursales' })
        for (let i = 0; i < (draft.sucursales?.length ?? 0); i++) {
          list.push({ kind: 'pagosSucursal', sucursalIdx: i })
          list.push({ kind: 'deliverySucursal', sucursalIdx: i })
        }
      } else if (draft.modalidadSucursales === 'unica') {
        list.push({ kind: 'pagos' })
        list.push({ kind: 'delivery' })
      }
    } else if ((inv?.productos ?? 0) > 0) {
      // Backend viejo sin `config`: sólo el resumen de la carta.
      const n = inv!.productos
      list.push({ kind: 'reassure', id: 'menu', icon: UtensilsCrossed, titulo: 'Tu carta', valor: `${n} ${n === 1 ? 'producto cargado' : 'productos cargados'}` })
    }

    // Cómo le llega un pedido al local, a qué WhatsApp, y con qué va a entrar al panel.
    list.push({ kind: 'mensaje' })
    list.push({ kind: 'whatsapps' })
    list.push({ kind: 'acceso' })
    return list
  }, [tienda, inventario, config, draft.modalidadSucursales, draft.sucursales])

  const card = cards[cardIdx]

  // El CTA de ayuda acompaña todo el onboarding. Tanto el texto visible como el mensaje que llega
  // a WhatsApp explican en qué pantalla está el dueño, para poder asistirlo sin pedirle contexto.
  const whatsappHelp = useMemo<WhatsAppHelp>(() => {
    const local = dispNombre ? ` de ${dispNombre}` : ''
    const help = (label: string, context: string): WhatsAppHelp => ({
      label,
      message: `Hola Facu, estoy terminando de configurar mi tienda${local} en Piru. ${context}`,
    })

    if (loading) return help('Consultar por mi tienda', 'Quería consultarte por el acceso a mi tienda.')
    if (bloqueo) return help('Ayuda para ingresar', `Me aparece este mensaje: “${bloqueo.titulo}”. ¿Me ayudás a ingresar?`)

    if (paso === 'codigo') return help('Ayuda con el código', 'Estoy en la verificación de WhatsApp y necesito ayuda con el código.')
    if (paso === 'modos') return help('Ayuda para elegir', 'Estoy eligiendo cómo trabajo en el local (impresora, mostrador, mesas) y necesito que me recomiendes.')
    if (paso === 'configImpresion') return help('Ayuda con la impresión', 'Estoy configurando la impresión automática y necesito ayuda para instalar o conectar la app.')
    if (paso === 'configMesas') return help('Ayuda con mis mesas', 'Estoy armando el plano inicial de mesas y necesito ayuda para configurarlo.')
    if (paso === 'prueba') return help('Ayuda con el pedido de prueba', 'Estoy por hacer el pedido de prueba y tengo una consulta.')
    if (paso === 'aprender') return help('Consultar por el panel', 'Estoy aprendiendo a usar el panel y tengo una consulta.')

    if (!card) return help('Hablar con Facu', 'Necesito ayuda para continuar con la configuración.')

    if (editing) {
      const editingContext: Record<string, string> = {
        intro: 'Estoy cambiando el nombre o el logo de mi local y necesito ayuda.',
        sucursales: 'Estoy cargando las sucursales y necesito ayuda.',
      }
      const editingKey = editing.split(':')[0]
      return help('Ayuda con este cambio', editingContext[editingKey] ?? 'Estoy modificando esta configuración y necesito ayuda.')
    }

    switch (card.kind) {
      case 'intro':
        return help('Hablar con Facu', 'Estoy empezando a configurar lo que falta.')
      case 'productos':
        return help('Consultar por mi carta', 'Estoy revisando los productos de mi carta y tengo una consulta.')
      case 'modalidadSucursales':
        return help('Ayuda con mis sucursales', 'Estoy eligiendo si configurar una o varias sucursales y necesito ayuda.')
      case 'sucursales':
        return help('Configurar mis sucursales', 'Estoy cargando los nombres y direcciones de mis sucursales y necesito ayuda.')
      case 'pagos':
        return help('Ayuda con mi alias', 'Estoy cargando mi alias y los medios de pago y tengo una consulta.')
      case 'pagosSucursal': {
        const sucursal = draft.sucursales?.[card.sucursalIdx]?.nombre ?? `Sucursal ${card.sucursalIdx + 1}`
        return help('Ayuda con mi alias', `Estoy cargando el alias y los medios de pago de ${sucursal} y necesito ayuda.`)
      }
      case 'delivery':
        return help('Ayuda con mis zonas', 'Estoy dibujando mis zonas de delivery y necesito ayuda.')
      case 'deliverySucursal': {
        const sucursal = draft.sucursales?.[card.sucursalIdx]?.nombre ?? `Sucursal ${card.sucursalIdx + 1}`
        return help('Ayuda con mis zonas', `Estoy dibujando la zona de delivery de ${sucursal} y necesito ayuda.`)
      }
      case 'mensaje':
        return help('Consultar por los pedidos', 'Estoy viendo cómo me van a llegar los pedidos y tengo una consulta.')
      case 'whatsapps':
        return help('Ayuda con los números', 'Estoy configurando el WhatsApp donde me llegan los pedidos y necesito ayuda.')
      case 'acceso':
        return help('Ayuda con mi acceso', 'Estoy creando mi acceso al panel y necesito ayuda.')
      case 'reassure':
        return help('Consultar esta configuración', `Estoy revisando “${card.titulo}” y tengo una consulta.`)
    }
  }, [bloqueo, card, dispNombre, draft.sucursales, editing, loading, paso])

  const goCard = (i: number) => {
    setEditing(null)
    setCardIdx(Math.max(0, Math.min(i, cards.length - 1)))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const continuar = () => goCard(cardIdx + 1)

  // ── Editor inline de la bienvenida (nombre + logo) ──
  const abrirEditor = (kind: string) => {
    if (kind === 'intro') {
      setTmpText(dispNombre)
      setTmpLogo(dispLogo)
    }
    setEditing(kind)
  }
  const cancelarEditor = () => setEditing(null)

  const guardarIdentidad = () => {
    const v = tmpText.trim()
    if (v.length < 2) return toast.error('El nombre es muy corto')
    setDraft((d) => ({ ...d, nombre: v, ...(tmpLogo && tmpLogo !== dispLogo ? { logo: tmpLogo } : {}) }))
    setEditing(null)
  }
  const elegirLogo = async (files: FileList | null) => {
    const f = files?.[0]
    if (!f || !f.type.startsWith('image/')) return
    setSubiendoLogo(true)
    try {
      setTmpLogo(await fileToLogoDataUrl(f))
    } catch {
      toast.error('No se pudo procesar la imagen')
    } finally {
      setSubiendoLogo(false)
    }
  }

  const validarPagos = (pagos: PagosDraft, sucursal?: string) => {
    if (pagos.transferenciaManual && !pagos.transferenciaAlias.trim()) {
      toast.error(sucursal ? `Escribí el alias de ${sucursal}` : 'Escribí tu alias o CBU')
      return false
    }
    if (!pagos.efectivo && !pagos.transferenciaManual && !config?.pagos.autoTransferAvailable && !config?.pagos.mpConnected) {
      toast.error('Dejá al menos un medio de pago activo')
      return false
    }
    return true
  }

  const guardarPagos = (pagos: PagosDraft) => {
    if (!validarPagos(pagos)) return
    setDraft((d) => ({ ...d, pagos: { ...pagos, transferenciaAlias: pagos.transferenciaAlias.trim() } }))
    continuar()
  }

  const guardarPagosSucursal = (idx: number, pagos: PagosDraft) => {
    if (!validarPagos(pagos, draft.sucursales?.[idx]?.nombre)) return
    setDraft((prev) => ({
      ...prev,
      sucursales: prev.sucursales?.map((s, i) => i === idx
        ? { ...s, pagos: { ...pagos, transferenciaAlias: pagos.transferenciaAlias.trim() } }
        // Efectivo/transferencia son capacidades generales; el alias sí pertenece a cada sucursal.
        : { ...s, pagos: { ...s.pagos, efectivo: pagos.efectivo, transferenciaManual: pagos.transferenciaManual } }),
    }))
    continuar()
  }

  const elegirModalidadSucursales = (modalidad: ModalidadSucursales) => {
    const basePagos = { ...pagosView, transferenciaAlias: '' }
    const firstCenter = direccionCargada?.center ?? { lat: mapCenter[0], lng: mapCenter[1] }
    setDraft((prev) => ({
      ...prev,
      modalidadSucursales: modalidad,
      sucursales: modalidad === 'multiple'
        ? (prev.sucursales?.length ? prev.sucursales : [
            { localId: crypto.randomUUID(), nombre: 'Casa central', address: direccionCargada?.address ?? '', center: direccionCargada ? firstCenter : null, pagos: { ...basePagos }, whatsappNumber: '' },
            { localId: crypto.randomUUID(), nombre: 'Sucursal 2', address: '', center: null, pagos: { ...basePagos }, whatsappNumber: '' },
          ])
        : undefined,
    }))
    setCardIdx((idx) => idx + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const guardarSucursales = (sucursales: SucursalDraft[]) => {
    setDraft((prev) => ({ ...prev, sucursales }))
    setEditing(null)
    continuar()
  }

  const guardarEntregaSucursal = (idx: number, delivery?: DeliveryDraft) => {
    if (delivery) {
      setDraft((prev) => ({
        ...prev,
        tiposPedido: { delivery: true, takeaway: prev.tiposPedido?.takeaway ?? (config?.delivery.takeawayEnabled ?? true) },
        sucursales: prev.sucursales?.map((s, i) => i === idx
          ? { ...s, address: delivery.address, center: delivery.center, delivery }
          : s),
      }))
    }
    continuar()
  }

  const guardarEntrega = (tiposPedido: TiposPedidoDraft, delivery?: DeliveryDraft) => {
    // Al pasar a sólo takeaway descartamos una edición previa de zonas del borrador.
    setDraft((prev) => ({ ...prev, tiposPedido, delivery }))
    continuar()
  }

  // Normaliza el WhatsApp tipeado: sólo dígitos + prefijo 54 si falta.
  const normalizarTelefono = (raw: string): string | null => {
    let limpio = raw.replace(/\D/g, '')
    if (limpio.length < 8) return null
    if (!limpio.startsWith('54')) limpio = `54${limpio}`
    return limpio
  }

  const guardarWhatsapps = () => {
    if (draft.modalidadSucursales === 'multiple') {
      const sucursales = draft.sucursales ?? []
      const normalizados = sucursales.map((s) => normalizarTelefono(s.whatsappNumber))
      if (normalizados.some((tel) => !tel)) return toast.error('Ingresá un WhatsApp válido para cada sucursal')
      const actualizadas = sucursales.map((s, i) => ({ ...s, whatsappNumber: normalizados[i]! }))
      setDraft((prev) => ({ ...prev, sucursales: actualizadas }))
      if (!normalizados.includes(normalizarTelefono(telefono))) setTelefono(normalizados[0]!)
    } else if (!usaNumeroCargado) {
      const normalizado = normalizarTelefono(telefono)
      if (!normalizado) return toast.error('Ingresá un número de WhatsApp válido')
      setTelefono(normalizado)
    }
    continuar()
  }

  // El número elegido para los pedidos; `undefined` = el que ya tiene la tienda.
  const telefonoElegido = () => usaNumeroCargado ? undefined : (normalizarTelefono(telefono) ?? undefined)

  const iniciarReclamo = async () => {
    const tel = telefonoElegido()
    if (!tel && !usaNumeroCargado) {
      toast.error('Ingresá un número de WhatsApp válido')
      return
    }
    setEnviando(true)
    try {
      const r = await claimApi.start(token, tel)
      setVerificationId(r.verificationId)
      setTelefonoEnmascarado(r.telefonoEnmascarado)
      setPaso('codigo')
      setCooldown(RESEND_COOLDOWN)
      setDigits(Array(CODE_LENGTH).fill(''))
      setTimeout(() => inputsRef.current[0]?.focus(), 50)
    } catch (e) {
      if (e instanceof ApiError && (e.response?.yaReclamada || e.response?.vencido)) {
        setBloqueo(mapBloqueo(e))
      } else {
        toast.error('No pudimos enviar el código', {
          description: e instanceof ApiError ? e.message : 'Probá de nuevo en un momento',
        })
      }
    } finally {
      setEnviando(false)
    }
  }

  // Persiste el borrador de ediciones con el token recién obtenido. Best-effort: si algo falla,
  // igual lo dejamos entrar (puede reintentar desde Ajustes).
  const persistirDraft = async (nuevoToken: string) => {
    // 1) Identidad: nombre / logo / WhatsApp de pedidos (+ dirección del local si la definió en el
    // delivery). El número es unificado: `telefono` actualiza también el de pedidos y comprobantes.
    const perfil: Record<string, string | number | null> = {}
    if (draft.nombre !== undefined) perfil.nombre = draft.nombre
    const telPedidos = draft.modalidadSucursales !== 'multiple' ? telefonoElegido() : undefined
    if (telPedidos) perfil.telefono = telPedidos
    if (draft.logo !== undefined) {
      perfil.image = draft.logo
      perfil.imageLight = draft.logo
    }
    const direccionPrincipal = draft.modalidadSucursales === 'multiple'
      ? draft.sucursales?.[0]
      : draft.delivery
    if (direccionPrincipal?.address && direccionPrincipal.center) {
      perfil.direccion = direccionPrincipal.address
      perfil.direccionTexto = direccionPrincipal.address
      perfil.direccionLat = direccionPrincipal.center.lat
      perfil.direccionLng = direccionPrincipal.center.lng
    }
    let algoFallo = false
    if (Object.keys(perfil).length > 0) {
      try { await restauranteApi.update(nuevoToken, perfil as Parameters<typeof restauranteApi.update>[1]) } catch { algoFallo = true }
    }

    // 2) Métodos de pago + alias.
    const pagosPersistir = draft.modalidadSucursales === 'multiple'
      ? draft.sucursales?.[0]?.pagos
      : draft.pagos
    if (pagosPersistir) {
      try {
        await restauranteApi.updateMetodosPago(nuevoToken, {
          efectivo: pagosPersistir.efectivo,
          transferenciaManual: pagosPersistir.transferenciaManual,
          transferenciaAlias: pagosPersistir.transferenciaManual ? pagosPersistir.transferenciaAlias : '',
        })
      } catch { algoFallo = true }
    }

    // 3) Tipos de pedido: se persisten con los mismos endpoints que usa Ajustes. Los endpoints son
    // toggles, por eso sólo los llamamos cuando el valor elegido difiere del que mostró el preview.
    if (draft.tiposPedido) {
      const deliveryActual = config?.delivery.deliveryEnabled ?? true
      const takeawayActual = config?.delivery.takeawayEnabled ?? true
      if (draft.tiposPedido.delivery !== deliveryActual) {
        try { await restauranteApi.toggleDeliveryEnabled(nuevoToken) } catch { algoFallo = true }
      }
      if (draft.tiposPedido.takeaway !== takeawayActual) {
        try { await restauranteApi.toggleTakeawayEnabled(nuevoToken) } catch { algoFallo = true }
      }
    }

    // 4) Multisucursal: el módulo es incluido y opt-in. Se activa antes de crear la segunda
    // sucursal; luego cada zona queda vinculada al id que devolvió el backend.
    if (draft.modalidadSucursales === 'multiple' && draft.sucursales?.length) {
      let zonasCreadas = 0
      try { await modulosApi.activar(nuevoToken, 'multisucursal') } catch { algoFallo = true }
      for (const sucursal of draft.sucursales) {
        try {
          const creada = await sucursalesApi.create(nuevoToken, {
            nombre: sucursal.nombre,
            direccion: sucursal.address,
            direccionLat: sucursal.center?.lat ?? null,
            direccionLng: sucursal.center?.lng ?? null,
            transferenciaAlias: sucursal.pagos.transferenciaManual ? sucursal.pagos.transferenciaAlias : null,
            whatsappEnabled: true,
            whatsappNumber: sucursal.whatsappNumber,
            activo: true,
          })
          if (!sucursal.delivery) continue
          const targets = sucursal.delivery.mode === 'radio'
            ? [{ nombre: 'Radio de reparto', precio: sucursal.delivery.precio || '0', poligono: circleToPolygon(sucursal.delivery.center, sucursal.delivery.radius), color: '#FF7A00' }]
            : sucursal.delivery.zonas.map((z) => ({ nombre: z.nombre, precio: z.precio || '0', poligono: z.poligono, color: z.color }))
          for (const zona of targets) {
            await zonasDeliveryApi.create(nuevoToken, { ...zona, sucursalId: creada.data.id })
            zonasCreadas++
          }
        } catch { algoFallo = true }
      }
      if (zonasCreadas > 0) {
        for (const zona of config?.delivery.zonas ?? []) {
          try { await zonasDeliveryApi.delete(nuevoToken, zona.id) } catch { algoFallo = true }
        }
      }
    }

    // 5) Local único: creamos las zonas nuevas y recién ahí borramos las viejas.
    if (draft.modalidadSucursales !== 'multiple' && draft.delivery) {
      const targets: Array<{ nombre: string; precio: string; poligono: { lat: number; lng: number }[]; color: string }> =
        draft.delivery.mode === 'radio'
          ? [{ nombre: 'Radio de reparto', precio: draft.delivery.precio || '0', poligono: circleToPolygon(draft.delivery.center, draft.delivery.radius), color: '#FF7A00' }]
          : draft.delivery.zonas.map((z) => ({ nombre: z.nombre, precio: z.precio || '0', poligono: z.poligono, color: z.color }))
      let creadas = 0
      for (const t of targets) {
        try { await zonasDeliveryApi.create(nuevoToken, t); creadas++ } catch { algoFallo = true }
      }
      if (creadas > 0) {
        for (const z of config?.delivery.zonas ?? []) {
          try { await zonasDeliveryApi.delete(nuevoToken, z.id) } catch { algoFallo = true }
        }
      }
    }

    if (algoFallo) {
      toast.error('Guardamos tu tienda, pero algún cambio no se aplicó', {
        description: 'Revisalo desde Ajustes cuando entres.',
      })
    }
  }

  // Con la sesión ya emitida (por código o por mail): guarda el progreso, aplica el borrador y sigue
  // con la configuración de cómo trabaja el local.
  const completarReclamo = async (r: { token: string; restaurante: Parameters<typeof setAuth>[1] }) => {
    setAuth(r.token, r.restaurante)
    // El claim ya quedó confirmado en el servidor. Persistimos el primer paso autenticado antes
    // de aplicar el borrador para que incluso una recarga inmediata pueda reanudar el recorrido.
    if (tienda) {
      const progreso: ProgresoClaim = {
        restauranteId: r.restaurante.id,
        paso: 'modos',
        tienda,
        telefono,
        modosActivos: [],
        activarMesasConPos: false,
        mesasActivas: false,
        cantidadMesas: 10,
      }
      localStorage.setItem(progresoClaimKey(token), JSON.stringify(progreso))
    }
    await persistirDraft(r.token)
    // La suscripción base + trial para el cierre del recorrido (best-effort, no bloquea).
    suscripcionApi.miSuscripcion(r.token).then((res) => setMiSusc(res.data)).catch(() => {})
    toast.success('Tu acceso quedó listo')
    setPaso('modos')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const submitCodigo = useCallback(
    async (codigo: string) => {
      if (!verificationId || codigo.length !== CODE_LENGTH) return
      if (submittingRef.current) return
      submittingRef.current = true
      setVerificando(true)
      try {
        const r = await claimApi.verify(token, verificationId, codigo)
        await completarReclamo(r)
      } catch (e) {
        setDigits(Array(CODE_LENGTH).fill(''))
        inputsRef.current[0]?.focus()
        toast.error('No pudimos verificar el código', {
          description: e instanceof ApiError ? e.message : 'Error de conexión',
        })
      } finally {
        setVerificando(false)
        submittingRef.current = false
      }
    },
    // completarReclamo depende de `draft`/`config`/`telefono`; los incluimos para la referencia actual.
    [verificationId, token, setAuth, draft, config, tienda, telefono, usarOtroNumero],
  )

  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const crearAccesoConEmail = async () => {
    if (!emailValido) return toast.error('Revisá el mail')
    if (password.length < 8) return toast.error('La contraseña necesita al menos 8 caracteres')
    setEnviando(true)
    try {
      const r = await claimApi.credenciales(token, { email: email.trim(), password, telefono: telefonoElegido() })
      await completarReclamo(r)
    } catch (e) {
      if (e instanceof ApiError && (e.response?.yaReclamada || e.response?.vencido)) {
        setBloqueo(mapBloqueo(e))
      } else {
        toast.error('No pudimos crear tu acceso', {
          description: e instanceof ApiError ? e.message : 'Probá de nuevo en un momento',
        })
      }
    } finally {
      setEnviando(false)
    }
  }

  const handleChange = (index: number, value: string) => {
    const clean = value.replace(/\D/g, '')
    if (!clean) {
      setDigits((prev) => {
        const next = [...prev]
        next[index] = ''
        return next
      })
      return
    }
    setDigits((prev) => {
      const next = [...prev]
      const chars = clean.split('')
      let i = index
      for (const ch of chars) {
        if (i >= CODE_LENGTH) break
        next[i] = ch
        i++
      }
      inputsRef.current[Math.min(i, CODE_LENGTH - 1)]?.focus()
      const joined = next.join('')
      if (joined.length === CODE_LENGTH && !next.includes('')) submitCodigo(joined)
      return next
    })
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) inputsRef.current[index - 1]?.focus()
  }

  const reenviar = async () => {
    if (cooldown > 0) return
    const tel = telefonoElegido()
    if (!tel && !usaNumeroCargado) {
      toast.error('Ingresá un número de WhatsApp válido')
      return
    }
    try {
      const r = await claimApi.start(token, tel)
      setVerificationId(r.verificationId)
      setTelefonoEnmascarado(r.telefonoEnmascarado)
      setCooldown(RESEND_COOLDOWN)
      setDigits(Array(CODE_LENGTH).fill(''))
      inputsRef.current[0]?.focus()
      toast.success('Código reenviado', { description: 'Revisá tu WhatsApp 📲' })
    } catch (e) {
      toast.error('No pudimos reenviar el código', {
        description: e instanceof ApiError ? e.message : 'Error de conexión',
      })
    }
  }

  // Pagar la suscripción base desde el claim (redirige a Checkout Pro). El checkout resuelve el
  // importe en el servidor y no puede activar módulos por este recorrido.
  const pagarSuscripcionAhora = async () => {
    const token = useAuthStore.getState().token
    if (!token) {
      navigate('/dashboard', { replace: true })
      return
    }
    setPagandoSuscripcion(true)
    try {
      const res = await suscripcionApi.checkout(token, 'mensual')
      window.location.href = res.data.url_pago
    } catch {
      toast.error('No se pudo iniciar el pago', { description: 'Podés activar tu suscripción desde el panel.' })
      setPagandoSuscripcion(false)
    }
  }

  const toggleModoAbierto = (modo: ModoUso) => {
    setModosAbiertos((actuales) => actuales.includes(modo)
      ? actuales.filter((item) => item !== modo)
      : [...actuales, modo])
  }

  const activarModoUso = async (modo: ModoUso) => {
    const authToken = useAuthStore.getState().token
    if (!authToken || modosActivos.includes(modo)) return
    setActivandoModo(modo)
    try {
      if (modo === 'impresion') await modulosApi.activar(authToken, 'impresion_comandas')
      if (modo === 'pos') {
        await modulosApi.activar(authToken, 'pos')
        if (activarMesasConPos) {
          await modulosApi.activar(authToken, 'mesas')
          setMesasActivas(true)
        }
      }
      setModosActivos((actuales) => [...actuales, modo])
      setModosAbiertos((actuales) => actuales.filter((item) => item !== modo))
      toast.success(modo === 'impresion'
          ? 'Impresión automática activada'
          : activarMesasConPos ? 'Punto de Venta y Mesas activados' : 'Punto de Venta activado')
    } catch (error) {
      toast.error('No pudimos activar esta forma de trabajo', {
        description: error instanceof Error ? error.message : 'Probá nuevamente en un momento.',
      })
    } finally {
      setActivandoModo(null)
    }
  }

  const irA = (siguiente: Paso) => {
    setPaso(siguiente)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const avanzarDesdeModos = () => irA(modosActivos.includes('impresion')
    ? 'configImpresion'
    : mesasActivas ? 'configMesas' : 'prueba')

  const avanzarDesdeImpresion = () => irA(mesasActivas ? 'configMesas' : 'prueba')

  const volverDesdePrueba = () => irA(mesasActivas
    ? 'configMesas'
    : modosActivos.includes('impresion') ? 'configImpresion' : 'modos')

  const crearPlanoInicialMesas = async () => {
    const authToken = useAuthStore.getState().token
    if (!authToken || creandoMesas) return
    setCreandoMesas(true)
    try {
      const existentes = (await mesasLocalesApi.list(authToken, true)).data
      const activas = existentes.filter((mesa) => mesa.activo)
      const faltantes = Math.max(0, cantidadMesas - activas.length)
      if (faltantes > 0) {
        const columnas = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(cantidadMesas))))
        const inicioY = activas.length > 0
          ? Math.max(...activas.map((mesa) => mesa.posicionY + mesa.alto)) + 1
          : 0
        await Promise.all(Array.from({ length: faltantes }, (_, indice) => {
          const orden = activas.length + indice
          return mesasLocalesApi.create(authToken, {
            nombre: `Mesa ${orden + 1}`,
            sucursalId: null,
            posicionX: (indice % columnas) * 3,
            posicionY: inicioY + Math.floor(indice / columnas) * 3,
            ancho: 2,
            alto: 2,
            capacidad: 4,
            estadoManual: null,
            activo: true,
            orden,
          })
        }))
      }
      toast.success(faltantes > 0
        ? `${faltantes} ${faltantes === 1 ? 'mesa creada' : 'mesas creadas'} en tu plano inicial`
        : `Ya tenés ${activas.length} mesas configuradas`)
      irA('prueba')
    } catch (error) {
      toast.error('No pudimos crear el plano inicial', {
        description: error instanceof Error ? error.message : 'Probá nuevamente en un momento.',
      })
    } finally {
      setCreandoMesas(false)
    }
  }

  const terminarClaim = () => {
    localStorage.removeItem(progresoClaimKey(token))
    // El recorrido del panel ya lo hizo acá: que no se le vuelva a abrir al entrar.
    if (restauranteAutenticado?.id) marcarRecorridoVisto(restauranteAutenticado.id)
    navigate('/dashboard', { replace: true })
  }

  // El catálogo del backend es la fuente del precio vigente. Los otros campos son snapshots/aliases
  // de compatibilidad y pueden quedar viejos.
  const precioBase = miSusc?.suscripcionBase?.precioMensual
    ?? miSusc?.cotizacionProximaFactura?.montoBaseMensual
    ?? miSusc?.precioBaseMensual
    ?? miSusc?.precioMensual
  const precioSuscripcion = precioBase ? `$${fmtPrecio(precioBase)}` : null
  const trialDias = miSusc?.trialFin
    ? Math.max(0, Math.ceil((new Date(miSusc.trialFin).getTime() - Date.now()) / 86_400_000))
    : null

  const codigo = digits.join('')
  // A qué número se mandó el código, completo.
  const numeroCodigo = usaNumeroCargado
    ? numeroCargado
    : normalizarTelefono(telefono) ? `+${normalizarTelefono(telefono)}` : telefonoEnmascarado
  const progress = cards.length > 0 ? ((cardIdx + 1) / cards.length) * 100 : 0

  // Botones de un editor inline simple: Guardar (primario) + Cancelar (secundario).
  const AccionesEditor = ({ onGuardar, disabled }: { onGuardar: () => void; disabled?: boolean }) => (
    <>
      <button
        onClick={onGuardar}
        disabled={disabled}
        className="w-full h-14 mt-6 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white active:scale-[0.985] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
      >
        <Check className="h-4 w-4" /> Guardar cambio
      </button>
      <button
        onClick={cancelarEditor}
        className="w-full h-11 mt-2.5 rounded-2xl text-[14px] font-medium text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
      >
        Cancelar
      </button>
    </>
  )

  const Titulo = ({ children }: { children: React.ReactNode }) => (
    <h1 className="text-[1.9rem] leading-[1.12] font-semibold tracking-tight">{children}</h1>
  )

  return (
    <div className="min-h-dvh flex items-center justify-center w-full bg-[#FFFBF0] dark:bg-background px-6 pt-10 pb-32 sm:pb-36 selection:bg-orange-500/10 selection:text-[#FF7A00]">
      <div className="w-full max-w-sm animate-in fade-in duration-500">
        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : bloqueo ? (
          <BloqueoView bloqueo={bloqueo} onLogin={() => navigate('/login', { replace: true })} />
        ) : paso === 'walk' ? (
          <>
            {/* Barra de progreso del recorrido + en qué parte está */}
            <div className="h-1 w-full rounded-full bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
              <div className="h-full rounded-full bg-[#FF7A00] transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex items-center justify-between mt-3 mb-6 min-h-6">
              {cardIdx > 0 ? (
                <button
                  onClick={() => goCard(cardIdx - 1)}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" /> Volver
                </button>
              ) : <span />}
              {card && <span className="text-xs font-semibold text-[#FF7A00]">{SECCION[card.kind]}</span>}
            </div>

            {/* ── Bienvenida: qué falta dejar listo (nombre y logo editables) ── */}
            {card?.kind === 'intro' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-400 text-center flex flex-col items-center">
                {editing === 'intro' ? (
                  <div className="w-full">
                    <Titulo>Tu nombre y tu logo</Titulo>
                    <label className="cursor-pointer inline-block mt-6">
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { elegirLogo(e.target.files); e.currentTarget.value = '' }} />
                      <div className="relative h-24 w-24 rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-900 ring-1 ring-border flex items-center justify-center group">
                        {tmpLogo ? <img src={tmpLogo} alt="Logo" className="h-full w-full object-cover" /> : <ImagePlus className="h-7 w-7 text-muted-foreground" />}
                        {subiendoLogo && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-white" /></div>}
                        <div className="absolute inset-x-0 bottom-0 bg-black/55 text-white text-[11px] py-1">Cambiar</div>
                      </div>
                    </label>
                    <p className="text-sm text-muted-foreground mt-6 mb-2 text-left">El nombre de tu local</p>
                    <input
                      autoFocus
                      value={tmpText}
                      onChange={(e) => setTmpText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && guardarIdentidad()}
                      placeholder="Burger Bros"
                      className="w-full h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border-0 px-4 text-lg font-semibold outline-none focus:ring-2 focus:ring-[#FF7A00]/30 transition-shadow"
                    />
                    <AccionesEditor onGuardar={guardarIdentidad} disabled={tmpText.trim().length < 2 || subiendoLogo} />
                  </div>
                ) : (
                  <>
                    {dispLogo ? (
                      <img src={dispLogo} alt={dispNombre || 'Tu local'} className="h-20 w-20 rounded-2xl object-cover shadow-sm ring-1 ring-border" />
                    ) : (
                      <div className="h-20 w-20 rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
                        <Store className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground mt-6">Hola, {dispNombre || 'bienvenido'}</p>
                    <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-tight mt-1">Dejemos lo último listo</h1>
                    <p className="text-[15px] text-muted-foreground mt-3 max-w-xs">
                      Completás los datos que sólo vos sabés, elegís cómo trabajás y aprendés a manejar tu panel. Te lleva unos minutos.
                    </p>
                    <ol className="w-full mt-7 rounded-2xl bg-white dark:bg-zinc-900 p-2 text-left">
                      {[
                        { icon: Banknote, titulo: 'Tu alias y tus zonas de delivery', texto: 'Lo único que no podemos cargar por vos.' },
                        { icon: MessageCircle, titulo: 'Dónde te llegan los pedidos', texto: 'Tu WhatsApp y tu acceso al panel.' },
                        { icon: Printer, titulo: 'Cómo trabajás en el local', texto: 'Impresora, mostrador, mesas.' },
                        { icon: CircleHelp, titulo: 'Cómo se usa el panel', texto: 'Un repaso corto, pantalla por pantalla.' },
                      ].map((item, i) => (
                        <li key={item.titulo} className="flex items-center gap-3 rounded-xl px-3 py-2.5 animate-in fade-in slide-in-from-bottom-1 fill-mode-both" style={{ animationDelay: `${150 + i * 90}ms` }}>
                          <span className="h-9 w-9 shrink-0 rounded-xl bg-orange-500/10 flex items-center justify-center">
                            <item.icon className="h-4 w-4 text-[#FF7A00]" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold leading-tight">{item.titulo}</span>
                            <span className="block text-xs text-muted-foreground mt-0.5">{item.texto}</span>
                          </span>
                        </li>
                      ))}
                    </ol>
                    <button
                      onClick={continuar}
                      className="w-full h-14 mt-7 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white active:scale-[0.985] transition-all flex items-center justify-center gap-2"
                    >
                      Empezar <ArrowRight className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => abrirEditor('intro')}
                      className="w-full h-11 mt-2.5 rounded-2xl text-[14px] font-medium text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Cambiar nombre o logo
                    </button>
                  </>
                )}
              </div>
            )}

            {/* ── Carta (sólo ver): dónde se edita ── */}
            {card?.kind === 'productos' && config && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-400 flex flex-col items-center text-center">
                <Titulo>Revisá tu carta</Titulo>
                <p className="text-[15px] text-muted-foreground mt-3 max-w-xs">
                  Estos son los {config.productos.length} {config.productos.length === 1 ? 'producto' : 'productos'} que cargamos. Si un precio o una foto no está bien, lo cambiás vos desde <strong className="font-semibold text-foreground">Menú</strong> en tu panel.
                </p>
                <div className="mt-6 w-full max-h-[55vh] overflow-y-auto space-y-3 pr-0.5 scrollbar-mini">
                  {config.productos.map((p) => (
                    <ProductoCard key={p.id} p={p} />
                  ))}
                </div>
                <button
                  onClick={continuar}
                  className="w-full h-14 mt-6 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white active:scale-[0.985] transition-all"
                >
                  Continuar
                </button>
              </div>
            )}

            {/* ── Bifurcación del recorrido: un local o configuración por sucursal ── */}
            {card?.kind === 'modalidadSucursales' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-400 flex flex-col items-center text-center">
                <div className="h-14 w-14 rounded-2xl bg-orange-500/10 flex items-center justify-center ring-1 ring-orange-500/15">
                  <Store className="h-6 w-6 text-[#FF7A00]" />
                </div>
                <h1 className="text-[1.9rem] leading-[1.12] font-semibold tracking-tight mt-5">¿Cuántos locales tenés?</h1>
                <p className="text-[15px] text-muted-foreground mt-3 max-w-xs">
                  Así dejamos bien configurados los cobros, las direcciones y las zonas de envío.
                </p>
                <div className="w-full space-y-2.5 mt-7">
                  <button type="button" onClick={() => elegirModalidadSucursales('unica')} className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 text-left hover:border-[#FF7A00]/60 hover:bg-orange-500/[0.04] transition-colors">
                    <span className="block text-sm font-semibold">Un solo local</span>
                    <span className="block text-xs text-muted-foreground mt-1">Una dirección, un alias y tus zonas de delivery.</span>
                  </button>
                  <button type="button" onClick={() => elegirModalidadSucursales('multiple')} className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 text-left hover:border-[#FF7A00]/60 hover:bg-orange-500/[0.04] transition-colors">
                    <span className="block text-sm font-semibold">Varias sucursales</span>
                    <span className="block text-xs text-muted-foreground mt-1">Cada local con su dirección, su alias y sus zonas.</span>
                  </button>
                </div>
              </div>
            )}

            {card?.kind === 'sucursales' && draft.sucursales && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-400 flex flex-col items-center text-center">
                <h1 className="text-[1.9rem] leading-[1.12] font-semibold tracking-tight">Configurá tus sucursales</h1>
                <p className="text-[15px] text-muted-foreground mt-3 max-w-xs">Poné el nombre y la dirección exacta de cada local.</p>
                <SucursalesClaimEditor initial={draft.sucursales} pagosDefault={pagosView} onGuardar={guardarSucursales} />
              </div>
            )}

            {/* ── Alias y medios de pago: siempre abierto, el alias real lo sabe sólo el dueño ── */}
            {card?.kind === 'pagos' && config && (
              <PagosForm
                key="pagos"
                initial={draft.pagos ?? { ...pagosView, transferenciaManual: true, transferenciaAlias: '' }}
                autoTransfer={config.pagos.autoTransferAvailable}
                mercadoPago={config.pagos.mpConnected}
                onGuardar={guardarPagos}
              />
            )}

            {card?.kind === 'pagosSucursal' && config && draft.sucursales?.[card.sucursalIdx] && (
              <PagosForm
                key={`pagos-${card.sucursalIdx}`}
                sucursal={draft.sucursales[card.sucursalIdx].nombre}
                initial={{ ...draft.sucursales[card.sucursalIdx].pagos, transferenciaManual: draft.sucursales[card.sucursalIdx].pagos.transferenciaManual || !draft.sucursales[card.sucursalIdx].pagos.transferenciaAlias }}
                autoTransfer={config.pagos.autoTransferAvailable}
                mercadoPago={config.pagos.mpConnected}
                onGuardar={(pagos) => guardarPagosSucursal(card.sucursalIdx, pagos)}
              />
            )}

            {/* ── Formas de entrega + zonas: siempre abierto, las zonas las dibuja el dueño ── */}
            {card?.kind === 'delivery' && config && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-400 flex flex-col items-center text-center">
                <h1 className="text-[1.9rem] leading-[1.12] font-semibold tracking-tight">¿Cómo entregás tus pedidos?</h1>
                <DeliveryEditor
                  initial={draft.delivery ?? (direccionCargada ? { mode: 'zonas', zonas: [], ...direccionCargada } : undefined)}
                  direccionCargada={!draft.delivery && !!direccionCargada}
                  initialTipos={tiposPedidoView}
                  onGuardar={guardarEntrega}
                  onSaltar={continuar}
                  textoSaltar="Lo configuro después en el panel"
                />
              </div>
            )}

            {card?.kind === 'deliverySucursal' && config && draft.sucursales?.[card.sucursalIdx] && (() => {
              const sucursal = draft.sucursales![card.sucursalIdx]
              const initial = sucursal.delivery ?? (sucursal.center ? {
                mode: 'zonas' as const,
                zonas: [],
                center: sucursal.center,
                address: sucursal.address,
              } : undefined)
              return (
                <div key={sucursal.localId} className="animate-in fade-in slide-in-from-bottom-2 duration-400 flex flex-col items-center text-center">
                  <span className="text-lg font-semibold tracking-tight text-[#FF7A00]">{sucursal.nombre}</span>
                  <h1 className="text-[1.9rem] leading-[1.12] font-semibold tracking-tight mt-2">Zonas de envío</h1>
                  <DeliveryEditor
                    initial={initial}
                    direccionCargada={!sucursal.delivery && !!sucursal.center}
                    initialTipos={{ delivery: true, takeaway: tiposPedidoView.takeaway }}
                    skipTipos
                    onGuardar={(_tipos, delivery) => guardarEntregaSucursal(card.sucursalIdx, delivery)}
                    onSaltar={() => guardarEntregaSucursal(card.sucursalIdx)}
                    textoSaltar="Esta sucursal no hace delivery"
                  />
                </div>
              )
            })()}

            {/* ── Resumen de datos agregados (backend viejo sin config) ── */}
            {card?.kind === 'reassure' && (
              <div key={card.id} className="animate-in fade-in slide-in-from-bottom-2 duration-400 flex flex-col items-center text-center">
                <div className="h-14 w-14 rounded-2xl bg-orange-500/10 flex items-center justify-center ring-1 ring-orange-500/15">
                  <card.icon className="h-6 w-6 text-[#FF7A00]" strokeWidth={2} />
                </div>
                <h1 className="text-[1.9rem] leading-[1.12] font-semibold tracking-tight mt-5">{card.titulo}</h1>
                <div className="mt-6 w-full rounded-2xl bg-zinc-100 dark:bg-zinc-900 px-4 py-4 text-base font-medium text-foreground">{card.valor}</div>
                <p className="text-xs text-muted-foreground mt-3">Lo editás desde Menú en tu panel.</p>
                <button onClick={continuar} className="w-full h-14 mt-7 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white active:scale-[0.985] transition-all">Continuar</button>
              </div>
            )}

            {/* ── Cómo le llega un pedido al local por WhatsApp ── */}
            {card?.kind === 'mensaje' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-400 flex flex-col items-center text-center">
                <div className="h-14 w-14 rounded-2xl bg-[#25D366]/10 ring-1 ring-[#25D366]/20 flex items-center justify-center">
                  <MessageCircle className="h-6 w-6 text-[#20B957]" strokeWidth={2} />
                </div>
                <h1 className="text-[1.9rem] leading-[1.12] font-semibold tracking-tight mt-5">Así te llega cada pedido</h1>
                <p className="text-[15px] text-muted-foreground mt-3 max-w-sm">
                  Cuando un cliente compra, te llega este mensaje al WhatsApp y el pedido aparece en Inicio, en tu panel.
                </p>

                <img
                  src="/Ejemplo_mensaje_basico.png"
                  alt="Ejemplo de un pedido recibido por WhatsApp"
                  className="mt-6 block w-full rounded-2xl"
                />

                <div className="mt-4 flex w-full items-start gap-3 rounded-2xl bg-zinc-100/80 px-4 py-3.5 text-left dark:bg-zinc-900">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#FF7A00]" strokeWidth={2.5} />
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    Producto, extras, pago, dirección y datos de entrega: todo junto en un solo mensaje.
                  </p>
                </div>

                <button
                  onClick={continuar}
                  className="w-full h-14 mt-6 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white active:scale-[0.985] transition-all"
                >
                  Entendido
                </button>
              </div>
            )}

            {/* ── WhatsApp de pedidos: el cargado se muestra listo; uno por sucursal si hay varias ── */}
            {card?.kind === 'whatsapps' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-400">
                <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-tight">
                  {usaNumeroCargado ? 'Tus pedidos llegan a este WhatsApp' : '¿A qué WhatsApp te llegan los pedidos?'}
                </h1>
                <p className="text-[15px] text-muted-foreground mt-3">
                  {draft.modalidadSucursales === 'multiple'
                    ? 'Ingresá el WhatsApp de cada sucursal. Cada local recibe directamente sus pedidos.'
                    : usaNumeroCargado
                      ? 'Es el número que nos pasaste. Si preferís que lleguen a otro, cambialo acá.'
                      : 'Ingresá el WhatsApp donde querés que lleguen los pedidos de tu tienda.'}
                </p>

                <div className="mt-7 space-y-3">
                  {draft.modalidadSucursales === 'multiple' ? draft.sucursales?.map((sucursal, idx) => (
                    <div key={sucursal.localId} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
                      <label htmlFor={`claim-whatsapp-${sucursal.localId}`} className="mb-2 block text-sm font-semibold text-foreground">{sucursal.nombre}</label>
                      <div className="group flex items-center gap-3 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-900 px-4 focus-within:ring-2 focus-within:ring-[#FF7A00]/30">
                        <MessageCircle className="h-4 w-4 shrink-0 text-[#20B957]" />
                        <span className="text-sm text-muted-foreground">+54</span>
                        <input
                          id={`claim-whatsapp-${sucursal.localId}`}
                          type="tel"
                          inputMode="numeric"
                          autoComplete="tel"
                          value={sucursal.whatsappNumber}
                          onChange={(e) => setDraft((prev) => ({ ...prev, sucursales: prev.sucursales?.map((s, i) => i === idx ? { ...s, whatsappNumber: e.target.value } : s) }))}
                          placeholder="9 351 123 4567"
                          className="flex-1 min-w-0 bg-transparent border-0 outline-none text-sm placeholder:text-zinc-400"
                        />
                      </div>
                    </div>
                  )) : usaNumeroCargado ? (
                    <div className="flex items-center gap-3 h-16 rounded-2xl bg-white dark:bg-zinc-900 px-4 ring-1 ring-emerald-500/20">
                      <span className="h-9 w-9 shrink-0 rounded-xl bg-[#25D366]/10 flex items-center justify-center">
                        <MessageCircle className="h-4 w-4 text-[#20B957]" />
                      </span>
                      <span className="flex-1 text-base font-semibold tabular-nums">{numeroCargado}</span>
                      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        <CircleCheck className="h-4 w-4" /> Listo
                      </span>
                    </div>
                  ) : (
                    <div className="group flex items-center gap-3 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-900 px-4 focus-within:ring-2 focus-within:ring-[#FF7A00]/30">
                      <MessageCircle className="h-4 w-4 shrink-0 text-[#20B957]" />
                      <span className="text-base text-muted-foreground">+54</span>
                      <input
                        id="claim-whatsapp-unico"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel"
                        autoFocus
                        value={telefono}
                        onChange={(e) => setTelefono(e.target.value)}
                        placeholder="9 351 123 4567"
                        className="flex-1 min-w-0 bg-transparent border-0 outline-none text-base placeholder:text-zinc-400"
                      />
                    </div>
                  )}
                </div>

                <button onClick={guardarWhatsapps} className="w-full h-14 mt-6 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white active:scale-[0.985] transition-all">
                  Continuar
                </button>
                {usaNumeroCargado ? (
                  <button onClick={() => { setUsarOtroNumero(true); setTelefono('') }} className="w-full h-11 mt-2.5 rounded-2xl text-[14px] font-medium text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors flex items-center justify-center gap-1.5">
                    <Pencil className="h-3.5 w-3.5" /> Usar otro número
                  </button>
                ) : numeroCargado && usarOtroNumero && draft.modalidadSucursales !== 'multiple' ? (
                  <button onClick={() => setUsarOtroNumero(false)} className="w-full h-11 mt-2.5 rounded-2xl text-[14px] font-medium text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
                    Dejar el que ya estaba
                  </button>
                ) : null}
              </div>
            )}

            {/* ── Acceso al panel: código por WhatsApp o mail y contraseña ── */}
            {card?.kind === 'acceso' && (() => {
              const numeroAcceso = usaNumeroCargado
                ? numeroCargado
                : `+${normalizarTelefono(telefono) ?? telefono}`
              return (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-400">
                  <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-tight">¿Cómo querés entrar a tu panel?</h1>
                  <p className="text-[15px] text-muted-foreground mt-3">
                    Es lo que vas a usar cada vez que inicies sesión, en la compu o en el celular. Con esto la tienda queda a tu nombre.
                  </p>

                  <div className="mt-7 space-y-2.5" role="radiogroup" aria-label="Cómo entrar al panel">
                    <OpcionAcceso
                      icon={MessageCircle}
                      titulo="Con un código por WhatsApp"
                      texto="Te mandamos 6 números cada vez que entrás. Sin contraseñas que recordar."
                      elegido={metodoAcceso === 'whatsapp'}
                      onElegir={() => setMetodoAcceso('whatsapp')}
                    />
                    <OpcionAcceso
                      icon={Mail}
                      titulo="Con mail y contraseña"
                      texto="Cómodo si vas a entrar desde la compu del local."
                      elegido={metodoAcceso === 'email'}
                      onElegir={() => setMetodoAcceso('email')}
                    />
                  </div>

                  {metodoAcceso === 'whatsapp' && (
                    <form onSubmit={(e) => { e.preventDefault(); iniciarReclamo() }} className="mt-6 animate-in fade-in slide-in-from-top-1 duration-300">
                      <p className="mb-3 text-sm font-medium text-foreground">
                        {draft.modalidadSucursales === 'multiple' ? '¿A cuál número te mandamos el código?' : 'Te mandamos el código a:'}
                      </p>
                      {draft.modalidadSucursales === 'multiple' ? (
                        <div className="space-y-2">
                          {draft.sucursales?.map((sucursal) => {
                            const numero = normalizarTelefono(sucursal.whatsappNumber) ?? sucursal.whatsappNumber
                            const seleccionado = normalizarTelefono(telefono) === numero
                            return (
                              <button key={sucursal.localId} type="button" onClick={() => setTelefono(numero)} className={`w-full rounded-2xl border p-4 text-left transition-colors ${seleccionado ? 'border-[#FF7A00] bg-orange-500/[0.06]' : 'border-zinc-200 dark:border-zinc-800 hover:border-[#FF7A00]/50'}`}>
                                <span className="block text-sm font-semibold">{sucursal.nombre}</span>
                                <span className="block text-sm text-muted-foreground mt-1">+{numero}</span>
                              </button>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-900 px-4">
                          <MessageCircle className="h-4 w-4 text-[#20B957]" />
                          <span className="text-base font-semibold tabular-nums">{numeroAcceso}</span>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-3">Es un código de Piru: escribilo sólo en la pantalla que sigue y no se lo pases a nadie.</p>
                      <button
                        type="submit"
                        disabled={enviando || (!usaNumeroCargado && telefono.replace(/\D/g, '').length < 8)}
                        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl h-14 bg-[#FF7A00] hover:bg-[#E66E00] text-white text-[15px] font-semibold transition-all active:scale-[0.985] disabled:opacity-40"
                      >
                        {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviarme el código'}
                      </button>
                    </form>
                  )}

                  {metodoAcceso === 'email' && (
                    <form onSubmit={(e) => { e.preventDefault(); crearAccesoConEmail() }} className="mt-6 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-300">
                      <label htmlFor="claim-email" className="block text-sm font-medium text-foreground">Tu mail</label>
                      <input
                        id="claim-email"
                        type="email"
                        autoComplete="email"
                        autoFocus
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="vos@tulocal.com"
                        className="w-full h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border-0 px-4 text-base outline-none focus:ring-2 focus:ring-[#FF7A00]/30 transition-shadow"
                      />
                      <label htmlFor="claim-password" className="block text-sm font-medium text-foreground pt-2">Elegí una contraseña</label>
                      <div className="flex items-center h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-900 pl-4 pr-2 focus-within:ring-2 focus-within:ring-[#FF7A00]/30 transition-shadow">
                        <input
                          id="claim-password"
                          type={verPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Al menos 8 caracteres"
                          className="flex-1 min-w-0 bg-transparent border-0 outline-none text-base"
                        />
                        <button type="button" onClick={() => setVerPassword((v) => !v)} aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="h-10 w-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground">
                          {verPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <button
                        type="submit"
                        disabled={enviando || !emailValido || password.length < 8}
                        className="!mt-5 flex w-full items-center justify-center gap-2 rounded-2xl h-14 bg-[#FF7A00] hover:bg-[#E66E00] text-white text-[15px] font-semibold transition-all active:scale-[0.985] disabled:opacity-40"
                      >
                        {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear mi acceso'}
                      </button>
                    </form>
                  )}
                </div>
              )
            })()}
          </>
        ) : paso === 'codigo' ? (
          <>
            <button onClick={() => setPaso('walk')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
              <ArrowLeft className="h-4 w-4" /> Volver
            </button>

            <div className="text-center mb-8">
              <h1 className="text-2xl font-semibold tracking-tight">Ingresá el código</h1>
              <p className="text-sm text-muted-foreground mt-2">
                Te lo enviamos por WhatsApp
                {numeroCodigo ? (<>{' '}al <span className="font-medium text-foreground">{numeroCodigo}</span></>) : null}
              </p>
              <p className="text-xs text-muted-foreground mt-3 max-w-xs mx-auto">
                Es un código de Piru: escribilo sólo acá. No se lo pases a nadie, ni a nosotros.
              </p>
            </div>

            <div className="flex justify-center gap-2 mb-6" dir="ltr">
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputsRef.current[index] = el }}
                  type="text"
                  inputMode="numeric"
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  maxLength={CODE_LENGTH}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  disabled={verificando}
                  className="w-12 h-14 text-center text-xl font-semibold rounded-2xl bg-zinc-100 dark:bg-zinc-900 border-0 focus:outline-none focus:ring-2 focus:ring-[#FF7A00] transition-all disabled:opacity-50"
                />
              ))}
            </div>

            <button
              type="button"
              disabled={verificando || codigo.length !== CODE_LENGTH}
              onClick={() => submitCodigo(codigo)}
              className="flex w-full items-center justify-center rounded-2xl h-12 bg-[#FF7A00] hover:bg-[#E66E00] text-white text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {verificando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar'}
            </button>

            <div className="text-center text-sm text-muted-foreground mt-6">
              {cooldown > 0 ? (
                <span>Reenviar código en {cooldown}s</span>
              ) : (
                <button type="button" onClick={reenviar} className="text-[#FF7A00] hover:text-[#E66E00] transition-colors font-medium">Reenviar código</button>
              )}
            </div>
          </>
        ) : paso === 'prueba' ? (
          pedidoOk ? (
            <div className="text-center flex flex-col items-center animate-in fade-in duration-500 py-6">
              <Confetti />
              <div className="w-16 h-16 rounded-2xl bg-[#25D366] flex items-center justify-center mb-6">
                <svg viewBox="0 0 24 24" className="h-8 w-8 fill-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884Z" /></svg>
              </div>
              <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-tight">Te llegó el pedido</h1>
              <p className="text-[15px] text-muted-foreground mt-3 max-w-sm">Así vas a recibir cada pedido real: al toque, en tu WhatsApp y en el panel.</p>

              <button
                onClick={() => irA('aprender')}
                className="w-full h-14 mt-8 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white active:scale-[0.985] transition-all flex items-center justify-center gap-2"
              >
                Ahora, a conocer el panel <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              <button
                onClick={volverDesdePrueba}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5"
              >
                <ArrowLeft className="h-4 w-4" /> Volver
              </button>
              <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-tight text-center">Hacé un pedido de prueba</h1>
              <p className="text-[15px] text-muted-foreground mt-3 text-center max-w-sm mx-auto">
                Pedí algo como si fueras un cliente: te llega al WhatsApp y lo ves en Inicio, igual que un pedido real.
              </p>

              <div className="mt-6">
                <TiendaPreview
                  nombre={dispNombre || 'tu local'}
                  logo={dispLogo}
                  slug={dispUsername || 'tulocal'}
                  baseTienda={urlTienda}
                  direccion={draft.delivery?.address || ''}
                  deliveryPrice={draft.delivery?.mode === 'radio' ? draft.delivery.precio : config?.delivery.zonas?.[0]?.precio || '0'}
                  metodosPago={{
                    transferenciaManual: pagosView.transferenciaManual,
                    efectivo: pagosView.efectivo,
                  }}
                  proveedorPago={config?.pagos.mpConnected ? 'mercadopago' : 'manual'}
                  productos={storeProducts}
                  onConfirmar={hacerPedidoPrueba}
                />
              </div>

              <div className="mt-6 space-y-2 text-center">
                <a
                  href={urlTienda ?? STORE_BASE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 text-xs font-semibold text-[#FF7A00] hover:underline"
                >
                  <ShoppingBag className="h-3.5 w-3.5" /> Abrir en una pestaña nueva
                </a>
                <div>
                  <button
                    onClick={() => irA('aprender')}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Omitir la prueba
                  </button>
                </div>
              </div>
            </div>
          )
        ) : paso === 'modos' ? (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="text-center flex flex-col items-center">
              <span className="text-xs font-semibold text-[#FF7A00]">Tu acceso quedó listo · Ahora, tu local</span>
              <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-tight mt-3">¿Cómo trabajás en el local?</h1>
              <p className="text-[15px] text-muted-foreground mt-3 max-w-xs">
                Activá lo que vas a usar. Todo viene incluido y lo podés cambiar cuando quieras desde Módulos.
              </p>
            </div>

            <div className="mt-7 space-y-3">
              <div className="rounded-2xl bg-white dark:bg-zinc-900 p-4 flex items-center gap-3">
                <span className="h-11 w-11 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <MessageCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </span>
                <span className="flex-1 min-w-0 text-left">
                  <span className="block text-sm font-semibold leading-tight">Recibir pedidos al WhatsApp</span>
                  <span className="block text-xs text-muted-foreground mt-1 leading-relaxed">Es el funcionamiento normal de Piru: cada pedido nuevo te llega al celular y queda guardado en el panel.</span>
                </span>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Check className="h-3.5 w-3.5" /> Activo
                </span>
              </div>
              <ModoUsoCard
                id="impresion"
                icon={Printer}
                titulo="Quiero imprimir los pedidos automáticamente"
                resumen="La comanda sale apenas entra el pedido, sin copiar nada a mano."
                detalle="Conectás Piru a la impresora del local y cada pedido aceptado imprime su comanda automáticamente. Vas a poder elegir impresora, cantidad de copias y formato desde el panel."
                imagenes={[{
                  src: '/claim/modos/impresora-comanda.webp',
                  alt: 'Impresora térmica imprimiendo una comanda generada por Piru',
                }]}
                abierto={modosAbiertos.includes('impresion')}
                activo={modosActivos.includes('impresion')}
                procesando={activandoModo === 'impresion'}
                textoActivar="Activar impresión automática"
                onToggle={() => toggleModoAbierto('impresion')}
                onActivar={() => activarModoUso('impresion')}
              />
              <ModoUsoCard
                id="pos"
                icon={MonitorSmartphone}
                titulo="Quiero anotar pedidos en el Punto de Venta"
                resumen="Cargá desde Piru los pedidos que te hacen en persona o por teléfono."
                detalle="El Punto de Venta convierte Piru en la caja del local: armás el pedido desde la carta, elegís cómo pagó y lo enviás a cocina. Los pedidos online y los anotados quedan juntos en una sola operación."
                imagenes={[
                  { src: '/claim/modos/punto-de-venta.webp', alt: 'Punto de Venta de Piru gestionando un pedido' },
                  { src: '/claim/modos/mesas.webp', alt: 'Punto de Venta de Piru gestionando el pedido de una mesa' },
                ]}
                abierto={modosAbiertos.includes('pos')}
                activo={modosActivos.includes('pos')}
                procesando={activandoModo === 'pos'}
                textoActivar="Activar Punto de Venta"
                onToggle={() => toggleModoAbierto('pos')}
                onActivar={() => activarModoUso('pos')}
              >
                <button
                  type="button"
                  disabled={modosActivos.includes('pos') || activandoModo === 'pos'}
                  onClick={() => setActivarMesasConPos((valor) => !valor)}
                  className="w-full rounded-2xl bg-zinc-100 dark:bg-zinc-800 p-3.5 flex items-center gap-3 text-left transition-colors disabled:cursor-default"
                >
                  <span className="h-9 w-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                    <Armchair className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold">También voy a usar mesas</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">Abrí cuentas por mesa y cerralas desde el POS.</span>
                  </span>
                  <span className={`h-6 w-10 rounded-full p-0.5 transition-colors ${activarMesasConPos || mesasActivas ? 'bg-[#FF7A00]' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
                    <span className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${activarMesasConPos || mesasActivas ? 'translate-x-4' : ''}`} />
                  </span>
                </button>
              </ModoUsoCard>
            </div>

            <HerramientasIncluidas />

            <button
              onClick={avanzarDesdeModos}
              className="w-full h-14 mt-7 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white active:scale-[0.985] transition-all flex items-center justify-center gap-2"
            >
              Continuar <ArrowRight className="h-4 w-4" />
            </button>
            <p className="text-center text-xs text-muted-foreground mt-3">Lo que no actives ahora sigue disponible en Módulos.</p>
          </div>
        ) : paso === 'configImpresion' ? (
          <div className="text-center flex flex-col items-center animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="h-16 w-16 rounded-2xl bg-[#FF7A00]/10 ring-1 ring-[#FF7A00]/15 flex items-center justify-center">
              <Printer className="h-7 w-7 text-[#FF7A00]" strokeWidth={2} />
            </div>
            <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-tight mt-6">Descargá Piru en tu computadora</h1>
            <p className="text-[15px] text-muted-foreground mt-3 max-w-xs">
              La impresión automática funciona desde la app de escritorio. Instalála en la computadora conectada a tu impresora térmica.
            </p>

            <div className="w-full rounded-2xl bg-white dark:bg-zinc-900 p-5 mt-7 text-left">
              <div className="flex items-start gap-3">
                <span className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                  <Download className="h-5 w-5 text-[#FF7A00]" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Piru para Windows</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {desktopVersion ? `Versión ${desktopVersion}` : 'Buscando la última versión disponible…'}
                  </p>
                </div>
              </div>
              <p className="text-[13px] leading-relaxed text-muted-foreground mt-4">
                Cuando abras la app, entrá a Ajustes → Impresión para elegir la impresora y hacer una prueba.
              </p>
            </div>

            <a
              href={desktopDownloadUrl}
              target="_blank"
              rel="noreferrer"
              download
              className="w-full h-14 mt-6 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white active:scale-[0.985] transition-all flex items-center justify-center gap-2"
            >
              {buscandoDescarga ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Descargar la app
            </a>
            <button
              type="button"
              onClick={avanzarDesdeImpresion}
              className="w-full h-11 mt-2.5 rounded-2xl text-[14px] font-medium text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
            >
              Ya la descargué, continuar
            </button>
          </div>
        ) : paso === 'configMesas' ? (
          <div className="text-center flex flex-col items-center animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="h-16 w-16 rounded-2xl bg-[#FF7A00]/10 ring-1 ring-[#FF7A00]/15 flex items-center justify-center">
              <Armchair className="h-7 w-7 text-[#FF7A00]" strokeWidth={2} />
            </div>
            <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-tight mt-6">¿Cuántas mesas tenés?</h1>
            <p className="text-[15px] text-muted-foreground mt-3 max-w-xs">
              Las vamos a crear y distribuir automáticamente en un plano inicial.
            </p>

            <div className="w-full rounded-2xl bg-white dark:bg-zinc-900 p-5 mt-7">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cantidad de mesas</p>
              <div className="flex items-center justify-center gap-5 mt-4">
                <button
                  type="button"
                  aria-label="Quitar una mesa"
                  disabled={cantidadMesas <= 1 || creandoMesas}
                  onClick={() => setCantidadMesas((cantidad) => Math.max(1, cantidad - 1))}
                  className="h-12 w-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <Minus className="h-5 w-5" />
                </button>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={cantidadMesas}
                  disabled={creandoMesas}
                  onChange={(event) => setCantidadMesas(Math.min(100, Math.max(1, Number(event.target.value) || 1)))}
                  className="w-24 bg-transparent text-center text-4xl font-semibold tabular-nums outline-none"
                  aria-label="Cantidad de mesas"
                />
                <button
                  type="button"
                  aria-label="Agregar una mesa"
                  disabled={cantidadMesas >= 100 || creandoMesas}
                  onClick={() => setCantidadMesas((cantidad) => Math.min(100, cantidad + 1))}
                  className="h-12 w-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
              <p className="text-[13px] leading-relaxed text-muted-foreground mt-5">
                Empezarán como mesas compactas para 4 personas. Después podés moverlas, cambiar tamaño, capacidad y armar el mapa real de tu salón desde Mesas.
              </p>
            </div>

            <button
              type="button"
              onClick={crearPlanoInicialMesas}
              disabled={creandoMesas}
              className="w-full h-14 mt-6 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white active:scale-[0.985] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {creandoMesas ? <><Loader2 className="h-4 w-4 animate-spin" /> Creando mesas…</> : <>Crear mis {cantidadMesas} mesas <ArrowRight className="h-4 w-4" /></>}
            </button>
          </div>
        ) : (
          // ── Último paso: aprender a manejar el panel, según lo que activó ──
          <AprenderPanel
            local={dispNombre || 'Tu local'}
            impresion={modosActivos.includes('impresion')}
            pos={modosActivos.includes('pos')}
            mesas={mesasActivas}
            trialDias={trialDias}
            precio={precioSuscripcion}
            pagando={pagandoSuscripcion}
            onPagar={pagarSuscripcionAhora}
            onTerminar={terminarClaim}
          />
        )}
      </div>
      <WhatsAppHelpButton help={whatsappHelp} />
    </div>
  )
}

function WhatsAppHelpButton({ help }: { help: WhatsAppHelp }) {
  const href = `https://wa.me/${WHATSAPP_HELP_NUMBER}?text=${encodeURIComponent(help.message)}`

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${help.label}. Abre WhatsApp en una pestaña nueva`}
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[1000] inline-flex min-h-12 max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-950/20 transition-all hover:bg-[#20BD5A] hover:shadow-xl active:scale-[0.98] sm:bottom-6 sm:right-6"
    >
      <MessageCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className="truncate">{help.label}</span>
    </a>
  )
}

function ModoUsoCard({
  id,
  icon: Icon,
  titulo,
  resumen,
  detalle,
  imagenes,
  abierto,
  activo,
  procesando,
  textoActivar,
  onToggle,
  onActivar,
  children,
}: {
  id: ModoUso
  icon: LucideIcon
  titulo: string
  resumen: string
  detalle: string
  imagenes: Array<{ src: string; alt: string }>
  abierto: boolean
  activo: boolean
  procesando: boolean
  textoActivar: string
  onToggle: () => void
  onActivar: () => void
  children?: React.ReactNode
}) {
  const [imagenesConError, setImagenesConError] = useState<string[]>([])
  const [imagenAmpliada, setImagenAmpliada] = useState<{ src: string; alt: string } | null>(null)

  useEffect(() => {
    if (!imagenAmpliada) return
    const cerrarConEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setImagenAmpliada(null)
    }
    document.addEventListener('keydown', cerrarConEscape)
    return () => document.removeEventListener('keydown', cerrarConEscape)
  }, [imagenAmpliada])

  return (
    <section className="overflow-hidden rounded-2xl bg-white dark:bg-zinc-900">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={abierto}
        aria-controls={`detalle-modo-${id}`}
        className="w-full p-4 flex items-center gap-3 text-left"
      >
        <span className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${activo ? 'bg-emerald-500/10' : 'bg-[#FF7A00]/10'}`}>
          {activo ? <CircleCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> : <Icon className="h-5 w-5 text-[#FF7A00]" />}
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2">
            <span className="text-sm font-semibold leading-tight">{titulo}</span>
          </span>
          <span className="block text-xs text-muted-foreground mt-1 leading-relaxed">{resumen}</span>
        </span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {abierto && (
        <div id={`detalle-modo-${id}`} className="px-4 pb-4 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="h-px bg-black/[0.06] dark:bg-white/[0.08] mb-4" />
          <div className={imagenes.length > 1 ? 'grid grid-cols-2 gap-2' : ''}>
            {imagenes.map((imagen) => imagenesConError.includes(imagen.src) ? (
              <div key={imagen.src} className="w-full aspect-video rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center px-3 text-center">
                <Icon className="h-6 w-6 text-[#FF7A00]" />
                <p className="text-[11px] font-semibold mt-2">Imagen a colocar</p>
                <p className="text-[10px] text-muted-foreground mt-1">{imagen.alt}</p>
              </div>
            ) : (
              <div key={imagen.src} className="relative group overflow-hidden rounded-xl">
                <img
                  src={imagen.src}
                  alt={imagen.alt}
                  onError={() => setImagenesConError((actuales) => [...actuales, imagen.src])}
                  className={imagenes.length > 1 ? 'w-full aspect-video object-cover' : 'w-full h-auto'}
                />
                <button
                  type="button"
                  onClick={() => setImagenAmpliada(imagen)}
                  className="absolute bottom-2 right-2 h-8 rounded-lg bg-black/70 hover:bg-black/85 px-2.5 text-[11px] font-semibold text-white backdrop-blur-sm flex items-center gap-1.5 transition-colors"
                  aria-label={`Ver en grande: ${imagen.alt}`}
                >
                  <Maximize2 className="h-3.5 w-3.5" /> Ver en grande
                </button>
              </div>
            ))}
          </div>
          <p className="text-[13.5px] leading-relaxed text-muted-foreground mt-4">{detalle}</p>
          {children && <div className="mt-4">{children}</div>}
          <button
            type="button"
            onClick={onActivar}
            disabled={activo || procesando}
            className={`w-full h-12 mt-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${activo ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-[#FF7A00] hover:bg-[#E66E00] text-white active:scale-[0.985]'} disabled:cursor-default`}
          >
            {procesando ? <><Loader2 className="h-4 w-4 animate-spin" /> Activando…</> : activo ? <><Check className="h-4 w-4" /> Activado</> : textoActivar}
          </button>
        </div>
      )}
      {imagenAmpliada && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={imagenAmpliada.alt}
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center animate-in fade-in duration-200"
          onClick={() => setImagenAmpliada(null)}
        >
          <button
            type="button"
            onClick={() => setImagenAmpliada(null)}
            className="fixed right-4 top-4 h-10 w-10 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center"
            aria-label="Cerrar imagen"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={imagenAmpliada.src}
            alt={imagenAmpliada.alt}
            className="max-h-[92vh] max-w-[96vw] object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>,
        document.body,
      )}
    </section>
  )
}

// ── Alias y medios de pago: se abre directo en el alias, que sólo el dueño conoce ──
function PagosForm({ initial, sucursal, autoTransfer, mercadoPago, onGuardar }: {
  initial: PagosDraft
  sucursal?: string
  autoTransfer: boolean
  mercadoPago: boolean
  onGuardar: (pagos: PagosDraft) => void
}) {
  const [pagos, setPagos] = useState<PagosDraft>(initial)
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onGuardar(pagos) }}
      className="animate-in fade-in slide-in-from-bottom-2 duration-400"
    >
      {sucursal && <span className="block text-center text-lg font-semibold tracking-tight text-[#FF7A00] mb-2">{sucursal}</span>}
      <h1 className="text-center text-[1.9rem] leading-[1.12] font-semibold tracking-tight">
        {pagos.transferenciaManual ? '¿A qué alias te transfieren?' : '¿Cómo te pagan?'}
      </h1>
      <p className="text-center text-[15px] text-muted-foreground mt-3">
        {pagos.transferenciaManual
          ? 'Es el que ven tus clientes cuando eligen pagar por transferencia. Copialo tal cual de tu banco o billetera.'
          : 'Elegí los medios de pago que aceptás.'}
      </p>

      {pagos.transferenciaManual && (
        <div className="mt-7">
          <label htmlFor="claim-alias" className="block text-sm font-medium mb-2">
            {sucursal ? `Alias o CBU de ${sucursal}` : 'Tu alias o CBU'}
          </label>
          <div className="flex items-center gap-3 h-14 rounded-2xl bg-white dark:bg-zinc-900 px-4 ring-1 ring-zinc-200 dark:ring-zinc-800 focus-within:ring-2 focus-within:ring-[#FF7A00]/40 transition-shadow">
            <Banknote className="h-5 w-5 shrink-0 text-[#FF7A00]" />
            <input
              id="claim-alias"
              autoFocus
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={pagos.transferenciaAlias}
              onChange={(e) => setPagos((p) => ({ ...p, transferenciaAlias: e.target.value }))}
              placeholder="mi.local.mp"
              className="flex-1 min-w-0 bg-transparent border-0 outline-none text-base font-semibold"
            />
          </div>
        </div>
      )}

      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80 mt-7 mb-2">Medios que aceptás</p>
      <div className="space-y-2">
        <ToggleRow icon={Wallet} label="Efectivo" checked={pagos.efectivo} onToggle={() => setPagos((p) => ({ ...p, efectivo: !p.efectivo }))} />
        <ToggleRow icon={Banknote} label="Transferencia" checked={pagos.transferenciaManual} onToggle={() => setPagos((p) => ({ ...p, transferenciaManual: !p.transferenciaManual }))} />
      </div>
      {(autoTransfer || mercadoPago) && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground mt-3 px-1">
          <CreditCard className="h-3.5 w-3.5 shrink-0" />
          {mercadoPago && 'MercadoPago'}{mercadoPago && autoTransfer && ' y '}{autoTransfer && 'la transferencia automática'} también {mercadoPago && autoTransfer ? 'quedan activos' : 'queda activo'}.
        </p>
      )}
      {sucursal && <p className="text-xs text-muted-foreground mt-3 px-1">Los medios son los mismos en todos los locales; el alias es de cada sucursal.</p>}

      <button type="submit" className="w-full h-14 mt-7 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white active:scale-[0.985] transition-all">
        Continuar
      </button>
    </form>
  )
}

// ── Una forma de entrar al panel (radio) ──
function OpcionAcceso({ icon: Icon, titulo, texto, elegido, onElegir }: {
  icon: LucideIcon
  titulo: string
  texto: string
  elegido: boolean
  onElegir: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={elegido}
      onClick={onElegir}
      className={`w-full rounded-2xl border p-4 flex items-center gap-3 text-left transition-colors ${elegido ? 'border-[#FF7A00] bg-orange-500/[0.06]' : 'border-zinc-200 dark:border-zinc-800 hover:border-[#FF7A00]/50'}`}
    >
      <span className={`h-11 w-11 shrink-0 rounded-xl flex items-center justify-center ${elegido ? 'bg-[#FF7A00] text-white' : 'bg-zinc-100 dark:bg-zinc-900 text-muted-foreground'}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold">{titulo}</span>
        <span className="block text-xs text-muted-foreground mt-0.5 leading-relaxed">{texto}</span>
      </span>
      <span className={`h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center ${elegido ? 'border-[#FF7A00]' : 'border-zinc-300 dark:border-zinc-700'}`}>
        {elegido && <span className="h-2.5 w-2.5 rounded-full bg-[#FF7A00]" />}
      </span>
    </button>
  )
}

// ── Herramientas incluidas que se prenden con un toque en "Cómo trabajás". Sólo muestra las que el
//    catálogo de la cuenta tiene como incluidas y activables. ──
function HerramientasIncluidas() {
  const [modulos, setModulos] = useState<Modulo[] | null>(null)
  const [procesando, setProcesando] = useState<string | null>(null)
  useEffect(() => {
    const authToken = useAuthStore.getState().token
    if (!authToken) return
    modulosApi.misModulos(authToken)
      .then((res) => setModulos(res.data.flatMap((categoria) => categoria.modulos)))
      .catch(() => setModulos([]))
  }, [])

  const disponibles = HERRAMIENTAS_INCLUIDAS.flatMap((h) => {
    const modulo = modulos?.find((m) => m.codigo === h.codigo)
    if (!modulo || modulo.tipo !== 'incluido' || !modulo.activable || modulo.estadoProducto === 'proximamente') return []
    return [{ ...h, activo: modulo.activoAhora }]
  })
  if (disponibles.length === 0) return null

  const alternar = async (codigo: string, activo: boolean) => {
    const authToken = useAuthStore.getState().token
    if (!authToken || procesando) return
    setProcesando(codigo)
    try {
      const res = activo ? await modulosApi.desactivar(authToken, codigo) : await modulosApi.activar(authToken, codigo)
      if ('paymentRequired' in res && res.paymentRequired) {
        toast.info('Esta herramienta se activa desde Módulos, en tu panel')
        return
      }
      setModulos((actuales) => actuales?.map((m) => m.codigo === codigo ? { ...m, activoAhora: !activo } : m) ?? null)
    } catch (error) {
      toast.error('No pudimos cambiar esta herramienta', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setProcesando(null)
    }
  }

  return (
    <div className="mt-7">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80 mb-2 px-1">¿Usás alguna de estas?</p>
      <div className="rounded-2xl bg-white dark:bg-zinc-900 p-1.5">
        {disponibles.map((h) => (
          <button
            key={h.codigo}
            type="button"
            role="switch"
            aria-checked={h.activo}
            disabled={procesando === h.codigo}
            onClick={() => alternar(h.codigo, h.activo)}
            className="w-full rounded-xl p-3 flex items-center gap-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors disabled:opacity-60"
          >
            <span className="h-9 w-9 shrink-0 rounded-xl bg-orange-500/10 flex items-center justify-center">
              {procesando === h.codigo ? <Loader2 className="h-4 w-4 animate-spin text-[#FF7A00]" /> : <h.icon className="h-4 w-4 text-[#FF7A00]" />}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold leading-tight">{h.titulo}</span>
              <span className="block text-xs text-muted-foreground mt-0.5 leading-relaxed">{h.texto}</span>
            </span>
            <span className={`h-6 w-10 shrink-0 rounded-full p-0.5 transition-colors ${h.activo ? 'bg-[#FF7A00]' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
              <span className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${h.activo ? 'translate-x-4' : ''}`} />
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Fila con toggle para el editor de métodos de pago ──
function ToggleRow({ icon: Icon, label, checked, onToggle }: { icon: LucideIcon; label: string; checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-3 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-900 px-4 transition-colors"
    >
      <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
      <span className="flex-1 text-left text-sm font-medium">{label}</span>
      <span className={`h-6 w-10 rounded-full p-0.5 transition-colors ${checked ? 'bg-[#FF7A00]' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
        <span className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </span>
    </button>
  )
}

// ── Etiqueta discreta para las secciones de la tarjeta de producto (misma que Onboarding) ──
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1.5">{children}</p>
}

type OpcionProducto = { nombre: string; precio: number }

function OpcionesProducto({ opciones, adicional = false }: { opciones: OpcionProducto[]; adicional?: boolean }) {
  return (
    <div className="mt-2.5 space-y-1.5 text-left">
      {opciones.map((opcion, index) => (
        <div key={`${opcion.nombre}-${index}`} className="flex items-baseline gap-2">
          <span className="text-[13.5px] text-foreground/80 truncate">{opcion.nombre}</span>
          <span className="flex-1 border-b border-dotted border-black/15 dark:border-white/15 -translate-y-[3px]" />
          <span className="text-[13.5px] font-medium tabular-nums shrink-0">
            {adicional ? '+' : ''}${fmtPrecio(opcion.precio)}
          </span>
        </div>
      ))}
    </div>
  )
}

function PasoProducto({ titulo, opciones, adicional = false }: { titulo: string; opciones: OpcionProducto[]; adicional?: boolean }) {
  if (opciones.length === 0) return null
  return (
    <div className="text-left">
      <p className="text-[13px] font-semibold leading-snug text-foreground">{titulo}</p>
      <OpcionesProducto opciones={opciones} adicional={adicional} />
    </div>
  )
}

// ── Tarjeta de producto (solo lectura). Refleja todos los pasos configurables del producto sin
//    convertir el recorrido del claim en un formulario. ──
function ProductoCard({ p }: { p: ClaimConfig['productos'][number] }) {
  // Los fallbacks mantienen el claim usable durante un deploy escalonado con backends anteriores.
  const variantesPrimarias = p.variantesPrimarias ?? p.variantes ?? []
  const variantesSecundarias = p.variantesSecundarias ?? []
  const ingredientes = p.ingredientes ?? []
  const extrasPrimarios = p.extrasPrimarios ?? p.extras ?? []
  const extrasSecundarios = p.extrasSecundarios ?? []
  const tieneVariantes = variantesPrimarias.length > 0
  const secciones = [
    variantesPrimarias.length > 0,
    variantesSecundarias.length > 0,
    ingredientes.length > 0,
    extrasPrimarios.length > 0,
    extrasSecundarios.length > 0,
    p.permiteNota === true,
  ].filter(Boolean).length

  return (
    <article className="rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-900 text-center ring-1 ring-black/[0.03] dark:ring-white/[0.04]">
      {p.imagenUrl && (
        <div className="w-full aspect-[16/9] max-h-52 overflow-hidden bg-zinc-200 dark:bg-zinc-800">
          <img
            src={p.imagenUrl}
            alt={p.nombre}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </div>
      )}

      <div className="px-5 py-5">
        <h3 className="text-[21px] font-semibold leading-tight tracking-tight px-4">{p.nombre}</h3>

        {!tieneVariantes && (
          <p className="mt-2 text-[17px] font-semibold tabular-nums tracking-tight text-[#FF7A00]">${fmtPrecio(p.precio)}</p>
        )}

        {p.descripcion && (
          <p className="text-[13.5px] text-muted-foreground mt-2 leading-relaxed max-w-[44ch] mx-auto">{p.descripcion}</p>
        )}

        {secciones > 0 && (
          <div className="mt-5 pt-4 border-t border-black/[0.06] dark:border-white/[0.08] max-w-xs mx-auto space-y-4">
            <PasoProducto
              titulo={p.tituloVariantesPrimarias || 'Elegí una opción'}
              opciones={variantesPrimarias}
            />
            <PasoProducto
              titulo={p.tituloVariantesSecundarias || 'Elegí también una segunda opción'}
              opciones={variantesSecundarias}
              adicional
            />

            {ingredientes.length > 0 && (
              <div>
                <FieldLabel>Ingredientes que puede quitar</FieldLabel>
                <p className="text-[13px] text-muted-foreground leading-relaxed">{ingredientes.join(' · ')}</p>
              </div>
            )}

            <PasoProducto
              titulo={p.tituloExtrasPrimarios || 'Extras'}
              opciones={extrasPrimarios}
              adicional
            />
            <PasoProducto
              titulo={p.tituloExtrasSecundarios || 'Extras'}
              opciones={extrasSecundarios}
              adicional
            />

            {p.permiteNota === true && (
              <div className="text-left">
                <p className="text-[13px] font-semibold leading-snug text-foreground">
                  {p.tituloNota || '¿Querés aclarar algo?'}
                </p>
                <div className="mt-2 h-9 rounded-lg border border-black/[0.08] dark:border-white/[0.1] bg-white/60 dark:bg-white/[0.03] px-3 flex items-center">
                  <span className="text-xs text-muted-foreground">Nota opcional del cliente</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  )
}

// ── Alta de sucursales dentro del claim. Todavía no hay sesión: sólo arma el borrador local. ──
function SucursalesClaimEditor({ initial, pagosDefault, onGuardar }: {
  initial: SucursalDraft[]
  pagosDefault: PagosDraft
  onGuardar: (sucursales: SucursalDraft[]) => void
}) {
  const [items, setItems] = useState<SucursalDraft[]>(() => initial.map((s) => ({ ...s, pagos: { ...s.pagos } })))

  const patchItem = (idx: number, patch: Partial<SucursalDraft>) => {
    setItems((prev) => prev.map((s, i) => i === idx ? { ...s, ...patch } : s))
  }
  const agregar = () => setItems((prev) => [...prev, {
    localId: crypto.randomUUID(),
    nombre: `Sucursal ${prev.length + 1}`,
    address: '',
    center: null,
    pagos: { ...pagosDefault },
    whatsappNumber: '',
  }])
  const quitar = (idx: number) => {
    if (items.length <= 2) return toast.error('Para elegir múltiples sucursales necesitás al menos dos')
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }
  const guardar = () => {
    if (items.some((s) => s.nombre.trim().length < 2)) return toast.error('Poné un nombre para cada sucursal')
    if (items.some((s) => !s.address.trim() || !s.center)) return toast.error('Elegí la dirección exacta de cada sucursal')
    onGuardar(items.map((s) => ({ ...s, nombre: s.nombre.trim(), address: s.address.trim() })))
  }

  return (
    <div className="w-full mt-6 space-y-3 text-left">
      {items.map((sucursal, idx) => (
        <div key={sucursal.localId} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <span className="text-xs font-semibold text-muted-foreground">Local {idx + 1}</span>
            <button type="button" onClick={() => quitar(idx)} className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10" aria-label={`Quitar ${sucursal.nombre}`}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <input value={sucursal.nombre} onChange={(e) => patchItem(idx, { nombre: e.target.value })} placeholder="Ej: Centro" className="w-full h-11 rounded-xl bg-zinc-100 dark:bg-zinc-900 border-0 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#FF7A00]/30" />
          <div className="mt-2.5">
            <AddressAutocomplete
              value={sucursal.address}
              onChange={(address, lat, lng) => patchItem(idx, { address, center: lat != null && lng != null ? { lat, lng } : null, delivery: undefined })}
              placeholder="Dirección exacta del local"
            />
          </div>
        </div>
      ))}
      <button type="button" onClick={agregar} className="w-full h-11 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-[#FF7A00]/60 flex items-center justify-center gap-2">
        <Plus className="h-4 w-4" /> Agregar otra sucursal
      </button>
      <button type="button" onClick={guardar} className="w-full h-14 mt-3 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white active:scale-[0.985] transition-all flex items-center justify-center gap-2">
        <Check className="h-4 w-4" /> Continuar con estas sucursales
      </button>
    </div>
  )
}

// ── Editor de entregas: primero define delivery/takeaway. Sólo si hay delivery pide la dirección
//    (o la muestra ya cargada) y abre el mapa en "Dibujar zonas", con su presentación la primera vez. ──
function DeliveryEditor({ initial, direccionCargada = false, initialTipos, onGuardar, onSaltar, textoSaltar, skipTipos = false }: {
  initial?: DeliveryDraft
  /** La dirección de `initial` vino del local (no del borrador): se muestra como cargada. */
  direccionCargada?: boolean
  initialTipos: TiposPedidoDraft
  onGuardar: (tipos: TiposPedidoDraft, delivery?: DeliveryDraft) => void
  onSaltar: () => void
  textoSaltar: string
  skipTipos?: boolean
}) {
  const [tipos, setTipos] = useState<TiposPedidoDraft>(initialTipos)
  const [pasoTipos, setPasoTipos] = useState<'delivery' | 'takeaway' | 'configuracion'>(skipTipos ? 'configuracion' : 'delivery')
  // Dirección del local: sin ubicación geolocalizada no mostramos el mapa. Si ya estaba cargada (o
  // venimos de un borrador), arrancamos con ella y sólo se reemplaza si toca "Cambiar".
  const [address, setAddress] = useState(initial?.address ?? '')
  const [lat, setLat] = useState<number | null>(initial?.center.lat ?? null)
  const [lng, setLng] = useState<number | null>(initial?.center.lng ?? null)
  const [cambiandoDireccion, setCambiandoDireccion] = useState(!initial)
  const tieneUbicacion = lat != null && lng != null
  // Memoizado por lat/lng: identidad estable para que RecenterMap no resetee el zoom en cada render.
  const center = useMemo<[number, number]>(() => [lat ?? DEFAULT_CENTER[0], lng ?? DEFAULT_CENTER[1]], [lat, lng])
  const centerObj = { lat: center[0], lng: center[1] }

  // Las zonas las dibuja el dueño: es el modo por defecto.
  const [mode, setMode] = useState<'radio' | 'zonas'>(initial?.mode ?? 'zonas')
  // Radio
  const [radius, setRadius] = useState(initial?.mode === 'radio' ? initial.radius : 2500)
  const [precioRadio, setPrecioRadio] = useState(initial?.mode === 'radio' ? initial.precio : '0')
  // Zonas dibujadas
  const [zonas, setZonas] = useState<ZonaDraft[]>(initial?.mode === 'zonas' ? initial.zonas : [])
  const [pending, setPending] = useState<{ lat: number; lng: number }[] | null>(null)
  const [nombre, setNombre] = useState('')
  const [precioZona, setPrecioZona] = useState('')
  const [color, setColor] = useState('#FF7A00')
  // Presentación de "Dibujar zonas": se abre sola la primera vez que se ve el mapa sin zonas.
  const [introAbierta, setIntroAbierta] = useState(false)
  const [introMostrada, setIntroMostrada] = useState(false)
  const mapaVisible = pasoTipos === 'configuracion' && tipos.delivery && tieneUbicacion && !cambiandoDireccion
  // Ajuste durante el render (sin efecto): la primera vez que aparece el mapa vacío en modo zonas.
  if (mapaVisible && mode === 'zonas' && zonas.length === 0 && !introMostrada) {
    setIntroMostrada(true)
    setIntroAbierta(true)
  }

  const onPolygonCreated = useCallback((coords: { lat: number; lng: number }[]) => {
    setColor(getNextColor(zonas.map((z) => z.color)))
    setNombre(zonas.length === 0 ? 'Centro' : '')
    setPrecioZona('')
    setPending(coords)
  }, [zonas])

  const agregarZona = () => {
    if (!pending) return
    if (!nombre.trim()) return toast.error('Poné un nombre a la zona')
    if (!precioZona.trim()) return toast.error('Poné el precio del envío')
    setZonas((prev) => [...prev, { nombre: nombre.trim(), precio: precioZona, poligono: pending, color }])
    setPending(null)
    setNombre('')
    setPrecioZona('')
  }

  const guardar = () => {
    if (!tipos.delivery && !tipos.takeaway) return toast.error('Elegí al menos un tipo de pedido')
    if (!tipos.delivery) {
      onGuardar(tipos)
      return
    }
    if (!tieneUbicacion) return toast.error('Elegí tu dirección de la lista')
    if (mode === 'radio') {
      onGuardar(tipos, { mode: 'radio', precio: precioRadio || '0', radius, center: centerObj, address })
    } else {
      if (pending) return toast.error('Terminá de cargar la zona: poné el nombre y el precio')
      if (zonas.length === 0) return toast.error('Dibujá al menos una zona')
      onGuardar(tipos, { mode: 'zonas', zonas, center: centerObj, address })
    }
  }

  const responderDelivery = (delivery: boolean) => {
    setTipos((actual) => ({ ...actual, delivery }))
    setPasoTipos('takeaway')
  }

  const responderTakeaway = (takeaway: boolean) => {
    if (!tipos.delivery && !takeaway) {
      toast.error('Necesitás ofrecer delivery, takeaway o ambos')
      return
    }
    setTipos((actual) => ({ ...actual, takeaway }))
    setPasoTipos('configuracion')
  }

  const botonSaltar = (
    <button type="button" onClick={onSaltar} className="w-full h-11 mt-2.5 rounded-2xl text-[14px] font-medium text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
      {textoSaltar}
    </button>
  )

  return (
    <div className="w-full mt-6 text-left">
      {/* Una sola pregunta por pantalla, con opciones visualmente neutras. */}
      {pasoTipos === 'delivery' && (
        <PreguntaTipoPedido
          icon={MapPin}
          pregunta="¿Hacés pedidos con delivery?"
          aclaracion="Es decir, llevás el pedido hasta la dirección del cliente."
          onSi={() => responderDelivery(true)}
          onNo={() => responderDelivery(false)}
        />
      )}

      {pasoTipos === 'takeaway' && (
        <PreguntaTipoPedido
          icon={ShoppingBag}
          pregunta="¿Hacés pedidos takeaway?"
          aclaracion="Es decir, el cliente hace el pedido y lo retira en tu local."
          onSi={() => responderTakeaway(true)}
          onNo={() => responderTakeaway(false)}
          onVolver={() => setPasoTipos('delivery')}
        />
      )}

      {pasoTipos === 'configuracion' && !tipos.delivery ? (
        <>
          <p className="mt-3 rounded-2xl bg-zinc-100 dark:bg-zinc-900 px-4 py-3 text-sm text-muted-foreground">
            Como trabajás sólo con takeaway, no hace falta dirección ni costos de envío.
          </p>
          <button onClick={guardar} className="w-full h-14 mt-6 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white active:scale-[0.985] transition-all flex items-center justify-center gap-2">
            Continuar
          </button>
          {!skipTipos && (
            <button type="button" onClick={() => setPasoTipos('delivery')} className="w-full h-11 mt-2.5 rounded-2xl text-[14px] font-medium text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
              Volver
            </button>
          )}
        </>
      ) : pasoTipos === 'configuracion' && tipos.delivery ? (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-400 mt-2">
      {/* Dirección del local: cargada (con opción a cambiarla) o para elegir. */}
      <p className="text-sm font-medium text-foreground mb-2">¿Desde dónde entregás?</p>
      {!cambiandoDireccion && tieneUbicacion ? (
        <div className="flex items-center gap-3 min-h-14 rounded-2xl bg-white dark:bg-zinc-900 px-4 py-2.5 ring-1 ring-emerald-500/20">
          <MapPin className="h-4 w-4 shrink-0 text-[#FF7A00]" />
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold leading-snug">{address || 'La ubicación de tu local'}</span>
            {direccionCargada && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                <CircleCheck className="h-3.5 w-3.5" /> Ya estaba cargada
              </span>
            )}
          </span>
          <button type="button" onClick={() => setCambiandoDireccion(true)} className="h-9 shrink-0 rounded-xl px-3 text-[13px] font-semibold text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800">
            Cambiar
          </button>
        </div>
      ) : (
        <AddressAutocomplete
          value={address}
          onChange={(a, la, ln) => {
            setAddress(a)
            setLat(la)
            setLng(ln)
            if (la != null && ln != null) setCambiandoDireccion(false)
          }}
          placeholder="Av. Corrientes 1234"
        />
      )}

      {!mapaVisible ? (
        <>
          <div className="mt-3 flex items-center gap-2.5 text-sm text-muted-foreground rounded-2xl bg-zinc-100 dark:bg-zinc-900 px-4 py-3.5">
            <MapPin className="h-4 w-4 text-[#FF7A00] shrink-0" />
            Elegí tu dirección de la lista para dibujar tus zonas de reparto.
          </div>
          {botonSaltar}
        </>
      ) : (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-400">
      {/* Selector de modo: dibujar zonas primero, porque es lo que casi todos necesitan. */}
      <div className="grid grid-cols-2 gap-2 mt-4 mb-3">
        <button
          type="button"
          onClick={() => setMode('zonas')}
          className={`h-11 rounded-xl text-sm font-semibold transition-colors ${mode === 'zonas' ? 'bg-[#FF7A00] text-white' : 'bg-zinc-100 dark:bg-zinc-900 text-muted-foreground'}`}
        >
          Dibujar zonas
        </button>
        <button
          type="button"
          onClick={() => setMode('radio')}
          className={`h-11 rounded-xl text-sm font-semibold transition-colors ${mode === 'radio' ? 'bg-[#FF7A00] text-white' : 'bg-zinc-100 dark:bg-zinc-900 text-muted-foreground'}`}
        >
          Un radio
        </button>
      </div>

      <div className="rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 h-72 relative">
        <MapContainer center={center} zoom={14} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapResizer dep={mode} />
          <RecenterMap center={center} />
          {mode === 'radio' ? (
            <Circle center={center} radius={radius} pathOptions={{ color: '#FF7A00', fillColor: '#FF7A00', fillOpacity: 0.15, weight: 2 }} />
          ) : (
            <>
              <DrawControl onPolygonCreated={onPolygonCreated} />
              {zonas.map((z, i) => (
                <Polygon key={i} positions={z.poligono.map((c) => [c.lat, c.lng] as [number, number])} pathOptions={{ color: z.color, fillColor: z.color, fillOpacity: 0.25, weight: 2 }} />
              ))}
              {pending && <Polygon positions={pending.map((c) => [c.lat, c.lng] as [number, number])} pathOptions={{ color, fillColor: color, fillOpacity: 0.3, weight: 2, dashArray: '5 5' }} />}
            </>
          )}
        </MapContainer>
      </div>

      {/* ── Controles del modo radio ── */}
      {mode === 'radio' && (
        <div className="mt-3 space-y-3">
          <div className="rounded-2xl bg-zinc-100 dark:bg-zinc-900 p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Radio de reparto</span>
              <span className="text-sm font-semibold tabular-nums">{(radius / 1000).toFixed(1)} km</span>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setRadius((r) => Math.max(500, r - 500))} className="h-8 w-8 rounded-lg bg-white dark:bg-zinc-800 flex items-center justify-center shrink-0"><Minus className="h-4 w-4" /></button>
              <input type="range" min={500} max={10000} step={500} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="flex-1 accent-[#FF7A00]" />
              <button type="button" onClick={() => setRadius((r) => Math.min(10000, r + 500))} className="h-8 w-8 rounded-lg bg-white dark:bg-zinc-800 flex items-center justify-center shrink-0"><Plus className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="flex items-center rounded-2xl bg-zinc-100 dark:bg-zinc-900 px-4 h-12">
            <span className="text-muted-foreground text-sm">Precio del envío  $</span>
            <input type="number" value={precioRadio} onChange={(e) => setPrecioRadio(e.target.value)} placeholder="0" className="flex-1 bg-transparent outline-none text-sm font-semibold px-1 min-w-0" />
          </div>
        </div>
      )}

      {/* ── Controles del modo zonas ── */}
      {mode === 'zonas' && (
        <>
          {pending ? (
            <div className="mt-3 rounded-2xl bg-zinc-100 dark:bg-zinc-900 p-3.5 space-y-3 animate-in fade-in slide-in-from-bottom-1 duration-300">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: color }} /> Nueva zona</p>
                <button onClick={() => setPending(null)} aria-label="Descartar zona" className="h-7 w-7 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
              </div>
              <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre (ej: Centro)" className="w-full h-10 bg-white dark:bg-zinc-800 border-0 text-sm rounded-xl px-3 outline-none" />
              <div className="flex items-center rounded-xl bg-white dark:bg-zinc-800 px-4 h-10">
                <span className="text-muted-foreground text-sm">$</span>
                <input type="number" inputMode="numeric" value={precioZona} onChange={(e) => setPrecioZona(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && agregarZona()} placeholder="Costo de envío" className="flex-1 bg-transparent outline-none text-sm px-1" />
              </div>
              <button onClick={agregarZona} className="w-full h-11 rounded-xl bg-[#FF7A00] hover:bg-[#E66E00] text-white font-semibold flex items-center justify-center gap-2"><Save className="h-4 w-4" /> Agregar zona</button>
            </div>
          ) : (
            <div className="mt-3 flex items-start gap-3 rounded-2xl bg-orange-500/[0.06] px-4 py-3">
              <svg width={18} height={18} viewBox="0 0 16 16" className="mt-0.5 shrink-0" aria-hidden>
                <path d="M8 1.6 14.4 6.2 12 14H4L1.6 6.2Z" fill="none" stroke="#FF7A00" strokeWidth={1.6} strokeLinejoin="round" />
              </svg>
              <p className="flex-1 text-[13px] leading-relaxed text-muted-foreground">
                {zonas.length === 0
                  ? 'Tocá el pentágono arriba a la izquierda del mapa, marcá las esquinas y cerrá tocando el primer punto.'
                  : 'Para sumar otra zona, tocá de nuevo el pentágono.'}{' '}
                <button type="button" onClick={() => setIntroAbierta(true)} className="font-semibold text-[#FF7A00] hover:text-[#E66E00]">
                  Ver cómo
                </button>
              </p>
            </div>
          )}

          {zonas.length > 0 && (
            <div className="mt-3 space-y-2">
              {zonas.map((z, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 px-3.5 h-12">
                  <span className="h-3 w-3 rounded-full shrink-0" style={{ background: z.color }} />
                  <span className="text-sm font-semibold flex-1 truncate">{z.nombre}</span>
                  <span className="text-sm font-semibold tabular-nums">${fmtPrecio(z.precio)}</span>
                  <button onClick={() => setZonas((prev) => prev.filter((_, k) => k !== i))} aria-label={`Quitar ${z.nombre}`} className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 shrink-0"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <button onClick={guardar} className="w-full h-14 mt-6 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white active:scale-[0.985] transition-all flex items-center justify-center gap-2">
        <Check className="h-4 w-4" /> {mode === 'zonas' && zonas.length > 1 ? `Guardar mis ${zonas.length} zonas` : 'Guardar delivery'}
      </button>
      {botonSaltar}
      <IntroZonas abierto={introAbierta} onCerrar={() => setIntroAbierta(false)} />
      </div>
      )}
      </div>
      ) : null}
    </div>
  )
}

function PreguntaTipoPedido({ icon: Icon, pregunta, aclaracion, onSi, onNo, onVolver }: {
  icon: LucideIcon
  pregunta: string
  aclaracion: string
  onSi: () => void
  onNo: () => void
  onVolver?: () => void
}) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="h-12 w-12 mx-auto rounded-2xl bg-zinc-100 dark:bg-zinc-900 text-muted-foreground flex items-center justify-center">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-center text-lg font-semibold text-foreground">{pregunta}</p>
      <p className="mt-1.5 text-center text-sm text-muted-foreground">{aclaracion}</p>
      <div className="grid grid-cols-2 gap-2 mt-6">
        <button type="button" onClick={onSi} className="h-12 rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm font-semibold text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
          Sí
        </button>
        <button type="button" onClick={onNo} className="h-12 rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm font-semibold text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
          No
        </button>
      </div>
      {onVolver && (
        <div className="flex items-center justify-center mt-3">
          <button type="button" onClick={onVolver} className="h-10 px-4 rounded-xl text-sm font-medium text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
            Volver
          </button>
        </div>
      )}
    </div>
  )
}

function BloqueoView({ bloqueo, onLogin }: { bloqueo: NonNullable<Bloqueo>; onLogin: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <div className="h-14 w-14 rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
        <Store className="h-6 w-6 text-muted-foreground" />
      </div>
      <h1 className="text-xl font-semibold text-foreground">{bloqueo.titulo}</h1>
      <p className="max-w-[18rem] text-sm text-muted-foreground">{bloqueo.detalle}</p>
      {bloqueo.irALogin && (
        <button onClick={onLogin} className="mt-3 flex items-center justify-center rounded-2xl h-11 px-6 bg-[#FF7A00] hover:bg-[#E66E00] text-white text-sm font-semibold transition-all active:scale-[0.98]">
          Ir a iniciar sesión
        </button>
      )}
    </div>
  )
}

/** Traduce el 404 con flags del backend al mensaje correcto (y a dónde mandar al dueño). */
function mapBloqueo(e: unknown): Bloqueo {
  if (e instanceof ApiError) {
    if (e.response?.yaReclamada) {
      return {
        titulo: 'Esta tienda ya es tuya',
        detalle: 'Ya reclamaste esta tienda antes. Entrá con tu WhatsApp desde el inicio de sesión.',
        irALogin: true,
      }
    }
    if (e.response?.vencido) {
      return { titulo: 'Este link venció', detalle: 'Escribinos por WhatsApp y te mandamos uno nuevo para reclamar tu tienda.' }
    }
    return { titulo: 'Este link no es válido', detalle: e.message || 'Revisá que el link esté completo.' }
  }
  return { titulo: 'No pudimos cargar la tienda', detalle: 'Probá de nuevo en un momento.' }
}
