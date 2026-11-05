import type { CampanaCrecimiento, CodigoDescuentoGrowth } from "./tipos";
/**
 * Las dos campañas que el backend crea para el motor de recompra (`lo-mismo` y `reactivacion`):
 * el link de cada mensaje se arma por cliente, así que no se comparten, no se editan ni se
 * borran.
 */
export const esCampanaDelMotor = (c: Pick<CampanaCrecimiento, "tipo">) =>
  c.tipo === "lo_mismo" || c.tipo === "reactivacion";
export type EstadoCampanas = "todas" | "activas" | "inactivas";
export type TipoCampanas = "todos" | "tienda" | "producto" | "carrito";
export type OrdenCampanas =
  "clientes_nuevos" | "ventas" | "recientes" | "compras" | "visitas" | "nombre";
export interface FiltrosCampanas {
  estado: EstadoCampanas;
  tipo: TipoCampanas;
  orden: OrdenCampanas;
}
export const FILTROS_CAMPANAS_VACIOS: FiltrosCampanas = {
  estado: "todas",
  tipo: "todos",
  orden: "clientes_nuevos",
};
/** Las del motor cuentan como inactivas y van al final al ordenar por adquisición o ventas. */
export function filtrarCampanas<
  T extends { c: CampanaCrecimiento; ventas: number; clientesNuevos?: number },
>(filas: T[], f: FiltrosCampanas): T[] {
  const activa = (c: CampanaCrecimiento) =>
    !esCampanaDelMotor(c) && c.estado === "activa";
  const ventasDelLink = (fila: T) =>
    esCampanaDelMotor(fila.c) ? -1 : fila.ventas;
  return filas
    .filter(
      ({ c }) =>
        (f.estado === "todas" || (f.estado === "activas") === activa(c)) &&
        (f.tipo === "todos" || c.destinoTipo === f.tipo),
    )
    .sort((a, b) =>
      f.orden === "clientes_nuevos"
        ? Number(esCampanaDelMotor(a.c)) - Number(esCampanaDelMotor(b.c))
          || (b.clientesNuevos ?? 0) - (a.clientesNuevos ?? 0)
          || b.ventas - a.ventas
          || a.c.id - b.c.id
        : f.orden === "recientes"
        ? (Date.parse(b.c.createdAt ?? "") || 0) -
          (Date.parse(a.c.createdAt ?? "") || 0)
        : f.orden === "compras"
          ? b.c.usosActuales - a.c.usosActuales
          : f.orden === "visitas"
            ? b.c.visitas - a.c.visitas
            : f.orden === "nombre"
              ? a.c.nombre.localeCompare(b.c.nombre)
              : ventasDelLink(b) - ventasDelLink(a),
    );
}
export type EstadoCupones =
  "todos" | "vigentes" | "pausados" | "agotados" | "vencidos";
export type TipoCupones = "todos" | "porcentaje" | "monto_fijo" | "envio_gratis";
export type OrdenCupones = "recientes" | "usos" | "beneficio" | "nombre";
export interface FiltrosCupones {
  estado: EstadoCupones;
  tipo: TipoCupones;
  orden: OrdenCupones;
}
export const FILTROS_CUPONES_VACIOS: FiltrosCupones = {
  estado: "todos",
  tipo: "todos",
  orden: "recientes",
};
const agotado = (c: CodigoDescuentoGrowth) =>
  c.limiteUsos != null && c.usosActuales >= c.limiteUsos;
const vencido = (c: CodigoDescuentoGrowth, ahora: number) =>
  !!c.fechaFin && Date.parse(c.fechaFin) < ahora;
export function filtrarCupones(
  cupones: CodigoDescuentoGrowth[],
  f: FiltrosCupones,
  ahora = Date.now(),
): CodigoDescuentoGrowth[] {
  return cupones
    .filter((c) => {
      if (f.tipo !== "todos" && c.tipo !== f.tipo) return false;
      if (f.estado === "vigentes")
        return (
          c.activo &&
          !(c.fechaInicio && Date.parse(c.fechaInicio) > ahora) &&
          !vencido(c, ahora) &&
          !agotado(c)
        );
      if (f.estado === "pausados") return !c.activo;
      if (f.estado === "agotados") return agotado(c);
      if (f.estado === "vencidos") return vencido(c, ahora);
      return true;
    })
    .sort((a, b) =>
      f.orden === "usos"
        ? b.usosActuales - a.usosActuales
        : f.orden === "beneficio"
          ? Number(b.valor) - Number(a.valor)
          : f.orden === "nombre"
            ? a.codigo.localeCompare(b.codigo)
            : (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0),
    );
}
