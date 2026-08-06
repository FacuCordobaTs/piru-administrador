import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router'
import { MapContainer, TileLayer, Circle, Polygon, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'
import 'leaflet-draw'
import {
  Loader2, Check, Store, MessageCircle, ArrowLeft, Pencil, ImagePlus, X, Save,
  Banknote, MapPin, UtensilsCrossed, CreditCard, Wallet, PencilRuler, Minus, Plus, AlertTriangle,
  ShoppingBag, Settings, Rocket, ArrowRight,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/authStore'
import { AddressAutocomplete } from '@/components/AddressAutocomplete'
import {
  claimApi, restauranteApi, zonasDeliveryApi, planesApi, ApiError,
  type ClaimTienda as ClaimTiendaData, type ClaimInventario, type ClaimConfig, type MiSuscripcion,
} from '@/lib/api'

const CODE_LENGTH = 6
const RESEND_COOLDOWN = 45 // segundos
// Centro por defecto del mapa cuando la tienda no tiene dirección geocodificada (Córdoba capital).
const DEFAULT_CENTER: [number, number] = [-31.4201, -64.1888]

/**
 * Claim de tienda (onboarding outbound) — ruta pública `/mi-tienda/:token`, SIN login.
 *
 * El dueño llega por el link que Facu le mandó por WhatsApp. La tienda ya está construida (Facu la
 * armó): esta pantalla no le pide "registrarse". Es un RECORRIDO DE APROBACIÓN: se le MUESTRA cada
 * dato ya cargado, una cosa por pantalla, con "Continuar" (primario) y "Modificar" (secundario).
 *
 * "Modificar" edita el dato AHÍ MISMO, en la tarjeta (nunca lo saca de la pantalla). El cambio NO
 * se guarda contra el backend en el momento (todavía no hay sesión): queda en un borrador local
 * (`draft`). Recién cuando el dueño confirma su WhatsApp (y tenemos su token) se persiste TODO el
 * borrador de una sola vez.
 *
 * Datos editables inline (del preview extendido, `config`): nombre, link, logo, métodos de pago +
 * alias de transferencia, y delivery (radio o zonas + precio). Los productos se muestran para verlos
 * (se editan en detalle adentro).
 *
 * Flujo: recorrido (`walk`) → verificación de WhatsApp → código (`codigo`) → persistir borrador →
 * pedido de prueba (`prueba`) → info del plan y prueba gratis (`plan`) → panel.
 */
type Paso = 'walk' | 'codigo' | 'prueba' | 'plan'

// Base de la tienda pública del local (mismo formato que el link que ve el dueño en el recorrido).
const STORE_BASE = 'https://my.piru.app'

// Copy de cada plan para la pantalla informativa final (espejo de la landing). El precio real sale
// de la suscripción cuando está disponible; esto es el fallback + el detalle de lo que incluye.
const PLAN_INFO: Record<string, { nombre: string; desc: string; precio: string; incluye: string[] }> = {
  basico: {
    nombre: 'Básico',
    precio: '$20.000',
    desc: 'Todo para vender online, con tu marca.',
    incluye: [
      'Pedidos por WhatsApp + centro de pedidos',
      'Impresión automática de comandas',
      'Productos, categorías y fotos ilimitados',
      'Todos los métodos de pago',
      'Cupones, promociones y horarios',
      'Múltiples sucursales y dominio propio',
    ],
  },
  intermedio: {
    nombre: 'Intermedio',
    precio: '$50.000',
    desc: 'Cero chat con el cliente: los avisos salen solos, con tu marca.',
    incluye: [
      'Todo lo del Básico',
      'Avisos automáticos al cliente por WhatsApp (200/mes)',
      'Facturación electrónica ARCA',
      'Integración con Rapiboy (cadetes)',
      'Estadísticas avanzadas',
    ],
  },
  avanzado: {
    nombre: 'Avanzado',
    precio: '$120.000',
    desc: 'Todo lo del Intermedio, más la máquina de recompra.',
    incluye: [
      'Todo lo del Intermedio',
      '200 avisos + 100 mensajes de campaña/mes',
      'Motor de Recompra (CRM gastronómico)',
      'Recupero de clientes dormidos y carritos',
    ],
  },
}

// Motivos de link no reclamable, para mostrar el mensaje correcto (y a dónde mandar al dueño).
type Bloqueo = { titulo: string; detalle: string; irALogin?: boolean } | null

// ── Borrador local de ediciones (se persiste al confirmar el WhatsApp) ──
type PagosDraft = { efectivo: boolean; transferenciaManual: boolean; transferenciaAlias: string }
type ZonaDraft = { nombre: string; precio: string; poligono: { lat: number; lng: number }[]; color: string }
type DeliveryDraft =
  | { mode: 'radio'; precio: string; radius: number; center: { lat: number; lng: number }; address: string }
  | { mode: 'zonas'; zonas: ZonaDraft[]; center: { lat: number; lng: number }; address: string }
type Draft = {
  nombre?: string
  username?: string
  logo?: string
  pagos?: PagosDraft
  delivery?: DeliveryDraft
}

// ── Tarjeta del recorrido ──
type Card =
  | { kind: 'intro' }
  | { kind: 'link' }
  | { kind: 'logo' }
  | { kind: 'productos' }
  | { kind: 'pagos' }
  | { kind: 'delivery' }
  | { kind: 'reassure'; id: string; icon: LucideIcon; titulo: string; valor: string }
  | { kind: 'verificar' }

// Convierte un texto en slug de URL: minúsculas, sin acentos, sólo alfanumérico.
const toSlug = (v: string) =>
  (v || '').toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '')

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

// Encaja el mapa a los polígonos dados (para que la(s) zona(s) siempre queden a la vista).
function FitBounds({ poligonos }: { poligonos: { lat: number; lng: number }[][] }) {
  const map = useMap()
  useEffect(() => {
    const coords: L.LatLngExpression[] = []
    poligonos.forEach((poly) => poly.forEach((c) => coords.push([c.lat, c.lng])))
    if (coords.length > 0) {
      map.fitBounds(L.latLngBounds(coords), { padding: [24, 24] })
      setTimeout(() => map.invalidateSize(), 250)
    }
  }, [poligonos, map])
  return null
}

const ZONE_COLORS = ['#FF7A00', '#3b82f6', '#ef4444', '#22c55e', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']
function getNextColor(usados: (string | null)[]): string {
  const disponibles = ZONE_COLORS.filter((c) => !usados.includes(c))
  return disponibles.length > 0 ? disponibles[0] : ZONE_COLORS[usados.length % ZONE_COLORS.length]
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

export default function ClaimTienda() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [loading, setLoading] = useState(true)
  const [bloqueo, setBloqueo] = useState<Bloqueo>(null)
  const [tienda, setTienda] = useState<ClaimTiendaData | null>(null)
  const [inventario, setInventario] = useState<ClaimInventario | null>(null)
  const [config, setConfig] = useState<ClaimConfig | null>(null)

  const [paso, setPaso] = useState<Paso>('walk')
  const [cardIdx, setCardIdx] = useState(0)
  const [enviando, setEnviando] = useState(false)
  // Suscripción (plan + trial) para la pantalla informativa final; se trae tras verificar.
  const [miSusc, setMiSusc] = useState<MiSuscripcion | null>(null)
  // Pago inmediato del plan desde el claim (opcional: saltear la prueba y pagar ya).
  const [pagandoPlan, setPagandoPlan] = useState(false)

  // Borrador de ediciones inline, se persiste al confirmar el WhatsApp.
  const [draft, setDraft] = useState<Draft>({})
  // Qué tarjeta está en modo edición, y buffers de los editores simples (nombre/link/logo/pagos).
  const [editing, setEditing] = useState<string | null>(null)
  const [tmpText, setTmpText] = useState('')
  const [tmpLogo, setTmpLogo] = useState<string | null>(null)
  const [tmpPagos, setTmpPagos] = useState<PagosDraft>({ efectivo: true, transferenciaManual: false, transferenciaAlias: '' })
  const [subiendoLogo, setSubiendoLogo] = useState(false)

  const [telefono, setTelefono] = useState('')

  // Estado del OTP (paso 2)
  const [verificationId, setVerificationId] = useState<string | null>(null)
  const [telefonoEnmascarado, setTelefonoEnmascarado] = useState<string | null>(null)
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''))
  const [verificando, setVerificando] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const inputsRef = useRef<Array<HTMLInputElement | null>>([])
  const submittingRef = useRef(false)

  // Tema del sistema (esta ruta vive fuera del layout que ya lo aplica)
  useEffect(() => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle('dark', isDark)
  }, [])

  // Preview de la tienda reclamable
  useEffect(() => {
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

  // Cuenta regresiva para reenviar el código
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  // Valores mostrados: el borrador pisa lo que vino del backend.
  const dispNombre = draft.nombre ?? tienda?.nombre ?? ''
  const dispUsername = draft.username ?? tienda?.username ?? ''
  const dispLogo = draft.logo ?? tienda?.imagenUrl ?? tienda?.imagenLightUrl ?? null

  // Estado de pagos mostrado (borrador o config del backend).
  const pagosView: PagosDraft = draft.pagos ?? {
    efectivo: config?.pagos.efectivo ?? true,
    transferenciaManual: config?.pagos.transferenciaManual ?? false,
    transferenciaAlias: config?.pagos.transferenciaAlias ?? '',
  }

  // Centro del mapa: dirección del local → 1ª zona → default.
  const mapCenter = useMemo<[number, number]>(() => {
    if (config?.delivery.lat != null && config?.delivery.lng != null) return [config.delivery.lat, config.delivery.lng]
    const p = config?.delivery.zonas?.[0]?.poligono?.[0]
    if (p) return [p.lat, p.lng]
    return DEFAULT_CENTER
  }, [config])

  // ── Recorrido: intro + link + logo + productos + pagos + delivery + verificación ──
  const cards = useMemo<Card[]>(() => {
    if (!tienda) return []
    const inv = inventario
    const list: Card[] = [{ kind: 'intro' }]

    if (inv?.tieneLink && tienda.username) list.push({ kind: 'link' })
    if (inv?.tieneImagen) list.push({ kind: 'logo' })

    if (config) {
      // Preview extendido: tarjetas ricas (ver/editar).
      if (config.productos.length > 0) list.push({ kind: 'productos' })
      list.push({ kind: 'pagos' })
      if (config.delivery.deliveryEnabled || config.delivery.zonas.length > 0) list.push({ kind: 'delivery' })
    } else {
      // Backend viejo sin `config`: caemos al resumen no editable.
      if ((inv?.productos ?? 0) > 0) {
        const n = inv!.productos
        list.push({ kind: 'reassure', id: 'menu', icon: UtensilsCrossed, titulo: 'Tu menú ya está cargado', valor: `${n} ${n === 1 ? 'producto listo' : 'productos listos'} para vender` })
      }
      if (inv?.tieneCobros) list.push({ kind: 'reassure', id: 'cobros', icon: Banknote, titulo: 'Tus cobros están activados', valor: 'Podés cobrar online y en efectivo' })
      if ((inv?.zonasDelivery ?? 0) > 0) {
        const n = inv!.zonasDelivery
        list.push({ kind: 'reassure', id: 'delivery', icon: MapPin, titulo: 'Tu zona de delivery', valor: `${n} ${n === 1 ? 'zona' : 'zonas'} de reparto` })
      }
    }

    list.push({ kind: 'verificar' })
    return list
  }, [tienda, inventario, config])

  const card = cards[cardIdx]

  const goCard = (i: number) => {
    setEditing(null)
    setCardIdx(Math.max(0, Math.min(i, cards.length - 1)))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const continuar = () => goCard(cardIdx + 1)

  // ── Editores inline simples ──
  const abrirEditor = (kind: string) => {
    if (kind === 'intro') setTmpText(dispNombre)
    if (kind === 'link') setTmpText(dispUsername)
    if (kind === 'logo') setTmpLogo(dispLogo)
    if (kind === 'pagos') setTmpPagos({ ...pagosView })
    setEditing(kind)
  }
  const cancelarEditor = () => setEditing(null)

  const guardarNombre = () => {
    const v = tmpText.trim()
    if (v.length < 2) return toast.error('El nombre es muy corto')
    setDraft((d) => ({ ...d, nombre: v }))
    setEditing(null)
  }
  const guardarLink = () => {
    const slug = toSlug(tmpText)
    if (slug.length < 3) return toast.error('El link necesita al menos 3 letras o números')
    setDraft((d) => ({ ...d, username: slug }))
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
  const guardarLogo = () => {
    if (!tmpLogo) return toast.error('Elegí una imagen')
    setDraft((d) => ({ ...d, logo: tmpLogo }))
    setEditing(null)
  }
  const guardarPagos = () => {
    if (tmpPagos.transferenciaManual && !tmpPagos.transferenciaAlias.trim())
      return toast.error('Poné el alias o CBU para la transferencia')
    if (!tmpPagos.efectivo && !tmpPagos.transferenciaManual && !config?.pagos.autoTransferAvailable && !config?.pagos.mpConnected)
      return toast.error('Dejá al menos un método de pago activo')
    setDraft((d) => ({ ...d, pagos: { ...tmpPagos, transferenciaAlias: tmpPagos.transferenciaAlias.trim() } }))
    setEditing(null)
  }

  const guardarDelivery = (d: DeliveryDraft) => {
    setDraft((prev) => ({ ...prev, delivery: d }))
    setEditing(null)
  }

  // Normaliza el WhatsApp tipeado: sólo dígitos + prefijo 54 si falta.
  const normalizarTelefono = (raw: string): string | null => {
    let limpio = raw.replace(/\D/g, '')
    if (limpio.length < 8) return null
    if (!limpio.startsWith('54')) limpio = `54${limpio}`
    return limpio
  }

  const iniciarReclamo = async () => {
    const tel = normalizarTelefono(telefono)
    if (!tel) {
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
    // 1) Identidad: nombre / link / logo (+ dirección del local si la definió en el delivery).
    const perfil: Record<string, string | number | null> = {}
    if (draft.nombre !== undefined) perfil.nombre = draft.nombre
    if (draft.username !== undefined) perfil.username = draft.username
    if (draft.logo !== undefined) {
      perfil.image = draft.logo
      perfil.imageLight = draft.logo
    }
    if (draft.delivery?.address) {
      perfil.direccion = draft.delivery.address
      perfil.direccionTexto = draft.delivery.address
      perfil.direccionLat = draft.delivery.center.lat
      perfil.direccionLng = draft.delivery.center.lng
    }
    let algoFallo = false
    if (Object.keys(perfil).length > 0) {
      try { await restauranteApi.update(nuevoToken, perfil as Parameters<typeof restauranteApi.update>[1]) } catch { algoFallo = true }
    }

    // 2) Métodos de pago + alias.
    if (draft.pagos) {
      try {
        await restauranteApi.updateMetodosPago(nuevoToken, {
          efectivo: draft.pagos.efectivo,
          transferenciaManual: draft.pagos.transferenciaManual,
          transferenciaAlias: draft.pagos.transferenciaManual ? draft.pagos.transferenciaAlias : '',
        })
      } catch { algoFallo = true }
    }

    // 3) Delivery: creamos las zonas nuevas y recién ahí borramos las viejas (nunca dejar sin zonas).
    if (draft.delivery) {
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

  const submitCodigo = useCallback(
    async (codigo: string) => {
      if (!verificationId || codigo.length !== CODE_LENGTH) return
      if (submittingRef.current) return
      submittingRef.current = true
      setVerificando(true)
      try {
        const r = await claimApi.verify(token, verificationId, codigo)
        setAuth(r.token, r.restaurante)
        // Con el token en mano, aplicamos todo lo que tocó en el recorrido, de una sola vez.
        await persistirDraft(r.token)
        // Traemos el plan + trial para la pantalla informativa final (best-effort, no bloquea).
        planesApi.miSuscripcion(r.token).then((res) => setMiSusc(res.data)).catch(() => {})
        toast.success('¡Tu tienda es tuya! 🎉')
        // No vamos directo al panel: primero el pedido de prueba y la info del plan.
        setPaso('prueba')
        window.scrollTo({ top: 0, behavior: 'smooth' })
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
    // persistirDraft depende de `draft`/`config`; los incluimos para la referencia actual.
    [verificationId, token, setAuth, navigate, draft, config],
  )

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
    const tel = normalizarTelefono(telefono)
    if (!tel) {
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

  // Pagar el plan ahora mismo desde el claim (redirige a Checkout Pro). Si por algún motivo no
  // tenemos el planId, caemos al panel para que pague desde "Tu plan".
  const pagarPlanAhora = async () => {
    const token = useAuthStore.getState().token
    if (!token || !miSusc?.planId) {
      navigate('/dashboard', { replace: true })
      return
    }
    setPagandoPlan(true)
    try {
      const res = await planesApi.suscribir(token, miSusc.planId, 'mensual')
      window.location.href = res.data.url_pago
    } catch {
      toast.error('No se pudo iniciar el pago', { description: 'Podés pagarlo desde tu panel.' })
      setPagandoPlan(false)
    }
  }

  const codigo = digits.join('')
  const progress = cards.length > 0 ? ((cardIdx + 1) / cards.length) * 100 : 0

  // Botones de una tarjeta editable: Continuar (primario) + Modificar (secundario).
  const AccionesDato = ({ onModificar, primary }: { onModificar: () => void; primary?: string }) => (
    <>
      <button
        onClick={continuar}
        className="w-full h-14 mt-7 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white active:scale-[0.985] transition-all"
      >
        {primary ?? 'Continuar'}
      </button>
      <button
        onClick={onModificar}
        className="w-full h-11 mt-2.5 rounded-2xl text-[14px] font-medium text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors flex items-center justify-center gap-1.5"
      >
        <Pencil className="h-3.5 w-3.5" /> Modificar
      </button>
    </>
  )

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
    <>
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
        <Check className="h-3.5 w-3.5" /> Ya está listo
      </span>
      <h1 className="text-[1.9rem] leading-[1.12] font-semibold tracking-tight mt-2">{children}</h1>
    </>
  )

  return (
    <div className="min-h-dvh flex items-center justify-center w-full bg-background px-6 py-10 selection:bg-orange-500/10 selection:text-[#FF7A00]">
      <div className="w-full max-w-sm animate-in fade-in duration-500">
        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : bloqueo ? (
          <BloqueoView bloqueo={bloqueo} onLogin={() => navigate('/login', { replace: true })} />
        ) : paso === 'walk' ? (
          <>
            {/* Barra de progreso del recorrido (sutil, no numerada) */}
            <div className="h-1 w-full rounded-full bg-zinc-100 dark:bg-zinc-900 mb-8 overflow-hidden">
              <div className="h-full rounded-full bg-[#FF7A00] transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
            </div>

            {cardIdx > 0 && (
              <button
                onClick={() => goCard(cardIdx - 1)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
              >
                <ArrowLeft className="h-4 w-4" /> Volver
              </button>
            )}

            {/* ── Portada + nombre (editable) ── */}
            {card?.kind === 'intro' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-400 text-center flex flex-col items-center">
                {dispLogo ? (
                  <img src={dispLogo} alt={dispNombre || 'Tu tienda'} className="h-20 w-20 rounded-2xl object-cover shadow-sm ring-1 ring-border" />
                ) : (
                  <div className="h-20 w-20 rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
                    <Store className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}

                {editing === 'intro' ? (
                  <div className="w-full mt-6">
                    <p className="text-sm text-muted-foreground mb-2 text-left">El nombre de tu local</p>
                    <input
                      autoFocus
                      value={tmpText}
                      onChange={(e) => setTmpText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && guardarNombre()}
                      placeholder="Burger Bros"
                      className="w-full h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border-0 px-4 text-lg font-semibold outline-none focus:ring-2 focus:ring-[#FF7A00]/30 transition-shadow"
                    />
                    <AccionesEditor onGuardar={guardarNombre} disabled={tmpText.trim().length < 2} />
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground mt-6">Esta tienda es de</p>
                    <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-tight mt-1">{dispNombre || 'tu local'}</h1>
                    <p className="text-[15px] text-muted-foreground mt-4 max-w-xs">
                      Ya la dejamos armada y lista para vender. Mirá lo que hay hecho y, si algo no te cierra, lo cambiás acá mismo.
                    </p>
                    <AccionesDato onModificar={() => abrirEditor('intro')} primary="Ver mi tienda" />
                  </>
                )}
              </div>
            )}

            {/* ── Link público (editable) ── */}
            {card?.kind === 'link' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-400 flex flex-col items-center text-center">
                <Titulo>Tu link para compartir</Titulo>
                {editing === 'link' ? (
                  <div className="w-full mt-6">
                    <div className="flex items-center h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-900 px-4 focus-within:ring-2 focus-within:ring-[#FF7A00]/30 transition-shadow font-mono">
                      <span className="text-muted-foreground/60 text-base select-none">my.piru.app/</span>
                      <input
                        autoFocus
                        value={tmpText}
                        onChange={(e) => setTmpText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && guardarLink()}
                        placeholder="tulocal"
                        className="flex-1 bg-transparent border-0 outline-none text-base font-semibold text-[#FF7A00] min-w-0"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 text-left">
                      Quedará como <span className="font-mono">my.piru.app/{toSlug(tmpText) || 'tulocal'}</span>
                    </p>
                    <AccionesEditor onGuardar={guardarLink} disabled={toSlug(tmpText).length < 3} />
                  </div>
                ) : (
                  <>
                    <div className="mt-6 w-full rounded-2xl bg-zinc-100 dark:bg-zinc-900 px-4 py-4 text-base font-mono">
                      <span className="text-muted-foreground/60">my.piru.app/</span>
                      <span className="font-semibold text-[#FF7A00]">{dispUsername}</span>
                    </div>
                    <AccionesDato onModificar={() => abrirEditor('link')} />
                  </>
                )}
              </div>
            )}

            {/* ── Logo (editable) ── */}
            {card?.kind === 'logo' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-400 flex flex-col items-center text-center">
                <Titulo>Tu logo</Titulo>
                {editing === 'logo' ? (
                  <div className="w-full mt-6 flex flex-col items-center">
                    <label className="cursor-pointer">
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { elegirLogo(e.target.files); e.currentTarget.value = '' }} />
                      <div className="relative h-28 w-28 rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-900 ring-1 ring-border flex items-center justify-center group">
                        {tmpLogo ? <img src={tmpLogo} alt="Nuevo logo" className="h-full w-full object-cover" /> : <ImagePlus className="h-7 w-7 text-muted-foreground" />}
                        {subiendoLogo && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-white" /></div>}
                        <div className="absolute inset-x-0 bottom-0 bg-black/50 text-white text-[11px] py-1 opacity-0 group-hover:opacity-100 transition-opacity">Cambiar</div>
                      </div>
                    </label>
                    <p className="text-xs text-muted-foreground mt-3">Tocá la imagen para elegir otra · JPG o PNG</p>
                    <div className="w-full"><AccionesEditor onGuardar={guardarLogo} disabled={!tmpLogo || subiendoLogo} /></div>
                  </div>
                ) : (
                  <>
                    <div className="mt-6 h-28 w-28 rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-900 ring-1 ring-border flex items-center justify-center">
                      {dispLogo ? <img src={dispLogo} alt="Logo" className="h-full w-full object-cover" /> : <Store className="h-8 w-8 text-muted-foreground" />}
                    </div>
                    <p className="text-[15px] text-muted-foreground mt-4">Tu marca ya está puesta en la tienda.</p>
                    <AccionesDato onModificar={() => abrirEditor('logo')} />
                  </>
                )}
              </div>
            )}

            {/* ── Productos (solo ver) ── */}
            {card?.kind === 'productos' && config && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-400 flex flex-col items-center text-center">
                <Titulo>Tu menú ya está cargado</Titulo>
                <p className="text-[15px] text-muted-foreground mt-3">
                  {config.productos.length} {config.productos.length === 1 ? 'producto listo' : 'productos listos'} para vender.
                </p>
                <div className="mt-6 w-full max-h-[55vh] overflow-y-auto space-y-3 pr-0.5">
                  {config.productos.map((p) => (
                    <ProductoCard key={p.id} p={p} />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">Los editás en detalle cuando entres a tu panel.</p>
                <button
                  onClick={continuar}
                  className="w-full h-14 mt-6 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white active:scale-[0.985] transition-all"
                >
                  Continuar
                </button>
              </div>
            )}

            {/* ── Métodos de pago (editable) ── */}
            {card?.kind === 'pagos' && config && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-400 flex flex-col items-center text-center">
                <Titulo>Cómo te pagan</Titulo>
                {editing === 'pagos' ? (
                  <div className="w-full mt-6 space-y-2.5 text-left">
                    <ToggleRow
                      icon={Wallet}
                      label="Efectivo"
                      checked={tmpPagos.efectivo}
                      onToggle={() => setTmpPagos((p) => ({ ...p, efectivo: !p.efectivo }))}
                    />
                    <ToggleRow
                      icon={Banknote}
                      label="Transferencia manual"
                      checked={tmpPagos.transferenciaManual}
                      onToggle={() => setTmpPagos((p) => ({ ...p, transferenciaManual: !p.transferenciaManual }))}
                    />
                    {tmpPagos.transferenciaManual && (
                      <input
                        autoFocus
                        value={tmpPagos.transferenciaAlias}
                        onChange={(e) => setTmpPagos((p) => ({ ...p, transferenciaAlias: e.target.value }))}
                        placeholder="Tu alias o CBU"
                        className="w-full h-12 rounded-xl bg-zinc-100 dark:bg-zinc-900 border-0 px-4 text-sm outline-none focus:ring-2 focus:ring-[#FF7A00]/30 transition-shadow"
                      />
                    )}
                    {(config.pagos.autoTransferAvailable || config.pagos.mpConnected) && (
                      <p className="text-xs text-muted-foreground px-1 pt-1">
                        {config.pagos.mpConnected && 'MercadoPago'}
                        {config.pagos.mpConnected && config.pagos.autoTransferAvailable && ' y '}
                        {config.pagos.autoTransferAvailable && 'la transferencia automática'}
                        {' '}ya {config.pagos.mpConnected && config.pagos.autoTransferAvailable ? 'están' : 'está'} activo. Se gestiona desde el panel.
                      </p>
                    )}
                    <AccionesEditor onGuardar={guardarPagos} />
                  </div>
                ) : (
                  <>
                    <div className="mt-6 w-full rounded-2xl bg-zinc-100 dark:bg-zinc-900 p-2 space-y-1.5 text-left">
                      <MetodoLinea icon={Wallet} label="Efectivo" on={pagosView.efectivo} />
                      <MetodoLinea
                        icon={Banknote}
                        label={pagosView.transferenciaManual && pagosView.transferenciaAlias ? `Transferencia · ${pagosView.transferenciaAlias}` : 'Transferencia manual'}
                        on={pagosView.transferenciaManual}
                        attention={pagosView.transferenciaManual && !pagosView.transferenciaAlias ? 'Falta tu alias — tocá Modificar' : undefined}
                      />
                      {config.pagos.autoTransferAvailable && <MetodoLinea icon={Banknote} label="Transferencia automática" on />}
                      {config.pagos.mpConnected && <MetodoLinea icon={CreditCard} label="MercadoPago" on />}
                    </div>
                    <AccionesDato onModificar={() => abrirEditor('pagos')} />
                  </>
                )}
              </div>
            )}

            {/* ── Delivery (editable: radio o zonas + precio) ── */}
            {card?.kind === 'delivery' && config && (() => {
              const configurado = !!draft.delivery || config.delivery.zonas.length > 0
              return (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-400 flex flex-col items-center text-center">
                  {editing === 'delivery' ? (
                    <>
                      <h1 className="text-[1.9rem] leading-[1.12] font-semibold tracking-tight">Tu delivery</h1>
                      <DeliveryEditor initial={draft.delivery} onGuardar={guardarDelivery} onCancelar={cancelarEditor} />
                    </>
                  ) : configurado ? (
                    <>
                      <Titulo>Tu delivery</Titulo>
                      <DeliveryResumen draft={draft.delivery} zonas={config.delivery.zonas} center={mapCenter} />
                      <AccionesDato onModificar={() => abrirEditor('delivery')} />
                    </>
                  ) : (
                    // Nada configurado todavía: invitamos a configurar, sin decir "ya está listo".
                    <>
                      <div className="h-14 w-14 rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
                        <MapPin className="h-6 w-6 text-[#FF7A00]" strokeWidth={2} />
                      </div>
                      <h1 className="text-[1.9rem] leading-[1.12] font-semibold tracking-tight mt-5">Sumá tu delivery</h1>
                      <p className="text-[15px] text-muted-foreground mt-3 max-w-xs">
                        Todavía no tenés zonas de reparto. Definí desde dónde entregás y hasta dónde llegás.
                      </p>
                      <button
                        onClick={() => abrirEditor('delivery')}
                        className="w-full h-14 mt-7 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white active:scale-[0.985] transition-all"
                      >
                        Configurar delivery
                      </button>
                      <button
                        onClick={continuar}
                        className="w-full h-11 mt-2.5 rounded-2xl text-[14px] font-medium text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                      >
                        Ahora no
                      </button>
                    </>
                  )}
                </div>
              )
            })()}

            {/* ── Confirmación de datos agregados (backend viejo sin config) ── */}
            {card?.kind === 'reassure' && (
              <div key={card.id} className="animate-in fade-in slide-in-from-bottom-2 duration-400 flex flex-col items-center text-center">
                <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center ring-1 ring-emerald-500/15">
                  <card.icon className="h-6 w-6 text-emerald-600 dark:text-emerald-400" strokeWidth={2} />
                </div>
                <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3.5 w-3.5" /> Ya está listo
                </span>
                <h1 className="text-[1.9rem] leading-[1.12] font-semibold tracking-tight mt-2">{card.titulo}</h1>
                <div className="mt-6 w-full rounded-2xl bg-zinc-100 dark:bg-zinc-900 px-4 py-4 text-base font-medium text-foreground">{card.valor}</div>
                <p className="text-xs text-muted-foreground mt-3">Lo afinás en detalle cuando entres a tu panel.</p>
                <button onClick={continuar} className="w-full h-14 mt-7 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white active:scale-[0.985] transition-all">Continuar</button>
              </div>
            )}

            {/* ── Verificación del WhatsApp ── */}
            {card?.kind === 'verificar' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-400">
                <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-tight">Reclamá tu tienda</h1>
                <p className="text-[15px] text-muted-foreground mt-3">
                  Poné tu WhatsApp: te mandamos un código y la tienda queda a tu nombre
                  {Object.keys(draft).length > 0 ? ', con tus cambios aplicados.' : '.'}
                </p>

                <form onSubmit={(e) => { e.preventDefault(); iniciarReclamo() }} className="mt-7">
                  <p className="mb-2 text-sm font-medium text-foreground">¿A qué WhatsApp te mandamos el código?</p>
                  <label htmlFor="claim-telefono" className="group flex items-center gap-3 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-900 px-4 transition-colors focus-within:bg-zinc-200/70 dark:focus-within:bg-zinc-800 focus-within:ring-2 focus-within:ring-[#FF7A00]/30">
                    <span className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500 select-none">
                      <MessageCircle className="h-4 w-4 shrink-0" />
                      <span className="text-base">+54</span>
                      <span className="h-5 w-px bg-zinc-300 dark:bg-zinc-700" />
                    </span>
                    <input
                      id="claim-telefono"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      autoFocus
                      placeholder="9 351 123 4567"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      className="flex-1 bg-transparent border-0 outline-none text-base placeholder:text-zinc-400 dark:placeholder:text-zinc-600 w-full min-w-0"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={enviando || telefono.replace(/\D/g, '').length < 8}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl h-14 bg-[#FF7A00] hover:bg-[#E66E00] text-white text-[15px] font-semibold transition-all active:scale-[0.985] disabled:opacity-40"
                  >
                    {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reclamar mi tienda'}
                  </button>
                </form>

                <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <MessageCircle className="h-3.5 w-3.5" />
                  Te mandamos un código por WhatsApp para verificar el número.
                </p>
              </div>
            )}
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
                {telefonoEnmascarado ? (<>{' '}al <span className="font-medium text-foreground">{telefonoEnmascarado}</span></>) : null}
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
              {verificando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar y reclamar'}
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
          // ── Ante último paso: pedido de prueba en su propia tienda ──
          <div className="text-center flex flex-col items-center animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/15 flex items-center justify-center">
              <ShoppingBag className="h-7 w-7 text-emerald-600 dark:text-emerald-400" strokeWidth={2} />
            </div>
            <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-tight mt-6">Probala como un cliente</h1>
            <p className="text-[15px] text-muted-foreground mt-3 max-w-xs">
              Entrá a tu tienda, armá un pedido y mandalo. Vas a ver cómo te llega el pedido al panel, tal cual lo verá tu cliente.
            </p>

            <a
              href={`${STORE_BASE}/${dispUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-14 mt-8 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white active:scale-[0.985] transition-all flex items-center justify-center gap-2"
            >
              <ShoppingBag className="h-4 w-4" /> Hacer mi primer pedido de prueba
            </a>
            <button
              onClick={() => { setPaso('plan'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
              className="w-full h-11 mt-2.5 rounded-2xl text-[14px] font-medium text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
            >
              Ya lo hice, seguir
            </button>
          </div>
        ) : (
          // ── Último paso: info del período de prueba, precio del plan y qué incluye ──
          (() => {
            const codigoPlan = miSusc?.planCodigo ?? 'basico'
            const info = PLAN_INFO[codigoPlan] ?? PLAN_INFO.basico
            const precio = miSusc?.precioMensual ? `$${fmtPrecio(miSusc.precioMensual)}` : info.precio
            const trialDias = miSusc?.trialFin
              ? Math.max(0, Math.ceil((new Date(miSusc.trialFin).getTime() - Date.now()) / 86_400_000))
              : null
            return (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="text-center flex flex-col items-center">
                  <div className="h-16 w-16 rounded-2xl bg-[#FF7A00]/10 ring-1 ring-[#FF7A00]/15 flex items-center justify-center">
                    <Rocket className="h-7 w-7 text-[#FF7A00]" strokeWidth={2} />
                  </div>
                  <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-tight mt-6">
                    {trialDias != null ? `Tenés ${trialDias} días de prueba gratis` : 'Empezás con tu prueba gratis'}
                  </h1>
                  <p className="text-[15px] text-muted-foreground mt-3 max-w-xs">
                    Usá todo el sistema sin pagar nada. {trialDias != null ? 'Cuando termine' : 'Cuando termine la prueba'}, tu plan {info.nombre} sale {precio} por mes.
                  </p>
                </div>

                {/* Plan y precio */}
                <div className="mt-6 rounded-2xl bg-zinc-100 dark:bg-zinc-900 p-5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold text-muted-foreground">Plan {info.nombre}</span>
                    <span className="text-[1.6rem] font-semibold tracking-tight tabular-nums">
                      {precio}<span className="text-sm font-medium text-muted-foreground">/mes</span>
                    </span>
                  </div>
                  <p className="text-[13.5px] text-muted-foreground mt-1.5">{info.desc}</p>
                  <div className="h-px bg-black/[0.06] dark:bg-white/[0.08] my-4" />
                  <ul className="space-y-2.5">
                    {info.incluye.map((f, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[13.5px]">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#FF7A00]/15">
                          <Check className="h-3 w-3 text-[#FF7A00]" />
                        </span>
                        <span className="text-foreground/90">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground mt-4">Cuota fija · sin comisión por venta.</p>
                </div>

                {/* Ajustes */}
                <div className="mt-4 flex items-start gap-3 rounded-2xl bg-zinc-100 dark:bg-zinc-900 p-4">
                  <div className="h-9 w-9 rounded-xl bg-white dark:bg-zinc-800 flex items-center justify-center shrink-0">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-[13.5px] text-muted-foreground leading-relaxed">
                    Todo lo demás lo configurás desde el ícono de <span className="font-semibold text-foreground">Ajustes</span> en tu panel: horarios, sucursales, facturación y más.
                  </p>
                </div>

                <button
                  onClick={() => navigate('/dashboard', { replace: true })}
                  className="w-full h-14 mt-6 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white active:scale-[0.985] transition-all flex items-center justify-center gap-2"
                >
                  Empezar la prueba gratis <ArrowRight className="h-4 w-4" />
                </button>

                {/* Opcional: pagar la cuota ahora y saltear la espera (sin perder los días de prueba). */}
                <button
                  onClick={pagarPlanAhora}
                  disabled={pagandoPlan}
                  className="w-full h-11 mt-2.5 rounded-2xl text-[14px] font-medium text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {pagandoPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : `Pagar ${precio}/mes ahora`}
                </button>
              </div>
            )
          })()
        )}
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

// ── Tarjeta de producto (solo lectura), con el mismo formato que la revisión de carta del
//    onboarding self-serve (ProductoRevisionCard): nombre, precio, descripción, variantes,
//    ingredientes y extras. ──
function ProductoCard({ p }: { p: ClaimConfig['productos'][number] }) {
  const variantes = p.variantes ?? []
  const ingredientes = p.ingredientes ?? []
  const extras = p.extras ?? []
  const tieneVariantes = variantes.length > 0
  const hr = <div className="h-px bg-black/[0.06] dark:bg-white/[0.08] my-4" />

  return (
    <div className="rounded-2xl bg-zinc-100 dark:bg-zinc-900 px-5 py-5 text-center">
      <h3 className="text-[21px] font-semibold leading-tight tracking-tight px-6">{p.nombre}</h3>

      {!tieneVariantes && (
        <p className="mt-2 text-[17px] font-semibold tabular-nums tracking-tight text-[#FF7A00]">${fmtPrecio(p.precio)}</p>
      )}

      {p.descripcion && (
        <p className="text-[13.5px] text-muted-foreground mt-2 leading-relaxed max-w-[44ch] mx-auto">{p.descripcion}</p>
      )}

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

// ── Línea de resumen (lectura) de un método de pago ──
function MetodoLinea({ icon: Icon, label, on, attention }: { icon: LucideIcon; label: string; on: boolean; attention?: string }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl px-3 min-h-11 py-1.5 ${on ? '' : 'opacity-40'}`}>
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 text-left min-w-0">
        <span className="block text-sm font-medium truncate">{label}</span>
        {on && attention && <span className="block text-[11px] text-amber-600 dark:text-amber-400">{attention}</span>}
      </div>
      {on ? (
        attention ? <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" /> : <Check className="h-4 w-4 text-emerald-500 shrink-0" />
      ) : (
        <X className="h-4 w-4 text-muted-foreground shrink-0" />
      )}
    </div>
  )
}

// ── Resumen (lectura) del delivery: mapa con las zonas + precios ──
function DeliveryResumen({ draft, zonas, center }: { draft?: DeliveryDraft; zonas: ClaimConfig['delivery']['zonas']; center: [number, number] }) {
  // Si hay borrador, mostramos lo que quedó configurado; si no, las zonas actuales del backend.
  const poligonos: { poligono: { lat: number; lng: number }[]; color: string; nombre: string; precio: string }[] = draft
    ? draft.mode === 'radio'
      ? [{ poligono: circleToPolygon(draft.center, draft.radius), color: '#FF7A00', nombre: 'Radio de reparto', precio: draft.precio }]
      : draft.zonas.map((z) => ({ poligono: z.poligono, color: z.color, nombre: z.nombre, precio: z.precio }))
    : zonas.map((z) => ({ poligono: z.poligono, color: z.color || '#3b82f6', nombre: z.nombre, precio: z.precio }))

  return (
    <div className="w-full mt-6">
      <div className="rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 h-52">
        <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false} dragging={false} zoomControl={false} attributionControl={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapResizer />
          <FitBounds poligonos={poligonos.map((p) => p.poligono)} />
          {poligonos.map((p, i) => (
            <Polygon key={i} positions={p.poligono.map((c) => [c.lat, c.lng] as [number, number])} pathOptions={{ color: p.color, fillColor: p.color, fillOpacity: 0.2, weight: 2 }} />
          ))}
        </MapContainer>
      </div>
      <div className="mt-3 space-y-1.5">
        {poligonos.map((p, i) => (
          <div key={i} className="flex items-center gap-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 px-3.5 h-11">
            <span className="h-3 w-3 rounded-full shrink-0" style={{ background: p.color }} />
            <span className="flex-1 text-left text-sm font-medium truncate">{p.nombre}</span>
            <span className="text-sm font-semibold tabular-nums shrink-0">${fmtPrecio(p.precio)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Editor de delivery: primero pide la dirección; con una dirección geolocalizada muestra el
//    mapa centrado en el local para elegir un radio o dibujar zonas, con precio. ──
function DeliveryEditor({ initial, onGuardar, onCancelar }: {
  initial?: DeliveryDraft
  onGuardar: (d: DeliveryDraft) => void
  onCancelar: () => void
}) {
  // Dirección del local (paso 1): sin ubicación geolocalizada no mostramos el mapa. Si venimos a
  // re-editar un borrador ya cargado, arrancamos con su dirección/ubicación y su configuración.
  const [address, setAddress] = useState(initial?.address ?? '')
  const [lat, setLat] = useState<number | null>(initial?.center.lat ?? null)
  const [lng, setLng] = useState<number | null>(initial?.center.lng ?? null)
  const tieneUbicacion = lat != null && lng != null
  // Memoizado por lat/lng: identidad estable para que RecenterMap no resetee el zoom en cada render.
  const center = useMemo<[number, number]>(() => [lat ?? DEFAULT_CENTER[0], lng ?? DEFAULT_CENTER[1]], [lat, lng])
  const centerObj = { lat: center[0], lng: center[1] }

  const [mode, setMode] = useState<'radio' | 'zonas'>(initial?.mode ?? 'radio')
  // Radio
  const [radius, setRadius] = useState(initial?.mode === 'radio' ? initial.radius : 2500)
  const [precioRadio, setPrecioRadio] = useState(initial?.mode === 'radio' ? initial.precio : '0')
  // Zonas dibujadas
  const [zonas, setZonas] = useState<ZonaDraft[]>(initial?.mode === 'zonas' ? initial.zonas : [])
  const [pending, setPending] = useState<{ lat: number; lng: number }[] | null>(null)
  const [nombre, setNombre] = useState('')
  const [precioZona, setPrecioZona] = useState('')
  const [color, setColor] = useState('#FF7A00')

  const onPolygonCreated = useCallback((coords: { lat: number; lng: number }[]) => {
    setColor(getNextColor(zonas.map((z) => z.color)))
    setNombre('')
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
    if (!tieneUbicacion) return toast.error('Elegí tu dirección de la lista')
    if (mode === 'radio') {
      onGuardar({ mode: 'radio', precio: precioRadio || '0', radius, center: centerObj, address })
    } else {
      if (zonas.length === 0) return toast.error('Dibujá al menos una zona')
      onGuardar({ mode: 'zonas', zonas, center: centerObj, address })
    }
  }

  return (
    <div className="w-full mt-6 text-left">
      {/* Paso 1 — dirección del local */}
      <p className="text-sm font-medium text-foreground mb-2">¿Desde dónde entregás?</p>
      <AddressAutocomplete
        value={address}
        onChange={(a, la, ln) => { setAddress(a); setLat(la); setLng(ln) }}
        placeholder="Av. Corrientes 1234"
      />

      {!tieneUbicacion ? (
        <>
          <div className="mt-3 flex items-center gap-2.5 text-sm text-muted-foreground rounded-2xl bg-zinc-100 dark:bg-zinc-900 px-4 py-3.5">
            <MapPin className="h-4 w-4 text-[#FF7A00] shrink-0" />
            Elegí tu dirección de la lista para dibujar tu zona de reparto.
          </div>
          <button onClick={onCancelar} className="w-full h-11 mt-3 rounded-2xl text-[14px] font-medium text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
            Cancelar
          </button>
        </>
      ) : (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-400">
      {/* Selector de modo */}
      <div className="grid grid-cols-2 gap-2 mt-4 mb-3">
        <button
          type="button"
          onClick={() => setMode('radio')}
          className={`h-11 rounded-xl text-sm font-semibold transition-colors ${mode === 'radio' ? 'bg-[#FF7A00] text-white' : 'bg-zinc-100 dark:bg-zinc-900 text-muted-foreground'}`}
        >
          Un radio
        </button>
        <button
          type="button"
          onClick={() => setMode('zonas')}
          className={`h-11 rounded-xl text-sm font-semibold transition-colors ${mode === 'zonas' ? 'bg-[#FF7A00] text-white' : 'bg-zinc-100 dark:bg-zinc-900 text-muted-foreground'}`}
        >
          Zonas dibujadas
        </button>
      </div>

      <div className="rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 h-64 relative">
        <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
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
            <div className="mt-3 rounded-2xl bg-zinc-100 dark:bg-zinc-900 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: color }} /> Nueva zona</p>
                <button onClick={() => setPending(null)} className="h-7 w-7 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
              </div>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre (ej: Zona Centro)" className="w-full h-10 bg-white dark:bg-zinc-800 border-0 text-sm rounded-xl px-3 outline-none" />
              <div className="flex items-center rounded-xl bg-white dark:bg-zinc-800 px-4 h-10">
                <span className="text-muted-foreground text-sm">$</span>
                <input type="number" value={precioZona} onChange={(e) => setPrecioZona(e.target.value)} placeholder="Costo de envío" className="flex-1 bg-transparent outline-none text-sm px-1" />
              </div>
              <button onClick={agregarZona} className="w-full h-11 rounded-xl bg-[#FF7A00] hover:bg-[#E66E00] text-white font-semibold flex items-center justify-center gap-2"><Save className="h-4 w-4" /> Agregar zona</button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
              <PencilRuler className="h-3.5 w-3.5 shrink-0" /> Tocá el ícono del polígono arriba a la izquierda del mapa y marcá los límites de una zona.
            </p>
          )}

          {zonas.length > 0 && (
            <div className="mt-3 space-y-2">
              {zonas.map((z, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 px-3.5 h-12">
                  <span className="h-3 w-3 rounded-full shrink-0" style={{ background: z.color }} />
                  <span className="text-sm font-semibold flex-1 truncate">{z.nombre}</span>
                  <span className="text-sm font-semibold tabular-nums">${fmtPrecio(z.precio)}</span>
                  <button onClick={() => setZonas((prev) => prev.filter((_, k) => k !== i))} className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 shrink-0"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <button onClick={guardar} className="w-full h-14 mt-6 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white active:scale-[0.985] transition-all flex items-center justify-center gap-2">
        <Check className="h-4 w-4" /> Guardar delivery
      </button>
      <button onClick={onCancelar} className="w-full h-11 mt-2.5 rounded-2xl text-[14px] font-medium text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
        Cancelar
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
