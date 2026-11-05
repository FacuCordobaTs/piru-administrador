import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import { Burbuja, Button, CopyButton } from "./ui";
import { segmentoNombre } from "../lib/formato";
import type { HistorialRecompraItem, MensajeColaData } from "../lib/tipos";
import { PortalMarketing } from "./portal";
export type EnviadoHoy = HistorialRecompraItem & { texto?: string; mensaje?: MensajeColaData };
const hora = (fecha: string) => new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit" }).format(new Date(fecha));
export function MensajeEnviadoHoy({ enviado }: { enviado: EnviadoHoy }) {
  const invitacion = enviado.tipoMensaje === "dia_flojo";
  const texto = enviado.texto ?? enviado.mensaje?.texto;
  const beneficio = enviado.beneficioTipo === "puntos"
    ? (enviado.puntosOtorgados ?? 0) > 0 ? `+${enviado.puntosOtorgados} puntos extra` : "Sin beneficio"
    : enviado.beneficioTipo === "usar_puntos"
      ? "Mensaje del club de puntos"
      : enviado.descuentoEnviado != null
        ? enviado.descuentoEnviado ? `${enviado.descuentoEnviado}% de descuento` : "Sin descuento"
        : null;
  return (
    <Dialog.Root>
      <li>
        <Dialog.Trigger asChild>
          <button type="button" aria-label={`Ver mensaje enviado a ${enviado.clienteNombre}`} className="w-full rounded-xl px-4 py-3 text-left text-ink-3 hover:bg-sand/50 sm:px-5">
            <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-medium">{enviado.clienteNombre}</span>
              <span className="text-xs">{segmentoNombre[enviado.segmento]}{invitacion ? " · Invitación sin descuento" : ""}</span>
              {enviado.fechaHora && <time dateTime={enviado.fechaHora} className="ml-auto text-xs">{hora(enviado.fechaHora)}</time>}
            </span>
            {texto && <span className="mt-1 block w-1/2 truncate text-[11px] leading-4">{texto}</span>}
          </button>
        </Dialog.Trigger>
      </li>
      <PortalMarketing>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content aria-describedby={undefined} className="fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[calc(100%-32px)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl bg-surface p-5 shadow-xl sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Dialog.Title className="text-xl font-bold break-words">Mensaje enviado a {enviado.clienteNombre}</Dialog.Title>
              <p className="muted mt-1">Ya enviado · {segmentoNombre[enviado.segmento]}</p>
            </div>
            <Dialog.Close asChild><Button type="button" variant="ghost" className="shrink-0 px-3" aria-label="Cerrar"><X size={20} /></Button></Dialog.Close>
          </div>
          <dl className="mb-5 grid grid-cols-2 gap-4 text-sm">
            {[
              ["Celular", enviado.telefono],
              ["Mensaje", invitacion ? "Invitación de día flojo" : null],
              ["Beneficio", beneficio],
              ["Cupón", enviado.codigoDescuento],
              ["Enviado", enviado.fechaHora ? new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "short", timeStyle: "short" }).format(new Date(enviado.fechaHora)) : null],
              ["Envío", enviado.origenContacto === "automatico" ? "Automático" : "Manual"],
              ["Producto favorito", enviado.mensaje?.productoFavorito],
              ["Tiempo sin pedir", enviado.mensaje?.tiempoSinPedir],
            ].filter(([, valor]) => valor).map(([titulo, valor]) => <div key={titulo} className="min-w-0"><dt className="text-xs text-ink-3">{titulo}</dt><dd className="mt-1 font-medium break-words">{valor}</dd></div>)}
          </dl>
          {texto ? <><Burbuja texto={texto} acortarLinks /><div className="mt-5"><CopyButton value={texto} label="Copiar mensaje" /></div></> : <p className="muted">El historial de este envío no incluye el texto del mensaje.</p>}
        </Dialog.Content>
      </PortalMarketing>
    </Dialog.Root>
  );
}
