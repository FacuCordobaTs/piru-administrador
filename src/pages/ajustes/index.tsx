import { lazy, Suspense, useEffect, useRef, type ComponentType } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { Store, CreditCard, Clock, Truck, Sparkles, ChartNoAxesCombined, FileText, Printer, User, UtensilsCrossed, ArrowLeft, Blocks, Copy, ExternalLink, Globe, ChevronRight, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useRestauranteStore } from '@/store/restauranteStore'
import { useModulosStore } from '@/store/modulosStore'
import { SectionSkeleton } from './components/SectionSkeleton'
import { DescargarAppBanner } from './components/DescargarAppBanner'
import Modulos from '../Modulos'
import MiSuscripcion from '../MiSuscripcion'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
interface SectionDef { id: string; label: string; descripcion: string; Icon: LucideIcon; Component: ComponentType; tauriOnly?: boolean; visibleInNav?: boolean }
const SECTIONS: SectionDef[] = [
  { id: 'ventas', label: 'Ventas en el local', descripcion: 'Las herramientas para atender, vender y organizar tu operación.', Icon: Store, Component: () => <SectionHeading title="Ventas en el local" description="Organizá la atención, el punto de venta y el stock de tu negocio." /> },
  { id: 'recompra', label: 'Motor de Recompra', descripcion: 'Tu campaña de recupero y sus resultados.', Icon: Sparkles, Component: lazy(() => import('../MotorRecompra')) },
  {
    id: 'general',
    label: 'Tu negocio',
    descripcion: 'Información del negocio, tu link y tu identidad visual.',
    Icon: Store,
    Component: lazy(() => import('./sections/General')),
  },
  {
    id: 'pagos',
    label: 'Cómo cobrás',
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
    label: 'Tu tienda online',
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
    id: 'crecimiento',
    label: 'Crecimiento',
    descripcion: 'Medición y contenedor de Google Tag Manager de tu tienda.',
    Icon: ChartNoAxesCombined,
    Component: lazy(() => import('./sections/Crecimiento')),
  },
  {
    id: 'cuenta',
    label: 'Cuenta',
    descripcion: 'Tu email, contraseña y sesión.',
    Icon: User,
    Component: lazy(() => import('./sections/Cuenta')),
  },
]


const REQUISITOS: Record<string, string[]> = {
  facturacion: ['facturacion_arca'], impresion: ['impresion_comandas'],
  recompra: ['motor_recompra'], avisos: ['avisos_automaticos_whatsapp'], mozos: ['pos', 'mesas'], crecimiento: ['crecimiento'],
}
const GROUPS = [
  { label: 'Tu negocio', ids: ['general', 'pagos', 'horarios', 'entregas', 'experiencia'] },
  { label: 'Operación', ids: ['ventas', 'facturacion', 'impresion', 'crecimiento'] },
  { label: 'Piru', ids: ['modulos', 'suscripcion', 'cuenta'] },
]

// Un único destino por módulo. Las capacidades nuevas quedan accesibles en Ventas
// hasta que se les asigne una sección más específica.
const MODULOS_SECCION: Record<string, string> = {
  mercadopago: 'pagos', talo: 'pagos',
  rapiboy: 'entregas', gestion_cadetes: 'entregas', multisucursal: 'entregas',
  avisos_automaticos_whatsapp: 'experiencia',
  puntos_clientes: 'experiencia', codigos_descuento: 'crecimiento', motor_recompra: 'crecimiento', crecimiento: 'crecimiento',
  pos: 'ventas', mesas: 'ventas', gestion_stock: 'ventas', cierre_turno_manual: 'ventas',
  facturacion_arca: 'facturacion', impresion_comandas: 'impresion',
}
const seccionModulo = (codigo: string) => MODULOS_SECCION[codigo] ?? 'ventas'

