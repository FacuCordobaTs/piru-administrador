/**
 * Lógica del editor de impresora (armar el destino, fusionar el descubrimiento).
 *
 * Vive fuera de `Impresion.tsx` porque un `.tsx` del admin sólo exporta componentes. Acá no hay
 * React: son funciones puras sobre el contrato de `@/utils/printerTypes`, así que se pueden probar
 * sin navegador.
 */

import { printerTargetKey, type PrinterTarget } from '@/utils/printerTypes'
import { BAUD_MAXIMO, LIMITE_U16, LIMITE_U32 } from '@/utils/printerLimits'

export type TipoConexion = PrinterTarget['kind']

/** El código viejo abría cualquier COM a 9600; es el valor razonable para una térmica. */
export const BAUD_POR_DEFECTO = 9600

/** Puerto estándar de las impresoras de red (RAW/JetDirect). */
export const PUERTO_TCP_POR_DEFECTO = 9100

export interface TipoConexionInfo {
  tipo: TipoConexion
  /** Opción del selector de tipo de conexión. */
  label: string
  /** Qué equipos pueden usar este transporte, para que nadie elija uno imposible. */
  ayuda: string
}

export const TIPOS_CONEXION: readonly TipoConexionInfo[] = [
  {
    tipo: 'spooler',
    label: 'Impresora de Windows',
    ayuda: 'USB, red o Bluetooth ya instalados en el sistema.',
  },
  {
    tipo: 'tcp',
    label: 'Red (TCP/IP)',
    ayuda: 'Impresora de red por el puerto 9100. Sirve en Windows y en Android.',
  },
  {
    tipo: 'serial',
    label: 'Puerto serie (COM)',
    ayuda: 'Bluetooth SPP de Windows o adaptador USB a serie.',
  },
  {
    tipo: 'bluetooth',
    label: 'Bluetooth',
    ayuda: 'Impresora Bluetooth por RFCOMM. Android.',
  },
  {
    tipo: 'usb-android',
    label: 'USB',
    ayuda: 'Impresora conectada por cable a la tablet. Android.',
  },
  {
    tipo: 'debug-file',
    label: 'Guardar en archivo (debug)',
    ayuda: 'No imprime: guarda el ticket en un archivo, para probar sin gastar papel.',
  },
]

const TIPOS: readonly string[] = TIPOS_CONEXION.map((info) => info.tipo)

/** El selector devuelve `string`: sin este chequeo habría que castear en la UI. */
export function esTipoConexion(valor: string): valor is TipoConexion {
  return TIPOS.includes(valor)
}

/**
 * Campos del formulario "agregar a mano", todos como texto (es lo que devuelve un `<input>`) y
 * separados por transporte: `puertoSerie` es un nombre ("COM3") y `puertoTcp` es un número.
 */
export interface BorradorImpresora {
  tipo: TipoConexion
  nombre: string
  puertoSerie: string
  baud: string
  host: string
  puertoTcp: string
  mac: string
  deviceId: string
}

export const borradorInicial = (tipo: TipoConexion = 'spooler'): BorradorImpresora => ({
  tipo,
  nombre: '',
  puertoSerie: '',
  baud: String(BAUD_POR_DEFECTO),
  host: '',
  puertoTcp: String(PUERTO_TCP_POR_DEFECTO),
  mac: '',
  deviceId: '',
})

export type ResultadoBorrador =
  | { ok: true; target: PrinterTarget }
  | { ok: false; error: string }

const entero = (valor: string): number | null => {
  const texto = valor.trim()
  if (!/^\d+$/.test(texto)) return null
  const numero = Number(texto)
  return Number.isSafeInteger(numero) ? numero : null
}

/** Entero dentro del rango que acepta el contrato (`null` si no es número o se pasa). */
const enteroEnRango = (valor: string, min: number, max: number): number | null => {
  const numero = entero(valor)
  return numero !== null && numero >= min && numero <= max ? numero : null
}

/** Los mensajes de los campos numéricos se muestran igual al tipear y al guardar. */
export const MENSAJE_BAUD = `Los baudios tienen que ser un número entero entre 1 y ${BAUD_MAXIMO}. Las térmicas usan 9600, 19200, 38400, 57600 o 115200.`
export const MENSAJE_PUERTO_TCP = `El puerto de red tiene que ser un número entero entre 1 y ${LIMITE_U16}.`
export const MENSAJE_DEVICE_ID = `El dispositivo USB es el número que informa Android, entre 0 y ${LIMITE_U32}.`

