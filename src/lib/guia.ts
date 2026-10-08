export interface SeccionGuia {
  /** El ancla: `/dashboard/guia#comandas`. */
  id: string
  titulo: string
  grupo: string
  /** El módulo que hace falta, si no viene con todos los locales. */
  modulo?: string
}

/**
 * El índice de la guía del panel (pages/Guia.tsx). Explica reglas del dominio —qué se imprime y
 * cuándo, el punto de venta sin conexión, el cobro con QR, las mesas y los mozos, la caja, los
 * módulos—: si cambia una de esas reglas, cambia también su sección (components/guia/Contenido.tsx).
 */
export const SECCIONES_GUIA: SeccionGuia[] = [
  { id: 'circuito', titulo: 'Cómo funciona Piru, en un minuto', grupo: 'Empezar' },
  { id: 'panel', titulo: 'El panel, pantalla por pantalla', grupo: 'Empezar' },
  { id: 'pedidos', titulo: 'Inicio: los pedidos del día', grupo: 'El servicio' },
  { id: 'pos', titulo: 'Anotar un pedido en el punto de venta', grupo: 'El servicio', modulo: 'Con Punto de venta' },
  { id: 'mesas', titulo: 'Mesas y app de mozos', grupo: 'El servicio', modulo: 'Con Mesas' },
  { id: 'comandas', titulo: 'Comandas impresas', grupo: 'El servicio', modulo: 'Con Impresión de comandas' },
  { id: 'delivery', titulo: 'Delivery, zonas y repartidores', grupo: 'El servicio' },
  { id: 'caja', titulo: 'Caja y cierre de turno', grupo: 'El servicio' },
  { id: 'sin-conexion', titulo: 'Si se corta internet', grupo: 'El servicio', modulo: 'Con Punto de venta' },
  { id: 'cobro-qr', titulo: 'Cobrar con el QR de Mercado Pago', grupo: 'El servicio', modulo: 'Con Mercado Pago' },
  { id: 'tienda', titulo: 'Tu tienda y cómo te llega un pedido', grupo: 'Tu tienda' },
  { id: 'menu', titulo: 'El menú: productos, variantes y extras', grupo: 'Tu tienda' },
  { id: 'horarios', titulo: 'Horarios y pedidos programados', grupo: 'Tu tienda' },
  { id: 'pagos', titulo: 'Cómo te pagan', grupo: 'Tu tienda' },
  { id: 'whatsapp', titulo: 'WhatsApp y avisos', grupo: 'Tu tienda' },
  { id: 'sucursales', titulo: 'Sucursales y eventos', grupo: 'Tu tienda' },
  { id: 'clientes', titulo: 'Clientes, campañas y recompra', grupo: 'Crecer' },
  { id: 'estadisticas', titulo: 'Estadísticas', grupo: 'Crecer' },
  { id: 'tu-marketer', titulo: 'Si trabajás con un marketer', grupo: 'Tu cuenta' },
  { id: 'modulos', titulo: 'Módulos y suscripción', grupo: 'Tu cuenta' },
  { id: 'rutina', titulo: 'Un día con Piru', grupo: 'Día a día' },
  { id: 'preguntas', titulo: 'Preguntas frecuentes', grupo: 'Día a día' },
  { id: 'glosario', titulo: 'Glosario', grupo: 'Día a día' },
]

/** Las secciones agrupadas, en el orden del índice. */
export function gruposDeLaGuia() {
  const grupos: { grupo: string; secciones: SeccionGuia[] }[] = []
  for (const s of SECCIONES_GUIA) {
    const ultimo = grupos.at(-1)
    if (ultimo?.grupo === s.grupo) ultimo.secciones.push(s)
    else grupos.push({ grupo: s.grupo, secciones: [s] })
  }
  return grupos
}

/** Lo que la guía sabe de quien la lee: con sesión, los "dónde está" llevan a la pantalla. */
export interface ContextoGuia {
  conSesion: boolean
  /** El link de la tienda del local, sin protocolo, si el perfil ya está cargado. */
  tienda: string | null
}

/** La guía de la app de marketing, en la versión para dueños. */
export const GUIA_MARKETING = 'https://marketing.piru.app/guia?para=duenio'

export const AYUDA_WHATSAPP =
  'https://api.whatsapp.com/send?phone=543408681915&text=Hola%2C%20tengo%20una%20consulta%20sobre%20el%20panel%20de%20Piru'
