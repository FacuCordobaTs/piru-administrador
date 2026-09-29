/**
 * Puente nativo de la app de Android (`window.PiruAndroid`, expuesto por `MainActivity.kt`).
 *
 * Android suspende las apps en segundo plano para ahorrar batería, y eso puede cortar una comanda
 * a mitad de camino. La excepción de optimización de batería es parte de lo mínimo que se decidió
 * para la tablet (pantalla encendida + excepción, sin foreground service): la app sigue viva sin
 * que nadie tenga que mirarla.
 *
 * El objeto no existe en el build de escritorio ni en un APK anterior a este puente, así que se
 * llama siempre con optional chaining y envuelto: no puede tirar. Si no está, la UI lo dice.
 */

declare global {
  interface Window {
    PiruAndroid?: {
      /** Abre el diálogo del sistema. No toma argumentos y no devuelve nada. */
      requestIgnoreBatteryOptimizations?: () => void
    }
  }
}

/** App instalada (escritorio o Android). La web no expone el puente. */
export function esAppTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/**
 * Android dentro de la app. Mismo criterio que usa el aviso de actualización para reconocer el
 * escritorio: el user agent es lo único que distingue la tablet de la PC en el WebView.
 */
export function esAndroid(): boolean {
  return esAppTauri() && typeof navigator !== 'undefined' && navigator.userAgent.includes('Android')
}

/**
 * Pide la excepción de optimización de batería: abre el diálogo del sistema y sigue.
 *
 * No hay resultado que esperar ni estado que guardar —el puente no informa si el usuario aceptó—,
 * así que devuelve si se pudo pedir, que es todo lo que se sabe desde acá. El diálogo lo cierra el
 * usuario; si cancela, no pasa nada: la app sigue funcionando y puede volver a pedirlo.
 */
export function pedirExcepcionDeBateria(): boolean {
  if (!esAndroid()) return false
  if (typeof window.PiruAndroid?.requestIgnoreBatteryOptimizations !== 'function') return false

  try {
    // Se llama como método del puente (no como función suelta): el objeto inyectado de Android
    // espera ser el receptor de la llamada.
    window.PiruAndroid?.requestIgnoreBatteryOptimizations?.()
    return true
  } catch {
    // Un puente que falla no puede romper la pantalla de Ajustes.
    return false
  }
}
