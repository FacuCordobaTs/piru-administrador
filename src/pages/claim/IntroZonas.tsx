import { useRef, useState, type ReactNode } from 'react'
import { Dialog } from 'radix-ui'
import { ArrowLeft, ArrowRight, Check, MapPin, Minus, Plus, Pointer, Store, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Escena, Toque } from '@/components/guia/escenas/Escena'
import { d, useSecuencia } from '@/components/guia/escenas/animacion'
import '@/components/recorrido/recorrido.css'

/**
 * Presentación de "Dibujar zonas" antes de abrir el mapa real del claim. Cada paso es una escena
 * propia (mismas piezas que la guía: `Escena`, `e-dibuja`, `e-pop`…) que copia la herramienta real
 * de leaflet-draw: el botón del polígono debajo del zoom, la barra "Terminar · Borrar último punto ·
 * Cancelar" y el formulario de nombre y precio que aparece al cerrar la zona.
 */

const W = 380
const H = 250
const CALLES_H = [34, 92, 150, 208]
const CALLES_V = [70, 140, 210, 280, 350]
const LOCAL = { x: 208, y: 162 }
// Esquinas de la zona Centro, en el orden en que se marcan (debajo de la barra de dibujo).
const CENTRO = [
  { x: 120, y: 116 },
  { x: 252, y: 104 },
  { x: 310, y: 168 },
  { x: 252, y: 232 },
  { x: 132, y: 224 },
]
const NORTE = [CENTRO[1], { x: 340, y: 56 }, { x: 368, y: 146 }, CENTRO[2]]
const camino = (pts: { x: number; y: number }[]) => `M ${pts.map((p) => `${p.x} ${p.y}`).join(' L ')} Z`
const largo = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(b.x - a.x, b.y - a.y)

