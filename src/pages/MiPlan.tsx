import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  Check,
  Loader2,
  MessageCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Lock,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn, descuentoAnualEfectivo, precioAnual } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { planesApi, type PlanCatalogo } from '@/lib/api'
import { CicloToggle, type Ciclo } from '@/components/CicloToggle'
import { useSuscripcion, renovacionProxima } from './ajustes/hooks/useSuscripcion'

// ── Helpers ────────────────────────────────────────────────────────────────
const fmtARS = (n: number | string) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(
    typeof n === 'string' ? parseFloat(n) : n,
  )

const fmtFecha = (iso: string | null | undefined) => {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
}

const FEATURE_LABELS: Record<string, string> = {
  avisos_whatsapp_cliente: 'Avisos automáticos al cliente por WhatsApp',
  facturacion_arca: 'Facturación electrónica ARCA',
  rapiboy: 'Integración con Rapiboy (cadetes)',
  multisucursal: 'Múltiples sucursales',
  estadisticas_avanzadas: 'Estadísticas avanzadas',
  dominio_propio: 'Dominio propio',
  motor_recompra: 'Motor de Recompra',
}

// Lo que "resuelve" cada plan superior — el titular que justifica el salto (no una lista de features).
const BENEFICIO_PLAN: Record<string, { titular: string; detalle: string }> = {
  intermedio: {
    titular: 'Cero chat con el cliente',
    detalle:
      'Los avisos “en camino” y “listo para retirar” salen solos, con tu marca. El cliente no tiene que escribir y vos no perdés tiempo respondiendo.',
  },
  avanzado: {
    titular: 'Tu base de clientes vuelve sola',
    detalle:
      'El Motor de Recompra detecta a los clientes que se enfrían y los trae de vuelta automáticamente, con campañas medidas contra un grupo de control.',
  },
}

// Base incluida en todos los planes (para que el Básico no parezca vacío).
const FEATURES_BASE = [
  'Pedidos por WhatsApp + centro de pedidos',
  'Impresión automática de comandas',
  'Productos, categorías y pedidos ilimitados',
  'Todos los métodos de pago',
  'Cupones, promociones y horarios',
  'Múltiples sucursales y dominio propio',
]

const ESTADO_LABEL: Record<string, string> = {
  trial: 'Prueba gratis',
  activa: 'Al día',
  pago_pendiente: 'Pago pendiente',
  suspendida: 'Suspendida',
  cancelada: 'Cancelada',
}

// Un punto de color, no un pill lleno de bordes: mínimo y legible.
const ESTADO_DOT: Record<string, string> = {
  trial: 'bg-brand',
  activa: 'bg-emerald-500',
  pago_pendiente: 'bg-amber-500',
  suspendida: 'bg-red-500',
  cancelada: 'bg-muted-foreground',
}

type Sub = NonNullable<ReturnType<typeof useSuscripcion>['data']>

export default function MiPlan() {
  const { data, loading, refetch } = useSuscripcion()
  const [catalogo, setCatalogo] = useState<PlanCatalogo[] | null>(null)
  const [ultimoPago, setUltimoPago] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  // Catálogo (precios + features del plan siguiente) y último pago acreditado.
  useEffect(() => {
    const token = useAuthStore.getState().token
    if (!token) return
    planesApi.catalogo(token).then((r) => setCatalogo(r.data)).catch(() => setCatalogo([]))
    planesApi
      .pagos(token)
      .then((r) => {
        const pagados = (r.data ?? []).filter((p: any) => p.estado === 'paid')
        const ultimo = pagados.sort(
          (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )[0]
        setUltimoPago(ultimo?.createdAt ?? null)
      })
      .catch(() => {})
  }, [])

  // Volver de un pago acreditado por webhook (unos segundos) → reintentar.
  useEffect(() => {
    const plan = searchParams.get('plan')
    if (!plan) return
    if (plan === 'success') toast.success('¡Pago recibido! Estamos activando tu plan…')
    searchParams.delete('plan')
    setSearchParams(searchParams, { replace: true })
    const timers = [1500, 4000, 8000].map((ms) => setTimeout(() => refetch(), ms))
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading || !data) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const sinPlan = data.sinSuscripcion || !data.planId || !data.planNombre

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <h1 className="text-[26px] font-semibold tracking-tight text-foreground">Tu plan</h1>
        <p className="mt-1 text-sm text-muted-foreground">Gestioná tu suscripción y pagos de Piru.</p>
      </header>

      {sinPlan ? (
        <SinPlan data={data} catalogo={catalogo} onDone={refetch} />
      ) : (
        <div className="space-y-6">
          <AtencionBanner data={data} />
          <PlanActualCard data={data} ultimoPago={ultimoPago} />
          <UpgradeCard data={data} catalogo={catalogo} />
          <TodosLosPlanes data={data} catalogo={catalogo} onDone={refetch} />
        </div>
      )}
    </div>
  )
}

// Pago por WhatsApp: el único camino de cobro. Enviamos el link al WhatsApp del dueño
// y paga desde el celular (el pago se acredita por webhook).
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
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo enviar el link por WhatsApp')
    } finally {
      setEnviando(false)
    }
  }

  return { enviarLink, enviando }
}

