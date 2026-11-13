import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { repartidoresApi } from '@/lib/api'
import { formatearFechaFeriado, type FeriadosData } from '@/lib/repartidores'

interface Props {
  token: string | null
  onCambio: () => void
}

const anioActual = new Date().getFullYear()
const ANIOS = [anioActual + 1, anioActual, anioActual - 1]

/**
 * Calendario de feriados que usa la liquidación. Los nacionales se calculan por
 * ley en el backend (y cambian solos cada año); acá el local agrega los puentes
 * turísticos y los feriados locales, que son los que no se pueden inferir.
 */
export function FeriadosPanel({ token, onCambio }: Props) {
  const [anio, setAnio] = useState(anioActual)
  const [data, setData] = useState<FeriadosData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fecha, setFecha] = useState('')
  const [nombre, setNombre] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [eliminandoId, setEliminandoId] = useState<number | null>(null)

  const cargar = useCallback(async (anioConsulta: number) => {
    if (!token) return
    setLoading(true)
    try {
      const res = await repartidoresApi.feriados(token, anioConsulta) as { success: boolean; data: FeriadosData }
      if (res.success) setData(res.data)
    } catch (error) {
      toast.error('No se pudieron cargar los feriados', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void cargar(anio)
  }, [cargar, anio])

  const agregar = async () => {
    if (!token || guardando) return
    if (!fecha) {
      toast.error('Elegí la fecha del feriado')
      return
    }
    if (!nombre.trim()) {
      toast.error('Poné un nombre para el feriado')
      return
    }
    setGuardando(true)
    try {
      await repartidoresApi.crearFeriado(token, fecha, nombre.trim())
      setFecha('')
      setNombre('')
      await cargar(anio)
      onCambio()
      toast.success('Feriado agregado')
    } catch (error) {
      toast.error('No se pudo agregar el feriado', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (id: number) => {
    if (!token || eliminandoId !== null) return
    setEliminandoId(id)
    try {
      await repartidoresApi.eliminarFeriado(token, id)
      await cargar(anio)
      onCambio()
    } catch (error) {
      toast.error('No se pudo eliminar el feriado', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setEliminandoId(null)
    }
  }

  return (
    <section className="space-y-4 border-t border-border/40 pt-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Feriados
          </p>
          <p className="mt-1 max-w-lg text-xs text-muted-foreground">
            Los feriados nacionales se reconocen solos. Sumá los puentes turísticos o los feriados
            de tu ciudad: ese día el fijo del cadete se paga como feriado.
          </p>
        </div>
        <Select value={String(anio)} onValueChange={(v) => setAnio(Number(v))}>
          <SelectTrigger className="w-auto gap-1.5 h-9 rounded-full border-0 bg-white dark:bg-muted/60 text-xs font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ANIOS.map((a) => (
              <SelectItem key={a} value={String(a)}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-brand" />
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
              Nacionales de {anio}
            </p>
            <ul className="mt-2 max-h-64 space-y-1.5 overflow-auto pr-2 text-sm">
              {(data?.nacionales ?? []).map((f) => (
                <li key={f.fecha} className="flex items-baseline justify-between gap-3">
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {formatearFechaFeriado(f.fecha)}
                  </span>
                  <span className="min-w-0 truncate text-right text-xs text-foreground">{f.nombre}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
              Puentes y feriados propios
            </p>
            {data?.propios.length ? (
              <ul className="mt-2 max-h-48 space-y-1 overflow-auto pr-2">
                {data.propios.map((f) => (
                  <li key={f.id} className="flex items-center gap-2 text-xs">
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {formatearFechaFeriado(f.fecha)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-foreground">{f.nombre}</span>
                    <button
                      type="button"
                      onClick={() => void eliminar(f.id)}
                      disabled={eliminandoId === f.id}
                      aria-label={`Eliminar ${f.nombre}`}
                      className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                    >
                      {eliminandoId === f.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">No hay feriados propios cargados.</p>
            )}

            <div className="mt-3 space-y-2">
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  aria-label="Fecha del feriado"
                  className="h-9 rounded-xl bg-muted/40 text-xs"
                />
                <Input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void agregar() }}
                  placeholder="Puente turístico"
                  aria-label="Nombre del feriado"
                  className="h-9 min-w-0 flex-1 rounded-xl bg-muted/40 text-xs"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void agregar()}
                disabled={guardando}
                className="w-full gap-1.5"
              >
                {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Agregar feriado
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
