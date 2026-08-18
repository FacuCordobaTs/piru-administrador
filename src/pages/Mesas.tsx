import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Armchair,
  Check,
  ChevronDown,
  CircleHelp,
  Grid3X3,
  Hand,
  Info,
  Loader2,
  MapPin,
  Maximize2,
  Minus,
  MousePointer2,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Trash2,
  Undo2,
  Users,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { mesasLocalesApi, type MesaLocal } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useModuloActivo } from '@/store/modulosStore'
import { useSucursales, type Sucursal } from '@/pages/ajustes/hooks/useSucursales'

// El lienzo arranca holgado y crece automáticamente cuando una mesa se acerca
// a sus bordes. Estas medidas son sólo el tamaño inicial, nunca un límite.
const INITIAL_CANVAS_COLUMNS = 64
const INITIAL_CANVAS_ROWS = 64
const CANVAS_GROWTH_MARGIN = 16
const CELL_SIZE = 56
const MIN_ZOOM = 0.45
const MAX_ZOOM = 1.35

type CanvasMode = 'select' | 'place'
type MesaDraft = Omit<MesaLocal, 'id' | 'restauranteId'>
type DragState = {
  mesaId: number
  pointerId: number
  offsetX: number
  offsetY: number
  moved: boolean
  originalX: number
  originalY: number
}

const SIZE_PRESETS = [
  { key: 'compacta', label: 'Compacta', detail: '2 × 2', ancho: 2, alto: 2 },
  { key: 'larga', label: 'Alargada', detail: '3 × 2', ancho: 3, alto: 2 },
  { key: 'grande', label: 'Grande', detail: '4 × 3', ancho: 4, alto: 3 },
] as const

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

function mesasSeSuperponen(a: Pick<MesaLocal, 'posicionX' | 'posicionY' | 'ancho' | 'alto'>, b: Pick<MesaLocal, 'posicionX' | 'posicionY' | 'ancho' | 'alto'>) {
  return a.posicionX < b.posicionX + b.ancho
    && a.posicionX + a.ancho > b.posicionX
    && a.posicionY < b.posicionY + b.alto
    && a.posicionY + a.alto > b.posicionY
}

function compartenPlano(a: Pick<MesaLocal, 'sucursalId'>, b: Pick<MesaLocal, 'sucursalId'>) {
  return a.sucursalId == null || b.sucursalId == null || a.sucursalId === b.sucursalId
}

function posicionDisponible(mesa: Pick<MesaLocal, 'id' | 'posicionX' | 'posicionY' | 'ancho' | 'alto' | 'sucursalId'>, mesas: MesaLocal[]) {
  if (mesa.posicionX < 0 || mesa.posicionY < 0) return false
  return !mesas.some((otra) => otra.id !== mesa.id && otra.activo && compartenPlano(mesa, otra) && mesasSeSuperponen(mesa, otra))
}

function serializar(mesas: MesaLocal[]) {
  return JSON.stringify(mesas.map(({ id, nombre, sucursalId, posicionX, posicionY, ancho, alto, capacidad, estadoManual, activo, orden }) => ({
    id, nombre, sucursalId, posicionX, posicionY, ancho, alto, capacidad, estadoManual, activo, orden,
  })))
}

function crearDraft(orden: number, posicionX: number, posicionY: number, sucursalId: number | null): MesaDraft {
  return {
    sucursalId,
    nombre: `Mesa ${orden + 1}`,
    posicionX,
    posicionY,
    ancho: 2,
    alto: 2,
    capacidad: 4,
    estadoManual: null,
    activo: true,
    orden,
  }
}

