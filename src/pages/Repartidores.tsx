import { useEffect, useMemo, useState, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'
import { repartidoresApi, ApiError } from '@/lib/api'
import { toast } from 'sonner'
import { Loader2, UserRound, Plus, X } from 'lucide-react'
import { PeriodSelector, periodLabelOf, type PeriodValue } from './Metricas'

interface RepartidorStat {
  id: number
  nombre: string
  estado: 'activo' | 'inactivo'
  cantidadPedidos: number
  pedidosPagados: number
  totalRecaudado: number
  totalPedidos: number
}

const fmtMoney = (n: number) =>
  `$${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const rangoDeMes = (mes: number, anio: number) => {
  const first = `${anio}-${String(mes).padStart(2, '0')}-01`
  const lastDay = new Date(anio, mes, 0).getDate()
  const last = `${anio}-${String(mes).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { from: first, to: last }
}

export default function Repartidores() {
  const token = useAuthStore(s => s.token)
  const [stats, setStats] = useState<RepartidorStat[]>([])
  const [loading, setLoading] = useState(true)

  const [verTodo, setVerTodo] = useState(true)
  const [period, setPeriod] = useState<PeriodValue>(() => {
    const now = new Date()
    return { mode: 'month', mes: now.getMonth() + 1, anio: now.getFullYear(), from: '', to: '' }
  })

  const [agregando, setAgregando] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [creando, setCreando] = useState(false)
  const [togglingId, setTogglingId] = useState<number | null>(null)

  const fetchStats = useCallback(async (todo: boolean, p: PeriodValue) => {
    if (!token) return
    let filters: { from?: string; to?: string } | undefined
    if (!todo) {
      if (p.mode === 'range') {
        if (!p.from || !p.to) return
        filters = { from: p.from, to: p.to }
      } else {
        filters = rangoDeMes(p.mes, p.anio)
      }
    }
    setLoading(true)
    try {
      const response = await repartidoresApi.stats(token, filters) as { success: boolean; data: RepartidorStat[] }
      if (response.success) setStats(response.data)
    } catch (error) {
      if (error instanceof ApiError) toast.error('Error al cargar repartidores', { description: error.message })
      else toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchStats(verTodo, period)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, verTodo, period.mode, period.mes, period.anio, period.from, period.to])

  const handleCrear = async () => {
    if (!token) return
    const nombre = nuevoNombre.trim()
    if (!nombre) {
      toast.error('Ingresá un nombre para el repartidor')
      return
    }
    setCreando(true)
    try {
      const res = await repartidoresApi.create(token, nombre) as { success: boolean }
      if (res.success) {
        setNuevoNombre('')
        setAgregando(false)
        toast.success('Repartidor agregado')
        await fetchStats(verTodo, period)
      }
    } catch (error) {
      if (error instanceof ApiError) toast.error('No se pudo crear', { description: error.message })
      else toast.error('Error de conexión')
    } finally {
      setCreando(false)
    }
  }

  const handleToggle = async (r: RepartidorStat) => {
    if (!token) return
    const nuevoEstado = r.estado === 'activo' ? 'inactivo' : 'activo'
    setTogglingId(r.id)
    try {
      const res = await repartidoresApi.toggleEstado(token, r.id, nuevoEstado) as { success: boolean }
      if (res.success) {
        setStats(prev => prev.map(x => x.id === r.id ? { ...x, estado: nuevoEstado } : x))
      }
    } catch {
      toast.error('No se pudo cambiar el estado')
    } finally {
      setTogglingId(null)
    }
  }

  const totales = useMemo(() => {
    return stats.reduce(
      (acc, r) => {
        acc.pedidos += r.cantidadPedidos
        acc.recaudado += r.totalRecaudado
        if (r.estado === 'activo') acc.activos += 1
        return acc
      },
      { pedidos: 0, recaudado: 0, activos: 0 }
    )
  }, [stats])

  const periodLabel = periodLabelOf(period, verTodo)

  return (
    <div className="max-w-2xl mx-auto w-full px-6 py-8 space-y-14">

      {/* Selector de período, centrado */}
      <div className="flex justify-center">
        <PeriodSelector
          value={period}
          onChange={(v) => { setVerTodo(false); setPeriod(v) }}
          extraAll={{ active: verTodo, onSelectAll: () => setVerTodo(true) }}
        />
      </div>

      {/* Hero: recaudado en envíos */}
      <div className="text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Recaudado en envíos · {periodLabel}
        </p>
        <h1 className="text-6xl sm:text-7xl font-semibold tracking-tight text-foreground tabular-nums mt-3">
          {fmtMoney(totales.recaudado)}
        </h1>
        <p className="text-sm text-muted-foreground mt-4">
          {totales.pedidos} {totales.pedidos === 1 ? 'entrega' : 'entregas'}
          {' · '}
          <span className="text-foreground font-medium">{totales.activos}</span> repartidor{totales.activos === 1 ? '' : 'es'} activo{totales.activos === 1 ? '' : 's'}
        </p>
      </div>

      {/* Ranking */}
      <section>
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground text-center">
          Ranking del equipo
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-14">
            <Loader2 className="w-6 h-6 animate-spin text-brand" />
          </div>
        ) : stats.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center mt-6">
            Todavía no hay repartidores. Agregá el primero para empezar.
          </p>
        ) : (
          <div className="mt-4 max-w-xl mx-auto divide-y divide-border/40">
            {stats.map((r, idx) => {
              const inactivo = r.estado === 'inactivo'
              return (
                <div key={r.id} className={`group flex items-center gap-4 py-4 ${inactivo ? 'opacity-50' : ''}`}>
                  <span className="text-lg font-semibold tabular-nums text-muted-foreground/40 w-6 shrink-0">
                    {idx + 1}
                  </span>
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${inactivo ? 'bg-muted text-muted-foreground' : 'bg-brand/10 text-brand'}`}>
                    <UserRound className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate flex items-center gap-2">
                      {r.nombre}
                      {inactivo && (
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">inactivo</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {r.cantidadPedidos} entrega{r.cantidadPedidos === 1 ? '' : 's'}
                      {r.pedidosPagados > 0 && ` · ${r.pedidosPagados} pagada${r.pedidosPagados === 1 ? '' : 's'}`}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold tabular-nums text-foreground">{fmtMoney(r.totalRecaudado)}</div>
                    <button
                      type="button"
                      onClick={() => handleToggle(r)}
                      disabled={togglingId === r.id}
                      className="text-[11px] text-muted-foreground hover:text-brand transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                    >
                      {togglingId === r.id && <Loader2 className="w-3 h-3 animate-spin" />}
                      {inactivo ? 'Activar' : 'Desactivar'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Agregar repartidor — revelado bajo demanda, sin caja permanente */}
        <div className="mt-6 flex justify-center">
          {agregando ? (
            <div className="flex items-center gap-2 w-full max-w-sm">
              <input
                autoFocus
                type="text"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCrear()
                  if (e.key === 'Escape') { setAgregando(false); setNuevoNombre('') }
                }}
                placeholder="Nombre del repartidor"
                className="h-10 flex-1 px-4 rounded-full bg-muted/60 text-sm text-foreground placeholder:text-muted-foreground/60 border-0 outline-none focus:ring-2 focus:ring-brand/40"
              />
              <button
                type="button"
                onClick={handleCrear}
                disabled={creando}
                className="h-10 px-4 rounded-full bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {creando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Agregar
              </button>
              <button
                type="button"
                onClick={() => { setAgregando(false); setNuevoNombre('') }}
                className="h-10 w-10 rounded-full text-muted-foreground hover:bg-muted flex items-center justify-center shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAgregando(true)}
              className="inline-flex items-center gap-1.5 h-10 px-5 rounded-full bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors shadow-sm shadow-brand/25"
            >
              <Plus className="w-4 h-4" />
              Agregar repartidor
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
