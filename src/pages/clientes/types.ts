import type { CampanaCrecimiento, OportunidadCrecimiento, RecetaCrecimiento, ResumenCrecimiento, SegmentoCrecimiento } from '@/lib/api'

export interface ItemPedidoCliente {
  nombreProducto: string
  cantidad: number
  precioUnitario: string
}

export interface PedidoCliente {
  id: number
  total: string
  createdAt: string
  tipo: 'delivery' | 'takeaway' | 'mesa'
  sucursalId?: number | null
  codigoDescuentoId?: number | null
  montoDescuento?: string | null
  pagado?: boolean
  esOrganico?: boolean
  campanaId?: number | null
  recetaCodigo?: RecetaCrecimiento | null
  items: ItemPedidoCliente[]
}

export interface CampanaCliente {
  id: number
  nombre: string
  slug: string
  pedidos: number
  revenueAtribuido: number
  primeraInteraccion: string
  ultimaInteraccion: string
}

export interface CuponCliente {
  id: number
  codigo: string
  tipo: 'porcentaje' | 'monto_fijo'
  valor: number
  usos: number
  facturacion: number
  montoDescontado: number
  ultimoUsoAt: string
}

export interface ClienteGrowth {
  id: number
  nombre: string
  telefono: string
  direccion: string | null
  createdAt: string
  cantidadPedidos: number
  totalGastado: number
  ultimoPedidoAt: string | null
  primerPedidoAt?: string | null
  ticketPromedio?: number
  cadenciaDias?: number | null
  diasDesdeUltimo?: number | null
  segmento?: SegmentoCrecimiento
  esVip?: boolean
  resumenCadencia?: string | null
  productosTop?: Array<{ nombre: string; cantidad: number }>
  marketingOptOut?: boolean
  fuenteAdquisicion?: 'campana' | 'receta' | 'organico' | null
  campanaAdquisicion?: { id: number; nombre: string; slug: string } | null
  primeraCompra?: { pedidoId: number; fecha: string; revenue: number } | null
  revenueHistorico?: number
  recetaRecomendada?: OportunidadCrecimiento['receta'] | null
  enlacePreparado?: unknown | null
  revenueAcciones?: number
  campanasParticipadas?: CampanaCliente[]
  cuponesUsados?: CuponCliente[]
  actividadOrganica?: { pedidos: number; facturacion: number; ultimoPedidoAt: string } | null
  pedidos: PedidoCliente[]
}

export interface CodigoDescuentoGrowth {
  id: number
  restauranteId: number
  codigo: string
  tipo: 'porcentaje' | 'monto_fijo'
  valor: string
  limiteUsos: number | null
  usosActuales: number
  montoMinimo: string
  fechaInicio: string | null
  fechaFin: string | null
  activo: boolean
  createdAt: string
}

export interface SucursalGrowth { id: number; nombre: string; activo?: boolean }
export interface ProductoGrowth { id: number; nombre: string }

export type FiltroCampana = number | 'organico' | null

export interface ResultadoCupon {
  codigo: CodigoDescuentoGrowth
  filtros: { from: string | null; to: string | null; sucursalId: number | null }
  metricas: { usos: number; clientes: number; facturacionCobrada: number; ventasAntesDescuento: number; montoDescontado: number; ticketPromedio: number }
  clientes: Array<{ id: number; nombre: string; telefono: string; usos: number; facturacion: number; montoDescontado: number; ultimoUsoAt: string }>
  pedidos: Array<{ id: number; clienteId: number | null; sucursalId: number | null; total: number; montoDescuento: number; createdAt: string }>
}

export type ResultadoCampana = ResumenCrecimiento
export type CampanaEditable = CampanaCrecimiento

export const SEGMENTOS: Array<{ value: SegmentoCrecimiento; label: string; dot: string; description: string }> = [
  { value: 'en_riesgo', label: 'En riesgo', dot: 'bg-orange-500', description: 'Se está pasando de su ritmo habitual.' },
  { value: 'dormido', label: 'Dormido', dot: 'bg-violet-500', description: 'Hace rato que no pide para su cadencia.' },
  { value: 'vip', label: 'VIP', dot: 'bg-amber-500', description: 'Cliente de alto valor para cuidar.' },
  { value: 'activo', label: 'Activo', dot: 'bg-sky-500', description: 'Pide dentro de su ritmo habitual.' },
  { value: 'nuevo', label: 'Nuevo', dot: 'bg-emerald-500', description: 'Todavía está formando su hábito.' },
  { value: 'perdido', label: 'Perdido', dot: 'bg-rose-500', description: 'Muy pasado de su ritmo habitual.' },
]

export const RECETAS: Array<{
  codigo: RecetaCrecimiento
  nombre: string
  descripcion: string
  segmento: SegmentoCrecimiento
  descuentoPorcentaje: number
  expiraHoras: number | null
}> = [
  { codigo: 'segunda_compra', nombre: 'Segunda compra', descripcion: 'Rearma su último pedido para ayudarlo a repetir.', segmento: 'nuevo', descuentoPorcentaje: 0, expiraHoras: null },
  { codigo: 'mantener_ritmo', nombre: 'Mantené su ritmo', descripcion: 'Le recuerda volver dentro de su cadencia habitual.', segmento: 'activo', descuentoPorcentaje: 0, expiraHoras: null },
  { codigo: 'beneficio_vip', nombre: 'Beneficio VIP', descripcion: 'Prepara una propuesta especial para un cliente valioso.', segmento: 'vip', descuentoPorcentaje: 0, expiraHoras: null },
  { codigo: 'volver_a_tiempo', nombre: 'Volvé a tiempo', descripcion: 'Actúa antes de que el cliente pierda el hábito.', segmento: 'en_riesgo', descuentoPorcentaje: 0, expiraHoras: null },
  { codigo: 'recuperar_habito', nombre: 'Recuperá el hábito', descripcion: 'Sugiere un incentivo moderado para reactivarlo.', segmento: 'dormido', descuentoPorcentaje: 10, expiraHoras: null },
  { codigo: 'ultimo_intento', nombre: 'Último intento', descripcion: 'Una propuesta fuerte y limitada para intentar recuperarlo.', segmento: 'perdido', descuentoPorcentaje: 20, expiraHoras: 48 },
]

export const ARS = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
export const formatCurrency = (value: number | string | null | undefined) => ARS.format(Number(value ?? 0))
export const formatDate = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Sin datos'
export const getSegmento = (cliente: ClienteGrowth): SegmentoCrecimiento => cliente.segmento ?? (cliente.cantidadPedidos > 3 ? 'activo' : 'nuevo')
export const recetaNombre = (codigo: string | null | undefined) => RECETAS.find((receta) => receta.codigo === codigo)?.nombre ?? codigo ?? 'Sin receta'
export const nuevaClave = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`

export const normalizarHasta = (fecha?: string) => fecha ? `${fecha}T23:59:59.999` : undefined

