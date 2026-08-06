import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Check, Loader2, Lock, Crown, LogOut, RefreshCw, PauseCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { planesApi, type PlanCatalogo, type MiSuscripcion } from '@/lib/api'
import { descuentoAnualEfectivo, precioAnual } from '@/lib/utils'
import { CicloToggle } from '@/components/CicloToggle'

// ── Hard paywall: pantalla de "elegí tu plan / pagá" para locales nuevos que completaron el
//    onboarding pero todavía no tienen suscripción activa. Sin plan pago no entran al panel.
//    El gate (ProtectedLayout) manda acá y, cuando el pago se acredita (webhook), saca de acá. ──

const fmtARS = (n: number | string) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(
    typeof n === 'string' ? parseFloat(n) : n,
  )

const FEATURE_LABELS: Record<string, string> = {
  avisos_whatsapp_cliente: 'Avisos automáticos al cliente por WhatsApp',
  facturacion_arca: 'Facturación electrónica ARCA',
  rapiboy: 'Integración con Rapiboy (cadetes)',
  multisucursal: 'Múltiples sucursales',
  estadisticas_avanzadas: 'Estadísticas avanzadas',
  dominio_propio: 'Dominio propio',
  motor_recompra: 'Motor de Recompra',
}

// Base incluida en TODOS los planes. El Básico no es "pelado": ya trae todo esto. Lo listamos
// completo para que se entienda que la diferencia con el Intermedio no es "más features", sino
// el chat con el cliente (ver CHAT_NOTE abajo).
const FEATURES_BASE = [
  'Recepción de pedidos por WhatsApp + centro de pedidos',
  'Impresión automática de comandas',
  'Productos, categorías y pedidos ilimitados',
  'Variantes, extras e ingredientes',
  'Todos los métodos de pago (efectivo, transferencia, Mercado Pago, Cucuru, Talo)',
  'Cupones y promociones',
  'Estadísticas y reportes',
  'Horarios de atención y mapa de pedidos',
  'Galería de imágenes y pedido en grupo',
]

const fmtInt = (n: number) => new Intl.NumberFormat('es-AR').format(n)

