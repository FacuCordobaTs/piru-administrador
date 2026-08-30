import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { BarChart3, CheckCircle2, CircleAlert, Copy, Crown, ExternalLink, Lightbulb, Loader2, Megaphone, Pencil, Plus, RefreshCw, Send, ShieldAlert, Sparkles, Trash2, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError, codigosDescuentoApi, crecimientoApi, mensajesApi, productosApi, sucursalesApi, type CampanaCrecimiento, type CrearCampanaCrecimiento, type EnlaceCrecimiento, type FiltrosCrecimiento, type OportunidadCrecimiento, type RecetaCrecimiento, type ResumenCrecimiento, type SegmentoCrecimiento, type WalletResumen } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

type TabCrecimiento = 'resumen' | 'oportunidades' | 'campanas' | 'resultados'
type EstadoCarga = 'cargando' | 'error' | 'vacio' | 'listo'
type AccionContacto = 'copiar' | 'wa_me' | 'piru_whatsapp'

const TAB_META: Record<TabCrecimiento, { etiqueta: string; descripcion: string; icono: typeof Sparkles }> = {
  resumen: { etiqueta: 'Resumen', descripcion: 'La actividad comercial y el retorno de tus acciones.', icono: Sparkles },
  oportunidades: { etiqueta: 'Oportunidades', descripcion: 'Clientes con una acción sugerida según su ritmo.', icono: Lightbulb },
  campanas: { etiqueta: 'Campañas', descripcion: 'Smart Links y campañas de adquisición o recompra.', icono: Megaphone },
  resultados: { etiqueta: 'Resultados', descripcion: 'Ventas, atribución e impacto de tus campañas.', icono: BarChart3 },
}

