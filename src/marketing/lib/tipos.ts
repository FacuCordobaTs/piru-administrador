// Contratos de la API que usan las pantallas de Marketing. Si cambia la API, se actualizan acá.
export type SegmentoRecompra =
  "primer_pedido" | "en_riesgo" | "dormido" | "perdido";
export type EstadoClienteRecompra =
  "pendiente" | "enviado" | "control" | "salido_por_pedido" | "fallido";
export type ModoRecompra = "automatico" | "manual";
/**
 * Una receta del Motor de Recompra: el mensaje preparado para un segmento. El beneficio que
 * muestra (`descuento`) ya viene resuelto por el backend: la escalera manda y la receta sólo
 * puede bajarlo, así que elegir una receta sin descuento apaga el cupón y cambia el link.
 */
export interface RecetaRecompraOpcion {
  codigo: SegmentoRecompra;
  nombre: string;
  descripcion: string;
  /** Hook del segmento: la primera línea del mensaje, sin la línea del cupón. */
  textoBase: string;
  /** true si es la receta del segmento del cliente: la que el motor recomienda. */
  esRecomendada: boolean;
  /** true si es la que se aplicó al mensaje devuelto. */
  esSeleccionada: boolean;
  descuento: number;
  expiraHoras: number | null;
  nivel: number;
}

/** `lo-mismo` abre el carrito de siempre y NUNCA lleva descuento; `reactivacion` abre con el elegido; `puntos` suma puntos extra. */
export type ModalidadLinkRecompra = "lo-mismo" | "reactivacion" | "puntos";
/** De dónde salió el `%` que se va a mandar: la escalera, el techo de la receta o el operador. */
export type OrigenDescuentoRecompra = "escalon" | "receta" | "manual";

/**
 * Un toque del goteo. El SEGMENTO elige la voz y el TOQUE elige el trabajo (1º relato + antojo,
 * 2º recordatorio corto, 3º cierre): son dos ejes independientes, así que `toque` y `nivel` pueden
 * diferir — el operador puede mandar el texto del 3º sin adelantar la escalera del cliente.
 */
export interface OpcionToqueRecompra {
  toque: number;
  /** "1º toque", "2º toque", "3º toque". */
  titulo: string;
  /** Qué trabajo hace ese toque ("recordatorio corto", "cierre"). */
  descripcion: string;
  /** `%` del escalón de ese toque: el que aplicaría el motor si se lo deja por defecto. */
  descuento: number;
  expiraHoras: number | null;
  esActual: boolean;
  /** true si es el toque que la escalera marca hoy para este cliente: el DEFAULT del diálogo. */
  esDeLaEscalera: boolean;
}
export interface OpcionLinkRecompra {
  modalidad: ModalidadLinkRecompra;
  titulo: string;
  descripcion: string;
  esActual: boolean;
}
/** El catálogo de las tres decisiones, con sus defaults ya resueltos por el backend. */
export interface OpcionesMensajeRecompra {
  segmentos: {
    codigo: SegmentoRecompra;
    nombre: string;
    esDelCliente: boolean;
    esActual: boolean;
  }[];
  toques: OpcionToqueRecompra[];
  links: OpcionLinkRecompra[];
  descuentos: {
    min: number;
    max: number;
    sugeridos: number[];
    recomendado: number;
  };
  /** Catálogo del link de puntos. Null = club pausado: no se ofrece. */
  puntos: OpcionPuntosRecompra | null;
}

export interface OpcionPuntosRecompra {
  disponible: boolean;
  saldo: number;
  sugerido: number;
  maximo: number;
  minimoCompraSugerido: number;
  premio: string | null;
  puedeUsarSaldo: boolean;
  faltan: number | null;
  topePorcentaje: number;
  maximoPorPedido: number;
  otorgadosCliente30Dias: number;
  maximoPorCliente30Dias: number;
}

/**
 * Lo que el operador decide antes de mandar: el MENSAJE (`segmento` × `toque`), el LINK y el
 * DESCUENTO. Todo opcional: lo que no se manda queda en el default del motor (segmento recalculado
 * en vivo, toque de la escalera, `%` de ese escalón).
 */
export interface DecisionesRecompra {
  segmento?: SegmentoRecompra;
  toque?: number;
  link?: ModalidadLinkRecompra;
  descuento?: number;
  puntos?: number;
  usarPuntos?: boolean;
}

