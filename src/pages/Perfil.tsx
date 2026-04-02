import { useEffect, useState, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router'
import { Card } from '@/components/ui/card'
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
import { cn } from '@/lib/utils'
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
// Estilos base "Phantom"
// ─────────────────────────────────────────────
const phantomCardClass = "bg-white dark:bg-zinc-950 rounded-[32px] shadow-xl shadow-zinc-200/40 dark:shadow-none border border-zinc-100 dark:border-zinc-800/80 overflow-hidden"
const phantomInputClass = "h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border-transparent focus:bg-background focus:border-[#FF7A00] focus:ring-2 focus:ring-[#FF7A00]/20 transition-all text-base px-5 w-full"
const phantomLabelClass = "text-sm font-medium text-foreground ml-1 mb-1.5 block"

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
    <div className="flex items-center justify-between gap-4 py-5 group hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20 transition-colors px-2 -mx-2 rounded-2xl cursor-pointer" onClick={() => !disabled && onCheckedChange()}>
      <div className="flex items-center gap-4 min-w-0">
        <div className={`shrink-0 h-12 w-12 rounded-[18px] flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-base font-semibold text-foreground truncate">{title}</p>
          <p className="text-sm text-muted-foreground truncate">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} onClick={(e) => e.stopPropagation()} />
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
      className={cn(
        "rounded-[32px] border-2 transition-colors",
        connected
          ? accentClass
          : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950"
      )}
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

  // Estados de carga
  const [isDisconnectingMP, setIsDisconnectingMP] = useState(false)
  const [isTogglingDisenoAlternativo, setIsTogglingDisenoAlternativo] = useState(false)
  const [isTogglingOrderGroupEnabled, setIsTogglingOrderGroupEnabled] = useState(false)
  const [isTogglingCodigoDescuentoEnabled, setIsTogglingCodigoDescuentoEnabled] = useState(false)
  const [isTogglingCardsPaymentsEnabled, setIsTogglingCardsPaymentsEnabled] = useState(false)
  const [isTogglingCucuruCheckoutEnabled, setIsTogglingCucuruCheckoutEnabled] = useState(false)
  const [isTogglingNotificarClientesWhatsapp, setIsTogglingNotificarClientesWhatsapp] = useState(false)
  const [isConfiguringCucuru, setIsConfiguringCucuru] = useState(false)
  const [isReenviandoWebhookCucuru, setIsReenviandoWebhookCucuru] = useState(false)
  const [cucuruApiKey, setCucuruApiKey] = useState('')
  const [cucuruCollectorId, setCucuruCollectorId] = useState('')
  // const [isConfiguringTalo, setIsConfiguringTalo] = useState(false)
  // const [taloClientIdInput, setTaloClientIdInput] = useState('')
  // const [taloClientSecretInput, setTaloClientSecretInput] = useState('')
  // const [taloUserIdInput, setTaloUserIdInput] = useState('')
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

    if (restaurante) {
      if ((restaurante as any).taloClientId) setTaloClientId((restaurante as any).taloClientId)
      if ((restaurante as any).taloClientSecret) setTaloClientSecret((restaurante as any).taloClientSecret)
      if ((restaurante as any).taloUserId) setTaloUserId((restaurante as any).taloUserId)
    }
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

  // const handleConfigurarTalo = async () => {
  //   if (!token) return
  //   if (!taloClientIdInput.trim() || !taloClientSecretInput.trim() || !taloUserIdInput.trim()) {
  //     toast.error('Debes ingresar Client ID, Client Secret y User ID de Talo')
  //     return
  //   }
  //   setIsConfiguringTalo(true)
  //   try {
  //     const response = (await restauranteApi.configurarTalo(
  //       token,
  //       taloClientIdInput.trim(),
  //       taloClientSecretInput.trim(),
  //       taloUserIdInput.trim()
  //     )) as { success: boolean }
  //     if (response.success) {
  //       toast.success('Talo configurado con éxito', {
  //         description: 'Tus credenciales de Talo están listas para transferencias en tiempo real.',
  //       })
  //       restauranteStore.fetchData()
  //       setTaloClientIdInput('')
  //       setTaloClientSecretInput('')
  //       setTaloUserIdInput('')
  //     }
  //   } catch (error) {
  //     toast.error('Error al configurar Talo')
  //   } finally {
  //     setIsConfiguringTalo(false)
  //   }
  // }

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

  const handleGuardarPasarelaPago = async () => {
    if (!token) return
    if (
      proveedorPago === 'talo' &&
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
      if (taloClientId.trim() && taloClientSecret.trim() && taloUserId.trim()) {
        payload.taloClientId = taloClientId.trim()
        payload.taloClientSecret = taloClientSecret.trim()
        payload.taloUserId = taloUserId.trim()
      }
      const response = (await restauranteApi.updatePasarelaPago(token, payload)) as {
        success: boolean
      }
      if (response.success) {
        toast.success('Pasarela de pago actualizada')
        restauranteStore.fetchData()
      }
    } catch (error) {
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

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#FF7A00]" />
          <p className="text-sm text-zinc-500 font-medium">Cargando tu espacio…</p>
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

  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-background pb-24 selection:bg-[#FF7A00]/20 selection:text-[#FF7A00]">

      {/* ── Hero Header ── */}
      <div className="bg-white dark:bg-zinc-950/50 border-b border-zinc-200 dark:border-zinc-800/80 pb-6">
        {/* Orange banner */}
        <div className="h-32 sm:h-40 bg-[#FF7A00] relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg,#000 0,#000 1px,transparent 0,transparent 40px),repeating-linear-gradient(90deg,#000 0,#000 1px,transparent 0,transparent 40px)',
            }}
          />
          <div className="absolute inset-0 bg-black/10 mix-blend-overlay" />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-8">
          {/* Profile row — overlaps banner */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 -mt-12 sm:-mt-16">

            <div className="flex flex-col sm:flex-row sm:items-end gap-5">
              <div className="relative shrink-0">
                <div className="h-28 w-28 sm:h-32 sm:w-32 rounded-[28px] bg-white dark:bg-zinc-900 shadow-2xl ring-[6px] ring-white dark:ring-zinc-950 overflow-hidden">
                  {restaurante?.imagenUrl ? (
                    <img
                      src={restaurante.imagenUrl}
                      alt={restaurante.nombre}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-linear-to-br from-orange-400 to-[#FF7A00] flex items-center justify-center">
                      <Store className="h-10 w-10 sm:h-12 sm:w-12 text-white" />
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1.5 ring-4 ring-white dark:ring-zinc-950 shadow-sm">
                  <CheckCircle2 className="h-4 w-4 text-white" />
                </div>
              </div>

              <div className="pb-2">
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                  {restaurante?.nombre}
                </h1>
                <div className="flex items-center gap-2 mt-1.5 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span className="text-sm font-medium">{restaurante?.email}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pb-2 w-full sm:w-auto">
              <PWAInstallButton />
              <Button
                variant="outline"
                onClick={abrirDialogEditar}
                className="flex-1 sm:flex-none h-12 rounded-2xl gap-2 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 font-semibold"
              >
                <Edit className="h-4 w-4" />
                <span className="hidden sm:inline">Editar Perfil</span>
                <span className="sm:hidden">Editar</span>
              </Button>
              <Button
                variant="ghost"
                onClick={handleLogout}
                className="h-12 w-12 rounded-2xl p-0 text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Link in Bio pill */}
          {restaurante?.username && (
            <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center justify-between gap-3 px-4 py-3 bg-zinc-100 dark:bg-zinc-900/50 rounded-2xl border-none max-w-fit hover:bg-zinc-200/50 dark:hover:bg-zinc-900 transition-colors group">
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-[#FF7A00]" />
                  <span className="text-base font-semibold text-foreground tracking-tight">
                    piru.app/{restaurante.username}
                  </span>
                </div>
                <div className="flex items-center gap-1 border-l border-zinc-300 dark:border-zinc-700 pl-3 ml-1">
                  <button onClick={copyLink} className="p-1.5 text-muted-foreground hover:text-[#FF7A00] hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-all" title="Copiar link">
                    <Copy className="h-4 w-4" />
                  </button>
                  <a href={`https://my.piru.app/${restaurante.username}`} target="_blank" rel="noreferrer" className="p-1.5 text-muted-foreground hover:text-[#FF7A00] hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-all" title="Abrir link">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-8 mt-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">

          {/* Tab bar (Pills Style) */}
          <div className="-mx-4 px-4 overflow-x-auto scrollbar-none pb-2">
            <TabsList className="inline-flex bg-zinc-200/50 dark:bg-zinc-900 p-1.5 rounded-[20px] h-auto gap-1">
              {TABS.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="
                    flex items-center gap-2.5 px-5 py-3 rounded-2xl text-sm font-semibold
                    text-muted-foreground hover:text-foreground
                    data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-950 
                    data-[state=active]:text-foreground data-[state=active]:shadow-sm
                    transition-all whitespace-nowrap
                  "
                >
                  <tab.icon className={cn("h-4 w-4", activeTab === tab.value ? "text-[#FF7A00]" : "text-muted-foreground")} />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* ─────────────────────────────────────────────
              TAB: GENERAL
          ───────────────────────────────────────────── */}
          <TabsContent value="general" className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Business info */}
              <div className={cn(phantomCardClass, "lg:col-span-2")}>
                <div className="p-6 sm:p-8">
                  <h2 className="text-xl font-bold mb-6">Detalles del Negocio</h2>

                  <div className="space-y-5">
                    {[
                      { icon: Store, label: 'Nombre', value: restaurante?.nombre },
                      { icon: Link2, label: 'Enlace', value: restaurante?.username ? `piru.app/${restaurante.username}` : undefined },
                      { icon: MapPin, label: 'Dirección', value: restaurante?.direccion },
                      { icon: Phone, label: 'Teléfono', value: restaurante?.telefono },
                      { icon: Truck, label: 'Envío', value: restaurante?.deliveryFee ? `$${restaurante.deliveryFee}` : undefined },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/40">
                        <div className="flex items-center gap-3 w-40 shrink-0 text-muted-foreground">
                          <Icon className="h-5 w-5" />
                          <span className="text-sm font-medium">{label}</span>
                        </div>
                        <span className={cn("text-base sm:text-sm font-medium ml-8 sm:ml-0", value ? "text-foreground" : "text-muted-foreground italic")}>
                          {value || 'No configurado'}
                        </span>
                      </div>
                    ))}
                  </div>

                  <Separator className="my-8 border-zinc-100 dark:border-zinc-800" />

                  <h3 className="text-lg font-bold mb-4">Comunicaciones</h3>

                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                      <div className="flex items-start gap-4">
                        <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                          <Smartphone className="h-5 w-5 text-green-600 dark:text-green-500" />
                        </div>
                        <div>
                          <p className="text-base font-semibold">Notificaciones a WhatsApp</p>
                          <p className="text-sm text-muted-foreground mt-0.5">{restaurante?.whatsappEnabled ? `Activado para ${restaurante.whatsappNumber}` : 'Recibí pedidos en tu celular'}</p>
                        </div>
                      </div>
                      <Badge variant={restaurante?.whatsappEnabled ? 'default' : 'secondary'} className={cn("w-fit", restaurante?.whatsappEnabled ? 'bg-green-500 hover:bg-green-600' : '')}>
                        {restaurante?.whatsappEnabled ? 'Activado' : 'Desactivado'}
                      </Badge>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                      <div className="flex items-start gap-4">
                        <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                          <Smartphone className="h-5 w-5 text-[#FF7A00]" />
                        </div>
                        <div>
                          <p className="text-base font-semibold">Avisos automáticos a clientes</p>
                          <p className="text-sm text-muted-foreground mt-0.5">Notificar cambios de estado del pedido.</p>
                        </div>
                      </div>
                      <Switch checked={(restaurante as any)?.notificarClientesWhatsapp !== false} onCheckedChange={handleToggleNotificarClientesWhatsapp} disabled={isTogglingNotificarClientesWhatsapp} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right column: Stats + Quick nav */}
              <div className="space-y-6">
                <div className={cn(phantomCardClass, "bg-[#FF7A00] text-white border-none shadow-orange-500/20")}>
                  <div className="p-6 sm:p-8">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-bold">Catálogo</h3>
                      <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                        <Package className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-4xl font-black">{productosActivos}</p>
                        <p className="text-sm text-orange-100 mt-1 font-medium">Activos</p>
                      </div>
                      <div>
                        <p className="text-4xl font-black opacity-80">{totalProductos}</p>
                        <p className="text-sm text-orange-100 mt-1 font-medium">Total</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={phantomCardClass}>
                  <div className="p-2">
                    {[
                      { label: 'Configurar pagos', tab: 'pagos', icon: CreditCard },
                      { label: 'Horarios y delivery', tab: 'delivery', icon: Clock },
                      { label: 'Diseño y Menú', tab: 'experiencia', icon: Palette },
                    ].map(({ label, tab, icon: Icon }) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors group"
                      >
                        <div className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-orange-50 dark:group-hover:bg-orange-900/30 transition-colors">
                          <Icon className="h-5 w-5 text-muted-foreground group-hover:text-[#FF7A00]" />
                        </div>
                        <span className="font-semibold text-foreground flex-1 text-left">{label}</span>
                        <ChevronRight className="h-5 w-5 text-zinc-300 group-hover:text-[#FF7A00]" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ─────────────────────────────────────────────
              TAB: PAGOS
          ───────────────────────────────────────────── */}
          <TabsContent value="pagos" className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500 outline-none">

            <div className={phantomCardClass}>
              <div className="p-6 sm:p-8">
                <div className="max-w-xl mb-8">
                  <h2 className="text-2xl font-bold mb-2 flex items-center gap-3">
                    <Settings className="h-6 w-6 text-[#FF7A00]" />
                    Proveedor principal
                  </h2>
                  <p className="text-muted-foreground">Elegí cómo querés validar los cobros de tus clientes de forma automática.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  {[
                    { value: 'manual', label: 'Manual', sub: 'Vos validás', icon: CheckCircle2 },
                    { value: 'cucuru', label: 'Cucuru', sub: 'Billetera virtual', icon: Wallet },
                    { value: 'talo', label: 'Talo', sub: 'Tiempo real', icon: Zap },
                    { value: 'mercadopago', label: 'MercadoPago', sub: 'Tarjetas', icon: CreditCard },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setProveedorPago(opt.value)}
                      className={cn(
                        "flex flex-col items-start p-5 rounded-3xl border-2 transition-all text-left",
                        proveedorPago === opt.value
                          ? "border-[#FF7A00] bg-orange-50/50 dark:bg-orange-950/20 shadow-md shadow-orange-500/10"
                          : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 hover:border-zinc-300 dark:hover:border-zinc-700"
                      )}
                    >
                      <opt.icon className={cn("h-6 w-6 mb-4", proveedorPago === opt.value ? "text-[#FF7A00]" : "text-muted-foreground")} />
                      <span className="font-bold text-lg text-foreground block">{opt.label}</span>
                      <span className="text-sm text-muted-foreground">{opt.sub}</span>
                    </button>
                  ))}
                </div>

                {proveedorPago === 'talo' && (
                  <div className="p-6 mb-8 bg-zinc-50 dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800">
                    <h4 className="font-semibold mb-4 text-foreground">Credenciales Talo</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Input type="password" placeholder="Client ID" value={taloClientId} onChange={(e) => setTaloClientId(e.target.value)} className={phantomInputClass} />
                      <Input type="password" placeholder="Client Secret" value={taloClientSecret} onChange={(e) => setTaloClientSecret(e.target.value)} className={phantomInputClass} />
                      <Input placeholder="User ID" value={taloUserId} onChange={(e) => setTaloUserId(e.target.value)} className={phantomInputClass} />
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleGuardarPasarelaPago}
                  disabled={isSavingPasarela}
                  className="h-14 px-8 rounded-xl font-bold bg-[#FF7A00] hover:bg-[#E66E00] text-white shadow-lg shadow-orange-500/20"
                >
                  {isSavingPasarela ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                  Guardar Preferencia
                </Button>
              </div>
            </div>

            {/* Integrations grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* MercadoPago */}
              <IntegrationCard connected={!!restaurante?.mpConnected} accentClass="border-[#009EE3] bg-[#009EE3]/5 dark:bg-[#009EE3]/10">
                <div className="p-6 sm:p-8 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-[20px] bg-[#009EE3] flex items-center justify-center shrink-0">
                        <span className="text-white font-bold text-lg">MP</span>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">MercadoPago</h3>
                        <p className="text-sm text-muted-foreground">Tarjetas y dinero en cuenta</p>
                      </div>
                    </div>
                    <Badge className={restaurante?.mpConnected ? 'bg-[#009EE3] hover:bg-[#009EE3] text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-muted-foreground'} variant={restaurante?.mpConnected ? 'default' : 'secondary'}>
                      {restaurante?.mpConnected ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>

                  <div className="flex-1">
                    {restaurante?.mpConnected ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                          <div>
                            <p className="text-sm font-semibold">ID de Cuenta</p>
                            <p className="text-xs text-muted-foreground font-mono mt-1">{restaurante.mpUserId}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-muted-foreground">Checkout</span>
                            <Switch checked={(restaurante as any)?.cardsPaymentsEnabled !== false} onCheckedChange={handleToggleCardsPaymentsEnabled} disabled={isTogglingCardsPaymentsEnabled} />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Conectá tu cuenta de MercadoPago para habilitar el pago con tarjetas en tu menú online.</p>
                    )}
                  </div>

                  <div className="mt-6 pt-6 border-t border-zinc-200/50 dark:border-zinc-800/50">
                    {restaurante?.mpConnected ? (
                      <Button variant="outline" className="w-full h-12 rounded-xl text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30 dark:border-red-900" onClick={handleDesconectarMP} disabled={isDisconnectingMP}>
                        {isDisconnectingMP ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unlink className="mr-2 h-4 w-4" />}
                        Desconectar
                      </Button>
                    ) : (
                      <Button asChild className="w-full h-12 rounded-xl font-semibold bg-[#009EE3] hover:bg-[#0088C4] text-white">
                        <a href={getMercadoPagoAuthUrl() || '#'}>
                          <Link2 className="mr-2 h-4 w-4" />
                          Conectar Cuenta
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </IntegrationCard>

              {/* Cucuru */}
              <IntegrationCard connected={!!(restaurante as any)?.cucuruConfigurado} accentClass="border-purple-500 bg-purple-500/5 dark:bg-purple-500/10">
                <div className="p-6 sm:p-8 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-[20px] bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center shrink-0">
                        <Wallet className="h-6 w-6 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">Cucuru</h3>
                        <p className="text-sm text-muted-foreground">Billetera Virtual</p>
                      </div>
                    </div>
                    <Badge className={(restaurante as any)?.cucuruConfigurado ? 'bg-purple-600 hover:bg-purple-600 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-muted-foreground'} variant={(restaurante as any)?.cucuruConfigurado ? 'default' : 'secondary'}>
                      {(restaurante as any)?.cucuruConfigurado ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-6">
                      <span className="text-sm font-semibold">Mostrar en Checkout</span>
                      <Switch checked={(restaurante as any)?.cucuruEnabled !== false} onCheckedChange={handleToggleCucuruCheckoutEnabled} disabled={isTogglingCucuruCheckoutEnabled} />
                    </div>

                    {(restaurante as any)?.cucuruConfigurado ? (
                      <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/20 rounded-2xl border border-green-200 dark:border-green-900">
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500 shrink-0" />
                        <span className="text-sm font-medium text-green-800 dark:text-green-300">Webhooks sincronizados</span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Input placeholder="API Key" value={cucuruApiKey} onChange={(e) => setCucuruApiKey(e.target.value)} className={phantomInputClass} />
                        <Input placeholder="Collector ID" value={cucuruCollectorId} onChange={(e) => setCucuruCollectorId(e.target.value)} className={phantomInputClass} />
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-6 border-t border-zinc-200/50 dark:border-zinc-800/50">
                    {(restaurante as any)?.cucuruConfigurado ? (
                      <Button variant="outline" className="w-full h-12 rounded-xl" onClick={handleReenviarWebhookCucuru} disabled={isReenviandoWebhookCucuru}>
                        {isReenviandoWebhookCucuru ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Reenviar Webhook
                      </Button>
                    ) : (
                      <Button className="w-full h-12 rounded-xl font-semibold bg-purple-600 hover:bg-purple-700 text-white" onClick={handleConfigurarCucuru} disabled={isConfiguringCucuru}>
                        {isConfiguringCucuru ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Configurar Cuenta
                      </Button>
                    )}
                  </div>
                </div>
              </IntegrationCard>

            </div>
          </TabsContent>

          {/* ─────────────────────────────────────────────
              TAB: DELIVERY (Horarios)
          ───────────────────────────────────────────── */}
          <TabsContent value="delivery" className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500 outline-none">
            <div className="flex flex-col gap-6">

              {/* Horarios */}
              <div className={phantomCardClass}>
                <div className="p-6 sm:p-8">
                  <div className="max-w-xl mb-8">
                    <h2 className="text-2xl font-bold mb-2 flex items-center gap-3">
                      <Clock className="h-6 w-6 text-[#FF7A00]" />
                      Horarios de Atención
                    </h2>
                    <p className="text-muted-foreground">Configurá los turnos para cada día. Si un día no tiene turnos, la tienda aparecerá cerrada.</p>
                  </div>

                  {!horariosLoaded ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-[#FF7A00]" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {DIAS_SEMANA.map((nombreDia, diaIdx) => {
                        const turnos = horarios[diaIdx] || []
                        const estaAbierto = turnos.length > 0
                        return (
                          <div
                            key={diaIdx}
                            className={cn(
                              "rounded-[24px] p-4 sm:p-5 transition-all border",
                              estaAbierto
                                ? "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm"
                                : "bg-zinc-50 dark:bg-zinc-950 border-dashed border-zinc-200 dark:border-zinc-800 opacity-60 hover:opacity-100"
                            )}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start gap-4">

                              <div className="flex items-center gap-3 sm:w-32 shrink-0 pt-2">
                                <div className={cn("h-3 w-3 rounded-full shrink-0", estaAbierto ? "bg-green-500" : "bg-zinc-300 dark:bg-zinc-700")} />
                                <span className="text-base font-bold text-foreground">{nombreDia}</span>
                              </div>

                              <div className="flex-1 flex flex-col gap-3 min-w-0">
                                {turnos.length === 0 ? (
                                  <span className="text-sm text-muted-foreground italic py-2">Cerrado</span>
                                ) : (
                                  <div className="flex flex-col gap-3">
                                    {turnos.map((turno, tIdx) => (
                                      <div key={tIdx} className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-4 bg-zinc-50 dark:bg-zinc-950 p-2 rounded-2xl w-full xl:w-fit border border-zinc-100 dark:border-zinc-900">
                                        <Input
                                          type="time"
                                          value={turno.horaApertura}
                                          onChange={(e) => actualizarTurno(diaIdx, tIdx, 'horaApertura', e.target.value)}
                                          className="h-10 flex-1 min-w-[90px] sm:w-28 rounded-xl bg-white dark:bg-zinc-900 border-none font-medium"
                                        />
                                        <span className="text-muted-foreground font-medium text-sm">a</span>
                                        <Input
                                          type="time"
                                          value={turno.horaCierre}
                                          onChange={(e) => actualizarTurno(diaIdx, tIdx, 'horaCierre', e.target.value)}
                                          className="h-10 flex-1 min-w-[90px] sm:w-28 rounded-xl bg-white dark:bg-zinc-900 border-none font-medium"
                                        />
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-10 w-10 text-muted-foreground hover:text-red-500 rounded-xl shrink-0"
                                          onClick={() => eliminarTurno(diaIdx, tIdx)}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                <Button
                                  variant="outline"
                                  onClick={() => agregarTurno(diaIdx)}
                                  className="h-10 rounded-xl px-4 text-sm font-semibold w-full sm:w-fit mt-1"
                                >
                                  <Plus className="h-4 w-4 mr-2" /> Agregar turno
                                </Button>
                              </div>

                            </div>
                          </div>
                        )
                      })}

                      <div className="pt-8 flex justify-end">
                        <Button
                          onClick={guardarHorarios}
                          disabled={isSavingHorarios}
                          className="h-14 px-8 rounded-xl font-bold bg-[#FF7A00] hover:bg-[#E66E00] text-white shadow-lg shadow-orange-500/20 w-full sm:w-auto"
                        >
                          {isSavingHorarios && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                          Guardar Horarios
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Mapa Zonas */}
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
          </TabsContent>

          {/* ─────────────────────────────────────────────
              TAB: EXPERIENCIA
          ───────────────────────────────────────────── */}
          <TabsContent value="experiencia" className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500 outline-none">

            <div className={phantomCardClass}>
              <div className="p-6 sm:p-8">
                <div className="max-w-xl mb-8">
                  <h2 className="text-2xl font-bold mb-2 flex items-center gap-3">
                    <Palette className="h-6 w-6 text-[#FF7A00]" />
                    Diseño del Menú
                  </h2>
                  <p className="text-muted-foreground">Elegí el estilo visual que verán tus clientes al entrar a tu enlace.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl">
                  {/* Glassmorphism */}
                  <button
                    onClick={() => restaurante?.disenoAlternativo && handleToggleDisenoAlternativo()}
                    disabled={isTogglingDisenoAlternativo && !restaurante?.disenoAlternativo}
                    className={cn(
                      "relative rounded-[32px] border-2 p-5 text-left transition-all",
                      !restaurante?.disenoAlternativo
                        ? "border-[#FF7A00] bg-orange-50/30 dark:bg-orange-950/20 ring-4 ring-[#FF7A00]/10"
                        : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 hover:border-zinc-300"
                    )}
                  >
                    {!restaurante?.disenoAlternativo && (
                      <div className="absolute top-4 right-4 bg-white dark:bg-zinc-900 rounded-full p-1 shadow-sm">
                        <CheckCircle2 className="h-5 w-5 text-[#FF7A00]" />
                      </div>
                    )}
                    <div className="aspect-video rounded-2xl overflow-hidden mb-4 bg-zinc-900 relative shadow-inner">
                      <div className="absolute inset-0 bg-linear-to-br from-orange-500/20 to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3 h-12 bg-white/10 backdrop-blur-md rounded-xl border border-white/20" />
                    </div>
                    <p className="text-lg font-bold text-foreground">Glassmorphism</p>
                    <p className="text-sm text-muted-foreground mt-1">Moderno, flotante y premium. Ideal para destacar marca.</p>
                  </button>

                  {/* Full Image */}
                  <button
                    onClick={() => !restaurante?.disenoAlternativo && handleToggleDisenoAlternativo()}
                    disabled={isTogglingDisenoAlternativo && !!restaurante?.disenoAlternativo}
                    className={cn(
                      "relative rounded-[32px] border-2 p-5 text-left transition-all",
                      restaurante?.disenoAlternativo
                        ? "border-[#FF7A00] bg-orange-50/30 dark:bg-orange-950/20 ring-4 ring-[#FF7A00]/10"
                        : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 hover:border-zinc-300"
                    )}
                  >
                    {restaurante?.disenoAlternativo && (
                      <div className="absolute top-4 right-4 bg-white dark:bg-zinc-900 rounded-full p-1 shadow-sm">
                        <CheckCircle2 className="h-5 w-5 text-[#FF7A00]" />
                      </div>
                    )}
                    <div className="aspect-video rounded-2xl overflow-hidden mb-4 bg-zinc-200 dark:bg-zinc-800 relative">
                      <div className="absolute inset-0 bg-linear-to-br from-zinc-400 to-zinc-500 dark:from-zinc-600 dark:to-zinc-700" />
                      <div className="absolute bottom-0 left-0 right-0 p-3 bg-white dark:bg-zinc-950 h-14">
                        <div className="h-2 w-20 bg-zinc-200 dark:bg-zinc-800 rounded-full mb-2" />
                        <div className="h-2 w-12 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
                      </div>
                    </div>
                    <p className="text-lg font-bold text-foreground">Clásico (Imagen completa)</p>
                    <p className="text-sm text-muted-foreground mt-1">Enfoque 100% en las fotos de tus productos.</p>
                  </button>
                </div>
              </div>
            </div>

            <div className={phantomCardClass}>
              <div className="p-6 sm:p-8">
                <h3 className="text-xl font-bold mb-6">Funcionalidades Extras</h3>
                <div className="space-y-2">
                  <ToggleRow
                    icon={<UtensilsCrossed className="h-6 w-6 text-indigo-600" />}
                    iconBg="bg-indigo-100 dark:bg-indigo-900/50"
                    title="Pedido entre amigos"
                    description="Permite que varias personas armen un solo carrito compartiendo un link."
                    checked={(restaurante as any)?.orderGroupEnabled !== false}
                    onCheckedChange={handleToggleOrderGroupEnabled}
                    disabled={isTogglingOrderGroupEnabled}
                  />
                  <div className="h-px w-full bg-zinc-100 dark:bg-zinc-800/50" />
                  <ToggleRow
                    icon={<Ticket className="h-6 w-6 text-teal-600" />}
                    iconBg="bg-teal-100 dark:bg-teal-900/50"
                    title="Códigos de descuento"
                    description="Habilita la caja para ingresar cupones promocionales en el checkout."
                    checked={(restaurante as any)?.codigoDescuentoEnabled !== false}
                    onCheckedChange={handleToggleCodigoDescuentoEnabled}
                    disabled={isTogglingCodigoDescuentoEnabled}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ─────────────────────────────────────────────
              TAB: HARDWARE
          ───────────────────────────────────────────── */}
          <TabsContent value="hardware" className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500 outline-none">
            <div className={cn(phantomCardClass, "max-w-2xl")}>
              <div className="p-6 sm:p-8">
                <div className="mb-8">
                  <h2 className="text-2xl font-bold mb-2 flex items-center gap-3">
                    <Printer className="h-6 w-6 text-[#FF7A00]" />
                    Impresora Térmica
                  </h2>
                  <p className="text-muted-foreground">Conectá tu comandera local para imprimir tickets automáticos. (Requiere Piru Desktop).</p>
                </div>

                {selectedPrinter ? (
                  <div className="flex items-center gap-4 p-5 bg-green-50 dark:bg-green-950/20 border-2 border-green-500/20 rounded-3xl mb-8">
                    <div className="h-12 w-12 rounded-[18px] bg-green-100 dark:bg-green-900/50 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-green-900 dark:text-green-100">Impresora Lista</p>
                      <p className="text-sm text-green-700 dark:text-green-300 mt-0.5 font-medium">{selectedPrinter}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 p-5 bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-500/20 rounded-3xl mb-8">
                    <div className="h-12 w-12 rounded-[18px] bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
                      <AlertCircle className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-amber-900 dark:text-amber-100">Sin configurar</p>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">Buscá y seleccioná una impresora.</p>
                    </div>
                  </div>
                )}

                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button
                      onClick={handleListPrinters}
                      disabled={isListingPrinters}
                      className="flex-1 h-14 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 font-bold text-base shadow-lg shadow-black/10"
                    >
                      {isListingPrinters ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <List className="mr-2 h-5 w-5" />}
                      Buscar Dispositivos
                    </Button>

                    <Button
                      variant="outline"
                      onClick={handleTestPrint}
                      disabled={isPrintingTest || !selectedPrinter}
                      className="flex-1 h-14 rounded-2xl border-2 font-bold text-base hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    >
                      {isPrintingTest ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Printer className="mr-2 h-5 w-5" />}
                      Ticket de Prueba
                    </Button>
                  </div>

                  {printers.length > 0 && (
                    <div className="p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                      <Label className={phantomLabelClass}>Seleccionar Impresora</Label>
                      <Select value={selectedPrinter || ''} onValueChange={setSelectedPrinter}>
                        <SelectTrigger className="h-14 rounded-2xl bg-white dark:bg-zinc-950 border-transparent focus:ring-2 focus:ring-[#FF7A00]/20 text-base font-medium mt-2">
                          <SelectValue placeholder="Elegir del listado..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-zinc-200 dark:border-zinc-800">
                          {printers.map((p, i) => (
                            <SelectItem key={i} value={p} className="py-3 text-base rounded-xl cursor-pointer">{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

        </Tabs>
      </div>

      {/* ─────────────────────────────────────────────
          DIALOG: Editar perfil
      ───────────────────────────────────────────── */}
      <Dialog open={dialogAbierto} onOpenChange={setDialogAbierto}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0 sm:rounded-[32px] border-zinc-200 dark:border-zinc-800">
          <div className="px-6 pt-8 pb-6 bg-zinc-50 dark:bg-zinc-950 sticky top-0 z-10">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <Settings className="h-5 w-5 text-[#FF7A00]" />
                </div>
                Editar Perfil
              </DialogTitle>
              <DialogDescription className="text-base text-muted-foreground mt-2">
                Actualizá la información pública y personalización de tu tienda.
              </DialogDescription>
            </DialogHeader>

            {/* Modal Tabs */}
            <div className="flex items-center gap-2 mt-6 overflow-x-auto pb-2 scrollbar-none">
              {[
                { value: 'info', label: 'Información' },
                { value: 'branding', label: 'Branding' },
                { value: 'comunicacion', label: 'Transferencias' },
              ].map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setDialogTab(t.value)}
                  className={cn(
                    "px-5 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap",
                    dialogTab === t.value
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-md"
                      : "bg-white dark:bg-zinc-900 text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-950">
            <div className="p-6 sm:p-8 min-h-[40vh]">
              {/* Tab: Información */}
              {dialogTab === 'info' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 animate-in fade-in duration-300">
                  <div className="space-y-1">
                    <Label htmlFor="nombre" className={phantomLabelClass}>Nombre del local</Label>
                    <Input id="nombre" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} placeholder="Ej: Burger Bros" required className={phantomInputClass} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="username" className={phantomLabelClass}>Alias URL</Label>
                    <div className="relative flex items-center overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-900 focus-within:ring-2 focus-within:ring-[#FF7A00] transition-all">
                      <span className="pl-5 pr-1 text-muted-foreground font-mono text-sm select-none">piru.app/</span>
                      <Input id="username" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} placeholder="mi-local" className="h-14 bg-transparent border-none focus-visible:ring-0 px-0 font-mono text-base w-full min-w-0" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="telefono" className={phantomLabelClass}>Teléfono público</Label>
                    <Input id="telefono" value={formData.telefono} onChange={(e) => setFormData({ ...formData, telefono: e.target.value })} placeholder="+54 9..." className={phantomInputClass} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="deliveryFee" className={phantomLabelClass}>Costo de envío base</Label>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                      <Input id="deliveryFee" type="number" step="0.01" value={formData.deliveryFee} onChange={(e) => setFormData({ ...formData, deliveryFee: e.target.value })} placeholder="0.00" className={cn(phantomInputClass, "pl-10")} />
                    </div>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="direccion" className={phantomLabelClass}>Dirección física</Label>
                    <Input id="direccion" value={formData.direccion} onChange={(e) => setFormData({ ...formData, direccion: e.target.value })} placeholder="Ej: Av. Siempreviva 742" className={phantomInputClass} />
                  </div>
                </div>
              )}

              {/* Tab: Branding */}
              {dialogTab === 'branding' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label className={phantomLabelClass}>Logo (Modo Oscuro)</Label>
                      <div className="bg-zinc-900 rounded-3xl p-2 border-2 border-dashed border-zinc-700 hover:border-zinc-500 transition-colors">
                        <ImageUpload onImageChange={setImageBase64} currentImage={imageBase64} maxSize={5} />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label className={phantomLabelClass}>Logo (Modo Claro)</Label>
                      <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl p-2 border-2 border-dashed border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 transition-colors">
                        <ImageUpload onImageChange={setImageLightBase64} currentImage={imageLightBase64} maxSize={5} />
                      </div>
                    </div>
                  </div>

                  <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border border-zinc-200 dark:border-zinc-800">
                    <h4 className="font-bold mb-4">Colores de marca</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <Label htmlFor="colorPrimario" className="text-sm font-medium">Primario (Botones principales)</Label>
                        <div className="flex gap-3">
                          <Input type="color" className="w-14 h-14 p-1 cursor-pointer rounded-2xl border-none" value={formData.colorPrimario || '#FF7A00'} onChange={(e) => setFormData({ ...formData, colorPrimario: e.target.value })} />
                          <Input value={formData.colorPrimario} onChange={(e) => setFormData({ ...formData, colorPrimario: e.target.value })} className={cn(phantomInputClass, "font-mono uppercase")} placeholder="#FF7A00" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="colorSecundario" className="text-sm font-medium">Secundario (Fondos)</Label>
                        <div className="flex gap-3">
                          <Input type="color" className="w-14 h-14 p-1 cursor-pointer rounded-2xl border-none" value={formData.colorSecundario || '#ffffff'} onChange={(e) => setFormData({ ...formData, colorSecundario: e.target.value })} />
                          <Input value={formData.colorSecundario} onChange={(e) => setFormData({ ...formData, colorSecundario: e.target.value })} className={cn(phantomInputClass, "font-mono uppercase")} placeholder="#FFFFFF" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Comunicación / Transferencias */}
              {dialogTab === 'comunicacion' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="space-y-2">
                    <Label htmlFor="whatsappNumber" className={phantomLabelClass}>WhatsApp para Notificaciones</Label>
                    <Input id="whatsappNumber" value={formData.whatsappNumber} onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })} placeholder="Ej: 5491123456789" className={phantomInputClass} />
                    <p className="text-sm text-muted-foreground mt-2 pl-2">El número que usa tu local para recibir los pedidos entrantes. Formato internacional sin '+'.</p>
                  </div>

                  <Separator className="my-6 border-zinc-100 dark:border-zinc-800" />

                  <div className="space-y-2">
                    <Label htmlFor="transferenciaAlias" className={phantomLabelClass}>Alias / CBU para transferencias</Label>
                    <Input id="transferenciaAlias" value={formData.transferenciaAlias} onChange={(e) => setFormData({ ...formData, transferenciaAlias: e.target.value })} placeholder="Ej: minombre.mp" className={cn(phantomInputClass, "font-mono")} />
                    <p className="text-sm text-muted-foreground mt-2 pl-2">Se mostrará a tus clientes en el checkout si la transferencia manual está activa.</p>
                  </div>

                  <Separator className="my-6 border-zinc-100 dark:border-zinc-800" />

                  <div className="space-y-2">
                    <Label htmlFor="comprobantesWhatsapp" className={phantomLabelClass}>WhatsApp para comprobantes</Label>
                    <Input id="comprobantesWhatsapp" value={formData.comprobantesWhatsapp} onChange={(e) => setFormData({ ...formData, comprobantesWhatsapp: e.target.value })} placeholder="Ej: 5491123456789" className={phantomInputClass} />
                    <p className="text-sm text-muted-foreground mt-2 pl-2">El número donde los clientes enviarán el ticket de pago. Formato internacional sin '+'.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-end gap-3 px-6 py-5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 sticky bottom-0">
              <Button type="button" variant="ghost" onClick={() => setDialogAbierto(false)} disabled={isSubmitting} className="h-12 px-6 rounded-xl font-medium">
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting} className="h-12 px-8 rounded-xl font-bold bg-[#FF7A00] hover:bg-[#E66E00] text-white shadow-lg shadow-orange-500/20">
                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                Guardar Cambios
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Perfil