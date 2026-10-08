import { Check, MapPin, Store, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Escena } from './Escena'
import { d, useSecuencia } from './animacion'
import { PEDIDO_EJEMPLO as P, pesos } from './ejemplo'

const ZONAS = [
  {
    nombre: 'Centro',
    precio: 1200,
    color: '#FF7A00',
    camino: 'M 62 92 L 178 58 L 226 128 L 196 226 L 92 236 L 44 160 Z',
    etiqueta: { x: 66, y: 102 },
  },
  {
    nombre: 'Norte',
    precio: 1800,
    color: '#7C5CDB',
    camino: 'M 178 58 L 258 22 L 282 120 L 226 128 Z',
    etiqueta: { x: 206, y: 64 },
  },
]
const CALLES_H = [46, 106, 166, 226, 286]
const CALLES_V = [34, 94, 154, 214, 274]
const LOCAL = { x: 126, y: 160 }
const DENTRO = { x: 176, y: 196 }
const AFUERA = { x: 52, y: 276 }

function Pin({ x, y, color, delay }: { x: number; y: number; color: string; delay: number }) {
  return (
    <span className="e-cae absolute" style={{ left: x - 13, top: y - 30, ...d(delay) }}>
      <MapPin size={26} strokeWidth={2.2} className="drop-shadow" style={{ color, fill: 'white' }} />
    </span>
  )
}

/**
 * Las zonas de envío en el mapa. Fases: 0 las zonas · 1 una dirección dentro de Centro paga su
 * envío · 2 una dirección fuera de las zonas no puede pedir delivery.
 */
export function ZonasEnvio() {
  const n = useSecuencia(2300, 1)
  const fase = n % 3
  return (
    <Escena
      ancho={460}
      alto={330}
      etiqueta={`Las zonas de envío en el mapa: ${P.direccion} cae en la zona Centro y paga ${pesos(1200)} de envío; una dirección fuera de las zonas no puede pedir delivery.`}
    >
      <div className="e-aparece absolute left-[12px] top-[12px] h-[306px] w-[292px] overflow-hidden rounded-[18px] bg-[#ECEEE6] ring-1 ring-[#DCDDD2]">
        <svg className="absolute inset-0" width={292} height={306} viewBox="0 0 292 306" fill="none" aria-hidden>
          <rect x={222} y={196} width={52} height={64} rx={8} fill="#D3E4C6" />
          {CALLES_H.map((y) => (
            <line key={`h${y}`} x1={0} y1={y} x2={292} y2={y} stroke="#fff" strokeWidth={6} />
          ))}
          {CALLES_V.map((x) => (
            <line key={`v${x}`} x1={x} y1={0} x2={x} y2={306} stroke="#fff" strokeWidth={6} />
          ))}
          <line x1={0} y1={300} x2={292} y2={14} stroke="#fff" strokeWidth={11} />
          <line x1={0} y1={300} x2={292} y2={14} stroke="#F2E9D8" strokeWidth={5} />
          {ZONAS.map((z, i) => (
            <g key={z.nombre}>
              <path d={z.camino} fill={z.color} fillOpacity={0.14} className="e-aparece" style={d(500 + i * 300)} />
              <path
                d={z.camino}
                stroke={z.color}
                strokeWidth={2.2}
                strokeLinejoin="round"
                pathLength={100}
                className="e-dibuja"
                style={d(150 + i * 300, { '--largo': 100 })}
              />
            </g>
          ))}
        </svg>
        {ZONAS.map((z, i) => (
          <span
            key={z.nombre}
            className="e-pop absolute rounded-full bg-white px-2 py-0.5 text-[9.5px] font-bold shadow-[0_2px_8px_-2px_rgb(40_24_8/.3)]"
            style={{ left: z.etiqueta.x, top: z.etiqueta.y, color: z.color, ...d(900 + i * 250) }}
          >
            {z.nombre} · {pesos(z.precio)}
          </span>
        ))}
        <span
          className="e-pop absolute grid size-9 place-items-center rounded-full bg-brand text-white ring-4 ring-white shadow-[0_8px_18px_-6px_rgb(255_122_0/.8)]"
          style={{ left: LOCAL.x - 18, top: LOCAL.y - 18, ...d(300) }}
        >
          <Store size={16} />
        </span>
        {fase === 1 && <Pin key={`d${n}`} x={DENTRO.x} y={DENTRO.y} color="#059669" delay={100} />}
        {fase === 2 && <Pin key={`a${n}`} x={AFUERA.x} y={AFUERA.y} color="#E11D48" delay={100} />}
      </div>

      <div className="absolute left-[316px] top-[12px] grid w-[132px] gap-2.5">
        <div className="e-tarjeta e-derecha p-3" style={d(200)}>
          <p className="text-[9px] font-bold uppercase tracking-[.1em] text-ink-3">Tus zonas</p>
          {ZONAS.map((z) => (
            <p key={z.nombre} className="mt-1.5 flex items-center justify-between text-[11px] font-semibold text-ink">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: z.color }} />
                {z.nombre}
              </span>
              <span className="tabular-nums text-ink-2">{pesos(z.precio)}</span>
            </p>
          ))}
        </div>
        <div
          key={fase}
          className={cn(
            'e-sube rounded-[16px] p-3 ring-1',
            fase === 1
              ? 'bg-emerald-50 ring-emerald-600/20'
              : fase === 2
                ? 'bg-rose-50 ring-rose-600/15'
                : 'bg-white ring-[#ECE4D8]',
          )}
          style={d(fase ? 450 : 0)}
        >
          {fase === 0 ? (
            <p className="text-[10.5px] leading-snug text-ink-2">
              Antes de pagar, la tienda ubica la dirección del cliente en tus zonas.
            </p>
          ) : fase === 1 ? (
            <>
              <p className="flex items-center gap-1 text-[11px] font-bold text-emerald-800">
                <Check size={13} strokeWidth={3} />
                Zona Centro
              </p>
              <p className="mt-1 text-[10px] leading-snug text-emerald-900/80">{P.direccion}</p>
              <p className="mt-1.5 text-[11px] font-bold text-emerald-900">Envío {pesos(1200)}</p>
            </>
          ) : (
            <>
              <p className="flex items-center gap-1 text-[11px] font-bold text-rose-800">
                <X size={13} strokeWidth={3} />
                Fuera de zona
              </p>
              <p className="mt-1 text-[10px] leading-snug text-rose-900/80">
                No puede pedir delivery: puede elegir retirar en el local.
              </p>
            </>
          )}
        </div>
      </div>
    </Escena>
  )
}
