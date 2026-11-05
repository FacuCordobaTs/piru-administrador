import { Clapperboard, Link2, MessageCircle, Repeat2, Store, Users } from "lucide-react";
import { cn } from "../ui";
import { Escena, type PropsEscena } from "./Escena";
import { d, useSecuencia } from "./animacion";

// El circuito es un anillo: el mensaje de recompra lleva un link, que vuelve a abrir la tienda.
const CX = 230;
const CY = 190;
const R = 116;
const PERIMETRO = 2 * Math.PI * R;
const NODOS = [
  { Icono: Link2, nombre: "Link", texto: "Cada historia, anuncio o QR lleva su propio link.", derecha: true },
  { Icono: Store, nombre: "Tienda", texto: "El cliente pide en un minuto, sin descargar nada.", derecha: true },
  { Icono: MessageCircle, nombre: "Pedido", texto: "Llega escrito al WhatsApp del local.", derecha: true },
  { Icono: Users, nombre: "Cliente", texto: "Queda en la base: qué pide y cada cuánto.", derecha: false },
  { Icono: Repeat2, nombre: "Recompra", texto: "Si deja de pedir, un mensaje con su link lo trae de vuelta.", derecha: false },
];
const posicion = (i: number) => {
  const a = ((-90 + (i * 360) / NODOS.length) * Math.PI) / 180;
  return { x: CX + R * Math.cos(a), y: CY + R * Math.sin(a) };
};

export function Circuito({ siempreActiva }: PropsEscena) {
  const n = useSecuencia(2600);
  const fase = n % NODOS.length;
  const actual = NODOS[fase];
  return (
    <Escena
      ancho={460}
      alto={340}
      etiqueta="El circuito de Piru: un link lleva a la tienda, el pedido llega al WhatsApp del local, el cliente queda en la base y la recompra lo trae de vuelta con otro link."
      siempreActiva={siempreActiva}
    >
      <svg
        className="absolute inset-0"
        width={460}
        height={340}
        viewBox="0 0 460 340"
        fill="none"
        aria-hidden
      >
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
            transition: fase
              ? "stroke-dashoffset .9s cubic-bezier(.65,0,.35,1)"
              : "none",
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
            transition: "transform .9s cubic-bezier(.65,0,.35,1)",
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
        <Clapperboard size={14} className="text-brand" strokeWidth={2.2} />
        Historias · reels · QR
      </div>

      {NODOS.map((nodo, i) => {
        const { x, y } = posicion(i);
        const activo = i === fase;
        const visto = i < fase;
        return (
          <div
            key={nodo.nombre}
            className="absolute"
            style={{ left: x - 28, top: y - 28, width: 56, height: 56 }}
          >
            <div className="e-pop" style={d(150 + i * 110)}>
              <div
                className={cn(
                  "grid size-14 place-items-center rounded-full ring-1 transition-[background-color,color,scale,box-shadow] duration-500",
                  activo
                    ? "scale-110 bg-brand text-white ring-brand shadow-[0_12px_26px_-8px_rgb(255_122_0/.75)]"
                    : visto
                      ? "bg-white text-brand-deep ring-brand/40"
                      : "bg-white text-ink-2 ring-line shadow-[0_8px_18px_-12px_rgb(40_24_8/.45)]",
                )}
              >
                <nodo.Icono size={22} strokeWidth={2.1} />
              </div>
            </div>
            <span
              className={cn(
                "e-aparece absolute top-[18px] whitespace-nowrap text-[13px] font-semibold transition-colors duration-500",
                activo ? "text-ink" : "text-ink-3",
              )}
              style={{
                ...d(400 + i * 110),
                ...(nodo.derecha ? { left: 66 } : { right: 66 }),
              }}
            >
              {nodo.nombre}
            </span>
          </div>
        );
      })}

      <div className="absolute left-[155px] top-[150px] w-[150px] text-center">
        <p
          key={`n${fase}`}
          className="e-aparece text-[11px] font-semibold uppercase tracking-[.08em] text-brand-deep"
        >
          {fase + 1} de {NODOS.length}
        </p>
        <p
          key={`t${fase}`}
          className="e-sube mt-1.5 text-[13.5px] font-medium leading-snug text-ink"
        >
          {actual.texto}
        </p>
      </div>
    </Escena>
  );
}
