/**
 * Persistencia local del destino de impresión.
 *
 * La clave nueva (`piru_printer_target`) guarda el destino **elegido**, un `PrinterTarget` como
 * JSON. La clave vieja (`tauri_printer_name`) sobrevive en los equipos ya instalados: si la nueva
 * está vacía —o tiene un JSON que no se puede usar—, se migra con `migrateLegacyPrinterName` y el
 * resultado se persiste en la clave nueva. Es el único punto del frontend que conoce las claves.
 *
 * Las impresoras cargadas a mano viven aparte (`piru_printer_targets_manual`, un array) porque una
 * impresora de red se tipea a mano y no hay descubrimiento que la reponga: el local con impresora de
 * cocina y de barra no puede perder la segunda al elegir la primera. Elegir un destino no lo saca de
 * la lista, y borrarlo no borra la elección más que cuando es el elegido.
 *
 * La validación es defensiva: un `PrinterTarget` a medio armar (campos faltantes, números fuera de
 * rango, un `kind` de otra versión) vale menos que nada, porque viaja a Rust para deserializar. Ante
 * la duda se devuelve `null` y la app se comporta como "sin impresora". En la lista manual la
 * entrada inválida se descarta sola: una entrada rota no puede vaciar la lista entera.
 */

import { migrateLegacyPrinterName, printerTargetKey, type PrinterTarget } from './printerTypes'
import { LIMITE_U16, LIMITE_U32 } from './printerLimits'

export const PRINTER_TARGET_STORAGE_KEY = 'piru_printer_target'

/** Impresoras cargadas a mano, como array JSON de `PrinterTarget`. */
export const MANUAL_PRINTERS_STORAGE_KEY = 'piru_printer_targets_manual'

/** Clave de la versión anterior de la app de comandas. Sólo se lee, para migrar. */
export const LEGACY_PRINTER_NAME_STORAGE_KEY = 'tauri_printer_name'

const esObjeto = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Un texto en blanco no identifica ninguna impresora. */
const textoUtil = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null

const enteroEnRango = (value: unknown, min: number, max: number): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : null

/**
 * Valida un destino que viene de afuera (`localStorage`, el backend, otra versión).
 *
 * Devuelve el destino normalizado o `null`. No acepta `null` como "impresora": un `PrinterTarget`
 * sin destino no existe, y `migrateLegacyPrinterName` ya devuelve `null` en ese caso.
 */
export function parsePrinterTarget(value: unknown): PrinterTarget | null {
  if (!esObjeto(value)) return null

  switch (value.kind) {
    case 'spooler': {
      const name = textoUtil(value.name)
      return name === null ? null : { kind: 'spooler', name }
    }
    case 'serial': {
      const port = textoUtil(value.port)
      // `baud` es `u32` en Rust: fuera de ese rango el trabajo muere al deserializar.
      const baud = enteroEnRango(value.baud, 1, LIMITE_U32)
      if (port === null || baud === null) return null
      return { kind: 'serial', port, baud }
    }
    case 'tcp': {
      const host = textoUtil(value.host)
      // `port` es `u16` en Rust.
      const port = enteroEnRango(value.port, 1, LIMITE_U16)
      if (host === null || port === null) return null
      return { kind: 'tcp', host, port }
    }
    case 'bluetooth': {
      const mac = textoUtil(value.mac)
      return mac === null ? null : { kind: 'bluetooth', mac }
    }
    case 'usb-android': {
      // El `0` es un `deviceId` válido: la comparación va contra `null`, no por truthiness.
      // El tope es el de `u32`: `Number.MAX_SAFE_INTEGER` dejaba pasar números que Rust no lee.
      const deviceId = enteroEnRango(value.deviceId, 0, LIMITE_U32)
      return deviceId === null ? null : { kind: 'usb-android', deviceId }
    }
    case 'debug-file':
      return { kind: 'debug-file' }
    default:
      return null
  }
}

/** `localStorage` puede no existir (tests bajo Bun) o estar bloqueado (modo privado). */
const leerCrudo = (clave: string): string | null => {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(clave)
  } catch {
    return null
  }
}

const escribirCrudo = (clave: string, valor: string | null): void => {
  if (typeof window === 'undefined') return
  try {
    if (valor === null) window.localStorage.removeItem(clave)
    else window.localStorage.setItem(clave, valor)
  } catch {
    // Sin persistencia: la elección vale para esta sesión y se vuelve a pedir al reiniciar.
  }
}

