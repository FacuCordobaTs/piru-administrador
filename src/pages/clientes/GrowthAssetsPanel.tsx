import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ApiError, codigosDescuentoApi, crecimientoApi, type CampanaCrecimiento, type CrearCampanaCrecimiento } from '@/lib/api'
import { ArrowUpDown, ChevronRight, Copy, Globe2, Loader2, Megaphone, Pencil, Plus, Power, PowerOff, Sparkles, Tag, Trash2, TrendingUp, Users, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  type ClienteGrowth,
  type CodigoDescuentoGrowth,
  type FiltroCampana,
  type ProductoGrowth,
  type ResultadoCampana,
  type ResultadoCupon,
  type SucursalGrowth,
  type SortCampanaKey,
  type SortCuponKey,
  type EstadoCampanaFilter,
  type TipoCampanaFilter,
  type EstadoCuponFilter,
  type TipoCuponFilter,
  SORT_CAMPANA_LABELS,
  SORT_CUPON_LABELS,
  formatCurrency,
  formatDate,
  normalizarHasta,
} from './types'

type AssetTab = 'campanas' | 'cupones'
type Filtros = { from?: string; to?: string; sucursalId?: number }
type MobileView = 'lista' | 'detalle' | 'clientes'

interface Props {
  token: string
  username?: string | null
  tab: AssetTab
  campanas: CampanaCrecimiento[]
  cupones: CodigoDescuentoGrowth[]
  clientes: ClienteGrowth[]
  sucursales: SucursalGrowth[]
  productos: ProductoGrowth[]
  query: string
  filtros: Filtros
  campanaSeleccionada: FiltroCampana
  cuponSeleccionado: number | null
  onSelectCampana: (id: FiltroCampana) => void
  onSelectCupon: (id: number | null) => void
  onSelectClient: (id: number) => void
  onReload: () => Promise<void>
  crecimientoActivo: boolean
  cuponesActivos: boolean
  mobileView: MobileView
  onMobileViewChange?: (view: MobileView) => void
  sortCampana?: SortCampanaKey
  estadoCampana?: EstadoCampanaFilter
  tipoCampana?: TipoCampanaFilter
  sortCupon?: SortCuponKey
  estadoCupon?: EstadoCuponFilter
  tipoCupon?: TipoCuponFilter
  onOpenFiltros?: () => void
}

const slug = (valor: string) => valor.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 191)

type FormCampana = {
  nombre: string; slug: string; estado: CampanaCrecimiento['estado']; modalidad: 'seguimiento' | 'producto' | 'carrito'; productoId: string
  carritoRep: string; descuentoProductoPorcentaje: string; limiteUsos: string; fechaInicio: string; fechaFin: string
}
const campanaVacia = (): FormCampana => ({ nombre: '', slug: '', estado: 'activa', modalidad: 'seguimiento', productoId: '', carritoRep: '', descuentoProductoPorcentaje: '', limiteUsos: '', fechaInicio: '', fechaFin: '' })
const campanaAForm = (campana: CampanaCrecimiento): FormCampana => ({ nombre: campana.nombre, slug: campana.slug, estado: campana.estado, modalidad: campana.destinoTipo === 'producto' && campana.productoId != null ? 'producto' : campana.destinoTipo === 'carrito' && campana.carritoRep ? 'carrito' : 'seguimiento', productoId: campana.productoId?.toString() ?? '', carritoRep: campana.carritoRep ?? '', descuentoProductoPorcentaje: campana.descuentoProductoPorcentaje ? String(campana.descuentoProductoPorcentaje) : '', limiteUsos: campana.limiteUsos?.toString() ?? '', fechaInicio: campana.fechaInicio?.slice(0, 16) ?? '', fechaFin: campana.fechaFin?.slice(0, 16) ?? '' })

type FormCupon = { codigo: string; tipo: 'porcentaje' | 'monto_fijo'; valor: string; limiteUsos: string; montoMinimo: string; fechaInicio: string; fechaFin: string }
const cuponVacio = (): FormCupon => ({ codigo: '', tipo: 'porcentaje', valor: '', limiteUsos: '', montoMinimo: '0', fechaInicio: '', fechaFin: '' })
const cuponAForm = (cupon: CodigoDescuentoGrowth): FormCupon => ({ codigo: cupon.codigo, tipo: cupon.tipo, valor: cupon.valor, limiteUsos: cupon.limiteUsos?.toString() ?? '', montoMinimo: cupon.montoMinimo ?? '0', fechaInicio: cupon.fechaInicio?.slice(0, 16) ?? '', fechaFin: cupon.fechaFin?.slice(0, 16) ?? '' })

function FloatingMetric({ label, value, sublabel }: { label: string; value: string | number; sublabel?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">{label}</span>
      <span className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-foreground sm:text-3xl">{value}</span>
      {sublabel && <span className="mt-0.5 text-[11px] text-muted-foreground">{sublabel}</span>}
    </div>
  )
}

function CompactMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">{label}</span>
      <span className="mt-0.5 text-xl font-bold tracking-tight tabular-nums text-foreground">{value}</span>
    </div>
  )
}

function getCouponStatus(cupon: CodigoDescuentoGrowth) {
  const ahora = Date.now()
  const empiezaEn = cupon.fechaInicio ? new Date(cupon.fechaInicio).getTime() > ahora : false
  const vencio = cupon.fechaFin ? new Date(cupon.fechaFin).getTime() < ahora : false
  const agotado = cupon.limiteUsos != null && cupon.usosActuales >= cupon.limiteUsos
  const vigente = cupon.activo && !empiezaEn && !vencio && !agotado
  const estado = vigente
    ? 'Vigente'
    : !cupon.activo
      ? 'Inactivo'
      : empiezaEn
        ? 'Próximamente'
        : vencio
          ? 'Vencido'
          : 'Agotado'
  const dotColor = vigente
    ? 'bg-emerald-500'
    : !cupon.activo
      ? 'bg-zinc-400'
      : empiezaEn
        ? 'bg-amber-500'
        : vencio
          ? 'bg-destructive'
          : 'bg-orange-500'
  return { vigente, estado, dotColor }
}

function getCampaignStatus(campana: CampanaCrecimiento | null, organic: boolean) {
  if (organic) {
    return { estado: 'Vista automática', dotColor: 'bg-sky-500' }
  }
  if (!campana) return { estado: 'Desconocido', dotColor: 'bg-zinc-400' }
  if (campana.estado === 'activa') return { estado: 'Activa', dotColor: 'bg-emerald-500' }
  if (campana.estado === 'borrador') return { estado: 'Borrador', dotColor: 'bg-amber-500' }
  return { estado: 'Inactiva', dotColor: 'bg-zinc-400' }
}

