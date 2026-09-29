import { describe, expect, test } from 'bun:test'
import {
  BAUD_POR_DEFECTO,
  MENSAJE_BAUD,
  MENSAJE_DEVICE_ID,
  MENSAJE_PUERTO_TCP,
  TIPOS_CONEXION,
  borradorInicial,
  destinosDisponibles,
  errorBaud,
  errorDeviceId,
  errorPuertoTcp,
  esTipoConexion,
  targetDelBorrador,
} from '../src/pages/ajustes/sections/impresionEditor'
import { BAUD_MAXIMO, LIMITE_U16, LIMITE_U32 } from '../src/utils/printerLimits'
import {
  MANUAL_PRINTERS_STORAGE_KEY,
  agregarDestinoManual,
  esElMismoDestino,
  parsePrinterTarget,
  quitarDestinoManual,
  quitarManual,
  readStoredManualTargets,
  writeStoredManualTargets,
} from '../src/utils/printerTargetStorage'
import type { PrinterTarget } from '../src/utils/printerTypes'

describe('editor de impresora', () => {
  test('arma un destino por cada tipo de conexión', () => {
    const casos: Array<[Partial<ReturnType<typeof borradorInicial>>, PrinterTarget]> = [
      [{ tipo: 'spooler', nombre: ' EPSON TM-T20III ' }, { kind: 'spooler', name: 'EPSON TM-T20III' }],
      [{ tipo: 'serial', puertoSerie: 'COM3' }, { kind: 'serial', port: 'COM3', baud: BAUD_POR_DEFECTO }],
      [{ tipo: 'serial', puertoSerie: 'COM3', baud: '19200' }, { kind: 'serial', port: 'COM3', baud: 19200 }],
      [{ tipo: 'tcp', host: '192.168.1.50' }, { kind: 'tcp', host: '192.168.1.50', port: 9100 }],
      [{ tipo: 'tcp', host: 'impresora.local', puertoTcp: '9101' }, { kind: 'tcp', host: 'impresora.local', port: 9101 }],
      [{ tipo: 'bluetooth', mac: 'AA:BB:CC:DD:EE:FF' }, { kind: 'bluetooth', mac: 'AA:BB:CC:DD:EE:FF' }],
      [{ tipo: 'usb-android', deviceId: '0' }, { kind: 'usb-android', deviceId: 0 }],
      [{ tipo: 'usb-android', deviceId: '12' }, { kind: 'usb-android', deviceId: 12 }],
      [{ tipo: 'debug-file' }, { kind: 'debug-file' }],
    ]

    for (const [cambios, esperado] of casos) {
      const resultado = targetDelBorrador({ ...borradorInicial(), ...cambios })
      expect(resultado.ok).toBe(true)
      if (resultado.ok) expect(resultado.target).toEqual(esperado)
    }
  })

  test('no arma un destino incompleto: explica qué falta', () => {
    const invalidos: Partial<ReturnType<typeof borradorInicial>>[] = [
      { tipo: 'spooler' },
      { tipo: 'spooler', nombre: '   ' },
      { tipo: 'serial' },
      { tipo: 'serial', puertoSerie: 'COM3', baud: '' },
      { tipo: 'serial', puertoSerie: 'COM3', baud: '0' },
      { tipo: 'serial', puertoSerie: 'COM3', baud: '9600.5' },
      { tipo: 'tcp' },
      { tipo: 'tcp', host: '192.168.1.50', puertoTcp: '70000' },
      { tipo: 'tcp', host: '192.168.1.50', puertoTcp: '' },
      { tipo: 'bluetooth' },
      { tipo: 'usb-android' },
      { tipo: 'usb-android', deviceId: '-1' },
    ]

    for (const cambios of invalidos) {
      const resultado = targetDelBorrador({ ...borradorInicial(), ...cambios })
      expect(resultado.ok).toBe(false)
      if (!resultado.ok) expect(resultado.error.length).toBeGreaterThan(0)
    }
  })

  test('acota los tres campos numéricos al tipo que espera Rust', () => {
    // `tcp.port` es `u16`; `serial.baud` y `usb-android.deviceId` son `u32`. Lo que no entra en el
    // tipo no puede salir de la UI: antes lo rechazaba la deserialización, con un error crudo de IPC.
    const bordes: Array<[Partial<ReturnType<typeof borradorInicial>>, boolean]> = [
      [{ tipo: 'serial', puertoSerie: 'COM3', baud: '1' }, true],
      [{ tipo: 'serial', puertoSerie: 'COM3', baud: '115200' }, true],
      [{ tipo: 'serial', puertoSerie: 'COM3', baud: String(BAUD_MAXIMO) }, true],
      [{ tipo: 'serial', puertoSerie: 'COM3', baud: String(BAUD_MAXIMO + 1) }, false],
      [{ tipo: 'serial', puertoSerie: 'COM3', baud: String(LIMITE_U32) }, false],

      [{ tipo: 'tcp', host: '192.168.1.50', puertoTcp: '1' }, true],
      [{ tipo: 'tcp', host: '192.168.1.50', puertoTcp: '9100' }, true],
      [{ tipo: 'tcp', host: '192.168.1.50', puertoTcp: String(LIMITE_U16) }, true],
      [{ tipo: 'tcp', host: '192.168.1.50', puertoTcp: String(LIMITE_U16 + 1) }, false],
      [{ tipo: 'tcp', host: '192.168.1.50', puertoTcp: String(LIMITE_U32) }, false],

      [{ tipo: 'usb-android', deviceId: '0' }, true],
      [{ tipo: 'usb-android', deviceId: String(LIMITE_U32) }, true],
      [{ tipo: 'usb-android', deviceId: String(LIMITE_U32 + 1) }, false],
    ]

    for (const [cambios, valido] of bordes) {
      expect(targetDelBorrador({ ...borradorInicial(), ...cambios }).ok).toBe(valido)
    }

    // El borde exacto sale con el valor tipeado, no recortado.
    expect(targetDelBorrador({ ...borradorInicial(), tipo: 'tcp', host: '192.168.1.50', puertoTcp: String(LIMITE_U16) }))
      .toEqual({ ok: true, target: { kind: 'tcp', host: '192.168.1.50', port: LIMITE_U16 } })
    expect(targetDelBorrador({ ...borradorInicial(), tipo: 'usb-android', deviceId: String(LIMITE_U32) }))
      .toEqual({ ok: true, target: { kind: 'usb-android', deviceId: LIMITE_U32 } })
  })

  test('el campo numérico avisa mientras se escribe, sin esperar a guardar', () => {
    // Vacío no es error: todavía no se escribió nada.
    expect(errorBaud('')).toBeNull()
    expect(errorPuertoTcp('  ')).toBeNull()
    expect(errorDeviceId('')).toBeNull()

    expect(errorBaud('9600')).toBeNull()
    expect(errorBaud(String(BAUD_MAXIMO))).toBeNull()
    expect(errorBaud(String(BAUD_MAXIMO + 1))).toBe(MENSAJE_BAUD)
    expect(errorBaud('0')).toBe(MENSAJE_BAUD)
    expect(errorBaud('9600.5')).toBe(MENSAJE_BAUD)

    expect(errorPuertoTcp('9100')).toBeNull()
    expect(errorPuertoTcp(String(LIMITE_U16))).toBeNull()
    expect(errorPuertoTcp(String(LIMITE_U16 + 1))).toBe(MENSAJE_PUERTO_TCP)
    expect(errorPuertoTcp('0')).toBe(MENSAJE_PUERTO_TCP)

    expect(errorDeviceId('0')).toBeNull()
    expect(errorDeviceId(String(LIMITE_U32))).toBeNull()
    expect(errorDeviceId(String(LIMITE_U32 + 1))).toBe(MENSAJE_DEVICE_ID)

    // El mensaje que se ve al tipear es el mismo que devuelve el guardado.
    expect(targetDelBorrador({ ...borradorInicial(), tipo: 'serial', puertoSerie: 'COM3', baud: String(BAUD_MAXIMO + 1) }))
      .toEqual({ ok: false, error: MENSAJE_BAUD })
    expect(targetDelBorrador({ ...borradorInicial(), tipo: 'tcp', host: '192.168.1.50', puertoTcp: String(LIMITE_U16 + 1) }))
      .toEqual({ ok: false, error: MENSAJE_PUERTO_TCP })
    expect(targetDelBorrador({ ...borradorInicial(), tipo: 'usb-android', deviceId: String(LIMITE_U32 + 1) }))
      .toEqual({ ok: false, error: MENSAJE_DEVICE_ID })
  })

  test('el tipo que devuelve el selector se puede validar sin castear', () => {
    for (const info of TIPOS_CONEXION) expect(esTipoConexion(info.tipo)).toBe(true)
    expect(esTipoConexion('serial')).toBe(true)
    expect(esTipoConexion('impresora-fiscal')).toBe(false)
    expect(esTipoConexion('')).toBe(false)
  })

  test('la lista del selector fusiona lo descubierto con las cargadas a mano', () => {
    const descubierta: PrinterTarget = { kind: 'spooler', name: 'Impresora fixture' }
    const cocina: PrinterTarget = { kind: 'tcp', host: '192.168.1.50', port: 9100 }
    const barra: PrinterTarget = { kind: 'tcp', host: '192.168.1.51', port: 9100 }

    expect(destinosDisponibles([descubierta], [], null)).toEqual([descubierta])
    // Las dos manuales conviven: elegir la de cocina no puede sacar la de barra.
    expect(destinosDisponibles([descubierta], [cocina, barra], null)).toEqual([descubierta, cocina, barra])
    expect(destinosDisponibles([descubierta], [cocina, barra], cocina)).toEqual([descubierta, cocina, barra])
    expect(destinosDisponibles([descubierta], [cocina, barra], barra)).toEqual([descubierta, cocina, barra])
    // La misma impresora descubierta y cargada a mano no se duplica.
    expect(destinosDisponibles([descubierta], [{ kind: 'spooler', name: 'Impresora fixture' }], null)).toEqual([descubierta])
    expect(destinosDisponibles([cocina], [cocina], cocina)).toEqual([cocina])
    // La elegida sigue en la lista aunque ya no esté en ninguna de las otras dos.
    expect(destinosDisponibles([descubierta], [], barra)).toEqual([descubierta, barra])
    expect(destinosDisponibles([], [], barra)).toEqual([barra])
    // Descubrimientos repetidos tampoco.
    expect(destinosDisponibles([cocina, cocina], [], null)).toEqual([cocina])
    expect(destinosDisponibles([], [], null)).toEqual([])
  })
})

