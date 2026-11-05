import { lazy, Suspense, useEffect, useRef, type ComponentType } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router'
import {
  Store,
  CreditCard,
  Activity,
  Clock,
  Truck,
  User,
  UtensilsCrossed,
  ArrowLeft,
  Copy,
  ExternalLink,
  Code2,
  Globe,
  ChevronRight,
  MessageCircle,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useRestauranteStore } from '@/store/restauranteStore'
import { useModulosStore } from '@/store/modulosStore'
import { SectionSkeleton } from './components/SectionSkeleton'
import { SettingsNavigation } from '@/components/SettingsNavigation'
import { resetSettingsScroll } from '@/components/settings-navigation-context'

interface SectionDef { id: string; label: string; descripcion: string; Icon: LucideIcon; Component: ComponentType }

const SECTIONS: SectionDef[] = [
  { id: 'mi-pagina', label: 'Tienda', descripcion: 'Tu página: secciones, marca, pedido en grupo y código propio.', Icon: Code2, Component: lazy(() => import('./sections/MiPagina')) },
  { id: 'medicion', label: 'Medición', descripcion: 'Google Tag Manager y Meta Pixel para medir tu tienda.', Icon: Activity, Component: lazy(() => import('./sections/Medicion')) },
  {
    id: 'monetizacion',
    label: 'Métodos de pago',
    descripcion: 'Cómo cobrás: Mercado Pago, Talo 3.0, efectivo y facturación electrónica ARCA.',
    Icon: CreditCard,
    Component: lazy(() => import('./sections/Monetizacion')),
  },

  // --- Operación del Restaurante ---
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    descripcion: 'WhatsApp Business oficial y avisos automáticos de estado de pedidos.',
    Icon: MessageCircle,
    Component: lazy(() => import('./sections/WhatsApp')),
  },
  {
    id: 'entregas',
    label: 'Entregas y zonas',
    descripcion: 'Cómo entregás: delivery, takeaway, zonas de reparto y sucursales.',
    Icon: Truck,
    Component: lazy(() => import('./sections/Entregas')),
  },
  {
    id: 'horarios',
    label: 'Horarios',
    descripcion: 'Cuándo abrís y si aceptás pedidos diferidos para más tarde.',
    Icon: Clock,
    Component: lazy(() => import('./sections/Horarios')),
  },
  {
    id: 'mozos',
    label: 'Mozos',
    descripcion: 'Códigos de acceso y usuarios para la app de mozos.',
    Icon: UtensilsCrossed,
    Component: lazy(() => import('./sections/Mozos')),
  },

  // --- Negocio y Cuenta ---
  {
    id: 'general',
    label: 'Tu negocio',
    descripcion: 'Información del negocio, tu link y tu identidad visual.',
    Icon: Store,
    Component: lazy(() => import('./sections/General')),
  },
  {
    id: 'cuenta',
    label: 'Cuenta',
    descripcion: 'Tu email, contraseña y sesión.',
    Icon: User,
    Component: lazy(() => import('./sections/Cuenta')),
  },
]

const ALIASES_SECCION: Record<string, string> = {
  crecimiento: 'adquisicion',
  experiencia: 'activacion',
  pagos: 'monetizacion',
  avisos: 'whatsapp',
}

/**
 * URLs que alguna vez apuntaron a una sección de Ajustes y hoy viven en otro
 * lado. Se resuelven con un redirect en vez de "Sección no encontrada" porque
 * hay enlaces viejos guardados por el usuario.
 */
const REDIRECTS_SECCION: Record<string, string> = {
  adquisicion: '/dashboard/marketing/campanas',
  activacion: '/dashboard/ajustes/general',
  retencion: '/dashboard/marketing/hoy',
  // La personalización de la tienda se mudó a Páginas: la URL vieja sigue funcionando.
  tienda: '/dashboard/ajustes/mi-pagina',
  // Módulos dejó de ser una sección de Ajustes y pasó al menú principal.
  modulos: '/dashboard/modulos',
  // Suscripción y pagos se integró a Cuenta.
  suscripcion: '/dashboard/ajustes/cuenta',
  // Las herramientas de operación tienen su propia pantalla en el navbar.
  ventas: '/dashboard/punto-de-venta',
  impresion: '/dashboard/impresion',
  facturacion: '/dashboard/facturacion',
}
const DESTINO_PUNTOS = '/dashboard/marketing/puntos'

/**
 * Qué módulos tiene que tener activos un local para que una sección de Ajustes
 * tenga sentido. `todos` exige cada código; `alguno` alcanza con uno. Una
 * sección sin requisitos siempre está disponible.
 */
interface RequisitoModulos { todos?: string[]; alguno?: string[] }

