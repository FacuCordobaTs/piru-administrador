/**
 * Contrato de transportes de impresión.
 *
 * Reemplaza al string que el shell Tauri interpretaba por su forma: `COM*` era puerto serie a
 * 9600 fijo, el nombre mágico `GUARDAR EN ARCHIVO (DEBUG)` escribía un archivo y cualquier otro
 * nombre iba al spooler Win32 con datatype RAW. Acá el transporte es explícito y viaja como dato.
 *
 * El tipo y los helpers son puros (sin React, sin side effects, sin `localStorage`) para que se
 * puedan testear y consumir desde cualquier capa. El espejo en Rust es
 * `admin/src-tauri/src/printer_target.rs`: los dos lados tienen que hablar el mismo JSON.
 */

/** Impresora virtual de debug: guardaba el ticket en `ticket_debug.bin` en vez de imprimir. */
const DEBUG_PRINTER_NAME = 'GUARDAR EN ARCHIVO (DEBUG)'

/** El código viejo abría cualquier puerto COM a 9600; se conserva para no perder impresoras. */
const LEGACY_SERIAL_BAUD = 9600

export type PrinterTarget =
  | { kind: 'spooler'; name: string }              // Windows: RAW al spooler (USB, red instalada, BT instalado como impresora)
  | { kind: 'serial'; port: string; baud: number } // COM: BT-SPP de Windows, adaptador USB-a-serie
  | { kind: 'tcp'; host: string; port: number }    // 9100 — Windows y Android
  | { kind: 'bluetooth'; mac: string }             // Android: RFCOMM SPP
  | { kind: 'usb-android'; deviceId: number }      // Android: USB Host
  | { kind: 'debug-file' }                         // reemplaza el nombre mágico "GUARDAR EN ARCHIVO (DEBUG)"

/**
 * Etiqueta legible para la UI.
 *
 * Criterio: primero el dato que identifica a la impresora y, sólo si el transporte no se deduce
 * de ese dato, un calificador entre paréntesis al final. Los parámetros de un mismo transporte se
 * separan con `·`, así `COM3 · 9600` se lee como "el COM3, a 9600".
 */
export function describePrinterTarget(target: PrinterTarget): string {
  switch (target.kind) {
    case 'spooler':
      // El nombre solo no dice por dónde sale: en Windows puede ser USB, red o BT emparejado.
      return `${target.name} (Windows)`
    case 'serial':
      return `${target.port} · ${target.baud}`
    case 'tcp':
      return `${target.host}:${target.port} (red)`
    case 'bluetooth':
      return `BT ${target.mac}`
    case 'usb-android':
      return `USB (dispositivo ${target.deviceId})`
    case 'debug-file':
      return 'Guardar en archivo (debug)'
    default:
      // Datos persistidos por otra versión (o `JSON.parse` sin validar): no rompemos la UI.
      return 'Impresora desconocida'
  }
}

/**
 * Clave estable y única por destino: sirve como `key` de React, como `value` de un `<option>` y
 * como clave de comparación.
 *
 * Criterio: el `kind` y después todos los campos que identifican al destino, unidos con `:`. El
 * prefijo del transporte evita las colisiones entre transportes (un spooler llamado `COM3` da
 * `spooler:COM3` y el puerto serie da `serial:COM3:9600`, que son claves distintas). Entran todos
 * los campos, `baud` incluido, para que la clave identifique al destino completo: dos destinos
 * nunca comparten clave y el mismo destino siempre da la misma.
 *
 * El host de `tcp` se asume sin `:` (IPv4 o nombre), que es como lo carga la UI a mano.
 */
export function printerTargetKey(target: PrinterTarget): string {
  switch (target.kind) {
    case 'spooler':
      return `spooler:${target.name}`
    case 'serial':
      return `serial:${target.port}:${target.baud}`
    case 'tcp':
      return `tcp:${target.host}:${target.port}`
    case 'bluetooth':
      return `bluetooth:${target.mac}`
    case 'usb-android':
      return `usb-android:${target.deviceId}`
    case 'debug-file':
      return 'debug-file'
    default:
      return 'unknown'
  }
}

/**
 * Migra el nombre viejo (el string que vive en `localStorage` bajo `tauri_printer_name`) al tipo
 * nuevo.
 *
 * Cubre el 100% de los strings posibles: nunca tira excepciones y siempre devuelve un destino
 * válido o `null`. Reproduce la clasificación exacta que hacía `send_print_job` en Rust: nombre
 * mágico → archivo; nombre que empieza con `COM` (case-insensitive y en la posición 0) → serie a
 * 9600; cualquier otra cosa → spooler. El nombre se conserva tal cual porque es el que se le pasa
 * al sistema operativo. Un nombre vacío o sólo con espacios significa "sin impresora".
 */
export function migrateLegacyPrinterName(name: string | null): PrinterTarget | null {
  if (name === null) return null
  if (name.trim() === '') return null

  if (name === DEBUG_PRINTER_NAME) return { kind: 'debug-file' }

  if (name.toUpperCase().startsWith('COM')) {
    return { kind: 'serial', port: name, baud: LEGACY_SERIAL_BAUD }
  }

  return { kind: 'spooler', name }
}
