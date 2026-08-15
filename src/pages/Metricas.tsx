import { useEffect, useMemo, useState, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useModuloActivo } from '@/store/modulosStore'
import { metricasApi, ApiError } from '@/lib/api'
import { toast } from 'sonner'
import { Loader2, TrendingUp, Truck, Globe, ShoppingBag } from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import Repartidores from './Repartidores'

// =============================================================================
// ESTADÍSTICAS — contenedor con pantalla de selección + tabs flotantes
// Diseño aireado, centrado, tipográfico (estilo Apple). Acento en naranja
// (brand) para la sección activa y las acciones principales.
// =============================================================================

type SeccionMetricas = 'estadisticas' | 'repartidores'

interface SeccionMeta {
  key: SeccionMetricas
  label: string
  icon: typeof TrendingUp
  descripcion: string
}

const SECCIONES: SeccionMeta[] = [
  {
    key: 'estadisticas',
    label: 'Estadísticas',
    icon: TrendingUp,
    descripcion: 'Facturación, medios de pago, origen de las ventas y productos.',
  },
  {
    key: 'repartidores',
    label: 'Repartidores',
    icon: Truck,
    descripcion: 'Pedidos entregados y total recaudado en envíos por repartidor.',
  },
]

export default function Metricas() {
  const gestionCadetesActiva = useModuloActivo('gestion_cadetes')
  const [tab, setTab] = useState<SeccionMetricas | null>(null)
  const secciones = gestionCadetesActiva
    ? SECCIONES
    : SECCIONES.filter((seccion) => seccion.key !== 'repartidores')

  // La estadística general continúa disponible; la de cadetes no queda abierta
  // si el módulo se desactiva durante la sesión.
  useEffect(() => {
    if (!gestionCadetesActiva && tab === 'repartidores') setTab('estadisticas')
  }, [gestionCadetesActiva, tab])

  if (tab === null) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full overflow-auto bg-[#FFFBF0] dark:bg-background px-6 py-12">
        <div className="w-full max-w-xl text-center">
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-foreground mb-10">
            Estadísticas
          </h1>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            ¿Qué querés ver?
          </h2>
          <p className="text-sm text-muted-foreground mt-1.5">
            Elegí una sección para empezar.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8">
            {secciones.map(seccion => (
              <SeccionCard key={seccion.key} seccion={seccion} onClick={() => setTab(seccion.key)} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FFFBF0] dark:bg-background">
      {/* Tab switcher — botones flotantes, centrados */}
      <div className="bg-[#FFFBF0] dark:bg-background px-4 sm:px-6 pt-6 pb-2 shrink-0">
        <div className="flex items-center justify-center gap-2">
          {secciones.map(seccion => (
            <TabButton
              key={seccion.key}
              active={tab === seccion.key}
              onClick={() => setTab(seccion.key)}
              icon={seccion.icon}
            >
              {seccion.label}
            </TabButton>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'estadisticas' ? <MetricasPanel /> : gestionCadetesActiva ? <Repartidores /> : <MetricasPanel />}
      </div>
    </div>
  )
}

function SeccionCard({ seccion, onClick }: {
  seccion: SeccionMeta
  onClick: () => void
}) {
  const Icon = seccion.icon
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center text-center gap-3 p-6 rounded-2xl bg-white dark:bg-muted/40 transition-colors cursor-pointer hover:bg-muted"
    >
      <div className="w-12 h-12 rounded-2xl bg-[#FFFBF0] dark:bg-background flex items-center justify-center text-brand shadow-sm">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-foreground">{seccion.label}</h2>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{seccion.descripcion}</p>
      </div>
    </button>
  )
}

function TabButton({ active, onClick, icon: Icon, children }: {
  active: boolean
  onClick: () => void
  icon: typeof TrendingUp
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 h-9 rounded-full text-sm font-medium transition-colors ${
        active
          ? 'bg-brand text-white shadow-sm shadow-brand/25'
          : "bg-white dark:bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <Icon className="w-4 h-4" />
      {children}
    </button>
  )
}

// =============================================================================
// SELECTOR DE PERÍODO (reutilizable) — reemplaza el <input type="month"> nativo,
// que no abre picker en el webview de escritorio (Tauri/WebKitGTK). Con Selects
// funciona en todas las plataformas.
// =============================================================================
export type PeriodMode = 'month' | 'range'
export interface PeriodValue {
  mode: PeriodMode
  mes: number   // 1-12
  anio: number
  from: string  // YYYY-MM-DD
  to: string
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function PeriodSelector({
  value, onChange, extraAll,
}: {
  value: PeriodValue
  onChange: (v: PeriodValue) => void
  extraAll?: { active: boolean; onSelectAll: () => void }
}) {
  const anioActual = new Date().getFullYear()
  const anios = Array.from({ length: 4 }, (_, i) => anioActual - i)

  return (
    <div className="inline-flex flex-wrap items-center justify-center gap-2">
      {extraAll && (
        <button
          type="button"
          onClick={extraAll.onSelectAll}
          className={`h-9 px-3.5 rounded-full text-xs font-medium transition-colors ${
            extraAll.active
              ? 'bg-brand text-white shadow-sm shadow-brand/25'
              : "bg-white dark:bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          Todo
        </button>
      )}

      <Select
        value={value.mode}
        onValueChange={(m) => onChange({ ...value, mode: m as PeriodMode })}
      >
        <SelectTrigger className="w-auto gap-1.5 h-9 rounded-full border-0 bg-white dark:bg-muted/60 text-xs font-medium">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="month">Por mes</SelectItem>
          <SelectItem value="range">Por rango</SelectItem>
        </SelectContent>
      </Select>

      {value.mode === 'month' ? (
        <>
          <Select value={String(value.mes)} onValueChange={(m) => onChange({ ...value, mes: Number(m) })}>
            <SelectTrigger className="w-auto gap-1.5 h-9 rounded-full border-0 bg-white dark:bg-muted/60 text-xs font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESES.map((nombre, i) => (
                <SelectItem key={i} value={String(i + 1)}>{nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(value.anio)} onValueChange={(a) => onChange({ ...value, anio: Number(a) })}>
            <SelectTrigger className="w-auto gap-1.5 h-9 rounded-full border-0 bg-white dark:bg-muted/60 text-xs font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {anios.map((a) => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={value.from}
            max={value.to || undefined}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            className="h-9 px-3 rounded-full bg-white dark:bg-muted/60 text-xs text-foreground border-0 outline-none"
          />
          <span className="text-xs text-muted-foreground">a</span>
          <input
            type="date"
            value={value.to}
            min={value.from || undefined}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            className="h-9 px-3 rounded-full bg-white dark:bg-muted/60 text-xs text-foreground border-0 outline-none"
          />
        </div>
      )}
    </div>
  )
}

export function periodLabelOf(v: PeriodValue, allActive?: boolean): string {
  if (allActive) return 'Todo el historial'
  if (v.mode === 'range') {
    if (v.from && v.to) return `${v.from} al ${v.to}`
    return 'Elegí las dos fechas'
  }
  return `${MESES[v.mes - 1]} ${v.anio}`
}

// =============================================================================
// PANEL DE ESTADÍSTICAS
// =============================================================================
interface MetricasData {
  ingresos: { mensual: number; historico: number; mensualManual?: number; mensualWeb?: number }
  pedidos: {
    mensuales: number; mensualesPagados: number
    mensualesManual?: number; mensualesWeb?: number; historicos: number
  }
  desgloseMetodoPago: Array<{ metodoPago: string; total: number }>
  topProductos: Array<{ productoId: number; nombre: string; cantidad: number; totalVendido: number }>
}

const fmtMoney = (n: number) =>
  `$${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

function MetricasPanel() {
  const token = useAuthStore(s => s.token)
  const [data, setData] = useState<MetricasData | null>(null)
  const [loading, setLoading] = useState(true)

  const [period, setPeriod] = useState<PeriodValue>(() => {
    const now = new Date()
    return { mode: 'month', mes: now.getMonth() + 1, anio: now.getFullYear(), from: '', to: '' }
  })

  const fetchMetricas = useCallback(async (p: PeriodValue) => {
    if (!token) return
    if (p.mode === 'range' && (!p.from || !p.to)) return
    setLoading(true)
    try {
      const filters = p.mode === 'range' ? { from: p.from, to: p.to } : { month: p.mes, year: p.anio }
      const response = await metricasApi.get(token, filters) as { success: boolean; data: MetricasData }
      if (response.success) setData(response.data)
    } catch (error) {
      if (error instanceof ApiError) toast.error('Error al cargar estadísticas', { description: error.message })
      else toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchMetricas(period)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, period.mode, period.mes, period.anio, period.from, period.to])

  const periodLabel = periodLabelOf(period)

  const pagos = useMemo(() => {
    let efectivo = 0, mp = 0, transf = 0, tarjeta = 0
    for (const p of data?.desgloseMetodoPago ?? []) {
      const m = p.metodoPago ? p.metodoPago.toLowerCase() : ''
      if (m.includes('efectivo') || m.includes('cash')) efectivo += p.total
      else if (m.includes('mercadopago') || m.includes('mp')) mp += p.total
      else if (m.includes('transferencia') || m.includes('manual')) transf += p.total
      else tarjeta += p.total
    }
    const total = efectivo + mp + transf + tarjeta || 1
    return [
      { label: 'Efectivo', value: efectivo, pct: (efectivo / total) * 100 },
      { label: 'Mercado Pago', value: mp, pct: (mp / total) * 100 },
      { label: 'Transferencias', value: transf, pct: (transf / total) * 100 },
      { label: 'Tarjeta', value: tarjeta, pct: (tarjeta / total) * 100 },
    ].filter(x => x.value > 0)
  }, [data])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-7 w-7 animate-spin text-brand" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center text-muted-foreground min-h-[60vh]">
        No se pudieron cargar las estadísticas.
      </div>
    )
  }

  const { ingresos, pedidos, topProductos } = data
  const totalPeriodo = ingresos.mensual
  const ticket = pedidos.mensuales > 0 ? Math.round(totalPeriodo / pedidos.mensuales) : 0
  const ingresoWeb = ingresos.mensualWeb ?? 0
  const ingresoManual = ingresos.mensualManual ?? 0
  const pedidosWeb = pedidos.mensualesWeb ?? 0
  const pedidosManual = pedidos.mensualesManual ?? 0
  const baseOrigen = (ingresoWeb + ingresoManual) > 0 ? (ingresoWeb + ingresoManual) : 1
  const pctWeb = Math.round((ingresoWeb / baseOrigen) * 100)
  const pctManual = Math.round((ingresoManual / baseOrigen) * 100)

  return (
    <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 space-y-5">

      {/* Selector de período, centrado */}
      <div className="flex justify-center">
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Hero: facturación del período */}
      <div className="text-center pt-3 pb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Facturado · {periodLabel}
        </p>
        <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight text-foreground tabular-nums mt-3">
          {fmtMoney(totalPeriodo)}
        </h1>
        <p className="text-sm text-muted-foreground mt-3">
          {pedidos.mensuales} {pedidos.mensuales === 1 ? 'pedido' : 'pedidos'}
          {ticket > 0 && <> · ticket promedio <span className="text-foreground font-medium">{fmtMoney(ticket)}</span></>}
        </p>
      </div>

      {/* Medios de pago + Origen — dos paneles lado a lado */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Cómo te pagaron */}
        <Panel title="Cómo te pagaron">
          {pagos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin cobros en el período.</p>
          ) : (
            <div className="space-y-3">
              {pagos.map((it) => (
                <div key={it.label} className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-foreground">{it.label}</span>
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-sm font-semibold tabular-nums text-foreground">{fmtMoney(it.value)}</span>
                    <span className="text-xs text-muted-foreground tabular-nums w-9 text-right">{Math.round(it.pct)}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Origen de las ventas */}
        <Panel title="Origen de las ventas">
          <div className="space-y-4">
            <OrigenRow
              icon={<Globe className="w-4 h-4" />}
              titulo="Por la web"
              monto={ingresoWeb}
              hint={`${pedidosWeb} ped · ${pctWeb}%`}
            />
            <OrigenRow
              icon={<ShoppingBag className="w-4 h-4" />}
              titulo="Anotados a mano"
              monto={ingresoManual}
              hint={`${pedidosManual} ped · ${pctManual}%`}
            />
          </div>
        </Panel>
      </div>

      {/* Productos más vendidos */}
      <Panel title="Los más pedidos">
        {topProductos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay ventas registradas en el período.</p>
        ) : (
          <div className="divide-y divide-border">
            {topProductos.map((tp, idx) => (
              <div key={idx} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="text-sm font-semibold tabular-nums text-muted-foreground w-5 shrink-0">
                  {idx + 1}
                </span>
                <span className="flex-1 min-w-0 text-sm font-medium text-foreground truncate">
                  {tp.nombre}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">{tp.cantidad} u</span>
                <span className="text-sm font-semibold tabular-nums text-foreground w-24 text-right shrink-0">
                  {fmtMoney(tp.totalVendido)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Acumulado histórico */}
      <Panel title="Acumulado histórico">
        <div className="flex divide-x divide-border">
          <div className="flex-1 pr-4">
            <div className="text-2xl font-semibold text-foreground tabular-nums">{fmtMoney(ingresos.historico)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Facturación total</div>
          </div>
          <div className="flex-1 pl-4">
            <div className="text-2xl font-semibold text-foreground tabular-nums">{pedidos.historicos.toLocaleString('es-AR')}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Pedidos históricos</div>
          </div>
        </div>
      </Panel>
    </div>
  )
}

// Panel suave "flotante": blanco en light, relleno gris sin borde duro en dark.
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-muted/40 p-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-4">
        {title}
      </h3>
      {children}
    </div>
  )
}

function OrigenRow({ icon, titulo, monto, hint }: {
  icon: React.ReactNode
  titulo: string
  monto: number
  hint: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-full bg-[#FFFBF0] dark:bg-background flex items-center justify-center text-brand shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground">{titulo}</div>
        <div className="text-xs text-muted-foreground tabular-nums">{hint}</div>
      </div>
      <div className="text-base font-semibold text-foreground tabular-nums shrink-0">{fmtMoney(monto)}</div>
    </div>
  )
}
