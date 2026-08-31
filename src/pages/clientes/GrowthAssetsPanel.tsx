import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ApiError, codigosDescuentoApi, crecimientoApi, type CampanaCrecimiento, type CrearCampanaCrecimiento } from '@/lib/api'
import { ChevronRight, Copy, Globe2, Loader2, Megaphone, Pencil, Plus, Power, PowerOff, Tag, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { type ClienteGrowth, type CodigoDescuentoGrowth, type FiltroCampana, type ProductoGrowth, type ResultadoCampana, type ResultadoCupon, type SucursalGrowth, formatCurrency, formatDate, normalizarHasta } from './types'

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
}

const slug = (valor: string) => valor.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 191)

type FormCampana = {
  nombre: string; slug: string; estado: CampanaCrecimiento['estado']; productoId: string
  descuentoProductoPorcentaje: string; limiteUsos: string; fechaInicio: string; fechaFin: string
}
const campanaVacia = (): FormCampana => ({ nombre: '', slug: '', estado: 'activa', productoId: '', descuentoProductoPorcentaje: '', limiteUsos: '', fechaInicio: '', fechaFin: '' })
const campanaAForm = (campana: CampanaCrecimiento): FormCampana => ({ nombre: campana.nombre, slug: campana.slug, estado: campana.estado, productoId: campana.productoId?.toString() ?? '', descuentoProductoPorcentaje: campana.descuentoProductoPorcentaje ? String(campana.descuentoProductoPorcentaje) : '', limiteUsos: campana.limiteUsos?.toString() ?? '', fechaInicio: campana.fechaInicio?.slice(0, 16) ?? '', fechaFin: campana.fechaFin?.slice(0, 16) ?? '' })

type FormCupon = { codigo: string; tipo: 'porcentaje' | 'monto_fijo'; valor: string; limiteUsos: string; montoMinimo: string; fechaInicio: string; fechaFin: string }
const cuponVacio = (): FormCupon => ({ codigo: '', tipo: 'porcentaje', valor: '', limiteUsos: '', montoMinimo: '0', fechaInicio: '', fechaFin: '' })
const cuponAForm = (cupon: CodigoDescuentoGrowth): FormCupon => ({ codigo: cupon.codigo, tipo: cupon.tipo, valor: cupon.valor, limiteUsos: cupon.limiteUsos?.toString() ?? '', montoMinimo: cupon.montoMinimo ?? '0', fechaInicio: cupon.fechaInicio?.slice(0, 16) ?? '', fechaFin: cupon.fechaFin?.slice(0, 16) ?? '' })

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg bg-muted/55 p-2.5"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold tabular-nums">{value}</p></div>
}