export interface MensajeColaData {
  toqueHasta?: number;
  tipoMensaje?: string;
  segmentoCliente?: string;
  clienteId: number;
  clienteNombre: string;
  telefono: string;
  segmento: SegmentoRecompra;
  tiempoSinPedir: string;
  productoFavorito: string;
  incentivo: string;
  /** `%` del beneficio que se va a mandar. 0 = sin descuento. */
  descuento: number;
  codigoDescuento: string | null;
  nivel: number;
  /** Toque efectivamente aplicado a este mensaje (1..3). */
  toque: number;
  /** Toque que traía la fila de la cola. Si difiere de `toque`, el operador lo cambió a mano. */
  toquePlanificado: number | null;
  /** Plantilla de Meta que corresponde a (segmento × toque): qué se va a mandar si sale automático. */
  plantillaWhatsapp: string;
  /** ¿La plantilla lleva encabezado con la foto del producto? Sólo el 1º toque. */
  conImagen: boolean;
  /** Con qué modalidad abre el link. */
  link: ModalidadLinkRecompra;
  /** Qué beneficio lleva: descuento, puntos extra o recordatorio de saldo. */
  beneficioTipo: "descuento" | "puntos" | "usar_puntos" | "sin_beneficio";
  puntos: number;
  puntosCompraMinima: number;
  puntosSaldo: number;
  puntosActivo: boolean;
  puntosPremio: string | null;
  puntosFaltan: number | null;
  puntosSugeridos: number | null;
  /** De dónde salió el descuento aplicado. */
  descuentoOrigen: OrigenDescuentoRecompra;
  expiraHoras: number | null;
  /** Segmento que clasificó la campaña. Difiere del vivo si el cliente cambió de hábito. */
  segmentoFila: SegmentoRecompra | null;
  /** Receta aplicada al mensaje (la recomendada salvo que se haya pedido otra). */
  receta: RecetaRecompraOpcion;
  /** Todas las recetas disponibles con su beneficio: el menú de "cambiar mensaje". */
  recetas: RecetaRecompraOpcion[];
  /** El catálogo de las tres decisiones: con esto el diálogo no inventa defaults. */
  opciones: OpcionesMensajeRecompra;
  urlTienda: string;
  texto: string;
  waMeUrl: string | null;
  horarioSugerido?: string | null;
  /** Si se puede mandar ahora y, si no, por qué. Sin permiso no viene `waMeUrl`. */
  envio?: PermisoEnvioManual;
}

/** Si un mensaje manual puede salir ahora: se decide antes de abrir WhatsApp, no al registrarlo. */
export interface PermisoEnvioManual {
  puedeEnviar: boolean;
  motivo: string | null;
  /** Si sólo falta que llegue su hora: desde cuándo puede salir. */
  desde?: string;
}

/** Lo que el backend registró al marcar una fila como enviada: es la auditoría del envío manual. */
export interface EnvioManualRecompra {
  toque: number | null;
  nivel: number | null;
  descuento: number;
  puntos: number;
  beneficioTipo: string | null;
  link: ModalidadLinkRecompra | null;
  codigoDescuento: string | null;
}
export interface PaginadoRecompra<T> {
  items: T[];
  pagina: number;
  limite: number;
  total: number;
  paginas: number;
}
export interface ColaRecompraItem {
  diaSemana: number;
  minutoDia: number;
  tipoMensaje?: string;
  id: number;
  clienteId: number;
  clienteNombre: string;
  telefono: string | null;
  segmento: SegmentoRecompra | 'activo' | 'vip';
  poblacion: "flujo" | "stock";
  rol: "contactado";
  /** Toque que le toca a esta fila (1..3). Null sólo en las filas de control. */
  toque: number | null;
  prioridad: number;
  dueDate: string | null;
  fechaProyectada: string;
  posicionPrioridad: number;
  horarioSugerido?: string | null;
  totalGastado: number;
  ultimoPedidoAt: string | null;
  /** Su ritmo habitual: la mediana de días entre pedidos. Null con menos de dos pedidos. */
  cadenciaDias?: number | null;
  createdAt: string | null;
}
export interface HistorialRecompraItem {
  tipoMensaje?: string

