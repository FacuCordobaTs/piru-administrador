import { lazy, Suspense, useEffect, useRef, type ComponentType } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Copy, ExternalLink, Globe, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useRestauranteStore } from '@/store/restauranteStore'
import { useModulosStore } from '@/store/modulosStore'
import { SectionSkeleton } from './components/SectionSkeleton'
import { AjusteRow } from './components/AjusteRow'
import { SettingsNavigation } from '@/components/SettingsNavigation'
import { resetSettingsScroll } from '@/components/settings-navigation-context'
import General from './sections/General'
import Cuenta from './sections/Cuenta'

/**
 * Ajustes es un único listado: tu negocio (cada dato con su «Cambiar»), las herramientas que
 * dependen de un módulo y tu cuenta. Métodos de pago, Entregas y zonas, Horarios y Tienda son
 * pantallas propias del navbar; las herramientas abren su pantalla en `/dashboard/ajustes/<id>`.
 */
interface SectionDef { id: string; label: string; descripcion: string; Component: ComponentType }

const SECTIONS: SectionDef[] = [
  {
    id: 'whatsapp',
    label: 'WhatsApp Business',
    descripcion: 'WhatsApp Business oficial y avisos automáticos de estado de pedidos.',
    Component: lazy(() => import('./sections/WhatsApp')),
  },
  {
    id: 'whatsapp-local',
    label: 'WhatsApp del local',
    descripcion: 'Vinculá tu WhatsApp: confirma los pedidos sin pedir el celular y manda solas las tandas de recompra.',
    Component: lazy(() => import('./sections/WhatsAppVinculado')),
  },
  { id: 'medicion', label: 'Medición', descripcion: 'Google Tag Manager y Meta Pixel para medir tu tienda.', Component: lazy(() => import('./sections/Medicion')) },
  {
    id: 'mozos',
    label: 'Mozos',
    descripcion: 'Códigos de acceso y usuarios para la app de mozos.',
    Component: lazy(() => import('./sections/Mozos')),
  },
]

const ALIASES_SECCION: Record<string, string> = {
  crecimiento: 'adquisicion',
  experiencia: 'activacion',
  avisos: 'whatsapp',
}

const AJUSTES = '/dashboard/ajustes'

/**
 * URLs que alguna vez apuntaron a una sección de Ajustes y hoy viven en otro
 * lado. Se resuelven con un redirect en vez de "Sección no encontrada" porque
 * hay enlaces viejos guardados por el usuario.
 */
const REDIRECTS_SECCION: Record<string, string> = {
  adquisicion: '/dashboard/marketing/campanas',
  retencion: '/dashboard/marketing/recompra',
  // Modulos dejó de ser una sección de Ajustes y pasó al menú principal.
  modulos: '/dashboard/modulos',
  // Las herramientas de operación tienen su propia pantalla en el navbar.
  ventas: '/dashboard/punto-de-venta',
  impresion: '/dashboard/impresion',
  facturacion: '/dashboard/facturacion',
}

/**
 * Secciones que se mudaron conservando el query y el hash: el regreso de Mercado Pago
 * (`?plan=success`, `?mp_status`) y los `?config=` que abren un editor puntual.
 */
const REDIRECTS_CON_QUERY: Record<string, string> = {
  // General y Cuenta ya no son tabs: son parte del listado de Ajustes.
  general: AJUSTES,
  activacion: AJUSTES,
  cuenta: AJUSTES,
  suscripcion: AJUSTES,
  // Pasaron al navbar.
  monetizacion: '/dashboard/pagos',
  pagos: '/dashboard/pagos',
  entregas: '/dashboard/entregas',
  horarios: '/dashboard/horarios',
  'mi-pagina': '/dashboard/tienda',
  tienda: '/dashboard/tienda',
}
const DESTINO_PUNTOS = '/dashboard/marketing/puntos'

/**
 * Qué módulos tiene que tener activos un local para que una herramienta de Ajustes
 * tenga sentido. `todos` exige cada código; `alguno` alcanza con uno.
 */
interface RequisitoModulos { todos?: string[]; alguno?: string[]; ninguno?: string[] }

const REQUISITOS: Record<string, RequisitoModulos> = {
  whatsapp: { todos: ['avisos_automaticos_whatsapp'] },
  // Con avisos automáticos todo sale por Meta: el WhatsApp vinculado no aplica.
  'whatsapp-local': { ninguno: ['avisos_automaticos_whatsapp'] },
  mozos: { todos: ['pos', 'mesas'] },
  medicion: { todos: ['crecimiento'] },
}

