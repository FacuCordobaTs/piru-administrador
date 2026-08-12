import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Check, ChevronDown, ChevronUp, Crown, Loader2, Lock, LogOut, MessageCircle, PauseCircle, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { descuentoAnualEfectivo, precioAnual } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { planesApi, type MiSuscripcion, type PlanCatalogo } from '@/lib/api'
import { CicloToggle, type Ciclo } from '@/components/CicloToggle'

const fmtARS = (n: number | string) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(typeof n === 'string' ? parseFloat(n) : n)
const fmtInt = (n: number) => new Intl.NumberFormat('es-AR').format(n)

const FEATURES_BASE = [
  'Pedidos por WhatsApp y centro de pedidos', 'Impresión automática de comandas',
  'Productos, categorías y pedidos ilimitados', 'Variantes, extras e ingredientes',
  'Todos los métodos de pago', 'Cupones, promociones y horarios',
  'Estadísticas y reportes', 'Galería de imágenes y pedido en grupo',
]

// El alta activa siempre el Básico. Los siguientes pasos se presentan dentro de “Tu plan”,
// una vez que el local ya está operando y el valor del upgrade es tangible.
export default function Suscribir() {
  const navigate = useNavigate()
  const restauranteStore = useRestauranteStore()
  const restaurante = restauranteStore.restaurante as any
  const suscripcion = restauranteStore.suscripcion as any
  const [miSub, setMiSub] = useState<MiSuscripcion | null>(null)
  const [catalogo, setCatalogo] = useState<PlanCatalogo[] | null>(null)
  const [ciclo, setCiclo] = useState<Ciclo>('mensual')
  const [eligiendo, setEligiendo] = useState<number | null>(null)
  const [verificando, setVerificando] = useState(false)
  const estado = miSub?.estado ?? suscripcion?.estado
  const pausado = estado === 'suspendida' || estado === 'cancelada'

  useEffect(() => {
    const token = useAuthStore.getState().token
    if (!token) return
    planesApi.catalogo(token).then((r) => setCatalogo(r.data)).catch(() => setCatalogo([]))
    planesApi.miSuscripcion(token).then((r) => setMiSub(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    restauranteStore.fetchData()
    const timers = [1500, 4000, 8000, 15000].map((ms) => setTimeout(() => restauranteStore.fetchData(), ms))
    return () => timers.forEach(clearTimeout)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const elegir = async (planId: number) => {
    const token = useAuthStore.getState().token
    if (!token) return
    setEligiendo(planId)
    try {
      const res = await planesApi.enviarPagoLinkWhatsapp(token, planId, ciclo)
      toast.success(`Te enviamos el link de pago a tu WhatsApp (${res.data.telefono})`)
    } catch (e: any) { toast.error(e?.message || 'No se pudo enviar el link por WhatsApp') }
    finally { setEligiendo(null) }
  }

  const verificarPago = async () => {
    setVerificando(true)
    await restauranteStore.fetchData()
    setTimeout(() => {
      setVerificando(false)
      if ((useRestauranteStore.getState().suscripcion as any)?.accesoPanel === false) toast.info('Todavía no vemos el pago acreditado. Puede tardar un momento.')
    }, 1200)
  }

  const cerrarSesion = () => {
    useAuthStore.getState().logout()
    restauranteStore.reset()
    navigate('/login')
  }

  const planActual = miSub?.planId ? catalogo?.find((p) => p.id === miSub.planId) : undefined
  const base = catalogo ? [...catalogo].sort((a, b) => a.orden - b.orden)[0] : undefined
  const plan = pausado ? planActual ?? base : base
  const descuentoMax = Math.max(0, ...(catalogo ?? []).map((p) => descuentoAnualEfectivo(p.descuentoAnual)))

  return <main className="min-h-dvh bg-background px-5 pb-12 pt-6 sm:px-8">
    <header className="mx-auto flex max-w-5xl items-center justify-between">
      <img src="/logopiru.jpeg" alt="Piru" className="h-9 w-auto rounded-lg" />
      <button onClick={cerrarSesion} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"><LogOut className="h-4 w-4" />Cerrar sesión</button>
    </header>

    <section className="mx-auto max-w-2xl pt-16 text-center sm:pt-20">
      {pausado ? <>
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground"><PauseCircle className="h-4 w-4" />{restaurante?.nombre ? `${restaurante.nombre} está en pausa` : 'Tu local está en pausa'}</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Reactivá tu local</h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {miSub?.valorPausa && miSub.valorPausa.pedidos > 0 ? <>Tu local recibió <strong className="font-medium text-foreground">{fmtInt(miSub.valorPausa.pedidos)} pedidos por {fmtARS(miSub.valorPausa.monto)}</strong> con Piru. Tu tienda, menú y clientes siguen intactos.</> : 'Tu tienda, tu menú y tus clientes siguen cargados. Reactivá con un pago y volvés a recibir pedidos justo donde lo dejaste.'}
        </p>
      </> : <>
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Crown className="h-4 w-4" />{restaurante?.nombre ? `${restaurante.nombre} está casi listo` : 'Casi listo'}</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Empezá a recibir pedidos</h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">Activá tu local con una cuota fija, sin comisión por venta. Después podés mejorar tu plan cuando el local lo necesite.</p>
      </>}
    </section>

    <section className="mx-auto mt-12 max-w-md">
      {catalogo === null ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      : !plan ? <p className="text-center text-sm text-muted-foreground">No hay planes disponibles por ahora. Escribinos y lo resolvemos.</p>
      : <>
        {descuentoMax > 0 && <div className="mb-8 text-center"><CicloToggle value={ciclo} onChange={setCiclo} descuentoMax={descuentoMax} /><p className="mt-2 text-xs text-muted-foreground">Pagá por año y ahorrá hasta {descuentoMax}%.</p></div>}
        <PlanInicio plan={plan} ciclo={ciclo} eligiendo={eligiendo} onElegir={elegir} pausado={pausado} />
      </>}
      <div className="mt-10 flex flex-col items-center gap-4"><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="h-3 w-3" />Pago seguro con Mercado Pago. Sin comisión por venta.</p><button onClick={verificarPago} disabled={verificando} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50">{verificando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}Ya pagué, verificar</button></div>
    </section>
  </main>
}

function PlanInicio({ plan, ciclo, eligiendo, onElegir, pausado }: { plan: PlanCatalogo; ciclo: Ciclo; eligiendo: number | null; onElegir: (id: number) => void; pausado: boolean }) {
  const [detalles, setDetalles] = useState(false)
  const precio = parseFloat(plan.precioMensual)
  const desc = descuentoAnualEfectivo(plan.descuentoAnual)
  const total = precioAnual(precio, desc)
  return <article className="border-y border-border py-7 text-center">
    <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Tu punto de partida</p>
    <h2 className="mt-2 text-3xl font-semibold tracking-tight">{plan.nombre}</h2>
    <p className="mt-3 text-3xl font-semibold">{ciclo === 'anual' ? fmtARS(total) : fmtARS(precio)}<span className="text-base font-normal text-muted-foreground"> {ciclo === 'anual' ? '/ año' : '/ mes'}</span></p>
    {ciclo === 'anual' && <p className="mt-1 text-xs text-muted-foreground">Equivale a {fmtARS(total / 12)}/mes{desc > 0 ? ` · ahorrás ${desc}%` : ''}</p>}
    <p className="mx-auto mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">Todo lo necesario para vender directo: recibí pedidos, cobralos y organizá la cocina desde un solo lugar.</p>
    <button onClick={() => setDetalles(!detalles)} className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">{detalles ? 'Ocultar lo que incluye' : 'Ver qué incluye'}{detalles ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>
    {detalles && <ul className="mx-auto mt-4 grid max-w-sm gap-2 border-l border-border pl-4 text-left text-sm text-muted-foreground">{FEATURES_BASE.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{f}</li>)}</ul>}
    <div className="mt-7"><Button onClick={() => onElegir(plan.id)} disabled={eligiendo !== null} className="w-full">{eligiendo === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><MessageCircle className="h-4 w-4" />{pausado ? 'Recibir link para reactivar' : 'Recibir link para activar mi local'}</>}</Button><p className="mt-2 text-xs text-muted-foreground">Te enviamos el link al WhatsApp del local.</p></div>
  </article>
}
