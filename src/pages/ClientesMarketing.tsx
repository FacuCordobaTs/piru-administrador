import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { CalendarDays, ExternalLink, Link2, Loader2, MessageCircle, Sparkles, TrendingUp, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { marketingDuenioApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

const SECCIONES = [
  { icono: Users, nombre: 'Clientes', detalle: 'Tu base, con sus hábitos y sus favoritos.' },
  { icono: Link2, nombre: 'Campañas y cupones', detalle: 'Un link por historia y lo que vendió cada uno.' },
  { icono: MessageCircle, nombre: 'Recompra por WhatsApp', detalle: 'Mensajes que salen del WhatsApp de tu local.' },
  { icono: Sparkles, nombre: 'Puntos', detalle: 'El club que les da una razón para volver.' },
  { icono: CalendarDays, nombre: 'Días flojos', detalle: 'A quién invitar cuando hay menos movimiento.' },
  { icono: TrendingUp, nombre: 'Estadísticas', detalle: 'Ventas cobradas, pedidos y lo más vendido.' },
]

/**
 * Los deep links de antes (`?tab=retencion&vista=puntos`, los redirects de Ajustes, Mis módulos)
 * siguen llegando acá: abren la app de marketing directo en la sección equivalente.
 */
function destinoDeLaUrl(params: URLSearchParams): { seccion: string; nombre: string } | null {
  const tab = params.get('tab')
  const vista = params.get('vista')
  if (tab === 'clientes') return { seccion: 'clientes', nombre: 'Clientes' }
  if (tab === 'cupones' || vista === 'cupones') return { seccion: 'cupones', nombre: 'Cupones' }
  if (tab === 'adquisicion' || tab === 'campanas' || tab === 'crecimiento') return { seccion: 'campanas', nombre: 'Campañas' }
  if (tab === 'retencion' || tab === 'recompra') {
    return vista === 'puntos' ? { seccion: 'puntos', nombre: 'Puntos' } : { seccion: 'recompra', nombre: 'Recompra' }
  }
  return null
}

/**
 * Clientes, campañas, cupones, puntos y recompra viven en la app de marketing (`marketers/`, en
 * modo dueño). El panel sólo la abre: pide un pase de dos minutos y la abre en otra pestaña, sin
 * login, para que este panel siga abierto recibiendo e imprimiendo pedidos.
 */
export default function ClientesMarketing() {
  const token = useAuthStore((s) => s.token)
  const [searchParams] = useSearchParams()
  const destino = destinoDeLaUrl(searchParams)
  const [abriendo, setAbriendo] = useState(false)
  const [bloqueada, setBloqueada] = useState<string | null>(null)

  const abrir = async () => {
    if (!token) return
    setAbriendo(true)
    setBloqueada(null)
    try {
      const { data } = await marketingDuenioApi.entrada(token)
      const url = destino ? `${data.url}&destino=${destino.seccion}` : data.url
      if (!window.open(url, '_blank')) setBloqueada(url)
    } catch (error) {
      toast.error('No pudimos abrir la app de marketing', {
        description: error instanceof Error ? error.message : 'Intentá de nuevo.',
      })
    } finally {
      setAbriendo(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto bg-[#FFFBF0] px-4 py-12 dark:bg-background sm:px-6">
      <div className="mx-auto w-full max-w-3xl text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
          Clientes
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground sm:text-base">
          Tus clientes, campañas, cupones, puntos y mensajes de recompra ahora están en la app de marketing de Piru.
        </p>

        <div className="mx-auto mt-10 rounded-2xl border border-border/80 bg-white p-6 text-left shadow-sm dark:bg-card sm:p-8">
          <ul className="grid gap-5 sm:grid-cols-2">
            {SECCIONES.map(({ icono: Icono, nombre, detalle }) => (
              <li key={nombre} className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
                  <Icono className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-foreground">{nombre}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{detalle}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-col items-center gap-3 border-t border-border/60 pt-6 text-center">
            <Button size="lg" onClick={abrir} disabled={abriendo || !token} className="w-full sm:w-auto">
              {abriendo ? <Loader2 className="animate-spin" /> : <ExternalLink />}
              {destino ? `Abrir ${destino.nombre} en la app de marketing` : 'Abrir la app de marketing'}
            </Button>
            <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
              Se abre en otra pestaña con tu cuenta, sin contraseña. Este panel queda abierto para tus pedidos.
            </p>
            {bloqueada && (
              <p role="alert" className="text-sm text-foreground">
                Tu navegador no abrió la pestaña.{' '}
                <a
                  href={bloqueada}
                  target="_blank"
                  rel="noopener"
                  onClick={() => setBloqueada(null)}
                  className="font-semibold underline underline-offset-4"
                >
                  Abrila desde acá
                </a>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
