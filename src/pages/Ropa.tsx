import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ImageUpload from '@/components/ImageUpload'
import { useAuthStore } from '@/store/authStore'
import {
  ropaApi,
  type RopaEstado,
  type RopaPedido,
  type RopaProducto,
  type RopaProductoInput,
} from '@/lib/api'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Check,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Shirt,
  Trash2,
  Truck,
  X,
} from 'lucide-react'

/**
 * Tienda de indumentaria de Alfajor (restaurante id 6).
 *
 * Pantalla única con dos solapas: Pedidos (lo que hay que despachar y cobrar) y Productos
 * (el catálogo). El backend rechaza con 403 a cualquier otro local, así que el guard de acá
 * es sólo para no mostrarle a nadie una pantalla que no le sirve.
 */

const ROPA_RESTAURANTE_ID = 6

/** Cada cuánto se refresca sola la lista de pedidos. Sin WebSocket a propósito. */
const REFRESCO_PEDIDOS_MS = 20_000

const ESTADOS: Array<{ value: RopaEstado; label: string }> = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'preparando', label: 'Preparando' },
  { value: 'enviado', label: 'Enviado' },
  { value: 'entregado', label: 'Entregado' },
  { value: 'cancelado', label: 'Cancelado' },
]

const ESTADO_LABEL: Record<RopaEstado, string> = {
  pendiente: 'Pendiente',
  preparando: 'Preparando',
  enviado: 'Enviado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

const ESTADO_CLASES: Record<RopaEstado, string> = {
  pendiente: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  preparando: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  enviado: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  entregado: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  cancelado: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400',
}

const METODO_LABEL: Record<string, string> = {
  mercadopago_checkout: 'Mercado Pago',
  mercadopago_bricks: 'Tarjeta',
  transferencia_automatica_cucuru: 'Transferencia',
  transferencia_automatica_talo: 'Transferencia',
  manual_transfer: 'Transferencia',
  mercadopago: 'Mercado Pago',
  transferencia: 'Transferencia',
  cash: 'Efectivo',
}

const formatoPrecio = (valor: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(valor)

const formatoFecha = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

// ─────────────────────────────────────────────────────────────────────────────
// Alta y edición de prendas
// ─────────────────────────────────────────────────────────────────────────────

const MAX_IMAGENES = 5

interface FormProductoProps {
  abierto: boolean
  producto: RopaProducto | null
  onCerrar: () => void
  onGuardado: () => void
}

const FormProducto = ({ abierto, producto, onCerrar, onGuardado }: FormProductoProps) => {
  const token = useAuthStore((s) => s.token)
  const [guardando, setGuardando] = useState(false)

  const [nombre, setNombre] = useState('')
  const [subtitulo, setSubtitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [precio, setPrecio] = useState('')
  const [precioAnterior, setPrecioAnterior] = useState('')
  const [categoria, setCategoria] = useState('')
  const [imagenes, setImagenes] = useState<string[]>([])
  const [talles, setTalles] = useState<string[]>([])
  const [talleNuevo, setTalleNuevo] = useState('')
  const [colores, setColores] = useState<Array<{ nombre: string; hex: string }>>([])
  const [colorNombre, setColorNombre] = useState('')
  const [colorHex, setColorHex] = useState('#000000')
  const [controlaStock, setControlaStock] = useState(false)
  const [stock, setStock] = useState('0')
  const [activo, setActivo] = useState(true)

  // Resetear el formulario cada vez que se abre, para no arrastrar lo editado antes.
  useEffect(() => {
    if (!abierto) return
    setNombre(producto?.nombre ?? '')
    setSubtitulo(producto?.subtitulo ?? '')
    setDescripcion(producto?.descripcion ?? '')
    setPrecio(producto ? String(producto.precio) : '')
    setPrecioAnterior(producto?.precioAnterior != null ? String(producto.precioAnterior) : '')
    setCategoria(producto?.categoria ?? '')
    setImagenes(producto?.imagenes ?? [])
    setTalles(producto?.talles ?? [])
    setColores(producto?.colores ?? [])
    setControlaStock(producto?.stock != null)
    setStock(producto?.stock != null ? String(producto.stock) : '0')
    setActivo(producto?.activo ?? true)
    setTalleNuevo('')
    setColorNombre('')
    setColorHex('#000000')
  }, [abierto, producto])

  const agregarTalle = () => {
    const limpio = talleNuevo.trim().toUpperCase()
    if (!limpio) return
    if (talles.includes(limpio)) {
      toast.error('Ese talle ya está en la lista')
      return
    }
    setTalles([...talles, limpio])
    setTalleNuevo('')
  }

  const agregarColor = () => {
    const limpio = colorNombre.trim()
    if (!limpio) return
    if (colores.some((c) => c.nombre.toLowerCase() === limpio.toLowerCase())) {
      toast.error('Ese color ya está en la lista')
      return
    }
    setColores([...colores, { nombre: limpio, hex: colorHex }])
    setColorNombre('')
    setColorHex('#000000')
  }

  /** Ranura i de imagen: sube, reemplaza o borra. `null` del ImageUpload = quitar. */
  const setImagenEn = (index: number, valor: string | null) => {
    setImagenes((prev) => {
      const copia = [...prev]
      if (valor === null) copia.splice(index, 1)
      else copia[index] = valor
      return copia
    })
  }

  const guardar = async () => {
    if (!token) return

    if (!nombre.trim()) {
      toast.error('Falta el nombre de la prenda')
      return
    }
    const precioNum = Number(precio)
    if (!Number.isFinite(precioNum) || precioNum <= 0) {
      toast.error('El precio tiene que ser un número mayor a 0')
      return
    }
    if (precioAnterior && Number(precioAnterior) <= precioNum) {
      toast.error('El precio anterior tiene que ser mayor al precio actual')
      return
    }
    if (imagenes.length === 0) {
      toast.error('Cargá al menos una imagen')
      return
    }

    const data: RopaProductoInput = {
      nombre: nombre.trim(),
      subtitulo: subtitulo.trim() || null,
      descripcion: descripcion.trim() || null,
      precio: precioNum,
      precioAnterior: precioAnterior ? Number(precioAnterior) : null,
      categoria: categoria.trim() || null,
      // Las URLs ya subidas se mandan tal cual y el backend las conserva; los data URLs
      // nuevos se suben a R2 allá. Así no se re-suben las imágenes que no cambiaron.
      imagenes,
      talles,
      colores,
      stock: controlaStock ? Math.max(0, Number(stock) || 0) : null,
      activo,
    }

    setGuardando(true)
    try {
      if (producto) {
        await ropaApi.actualizarProducto(token, producto.id, data)
        toast.success('Prenda actualizada')
      } else {
        await ropaApi.crearProducto(token, data)
        toast.success('Prenda creada')
      }
      onGuardado()
      onCerrar()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la prenda')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{producto ? 'Editar prenda' : 'Nueva prenda'}</DialogTitle>
          <DialogDescription>
            La primera imagen es la que se ve en el catálogo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Imágenes */}
          <div>
            <Label className="mb-2 block">Imágenes ({imagenes.length}/{MAX_IMAGENES})</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Array.from({ length: Math.min(MAX_IMAGENES, imagenes.length + 1) }).map((_, i) => (
                <ImageUpload
                  key={i}
                  currentImage={imagenes[i] ?? null}
                  onImageChange={(valor) => setImagenEn(i, valor)}
                  square
                />
              ))}
            </div>
          </div>

          {/* Datos básicos */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label htmlFor="ropa-nombre" className="mb-1.5 block">Nombre</Label>
              <Input
                id="ropa-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Hoodie Drop 01"
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="ropa-subtitulo" className="mb-1.5 block">Subtítulo (opcional)</Label>
              <Input
                id="ropa-subtitulo"
                value={subtitulo}
                onChange={(e) => setSubtitulo(e.target.value)}
                placeholder="Algodón peinado 400g"
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="ropa-descripcion" className="mb-1.5 block">Descripción</Label>
              <Textarea
                id="ropa-descripcion"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={3}
                placeholder="Qué la hace distinta, cómo calza, de qué está hecha…"
              />
            </div>

            <div>
              <Label htmlFor="ropa-precio" className="mb-1.5 block">Precio</Label>
              <Input
                id="ropa-precio"
                type="number"
                inputMode="decimal"
                min={0}
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                placeholder="45000"
              />
            </div>

            <div>
              <Label htmlFor="ropa-precio-anterior" className="mb-1.5 block">
                Precio anterior (opcional)
              </Label>
              <Input
                id="ropa-precio-anterior"
                type="number"
                inputMode="decimal"
                min={0}
                value={precioAnterior}
                onChange={(e) => setPrecioAnterior(e.target.value)}
                placeholder="Se muestra tachado"
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="ropa-categoria" className="mb-1.5 block">
                Categoría (opcional)
              </Label>
              <Input
                id="ropa-categoria"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                placeholder="hoodies, remeras, camperas…"
              />
            </div>
          </div>

          {/* Talles */}
          <div>
            <Label className="mb-2 block">Talles</Label>
            <div className="flex gap-2">
              <Input
                value={talleNuevo}
                onChange={(e) => setTalleNuevo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    agregarTalle()
                  }
                }}
                placeholder="S, M, L, XL…"
              />
              <Button type="button" variant="outline" onClick={agregarTalle}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {talles.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {talles.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => setTalles(talles.filter((x) => x !== t))}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={`Quitar talle ${t}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Colores */}
          <div>
            <Label className="mb-2 block">Colores</Label>
            <div className="flex gap-2">
              <Input
                value={colorNombre}
                onChange={(e) => setColorNombre(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    agregarColor()
                  }
                }}
                placeholder="Negro, Crema…"
              />
              <input
                type="color"
                value={colorHex}
                onChange={(e) => setColorHex(e.target.value)}
                className="h-9 w-12 rounded-md border border-input bg-transparent cursor-pointer"
                aria-label="Color"
              />
              <Button type="button" variant="outline" onClick={agregarColor}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {colores.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {colores.map((c) => (
                  <span
                    key={c.nombre}
                    className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm"
                  >
                    <span
                      className="h-3 w-3 rounded-full border border-black/10"
                      style={{ backgroundColor: c.hex }}
                    />
                    {c.nombre}
                    <button
                      type="button"
                      onClick={() => setColores(colores.filter((x) => x.nombre !== c.nombre))}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={`Quitar color ${c.nombre}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Stock y visibilidad */}
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="ropa-controla-stock">Controlar stock</Label>
                <p className="text-xs text-muted-foreground">
                  Si lo dejás apagado, la prenda nunca se agota.
                </p>
              </div>
              <Switch
                id="ropa-controla-stock"
                checked={controlaStock}
                onCheckedChange={setControlaStock}
              />
            </div>
            {controlaStock && (
              <div>
                <Label htmlFor="ropa-stock" className="mb-1.5 block">Unidades disponibles</Label>
                <Input
                  id="ropa-stock"
                  type="number"
                  min={0}
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                />
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="ropa-activo">Visible en la tienda</Label>
                <p className="text-xs text-muted-foreground">
                  Apagado = la prenda no se muestra ni se puede comprar.
                </p>
              </div>
              <Switch id="ropa-activo" checked={activo} onCheckedChange={setActivo} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {producto ? 'Guardar cambios' : 'Crear prenda'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Pedidos
// ─────────────────────────────────────────────────────────────────────────────

const TarjetaPedido = ({
  pedido,
  onCambio,
}: {
  pedido: RopaPedido
  onCambio: () => void
}) => {
  const token = useAuthStore((s) => s.token)
  const [ocupado, setOcupado] = useState(false)

  const cambiarEstado = async (estado: RopaEstado) => {
    if (!token) return
    setOcupado(true)
    try {
      await ropaApi.cambiarEstado(token, pedido.id, estado)
      toast.success(`Pedido #${pedido.id}: ${ESTADO_LABEL[estado].toLowerCase()}`)
      onCambio()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cambiar el estado')
    } finally {
      setOcupado(false)
    }
  }

  const alternarPagado = async () => {
    if (!token) return
    setOcupado(true)
    try {
      await ropaApi.marcarPagado(token, pedido.id, !pedido.pagado)
      toast.success(pedido.pagado ? 'Marcado como impago' : 'Pago registrado')
      onCambio()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar el pago')
    } finally {
      setOcupado(false)
    }
  }

  const esTransferencia = pedido.metodoPago?.includes('transferencia') ?? false

  return (
    <Card className="p-4 space-y-4">
      {/* Cabecera: quién, cuándo, cómo */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">Pedido #{pedido.id}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_CLASES[pedido.estado]}`}>
              {ESTADO_LABEL[pedido.estado]}
            </span>
            {!pedido.pagado && (
              <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
                Sin cobrar
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {pedido.nombreCliente} · {pedido.telefono} · {formatoFecha(pedido.createdAt)}
          </p>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold">{formatoPrecio(pedido.total)}</div>
          <div className="text-xs text-muted-foreground">
            {METODO_LABEL[pedido.metodoPago ?? ''] ?? pedido.metodoPago ?? 'Sin método'}
          </div>
        </div>
      </div>

      {/* Entrega */}
      <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm">
        <Truck className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
        <div>
          <div className="font-medium">
            {pedido.tipoEntrega === 'envio' ? 'Envío a domicilio' : 'Retira en el local'}
          </div>
          {pedido.tipoEntrega === 'envio' && (
            <div className="text-muted-foreground">
              {[pedido.direccion, pedido.ciudad, pedido.codigoPostal].filter(Boolean).join(', ')}
              {pedido.costoEnvio > 0 && ` · envío ${formatoPrecio(pedido.costoEnvio)}`}
            </div>
          )}
          {pedido.notas && (
            <div className="text-muted-foreground mt-1">Nota: {pedido.notas}</div>
          )}
        </div>
      </div>

      {/* Prendas */}
      <div className="space-y-2">
        {pedido.items.map((item) => (
          <div key={item.id} className="flex items-center gap-3">
            {item.imagenUrl ? (
              <img
                src={item.imagenUrl}
                alt={item.nombreProducto}
                className="h-12 w-12 rounded-md object-cover bg-muted"
              />
            ) : (
              <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center">
                <Shirt className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{item.nombreProducto}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                {item.talle && <span>Talle {item.talle}</span>}
                {item.colorNombre && (
                  <span className="inline-flex items-center gap-1">
                    {item.colorHex && (
                      <span
                        className="h-2.5 w-2.5 rounded-full border border-black/10"
                        style={{ backgroundColor: item.colorHex }}
                      />
                    )}
                    {item.colorNombre}
                  </span>
                )}
                <span>× {item.cantidad}</span>
              </div>
            </div>
            <div className="text-sm font-medium">
              {formatoPrecio(item.precioUnitario * item.cantidad)}
            </div>
          </div>
        ))}
      </div>

      {/* Datos de transferencia: lo que el dueño necesita para verificar el ingreso */}
      {esTransferencia && (
        <div className="rounded-lg border border-dashed p-3 text-sm">
          {pedido.aliasTransferencia || pedido.cvuTransferencia ? (
            <>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Alias de este pedido
              </div>
              {pedido.aliasTransferencia && (
                <div className="font-mono">{pedido.aliasTransferencia}</div>
              )}
              {pedido.cvuTransferencia && (
                <div className="font-mono text-muted-foreground">CVU {pedido.cvuTransferencia}</div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              Sin alias dinámico. Transferencia manual del local.
            </div>
          )}
        </div>
      )}

      {/* Acciones */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          size="sm"
          variant={pedido.pagado ? 'outline' : 'default'}
          onClick={alternarPagado}
          disabled={ocupado}
        >
          {ocupado ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Check className="h-4 w-4 mr-2" />
          )}
          {pedido.pagado ? 'Marcar impago' : 'Marcar cobrado'}
        </Button>

        <Select
          value={pedido.estado}
          onValueChange={(v) => cambiarEstado(v as RopaEstado)}
          disabled={ocupado}
        >
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ESTADOS.map((e) => (
              <SelectItem key={e.value} value={e.value}>
                {e.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Página
// ─────────────────────────────────────────────────────────────────────────────

const Ropa = () => {
  const token = useAuthStore((s) => s.token)
  const restauranteId = useAuthStore((s) => s.restaurante?.id)

  const [pedidos, setPedidos] = useState<RopaPedido[]>([])
  const [productos, setProductos] = useState<RopaProducto[]>([])
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formAbierto, setFormAbierto] = useState(false)
  const [productoEnEdicion, setProductoEnEdicion] = useState<RopaProducto | null>(null)

  const [envioHabilitado, setEnvioHabilitado] = useState(true)
  const [costoEnvio, setCostoEnvio] = useState('0')
  const [guardandoConfig, setGuardandoConfig] = useState(false)

  const habilitado = restauranteId === ROPA_RESTAURANTE_ID

  // Evita que un fetch viejo pise el estado después de desmontar o de un refresco posterior.
  const canceladoRef = useRef(false)

  const cargar = useCallback(async (silencioso = false) => {
    if (!token || !habilitado) return
    if (!silencioso) setRefrescando(true)
    try {
      const [resPedidos, resProductos, resConfig] = await Promise.all([
        ropaApi.pedidos(token),
        ropaApi.productos(token),
        ropaApi.getConfig(token),
      ])
      if (canceladoRef.current) return

      setPedidos(resPedidos.pedidos ?? [])
      setProductos(resProductos.productos ?? [])
      setEnvioHabilitado(resConfig.data.ropaEnvioEnabled)
      setCostoEnvio(String(resConfig.data.ropaCostoEnvio))
      setError(null)
    } catch (err) {
      if (canceladoRef.current) return
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los datos')
    } finally {
      if (!canceladoRef.current) {
        setCargando(false)
        setRefrescando(false)
      }
    }
  }, [token, habilitado])

  useEffect(() => {
    canceladoRef.current = false
    void cargar()
    return () => {
      canceladoRef.current = true
    }
  }, [cargar])

  // Refresco automático de pedidos: el dueño deja la pantalla abierta y ve entrar los pedidos.
  useEffect(() => {
    if (!habilitado) return
    const id = setInterval(() => void cargar(true), REFRESCO_PEDIDOS_MS)
    return () => clearInterval(id)
  }, [cargar, habilitado])

  const guardarConfig = async () => {
    if (!token) return
    const costo = Number(costoEnvio)
    if (!Number.isFinite(costo) || costo < 0) {
      toast.error('El costo de envío tiene que ser un número mayor o igual a 0')
      return
    }
    setGuardandoConfig(true)
    try {
      await ropaApi.setConfig(token, { ropaEnvioEnabled: envioHabilitado, ropaCostoEnvio: costo })
      toast.success('Configuración de envío guardada')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setGuardandoConfig(false)
    }
  }

  const eliminarProducto = async (producto: RopaProducto) => {
    if (!token) return
    if (!confirm(`¿Borrar "${producto.nombre}"? Los pedidos ya hechos no se tocan.`)) return
    try {
      await ropaApi.eliminarProducto(token, producto.id)
      toast.success('Prenda borrada')
      void cargar(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo borrar')
    }
  }

  // El backend igual rechaza con 403; esto sólo evita mostrar una pantalla inútil.
  if (!habilitado) return <Navigate to="/dashboard" replace />

  const sinCobrar = pedidos.filter((p) => !p.pagado).length
  const porDespachar = pedidos.filter(
    (p) => p.estado !== 'entregado' && p.estado !== 'cancelado',
  ).length

  // Lo que requiere acción primero: sin cobrar, después sin despachar, después el resto.
  const pedidosOrdenados = [...pedidos].sort((a, b) => {
    const peso = (p: RopaPedido) => (p.pagado ? 0 : 2) + (p.estado === 'pendiente' ? 1 : 0)
    const diff = peso(b) - peso(a)
    if (diff !== 0) return diff
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  if (cargando) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shirt className="h-6 w-6" />
            Ropa
          </h1>
          <p className="text-sm text-muted-foreground">
            Los pedidos y el catálogo de la tienda de indumentaria.
          </p>
        </div>
        <Button variant="outline" onClick={() => void cargar()} disabled={refrescando}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refrescando ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {error && (
        <Card className="p-4 border-destructive/50 flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          {error}
        </Card>
      )}

      <Tabs defaultValue="pedidos">
        <TabsList>
          <TabsTrigger value="pedidos">
            Pedidos
            {pedidos.length > 0 && (
              <span className="ml-2 rounded-full bg-muted-foreground/20 px-2 text-xs">
                {pedidos.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="productos">
            Productos
            {productos.length > 0 && (
              <span className="ml-2 rounded-full bg-muted-foreground/20 px-2 text-xs">
                {productos.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Pedidos ── */}
        <TabsContent value="pedidos" className="space-y-4 mt-4">
          {(sinCobrar > 0 || porDespachar > 0) && (
            <div className="flex flex-wrap gap-2">
              {sinCobrar > 0 && (
                <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
                  {sinCobrar} sin cobrar
                </Badge>
              )}
              {porDespachar > 0 && (
                <Badge variant="outline">{porDespachar} por despachar</Badge>
              )}
            </div>
          )}

          {pedidos.length === 0 ? (
            <Card className="p-10 text-center">
              <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">Todavía no hay pedidos</p>
              <p className="text-sm text-muted-foreground mt-1">
                Cuando alguien compre desde la tienda, el pedido aparece acá solo.
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {pedidosOrdenados.map((pedido) => (
                <TarjetaPedido key={pedido.id} pedido={pedido} onCambio={() => void cargar(true)} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Productos ── */}
        <TabsContent value="productos" className="space-y-4 mt-4">
          {/* Envío */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="ropa-envio">Ofrecer envío a domicilio</Label>
                <p className="text-xs text-muted-foreground">
                  Con el envío apagado, la tienda sólo ofrece retiro en el local.
                </p>
              </div>
              <Switch
                id="ropa-envio"
                checked={envioHabilitado}
                onCheckedChange={setEnvioHabilitado}
              />
            </div>
            {envioHabilitado && (
              <div className="flex items-end gap-3">
                <div className="w-48">
                  <Label htmlFor="ropa-costo" className="mb-1.5 block">Costo de envío</Label>
                  <Input
                    id="ropa-costo"
                    type="number"
                    min={0}
                    inputMode="decimal"
                    value={costoEnvio}
                    onChange={(e) => setCostoEnvio(e.target.value)}
                  />
                </div>
                <Button onClick={guardarConfig} disabled={guardandoConfig}>
                  {guardandoConfig && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Guardar
                </Button>
              </div>
            )}
            {!envioHabilitado && (
              <Button variant="outline" size="sm" onClick={guardarConfig} disabled={guardandoConfig}>
                {guardandoConfig && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Guardar
              </Button>
            )}
          </Card>

          <div className="flex justify-end">
            <Button
              onClick={() => {
                setProductoEnEdicion(null)
                setFormAbierto(true)
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nueva prenda
            </Button>
          </div>

          {productos.length === 0 ? (
            <Card className="p-10 text-center">
              <Shirt className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">El catálogo está vacío</p>
              <p className="text-sm text-muted-foreground mt-1">
                Cargá la primera prenda para que aparezca en la tienda.
              </p>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {productos.map((producto) => (
                <Card key={producto.id} className="overflow-hidden flex flex-col">
                  {producto.imagenes[0] ? (
                    <img
                      src={producto.imagenes[0]}
                      alt={producto.nombre}
                      className="h-40 w-full object-cover bg-muted"
                    />
                  ) : (
                    <div className="h-40 w-full bg-muted flex items-center justify-center">
                      <Shirt className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="p-3 space-y-2 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{producto.nombre}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatoPrecio(producto.precio)}
                          {producto.precioAnterior != null && (
                            <span className="ml-2 line-through">
                              {formatoPrecio(producto.precioAnterior)}
                            </span>
                          )}
                        </div>
                      </div>
                      {!producto.activo && <Badge variant="outline">Oculta</Badge>}
                    </div>

                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>
                        Talles: {producto.talles.length > 0 ? producto.talles.join(' · ') : 'sin talles'}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>Colores:</span>
                        {producto.colores.length > 0 ? (
                          producto.colores.map((c) => (
                            <span key={c.nombre} className="inline-flex items-center gap-1">
                              <span
                                className="h-2.5 w-2.5 rounded-full border border-black/10"
                                style={{ backgroundColor: c.hex }}
                              />
                              {c.nombre}
                            </span>
                          ))
                        ) : (
                          <span>sin colores</span>
                        )}
                      </div>
                      <div>
                        Stock:{' '}
                        {producto.stock == null ? 'sin control' : `${producto.stock} unidades`}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 mt-auto">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setProductoEnEdicion(producto)
                          setFormAbierto(true)
                        }}
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void eliminarProducto(producto)}
                        aria-label={`Borrar ${producto.nombre}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <FormProducto
        abierto={formAbierto}
        producto={productoEnEdicion}
        onCerrar={() => setFormAbierto(false)}
        onGuardado={() => void cargar(true)}
      />
    </div>
  )
}

export default Ropa
