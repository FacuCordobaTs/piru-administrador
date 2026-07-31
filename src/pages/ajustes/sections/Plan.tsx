import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  Check,
  Lock,
  Loader2,
  AlertTriangle,
  Crown,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { mensajesApi, planesApi, type PackRecarga, type PlanCatalogo } from '@/lib/api'
import { AjusteEditor } from '../components/AjusteEditor'
import { SectionSkeleton } from '../components/SectionSkeleton'
import { useSuscripcion } from '../hooks/useSuscripcion'

// ── Helpers ────────────────────────────────────────────────────────────────
const fmtARS = (n: number | string) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(
    typeof n === 'string' ? parseFloat(n) : n,
  )

const fmtFecha = (iso: string | null) => {
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

// Features incluidas en todos los planes (base): se listan para que el Básico no
// parezca vacío. No se candadean nunca.
const FEATURES_BASE = [
  'Pedidos por WhatsApp + centro de pedidos',
  'Impresión automática de comandas',
  'Productos y categorías ilimitados',
  'Todos los métodos de pago',
  'Cupones y promociones',
]

const ESTADO_LABEL: Record<string, string> = {
  trial: 'Prueba gratis',
  activa: 'Al día',
  pago_pendiente: 'Pago pendiente',
  suspendida: 'Suspendida',
  cancelada: 'Cancelada',
}

const ESTADO_TONE: Record<string, string> = {
  trial: 'bg-brand/10 text-brand',
  activa: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  pago_pendiente: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  suspendida: 'bg-red-500/10 text-red-600 dark:text-red-400',
  cancelada: 'bg-muted text-muted-foreground',
}

export default function Plan() {
  const { data, loading, refetch } = useSuscripcion()
  const [catalogo, setCatalogo] = useState<PlanCatalogo[] | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  // Cargar catálogo de planes.
  useEffect(() => {
    const token = useAuthStore.getState().token
    if (!token) return
    planesApi.catalogo(token).then((r) => setCatalogo(r.data)).catch(() => setCatalogo([]))
  }, [])

  // Volver de MercadoPago: refrescar y avisar. El pago se acredita por webhook, así
  // que puede tardar unos segundos: reintentamos un par de veces.
  useEffect(() => {
    const plan = searchParams.get('plan')
    const recarga = searchParams.get('recarga')
    if (!plan && !recarga) return
    if (plan === 'success') toast.success('¡Pago recibido! Estamos activando tu plan…')
    if (recarga === 'success') toast.success('¡Pago recibido! Estamos acreditando tu saldo…')
    // Limpiar la query.
    searchParams.delete('plan')
    searchParams.delete('recarga')
    setSearchParams(searchParams, { replace: true })
    // Reintentos escalonados: el webhook suele acreditar en segundos.
    const timers = [1500, 4000, 8000].map((ms) => setTimeout(() => refetch(), ms))
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading || !data) {
    return <SectionSkeleton />
  }

  return (
    <section className="space-y-8">
      <header className="space-y-1">
        <h2 className="text-lg font-medium text-foreground">Plan y saldo</h2>
        <p className="text-sm font-normal text-muted-foreground">
          Tu plan, la cuota mensual y el saldo de avisos por WhatsApp a tus clientes.
        </p>
      </header>

      <AtencionBanner data={data} />
      <PlanActualCard data={data} onDone={refetch} />
      {!data.wallet?.ilimitado && data.wallet && (
        <SaldoCard data={data} onDone={refetch} />
      )}
      {data.wallet?.ilimitado && <SaldoIlimitadoCard />}
      <PlanesDisponibles data={data} catalogo={catalogo} onDone={refetch} />
      <Movimientos />
    </section>
  )
}

// ── Banner de atención (cobro vencido / saldo bajo) ─────────────────────────
function AtencionBanner({ data }: { data: NonNullable<ReturnType<typeof useSuscripcion>['data']> }) {
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
    mensaje = 'Cancelaste tu plan. Elegí uno abajo para volver a activar las funciones premium.'
  } else if (!data.wallet?.ilimitado && data.wallet?.utility?.negativo) {
    tono = 'error'
    mensaje = 'Te quedaste sin saldo de avisos. Los avisos siguen saliendo, pero quedan como saldo a descontar. Recargá para ponerte al día.'
  } else if (!data.wallet?.ilimitado && data.wallet?.alerta === '95') {
    mensaje = 'Te queda menos del 5% de tus avisos incluidos este mes. Considerá recargar.'
  }

  if (!mensaje) return null

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border px-4 py-3',
        tono === 'error'
          ? 'border-red-500/30 bg-red-500/10'
          : 'border-amber-500/30 bg-amber-500/10',
      )}
    >
      <AlertTriangle
        className={cn('mt-0.5 h-4 w-4 shrink-0', tono === 'error' ? 'text-red-500' : 'text-amber-500')}
      />
      <p className="text-[13px] leading-relaxed text-foreground">{mensaje}</p>
    </div>
  )
}

