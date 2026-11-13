// Tipos y formateo compartidos por la pantalla de cadetes y sus diálogos.

export interface RepartidorStat {
  id: number
  nombre: string
  estado: 'activo' | 'inactivo'
  cantidadPedidos: number
  pedidosPagados: number
  totalRecaudado: number
  totalPedidos: number
  // Configuración de la liquidación
  precioEnvio: number
  pagoDiaHabil: number
  pagoFinDeSemana: number
  pagoFeriado: number
  // Liquidación del período consultado
  entregas: number
  diasTrabajados: number
  diasHabiles: number
  diasFinDeSemana: number
  diasFeriados: number
  pagoEnvios: number
  pagoDias: number
  pagoTotal: number
}

export interface FeriadoPropio {
  id: number
  fecha: string
  nombre: string
}

export interface FeriadoNacional {
  fecha: string
  nombre: string
}

export interface FeriadosData {
  anio: number
  nacionales: FeriadoNacional[]
  propios: FeriadoPropio[]
}

export const formatearPesos = (n: number) =>
  `$${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

/** Acepta "10.000", "1500,50" o vacío (0). Devuelve null si no es un importe válido. */
export function parseImporte(valor: string): number | null {
  let limpio = valor.trim().replace(/\s|\$/g, '')
  if (!limpio) return 0
  if (limpio.includes(',')) {
    // Formato argentino: el punto es de miles y la coma es decimal.
    limpio = limpio.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(limpio)) {
    // "10.000" sin decimales: son miles, no 10 con fracción.
    limpio = limpio.replace(/\./g, '')
  }
  const numero = Number(limpio)
  if (!Number.isFinite(numero) || numero < 0) return null
  return numero
}

/** "lun 17 ago" sin corrimiento de zona: la fecha se interpreta al mediodía local. */
export function formatearFechaFeriado(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00`)
  if (Number.isNaN(d.getTime())) return fecha
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function tienePagoConfigurado(r: Pick<RepartidorStat, 'precioEnvio' | 'pagoDiaHabil' | 'pagoFinDeSemana' | 'pagoFeriado'>): boolean {
  return r.precioEnvio > 0 || r.pagoDiaHabil > 0 || r.pagoFinDeSemana > 0 || r.pagoFeriado > 0
}
