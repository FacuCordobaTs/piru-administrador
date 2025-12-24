import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useRestauranteStore } from '@/store/restauranteStore'
import { Table, Bell, Package, DollarSign, Loader2 } from 'lucide-react'

const Dashboard = () => {
  const navigate = useNavigate()
  const { mesas, productos, isLoading, fetchData, restaurante } = useRestauranteStore()

  useEffect(() => {
    if (!restaurante) {
      fetchData()
    }
  }, [])

  const productosActivos = productos.filter(p => p.activo).length

  const stats = [
    { 
      title: 'Mesas Totales', 
      value: mesas.length.toString(), 
      icon: Table, 
      color: 'text-primary',
      onClick: () => navigate('/dashboard/mesas')
    },
    { 
      title: 'Notificaciones', 
      value: '0', 
      icon: Bell, 
      color: 'text-orange-500',
      onClick: () => navigate('/dashboard/notificaciones')
    },
    { 
      title: 'Productos Activos', 
      value: productosActivos.toString(), 
      icon: Package, 
      color: 'text-blue-500',
      onClick: () => navigate('/dashboard/productos')
    },
    { 
      title: 'Total Productos', 
      value: productos.length.toString(), 
      icon: DollarSign, 
      color: 'text-green-500',
      onClick: () => navigate('/dashboard/productos')
    },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Bienvenido, {restaurante?.nombre || 'Restaurante'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <Card 
              key={stat.title}
              className={`transition-all duration-300 hover:shadow-lg cursor-pointer ${
                stat.onClick ? 'hover:scale-105' : ''
              }`}
              onClick={stat.onClick}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Accesos Rápidos</CardTitle>
            <CardDescription>Navega a las secciones principales</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => navigate('/dashboard/mesas')}
            >
              <Table className="mr-2 h-4 w-4" />
              Ver Mesas
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => navigate('/dashboard/notificaciones')}
            >
              <Bell className="mr-2 h-4 w-4" />
              Ver Notificaciones
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => navigate('/dashboard/productos')}
            >
              <Package className="mr-2 h-4 w-4" />
              Gestionar Productos
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Información del Restaurante</CardTitle>
            <CardDescription>Datos de tu restaurante</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">{restaurante?.nombre || 'Sin nombre'}</p>
                  <p className="text-xs text-muted-foreground">{restaurante?.email}</p>
                </div>
              </div>
              {restaurante?.direccion && (
                <div className="flex items-center space-x-4">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">Dirección</p>
                    <p className="text-xs text-muted-foreground">{restaurante.direccion}</p>
                  </div>
                </div>
              )}
              {restaurante?.telefono && (
                <div className="flex items-center space-x-4">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">Teléfono</p>
                    <p className="text-xs text-muted-foreground">{restaurante.telefono}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default Dashboard

