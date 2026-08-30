import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  Loader2,
  AlertTriangle,
  Crown,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  MessageCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { TelefonoPagoOpciones } from '@/components/CheckoutSuscripcionOpciones'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { mensajesApi, type PackRecarga, type EstadisticasEnvios } from '@/lib/api'
import { AjusteEditor } from './ajustes/components/AjusteEditor'
import { SectionSkeleton } from './ajustes/components/SectionSkeleton'
import { useSuscripcion } from './ajustes/hooks/useSuscripcion'
import { useModuloActivo } from '@/store/modulosStore'

// ── Helpers ────────────────────────────────────────────────────────────────
const fmtARS = (n: number | string) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(
    typeof n === 'string' ? parseFloat(n) : n,
  )

type Sub = NonNullable<ReturnType<typeof useSuscripcion>['data']>

export default function MensajesPage() {
  const { data, loading, refetch } = useSuscripcion()
  const avisosActivos = useModuloActivo('avisos_automaticos_whatsapp')
  const crecimientoActivo = useModuloActivo('crecimiento')
  const [searchParams, setSearchParams] = useSearchParams()

  // Volver de MercadoPago tras una recarga: el saldo se acredita por webhook (unos segundos).
  useEffect(() => {
    const recarga = searchParams.get('recarga')
    if (!recarga) return
    if (recarga === 'success') toast.success('¡Pago recibido! Estamos acreditando tu saldo…')
    searchParams.delete('recarga')
    setSearchParams(searchParams, { replace: true })
    const timers = [1500, 4000, 8000].map((ms) => setTimeout(() => refetch(), ms))
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <header className="mb-8 space-y-1">
        <h1 className="text-2xl font-medium tracking-tight text-foreground">Mensajes</h1>
        <p className="text-sm font-normal text-muted-foreground">
          Tus avisos por WhatsApp a los clientes y los mensajes de campaña: cuántos enviaste, cuántos te
          quedan y cómo recargar.
        </p>
      </header>

      {loading || !data ? (
        <SectionSkeleton />
      ) : (
        <section className="space-y-8">
          <SaldoBanner data={data} />
          <EnviadosCard mostrarMarketing={mostrarMarketing(data, crecimientoActivo)} />
          {!data.wallet?.ilimitado && data.wallet && <SaldoCard data={data} avisosActivos={avisosActivos} onDone={refetch} />}
          {data.wallet?.ilimitado && <SaldoIlimitadoCard />}
          {data.wallet && mostrarMarketing(data, crecimientoActivo) && <SaldoMarketingCard data={data} />}
          <Movimientos />
        </section>
      )}
    </div>
  )
}

// ── Mensajes enviados por período ───────────────────────────────────────────
function EnviadosCard({ mostrarMarketing }: { mostrarMarketing: boolean }) {
  const [stats, setStats] = useState<EstadisticasEnvios | null>(null)

  useEffect(() => {
    const token = useAuthStore.getState().token
    if (!token) return
    mensajesApi
      .estadisticas(token)
      .then((r) => setStats(r.data))
      .catch(() => setStats(null))
  }, [])

  const u = stats?.utility ?? { hoy: 0, semana: 0, mes: 0, total: 0 }
  const m = stats?.marketing ?? { hoy: 0, semana: 0, mes: 0, total: 0 }
  // Sin Motor de Recompra los mensajes son todos avisos: mostramos una sola fila.
  const totalHoy = mostrarMarketing ? u.hoy + m.hoy : u.hoy
  const totalSemana = mostrarMarketing ? u.semana + m.semana : u.semana
  const totalMes = mostrarMarketing ? u.mes + m.mes : u.mes

  const periodos: { label: string; valor: number }[] = [
    { label: 'Hoy', valor: totalHoy },
    { label: 'Últimos 7 días', valor: totalSemana },
    { label: 'Últimos 30 días', valor: totalMes },
  ]

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2.5">
        <MessageSquare className="h-5 w-5 text-brand" />
        <div>
          <h3 className="text-base font-medium text-foreground">Mensajes enviados</h3>
          <p className="text-[13px] text-muted-foreground">Avisos por WhatsApp a tus clientes</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {periodos.map((p) => (
          <div key={p.label} className="rounded-xl border border-border/60 bg-muted/30 px-3 py-3 text-center">
            <div className="text-2xl font-semibold tabular-nums text-foreground">
              {stats === null ? '—' : p.valor}
            </div>
            <div className="mt-0.5 text-[12px] text-muted-foreground">{p.label}</div>
          </div>
        ))}
      </div>

      {mostrarMarketing && stats !== null && (
        <p className="mt-3 text-[13px] text-muted-foreground">
          En los últimos 30 días: {u.mes} avisos y {m.mes} mensajes de campaña.
        </p>
      )}
    </div>
  )
}

