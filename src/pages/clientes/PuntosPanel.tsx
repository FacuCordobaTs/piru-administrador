import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/store/authStore'
import {
  ApiError,
  puntosApi,
  type ClienteConPuntosData,
  type FiltroTipoMovimientoPuntos,
  type MovimientoPuntosData,
  type ResumenPuntosData,
} from '@/lib/api'
import { ChevronRight, History, Loader2, Search, Settings2, Sparkles, TicketPercent, Users, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ConfiguracionPuntosPanel } from './ConfiguracionPuntosPanel'
import { ModuloComercial } from '@/components/ModuloComercial'
import { FilaMovimientoPuntos, HistorialPuntosContenido } from './MovimientosPuntos'
import { formatFechaHora, formatPuntos } from './types'

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

const iniciales = (nombre: string) =>
  nombre.trim().split(/\s+/).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase()

/**
 * Mitad "Puntos" de la pantalla de Retención: cuántos puntos hay en juego, qué
 * clientes los tienen, en qué los gastaron y toda la configuración del
 * programa (reglas, beneficios y productos). Sigue el mismo lenguaje visual que
 * Clientes, Campañas y Motor de recompra: listado flotante a la izquierda y, a
 * la derecha, el resumen del club encabezando el detalle del cliente abierto.
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

  const abrirDesdeLista = (cliente: ClienteConPuntosData) => {
    // Volver a tocar el cliente abierto lo cierra: la columna derecha vuelve a la configuración.
    if (detalle?.id === cliente.id) {
      setDetalle(null)
      return
    }
    abrirCliente({
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
  }

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

  /** Sin cliente abierto la columna derecha es la configuración del club: llegar es cerrar el detalle. */
  const verConfiguracion = () => {
    setDetalle(null)
    setVistaMobile('detalle')
  }

  const cerrarCliente = () => {
    setDetalle(null)
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
          <div className="mx-auto mt-6 max-w-sm text-left">
            <ModuloComercial
              codigo="motor_recompra"
              variante="tarjeta"
              tipo="pago"
              titulo="Retención"
              nombreComercial="Retención"
              descripcion="Club de puntos, motor de recompra y campañas de recuperación sobre tu propia base de clientes."
              icono={Sparkles}
              onCambioEstado={() => {
                setBloqueado(false)
                void cargarResumen()
                void cargarClientes(1, true)
              }}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* En mobile el switch de arriba elige la mitad y, dentro de la lista, la vista. */}
      <div className="shrink-0 border-b border-border/30 bg-background/80 px-4 py-2 backdrop-blur-xs xl:hidden">
        <div className="mx-auto grid max-w-xs grid-cols-3 items-center gap-1 rounded-full bg-muted/70 p-1">
          <BotonNavPuntos activo={vistaMobile === 'lista' && subTab === 'clientes'} onClick={() => cambiarSubTab('clientes')}>
            Clientes
          </BotonNavPuntos>
          <BotonNavPuntos activo={vistaMobile === 'lista' && subTab === 'movimientos'} onClick={() => cambiarSubTab('movimientos')}>
            Movimientos
          </BotonNavPuntos>
          <BotonNavPuntos activo={vistaMobile === 'detalle'} onClick={() => setVistaMobile('detalle')}>
            Detalle
          </BotonNavPuntos>
        </div>
      </div>

      {/* Resumen general flotante: sin caja, sólo la tira de métricas. En mobile
          va arriba de todo porque la columna derecha no existe; en escritorio
          vive dentro de esa columna, arriba del cliente seleccionado. */}
      <div className="shrink-0 px-4 pt-4 sm:px-6 xl:hidden">
        <div className="mx-auto max-w-[1680px]">
          <ResumenGeneralPuntos resumen={resumen} cargando={cargandoResumen && !resumen} />
        </div>
      </div>

      <main className="min-h-0 flex-1 overflow-hidden px-4 pb-4 pt-4 sm:px-6">
        <div className="mx-auto grid h-full max-w-[1680px] gap-6 xl:grid-cols-[minmax(320px,380px)_1fr]">
          <section className={cn('min-h-0 flex-col overflow-hidden', vistaMobile === 'lista' ? 'flex' : 'hidden xl:flex')}>
            <div className="space-y-3 pb-3">
              {/* En escritorio la mitad se elige acá; en mobile lo elige la barra de arriba. */}
              <div className="hidden items-center gap-1.5 overflow-x-auto [scrollbar-width:none] xl:flex">
                <TabPill activo={subTab === 'clientes'} icono={<Users className="h-3.5 w-3.5" />} onClick={() => cambiarSubTab('clientes')}>
                  Clientes con puntos
                </TabPill>
                <TabPill activo={subTab === 'movimientos'} icono={<History className="h-3.5 w-3.5" />} onClick={() => cambiarSubTab('movimientos')}>
                  Movimientos
                </TabPill>
              </div>

              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] tabular-nums text-muted-foreground">
                  {subTab === 'clientes'
                    ? `${formatPuntos(totalClientes)} ${totalClientes === 1 ? 'cliente' : 'clientes'}`
                    : `${formatPuntos(totalMovimientos)} ${totalMovimientos === 1 ? 'movimiento' : 'movimientos'}`}
                </p>
                <div className="flex items-center gap-1.5">
                  {subTab === 'clientes' && (
                    <select
                      value={orden}
                      onChange={(evento) => setOrden(evento.target.value as 'puntos' | 'reciente' | 'nombre')}
                      aria-label="Ordenar clientes"
                      className="h-8 rounded-full border border-border/40 bg-background/80 px-3 text-[11px] font-medium text-muted-foreground shadow-2xs backdrop-blur-xs transition-colors hover:text-foreground"
                    >
                      {ORDEN_META.map((item) => (
                        <option key={item.valor} value={item.valor}>{item.label}</option>
                      ))}
                    </select>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={verConfiguracion}
                    className="h-8 gap-1.5 rounded-full border-border/40 bg-background/80 px-3 text-xs font-medium shadow-2xs"
                    title="Ver la configuración de beneficios y productos"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Beneficios y productos</span>
                  </Button>
                </div>
              </div>

              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  value={busqueda}
                  onChange={(evento) => setBusqueda(evento.target.value)}
                  placeholder={subTab === 'clientes' ? 'Buscar por nombre o teléfono…' : 'Buscar por cliente o motivo…'}
                  className="h-9 rounded-full border-border/40 bg-background/80 pl-9 pr-8 text-xs shadow-2xs backdrop-blur-xs transition-all placeholder:text-muted-foreground/50 focus-visible:ring-1"
                />
                {busqueda && (
                  <button
                    type="button"
                    onClick={() => setBusqueda('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
                    title="Borrar búsqueda"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
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
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-1.5 pr-2">
                {subTab === 'clientes' ? (
                  <>
                    {cargandoClientes && clientes.length === 0 ? (
                      <EsqueletosLista />
                    ) : clientes.length === 0 ? (
                      <VacioLista
                        icono={<Users className="h-8 w-8" />}
                        texto={busquedaAplicada ? 'Ningún cliente coincide' : 'Todavía nadie acumuló puntos'}
                        subtexto={busquedaAplicada
                          ? 'Probá con otro nombre o teléfono.'
                          : alcance === 'saldo'
                            ? 'Cuando tus clientes compren, sus puntos aparecen acá.'
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
                  </>
                ) : (
                  <>
                    {cargandoMovimientos && movimientos.length === 0 ? (
                      <EsqueletosLista />
                    ) : movimientos.length === 0 ? (
                      <VacioLista
                        icono={<TicketPercent className="h-8 w-8" />}
                        texto={busquedaAplicada || tipoMovimiento !== 'todos' ? 'Ningún movimiento coincide' : 'Todavía no hay movimientos'}
                        subtexto={busquedaAplicada || tipoMovimiento !== 'todos'
                          ? 'Probá con otro tipo o quitá la búsqueda.'
                          : 'Los puntos que suman y canjean tus clientes se registran acá.'}
                      />
                    ) : (
                      movimientos.map((movimiento) => (
                        <FilaMovimientoPuntos
                          key={movimiento.id}
                          movimiento={movimiento}
                          onSeleccionarCliente={() => abrirDesdeMovimiento(movimiento)}
                        />
                      ))
                    )}
                  </>
                )}
              </div>
            </ScrollArea>

            <div className="flex shrink-0 items-center justify-between pt-3 text-[11px] text-muted-foreground">
              <span className="tabular-nums">
                {subTab === 'clientes'
                  ? `Mostrando ${formatPuntos(clientes.length)} de ${formatPuntos(totalClientes)}`
                  : `Mostrando ${formatPuntos(movimientos.length)} de ${formatPuntos(totalMovimientos)}`}
              </span>
              {(subTab === 'clientes' ? hayMasClientes : hayMasMovimientos) && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={subTab === 'clientes' ? cargandoClientes : cargandoMovimientos}
                  onClick={() => {
                    if (subTab === 'clientes') void cargarClientes(paginaClientes + 1, false)
                    else void cargarMovimientos(paginaMovimientos + 1, false)
                  }}
                  className="h-7 rounded-full px-2.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  {(subTab === 'clientes' ? cargandoClientes : cargandoMovimientos)
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : 'Ver más'}
                </Button>
              )}
            </div>
          </section>

          <section className={cn('min-h-0 flex-col overflow-hidden', vistaMobile === 'detalle' ? 'flex' : 'hidden xl:flex')}>
            {/* El resumen encabeza la columna: a la derecha del listado y por
                encima del detalle, abra o no un cliente. */}
            <div className="hidden shrink-0 px-4 pt-4 sm:px-6 xl:block">
              <ResumenGeneralPuntos resumen={resumen} cargando={cargandoResumen && !resumen} />
            </div>
            {detalle ? (
              <DetalleClientePuntos
                cliente={detalle}
                token={token ?? ''}
                onSaldoActualizado={(nuevos) => actualizarSaldo(detalle.id, nuevos)}
                onConfigurar={verConfiguracion}
                onCerrar={cerrarCliente}
              />
            ) : (
              <ConfiguracionPuntosPanel
                onSaved={() => {
                  void cargarResumen()
                  void cargarClientes(1, true)
                }}
              />
            )}
          </section>
        </div>
      </main>
    </div>
  )
}

/** Tira de métricas flotante, sin caja: el mismo tratamiento que Clientes y Cupones. */
function FloatingMetric({ label, value, sublabel }: { label: string; value: string | number; sublabel?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">{label}</span>
      <span className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-foreground sm:text-3xl">{value}</span>
      {sublabel && <span className="mt-0.5 text-[11px] text-muted-foreground">{sublabel}</span>}
    </div>
  )
}

/** Métrica densa para las filas internas del detalle. */
function CompactMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">{label}</span>
      <span className="mt-0.5 text-xl font-bold tracking-tight tabular-nums text-foreground">{value}</span>
    </div>
  )
}

function TabPill({ activo, onClick, icono, children }: { activo: boolean; onClick: () => void; icono: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition-colors',
        activo ? 'bg-foreground text-background shadow-2xs' : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {icono}
      <span>{children}</span>
    </button>
  )
}

function BotonNavPuntos({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'min-w-0 truncate rounded-full px-2 py-1 text-center text-xs font-medium transition-all',
        activo ? 'bg-background text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground',
      )}
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
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all shadow-2xs',
        activo
          ? 'bg-foreground text-background'
          : 'border border-border/40 bg-background/80 text-muted-foreground backdrop-blur-xs hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function EsqueletosLista() {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: 6 }).map((_, indice) => (
        <Skeleton key={indice} className="h-16 rounded-xl" />
      ))}
    </div>
  )
}

