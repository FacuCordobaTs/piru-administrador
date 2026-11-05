import { useState } from "react";
import { Dialog } from "radix-ui";
import { ChevronDown, ChevronUp, ChevronsUpDown, X } from "lucide-react";
import { cn } from "./ui";
import { PortalMarketing } from "./portal";

export function SelectorDiaHoy({ dia, nombres, pendientes, onElegir }: {
  dia: number;
  nombres: string[];
  pendientes?: number[];
  onElegir: (dia: number) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState(dia);
  const mover = (delta: number) => setBorrador((actual) => Math.max(0, Math.min(6, actual + delta)));

  return (
    <nav aria-label="Calendario de mensajes" className="mb-5">
      <Dialog.Root open={abierto} onOpenChange={(open) => {
        if (open) setBorrador(dia);
        setAbierto(open);
      }}>
        <Dialog.Trigger asChild>
          <button type="button" aria-label={`Elegir día: ${nombres[dia]}`} className="flex items-center gap-1.5 rounded-xl px-2 py-1 -my-1 transition-colors hover:bg-sand cursor-pointer">
            <span className="text-2xl font-bold tracking-tight text-ink capitalize">{nombres[dia]}</span>
            <ChevronsUpDown className="h-5 w-5 text-ink-3" />
          </button>
        </Dialog.Trigger>
        <p className="muted mt-2 px-2">{pendientes?.[dia] ?? "…"} pendientes</p>
        <PortalMarketing>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-xs -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg bg-surface p-6 shadow-lg outline-none">
            <Dialog.Title className="text-center text-3xl font-bold leading-none">Elegí el día</Dialog.Title>
            <Dialog.Description className="sr-only">Se muestran solo los mensajes del día que elijas.</Dialog.Description>
            <Dialog.Close className="absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100" aria-label="Cerrar">
              <X className="h-4 w-4" />
            </Dialog.Close>
            <div className="flex flex-col items-center gap-3 py-2">
              <button type="button" onClick={() => mover(-1)} disabled={borrador === 0} aria-label="Día anterior" className="h-9 w-9 flex items-center justify-center rounded-full text-ink-3 hover:bg-sand hover:text-ink transition-colors disabled:opacity-30 disabled:pointer-events-none">
                <ChevronUp className="h-6 w-6" />
              </button>
              <div
                onWheel={(e) => {
                  e.preventDefault();
                  if (e.deltaY > 0) mover(1);
                  else if (e.deltaY < 0) mover(-1);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                    e.preventDefault();
                    mover(e.key === "ArrowUp" ? -1 : 1);
                  }
                }}
                className="relative w-full select-none overflow-hidden h-[13rem]"
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-surface to-transparent z-10" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface to-transparent z-10" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                  {[-2, -1, 0, 1, 2].map((offset) => {
                    const indice = borrador + offset;
                    const disabled = indice < 0 || indice > 6;
                    return (
                      <button key={offset} type="button" disabled={disabled} aria-pressed={offset === 0 && !disabled} onClick={() => setBorrador(indice)} className={cn(
                        "h-[2.6rem] w-full text-center leading-[2.6rem] capitalize transition-all duration-150",
                        disabled ? "opacity-0 pointer-events-none" : offset === 0 ? "text-3xl font-bold text-ink opacity-100" : Math.abs(offset) === 1 ? "text-xl font-semibold text-ink opacity-60" : "text-base font-medium text-ink opacity-25",
                        offset !== 0 && !disabled && "hover:opacity-90",
                      )}>
                        {disabled ? "" : nombres[indice]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button type="button" onClick={() => mover(1)} disabled={borrador === 6} aria-label="Día siguiente" className="h-9 w-9 flex items-center justify-center rounded-full text-ink-3 hover:bg-sand hover:text-ink transition-colors disabled:opacity-30 disabled:pointer-events-none">
                <ChevronDown className="h-6 w-6" />
              </button>
              <p className="muted tabular-nums">{pendientes?.[borrador] ?? "…"} pendientes</p>
              <button type="button" onClick={() => {
                onElegir(borrador);
                setAbierto(false);
              }} className="mt-2 h-11 px-10 rounded-full bg-black hover:bg-black/90 text-white font-semibold">Confirmar</button>
            </div>
          </Dialog.Content>
        </PortalMarketing>
      </Dialog.Root>
    </nav>
  );
}
