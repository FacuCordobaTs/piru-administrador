import { useState } from 'react'
import { toast } from 'sonner'
import { ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { sitiosApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { EscenaTienda } from '../components/EscenaTienda'

/**
 * Tienda (Páginas): la plantilla, las preferencias y el código de la tienda viven en
 * `pages.piru.app`. El panel sólo abre esa app en otra pestaña con un pase de dos minutos.
 */
export default function MiPagina() {
  const token = useAuthStore((s) => s.token)
  const [abriendo, setAbriendo] = useState(false)
  const [bloqueada, setBloqueada] = useState<string | null>(null)

  const abrir = async () => {
    if (!token) return
    setAbriendo(true)
    setBloqueada(null)
    try {
      const { data } = await sitiosApi.entrada(token)
      if (!window.open(data.url, '_blank')) setBloqueada(data.url)
    } catch (error) {
      toast.error('No pudimos abrir Páginas', { description: error instanceof Error ? error.message : 'Intentá de nuevo.' })
    } finally {
      setAbriendo(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-7 py-2 text-center">
      <div className="w-full overflow-hidden rounded-3xl border border-border/60 shadow-sm">
        <EscenaTienda />
      </div>
      <div className="space-y-3">
        <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">Diseñá tu tienda en Páginas</h2>
        <p className="mx-auto max-w-md text-balance text-sm text-muted-foreground">
          Secciones, colores, letras, logos y pedido en grupo, a mano o con tu IA. La carta, los precios y los pedidos siguen saliendo de este panel.
        </p>
      </div>
      <Button size="lg" onClick={abrir} disabled={abriendo || !token}>
        {abriendo ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
        Abrir Páginas
      </Button>
      {bloqueada && (
        <p className="text-sm">
          El navegador bloqueó la pestaña.{' '}
          <a className="font-semibold underline" href={bloqueada} target="_blank" rel="noopener noreferrer">
            Abrir Páginas
          </a>
        </p>
      )}
    </div>
  )
}
