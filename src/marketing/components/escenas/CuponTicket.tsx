import { Percent } from "lucide-react";
import { pesos } from "../../lib/formato";
import { Escena, type PropsEscena } from "./Escena";
import { d, useContador } from "./animacion";

// Un ticket con el talón a la derecha: muescas arriba y abajo a la altura del corte.
const TICKET =
  "M16 0 H152 A12 12 0 0 0 176 0 H220 A16 16 0 0 1 236 16 V136 A16 16 0 0 1 220 152 H176 A12 12 0 0 0 152 152 H16 A16 16 0 0 1 0 136 V16 A16 16 0 0 1 16 0 Z";
const USOS = 23;
const LIMITE = 100;

export function CuponTicket({ siempreActiva }: PropsEscena) {
  const ventas = useContador(310500, 1400, 900);
  return (
    <Escena
      ancho={460}
      alto={250}
      etiqueta="El cupón MARTES con 15 % de descuento, compra mínima y vencimiento. Al lado, sus resultados: 23 usos de 100, 18 clientes y las ventas cobradas de esos pedidos."
      siempreActiva={siempreActiva}
    >
      <div className="e-pop absolute left-[20px] top-[46px] h-[152px] w-[236px] rotate-[-2deg]" style={d(100)}>
        <svg
          className="absolute inset-0 drop-shadow-[0_14px_22px_rgb(40_24_8/.18)]"
          width={236}
          height={152}
          viewBox="0 0 236 152"
          aria-hidden
        >
          <path d={TICKET} fill="#fff" stroke="#ECE4D8" />
          <path d="M164 16 V136" stroke="#ECE4D8" strokeWidth={1.5} strokeDasharray="4 4" />
        </svg>
        <div className="absolute left-[18px] top-[16px] w-[136px]">
          <p className="text-[9.5px] font-semibold uppercase tracking-[.1em] text-ink-3">Cupón</p>
          <p className="mt-1 font-mono text-[25px] font-bold leading-none tracking-wide text-ink">
            MARTES
          </p>
          <p className="mt-2 text-[17px] font-bold text-brand-deep">15% OFF</p>
          <p className="mt-2 text-[10px] leading-snug text-ink-3">
            Compra mínima {pesos(10000)}
            <br />
            Hasta el 31/10 · {LIMITE} usos
          </p>
        </div>
        <span className="absolute left-[184px] top-[56px] grid size-10 place-items-center rounded-full bg-brand-soft text-brand-deep">
          <Percent size={18} strokeWidth={2.6} />
        </span>
      </div>

      <div className="e-derecha e-tarjeta absolute left-[278px] top-[26px] w-[164px] p-4" style={d(500)}>
        <p className="text-[10px] font-semibold uppercase tracking-[.08em] text-ink-3">Resultados</p>
        <div className="mt-3 flex items-baseline justify-between">
          <span className="text-[11.5px] text-ink-2">Usos</span>
          <span className="text-[13px] font-bold tabular-nums text-ink">
            {USOS} de {LIMITE}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-[#ECE4D8]">
          <div
            className="e-barra h-full rounded-full bg-brand"
            style={{ width: `${(USOS / LIMITE) * 100}%`, ...d(900) }}
          />
        </div>
        <div className="mt-3 flex items-baseline justify-between">
          <span className="text-[11.5px] text-ink-2">Clientes</span>
          <span className="text-[13px] font-bold tabular-nums text-ink">18</span>
        </div>
        <div className="mt-3 border-t border-[#ECE4D8] pt-3">
          <p className="text-[11.5px] text-ink-2">Ventas cobradas</p>
          <p className="mt-0.5 text-[20px] font-bold tabular-nums tracking-tight text-ink">
            {pesos(ventas)}
          </p>
        </div>
      </div>
    </Escena>
  );
}
