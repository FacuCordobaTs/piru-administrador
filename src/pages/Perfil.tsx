import { useEffect, useState, lazy, Suspense, useRef } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { restauranteApi, mercadopagoApi, cucuruApi, authApi, ApiError } from '@/lib/api'
import ImageUpload from '@/components/ImageUpload'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  MapPin,
  Edit,
  LogOut,
  Store,
  Loader2,
  CreditCard,
  Link2,
  Unlink,
  ExternalLink,
  CheckCircle2,
  Printer,
  List,
  Wallet,
  Clock,
  Plus,
  Trash2,
  Truck,
  UtensilsCrossed,
  RefreshCw,
  Ticket,
  Zap,
  Globe,
  Copy,
  AlertCircle,
  Package,
  X,
  Lock,
} from 'lucide-react'
import FacturacionAfipSection from '@/components/FacturacionAfipSection'
import { usePrinter } from '@/context/PrinterContext'
import { commandsToBytes } from '@/utils/printerUtils'
import { PWAInstallButton } from '@/components/PWAInstallButton'

const ZonasDeliveryMap = lazy(() => import('@/components/ZonasDeliveryMap'))

// Configuración de MercadoPago
const MP_APP_ID = 38638191854826
const MP_REDIRECT_URI = import.meta.env.VITE_MP_REDIRECT_URI || 'https://api.piru.app/api/mp/callback'

// ─────────────────────────────────────────────
// Estilos base
// Superficie: sin bordes ni sombras pesadas. El contraste
// (blanco sobre zinc-50) separa; el espacio estructura.
// ─────────────────────────────────────────────
const phantomCardClass = ""
const phantomInputClass = "h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-transparent focus:ring-2 focus:ring-[#FF7A00]/30 transition-all text-base px-4 w-full"
const phantomLabelClass = "text-sm font-medium text-muted-foreground mb-2 block"

interface Sucursal {
  id: number
  nombre: string
  direccion: string | null
  whatsappEnabled: boolean
  whatsappNumber: string | null
  rapiboyToken: string | null
  activo: boolean
}

// ─────────────────────────────────────────────
// Small helper: row toggle for feature switches.
// Sin tile de color: ícono neutro, jerarquía por peso
// tipográfico, filas separadas por espacio (no por bordes).
// ─────────────────────────────────────────────
function ToggleRow({
  icon,
  title,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  icon?: React.ReactNode
  title: string
  description: string
  checked: boolean
  onCheckedChange: () => void
  disabled?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-6 py-3 cursor-pointer",
        disabled && "opacity-50 pointer-events-none"
      )}
      onClick={() => !disabled && onCheckedChange()}
    >
      <div className="flex items-start gap-3 min-w-0">
        {icon && <div className="shrink-0 mt-0.5 text-zinc-400 dark:text-zinc-500">{icon}</div>}
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} onClick={(e) => e.stopPropagation()} />
    </div>
  )
}

// ─────────────────────────────────────────────
// Integration Status Card wrapper.
// Sin borde de color para categorizar: superficie neutra.
// El estado (conectado/no) se comunica adentro, con texto.
// ─────────────────────────────────────────────
function IntegrationCard({
  children,
}: {
  connected?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      {children}
    </div>
  )
}

const SECTIONS = [
  { id: 'general', label: 'General', Icon: Store },
  { id: 'pagos', label: 'Pagos', Icon: CreditCard },
  { id: 'delivery', label: 'Delivery', Icon: Truck },
  { id: 'experiencia', label: 'Experiencia', Icon: UtensilsCrossed },
  { id: 'sucursales', label: 'Sucursales', Icon: MapPin },
  { id: 'facturacion', label: 'Facturación', Icon: Ticket },
  { id: 'hardware', label: 'Hardware', Icon: Printer },
]