  id: number;
  clienteId: number;
  clienteNombre: string;
  telefono: string | null;
  segmento: SegmentoRecompra | 'activo' | 'vip';
  poblacion: "flujo" | "stock";
  origenContacto: "automatico" | "manual";
  estadoDespacho: "entregado" | "fallido";
  plantillaWhatsapp: string;
  codigoDescuento: string | null;
  nivel: number | null;
  fechaHora: string | null;
  errorEnvio: string | null;
  /** Toque que salió en este despacho. */
  toque: number | null;
  /** Con qué link salió (`lo-mismo` no lleva descuento). */
  linkModalidad: string | null;
  /** `%` que se mandó. 0 = sin descuento. */
  descuentoEnviado: number | null;
  puntosOtorgados?: number;
  beneficioTipo?: string | null;
}
export interface ClienteMotorRecompra {
  id: number;
  clienteId: number;
  clienteNombre: string;
  telefono: string | null;
  segmento: SegmentoRecompra;
  poblacion: "flujo" | "stock";
  rol: "contactado" | "control";
  estado: EstadoClienteRecompra;
  prioridad: number;
  ticketPromedio: number;
  ultimoPedidoAt: string | null;
  dueDate: string | null;
  enviadoAt: string | null;
  /** Toque de esta fila (1..3): permite leer el recorrido "1º enviado · 2º pendiente". */
  toque: number | null;
  /** Cuántos toques lleva desde su último pedido: es el avance crudo de la escalera. */
  toquesDesdeUltimoPedido: number;
  protecciones: {
    horarioSilencioActivo: boolean;
    cooldownHasta: string | null;
    topeFrecuenciaAlcanzado: boolean;
    toques30Dias: number;
    maximoToques30Dias: number;
    optOut: boolean;
  };
}

// ── Motor de Recompra · agenda continua e historial ──
// Los tipos de programaciones se conservan para el historial anterior.

export type EstadoMotorLocal =
  "activa" | "pausada_sin_saldo" | "pausada_manual";
export type EstadoProgramacion =
  | "activa"
  | "completada"
  | "pausada_sin_saldo"
  | "pausada_manual"
  | "cancelada";
export type OrigenProgramacion = "goteo" | "programada" | "dia_flojo" | "semanal";

export interface ConfigMotorRecompra {
  toqueHasta: number;
  automaticoDisponible?: boolean;
  restauranteId: number;
  estado: EstadoMotorLocal;
  modo: ModoRecompra;
  cupoDiario: number;
  /** Días entre el 1º y el 2º toque (y entre el 2º y el 3º). Piso anti-spam: nunca menos de 2. */
  diasToque2: number;
  diasToque3: number;
  porcentajeControl: number;
  ultimoDrenajeDia: string | null;
  avisoSinSaldoAt: string | null;
}

export interface ProgramacionResumen {
  id: number;
  origen: OrigenProgramacion;
  fechaObjetivo?: string | null;
  horaObjetivo?: number | null;
  mensaje?: string | null;
  descuentoPorcentaje?: number | null;
  estado: EstadoProgramacion;
  segmento: SegmentoRecompra | null;
  /** N que pidió el dueño (mensajes a enviar). Null en las campañas legacy. */
  cantidadObjetivo: number | null;
  /** Hasta qué toque llega la tanda (1..3). */
  toqueHasta: number;
  diasToque2: number;
  diasToque3: number;
  porcentajeControl: number;
  programadaAt: string | null;
  /** Clientes distintos que recibieron al menos un toque. */
  contactados: number;
  control: number;
  /** Toques enviados: una tanda de N con 3 toques puede llegar a 3N. */
  enviados: number;
  pendientes: number;
  fallidos: number;
  /** Cuándo vuelve a salir algo de esta tanda (menor `dueDate` pendiente). */
  proximoDespachoAt: string | null;
  /** Techo de mensajes de la tanda: `cantidadObjetivo × toqueHasta`. */
  mensajesObjetivo: number;
}

export interface CandidatoLote {
  motivo?: string | null;
  optOut?: boolean;
  topeAlcanzado?: boolean;
  cooldownHasta?: string | null;
  yaEnTanda?: boolean;
  clienteId: number;
  nombre: string;
  telefono: string;
  segmento: SegmentoRecompra;
  diasDesdeUltimo: number | null;
  totalGastado: number;
  ticketPromedio: number;
  toquesDesdeUltimoPedido: number;
  proximoNivel: number;
  /** El día y la hora en que le tocaría salir si se lo programa ahora ("Viernes 21:00 hs"). */
  horarioSugerido: string;
  dueDate: string;
  /** false = ya está comprometido en otra tanda viva: la UI no lo deja elegir. */
  elegible: boolean;
}

export interface PreviewProgramacion {
  segmento: SegmentoRecompra | null;
  candidatos: CandidatoLote[];
  /** Ids que se apartarían como grupo de control si se programara así. */
  controlSugerido: number[];
  /** Coincidencias de `buscar` en TODA la cohorte, para agregar a alguien puntual. */
  busqueda: CandidatoLote[];
  resumen: {
    porSegmento: {
      segmento: SegmentoRecompra;
      elegibles: number;
      facturacionEnJuego: number;
    }[];
    totalElegibles: number;
    totalEnTanda: number;
    cantidad: number;
    cantidadMin: number;
    cantidadMax: number;
    cupoDiario: number;
    enviadosHoy: number;
    cupoRestanteHoy: number;
    saldoMarketing: number;
    modo: ModoRecompra;
    diasToque2: number;
    diasToque3: number;
    diasMinEntreToques: number;
    porcentajeControl: number;
    horarioSilencio: boolean;
  };
}

