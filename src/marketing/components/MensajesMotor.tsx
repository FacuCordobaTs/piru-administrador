import { useState } from "react";
import { datosLocal, query } from "../lib/api";
import { useDatos } from "../lib/useDatos";
import { fecha, fechaHora, segmentoNombre } from "../lib/formato";
import type {
  ColaRecompraItem,
  HistorialRecompraItem,
  PaginadoRecompra,
} from "../lib/tipos";
import { Button, Card, Chip, Estado } from "./ui";
interface Fila {
  id: number;
  cliente: string;
  telefono: string | null;
  detalle: string;
  cuando: string;
}
const mensaje = (toque: number | null) =>
  toque === 1 ? "Primer mensaje" : toque ? "Recordatorio" : "Grupo de control";
/** Toda la cola y todo el historial del motor, con sus filtros. */
export function MensajesMotor() {
  const [vista, setVista] = useState<"cola" | "historial">("cola");
  const [segmento, setSegmento] = useState("");
  const [pagina, setPagina] = useState(1);
  const [buscar, setBuscar] = useState("");
  const d = useDatos(async () => {
    const filtros = query({ pagina, limite: 25, segmento });
    if (vista === "cola") {
      const r = await datosLocal<PaginadoRecompra<ColaRecompraItem>>(`/clientes/recompra/cola${filtros}`,
      );
      return {
        ...r,
        filas: r.items.map((c): Fila => ({
          id: c.id,
          cliente: c.clienteNombre,
          telefono: c.telefono,
          detalle: `${segmentoNombre[c.segmento]} · ${c.tipoMensaje === "dia_flojo" ? "Invitación sin descuento" : mensaje(c.toque)}`,
          cuando: c.horarioSugerido || fecha(c.dueDate ?? c.fechaProyectada),
        })),
      };
    }
    const r = await datosLocal<PaginadoRecompra<HistorialRecompraItem>>(`/clientes/recompra/historial${filtros}`,
    );
    return {
      ...r,
      filas: r.items.map((h): Fila => ({
        id: h.id,
        cliente: h.clienteNombre,
        telefono: h.telefono,
        detalle: [
          segmentoNombre[h.segmento],
          h.tipoMensaje === "dia_flojo" ? "Invitación sin descuento" : mensaje(h.toque),
          h.beneficioTipo === "puntos"
            ? `+${h.puntosOtorgados ?? 0} puntos`
            : h.beneficioTipo === "usar_puntos"
              ? "Mensaje del club de puntos"
              : h.descuentoEnviado ? `${h.descuentoEnviado}% OFF` : null,
          h.estadoDespacho === "fallido" ? "No salió" : null,
        ]
          .filter(Boolean)
          .join(" · "),
        cuando: fechaHora(h.fechaHora),
      })),
    };
  }, [vista, pagina, segmento]);
  const q = buscar.trim().toLowerCase();
  const filas = d.data?.filas.filter(
    (f) =>
      !q ||
      f.cliente.toLowerCase().includes(q) ||
      (f.telefono ?? "").includes(q),
  );
  return (
    <Card className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2>Mensajes del motor</h2>
        <div className="flex gap-2">
          {(
            [
              ["cola", "Próximos"],
              ["historial", "Enviados"],
            ] as const
          ).map(([v, texto]) => (
            <Chip
              key={v}
              activo={vista === v}
              onClick={() => {
                setVista(v);
                setPagina(1);
              }}
            >
              {texto}
            </Chip>
          ))}
        </div>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <label>
          Buscar en esta página
          <input
            placeholder="Nombre o teléfono"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
          />
        </label>
        <label>
          Clientes
          <select
            value={segmento}
            onChange={(e) => {
              setSegmento(e.target.value);
              setPagina(1);
            }}
          >
            <option value="">Todos</option>
            {["primer_pedido", "en_riesgo", "dormido", "perdido"].map((s) => (
              <option key={s} value={s}>
                {segmentoNombre[s]}
              </option>
            ))}
          </select>
        </label>

      </div>
      <div className="mt-5">
        <Estado loading={d.loading} error={d.error} reintentar={d.recargar} />
        {filas && !filas.length && (
          <p className="muted py-4">
            {vista === "cola"
              ? "No hay mensajes en la cola con estos filtros."
              : "Todavía no se mandaron mensajes con estos filtros."}
          </p>
        )}
        {filas?.map((f) => (
          <div
            key={f.id}
            className="flex flex-wrap justify-between gap-3 border-b border-line py-3 text-sm"
          >
            <span>
              <strong>{f.cliente}</strong>
              <span className="muted block">{f.detalle}</span>
            </span>
            <span className="text-ink-3">{f.cuando}</span>
          </div>
        ))}
        {d.data && d.data.paginas > 1 && (
          <div className="mt-5 flex items-center justify-between">
            <Button
              variant="secondary"
              disabled={pagina <= 1}
              onClick={() => setPagina((p) => p - 1)}
            >
              Anterior
            </Button>
            <span className="muted tabular-nums">
              {pagina} / {d.data.paginas}
            </span>
            <Button
              variant="secondary"
              disabled={pagina >= d.data.paginas}
              onClick={() => setPagina((p) => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
