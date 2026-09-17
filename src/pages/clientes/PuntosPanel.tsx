import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAuthStore } from '@/store/authStore'
import {
  ApiError,
  puntosApi,
  type ClienteConPuntosData,
  type FiltroTipoMovimientoPuntos,
  type MovimientoPuntosData,
  type ResumenPuntosData,
} from '@/lib/api'
import { Gift, Loader2, Package, Search, Settings2, Sparkles, TicketPercent, Truck, Users } from 'lucide-react'
import { toast } from 'sonner'
import { ConfiguracionPuntosDialog } from './ConfiguracionPuntosDialog'
import { FilaMovimientoPuntos, HistorialPuntosContenido } from './MovimientosPuntos'
import { formatFechaHora, formatPuntos, metaMovimientoPuntos } from './types'

/** Cliente abierto en el detalle. `puntos: null` = todavía no lo confirmó el backend. */
interface ClienteEnDetalle {
  id: number
  nombre: string
  telefono?: string | null
  puntos: number | null
  actividad?: {
    puntosOtorgados: number
    puntosCanjeados: number
    canjes: number
    movimientos: number
    ultimoMovimientoAt: string | null
  }
}

type SubTabPuntos = 'clientes' | 'movimientos'
type VistaMobile = 'lista' | 'detalle'

const LIMITE_PAGINA = 25

const ALCANCE_META: Array<{ valor: 'saldo' | 'historial'; label: string }> = [
  { valor: 'saldo', label: 'Con saldo' },
  { valor: 'historial', label: 'Con historial' },
]

const ORDEN_META: Array<{ valor: 'puntos' | 'reciente' | 'nombre'; label: string }> = [
  { valor: 'puntos', label: 'Más puntos' },
  { valor: 'reciente', label: 'Último movimiento' },
  { valor: 'nombre', label: 'Nombre' },
]

const TIPO_META: Array<{ valor: FiltroTipoMovimientoPuntos; label: string }> = [
  { valor: 'todos', label: 'Todos' },
  { valor: 'canje', label: 'Canjes' },
  { valor: 'suma_compra', label: 'Compras' },
  { valor: 'ajuste_manual', label: 'Ajustes' },
]

/**
 * Mitad "Puntos" de la pantalla de Retención: cuántos puntos hay en juego, qué
 * clientes los tienen, en qué los gastaron y toda la configuración del
 * programa (reglas, beneficios y productos).
 */
