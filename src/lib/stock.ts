import type { UnidadStock } from './api'

export const UNIDADES_STOCK: Array<{
  value: UnidadStock
  label: string
  plural: string
  corta: string
  paso: number
}> = [
  { value: 'unidad', label: 'Unidad', plural: 'unidades', corta: 'u', paso: 1 },
  { value: 'gramo', label: 'Gramo', plural: 'gramos', corta: 'g', paso: 1 },
  { value: 'kilogramo', label: 'Kilogramo', plural: 'kilogramos', corta: 'kg', paso: 0.001 },
  { value: 'mililitro', label: 'Mililitro', plural: 'mililitros', corta: 'ml', paso: 1 },
  { value: 'litro', label: 'Litro', plural: 'litros', corta: 'l', paso: 0.001 },
]

export function datosUnidad(unidad: UnidadStock | string | null | undefined) {
  return UNIDADES_STOCK.find((item) => item.value === unidad) ?? UNIDADES_STOCK[0]
}

export function formatearCantidad(valor: number | string | null | undefined, maxDecimales = 3): string {
  const numero = Number(valor ?? 0)
  if (!Number.isFinite(numero)) return '0'
  return new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: maxDecimales,
    minimumFractionDigits: 0,
  }).format(numero)
}

/** Cantidad con su unidad corta: "1.250 g", "12 u". */
export function formatearStock(valor: number | string | null | undefined, unidad: UnidadStock | string | null | undefined): string {
  return `${formatearCantidad(valor)} ${datosUnidad(unidad).corta}`
}

export function formatearPrecio(valor: number | string | null | undefined): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2,
  }).format(Number(valor ?? 0))
}

export function formatearFecha(valor: string | Date | null | undefined): string {
  if (!valor) return ''
  const fecha = valor instanceof Date ? valor : new Date(valor)
  if (Number.isNaN(fecha.getTime())) return ''
  return fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** `YYYY-MM-DD` para el input date, en hora local. */
export function fechaParaInput(valor: string | Date | null | undefined = new Date()): string {
  const fecha = valor instanceof Date ? valor : new Date(valor ?? new Date())
  if (Number.isNaN(fecha.getTime())) return ''
  const offset = fecha.getTimezoneOffset() * 60000
  return new Date(fecha.getTime() - offset).toISOString().slice(0, 10)
}
