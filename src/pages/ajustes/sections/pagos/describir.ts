import type { MetodosConfig } from '../../hooks/useMetodosPago'

/** Lista legible de los métodos realmente activos (integración conectada). */
export function metodosActivos(
  c: MetodosConfig,
  mpOk: boolean,
  cucuruOk: boolean,
  taloOk: boolean
): string[] {
  const lista: string[] = []
  if ((c.checkout || c.bricks) && mpOk) lista.push('Mercado Pago')
  if (c.tfAuto && (cucuruOk || taloOk)) lista.push('transferencia automática')
  if (c.tfManual) lista.push('transferencia')
  if (c.efectivo) lista.push('efectivo')
  return lista
}

export function hayAlgunMetodo(
  c: MetodosConfig,
  mpOk: boolean,
  cucuruOk: boolean,
  taloOk: boolean
): boolean {
  return metodosActivos(c, mpOk, cucuruOk, taloOk).length > 0
}

export function describirMetodos(
  c: MetodosConfig,
  mpOk: boolean,
  cucuruOk: boolean,
  taloOk: boolean
): string {
  const l = metodosActivos(c, mpOk, cucuruOk, taloOk)
  if (l.length === 0) return 'Todavía no elegiste métodos de pago'
  if (l.length === 1) return `Cobrás con ${l[0]}`
  return `Cobrás con ${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}`
}
