import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ArrowUpDown,
  Check,
  RotateCcw,
  Calendar,
  Store,
  Sparkles,
  Percent,
  Tag,
  Megaphone,
  Users,
  ShoppingBag,
  CheckCircle2,
} from 'lucide-react'
import type {
  SucursalGrowth,
  SegmentFilter,
  SortClienteKey,
  SortCampanaKey,
  SortCuponKey,
  EstadoCampanaFilter,
  TipoCampanaFilter,
  EstadoCuponFilter,
  TipoCuponFilter,
} from './types'
import { SEGMENTOS } from './types'

export interface FiltrosDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tab: 'clientes' | 'campanas' | 'cupones'
  totalResultados: number

  // Clientes
  segmento: SegmentFilter
  onSegmentoChange: (seg: SegmentFilter) => void
  conteoSegmentos: Record<string, number>
  sortCliente: SortClienteKey
  onSortClienteChange: (sort: SortClienteKey) => void

  // Campañas
  sortCampana: SortCampanaKey
  onSortCampanaChange: (sort: SortCampanaKey) => void
  estadoCampana: EstadoCampanaFilter
  onEstadoCampanaChange: (est: EstadoCampanaFilter) => void
  tipoCampana: TipoCampanaFilter
  onTipoCampanaChange: (tipo: TipoCampanaFilter) => void

  // Cupones
  sortCupon: SortCuponKey
  onSortCuponChange: (sort: SortCuponKey) => void
  estadoCupon: EstadoCuponFilter
  onEstadoCuponChange: (est: EstadoCuponFilter) => void
  tipoCupon: TipoCuponFilter
  onTipoCuponChange: (tipo: TipoCuponFilter) => void

  // Compartidos
  sucursales: SucursalGrowth[]
  sucursalId?: number
  onSucursalChange: (id?: number) => void
  from?: string
  to?: string
  onDateRangeChange: (from?: string, to?: string) => void

  // Reset
  onReset: () => void
  hasActiveFilters: boolean
}

