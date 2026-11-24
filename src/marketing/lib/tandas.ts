import { apiLocal, datosLocal } from "./api";

/** Recompra por tandas: contratos de `/recompra-tandas` (backend/src/routes/recompra-tandas.ts). */
export type CanalTanda = "manual" | "api";

export interface PreparacionTanda {
  elegibles: number;
  recomendado: number;
  maximo: number;
  presupuestoSugerido: number;
  ticketPromedio: number;
  canal: CanalTanda;
  conPuntos: boolean;
  localNombre: string;
  tieneTienda: boolean;
}

export interface ResumenTanda {
  id: number;
  canal: CanalTanda;
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
  canalEnvio: "wa_me" | "api" | null;
  enviadoAt: string | null;
  errorEnvio: string | null;
  resultado: { total: number; at: string } | null;
}

export interface Tanda {
  id: number;
  canal: CanalTanda;
  createdAt: string;
  cantidadPedida: number;
  presupuesto: number;
  presupuestoAsignado: number;
  conPuntos: boolean;
  mensajes: MensajeTanda[];
}

const ruta = (tanda: number, mensaje: number, accion: string) =>
  `/recompra-tandas/${tanda}/mensajes/${mensaje}/${accion}`;

export const tandasApi = {
  preparacion: () => datosLocal<PreparacionTanda>("/recompra-tandas/preparacion"),
  listar: () => datosLocal<ResumenTanda[]>("/recompra-tandas"),
  leer: (id: number) => datosLocal<Tanda>(`/recompra-tandas/${id}`),
  crear: (cantidad: number, presupuesto: number) =>
    datosLocal<Tanda>("/recompra-tandas", { method: "POST", body: { cantidad, presupuesto } }),
  cancelar: (id: number) => apiLocal<{ success: boolean }>(`/recompra-tandas/${id}`, { method: "DELETE" }),
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
