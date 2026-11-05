import type { Metricas } from "./tipos";
/** Un punto de los gráficos de actividad: pedidos cobrados y lo que facturaron. */
export interface PuntoActividad {
  /** Lo que se lee en el eje: «12/10» o «21h». */
  etiqueta: string;
  /** Lo que dice el detalle al pasar por encima: «lunes 12 de octubre». */
  titulo: string;
  pedidos: number;
  total: number;
}
const DIA_MS = 86_400_000;
const dosDigitos = (n: number) => String(n).padStart(2, "0");
/** Los días de Argentina que son un instante fijo al mediodía UTC: sin saltos de huso al sumar. */
const mediodia = (dia: string) => new Date(`${dia}T12:00:00Z`);
const aDia = (fecha: Date) => fecha.toISOString().slice(0, 10);
const titulo = new Intl.DateTimeFormat("es-AR", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
});
/**
 * Todos los días entre `desde` y `hasta` (inclusive), con 0 en los que no hubo pedidos cobrados:
 * el backend sólo devuelve los días con actividad y la línea tiene que seguir el calendario.
 */
export function completarDias(
  porDia: NonNullable<Metricas["porDia"]>,
  desde: string,
  hasta: string,
): PuntoActividad[] {
  const inicio = mediodia(desde).getTime();
  const fin = mediodia(hasta).getTime();
  if (!Number.isFinite(inicio) || !Number.isFinite(fin) || inicio > fin)
    return [];
  const porFecha = new Map(porDia.map((d) => [d.fecha.slice(0, 10), d]));
  const puntos: PuntoActividad[] = [];
  for (let t = inicio; t <= fin; t += DIA_MS) {
    const fecha = new Date(t);
    const dato = porFecha.get(aDia(fecha));
    puntos.push({
      etiqueta: `${dosDigitos(fecha.getUTCDate())}/${dosDigitos(fecha.getUTCMonth() + 1)}`,
      titulo: titulo.format(fecha),
      pedidos: dato?.pedidos ?? 0,
      total: Math.round(dato?.total ?? 0),
    });
  }
  return puntos;
}
/**
 * Las horas con actividad, con una hora vacía de margen a cada lado (como la actividad por hora del
 * cierre de caja del panel) y 0 en las del medio que no tuvieron pedidos.
 */
