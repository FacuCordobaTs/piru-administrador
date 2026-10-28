import { useEffect, useMemo, useState } from 'react'
import { Check, Loader2, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { stockApi, type ConsumoStock, type InsumoStock, type ProductoStock } from '@/lib/api'
import { datosUnidad, formatearStock } from '@/lib/stock'
import { cn } from '@/lib/utils'

interface Props {
  token: string | null
  producto: ProductoStock
  insumos: InsumoStock[]
  onGuardado: () => void | Promise<void>
}

type Contexto = { key: string; etiqueta: string; varianteId: number | null; grupo: number | null; ayuda: string }

function contextosDe(producto: ProductoStock): Contexto[] {
  const base: Contexto = {
    key: 'base',
    etiqueta: 'Receta base',
    varianteId: null,
    grupo: null,
    ayuda: 'Se descuenta en todas las ventas del producto.',
  }
  const primarias = producto.variantes
    .filter((variante) => Number(variante.grupo) === 1)
    .map((variante) => ({
      key: `v:${variante.id}`,
      etiqueta: variante.nombre,
      varianteId: variante.id,
      grupo: 1,
      ayuda: `Se suma sólo cuando eligen “${variante.nombre}”. La receta base sigue aplicando.`,
    }))
  const secundarias = producto.variantes
    .filter((variante) => Number(variante.grupo) === 2)
    .map((variante) => ({
      key: `v:${variante.id}`,
      etiqueta: variante.nombre,
      varianteId: variante.id,
      grupo: 2,
      ayuda: `Se suma sólo cuando eligen “${variante.nombre}” en la segunda elección.`,
    }))
  return [base, ...primarias, ...secundarias]
}

function claveDraft(varianteId: number | null, insumoId: number) {
  // `|` separa contexto de insumo: la variante ya usa `v:<id>`.
  return `${varianteId == null ? 'base' : `v:${varianteId}`}|${insumoId}`
}

export function StockConsumoEditor({ token, producto, insumos, onGuardado }: Props) {
  const contextos = useMemo(() => contextosDe(producto), [producto])
  const [contextoKey, setContextoKey] = useState('base')
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [nuevoInsumoId, setNuevoInsumoId] = useState('')
  const [nuevaCantidad, setNuevaCantidad] = useState('1')
  const [guardando, setGuardando] = useState(false)
  const [dirty, setDirty] = useState(false)

  const contexto = contextos.find((item) => item.key === contextoKey) ?? contextos[0]
  const claveSerializada = JSON.stringify(producto.consumos)

  useEffect(() => {
    const siguiente: Record<string, string> = {}
    for (const consumo of producto.consumos) {
      siguiente[claveDraft(consumo.varianteId, consumo.insumoId)] = String(consumo.cantidad)
    }
    setDraft(siguiente)
    setDirty(false)
  }, [producto.id, producto.consumos, claveSerializada])

  useEffect(() => {
    if (!contextos.some((item) => item.key === contextoKey)) setContextoKey('base')
  }, [contextos, contextoKey])

  const insumoPorId = useMemo(() => new Map(insumos.map((insumo) => [insumo.id, insumo])), [insumos])
  const insumosActivos = useMemo(() => insumos.filter((insumo) => insumo.activo), [insumos])

  const filas = useMemo(() => {
    return Object.entries(draft)
      .filter(([clave]) => {
        const [prefijo] = clave.split('|')
        const esperado = contexto.varianteId == null ? 'base' : `v:${contexto.varianteId}`
        return prefijo === esperado
      })
      .map(([clave, cantidad]) => {
        const insumoId = Number(clave.split('|')[1])
        return { clave, insumoId, cantidad, insumo: insumoPorId.get(insumoId) }
      })
      .filter((fila) => fila.insumo)
      .sort((a, b) => (a.insumo?.nombre ?? '').localeCompare(b.insumo?.nombre ?? ''))
  }, [draft, contexto, insumoPorId])

  const yaConfigurados = new Set(filas.map((fila) => fila.insumoId))
  const disponibles = insumosActivos.filter((insumo) => !yaConfigurados.has(insumo.id))

  const cambiarCantidad = (clave: string, valor: string) => {
    setDraft((actual) => ({ ...actual, [clave]: valor }))
    setDirty(true)
  }

  const quitarFila = (clave: string) => {
    setDraft((actual) => {
      const siguiente = { ...actual }
      delete siguiente[clave]
      return siguiente
    })
    setDirty(true)
  }

  const agregarInsumo = () => {
    const insumoId = Number(nuevoInsumoId)
    const cantidad = Number(nuevaCantidad.replace(',', '.'))
    if (!insumoId || !Number.isFinite(cantidad) || cantidad <= 0) {
      toast.error('Elegí un insumo y una cantidad mayor a 0')
      return
    }
    setDraft((actual) => ({
      ...actual,
      [claveDraft(contexto.varianteId, insumoId)]: String(cantidad),
    }))
    setDirty(true)
    setNuevoInsumoId('')
    setNuevaCantidad('1')
  }

  const cancelar = () => {
    const siguiente: Record<string, string> = {}
    for (const consumo of producto.consumos) {
      siguiente[claveDraft(consumo.varianteId, consumo.insumoId)] = String(consumo.cantidad)
    }
    setDraft(siguiente)
    setDirty(false)
    setNuevoInsumoId('')
    setNuevaCantidad('1')
  }

  const guardar = async () => {
    if (!token || guardando) return
    const consumos: ConsumoStock[] = []
    for (const [clave, cantidad] of Object.entries(draft)) {
      const valor = Number(cantidad.replace(',', '.'))
      if (!Number.isFinite(valor) || valor <= 0) continue
      const [prefijo, insumoIdTexto] = clave.split('|')
      const insumoId = Number(insumoIdTexto)
      if (!insumoId) continue
      consumos.push({
        insumoId,
        varianteId: prefijo === 'base' ? null : Number(prefijo.replace('v:', '')),
        cantidad: valor,
      })
    }
    setGuardando(true)
    try {
      await stockApi.guardarConsumos(token, producto.id, consumos)
      toast.success('Consumo guardado', {
        description: consumos.length === 0
          ? 'El producto ya no descuenta insumos.'
          : `${producto.nombre} descuenta insumos en sus próximas ventas.`,
      })
      await onGuardado()
      setDirty(false)
    } catch (error) {
      toast.error('No se pudo guardar el consumo', {
        description: error instanceof Error ? error.message : 'Intentá de nuevo.',
      })
    } finally {
      setGuardando(false)
    }
  }

  const insumoNuevo = insumoPorId.get(Number(nuevoInsumoId))

  return (
    <div className="border-t border-zinc-200 bg-zinc-50/70 px-4 py-5 dark:border-zinc-800 dark:bg-zinc-900/40 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-foreground">Insumos que consume</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Lo que cargues en la receta base y en cada variante se descuenta al vender.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <button type="button" onClick={cancelar} className="text-xs font-medium text-muted-foreground hover:text-foreground">
              Descartar
            </button>
          )}
          <Button
            onClick={() => void guardar()}
            disabled={!dirty || guardando}
            className="h-9 rounded-xl bg-[#FF7A00] px-4 text-xs font-bold text-white hover:bg-[#E66E00]"
          >
            {guardando ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
            Guardar consumo
          </Button>
        </div>
      </div>

      <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {contextos.map((item) => {
          const prefijo = item.varianteId == null ? 'base' : `v:${item.varianteId}`
          const cantidadInsumos = Object.entries(draft)
            .filter(([clave, cantidad]) => clave.startsWith(`${prefijo}|`) && Number(cantidad.replace(',', '.')) > 0)
            .length
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setContextoKey(item.key)}
              className={cn(
                'shrink-0 rounded-xl border px-3 py-2 text-left transition-colors',
                contextoKey === item.key
                  ? 'border-[#FF7A00] bg-[#FF7A00]/10 text-foreground'
                  : 'border-zinc-200 bg-white text-muted-foreground hover:border-zinc-300 hover:text-foreground dark:border-zinc-800 dark:bg-zinc-900',
              )}
            >
              <span className="flex items-center gap-1.5 text-xs font-bold">
                {item.etiqueta}
                {item.grupo === 2 && <span className="rounded bg-violet-500/10 px-1 py-0.5 text-[9px] font-bold text-violet-600 dark:text-violet-400">2ª</span>}
              </span>
              <span className="mt-0.5 block text-[10px] opacity-70">
                {cantidadInsumos === 0 ? 'Sin consumos' : `${cantidadInsumos} insumo${cantidadInsumos !== 1 ? 's' : ''}`}
              </span>
            </button>
          )
        })}
      </div>

      <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs text-muted-foreground dark:bg-zinc-900/70">{contexto.ayuda}</p>

      <div className="mt-3 space-y-2">
        {filas.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 px-3 py-5 text-center text-xs text-muted-foreground dark:border-zinc-700">
            {contexto.varianteId == null
              ? 'Este producto todavía no descuenta insumos.'
              : 'Esta variante no suma consumos extra.'}
          </p>
        ) : (
          filas.map((fila) => {
            const insumo = fila.insumo!
            return (
              <div key={fila.clave} className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{insumo.nombre}</p>
                  <p className="text-[10px] text-muted-foreground">Hay {formatearStock(insumo.stockActual, insumo.unidad)}</p>
                </div>
                <div className="relative w-28">
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    value={fila.cantidad}
                    onChange={(event) => cambiarCantidad(fila.clave, event.target.value)}
                    className="h-9 rounded-lg pr-9 text-right text-sm"
                  />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-muted-foreground">
                    {datosUnidad(insumo.unidad).corta}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => quitarFila(fila.clave)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/20"
                  aria-label={`Quitar ${insumo.nombre}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )
          })
        )}
      </div>

      {disponibles.length > 0 ? (
        <div className="mt-3 grid gap-2 rounded-xl border border-dashed border-zinc-300 p-2.5 dark:border-zinc-700 sm:grid-cols-[minmax(0,1fr)_110px_auto] sm:items-center">
          <Select value={nuevoInsumoId || undefined} onValueChange={setNuevoInsumoId}>
            <SelectTrigger className="h-9 w-full rounded-lg text-xs">
              <SelectValue placeholder="Agregar insumo..." />
            </SelectTrigger>
            <SelectContent>
              {disponibles.map((insumo) => (
                <SelectItem key={insumo.id} value={String(insumo.id)}>
                  {insumo.nombre} · queda {formatearStock(insumo.stockActual, insumo.unidad)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative">
            <Input
              type="number"
              step="0.001"
              min="0"
              value={nuevaCantidad}
              onChange={(event) => setNuevaCantidad(event.target.value)}
              className="h-9 rounded-lg pr-9 text-right text-xs"
              aria-label="Cantidad que consume"
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-muted-foreground">
              {insumoNuevo ? datosUnidad(insumoNuevo.unidad).corta : 'u'}
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={agregarInsumo}
            disabled={!nuevoInsumoId}
            className="h-9 rounded-lg px-3 text-xs font-bold"
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Agregar
          </Button>
        </div>
      ) : insumosActivos.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">Creá un insumo en la sección de arriba para empezar.</p>
      ) : null}
    </div>
  )
}
