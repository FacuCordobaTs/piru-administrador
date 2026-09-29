import { describe, expect, test } from 'bun:test'
import { esAndroid, esAppTauri, pedirExcepcionDeBateria } from '../src/utils/piruAndroid'

type Puente = 'contador' | 'ausente' | 'vacio' | 'no-funcion' | 'roto'

/**
 * Arma el entorno que vería la app (Tauri y/o Android, con o sin puente) y lo desarma al salir:
 * Bun no tiene `window`, y el user agent real ("Bun/1.4.0") no dice nada de la plataforma.
 */
function conEntorno<T>(
  entorno: { tauri?: boolean; android?: boolean; puente?: Puente },
  prueba: (puente: { llamadas: number }) => T,
): T {
  const global = globalThis as { window?: unknown; navigator?: unknown }
  const windowPrevio = global.window
  const navigatorPrevio = global.navigator
  const puente = { llamadas: 0 }

  const PiruAndroid =
    entorno.puente === 'ausente' ? undefined
      : entorno.puente === 'vacio' ? {}
        : entorno.puente === 'no-funcion' ? { requestIgnoreBatteryOptimizations: 'abrir' }
          : entorno.puente === 'roto' ? { requestIgnoreBatteryOptimizations: () => { throw new Error('puente roto') } }
            : { requestIgnoreBatteryOptimizations: () => { puente.llamadas++ } }

  global.window = {
    ...(entorno.tauri ? { __TAURI_INTERNALS__: {} } : {}),
    ...(PiruAndroid === undefined ? {} : { PiruAndroid }),
  }
  global.navigator = {
    userAgent: entorno.android
      ? 'Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
      : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
  }

  try {
    return prueba(puente)
  } finally {
    if (windowPrevio === undefined) delete global.window
    else global.window = windowPrevio
    if (navigatorPrevio === undefined) delete global.navigator
    else global.navigator = navigatorPrevio
  }
}

describe('puente de batería de Android', () => {
  test('sólo Android dentro de la app cuenta como Android', () => {
    conEntorno({ tauri: true, android: true }, () => expect(esAndroid()).toBe(true))
    // Escritorio: Tauri sin Android.
    conEntorno({ tauri: true }, () => expect(esAndroid()).toBe(false))
    // Web en un teléfono: no hay app ni puente.
    conEntorno({ android: true }, () => expect(esAndroid()).toBe(false))
    conEntorno({}, () => expect(esAndroid()).toBe(false))
    // La app instalada se reconoce por `__TAURI_INTERNALS__`, igual que el aviso de actualización.
    conEntorno({ tauri: true }, () => expect(esAppTauri()).toBe(true))
  })

  test('en escritorio no se pide nada', () => {
    conEntorno({ tauri: true, puente: 'contador' }, (puente) => {
      expect(pedirExcepcionDeBateria()).toBe(false)
      expect(puente.llamadas).toBe(0)
    })
  })

  test('en Android pide la excepción: una llamada por click y sin argumentos', () => {
    conEntorno({ tauri: true, android: true, puente: 'contador' }, (puente) => {
      expect(pedirExcepcionDeBateria()).toBe(true)
      expect(puente.llamadas).toBe(1)
      // El puente no informa si el usuario aceptó, así que no hay estado que guardar: si vuelve a
      // pedirse (por ejemplo después de cancelar), se abre el diálogo otra vez.
      expect(pedirExcepcionDeBateria()).toBe(true)
      expect(puente.llamadas).toBe(2)
    })
  })

  test('sin puente avisa que no se pudo, sin tirar', () => {
    // APK anterior al puente: no existe el objeto.
    conEntorno({ tauri: true, android: true, puente: 'ausente' }, () => {
      expect(() => pedirExcepcionDeBateria()).not.toThrow()
      expect(pedirExcepcionDeBateria()).toBe(false)
    })
    // Existe el objeto pero no el método, o el método no es una función.
    conEntorno({ tauri: true, android: true, puente: 'vacio' }, () => {
      expect(pedirExcepcionDeBateria()).toBe(false)
    })
    conEntorno({ tauri: true, android: true, puente: 'no-funcion' }, () => {
      expect(pedirExcepcionDeBateria()).toBe(false)
    })
    // Un puente que tira tampoco rompe la pantalla de Ajustes.
    conEntorno({ tauri: true, android: true, puente: 'roto' }, () => {
      expect(() => pedirExcepcionDeBateria()).not.toThrow()
      expect(pedirExcepcionDeBateria()).toBe(false)
    })
  })
})
