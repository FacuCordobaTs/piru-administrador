import { useEffect, useState, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { restauranteApi, mercadopagoApi, cucuruApi, ApiError } from '@/lib/api'
import ImageUpload from '@/components/ImageUpload'
import { toast } from 'sonner'
import {
  Mail,
  MapPin,
  Phone,
  Edit,
  LogOut,
  Store,
  Loader2,
  Settings,
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
  Palette,
  Zap,
  Globe,
  Copy,
  Smartphone,
  ChevronRight,
  AlertCircle,
  Package,
} from 'lucide-react'
import { usePrinter } from '@/context/PrinterContext'
import { commandsToBytes } from '@/utils/printerUtils'
import { PWAInstallButton } from '@/components/PWAInstallButton'

const ZonasDeliveryMap = lazy(() => import('@/components/ZonasDeliveryMap'))

// Configuración de MercadoPago
const MP_APP_ID = 38638191854826
const MP_REDIRECT_URI = import.meta.env.VITE_MP_REDIRECT_URI || 'https://api.piru.app/api/mp/callback'

// ─────────────────────────────────────────────
// Small helper: row toggle for feature switches
// ─────────────────────────────────────────────
function ToggleRow({
  icon,
  iconBg,
  title,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  icon: React.ReactNode
  iconBg: string
  title: string
  description: string
  checked: boolean
  onCheckedChange: () => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`shrink-0 h-9 w-9 rounded-lg flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{title}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  )
}

// ─────────────────────────────────────────────
// Integration Status Card wrapper
// ─────────────────────────────────────────────
function IntegrationCard({
  connected,
  accentClass,
  children,
}: {
  connected: boolean
  accentClass: string
  children: React.ReactNode
}) {
  return (
    <Card
      className={`border transition-colors ${connected
        ? `${accentClass} dark:border-opacity-40`
        : 'border-zinc-200 dark:border-zinc-800'
        }`}
    >
      {children}
    </Card>
  )
}

const Perfil = () => {
  const navigate = useNavigate()
  const logout = useAuthStore((state) => state.logout)
  const token = useAuthStore((state) => state.token)
  const restauranteStore = useRestauranteStore()
  const { restaurante, isLoading } = restauranteStore

  // Estados del modal de edición
  const [dialogAbierto, setDialogAbierto] = useState(false)
  const [dialogTab, setDialogTab] = useState('info')
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
  const [activeTab, setActiveTab] = useState('general')

  // Estados de carga para diferentes acciones
  const [isDisconnectingMP, setIsDisconnectingMP] = useState(false)
  const [isTogglingDisenoAlternativo, setIsTogglingDisenoAlternativo] = useState(false)
  const [isTogglingOrderGroupEnabled, setIsTogglingOrderGroupEnabled] = useState(false)
  const [isTogglingCodigoDescuentoEnabled, setIsTogglingCodigoDescuentoEnabled] = useState(false)
  const [isTogglingCardsPaymentsEnabled, setIsTogglingCardsPaymentsEnabled] = useState(false)
  const [isTogglingCucuruCheckoutEnabled, setIsTogglingCucuruCheckoutEnabled] = useState(false)
  const [isConfiguringCucuru, setIsConfiguringCucuru] = useState(false)
  const [isReenviandoWebhookCucuru, setIsReenviandoWebhookCucuru] = useState(false)
  const [cucuruApiKey, setCucuruApiKey] = useState('')
  const [cucuruCollectorId, setCucuruCollectorId] = useState('')
  const [isConfiguringRapiboy, setIsConfiguringRapiboy] = useState(false)
  const [rapiboyToken, setRapiboyToken] = useState('')
  const [isConfiguringTalo, setIsConfiguringTalo] = useState(false)
  const [taloClientIdInput, setTaloClientIdInput] = useState('')
  const [taloClientSecretInput, setTaloClientSecretInput] = useState('')
  const [taloUserIdInput, setTaloUserIdInput] = useState('')
  const [isSavingPasarela, setIsSavingPasarela] = useState(false)
  const [proveedorPago, setProveedorPago] = useState<string>(
    (restaurante as any)?.proveedorPago || 'manual'
  )
  const [taloClientId, setTaloClientId] = useState('')
  const [taloClientSecret, setTaloClientSecret] = useState('')
  const [taloUserId, setTaloUserId] = useState('')

  // Tauri Printer State
  const { printers, selectedPrinter, setSelectedPrinter, refreshPrinters, printRaw } = usePrinter()
  const [isListingPrinters, setIsListingPrinters] = useState(false)
  const [isPrintingTest, setIsPrintingTest] = useState(false)

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
      console.error('Error guardando horarios:', error)
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

  useEffect(() => {
    const prov = (restaurante as any)?.proveedorPago
    if (prov && ['cucuru', 'talo', 'mercadopago', 'manual'].includes(prov)) {
      setProveedorPago(prov)
    }
  }, [restaurante])

  // Manejar callback de MercadoPago
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
      console.error('Error al desconectar MP:', error)
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

  const handleConfigurarRapiboy = async () => {
    if (!token) return
    if (!rapiboyToken.trim()) {
      toast.error('Debes ingresar el Token de Rapiboy')
      return
    }
    setIsConfiguringRapiboy(true)
    try {
      const response = (await restauranteApi.configurarRapiboy(token, rapiboyToken)) as {
        success: boolean
      }
      if (response.success) {
        toast.success('Rapiboy configurado con éxito', {
          description: 'Tu sistema ahora puede gestionar la logística de envíos mediante Rapiboy.',
        })
        restauranteStore.fetchData()
        setRapiboyToken('')
      }
    } catch (error) {
      console.error('Error al configurar Rapiboy:', error)
      toast.error('Error al configurar Rapiboy')
    } finally {
      setIsConfiguringRapiboy(false)
    }
  }

  const handleConfigurarTalo = async () => {
    if (!token) return
    if (!taloClientIdInput.trim() || !taloClientSecretInput.trim() || !taloUserIdInput.trim()) {
      toast.error('Debes ingresar Client ID, Client Secret y User ID de Talo')
      return
    }
    setIsConfiguringTalo(true)
    try {
      const response = (await restauranteApi.configurarTalo(
        token,
        taloClientIdInput.trim(),
        taloClientSecretInput.trim(),
        taloUserIdInput.trim()
      )) as { success: boolean }
      if (response.success) {
        toast.success('Talo configurado con éxito', {
          description: 'Tus credenciales de Talo están listas para transferencias en tiempo real.',
        })
        restauranteStore.fetchData()
        setTaloClientIdInput('')
        setTaloClientSecretInput('')
        setTaloUserIdInput('')
      }
    } catch (error) {
      console.error('Error al configurar Talo:', error)
      toast.error('Error al configurar Talo')
    } finally {
      setIsConfiguringTalo(false)
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
      console.error('Error al configurar cuenta Cucuru:', error)
      toast.error('Error al configurar la Billetera Virtual')
    } finally {
      setIsConfiguringCucuru(false)
    }
  }

  const taloYaConfigurado =
    !!(restaurante as any)?.taloClientId &&
    !!(restaurante as any)?.taloClientSecret &&
    !!(restaurante as any)?.taloUserId

  const handleGuardarPasarelaPago = async () => {
    if (!token) return
    if (
      proveedorPago === 'talo' &&
      !taloYaConfigurado &&
      (!taloClientId.trim() || !taloClientSecret.trim() || !taloUserId.trim())
    ) {
      toast.error('Para usar Talo debes ingresar Client ID, Client Secret y User ID')
      return
    }
    setIsSavingPasarela(true)
    try {
      const payload: Record<string, unknown> = {
        proveedorPago: proveedorPago as 'cucuru' | 'talo' | 'mercadopago' | 'manual',
      }
      if (proveedorPago === 'talo') {
        if (taloClientId.trim() && taloClientSecret.trim() && taloUserId.trim()) {
          payload.taloClientId = taloClientId.trim()
          payload.taloClientSecret = taloClientSecret.trim()
          payload.taloUserId = taloUserId.trim()
        }
      } else {
        payload.taloClientId = null
        payload.taloClientSecret = null
        payload.taloUserId = null
      }
      const response = (await restauranteApi.updatePasarelaPago(token, payload)) as {
        success: boolean
      }
      if (response.success) {
        toast.success('Pasarela de pago actualizada', {
          description: `Proveedor configurado: ${proveedorPago === 'manual'
            ? 'Manual'
            : proveedorPago === 'talo'
              ? 'Talo'
              : proveedorPago === 'cucuru'
                ? 'Cucuru'
                : 'MercadoPago'
            }`,
        })
        restauranteStore.fetchData()
        if (proveedorPago === 'talo') {
          setTaloClientId('')
          setTaloClientSecret('')
          setTaloUserId('')
        }
      }
    } catch (error) {
      console.error('Error al guardar pasarela de pago:', error)
      if (error instanceof ApiError) {
        toast.error('Error al guardar', { description: error.message })
      } else {
        toast.error('Error de conexión')
      }
    } finally {
      setIsSavingPasarela(false)
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
      console.error('Error al reenviar webhook Cucuru:', error)
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
      console.error('Error al cambiar pedido entre amigos:', error)
      toast.error('Error al cambiar la configuración')
    } finally {
      setIsTogglingOrderGroupEnabled(false)
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
      console.error('Error al cambiar códigos de descuento:', error)
      toast.error('Error al cambiar la configuración')
    } finally {
      setIsTogglingCodigoDescuentoEnabled(false)
    }
  }

  const handleToggleCardsPaymentsEnabled = async () => {
    if (!token) return
    setIsTogglingCardsPaymentsEnabled(true)
    try {
      const response = (await restauranteApi.toggleCardsPaymentsEnabled(token)) as {
        success: boolean
        cardsPaymentsEnabled: boolean
      }
      if (response.success) {
        toast.success(
          response.cardsPaymentsEnabled ? 'Tarjeta visible en checkout' : 'Tarjeta oculta en checkout'
        )
        restauranteStore.fetchData()
      }
    } catch (error) {
      console.error('Error al cambiar visibilidad de tarjeta:', error)
      toast.error('Error al cambiar la configuración')
    } finally {
      setIsTogglingCardsPaymentsEnabled(false)
    }
  }

  const handleToggleCucuruCheckoutEnabled = async () => {
    if (!token) return
    setIsTogglingCucuruCheckoutEnabled(true)
    try {
      const response = (await restauranteApi.toggleCucuruEnabled(token)) as {
        success: boolean
        cucuruEnabled: boolean
      }
      if (response.success) {
        toast.success(
          response.cucuruEnabled ? 'Transferencia visible en checkout' : 'Transferencia oculta en checkout'
        )
        restauranteStore.fetchData()
      }
    } catch (error) {
      console.error('Error al cambiar visibilidad de transferencia:', error)
      toast.error('Error al cambiar la configuración')
    } finally {
      setIsTogglingCucuruCheckoutEnabled(false)
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
      console.error('Error al cambiar diseño alternativo:', error)
      toast.error('Error al cambiar la configuración de diseño')
    } finally {
      setIsTogglingDisenoAlternativo(false)
    }
  }

  const abrirDialogEditar = () => {
    if (restaurante) {
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
      setDialogTab('info')
      setDialogAbierto(true)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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

      if (Object.keys(updateData).length === 0) {
        toast.info('No hay cambios para guardar')
        setDialogAbierto(false)
        return
      }
      const response = (await restauranteApi.update(token, updateData)) as { success: boolean }
      if (response.success) {
        toast.success('Perfil actualizado correctamente')
        await restauranteStore.fetchData()
        setDialogAbierto(false)
      }
    } catch (error) {
      console.error('Error al actualizar perfil:', error)
      if (error instanceof ApiError) {
        toast.error('Error al guardar', { description: error.message })
      } else {
        toast.error('Error de conexión')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  const copyLink = () => {
    if (restaurante?.username) {
      navigator.clipboard.writeText(`https://my.piru.app/${restaurante.username}`)
      toast.success('Link copiado al portapapeles')
    }
  }

  // ─────────────────────────────────────────────
  // Loading state
  // ─────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
          <p className="text-sm text-zinc-500">Cargando perfil…</p>
        </div>
      </div>
    )
  }

  const TABS = [
    { value: 'general', icon: Store, label: 'General' },
    { value: 'pagos', icon: CreditCard, label: 'Pagos' },
    { value: 'delivery', icon: Truck, label: 'Delivery' },
    { value: 'experiencia', icon: Palette, label: 'Experiencia' },
    { value: 'hardware', icon: Printer, label: 'Hardware' },
  ]

  const productosActivos = restauranteStore.productos.filter((p) => p.activo).length
  const totalProductos = restauranteStore.productos.length

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-24">

      {/* ── Hero Header ── */}
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        {/* Orange banner */}
        <div className="h-24 sm:h-28 bg-linear-to-r from-orange-600 via-orange-500 to-orange-400 relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg,#000 0,#000 1px,transparent 0,transparent 40px),repeating-linear-gradient(90deg,#000 0,#000 1px,transparent 0,transparent 40px)',
            }}
          />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Profile row — overlaps banner */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-5 -mt-10 sm:-mt-12">
            {/* Avatar + name */}
            <div className="flex items-end gap-4 pt-4 md:pt-8">
              <div className="relative shrink-0">
                <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl bg-white dark:bg-zinc-900 shadow-xl ring-4 ring-white dark:ring-zinc-900 overflow-hidden">
                  {restaurante?.imagenUrl ? (
                    <img
                      src={restaurante.imagenUrl}
                      alt={restaurante.nombre}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-linear-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                      <Store className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1 ring-2 ring-white dark:ring-zinc-900">
                  <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                </div>
              </div>

              <div className="pb-1">
                <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
                  {restaurante?.nombre}
                </h1>
                <div className="flex items-center gap-1.5 mt-1 text-zinc-500 dark:text-zinc-400">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-xs sm:text-sm truncate max-w-[200px] sm:max-w-none">
                    {restaurante?.email}
                  </span>
                </div>
                {restaurante?.createdAt && (
                  <p className="text-xs text-zinc-400 mt-0.5 hidden sm:block">
                    Miembro desde {formatDate(restaurante.createdAt)}
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pb-1 self-end sm:self-auto">
              <PWAInstallButton />
              <Button
                variant="outline"
                size="sm"
                onClick={abrirDialogEditar}
                className="gap-2 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <Edit className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Editar perfil</span>
                <span className="sm:hidden">Editar</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="gap-2 text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Cerrar sesión</span>
              </Button>
            </div>
          </div>

          {/* Link in Bio pill */}
          {restaurante?.username && (
            <div className="pb-5 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl max-w-fit group">
                <Globe className="h-3.5 w-3.5 text-orange-600 shrink-0" />
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  my.piru.app/{restaurante.username}
                </span>
                <button
                  onClick={copyLink}
                  className="text-zinc-400 hover:text-orange-600 transition-colors ml-0.5"
                  title="Copiar link"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <a
                  href={`https://my.piru.app/${restaurante.username}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-zinc-400 hover:text-orange-600 transition-colors"
                  title="Abrir link"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              <span className="text-xs text-zinc-400">Tu link de pedidos online · compartí esto en Instagram</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">

          {/* Tab bar */}
          <div className="-mx-4 px-4 overflow-x-auto scrollbar-none">
            <TabsList className="inline-flex min-w-max w-full sm:w-auto bg-transparent p-0 border-b border-zinc-200 dark:border-zinc-800 rounded-none h-auto gap-0">
              {TABS.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="
                    relative flex items-center gap-2 px-3 sm:px-4 py-3 text-sm font-medium rounded-none
                    text-zinc-500 dark:text-zinc-400 bg-transparent shadow-none
                    hover:text-zinc-900 dark:hover:text-zinc-100
                    data-[state=active]:text-orange-600 dark:data-[state=active]:text-orange-500
                    data-[state=active]:shadow-none
                    after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5
                    after:bg-orange-600 after:rounded-full after:opacity-0
                    data-[state=active]:after:opacity-100
                    transition-all whitespace-nowrap
                  "
                >
                  <tab.icon className="h-4 w-4 shrink-0" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* ─────────────────────────────────────────────
              TAB: GENERAL
          ───────────────────────────────────────────── */}
          <TabsContent value="general" className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-2">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* Business info */}
              <Card className="lg:col-span-2 border-zinc-200 dark:border-zinc-800">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Store className="h-4 w-4 text-orange-600" />
                        Información del negocio
                      </CardTitle>
                      <CardDescription className="mt-0.5">
                        Datos visibles para tus clientes
                      </CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" onClick={abrirDialogEditar} className="gap-1.5 text-zinc-500 hover:text-orange-600">
                      <Edit className="h-3.5 w-3.5" />
                      Editar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-0">
                  {[
                    { icon: Store, label: 'Nombre', value: restaurante?.nombre },
                    { icon: Link2, label: 'Alias / URL', value: restaurante?.username ? `my.piru.app/${restaurante.username}` : undefined },
                    { icon: MapPin, label: 'Dirección', value: restaurante?.direccion },
                    { icon: Phone, label: 'Teléfono', value: restaurante?.telefono },
                    { icon: Truck, label: 'Costo de envío', value: restaurante?.deliveryFee ? `$${restaurante.deliveryFee}` : undefined },
                  ].map(({ icon: Icon, label, value }) => (
                    <div
                      key={label}
                      className="flex items-center gap-3 py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                    >
                      <Icon className="h-4 w-4 text-zinc-400 shrink-0" />
                      <span className="text-xs text-zinc-400 w-24 shrink-0">{label}</span>
                      <span className={`text-sm font-medium ${value ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 italic'}`}>
                        {value || 'No configurado'}
                      </span>
                    </div>
                  ))}

                  <Separator className="my-2" />

                  {/* WhatsApp status */}
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <Smartphone className="h-4 w-4 text-green-600 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Notificaciones WhatsApp</p>
                        {restaurante?.whatsappEnabled && restaurante.whatsappNumber && (
                          <p className="text-xs text-zinc-500 mt-0.5">{restaurante.whatsappNumber}</p>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant={restaurante?.whatsappEnabled ? 'default' : 'secondary'}
                      className={restaurante?.whatsappEnabled ? 'bg-green-600 hover:bg-green-600' : ''}
                    >
                      {restaurante?.whatsappEnabled ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>

                  {restaurante?.transferenciaAlias && (
                    <div className="flex items-center gap-3 py-3 border-t border-zinc-100 dark:border-zinc-800">
                      <Wallet className="h-4 w-4 text-zinc-400 shrink-0" />
                      <span className="text-xs text-zinc-400 w-24 shrink-0">Alias CVU</span>
                      <code className="text-sm font-mono text-zinc-900 dark:text-zinc-100">
                        {restaurante.transferenciaAlias}
                      </code>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Right column: Stats + Quick nav */}
              <div className="space-y-4">
                {/* Stats */}
                <Card className="border-0 bg-linear-to-br from-orange-600 to-orange-500 text-white overflow-hidden">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm font-medium text-orange-100">Catálogo</p>
                      <Package className="h-4 w-4 text-orange-200" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-3xl font-bold tabular-nums">{productosActivos}</p>
                        <p className="text-xs text-orange-200 mt-0.5">Activos</p>
                      </div>
                      <div>
                        <p className="text-3xl font-bold tabular-nums">{totalProductos}</p>
                        <p className="text-xs text-orange-200 mt-0.5">Total</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick links */}
                <Card className="border-zinc-200 dark:border-zinc-800">
                  <CardContent className="p-0">
                    {[
                      { label: 'Configurar pagos', desc: 'Integraciones y pasarelas', tab: 'pagos', icon: CreditCard },
                      { label: 'Horarios y delivery', desc: 'Turnos y zonas de envío', tab: 'delivery', icon: Clock },
                      { label: 'Personalizar menú', desc: 'Diseño y funcionalidades', tab: 'experiencia', icon: Palette },
                    ].map(({ label, desc, tab, icon: Icon }, i, arr) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group ${i < arr.length - 1 ? 'border-b border-zinc-100 dark:border-zinc-800' : ''}`}
                      >
                        <div className="h-8 w-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 group-hover:bg-orange-50 dark:group-hover:bg-orange-950/30 transition-colors">
                          <Icon className="h-4 w-4 text-zinc-500 group-hover:text-orange-600 transition-colors" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{label}</p>
                          <p className="text-xs text-zinc-500 truncate">{desc}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-zinc-300 group-hover:text-orange-500 transition-colors shrink-0" />
                      </button>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ─────────────────────────────────────────────
              TAB: PAGOS
          ───────────────────────────────────────────── */}
          <TabsContent value="pagos" className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-2">

            {/* Provider selector */}
            <Card className="border-zinc-200 dark:border-zinc-800">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="h-4 w-4 text-orange-600" />
                  Proveedor de cobros principal
                </CardTitle>
                <CardDescription>Cómo validás automáticamente los pagos de tus clientes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { value: 'manual', label: 'Manual', sub: 'Sin validación', color: 'zinc' },
                    { value: 'cucuru', label: 'Cucuru', sub: 'Billetera virtual', color: 'purple' },
                    { value: 'talo', label: 'Talo', sub: 'Tiempo real', color: 'amber' },
                    { value: 'mercadopago', label: 'MercadoPago', sub: 'Tarjetas', color: 'sky' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setProveedorPago(opt.value)}
                      className={`rounded-xl border-2 p-3 text-left transition-all ${proveedorPago === opt.value
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20'
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                        }`}
                    >
                      <div className={`h-2 w-2 rounded-full mb-2 ${proveedorPago === opt.value ? 'bg-orange-500' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{opt.label}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{opt.sub}</p>
                    </button>
                  ))}
                </div>

                {proveedorPago === 'talo' && !taloYaConfigurado && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl space-y-3">
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-100">Credenciales de Talo</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <Input type="password" placeholder="Client ID" value={taloClientId} onChange={(e) => setTaloClientId(e.target.value)} className="text-sm" />
                      <Input type="password" placeholder="Client Secret" value={taloClientSecret} onChange={(e) => setTaloClientSecret(e.target.value)} className="text-sm" />
                      <Input placeholder="User ID" value={taloUserId} onChange={(e) => setTaloUserId(e.target.value)} className="text-sm" />
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleGuardarPasarelaPago}
                  disabled={isSavingPasarela}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  {isSavingPasarela && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar configuración
                </Button>
              </CardContent>
            </Card>

            {/* Integrations grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* MercadoPago */}
              <IntegrationCard connected={!!restaurante?.mpConnected} accentClass="border-sky-400/60 bg-sky-50/40 dark:bg-sky-950/10">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-sky-100 dark:bg-sky-900/50 flex items-center justify-center">
                        <CreditCard className="h-4 w-4 text-sky-600" />
                      </div>
                      MercadoPago
                    </CardTitle>
                    <Badge className={restaurante?.mpConnected ? 'bg-sky-600 hover:bg-sky-600 text-white' : ''} variant={restaurante?.mpConnected ? 'default' : 'secondary'}>
                      {restaurante?.mpConnected ? 'Conectado' : 'Desconectado'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {restaurante?.mpConnected ? (
                    <>
                      <div className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-100 dark:border-zinc-800">
                        <div>
                          <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Cuenta activa</p>
                          <p className="text-xs text-zinc-400 mt-0.5">ID: {restaurante.mpUserId}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-500">Visible</span>
                          <Switch
                            checked={(restaurante as any)?.cardsPaymentsEnabled !== false}
                            onCheckedChange={handleToggleCardsPaymentsEnabled}
                            disabled={isTogglingCardsPaymentsEnabled}
                          />
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="w-full text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30 dark:border-red-900" onClick={handleDesconectarMP} disabled={isDisconnectingMP}>
                        {isDisconnectingMP ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Unlink className="mr-2 h-3.5 w-3.5" />}
                        Desconectar
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-zinc-500">Tarjetas de crédito, débito y dinero en cuenta.</p>
                      <Button asChild size="sm" className="w-full bg-sky-500 hover:bg-sky-600 text-white">
                        <a href={getMercadoPagoAuthUrl() || '#'}>
                          <Link2 className="mr-2 h-3.5 w-3.5" />
                          Conectar MercadoPago
                        </a>
                      </Button>
                    </>
                  )}
                </CardContent>
              </IntegrationCard>

              {/* Cucuru */}
              <IntegrationCard connected={!!(restaurante as any)?.cucuruConfigurado} accentClass="border-purple-400/60 bg-purple-50/40 dark:bg-purple-950/10">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                        <Wallet className="h-4 w-4 text-purple-600" />
                      </div>
                      Cucuru
                    </CardTitle>
                    <Badge className={(restaurante as any)?.cucuruConfigurado ? 'bg-purple-600 hover:bg-purple-600 text-white' : ''} variant={(restaurante as any)?.cucuruConfigurado ? 'default' : 'secondary'}>
                      {(restaurante as any)?.cucuruConfigurado ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">Mostrar en checkout</span>
                    <Switch checked={(restaurante as any)?.cucuruEnabled !== false} onCheckedChange={handleToggleCucuruCheckoutEnabled} disabled={isTogglingCucuruCheckoutEnabled} />
                  </div>
                  {(restaurante as any)?.cucuruConfigurado ? (
                    <>
                      <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400 p-2 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-900">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        Webhooks configurados correctamente
                      </div>
                      <Button variant="outline" size="sm" className="w-full" onClick={handleReenviarWebhookCucuru} disabled={isReenviandoWebhookCucuru}>
                        {isReenviandoWebhookCucuru ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
                        Reenviar webhook
                      </Button>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <Input placeholder="API Key" value={cucuruApiKey} onChange={(e) => setCucuruApiKey(e.target.value)} className="text-sm" />
                      <Input placeholder="Collector ID" value={cucuruCollectorId} onChange={(e) => setCucuruCollectorId(e.target.value)} className="text-sm" />
                      <Button size="sm" className="w-full bg-purple-600 hover:bg-purple-700 text-white" onClick={handleConfigurarCucuru} disabled={isConfiguringCucuru}>
                        {isConfiguringCucuru && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                        Configurar
                      </Button>
                    </div>
                  )}
                </CardContent>
              </IntegrationCard>

              {/* Talo */}
              <IntegrationCard connected={taloYaConfigurado} accentClass="border-amber-400/60 bg-amber-50/40 dark:bg-amber-950/10">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                        <Zap className="h-4 w-4 text-amber-600" />
                      </div>
                      Talo
                    </CardTitle>
                    <Badge className={taloYaConfigurado ? 'bg-amber-600 hover:bg-amber-600 text-white' : ''} variant={taloYaConfigurado ? 'default' : 'secondary'}>
                      {taloYaConfigurado ? 'Configurado' : 'Sin configurar'}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">Transferencias verificadas en tiempo real</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Input type="password" placeholder="Client ID" value={taloClientIdInput} onChange={(e) => setTaloClientIdInput(e.target.value)} className="text-sm" />
                  <Input type="password" placeholder="Client Secret" value={taloClientSecretInput} onChange={(e) => setTaloClientSecretInput(e.target.value)} className="text-sm" />
                  <Input placeholder="User ID" value={taloUserIdInput} onChange={(e) => setTaloUserIdInput(e.target.value)} className="text-sm" />
                  <Button size="sm" className="w-full bg-amber-600 hover:bg-amber-700 text-white" onClick={handleConfigurarTalo} disabled={isConfiguringTalo}>
                    {isConfiguringTalo && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                    {taloYaConfigurado ? 'Actualizar credenciales' : 'Configurar Talo'}
                  </Button>
                </CardContent>
              </IntegrationCard>

              {/* Transferencia manual */}
              <Card className="border-zinc-200 dark:border-zinc-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                      <Wallet className="h-4 w-4 text-zinc-500" />
                    </div>
                    Transferencia manual
                  </CardTitle>
                  <CardDescription className="text-xs">Alias para cuando el cliente paga por transferencia</CardDescription>
                </CardHeader>
                <CardContent>
                  {restaurante?.transferenciaAlias ? (
                    <div className="flex items-center gap-2 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                      <code className="text-sm font-mono text-zinc-900 dark:text-zinc-100">
                        {restaurante.transferenciaAlias}
                      </code>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700">
                      <AlertCircle className="h-4 w-4 text-zinc-400 shrink-0" />
                      <p className="text-sm text-zinc-400">Sin alias configurado</p>
                    </div>
                  )}
                  <Button variant="link" size="sm" className="px-0 mt-2 text-orange-600 h-auto" onClick={abrirDialogEditar}>
                    {restaurante?.transferenciaAlias ? 'Modificar alias' : 'Configurar alias'}
                    <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Discount codes */}
            <Card className="border-zinc-200 dark:border-zinc-800">
              <CardContent className="px-5 py-4">
                <ToggleRow
                  icon={<Ticket className="h-4 w-4 text-indigo-600" />}
                  iconBg="bg-indigo-50 dark:bg-indigo-950/50"
                  title="Códigos de descuento"
                  description="Permite a los clientes aplicar cupones en el checkout"
                  checked={(restaurante as any)?.codigoDescuentoEnabled !== false}
                  onCheckedChange={handleToggleCodigoDescuentoEnabled}
                  disabled={isTogglingCodigoDescuentoEnabled}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─────────────────────────────────────────────
              TAB: DELIVERY
          ───────────────────────────────────────────── */}
          <TabsContent value="delivery" className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-2">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* Horarios */}
              <Card className="lg:col-span-2 border-zinc-200 dark:border-zinc-800">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4 text-orange-600" />
                    Horarios de atención
                  </CardTitle>
                  <CardDescription>
                    Configurá los turnos de cada día. Sin turnos = cerrado ese día.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!horariosLoaded ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {DIAS_SEMANA.map((nombreDia, diaIdx) => {
                        const turnos = horarios[diaIdx] || []
                        const estaAbierto = turnos.length > 0
                        return (
                          <div
                            key={diaIdx}
                            className={`rounded-xl p-3 transition-colors ${estaAbierto ? 'bg-zinc-50 dark:bg-zinc-900/50' : 'opacity-60'}`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                              <div className="flex items-center gap-2 sm:w-28 shrink-0">
                                <div className={`h-2 w-2 rounded-full shrink-0 ${estaAbierto ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
                                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{nombreDia}</span>
                              </div>

                              <div className="flex-1 flex flex-col gap-2">
                                {turnos.length === 0 ? (
                                  <span className="text-xs text-zinc-400 italic py-1">Cerrado</span>
                                ) : (
                                  turnos.map((turno, tIdx) => (
                                    <div key={tIdx} className="flex items-center gap-2">
                                      <Input
                                        type="time"
                                        value={turno.horaApertura}
                                        onChange={(e) => actualizarTurno(diaIdx, tIdx, 'horaApertura', e.target.value)}
                                        className="h-8 w-28 text-xs"
                                      />
                                      <span className="text-zinc-400 text-xs">→</span>
                                      <Input
                                        type="time"
                                        value={turno.horaCierre}
                                        onChange={(e) => actualizarTurno(diaIdx, tIdx, 'horaCierre', e.target.value)}
                                        className="h-8 w-28 text-xs"
                                      />
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                                        onClick={() => eliminarTurno(diaIdx, tIdx)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  ))
                                )}
                              </div>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => agregarTurno(diaIdx)}
                                className="h-7 text-xs shrink-0 self-start sm:self-auto"
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Turno
                              </Button>
                            </div>
                          </div>
                        )
                      })}

                      <div className="pt-3">
                        <Button
                          onClick={guardarHorarios}
                          disabled={isSavingHorarios}
                          className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                        >
                          {isSavingHorarios && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Guardar horarios
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Rapiboy */}
              <IntegrationCard connected={!!(restaurante as any)?.rapiboyToken} accentClass="border-orange-400/60 bg-orange-50/40 dark:bg-orange-950/10">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
                        <Truck className="h-4 w-4 text-orange-600" />
                      </div>
                      Rapiboy
                    </CardTitle>
                    <Badge className={(restaurante as any)?.rapiboyToken ? 'bg-orange-600 hover:bg-orange-600 text-white' : ''} variant={(restaurante as any)?.rapiboyToken ? 'default' : 'secondary'}>
                      {(restaurante as any)?.rapiboyToken ? 'Configurado' : 'Sin configurar'}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">Logística de envíos automatizada</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    type="password"
                    placeholder="Token de Rapiboy"
                    value={rapiboyToken}
                    onChange={(e) => setRapiboyToken(e.target.value)}
                    className="text-sm"
                  />
                  <div className="p-2.5 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900">
                    <p className="text-xs text-blue-700 dark:text-blue-300 mb-1 font-medium">Webhook URL</p>
                    <code className="text-xs font-mono text-blue-600 dark:text-blue-400 break-all">
                      https://api.piru.app/api/webhooks/rapiboy
                    </code>
                  </div>
                  <Button
                    size="sm"
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                    onClick={handleConfigurarRapiboy}
                    disabled={isConfiguringRapiboy || !rapiboyToken.trim()}
                  >
                    {isConfiguringRapiboy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                    {(restaurante as any)?.rapiboyToken ? 'Actualizar token' : 'Guardar token'}
                  </Button>
                </CardContent>
              </IntegrationCard>
            </div>

            {/* Zonas de delivery */}
            <Suspense
              fallback={
                <Card className="border-zinc-200 dark:border-zinc-800">
                  <CardContent className="flex items-center justify-center py-16">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                      <p className="text-sm text-zinc-400">Cargando mapa…</p>
                    </div>
                  </CardContent>
                </Card>
              }
            >
              <ZonasDeliveryMap />
            </Suspense>
          </TabsContent>

          {/* ─────────────────────────────────────────────
              TAB: EXPERIENCIA
          ───────────────────────────────────────────── */}
          <TabsContent value="experiencia" className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-2">

            {/* Design picker */}
            <Card className="border-zinc-200 dark:border-zinc-800">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Palette className="h-4 w-4 text-pink-600" />
                  Diseño del menú
                </CardTitle>
                <CardDescription>Cómo se ven los productos cuando tus clientes abren tu link</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {/* Option: Glassmorphism */}
                  <button
                    onClick={() => restaurante?.disenoAlternativo && handleToggleDisenoAlternativo()}
                    disabled={isTogglingDisenoAlternativo && !restaurante?.disenoAlternativo}
                    className={`relative rounded-2xl border-2 p-4 text-left transition-all hover:shadow-sm ${!restaurante?.disenoAlternativo
                      ? 'border-orange-500 shadow-sm shadow-orange-100 dark:shadow-orange-950'
                      : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                  >
                    {!restaurante?.disenoAlternativo && (
                      <div className="absolute top-2 right-2">
                        <CheckCircle2 className="h-4 w-4 text-orange-500" />
                      </div>
                    )}
                    {/* Preview */}
                    <div className="aspect-video rounded-lg overflow-hidden mb-3 bg-linear-to-br from-zinc-800 to-zinc-900 relative">
                      <div className="absolute inset-0 bg-linear-to-br from-orange-500/20 to-transparent" />
                      <div className="absolute bottom-2 left-2 right-2 h-10 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20" />
                      <div className="absolute bottom-3 left-3 h-1.5 w-16 bg-white/60 rounded-full" />
                      <div className="absolute bottom-6 left-3 h-1 w-10 bg-white/30 rounded-full" />
                    </div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Glassmorphism</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Diseño premium original</p>
                  </button>

                  {/* Option: Full image */}
                  <button
                    onClick={() => !restaurante?.disenoAlternativo && handleToggleDisenoAlternativo()}
                    disabled={isTogglingDisenoAlternativo && !!restaurante?.disenoAlternativo}
                    className={`relative rounded-2xl border-2 p-4 text-left transition-all hover:shadow-sm ${restaurante?.disenoAlternativo
                      ? 'border-orange-500 shadow-sm shadow-orange-100 dark:shadow-orange-950'
                      : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                  >
                    {restaurante?.disenoAlternativo && (
                      <div className="absolute top-2 right-2">
                        <CheckCircle2 className="h-4 w-4 text-orange-500" />
                      </div>
                    )}
                    {/* Preview */}
                    <div className="aspect-video rounded-lg overflow-hidden mb-3 bg-zinc-100 dark:bg-zinc-800 relative">
                      <div className="absolute inset-0 bg-linear-to-br from-zinc-300 to-zinc-400 dark:from-zinc-700 dark:to-zinc-600" />
                      <div className="absolute bottom-0 left-0 right-0 p-2 bg-white dark:bg-zinc-900">
                        <div className="h-2 w-14 bg-zinc-900/20 dark:bg-zinc-100/20 rounded-full" />
                        <div className="h-1.5 w-20 bg-zinc-400/30 rounded-full mt-1" />
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Imagen completa</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Destaca tus fotos</p>
                  </button>
                </div>

                {isTogglingDisenoAlternativo && (
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Aplicando cambios…
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Feature toggles */}
            <Card className="border-zinc-200 dark:border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="h-4 w-4 text-zinc-600" />
                  Funcionalidades
                </CardTitle>
                <CardDescription>Activá o desactivá características del menú online</CardDescription>
              </CardHeader>
              <CardContent className="divide-y divide-zinc-100 dark:divide-zinc-800 px-5">
                <ToggleRow
                  icon={<UtensilsCrossed className="h-4 w-4 text-teal-600" />}
                  iconBg="bg-teal-50 dark:bg-teal-950/50"
                  title="Pedido entre amigos"
                  description="Los clientes pueden armar pedidos grupales compartiendo un link"
                  checked={(restaurante as any)?.orderGroupEnabled !== false}
                  onCheckedChange={handleToggleOrderGroupEnabled}
                  disabled={isTogglingOrderGroupEnabled}
                />
                <ToggleRow
                  icon={<Ticket className="h-4 w-4 text-indigo-600" />}
                  iconBg="bg-indigo-50 dark:bg-indigo-950/50"
                  title="Códigos de descuento"
                  description="Permite aplicar cupones durante el checkout"
                  checked={(restaurante as any)?.codigoDescuentoEnabled !== false}
                  onCheckedChange={handleToggleCodigoDescuentoEnabled}
                  disabled={isTogglingCodigoDescuentoEnabled}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─────────────────────────────────────────────
              TAB: HARDWARE
          ───────────────────────────────────────────── */}
          <TabsContent value="hardware" className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-2">
            <Card className="border-zinc-200 dark:border-zinc-800">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Printer className="h-4 w-4 text-green-600" />
                  Impresora de comandas
                </CardTitle>
                <CardDescription>Impresora térmica para el sistema de cocina</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">

                {/* Status banner */}
                {selectedPrinter ? (
                  <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-xl">
                    <div className="h-9 w-9 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-green-900 dark:text-green-100">Impresora configurada</p>
                      <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">{selectedPrinter}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl">
                    <div className="h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
                      <AlertCircle className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-100">Sin impresora seleccionada</p>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">Escaneá los dispositivos disponibles para comenzar</p>
                    </div>
                  </div>
                )}

                <Separator />

                {/* Scan & select */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={handleListPrinters}
                    disabled={isListingPrinters}
                    className="h-auto py-4 justify-start gap-3"
                  >
                    {isListingPrinters ? (
                      <Loader2 className="h-5 w-5 text-zinc-400 animate-spin shrink-0" />
                    ) : (
                      <List className="h-5 w-5 text-zinc-400 shrink-0" />
                    )}
                    <div className="text-left">
                      <p className="text-sm font-medium">Buscar impresoras</p>
                      <p className="text-xs text-zinc-500">Escanear dispositivos disponibles</p>
                    </div>
                  </Button>

                  {printers.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-zinc-500">Seleccionar impresora</Label>
                      <Select value={selectedPrinter || ''} onValueChange={setSelectedPrinter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar…" />
                        </SelectTrigger>
                        <SelectContent>
                          {printers.map((p, i) => (
                            <SelectItem key={i} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Test print */}
                <Button
                  variant="outline"
                  onClick={handleTestPrint}
                  disabled={isPrintingTest || !selectedPrinter}
                  className="w-full h-auto py-4 border-dashed border-2 gap-3 justify-center"
                >
                  {isPrintingTest ? (
                    <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                  ) : (
                    <Printer className="h-4 w-4 text-zinc-400" />
                  )}
                  <span className="text-sm">Imprimir prueba de comanda</span>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>

      {/* ─────────────────────────────────────────────
          DIALOG: Editar perfil
      ───────────────────────────────────────────── */}
      <Dialog open={dialogAbierto} onOpenChange={setDialogAbierto}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          {/* Dialog header */}
          <div className="px-6 pt-6 pb-4 border-b border-zinc-200 dark:border-zinc-800">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center">
                  <Settings className="h-4 w-4 text-orange-600" />
                </div>
                Editar perfil
              </DialogTitle>
              <DialogDescription className="text-sm text-zinc-500">
                Actualizá la información y personalización de tu negocio
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Internal tabs */}
          <Tabs value={dialogTab} onValueChange={setDialogTab} className="flex flex-col">
            <div className="border-b border-zinc-200 dark:border-zinc-800 px-6">
              <TabsList className="bg-transparent p-0 h-auto gap-6 rounded-none">
                {[
                  { value: 'info', label: 'Información' },
                  { value: 'branding', label: 'Branding' },
                  { value: 'comunicacion', label: 'WhatsApp' },
                ].map((t) => (
                  <TabsTrigger
                    key={t.value}
                    value={t.value}
                    className="
                      relative bg-transparent shadow-none rounded-none px-0 py-3 text-sm font-medium
                      text-zinc-500 data-[state=active]:text-orange-600
                      data-[state=active]:shadow-none
                      after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5
                      after:bg-orange-600 after:rounded-full after:opacity-0
                      data-[state=active]:after:opacity-100
                    "
                  >
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Tab: Información */}
              <TabsContent value="info" className="px-6 py-5 space-y-4 mt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="nombre" className="text-sm">Nombre del negocio <span className="text-red-500">*</span></Label>
                    <Input
                      id="nombre"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      placeholder="Ej: La Esquina Burger"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="username" className="text-sm">Alias URL</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400 pointer-events-none select-none">piru.app/</span>
                      <Input
                        id="username"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        placeholder="mi-negocio"
                        className="pl-[4.8rem]"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="telefono" className="text-sm">Teléfono</Label>
                    <Input
                      id="telefono"
                      value={formData.telefono}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                      placeholder="Ej: 3412345678"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="deliveryFee" className="text-sm">Costo de envío por defecto</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400 pointer-events-none select-none">$</span>
                      <Input
                        id="deliveryFee"
                        type="number"
                        step="0.01"
                        value={formData.deliveryFee}
                        onChange={(e) => setFormData({ ...formData, deliveryFee: e.target.value })}
                        placeholder="0.00"
                        className="pl-6"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="direccion" className="text-sm">Dirección</Label>
                    <Input
                      id="direccion"
                      value={formData.direccion}
                      onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                      placeholder="Ej: Av. Córdoba 1234, Rosario"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="transferenciaAlias" className="text-sm">Alias CVU / transferencia manual</Label>
                    <Input
                      id="transferenciaAlias"
                      value={formData.transferenciaAlias}
                      onChange={(e) => setFormData({ ...formData, transferenciaAlias: e.target.value })}
                      placeholder="Ej: micuenta.mp"
                      className="font-mono"
                    />
                    <p className="text-xs text-zinc-400">Se muestra cuando el cliente elige transferencia manual</p>
                  </div>
                </div>
              </TabsContent>

              {/* Tab: Branding */}
              <TabsContent value="branding" className="px-6 py-5 space-y-5 mt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Logo (modo oscuro)</Label>
                    <ImageUpload onImageChange={setImageBase64} currentImage={imageBase64} maxSize={5} />
                    <p className="text-xs text-zinc-400">Recomendado: PNG transparente sobre fondo oscuro</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Logo (modo claro)</Label>
                    <ImageUpload onImageChange={setImageLightBase64} currentImage={imageLightBase64} maxSize={5} />
                    <p className="text-xs text-zinc-400">Recomendado: PNG transparente sobre fondo claro</p>
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Colores de marca</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="colorPrimario" className="text-sm">Color primario (dark)</Label>
                      <div className="flex gap-2">
                        <Input
                          id="colorPrimario"
                          type="color"
                          className="w-10 h-10 p-1 cursor-pointer rounded-lg border"
                          value={formData.colorPrimario || '#000000'}
                          onChange={(e) => setFormData({ ...formData, colorPrimario: e.target.value })}
                        />
                        <Input
                          value={formData.colorPrimario}
                          onChange={(e) => setFormData({ ...formData, colorPrimario: e.target.value })}
                          className="flex-1 font-mono text-sm"
                          placeholder="#000000"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="colorSecundario" className="text-sm">Color secundario (light)</Label>
                      <div className="flex gap-2">
                        <Input
                          id="colorSecundario"
                          type="color"
                          className="w-10 h-10 p-1 cursor-pointer rounded-lg border"
                          value={formData.colorSecundario || '#ffffff'}
                          onChange={(e) => setFormData({ ...formData, colorSecundario: e.target.value })}
                        />
                        <Input
                          value={formData.colorSecundario}
                          onChange={(e) => setFormData({ ...formData, colorSecundario: e.target.value })}
                          className="flex-1 font-mono text-sm"
                          placeholder="#ffffff"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Tab: WhatsApp / Comunicación */}
              <TabsContent value="comunicacion" className="px-6 py-5 space-y-4 mt-0">
                <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                      <Smartphone className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Notificaciones de pedidos</p>
                      <p className="text-xs text-zinc-500">Recibís un WhatsApp con cada nuevo pedido</p>
                    </div>
                  </div>
                  <Switch
                    checked={formData.whatsappEnabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, whatsappEnabled: checked })}
                  />
                </div>

                {formData.whatsappEnabled && (
                  <div className="space-y-1.5 animate-in fade-in-0 slide-in-from-top-1">
                    <Label className="text-sm">Número de WhatsApp (con código de país)</Label>
                    <Input
                      placeholder="Ej: 5493412345678"
                      value={formData.whatsappNumber}
                      onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                    />
                    <p className="text-xs text-zinc-400">Formato: código país + código área + número. Sin el "+".</p>
                  </div>
                )}

                <Separator />

                <div className="space-y-1.5">
                  <Label htmlFor="comprobantesWhatsapp" className="text-sm">Número para comprobantes (clientes)</Label>
                  <Input
                    id="comprobantesWhatsapp"
                    placeholder="Ej: 5493412345678"
                    value={formData.comprobantesWhatsapp}
                    onChange={(e) => setFormData({ ...formData, comprobantesWhatsapp: e.target.value })}
                  />
                  <p className="text-xs text-zinc-400">
                    Adónde tus clientes envían los comprobantes de pago por transferencia
                  </p>
                </div>
              </TabsContent>

              {/* Footer actions */}
              <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDialogAbierto(false)}
                  disabled={isSubmitting}
                  className="text-zinc-500"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-orange-600 hover:bg-orange-700 text-white gap-2"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Guardar cambios
                </Button>
              </div>
            </form>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Perfil