// ── Banner de saldo bajo / agotado ──────────────────────────────────────────
function SaldoBanner({ data }: { data: Sub }) {
  let mensaje: string | null = null
  let tono: 'warn' | 'error' = 'warn'

  if (!data.wallet?.ilimitado && data.wallet?.utility?.negativo) {
    tono = 'error'
    mensaje =
      'Te quedaste sin saldo de avisos. Los avisos siguen saliendo, pero quedan como saldo a descontar. Recargá para ponerte al día.'
  } else if (!data.wallet?.ilimitado && data.wallet?.alerta === '95') {
    mensaje = 'Te queda menos del 5% de tus avisos incluidos este mes. Considerá recargar.'
  }

  if (!mensaje) return null

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border px-4 py-3',
        tono === 'error' ? 'border-red-500/30 bg-red-500/10' : 'border-amber-500/30 bg-amber-500/10',
      )}
    >
      <AlertTriangle
        className={cn('mt-0.5 h-4 w-4 shrink-0', tono === 'error' ? 'text-red-500' : 'text-amber-500')}
      />
      <p className="text-[13px] leading-relaxed text-foreground">{mensaje}</p>
    </div>
  )
}

// ── Card de saldo de mensajes (utility) ─────────────────────────────────────
function SaldoCard({ data, avisosActivos, onDone }: { data: Sub; avisosActivos: boolean; onDone: () => void }) {
  const w = data.wallet
  const [recargaOpen, setRecargaOpen] = useState(false)
  const disponible = w.utility.disponible
  const cupo = w.utility.cupoPlan
  const pct = Math.min(100, Math.round((w.utility.pctConsumido || 0) * 100))

  const tieneAvisos = avisosActivos || cupo > 0 || w.utility.recargaSaldo !== 0

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
          Activá Avisos automáticos por WhatsApp desde Módulos para enviar notificaciones a tus clientes.
        </p>
      )}

      {w.autoRecarga.habilitada && w.autoRecarga.sugerida && (
        <AutoRecargaPrompt onRecargar={() => setRecargaOpen(true)} />
      )}

      <div className="mt-4 border-t border-border/60 pt-4">
        <AutoRecargaToggle inicial={w.autoRecarga.habilitada} onDone={onDone} />
      </div>

      <RecargaSheet open={recargaOpen} onOpenChange={setRecargaOpen} telefonoCuenta={data.telefonoPago} />
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
            Tu cuenta tiene avisos al cliente sin límite. No necesitás recargar.
          </p>
        </div>
      </div>
    </div>
  )
}

// Mostrar el saldo de marketing sólo si Motor está activo o ya hay saldo de campaña.
function mostrarMarketing(data: Sub, motorActivo: boolean): boolean {
  const w = data.wallet
  if (!w?.marketing) return false
  return motorActivo || w.marketing.cupoPlan > 0 || w.marketing.recargaSaldo !== 0
}

// ── Card de saldo de mensajes de MARKETING (Motor de Recompra) ──────────────
function SaldoMarketingCard({ data }: { data: Sub }) {
  const w = data.wallet
  const [recargaOpen, setRecargaOpen] = useState(false)
  const disponible = w.marketing.disponible
  const cupo = w.marketing.cupoPlan
  const pct = cupo > 0 ? Math.min(100, Math.round((w.marketing.consumidoCupo / cupo) * 100)) : 0

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Crown className="h-5 w-5 text-brand" />
          <div>
            <h3 className="text-base font-medium text-foreground">Mensajes de campaña</h3>
            <p className="text-[13px] text-muted-foreground">Para el Motor de Recompra</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => setRecargaOpen(true)} className="shrink-0">
          Comprar
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <span className={cn('text-2xl font-semibold tabular-nums', disponible < 0 ? 'text-red-500' : 'text-foreground')}>
            {disponible}
          </span>
          <span className="text-[13px] text-muted-foreground">
            {cupo > 0 ? `${w.marketing.consumidoCupo} / ${cupo} incluidos usados` : 'disponibles'}
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
        {w.marketing.recargaSaldo !== 0 && (
          <p className="text-[13px] text-muted-foreground">
            {w.marketing.recargaSaldo > 0
              ? `Incluye ${w.marketing.recargaSaldo} de packs comprados`
              : `Saldo negativo de ${Math.abs(w.marketing.recargaSaldo)} (se descuenta de tu próxima compra)`}
          </p>
        )}
      </div>

      <RecargaSheet open={recargaOpen} onOpenChange={setRecargaOpen} categoria="marketing" telefonoCuenta={data.telefonoPago} />
    </div>
  )
}