function VacioLista({ icono, texto, subtexto }: { icono: React.ReactNode; texto: string; subtexto: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
      <span className="text-muted-foreground/30">{icono}</span>
      <p className="mt-3 text-sm font-medium text-foreground">{texto}</p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">{subtexto}</p>
    </div>
  )
}

function FilaClientePuntos({ cliente, activo, onClick }: { cliente: ClienteConPuntosData; activo: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border-0 p-3 text-left transition-colors',
        activo
          ? 'border-l-[3px] border-l-[#FF7A00] bg-muted/40 shadow-2xs'
          : 'bg-white shadow-2xs hover:bg-muted/40 dark:bg-muted/20',
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground">
        {iniciales(cliente.nombre)}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{cliente.nombre}</p>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="truncate">{cliente.telefono}</span>
          <span>·</span>
          <span className="shrink-0">{cliente.canjes > 0 ? `${cliente.canjes} ${cliente.canjes === 1 ? 'canje' : 'canjes'}` : 'sin canjes'}</span>
        </div>
        <p className="mt-1 truncate text-[11px] text-muted-foreground/70">
          {cliente.ultimoMovimientoAt ? `Último ${formatFechaHora(cliente.ultimoMovimientoAt)}` : 'Sin movimientos'}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-sm font-black tabular-nums text-amber-600 dark:text-amber-400">{formatPuntos(cliente.puntos)}</p>
        <p className="text-[10px] text-muted-foreground/70">pts</p>
      </div>

      <ChevronRight className={cn('h-4 w-4 shrink-0', activo ? 'text-[#FF7A00]' : 'text-muted-foreground/30')} />
    </button>
  )
}

