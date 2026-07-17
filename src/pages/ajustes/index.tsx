import { lazy, Suspense, type ComponentType } from 'react'
import { NavLink, Navigate, useParams } from 'react-router'
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
  ExternalLink,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useRestauranteStore } from '@/store/restauranteStore'
import { SectionSkeleton } from './components/SectionSkeleton'

// ── Detección de entorno de escritorio (Tauri) ──────────────────────────
// La impresión automática solo existe en la app de escritorio.
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window

// ── Registro de secciones ────────────────────────────────────────────────
// Cada sección se carga con React.lazy: solo se monta la activa (code split).
interface SectionDef {
  id: string
  label: string
  Icon: LucideIcon
  Component: ComponentType
  tauriOnly?: boolean
}

const SECTIONS: SectionDef[] = [
  { id: 'general', label: 'General', Icon: Store, Component: lazy(() => import('./sections/General')) },
  { id: 'pagos', label: 'Pagos', Icon: CreditCard, Component: lazy(() => import('./sections/Pagos')) },
  { id: 'horarios', label: 'Horarios', Icon: Clock, Component: lazy(() => import('./sections/Horarios')) },
  { id: 'entregas', label: 'Entregas', Icon: Truck, Component: lazy(() => import('./sections/Entregas')) },
  { id: 'experiencia', label: 'Experiencia', Icon: Sparkles, Component: lazy(() => import('./sections/Experiencia')) },
  { id: 'facturacion', label: 'Facturación', Icon: FileText, Component: lazy(() => import('./sections/Facturacion')) },
  { id: 'impresion', label: 'Impresión', Icon: Printer, Component: lazy(() => import('./sections/Impresion')), tauriOnly: true },
  { id: 'cuenta', label: 'Cuenta', Icon: User, Component: lazy(() => import('./sections/Cuenta')) },
]

// Secciones visibles en la nav (impresión solo en escritorio).
const navSections = SECTIONS.filter((s) => !s.tauriOnly || isTauri)

export default function AjustesPage() {
  const { seccion } = useParams<{ seccion: string }>()
  const restaurante = useRestauranteStore((s) => s.restaurante)

  const active = SECTIONS.find((s) => s.id === seccion)

  // Ruta desconocida (o /ajustes sin sección) → general.
  if (!active) {
    return <Navigate to="/dashboard/ajustes/general" replace />
  }

  const publicUrl = restaurante?.username
    ? `https://my.piru.app/${restaurante.username}`
    : null

  const copyLink = () => {
    if (!publicUrl) return
    navigator.clipboard.writeText(publicUrl)
    toast.success('Link copiado al portapapeles')
  }

  const ActiveSection = active.Component

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      {/* ── Header ── */}
      <header className="space-y-4">
        <h1 className="text-2xl font-medium tracking-tight text-foreground">Ajustes</h1>

        {restaurante?.username && (
          <div className="flex max-w-md items-center justify-between gap-3 rounded-xl bg-muted px-4 py-2">
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

      {/* ── Chips horizontales (sticky, <1024px) ── */}
      <nav
        aria-label="Secciones de ajustes"
        className="sticky top-0 z-20 -mx-4 mt-6 border-b border-border bg-background/95 px-4 py-2 backdrop-blur lg:hidden"
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
                    : 'bg-muted text-muted-foreground hover:text-foreground'
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
        <nav
          aria-label="Secciones de ajustes"
          className="hidden lg:block lg:w-52 lg:shrink-0"
        >
          <div className="sticky top-6 flex flex-col gap-0.5">
            {navSections.map(({ id, label, Icon }) => (
              <NavLink
                key={id}
                to={`/dashboard/ajustes/${id}`}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
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