// Botón de pago único (WhatsApp). Estilo primario, ancho completo.
function BotonPagoWhatsapp({
  planId,
  ciclo,
  label,
  variant = 'default',
}: {
  planId: number | null
  ciclo: Ciclo
  label: string
  variant?: 'default' | 'outline'
}) {
  const { enviarLink, enviando } = usePagoLink(planId, ciclo)
  return (
    <Button onClick={enviarLink} disabled={enviando} variant={variant} className="w-full">
      {enviando ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <MessageCircle className="h-4 w-4" /> {label}
        </>
      )}
    </Button>
  )
}

// ── Sin plan todavía (transición "no plan → plan") ──────────────────────────
function SinPlan({
  data,
  catalogo,
  onDone,
}: {
  data: Sub
  catalogo: PlanCatalogo[] | null
  onDone: () => void
}) {
  const base = catalogo ? [...catalogo].sort((a, b) => a.orden - b.orden)[0] : null

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-muted/40 p-6">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Todavía no elegiste un plan</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Estás usando Piru con acceso completo. Activá el plan Básico para asegurar tus funciones;
          después podés mejorarlo cuando quieras.
        </p>
      </div>

      {base && (
        <PlanCard data={data} plan={base} ciclo="mensual" ordenBase={base.orden} destacado />
      )}
      {catalogo && catalogo.length > 1 && <TodosLosPlanes data={data} catalogo={catalogo} onDone={onDone} />}
    </div>
  )
}

// ── Banner de atención (solo plan: cobro vencido / renovación próxima) ───────
function AtencionBanner({ data }: { data: Sub }) {
  let mensaje: string | null = null
  let tono: 'warn' | 'error' = 'warn'

  if (data.estado === 'suspendida') {
    tono = 'error'
    mensaje = 'Tu plan está suspendido por falta de pago. Pagá para reactivar las funciones premium.'
  } else if (data.estado === 'pago_pendiente') {
    const hasta = fmtFecha(data.graciaHasta)
    mensaje = hasta
      ? `Tu cuota venció. Tenés hasta el ${hasta} para pagar sin perder funciones.`
      : 'Tu cuota venció. Pagá para seguir con todas las funciones activas.'
  } else if (data.estado === 'cancelada') {
    mensaje = 'Cancelaste tu plan. Pagá para volver a activar las funciones premium.'
  } else {
    const renov = renovacionProxima(data)
    if (renov && data.estado !== 'trial') {
      const fecha = fmtFecha(data.fechaProximoCobro)
      mensaje =
        renov.diasRestantes <= 0
          ? 'Tu plan se renueva hoy. Pagá la cuota para no perder funciones.'
          : `Tu plan se renueva ${fecha ? `el ${fecha}` : `en ${renov.diasRestantes} días`}. El cobro es manual: pagá para no perder funciones.`
    }
  }

  if (!mensaje) return null

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-2xl px-4 py-3.5',
        tono === 'error' ? 'bg-red-500/10' : 'bg-amber-500/10',
      )}
    >
      <AlertTriangle
        className={cn('mt-0.5 h-4 w-4 shrink-0', tono === 'error' ? 'text-red-500' : 'text-amber-500')}
      />
      <p className="text-[13px] leading-relaxed text-foreground">{mensaje}</p>
    </div>
  )
}

