import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/store/authStore'
import { useModuloActivo } from '@/store/modulosStore'
import { clientesApi, codigosDescuentoApi, crecimientoApi, productosApi, sucursalesApi, type CampanaCrecimiento } from '@/lib/api'
import { ArrowLeft, ArrowUpDown, ChevronRight, Crown, Package, ReceiptText, Search, SlidersHorizontal, Sparkles, Ticket, Trash2, TrendingUp, User, Users, X, Zap } from 'lucide-react'
import { toast } from 'sonner'
import MicroCampanaModal from './clientes/MicroCampanaModal'
import { HistorialPuntosDialog } from './clientes/HistorialPuntosDialog'
import GrowthAssetsPanel from './clientes/GrowthAssetsPanel'
import {
  type ClienteGrowth,
  type CodigoDescuentoGrowth,
  type FiltroCampana,
  type PedidoCliente,
  type ProductoGrowth,
  SEGMENTOS,
  type SucursalGrowth,
  type SortClienteKey,
  type SortCampanaKey,
  type SortCuponKey,
  type EstadoCampanaFilter,
  type TipoCampanaFilter,
  type EstadoCuponFilter,
  type TipoCuponFilter,
  SORT_CLIENTE_LABELS,
  SORT_CAMPANA_LABELS,
  SORT_CUPON_LABELS,
  formatCurrency,
  formatDate,
  getSegmento,
} from './clientes/types'
import { FiltrosDialog } from './clientes/FiltrosDialog'

