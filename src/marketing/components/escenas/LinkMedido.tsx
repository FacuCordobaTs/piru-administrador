import { Flame, Link2 } from "lucide-react";
import { pesos } from "../../lib/formato";
import { Escena, type PropsEscena } from "./Escena";
import { d, useContador } from "./animacion";
import { CAMPANAS_EJEMPLO, ORGANICO_EJEMPLO } from "./ejemplo";

// Del sticker de la historia a la fila de su campaña en el ranking.
const RUTA = "M 150 224 C 180 224, 172 96, 200 92";
const VIAJE = { "--ruta": `path("${RUTA}")`, "--t": "2.8s" };

export function LinkMedido({ siempreActiva }: PropsEscena) {
  const max = CAMPANAS_EJEMPLO[0].ventas;
  const ventas = useContador(max, 1400, 700);
  return (
    <Escena
      ancho={460}
      alto={330}
      etiqueta="Una historia de Instagram con el link «Pedí acá». El pedido que entra por ese link suma en el ranking de campañas, ordenado por ventas cobradas, con el orgánico como línea de base."
      siempreActiva={siempreActiva}
    >
      <div
        className="e-izquierda absolute left-[18px] top-[18px] h-[294px] w-[152px] overflow-hidden rounded-[26px] bg-[linear-gradient(165deg,#8a3448,#4a1a26_58%,#2a0f16)] text-white shadow-[0_24px_40px_-18px_rgb(40_10_15/.7)]"
        style={d(0)}
      >
        <div className="absolute inset-x-3 top-3 flex gap-1">
          <span className="h-[2.5px] flex-1 rounded-full bg-white" />
          <span className="h-[2.5px] flex-1 overflow-hidden rounded-full bg-white/35">
            <span className="block h-full w-3/5 bg-white" />
          </span>
          <span className="h-[2.5px] flex-1 rounded-full bg-white/35" />
        </div>
        <div className="absolute inset-x-3 top-[16px] flex items-center gap-1.5">
          <span className="grid size-6 place-items-center rounded-full bg-[#7A2E3F] ring-[1.5px] ring-white/90">
            <Flame size={12} strokeWidth={2.4} />
          </span>
          <span className="text-[10.5px] font-semibold">brasa.burgers</span>
          <span className="text-[10px] text-white/65">2 h</span>
        </div>
        <div className="absolute inset-x-0 top-[86px] flex flex-col items-center gap-1.5 px-3 text-center">
          <span className="rotate-[-3deg] rounded-[8px] bg-white px-2 py-1 text-[17px] font-black leading-none tracking-[-0.04em] text-[#7A2E3F]">
            MARTES DE SMASH
          </span>
          <span className="rotate-[-3deg] rounded-[6px] bg-[#F4EDE4] px-2 py-0.5 text-[11px] font-bold text-[#7A2E3F]">
            15% OFF · sólo hoy
          </span>
        </div>
        <div className="absolute inset-x-0 top-[192px] flex justify-center">
          <span className="relative flex rotate-[2deg] items-center gap-1.5 rounded-[10px] bg-white px-3 py-2 shadow-[0_10px_24px_rgb(0_0_0/.35)]">
            <span className="e-latido absolute inset-0 rounded-[10px]" />
            <Link2 size={14} className="text-[#3797F0]" strokeWidth={2.6} />
            <span className="text-[13px] font-extrabold uppercase tracking-tight text-[#3797F0]">
              Pedí acá
            </span>
          </span>
        </div>
        <div className="absolute inset-x-3 bottom-3 flex h-8 items-center rounded-full border border-white/55 px-3 text-[11px] text-white/85">
          Enviar mensaje
        </div>
      </div>

      <svg
        className="absolute inset-0"
        width={460}
        height={330}
        viewBox="0 0 460 330"
        fill="none"
        aria-hidden
      >
        <path
          d={RUTA}
          stroke="#FF7A00"
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.6}
          className="e-hormigas"
        />
      </svg>
      <span
        className="e-viaja absolute left-0 top-0 size-3 rounded-full bg-brand shadow-[0_0_0_5px_rgb(255_122_0/.22)]"
        style={d(1100, VIAJE)}
      />

      <div
        className="e-derecha e-tarjeta absolute left-[196px] top-[22px] w-[248px] p-4"
        style={d(250)}
      >
        <div className="flex items-center justify-between">
          <p className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-ink-3">
            Campañas · 30 días
          </p>
          <p className="text-[10.5px] text-ink-3">Ventas cobradas</p>
        </div>
        {CAMPANAS_EJEMPLO.map((c, i) => (
          <div key={c.nombre} className="relative mt-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-[12.5px] font-semibold text-ink">
                {c.nombre}
              </p>
              <p className="shrink-0 text-[12.5px] font-bold tabular-nums text-ink">
                {pesos(i === 0 ? ventas : c.ventas)}
              </p>
            </div>
            <div className="mt-1.5 h-[7px] rounded-full bg-[#F6F0E6]">
              <div
                className="e-barra h-full rounded-full bg-brand"
                style={{
                  width: `${(c.ventas / max) * 100}%`,
                  ...d(550 + i * 160),
                }}
              />
            </div>
            <p className="mt-1 text-[10.5px] text-ink-3">
              {c.canal} · {c.pedidos} pedidos
            </p>
            {i === 0 && (
              <span
                className="e-llega absolute bottom-[-2px] right-0 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm"
                style={d(1100, VIAJE)}
              >
                +1 pedido
              </span>
            )}
          </div>
        ))}
        <div
          className="e-aparece mt-3.5 flex items-baseline justify-between gap-2 border-t border-dashed border-line pt-3"
          style={d(1150)}
        >
          <div>
            <p className="text-[12px] font-semibold text-ink-2">
              Orgánico · sin campaña
            </p>
            <p className="text-[10.5px] text-ink-3">Tu línea de base</p>
          </div>
          <p className="text-[12.5px] font-bold tabular-nums text-ink-2">
            {pesos(ORGANICO_EJEMPLO.ventas)}
          </p>
        </div>
      </div>
    </Escena>
  );
}
