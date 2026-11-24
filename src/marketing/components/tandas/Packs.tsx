import { Check } from "lucide-react";
import { cn } from "../ui";
import { pesos } from "../../lib/formato";
import type { PackMensajes } from "../../lib/tandas";

/** Los packs de mensajes de marketing para elegir con un toque (precio total y por mensaje). */
export function Packs({
  packs,
  elegido,
  onElegir,
  necesarios,
}: {
  packs: PackMensajes[];
  elegido: number | null;
  onElegir: (pack: PackMensajes) => void;
  /** Cuántos mensajes hacen falta: el pack más chico que alcanza se marca como sugerido. */
  necesarios?: number;
}) {
  const sugerido = necesarios ? packs.find((p) => p.cantidad >= necesarios)?.id : undefined;
  return (
    <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Packs de mensajes de marketing">
      {packs.map((p) => {
        const activo = elegido === p.id;
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => onElegir(p)}
            className={cn("tanda-pack", activo && "tanda-pack--activo")}
          >
            {p.id === sugerido && <span className="tanda-pack-sugerido">Alcanza para esta tanda</span>}
            <span className="block text-[2rem] leading-none font-extrabold tracking-tight tabular-nums">{p.cantidad}</span>
            <span className="mt-1 block text-xs font-medium text-ink-3">mensajes</span>
            <span className="mt-4 block text-lg font-bold">{pesos(p.precio)}</span>
            <span className="block text-xs text-ink-3">{pesos(p.precio / Math.max(1, p.cantidad))} c/u</span>
            {activo && (
              <span className="absolute top-3 right-3 grid size-6 place-items-center rounded-full bg-ink text-white">
                <Check size={14} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
