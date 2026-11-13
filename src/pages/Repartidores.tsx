import { useEffect, useMemo, useState, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'
import { repartidoresApi, ApiError } from '@/lib/api'
import { toast } from 'sonner'
import { Loader2, UserRound, Plus, X, Pencil } from 'lucide-react'
import { PeriodSelector, periodLabelOf, type PeriodValue } from './Metricas'
import { useModuloActivo } from '@/store/modulosStore'
import { useNavigate } from 'react-router'
import { PagosRepartidorDialog } from '@/components/repartidores/PagosRepartidorDialog'
import { FeriadosPanel } from '@/components/repartidores/FeriadosPanel'
import { formatearPesos, tienePagoConfigurado, type RepartidorStat } from '@/lib/repartidores'

const rangoDeMes = (mes: number, anio: number) => {
  const first = `${anio}-${String(mes).padStart(2, '0')}-01`
  const lastDay = new Date(anio, mes, 0).getDate()
  const last = `${anio}-${String(mes).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { from: first, to: last }
}

export default function Repartidores() {
  const gestionCadetesActiva = useModuloActivo('gestion_cadetes')
  const navigate = useNavigate()
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
  const [editandoPagos, setEditandoPagos] = useState<RepartidorStat | null>(null)

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
    if (gestionCadetesActiva) fetchStats(verTodo, period)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, gestionCadetesActiva, verTodo, period.mode, period.mes, period.anio, period.from, period.to])

  const refrescar = useCallback(() => {
    void fetchStats(verTodo, period)
  }, [fetchStats, verTodo, period])

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
        acc.entregas += r.entregas
        acc.dias += r.diasTrabajados
        acc.recaudado += r.totalRecaudado
        acc.pago += r.pagoTotal
        if (r.estado === 'activo') acc.activos += 1
        return acc
      },
      { entregas: 0, dias: 0, recaudado: 0, pago: 0, activos: 0 }
    )
  }, [stats])

  const periodLabel = periodLabelOf(period, verTodo)
  const equipoSinConfigurar = stats.length > 0 && stats.every((r) => !tienePagoConfigurado(r))

  if (!gestionCadetesActiva) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-xl font-semibold text-foreground">Gestión de cadetes</h1>
        <p className="mt-2 text-sm text-muted-foreground">Activala desde Módulos para administrar tu equipo de reparto.</p>
        <button onClick={() => navigate('/dashboard/modulos')} className="mt-6 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white">Ver módulos</button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto w-full px-6 py-8 space-y-10">

      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Gestión de cadetes</h1>
        <p className="text-sm text-muted-foreground">
          Tu equipo de reparto, lo que recaudó en envíos y lo que hay que pagarle. Definí el pago
          por envío y el fijo por día de cada cadete.
        </p>
      </header>

      {/* Selector de período, centrado */}
      <div className="flex justify-center">
        <PeriodSelector
          value={period}
          onChange={(v) => { setVerTodo(false); setPeriod(v) }}
          extraAll={{ active: verTodo, onSelectAll: () => setVerTodo(true) }}
        />
      </div>

      {/* Hero: recaudado en envíos y liquidación del equipo */}
      <div className="grid gap-8 sm:grid-cols-2 text-center">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Recaudado en envíos · {periodLabel}
          </p>
          <h2 className="text-5xl sm:text-6xl font-semibold tracking-tight text-foreground tabular-nums mt-3">
            {formatearPesos(totales.recaudado)}
          </h2>
          <p className="text-sm text-muted-foreground mt-3">
            {totales.entregas} {totales.entregas === 1 ? 'entrega' : 'entregas'}
            {' · '}
            <span className="text-foreground font-medium">{totales.activos}</span> repartidor{totales.activos === 1 ? '' : 'es'} activo{totales.activos === 1 ? '' : 's'}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            A pagar al equipo · {periodLabel}
          </p>
          <h2 className="text-5xl sm:text-6xl font-semibold tracking-tight text-foreground tabular-nums mt-3">
            {formatearPesos(totales.pago)}
          </h2>
          <p className="text-sm text-muted-foreground mt-3">
            {totales.dias} {totales.dias === 1 ? 'día trabajado' : 'días trabajados'}
            {' · '}
            {totales.entregas} {totales.entregas === 1 ? 'envío' : 'envíos'}
          </p>
        </div>
      </div>

      {/* Ranking */}
      <section>
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground text-center">
          Ranking del equipo
        </p>

        {equipoSinConfigurar && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Todavía no cargaste importes. Usá <span className="font-medium text-foreground">Pagos</span> en
            cada cadete para saber cuánto liquidar.
          </p>
        )}

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
              const configurado = tienePagoConfigurado(r)
              const detalle = `${r.entregas} ${r.entregas === 1 ? 'envío' : 'envíos'} × ${formatearPesos(r.precioEnvio)} + ${r.diasHabiles} hábil${r.diasHabiles === 1 ? '' : 'es'}, ${r.diasFinDeSemana} fin de semana, ${r.diasFeriados} feriado${r.diasFeriados === 1 ? '' : 's'}`
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
                      {r.entregas} entrega{r.entregas === 1 ? '' : 's'}
                      {r.diasTrabajados > 0 && ` · ${r.diasTrabajados} día${r.diasTrabajados === 1 ? '' : 's'}`}
                      {r.pedidosPagados > 0 && ` · ${r.pedidosPagados} pagada${r.pedidosPagados === 1 ? '' : 's'}`}
                    </div>
                    <div className="text-[11px] text-muted-foreground/80 mt-0.5">
                      Recaudó {formatearPesos(r.totalRecaudado)} en envíos
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setEditandoPagos(r)}
                        className="inline-flex items-center gap-1 text-muted-foreground hover:text-brand transition-colors"
                      >
                        <Pencil className="w-3 h-3" />
                        Pagos
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggle(r)}
                        disabled={togglingId === r.id}
                        className="text-muted-foreground hover:text-brand transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                      >
                        {togglingId === r.id && <Loader2 className="w-3 h-3 animate-spin" />}
                        {inactivo ? 'Activar' : 'Desactivar'}
                      </button>
                    </div>
                  </div>
                  <div className="text-right shrink-0" title={configurado ? detalle : undefined}>
                    {configurado ? (
                      <>
                        <div className="text-sm font-semibold tabular-nums text-foreground">{formatearPesos(r.pagoTotal)}</div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">a pagar</div>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditandoPagos(r)}
                        className="text-[11px] text-muted-foreground hover:text-brand transition-colors"
                      >
                        Configurar pagos
                      </button>
                    )}
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

      <FeriadosPanel token={token} onCambio={refrescar} />

      <PagosRepartidorDialog
        open={editandoPagos !== null}
        onOpenChange={(open) => { if (!open) setEditandoPagos(null) }}
        token={token}
        repartidor={editandoPagos}
        onGuardado={refrescar}
      />
    </div>
  )
}