export default function GrowthAssetsPanel(props: Props) {
  const { token, tab, campanas, cupones, query, filtros, campanaSeleccionada, cuponSeleccionado } = props
  const [mostrarAsociaciones, setMostrarAsociaciones] = useState(false)
  const [resultadoCampana, setResultadoCampana] = useState<ResultadoCampana | null>(null)
  const [resultadoCupon, setResultadoCupon] = useState<ResultadoCupon | null>(null)
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const [campanaDialog, setCampanaDialog] = useState(false)
  const [campanaEditando, setCampanaEditando] = useState<CampanaCrecimiento | null>(null)
  const [formCampana, setFormCampana] = useState<FormCampana>(campanaVacia)
  const [cuponDialog, setCuponDialog] = useState(false)
  const [cuponEditando, setCuponEditando] = useState<CodigoDescuentoGrowth | null>(null)
  const [formCupon, setFormCupon] = useState<FormCupon>(cuponVacio)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggleAsociaciones = () => {
    setMostrarAsociaciones((prev) => {
      const next = !prev
      if (props.onMobileViewChange) {
        props.onMobileViewChange(next ? 'clientes' : 'detalle')
      }
      return next
    })
  }

  const cerrarAsociaciones = () => {
    setMostrarAsociaciones(false)
    if (props.onMobileViewChange) {
      props.onMobileViewChange('detalle')
    }
  }

  const filtrosApi = useMemo(() => ({ from: filtros.from, to: normalizarHasta(filtros.to), sucursalId: filtros.sucursalId }), [filtros])

  useEffect(() => {
    if (tab !== 'campanas' || campanaSeleccionada == null || !props.crecimientoActivo) { setResultadoCampana(null); return }
    setLoadingDetalle(true)
    const pedido = campanaSeleccionada === 'organico'
      ? crecimientoApi.resultadosOrganico(token, filtrosApi)
      : crecimientoApi.resultadosCampana(token, campanaSeleccionada, filtrosApi)
    void pedido.then((respuesta) => setResultadoCampana(respuesta.data)).catch((cause) => {
      toast.error(cause instanceof ApiError ? cause.message : 'No se pudieron cargar los resultados.')
      setResultadoCampana(null)
    }).finally(() => setLoadingDetalle(false))
  }, [tab, campanaSeleccionada, token, filtrosApi, props.crecimientoActivo])

  useEffect(() => {
    if (tab !== 'cupones' || cuponSeleccionado == null || !props.cuponesActivos) { setResultadoCupon(null); return }
    setLoadingDetalle(true)
    void codigosDescuentoApi.resultados(token, cuponSeleccionado, filtrosApi).then((respuesta) => setResultadoCupon(respuesta.data)).catch((cause) => {
      toast.error(cause instanceof ApiError ? cause.message : 'No se pudieron cargar los resultados del cupón.')
      setResultadoCupon(null)
    }).finally(() => setLoadingDetalle(false))
  }, [tab, cuponSeleccionado, token, filtrosApi, props.cuponesActivos])

  const campanasFiltradas = useMemo(() => {
    const q = query.trim().toLowerCase()
    let lista = campanas.filter((item) => {
      if (q && !`${item.nombre} ${item.slug}`.toLowerCase().includes(q)) return false
      if (props.estadoCampana === 'activa' && item.estado !== 'activa') return false
      if (props.estadoCampana === 'inactiva' && item.estado === 'activa') return false
      if (props.tipoCampana && props.tipoCampana !== 'todos' && item.destinoTipo !== props.tipoCampana) return false
      return true
    })

    lista = [...lista].sort((a, b) => {
      if (props.sortCampana === 'conversions') return b.usosActuales - a.usosActuales
      if (props.sortCampana === 'visits') return b.visitas - a.visitas
      if (props.sortCampana === 'alphabetical') return a.nombre.localeCompare(b.nombre)
      // default: 'recent'
      return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
    })
    return lista
  }, [campanas, query, props.estadoCampana, props.tipoCampana, props.sortCampana])

  const cuponesFiltrados = useMemo(() => {
    const q = query.trim().toLowerCase()
    const now = new Date()

    let lista = cupones.filter((item) => {
      if (q && !item.codigo.toLowerCase().includes(q)) return false
      if (props.tipoCupon && props.tipoCupon !== 'todos' && item.tipo !== props.tipoCupon) return false

      if (props.estadoCupon === 'vigentes') {
        if (!item.activo) return false
        if (item.fechaInicio && new Date(item.fechaInicio) > now) return false
        if (item.fechaFin && new Date(item.fechaFin) < now) return false
        if (item.limiteUsos != null && item.usosActuales >= item.limiteUsos) return false
      } else if (props.estadoCupon === 'inactivos') {
        if (item.activo) return false
      } else if (props.estadoCupon === 'agotados') {
        if (item.limiteUsos == null || item.usosActuales < item.limiteUsos) return false
      } else if (props.estadoCupon === 'expirados') {
        if (!item.fechaFin || new Date(item.fechaFin) >= now) return false
      }
      return true
    })

    lista = [...lista].sort((a, b) => {
      if (props.sortCupon === 'uses') return b.usosActuales - a.usosActuales
      if (props.sortCupon === 'discount') return Number(b.valor) - Number(a.valor)
      if (props.sortCupon === 'alphabetical') return a.codigo.localeCompare(b.codigo)
      // default: 'recent'
      return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
    })
    return lista
  }, [cupones, query, props.estadoCupon, props.tipoCupon, props.sortCupon])

  const campanaActual = typeof campanaSeleccionada === 'number' ? campanas.find((item) => item.id === campanaSeleccionada) ?? null : null
  const cuponActual = cuponSeleccionado != null ? cupones.find((item) => item.id === cuponSeleccionado) ?? null : null

  const asociacionesCampana = useMemo(() => {
    if (tab !== 'campanas' || campanaSeleccionada == null) return []
    const desde = filtros.from ? new Date(`${filtros.from}T00:00:00`).getTime() : null
    const hasta = filtros.to ? new Date(`${filtros.to}T23:59:59.999`).getTime() : null
    return props.clientes.flatMap((cliente) => cliente.pedidos
      .filter((pedido) => {
        const fecha = new Date(pedido.createdAt).getTime()
        const pertenece = campanaSeleccionada === 'organico' ? pedido.esOrganico : pedido.campanaId === campanaSeleccionada
        return pertenece && (!desde || fecha >= desde) && (!hasta || fecha <= hasta) && (!filtros.sucursalId || pedido.sucursalId === filtros.sucursalId)
      })
      .map((pedido) => ({ cliente, pedido })))
      .sort((a, b) => new Date(b.pedido.createdAt).getTime() - new Date(a.pedido.createdAt).getTime())
  }, [tab, campanaSeleccionada, props.clientes, filtros])

  const clientesCampana = useMemo(() => [...new Map(asociacionesCampana.map(({ cliente }) => [cliente.id, cliente])).values()], [asociacionesCampana])
  const clientePorId = useMemo(() => new Map(props.clientes.map((cliente) => [cliente.id, cliente])), [props.clientes])

  const actividadCount = useMemo(() => {
    if (tab === 'campanas') {
      return { clientes: clientesCampana.length, pedidos: asociacionesCampana.length }
    }
    const pedCount = resultadoCupon?.pedidos?.length ?? resultadoCupon?.metricas?.usos ?? 0
    const cliCount = resultadoCupon?.clientes?.length ?? resultadoCupon?.metricas?.clientes ?? 0
    return { clientes: cliCount, pedidos: pedCount }
  }, [tab, clientesCampana.length, asociacionesCampana.length, resultadoCupon])

  const abrirCampana = (campana?: CampanaCrecimiento) => { setCampanaEditando(campana ?? null); setFormCampana(campana ? campanaAForm(campana) : campanaVacia()); setError(''); setCampanaDialog(true) }
  const abrirCupon = (cupon?: CodigoDescuentoGrowth) => { setCuponEditando(cupon ?? null); setFormCupon(cupon ? cuponAForm(cupon) : cuponVacio()); setError(''); setCuponDialog(true) }

  const payloadCampana = (): CrearCampanaCrecimiento | null => {
    if (!formCampana.nombre.trim() || !formCampana.slug.trim()) { setError('Completá el nombre y el slug.'); return null }
    const esPromocionProducto = formCampana.modalidad === 'producto'
    const esCarritoPrearmado = formCampana.modalidad === 'carrito'
    if (esPromocionProducto && !formCampana.productoId) { setError('Elegí el producto de la promoción.'); return null }
    if (esCarritoPrearmado && !parseCarritoPrearmado(formCampana.carritoRep).length) { setError('Agregá al menos un producto al carrito prearmado.'); return null }
    const descuento = esPromocionProducto ? Number(formCampana.descuentoProductoPorcentaje || 0) : 0
    if (!Number.isInteger(descuento) || descuento < 0 || descuento > 100) { setError('El descuento debe ser un porcentaje entre 0 y 100.'); return null }
    const limite = esPromocionProducto && formCampana.limiteUsos ? Number(formCampana.limiteUsos) : null
    if (limite != null && (!Number.isInteger(limite) || limite <= 0)) { setError('El cupo debe ser un número mayor a cero.'); return null }
    if (formCampana.fechaInicio && formCampana.fechaFin && new Date(formCampana.fechaFin) <= new Date(formCampana.fechaInicio)) { setError('La fecha de fin debe ser posterior al inicio.'); return null }
    return {
      nombre: formCampana.nombre.trim(), slug: formCampana.slug, tipo: 'adquisicion', recetaCodigo: null,
      estado: formCampana.estado, destinoTipo: esPromocionProducto ? 'producto' : esCarritoPrearmado ? 'carrito' : 'tienda', productoId: esPromocionProducto ? Number(formCampana.productoId) : null,
      carritoRep: esCarritoPrearmado ? formCampana.carritoRep : null, codigoDescuentoId: null, descuentoProductoPorcentaje: descuento,
      limiteUsos: limite, fechaInicio: formCampana.fechaInicio ? new Date(formCampana.fechaInicio).toISOString() : null,
      fechaFin: formCampana.fechaFin ? new Date(formCampana.fechaFin).toISOString() : null,
      inversionManual: 0, utmSource: null, utmMedium: null, utmCampaign: null, utmTerm: null, utmContent: null,
      usaGrupoControl: false,
    }
  }

  const guardarCampana = async () => {
    const payload = payloadCampana(); if (!payload) return
    setSaving(true); setError('')
    try {
      const respuesta = campanaEditando
        ? await crecimientoApi.actualizarCampana(token, campanaEditando.id, ((entrada) => {
          const edicion = { ...entrada }
          delete (edicion as Partial<CrearCampanaCrecimiento>).slug
          return edicion
        })(payload))
        : await crecimientoApi.crearCampana(token, payload)
      setCampanaDialog(false); await props.onReload(); props.onSelectCampana(respuesta.data.id)
      toast.success(campanaEditando ? 'Campaña actualizada.' : 'Campaña creada.')
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : 'No se pudo guardar la campaña.') } finally { setSaving(false) }
  }

  const guardarCupon = async () => {
    if (!formCupon.codigo.trim() || !formCupon.valor.trim()) { setError('Completá el código y el valor.'); return }
    setSaving(true); setError('')
    const payload = { codigo: formCupon.codigo.trim().toUpperCase(), tipo: formCupon.tipo, valor: formCupon.valor, limiteUsos: formCupon.limiteUsos ? Number(formCupon.limiteUsos) : null, montoMinimo: formCupon.montoMinimo || '0', fechaInicio: formCupon.fechaInicio ? new Date(formCupon.fechaInicio).toISOString() : null, fechaFin: formCupon.fechaFin ? new Date(formCupon.fechaFin).toISOString() : null }
    try {
      const respuesta = cuponEditando
        ? await codigosDescuentoApi.update(token, cuponEditando.id, payload) as { data?: CodigoDescuentoGrowth }
        : await codigosDescuentoApi.create(token, payload) as { data?: CodigoDescuentoGrowth }
      setCuponDialog(false); await props.onReload(); if (respuesta.data) props.onSelectCupon(respuesta.data.id)
      toast.success(cuponEditando ? 'Cupón actualizado.' : 'Cupón creado.')
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : 'No se pudo guardar el cupón.') } finally { setSaving(false) }
  }

  const copiarCampana = async (campana: CampanaCrecimiento) => {
    if (!props.username) return toast.error('El local todavía no tiene un username público disponible.')
    if (campana.estado !== 'activa') return toast.error('Activá la campaña antes de compartir el link.')
    await navigator.clipboard.writeText(`https://my.piru.app/${props.username}/c/${campana.slug}`)
    toast.success('Smart Link copiado.')
  }

  const copiarCupon = async (cupon: CodigoDescuentoGrowth) => {
    await navigator.clipboard.writeText(cupon.codigo)
    toast.success(`Código ${cupon.codigo} copiado al portapapeles.`)
  }

  const toggleCampana = async (campana: CampanaCrecimiento) => {
    try {
      if (campana.estado === 'activa') await crecimientoApi.desactivarCampana(token, campana.id)
      else await crecimientoApi.actualizarCampana(token, campana.id, { estado: 'activa' })
      await props.onReload(); toast.success(campana.estado === 'activa' ? 'Campaña desactivada.' : 'Campaña activada.')
    } catch (cause) { toast.error(cause instanceof ApiError ? cause.message : 'No se pudo cambiar el estado.') }
  }

  const borrarCampana = async (campana: CampanaCrecimiento) => {
    if (!window.confirm(`¿Eliminar “${campana.nombre}”? Si tiene atribuciones se conservará desactivada.`)) return
    try { await crecimientoApi.eliminarCampana(token, campana.id); props.onSelectCampana(null); await props.onReload(); toast.success('Campaña actualizada.') }
    catch (cause) { toast.error(cause instanceof ApiError ? cause.message : 'No se pudo eliminar la campaña.') }
  }

  const toggleCupon = async (cupon: CodigoDescuentoGrowth) => {
    try { await codigosDescuentoApi.toggle(token, cupon.id); await props.onReload(); toast.success('Estado del cupón actualizado.') }
    catch { toast.error('No se pudo cambiar el estado del cupón.') }
  }

  const borrarCupon = async (cupon: CodigoDescuentoGrowth) => {
    if (!window.confirm(`¿Eliminar el cupón ${cupon.codigo}?`)) return
    try { await codigosDescuentoApi.delete(token, cupon.id); props.onSelectCupon(null); await props.onReload(); toast.success('Cupón eliminado.') }
    catch { toast.error('No se pudo eliminar el cupón. Puede estar asociado a pedidos o campañas.') }
  }

  return (
    <div
      className={`grid min-h-[680px] gap-4 xl:h-full xl:min-h-0 ${
        mostrarAsociaciones
          ? 'xl:grid-cols-[minmax(260px,0.85fr)_minmax(430px,1.45fr)_minmax(310px,1fr)]'
          : 'xl:grid-cols-[minmax(280px,360px)_1fr]'
      }`}
    >
      <section
        className={`${
          props.mobileView === 'lista' ? 'flex' : 'hidden'
        } min-h-[520px] flex-col overflow-hidden xl:flex xl:min-h-0`}
      >
        <div className="flex items-center justify-between gap-3 p-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {tab === 'campanas' ? 'Campañas' : 'Cupones'}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {tab === 'campanas' ? campanasFiltradas.length + 1 : cuponesFiltrados.length} resultados
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {props.onOpenFiltros && (
              <Button
                variant="ghost"
                size="sm"
                onClick={props.onOpenFiltros}
                className="h-8 gap-1.5 rounded-full border border-border/40 px-3 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                title="Filtrar y ordenar"
              >
                <ArrowUpDown className="h-3 w-3" />
                <span className="hidden sm:inline">
                  {tab === 'campanas'
                    ? SORT_CAMPANA_LABELS[props.sortCampana ?? 'recent']
                    : SORT_CUPON_LABELS[props.sortCupon ?? 'recent']}
                </span>
              </Button>
            )}
            <Button
              size="sm"
              disabled={tab === 'campanas' ? !props.crecimientoActivo : !props.cuponesActivos}
              onClick={() => (tab === 'campanas' ? abrirCampana() : abrirCupon())}
              className="h-8 rounded-full px-3 text-xs"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Nuevo
            </Button>
          </div>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-2 p-2">
            {tab === 'campanas' ? (
              <>
                {!props.crecimientoActivo && <Disabled label="Crecimiento está desactivado" />}
                {props.crecimientoActivo &&
                  (!query.trim() || 'orgánico sin campaña directo'.includes(query.trim().toLowerCase())) && (
                    <AssetButton
                      active={campanaSeleccionada === 'organico'}
                      onClick={() => props.onSelectCampana(campanaSeleccionada === 'organico' ? null : 'organico')}
                      icon={<Globe2 className="h-4 w-4" />}
                      title="Orgánico · sin campaña"
                      subtitle="Visitas directas y compras sin touch de campaña"
                      badge="Siempre disponible"
                    />
                  )}
                {props.crecimientoActivo &&
                  campanasFiltradas.map((campana) => (
                    <AssetButton
                      key={campana.id}
                      active={campanaSeleccionada === campana.id}
                      onClick={() => props.onSelectCampana(campanaSeleccionada === campana.id ? null : campana.id)}
                      icon={<Megaphone className="h-4 w-4" />}
                      title={campana.nombre}
                      subtitle={`${
                        campana.destinoTipo === 'producto' && campana.productoId != null
                          ? 'Promoción de producto'
                          : campana.destinoTipo === 'carrito'
                            ? 'Carrito prearmado'
                            : 'Link de seguimiento'
                      } · /c/${campana.slug}`}
                      badge={campana.estado}
                    />
                  ))}
                {props.crecimientoActivo && campanasFiltradas.length === 0 && query.trim() && (
                  <Empty label="No hay campañas que coincidan." />
                )}
              </>
            ) : (
              <>
                {!props.cuponesActivos && <Disabled label="Códigos de descuento está desactivado" />}
                {props.cuponesActivos &&
                  cuponesFiltrados.map((cupon) => (
                    <CouponAssetButton
                      key={cupon.id}
                      cupon={cupon}
                      active={cuponSeleccionado === cupon.id}
                      onClick={() => props.onSelectCupon(cuponSeleccionado === cupon.id ? null : cupon.id)}
                    />
                  ))}
                {props.cuponesActivos && cuponesFiltrados.length === 0 && (
                  <Empty label="Todavía no hay cupones." />
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </section>

      <section
        className={`${
          props.mobileView === 'detalle' ? 'flex' : 'hidden'
        } min-h-[620px] flex-col overflow-hidden xl:flex xl:min-h-0`}
      >
        {loadingDetalle ? (
          <LoadingDetail />
        ) : tab === 'campanas' && campanaSeleccionada != null && resultadoCampana ? (
          <CampaignDetail
            organic={campanaSeleccionada === 'organico'}
            campana={campanaActual}
            producto={props.productos.find((item) => item.id === campanaActual?.productoId) ?? null}
            productos={props.productos}
            resultado={resultadoCampana}
            onCopy={() => campanaActual && void copiarCampana(campanaActual)}
            onEdit={() => campanaActual && abrirCampana(campanaActual)}
            onToggle={() => campanaActual && void toggleCampana(campanaActual)}
            onDelete={() => campanaActual && void borrarCampana(campanaActual)}
            mostrarAsociaciones={mostrarAsociaciones}
            onToggleAsociaciones={toggleAsociaciones}
            actividadCount={actividadCount}
            username={props.username}
          />
        ) : tab === 'cupones' && cuponActual && resultadoCupon ? (
          <CouponDetail
            cupon={cuponActual}
            resultado={resultadoCupon}
            onCopy={() => cuponActual && void copiarCupon(cuponActual)}
            onEdit={() => abrirCupon(cuponActual)}
            onToggle={() => void toggleCupon(cuponActual)}
            onDelete={() => void borrarCupon(cuponActual)}
            mostrarAsociaciones={mostrarAsociaciones}
            onToggleAsociaciones={toggleAsociaciones}
            actividadCount={actividadCount}
          />
        ) : (
          <EmptySelection tab={tab} />
        )}
      </section>

      <section
        className={`${
          props.mobileView === 'clientes' ? 'flex' : 'hidden'
        } min-h-[620px] flex-col overflow-hidden ${
          mostrarAsociaciones ? 'xl:flex' : 'xl:hidden'
        } xl:min-h-0`}
      >
        <AssociationsPanel
          tab={tab}
          campanaSeleccionada={campanaSeleccionada}
          cuponSeleccionado={cuponSeleccionado}
          sucursales={props.sucursales}
          resultadoCupon={resultadoCupon}
          loading={loadingDetalle}
          onSelectClient={props.onSelectClient}
          onClose={cerrarAsociaciones}
          asociacionesCampana={asociacionesCampana}
          clientesCampana={clientesCampana}
          clientePorId={clientePorId}
        />
      </section>

      <CampanaDialog
        open={campanaDialog}
        onOpenChange={setCampanaDialog}
        editando={campanaEditando}
        form={formCampana}
        setForm={setFormCampana}
        productos={props.productos}
        error={error}
        saving={saving}
        onSave={() => void guardarCampana()}
        username={props.username}
      />
      <CuponDialog
        open={cuponDialog}
        onOpenChange={setCuponDialog}
        editando={cuponEditando}
        form={formCupon}
        setForm={setFormCupon}
        error={error}
        saving={saving}
        onSave={() => void guardarCupon()}
      />
    </div>
  )
}

function LoadingDetail() {
  return (
    <div className="flex flex-1 items-center justify-center py-16 text-xs text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Calculando resultados…
    </div>
  )
}

function EmptySelection({ tab }: { tab: AssetTab }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/80">
        {tab === 'campanas' ? (
          <Megaphone className="h-6 w-6 text-muted-foreground" />
        ) : (
          <Tag className="h-6 w-6 text-muted-foreground" />
        )}
      </div>
      <h2 className="mt-4 text-base font-semibold tracking-tight text-foreground">
        Seleccioná {tab === 'campanas' ? 'una campaña' : 'un cupón'}
      </h2>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground leading-relaxed">
        {tab === 'campanas'
          ? 'Vas a ver su configuración detallada, embudo de conversión y clientes asociados.'
          : 'Vas a ver sus condiciones, retorno financiero, consumo de cupos y pedidos asociados.'}
      </p>
    </div>
  )
}

function AssetButton({
  active,
  onClick,
  icon,
  title,
  subtitle,
  badge,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  title: string
  subtitle: string
  badge: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border-0 p-3.5 text-left transition-all ${
        active
          ? 'border-l-[3px] border-l-[#FF7A00] bg-muted/40 shadow-2xs'
          : 'bg-white hover:bg-muted/40 dark:bg-muted/20'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 shrink-0 ${active ? 'text-[#FF7A00]' : 'text-muted-foreground'}`}>{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold tracking-tight text-foreground">{title}</span>
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{subtitle}</span>
        </span>
        <span className="shrink-0 rounded-full border border-border/40 bg-muted/50 px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
          {badge}
        </span>
      </div>
    </button>
  )
}

function CouponAssetButton({
  cupon,
  active,
  onClick,
}: {
  cupon: CodigoDescuentoGrowth
  active: boolean
  onClick: () => void
}) {
  const { vigente, estado, dotColor } = getCouponStatus(cupon)
  const usos =
    cupon.limiteUsos == null
      ? `${cupon.usosActuales} usos · sin límite`
      : `${cupon.usosActuales}/${cupon.limiteUsos} usos`
  const progreso = cupon.limiteUsos == null ? 0 : Math.min(100, (cupon.usosActuales / cupon.limiteUsos) * 100)
  const beneficio =
    cupon.tipo === 'porcentaje' ? `${Number(cupon.valor)}% OFF` : `${formatCurrency(cupon.valor)} OFF`

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl p-3.5 text-left transition-all ${
        active
          ? 'border-l-[3px] border-l-[#FF7A00] bg-muted/40 shadow-2xs'
          : 'bg-white hover:bg-muted/40 dark:bg-muted/20'
      }`}
    >
      <div className="flex items-start gap-3">
        <Tag className={`mt-0.5 h-4 w-4 shrink-0 ${active ? 'text-[#FF7A00]' : 'text-muted-foreground'}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-mono text-sm font-bold tracking-tight text-foreground">{cupon.codigo}</p>
            <span className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-background/80 px-2 py-0.5 text-[10px] font-medium text-foreground backdrop-blur-xs">
              <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
              {estado}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {beneficio}
            {Number(cupon.montoMinimo) > 0 ? ` · mín. ${formatCurrency(cupon.montoMinimo)}` : ''}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
            <span className="font-medium text-foreground">{usos}</span>
            <span className="truncate text-muted-foreground">
              {cupon.fechaFin ? `Hasta ${formatDate(cupon.fechaFin)}` : 'Sin vencimiento'}
            </span>
          </div>
          {cupon.limiteUsos != null && (
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${vigente ? 'bg-[#FF7A00]' : 'bg-muted-foreground/40'}`}
                style={{ width: `${progreso}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </button>
  )
}

function Empty({ label }: { label: string }) {
  return <p className="rounded-2xl bg-muted/30 p-6 text-center text-xs text-muted-foreground">{label}</p>
}

function Disabled({ label }: { label: string }) {
  return (
    <div className="rounded-2xl bg-muted/30 p-4 text-center">
      <p className="text-xs font-medium text-foreground">{label}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">Podés activarlo desde Módulos.</p>
    </div>
  )
}

const inicialesAsociacion = (nombre: string) =>
  nombre.trim().split(/\s+/).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase()

function EmptyAssociations({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/80">
        <Users className="h-6 w-6 text-muted-foreground" />
      </div>
      <h2 className="mt-4 text-base font-semibold tracking-tight text-foreground">Actividad asociada</h2>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground leading-relaxed">
        Al seleccionar un elemento vas a ver acá sus clientes y pedidos vinculados.
      </p>
      {onClose && (
        <Button variant="ghost" size="sm" onClick={onClose} className="mt-4 rounded-full">
          Cerrar
        </Button>
      )}
    </div>
  )
}

function AssociatedOrder({
  pedido,
  cliente,
  sucursal,
}: {
  pedido: {
    id: number
    createdAt: string
    total: number | string
    sucursalId?: number | null
    montoDescuento?: number | string | null
  }
  cliente?: string
  sucursal?: string
}) {
  return (
    <div className="rounded-2xl bg-white p-3.5 shadow-2xs transition-all dark:bg-muted/20">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-tight text-foreground">Pedido #{pedido.id}</p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {cliente ?? 'Cliente sin identificar'}
            {sucursal ? ` · ${sucursal}` : ''}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground/70">{formatDate(pedido.createdAt)}</p>
        </div>
        <div className="shrink-0 text-right">
          <span className="block text-xs font-bold tabular-nums text-foreground">
            {formatCurrency(pedido.total)}
          </span>
          {pedido.montoDescuento != null && Number(pedido.montoDescuento) > 0 && (
            <span className="block text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
              -{formatCurrency(pedido.montoDescuento)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function AssociationsPanel({
  tab,
  campanaSeleccionada,
  cuponSeleccionado,
  sucursales,
  resultadoCupon,
  loading,
  onSelectClient,
  onClose,
  asociacionesCampana,
  clientesCampana,
  clientePorId,
}: {
  tab: AssetTab
  campanaSeleccionada: FiltroCampana
  cuponSeleccionado: number | null
  sucursales: SucursalGrowth[]
  resultadoCupon: ResultadoCupon | null
  loading: boolean
  onSelectClient: (id: number) => void
  onClose?: () => void
  asociacionesCampana: Array<{ cliente: ClienteGrowth; pedido: ClienteGrowth['pedidos'][number] }>
  clientesCampana: ClienteGrowth[]
  clientePorId: Map<number, ClienteGrowth>
}) {
  const sucursalPorId = useMemo(
    () => new Map(sucursales.map((item) => [item.id, item.nombre])),
    [sucursales],
  )

  if (
    (tab === 'campanas' && campanaSeleccionada == null) ||
    (tab === 'cupones' && cuponSeleccionado == null)
  ) {
    return <EmptyAssociations onClose={onClose} />
  }
  if (loading) return <LoadingDetail />

  const clientesAsociados = tab === 'campanas' ? clientesCampana : (resultadoCupon?.clientes ?? [])
  const pedidosAsociados =
    tab === 'campanas'
      ? asociacionesCampana.map(({ cliente, pedido }) => ({ cliente, pedido }))
      : (resultadoCupon?.pedidos ?? []).map((pedido) => ({
          cliente: pedido.clienteId ? clientePorId.get(pedido.clienteId) : undefined,
          pedido,
        }))

  return (
    <>
      <div className="flex items-center justify-between border-b border-border/30 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              Actividad asociada
            </h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-foreground">
              {pedidosAsociados.length}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {clientesAsociados.length} clientes · {pedidosAsociados.length} pedidos atribuibles
          </p>
        </div>
        {onClose && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full text-muted-foreground transition-colors hover:bg-muted"
            onClick={onClose}
            aria-label="Cerrar actividad"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-6 p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                Clientes
              </span>
              <span className="text-[10px] text-muted-foreground">{clientesAsociados.length}</span>
            </div>
            <div className="space-y-1.5">
              {clientesAsociados.length ? (
                clientesAsociados.map((item) => {
                  const cliente =
                    'telefono' in item && 'cantidadPedidos' in item
                      ? item
                      : clientePorId.get(item.id)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectClient(item.id)}
                      className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left transition-all hover:bg-muted/40 dark:bg-muted/20 shadow-2xs"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/80 text-xs font-semibold text-foreground">
                        {inicialesAsociacion(item.nombre)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold tracking-tight text-foreground">
                          {item.nombre}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {tab === 'cupones' && 'usos' in item
                            ? `${item.usos} ${item.usos === 1 ? 'uso' : 'usos'} · ${formatCurrency(item.facturacion)}${item.montoDescontado > 0 ? ` (ahorró ${formatCurrency(item.montoDescontado)})` : ''}`
                            : cliente
                              ? `${cliente.cantidadPedidos} pedidos · ${formatCurrency(cliente.totalGastado)}`
                              : item.telefono}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                    </button>
                  )
                })
              ) : (
                <Empty label="Todavía no hay clientes asociados." />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                Pedidos
              </span>
              <span className="text-[10px] text-muted-foreground">{pedidosAsociados.length}</span>
            </div>
            <div className="space-y-1.5">
              {pedidosAsociados.length ? (
                pedidosAsociados.map(({ cliente, pedido }) => (
                  <AssociatedOrder
                    key={pedido.id}
                    pedido={pedido}
                    cliente={cliente?.nombre}
                    sucursal={pedido.sucursalId ? sucursalPorId.get(pedido.sucursalId) : undefined}
                  />
                ))
              ) : (
                <Empty label="Todavía no hay pedidos asociados." />
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </>
  )
}

function CampaignDetail({
  organic,
  campana,
  producto,
  productos,
  resultado,
  onCopy,
  onEdit,
  onToggle,
  onDelete,
  mostrarAsociaciones,
  onToggleAsociaciones,
  actividadCount,
  username,
}: {
  organic: boolean
  campana: CampanaCrecimiento | null
  producto: ProductoGrowth | null
  productos: ProductoGrowth[]
  resultado: ResultadoCampana
  onCopy: () => void
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
  mostrarAsociaciones: boolean
  onToggleAsociaciones: () => void
  actividadCount: { clientes: number; pedidos: number }
  username?: string | null
}) {
  const m = resultado.metricas
  const visitas = organic
    ? (m.visitas ?? resultado.funnel.session_start)
    : (m.visitas ?? campana?.visitas ?? resultado.funnel.session_start)
  const conversion = visitas ? Math.round((m.pedidos / visitas) * 10_000) / 100 : 0
  const esPromocionProducto = campana?.destinoTipo === 'producto' && campana.productoId != null
  const esCarritoPrearmado = campana?.destinoTipo === 'carrito' && Boolean(campana.carritoRep)
  const status = getCampaignStatus(campana, organic)

  if (mostrarAsociaciones) {
    // VISTA COMPACTA (cuando la 3ra columna está abierta)
    return (
      <>
        <div className="flex items-start justify-between gap-3 border-b border-border/30 p-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-bold tracking-tight text-foreground sm:text-lg">
                {organic ? 'Orgánico · sin campaña' : campana?.nombre}
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background/80 px-2.5 py-0.5 text-[11px] font-medium text-foreground backdrop-blur-xs">
                <span className={`h-1.5 w-1.5 rounded-full ${status.dotColor}`} />
                {status.estado}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {organic
                ? 'Visitas directas y compras sin touch de campaña'
                : `${campana?.tipo === 'adquisicion' ? 'Adquisición' : 'Recompra'} · /c/${campana?.slug}`}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={onToggleAsociaciones}
              className="h-8 gap-1.5 rounded-full px-3 text-xs font-medium"
              title="Ocultar actividad asociada"
            >
              <Users className="h-3.5 w-3.5" />
              <span>Ocultar actividad</span>
            </Button>
            {!organic && campana && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-full text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
                onClick={onDelete}
                aria-label="Eliminar campaña"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-6 px-4 pb-8 sm:px-6">
            {/* Métricas flotantes compactas */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-border/30 py-3.5 sm:grid-cols-3">
              <CompactMetric label="Ventas" value={formatCurrency(m.ventas)} />
              <CompactMetric label="Pedidos" value={m.pedidos} />
              <CompactMetric label="Ticket prom." value={formatCurrency(m.ticketPromedio)} />
              <CompactMetric label={organic ? 'Visitas directas' : 'Visitas link'} value={visitas} />
              <CompactMetric label="Conversión" value={`${conversion}%`} />
              <CompactMetric label="Nuevos" value={m.clientesNuevos} />
            </div>

            {/* Embudo */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                Recorrido del embudo
              </span>
              <div className="divide-y divide-border/25 border-y border-border/25">
                <div className="flex items-center justify-between py-2 text-xs">
                  <span className="text-muted-foreground">
                    {organic ? 'Llegaron directo' : 'Visitaron el link'}
                  </span>
                  <span className="font-semibold tabular-nums text-foreground">{visitas}</span>
                </div>
                <div className="flex items-center justify-between py-2 text-xs">
                  <span className="text-muted-foreground">Compraron</span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {resultado.funnel.purchase} ({conversion}%)
                  </span>
                </div>
                {esPromocionProducto && (
                  <div className="flex items-center justify-between py-2 text-xs">
                    <span className="text-muted-foreground">Sumaron otros productos</span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {resultado.funnel.add_other_product ?? 0}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Configuración */}
            {!organic && campana && (
              <div className="space-y-5">
                <CampaignExplanation
                  nombre={campana.nombre}
                  modalidad={esPromocionProducto ? 'producto' : esCarritoPrearmado ? 'carrito' : 'seguimiento'}
                  productoId={campana.productoId}
                  carritoRep={campana.carritoRep}
                  descuentoProductoPorcentaje={campana.descuentoProductoPorcentaje}
                  limiteUsos={campana.limiteUsos}
                  usosActuales={campana.usosActuales}
                  estado={campana.estado}
                  fechaInicio={campana.fechaInicio}
                  fechaFin={campana.fechaFin}
                  productos={productos}
                  compact
                />
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    Configuración
                  </span>
                  <div className="divide-y divide-border/25 border-y border-border/25 text-xs">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-muted-foreground">Modalidad</span>
                    <span className="font-medium text-foreground">
                      {esPromocionProducto
                        ? 'Promoción de producto'
                        : esCarritoPrearmado
                          ? 'Carrito prearmado'
                          : 'Link de seguimiento'}
                    </span>
                  </div>
                  {esPromocionProducto && (
                    <>
                      <div className="flex items-center justify-between py-2">
                        <span className="text-muted-foreground">Producto</span>
                        <span className="font-medium text-foreground">
                          {producto?.nombre ?? `#${campana.productoId}`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2">
                        <span className="text-muted-foreground">Oferta</span>
                        <span className="font-medium text-foreground">
                          {campana.descuentoProductoPorcentaje > 0
                            ? `${campana.descuentoProductoPorcentaje}% OFF`
                            : 'Sin descuento'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2">
                        <span className="text-muted-foreground">Cupo</span>
                        <span className="font-medium text-foreground">
                          {campana.limiteUsos == null
                            ? 'Sin límite'
                            : `${campana.usosActuales}/${campana.limiteUsos}`}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-between py-2">
                    <span className="text-muted-foreground">Vigencia</span>
                    <span className="text-foreground">
                      {campana.fechaInicio ? formatDate(campana.fechaInicio) : 'Desde ahora'} —{' '}
                      {campana.fechaFin ? formatDate(campana.fechaFin) : 'Sin fin'}
                    </span>
                  </div>
                  </div>
                </div>

                {/* Acciones */}
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <Button size="sm" variant="outline" className="rounded-full text-xs" onClick={onCopy}>
                    <Copy className="mr-1 h-3 w-3" />
                    Copiar
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-full text-xs" onClick={onEdit}>
                    <Pencil className="mr-1 h-3 w-3" />
                    Editar
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-full text-xs" onClick={onToggle}>
                    {campana.estado === 'activa' ? 'Pausar' : 'Activar'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </>
    )
  }

  // VISTA AMPLIA (cuando la 3ra columna está oculta)
  return (
    <>
      <div className="flex items-start justify-between gap-4 p-5 sm:px-8">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-muted/80 text-foreground">
            {organic ? <Globe2 className="h-7 w-7 text-[#FF7A00]" /> : <Megaphone className="h-7 w-7 text-[#FF7A00]" />}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="truncate text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {organic ? 'Orgánico · sin campaña' : campana?.nombre}
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background/80 px-3 py-0.5 text-xs font-medium text-foreground backdrop-blur-xs">
                <span className={`h-1.5 w-1.5 rounded-full ${status.dotColor}`} />
                {status.estado}
              </span>
              {!organic && campana && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-muted-foreground capitalize">
                  {campana.tipo}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground/80">
              {organic
                ? 'Personas que llegaron directamente a la tienda, sin Smart Link ni receta atribuible.'
                : `Smart Link directo · /c/${campana?.slug}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleAsociaciones}
            className="h-8.5 gap-2 rounded-full border-border/60 px-4 text-xs font-medium shadow-2xs transition-colors hover:bg-muted/50"
          >
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Ver actividad</span>
            <span className="ml-0.5 rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-semibold text-foreground">
              {actividadCount.pedidos}
            </span>
          </Button>

          {!organic && campana && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onCopy}
                className="h-8.5 gap-1.5 rounded-full border-border/60 px-3.5 text-xs font-medium shadow-2xs transition-colors hover:bg-muted/50"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Copiar link</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onEdit}
                className="h-8.5 gap-1.5 rounded-full border-border/60 px-3.5 text-xs font-medium shadow-2xs transition-colors hover:bg-muted/50"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>Editar</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onToggle}
                className="h-8.5 gap-1.5 rounded-full border-border/60 px-3.5 text-xs font-medium shadow-2xs transition-colors hover:bg-muted/50"
              >
                {campana.estado === 'activa' ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                <span>{campana.estado === 'activa' ? 'Desactivar' : 'Activar'}</span>
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8.5 w-8.5 rounded-full text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
                onClick={onDelete}
                aria-label="Eliminar campaña"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-8 px-6 pb-12 sm:px-8">
          {/* Métricas flotantes de ancho completo */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 border-y border-border/30 py-5 sm:grid-cols-3 lg:grid-cols-6">
            <FloatingMetric label="Ventas cobradas" value={formatCurrency(m.ventas)} />
            <FloatingMetric label="Pedidos cobrados" value={m.pedidos} />
            <FloatingMetric label="Ticket promedio" value={formatCurrency(m.ticketPromedio)} />
            <FloatingMetric label={organic ? 'Visitas directas' : 'Visitas al link'} value={visitas} />
            <FloatingMetric label="Conversión" value={`${conversion}%`} sublabel="visita → compra" />
            <FloatingMetric label="Clientes nuevos" value={m.clientesNuevos} />
          </div>

          {/* Distribución en 2 columnas: Embudo/Link a la izq, Configuración/Condiciones a la der */}
          <div className="grid grid-cols-1 gap-8 items-start lg:grid-cols-12 lg:gap-12">
            {/* Columna Principal: Embudo y Smart Link */}
            <div className="space-y-8 lg:col-span-7">
              {/* Embudo */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                    Recorrido del embudo
                  </span>
                </div>
                <p className="text-sm font-normal leading-relaxed text-foreground/85">
                  {esPromocionProducto
                    ? '“Otros productos” cuenta pedidos cobrados que incluyeron el producto de la promo y, además, otro producto del menú.'
                    : esCarritoPrearmado
                      ? 'El link abre el carrito con los productos, variantes y extras configurados; el cliente puede revisarlo antes de comprar.'
                      : 'El link abre la tienda normal: no modifica productos, precios ni descuentos, y atribuye visitas y ventas.'}
                </p>

                <div className="divide-y divide-border/25 border-y border-border/25 pt-1">
                  <div className="flex items-center justify-between py-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground">
                        1. {organic ? 'Visitas directas a la tienda' : 'Visitaron el Smart Link'}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Punto de entrada a la tienda</p>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-bold tabular-nums text-foreground">{visitas}</span>
                      <span className="ml-2 text-[11px] font-medium text-muted-foreground">100%</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground">2. Completaron la compra</p>
                      <p className="text-[11px] text-muted-foreground">Pedidos cobrados con éxito</p>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-bold tabular-nums text-foreground">{resultado.funnel.purchase}</span>
                      <span className="ml-2 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        {conversion}%
                      </span>
                    </div>
                  </div>

                  {esPromocionProducto && (
                    <div className="flex items-center justify-between py-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground">3. Sumaron otros productos</p>
                        <p className="text-[11px] text-muted-foreground">
                          Cross-selling: pedidos cobrados con la promo + otros ítems
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-base font-bold tabular-nums text-foreground">
                          {resultado.funnel.add_other_product ?? 0}
                        </span>
                        {resultado.funnel.purchase > 0 && (
                          <span className="ml-2 text-[11px] font-medium text-muted-foreground">
                            {Math.round(((resultado.funnel.add_other_product ?? 0) / resultado.funnel.purchase) * 100)}%
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Smart Link Card */}
              {!organic && campana && (
                <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-primary/[0.03] p-5 transition-all dark:bg-primary/[0.06]">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <Globe2 className="h-4 w-4 shrink-0 text-primary" />
                        <span className="text-sm font-semibold tracking-tight text-foreground">
                          Smart Link de campaña
                        </span>
                      </div>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        https://my.piru.app/{username ?? 'tu-local'}/c/{campana.slug}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={onCopy}
                      className="shrink-0 rounded-full px-4 text-xs font-medium shadow-2xs"
                    >
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      Copiar link
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Columna Secundaria: Configuración y condiciones */}
            <div className="space-y-6 lg:col-span-5">
              {!organic && campana && (
                <CampaignExplanation
                  nombre={campana.nombre}
                  modalidad={esPromocionProducto ? 'producto' : esCarritoPrearmado ? 'carrito' : 'seguimiento'}
                  productoId={campana.productoId}
                  carritoRep={campana.carritoRep}
                  descuentoProductoPorcentaje={campana.descuentoProductoPorcentaje}
                  limiteUsos={campana.limiteUsos}
                  usosActuales={campana.usosActuales}
                  estado={campana.estado}
                  fechaInicio={campana.fechaInicio}
                  fechaFin={campana.fechaFin}
                  productos={productos}
                />
              )}
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Configuración y condiciones
                </span>
                <div className="divide-y divide-border/25 border-y border-border/25">
                  <div className="flex items-center justify-between py-2.5 text-xs">
                    <span className="text-muted-foreground">Destino</span>
                    <span className="text-right font-medium text-foreground">
                      {esPromocionProducto
                        ? 'Promoción de producto'
                        : esCarritoPrearmado
                          ? 'Carrito prearmado'
                          : 'Link de seguimiento'}
                    </span>
                  </div>
                  {esPromocionProducto && (
                    <>
                      <div className="flex items-center justify-between py-2.5 text-xs">
                        <span className="text-muted-foreground">Producto</span>
                        <span className="text-right font-medium text-foreground">
                          {producto?.nombre ?? `#${campana?.productoId}`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2.5 text-xs">
                        <span className="text-muted-foreground">Descuento</span>
                        <span className="text-right font-medium text-foreground">
                          {campana && campana.descuentoProductoPorcentaje > 0
                            ? `${campana.descuentoProductoPorcentaje}% OFF en este producto`
                            : 'Producto destacado sin descuento'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2.5 text-xs">
                        <span className="text-muted-foreground">Cupo de compras</span>
                        <span className="text-right font-medium text-foreground">
                          {campana?.limiteUsos == null
                            ? 'Sin límite'
                            : `${campana.usosActuales}/${campana.limiteUsos} compras`}
                        </span>
                      </div>
                    </>
                  )}
                  {!organic && campana && (
                    <>
                      <div className="flex items-center justify-between py-2.5 text-xs">
                        <span className="text-muted-foreground">Vigencia</span>
                        <span className="text-right font-medium text-foreground">
                          {campana.fechaInicio ? formatDate(campana.fechaInicio) : 'Desde ahora'} —{' '}
                          {campana.fechaFin ? formatDate(campana.fechaFin) : 'Sin vencimiento'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2.5 text-xs">
                        <span className="text-muted-foreground">Tipo de campaña</span>
                        <span className="text-right font-medium text-foreground capitalize">
                          {campana.tipo}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2.5 text-xs">
                        <span className="text-muted-foreground">Fecha de creación</span>
                        <span className="text-right font-medium text-foreground">
                          {formatDate(campana.createdAt)}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-between py-2.5 text-xs">
                    <span className="text-muted-foreground">Ventana de atribución</span>
                    <span className="text-right font-medium text-foreground">30 días por cookie</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </>
  )
}

function CouponDetail({
  cupon,
  resultado,
  onCopy,
  onEdit,
  onToggle,
  onDelete,
  mostrarAsociaciones,
  onToggleAsociaciones,
  actividadCount,
}: {
  cupon: CodigoDescuentoGrowth
  resultado: ResultadoCupon
  onCopy: () => void
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
  mostrarAsociaciones: boolean
  onToggleAsociaciones: () => void
  actividadCount: { clientes: number; pedidos: number }
}) {
  const m = resultado.metricas
  const { vigente, estado, dotColor } = getCouponStatus(cupon)
  const beneficio =
    cupon.tipo === 'porcentaje' ? `${Number(cupon.valor)}% OFF` : `${formatCurrency(cupon.valor)} OFF`

  if (mostrarAsociaciones) {
    // VISTA COMPACTA
    return (
      <>
        <div className="flex items-start justify-between gap-3 border-b border-border/30 p-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-mono text-base font-bold tracking-tight text-foreground sm:text-lg">
                {cupon.codigo}
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background/80 px-2.5 py-0.5 text-[11px] font-medium text-foreground backdrop-blur-xs">
                <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                {estado}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {beneficio}
              {Number(cupon.montoMinimo) > 0 ? ` · mín. ${formatCurrency(cupon.montoMinimo)}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={onCopy}
              title="Copiar código"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onToggleAsociaciones}
              className="h-8 gap-1.5 rounded-full px-3 text-xs font-medium"
              title="Ocultar actividad asociada"
            >
              <Users className="h-3.5 w-3.5" />
              <span>Ocultar actividad</span>
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-full text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
              onClick={onDelete}
              aria-label="Eliminar cupón"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-6 px-4 pb-8 sm:px-6">
            {/* Métricas compactas */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-border/30 py-3.5 sm:grid-cols-3">
              <CompactMetric label="Facturación" value={formatCurrency(m.facturacionCobrada)} />
              <CompactMetric label="Descontado" value={formatCurrency(m.montoDescontado)} />
              <CompactMetric label="Usos" value={m.usos} />
              <CompactMetric label="Clientes" value={m.clientes} />
              <CompactMetric label="Venta bruta" value={formatCurrency(m.ventasAntesDescuento)} />
              <CompactMetric label="Ticket prom." value={formatCurrency(m.ticketPromedio)} />
            </div>

            <CouponExplanation
              codigo={cupon.codigo}
              tipo={cupon.tipo}
              valor={cupon.valor}
              limiteUsos={cupon.limiteUsos}
              usosActuales={cupon.usosActuales}
              montoMinimo={cupon.montoMinimo}
              fechaInicio={cupon.fechaInicio}
              fechaFin={cupon.fechaFin}
              activo={cupon.activo}
              compact
            />

            {/* Consumo de cupo */}
            {cupon.limiteUsos != null && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Consumo de cupo</span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {cupon.usosActuales} / {cupon.limiteUsos}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${vigente ? 'bg-[#FF7A00]' : 'bg-muted-foreground/40'}`}
                    style={{
                      width: `${Math.min(100, (cupon.usosActuales / cupon.limiteUsos) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Condiciones */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                Condiciones
              </span>
              <div className="divide-y divide-border/25 border-y border-border/25 text-xs">
                <div className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">Monto mínimo</span>
                  <span className="font-medium text-foreground">
                    {Number(cupon.montoMinimo) > 0 ? formatCurrency(cupon.montoMinimo) : 'Sin mínimo'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">Vigencia</span>
                  <span className="text-foreground">
                    {cupon.fechaInicio ? formatDate(cupon.fechaInicio) : 'Sin inicio'} —{' '}
                    {cupon.fechaFin ? formatDate(cupon.fechaFin) : 'Sin vencimiento'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">Creado</span>
                  <span className="text-foreground">{formatDate(cupon.createdAt)}</span>
                </div>
              </div>

              {/* Botones */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button size="sm" variant="outline" className="rounded-full text-xs" onClick={onEdit}>
                  <Pencil className="mr-1 h-3 w-3" />
                  Editar
                </Button>
                <Button size="sm" variant="outline" className="rounded-full text-xs" onClick={onToggle}>
                  {cupon.activo ? 'Desactivar' : 'Activar'}
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>
      </>
    )
  }

  // VISTA AMPLIA
  return (
    <>
      <div className="flex items-start justify-between gap-4 p-5 sm:px-8">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-muted/80 text-foreground">
            <Tag className="h-7 w-7 text-[#FF7A00]" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="truncate font-mono text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {cupon.codigo}
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background/80 px-3 py-0.5 text-xs font-medium text-foreground backdrop-blur-xs">
                <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                {estado}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-foreground">
                {beneficio}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground/80">
              {cupon.limiteUsos == null
                ? 'Cupón con usos ilimitados'
                : `${cupon.usosActuales} de ${cupon.limiteUsos} usos registrados`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleAsociaciones}
            className="h-8.5 gap-2 rounded-full border-border/60 px-4 text-xs font-medium shadow-2xs transition-colors hover:bg-muted/50"
          >
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Ver actividad</span>
            <span className="ml-0.5 rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-semibold text-foreground">
              {actividadCount.pedidos}
            </span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onCopy}
            className="h-8.5 gap-1.5 rounded-full border-border/60 px-3.5 text-xs font-medium shadow-2xs transition-colors hover:bg-muted/50"
          >
            <Copy className="h-3.5 w-3.5" />
            <span>Copiar</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="h-8.5 gap-1.5 rounded-full border-border/60 px-3.5 text-xs font-medium shadow-2xs transition-colors hover:bg-muted/50"
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>Editar</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onToggle}
            className="h-8.5 gap-1.5 rounded-full border-border/60 px-3.5 text-xs font-medium shadow-2xs transition-colors hover:bg-muted/50"
          >
            {cupon.activo ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
            <span>{cupon.activo ? 'Desactivar' : 'Activar'}</span>
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8.5 w-8.5 rounded-full text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
            onClick={onDelete}
            aria-label="Eliminar cupón"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-8 px-6 pb-12 sm:px-8">
          {/* Métricas flotantes de ancho completo */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 border-y border-border/30 py-5 sm:grid-cols-3 lg:grid-cols-6">
            <FloatingMetric label="Facturación cobrada" value={formatCurrency(m.facturacionCobrada)} />
            <FloatingMetric label="Pesos descontados" value={formatCurrency(m.montoDescontado)} />
            <FloatingMetric label="Usos cobrados" value={m.usos} />
            <FloatingMetric label="Clientes únicos" value={m.clientes} />
            <FloatingMetric label="Venta antes de desc." value={formatCurrency(m.ventasAntesDescuento)} />
            <FloatingMetric label="Ticket promedio" value={formatCurrency(m.ticketPromedio)} />
          </div>

          {/* Distribución en 2 columnas: Rendimiento a la izq, Condiciones a la der */}
          <div className="grid grid-cols-1 gap-8 items-start lg:grid-cols-12 lg:gap-12">
            {/* Columna Principal: Consumo de cupo y Retorno */}
            <div className="space-y-8 lg:col-span-7">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                    Consumo y utilización
                  </span>
                </div>
                <p className="text-sm font-normal leading-relaxed text-foreground/85">
                  {cupon.limiteUsos != null
                    ? `Se consumieron ${cupon.usosActuales} de ${cupon.limiteUsos} usos disponibles (${Math.min(100, Math.round((cupon.usosActuales / cupon.limiteUsos) * 100))}%).`
                    : `El cupón no tiene límite de usos fijado; lleva ${cupon.usosActuales} usos cobrados en total.`}
                </p>

                {cupon.limiteUsos != null && (
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Progreso de consumo</span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {cupon.usosActuales} / {cupon.limiteUsos} usos
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all ${
                          cupon.activo ? 'bg-[#FF7A00]' : 'bg-muted-foreground/40'
                        }`}
                        style={{
                          width: `${Math.min(100, (cupon.usosActuales / cupon.limiteUsos) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Retorno financiero */}
              <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5 transition-all dark:bg-emerald-500/[0.07]">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-sm font-semibold tracking-tight text-foreground">
                      Retorno y rendimiento financiero
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Este cupón generó <strong className="text-foreground">{formatCurrency(m.facturacionCobrada)}</strong> en facturación cobrada a cambio de <strong className="text-foreground">{formatCurrency(m.montoDescontado)}</strong> otorgados en beneficio a los clientes.
                  </p>
                </div>
              </div>
            </div>

            {/* Columna Secundaria: Condiciones */}
            <div className="space-y-6 lg:col-span-5">
              <CouponExplanation
                codigo={cupon.codigo}
                tipo={cupon.tipo}
                valor={cupon.valor}
                limiteUsos={cupon.limiteUsos}
                usosActuales={cupon.usosActuales}
                montoMinimo={cupon.montoMinimo}
                fechaInicio={cupon.fechaInicio}
                fechaFin={cupon.fechaFin}
                activo={cupon.activo}
              />
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Condiciones y vigencia
                </span>
                <div className="divide-y divide-border/25 border-y border-border/25">
                  <div className="flex items-center justify-between py-2.5 text-xs">
                    <span className="text-muted-foreground">Beneficio</span>
                    <span className="text-right font-medium text-foreground">
                      {cupon.tipo === 'porcentaje' ? `${Number(cupon.valor)}% OFF` : `${formatCurrency(cupon.valor)} OFF`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2.5 text-xs">
                    <span className="text-muted-foreground">Compra mínima</span>
                    <span className="text-right font-medium text-foreground">
                      {Number(cupon.montoMinimo) > 0 ? formatCurrency(cupon.montoMinimo) : 'Sin compra mínima'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2.5 text-xs">
                    <span className="text-muted-foreground">Límite de usos</span>
                    <span className="text-right font-medium text-foreground">
                      {cupon.limiteUsos == null ? 'Sin límite' : `${cupon.limiteUsos} usos`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2.5 text-xs">
                    <span className="text-muted-foreground">Vigencia</span>
                    <span className="text-right font-medium text-foreground">
                      {cupon.fechaInicio ? formatDate(cupon.fechaInicio) : 'Sin inicio'} —{' '}
                      {cupon.fechaFin ? formatDate(cupon.fechaFin) : 'Sin vencimiento'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2.5 text-xs">
                    <span className="text-muted-foreground">Fecha de creación</span>
                    <span className="text-right font-medium text-foreground">
                      {formatDate(cupon.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </>
  )
}

function CampaignExplanation({
  nombre,
  modalidad,
  productoId,
  carritoRep,
  descuentoProductoPorcentaje,
  limiteUsos,
  usosActuales,
  estado,
  fechaInicio,
  fechaFin,
  productos,
  compact = false,
}: {
  nombre?: string
  modalidad: FormCampana['modalidad']
  productoId?: string | number | null
  carritoRep?: string | null
  descuentoProductoPorcentaje?: string | number | null
  limiteUsos?: string | number | null
  usosActuales?: number
  estado: CampanaCrecimiento['estado']
  fechaInicio?: string | null
  fechaFin?: string | null
  productos: ProductoGrowth[]
  compact?: boolean
}) {
  const productoIdNormalizado = productoId == null || productoId === '' ? null : Number(productoId)
  const producto = productoIdNormalizado == null ? null : productos.find((item) => item.id === productoIdNormalizado) ?? null
  const descuento = Number(descuentoProductoPorcentaje || 0)
  const limite = limiteUsos == null || limiteUsos === '' ? null : Number(limiteUsos)
  const carrito = modalidad === 'carrito' ? parseCarritoPrearmado(carritoRep ?? '') : []
  const nombresCarrito = carrito.map((item) => {
    const itemProducto = productos.find((actual) => actual.id === item.productoId)
    return `${item.cantidad} × ${itemProducto?.nombre ?? `Producto #${item.productoId}`}`
  })
  const resumenCarrito = nombresCarrito.length
    ? `${nombresCarrito.slice(0, 3).join(', ')}${nombresCarrito.length > 3 ? ` y ${nombresCarrito.length - 3} más` : ''}`
    : null

  const titulo = modalidad === 'producto'
    ? producto
      ? `${producto.nombre}, en primer plano`
      : 'Una promoción enfocada en un producto'
    : modalidad === 'carrito'
      ? carrito.length
        ? `Un carrito con ${carrito.length} ${carrito.length === 1 ? 'producto' : 'productos'} listo para comprar`
        : 'Un carrito listo para completar'
      : 'Un link para saber qué canal genera ventas'

  const introduccion = modalidad === 'producto'
    ? producto
      ? `Quien abra el link encontrará ${producto.nombre} destacado${descuento > 0 ? ` con ${descuento}% OFF` : ', sin cambiar su precio'}. El resto del menú seguirá disponible.`
      : 'Cuando elijas el producto, el link lo abrirá destacado dentro del menú y Piru medirá las compras que genere.'
    : modalidad === 'carrito'
      ? resumenCarrito
        ? `El cliente recibirá ${resumenCarrito} dentro del carrito. Podrá revisar la selección, modificarla y completar su pedido.`
        : 'Cuando agregues productos, el link abrirá el carrito con esa selección preparada para que el cliente sólo la revise y compre.'
      : 'El cliente entrará a la tienda normal, sin cambios en productos ni precios. Piru identificará las visitas y ventas que lleguen desde este link.'

  const pasoCliente = modalidad === 'producto'
    ? producto
      ? `Ve ${producto.nombre} destacado${descuento > 0 ? ` y obtiene ${descuento}% OFF en ese producto` : ''}.`
      : 'Ve el producto que elijas destacado dentro del menú.'
    : modalidad === 'carrito'
      ? resumenCarrito
        ? `Encuentra el carrito preparado con ${resumenCarrito}.`
        : 'Encuentra el carrito con la selección que prepares.'
      : 'Recorre el menú y compra como siempre.'

  const estadoTexto = estado === 'activa'
    ? 'Activa: el link puede recibir visitas durante su vigencia.'
    : estado === 'borrador'
      ? 'Borrador: el link no estará disponible hasta que actives la campaña.'
      : 'Inactiva: conserva sus resultados, pero el link no recibe nuevas visitas.'
  const vigencia = `${fechaInicio ? `Desde ${formatDate(fechaInicio)}` : 'Disponible desde ahora'} · ${fechaFin ? `hasta ${formatDate(fechaFin)}` : 'sin vencimiento'}`

  return (
    <section className={compact ? 'space-y-5' : 'space-y-7'}>
      <header>
        <p className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-muted-foreground`}>
          {nombre?.trim() ? `Cómo funciona “${nombre.trim()}”` : 'Cómo funcionará esta campaña'}
        </p>
        <h3 className={`${compact ? 'mt-1.5 text-lg' : 'mt-2 text-2xl'} font-semibold leading-tight tracking-tight text-foreground`}>
          {titulo}
        </h3>
        <p className={`${compact ? 'mt-2 text-sm' : 'mt-3 text-base'} leading-relaxed text-muted-foreground`}>{introduccion}</p>
      </header>

      <div className={`${compact ? 'space-y-4' : 'space-y-5'}`}>
        <div>
          <h4 className={`${compact ? 'text-sm' : 'text-base'} font-medium text-foreground`}>Compartís el link</h4>
          <p className={`${compact ? 'mt-1 text-xs' : 'mt-1.5 text-sm'} leading-relaxed text-muted-foreground`}>Podés usarlo en redes, historias, mensajes o piezas impresas.</p>
        </div>
        <div>
          <h4 className={`${compact ? 'text-sm' : 'text-base'} font-medium text-foreground`}>El cliente abre la campaña</h4>
          <p className={`${compact ? 'mt-1 text-xs' : 'mt-1.5 text-sm'} leading-relaxed text-muted-foreground`}>{pasoCliente}</p>
        </div>
        <div>
          <h4 className={`${compact ? 'text-sm' : 'text-base'} font-medium text-foreground`}>Piru mide el resultado</h4>
          <p className={`${compact ? 'mt-1 text-xs' : 'mt-1.5 text-sm'} leading-relaxed text-muted-foreground`}>Las visitas y los pedidos cobrados quedan atribuidos a esta campaña durante 30 días.</p>
        </div>
      </div>

      <div className={`${compact ? 'space-y-1.5 text-xs' : 'space-y-2 text-sm'} text-muted-foreground`}>
        <h4 className={`${compact ? 'text-sm' : 'text-base'} font-medium text-foreground`}>Condiciones</h4>
        {modalidad === 'producto' && <p><span className="font-medium text-foreground">Beneficio:</span> {descuento > 0 ? `${descuento}% OFF sólo en el producto.` : 'Producto destacado sin descuento.'}</p>}
        {modalidad === 'producto' && <p><span className="font-medium text-foreground">Cupo:</span> {limite == null ? 'sin límite de compras.' : usosActuales == null ? `${limite} compras.` : `${usosActuales} de ${limite} compras usadas.`}</p>}
        <p><span className="font-medium text-foreground">Vigencia:</span> {vigencia}.</p>
        <p>{estadoTexto}</p>
      </div>
    </section>
  )
}

function CampanaDialog({ open, onOpenChange, editando, form, setForm, productos, error, saving, onSave, username }: { open: boolean; onOpenChange: (open: boolean) => void; editando: CampanaCrecimiento | null; form: FormCampana; setForm: React.Dispatch<React.SetStateAction<FormCampana>>; productos: ProductoGrowth[]; error: string; saving: boolean; onSave: () => void; username?: string | null }) {
  const set = <K extends keyof FormCampana>(key: K, value: FormCampana[K]) => setForm((actual) => ({ ...actual, [key]: value }))
  const esPromocionProducto = form.modalidad === 'producto'
  const esCarritoPrearmado = form.modalidad === 'carrito'
  // Recetas, audiencias, carrito precargado, cupones, inversión, UTMs y grupo
  // de control quedan fuera de la UI hasta que cada flujo se reincorpore con
  // pruebas. El backend conserva esos campos por retrocompatibilidad.
  const cambiarModalidad = (modalidad: FormCampana['modalidad']) => setForm((actual) => ({
    ...actual, modalidad,
    productoId: modalidad === 'producto' ? actual.productoId : '',
    carritoRep: modalidad === 'carrito' ? actual.carritoRep : '',
    descuentoProductoPorcentaje: modalidad === 'producto' ? actual.descuentoProductoPorcentaje : '',
    limiteUsos: modalidad === 'producto' ? actual.limiteUsos : '',
  }))
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] w-[96vw] overflow-y-auto p-0 sm:max-w-6xl">
        <div className="grid min-h-0 md:grid-cols-[minmax(0,1.15fr)_minmax(400px,0.85fr)]">
          <div className="flex min-w-0 flex-col p-6 sm:p-8">
            <DialogHeader>
              <DialogTitle className="text-2xl">{editando ? 'Editar campaña' : 'Nueva campaña'}</DialogTitle>
              <DialogDescription className="text-sm">Configurá el Smart Link. La explicación se actualiza a medida que completás la campaña.</DialogDescription>
            </DialogHeader>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <FieldSelect label="Tipo de campaña" value={form.modalidad} onValueChange={(v) => cambiarModalidad(v as FormCampana['modalidad'])} options={[["seguimiento", "Link de seguimiento"], ["producto", "Promoción de producto"], ["carrito", "Carrito prearmado"]]} />
              <div className="hidden sm:block" />
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Nombre de la campaña</Label>
                <Input placeholder={esPromocionProducto ? 'Promo Smash' : esCarritoPrearmado ? 'Combo para compartir' : 'Instagram septiembre'} value={form.nombre} onChange={(e) => { const nombre = e.target.value; setForm((actual) => ({ ...actual, nombre, slug: editando ? actual.slug : slug(nombre) })) }} />
              </div>
              {esPromocionProducto && (
                <>
                  <FieldSelect label="Producto en oferta" value={form.productoId || 'ninguno'} onValueChange={(v) => set('productoId', v === 'ninguno' ? '' : v)} options={[["ninguno", "Elegí un producto"], ...productos.map((p) => [String(p.id), p.nombre] as [string, string])]} />
                  <div className="space-y-1.5">
                    <Label>Descuento en ese producto</Label>
                    <div className="relative">
                      <Input type="number" min="0" max="100" placeholder="0" value={form.descuentoProductoPorcentaje} onChange={(e) => set('descuentoProductoPorcentaje', e.target.value)} />
                      <span className="pointer-events-none absolute right-3 top-2.5 text-sm text-muted-foreground">%</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Opcional. No descuenta los demás productos.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cupo de compras</Label>
                    <Input type="number" min="1" placeholder="Sin límite" value={form.limiteUsos} onChange={(e) => set('limiteUsos', e.target.value)} />
                  </div>
                </>
              )}
              {esCarritoPrearmado && <CarritoPrearmadoBuilder productos={productos} value={form.carritoRep} onChange={(valor) => set('carritoRep', valor)} />}
              <FieldSelect label="Estado" value={form.estado} onValueChange={(v) => set('estado', v as FormCampana['estado'])} options={[["activa", "Activa"], ["borrador", "Borrador"], ["inactiva", "Inactiva"]]} />
              <div className="space-y-1.5">
                <Label>Disponible desde</Label>
                <Input type="datetime-local" value={form.fechaInicio} onChange={(e) => set('fechaInicio', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Disponible hasta</Label>
                <Input type="datetime-local" value={form.fechaFin} onChange={(e) => set('fechaFin', e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Link de campaña</Label>
                <Input disabled value={`my.piru.app/${username ?? 'tu-local'}/c/${form.slug || 'campana'}`} />
                <p className="text-[11px] text-muted-foreground">La dirección queda fija después de crearla para no perder la medición.</p>
              </div>
              {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive sm:col-span-2">{error}</p>}
            </div>

            <DialogFooter className="mt-6">
              <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button disabled={saving} onClick={onSave}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editando ? 'Guardar cambios' : 'Crear campaña'}</Button>
            </DialogFooter>
          </div>

          <aside className="border-t border-border/40 p-6 sm:p-8 md:border-l md:border-t-0 md:p-10">
            <div className="md:sticky md:top-0">
              <CampaignExplanation
                nombre={form.nombre}
                modalidad={form.modalidad}
                productoId={form.productoId}
                carritoRep={form.carritoRep}
                descuentoProductoPorcentaje={form.descuentoProductoPorcentaje}
                limiteUsos={form.limiteUsos}
                estado={form.estado}
                fechaInicio={form.fechaInicio}
                fechaFin={form.fechaFin}
                productos={productos}
              />
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  )

  /* Implementación anterior pausada: se conserva en el archivo para reactivar
     capacidades de a una, sin volver a inventar su composición visual.
  const recetaElegida = RECETAS.find((item) => item.codigo === form.recetaCodigo)
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{editando ? 'Editar campaña' : 'Nueva campaña'}</DialogTitle><DialogDescription>El Smart Link abre el destino elegido, conserva la atribución y aplica el beneficio en el checkout.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5 sm:col-span-2"><Label>Nombre</Label><Input value={form.nombre} onChange={(e) => { const nombre = e.target.value; setForm((actual) => ({ ...actual, nombre, slug: editando ? actual.slug : slug(nombre) })) }} /></div><div className="space-y-1.5"><Label>Dirección del link</Label><Input disabled={Boolean(editando)} value={form.slug} onChange={(e) => set('slug', slug(e.target.value))} /><p className="text-[11px] text-muted-foreground">my.piru.app/{username ?? 'tu-local'}/c/{form.slug || 'campana'}</p></div><FieldSelect label="Estado" value={form.estado} onValueChange={(v) => set('estado', v as FormCampana['estado'])} options={[['borrador', 'Borrador'], ['activa', 'Activa'], ['inactiva', 'Inactiva']]} /><FieldSelect label="Tipo" value={form.tipo} onValueChange={(v) => set('tipo', v as FormCampana['tipo'])} options={[['adquisicion', 'Adquisición'], ['recompra', 'Recompra']]} /><FieldSelect label="Receta" value={form.recetaCodigo || 'ninguna'} onValueChange={(v) => set('recetaCodigo', v === 'ninguna' ? '' : v)} options={[['ninguna', 'Sin receta'], ...RECETAS.map((r) => [r.codigo, `${r.nombre}${r.descuentoPorcentaje ? ` · ${r.descuentoPorcentaje}% OFF` : ''}`] as [string, string])]} /><FieldSelect label="Al abrir el link" value={form.destinoTipo} onValueChange={(v) => set('destinoTipo', v as FormCampana['destinoTipo'])} options={[['tienda', 'Mostrar la tienda'], ['producto', 'Abrir un producto'], ['carrito', 'Dejar un carrito listo']]} />{form.destinoTipo === 'producto' && <FieldSelect label="Producto" value={form.productoId || 'ninguno'} onValueChange={(v) => set('productoId', v === 'ninguno' ? '' : v)} options={[['ninguno', 'Elegí un producto'], ...productos.map((p) => [String(p.id), p.nombre] as [string, string])]} />}{form.destinoTipo === 'carrito' && <CarritoBuilder productos={productos} value={form.carritoRep} onChange={(value) => set('carritoRep', value)} />}<FieldSelect label="Cupón" value={form.codigoDescuentoId || 'ninguno'} onValueChange={(v) => set('codigoDescuentoId', v === 'ninguno' ? '' : v)} options={[['ninguno', recetaElegida?.descuentoPorcentaje ? `Crear automáticamente ${recetaElegida.descuentoPorcentaje}% OFF` : 'Sin cupón'], ...cupones.filter((c) => c.activo).map((c) => [String(c.id), `${c.codigo} · ${c.tipo === 'porcentaje' ? `${Number(c.valor)}%` : formatCurrency(c.valor)}`] as [string, string])]} /><div className="space-y-1.5"><Label>Inversión manual</Label><Input type="number" min="0" value={form.inversionManual} onChange={(e) => set('inversionManual', e.target.value)} /></div><div className="space-y-1.5 sm:col-span-2"><Label>UTM avanzadas</Label><div className="grid gap-2 sm:grid-cols-2"><Input placeholder="utm_source" value={form.utmSource} onChange={(e) => set('utmSource', e.target.value)} /><Input placeholder="utm_medium" value={form.utmMedium} onChange={(e) => set('utmMedium', e.target.value)} /><Input placeholder="utm_campaign" value={form.utmCampaign} onChange={(e) => set('utmCampaign', e.target.value)} /><Input placeholder="utm_content" value={form.utmContent} onChange={(e) => set('utmContent', e.target.value)} /></div><Input className="mt-2" placeholder="utm_term" value={form.utmTerm} onChange={(e) => set('utmTerm', e.target.value)} /></div><p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground sm:col-span-2">Las campañas por link miden atribución real. El grupo de control no se ofrece acá porque una audiencia pública no es una cohorte cerrada comparable.</p>{error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive sm:col-span-2">{error}</p>}</div><DialogFooter><Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancelar</Button><Button disabled={saving} onClick={onSave}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editando ? 'Guardar cambios' : 'Crear campaña'}</Button></DialogFooter></DialogContent></Dialog>
  */
}

type ItemCarritoPrearmado = { productoId: number; cantidad: number; varianteId?: number; varianteSecundariaId?: number; agregadoIds: number[] }

function parseCarritoPrearmado(value: string): ItemCarritoPrearmado[] {
  if (/^\d+x\d+(?:-\d+x\d+)*$/.test(value)) return value.split('-').map((part) => {
    const [productoId, cantidad] = part.split('x').map(Number)
    return { productoId, cantidad, agregadoIds: [] }
  })
  if (!value.startsWith('v2:')) return []
  try {
    const raw: unknown = JSON.parse(value.slice(3))
    if (!Array.isArray(raw)) return []
    return raw.flatMap((item): ItemCarritoPrearmado[] => {
      if (!item || typeof item !== 'object') return []
      const data = item as Record<string, unknown>
      if (!Number.isInteger(data.p) || !Number.isInteger(data.q) || (data.q as number) < 1) return []
      if (data.v !== undefined && !Number.isInteger(data.v)) return []
      if (data.s !== undefined && !Number.isInteger(data.s)) return []
      if (data.a !== undefined && (!Array.isArray(data.a) || data.a.some((id) => !Number.isInteger(id)))) return []
      return [{ productoId: data.p as number, cantidad: Math.min(99, data.q as number), ...(data.v === undefined ? {} : { varianteId: data.v as number }), ...(data.s === undefined ? {} : { varianteSecundariaId: data.s as number }), agregadoIds: (data.a ?? []) as number[] }]
    })
  } catch { return [] }
}

function serializarCarritoPrearmado(items: ItemCarritoPrearmado[]) {
  return `v2:${JSON.stringify(items.map((item) => ({ p: item.productoId, q: item.cantidad, ...(item.varianteId == null ? {} : { v: item.varianteId }), ...(item.varianteSecundariaId == null ? {} : { s: item.varianteSecundariaId }), ...(item.agregadoIds.length ? { a: item.agregadoIds } : {}) })))}`
}

function CarritoPrearmadoBuilder({ productos, value, onChange }: { productos: ProductoGrowth[]; value: string; onChange: (value: string) => void }) {
  const seleccionados = parseCarritoPrearmado(value)
  const [productoConfigurando, setProductoConfigurando] = useState<ProductoGrowth | null>(null)
  const [cantidad, setCantidad] = useState(1)
  const [varianteId, setVarianteId] = useState('')
  const [varianteSecundariaId, setVarianteSecundariaId] = useState('')
  const [agregadoIds, setAgregadoIds] = useState<number[]>([])
  const actualizar = (items: ItemCarritoPrearmado[]) => onChange(items.length ? serializarCarritoPrearmado(items) : '')
  const abrirConfiguracion = (producto: ProductoGrowth) => {
    const actual = seleccionados.find((item) => item.productoId === producto.id)
    setProductoConfigurando(producto)
    setCantidad(actual?.cantidad ?? 1)
    setVarianteId(actual?.varianteId?.toString() ?? '')
    setVarianteSecundariaId(actual?.varianteSecundariaId?.toString() ?? '')
    setAgregadoIds(actual?.agregadoIds ?? [])
  }
  const guardarConfiguracion = () => {
    if (!productoConfigurando) return
    if (productoConfigurando.variantes?.length && !varianteId) { toast.error(`Elegí ${productoConfigurando.tituloVariantesPrimarias || 'una variante'}.`); return }
    if (productoConfigurando.variantesSecundarias?.length && !varianteSecundariaId) { toast.error(`Elegí ${productoConfigurando.tituloVariantesSecundarias || 'la segunda variante'}.`); return }
    const item: ItemCarritoPrearmado = { productoId: productoConfigurando.id, cantidad: Math.max(1, Math.min(99, cantidad || 1)), ...(varianteId ? { varianteId: Number(varianteId) } : {}), ...(varianteSecundariaId ? { varianteSecundariaId: Number(varianteSecundariaId) } : {}), agregadoIds }
    actualizar([...seleccionados.filter((actual) => actual.productoId !== productoConfigurando.id), item])
    setProductoConfigurando(null)
  }
  const opcionNombre = (producto: ProductoGrowth, item: ItemCarritoPrearmado) => {
    const primaria = producto.variantes?.find((opcion) => opcion.id === item.varianteId)?.nombre
    const secundaria = producto.variantesSecundarias?.find((opcion) => opcion.id === item.varianteSecundariaId)?.nombre
    const extras = (producto.agregados ?? []).filter((opcion) => item.agregadoIds.includes(opcion.id)).map((opcion) => opcion.nombre)
    return [primaria, secundaria, ...extras].filter(Boolean).join(' · ')
  }
  const alternarExtra = (id: number) => setAgregadoIds((actual) => actual.includes(id) ? actual.filter((item) => item !== id) : [...actual, id])
  return <div className="space-y-3 sm:col-span-2"><div><Label>Productos del carrito</Label><p className="mt-1 text-[11px] text-muted-foreground">Elegí un producto para configurar cantidad, variantes y extras antes de sumarlo.</p></div><div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border bg-background p-2">{productos.filter((producto) => producto.activo !== false).map((producto) => { const item = seleccionados.find((actual) => actual.productoId === producto.id); return <button type="button" key={producto.id} onClick={() => abrirConfiguracion(producto)} className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${item ? 'bg-primary/10 hover:bg-primary/15' : 'hover:bg-muted'}`}><span className="min-w-0"><span className="block truncate text-sm font-medium">{producto.nombre}</span>{item && <span className="block truncate text-[11px] text-muted-foreground">{item.cantidad} u.{opcionNombre(producto, item) ? ` · ${opcionNombre(producto, item)}` : ''}</span>}</span><span className="shrink-0 text-xs font-semibold text-primary">{item ? 'Editar' : 'Agregar'}</span></button> })}</div>{seleccionados.length > 0 && <div className="rounded-xl bg-muted/50 p-2">{seleccionados.map((item) => { const producto = productos.find((actual) => actual.id === item.productoId); if (!producto) return null; return <div key={item.productoId} className="flex items-center gap-2 px-2 py-1.5 text-xs"><button type="button" className="min-w-0 flex-1 truncate text-left hover:underline" onClick={() => abrirConfiguracion(producto)}>{producto.nombre} × {item.cantidad}</button><button type="button" aria-label={`Quitar ${producto.nombre}`} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => actualizar(seleccionados.filter((actual) => actual.productoId !== item.productoId))}><X className="h-3.5 w-3.5" /></button></div> })}</div>}<Dialog open={Boolean(productoConfigurando)} onOpenChange={(abierto) => !abierto && setProductoConfigurando(null)}><DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-md"><DialogHeader><DialogTitle>{productoConfigurando?.nombre}</DialogTitle><DialogDescription>Configurá cómo se agregará este producto al carrito de la campaña.</DialogDescription></DialogHeader>{productoConfigurando && <div className="space-y-4"><div className="space-y-1.5"><Label>Cantidad</Label><Input type="number" min="1" max="99" value={cantidad} onChange={(event) => setCantidad(Number(event.target.value))} /></div>{productoConfigurando.variantes?.length ? <FieldSelect label={productoConfigurando.tituloVariantesPrimarias || 'Elegí una opción'} value={varianteId || 'ninguna'} onValueChange={(valor) => setVarianteId(valor === 'ninguna' ? '' : valor)} options={[["ninguna", "Elegí una opción"], ...productoConfigurando.variantes.map((opcion) => [String(opcion.id), `${opcion.nombre} · $${opcion.precio}`] as [string, string])]} /> : null}{productoConfigurando.variantesSecundarias?.length ? <FieldSelect label={productoConfigurando.tituloVariantesSecundarias || 'Elegí la segunda opción'} value={varianteSecundariaId || 'ninguna'} onValueChange={(valor) => setVarianteSecundariaId(valor === 'ninguna' ? '' : valor)} options={[["ninguna", "Elegí una opción"], ...productoConfigurando.variantesSecundarias.map((opcion) => [String(opcion.id), `${opcion.nombre} · $${opcion.precio}`] as [string, string])]} /> : null}{productoConfigurando.agregados?.length ? <div className="space-y-2"><Label>Extras</Label><div className="space-y-1 rounded-xl border p-2">{productoConfigurando.agregados.map((extra) => <label key={extra.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-muted"><span className="flex items-center gap-2 text-sm"><input type="checkbox" checked={agregadoIds.includes(extra.id)} onChange={() => alternarExtra(extra.id)} />{extra.nombre}</span><span className="text-xs text-muted-foreground">+${extra.precio}</span></label>)}</div></div> : null}</div>}<DialogFooter><Button variant="outline" onClick={() => setProductoConfigurando(null)}>Cancelar</Button><Button onClick={guardarConfiguracion}>Agregar al carrito</Button></DialogFooter></DialogContent></Dialog></div>
}

/* Builder anterior del destino carrito, pausado junto con recetas y audiencias.
function CarritoBuilder({ productos, value, onChange }: { productos: ProductoGrowth[]; value: string; onChange: (value: string) => void }) {
  const cantidades = new Map(value.split('-').flatMap((parte) => {
    const match = /^(\d+)x(\d+)$/.exec(parte)
    return match ? [[Number(match[1]), Number(match[2])] as const] : []
  }))
  const actualizar = (productoId: number, cantidad: number) => {
    if (cantidad <= 0) cantidades.delete(productoId)
    else cantidades.set(productoId, Math.min(99, Math.max(1, cantidad)))
    onChange([...cantidades.entries()].map(([id, qty]) => `${id}x${qty}`).join('-'))
  }
  return <div className="space-y-2 sm:col-span-2"><Label>Productos que encontrará en el carrito</Label><div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border bg-background p-2">{productos.map((producto) => { const cantidad = cantidades.get(producto.id) ?? 0; return <div key={producto.id} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50"><button type="button" className={`h-5 w-5 rounded border text-xs ${cantidad ? 'border-primary bg-primary text-primary-foreground' : 'border-input'}`} onClick={() => actualizar(producto.id, cantidad ? 0 : 1)}>{cantidad ? '✓' : ''}</button><span className="min-w-0 flex-1 truncate text-sm">{producto.nombre}</span>{cantidad > 0 && <Input aria-label={`Cantidad de ${producto.nombre}`} type="number" min="1" max="99" value={cantidad} onChange={(event) => actualizar(producto.id, Number(event.target.value))} className="h-8 w-20" />}</div>})}</div><p className="text-[11px] text-muted-foreground">El cliente verá estos productos con sus nombres y cantidades; Piru arma internamente el link.</p></div>
}
*/

function CouponExplanation({
  codigo,
  tipo,
  valor,
  limiteUsos,
  usosActuales,
  montoMinimo,
  fechaInicio,
  fechaFin,
  activo = true,
  compact = false,
}: {
  codigo?: string
  tipo: FormCupon['tipo']
  valor?: string | number | null
  limiteUsos?: string | number | null
  usosActuales?: number
  montoMinimo?: string | number | null
  fechaInicio?: string | null
  fechaFin?: string | null
  activo?: boolean
  compact?: boolean
}) {
  const valorNumerico = Number(valor || 0)
  const minimo = Number(montoMinimo || 0)
  const limite = limiteUsos == null || limiteUsos === '' ? null : Number(limiteUsos)
  const beneficio = valorNumerico > 0
    ? tipo === 'porcentaje'
      ? `${valorNumerico}% de descuento`
      : `${formatCurrency(valorNumerico)} de descuento`
    : null
  const codigoVisible = codigo?.trim() ? codigo.trim().toUpperCase() : 'el código que elijas'
  const titulo = beneficio ? `${beneficio} con ${codigoVisible}` : 'Definí el beneficio del cupón'
  const introduccion = beneficio
    ? `Cuando el cliente use ${codigoVisible}, Piru aplicará ${beneficio.toLowerCase()}${minimo > 0 ? ` si su compra alcanza ${formatCurrency(minimo)}` : ', sin exigir una compra mínima'}.`
    : `Cuando completes el valor, esta explicación mostrará exactamente qué recibirá el cliente al usar ${codigoVisible}.`
  const vigencia = `${fechaInicio ? `Desde ${formatDate(fechaInicio)}` : 'Disponible desde ahora'} · ${fechaFin ? `hasta ${formatDate(fechaFin)}` : 'sin vencimiento'}`
  const estadoTexto = activo
    ? 'El cupón estará disponible mientras cumpla su vigencia y conserve usos.'
    : 'El cupón está inactivo. Conserva sus resultados, pero no puede aplicarse a nuevas compras.'

  return (
    <section className={compact ? 'space-y-5' : 'space-y-7'}>
      <header>
        <p className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-muted-foreground`}>
          {codigo?.trim() ? `Cómo funciona ${codigo.trim().toUpperCase()}` : 'Cómo funcionará este cupón'}
        </p>
        <h3 className={`${compact ? 'mt-1.5 text-lg' : 'mt-2 text-2xl'} font-semibold leading-tight tracking-tight text-foreground`}>
          {titulo}
        </h3>
        <p className={`${compact ? 'mt-2 text-sm' : 'mt-3 text-base'} leading-relaxed text-muted-foreground`}>{introduccion}</p>
      </header>

      <div className={compact ? 'space-y-4' : 'space-y-5'}>
        <div>
          <h4 className={`${compact ? 'text-sm' : 'text-base'} font-medium text-foreground`}>Compartís el código</h4>
          <p className={`${compact ? 'mt-1 text-xs' : 'mt-1.5 text-sm'} leading-relaxed text-muted-foreground`}>Podés publicarlo en redes, enviarlo por mensaje o incluirlo en una campaña.</p>
        </div>
        <div>
          <h4 className={`${compact ? 'text-sm' : 'text-base'} font-medium text-foreground`}>El cliente lo aplica</h4>
          <p className={`${compact ? 'mt-1 text-xs' : 'mt-1.5 text-sm'} leading-relaxed text-muted-foreground`}>Lo ingresa antes de confirmar el pedido y ve el descuento reflejado en el total.</p>
        </div>
        <div>
          <h4 className={`${compact ? 'text-sm' : 'text-base'} font-medium text-foreground`}>Piru valida y mide</h4>
          <p className={`${compact ? 'mt-1 text-xs' : 'mt-1.5 text-sm'} leading-relaxed text-muted-foreground`}>Piru controla las condiciones y registra usos, clientes, facturación y monto descontado.</p>
        </div>
      </div>

      <div className={`${compact ? 'space-y-1.5 text-xs' : 'space-y-2 text-sm'} text-muted-foreground`}>
        <h4 className={`${compact ? 'text-sm' : 'text-base'} font-medium text-foreground`}>Condiciones</h4>
        <p><span className="font-medium text-foreground">Beneficio:</span> {beneficio ? `${beneficio}.` : 'todavía sin definir.'}</p>
        <p><span className="font-medium text-foreground">Compra mínima:</span> {minimo > 0 ? `${formatCurrency(minimo)}.` : 'sin mínimo.'}</p>
        <p><span className="font-medium text-foreground">Cupo:</span> {limite == null ? 'sin límite de usos.' : usosActuales == null ? `${limite} usos.` : `${usosActuales} de ${limite} usos consumidos.`}</p>
        <p><span className="font-medium text-foreground">Vigencia:</span> {vigencia}.</p>
        <p>{estadoTexto}</p>
      </div>
    </section>
  )
}

function CuponDialog({ open, onOpenChange, editando, form, setForm, error, saving, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; editando: CodigoDescuentoGrowth | null; form: FormCupon; setForm: React.Dispatch<React.SetStateAction<FormCupon>>; error: string; saving: boolean; onSave: () => void }) {
  const set = <K extends keyof FormCupon>(key: K, value: FormCupon[K]) => setForm((actual) => ({ ...actual, [key]: value }))
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] w-[96vw] overflow-y-auto p-0 sm:max-w-6xl">
        <div className="grid min-h-0 md:grid-cols-[minmax(0,1.15fr)_minmax(400px,0.85fr)]">
          <div className="flex min-w-0 flex-col p-6 sm:p-8">
            <DialogHeader>
              <DialogTitle className="text-2xl">{editando ? 'Editar cupón' : 'Nuevo cupón'}</DialogTitle>
              <DialogDescription className="text-sm">Configurá el beneficio. La explicación se actualiza a medida que completás el cupón.</DialogDescription>
            </DialogHeader>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Código</Label>
                <Input value={form.codigo} onChange={(e) => set('codigo', e.target.value.toUpperCase())} />
              </div>
              <FieldSelect label="Tipo" value={form.tipo} onValueChange={(v) => set('tipo', v as FormCupon['tipo'])} options={[["porcentaje", "Porcentaje"], ["monto_fijo", "Monto fijo"]]} />
              <div className="space-y-1.5">
                <Label>Valor</Label>
                <Input type="number" min="0" value={form.valor} onChange={(e) => set('valor', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Límite de usos</Label>
                <Input type="number" min="0" placeholder="Sin límite" value={form.limiteUsos} onChange={(e) => set('limiteUsos', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Monto mínimo</Label>
                <Input type="number" min="0" value={form.montoMinimo} onChange={(e) => set('montoMinimo', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Desde</Label>
                <Input type="datetime-local" value={form.fechaInicio} onChange={(e) => set('fechaInicio', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Hasta</Label>
                <Input type="datetime-local" value={form.fechaFin} onChange={(e) => set('fechaFin', e.target.value)} />
              </div>
              {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive sm:col-span-2">{error}</p>}
            </div>

            <DialogFooter className="mt-6">
              <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button disabled={saving} onClick={onSave}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editando ? 'Guardar cambios' : 'Crear cupón'}</Button>
            </DialogFooter>
          </div>

          <aside className="border-t border-border/40 p-6 sm:p-8 md:border-l md:border-t-0 md:p-10">
            <div className="md:sticky md:top-0">
              <CouponExplanation
                codigo={form.codigo}
                tipo={form.tipo}
                valor={form.valor}
                limiteUsos={form.limiteUsos}
                montoMinimo={form.montoMinimo}
                fechaInicio={form.fechaInicio}
                fechaFin={form.fechaFin}
                activo={editando?.activo ?? true}
              />
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function FieldSelect({ label, value, onValueChange, options }: { label: string; value: string; onValueChange: (value: string) => void; options: Array<[string, string]> }) {
  return <div className="space-y-1.5"><Label>{label}</Label><Select value={value} onValueChange={onValueChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{options.map(([key, text]) => <SelectItem key={key} value={key}>{text}</SelectItem>)}</SelectContent></Select></div>
}
