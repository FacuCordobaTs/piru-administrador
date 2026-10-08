/**
 * Datos de ejemplo de las escenas de la guía. Son los del local inventado que recorre la landing
 * (`landing/src/data/demo.ts`) y la guía de la app de marketing: Brasa, Martina y su pedido #1284.
 * No son datos de ningún local real, y cada escena lo aclara en su epígrafe.
 */
export const LOCAL_EJEMPLO = 'Brasa'
export const COLOR_LOCAL = '#7A2E3F'

export const pesos = (n: number) => `$${n.toLocaleString('es-AR')}`

/** El pedido que sigue la historia: un delivery por la tienda, con transferencia. */
export const PEDIDO_EJEMPLO = {
  id: 1284,
  cliente: 'Martina González',
  corto: 'Martina',
  iniciales: 'MG',
  telefono: '+54 9 341 555-0182',
  direccion: 'Av. Belgrano 1450',
  hora: '21:04',
  items: [
    { cantidad: 1, nombre: 'Smash burger · Doble', precio: 15000, extras: ['Extra cheddar'], sin: ['Cebolla caramelizada'] },
    { cantidad: 1, nombre: 'Papas con cheddar', precio: 6500, extras: [], sin: [] },
    { cantidad: 1, nombre: 'Gaseosa 1,5 L', precio: 4000, extras: [], sin: [] },
  ],
  envio: 1200,
  total: 26700,
  /** El contexto que el detalle muestra debajo del nombre. */
  numero: '7º',
  historico: 86400,
  ultimaVez: 'hace 12 días',
}

/** La lista de Inicio cuando entra el #1284. */
export const OTROS_PEDIDOS = [
  { id: 1283, tipo: 'Takeaway', cliente: 'Lucas Fernández', total: 11500, pago: 'Efectivo', pendiente: true },
  { id: 1282, tipo: 'Delivery', cliente: 'Camila Ruiz', total: 31400, pago: 'MP', pendiente: false },
  { id: 1280, tipo: 'Delivery', cliente: 'Tomás Díaz', total: 19800, pago: 'MP', pendiente: false, programado: '21:30' },
]

/** La Smash burger, con lo que se carga en Menú. */
export const SMASH = {
  nombre: 'Smash burger',
  descripcion: 'Medallones aplastados, cheddar y cebolla caramelizada',
  variantes: [
    { nombre: 'Simple', precio: 10500 },
    { nombre: 'Doble', precio: 13500 },
    { nombre: 'Triple', precio: 16500 },
  ],
  ingredientes: ['Cheddar', 'Cebolla caramelizada', 'Salsa de la casa'],
  extras: [
    { nombre: 'Extra cheddar', precio: 1500 },
    { nombre: 'Panceta', precio: 1800 },
  ],
}

/** El salón: las ocupadas tienen cliente y total. La Mesa 4 es la del mozo. */
export const MESAS_EJEMPLO = [
  { numero: 1 },
  { numero: 2, cliente: 'Flor', total: 22400 },
  { numero: 3 },
  { numero: 4, cliente: 'Juan', total: 33000 },
  { numero: 5 },
  { numero: 6, cliente: 'Pablo', total: 17600 },
  { numero: 7 },
  { numero: 8 },
  { numero: 9, cliente: 'Ceci', total: 29300 },
]

/** Lo que el mozo está tomando en la Mesa 4. */
export const COMANDA_MESA = {
  confirmados: [
    { cantidad: 2, nombre: 'Napolitana', precio: 29000 },
    { cantidad: 1, nombre: 'Gaseosa 1,5 L', precio: 4000 },
  ],
  porConfirmar: { cantidad: 1, nombre: 'Papas con cheddar', precio: 6500 },
}

/** La caja de un turno: los medios de pago y el origen suman lo mismo. */
export const CAJA_EJEMPLO = {
  total: 412300,
  pendientes: 2,
  pagos: [
    { nombre: 'Efectivo', monto: 96400 },
    { nombre: 'Mercado Pago', monto: 201900 },
    { nombre: 'Transferencia', monto: 114000 },
  ],
  web: { pedidos: 31, monto: 286500 },
  manual: { pedidos: 12, monto: 125800 },
}