const REQUISITOS: Record<string, RequisitoModulos> = {
  whatsapp: { todos: ['avisos_automaticos_whatsapp'] },
  mozos: { todos: ['pos', 'mesas'] },
  medicion: { todos: ['crecimiento'] },
}

const GROUPS = [
  { label: 'Tu negocio', ids: ['general', 'mi-pagina', 'monetizacion', 'entregas', 'horarios', 'cuenta'] },
  // Medición (GTM y Meta Pixel) pertenece a Campañas de adquisición, que el
  // catálogo agrupa en "Clientes y fidelización".
  { label: 'Clientes y fidelización', ids: ['medicion'] },
  { label: 'Operación', ids: ['whatsapp'] },
]

export default function AjustesPage() {
  const { seccion: seccionParam } = useParams()
  const seccion = seccionParam ? ALIASES_SECCION[seccionParam] ?? seccionParam : 'general'
  const { hash, search, key: locationKey } = useLocation()
  const restaurante = useRestauranteStore((s) => s.restaurante)
  const { categorias, suscripcion, cargar, error, cargando } = useModulosStore()
  const contenidoRef = useRef<HTMLDivElement>(null)
  const modulos = categorias.flatMap((c) => c.modulos)
  const activo = (codigo: string) => modulos.some((m) => m.codigo === codigo && m.activoAhora)
  const habilitada = (id: string) => {
    const requisito = REQUISITOS[id]
    if (!requisito) return true
    if (requisito.alguno && !requisito.alguno.some(activo)) return false
    return (requisito.todos ?? []).every(activo)
  }
  const active = SECTIONS.find((s) => s.id === seccion)
  const ActiveSection = active?.Component
  // `baseTienda` ya trae el dominio propio si el local lo tiene (o my.piru.app/<username>/).
  // El literal queda sólo como fallback mientras el perfil todavía no cargó.
  const link = restaurante?.baseTienda ?? (restaurante?.username ? `https://my.piru.app/${restaurante.username}` : null)
  const hostLink = link?.replace(/^https?:\/\//, '').replace(/\/$/, '') ?? null
  const atencion = ['suspendida', 'cancelada', 'pago_pendiente'].includes(suscripcion?.estado ?? '')
  const operacion = SECTIONS.filter(
    (s) => !GROUPS.some((g) => g.ids.includes(s.id)) && habilitada(s.id)
  )
  const grupos = GROUPS.map((g) => {
    const ids = g.label === 'Operación' ? [...g.ids, ...operacion.map((s) => s.id)] : g.ids
    return { ...g, ids: ids.filter(habilitada) }
  }).filter((g) => g.ids.length > 0)

  useEffect(() => {
    void cargar().catch(() => {})
  }, [cargar])
  useEffect(() => {
    if (contenidoRef.current) resetSettingsScroll(contenidoRef.current)
    contenidoRef.current?.focus({ preventScroll: true })
  }, [seccion, hash, locationKey])

  const destinoBase =
    seccion === 'retencion' && new URLSearchParams(search).get('config') === 'puntos'
      ? DESTINO_PUNTOS
      : REDIRECTS_SECCION[seccion]
  // El regreso de Mercado Pago trae `?plan=success`; tiene que llegar a Cuenta
  // para que MiSuscripcion verifique la acreditación.
  const destinoRedireccion = destinoBase && seccion === 'suscripcion' ? `${destinoBase}${search}` : destinoBase
  if (destinoRedireccion) return <Navigate to={destinoRedireccion} replace />

  return <main className="mx-auto min-w-0 w-full max-w-6xl px-5 py-8 sm:px-10 lg:py-16">
    <header className={cn('mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-border/50 pb-7 lg:mb-10', seccionParam ? 'hidden md:flex' : 'flex')}>
      <div><h1 className="text-3xl font-semibold tracking-tight">Ajustes</h1><p className="mt-2 text-sm text-muted-foreground">Tu negocio, tus herramientas y tu cuenta.</p></div>
      {link && <div className="flex max-w-full items-center gap-1 rounded-xl bg-muted/60 p-1">
        <a href={link} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 px-3 py-2 text-sm font-medium"><Globe className="size-4 shrink-0 text-brand" /><span className="max-w-48 truncate">{hostLink}</span><ExternalLink className="size-3.5 shrink-0 text-muted-foreground" /></a>
        <Button size="icon" variant="ghost" aria-label="Copiar link de mi tienda" onClick={async () => { try { await navigator.clipboard.writeText(link); toast.success('Link copiado') } catch { toast.error('No se pudo copiar el link') } }}><Copy className="size-4" /></Button>
      </div>}
    </header>
    <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-[200px_minmax(0,1fr)] lg:gap-14">
      <nav aria-label="Secciones de ajustes" className={cn('min-w-0 md:sticky md:top-6 md:max-h-[calc(100dvh-240px)] md:overflow-y-auto', seccionParam && 'hidden md:block')}>
        <MobileSectionList grupos={grupos} atencion={atencion} />
        <div className="hidden space-y-7 md:block">{grupos.map(grupo => <div key={grupo.label}>
          <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-widest text-muted-foreground/70">{grupo.label}</p>
          <div className="space-y-1">{grupo.ids.map(id => {
            const def = SECTIONS.find(s => s.id === id)
            const Icon = def?.Icon ?? CreditCard
            const label = id === 'general' ? 'General' : def?.label ?? 'Ajustes'
            const selected = id === seccion
            return <Link key={id} to={`/dashboard/ajustes/${id}`} aria-current={selected ? 'page' : undefined} className={cn('flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand', selected ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground')}><Icon className="size-4 shrink-0" /><span>{label}</span>{id === 'cuenta' && atencion && <span aria-label="Requiere atención" className="ml-auto size-1.5 shrink-0 rounded-full bg-amber-500" />}</Link>
          })}</div>
        </div>)}</div>
      </nav>
      <div ref={contenidoRef} tabIndex={-1} className={cn('min-w-0 outline-none md:max-h-[calc(100dvh-240px)] md:overflow-y-auto md:overscroll-contain md:pr-3', !seccionParam && 'hidden md:block')}>
        <SettingsNavigation key={seccion}>
        <MobileDetailHeader title={active?.label ?? 'Ajustes'} />
        {error && <div role="alert" className="mb-5 rounded-lg border border-amber-500/30 p-3 text-sm">No pudimos actualizar los datos. <Button variant="link" size="sm" onClick={() => void cargar(true).catch(() => {})}>Reintentar</Button></div>}
        {active ? cargando && modulos.length === 0 && REQUISITOS[active.id] ? <SectionSkeleton />
            : !habilitada(active.id) ? <div className="space-y-4"><SectionHeading title={active.label} description="Activá el módulo para acceder a su configuración." /><Button asChild variant="outline"><Link to="/dashboard/modulos">Ver módulos<ChevronRight className="size-4" /></Link></Button></div>
            : <Suspense key={seccion} fallback={<SectionSkeleton />}>{ActiveSection && <ActiveSection />}</Suspense>
          : <div className="space-y-4"><SectionHeading title="Sección no encontrada" description="Elegí una sección del menú para continuar." /><Button asChild variant="outline"><Link to="/dashboard/ajustes/general">Ir a General</Link></Button></div>}
        </SettingsNavigation>
      </div>
    </div>
  </main>
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return <header className="mb-7 space-y-1"><h2 className="text-lg font-medium">{title}</h2><p className="text-sm text-muted-foreground">{description}</p></header>
}

function MobileSectionList({ grupos, atencion }: { grupos: typeof GROUPS; atencion: boolean }) {
  return <div className="space-y-7 md:hidden">
    {grupos.map(grupo => <section key={grupo.label} aria-labelledby={`ajustes-grupo-${grupo.label}`}>
      <h2 id={`ajustes-grupo-${grupo.label}`} className="mb-2 px-4 text-xs font-medium uppercase tracking-widest text-muted-foreground/70">{grupo.label}</h2>
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-background shadow-sm">
        {grupo.ids.map((id, index) => {
          const def = SECTIONS.find(s => s.id === id)
          const Icon = def?.Icon ?? CreditCard
          const label = id === 'general' ? 'General' : def?.label ?? 'Ajustes'
          const description = def?.descripcion ?? 'Configuración de tu negocio.'
          return <Link
            key={id}
            to={`/dashboard/ajustes/${id}`}
            className={cn('flex min-h-[72px] items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand', index > 0 && 'border-t border-border/60')}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Icon className="size-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-sm font-medium">
                <span className="truncate">{label}</span>
                {id === 'cuenta' && atencion && <span aria-label="Requiere atención" className="size-1.5 shrink-0 rounded-full bg-amber-500" />}
              </span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">{description}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        })}
      </div>
    </section>)}
  </div>
}

function MobileDetailHeader({ title }: { title: string }) {
  return <header className="mb-6 flex items-center gap-3 md:hidden">
    <Link to="/dashboard/ajustes" className="-ml-2 inline-flex h-10 shrink-0 items-center gap-1 rounded-full px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand" aria-label="Volver a Ajustes">
      <ArrowLeft className="size-5" />
      <span>Volver</span>
    </Link>
    <h1 className="min-w-0 truncate text-xl font-semibold tracking-tight">{title}</h1>
  </header>
}
