import { lazy, Suspense, type ComponentType } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router'
import {
  Store,
  CreditCard,
  Clock,
  Truck,
  Sparkles,
  FileText,
  Printer,
  User,
  Globe,
  Copy,
  ChevronRight,
  ExternalLink,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useRestauranteStore } from '@/store/restauranteStore'
import { SectionSkeleton } from './components/SectionSkeleton'
import { DescargarAppBanner } from './components/DescargarAppBanner'
import { PlanBanner } from './components/PlanBanner'
import { useResumenSecciones } from './hooks/useResumenSecciones'

// ── Detección de entorno de escritorio (Tauri) ──────────────────────────
// La impresión automática solo existe en la app de escritorio.
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

// ── Registro de secciones ────────────────────────────────────────────────
// Cada sección se carga con React.lazy: solo se monta la activa (code split).
interface SectionDef {
  id: string
  label: string
  descripcion: string
  Icon: LucideIcon
  Component: ComponentType
  tauriOnly?: boolean
  visibleInNav?: boolean
}

const SECTIONS: SectionDef[] = [
  {
    id: 'general',
    label: 'General',
    descripcion: 'Información del negocio, tu link y tu identidad visual.',
    Icon: Store,
    Component: lazy(() => import('./sections/General')),
  },
  {
    id: 'pagos',
    label: 'Pagos',
    descripcion: 'Cómo cobrás y qué integraciones usás.',
    Icon: CreditCard,
    Component: lazy(() => import('./sections/Pagos')),
  },
  {
    id: 'horarios',
    label: 'Horarios',
    descripcion: 'Cuándo abrís y si aceptás pedidos para más tarde.',
    Icon: Clock,
    Component: lazy(() => import('./sections/Horarios')),
  },
  {
    id: 'entregas',
    label: 'Entregas',
    descripcion: 'Cómo entregás: tipos de pedido, zonas y locales.',
    Icon: Truck,
    Component: lazy(() => import('./sections/Entregas')),
  },
  {
    id: 'experiencia',
    label: 'Experiencia',
    descripcion: 'Cómo viven tus clientes el pedido.',
    Icon: Sparkles,
    Component: lazy(() => import('./sections/Experiencia')),
  },
  {
    id: 'facturacion',
    label: 'Facturación',
    descripcion: 'Facturación electrónica con AFIP/ARCA.',
    Icon: FileText,
    Component: lazy(() => import('./sections/Facturacion')),
  },
  {
    id: 'mozos',
    label: 'Mozos',
    descripcion: 'Códigos de acceso y usuarios para la app de mozos.',
    Icon: UtensilsCrossed,
    Component: lazy(() => import('./sections/Mozos')),
  },
  {
    id: 'impresion',
    label: 'Impresión',
    descripcion: 'Impresora térmica para tus comandas.',
    Icon: Printer,
    Component: lazy(() => import('./sections/Impresion')),
    tauriOnly: true,
  },
  {
    id: 'avisos',
    label: 'Avisos automáticos',
    descripcion: 'Configuración del módulo de avisos por WhatsApp.',
    Icon: Sparkles,
    Component: lazy(() => import('./sections/AvisosAutomaticos')),
    visibleInNav: false,
  },
  {
    id: 'cuenta',
    label: 'Cuenta',
    descripcion: 'Tu email, contraseña y sesión.',
    Icon: User,
    Component: lazy(() => import('./sections/Cuenta')),
  },
]

// Secciones visibles (impresión solo en escritorio).
const navSections = SECTIONS.filter((s) => s.visibleInNav !== false && (!s.tauriOnly || isTauri))

export default function AjustesPage() {
  const { seccion } = useParams<{ seccion: string }>()

  const active = SECTIONS.find((s) => s.id === seccion)

  // Sin sección (o ruta desconocida) → portada de selección.
  if (!active) {
    return <AjustesOverview />
  }

  return <SeccionView active={active} />
}

