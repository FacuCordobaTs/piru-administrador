import { describe, expect, test } from 'bun:test'
import {
  describePrinterTarget,
  migrateLegacyPrinterName,
  printerTargetKey,
  type PrinterTarget,
} from '../src/utils/printerTypes'

describe('contrato de destinos de impresión', () => {
  test('el JSON de cada transporte es el que deserializa Rust', () => {
    // El espejo en Rust (`src-tauri/src/printer_target.rs`) compara contra estos mismos literales:
    // si un lado renombra un campo, los dos tests dejan de coincidir.
    const casos: Array<[PrinterTarget, string]> = [
      [{ kind: 'spooler', name: 'HP LaserJet' }, '{"kind":"spooler","name":"HP LaserJet"}'],
      [{ kind: 'serial', port: 'COM3', baud: 9600 }, '{"kind":"serial","port":"COM3","baud":9600}'],
      [{ kind: 'tcp', host: '192.168.1.50', port: 9100 }, '{"kind":"tcp","host":"192.168.1.50","port":9100}'],
      [{ kind: 'bluetooth', mac: 'AA:BB:CC:DD:EE:FF' }, '{"kind":"bluetooth","mac":"AA:BB:CC:DD:EE:FF"}'],
      [{ kind: 'usb-android', deviceId: 3 }, '{"kind":"usb-android","deviceId":3}'],
      [{ kind: 'debug-file' }, '{"kind":"debug-file"}'],
    ]

    for (const [destino, json] of casos) {
      expect(JSON.stringify(destino)).toBe(json)
    }
  })

  test('la etiqueta muestra primero el dato que identifica a la impresora', () => {
    expect(describePrinterTarget({ kind: 'spooler', name: 'HP LaserJet' })).toBe('HP LaserJet (Windows)')
    expect(describePrinterTarget({ kind: 'serial', port: 'COM3', baud: 9600 })).toBe('COM3 · 9600')
    expect(describePrinterTarget({ kind: 'tcp', host: '192.168.1.50', port: 9100 })).toBe('192.168.1.50:9100 (red)')
    expect(describePrinterTarget({ kind: 'bluetooth', mac: 'AA:BB:CC:DD:EE:FF' })).toBe('BT AA:BB:CC:DD:EE:FF')
    expect(describePrinterTarget({ kind: 'usb-android', deviceId: 3 })).toBe('USB (dispositivo 3)')
    expect(describePrinterTarget({ kind: 'debug-file' })).toBe('Guardar en archivo (debug)')
  })

  test('datos de otra versión no rompen la etiqueta ni la clave', () => {
    const desconocido = { kind: 'puerto-paralelo', nombre: 'LPT1' } as unknown as PrinterTarget
    expect(describePrinterTarget(desconocido)).toBe('Impresora desconocida')
    expect(printerTargetKey(desconocido)).toBe('unknown')
  })

  test('la clave identifica al destino completo, sin colisiones entre transportes', () => {
    expect(printerTargetKey({ kind: 'spooler', name: 'HP LaserJet' })).toBe('spooler:HP LaserJet')
    expect(printerTargetKey({ kind: 'serial', port: 'COM3', baud: 9600 })).toBe('serial:COM3:9600')
    expect(printerTargetKey({ kind: 'tcp', host: '192.168.1.50', port: 9100 })).toBe('tcp:192.168.1.50:9100')
    expect(printerTargetKey({ kind: 'bluetooth', mac: 'AA:BB:CC:DD:EE:FF' })).toBe('bluetooth:AA:BB:CC:DD:EE:FF')
    expect(printerTargetKey({ kind: 'usb-android', deviceId: 3 })).toBe('usb-android:3')
    expect(printerTargetKey({ kind: 'debug-file' })).toBe('debug-file')

    // Un spooler llamado COM3 no es el puerto serie COM3.
    expect(printerTargetKey({ kind: 'spooler', name: 'COM3' }))
      .not.toBe(printerTargetKey({ kind: 'serial', port: 'COM3', baud: 9600 }))

    // El mismo destino siempre da la misma clave; otro baudio es otro destino.
    const serie: PrinterTarget = { kind: 'serial', port: 'COM3', baud: 9600 }
    expect(printerTargetKey(serie)).toBe(printerTargetKey({ kind: 'serial', port: 'COM3', baud: 9600 }))
    expect(printerTargetKey(serie)).not.toBe(printerTargetKey({ kind: 'serial', port: 'COM3', baud: 19200 }))
  })

  test('la migración replica la clasificación vieja por la forma del nombre', () => {
    expect(migrateLegacyPrinterName(null)).toBeNull()
    expect(migrateLegacyPrinterName('')).toBeNull()
    expect(migrateLegacyPrinterName('   ')).toBeNull()

    // Nombre mágico de la impresora virtual de debug.
    expect(migrateLegacyPrinterName('GUARDAR EN ARCHIVO (DEBUG)')).toEqual({ kind: 'debug-file' })

    // Cualquier cosa que empiece con COM era un puerto serie abierto a 9600, con el nombre intacto.
    expect(migrateLegacyPrinterName('COM3')).toEqual({ kind: 'serial', port: 'COM3', baud: 9600 })
    expect(migrateLegacyPrinterName('com7')).toEqual({ kind: 'serial', port: 'com7', baud: 9600 })
    expect(migrateLegacyPrinterName('COMODORO')).toEqual({ kind: 'serial', port: 'COMODORO', baud: 9600 })

    // Todo lo demás iba al spooler, con el nombre tal cual (es el que espera Windows).
    expect(migrateLegacyPrinterName('Impresora fixture')).toEqual({ kind: 'spooler', name: 'Impresora fixture' })
    expect(migrateLegacyPrinterName('EPSON TM-T20III')).toEqual({ kind: 'spooler', name: 'EPSON TM-T20III' })
    // El prefijo se mira sólo en la posición 0.
    expect(migrateLegacyPrinterName('IMPRESORA COM3')).toEqual({ kind: 'spooler', name: 'IMPRESORA COM3' })
  })
})
