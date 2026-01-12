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
  CheckCircle2
} from 'lucide-react'

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
    </div>
  )
}

export default Perfil

