import { ExternalLink } from "lucide-react";
import type { MensajeTanda } from "../../lib/tandas";

/** Partes de un texto de WhatsApp: los links se acortan como los muestra el celular. */
function conLinks(texto: string) {
  return texto.split(/(https?:\/\/[^\s]+)/g).map((parte, i) =>
    /^https?:\/\//.test(parte) ? (
      <span key={i} className="text-[#027EB5] underline decoration-[#027EB5]/40 [overflow-wrap:anywhere]">
        {parte.length > 52 ? `${parte.slice(0, 49)}…` : parte}
      </span>
    ) : (
      parte
    ),
  );
}

/**
 * Lo que recibe el cliente, en un celular: con la API de Meta, la plantilla con la foto y el botón;
 * en modo manual, el texto con el link tal como sale del WhatsApp del local.
 */
export function VistaPrevia({ mensaje, local, api }: { mensaje: MensajeTanda; local: string; api: boolean }) {
  const hora = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" }).format(new Date());
  const plantilla = api ? mensaje.plantilla : null;
  return (
    <div className="tanda-celular" aria-label={`Así le llega el mensaje a ${mensaje.clienteNombre}`}>
      <div className="tanda-celular-barra">
        <span className="grid size-8 place-items-center rounded-full bg-white/20 text-xs font-bold">
          {local.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold leading-tight">{local}</p>
          <p className="text-[11px] text-white/70">{api ? "Cuenta de empresa" : "en línea"}</p>
        </div>
      </div>
      <div className="tanda-celular-chat">
        <div className="tanda-celular-burbuja">
          {plantilla?.imagenUrl && (
            <img src={plantilla.imagenUrl} alt="" className="mb-1.5 aspect-[1.91/1] w-full rounded-md object-cover" />
          )}
          <p className="whitespace-pre-line">{conLinks(plantilla ? plantilla.cuerpo : mensaje.texto)}</p>
          <p className="mt-1 text-right text-[10px] text-[#667781]">{hora}</p>
          {plantilla && (
            <p className="-mx-2 mt-1.5 flex items-center justify-center gap-1.5 border-t border-black/10 pt-2 text-[13px] font-medium text-[#027EB5]">
              <ExternalLink size={14} />
              {plantilla.boton}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
