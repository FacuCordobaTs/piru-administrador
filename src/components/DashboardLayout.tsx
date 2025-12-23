import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { 
  LayoutDashboard, 
  Table, 
  Bell, 
  Package, 
  Menu, 
  LogOut,
  Sun,
  Moon
} from 'lucide-react'

const DashboardLayout = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [isDark, setIsDark] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const toggleTheme = () => {
    setIsDark(!isDark)
    document.documentElement.classList.toggle('dark')
  }

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Table, label: 'Mesas', path: '/dashboard/mesas' },
    { icon: Bell, label: 'Notificaciones', path: '/dashboard/notificaciones' },
    { icon: Package, label: 'Productos', path: '/dashboard/productos' },
  ]

  const handleNavigation = (path: string) => {
    navigate(path)
    setMobileMenuOpen(false)
  }

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col border-r bg-card">
        <div className="flex flex-col grow pt-5 pb-4 overflow-y-auto">
          <div className="flex items-center shrink-0 px-4 mb-8">
            <h1 className="text-2xl font-bold bg-linear-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              PIRU
            </h1>
          </div>
          <nav className="flex-1 px-4 space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon
              return (
                <Button
                  key={item.path}
                  variant={isActive(item.path) ? 'default' : 'ghost'}
                  className={`w-full justify-start transition-all ${
                    isActive(item.path) 
                      ? 'bg-primary text-primary-foreground shadow-md' 
                      : 'hover:bg-accent'
                  }`}
                  onClick={() => handleNavigation(item.path)}
                >
                  <Icon className="mr-2 h-5 w-5" />
                  {item.label}
                </Button>
              )
            })}
          </nav>
          <div className="px-4 space-y-2">
            <Separator />
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={toggleTheme}
            >
              {isDark ? <Sun className="mr-2 h-5 w-5" /> : <Moon className="mr-2 h-5 w-5" />}
              {isDark ? 'Modo Claro' : 'Modo Oscuro'}
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-destructive hover:text-destructive"
              onClick={() => navigate('/login')}
            >
              <LogOut className="mr-2 h-5 w-5" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden sticky top-0 z-50 bg-card border-b">
        <div className="flex items-center justify-between px-4 h-16">
          <h1 className="text-xl font-bold bg-linear-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            PIRU
          </h1>
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64">
              <nav className="flex flex-col space-y-2 mt-8">
                {menuItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <Button
                      key={item.path}
                      variant={isActive(item.path) ? 'default' : 'ghost'}
                      className={`w-full justify-start ${
                        isActive(item.path) 
                          ? 'bg-primary text-primary-foreground' 
                          : ''
                      }`}
                      onClick={() => handleNavigation(item.path)}
                    >
                      <Icon className="mr-2 h-5 w-5" />
                      {item.label}
                    </Button>
                  )
                })}
                <Separator className="my-4" />
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={toggleTheme}
                >
                  {isDark ? <Sun className="mr-2 h-5 w-5" /> : <Moon className="mr-2 h-5 w-5" />}
                  {isDark ? 'Modo Claro' : 'Modo Oscuro'}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-destructive"
                  onClick={() => navigate('/login')}
                >
                  <LogOut className="mr-2 h-5 w-5" />
                  Cerrar Sesión
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Main Content */}
      <main className="md:pl-64">
        <div className="p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default DashboardLayout