export default function Suscribir() {
  const navigate = useNavigate()
  const restauranteStore = useRestauranteStore()
  const restaurante = restauranteStore.restaurante as any
  const suscripcion = restauranteStore.suscripcion as any
  const [miSub, setMiSub] = useState<MiSuscripcion | null>(null)
  // Degradación "pausada", no apagón (Claim Flow · Tarea 8): un local suspendido/cancelado NO
  // aterriza en la fría pantalla de "elegí tu plan" sino en una de reactivación que le muestra
  // los números que generó ("tenés $X en pedidos esperando reactivarse") y le recuerda que nada
  // se borra. Reactivar = un pago (el mismo flujo de abajo). Distinto del alta nueva (sinSuscripcion).
  // El estado sale del profile (store); los números (`valorPausa`) sólo de /planes/mi-suscripcion.
  const estadoSub = miSub?.estado ?? suscripcion?.estado
  const pausado = estadoSub === 'suspendida' || estadoSub === 'cancelada'
  const valorPausa = miSub?.valorPausa
  const [catalogo, setCatalogo] = useState<PlanCatalogo[] | null>(null)
  const [ciclo, setCiclo] = useState<'mensual' | 'anual'>('mensual')
  const [eligiendo, setEligiendo] = useState<number | null>(null)
  const [verificando, setVerificando] = useState(false)

  // Cargar catálogo de planes + suscripción (para los números de un local pausado, Tarea 8).
  useEffect(() => {
    const token = useAuthStore.getState().token
    if (!token) return
    planesApi.catalogo(token).then((r) => setCatalogo(r.data)).catch(() => setCatalogo([]))
    planesApi.miSuscripcion(token).then((r) => setMiSub(r.data)).catch(() => {})
  }, [])

  // Al montar refrescamos el perfil por si volvemos de MercadoPago: el pago se acredita por
  // webhook (puede tardar unos segundos), así que reintentamos escalonadamente. Cuando la
  // suscripción quede activa, el gate de ProtectedLayout nos saca solo hacia el panel.
  useEffect(() => {
    restauranteStore.fetchData()
    const timers = [1500, 4000, 8000, 15000].map((ms) =>
      setTimeout(() => restauranteStore.fetchData(), ms),
    )
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const elegir = async (planId: number) => {
    const token = useAuthStore.getState().token
    if (!token) return
    setEligiendo(planId)
    try {
      const res = await planesApi.suscribir(token, planId, ciclo)
      window.location.href = res.data.url_pago
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo iniciar el pago')
      setEligiendo(null)
    }
  }

  const verificarPago = async () => {
    setVerificando(true)
    await restauranteStore.fetchData()
    // Si sigue sin acceso, avisamos; si se activó, el gate ya redirigió.
    setTimeout(() => {
      setVerificando(false)
      const acceso = (useRestauranteStore.getState().suscripcion as any)?.accesoPanel
      if (acceso === false) toast.info('Todavía no vemos el pago acreditado. Puede tardar un momento.')
    }, 1200)
  }

  const cerrarSesion = () => {
    useAuthStore.getState().logout()
    restauranteStore.reset()
    navigate('/login')
  }

  return (
    <div className="min-h-dvh bg-background px-6 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/logopiru.jpeg" alt="Piru" className="h-9 w-auto rounded-lg" />
          </div>
          <button
            onClick={cerrarSesion}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
        </header>

        {pausado ? (
          <div className="mt-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
              <PauseCircle className="h-3.5 w-3.5" /> {restaurante?.nombre ? `${restaurante.nombre} está en pausa` : 'Tu local está en pausa'}
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
              Reactivá tu local
            </h1>
            {valorPausa && valorPausa.pedidos > 0 ? (
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                Tu local recibió <span className="font-semibold text-foreground">{fmtInt(valorPausa.pedidos)} {valorPausa.pedidos === 1 ? 'pedido' : 'pedidos'} por {fmtARS(valorPausa.monto)}</span> con Piru.
                Tu tienda, tu menú y tus clientes están intactos, esperando que reactives.
                Nada se borra: reactivá con un pago cuando quieras y seguís donde lo dejaste.
              </p>
            ) : (
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                Tu tienda, tu menú y tus clientes siguen cargados y no se borran. Reactivá tu local
                con un pago y volvés a recibir pedidos en el panel al instante, justo donde lo dejaste.
              </p>
            )}
          </div>
        ) : (
          <div className="mt-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
              <Crown className="h-3.5 w-3.5" /> {restaurante?.nombre ? `${restaurante.nombre} está casi listo` : 'Casi listo'}
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
              Activá tu local con el plan Básico
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              Tu tienda y tu menú ya están cargados. Empezá con el Básico para recibir pedidos en el
              panel: cuota fija, sin comisión por venta, mes a mes o por año (con descuento). Después
              podés mejorar tu plan cuando quieras desde el panel. Cancelás cuando quieras.
            </p>
          </div>
        )}

        <div className="mt-10">
          {catalogo === null ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : catalogo.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay planes disponibles por ahora. Escribinos y lo resolvemos.</p>
          ) : (
            <>
            {(() => {
              const descuentoMax = Math.max(0, ...catalogo.map((p) => descuentoAnualEfectivo(p.descuentoAnual)))
              return descuentoMax > 0 ? (
                <div className="mb-8 flex flex-col items-center gap-2">
                  <CicloToggle value={ciclo} onChange={setCiclo} descuentoMax={descuentoMax} />
                  <p className="text-[13px] text-muted-foreground">
                    Pagá por año y ahorrá hasta {descuentoMax}%.
                  </p>
                </div>
              ) : null
            })()}
            {(() => {
            // El plan base es el de menor orden (el Básico se seedea con orden 1, no 0).
            const ordenBase = Math.min(...catalogo.map((p) => p.orden))
            const base = catalogo.find((p) => p.orden === ordenBase)
            // Un local nuevo (sin plan) arranca SIEMPRE por el Básico: no lo hacemos elegir entre
            // tres. Después mejora desde "Tu plan" en el panel. Un local pausado reactiva el plan
            // que ya tenía (o el Básico si no lo sabemos).
            const suyo = miSub?.planId ? catalogo.find((p) => p.id === miSub.planId) : null
            const planesVisibles = (pausado ? [suyo ?? base] : [base]).filter(Boolean) as PlanCatalogo[]
            const soloUno = planesVisibles.length === 1
            return (
            <div className={cn('grid grid-cols-1 gap-4', soloUno ? 'mx-auto max-w-md' : 'lg:grid-cols-3')}>
              {planesVisibles.map((p) => {
                const precio = parseFloat(p.precioMensual)
                const destacado = soloUno || p.orden === ordenBase + 1 // el único mostrado, o Intermedio
                const desc = descuentoAnualEfectivo(p.descuentoAnual)
                const totalAnual = precioAnual(precio, desc)
                return (
                  <div
                    key={p.id}
                    className={cn(
                      'flex flex-col rounded-2xl border p-6',
                      destacado ? 'border-brand ring-1 ring-brand' : 'border-border',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold text-foreground">{p.nombre}</h3>
                      {destacado && (
                        <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand">
                          Recomendado
                        </span>
                      )}
                    </div>

                    {precio <= 0 ? (
                      <p className="mt-3 text-3xl font-semibold text-foreground">Gratis</p>
                    ) : ciclo === 'anual' ? (
                      <div className="mt-3">
                        <p className="text-3xl font-semibold text-foreground">
                          {fmtARS(totalAnual)}
                          <span className="text-sm font-normal text-muted-foreground"> /año</span>
                        </p>
                        <p className="mt-1 text-[13px] text-muted-foreground">
                          Equivale a {fmtARS(totalAnual / 12)}/mes
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
                      <p className="mt-3 text-3xl font-semibold text-foreground">
                        {fmtARS(precio)}
                        <span className="text-sm font-normal text-muted-foreground"> /mes</span>
                      </p>
                    )}

                    {p.mensajesIlimitados ? (
                      <p className="mt-1 text-[13px] text-muted-foreground">Avisos al cliente sin tope</p>
                    ) : p.mensajesIncluidos > 0 ? (
                      <p className="mt-1 text-[13px] text-muted-foreground">
                        {p.mensajesIncluidos} avisos al cliente / mes
                      </p>
                    ) : null}
                    {p.mensajesMarketingIncluidos > 0 && (
                      <p className="mt-0.5 text-[13px] text-muted-foreground">
                        {p.mensajesMarketingIncluidos} mensajes de campaña / mes
                      </p>
                    )}

                    {/* La línea divisoria real entre planes NO es "más features", es el chat con el
                        cliente. En el Básico entra un ida y vuelta por WhatsApp; del Intermedio en
                        adelante los avisos salen solos con la marca del local, sin conversación. */}
                    {p.features.includes('avisos_whatsapp_cliente') ? (
                      <p className="mt-3 rounded-lg bg-brand/5 px-3 py-2 text-[12.5px] leading-snug text-foreground">
                        <span className="font-semibold">Cero chat con el cliente:</span> los avisos
                        {' '}“en camino” y “listo para retirar” salen automáticos con tu marca (tu número,
                        nombre y logo). El cliente no tiene que escribir.
                      </p>
                    ) : p.orden === ordenBase ? (
                      <p className="mt-3 rounded-lg bg-zinc-100 px-3 py-2 text-[12.5px] leading-snug text-muted-foreground dark:bg-zinc-900">
                        El pedido te entra por WhatsApp: hay un ida y vuelta corto con el cliente para
                        avisarle cómo viene. ¿Querés cero chat, con avisos automáticos? Ese es el Intermedio.
                      </p>
                    ) : null}

                    <ul className="mt-5 flex-1 space-y-2">
                      {p.orden === ordenBase &&
                        FEATURES_BASE.map((f) => (
                          <li key={f} className="flex items-start gap-2 text-[13px] text-muted-foreground">
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                            {f}
                          </li>
                        ))}
                      {p.orden > ordenBase && (
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

                    <div className="mt-6">
                      {precio <= 0 ? (
                        <Button variant="outline" disabled className="w-full">
                          No disponible
                        </Button>
                      ) : (
                        <Button
                          onClick={() => elegir(p.id)}
                          disabled={eligiendo !== null}
                          variant={destacado ? 'default' : 'outline'}
                          className="w-full"
                        >
                          {eligiendo === p.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            `${pausado ? 'Reactivar con' : 'Activar'} ${p.nombre}`
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            )
            })()}
            </>
          )}
        </div>

        <div className="mt-8 flex flex-col items-center gap-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            Pago seguro con Mercado Pago. Sin comisión por venta: solo la cuota fija del plan.
          </p>
          <button
            onClick={verificarPago}
            disabled={verificando}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {verificando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Ya pagué, verificar
          </button>
        </div>
      </div>
    </div>
  )
}
