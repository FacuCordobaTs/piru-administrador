import { apiLocal, datosLocal } from "./api";

/** Recompra por tandas: contratos de `/recompra-tandas` (backend/src/routes/recompra-tandas.ts). */
export type CanalTanda = "manual" | "api";

/** La audiencia de un punto de envío: cuántos clientes hay hoy y qué conviene. */
export interface AudienciaPunto {
  elegibles: number;
  recomendado: number;
  maximo: number;
  presupuestoSugerido: number;
  ticketPromedio: number;
}

/**
 * Un número desde el que puede salir una tanda. Con sucursales, cada una con WhatsApp propio es un
 * punto y su audiencia son los clientes que pidieron ahí; `local` reúne los pedidos sin sucursal y
 * `todo` es el local sin sucursales con número (toda la base).
 */
export interface PuntoEnvio {
  clave: string;
  alcance: "todo" | "local" | "sucursal";
  sucursalId: number | null;
  nombre: string;
  numero: string | null;
  canal: CanalTanda;
  /** null = se puede elegir. */
  motivo: "sin_numero" | "inactiva" | null;
  preparacion: AudienciaPunto | null;
}

export interface PreparacionTandas {
  puntos: PuntoEnvio[];
  /** Hay más de un número disponible: primero se elige desde cuál se manda. */
  requiereSeleccion: boolean;
  conPuntos: boolean;
  localNombre: string;
  tieneTienda: boolean;
}

/** Desde qué número salió (o sale) una tanda. */
export interface EnvioTanda {
  alcance: PuntoEnvio["alcance"];
  sucursalId: number | null;
  nombre: string;
  numero: string | null;
}

/** Los puntos que se pueden elegir, con clientes para escribir hoy. */
export const puntosDisponibles = (prep: PreparacionTandas) =>
  prep.puntos.filter((p) => p.motivo == null && (p.preparacion?.elegibles ?? 0) > 0);

/** Total de clientes para escribir hoy, sumando todos los números. */
export const elegiblesTotales = (prep: PreparacionTandas) =>
  prep.puntos.reduce((s, p) => s + (p.motivo == null ? p.preparacion?.elegibles ?? 0 : 0), 0);

export interface ResumenTanda {
  id: number;
  canal: CanalTanda;
  envio: EnvioTanda;
  createdAt: string;
  presupuesto: number;
  presupuestoAsignado: number;
  conPuntos: boolean;
  total: number;
  enviados: number;
  descartados: number;
  volvieron: number;
  ventas: number;
  nombres: string[];
}

export type TipoBeneficio = "ninguno" | "porcentaje" | "monto_fijo" | "envio_gratis" | "puntos";

export interface MensajeTanda {
  id: number;
  clienteId: number;
  clienteNombre: string;
  telefono: string;
  orden: number;
  segmento: string;
  angulo: string;
  texto: string;
  motivos: string[];
  datos: {
    pedidos: number;
    totalGastado: number;
    ticketPromedio: number;
    diasDesdeUltimo: number;
    cadenciaDias: number | null;
    diaHabitual: string | null;
    favorito: string | null;
    puntos: number | null;
    esVip: boolean;
  };
  beneficio: {
    tipo: TipoBeneficio;
    valor: number;
    etiqueta: string | null;
    costoMaximo: number;
    vigenciaHoras: number | null;
  };
  link: string;
  waMeUrl: string;
  plantilla: { cuerpo: string; imagenUrl: string | null; boton: string } | null;
  estado: "pendiente" | "enviado" | "descartado";
  canalEnvio: "wa_me" | "api" | "vinculado" | null;
  enviadoAt: string | null;
  errorEnvio: string | null;
  resultado: { total: number; at: string } | null;
}

export interface Tanda {
  id: number;
  canal: CanalTanda;
  envio: EnvioTanda;
  createdAt: string;
  cantidadPedida: number;
  presupuesto: number;
  presupuestoAsignado: number;
  conPuntos: boolean;
  /** WhatsApp del local vinculado (Ajustes → WhatsApp del local). null = no aplica a esta tanda. */
  vinculado: {
    /** false = la tanda sale desde otro número que el vinculado. */
    disponible: boolean;
    telefono: string | null;
    automatico: boolean;
    enviadosHoy: number;
    limiteDiario: number;
  } | null;
  mensajes: MensajeTanda[];
}

/** Mensajes de marketing para el envío automático: cada mensaje de la tanda usa uno. */
export interface PackMensajes {
  id: number;
  nombre: string;
  cantidad: number;
  precio: number;
}
export interface SaldoMensajes {
  disponibles: number;
  packs: PackMensajes[];
}

const ruta = (tanda: number, mensaje: number, accion: string) =>
  `/recompra-tandas/${tanda}/mensajes/${mensaje}/${accion}`;

export const tandasApi = {
  preparacion: () => datosLocal<PreparacionTandas>("/recompra-tandas/preparacion"),
  listar: () => datosLocal<ResumenTanda[]>("/recompra-tandas"),
  leer: (id: number) => datosLocal<Tanda>(`/recompra-tandas/${id}`),
  crear: (cantidad: number, presupuesto: number, punto: Pick<PuntoEnvio, "alcance" | "sucursalId">) =>
    datosLocal<Tanda>("/recompra-tandas", {
      method: "POST",
      body: { cantidad, presupuesto, alcance: punto.alcance, sucursalId: punto.sucursalId },
    }),
  mensajes: () => datosLocal<SaldoMensajes>("/recompra-tandas/mensajes"),
  /** Inicia el pago del pack en Mercado Pago; al volver, el panel abre `volver`. */
  comprarPack: (packId: number, volver: string) =>
    datosLocal<{ url_pago: string }>("/mensajes/recarga/checkout", { method: "POST", body: { packId, volver } }),
  cancelar: (id: number) => apiLocal<{ success: boolean }>(`/recompra-tandas/${id}`, { method: "DELETE" }),
  /** La tanda sale sola por el WhatsApp vinculado, con tope diario. */
  envioVinculado: (id: number, activar: boolean) =>
    datosLocal<Tanda>(`/recompra-tandas/${id}/${activar ? "enviar-vinculado" : "pausar-vinculado"}`, { method: "POST" }),
  accion: (tanda: number, mensaje: number, accion: "abrir" | "deshacer" | "descartar" | "enviar") =>
    apiLocal<{ success: boolean; data: MensajeTanda }>(ruta(tanda, mensaje, accion), { method: "POST" }).then((r) => r.data),
};

export const fechaTanda = (iso: string) =>
  new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
