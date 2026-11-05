import { Check, CheckCheck, MessageCircle, Pointer, Smartphone } from "lucide-react";
import { cn } from "../ui";
import { Escena, type PropsEscena } from "./Escena";
import { d, useSecuencia } from "./animacion";
import { CLIENTA, LOCAL_EJEMPLO } from "./ejemplo";

const TEXTO = `¡Hola ${CLIENTA.corto}! 👋 Hace 3 semanas que no te vemos por ${LOCAL_EJEMPLO}. ¿Te tentás con tu Smash de siempre? Te dejamos tu pedido armado:`;
const LINK = "my.piru.app/brasa/c/lo-mismo?tk=v1.4c9e…";

/** El dedo que toca un botón: la onda se vuelve a disparar en cada fase (`key`). */
function Toque({ fase }: { fase: number }) {
  return (
    <>
      <span
        key={fase}
        className="e-onda pointer-events-none absolute left-1/2 top-1/2 -ml-5 -mt-5 size-10 rounded-full bg-white/70"
      />
      <Pointer
        size={22}
        strokeWidth={2}
        className="e-pop absolute -bottom-3 right-1 fill-white text-ink drop-shadow"
      />
    </>
  );
}

/**
 * Hoy, mensaje por mensaje: se abre el WhatsApp del local con el texto listo, se manda ahí y se
 * marca enviado en la app. Fases: 0 listo · 1 toca "Abrir WhatsApp" · 2 en WhatsApp, enviado ·
 * 3 toca "Marcar enviado" · 4 registrado.
 */
export function EnvioHoy({ siempreActiva }: PropsEscena) {
  const n = useSecuencia(1600, 4);
  const fase = n % 5;
  const enviado = fase >= 3;
  return (
    <Escena
      ancho={460}
      alto={340}
      etiqueta={`Hoy en la app: el mensaje para ${CLIENTA.corto} se abre en el WhatsApp del local con el texto listo, se manda desde ahí y después se marca como enviado.`}
      siempreActiva={siempreActiva}
    >
      <div className="e-sube e-tarjeta absolute left-[30px] top-[12px] w-[400px] p-4" style={d(0)}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[20px] font-bold leading-none tracking-tight text-ink">Hoy</p>
            <p className="mt-1 text-[11px] text-ink-3">{LOCAL_EJEMPLO} · martes</p>
          </div>
          <div className="w-[118px]">
            <p className="text-right text-[11px] font-semibold tabular-nums text-ink-2">
              {enviado ? 3 : 2} de 6 enviados
            </p>
            <div className="mt-1 h-[5px] overflow-hidden rounded-full bg-[#ECE4D8]">
              <div
                className="h-full rounded-full bg-emerald-500 transition-[width] duration-700"
                style={{ width: `${((enviado ? 3 : 2) / 6) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-[11.5px] text-emerald-900 ring-1 ring-emerald-600/15">
          <Smartphone size={15} className="text-emerald-700" />
          Este celular tiene el <b className="font-semibold">WhatsApp de {LOCAL_EJEMPLO}</b>
        </p>

        <div className="mt-3 flex items-center gap-2.5">
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-full text-[11.5px] font-bold transition-colors duration-500",
              enviado ? "bg-emerald-500/10 text-emerald-700" : "bg-[#F6F0E6] text-ink-2",
            )}
          >
            {CLIENTA.iniciales}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold leading-tight text-ink">{CLIENTA.nombre}</p>
            <p className="text-[11px] text-ink-3">Se está yendo · Mensaje 1 de 3</p>
          </div>
          {enviado ? (
            <span
              key="enviado"
              className="e-pop inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
            >
              <CheckCheck size={13} />
              Enviado
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-ink-3">Sin descuento</span>
          )}
        </div>

        <div className="mt-2.5 rounded-xl bg-[#EFEAE2] p-2.5">
          <div className="e-burbuja e-sube ml-auto max-w-[300px] px-2.5 py-2 text-[11.5px] leading-[1.4]" style={d(400)}>
            {TEXTO}
            <span className="mt-1 block truncate text-[#027EB5] underline decoration-[#027EB5]/40">
              {LINK}
            </span>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <span
            className={cn(
              "relative flex h-9 flex-1 items-center justify-center gap-2 rounded-full bg-[#1FAF55] text-[12.5px] font-semibold text-white transition-[scale] duration-200",
              fase === 1 && "scale-[.97]",
            )}
          >
            <MessageCircle size={15} />
            Abrir WhatsApp
            {fase === 1 && <Toque fase={n} />}
          </span>
          <span
            className={cn(
              "relative flex h-9 items-center gap-1.5 rounded-full px-4 text-[12.5px] font-semibold ring-1 transition-[scale,background-color,color] duration-300",
              enviado ? "bg-ink text-white ring-ink" : "text-ink ring-[#ECE4D8]",
              fase === 3 && "scale-[.97]",
            )}
          >
            <Check size={15} />
            Marcar enviado
            {fase === 3 && <Toque fase={n} />}
          </span>
        </div>

        {fase === 2 && (
          <div
            key={n}
            className="e-sube absolute inset-x-3 bottom-3 overflow-hidden rounded-[16px] bg-[#EFEAE2] shadow-[0_-12px_30px_-12px_rgb(0_0_0/.35)] ring-1 ring-black/5"
          >
            <div className="flex items-center gap-2 bg-[#0B6E5C] px-3 py-2 text-white">
              <span className="grid size-6 place-items-center rounded-full bg-white/20 text-[9.5px] font-bold">
                {CLIENTA.iniciales}
              </span>
              <p className="text-[12px] font-semibold">{CLIENTA.nombre}</p>
              <p className="ml-auto text-[10px] text-white/70">WhatsApp de {LOCAL_EJEMPLO}</p>
            </div>
            <div className="p-2.5">
              <div className="e-burbuja ml-auto max-w-[280px] px-2.5 py-1.5 text-[11px] leading-[1.35]">
                <span className="line-clamp-2">{TEXTO}</span>
                <span className="mt-0.5 flex items-center justify-end gap-1 text-[9.5px] text-[#667781]">
                  19:02
                  <CheckCheck size={12} className="e-pop text-[#53BDEB]" style={d(500)} />
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Escena>
  );
}
