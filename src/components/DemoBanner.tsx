import { useEffect, useState } from 'react'
import { MessageCircle, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { esSesionDemo } from '@/lib/api'
import { whatsappDemo } from '@/lib/recorridoPanel'
import { useAuthStore } from '@/store/authStore'
import { useDatosEjemplo } from '@/store/datosEjemploStore'
import { useRestauranteStore } from '@/store/restauranteStore'

/**
 * El aviso de arriba del panel mientras hay datos de ejemplo (clientes, pedidos y campañas marcados
 * "EJEMPLO") o se está en la demo de prospección. Deja borrar los datos de ejemplo de un solo paso,
 * con confirmación: lo único que se va es lo marcado EJEMPLO.
 */
export function DemoBanner() {
  const token = useAuthStore((s) => s.token)
  const esDemo = esSesionDemo(token)
  const nombre = useRestauranteStore((s) => s.restaurante?.nombre ?? null)
  const estado = useDatosEjemplo((s) => s.estado)
  const trabajando = useDatosEjemplo((s) => s.trabajando)
  const cargar = useDatosEjemplo((s) => s.cargar)
  const borrar = useDatosEjemplo((s) => s.borrar)
  const volverACargar = useDatosEjemplo((s) => s.volverACargar)
  const [confirmando, setConfirmando] = useState(false)

  useEffect(() => {
    void cargar()
  }, [token, cargar])

  const hay = estado?.hay === true
  if (!esDemo && !hay) return null

  const confirmarBorrado = async () => {
    const ok = await borrar()
    setConfirmando(false)
    if (ok) toast.success('Listo: borramos los datos de ejemplo. Tu carta y tu configuración siguen igual.')
    else toast.error('No pudimos borrar los datos de ejemplo. Probá de nuevo.')
  }
  const cargarOtraVez = async () => {
    const ok = await volverACargar()
    if (ok) toast.success('Volvimos a cargar los datos de ejemplo.')
    else toast.error('No pudimos cargar los datos de ejemplo.')
  }

  return (
    <div
      role="region"
      aria-label="Datos de ejemplo"
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-brand/25 bg-brand-soft px-4 py-2.5"
    >
      <Sparkles className="h-4 w-4 shrink-0 text-brand-deep" />
      <p className="min-w-0 flex-1 basis-[240px] text-[13px] font-medium leading-snug text-ink">
        {esDemo
          ? hay
            ? `Estás en la demo${nombre ? ` de ${nombre}` : ''}: lo que dice EJEMPLO es de muestra.`
            : `Estás en la demo${nombre ? ` de ${nombre}` : ''}.`
          : 'Hay datos de ejemplo cargados: lo que dice EJEMPLO es de muestra.'}
      </p>

      {hay && !confirmando && (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          disabled={trabajando}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-semibold text-ink ring-1 ring-line transition-colors hover:bg-sand disabled:opacity-60"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Borrar datos de ejemplo
        </button>
      )}
      {hay && confirmando && (
        <span className="flex shrink-0 flex-wrap items-center gap-2 text-xs text-ink-2">
          Se borran los clientes, pedidos y campañas de ejemplo.
          <button
            type="button"
            onClick={confirmarBorrado}
            disabled={trabajando}
            className="inline-flex h-8 items-center rounded-full bg-ink px-3 text-xs font-semibold text-white disabled:opacity-60"
          >
            {trabajando ? 'Borrando…' : 'Sí, borrar'}
          </button>
          <button
            type="button"
            onClick={() => setConfirmando(false)}
            disabled={trabajando}
            className="inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold text-ink-2 hover:bg-white/70"
          >
            No
          </button>
        </span>
      )}
      {esDemo && !hay && estado !== null && (
        <button
          type="button"
          onClick={cargarOtraVez}
          disabled={trabajando}
          className="inline-flex h-8 shrink-0 items-center rounded-full bg-white px-3 text-xs font-semibold text-ink ring-1 ring-line transition-colors hover:bg-sand disabled:opacity-60"
        >
          {trabajando ? 'Cargando…' : 'Cargar datos de ejemplo'}
        </button>
      )}

      {esDemo && (
        <a
          href={whatsappDemo(nombre)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-brand px-3 text-xs font-semibold text-white transition-colors hover:bg-brand-deep"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Hablar con Facu
        </a>
      )}
    </div>
  )
}
