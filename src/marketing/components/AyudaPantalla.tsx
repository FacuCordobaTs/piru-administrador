import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Dialog } from "radix-ui";
import { BookOpen, CircleQuestionMark, X } from "lucide-react";
import { useClaveRecorrido } from "../lib/recorridoVisto";
import {
  ayudaDePantalla,
  ayudaVista,
  marcarAyudaVista,
  type Pantalla,
} from "../lib/ayudaPantallas";
import { RecorridoMotor } from "./recorrido/RecorridoMotor";
import { GUIA } from "../lib/rutas";
import { PortalMarketing } from "./portal";

/**
 * El (?) del título de una pantalla: explica qué se hace ahí. Se abre solo la primera vez que
 * alguien entra a la pantalla y después cuando se lo toca. En Hoy, en lugar del resumen, abre el
 * recorrido animado del motor de recompra.
 */
export function AyudaPantalla({ pantalla }: { pantalla: Pantalla }) {
  const clave = useClaveRecorrido();
  const [abierta, setAbierta] = useState(false);
  useEffect(() => {
    if (clave && !ayudaVista(clave, pantalla)) setAbierta(true);
  }, [clave, pantalla]);
  const ayuda = ayudaDePantalla(pantalla);
  function cambiar(o: boolean) {
    setAbierta(o);
    if (!o && clave) marcarAyudaVista(clave, pantalla);
  }
  return (
    <Dialog.Root open={abierta} onOpenChange={cambiar}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Qué se hace en esta pantalla"
          title="Qué se hace en esta pantalla"
          className="grid size-8 shrink-0 place-items-center rounded-full text-ink-3 ring-1 ring-line hover:bg-sand hover:text-ink"
        >
          <CircleQuestionMark size={18} />
        </button>
      </Dialog.Trigger>
      {pantalla === "hoy" ? (
        <RecorridoMotor guia="motor" cerrar={() => cambiar(false)} />
      ) : (
        <PortalMarketing>
          <Dialog.Overlay className="fixed inset-0 z-[80] bg-ink/40 backdrop-blur-[3px]" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed top-1/2 left-1/2 z-[90] max-h-[90dvh] w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl bg-paper p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <Dialog.Title className="text-xl font-bold">{ayuda.titulo}</Dialog.Title>
              <Dialog.Close
                aria-label="Cerrar"
                className="-mt-1 -mr-2 grid size-10 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-sand"
              >
                <X size={20} />
              </Dialog.Close>
            </div>
            <p className="mt-3 text-ink-2">{ayuda.texto}</p>
            <ul className="mt-4 grid gap-2.5 text-sm">
              {ayuda.puntos.map((p) => (
                <li key={p} className="flex gap-2.5">
                  <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
                  {p}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <Link
                to={`${GUIA}#${ayuda.guia}`}
                onClick={() => cambiar(false)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 underline decoration-line underline-offset-4"
              >
                <BookOpen size={14} className="text-brand-deep" />
                Leer más en la guía
              </Link>
              <Dialog.Close className="btn">Entendido</Dialog.Close>
            </div>
          </Dialog.Content>
        </PortalMarketing>
      )}
    </Dialog.Root>
  );
}