// ── Card del plan actual (incluye estado de prueba gratis) ──────────────────
function PlanActualCard({ data, ultimoPago }: { data: Sub; ultimoPago: string | null }) {
  const estado = data.estado
  const ciclo: Ciclo = data.ciclo === 'anual' ? 'anual' : 'mensual'
  const esTrial = estado === 'trial'
  const necesitaPago = estado === 'pago_pendiente' || estado === 'suspendida' || estado === 'cancelada'
  const proximo = fmtFecha(data.fechaProximoCobro)
  const finTrial = fmtFecha(data.trialFin ?? data.fechaProximoCobro)
  const trialDias = data.trialFin
    ? Math.max(0, Math.ceil((new Date(data.trialFin).getTime() - Date.now()) / 86_400_000))
    : null

  const cta = esTrial ? 'Pagar mi plan por WhatsApp' : necesitaPago ? 'Pagar por WhatsApp' : 'Renovar por WhatsApp'

  return (
    <div className="rounded-2xl bg-muted/40 p-6">
      {/* Encabezado: plan + estado, jerarquía por peso tipográfico */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Tu plan actual
        </span>
        {estado && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <span className={cn('h-1.5 w-1.5 rounded-full', ESTADO_DOT[estado] ?? 'bg-muted-foreground')} />
            {ESTADO_LABEL[estado] ?? estado}
          </span>
        )}
      </div>

      <div className="mt-1.5 flex items-baseline gap-3">
        <h2 className="text-3xl font-semibold tracking-tight text-foreground">{data.planNombre}</h2>
        {data.precioMensual && (
          <span className="text-sm text-muted-foreground">
            {fmtARS(data.precioMensual)}/mes{data.ciclo === 'anual' && ' · anual'}
          </span>
        )}
      </div>

      {/* Prueba gratis: cuánto queda + valor generado. */}
      {esTrial && (
        <div className="mt-5 rounded-xl bg-brand/[0.06] px-4 py-3.5">
          <p className="text-sm font-medium text-foreground">
            {trialDias != null && trialDias > 0
              ? `Te quedan ${trialDias} ${trialDias === 1 ? 'día' : 'días'} de prueba gratis.`
              : 'Estás en tu prueba gratis.'}
          </p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
            {finTrial ? `Termina el ${finTrial}. ` : ''}
            Podés pagarla ahora y quedarte tranquilo — no esperás a que se corte.
          </p>
          {(data.trialValor?.pedidos ?? 0) > 0 && (
            <p className="mt-2 text-[13px] font-medium text-brand">
              Ya recibiste {data.trialValor!.pedidos}{' '}
              {data.trialValor!.pedidos === 1 ? 'pedido' : 'pedidos'} por {fmtARS(data.trialValor!.monto)} con Piru.
            </p>
          )}
        </div>
      )}

      {/* Fechas de facturación (fuera del trial), como lista limpia con hairlines. */}
      {!esTrial && (ultimoPago || (proximo && !necesitaPago)) && (
        <dl className="mt-5 space-y-px overflow-hidden rounded-xl">
          {ultimoPago && (
            <div className="flex items-center justify-between gap-4 bg-background/40 px-4 py-3 text-[13px]">
              <dt className="text-muted-foreground">Último pago</dt>
              <dd className="font-medium text-foreground">{fmtFecha(ultimoPago)}</dd>
            </div>
          )}
          {proximo && !necesitaPago && (
            <div className="flex items-center justify-between gap-4 bg-background/40 px-4 py-3 text-[13px]">
              <dt className="text-muted-foreground">Próximo pago</dt>
              <dd className="font-medium text-foreground">{proximo}</dd>
            </div>
          )}
        </dl>
      )}

      <div className="mt-6">
        <BotonPagoWhatsapp planId={data.planId} ciclo={ciclo} label={cta} />
        <p className="mt-2 text-center text-[12px] text-muted-foreground">
          Te enviamos el link al WhatsApp del local y pagás desde el celular.
        </p>
      </div>
    </div>
  )
}

