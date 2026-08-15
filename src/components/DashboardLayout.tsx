import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { useRestauranteStore } from '@/store/restauranteStore'
import { useModuloActivo } from '@/store/modulosStore'
import {
  LayoutDashboard,
  Package,
  Users,
  MessageSquare,
  TrendingUp,
  Settings,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  X,
  Blocks,
} from 'lucide-react'

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Inicio', path: '/dashboard/' },
  { icon: Package, label: 'Menú', path: '/dashboard/productos' },
  { icon: Users, label: 'Clientes', path: '/dashboard/clientes' },
  { icon: MessageSquare, label: 'Mensajes', path: '/dashboard/mensajes' },
  { icon: TrendingUp, label: 'Estadísticas', path: '/dashboard/metricas' },
]

const MENSAJES_PATH = '/dashboard/mensajes'

const DashboardLayout = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const restauranteStore = useRestauranteStore()
  const avisosAutomaticosActivos = useModuloActivo('avisos_automaticos_whatsapp')
  const motorRecompraActivo = useModuloActivo('motor_recompra')
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('piru-sidebar-collapsed') === '1')

  // Aplicar el tema guardado al iniciar. El cambio de tema vive en Ajustes > Cuenta.
  useEffect(() => {
    const stored = localStorage.getItem('piru-theme')
    const isDark = stored
      ? stored === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches

    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  // Persist collapse state
  useEffect(() => {
    localStorage.setItem('piru-sidebar-collapsed', collapsed ? '1' : '0')
  }, [collapsed])

  // Escape cierra el drawer móvil (reemplaza el esc del Sheet overlay viejo).
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  // Fetch restaurante data on mount
  useEffect(() => {
    if (!restauranteStore.restaurante) {
      restauranteStore.fetchData()
    }
  }, [])

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

  const suscripcionActivaEnRuta = location.pathname.startsWith('/dashboard/suscripcion')

  // Mensajes concentra los cupos de Avisos y Motor; sólo aparece si alguno está activo.
  const navItems = NAV_ITEMS.filter(
    (item) => item.path !== MENSAJES_PATH || avisosAutomaticosActivos || motorRecompraActivo,
  )

  const renderPlanButton = (compact: boolean) => {
    return (
      <div className="px-3 pt-2 space-y-1">
        <button
          onClick={() => handleNavigation('/dashboard/suscripcion')}
          title={compact ? 'Mi suscripción' : undefined}
          className={`group w-full flex items-center gap-3 rounded-xl h-11 text-sm font-medium transition-all cursor-pointer ${
            compact ? 'justify-center px-0' : 'px-3'
          } ${
            suscripcionActivaEnRuta
              ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
        >
          <Sparkles className={`h-[18px] w-[18px] shrink-0 ${suscripcionActivaEnRuta ? '' : 'text-muted-foreground group-hover:text-foreground'}`} />
          {!compact && <span className="flex-1 text-left">Mi suscripción</span>}
        </button>
        <button
          onClick={() => handleNavigation('/dashboard/modulos')}
          title={compact ? 'Módulos' : undefined}
          className={`group w-full flex items-center gap-3 rounded-xl h-11 text-sm font-medium transition-all cursor-pointer ${
            compact ? 'justify-center px-0' : 'px-3'
          } ${
            isActive('/dashboard/modulos')
              ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
        >
          <Blocks className={`h-[18px] w-[18px] shrink-0 ${isActive('/dashboard/modulos') ? '' : 'text-muted-foreground group-hover:text-foreground'}`} />
          {!compact && <span className="flex-1 text-left">Módulos</span>}
        </button>
      </div>
    )
  }

  // `compact` = rail de solo iconos (aplica en el sidebar de escritorio).
  // `drawer` = versión móvil (push): el botón de cabecera cierra el drawer.
  const renderSidebar = (compact: boolean, drawer = false) => (
    <div className="flex h-full flex-col">
      {/* Cabecera: botón para colapsar/expandir */}
      <div className={`flex items-center h-16 shrink-0 ${compact ? 'justify-center px-2' : 'justify-end px-3'}`}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => (drawer ? setMenuOpen(false) : setCollapsed((v) => !v))}
          title={drawer ? 'Cerrar menú' : compact ? 'Expandir menú' : 'Comprimir menú'}
          className="text-muted-foreground hover:text-foreground"
        >
          {drawer ? <X className="h-5 w-5" /> : compact ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </Button>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.path)
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
            </button>
          )
        })}
      </nav>

      {/* Botón de plan: muestra el plan actual y lleva a "Tu plan" (ver / mejorar) */}
      {renderPlanButton(compact)}

      {/* Footer: ajustes */}
      <div className="p-3 space-y-1 shrink-0">
        <button
          onClick={() => handleNavigation('/dashboard/ajustes')}
          title={compact ? 'Ajustes' : undefined}
          className={`group w-full flex items-center gap-3 rounded-xl h-11 text-sm font-medium transition-all cursor-pointer ${
            compact ? 'justify-center px-0' : 'px-3'
          } ${
            isActive('/dashboard/ajustes')
              ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
        >
          <Settings className={`h-[18px] w-[18px] ${isActive('/dashboard/ajustes') ? '' : 'text-muted-foreground group-hover:text-foreground'}`} />
          {!compact && 'Ajustes'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-[#FFFBF0] dark:bg-background">
      {/* Sidebar fijo (desktop) — comprimible */}
      <aside
        className={`hidden md:flex shrink-0 flex-col bg-background transition-[width] duration-200 ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        {renderSidebar(collapsed)}
      </aside>

      {/* Sidebar móvil (push) — en el flujo flex: se extiende a la misma altura que el
          contenido y lo comprime hacia la derecha, en vez de abrirse por encima (el viejo
          Sheet era un overlay fixed). Se abre/cierra animando el ancho w-0 ↔ w-64. */}
      <aside
        className={`md:hidden flex shrink-0 flex-col bg-background border-r border-border transition-[width] duration-200 overflow-hidden ${
          menuOpen ? 'w-64' : 'w-0'
        }`}
      >
        {renderSidebar(false, true)}
      </aside>

      {/* Contenido principal */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Barra superior sólo en móvil (para abrir/cerrar el drawer push) */}
        <div className="md:hidden flex items-center gap-2 h-14 px-3 bg-[#FFFBF0] dark:bg-background shrink-0">
          <Button variant="ghost" size="icon" onClick={() => setMenuOpen((v) => !v)}>
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        {/* Tocar el contenido cierra el drawer (sin scrim: el contenido queda visible). */}
        <main
          className="flex-1 min-h-0 overflow-y-auto"
          onClick={() => menuOpen && setMenuOpen(false)}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default DashboardLayout