// =============================================================================
// PORTADA — título grande + tarjetas de sección (con resumen y pendientes)
// =============================================================================
function AjustesOverview() {
  const navigate = useNavigate()
  const restaurante = useRestauranteStore((s) => s.restaurante)
  const { data: resumenes } = useResumenSecciones()

  const publicUrl = restaurante?.username ? `https://piru.app/${restaurante.username}` : null

  const copyLink = () => {
    if (!publicUrl) return
    navigator.clipboard.writeText(publicUrl)
    toast.success('Link copiado al portapapeles')
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-4 py-10 sm:px-6">
      {/* ── Header centrado ── */}
      <header className="flex flex-col items-center text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">Ajustes</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Configurá tu local: elegí qué querés ajustar.
        </p>

        {restaurante?.username && (
          <div className="mt-6 flex items-center justify-between gap-3 rounded-xl bg-white dark:bg-muted px-4 py-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <Globe className="h-4 w-4 shrink-0 text-brand" />
              <span className="truncate text-[15px] font-medium tracking-tight text-foreground">
                piru.app/{restaurante.username}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={copyLink}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:text-brand"
                title="Copiar link"
              >
                <Copy className="h-4 w-4" />
              </button>
              <a
                href={publicUrl ?? '#'}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:text-brand"
                title="Abrir link"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        )}
      </header>

      {/* ── Banner de atención del plan (cobro vencido / suspensión) ── */}
      <PlanBanner />

      {/* ── Banner descarga app de escritorio (solo web) ── */}
      {!isTauri && (
        <div className="mt-6">
          <DescargarAppBanner />
        </div>
      )}

      {/* ── Tarjetas de sección ── */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {navSections.map((section, i) => {
          // Si la cantidad es impar, la última tarjeta queda sola en una
          // columna → la centramos ocupando ambas columnas con ancho de una.
          const esUltimaImpar = navSections.length % 2 === 1 && i === navSections.length - 1
          return (
            <div
              key={section.id}
              className={cn('h-full', esUltimaImpar && 'sm:col-span-2 sm:mx-auto sm:w-[calc(50%-0.375rem)]')}
            >
              <SeccionCard
                section={section}
                resumen={resumenes[section.id]}
                onClick={() => navigate(`/dashboard/ajustes/${section.id}`)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SeccionCard({
  section,
  resumen,
  onClick,
}: {
  section: SectionDef
  resumen?: { resumen: string; faltan: string[] }
  onClick: () => void
}) {
  const { Icon, label } = section
  const faltan = resumen?.faltan ?? []

  return (
    <button
      onClick={onClick}
      className="group flex h-full w-full items-start gap-3 rounded-xl border border-border/60 bg-[#FFFBF0] dark:bg-background p-4 text-left transition-colors hover:border-border hover:bg-muted/40"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-muted text-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">{label}</h2>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          <span className="text-muted-foreground">{resumen?.resumen ?? section.descripcion}</span>
          {faltan.map((f, i) => (
            <span key={i} className="text-orange-600 dark:text-orange-500">
              {' · '}
              {f}
            </span>
          ))}
        </p>
      </div>
    </button>
  )
}

// =============================================================================
// VISTA DE SECCIÓN — header centrado + rail de nav + contenido
// =============================================================================
function SeccionView({ active }: { active: SectionDef }) {
  const restaurante = useRestauranteStore((s) => s.restaurante)

  const publicUrl = restaurante?.username ? `https://piru.app/${restaurante.username}` : null

  const copyLink = () => {
    if (!publicUrl) return
    navigator.clipboard.writeText(publicUrl)
    toast.success('Link copiado al portapapeles')
  }

  const ActiveSection = active.Component

  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-4 pb-8 pt-32 sm:px-6">
      {/* ── Header centrado (título grande + link) ── */}
      <header className="flex flex-col items-center text-center">
        <NavLink
          to="/dashboard/ajustes"
          className="text-3xl font-semibold tracking-tight text-foreground transition-colors hover:text-brand sm:text-4xl"
        >
          Ajustes
        </NavLink>

        {restaurante?.username && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-white dark:bg-muted px-4 py-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <Globe className="h-4 w-4 shrink-0 text-brand" />
              <span className="truncate text-[15px] font-medium tracking-tight text-foreground">
                piru.app/{restaurante.username}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={copyLink}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:text-brand"
                title="Copiar link"
              >
                <Copy className="h-4 w-4" />
              </button>
              <a
                href={publicUrl ?? '#'}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:text-brand"
                title="Abrir link"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        )}
      </header>

      {/* ── Banner de atención del plan ── */}
      <PlanBanner />

      {/* ── Chips horizontales (sticky, <1024px) ── */}
      <nav
        aria-label="Secciones de ajustes"
        className="sticky top-0 z-20 -mx-4 mt-6 border-b border-border bg-[#FFFBF0]/95 dark:bg-background/95 px-4 py-2 backdrop-blur lg:hidden"
      >
        <div className="flex gap-2 overflow-x-auto">
          {navSections.map(({ id, label, Icon }) => (
            <NavLink
              key={id}
              to={`/dashboard/ajustes/${id}`}
              className={({ isActive }) =>
                cn(
                  'flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand text-white'
                    : "bg-white dark:bg-muted text-muted-foreground hover:text-foreground"
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* ── Layout: rail (≥1024px) + contenido ── */}
      <div className="mt-6 lg:flex lg:gap-10">
        {/* Rail izquierdo sticky, sin card flotante ni sombra */}
        <nav aria-label="Secciones de ajustes" className="hidden lg:block lg:w-52 lg:shrink-0">
          <div className="sticky top-6 flex flex-col gap-0.5">
            {navSections.map(({ id, label, Icon }) => (
              <NavLink
                key={id}
                to={`/dashboard/ajustes/${id}`}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? "bg-white dark:bg-muted text-foreground"
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{label}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Solo la sección activa se monta (render condicional por ruta) */}
        <main className="min-w-0 flex-1 pt-6 lg:pt-0">
          <Suspense fallback={<SectionSkeleton />}>
            <ActiveSection />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
