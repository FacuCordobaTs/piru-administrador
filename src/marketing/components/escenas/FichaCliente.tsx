import { Crown, Link2 } from "lucide-react";
import { pesos } from "../../lib/formato";
import { Escena, type PropsEscena } from "./Escena";
import { d } from "./animacion";
import { CLIENTA, LOCAL_EJEMPLO } from "./ejemplo";

// Del pedido en el chat a la ficha: el pedido número 7 de Martina.
const RUTA = "M 122 196 C 122 238, 156 240, 186 228";

export function FichaCliente({ siempreActiva }: PropsEscena) {
  const datos = [
    { titulo: "Pedidos", valor: String(CLIENTA.pedidos), mas: true },
    { titulo: "Gastó", valor: pesos(CLIENTA.gastado) },
    { titulo: "Pide cada", valor: `~${CLIENTA.cadencia} días` },
    { titulo: "Favorito", valor: CLIENTA.favorito },
  ];
  return (
    <Escena
      ancho={460}
      alto={336}
      etiqueta={`El pedido de ${CLIENTA.corto} llega al WhatsApp del local y actualiza su ficha: pedidos, gasto, cada cuánto pide, su producto favorito y por dónde llegó.`}
      siempreActiva={siempreActiva}
    >
      <div
        className="e-izquierda absolute left-[16px] top-[16px] w-[236px] overflow-hidden rounded-[18px] bg-[#EFEAE2] shadow-[0_0_0_1px_rgb(25_21_18/.06),0_18px_34px_-20px_rgb(40_24_8/.5)]"
        style={d(0)}
      >
        <div className="flex items-center gap-2 bg-[#0B6E5C] px-3 py-2 text-white">
          <span className="grid size-7 place-items-center rounded-full bg-white/20 text-[10.5px] font-bold">
            {CLIENTA.iniciales}
          </span>
          <div>
            <p className="text-[12.5px] font-semibold leading-tight">
              {CLIENTA.nombre}
            </p>
            <p className="text-[10px] text-white/70">
              WhatsApp de {LOCAL_EJEMPLO}
            </p>
          </div>
        </div>
        <div className="p-2.5">
          <div
            className="e-burbuja-entra e-sube max-w-[196px] px-2.5 py-2 text-[11.5px] leading-[1.38]"
            style={d(350)}
          >
            <p>¡Hola {LOCAL_EJEMPLO}! Te paso mi pedido:</p>
            <p className="mt-1 font-semibold">Pedido #1284 · Delivery</p>
            <p>1 × Smash burger doble</p>
            <p>1 × Papas con cheddar</p>
            <p className="mt-1">
              Total: <b>{pesos(26700)}</b>
            </p>
            <p className="text-right text-[9.5px] text-[#667781]">21:04</p>
          </div>
        </div>
      </div>

      <svg
        className="absolute inset-0"
        width={460}
        height={336}
        viewBox="0 0 460 336"
        fill="none"
        aria-hidden
      >
        <path
          d={RUTA}
          stroke="#FF7A00"
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.55}
          className="e-hormigas"
        />
      </svg>
      <span
        className="e-viaja absolute left-0 top-0 size-3 rounded-full bg-brand shadow-[0_0_0_5px_rgb(255_122_0/.22)]"
        style={d(900, { "--ruta": `path("${RUTA}")`, "--t": "3s" })}
      />

      <div
        className="e-derecha e-tarjeta absolute left-[184px] top-[100px] w-[264px] p-4"
        style={d(600)}
      >
        <span
          className="e-pop absolute -top-2.5 right-4 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-bold text-amber-700 ring-1 ring-amber-200"
          style={d(1700)}
        >
          <Crown size={11} strokeWidth={2.4} />
          VIP
        </span>
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-[13px] font-bold text-brand-deep">
            {CLIENTA.iniciales}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14.5px] font-semibold leading-tight text-ink">
              {CLIENTA.nombre}
            </p>
            <p className="text-[11px] text-ink-3">{CLIENTA.telefono}</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {datos.map((x, i) => (
            <div
              key={x.titulo}
              className="e-sube relative rounded-xl bg-[#F6F0E6] px-2.5 py-2"
              style={d(850 + i * 120)}
            >
              <p className="text-[9.5px] font-semibold uppercase tracking-[.07em] text-ink-3">
                {x.titulo}
              </p>
              <p className="mt-0.5 truncate text-[12.5px] font-bold tabular-nums text-ink">
                {x.valor}
              </p>
              {x.mas && (
                <span
                  className="e-pop absolute right-2 top-2 rounded-full bg-emerald-600 px-1.5 text-[10px] font-bold text-white"
                  style={d(1450)}
                >
                  +1
                </span>
              )}
            </div>
          ))}
        </div>
        <p
          className="e-aparece mt-3 flex items-center gap-1.5 text-[11.5px] text-ink-2"
          style={d(1450)}
        >
          <Link2 size={13} className="text-brand" strokeWidth={2.4} />
          Llegó por <b className="font-semibold text-ink">{CLIENTA.llego}</b>
        </p>
      </div>
    </Escena>
  );
}