export function completarHoras(
  porHora: NonNullable<Metricas["porHora"]>,
): PuntoActividad[] {
  const conActividad = porHora.filter((h) => h.pedidos > 0 || h.total > 0);
  if (!conActividad.length) return [];
  const horas = conActividad.map((h) => h.hora);
  const desde = Math.max(0, Math.min(...horas) - 1);
  const hasta = Math.min(23, Math.max(...horas) + 1);
  const porNumero = new Map(conActividad.map((h) => [h.hora, h]));
  const puntos: PuntoActividad[] = [];
  for (let hora = desde; hora <= hasta; hora++) {
    const dato = porNumero.get(hora);
    puntos.push({
      etiqueta: `${dosDigitos(hora)}h`,
      titulo: `De ${dosDigitos(hora)}:00 a ${dosDigitos(hora)}:59`,
      pedidos: dato?.pedidos ?? 0,
      total: Math.round(dato?.total ?? 0),
    });
  }
  return puntos;
}
/** «$1,2 M», «$12 k» o «$800»: para el eje de la facturación. `techo` es el valor más alto de la serie. */
export function abreviarPesos(valor: number, techo: number): string {
  const decimales = (n: number, d: number) =>
    n.toLocaleString("es-AR", { maximumFractionDigits: d });
  if (valor === 0) return "$0";
  if (techo >= 1_000_000) return `$${decimales(valor / 1_000_000, 1)} M`;
  if (techo >= 1_000) return `$${decimales(valor / 1_000, 0)} k`;
  return `$${decimales(valor, 0)}`;
}
const MEDIOS: Record<string, string> = {
  efectivo: "Efectivo",
  cash: "Efectivo",
  mercadopago: "Mercado Pago",
  mercado_pago: "Mercado Pago",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  desconocido: "Sin dato",
};
/** El nombre del medio de pago como lo lee quien mira el local. */
export function nombreMedioPago(codigo: string): string {
  const clave = codigo.toLowerCase();
  if (MEDIOS[clave]) return MEDIOS[clave];
  const legible = clave.replaceAll("_", " ");
  return legible.charAt(0).toUpperCase() + legible.slice(1);
}
export interface FilaReparto {
  nombre: string;
  total: number;
  /** De 0 a 100, sobre la suma de las filas. */
  porcentaje: number;
}
/** Los medios de pago de mayor a menor, con su parte del total cobrado. */
export function repartirMediosPago(
  desglose: Metricas["desgloseMetodoPago"],
): FilaReparto[] {
  const suma = desglose.reduce((s, m) => s + m.total, 0);
  return desglose
    .map((m) => ({
      nombre: nombreMedioPago(m.metodoPago),
      total: m.total,
      porcentaje: suma > 0 ? (m.total / suma) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}
export interface CategoriaRanking {
  nombre: string;
  cantidad: number;
  totalVendido: number;
  /** Los productos de la categoría que entraron al ranking, del más vendido al menos. */
  productos: { nombre: string; cantidad: number; totalVendido: number }[];
}
/**
 * Las categorías de la que más factura a la que menos, cada una con sus productos más vendidos.
 * Los totales de la categoría son los del período entero; los productos son los del ranking.
 */
export function rankingPorCategoria(m: Metricas): CategoriaRanking[] {
  const productos = m.productosVendidos ?? [];
  const sinCategoria = "Sin categoría";
  return (m.porCategoria ?? [])
    .map((c) => ({
      nombre: c.nombre,
      cantidad: c.cantidad,
      totalVendido: c.totalVendido,
      productos: productos
        .filter((p) => (p.categoria ?? sinCategoria) === c.nombre)
        .map(({ nombre, cantidad, totalVendido }) => ({
          nombre,
          cantidad,
          totalVendido,
        }))
        .sort((a, b) => b.cantidad - a.cantidad),
    }))
    .sort((a, b) => b.totalVendido - a.totalVendido);
}
export interface PuntoSemana {
  etiqueta: string;
  titulo: string;
  /** Cuántos de ese día de la semana hay en el período. */
  ocurrencias: number;
  /** Promedio por día: no depende de cuántos lunes cayeron en el rango. */
  pedidos: number;
  total: number;
}
const DIAS_SEMANA = [
  ["Lun", "Lunes", 1],
  ["Mar", "Martes", 2],
  ["Mié", "Miércoles", 3],
  ["Jue", "Jueves", 4],
  ["Vie", "Viernes", 5],
  ["Sáb", "Sábados", 6],
  ["Dom", "Domingos", 0],
] as const;
/** Lo que se vende en promedio cada día de la semana (lunes a domingo) dentro del período. */
export function promedioPorDiaSemana(
  porDia: NonNullable<Metricas["porDia"]>,
  desde: string,
  hasta: string,
): PuntoSemana[] {
  const inicio = mediodia(desde).getTime();
  const fin = mediodia(hasta).getTime();
  const ocurrencias = new Array(7).fill(0);
  const pedidos = new Array(7).fill(0);
  const total = new Array(7).fill(0);
  if (Number.isFinite(inicio) && Number.isFinite(fin))
    for (let t = inicio; t <= fin; t += DIA_MS) ocurrencias[new Date(t).getUTCDay()]++;
  for (const d of porDia) {
    const fecha = d.fecha.slice(0, 10);
    if (fecha < desde || fecha > hasta) continue;
    const dia = mediodia(fecha).getUTCDay();
    pedidos[dia] += d.pedidos;
    total[dia] += d.total;
  }
  return DIAS_SEMANA.map(([etiqueta, titulo, dia]) => ({
    etiqueta,
    titulo,
    ocurrencias: ocurrencias[dia],
    pedidos: ocurrencias[dia] ? Math.round((pedidos[dia] / ocurrencias[dia]) * 10) / 10 : 0,
    total: ocurrencias[dia] ? Math.round(total[dia] / ocurrencias[dia]) : 0,
  }));
}