// ── Card escalonada: solo el plan inmediatamente superior (lo que resuelve) ──
function UpgradeCard({
  data,
  catalogo,
}: {
  data: Sub
  catalogo: PlanCatalogo[] | null
}) {
  const ciclo: Ciclo = data.ciclo === 'anual' ? 'anual' : 'mensual'

  const siguiente = useMemo(() => {
    if (!catalogo) return null
    const actual = catalogo.find((p) => p.id === data.planId)
    const ordenActual = actual?.orden ?? -1
    return catalogo
      .filter((p) => p.orden > ordenActual)
      .sort((a, b) => a.orden - b.orden)[0] ?? null
  }, [catalogo, data.planId])

  if (!siguiente) return null // Ya está en el plan más alto: no hay a dónde mejorar.

  const precio = parseFloat(siguiente.precioMensual)
  const beneficio = BENEFICIO_PLAN[siguiente.codigo]
  const nuevas = siguiente.features // features que suma sobre el plan anterior

  return (
    <div className="rounded-2xl bg-brand/[0.05] p-6">
      <span className="text-[11px] font-medium uppercase tracking-wide text-brand">Mejorá tu plan</span>

      <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
        {beneficio?.titular ?? `Pasá al plan ${siguiente.nombre}`}
      </h3>
      {beneficio && (
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{beneficio.detalle}</p>
      )}

      <ul className="mt-5 space-y-2.5">
        {nuevas.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-[13.5px] text-foreground">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            {FEATURE_LABELS[f] ?? f}
          </li>
        ))}
        {siguiente.mensajesIncluidos > 0 && (
          <li className="flex items-start gap-2.5 text-[13.5px] text-foreground">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            {siguiente.mensajesIncluidos} avisos al cliente / mes
          </li>
        )}
        {siguiente.mensajesMarketingIncluidos > 0 && (
          <li className="flex items-start gap-2.5 text-[13.5px] text-foreground">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            {siguiente.mensajesMarketingIncluidos} mensajes de campaña / mes
          </li>
        )}
      </ul>

      <div className="mt-6 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tracking-tight text-foreground">{fmtARS(precio)}</span>
        <span className="text-sm text-muted-foreground">/mes</span>
      </div>

      <div className="mt-4">
        <BotonPagoWhatsapp planId={siguiente.id} ciclo={ciclo} label={`Recibir link para ${siguiente.nombre}`} />
      </div>
    </div>
  )
}

