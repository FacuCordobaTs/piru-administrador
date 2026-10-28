import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { stockApi, type ActualizarInsumoPayload, type CrearInsumoPayload, type InsumoStock, type UnidadStock } from '@/lib/api'
import { UNIDADES_STOCK, datosUnidad, formatearStock } from '@/lib/stock'
import { cn } from '@/lib/utils'

const inputClass = 'h-11 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 focus:border-[#FF7A00] focus:ring-2 focus:ring-[#FF7A00]/20'
const labelClass = 'text-xs font-semibold text-muted-foreground uppercase tracking-wide'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  token: string | null
  insumo?: InsumoStock | null
  onGuardado: () => void | Promise<void>
}

export function StockInsumoDialog({ open, onOpenChange, token, insumo, onGuardado }: Props) {
  const esEdicion = Boolean(insumo)
  const [nombre, setNombre] = useState('')
  const [unidad, setUnidad] = useState<UnidadStock>('unidad')
  const [stock, setStock] = useState('0')
  const [stockMinimo, setStockMinimo] = useState('')
  const [activo, setActivo] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false)

  useEffect(() => {
    if (!open) return
    setNombre(insumo?.nombre ?? '')
    setUnidad(insumo?.unidad ?? 'unidad')
    setStock(insumo ? String(insumo.stockActual) : '0')
    setStockMinimo(insumo?.stockMinimo != null ? String(insumo.stockMinimo) : '')
    setActivo(insumo?.activo ?? true)
    setConfirmandoEliminar(false)
    setGuardando(false)
    setEliminando(false)
  }, [open, insumo])

  const guardar = async () => {
    if (!token || guardando) return
    if (!nombre.trim()) {
      toast.error('Poné un nombre para el insumo')
      return
    }
    const stockNumero = Number(stock.replace(',', '.'))
    if (!Number.isFinite(stockNumero)) {
      toast.error('El stock debe ser un número válido')
      return
    }
    const minimoNumero = stockMinimo.trim() === '' ? null : Number(stockMinimo.replace(',', '.'))
    if (minimoNumero != null && (!Number.isFinite(minimoNumero) || minimoNumero < 0)) {
      toast.error('El mínimo de alerta debe ser un número mayor o igual a 0')
      return
    }

    setGuardando(true)
    try {
      if (esEdicion && insumo) {
        const payload: ActualizarInsumoPayload = {
          nombre: nombre.trim(),
          unidad,
          stockActual: stockNumero,
          stockMinimo: minimoNumero,
          activo,
        }
        await stockApi.actualizarInsumo(token, insumo.id, payload)
        toast.success('Insumo actualizado')
      } else {
        const payload: CrearInsumoPayload = {
          nombre: nombre.trim(),
          unidad,
          stockInicial: stockNumero,
          stockMinimo: minimoNumero,
        }
        await stockApi.crearInsumo(token, payload)
        toast.success('Insumo creado')
      }
      await onGuardado()
      onOpenChange(false)
    } catch (error) {
      toast.error(esEdicion ? 'No se pudo actualizar el insumo' : 'No se pudo crear el insumo', {
        description: error instanceof Error ? error.message : 'Intentá de nuevo.',
      })
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async () => {
    if (!token || !insumo || eliminando) return
    setEliminando(true)
    try {
      await stockApi.eliminarInsumo(token, insumo.id)
      toast.success('Insumo eliminado')
      await onGuardado()
      onOpenChange(false)
    } catch (error) {
      toast.error('No se pudo eliminar el insumo', {
        description: error instanceof Error ? error.message : 'Intentá de nuevo.',
      })
      setConfirmandoEliminar(false)
    } finally {
      setEliminando(false)
    }
  }

  const unidadDatos = datosUnidad(unidad)
  const ayudaMinimo = stockMinimo.trim() === ''
    ? 'Si lo dejás vacío, avisamos cuando quede el 20% de la mayor compra o de la carga inicial.'
    : `Vas a recibir la alerta cuando queden ${formatearStock(minimoNumeroValido(stockMinimo), unidad)} o menos.`

  return (
    <Dialog open={open} onOpenChange={(value) => !guardando && !eliminando && onOpenChange(value)}>
      <DialogContent className="max-w-md rounded-[28px] border-zinc-200 p-6 dark:border-zinc-800">
        <DialogHeader className="mb-4 text-left">
          <DialogTitle className="text-xl font-bold">{esEdicion ? 'Editar insumo' : 'Nuevo insumo'}</DialogTitle>
          <DialogDescription>
            {esEdicion ? 'Ajustá existencias, alerta o nombre.' : 'Es la unidad que vas a descontar en cada venta: un medallón, gramos de carne, ml de salsa.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className={labelClass}>Nombre</Label>
            <Input
              autoFocus
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              placeholder="Ej: Medallón de carne, Queso cheddar, Pan brioche"
              className={cn(inputClass, 'mt-1.5')}
              disabled={guardando}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className={labelClass}>Unidad</Label>
              <Select value={unidad} onValueChange={(value) => setUnidad(value as UnidadStock)} disabled={guardando}>
                <SelectTrigger className={cn(inputClass, 'mt-1.5 w-full')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIDADES_STOCK.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className={labelClass}>{esEdicion ? 'Stock actual' : 'Stock inicial'}</Label>
              <div className="relative mt-1.5">
                <Input
                  type="number"
                  step="0.001"
                  value={stock}
                  onChange={(event) => setStock(event.target.value)}
                  className={cn(inputClass, 'pr-10')}
                  disabled={guardando}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                  {unidadDatos.corta}
                </span>
              </div>
            </div>
          </div>

          {esEdicion && insumo && unidad !== insumo.unidad && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/20 dark:text-amber-300">
              Cambiar la unidad no convierte el stock ni las recetas: los números existentes quedan igual.
            </p>
          )}

          <div>
            <Label className={labelClass}>Avisar cuando quede</Label>
            <div className="relative mt-1.5">
              <Input
                type="number"
                step="0.001"
                min="0"
                value={stockMinimo}
                onChange={(event) => setStockMinimo(event.target.value)}
                placeholder="Automático (20%)"
                className={cn(inputClass, 'pr-10')}
                disabled={guardando}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                {unidadDatos.corta}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">{ayudaMinimo}</p>
          </div>

          {esEdicion && (
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
              <div>
                <p className="text-sm font-semibold">Controlar este insumo</p>
                <p className="text-xs text-muted-foreground">Si lo desactivás, deja de descontarse y de avisar, sin borrar su historial.</p>
              </div>
              <Switch checked={activo} onCheckedChange={setActivo} disabled={guardando} />
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <Button
            onClick={() => void guardar()}
            disabled={guardando || !nombre.trim()}
            className="h-12 w-full rounded-xl bg-[#FF7A00] font-bold text-white hover:bg-[#E66E00]"
          >
            {guardando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {esEdicion ? 'Guardar cambios' : 'Crear insumo'}
          </Button>
          {esEdicion && !confirmandoEliminar && (
            <button
              type="button"
              onClick={() => setConfirmandoEliminar(true)}
              disabled={guardando}
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-red-500"
            >
              Eliminar insumo
            </button>
          )}
          {esEdicion && confirmandoEliminar && (
            <div className="flex items-center justify-center gap-3 rounded-xl bg-red-50 px-3 py-2 text-xs dark:bg-red-950/20">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
              <span className="text-red-700 dark:text-red-300">¿Eliminar {insumo?.nombre}?</span>
              <button
                type="button"
                onClick={() => void eliminar()}
                disabled={eliminando}
                className="font-bold text-red-600 hover:text-red-500 disabled:opacity-50"
              >
                {eliminando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sí'}
              </button>
              <button type="button" onClick={() => setConfirmandoEliminar(false)} className="text-muted-foreground">
                No
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function minimoNumeroValido(valor: string): number {
  const numero = Number(valor.replace(',', '.'))
  return Number.isFinite(numero) ? numero : 0
}
