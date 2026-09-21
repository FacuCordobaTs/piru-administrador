import type { CampanaCrecimiento, CategoriaCampana, OportunidadCrecimiento, RecetaCrecimiento, ResumenCrecimiento, SegmentoCrecimiento, TipoTransaccionPuntos } from '@/lib/api'

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
  /** El sistema lo emitió solo (Smart Link, micro-campaña o recompra). La lista
   *  no los pide, así que en la práctica los visibles valen `false`. */
  generadoAutomaticamente: boolean
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

/**
 * Las dos mitades de Adquisición. Campañas y Cupones se administran desde la
 * misma tab del workspace, pero siguen siendo módulos comerciales distintos
 * (`crecimiento` y `codigos_descuento`), cada uno con su propio gate.
 */
export type AssetTab = 'campanas' | 'cupones'
export type WorkspaceTab = 'clientes' | 'retencion' | 'adquisicion'
/** Lo que consume `FiltrosDialog`: la familia de filtros activa, no la tab contenedora. */
export type FiltrosTab = 'clientes' | AssetTab

/**
 * Las dos mitades de Retención: el Club de Puntos y el motor de recompra.
 * No son módulos distintos — ambas son capacidades de `motor_recompra` y
 * comparten un único gate, por eso viajan juntas en la misma tab.
 */
export type RetencionTab = 'puntos' | 'motor'
export const RETENCION_TABS: RetencionTab[] = ['puntos', 'motor']

/**
 * Estado del módulo dueño de Retención, con la ambigüedad ya resuelta: mientras
 * el catálogo no llegó no corresponde decidir —ni navegación ni venta— porque
 * un local que sí tiene el módulo vería un flash de la pantalla de activación.
 */
export type EstadoRetencion = 'cargando' | 'activa' | 'inactiva'

export interface ResultadoCupon {
  codigo: CodigoDescuentoGrowth
  filtros: { from: string | null; to: string | null; sucursalId: number | null }
  metricas: { usos: number; clientes: number; facturacionCobrada: number; ventasAntesDescuento: number; montoDescontado: number; ticketPromedio: number }
  clientes: Array<{ id: number; nombre: string; telefono: string; usos: number; facturacion: number; montoDescontado: number; ultimoUsoAt: string }>
  pedidos: Array<{ id: number; clienteId: number | null; sucursalId: number | null; total: number; montoDescuento: number; createdAt: string }>
}

export type ResultadoCampana = ResumenCrecimiento
export type CampanaEditable = CampanaCrecimiento

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

// Vocabulario RFM de `clientes-rfm.ts`, el mismo que viaja en
// `ClienteGrowth.segmento`. Los colores retoman el lenguaje del Motor de
// Recompra (naranja = en riesgo, violeta = dormido, rosa = perdido) para que un
// mismo estado se lea igual en todo el workspace. `activo` es el estado sano
// por defecto, así que va neutro en lugar de competir por atención.
export const SEGMENTO_META: Record<SegmentoCrecimiento, { label: string; clase: string; dot: string }> = {
  nuevo: { label: 'Nuevo', clase: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  activo: { label: 'Activo', clase: 'border-border/60 bg-muted/60 text-muted-foreground', dot: 'bg-muted-foreground/50' },
  vip: { label: 'VIP', clase: 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  en_riesgo: { label: 'En riesgo', clase: 'border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-400', dot: 'bg-orange-500' },
  dormido: { label: 'Dormido', clase: 'border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400', dot: 'bg-violet-500' },
  perdido: { label: 'Perdido', clase: 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400', dot: 'bg-rose-500' },
}

export const ARS = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
export const formatCurrency = (value: number | string | null | undefined) => ARS.format(Number(value ?? 0))
const NUMERO_PUNTOS = new Intl.NumberFormat('es-AR')
export const formatPuntos = (value: number | string | null | undefined) => NUMERO_PUNTOS.format(Number(value ?? 0))
export const formatFechaHora = (value: string | null | undefined) => value
  ? new Date(value).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  : 'Sin movimientos'
export const formatDate = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Sin datos'

/**
 * Vocabulario del ledger de puntos. Las claves son exactamente los valores de
 * `transaccion_puntos.tipo` en el backend (`lib/puntos.ts`); un tipo nuevo sin
 * entrada acá se muestra con su nombre crudo, no se oculta.
 * `signo` describe la naturaleza del movimiento, no su dirección: un ajuste
 * manual puede sumar o restar.
 */
export const MOVIMIENTO_PUNTOS_META: Record<TipoTransaccionPuntos, { label: string; clase: string; signo: 'suma' | 'canje' | 'ajuste' }> = {
  suma_compra: { label: 'Suma por compra', clase: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', signo: 'suma' },
  bonus_bienvenida: { label: 'Bono de bienvenida', clase: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', signo: 'suma' },
  canje_producto: { label: 'Canje de producto', clase: 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400', signo: 'canje' },
  canje_envio: { label: 'Canje de envío gratis', clase: 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400', signo: 'canje' },
  canje_descuento: { label: 'Canje de cupón', clase: 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400', signo: 'canje' },
  ajuste_manual: { label: 'Ajuste manual', clase: 'border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400', signo: 'ajuste' },
  devolucion_cancelacion: { label: 'Reversión por cancelación', clase: 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400', signo: 'ajuste' },
  expiracion: { label: 'Expiración de puntos', clase: 'border-border/60 bg-muted/60 text-muted-foreground', signo: 'ajuste' },
}

export const metaMovimientoPuntos = (tipo: string | null | undefined) =>
  MOVIMIENTO_PUNTOS_META[tipo as TipoTransaccionPuntos] ?? {
    label: tipo || 'Movimiento',
    clase: 'border-border/60 bg-muted/60 text-muted-foreground',
    signo: 'ajuste' as const,
  }
export const recetaNombre = (codigo: string | null | undefined) => RECETAS.find((receta) => receta.codigo === codigo)?.nombre ?? codigo ?? 'Sin receta'

export const nuevaClave = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`

export const normalizarHasta = (fecha?: string) => fecha ? `${fecha}T23:59:59.999` : undefined

// Tipos para Filtrado y Ordenamiento
export type SortClienteKey = 'recent' | 'orders' | 'spend' | 'alphabetical'

export type SortCampanaKey = 'recent' | 'conversions' | 'visits' | 'alphabetical'
export type EstadoCampanaFilter = 'todas' | 'activa' | 'inactiva'
export type TipoCampanaFilter = 'todos' | 'producto' | 'carrito' | 'link'

export type SortCuponKey = 'recent' | 'uses' | 'discount' | 'alphabetical'
export type EstadoCuponFilter = 'todos' | 'vigentes' | 'inactivos' | 'agotados' | 'expirados'
export type TipoCuponFilter = 'todos' | 'porcentaje' | 'monto_fijo'

export const SORT_CLIENTE_LABELS: Record<SortClienteKey, string> = {
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
    utilidad: 'Medí el impacto real de tus videos en Reels y TikTok colocando el link de la campaña en la biografía con un llamado a la acción directo ("Pedí desde el link de nuestro perfil").',
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
    utilidad: 'Generá un código QR con el link de esta campaña para colocarlo en mesas, individuales, barras o exhibidores de mostrador y agilizar pedidos en salón o takeaway sin filas.',
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

