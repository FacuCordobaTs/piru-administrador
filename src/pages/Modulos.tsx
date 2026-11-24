import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import {
  BellRing,
  Blocks,
  CalendarDays,
  Check,
  Clock3,
  CreditCard,
  MonitorSmartphone,
  Armchair,
  Star,
  TicketPercent,
  Wallet,
  Receipt,
  Package,
  Bike,
  Printer,
  Store,
  Repeat,
  Megaphone,
  Search,
  ArrowLeft,
  Loader2,
  MessageCircle,
  Wrench,
  ChevronRight,
  CircleCheck,
  CircleAlert,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/settings-dialog'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/settings-dialog'
import { cn } from '@/lib/utils'
import { useModulosStore } from '@/store/modulosStore'
import { usePlanTienda } from '@/store/planTiendaStore'
import type { Modulo } from '@/lib/api'

const fmtARS = (monto: string | number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(Number(monto))

// Cada módulo con su ícono y color propio, como las apps de una tienda: se reconoce de un vistazo.
const ICONOS: Record<string, [typeof Blocks, string]> = {
  pos: [MonitorSmartphone, 'from-violet-500 to-indigo-600'],
  mesas: [Armchair, 'from-amber-400 to-orange-500'],
  puntos_clientes: [Star, 'from-yellow-400 to-amber-500'],
  codigos_descuento: [TicketPercent, 'from-pink-500 to-rose-600'],
  mercadopago: [CreditCard, 'from-sky-400 to-blue-600'],
  talo: [Wallet, 'from-teal-400 to-emerald-600'],
  facturacion_arca: [Receipt, 'from-slate-500 to-slate-700'],
  gestion_stock: [Package, 'from-orange-400 to-red-500'],
  gestion_cadetes: [Bike, 'from-lime-500 to-green-600'],
  impresion_comandas: [Printer, 'from-zinc-500 to-zinc-800'],
  multisucursal: [Store, 'from-cyan-400 to-sky-600'],
  avisos_automaticos_whatsapp: [BellRing, 'from-green-400 to-emerald-600'],
  motor_recompra: [Repeat, 'from-fuchsia-500 to-purple-600'],
  dias_flojos: [CalendarDays, 'from-blue-400 to-indigo-500'],
  crecimiento: [Megaphone, 'from-rose-400 to-red-600'],
  cierre_turno_manual: [Clock3, 'from-stone-400 to-stone-600'],
}

function IconoModulo({ codigo, className }: { codigo: string; className?: string }) {
  const [Icon, color] = ICONOS[codigo] ?? [Blocks, 'from-zinc-400 to-zinc-600']
  return <span className={cn('flex shrink-0 items-center justify-center rounded-[22%] bg-gradient-to-br text-white shadow-sm ring-1 ring-black/5', color, className)}><Icon className="size-[45%]" strokeWidth={2.2} /></span>
}

function requisitoConfiguracion(modulo: Modulo) {
  if (modulo.estadoProducto === 'proximamente') return 'Configuración en preparación'
  if (!modulo.activable) return 'Configuración en preparación'
  if (modulo.codigo === 'mercadopago') return 'Requiere conectar Mercado Pago'
  if (modulo.codigo === 'talo') return 'Requiere cargar tus credenciales de Talo'
  if (modulo.codigo === 'facturacion_arca') return 'Requiere completar la configuración de ARCA'
  if (modulo.codigo === 'impresion_comandas') return 'Requiere configurar una impresora'
  return null
}

const RUTAS_CONFIGURACION: Partial<Record<string, string>> = {
  pos: '/dashboard/punto-de-venta',
  mesas: '/dashboard/mesas',
  gestion_stock: '/dashboard/stock',
  motor_recompra: '/dashboard/marketing/recompra',
  dias_flojos: '/dashboard/marketing/dias-flojos',
  puntos_clientes: '/dashboard/marketing/puntos',
  codigos_descuento: '/dashboard/marketing/cupones',
  mercadopago: '/dashboard/pagos?config=mercadopago',
  talo: '/dashboard/pagos?config=talo',
  gestion_cadetes: '/dashboard/repartidores',
  facturacion_arca: '/dashboard/facturacion',
  impresion_comandas: '/dashboard/impresion',
  multisucursal: '/dashboard/sucursales',
  avisos_automaticos_whatsapp: '/dashboard/ajustes/whatsapp?config=avisos',
  crecimiento: '/dashboard/marketing/campanas',
}

/**
 * Los módulos pagos siempre muestran su próximo paso explícitamente: cobrar,
 * esperar acreditación, programar baja o revertirla. La activación real sigue
 * dependiendo exclusivamente del webhook aprobado.
 */
function AccionModulo({
  modulo,
  procesando,
  onActivar,
  onDesactivar,
  onActivarPago,
  onReactivarPago,
  onActualizarPago,
  onConfigurar,
  bloqueoPlan,
}: {
  modulo: Modulo
  procesando: boolean
  onActivar: () => void
  onDesactivar: () => void
  onActivarPago: () => void
  onReactivarPago: () => void
  onActualizarPago: () => void
  onConfigurar: () => void
  /** Con un plan de tienda: el plan desde el que está disponible, si el actual no lo incluye. */
  bloqueoPlan?: string | null
}) {
  if (bloqueoPlan) {
    return <Button className="w-full" onClick={() => window.location.assign('/dashboard/planes')}>Disponible desde el plan {bloqueoPlan}</Button>
  }
  if (modulo.estadoProducto === 'proximamente' || !modulo.activable) {
    return <Button className="w-full" variant="secondary" disabled>Próximamente</Button>
  }
  if ((modulo.estado === 'activo' || modulo.estado === 'cancelacion_programada') && !modulo.activoAhora) return <Button onClick={() => window.location.assign('/dashboard/ajustes')}>Revisar suscripción</Button>
  if (modulo.estado === 'activo') {
    if (modulo.tipo === 'pago') {
      return <div className="grid gap-2">{RUTAS_CONFIGURACION[modulo.codigo] && <Button onClick={onConfigurar}>Configurar módulo</Button>}<Button className="w-full" variant="ghost" disabled={procesando} onClick={onDesactivar}>{procesando ? 'Guardando…' : 'Desactivar al finalizar el período'}</Button></div>
    }
    const conConfiguracion = Boolean(RUTAS_CONFIGURACION[modulo.codigo])
    return (
      <div className={cn('grid gap-2', conConfiguracion && 'grid-cols-2')}>
        {conConfiguracion ? (
          <Button variant="outline" onClick={onConfigurar}>Configurar</Button>
        ) : null}
        <Button variant="ghost" disabled={procesando} onClick={onDesactivar}>
          {procesando ? 'Guardando…' : 'Desactivar'}
        </Button>
      </div>
    )
  }
  if (modulo.estado === 'cancelacion_programada') {
    return <Button className="w-full" variant="outline" disabled={procesando} onClick={onReactivarPago}>{procesando ? 'Guardando…' : 'Reactivar módulo'}</Button>
  }
  if (modulo.estado === 'pendiente_pago') {
    return <div className="grid gap-2"><Button variant="outline" disabled={procesando} onClick={onActualizarPago}>Ya pagué, verificar</Button><Button variant="ghost" disabled={procesando} onClick={onActivarPago}>Volver al pago</Button></div>
  }
  if (modulo.estado === 'suspendido') {
    return <Button className="w-full" variant="outline" onClick={() => window.location.assign('/dashboard/ajustes')}>Revisar suscripción</Button>
  }
  return modulo.tipo === 'pago'
    ? <Button className="w-full" disabled={procesando} onClick={onActivarPago}>Activar por {fmtARS(modulo.precioMensual)}/mes</Button>
    : <Button className="w-full" disabled={procesando} onClick={onActivar}>{procesando ? 'Activando…' : 'Activar gratis'}</Button>
}

function estadoCorto(modulo: Modulo) {
  if (modulo.estadoProducto === 'proximamente' || !modulo.activable) return 'Pronto'
  if (modulo.estado === 'cancelacion_programada') return 'Baja programada'
  if (modulo.estado === 'pendiente_pago') return 'Pago pendiente'
  if (modulo.activoAhora) return 'Activo'
  if (modulo.estado === 'activo' || modulo.estado === 'suspendido') return 'Revisar'
  return null
}

/** Ficha de módulo estilo tienda de apps: ícono, nombre, una línea y la píldora de acción. */
function CardModulo({
  modulo,
  onSeleccionar,
  bloqueoPlan,
  variante = 'carrusel',
}: {
  modulo: Modulo
  onSeleccionar: () => void
  bloqueoPlan?: string | null
  variante?: 'carrusel' | 'lista'
}) {
  const estado = estadoCorto(modulo)
  const precio = bloqueoPlan ? `Plan ${bloqueoPlan}` : modulo.tipo === 'pago' ? `${fmtARS(modulo.precioMensualCongelado ?? modulo.precioMensual)}/mes` : 'Gratis'
  const pildora = estado ?? (modulo.tipo === 'pago' && !bloqueoPlan ? 'Ver' : 'Activar')
  return (
    <button
      type="button"
      onClick={onSeleccionar}
      className={cn(
        'group flex w-full items-center gap-3.5 rounded-2xl p-2.5 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
        variante === 'carrusel' && 'snap-start',
      )}
    >
      <IconoModulo codigo={modulo.codigo} className="size-16" />
      <span className="min-w-0 flex-1 self-stretch border-b border-border/60 pb-2.5 group-last:border-0">
        <span className="block truncate text-[15px] font-semibold text-foreground">{modulo.nombre}</span>
        <span className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">{modulo.descripcion || 'Sumá esta herramienta a tu negocio.'}</span>
        <span className="mt-1 block text-[11px] font-medium text-muted-foreground/80">{precio}</span>
      </span>
      <span className={cn(
        'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold',
        modulo.activoAhora ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : estado ? 'bg-muted text-muted-foreground' : 'bg-brand/10 text-brand group-hover:bg-brand group-hover:text-white',
      )}>{pildora}</span>
    </button>
  )
}

/** Fila de una sección: carrusel horizontal en columnas de 3 fichas, con "Ver todos". */
function SeccionModulos({
  titulo,
  descripcion,
  modulos,
  onVerTodos,
  renderCard,
}: {
  titulo: string
  descripcion?: string | null
  modulos: Modulo[]
  onVerTodos: () => void
  renderCard: (m: Modulo) => React.ReactNode
}) {
  const columnas: Modulo[][] = []
  for (let i = 0; i < modulos.length; i += 3) columnas.push(modulos.slice(i, i + 3))
  return (
    <section>
      <div className="mb-2 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-foreground">{titulo}</h2>
          {descripcion && <p className="mt-0.5 truncate text-sm text-muted-foreground">{descripcion}</p>}
        </div>
        {modulos.length > 3 && (
          <button type="button" onClick={onVerTodos} className="flex shrink-0 items-center gap-0.5 text-sm font-semibold text-brand hover:underline">
            Ver todos <ChevronRight className="size-4" />
          </button>
        )}
      </div>
      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:scroll-px-6 sm:px-6 [&::-webkit-scrollbar]:hidden">
        {columnas.map((col, i) => (
          <div key={i} className={cn('flex shrink-0 snap-start flex-col', columnas.length > 1 ? 'w-[86%] sm:w-[420px]' : 'w-full sm:max-w-[420px]')}>
            {col.map(m => <div key={m.codigo} className="group">{renderCard(m)}</div>)}
          </div>
        ))}
      </div>
    </section>
  )
}

function CatalogoSkeleton() {
  return (
    <div className="space-y-10">
      {[0, 1, 2].map((grupo) => (
        <section key={grupo}>
          <Skeleton className="h-6 w-44" />
          <div className="mt-4 flex gap-4 overflow-hidden">
            {[0, 1].map((col) => (
              <div key={col} className="w-[86%] shrink-0 space-y-4 sm:w-[420px]">
                {[0, 1, 2].map((card) => <div key={card} className="flex items-center gap-3.5"><Skeleton className="size-16 rounded-2xl" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-48" /></div></div>)}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

const activos_ = (ms: Modulo[]) => ms.filter(m => m.activoAhora)

export default function Modulos() {
  const [filtro, setFiltro] = useState<'todos' | 'activos' | 'incluidos' | 'pagos'>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [seccionAbierta, setSeccionAbierta] = useState<string | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const categoriasStore = useModulosStore((state) => state.categorias)
  // Con un plan de tienda (no Evolución) nada se paga por módulo: lo incluido se muestra como
  // incluido y lo demás como "Disponible desde el plan X". Evolución ve el catálogo de siempre.
  const { plan } = usePlanTienda()
  const conPlan = Boolean(plan && !plan.esLegado)
  const categorias = conPlan
    ? categoriasStore.map(c => ({ ...c, modulos: c.modulos.map(m => m.incluidoEnPlan ? { ...m, tipo: 'incluido' as const } : m) }))
    : categoriasStore
  const bloqueoPlan = (m: Modulo) => {
    if (!conPlan || m.incluidoEnPlan) return null
    return plan?.catalogo.find(p => p.codigo === m.planMinimo)?.nombre ?? 'Evolución'
  }
  const cargando = useModulosStore((state) => state.cargando)
  const error = useModulosStore((state) => state.error)
  const cargar = useModulosStore((state) => state.cargar)
  const activar = useModulosStore((state) => state.activar)
  const desactivar = useModulosStore((state) => state.desactivar)
  const checkoutModulo = useModulosStore((state) => state.checkoutModulo)
  const enviarPagoLinkModulo = useModulosStore((state) => state.enviarPagoLinkModulo)
  const reactivar = useModulosStore((state) => state.reactivar)
  const [procesandoCodigo, setProcesandoCodigo] = useState<string | null>(null)
  const [seleccion, setModuloSeleccionado] = useState<Modulo | null>(null)
  const moduloSeleccionado = categorias.flatMap(c => c.modulos).find(m => m.codigo === seleccion?.codigo) ?? seleccion
  const [moduloPagoSeleccionado, setModuloPagoSeleccionado] = useState<Modulo | null>(null)
  const [confirmandoBaja, setConfirmandoBaja] = useState<Modulo | null>(null)
  const vieneDeActivarSuscripcion = new URLSearchParams(location.search).get('origen') === 'suscripcion'

  useEffect(() => {
    void cargar().catch(() => undefined)
  }, [cargar])

  useEffect(() => {
    if (new URLSearchParams(location.search).get('checkout') !== 'success') return
    let cancelado = false
    const demoras = [0, 1500, 4000, 8000]
    const verificar = async (intento: number) => {
      try {
        await cargar(true)
        if (!cancelado && intento === 0) toast.info('Estamos verificando la acreditación de tu pago…')
      } catch { /* el próximo intento vuelve a consultar */ }
      if (!cancelado && intento + 1 < demoras.length) window.setTimeout(() => void verificar(intento + 1), demoras[intento + 1])
      if (!cancelado && intento + 1 === demoras.length) window.history.replaceState({}, '', '/dashboard/modulos')
    }
    void verificar(0)
    return () => { cancelado = true }
  }, [cargar, location.search])

  const categoriasFiltradas = categorias.map(c => ({ ...c, modulos: c.modulos.filter(m =>
    (m.activable || m.activoAhora)
    && (filtro === 'todos' || filtro === 'activos' && m.activoAhora || filtro === 'incluidos' && m.tipo === 'incluido' || filtro === 'pagos' && m.tipo === 'pago')
  ) }))
  // Campañas de adquisición se lista junto a Códigos de descuento, aunque un
  // catálogo viejo todavía la tenga como paga: el cobro se resuelve al abrirla.
  const enCategoria = (m: Modulo) => m.tipo === 'incluido' || m.codigo === 'crecimiento'
  const categoriasNormales = categoriasFiltradas.filter(c => c.modulos.some(enCategoria))
  const pagos = categoriasFiltradas.flatMap(c => c.modulos).filter(m => m.tipo === 'pago' && m.codigo !== 'crecimiento')
  const visibles = categoriasFiltradas.flatMap(c => c.modulos)
  const normalizar = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const termino = normalizar(busqueda.trim())
  const resultados = termino ? visibles.filter(m => normalizar(`${m.nombre} ${m.descripcion ?? ''}`).includes(termino)) : []
  // Secciones del catálogo en orden: activos, cada categoría y los pagos al final.
  const secciones = [
    ...(filtro === 'todos' && activos_(visibles).length ? [{ id: 'activos', titulo: 'Tus módulos activos', descripcion: 'Ya funcionan en tu local.', modulos: activos_(visibles) }] : []),
    ...categoriasNormales.map(c => ({ id: c.codigo, titulo: c.nombre, descripcion: c.descripcion, modulos: c.modulos.filter(enCategoria) })),
    ...(pagos.length ? [{ id: 'pagos', titulo: 'Módulos pagos', descripcion: 'Se suman a tu suscripción mensual.', modulos: pagos }] : []),
  ].filter(sec => sec.modulos.length)
  const seccion = secciones.find(sec => sec.id === seccionAbierta)
  const card = (m: Modulo, variante?: 'carrusel' | 'lista') => <CardModulo modulo={m} variante={variante} bloqueoPlan={bloqueoPlan(m)} onSeleccionar={() => setModuloSeleccionado(m)} />

  const activarIncluido = async (modulo: Modulo) => {
    setProcesandoCodigo(modulo.codigo)
    try {
      await activar(modulo.codigo)
      const ruta = RUTAS_CONFIGURACION[modulo.codigo]
      toast.success(`${modulo.nombre} está activo`, ruta ? {
        description: 'El siguiente paso es revisar su configuración.',
        action: { label: 'Configurar', onClick: () => navigate(ruta) },
      } : undefined)
    } catch (error) {
      toast.error(`No pudimos activar ${modulo.nombre}`, {
        description: error instanceof Error ? error.message : 'Intentá de nuevo.',
      })
    } finally {
      setProcesandoCodigo(null)
    }
  }

  const desactivarIncluido = async (modulo: Modulo) => {
    setProcesandoCodigo(modulo.codigo)
    try {
      await desactivar(modulo.codigo)
      toast.success(`${modulo.nombre} fue desactivado`)
    } catch (error) {
      toast.error(`No pudimos desactivar ${modulo.nombre}`, {
        description: error instanceof Error ? error.message : 'Intentá de nuevo.',
      })
    } finally {
      setProcesandoCodigo(null)
    }
  }

  const configurarModulo = (modulo: Modulo) => {
    const ruta = RUTAS_CONFIGURACION[modulo.codigo]
    if (ruta) { setModuloSeleccionado(null); navigate(ruta) }
  }

  const totalMensualCon = (modulo: Modulo) => {
    const suscripcion = useModulosStore.getState().suscripcion
    // La cotización viene del catálogo vigente; `montoTotalMensual` es el
    // snapshot de la última factura y puede tener un precio base anterior.
    const actual = Number(suscripcion?.cotizacionProximaFactura?.montoTotalMensual ?? suscripcion?.montoTotalMensual ?? 0)
    return actual + Number(modulo.precioMensual)
  }

  const iniciarCheckout = async () => {
    const modulo = moduloPagoSeleccionado
    if (!modulo) return
    setProcesandoCodigo(modulo.codigo)
    try {
      const checkout = await checkoutModulo(modulo.codigo)
      window.location.assign(checkout.url_pago)
    } catch (error) {
      toast.error(`No pudimos iniciar el pago de ${modulo.nombre}`, { description: error instanceof Error ? error.message : 'Intentá de nuevo.' })
    } finally {
      setProcesandoCodigo(null)
    }
  }

  const enviarLinkPago = async () => {
    const modulo = moduloPagoSeleccionado
    if (!modulo) return
    setProcesandoCodigo(modulo.codigo)
    try {
      const resultado = await enviarPagoLinkModulo(modulo.codigo)
      setModuloPagoSeleccionado(null)
      toast.success(`Te enviamos el link de pago a WhatsApp (${resultado.telefono})`)
    } catch (error) {
      toast.error(`No pudimos enviar el link de ${modulo.nombre}`, { description: error instanceof Error ? error.message : 'Intentá de nuevo.' })
    } finally {
      setProcesandoCodigo(null)
    }
  }

  const programarBaja = async () => {
    const modulo = confirmandoBaja
    if (!modulo) return
    setProcesandoCodigo(modulo.codigo)
    try {
      await desactivar(modulo.codigo)
      setConfirmandoBaja(null)
      toast.success(`La baja de ${modulo.nombre} quedó programada`, { description: 'Va a seguir disponible hasta el final del período ya pagado.' })
    } catch (error) {
      toast.error(`No pudimos programar la baja de ${modulo.nombre}`, { description: error instanceof Error ? error.message : 'Intentá de nuevo.' })
    } finally {
      setProcesandoCodigo(null)
    }
  }

  const reactivarPago = async (modulo: Modulo) => {
    setProcesandoCodigo(modulo.codigo)
    try {
      const resultado = await reactivar(modulo.codigo)
      if (resultado && 'url_pago' in resultado) {
        window.location.assign(resultado.url_pago)
        return
      }
      toast.success(`${modulo.nombre} sigue activo y no se dará de baja`)
    } catch (error) {
      toast.error(`No pudimos reactivar ${modulo.nombre}`, { description: error instanceof Error ? error.message : 'Intentá de nuevo.' })
    } finally {
      setProcesandoCodigo(null)
    }
  }


  const listaGrid = (ms: Modulo[]) => (
    <div className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
      {ms.map(m => <div key={m.codigo} className="group">{card(m, 'lista')}</div>)}
    </div>
  )

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Módulos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sumá sólo las herramientas que tu local necesita.</p>
        </div>
        <label className="relative block sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={busqueda}
            onChange={e => { setBusqueda(e.target.value); setSeccionAbierta(null) }}
            placeholder="Buscar módulos"
            aria-label="Buscar módulos"
            className="h-10 w-full rounded-full border-0 bg-muted pl-9 pr-4 text-sm outline-none ring-brand placeholder:text-muted-foreground focus-visible:ring-2"
          />
        </label>
      </header>

      {!termino && !seccion && (
        <div aria-label="Filtrar herramientas" className="-mx-4 mb-8 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
          {([['todos', 'Todos'], ['activos', 'Mis módulos'], ['incluidos', 'Gratis'], ['pagos', 'Pagos']] as const).map(([id, label]) => (
            <Button key={id} size="sm" variant={filtro === id ? 'default' : 'secondary'} aria-pressed={filtro === id} className="shrink-0 rounded-full px-4" onClick={() => setFiltro(id)}>{label}</Button>
          ))}
        </div>
      )}

      {vieneDeActivarSuscripcion && (
        <div className="mb-8 flex items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm">
          <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div><p className="font-medium text-foreground">Tu suscripción está en proceso de acreditación.</p><p className="mt-1 text-muted-foreground">Cuando esté activa, podés elegir los módulos que necesitás. Los incluidos son gratis y los pagos se activan sólo si los confirmás.</p></div>
        </div>
      )}

      {cargando && categorias.length === 0 ? <CatalogoSkeleton /> : error && categorias.length === 0 ? (
        <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-6 text-center">
          <p className="font-medium text-foreground">No pudimos cargar tus módulos</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <Button className="mt-4" variant="outline" onClick={() => void cargar(true).catch(() => {})}>Reintentar</Button>
        </div>
      ) : termino ? (
        <section>
          <p className="mb-3 text-sm text-muted-foreground">{resultados.length ? `${resultados.length} resultado${resultados.length === 1 ? '' : 's'}` : `No encontramos módulos para “${busqueda.trim()}”.`}</p>
          {listaGrid(resultados)}
        </section>
      ) : seccion ? (
        <section>
          <button type="button" onClick={() => setSeccionAbierta(null)} className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
            <ArrowLeft className="size-4" /> Todos los módulos
          </button>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">{seccion.titulo}</h2>
          {seccion.descripcion && <p className="mt-1 text-sm text-muted-foreground">{seccion.descripcion}</p>}
          <div className="mt-5">{listaGrid(seccion.modulos)}</div>
        </section>
      ) : (
        <div className="space-y-10">
          {secciones.length === 0 && <p className="py-6 text-sm text-muted-foreground">{filtro === 'activos' ? 'Todavía no tenés módulos activos. Elegí uno del catálogo para empezar.' : 'No hay módulos disponibles con este filtro.'}</p>}
          {secciones.map(sec => (
            <SeccionModulos
              key={sec.id}
              titulo={sec.titulo}
              descripcion={sec.descripcion}
              modulos={sec.modulos}
              onVerTodos={() => { setSeccionAbierta(sec.id); window.scrollTo({ top: 0 }) }}
              renderCard={m => card(m)}
            />
          ))}
          {error && <p className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400"><Clock3 className="h-4 w-4" /> Mostramos la última información disponible. {error}</p>}
        </div>
      )}

      <Sheet open={Boolean(moduloSeleccionado)} onOpenChange={(abierto) => !abierto && setModuloSeleccionado(null)}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
          {moduloSeleccionado && (() => {
            const requisito = requisitoConfiguracion(moduloSeleccionado)
            const configuracion = requisito ?? (moduloSeleccionado.codigo === 'pos'
              ? 'Podés elegir qué datos y opciones se muestran al anotar un pedido.'
              : RUTAS_CONFIGURACION[moduloSeleccionado.codigo]
                ? 'Podés dejar este módulo listo desde su pantalla de configuración.'
                : null)
            const proximamente = moduloSeleccionado.estadoProducto === 'proximamente' || !moduloSeleccionado.activable
            const activo = moduloSeleccionado.activoAhora
            const estadoTexto = proximamente
              ? 'Este módulo está en preparación'
              : activo
                ? requisito ? 'Está activo y necesita una configuración final' : 'Está activo y listo para usar'
                : moduloSeleccionado.estado === 'activo' ? 'Revisá tu suscripción para volver a usarlo'
                : moduloSeleccionado.estado === 'cancelacion_programada'
                  ? 'La baja está programada al finalizar el período'
                  : moduloSeleccionado.estado === 'pendiente_pago'
                    ? 'Estamos esperando la acreditación del pago'
                    : moduloSeleccionado.estado === 'suspendido'
                      ? 'Este módulo está suspendido'
                      : 'Todavía no está activo'

            return <>
              <SheetHeader className="border-b px-6 py-6 pr-12 text-left">
                <div className="flex items-center gap-3">
                  <IconoModulo codigo={moduloSeleccionado.codigo} className={cn('size-14', proximamente && 'opacity-60 grayscale')} />
                  <div>
                    <SheetTitle className="text-xl font-semibold tracking-tight">{moduloSeleccionado.nombre}</SheetTitle>
                    {moduloSeleccionado.tipo === 'pago' && <p className="mt-0.5 text-sm font-medium text-muted-foreground">+{fmtARS(moduloSeleccionado.precioMensual)}/mes</p>}
                  </div>
                </div>
                <SheetDescription className="pt-3 text-sm leading-relaxed">
                  {moduloSeleccionado.descripcion || 'Sumá esta capacidad a la operación de tu local.'}
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
                <div className={cn(
                  'rounded-2xl p-4',
                  proximamente ? 'bg-muted/70' : activo ? 'bg-emerald-50 dark:bg-emerald-950/25' : 'bg-muted/55',
                )}>
                  <div className="flex items-start gap-3">
                    {activo ? <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />}
                    <div>
                      <p className="text-sm font-medium text-foreground">{estadoTexto}</p>
                    </div>
                  </div>
                </div>

                <ol className="space-y-3 text-sm" aria-label="Pasos para usar el módulo">
                  <li className="flex gap-3"><span className="font-semibold text-brand">01</span><span>{activo ? 'Activación completada' : moduloSeleccionado.tipo === 'pago' ? 'Confirmá el pago para activar' : 'Activá sin costo adicional'}</span></li>
                  <li className="flex gap-3"><span className="font-semibold text-brand">02</span><span>{configuracion ? 'Revisá la configuración para tu negocio' : 'La herramienta aparece en tu operación'}</span></li>
                </ol>
                {moduloSeleccionado.tipo === 'pago' && <p className="rounded-xl bg-muted p-4 text-sm">Incluye {moduloSeleccionado.mensajesUtilityIncluidos > 0 ? `${moduloSeleccionado.mensajesUtilityIncluidos} avisos de pedidos` : `${moduloSeleccionado.mensajesMarketingIncluidos} mensajes de campaña`} por ciclo. Las recargas se compran por separado.</p>}
                {configuracion && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Configuración</p>
                    <div className="flex gap-3 rounded-2xl bg-muted/55 p-4">
                      <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <p className="text-sm leading-relaxed text-muted-foreground">{configuracion}</p>
                    </div>
                  </div>
                )}

                {moduloSeleccionado.tipo === 'pago' && !proximamente && moduloSeleccionado.estado === 'inactivo' && (
                  <div className="rounded-2xl bg-muted/55 p-4 text-sm text-muted-foreground">
                    El primer cargo se prorratea hasta tu próxima renovación. Luego se integra a tu factura mensual.
                  </div>
                )}
              </div>

              <SheetFooter className="border-t px-6 py-5">
                {activo && moduloSeleccionado.estado === 'cancelacion_programada' && RUTAS_CONFIGURACION[moduloSeleccionado.codigo] && <Button onClick={() => configurarModulo(moduloSeleccionado)}>Configurar</Button>}
                {!bloqueoPlan(moduloSeleccionado) && moduloSeleccionado.tipo === 'pago' && !moduloSeleccionado.activoAhora && !['activa', 'pago_pendiente'].includes(useModulosStore.getState().suscripcion?.estado ?? '') ? <div className="space-y-3"><p className="text-sm text-muted-foreground">Primero necesitás una suscripción base activa. La prueba gratis no incluye herramientas pagas.</p><Button className="w-full" onClick={() => { setModuloSeleccionado(null); navigate('/dashboard/ajustes') }}>Ver mi suscripción</Button></div> : <AccionModulo
                  bloqueoPlan={bloqueoPlan(moduloSeleccionado)}
                  modulo={moduloSeleccionado}
                  procesando={procesandoCodigo === moduloSeleccionado.codigo}
                  onActivar={() => void activarIncluido(moduloSeleccionado)}
                  onDesactivar={() => moduloSeleccionado.tipo === 'pago' ? setConfirmandoBaja(moduloSeleccionado) : void desactivarIncluido(moduloSeleccionado)}
                  onActivarPago={() => setModuloPagoSeleccionado(moduloSeleccionado)}
                  onReactivarPago={() => void reactivarPago(moduloSeleccionado)}
                  onActualizarPago={() => void cargar(true).catch(() => toast.error('No se pudo verificar el pago'))}
                  onConfigurar={() => configurarModulo(moduloSeleccionado)}
                />}
              </SheetFooter>
            </>
          })()}
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(moduloPagoSeleccionado)} onOpenChange={(abierto) => !procesandoCodigo && !abierto && setModuloPagoSeleccionado(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Activar {moduloPagoSeleccionado?.nombre}</DialogTitle>
            <DialogDescription>
              Se cobra sólo el período restante hasta tu próxima renovación. Después se suma a tu factura habitual.
            </DialogDescription>
          </DialogHeader>
          {moduloPagoSeleccionado && <div className="rounded-xl bg-muted/60 p-4 text-sm">
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Módulo</span><span>+{fmtARS(moduloPagoSeleccionado.precioMensual)}/mes</span></div>
            <div className="mt-2 flex justify-between gap-4 border-t pt-2 font-medium"><span>Tu total mensual pasa a</span><span>{fmtARS(totalMensualCon(moduloPagoSeleccionado))}/mes</span></div>
          </div>}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" disabled={Boolean(procesandoCodigo)} onClick={() => setModuloPagoSeleccionado(null)}>Cancelar</Button>
            <Button variant="outline" disabled={Boolean(procesandoCodigo)} onClick={() => void enviarLinkPago()}><MessageCircle className="h-4 w-4" />Link por WhatsApp</Button>
            <Button disabled={Boolean(procesandoCodigo)} onClick={() => void iniciarCheckout()}>{procesandoCodigo ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Pagar ahora'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(confirmandoBaja)} onOpenChange={(abierto) => !procesandoCodigo && !abierto && setConfirmandoBaja(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Programar la baja de {confirmandoBaja?.nombre}?</DialogTitle>
            <DialogDescription>No se reintegra el período actual: el módulo seguirá activo hasta la fecha que ya tenés paga.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" disabled={Boolean(procesandoCodigo)} onClick={() => setConfirmandoBaja(null)}>Conservar módulo</Button>
            <Button variant="destructive" disabled={Boolean(procesandoCodigo)} onClick={() => void programarBaja()}>{procesandoCodigo ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Programar baja'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
