import { Bike, LayoutDashboard, MessageCircle, Printer, Receipt, Store } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Escena } from './Escena'
import { d, useSecuencia } from './animacion'
import { PEDIDO_EJEMPLO } from './ejemplo'

// El viaje es un anillo: después del despacho, el cliente vuelve a pedir por la tienda.
const CX = 230
const CY = 190
const R = 116
const PERIMETRO = 2 * Math.PI * R
const NODOS = [
  { Icono: Store, nombre: 'Tienda', texto: 'Martina arma su pedido desde tu link.', derecha: true },
  { Icono: MessageCircle, nombre: 'WhatsApp', texto: 'Te llega escrito a tu WhatsApp de siempre.', derecha: true },
  { Icono: LayoutDashboard, nombre: 'Panel', texto: 'Entra en Inicio con su comanda y cómo pagó.', derecha: true },
  { Icono: Printer, nombre: 'Cocina', texto: 'La comanda sale sola por la impresora.', derecha: false },
  { Icono: Bike, nombre: 'Despacho', texto: 'Lo despachás y queda en la caja del día.', derecha: false },
]
const posicion = (i: number) => {
  const a = ((-90 + (i * 360) / NODOS.length) * Math.PI) / 180
  return { x: CX + R * Math.cos(a), y: CY + R * Math.sin(a) }
}

export function ViajePedido() {
  const n = useSecuencia(2600)
  const fase = n % NODOS.length
  const actual = NODOS[fase]
  return (
    <Escena
      ancho={460}
      alto={340}
      etiqueta="El viaje de un pedido: el cliente pide desde tu link, te llega a tu WhatsApp, entra al panel, la comanda sale por la impresora de la cocina y lo despachás."
    >
      <svg className="absolute inset-0" width={460} height={340} viewBox="0 0 460 340" fill="none" aria-hidden>
        <circle
          cx={CX}
          cy={CY}
          r={R}
          stroke="rgb(25 21 18 / .14)"
          strokeWidth={2}
          strokeDasharray="2 7"
          strokeLinecap="round"
          className="e-aparece"
        />
        {/* El tramo ya recorrido de la vuelta. */}
        <circle
          cx={CX}
          cy={CY}
          r={R}
          stroke="#FF7A00"
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={PERIMETRO}
          transform={`rotate(-90 ${CX} ${CY})`}
          style={{
            strokeDashoffset: PERIMETRO * (1 - fase / NODOS.length),
            transition: fase ? 'stroke-dashoffset .9s cubic-bezier(.65,0,.35,1)' : 'none',
          }}
        />
        <path
          d="M 196 26 C 214 27, 216 42, 211 53"
          stroke="#80776E"
          strokeWidth={1.6}
          strokeLinecap="round"
          className="e-hormigas"
        />
        <path
          d="M 205 49 L 211 55 L 215 47"
          stroke="#80776E"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* El punto que viaja de una etapa a la siguiente, siempre en el mismo sentido. */}
        <g
          style={{
            transform: `rotate(${n * (360 / NODOS.length)}deg)`,
            transformOrigin: `${CX}px ${CY}px`,
            transition: 'transform .9s cubic-bezier(.65,0,.35,1)',
          }}
        >
          <circle cx={CX} cy={CY - R} r={13} fill="#FF7A00" opacity={0.18} />
          <circle cx={CX} cy={CY - R} r={6.5} fill="#FF7A00" />
        </g>
      </svg>

      <div
        className="e-izquierda absolute left-[14px] top-[12px] flex h-[28px] items-center gap-1.5 rounded-full bg-white px-3 text-[12px] font-semibold text-ink-2 shadow-[0_0_0_1px_#ECE4D8,0_6px_14px_-10px_rgb(40_24_8/.4)]"
        style={d(900)}
      >
        <Receipt size={14} className="text-brand" strokeWidth={2.2} />
        Pedido #{PEDIDO_EJEMPLO.id} · {PEDIDO_EJEMPLO.corto}
      </div>

      {NODOS.map((nodo, i) => {
        const { x, y } = posicion(i)
        const activo = i === fase
        const visto = i < fase
        return (
          <div key={nodo.nombre} className="absolute" style={{ left: x - 28, top: y - 28, width: 56, height: 56 }}>
            <div className="e-pop" style={d(150 + i * 110)}>
              <div
                className={cn(
                  'grid size-14 place-items-center rounded-full ring-1 transition-[background-color,color,scale,box-shadow] duration-500',
                  activo
                    ? 'scale-110 bg-brand text-white ring-brand shadow-[0_12px_26px_-8px_rgb(255_122_0/.75)]'
                    : visto
                      ? 'bg-white text-brand-deep ring-brand/40'
                      : 'bg-white text-ink-2 ring-line shadow-[0_8px_18px_-12px_rgb(40_24_8/.45)]',
                )}
              >
                <nodo.Icono size={22} strokeWidth={2.1} />
              </div>
            </div>
            <span
              className={cn(
                'e-aparece absolute top-[18px] whitespace-nowrap text-[13px] font-semibold transition-colors duration-500',
                activo ? 'text-ink' : 'text-ink-3',
              )}
              style={{ ...d(400 + i * 110), ...(nodo.derecha ? { left: 66 } : { right: 66 }) }}
            >
              {nodo.nombre}
            </span>
          </div>
        )
      })}

      <div className="absolute left-[155px] top-[150px] w-[150px] text-center">
        <p key={`n${fase}`} className="e-aparece text-[11px] font-semibold uppercase tracking-[.08em] text-brand-deep">
          {fase + 1} de {NODOS.length}
        </p>
        <p key={`t${fase}`} className="e-sube mt-1.5 text-[13.5px] font-medium leading-snug text-ink">
          {actual.texto}
        </p>
      </div>
    </Escena>
  )
}
