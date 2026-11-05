import { lazy, Suspense, useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { useRestauranteStore } from '@/store/restauranteStore'
import { useModuloActivo } from '@/store/modulosStore'
import { useAuthStore } from '@/store/authStore'
import { useDatosEjemplo } from '@/store/datosEjemploStore'
import { esSesionDemo } from '@/lib/api'
import { recorridoVisto, useRecorridoPanel } from '@/lib/recorridoPanel'
import { DemoBanner } from '@/components/DemoBanner'
import {
  LayoutDashboard,
  Package,
  Blocks,
  Megaphone,
  MessageCircle,
  MessageSquare,
  CalendarDays,
  Sparkles,
  Ticket,
  TrendingUp,
  Settings,
  Shirt,
  Users,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  Armchair,
  Bike,
  Boxes,
  Monitor,
  Printer,
  Receipt,
  Store,
} from 'lucide-react'

// El recorrido de bienvenida se carga aparte: el uso de todos los días no lo descarga.
const RecorridoPanel = lazy(() => import('@/components/recorrido/RecorridoPanel'))

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Inicio', path: '/dashboard/', modulo: null },
  { icon: Package, label: 'Menú', path: '/dashboard/productos', modulo: null },
  { icon: Shirt, label: 'Ropa', path: '/dashboard/ropa', modulo: null },
  // Herramientas de operación: cada módulo activo suma su propia pantalla.
  { icon: Boxes, label: 'Stock', path: '/dashboard/stock', modulo: 'gestion_stock' },
  { icon: Monitor, label: 'Punto de venta', path: '/dashboard/punto-de-venta', modulo: 'pos' },
  { icon: Armchair, label: 'Mesas', path: '/dashboard/mesas', modulo: 'mesas' },
  { icon: Bike, label: 'Cadetes', path: '/dashboard/repartidores', modulo: 'gestion_cadetes' },
  { icon: Store, label: 'Sucursales', path: '/dashboard/sucursales', modulo: 'multisucursal' },
  { icon: Receipt, label: 'Facturación', path: '/dashboard/facturacion', modulo: 'facturacion_arca' },
  { icon: Printer, label: 'Impresión', path: '/dashboard/impresion', modulo: 'impresion_comandas' },
  // Las tabs de Marketing ahora viven en el navbar del panel. Cada una se
  // muestra sólo con el módulo que la habilita (ver `navItems`).
  { icon: Users, label: 'Clientes', path: '/dashboard/marketing/clientes', modulo: null },
  { icon: MessageCircle, label: 'Hoy', path: '/dashboard/marketing/hoy', modulo: 'motor_recompra' },
  { icon: CalendarDays, label: 'Días flojos', path: '/dashboard/marketing/dias-flojos', modulo: 'dias_flojos' },
  { icon: Megaphone, label: 'Campañas', path: '/dashboard/marketing/campanas', modulo: 'crecimiento' },
  { icon: Sparkles, label: 'Puntos', path: '/dashboard/marketing/puntos', modulo: 'puntos_clientes' },
  { icon: Ticket, label: 'Cupones', path: '/dashboard/marketing/cupones', modulo: 'codigos_descuento' },
  { icon: MessageSquare, label: 'Mensajes', path: '/dashboard/mensajes', modulo: 'avisos_automaticos_whatsapp' },
  { icon: TrendingUp, label: 'Estadísticas', path: '/dashboard/metricas', modulo: null },
] as const

/** Tienda de indumentaria: pantalla de un solo local. El backend también lo exige. */
const ROPA_PATH = '/dashboard/ropa'
const ROPA_RESTAURANTE_ID = 6

