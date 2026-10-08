import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import {
  ArrowDown,
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  ExternalLink,
  LogIn,
  MessageCircle,
  Package,
  Printer,
  Receipt,
  ShoppingCart,
  Store,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { isTokenExpired } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { AYUDA_WHATSAPP, SECCIONES_GUIA, gruposDeLaGuia, type ContextoGuia } from '@/lib/guia'
import { movimientoReducido } from '@/components/guia/escenas/animacion'
import { CuerpoSeccion } from '@/components/guia/Contenido'
import { ConModulo, Hoja } from '@/components/guia/piezas'

const TEMAS = [
  { id: 'pedidos', nombre: 'Pedidos', Icono: Receipt },
  { id: 'pos', nombre: 'Punto de venta', Icono: ShoppingCart },
  { id: 'comandas', nombre: 'Comandas', Icono: Printer },
  { id: 'caja', nombre: 'Caja', Icono: CalendarDays },
  { id: 'menu', nombre: 'Menú', Icono: Package },
  { id: 'tienda', nombre: 'Tu tienda', Icono: Store },
]
const GRUPOS = gruposDeLaGuia()
const PRIMERA = SECCIONES_GUIA[0].id
const ULTIMA = SECCIONES_GUIA[SECCIONES_GUIA.length - 1].id
const BOTON = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold'

function resaltar(el: Element | null) {
  if (!el) return
  el.setAttribute('data-resaltada', '')
  window.setTimeout(() => el.removeAttribute('data-resaltada'), 1700)
}

function useSesionValida() {
  const token = useAuthStore((s) => s.token)
  const autenticado = useAuthStore((s) => s.isAuthenticated)
  return !!(autenticado && token && !isTokenExpired(token))
}

function Indice({ activa, ir }: { activa: string; ir: (id: string) => void }) {
  return (
    <div className="grid gap-6">
      {GRUPOS.map((g) => (
        <div key={g.grupo}>
          <p className="px-3 text-[11px] font-semibold uppercase tracking-[.09em] text-ink-3">{g.grupo}</p>
          <ul className="mt-2 grid gap-0.5">
            {g.secciones.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  onClick={(e) => {
                    e.preventDefault()
                    ir(s.id)
                  }}
                  aria-current={activa === s.id ? 'location' : undefined}
                  className={cn(
                    'flex min-h-10 items-center rounded-xl px-3 text-[14px] leading-snug transition-colors',
                    activa === s.id ? 'bg-white font-semibold text-ink ring-1 ring-line' : 'text-ink-2 hover:bg-sand',
                  )}
                >
                  {s.titulo}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

/**
 * La guía del panel: cómo funciona por dentro, con el estilo de la de la app de marketing
 * (marketers/src/pages/Guia.tsx). No le pide nada a la API. Vive en `/dashboard/guia`, adentro de la
 * sesión, para que el panel siga recibiendo e imprimiendo pedidos mientras se lee; `/guia` es la
 * versión pública para compartir, y con sesión lleva a la de adentro.
 */
export default function Guia() {
  const conSesion = useSesionValida()
  const baseTienda = useRestauranteStore((s) => s.restaurante?.baseTienda ?? null)
  const { state } = useLocation()
  const [activa, setActiva] = useState(PRIMERA)
  const [indice, setIndice] = useState(false)
  const tienda = baseTienda?.replace(/^https?:\/\//, '').replace(/\/$/, '') ?? null
  const contexto: ContextoGuia = { conSesion, tienda }
  // Quien llega desde el menú vuelve a la pantalla donde estaba.
  const desde: unknown = (state as { volver?: unknown } | null)?.volver
  const volver = conSesion
    ? {
        to: typeof desde === 'string' && desde.startsWith('/dashboard') && !desde.startsWith('/dashboard/guia') ? desde : '/dashboard',
        texto: 'Volver al panel',
        Icono: ArrowLeft,
      }
    : { to: '/login', texto: 'Entrar', Icono: LogIn }

  useEffect(() => {
    const antes = document.title
    document.title = 'Guía · Piru'
    return () => {
      document.title = antes
    }
  }, [])

  // Al llegar con `#seccion` se salta directo ahí; y otra vez cuando termina de cargar la
  // tipografía, que corre el texto, salvo que ya se haya movido la página. Después, los saltos
  // dentro de la guía son suaves.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1))
    const el = id ? document.getElementById(id) : null
    let vigente = true
    if (el) {
      el.scrollIntoView({ behavior: 'instant', block: 'start' })
      resaltar(el)
      const llegada = window.scrollY
      document.fonts?.ready.then(() => {
        if (vigente && Math.abs(window.scrollY - llegada) < 2) el.scrollIntoView({ behavior: 'instant', block: 'start' })
      })
    } else window.scrollTo({ top: 0, behavior: 'instant' })
    const html = document.documentElement
    if (!movimientoReducido()) html.style.scrollBehavior = 'smooth'
    return () => {
      vigente = false
      html.style.scrollBehavior = ''
    }
  }, [])

  // El índice marca la sección que se está leyendo: la última cuyo comienzo ya pasó la línea de
  // lectura, justo debajo de la barra. Al final de la página, la última.
  useEffect(() => {
    let cuadro = 0
    const medir = () => {
      cuadro = 0
      let leyendo = PRIMERA
      for (const s of SECCIONES_GUIA) {
        const el = document.getElementById(s.id)
        if (el && el.getBoundingClientRect().top <= 150) leyendo = s.id
      }
      const html = document.documentElement
      if (window.innerHeight + window.scrollY >= html.scrollHeight - 4) leyendo = ULTIMA
      setActiva(leyendo)
    }
    const programar = () => {
      if (!cuadro) cuadro = requestAnimationFrame(medir)
    }
    programar()
    window.addEventListener('scroll', programar, { passive: true })
    window.addEventListener('resize', programar)
    return () => {
      window.removeEventListener('scroll', programar)
      window.removeEventListener('resize', programar)
      cancelAnimationFrame(cuadro)
    }
  }, [])

  // El índice lateral acompaña: la sección activa siempre queda a la vista.
  const lateral = useRef<HTMLElement>(null)
  useEffect(() => {
    const nav = lateral.current
    const item = nav?.querySelector<HTMLElement>('[aria-current="location"]')
    if (!nav || !item || !nav.offsetParent) return
    const arriba = item.offsetTop - 24
    const abajo = item.offsetTop + item.offsetHeight + 24 - nav.clientHeight
    if (nav.scrollTop > arriba) nav.scrollTo({ top: arriba })
    else if (nav.scrollTop < abajo) nav.scrollTo({ top: abajo })
  }, [activa])

  function ir(id: string) {
    setIndice(false)
    setActiva(id)
    // Después de que se cierre el índice del celular, que bloquea el scroll mientras está abierto.
    requestAnimationFrame(() => {
      const el = document.getElementById(id)
      el?.scrollIntoView({ behavior: movimientoReducido() ? 'auto' : 'smooth', block: 'start' })
      window.history.replaceState(window.history.state, '', `#${id}`)
      resaltar(el)
    })
  }

  const actual = SECCIONES_GUIA.find((s) => s.id === activa) ?? SECCIONES_GUIA[0]

  return (
    <div className="guia min-h-dvh bg-paper font-sans text-ink antialiased">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between gap-3 px-4 sm:px-8">
          <Link to={volver.to} className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
            <span className="text-brand">✳</span>Piru
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold tracking-normal text-brand-deep">
              guía
            </span>
          </Link>
          <Link className={cn(BOTON, 'min-h-10 bg-white px-4 text-ink ring-1 ring-line hover:bg-sand')} to={volver.to}>
            <volver.Icono size={16} />
            {volver.texto}
          </Link>
        </div>
      </header>

      <div className="sticky top-14 z-20 border-b border-line bg-paper/90 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setIndice(true)}
          className="mx-auto flex h-12 w-full max-w-[1200px] items-center justify-between gap-3 px-4 text-left text-sm sm:px-8"
        >
          <span className="min-w-0 truncate">
            <span className="text-ink-3">Índice · </span>
            <span className="font-semibold text-ink">{actual.titulo}</span>
          </span>
          <ChevronDown size={18} className="shrink-0 text-ink-3" />
        </button>
      </div>
      <Hoja open={indice} onOpenChange={setIndice} titulo="Índice">
        <Indice activa={activa} ir={ir} />
      </Hoja>

      <section className="relative overflow-hidden border-b border-line">
        <div className="escenario absolute inset-0 opacity-80" aria-hidden />
        <div className="relative mx-auto max-w-[1200px] px-4 pb-10 pt-10 sm:px-8 sm:pb-14 sm:pt-16">
          <p className="text-[11px] font-semibold uppercase tracking-[.09em] text-brand-deep">Guía</p>
          <h1 className="mt-3 max-w-3xl text-[34px] font-bold leading-[1.05] tracking-[-0.03em] sm:text-[52px]">
            {conSesion ? 'Cómo funciona tu panel de Piru' : 'Cómo funciona el panel de Piru'}
          </h1>
          <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-ink-2 sm:text-lg">
            Lo que pasa en cada pantalla: cómo entra un pedido, cómo se anota, se imprime y se despacha, cómo se
            cierra la caja y cómo se arma tu tienda. En simple y con ejemplos.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => ir(PRIMERA)} className={cn(BOTON, 'bg-ink text-white')}>
              <ArrowDown size={18} />
              Empezar por lo básico
            </button>
            {conSesion && tienda && (
              <a
                href={baseTienda ?? undefined}
                target="_blank"
                rel="noreferrer"
                className={cn(BOTON, 'bg-white text-ink ring-1 ring-line hover:bg-sand')}
              >
                <ExternalLink size={17} />
                Ver mi tienda
              </a>
            )}
          </div>
          <ul className="mt-9 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            {TEMAS.map((t) => (
              <li key={t.id}>
                <a
                  href={`#${t.id}`}
                  onClick={(e) => {
                    e.preventDefault()
                    ir(t.id)
                  }}
                  className="flex min-h-14 items-center gap-3 rounded-2xl bg-white/90 px-3.5 text-[14px] font-semibold text-ink ring-1 ring-line transition-transform hover:-translate-y-0.5"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-deep">
                    <t.Icono size={16} />
                  </span>
                  {t.nombre}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mx-auto max-w-[1200px] px-4 sm:px-8 lg:grid lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-14">
        <aside className="hidden lg:block">
          <nav
            ref={lateral}
            aria-label="Índice de la guía"
            className="sticky top-14 max-h-[calc(100dvh-3.5rem)] overflow-y-auto py-10 pr-2 [scrollbar-color:#ECE4D8_transparent] [scrollbar-width:thin]"
          >
            <Indice activa={activa} ir={ir} />
          </nav>
        </aside>
        <main className="min-w-0 max-w-[760px] pb-20 pt-4 lg:pt-6">
          {SECCIONES_GUIA.map((s) => (
            <section
              key={s.id}
              id={s.id}
              aria-labelledby={`titulo-${s.id}`}
              className="guia-seccion scroll-mt-32 border-t border-line py-12 first:border-t-0 lg:scroll-mt-20"
            >
              <p className="text-[12px] font-semibold uppercase tracking-[.09em] text-brand-deep">{s.grupo}</p>
              <h2
                id={`titulo-${s.id}`}
                className="mt-2 text-[27px] font-bold leading-tight tracking-[-0.025em] text-ink transition-colors sm:text-[32px]"
              >
                {s.titulo}
              </h2>
              {s.modulo && (
                <div className="mt-3">
                  <ConModulo>{s.modulo}</ConModulo>
                </div>
              )}
              <div className="guia-prosa mt-5">
                <CuerpoSeccion id={s.id} c={contexto} />
              </div>
            </section>
          ))}
          <footer className="rounded-[24px] bg-ink p-7 text-white sm:p-9">
            <p className="text-xl font-semibold tracking-tight">¿Te quedó una duda?</p>
            <p className="mt-2 max-w-xl text-[15.5px] leading-relaxed text-white/70">
              Escribinos por WhatsApp y te ayudamos. Te contesta una persona del equipo de Piru.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a className={cn(BOTON, 'bg-white text-ink')} href={AYUDA_WHATSAPP} target="_blank" rel="noreferrer">
                <MessageCircle size={17} />
                Escribinos
              </a>
              <Link className={cn(BOTON, 'bg-white/10 text-white ring-1 ring-white/20')} to={volver.to}>
                <volver.Icono size={17} />
                {volver.texto}
              </Link>
            </div>
          </footer>
        </main>
      </div>
    </div>
  )
}

/** `/guia`, la versión pública para compartir. Con sesión lleva a la del panel, con el mismo `#`. */
export function GuiaPublica() {
  const conSesion = useSesionValida()
  const { hash } = useLocation()
  if (conSesion) return <Navigate to={{ pathname: '/dashboard/guia', hash }} replace />
  return <Guia />
}