// ── Card del plan actual ────────────────────────────────────────────────────
function PlanActualCard({
  data,
  onDone,
}: {
  data: NonNullable<ReturnType<typeof useSuscripcion>['data']>
  onDone: () => void
}) {
  const [pagando, setPagando] = useState(false)
  const estado = data.estado
  const proximo = fmtFecha(data.fechaProximoCobro)
  const necesitaPago =
    estado === 'pago_pendiente' || estado === 'suspendida' || estado === 'cancelada'

  const renovar = async () => {
    if (!data.planId) {
      toast.error('Elegí un plan abajo para empezar.')
      return
    }
    const token = useAuthStore.getState().token
    if (!token) return
    setPagando(true)
    try {
      const res = await planesApi.suscribir(token, data.planId, (data.ciclo as any) || 'mensual')
      window.location.href = res.data.url_pago
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo iniciar el pago')
      setPagando(false)
      onDone()
    }
  }

  if (data.sinSuscripcion || !data.planNombre) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2.5">
          <Crown className="h-5 w-5 text-brand" />
          <h3 className="text-base font-medium text-foreground">Todavía no elegiste un plan</h3>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Estás usando Piru con acceso completo. Elegí un plan abajo para asegurar tus funciones.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-brand" />
              <h3 className="text-base font-medium text-foreground">Plan {data.planNombre}</h3>
            </div>
            {estado && (
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-medium',
                  ESTADO_TONE[estado] ?? 'bg-muted text-muted-foreground',
                )}
              >
                {ESTADO_LABEL[estado] ?? estado}
              </span>
            )}
          </div>
          {data.precioMensual && (
            <p className="text-sm text-muted-foreground">
              {fmtARS(data.precioMensual)} / mes
            </p>
          )}
          {proximo && !necesitaPago && (
            <p className="text-[13px] text-muted-foreground">Próximo cobro: {proximo}</p>
          )}
        </div>

        <Button onClick={renovar} disabled={pagando} className="shrink-0">
          {pagando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : necesitaPago ? (
            'Pagar ahora'
          ) : (
            'Renovar'
          )}
        </Button>
      </div>
    </div>
  )
}

// ── Card de saldo de mensajes (utility) ─────────────────────────────────────
function SaldoCard({
  data,
  onDone,
}: {
  data: NonNullable<ReturnType<typeof useSuscripcion>['data']>
  onDone: () => void
}) {
  const w = data.wallet
  const [recargaOpen, setRecargaOpen] = useState(false)
  const disponible = w.utility.disponible
  const cupo = w.utility.cupoPlan
  const pct = Math.min(100, Math.round((w.utility.pctConsumido || 0) * 100))

  // El Básico no incluye avisos al cliente: no tiene sentido mostrar cupo.
  const tieneAvisos = cupo > 0 || w.utility.recargaSaldo !== 0 || data.features.includes('avisos_whatsapp_cliente')

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <MessageSquare className="h-5 w-5 text-brand" />
          <div>
            <h3 className="text-base font-medium text-foreground">Saldo de avisos</h3>
            <p className="text-[13px] text-muted-foreground">Avisos por WhatsApp a tus clientes</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => setRecargaOpen(true)} className="shrink-0">
          Recargar
        </Button>
      </div>

      {tieneAvisos ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-baseline justify-between">
            <span className={cn('text-2xl font-semibold tabular-nums', disponible < 0 ? 'text-red-500' : 'text-foreground')}>
              {disponible}
            </span>
            <span className="text-[13px] text-muted-foreground">
              {cupo > 0 ? `${w.utility.consumidoCupo} / ${cupo} incluidos usados` : 'disponibles'}
            </span>
          </div>
          {cupo > 0 && (
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  pct >= 95 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-brand',
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
          {w.utility.recargaSaldo !== 0 && (
            <p className="text-[13px] text-muted-foreground">
              {w.utility.recargaSaldo > 0
                ? `Incluye ${w.utility.recargaSaldo} de recargas`
                : `Saldo negativo de ${Math.abs(w.utility.recargaSaldo)} (se descuenta de tu próxima recarga)`}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Los avisos automáticos al cliente se incluyen desde el plan Intermedio.
        </p>
      )}

      <div className="mt-4 border-t border-border/60 pt-4">
        <AutoRecargaToggle inicial={w.autoRecarga.habilitada} onDone={onDone} />
      </div>

      <RecargaSheet open={recargaOpen} onOpenChange={setRecargaOpen} />
    </div>
  )
}

function SaldoIlimitadoCard() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2.5">
        <MessageSquare className="h-5 w-5 text-brand" />
        <div>
          <h3 className="text-base font-medium text-foreground">Avisos sin tope</h3>
          <p className="text-[13px] text-muted-foreground">
            Tu plan Avanzado incluye avisos al cliente sin límite. No necesitás recargar.
          </p>
        </div>
      </div>
    </div>
  )
}

