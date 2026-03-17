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
  Calendar,
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
  Star,
  Clock,
  Plus,
  Trash2,
  Truck,
  UtensilsCrossed,
  RefreshCw
} from 'lucide-react'
import { usePrinter } from '@/context/PrinterContext'
import { commandsToBytes } from '@/utils/printerUtils'

const ZonasDeliveryMap = lazy(() => import('@/components/ZonasDeliveryMap'))

// Configuración de MercadoPago
const MP_APP_ID = 38638191854826
const MP_REDIRECT_URI = import.meta.env.VITE_MP_REDIRECT_URI || 'https://api.piru.app/api/mp/callback'

const Perfil = () => {
  const navigate = useNavigate()
  const logout = useAuthStore((state) => state.logout)
  const token = useAuthStore((state) => state.token)
  const restauranteStore = useRestauranteStore()
  const { restaurante, isLoading } = restauranteStore
  // Estados del modal de edición
  const [dialogAbierto, setDialogAbierto] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    nombre: '',
    direccion: '',
    telefono: '',
    username: '',
    deliveryFee: '',
    whatsappEnabled: false,
    whatsappNumber: '',
    transferenciaAlias: '',
    colorPrimario: '',
    colorSecundario: '',
  })
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [imageLightBase64, setImageLightBase64] = useState<string | null>(null)
  const [isDisconnectingMP, setIsDisconnectingMP] = useState(false)
  const [isTogglingSplitPayment, setIsTogglingSplitPayment] = useState(false)
  const [isTogglingSistemaPuntos, setIsTogglingSistemaPuntos] = useState(false)
  const [isTogglingDisenoAlternativo, setIsTogglingDisenoAlternativo] = useState(false)
  const [isTogglingOrderGroupEnabled, setIsTogglingOrderGroupEnabled] = useState(false)

  const [isConfiguringCucuru, setIsConfiguringCucuru] = useState(false)
  const [isReenviandoWebhookCucuru, setIsReenviandoWebhookCucuru] = useState(false)
  const [cucuruApiKey, setCucuruApiKey] = useState('')
  const [cucuruCollectorId, setCucuruCollectorId] = useState('')

  const [isConfiguringRapiboy, setIsConfiguringRapiboy] = useState(false)
  const [rapiboyToken, setRapiboyToken] = useState('')

  const [isSavingPasarela, setIsSavingPasarela] = useState(false)
  const [proveedorPago, setProveedorPago] = useState<string>((restaurante as any)?.proveedorPago || 'manual')
  const [taloApiKey, setTaloApiKey] = useState('')
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
        const response = await restauranteApi.getHorarios(token) as {
          success: boolean
          horarios?: Array<{ id: number; diaSemana: number; horaApertura: string; horaCierre: string }>
        }
        if (response.success && response.horarios) {
          const agrupado: HorariosDia = {}
          for (const h of response.horarios) {
            if (!agrupado[h.diaSemana]) agrupado[h.diaSemana] = []
            agrupado[h.diaSemana].push({ horaApertura: h.horaApertura, horaCierre: h.horaCierre })
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
    setHorarios(prev => ({
      ...prev,
      [dia]: [...(prev[dia] || []), { horaApertura: '09:00', horaCierre: '18:00' }]
    }))
  }

  const eliminarTurno = (dia: number, idx: number) => {
    setHorarios(prev => {
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

  const actualizarTurno = (dia: number, idx: number, campo: 'horaApertura' | 'horaCierre', valor: string) => {
    setHorarios(prev => {
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
          flat.push({ diaSemana: parseInt(dia), horaApertura: t.horaApertura, horaCierre: t.horaCierre })
        }
      }
      const response = await restauranteApi.updateHorarios(token, flat) as { success: boolean }
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

  // Manejar callback de MercadoPago (cuando vuelve de autorizar)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const mpStatus = urlParams.get('mp_status')
    const mpError = urlParams.get('mp_error')

    if (mpStatus === 'success') {
      toast.success('¡MercadoPago conectado!', {
        description: 'Ahora tus clientes pueden pagar con MercadoPago',
      })
      // Refrescar datos para obtener el nuevo estado
      restauranteStore.fetchData()
      // Limpiar URL
      window.history.replaceState({}, '', window.location.pathname)
    } else if (mpStatus === 'error') {
      let errorMessage = 'No se pudo conectar con MercadoPago'
      if (mpError === 'missing_params') errorMessage = 'Faltan parámetros de autorización'
      else if (mpError === 'config_error') errorMessage = 'Error de configuración del servidor'
      else if (mpError === 'oauth_failed') errorMessage = 'Error en la autenticación con MercadoPago'

      toast.error('Error al conectar MercadoPago', {
        description: errorMessage,
      })
      // Limpiar URL
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
      return;
    }

    setIsPrintingTest(true)
    try {
      const data = [
        '\x1B\x40', // Init
        '\x1B\x61\x01', // Center
        '\x1B\x45\x01', // Bold on
        'PRUEBA DE COMANDA\n',
        '\x1B\x45\x00', // Bold off
        '\x1B\x61\x00', // Left align
        '--------------------------------\n',
        'Hamburguesa x1\n',
        '  SIN: Cebolla\n',
        'Papas Fritas x1\n',
        '--------------------------------\n',
        '\n\n\n',
        '\x1D\x56\x41', // Cut
      ];

      await printRaw(commandsToBytes(data))
    } catch (error) {
      // El error ya se maneja en el context
    } finally {
      setIsPrintingTest(false)
    }
  }

  // Generar URL de vinculación con MercadoPago
  const getMercadoPagoAuthUrl = () => {
    if (!MP_APP_ID || !restaurante?.id) return null
    const state = restaurante.id.toString()
    return `https://auth.mercadopago.com.ar/authorization?client_id=${MP_APP_ID}&response_type=code&platform_id=mp&state=${state}&redirect_uri=${encodeURIComponent(MP_REDIRECT_URI)}`
  }

  // Desconectar MercadoPago
  const handleDesconectarMP = async () => {
    if (!token) return

    setIsDisconnectingMP(true)
    try {
      const response = await mercadopagoApi.desconectar(token) as { success: boolean }
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

  // Handle configurar rapiboy
  const handleConfigurarRapiboy = async () => {
    if (!token) return
    if (!rapiboyToken.trim()) {
      toast.error('Debes ingresar el Token de Rapiboy')
      return
    }

    setIsConfiguringRapiboy(true)
    try {
      const response = await restauranteApi.configurarRapiboy(token, rapiboyToken) as { success: boolean }
      if (response.success) {
        toast.success('Rapiboy configurado con éxito', {
          description: 'Tu sistema ahora puede gestionar la logística de envíos mediante Rapiboy.'
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

  // Handle configurar cucuru
  const handleConfigurarCucuru = async () => {
    if (!token) return
    if (!cucuruApiKey.trim() || !cucuruCollectorId.trim()) {
      toast.error('Debes ingresar API Key y Collector ID')
      return
    }

    setIsConfiguringCucuru(true)
    try {
      const response = await cucuruApi.configurar(token, cucuruApiKey, cucuruCollectorId) as { success: boolean, data: any }
      if (response.success) {
        toast.success('Billetera Virtual configurada con éxito', {
          description: 'Tu cuenta Cucuru está lista para automatizar cobros.'
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

  const taloYaConfigurado = !!(restaurante as any)?.taloApiKey && !!(restaurante as any)?.taloUserId

  const handleGuardarPasarelaPago = async () => {
    if (!token) return
    if (proveedorPago === 'talo' && !taloYaConfigurado && (!taloApiKey.trim() || !taloUserId.trim())) {
      toast.error('Para usar Talo debes ingresar API Key y User ID')
      return
    }

    setIsSavingPasarela(true)
    try {
      const payload: Record<string, unknown> = {
        proveedorPago: proveedorPago as 'cucuru' | 'talo' | 'mercadopago' | 'manual',
      }
      if (proveedorPago === 'talo') {
        if (taloApiKey.trim() && taloUserId.trim()) {
          payload.taloApiKey = taloApiKey.trim()
          payload.taloUserId = taloUserId.trim()
        }
        // Si ya configurado y no ingresó nuevos, no enviamos taloApiKey/taloUserId (mantiene los existentes)
      } else {
        payload.taloApiKey = null
        payload.taloUserId = null
      }

      const response = await restauranteApi.updatePasarelaPago(token, payload) as { success: boolean }
      if (response.success) {
        toast.success('Pasarela de pago actualizada', {
          description: `Proveedor configurado: ${proveedorPago === 'manual' ? 'Manual' : proveedorPago === 'talo' ? 'Talo' : proveedorPago === 'cucuru' ? 'Cucuru' : 'MercadoPago'}`,
        })
        restauranteStore.fetchData()
        if (proveedorPago === 'talo') {
          setTaloApiKey('')
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
      const response = await cucuruApi.reconfigurarWebhook(token) as { success: boolean }
      if (response.success) {
        toast.success('Webhook reenviado', {
          description: 'La URL HTTPS del webhook se volvió a enviar a Cucuru correctamente.'
        })
      }
    } catch (error) {
      console.error('Error al reenviar webhook Cucuru:', error)
      toast.error('Error al reenviar webhook', {
        description: 'No se pudo reconfigurar. Verifica tus credenciales en Cucuru.'
      })
    } finally {
      setIsReenviandoWebhookCucuru(false)
    }
  }

  // Toggle modo carrito


  // Toggle modo split payment
  const handleToggleSplitPayment = async () => {
    if (!token) return

    setIsTogglingSplitPayment(true)
    try {
      const response = await restauranteApi.toggleSplitPayment(token) as { success: boolean; splitPayment: boolean }
      if (response.success) {
        toast.success(response.splitPayment ? 'Split Payment activado' : 'Split Payment desactivado', {
          description: response.splitPayment
            ? 'Los clientes podrán pagar individualmente'
            : 'Los clientes pagarán el total de la mesa'
        })
        restauranteStore.fetchData()
      }
    } catch (error) {
      console.error('Error al cambiar modo split payment:', error)
      toast.error('Error al cambiar la configuración de pagos')
    } finally {
      setIsTogglingSplitPayment(false)
    }
  }


  // Toggle solo carta digital


  // Toggle sistema de puntos
  const handleToggleSistemaPuntos = async () => {
    if (!token) return

    setIsTogglingSistemaPuntos(true)
    try {
      const response = await restauranteApi.toggleSistemaPuntos(token) as { success: boolean; sistemaPuntos: boolean }
      if (response.success) {
        toast.success(response.sistemaPuntos ? 'Sistema de Puntos activado' : 'Sistema de Puntos desactivado', {
          description: response.sistemaPuntos
            ? 'Los clientes ahora podrán ganar y canjear puntos en tu restaurante'
            : 'Se ha deshabilitado el sistema de puntos'
        })
        restauranteStore.fetchData()
      }
    } catch (error) {
      console.error('Error al cambiar sistema de puntos:', error)
      toast.error('Error al cambiar la configuración de puntos')
    } finally {
      setIsTogglingSistemaPuntos(false)
    }
  }

  // Toggle pedido entre amigos
  const handleToggleOrderGroupEnabled = async () => {
    if (!token) return

    setIsTogglingOrderGroupEnabled(true)
    try {
      const response = await restauranteApi.toggleOrderGroupEnabled(token) as { success: boolean; orderGroupEnabled: boolean }
      if (response.success) {
        toast.success(response.orderGroupEnabled ? 'Pedido entre amigos activado' : 'Pedido entre amigos desactivado', {
          description: response.orderGroupEnabled
            ? 'El botón para armar pedidos grupales por link se mostrará en el menú'
            : 'El botón para armar pedidos grupales estará oculto en el menú'
        })
        restauranteStore.fetchData()
      }
    } catch (error) {
      console.error('Error al cambiar pedido entre amigos:', error)
      toast.error('Error al cambiar la configuración')
    } finally {
      setIsTogglingOrderGroupEnabled(false)
    }
  }

  // Toggle diseño alternativo
  const handleToggleDisenoAlternativo = async () => {
    if (!token) return

    setIsTogglingDisenoAlternativo(true)
    try {
      const response = await restauranteApi.toggleDisenoAlternativo(token) as { success: boolean; disenoAlternativo: boolean }
      if (response.success) {
        toast.success(response.disenoAlternativo ? 'Diseño alternativo activado' : 'Diseño alternativo desactivado', {
          description: response.disenoAlternativo
            ? 'El menú online usará el diseño que muestra la imagen completa'
            : 'El menú online usará el diseño original'
        })
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
        transferenciaAlias: restaurante.transferenciaAlias || '',
        colorPrimario: restaurante.colorPrimario || '',
        colorSecundario: restaurante.colorSecundario || '',
      })
      setImageBase64(restaurante.imagenUrl || null)
      setImageLightBase64(restaurante.imagenLightUrl || null)
      setDialogAbierto(true)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!token) {
      toast.error('No hay sesión activa')
      return
    }

    // Validaciones
    if (!formData.nombre.trim()) {
      toast.error('El nombre es requerido')
      return
    }

    setIsSubmitting(true)

    try {
      const updateData: {
        nombre?: string
        direccion?: string
        telefono?: string
        image?: string
        imageLight?: string
        username?: string
        deliveryFee?: string
        whatsappEnabled?: boolean
        whatsappNumber?: string
        transferenciaAlias?: string
        colorPrimario?: string
        colorSecundario?: string
      } = {}

      // Solo enviar campos que cambiaron
      if (formData.nombre !== restaurante?.nombre) {
        updateData.nombre = formData.nombre
      }
      if (formData.direccion !== (restaurante?.direccion || '')) {
        updateData.direccion = formData.direccion
      }
      if (formData.telefono !== (restaurante?.telefono || '')) {
        updateData.telefono = formData.telefono
      }
      if (formData.username !== (restaurante?.username || '')) {
        updateData.username = formData.username
      }
      if (formData.deliveryFee !== (restaurante?.deliveryFee || '')) {
        updateData.deliveryFee = formData.deliveryFee
      }
      if (formData.whatsappEnabled !== (restaurante?.whatsappEnabled || false)) {
        updateData.whatsappEnabled = formData.whatsappEnabled
      }
      if (formData.whatsappNumber !== (restaurante?.whatsappNumber || '')) {
        updateData.whatsappNumber = formData.whatsappNumber
      }
      if (formData.transferenciaAlias !== (restaurante?.transferenciaAlias || '')) {
        updateData.transferenciaAlias = formData.transferenciaAlias
      }
      if (formData.colorPrimario !== (restaurante?.colorPrimario || '')) {
        updateData.colorPrimario = formData.colorPrimario
      }
      if (formData.colorSecundario !== (restaurante?.colorSecundario || '')) {
        updateData.colorSecundario = formData.colorSecundario
      }
      // Si la imagen es nueva (base64), enviarla
      if (imageBase64 && imageBase64.startsWith('data:image')) {
        updateData.image = imageBase64
      }

      // Si la imagen light es nueva (base64), enviarla
      if (imageLightBase64 && imageLightBase64.startsWith('data:image')) {
        updateData.imageLight = imageLightBase64
      }

      // Verificar que hay algo que actualizar
      if (Object.keys(updateData).length === 0) {
        toast.info('No hay cambios para guardar')
        setDialogAbierto(false)
        return
      }

      const response = await restauranteApi.update(token, updateData) as {
        success: boolean
        data?: any
      }

      if (response.success) {
        toast.success('Perfil actualizado', {
          description: 'Los cambios se guardaron correctamente',
        })
        // Refrescar datos del store
        await restauranteStore.fetchData()
        setDialogAbierto(false)
      }
    } catch (error) {
      console.error('Error al actualizar perfil:', error)
      if (error instanceof ApiError) {
        toast.error('Error al guardar', {
          description: error.message,
        })
      } else {
        toast.error('Error de conexión', {
          description: 'No se pudo conectar con el servidor',
        })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (isLoading) {
    return (
      <div className="w-full max-w-7xl lg:max-w-[1600px] xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="w-full max-w-7xl lg:max-w-[1600px] xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mt-12">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Perfil del Restaurante</h1>
          <p className="text-muted-foreground">
            Información y configuración de tu cuenta
          </p>
        </div>
        <Button variant="destructive" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar Sesión
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  {restaurante?.imagenUrl ? (
                    <img
                      src={restaurante.imagenUrl}
                      alt={restaurante.nombre}
                      className="h-16 w-16 rounded-full object-cover"
                    />
                  ) : (
                    <Store className="h-8 w-8 text-primary" />
                  )}
                </div>
                <div>
                  <CardTitle className="text-2xl">{restaurante?.nombre || 'Sin nombre'}</CardTitle>
                  <CardDescription>
                    <Badge variant="default">Activo</Badge>
                  </CardDescription>
                </div>
              </div>
              <Button variant="outline" onClick={abrirDialogEditar}>
                <Edit className="mr-2 h-4 w-4" />
                Editar Perfil
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Correo Electrónico</p>
                  <p className="text-base">{restaurante?.email || 'No especificado'}</p>
                </div>
              </div>

              <Separator />

              <div className="flex items-start space-x-3">
                <Link2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Enlace de Delivery / Take Away</p>
                  <p className="text-base font-semibold">
                    {restaurante?.username ? (
                      <a href={`https://piru.app/${restaurante.username}`} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
                        piru.app/{restaurante.username}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground font-normal">No configurado</span>
                    )}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex items-start space-x-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Dirección</p>
                  <p className="text-base">
                    {restaurante?.direccion || (
                      <span className="text-muted-foreground">No especificada</span>
                    )}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex items-start space-x-3">
                <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Teléfono</p>
                  <p className="text-base">
                    {restaurante?.telefono || (
                      <span className="text-muted-foreground">No especificado</span>
                    )}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex items-start space-x-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Miembro desde</p>
                  <p className="text-base">
                    {restaurante?.createdAt ? formatDate(restaurante.createdAt) : 'No disponible'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Tarjeta de Proveedor de Pasarela (Transferencias) */}
          <Card className="border-amber-500/30 bg-gradient-to-br from-amber-50/80 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/10">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Proveedor de Pasarela (Transferencias)
              </CardTitle>
              <CardDescription>
                Elige qué plataforma usará tu local para cobrar transferencias. Los pedidos solo llegarán a cocina cuando el pago sea confirmado por la pasarela.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Proveedor activo</Label>
                <Select
                  value={proveedorPago}
                  onValueChange={setProveedorPago}
                  disabled={isSavingPasarela}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">
                      <span className="flex items-center gap-2">
                        Manual — Sin validación automática
                      </span>
                    </SelectItem>
                    <SelectItem value="cucuru">
                      <span className="flex items-center gap-2">
                        Cucuru — Billetera virtual
                      </span>
                    </SelectItem>
                    <SelectItem value="talo">
                      <span className="flex items-center gap-2">
                        Talo — Transferencias en tiempo real
                      </span>
                    </SelectItem>
                    <SelectItem value="mercadopago">
                      <span className="flex items-center gap-2">
                        MercadoPago — Pagos con tarjeta
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {proveedorPago === 'talo' && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-3">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Credenciales de Talo
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Obtén tu API Key y User ID desde el panel de Talo. Estas credenciales permiten generar alias dinámicos y recibir confirmaciones de pago.
                  </p>
                  <div className="flex flex-col gap-2">
                    <Input
                      type="password"
                      placeholder="API Key de Talo"
                      value={taloApiKey}
                      onChange={(e) => setTaloApiKey(e.target.value)}
                      disabled={isSavingPasarela}
                      className="bg-background"
                    />
                    <Input
                      placeholder="User ID de Talo"
                      value={taloUserId}
                      onChange={(e) => setTaloUserId(e.target.value)}
                      disabled={isSavingPasarela}
                      className="bg-background"
                    />
                  </div>
                </div>
              )}

              <Button
                onClick={handleGuardarPasarelaPago}
                disabled={isSavingPasarela || (proveedorPago === 'talo' && !taloYaConfigurado && (!taloApiKey.trim() || !taloUserId.trim()))}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white"
              >
                {isSavingPasarela ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Guardar configuración
                  </>
                )}
              </Button>

              {(restaurante as any)?.proveedorPago && (restaurante as any).proveedorPago !== 'manual' && (
                <p className="text-xs text-muted-foreground">
                  Actualmente configurado: <strong className="capitalize">{(restaurante as any).proveedorPago}</strong>
                </p>
              )}
            </CardContent>
          </Card>

          {/* Tarjeta de MercadoPago */}
          <Card className={restaurante?.mpConnected ? "border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-sky-500/50 bg-sky-50/50 dark:bg-sky-950/20"}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                MercadoPago
              </CardTitle>
              <CardDescription>
                {restaurante?.mpConnected
                  ? 'Tu cuenta está conectada y lista para recibir pagos'
                  : 'Conecta tu cuenta para recibir pagos de tus clientes'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {restaurante?.mpConnected ? (
                <>
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-medium">Cuenta conectada</span>
                  </div>
                  {restaurante.mpUserId && (
                    <p className="text-sm text-muted-foreground">
                      ID de usuario: {restaurante.mpUserId}
                    </p>
                  )}
                  <Button
                    variant="outline"
                    className="w-full border-destructive/50 text-destructive hover:bg-destructive/10"
                    onClick={handleDesconectarMP}
                    disabled={isDisconnectingMP}
                  >
                    {isDisconnectingMP ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Desconectando...
                      </>
                    ) : (
                      <>
                        <Unlink className="mr-2 h-4 w-4" />
                        Desconectar cuenta
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Al conectar tu cuenta de MercadoPago, tus clientes podrán pagar directamente desde la app.
                  </p>
                  {getMercadoPagoAuthUrl() ? (
                    <Button
                      asChild
                      className="w-full bg-sky-500 hover:bg-sky-600 text-white"
                    >
                      <a href={getMercadoPagoAuthUrl()!}>
                        <Link2 className="mr-2 h-4 w-4" />
                        Conectar MercadoPago
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  ) : (
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      Configuración de MercadoPago no disponible. Contacta al soporte.
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Tarjeta de Cucuru */}
          <Card className={(restaurante as any)?.cucuruConfigurado ? "border-purple-500/50 bg-purple-50/50 dark:bg-purple-950/20" : "border-slate-200"}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Cucuru (Transferencias)
              </CardTitle>
              <CardDescription>
                {(restaurante as any)?.cucuruConfigurado
                  ? 'Tu billetera virtual Cucuru está configurada y activa'
                  : 'Ingresa tus credenciales de Cucuru para automatizar cobros'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(restaurante as any)?.cucuruConfigurado ? (
                <>
                  <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-medium">Webhooks configurados correctamente</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <p className="text-muted-foreground">
                      Tu sistema ya recibe notificaciones de pagos transferidos a tu cuenta Cucuru.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReenviarWebhookCucuru}
                    disabled={isReenviandoWebhookCucuru}
                    className="border-purple-300 text-purple-700 hover:bg-purple-100 dark:border-purple-700 dark:text-purple-300 dark:hover:bg-purple-900/30"
                  >
                    {isReenviandoWebhookCucuru ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reenviando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" /> Reenviar webhook HTTPS
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Copia tu API Key y Collector ID desde tu panel de Cucuru.
                  </p>
                  <div className="flex flex-col gap-2">
                    <Input
                      placeholder="API Key"
                      value={cucuruApiKey}
                      onChange={(e) => setCucuruApiKey(e.target.value)}
                      disabled={isConfiguringCucuru}
                    />
                    <Input
                      placeholder="Collector ID"
                      value={cucuruCollectorId}
                      onChange={(e) => setCucuruCollectorId(e.target.value)}
                      disabled={isConfiguringCucuru}
                    />
                    <Button
                      onClick={handleConfigurarCucuru}
                      disabled={isConfiguringCucuru || !cucuruApiKey.trim() || !cucuruCollectorId.trim()}
                      className="bg-purple-600 hover:bg-purple-700 text-white w-full"
                    >
                      {isConfiguringCucuru ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Configurando...
                        </>
                      ) : (
                        'Configurar Webhook'
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Tarjeta de Rapiboy */}
          <Card className={(restaurante as any)?.rapiboyToken ? "border-orange-500/50 bg-orange-50/50 dark:bg-orange-950/20" : "border-slate-200"}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Rapiboy (Logística)
              </CardTitle>
              <CardDescription>
                {(restaurante as any)?.rapiboyToken
                  ? 'Tu integración con Rapiboy está configurada y activa'
                  : 'Ingresa tu Token de Rapiboy para automatizar la logística de tus envíos'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(restaurante as any)?.rapiboyToken && (
                <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Token configurado correctamente</span>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Input
                  type="password"
                  placeholder={(restaurante as any)?.rapiboyToken ? "Ingresar nuevo Token de Rapiboy (opcional)" : "Token de Rapiboy"}
                  value={rapiboyToken}
                  onChange={(e) => setRapiboyToken(e.target.value)}
                  disabled={isConfiguringRapiboy}
                />

                <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-4 my-2 border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Para habilitar el seguimiento en tiempo real, ve a la sección 'Webhook' bajo la pestaña 'Mi Perfil' en Rapiboy y configura esta URL: <span className="font-mono font-bold">https://api.piru.app/api/webhooks/rapiboy</span>
                  </p>
                </div>

                <Button
                  onClick={handleConfigurarRapiboy}
                  disabled={isConfiguringRapiboy || !rapiboyToken.trim()}
                  className="bg-orange-600 hover:bg-orange-700 text-white w-full"
                >
                  {isConfiguringRapiboy ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...
                    </>
                  ) : (
                    (restaurante as any)?.rapiboyToken ? 'Actualizar Token' : 'Guardar Token'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tarjeta de Split Payment */}
          <Card className={restaurante?.splitPayment ? "border-indigo-500/50 bg-indigo-50/50 dark:bg-indigo-950/20" : ""}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Pagos Divididos
              </CardTitle>
              <CardDescription>
                {restaurante?.splitPayment
                  ? 'Tus clientes pueden pagar lo que consumieron'
                  : 'Tus clientes pagan el total de la mesa'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {restaurante?.splitPayment ? (
                <>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>• Los clientes seleccionan qué items pagar</p>
                    <p>• Ideal para grupos grandes</p>
                    <p>• Facilita el pago individual</p>
                  </div>
                  <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                    Split Payment Activo
                  </Badge>
                </>
              ) : (
                <>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>• Se genera un único ticket por mesa</p>
                    <p>• Un cliente paga el total (puede recolectar dinero)</p>
                    <p>• Flujo más rápido para mesas familiares</p>
                  </div>
                  <Badge variant="secondary">
                    Split Payment Inactivo
                  </Badge>
                </>
              )}
              <Button
                variant="outline"
                className="w-full"
                onClick={handleToggleSplitPayment}
                disabled={isTogglingSplitPayment}
              >
                {isTogglingSplitPayment ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cambiando...
                  </>
                ) : (
                  <>
                    {restaurante?.splitPayment ? (
                      <>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Desactivar Split Payment
                      </>
                    ) : (
                      <>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Activar Split Payment
                      </>
                    )}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>


          {/* Tarjeta de Sistema de Puntos */}
          <Card className={restaurante?.sistemaPuntos ? "border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20" : ""}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Star className="h-5 w-5" />
                Sistema de Puntos
              </CardTitle>
              <CardDescription>
                {restaurante?.sistemaPuntos
                  ? 'Fideliza a tus clientes premiando cada compra'
                  : 'Fideliza a tus clientes premiando cada compra'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {restaurante?.sistemaPuntos ? (
                <>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>• Los clientes acumulan puntos con cada compra</p>
                    <p>• Agrega productos que puedan ser canjeados</p>
                    <p>• Mejora la fidelización de clientes</p>
                  </div>
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
                    Sistema Activo
                  </Badge>
                </>
              ) : (
                <>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>• Sistema de fidelidad para retener clientes</p>
                    <p>• Asignarás puntos a los productos de tu menú</p>
                    <p>• Canjeable en futuros pedidos</p>
                  </div>
                  <Badge variant="secondary">
                    Sistema Inactivo
                  </Badge>
                </>
              )}
              <Button
                variant="outline"
                className="w-full"
                onClick={handleToggleSistemaPuntos}
                disabled={isTogglingSistemaPuntos}
              >
                {isTogglingSistemaPuntos ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cambiando...
                  </>
                ) : (
                  <>
                    <Star className="mr-2 h-4 w-4" />
                    {restaurante?.sistemaPuntos ? 'Desactivar Sistema de Puntos' : 'Activar Sistema de Puntos'}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Tarjeta de Diseño Alternativo */}
          <Card className={restaurante?.disenoAlternativo ? "border-pink-500/50 bg-pink-50/50 dark:bg-pink-950/20" : ""}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Store className="h-5 w-5" />
                Diseño de Cartas de Producto
              </CardTitle>
              <CardDescription>
                {restaurante?.disenoAlternativo
                  ? 'Tus productos se mostrarán con la imagen completa'
                  : 'Tus productos se mostrarán con el diseño original (glassmorphism)'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {restaurante?.disenoAlternativo ? (
                <>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>• Los clientes verán la imagen completa del producto sin el difuminado</p>
                    <p>• La descripción del producto será visible en la carta</p>
                    <p>• Ideal si quieres destacar tus fotos sobre tus productos</p>
                  </div>
                  <Badge variant="secondary" className="bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300">
                    Diseño Original Activo
                  </Badge>
                </>
              ) : (
                <>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>• Diseño premium con glassmorphism original</p>
                    <p>• Ideal para un look minimalista y moderno</p>
                  </div>
                  <Badge variant="secondary">
                    Diseño Original (Glassmorphism)
                  </Badge>
                </>
              )}
              <Button
                variant="outline"
                className="w-full"
                onClick={handleToggleDisenoAlternativo}
                disabled={isTogglingDisenoAlternativo}
              >
                {isTogglingDisenoAlternativo ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cambiando...
                  </>
                ) : (
                  <>
                    <Store className="mr-2 h-4 w-4" />
                    {restaurante?.disenoAlternativo ? 'Volver al Diseño Principal' : 'Activar Diseño 2 (Imagen Completa + Descripción)'}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Tarjeta de Pedido entre Amigos */}
          <Card className={(restaurante as any)?.orderGroupEnabled ? "border-teal-500/50 bg-teal-50/50 dark:bg-teal-950/20" : ""}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <UtensilsCrossed className="h-5 w-5" />
                Pedido entre Amigos
              </CardTitle>
              <CardDescription>
                {(restaurante as any)?.orderGroupEnabled
                  ? 'Los clientes pueden crear un link para armar pedidos grupales'
                  : 'El botón para armar pedidos entre amigos está oculto en el menú'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="text-base">Mostrar botón "Armar pedido entre amigos"</Label>
                  <p className="text-sm text-muted-foreground">
                    Cuando está activo, los clientes ven el botón para compartir un link y armar pedidos grupales.
                  </p>
                </div>
                <Switch
                  checked={(restaurante as any)?.orderGroupEnabled !== false}
                  onCheckedChange={() => handleToggleOrderGroupEnabled()}
                  disabled={isTogglingOrderGroupEnabled}
                />
              </div>
              {isTogglingOrderGroupEnabled && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Actualizando...
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tarjeta de Impresoras (Tauri Native) */}
          <Card className={selectedPrinter ? "border-green-500/50 bg-green-50/50 dark:bg-green-950/20" : ""}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Printer className="h-5 w-5" />
                Impresora de Comandas (Cocina)
              </CardTitle>
              <CardDescription>
                {selectedPrinter
                  ? `Impresora seleccionada: ${selectedPrinter}`
                  : 'Selecciona una impresora para las comandas'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedPrinter ? (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-2">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Impresora configurada</span>
                </div>
              ) : (
                <div className="text-sm text-yellow-600 dark:text-yellow-400 mb-2">
                  <p>Selecciona una impresora de la lista.</p>
                </div>
              )}

              <div className="grid gap-4">
                <Button
                  variant="outline"
                  onClick={handleListPrinters}
                  disabled={isListingPrinters}
                  className="w-full justify-start"
                >
                  {isListingPrinters ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <List className="mr-2 h-4 w-4" />}
                  Actualizar Lista de Impresoras
                </Button>

                {printers.length > 0 && (
                  <div className="space-y-2">
                    <Label>Seleccionar Impresora Predeterminada</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={selectedPrinter || ''}
                      onChange={(e) => setSelectedPrinter(e.target.value)}
                    >
                      <option value="">Seleccionar impresora...</option>
                      {printers.map((p, i) => (
                        <option key={i} value={p}>{p}</option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Esta impresora se usará automáticamente para las comandas de cocina.
                    </p>
                  </div>
                )}

                <Button
                  variant="outline"
                  onClick={handleTestPrint}
                  disabled={isPrintingTest || !selectedPrinter}
                  className="w-full justify-start"
                >
                  {isPrintingTest ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                  Imprimir Prueba de Comanda
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tarjeta de Zonas de Delivery */}
          <Suspense fallback={
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          }>
            <ZonasDeliveryMap />
          </Suspense>

          {/* Tarjeta de Horarios de Atención */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Horarios de Atención
              </CardTitle>
              <CardDescription>
                Define en qué horarios abrís cada día. Podés agregar varios turnos por día (ej: mediodía y noche).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!horariosLoaded ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {DIAS_SEMANA.map((nombreDia, diaIdx) => {
                    const turnos = horarios[diaIdx] || []
                    return (
                      <div key={diaIdx} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{nombreDia}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => agregarTurno(diaIdx)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Turno
                          </Button>
                        </div>
                        {turnos.length === 0 ? (
                          <p className="text-xs text-muted-foreground pl-1">Cerrado</p>
                        ) : (
                          turnos.map((turno, tIdx) => (
                            <div key={tIdx} className="flex items-center gap-2 pl-1">
                              <Input
                                type="time"
                                value={turno.horaApertura}
                                onChange={(e) => actualizarTurno(diaIdx, tIdx, 'horaApertura', e.target.value)}
                                className="w-28 h-8 text-xs"
                              />
                              <span className="text-xs text-muted-foreground">a</span>
                              <Input
                                type="time"
                                value={turno.horaCierre}
                                onChange={(e) => actualizarTurno(diaIdx, tIdx, 'horaCierre', e.target.value)}
                                className="w-28 h-8 text-xs"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => eliminarTurno(diaIdx, tIdx)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    )
                  })}
                  <Button
                    className="w-full"
                    onClick={guardarHorarios}
                    disabled={isSavingHorarios}
                  >
                    {isSavingHorarios ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      'Guardar Horarios'
                    )}
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    Si un turno cruza la medianoche (ej: 20:00 a 02:00), el sistema lo maneja automáticamente.
                    Los días sin turnos se consideran cerrados.
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Estadísticas Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Mesas Totales</p>
                <p className="text-3xl font-bold text-primary">
                  {restauranteStore.mesas.length}
                </p>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">Productos Activos</p>
                <p className="text-3xl font-bold text-primary">
                  {restauranteStore.productos.filter(p => p.activo).length}
                </p>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">Total Productos</p>
                <p className="text-3xl font-bold text-muted-foreground">
                  {restauranteStore.productos.length}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-lg text-destructive">Zona Peligrosa</CardTitle>
              <CardDescription>
                Acciones irreversibles con tu cuenta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar Sesión
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal de Editar Perfil */}
      <Dialog open={dialogAbierto} onOpenChange={setDialogAbierto}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Editar Perfil del Restaurante
            </DialogTitle>
            <DialogDescription>
              Modifica la información de tu restaurante
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Logo del Restaurante (Dark Mode)</Label>
                <ImageUpload
                  onImageChange={setImageBase64}
                  currentImage={imageBase64}
                  maxSize={5}
                />
                <p className="text-xs text-muted-foreground">
                  Se usa en el menú cuando está en Dark Mode (o por defecto). Tamaño máximo: 5MB.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Logo del Restaurante (Light Mode)</Label>
                <ImageUpload
                  onImageChange={setImageLightBase64}
                  currentImage={imageLightBase64}
                  maxSize={5}
                />
                <p className="text-xs text-muted-foreground">
                  Se usa en el menú cuando está en Light Mode. Tamaño máximo: 5MB.
                </p>
              </div>
            </div>

            <Separator />

            {/* Nombre */}
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre del Restaurante *</Label>
              <Input
                id="nombre"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Ej: Mi Restaurante"
                required
                disabled={isSubmitting}
              />
            </div>

            {/* Alias / Username */}
            <div className="space-y-2">
              <Label htmlFor="username">Alias (Link de Perfil)</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="Ej: mi-restaurante"
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">Tu enlace en Piru será: piru.app/{formData.username || 'tu-alias'}</p>
            </div>

            {/* Dirección */}
            <div className="space-y-2">
              <Label htmlFor="direccion">Dirección</Label>
              <Input
                id="direccion"
                value={formData.direccion}
                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                placeholder="Ej: Av. Principal 123"
                disabled={isSubmitting}
              />
            </div>

            {/* Teléfono */}
            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input
                id="telefono"
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                placeholder="Ej: +54 11 1234-5678"
                disabled={isSubmitting}
              />
            </div>

            {/* Delivery Fee */}
            <div className="space-y-2">
              <Label htmlFor="deliveryFee">Modificar costo del envio</Label>
              <Input
                id="deliveryFee"
                type="number"
                step="0.01"
                min="0"
                value={formData.deliveryFee}
                onChange={(e) => setFormData({ ...formData, deliveryFee: e.target.value })}
                placeholder="Ej: 800"
                disabled={isSubmitting}
              />
            </div>

            {/* Alias Transferencia */}
            {(!restaurante?.mpConnected && !restaurante?.cucuruConfigurado) && (
              <div className="space-y-2">
                <Label htmlFor="transferenciaAlias">Alias para Transferencias Manuales</Label>
                <Input
                  id="transferenciaAlias"
                  value={formData.transferenciaAlias}
                  onChange={(e) => setFormData({ ...formData, transferenciaAlias: e.target.value })}
                  placeholder="Ej: mi.restaurante.mp"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-muted-foreground">
                  Al no usar pasarelas automáticas, este alias se mostrará al cliente al finalizar el pedido.
                </p>
              </div>
            )}

            {/* WhatsApp Notifications */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-sm font-medium">Notificaciones por WhatsApp</h3>
              <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="text-base">Recibir pedidos por WhatsApp</Label>
                  <p className="text-sm text-muted-foreground">
                    Enviaremos una notificación a tu número cada vez que entre un nuevo pedido.
                  </p>
                </div>
                <Switch
                  checked={formData.whatsappEnabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, whatsappEnabled: checked })}
                  disabled={isSubmitting}
                />
              </div>

              {formData.whatsappEnabled && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <Label htmlFor="whatsappNumber">Número de WhatsApp</Label>
                  <Input
                    id="whatsappNumber"
                    value={formData.whatsappNumber}
                    onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                    placeholder="Ej: 54934123..."
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-muted-foreground">
                    Incluye el código de país sin el + (Ejemplo: 54934... para Argentina).
                  </p>
                </div>
              )}
            </div>

            {/* Colores */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-sm font-medium">Personalización de Colores</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="colorPrimario">Color Primario (Dark Mode Fondo)</Label>
                  <Input
                    id="colorPrimario"
                    type="color"
                    className="h-10 cursor-pointer"
                    value={formData.colorPrimario}
                    onChange={(e) => setFormData({ ...formData, colorPrimario: e.target.value })}
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-muted-foreground">Ej: #0a331d</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="colorSecundario">Color Secundario (Light Mode Fondo)</Label>
                  <Input
                    id="colorSecundario"
                    type="color"
                    className="h-10 cursor-pointer"
                    value={formData.colorSecundario}
                    onChange={(e) => setFormData({ ...formData, colorSecundario: e.target.value })}
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-muted-foreground">Ej: #eae7e0</p>
                </div>
              </div>
            </div>

            {/* Botones */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogAbierto(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar Cambios'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div >
  )
}

export default Perfil
