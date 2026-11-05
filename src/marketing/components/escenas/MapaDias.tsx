import { Send } from "lucide-react";
import { cn } from "../ui";
import { Escena, type PropsEscena } from "./Escena";
import { d } from "./animacion";
import { FRANJAS_EJEMPLO, SEMANA_EJEMPLO } from "./ejemplo";

const MAX = Math.max(...SEMANA_EJEMPLO.flatMap((dia) => dia.franjas));
const X = 58;
const COL = 76;
const GAP = 6;
const Y = 38;
const FILA = 36;
// El hueco más grande: el martes a la noche, contra el promedio de las noches abiertas.
const FLOJO = { fila: 1, columna: 2 };
const abiertos = SEMANA_EJEMPLO.filter((dia) => dia.abierto);
const PROMEDIO_NOCHE =
  abiertos.reduce((t, dia) => t + dia.franjas[2], 0) / abiertos.length;
const FALTAN = Math.ceil(
  PROMEDIO_NOCHE - SEMANA_EJEMPLO[FLOJO.fila].franjas[FLOJO.columna],
);

export function MapaDias({ siempreActiva }: PropsEscena) {
  const izquierda = X + FLOJO.columna * (COL + GAP);
  const arriba = Y + FLOJO.fila * FILA;
  return (
    <Escena
      ancho={460}
      alto={320}
      etiqueta={`Mapa de la semana: pedidos promedio por día y franja. El lunes está cerrado y el martes a la noche es el hueco más grande: le faltan ${FALTAN} pedidos para el promedio.`}
      siempreActiva={siempreActiva}
    >
      {FRANJAS_EJEMPLO.map((f, c) => (
        <p
          key={f}
          className="e-aparece absolute text-center text-[11px] font-semibold text-ink-3"
          style={{ left: X + c * (COL + GAP), width: COL, top: 14 }}
        >
          {f}
        </p>
      ))}
      {SEMANA_EJEMPLO.map((dia, r) => (
        <div key={dia.dia}>
          <p
            className="e-aparece absolute text-[11.5px] font-semibold text-ink-2"
            style={{ left: 18, top: Y + r * FILA + 7 }}
          >
            {dia.dia}
          </p>
          {dia.franjas.map((v, c) => (
            <span
              key={c}
              className={cn(
                "e-pop absolute grid h-[30px] place-items-center rounded-lg text-[11.5px] font-semibold tabular-nums",
                dia.abierto ? "text-ink" : "closed text-[10px] text-ink-3",
              )}
              style={{
                left: X + c * (COL + GAP),
                top: Y + r * FILA,
                width: COL,
                backgroundColor: dia.abierto
                  ? `rgba(255,122,0,${0.09 + (0.65 * v) / MAX})`
                  : undefined,
                ...d(120 + (r + c) * 55),
              }}
            >
              {dia.abierto ? v.toFixed(1).replace(".", ",") : "Cerrado"}
            </span>
          ))}
        </div>
      ))}

      <span
        className="pointer-events-none absolute rounded-lg ring-2 ring-ink"
        style={{ left: izquierda, top: arriba, width: COL, height: 30 }}
      />
      <span
        className="e-latido pointer-events-none absolute rounded-lg"
        style={{ left: izquierda, top: arriba, width: COL, height: 30, ...d(1300) }}
      />
      <svg
        className="absolute inset-0"
        width={460}
        height={320}
        viewBox="0 0 460 320"
        fill="none"
        aria-hidden
      >
        <path
          d={`M ${izquierda + COL + 3} ${arriba + 15} L 316 ${arriba + 15}`}
          stroke="#191512"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeDasharray="3 4"
          className="e-aparece"
          style={d(1000)}
        />
      </svg>

      <div
        className="e-derecha e-tarjeta absolute left-[318px] top-[40px] w-[128px] p-3"
        style={d(1000)}
      >
        <p className="text-[9.5px] font-semibold uppercase tracking-[.08em] text-brand-deep">
          El más flojo
        </p>
        <p className="mt-1 text-[14px] font-bold leading-tight text-ink">
          Martes · Noche
        </p>
        <p className="mt-1.5 text-[11px] leading-snug text-ink-2">
          Le faltan {FALTAN} pedidos para el promedio
        </p>
        <span className="mt-2.5 flex h-7 items-center justify-center gap-1.5 rounded-full bg-ink text-[11px] font-semibold text-white">
          <Send size={11} />
          Invitar a 34
        </span>
        <span className="mt-1.5 flex h-7 items-center justify-center rounded-full text-[11px] font-semibold text-ink ring-1 ring-[#ECE4D8]">
          Link del día
        </span>
      </div>

      <p
        className="e-aparece absolute left-[18px] top-[296px] text-[10.5px] text-ink-3"
        style={d(1500)}
      >
        Pedidos promedio de las últimas 8 semanas · más naranja, más movimiento
      </p>
    </Escena>
  );
}