const Perfil = () => {
  const navigate = useNavigate()
  const logout = useAuthStore((state) => state.logout)
  const token = useAuthStore((state) => state.token)
  const restauranteStore = useRestauranteStore()
  const { restaurante, isLoading } = restauranteStore

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    nombre: '',
    direccion: '',
    telefono: '',
    username: '',
    deliveryFee: '',
    whatsappEnabled: false,
    whatsappNumber: '',
    comprobantesWhatsapp: '',
    transferenciaAlias: '',
    colorPrimario: '',
    colorSecundario: '',
  })
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [imageLightBase64, setImageLightBase64] = useState<string | null>(null)
  const [direccionTexto, setDireccionTexto] = useState<string>('')
  const [direccionLat, setDireccionLat] = useState<number | null>(null)
  const [direccionLng, setDireccionLng] = useState<number | null>(null)
  const direccionInputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<any>(null)
  const formInitializedRef = useRef(false)

  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [sucursalesLoaded, setSucursalesLoaded] = useState(false)
  const [sucursalDialogOpen, setSucursalDialogOpen] = useState(false)
  const [editingSucursal, setEditingSucursal] = useState<Sucursal | null>(null)
  const [isSavingSucursal, setIsSavingSucursal] = useState(false)
  const [sucursalForm, setSucursalForm] = useState({
    nombre: '',
    direccion: '',
    whatsappEnabled: false,
    whatsappNumber: '',
    rapiboyToken: '',
    activo: true,
  })

  // Estados de carga
  const [isDisconnectingMP, setIsDisconnectingMP] = useState(false)
  const [isTogglingDisenoAlternativo, setIsTogglingDisenoAlternativo] = useState(false)
  const [isTogglingOrderGroupEnabled, setIsTogglingOrderGroupEnabled] = useState(false)
  const [isTogglingCodigoDescuentoEnabled, setIsTogglingCodigoDescuentoEnabled] = useState(false)
  const [isTogglingNotificarClientesWhatsapp, setIsTogglingNotificarClientesWhatsapp] = useState(false)
  const [isTogglingModoConfirmacionManual, setIsTogglingModoConfirmacionManual] = useState(false)
  const [isTogglingDeliveryEnabled, setIsTogglingDeliveryEnabled] = useState(false)
  const [isTogglingTakeawayEnabled, setIsTogglingTakeawayEnabled] = useState(false)
  const [isTogglingPermitirPedidosProgramados, setIsTogglingPermitirPedidosProgramados] = useState(false)
  const [isTogglingUsarFranjasHorario, setIsTogglingUsarFranjasHorario] = useState(false)

  type FranjaHorario = { id: number; nombre: string; horaInicio: string; horaFin: string; activo: boolean }
  const [franjas, setFranjas] = useState<FranjaHorario[]>([])
  const [franjasLoaded, setFranjasLoaded] = useState(false)
  const [franjaDialogOpen, setFranjaDialogOpen] = useState(false)
  const [editingFranja, setEditingFranja] = useState<FranjaHorario | null>(null)
  const [franjaForm, setFranjaForm] = useState({ nombre: '', horaInicio: '09:00', horaFin: '18:00', activo: true })
  const [isSavingFranja, setIsSavingFranja] = useState(false)
  const [isConfiguringCucuru, setIsConfiguringCucuru] = useState(false)
  const [isReenviandoWebhookCucuru, setIsReenviandoWebhookCucuru] = useState(false)
  const [cucuruApiKey, setCucuruApiKey] = useState('')
  const [cucuruCollectorId, setCucuruCollectorId] = useState('')
  const [isConfiguringTalo, setIsConfiguringTalo] = useState(false)
  const [taloClientId, setTaloClientId] = useState('')
  const [taloClientSecret, setTaloClientSecret] = useState('')
  const [taloUserId, setTaloUserId] = useState('')
  const [cfgMpCheckout, setCfgMpCheckout] = useState(true)
  const [cfgMpBricks, setCfgMpBricks] = useState(false)
  const [cfgTfAuto, setCfgTfAuto] = useState(false)
  const [cfgTfManual, setCfgTfManual] = useState(false)
  const [cfgEfectivo, setCfgEfectivo] = useState(true)
  const [cfgAlias, setCfgAlias] = useState('')
  const [proveedorTransferencia, setProveedorTransferencia] = useState<'cucuru' | 'talo'>('cucuru')
  const [isSavingMetodosPago, setIsSavingMetodosPago] = useState(false)

  // Cambiar contraseña
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [changePasswordForm, setChangePasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // WhatsApp OAuth state
  const [waStatus, setWaStatus] = useState<{
    conectado: boolean
    phoneNumber: string | null
    tokenVencido: boolean
  } | null>(null)
  const [waLoading, setWaLoading] = useState(false)

  // Tauri Printer State
  const { printers, selectedPrinter, setSelectedPrinter, refreshPrinters, printRaw } = usePrinter()
  const [isListingPrinters, setIsListingPrinters] = useState(false)
  const [isPrintingTest, setIsPrintingTest] = useState(false)
  const [activeSection, setActiveSection] = useState<string | null>(null)

  // Horarios state
  const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  type Turno = { horaApertura: string; horaCierre: string }
  type HorariosDia = Record<number, Turno[]>

  const [horarios, setHorarios] = useState<HorariosDia>({})
  const [isSavingHorarios, setIsSavingHorarios] = useState(false)
  const [horariosLoaded, setHorariosLoaded] = useState(false)

  useEffect(() => {
    const cargarHorarios = async () => {
      if (!token) return
      try {
        const response = (await restauranteApi.getHorarios(token)) as {
          success: boolean
          horarios?: Array<{
            id: number
            diaSemana: number
            horaApertura: string
            horaCierre: string
          }>
        }
        if (response.success && response.horarios) {
          const agrupado: HorariosDia = {}
          for (const h of response.horarios) {
            if (!agrupado[h.diaSemana]) agrupado[h.diaSemana] = []
            agrupado[h.diaSemana].push({
              horaApertura: h.horaApertura,
              horaCierre: h.horaCierre,
            })
          }
          setHorarios(agrupado)
        }
      } catch (error) {
        console.error('Error cargando horarios:', error)
      } finally {
        setHorariosLoaded(true)
      }
    }
    cargarHorarios()
  }, [token])

  useEffect(() => {
    if (sucursalesLoaded) return
    const fetchSucursales = async () => {
      if (!token) return
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/sucursales/list`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (data.success && Array.isArray(data.data)) setSucursales(data.data)
      } catch {
        toast.error('Error al cargar sucursales')
      } finally {
        setSucursalesLoaded(true)
      }
    }
    void fetchSucursales()
  }, [sucursalesLoaded, token])

  const agregarTurno = (dia: number) => {
    setHorarios((prev) => ({
      ...prev,
      [dia]: [...(prev[dia] || []), { horaApertura: '09:00', horaCierre: '18:00' }],
    }))
  }

  const eliminarTurno = (dia: number, idx: number) => {
    setHorarios((prev) => {
      const turnos = [...(prev[dia] || [])]
      turnos.splice(idx, 1)
      const next = { ...prev }
      if (turnos.length === 0) {
        delete next[dia]
      } else {
        next[dia] = turnos
      }
      return next
    })
  }

  const actualizarTurno = (
    dia: number,
    idx: number,
    campo: 'horaApertura' | 'horaCierre',
    valor: string
  ) => {
    setHorarios((prev) => {
      const turnos = [...(prev[dia] || [])]
      turnos[idx] = { ...turnos[idx], [campo]: valor }
      return { ...prev, [dia]: turnos }
    })
  }

  const guardarHorarios = async () => {
    if (!token) return
    setIsSavingHorarios(true)
    try {
      const flat: Array<{ diaSemana: number; horaApertura: string; horaCierre: string }> = []
      for (const [dia, turnos] of Object.entries(horarios)) {
        for (const t of turnos) {
          flat.push({
            diaSemana: parseInt(dia),
            horaApertura: t.horaApertura,
            horaCierre: t.horaCierre,
          })
        }
      }
      const response = (await restauranteApi.updateHorarios(token, flat)) as { success: boolean }
      if (response.success) {
        toast.success('Horarios actualizados correctamente')
      }
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error('Error al guardar horarios', { description: error.message })
      } else {
        toast.error('Error de conexión')
      }
    } finally {
      setIsSavingHorarios(false)
    }
  }

  useEffect(() => {
    if (!restaurante) {
      restauranteStore.fetchData()
    }
  }, [])

  // Load Google Maps Places script for address autocomplete
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    if (!apiKey || (window as any).google?.maps?.places) return
    if (document.querySelector('script[data-gmaps]')) return
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    script.async = true
    script.defer = true
    script.dataset.gmaps = '1'
    document.head.appendChild(script)
  }, [])

  // Initialize address autocomplete once the input is rendered
  useEffect(() => {
    const init = () => {
      if (!direccionInputRef.current || !(window as any).google?.maps?.places) return
      if (autocompleteRef.current) return
      const ac = new (window as any).google.maps.places.Autocomplete(direccionInputRef.current, {
        componentRestrictions: { country: 'ar' },
        fields: ['formatted_address', 'geometry'],
        types: ['address'],
      })
      ac.addListener('place_changed', () => {
        const place = ac.getPlace()
        if (place?.geometry?.location) {
          setDireccionTexto(place.formatted_address || '')
          setDireccionLat(place.geometry.location.lat())
          setDireccionLng(place.geometry.location.lng())
        }
      })
      autocompleteRef.current = ac
    }

    if ((window as any).google?.maps?.places) {
      init()
    } else {
      const interval = setInterval(() => {
        if ((window as any).google?.maps?.places) {
          clearInterval(interval)
          init()
        }
      }, 200)
      return () => clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (!restaurante) return
    const r = restaurante as any
    const c = r.metodosPagoConfig || {}
    const mpOk = !!r.mpConnected
    const taloCred = !!(r.taloClientId && r.taloClientSecret && r.taloUserId)
    const autoTf = !!(r.cucuruConfigurado || taloCred)
    setCfgMpCheckout(c.mercadopagoCheckout ?? (mpOk && r.cardsPaymentsEnabled !== false))
    setCfgMpBricks(c.mercadopagoBricks ?? false)
    setCfgTfAuto(c.transferenciaAutomatica ?? autoTf)
    setCfgTfManual(c.transferenciaManual ?? (!autoTf && !!(r.transferenciaAlias && String(r.transferenciaAlias).trim())))
    setCfgEfectivo(c.efectivo ?? true)
    setCfgAlias(r.transferenciaAlias || '')
    if (r.proveedorPago === 'talo') setProveedorTransferencia('talo')
    else if (r.proveedorPago === 'cucuru') setProveedorTransferencia('cucuru')
    else if (taloCred && !r.cucuruConfigurado) setProveedorTransferencia('talo')
    else setProveedorTransferencia('cucuru')
    if (r.taloClientId) setTaloClientId(r.taloClientId)
    if (r.taloClientSecret) setTaloClientSecret(r.taloClientSecret)
    if (r.taloUserId) setTaloUserId(r.taloUserId)
  }, [restaurante])

  // Populate inline form once when restaurante first loads
  useEffect(() => {
    if (!restaurante || formInitializedRef.current) return
    formInitializedRef.current = true
    setFormData({
      nombre: restaurante.nombre || '',
      direccion: restaurante.direccion || '',
      telefono: restaurante.telefono || '',
      username: restaurante.username || '',
      deliveryFee: restaurante.deliveryFee || '',
      whatsappEnabled: restaurante.whatsappEnabled || false,
      whatsappNumber: restaurante.whatsappNumber || '',
      comprobantesWhatsapp: restaurante.comprobantesWhatsapp || '',
      transferenciaAlias: restaurante.transferenciaAlias || '',
      colorPrimario: restaurante.colorPrimario || '',
      colorSecundario: restaurante.colorSecundario || '',
    })
    setImageBase64(restaurante.imagenUrl || null)
    setImageLightBase64(restaurante.imagenLightUrl || null)
    setDireccionTexto((restaurante as any).direccionTexto || '')
    setDireccionLat((restaurante as any).direccionLat ? parseFloat((restaurante as any).direccionLat) : null)
    setDireccionLng((restaurante as any).direccionLng ? parseFloat((restaurante as any).direccionLng) : null)
  }, [restaurante])

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const mpStatus = urlParams.get('mp_status')
    const mpError = urlParams.get('mp_error')

    if (mpStatus === 'success') {
      toast.success('¡MercadoPago conectado!', {
        description: 'Ahora tus clientes pueden pagar con MercadoPago',
      })
      restauranteStore.fetchData()
      window.history.replaceState({}, '', window.location.pathname)
    } else if (mpStatus === 'error') {
      let errorMessage = 'No se pudo conectar con MercadoPago'
      if (mpError === 'missing_params') errorMessage = 'Faltan parámetros de autorización'
      else if (mpError === 'config_error') errorMessage = 'Error de configuración del servidor'
      else if (mpError === 'oauth_failed') errorMessage = 'Error en la autenticación con MercadoPago'

      toast.error('Error al conectar MercadoPago', { description: errorMessage })
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const waApiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

  useEffect(() => {
    if (!token) return
    fetch(`${waApiBase}/whatsapp-oauth/status`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (data.success) setWaStatus(data) })
      .catch(() => {})
  }, [token])

  const intercambiarCodeWhatsApp = async (code: string) => {
    if (!token) return
    setWaLoading(true)
    try {
      const res = await fetch(`${waApiBase}/whatsapp-oauth/connect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (data.success) {
        setWaStatus({ conectado: true, phoneNumber: data.phoneNumber, tokenVencido: false })
        toast.success(`WhatsApp conectado: ${data.phoneNumber}`)
      } else {
        toast.error(data.message || 'Error al conectar WhatsApp')
      }
    } catch {
      toast.error('Error al conectar WhatsApp')
    } finally {
      setWaLoading(false)
    }
  }

  // Captura el ?code= cuando Meta redirige de vuelta tras el OAuth de WhatsApp.
  // Usamos el flujo de redirect clásico (no el popup del SDK) porque el SDK ata
  // el code a un redirect_uri dinámico (xd_arbiter) imposible de reproducir en el
  // backend, lo que provoca OAuthException subcode 36008 al canjear el code.
  useEffect(() => {
    if (!token) return
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    const state = urlParams.get('state')
    if (code && state === 'whatsapp') {
      window.history.replaceState({}, '', window.location.pathname)
      void intercambiarCodeWhatsApp(code)
    }
  }, [token])

  const conectarWhatsApp = () => {
    // redirect_uri debe ser EXACTAMENTE el registrado en "URI de redireccionamiento
    // de OAuth válidos" de la app de Meta (modo estricto activado).
    const redirectUri = 'https://admin.piru.app/dashboard/perfil'
    const url =
      `https://www.facebook.com/v22.0/dialog/oauth?` +
      `client_id=939939975659282` +
      `&config_id=2543954492702386` +
      `&response_type=code` +
      `&override_default_response_type=true` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=whatsapp`
    window.location.href = url
  }

  const desconectarWhatsApp = async () => {
    if (!confirm('¿Desconectar el número de WhatsApp?')) return
    await fetch(`${waApiBase}/whatsapp-oauth/disconnect`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    setWaStatus({ conectado: false, phoneNumber: null, tokenVencido: false })
    toast.success('WhatsApp desconectado')
  }

  const handleListPrinters = async () => {
    setIsListingPrinters(true)
    try {
      await refreshPrinters()
      if (printers.length > 0) {
        toast.success(`Se encontraron ${printers.length} impresoras`)
      } else {
        toast.info('No se encontraron impresoras')
      }
    } finally {
      setIsListingPrinters(false)
    }
  }

  const handleTestPrint = async () => {
    if (!selectedPrinter) {
      toast.error('Selecciona una impresora predeterminada primero')
      return
    }
    setIsPrintingTest(true)
    try {
      const data = [
        '\x1B\x40',
        '\x1B\x61\x01',
        '\x1B\x45\x01',
        'PRUEBA DE COMANDA\n',
        '\x1B\x45\x00',
        '\x1B\x61\x00',
        '--------------------------------\n',
        'Hamburguesa x1\n',
        '  SIN: Cebolla\n',
        'Papas Fritas x1\n',
        '--------------------------------\n',
        '\n\n\n',
        '\x1D\x56\x41',
      ]
      await printRaw(commandsToBytes(data))
    } finally {
      setIsPrintingTest(false)
    }
  }

  const getMercadoPagoAuthUrl = () => {
    if (!MP_APP_ID || !restaurante?.id) return null
    const state = restaurante.id.toString()
    return `https://auth.mercadopago.com.ar/authorization?client_id=${MP_APP_ID}&response_type=code&platform_id=mp&state=${state}&redirect_uri=${encodeURIComponent(MP_REDIRECT_URI)}`
  }

  const handleDesconectarMP = async () => {
    if (!token) return
    setIsDisconnectingMP(true)
    try {
      const response = (await mercadopagoApi.desconectar(token)) as { success: boolean }
      if (response.success) {
        toast.success('MercadoPago desconectado')
        restauranteStore.fetchData()
      }
    } catch (error) {
      toast.error('Error al desconectar MercadoPago')
    } finally {
      setIsDisconnectingMP(false)
    }
  }

  const handleLogout = () => {
    logout()
    restauranteStore.reset()
    toast.success('Sesión cerrada exitosamente')
    navigate('/login')
  }

  const handleChangePassword = async () => {
    if (!token) return
    if (!changePasswordForm.currentPassword || !changePasswordForm.newPassword) {
      toast.error('Completá todos los campos')
      return
    }
    if (changePasswordForm.newPassword !== changePasswordForm.confirmPassword) {
      toast.error('Las contraseñas nuevas no coinciden')
      return
    }
    if (changePasswordForm.newPassword.length < 6) {
      toast.error('La nueva contraseña debe tener al menos 6 caracteres')
      return
    }
    setIsChangingPassword(true)
    try {
      const response = (await authApi.changePassword(token, changePasswordForm.currentPassword, changePasswordForm.newPassword)) as { success: boolean; message: string }
      if (response.success) {
        toast.success('Contraseña actualizada correctamente')
        setChangePasswordOpen(false)
        setChangePasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      }
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error('Error al cambiar la contraseña')
      }
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleConfigurarCucuru = async () => {
    if (!token) return
    if (!cucuruApiKey.trim() || !cucuruCollectorId.trim()) {
      toast.error('Debes ingresar API Key y Collector ID')
      return
    }
    setIsConfiguringCucuru(true)
    try {
      const response = (await cucuruApi.configurar(
        token,
        cucuruApiKey,
        cucuruCollectorId
      )) as { success: boolean; data: any }
      if (response.success) {
        toast.success('Billetera Virtual configurada con éxito', {
          description: 'Tu cuenta Cucuru está lista para automatizar cobros.',
        })
        restauranteStore.fetchData()
        setCucuruApiKey('')
        setCucuruCollectorId('')
      }
    } catch (error) {
      toast.error('Error al configurar la Billetera Virtual')
    } finally {
      setIsConfiguringCucuru(false)
    }
  }

  const handleSaveMetodosPago = async () => {
    if (!token) return
    const r = restaurante as any
    const cucuruOk = !!r?.cucuruConfigurado
    const taloOk = !!(r?.taloClientId && r?.taloClientSecret && r?.taloUserId)
    setIsSavingMetodosPago(true)
    try {
      await restauranteApi.updateMetodosPago(token, {
        mercadopagoCheckout: cfgMpCheckout,
        mercadopagoBricks: cfgMpBricks,
        transferenciaAutomatica: cfgTfAuto,
        transferenciaManual: cfgTfManual,
        efectivo: cfgEfectivo,
        transferenciaAlias: cfgAlias,
      })
      if (cfgTfAuto && cucuruOk && taloOk) {
        await restauranteApi.updatePasarelaPago(token, { proveedorPago: proveedorTransferencia })
      }
      await restauranteStore.fetchData()
      toast.success('Métodos de pago guardados')
    } catch {
      toast.error('No se pudieron guardar los métodos de pago')
    } finally {
      setIsSavingMetodosPago(false)
    }
  }

  const handleConfigurarTalo = async () => {
    if (!token) return
    if (!taloClientId.trim() || !taloClientSecret.trim() || !taloUserId.trim()) {
      toast.error('Ingresá Client ID, Client Secret y User ID de Talo')
      return
    }
    setIsConfiguringTalo(true)
    try {
      const response = (await restauranteApi.configurarTalo(
        token,
        taloClientId.trim(),
        taloClientSecret.trim(),
        taloUserId.trim()
      )) as { success: boolean }
      if (response.success) {
        toast.success('Talo configurado correctamente')
        restauranteStore.fetchData()
      }
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error('Error al configurar Talo', { description: error.message })
      } else {
        toast.error('Error de conexión')
      }
    } finally {
      setIsConfiguringTalo(false)
    }
  }

  const handleReenviarWebhookCucuru = async () => {
    if (!token) return
    setIsReenviandoWebhookCucuru(true)
    try {
      const response = (await cucuruApi.reconfigurarWebhook(token)) as { success: boolean }
      if (response.success) {
        toast.success('Webhook reenviado', {
          description: 'La URL HTTPS del webhook se volvió a enviar a Cucuru correctamente.',
        })
      }
    } catch (error) {
      toast.error('Error al reenviar webhook', {
        description: 'No se pudo reconfigurar. Verifica tus credenciales en Cucuru.',
      })
    } finally {
      setIsReenviandoWebhookCucuru(false)
    }
  }

  const handleToggleOrderGroupEnabled = async () => {
    if (!token) return
    setIsTogglingOrderGroupEnabled(true)
    try {
      const response = (await restauranteApi.toggleOrderGroupEnabled(token)) as {
        success: boolean
        orderGroupEnabled: boolean
      }
      if (response.success) {
        toast.success(
          response.orderGroupEnabled
            ? 'Pedido entre amigos activado'
            : 'Pedido entre amigos desactivado'
        )
        restauranteStore.fetchData()
      }
    } catch (error) {
      toast.error('Error al cambiar la configuración')
    } finally {
      setIsTogglingOrderGroupEnabled(false)
    }
  }

  const handleToggleNotificarClientesWhatsapp = async () => {
    if (!token) return
    setIsTogglingNotificarClientesWhatsapp(true)
    try {
      const response = (await restauranteApi.toggleNotificarClientesWhatsapp(token)) as {
        success: boolean
        notificarClientesWhatsapp: boolean
      }
      if (response.success) {
        toast.success(
          response.notificarClientesWhatsapp
            ? 'Notificaciones a clientes activadas'
            : 'Notificaciones a clientes desactivadas'
        )
        restauranteStore.fetchData()
      }
    } catch (error) {
      toast.error('Error al cambiar la configuración')
    } finally {
      setIsTogglingNotificarClientesWhatsapp(false)
    }
  }

  const handleToggleModoConfirmacionManual = async () => {
    if (!token) return
    setIsTogglingModoConfirmacionManual(true)
    try {
      const response = (await restauranteApi.toggleModoConfirmacionManual(token)) as {
        success: boolean
        modoConfirmacionManual: boolean
      }
      if (response.success) {
        toast.success(
          response.modoConfirmacionManual
            ? 'Confirmación manual activada'
            : 'Confirmación manual desactivada'
        )
        restauranteStore.fetchData()
      }
    } catch (error) {
      toast.error('Error al cambiar la configuración')
    } finally {
      setIsTogglingModoConfirmacionManual(false)
    }
  }

  const handleToggleDeliveryEnabled = async () => {
    if (!token) return
    setIsTogglingDeliveryEnabled(true)
    try {
      const response = (await restauranteApi.toggleDeliveryEnabled(token)) as {
        success: boolean
        deliveryEnabled: boolean
      }
      if (response.success) {
        toast.success(response.deliveryEnabled ? 'Delivery activado' : 'Delivery desactivado')
        restauranteStore.fetchData()
      }
    } catch (error) {
      toast.error('Error al cambiar la configuración')
    } finally {
      setIsTogglingDeliveryEnabled(false)
    }
  }

  const handleToggleTakeawayEnabled = async () => {
    if (!token) return
    setIsTogglingTakeawayEnabled(true)
    try {
      const response = (await restauranteApi.toggleTakeawayEnabled(token)) as {
        success: boolean
        takeawayEnabled: boolean
      }
      if (response.success) {
        toast.success(response.takeawayEnabled ? 'Take Away activado' : 'Take Away desactivado')
        restauranteStore.fetchData()
      }
    } catch (error) {
      toast.error('Error al cambiar la configuración')
    } finally {
      setIsTogglingTakeawayEnabled(false)
    }
  }

  const handleTogglePermitirPedidosProgramados = async () => {
    if (!token) return
    setIsTogglingPermitirPedidosProgramados(true)
    try {
      const response = (await restauranteApi.togglePermitirPedidosProgramados(token)) as {
        success: boolean
        permitirPedidosProgramados: boolean
      }
      if (response.success) {
        toast.success(response.permitirPedidosProgramados ? 'Pedidos programados activados' : 'Pedidos programados desactivados')
        restauranteStore.fetchData()
      }
    } catch {
      toast.error('Error al cambiar la configuración')
    } finally {
      setIsTogglingPermitirPedidosProgramados(false)
    }
  }

  const handleToggleUsarFranjasHorario = async () => {
    if (!token) return
    setIsTogglingUsarFranjasHorario(true)
    try {
      const response = (await restauranteApi.toggleUsarFranjasHorario(token)) as {
        success: boolean
        usarFranjasHorario: boolean
      }
      if (response.success) {
        toast.success(response.usarFranjasHorario ? 'Franjas de horario activadas' : 'Franjas de horario desactivadas')
        restauranteStore.fetchData()
      }
    } catch {
      toast.error('Error al cambiar la configuración')
    } finally {
      setIsTogglingUsarFranjasHorario(false)
    }
  }

  const cargarFranjas = async () => {
    if (!token) return
    try {
      const response = (await restauranteApi.getFranjasHorario(token)) as { success: boolean; franjas: FranjaHorario[] }
      if (response.success) setFranjas(response.franjas)
    } catch {
      toast.error('Error al cargar franjas')
    } finally {
      setFranjasLoaded(true)
    }
  }

  const handleSaveFranja = async () => {
    if (!token) return
    if (!franjaForm.nombre.trim()) return toast.error('Ingresa un nombre para la franja')
    setIsSavingFranja(true)
    try {
      if (editingFranja) {
        const response = (await restauranteApi.updateFranjaHorario(token, editingFranja.id, franjaForm)) as { success: boolean }
        if (response.success) {
          toast.success('Franja actualizada')
          setFranjaDialogOpen(false)
          cargarFranjas()
        }
      } else {
        const response = (await restauranteApi.createFranjaHorario(token, franjaForm)) as { success: boolean }
        if (response.success) {
          toast.success('Franja creada')
          setFranjaDialogOpen(false)
          cargarFranjas()
        }
      }
    } catch {
      toast.error('Error al guardar franja')
    } finally {
      setIsSavingFranja(false)
    }
  }

  const handleDeleteFranja = async (id: number) => {
    if (!token) return
    try {
      const response = (await restauranteApi.deleteFranjaHorario(token, id)) as { success: boolean }
      if (response.success) {
        toast.success('Franja eliminada')
        cargarFranjas()
      }
    } catch {
      toast.error('Error al eliminar franja')
    }
  }

  const handleToggleCodigoDescuentoEnabled = async () => {
    if (!token) return
    setIsTogglingCodigoDescuentoEnabled(true)
    try {
      const response = (await restauranteApi.toggleCodigoDescuentoEnabled(token)) as {
        success: boolean
        codigoDescuentoEnabled: boolean
      }
      if (response.success) {
        toast.success(
          response.codigoDescuentoEnabled
            ? 'Códigos de descuento habilitados'
            : 'Códigos de descuento deshabilitados'
        )
        restauranteStore.fetchData()
      }
    } catch (error) {
      toast.error('Error al cambiar la configuración')
    } finally {
      setIsTogglingCodigoDescuentoEnabled(false)
    }
  }

  const handleToggleDisenoAlternativo = async () => {
    if (!token) return
    setIsTogglingDisenoAlternativo(true)
    try {
      const response = (await restauranteApi.toggleDisenoAlternativo(token)) as {
        success: boolean
        disenoAlternativo: boolean
      }
      if (response.success) {
        toast.success(
          response.disenoAlternativo ? 'Diseño alternativo activado' : 'Diseño alternativo desactivado'
        )
        restauranteStore.fetchData()
      }
    } catch (error) {
      toast.error('Error al cambiar la configuración de diseño')
    } finally {
      setIsTogglingDisenoAlternativo(false)
    }
  }

  const handleSavePerfil = async () => {
    if (!token) {
      toast.error('No hay sesión activa')
      return
    }
    if (!formData.nombre.trim()) {
      toast.error('El nombre es requerido')
      return
    }
    setIsSubmitting(true)
    try {
      const updateData: any = {}
      if (formData.nombre !== restaurante?.nombre) updateData.nombre = formData.nombre
      if (formData.direccion !== (restaurante?.direccion || '')) updateData.direccion = formData.direccion
      if (formData.telefono !== (restaurante?.telefono || '')) updateData.telefono = formData.telefono
      if (formData.username !== (restaurante?.username || '')) updateData.username = formData.username
      if (formData.deliveryFee !== (restaurante?.deliveryFee || ''))
        updateData.deliveryFee = formData.deliveryFee
      if (formData.whatsappEnabled !== (restaurante?.whatsappEnabled || false))
        updateData.whatsappEnabled = formData.whatsappEnabled
      if (formData.whatsappNumber !== (restaurante?.whatsappNumber || ''))
        updateData.whatsappNumber = formData.whatsappNumber
      if (
        formData.comprobantesWhatsapp.trim() !== (restaurante?.comprobantesWhatsapp || '')
      )
        updateData.comprobantesWhatsapp = formData.comprobantesWhatsapp.trim() || null
      if (formData.transferenciaAlias !== (restaurante?.transferenciaAlias || ''))
        updateData.transferenciaAlias = formData.transferenciaAlias
      if (formData.colorPrimario !== (restaurante?.colorPrimario || ''))
        updateData.colorPrimario = formData.colorPrimario
      if (formData.colorSecundario !== (restaurante?.colorSecundario || ''))
        updateData.colorSecundario = formData.colorSecundario
      if (imageBase64 && imageBase64.startsWith('data:image')) updateData.image = imageBase64
      if (imageLightBase64 && imageLightBase64.startsWith('data:image'))
        updateData.imageLight = imageLightBase64
      const prevDireccionTexto = (restaurante as any)?.direccionTexto || ''
      if (direccionTexto !== prevDireccionTexto) {
        updateData.direccionTexto = direccionTexto || null
        updateData.direccionLat = direccionLat
        updateData.direccionLng = direccionLng
      }

      if (Object.keys(updateData).length === 0) {
        toast.info('No hay cambios para guardar')
        return
      }
      const response = (await restauranteApi.update(token, updateData)) as { success: boolean }
      if (response.success) {
        toast.success('Perfil actualizado correctamente')
        await restauranteStore.fetchData()
      }
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error('Error al guardar', { description: error.message })
      } else {
        toast.error('Error de conexión')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const copyLink = () => {
    if (restaurante?.username) {
      navigator.clipboard.writeText(`https://my.piru.app/${restaurante.username}`)
      toast.success('Link copiado al portapapeles')
    }
  }

  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

  const abrirCrearSucursal = () => {
    setEditingSucursal(null)
    setSucursalForm({
      nombre: '',
      direccion: '',
      whatsappEnabled: false,
      whatsappNumber: '',
      rapiboyToken: '',
      activo: true,
    })
    setSucursalDialogOpen(true)
  }

  const abrirEditarSucursal = (s: Sucursal) => {
    setEditingSucursal(s)
    setSucursalForm({
      nombre: s.nombre,
      direccion: s.direccion || '',
      whatsappEnabled: s.whatsappEnabled,
      whatsappNumber: s.whatsappNumber || '',
      rapiboyToken: s.rapiboyToken || '',
      activo: s.activo,
    })
    setSucursalDialogOpen(true)
  }

  const handleGuardarSucursal = async () => {
    if (!token || !sucursalForm.nombre.trim()) {
      toast.error('El nombre es requerido')
      return
    }
    setIsSavingSucursal(true)
    try {
      const body = {
        ...sucursalForm,
        direccion: sucursalForm.direccion || null,
        whatsappNumber: sucursalForm.whatsappNumber || null,
        rapiboyToken: sucursalForm.rapiboyToken || null,
      }
      const authHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      }
      const url = editingSucursal
        ? `${apiBase}/sucursales/${editingSucursal.id}`
        : `${apiBase}/sucursales/create`
      const res = await fetch(url, {
        method: editingSucursal ? 'PUT' : 'POST',
        headers: authHeaders,
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(editingSucursal ? 'Sucursal actualizada' : 'Sucursal creada')
        setSucursalesLoaded(false)
        setSucursalDialogOpen(false)
      } else {
        toast.error(data.message || 'Error al guardar')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setIsSavingSucursal(false)
    }
  }

  const handleEliminarSucursal = async (id: number) => {
    if (!token) return
    try {
      const res = await fetch(`${apiBase}/sucursales/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Sucursal desactivada')
        setSucursales((prev) => prev.filter((s) => s.id !== id))
        setSucursalDialogOpen(false)
        setEditingSucursal(null)
      } else {
        toast.error(data.message || 'Error al eliminar')
      }
    } catch {
      toast.error('Error al eliminar')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-white dark:bg-black">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#FF7A00]" />
          <p className="text-sm text-zinc-500 font-medium">Cargando tu espacio…</p>
        </div>
      </div>
    )
  }

  const sectionVisible = (id: string) => activeSection === null || activeSection === id

  return (
    <div className="min-h-dvh bg-white dark:bg-black pb-14 selection:bg-[#FF7A00]/20 selection:text-[#FF7A00]">

      {/* ── Header ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-5 sm:pt-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

          <div className="flex items-center gap-5 min-w-0">
            <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 overflow-hidden shrink-0">
              {restaurante?.imagenUrl ? (
                <img
                  src={restaurante.imagenUrl}
                  alt={restaurante.nombre}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full bg-[#FF7A00] flex items-center justify-center">
                  <Store className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
                </div>
              )}
            </div>

            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground truncate">
                {restaurante?.nombre}
              </h1>
              <p className="text-sm text-muted-foreground mt-1 truncate">{restaurante?.email}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <PWAInstallButton />
            <Button
              variant="ghost"
              onClick={() => setChangePasswordOpen(true)}
              className="h-11 w-11 rounded-xl p-0 text-zinc-400 hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
              title="Cambiar contraseña"
            >
              <Lock className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="h-11 w-11 rounded-xl p-0 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              title="Cerrar sesión"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Link público */}
        {restaurante?.username && (
          <div className="mt-4 flex items-center justify-between gap-3 px-4 py-2 bg-zinc-100 dark:bg-zinc-900 rounded-xl max-w-md">
            <div className="flex items-center gap-2.5 min-w-0">
              <Globe className="h-4 w-4 text-[#FF7A00] shrink-0" />
              <span className="text-[15px] font-semibold text-foreground tracking-tight truncate">
                piru.app/{restaurante.username}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={copyLink} className="p-2 text-muted-foreground hover:text-[#FF7A00] rounded-lg transition-colors" title="Copiar link">
                <Copy className="h-4 w-4" />
              </button>
              <a href={`https://my.piru.app/${restaurante.username}`} target="_blank" rel="noreferrer" className="p-2 text-muted-foreground hover:text-[#FF7A00] rounded-lg transition-colors" title="Abrir link">
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        )}
      </div>

      {/* ── Floating Side Nav ── */}
      <nav
        className="fixed hidden xl:flex flex-col top-1/2 z-40"
        style={{ left: 'calc((100vw - 64rem) / 4)', transform: 'translateX(-50%) translateY(-50%)' }}
      >
        <div className="bg-white/80 backdrop-blur-sm dark:bg-zinc-900 rounded-2xl shadow-xl shadow-zinc-300/60 dark:shadow-black/40 border border-zinc-100 dark:border-zinc-800 p-2 flex flex-col gap-0.5">
          {SECTIONS.map(({ id, label, Icon }) => {
            const isActive = activeSection === id
            return (
              <button
                key={id}
                onClick={() => setActiveSection(prev => prev === id ? null : id)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-200 w-full text-left",
                  isActive
                    ? "bg-[#FF7A00] text-white"
                    : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
                {isActive && <X className="h-3 w-3 ml-auto shrink-0 opacity-80" />}
              </button>
            )
          })}
        </div>
      </nav>

      {/* ── Main content — scroll vertical ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-6">

        {/* ── SECCIÓN: General ── */}
        <div className={cn("overflow-hidden transition-all duration-300 ease-in-out", sectionVisible('general') ? "opacity-100 max-h-[5000px] mb-10" : "opacity-0 max-h-0 mb-0 pointer-events-none")}>
        <section>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">General</h2>
          <div>

            {/* Main — editable inline */}
            <div className="space-y-4">
              <div className={phantomCardClass}>
                <div>
                  <div className="mb-5">
                    <h3 className="text-xl font-bold tracking-tight">Información del negocio</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1">
                      <Label htmlFor="nombre" className={phantomLabelClass}>Nombre del local</Label>
                      <Input id="nombre" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} placeholder="Ej: Burger Bros" className={phantomInputClass} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="username" className={phantomLabelClass}>Alias URL</Label>
                      <div className="relative flex items-center overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800 focus-within:ring-2 focus-within:ring-[#FF7A00]/30 transition-all">
                        <span className="pl-4 pr-1 text-muted-foreground font-mono text-sm select-none">piru.app/</span>
                        <Input id="username" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} placeholder="mi-local" className="h-10 bg-transparent border-none focus-visible:ring-0 px-0 font-mono text-base w-full min-w-0" />
                      </div>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label htmlFor="direccionTexto" className={phantomLabelClass}>Dirección del local (para takeaway y chatbot)</Label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <input
                          ref={direccionInputRef}
                          id="direccionTexto"
                          type="text"
                          value={direccionTexto}
                          onChange={(e) => {
                            setDireccionTexto(e.target.value)
                            setDireccionLat(null)
                            setDireccionLng(null)
                          }}
                          placeholder="Buscá la dirección exacta del local..."
                          autoComplete="off"
                          className={cn(phantomInputClass, "pl-10")}
                        />
                        {direccionLat && (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Geocodificada</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <Separator className="my-6" />

                  <h3 className="text-lg font-bold mb-1">Contacto y cobros</h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <Label className={phantomLabelClass}>WhatsApp del local</Label>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={formData.whatsappEnabled}
                          onCheckedChange={(v) => setFormData({ ...formData, whatsappEnabled: v })}
                        />
                        <Input
                          value={formData.whatsappNumber}
                          onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                          placeholder="5491123456789"
                          disabled={!formData.whatsappEnabled}
                          className={cn(phantomInputClass, "flex-1")}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className={phantomLabelClass}>WhatsApp para comprobantes</Label>
                      <Input
                        value={formData.comprobantesWhatsapp}
                        onChange={(e) => setFormData({ ...formData, comprobantesWhatsapp: e.target.value })}
                        placeholder="5491123456789"
                        className={phantomInputClass}
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className={phantomLabelClass}>Alias / CBU para transferencias</Label>
                      <Input
                        value={formData.transferenciaAlias}
                        onChange={(e) => setFormData({ ...formData, transferenciaAlias: e.target.value })}
                        placeholder="Ej: minombre.mp"
                        className={cn(phantomInputClass, "font-mono")}
                      />
                    </div>
                  </div>

                  <Separator className="my-6" />

                  <h3 className="text-lg font-bold mb-1">Notificaciones</h3>

                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    <ToggleRow
                      title="Avisos automáticos a clientes"
                      description=""
                      checked={(restaurante as any)?.notificarClientesWhatsapp !== false}
                      onCheckedChange={handleToggleNotificarClientesWhatsapp}
                      disabled={isTogglingNotificarClientesWhatsapp}
                    />
                    {(restaurante as any)?.notificarClientesWhatsapp && (
                      <ToggleRow
                        title="Confirmación manual con demora"
                        description="En lugar del aviso automático, ingresás la demora y lo enviás manualmente desde el panel."
                        checked={(restaurante as any)?.modoConfirmacionManual === true}
                        onCheckedChange={handleToggleModoConfirmacionManual}
                        disabled={isTogglingModoConfirmacionManual}
                      />
                    )}
                  </div>

                  <div className="flex justify-end mt-6">
                    <Button
                      onClick={handleSavePerfil}
                      disabled={isSubmitting}
                      className="h-12 px-7 rounded-xl font-bold bg-[#FF7A00] hover:bg-[#E66E00] text-white"
                    >
                      {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                      Guardar cambios
                    </Button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>
        </div>

        {/* ── SECCIÓN: Pagos ── */}
        <div className={cn("overflow-hidden transition-all duration-300 ease-in-out", sectionVisible('pagos') ? "opacity-100 max-h-[5000px] mb-10" : "opacity-0 max-h-0 mb-0 pointer-events-none")}>
        <section>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">Pagos</h2>
          <div>

            {/* ── Métodos de pago activos ── */}
            <div className="max-w-xl mb-2">
              <h3 className="text-xl font-bold tracking-tight">Métodos de pago</h3>
              <p className="text-sm text-muted-foreground mt-1">Elegí qué medios de pago ofreces en tu link.</p>
            </div>

            <div className="space-y-6 mt-5">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Automáticos (Mercado Pago)</p>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4 p-4 rounded-2xl border border-border bg-muted/20">
                    <div className="flex-1 space-y-1">
                      <Label htmlFor="cfg-mp-co" className="text-sm font-bold flex items-center gap-2"><CreditCard className="h-4 w-4 text-[#009EE3]" /> Mercado Pago Checkout</Label>
                      <p className="text-xs text-muted-foreground">Redirige a la app de MP. Ideal para pagar con dinero en cuenta.</p>
                    </div>
                    <Switch id="cfg-mp-co" checked={cfgMpCheckout} onCheckedChange={setCfgMpCheckout} />
                  </div>
                  <div className="flex items-start justify-between gap-4 p-4 rounded-2xl border border-border bg-muted/20">
                    <div className="flex-1 space-y-1">
                      <Label htmlFor="cfg-mp-br" className="text-sm font-bold flex items-center gap-2"><CreditCard className="h-4 w-4 text-[#009EE3]" /> Mercado Pago Tarjetas</Label>
                      <p className="text-xs text-muted-foreground">Formulario embebido. El cliente paga con tarjeta sin salir de tu menú.</p>
                    </div>
                    <Switch id="cfg-mp-br" checked={cfgMpBricks} onCheckedChange={setCfgMpBricks} />
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Automáticos (Transferencias)</p>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4 p-4 rounded-2xl border border-border bg-muted/20">
                    <div className="flex-1 space-y-1">
                      <Label htmlFor="cfg-tf-au" className="text-sm font-bold flex items-center gap-2"><Zap className="h-4 w-4 text-amber-500" /> Transf. Automática</Label>
                      <p className="text-xs text-muted-foreground">Vía Cucuru o Talo (si están configurados más abajo).</p>
                      {cfgTfAuto && (() => {
                        const cucuruOk = !!(restaurante as any)?.cucuruConfigurado
                        const taloOk = !!(restaurante as any)?.taloClientId && !!(restaurante as any)?.taloClientSecret && !!(restaurante as any)?.taloUserId
                        if (cucuruOk && taloOk) {
                          return (
                            <div className="flex gap-2 mt-3">
                              {(['cucuru', 'talo'] as const).map((p) => (
                                <button
                                  key={p}
                                  type="button"
                                  onClick={() => setProveedorTransferencia(p)}
                                  className={cn(
                                    "flex-1 py-2 px-3 rounded-xl text-sm font-semibold transition-all border",
                                    proveedorTransferencia === p
                                      ? "bg-amber-50 dark:bg-amber-950/20 border-amber-400 text-amber-700 dark:text-amber-400"
                                      : "bg-muted border-transparent text-muted-foreground hover:border-border"
                                  )}
                                >
                                  {p === 'cucuru' ? 'Cucuru' : 'Talo'}
                                </button>
                              ))}
                            </div>
                          )
                        }
                        if (cucuruOk) return <p className="text-xs mt-2 text-muted-foreground">Usará Cucuru</p>
                        if (taloOk) return <p className="text-xs mt-2 text-muted-foreground">Usará Talo</p>
                        return <p className="text-xs mt-2 text-amber-600 dark:text-amber-400">Configurá Cucuru o Talo en Integraciones.</p>
                      })()}
                    </div>
                    <Switch id="cfg-tf-au" checked={cfgTfAuto} onCheckedChange={setCfgTfAuto} />
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Manuales</p>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4 p-4 rounded-2xl border border-border bg-muted/20">
                    <div className="flex-1 space-y-1">
                      <Label htmlFor="cfg-tf-man" className="text-sm font-bold flex items-center gap-2"><Wallet className="h-4 w-4 text-muted-foreground" /> Transf. Manual (Alias)</Label>
                      <p className="text-xs text-muted-foreground">Mostrás tu CBU/Alias y verificás a mano.</p>
                      {cfgTfManual && (
                        <Input id="cfg-alias" value={cfgAlias} onChange={(e) => setCfgAlias(e.target.value)} placeholder="Tu alias..." className="h-10 mt-3 rounded-xl bg-background font-mono text-sm" />
                      )}
                    </div>
                    <Switch id="cfg-tf-man" checked={cfgTfManual} onCheckedChange={setCfgTfManual} />
                  </div>
                  <div className="flex items-start justify-between gap-4 p-4 rounded-2xl border border-border bg-muted/20">
                    <div className="flex-1 space-y-1">
                      <Label htmlFor="cfg-cash" className="text-sm font-bold">Efectivo</Label>
                      <p className="text-xs text-muted-foreground">El cliente elige al pagar; el pedido entra en el panel para cobrar en caja.</p>
                    </div>
                    <Switch id="cfg-cash" checked={cfgEfectivo} onCheckedChange={setCfgEfectivo} />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <Button onClick={handleSaveMetodosPago} disabled={isSavingMetodosPago} className="h-12 px-7 rounded-xl font-bold bg-[#FF7A00] hover:bg-[#E66E00] text-white">
                {isSavingMetodosPago ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                Guardar métodos de pago
              </Button>
            </div>

            <Separator className="my-8" />

            {/* ── Integraciones ── */}
            <div className="max-w-xl mb-5">
              <h3 className="text-xl font-bold tracking-tight">Integraciones</h3>
              <p className="text-sm text-muted-foreground mt-1">Conectá las pasarelas de pago que querés usar.</p>
            </div>

            <div className="flex flex-col lg:grid lg:grid-cols-2 lg:gap-8 gap-6">

              {/* MercadoPago */}
              <IntegrationCard>
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-[#009EE3] flex items-center justify-center shrink-0">
                        <span className="text-white font-bold">MP</span>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">MercadoPago</h3>
                        <p className="text-sm text-muted-foreground">Tarjetas y dinero en cuenta</p>
                      </div>
                    </div>
                    <span className={cn("text-sm font-semibold", restaurante?.mpConnected ? "text-green-600 dark:text-green-500" : "text-zinc-400 dark:text-zinc-600")}>
                      {restaurante?.mpConnected ? 'Conectado' : 'Sin conectar'}
                    </span>
                  </div>
                  <div className="flex-1">
                    {restaurante?.mpConnected ? (
                      <p className="text-sm text-muted-foreground leading-relaxed">Tu cuenta de MercadoPago está conectada. Podés activar Checkout o Tarjetas en la sección de métodos de pago de arriba.</p>
                    ) : (
                      <p className="text-sm text-muted-foreground leading-relaxed">Conectá tu cuenta de MercadoPago para habilitar el pago con tarjetas en tu menú online.</p>
                    )}
                  </div>
                  <div className="mt-4">
                    {restaurante?.mpConnected ? (
                      <Button variant="ghost" className="w-full h-12 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 font-semibold" onClick={handleDesconectarMP} disabled={isDisconnectingMP}>
                        {isDisconnectingMP ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unlink className="mr-2 h-4 w-4" />}
                        Desconectar
                      </Button>
                    ) : (
                      <Button asChild className="w-full h-12 rounded-xl font-semibold bg-[#009EE3] hover:bg-[#0088C4] text-white">
                        <a href={getMercadoPagoAuthUrl() || '#'}>
                          <Link2 className="mr-2 h-4 w-4" />
                          Conectar cuenta
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </IntegrationCard>

              {/* Cucuru */}
              <IntegrationCard>
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-purple-600 flex items-center justify-center shrink-0">
                        <Wallet className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">Cucuru</h3>
                        <p className="text-sm text-muted-foreground">Transferencia automática</p>
                      </div>
                    </div>
                    <span className={cn("text-sm font-semibold", (restaurante as any)?.cucuruConfigurado ? "text-green-600 dark:text-green-500" : "text-zinc-400 dark:text-zinc-600")}>
                      {(restaurante as any)?.cucuruConfigurado ? 'Conectado' : 'Sin conectar'}
                    </span>
                  </div>
                  <div className="flex-1">
                    {(restaurante as any)?.cucuruConfigurado ? (
                      <div className="flex items-center gap-2.5 text-green-600 dark:text-green-500">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span className="text-sm font-medium">Webhooks sincronizados</span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Input placeholder="API Key" value={cucuruApiKey} onChange={(e) => setCucuruApiKey(e.target.value)} className={phantomInputClass} />
                        <Input placeholder="Collector ID" value={cucuruCollectorId} onChange={(e) => setCucuruCollectorId(e.target.value)} className={phantomInputClass} />
                      </div>
                    )}
                  </div>
                  <div className="mt-4">
                    {(restaurante as any)?.cucuruConfigurado ? (
                      <Button variant="ghost" className="w-full h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200/70 dark:hover:bg-zinc-700 font-semibold" onClick={handleReenviarWebhookCucuru} disabled={isReenviandoWebhookCucuru}>
                        {isReenviandoWebhookCucuru ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Reenviar webhook
                      </Button>
                    ) : (
                      <Button className="w-full h-12 rounded-xl font-semibold bg-purple-600 hover:bg-purple-700 text-white" onClick={handleConfigurarCucuru} disabled={isConfiguringCucuru}>
                        {isConfiguringCucuru ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Configurar cuenta
                      </Button>
                    )}
                  </div>
                </div>
              </IntegrationCard>

              {/* Talo */}
              <IntegrationCard>
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-amber-500 flex items-center justify-center shrink-0">
                        <Zap className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">Talo</h3>
                        <p className="text-sm text-muted-foreground">Transferencia en tiempo real</p>
                      </div>
                    </div>
                    <span className={cn("text-sm font-semibold", (restaurante as any)?.taloClientId ? "text-green-600 dark:text-green-500" : "text-zinc-400 dark:text-zinc-600")}>
                      {(restaurante as any)?.taloClientId ? 'Configurado' : 'Sin configurar'}
                    </span>
                  </div>
                  <div className="flex-1 space-y-3">
                    <Input type="password" placeholder="Client ID" value={taloClientId} onChange={(e) => setTaloClientId(e.target.value)} className={phantomInputClass} />
                    <Input type="password" placeholder="Client Secret" value={taloClientSecret} onChange={(e) => setTaloClientSecret(e.target.value)} className={phantomInputClass} />
                    <Input placeholder="User ID" value={taloUserId} onChange={(e) => setTaloUserId(e.target.value)} className={phantomInputClass} />
                  </div>
                  <div className="mt-4">
                    <Button className="w-full h-12 rounded-xl font-semibold bg-amber-500 hover:bg-amber-600 text-white" onClick={handleConfigurarTalo} disabled={isConfiguringTalo}>
                      {isConfiguringTalo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Guardar credenciales
                    </Button>
                  </div>
                </div>
              </IntegrationCard>

              {/* WhatsApp Business */}
              <IntegrationCard>
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-[#25D366] flex items-center justify-center shrink-0">
                        <span className="text-white font-bold text-xs">WA</span>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">WhatsApp Business</h3>
                        <p className="text-sm text-muted-foreground">IA para pedidos por WhatsApp</p>
                      </div>
                    </div>
                    <span className={cn("text-sm font-semibold", waStatus?.conectado ? "text-green-600 dark:text-green-500" : "text-zinc-400 dark:text-zinc-600")}>
                      {waStatus?.conectado ? 'Conectado' : 'Sin conectar'}
                    </span>
                  </div>
                  <div className="flex-1">
                    {waStatus?.conectado ? (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Número: <span className="font-medium text-foreground">{waStatus.phoneNumber}</span></p>
                        {waStatus.tokenVencido && (
                          <p className="text-sm font-medium text-red-500 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" /> Token vencido — reconectá el número</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground leading-relaxed">Conectá tu número de WhatsApp Business para que la IA atienda pedidos automáticamente.</p>
                    )}
                  </div>
                  <div className="mt-4">
                    {waStatus?.conectado ? (
                      <div className="flex flex-col gap-2">
                        {waStatus.tokenVencido && (
                          <Button className="w-full h-12 rounded-xl font-semibold bg-[#25D366] hover:bg-[#1ebe5a] text-white" onClick={conectarWhatsApp} disabled={waLoading}>
                            {waLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            Reconectar
                          </Button>
                        )}
                        <Button variant="ghost" className="w-full h-12 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 font-semibold" onClick={desconectarWhatsApp}>
                          <Unlink className="mr-2 h-4 w-4" />
                          Desconectar
                        </Button>
                      </div>
                    ) : (
                      <Button className="w-full h-12 rounded-xl font-semibold bg-[#25D366] hover:bg-[#1ebe5a] text-white" onClick={conectarWhatsApp} disabled={waLoading}>
                        {waLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                        {waLoading ? 'Conectando...' : 'Conectar número'}
                      </Button>
                    )}
                  </div>
                </div>
              </IntegrationCard>

            </div>
          </div>
        </section>
        </div>

        {/* ── SECCIÓN: Delivery ── */}
        <div className={cn("overflow-hidden transition-all duration-300 ease-in-out", sectionVisible('delivery') ? "opacity-100 max-h-[5000px] mb-10" : "opacity-0 max-h-0 mb-0 pointer-events-none")}>
        <section>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">Delivery y horarios</h2>
          <div>

            <div className={phantomCardClass}>
              <div>
                <div className="max-w-xl mb-4">
                  <h3 className="text-xl font-bold tracking-tight">Tipos de pedido</h3>
                </div>
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  <ToggleRow
                    icon={<Truck className="h-5 w-5" />}
                    title="Delivery"
                    description=""
                    checked={(restaurante as any)?.deliveryEnabled !== false}
                    onCheckedChange={handleToggleDeliveryEnabled}
                    disabled={isTogglingDeliveryEnabled}
                  />
                  <ToggleRow
                    icon={<Package className="h-5 w-5" />}
                    title="Take Away"
                    description=""
                    checked={(restaurante as any)?.takeawayEnabled !== false}
                    onCheckedChange={handleToggleTakeawayEnabled}
                    disabled={isTogglingTakeawayEnabled}
                  />
                </div>
              </div>
            </div>

            <Separator className="my-8" />

            <div className={phantomCardClass}>
              <div>
                <div className="max-w-xl mb-4">
                  <h3 className="text-xl font-bold tracking-tight">Horarios de atención</h3>
                </div>

                {!horariosLoaded ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-[#FF7A00]" />
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {DIAS_SEMANA.map((nombreDia, diaIdx) => {
                      const turnos = horarios[diaIdx] || []
                      const estaAbierto = turnos.length > 0
                      return (
                        <div key={diaIdx} className="flex flex-col sm:flex-row sm:items-start gap-4 py-5">
                          <div className="flex items-center gap-3 sm:w-36 shrink-0 sm:pt-2">
                            <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", estaAbierto ? "bg-green-500" : "bg-zinc-300 dark:bg-zinc-700")} />
                            <span className={cn("text-base font-semibold", estaAbierto ? "text-foreground" : "text-muted-foreground")}>{nombreDia}</span>
                          </div>
                          <div className="flex-1 flex flex-col gap-2.5 min-w-0">
                            {turnos.length === 0 ? (
                              <span className="text-sm text-muted-foreground sm:pt-2.5">Cerrado</span>
                            ) : (
                              turnos.map((turno, tIdx) => (
                                <div key={tIdx} className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 bg-zinc-100 dark:bg-zinc-800 p-1.5 rounded-xl w-full xl:w-fit">
                                  <Input
                                    type="time"
                                    value={turno.horaApertura}
                                    onChange={(e) => actualizarTurno(diaIdx, tIdx, 'horaApertura', e.target.value)}
                                    className="h-10 flex-1 min-w-[90px] sm:w-28 rounded-lg bg-white dark:bg-zinc-900 border-none font-medium"
                                  />
                                  <span className="text-muted-foreground font-medium text-sm">a</span>
                                  <Input
                                    type="time"
                                    value={turno.horaCierre}
                                    onChange={(e) => actualizarTurno(diaIdx, tIdx, 'horaCierre', e.target.value)}
                                    className="h-10 flex-1 min-w-[90px] sm:w-28 rounded-lg bg-white dark:bg-zinc-900 border-none font-medium"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10 text-muted-foreground hover:text-red-500 rounded-lg shrink-0"
                                    onClick={() => eliminarTurno(diaIdx, tIdx)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))
                            )}
                            <button
                              onClick={() => agregarTurno(diaIdx)}
                              className="flex items-center gap-1.5 text-sm font-semibold text-[#FF7A00] hover:text-[#E66E00] w-fit mt-0.5 transition-colors"
                            >
                              <Plus className="h-4 w-4" /> Agregar turno
                            </button>
                          </div>
                        </div>
                      )
                    })}
                    <div className="pt-8 flex justify-end">
                      <Button
                        onClick={guardarHorarios}
                        disabled={isSavingHorarios}
                        className="h-12 px-7 rounded-xl font-bold bg-[#FF7A00] hover:bg-[#E66E00] text-white w-full sm:w-auto"
                      >
                        {isSavingHorarios && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                        Guardar horarios
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Separator className="my-8" />

            <div className={phantomCardClass}>
              <div>
                <div className="max-w-xl mb-4">
                  <h3 className="text-xl font-bold tracking-tight">Pedidos programados</h3>
                </div>
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  <ToggleRow
                    icon={<Clock className="h-5 w-5" />}
                    title="Permitir pedidos programados"
                    description=""
                    checked={(restaurante as any)?.permitirPedidosProgramados === true}
                    onCheckedChange={handleTogglePermitirPedidosProgramados}
                    disabled={isTogglingPermitirPedidosProgramados}
                  />
                  <ToggleRow
                    icon={<List className="h-5 w-5" />}
                    title="Usar franjas de horario"
                    description=""
                    checked={(restaurante as any)?.usarFranjasHorario === true}
                    onCheckedChange={handleToggleUsarFranjasHorario}
                    disabled={isTogglingUsarFranjasHorario || !(restaurante as any)?.permitirPedidosProgramados}
                  />
                </div>

                {(restaurante as any)?.usarFranjasHorario && (
                  <div className="mt-8">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-bold">Franjas de horario</h3>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-9 rounded-lg px-3 text-sm font-semibold text-[#FF7A00] hover:bg-orange-50 dark:hover:bg-orange-950/30"
                        onClick={() => {
                          if (!franjasLoaded) cargarFranjas()
                          setEditingFranja(null)
                          setFranjaForm({ nombre: '', horaInicio: '09:00', horaFin: '18:00', activo: true })
                          setFranjaDialogOpen(true)
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" /> Nueva franja
                      </Button>
                    </div>
                    {!franjasLoaded ? (
                      <Button variant="ghost" className="rounded-lg bg-zinc-100 dark:bg-zinc-800" onClick={cargarFranjas}>
                        <RefreshCw className="h-4 w-4 mr-2" /> Cargar franjas
                      </Button>
                    ) : franjas.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No hay franjas configuradas. Agregá una para que tus clientes puedan elegir.</p>
                    ) : (
                      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {franjas.map(f => (
                          <div key={f.id} className="flex items-center justify-between gap-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className={cn("h-2 w-2 rounded-full shrink-0", f.activo ? "bg-green-500" : "bg-zinc-300 dark:bg-zinc-700")} />
                              <div>
                                <p className="font-semibold text-[15px]">{f.nombre}</p>
                                <p className="text-xs text-muted-foreground">{f.horaInicio} – {f.horaFin}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg"
                                onClick={() => {
                                  setEditingFranja(f)
                                  setFranjaForm({ nombre: f.nombre, horaInicio: f.horaInicio, horaFin: f.horaFin, activo: f.activo })
                                  setFranjaDialogOpen(true)
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-red-500"
                                onClick={() => handleDeleteFranja(f.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <Separator className="my-8" />

            <div>
              <Suspense
                fallback={
                  <div className={cn(phantomCardClass, "flex items-center justify-center py-20")}>
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                }
              >
                <ZonasDeliveryMap />
              </Suspense>
            </div>

          </div>
        </section>
        </div>

        {/* ── SECCIÓN: Experiencia ── */}
        <div className={cn("overflow-hidden transition-all duration-300 ease-in-out", sectionVisible('experiencia') ? "opacity-100 max-h-[5000px] mb-10" : "opacity-0 max-h-0 mb-0 pointer-events-none")}>
        <section>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">Experiencia</h2>
          <div>

            <div className={phantomCardClass}>
              <div>
                <div className="max-w-xl mb-4">
                  <h3 className="text-xl font-bold tracking-tight">Diseño del menú</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
                  <button
                    onClick={() => restaurante?.disenoAlternativo && handleToggleDisenoAlternativo()}
                    disabled={isTogglingDisenoAlternativo && !restaurante?.disenoAlternativo}
                    className={cn(
                      "relative rounded-3xl p-4 text-left transition-all",
                      !restaurante?.disenoAlternativo
                        ? "bg-orange-50/60 dark:bg-orange-950/20"
                        : "bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60"
                    )}
                  >
                    {!restaurante?.disenoAlternativo && (
                      <CheckCircle2 className="absolute top-4 right-4 h-5 w-5 text-[#FF7A00]" />
                    )}
                    <div className="aspect-video rounded-2xl overflow-hidden mb-4 bg-zinc-900 relative">
                      <div className="absolute inset-0 bg-linear-to-br from-orange-500/20 to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3 h-12 bg-white/10 backdrop-blur-md rounded-xl border border-white/20" />
                    </div>
                    <p className="text-lg font-bold text-foreground">Glassmorphism</p>
                    <p className="text-sm text-muted-foreground mt-1">Moderno, flotante y premium. Ideal para destacar marca.</p>
                  </button>

                  <button
                    onClick={() => !restaurante?.disenoAlternativo && handleToggleDisenoAlternativo()}
                    disabled={isTogglingDisenoAlternativo && !!restaurante?.disenoAlternativo}
                    className={cn(
                      "relative rounded-3xl p-4 text-left transition-all",
                      restaurante?.disenoAlternativo
                        ? "bg-orange-50/60 dark:bg-orange-950/20"
                        : "bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60"
                    )}
                  >
                    {restaurante?.disenoAlternativo && (
                      <CheckCircle2 className="absolute top-4 right-4 h-5 w-5 text-[#FF7A00]" />
                    )}
                    <div className="aspect-video rounded-2xl overflow-hidden mb-4 bg-zinc-200 dark:bg-zinc-800 relative">
                      <div className="absolute inset-0 bg-linear-to-br from-zinc-400 to-zinc-500 dark:from-zinc-600 dark:to-zinc-700" />
                      <div className="absolute bottom-0 left-0 right-0 p-3 bg-zinc-950 h-14">
                        <div className="h-2 w-20 bg-zinc-200 dark:bg-zinc-800 rounded-full mb-2" />
                        <div className="h-2 w-12 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
                      </div>
                    </div>
                    <p className="text-lg font-bold text-foreground">Clásico (imagen completa)</p>
                    <p className="text-sm text-muted-foreground mt-1">Enfoque 100% en las fotos de tus productos.</p>
                  </button>
                </div>
              </div>
            </div>

            <Separator className="my-8" />

            <div className={phantomCardClass}>
              <div>
                <h3 className="text-xl font-bold tracking-tight mb-4">Funcionalidades extras</h3>
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  <ToggleRow
                    icon={<UtensilsCrossed className="h-5 w-5" />}
                    title="Pedido entre amigos"
                    description="Varias personas arman un solo carrito compartiendo un link."
                    checked={(restaurante as any)?.orderGroupEnabled !== false}
                    onCheckedChange={handleToggleOrderGroupEnabled}
                    disabled={isTogglingOrderGroupEnabled}
                  />
                  <ToggleRow
                    icon={<Ticket className="h-5 w-5" />}
                    title="Códigos de descuento"
                    description=""
                    checked={(restaurante as any)?.codigoDescuentoEnabled !== false}
                    onCheckedChange={handleToggleCodigoDescuentoEnabled}
                    disabled={isTogglingCodigoDescuentoEnabled}
                  />
                </div>
              </div>
            </div>

            <Separator className="mb-8 mt-2" />

            <div className={phantomCardClass}>
              <div>
                <div className="max-w-xl mb-6">
                  <h3 className="text-xl font-bold tracking-tight">Identidad visual</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
                  <div className="space-y-2">
                    <Label className={phantomLabelClass}>Logo (Modo Oscuro)</Label>
                    <div className="bg-zinc-900 rounded-3xl p-2 border-2 border-dashed border-zinc-700 hover:border-zinc-500 transition-colors">
                      <ImageUpload onImageChange={setImageBase64} currentImage={imageBase64} maxSize={5} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className={phantomLabelClass}>Logo (Modo Claro)</Label>
                    <div className="bg-zinc-50 dark:bg-zinc-800 rounded-3xl p-2 border-2 border-dashed border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-500 transition-colors">
                      <ImageUpload onImageChange={setImageLightBase64} currentImage={imageLightBase64} maxSize={5} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
                  <div className="space-y-1.5">
                    <Label className={phantomLabelClass}>Color primario (botones)</Label>
                    <div className="flex gap-2">
                      <Input type="color" className="w-10 h-10 p-1 cursor-pointer rounded-xl border-none shrink-0" value={formData.colorPrimario || '#FF7A00'} onChange={(e) => setFormData({ ...formData, colorPrimario: e.target.value })} />
                      <Input value={formData.colorPrimario} onChange={(e) => setFormData({ ...formData, colorPrimario: e.target.value })} className={cn(phantomInputClass, "font-mono uppercase")} placeholder="#FF7A00" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className={phantomLabelClass}>Color secundario (fondos)</Label>
                    <div className="flex gap-2">
                      <Input type="color" className="w-10 h-10 p-1 cursor-pointer rounded-xl border-none shrink-0" value={formData.colorSecundario || '#ffffff'} onChange={(e) => setFormData({ ...formData, colorSecundario: e.target.value })} />
                      <Input value={formData.colorSecundario} onChange={(e) => setFormData({ ...formData, colorSecundario: e.target.value })} className={cn(phantomInputClass, "font-mono uppercase")} placeholder="#FFFFFF" />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleSavePerfil}
                    disabled={isSubmitting}
                    className="h-12 px-7 rounded-xl font-bold bg-[#FF7A00] hover:bg-[#E66E00] text-white"
                  >
                    {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                    Guardar cambios
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
        </div>

        {/* ── SECCIÓN: Sucursales ── */}
        <div className={cn("overflow-hidden transition-all duration-300 ease-in-out", sectionVisible('sucursales') ? "opacity-100 max-h-[5000px] mb-10" : "opacity-0 max-h-0 mb-0 pointer-events-none")}>
        <section>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">Sucursales</h2>
          <div className={phantomCardClass}>
            <div>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
                <Button
                  onClick={abrirCrearSucursal}
                  className="shrink-0 h-11 rounded-xl bg-[#FF7A00] hover:bg-[#E66E00] text-white font-bold gap-2"
                >
                  <Plus className="h-4 w-4" /> Nueva
                </Button>
              </div>

              {!sucursalesLoaded ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-[#FF7A00]" />
                </div>
              ) : sucursales.length === 0 ? (
                <div className="text-center py-16">
                  <Store className="h-9 w-9 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
                  <h3 className="text-lg font-bold mb-1">Sin sucursales configuradas</h3>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                    Agregá tu primera sucursal para habilitar el ruteo automático de pedidos.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {sucursales.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-3 py-4 group">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <Store className={cn('h-5 w-5 shrink-0', s.activo ? 'text-[#FF7A00]' : 'text-zinc-400 dark:text-zinc-600')} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-[15px] truncate">{s.nombre}</p>
                            {!s.activo && <span className="text-xs font-medium text-muted-foreground">· Inactiva</span>}
                            {s.whatsappEnabled && s.whatsappNumber && <span className="text-xs font-medium text-green-600 dark:text-green-500">· WhatsApp</span>}
                          </div>
                          {s.direccion && <p className="text-sm text-muted-foreground truncate mt-0.5">{s.direccion}</p>}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-lg shrink-0 text-muted-foreground"
                        onClick={() => abrirEditarSucursal(s)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
        </div>

        {/* ── SECCIÓN: Facturación ── */}
        <div className={cn("overflow-hidden transition-all duration-300 ease-in-out", sectionVisible('facturacion') ? "opacity-100 max-h-[5000px] mb-10" : "opacity-0 max-h-0 mb-0 pointer-events-none")}>
        <section>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">Facturación</h2>
          <FacturacionAfipSection />
        </section>
        </div>

        {/* ── SECCIÓN: Hardware ── */}
        <div className={cn("overflow-hidden transition-all duration-300 ease-in-out", sectionVisible('hardware') ? "opacity-100 max-h-[5000px] mb-10" : "opacity-0 max-h-0 mb-0 pointer-events-none")}>
        <section>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">Hardware</h2>
          <div className={cn(phantomCardClass, "max-w-2xl")}>
            <div>
              <div className="mb-5">
                <h3 className="text-xl font-bold tracking-tight">Impresora térmica</h3>
              </div>

              {selectedPrinter ? (
                <div className="flex items-center gap-3.5 p-4 bg-green-950/20 rounded-xl mb-5">
                  <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold text-green-900 dark:text-green-100">Impresora lista</p>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-0.5 truncate">{selectedPrinter}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3.5 p-4 bg-amber-950/20 rounded-xl mb-5">
                  <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-500 shrink-0" />
                  <div>
                    <p className="text-[15px] font-bold text-amber-900 dark:text-amber-100">Sin configurar</p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">Buscá y seleccioná una impresora.</p>
                  </div>
                </div>
              )}

              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={handleListPrinters}
                    disabled={isListingPrinters}
                    className="flex-1 h-12 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 font-bold"
                  >
                    {isListingPrinters ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <List className="mr-2 h-5 w-5" />}
                    Buscar dispositivos
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleTestPrint}
                    disabled={isPrintingTest || !selectedPrinter}
                    className="flex-1 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200/70 dark:hover:bg-zinc-700 font-bold"
                  >
                    {isPrintingTest ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Printer className="mr-2 h-5 w-5" />}
                    Ticket de prueba
                  </Button>
                </div>

                {printers.length > 0 && (
                  <div>
                    <Label className={phantomLabelClass}>Seleccionar impresora</Label>
                    <Select value={selectedPrinter || ''} onValueChange={setSelectedPrinter}>
                      <SelectTrigger className="h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-transparent focus:ring-2 focus:ring-[#FF7A00]/30 text-base font-medium">
                        <SelectValue placeholder="Elegir del listado..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-zinc-200 dark:border-zinc-800">
                        {[...printers].map((p, i) => (
                          <SelectItem key={i} value={p} className="py-3 text-base rounded-xl cursor-pointer">
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
        </div>

      </div>

      <Dialog open={sucursalDialogOpen} onOpenChange={setSucursalDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto sm:rounded-[32px] border-zinc-200 dark:border-zinc-800 p-0 gap-0">
          <div className="px-5 pt-5 pb-4 bg-zinc-50 dark:bg-zinc-950">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight">
                {editingSucursal ? 'Editar sucursal' : 'Nueva sucursal'}
              </DialogTitle>
            </DialogHeader>
          </div>
          <div className="p-4 sm:p-5 space-y-5 bg-white dark:bg-zinc-950">
            <div className="space-y-1">
              <Label className={phantomLabelClass}>Nombre *</Label>
              <Input
                value={sucursalForm.nombre}
                onChange={(e) => setSucursalForm((p) => ({ ...p, nombre: e.target.value }))}
                placeholder="Ej: Sucursal Centro"
                className={phantomInputClass}
              />
            </div>
            <div className="space-y-1">
              <Label className={phantomLabelClass}>Dirección</Label>
              <Input
                value={sucursalForm.direccion}
                onChange={(e) => setSucursalForm((p) => ({ ...p, direccion: e.target.value }))}
                placeholder="Ej: San Martín 123"
                className={phantomInputClass}
              />
            </div>
            <Separator className="border-zinc-100 dark:border-zinc-800" />
            <div className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <div>
                <p className="font-semibold text-sm">WhatsApp de Notificaciones</p>
                <p className="text-xs text-muted-foreground mt-0.5">Esta sucursal recibe los pedidos por WhatsApp propio.</p>
              </div>
              <Switch
                checked={sucursalForm.whatsappEnabled}
                onCheckedChange={(v) => setSucursalForm((p) => ({ ...p, whatsappEnabled: v }))}
              />
            </div>
            {sucursalForm.whatsappEnabled && (
              <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
                <Label className={phantomLabelClass}>Número de WhatsApp</Label>
                <Input
                  value={sucursalForm.whatsappNumber}
                  onChange={(e) => setSucursalForm((p) => ({ ...p, whatsappNumber: e.target.value }))}
                  placeholder="5491123456789"
                  className={phantomInputClass}
                />
                <p className="text-xs text-muted-foreground pl-1">
                  Formato internacional sin &apos;+&apos;. Ej: 5493425001122
                </p>
              </div>
            )}
            <Separator className="border-zinc-100 dark:border-zinc-800" />
            <div className="space-y-1">
              <Label className={phantomLabelClass}>
                Token Rapiboy <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                type="password"
                value={sucursalForm.rapiboyToken}
                onChange={(e) => setSucursalForm((p) => ({ ...p, rapiboyToken: e.target.value }))}
                placeholder="Si esta sucursal usa Rapiboy propio"
                className={phantomInputClass}
              />
            </div>
            {editingSucursal && (
              <div className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                <div>
                  <p className="font-semibold text-sm">Sucursal activa</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Las sucursales inactivas no reciben pedidos.</p>
                </div>
                <Switch
                  checked={sucursalForm.activo}
                  onCheckedChange={(v) => setSucursalForm((p) => ({ ...p, activo: v }))}
                />
              </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
            {editingSucursal ? (
              <Button
                type="button"
                variant="ghost"
                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 h-12 rounded-xl font-semibold justify-start sm:justify-center"
                onClick={() => void handleEliminarSucursal(editingSucursal.id)}
                disabled={isSavingSucursal}
              >
                <Trash2 className="h-4 w-4 mr-2" /> Desactivar
              </Button>
            ) : (
              <span className="hidden sm:block sm:w-24" aria-hidden />
            )}
            <div className="flex gap-3 sm:ml-auto w-full sm:w-auto justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSucursalDialogOpen(false)}
                disabled={isSavingSucursal}
                className="h-12 px-6 rounded-xl font-medium flex-1 sm:flex-none"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void handleGuardarSucursal()}
                disabled={isSavingSucursal}
                className="h-12 px-8 rounded-xl font-bold bg-[#FF7A00] hover:bg-[#E66E00] text-white shadow-lg shadow-orange-500/20 flex-1 sm:flex-none"
              >
                {isSavingSucursal ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Cambiar contraseña */}
      <Dialog open={changePasswordOpen} onOpenChange={(open) => {
        setChangePasswordOpen(open)
        if (!open) setChangePasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      }}>
        <DialogContent className="sm:max-w-md rounded-[32px] p-0 overflow-hidden">
          <div className="p-4 sm:p-5">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl font-bold">Cambiar contraseña</DialogTitle>
              <DialogDescription>Ingresá tu contraseña actual y la nueva para actualizarla.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className={phantomLabelClass}>Contraseña actual</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  className={phantomInputClass}
                  value={changePasswordForm.currentPassword}
                  onChange={e => setChangePasswordForm(f => ({ ...f, currentPassword: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className={phantomLabelClass}>Nueva contraseña</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  className={phantomInputClass}
                  value={changePasswordForm.newPassword}
                  onChange={e => setChangePasswordForm(f => ({ ...f, newPassword: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className={phantomLabelClass}>Confirmar nueva contraseña</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  className={phantomInputClass}
                  value={changePasswordForm.confirmPassword}
                  onChange={e => setChangePasswordForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') handleChangePassword() }}
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <Button variant="ghost" onClick={() => setChangePasswordOpen(false)} disabled={isChangingPassword} className="h-12 px-6 rounded-xl font-medium">
                Cancelar
              </Button>
              <Button onClick={handleChangePassword} disabled={isChangingPassword} className="h-12 px-8 rounded-xl font-bold bg-[#FF7A00] hover:bg-[#E66E00] text-white shadow-lg shadow-orange-500/20">
                {isChangingPassword ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                Cambiar contraseña
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Franja de Horario */}
      <Dialog open={franjaDialogOpen} onOpenChange={setFranjaDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-[32px] p-0 overflow-hidden">
          <div className="p-4 sm:p-5">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl font-bold">{editingFranja ? 'Editar franja' : 'Nueva franja'}</DialogTitle>
              <DialogDescription>Configurá el nombre y el rango de horas para esta franja.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className={phantomLabelClass}>Nombre</Label>
                <Input
                  placeholder="Ej: Almuerzo, Cena, Mañana..."
                  className={phantomInputClass}
                  value={franjaForm.nombre}
                  onChange={e => setFranjaForm(f => ({ ...f, nombre: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className={phantomLabelClass}>Hora inicio</Label>
                  <Input
                    type="time"
                    className={phantomInputClass}
                    value={franjaForm.horaInicio}
                    onChange={e => setFranjaForm(f => ({ ...f, horaInicio: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className={phantomLabelClass}>Hora fin</Label>
                  <Input
                    type="time"
                    className={phantomInputClass}
                    value={franjaForm.horaFin}
                    onChange={e => setFranjaForm(f => ({ ...f, horaFin: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <Switch
                  checked={franjaForm.activo}
                  onCheckedChange={v => setFranjaForm(f => ({ ...f, activo: v }))}
                />
                <Label>Franja activa</Label>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <Button variant="ghost" onClick={() => setFranjaDialogOpen(false)} disabled={isSavingFranja} className="h-12 px-6 rounded-xl font-medium">
                Cancelar
              </Button>
              <Button onClick={handleSaveFranja} disabled={isSavingFranja} className="h-12 px-8 rounded-xl font-bold bg-[#FF7A00] hover:bg-[#E66E00] text-white shadow-lg shadow-orange-500/20">
                {isSavingFranja ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Perfil