const SEGMENTOS: Array<{ value: SegmentoCrecimiento; label: string }> = [
  { value: 'nuevo', label: 'Nuevo' }, { value: 'activo', label: 'Activo' }, { value: 'vip', label: 'VIP' },
  { value: 'en_riesgo', label: 'En riesgo' }, { value: 'dormido', label: 'Dormido' }, { value: 'perdido', label: 'Perdido' },
]
const RECETAS: Array<{ value: RecetaCrecimiento; label: string }> = [
  { value: 'segunda_compra', label: 'Segunda compra' }, { value: 'mantener_ritmo', label: 'Mantené su ritmo' },
  { value: 'beneficio_vip', label: 'Beneficio VIP' }, { value: 'volver_a_tiempo', label: 'Volvé a tiempo' },
  { value: 'recuperar_habito', label: 'Recuperá el hábito' }, { value: 'ultimo_intento', label: 'Último intento' },
]
const ARS = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
const formatearPesos = (valor: number) => ARS.format(valor)
const nuevaClave = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`

type ProductoCampana = { id: number; nombre: string }
type CuponCampana = { id: number; codigo: string; activo?: boolean }
type FormCampana = {
  nombre: string; slug: string; tipo: 'adquisicion' | 'recompra'; recetaCodigo: string; estado: CampanaCrecimiento['estado']; destinoTipo: CampanaCrecimiento['destinoTipo']; productoId: string; carritoRep: string; codigoDescuentoId: string; utmSource: string; utmMedium: string; utmCampaign: string; utmTerm: string; utmContent: string; inversionManual: string; usaGrupoControl: boolean
}
const formCampanaVacio = (): FormCampana => ({ nombre: '', slug: '', tipo: 'adquisicion', recetaCodigo: '', estado: 'borrador', destinoTipo: 'tienda', productoId: '', carritoRep: '', codigoDescuentoId: '', utmSource: '', utmMedium: '', utmCampaign: '', utmTerm: '', utmContent: '', inversionManual: '0', usaGrupoControl: false })
const aFormCampana = (campana: CampanaCrecimiento): FormCampana => ({ nombre: campana.nombre, slug: campana.slug, tipo: campana.tipo, recetaCodigo: campana.recetaCodigo ?? '', estado: campana.estado, destinoTipo: campana.destinoTipo, productoId: campana.productoId?.toString() ?? '', carritoRep: campana.carritoRep ?? '', codigoDescuentoId: campana.codigoDescuentoId?.toString() ?? '', utmSource: campana.utmSource ?? '', utmMedium: campana.utmMedium ?? '', utmCampaign: campana.utmCampaign ?? '', utmTerm: campana.utmTerm ?? '', utmContent: campana.utmContent ?? '', inversionManual: String(campana.inversionManual ?? 0), usaGrupoControl: campana.usaGrupoControl })
const slugAutomatico = (valor: string) => valor.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 191)

function EstadoVacio({ titulo, detalle, accion, onClick }: { titulo: string; detalle: string; accion?: string; onClick?: () => void }) {
  return <div className="rounded-xl border border-dashed border-border bg-white/60 px-6 py-12 text-center dark:bg-muted/20">
    <h2 className="font-semibold text-foreground">{titulo}</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{detalle}</p>
    {accion && onClick && <Button variant="outline" className="mt-5" onClick={onClick}><RefreshCw className="mr-2 h-4 w-4" />{accion}</Button>}
  </div>
}

function Metric({ etiqueta, valor }: { etiqueta: string; valor: string | number }) {
  return <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">{etiqueta}</p><p className="mt-1 font-semibold tabular-nums">{valor}</p></div>
}

function destinoLabel(oportunidad: OportunidadCrecimiento) {
  if (oportunidad.destino.tipo === 'carrito') return 'Su último carrito'
  if (oportunidad.destino.tipo === 'producto') return oportunidad.destino.nombreProducto ?? 'Producto favorito'
  return 'La tienda'
}

/** La misma tarjeta se usa en la lista y en la ficha: el detalle sólo habilita más contexto y acciones. */
function OportunidadCard({ oportunidad, detalle = false, onAbrir }: { oportunidad: OportunidadCrecimiento; detalle?: boolean; onAbrir?: () => void }) {
  const bloqueo = oportunidad.elegibilidad.bloqueos[0]
  const incentivo = oportunidad.incentivoSugerido.descuentoPorcentaje
  return <article className={`rounded-xl border p-4 ${oportunidad.prioridad === 'alta' ? 'border-amber-300 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20' : 'border-border bg-white dark:bg-muted/20'}`}>
    <div className="flex items-start justify-between gap-3"><div>
      <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{oportunidad.cliente.nombre}</h3>
        <Badge variant="secondary">{SEGMENTOS.find(s => s.value === oportunidad.diagnostico.segmento)?.label ?? oportunidad.diagnostico.segmento}</Badge>
        {oportunidad.diagnostico.esVip && <Badge className="bg-amber-500 text-white hover:bg-amber-500"><Crown className="mr-1 h-3 w-3" />VIP</Badge>}
      </div><p className="mt-1 text-sm text-muted-foreground">{oportunidad.tituloOportunidad}</p>
    </div>{oportunidad.prioridad === 'alta' && <Badge className="shrink-0">Prioridad alta</Badge>}</div>
    <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3"><div><span className="text-muted-foreground">Receta</span><p className="font-medium">{oportunidad.receta.nombre}</p></div><div><span className="text-muted-foreground">Destino</span><p className="font-medium">{destinoLabel(oportunidad)}</p></div><div><span className="text-muted-foreground">Valor histórico</span><p className="font-medium">{formatearPesos(oportunidad.diagnostico.totalGastado)}</p></div></div>
    {incentivo > 0 && <p className="mt-3 text-sm"><span className="font-medium">Sugerencia:</span> {incentivo}% OFF{oportunidad.incentivoSugerido.expiraHoras ? ` por ${oportunidad.incentivoSugerido.expiraHoras} h` : ''}. Confirmalo antes de crear el cupón.</p>}
    {bloqueo ? <div className="mt-3 flex gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />{bloqueo.mensaje}</div> : <p className="mt-3 text-xs text-muted-foreground">{oportunidad.diagnostico.cantidadPedidos} pedidos · ticket {formatearPesos(oportunidad.diagnostico.ticketPromedio)}</p>}
    {detalle && <div className="mt-4 rounded-lg bg-muted/50 p-3 text-sm"><p className="font-medium">Mensaje sugerido</p><p className="mt-1 whitespace-pre-wrap text-muted-foreground">{oportunidad.textoSugerido}</p></div>}
    {onAbrir && <Button className="mt-4 w-full sm:w-auto" variant={bloqueo ? 'outline' : 'default'} onClick={onAbrir}>{bloqueo ? 'Ver diagnóstico' : detalle ? 'Preparar contacto' : 'Ver oportunidad'}</Button>}
  </article>
}

function Oportunidades({ token }: { token: string }) {
  const navigate = useNavigate()
  const [estado, setEstado] = useState<EstadoCarga>('cargando')
  const [error, setError] = useState('')
  const [items, setItems] = useState<OportunidadCrecimiento[]>([])
  const [segmento, setSegmento] = useState<string>('todos')
  const [receta, setReceta] = useState<string>('todas')
  const [seleccionada, setSeleccionada] = useState<OportunidadCrecimiento | null>(null)

  const cargar = useCallback(async () => {
    setEstado('cargando'); setError('')
    try {
      const respuesta = await crecimientoApi.oportunidades(token, {
        ...(segmento !== 'todos' ? { segmento: segmento as SegmentoCrecimiento } : {}),
        ...(receta !== 'todas' ? { receta: receta as RecetaCrecimiento } : {}),
      })
      setItems(respuesta.data.oportunidades); setEstado(respuesta.data.total ? 'listo' : 'vacio')
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : 'No se pudieron cargar las oportunidades.'); setEstado('error') }
  }, [token, segmento, receta])
  useEffect(() => { void cargar() }, [cargar])

  const abrirFicha = async (item: OportunidadCrecimiento) => {
    setSeleccionada(item)
    try { const respuesta = await crecimientoApi.recomendacion(token, item.cliente.id); setSeleccionada(respuesta.data) }
    catch { /* La lista ya trae una recomendación completa y permite trabajar sin esta mejora. */ }
  }
  return <>
    <div className="mb-4 flex flex-col gap-3 sm:flex-row"><Select value={segmento} onValueChange={setSegmento}><SelectTrigger className="sm:w-48"><SelectValue placeholder="Todos los segmentos" /></SelectTrigger><SelectContent><SelectItem value="todos">Todos los segmentos</SelectItem>{SEGMENTOS.map(x => <SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}</SelectContent></Select>
      <Select value={receta} onValueChange={setReceta}><SelectTrigger className="sm:w-56"><SelectValue placeholder="Todas las recetas" /></SelectTrigger><SelectContent><SelectItem value="todas">Todas las recetas</SelectItem>{RECETAS.map(x => <SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}</SelectContent></Select></div>
    {estado === 'cargando' && <div className="space-y-3"><Skeleton className="h-44 w-full" /><Skeleton className="h-44 w-full" /></div>}
    {estado === 'error' && <EstadoVacio titulo="No pudimos cargar las oportunidades" detalle={error} accion="Reintentar" onClick={() => void cargar()} />}
    {estado === 'vacio' && <EstadoVacio titulo="No hay oportunidades con estos filtros" detalle="Cuando haya clientes con una acción sugerida según su ritmo, van a aparecer acá." />}
    {estado === 'listo' && <div className="space-y-3">{items.map(item => <OportunidadCard key={item.cliente.id} oportunidad={item} onAbrir={() => void abrirFicha(item)} />)}</div>}
    <FichaOportunidad oportunidad={seleccionada} token={token} onClose={() => setSeleccionada(null)} onRecargar={() => navigate('/dashboard/mensajes')} />
  </>
}

function FichaOportunidad({ oportunidad, token, onClose, onRecargar }: { oportunidad: OportunidadCrecimiento | null; token: string; onClose: () => void; onRecargar: () => void }) {
  const oportunidadActual = oportunidad
  const [saldo, setSaldo] = useState<WalletResumen | null>(null)
  const [cargandoSaldo, setCargandoSaldo] = useState(false)
  const [confirmoIncentivo, setConfirmoIncentivo] = useState(false)
  const [enlace, setEnlace] = useState<EnlaceCrecimiento | null>(null)
  const [tokenEnlace, setTokenEnlace] = useState<string | null>(null)
  const [accion, setAccion] = useState<AccionContacto | null>(null)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')
  const [claves, setClaves] = useState<Record<string, string>>({})
  const reiniciar = () => { setSaldo(null); setConfirmoIncentivo(false); setEnlace(null); setTokenEnlace(null); setAccion(null); setProcesando(false); setError(''); setClaves({}) }
  useEffect(() => { if (!oportunidad) return; reiniciar(); setCargandoSaldo(true); void mensajesApi.saldo(token).then(r => setSaldo(r.data)).catch(() => setSaldo(null)).finally(() => setCargandoSaldo(false)) }, [oportunidad?.cliente.id, token])
  const clave = (paso: string) => { const existente = claves[paso]; if (existente) return existente; const nueva = nuevaClave(); setClaves(actual => ({ ...actual, [paso]: nueva })); return nueva }
  const preparar = async () => {
    if (!oportunidad) return
    if (oportunidad.incentivoSugerido.descuentoPorcentaje > 0 && !confirmoIncentivo) { setError('Confirmá el beneficio antes de crear un cupón de un solo uso.'); return }
    setProcesando(true); setError('')
    try { const r = await crecimientoApi.prepararEnlace(token, { clienteId: oportunidad.cliente.id, recetaCodigo: oportunidad.receta.codigo, incentivo: oportunidad.incentivoSugerido, incentivoConfirmado: confirmoIncentivo, idempotenciaClave: clave('preparar') }); setEnlace(r.data.enlace); setTokenEnlace(r.data.token ?? null); toast.success('Enlace preparado. Todavía no se envió ningún mensaje.') }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : 'No se pudo preparar el enlace.') } finally { setProcesando(false) }
  }
  const contactar = async (canal: AccionContacto) => {
    if (!enlace || !tokenEnlace) { setError('Prepará primero un enlace individual para esta oportunidad.'); return }
    if (canal === 'piru_whatsapp' && saldo && saldo.marketing.disponible < 1) return
    setProcesando(true); setError('')
    try {
      const data = { token: tokenEnlace, idempotenciaClave: clave(canal) }
      if (canal === 'copiar') { const r = await crecimientoApi.copiarEnlace(token, enlace.id, data); await navigator.clipboard.writeText(r.data.url); toast.success('Enlace copiado. Piru no puede saber si después se envió.') }
      if (canal === 'wa_me') { const r = await crecimientoApi.abrirWaMe(token, enlace.id, data); window.open(r.data.waMeUrl, '_blank', 'noopener,noreferrer'); toast.success('Abrimos WhatsApp con el mensaje listo; todavía no fue enviado.') }
      if (canal === 'piru_whatsapp') { const r = await crecimientoApi.enviarConPiru(token, enlace.id, data); if (!r.data.entregado) throw new Error('El proveedor no confirmó la entrega.'); toast.success('Mensaje enviado con Piru. Se consumió 1 crédito de campaña.'); setSaldo(actual => actual ? { ...actual, marketing: { ...actual.marketing, disponible: actual.marketing.disponible - 1 } } : actual) }
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : cause instanceof Error ? cause.message : 'La acción no se pudo completar. Podés reintentarla sin duplicar el contacto.') } finally { setProcesando(false) }
  }
  const bloqueada = Boolean(oportunidad?.elegibilidad.bloqueos.length)
  const sinSaldo = saldo != null && saldo.marketing.disponible < 1
  return <Dialog open={Boolean(oportunidad)} onOpenChange={(open) => { if (!open) { reiniciar(); onClose() } }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Ficha de oportunidad</DialogTitle><DialogDescription>Preparar, copiar o abrir WhatsApp no equivale a enviar un mensaje.</DialogDescription></DialogHeader>
    {oportunidad && <div className="space-y-4"><OportunidadCard oportunidad={oportunidad} detalle />
      {bloqueada ? <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><div className="flex gap-2"><ShieldAlert className="h-4 w-4 shrink-0" /><span>{oportunidad.elegibilidad.bloqueos.map(x => x.mensaje).join(' ')}</span></div><p className="mt-2">Para proteger a esta persona, Piru no habilita contacto desde esta ficha.</p></div> : <>
        {oportunidadActual!.incentivoSugerido.descuentoPorcentaje > 0 && <label className="flex cursor-pointer gap-3 rounded-lg border p-3 text-sm"><Checkbox checked={confirmoIncentivo} onChange={(event) => setConfirmoIncentivo(event.target.checked)} /><span>Confirmo ofrecer {oportunidadActual!.incentivoSugerido.descuentoPorcentaje}% OFF{oportunidadActual!.incentivoSugerido.expiraHoras ? ` durante ${oportunidadActual!.incentivoSugerido.expiraHoras} horas` : ''}. Se creará un cupón individual al preparar el enlace.</span></label>}
        {!enlace ? <Button onClick={() => void preparar()} disabled={procesando}>{procesando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Preparar enlace</Button> : <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950"><CheckCircle2 className="mr-2 inline h-4 w-4" />Enlace individual preparado. Elegí cómo compartirlo.</div>}
        {enlace && <div className="grid gap-2 sm:grid-cols-3"><Button variant="outline" disabled={procesando || !tokenEnlace} onClick={() => void contactar('copiar')}><Copy className="mr-2 h-4 w-4" />Copiar link</Button><Button variant="outline" disabled={procesando || !tokenEnlace} onClick={() => void contactar('wa_me')}><ExternalLink className="mr-2 h-4 w-4" />Abrir WhatsApp</Button><Button disabled={procesando || !tokenEnlace || sinSaldo || cargandoSaldo} onClick={() => setAccion('piru_whatsapp')}><Send className="mr-2 h-4 w-4" />Enviar con Piru</Button></div>}
        {enlace && <p className="text-xs text-muted-foreground">Copiar y abrir WhatsApp preparan el mensaje, pero no confirman su envío. Enviar con Piru consume 1 crédito marketing sólo si el proveedor lo confirma.</p>}
        {enlace && <div className={`rounded-lg p-3 text-sm ${sinSaldo ? 'bg-amber-50 text-amber-950' : 'bg-muted text-muted-foreground'}`}>{cargandoSaldo ? 'Consultando saldo de campaña…' : sinSaldo ? <div className="flex flex-wrap items-center justify-between gap-2"><span>Saldo insuficiente para enviar con Piru. Copiar y WhatsApp siguen disponibles.</span><Button size="sm" variant="outline" onClick={onRecargar}>Recargar mensajes</Button></div> : <span>Saldo de campaña disponible: <strong>{saldo?.marketing.disponible ?? '—'}</strong> mensaje{saldo?.marketing.disponible === 1 ? '' : 's'}.</span>}</div>}
        {accion === 'piru_whatsapp' && <div className="rounded-lg border border-brand/30 bg-brand/5 p-4 text-sm"><p className="font-medium">¿Enviar con Piru?</p><p className="mt-1 text-muted-foreground">Se usará 1 crédito de campaña. Saldo actual: {saldo?.marketing.disponible ?? '—'}.</p><div className="mt-3 flex gap-2"><Button size="sm" disabled={procesando} onClick={() => void contactar('piru_whatsapp')}>{procesando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar envío</Button><Button size="sm" variant="outline" disabled={procesando} onClick={() => setAccion(null)}>Cancelar</Button></div></div>}
      </>}
      {error && <div className="flex gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"><CircleAlert className="h-4 w-4 shrink-0" />{error}</div>}
    </div>}<DialogFooter><Button variant="outline" onClick={() => { reiniciar(); onClose() }}>Cerrar</Button></DialogFooter>
  </DialogContent></Dialog>
}

function estadoCampana(estado: CampanaCrecimiento['estado']) {
  return estado === 'activa' ? <Badge className="bg-emerald-600 hover:bg-emerald-600">Activa</Badge>
    : estado === 'borrador' ? <Badge variant="secondary">Borrador</Badge>
      : <Badge variant="outline">Inactiva</Badge>
}

function Campanas({ token }: { token: string }) {
  const navigate = useNavigate()
  const [estado, setEstado] = useState<EstadoCarga>('cargando')
  const [error, setError] = useState('')
  const [campanas, setCampanas] = useState<CampanaCrecimiento[]>([])
  const [productos, setProductos] = useState<ProductoCampana[]>([])
  const [cupones, setCupones] = useState<CuponCampana[]>([])
  const [dialogo, setDialogo] = useState(false)
  const [editando, setEditando] = useState<CampanaCrecimiento | null>(null)
  const [form, setForm] = useState<FormCampana>(formCampanaVacio)
  const [guardando, setGuardando] = useState(false)
  const [username, setUsername] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setEstado('cargando'); setError('')
    try {
      const [lista, productosRespuesta, cuponesRespuesta, perfil] = await Promise.all([
        crecimientoApi.listarCampanas(token),
        productosApi.getAll(token).catch(() => ({ productos: [] })),
        codigosDescuentoApi.getAll(token).catch(() => ({ data: [] })),
        // El username es sólo para mostrar/copiar la URL pública. El backend
        // sigue resolviendo restaurante y permisos desde el JWT.
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/restaurante/profile`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null).catch(() => null),
      ])
      setCampanas(lista.data)
      const productosCrudos = (productosRespuesta as { productos?: Array<{ id: number; nombre: string }> }).productos ?? []
      setProductos(productosCrudos.map(producto => ({ id: producto.id, nombre: producto.nombre })))
      const cuponesCrudos = (cuponesRespuesta as { data?: Array<{ id: number; codigo: string; activo?: boolean }> }).data ?? []
      setCupones(cuponesCrudos.map(cupon => ({ id: cupon.id, codigo: cupon.codigo, activo: cupon.activo })))
      setUsername(perfil?.data?.restaurante?.[0]?.username ?? perfil?.data?.username ?? null)
      setEstado(lista.data.length ? 'listo' : 'vacio')
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : 'No se pudieron cargar las campañas.'); setEstado('error') }
  }, [token])
  useEffect(() => { void cargar() }, [cargar])

  const abrirNueva = () => { setEditando(null); setForm(formCampanaVacio()); setDialogo(true) }
  const abrirEdicion = (campana: CampanaCrecimiento) => { setEditando(campana); setForm(aFormCampana(campana)); setDialogo(true) }
  const actualizar = <K extends keyof FormCampana>(campo: K, valor: FormCampana[K]) => setForm(actual => ({ ...actual, [campo]: valor }))
  const actualizarNombre = (nombre: string) => setForm(actual => ({ ...actual, nombre, slug: editando ? actual.slug : slugAutomatico(nombre) }))

  const payload = (): CrearCampanaCrecimiento | null => {
    const nombre = form.nombre.trim(); const slug = form.slug.trim(); const inversion = Number(form.inversionManual || 0)
    if (!nombre) { setError('Indicá un nombre para la campaña.'); return null }
    if (!editando && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) { setError('El slug debe tener minúsculas, números y guiones.'); return null }
    if (form.destinoTipo === 'producto' && !form.productoId) { setError('Elegí el producto de destino.'); return null }
    if (form.destinoTipo === 'carrito' && !/^\d+x\d+(?:-\d+x\d+)*$/.test(form.carritoRep)) { setError('El carrito debe usar el formato productoIdxcantidad, por ejemplo 12x2-15x1.'); return null }
    if (!Number.isFinite(inversion) || inversion < 0) { setError('La inversión manual debe ser un monto válido.'); return null }
    return {
      slug, nombre, tipo: form.tipo, recetaCodigo: form.recetaCodigo ? form.recetaCodigo as RecetaCrecimiento : null,
      estado: form.estado, destinoTipo: form.destinoTipo, productoId: form.destinoTipo === 'producto' ? Number(form.productoId) : null,
      carritoRep: form.destinoTipo === 'carrito' ? form.carritoRep.trim() : null,
      codigoDescuentoId: form.codigoDescuentoId ? Number(form.codigoDescuentoId) : null,
      utmSource: form.utmSource.trim() || null, utmMedium: form.utmMedium.trim() || null, utmCampaign: form.utmCampaign.trim() || null,
      utmTerm: form.utmTerm.trim() || null, utmContent: form.utmContent.trim() || null, inversionManual: inversion, usaGrupoControl: form.usaGrupoControl,
    }
  }
  const guardar = async () => {
    const datos = payload(); if (!datos) return
    setGuardando(true); setError('')
    try {
      const respuesta = editando
        ? await crecimientoApi.actualizarCampana(token, editando.id, (({ slug: _slug, ...edicion }) => edicion)(datos))
        : await crecimientoApi.crearCampana(token, datos)
      setCampanas(actual => editando ? actual.map(c => c.id === respuesta.data.id ? respuesta.data : c) : [...actual, respuesta.data])
      setEstado('listo'); setDialogo(false); toast.success(editando ? 'Campaña actualizada.' : 'Campaña creada.')
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : 'No se pudo guardar la campaña.') } finally { setGuardando(false) }
  }
  const desactivar = async (campana: CampanaCrecimiento) => {
    try { const r = await crecimientoApi.desactivarCampana(token, campana.id); setCampanas(actual => actual.map(c => c.id === campana.id ? r.data : c)); toast.success('Campaña desactivada.') }
    catch (cause) { toast.error(cause instanceof ApiError ? cause.message : 'No se pudo desactivar la campaña.') }
  }
  const eliminar = async (campana: CampanaCrecimiento) => {
    if (!window.confirm(`¿Eliminar “${campana.nombre}”? Si ya tiene atribuciones, se desactivará para preservar la medición.`)) return
    try { const r = await crecimientoApi.eliminarCampana(token, campana.id); setCampanas(actual => r.eliminada ? actual.filter(c => c.id !== campana.id) : actual.map(c => c.id === campana.id ? r.data ?? c : c)); toast.success(r.eliminada ? 'Campaña eliminada.' : 'La campaña se desactivó para preservar sus atribuciones.') }
    catch (cause) { toast.error(cause instanceof ApiError ? cause.message : 'No se pudo eliminar la campaña.') }
  }
  const copiar = async (campana: CampanaCrecimiento) => {
    if (!username) { toast.error('No pudimos obtener el username público del local.'); return }
    await navigator.clipboard.writeText(`https://my.piru.app/${username}/c/${campana.slug}`)
    toast.success('Smart Link copiado.')
  }

  const cuerpo = estado === 'cargando' ? <div className="space-y-3"><Skeleton className="h-28 w-full" /><Skeleton className="h-28 w-full" /></div>
    : estado === 'error' ? <EstadoVacio titulo="No pudimos cargar las campañas" detalle={error} accion="Reintentar" onClick={() => void cargar()} />
      : estado === 'vacio' ? <EstadoVacio titulo="Creá tu primer Smart Link" detalle="Usalo para adquisición o recompra; el enlace permite medir visitas y pedidos sin depender de WhatsApp." accion="Crear campaña" onClick={abrirNueva} />
        : <div className="space-y-3">{campanas.map(campana => <article key={campana.id} className="rounded-xl border bg-white p-4 dark:bg-muted/20"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{campana.nombre}</h3>{estadoCampana(campana.estado)}<Badge variant="outline">{campana.tipo === 'adquisicion' ? 'Adquisición' : 'Recompra'}</Badge>{campana.usaGrupoControl && <Badge variant="secondary">Con control</Badge>}</div><p className="mt-1 font-mono text-xs text-muted-foreground">/c/{campana.slug}</p><p className="mt-2 text-sm text-muted-foreground">{campana.destinoTipo === 'tienda' ? 'Destino: tienda' : campana.destinoTipo === 'producto' ? 'Destino: producto' : `Destino: carrito ${campana.carritoRep}`}{campana.recetaCodigo && ` · ${RECETAS.find(r => r.value === campana.recetaCodigo)?.label ?? campana.recetaCodigo}`}</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => void copiar(campana)}><Copy className="mr-1.5 h-4 w-4" />Copiar</Button><Button size="sm" variant="outline" onClick={() => navigate(`/dashboard/clientes?tab=crecimiento&vista=resultados&campana=${campana.id}`)}><BarChart3 className="mr-1.5 h-4 w-4" />Resultados</Button><Button size="sm" variant="outline" onClick={() => abrirEdicion(campana)}><Pencil className="mr-1.5 h-4 w-4" />Editar</Button>{campana.estado === 'activa' && <Button size="sm" variant="outline" onClick={() => void desactivar(campana)}>Desactivar</Button>}<Button size="icon" variant="ghost" aria-label={`Eliminar ${campana.nombre}`} onClick={() => void eliminar(campana)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div></article>)}</div>

  return <><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Campañas y Smart Links</h2><p className="text-sm text-muted-foreground">Crear o copiar enlaces no consume mensajes ni promete entregas.</p></div><Button onClick={abrirNueva}><Plus className="mr-2 h-4 w-4" />Nueva campaña</Button></div>{cuerpo}
    <Dialog open={dialogo} onOpenChange={setDialogo}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{editando ? 'Editar campaña' : 'Nueva campaña'}</DialogTitle><DialogDescription>El slug queda fijo después de crearla. Los IDs de destino y cupón se validan siempre en el servidor.</DialogDescription></DialogHeader><div className="grid gap-4 py-2 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label htmlFor="campana-nombre">Nombre</Label><Input id="campana-nombre" value={form.nombre} onChange={e => actualizarNombre(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="campana-slug">Slug estable</Label><Input id="campana-slug" value={form.slug} disabled={Boolean(editando)} onChange={e => actualizar('slug', slugAutomatico(e.target.value))} /><p className="text-xs text-muted-foreground">my.piru.app/{username ?? 'tu-local'}/c/{form.slug || 'mi-campana'}</p></div><div className="space-y-2"><Label>Estado</Label><Select value={form.estado} onValueChange={v => actualizar('estado', v as FormCampana['estado'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="borrador">Borrador</SelectItem><SelectItem value="activa">Activa</SelectItem><SelectItem value="inactiva">Inactiva</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Tipo</Label><Select value={form.tipo} onValueChange={v => actualizar('tipo', v as FormCampana['tipo'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="adquisicion">Adquisición</SelectItem><SelectItem value="recompra">Recompra</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Receta / audiencia</Label><Select value={form.recetaCodigo || 'ninguna'} onValueChange={v => actualizar('recetaCodigo', v === 'ninguna' ? '' : v)}><SelectTrigger><SelectValue placeholder="Sin receta" /></SelectTrigger><SelectContent><SelectItem value="ninguna">Sin receta (audiencia abierta)</SelectItem>{RECETAS.map(receta => <SelectItem key={receta.value} value={receta.value}>{receta.label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Destino</Label><Select value={form.destinoTipo} onValueChange={v => actualizar('destinoTipo', v as FormCampana['destinoTipo'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="tienda">Tienda</SelectItem><SelectItem value="producto">Producto</SelectItem><SelectItem value="carrito">Carrito</SelectItem></SelectContent></Select></div>{form.destinoTipo === 'producto' && <div className="space-y-2"><Label>Producto</Label><Select value={form.productoId || 'ninguno'} onValueChange={v => actualizar('productoId', v === 'ninguno' ? '' : v)}><SelectTrigger><SelectValue placeholder="Elegí un producto" /></SelectTrigger><SelectContent><SelectItem value="ninguno">Elegí un producto</SelectItem>{productos.map(producto => <SelectItem key={producto.id} value={String(producto.id)}>{producto.nombre}</SelectItem>)}</SelectContent></Select></div>}{form.destinoTipo === 'carrito' && <div className="space-y-2 sm:col-span-2"><Label htmlFor="campana-carrito">Carrito canónico</Label><Input id="campana-carrito" placeholder="12x2-15x1" value={form.carritoRep} onChange={e => actualizar('carritoRep', e.target.value)} /><p className="text-xs text-muted-foreground">Usá productoIdxcantidad unidos por guiones. No se aceptan precios desde el navegador.</p></div>}<div className="space-y-2"><Label>Cupón (opcional)</Label><Select value={form.codigoDescuentoId || 'ninguno'} onValueChange={v => actualizar('codigoDescuentoId', v === 'ninguno' ? '' : v)}><SelectTrigger><SelectValue placeholder="Sin cupón" /></SelectTrigger><SelectContent><SelectItem value="ninguno">Sin cupón</SelectItem>{cupones.filter(c => c.activo !== false).map(cupon => <SelectItem key={cupon.id} value={String(cupon.id)}>{cupon.codigo}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="campana-inversion">Inversión manual (ARS)</Label><Input id="campana-inversion" type="number" min="0" step="0.01" value={form.inversionManual} onChange={e => actualizar('inversionManual', e.target.value)} /></div><div className="space-y-2 sm:col-span-2"><Label>UTM</Label><div className="grid gap-2 sm:grid-cols-2"><Input placeholder="utm_source" value={form.utmSource} onChange={e => actualizar('utmSource', e.target.value)} /><Input placeholder="utm_medium" value={form.utmMedium} onChange={e => actualizar('utmMedium', e.target.value)} /><Input placeholder="utm_campaign" value={form.utmCampaign} onChange={e => actualizar('utmCampaign', e.target.value)} /><Input placeholder="utm_content" value={form.utmContent} onChange={e => actualizar('utmContent', e.target.value)} /></div><Input className="mt-2" placeholder="utm_term" value={form.utmTerm} onChange={e => actualizar('utmTerm', e.target.value)} /></div><label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm sm:col-span-2"><Checkbox checked={form.usaGrupoControl} onChange={event => actualizar('usaGrupoControl', event.target.checked)} /><span><span className="font-medium">Preservar grupo de control</span><br /><span className="text-muted-foreground">Permite calcular incrementalidad cuando haya población comparable; no convierte toda compra posterior en revenue generado.</span></span></label>{error && <div className="flex gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive sm:col-span-2"><CircleAlert className="h-4 w-4 shrink-0" />{error}</div>}</div><DialogFooter><Button variant="outline" disabled={guardando} onClick={() => setDialogo(false)}>Cancelar</Button><Button disabled={guardando} onClick={() => void guardar()}>{guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editando ? 'Guardar cambios' : 'Crear campaña'}</Button></DialogFooter></DialogContent></Dialog>
  </>
}