// Auto-recarga asistida: cuando el saldo cruza el umbral y la auto-recarga está activa,
// avisamos y ofrecemos recargar. El pago siempre se resuelve por el link de WhatsApp
// (no hay débito automático sin card-on-file).
function AutoRecargaPrompt({ onRecargar }: { onRecargar: () => void }) {
  return (
    <div className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-brand/[0.06] px-4 py-3">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-foreground">Tu saldo está por agotarse</p>
        <p className="text-[13px] text-muted-foreground">
          Recargá para seguir sin cortes — te enviamos el link de pago a tu WhatsApp.
        </p>
      </div>
      <Button onClick={onRecargar} className="shrink-0">
        Recargar
      </Button>
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
          Cuando tu saldo esté por agotarse, te dejamos la recarga lista para pagar en un toque.
        </p>
      </div>
      <Switch checked={on} disabled={saving} onCheckedChange={toggle} />
    </div>
  )
}

// ── Sheet de recarga (elegir pack → Checkout Pro) ───────────────────────────
function RecargaSheet({
  open,
  onOpenChange,
  categoria = 'utility',
  telefonoCuenta,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  categoria?: 'utility' | 'marketing'
  telefonoCuenta?: string | null
}) {
  const [packs, setPacks] = useState<PackRecarga[] | null>(null)
  const [enviandoLink, setEnviandoLink] = useState<number | null>(null)
  const [usarOtroTelefono, setUsarOtroTelefono] = useState(!telefonoCuenta)
  const [otroTelefono, setOtroTelefono] = useState('')
  const esMarketing = categoria === 'marketing'
  const unidad = esMarketing ? 'mensajes de campaña' : 'avisos'

  useEffect(() => {
    if (!open) return
    const token = useAuthStore.getState().token
    if (!token) return
    mensajesApi.packs(token, categoria).then((r) => setPacks(r.data)).catch(() => setPacks([]))
  }, [open, categoria])

  // Envía el link de pago al WhatsApp del dueño para pagar desde el celular (único camino de pago).
  const enviarLink = async (packId: number) => {
    const token = useAuthStore.getState().token
    if (!token) return
    if (usarOtroTelefono && otroTelefono.replace(/\D/g, '').length < 8) {
      toast.error('Ingresá un número de WhatsApp válido')
      return
    }
    setEnviandoLink(packId)
    try {
      const res = await mensajesApi.enviarPagoLinkWhatsapp(
        token,
        packId,
        usarOtroTelefono ? { telefonoDestino: otroTelefono } : undefined,
      )
      toast.success(`Te enviamos el link de pago a WhatsApp (${res.data.telefono})`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo enviar el link por WhatsApp')
    } finally {
      setEnviandoLink(null)
    }
  }

  return (
    <AjusteEditor
      open={open}
      onOpenChange={onOpenChange}
      titulo={esMarketing ? 'Comprar mensajes de campaña' : 'Recargar saldo de avisos'}
      descripcion={
        esMarketing
          ? 'Comprá un pack de mensajes de marketing para tus campañas del Motor de Recompra. Te enviamos el link de pago a tu WhatsApp para pagar desde el celular. El pago es único y se acredita al instante.'
          : 'Comprá un pack de avisos. Te enviamos el link de pago a tu WhatsApp para pagar desde el celular. El pago es único y se acredita al instante.'
      }
    >
      {packs === null ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : packs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay packs disponibles por ahora.</p>
      ) : (
        <div className="space-y-5">
          <TelefonoPagoOpciones
            telefonoCuenta={telefonoCuenta}
            usarOtroTelefono={usarOtroTelefono}
            onUsarOtroTelefono={setUsarOtroTelefono}
            otroTelefono={otroTelefono}
            onOtroTelefono={setOtroTelefono}
            radioName={`telefono-recarga-${categoria}`}
          />
          <div className="space-y-3">
            {packs.map((p) => (
              <div key={p.id} className="space-y-3 rounded-xl bg-muted/40 p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{p.cantidad} {unidad}</p>
                <p className="text-[13px] text-muted-foreground">{fmtARS(p.precio)}</p>
              </div>
              <Button
                onClick={() => enviarLink(p.id)}
                disabled={enviandoLink !== null}
                className="w-full"
              >
                {enviandoLink === p.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <MessageCircle className="mr-2 h-4 w-4" /> Recibir link de pago por WhatsApp
                  </>
                )}
              </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </AjusteEditor>
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