export default function GrowthAssetsPanel(props: Props) {
  const { token, tab, campanas, cupones, query, filtros, campanaSeleccionada, cuponSeleccionado } = props
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

  const campanasProducto = useMemo(
    () => campanas.filter((item) => item.destinoTipo === 'producto' && item.productoId != null),
    [campanas],
  )
  const campanasFiltradas = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? campanasProducto.filter((item) => `${item.nombre} ${item.slug}`.toLowerCase().includes(q)) : campanasProducto
  }, [campanasProducto, query])
  const cuponesFiltrados = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? cupones.filter((item) => item.codigo.toLowerCase().includes(q)) : cupones
  }, [cupones, query])
  const campanaActual = typeof campanaSeleccionada === 'number' ? campanasProducto.find((item) => item.id === campanaSeleccionada) ?? null : null
  const cuponActual = cuponSeleccionado != null ? cupones.find((item) => item.id === cuponSeleccionado) ?? null : null

  const abrirCampana = (campana?: CampanaCrecimiento) => { setCampanaEditando(campana ?? null); setFormCampana(campana ? campanaAForm(campana) : campanaVacia()); setError(''); setCampanaDialog(true) }
  const abrirCupon = (cupon?: CodigoDescuentoGrowth) => { setCuponEditando(cupon ?? null); setFormCupon(cupon ? cuponAForm(cupon) : cuponVacio()); setError(''); setCuponDialog(true) }

  const payloadCampana = (): CrearCampanaCrecimiento | null => {
    if (!formCampana.nombre.trim() || !formCampana.slug.trim()) { setError('Completá el nombre y el slug.'); return null }
    if (!formCampana.productoId) { setError('Elegí el producto de la promoción.'); return null }
    const descuento = Number(formCampana.descuentoProductoPorcentaje || 0)
    if (!Number.isInteger(descuento) || descuento < 0 || descuento > 100) { setError('El descuento debe ser un porcentaje entre 0 y 100.'); return null }
    const limite = formCampana.limiteUsos ? Number(formCampana.limiteUsos) : null
    if (limite != null && (!Number.isInteger(limite) || limite <= 0)) { setError('El cupo debe ser un número mayor a cero.'); return null }
    if (formCampana.fechaInicio && formCampana.fechaFin && new Date(formCampana.fechaFin) <= new Date(formCampana.fechaInicio)) { setError('La fecha de fin debe ser posterior al inicio.'); return null }
    return {
      nombre: formCampana.nombre.trim(), slug: formCampana.slug, tipo: 'adquisicion', recetaCodigo: null,
      estado: formCampana.estado, destinoTipo: 'producto', productoId: Number(formCampana.productoId),
      carritoRep: null, codigoDescuentoId: null, descuentoProductoPorcentaje: descuento,
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

  return <div className="grid min-h-[680px] gap-4 xl:h-full xl:min-h-0 xl:grid-cols-[minmax(260px,0.85fr)_minmax(430px,1.45fr)_minmax(310px,1fr)]">
    <section className={`${props.mobileView === 'lista' ? 'flex' : 'hidden'} min-h-[520px] flex-col overflow-hidden xl:flex xl:min-h-0`}>
      <div className="flex items-center justify-between gap-3 p-3">
        <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tab === 'campanas' ? 'Campañas' : 'Cupones'}</p><p className="text-[11px] text-muted-foreground">{tab === 'campanas' ? campanasFiltradas.length + 1 : cuponesFiltrados.length} resultados</p></div>
        <Button size="sm" disabled={tab === 'campanas' ? !props.crecimientoActivo : !props.cuponesActivos} onClick={() => tab === 'campanas' ? abrirCampana() : abrirCupon()}><Plus className="mr-2 h-4 w-4" />Nuevo</Button>
      </div>
      <ScrollArea className="min-h-0 flex-1"><div className="space-y-2 p-2">
        {tab === 'campanas' ? <>
          {!props.crecimientoActivo && <Disabled label="Crecimiento está desactivado" />}
          {props.crecimientoActivo && (!query.trim() || 'orgánico sin campaña directo'.includes(query.trim().toLowerCase())) && <AssetButton active={campanaSeleccionada === 'organico'} onClick={() => props.onSelectCampana(campanaSeleccionada === 'organico' ? null : 'organico')} icon={<Globe2 className="h-4 w-4" />} title="Orgánico · sin campaña" subtitle="Visitas directas y compras sin touch de campaña" badge="Siempre disponible" />}
          {props.crecimientoActivo && campanasFiltradas.map((campana) => <AssetButton key={campana.id} active={campanaSeleccionada === campana.id} onClick={() => props.onSelectCampana(campanaSeleccionada === campana.id ? null : campana.id)} icon={<Megaphone className="h-4 w-4" />} title={campana.nombre} subtitle={`/c/${campana.slug}`} badge={campana.estado} />)}
          {props.crecimientoActivo && campanasFiltradas.length === 0 && query.trim() && <Empty label="No hay campañas que coincidan." />}
        </> : <>
          {!props.cuponesActivos && <Disabled label="Códigos de descuento está desactivado" />}
          {props.cuponesActivos && cuponesFiltrados.map((cupon) => <CouponAssetButton key={cupon.id} cupon={cupon} active={cuponSeleccionado === cupon.id} onClick={() => props.onSelectCupon(cuponSeleccionado === cupon.id ? null : cupon.id)} />)}
          {props.cuponesActivos && cuponesFiltrados.length === 0 && <Empty label="Todavía no hay cupones." />}
        </>}
      </div></ScrollArea>
    </section>

    <section className={`${props.mobileView === 'detalle' ? 'flex' : 'hidden'} min-h-[620px] flex-col overflow-hidden xl:flex xl:min-h-0`}>
      {loadingDetalle ? <LoadingDetail /> : tab === 'campanas' && campanaSeleccionada != null && resultadoCampana
        ? <ScrollArea className="min-h-0 flex-1"><div className="p-4"><CampaignDetail organic={campanaSeleccionada === 'organico'} campana={campanaActual} producto={props.productos.find((item) => item.id === campanaActual?.productoId) ?? null} resultado={resultadoCampana} onCopy={() => campanaActual && void copiarCampana(campanaActual)} onEdit={() => campanaActual && abrirCampana(campanaActual)} onToggle={() => campanaActual && void toggleCampana(campanaActual)} onDelete={() => campanaActual && void borrarCampana(campanaActual)} /></div></ScrollArea>
        : tab === 'cupones' && cuponActual && resultadoCupon
          ? <ScrollArea className="min-h-0 flex-1"><div className="p-4"><CouponDetail cupon={cuponActual} resultado={resultadoCupon} onEdit={() => abrirCupon(cuponActual)} onToggle={() => void toggleCupon(cuponActual)} onDelete={() => void borrarCupon(cuponActual)} /></div></ScrollArea>
          : <EmptySelection tab={tab} />}
    </section>

    <section className={`${props.mobileView === 'clientes' ? 'flex' : 'hidden'} min-h-[620px] flex-col overflow-hidden xl:flex xl:min-h-0`}>
      <AssociationsPanel tab={tab} campanaSeleccionada={campanaSeleccionada} cuponSeleccionado={cuponSeleccionado} clientes={props.clientes} sucursales={props.sucursales} filtros={filtros} resultadoCupon={resultadoCupon} loading={loadingDetalle} onSelectClient={props.onSelectClient} />
    </section>

    <CampanaDialog open={campanaDialog} onOpenChange={setCampanaDialog} editando={campanaEditando} form={formCampana} setForm={setFormCampana} productos={props.productos} error={error} saving={saving} onSave={() => void guardarCampana()} username={props.username} />
    <CuponDialog open={cuponDialog} onOpenChange={setCuponDialog} editando={cuponEditando} form={formCupon} setForm={setFormCupon} error={error} saving={saving} onSave={() => void guardarCupon()} />
  </div>
}