function DetalleClientePuntos({
  cliente,
  token,
  onSaldoActualizado,
  onConfigurar,
  onCerrar,
}: {
  cliente: ClienteEnDetalle
  token: string
  onSaldoActualizado: (nuevosPuntos: number) => void
  onConfigurar: () => void
  onCerrar: () => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-start justify-between gap-3 p-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted/80 text-sm font-semibold tracking-tight text-foreground">
            {iniciales(cliente.nombre)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">{cliente.nombre}</h2>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                <Sparkles className="h-3 w-3" />
                {cliente.puntos === null ? '—' : formatPuntos(cliente.puntos)} pts
              </span>
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground/80">
              {cliente.telefono || 'Sin teléfono'}
              {cliente.actividad?.ultimoMovimientoAt ? ` · último movimiento ${formatFechaHora(cliente.actividad.ultimoMovimientoAt)}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* En mobile la lista vuelve con el switch de arriba; este botón lleva
              directo a la configuración, que vive en esta misma columna. */}
          <Button
            variant="secondary"
            size="sm"
            onClick={onConfigurar}
            title="Ver la configuración de beneficios y productos"
            className="h-8 gap-1.5 rounded-full px-3 text-xs font-medium xl:hidden"
          >
            <Settings2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Configurar</span>
          </Button>
          {/* Cerrar el cliente devuelve la columna a la configuración del club. */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onCerrar}
            title="Cerrar el cliente"
            aria-label="Cerrar el cliente"
            className="h-8 w-8 rounded-full text-muted-foreground/60 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {cliente.actividad && (
        <div className="grid shrink-0 grid-cols-3 gap-x-6 gap-y-3 border-y border-border/30 py-4 pr-4 sm:px-6">
          <CompactMetric label="Otorgados" value={formatPuntos(cliente.actividad.puntosOtorgados)} />
          <CompactMetric label="Canjeados" value={formatPuntos(cliente.actividad.puntosCanjeados)} />
          <CompactMetric label="Movimientos" value={formatPuntos(cliente.actividad.movimientos)} />
        </div>
      )}

      <HistorialPuntosContenido
        key={cliente.id}
        token={token}
        clienteId={cliente.id}
        puntosActuales={cliente.puntos ?? 0}
        onPuntosActualizados={onSaldoActualizado}
        className="flex min-h-0 flex-1 flex-col px-4 sm:px-6"
      />
    </div>
  )
}

/** Resumen general del club: rótulo, conteo y la tira de métricas flotantes. */
function ResumenGeneralPuntos({ resumen, cargando }: { resumen: ResumenPuntosData | null; cargando: boolean }) {
  const dato = (valor: number | undefined) => (cargando ? '—' : formatPuntos(valor ?? 0))
  const sublabel = (texto: string) => (cargando ? undefined : texto)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          Resumen del club de puntos
        </span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {cargando ? '—' : formatPuntos(resumen?.movimientos ?? 0)} movimientos
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 border-y border-border/30 py-3 sm:grid-cols-4">
        <FloatingMetric
          label="Puntos en circulación"
          value={dato(resumen?.puntosEnCirculacion)}
          sublabel={sublabel('Saldo pendiente de canje')}
        />
        <FloatingMetric
          label="Clientes con puntos"
          value={dato(resumen?.clientesConPuntos)}
          sublabel={sublabel(`${formatPuntos(resumen?.clientesConHistorial ?? 0)} con historial`)}
        />
        <FloatingMetric
          label="Otorgados (30 días)"
          value={dato(resumen?.puntosOtorgados30Dias)}
          sublabel={sublabel(`${formatPuntos(resumen?.puntosOtorgados ?? 0)} históricos`)}
        />
        <FloatingMetric
          label="Canjes (30 días)"
          value={dato(resumen?.canjes30Dias)}
          sublabel={sublabel(`${formatPuntos(resumen?.canjes ?? 0)} históricos`)}
        />
      </div>

      <p className="text-[11px] text-muted-foreground">
        {resumen?.ultimoMovimientoAt
          ? `Último movimiento de puntos: ${formatFechaHora(resumen.ultimoMovimientoAt)}`
          : 'Todavía no hay movimientos de puntos registrados.'}
      </p>
    </div>
  )
}
