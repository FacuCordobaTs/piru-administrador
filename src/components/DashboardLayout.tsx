import { lazy, Suspense, useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { useRestauranteStore } from '@/store/restauranteStore'
import { useModuloActivo } from '@/store/modulosStore'
import { usePlanTienda } from '@/store/planTiendaStore'
import { useAuthStore } from '@/store/authStore'
import { useDatosEjemplo } from '@/store/datosEjemploStore'
import { esSesionDemo } from '@/lib/api'
import { recorridoVisto, useRecorridoPanel } from '@/lib/recorridoPanel'
import { DemoBanner } from '@/components/DemoBanner'
import { toast } from 'sonner'
import { useAbrirPaginas } from '@/hooks/useAbrirPaginas'
import {
  ClipboardList,
  ChevronDown,
  Clock,
  CreditCard,
  ExternalLink,
  Globe,
  Truck,
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
  ListChecks,
  Gem,
  type LucideIcon,
} from 'lucide-react'

// El recorrido de bienvenida se carga aparte: el uso de todos los días no lo descarga.
const RecorridoPanel = lazy(() => import('@/components/recorrido/RecorridoPanel'))

/** Tab de las tiendas self-serve (plan de tienda) mientras queden pasos por completar. */
const PRIMEROS_PASOS_PATH = '/dashboard/primeros-pasos'
/** Tienda abre Páginas en otra pestaña con cualquier plan (el Inicial sólo mira). */
const TIENDA_PATH = '/dashboard/tienda'

type NavItem = { icon: LucideIcon; label: string; path: string; modulo: string | null }

/** Siempre a la vista (y las únicas en el rail colapsado): lo de todos los días. */
const NAV_PRINCIPAL: NavItem[] = [
  { icon: ListChecks, label: 'Primeros pasos', path: PRIMEROS_PASOS_PATH, modulo: null },
  { icon: ClipboardList, label: 'Pedidos', path: '/dashboard/', modulo: null },
  { icon: Package, label: 'Menú', path: '/dashboard/productos', modulo: null },
  { icon: Shirt, label: 'Ropa', path: '/dashboard/ropa', modulo: null },
  { icon: Globe, label: 'Tienda', path: TIENDA_PATH, modulo: null },
]

/**
 * El resto del navbar va en secciones que se abren y cierran. Cada item con `modulo` se muestra
 * sólo con ese módulo activo; una sección sin items visibles no se muestra.
 */
const NAV_SECCIONES: { id: string; label: string; items: NavItem[] }[] = [
  {
    // Lo que antes eran tabs de Ajustes: cómo cobrás, cómo entregás y cuándo abrís.
    id: 'tienda',
    label: 'Configuración de la tienda',
    items: [
      { icon: CreditCard, label: 'Métodos de pago', path: '/dashboard/pagos', modulo: null },
      { icon: Truck, label: 'Entregas y zonas', path: '/dashboard/entregas', modulo: null },
      { icon: Clock, label: 'Horarios', path: '/dashboard/horarios', modulo: null },
    ],
  },
  {
    id: 'clientes',
    label: 'Clientes y ventas',
    items: [
      { icon: Users, label: 'Clientes', path: '/dashboard/marketing/clientes', modulo: null },
      { icon: TrendingUp, label: 'Estadísticas', path: '/dashboard/metricas', modulo: null },
      { icon: MessageCircle, label: 'Recompra', path: '/dashboard/marketing/recompra', modulo: 'motor_recompra' },
      { icon: CalendarDays, label: 'Días flojos', path: '/dashboard/marketing/dias-flojos', modulo: 'dias_flojos' },
      { icon: Megaphone, label: 'Campañas', path: '/dashboard/marketing/campanas', modulo: 'crecimiento' },
      { icon: Sparkles, label: 'Puntos', path: '/dashboard/marketing/puntos', modulo: 'puntos_clientes' },
      { icon: Ticket, label: 'Cupones', path: '/dashboard/marketing/cupones', modulo: 'codigos_descuento' },
      { icon: MessageSquare, label: 'Mensajes', path: '/dashboard/mensajes', modulo: 'avisos_automaticos_whatsapp' },
    ],
  },
  {
    // Herramientas de operación: cada módulo activo suma su propia pantalla.
    id: 'operacion',
    label: 'Operación',
    items: [
      { icon: Boxes, label: 'Stock', path: '/dashboard/stock', modulo: 'gestion_stock' },
      { icon: Monitor, label: 'Punto de venta', path: '/dashboard/punto-de-venta', modulo: 'pos' },
      { icon: Armchair, label: 'Mesas', path: '/dashboard/mesas', modulo: 'mesas' },
      { icon: Bike, label: 'Cadetes', path: '/dashboard/repartidores', modulo: 'gestion_cadetes' },
      { icon: Store, label: 'Sucursales', path: '/dashboard/sucursales', modulo: 'multisucursal' },
      { icon: Receipt, label: 'Facturación', path: '/dashboard/facturacion', modulo: 'facturacion_arca' },
      { icon: Printer, label: 'Impresión', path: '/dashboard/impresion', modulo: 'impresion_comandas' },
    ],
  },
]

const SECCIONES_KEY = 'piru-sidebar-secciones'

function leerSeccionesAbiertas(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(SECCIONES_KEY) ?? '{}') as Record<string, boolean>
  } catch {
    return {}
  }
}

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
  // Plan de tienda: Evolución (los locales de siempre) no ve ni "Primeros pasos" ni "Tu plan".
  const { plan, pasos } = usePlanTienda()
  const conPlan = Boolean(plan && !plan.esLegado)
  const mostrarPasos = conPlan && Boolean(pasos?.visible && !pasos.terminado)
  const token = useAuthStore((s) => s.token)
  const esDemo = esSesionDemo(token)
  const abrirRecorrido = useRecorridoPanel((s) => s.abrir)
  const recorridoMontado = useRecorridoPanel((s) => s.vez > 0)
  // Sube cuando se borran o se vuelven a cargar los datos de ejemplo: la pantalla pide sus datos de nuevo.
  const versionDatos = useDatosEjemplo((s) => s.version)
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('piru-sidebar-collapsed') === '1')
  const [seccionesAbiertas, setSeccionesAbiertas] = useState(leerSeccionesAbiertas)
  // Tienda abre Páginas en otra pestaña con cualquier plan: sin el diseño propio (plan Inicial) se
  // entra sólo a mirar los temas. La demo no entra a Páginas.
  const tiendaExterna = !esDemo
  const paginas = useAbrirPaginas()

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

  useEffect(() => {
    localStorage.setItem(SECCIONES_KEY, JSON.stringify(seccionesAbiertas))
  }, [seccionesAbiertas])

  // Si el navegador bloqueó la pestaña de Páginas, el link queda a mano en el aviso.
  useEffect(() => {
    if (!paginas.bloqueada) return
    const url = paginas.bloqueada
    toast('El navegador bloqueó la pestaña', { action: { label: 'Abrir Páginas', onClick: () => window.open(url, '_blank') } })
  }, [paginas.bloqueada])

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
  const visible = (item: NavItem) => {
    if (item.path === ROPA_PATH) return restauranteId === ROPA_RESTAURANTE_ID
    if (item.path === PRIMEROS_PASOS_PATH) return mostrarPasos || isActive(PRIMEROS_PASOS_PATH)
    if (item.modulo) return modulosActivos[item.modulo] === true
    return true
  }
  const principales = NAV_PRINCIPAL.filter(visible)
  const secciones = NAV_SECCIONES.map((seccion) => ({ ...seccion, items: seccion.items.filter(visible) })).filter(
    (seccion) => seccion.items.length > 0,
  )
  // La sección de la pantalla actual queda abierta aunque el dueño la haya cerrado.
  const seccionAbierta = (seccion: (typeof secciones)[number]) =>
    seccion.items.some((item) => isActive(item.path)) || seccionesAbiertas[seccion.id] === true

  const abrirTienda = () => {
    if (tiendaExterna && paginas.disponible) {
      void paginas.abrir()
      setMenuOpen(false)
    } else handleNavigation(TIENDA_PATH)
  }

  const renderItem = (item: NavItem, compact: boolean) => {
    const Icon = item.icon
    const active = isActive(item.path)
    const externa = item.path === TIENDA_PATH && tiendaExterna
    return (
      <button
        key={item.path}
        onClick={() => (item.path === TIENDA_PATH ? abrirTienda() : handleNavigation(item.path))}
        disabled={externa && paginas.abriendo}
        title={compact ? item.label : externa ? 'Abre Páginas en otra pestaña' : undefined}
        className={`group relative w-full flex items-center gap-3 rounded-xl h-11 text-sm font-medium transition-all cursor-pointer disabled:cursor-wait disabled:opacity-70 ${
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
        {!compact && externa && <ExternalLink aria-label="Se abre en otra pestaña" className="h-3.5 w-3.5 shrink-0 opacity-70" />}
      </button>
    )
  }

  // `compact` = rail de solo iconos (aplica en el sidebar de escritorio).
  // `drawer` = versión móvil (overlay): el botón de cabecera cierra el drawer.
  const renderSidebar = (compact: boolean, drawer = false) => {
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

        {/* Navegación: lo principal siempre a la vista; el resto en secciones colapsables.
            En el rail colapsado sólo quedan las principales. */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto">
          <div className="space-y-1">{principales.map((item) => renderItem(item, compact))}</div>
          {!compact &&
            secciones.map((seccion) => {
              const abierta = seccionAbierta(seccion)
              const contenidoId = `nav-seccion-${seccion.id}`
              return (
                <div key={seccion.id} className="mt-4">
                  <button
                    type="button"
                    aria-expanded={abierta}
                    aria-controls={contenidoId}
                    onClick={() => setSeccionesAbiertas((actual) => ({ ...actual, [seccion.id]: !abierta }))}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
                  >
                    <span className="flex-1 text-left">{seccion.label}</span>
                    <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${abierta ? '' : '-rotate-90'}`} />
                  </button>
                  <div id={contenidoId} hidden={!abierta} className="mt-1 space-y-1">
                    {seccion.items.map((item) => renderItem(item, false))}
                  </div>
                </div>
              )
            })}
        </nav>

        {/* Footer: módulos y ajustes. En el rail colapsado no se muestra: sólo quedan las principales. */}
        {!compact && (
          <div className="p-3 space-y-1 shrink-0">
            {conPlan && (
              <button
                onClick={() => handleNavigation('/dashboard/planes')}
                className={`group w-full flex items-center gap-3 rounded-xl h-11 text-sm font-medium transition-all cursor-pointer px-3 ${
                  isActive('/dashboard/planes')
                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <Gem className={`h-[18px] w-[18px] ${isActive('/dashboard/planes') ? '' : 'text-muted-foreground group-hover:text-foreground'}`} />
                <span className="flex-1 text-left">Tu plan</span>
                {plan && (
                  <span className="text-xs font-normal opacity-80">
                    {plan.catalogo.find((p) => p.codigo === plan.efectivo)?.nombre}
                  </span>
                )}
              </button>
            )}
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
