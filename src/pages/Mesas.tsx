import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GripVertical, Plus, Save, SlidersHorizontal, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { mesasLocalesApi, type MesaLocal } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useModuloActivo } from '@/store/modulosStore'
import { useSucursales, type Sucursal } from '@/pages/ajustes/hooks/useSucursales'

const GRID_COLUMNS = 12
const nuevaMesa = (orden: number): Omit<MesaLocal, 'id' | 'restauranteId'> => ({
  sucursalId: null, nombre: `Mesa ${orden + 1}`, posicionX: orden % 4, posicionY: Math.floor(orden / 4), ancho: 2, alto: 2,
  capacidad: 4, estadoManual: null, activo: true, orden,
})

function MesaEditor({ mesa, sucursales, onChange, onDesactivar }: {
  mesa: MesaLocal
  sucursales: Sucursal[]
  onChange: (patch: Partial<MesaLocal>) => void
  onDesactivar: () => void
}) {
  const num = (key: 'capacidad' | 'ancho' | 'alto', value: string, min: number, max: number) =>
    onChange({ [key]: Math.max(min, Math.min(max, Number(value) || min)) })
  return (
    <aside className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">Editar mesa</h2><p className="mt-1 text-sm text-muted-foreground">Los cambios se reflejan en el plano.</p></div><Button variant="ghost" size="icon" onClick={onDesactivar} title="Desactivar mesa"><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
      <div className="mt-5 space-y-4">
        <div><Label htmlFor="mesa-nombre">Nombre</Label><Input id="mesa-nombre" className="mt-1.5" value={mesa.nombre} onChange={(e) => onChange({ nombre: e.target.value })} /></div>
        <div><Label htmlFor="mesa-sucursal">Sucursal</Label><select id="mesa-sucursal" className="mt-1.5 h-9 w-full rounded-md border bg-background px-3 text-sm" value={mesa.sucursalId ?? ''} onChange={(e) => onChange({ sucursalId: e.target.value ? Number(e.target.value) : null })}><option value="">Todas / sin asignar</option>{sucursales.filter((s) => s.activo).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></div>
        <div className="grid grid-cols-3 gap-3"><div><Label>Capacidad</Label><Input className="mt-1.5" type="number" min={1} max={100} value={mesa.capacidad} onChange={(e) => num('capacidad', e.target.value, 1, 100)} /></div><div><Label>Ancho</Label><Input className="mt-1.5" type="number" min={1} max={12} value={mesa.ancho} onChange={(e) => num('ancho', e.target.value, 1, 12)} /></div><div><Label>Alto</Label><Input className="mt-1.5" type="number" min={1} max={12} value={mesa.alto} onChange={(e) => num('alto', e.target.value, 1, 12)} /></div></div>
        <div><Label htmlFor="mesa-estado">Marca manual (opcional)</Label><Input id="mesa-estado" className="mt-1.5" value={mesa.estadoManual ?? ''} placeholder="Ej.: reservada" onChange={(e) => onChange({ estadoManual: e.target.value.trim() || null })} /></div>
      </div>
    </aside>
  )
}

export default function Mesas() {
  const token = useAuthStore((state) => state.token)
  const mesasActivo = useModuloActivo('mesas')
  const { sucursales } = useSucursales()
  const [mesas, setMesas] = useState<MesaLocal[]>([])
  const [seleccionadaId, setSeleccionadaId] = useState<number | null>(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)

  const cargar = useCallback(async () => {
    if (!token || !mesasActivo) { setCargando(false); return }
    setCargando(true)
    try { setMesas((await mesasLocalesApi.list(token)).data) } catch (error) { toast.error(error instanceof Error ? error.message : 'No pudimos cargar las mesas') } finally { setCargando(false) }
  }, [mesasActivo, token])
  useEffect(() => { void cargar() }, [cargar])
  const seleccionada = useMemo(() => mesas.find((mesa) => mesa.id === seleccionadaId) ?? null, [mesas, seleccionadaId])

  const cambiar = (id: number, patch: Partial<MesaLocal>) => setMesas((actual) => actual.map((mesa) => {
    if (mesa.id !== id) return mesa
    const siguiente = { ...mesa, ...patch }
    return { ...siguiente, posicionX: Math.max(0, Math.min(GRID_COLUMNS - siguiente.ancho, siguiente.posicionX)), posicionY: Math.max(0, Math.min(24 - siguiente.alto, siguiente.posicionY)) }
  }))
  const crear = async () => {
    if (!token) return
    try { const mesa = (await mesasLocalesApi.create(token, nuevaMesa(mesas.length))).data; setMesas((actual) => [...actual, mesa]); setSeleccionadaId(mesa.id) } catch (error) { toast.error(error instanceof Error ? error.message : 'No pudimos crear la mesa') }
  }
  const guardar = async () => {
    if (!token) return
    setGuardando(true)
    try {
      await Promise.all(mesas.map((mesa) => mesasLocalesApi.update(token, mesa.id, { nombre: mesa.nombre.trim(), sucursalId: mesa.sucursalId, capacidad: mesa.capacidad, estadoManual: mesa.estadoManual, activo: mesa.activo })))
      await mesasLocalesApi.guardarLayout(token, mesas.map(({ id, posicionX, posicionY, ancho, alto, orden }) => ({ id, posicionX, posicionY, ancho, alto, orden })))
      toast.success('Plano de mesas guardado')
      void cargar()
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No pudimos guardar el plano') } finally { setGuardando(false) }
  }
  const desactivar = async (id: number) => {
    if (!token || !confirm('¿Desactivar esta mesa? Se conserva su historial.')) return
    try { await mesasLocalesApi.desactivar(token, id); setMesas((actual) => actual.filter((mesa) => mesa.id !== id)); setSeleccionadaId(null); toast.success('Mesa desactivada') } catch (error) { toast.error(error instanceof Error ? error.message : 'No pudimos desactivar la mesa') }
  }
  const mover = (event: React.PointerEvent<HTMLButtonElement>, mesa: MesaLocal) => {
    const grid = gridRef.current
    if (!grid) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const alSoltar = (up: PointerEvent) => {
      const bounds = grid.getBoundingClientRect()
      const x = Math.max(0, Math.min(GRID_COLUMNS - mesa.ancho, Math.floor(((up.clientX - bounds.left) / bounds.width) * GRID_COLUMNS)))
      const y = Math.max(0, Math.min(24 - mesa.alto, Math.floor(((up.clientY - bounds.top) / 56))))
      cambiar(mesa.id, { posicionX: x, posicionY: y })
      window.removeEventListener('pointerup', alSoltar)
    }
    window.addEventListener('pointerup', alSoltar)
  }

  if (!mesasActivo) return <div className="mx-auto max-w-3xl px-4 py-10"><h1 className="text-2xl font-semibold">Mesas</h1><p className="mt-2 text-muted-foreground">Activá el módulo Mesas desde Módulos para configurar el plano de tu local.</p></div>
  return <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-9">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-medium text-brand">Configuración</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Mesas</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Armá el plano de tu local. Arrastrá una mesa para moverla, ajustá su tamaño y guardá cuando termines.</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => void crear()}><Plus className="mr-2 h-4 w-4" />Nueva mesa</Button><Button disabled={guardando || cargando} onClick={() => void guardar()}><Save className="mr-2 h-4 w-4" />{guardando ? 'Guardando…' : 'Guardar plano'}</Button></div></div>
    <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-2xl border bg-card p-4 shadow-sm"><div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground"><SlidersHorizontal className="h-4 w-4" />Grid de 12 columnas · el estado operativo se mostrará en el Dashboard.</div>{cargando ? <div className="h-96 animate-pulse rounded-xl bg-muted" /> : <div ref={gridRef} className="relative grid min-h-[560px] grid-cols-12 grid-rows-[repeat(10,56px)] gap-2 rounded-xl bg-muted/60 p-2" style={{ gridAutoRows: '56px' }}>{mesas.map((mesa) => <button key={mesa.id} type="button" onClick={() => setSeleccionadaId(mesa.id)} onPointerDown={(event) => mover(event, mesa)} className={`group relative flex min-h-0 flex-col justify-between rounded-xl border p-2 text-left shadow-sm transition ${seleccionadaId === mesa.id ? 'border-brand bg-brand/10 ring-2 ring-brand/25' : 'border-border bg-background hover:border-brand/50'}`} style={{ gridColumn: `${mesa.posicionX + 1} / span ${Math.min(mesa.ancho, GRID_COLUMNS - mesa.posicionX)}`, gridRow: `${mesa.posicionY + 1} / span ${mesa.alto}` }}><span className="truncate text-sm font-semibold">{mesa.nombre}</span><span className="text-xs text-muted-foreground">{mesa.capacidad} pers.</span><GripVertical className="absolute bottom-1 right-1 h-4 w-4 text-muted-foreground/50" /></button>)}{mesas.length === 0 && <div className="col-span-12 flex items-center justify-center text-sm text-muted-foreground">Todavía no hay mesas. Creá la primera para empezar.</div>}</div>}</section>
      {seleccionada ? <MesaEditor mesa={seleccionada} sucursales={sucursales} onChange={(patch) => cambiar(seleccionada.id, patch)} onDesactivar={() => void desactivar(seleccionada.id)} /> : <aside className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">Seleccioná una mesa del plano para editar su nombre, sucursal, capacidad o tamaño.</aside>}
    </div>
  </div>
}
