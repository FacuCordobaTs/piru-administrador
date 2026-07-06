import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { repartidoresApi, ApiError } from '@/lib/api'
import { toast } from 'sonner'
import {
  Loader2,
  Truck,
  Users,
  Wallet,
  Package,
  CalendarDays,
  UserRound,
  Plus,
  UserCheck,
  UserX,
} from 'lucide-react'
import { Card } from '@/components/ui/card'

// ─────────────────────────────────────────────
// Estilos base "Phantom" (coherente con Métricas)
// ─────────────────────────────────────────────
const phantomCardClass = "bg-white dark:bg-zinc-950 rounded-[32px] shadow-xl shadow-zinc-200/40 dark:shadow-none border border-zinc-100 dark:border-zinc-800/80 overflow-hidden"

interface RepartidorStat {
  id: number
  nombre: string
  estado: 'activo' | 'inactivo'
  cantidadPedidos: number
  pedidosPagados: number
  totalRecaudado: number
  totalPedidos: number
}

type FilterMode = 'all' | 'month' | 'range'

export default function Repartidores() {
  const token = useAuthStore(s => s.token)
  const [stats, setStats] = useState<RepartidorStat[]>([])
  const [loading, setLoading] = useState(true)
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    return `${now.getFullYear()}-${month}`
  })
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const [nuevoNombre, setNuevoNombre] = useState('')
  const [creando, setCreando] = useState(false)
  const [togglingId, setTogglingId] = useState<number | null>(null)

  const openNativePicker = (input: HTMLInputElement) => {
    if (typeof input.showPicker === 'function') {
      input.showPicker()
    }
  }

  const periodLabel = useMemo(() => {
    if (filterMode === 'range' && fromDate && toDate) return `Rango: ${fromDate} al ${toDate}`
    if (filterMode === 'month' && selectedMonth) {
      const [year, month] = selectedMonth.split('-')
      return `Mes: ${month}/${year}`
    }
    return 'Todo el historial'
  }, [filterMode, fromDate, toDate, selectedMonth])

  const fetchStats = async () => {
    if (!token) return

    let filters: { from?: string; to?: string } | undefined

    if (filterMode === 'range') {
      if (!fromDate || !toDate) {
        toast.error('Completá ambas fechas para usar rango de días')
        return
      }
      if (fromDate > toDate) {
        toast.error('La fecha "desde" no puede ser mayor que "hasta"')
        return
      }
      filters = { from: fromDate, to: toDate }
    } else if (filterMode === 'month' && selectedMonth) {
      const [year, month] = selectedMonth.split('-').map(Number)
      const first = `${year}-${String(month).padStart(2, '0')}-01`
      const lastDay = new Date(year, month, 0).getDate()
      const last = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      filters = { from: first, to: last }
    }

    setLoading(true)
    try {
      const response = await repartidoresApi.stats(token, filters) as { success: boolean; data: RepartidorStat[] }
      if (response.success) {
        setStats(response.data)
      }
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error('Error al cargar repartidores', { description: error.message })
      } else {
        toast.error('Error de conexión')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

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
        toast.success('Repartidor agregado')
        await fetchStats()
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

  const maxRecaudado = useMemo(
    () => stats.reduce((m, r) => Math.max(m, r.totalRecaudado), 0),
    [stats]
  )

  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-background pb-24 selection:bg-[#FF7A00]/20 selection:text-[#FF7A00] overflow-x-hidden">

      {/* ── Header ── */}
      <div className="bg-white dark:bg-zinc-950/50 border-b border-zinc-200 dark:border-zinc-800/80 pb-6 relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-40 bg-linear-to-b from-[#FF7A00]/20 to-transparent pointer-events-none" />
        <div className="absolute top-[-50px] right-[-50px] opacity-10 dark:opacity-5 pointer-events-none">
          <Truck size={250} className="text-[#FF7A00]" />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-8 mt-12 relative z-10">
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-linear-to-r from-zinc-900 to-zinc-600 dark:from-white dark:to-zinc-400">
            Repartidores
          </h1>
          <p className="text-muted-foreground mt-2 font-medium">Pedidos entregados y total recaudado en envíos por repartidor.</p>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-8 mt-8 space-y-6">

        {/* Filtro de período */}
        <div className={`${phantomCardClass} p-4 sm:p-5`}>
          <div className="flex flex-col lg:flex-row lg:items-end gap-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
              <CalendarDays className="w-4 h-4 text-[#FF7A00]" />
              Filtro de período
            </div>

            <div className="flex gap-2 flex-wrap">
              {([['all', 'Todo'], ['month', 'Mes específico'], ['range', 'Rango de días']] as [FilterMode, string][]).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setFilterMode(mode)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${filterMode === mode
                    ? 'bg-[#FF7A00] text-white border-[#FF7A00]'
                    : 'bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {filterMode === 'month' && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-500">Mes</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  onFocus={(e) => openNativePicker(e.currentTarget)}
                  onClick={(e) => openNativePicker(e.currentTarget)}
                  onKeyDown={(e) => { if (e.key !== 'Tab') e.preventDefault() }}
                  className="h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm"
                />
              </div>
            )}

            {filterMode === 'range' && (
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-500">Desde</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    onFocus={(e) => openNativePicker(e.currentTarget)}
                    onClick={(e) => openNativePicker(e.currentTarget)}
                    onKeyDown={(e) => { if (e.key !== 'Tab') e.preventDefault() }}
                    className="h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-500">Hasta</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    onFocus={(e) => openNativePicker(e.currentTarget)}
                    onClick={(e) => openNativePicker(e.currentTarget)}
                    onKeyDown={(e) => { if (e.key !== 'Tab') e.preventDefault() }}
                    className="h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm"
                  />
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={fetchStats}
              className="h-10 px-4 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Aplicar
            </button>
          </div>
          <p className="text-xs text-zinc-400 mt-3">{periodLabel}</p>
        </div>

        {/* KPIs resumen */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <Card className={`${phantomCardClass} p-5 flex flex-col justify-between group cursor-default`}>
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Repartidores activos</span>
              <div className="p-2 bg-zinc-100 dark:bg-zinc-900 rounded-xl group-hover:bg-[#FF7A00]/10 transition-colors">
                <Users className="w-4 h-4 text-zinc-600 dark:text-zinc-400 group-hover:text-[#FF7A00] transition-colors" />
              </div>
            </div>
            <div className="text-3xl font-bold tracking-tight text-foreground">{totales.activos}</div>
            <div className="text-xs mt-1 font-medium text-zinc-400">de {stats.length} en total</div>
          </Card>

          <Card className={`${phantomCardClass} p-5 flex flex-col justify-between group cursor-default`}>
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Pedidos entregados</span>
              <div className="p-2 bg-zinc-100 dark:bg-zinc-900 rounded-xl group-hover:bg-[#FF7A00]/10 transition-colors">
                <Package className="w-4 h-4 text-zinc-600 dark:text-zinc-400 group-hover:text-[#FF7A00] transition-colors" />
              </div>
            </div>
            <div className="text-3xl font-bold tracking-tight text-foreground">{totales.pedidos}</div>
            <div className="text-xs mt-1 font-medium text-zinc-400">En el período seleccionado</div>
          </Card>

          <Card className={`${phantomCardClass} p-5 flex flex-col justify-between group cursor-default`}>
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Recaudado en envíos</span>
              <div className="p-2 bg-zinc-100 dark:bg-zinc-900 rounded-xl group-hover:bg-[#FF7A00]/10 transition-colors">
                <Wallet className="w-4 h-4 text-zinc-600 dark:text-zinc-400 group-hover:text-[#FF7A00] transition-colors" />
              </div>
            </div>
            <div className="text-3xl font-bold tracking-tight text-foreground">
              ${totales.recaudado.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs mt-1 font-medium text-zinc-400">Suma de precios de envío</div>
          </Card>
        </div>

        {/* Agregar repartidor */}
        <div className={`${phantomCardClass} p-4 sm:p-5`}>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs font-medium text-zinc-500">Nuevo repartidor</label>
              <input
                type="text"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCrear() }}
                placeholder="Nombre del repartidor"
                className="h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={handleCrear}
              disabled={creando}
              className="h-10 px-4 rounded-xl bg-[#FF7A00] text-white text-sm font-semibold hover:bg-[#E66E00] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {creando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Agregar
            </button>
          </div>
        </div>

        {/* Lista de repartidores */}
        <div className={`${phantomCardClass} p-6 sm:p-8`}>
          <div className="flex items-center gap-2 mb-6">
            <Truck className="w-5 h-5 text-[#FF7A00]" />
            <span className="text-lg font-bold tracking-tight text-foreground">Ranking de repartidores</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#FF7A00]" />
            </div>
          ) : stats.length === 0 ? (
            <div className="text-sm text-muted-foreground py-10 text-center bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
              Todavía no hay repartidores cargados. Agregá uno arriba para empezar.
            </div>
          ) : (
            <div className="space-y-3">
              {stats.map((r, idx) => {
                const pct = maxRecaudado > 0 ? (r.totalRecaudado / maxRecaudado) * 100 : 0
                return (
                  <div
                    key={r.id}
                    className={`rounded-2xl border p-4 sm:p-5 transition-all flex flex-col sm:flex-row sm:items-center gap-4 ${r.estado === 'activo'
                      ? 'border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/20'
                      : 'border-zinc-100 dark:border-zinc-800/60 bg-zinc-100/40 dark:bg-zinc-900/40 opacity-70'
                      }`}
                  >
                    {/* Identidad */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-xs font-black text-zinc-300 dark:text-zinc-700 bg-white dark:bg-zinc-950 w-8 h-8 flex items-center justify-center rounded-full shadow-xs border border-zinc-100 dark:border-zinc-800 shrink-0">
                        #{idx + 1}
                      </span>
                      <div className="h-10 w-10 rounded-full bg-[#FF7A00]/10 flex items-center justify-center shrink-0">
                        <UserRound className="h-5 w-5 text-[#FF7A00]" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-foreground truncate flex items-center gap-2">
                          {r.nombre}
                          {r.estado === 'inactivo' && (
                            <span className="text-[10px] bg-zinc-200 dark:bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full font-bold uppercase">Inactivo</span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-400 font-medium mt-0.5">
                          {r.cantidadPedidos} pedido{r.cantidadPedidos === 1 ? '' : 's'}
                          {r.pedidosPagados > 0 && ` · ${r.pedidosPagados} pagado${r.pedidosPagados === 1 ? '' : 's'}`}
                        </div>
                      </div>
                    </div>

                    {/* Recaudado + barra */}
                    <div className="sm:w-64 shrink-0">
                      <div className="flex items-baseline justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Recaudado en envíos</span>
                        <span className="text-lg font-bold tracking-tight text-foreground">
                          ${r.totalRecaudado.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden shadow-inner">
                        <div style={{ width: `${Math.max(pct > 0 ? 4 : 0, pct)}%` }} className="h-full bg-linear-to-r from-orange-400 to-[#FF7A00]" />
                      </div>
                    </div>

                    {/* Acción */}
                    <button
                      type="button"
                      onClick={() => handleToggle(r)}
                      disabled={togglingId === r.id}
                      className={`h-9 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shrink-0 disabled:opacity-50 ${r.estado === 'activo'
                        ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                        }`}
                    >
                      {togglingId === r.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : r.estado === 'activo'
                          ? <UserX className="w-3.5 h-3.5" />
                          : <UserCheck className="w-3.5 h-3.5" />}
                      {r.estado === 'activo' ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
