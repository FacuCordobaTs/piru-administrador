import { ArrowDown } from "lucide-react";
import { cn } from "../ui";
import { fecha, pesos, segmentoNombre } from "../../lib/formato";
import type { OrdenClientes } from "../../lib/filtrosClientes";
import type { ClienteGrowth } from "../../lib/tipos";
/** Encabezado de una columna que ordena la lista; sin `orden`, es un título común. */
function Encabezado({
  titulo,
  orden,
  actual,
  alinear = "text-right",
  onOrden,
}: {
  titulo: string;
  orden?: OrdenClientes;
  actual: OrdenClientes;
  alinear?: "text-left" | "text-right";
  onOrden: (orden: OrdenClientes) => void;
}) {
  const clase = `px-4 py-4 font-medium ${alinear}`;
  if (!orden)
    return (
      <th scope="col" className={clase}>
        {titulo}
      </th>
    );
  const activo = actual === orden;
  return (
    <th
      scope="col"
      className={clase}
      aria-sort={
        activo ? (orden === "nombre" ? "ascending" : "descending") : "none"
      }
    >
      <button
        type="button"
        onClick={() => onOrden(orden)}
        className={cn(
          "inline-flex items-center gap-1 rounded-lg",
          activo ? "text-ink" : "hover:text-ink",
        )}
      >
        {titulo}
        {activo && <ArrowDown size={12} aria-hidden="true" />}
      </button>
    </th>
  );
}
/**
 * Los clientes de la página, en filas: nombre, segmento, lo que gastó, cuántos pedidos, sus
 * puntos y su último pedido. Los encabezados ordenan la lista (lo hace el backend); con el club
 * activo, la columna de puntos suma cuántos canjes hizo.
 */
export function TablaClientes({
  clientes,
  orden,
  onOrden,
  club,
  cargando,
  onElegir,
}: {
  clientes: ClienteGrowth[];
  orden: OrdenClientes;
  onOrden: (orden: OrdenClientes) => void;
  club: boolean;
  /** Hay una página nueva en camino: la actual se ve atenuada. */
  cargando: boolean;
  onElegir: (cliente: ClienteGrowth) => void;
}) {
  return (
    <div
      className={cn(
        "lista-sombra overflow-x-auto rounded-[20px] bg-surface transition-opacity",
        cargando && "opacity-60",
      )}
      role="region"
      aria-label="Listado de clientes"
      aria-busy={cargando}
      tabIndex={0}
    >
      <table className="w-full min-w-[900px] table-fixed text-sm">
        <caption className="sr-only">Clientes y sus hábitos de compra</caption>
        <colgroup>
          <col className="w-[24%]" />
          <col className="w-[24%]" />
          <col className="w-[18%]" />
          <col className="w-[8%]" />
          <col className="w-[8%]" />
          <col className="w-[18%]" />
        </colgroup>
        <thead>
          <tr className="text-xs text-ink-3">
            <Encabezado
              titulo="Nombre"
              orden="nombre"
              alinear="text-left"
              actual={orden}
              onOrden={onOrden}
            />
            <Encabezado
              titulo="Segmento"
              alinear="text-left"
              actual={orden}
              onOrden={onOrden}
            />
            <Encabezado
              titulo="Total gastado"
              orden="gasto"
              actual={orden}
              onOrden={onOrden}
            />
            <Encabezado
              titulo="Pedidos"
              orden="pedidos"
              actual={orden}
              onOrden={onOrden}
            />
            <Encabezado
              titulo="Puntos"
              orden="puntos"
              actual={orden}
              onOrden={onOrden}
            />
            <Encabezado
              titulo="Último pedido"
              orden="recientes"
              actual={orden}
              onOrden={onOrden}
            />
          </tr>
        </thead>
        <tbody>
          {clientes.map((c) => (
            <tr
              key={c.id}
              className="cursor-pointer transition-colors hover:bg-sand/50"
              onClick={() => onElegir(c)}
            >
              <th scope="row" className="px-4 py-4 text-left font-semibold">
                <button
                  type="button"
                  className="w-full rounded-lg text-left break-words"
                  onClick={() => onElegir(c)}
                >
                  {c.nombre}
                </button>
              </th>
              <td className="px-4 py-4 text-ink-2">
                {segmentoNombre[c.segmento || ""] || "Sin historial"}
              </td>
              <td className="px-4 py-4 text-right whitespace-nowrap tabular-nums">
                {pesos(c.totalGastado)}
              </td>
              <td className="px-4 py-4 text-right tabular-nums">
                {c.cantidadPedidos}
              </td>
              <td className="px-4 py-4 text-right tabular-nums">
                <span className={cn(c.puntos ? "font-semibold" : "text-ink-3")}>
                  {c.puntos || 0}
                </span>
                {club && !!c.club?.canjes && (
                  <span className="mt-0.5 block text-xs text-ink-3">
                    {c.club.canjes} {c.club.canjes === 1 ? "canje" : "canjes"}
                  </span>
                )}
              </td>
              <td className="px-4 py-4 text-right whitespace-nowrap text-ink-2">
                {fecha(c.ultimoPedidoAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