export default function AjustesPage() {
  const { seccion: seccionParam } = useParams()
  const seccion = seccionParam ?? 'general'
  const { hash, key: locationKey } = useLocation()
  const restaurante = useRestauranteStore(s => s.restaurante)
  const { categorias, suscripcion, cargar, error, cargando } = useModulosStore()
  const contenidoRef = useRef<HTMLDivElement>(null)
  const modulos = categorias.flatMap(c => c.modulos)
  const habilitada = (id: string) => (REQUISITOS[id] ?? []).every(codigo => modulos.some(m => m.codigo === codigo && m.activoAhora))
  const active = SECTIONS.find(s => s.id === seccion)
  const ActiveSection = active?.Component
  const secundaria = !!active && !GROUPS.some(g => g.ids.includes(active.id))
  const link = restaurante?.username ? `https://piru.app/${restaurante.username}` : null
  const atencion = ['suspendida', 'cancelada', 'pago_pendiente'].includes(suscripcion?.estado ?? '')
  const operacion = SECTIONS.filter(s => !GROUPS.some(g => g.ids.includes(s.id)) && s.visibleInNav !== false && habilitada(s.id) && (!s.tauriOnly || isTauri))
  const grupos = GROUPS.map(g => g.label === 'Operación' ? { ...g, ids: [...g.ids, ...operacion.map(s => s.id)] } : g)
  const asociados = modulos.filter(m => seccionModulo(m.codigo) === seccion && (m.activable || m.activoAhora)).map(m => m.codigo)
  const destinoPadre = seccionModulo(REQUISITOS[seccion]?.[0] ?? '')

  useEffect(() => { void cargar().catch(() => {}) }, [cargar])
  useEffect(() => {
    if (contenidoRef.current) contenidoRef.current.scrollTop = 0
    contenidoRef.current?.focus({ preventScroll: true })
    if (hash === '#modulos-seccion') document.getElementById('modulos-seccion')?.scrollIntoView({ block: 'start' })
  }, [seccion, hash, locationKey])

  return <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-10 lg:py-16">
    <header className={cn('mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-border/50 pb-7 lg:mb-10', seccionParam ? 'hidden md:flex' : 'flex')}>
      <div><h1 className="text-3xl font-semibold tracking-tight">Ajustes</h1><p className="mt-2 text-sm text-muted-foreground">Tu negocio, tus herramientas y tu cuenta.</p></div>
      {link && <div className="flex items-center gap-1 rounded-xl bg-muted/60 p-1">
        <a href={link} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 px-3 py-2 text-sm font-medium"><Globe className="size-4 shrink-0 text-brand" /><span className="max-w-48 truncate">piru.app/{restaurante?.username}</span><ExternalLink className="size-3.5 shrink-0 text-muted-foreground" /></a>
        <Button size="icon" variant="ghost" aria-label="Copiar link de mi tienda" onClick={async () => { try { await navigator.clipboard.writeText(link); toast.success('Link copiado') } catch { toast.error('No se pudo copiar el link') } }}><Copy className="size-4" /></Button>
      </div>}
    </header>
    <div className="grid items-start gap-8 md:grid-cols-[200px_minmax(0,1fr)] lg:gap-14">
      <nav aria-label="Secciones de ajustes" className="md:sticky md:top-6 md:max-h-[calc(100dvh-240px)] md:overflow-y-auto">
        <MobileSectionList grupos={grupos} atencion={atencion} />
        <div className="hidden space-y-7 md:block">{grupos.map(grupo => <div key={grupo.label}>
          <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-widest text-muted-foreground/70">{grupo.label}</p>
          <div className="space-y-1">{grupo.ids.map(id => {
            const def = SECTIONS.find(s => s.id === id)
            const Icon = def?.Icon ?? (id === 'modulos' ? Blocks : CreditCard)
            const label = id === 'general' ? 'General' : def?.label ?? (id === 'modulos' ? 'Mis módulos' : 'Suscripción y pagos')
            const selected = id === seccion || (id === destinoPadre && secundaria && !operacion.some(s => s.id === seccion))
            return <Link key={id} to={`/dashboard/ajustes/${id}`} aria-current={selected ? 'page' : undefined} className={cn('flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand', selected ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground')}><Icon className="size-4 shrink-0" /><span>{label}</span>{id === 'suscripcion' && atencion && <span aria-label="Requiere atención" className="ml-auto size-1.5 shrink-0 rounded-full bg-amber-500" />}</Link>
          })}</div>
        </div>)}</div>
      </nav>
      <div ref={contenidoRef} tabIndex={-1} className={cn('min-w-0 outline-none md:max-h-[calc(100dvh-240px)] md:overflow-y-auto md:overscroll-contain md:pr-3', !seccionParam && 'hidden md:block')}>
        <MobileDetailHeader title={seccion === 'modulos' ? 'Mis módulos' : seccion === 'suscripcion' ? 'Suscripción y pagos' : active?.label ?? 'Ajustes'} />
        {error && <div role="alert" className="mb-5 rounded-lg border border-amber-500/30 p-3 text-sm">No pudimos actualizar los datos. <Button variant="link" size="sm" onClick={() => void cargar(true).catch(() => {})}>Reintentar</Button></div>}
        {secundaria && <Link to={`/dashboard/ajustes/${destinoPadre}`} className="mb-6 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" />{SECTIONS.find(s => s.id === destinoPadre)?.label}<span>/</span>{active.label}</Link>}
        {seccion === 'modulos' ? <><SectionHeading title="Mis módulos" description="Tus herramientas activas y su configuración." /><Modulos embedded soloActivos /></>
          : seccion === 'suscripcion' ? <><SectionHeading title="Suscripción y pagos" description="Tu cuota, los módulos que sumaste y tus comprobantes." /><MiSuscripcion embedded /></>
          : active ? cargando && modulos.length === 0 && REQUISITOS[active.id] ? <SectionSkeleton />
            : !habilitada(active.id) ? <div className="space-y-4"><SectionHeading title={active.label} description="Activá el módulo para acceder a su configuración." />{asociados.length === 0 && <Button asChild variant="outline"><Link to={`/dashboard/ajustes/${destinoPadre}`}>Ver módulo<ChevronRight className="size-4" /></Link></Button>}</div>
            : active.tauriOnly && !isTauri ? <div className="space-y-4"><SectionHeading title="Impresión" description="Abrí la app de escritorio de Piru para configurar tu impresora." /><DescargarAppBanner /></div>
            : <Suspense key={seccion} fallback={<SectionSkeleton />}>{ActiveSection && <ActiveSection />}</Suspense>
          : <div className="space-y-4"><SectionHeading title="Sección no encontrada" description="Elegí una sección del menú para continuar." /><Button asChild variant="outline"><Link to="/dashboard/ajustes/general">Ir a General</Link></Button></div>}
        {active && asociados.length > 0 && <section id="modulos-seccion" className="mt-10 border-t border-border/50 pt-7" aria-label="Módulos de esta sección"><header className="mb-4"><h3 className="text-sm font-medium">Herramientas disponibles</h3><p className="mt-1 text-xs text-muted-foreground">Activá o configurá las herramientas que necesitás.</p></header><Modulos key={seccion} embedded codigos={asociados} /></section>}
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
          const Icon = def?.Icon ?? (id === 'modulos' ? Blocks : CreditCard)
          const label = id === 'general' ? 'General' : def?.label ?? (id === 'modulos' ? 'Mis módulos' : 'Suscripción y pagos')
          const description = def?.descripcion ?? (id === 'modulos' ? 'Activá y configurá las herramientas de tu local.' : 'Tu cuota, pagos y comprobantes.')
          return <Link
            key={id}
            to={`/dashboard/ajustes/${id}`}
            className={cn('flex min-h-[72px] items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand', index > 0 && 'border-t border-border/60')}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Icon className="size-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-sm font-medium">
                <span className="truncate">{label}</span>
                {id === 'suscripcion' && atencion && <span aria-label="Requiere atención" className="size-1.5 shrink-0 rounded-full bg-amber-500" />}
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