/** Lo que el dueño elige en el asistente. Todo opcional salvo la cantidad. */
export interface EspecificacionProgramacion {
  soloIncluidos?: boolean;
  fechaObjetivo?: string | null;
  horaObjetivo?: number | null;
  mensaje?: string | null;
  descuentoPorcentaje?: number | null;
  segmento?: SegmentoRecompra | null;
  cantidad?: number | null;
  toqueHasta?: number | null;
  diasToque2?: number | null;
  diasToque3?: number | null;
  porcentajeControl?: number | null;
  incluirIds?: number[] | null;
  excluirIds?: number[] | null;
}

export interface ResultadoProgramacion {
  ok: boolean;
  campanaId?: number;
  cantidad: number;
  control: number;
  filasCreadas: number;
  omitidos: {
    clienteId: number;
    motivo: "no_elegible" | "ya_en_tanda" | "excluido";
  }[];
  porSegmento: {
    segmento: SegmentoRecompra;
    contactar: number;
    control: number;
  }[];
  primerDespachoAt: string | null;
  cupoDiario: number;
  diasToque2: number;
  diasToque3: number;
  porcentajeControl: number;
  toqueHasta: number;
}

/** El universo disponible para programar cuando todavía no hay tandas vivas. */
export interface PlanActivacionRecompra {
  totalDetectados: number;
  totalContactar: number;
  totalControl: number;
  porSegmento: {
    segmento: SegmentoRecompra;
    detectados: number;
    facturacionEnJuego: number;
  }[];
  primerSegmento: SegmentoRecompra | null;
  cupoSugerido: number;
  saldoMarketing: number;
  diasCubiertos: number;
  /** Clientes ya comprometidos en una tanda viva: no se pueden volver a programar. */
  enTanda: number;
}

/** Marcador AGREGADO de todas las tandas vivas (no de una sola). */
export interface DashboardRecompra {
  estado: EstadoMotorLocal;
  modo: ModoRecompra;
  cupoDiario: number;
  /** Envíos de hoy contra el cupo del local, que es compartido por todas las tandas. */
  enviadosHoy: number;
  totalEnviados: number;
  enCola: number;
  /** Clientes ÚNICOS con al menos un toque enviado. */
  contactados: number;
  /** Toques enviados: `contactados` ≤ `toquesEnviados` ≤ 3 × `contactados`. */
  toquesEnviados: number;
  volvieron: number;
  plataRecuperada: number;
  control: number;
  controlVolvieron: number;
  tasaContactados: number;
  tasaControl: number;
  saldoMarketing: number;
  activadaAt: string | null;
  pausadaAt: string | null;
}

/** La pantalla del motor entera: config del local, tandas, marcador y universo disponible. */
export interface EstadoMotorRecompra {
  /** true si hay al menos una tanda viva: decide si la pantalla muestra el marcador o el plan. */
  activa: boolean;
  config: ConfigMotorRecompra;
  campana: DashboardRecompra | null;
  programaciones: ProgramacionResumen[];
  /** Se devuelve SIEMPRE: es el insumo del asistente de programación. */
  plan: PlanActivacionRecompra;
  saldoMarketing: number;
}

export type SegmentoCrecimiento =
  "nuevo" | "activo" | "vip" | "en_riesgo" | "dormido" | "perdido";
export type RecetaCrecimiento =
  | "segunda_compra"
  | "mantener_ritmo"
  | "beneficio_vip"
  | "volver_a_tiempo"
  | "recuperar_habito"
  | "ultimo_intento";
export type DestinoCrecimiento =
  | { tipo: "tienda" }
  | { tipo: "producto"; productoId: number; nombreProducto?: string | null }
  | { tipo: "carrito"; carritoRep: string };

export type CategoriaCampana =
  | "historias_instagram"
  | "reels_tiktok"
  | "pauta_digital"
  | "qr_salon_mostrador"
  | "volantes_packaging"
  | "whatsapp_difusion"
  | "influencers_colaboraciones";

