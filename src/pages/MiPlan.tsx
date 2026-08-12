import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  Check, ChevronDown, ChevronUp, Loader2, Lock, MessageCircle, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn, descuentoAnualEfectivo, precioAnual } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { planesApi, type PlanCatalogo } from '@/lib/api'
import { CicloToggle, type Ciclo } from '@/components/CicloToggle'
import { useSuscripcion, renovacionProxima } from './ajustes/hooks/useSuscripcion'

const fmtARS = (n: number | string) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(
    typeof n === 'string' ? parseFloat(n) : n,
  )

const fmtFecha = (iso: string | null | undefined) => {
  if (!iso) return null
  const d = new Date(iso)
  return isNaN(d.getTime()) ? null : d.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
}

const FEATURE_LABELS: Record<string, string> = {
  avisos_whatsapp_cliente: 'Avisos automáticos al cliente por WhatsApp',
  facturacion_arca: 'Facturación electrónica ARCA',
  rapiboy: 'Integración con Rapiboy',
  multisucursal: 'Múltiples sucursales',
  estadisticas_avanzadas: 'Estadísticas avanzadas',
  dominio_propio: 'Dominio propio',
  motor_recompra: 'Motor de Recompra',
}

const FEATURES_BASE = [
  'Pedidos por WhatsApp y centro de pedidos', 'Impresión automática de comandas',
  'Productos, categorías y pedidos ilimitados', 'Todos los métodos de pago',
  'Cupones, promociones y horarios', 'Múltiples sucursales y dominio propio',
]

const ESTADO_LABEL: Record<string, string> = {
  trial: 'Prueba gratis', activa: 'Al día', pago_pendiente: 'Pago pendiente',
  suspendida: 'Suspendida', cancelada: 'Cancelada',
}

type Sub = NonNullable<ReturnType<typeof useSuscripcion>['data']>

