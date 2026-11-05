import { useEffect, useMemo, useState } from "react";
import { datosLocal, query } from "../lib/api";
import { segmentoNombre } from "../lib/formato";
import type {
  ColaRecompraItem,
  DecisionesRecompra,
  MensajeColaData,
  ModalidadLinkRecompra,
  SegmentoRecompra,
} from "../lib/tipos";
import { Burbuja, Button, Chip } from "./ui";
/**
 * Las tres decisiones de "Para mandar hoy": la voz (segmento), el toque y el link con su
 * descuento. La vista previa sale del mismo endpoint que el envío, así que muestra el texto y el
 * `%` exactos. El descuento sólo cuenta como elegido a mano si se toca: si no, manda la escalera.
 */
export function DecisionesMensaje({
  fila,
  mensaje,
  decisiones,
  onAplicar,
  onRestablecer,
}: {
  fila: ColaRecompraItem;
  mensaje: MensajeColaData;
  decisiones: DecisionesRecompra | undefined;
  onAplicar: (decisiones: DecisionesRecompra, vista: MensajeColaData) => void;
  onRestablecer: () => void;
}) {
  const opciones = mensaje.opciones;
  const segmentoVivo =
    opciones.segmentos.find((s) => s.esDelCliente)?.codigo ?? mensaje.segmento;
  const [segmento, setSegmento] = useState<SegmentoRecompra>(
    decisiones?.segmento ?? segmentoVivo,
  );
  const [toque, setToque] = useState(decisiones?.toque ?? mensaje.toque);
  const [link, setLink] = useState<ModalidadLinkRecompra>(
    decisiones?.link ?? mensaje.link,
  );
  const [descuento, setDescuento] = useState(
    decisiones?.descuento ?? opciones.descuentos.recomendado,
  );
  const [aMano, setAMano] = useState(decisiones?.descuento != null);
  const puntosOpcion = opciones.puntos;
  const [puntos, setPuntos] = useState(
    decisiones?.puntos ?? puntosOpcion?.sugerido ?? 0,
  );
  const [recordarPuntos, setRecordarPuntos] = useState(
    decisiones?.usarPuntos === true || mensaje.beneficioTipo === "usar_puntos",
  );
  const pedido = useMemo(() => {
    const d: DecisionesRecompra = { segmento, toque, link };
    if (recordarPuntos) {
      delete d.link;
      d.usarPuntos = true;
    } else if (link === "reactivacion" && aMano) {
      d.descuento = descuento;
    } else if (link === "puntos" && puntos > 0) {
      d.puntos = puntos;
    }
    return d;
  }, [segmento, toque, link, descuento, aMano, puntos, recordarPuntos]);
  const [vista, setVista] = useState<MensajeColaData | null>(null);
  const [cargando, setCargando] = useState(true);
  useEffect(() => {
    let vigente = true;
    setCargando(true);
    // Con espera, para no pedir una vista previa por tecla mientras se escribe el %.
    const timer = window.setTimeout(() => {
      datosLocal<MensajeColaData>(`/clientes/recompra/cola/${fila.id}/mensaje${query({ ...pedido })}`,
      )
        .then((m) => {
          if (vigente) setVista(m);
        })
        .catch(() => {
          if (vigente) setVista(null);
        })
        .finally(() => {
          if (vigente) setCargando(false);
        });
    }, 220);
    return () => {
      vigente = false;
      window.clearTimeout(timer);
    };
  }, [fila.id, pedido]);
  const { min, max, sugeridos } = opciones.descuentos;
  return (
    <div className="grid gap-6">
      <fieldset className="grid gap-3">
        <legend className="mb-2 text-sm font-medium text-ink-2">
          Cómo le hablás
        </legend>
        <div className="flex flex-wrap gap-2">
          {opciones.segmentos.map((s) => (
            <Chip
              key={s.codigo}
              activo={segmento === s.codigo}
              onClick={() => setSegmento(s.codigo)}
            >
              {segmentoNombre[s.codigo] ?? s.nombre}
              {s.esDelCliente && (
                <span className="text-[11px] opacity-70">· hoy</span>
              )}
            </Chip>
          ))}
        </div>
      </fieldset>
      <fieldset className="grid gap-3">
        <legend className="mb-2 text-sm font-medium text-ink-2">
          Qué mensaje
        </legend>
        <div className="flex flex-wrap gap-2">
          {opciones.toques.map((t) => (
            <Chip
              key={t.toque}
              activo={toque === t.toque}
              title={t.descripcion}
              onClick={() => setToque(t.toque)}
            >
              Mensaje {t.toque} de 3
              {t.descuento > 0 && (
                <span className="text-[11px] opacity-70">· {t.descuento}%</span>
              )}
              {t.esDeLaEscalera && (
                <span className="text-[11px] opacity-70">· le toca</span>
              )}
            </Chip>
          ))}
        </div>
      </fieldset>
      <fieldset className="grid gap-3">
        <legend className="mb-2 text-sm font-medium text-ink-2">
          A dónde lo lleva el link
        </legend>
        <div className="flex flex-wrap gap-2">
          {puntosOpcion?.disponible && (
            <Chip
              activo={recordarPuntos}
              title={
                puntosOpcion.saldo > 0
                  ? "Le recuerda los puntos que ya tiene, sin descuento ni bonus."
                  : "Le sugiere empezar a sumar puntos con su próximo pedido, sin descuento ni bonus."
              }
              onClick={() => setRecordarPuntos(true)}
            >
              {puntosOpcion.saldo > 0
                ? `Recordar sus ${puntosOpcion.saldo} puntos`
                : "Empezar a sumar puntos"}
              {puntosOpcion.saldo > 0 && puntosOpcion.puedeUsarSaldo && puntosOpcion.premio ? ` · ${puntosOpcion.premio}` : ""}
            </Chip>
          )}
          {opciones.links.map((o) => (
            <Chip
              key={o.modalidad}
              activo={!recordarPuntos && link === o.modalidad}
              title={o.descripcion}
              onClick={() => {
                setRecordarPuntos(false);
                setLink(o.modalidad);
                if (o.modalidad === "puntos" && puntos <= 0) {
                  setPuntos(Math.max(1, puntosOpcion?.sugerido ?? 1));
                }
              }}
            >
              {o.titulo}
            </Chip>
          ))}
        </div>
        {recordarPuntos && puntosOpcion && (
          <p className="muted">
            {puntosOpcion.saldo > 0
              ? `Cuesta cero: no lleva cupón ni puntos extra. El mensaje le recuerda que tiene ${puntosOpcion.saldo} puntos en el club.${puntosOpcion.puedeUsarSaldo && puntosOpcion.premio ? ` Puede canjear ${puntosOpcion.premio}.` : puntosOpcion.premio && puntosOpcion.faltan ? ` Le faltan ${puntosOpcion.faltan} para ${puntosOpcion.premio}.` : ""}`
              : "Cuesta cero: no lleva cupón ni puntos extra. Le sugiere empezar a sumar con su próximo pedido para usar el club."}
          </p>
        )}
        {!recordarPuntos && link === "reactivacion" && (
          <div className="grid gap-3 rounded-2xl bg-sand p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-ink-2">Descuento</span>
              {sugeridos.map((s) => (
                <Chip
                  key={s}
                  activo={descuento === s}
                  className="min-h-9 px-3"
                  onClick={() => {
                    setDescuento(s);
                    setAMano(true);
                  }}
                >
                  {s}%
                </Chip>
              ))}
              <label className="ml-auto flex items-center gap-2">
                <span className="sr-only">Descuento a mano</span>
                <input
                  type="number"
                  min={0}
                  max={max}
                  value={descuento}
                  className="w-20 min-h-9 py-1 text-center"
                  onChange={(e) => {
                    const n = Math.trunc(Number(e.target.value));
                    setDescuento(
                      Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0,
                    );
                    setAMano(true);
                  }}
                />
                %
              </label>
            </div>
            <p className="muted">
              {aMano
                ? `Elegido por vos (entre ${min} y ${max}%).`
                : `Es el que se ganó por los mensajes anteriores.`}
              {aMano && descuento === 0
                ? " Con 0% el link no lleva beneficio: para eso está la otra opción."
                : ""}
            </p>
          </div>
        )}
        {!recordarPuntos && link === "puntos" && puntosOpcion && (
          <div className="grid gap-3 rounded-2xl bg-brand-soft p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-ink-2">
                Puntos extra
              </span>
              <input
                type="number"
                min={1}
                max={puntosOpcion.maximo}
                value={puntos}
                aria-label="Puntos extra para este mensaje"
                className="w-28 min-h-9 py-1 text-center"
                onChange={(e) => {
                  const n = Math.trunc(Number(e.target.value));
                  setPuntos(
                    Number.isFinite(n)
                      ? Math.min(Math.max(n, 1), puntosOpcion.maximo)
                      : 1,
                  );
                }}
              />
              {puntosOpcion.sugerido > 0 && (
                <Chip
                  activo={puntos === puntosOpcion.sugerido}
                  className="min-h-9 px-3"
                  onClick={() => setPuntos(puntosOpcion.sugerido)}
                >
                  Sugerido: {puntosOpcion.sugerido}
                </Chip>
              )}
            </div>
            <p className="muted">
              El cliente los recibe recién cuando se cobra el pedido, no al
              abrir el link. No lleva descuento: así no se entrega margen dos
              veces.
              {vista?.puntosCompraMinima
                ? ` Con ${puntos} puntos, la compra mínima es de $${vista.puntosCompraMinima.toLocaleString("es-AR")}.`
                : ""}
              {puntosOpcion.otorgadosCliente30Dias >=
              puntosOpcion.maximoPorCliente30Dias
                ? " Este cliente ya llegó a su cupo de puntos extra del mes."
                : ""}
            </p>
            {puntosOpcion.saldo > 0 && (
              <p className="text-sm text-ink-3">
                Tiene {puntosOpcion.saldo.toLocaleString("es-AR")} puntos
                {puntosOpcion.premio ? ` y puede canjear ${puntosOpcion.premio}` : " en el club"}.
                Recordárselos cuesta cero; sumar más es una decisión tuya.
              </p>
            )}
          </div>
        )}
      </fieldset>
      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <p className="label">Así le llega a {fila.clienteNombre}</p>
          {cargando && vista && <span className="muted">Actualizando…</span>}
        </div>
        {vista ? (
          <div className={cargando ? "opacity-60" : undefined}>
            <Burbuja texto={vista.texto} />
          </div>
        ) : cargando ? (
          <div
            role="status"
            aria-label="Cargando"
            className="h-28 animate-pulse rounded-2xl bg-sand"
          />
        ) : (
          <p className="muted">
            No pudimos armar esa combinación. Probá con otro mensaje.
          </p>
        )}
      </div>
      <div className="sticky bottom-0 grid gap-3 bg-paper pt-2 sm:grid-cols-2">
        <Button
          type="button"
          variant="secondary"
          disabled={!decisiones}
          onClick={onRestablecer}
        >
          Volver al sugerido
        </Button>
        <Button
          type="button"
          disabled={!vista || cargando}
          onClick={() => vista && onAplicar(pedido, vista)}
        >
          Usar este mensaje
        </Button>
      </div>
    </div>
  );
}