/** El mapa de fondo con el zoom y la herramienta de dibujo, como los muestra el mapa real. */
function Mapa({ children, herramientaActiva = false, conBarra = false }: { children?: ReactNode; herramientaActiva?: boolean; conBarra?: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-[20px] bg-[#ECEEE6] ring-1 ring-[#DCDDD2]">
      <svg className="absolute inset-0" width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" aria-hidden>
        <rect x={292} y={168} width={64} height={60} rx={8} fill="#D3E4C6" />
        <rect x={20} y={110} width={36} height={70} rx={8} fill="#D3E4C6" />
        {CALLES_H.map((y) => (
          <line key={`h${y}`} x1={0} y1={y} x2={W} y2={y} stroke="#fff" strokeWidth={6} />
        ))}
        {CALLES_V.map((x) => (
          <line key={`v${x}`} x1={x} y1={0} x2={x} y2={H} stroke="#fff" strokeWidth={6} />
        ))}
        <line x1={0} y1={240} x2={W} y2={20} stroke="#fff" strokeWidth={11} />
        <line x1={0} y1={240} x2={W} y2={20} stroke="#F2E9D8" strokeWidth={5} />
      </svg>
      {children}
      <span
        className="absolute grid size-8 place-items-center rounded-full bg-brand text-white ring-4 ring-white shadow-[0_8px_18px_-6px_rgb(255_122_0/.8)]"
        style={{ left: LOCAL.x - 16, top: LOCAL.y - 16 }}
      >
        <Store size={14} />
      </span>
      {/* Zoom + botón del polígono (leaflet-draw los apila arriba a la izquierda). */}
      <div className="absolute left-2.5 top-2.5 overflow-hidden rounded-[6px] bg-white text-ink shadow-[0_1px_4px_rgb(0_0_0/.25)]">
        <span className="grid size-[26px] place-items-center border-b border-[#ddd]"><Plus size={13} strokeWidth={2.6} /></span>
        <span className="grid size-[26px] place-items-center"><Minus size={13} strokeWidth={2.6} /></span>
      </div>
      <div
        className={cn(
          'absolute left-2.5 top-[72px] grid size-[26px] place-items-center rounded-[6px] bg-white shadow-[0_1px_4px_rgb(0_0_0/.25)]',
          herramientaActiva && 'bg-[#FFF2E3] ring-2 ring-brand',
        )}
      >
        <svg width={15} height={15} viewBox="0 0 16 16" aria-hidden>
          <path d="M8 1.6 14.4 6.2 12 14H4L1.6 6.2Z" fill="none" stroke="#191512" strokeWidth={1.6} strokeLinejoin="round" />
        </svg>
      </div>
      {conBarra && (
        <div className="e-derecha absolute left-[40px] top-[72px] flex h-[26px] overflow-hidden rounded-[6px] bg-[#919187] text-[9px] font-semibold text-white" style={d(150)}>
          <span className="grid place-items-center border-r border-white/25 px-2">Terminar</span>
          <span className="grid place-items-center border-r border-white/25 px-2">Borrar último punto</span>
          <span className="grid place-items-center px-2">Cancelar</span>
        </div>
      )}
    </div>
  )
}

function Globo({ x, y, children, delay = 0, lado = 'abajo' }: { x: number; y: number; children: ReactNode; delay?: number; lado?: 'abajo' | 'arriba' }) {
  return (
    <span
      className={cn(
        'e-pop absolute whitespace-nowrap rounded-full bg-ink px-2.5 py-1 text-[10px] font-semibold text-white shadow-[0_6px_14px_-6px_rgb(0_0_0/.6)]',
        lado === 'arriba' && '-translate-y-full',
      )}
      style={{ left: x, top: y, ...d(delay) }}
    >
      {children}
    </span>
  )
}

function Dedo({ x, y }: { x: number; y: number }) {
  return (
    <span className="absolute transition-[left,top] duration-500 ease-out" style={{ left: x - 4, top: y - 2 }}>
      <Pointer size={22} strokeWidth={2} className="fill-white text-ink drop-shadow" />
    </span>
  )
}

/** 1 · Encontrar la herramienta. */
function EscenaHerramienta() {
  const n = useSecuencia(1700)
  return (
    <Escena ancho={W} alto={H} etiqueta="El botón con forma de pentágono, debajo del zoom del mapa, empieza a dibujar una zona." siempreActiva>
      <Mapa herramientaActiva={n % 2 === 1} />
      <div className="absolute left-2.5 top-[72px] size-[26px]">
        <Toque vez={n} />
      </div>
      <span className="e-latido absolute left-[6px] top-[68px] size-[34px] rounded-[9px] ring-2 ring-brand/60" />
      <Globo x={46} y={76} delay={300}>
        Tocá el pentágono para empezar
      </Globo>
    </Escena>
  )
}

/** 2 · Marcar las esquinas, una por una. */
function EscenaEsquinas() {
  const n = useSecuencia(850, 4)
  const k = Math.min(n % 7, CENTRO.length - 1)
  const actual = CENTRO[k]
  return (
    <Escena ancho={W} alto={H} etiqueta="Cada toque sobre el mapa marca una esquina de la zona; las esquinas se unen con una línea." siempreActiva>
      <Mapa herramientaActiva conBarra>
        <svg className="absolute inset-0" width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" aria-hidden>
          {CENTRO.slice(0, k).map((p, i) => {
            const q = CENTRO[i + 1]
            const l = largo(p, q)
            return (
              <line
                key={`${i}-${i === k - 1 ? n : 'fijo'}`}
                x1={p.x}
                y1={p.y}
                x2={q.x}
                y2={q.y}
                stroke="#FF7A00"
                strokeWidth={2.6}
                strokeLinecap="round"
                className={i === k - 1 ? 'e-dibuja' : undefined}
                style={i === k - 1 ? d(0, { '--largo': l }) : undefined}
              />
            )
          })}
          {CENTRO.slice(0, k + 1).map((p, i) => (
            <rect
              key={`${i}-${i === k ? n : 'fijo'}`}
              x={p.x - 5}
              y={p.y - 5}
              width={10}
              height={10}
              rx={2}
              fill="#fff"
              stroke="#FF7A00"
              strokeWidth={2}
              className={i === k ? 'e-pop' : undefined}
            />
          ))}
        </svg>
      </Mapa>
      <Dedo x={actual.x} y={actual.y} />
      <Globo x={150} y={18} delay={0}>
        Tocá el mapa en cada esquina · {k + 1} de {CENTRO.length}
      </Globo>
    </Escena>
  )
}

/** 3 · Cerrar la zona tocando el primer punto (o "Terminar"). */
function EscenaCerrar() {
  const n = useSecuencia(3200)
  const ultimo = CENTRO[CENTRO.length - 1]
  const primero = CENTRO[0]
  return (
    <Escena ancho={W} alto={H} etiqueta="Para cerrar la zona se toca el primer punto o el botón Terminar; la zona queda pintada." siempreActiva>
      <Mapa herramientaActiva conBarra>
        <svg key={n} className="absolute inset-0" width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" aria-hidden>
          <path d={camino(CENTRO)} fill="#FF7A00" fillOpacity={0.2} className="e-aparece" style={d(1000)} />
          <path d={`M ${CENTRO.map((p) => `${p.x} ${p.y}`).join(' L ')}`} stroke="#FF7A00" strokeWidth={2.6} strokeLinejoin="round" />
          <line
            x1={ultimo.x}
            y1={ultimo.y}
            x2={primero.x}
            y2={primero.y}
            stroke="#FF7A00"
            strokeWidth={2.6}
            strokeLinecap="round"
            className="e-dibuja"
            style={d(250, { '--largo': largo(ultimo, primero) })}
          />
          {CENTRO.map((p, i) => (
            <rect key={i} x={p.x - 5} y={p.y - 5} width={10} height={10} rx={2} fill="#fff" stroke="#FF7A00" strokeWidth={2} />
          ))}
        </svg>
        <span className="e-latido absolute size-6 rounded-full ring-2 ring-brand" style={{ left: primero.x - 12, top: primero.y - 12 }} />
      </Mapa>
      <Dedo x={primero.x} y={primero.y} />
      <Globo x={primero.x + 18} y={primero.y - 2} delay={200}>
        Tocá el primer punto para cerrarla
      </Globo>
      <Globo x={170} y={186} delay={1200}>
        <span className="inline-flex items-center gap-1"><Check size={11} strokeWidth={3} /> Zona dibujada</span>
      </Globo>
    </Escena>
  )
}

/** 4 · Ponerle nombre y precio de envío. */
function EscenaPrecio() {
  const n = useSecuencia(4200)
  return (
    <Escena ancho={W} alto={H} etiqueta="Al cerrar la zona se completa su nombre, por ejemplo Centro, y el costo de envío, por ejemplo 1.200 pesos." siempreActiva>
      <Mapa>
        <svg className="absolute inset-0" width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" aria-hidden>
          <path d={camino(CENTRO)} fill="#FF7A00" fillOpacity={0.2} stroke="#FF7A00" strokeWidth={2.4} strokeDasharray="6 5" strokeLinejoin="round" />
        </svg>
      </Mapa>
      <div key={n} className="e-sube absolute bottom-3 right-3 w-[176px] rounded-[16px] bg-white p-3 shadow-[0_18px_36px_-16px_rgb(40_24_8/.55)] ring-1 ring-[#ECE4D8]">
        <p className="flex items-center gap-1.5 text-[11px] font-bold text-ink">
          <span className="size-2.5 rounded-full bg-brand" /> Nueva zona
        </p>
        <div className="mt-2 flex h-7 items-center rounded-[8px] bg-[#F6F0E6] px-2 text-[10.5px] font-semibold text-ink">
          <span className="e-aparece" style={d(500)}>Centro</span>
          <span className="e-latido ml-px h-3 w-px bg-ink" style={d(500)} />
        </div>
        <div className="mt-1.5 flex h-7 items-center rounded-[8px] bg-[#F6F0E6] px-2 text-[10.5px] font-semibold text-ink">
          <span className="text-ink-3">$&nbsp;</span>
          <span className="e-aparece" style={d(1300)}>1.200</span>
        </div>
        <div className="relative mt-2 grid h-7 place-items-center rounded-[8px] bg-brand text-[10.5px] font-bold text-white">
          Agregar zona
          <span className="absolute inset-0 e-aparece" style={d(2100)}>
            <Toque vez={n} />
          </span>
        </div>
      </div>
      <Globo x={20} y={222} delay={200}>
        Nombre y costo de envío
      </Globo>
    </Escena>
  )
}

/** 5 · Varias zonas, cada una con su precio. */
function EscenaVarias() {
  const n = useSecuencia(2400, 1)
  const fase = n % 3
  return (
    <Escena ancho={W} alto={H} etiqueta="Se pueden dibujar varias zonas con precios distintos; una dirección fuera de las zonas no puede pedir delivery." siempreActiva>
      <Mapa>
        <svg className="absolute inset-0" width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" aria-hidden>
          <path d={camino(CENTRO)} fill="#FF7A00" fillOpacity={0.18} stroke="#FF7A00" strokeWidth={2.4} strokeLinejoin="round" />
          <path d={camino(NORTE)} fill="#7C5CDB" fillOpacity={0.16} className="e-aparece" style={d(200)} />
          <path d={camino(NORTE)} stroke="#7C5CDB" strokeWidth={2.4} strokeLinejoin="round" pathLength={100} className="e-dibuja" style={d(0, { '--largo': 100 })} />
        </svg>
        <span className="absolute rounded-full bg-white px-2 py-0.5 text-[9.5px] font-bold text-brand-deep shadow" style={{ left: 140, top: 128 }}>Centro · $1.200</span>
        <span className="e-pop absolute rounded-full bg-white px-2 py-0.5 text-[9.5px] font-bold text-[#5B3FC0] shadow" style={{ left: 282, top: 82, ...d(700) }}>Norte · $1.800</span>
        {fase === 1 && (
          <span key={`a${n}`} className="e-cae absolute" style={{ left: 320, top: 100 }}>
            <MapPin size={24} strokeWidth={2.2} className="drop-shadow" style={{ color: '#059669', fill: 'white' }} />
          </span>
        )}
        {fase === 2 && (
          <span key={`b${n}`} className="e-cae absolute" style={{ left: 30, top: 196 }}>
            <MapPin size={24} strokeWidth={2.2} className="drop-shadow" style={{ color: '#E11D48', fill: 'white' }} />
          </span>
        )}
      </Mapa>
      <div key={fase} className={cn('e-sube absolute bottom-3 right-3 w-[150px] rounded-[14px] p-2.5 ring-1', fase === 2 ? 'bg-rose-50 ring-rose-600/15' : fase === 1 ? 'bg-emerald-50 ring-emerald-600/20' : 'bg-white ring-[#ECE4D8]')}>
        {fase === 0 ? (
          <p className="text-[10px] leading-snug text-ink-2">Dibujá todas las zonas que quieras, cada una con su precio.</p>
        ) : fase === 1 ? (
          <>
            <p className="flex items-center gap-1 text-[10.5px] font-bold text-emerald-800"><Check size={12} strokeWidth={3} /> Cae en Norte</p>
            <p className="mt-0.5 text-[10px] text-emerald-900/80">El cliente paga $1.800 de envío.</p>
          </>
        ) : (
          <>
            <p className="flex items-center gap-1 text-[10.5px] font-bold text-rose-800"><X size={12} strokeWidth={3} /> Fuera de zona</p>
            <p className="mt-0.5 text-[10px] text-rose-900/80">No puede pedir delivery; puede retirar.</p>
          </>
        )}
      </div>
    </Escena>
  )
}

const PASOS = [
  {
    titulo: 'Tocá el botón del pentágono',
    texto: 'Está arriba a la izquierda del mapa, debajo del + y el −. Con eso empezás a dibujar una zona de reparto.',
    Escena: EscenaHerramienta,
  },
  {
    titulo: 'Marcá las esquinas de la zona',
    texto: 'Tocá el mapa en cada esquina del área donde repartís: una calle, una avenida, el límite de un barrio. Si te equivocás, «Borrar último punto».',
    Escena: EscenaEsquinas,
  },
  {
    titulo: 'Cerrala tocando el primer punto',
    texto: 'Cuando llegás a la última esquina, tocá el primer punto que marcaste (o «Terminar»). La zona queda pintada.',
    Escena: EscenaCerrar,
  },
  {
    titulo: 'Ponele nombre y precio',
    texto: 'Escribí cómo se llama (por ejemplo «Centro») y cuánto cobrás el envío ahí. Tocá «Agregar zona» y queda guardada.',
    Escena: EscenaPrecio,
  },
  {
    titulo: 'Repetí para cada zona',
    texto: 'Más lejos, más caro: dibujá otra zona al lado con su precio. Tu tienda le cobra a cada cliente según dónde vive, y fuera de las zonas sólo puede retirar.',
    Escena: EscenaVarias,
  },
]

export function IntroZonas({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const [i, setI] = useState(0)
  const [dir, setDir] = useState<1 | -1>(1)
  const siguiente = useRef<HTMLButtonElement>(null)
  // Cada apertura arranca del primer paso.
  const [abiertoAntes, setAbiertoAntes] = useState(abierto)
  if (abierto !== abiertoAntes) {
    setAbiertoAntes(abierto)
    if (abierto) setI(0)
  }
  const paso = PASOS[i]
  const ultimo = i === PASOS.length - 1
  const ir = (j: number) => {
    if (j < 0 || j >= PASOS.length || j === i) return
    setDir(j > i ? 1 : -1)
    setI(j)
  }

  return (
    <Dialog.Root open={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="rp-fondo fixed inset-0 z-[1100] bg-[#120F0D]/60 backdrop-blur-[3px]" />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            siguiente.current?.focus({ preventScroll: true })
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') ir(i + 1)
            else if (e.key === 'ArrowLeft') ir(i - 1)
          }}
          className="rp-caja fixed inset-x-0 bottom-0 z-[1110] flex max-h-[100dvh] flex-col overflow-hidden rounded-t-[28px] bg-paper font-sans text-ink outline-none sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[min(460px,calc(100vw-32px))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px] sm:shadow-[0_40px_100px_-30px_rgb(0_0_0/.55)]"
        >
          <Dialog.Title className="sr-only">Cómo dibujar tus zonas de delivery</Dialog.Title>
          <div className="escenario relative shrink-0 px-4 pb-4 pt-4">
            <div className="flex items-center justify-between pb-3">
              <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-deep">Dibujar zonas</span>
              <button type="button" onClick={onCerrar} className="min-h-8 rounded-full px-3 text-[13px] font-semibold text-ink-3 hover:bg-sand hover:text-ink">
                Saltar
              </button>
            </div>
            <div key={i} className="rp-escena">
              <paso.Escena />
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col px-6 pb-[max(20px,env(safe-area-inset-bottom))] pt-5">
            <div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
              <div key={i} data-dir={dir} className="rp-texto">
                <p className="text-[13px] font-semibold tabular-nums text-ink-3">Paso {i + 1} de {PASOS.length}</p>
                <h2 className="mt-1.5 text-[22px] font-bold leading-tight tracking-tight">{paso.titulo}</h2>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{paso.texto}</p>
              </div>
            </div>
            <div className="mt-5 flex items-center gap-1.5">
              {PASOS.map((p, j) => (
                <button
                  key={p.titulo}
                  type="button"
                  aria-label={`Paso ${j + 1}: ${p.titulo}`}
                  aria-current={j === i ? 'step' : undefined}
                  onClick={() => ir(j)}
                  className="relative h-6 flex-1"
                >
                  <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-ink/10">
                    <span
                      key={j === i ? `actual-${i}` : 'fijo'}
                      className={cn('block h-full rounded-full bg-brand', j < i ? 'w-full' : j === i ? 'rp-progreso w-full' : 'w-0')}
                    />
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3">
              {i > 0 && (
                <button type="button" aria-label="Anterior" onClick={() => ir(i - 1)} className="inline-flex h-12 items-center gap-2 rounded-full px-3 text-[15px] font-semibold text-ink-2 hover:bg-sand">
                  <ArrowLeft size={16} />
                </button>
              )}
              <span className="flex-1" />
              <button
                ref={siguiente}
                type="button"
                onClick={() => (ultimo ? onCerrar() : ir(i + 1))}
                className="inline-flex h-12 min-w-[150px] items-center justify-center gap-2 rounded-full bg-brand px-6 text-[15px] font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/.35),0_10px_24px_-10px_rgb(255_122_0/.75)] transition-[transform,background-color] hover:bg-brand-deep active:scale-[.97]"
              >
                {ultimo ? 'Empezar a dibujar' : 'Siguiente'}
                {!ultimo && <ArrowRight size={16} />}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
