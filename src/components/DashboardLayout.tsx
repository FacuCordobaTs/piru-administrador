import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore, type SuscripcionResumen } from '@/store/restauranteStore'
import { useTareasPendientes } from '@/pages/ajustes/hooks/useTareasPendientes'
import { toast } from 'sonner'
import {
  LayoutDashboard,
  Package,
  Users,
  MessageSquare,
  TrendingUp,
  Settings,
  Sun,
  Moon,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Crown,
  ArrowUpRight,
  ChevronRight,
} from 'lucide-react'

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Inicio', path: '/dashboard/' },
  { icon: Package, label: 'Menú', path: '/dashboard/productos' },
  { icon: Users, label: 'Clientes', path: '/dashboard/clientes' },
  { icon: MessageSquare, label: 'Mensajes', path: '/dashboard/mensajes' },
  { icon: TrendingUp, label: 'Estadísticas', path: '/dashboard/metricas' },
  { icon: Settings, label: 'Ajustes', path: '/dashboard/ajustes' },
]

// El item "Mensajes" (wallet de avisos + campañas por WhatsApp) sólo aplica a planes con avisos
// al cliente (Intermedio+). Se detecta por el feature `avisos_whatsapp_cliente`, que además cubre
// a las cuentas pre-planes (fail-open, con acceso total). En Básico no se muestra.
const MENSAJES_PATH = '/dashboard/mensajes'
const puedeVerMensajes = (suscripcion: SuscripcionResumen | null): boolean => {
  if (!suscripcion) return false
  return (
    suscripcion.features?.includes('avisos_whatsapp_cliente') ||
    suscripcion.planCodigo === 'intermedio' ||
    suscripcion.planCodigo === 'avanzado'
  )
}

