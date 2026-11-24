import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/settings-dialog'
import { cn } from '@/lib/utils'
import { planesTiendaApi, type PlanCodigo, type PlanTienda } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useModulosStore } from '@/store/modulosStore'
import { nombrePlan, usePlanTienda, usePlanTiendaStore } from '@/store/planTiendaStore'

/** Evolución se arma a medida: se habla con el equipo de Piru. */
const WHATSAPP_EVOLUCION =
  'https://api.whatsapp.com/send?phone=543408681915&text=Hola%2C%20quiero%20saber%20m%C3%A1s%20del%20plan%20Evoluci%C3%B3n%20de%20Piru'

const fmtARS = (monto: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(monto)

const fmtFecha = (fecha: string | null) =>
  fecha ? new Date(fecha).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' }) : null

/** Precio por mes del ciclo elegido (el anual, con su descuento). */
function precioMes(plan: PlanTienda, ciclo: 'mensual' | 'anual') {
  if (plan.precioMensual === null) return null
  return ciclo === 'anual' ? Math.round(plan.precioMensual * (1 - plan.descuentoAnual / 100)) : plan.precioMensual
}

/**
 * Planes de tienda, al estilo Tiendanube. Precios y beneficios salen de la API (`plan_tienda`).
 * Elegir un plan pago abre Mercado Pago; el plan cambia recién cuando el pago se acredita.
 */
export default function Planes() {
  const navigate = useNavigate()
  const location = useLocation()
  const token = useAuthStore((s) => s.token)
  const { plan } = usePlanTienda()
  const recargar = usePlanTiendaStore((s) => s.cargar)
  const recargarModulos = useModulosStore((s) => s.cargar)
  const [ciclo, setCiclo] = useState<'mensual' | 'anual'>('mensual')
  const [eligiendo, setEligiendo] = useState<PlanCodigo | null>(null)
  const [confirmarInicial, setConfirmarInicial] = useState(false)

  // Vuelta de Mercado Pago: el webhook puede tardar unos segundos en acreditar.
  useEffect(() => {
    if (new URLSearchParams(location.search).get('checkout') !== 'success') return
    let cancelado = false
    toast.info('Estamos verificando la acreditación de tu pago…')
    const demoras = [0, 2000, 5000, 10000]
    demoras.forEach((ms, i) => window.setTimeout(() => {
      if (cancelado) return
      void recargar(true)
      void recargarModulos(true).catch(() => {})
      if (i === demoras.length - 1) window.history.replaceState({}, '', '/dashboard/planes')
    }, ms))
    return () => { cancelado = true }
  }, [location.search, recargar, recargarModulos])

  // Evolución (los locales de siempre) sigue con su suscripción: esta pantalla no es para ellos.
  if (plan?.esLegado) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Plan Evolución</h1>
        <p className="mt-3 text-muted-foreground">Tu cuenta tiene todas las herramientas de Piru con tu suscripción de siempre.</p>
        <Button className="mt-6" variant="outline" onClick={() => navigate('/dashboard/ajustes')}>Ver mi suscripción</Button>
      </div>
    )
  }

  const elegir = async (codigo: PlanCodigo) => {
    if (!token) return
    if (codigo === 'evolucion') {
      window.open(WHATSAPP_EVOLUCION, '_blank', 'noopener')
      return
    }
    setEligiendo(codigo)
    try {
      const { data } = await planesTiendaApi.elegir(token, codigo, ciclo)
      if (data.cambio === 'pago') {
        window.location.assign(data.url_pago)
        return
      }
      if (data.cambio === 'al_fin_del_periodo') {
        toast.success('Listo', { description: `Seguís con tu plan hasta el ${fmtFecha(data.hasta) ?? 'fin del período'}; después pasás a Inicial.` })
      } else if (data.cambio === 'baja_cancelada') {
        toast.success('Seguís con tu plan', { description: 'Cancelamos el cambio a Inicial.' })
      }
      await recargar(true)
      void recargarModulos(true).catch(() => {})
    } catch (error) {
      toast.error('No pudimos cambiar el plan', { description: error instanceof Error ? error.message : 'Intentá de nuevo.' })
    } finally {
      setEligiendo(null)
      setConfirmarInicial(false)
    }
  }

  const sub = plan?.suscripcion ?? null
  const bajaProgramada = Boolean(sub?.cancelacionProgramada && plan && plan.contratado !== 'inicial')
  const hayDescuentoAnual = plan?.catalogo.some((p) => p.descuentoAnual > 0) ?? false

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Planes</h1>
        <p className="mt-4 text-muted-foreground">
          Empezá gratis y cambiá de plan cuando lo necesites. Todos tienen pedidos y productos ilimitados.
        </p>
        {plan && (
          <p className="mt-3 text-sm">
            Tu plan: <span className="font-semibold">{nombrePlan(plan, plan.efectivo)}</span>
            {plan.contratado !== plan.efectivo && (
              <span className="text-muted-foreground"> · tu plan {nombrePlan(plan, plan.contratado)} venció; renovalo para recuperar sus herramientas</span>
            )}
            {bajaProgramada && sub?.fechaProximoCobro && (
              <span className="text-muted-foreground"> · pasás a Inicial el {fmtFecha(sub.fechaProximoCobro)}</span>
            )}
          </p>
        )}
      </header>

      {hayDescuentoAnual && (
        <div className="mt-8 flex justify-center">
          <div role="radiogroup" aria-label="Ciclo de pago" className="inline-flex rounded-full border bg-background p-1 text-sm">
            {(['mensual', 'anual'] as const).map((c) => (
              <button
                key={c}
                role="radio"
                aria-checked={ciclo === c}
                onClick={() => setCiclo(c)}
                className={cn('rounded-full px-4 py-1.5 font-medium transition-colors', ciclo === c ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}
              >
                {c === 'mensual' ? 'Mensual' : 'Anual'}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {!plan
          ? Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-96 rounded-2xl" />)
          : plan.catalogo.map((p) => {
              const esActual = p.codigo === plan.efectivo
              const precio = precioMes(p, ciclo)
              const etiquetaBoton = p.codigo === 'evolucion'
                ? 'Hablar con Piru'
                : esActual
                  ? bajaProgramada ? 'Mantener este plan' : 'Tu plan'
                  : p.precioMensual === 0
                    ? 'Pasar a Inicial'
                    : (p.orden > (plan.catalogo.find((x) => x.codigo === plan.efectivo)?.orden ?? 0) ? 'Mejorar a ' : 'Cambiar a ') + p.nombre
              const deshabilitado = (esActual && !bajaProgramada) || (p.codigo === 'inicial' && bajaProgramada) || eligiendo !== null
              return (
                <div
                  key={p.codigo}
                  className={cn(
                    'relative flex flex-col rounded-2xl border bg-background p-6',
                    p.destacado && !esActual && 'border-foreground/40 shadow-sm',
                    esActual && 'border-emerald-500 ring-1 ring-emerald-500',
                  )}
                >
                  {(esActual || p.destacado) && (
                    <span className={cn('absolute -top-3 left-6 rounded-full px-2.5 py-0.5 text-xs font-medium', esActual ? 'bg-emerald-500 text-white' : 'bg-foreground text-background')}>
                      {esActual ? 'Tu plan' : 'Recomendado'}
                    </span>
                  )}
                  <h2 className="text-lg font-semibold">{p.nombre}</h2>
                  {p.descripcion && <p className="mt-1 text-sm text-muted-foreground xl:min-h-[5rem]">{p.descripcion}</p>}
                  <div className="mt-5">
                    {precio === null ? (
                      <p className="text-2xl font-semibold">A medida</p>
                    ) : precio === 0 ? (
                      <p className="text-2xl font-semibold">Gratis</p>
                    ) : (
                      <p className="text-2xl font-semibold tabular-nums">
                        {fmtARS(precio)}<span className="text-sm font-normal text-muted-foreground">/mes</span>
                      </p>
                    )}
                    {ciclo === 'anual' && precio !== null && precio > 0 && p.descuentoAnual > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">Pagando el año: {p.descuentoAnual}% menos</p>
                    )}
                  </div>
                  <Button
                    className="mt-5 w-full"
                    variant={esActual || p.codigo === 'inicial' ? 'outline' : 'default'}
                    disabled={deshabilitado || (p.precioMensual !== null && p.precioMensual > 0 && !plan.pagosDisponibles)}
                    onClick={() => (p.codigo === 'inicial' ? setConfirmarInicial(true) : void elegir(p.codigo))}
                  >
                    {eligiendo === p.codigo ? <Loader2 className="size-4 animate-spin" /> : etiquetaBoton}
                  </Button>
                  <ul className="mt-6 space-y-2.5 text-sm">
                    {p.beneficios.map((b) => (
                      <li key={b} className="flex gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Precios finales en pesos argentinos. Los avisos por WhatsApp y los mensajes de campañas se recargan aparte, en Mensajes.
      </p>

      <Dialog open={confirmarInicial} onOpenChange={setConfirmarInicial}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Pasar al plan Inicial?</DialogTitle>
            <DialogDescription>
              Seguís con todo lo de tu plan hasta el fin del período que ya pagaste. Después tu tienda sigue vendiendo con el diseño de Piru y las herramientas del plan Inicial.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmarInicial(false)}>Conservar mi plan</Button>
            <Button disabled={eligiendo !== null} onClick={() => void elegir('inicial')}>
              {eligiendo === 'inicial' ? <Loader2 className="size-4 animate-spin" /> : 'Pasar a Inicial'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
