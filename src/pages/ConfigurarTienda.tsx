import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ArrowRight,
  Bike,
  Check,
  Coffee,
  Drumstick,
  Hamburger,
  Pizza,
  Store,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ApiError, planesTiendaApi, type Rubro } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { usePlanTienda, usePlanTiendaStore } from '@/store/planTiendaStore'

interface Opcion<T extends string> {
  id: T
  titulo: string
  detalle: string
  Icon: LucideIcon
}

const RUBROS: Opcion<Rubro>[] = [
  { id: 'hamburgueseria', titulo: 'Hamburguesería', detalle: 'Hamburguesas, papas y bebidas.', Icon: Hamburger },
  { id: 'pizzeria', titulo: 'Pizzería', detalle: 'Pizzas, fainá y empanadas.', Icon: Pizza },
  { id: 'rotiseria', titulo: 'Rotisería', detalle: 'Platos del día, pollo, tartas y empanadas.', Icon: Drumstick },
  { id: 'cafeteria', titulo: 'Cafetería', detalle: 'Café, pastelería y algo salado.', Icon: Coffee },
  { id: 'otro', titulo: 'Otro tipo de comida', detalle: 'Te cargamos una carta general.', Icon: UtensilsCrossed },
]

type Entrega = 'takeaway' | 'delivery'
const ENTREGAS: Opcion<Entrega>[] = [
  { id: 'takeaway', titulo: 'Retiro en el local', detalle: 'El cliente pide y pasa a buscar su pedido.', Icon: Store },
  { id: 'delivery', titulo: 'Delivery', detalle: 'Llevás el pedido a domicilio, con tus zonas y precios.', Icon: Bike },
]

const PASOS = 2

/**
 * Las dos preguntas que siguen a "Crear tienda gratis" (como las pantallas iniciales de Tiendanube):
 * qué tipo de local es y cómo entrega. El rubro decide los productos de ejemplo con los que arranca
 * la carta; las entregas, qué tipos de pedido quedan activos. "Omitir" también configura (con una
 * carta general y retiro en el local), así el panel nunca vuelve a preguntar.
 */