const DashboardLayout = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const logout = useAuthStore((state) => state.logout)
  const restauranteStore = useRestauranteStore()
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem('piru-theme')
    if (stored) return stored === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('piru-sidebar-collapsed') === '1')

  // Badge discreto de "cosas por configurar" sobre el item de Ajustes.
  const { pendientes, loading: tareasLoading } = useTareasPendientes()
  const tareasPendientes = !tareasLoading && pendientes > 0

  // Apply + persist theme
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('piru-theme', isDark ? 'dark' : 'light')
  }, [isDark])

  // Persist collapse state
  useEffect(() => {
    localStorage.setItem('piru-sidebar-collapsed', collapsed ? '1' : '0')
  }, [collapsed])

  // Fetch restaurante data on mount
  useEffect(() => {
    if (!restauranteStore.restaurante) {
      restauranteStore.fetchData()
    }
  }, [])

  const toggleTheme = () => setIsDark((v) => !v)

  const handleLogout = () => {
    logout()
    restauranteStore.reset()
    toast.success('Sesión cerrada exitosamente')
    navigate('/login')
    setMenuOpen(false)
  }

  const isActive = (path: string) => {
    if (path === '/dashboard/') {
      return location.pathname === '/dashboard' || location.pathname === '/dashboard/'
    }
    return location.pathname.startsWith(path)
  }

  const handleNavigation = (path: string) => {
    navigate(path)
    setMenuOpen(false)
  }

  // Botón de plan: el plan actual vive en el store (ya viene del profile, sin fetch extra).
  const suscripcion = restauranteStore.suscripcion
  const planActivoEnRuta = location.pathname.startsWith('/dashboard/plan')

  // "Mensajes" sólo visible para planes con avisos al cliente (Intermedio+).
  const navItems = NAV_ITEMS.filter(
    (item) => item.path !== MENSAJES_PATH || puedeVerMensajes(suscripcion),
  )

  const renderPlanButton = (compact: boolean) => {
    const sinPlan = !suscripcion || suscripcion.sinSuscripcion || !suscripcion.planNombre
    // Hay a dónde mejorar salvo que ya estés en el tope (Avanzado). La flecha ascendente (abajo)
    // comunica el "mejorá" por UI; el subtítulo sólo describe el estado, sin instrucción textual.
    const puedeMejorar = !sinPlan && suscripcion?.planCodigo !== 'avanzado'
    const ESTADO_SUB: Record<string, string> = {
      trial: 'Prueba gratis',
      activa: 'Al día',
      pago_pendiente: 'Pago pendiente',
      suspendida: 'Suspendida',
      cancelada: 'Cancelada',
    }
    const titulo = sinPlan ? 'Activá tu plan' : `Plan ${suscripcion!.planNombre}`
    const subtitulo = sinPlan
      ? 'Sin plan activo'
      : (suscripcion?.estado && ESTADO_SUB[suscripcion.estado]) || 'Tu plan'

    return (
      <div className="px-3 pt-2">
        <button
          onClick={() => handleNavigation('/dashboard/plan')}
          title={compact ? titulo : undefined}
          className={`group w-full flex items-center gap-3 rounded-xl transition-colors cursor-pointer ${
            compact ? 'justify-center h-11 px-0' : 'px-2.5 py-2.5'
          } ${planActivoEnRuta ? 'bg-muted' : 'hover:bg-muted/60'}`}
        >
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              sinPlan ? 'bg-amber-500/10 text-amber-600 dark:text-amber-500' : 'bg-brand/10 text-brand'
            }`}
          >
            <Crown className="h-[15px] w-[15px]" />
          </span>
          {!compact && (
            <>
              <span className="flex-1 min-w-0 text-left">
                <span className="block truncate text-[13.5px] font-medium text-foreground">{titulo}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{subtitulo}</span>
              </span>
              {puedeMejorar || sinPlan ? (
                <ArrowUpRight className="h-4 w-4 shrink-0 text-brand" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
              )}
            </>
          )}
        </button>
      </div>
    )
  }

  // `compact` = rail de solo iconos (aplica en el sidebar de escritorio)
  const renderSidebar = (compact: boolean) => (
    <div className="flex h-full flex-col">
      {/* Cabecera: botón para colapsar/expandir */}
      <div className={`flex items-center h-16 shrink-0 ${compact ? 'justify-center px-2' : 'justify-end px-3'}`}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed((v) => !v)}
          title={compact ? 'Expandir menú' : 'Comprimir menú'}
          className="text-muted-foreground hover:text-foreground"
        >
          {compact ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </Button>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.path)
          const showBadge = item.path === '/dashboard/ajustes' && tareasPendientes
          return (
            <button
              key={item.path}
              onClick={() => handleNavigation(item.path)}
              title={compact ? item.label : undefined}
              className={`group relative w-full flex items-center gap-3 rounded-xl h-11 text-sm font-medium transition-all cursor-pointer ${
                compact ? 'justify-center px-0' : 'px-3'
              } ${
                active
                  ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              <Icon
                className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                  active ? '' : 'text-muted-foreground group-hover:text-foreground'
                }`}
              />
              {!compact && <span className="flex-1 text-left">{item.label}</span>}
              {/* Expandido: pill con la cantidad. Comprimido: puntito sobre el icono. */}
              {showBadge && !compact && (
                <span
                  className={`min-w-5 rounded-full px-1.5 text-center text-[11px] font-semibold tabular-nums ${
                    active
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-500'
                  }`}
                >
                  {pendientes}
                </span>
              )}
              {showBadge && compact && (
                <span
                  aria-hidden
                  className="absolute right-2 top-2 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-background"
                />
              )}
            </button>
          )
        })}
      </nav>

      {/* Botón de plan: muestra el plan actual y lleva a "Tu plan" (ver / mejorar) */}
      {renderPlanButton(compact)}

      {/* Footer: tema + salir */}
      <div className="p-3 border-t space-y-1 shrink-0">
        <button
          onClick={toggleTheme}
          title={compact ? (isDark ? 'Modo claro' : 'Modo oscuro') : undefined}
          className={`w-full flex items-center gap-3 rounded-xl h-11 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all cursor-pointer ${
            compact ? 'justify-center px-0' : 'px-3'
          }`}
        >
          {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          {!compact && (isDark ? 'Modo claro' : 'Modo oscuro')}
        </button>
        <button
          onClick={handleLogout}
          title={compact ? 'Cerrar sesión' : undefined}
          className={`w-full flex items-center gap-3 rounded-xl h-11 text-sm font-medium text-destructive hover:bg-destructive/10 transition-all cursor-pointer ${
            compact ? 'justify-center px-0' : 'px-3'
          }`}
        >
          <LogOut className="h-[18px] w-[18px]" />
          {!compact && 'Cerrar sesión'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar fijo (desktop) — comprimible */}
      <aside
        className={`hidden md:flex shrink-0 flex-col border-r bg-background transition-[width] duration-200 ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        {renderSidebar(collapsed)}
      </aside>

      {/* Sidebar móvil (drawer) — siempre expandido */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-64 p-0 bg-background">
          {renderSidebar(false)}
        </SheetContent>
      </Sheet>

      {/* Contenido principal */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Barra superior sólo en móvil (para abrir el drawer) */}
        <div className="md:hidden flex items-center gap-2 h-14 px-3 border-b bg-background shrink-0">
          <Button variant="ghost" size="icon" onClick={() => setMenuOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        <main className="flex-1 min-h-0 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default DashboardLayout
