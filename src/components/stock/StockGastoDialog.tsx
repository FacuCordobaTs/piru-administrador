import { useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Receipt, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { stockApi, type InsumoStock } from '@/lib/api'
import { datosUnidad, fechaParaInput, formatearCantidad, formatearPrecio } from '@/lib/stock'
import { cn } from '@/lib/utils'

const inputClass = 'h-10 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 focus:border-[#FF7A00] focus:ring-2 focus:ring-[#FF7A00]/20'
const labelClass = 'text-xs font-semibold text-muted-foreground uppercase tracking-wide'

interface Linea {
  key: string
  insumoId: string
  cantidad: string
  costoUnitario: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  token: string | null
  insumos: InsumoStock[]
  onGuardado: () => void | Promise<void>
}

let lineasSeq = 0
const nuevaLinea = (insumoId = ''): Linea => ({
  key: `linea-${++lineasSeq}`,
  insumoId,
  cantidad: '',
  costoUnitario: '',
})

export function StockGastoDialog({ open, onOpenChange, token, insumos, onGuardado }: Props) {
  const activos = useMemo(() => insumos.filter((insumo) => insumo.activo), [insumos])
  const [descripcion, setDescripcion] = useState('Compra de insumos')
  const [proveedor, setProveedor] = useState('')
  const [fecha, setFecha] = useState(fechaParaInput())
  const [lineas, setLineas] = useState<Linea[]>([nuevaLinea()])
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!open) return
    setDescripcion('Compra de insumos')
    setProveedor('')
    setFecha(fechaParaInput())
    setLineas([nuevaLinea(String(activos[0]?.id ?? ''))])
    setGuardando(false)
  }, [open, activos])

  const insumoPorId = useMemo(() => new Map(activos.map((insumo) => [insumo.id, insumo])), [activos])

  const total = lineas.reduce((suma, linea) => {
    const cantidad = Number(linea.cantidad.replace(',', '.'))
    const costo = Number(linea.costoUnitario.replace(',', '.'))
    if (!Number.isFinite(cantidad) || !Number.isFinite(costo)) return suma
    return suma + cantidad * costo
  }, 0)

  const actualizarLinea = (key: string, cambios: Partial<Linea>) => {
    setLineas((actuales) => actuales.map((linea) => linea.key === key ? { ...linea, ...cambios } : linea))
  }

  const guardar = async () => {
    if (!token || guardando) return
    if (!descripcion.trim()) {
      toast.error('Indicá qué compra estás cargando')
      return
    }
    const items = lineas
      .map((linea) => ({
        insumoId: Number(linea.insumoId),
        cantidad: Number(linea.cantidad.replace(',', '.')),
        costoUnitario: Number((linea.costoUnitario || '0').replace(',', '.')),
      }))
      .filter((item) => item.insumoId > 0 && Number.isFinite(item.cantidad) && item.cantidad > 0)
    if (items.length === 0) {
      toast.error('Agregá al menos un insumo con cantidad')
      return
    }
    const invalido = lineas.some((linea) => {
      // Una línea en blanco se ignora; si hay cantidad, el insumo es obligatorio.
      if (linea.cantidad.trim() === '') return false
      const cantidad = Number(linea.cantidad.replace(',', '.'))
      const costo = Number((linea.costoUnitario || '0').replace(',', '.'))
      if (!linea.insumoId) return true
      return !Number.isFinite(cantidad) || cantidad <= 0 || !Number.isFinite(costo) || costo < 0
    })
    if (invalido) {
      toast.error('Revisá las cantidades de cada línea')
      return
    }

    setGuardando(true)
    try {
      const resultado = await stockApi.cargarGasto(token, {
        descripcion: descripcion.trim(),
        proveedor: proveedor.trim() || null,
        fecha: fecha ? `${fecha}T12:00:00` : null,
        items,
      })
      toast.success('Gasto cargado', {
        description: `Se sumaron los insumos por ${formatearPrecio(resultado.data.total)}.`,
      })
      await onGuardado()
      onOpenChange(false)
    } catch (error) {
      toast.error('No se pudo cargar el gasto', {
        description: error instanceof Error ? error.message : 'Intentá de nuevo.',
      })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !guardando && onOpenChange(value)}>
      <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto rounded-[28px] border-zinc-200 p-6 dark:border-zinc-800">
        <DialogHeader className="mb-4 text-left">
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500/10">
            <Receipt className="h-5 w-5 text-[#FF7A00]" />
          </div>
          <DialogTitle className="text-xl font-bold">Cargar gasto</DialogTitle>
          <DialogDescription>
            Registrá una compra de insumos. Las cantidades se suman al stock y quedan en el historial de compras.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className={labelClass}>Descripción</Label>
              <Input
                autoFocus
                value={descripcion}
                onChange={(event) => setDescripcion(event.target.value)}
                placeholder="Ej: Compra del proveedor"
                className={cn(inputClass, 'mt-1.5')}
                disabled={guardando}
              />
            </div>
            <div>
              <Label className={labelClass}>Proveedor (opcional)</Label>
              <Input
                value={proveedor}
                onChange={(event) => setProveedor(event.target.value)}
                placeholder="Ej: Distribuidora Norte"
                className={cn(inputClass, 'mt-1.5')}
                disabled={guardando}
              />
            </div>
            <div>
              <Label className={labelClass}>Fecha</Label>
              <Input
                type="date"
                value={fecha}
                onChange={(event) => setFecha(event.target.value)}
                className={cn(inputClass, 'mt-1.5')}
                disabled={guardando}
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className={labelClass}>Insumos comprados</Label>
              <span className="text-xs text-muted-foreground">{lineas.length} línea{lineas.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-2">
              {lineas.map((linea) => {
                const insumo = insumoPorId.get(Number(linea.insumoId))
                const cantidad = Number(linea.cantidad.replace(',', '.'))
                const costo = Number(linea.costoUnitario.replace(',', '.'))
                const subtotal = Number.isFinite(cantidad) && Number.isFinite(costo) ? cantidad * costo : 0
                return (
                  <div
                    key={linea.key}
                    className="grid gap-2 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/40 sm:grid-cols-[minmax(0,1fr)_110px_125px_90px_32px] sm:items-end"
                  >
                    <div>
                      <Label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:sr-only">Insumo</Label>
                      <Select
                        value={linea.insumoId || undefined}
                        onValueChange={(value) => {
                          const elegido = insumoPorId.get(Number(value))
                          actualizarLinea(linea.key, {
                            insumoId: value,
                            // Sugerir el último costo conocido si todavía no cargó uno.
                            ...(linea.costoUnitario.trim() === '' && elegido?.costoUltimo != null
                              ? { costoUnitario: String(elegido.costoUltimo) }
                              : {}),
                          })
                        }}
                        disabled={guardando}
                      >
                        <SelectTrigger className={cn(inputClass, 'w-full text-sm')}>
                          <SelectValue placeholder="Elegí un insumo" />
                        </SelectTrigger>
                        <SelectContent>
                          {activos.map((item) => (
                            <SelectItem key={item.id} value={String(item.id)}>{item.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:sr-only">
                        Cantidad {insumo ? `(${datosUnidad(insumo.unidad).corta})` : ''}
                      </Label>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          value={linea.cantidad}
                          onChange={(event) => actualizarLinea(linea.key, { cantidad: event.target.value })}
                          placeholder="0"
                          className={cn(inputClass, 'pr-9')}
                          disabled={guardando}
                        />
                        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-muted-foreground">
                          {insumo ? datosUnidad(insumo.unidad).corta : 'u'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <Label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:sr-only">Costo unitario</Label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={linea.costoUnitario}
                          onChange={(event) => actualizarLinea(linea.key, { costoUnitario: event.target.value })}
                          placeholder="0,00"
                          className={cn(inputClass, 'pl-6')}
                          disabled={guardando}
                        />
                      </div>
                    </div>
                    <div className="text-right text-sm font-semibold tabular-nums text-foreground sm:pb-2.5">
                      {formatearPrecio(subtotal)}
                    </div>
                    <button
                      type="button"
                      onClick={() => setLineas((actuales) => actuales.length <= 1 ? actuales : actuales.filter((item) => item.key !== linea.key))}
                      disabled={guardando || lineas.length <= 1}
                      className="mx-auto grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-30 dark:hover:bg-red-950/20"
                      aria-label="Quitar línea"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )
              })}
            </div>
            <button
              type="button"
              onClick={() => setLineas((actuales) => [...actuales, nuevaLinea()])}
              disabled={guardando}
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-[#FF7A00] transition-colors hover:text-orange-400 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Agregar insumo
            </button>
          </div>

          {activos.length === 0 && (
            <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-950/20 dark:text-amber-300">
              Primero creá al menos un insumo para poder cargar una compra.
            </p>
          )}

          <div className="flex items-center justify-between rounded-2xl bg-muted/40 px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total de la compra</p>
              <p className="text-[11px] text-muted-foreground">
                {lineas
                  .filter((linea) => Number(linea.cantidad) > 0)
                  .map((linea) => {
                    const insumo = insumoPorId.get(Number(linea.insumoId))
                    return insumo ? `${formatearCantidad(linea.cantidad)} ${datosUnidad(insumo.unidad).corta}` : null
                  })
                  .filter(Boolean)
                  .join(' · ') || 'Sin cantidades cargadas'}
              </p>
            </div>
            <p className="text-2xl font-black tabular-nums text-foreground">{formatearPrecio(total)}</p>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={guardando}
            className="h-12 flex-1 rounded-xl font-semibold"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => void guardar()}
            disabled={guardando || activos.length === 0}
            className="h-12 flex-[2] rounded-xl bg-[#FF7A00] font-bold text-white hover:bg-[#E66E00]"
          >
            {guardando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Cargar gasto
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
