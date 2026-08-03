import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Facturación anual ────────────────────────────────────────────────────────
// El negocio topea el ahorro anual a 20%. El monto real lo calcula y cobra el
// backend (montoPorCiclo); acá replicamos la cuenta sólo para mostrar precios.
export const MAX_DESCUENTO_ANUAL = 20

/** Descuento anual efectivo de un plan, clampeado a [0, 20]. */
export function descuentoAnualEfectivo(descuentoAnual: number | null | undefined): number {
  const pct = Math.round(Number(descuentoAnual ?? 0))
  if (!Number.isFinite(pct)) return 0
  return Math.max(0, Math.min(MAX_DESCUENTO_ANUAL, pct))
}

/** Precio total del año con el descuento anual aplicado (redondeado al peso). */
export function precioAnual(precioMensual: number, descuentoAnual: number | null | undefined): number {
  const pct = descuentoAnualEfectivo(descuentoAnual)
  return Math.round(precioMensual * 12 * (1 - pct / 100))
}