function AutoRecargaToggle({ inicial, onDone }: { inicial: boolean; onDone: () => void }) {
  const [on, setOn] = useState(inicial)
  const [saving, setSaving] = useState(false)

  const toggle = async (next: boolean) => {
    const token = useAuthStore.getState().token
    if (!token) return
    setOn(next)
    setSaving(true)
    try {
      await mensajesApi.setAutoRecarga(token, { habilitada: next })
      onDone()
    } catch {
      setOn(!next)
      toast.error('No se pudo actualizar la auto-recarga')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">Auto-recarga</p>
        <p className="text-[13px] text-muted-foreground">
          Cuando tu saldo esté por agotarse, te sugerimos recargar automáticamente.
        </p>
      </div>
      <Switch checked={on} disabled={saving} onCheckedChange={toggle} />
    </div>
  )
}

// ── Sheet de recarga (elegir pack → Checkout Pro) ───────────────────────────
function RecargaSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [packs, setPacks] = useState<PackRecarga[] | null>(null)
  const [comprando, setComprando] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return
    const token = useAuthStore.getState().token
    if (!token) return
    mensajesApi.packs(token).then((r) => setPacks(r.data)).catch(() => setPacks([]))
  }, [open])

  const comprar = async (packId: number) => {
    const token = useAuthStore.getState().token
    if (!token) return
    setComprando(packId)
    try {
      const res = await mensajesApi.recargaCheckout(token, packId)
      window.location.href = res.data.url_pago
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo iniciar el pago')
      setComprando(null)
    }
  }

  return (
    <AjusteEditor
      open={open}
      onOpenChange={onOpenChange}
      titulo="Recargar saldo de avisos"
      descripcion="Comprá un pack de avisos. El pago es único y se acredita al instante."
    >
      {packs === null ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : packs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay packs disponibles por ahora.</p>
      ) : (
        <div className="space-y-3">
          {packs.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-border p-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{p.cantidad} avisos</p>
                <p className="text-[13px] text-muted-foreground">{fmtARS(p.precio)}</p>
              </div>
              <Button onClick={() => comprar(p.id)} disabled={comprando !== null} className="shrink-0">
                {comprando === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Comprar'}
              </Button>
            </div>
          ))}
        </div>
      )}
    </AjusteEditor>
  )
}

