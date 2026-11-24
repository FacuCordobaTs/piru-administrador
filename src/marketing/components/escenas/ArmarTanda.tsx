import { CheckCheck, Sparkles } from "lucide-react";
import { cn } from "../ui";
import { Escena, type PropsEscena } from "./Escena";
import { d, useSecuencia } from "./animacion";
import { LOCAL_EJEMPLO } from "./ejemplo";

// Clientes inventados del local de ejemplo: no son datos de ningún local real.
const BASE = ["AR", "MG", "CL", "JP", "SB", "LF", "TD", "NV", "RP", "EM", "GS", "VC"];
const ELEGIDOS = [
  { i: 1, nombre: "Martina", pista: "Pide los viernes", texto: "¿Arrancamos el viernes con tu Smash de siempre? 😋", beneficio: "Sin descuento" },
  { i: 3, nombre: "Juan", pista: "Hace 40 días", texto: `Hace un mes que no pasás por ${LOCAL_EJEMPLO} y te extrañamos.`, beneficio: "15% · 48 hs" },
  { i: 6, nombre: "Tomás", pista: "1.er pedido", texto: "¿Qué tal estuvo la Doble bacon? La segunda sale mejor 😉", beneficio: "Envío gratis" },
  { i: 9, nombre: "Rocío", pista: "De las mejores", texto: "Con 12 pedidos ya sos de la casa. ¿Hoy lo de siempre?", beneficio: "+200 puntos" },
];

/**
 * Qué hace "Armar una tanda": de toda la base elige a los que conviene escribirles ahora, le arma a
 * cada uno un mensaje distinto con su historia y un beneficio a medida, y quedan listos para mandar.
 * Fases: 0 la base · 1 elige · 2 arma los mensajes · 3 enviados · 4 vuelven a pedir.
 */
export function ArmarTanda({ siempreActiva }: PropsEscena) {
  const n = useSecuencia(1700, 4);
  const fase = n % 5;
  const elegido = (i: number) => ELEGIDOS.some((e) => e.i === i);
  return (
    <Escena
      ancho={560}
      alto={330}
      etiqueta={`Una tanda: de todos los clientes de ${LOCAL_EJEMPLO} se eligen los que conviene contactar hoy, cada uno recibe un mensaje distinto con un beneficio a medida y se mandan desde el WhatsApp del local.`}
      siempreActiva={siempreActiva}
    >
      <div className="escenario absolute inset-0 rounded-[28px]" />

      {/* La base del local. */}
      <div className="absolute left-[26px] top-[34px] w-[178px]">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[.08em] text-ink-3">Tus clientes</p>
        <div className="grid grid-cols-3 gap-3">
          {BASE.map((ini, i) => {
            const sel = fase >= 1 && elegido(i);
            return (
              <span
                key={ini}
                className={cn(
                  "grid size-[46px] place-items-center rounded-full text-[12px] font-bold transition-all duration-500",
                  sel ? "scale-110 bg-ink text-white shadow-[0_8px_18px_-8px_rgb(25_21_18/.6)]" : "bg-white text-ink-2 ring-1 ring-[#ECE4D8]",
                  fase >= 1 && !elegido(i) && "opacity-35",
                )}
                style={{ transitionDelay: sel ? `${ELEGIDOS.findIndex((e) => e.i === i) * 120}ms` : "0ms" }}
              >
                {ini}
              </span>
            );
          })}
        </div>
        <p
          className={cn(
            "mt-4 flex items-center gap-1.5 text-[11.5px] font-semibold text-brand-deep transition-opacity duration-500",
            fase >= 1 ? "opacity-100" : "opacity-0",
          )}
        >
          <Sparkles size={14} />
          Los 4 que conviene hoy
        </p>
      </div>

      {/* Un mensaje distinto para cada uno. */}
      <ul className="absolute right-[22px] top-[22px] flex w-[318px] flex-col gap-2">
        {ELEGIDOS.map((e, k) => (
          <li
            key={`${e.nombre}-${fase >= 2 ? "si" : "no"}`}
            className={cn("e-tarjeta flex items-start gap-2.5 p-2.5", fase >= 2 ? "e-izquierda" : "opacity-0")}
            style={d(k * 160)}
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#F6F0E6] text-[10.5px] font-bold text-ink-2">
              {BASE[e.i]}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12px] font-semibold text-ink">
                  {e.nombre} <span className="font-normal text-ink-3">· {e.pista}</span>
                </p>
                {fase >= 3 ? (
                  <CheckCheck key={`ok-${n}`} size={15} className="e-pop shrink-0 text-[#53BDEB]" style={d(k * 220)} />
                ) : (
                  <span className="shrink-0 rounded-full bg-brand-soft px-1.5 py-px text-[9.5px] font-semibold text-brand-deep">
                    {e.beneficio}
                  </span>
                )}
              </div>
              <p className="e-burbuja mt-1 px-2 py-1 text-[10.5px] leading-[1.35]">{e.texto}</p>
            </div>
          </li>
        ))}
      </ul>

      {fase === 4 && (
        <p
          key={n}
          className="e-pop absolute bottom-[22px] left-[26px] flex items-center gap-2 rounded-full bg-emerald-600 px-3.5 py-2 text-[12px] font-semibold text-white shadow-lg"
        >
          <CheckCheck size={15} />3 volvieron a pedir esta semana
        </p>
      )}
    </Escena>
  );
}