function LoadingDetail() { return <div className="flex flex-1 items-center justify-center py-16 text-xs text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Calculando resultados…</div> }
function EmptySelection({ tab }: { tab: AssetTab }) { return <div className="flex flex-1 flex-col items-center justify-center p-8 text-center"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">{tab === 'campanas' ? <Megaphone className="h-6 w-6 text-muted-foreground" /> : <Tag className="h-6 w-6 text-muted-foreground" />}</div><h2 className="mt-4 font-semibold">Seleccioná {tab === 'campanas' ? 'una campaña' : 'un cupón'}</h2><p className="mt-1 max-w-xs text-sm text-muted-foreground">Vas a ver su configuración y sus resultados en esta columna.</p></div> }

function AssetButton({ active, onClick, icon, title, subtitle, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; subtitle: string; badge: string }) {
  return <button type="button" onClick={onClick} className={`w-full rounded-xl border-0 p-3 text-left transition-colors ${active ? 'border-l-[3px] border-l-[#FF7A00] bg-muted/40' : 'bg-white hover:bg-muted/40 dark:bg-muted/20'}`}><div className="flex items-start gap-2.5"><span className={`mt-0.5 ${active ? 'text-[#FF7A00]' : 'text-muted-foreground'}`}>{icon}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{title}</span><span className="block truncate text-[11px] text-muted-foreground">{subtitle}</span></span><Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[9px] capitalize">{badge}</Badge></div></button>
}

function CouponAssetButton({ cupon, active, onClick }: { cupon: CodigoDescuentoGrowth; active: boolean; onClick: () => void }) {
  const ahora = Date.now()
  const empiezaEn = cupon.fechaInicio ? new Date(cupon.fechaInicio).getTime() > ahora : false
  const vencio = cupon.fechaFin ? new Date(cupon.fechaFin).getTime() < ahora : false
  const agotado = cupon.limiteUsos != null && cupon.usosActuales >= cupon.limiteUsos
  const vigente = cupon.activo && !empiezaEn && !vencio && !agotado
  const estado = vigente ? 'Vigente' : !cupon.activo ? 'Inactivo' : empiezaEn ? 'Próximamente' : vencio ? 'Vencido' : 'Agotado'
  const usos = cupon.limiteUsos == null ? `${cupon.usosActuales} usos · sin límite` : `${cupon.usosActuales}/${cupon.limiteUsos} usos`
  const progreso = cupon.limiteUsos == null ? 0 : Math.min(100, (cupon.usosActuales / cupon.limiteUsos) * 100)
  const beneficio = cupon.tipo === 'porcentaje' ? `${Number(cupon.valor)}% OFF` : `${formatCurrency(cupon.valor)} OFF`

  return <button type="button" onClick={onClick} className={`w-full rounded-xl p-3 text-left transition-colors ${active ? 'border-l-[3px] border-l-[#FF7A00] bg-muted/40' : 'bg-white hover:bg-muted/40 dark:bg-muted/20'}`}>
    <div className="flex items-start gap-2.5"><Tag className={`mt-0.5 h-4 w-4 shrink-0 ${active ? 'text-[#FF7A00]' : 'text-muted-foreground'}`} /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-semibold">{cupon.codigo}</p><Badge variant="outline" className={`h-5 shrink-0 px-1.5 text-[9px] ${vigente ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300' : ''}`}>{estado}</Badge></div><p className="mt-0.5 text-[11px] text-muted-foreground">{beneficio}{Number(cupon.montoMinimo) > 0 ? ` · mínimo ${formatCurrency(cupon.montoMinimo)}` : ''}</p><div className="mt-2 flex items-center justify-between gap-2 text-[11px]"><span className="font-medium text-foreground">{usos}</span><span className="truncate text-muted-foreground">{cupon.fechaFin ? `Hasta ${formatDate(cupon.fechaFin)}` : 'Sin vencimiento'}</span></div>{cupon.limiteUsos != null && <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${vigente ? 'bg-[#FF7A00]' : 'bg-muted-foreground/40'}`} style={{ width: `${progreso}%` }} /></div>}</div></div>
  </button>
}
function Empty({ label }: { label: string }) { return <p className="rounded-xl bg-muted/30 p-6 text-center text-xs text-muted-foreground">{label}</p> }
function Disabled({ label }: { label: string }) { return <div className="rounded-xl bg-muted/30 p-4 text-center"><p className="text-xs font-medium">{label}</p><p className="mt-1 text-[11px] text-muted-foreground">Podés activarlo desde Módulos.</p></div> }

function AssociationsPanel({ tab, campanaSeleccionada, cuponSeleccionado, clientes, sucursales, filtros, resultadoCupon, loading, onSelectClient }: {
  tab: AssetTab; campanaSeleccionada: FiltroCampana; cuponSeleccionado: number | null; clientes: ClienteGrowth[]; sucursales: SucursalGrowth[]
  filtros: Filtros; resultadoCupon: ResultadoCupon | null; loading: boolean; onSelectClient: (id: number) => void
}) {
  const sucursalPorId = new Map(sucursales.map((item) => [item.id, item.nombre]))
  const asociacionesCampana = useMemo(() => {
    if (tab !== 'campanas' || campanaSeleccionada == null) return []
    const desde = filtros.from ? new Date(`${filtros.from}T00:00:00`).getTime() : null
    const hasta = filtros.to ? new Date(`${filtros.to}T23:59:59.999`).getTime() : null
    return clientes.flatMap((cliente) => cliente.pedidos
      .filter((pedido) => {
        const fecha = new Date(pedido.createdAt).getTime()
        const pertenece = campanaSeleccionada === 'organico' ? pedido.esOrganico : pedido.campanaId === campanaSeleccionada
        return pertenece && (!desde || fecha >= desde) && (!hasta || fecha <= hasta) && (!filtros.sucursalId || pedido.sucursalId === filtros.sucursalId)
      })
      .map((pedido) => ({ cliente, pedido })))
      .sort((a, b) => new Date(b.pedido.createdAt).getTime() - new Date(a.pedido.createdAt).getTime())
  }, [tab, campanaSeleccionada, clientes, filtros])
  const clientesCampana = useMemo(() => [...new Map(asociacionesCampana.map(({ cliente }) => [cliente.id, cliente])).values()], [asociacionesCampana])
  const clientePorId = useMemo(() => new Map(clientes.map((cliente) => [cliente.id, cliente])), [clientes])

  if ((tab === 'campanas' && campanaSeleccionada == null) || (tab === 'cupones' && cuponSeleccionado == null)) return <EmptyAssociations />
  if (loading) return <LoadingDetail />

  const clientesAsociados = tab === 'campanas' ? clientesCampana : (resultadoCupon?.clientes ?? [])
  const pedidosAsociados = tab === 'campanas' ? asociacionesCampana.map(({ cliente, pedido }) => ({ cliente, pedido })) : (resultadoCupon?.pedidos ?? []).map((pedido) => ({ cliente: pedido.clienteId ? clientePorId.get(pedido.clienteId) : undefined, pedido }))
  return <>
    <div className="p-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actividad asociada</p><p className="text-[11px] text-muted-foreground">{clientesAsociados.length} clientes · {pedidosAsociados.length} pedidos</p></div>
    <ScrollArea className="min-h-0 flex-1"><div className="space-y-5 p-2">
      <div><p className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Clientes</p><div className="space-y-1.5">{clientesAsociados.length ? clientesAsociados.map((item) => {
        const cliente = 'telefono' in item && 'cantidadPedidos' in item ? item : clientePorId.get(item.id)
        return <button key={item.id} type="button" onClick={() => onSelectClient(item.id)} className="flex w-full items-center gap-3 rounded-xl bg-white p-3 text-left transition-colors hover:bg-muted/40 dark:bg-muted/20"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">{inicialesAsociacion(item.nombre)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.nombre}</p><p className="mt-0.5 truncate text-[11px] text-muted-foreground">{tab === 'cupones' && 'usos' in item ? `${item.usos} usos · ${formatCurrency(item.facturacion)}` : cliente ? `${cliente.cantidadPedidos} pedidos · ${formatCurrency(cliente.totalGastado)}` : item.telefono}</p></div><ChevronRight className="h-4 w-4 text-muted-foreground/40" /></button>
      }) : <Empty label="Todavía no hay clientes asociados." />}</div></div>
      <div><p className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Pedidos</p><div className="space-y-1.5">{pedidosAsociados.length ? pedidosAsociados.map(({ cliente, pedido }) => <AssociatedOrder key={pedido.id} pedido={pedido} cliente={cliente?.nombre} sucursal={pedido.sucursalId ? sucursalPorId.get(pedido.sucursalId) : undefined} />) : <Empty label="Todavía no hay pedidos asociados." />}</div></div>
    </div></ScrollArea>
  </>
}

const inicialesAsociacion = (nombre: string) => nombre.trim().split(/\s+/).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase()
function EmptyAssociations() { return <div className="flex flex-1 flex-col items-center justify-center p-8 text-center"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted"><Users className="h-6 w-6 text-muted-foreground" /></div><h2 className="mt-4 font-semibold">Actividad asociada</h2><p className="mt-1 max-w-xs text-sm text-muted-foreground">Al seleccionar un elemento vas a ver acá sus clientes y pedidos.</p></div> }
function AssociatedOrder({ pedido, cliente, sucursal }: { pedido: { id: number; createdAt: string; total: number | string; sucursalId?: number | null }; cliente?: string; sucursal?: string }) { return <div className="rounded-xl bg-white p-3 dark:bg-muted/20"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold">Pedido #{pedido.id}</p><p className="mt-1 truncate text-[11px] text-muted-foreground">{cliente ?? 'Cliente sin identificar'}{sucursal ? ` · ${sucursal}` : ''}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{formatDate(pedido.createdAt)}</p></div><span className="shrink-0 text-xs font-semibold">{formatCurrency(pedido.total)}</span></div></div> }

function CampaignDetail({ organic, campana, producto, resultado, onCopy, onEdit, onToggle, onDelete }: { organic: boolean; campana: CampanaCrecimiento | null; producto: ProductoGrowth | null; resultado: ResultadoCampana; onCopy: () => void; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  const m = resultado.metricas
  return <div className="space-y-4">
    <div><div className="flex items-center gap-2"><h3 className="text-sm font-semibold">{organic ? 'Orgánico · sin campaña' : campana?.nombre}</h3>{organic && <Badge className="bg-sky-600 hover:bg-sky-600">Vista automática</Badge>}</div><p className="mt-1 text-xs text-muted-foreground">{organic ? 'Personas que llegaron directamente a la tienda, sin Smart Link ni receta atribuible.' : `${campana?.tipo === 'adquisicion' ? 'Adquisición' : 'Recompra'} · ${campana?.estado}`}</p></div>
    <div className="grid grid-cols-2 gap-2"><Metric label="Ventas cobradas" value={formatCurrency(m.ventas)} /><Metric label="Pedidos" value={m.pedidos} /><Metric label="Clientes nuevos" value={m.clientesNuevos} /><Metric label="Conversión" value={`${m.conversion}%`} /><Metric label="Sesiones" value={m.sesiones} /><Metric label="Ticket" value={formatCurrency(m.ticketPromedio)} /></div>
    <div className="rounded-lg bg-muted/40 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Embudo real</p><div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs"><span>{organic ? 'Sesiones directas' : 'Visitas totales al link'}</span><strong className="text-right">{organic ? resultado.funnel.session_start : (campana?.visitas ?? resultado.funnel.session_start)}</strong><span>Agregaron al carrito</span><strong className="text-right">{resultado.funnel.add_to_cart}</strong><span>Iniciaron checkout</span><strong className="text-right">{resultado.funnel.checkout_start}</strong><span>Compraron</span><strong className="text-right">{resultado.funnel.purchase}</strong><span>Sumaron otros productos</span><strong className="text-right">{resultado.funnel.add_other_product ?? 0}</strong></div></div>
    {!organic && campana && <><div className="rounded-lg bg-muted/50 p-3 text-xs"><p><strong>Producto:</strong> {producto?.nombre ?? `#${campana.productoId}`}</p><p className="mt-1"><strong>Oferta:</strong> {campana.descuentoProductoPorcentaje > 0 ? `${campana.descuentoProductoPorcentaje}% OFF sólo en este producto` : 'Producto destacado sin descuento'}</p><p className="mt-1"><strong>Cupo:</strong> {campana.limiteUsos == null ? 'Sin límite' : `${campana.usosActuales}/${campana.limiteUsos} compras`}</p><p className="mt-1"><strong>Vigencia:</strong> {campana.fechaInicio ? formatDate(campana.fechaInicio) : 'Desde ahora'} — {campana.fechaFin ? formatDate(campana.fechaFin) : 'Sin vencimiento'}</p></div><div className="grid grid-cols-2 gap-2"><Button size="sm" variant="outline" onClick={onCopy}><Copy className="mr-1.5 h-3.5 w-3.5" />Copiar link</Button><Button size="sm" variant="outline" onClick={onEdit}><Pencil className="mr-1.5 h-3.5 w-3.5" />Editar</Button><Button size="sm" variant="outline" onClick={onToggle}>{campana.estado === 'activa' ? <PowerOff className="mr-1.5 h-3.5 w-3.5" /> : <Power className="mr-1.5 h-3.5 w-3.5" />}{campana.estado === 'activa' ? 'Desactivar' : 'Activar'}</Button><Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Eliminar</Button></div></>}
  </div>
}

function CouponDetail({ cupon, resultado, onEdit, onToggle, onDelete }: { cupon: CodigoDescuentoGrowth; resultado: ResultadoCupon; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  const m = resultado.metricas
  return <div className="space-y-4"><div className="flex items-start justify-between gap-2"><div><h3 className="text-lg font-semibold">{cupon.codigo}</h3><p className="mt-1 text-xs text-muted-foreground">{cupon.tipo === 'porcentaje' ? `${Number(cupon.valor)}% OFF` : `${formatCurrency(cupon.valor)} OFF`} · {cupon.activo ? 'Activo' : 'Inactivo'}</p></div><Badge variant="outline">{cupon.limiteUsos == null ? 'Sin límite' : `${cupon.usosActuales}/${cupon.limiteUsos}`}</Badge></div><div className="grid grid-cols-2 gap-2"><Metric label="Facturación cobrada" value={formatCurrency(m.facturacionCobrada)} /><Metric label="Pesos descontados" value={formatCurrency(m.montoDescontado)} /><Metric label="Usos cobrados" value={m.usos} /><Metric label="Clientes" value={m.clientes} /><Metric label="Venta antes del descuento" value={formatCurrency(m.ventasAntesDescuento)} /><Metric label="Ticket" value={formatCurrency(m.ticketPromedio)} /></div><div className="rounded-xl bg-muted/40 p-4 text-xs"><p><strong>Monto mínimo:</strong> {formatCurrency(cupon.montoMinimo)}</p><p className="mt-2"><strong>Vigencia:</strong> {cupon.fechaInicio ? formatDate(cupon.fechaInicio) : 'Sin inicio'} — {cupon.fechaFin ? formatDate(cupon.fechaFin) : 'Sin vencimiento'}</p><p className="mt-2"><strong>Creado:</strong> {formatDate(cupon.createdAt)}</p></div><div className="grid grid-cols-3 gap-2"><Button size="sm" variant="outline" onClick={onEdit}><Pencil className="mr-1 h-3.5 w-3.5" />Editar</Button><Button size="sm" variant="outline" onClick={onToggle}>{cupon.activo ? 'Desactivar' : 'Activar'}</Button><Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="mr-1 h-3.5 w-3.5" />Eliminar</Button></div></div>
}

function CampanaDialog({ open, onOpenChange, editando, form, setForm, productos, error, saving, onSave, username }: { open: boolean; onOpenChange: (open: boolean) => void; editando: CampanaCrecimiento | null; form: FormCampana; setForm: React.Dispatch<React.SetStateAction<FormCampana>>; productos: ProductoGrowth[]; error: string; saving: boolean; onSave: () => void; username?: string | null }) {
  const set = <K extends keyof FormCampana>(key: K, value: FormCampana[K]) => setForm((actual) => ({ ...actual, [key]: value }))
  // Recetas, audiencias, carrito precargado, cupones, inversión, UTMs y grupo
  // de control quedan fuera de la UI hasta que cada flujo se reincorpore con
  // pruebas. El backend conserva esos campos por retrocompatibilidad.
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{editando ? 'Editar campaña de producto' : 'Nueva campaña de producto'}</DialogTitle><DialogDescription>Elegí un producto y Piru crea un link propio. Quien entre verá esa oferta destacada dentro del menú, podrá sumar otros productos y el pedido quedará asociado a esta campaña.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5 sm:col-span-2"><Label>Nombre de la campaña</Label><Input placeholder="Promo Smash" value={form.nombre} onChange={(e) => { const nombre = e.target.value; setForm((actual) => ({ ...actual, nombre, slug: editando ? actual.slug : slug(nombre) })) }} /></div><FieldSelect label="Producto en oferta" value={form.productoId || 'ninguno'} onValueChange={(v) => set('productoId', v === 'ninguno' ? '' : v)} options={[["ninguno", "Elegí un producto"], ...productos.map((p) => [String(p.id), p.nombre] as [string, string])]} /><div className="space-y-1.5"><Label>Descuento en ese producto</Label><div className="relative"><Input type="number" min="0" max="100" placeholder="0" value={form.descuentoProductoPorcentaje} onChange={(e) => set('descuentoProductoPorcentaje', e.target.value)} /><span className="pointer-events-none absolute right-3 top-2.5 text-sm text-muted-foreground">%</span></div><p className="text-[11px] text-muted-foreground">Opcional. No descuenta los demás productos.</p></div><div className="space-y-1.5"><Label>Cupo de compras</Label><Input type="number" min="1" placeholder="Sin límite" value={form.limiteUsos} onChange={(e) => set('limiteUsos', e.target.value)} /></div><FieldSelect label="Estado" value={form.estado} onValueChange={(v) => set('estado', v as FormCampana['estado'])} options={[["activa", "Activa"], ["borrador", "Borrador"], ["inactiva", "Inactiva"]]} /><div className="space-y-1.5"><Label>Disponible desde</Label><Input type="datetime-local" value={form.fechaInicio} onChange={(e) => set('fechaInicio', e.target.value)} /></div><div className="space-y-1.5"><Label>Disponible hasta</Label><Input type="datetime-local" value={form.fechaFin} onChange={(e) => set('fechaFin', e.target.value)} /></div><div className="space-y-1.5 sm:col-span-2"><Label>Link de campaña</Label><Input disabled value={`my.piru.app/${username ?? 'tu-local'}/c/${form.slug || 'promo'}`} /><p className="text-[11px] text-muted-foreground">La dirección queda fija después de crearla para no perder la medición.</p></div>{error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive sm:col-span-2">{error}</p>}</div><DialogFooter><Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancelar</Button><Button disabled={saving} onClick={onSave}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editando ? 'Guardar cambios' : 'Crear campaña'}</Button></DialogFooter></DialogContent></Dialog>

  /* Implementación anterior pausada: se conserva en el archivo para reactivar
     capacidades de a una, sin volver a inventar su composición visual.
  const recetaElegida = RECETAS.find((item) => item.codigo === form.recetaCodigo)
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{editando ? 'Editar campaña' : 'Nueva campaña'}</DialogTitle><DialogDescription>El Smart Link abre el destino elegido, conserva la atribución y aplica el beneficio en el checkout.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5 sm:col-span-2"><Label>Nombre</Label><Input value={form.nombre} onChange={(e) => { const nombre = e.target.value; setForm((actual) => ({ ...actual, nombre, slug: editando ? actual.slug : slug(nombre) })) }} /></div><div className="space-y-1.5"><Label>Dirección del link</Label><Input disabled={Boolean(editando)} value={form.slug} onChange={(e) => set('slug', slug(e.target.value))} /><p className="text-[11px] text-muted-foreground">my.piru.app/{username ?? 'tu-local'}/c/{form.slug || 'campana'}</p></div><FieldSelect label="Estado" value={form.estado} onValueChange={(v) => set('estado', v as FormCampana['estado'])} options={[['borrador', 'Borrador'], ['activa', 'Activa'], ['inactiva', 'Inactiva']]} /><FieldSelect label="Tipo" value={form.tipo} onValueChange={(v) => set('tipo', v as FormCampana['tipo'])} options={[['adquisicion', 'Adquisición'], ['recompra', 'Recompra']]} /><FieldSelect label="Receta" value={form.recetaCodigo || 'ninguna'} onValueChange={(v) => set('recetaCodigo', v === 'ninguna' ? '' : v)} options={[['ninguna', 'Sin receta'], ...RECETAS.map((r) => [r.codigo, `${r.nombre}${r.descuentoPorcentaje ? ` · ${r.descuentoPorcentaje}% OFF` : ''}`] as [string, string])]} /><FieldSelect label="Al abrir el link" value={form.destinoTipo} onValueChange={(v) => set('destinoTipo', v as FormCampana['destinoTipo'])} options={[['tienda', 'Mostrar la tienda'], ['producto', 'Abrir un producto'], ['carrito', 'Dejar un carrito listo']]} />{form.destinoTipo === 'producto' && <FieldSelect label="Producto" value={form.productoId || 'ninguno'} onValueChange={(v) => set('productoId', v === 'ninguno' ? '' : v)} options={[['ninguno', 'Elegí un producto'], ...productos.map((p) => [String(p.id), p.nombre] as [string, string])]} />}{form.destinoTipo === 'carrito' && <CarritoBuilder productos={productos} value={form.carritoRep} onChange={(value) => set('carritoRep', value)} />}<FieldSelect label="Cupón" value={form.codigoDescuentoId || 'ninguno'} onValueChange={(v) => set('codigoDescuentoId', v === 'ninguno' ? '' : v)} options={[['ninguno', recetaElegida?.descuentoPorcentaje ? `Crear automáticamente ${recetaElegida.descuentoPorcentaje}% OFF` : 'Sin cupón'], ...cupones.filter((c) => c.activo).map((c) => [String(c.id), `${c.codigo} · ${c.tipo === 'porcentaje' ? `${Number(c.valor)}%` : formatCurrency(c.valor)}`] as [string, string])]} /><div className="space-y-1.5"><Label>Inversión manual</Label><Input type="number" min="0" value={form.inversionManual} onChange={(e) => set('inversionManual', e.target.value)} /></div><div className="space-y-1.5 sm:col-span-2"><Label>UTM avanzadas</Label><div className="grid gap-2 sm:grid-cols-2"><Input placeholder="utm_source" value={form.utmSource} onChange={(e) => set('utmSource', e.target.value)} /><Input placeholder="utm_medium" value={form.utmMedium} onChange={(e) => set('utmMedium', e.target.value)} /><Input placeholder="utm_campaign" value={form.utmCampaign} onChange={(e) => set('utmCampaign', e.target.value)} /><Input placeholder="utm_content" value={form.utmContent} onChange={(e) => set('utmContent', e.target.value)} /></div><Input className="mt-2" placeholder="utm_term" value={form.utmTerm} onChange={(e) => set('utmTerm', e.target.value)} /></div><p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground sm:col-span-2">Las campañas por link miden atribución real. El grupo de control no se ofrece acá porque una audiencia pública no es una cohorte cerrada comparable.</p>{error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive sm:col-span-2">{error}</p>}</div><DialogFooter><Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancelar</Button><Button disabled={saving} onClick={onSave}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editando ? 'Guardar cambios' : 'Crear campaña'}</Button></DialogFooter></DialogContent></Dialog>
  */
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

function CuponDialog({ open, onOpenChange, editando, form, setForm, error, saving, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; editando: CodigoDescuentoGrowth | null; form: FormCupon; setForm: React.Dispatch<React.SetStateAction<FormCupon>>; error: string; saving: boolean; onSave: () => void }) {
  const set = <K extends keyof FormCupon>(key: K, value: FormCupon[K]) => setForm((actual) => ({ ...actual, [key]: value }))
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{editando ? 'Editar cupón' : 'Nuevo cupón'}</DialogTitle><DialogDescription>Los resultados se calculan sólo con pedidos cobrados.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5 sm:col-span-2"><Label>Código</Label><Input value={form.codigo} onChange={(e) => set('codigo', e.target.value.toUpperCase())} /></div><FieldSelect label="Tipo" value={form.tipo} onValueChange={(v) => set('tipo', v as FormCupon['tipo'])} options={[['porcentaje', 'Porcentaje'], ['monto_fijo', 'Monto fijo']]} /><div className="space-y-1.5"><Label>Valor</Label><Input type="number" min="0" value={form.valor} onChange={(e) => set('valor', e.target.value)} /></div><div className="space-y-1.5"><Label>Límite de usos</Label><Input type="number" min="0" placeholder="Sin límite" value={form.limiteUsos} onChange={(e) => set('limiteUsos', e.target.value)} /></div><div className="space-y-1.5"><Label>Monto mínimo</Label><Input type="number" min="0" value={form.montoMinimo} onChange={(e) => set('montoMinimo', e.target.value)} /></div><div className="space-y-1.5"><Label>Desde</Label><Input type="datetime-local" value={form.fechaInicio} onChange={(e) => set('fechaInicio', e.target.value)} /></div><div className="space-y-1.5"><Label>Hasta</Label><Input type="datetime-local" value={form.fechaFin} onChange={(e) => set('fechaFin', e.target.value)} /></div>{error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive sm:col-span-2">{error}</p>}</div><DialogFooter><Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancelar</Button><Button disabled={saving} onClick={onSave}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editando ? 'Guardar cambios' : 'Crear cupón'}</Button></DialogFooter></DialogContent></Dialog>
}

function FieldSelect({ label, value, onValueChange, options }: { label: string; value: string; onValueChange: (value: string) => void; options: Array<[string, string]> }) {
  return <div className="space-y-1.5"><Label>{label}</Label><Select value={value} onValueChange={onValueChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{options.map(([key, text]) => <SelectItem key={key} value={key}>{text}</SelectItem>)}</SelectContent></Select></div>
}
