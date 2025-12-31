import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { toast } from 'sonner'
import { 
  LayoutDashboard, 
  ClipboardList, 
  Package, 
  Menu, 
  LogOut,
  Sun,
  Moon
} from 'lucide-react'

const DashboardLayout = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const logout = useAuthStore((state) => state.logout)
  const restauranteStore = useRestauranteStore()
  const { restaurante } = useAuthStore()
  const [isDark, setIsDark] = useState(() => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const [menuOpen, setMenuOpen] = useState(false)

  // Apply theme on mount
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDark])

  // Fetch restaurante data on mount
  useEffect(() => {
    if (!restauranteStore.restaurante) {
      restauranteStore.fetchData()
    }
  }, [])

  const toggleTheme = () => {
    setIsDark(!isDark)
  }

  const handleLogout = () => {
    logout()
    restauranteStore.reset()
    toast.success('Sesión cerrada exitosamente')
    navigate('/login')
    setMenuOpen(false)
  }

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: ClipboardList, label: 'Pedidos', path: '/dashboard/pedidos' },
    { icon: Package, label: 'Productos', path: '/dashboard/productos' },
  ]

  const handleNavigation = (path: string) => {
    navigate(path)
    setMenuOpen(false)
  }

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="min-h-screen bg-background">
      {/* Header con botón de menú - siempre visible */}
      <header className="sticky top-0 z-50 bg-card border-b">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                {/* Logo */}
                <div className="flex items-center px-6 h-14 border-b">
                  <h1 className="text-2xl font-bold bg-linear-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                    PIRU
                  </h1>
                </div>
                
                {/* Navigation */}
                <nav className="flex flex-col p-4 space-y-1">
                  {menuItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <Button
                        key={item.path}
                        variant={isActive(item.path) ? 'default' : 'ghost'}
                        className={`w-full justify-start h-11 ${
                          isActive(item.path) 
                            ? 'bg-primary text-primary-foreground shadow-md' 
                            : 'hover:bg-accent'
                        }`}
                        onClick={() => handleNavigation(item.path)}
                      >
                        <Icon className="mr-3 h-5 w-5" />
                        {item.label}
                      </Button>
                    )
                  })}
                </nav>
                
                {/* Footer del menú */}
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-card">
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-12 mb-2"
                    onClick={() => handleNavigation('/dashboard/perfil')}
                  >
                    <Avatar className="h-8 w-8 mr-3">
                      <AvatarImage src={restauranteStore.restaurante?.imagenUrl || ''} />
                      <AvatarFallback>
                        {restaurante?.nombre?.charAt(0).toUpperCase() || 'R'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col items-start flex-1 min-w-0">
                      <span className="text-sm font-medium truncate w-full">
                        {restaurante?.nombre || 'Mi Restaurante'}
                      </span>
                      <span className="text-xs text-muted-foreground">Ver perfil</span>
                    </div>
                  </Button>
                  
                  <Separator className="my-2" />
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="flex-1 h-10"
                      onClick={toggleTheme}
                      title={isDark ? 'Modo Claro' : 'Modo Oscuro'}
                    >
                      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 h-10 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={handleLogout}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Salir
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            
            <h1 className="text-xl font-bold bg-linear-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              PIRU
            </h1>
          </div>
          
          {/* Acciones rápidas en el header */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              title={isDark ? 'Modo Claro' : 'Modo Oscuro'}
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard/perfil')}
              title="Ver perfil"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={restauranteStore.restaurante?.imagenUrl || ''} />
                <AvatarFallback className="text-xs">
                  {restaurante?.nombre?.charAt(0).toUpperCase() || 'R'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content - ahora sin padding lateral del sidebar */}
      <main>
        <div className="p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default DashboardLayout
