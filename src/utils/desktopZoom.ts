import { getCurrentWebview } from '@tauri-apps/api/webview'

const STORAGE_KEY = 'piru_desktop_zoom'
const DEFAULT_ZOOM = 1
const MIN_ZOOM = 0.5
const MAX_ZOOM = 2
const ZOOM_STEP = 0.1

const isTauri = () => '__TAURI_INTERNALS__' in window

const clampZoom = (zoom: number) =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(zoom * 10) / 10))

const readStoredZoom = () => {
  const storedZoom = Number.parseFloat(localStorage.getItem(STORAGE_KEY) ?? '')
  return Number.isFinite(storedZoom) ? clampZoom(storedZoom) : DEFAULT_ZOOM
}

export async function initializeDesktopZoom() {
  if (!isTauri()) return

  let currentZoom = readStoredZoom()
  const webview = getCurrentWebview()

  const applyZoom = async (nextZoom: number) => {
    const zoom = clampZoom(nextZoom)
    currentZoom = zoom
    localStorage.setItem(STORAGE_KEY, String(zoom))
    await webview.setZoom(zoom)
  }

  try {
    await applyZoom(currentZoom)
  } catch (error) {
    console.error('No se pudo restaurar el zoom de la app de escritorio', error)
  }

  window.addEventListener(
    'keydown',
    (event) => {
      if (!event.ctrlKey && !event.metaKey) return

      const isZoomIn = event.key === '+' || event.key === '='
      const isZoomOut = event.key === '-' || event.key === '_'
      const isZoomReset = event.key === '0'
      if (!isZoomIn && !isZoomOut && !isZoomReset) return

      event.preventDefault()
      const nextZoom = isZoomReset
        ? DEFAULT_ZOOM
        : currentZoom + (isZoomIn ? ZOOM_STEP : -ZOOM_STEP)
      void applyZoom(nextZoom).catch((error) => {
        console.error('No se pudo cambiar el zoom de la app de escritorio', error)
      })
    },
    { capture: true },
  )

  window.addEventListener(
    'wheel',
    (event) => {
      if (!event.ctrlKey && !event.metaKey) return

      event.preventDefault()
      void applyZoom(currentZoom + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)).catch(
        (error) => {
          console.error('No se pudo cambiar el zoom de la app de escritorio', error)
        },
      )
    },
    { capture: true, passive: false },
  )
}
