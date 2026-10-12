import { useMemo, useRef, useState, type PointerEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Dialog } from 'radix-ui'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CircleCheck,
  CircleHelp,
  LayoutDashboard,
  MapPin,
  MessageCircle,
  Package,
  PanelLeft,
  Sparkles,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { esSesionDemo } from '@/lib/api'
import { marcarRecorridoVisto, useRecorridoPanel, whatsappDemo } from '@/lib/recorridoPanel'
import { useAuthStore } from '@/store/authStore'
import { useDatosEjemplo } from '@/store/datosEjemploStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { ViajePedido } from '@/components/guia/escenas/ViajePedido'
import { ListaPedidos } from '@/components/guia/escenas/ListaPedidos'
import { ProductoOpciones } from '@/components/guia/escenas/ProductoOpciones'
import { CajaTurno } from '@/components/guia/escenas/CajaTurno'
import { PedidoWhatsapp } from '@/components/guia/escenas/PedidoWhatsapp'
import { MenuLateral } from './escenas/MenuLateral'
import { ClientesEjemplo } from './escenas/ClientesEjemplo'
import { DatosEjemplo } from './escenas/DatosEjemplo'
import { pasosDelRecorrido, type ClaveEscena, type PasoRecorrido } from './pasos'
import './recorrido.css'

const ICONOS: Record<string, LucideIcon> = {
  bienvenida: Sparkles,
  inicio: LayoutDashboard,
  navegacion: PanelLeft,
  carta: Package,
  clientes: Users,
  caja: TrendingUp,
  ejemplo: CircleHelp,
  listo: CircleCheck,
}

function EscenaDelPaso({ clave }: { clave: ClaveEscena }) {
  switch (clave) {
    case 'viaje':
      return <ViajePedido siempreActiva />
    case 'inicio':
      return <ListaPedidos siempreActiva />
    case 'menu-lateral':
      return <MenuLateral siempreActiva />
    case 'carta':
      return <ProductoOpciones siempreActiva />
    case 'clientes':
      return <ClientesEjemplo siempreActiva />
    case 'caja':
      return <CajaTurno siempreActiva />
    case 'ejemplo':
      return <DatosEjemplo siempreActiva />
    case 'whatsapp':
      return <PedidoWhatsapp siempreActiva />
  }
}

function Progreso({
  pasos,
  actual,
  ir,
  className,
}: {
  pasos: PasoRecorrido[]
  actual: number
  ir: (i: number) => void
  className?: string
}) {
  return (
    <div className={cn('flex flex-1 items-center gap-1.5', className)}>
      {pasos.map((p, j) => (
        <button
          key={p.id}
          type="button"
          onClick={() => ir(j)}
          aria-label={`Paso ${j + 1}: ${p.etiqueta}`}
          aria-current={j === actual ? 'step' : undefined}
          className="relative h-6 flex-1"
        >
          <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-ink/10">
            <span
              key={j === actual ? `actual-${actual}` : 'fijo'}
              className={cn(
                'block h-full rounded-full bg-brand',
                j < actual ? 'w-full' : j === actual ? 'rp-progreso w-full' : 'w-0',
              )}
            />
          </span>
        </button>
      ))}
    </div>
  )
}

/**
 * El recorrido de bienvenida del panel: cuando alguien entra por la demo de prospección se abre solo
 * (DashboardLayout) y, a pedido, desde "Ver recorrido" del menú. Explica primero el Inicio y cómo
 * moverse y después lo básico: la carta, los clientes, la caja y los datos de ejemplo. Cerrarlo de
 * cualquier forma lo marca como visto para ese local, en este navegador.
 */