export interface CampanaCrecimiento {
  diaSemana?: number | null;
  id: number;
  slug: string;
  nombre: string;
  tipo: "adquisicion" | "recompra" | "retencion" | "lo_mismo" | "reactivacion";
  categoria?: CategoriaCampana | null;
  recetaCodigo: RecetaCrecimiento | null;
  estado: "borrador" | "activa" | "inactiva";
  destinoTipo: DestinoCrecimiento["tipo"];
  productoId: number | null;
  carritoRep: string | null;
  codigoDescuentoId: number | null;
  descuentoProductoPorcentaje: number;
  beneficioTipo?: "descuento" | "puntos";
  puntosBeneficio?: number;
  puntosMontoMinimo?: number | string;
  puntosLimiteOtorgamientos?: number | null;
  puntosLimitePorCliente?: number;
  limiteUsos: number | null;
  usosActuales: number;
  fechaInicio: string | null;
  fechaFin: string | null;
  visitas: number;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  inversionManual: number | string;
  usaGrupoControl: boolean;
  activadaAt?: string | null;
  desactivadaAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface OportunidadCrecimiento {
  cliente: { id: number; nombre: string };
  diagnostico: {
    segmento: SegmentoCrecimiento;
    esVip: boolean;
    cadenciaDias: number | null;
    diasDesdeUltimo: number | null;
    ticketPromedio: number;
    cantidadPedidos: number;
    totalGastado: number;
  };
  receta: {
    codigo: RecetaCrecimiento;
    nombre: string;
    descripcion: string;
    metricaPrincipal: string;
  };
  destino: DestinoCrecimiento;
  incentivoSugerido: {
    descuentoPorcentaje: number;
    expiraHoras: number | null;
  };
  textoSugerido: string;
  prioridad: "normal" | "alta";
  tituloOportunidad: string;
  elegibilidad: {
    elegible: boolean;
    bloqueos: Array<{ motivo: string; mensaje: string }>;
  };
  ultimoEnlacePreparado: EnlaceCrecimiento | null;
}

export interface EnlaceCrecimiento {
  id: number;
  clienteId: number | null;
  campanaId: number | null;
  recetaCodigo: RecetaCrecimiento | null;
  destinoTipo: DestinoCrecimiento["tipo"];
  productoId: number | null;
  carritoRep: string | null;
  codigoDescuentoId: number | null;
  activo: boolean;
  expiraAt: string | null;
  createdAt: string;
}

export interface FiltrosCrecimiento {
  from?: string;
  to?: string;
  campaniaId?: number;
  sucursalId?: number;
}
export interface ResumenCrecimiento {
  filtros: {
    from: string | null;
    to: string | null;
    campaniaId: number | null;
    sucursalId: number | null;
  };
  metricas: Record<
    | "ventas"
    | "pedidos"
    | "ticketPromedio"
    | "clientesNuevos"
    | "clientesRecurrentes"
    | "sesiones"
    | "conversion"
    | "revenueAtribuido"
    | "descuentos"
    | "descuentosAtribuidos"
    | "enlacesCreados"
    | "contactos"
    | "mensajesPagos"
    | "costoMensajes"
    | "inversionManual"
    | "costoTotal"
    | "retorno",
    number
  > & { visitas?: number };
  funnel: Record<
    | "session_start"
    | "product_view"
    | "add_to_cart"
    | "checkout_start"
    | "purchase"
    | "add_other_product",
    number
  >;
  oportunidades: {
    porSegmento: Record<string, number>;
    porReceta: Record<string, number>;
    total: number;
  };
  recompra: { pedidosAtribuidos: number; revenueAtribuido: number };
  incremental: { disponible: boolean; motivo?: string };
  campanas: Array<
    Pick<CampanaCrecimiento, "id" | "nombre" | "slug" | "tipo"> & {
      metricas: ResumenCrecimiento["metricas"];
      incremental: ResumenCrecimiento["incremental"];
    }
  >;
}

export interface PrepararEnlaceCrecimiento {
  clienteId: number;
  campanaId?: number | null;
  tipoCampana?: "lo_mismo" | "reactivacion";
  descuentoPorcentaje?: number;
  expiraHoras?: number | null;
  recetaCodigo?: RecetaCrecimiento;
  codigoDescuentoId?: number | null;
  incentivo?: { descuentoPorcentaje: number; expiraHoras: number | null };
  incentivoConfirmado?: boolean;
  expiraEnHoras?: number;
  idempotenciaClave: string;
}
export interface ContactarEnlaceCrecimiento {
  token: string;
  idempotenciaClave: string;
}
export interface CrearCampanaCrecimiento {
  diaSemana?: number | null;
  slug: string;
  nombre: string;
  tipo: "adquisicion" | "recompra" | "retencion" | "lo_mismo" | "reactivacion";
  recetaCodigo?: RecetaCrecimiento | null;
  categoria?: CategoriaCampana | null;
  estado?: CampanaCrecimiento["estado"];
  destinoTipo: DestinoCrecimiento["tipo"];
  productoId?: number | null;
  carritoRep?: string | null;
  codigoDescuentoId?: number | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  inversionManual?: number;
  usaGrupoControl?: boolean;
  descuentoProductoPorcentaje?: number;
  beneficioTipo?: "descuento" | "puntos";
  puntosBeneficio?: number;
  puntosMontoMinimo?: number;
  puntosLimiteOtorgamientos?: number | null;
  puntosLimitePorCliente?: number;
  limiteUsos?: number | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
}
export type ActualizarCampanaCrecimiento = Partial<
  Omit<CrearCampanaCrecimiento, "slug">
>;

export type EstadoModulo =
  | "inactivo"
  | "pendiente_pago"
  | "activo"
  | "cancelacion_programada"
  | "suspendido"
  | null;
export type OrigenModulo =
  "usuario" | "interno" | "migracion" | "trial" | "legacy" | null;

export interface Modulo {
  id: number;
  codigo: string;
  categoriaId: number;
  nombre: string;
  descripcion: string | null;
  tipo: "incluido" | "pago";
  precioMensual: string;
  mensajesUtilityIncluidos: number;
  mensajesMarketingIncluidos: number;
  estadoProducto: "disponible" | "beta" | "proximamente";
  activable: boolean;
  activoCatalogo: boolean;
  icono?: string | null;
  orden?: number;
  estado: EstadoModulo;
  origen: OrigenModulo;
  precioMensualCongelado: string | null;
  vigenteHasta: string | null;
  activoAhora: boolean;
}

export interface CategoriaModulo {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
  activo: boolean;
  modulos: Modulo[];
}

export interface ConfiguracionPuntosData {
  modoAcumulacion?: "monto" | "producto" | "ambos";
  id?: number;
  restauranteId?: number;
  activo: boolean;
  pesosPorPunto: number;
  puntosPrimerPedido: number;
  puntosMinimosCanje: number;
  permiteCanjeEnvioGratis: boolean;
  permitirCanjeEnvioGratis?: boolean;
  puntosEnvioGratis: number;
  permiteCanjeDescuento: boolean;
  permitirCanjeDescuento?: boolean;
  descuentoPuntosCosto: number;
  descuentoTipo: "porcentaje" | "monto_fijo" | "fijo";
  descuentoValor: number | string;
  descuentoMontoMinimo: number | string;
  puntosBonusTopePorcentaje: number;
  puntosBonusMaximo: number;
  puntosBonusPorCliente30Dias: number;
}

export interface TransaccionPuntosData {
  id: number;
  clienteId: number;
  pedidoUnificadoId?: number | null;
  tipo: string;
  puntos: number;
  saldoResultante: number;
  motivo: string;
  createdAt: string;
}

/** Tipos del ledger de puntos (`transaccion_puntos.tipo` en el backend). */
export type TipoTransaccionPuntos =
  | "suma_compra"
  | "canje_producto"
  | "canje_envio"
  | "canje_descuento"
  | "bonus_bienvenida"
  | "bonus_promocion"
  | "ajuste_manual"
  | "devolucion_cancelacion"
  | "expiracion";

/** `canje` no existe en la base: agrupa los tres canjes. `todos` es la ausencia de filtro. */
export type FiltroTipoMovimientoPuntos =
  TipoTransaccionPuntos | "canje" | "todos";

export interface ResumenPuntosData {
  clientesConPuntos: number;
  clientesConHistorial: number;
  puntosEnCirculacion: number;
  puntosOtorgados: number;
  puntosCanjeados: number;
  canjes: number;
  movimientos: number;
  canjesProducto: number;
  canjesEnvio: number;
  canjesDescuento: number;
  puntosOtorgados30Dias: number;
  canjes30Dias: number;
  puntosPromocionales: number;
  otorgamientosPromocionales: number;
  puntosPromocionales30Dias: number;
  ultimoMovimientoAt: string | null;
}

export interface ClienteConPuntosData {
  id: number;
  nombre: string;
  telefono: string;
  telefonoNormalizado: string | null;
  puntos: number;
  puntosOtorgados: number;
  puntosCanjeados: number;
  canjes: number;
  movimientos: number;
  ultimoMovimientoAt: string | null;
}

export interface MovimientoPuntosData {
  id: number;
  clienteId: number;
  clienteNombre: string;
  telefono: string | null;
  pedidoUnificadoId: number | null;
  tipo: TipoTransaccionPuntos;
  puntos: number;
  saldoResultante: number;
  motivo: string;
  createdAt: string | null;
}

export interface PaginadoPuntos<T> {
  items: T[];
  pagina: number;
  limite: number;
  total: number;
  paginas: number;
}

export interface FiltrosClientesPuntos {
  busqueda?: string;
  /** `saldo` = sólo con puntos disponibles; `historial` = con saldo o con movimientos. */
  alcance?: "saldo" | "historial";
  orden?: "puntos" | "reciente" | "nombre";
  pagina?: number;
  limite?: number;
}

export interface FiltrosMovimientosPuntos {
  clienteId?: number;
  tipo?: FiltroTipoMovimientoPuntos;
  busqueda?: string;
  pagina?: number;
  limite?: number;
}

export interface ItemPedidoCliente {
  nombreProducto: string;
  cantidad: number;
  precioUnitario: string;
}

export interface PedidoCliente {
  id: number;
  total: string;
  createdAt: string;
  tipo: "delivery" | "takeaway" | "mesa";
  sucursalId?: number | null;
  codigoDescuentoId?: number | null;
  montoDescuento?: string | null;
  pagado?: boolean;
  esOrganico?: boolean;
  campanaId?: number | null;
  recetaCodigo?: RecetaCrecimiento | null;
  items: ItemPedidoCliente[];
}

export interface CampanaCliente {
  id: number;
  nombre: string;
  slug: string;
  pedidos: number;
  revenueAtribuido: number;
  primeraInteraccion: string;
  ultimaInteraccion: string;
}

export interface CuponCliente {
  id: number;
  codigo: string;
  tipo: "porcentaje" | "monto_fijo" | "envio_gratis";
  valor: number;
  usos: number;
  facturacion: number;
  montoDescontado: number;
  ultimoUsoAt: string;
}

export interface ClienteGrowth {
  id: number;
  nombre: string;
  telefono: string;
  direccion: string | null;
  puntos?: number;
  createdAt: string;
  cantidadPedidos: number;
  totalGastado: number;
  ultimoPedidoAt: string | null;
  primerPedidoAt?: string | null;
  ticketPromedio?: number;
  cadenciaDias?: number | null;
  diasDesdeUltimo?: number | null;
  segmento?: SegmentoCrecimiento;
  esVip?: boolean;
  resumenCadencia?: string | null;
  productosTop?: Array<{ nombre: string; cantidad: number }>;
  marketingOptOut?: boolean;
  fuenteAdquisicion?: "campana" | "receta" | "organico" | null;
  campanaAdquisicion?: { id: number; nombre: string; slug: string } | null;
  primeraCompra?: { pedidoId: number; fecha: string; revenue: number } | null;
  revenueHistorico?: number;
  recetaRecomendada?: OportunidadCrecimiento["receta"] | null;
  enlacePreparado?: unknown | null;
  revenueAcciones?: number;
  campanasParticipadas?: CampanaCliente[];
  cuponesUsados?: CuponCliente[];
  actividadOrganica?: {
    pedidos: number;
    facturacion: number;
    ultimoPedidoAt: string;
  } | null;
  pedidos: PedidoCliente[];
  /** Lo que ganó y canjeó en el club; sólo viene en la lista paginada. */
  club?: {
    puntosOtorgados: number;
    puntosCanjeados: number;
    canjes: number;
    movimientos: number;
    ultimoMovimientoAt: string | null;
  };
}

/** Los números de la base entera (sin búsqueda ni filtros) que acompañan a cada página de clientes. */
export interface ResumenClientes {
  total: number;
  conPuntos: number;
  puntosEnCirculacion: number;
  porSegmento: Record<
    "nuevo" | "activo" | "vip" | "en_riesgo" | "dormido" | "perdido",
    number
  >;
}

export interface PaginadoClientes {
  items: ClienteGrowth[];
  pagina: number;
  limite: number;
  total: number;
  paginas: number;
  resumen: ResumenClientes;
}

export interface CodigoDescuentoGrowth {
  id: number;
  restauranteId: number;
  codigo: string;
  tipo: "porcentaje" | "monto_fijo" | "envio_gratis";
  valor: string;
  limiteUsos: number | null;
  usosActuales: number;
  montoMinimo: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  activo: boolean;
  /** El sistema lo emitió solo (Smart Link, micro-campaña o recompra). La lista
   *  no los pide, así que en la práctica los visibles valen `false`. */
  generadoAutomaticamente: boolean;
  createdAt: string;
}

export interface SucursalGrowth {
  id: number;
  nombre: string;
  activo?: boolean;
}
export interface ProductoGrowth {
  id: number;
  nombre: string;
  activo?: boolean;
  variantes?: Array<{ id: number; nombre: string; precio: string }>;
  variantesSecundarias?: Array<{ id: number; nombre: string; precio: string }>;
  agregados?: Array<{
    id: number;
    nombre: string;
    precio: string;
    grupo?: number;
  }>;
  agregadosPrimarios?: Array<{
    id: number;
    nombre: string;
    precio: string;
    grupo?: number;
  }>;
  agregadosSecundarios?: Array<{
    id: number;
    nombre: string;
    precio: string;
    grupo?: number;
  }>;
  tituloVariantesPrimarias?: string | null;
  tituloVariantesSecundarias?: string | null;
  tituloExtrasPrimarios?: string | null;
  tituloExtrasSecundarios?: string | null;
}

export interface ResultadoCupon {
  codigo: CodigoDescuentoGrowth;
  filtros: {
    from: string | null;
    to: string | null;
    sucursalId: number | null;
  };
  metricas: {
    usos: number;
    clientes: number;
    facturacionCobrada: number;
    ventasAntesDescuento: number;
    montoDescontado: number;
    ticketPromedio: number;
  };
  clientes: Array<{
    id: number;
    nombre: string;
    telefono: string;
    usos: number;
    facturacion: number;
    montoDescontado: number;
    ultimoUsoAt: string;
  }>;
  pedidos: Array<{
    id: number;
    clienteId: number | null;
    sucursalId: number | null;
    total: number;
    montoDescuento: number;
    createdAt: string;
  }>;
}

export interface LocalMarketing {
  restauranteId: number;
  nombre: string;
  username: string;
  imagenUrl: string | null;
  colorPrimario: string | null;
  baseTienda: string | null;
  whatsappConectado: boolean;
  retencionActiva: boolean;
  crecimientoActivo: boolean;
  codigosDescuentoActivo: boolean;
  suscripcion: { estado: string; montoMensual: number } | null;
  ventas30d: number;
  ventas30dAnterior: number;
  pedidos30d: number;
  clientesNuevos30d: number;
  ventasSemanales: number[];
  diaMasFlojo: { diaSemana: number; nombre: string } | null;
  mensajesParaHoy: number;
}
// Existing endpoints without exported admin API response types; matches the runtime DTO.
export interface Metricas {
  ingresos: {
    mensual: number;
    historico: number;
    mensualManual: number;
    mensualWeb: number;
  };
  pedidos: {
    mensuales: number;
    mensualesPagados: number;
    mensualesManual: number;
    mensualesWeb: number;
    historicos: number;
  };
  desgloseMetodoPago: { metodoPago: string; total: number }[];
  topProductos: {
    productoId: number;
    nombre: string;
    cantidad: number;
    totalVendido: number;
  }[];
  porHora?: { hora: number; pedidos: number; total: number }[];
  porDia?: { fecha: string; pedidos: number; total: number }[];
  porCategoria?: {
    categoriaId: number | null;
    nombre: string;
    cantidad: number;
    totalVendido: number;
  }[];
  productosVendidos?: {
    productoId: number;
    nombre: string;
    categoria: string | null;
    cantidad: number;
    totalVendido: number;
  }[];
}
export interface Producto {
  id: number;
  nombre: string;
  activo: boolean;
  puntosGanados: number;
  puntosNecesarios: number;
}
export interface FranjaFloja {
  id: string;
  nombre: string;
  horaInicio: string;
  horaFin: string;
}
export interface DiasFlojos {
  ventana: { desde: string; hasta: string; semanas: number };
  franjas: FranjaFloja[];
  dias: {
    diaSemana: number;
    nombre: string;
    abierto: boolean;
    pedidosPromedio: number;
    ventasPromedio: number;
    franjas: (FranjaFloja & {
      pedidosPromedio: number;
      ventasPromedio: number;
    })[];
  }[];
  promedioDiaAbierto: number;
  flojos: {
    diaSemana: number;
    nombre: string;
    franja: string | null;
    pedidosPromedio: number;
    pedidosFaltantes: number;
  }[];
  suficientesDatos: boolean;
  semanasConPedidos: number;
  candidatos?: {
    clienteId: number;
    nombre: string;
    telefono: string;
    segmento: SegmentoRecompra;
    diasDesdeUltimo: number | null;
    totalGastado: number;
    ticketPromedio: number;
    cantidadPedidos: number;
    pedidosDia: number;
    elegible: boolean;
    motivo: string;
    cadencia: number | null;
    productoFavorito: string | null;
    horaHabitual: number | null;
    optOut: boolean;
    topeAlcanzado: boolean;
    cooldownHasta: string | null;
    yaEnTanda: boolean;
  }[];
}
