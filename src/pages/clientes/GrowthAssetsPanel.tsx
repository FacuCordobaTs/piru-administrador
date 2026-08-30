import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ApiError, codigosDescuentoApi, crecimientoApi, type CampanaCrecimiento, type CrearCampanaCrecimiento, type RecetaCrecimiento } from '@/lib/api'
import { Copy, Globe2, Loader2, Megaphone, Pencil, Plus, Power, PowerOff, Tag, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { type CodigoDescuentoGrowth, type FiltroCampana, type ProductoGrowth, RECETAS, type ResultadoCampana, type ResultadoCupon, formatCurrency, normalizarHasta } from './types'

type AssetTab = 'campanas' | 'cupones'
type Filtros = { from?: string; to?: string; sucursalId?: number }

interface Props {
  token: string
  username?: string | null
  tab: AssetTab
  onTabChange: (tab: AssetTab) => void
  campanas: CampanaCrecimiento[]
  cupones: CodigoDescuentoGrowth[]
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
}

const slug = (valor: string) => valor.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 191)

type FormCampana = {
  nombre: string; slug: string; tipo: 'adquisicion' | 'recompra'; recetaCodigo: string
  estado: CampanaCrecimiento['estado']; destinoTipo: CampanaCrecimiento['destinoTipo']; productoId: string
  carritoRep: string; codigoDescuentoId: string; inversionManual: string; utmSource: string
  utmMedium: string; utmCampaign: string; utmTerm: string; utmContent: string; usaGrupoControl: boolean
}
const campanaVacia = (): FormCampana => ({ nombre: '', slug: '', tipo: 'adquisicion', recetaCodigo: '', estado: 'borrador', destinoTipo: 'tienda', productoId: '', carritoRep: '', codigoDescuentoId: '', inversionManual: '0', utmSource: '', utmMedium: '', utmCampaign: '', utmTerm: '', utmContent: '', usaGrupoControl: false })
const campanaAForm = (campana: CampanaCrecimiento): FormCampana => ({ nombre: campana.nombre, slug: campana.slug, tipo: campana.tipo, recetaCodigo: campana.recetaCodigo ?? '', estado: campana.estado, destinoTipo: campana.destinoTipo, productoId: campana.productoId?.toString() ?? '', carritoRep: campana.carritoRep ?? '', codigoDescuentoId: campana.codigoDescuentoId?.toString() ?? '', inversionManual: String(campana.inversionManual ?? 0), utmSource: campana.utmSource ?? '', utmMedium: campana.utmMedium ?? '', utmCampaign: campana.utmCampaign ?? '', utmTerm: campana.utmTerm ?? '', utmContent: campana.utmContent ?? '', usaGrupoControl: campana.usaGrupoControl })

type FormCupon = { codigo: string; tipo: 'porcentaje' | 'monto_fijo'; valor: string; limiteUsos: string; montoMinimo: string; fechaInicio: string; fechaFin: string }
const cuponVacio = (): FormCupon => ({ codigo: '', tipo: 'porcentaje', valor: '', limiteUsos: '', montoMinimo: '0', fechaInicio: '', fechaFin: '' })
const cuponAForm = (cupon: CodigoDescuentoGrowth): FormCupon => ({ codigo: cupon.codigo, tipo: cupon.tipo, valor: cupon.valor, limiteUsos: cupon.limiteUsos?.toString() ?? '', montoMinimo: cupon.montoMinimo ?? '0', fechaInicio: cupon.fechaInicio?.slice(0, 16) ?? '', fechaFin: cupon.fechaFin?.slice(0, 16) ?? '' })

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg bg-muted/55 p-2.5"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold tabular-nums">{value}</p></div>
}

