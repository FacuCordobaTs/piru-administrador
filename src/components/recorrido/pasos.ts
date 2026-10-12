export type ClaveEscena =
  | 'viaje'
  | 'inicio'
  | 'menu-lateral'
  | 'carta'
  | 'clientes'
  | 'caja'
  | 'ejemplo'
  | 'whatsapp'

export interface PasoRecorrido {
  id: string
  /** El nombre corto: va en el chip y en la barra de progreso. */
  etiqueta: string
  titulo: string
  texto: string
  /** Dónde está en el panel. */
  donde?: string
  escena: ClaveEscena
}

/**
 * Los pasos del recorrido de bienvenida. Primero el panel y cómo moverse (Inicio y el menú), después
 * las pantallas de todos los días y, al final, lo que el dueño tiene que saber de la demo: qué son los
 * datos "EJEMPLO" y cómo borrarlos. Repite lo que explica la guía (pages/Guia.tsx, components/guia/
 * Contenido.tsx): si cambia el nombre de una pantalla o una regla, cambian las dos.
 *
 * - `demo`: la mira alguien de la demo de prospección (la tienda todavía no tiene dueño).
 * - `conEjemplo`: la tienda tiene datos de ejemplo cargados; si no, ese paso no tiene de qué hablar.
 */
export function pasosDelRecorrido({
  local,
  demo,
  conEjemplo,
}: {
  local?: string | null
  demo: boolean
  conEjemplo: boolean
}): PasoRecorrido[] {
  const pasos: PasoRecorrido[] = [
    {
      id: 'bienvenida',
      etiqueta: 'Bienvenida',
      titulo: local ? `Este es el panel de ${local}` : 'Este es tu panel de Piru',
      texto: demo
        ? 'Acá ves entrar los pedidos de tu tienda, manejás tu carta y tus clientes, y mirás cómo viene la caja. Lo armamos con tu carta y le sumamos datos de ejemplo para que lo veas andando.'
        : 'Acá ves entrar los pedidos de tu tienda, manejás tu carta y tus clientes, y mirás cómo viene la caja. Todo en un solo lugar, en la compu o en el celular.',
      escena: 'viaje',
    },
    {
      id: 'inicio',
      etiqueta: 'Inicio',
      titulo: 'Inicio: los pedidos del día',
      texto:
        'Es la pantalla del servicio. A la izquierda están los pedidos activos; tocás uno y lo leés como una comanda. Cuando sale, lo despachás y pasa al historial.',
      donde: 'Inicio',
      escena: 'inicio',
    },
    {
      id: 'navegacion',
      etiqueta: 'Menú',
      titulo: 'Todo está en el menú de la izquierda',
      texto:
        'Inicio, Menú, Clientes, Estadísticas y Configuración, y Mensajes cuando tenés avisos o campañas activos. La Guía, justo arriba de Configuración, explica cada pantalla con ejemplos. En el celular, el menú se abre con el botón de arriba.',
      donde: 'Menú lateral',
      escena: 'menu-lateral',
    },
    {
      id: 'carta',
      etiqueta: 'Tu carta',
      titulo: 'Tu carta, con fotos y precios',
      texto:
        'Productos, categorías, variantes y extras. Lo que cambiás acá se ve al instante en tu tienda, sin pedirle nada a nadie.',
      donde: 'Menú',
      escena: 'carta',
    },
    {
      id: 'clientes',
      etiqueta: 'Clientes',
      titulo: 'Cada pedido suma un cliente a tu base',
      texto:
        'Queda guardado quién te compra, qué pide y cada cuánto. Desde Clientes abrís la app de marketing: campañas con link propio y cupones (vienen incluidos), y la recompra por WhatsApp y los puntos con Retención.',
      donde: 'Clientes',
      escena: 'clientes',
    },
    {
      id: 'caja',
      etiqueta: 'Caja',
      titulo: 'Cuánto vendiste, sin planillas',
      texto:
        'La caja del día separa cómo te pagaron y de dónde vino cada pedido: la tienda o lo que anotaste a mano. Estadísticas suma lo cobrado de un mes o entre dos fechas y te muestra lo más pedido.',
      donde: 'Inicio → Caja, y Estadísticas',
      escena: 'caja',
    },
  ]
  if (conEjemplo) {
    pasos.push({
      id: 'ejemplo',
      etiqueta: 'Datos de ejemplo',
      titulo: 'Estos datos son de ejemplo',
      texto:
        'Para que no veas todo vacío cargamos clientes, pedidos y campañas marcados con EJEMPLO, como Mateo EJEMPLO. Podés borrarlos cuando quieras con «Borrar datos de ejemplo», arriba de la pantalla: tu carta y tu configuración no se tocan.',
      escena: 'ejemplo',
    })
  }
  pasos.push({
    id: 'listo',
    etiqueta: 'Listo',
    titulo: demo ? 'Recorrelo a tu ritmo' : 'Todo listo para empezar',
    texto: demo
      ? 'Abrí un pedido, mirá tu menú o entrá a Clientes. Si te gusta, escribinos y lo dejamos andando con tu WhatsApp y tus medios de pago: el pedido te llega a tu número, sin comisiones.'
      : 'Empezá por Inicio: ahí entran los pedidos. Si te queda una duda, la Guía explica cómo funciona cada cosa por dentro, y a un mensaje de WhatsApp tenés a una persona del equipo.',
    escena: 'whatsapp',
  })
  return pasos
}