export function FiltrosDialog({
  open,
  onOpenChange,
  tab,
  totalResultados,
  segmento,
  onSegmentoChange,
  conteoSegmentos,
  sortCliente,
  onSortClienteChange,
  sortCampana,
  onSortCampanaChange,
  estadoCampana,
  onEstadoCampanaChange,
  tipoCampana,
  onTipoCampanaChange,
  sortCupon,
  onSortCuponChange,
  estadoCupon,
  onEstadoCuponChange,
  tipoCupon,
  onTipoCuponChange,
  sucursales,
  sucursalId,
  onSucursalChange,
  from,
  to,
  onDateRangeChange,
  onReset,
  hasActiveFilters,
}: FiltrosDialogProps) {
  const setPreset = (preset: 'all' | '7d' | '30d' | 'month') => {
    const now = new Date()
    const formatDate = (d: Date) => d.toISOString().slice(0, 10)
    if (preset === 'all') {
      onDateRangeChange(undefined, undefined)
    } else if (preset === '7d') {
      const f = new Date(now)
      f.setDate(f.getDate() - 7)
      onDateRangeChange(formatDate(f), formatDate(now))
    } else if (preset === '30d') {
      const f = new Date(now)
      f.setDate(f.getDate() - 30)
      onDateRangeChange(formatDate(f), formatDate(now))
    } else if (preset === 'month') {
      const f = new Date(now.getFullYear(), now.getMonth(), 1)
      onDateRangeChange(formatDate(f), formatDate(now))
    }
  }

  const isPresetActive = (preset: 'all' | '7d' | '30d' | 'month') => {
    if (preset === 'all') return !from && !to
    const now = new Date().toISOString().slice(0, 10)
    if (to !== now) return false
    if (preset === '7d') {
      const f = new Date()
      f.setDate(f.getDate() - 7)
      return from === f.toISOString().slice(0, 10)
    }
    if (preset === '30d') {
      const f = new Date()
      f.setDate(f.getDate() - 30)
      return from === f.toISOString().slice(0, 10)
    }
    if (preset === 'month') {
      const f = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      return from === f.toISOString().slice(0, 10)
    }
    return false
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden rounded-3xl border-border/40 bg-background/95 p-0 shadow-2xl backdrop-blur-xl sm:max-w-lg">
        {/* Header con estilo Apple */}
        <div className="border-b border-border/30 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-muted/80 text-foreground">
              {tab === 'clientes' && <Users className="h-5 w-5" />}
              {tab === 'campanas' && <Megaphone className="h-5 w-5 text-[#FF7A00]" />}
              {tab === 'cupones' && <Tag className="h-5 w-5 text-purple-600 dark:text-purple-400" />}
            </div>
            <div>
              <DialogTitle className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                {tab === 'clientes' && 'Filtrar y ordenar clientes'}
                {tab === 'campanas' && 'Filtrar y ordenar campañas'}
                {tab === 'cupones' && 'Filtrar y ordenar cupones'}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs text-muted-foreground">
                Personalizá los criterios de visualización y el orden de la lista.
              </DialogDescription>
            </div>
          </div>
        </div>

        <ScrollArea className="max-h-[calc(90vh-140px)] min-h-0">
          <div className="space-y-6 px-6 py-5">
            {/* 1. SECCIÓN ORDENAMIENTO */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Ordenar por
                </span>
              </div>

              {tab === 'clientes' && (
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  <SortPill
                    active={sortCliente === 'attention'}
                    onClick={() => onSortClienteChange('attention')}
                    label="Necesitan atención"
                    desc="Prioriza clientes en riesgo o dormidos"
                  />
                  <SortPill
                    active={sortCliente === 'recent'}
                    onClick={() => onSortClienteChange('recent')}
                    label="Más recientes"
                    desc="Última compra registrada"
                  />
                  <SortPill
                    active={sortCliente === 'orders'}
                    onClick={() => onSortClienteChange('orders')}
                    label="Más pedidos"
                    desc="Mayor cantidad de compras"
                  />
                  <SortPill
                    active={sortCliente === 'spend'}
                    onClick={() => onSortClienteChange('spend')}
                    label="Mayor gasto"
                    desc="Total histórico facturado"
                  />
                  <SortPill
                    active={sortCliente === 'alphabetical'}
                    onClick={() => onSortClienteChange('alphabetical')}
                    label="Alfabético (A → Z)"
                    desc="Por nombre del cliente"
                    className="sm:col-span-2"
                  />
                </div>
              )}

              {tab === 'campanas' && (
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  <SortPill
                    active={sortCampana === 'recent'}
                    onClick={() => onSortCampanaChange('recent')}
                    label="Más recientes"
                    desc="Fecha de creación de la campaña"
                  />
                  <SortPill
                    active={sortCampana === 'conversions'}
                    onClick={() => onSortCampanaChange('conversions')}
                    label="Más compras"
                    desc="Mayor cantidad de pedidos cobrados"
                  />
                  <SortPill
                    active={sortCampana === 'visits'}
                    onClick={() => onSortCampanaChange('visits')}
                    label="Más visitas"
                    desc="Total de accesos al Smart Link"
                  />
                  <SortPill
                    active={sortCampana === 'alphabetical'}
                    onClick={() => onSortCampanaChange('alphabetical')}
                    label="Alfabético (A → Z)"
                    desc="Por nombre de la campaña"
                  />
                </div>
              )}

              {tab === 'cupones' && (
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  <SortPill
                    active={sortCupon === 'recent'}
                    onClick={() => onSortCuponChange('recent')}
                    label="Más recientes"
                    desc="Fecha de creación del cupón"
                  />
                  <SortPill
                    active={sortCupon === 'uses'}
                    onClick={() => onSortCuponChange('uses')}
                    label="Más usados"
                    desc="Mayor cantidad de usos registrados"
                  />
                  <SortPill
                    active={sortCupon === 'discount'}
                    onClick={() => onSortCuponChange('discount')}
                    label="Mayor beneficio"
                    desc="Por valor o porcentaje de descuento"
                  />
                  <SortPill
                    active={sortCupon === 'alphabetical'}
                    onClick={() => onSortCuponChange('alphabetical')}
                    label="Alfabético (A → Z)"
                    desc="Por código de descuento"
                  />
                </div>
              )}
            </div>

            {/* 2. SECCIÓN FILTROS ESPECÍFICOS DE LA PESTAÑA */}

            {/* TAB CLIENTES: SEGMENTOS RFM */}
            {tab === 'clientes' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      Segmento de ciclo de vida (RFM)
                    </span>
                  </div>
                  {segmento !== 'todos' && (
                    <button
                      type="button"
                      onClick={() => onSegmentoChange('todos')}
                      className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
                    >
                      Ver todos
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <FilterChip
                    active={segmento === 'todos'}
                    onClick={() => onSegmentoChange('todos')}
                    label="Todos los segmentos"
                    count={Object.values(conteoSegmentos).reduce((a, b) => a + b, 0)}
                  />
                  {SEGMENTOS.map((item) => (
                    <FilterChip
                      key={item.value}
                      active={segmento === item.value}
                      onClick={() => onSegmentoChange(item.value)}
                      label={item.label}
                      dot={item.dot}
                      count={conteoSegmentos[item.value] ?? 0}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* TAB CAMPAÑAS: ESTADO Y MODALIDAD */}
            {tab === 'campanas' && (
              <>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      Estado de la campaña
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <FilterChip
                      active={estadoCampana === 'todas'}
                      onClick={() => onEstadoCampanaChange('todas')}
                      label="Todas"
                    />
                    <FilterChip
                      active={estadoCampana === 'activa'}
                      onClick={() => onEstadoCampanaChange('activa')}
                      label="Solo activas"
                      dot="bg-emerald-500"
                    />
                    <FilterChip
                      active={estadoCampana === 'inactiva'}
                      onClick={() => onEstadoCampanaChange('inactiva')}
                      label="Pausadas / Inactivas"
                      dot="bg-muted-foreground"
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      Modalidad y destino
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <FilterChip
                      active={tipoCampana === 'todos'}
                      onClick={() => onTipoCampanaChange('todos')}
                      label="Todas las modalidades"
                    />
                    <FilterChip
                      active={tipoCampana === 'producto'}
                      onClick={() => onTipoCampanaChange('producto')}
                      label="Promoción de producto"
                    />
                    <FilterChip
                      active={tipoCampana === 'carrito'}
                      onClick={() => onTipoCampanaChange('carrito')}
                      label="Carrito prearmado"
                    />
                    <FilterChip
                      active={tipoCampana === 'link'}
                      onClick={() => onTipoCampanaChange('link')}
                      label="Link de seguimiento"
                    />
                  </div>
                </div>
              </>
            )}

            {/* TAB CUPONES: ESTADO Y TIPO */}
            {tab === 'cupones' && (
              <>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      Estado del cupón
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <FilterChip
                      active={estadoCupon === 'todos'}
                      onClick={() => onEstadoCuponChange('todos')}
                      label="Todos los cupones"
                    />
                    <FilterChip
                      active={estadoCupon === 'vigentes'}
                      onClick={() => onEstadoCuponChange('vigentes')}
                      label="Vigentes"
                      dot="bg-emerald-500"
                    />
                    <FilterChip
                      active={estadoCupon === 'inactivos'}
                      onClick={() => onEstadoCuponChange('inactivos')}
                      label="Inactivos"
                      dot="bg-muted-foreground"
                    />
                    <FilterChip
                      active={estadoCupon === 'agotados'}
                      onClick={() => onEstadoCuponChange('agotados')}
                      label="Agotados"
                      dot="bg-amber-500"
                    />
                    <FilterChip
                      active={estadoCupon === 'expirados'}
                      onClick={() => onEstadoCuponChange('expirados')}
                      label="Vencidos"
                      dot="bg-rose-500"
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Percent className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      Tipo de descuento
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <FilterChip
                      active={tipoCupon === 'todos'}
                      onClick={() => onTipoCuponChange('todos')}
                      label="Todos los tipos"
                    />
                    <FilterChip
                      active={tipoCupon === 'porcentaje'}
                      onClick={() => onTipoCuponChange('porcentaje')}
                      label="Porcentaje (% OFF)"
                    />
                    <FilterChip
                      active={tipoCupon === 'monto_fijo'}
                      onClick={() => onTipoCuponChange('monto_fijo')}
                      label="Monto fijo ($ OFF)"
                    />
                  </div>
                </div>
              </>
            )}

            {/* 3. SECCIÓN SUCURSALES (SI HAY MÁS DE 1) */}
            {sucursales.length > 1 && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <Store className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    Sucursal
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <FilterChip
                    active={!sucursalId}
                    onClick={() => onSucursalChange(undefined)}
                    label="Todas las sucursales"
                  />
                  {sucursales.map((suc) => (
                    <FilterChip
                      key={suc.id}
                      active={sucursalId === suc.id}
                      onClick={() => onSucursalChange(sucursalId === suc.id ? undefined : suc.id)}
                      label={suc.nombre}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 4. SECCIÓN PERÍODO DE FECHAS */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    Período de actividad
                  </span>
                </div>
                {(from || to) && (
                  <button
                    type="button"
                    onClick={() => setPreset('all')}
                    className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
                  >
                    Todo el historial
                  </button>
                )}
              </div>

              {/* Presets rápidos */}
              <div className="flex flex-wrap gap-1.5">
                <FilterChip
                  active={isPresetActive('all')}
                  onClick={() => setPreset('all')}
                  label="Histórico completo"
                />
                <FilterChip
                  active={isPresetActive('7d')}
                  onClick={() => setPreset('7d')}
                  label="Últimos 7 días"
                />
                <FilterChip
                  active={isPresetActive('30d')}
                  onClick={() => setPreset('30d')}
                  label="Últimos 30 días"
                />
                <FilterChip
                  active={isPresetActive('month')}
                  onClick={() => setPreset('month')}
                  label="Este mes"
                />
              </div>

              {/* Selector personalizado desde/hasta */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Desde
                  </label>
                  <Input
                    type="date"
                    value={from ?? ''}
                    onChange={(e) => onDateRangeChange(e.target.value || undefined, to)}
                    className="h-9 rounded-xl border-border/50 bg-background text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Hasta
                  </label>
                  <Input
                    type="date"
                    value={to ?? ''}
                    onChange={(e) => onDateRangeChange(from, e.target.value || undefined)}
                    className="h-9 rounded-xl border-border/50 bg-background text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Footer con estilo Apple */}
        <div className="flex items-center justify-between border-t border-border/30 bg-muted/20 px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
            disabled={!hasActiveFilters}
            className="h-9 gap-1.5 rounded-full px-3 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            <RotateCcw className="h-3 w-3" />
            Restablecer
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-9 rounded-full px-5 text-xs font-semibold shadow-2xs"
          >
            Ver {totalResultados}{' '}
            {tab === 'clientes'
              ? totalResultados === 1
                ? 'cliente'
                : 'clientes'
              : tab === 'campanas'
                ? totalResultados === 1
                  ? 'campaña'
                  : 'campañas'
                : totalResultados === 1
                  ? 'cupón'
                  : 'cupones'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SortPill({
  active,
  onClick,
  label,
  desc,
  className = '',
}: {
  active: boolean
  onClick: () => void
  label: string
  desc: string
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex items-start gap-2.5 rounded-2xl p-3 text-left transition-all ${
        active
          ? 'bg-foreground text-background shadow-2xs'
          : 'bg-muted/40 hover:bg-muted/70 text-foreground'
      } ${className}`}
    >
      <div
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all ${
          active
            ? 'border-background bg-background text-foreground'
            : 'border-muted-foreground/40 group-hover:border-foreground/60'
        }`}
      >
        {active && <Check className="h-2.5 w-2.5 stroke-[3]" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold leading-none">{label}</p>
        <p
          className={`mt-1 text-[11px] leading-tight ${
            active ? 'text-background/80' : 'text-muted-foreground'
          }`}
        >
          {desc}
        </p>
      </div>
    </button>
  )
}

function FilterChip({
  active,
  onClick,
  label,
  dot,
  count,
}: {
  active: boolean
  onClick: () => void
  label: string
  dot?: string
  count?: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
        active
          ? 'bg-foreground text-background shadow-2xs'
          : 'bg-muted/50 text-muted-foreground hover:bg-muted/80 hover:text-foreground'
      }`}
    >
      {dot && <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />}
      <span>{label}</span>
      {count != null && (
        <span
          className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-semibold tabular-nums ${
            active
              ? 'bg-background/20 text-background'
              : 'bg-background text-foreground shadow-2xs dark:bg-muted'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  )
}