export default function MiPlan() {
  const { data, loading, refetch } = useSuscripcion()
  const [catalogo, setCatalogo] = useState<PlanCatalogo[] | null>(null)
  const [ultimoPago, setUltimoPago] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    const token = useAuthStore.getState().token
    if (!token) return
    planesApi.catalogo(token).then((r) => setCatalogo(r.data)).catch(() => setCatalogo([]))
    planesApi.pagos(token).then((r) => {
      const ultimo = (r.data ?? []).filter((p: any) => p.estado === 'paid').sort(
        (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )[0]
      setUltimoPago(ultimo?.createdAt ?? null)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!searchParams.get('plan')) return
    if (searchParams.get('plan') === 'success') toast.success('¡Pago recibido! Estamos activando tu plan…')
    searchParams.delete('plan')
    setSearchParams(searchParams, { replace: true })
    const timers = [1500, 4000, 8000].map((ms) => setTimeout(refetch, ms))
    return () => timers.forEach(clearTimeout)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading || !data) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>

  const sinPlan = data.sinSuscripcion || !data.planId || !data.planNombre
  return (
    <main className="mx-auto w-full max-w-4xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
      <header className="mx-auto mb-12 max-w-xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">Tu plan</h1>
        <p className="mt-3 text-sm text-muted-foreground">Gestioná tu suscripción y pagos de Piru.</p>
      </header>

      {sinPlan ? <SinPlan data={data} catalogo={catalogo} onDone={refetch} /> : (
        <div className="mx-auto max-w-3xl space-y-10">
          <Atencion data={data} />
          <PlanActual data={data} ultimoPago={ultimoPago} />
          <SiguientePlan data={data} catalogo={catalogo} />
          <TodosLosPlanes data={data} catalogo={catalogo} onDone={refetch} />
        </div>
      )}
    </main>
  )
}

function usePagoLink(planId: number | null, ciclo: Ciclo) {
  const [enviando, setEnviando] = useState(false)
  const enviarLink = async () => {
    if (!planId) return toast.error('Elegí un plan para empezar.')
    const token = useAuthStore.getState().token
    if (!token) return
    setEnviando(true)
    try {
      const res = await planesApi.enviarPagoLinkWhatsapp(token, planId, ciclo)
      toast.success(`Te enviamos el link de pago a tu WhatsApp (${res.data.telefono})`)
    } catch (e: any) { toast.error(e?.message || 'No se pudo enviar el link por WhatsApp') }
    finally { setEnviando(false) }
  }
  return { enviarLink, enviando }
}

function BotonPagoWhatsapp({ planId, ciclo, label, variant = 'default' }: { planId: number | null; ciclo: Ciclo; label: string; variant?: 'default' | 'outline' }) {
  const { enviarLink, enviando } = usePagoLink(planId, ciclo)
  return <Button onClick={enviarLink} disabled={enviando} variant={variant} className="w-full sm:w-auto">
    {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <><MessageCircle className="h-4 w-4" />{label}</>}
  </Button>
}

function Atencion({ data }: { data: Sub }) {
  let mensaje: string | null = null
  if (data.estado === 'suspendida') mensaje = 'Tu plan está suspendido por falta de pago. Pagá para reactivar las funciones premium.'
  else if (data.estado === 'pago_pendiente') mensaje = data.graciaHasta ? `Tu cuota venció. Tenés hasta el ${fmtFecha(data.graciaHasta)} para pagar sin perder funciones.` : 'Tu cuota venció. Pagá para seguir con todas las funciones activas.'
  else if (data.estado === 'cancelada') mensaje = 'Cancelaste tu plan. Pagá para volver a activar las funciones premium.'
  else {
    const renov = renovacionProxima(data)
    if (renov && data.estado !== 'trial') mensaje = renov.diasRestantes <= 0 ? 'Tu plan se renueva hoy. Pagá la cuota para no perder funciones.' : `Tu plan se renueva ${fmtFecha(data.fechaProximoCobro) ? `el ${fmtFecha(data.fechaProximoCobro)}` : `en ${renov.diasRestantes} días`}.`
  }
  return mensaje ? <div className="flex items-start gap-3 border-b border-amber-200 pb-4 text-sm text-foreground dark:border-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />{mensaje}</div> : null
}

function PlanActual({ data, ultimoPago }: { data: Sub; ultimoPago: string | null }) {
  const ciclo: Ciclo = data.ciclo === 'anual' ? 'anual' : 'mensual'
  const esTrial = data.estado === 'trial'
  const necesitaPago = ['pago_pendiente', 'suspendida', 'cancelada'].includes(data.estado ?? '')
  const finTrial = fmtFecha(data.trialFin ?? data.fechaProximoCobro)
  const trialDias = data.trialFin ? Math.max(0, Math.ceil((new Date(data.trialFin).getTime() - Date.now()) / 86_400_000)) : null
  const cta = esTrial ? 'Asegurar mi plan por WhatsApp' : necesitaPago ? 'Pagar por WhatsApp' : 'Renovar por WhatsApp'
  return <section className="border-y border-border py-7 sm:px-2">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Tu plan actual</p>
        <h2 className="mt-1 text-3xl font-semibold tracking-tight">{data.planNombre}</h2>
      </div>
      <p className="inline-flex items-center gap-2 text-sm text-muted-foreground"><span className="h-2 w-2 rounded-full bg-emerald-500" />{ESTADO_LABEL[data.estado ?? ''] ?? data.estado}</p>
    </div>
    <div className="mt-6 flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1.5 text-sm text-muted-foreground">
        {data.precioMensual && <p className="text-base font-medium text-foreground">{fmtARS(data.precioMensual)} <span className="font-normal text-muted-foreground">/ mes{data.ciclo === 'anual' ? ' · cobro anual' : ''}</span></p>}
        {esTrial ? <p>{trialDias && trialDias > 0 ? `Prueba gratis hasta el ${finTrial} · quedan ${trialDias} días.` : `Prueba gratis${finTrial ? ` hasta el ${finTrial}` : ''}.`}</p> : <>{ultimoPago && <p>Último pago: {fmtFecha(ultimoPago)}</p>}{data.fechaProximoCobro && !necesitaPago && <p>Próximo pago: {fmtFecha(data.fechaProximoCobro)}</p>}</>}
        {(data.trialValor?.pedidos ?? 0) > 0 && <p>Ya recibiste {data.trialValor!.pedidos} pedidos por {fmtARS(data.trialValor!.monto)} con Piru.</p>}
      </div>
      <div className="shrink-0"><BotonPagoWhatsapp planId={data.planId} ciclo={ciclo} label={cta} /><p className="mt-2 text-center text-xs text-muted-foreground">El link llega al WhatsApp del local.</p></div>
    </div>
  </section>
}

function PlanVisual({ codigo, compact = false }: { codigo: string; compact?: boolean }) {
  if (codigo === 'intermedio') return <div className={cn('mx-auto space-y-4', compact ? 'max-w-sm' : 'max-w-xl')}>
    <img src="/mensaje_confirmado.png" alt="Aviso de pedido confirmado por WhatsApp" className="w-full rounded-xl border border-border/70 shadow-sm" />
    <img src="/mensaje_despachado.png" alt="Aviso de pedido en camino por WhatsApp" className="w-full rounded-xl border border-border/70 shadow-sm" />
  </div>
  if (codigo === 'avanzado') return <img src="/recupero_dormido.png" alt="Mensaje de recupero automático a un cliente" className={cn('mx-auto rounded-2xl border border-border/70 shadow-sm', compact ? 'max-w-xs' : 'max-w-sm')} />
  return null
}

function DetallesPlan({ plan, ordenBase }: { plan: PlanCatalogo; ordenBase: number }) {
  const [abierto, setAbierto] = useState(false)
  const items = plan.orden === ordenBase ? FEATURES_BASE : plan.features.map((f) => FEATURE_LABELS[f] ?? f)
  return <div className="mt-5">
    <button onClick={() => setAbierto(!abierto)} className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
      {abierto ? 'Ocultar lo que incluye' : 'Ver qué incluye'} {abierto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
    </button>
    {abierto && <ul className="mt-3 grid gap-2 border-l border-border pl-4 text-sm text-muted-foreground sm:grid-cols-2">
      {plan.orden > ordenBase && <li className="sm:col-span-2 font-medium text-foreground">Todo lo del plan anterior, y además:</li>}
      {items.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{f}</li>)}
    </ul>}
  </div>
}

function SiguientePlan({ data, catalogo }: { data: Sub; catalogo: PlanCatalogo[] | null }) {
  const siguiente = useMemo(() => {
    const actual = catalogo?.find((p) => p.id === data.planId)
    return catalogo?.filter((p) => p.orden > (actual?.orden ?? -1)).sort((a, b) => a.orden - b.orden)[0] ?? null
  }, [catalogo, data.planId])
  if (!siguiente || !catalogo) return null
  const base = Math.min(...catalogo.map((p) => p.orden))
  const intermedio = siguiente.codigo === 'intermedio'
  const titulo = intermedio ? 'Que cada pedido se avise solo' : 'Hacé que tus clientes vuelvan'
  const detalle = intermedio ? 'Confirmado, en camino y listo para retirar. Tus clientes reciben los avisos desde la marca de tu local, sin que tengas que abrir un chat.' : 'El Motor de Recompra vuelve a hablarle a quienes se enfriaron, con mensajes que llevan directo a repetir su pedido.'
  const cta = intermedio ? 'Automatizar los avisos de mis pedidos' : 'Empezar a recuperar clientes automáticamente'
  return <section className="text-center">
    <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">El próximo paso</p>
    <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{titulo}</h2>
    <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">{detalle}</p>
    <div className="mx-auto mt-7 max-w-lg"><PlanVisual codigo={siguiente.codigo} /></div>
    <div className="mt-6"><BotonPagoWhatsapp planId={siguiente.id} ciclo={data.ciclo === 'anual' ? 'anual' : 'mensual'} label={cta} /><p className="mt-2 text-sm text-muted-foreground">{fmtARS(siguiente.precioMensual)} / mes</p></div>
    <DetallesPlan plan={siguiente} ordenBase={base} />
  </section>
}

function TodosLosPlanes({ data, catalogo }: { data: Sub; catalogo: PlanCatalogo[] | null; onDone: () => void }) {
  const [abierto, setAbierto] = useState(false)
  const [ciclo, setCiclo] = useState<Ciclo>(data.ciclo === 'anual' ? 'anual' : 'mensual')
  if (!catalogo?.length) return null
  const planes = [...catalogo].sort((a, b) => a.orden - b.orden)
  const base = Math.min(...planes.map((p) => p.orden))
  const descuentoMax = Math.max(0, ...planes.map((p) => descuentoAnualEfectivo(p.descuentoAnual)))
  return <section className="border-t border-border pt-8 text-center">
    <button onClick={() => setAbierto(!abierto)} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">Comparar todos los planes {abierto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>
    {abierto && <div className="mt-8 text-left">
      {descuentoMax > 0 && <div className="mb-8 flex justify-center"><CicloToggle value={ciclo} onChange={setCiclo} descuentoMax={descuentoMax} /></div>}
      <div className="grid gap-8 md:grid-cols-3">{planes.map((p) => <PlanCard key={p.id} data={data} plan={p} ciclo={ciclo} ordenBase={base} />)}</div>
      <p className="mt-8 flex justify-center gap-1.5 text-xs text-muted-foreground"><Lock className="h-3 w-3" />Pago seguro con Mercado Pago. Sin comisión por venta.</p>
    </div>}
  </section>
}

function PlanCard({ data, plan, ciclo, ordenBase }: { data: Sub; plan: PlanCatalogo; ciclo: Ciclo; ordenBase: number }) {
  const actual = plan.id === data.planId && data.conAccesoAPago && data.ciclo === ciclo
  const precio = parseFloat(plan.precioMensual)
  const desc = descuentoAnualEfectivo(plan.descuentoAnual)
  const total = precioAnual(precio, desc)
  const esVisual = plan.codigo === 'intermedio' || plan.codigo === 'avanzado'
  // En la grilla comparativa el CTA necesita caber en una columna; el mensaje largo queda
  // reservado para la propuesta destacada que aparece antes de comparar los planes.
  const label = plan.codigo === 'intermedio' ? 'Automatizar mis avisos' : plan.codigo === 'avanzado' ? 'Recuperar más clientes' : `Cambiar a ${plan.nombre}`
  return <article className={cn('flex flex-col border-t pt-5', actual && 'border-brand')}>
    <div className="flex items-baseline justify-between gap-3"><h3 className="text-xl font-semibold">{plan.nombre}</h3>{actual && <span className="text-xs font-medium text-brand">Tu plan</span>}</div>
    <p className="mt-2 text-2xl font-semibold">{ciclo === 'anual' ? fmtARS(total) : fmtARS(precio)}<span className="text-sm font-normal text-muted-foreground"> {ciclo === 'anual' ? '/ año' : '/ mes'}</span></p>
    {ciclo === 'anual' && desc > 0 && <p className="mt-1 text-xs text-muted-foreground">Equivale a {fmtARS(total / 12)}/mes · ahorrás {desc}%</p>}
    {plan.mensajesIncluidos > 0 && <p className="mt-2 text-sm text-muted-foreground">{plan.mensajesIncluidos} avisos al cliente / mes</p>}
    {plan.mensajesMarketingIncluidos > 0 && <p className="mt-1 text-sm text-muted-foreground">{plan.mensajesMarketingIncluidos} mensajes de campaña / mes</p>}
    {esVisual && <div className="mt-5"><PlanVisual codigo={plan.codigo} compact /></div>}
    <DetallesPlan plan={plan} ordenBase={ordenBase} />
    <div className="mt-6">{actual ? <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Check className="h-4 w-4 text-emerald-500" />Es tu plan actual</p> : <BotonPagoWhatsapp planId={plan.id} ciclo={ciclo} label={label} variant={plan.codigo === 'intermedio' ? 'default' : 'outline'} />}</div>
  </article>
}

function SinPlan({ data, catalogo, onDone }: { data: Sub; catalogo: PlanCatalogo[] | null; onDone: () => void }) {
  const base = catalogo ? [...catalogo].sort((a, b) => a.orden - b.orden)[0] : null
  return <div className="mx-auto max-w-xl text-center"><p className="text-lg font-semibold">Elegí cómo querés empezar</p><p className="mt-2 text-sm text-muted-foreground">Activá el Básico para asegurar tus funciones. Después podés mejorarlo cuando quieras.</p>{base && <div className="mt-8 text-left"><PlanCard data={data} plan={base} ciclo="mensual" ordenBase={base.orden} /></div>}{catalogo && <div className="mt-8"><TodosLosPlanes data={data} catalogo={catalogo} onDone={onDone} /></div>}</div>
}