describe('impresoras cargadas a mano', () => {
  const cocina: PrinterTarget = { kind: 'tcp', host: '192.168.1.50', port: 9100 }
  const barra: PrinterTarget = { kind: 'tcp', host: '192.168.1.51', port: 9100 }

  test('agregar la misma impresora dos veces no la duplica', () => {
    const una = agregarDestinoManual([], cocina)
    expect(una).toEqual([cocina])

    // Otra vez el mismo destino (incluso con otro objeto igual) no agrega nada.
    expect(agregarDestinoManual(una, { kind: 'tcp', host: '192.168.1.50', port: 9100 })).toEqual([cocina])
    expect(agregarDestinoManual(una, cocina)).toBe(una)

    // Otra impresora sí, y se conserva el orden en que se agregaron.
    expect(agregarDestinoManual(una, barra)).toEqual([cocina, barra])
    // El puerto distingue destinos del mismo host.
    expect(agregarDestinoManual([cocina], { kind: 'tcp', host: '192.168.1.50', port: 9101 })).toEqual([
      cocina,
      { kind: 'tcp', host: '192.168.1.50', port: 9101 },
    ])
  })

  test('borrar una manual deja las demás', () => {
    expect(quitarDestinoManual([cocina, barra], barra)).toEqual([cocina])
    expect(quitarDestinoManual([cocina, barra], cocina)).toEqual([barra])
    // Misma clave, otro objeto: la identidad la da `printerTargetKey`.
    expect(quitarDestinoManual([cocina, barra], { kind: 'tcp', host: '192.168.1.51', port: 9100 })).toEqual([cocina])
    // Lo que no está no cambia nada.
    expect(quitarDestinoManual([cocina], barra)).toEqual([cocina])
    expect(quitarDestinoManual([], cocina)).toEqual([])
  })

  test('borrar el manual elegido deja al equipo sin impresora', () => {
    const estado = { manuales: [cocina, barra], seleccionado: barra }

    expect(quitarManual(estado, barra)).toEqual({ manuales: [cocina], seleccionado: null })
    // Borrar la que no estaba elegida no toca la elección.
    expect(quitarManual(estado, cocina)).toEqual({ manuales: [barra], seleccionado: barra })
    // Ni cuando no hay ninguna elegida.
    expect(quitarManual({ manuales: [cocina], seleccionado: null }, cocina)).toEqual({ manuales: [], seleccionado: null })
    // Misma impresora en otro objeto: también suelta la elección.
    expect(quitarManual({ manuales: [barra], seleccionado: barra }, { kind: 'tcp', host: '192.168.1.51', port: 9100 }))
      .toEqual({ manuales: [], seleccionado: null })
  })

  test('esElMismoDestino compara por clave, no por objeto', () => {
    expect(esElMismoDestino(cocina, { kind: 'tcp', host: '192.168.1.50', port: 9100 })).toBe(true)
    expect(esElMismoDestino(cocina, barra)).toBe(false)
    expect(esElMismoDestino(null, cocina)).toBe(false)
    expect(esElMismoDestino(cocina, null)).toBe(false)
    expect(esElMismoDestino(null, null)).toBe(false)
  })
})

