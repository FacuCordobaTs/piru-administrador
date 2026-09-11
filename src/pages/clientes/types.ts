import type { CampanaCrecimiento, CategoriaCampana, OportunidadCrecimiento, RecetaCrecimiento, ResumenCrecimiento, SegmentoCrecimiento } from '@/lib/api'

export type { CategoriaCampana }

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
  puntos?: number
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
export interface ProductoGrowth {
  id: number
  nombre: string
  activo?: boolean
  variantes?: Array<{ id: number; nombre: string; precio: string }>
  variantesSecundarias?: Array<{ id: number; nombre: string; precio: string }>
  agregados?: Array<{ id: number; nombre: string; precio: string; grupo?: number }>
  agregadosPrimarios?: Array<{ id: number; nombre: string; precio: string; grupo?: number }>
  agregadosSecundarios?: Array<{ id: number; nombre: string; precio: string; grupo?: number }>
  tituloVariantesPrimarias?: string | null
  tituloVariantesSecundarias?: string | null
  tituloExtrasPrimarios?: string | null
  tituloExtrasSecundarios?: string | null
}

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
  { value: 'nuevo', label: 'Primer pedido', dot: 'bg-emerald-500', description: 'Hizo una sola compra; el próximo paso es ayudarlo a repetir.' },
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

// Tipos para Filtrado y Ordenamiento
export type SortClienteKey = 'attention' | 'recent' | 'orders' | 'spend' | 'alphabetical'
export type SegmentFilter = 'todos' | SegmentoCrecimiento

export type SortCampanaKey = 'recent' | 'conversions' | 'visits' | 'alphabetical'
export type EstadoCampanaFilter = 'todas' | 'activa' | 'inactiva'
export type TipoCampanaFilter = 'todos' | 'producto' | 'carrito' | 'link'

export type SortCuponKey = 'recent' | 'uses' | 'discount' | 'alphabetical'
export type EstadoCuponFilter = 'todos' | 'vigentes' | 'inactivos' | 'agotados' | 'expirados'
export type TipoCuponFilter = 'todos' | 'porcentaje' | 'monto_fijo'

export const SORT_CLIENTE_LABELS: Record<SortClienteKey, string> = {
  attention: 'Necesitan atención',
  recent: 'Más recientes',
  orders: 'Mayor volumen de pedidos',
  spend: 'Mayor gasto',
  alphabetical: 'Nombre (A → Z)',
}

export const SORT_CAMPANA_LABELS: Record<SortCampanaKey, string> = {
  recent: 'Más recientes',
  conversions: 'Más compras',
  visits: 'Más visitas',
  alphabetical: 'Nombre (A → Z)',
}

export const SORT_CUPON_LABELS: Record<SortCuponKey, string> = {
  recent: 'Más recientes',
  uses: 'Más usados',
  discount: 'Mayor beneficio',
  alphabetical: 'Código (A → Z)',
}

export interface MetaCategoriaCampana {
  key: CategoriaCampana
  label: string
  emoji: string
  subtitulo: string
  canal: string
  utilidad: string
  ejemploUso: string
}

export const CATEGORIAS_CAMPANA_META: Record<CategoriaCampana, MetaCategoriaCampana> = {
  historias_instagram: {
    key: 'historias_instagram',
    label: 'Historias de Instagram',
    emoji: '📸',
    subtitulo: 'Links con stickers interactivos / encuestas',
    canal: 'Instagram Stories',
    utilidad: 'Aprovechá el sticker interactivo de enlace ("Link") en Stories para redirigir a tus seguidores con encuestas, novedades del día o cuentas regresivas.',
    ejemploUso: 'Sticker de enlace en historias junto a preguntas ("¿cuál probás hoy?") o promos del día.',
  },
  reels_tiktok: {
    key: 'reels_tiktok',
    label: 'Reels & TikTok',
    emoji: '🎬',
    subtitulo: 'Link en bio, llamado a la acción directo',
    canal: 'Videos cortos / Link in Bio',
    utilidad: 'Medí el impacto real de tus videos en Reels y TikTok colocando el Smart Link en la biografía con un llamado a la acción directo ("Pedí desde el link de nuestro perfil").',
    ejemploUso: 'Enlace principal en la biografía acompañado de videos atractivos de preparación o platos.',
  },
  pauta_digital: {
    key: 'pauta_digital',
    label: 'Pauta Digital / Meta Ads',
    emoji: '🚀',
    subtitulo: 'Tráfico directo a un producto o carrito armado',
    canal: 'Campañas pagadas (Meta Ads / Google)',
    utilidad: 'Usá este link como URL de destino en tus anuncios pagos para dirigir directo al producto en promoción o a un combo armado, maximizando el retorno de tu inversión publicitaria.',
    ejemploUso: 'Destino de anuncios en Facebook e Instagram Ads con tráfico directo a ofertas especiales.',
  },
  qr_salon_mostrador: {
    key: 'qr_salon_mostrador',
    label: 'QR en Salón / Mostrador',
    emoji: '🏷️',
    subtitulo: 'Impresos en mesas, manteles, cartas físicas',
    canal: 'Material físico en local / Mostrador',
    utilidad: 'Generá un código QR con este Smart Link para colocarlo en mesas, individuales, barras o exhibidores de mostrador y agilizar pedidos en salón o takeaway sin filas.',
    ejemploUso: 'Stickers QR en mesas, manteles individuales o carteles en el mostrador de atención.',
  },
  volantes_packaging: {
    key: 'volantes_packaging',
    label: 'Volantes & Packaging',
    emoji: '📦',
    subtitulo: 'Stickers en las bolsas de delivery',
    canal: 'Packaging / Bolsas de delivery / Folletos',
    utilidad: 'Colocá un QR con este link en las bolsas o cajas de tus pedidos de delivery para incentivar que el cliente vuelva a pedir directamente por tu propia tienda sin comisiones.',
    ejemploUso: 'Fajas adhesivas de seguridad en bolsas de delivery, stickers en cajas o folletos con promo de regreso.',
  },
  whatsapp_difusion: {
    key: 'whatsapp_difusion',
    label: 'WhatsApp & Difusión',
    emoji: '💬',
    subtitulo: 'Estados, mensajes directos a listas de difusión',
    canal: 'WhatsApp Business / Difusión',
    utilidad: 'Compartí el enlace directamente en los estados de WhatsApp de tu negocio o envíalo a tus listas de difusión de clientes habituales para comunicar platos especiales o promociones de días lentos.',
    ejemploUso: 'Envíos a listas de difusión con ofertas para el fin de semana o estados con el menú del día.',
  },
  influencers_colaboraciones: {
    key: 'influencers_colaboraciones',
    label: 'Influencers & Colaboraciones',
    emoji: '🤝',
    subtitulo: 'Trazabilidad por creador de contenido',
    canal: 'Creadores / Partners / Influencers',
    utilidad: 'Asigná un link único y personalizado a cada creador de contenido para medir con exactitud cuántas visitas, pedidos cobrados y facturación genera cada colaboración gastronómica.',
    ejemploUso: 'Link exclusivo para un creador foodie que prueba tus platos y comparte su experiencia.',
  },
}

export const LISTA_CATEGORIAS_CAMPANA = Object.values(CATEGORIAS_CAMPANA_META)

export function getCategoriaMeta(categoria?: CategoriaCampana | string | null): MetaCategoriaCampana | null {
  if (!categoria) return null
  return CATEGORIAS_CAMPANA_META[categoria as CategoriaCampana] ?? null
}