export default function RecorridoPanel() {
  const { abierto, vez, cerrar } = useRecorridoPanel()
  const token = useAuthStore((s) => s.token)
  const restauranteId = useAuthStore((s) => s.restaurante?.id ?? null)
  const local = useRestauranteStore((s) => s.restaurante?.nombre ?? null)
  const hayEjemplo = useDatosEjemplo((s) => s.estado?.hay)
  const demo = esSesionDemo(token)
  // El paso de los datos de ejemplo sólo si hay: en la demo se da por hecho hasta saber lo contrario.
  const conEjemplo = hayEjemplo ?? demo
  const pasos = useMemo(() => pasosDelRecorrido({ local, demo, conEjemplo }), [local, demo, conEjemplo])
  const [i, setI] = useState(0)
  const [dir, setDir] = useState<1 | -1>(1)
  // Cada apertura empieza del principio (sin efecto: el reinicio ocurre antes de pintar).
  const [apertura, setApertura] = useState(vez)
  if (apertura !== vez) {
    setApertura(vez)
    setI(0)
    setDir(1)
  }
  const siguiente = useRef<HTMLButtonElement>(null)
  const toque = useRef<number | null>(null)
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const paso = pasos[Math.min(i, pasos.length - 1)]
  const ultimo = i >= pasos.length - 1
  const Icono = ICONOS[paso.id] ?? Sparkles

  function ir(j: number) {
    if (j < 0 || j >= pasos.length || j === i) return
    setDir(j > i ? 1 : -1)
    setI(j)
  }
  function terminar() {
    if (restauranteId != null) marcarRecorridoVisto(restauranteId)
    cerrar()
  }
  function leerGuia() {
    terminar()
    navigate('/dashboard/guia', { state: { volver: pathname + search } })
  }
  // Deslizar con el dedo sobre la ilustración también avanza o vuelve.
  function empezarToque(e: PointerEvent) {
    if (e.pointerType !== 'mouse') toque.current = e.clientX
  }
  function terminarToque(e: PointerEvent) {
    if (toque.current === null) return
    const dx = e.clientX - toque.current
    toque.current = null
    if (dx < -50) ir(i + 1)
    else if (dx > 50) ir(i - 1)
  }

  return (
    <Dialog.Root open={abierto} onOpenChange={(o) => !o && terminar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="rp-fondo fixed inset-0 z-[80] bg-[#120F0D]/60 backdrop-blur-[3px]" />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            siguiente.current?.focus({ preventScroll: true })
          }}
          onPointerDownOutside={(e) => e.preventDefault()}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') ir(i + 1)
            else if (e.key === 'ArrowLeft') ir(i - 1)
          }}
          className="rp-caja fixed inset-0 z-[90] flex flex-col overflow-hidden bg-paper font-sans text-ink outline-none md:inset-auto md:left-1/2 md:top-1/2 md:h-[min(620px,calc(100dvh-48px))] md:w-[min(1000px,calc(100vw-48px))] md:-translate-x-1/2 md:-translate-y-1/2 md:flex-row md:rounded-[28px] md:shadow-[0_40px_100px_-30px_rgb(0_0_0/.55)]"
        >
          <Dialog.Title className="sr-only">Recorrido por el panel de Piru</Dialog.Title>

          <div
            className="escenario relative h-[46dvh] min-h-[250px] shrink-0 overflow-hidden md:h-auto md:min-h-0 md:w-[54%]"
            style={{ touchAction: 'pan-y' }}
            onPointerDown={empezarToque}
            onPointerUp={terminarToque}
            onPointerCancel={() => (toque.current = null)}
          >
            <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-3 px-4 pt-[max(12px,env(safe-area-inset-top))] md:hidden">
              <Progreso pasos={pasos} actual={i} ir={ir} />
              {!ultimo && (
                <button
                  type="button"
                  onClick={terminar}
                  className="min-h-9 rounded-full bg-white/80 px-3 text-[13px] font-semibold text-ink-2 ring-1 ring-line backdrop-blur"
                >
                  Saltar
                </button>
              )}
            </div>
            <div className="rp-marco absolute inset-x-0 bottom-7 top-14 px-5 md:inset-0 md:bottom-8 md:p-10">
              <div key={`${apertura}-${paso.id}`} className="rp-escena grid h-full place-items-center">
                <EscenaDelPaso clave={paso.escena} />
              </div>
            </div>
            <span className="absolute bottom-2.5 right-4 text-[10.5px] font-medium text-ink-3">Datos de ejemplo</span>
          </div>

          <div className="flex min-h-0 flex-1 flex-col px-6 pb-[max(20px,env(safe-area-inset-bottom))] pt-5 md:px-10 md:pb-9 md:pt-9">
            <div className="hidden min-h-9 items-center justify-between md:flex">
              <p className="text-[13px] font-semibold tabular-nums text-ink-3">
                Paso {i + 1} de {pasos.length}
              </p>
              {!ultimo && (
                <button
                  type="button"
                  onClick={terminar}
                  className="min-h-9 rounded-full px-3 text-sm font-semibold text-ink-3 hover:bg-sand hover:text-ink"
                >
                  Saltar
                </button>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto md:mt-8" aria-live="polite">
              <div key={`${apertura}-${paso.id}`} data-dir={dir} className="rp-texto">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-deep">
                    <Icono size={14} strokeWidth={2.3} />
                    {paso.etiqueta}
                  </span>
                </p>
                <h2 className="mt-4 text-[26px] font-bold leading-[1.12] tracking-tight text-ink md:text-[34px]">
                  {paso.titulo}
                </h2>
                <p className="mt-3 text-[15.5px] leading-relaxed text-ink-2 md:mt-4 md:text-[17px]">{paso.texto}</p>
                {paso.donde && (
                  <p className="mt-4 flex items-center gap-2 text-sm text-ink-3">
                    <MapPin size={15} className="shrink-0 text-brand" />
                    <span>
                      Lo encontrás en <strong className="font-semibold text-ink">{paso.donde}</strong>
                    </span>
                  </p>
                )}
              </div>
            </div>
            <Progreso pasos={pasos} actual={i} ir={ir} className="mt-6 hidden flex-none md:flex" />
            {ultimo && (
              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                {demo && (
                  <a
                    href={whatsappDemo(local)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-4 text-[15px] font-semibold text-ink ring-1 ring-line hover:bg-sand sm:px-5"
                  >
                    <MessageCircle size={16} />
                    Hablar con Facu
                  </a>
                )}
                <button
                  type="button"
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-4 text-[15px] font-semibold text-ink ring-1 ring-line hover:bg-sand sm:px-5"
                  onClick={leerGuia}
                >
                  <BookOpen size={16} />
                  Leer la guía
                </button>
              </div>
            )}
            <div className={cn('flex items-center gap-3', ultimo ? 'mt-3' : 'mt-5')}>
              {i > 0 && (
                <button
                  type="button"
                  className="inline-flex h-12 items-center gap-2 rounded-full px-3 text-[15px] font-semibold text-ink-2 hover:bg-sand"
                  aria-label="Anterior"
                  onClick={() => ir(i - 1)}
                >
                  <ArrowLeft size={16} />
                  <span className="hidden sm:inline">Anterior</span>
                </button>
              )}
              <span className="flex-1" />
              <button
                ref={siguiente}
                type="button"
                className="inline-flex h-12 min-w-[132px] items-center justify-center gap-2 rounded-full bg-brand px-6 text-[15.5px] font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/.35),0_10px_24px_-10px_rgb(255_122_0/.75)] transition-[transform,background-color] duration-200 hover:bg-brand-deep active:scale-[.97]"
                onClick={() => (ultimo ? terminar() : ir(i + 1))}
              >
                {ultimo ? 'Empezar' : 'Siguiente'}
                {!ultimo && <ArrowRight size={16} />}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