// ── Planes disponibles (pricing con candados) ───────────────────────────────
function PlanesDisponibles({
  data,
  catalogo,
  onDone,
}: {
  data: NonNullable<ReturnType<typeof useSuscripcion>['data']>
  catalogo: PlanCatalogo[] | null
  onDone: () => void
}) {
  const [eligiendo, setEligiendo] = useState<number | null>(null)

  const elegir = async (planId: number) => {
    const token = useAuthStore.getState().token
    if (!token) return
    setEligiendo(planId)
    try {
      const res = await planesApi.suscribir(token, planId, 'mensual')
      window.location.href = res.data.url_pago
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo iniciar el pago')
      setEligiendo(null)
      onDone()
    }
  }

  if (catalogo === null) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (catalogo.length === 0) return null

  const ordenActual = catalogo.find((p) => p.id === data.planId)?.orden ?? -1

  return (
    <div className="space-y-4">
      <h3 className="text-base font-medium text-foreground">Planes</h3>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {catalogo.map((p) => {
          const esActual = p.id === data.planId && data.conAccesoAPago
          const precio = parseFloat(p.precioMensual)
          const esMejora = p.orden > ordenActual
          return (
            <div
              key={p.id}
              className={cn(
                'flex flex-col rounded-2xl border p-5',
                esActual ? 'border-brand ring-1 ring-brand' : 'border-border',
              )}
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-foreground">{p.nombre}</h4>
                {esActual && (
                  <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                    Tu plan
                  </span>
                )}
              </div>

              <p className="mt-2 text-2xl font-semibold text-foreground">
                {precio > 0 ? fmtARS(precio) : 'Gratis'}
                {precio > 0 && <span className="text-sm font-normal text-muted-foreground"> /mes</span>}
              </p>

              {p.mensajesIlimitados ? (
                <p className="mt-1 text-[13px] text-muted-foreground">Avisos al cliente sin tope</p>
              ) : p.mensajesIncluidos > 0 ? (
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {p.mensajesIncluidos} avisos al cliente / mes
                </p>
              ) : null}

              <ul className="mt-4 flex-1 space-y-2">
                {p.orden === 0 &&
                  FEATURES_BASE.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[13px] text-muted-foreground">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      {f}
                    </li>
                  ))}
                {p.orden > 0 && (
                  <li className="flex items-start gap-2 text-[13px] font-medium text-foreground">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    Todo lo del plan anterior, y además:
                  </li>
                )}
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px] text-foreground">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    {FEATURE_LABELS[f] ?? f}
                  </li>
                ))}
              </ul>

              <div className="mt-5">
                {esActual ? (
                  <Button variant="outline" disabled className="w-full">
                    <Check className="mr-1.5 h-4 w-4" /> Plan actual
                  </Button>
                ) : precio <= 0 ? (
                  <Button variant="outline" disabled className="w-full">
                    Incluido
                  </Button>
                ) : (
                  <Button
                    onClick={() => elegir(p.id)}
                    disabled={eligiendo !== null}
                    variant={esMejora ? 'default' : 'outline'}
                    className="w-full"
                  >
                    {eligiendo === p.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : esMejora ? (
                      `Mejorar a ${p.nombre}`
                    ) : (
                      'Elegir'
                    )}
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="h-3 w-3" />
        Pago seguro con Mercado Pago. Sin comisión por venta: solo la cuota mensual fija.
      </p>
    </div>
  )
}

// ── Movimientos (ledger del wallet) ─────────────────────────────────────────
const MOTIVO_LABEL = (t: any): string => {
  const tipo = t.tipo as string
  if (tipo === 'consumo') return 'Aviso enviado'
  if (tipo === 'recarga') return 'Recarga de saldo'
  if (tipo === 'renovacion_plan') return 'Avisos incluidos del plan'
  if (tipo === 'expiracion') return 'Vencimiento de saldo del ciclo'
  if (tipo === 'ajuste') return 'Ajuste'
  return tipo
}

function Movimientos() {
  const [abierto, setAbierto] = useState(false)
  const [movs, setMovs] = useState<any[] | null>(null)

  useEffect(() => {
    if (!abierto || movs !== null) return
    const token = useAuthStore.getState().token
    if (!token) return
    mensajesApi.transacciones(token, 1, 30).then((r) => setMovs(r.data)).catch(() => setMovs([]))
  }, [abierto, movs])

  return (
    <div className="space-y-3">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="flex items-center gap-1.5 text-sm font-medium text-foreground"
      >
        Movimientos de saldo
        {abierto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {abierto && (
        <div className="rounded-xl border border-border">
          {movs === null ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : movs.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Todavía no hay movimientos.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {movs.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-foreground">{MOTIVO_LABEL(m)}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(m.createdAt).toLocaleDateString('es-AR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 text-sm font-medium tabular-nums',
                      m.cantidad > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
                    )}
                  >
                    {m.cantidad > 0 ? '+' : ''}
                    {m.cantidad}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