const DashboardLayout = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const restauranteStore = useRestauranteStore()
  // Del authStore, no del restauranteStore: está disponible apenas hay sesión, sin esperar
  // a que resuelva fetchData().
  const restauranteId = useAuthStore((s) => s.restaurante?.id)
  const avisosAutomaticosActivos = useModuloActivo('avisos_automaticos_whatsapp')
  const recompraActiva = useModuloActivo('motor_recompra')
  const diasFlojosActivo = useModuloActivo('dias_flojos')
  const campanasActivas = useModuloActivo('crecimiento')
  const puntosActivos = useModuloActivo('puntos_clientes')
  const cuponesActivos = useModuloActivo('codigos_descuento')
  const stockActivo = useModuloActivo('gestion_stock')
  const posActivo = useModuloActivo('pos')
  const mesasActivo = useModuloActivo('mesas')
  const cadetesActivos = useModuloActivo('gestion_cadetes')
  const multisucursalActiva = useModuloActivo('multisucursal')
  const facturacionActiva = useModuloActivo('facturacion_arca')
  const impresionActiva = useModuloActivo('impresion_comandas')
  const token = useAuthStore((s) => s.token)
  const esDemo = esSesionDemo(token)
  const abrirRecorrido = useRecorridoPanel((s) => s.abrir)
  const recorridoMontado = useRecorridoPanel((s) => s.vez > 0)
  // Sube cuando se borran o se vuelven a cargar los datos de ejemplo: la pantalla pide sus datos de nuevo.
  const versionDatos = useDatosEjemplo((s) => s.version)
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

  // La primera vez que alguien entra por la demo de prospección, el recorrido se abre solo.
  useEffect(() => {
    if (esDemo && restauranteId != null && !recorridoVisto(restauranteId)) abrirRecorrido()
  }, [esDemo, restauranteId, abrirRecorrido])

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


  // Mensajes es el saldo de los avisos por WhatsApp: sin ese módulo no hay nada que mostrar.
  // Ropa es de un solo local: el filtro es por id, no por módulo contratable.
  // El resto de las tabs de clientes y crecimiento se muestran sólo con su módulo.
  const modulosActivos: Record<string, boolean> = {
    avisos_automaticos_whatsapp: avisosAutomaticosActivos,
    motor_recompra: recompraActiva,
    dias_flojos: diasFlojosActivo,
    crecimiento: campanasActivas,
    puntos_clientes: puntosActivos,
    codigos_descuento: cuponesActivos,
    gestion_stock: stockActivo,
    pos: posActivo,
    mesas: mesasActivo,
    gestion_cadetes: cadetesActivos,
    multisucursal: multisucursalActiva,
    facturacion_arca: facturacionActiva,
    impresion_comandas: impresionActiva,
  }
  const navItems = NAV_ITEMS.filter((item) => {
    if (item.path === ROPA_PATH) return restauranteId === ROPA_RESTAURANTE_ID
    if (item.modulo) return modulosActivos[item.modulo] === true
    return true
  })

  // En el rail colapsado sólo quedan Inicio y Menú: el resto se alcanza expandiendo el menú.
  const RAIL_PATHS = new Set(['/dashboard/', '/dashboard/productos'])

  // `compact` = rail de solo iconos (aplica en el sidebar de escritorio).
  // `drawer` = versión móvil (overlay): el botón de cabecera cierra el drawer.
  const renderSidebar = (compact: boolean, drawer = false) => {
    const visibles = compact ? navItems.filter((item) => RAIL_PATHS.has(item.path)) : navItems
    return (
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
          {visibles.map((item) => {
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
                    ? compact
                      ? 'bg-muted text-foreground'
                      : 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
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

        {/* Footer: módulos y ajustes. En el rail colapsado no se muestra: sólo quedan Inicio y Menú. */}
        {!compact && (
          <div className="p-3 space-y-1 shrink-0">
            <button
              onClick={() => handleNavigation('/dashboard/modulos')}
              className={`group w-full flex items-center gap-3 rounded-xl h-11 text-sm font-medium transition-all cursor-pointer px-3 ${
                isActive('/dashboard/modulos')
                  ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              <Blocks className={`h-[18px] w-[18px] ${isActive('/dashboard/modulos') ? '' : 'text-muted-foreground group-hover:text-foreground'}`} />
              Módulos
            </button>
            <button
              onClick={() => handleNavigation('/dashboard/ajustes')}
              className={`group w-full flex items-center gap-3 rounded-xl h-11 text-sm font-medium transition-all cursor-pointer px-3 ${
                isActive('/dashboard/ajustes')
                  ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              <Settings className={`h-[18px] w-[18px] ${isActive('/dashboard/ajustes') ? '' : 'text-muted-foreground group-hover:text-foreground'}`} />
              Configuración
            </button>
          </div>
        )}
      </div>
    )
  }

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

      {/* Sidebar móvil (overlay) — se desliza por encima del contenido, con borde a la derecha,
          en vez de comprimirlo hacia la derecha. El velo de atrás cierra el menú. */}
      {menuOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/40"
          aria-hidden="true"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        className={`md:hidden fixed inset-y-0 left-0 z-40 flex w-64 max-w-[85vw] flex-col bg-background border-r border-border shadow-xl transition-transform duration-200 ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {renderSidebar(false, true)}
      </aside>

      {/* Contenido principal */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Barra superior sólo en móvil (para abrir/cerrar el menú) */}
        <div className="md:hidden flex items-center gap-2 h-14 px-3 bg-[#FFFBF0] dark:bg-background shrink-0">
          <Button variant="ghost" size="icon" aria-label="Abrir menú" onClick={() => setMenuOpen((v) => !v)}>
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        {/* Los datos de ejemplo (y la demo de prospección) se avisan arriba de cualquier pantalla. */}
        <DemoBanner />

        <main className="flex-1 min-h-0 overflow-y-auto">
          <Outlet key={versionDatos} />
        </main>
      </div>

      {recorridoMontado && (
        <Suspense fallback={null}>
          <RecorridoPanel />
        </Suspense>
      )}
    </div>
  )
}

export default DashboardLayout