type SucursalFiltro = { id: number; nombre: string }

function FiltrosResultados({ token, filtros, onChange }: { token: string; filtros: FiltrosCrecimiento; onChange: (filtros: FiltrosCrecimiento) => void }) {
  const [campanas, setCampanas] = useState<CampanaCrecimiento[]>([])
  const [sucursales, setSucursales] = useState<SucursalFiltro[]>([])
  useEffect(() => {
    void crecimientoApi.listarCampanas(token).then(r => setCampanas(r.data)).catch(() => setCampanas([]))
    void sucursalesApi.list(token).then((r) => setSucursales(((r as { data?: SucursalFiltro[] }).data ?? []))).catch(() => setSucursales([]))
  }, [token])
  const actualizar = <K extends keyof FiltrosCrecimiento>(clave: K, valor: FiltrosCrecimiento[K] | undefined) => onChange({ ...filtros, [clave]: valor })
  return <div className="flex flex-col gap-3 rounded-xl border bg-white p-4 dark:bg-muted/20 sm:flex-row sm:flex-wrap sm:items-end">
    <div className="space-y-1"><Label htmlFor="growth-desde" className="text-xs">Desde</Label><Input id="growth-desde" type="date" value={filtros.from ?? ''} onChange={e => actualizar('from', e.target.value || undefined)} /></div>
    <div className="space-y-1"><Label htmlFor="growth-hasta" className="text-xs">Hasta</Label><Input id="growth-hasta" type="date" value={filtros.to ?? ''} onChange={e => actualizar('to', e.target.value || undefined)} /></div>
    <div className="space-y-1 sm:min-w-48"><Label className="text-xs">Campaña</Label><Select value={filtros.campaniaId ? String(filtros.campaniaId) : 'todas'} onValueChange={v => actualizar('campaniaId', v === 'todas' ? undefined : Number(v))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Todas las campañas</SelectItem>{campanas.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>)}</SelectContent></Select></div>
    <div className="space-y-1 sm:min-w-44"><Label className="text-xs">Sucursal</Label><Select value={filtros.sucursalId ? String(filtros.sucursalId) : 'todas'} onValueChange={v => actualizar('sucursalId', v === 'todas' ? undefined : Number(v))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Todas las sucursales</SelectItem>{sucursales.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.nombre}</SelectItem>)}</SelectContent></Select></div>
    {(filtros.from || filtros.to || filtros.campaniaId || filtros.sucursalId) && <Button variant="ghost" size="sm" onClick={() => onChange({})}>Limpiar filtros</Button>}
  </div>
}

