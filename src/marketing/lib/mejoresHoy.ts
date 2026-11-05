/** Cuánto vale escribirle a alguien de cada segmento: el que está por irse rinde más que el perdido. */
const PESO_SEGMENTO: Record<string, number> = {
  vip: 1.5,
  en_riesgo: 1.3,
  activo: 1.2,
  nuevo: 1,
  primer_pedido: 1,
  dormido: 0.8,
  perdido: 0.5,
};
export interface Candidato {
  id: number;
  segmento: string;
  totalGastado: number;
  /** Saldo del club: con puntos, el mensaje puede recordarlos; con 0, invita a empezar. */
  puntos?: number;
  /** El mensaje se puede mandar ahora (hay celular y el servidor lo permite). */
  puede: boolean;
}
/**
 * Los mejores clientes a quienes escribirles hoy: primero los que se pueden contactar ahora y
 * tienen puntos en el club (el motor prioriza aprovechar el programa), después los que tienen 0
 * puntos, y dentro de cada grupo, los que más gastaron ponderado por su segmento.
 */
export function mejoresParaHoy(candidatos: Candidato[], cantidad: number): number[] {
  const valor = (c: Candidato) => {
    const puntos = Math.max(0, Math.trunc(c.puntos ?? 0));
    const base = c.totalGastado * (PESO_SEGMENTO[c.segmento] ?? 1);
    // Dos niveles: tener puntos manda sobre no tenerlos. Dentro del nivel, más saldo primero;
    // el gasto y el segmento desempatan a quienes están en 0.
    return (puntos > 0 ? 1_000_000_000_000 : 0) + puntos * 1_000_000 + base;
  };
  return candidatos
    .filter((c) => c.puede)
    .sort((a, b) => valor(b) - valor(a) || a.id - b.id)
    .slice(0, Math.max(0, cantidad))
    .map((c) => c.id);
}
