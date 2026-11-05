export type ClaveEscena =
  | "circuito"
  | "link"
  | "ficha"
  | "ritmo"
  | "hoy"
  | "dias"
  | "puntos"
  | "app";

export interface PasoRecorrido {
  id: string;
  /** El nombre corto: va en el chip y en la barra de progreso. */
  etiqueta: string;
  titulo: string;
  texto: string;
  /** Dónde está en el menú. */
  donde?: string;
  /** El módulo que lo habilita, si no viene con todos los locales. */
  modulo?: string;
  escena: ClaveEscena;
}

/**
 * Los pasos del recorrido de bienvenida de Marketing, con la voz del dueño. Las reglas que se
 * mencionan son las de la guía (pages/Guia.tsx): si cambia una, cambian las dos.
 */
export function pasosDelRecorrido({
  local,
}: {
  local?: string | null;
}): PasoRecorrido[] {
  return [
    {
      id: "circuito",
      etiqueta: "Bienvenida",
      titulo: `Este es el marketing de ${local || "tu local"}`,
      texto: "Tu contenido lleva a tu tienda, cada pedido llega a tu WhatsApp y suma un cliente a tu base, y Piru te dice a quién invitar a volver. Todo medido en ventas cobradas.",
      escena: "circuito",
    },
    {
      id: "campanas",
      etiqueta: "Campañas",
      titulo: "Cada historia, con su link",
      texto: "Creás un link para cada historia, reel, anuncio o QR. Piru cuenta las visitas y los pedidos cobrados que entraron por él, así sabés qué contenido te trae ventas de verdad.",
      donde: "Campañas",
      escena: "link",
    },
    {
      id: "clientes",
      etiqueta: "Clientes",
      titulo: "Cada pedido suma un cliente a tu base",
      texto: "El pedido te llega al WhatsApp, como siempre, y el cliente queda guardado con su celular, qué pide, cada cuánto y por dónde llegó. Tu base se arma sola.",
      donde: "Clientes",
      escena: "ficha",
    },
    {
      id: "segmentos",
      etiqueta: "Segmentos",
      titulo: "Piru avisa quién se está yendo",
      texto:
        "Cada cliente tiene su ritmo. Si alguien que pedía cada 12 días lleva 3 semanas sin aparecer, pasa a «Se están yendo». Así sabés a quién escribirle antes de perderlo.",
      donde: "Clientes",
      escena: "ritmo",
    },
    {
      id: "recompra",
      etiqueta: "Recompra",
      titulo: "Hoy organiza tu semana de mensajes",
      texto: "La agenda se actualiza sola. Podés ver Hoy, Mañana y el resto de la semana. Cada día, Hoy te muestra los mensajes listos para salir del WhatsApp de tu local, en el chat de siempre: los abrís, los mandás y los marcás. Si el cliente no vuelve, sigue el mensaje 2 y después el 3.",
      donde: "Hoy",
      modulo: "Con Recompra",
      escena: "hoy",
    },
    {
      id: "dias-flojos",
      etiqueta: "Días flojos",
      titulo: "Llená los días flojos",
      texto: "Piru mira las últimas semanas de pedidos y te marca qué días y franjas venden menos. Invitás justo esos días a los clientes que pueden volver, y armás el link del día para tu historia.",
      donde: "Días flojos",
      escena: "dias",
    },
    {
      id: "puntos",
      etiqueta: "Puntos",
      titulo: "Puntos y cupones para que vuelvan",
      texto:
        "Con el club de puntos, cada pedido cobrado suma para un premio: envío gratis, un descuento o un producto. También podés usar los puntos como incentivo de un link o mensaje, sin regalar descuento. Y con los cupones armás beneficios con usos y ventas medidos.",
      donde: "Puntos y Cupones",
      modulo: "Con Puntos",
      escena: "puntos",
    },
    {
      id: "listo",
      etiqueta: "Listo",
      titulo: "Todo listo para empezar",
      texto: "Arrancá por el Resumen: cómo viene tu local y lo que podés hacer hoy. Pedidos, cobros y menú siguen en el resto del panel, a un clic.",
      escena: "app",
    },
  ];
}