// ── Ver todos los planes (discreto, colapsado por defecto) ──────────────────
function TodosLosPlanes({
  data,
  catalogo,
  onDone: _onDone,
}: {
  data: Sub
  catalogo: PlanCatalogo[] | null
  onDone: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [ciclo, setCiclo] = useState<Ciclo>(data.ciclo === 'anual' ? 'anual' : 'mensual')

  if (!catalogo || catalogo.length === 0) return null

  const planes = [...catalogo].sort((a, b) => a.orden - b.orden)
  const ordenBase = Math.min(...catalogo.map((p) => p.orden))
  const descuentoMax = Math.max(0, ...catalogo.map((p) => descuentoAnualEfectivo(p.descuentoAnual)))

  return (
    <div className="pt-1">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        Ver todos los planes
        {abierto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {abierto && (
        <div className="mt-5 space-y-4">
          {descuentoMax > 0 && (
            <div className="flex justify-center">
              <CicloToggle value={ciclo} onChange={setCiclo} descuentoMax={descuentoMax} />
            </div>
          )}
          {planes.map((p) => (
            <PlanCard key={p.id} data={data} plan={p} ciclo={ciclo} ordenBase={ordenBase} />
          ))}
          <p className="flex items-center justify-center gap-1.5 pt-1 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            Pago seguro con Mercado Pago. Sin comisión por venta.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Card de un plan (stack vertical, estilo app mobile) ─────────────────────
function PlanCard({
  data,
  plan,
  ciclo,
  ordenBase,
  destacado,
}: {
  data: Sub
  plan: PlanCatalogo
  ciclo: Ciclo
  ordenBase: number
  destacado?: boolean
}) {
  const cicloActual = data.ciclo === 'anual' ? 'anual' : 'mensual'
  const esActual = plan.id === data.planId && data.conAccesoAPago && cicloActual === ciclo
  const esMismoPlanOtroCiclo = plan.id === data.planId && data.conAccesoAPago && cicloActual !== ciclo
  const tienePlan = !!data.planId

  const precio = parseFloat(plan.precioMensual)
  const desc = descuentoAnualEfectivo(plan.descuentoAnual)
  const totalAnual = precioAnual(precio, desc)
  const mostrarBase = plan.orden === ordenBase

  const cta = esMismoPlanOtroCiclo
    ? ciclo === 'anual'
      ? 'Pasar a anual por WhatsApp'
      : 'Pasar a mensual por WhatsApp'
    : `Recibir link para ${tienePlan ? 'cambiar a' : 'activar'} ${plan.nombre}`

  return (
    <div
      className={cn(
        'rounded-2xl p-6',
        esActual ? 'bg-brand/[0.06] ring-1 ring-brand/30' : destacado ? 'bg-brand/[0.05]' : 'bg-muted/40',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground">{plan.nombre}</h4>
        {esActual ? (
          <span className="text-[11px] font-medium text-brand">Tu plan</span>
        ) : destacado ? (
          <span className="text-[11px] font-medium text-brand">Recomendado</span>
        ) : null}
      </div>

      {precio <= 0 ? (
        <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Gratis</p>
      ) : ciclo === 'anual' ? (
        <div className="mt-2">
          <p className="text-2xl font-semibold tracking-tight text-foreground">
            {fmtARS(totalAnual)}
            <span className="text-sm font-normal text-muted-foreground"> /año</span>
          </p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {fmtARS(totalAnual / 12)}/mes
            {desc > 0 && (
              <>
                {' · '}
                <span className="text-muted-foreground/70 line-through">{fmtARS(precio * 12)}</span>{' '}
                <span className="font-medium text-emerald-600 dark:text-emerald-400">-{desc}%</span>
              </>
            )}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          {fmtARS(precio)}
          <span className="text-sm font-normal text-muted-foreground"> /mes</span>
        </p>
      )}

      {plan.mensajesIncluidos > 0 && (
        <p className="mt-1 text-[13px] text-muted-foreground">{plan.mensajesIncluidos} avisos al cliente / mes</p>
      )}
      {plan.mensajesMarketingIncluidos > 0 && (
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {plan.mensajesMarketingIncluidos} mensajes de campaña / mes
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {mostrarBase &&
          FEATURES_BASE.map((f) => (
            <li key={f} className="flex items-start gap-2 text-[13px] text-muted-foreground">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
              {f}
            </li>
          ))}
        {!mostrarBase && (
          <li className="flex items-start gap-2 text-[13px] font-medium text-foreground">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
            Todo lo del plan anterior, y además:
          </li>
        )}
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-[13px] text-foreground">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
            {FEATURE_LABELS[f] ?? f}
          </li>
        ))}
      </ul>

      <div className="mt-5">
        {esActual ? (
          <p className="flex items-center justify-center gap-1.5 text-[13px] font-medium text-muted-foreground">
            <Check className="h-4 w-4 text-brand" /> Es tu plan actual
          </p>
        ) : precio <= 0 ? (
          <p className="text-center text-[13px] font-medium text-muted-foreground">Incluido en todos los planes</p>
        ) : (
          <BotonPagoWhatsapp
            planId={plan.id}
            ciclo={ciclo}
            label={cta}
            variant={destacado || esMismoPlanOtroCiclo ? 'default' : 'outline'}
          />
        )}
      </div>
    </div>
  )
}
