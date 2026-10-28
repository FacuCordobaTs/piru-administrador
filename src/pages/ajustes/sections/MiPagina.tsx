import { useState } from 'react'
import { toast } from 'sonner'
import { ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { sitiosApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

/**
 * Páginas (docs/PAGINAS_PROPIAS.md): el editor vive en `pages.piru.app`. El panel sólo lo abre en
 * otra pestaña con un pase de dos minutos, sin login, como la app de marketing.
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
    <div className="space-y-5">
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>
          Con <strong className="text-foreground">Páginas</strong> tu tienda puede tener un diseño hecho a medida, escrito en
          código (por vos, por un diseñador o por Claude), en <strong className="text-foreground">tu-local.piru.app</strong>.
        </p>
        <p>
          La carta, los precios, los horarios y los pedidos siguen saliendo de este panel. El cobro se hace siempre en la tienda de
          Piru, y tu tienda de siempre sigue funcionando en my.piru.app.
        </p>
      </div>
      <Button onClick={abrir} disabled={abriendo || !token}>
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
