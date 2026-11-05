export interface SeccionGuia {
  /** El ancla: `/dashboard/marketing/guia#motor`. Las pantallas de la app enlazan acá desde su encabezado. */
  id: string;
  titulo: string;
  grupo: string;
  /** El módulo que hace falta, si no viene con todos los locales. */
  modulo?: string;
}

/**
 * El índice de la guía (pages/Guia.tsx). Explica reglas del dominio —umbrales de los segmentos,
 * la escalera, los cuidados de la base, días flojos, puntos—: si cambia una regla en el backend,
 * cambia también su sección (components/guia/Contenido.tsx) y, si lo menciona, el recorrido.
 */
export const SECCIONES_GUIA: SeccionGuia[] = [
  { id: "circuito", titulo: "El circuito, en un minuto", grupo: "Empezar" },
  { id: "pantallas", titulo: "Marketing, pantalla por pantalla", grupo: "Empezar" },
  { id: "clientes", titulo: "Seguimiento de clientes", grupo: "Cómo funciona" },
  { id: "segmentos", titulo: "Segmentos: quién se está yendo", grupo: "Cómo funciona" },
  { id: "campanas", titulo: "Campañas y links medidos", grupo: "Cómo funciona" },
  { id: "motor", titulo: "El motor de recompra", grupo: "Cómo funciona", modulo: "Con Retención" },
  { id: "control", titulo: "Resultados del motor", grupo: "Cómo funciona", modulo: "Con Retención" },
  { id: "whatsapp", titulo: "Mensajes desde el WhatsApp del local", grupo: "Cómo funciona", modulo: "Con Retención" },
  { id: "dias-flojos", titulo: "Días flojos", grupo: "Cómo funciona" },
  { id: "puntos", titulo: "Club de puntos", grupo: "Cómo funciona", modulo: "Con Retención" },
  { id: "cupones", titulo: "Cupones", grupo: "Cómo funciona" },
  { id: "numeros", titulo: "Ventas cobradas y estadísticas", grupo: "Cómo funciona" },
  { id: "rutina", titulo: "Una semana con Piru", grupo: "Día a día" },
  { id: "preguntas", titulo: "Preguntas frecuentes", grupo: "Día a día" },
  { id: "glosario", titulo: "Glosario", grupo: "Día a día" },
];

/** Las secciones agrupadas, en el orden del índice. */
export function gruposDeLaGuia() {
  const grupos: { grupo: string; secciones: SeccionGuia[] }[] = [];
  for (const s of SECCIONES_GUIA) {
    const ultimo = grupos.at(-1);
    if (ultimo?.grupo === s.grupo) ultimo.secciones.push(s);
    else grupos.push({ grupo: s.grupo, secciones: [s] });
  }
  return grupos;
}
