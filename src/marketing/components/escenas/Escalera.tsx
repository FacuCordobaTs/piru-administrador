import { CircleCheck, Clock3 } from "lucide-react";
import { cn } from "../ui";
import { Escena, type PropsEscena } from "./Escena";
import { d, useSecuencia } from "./animacion";
import { CLIENTA } from "./ejemplo";

// La escalera de backend/src/lib/recetas-recompra.ts (ESCALERA): 0 %, 10 % y 20 % con 48 hs.
const ESCALONES = [
  { titulo: "El antojo", beneficio: "Sin descuento", x: 18, y: 200 },
  { titulo: "El recordatorio", beneficio: "10% OFF", x: 164, y: 140 },
  { titulo: "El último llamado", beneficio: "20% · 48 hs", x: 310, y: 80 },
];
const W = 132;

export function Escalera({ siempreActiva }: PropsEscena) {
  const n = useSecuencia(1700, 2);
  const actual = Math.min(n % 4, 2);
  const e = ESCALONES[actual];
  return (
    <Escena
      ancho={460}
      alto={300}
      etiqueta="La escalera de la recompra: el mensaje 1 sin descuento, el 2 con 10 % y el 3 con 20 % que vence en 48 horas. Entre uno y otro pasan al menos 48 horas, y si el cliente vuelve a pedir sale de la cola."
      siempreActiva={siempreActiva}
    >
      <div className="e-aparece absolute left-[18px] top-[14px] w-[270px]">
        <p className="text-[14px] font-semibold leading-snug text-ink">
          Si no vuelve, llega el siguiente
        </p>
        <p className="mt-1 text-[11.5px] leading-snug text-ink-3">
          Entre uno y otro, los días que elijas: nunca menos de 48 horas.
        </p>
      </div>

      <svg
        className="absolute inset-0"
        width={460}
        height={300}
        viewBox="0 0 460 300"
        fill="none"
        aria-hidden
      >
        <path
          d="M 96 198 C 96 176, 130 172, 162 176"
          stroke="#80776E"
          strokeWidth={1.6}
          strokeLinecap="round"
          className="e-hormigas"
        />
        <path
          d="M 242 138 C 242 116, 276 112, 308 116"
          stroke="#80776E"
          strokeWidth={1.6}
          strokeLinecap="round"
          className="e-hormigas"
        />
      </svg>
      {[
        { left: 64, top: 150 },
        { left: 210, top: 90 },
      ].map((p, i) => (
        <span
          key={p.left}
          className="e-pop absolute flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10.5px] font-semibold text-ink-2 shadow-[0_0_0_1px_#ECE4D8]"
          style={{ ...p, ...d(900 + i * 200) }}
        >
          <Clock3 size={11} />
          ≥ 48 hs
        </span>
      ))}

      {ESCALONES.map((esc, i) => (
        <div
          key={esc.titulo}
          className="e-sube e-tarjeta absolute p-3"
          style={{ left: esc.x, top: esc.y, width: W, ...d(200 + i * 200) }}
        >
          <span
            className="pointer-events-none absolute inset-0 rounded-[18px] ring-2 ring-brand transition-opacity duration-500"
            style={{ opacity: i === actual ? 1 : 0 }}
          />
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "grid size-5 place-items-center rounded-md text-[11px] font-bold transition-colors duration-500",
                i <= actual ? "bg-brand text-white" : "bg-[#F6F0E6] text-ink-2",
              )}
            >
              {i + 1}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[.07em] text-ink-3">
              Mensaje {i + 1}
            </span>
          </div>
          <p className="mt-1.5 text-[13px] font-semibold leading-tight text-ink">
            {esc.titulo}
          </p>
          <span
            className={cn(
              "mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold",
              i ? "bg-emerald-50 text-emerald-700" : "bg-[#F6F0E6] text-ink-2",
            )}
          >
            {esc.beneficio}
          </span>
        </div>
      ))}

      {/* La clienta sube un escalón por vez. */}
      <span
        className="e-pop absolute z-10 grid size-[30px] place-items-center rounded-full bg-ink text-[10.5px] font-bold text-white ring-[3px] ring-white shadow-[0_8px_16px_-6px_rgb(0_0_0/.45)] transition-[left,top] duration-700 ease-[cubic-bezier(.65,0,.35,1)]"
        style={{ left: e.x + W - 18, top: e.y - 14, ...d(800) }}
      >
        {CLIENTA.iniciales}
      </span>

      <div
        className="e-sube absolute left-[300px] top-[200px] w-[142px] rounded-2xl bg-emerald-50 p-3 ring-1 ring-emerald-600/20"
        style={d(1300)}
      >
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-emerald-800">
          <CircleCheck size={15} />
          ¿Volvió a pedir?
        </p>
        <p className="mt-1 text-[11px] leading-snug text-emerald-900/80">
          Sale de la cola y no recibe los que faltan.
        </p>
      </div>
    </Escena>
  );
}