/**
 * Error del campo numérico mientras se escribe: `null` si todavía está vacío o si ya es válido.
 *
 * El campo vacío no es un error en curso (nadie escribió nada todavía); el mensaje aparece en
 * cuanto el número no entra en el tipo que espera Rust, sin esperar a guardar.
 */
export const errorBaud = (valor: string): string | null =>
  valor.trim() === '' || enteroEnRango(valor, 1, BAUD_MAXIMO) !== null ? null : MENSAJE_BAUD

export const errorPuertoTcp = (valor: string): string | null =>
  valor.trim() === '' || enteroEnRango(valor, 1, LIMITE_U16) !== null ? null : MENSAJE_PUERTO_TCP

export const errorDeviceId = (valor: string): string | null =>
  valor.trim() === '' || enteroEnRango(valor, 0, LIMITE_U32) !== null ? null : MENSAJE_DEVICE_ID

/**
 * Convierte el formulario en un destino listo para `send_print_job`.
 *
 * Devuelve el primer problema en vez de armar un destino incompleto: el JSON viaja a Rust y un
 * campo vacío sólo se descubre al imprimir, cuando ya es tarde. Los tres campos numéricos se
 * acotan al tipo que espera Rust (`printerLimits`): si el número no entra en el `u32`/`u16` del
 * contrato, la deserialización falla y el usuario ve un error de IPC en vez de este mensaje.
 */
export function targetDelBorrador(borrador: BorradorImpresora): ResultadoBorrador {
  switch (borrador.tipo) {
    case 'spooler': {
      const nombre = borrador.nombre.trim()
      if (nombre === '') return { ok: false, error: 'Escribí el nombre de la impresora tal como aparece en Windows.' }
      return { ok: true, target: { kind: 'spooler', name: nombre } }
    }
    case 'serial': {
      const puerto = borrador.puertoSerie.trim()
      if (puerto === '') return { ok: false, error: 'Escribí el puerto serie, por ejemplo COM3.' }
      const baud = enteroEnRango(borrador.baud, 1, BAUD_MAXIMO)
      if (baud === null) return { ok: false, error: MENSAJE_BAUD }
      return { ok: true, target: { kind: 'serial', port: puerto, baud } }
    }
    case 'tcp': {
      const host = borrador.host.trim()
      if (host === '') return { ok: false, error: 'Escribí la IP o el nombre de la impresora en la red.' }
      const puerto = enteroEnRango(borrador.puertoTcp, 1, LIMITE_U16)
      if (puerto === null) return { ok: false, error: MENSAJE_PUERTO_TCP }
      return { ok: true, target: { kind: 'tcp', host, port: puerto } }
    }
    case 'bluetooth': {
      const mac = borrador.mac.trim()
      if (mac === '') return { ok: false, error: 'Escribí la MAC de la impresora, por ejemplo AA:BB:CC:DD:EE:FF.' }
      return { ok: true, target: { kind: 'bluetooth', mac } }
    }
    case 'usb-android': {
      const deviceId = enteroEnRango(borrador.deviceId, 0, LIMITE_U32)
      if (deviceId === null) return { ok: false, error: MENSAJE_DEVICE_ID }
      return { ok: true, target: { kind: 'usb-android', deviceId } }
    }
    case 'debug-file':
      return { ok: true, target: { kind: 'debug-file' } }
  }
}

/**
 * Lista del selector: lo descubierto, más las cargadas a mano, más la elegida si no está en ninguna.
 *
 * `printerTargetKey` es la identidad del destino, así que la misma impresora descubierta y cargada a
 * mano no aparece dos veces. La elegida siempre está en la lista aunque el descubrimiento no la vea:
 * es la que quedó persistida como destino del equipo.
 */
export function destinosDisponibles(
  descubiertos: PrinterTarget[],
  manuales: PrinterTarget[],
  seleccionado: PrinterTarget | null,
): PrinterTarget[] {
  const candidatos = seleccionado === null ? [...descubiertos, ...manuales] : [...descubiertos, ...manuales, seleccionado]
  const vistos = new Set<string>()
  const destinos: PrinterTarget[] = []

  for (const destino of candidatos) {
    const clave = printerTargetKey(destino)
    if (vistos.has(clave)) continue
    vistos.add(clave)
    destinos.push(destino)
  }

  return destinos
}
