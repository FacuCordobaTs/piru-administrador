import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/store/authStore'
import { useModuloActivo } from '@/store/modulosStore'
import { clientesApi, codigosDescuentoApi, crecimientoApi, productosApi, sucursalesApi, type CampanaCrecimiento } from '@/lib/api'
import { ChevronRight, CircleDollarSign, Crown, DollarSign, Gift, Globe2, Package, Phone, ReceiptText, Search, ShoppingBag, Sparkles, Store, Tag, Timer, Trash2, TrendingUp, User, Users, WandSparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import DeepLinkDialog from './clientes/DeepLinkDialog'
import GrowthAssetsPanel from './clientes/GrowthAssetsPanel'
import { type ClienteGrowth, type CodigoDescuentoGrowth, type FiltroCampana, type PedidoCliente, type ProductoGrowth, SEGMENTOS, type SucursalGrowth, formatCurrency, formatDate, getSegmento, recetaNombre } from './clientes/types'

type AssetTab = 'campanas' | 'cupones'
type SortKey = 'attention' | 'recent' | 'orders' | 'spend' | 'alphabetical'
type SegmentFilter = ReturnType<typeof getSegmento> | 'todos'
type MobileView = 'clientes' | 'detalle' | 'activos'

const prioridad: Record<ReturnType<typeof getSegmento>, number> = { en_riesgo: 6, dormido: 5, perdido: 4, vip: 3, nuevo: 2, activo: 1 }
const iniciales = (nombre: string) => nombre.trim().split(/\s+/).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase()
const dateStart = (fecha?: string) => fecha ? new Date(`${fecha}T00:00:00`).getTime() : null
const dateEnd = (fecha?: string) => fecha ? new Date(`${fecha}T23:59:59.999`).getTime() : null

export default function Clientes() {
  const token = useAuthStore((state) => state.token)
  const username = useAuthStore((state) => state.restaurante?.username)
  const crecimientoActivo = useModuloActivo('crecimiento')
  const cuponesActivos = useModuloActivo('codigos_descuento')
  const [searchParams, setSearchParams] = useSearchParams()
  const [clientes, setClientes] = useState<ClienteGrowth[]>([])
  const [campanas, setCampanas] = useState<CampanaCrecimiento[]>([])
  const [cupones, setCupones] = useState<CodigoDescuentoGrowth[]>([])
  const [sucursales, setSucursales] = useState<SucursalGrowth[]>([])
  const [productos, setProductos] = useState<ProductoGrowth[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [segmento, setSegmento] = useState<SegmentFilter>('todos')
  const [sucursalId, setSucursalId] = useState<number | undefined>()
  const [from, setFrom] = useState<string>()
  const [to, setTo] = useState<string>()
  const [sort, setSort] = useState<SortKey>('attention')
  const [clienteSeleccionado, setClienteSeleccionado] = useState<number | null>(null)
  const [mobileView, setMobileView] = useState<MobileView>('clientes')
  const [assetTab, setAssetTab] = useState<AssetTab>('campanas')
  const [campanaSeleccionada, setCampanaSeleccionada] = useState<FiltroCampana>(null)
  const [cuponSeleccionado, setCuponSeleccionado] = useState<number | null>(null)
  const [deepLinkOpen, setDeepLinkOpen] = useState(false)
  const mainRef = useRef<HTMLElement>(null)

  // Los enlaces del admin anterior siguen abriendo la pantalla correcta, pero
  // se limpia su navegación de tabs porque ahora existe un único workspace.
  useEffect(() => {
    if (!searchParams.has('tab') && !searchParams.has('vista') && !searchParams.has('seccion')) return
    const siguiente = new URLSearchParams(searchParams)
    siguiente.delete('tab'); siguiente.delete('vista'); siguiente.delete('seccion')
    setSearchParams(siguiente, { replace: true })
  }, [searchParams, setSearchParams])

  const cargar = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const [clientesRespuesta, campanasRespuesta, cuponesRespuesta, sucursalesRespuesta, productosRespuesta] = await Promise.all([
        clientesApi.getAll(token, { soloDespachados: true }),
        crecimientoActivo ? crecimientoApi.listarCampanas(token).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        cuponesActivos ? codigosDescuentoApi.getAll(token).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        sucursalesApi.list(token).catch(() => ({ data: [] })),
        crecimientoActivo ? productosApi.getAll(token).catch(() => ({ productos: [] })) : Promise.resolve({ productos: [] }),
      ])
      setClientes(((clientesRespuesta as { data?: ClienteGrowth[] }).data ?? []))
      setCampanas((campanasRespuesta as { data?: CampanaCrecimiento[] }).data ?? [])
      setCupones((cuponesRespuesta as { data?: CodigoDescuentoGrowth[] }).data ?? [])
      setSucursales(((sucursalesRespuesta as { data?: SucursalGrowth[] }).data ?? []).filter((item) => item.activo !== false))
      setProductos(((productosRespuesta as { productos?: ProductoGrowth[] }).productos ?? []))
    } catch (cause) {
      console.error('Error cargando el workspace de clientes:', cause)
      toast.error('No se pudo cargar la base de clientes.')
    } finally { setLoading(false) }
  }, [token, crecimientoActivo, cuponesActivos])
  useEffect(() => { void cargar() }, [cargar])

  const conteoSegmentos = useMemo(() => Object.fromEntries(SEGMENTOS.map((item) => [item.value, clientes.filter((cliente) => getSegmento(cliente) === item.value).length])) as Record<ReturnType<typeof getSegmento>, number>, [clientes])

  const pedidosEnPeriodo = useCallback((cliente: ClienteGrowth) => {
    const desde = dateStart(from); const hasta = dateEnd(to)
    return cliente.pedidos.filter((pedido) => {
      const fecha = new Date(pedido.createdAt).getTime()
      return (!desde || fecha >= desde) && (!hasta || fecha <= hasta) && (!sucursalId || pedido.sucursalId === sucursalId)
    })
  }, [from, to, sucursalId])

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase()
    const hayFiltroPedido = Boolean(from || to || sucursalId || campanaSeleccionada != null || cuponSeleccionado != null)
    const resultado = clientes.filter((cliente) => {
      if (segmento !== 'todos' && getSegmento(cliente) !== segmento) return false
      if (q && !`${cliente.nombre} ${cliente.telefono} ${cliente.direccion ?? ''} ${(cliente.campanasParticipadas ?? []).map((c) => c.nombre).join(' ')} ${(cliente.cuponesUsados ?? []).map((c) => c.codigo).join(' ')}`.toLowerCase().includes(q)) return false
      const pedidos = pedidosEnPeriodo(cliente)
      if (hayFiltroPedido && pedidos.length === 0) return false
      if (campanaSeleccionada === 'organico' && !pedidos.some((pedido) => pedido.esOrganico)) return false
      if (typeof campanaSeleccionada === 'number' && !pedidos.some((pedido) => pedido.campanaId === campanaSeleccionada)) return false
      if (cuponSeleccionado != null && !pedidos.some((pedido) => pedido.codigoDescuentoId === cuponSeleccionado)) return false
      return true
    })
    resultado.sort((a, b) => {
      if (sort === 'attention') return (prioridad[getSegmento(b)] * (1 + b.totalGastado / 20000)) - (prioridad[getSegmento(a)] * (1 + a.totalGastado / 20000))
      if (sort === 'recent') return new Date(b.ultimoPedidoAt ?? 0).getTime() - new Date(a.ultimoPedidoAt ?? 0).getTime()
      if (sort === 'orders') return b.cantidadPedidos - a.cantidadPedidos
      if (sort === 'spend') return b.totalGastado - a.totalGastado
      return a.nombre.localeCompare(b.nombre)
    })
    return resultado
  }, [clientes, query, segmento, pedidosEnPeriodo, from, to, sucursalId, campanaSeleccionada, cuponSeleccionado, sort])

  useEffect(() => {
    if (clienteSeleccionado != null && !filtrados.some((cliente) => cliente.id === clienteSeleccionado)) setClienteSeleccionado(null)
  }, [filtrados, clienteSeleccionado])

  const cliente = clientes.find((item) => item.id === clienteSeleccionado) ?? null
  const filtroActivo = campanaSeleccionada === 'organico'
    ? 'Orgánico · sin campaña'
    : typeof campanaSeleccionada === 'number'
      ? campanas.find((item) => item.id === campanaSeleccionada)?.nombre
      : cuponSeleccionado != null ? cupones.find((item) => item.id === cuponSeleccionado)?.codigo : null

  const seleccionarCampana = (id: FiltroCampana) => { setCampanaSeleccionada(id); if (id != null) setCuponSeleccionado(null) }
  const seleccionarCupon = (id: number | null) => { setCuponSeleccionado(id); if (id != null) setCampanaSeleccionada(null) }
  const cambiarMobileView = (view: MobileView) => {
    setMobileView(view)
    requestAnimationFrame(() => mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' }))
  }
  const seleccionarCliente = (id: number) => { setClienteSeleccionado(id); cambiarMobileView('detalle') }
  const cambiarAssetTab = (tab: AssetTab) => { setAssetTab(tab); if (tab === 'campanas') setCuponSeleccionado(null); else setCampanaSeleccionada(null) }
  const limpiarFiltros = () => { setSegmento('todos'); setSucursalId(undefined); setFrom(undefined); setTo(undefined); setCampanaSeleccionada(null); setCuponSeleccionado(null) }

  const eliminarPedido = async (pedidoId: number) => {
    if (!token || !cliente || !window.confirm(`¿Eliminar el pedido #${pedidoId} del historial de ${cliente.nombre}?`)) return
    try { await clientesApi.eliminarPedido(token, cliente.id, pedidoId); await cargar(); toast.success('Pedido eliminado.') }
    catch { toast.error('No se pudo eliminar el pedido.') }
  }
  const eliminarCliente = async () => {
    if (!token || !cliente || !window.confirm(`¿Eliminar a ${cliente.nombre} y todo su historial? Esta acción no se puede deshacer.`)) return
    try { await clientesApi.eliminar(token, cliente.id); setClienteSeleccionado(null); await cargar(); toast.success('Cliente eliminado.') }
    catch { toast.error('No se pudo eliminar el cliente.') }
  }

  return <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#FFFBF0] dark:bg-background">
    <header className="shrink-0 px-4 pb-3 pt-5 sm:px-6">
      <div className="mx-auto max-w-[1680px]">
        <div className="relative mb-4 text-center"><h1 className="text-2xl font-semibold tracking-tight">Crecimiento</h1><p className="mt-0.5 text-sm text-muted-foreground">Clientes, campañas y cupones en una sola vista.</p><p className="absolute bottom-0 right-0 hidden text-xs text-muted-foreground sm:block">{filtrados.length} de {clientes.length} clientes</p></div>
        <div className="relative"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 rounded-xl bg-background pl-11 text-sm shadow-sm" placeholder="Buscar clientes, teléfonos, campañas o cupones…" /></div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7"><FilterPill active={segmento === 'todos'} onClick={() => setSegmento('todos')} label="Todos" count={clientes.length} />{SEGMENTOS.map((item) => <FilterPill key={item.value} active={segmento === item.value} onClick={() => setSegmento(segmento === item.value ? 'todos' : item.value)} label={item.label} count={conteoSegmentos[item.value]} dot={item.dot} />)}</div>
        {sucursales.length > 1 && <div className="mt-2 flex flex-wrap gap-2"><FilterPill active={!sucursalId} onClick={() => setSucursalId(undefined)} label="Todas las sucursales" />{sucursales.map((sucursal) => <FilterPill key={sucursal.id} active={sucursalId === sucursal.id} onClick={() => setSucursalId(sucursalId === sucursal.id ? undefined : sucursal.id)} label={sucursal.nombre} icon={<Store className="h-3 w-3" />} />)}</div>}
        <div className="mt-3 flex flex-wrap items-end gap-2"><div><label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Desde</label><Input type="date" value={from ?? ''} onChange={(event) => setFrom(event.target.value || undefined)} className="h-9 w-[150px] bg-background text-xs" /></div><div><label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Hasta</label><Input type="date" value={to ?? ''} onChange={(event) => setTo(event.target.value || undefined)} className="h-9 w-[150px] bg-background text-xs" /></div>{filtroActivo && <Badge variant="outline" className="h-9 max-w-[280px] gap-1.5 rounded-lg bg-background px-3"><span className="truncate">Filtrando por {filtroActivo}</span><button onClick={() => { setCampanaSeleccionada(null); setCuponSeleccionado(null) }} aria-label="Quitar filtro"><X className="h-3.5 w-3.5" /></button></Badge>}{(segmento !== 'todos' || sucursalId || from || to || filtroActivo) && <Button variant="ghost" size="sm" onClick={limpiarFiltros}>Limpiar filtros</Button>}</div>
        <nav className="mt-3 grid grid-cols-3 rounded-xl bg-muted/60 p-1 xl:hidden" aria-label="Secciones de crecimiento">
          <MobileTab active={mobileView === 'clientes'} onClick={() => cambiarMobileView('clientes')}>Clientes</MobileTab>
          <MobileTab active={mobileView === 'detalle'} onClick={() => cambiarMobileView('detalle')}>Detalle{cliente ? <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-[#FF7A00]" /> : null}</MobileTab>
          <MobileTab active={mobileView === 'activos'} onClick={() => cambiarMobileView('activos')}>Campañas</MobileTab>
        </nav>
      </div>
    </header>

    <main ref={mainRef} className="min-h-0 flex-1 overflow-auto px-4 pb-4 sm:px-6 xl:overflow-hidden">
      <div className="mx-auto grid min-h-full max-w-[1680px] gap-4 xl:h-full xl:grid-cols-[minmax(260px,0.85fr)_minmax(430px,1.45fr)_minmax(310px,1fr)]">
        <section className={`${mobileView === 'clientes' ? 'flex' : 'hidden'} min-h-[520px] flex-col overflow-hidden xl:flex xl:min-h-0`}>
          <div className="flex items-center justify-between gap-2 p-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Clientes</p><p className="text-[11px] text-muted-foreground">{filtrados.length} resultados</p></div><Select value={sort} onValueChange={(value) => setSort(value as SortKey)}><SelectTrigger className="h-8 w-[165px] text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="attention">Necesitan atención</SelectItem><SelectItem value="recent">Más recientes</SelectItem><SelectItem value="orders">Más pedidos</SelectItem><SelectItem value="spend">Mayor gasto</SelectItem><SelectItem value="alphabetical">A → Z</SelectItem></SelectContent></Select></div>
          <ScrollArea className="min-h-0 flex-1">{loading ? <div className="space-y-2 p-3">{Array.from({ length: 7 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-xl" />)}</div> : filtrados.length === 0 ? <EmptyClients /> : <div className="space-y-1.5 p-2">{filtrados.map((item) => <ClientRow key={item.id} cliente={item} selected={item.id === clienteSeleccionado} onClick={() => seleccionarCliente(item.id)} />)}</div>}</ScrollArea>
        </section>

        <section className={`${mobileView === 'detalle' ? 'flex' : 'hidden'} min-h-[640px] flex-col overflow-hidden xl:flex xl:min-h-0`}>
          {cliente ? <ClienteDetalle cliente={cliente} sucursales={sucursales} onDeepLink={() => setDeepLinkOpen(true)} onDeleteClient={() => void eliminarCliente()} onDeleteOrder={(pedidoId) => void eliminarPedido(pedidoId)} /> : <div className="flex flex-1 flex-col items-center justify-center p-8 text-center"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted"><User className="h-6 w-6 text-muted-foreground" /></div><h2 className="mt-4 font-semibold">Seleccioná un cliente</h2><p className="mt-1 max-w-xs text-sm text-muted-foreground">Vas a ver su ciclo de vida, pedidos, campañas, cupones y la receta recomendada.</p></div>}
        </section>

        {token && <div className={`${mobileView === 'activos' ? 'block' : 'hidden'} min-h-0 xl:block`}><GrowthAssetsPanel token={token} username={username} tab={assetTab} onTabChange={cambiarAssetTab} campanas={campanas} cupones={cupones} productos={productos} query={query} filtros={{ from, to, sucursalId }} campanaSeleccionada={campanaSeleccionada} cuponSeleccionado={cuponSeleccionado} onSelectCampana={seleccionarCampana} onSelectCupon={seleccionarCupon} onSelectClient={seleccionarCliente} onReload={cargar} crecimientoActivo={crecimientoActivo} cuponesActivos={cuponesActivos} /></div>}
      </div>
    </main>

    {token && <DeepLinkDialog open={deepLinkOpen} onOpenChange={setDeepLinkOpen} token={token} cliente={cliente} onPrepared={cargar} />}
  </div>
}

function MobileTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`flex h-9 min-w-0 items-center justify-center rounded-lg px-2 text-xs font-semibold transition-colors ${active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{children}</button>
}

function FilterPill({ active, onClick, label, count, dot, icon }: { active: boolean; onClick: () => void; label: string; count?: number; dot?: string; icon?: React.ReactNode }) {
  return <button onClick={onClick} className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors ${active ? 'border-foreground bg-foreground text-background' : 'border-border bg-background text-muted-foreground hover:text-foreground'}`}>{dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}{icon}{label}{count != null && <span className={active ? 'text-background/65' : 'text-muted-foreground/70'}>{count}</span>}</button>
}

function ClientRow({ cliente, selected, onClick }: { cliente: ClienteGrowth; selected: boolean; onClick: () => void }) {
  const segmento = SEGMENTOS.find((item) => item.value === getSegmento(cliente))!
  return <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl border-0 p-3 text-left transition-colors ${selected ? 'border-l-[3px] border-l-[#FF7A00] bg-muted/40' : 'bg-white hover:bg-muted/40 dark:bg-muted/20'}`}><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">{iniciales(cliente.nombre)}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-semibold">{cliente.nombre}</p>{cliente.esVip && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" />}</div><div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground"><span className={`h-1.5 w-1.5 rounded-full ${segmento.dot}`} /><span>{segmento.label}</span><span>·</span><span>{cliente.cantidadPedidos} pedidos</span></div><p className="mt-1 truncate text-[11px] text-muted-foreground">{cliente.ultimoPedidoAt ? `Último ${formatDate(cliente.ultimoPedidoAt)}` : 'Sin pedidos'} · {formatCurrency(cliente.totalGastado)}</p></div><ChevronRight className={`h-4 w-4 shrink-0 ${selected ? 'text-[#FF7A00]' : 'text-muted-foreground/40'}`} /></button>
}

function EmptyClients() { return <div className="flex flex-col items-center justify-center px-6 py-20 text-center"><Users className="h-8 w-8 text-muted-foreground/30" /><p className="mt-3 text-sm font-medium">No hay clientes con estos filtros</p><p className="mt-1 text-xs text-muted-foreground">Probá ampliar las fechas o quitar una campaña o cupón.</p></div> }

function ClienteDetalle({ cliente, sucursales, onDeepLink, onDeleteClient, onDeleteOrder }: { cliente: ClienteGrowth; sucursales: SucursalGrowth[]; onDeepLink: () => void; onDeleteClient: () => void; onDeleteOrder: (pedidoId: number) => void }) {
  const segmento = SEGMENTOS.find((item) => item.value === getSegmento(cliente))!
  const sucursalPorId = new Map(sucursales.map((item) => [item.id, item.nombre]))
  const fuente = cliente.fuenteAdquisicion === 'organico' ? 'Orgánico · sin campaña' : cliente.campanaAdquisicion?.nombre ?? (cliente.fuenteAdquisicion === 'receta' ? 'Receta personalizada' : 'Sin atribución disponible')
  return <><div className="flex items-start justify-between gap-3 p-4"><div className="flex min-w-0 items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold">{iniciales(cliente.nombre)}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-semibold">{cliente.nombre}</h2><Badge variant="outline" className="gap-1"><span className={`h-1.5 w-1.5 rounded-full ${segmento.dot}`} />{segmento.label}</Badge>{cliente.esVip && <Badge className="bg-amber-500 text-white hover:bg-amber-500"><Crown className="mr-1 h-3 w-3" />VIP</Badge>}</div><p className="mt-0.5 text-xs text-muted-foreground">Cliente desde {formatDate(cliente.primerPedidoAt ?? cliente.createdAt)}</p></div></div><Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={onDeleteClient} aria-label="Eliminar cliente"><Trash2 className="h-4 w-4" /></Button></div>
    <ScrollArea className="min-h-0 flex-1"><div className="space-y-4 p-4">
      <div className="rounded-xl bg-muted/45 p-4"><div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background"><TrendingUp className="h-4 w-4" /></div><div><div className="flex items-center gap-2"><p className="text-sm font-semibold">{segmento.label}</p>{cliente.esVip && getSegmento(cliente) !== 'vip' && <Badge variant="secondary">VIP {segmento.label.toLowerCase()}</Badge>}</div><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{segmento.description} {cliente.resumenCadencia ?? ''}</p></div></div></div>

      <div className="rounded-xl bg-emerald-50/70 p-4 dark:bg-emerald-950/20"><div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"><WandSparkles className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">Deep link personalizado</p><Badge className="bg-emerald-600 hover:bg-emerald-600">{recetaNombre(cliente.recetaRecomendada?.codigo)}</Badge></div><p className="mt-1 text-xs text-muted-foreground">Piru recomienda una receta según este segmento. Podés elegir esa o cualquiera de las otras cinco.</p><Button size="sm" className="mt-3" onClick={onDeepLink}><Sparkles className="mr-2 h-3.5 w-3.5" />Elegir receta y crear link</Button></div></div></div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><MiniMetric icon={<ShoppingBag className="h-4 w-4" />} label="Pedidos" value={cliente.cantidadPedidos} /><MiniMetric icon={<DollarSign className="h-4 w-4" />} label="Total gastado" value={formatCurrency(cliente.totalGastado)} /><MiniMetric icon={<CircleDollarSign className="h-4 w-4" />} label="Ticket" value={formatCurrency(cliente.ticketPromedio ?? (cliente.cantidadPedidos ? cliente.totalGastado / cliente.cantidadPedidos : 0))} /><MiniMetric icon={<Timer className="h-4 w-4" />} label="Cadencia" value={cliente.cadenciaDias != null ? `~${cliente.cadenciaDias} días` : 'Sin ritmo'} /></div>

      <Card title="Adquisición y actividad" icon={<Globe2 className="h-4 w-4" />}><InfoRow label="Primera fuente" value={fuente} /><InfoRow label="Primera compra" value={cliente.primeraCompra ? `${formatDate(cliente.primeraCompra.fecha)} · ${formatCurrency(cliente.primeraCompra.revenue)}` : 'Sin datos'} /><InfoRow label="Revenue de recetas" value={formatCurrency(cliente.revenueAcciones ?? 0)} /></Card>

      <div className="grid gap-3 sm:grid-cols-2"><Card title="Campañas" icon={<ReceiptText className="h-4 w-4" />}>{(cliente.campanasParticipadas ?? []).length ? <div className="space-y-2">{cliente.campanasParticipadas!.map((campana) => <div key={campana.id} className="rounded-lg bg-muted/50 p-2.5"><p className="text-xs font-medium">{campana.nombre}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{campana.pedidos} pedidos · {formatCurrency(campana.revenueAtribuido)}</p></div>)}</div> : <EmptyText>Sin campañas atribuidas.</EmptyText>}</Card><Card title="Cupones usados" icon={<Tag className="h-4 w-4" />}>{(cliente.cuponesUsados ?? []).length ? <div className="space-y-2">{cliente.cuponesUsados!.map((cupon) => <div key={cupon.id} className="rounded-lg bg-muted/50 p-2.5"><p className="text-xs font-medium">{cupon.codigo}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{cupon.usos} usos · {formatCurrency(cupon.montoDescontado)} descontados</p></div>)}</div> : <EmptyText>No usó cupones.</EmptyText>}</Card></div>

      {cliente.productosTop && cliente.productosTop.length > 0 && <Card title="Lo que más pide" icon={<Gift className="h-4 w-4" />}><div className="flex flex-wrap gap-2">{cliente.productosTop.map((producto) => <Badge key={producto.nombre} variant="secondary">{producto.cantidad}× {producto.nombre}</Badge>)}</div></Card>}

      <Card title="Contacto" icon={<Phone className="h-4 w-4" />}><InfoRow label="Teléfono" value={cliente.telefono} /><InfoRow label="Dirección" value={cliente.direccion ?? 'Retira en local'} /><InfoRow label="Último pedido" value={formatDate(cliente.ultimoPedidoAt)} /></Card>

      <Card title="Historial de pedidos" icon={<Package className="h-4 w-4" />}><div className="space-y-2">{cliente.pedidos.map((pedido) => <PedidoRow key={pedido.id} pedido={pedido} sucursal={pedido.sucursalId ? sucursalPorId.get(pedido.sucursalId) : undefined} onDelete={() => onDeleteOrder(pedido.id)} />)}</div></Card>
    </div></ScrollArea></>
}

function MiniMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) { return <div className="rounded-xl bg-muted/45 p-3"><div className="text-muted-foreground">{icon}</div><p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-0.5 text-sm font-semibold">{value}</p></div> }
function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) { return <section className="p-1"><div className="mb-3 flex items-center gap-2 text-muted-foreground">{icon}<h3 className="text-xs font-semibold uppercase tracking-wide">{title}</h3></div>{children}</section> }
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) { return <div className="flex items-start justify-between gap-4 py-2 text-xs"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{value}</span></div> }
function EmptyText({ children }: { children: React.ReactNode }) { return <p className="py-2 text-xs text-muted-foreground">{children}</p> }

function PedidoRow({ pedido, sucursal, onDelete }: { pedido: PedidoCliente; sucursal?: string; onDelete: () => void }) {
  return <div className="rounded-xl bg-white p-3 transition-colors hover:bg-muted/40 dark:bg-muted/20"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-1.5"><p className="text-xs font-semibold">Pedido #{pedido.id}</p>{pedido.esOrganico && <Badge variant="outline" className="h-5 text-[9px]">Orgánico</Badge>}{pedido.campanaId && <Badge variant="outline" className="h-5 text-[9px]">Campaña</Badge>}{pedido.codigoDescuentoId && <Badge variant="outline" className="h-5 text-[9px]">Cupón</Badge>}</div><p className="mt-1 text-[11px] text-muted-foreground">{formatDate(pedido.createdAt)} · {pedido.tipo}{sucursal ? ` · ${sucursal}` : ''}</p></div><div className="flex items-center gap-2"><span className="text-xs font-semibold">{formatCurrency(pedido.total)}</span><Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button></div></div>{pedido.items.length > 0 && <p className="mt-2 text-[11px] text-muted-foreground">{pedido.items.map((item) => `${item.cantidad}× ${item.nombreProducto}`).join(' · ')}</p>}{Number(pedido.montoDescuento ?? 0) > 0 && <p className="mt-1 text-[11px] text-emerald-700">Descuento aplicado: {formatCurrency(pedido.montoDescuento)}</p>}</div>
}