describe('persistencia de las impresoras cargadas a mano', () => {
  const cocina: PrinterTarget = { kind: 'tcp', host: '192.168.1.50', port: 9100 }
  const barra: PrinterTarget = { kind: 'tcp', host: '192.168.1.51', port: 9100 }
  const debug: PrinterTarget = { kind: 'debug-file' }

  /** `localStorage` mínimo: Bun no tiene `window`, y el módulo se planta si no existe. */
  function conAlmacenamiento<T>(prueba: (datos: Map<string, string>) => T): T {
    const datos = new Map<string, string>()
    const global = globalThis as { window?: unknown }
    const previo = global.window
    global.window = {
      localStorage: {
        getItem: (clave: string) => datos.get(clave) ?? null,
        setItem: (clave: string, valor: string) => { datos.set(clave, valor) },
        removeItem: (clave: string) => { datos.delete(clave) },
      },
    }
    try {
      return prueba(datos)
    } finally {
      if (previo === undefined) delete global.window
      else global.window = previo
    }
  }

  test('dos manuales persisten las dos y vuelven en el mismo orden', () => {
    conAlmacenamiento((datos) => {
      writeStoredManualTargets([cocina, barra])
      // La clave guarda un array JSON de `PrinterTarget`, igual que viajan a Rust.
      expect(JSON.parse(datos.get(MANUAL_PRINTERS_STORAGE_KEY) ?? 'null')).toEqual([cocina, barra])
      expect(readStoredManualTargets()).toEqual([cocina, barra])

      // Y se leen aunque la elección sea otra (o no haya elección): son claves independientes.
      writeStoredManualTargets([cocina, barra, debug])
      expect(readStoredManualTargets()).toEqual([cocina, barra, debug])
    })
  })

  test('sin lista guardada no hay impresoras manuales', () => {
    conAlmacenamiento(() => {
      expect(readStoredManualTargets()).toEqual([])
    })
  })

  test('una entrada rota se descarta sin vaciar la lista', () => {
    conAlmacenamiento((datos) => {
      datos.set(MANUAL_PRINTERS_STORAGE_KEY, JSON.stringify([
        cocina,
        { kind: 'spooler' },
        'no soy un destino',
        null,
        { kind: 'serial', port: 'COM3', baud: '9600' },
        barra,
      ]))
      expect(readStoredManualTargets()).toEqual([cocina, barra])
    })

    // Lo repetido dentro del archivo guardado tampoco se duplica.
    conAlmacenamiento((datos) => {
      datos.set(MANUAL_PRINTERS_STORAGE_KEY, JSON.stringify([cocina, cocina, barra]))
      expect(readStoredManualTargets()).toEqual([cocina, barra])
    })

    // JSON irrecuperable o que no es una lista: se pierde la lista, no la app.
    conAlmacenamiento((datos) => {
      datos.set(MANUAL_PRINTERS_STORAGE_KEY, '[{"kind":"tcp","host":"192.168.1.50"')
      expect(readStoredManualTargets()).toEqual([])
      datos.set(MANUAL_PRINTERS_STORAGE_KEY, JSON.stringify(cocina))
      expect(readStoredManualTargets()).toEqual([])
    })
  })

  test('la lista vacía borra la clave en vez de dejar un array vacío', () => {
    conAlmacenamiento((datos) => {
      writeStoredManualTargets([cocina])
      expect(datos.has(MANUAL_PRINTERS_STORAGE_KEY)).toBe(true)

      writeStoredManualTargets([])
      expect(datos.has(MANUAL_PRINTERS_STORAGE_KEY)).toBe(false)
      expect(readStoredManualTargets()).toEqual([])
    })
  })

  test('agregar y borrar sobre lo guardado se apoya en las mismas claves', () => {
    conAlmacenamiento(() => {
      writeStoredManualTargets(agregarDestinoManual([], cocina))
      writeStoredManualTargets(agregarDestinoManual(readStoredManualTargets(), barra))
      expect(readStoredManualTargets()).toEqual([cocina, barra])

      // Repetir el alta no cambia lo guardado.
      writeStoredManualTargets(agregarDestinoManual(readStoredManualTargets(), cocina))
      expect(readStoredManualTargets()).toEqual([cocina, barra])

      const borrado = quitarManual({ manuales: readStoredManualTargets(), seleccionado: barra }, barra)
      writeStoredManualTargets(borrado.manuales)
      expect(readStoredManualTargets()).toEqual([cocina])
      expect(borrado.seleccionado).toBeNull()
    })
  })
})