export default function GrowthAssetsPanel(props: Props) {
  const { token, tab, onTabChange, campanas, cupones, query, filtros, campanaSeleccionada, cuponSeleccionado } = props
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

  const campanasFiltradas = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? campanas.filter((item) => `${item.nombre} ${item.slug} ${item.utmSource ?? ''}`.toLowerCase().includes(q)) : campanas
  }, [campanas, query])
  const cuponesFiltrados = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? cupones.filter((item) => item.codigo.toLowerCase().includes(q)) : cupones
  }, [cupones, query])
  const campanaActual = typeof campanaSeleccionada === 'number' ? campanas.find((item) => item.id === campanaSeleccionada) ?? null : null
  const cuponActual = cuponSeleccionado != null ? cupones.find((item) => item.id === cuponSeleccionado) ?? null : null

  const abrirCampana = (campana?: CampanaCrecimiento) => { setCampanaEditando(campana ?? null); setFormCampana(campana ? campanaAForm(campana) : campanaVacia()); setError(''); setCampanaDialog(true) }
  const abrirCupon = (cupon?: CodigoDescuentoGrowth) => { setCuponEditando(cupon ?? null); setFormCupon(cupon ? cuponAForm(cupon) : cuponVacio()); setError(''); setCuponDialog(true) }

  const payloadCampana = (): CrearCampanaCrecimiento | null => {
    const inversion = Number(formCampana.inversionManual || 0)
    if (!formCampana.nombre.trim() || !formCampana.slug.trim()) { setError('Completá el nombre y el slug.'); return null }
    if (formCampana.destinoTipo === 'producto' && !formCampana.productoId) { setError('Elegí un producto de destino.'); return null }
    if (formCampana.destinoTipo === 'carrito' && !/^\d+x\d+(?:-\d+x\d+)*$/.test(formCampana.carritoRep)) { setError('El carrito debe usar el formato 12x2-15x1.'); return null }
    if (!Number.isFinite(inversion) || inversion < 0) { setError('La inversión debe ser un monto válido.'); return null }
    return {
      nombre: formCampana.nombre.trim(), slug: formCampana.slug, tipo: formCampana.tipo,
      recetaCodigo: (formCampana.recetaCodigo || null) as RecetaCrecimiento | null, estado: formCampana.estado,
      destinoTipo: formCampana.destinoTipo, productoId: formCampana.destinoTipo === 'producto' ? Number(formCampana.productoId) : null,
      carritoRep: formCampana.destinoTipo === 'carrito' ? formCampana.carritoRep : null,
      codigoDescuentoId: formCampana.codigoDescuentoId ? Number(formCampana.codigoDescuentoId) : null,
      inversionManual: inversion, utmSource: formCampana.utmSource || null, utmMedium: formCampana.utmMedium || null,
      utmCampaign: formCampana.utmCampaign || null, utmTerm: formCampana.utmTerm || null, utmContent: formCampana.utmContent || null,
      usaGrupoControl: formCampana.usaGrupoControl,
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

  return <aside className="flex min-h-[520px] flex-col overflow-hidden xl:min-h-0">
    <div className="p-3">
      <Tabs value={tab} onValueChange={(value) => onTabChange(value as AssetTab)}>
        <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="campanas">Campañas</TabsTrigger><TabsTrigger value="cupones">Cupones</TabsTrigger></TabsList>
      </Tabs>
      <Button className="mt-3 w-full" size="sm" disabled={tab === 'campanas' ? !props.crecimientoActivo : !props.cuponesActivos} onClick={() => tab === 'campanas' ? abrirCampana() : abrirCupon()}><Plus className="mr-2 h-4 w-4" />{tab === 'campanas' ? 'Nueva campaña' : 'Nuevo cupón'}</Button>
    </div>

    <ScrollArea className="min-h-0 flex-1">
      <div className="space-y-2 p-3">
        {tab === 'campanas' ? <>
          {!props.crecimientoActivo && <Disabled label="Crecimiento está desactivado" />}
          {props.crecimientoActivo && (!query.trim() || 'orgánico sin campaña directo'.includes(query.trim().toLowerCase())) && <AssetButton active={campanaSeleccionada === 'organico'} onClick={() => props.onSelectCampana(campanaSeleccionada === 'organico' ? null : 'organico')} icon={<Globe2 className="h-4 w-4" />} title="Orgánico · sin campaña" subtitle="Visitas directas y compras sin touch de campaña" badge="Siempre disponible" />}
          {props.crecimientoActivo && campanasFiltradas.map((campana) => <AssetButton key={campana.id} active={campanaSeleccionada === campana.id} onClick={() => props.onSelectCampana(campanaSeleccionada === campana.id ? null : campana.id)} icon={<Megaphone className="h-4 w-4" />} title={campana.nombre} subtitle={`/c/${campana.slug}`} badge={campana.estado} />)}
          {props.crecimientoActivo && campanasFiltradas.length === 0 && query.trim() && <Empty label="No hay campañas que coincidan." />}
        </> : <>
          {!props.cuponesActivos && <Disabled label="Códigos de descuento está desactivado" />}
          {props.cuponesActivos && cuponesFiltrados.map((cupon) => <AssetButton key={cupon.id} active={cuponSeleccionado === cupon.id} onClick={() => props.onSelectCupon(cuponSeleccionado === cupon.id ? null : cupon.id)} icon={<Tag className="h-4 w-4" />} title={cupon.codigo} subtitle={cupon.tipo === 'porcentaje' ? `${Number(cupon.valor)}% OFF` : `${formatCurrency(cupon.valor)} OFF`} badge={cupon.activo ? 'activo' : 'inactivo'} />)}
          {props.cuponesActivos && cuponesFiltrados.length === 0 && <Empty label="Todavía no hay cupones." />}
        </>}

        {loadingDetalle && <div className="flex items-center justify-center py-10 text-xs text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Calculando resultados…</div>}
        {!loadingDetalle && tab === 'campanas' && campanaSeleccionada != null && resultadoCampana && <CampaignDetail organic={campanaSeleccionada === 'organico'} campana={campanaActual} resultado={resultadoCampana} onCopy={() => campanaActual && void copiarCampana(campanaActual)} onEdit={() => campanaActual && abrirCampana(campanaActual)} onToggle={() => campanaActual && void toggleCampana(campanaActual)} onDelete={() => campanaActual && void borrarCampana(campanaActual)} />}
        {!loadingDetalle && tab === 'cupones' && cuponActual && resultadoCupon && <CouponDetail cupon={cuponActual} resultado={resultadoCupon} onClient={props.onSelectClient} onEdit={() => abrirCupon(cuponActual)} onToggle={() => void toggleCupon(cuponActual)} onDelete={() => void borrarCupon(cuponActual)} />}
      </div>
    </ScrollArea>

    <CampanaDialog open={campanaDialog} onOpenChange={setCampanaDialog} editando={campanaEditando} form={formCampana} setForm={setFormCampana} productos={props.productos} cupones={cupones} error={error} saving={saving} onSave={() => void guardarCampana()} username={props.username} />
    <CuponDialog open={cuponDialog} onOpenChange={setCuponDialog} editando={cuponEditando} form={formCupon} setForm={setFormCupon} error={error} saving={saving} onSave={() => void guardarCupon()} />
  </aside>
}

function AssetButton({ active, onClick, icon, title, subtitle, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; subtitle: string; badge: string }) {
  return <button type="button" onClick={onClick} className={`w-full rounded-xl border-0 p-3 text-left transition-colors ${active ? 'border-l-[3px] border-l-[#FF7A00] bg-muted/40' : 'bg-white hover:bg-muted/40 dark:bg-muted/20'}`}><div className="flex items-start gap-2.5"><span className={`mt-0.5 ${active ? 'text-[#FF7A00]' : 'text-muted-foreground'}`}>{icon}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{title}</span><span className="block truncate text-[11px] text-muted-foreground">{subtitle}</span></span><Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[9px] capitalize">{badge}</Badge></div></button>
}
function Empty({ label }: { label: string }) { return <p className="rounded-xl bg-muted/30 p-6 text-center text-xs text-muted-foreground">{label}</p> }
function Disabled({ label }: { label: string }) { return <div className="rounded-xl bg-muted/30 p-4 text-center"><p className="text-xs font-medium">{label}</p><p className="mt-1 text-[11px] text-muted-foreground">Podés activarlo desde Módulos.</p></div> }

function CampaignDetail({ organic, campana, resultado, onCopy, onEdit, onToggle, onDelete }: { organic: boolean; campana: CampanaCrecimiento | null; resultado: ResultadoCampana; onCopy: () => void; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  const m = resultado.metricas
  return <div className="mt-4 space-y-3 pt-4">
    <div><div className="flex items-center gap-2"><h3 className="text-sm font-semibold">{organic ? 'Orgánico · sin campaña' : campana?.nombre}</h3>{organic && <Badge className="bg-sky-600 hover:bg-sky-600">Vista automática</Badge>}</div><p className="mt-1 text-xs text-muted-foreground">{organic ? 'Personas que llegaron directamente a la tienda, sin Smart Link ni receta atribuible.' : `${campana?.tipo === 'adquisicion' ? 'Adquisición' : 'Recompra'} · ${campana?.estado}`}</p></div>
    <div className="grid grid-cols-2 gap-2"><Metric label="Ventas cobradas" value={formatCurrency(m.ventas)} /><Metric label="Pedidos" value={m.pedidos} /><Metric label="Clientes nuevos" value={m.clientesNuevos} /><Metric label="Conversión" value={`${m.conversion}%`} /><Metric label="Sesiones" value={m.sesiones} /><Metric label="Ticket" value={formatCurrency(m.ticketPromedio)} /></div>
    <div className="rounded-lg bg-muted/40 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Embudo</p><div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs"><span>Vistas de producto</span><strong className="text-right">{resultado.funnel.product_view}</strong><span>Agregaron al carrito</span><strong className="text-right">{resultado.funnel.add_to_cart}</strong><span>Iniciaron checkout</span><strong className="text-right">{resultado.funnel.checkout_start}</strong><span>Compraron</span><strong className="text-right">{resultado.funnel.purchase}</strong></div></div>
    {!organic && campana && <><div className="rounded-lg bg-muted/50 p-3 text-xs"><p><strong>Destino:</strong> {campana.destinoTipo}</p><p className="mt-1"><strong>Receta:</strong> {campana.recetaCodigo ? RECETAS.find((r) => r.codigo === campana.recetaCodigo)?.nombre : 'Audiencia abierta'}</p><p className="mt-1"><strong>Inversión:</strong> {formatCurrency(campana.inversionManual)}</p><p className="mt-1 break-all"><strong>UTM:</strong> {[campana.utmSource, campana.utmMedium, campana.utmCampaign].filter(Boolean).join(' · ') || 'Sin parámetros'}</p></div><div className="grid grid-cols-2 gap-2"><Button size="sm" variant="outline" onClick={onCopy}><Copy className="mr-1.5 h-3.5 w-3.5" />Copiar link</Button><Button size="sm" variant="outline" onClick={onEdit}><Pencil className="mr-1.5 h-3.5 w-3.5" />Editar</Button><Button size="sm" variant="outline" onClick={onToggle}>{campana.estado === 'activa' ? <PowerOff className="mr-1.5 h-3.5 w-3.5" /> : <Power className="mr-1.5 h-3.5 w-3.5" />}{campana.estado === 'activa' ? 'Desactivar' : 'Activar'}</Button><Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Eliminar</Button></div></>}
  </div>
}

function CouponDetail({ cupon, resultado, onClient, onEdit, onToggle, onDelete }: { cupon: CodigoDescuentoGrowth; resultado: ResultadoCupon; onClient: (id: number) => void; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  const m = resultado.metricas
  return <div className="mt-4 space-y-3 pt-4"><div className="flex items-start justify-between gap-2"><div><h3 className="text-sm font-semibold">{cupon.codigo}</h3><p className="text-xs text-muted-foreground">{cupon.tipo === 'porcentaje' ? `${Number(cupon.valor)}% OFF` : `${formatCurrency(cupon.valor)} OFF`} · {cupon.activo ? 'Activo' : 'Inactivo'}</p></div><Badge variant="outline">{cupon.limiteUsos == null ? 'Sin límite' : `${cupon.usosActuales}/${cupon.limiteUsos}`}</Badge></div><div className="grid grid-cols-2 gap-2"><Metric label="Facturación cobrada" value={formatCurrency(m.facturacionCobrada)} /><Metric label="Pesos descontados" value={formatCurrency(m.montoDescontado)} /><Metric label="Usos cobrados" value={m.usos} /><Metric label="Clientes" value={m.clientes} /><Metric label="Venta antes del descuento" value={formatCurrency(m.ventasAntesDescuento)} /><Metric label="Ticket" value={formatCurrency(m.ticketPromedio)} /></div><div className="rounded-lg bg-muted/40 p-3"><p className="flex items-center gap-1.5 text-xs font-semibold"><Users className="h-3.5 w-3.5" />Clientes que lo usaron</p>{resultado.clientes.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">Todavía no tiene usos cobrados en este período.</p> : <div className="mt-2 space-y-1">{resultado.clientes.slice(0, 8).map((cliente) => <button key={cliente.id} onClick={() => onClient(cliente.id)} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-background/70"><span className="truncate">{cliente.nombre}</span><span className="shrink-0 text-muted-foreground">{cliente.usos} usos · {formatCurrency(cliente.facturacion)}</span></button>)}</div>}</div><div className="grid grid-cols-3 gap-2"><Button size="sm" variant="outline" onClick={onEdit}><Pencil className="mr-1 h-3.5 w-3.5" />Editar</Button><Button size="sm" variant="outline" onClick={onToggle}>{cupon.activo ? 'Desactivar' : 'Activar'}</Button><Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="mr-1 h-3.5 w-3.5" />Eliminar</Button></div></div>
}

function CampanaDialog({ open, onOpenChange, editando, form, setForm, productos, cupones, error, saving, onSave, username }: { open: boolean; onOpenChange: (open: boolean) => void; editando: CampanaCrecimiento | null; form: FormCampana; setForm: React.Dispatch<React.SetStateAction<FormCampana>>; productos: ProductoGrowth[]; cupones: CodigoDescuentoGrowth[]; error: string; saving: boolean; onSave: () => void; username?: string | null }) {
  const set = <K extends keyof FormCampana>(key: K, value: FormCampana[K]) => setForm((actual) => ({ ...actual, [key]: value }))
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{editando ? 'Editar campaña' : 'Nueva campaña'}</DialogTitle><DialogDescription>El Smart Link queda medible desde la primera visita. El slug no cambia al editar el nombre.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5 sm:col-span-2"><Label>Nombre</Label><Input value={form.nombre} onChange={(e) => { const nombre = e.target.value; setForm((actual) => ({ ...actual, nombre, slug: editando ? actual.slug : slug(nombre) })) }} /></div><div className="space-y-1.5"><Label>Slug estable</Label><Input disabled={Boolean(editando)} value={form.slug} onChange={(e) => set('slug', slug(e.target.value))} /><p className="text-[11px] text-muted-foreground">my.piru.app/{username ?? 'tu-local'}/c/{form.slug || 'campana'}</p></div><FieldSelect label="Estado" value={form.estado} onValueChange={(v) => set('estado', v as FormCampana['estado'])} options={[['borrador', 'Borrador'], ['activa', 'Activa'], ['inactiva', 'Inactiva']]} /><FieldSelect label="Tipo" value={form.tipo} onValueChange={(v) => set('tipo', v as FormCampana['tipo'])} options={[['adquisicion', 'Adquisición'], ['recompra', 'Recompra']]} /><FieldSelect label="Receta / audiencia" value={form.recetaCodigo || 'ninguna'} onValueChange={(v) => set('recetaCodigo', v === 'ninguna' ? '' : v)} options={[['ninguna', 'Audiencia abierta'], ...RECETAS.map((r) => [r.codigo, r.nombre] as [string, string])]} /><FieldSelect label="Destino" value={form.destinoTipo} onValueChange={(v) => set('destinoTipo', v as FormCampana['destinoTipo'])} options={[['tienda', 'Tienda'], ['producto', 'Producto'], ['carrito', 'Carrito']]} />{form.destinoTipo === 'producto' && <FieldSelect label="Producto" value={form.productoId || 'ninguno'} onValueChange={(v) => set('productoId', v === 'ninguno' ? '' : v)} options={[['ninguno', 'Elegí un producto'], ...productos.map((p) => [String(p.id), p.nombre] as [string, string])]} />}{form.destinoTipo === 'carrito' && <div className="space-y-1.5 sm:col-span-2"><Label>Carrito</Label><Input placeholder="12x2-15x1" value={form.carritoRep} onChange={(e) => set('carritoRep', e.target.value)} /></div>}<FieldSelect label="Cupón opcional" value={form.codigoDescuentoId || 'ninguno'} onValueChange={(v) => set('codigoDescuentoId', v === 'ninguno' ? '' : v)} options={[['ninguno', 'Sin cupón'], ...cupones.filter((c) => c.activo).map((c) => [String(c.id), c.codigo] as [string, string])]} /><div className="space-y-1.5"><Label>Inversión manual</Label><Input type="number" min="0" value={form.inversionManual} onChange={(e) => set('inversionManual', e.target.value)} /></div><div className="space-y-1.5 sm:col-span-2"><Label>UTM avanzadas</Label><div className="grid gap-2 sm:grid-cols-2"><Input placeholder="utm_source" value={form.utmSource} onChange={(e) => set('utmSource', e.target.value)} /><Input placeholder="utm_medium" value={form.utmMedium} onChange={(e) => set('utmMedium', e.target.value)} /><Input placeholder="utm_campaign" value={form.utmCampaign} onChange={(e) => set('utmCampaign', e.target.value)} /><Input placeholder="utm_content" value={form.utmContent} onChange={(e) => set('utmContent', e.target.value)} /></div><Input className="mt-2" placeholder="utm_term" value={form.utmTerm} onChange={(e) => set('utmTerm', e.target.value)} /></div><label className="flex gap-3 rounded-lg border p-3 text-sm sm:col-span-2"><Checkbox checked={form.usaGrupoControl} onChange={(e) => set('usaGrupoControl', e.target.checked)} /><span>Preservar grupo de control cuando exista una cohorte comparable.</span></label>{error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive sm:col-span-2">{error}</p>}</div><DialogFooter><Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancelar</Button><Button disabled={saving} onClick={onSave}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editando ? 'Guardar cambios' : 'Crear campaña'}</Button></DialogFooter></DialogContent></Dialog>
}

