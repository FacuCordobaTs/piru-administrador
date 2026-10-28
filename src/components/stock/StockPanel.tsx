import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  ChevronDown,
  Loader2,
  Package,
  Pencil,
  Plus,
  Receipt,
  Search,
  Sparkles,
  TrendingDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { stockApi, type InsumoStock, type ProductoStock, type ResumenStock } from '@/lib/api'
import { datosUnidad, formatearCantidad, formatearFecha, formatearPrecio, formatearStock } from '@/lib/stock'
import { useModuloActivo, useModulosStore } from '@/store/modulosStore'
import { cn } from '@/lib/utils'
import { StockConsumoEditor } from './StockConsumoEditor'
import { StockGastoDialog } from './StockGastoDialog'
import { StockInsumoDialog } from './StockInsumoDialog'

interface Props {
  token: string | null
}

export function StockPanel({ token }: Props) {
  const activo = useModuloActivo('gestion_stock')
  const modulo = useModulosStore((state) => state.categorias
    .flatMap((categoria) => categoria.modulos)
    .find((item) => item.codigo === 'gestion_stock'))
  const activar = useModulosStore((state) => state.activar)
  const cargandoModulos = useModulosStore((state) => state.cargando)
  const hayCatalogo = useModulosStore((state) => state.categorias.length > 0)
  const [activando, setActivando] = useState(false)

  const [resumen, setResumen] = useState<ResumenStock | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [productoAbierto, setProductoAbierto] = useState<number | null>(null)
  const [dialogInsumo, setDialogInsumo] = useState<{ open: boolean; insumo: InsumoStock | null }>({ open: false, insumo: null })
  const [dialogGasto, setDialogGasto] = useState(false)

  const cargar = useCallback(async () => {
    if (!token || !activo) {
      setResumen(null)
      setCargando(false)
      return
    }
    setCargando(true)
    setError(null)
    try {
      const respuesta = await stockApi.resumen(token)
      setResumen(respuesta.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar el stock')
    } finally {
      setCargando(false)
    }
  }, [token, activo])

  useEffect(() => {
    void cargar()
  }, [cargar])

  // Al volver a la pestaña se concilian las ventas que hayan entrado desde
  // otro dispositivo, sin obligar a recargar la pantalla.
  useEffect(() => {
    const alVolver = () => { void cargar() }
    window.addEventListener('focus', alVolver)
    return () => window.removeEventListener('focus', alVolver)
  }, [cargar])

  const activarModulo = async () => {
    if (activando) return
    setActivando(true)
    try {
      await activar('gestion_stock')
      toast.success('Control de stock activado')
    } catch (cause) {
      toast.error('No pudimos activar Control de stock', {
        description: cause instanceof Error ? cause.message : 'Intentá de nuevo.',
      })
    } finally {
      setActivando(false)
    }
  }

  const insumosActivos = useMemo(
    () => (resumen?.insumos ?? []).filter((insumo) => insumo.activo),
    [resumen],
  )
  const productosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase()
    return (resumen?.productos ?? []).filter((producto) => {
      if (!termino) return true
      return producto.nombre.toLowerCase().includes(termino)
        || (producto.categoria ?? '').toLowerCase().includes(termino)
    })
  }, [resumen, busqueda])

  if (!activo) {
    // Mientras el catálogo de módulos llega no se decide: mostrar la tarjeta de
    // activación a un local que ya lo tiene produce un parpadeo confuso.
    if (cargandoModulos || !hayCatalogo) {
      return (
        <div className="flex min-h-[240px] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-[#FF7A00]" />
        </div>
      )
    }
    // Catálogo todavía en preparación (por ejemplo, backend desplegado antes
    // de aplicar la migración): no se promete una activación que va a fallar.
    if (!modulo || !modulo.activable || modulo.estadoProducto === 'proximamente') {
      return <StockEnPreparacion />
    }
    return <StockGate activando={activando} onActivar={() => void activarModulo()} />
  }

  if (cargando && !resumen) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-[#FF7A00]" />
      </div>
    )
  }

  if (error && !resumen) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-red-200 bg-white p-8 text-center dark:border-red-900/40 dark:bg-zinc-900">
        <AlertTriangle className="mx-auto h-8 w-8 text-red-500" />
        <p className="mt-3 font-bold text-foreground">No se pudo cargar el stock</p>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        <Button onClick={() => void cargar()} className="mt-5 rounded-xl bg-[#FF7A00] text-white hover:bg-[#E66E00]">
          Reintentar
        </Button>
      </div>
    )
  }

  if (!resumen) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-[#FF7A00]" />
      </div>
    )
  }

  const alertas = resumen.alertas
  const conReceta = resumen.productos.filter((producto) => producto.tieneConsumos).length

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 sm:px-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-foreground">Control de stock</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Cargá tus insumos y compras, y decile a cada producto cuánto consume. El stock se descuenta solo con las ventas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setDialogInsumo({ open: true, insumo: null })}
            className="h-10 rounded-xl font-semibold"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Nuevo insumo
          </Button>
          <Button
            onClick={() => setDialogGasto(true)}
            disabled={insumosActivos.length === 0}
            className="h-10 rounded-xl bg-[#FF7A00] font-bold text-white hover:bg-[#E66E00]"
          >
            <Receipt className="mr-1.5 h-4 w-4" /> Cargar gasto
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
          <span>No se pudo actualizar el stock: {error}</span>
          <button type="button" onClick={() => void cargar()} className="shrink-0 font-bold underline">Reintentar</button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <ResumenCard
          icono={Boxes}
          etiqueta="Insumos controlados"
          valor={String(insumosActivos.length)}
          detalle={insumosActivos.length === 1 ? '1 insumo activo' : `${insumosActivos.length} insumos activos`}
        />
        <ResumenCard
          icono={alertas.total > 0 ? AlertTriangle : TrendingDown}
          etiqueta="Para reponer"
          valor={String(alertas.total)}
          detalle={alertas.total > 0 ? 'Insumos en o bajo el mínimo' : 'Todo por encima del mínimo'}
          alerta={alertas.total > 0}
        />
        <ResumenCard
          icono={Sparkles}
          etiqueta="Productos con receta"
          valor={`${conReceta}/${resumen.productos.length}`}
          detalle="Descuentan insumos al venderse"
        />
      </div>

      {alertas.total > 0 && (
        <div className="mt-5 rounded-2xl border border-amber-300/70 bg-amber-50 p-4 dark:border-amber-700/40 dark:bg-amber-950/20">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-500/15">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
                {alertas.total === 1 ? 'Hay un insumo para reponer' : `Hay ${alertas.total} insumos para reponer`}
              </p>
              <p className="mt-0.5 text-xs text-amber-800/80 dark:text-amber-300/80">
                {alertas.insumos.slice(0, 6).map((insumo) => `${insumo.nombre} (${formatearStock(insumo.stockActual, insumo.unidad)})`).join(' · ')}
                {alertas.total > 6 ? ` · y ${alertas.total - 6} más` : ''}
              </p>
            </div>
          </div>
        </div>
      )}

      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-foreground">Insumos</h3>
            <p className="text-xs text-muted-foreground">Lo que comprás y descontás: medallones, carne, pan, queso, bebidas.</p>
          </div>
          <span className="text-xs text-muted-foreground">{resumen.insumos.length} en total</span>
        </div>

        {resumen.insumos.length === 0 ? (
          <OnboardingInsumos onNuevo={() => setDialogInsumo({ open: true, insumo: null })} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {resumen.insumos.map((insumo) => (
              <InsumoCard
                key={insumo.id}
                insumo={insumo}
                onEditar={() => setDialogInsumo({ open: true, insumo })}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-foreground">Consumo por producto</h3>
            <p className="text-xs text-muted-foreground">
              Configurá la receta base y lo que suma cada variante. La hamburguesa doble puede consumir un medallón más que la simple.
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar producto..."
              className="h-10 rounded-xl pl-9"
            />
          </div>
        </div>

        {resumen.productos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
            <Package className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-3 font-semibold text-foreground">Todavía no hay productos</p>
            <p className="mt-1 text-sm text-muted-foreground">Creá platos en el catálogo y volvé para asignarles insumos.</p>
          </div>
        ) : productosFiltrados.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-muted-foreground dark:border-zinc-700">
            No hay productos que coincidan con “{busqueda}”.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            {productosFiltrados.map((producto, index) => (
              <ProductoFila
                key={producto.id}
                producto={producto}
                abierto={productoAbierto === producto.id}
                onToggle={() => setProductoAbierto((actual) => actual === producto.id ? null : producto.id)}
                token={token}
                insumos={resumen.insumos}
                onGuardado={cargar}
                esUltima={index === productosFiltrados.length - 1}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-10 grid gap-5 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h3 className="text-base font-bold text-foreground">Últimas compras</h3>
              <p className="text-xs text-muted-foreground">Lo que cargaste con “Cargar gasto”.</p>
            </div>
          </div>
          {resumen.gastos.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-zinc-300 p-5 text-sm text-muted-foreground dark:border-zinc-700">
              Todavía no cargaste compras.
            </p>
          ) : (
            <div className="space-y-2">
              {resumen.gastos.map((gasto) => (
                <div key={gasto.id} className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{gasto.descripcion}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatearFecha(gasto.fecha)}
                        {gasto.proveedor ? ` · ${gasto.proveedor}` : ''}
                        {' · '}{gasto.items.length} insumo{gasto.items.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-bold tabular-nums text-foreground">{formatearPrecio(gasto.total)}</p>
                  </div>
                  <p className="mt-1.5 line-clamp-1 text-[11px] text-muted-foreground">
                    {gasto.items.map((item) => `${item.insumoNombre} ${formatearStock(item.cantidad, item.unidad)}`).join(' · ')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-3">
            <h3 className="text-base font-bold text-foreground">Movimientos recientes</h3>
            <p className="text-xs text-muted-foreground">Compras, consumos por venta y ajustes manuales.</p>
          </div>
          {resumen.movimientos.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-zinc-300 p-5 text-sm text-muted-foreground dark:border-zinc-700">
              Sin movimientos todavía.
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              {resumen.movimientos.map((movimiento, index) => {
                const entrada = movimiento.cantidad > 0
                return (
                  <div
                    key={movimiento.id}
                    className={cn(
                      'flex items-center gap-3 px-4 py-2.5',
                      index > 0 && 'border-t border-zinc-100 dark:border-zinc-800',
                    )}
                  >
                    <div className={cn(
                      'grid h-8 w-8 shrink-0 place-items-center rounded-lg',
                      entrada ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-500',
                    )}>
                      {entrada ? <ArrowDownToLine className="h-4 w-4" /> : <ArrowUpFromLine className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{movimiento.insumoNombre}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {tipoMovimiento(movimiento.tipo)} · {new Date(movimiento.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                        {movimiento.nota ? ` · ${movimiento.nota}` : ''}
                      </p>
                    </div>
                    <span className={cn(
                      'shrink-0 text-sm font-bold tabular-nums',
                      entrada ? 'text-emerald-600' : 'text-rose-500',
                    )}>
                      {entrada ? '+' : ''}{formatearCantidad(movimiento.cantidad)} {datosUnidad(movimiento.unidad).corta}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <StockInsumoDialog
        open={dialogInsumo.open}
        onOpenChange={(open) => setDialogInsumo((actual) => ({ ...actual, open }))}
        token={token}
        insumo={dialogInsumo.insumo}
        onGuardado={cargar}
      />
      <StockGastoDialog
        open={dialogGasto}
        onOpenChange={setDialogGasto}
        token={token}
        insumos={resumen.insumos}
        onGuardado={cargar}
      />
    </div>
  )
}

function StockGate({ activando, onActivar }: { activando: boolean; onActivar: () => void }) {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 sm:px-8">
      <div className="relative overflow-hidden rounded-[32px] border border-orange-200/70 bg-white p-8 shadow-sm dark:border-orange-900/30 dark:bg-zinc-900 sm:p-10">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#FF7A00]/10 blur-2xl" />
        <div className="relative">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#FF7A00]/10">
            <Package className="h-7 w-7 text-[#FF7A00]" />
          </div>
          <span className="mt-5 inline-flex rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            Incluido en tu suscripción
          </span>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-foreground">Control de stock</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Cargá lo que comprás, decile a cada producto cuántos insumos consume y olvidate de vender algo que no tenés.
            El stock baja solo con cada pedido y te avisamos en el panel cuando conviene reponer.
          </p>
          <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
            {[
              'Insumos con unidades y costo de compra',
              'Receta base y consumo extra por variante',
              '“Cargar gasto” suma stock y guarda el historial',
              'Alerta de reposición en el Dashboard',
            ].map((texto) => (
              <div key={texto} className="flex items-start gap-2 rounded-xl bg-muted/40 px-3 py-2.5">
                <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-[10px] font-black text-emerald-600">✓</span>
                <span className="text-xs font-medium text-foreground">{texto}</span>
              </div>
            ))}
          </div>
          <Button
            onClick={onActivar}
            disabled={activando}
            className="mt-7 h-12 rounded-xl bg-[#FF7A00] px-6 font-bold text-white hover:bg-[#E66E00]"
          >
            {activando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Activar control de stock
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            Se activa al instante. Después podés desactivarlo desde Mis módulos sin perder lo que ya cargaste.
          </p>
        </div>
      </div>
    </div>
  )
}

function StockEnPreparacion() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 sm:px-8">
      <div className="rounded-[32px] border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900 sm:p-10">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-muted">
          <Package className="h-7 w-7 text-muted-foreground" />
        </div>
        <h2 className="mt-4 text-2xl font-black tracking-tight text-foreground">Control de stock</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          Estamos terminando de habilitar esta herramienta para tu local. Muy pronto vas a poder cargar insumos,
          compras y recetas desde acá.
        </p>
      </div>
    </div>
  )
}

function ResumenCard({
  icono: Icono,
  etiqueta,
  valor,
  detalle,
  alerta = false,
}: {
  icono: typeof Boxes
  etiqueta: string
  valor: string
  detalle: string
  alerta?: boolean
}) {
  return (
    <div className={cn(
      'rounded-2xl border bg-white p-4 dark:bg-zinc-900',
      alerta ? 'border-amber-300/80 dark:border-amber-700/40' : 'border-zinc-200 dark:border-zinc-800',
    )}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{etiqueta}</p>
        <Icono className={cn('h-4 w-4', alerta ? 'text-amber-500' : 'text-muted-foreground/70')} />
      </div>
      <p className={cn('mt-1.5 text-2xl font-black tabular-nums', alerta ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}>{valor}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{detalle}</p>
    </div>
  )
}

function OnboardingInsumos({ onNuevo }: { onNuevo: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/50 p-8 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-muted">
        <Boxes className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="mt-3 font-bold text-foreground">Empezá por tus insumos</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Un insumo es lo que comprás y consumís: medallones, gramos de carne, pan, queso o latas de bebida.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button variant="outline" onClick={onNuevo} className="h-10 rounded-xl font-semibold">
          <Plus className="mr-1.5 h-4 w-4" /> Crear insumo
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Después de crear el primero vas a poder usar “Cargar gasto”.</p>
    </div>
  )
}

function InsumoCard({ insumo, onEditar }: { insumo: InsumoStock; onEditar: () => void }) {
  const unidad = datosUnidad(insumo.unidad)
  const referencia = insumo.stockMinimoEfectivo
  const porcentaje = insumo.stockMaximo > 0
    ? Math.max(0, Math.min(100, (insumo.stockActual / insumo.stockMaximo) * 100))
    : 0

  return (
    <div className={cn(
      'relative rounded-2xl border bg-white p-4 transition-colors dark:bg-zinc-900',
      insumo.bajoStock
        ? 'border-amber-300/80 dark:border-amber-700/40'
        : 'border-zinc-200 dark:border-zinc-800',
      !insumo.activo && 'opacity-60',
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-bold text-foreground">{insumo.nombre}</p>
            {!insumo.activo && <Badge variant="outline" className="text-[9px]">Inactivo</Badge>}
            {insumo.bajoStock && (
              <Badge className="border-none bg-amber-500/15 text-[9px] text-amber-700 hover:bg-amber-500/15 dark:text-amber-300">
                {insumo.sinStock ? 'Sin stock' : 'Reponer'}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-lg font-black tabular-nums text-foreground">
            {formatearCantidad(insumo.stockActual)}
            <span className="ml-1 text-xs font-semibold text-muted-foreground">{unidad.corta}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onEditar}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-800"
          aria-label={`Editar ${insumo.nombre}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-3">
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className={cn('h-full rounded-full transition-all', insumo.bajoStock ? 'bg-amber-500' : 'bg-emerald-500')}
            style={{ width: `${porcentaje}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <span>
            {referencia != null
              ? `Alerta en ${formatearStock(referencia, insumo.unidad)} o menos`
              : 'Sin alerta configurada'}
          </span>
          {insumo.costoUltimo != null && <span>{formatearPrecio(insumo.costoUltimo)} / {unidad.corta}</span>}
        </div>
      </div>
    </div>
  )
}

function ProductoFila({
  producto,
  abierto,
  onToggle,
  token,
  insumos,
  onGuardado,
  esUltima,
}: {
  producto: ProductoStock
  abierto: boolean
  onToggle: () => void
  token: string | null
  insumos: InsumoStock[]
  onGuardado: () => void | Promise<void>
  esUltima: boolean
}) {
  const insumosConfigurados = new Set(producto.consumos.map((consumo) => consumo.insumoId)).size
  const variantesConConsumo = new Set(
    producto.consumos
      .filter((consumo) => consumo.varianteId != null)
      .map((consumo) => consumo.varianteId),
  ).size

  return (
    <div className={cn(!esUltima && 'border-b border-zinc-200 dark:border-zinc-800')}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
      >
        <div className={cn(
          'grid h-9 w-9 shrink-0 place-items-center rounded-xl',
          producto.tieneConsumos ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground',
        )}>
          <Package className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-foreground">{producto.nombre}</p>
            {!producto.activo && <Badge variant="outline" className="text-[9px]">Inactivo</Badge>}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {producto.categoria ?? 'Sin categoría'}
            {producto.variantes.length > 0 ? ` · ${producto.variantes.length} variante${producto.variantes.length !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <div className="hidden shrink-0 text-right sm:block">
          {producto.tieneConsumos ? (
            <>
              <p className="text-xs font-semibold text-foreground">{insumosConfigurados} insumo{insumosConfigurados !== 1 ? 's' : ''}</p>
              <p className="text-[10px] text-muted-foreground">
                {variantesConConsumo > 0 ? `${variantesConConsumo} con extra por variante` : 'Sólo receta base'}
              </p>
            </>
          ) : (
            <p className="text-xs font-medium text-[#FF7A00]">Configurar consumo</p>
          )}
        </div>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', abierto && 'rotate-180')} />
      </button>
      {abierto && (
        <StockConsumoEditor
          token={token}
          producto={producto}
          insumos={insumos}
          onGuardado={onGuardado}
        />
      )}
    </div>
  )
}

function tipoMovimiento(tipo: string): string {
  if (tipo === 'compra') return 'Compra'
  if (tipo === 'consumo') return 'Consumo por venta'
  if (tipo === 'ajuste') return 'Ajuste'
  return 'Devolución'
}
