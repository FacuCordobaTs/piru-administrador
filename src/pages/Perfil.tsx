import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { restauranteApi, mercadopagoApi, ApiError } from '@/lib/api'
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
  ShoppingCart,
  Printer,
  List
} from 'lucide-react'
import { usePrinter } from '@/context/PrinterContext'
import { commandsToBytes } from '@/utils/printerUtils'

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
  })
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [isDisconnectingMP, setIsDisconnectingMP] = useState(false)
  const [isTogglingCarrito, setIsTogglingCarrito] = useState(false)
  const [isTogglingSplitPayment, setIsTogglingSplitPayment] = useState(false)

  // Tauri Printer State
  const { printers, selectedPrinter, setSelectedPrinter, refreshPrinters, printRaw } = usePrinter()
  const [isListingPrinters, setIsListingPrinters] = useState(false)
  const [isPrintingTest, setIsPrintingTest] = useState(false)

  useEffect(() => {
    if (!restaurante) {
      restauranteStore.fetchData()
    }
  }, [])

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

  // Toggle modo carrito
  const handleToggleCarrito = async () => {
    if (!token) return

    setIsTogglingCarrito(true)
    try {
      const response = await restauranteApi.toggleCarrito(token) as { success: boolean; esCarrito: boolean }
      if (response.success) {
        toast.success(response.esCarrito ? 'Modo carrito activado' : 'Modo restaurante activado', {
          description: response.esCarrito
            ? 'Los pedidos ahora se identifican por nombre del cliente'
            : 'Los pedidos ahora se identifican por número de mesa'
        })
        restauranteStore.fetchData()
      }
    } catch (error) {
      console.error('Error al cambiar modo:', error)
      toast.error('Error al cambiar el modo')
    } finally {
      setIsTogglingCarrito(false)
    }
  }

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

  const abrirDialogEditar = () => {
    if (restaurante) {
      setFormData({
        nombre: restaurante.nombre || '',
        direccion: restaurante.direccion || '',
        telefono: restaurante.telefono || '',
      })
      setImageBase64(restaurante.imagenUrl || null)
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
      // Si la imagen es nueva (base64), enviarla
      if (imageBase64 && imageBase64.startsWith('data:image')) {
        updateData.image = imageBase64
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

          {/* Tarjeta de Modo Carrito */}
          <Card className={restaurante?.esCarrito ? "border-orange-500/50 bg-orange-50/50 dark:bg-orange-950/20" : ""}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Modo de Operación
              </CardTitle>
              <CardDescription>
                {restaurante?.esCarrito
                  ? 'Operando como carrito de comidas'
                  : 'Operando como restaurante con mesas'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {restaurante?.esCarrito ? (
                <>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>• Pedidos identificados por nombre del cliente</p>
                    <p>• Los clientes pagan antes de recibir el pedido</p>
                    <p>• Notificación cuando el pedido está listo</p>
                  </div>
                  <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                    Modo Carrito Activo
                  </Badge>
                </>
              ) : (
                <>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>• Pedidos identificados por número de mesa</p>
                    <p>• Los clientes pagan después de recibir el pedido</p>
                    <p>• Flujo tradicional de restaurante</p>
                  </div>
                  <Badge variant="secondary">
                    Modo Restaurante Activo
                  </Badge>
                </>
              )}
              <Button
                variant="outline"
                className="w-full"
                onClick={handleToggleCarrito}
                disabled={isTogglingCarrito}
              >
                {isTogglingCarrito ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cambiando...
                  </>
                ) : (
                  <>
                    {restaurante?.esCarrito ? (
                      <>
                        <Store className="mr-2 h-4 w-4" />
                        Cambiar a Restaurante
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        Cambiar a Carrito
                      </>
                    )}
                  </>
                )}
              </Button>
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
            <CardContent>
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
            {/* Imagen del restaurante */}
            <div className="space-y-2">
              <Label>Logo del Restaurante</Label>
              <ImageUpload
                onImageChange={setImageBase64}
                currentImage={imageBase64}
                maxSize={5}
              />
              <p className="text-xs text-muted-foreground">
                Sube el logo de tu restaurante. Tamaño máximo: 5MB.
              </p>
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
