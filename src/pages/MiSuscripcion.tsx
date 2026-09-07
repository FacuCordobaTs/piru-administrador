import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { AlertTriangle, CreditCard, Loader2, ReceiptText, RotateCcw, XCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { CicloToggle, type Ciclo } from '@/components/CicloToggle'
import { CheckoutSuscripcionOpciones } from '@/components/CheckoutSuscripcionOpciones'
import { cn, descuentoAnualEfectivo, precioAnual } from '@/lib/utils'
import { mensajesApi, suscripcionApi, type PackRecarga, type PagoSuscripcionResumen } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useModulosStore } from '@/store/modulosStore'
import { renovacionProxima, useSuscripcion } from './ajustes/hooks/useSuscripcion'

const fmtARS = (value: number | string | null | undefined) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(value ?? 0))

const fmtFecha = (iso: string | null | undefined) => {
  if (!iso) return null
  const fecha = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso)
  return Number.isNaN(fecha.getTime()) ? null : fecha.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
}

const ESTADOS: Record<string, string> = {
  trial: 'Prueba gratis', activa: 'Al día', pago_pendiente: 'Pago pendiente',
  suspendida: 'Suspendida', cancelada: 'Cancelada',
}

type Suscripcion = NonNullable<ReturnType<typeof useSuscripcion>['data']>