export default function ConfigurarTienda() {
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.token)
  const nombre = useAuthStore((s) => (s.restaurante as { nombre?: string } | null)?.nombre ?? null)
  const fetchRestaurante = useRestauranteStore((s) => s.fetchData)
  const { plan, pasos } = usePlanTienda()
  const recargarPlan = usePlanTiendaStore((s) => s.cargar)

  const [paso, setPaso] = useState(1)
  const [rubro, setRubro] = useState<Rubro | null>(null)
  const [entregas, setEntregas] = useState<Set<Entrega>>(() => new Set(['takeaway']))
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle('dark', isDark)
  }, [])

  // Evolución no tiene alta self-serve, y una tienda configurada no vuelve a preguntar (salvo la
  // que se acaba de configurar acá, que sigue a Primeros pasos).
  if (!enviando && (plan?.esLegado || pasos?.configurada)) return <Navigate to="/dashboard" replace />

  const terminar = async (config: { rubro: Rubro; entregas: Set<Entrega> }) => {
    if (!token || enviando) return
    setEnviando(true)
    try {
      const { data } = await planesTiendaApi.configuracionInicial(token, {
        rubro: config.rubro,
        delivery: config.entregas.has('delivery'),
        takeaway: config.entregas.has('takeaway'),
      })
      await Promise.all([recargarPlan(true), fetchRestaurante()])
      toast.success('¡Listo! Tu tienda ya tiene forma', {
        description: data.productosEjemplo > 0
          ? `Cargamos ${data.productosEjemplo} productos de ejemplo para que veas cómo queda.`
          : 'Seguí con los primeros pasos para dejarla lista.',
      })
      navigate('/dashboard/primeros-pasos', { replace: true })
    } catch (error) {
      toast.error('No pudimos guardar tus respuestas', {
        description: error instanceof ApiError ? error.message : 'Revisá tu conexión e intentá de nuevo.',
      })
      setEnviando(false)
    }
  }

  const toggleEntrega = (id: Entrega) =>
    setEntregas((prev) => {
      const nuevo = new Set(prev)
      if (nuevo.has(id)) nuevo.delete(id)
      else nuevo.add(id)
      return nuevo
    })

  const puedeSeguir = paso === 1 ? rubro !== null : entregas.size > 0
  const continuar = () => {
    if (!puedeSeguir) return
    if (paso === 1) setPaso(2)
    else void terminar({ rubro: rubro!, entregas })
  }
  // Omitir no deja la tienda a medias: usa la carta general y retiro en el local.
  const omitir = () => {
    if (paso === 1) {
      setRubro((r) => r ?? 'otro')
      setPaso(2)
    } else {
      void terminar({ rubro: rubro ?? 'otro', entregas: entregas.size > 0 ? entregas : new Set(['takeaway']) })
    }
  }

  return (
    <div className="min-h-dvh flex flex-col w-full bg-background px-6 selection:bg-orange-500/10 selection:text-[#FF7A00]">
      <header className="w-full max-w-lg mx-auto flex items-center justify-between pt-7">
        <img src="/logopiru.jpeg" alt="Piru" className="h-9 w-auto rounded-xl" />
        <span className="text-sm tabular-nums text-muted-foreground">Paso {paso} de {PASOS}</span>
      </header>

      <main className="flex-1 flex flex-col w-full max-w-lg mx-auto py-10">
        <div className="flex gap-1.5" aria-hidden>
          {Array.from({ length: PASOS }, (_, i) => (
            <span key={i} className={cn('h-1 flex-1 rounded-full transition-colors duration-500', i < paso ? 'bg-[#FF7A00]' : 'bg-muted')} />
          ))}
        </div>

        <div key={paso} className="mt-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          {paso === 1 ? (
            <>
              <h1 className="text-[1.75rem] leading-[1.15] font-semibold tracking-tight text-balance">
                ¿Qué tipo de local {nombre ? <>es <span className="text-[#FF7A00]">{nombre}</span></> : 'tenés'}?
              </h1>
              <p className="text-[15px] text-muted-foreground mt-2">
                Con esto armamos tu carta con productos de ejemplo, para que veas cómo queda tu tienda desde el primer minuto.
              </p>
              <div role="radiogroup" aria-label="Tipo de local" className="mt-7 grid gap-2.5">
                {RUBROS.map((o) => (
                  <TarjetaOpcion key={o.id} opcion={o} rol="radio" elegida={rubro === o.id} onElegir={() => setRubro(o.id)} />
                ))}
              </div>
            </>
          ) : (
            <>
              <h1 className="text-[1.75rem] leading-[1.15] font-semibold tracking-tight text-balance">
                ¿Cómo le entregás a tus clientes?
              </h1>
              <p className="text-[15px] text-muted-foreground mt-2">
                Elegí una o las dos. Las zonas y precios de delivery los configurás después.
              </p>
              <div role="group" aria-label="Formas de entrega" className="mt-7 grid gap-2.5">
                {ENTREGAS.map((o) => (
                  <TarjetaOpcion key={o.id} opcion={o} rol="checkbox" elegida={entregas.has(o.id)} onElegir={() => toggleEntrega(o.id)} />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="mt-auto pt-10 flex items-center gap-3">
          {paso > 1 && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={enviando}
              onClick={() => setPaso((p) => p - 1)}
              className="h-12 rounded-2xl px-5"
            >
              <ArrowLeft className="size-4" />
              Volver
            </Button>
          )}
          <Button
            type="button"
            size="lg"
            disabled={!puedeSeguir || enviando}
            onClick={continuar}
            className="h-12 rounded-2xl px-6 font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white shadow-none active:scale-[0.985] disabled:opacity-40"
          >
            {enviando ? 'Armando tu tienda…' : paso === PASOS ? 'Terminar' : 'Continuar'}
            {!enviando && <ArrowRight className="size-4" />}
          </Button>
          <button
            type="button"
            onClick={omitir}
            disabled={enviando}
            className="ml-auto text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          >
            Omitir
          </button>
        </div>
      </main>
    </div>
  )
}

function TarjetaOpcion<T extends string>({
  opcion,
  rol,
  elegida,
  onElegir,
}: {
  opcion: Opcion<T>
  rol: 'radio' | 'checkbox'
  elegida: boolean
  onElegir: () => void
}) {
  const { Icon } = opcion
  return (
    <button
      type="button"
      role={rol}
      aria-checked={elegida}
      onClick={onElegir}
      className={cn(
        'group flex w-full items-center gap-4 rounded-2xl border px-4 py-3.5 text-left transition-all duration-200 active:scale-[0.99]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7A00]/50',
        elegida
          ? 'border-[#FF7A00] bg-[#FF7A00]/[0.06] shadow-[0_0_0_1px_#FF7A00]'
          : 'border-border hover:border-foreground/20 hover:bg-muted/40',
      )}
    >
      <span
        className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors',
          elegida ? 'bg-[#FF7A00] text-white' : 'bg-muted text-foreground/70 group-hover:text-foreground',
        )}
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-foreground">{opcion.titulo}</span>
        <span className="block text-[13px] text-muted-foreground">{opcion.detalle}</span>
      </span>
      <span
        aria-hidden
        className={cn(
          'flex size-5 shrink-0 items-center justify-center border transition-colors',
          rol === 'radio' ? 'rounded-full' : 'rounded-md',
          elegida ? 'border-[#FF7A00] bg-[#FF7A00] text-white' : 'border-muted-foreground/40',
        )}
      >
        {elegida && <Check className="size-3" strokeWidth={3} />}
      </span>
    </button>
  )
}
