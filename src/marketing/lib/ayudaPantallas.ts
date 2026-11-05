import { recorridoVisto } from "./recorridoVisto";

export type Pantalla =
  | "resumen"
  | "hoy"
  | "dias-flojos"
  | "campanas"
  | "clientes"
  | "puntos"
  | "cupones"
  | "estadisticas";

export interface AyudaPantalla {
  titulo: string;
  texto: string;
  /** Lo que se puede hacer acá, en pocas palabras. */
  puntos: string[];
  /** Sección de la guía con el detalle. */
  guia: string;
}

/**
 * Qué es cada pantalla, en dos líneas y con la voz del dueño. Reemplaza al recorrido de
 * bienvenida de una sola vez: cada pantalla se explica sola la primera vez que se abre y después
 * desde el (?) de su título. Repite reglas de la guía: si cambian, se actualizan las dos.
 */
export function ayudaDePantalla(pantalla: Pantalla): AyudaPantalla {
  const ayudas: Record<Pantalla, AyudaPantalla> = {
    resumen: {
      titulo: "El resumen de tu local",
      texto: "Cómo viene tu local en los últimos 30 días y lo que conviene hacer hoy.",
      puntos: [
        "Ventas cobradas, pedidos y clientes nuevos, comparados con el período anterior.",
        "Los resultados de las campañas y de la recompra, de un vistazo.",
      ],
      guia: "numeros",
    },
    hoy: {
      titulo: "Hoy: los mensajes del día",
      texto: "Piru arma sola la agenda de clientes a quienes escribirles. Los mensajes salen del WhatsApp de tu local, en el chat de siempre.",
      puntos: [
        "Arriba están los mejores clientes para escribirle: empezá por ahí.",
        "Abrí WhatsApp, mandá el mensaje y marcalo como enviado desde los tres puntitos.",
        "Si hoy no querés escribirle a alguien, elegí «No mandar hoy».",
        "El ritmo es automático: si no vuelve, Piru le insiste más adelante.",
      ],
      guia: "whatsapp",
    },
    "dias-flojos": {
      titulo: "Días flojos",
      texto: "Piru mira las últimas semanas de pedidos y marca qué días y horarios venden menos en tu local.",
      puntos: [
        "Cada celda es el promedio de pedidos de ese día y franja; las flojas llevan una flecha.",
        "Tocá un día para ver los mensajes que podés mandar justo entonces.",
      ],
      guia: "dias-flojos",
    },
    campanas: {
      titulo: "Campañas: un link por historia",
      texto: "Cada historia, reel, anuncio o QR lleva su propio link. Así se mide qué contenido trae ventas de verdad.",
      puntos: [
        "Creá un link, pegalo en la historia y compartilo.",
        "Ves visitas, pedidos, clientes nuevos y ventas cobradas de cada uno.",
      ],
      guia: "campanas",
    },
    clientes: {
      titulo: "Clientes",
      texto: "Cada pedido suma un cliente a la base, con tu historial, qué pide y cada cuánto.",
      puntos: [
        "Buscá por nombre o teléfono; en Filtros elegís segmento, orden y más.",
        "El segmento dice si sigue pidiendo, se está yendo o ya se fue.",
        "Con Retención, «Del club» muestra a quienes tienen puntos y podés ajustárselos.",
      ],
      guia: "segmentos",
    },
    puntos: {
      titulo: "El club de puntos",
      texto: "Cada pedido cobrado suma puntos que se canjean por envío gratis, descuentos o productos.",
      puntos: [
        "Definí cómo se suman y se canjean los puntos en «Modificar club».",
        "Los clientes del club y sus ajustes están en Clientes.",
        "Abajo ves los últimos movimientos, separados en ganancias y canjes.",
      ],
      guia: "puntos",
    },
    cupones: {
      titulo: "Cupones",
      texto: "Códigos de descuento para armar beneficios y medir cuánto vendieron.",
      puntos: ["Creá un código con su valor, límite y fechas.", "Ves usos y facturación de cada uno."],
      guia: "cupones",
    },
    estadisticas: {
      titulo: "Estadísticas",
      texto: "Las ventas cobradas de tu local entre las fechas que elijas.",
      puntos: [
        "Las líneas muestran pedidos y facturación por día y por hora.",
        "Las barras te dicen qué día de la semana se vende más.",
      ],
      guia: "numeros",
    },
  };
  return ayudas[pantalla];
}

/** Clave con la que se recuerda que alguien ya vio la ayuda de una pantalla en este navegador. */
export const claveAyuda = (claveSesion: string, pantalla: Pantalla) =>
  `${claveSesion.replace("recorrido", "ayuda")}:${pantalla}`;

const vistas = new Set<string>();

/**
 * ¿Ya conoce esta pantalla? Quien ya hizo el recorrido de bienvenida de antes no vuelve a recibir
 * las ayudas solas: las tiene a mano en el (?).
 */
export function ayudaVista(claveSesion: string, pantalla: Pantalla) {
  const clave = claveAyuda(claveSesion, pantalla);
  if (vistas.has(clave) || recorridoVisto(claveSesion)) return true;
  try {
    return localStorage.getItem(clave) === "visto";
  } catch {
    return false;
  }
}

export function marcarAyudaVista(claveSesion: string, pantalla: Pantalla) {
  const clave = claveAyuda(claveSesion, pantalla);
  vistas.add(clave);
  try {
    localStorage.setItem(clave, "visto");
  } catch {
    /* Queda en memoria hasta recargar. */
  }
}

