import { useNavigate } from 'react-router'
import { ArrowRight, CheckCircle2, PartyPopper } from 'lucide-react'
import { useTareasPendientes } from '../hooks/useTareasPendientes'
import { SectionSkeleton } from '../components/SectionSkeleton'

/**
 * "Primeros pasos": centro de próximos pasos que baja el time-to-value (tarea 2.9).
 * Modo lectura — cada paso es una oración que describe el estado actual y, si está
 * pendiente, un link discreto que salta a la sección/página que lo resuelve (los
 * pagos/horarios/zonas a su sección de Ajustes; las fotos a la página de productos).
 * No es una pantalla de ajustes: no se configura nada acá, sólo se orienta.
 */
export default function Tareas() {
  const navigate = useNavigate()
  const { items, pendientes, total, loading } = useTareasPendientes()

  if (loading) return <SectionSkeleton />

  const completadas = total - pendientes
  const pendientesList = items.filter((i) => !i.hecha)
  const hechasList = items.filter((i) => i.hecha)

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-lg font-medium text-foreground">Primeros pasos</h2>
        <p className="text-sm font-normal text-muted-foreground">
          Lo que falta para sacarle todo el jugo a Piru.
        </p>
      </header>

      {/* Progreso */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[13px] font-medium text-muted-foreground">
          <span>
            {completadas} de {total} listo
          </span>
          {pendientes === 0 && <span className="text-brand">¡Todo configurado!</span>}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-brand transition-all duration-500"
            style={{ width: `${total ? (completadas / total) * 100 : 0}%` }}
          />
        </div>
      </div>

      {pendientes === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/10">
            <PartyPopper className="h-7 w-7 text-brand" />
          </div>
          <p className="text-base font-medium text-foreground">Tu local está listo para vender</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            No te queda nada por configurar. Compartí tu link y empezá a recibir pedidos.
          </p>
        </div>
      ) : (
        <ul>
          {pendientesList.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border/50 py-3.5"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium text-foreground">{item.titulo}</p>
                  <p className="text-[13px] font-normal text-muted-foreground">{item.oracion}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate(item.to)}
                className="group inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-brand transition-colors hover:text-brand/80"
              >
                {item.cta}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Ya resuelto — atenuado, para que se vea el avance */}
      {hechasList.length > 0 && pendientes > 0 && (
        <div className="space-y-0.5 pt-2">
          <p className="pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Ya está
          </p>
          {hechasList.map((item) => (
            <div key={item.id} className="flex items-center gap-3 py-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-brand" />
              <p className="truncate text-sm font-medium text-muted-foreground line-through decoration-muted-foreground/30">
                {item.titulo}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
