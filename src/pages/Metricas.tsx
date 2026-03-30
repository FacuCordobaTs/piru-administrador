import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { metricasApi, ApiError } from '@/lib/api'
import { toast } from 'sonner'
import {
  Loader2,
  TrendingUp,
  Wallet,
  Package,
  CalendarDays,
} from 'lucide-react'
import { Card } from '@/components/ui/card'

// ─────────────────────────────────────────────
// Estilos base "Phantom"
// ─────────────────────────────────────────────
const phantomCardClass = "bg-white dark:bg-zinc-950 rounded-[32px] shadow-xl shadow-zinc-200/40 dark:shadow-none border border-zinc-100 dark:border-zinc-800/80 overflow-hidden"

interface MetricasData {
  ingresos: {
    mensual: number;
    historico: number;
  };
  pedidos: {
    mensuales: number;
    mensualesPagados: number;
    historicos: number;
  };
  desgloseMetodoPago: Array<{
    metodoPago: string;
    total: number;
  }>;
  topProductos: Array<{
    productoId: number;
    nombre: string;
    cantidad: number;
    totalVendido: number;
  }>;
}

export default function Metricas() {
  const token = useAuthStore(s => s.token)
  const [data, setData] = useState<MetricasData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterMode, setFilterMode] = useState<'month' | 'range'>('month')
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    return `${now.getFullYear()}-${month}`
  })
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const openNativePicker = (input: HTMLInputElement) => {
    if (typeof input.showPicker === 'function') {
      input.showPicker()
    }
  }

  const periodLabel = useMemo(() => {
    if (filterMode === 'range' && fromDate && toDate) {
      return `Rango: ${fromDate} al ${toDate}`
    }
    if (selectedMonth) {
      const [year, month] = selectedMonth.split('-')
      return `Mes: ${month}/${year}`
    }
    return 'Periodo actual'
  }, [filterMode, fromDate, toDate, selectedMonth])

  const fetchMetricas = async () => {
    if (!token) return

    if (filterMode === 'range') {
      if (!fromDate || !toDate) {
        toast.error('Completá ambas fechas para usar rango de días')
        return
      }
      if (fromDate > toDate) {
        toast.error('La fecha "desde" no puede ser mayor que "hasta"')
        return
      }
    }

    setLoading(true)
    try {
      let filters: { month?: number; year?: number; from?: string; to?: string } | undefined

      if (filterMode === 'range') {
        filters = { from: fromDate, to: toDate }
      } else if (selectedMonth) {
        const [year, month] = selectedMonth.split('-').map(Number)
        filters = { month, year }
      }

      const response = await metricasApi.get(token, filters) as { success: boolean; data: MetricasData }
      if (response.success) {
        setData(response.data)
      }
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error('Error al cargar métricas', { description: error.message })
      } else {
        toast.error('Error de conexión')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMetricas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 min-h-dvh bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-[#FF7A00]" />
          <p className="text-sm text-zinc-500 font-medium">Calculando métricas del período...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground p-4 bg-zinc-50 dark:bg-zinc-950 min-h-dvh">
        No se pudieron cargar las métricas.
      </div>
    )
  }

  const { ingresos, pedidos, desgloseMetodoPago, topProductos } = data

  const totalMensual = ingresos.mensual
  
  let pagoEfectivo = 0
  let pagoMP = 0
  let pagoTransf = 0
  let pagoTarjeta = 0

  desgloseMetodoPago.forEach(p => {
    const m = p.metodoPago ? p.metodoPago.toLowerCase() : ''
    
    if (m.includes('efectivo') || m.includes('cash')) {
      pagoEfectivo += p.total
    } else if (m.includes('mercadopago') || m.includes('mp')) {
      pagoMP += p.total
    } else if (m.includes('transferencia') || m.includes('manual')) {
      pagoTransf += p.total
    } else {
      pagoTarjeta += p.total
    }
  })

  let sumaMediosDePago = pagoEfectivo + pagoMP + pagoTransf + pagoTarjeta;
  // Para los porcentajes usamos la suma total de los medios de pago para que la barra siempre sume 100% de lo reportado
  // (es posible que algunos ingresos totales tengan pequeñas diferencias decimales con el agrupado)
  const basePorcentaje = sumaMediosDePago > 0 ? sumaMediosDePago : 1;

  const pctEfectivo = (pagoEfectivo / basePorcentaje) * 100
  const pctMP = (pagoMP / basePorcentaje) * 100
  const pctTransf = (pagoTransf / basePorcentaje) * 100
  const pctTarjeta = (pagoTarjeta / basePorcentaje) * 100

  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-background pb-24 selection:bg-[#FF7A00]/20 selection:text-[#FF7A00] overflow-x-hidden">
      
      {/* ── Header ── */}
      <div className="bg-white dark:bg-zinc-950/50 border-b border-zinc-200 dark:border-zinc-800/80 pb-6 relative overflow-hidden">
        {/* Decorative background */}
        <div className="absolute top-0 inset-x-0 h-40 bg-linear-to-b from-[#FF7A00]/20 to-transparent pointer-events-none" />
        <div className="absolute top-[-50px] right-[-50px] opacity-10 dark:opacity-5 pointer-events-none">
          <TrendingUp size={250} className="text-[#FF7A00]" />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-8 mt-12 relative z-10">
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-linear-to-r from-zinc-900 to-zinc-600 dark:from-white dark:to-zinc-400">
            Métricas
          </h1>
          <p className="text-muted-foreground mt-2 font-medium">Rendimiento financiero y operativo por período.</p>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-8 mt-8 space-y-6">
        <div className={`${phantomCardClass} p-4 sm:p-5`}>
          <div className="flex flex-col lg:flex-row lg:items-end gap-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
              <CalendarDays className="w-4 h-4 text-[#FF7A00]" />
              Filtro de período
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFilterMode('month')}
                className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${filterMode === 'month'
                  ? 'bg-[#FF7A00] text-white border-[#FF7A00]'
                  : 'bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                  }`}
              >
                Mes específico
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('range')}
                className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${filterMode === 'range'
                  ? 'bg-[#FF7A00] text-white border-[#FF7A00]'
                  : 'bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                  }`}
              >
                Rango de días
              </button>
            </div>

            {filterMode === 'month' ? (
              <div className="flex items-end gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-500">Mes</label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    onFocus={(e) => openNativePicker(e.currentTarget)}
                    onClick={(e) => openNativePicker(e.currentTarget)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Tab') e.preventDefault()
                    }}
                    className="h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm"
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-500">Desde</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    onFocus={(e) => openNativePicker(e.currentTarget)}
                    onClick={(e) => openNativePicker(e.currentTarget)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Tab') e.preventDefault()
                    }}
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
                    onKeyDown={(e) => {
                      if (e.key !== 'Tab') e.preventDefault()
                    }}
                    className="h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm"
                  />
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={fetchMetricas}
              className="h-10 px-4 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Aplicar
            </button>
          </div>
        </div>

        {/* 1. Tarjeta Principal (Facturado este mes) Phantom Style */}
        <div className={`${phantomCardClass} p-6 sm:p-8 relative overflow-hidden bg-linear-to-br from-white to-zinc-50 dark:from-zinc-950 dark:to-black`}>
          {/* Subtle Orange accent line */}
          <div className="absolute top-0 inset-x-0 h-1 bg-linear-to-r from-[#FF7A00]/50 via-[#FF7A00] to-[#FF7A00]/50" />
          
          <div className="flex flex-col mb-8 relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Facturado en período seleccionado</span>
              <span className="text-[10px] bg-[#FF7A00]/10 text-[#FF7A00] px-2 py-0.5 rounded-full border border-[#FF7A00]/20 font-bold">ACTUAL</span>
            </div>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">{periodLabel}</span>
            <h2 className="text-5xl sm:text-6xl font-extrabold text-foreground tracking-tight drop-shadow-xs">
              ${totalMensual.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              <span className="text-2xl sm:text-3xl text-zinc-400 dark:text-zinc-600 font-medium ml-1">,{(totalMensual % 1).toFixed(2).split('.')[1]}</span>
            </h2>
          </div>

          {/* Barra de Distribución de Medios de Pago */}
          <div className="relative z-10">
            <div className="flex justify-between items-end mb-2">
              <span className="text-xs font-semibold text-zinc-500 uppercase">Medios de Pago</span>
            </div>
            
            <div className="h-5 w-full flex rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-800/80 mb-3 shadow-inner">
              {pctEfectivo > 0 && (
                <div style={{ width: `${pctEfectivo}%` }} className="bg-emerald-500 hover:brightness-110 transition-all duration-700" title={`Efectivo: ${pctEfectivo.toFixed(1)}%`} />
              )}
              {pctTarjeta > 0 && (
                <div style={{ width: `${pctTarjeta}%` }} className="bg-pink-500 hover:brightness-110 transition-all duration-700" title={`Tarjeta: ${pctTarjeta.toFixed(1)}%`} />
              )}
              {pctMP > 0 && (
                <div style={{ width: `${pctMP}%` }} className="bg-sky-500 hover:brightness-110 transition-all duration-700" title={`MercadoPago: ${pctMP.toFixed(1)}%`} />
              )}
              {pctTransf > 0 && (
                <div style={{ width: `${pctTransf}%` }} className="bg-violet-500 hover:brightness-110 transition-all duration-700" title={`Transferencia: ${pctTransf.toFixed(1)}%`} />
              )}
            </div>

            {/* Leyenda inteligente */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-zinc-600 dark:text-zinc-400 font-medium">
              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs"></div>Efectivo ({Math.round(pctEfectivo)}%) - ${pagoEfectivo.toLocaleString('es-AR')}</div>
              {pctTarjeta > 0 && <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-pink-500 shadow-xs"></div>Tarjeta ({Math.round(pctTarjeta)}%) - ${pagoTarjeta.toLocaleString('es-AR')}</div>}
              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-sky-500 shadow-xs"></div>Mercado Pago ({Math.round(pctMP)}%) - ${pagoMP.toLocaleString('es-AR')}</div>
              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-violet-500 shadow-xs"></div>Transferencias ({Math.round(pctTransf)}%) - ${pagoTransf.toLocaleString('es-AR')}</div>
            </div>
          </div>
        </div>

        {/* 2. Grid de KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          
          <Card className={`${phantomCardClass} p-5 flex flex-col justify-between hover:border-[#FF7A00]/30 transition-colors group cursor-default`}>
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Total Histórico</span>
              <div className="p-2 bg-zinc-100 dark:bg-zinc-900 rounded-xl group-hover:bg-[#FF7A00]/10 transition-colors">
                <Wallet className="w-4 h-4 text-zinc-600 dark:text-zinc-400 group-hover:text-[#FF7A00] transition-colors" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-bold tracking-tight text-foreground">
                ${ingresos.historico.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              <div className="text-xs mt-1 font-medium text-zinc-400">Desde el inicio de los tiempos</div>
            </div>
          </Card>

          <Card className={`${phantomCardClass} p-5 flex flex-col justify-between hover:border-[#FF7A00]/30 transition-colors group cursor-default`}>
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Cantidad de pedidos</span>
              <div className="p-2 bg-zinc-100 dark:bg-zinc-900 rounded-xl group-hover:bg-[#FF7A00]/10 transition-colors">
                <Package className="w-4 h-4 text-zinc-600 dark:text-zinc-400 group-hover:text-[#FF7A00] transition-colors" />
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold tracking-tight text-foreground">
                  {pedidos.mensuales}
                </div>
                <div className="text-xs mt-1 font-medium text-zinc-400">Pedidos en período</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold tracking-tight text-zinc-600 dark:text-zinc-300">
                  {pedidos.historicos}
                </div>
                <div className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">Históricos</div>
              </div>
            </div>
          </Card>

        </div>

        {/* 3. Top Productos */}
        <div className={`${phantomCardClass} p-6 sm:p-8 mt-6`}>
          <div className="flex items-center justify-between mb-6">
            <div className="text-lg font-bold flex items-center gap-2 tracking-tight text-foreground">
              <TrendingUp className="w-5 h-5 text-[#FF7A00]" />
              Top Productos del Período
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {topProductos.length === 0 ? (
              <div className="text-sm text-muted-foreground col-span-full py-8 text-center bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                Aún no hay ventas registradas este mes.
              </div>
            ) : topProductos.map((tp, idx) => {
              const percentage = totalMensual > 0 ? (tp.totalVendido / totalMensual) * 100 : 0
              return (
                <div key={idx} className="rounded-2xl border border-zinc-100 dark:border-zinc-800/80 p-4 bg-zinc-50/50 dark:bg-zinc-900/20 hover:shadow-md hover:bg-white dark:hover:bg-zinc-900 transition-all flex flex-col justify-between group">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-black text-zinc-300 dark:text-zinc-700 bg-white dark:bg-zinc-950 px-2 py-0.5 rounded-full shadow-xs border border-zinc-100 dark:border-zinc-800">#{idx + 1}</span>
                      <span className="text-sm font-mono font-bold text-foreground">
                        ${tp.totalVendido.toLocaleString('es-AR')}
                      </span>
                    </div>
                    <div className="font-semibold text-sm truncate text-foreground group-hover:text-[#FF7A00] transition-colors" title={tp.nombre}>
                      {tp.nombre}
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-zinc-500 font-medium mb-1.5">
                      <span>{tp.cantidad} unid.</span>
                      <span>{percentage.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden shadow-inner">
                      <div style={{ width: `${Math.max(3, percentage)}%` }} className="h-full bg-linear-to-r from-orange-400 to-[#FF7A00]" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}
