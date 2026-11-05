import { MessageCircle } from "lucide-react";
import { Escena, type PropsEscena } from "./Escena";
import { d } from "./animacion";

const CONTROL = new Set([7, 16]);
const CON_MENSAJE = 23;
const SIN_MENSAJE = 6;
const ESCALA = 25;

export function GrupoControl({ siempreActiva }: PropsEscena) {
  return (
    <Escena
      ancho={460}
      alto={290}
      etiqueta="Una tanda de 20 clientes: 18 reciben el mensaje y 2 quedan como grupo de control, sin mensaje. De los que lo recibieron volvió el 23 %; del control, el 6 %. La diferencia es lo que trajo el mensaje."
      siempreActiva={siempreActiva}
    >
      <p className="e-aparece absolute left-[20px] top-[18px] text-[10.5px] font-semibold uppercase tracking-[.08em] text-ink-3">
        Una tanda de 20 clientes
      </p>
      <div className="absolute left-[20px] top-[44px] grid grid-cols-5 gap-[10px]">
        {Array.from({ length: 20 }, (_, i) =>
          CONTROL.has(i) ? (
            <span
              key={i}
              className="e-pop size-6 rounded-full border-[1.5px] border-dashed border-ink/35 bg-white"
              style={d(100 + i * 35)}
            />
          ) : (
            <span
              key={i}
              className="e-pop grid size-6 place-items-center rounded-full bg-brand-soft text-brand-deep ring-1 ring-brand/35"
              style={d(100 + i * 35)}
            >
              <MessageCircle size={11} strokeWidth={2.6} />
            </span>
          ),
        )}
      </div>
      <div
        className="e-sube absolute left-[20px] top-[190px] grid gap-1.5 text-[11.5px] text-ink-2"
        style={d(900)}
      >
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-brand-soft ring-1 ring-brand/35" />
          Reciben el mensaje · 18
        </span>
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-full border-[1.5px] border-dashed border-ink/35 bg-white" />
          Grupo de control · 2
        </span>
        <span className="pl-5 text-[10.5px] text-ink-3">no reciben nada</span>
      </div>

      <div className="absolute left-[214px] top-[18px] w-[228px]">
        <p className="e-aparece text-[10.5px] font-semibold uppercase tracking-[.08em] text-ink-3">
          Volvieron a pedir
        </p>
        {[
          { texto: "Con el mensaje", valor: CON_MENSAJE, clase: "bg-brand" },
          { texto: "Grupo de control", valor: SIN_MENSAJE, clase: "bg-ink/30" },
        ].map((b, i) => (
          <div key={b.texto} className="e-sube mt-4" style={d(700 + i * 200)}>
            <div className="flex items-baseline justify-between">
              <span className="text-[12.5px] font-medium text-ink-2">{b.texto}</span>
              <span className="text-[17px] font-bold tabular-nums text-ink">
                {b.valor}%
              </span>
            </div>
            <div className="mt-1.5 h-3 rounded-full bg-[#ECE4D8]/70">
              <div
                className={`e-barra h-full rounded-full ${b.clase}`}
                style={{ width: `${(b.valor / ESCALA) * 100}%`, ...d(1000 + i * 250) }}
              />
            </div>
          </div>
        ))}
        <div
          className="e-pop mt-5 rounded-2xl bg-emerald-50 p-3 ring-1 ring-emerald-600/20"
          style={d(1700)}
        >
          <p className="text-[19px] font-bold tabular-nums leading-none text-emerald-700">
            +{CON_MENSAJE - SIN_MENSAJE} puntos
          </p>
          <p className="mt-1.5 text-[11.5px] leading-snug text-emerald-900/80">
            Es lo que trajo el mensaje: los demás iban a volver igual.
          </p>
        </div>
      </div>
    </Escena>
  );
}