export default function AjustesPage() {
  const { seccion: seccionParam } = useParams()
  const seccion = seccionParam ? ALIASES_SECCION[seccionParam] ?? seccionParam : null
  const { hash, search, key: locationKey } = useLocation()
  const navigate = useNavigate()
  const restaurante = useRestauranteStore((s) => s.restaurante)
  const { categorias, cargar, error, cargando } = useModulosStore()
  const contenidoRef = useRef<HTMLDivElement>(null)
  const modulos = categorias.flatMap((c) => c.modulos)
  const activo = (codigo: string) => modulos.some((m) => m.codigo === codigo && m.activoAhora)
  const habilitada = (id: string) => {
    const requisito = REQUISITOS[id]
    if (!requisito) return true
    if (requisito.alguno && !requisito.alguno.some(activo)) return false
    if (requisito.ninguno?.some(activo)) return false
    return (requisito.todos ?? []).every(activo)
  }
  const active = seccion ? SECTIONS.find((s) => s.id === seccion) : undefined
  const ActiveSection = active?.Component
  // `baseTienda` ya trae el dominio propio si el local lo tiene (o my.piru.app/<username>/).
  // El literal queda sólo como fallback mientras el perfil todavía no cargó.
  const link = restaurante?.baseTienda ?? (restaurante?.username ? `https://my.piru.app/${restaurante.username}` : null)
  const hostLink = link?.replace(/^https?:\/\//, '').replace(/\/$/, '') ?? null
  const herramientas = SECTIONS.filter((s) => habilitada(s.id))

  useEffect(() => {
    void cargar().catch(() => {})
  }, [cargar])
  useEffect(() => {
    if (contenidoRef.current) resetSettingsScroll(contenidoRef.current)
    contenidoRef.current?.focus({ preventScroll: true })
  }, [seccion, hash, locationKey])

  if (seccion) {
    const destino =
      seccion === 'retencion' && new URLSearchParams(search).get('config') === 'puntos'
        ? DESTINO_PUNTOS
        : REDIRECTS_SECCION[seccion] ?? (REDIRECTS_CON_QUERY[seccion] && `${REDIRECTS_CON_QUERY[seccion]}${search}${hash}`)
    if (destino) return <Navigate to={destino} replace />
  }

  const errorModulos = error && <div role="alert" className="mb-5 rounded-lg border border-amber-500/30 p-3 text-sm">No pudimos actualizar los datos. <Button variant="link" size="sm" onClick={() => void cargar(true).catch(() => {})}>Reintentar</Button></div>

  if (seccion) {
    return <main ref={contenidoRef} tabIndex={-1} className="mx-auto min-w-0 w-full max-w-3xl px-4 py-8 outline-none sm:px-6 lg:py-12">
      <SettingsNavigation key={seccion}>
        <Button asChild variant="ghost" className="mb-5 -ml-3 min-h-11 gap-2"><Link to={AJUSTES} aria-label="Volver a Ajustes"><ArrowLeft className="size-4" />Ajustes</Link></Button>
        {errorModulos}
        {active ? cargando && modulos.length === 0 ? <SectionSkeleton />
            : !habilitada(active.id) ? <div className="space-y-4"><SectionHeading title={active.label} description="Activá el módulo para acceder a su configuración." /><Button asChild variant="outline"><Link to="/dashboard/modulos">Ver módulos<ChevronRight className="size-4" /></Link></Button></div>
            : <Suspense key={seccion} fallback={<SectionSkeleton />}>{ActiveSection && <ActiveSection />}</Suspense>
          : <div className="space-y-4"><SectionHeading title="Sección no encontrada" description="Volvé a Ajustes para elegir qué configurar." /><Button asChild variant="outline"><Link to={AJUSTES}>Ir a Ajustes</Link></Button></div>}
      </SettingsNavigation>
    </main>
  }

  return <main ref={contenidoRef} tabIndex={-1} className="mx-auto min-w-0 w-full max-w-3xl px-4 py-8 outline-none sm:px-6 lg:py-12">
    <SettingsNavigation>
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-border/50 pb-7">
        <div><h1 className="text-3xl font-semibold tracking-tight">Ajustes</h1><p className="mt-2 text-sm text-muted-foreground">Tu negocio, tus herramientas y tu cuenta.</p></div>
        {link && <div className="flex max-w-full items-center gap-1 rounded-xl bg-muted/60 p-1">
          <a href={link} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 px-3 py-2 text-sm font-medium"><Globe className="size-4 shrink-0 text-brand" /><span className="max-w-48 truncate">{hostLink}</span><ExternalLink className="size-3.5 shrink-0 text-muted-foreground" /></a>
          <Button size="icon" variant="ghost" aria-label="Copiar link de mi tienda" onClick={async () => { try { await navigator.clipboard.writeText(link); toast.success('Link copiado') } catch { toast.error('No se pudo copiar el link') } }}><Copy className="size-4" /></Button>
        </div>}
      </header>
      {errorModulos}
      <div className="space-y-10">
        <General />
        {herramientas.length > 0 && <section className="space-y-3">
          <SectionHeading title="Herramientas" description="La configuración de los módulos que activaste." />
          <div>{herramientas.map((s) => <AjusteRow key={s.id} titulo={s.label} oracion={s.descripcion} accionLabel="Abrir" onAccion={() => navigate(`${AJUSTES}/${s.id}`)} />)}</div>
        </section>}
        <Cuenta />
      </div>
    </SettingsNavigation>
  </main>
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return <header className="space-y-1"><h2 className="text-lg font-medium">{title}</h2><p className="text-sm text-muted-foreground">{description}</p></header>
}
