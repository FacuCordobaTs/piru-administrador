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

// ── Montos ───────────────────────────────────────────────────────────────────
const ARS = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

/**
 * Formato monetario del admin. Devuelve `null` cuando no hay monto, para que la
 * UI pueda distinguir "todavía no cargó el catálogo" de "$0".
 */
export function fmtARS(monto: string | number | null | undefined): string | null {
  if (monto === null || monto === undefined || monto === '') return null
  const valor = typeof monto === 'string' ? Number.parseFloat(monto) : monto
  return Number.isFinite(valor) ? ARS.format(valor) : null
}