export default function MiSuscripcion({ embedded = false }: { embedded?: boolean }) {
  const { data, loading, refetch } = useSuscripcion()
  const categorias = useModulosStore((state) => state.categorias)
  const [ciclo, setCiclo] = useState<Ciclo>('mensual')
  const [pagos, setPagos] = useState<PagoSuscripcionResumen[]>([])
  const [cargandoPagos, setCargandoPagos] = useState(true)
  const [errorPagos, setErrorPagos] = useState(false)
  const [confirmarBaja, setConfirmarBaja] = useState(false)
  const [procesando, setProcesando] = useState<'checkout' | 'cancelar' | 'reactivar' | null>(null)
  const [packs, setPacks] = useState<PackRecarga[]>([])
  const [packId, setPackId] = useState<number | null>(null)
  const [usarOtroTelefono, setUsarOtroTelefono] = useState(false)
  const [otroTelefono, setOtroTelefono] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()

  const cargarPagos = async () => {
    const token = useAuthStore.getState().token
    if (!token) return
    setCargandoPagos(true)
    setErrorPagos(false)
    try { setPagos((await suscripcionApi.pagos(token)).data ?? []) }
    catch { setErrorPagos(true) }
    finally { setCargandoPagos(false) }
  }

  useEffect(() => {
    void cargarPagos()
    const token = useAuthStore.getState().token
    if (token) mensajesApi.packs(token, 'utility').then((r) => setPacks(r.data)).catch(() => setPacks([]))
  }, [])
  useEffect(() => { if (data?.ciclo) setCiclo(data.ciclo === 'anual' ? 'anual' : 'mensual') }, [data?.ciclo])
  useEffect(() => { if (data && !data.telefonoPago) setUsarOtroTelefono(true) }, [data])
  useEffect(() => {
    if (searchParams.get('plan') !== 'success') return
    toast.info('Estamos verificando la acreditación de tu pago…')
    const next = new URLSearchParams(searchParams)
    next.delete('plan')
    const cleanup = setTimeout(() => setSearchParams(next, { replace: true }), 9000)
    const timers = [1500, 4000, 8000].map((ms) => setTimeout(() => { void refetch().catch(() => {}); void cargarPagos() }, ms))
    return () => { timers.forEach(clearTimeout); clearTimeout(cleanup) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const modulosPagos = useMemo(() => categorias.flatMap((categoria) => categoria.modulos)
    .filter((modulo) => modulo.tipo === 'pago' && (modulo.estado === 'activo' || modulo.estado === 'cancelacion_programada')),
  [categorias])

  if (loading && !data) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>

  if (!data) return <div role="alert" className="space-y-3 text-sm"><p>No pudimos consultar tu suscripción.</p><Button variant="outline" onClick={() => void refetch().catch(() => {})}>Reintentar</Button></div>

  const descuento = descuentoAnualEfectivo(data.suscripcionBase?.descuentoAnual ?? 0)
  // La configuración comercial es la fuente vigente; `precioBaseMensual` es
  // sólo el snapshot de la última factura y puede conservar un precio anterior.
  const precioBase = Number(data.suscripcionBase?.precioMensual ?? data.cotizacionProximaFactura?.montoBaseMensual ?? data.precioBaseMensual ?? 0)
  const sinSuscripcion = data.sinSuscripcion || !data.suscripcionId
  const cancelacionProgramada = !!data.fechaCancelacion && new Date(data.fechaCancelacion) > new Date()
  const necesitaCheckout = sinSuscripcion || data.estado === 'trial' || data.estado === 'pago_pendiente' || data.estado === 'suspendida' || data.estado === 'cancelada'
  // `montoTotalMensual` es el snapshot de la última factura. Para una cuenta
  // que todavía no pagó (por ejemplo, una migrada desde el modelo anterior),
  // el importe vigente se arma con los entitlements activos para que el primer
  // checkout muestre exactamente lo que el backend va a cobrar.
  const modulosMensuales = modulosPagos.reduce((total, modulo) => total + Number(modulo.precioMensualCongelado ?? modulo.precioMensual), 0)
  const totalMensual = Number(data.cotizacionProximaFactura?.montoTotalMensual ?? (precioBase + modulosMensuales))
  const totalCiclo = ciclo === 'anual' ? precioAnual(totalMensual, descuento) : totalMensual
  const tieneAvisos = modulosPagos.some((modulo) => modulo.codigo === 'avisos_automaticos_whatsapp' && modulo.estado === 'activo')

  const iniciarCheckout = async () => {
    const token = useAuthStore.getState().token
    if (!token) return
    if (usarOtroTelefono && otroTelefono.replace(/\D/g, '').length < 8) {
      toast.error('Ingresá un número de WhatsApp válido')
      return
    }
    setProcesando('checkout')
    try {
      const respuesta = await suscripcionApi.enviarPagoLinkWhatsapp(token, ciclo, {
        ...(packId ? { packId } : {}),
        ...(usarOtroTelefono ? { telefonoDestino: otroTelefono } : {}),
      })
      toast.success(`Te enviamos el link de pago a WhatsApp (${respuesta.data.telefono})`)
    } catch (error: any) { toast.error(error?.message || 'No se pudo enviar el link de pago') }
    finally { setProcesando(null) }
  }
  const cancelar = async () => {
    const token = useAuthStore.getState().token
    if (!token) return
    setProcesando('cancelar')
    try { toast.success((await suscripcionApi.cancelar(token)).message); setConfirmarBaja(false); await refetch() }
    catch (error: any) { toast.error(error?.message || 'No se pudo programar la baja') }
    finally { setProcesando(null) }
  }
  const reactivar = async () => {
    const token = useAuthStore.getState().token
    if (!token) return
    setProcesando('reactivar')
    try { toast.success((await suscripcionApi.reactivar(token)).message); await refetch() }
    catch (error: any) { toast.error(error?.message || 'No se pudo reactivar la suscripción') }
    finally { setProcesando(null) }
  }

  return <div className={embedded ? "" : "mx-auto w-full max-w-4xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20"}>
    {!embedded && <header className="mx-auto mb-12 max-w-xl text-center">
      <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">Mi suscripción</h1>
      <p className="mt-3 text-sm text-muted-foreground">Gestioná tu suscripción y pagos de Piru.</p>
    </header>}

    <div className="space-y-8">
      <Atencion data={data} />
      <SuscripcionActual
        data={data}
        ciclo={ciclo}
        descuento={descuento}
        precioBase={precioBase}
        totalCiclo={totalCiclo}
        sinSuscripcion={sinSuscripcion}
        necesitaCheckout={necesitaCheckout}
        cancelacionProgramada={cancelacionProgramada}
        procesando={procesando}
        onCiclo={setCiclo}
        onCheckout={iniciarCheckout}
        onCancelar={() => setConfirmarBaja(true)}
        onReactivar={reactivar}
        habilitarPack={tieneAvisos} packs={packs} packId={packId} onPackId={setPackId}
        telefonoCuenta={data.telefonoPago} usarOtroTelefono={usarOtroTelefono} onUsarOtroTelefono={setUsarOtroTelefono}
        otroTelefono={otroTelefono} onOtroTelefono={setOtroTelefono}
      />
      <ModulosPagos modulos={modulosPagos} ciclo={ciclo} descuento={descuento} />
      <details className="rounded-xl border p-4"><summary className="cursor-pointer text-sm font-semibold">Comprobantes e historial de pagos</summary>{errorPagos ? <div role="alert" className="mt-4 text-sm">No pudimos cargar el historial.<Button variant="link" onClick={() => void cargarPagos()}>Reintentar</Button></div> : <Historial pagos={pagos} cargando={cargandoPagos} />}</details>
    </div>
    <Dialog open={confirmarBaja} onOpenChange={open => !procesando && setConfirmarBaja(open)}><DialogContent><DialogHeader><DialogTitle>¿Programar la baja de Piru?</DialogTitle><DialogDescription>Vas a conservar el servicio hasta el final del período ya pagado. Después se deshabilitarán las herramientas del negocio. Tus datos seguirán guardados.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={!!procesando} onClick={() => setConfirmarBaja(false)}>Conservar suscripción</Button><Button variant="destructive" disabled={!!procesando} onClick={() => void cancelar()}>{procesando ? 'Guardando…' : 'Programar baja'}</Button></DialogFooter></DialogContent></Dialog>
  </div>
}

function Atencion({ data }: { data: Suscripcion }) {
  const renovacion = renovacionProxima(data)
  let mensaje: string | null = null
  if (data.fechaCancelacion && new Date(data.fechaCancelacion) > new Date()) mensaje = `La baja está programada para el ${fmtFecha(data.fechaCancelacion)}. Vas a conservar el servicio hasta entonces.`
  else if (data.estado === 'suspendida') mensaje = 'Tu suscripción está suspendida por falta de pago. Reactivala para volver a operar.'
  else if (data.estado === 'pago_pendiente') mensaje = data.graciaHasta ? `Tu pago está pendiente. Tenés hasta el ${fmtFecha(data.graciaHasta)} para regularizarlo.` : 'Tu pago está pendiente.'
  else if (data.estado === 'cancelada') mensaje = 'Tus datos siguen guardados. Reactivá tu suscripción para volver a operar.'
  else if (renovacion) mensaje = renovacion.diasRestantes <= 0 ? 'Tu suscripción se renueva hoy.' : `Tu suscripción se renueva el ${fmtFecha(data.fechaProximoCobro) ?? `en ${renovacion.diasRestantes} días`}.`
  return mensaje ? <div className="flex items-start gap-3 border-b border-amber-200 pb-4 text-sm text-foreground dark:border-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />{mensaje}</div> : null
}

function SuscripcionActual({ data, ciclo, descuento, precioBase, totalCiclo, sinSuscripcion, necesitaCheckout, cancelacionProgramada, procesando, onCiclo, onCheckout, onCancelar, onReactivar, habilitarPack, packs, packId, onPackId, telefonoCuenta, usarOtroTelefono, onUsarOtroTelefono, otroTelefono, onOtroTelefono }: {
  data: Suscripcion; ciclo: Ciclo; descuento: number; precioBase: number; totalCiclo: number; sinSuscripcion: boolean; necesitaCheckout: boolean; cancelacionProgramada: boolean; procesando: string | null
  onCiclo: (ciclo: Ciclo) => void; onCheckout: () => void; onCancelar: () => void; onReactivar: () => void
  habilitarPack: boolean; packs: PackRecarga[]; packId: number | null; onPackId: (id: number | null) => void
  telefonoCuenta?: string | null; usarOtroTelefono: boolean; onUsarOtroTelefono: (value: boolean) => void
  otroTelefono: string; onOtroTelefono: (value: string) => void
}) {
  const esTrial = data.estado === 'trial'
  const fecha = esTrial ? data.trialFin ?? data.fechaProximoCobro : data.fechaProximoCobro
  const detalleFecha = esTrial
    ? `Prueba gratis${fmtFecha(fecha) ? ` hasta el ${fmtFecha(fecha)}` : ''}.`
    : data.graciaHasta && data.estado === 'pago_pendiente'
      ? `Período de gracia hasta el ${fmtFecha(data.graciaHasta)}.`
      : fecha ? `Próximo pago: ${fmtFecha(fecha)}.` : 'Sin próximo pago programado.'
  return <section className="border-y border-border py-7 sm:px-2">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Tu suscripción</p><h2 className="mt-1 text-3xl font-semibold tracking-tight">{data.suscripcionBase?.nombre ?? 'Suscripción Piru'}</h2></div>
      <p className="inline-flex items-center gap-2 text-sm text-muted-foreground"><span className={`h-2 w-2 rounded-full ${necesitaCheckout ? 'bg-amber-500' : 'bg-emerald-500'}`} />{ESTADOS[data.estado ?? ''] ?? 'Sin suscripción'}</p>
    </div>
    <div className="mt-6 flex flex-col gap-5 border-t border-border pt-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2 text-sm text-muted-foreground">
        <p className="text-base font-medium text-foreground">{fmtARS(totalCiclo)} <span className="font-normal text-muted-foreground">/ {ciclo === 'anual' ? 'año' : 'mes'}</span></p>
        {ciclo === 'anual' && <p>Equivale a {fmtARS(totalCiclo / 12)}/mes{descuento > 0 ? ` · ahorrás ${descuento}%` : ''}.</p>}
        <p>{detalleFecha}</p>
        {data.suscripcionBase?.descripcion && <p>{data.suscripcionBase.descripcion}</p>}
        <p className="text-xs">Base: {fmtARS(ciclo === 'anual' ? precioAnual(precioBase, descuento) : precioBase)}{ciclo === 'anual' ? ' / año' : ' / mes'}.</p>
      </div>
      <div className="shrink-0 space-y-2">
        {necesitaCheckout && <Button onClick={onCheckout} disabled={!!procesando} className="w-full sm:w-auto">{procesando === 'checkout' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}{sinSuscripcion || esTrial ? 'Enviar link para activar' : data.estado === 'pago_pendiente' ? 'Enviar link de renovación' : 'Enviar link para reactivar'}</Button>}
        {cancelacionProgramada && <Button variant="outline" onClick={onReactivar} disabled={!!procesando} className="w-full sm:w-auto">{procesando === 'reactivar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}Continuar suscripción</Button>}
        {!sinSuscripcion && !cancelacionProgramada && !necesitaCheckout && <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">Administrar continuidad</summary><Button variant="ghost" onClick={onCancelar} disabled={!!procesando} className="mt-2 w-full sm:w-auto">{procesando === 'cancelar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}Cancelar al final del período</Button></details>}
      </div>
    </div>
    <div className="mt-6"><p className="mb-2 text-xs text-muted-foreground">{necesitaCheckout ? "Elegí el período que querés pagar." : "Compará el costo mensual y anual. Consultar otro período no modifica tu suscripción."}</p><CicloToggle value={ciclo} onChange={onCiclo} descuentoMax={descuento} /></div>
    {necesitaCheckout && <CheckoutSuscripcionOpciones habilitarPack={habilitarPack} packs={packs} packId={packId} onPackId={onPackId} totalSuscripcion={totalCiclo} telefonoCuenta={telefonoCuenta} usarOtroTelefono={usarOtroTelefono} onUsarOtroTelefono={onUsarOtroTelefono} otroTelefono={otroTelefono} onOtroTelefono={onOtroTelefono} />}
  </section>
}

function ModulosPagos({ modulos, ciclo, descuento }: { modulos: ReturnType<typeof useModulosStore.getState>['categorias'][number]['modulos']; ciclo: Ciclo; descuento: number }) {
  return <section className="rounded-2xl bg-muted/40 p-5">
    <h3 className="text-sm font-semibold">Detalle de tus herramientas pagas</h3>
    <p className="mt-1 text-xs text-muted-foreground">Estos importes componen el total de arriba. Podés administrar las herramientas en esta misma pantalla.</p>
    {modulos.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No tenés herramientas pagas activas. Solo pagás la base.</p> : <div className="mt-4 divide-y">{modulos.map(modulo => {
      const importe = Number(modulo.precioMensualCongelado ?? modulo.precioMensual)
      return <div key={modulo.codigo} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><p className="font-medium">{modulo.nombre}</p><p className={cn('mt-1 text-xs', modulo.estado === 'cancelacion_programada' ? 'text-amber-600' : 'text-muted-foreground')}>{modulo.estado === 'cancelacion_programada' ? `Baja programada: ${fmtFecha(modulo.vigenteHasta) ?? 'al finalizar el período'}` : 'Se cobra junto a la base'}</p></div><span className="font-semibold">{fmtARS(ciclo === 'anual' ? precioAnual(importe, descuento) : importe)}<span className="font-normal text-muted-foreground"> / {ciclo === 'anual' ? 'año' : 'mes'}</span></span></div>
    })}</div>}
  </section>
}

function Historial({ pagos, cargando }: { pagos: PagoSuscripcionResumen[]; cargando: boolean }) {
  return <section className="border-t border-border pt-8"><div className="flex items-center gap-2"><ReceiptText className="h-5 w-5 text-muted-foreground" /><h2 className="text-xl font-semibold">Historial de pagos</h2></div>{cargando ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : pagos.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">Todavía no hay pagos registrados.</p> : <div className="mt-4 divide-y divide-border">{[...pagos].reverse().map((pago) => <div key={pago.id} className="flex items-center justify-between gap-4 py-3 text-sm"><div><p className="font-medium">{pago.estado === 'paid' ? 'Pago acreditado' : pago.estado === 'pending' ? 'Pago pendiente' : `Pago ${pago.estado}`}</p><p className="mt-0.5 text-xs text-muted-foreground">{fmtFecha(pago.paidAt ?? pago.createdAt) ?? 'Sin fecha'} · {pago.ciclo === 'anual' ? 'Anual' : 'Mensual'}</p></div><span className="font-medium">{fmtARS(pago.montoTotal ?? pago.monto)}</span></div>)}</div>}</section>
}