/**
 * Destino guardado en este equipo, o `null` si todavía no se eligió ninguno.
 *
 * Cuando la clave nueva no sirve se migra la vieja y, si la migración devuelve algo, se persiste en
 * la clave nueva: el equipo que ya tenía impresora configurada la conserva aunque la app vieja no
 * vuelva a escribir nunca `tauri_printer_name`. La clave vieja no se borra (es sólo una fuente de
 * migración y no molesta a nadie).
 */
export function readStoredPrinterTarget(): PrinterTarget | null {
  const guardado = leerCrudo(PRINTER_TARGET_STORAGE_KEY)
  if (guardado !== null) {
    try {
      const destino = parsePrinterTarget(JSON.parse(guardado))
      if (destino !== null) return destino
    } catch {
      // JSON roto: se intenta la migración antes de dar el equipo por "sin impresora".
    }
  }

  const migrado = migrateLegacyPrinterName(leerCrudo(LEGACY_PRINTER_NAME_STORAGE_KEY))
  if (migrado !== null) writeStoredPrinterTarget(migrado)
  return migrado
}

/** Persiste el destino elegido. Con `null` se olvida el que hubiera. */
export function writeStoredPrinterTarget(target: PrinterTarget | null): void {
  escribirCrudo(PRINTER_TARGET_STORAGE_KEY, target === null ? null : JSON.stringify(target))
}

/**
 * Normaliza el array guardado: descarta lo inválido y lo repetido, conserva el orden.
 *
 * Una entrada rota se ignora sin arrastrar a las demás; si no queda ninguna, la lista es vacía y la
 * app sigue funcionando (el usuario puede volver a cargarla a mano o buscarla de nuevo).
 */
export function parsePrinterTargetList(value: unknown): PrinterTarget[] {
  if (!Array.isArray(value)) return []

  const destinos: PrinterTarget[] = []
  const vistos = new Set<string>()

  for (const item of value) {
    const destino = parsePrinterTarget(item)
    if (destino === null) continue
    const clave = printerTargetKey(destino)
    if (vistos.has(clave)) continue
    vistos.add(clave)
    destinos.push(destino)
  }

  return destinos
}

/** Impresoras cargadas a mano en este equipo, en el orden en que se agregaron. */
export function readStoredManualTargets(): PrinterTarget[] {
  const guardado = leerCrudo(MANUAL_PRINTERS_STORAGE_KEY)
  if (guardado === null) return []

  try {
    return parsePrinterTargetList(JSON.parse(guardado))
  } catch {
    // JSON roto: se pierde la lista, no el resto de la configuración del equipo.
    return []
  }
}

/** Persiste la lista completa. Con la lista vacía se borra la clave. */
export function writeStoredManualTargets(targets: PrinterTarget[]): void {
  escribirCrudo(MANUAL_PRINTERS_STORAGE_KEY, targets.length === 0 ? null : JSON.stringify(targets))
}

/** La identidad del destino es su clave: compara sin depender de la forma del objeto. */
export function esElMismoDestino(a: PrinterTarget | null, b: PrinterTarget | null): boolean {
  return a !== null && b !== null && printerTargetKey(a) === printerTargetKey(b)
}

/** Suma un destino a la lista manual. Repetir el mismo destino no lo duplica. */
export function agregarDestinoManual(
  manuales: PrinterTarget[],
  nuevo: PrinterTarget,
): PrinterTarget[] {
  const clave = printerTargetKey(nuevo)
  if (manuales.some((destino) => printerTargetKey(destino) === clave)) return manuales
  return [...manuales, nuevo]
}

/** Quita de la lista manual el destino con la misma clave. Si no está, la lista no cambia. */
export function quitarDestinoManual(
  manuales: PrinterTarget[],
  objetivo: PrinterTarget,
): PrinterTarget[] {
  const clave = printerTargetKey(objetivo)
  return manuales.filter((destino) => printerTargetKey(destino) !== clave)
}

/** Lo que hay que recordar de las impresoras del equipo: la lista manual y cuál está elegida. */
export interface EstadoImpresoras {
  manuales: PrinterTarget[]
  seleccionado: PrinterTarget | null
}

/**
 * Borra una impresora manual del equipo.
 *
 * Devuelve la lista y la elección juntas porque son una sola operación: si la borrada era la
 * elegida, no queda ninguna y el equipo se comporta como "sin impresora" (lo dice la UI y lo
 * rechaza `printRaw`) en vez de apuntar a un destino que ya no está en ningún lado.
 */
export function quitarManual(estado: EstadoImpresoras, objetivo: PrinterTarget): EstadoImpresoras {
  return {
    manuales: quitarDestinoManual(estado.manuales, objetivo),
    seleccionado: esElMismoDestino(estado.seleccionado, objetivo) ? null : estado.seleccionado,
  }
}
