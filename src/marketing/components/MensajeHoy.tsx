import { useState } from "react";
import { Dialog, DropdownMenu } from "radix-ui";
import { Check, Copy, Eye, MessageCircle, MoreHorizontal, Pencil, X, XCircle } from "lucide-react";
import { Burbuja, Button, copiar } from "./ui";
import { pesos, segmentoNombre } from "../lib/formato";
import type { MensajeColaData } from "../lib/tipos";
import { PortalMarketing, PortalMenuMarketing } from "./portal";

/** Una fila de Hoy, con acciones independientes del diálogo de detalle. */
export function MensajeHoy({
  mensaje, ultimoPedidoAt, cadenciaDias = null, totalGastado, ranking, tiene, puede, motivo, busy, elegido, onCambiar, onMarcar, onDescartar,
}: {
  mensaje: MensajeColaData;
  ultimoPedidoAt: string | null;
  /** Su ritmo habitual en días; sin ritmo (un solo pedido) no se muestra cuánto se pasó. */
  cadenciaDias?: number | null;
  totalGastado?: number;
  /** Posición entre los mejores clientes para escribirle hoy; sin valor, es una fila común. */
  ranking?: number;
  tiene: boolean | null;
  puede: boolean;
  motivo: string | null;
  busy: boolean;
  elegido: boolean;
  onCambiar?: () => void;
  onMarcar: () => Promise<void>;
  /** Saca este mensaje de la lista de hoy sin mandarlo. */
  onDescartar: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ultimoPedidoMs = ultimoPedidoAt ? Date.parse(ultimoPedidoAt) : NaN;
  const diasDesdeUltimo = Math.max(0, Math.floor((Date.now() - ultimoPedidoMs) / 86400000));
  const ultimoPedido = Number.isFinite(diasDesdeUltimo)
    ? diasDesdeUltimo === 0 ? "Último pedido hoy" : `Último pedido hace ${diasDesdeUltimo} ${diasDesdeUltimo === 1 ? "día" : "días"}`
    : mensaje.tiempoSinPedir ? `Último pedido hace ${mensaje.tiempoSinPedir}` : "Último pedido sin fecha registrada";
  // Cuántos días se pasó de su ritmo habitual, contados hasta hoy.
  const ritmo = cadenciaDias && Number.isFinite(ultimoPedidoMs)
    ? diasDesdeUltimo > cadenciaDias
      ? `Se pasó ${diasDesdeUltimo - cadenciaDias} ${diasDesdeUltimo - cadenciaDias === 1 ? "día" : "días"} de su ritmo · pide cada ~${cadenciaDias}`
      : `En su ritmo · pide cada ~${cadenciaDias} días`
    : null;
  const detalle = mensaje.tipoMensaje === "dia_flojo" ? `${segmentoNombre[mensaje.segmentoCliente ?? ""] ?? "Cliente habitual"} · Invitación sin descuento` : `${segmentoNombre[mensaje.segmento]}${mensaje.toque > 1 ? " · Recordatorio" : ""}`;
  const descuento = mensaje.beneficioTipo === "puntos"
    ? mensaje.puntos > 0
      ? `+${mensaje.puntos} puntos${mensaje.puntosCompraMinima ? ` desde $${mensaje.puntosCompraMinima.toLocaleString("es-AR")}` : ""}`
      : "Sin beneficio"
    : mensaje.beneficioTipo === "usar_puntos"
      ? mensaje.puntosSaldo > 0
        ? `Recordar sus ${mensaje.puntosSaldo} puntos${mensaje.puntosPremio && !mensaje.puntosFaltan ? ` para ${mensaje.puntosPremio}` : ""}`
        : "Empezar a sumar puntos"
      : mensaje.descuento
        ? `${mensaje.descuento}% de descuento`
        : "Sin descuento";
  const aviso = tiene === null
    ? "Elegí arriba dónde está el WhatsApp del local."
    : tiene === true || !puede ? motivo : null;
  const abrirWhatsapp = tiene === true && puede && mensaje.waMeUrl;
  const item = "flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-sand";
  function acciones() {
    return (
      <>
        {abrirWhatsapp ? (
          <a className="btn min-h-10 flex-1 whitespace-nowrap px-4 text-sm" href={mensaje.waMeUrl!} target="_blank" rel="noreferrer">
            <MessageCircle size={16} />Abrir WhatsApp
          </a>
        ) : (
          <Button type="button" variant="secondary" className="min-h-10 flex-1 whitespace-nowrap px-4 text-sm" onClick={() => copiar(mensaje.texto)}>
            <Copy size={16} />Copiar mensaje
          </Button>
        )}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button type="button" variant="ghost" className="size-10 min-h-10 shrink-0 px-0" aria-label={`Más opciones para ${mensaje.clienteNombre}`}>
              <MoreHorizontal size={18} />
            </Button>
          </DropdownMenu.Trigger>
          <PortalMenuMarketing>
            <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-56 rounded-2xl bg-surface p-1.5 shadow-xl ring-1 ring-line">
              <DropdownMenu.Item className={item} onSelect={() => setOpen(true)}><Eye size={16} />Ver mensaje</DropdownMenu.Item>
              {abrirWhatsapp && <DropdownMenu.Item className={item} onSelect={() => copiar(mensaje.texto)}><Copy size={16} />Copiar mensaje</DropdownMenu.Item>}
              {tiene === true && <DropdownMenu.Item className={item} disabled={busy || !puede} onSelect={() => void onMarcar()}><Check size={16} />Marcar enviado</DropdownMenu.Item>}
              {onCambiar && <DropdownMenu.Item className={item} onSelect={() => { setOpen(false); onCambiar(); }}><Pencil size={16} />Cambiar mensaje</DropdownMenu.Item>}
              <DropdownMenu.Separator className="my-1 h-px bg-line" />
              <DropdownMenu.Item className={`${item} text-rose-700`} onSelect={onDescartar}><XCircle size={16} />No mandar hoy</DropdownMenu.Item>
            </DropdownMenu.Content>
          </PortalMenuMarketing>
        </DropdownMenu.Root>
      </>
    );
  }
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <li className="min-w-0 cursor-pointer p-4 transition-colors hover:bg-sand/50 sm:px-5" onClick={() => setOpen(true)}>
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <Dialog.Trigger asChild>
            <button type="button" className="flex min-h-10 min-w-0 flex-[999_1_16rem] items-center gap-3 rounded-xl text-left" aria-label={`Ver mensaje para ${mensaje.clienteNombre}`}>
              {ranking !== undefined && <span aria-label={`Número ${ranking}`} className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand-deep">{ranking}</span>}
              <span className="min-w-0">
                <span className="block font-semibold break-words">{mensaje.clienteNombre}</span>
                <span className="block text-xs font-normal text-ink-3">{detalle} · {ultimoPedido}{totalGastado ? ` · Gastó ${pesos(totalGastado)}` : ""}</span>
                {ritmo && <span className="mt-0.5 block text-xs font-semibold text-brand-deep">{ritmo}</span>}
              </span>
            </button>
          </Dialog.Trigger>
          <div className="flex flex-1 items-center gap-1 sm:gap-2" onClick={(event) => event.stopPropagation()}>
            {acciones()}
          </div>
        </div>
        <p className={`mt-1 truncate text-xs leading-4 text-ink-3 ${ranking !== undefined ? "sm:pl-10" : ""}`}>{mensaje.texto}</p>
        {mensaje.horarioSugerido && (
          <p className={`mt-1 text-xs text-ink-3 ${ranking !== undefined ? "sm:pl-10" : ""}`}>Recomendado: {mensaje.horarioSugerido}. Podés mandarlo cuando prefieras.</p>
        )}
      </li>
      <PortalMarketing>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content aria-describedby={undefined} className="fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[calc(100%-32px)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl bg-surface p-5 shadow-xl sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Dialog.Title className="text-xl font-bold break-words">Mensaje para {mensaje.clienteNombre}</Dialog.Title>
              <p className="muted mt-1">{detalle}</p>
            </div>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" className="shrink-0 px-3" aria-label="Cerrar"><X size={20} /></Button>
            </Dialog.Close>
          </div>
          <dl className="mb-5 grid grid-cols-2 gap-4 text-sm">
            {[
              ["Celular", mensaje.telefono],
              ["Tiempo sin pedir", mensaje.tiempoSinPedir],
              ["Su ritmo", ritmo],
              ["Producto favorito", mensaje.productoFavorito],
              ["Beneficio", descuento],
              ["Horario sugerido", mensaje.horarioSugerido],
            ].filter(([, valor]) => valor).map(([titulo, valor]) => (
              <div key={titulo} className="min-w-0"><dt className="text-xs text-ink-3">{titulo}</dt><dd className="mt-1 font-medium break-words">{valor}</dd></div>
            ))}
          </dl>
          {mensaje.horarioSugerido && <p className="muted mb-4">El horario es una recomendación. Podés mandarlo cuando prefieras.</p>}
          <Burbuja texto={mensaje.texto} acortarLinks />
          {elegido && <p className="muted mt-3">Elegido por vos</p>}
          {aviso && <p className="muted mt-4">{aviso}</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            {abrirWhatsapp && <a className="btn" href={mensaje.waMeUrl!} target="_blank" rel="noreferrer"><MessageCircle size={16} />Abrir WhatsApp</a>}
            <Button type="button" variant="secondary" onClick={() => copiar(mensaje.texto)}><Copy size={16} />Copiar mensaje</Button>
            {tiene === true && <Button type="button" variant="secondary" disabled={busy || !puede} onClick={onMarcar}><Check size={16} />Marcar enviado</Button>}
            {onCambiar && <Button type="button" variant="ghost" onClick={() => { setOpen(false); onCambiar(); }}><Pencil size={16} />Cambiar mensaje</Button>}
          </div>
          {tiene === true && puede && <p className="mt-3 text-xs text-ink-3">Marcá enviado después de mandar el mensaje en WhatsApp.</p>}
        </Dialog.Content>
      </PortalMarketing>
    </Dialog.Root>
  );
}
