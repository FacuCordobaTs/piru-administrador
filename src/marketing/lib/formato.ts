export const pesos = (n: number | string) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  })
    .format(Number(n))
    .replace(/\s/g, "");
export const fecha = (s: string | null | undefined) =>
  s
    ? new Intl.DateTimeFormat("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        dateStyle: "medium",
      }).format(new Date(s))
    : "—";
/** El día de Argentina ("YYYY-MM-DD") de un instante, para precargar un input de fecha. */
export const diaArgentina = (s: string | null | undefined) =>
  s
    ? new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Argentina/Buenos_Aires",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(s))
    : "";
export const fechaHora = (s: string | null | undefined) =>
  s
    ? new Intl.DateTimeFormat("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(s))
    : "—";
export const hoyArgentina = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const variacion = (n: number, prev: number) =>
  prev
    ? `${n >= prev ? "+" : ""}${Math.round((n / prev - 1) * 100)}%`
    : "Sin comparación";
export const segmentoNombre: Record<string, string> = {
  primer_pedido: "Primer pedido",
  nuevo: "Primer pedido",
  activo: "Habituales",
  vip: "VIP",
  en_riesgo: "Se están yendo",
  dormido: "Hace tiempo no vienen",
  perdido: "Dejaron de pedir",
};
export const rango = (dias: number) => {
  const to = hoyArgentina();
  const d = new Date(`${to}T12:00:00-03:00`);
  d.setUTCDate(d.getUTCDate() - dias);
  return { from: d.toISOString().slice(0, 10), to };
};
/**
 * El período en el formato de los resultados de marketing y cupones: el backend lee la fecha sola
 * como las 00:00 UTC, así que un `to` sin hora dejaba afuera el último día entero (y con él los
 * pedidos y visitas de las últimas horas). Va de la primera a la última hora del día argentino.
 */
export const rangoConHora = (dias: number) => {
  const { from, to } = rango(dias);
  return { from: `${from}T00:00:00-03:00`, to: `${to}T23:59:59-03:00` };
};