function Counter({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <div className="flex h-11 items-center rounded-xl border bg-background p-1">
    <button type="button" aria-label="Restar una persona" disabled={value <= min} onClick={() => onChange(value - 1)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30"><Minus className="h-4 w-4" /></button>
    <span className="min-w-12 flex-1 text-center text-sm font-semibold tabular-nums">{value}</span>
    <button type="button" aria-label="Sumar una persona" disabled={value >= max} onClick={() => onChange(value + 1)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30"><Plus className="h-4 w-4" /></button>
  </div>
}

function MesaInspector({
  mesa,
  sucursales,
  onChange,
  onResize,
  onDesactivar,
}: {
  mesa: MesaLocal
  sucursales: Sucursal[]
  onChange: (patch: Partial<MesaLocal>) => void
  onResize: (ancho: number, alto: number) => void
  onDesactivar: () => void
}) {
  const [avanzadoAbierto, setAvanzadoAbierto] = useState(Boolean(mesa.estadoManual))

  return <aside className="overflow-hidden rounded-2xl border bg-card shadow-sm lg:sticky lg:top-5">
    <div className="border-b bg-gradient-to-br from-orange-50 to-white px-5 py-4 dark:from-orange-950/20 dark:to-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand"><MousePointer2 className="h-3.5 w-3.5" />Mesa seleccionada</div>
          <h2 className="truncate text-xl font-semibold tracking-tight">{mesa.nombre || 'Sin nombre'}</h2>
          <p className="mt-1 text-xs text-muted-foreground">Los cambios quedan pendientes hasta que guardes el plano.</p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={onDesactivar} className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></TooltipTrigger>
          <TooltipContent>Retirar mesa del salón</TooltipContent>
        </Tooltip>
      </div>
    </div>

    <div className="space-y-6 p-5">
      <div className="space-y-2">
        <Label htmlFor="mesa-nombre">Nombre que verá el equipo</Label>
        <Input id="mesa-nombre" value={mesa.nombre} placeholder="Ej. Mesa 8, Patio 2…" onChange={(event) => onChange({ nombre: event.target.value })} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="mesa-sucursal">¿En qué local está?</Label>
          <span className="text-[11px] text-muted-foreground">Ubicación operativa</span>
        </div>
        <select id="mesa-sucursal" className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20" value={mesa.sucursalId ?? ''} onChange={(event) => onChange({ sucursalId: event.target.value ? Number(event.target.value) : null })}>
          <option value="">Disponible en todas las sucursales</option>
          {sucursales.filter((sucursal) => sucursal.activo).map((sucursal) => <option key={sucursal.id} value={sucursal.id}>{sucursal.nombre}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>¿Cuántas personas entran?</Label>
          <Users className="h-4 w-4 text-muted-foreground" />
        </div>
        <Counter value={mesa.capacidad} min={1} max={100} onChange={(capacidad) => onChange({ capacidad })} />
        <p className="text-xs leading-relaxed text-muted-foreground">Sirve para que el equipo asigne el grupo correcto. No modifica el tamaño visual.</p>
      </div>

      <div className="space-y-3">
        <div>
          <Label>Tamaño en el plano</Label>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Elegí la forma que más se parezca a la mesa real.</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {SIZE_PRESETS.map((preset) => {
            const activa = mesa.ancho === preset.ancho && mesa.alto === preset.alto
            return <button key={preset.key} type="button" onClick={() => onResize(preset.ancho, preset.alto)} className={cn('relative rounded-xl border px-2 py-3 text-center transition hover:border-brand/50 hover:bg-brand/5', activa && 'border-brand bg-brand/10 ring-2 ring-brand/15')}>
              {activa && <Check className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-brand" />}
              <span className="mx-auto mb-2 block rounded border-2 border-current text-muted-foreground" style={{ width: 13 + preset.ancho * 4, height: 10 + preset.alto * 4 }} />
              <span className="block text-xs font-medium">{preset.label}</span>
              <span className="mt-0.5 block text-[10px] text-muted-foreground">{preset.detail}</span>
            </button>
          })}
        </div>
      </div>

      <div className="border-t pt-4">
        <button type="button" onClick={() => setAvanzadoAbierto((actual) => !actual)} className="flex w-full items-center justify-between rounded-lg py-1 text-left text-sm font-medium">
          Opciones avanzadas
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', avanzadoAbierto && 'rotate-180')} />
        </button>
        {avanzadoAbierto && <div className="mt-4 space-y-2">
          <div className="flex items-center gap-1.5"><Label htmlFor="mesa-etiqueta">Etiqueta interna</Label><Tooltip><TooltipTrigger asChild><CircleHelp className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger><TooltipContent className="max-w-64">Una referencia breve para el equipo. No cambia automáticamente si la mesa está libre u ocupada.</TooltipContent></Tooltip></div>
          <Input id="mesa-etiqueta" value={mesa.estadoManual ?? ''} maxLength={50} placeholder="Ej. junto a la ventana" onChange={(event) => onChange({ estadoManual: event.target.value || null })} />
          <p className="text-xs leading-relaxed text-muted-foreground">Úsala para una característica estable, no para reservas ni estados del día.</p>
        </div>}
      </div>
    </div>
  </aside>
}

function EmptyInspector({ onPlace }: { onPlace: () => void }) {
  return <aside className="rounded-2xl border border-dashed bg-card/60 p-6 text-center lg:sticky lg:top-5">
    <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-brand"><MousePointer2 className="h-5 w-5" /></div>
    <h2 className="mt-4 font-semibold">Seleccioná una mesa</h2>
    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Tocá una mesa para cambiar su nombre, capacidad, tamaño o sucursal.</p>
    <Button variant="outline" className="mt-5 w-full" onClick={onPlace}><Plus className="mr-2 h-4 w-4" />Agregar una nueva</Button>
  </aside>
}

export default function Mesas() {
  const token = useAuthStore((state) => state.token)
  const mesasActivo = useModuloActivo('mesas')
  const { sucursales } = useSucursales()
  const [mesas, setMesas] = useState<MesaLocal[]>([])
  const [guardadas, setGuardadas] = useState<MesaLocal[]>([])
  const [seleccionadaId, setSeleccionadaId] = useState<number | null>(null)
  const [sucursalActivaId, setSucursalActivaId] = useState<number | null>(null)
  const [modo, setModo] = useState<CanvasMode>('select')
  const [zoom, setZoom] = useState(0.8)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [creando, setCreando] = useState(false)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [celdaHover, setCeldaHover] = useState<{ x: number; y: number } | null>(null)
  const [historial, setHistorial] = useState<MesaLocal[][]>([])
  const [futuro, setFuturo] = useState<MesaLocal[][]>([])
  const viewportRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const inicializoSucursal = useRef(false)
  const clickSuprimido = useRef(false)

  const sucursalesActivas = useMemo(() => sucursales.filter((sucursal) => sucursal.activo), [sucursales])
  const mesasVisibles = useMemo(() => mesas.filter((mesa) => mesa.activo && (sucursalActivaId == null ? mesa.sucursalId == null : mesa.sucursalId == null || mesa.sucursalId === sucursalActivaId)), [mesas, sucursalActivaId])
  const seleccionada = useMemo(() => mesas.find((mesa) => mesa.id === seleccionadaId) ?? null, [mesas, seleccionadaId])
  const canvasColumns = useMemo(() => Math.max(
    INITIAL_CANVAS_COLUMNS,
    ...mesasVisibles.map((mesa) => mesa.posicionX + mesa.ancho + CANVAS_GROWTH_MARGIN),
    (celdaHover?.x ?? 0) + 2 + CANVAS_GROWTH_MARGIN,
  ), [celdaHover?.x, mesasVisibles])
  const canvasRows = useMemo(() => Math.max(
    INITIAL_CANVAS_ROWS,
    ...mesasVisibles.map((mesa) => mesa.posicionY + mesa.alto + CANVAS_GROWTH_MARGIN),
    (celdaHover?.y ?? 0) + 2 + CANVAS_GROWTH_MARGIN,
  ), [celdaHover?.y, mesasVisibles])
  const boardWidth = canvasColumns * CELL_SIZE
  const boardHeight = canvasRows * CELL_SIZE
  const hayCambios = useMemo(() => serializar(mesas) !== serializar(guardadas), [guardadas, mesas])
  const paresSuperpuestos = useMemo(() => {
    const ids = new Set<number>()
    for (let i = 0; i < mesas.length; i += 1) for (let j = i + 1; j < mesas.length; j += 1) {
      if (mesas[i].activo && mesas[j].activo && compartenPlano(mesas[i], mesas[j]) && mesasSeSuperponen(mesas[i], mesas[j])) {
        ids.add(mesas[i].id); ids.add(mesas[j].id)
      }
    }
    return ids
  }, [mesas])

  useEffect(() => {
    if (!inicializoSucursal.current && sucursalesActivas.length > 0) {
      inicializoSucursal.current = true
      setSucursalActivaId(sucursalesActivas[0].id)
    }
  }, [sucursalesActivas])

  const cargar = useCallback(async () => {
    if (!token || !mesasActivo) { setCargando(false); return }
    setCargando(true)
    try {
      const activas = (await mesasLocalesApi.list(token, false)).data
      setMesas(activas)
      setGuardadas(activas)
      setHistorial([])
      setFuturo([])
      setSeleccionadaId((actual) => activas.some((mesa) => mesa.id === actual) ? actual : null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No pudimos cargar las mesas')
    } finally { setCargando(false) }
  }, [mesasActivo, token])

  useEffect(() => { void cargar() }, [cargar])

  useEffect(() => {
    if (!hayCambios) return
    const prevenirSalida = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener('beforeunload', prevenirSalida)
    return () => window.removeEventListener('beforeunload', prevenirSalida)
  }, [hayCambios])

  const guardarCheckpoint = useCallback(() => {
    setHistorial((actual) => [...actual.slice(-29), mesas])
    setFuturo([])
  }, [mesas])

  const cambiar = (id: number, patch: Partial<MesaLocal>, checkpoint = true) => {
    if (checkpoint) guardarCheckpoint()
    setMesas((actual) => actual.map((mesa) => mesa.id === id ? { ...mesa, ...patch } : mesa))
  }

  const deshacer = () => {
    const anterior = historial.at(-1)
    if (!anterior) return
    setFuturo((actual) => [mesas, ...actual].slice(0, 30))
    setMesas(anterior)
    setHistorial((actual) => actual.slice(0, -1))
  }

  const rehacer = () => {
    const siguiente = futuro[0]
    if (!siguiente) return
    setHistorial((actual) => [...actual.slice(-29), mesas])
    setMesas(siguiente)
    setFuturo((actual) => actual.slice(1))
  }

  const cambiarZoom = (siguienteZoom: number) => {
    const viewport = viewportRef.current
    const limitado = clamp(siguienteZoom, MIN_ZOOM, MAX_ZOOM)
    if (!viewport || limitado === zoom) { setZoom(limitado); return }
    const centroX = (viewport.scrollLeft + viewport.clientWidth / 2) / zoom
    const centroY = (viewport.scrollTop + viewport.clientHeight / 2) / zoom
    setZoom(limitado)
    requestAnimationFrame(() => viewport.scrollTo({ left: centroX * limitado - viewport.clientWidth / 2, top: centroY * limitado - viewport.clientHeight / 2 }))
  }

  const encajarPlano = () => {
    const viewport = viewportRef.current
    if (!viewport) return
    if (mesasVisibles.length === 0) {
      setZoom(0.8)
      requestAnimationFrame(() => viewport.scrollTo({ left: 0, top: 0, behavior: 'smooth' }))
      return
    }
    const margen = 2
    const minX = Math.max(0, Math.min(...mesasVisibles.map((mesa) => mesa.posicionX)) - margen)
    const minY = Math.max(0, Math.min(...mesasVisibles.map((mesa) => mesa.posicionY)) - margen)
    const maxX = Math.max(...mesasVisibles.map((mesa) => mesa.posicionX + mesa.ancho)) + margen
    const maxY = Math.max(...mesasVisibles.map((mesa) => mesa.posicionY + mesa.alto)) + margen
    const nuevoZoom = clamp(Math.min(
      (viewport.clientWidth - 48) / ((maxX - minX) * CELL_SIZE),
      (viewport.clientHeight - 48) / ((maxY - minY) * CELL_SIZE),
      1.1,
    ), MIN_ZOOM, MAX_ZOOM)
    setZoom(nuevoZoom)
    requestAnimationFrame(() => viewport.scrollTo({
      left: minX * CELL_SIZE * nuevoZoom,
      top: minY * CELL_SIZE * nuevoZoom,
      behavior: 'smooth',
    }))
  }

  const coordenadasCelda = (clientX: number, clientY: number) => {
    const board = boardRef.current
    if (!board) return null
    const bounds = board.getBoundingClientRect()
    return {
      x: clamp(Math.floor((clientX - bounds.left) / (CELL_SIZE * zoom)), 0, canvasColumns - 1),
      y: clamp(Math.floor((clientY - bounds.top) / (CELL_SIZE * zoom)), 0, canvasRows - 1),
    }
  }

  const crearEn = async (x: number, y: number) => {
    if (!token || creando) return
    const draft = crearDraft(mesas.length, Math.max(0, x), Math.max(0, y), sucursalActivaId)
    if (!posicionDisponible({ ...draft, id: -1 }, mesas)) {
      toast.info('Ese lugar ya está ocupado. Elegí otro espacio libre.')
      return
    }
    setCreando(true)
    try {
      const mesa = (await mesasLocalesApi.create(token, draft)).data
      setMesas((actual) => [...actual, mesa])
      setGuardadas((actual) => [...actual, mesa])
      setHistorial([])
      setFuturo([])
      setSeleccionadaId(mesa.id)
      setModo('select')
      toast.success(`${mesa.nombre} agregada`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No pudimos crear la mesa')
    } finally { setCreando(false) }
  }

  const activarColocacion = () => {
    setSeleccionadaId(null)
    setModo('place')
    toast.info('Elegí un espacio libre del plano')
  }

  const guardar = async () => {
    if (!token || !hayCambios) return
    const sinNombre = mesas.find((mesa) => !mesa.nombre.trim())
    if (sinNombre) { setSeleccionadaId(sinNombre.id); toast.error('Todas las mesas necesitan un nombre'); return }
    if (paresSuperpuestos.size > 0) { toast.error('Separá las mesas marcadas en rojo antes de guardar'); return }
    setGuardando(true)
    try {
      await Promise.all(mesas.map((mesa) => mesasLocalesApi.update(token, mesa.id, {
        nombre: mesa.nombre.trim(), sucursalId: mesa.sucursalId, capacidad: mesa.capacidad, estadoManual: mesa.estadoManual, activo: mesa.activo,
      })))
      if (mesas.length > 0) await mesasLocalesApi.guardarLayout(token, mesas.map(({ id, posicionX, posicionY, ancho, alto, orden }) => ({ id, posicionX, posicionY, ancho, alto, orden })))
      const normalizadas = mesas.map((mesa) => ({ ...mesa, nombre: mesa.nombre.trim() }))
      setMesas(normalizadas)
      setGuardadas(normalizadas)
      setHistorial([])
      setFuturo([])
      toast.success('Plano guardado y listo para usar')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No pudimos guardar el plano')
    } finally { setGuardando(false) }
  }

  const descartarCambios = () => {
    setMesas(guardadas)
    setHistorial([])
    setFuturo([])
    setSeleccionadaId((actual) => guardadas.some((mesa) => mesa.id === actual) ? actual : null)
    toast.success('Cambios descartados')
  }

  const desactivar = async (id: number) => {
    if (!token || !confirm('¿Retirar esta mesa del salón? Su historial de pedidos se conservará.')) return
    try {
      await mesasLocalesApi.desactivar(token, id)
      setMesas((actual) => actual.filter((mesa) => mesa.id !== id))
      setGuardadas((actual) => actual.filter((mesa) => mesa.id !== id))
      setHistorial([])
      setFuturo([])
      setSeleccionadaId(null)
      toast.success('Mesa retirada. Su historial sigue disponible.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No pudimos retirar la mesa')
    }
  }

  const redimensionar = (mesa: MesaLocal, ancho: number, alto: number) => {
    const posicionX = Math.max(0, mesa.posicionX)
    const posicionY = Math.max(0, mesa.posicionY)
    const candidata = { ...mesa, ancho, alto, posicionX, posicionY }
    if (!posicionDisponible(candidata, mesas)) { toast.info('No hay espacio para ese tamaño. Mové primero las mesas cercanas.'); return }
    cambiar(mesa.id, { ancho, alto, posicionX, posicionY })
  }

  const iniciarDrag = (event: React.PointerEvent<HTMLButtonElement>, mesa: MesaLocal) => {
    if (modo === 'place') return
    event.preventDefault()
    event.stopPropagation()
    const board = boardRef.current
    if (!board) return
    const bounds = board.getBoundingClientRect()
    const pointerX = (event.clientX - bounds.left) / zoom
    const pointerY = (event.clientY - bounds.top) / zoom
    event.currentTarget.setPointerCapture(event.pointerId)
    guardarCheckpoint()
    setSeleccionadaId(mesa.id)
    setDrag({
      mesaId: mesa.id,
      pointerId: event.pointerId,
      offsetX: pointerX - mesa.posicionX * CELL_SIZE,
      offsetY: pointerY - mesa.posicionY * CELL_SIZE,
      moved: false,
      originalX: mesa.posicionX,
      originalY: mesa.posicionY,
    })
  }

  const moverDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag || event.pointerId !== drag.pointerId) return
    const board = boardRef.current
    const viewport = viewportRef.current
    const mesa = mesas.find((item) => item.id === drag.mesaId)
    if (!board || !mesa) return
    if (viewport) {
      const viewportBounds = viewport.getBoundingClientRect()
      const zonaBorde = 56
      const paso = 22
      const scrollX = event.clientX < viewportBounds.left + zonaBorde ? -paso : event.clientX > viewportBounds.right - zonaBorde ? paso : 0
      const scrollY = event.clientY < viewportBounds.top + zonaBorde ? -paso : event.clientY > viewportBounds.bottom - zonaBorde ? paso : 0
      if (scrollX || scrollY) viewport.scrollBy({ left: scrollX, top: scrollY })
    }
    const bounds = board.getBoundingClientRect()
    const pointerX = (event.clientX - bounds.left) / zoom
    const pointerY = (event.clientY - bounds.top) / zoom
    const x = clamp(Math.round((pointerX - drag.offsetX) / CELL_SIZE), 0, canvasColumns - mesa.ancho)
    const y = clamp(Math.round((pointerY - drag.offsetY) / CELL_SIZE), 0, canvasRows - mesa.alto)
    if (x === mesa.posicionX && y === mesa.posicionY) return
    setDrag((actual) => actual ? { ...actual, moved: true } : null)
    setMesas((actual) => actual.map((item) => item.id === mesa.id ? { ...item, posicionX: x, posicionY: y } : item))
  }

  const terminarDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag || event.pointerId !== drag.pointerId) return
    const mesa = mesas.find((item) => item.id === drag.mesaId)
    const posicionValida = mesa ? posicionDisponible(mesa, mesas) : false
    if (mesa && !posicionValida) {
      setMesas((actual) => actual.map((item) => item.id === drag.mesaId ? { ...item, posicionX: drag.originalX, posicionY: drag.originalY } : item))
      setHistorial((actual) => actual.slice(0, -1))
      toast.info('Ese lugar está ocupado. La mesa volvió a su posición anterior.')
    }
    if (!drag.moved && posicionValida) {
      setHistorial((actual) => actual.slice(0, -1))
    } else {
      clickSuprimido.current = true
      window.setTimeout(() => { clickSuprimido.current = false }, 0)
    }
    setDrag(null)
  }

  const manejarClickPlano = (event: React.MouseEvent<HTMLDivElement>) => {
    if (clickSuprimido.current || modo !== 'place') return
    const celda = coordenadasCelda(event.clientX, event.clientY)
    if (celda) void crearEn(celda.x, celda.y)
  }

  if (!mesasActivo) return <div className="mx-auto max-w-3xl px-4 py-10">
    <div className="rounded-3xl border bg-card p-8 shadow-sm">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-brand"><Armchair className="h-6 w-6" /></div>
      <h1 className="mt-5 text-2xl font-semibold">Plano de mesas</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">Activá el módulo Mesas para dibujar tu salón y operar pedidos desde cada mesa.</p>
    </div>
  </div>

  return <TooltipProvider delayDuration={300}>
    <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:py-8">
      <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-brand"><MapPin className="h-4 w-4" />Organización del salón</div>
          <h1 className="mt-1.5 text-3xl font-semibold tracking-tight sm:text-4xl">Plano de mesas</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Recreá la distribución real de tu local. Todo encaja en posiciones fijas: lo que ves acá es exactamente lo que verá tu equipo.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hayCambios && <span className="mr-1 inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />Cambios sin guardar</span>}
          <Button variant="outline" disabled={!hayCambios || guardando} onClick={descartarCambios}><RotateCcw className="mr-2 h-4 w-4" />Descartar</Button>
          <Button disabled={!hayCambios || guardando || paresSuperpuestos.size > 0} onClick={() => void guardar()} className="min-w-40">
            {guardando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {guardando ? 'Guardando…' : 'Guardar plano'}
          </Button>
        </div>
      </header>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_370px]">
        <section className="min-w-0 overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={modo === 'place' ? () => setModo('select') : activarColocacion} variant={modo === 'place' ? 'default' : 'outline'}>
                {modo === 'place' ? <MousePointer2 className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                {modo === 'place' ? 'Elegí un lugar…' : 'Agregar mesa'}
              </Button>
              {sucursalesActivas.length > 0 && <select aria-label="Sucursal del plano" className="h-9 max-w-52 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/20" value={sucursalActivaId ?? ''} onChange={(event) => { setSucursalActivaId(event.target.value ? Number(event.target.value) : null); setSeleccionadaId(null) }}>
                <option value="">Mesas generales</option>
                {sucursalesActivas.map((sucursal) => <option key={sucursal.id} value={sucursal.id}>{sucursal.nombre}</option>)}
              </select>}
              <span className="hidden text-xs text-muted-foreground 2xl:inline">{mesasVisibles.length} {mesasVisibles.length === 1 ? 'mesa visible' : 'mesas visibles'}</span>
            </div>

            <div className="flex items-center gap-1">
              <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" disabled={historial.length === 0} onClick={deshacer} className="h-9 w-9"><Undo2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Deshacer</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" disabled={futuro.length === 0} onClick={rehacer} className="h-9 w-9"><Redo2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Rehacer</TooltipContent></Tooltip>
              <div className="mx-1 h-5 w-px bg-border" />
              <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" onClick={() => cambiarZoom(zoom - 0.1)} disabled={zoom <= MIN_ZOOM} className="h-9 w-9"><ZoomOut className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Alejar</TooltipContent></Tooltip>
              <span className="w-11 text-center text-xs font-medium tabular-nums">{Math.round(zoom * 100)}%</span>
              <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" onClick={() => cambiarZoom(zoom + 0.1)} disabled={zoom >= MAX_ZOOM} className="h-9 w-9"><ZoomIn className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Acercar</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" onClick={encajarPlano} className="h-9 w-9"><Maximize2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Encuadrar todas las mesas</TooltipContent></Tooltip>
            </div>
          </div>

          {modo === 'place' && <div className="flex items-center justify-between gap-3 border-b bg-brand/10 px-4 py-2.5 text-sm text-foreground">
            <div className="flex items-center gap-2"><div className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-white"><Plus className="h-4 w-4" /></div><span><strong>Modo agregar:</strong> tocá un espacio libre para colocar la mesa.</span></div>
            <button type="button" onClick={() => setModo('select')} className="text-xs font-semibold text-brand hover:underline">Cancelar</button>
          </div>}

          {paresSuperpuestos.size > 0 && <div className="flex items-start gap-2 border-b bg-destructive/8 px-4 py-3 text-sm text-destructive"><Info className="mt-0.5 h-4 w-4 shrink-0" /><span>Hay mesas superpuestas. Separá las marcadas en rojo para poder guardar.</span></div>}

          <div className="relative">
            <div className="pointer-events-none absolute left-4 top-4 z-20 hidden items-center gap-2 rounded-xl border bg-background/90 px-3 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur sm:flex"><Hand className="h-3.5 w-3.5" />Desplazate con el trackpad o las barras · arrastrá para mover</div>
            <div ref={viewportRef} className={cn('h-[560px] overflow-auto bg-muted/35 sm:h-[650px] xl:h-[720px]', modo === 'place' && 'cursor-crosshair')} onWheel={(event) => { if (event.ctrlKey || event.metaKey) { event.preventDefault(); cambiarZoom(zoom + (event.deltaY < 0 ? 0.1 : -0.1)) } }}>
              {cargando ? <div className="grid h-full place-items-center"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Preparando tu salón…</div></div> : <div className="relative m-6" style={{ width: boardWidth * zoom, height: boardHeight * zoom }}>
                <div
                  ref={boardRef}
                  role="application"
                  aria-label="Editor del plano de mesas"
                  onClick={manejarClickPlano}
                  onMouseMove={(event) => setCeldaHover(coordenadasCelda(event.clientX, event.clientY))}
                  onMouseLeave={() => setCeldaHover(null)}
                  className="absolute left-0 top-0 overflow-hidden rounded-2xl border-2 border-border bg-background shadow-inner"
                  style={{
                    width: boardWidth,
                    height: boardHeight,
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top left',
                    backgroundImage: 'linear-gradient(to right, color-mix(in oklab, var(--border) 70%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--border) 70%, transparent) 1px, transparent 1px)',
                    backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px`,
                    touchAction: 'pan-x pan-y',
                  }}
                >
                  {modo === 'place' && celdaHover && <div className="pointer-events-none absolute rounded-xl border-2 border-dashed border-brand bg-brand/10" style={{ left: Math.max(0, celdaHover.x) * CELL_SIZE + 5, top: Math.max(0, celdaHover.y) * CELL_SIZE + 5, width: CELL_SIZE * 2 - 10, height: CELL_SIZE * 2 - 10 }} />}

                  {mesasVisibles.map((mesa) => {
                    const seleccionadaAhora = mesa.id === seleccionadaId
                    const superpuesta = paresSuperpuestos.has(mesa.id)
                    return <button
                      key={mesa.id}
                      type="button"
                      aria-label={`${mesa.nombre}, ${mesa.capacidad} personas`}
                      onPointerDown={(event) => iniciarDrag(event, mesa)}
                      onPointerMove={moverDrag}
                      onPointerUp={terminarDrag}
                      onPointerCancel={terminarDrag}
                      onClick={(event) => { event.stopPropagation(); if (!clickSuprimido.current) { setSeleccionadaId(mesa.id); setModo('select') } }}
                      className={cn(
                        'group absolute flex cursor-grab touch-none select-none flex-col items-center justify-center overflow-hidden rounded-2xl border-2 bg-card px-2 text-center shadow-[0_4px_14px_rgba(0,0,0,0.08)] transition-[border-color,box-shadow,background-color] active:cursor-grabbing',
                        'hover:border-brand/50 hover:shadow-[0_7px_20px_rgba(0,0,0,0.12)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20',
                        seleccionadaAhora && 'z-10 border-brand bg-orange-50 shadow-[0_8px_24px_rgba(255,122,0,0.18)] dark:bg-orange-950/30',
                        superpuesta && 'border-destructive bg-destructive/10',
                        drag?.mesaId === mesa.id && 'z-20 scale-[1.02] shadow-xl',
                      )}
                      style={{ left: mesa.posicionX * CELL_SIZE + 5, top: mesa.posicionY * CELL_SIZE + 5, width: mesa.ancho * CELL_SIZE - 10, height: mesa.alto * CELL_SIZE - 10 }}
                    >
                      <span className="absolute left-2 top-2 grid h-5 w-5 place-items-center rounded-md bg-muted text-[10px] font-bold text-muted-foreground group-hover:bg-brand/10 group-hover:text-brand"><Grid3X3 className="h-3 w-3" /></span>
                      <Armchair className={cn('mb-1 h-5 w-5 text-brand', mesa.alto >= 3 && 'h-6 w-6')} />
                      <span className="max-w-full truncate text-sm font-semibold">{mesa.nombre}</span>
                      <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Users className="h-3 w-3" />{mesa.capacidad} personas</span>
                      {mesa.estadoManual && mesa.alto >= 3 && <span className="mt-2 max-w-[90%] truncate rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{mesa.estadoManual}</span>}
                    </button>
                  })}

                  {mesasVisibles.length === 0 && <div className="pointer-events-none absolute top-40 w-72 -translate-x-1/2 rounded-2xl border border-dashed bg-card/90 p-6 text-center shadow-sm" style={{ left: 420 }}>
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-brand"><Armchair className="h-6 w-6" /></div>
                    <h3 className="mt-4 font-semibold">Tu salón empieza acá</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Agregá la primera mesa y ubicala como está en tu local.</p>
                  </div>}
                </div>
              </div>}
            </div>
          </div>

          <footer className="flex flex-col gap-2 border-t bg-muted/20 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>Las líneas son puntos de encastre: una mesa siempre queda alineada al soltarla.</span>
            <span className="shrink-0 font-medium">El espacio continúa al desplazarte</span>
          </footer>
        </section>

        <div>
          {seleccionada ? <MesaInspector
            key={seleccionada.id}
            mesa={seleccionada}
            sucursales={sucursales}
            onChange={(patch) => {
              cambiar(seleccionada.id, patch)
              if (patch.sucursalId !== undefined) setSucursalActivaId(patch.sucursalId)
            }}
            onResize={(ancho, alto) => redimensionar(seleccionada, ancho, alto)}
            onDesactivar={() => void desactivar(seleccionada.id)}
          /> : <EmptyInspector onPlace={activarColocacion} />}
          {!seleccionada && mesasVisibles.length > 0 && <div className="mt-4 rounded-2xl bg-muted/50 p-4 text-xs leading-relaxed text-muted-foreground"><strong className="text-foreground">Tip:</strong> si sólo querés sumar rápido una mesa, podés usar “Agregar mesa” y elegir su lugar directamente en el plano.</div>}
        </div>
      </div>
    </div>
  </TooltipProvider>
}
