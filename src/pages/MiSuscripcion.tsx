import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { AlertTriangle, Check, CreditCard, Loader2, ReceiptText, RotateCcw, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { CicloToggle, type Ciclo } from '@/components/CicloToggle'
import { descuentoAnualEfectivo, precioAnual } from '@/lib/utils'
import { suscripcionApi, type PagoSuscripcionResumen } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useModulosStore } from '@/store/modulosStore'
import { renovacionProxima, useSuscripcion } from './ajustes/hooks/useSuscripcion'

const fmtARS = (value: number | string | null | undefined) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(value ?? 0))

const fmtFecha = (iso: string | null | undefined) => {
  if (!iso) return null
  const fecha = new Date(iso)
  return Number.isNaN(fecha.getTime()) ? null : fecha.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
}

const ESTADOS: Record<string, string> = {
  trial: 'Prueba gratis', activa: 'Al día', pago_pendiente: 'Pago pendiente',
  suspendida: 'Suspendida', cancelada: 'Cancelada',
}

export default function MiSuscripcion() {
  const { data, loading, refetch } = useSuscripcion()
  const categorias = useModulosStore((state) => state.categorias)
  const checkoutSuscripcion = useModulosStore((state) => state.checkoutSuscripcion)
  const [ciclo, setCiclo] = useState<Ciclo>('mensual')
  const [pagos, setPagos] = useState<PagoSuscripcionResumen[]>([])
  const [cargandoPagos, setCargandoPagos] = useState(true)
  const [procesando, setProcesando] = useState<'checkout' | 'cancelar' | 'reactivar' | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  const cargarPagos = async () => {
    const token = useAuthStore.getState().token
    if (!token) return
    setCargandoPagos(true)
    try { setPagos((await suscripcionApi.pagos(token)).data ?? []) }
    catch { setPagos([]) }
    finally { setCargandoPagos(false) }
  }

  useEffect(() => { void cargarPagos() }, [])
  useEffect(() => {
    if (!data?.ciclo) return
    setCiclo(data.ciclo === 'anual' ? 'anual' : 'mensual')
  }, [data?.ciclo])
  useEffect(() => {
    if (searchParams.get('plan') !== 'success') return
    toast.success('Pago recibido. Estamos actualizando tu suscripción…')
    setSearchParams({}, { replace: true })
    const timers = [1500, 4000, 8000].map((ms) => setTimeout(() => { void refetch(); void cargarPagos() }, ms))
    return () => timers.forEach(clearTimeout)
  // El polling se crea sólo al volver desde Mercado Pago.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const modulosPagos = useMemo(() => categorias.flatMap((categoria) => categoria.modulos)
    .filter((modulo) => modulo.tipo === 'pago' && (modulo.estado === 'activo' || modulo.estado === 'cancelacion_programada')),
  [categorias])

  if (loading || !data) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>

  const descuento = descuentoAnualEfectivo(data.suscripcionBase?.descuentoAnual ?? 0)
  const precioBase = Number(data.precioBaseMensual ?? data.suscripcionBase?.precioMensual ?? 0)
  const totalMensual = Number(data.montoTotalMensual ?? precioBase)
  const totalCiclo = ciclo === 'anual' ? precioAnual(totalMensual, descuento) : totalMensual
  const sinSuscripcion = data.sinSuscripcion || !data.suscripcionId
  const cancelacionProgramada = !!data.fechaCancelacion && new Date(data.fechaCancelacion) > new Date()
  const necesitaCheckout = sinSuscripcion || data.estado === 'suspendida' || data.estado === 'cancelada'

  const iniciarCheckout = async () => {
    setProcesando('checkout')
    try {
      const checkout = await checkoutSuscripcion(ciclo)
      window.location.assign(checkout.url_pago)
    } catch (error: any) { toast.error(error?.message || 'No se pudo iniciar el pago') }
    finally { setProcesando(null) }
  }
  const cancelar = async () => {
    if (!window.confirm('La baja se hará efectiva al finalizar el período ya pagado. ¿Querés continuar?')) return
    const token = useAuthStore.getState().token
    if (!token) return
    setProcesando('cancelar')
    try { toast.success((await suscripcionApi.cancelar(token)).message); await refetch() }
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

  return <main className="mx-auto w-full max-w-4xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
    <header className="mx-auto mb-10 max-w-xl text-center">
      <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">Mi suscripción</h1>
      <p className="mt-3 text-sm text-muted-foreground">Tu operación base y los módulos que elegiste para tu local.</p>
    </header>

    <div className="mx-auto max-w-3xl space-y-8">
      <EstadoSuscripcion data={data} />
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div><p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Suscripción Piru</p><h2 className="mt-1 text-2xl font-semibold">{data.suscripcionBase?.nombre ?? 'Suscripción Piru'}</h2><p className="mt-2 text-sm text-muted-foreground">{data.suscripcionBase?.descripcion ?? 'Todo lo necesario para recibir y gestionar pedidos.'}</p></div>
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground"><span className={`h-2 w-2 rounded-full ${necesitaCheckout ? 'bg-amber-500' : 'bg-emerald-500'}`} />{ESTADOS[data.estado ?? ''] ?? 'Sin suscripción'}</span>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">{data.estado === 'trial' ? `Prueba gratis${fmtFecha(data.trialFin ?? data.fechaProximoCobro) ? ` hasta el ${fmtFecha(data.trialFin ?? data.fechaProximoCobro)}` : ''}.` : data.graciaHasta && data.estado === 'pago_pendiente' ? `Período de gracia hasta el ${fmtFecha(data.graciaHasta)}.` : data.fechaProximoCobro ? `Próximo pago: ${fmtFecha(data.fechaProximoCobro)}.` : 'Sin próximo pago programado.'}</p>
        <div className="mt-7 border-t border-border pt-5">
          <div className="flex flex-wrap items-center justify-between gap-4"><span className="font-medium">Elegí cómo pagar</span><CicloToggle value={ciclo} onChange={setCiclo} descuentoMax={descuento} /></div>
          <ResumenImporte titulo="Suscripción base" importe={precioBase} ciclo={ciclo} descuento={descuento} />
          {modulosPagos.map((modulo) => <ResumenImporte key={modulo.codigo} titulo={modulo.nombre} importe={Number(modulo.precioMensualCongelado ?? modulo.precioMensual)} ciclo={ciclo} descuento={descuento} nota={modulo.origen === 'legacy' ? 'Bonificado' : modulo.estado === 'cancelacion_programada' ? `Finaliza el ${fmtFecha(modulo.vigenteHasta) ?? 'fin del período'}` : undefined} />)}
          <div className="mt-5 flex items-baseline justify-between border-t border-border pt-5"><span className="font-semibold">Total {ciclo === 'anual' ? 'anual' : 'mensual'}</span><span className="text-2xl font-semibold">{fmtARS(totalCiclo)}<span className="ml-1 text-sm font-normal text-muted-foreground">/{ciclo === 'anual' ? 'año' : 'mes'}</span></span></div>
          {ciclo === 'anual' && <p className="mt-2 text-right text-xs text-muted-foreground">Equivale a {fmtARS(totalCiclo / 12)}/mes{descuento > 0 ? ` · ahorrás ${descuento}%` : ''}</p>}
        </div>
        <div className="mt-7 flex flex-wrap gap-3">
          {necesitaCheckout && <Button onClick={iniciarCheckout} disabled={!!procesando}>{procesando === 'checkout' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}{sinSuscripcion ? 'Activar suscripción' : 'Reactivar con un pago'}</Button>}
          {cancelacionProgramada && <Button variant="outline" onClick={reactivar} disabled={!!procesando}>{procesando === 'reactivar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}Continuar suscripción</Button>}
          {!sinSuscripcion && !cancelacionProgramada && !necesitaCheckout && <Button variant="outline" onClick={cancelar} disabled={!!procesando}>{procesando === 'cancelar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}Cancelar al final del período</Button>}
        </div>
      </section>
      <Historial pagos={pagos} cargando={cargandoPagos} />
    </div>
  </main>
}

function EstadoSuscripcion({ data }: { data: NonNullable<ReturnType<typeof useSuscripcion>['data']> }) {
  const renovacion = renovacionProxima(data)
  const fecha = data.fechaCancelacion ?? data.trialFin ?? data.fechaProximoCobro
  let texto: string | null = null
  if (data.fechaCancelacion && new Date(data.fechaCancelacion) > new Date()) texto = `La baja está programada para el ${fmtFecha(data.fechaCancelacion)}. Tus módulos y la suscripción siguen activos hasta entonces.`
  else if (data.estado === 'trial') texto = `Tu prueba incluye la suscripción base${fecha ? ` hasta el ${fmtFecha(fecha)}` : ''}. Los módulos pagos se activan por separado desde Módulos.`
  else if (data.estado === 'pago_pendiente') texto = data.graciaHasta ? `Tu pago está pendiente. Tenés hasta el ${fmtFecha(data.graciaHasta)} para regularizarlo.` : 'Tu pago está pendiente.'
  else if (data.estado === 'suspendida' || data.estado === 'cancelada') texto = 'Tus datos se conservan. Reactivá con un pago para volver a operar.'
  else if (renovacion) texto = renovacion.diasRestantes <= 0 ? 'Tu suscripción se renueva hoy.' : `Tu próxima renovación es en ${renovacion.diasRestantes} días.`
  if (!texto) return null
  return <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />{texto}</div>
}

function ResumenImporte({ titulo, importe, ciclo, descuento, nota }: { titulo: string; importe: number; ciclo: Ciclo; descuento: number; nota?: string }) {
  const total = ciclo === 'anual' ? precioAnual(importe, descuento) : importe
  return <div className="mt-4 flex items-start justify-between gap-4 text-sm"><div><p>{titulo}</p>{nota && <p className="mt-0.5 text-xs text-muted-foreground">{nota}</p>}</div><span className="shrink-0 font-medium">{fmtARS(total)}</span></div>
}

function Historial({ pagos, cargando }: { pagos: PagoSuscripcionResumen[]; cargando: boolean }) {
  return <section className="rounded-2xl border border-border bg-card p-5 sm:p-7"><div className="flex items-center gap-2"><ReceiptText className="h-5 w-5 text-muted-foreground" /><h2 className="text-lg font-semibold">Historial de pagos</h2></div>{cargando ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : pagos.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">Todavía no hay pagos registrados.</p> : <div className="mt-4 divide-y divide-border">{[...pagos].reverse().map((pago) => <div key={pago.id} className="flex items-center justify-between gap-4 py-3 text-sm"><div><p className="font-medium">{pago.estado === 'paid' ? 'Pago acreditado' : pago.estado === 'pending' ? 'Pago pendiente' : `Pago ${pago.estado}`}</p><p className="mt-0.5 text-xs text-muted-foreground">{fmtFecha(pago.paidAt ?? pago.createdAt) ?? 'Sin fecha'} · {pago.ciclo === 'anual' ? 'Anual' : 'Mensual'}</p></div><span className="font-medium">{fmtARS(pago.montoTotal ?? pago.monto)}</span></div>)}</div>}</section>
}
