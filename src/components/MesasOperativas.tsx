import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Armchair, Banknote, ChefHat, CircleDot, Loader2, Maximize2, Minus, Plus, UtensilsCrossed, Users } from 'lucide-react'
import { mesasLocalesApi, type MesaLocal } from '@/lib/api'
import { cn } from '@/lib/utils'

export type PedidoMesa = {
  id: number
  tipo?: 'delivery' | 'takeaway' | 'mesa'
  estado: string
  pagado?: boolean
  mesaLocalId?: number | null
  consumoEnLocal?: boolean | null
}

type EstadoMesa = 'libre' | 'ocupada' | 'preparando' | 'lista' | 'pendiente_cobro'
const CELL_SIZE = 56
const MIN_ZOOM = 0.2
const MAX_ZOOM = 1.5
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const ESTADO_MESA: Record<EstadoMesa, { label: string; className: string; Icon: typeof CircleDot }> = {
  libre: { label: 'Libre', className: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', Icon: CircleDot },
  ocupada: { label: 'Ocupada', className: 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-400', Icon: UtensilsCrossed },
  preparando: { label: 'Preparando', className: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400', Icon: ChefHat },
  lista: { label: 'Lista', className: 'border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-400', Icon: Armchair },
  pendiente_cobro: { label: 'Pendiente de cobro', className: 'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-400', Icon: Banknote },
}

function estadoDerivado(pedido: PedidoMesa | undefined): EstadoMesa {
  if (!pedido) return 'libre'
  if (pedido.estado === 'ready') return 'lista'
  if (pedido.estado === 'preparing') return 'preparando'
  if (!pedido.pagado) return 'pendiente_cobro'
  return 'ocupada'
}

export function MesasOperativas({
  token,
  sucursalId,
  pedidos,
  refreshKey,
  onMesaLibre,
  onMesaOcupada,
  selectionMode = false,
  selectedMesaId,
}: {
  token: string | null
  sucursalId: number | null
  pedidos: PedidoMesa[]
  refreshKey?: number
  onMesaLibre: (mesa: MesaLocal) => void
  onMesaOcupada: (pedido: PedidoMesa) => void
  selectionMode?: boolean
  selectedMesaId?: number | null
}) {
  const [mesas, setMesas] = useState<MesaLocal[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const viewportRef = useRef<HTMLDivElement>(null)

  const cargar = useCallback(async () => {
    if (!token) { setMesas([]); setCargando(false); return }
    setCargando(true)
    try {
      const respuesta = await mesasLocalesApi.list(token, false)
      setMesas(respuesta.data)
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos cargar las mesas')
    } finally { setCargando(false) }
  }, [token])

  useEffect(() => { void cargar() }, [cargar, refreshKey])

  const mesasVisibles = useMemo(
    () => mesas.filter((mesa) => sucursalId == null || mesa.sucursalId == null || mesa.sucursalId === sucursalId),
    [mesas, sucursalId],
  )
  const pedidosPorMesa = useMemo(() => {
    const mapa = new Map<number, PedidoMesa>()
    for (const pedido of pedidos) {
      const sigueAbierto = !['archived', 'cancelled', 'delivered'].includes(pedido.estado)
      if (sigueAbierto && pedido.mesaLocalId != null && (pedido.tipo === 'mesa' || pedido.consumoEnLocal)) mapa.set(pedido.mesaLocalId, pedido)
    }
    return mapa
  }, [pedidos])
  const limitesPlano = useMemo(() => {
    if (mesasVisibles.length === 0) return { minX: 0, minY: 0, columnas: 1, filas: 1 }
    const minX = Math.min(...mesasVisibles.map((mesa) => mesa.posicionX))
    const minY = Math.min(...mesasVisibles.map((mesa) => mesa.posicionY))
    const maxX = Math.max(...mesasVisibles.map((mesa) => mesa.posicionX + mesa.ancho))
    const maxY = Math.max(...mesasVisibles.map((mesa) => mesa.posicionY + mesa.alto))
    return { minX, minY, columnas: Math.max(1, maxX - minX), filas: Math.max(1, maxY - minY) }
  }, [mesasVisibles])
  const boardWidth = limitesPlano.columnas * CELL_SIZE + 32
  const boardHeight = limitesPlano.filas * CELL_SIZE + 32

  const encajarPlano = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport || mesasVisibles.length === 0) return
    setZoom(clamp(Math.min(
      (viewport.clientWidth - 32) / boardWidth,
      (viewport.clientHeight - 32) / boardHeight,
      1.15,
    ), MIN_ZOOM, MAX_ZOOM))
    requestAnimationFrame(() => viewport.scrollTo({ left: 0, top: 0 }))
  }, [boardHeight, boardWidth, mesasVisibles.length])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || mesasVisibles.length === 0) return
    const frame = requestAnimationFrame(encajarPlano)
    const observer = new ResizeObserver(encajarPlano)
    observer.observe(viewport)
    return () => { cancelAnimationFrame(frame); observer.disconnect() }
  }, [encajarPlano, mesasVisibles.length])

  const cambiarZoom = (siguiente: number) => {
    const viewport = viewportRef.current
    const limitado = clamp(siguiente, MIN_ZOOM, MAX_ZOOM)
    if (!viewport || limitado === zoom) return
    const centroX = (viewport.scrollLeft + viewport.clientWidth / 2) / zoom
    const centroY = (viewport.scrollTop + viewport.clientHeight / 2) / zoom
    setZoom(limitado)
    requestAnimationFrame(() => viewport.scrollTo({ left: centroX * limitado - viewport.clientWidth / 2, top: centroY * limitado - viewport.clientHeight / 2 }))
  }

  if (cargando) return <section className="rounded-2xl border bg-card p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando mesas…</div></section>
  if (error) return <section className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-sm"><p>{error}</p><button type="button" onClick={() => void cargar()} className="mt-2 font-medium underline">Reintentar</button></section>
  if (mesasVisibles.length === 0) return <section className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">No hay mesas configuradas para esta sucursal. Configuralas desde el módulo Mesas.</section>

  return <section aria-label="Mesas operativas" className="flex h-full min-h-0 min-w-0 flex-col">
    <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">{selectionMode ? 'Elegí una mesa libre para asignarla al borrador.' : 'Tocá una mesa para abrir su pedido o empezar uno nuevo.'}</p>
      <div className="flex shrink-0 items-center gap-1 rounded-xl border bg-background p-1 shadow-sm">
        <button type="button" aria-label="Alejar" disabled={zoom <= MIN_ZOOM} onClick={() => cambiarZoom(zoom - 0.1)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted disabled:opacity-30"><Minus className="h-4 w-4" /></button>
        <span className="w-12 text-center text-xs font-semibold tabular-nums">{Math.round(zoom * 100)}%</span>
        <button type="button" aria-label="Acercar" disabled={zoom >= MAX_ZOOM} onClick={() => cambiarZoom(zoom + 0.1)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted disabled:opacity-30"><Plus className="h-4 w-4" /></button>
        <button type="button" aria-label="Encuadrar todas las mesas" onClick={encajarPlano} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted"><Maximize2 className="h-4 w-4" /></button>
      </div>
    </div>
    <div ref={viewportRef} className="min-h-0 flex-1 overflow-auto bg-background" onWheel={(event) => { if (event.ctrlKey || event.metaKey) { event.preventDefault(); cambiarZoom(zoom + (event.deltaY < 0 ? 0.1 : -0.1)) } }}>
      <div
        className="flex min-h-full min-w-full items-center justify-center"
        style={{ width: `max(100%, ${boardWidth * zoom}px)`, height: `max(100%, ${boardHeight * zoom}px)` }}
      >
        <div
          className="relative shrink-0 overflow-hidden bg-background"
          style={{
            width: boardWidth,
            height: boardHeight,
            transform: `scale(${zoom})`,
            transformOrigin: 'center',
            backgroundImage: 'radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)',
            backgroundSize: `${CELL_SIZE / 2}px ${CELL_SIZE / 2}px`,
          }}
        >
      {mesasVisibles.map((mesa) => {
        const pedido = pedidosPorMesa.get(mesa.id)
        const estado = estadoDerivado(pedido)
        const meta = ESTADO_MESA[estado]
        const Icon = meta.Icon
        const noDisponible = selectionMode && !!pedido
        return <button key={mesa.id} type="button" disabled={noDisponible} aria-label={`${mesa.nombre}, ${noDisponible ? 'no disponible' : meta.label}`} title={noDisponible ? `${mesa.nombre} está ocupada` : mesa.nombre} onClick={() => pedido ? onMesaOcupada(pedido) : onMesaLibre(mesa)} className={cn('absolute flex min-h-20 flex-col justify-between overflow-hidden rounded-xl border p-2.5 text-left shadow-sm transition hover:z-10 hover:-translate-y-0.5 hover:shadow-md focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 disabled:hover:shadow-sm', meta.className, selectedMesaId === mesa.id && 'ring-2 ring-[#FF7A00] ring-offset-2')} style={{ left: (mesa.posicionX - limitesPlano.minX) * CELL_SIZE + 16, top: (mesa.posicionY - limitesPlano.minY) * CELL_SIZE + 16, width: Math.max(104, mesa.ancho * CELL_SIZE - 8), height: Math.max(88, mesa.alto * CELL_SIZE - 8) }}>
          <span className="line-clamp-2 w-full break-words text-sm font-bold leading-tight">{mesa.nombre}</span>
          <div><span className="flex items-center gap-1 text-xs font-medium"><Icon className="h-3.5 w-3.5 shrink-0" />{meta.label}{pedido ? ` · #${pedido.id}` : ''}</span><span className="mt-1 flex items-center gap-1 text-[11px] opacity-75"><Users className="h-3 w-3" />{mesa.capacidad}</span></div>
        </button>
      })}
        </div>
      </div>
    </div>
  </section>
}
