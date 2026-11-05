import { hoyArgentina, rango } from "./formato";
import { query } from "./api";
export type OrdenClientes =
  | "recientes"
  | "pedidos"
  | "gasto"
  | "nombre"
  | "puntos";
/** Una campaña puntual, `organico` (pedidos sin campaña) o ninguna. */
export type FiltroCampana = number | "organico" | null;
export type PeriodoClientes = "todo" | "7" | "30" | "mes";
export const SEGMENTOS_CLIENTES = [
  "nuevo",
  "activo",
  "vip",
  "en_riesgo",
  "dormido",
  "perdido",
] as const;
/**
 * Los filtros de la lista de clientes. Los resuelve el backend (la lista llega por páginas): acá
 * sólo se arma el pedido. Las fechas son días de Argentina ("YYYY-MM-DD"; vacío, sin límite).
 * Campaña y cupón se excluyen entre sí: elegir uno limpia el otro.
 */
export interface FiltrosClientes {
  segmento: string;
  /** Sólo clientes con puntos a favor (los del club). */
  conPuntos: boolean;
  desde: string;
  hasta: string;
  sucursalId: number | null;
  campana: FiltroCampana;
  cuponId: number | null;
  orden: OrdenClientes;
}
export const FILTROS_CLIENTES_VACIOS: FiltrosClientes = {
  segmento: "",
  conPuntos: false,
  desde: "",
  hasta: "",
  sucursalId: null,
  campana: null,
  cuponId: null,
  orden: "recientes",
};
export function periodoClientes(
  periodo: PeriodoClientes,
): Pick<FiltrosClientes, "desde" | "hasta"> {
  if (periodo === "todo") return { desde: "", hasta: "" };
  const hoy = hoyArgentina();
  if (periodo === "mes") return { desde: `${hoy.slice(0, 8)}01`, hasta: hoy };
  const { from, to } = rango(Number(periodo));
  return { desde: from, hasta: to };
}
/** Cuántos filtros hay puestos (el orden por defecto no cuenta). */
export const contarFiltrosClientes = (f: FiltrosClientes) =>
  [
    f.segmento,
    f.conPuntos,
    f.desde || f.hasta,
    f.sucursalId !== null,
    f.campana !== null || f.cuponId !== null,
    f.orden !== "recientes",
  ].filter(Boolean).length;
/**
 * El pedido de una página de la lista. La búsqueda mira nombre, teléfono, dirección, campañas y
 * cupones; el resto de los filtros, los pedidos de cada cliente. `query()` descarta lo vacío, así
 * que sin filtros la URL es la de siempre.
 */
export function consultaClientes({
  pagina,
  limite,
  busqueda,
  filtros,
}: {
  pagina: number;
  limite: number;
  busqueda: string;
  filtros: FiltrosClientes;
}) {
  return query({
    soloDespachados: "true",
    pagina,
    limite,
    busqueda: busqueda.trim(),
    segmento: filtros.segmento,
    conPuntos: filtros.conPuntos ? "true" : "",
    orden: filtros.orden === "recientes" ? "" : filtros.orden,
    desde: filtros.desde,
    hasta: filtros.hasta,
    sucursalId: filtros.sucursalId,
    campanaId: filtros.campana,
    cuponId: filtros.cuponId,
  });
}