function CuponDialog({ open, onOpenChange, editando, form, setForm, error, saving, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; editando: CodigoDescuentoGrowth | null; form: FormCupon; setForm: React.Dispatch<React.SetStateAction<FormCupon>>; error: string; saving: boolean; onSave: () => void }) {
  const set = <K extends keyof FormCupon>(key: K, value: FormCupon[K]) => setForm((actual) => ({ ...actual, [key]: value }))
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{editando ? 'Editar cupón' : 'Nuevo cupón'}</DialogTitle><DialogDescription>Los resultados se calculan sólo con pedidos cobrados.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5 sm:col-span-2"><Label>Código</Label><Input value={form.codigo} onChange={(e) => set('codigo', e.target.value.toUpperCase())} /></div><FieldSelect label="Tipo" value={form.tipo} onValueChange={(v) => set('tipo', v as FormCupon['tipo'])} options={[['porcentaje', 'Porcentaje'], ['monto_fijo', 'Monto fijo']]} /><div className="space-y-1.5"><Label>Valor</Label><Input type="number" min="0" value={form.valor} onChange={(e) => set('valor', e.target.value)} /></div><div className="space-y-1.5"><Label>Límite de usos</Label><Input type="number" min="0" placeholder="Sin límite" value={form.limiteUsos} onChange={(e) => set('limiteUsos', e.target.value)} /></div><div className="space-y-1.5"><Label>Monto mínimo</Label><Input type="number" min="0" value={form.montoMinimo} onChange={(e) => set('montoMinimo', e.target.value)} /></div><div className="space-y-1.5"><Label>Desde</Label><Input type="datetime-local" value={form.fechaInicio} onChange={(e) => set('fechaInicio', e.target.value)} /></div><div className="space-y-1.5"><Label>Hasta</Label><Input type="datetime-local" value={form.fechaFin} onChange={(e) => set('fechaFin', e.target.value)} /></div>{error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive sm:col-span-2">{error}</p>}</div><DialogFooter><Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancelar</Button><Button disabled={saving} onClick={onSave}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editando ? 'Guardar cambios' : 'Crear cupón'}</Button></DialogFooter></DialogContent></Dialog>
}

function FieldSelect({ label, value, onValueChange, options }: { label: string; value: string; onValueChange: (value: string) => void; options: Array<[string, string]> }) {
  return <div className="space-y-1.5"><Label>{label}</Label><Select value={value} onValueChange={onValueChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{options.map(([key, text]) => <SelectItem key={key} value={key}>{text}</SelectItem>)}</SelectContent></Select></div>
}