function Funnel({ funnel }: { funnel: ResumenCrecimiento['funnel'] }) {
  const pasos: Array<[keyof ResumenCrecimiento['funnel'], string]> = [['session_start', 'Sesiones'], ['product_view', 'Productos vistos'], ['add_to_cart', 'Agregaron al carrito'], ['checkout_start', 'Iniciaron checkout'], ['purchase', 'Compras con sesión']]
  const maximo = Math.max(1, ...pasos.map(([clave]) => funnel[clave]))
  return <section className="rounded-xl border bg-white p-5 dark:bg-muted/20"><h3 className="font-semibold">Embudo medible</h3><p className="mt-1 text-sm text-muted-foreground">Las ventas de POS cuentan en ventas, pero no inventan pasos del embudo.</p><div className="mt-5 space-y-3">{pasos.map(([clave, etiqueta]) => <div key={clave}><div className="mb-1 flex justify-between text-sm"><span>{etiqueta}</span><span className="font-medium tabular-nums">{funnel[clave]}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-brand" style={{ width: `${(funnel[clave] / maximo) * 100}%` }} /></div></div>)}</div></section>
}

function ResultadosContenido({ resumen, tab }: { resumen: ResumenCrecimiento; tab: 'resumen' | 'resultados' }) {
  const { metricas } = resumen
  const tieneCostos = metricas.costoTotal > 0
  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric etiqueta="Ventas cobradas" valor={formatearPesos(metricas.ventas)} /><Metric etiqueta="Pedidos cobrados" valor={metricas.pedidos} /><Metric etiqueta="Ticket promedio" valor={formatearPesos(metricas.ticketPromedio)} /><Metric etiqueta="Oportunidades activables" valor={resumen.oportunidades.total} /></div>
    <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-4 text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/20 dark:text-sky-100"><p className="font-medium">Conciliación de ventas</p><p className="mt-1">{formatearPesos(metricas.ventas)} surge de {metricas.pedidos} pedido{metricas.pedidos === 1 ? '' : 's'} pagado{metricas.pedidos === 1 ? '' : 's'} en Piru, incluidos POS. No se suma revenue atribuido para evitar duplicar ventas.</p></div>
    {tab === 'resumen' ? <div className="grid gap-5 lg:grid-cols-2"><Funnel funnel={resumen.funnel} /><section className="rounded-xl border bg-white p-5 dark:bg-muted/20"><h3 className="font-semibold">Dónde actuar ahora</h3><div className="mt-4 grid grid-cols-2 gap-3"><Metric etiqueta="Enlaces preparados" valor={metricas.enlacesCreados} /><Metric etiqueta="Contactos registrados" valor={metricas.contactos} /><Metric etiqueta="Recompra atribuida" valor={formatearPesos(resumen.recompra.revenueAtribuido)} /><Metric etiqueta="Clientes nuevos" valor={metricas.clientesNuevos} /></div><p className="mt-4 text-sm text-muted-foreground">Usá Oportunidades para preparar contactos y Campañas para generar Smart Links medibles.</p></section></div> : <><div className="grid gap-5 lg:grid-cols-2"><section className="rounded-xl border bg-white p-5 dark:bg-muted/20"><div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-brand" /><h3 className="font-semibold">Atribución y retorno</h3></div><div className="mt-4 grid grid-cols-2 gap-3"><Metric etiqueta="Revenue atribuido" valor={formatearPesos(metricas.revenueAtribuido)} /><Metric etiqueta="Descuentos atribuidos" valor={formatearPesos(metricas.descuentosAtribuidos)} /><Metric etiqueta="Inversión manual" valor={formatearPesos(metricas.inversionManual)} /><Metric etiqueta="Costo de mensajes" valor={formatearPesos(metricas.costoMensajes)} /><Metric etiqueta="Costo total" valor={formatearPesos(metricas.costoTotal)} /><Metric etiqueta="Retorno atribuido" valor={formatearPesos(metricas.retorno)} /></div>{!tieneCostos && <p className="mt-4 text-sm text-muted-foreground">Todavía no hay inversión, mensajes pagos ni descuentos atribuidos en este período.</p>}</section><section className="rounded-xl border border-amber-200 bg-amber-50/70 p-5 text-amber-950 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100"><h3 className="font-semibold">Incremental ≠ atribuido</h3><p className="mt-2 text-sm">El revenue atribuido identifica pedidos con un touch de Crecimiento. El incremental sólo mide ventas extra frente a un grupo de control comparable.</p><p className="mt-3 text-sm font-medium">{resumen.incremental.disponible ? 'Hay medición incremental disponible.' : resumen.incremental.motivo ?? 'No hay medición incremental disponible para estos datos.'}</p></section></div><Funnel funnel={resumen.funnel} /><section className="rounded-xl border bg-white p-5 dark:bg-muted/20"><h3 className="font-semibold">Resultados por campaña</h3>{resumen.campanas.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No hay campañas con actividad dentro de estos filtros.</p> : <div className="mt-4 space-y-3">{resumen.campanas.map(campana => <div key={campana.id} className="grid gap-2 rounded-lg bg-muted/50 p-3 text-sm sm:grid-cols-[1fr_auto_auto_auto]"><div><p className="font-medium">{campana.nombre}</p><p className="text-xs text-muted-foreground">{campana.tipo === 'adquisicion' ? 'Adquisición' : 'Recompra'} · /c/{campana.slug}</p></div><span>Ventas: <strong>{formatearPesos(campana.metricas.ventas)}</strong></span><span>Atribuido: <strong>{formatearPesos(campana.metricas.revenueAtribuido)}</strong></span><span>Retorno: <strong>{formatearPesos(campana.metricas.retorno)}</strong></span></div>)}</div>}</section></>}</div>
}

function EstadoPanel({ tab, filtros, onFiltrosChange }: { tab: 'resumen' | 'resultados'; filtros: FiltrosCrecimiento; onFiltrosChange: (filtros: FiltrosCrecimiento) => void }) {
  const token = useAuthStore(state => state.token)
  const [estado, setEstado] = useState<EstadoCarga>('cargando'); const [mensaje, setMensaje] = useState(''); const [resumen, setResumen] = useState<ResumenCrecimiento | null>(null)
  const cargar = useCallback(async () => { if (!token) return; setEstado('cargando'); setMensaje(''); try { const r = filtros.campaniaId ? await crecimientoApi.resultadosCampana(token, filtros.campaniaId, filtros) : await crecimientoApi.resumen(token, filtros); setResumen(r.data); const hayDatos = r.data.metricas.pedidos > 0 || r.data.metricas.sesiones > 0 || r.data.oportunidades.total > 0 || r.data.campanas.length > 0; setEstado(hayDatos ? 'listo' : 'vacio') } catch (cause) { setMensaje(cause instanceof ApiError ? cause.message : 'No se pudo cargar Crecimiento.'); setEstado('error') } }, [filtros, token])
  useEffect(() => { void cargar() }, [cargar])
  if (!token) return <EstadoVacio titulo="Sesión no disponible" detalle="Volvé a iniciar sesión para consultar resultados." />
  return <div className="space-y-5"><FiltrosResultados token={token} filtros={filtros} onChange={onFiltrosChange} />{estado === 'cargando' && <div className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-48 w-full" /></div>}{estado === 'error' && <EstadoVacio titulo="No pudimos cargar esta sección" detalle={mensaje} accion="Reintentar" onClick={() => void cargar()} />}{estado === 'vacio' && <EstadoVacio titulo={`Todavía no hay ${TAB_META[tab].etiqueta.toLowerCase()}`} detalle="Cuando haya ventas, sesiones u oportunidades dentro de estos filtros, vas a ver los totales y su conciliación acá." />}{estado === 'listo' && resumen && <ResultadosContenido resumen={resumen} tab={tab} />}</div>
}

export default function Crecimiento() {
  const [searchParams, setSearchParams] = useSearchParams()
  const vista = searchParams.get('vista')
  const tabInicial: TabCrecimiento = vista === 'oportunidades' || vista === 'campanas' || vista === 'resultados' ? vista : 'resumen'
  const [tab, setTab] = useState<TabCrecimiento>(tabInicial); const token = useAuthStore(state => state.token); const meta = TAB_META[tab]
  const campaniaParam = Number(searchParams.get('campana'))
  const [filtros, setFiltros] = useState<FiltrosCrecimiento>(() => ({ campaniaId: Number.isInteger(campaniaParam) && campaniaParam > 0 ? campaniaParam : undefined }))
  useEffect(() => {
    const siguiente: TabCrecimiento = vista === 'oportunidades' || vista === 'campanas' || vista === 'resultados' ? vista : 'resumen'
    if (siguiente !== tab) setTab(siguiente)
    const campania = Number(searchParams.get('campana'))
    const campaniaId = Number.isInteger(campania) && campania > 0 ? campania : undefined
    setFiltros(actual => actual.campaniaId === campaniaId ? actual : { ...actual, campaniaId })
  }, [searchParams, tab, vista])
  const cambiarTab = (valor: string) => { const siguiente = valor as TabCrecimiento; setTab(siguiente); const params = new URLSearchParams(searchParams); if (siguiente === 'resumen') params.delete('vista'); else params.set('vista', siguiente); setSearchParams(params, { replace: true }) }
  const cambiarFiltros = (siguiente: FiltrosCrecimiento) => { setFiltros(siguiente); const params = new URLSearchParams(searchParams); if (siguiente.campaniaId) params.set('campana', String(siguiente.campaniaId)); else params.delete('campana'); setSearchParams(params, { replace: true }) }
  return <div className="min-h-0 flex-1 overflow-hidden bg-[#FFFBF0] dark:bg-background"><div className="h-full overflow-auto px-4 py-6 sm:px-6 sm:py-10"><div className="mx-auto max-w-4xl"><div className="mb-6"><h1 className="text-2xl font-semibold tracking-tight">Crecimiento</h1><p className="mt-1 text-sm text-muted-foreground">Adquisición, recompra y resultados en un solo lugar.</p></div><Tabs value={tab} onValueChange={cambiarTab}><TabsList className="h-auto w-full justify-start overflow-x-auto sm:w-fit">{(Object.keys(TAB_META) as TabCrecimiento[]).map(clave => <TabsTrigger key={clave} value={clave}>{TAB_META[clave].etiqueta}</TabsTrigger>)}</TabsList><TabsContent value="resumen" className="mt-6"><EstadoPanel tab="resumen" filtros={filtros} onFiltrosChange={cambiarFiltros} /></TabsContent><TabsContent value="oportunidades" className="mt-6">{token ? <Oportunidades token={token} /> : <EstadoVacio titulo="Sesión no disponible" detalle="Volvé a iniciar sesión para ver tus oportunidades." />}</TabsContent><TabsContent value="campanas" className="mt-6">{token ? <Campanas token={token} /> : <EstadoVacio titulo="Sesión no disponible" detalle="Volvé a iniciar sesión para gestionar campañas." />}</TabsContent><TabsContent value="resultados" className="mt-6"><EstadoPanel tab="resultados" filtros={filtros} onFiltrosChange={cambiarFiltros} /></TabsContent></Tabs><p className="mt-5 text-xs text-muted-foreground">{meta.descripcion}</p></div></div></div>
}