type AssetTab = 'campanas' | 'cupones'
type WorkspaceTab = 'clientes' | AssetTab
type SortKey = SortClienteKey
type SegmentFilter = ReturnType<typeof getSegmento> | 'todos'
type MobileView = 'clientes' | 'detalle' | 'pedidos'
type AssetMobileView = 'lista' | 'detalle' | 'clientes'

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
  const [filtrosDialogOpen, setFiltrosDialogOpen] = useState(false)
  const [sortCampana, setSortCampana] = useState<SortCampanaKey>('recent')
  const [estadoCampana, setEstadoCampana] = useState<EstadoCampanaFilter>('todas')
  const [tipoCampana, setTipoCampana] = useState<TipoCampanaFilter>('todos')
  const [sortCupon, setSortCupon] = useState<SortCuponKey>('recent')
  const [estadoCupon, setEstadoCupon] = useState<EstadoCuponFilter>('todos')
  const [tipoCupon, setTipoCupon] = useState<TipoCuponFilter>('todos')
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab | null>(() => {
    const tab = searchParams.get('tab')
    if (tab === 'campanas' || tab === 'crecimiento') return 'campanas'
    if (tab === 'cupones') return 'cupones'
    if (tab === 'clientes') return 'clientes'
    return null
  })
  const [clienteSeleccionado, setClienteSeleccionado] = useState<number | null>(null)
  const [mobileView, setMobileView] = useState<MobileView>('clientes')
  const [mostrarPedidos, setMostrarPedidos] = useState(false)
  const [assetMobileView, setAssetMobileView] = useState<AssetMobileView>('lista')
  const [campanaSeleccionada, setCampanaSeleccionada] = useState<FiltroCampana>(null)
  const [cuponSeleccionado, setCuponSeleccionado] = useState<number | null>(null)
  const [microCampanaOpen, setMicroCampanaOpen] = useState(false)
  const mobileNavRef = useRef<HTMLElement>(null)

  const actualizarPuntosCliente = (clienteId: number, nuevosPuntos: number) => {
    setClientes((prev) =>
      prev.map((c) => (c.id === clienteId ? { ...c, puntos: nuevosPuntos } : c))
    )
  }

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'campanas' || tab === 'crecimiento') {
      setWorkspaceTab((prev) => (prev !== 'campanas' ? 'campanas' : prev))
    } else if (tab === 'cupones') {
      setWorkspaceTab((prev) => (prev !== 'cupones' ? 'cupones' : prev))
    } else if (tab === 'clientes') {
      setWorkspaceTab((prev) => (prev !== 'clientes' ? 'clientes' : prev))
    } else if (!tab) {
      setWorkspaceTab((prev) => (prev !== null ? null : prev))
    }
  }, [searchParams])

  useEffect(() => {
    const siguiente = new URLSearchParams(searchParams)
    if (workspaceTab) {
      siguiente.set('tab', workspaceTab)
    } else {
      siguiente.delete('tab')
    }
    siguiente.delete('vista'); siguiente.delete('seccion')
    if (siguiente.toString() === searchParams.toString()) return
    setSearchParams(siguiente, { replace: true })
  }, [workspaceTab, searchParams, setSearchParams])

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
    requestAnimationFrame(() => mobileNavRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
  }
  const seleccionarCliente = (id: number) => { setClienteSeleccionado(id); cambiarMobileView('detalle') }
  const togglePedidos = () => {
    setMostrarPedidos((prev) => {
      const next = !prev
      if (next && typeof window !== 'undefined' && window.innerWidth < 1280) {
        cambiarMobileView('pedidos')
      }
      return next
    })
  }
  const cerrarPedidos = () => {
    setMostrarPedidos(false)
    if (typeof window !== 'undefined' && window.innerWidth < 1280) {
      cambiarMobileView('detalle')
    }
  }
  const cambiarWorkspaceTab = (tab: WorkspaceTab | null) => { setWorkspaceTab(tab); setMobileView('clientes'); setAssetMobileView('lista'); if (tab === 'campanas') setCuponSeleccionado(null); if (tab === 'cupones') setCampanaSeleccionada(null) }
  const abrirClienteAsociado = (id: number) => { setWorkspaceTab('clientes'); seleccionarCliente(id) }
  const seleccionarCampanaMobile = (id: FiltroCampana) => { seleccionarCampana(id); if (id != null) { setAssetMobileView('detalle'); requestAnimationFrame(() => mobileNavRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })) } }
  const seleccionarCuponMobile = (id: number | null) => { seleccionarCupon(id); if (id != null) { setAssetMobileView('detalle'); requestAnimationFrame(() => mobileNavRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })) } }
  const limpiarFiltros = () => {
    if (workspaceTab === 'clientes') {
      setSegmento('todos')
      setSort('attention')
      setSucursalId(undefined)
      setFrom(undefined)
      setTo(undefined)
      setCampanaSeleccionada(null)
      setCuponSeleccionado(null)
    } else if (workspaceTab === 'campanas') {
      setSortCampana('recent')
      setEstadoCampana('todas')
      setTipoCampana('todos')
      setSucursalId(undefined)
      setFrom(undefined)
      setTo(undefined)
    } else if (workspaceTab === 'cupones') {
      setSortCupon('recent')
      setEstadoCupon('todos')
      setTipoCupon('todos')
      setSucursalId(undefined)
      setFrom(undefined)
      setTo(undefined)
    }
  }

  const filtrosActivosClientesCount = useMemo(() => {
    let count = 0
    if (sucursalId != null) count++
    if (from || to) count++
    if (campanaSeleccionada != null || cuponSeleccionado != null) count++
    if (sort !== 'attention') count++
    return count
  }, [sucursalId, from, to, campanaSeleccionada, cuponSeleccionado, sort])

  const filtrosActivosCampanasCount = useMemo(() => {
    let count = 0
    if (estadoCampana !== 'todas') count++
    if (tipoCampana !== 'todos') count++
    if (sucursalId != null) count++
    if (from || to) count++
    if (sortCampana !== 'recent') count++
    return count
  }, [estadoCampana, tipoCampana, sucursalId, from, to, sortCampana])

  const filtrosActivosCuponesCount = useMemo(() => {
    let count = 0
    if (estadoCupon !== 'todos') count++
    if (tipoCupon !== 'todos') count++
    if (sucursalId != null) count++
    if (from || to) count++
    if (sortCupon !== 'recent') count++
    return count
  }, [estadoCupon, tipoCupon, sucursalId, from, to, sortCupon])

  const filtrosActivosCount =
    workspaceTab === 'clientes'
      ? filtrosActivosClientesCount
      : workspaceTab === 'campanas'
        ? filtrosActivosCampanasCount
        : filtrosActivosCuponesCount

  const hasActiveFilters = filtrosActivosCount > 0

  const totalResultados = useMemo(() => {
    if (workspaceTab === 'clientes') return filtrados.length
    if (workspaceTab === 'campanas') {
      const q = query.trim().toLowerCase()
      return campanas.filter((item) => {
        if (q && !`${item.nombre} ${item.slug}`.toLowerCase().includes(q)) return false
        if (estadoCampana === 'activa' && item.estado !== 'activa') return false
        if (estadoCampana === 'inactiva' && item.estado === 'activa') return false
        if (tipoCampana !== 'todos' && item.destinoTipo !== tipoCampana) return false
        return true
      }).length
    }
    if (workspaceTab === 'cupones') {
      const q = query.trim().toLowerCase()
      const now = new Date()
      return cupones.filter((item) => {
        if (q && !item.codigo.toLowerCase().includes(q)) return false
        if (tipoCupon !== 'todos' && item.tipo !== tipoCupon) return false
        if (estadoCupon === 'vigentes') {
          if (!item.activo) return false
          if (item.fechaInicio && new Date(item.fechaInicio) > now) return false
          if (item.fechaFin && new Date(item.fechaFin) < now) return false
          if (item.limiteUsos != null && item.usosActuales >= item.limiteUsos) return false
        } else if (estadoCupon === 'inactivos') {
          if (!item.activo) return false
        } else if (estadoCupon === 'agotados') {
          if (item.limiteUsos == null || item.usosActuales < item.limiteUsos) return false
        } else if (estadoCupon === 'expirados') {
          if (!item.fechaFin || new Date(item.fechaFin) >= now) return false
        }
        return true
      }).length
    }
    return 0
  }, [workspaceTab, filtrados.length, campanas, cupones, query, estadoCampana, tipoCampana, estadoCupon, tipoCupon])

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

  if (workspaceTab === null) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto bg-[#FFFBF0] px-4 py-12 dark:bg-background sm:px-6">
        <div className="mx-auto w-full max-w-3xl text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            Clientes
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground sm:text-base">
            Conocé tu base, medí el recorrido de cada promoción y seguí tus cupones.
          </p>

          <div className="mx-auto mt-10 grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => cambiarWorkspaceTab('clientes')}
              className="group flex flex-col items-center justify-between rounded-2xl border border-border/80 bg-white p-6 text-center shadow-sm transition-all hover:-translate-y-1 hover:shadow-md dark:bg-card cursor-pointer"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-foreground transition-colors group-hover:bg-foreground group-hover:text-background">
                <Users className="h-6 w-6" />
              </div>
              <div className="mt-4">
                <h2 className="text-base font-semibold text-foreground">Clientes</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Base de clientes, historial de pedidos, cadencia y diagnóstico de recompras.
                </p>
              </div>
              <span className="mt-4 inline-flex items-center text-xs font-semibold text-muted-foreground group-hover:text-foreground group-hover:underline">
                Ingresar <ChevronRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => cambiarWorkspaceTab('campanas')}
              className="group flex flex-col items-center justify-between rounded-2xl border border-border/80 bg-white p-6 text-center shadow-sm transition-all hover:-translate-y-1 hover:shadow-md dark:bg-card cursor-pointer"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 transition-colors group-hover:bg-emerald-600 group-hover:text-white dark:text-emerald-400">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div className="mt-4">
                <h2 className="text-base font-semibold text-foreground">Crecimiento</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Campañas de adquisición, smart links y atribución de ventas generadas.
                </p>
              </div>
              <span className="mt-4 inline-flex items-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 group-hover:underline">
                Ingresar <ChevronRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => cambiarWorkspaceTab('cupones')}
              className="group flex flex-col items-center justify-between rounded-2xl border border-border/80 bg-white p-6 text-center shadow-sm transition-all hover:-translate-y-1 hover:shadow-md dark:bg-card cursor-pointer"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-600 transition-colors group-hover:bg-purple-600 group-hover:text-white dark:text-purple-400">
                <Ticket className="h-6 w-6" />
              </div>
              <div className="mt-4">
                <h2 className="text-base font-semibold text-foreground">Cupones</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Códigos de descuento para tus clientes, condiciones y límites de uso.
                </p>
              </div>
              <span className="mt-4 inline-flex items-center text-xs font-semibold text-purple-600 dark:text-purple-400 group-hover:underline">
                Ingresar <ChevronRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-[#FFFBF0] dark:bg-background xl:overflow-hidden">
    <header className="shrink-0 px-4 pb-3 pt-5 sm:px-6">
      <div className="mx-auto max-w-[1680px]">
        <div className="relative mb-4 flex flex-col items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => cambiarWorkspaceTab(null)}
            className="self-start text-xs text-muted-foreground hover:text-foreground sm:absolute sm:left-0 sm:top-1/2 sm:-translate-y-1/2"
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            Volver
          </Button>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">Conocé tu base, medí el recorrido de cada promoción y seguí tus cupones.</p>
          </div>
          <WorkspaceTabs value={workspaceTab} onChange={cambiarWorkspaceTab} />
        </div>
        {/* Barra de Búsqueda y Botón de Filtros / Orden con estilo Apple */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-10 rounded-full border-border/40 bg-background/80 pl-10 pr-9 text-sm shadow-2xs backdrop-blur-xs transition-all placeholder:text-muted-foreground/60 focus-visible:ring-1"
              placeholder={
                workspaceTab === 'clientes'
                  ? 'Buscar clientes, teléfonos, campañas o cupones…'
                  : workspaceTab === 'campanas'
                    ? 'Buscar campañas por nombre o slug…'
                    : 'Buscar cupones por código…'
              }
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 transition-colors hover:text-foreground"
                title="Borrar búsqueda"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setFiltrosDialogOpen(true)}
            className={`h-10 gap-2 rounded-full px-4 text-xs font-medium transition-all shadow-2xs ${
              hasActiveFilters
                ? 'border-foreground/20 bg-foreground text-background hover:bg-foreground/90'
                : 'border-border/60 bg-background/80 hover:bg-muted/50'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filtrar y ordenar</span>
            <span className="sm:hidden">Filtros</span>
            {filtrosActivosCount > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                {filtrosActivosCount}
              </span>
            )}
          </Button>
        </div>

        {/* Segmentos de clientes debajo del buscador */}
        {workspaceTab === 'clientes' && (
          <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap">
            <button
              type="button"
              onClick={() => setSegmento('todos')}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                segmento === 'todos'
                  ? 'bg-foreground text-background shadow-2xs'
                  : 'border border-border/50 bg-background/80 text-muted-foreground hover:bg-background hover:text-foreground shadow-2xs backdrop-blur-xs'
              }`}
            >
              <span>Todos</span>
              <span
                className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-semibold tabular-nums ${
                  segmento === 'todos'
                    ? 'bg-background/20 text-background'
                    : 'bg-muted text-foreground'
                }`}
              >
                {clientes.length}
              </span>
            </button>
            {SEGMENTOS.map((item) => {
              const active = segmento === item.value
              const count = conteoSegmentos[item.value] ?? 0
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setSegmento(item.value)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                    active
                      ? 'bg-foreground text-background shadow-2xs'
                      : 'border border-border/50 bg-background/80 text-muted-foreground hover:bg-background hover:text-foreground shadow-2xs backdrop-blur-xs'
                  }`}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${item.dot}`} />
                  <span>{item.label}</span>
                  <span
                    className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-semibold tabular-nums ${
                      active
                        ? 'bg-background/20 text-background'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* Tiras de Filtros Activos (solo si hay filtros aplicados) */}
        {hasActiveFilters && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[11px] font-medium text-muted-foreground/70 mr-1">Filtros aplicados:</span>

            {/* Clientes: Orden no por defecto */}
            {workspaceTab === 'clientes' && sort !== 'attention' && (
              <ActiveFilterBadge
                label={`Orden: ${SORT_CLIENTE_LABELS[sort]}`}
                onRemove={() => setSort('attention')}
              />
            )}

            {/* Clientes: Filtro por campaña o cupón */}
            {workspaceTab === 'clientes' && filtroActivo && (
              <ActiveFilterBadge
                label={`Vinculado a: ${filtroActivo}`}
                onRemove={() => { setCampanaSeleccionada(null); setCuponSeleccionado(null) }}
              />
            )}

            {/* Campañas: Estado */}
            {workspaceTab === 'campanas' && estadoCampana !== 'todas' && (
              <ActiveFilterBadge
                label={`Estado: ${estadoCampana === 'activa' ? 'Solo activas' : 'Pausadas / Inactivas'}`}
                onRemove={() => setEstadoCampana('todas')}
              />
            )}

            {/* Campañas: Modalidad */}
            {workspaceTab === 'campanas' && tipoCampana !== 'todos' && (
              <ActiveFilterBadge
                label={`Modalidad: ${
                  tipoCampana === 'producto' ? 'Producto' : tipoCampana === 'carrito' ? 'Carrito' : 'Link'
                }`}
                onRemove={() => setTipoCampana('todos')}
              />
            )}

            {/* Campañas: Orden */}
            {workspaceTab === 'campanas' && sortCampana !== 'recent' && (
              <ActiveFilterBadge
                label={`Orden: ${SORT_CAMPANA_LABELS[sortCampana]}`}
                onRemove={() => setSortCampana('recent')}
              />
            )}

            {/* Cupones: Estado */}
            {workspaceTab === 'cupones' && estadoCupon !== 'todos' && (
              <ActiveFilterBadge
                label={`Estado: ${
                  estadoCupon === 'vigentes'
                    ? 'Vigentes'
                    : estadoCupon === 'inactivos'
                      ? 'Inactivos'
                      : estadoCupon === 'agotados'
                        ? 'Agotados'
                        : 'Vencidos'
                }`}
                onRemove={() => setEstadoCupon('todos')}
              />
            )}

            {/* Cupones: Tipo */}
            {workspaceTab === 'cupones' && tipoCupon !== 'todos' && (
              <ActiveFilterBadge
                label={`Tipo: ${tipoCupon === 'porcentaje' ? '% OFF' : '$ OFF'}`}
                onRemove={() => setTipoCupon('todos')}
              />
            )}

            {/* Cupones: Orden */}
            {workspaceTab === 'cupones' && sortCupon !== 'recent' && (
              <ActiveFilterBadge
                label={`Orden: ${SORT_CUPON_LABELS[sortCupon]}`}
                onRemove={() => setSortCupon('recent')}
              />
            )}

            {/* Sucursal */}
            {sucursalId != null && (
              <ActiveFilterBadge
                label={`Sucursal: ${sucursales.find((s) => s.id === sucursalId)?.nombre ?? sucursalId}`}
                onRemove={() => setSucursalId(undefined)}
              />
            )}

            {/* Rango de Fechas */}
            {(from || to) && (
              <ActiveFilterBadge
                label={`Período: ${from ? formatDate(from) : 'Inicio'} — ${to ? formatDate(to) : 'Hoy'}`}
                onRemove={() => { setFrom(undefined); setTo(undefined) }}
              />
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={limpiarFiltros}
              className="h-6 rounded-full px-2 text-[11px] text-muted-foreground hover:text-foreground"
            >
              Restablecer todo
            </Button>
          </div>
        )}
      </div>
    </header>

    <nav ref={mobileNavRef} className="sticky top-0 z-20 shrink-0 border-y bg-[#FFFBF0]/95 px-4 py-2 backdrop-blur dark:bg-background/95 sm:px-6 xl:hidden" aria-label={workspaceTab === 'clientes' ? 'Columnas de clientes' : `Columnas de ${workspaceTab}`}>
      <div className="mx-auto grid max-w-[1680px] grid-cols-3 rounded-xl bg-muted/60 p-1">
        {workspaceTab === 'clientes' ? <>
          <MobileTab active={mobileView === 'clientes'} onClick={() => cambiarMobileView('clientes')}>Clientes</MobileTab>
          <MobileTab active={mobileView === 'detalle'} onClick={() => cambiarMobileView('detalle')}>Detalle{cliente ? <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-[#FF7A00]" /> : null}</MobileTab>
          <MobileTab active={mobileView === 'pedidos'} onClick={() => cambiarMobileView('pedidos')}>Pedidos</MobileTab>
        </> : <>
          <MobileTab active={assetMobileView === 'lista'} onClick={() => setAssetMobileView('lista')}>{workspaceTab === 'campanas' ? 'Campañas' : 'Cupones'}</MobileTab>
          <MobileTab active={assetMobileView === 'detalle'} onClick={() => setAssetMobileView('detalle')}>Resultados</MobileTab>
          <MobileTab active={assetMobileView === 'clientes'} onClick={() => setAssetMobileView('clientes')}>Clientes</MobileTab>
        </>}
      </div>
    </nav>

    <main className="flex-none overflow-visible px-4 pb-4 sm:px-6 xl:min-h-0 xl:flex-1 xl:overflow-hidden">
      {workspaceTab === 'clientes' ? (
        <div
          className={`mx-auto grid min-h-full max-w-[1680px] gap-4 xl:h-full transition-all ${
            mostrarPedidos
              ? 'xl:grid-cols-[minmax(260px,0.85fr)_minmax(430px,1.45fr)_minmax(310px,1fr)]'
              : 'xl:grid-cols-[minmax(280px,360px)_1fr]'
          }`}
        >
          <section className={`${mobileView === 'clientes' ? 'flex' : 'hidden'} min-h-[520px] flex-col overflow-hidden xl:flex xl:min-h-0`}>
            <div className="flex items-center justify-between gap-2 p-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Clientes</p>
                <p className="text-[11px] text-muted-foreground">{filtrados.length} resultados</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFiltrosDialogOpen(true)}
                className="h-8 gap-1.5 rounded-full border border-border/40 px-3 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                title="Filtrar y ordenar"
              >
                <ArrowUpDown className="h-3 w-3" />
                <span>{SORT_CLIENTE_LABELS[sort]}</span>
              </Button>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              {loading ? (
                <div className="space-y-2 p-3">
                  {Array.from({ length: 7 }).map((_, index) => (
                    <Skeleton key={index} className="h-20 rounded-xl" />
                  ))}
                </div>
              ) : filtrados.length === 0 ? (
                <EmptyClients />
              ) : (
                <div className="space-y-1.5 p-2">
                  {filtrados.map((item) => (
                    <ClientRow
                      key={item.id}
                      cliente={item}
                      selected={item.id === clienteSeleccionado}
                      onClick={() => seleccionarCliente(item.id)}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </section>

          <section className={`${mobileView === 'detalle' ? 'flex' : 'hidden'} min-h-[640px] flex-col overflow-hidden xl:flex xl:min-h-0`}>
            {cliente ? (
              <ClienteDetalle
                cliente={cliente}
                token={token ?? undefined}
                mostrarPedidos={mostrarPedidos}
                onTogglePedidos={togglePedidos}
                onMicroCampana={() => setMicroCampanaOpen(true)}
                onDeleteClient={() => void eliminarCliente()}
                onPuntosActualizados={(nuevos) => actualizarPuntosCliente(cliente.id, nuevos)}
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
                  <User className="h-5 w-5" />
                </div>
                <h2 className="mt-3.5 text-sm font-semibold tracking-tight text-foreground">Seleccioná un cliente</h2>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  Vas a ver su ciclo de vida, campañas, cupones y la micro-campaña sugerida.
                </p>
              </div>
            )}
          </section>

          <section
            className={`${
              mobileView === 'pedidos' ? 'flex' : 'hidden'
            } min-h-[620px] flex-col overflow-hidden ${
              mostrarPedidos ? 'xl:flex' : 'xl:hidden'
            } xl:min-h-0`}
          >
            <PedidosClientePanel
              cliente={cliente}
              sucursales={sucursales}
              onClose={cerrarPedidos}
              onDeleteOrder={(pedidoId) => void eliminarPedido(pedidoId)}
            />
          </section>
        </div>
      ) : token ? (
        <div className="mx-auto min-h-full max-w-[1680px] xl:h-full">
          <GrowthAssetsPanel
            token={token}
            username={username}
            tab={workspaceTab}
            campanas={campanas}
            cupones={cupones}
            clientes={clientes}
            sucursales={sucursales}
            productos={productos}
            query={query}
            filtros={{ from, to, sucursalId }}
            campanaSeleccionada={campanaSeleccionada}
            cuponSeleccionado={cuponSeleccionado}
            onSelectCampana={seleccionarCampanaMobile}
            onSelectCupon={seleccionarCuponMobile}
            onSelectClient={abrirClienteAsociado}
            onReload={cargar}
            crecimientoActivo={crecimientoActivo}
            cuponesActivos={cuponesActivos}
            sortCampana={sortCampana}
            estadoCampana={estadoCampana}
            tipoCampana={tipoCampana}
            sortCupon={sortCupon}
            estadoCupon={estadoCupon}
            tipoCupon={tipoCupon}
            onOpenFiltros={() => setFiltrosDialogOpen(true)}
            mobileView={assetMobileView}
            onMobileViewChange={setAssetMobileView}
          />
        </div>
      ) : null}
    </main>

    {token && (
      <MicroCampanaModal
        open={microCampanaOpen}
        onOpenChange={setMicroCampanaOpen}
        token={token}
        cliente={cliente}
        username={username ?? undefined}
        onPrepared={cargar}
      />
    )}

    {workspaceTab && (
      <FiltrosDialog
        open={filtrosDialogOpen}
        onOpenChange={setFiltrosDialogOpen}
        tab={workspaceTab}
        totalResultados={totalResultados}
        sortCliente={sort}
        onSortClienteChange={setSort}
        sortCampana={sortCampana}
        onSortCampanaChange={setSortCampana}
        estadoCampana={estadoCampana}
        onEstadoCampanaChange={setEstadoCampana}
        tipoCampana={tipoCampana}
        onTipoCampanaChange={setTipoCampana}
        sortCupon={sortCupon}
        onSortCuponChange={setSortCupon}
        estadoCupon={estadoCupon}
        onEstadoCuponChange={setEstadoCupon}
        tipoCupon={tipoCupon}
        onTipoCuponChange={setTipoCupon}
        sucursales={sucursales}
        sucursalId={sucursalId}
        onSucursalChange={setSucursalId}
        from={from}
        to={to}
        onDateRangeChange={(f, t) => { setFrom(f); setTo(t) }}
        onReset={limpiarFiltros}
        hasActiveFilters={hasActiveFilters}
      />
    )}
  </div>
}

function ActiveFilterBadge({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/80 py-0.5 pl-2.5 pr-1.5 text-[11px] font-medium text-foreground backdrop-blur-xs">
      <span>{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
        aria-label={`Quitar filtro ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

function MobileTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`flex h-9 min-w-0 items-center justify-center rounded-lg px-2 text-xs font-semibold transition-colors ${active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{children}</button>
}

function WorkspaceTabs({ value, onChange }: { value: WorkspaceTab; onChange: (value: WorkspaceTab) => void }) {
  const tabs: Array<{ value: WorkspaceTab; label: string; icon: React.ReactNode }> = [
    { value: 'clientes', label: 'Clientes', icon: <Users className="h-4 w-4" /> },
    { value: 'campanas', label: 'Crecimiento', icon: <TrendingUp className="h-4 w-4" /> },
    { value: 'cupones', label: 'Cupones', icon: <Ticket className="h-4 w-4" /> },
  ]
  return <nav className="flex items-center gap-2" aria-label="Secciones de clientes">{tabs.map((tab) => <button key={tab.value} type="button" onClick={() => onChange(tab.value)} className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors ${value === tab.value ? 'bg-foreground text-background shadow-sm' : 'bg-muted/70 text-muted-foreground hover:text-foreground'}`}>{tab.icon}{tab.label}</button>)}</nav>
}


function ClientRow({ cliente, selected, onClick }: { cliente: ClienteGrowth; selected: boolean; onClick: () => void }) {
  const segmento = SEGMENTOS.find((item) => item.value === getSegmento(cliente))!
  return <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl border-0 p-3 text-left transition-colors ${selected ? 'border-l-[3px] border-l-[#FF7A00] bg-muted/40' : 'bg-white hover:bg-muted/40 dark:bg-muted/20'}`}><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">{iniciales(cliente.nombre)}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-semibold">{cliente.nombre}</p>{cliente.esVip && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" />}</div><div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground"><span className={`h-1.5 w-1.5 rounded-full ${segmento.dot}`} /><span>{segmento.label}</span><span>·</span><span>{cliente.cantidadPedidos} pedidos</span>{(cliente.puntos ?? 0) > 0 && (<><span>·</span><span className="font-semibold text-amber-600 dark:text-amber-400">{cliente.puntos} pts</span></>)}</div><p className="mt-1 truncate text-[11px] text-muted-foreground">{cliente.ultimoPedidoAt ? `Último ${formatDate(cliente.ultimoPedidoAt)}` : 'Sin pedidos'} · {formatCurrency(cliente.totalGastado)}</p></div><ChevronRight className={`h-4 w-4 shrink-0 ${selected ? 'text-[#FF7A00]' : 'text-muted-foreground/40'}`} /></button>
}
function EmptyClients() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <Users className="h-8 w-8 text-muted-foreground/30" />
      <p className="mt-3 text-sm font-medium">No hay clientes con estos filtros</p>
      <p className="mt-1 text-xs text-muted-foreground">Probá ampliar las fechas o quitar una campaña o cupón.</p>
    </div>
  )
}

function getMicroCampanaInfo(cliente: ClienteGrowth) {
  const seg = cliente.segmento ?? 'nuevo'
  if (seg === 'nuevo') {
    return {
      badge: '¿Lo mismo de siempre? (Primer Pedido)',
      descripcion: 'Prepara un enlace con su primer pedido cargado en el drawer para repetir en 1 toque.',
    }
  }
  if (seg === 'en_riesgo') {
    return {
      badge: '¿Lo mismo de siempre? (En Riesgo)',
      descripcion: 'Prepara su pedido habitual para rescatar su ritmo de compra antes de que se enfríe.',
    }
  }
  if (seg === 'dormido') {
    return {
      badge: 'Reactivación (10% OFF)',
      descripcion: 'Ofrecele un 10% de descuento automático en su pedido para reactivar el hábito.',
    }
  }
  if (seg === 'perdido') {
    return {
      badge: 'Reactivación urgente (20% OFF · 48hs)',
      descripcion: 'Una propuesta fuerte con 20% OFF por 48 horas como última oportunidad para recuperarlo.',
    }
  }
  return {
    badge: '¿Lo mismo de siempre? (Habitual)',
    descripcion: 'Facilitale su compra recurrente con un link directo a su pedido de siempre en 1 click.',
  }
}

function ClienteDetalle({
  cliente,
  token,
  mostrarPedidos = false,
  onTogglePedidos,
  onMicroCampana,
  onDeleteClient,
  onPuntosActualizados,
}: {
  cliente: ClienteGrowth
  token?: string
  mostrarPedidos?: boolean
  onTogglePedidos?: () => void
  onMicroCampana: () => void
  onDeleteClient: () => void
  onPuntosActualizados?: (nuevos: number) => void
}) {
  const [puntosDialogOpen, setPuntosDialogOpen] = useState(false)
  const segmento = SEGMENTOS.find((item) => item.value === getSegmento(cliente))!
  const fuente =
    cliente.fuenteAdquisicion === 'organico'
      ? 'Orgánico · sin campaña'
      : cliente.campanaAdquisicion?.nombre ?? (cliente.fuenteAdquisicion === 'receta' ? 'Receta personalizada' : 'Sin atribución disponible')

  // VISTA COMPACTA: cuando la columna de pedidos está abierta
  if (mostrarPedidos) {
    return (
      <>
        <div className="flex items-start justify-between gap-3 p-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted/80 text-sm font-semibold tracking-tight text-foreground">
              {iniciales(cliente.nombre)}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  {cliente.nombre}
                </h2>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background/80 px-2.5 py-0.5 text-xs font-medium text-foreground backdrop-blur-xs">
                  <span className={`h-1.5 w-1.5 rounded-full ${segmento.dot}`} />
                  {segmento.label}
                </span>
                {cliente.esVip && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                    <Crown className="h-3 w-3" />
                    VIP
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground/80">
                Cliente desde {formatDate(cliente.primerPedidoAt ?? cliente.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={onTogglePedidos}
              className="h-8 gap-1.5 rounded-full px-3 text-xs font-medium"
              title="Ocultar historial de pedidos"
            >
              <ReceiptText className="h-3.5 w-3.5" />
              <span>Ocultar pedidos</span>
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-full text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
              onClick={onDeleteClient}
              aria-label="Eliminar cliente"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-6 px-4 pb-8 sm:px-6">
            {/* Diagnóstico de ciclo de vida */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${segmento.dot}`} />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                  Diagnóstico de ciclo de vida
                </span>
                {cliente.esVip && getSegmento(cliente) !== 'vip' && (
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                    VIP {segmento.label.toLowerCase()}
                  </span>
                )}
              </div>
              <p className="text-sm font-normal leading-relaxed text-foreground/90">
                {segmento.description}{' '}
                {cliente.resumenCadencia && (
                  <span className="text-muted-foreground">{cliente.resumenCadencia}</span>
                )}
              </p>
            </div>

            {/* Métricas flotantes */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-y border-border/30 py-4 sm:grid-cols-5">
              <div className="flex flex-col">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Pedidos
                </span>
                <span className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-foreground">
                  {cliente.cantidadPedidos}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Total gastado
                </span>
                <span className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-foreground">
                  {formatCurrency(cliente.totalGastado)}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Ticket prom.
                </span>
                <span className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-foreground">
                  {formatCurrency(
                    cliente.ticketPromedio ??
                      (cliente.cantidadPedidos ? cliente.totalGastado / cliente.cantidadPedidos : 0),
                  )}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Cadencia
                </span>
                <span className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-foreground">
                  {cliente.cadenciaDias != null ? `~${cliente.cadenciaDias} días` : 'Sin ritmo'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPuntosDialogOpen(true)}
                className="flex flex-col text-left group hover:opacity-80 transition-opacity"
              >
                <span className="text-[11px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Puntos
                </span>
                <span className="mt-1 text-2xl font-black tracking-tight tabular-nums text-amber-600 dark:text-amber-400 group-hover:underline">
                  {cliente.puntos ?? 0}
                </span>
              </button>
            </div>

            {/* Micro-Campaña sugerida */}
            <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4 transition-all dark:bg-emerald-500/[0.07]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Zap className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-semibold tracking-tight text-foreground">
                      Micro-Campaña sugerida
                    </span>
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                      {getMicroCampanaInfo(cliente).badge}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {getMicroCampanaInfo(cliente).descripcion}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={onMicroCampana}
                  className="shrink-0 rounded-full bg-emerald-600 px-4 text-xs font-medium text-white shadow-sm hover:bg-emerald-700"
                >
                  <Zap className="mr-1.5 h-3.5 w-3.5" />
                  Compartir Micro-Campaña
                </Button>
              </div>
            </div>

            {/* Lo que más pide */}
            {cliente.productosTop && cliente.productosTop.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Lo que más pide
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {cliente.productosTop.map((producto) => (
                    <span
                      key={producto.nombre}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background/60 px-3 py-1 text-xs text-foreground backdrop-blur-xs transition-colors hover:border-border"
                    >
                      <span className="font-semibold tabular-nums text-foreground/70">{producto.cantidad}×</span>
                      <span>{producto.nombre}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Adquisición y actividad */}
            <div className="space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                Adquisición y actividad
              </span>
              <div className="divide-y divide-border/25 border-y border-border/25">
                <div className="flex items-center justify-between py-2 text-xs">
                  <span className="text-muted-foreground">Primera fuente</span>
                  <span className="text-right font-medium text-foreground">{fuente}</span>
                </div>
                <div className="flex items-center justify-between py-2 text-xs">
                  <span className="text-muted-foreground">Primera compra</span>
                  <span className="text-right font-medium text-foreground">
                    {cliente.primeraCompra
                      ? `${formatDate(cliente.primeraCompra.fecha)} · ${formatCurrency(cliente.primeraCompra.revenue)}`
                      : 'Sin datos'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 text-xs">
                  <span className="text-muted-foreground">Revenue de recetas</span>
                  <span className="text-right font-medium text-foreground">
                    {formatCurrency(cliente.revenueAcciones ?? 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Campañas y Cupones */}
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-1">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Campañas
                </span>
                {(cliente.campanasParticipadas ?? []).length ? (
                  <div className="divide-y divide-border/20 border-y border-border/20">
                    {cliente.campanasParticipadas!.map((campana) => (
                      <div key={campana.id} className="flex items-center justify-between py-2 text-xs">
                        <div className="min-w-0 pr-2">
                          <p className="truncate font-medium text-foreground">{campana.nombre}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {campana.pedidos} {campana.pedidos === 1 ? 'pedido' : 'pedidos'}
                          </p>
                        </div>
                        <span className="shrink-0 font-semibold tabular-nums text-foreground">
                          {formatCurrency(campana.revenueAtribuido)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-2 text-xs italic text-muted-foreground/60">Sin campañas atribuidas.</p>
                )}
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Cupones usados
                </span>
                {(cliente.cuponesUsados ?? []).length ? (
                  <div className="divide-y divide-border/20 border-y border-border/20">
                    {cliente.cuponesUsados!.map((cupon) => (
                      <div key={cupon.id} className="flex items-center justify-between py-2 text-xs">
                        <div className="min-w-0 pr-2">
                          <span className="font-mono text-xs font-medium text-foreground">{cupon.codigo}</span>
                          <p className="text-[11px] text-muted-foreground">
                            {cupon.usos} {cupon.usos === 1 ? 'uso' : 'usos'}
                          </p>
                        </div>
                        <span className="shrink-0 font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                          -{formatCurrency(cupon.montoDescontado)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-2 text-xs italic text-muted-foreground/60">No usó cupones.</p>
                )}
              </div>
            </div>

            {/* Contacto */}
            <div className="space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                Contacto
              </span>
              <div className="divide-y divide-border/25 border-y border-border/25">
                <div className="flex items-center justify-between py-2 text-xs">
                  <span className="text-muted-foreground">Teléfono</span>
                  <span className="text-right font-medium text-foreground">{cliente.telefono}</span>
                </div>
                <div className="flex items-center justify-between py-2 text-xs">
                  <span className="text-muted-foreground">Dirección</span>
                  <span className="text-right font-medium text-foreground">
                    {cliente.direccion ?? 'Retira en local'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 text-xs">
                  <span className="text-muted-foreground">Último pedido</span>
                  <span className="text-right font-medium text-foreground">
                    {formatDate(cliente.ultimoPedidoAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
        {token && (
          <HistorialPuntosDialog
            open={puntosDialogOpen}
            onOpenChange={setPuntosDialogOpen}
            token={token}
            clienteId={cliente.id}
            clienteNombre={cliente.nombre}
            puntosActuales={cliente.puntos ?? 0}
            onPuntosActualizados={(nuevos) => onPuntosActualizados?.(nuevos)}
          />
        )}
      </>
    )
  }

  // VISTA AMPLIA: cuando la columna de pedidos está oculta, aprovecha todo el ancho con diseño de 2 columnas
  return (
    <>
      <div className="flex items-start justify-between gap-4 p-5 sm:px-8">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-muted/80 text-base font-semibold tracking-tight text-foreground">
            {iniciales(cliente.nombre)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="truncate text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {cliente.nombre}
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background/80 px-3 py-0.5 text-xs font-medium text-foreground backdrop-blur-xs">
                <span className={`h-1.5 w-1.5 rounded-full ${segmento.dot}`} />
                {segmento.label}
              </span>
              {cliente.esVip && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                  <Crown className="h-3.5 w-3.5" />
                  VIP
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground/80">
              Cliente desde {formatDate(cliente.primerPedidoAt ?? cliente.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onTogglePedidos}
            className="h-8.5 gap-2 rounded-full border-border/60 px-4 text-xs font-medium shadow-2xs transition-colors hover:bg-muted/50"
          >
            <ReceiptText className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Ver pedidos</span>
            <span className="ml-0.5 rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-semibold text-foreground">
              {cliente.cantidadPedidos}
            </span>
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8.5 w-8.5 rounded-full text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
            onClick={onDeleteClient}
            aria-label="Eliminar cliente"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-8 px-6 pb-12 sm:px-8">
          {/* Métricas flotantes en ancho completo */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 border-y border-border/30 py-5 sm:grid-cols-5">
            <div className="flex flex-col">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                Pedidos
              </span>
              <span className="mt-1 text-3xl font-bold tracking-tight tabular-nums text-foreground">
                {cliente.cantidadPedidos}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                Total gastado
              </span>
              <span className="mt-1 text-3xl font-bold tracking-tight tabular-nums text-foreground">
                {formatCurrency(cliente.totalGastado)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                Ticket prom.
              </span>
              <span className="mt-1 text-3xl font-bold tracking-tight tabular-nums text-foreground">
                {formatCurrency(
                  cliente.ticketPromedio ??
                    (cliente.cantidadPedidos ? cliente.totalGastado / cliente.cantidadPedidos : 0),
                )}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                Cadencia
              </span>
              <span className="mt-1 text-3xl font-bold tracking-tight tabular-nums text-foreground">
                {cliente.cadenciaDias != null ? `~${cliente.cadenciaDias} días` : 'Sin ritmo'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setPuntosDialogOpen(true)}
              className="flex flex-col text-left group hover:opacity-80 transition-opacity"
            >
              <span className="text-[11px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Puntos
              </span>
              <span className="mt-1 text-3xl font-black tracking-tight tabular-nums text-amber-600 dark:text-amber-400 group-hover:underline">
                {cliente.puntos ?? 0}
              </span>
            </button>
          </div>

          {/* Distribución en 2 columnas: Inteligencia/Acción a la izquierda, Identidad/Contacto a la derecha */}
          <div className="grid grid-cols-1 gap-8 items-start lg:grid-cols-12 lg:gap-12">
            {/* Columna Principal / Recompra */}
            <div className="space-y-8 lg:col-span-7">
              {/* Diagnóstico de ciclo de vida */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${segmento.dot}`} />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                    Diagnóstico de ciclo de vida · {segmento.label}
                  </span>
                  {cliente.esVip && getSegmento(cliente) !== 'vip' && (
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                      VIP {segmento.label.toLowerCase()}
                    </span>
                  )}
                </div>
                <p className="text-sm font-normal leading-relaxed text-foreground/90">
                  {segmento.description}{' '}
                  {cliente.resumenCadencia && (
                    <span className="text-muted-foreground">{cliente.resumenCadencia}</span>
                  )}
                </p>
              </div>

              {/* Micro-Campaña sugerida */}
              <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5 transition-all dark:bg-emerald-500/[0.07]">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Zap className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-sm font-semibold tracking-tight text-foreground">
                        Micro-Campaña sugerida
                      </span>
                      <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        {getMicroCampanaInfo(cliente).badge}
                      </span>
                    </div>
                    <p className="max-w-lg text-xs leading-relaxed text-muted-foreground">
                      {getMicroCampanaInfo(cliente).descripcion}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={onMicroCampana}
                    className="h-9 shrink-0 rounded-full bg-emerald-600 px-5 text-xs font-medium text-white shadow-sm hover:bg-emerald-700"
                  >
                    <Zap className="mr-1.5 h-3.5 w-3.5" />
                    Compartir Micro-Campaña
                  </Button>
                </div>
              </div>

              {/* Lo que más pide */}
              {cliente.productosTop && cliente.productosTop.length > 0 && (
                <div className="space-y-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    Lo que más pide
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {cliente.productosTop.map((producto) => (
                      <span
                        key={producto.nombre}
                        className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/60 px-3.5 py-1.5 text-xs text-foreground backdrop-blur-xs transition-colors hover:border-border shadow-2xs"
                      >
                        <span className="font-semibold tabular-nums text-foreground/70">{producto.cantidad}×</span>
                        <span className="font-medium">{producto.nombre}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Campañas y Cupones usados en la columna principal */}
              <div className="grid grid-cols-1 gap-6 pt-2 sm:grid-cols-2">
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    Campañas
                  </span>
                  {(cliente.campanasParticipadas ?? []).length ? (
                    <div className="divide-y divide-border/20 border-y border-border/20">
                      {cliente.campanasParticipadas!.map((campana) => (
                        <div key={campana.id} className="flex items-center justify-between py-2.5 text-xs">
                          <div className="min-w-0 pr-2">
                            <p className="truncate font-medium text-foreground">{campana.nombre}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {campana.pedidos} {campana.pedidos === 1 ? 'pedido' : 'pedidos'}
                            </p>
                          </div>
                          <span className="shrink-0 font-semibold tabular-nums text-foreground">
                            {formatCurrency(campana.revenueAtribuido)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="py-2 text-xs italic text-muted-foreground/60">Sin campañas atribuidas.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    Cupones usados
                  </span>
                  {(cliente.cuponesUsados ?? []).length ? (
                    <div className="divide-y divide-border/20 border-y border-border/20">
                      {cliente.cuponesUsados!.map((cupon) => (
                        <div key={cupon.id} className="flex items-center justify-between py-2.5 text-xs">
                          <div className="min-w-0 pr-2">
                            <span className="font-mono text-xs font-medium text-foreground">{cupon.codigo}</span>
                            <p className="text-[11px] text-muted-foreground">
                              {cupon.usos} {cupon.usos === 1 ? 'uso' : 'usos'}
                            </p>
                          </div>
                          <span className="shrink-0 font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                            -{formatCurrency(cupon.montoDescontado)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="py-2 text-xs italic text-muted-foreground/60">No usó cupones.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Columna Secundaria / Contacto y Procedencia */}
            <div className="space-y-8 lg:col-span-5">
              {/* Contacto */}
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Contacto
                </span>
                <div className="divide-y divide-border/25 border-y border-border/25">
                  <div className="flex items-center justify-between py-2.5 text-xs">
                    <span className="text-muted-foreground">Teléfono</span>
                    <span className="text-right font-medium text-foreground">{cliente.telefono}</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5 text-xs">
                    <span className="text-muted-foreground">Dirección</span>
                    <span className="text-right font-medium text-foreground">
                      {cliente.direccion ?? 'Retira en local'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2.5 text-xs">
                    <span className="text-muted-foreground">Último pedido</span>
                    <span className="text-right font-medium text-foreground">
                      {formatDate(cliente.ultimoPedidoAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Adquisición y actividad */}
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Adquisición y actividad
                </span>
                <div className="divide-y divide-border/25 border-y border-border/25">
                  <div className="flex items-center justify-between py-2.5 text-xs">
                    <span className="text-muted-foreground">Primera fuente</span>
                    <span className="text-right font-medium text-foreground">{fuente}</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5 text-xs">
                    <span className="text-muted-foreground">Primera compra</span>
                    <span className="text-right font-medium text-foreground">
                      {cliente.primeraCompra
                        ? `${formatDate(cliente.primeraCompra.fecha)} · ${formatCurrency(cliente.primeraCompra.revenue)}`
                        : 'Sin datos'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2.5 text-xs">
                    <span className="text-muted-foreground">Revenue de recetas</span>
                    <span className="text-right font-medium text-foreground">
                      {formatCurrency(cliente.revenueAcciones ?? 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
      {token && (
        <HistorialPuntosDialog
          open={puntosDialogOpen}
          onOpenChange={setPuntosDialogOpen}
          token={token}
          clienteId={cliente.id}
          clienteNombre={cliente.nombre}
          puntosActuales={cliente.puntos ?? 0}
          onPuntosActualizados={(nuevos) => onPuntosActualizados?.(nuevos)}
        />
      )}
    </>
  )
}

function PedidosClientePanel({
  cliente,
  sucursales,
  onClose,
  onDeleteOrder,
}: {
  cliente: ClienteGrowth | null
  sucursales: SucursalGrowth[]
  onClose?: () => void
  onDeleteOrder: (pedidoId: number) => void
}) {
  const sucursalPorId = new Map(sucursales.map((item) => [item.id, item.nombre]))
  if (!cliente)
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
          <Package className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="mt-4 font-semibold">Pedidos del cliente</h2>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          Seleccioná un cliente para recorrer todo su historial.
        </p>
      </div>
    )
  return (
    <>
      <div className="flex items-center justify-between p-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Historial de pedidos
          </p>
          <p className="text-[11px] text-muted-foreground">
            {cliente.nombre} · {cliente.pedidos.length} {cliente.pedidos.length === 1 ? 'pedido' : 'pedidos'}
          </p>
        </div>
        {onClose && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
            onClick={onClose}
            aria-label="Cerrar panel de pedidos"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 p-2">
          {cliente.pedidos.length ? (
            cliente.pedidos.map((pedido) => (
              <PedidoRow
                key={pedido.id}
                pedido={pedido}
                sucursal={pedido.sucursalId ? sucursalPorId.get(pedido.sucursalId) : undefined}
                onDelete={() => onDeleteOrder(pedido.id)}
              />
            ))
          ) : (
            <EmptyText>Todavía no tiene pedidos.</EmptyText>
          )}
        </div>
      </ScrollArea>
    </>
  )
}

function EmptyText({ children }: { children: React.ReactNode }) { return <p className="py-2 text-xs text-muted-foreground">{children}</p> }

function PedidoRow({ pedido, sucursal, onDelete }: { pedido: PedidoCliente; sucursal?: string; onDelete: () => void }) {
  return <div className="rounded-xl bg-white p-3 transition-colors hover:bg-muted/40 dark:bg-muted/20"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-1.5"><p className="text-xs font-semibold">Pedido #{pedido.id}</p>{pedido.esOrganico && <Badge variant="outline" className="h-5 text-[9px]">Orgánico</Badge>}{pedido.campanaId && <Badge variant="outline" className="h-5 text-[9px]">Campaña</Badge>}{pedido.codigoDescuentoId && <Badge variant="outline" className="h-5 text-[9px]">Cupón</Badge>}</div><p className="mt-1 text-[11px] text-muted-foreground">{formatDate(pedido.createdAt)} · {pedido.tipo}{sucursal ? ` · ${sucursal}` : ''}</p></div><div className="flex items-center gap-2"><span className="text-xs font-semibold">{formatCurrency(pedido.total)}</span><Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button></div></div>{pedido.items.length > 0 && <p className="mt-2 text-[11px] text-muted-foreground">{pedido.items.map((item) => `${item.cantidad}× ${item.nombreProducto}`).join(' · ')}</p>}{Number(pedido.montoDescuento ?? 0) > 0 && <p className="mt-1 text-[11px] text-emerald-700">Descuento aplicado: {formatCurrency(pedido.montoDescuento)}</p>}</div>
}