export function PuntosPanel() {
  const token = useAuthStore((state) => state.token)

  const [resumen, setResumen] = useState<ResumenPuntosData | null>(null)
  const [cargandoResumen, setCargandoResumen] = useState(true)
  const [bloqueado, setBloqueado] = useState(false)

  const [subTab, setSubTab] = useState<SubTabPuntos>('clientes')
  const [vistaMobile, setVistaMobile] = useState<VistaMobile>('lista')
  const [busqueda, setBusqueda] = useState('')
  const [busquedaAplicada, setBusquedaAplicada] = useState('')

  const [alcance, setAlcance] = useState<'saldo' | 'historial'>('saldo')
  const [orden, setOrden] = useState<'puntos' | 'reciente' | 'nombre'>('puntos')
  const [tipoMovimiento, setTipoMovimiento] = useState<FiltroTipoMovimientoPuntos>('todos')

  const [clientes, setClientes] = useState<ClienteConPuntosData[]>([])
  const [totalClientes, setTotalClientes] = useState(0)
  const [paginaClientes, setPaginaClientes] = useState(1)
  const [hayMasClientes, setHayMasClientes] = useState(false)
  const [cargandoClientes, setCargandoClientes] = useState(true)

  const [movimientos, setMovimientos] = useState<MovimientoPuntosData[]>([])
  const [totalMovimientos, setTotalMovimientos] = useState(0)
  const [paginaMovimientos, setPaginaMovimientos] = useState(1)
  const [hayMasMovimientos, setHayMasMovimientos] = useState(false)
  const [cargandoMovimientos, setCargandoMovimientos] = useState(false)

  const [detalle, setDetalle] = useState<ClienteEnDetalle | null>(null)
  const [configOpen, setConfigOpen] = useState(false)

  const solicitudClientes = useRef(0)
  const solicitudMovimientos = useRef(0)

  // El buscador dispara contra el backend: se aplica cuando el usuario deja de escribir.
  useEffect(() => {
    const temporizador = setTimeout(() => setBusquedaAplicada(busqueda.trim()), 300)
    return () => clearTimeout(temporizador)
  }, [busqueda])

  const esBloqueoDeModulo = (err: unknown) => {
    if (err instanceof ApiError && err.status === 403 && (err.response as { upgradeRequired?: boolean } | undefined)?.upgradeRequired) {
      setBloqueado(true)
      return true
    }
    return false
  }

  const cargarResumen = useCallback(async () => {
    if (!token) return
    setCargandoResumen(true)
    try {
      const res = await puntosApi.getResumen(token)
      if (res.success) setResumen(res.data)
    } catch (err) {
      if (!esBloqueoDeModulo(err)) toast.error('No se pudieron cargar los totales de puntos.')
    } finally {
      setCargandoResumen(false)
    }
  }, [token])

  const cargarClientes = useCallback(async (pagina: number, reemplazar: boolean) => {
    if (!token) return
    const solicitud = ++solicitudClientes.current
    setCargandoClientes(true)
    try {
      const res = await puntosApi.getClientes(token, {
        busqueda: busquedaAplicada || undefined,
        alcance,
        orden,
        pagina,
        limite: LIMITE_PAGINA,
      })
      if (solicitud !== solicitudClientes.current) return
      if (res.success) {
        const { items, total, pagina: paginaActual, paginas } = res.data
        setClientes((prev) => (reemplazar ? items : [...prev, ...items]))
        setTotalClientes(total)
        setPaginaClientes(paginaActual)
        setHayMasClientes(paginaActual < paginas)
      }
    } catch (err) {
      if (solicitud !== solicitudClientes.current) return
      if (!esBloqueoDeModulo(err)) toast.error('No se pudieron cargar los clientes con puntos.')
    } finally {
      if (solicitud === solicitudClientes.current) setCargandoClientes(false)
    }
  }, [token, busquedaAplicada, alcance, orden])

  const cargarMovimientos = useCallback(async (pagina: number, reemplazar: boolean) => {
    if (!token) return
    const solicitud = ++solicitudMovimientos.current
    setCargandoMovimientos(true)
    try {
      const res = await puntosApi.getMovimientos(token, {
        busqueda: busquedaAplicada || undefined,
        tipo: tipoMovimiento,
        pagina,
        limite: LIMITE_PAGINA,
      })
      if (solicitud !== solicitudMovimientos.current) return
      if (res.success) {
        const { items, total, pagina: paginaActual, paginas } = res.data
        setMovimientos((prev) => (reemplazar ? items : [...prev, ...items]))
        setTotalMovimientos(total)
        setPaginaMovimientos(paginaActual)
        setHayMasMovimientos(paginaActual < paginas)
      }
    } catch (err) {
      if (solicitud !== solicitudMovimientos.current) return
      if (!esBloqueoDeModulo(err)) toast.error('No se pudieron cargar los movimientos de puntos.')
    } finally {
      if (solicitud === solicitudMovimientos.current) setCargandoMovimientos(false)
    }
  }, [token, busquedaAplicada, tipoMovimiento])

  useEffect(() => { void cargarResumen() }, [cargarResumen])
  useEffect(() => { void cargarClientes(1, true) }, [cargarClientes])
  useEffect(() => {
    if (subTab === 'movimientos') void cargarMovimientos(1, true)
  }, [subTab, cargarMovimientos])

  /** El saldo que confirma el backend se refleja en el detalle y en la lista. */
  const actualizarSaldo = (clienteId: number, nuevosPuntos: number) => {
    setDetalle((prev) => (prev && prev.id === clienteId ? { ...prev, puntos: nuevosPuntos } : prev))
    setClientes((prev) => prev.map((cliente) => (cliente.id === clienteId ? { ...cliente, puntos: nuevosPuntos } : cliente)))
    void cargarResumen()
  }

  const abrirCliente = (cliente: ClienteEnDetalle) => {
    setDetalle(cliente)
    setVistaMobile('detalle')
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  }

  const abrirDesdeLista = (cliente: ClienteConPuntosData) => abrirCliente({
    id: cliente.id,
    nombre: cliente.nombre,
    telefono: cliente.telefono,
    puntos: cliente.puntos,
    actividad: {
      puntosOtorgados: cliente.puntosOtorgados,
      puntosCanjeados: cliente.puntosCanjeados,
      canjes: cliente.canjes,
      movimientos: cliente.movimientos,
      ultimoMovimientoAt: cliente.ultimoMovimientoAt,
    },
  })

  const abrirDesdeMovimiento = (movimiento: MovimientoPuntosData) => abrirCliente({
    id: movimiento.clienteId,
    nombre: movimiento.clienteNombre,
    telefono: movimiento.telefono,
    puntos: null,
  })

  const cambiarSubTab = (valor: SubTabPuntos) => {
    setSubTab(valor)
    setVistaMobile('lista')
  }

  if (bloqueado) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-16">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Sparkles className="h-7 w-7 text-foreground" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">El Club de Puntos vive en Retención</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Puntos y motor de recompra son el mismo módulo. Activalo para que tus clientes acumulen puntos y puedan canjearlos.
          </p>
          <Button asChild className="mt-4 rounded-full">
            <a href="/dashboard/ajustes/retencion">Ver plan y activar</a>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-4 sm:px-6">
        <div className="mx-auto max-w-[1680px]">
          <div className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-2xl border border-border/50 bg-white/70 p-4 shadow-2xs dark:bg-muted/20 sm:grid-cols-4">
            <MetricaPuntos
              label="Puntos en circulación"
              value={cargandoResumen && !resumen ? '—' : formatPuntos(resumen?.puntosEnCirculacion ?? 0)}
              sublabel="Saldo pendiente de canje"
            />
            <MetricaPuntos
              label="Clientes con puntos"
              value={cargandoResumen && !resumen ? '—' : formatPuntos(resumen?.clientesConPuntos ?? 0)}
              sublabel={`${formatPuntos(resumen?.clientesConHistorial ?? 0)} con historial`}
            />
            <MetricaPuntos
              label="Otorgados (30 días)"
              value={cargandoResumen && !resumen ? '—' : formatPuntos(resumen?.puntosOtorgados30Dias ?? 0)}
              sublabel={`${formatPuntos(resumen?.puntosOtorgados ?? 0)} históricos`}
            />
            <MetricaPuntos
              label="Canjes (30 días)"
              value={cargandoResumen && !resumen ? '—' : formatPuntos(resumen?.canjes30Dias ?? 0)}
              sublabel={`${formatPuntos(resumen?.canjes ?? 0)} históricos`}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {resumen?.ultimoMovimientoAt
                ? `Último movimiento de puntos: ${formatFechaHora(resumen.ultimoMovimientoAt)}`
                : 'Todavía no hay movimientos de puntos registrados.'}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfigOpen(true)}
              className="h-8 gap-1.5 rounded-full px-3 text-xs font-medium"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Configurar beneficios y productos
            </Button>
          </div>
        </div>
      </div>

      {/* En mobile la mitad de lista y el detalle se alternan desde acá. */}
      <nav className="sticky top-0 z-20 mt-3 shrink-0 border-y bg-[#FFFBF0]/95 px-4 py-2 backdrop-blur dark:bg-background/95 sm:px-6 xl:hidden" aria-label="Vistas de puntos">
        <div className="mx-auto grid max-w-[1680px] grid-cols-3 rounded-xl bg-muted/60 p-1">
          <BotonNavPuntos activo={subTab === 'clientes' && vistaMobile === 'lista'} onClick={() => cambiarSubTab('clientes')}>
            Clientes ({formatPuntos(totalClientes)})
          </BotonNavPuntos>
          <BotonNavPuntos activo={subTab === 'movimientos' && vistaMobile === 'lista'} onClick={() => cambiarSubTab('movimientos')}>
            Movimientos ({formatPuntos(totalMovimientos)})
          </BotonNavPuntos>
          <BotonNavPuntos activo={vistaMobile === 'detalle'} onClick={() => setVistaMobile('detalle')}>
            Detalle
          </BotonNavPuntos>
        </div>
      </nav>

      <main className="min-h-0 flex-1 px-4 pb-4 pt-3 sm:px-6">
        <div className="mx-auto grid h-full max-w-[1680px] gap-4 xl:grid-cols-[minmax(300px,380px)_1fr]">
          <section className={`${vistaMobile === 'lista' ? 'flex' : 'hidden'} min-h-[520px] flex-col overflow-hidden xl:flex xl:min-h-0`}>
            <div className="space-y-2 p-3">
              {/* En desktop la mitad se elige acá; en mobile lo hace la barra de 3 slots. */}
              <div className="hidden rounded-xl bg-muted/60 p-1 xl:flex">
                <BotonSubTab activo={subTab === 'clientes'} onClick={() => cambiarSubTab('clientes')}>
                  Clientes con puntos
                </BotonSubTab>
                <BotonSubTab activo={subTab === 'movimientos'} onClick={() => cambiarSubTab('movimientos')}>
                  Movimientos
                </BotonSubTab>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busqueda}
                  onChange={(evento) => setBusqueda(evento.target.value)}
                  placeholder={subTab === 'clientes' ? 'Buscar cliente por nombre o teléfono' : 'Buscar por cliente o motivo'}
                  className="h-9 rounded-xl pl-8 text-sm"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {subTab === 'clientes'
                  ? ALCANCE_META.map((item) => (
                      <PillFiltro key={item.valor} activo={alcance === item.valor} onClick={() => setAlcance(item.valor)}>
                        {item.label}
                      </PillFiltro>
                    ))
                  : TIPO_META.map((item) => (
                      <PillFiltro key={item.valor} activo={tipoMovimiento === item.valor} onClick={() => setTipoMovimiento(item.valor)}>
                        {item.label}
                      </PillFiltro>
                    ))}
              </div>

              <div className="flex items-center justify-between gap-2 pt-0.5">
                <p className="text-[11px] text-muted-foreground">
                  {subTab === 'clientes'
                    ? `${formatPuntos(totalClientes)} ${totalClientes === 1 ? 'cliente' : 'clientes'}`
                    : `${formatPuntos(totalMovimientos)} ${totalMovimientos === 1 ? 'movimiento' : 'movimientos'}`}
                </p>
                {subTab === 'clientes' && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-muted-foreground">Orden</span>
                    <select
                      value={orden}
                      onChange={(evento) => setOrden(evento.target.value as 'puntos' | 'reciente' | 'nombre')}
                      className="h-7 rounded-lg border border-border/50 bg-background px-2 text-[11px] font-medium text-foreground"
                    >
                      {ORDEN_META.map((item) => (
                        <option key={item.valor} value={item.valor}>{item.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-2 p-2">
                {subTab === 'clientes' ? (
                  <>
                    {cargandoClientes && clientes.length === 0 ? (
                      <CargandoLista />
                    ) : clientes.length === 0 ? (
                      <VacioLista
                        icono={<Users className="h-5 w-5 text-muted-foreground/60" />}
                        texto={busquedaAplicada
                          ? 'Ningún cliente coincide con la búsqueda.'
                          : alcance === 'saldo'
                            ? 'Todavía ningún cliente acumuló puntos.'
                            : 'Todavía ningún cliente tiene movimientos de puntos.'}
                      />
                    ) : (
                      clientes.map((cliente) => (
                        <FilaClientePuntos
                          key={cliente.id}
                          cliente={cliente}
                          activo={detalle?.id === cliente.id}
                          onClick={() => { abrirDesdeLista(cliente) }}
                        />
                      ))
                    )}
                    {hayMasClientes && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={cargandoClientes}
                        onClick={() => void cargarClientes(paginaClientes + 1, false)}
                        className="h-8 w-full rounded-xl text-xs"
                      >
                        {cargandoClientes ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Ver más clientes'}
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    {cargandoMovimientos && movimientos.length === 0 ? (
                      <CargandoLista />
                    ) : movimientos.length === 0 ? (
                      <VacioLista
                        icono={<TicketPercent className="h-5 w-5 text-muted-foreground/60" />}
                        texto={busquedaAplicada || tipoMovimiento !== 'todos'
                          ? 'Ningún movimiento coincide con el filtro.'
                          : 'Todavía no hay movimientos de puntos.'}
                      />
                    ) : (
                      movimientos.map((movimiento) => (
                        <FilaMovimientoPuntos
                          key={movimiento.id}
                          movimiento={movimiento}
                          onSeleccionarCliente={() => abrirDesdeMovimiento(movimiento)}
                          compacto
                        />
                      ))
                    )}
                    {hayMasMovimientos && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={cargandoMovimientos}
                        onClick={() => void cargarMovimientos(paginaMovimientos + 1, false)}
                        className="h-8 w-full rounded-xl text-xs"
                      >
                        {cargandoMovimientos ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Ver más movimientos'}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>
          </section>

          <section className={`${vistaMobile === 'detalle' ? 'flex' : 'hidden'} min-h-[520px] flex-col overflow-hidden xl:flex xl:min-h-0`}>
            {detalle ? (
              <DetalleClientePuntos
                cliente={detalle}
                token={token ?? ''}
                onCerrar={() => setVistaMobile('lista')}
                onSaldoActualizado={(nuevos) => actualizarSaldo(detalle.id, nuevos)}
                onConfigurar={() => setConfigOpen(true)}
              />
            ) : (
              <ResumenPuntos resumen={resumen} cargando={cargandoResumen} onConfigurar={() => setConfigOpen(true)} />
            )}
          </section>
        </div>
      </main>

      <ConfiguracionPuntosDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        onSaved={() => {
          void cargarResumen()
          void cargarClientes(1, true)
        }}
      />
    </div>
  )
}

function MetricaPuntos({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">{label}</span>
      <span className="mt-1 text-xl font-bold tracking-tight tabular-nums text-foreground sm:text-2xl">{value}</span>
      {sublabel && <span className="mt-0.5 text-[11px] text-muted-foreground">{sublabel}</span>}
    </div>
  )
}

function BotonSubTab({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-8 flex-1 items-center justify-center rounded-lg px-2 text-xs font-semibold transition-colors ${activo ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
    >
      {children}
    </button>
  )
}

function BotonNavPuntos({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 min-w-0 items-center justify-center truncate rounded-lg px-2 text-xs font-semibold transition-colors ${activo ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
    >
      {children}
    </button>
  )
}

function PillFiltro({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${activo ? 'border-foreground/20 bg-foreground text-background' : 'border-border/60 bg-background text-muted-foreground hover:text-foreground'}`}
    >
      {children}
    </button>
  )
}

function CargandoLista() {
  return (
    <div className="flex items-center justify-center py-12 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  )
}

function VacioLista({ icono, texto }: { icono: React.ReactNode; texto: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
      {icono}
      <p className="text-xs text-muted-foreground">{texto}</p>
    </div>
  )
}

function FilaClientePuntos({ cliente, activo, onClick }: { cliente: ClienteConPuntosData; activo: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors ${activo ? 'border-foreground/20 bg-muted/60' : 'border-border/40 bg-card hover:border-border hover:bg-muted/40'}`}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{cliente.nombre}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {cliente.telefono}
          {cliente.canjes > 0 ? ` · ${cliente.canjes} ${cliente.canjes === 1 ? 'canje' : 'canjes'}` : ' · sin canjes'}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-black tabular-nums text-amber-600 dark:text-amber-400">{formatPuntos(cliente.puntos)}</p>
        <p className="text-[10px] text-muted-foreground">
          {cliente.ultimoMovimientoAt ? formatFechaHora(cliente.ultimoMovimientoAt) : 'Sin movimientos'}
        </p>
      </div>
    </button>
  )
}

function DetalleClientePuntos({
  cliente,
  token,
  onCerrar,
  onSaldoActualizado,
  onConfigurar,
}: {
  cliente: ClienteEnDetalle
  token: string
  onCerrar: () => void
  onSaldoActualizado: (nuevosPuntos: number) => void
  onConfigurar: () => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col p-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/40 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-lg font-bold tracking-tight text-foreground">{cliente.nombre}</h3>
            <span className="shrink-0 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-sm font-black tabular-nums text-amber-700 dark:text-amber-300">
              {cliente.puntos === null ? '—' : formatPuntos(cliente.puntos)} pts
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {cliente.telefono || 'Sin teléfono'}
            {cliente.actividad?.ultimoMovimientoAt ? ` · último movimiento ${formatFechaHora(cliente.actividad.ultimoMovimientoAt)}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={onConfigurar} className="h-8 rounded-full text-xs text-muted-foreground hover:text-foreground xl:hidden">
            <Settings2 className="mr-1 h-3.5 w-3.5" />
            Configurar
          </Button>
          <Button variant="ghost" size="sm" onClick={onCerrar} className="h-8 rounded-full text-xs text-muted-foreground hover:text-foreground xl:hidden">
            Volver a la lista
          </Button>
        </div>
      </div>

      {cliente.actividad && (
        <div className="grid grid-cols-3 gap-3 border-b border-border/40 py-3">
          <MetricaPuntos label="Otorgados" value={formatPuntos(cliente.actividad.puntosOtorgados)} />
          <MetricaPuntos label="Canjeados" value={formatPuntos(cliente.actividad.puntosCanjeados)} />
          <MetricaPuntos label="Movimientos" value={formatPuntos(cliente.actividad.movimientos)} />
        </div>
      )}

      <HistorialPuntosContenido
        key={cliente.id}
        token={token}
        clienteId={cliente.id}
        puntosActuales={cliente.puntos ?? 0}
        onPuntosActualizados={onSaldoActualizado}
      />
    </div>
  )
}

function ResumenPuntos({
  resumen,
  cargando,
  onConfigurar,
}: {
  resumen: ResumenPuntosData | null
  cargando: boolean
  onConfigurar: () => void
}) {
  const meta = (tipo: string) => metaMovimientoPuntos(tipo)

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto p-6">
      <div className="w-full max-w-lg space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <Sparkles className="h-7 w-7" />
        </div>
        <div>
          <h3 className="text-lg font-bold tracking-tight text-foreground">Club de Puntos</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Elegí un cliente de la lista para ver sus movimientos y ajustar su saldo, o revisá cómo se reparten los canjes.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 text-left sm:grid-cols-3">
          <TarjetaCanje
            icono={<Package className="h-4 w-4" />}
            label={meta('canje_producto').label}
            valor={resumen?.canjesProducto ?? 0}
            cargando={cargando && !resumen}
          />
          <TarjetaCanje
            icono={<Truck className="h-4 w-4" />}
            label={meta('canje_envio').label}
            valor={resumen?.canjesEnvio ?? 0}
            cargando={cargando && !resumen}
          />
          <TarjetaCanje
            icono={<TicketPercent className="h-4 w-4" />}
            label={meta('canje_descuento').label}
            valor={resumen?.canjesDescuento ?? 0}
            cargando={cargando && !resumen}
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={onConfigurar} className="h-9 rounded-full px-4 text-xs font-semibold">
            <Gift className="mr-1.5 h-3.5 w-3.5" />
            Configurar beneficios y productos
          </Button>
        </div>
      </div>
    </div>
  )
}

function TarjetaCanje({ icono, label, valor, cargando }: { icono: React.ReactNode; label: string; valor: number; cargando: boolean }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">
        {icono}
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1 text-lg font-bold tabular-nums text-foreground">{cargando ? '—' : formatPuntos(valor)}</p>
    </div>
  )
}
