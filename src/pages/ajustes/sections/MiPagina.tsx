import { useNavigate } from 'react-router'
import { ExternalLink, Gem, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAbrirPaginas } from '@/hooks/useAbrirPaginas'
import { nombrePlan, planIncluye, usePlanTienda } from '@/store/planTiendaStore'
import { EscenaTienda } from '../components/EscenaTienda'

/**
 * Tienda (Páginas): la plantilla, las preferencias y el código de la tienda viven en
 * `pages.piru.app`. El panel sólo abre esa app en otra pestaña con un pase de dos minutos.
 */
export default function MiPagina() {
  const navigate = useNavigate()
  // Páginas es el diseño personalizado: desde el plan Esencial (el backend también lo exige).
  const { plan } = usePlanTienda()
  const conDiseno = planIncluye(plan, 'diseno_personalizado')
  const { abrir, abriendo, bloqueada, disponible } = useAbrirPaginas()

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
      {conDiseno ? (
        <Button size="lg" onClick={abrir} disabled={abriendo || !disponible}>
          {abriendo ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
          Abrir Páginas
        </Button>
      ) : (
        <div className="space-y-3">
          <p className="mx-auto max-w-md text-balance text-sm">
            Hoy tu tienda usa el diseño de Piru. Desde el plan {nombrePlan(plan, 'esencial')} elegís una plantilla y la personalizás con tu marca.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button size="lg" onClick={() => navigate('/dashboard/planes')}>
              <Gem className="size-4" />
              Ver planes
            </Button>
            <Button size="lg" variant="outline" onClick={abrir} disabled={abriendo || !disponible}>
              {abriendo ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
              Mirar los temas
            </Button>
          </div>
        </div>
      )}
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