describe('persistencia del destino', () => {
  test('acepta sólo destinos completos', () => {
    expect(parsePrinterTarget({ kind: 'spooler', name: 'HP LaserJet' })).toEqual({ kind: 'spooler', name: 'HP LaserJet' })
    expect(parsePrinterTarget({ kind: 'serial', port: 'COM3', baud: 9600 })).toEqual({ kind: 'serial', port: 'COM3', baud: 9600 })
    expect(parsePrinterTarget({ kind: 'tcp', host: '192.168.1.50', port: 9100 })).toEqual({ kind: 'tcp', host: '192.168.1.50', port: 9100 })
    expect(parsePrinterTarget({ kind: 'bluetooth', mac: 'AA:BB:CC:DD:EE:FF' })).toEqual({ kind: 'bluetooth', mac: 'AA:BB:CC:DD:EE:FF' })
    expect(parsePrinterTarget({ kind: 'usb-android', deviceId: 0 })).toEqual({ kind: 'usb-android', deviceId: 0 })
    expect(parsePrinterTarget({ kind: 'debug-file' })).toEqual({ kind: 'debug-file' })

    const rechazados: unknown[] = [
      null,
      undefined,
      '',
      'spooler:HP LaserJet',
      [],
      {},
      { kind: 'spooler' },
      { kind: 'spooler', name: '   ' },
      { kind: 'serial', port: 'COM3' },
      { kind: 'serial', port: 'COM3', baud: '9600' },
      { kind: 'serial', port: 'COM3', baud: 0 },
      { kind: 'tcp', host: '192.168.1.50', port: 70000 },
      { kind: 'bluetooth', mac: 42 },
      { kind: 'usb-android', deviceId: -1 },
      { kind: 'puerto-paralelo', nombre: 'LPT1' },
    ]

    for (const valor of rechazados) expect(parsePrinterTarget(valor)).toBeNull()

    // Los bordes de los tipos de Rust: por encima del u16/u32 lo guardado se descarta, porque
    // `serde` no lo podría leer del otro lado.
    expect(parsePrinterTarget({ kind: 'tcp', host: '192.168.1.50', port: LIMITE_U16 })).not.toBeNull()
    expect(parsePrinterTarget({ kind: 'tcp', host: '192.168.1.50', port: LIMITE_U16 + 1 })).toBeNull()
    expect(parsePrinterTarget({ kind: 'serial', port: 'COM3', baud: LIMITE_U32 })).not.toBeNull()
    expect(parsePrinterTarget({ kind: 'serial', port: 'COM3', baud: LIMITE_U32 + 1 })).toBeNull()
    expect(parsePrinterTarget({ kind: 'usb-android', deviceId: LIMITE_U32 })).not.toBeNull()
    expect(parsePrinterTarget({ kind: 'usb-android', deviceId: LIMITE_U32 + 1 })).toBeNull()
  })
})
