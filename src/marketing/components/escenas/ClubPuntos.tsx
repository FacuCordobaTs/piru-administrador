import { BadgePercent, Check, Gift, Truck } from "lucide-react";
import { pesos } from "../../lib/formato";
import { cn } from "../ui";
import { Escena, type PropsEscena } from "./Escena";
import { d, useContador } from "./animacion";
import { CLIENTA, LOCAL_EJEMPLO } from "./ejemplo";

// Ejemplo con la regla por defecto del club: 1 punto cada $100 del pedido.
const PEDIDO = 13500;
const PESOS_POR_PUNTO = 100;
const ANTES = 729;
const SUMA = Math.floor(PEDIDO / PESOS_POR_PUNTO);
const TOPE = 1000;
const PREMIOS = [
  { Icono: Truck, nombre: "Envío gratis", puntos: 300 },
  { Icono: BadgePercent, nombre: "10% OFF", puntos: 500 },
  { Icono: Gift, nombre: "Smash gratis", puntos: 1000 },
];
const RUTA = "M 112 238 C 170 262, 250 168, 318 112";

export function ClubPuntos({ siempreActiva }: PropsEscena) {
  const saldo = useContador(ANTES + SUMA, 1300, 1700, ANTES);
  return (
    <Escena
      ancho={460}
      alto={300}
      etiqueta={`Un pedido cobrado de ${pesos(PEDIDO)} le suma ${SUMA} puntos a ${CLIENTA.corto}, que llega a ${ANTES + SUMA} puntos y ya puede canjear el envío gratis o el descuento; le faltan pocos para el producto gratis.`}
      siempreActiva={siempreActiva}
    >
      <div className="e-izquierda e-tarjeta absolute left-[18px] top-[28px] w-[178px] p-4" style={d(0)}>
        <p className="text-[13px] font-semibold text-ink">Pedido #1302</p>
        <p className="text-[11px] text-ink-3">{CLIENTA.nombre}</p>
        <div className="my-3 border-t border-dashed border-[#ECE4D8]" />
        <div className="flex justify-between gap-2 text-[11.5px] text-ink-2">
          <span>1 × Smash doble</span>
          <span className="tabular-nums">{pesos(PEDIDO)}</span>
        </div>
        <div className="my-3 border-t border-dashed border-[#ECE4D8]" />
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] font-semibold text-ink">Total</span>
          <span className="text-[15px] font-bold tabular-nums text-ink">{pesos(PEDIDO)}</span>
        </div>
        <span
          className="e-pop mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700"
          style={d(500)}
        >
          <Check size={11} strokeWidth={3} />
          Cobrado
        </span>
        <p
          className="e-sube mt-3 rounded-xl bg-brand-soft px-2.5 py-2 text-[11.5px] font-semibold text-brand-deep"
          style={d(800)}
        >
          Suma +{SUMA} puntos
        </p>
      </div>

      <span
        className="e-vuela absolute left-0 top-0 rounded-full bg-brand px-2.5 py-1 text-[11.5px] font-bold text-white shadow-[0_8px_18px_-6px_rgb(255_122_0/.8)]"
        style={d(1050, { "--ruta": `path("${RUTA}")` })}
      >
        +{SUMA}
      </span>

      <div className="e-derecha e-tarjeta absolute left-[216px] top-[28px] w-[226px] p-4" style={d(300)}>
        <p className="text-[10px] font-semibold uppercase tracking-[.08em] text-ink-3">
          Club {LOCAL_EJEMPLO}
        </p>
        <p className="text-[12.5px] font-semibold text-ink">{CLIENTA.nombre}</p>
        <p className="mt-2 flex items-baseline gap-1.5">
          <span className="text-[34px] font-bold leading-none tracking-tight tabular-nums text-ink">
            {saldo.toLocaleString("es-AR")}
          </span>
          <span className="text-[12px] font-medium text-ink-3">puntos</span>
        </p>
        <div className="relative mt-3 h-2 rounded-full bg-[#ECE4D8]/80">
          <div
            className="h-full rounded-full bg-brand"
            style={{ width: `${(saldo / TOPE) * 100}%` }}
          />
          {PREMIOS.slice(0, 2).map((p) => (
            <span
              key={p.puntos}
              className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white ring-2 ring-brand-deep"
              style={{ left: `${(p.puntos / TOPE) * 100}%` }}
            />
          ))}
        </div>
        <div className="mt-3.5 grid gap-2">
          {PREMIOS.map((p, i) => {
            const alcanzado = saldo >= p.puntos;
            return (
              <div
                key={p.nombre}
                className="e-sube flex items-center gap-2 text-[11.5px]"
                style={d(600 + i * 120)}
              >
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded-lg transition-colors duration-500",
                    alcanzado ? "bg-brand-soft text-brand-deep" : "bg-[#F6F0E6] text-ink-3",
                  )}
                >
                  <p.Icono size={13} />
                </span>
                <span className="flex-1 font-medium text-ink">{p.nombre}</span>
                {alcanzado ? (
                  <span className="flex items-center gap-1 font-semibold text-emerald-700">
                    <Check size={12} strokeWidth={3} />
                    {p.puntos.toLocaleString("es-AR")}
                  </span>
                ) : (
                  <span className="tabular-nums text-ink-3">
                    faltan {(p.puntos - saldo).toLocaleString("es-AR")}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p
        className="e-aparece absolute left-[18px] top-[272px] text-[10.5px] text-ink-3"
        style={d(1400)}
      >
        Ejemplo: 1 punto cada {pesos(PESOS_POR_PUNTO)} · se acreditan cuando el pedido se cobra
      </p>
    </Escena>
  );
}
