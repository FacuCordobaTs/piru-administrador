import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { toast } from 'sonner'
import { 
  Mail, 
  MapPin, 
  Phone, 
  Calendar, 
  Edit, 
  LogOut,
  Store,
  Loader2
} from 'lucide-react'

const Perfil = () => {
  const navigate = useNavigate()
  const logout = useAuthStore((state) => state.logout)
  const restauranteStore = useRestauranteStore()
  const { restaurante, isLoading } = restauranteStore

  useEffect(() => {
    if (!restaurante) {
      restauranteStore.fetchData()
    }
  }, [])

  const handleLogout = () => {
    logout()
    restauranteStore.reset()
    toast.success('Sesión cerrada exitosamente')
    navigate('/login')
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
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
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
              <Button variant="outline">
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
    </div>
  )
}

export default Perfil

