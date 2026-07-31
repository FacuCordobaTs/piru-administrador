import { useEffect, useState } from 'react'
import { Printer, Download, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

// La impresión automática de comandas solo existe en la app de escritorio (Tauri).
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window

const LATEST_JSON_URL = 'https://api.piru.app/public/updates/latest.json'
// Fallback por si latest.json no responde: la página de descarga.
const FALLBACK_URL = 'https://piru.app'
const DISMISS_KEY = 'piru:banner-descargar-app'

interface LatestJson {
  version?: string
  platforms?: {
    'windows-x86_64'?: { url?: string }
  }
}

/**
 * Banner que invita a los usuarios de la versión web a descargar la app de
 * escritorio, cuyo diferencial es imprimir la comanda automáticamente en una
 * impresora térmica apenas entra un pedido.
 *
 * No se muestra dentro de Tauri (ahí la función ya está disponible).
 */
export function DescargarAppBanner() {
  const [dismissed, setDismissed] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem(DISMISS_KEY) === '1'
  )
  const [downloadUrl, setDownloadUrl] = useState(FALLBACK_URL)
  const [version, setVersion] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (isTauri || dismissed) return
    let vivo = true
    fetch(LATEST_JSON_URL)
      .then((r) => (r.ok ? (r.json() as Promise<LatestJson>) : Promise.reject()))
      .then((data) => {
        if (!vivo) return
        const url = data.platforms?.['windows-x86_64']?.url
        if (url) setDownloadUrl(url)
        if (data.version) setVersion(data.version)
      })
      .catch(() => {
        /* dejamos el fallback */
      })
      .finally(() => vivo && setCargando(false))
    return () => {
      vivo = false
    }
  }, [dismissed])

  if (isTauri || dismissed) return null

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  return (
    <div className="rounded-2xl bg-muted/60 p-5 sm:p-6">
      {/* Encabezado: ícono + título + cerrar (fila propia, sin solaparse) */}
      <div className="flex items-start gap-3.5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background text-muted-foreground">
          <Printer className="h-[18px] w-[18px]" />
        </div>

        <div className="min-w-0 flex-1 pt-1">
          <p className="text-[15px] font-medium tracking-tight text-foreground">
            Imprimí tus comandas automáticamente
          </p>
        </div>

        <button
          onClick={dismiss}
          aria-label="Ocultar"
          className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-muted-foreground/60 transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-2.5 max-w-prose text-[13px] font-normal leading-relaxed text-muted-foreground">
        Estás usando Piru en el navegador. Descargá la app de escritorio y conectala a tu impresora
        térmica: cada vez que entra un pedido, la comanda se imprime sola.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Button asChild className="h-10 font-medium">
          <a href={downloadUrl} target="_blank" rel="noreferrer" download>
            {cargando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Descargar app
          </a>
        </Button>
        <span className="text-[12px] font-normal text-muted-foreground/70">
          Windows{version ? ` · v${version}` : ''}
        </span>
      </div>
    </div>
  )
}
