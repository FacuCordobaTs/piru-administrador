import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/store/authStore'
import { productosApi } from '@/lib/api'
import { toast } from 'sonner'
import { Check, Gift, Loader2, Package, Search, Settings2 } from 'lucide-react'
import { PuntosConfigEditor } from '../ajustes/sections/PuntosConfigEditor'

interface ProductoConPuntos {
  id: number
  nombre: string
  activo?: boolean
  puntosGanados?: number | null
  puntosNecesarios?: number | null
}

type BloqueConfig = 'beneficios' | 'productos'

/**
 * Configuración completa del Club de Puntos: reglas de acumulación, beneficios
 * de canje y costo/otorgamiento de puntos por producto. Es la versión
 * operativa de lo que antes vivía repartido entre Ajustes > Retención y
 * Menú > Productos.
 */
export function ConfiguracionPuntosDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}) {
  const [bloque, setBloque] = useState<BloqueConfig>('beneficios')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl flex flex-col gap-0 overflow-hidden p-0 rounded-3xl">
        <DialogHeader className="shrink-0 border-b border-border/50 p-6 pb-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            <Settings2 className="h-4 w-4" />
            <span>Club de Puntos</span>
          </div>
          <DialogTitle className="mt-1 text-xl font-bold">Configuración</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Definí cómo ganan puntos tus clientes, qué beneficios pueden canjear y cuánto cuesta cada producto.
          </DialogDescription>
          <div className="mt-2 flex rounded-xl bg-muted/60 p-1">
            <TabConfig activo={bloque === 'beneficios'} onClick={() => setBloque('beneficios')}>
              <Gift className="h-3.5 w-3.5" /> Beneficios y costos
            </TabConfig>
            <TabConfig activo={bloque === 'productos'} onClick={() => setBloque('productos')}>
              <Package className="h-3.5 w-3.5" /> Productos
            </TabConfig>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {bloque === 'beneficios' ? <PuntosConfigEditor onSaved={onSaved} /> : <ProductosPuntosEditor onSaved={onSaved} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TabConfig({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition-colors ${
        activo ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * Puntos por producto: cuánto otorga una compra y cuánto cuesta canjearlo.
 * Se guarda por producto, con los campos completos: el backend crea la fila de
 * `producto_puntos` con lo que reciba, así que mandar sólo uno de los dos
 * valores pondría el otro en cero.
 */
function ProductosPuntosEditor({ onSaved }: { onSaved?: () => void }) {
  const token = useAuthStore((s) => s.token)
  const [productos, setProductos] = useState<ProductoConPuntos[]>([])
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [borradores, setBorradores] = useState<Record<number, { ganados: string; necesarios: string }>>({})

  useEffect(() => {
    if (!token) return
    let vigente = true
    setLoading(true)
    ;(async () => {
      try {
        const res = await productosApi.getAll(token) as { productos?: ProductoConPuntos[] }
        if (vigente) setProductos(res.productos ?? [])
      } catch {
        toast.error('No se pudieron cargar los productos.')
      } finally {
        if (vigente) setLoading(false)
      }
    })()
    return () => { vigente = false }
  }, [token])

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return productos
    return productos.filter((producto) => producto.nombre.toLowerCase().includes(q))
  }, [productos, query])

  const valorActual = (producto: ProductoConPuntos, campo: 'ganados' | 'necesarios') =>
    String((campo === 'ganados' ? producto.puntosGanados : producto.puntosNecesarios) ?? 0)

  const estaSucio = (producto: ProductoConPuntos) => {
    const borrador = borradores[producto.id]
    if (!borrador) return false
    return borrador.ganados !== valorActual(producto, 'ganados') || borrador.necesarios !== valorActual(producto, 'necesarios')
  }

  const guardar = async (producto: ProductoConPuntos) => {
    if (!token) return
    const borrador = borradores[producto.id]
    if (!borrador) return
    const ganados = Math.max(0, parseInt(borrador.ganados, 10) || 0)
    const necesarios = Math.max(0, parseInt(borrador.necesarios, 10) || 0)
    setGuardando(producto.id)
    try {
      const res = await productosApi.update(token, { id: producto.id, puntosGanados: ganados, puntosNecesarios: necesarios })
      if (res && (res as { success?: boolean }).success === false) {
        toast.error((res as { message?: string }).message || 'No se pudieron guardar los puntos del producto.')
        return
      }
      setProductos((prev) => prev.map((item) => (item.id === producto.id ? { ...item, puntosGanados: ganados, puntosNecesarios: necesarios } : item)))
      setBorradores((prev) => {
        const siguiente = { ...prev }
        delete siguiente[producto.id]
        return siguiente
      })
      toast.success(`Puntos de ${producto.nombre} actualizados.`)
      onSaved?.()
    } catch (err) {
      toast.error('No se pudieron guardar los puntos del producto', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setGuardando(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
        <strong className="text-foreground">Puntos que otorga:</strong> se suman cuando el cliente compra este producto.{' '}
        <strong className="text-foreground">Costo en puntos:</strong> saldo que necesita para canjearlo gratis.
        Dejar en <strong className="text-foreground">0</strong> desactiva esa regla para el producto.
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar producto por nombre"
          className="h-9 rounded-xl pl-8 text-sm"
        />
      </div>

      {filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <Package className="h-5 w-5 text-muted-foreground/60" />
          <p className="text-xs text-muted-foreground">
            {productos.length === 0 ? 'Todavía no cargaste productos en tu carta.' : 'Ningún producto coincide con la búsqueda.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map((producto) => {
            const borrador = borradores[producto.id] ?? { ganados: valorActual(producto, 'ganados'), necesarios: valorActual(producto, 'necesarios') }
            const sucio = estaSucio(producto)
            return (
              <div key={producto.id} className="flex flex-col gap-2 rounded-xl border border-border/50 bg-background p-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{producto.nombre}</p>
                  {producto.activo === false && <p className="text-[11px] text-muted-foreground">Producto pausado</p>}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:w-64">
                  <div>
                    <Label className="text-[11px] font-semibold text-muted-foreground">Otorga</Label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={borrador.ganados}
                      onChange={(e) => setBorradores((prev) => ({ ...prev, [producto.id]: { ...borrador, ganados: e.target.value } }))}
                      className="mt-1 h-9 rounded-xl text-sm font-semibold tabular-nums"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] font-semibold text-muted-foreground">Costo en puntos</Label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={borrador.necesarios}
                      onChange={(e) => setBorradores((prev) => ({ ...prev, [producto.id]: { ...borrador, necesarios: e.target.value } }))}
                      className="mt-1 h-9 rounded-xl text-sm font-semibold tabular-nums"
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={sucio ? 'default' : 'ghost'}
                  disabled={!sucio || guardando === producto.id}
                  onClick={() => void guardar(producto)}
                  className="h-9 shrink-0 rounded-xl text-xs sm:w-24"
                >
                  {guardando === producto.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Check className="mr-1 h-3.5 w-3.5" />Guardar</>}
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
