import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useRestauranteStore } from '@/store/restauranteStore'
import { useAuthStore } from '@/store/authStore'
import { productosApi, categoriasApi, ingredientesApi, agregadosApi } from '@/lib/api'
import { toast } from 'sonner'
import ImageUpload from '@/components/ImageUpload'
import { cn } from '@/lib/utils'
import {
  Package, Plus, Edit, Trash2, Search, Loader2, UtensilsCrossed, CheckCircle2,
  X, Power, AlertTriangle, Tag, Percent, Image as ImageIcon
} from 'lucide-react'

// ─────────────────────────────────────────────
// Estilos base "Phantom"
// ─────────────────────────────────────────────
const phantomCardClass = "bg-white dark:bg-[#121212] rounded-[32px] shadow-sm border border-zinc-100 dark:border-zinc-800 overflow-hidden"
const phantomInputClass = "h-14 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border-transparent focus:bg-background focus:border-[#FF7A00] focus:ring-2 focus:ring-[#FF7A00]/20 transition-all text-base px-5 w-full"
const phantomLabelClass = "text-sm font-bold text-foreground ml-1 mb-2 block"

const Productos = () => {
  const { productos, categorias, isLoading, fetchData, restaurante, setCategorias } = useRestauranteStore()
  const token = useAuthStore((state) => state.token)
  const [busqueda, setBusqueda] = useState('')
  const [dialogAbierto, setDialogAbierto] = useState(false)
  const [productoEditando, setProductoEditando] = useState<typeof productos[0] | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<{
    nombre: string
    descripcion: string
    precio: string
    categoriaId: string
    puntosGanados: string
    puntosNecesarios: string
    descuento: string
    variantes: Array<{ id?: number, nombre: string, precio: string }>
  }>({
    nombre: '',
    descripcion: '',
    precio: '',
    categoriaId: '0',
    puntosGanados: '',
    puntosNecesarios: '',
    descuento: '',
    variantes: []
  })
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [dialogCategoriaAbierto, setDialogCategoriaAbierto] = useState(false)
  const [nuevaCategoriaNombre, setNuevaCategoriaNombre] = useState('')
  const [isCreandoCategoria, setIsCreandoCategoria] = useState(false)
  const [ingredientes, setIngredientes] = useState<Array<{ id: number; nombre: string }>>([])
  const [ingredientesSeleccionados, setIngredientesSeleccionados] = useState<number[]>([])
  const [nuevoIngredienteNombre, setNuevoIngredienteNombre] = useState('')
  const [dialogIngredienteAbierto, setDialogIngredienteAbierto] = useState(false)
  const [isCreandoIngrediente, setIsCreandoIngrediente] = useState(false)
  const [busquedaIngrediente, setBusquedaIngrediente] = useState('')

  // Estados para agregados
  const [agregados, setAgregados] = useState<Array<{ id: number; nombre: string; precio: string }>>([])
  const [agregadosSeleccionados, setAgregadosSeleccionados] = useState<number[]>([])
  const [nuevoAgregadoNombre, setNuevoAgregadoNombre] = useState('')
  const [nuevoAgregadoPrecio, setNuevoAgregadoPrecio] = useState('')
  const [dialogAgregadoAbierto, setDialogAgregadoAbierto] = useState(false)
  const [isCreandoAgregado, setIsCreandoAgregado] = useState(false)

  const [dialogEliminarAbierto, setDialogEliminarAbierto] = useState(false)
  const [productoAEliminar, setProductoAEliminar] = useState<typeof productos[0] | null>(null)
  const [isEliminando, setIsEliminando] = useState(false)

  const [dialogDesactivarAbierto, setDialogDesactivarAbierto] = useState(false)
  const [productoADesactivar, setProductoADesactivar] = useState<typeof productos[0] | null>(null)
  const [isDesactivando, setIsDesactivando] = useState(false)

  // Estados para gestión de categorías
  const [dialogGestionCategoriasAbierto, setDialogGestionCategoriasAbierto] = useState(false)
  const [dialogEliminarCategoriaAbierto, setDialogEliminarCategoriaAbierto] = useState(false)
  const [categoriaAEliminar, setCategoriaAEliminar] = useState<typeof categorias[0] | null>(null)
  const [isEliminandoCategoria, setIsEliminandoCategoria] = useState(false)

  // Estados para etiquetas
  const [etiquetasProducto, setEtiquetasProducto] = useState<string[]>([])
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState('')
  const [isBackfillingEtiquetas, setIsBackfillingEtiquetas] = useState(false)

  useEffect(() => {
    if (!restaurante) {
      fetchData()
    }
  }, [])

  // Cargar ingredientes y agregados
  useEffect(() => {
    const cargarIngredientes = async () => {
      if (!token) return
      try {
        const response = await ingredientesApi.getAll(token) as {
          success: boolean
          ingredientes?: Array<{ id: number; nombre: string }>
        }
        if (response.success && response.ingredientes) setIngredientes(response.ingredientes)
      } catch (error) {
        console.error('Error cargando ingredientes:', error)
      }
    }
    cargarIngredientes()

    const cargarAgregados = async () => {
      if (!token) return
      try {
        const response = await agregadosApi.getAll(token) as {
          success: boolean
          agregados?: Array<{ id: number; nombre: string; precio: string }>
        }
        if (response.success && response.agregados) setAgregados(response.agregados)
      } catch (error) {
        console.error('Error cargando agregados:', error)
      }
    }
    cargarAgregados()
  }, [token])

  const crearIngrediente = async () => {
    if (!token || !nuevoIngredienteNombre.trim()) {
      toast.error('El nombre del ingrediente es requerido')
      return
    }
    setIsCreandoIngrediente(true)
    try {
      const response = await ingredientesApi.create(token, { nombre: nuevoIngredienteNombre.trim() }) as { success: boolean; data?: any }
      if (response.success) {
        toast.success('Ingrediente creado')
        setNuevoIngredienteNombre('')
        setDialogIngredienteAbierto(false)
        const ingredientesResponse = await ingredientesApi.getAll(token) as any
        if (ingredientesResponse.success && ingredientesResponse.ingredientes) setIngredientes(ingredientesResponse.ingredientes)
      }
    } catch (error: any) {
      toast.error('Error al crear ingrediente', { description: error.message || 'Error de conexión' })
    } finally {
      setIsCreandoIngrediente(false)
    }
  }

  const crearAgregado = async () => {
    if (!token || !nuevoAgregadoNombre.trim() || !nuevoAgregadoPrecio) {
      toast.error('Nombre y precio del agregado son requeridos')
      return
    }
    const precio = parseFloat(nuevoAgregadoPrecio)
    if (isNaN(precio) || precio < 0) {
      toast.error('El precio debe ser un número válido')
      return
    }
    setIsCreandoAgregado(true)
    try {
      const response = await agregadosApi.create(token, { nombre: nuevoAgregadoNombre.trim(), precio }) as { success: boolean; data?: any }
      if (response.success) {
        toast.success('Agregado creado')
        setNuevoAgregadoNombre('')
        setNuevoAgregadoPrecio('')
        setDialogAgregadoAbierto(false)
        const agregadosResponse = await agregadosApi.getAll(token) as any
        if (agregadosResponse.success && agregadosResponse.agregados) setAgregados(agregadosResponse.agregados)
      }
    } catch (error: any) {
      toast.error('Error al crear agregado', { description: error.message || 'Error de conexión' })
    } finally {
      setIsCreandoAgregado(false)
    }
  }

  const crearCategoria = async () => {
    if (!token || !nuevaCategoriaNombre.trim()) {
      toast.error('El nombre de la categoría es requerido')
      return
    }
    setIsCreandoCategoria(true)
    try {
      const response = await categoriasApi.create(token, { nombre: nuevaCategoriaNombre.trim() }) as { success: boolean; data?: any }
      if (response.success) {
        toast.success('Categoría creada')
        setNuevaCategoriaNombre('')
        setDialogCategoriaAbierto(false)
        const categoriasResponse = await categoriasApi.getAll(token) as any
        if (categoriasResponse.success && categoriasResponse.categorias) setCategorias(categoriasResponse.categorias)
      }
    } catch (error: any) {
      toast.error('Error al crear categoría', { description: error.message || 'Error de conexión' })
    } finally {
      setIsCreandoCategoria(false)
    }
  }

  const eliminarCategoria = async () => {
    if (!token || !categoriaAEliminar) return
    setIsEliminandoCategoria(true)
    try {
      const response = await categoriasApi.delete(token, categoriaAEliminar.id) as any
      if (response.success) {
        const mensaje = response.productosActualizados && response.productosActualizados > 0
          ? `Categoría eliminada. ${response.productosActualizados} producto(s) movido(s) a "Sin categoría"`
          : 'Categoría eliminada correctamente'
        toast.success(mensaje)
        setDialogEliminarCategoriaAbierto(false)
        setCategoriaAEliminar(null)
        await fetchData()
      }
    } catch (error: any) {
      toast.error('Error al eliminar categoría', { description: error.message || 'Error de conexión' })
    } finally {
      setIsEliminandoCategoria(false)
    }
  }

  const contarProductosPorCategoria = (categoriaId: number) => productos.filter(p => p.categoriaId === categoriaId).length

  const productosFiltrados = productos.filter(p => {
    const term = busqueda.toLowerCase()
    return p.nombre.toLowerCase().includes(term) ||
      (p.descripcion && p.descripcion.toLowerCase().includes(term)) ||
      (p.etiquetas && p.etiquetas.some(e => e.nombre.toLowerCase().includes(term)))
  })

  const productosSinEtiqueta = productos.filter(p => !p.etiquetas || p.etiquetas.length === 0).length

  const backfillEtiquetas = async () => {
    if (!token) return
    setIsBackfillingEtiquetas(true)
    try {
      const response = await productosApi.backfillEtiquetas(token) as any
      if (response.success) {
        toast.success(response.message || `Etiquetas asignadas: ${response.asignadas || 0}`)
        await fetchData()
      }
    } catch (error: any) {
      toast.error('Error al asignar etiquetas', { description: error.message || 'Error de conexión' })
    } finally {
      setIsBackfillingEtiquetas(false)
    }
  }

  const abrirDialogNuevo = () => {
    setProductoEditando(null)
    setFormData({ nombre: '', descripcion: '', precio: '', categoriaId: '0', puntosGanados: '', puntosNecesarios: '', descuento: '', variantes: [] })
    setImageBase64(null)
    setIngredientesSeleccionados([])
    setAgregadosSeleccionados([])
    setEtiquetasProducto([])
    setNuevaEtiqueta('')
    setBusquedaIngrediente('')
    setDialogAbierto(true)
  }

  const abrirDialogEditar = async (producto: typeof productos[0]) => {
    setProductoEditando(producto)
    setFormData({
      nombre: producto.nombre,
      descripcion: producto.descripcion || '',
      precio: producto.precio.toString(),
      categoriaId: producto.categoriaId ? producto.categoriaId.toString() : '0',
      puntosGanados: (producto as any).puntosGanados !== undefined && (producto as any).puntosGanados !== null ? (producto as any).puntosGanados.toString() : '',
      puntosNecesarios: (producto as any).puntosNecesarios !== undefined && (producto as any).puntosNecesarios !== null ? (producto as any).puntosNecesarios.toString() : '',
      descuento: (producto as any).descuento !== undefined && (producto as any).descuento !== null ? (producto as any).descuento.toString() : '',
      variantes: (producto as any).variantes ? (producto as any).variantes.map((v: any) => ({
        id: v.id,
        nombre: v.nombre,
        precio: v.precio.toString()
      })) : []
    })
    setImageBase64(producto.imagenUrl || null)
    setEtiquetasProducto(producto.etiquetas?.map(e => e.nombre) || [])
    setNuevaEtiqueta('')

    if (token) {
      try {
        const response = await ingredientesApi.getByProducto(token, producto.id) as any
        setIngredientesSeleccionados(response.success && response.ingredientes ? response.ingredientes.map((ing: any) => ing.id) : [])
      } catch (error) { setIngredientesSeleccionados([]) }

      try {
        const response2 = await agregadosApi.getByProducto(token, producto.id) as any
        setAgregadosSeleccionados(response2.success && response2.agregados ? response2.agregados.map((ag: any) => ag.id) : [])
      } catch (error) { setAgregadosSeleccionados([]) }
    }
    setDialogAbierto(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) { toast.error('No hay sesión activa'); return }
    if (!formData.nombre.trim()) { toast.error('El nombre es requerido'); return }
    if (!formData.descripcion.trim()) { toast.error('La descripción es requerida'); return }
    const precio = parseFloat(formData.precio)
    if (isNaN(precio) || precio <= 0) { toast.error('El precio debe ser mayor a 0'); return }

    setIsSubmitting(true)
    try {
      const parsedCategoriaId = parseInt(formData.categoriaId)
      const categoriaId = (parsedCategoriaId && parsedCategoriaId > 0) ? parsedCategoriaId : undefined
      const payload = {
        nombre: formData.nombre,
        descripcion: formData.descripcion,
        precio: precio,
        image: imageBase64 && imageBase64.startsWith('data:') ? imageBase64 : undefined,
        categoriaId: categoriaId !== undefined ? categoriaId : null,
        ingredienteIds: ingredientesSeleccionados,
        agregadoIds: agregadosSeleccionados,
        etiquetas: etiquetasProducto.length > 0 ? etiquetasProducto : undefined,
        variantes: formData.variantes.length > 0 ? formData.variantes.map(v => ({ id: v.id, nombre: v.nombre, precio: parseFloat(v.precio) })) : [],
        puntosGanados: formData.puntosGanados ? parseInt(formData.puntosGanados, 10) : 0,
        puntosNecesarios: formData.puntosNecesarios ? parseInt(formData.puntosNecesarios, 10) : 0,
        descuento: formData.descuento ? parseInt(formData.descuento, 10) : 0
      }

      if (productoEditando) {
        await productosApi.update(token, { id: productoEditando.id, ...payload } as any)
        toast.success('Producto actualizado')
      } else {
        await productosApi.create(token, payload as any)
        toast.success('Producto creado')
      }
      await fetchData()
      setDialogAbierto(false)
    } catch (error: any) {
      toast.error('Error al guardar', { description: error.message || 'Error de conexión' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const abrirDialogEliminar = (producto: typeof productos[0]) => {
    setProductoAEliminar(producto)
    setDialogEliminarAbierto(true)
  }

  const eliminarProducto = async () => {
    if (!token || !productoAEliminar) return
    setIsEliminando(true)
    try {
      await productosApi.delete(token, productoAEliminar.id)
      toast.success('Producto eliminado correctamente')
      setDialogEliminarAbierto(false)
      setProductoAEliminar(null)
      await fetchData()
    } catch (error: any) {
      const errorMessage = error.message || error.response?.message || ''
      if (errorMessage.includes('pedidos asociados') || errorMessage.includes('pedido')) {
        toast.error('No se puede eliminar el producto', {
          description: 'Este producto tiene pedidos asociados. Desactívalo en su lugar para ocultarlo del menú sin perder el historial.'
        })
      } else {
        toast.error('Error al eliminar producto', { description: errorMessage })
      }
    } finally {
      setIsEliminando(false)
    }
  }

  const abrirDialogToggleActivo = (producto: typeof productos[0]) => {
    setProductoADesactivar(producto)
    setDialogDesactivarAbierto(true)
  }

  const toggleActivoProducto = async () => {
    if (!token || !productoADesactivar) return
    const nuevoEstado = !productoADesactivar.activo
    setIsDesactivando(true)
    try {
      await productosApi.update(token, { id: productoADesactivar.id, activo: nuevoEstado })
      toast.success(nuevoEstado ? 'Producto activado correctamente' : 'Producto desactivado correctamente')
      setDialogDesactivarAbierto(false)
      setProductoADesactivar(null)
      await fetchData()
    } catch (error: any) {
      toast.error('Error al cambiar estado', { description: error.message || 'Error de conexión' })
    } finally {
      setIsDesactivando(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-zinc-50 dark:bg-[#0A0A0A]">
        <Loader2 className="h-8 w-8 animate-spin text-[#FF7A00]" />
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-[#0A0A0A] pb-24 selection:bg-[#FF7A00]/20 selection:text-[#FF7A00]">

      {/* ── Header Flotante ── */}
      <div className="sticky top-0 z-20 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">Catálogo</h1>
              <p className="text-sm font-medium text-muted-foreground mt-0.5">Gestiona el menú de tu restaurante</p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-72">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Buscar productos..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="pl-11 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-900 border-transparent focus:bg-background focus:border-[#FF7A00] transition-colors"
                />
              </div>

              {productosSinEtiqueta > 0 && (
                <Button variant="outline" onClick={backfillEtiquetas} disabled={isBackfillingEtiquetas} className="hidden lg:flex h-12 rounded-xl px-4 border-zinc-200 dark:border-zinc-800">
                  {isBackfillingEtiquetas ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Tag className="mr-2 h-4 w-4" />}
                  Autocompletar ({productosSinEtiqueta})
                </Button>
              )}

              <Button onClick={abrirDialogNuevo} className="hidden sm:flex h-12 rounded-xl px-6 bg-[#FF7A00] hover:bg-[#E66E00] text-white font-bold shadow-lg shadow-orange-500/20">
                <Plus className="mr-2 h-5 w-5" />
                Nuevo Plato
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {productosFiltrados.length === 0 ? (
          <div className={cn(phantomCardClass, "flex flex-col items-center justify-center py-20 text-center")}>
            <div className="h-20 w-20 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-6">
              <UtensilsCrossed className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <h3 className="text-xl font-bold mb-2">{busqueda ? 'No hay resultados' : 'Tu menú está vacío'}</h3>
            <p className="text-muted-foreground mb-8 max-w-sm">
              {busqueda ? 'Intenta buscar con otros términos.' : 'Comienza a agregar los deliciosos platos que ofreces a tus clientes.'}
            </p>
            {!busqueda && (
              <Button onClick={abrirDialogNuevo} className="h-12 rounded-xl px-8 bg-[#FF7A00] hover:bg-[#E66E00] text-white font-bold shadow-lg shadow-orange-500/20">
                <Plus className="mr-2 h-5 w-5" /> Crear Primer Producto
              </Button>
            )}
          </div>
        ) : (
          /* PRODUCTOS AGRUPADOS POR CATEGORÍA */
          <div className="space-y-12">
            {(() => {
              const porCategoria = productosFiltrados.reduce((acc, producto) => {
                const cat = producto.categoria || 'Sin categoría'
                if (!acc[cat]) acc[cat] = []
                acc[cat].push(producto)
                return acc
              }, {} as Record<string, typeof productosFiltrados>)

              const categoriasOrdenadas = Object.keys(porCategoria).sort((a, b) => {
                if (a === 'Sin categoría') return 1
                if (b === 'Sin categoría') return -1
                return a.localeCompare(b)
              })

              return categoriasOrdenadas.map((categoriaNombre) => (
                <div key={categoriaNombre} className="space-y-4">
                  <div className="flex items-center gap-3 px-2">
                    <h2 className="text-lg font-black tracking-tight text-foreground uppercase">{categoriaNombre}</h2>
                    <Badge variant="secondary" className="bg-zinc-200 dark:bg-zinc-800 text-foreground font-bold px-2.5 py-0.5 rounded-full">
                      {porCategoria[categoriaNombre].length}
                    </Badge>
                  </div>

                  <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {porCategoria[categoriaNombre].map((producto) => (
                      <Card
                        key={producto.id}
                        className={cn(
                          "group rounded-3xl border-2 transition-all hover:shadow-lg dark:hover:shadow-none hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-[#121212] overflow-hidden flex flex-row sm:flex-col min-h-[130px] sm:min-h-0 sm:h-auto",
                          !producto.activo ? "opacity-60 grayscale-[0.3]" : "border-zinc-100 dark:border-zinc-800"
                        )}
                      >
                        {/* Imagen del Producto */}
                        <div className="w-[110px] sm:w-full sm:h-48 shrink-0 bg-zinc-100 dark:bg-zinc-900 relative overflow-hidden">
                          {producto.imagenUrl ? (
                            <img
                              src={producto.imagenUrl}
                              alt={producto.nombre}
                              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            />
                          ) : (
                            <div className="absolute inset-0 w-full h-full flex items-center justify-center">
                              <ImageIcon className="h-8 w-8 sm:h-10 sm:w-10 text-zinc-300 dark:text-zinc-700" />
                            </div>
                          )}

                          {/* Badges Flotantes sobre la imagen (en Desktop) */}
                          <div className="absolute top-3 left-3 right-3 hidden sm:flex justify-between items-start">
                            {producto.descuento && producto.descuento > 0 ? (
                              <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold border-none shadow-sm">
                                <Percent className="h-3 w-3 mr-1" /> {producto.descuento}% OFF
                              </Badge>
                            ) : <div />}
                            {!producto.activo && (
                              <Badge variant="secondary" className="bg-zinc-900/80 text-white border-none backdrop-blur-md">
                                Inactivo
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Contenido de la Tarjeta */}
                        <div className="flex-1 flex flex-col p-3 sm:p-5 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h3 className="font-bold text-base sm:text-lg leading-tight line-clamp-2">{producto.nombre}</h3>

                            {/* Precio en Mobile (arriba a la derecha) */}
                            <div className="sm:hidden shrink-0 mt-0.5">
                              <span className="text-sm font-black text-foreground">
                                ${producto.descuento && producto.descuento > 0
                                  ? (parseFloat(producto.precio) * (1 - producto.descuento / 100)).toFixed(0)
                                  : parseFloat(producto.precio).toFixed(0)}
                              </span>
                            </div>
                          </div>

                          <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                            {producto.descripcion || 'Sin descripción'}
                          </p>

                          {/* Spacer para empujar los botones hacia el fondo en mobile */}
                          <div className="flex-1" />

                          <div className="flex items-center justify-between mt-3 sm:mt-4">
                            {/* Precio en Desktop (abajo a la izquierda) */}
                            <div className="hidden sm:flex flex-col">
                              {producto.descuento && producto.descuento > 0 ? (
                                <>
                                  <span className="text-xs text-muted-foreground line-through font-medium">
                                    ${parseFloat(producto.precio).toFixed(0)}
                                  </span>
                                  <span className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 leading-none">
                                    ${(parseFloat(producto.precio) * (1 - producto.descuento / 100)).toFixed(0)}
                                  </span>
                                </>
                              ) : (
                                <span className="text-lg sm:text-xl font-black text-foreground leading-none">
                                  ${parseFloat(producto.precio).toFixed(0)}
                                </span>
                              )}
                            </div>

                            {/* Badges Mobile */}
                            <div className="flex sm:hidden items-center gap-1">
                              {!producto.activo && <Badge variant="secondary" className="text-[9px] px-1 h-4">Inactivo</Badge>}
                              {producto.descuento && producto.descuento > 0 && <Badge className="bg-emerald-500 text-white text-[9px] px-1 h-4 border-none">-{producto.descuento}%</Badge>}
                            </div>

                            {/* Acciones */}
                            <div className="flex gap-1.5 ml-auto">
                              <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800" onClick={() => abrirDialogToggleActivo(producto)} title={producto.activo ? 'Desactivar' : 'Activar'}>
                                <Power className={cn("h-4 w-4", producto.activo ? "text-green-600" : "text-zinc-400")} />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-500" onClick={() => abrirDialogEditar(producto)} title="Editar">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/30 dark:hover:bg-red-900/50 flex" onClick={() => producto.activo ? abrirDialogEliminar(producto) : null} disabled={!producto.activo} title="Eliminar">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ))
            })()}
          </div>
        )}
      </div>

      {/* FAB (Mobile Only) */}
      <Button
        className="sm:hidden fixed bottom-6 right-6 h-14 w-14 rounded-full bg-[#FF7A00] hover:bg-[#E66E00] text-white shadow-xl shadow-orange-500/30 z-50 animate-in zoom-in"
        onClick={abrirDialogNuevo}
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* ─────────────────────────────────────────────
          MODAL: CREAR / EDITAR PRODUCTO
      ───────────────────────────────────────────── */}
      <Dialog open={dialogAbierto} onOpenChange={setDialogAbierto}>
        <DialogContent className="max-w-2xl p-0 gap-0 sm:rounded-[32px] border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden max-h-[90dvh] flex flex-col">

          <div className="px-6 sm:px-8 pt-8 pb-4 shrink-0 bg-white dark:bg-zinc-950 z-10 border-b border-zinc-100 dark:border-zinc-800">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center">
                  <Package className="h-5 w-5 text-[#FF7A00]" />
                </div>
                {productoEditando ? 'Editar Producto' : 'Nuevo Producto'}
              </DialogTitle>
              <DialogDescription className="text-base text-muted-foreground mt-2">
                Completa la información para que tus clientes vean este plato en tu menú.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8">
            <form id="productForm" onSubmit={handleSubmit} className="space-y-8">

              {/* Información Principal */}
              <div className="space-y-5">
                <h3 className="font-bold text-lg border-b border-zinc-100 dark:border-zinc-800 pb-2">Información Principal</h3>

                <div className="space-y-1">
                  <Label htmlFor="nombre" className={phantomLabelClass}>Nombre del Plato <span className="text-red-500">*</span></Label>
                  <Input id="nombre" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} placeholder="Ej: Burger Triple Cheddar" required disabled={isSubmitting} className={phantomInputClass} />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="descripcion" className={phantomLabelClass}>Descripción <span className="text-red-500">*</span></Label>
                  <Textarea id="descripcion" value={formData.descripcion} onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })} placeholder="Doble medallón de carne, extra cheddar, panceta crispy..." rows={3} required disabled={isSubmitting} className="min-h-[100px] rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border-transparent focus:bg-background focus:border-[#FF7A00] focus:ring-2 focus:ring-[#FF7A00]/20 transition-all text-base px-5 py-4 w-full resize-none" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <Label htmlFor="precio" className={phantomLabelClass}>Precio ($) <span className="text-red-500">*</span></Label>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">$</span>
                      <Input id="precio" type="number" step="0.01" min="0" value={formData.precio} onChange={(e) => setFormData({ ...formData, precio: e.target.value })} placeholder="0.00" required disabled={isSubmitting} className={cn(phantomInputClass, "pl-9 font-bold")} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="descuento" className={phantomLabelClass}>Descuento (%)</Label>
                      {formData.descuento && parseInt(formData.descuento) > 0 && formData.precio && (
                        <span className="text-xs font-bold text-emerald-600 mb-2">Queda en: ${(parseFloat(formData.precio) * (1 - parseInt(formData.descuento) / 100)).toFixed(0)}</span>
                      )}
                    </div>
                    <div className="relative">
                      <Percent className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="descuento" type="number" min="0" max="100" step="1" value={formData.descuento} onChange={(e) => setFormData({ ...formData, descuento: e.target.value })} placeholder="0" disabled={isSubmitting} className={cn(phantomInputClass, "pl-10")} />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="categoria" className="text-sm font-bold text-foreground ml-1 block">Categoría</Label>
                    <Button type="button" variant="link" className="h-auto p-0 text-[#FF7A00] text-sm font-semibold" onClick={() => setDialogGestionCategoriasAbierto(true)}>Gestionar categorías</Button>
                  </div>
                  <Select value={formData.categoriaId} onValueChange={(value) => setFormData({ ...formData, categoriaId: value })} disabled={isSubmitting}>
                    <SelectTrigger className="h-14 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border-transparent focus:ring-2 focus:ring-[#FF7A00]/20 text-base font-medium px-5">
                      <SelectValue placeholder="Seleccionar categoría (opcional)" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-zinc-200 dark:border-zinc-800">
                      <SelectItem value="0" className="py-3">Sin categoría</SelectItem>
                      {categorias.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id.toString()} className="py-3">{cat.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className={phantomLabelClass}>Foto del Plato</Label>
                  <div className="bg-zinc-50 dark:bg-zinc-900/30 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl p-2 hover:border-[#FF7A00]/50 transition-colors">
                    <ImageUpload onImageChange={setImageBase64} currentImage={imageBase64} maxSize={5} />
                  </div>
                </div>
              </div>

              {/* Personalización y Extras */}
              <div className="space-y-5 pt-4">
                <h3 className="font-bold text-lg border-b border-zinc-100 dark:border-zinc-800 pb-2">Personalización</h3>

                {/* Variantes */}
                <div className="space-y-3 p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-bold text-foreground">Variantes (Opcional)</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">Múltiples opciones con distinto precio (Ej: Simple, Doble, Triple).</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setFormData({ ...formData, variantes: [...formData.variantes, { nombre: '', precio: '' }] })} className="h-9 rounded-xl font-semibold border-zinc-300 dark:border-zinc-700">
                      <Plus className="h-4 w-4 mr-1" /> Agregar Variante
                    </Button>
                  </div>

                  {formData.variantes.length > 0 && (
                    <div className="space-y-3 pt-2">
                       {formData.variantes.map((variante, index) => (
                          <div key={index} className="flex gap-3 items-start">
                             <div className="flex-1 space-y-1">
                                <Input placeholder="Nombre (ej: Doble)" value={variante.nombre} onChange={(e) => {
                                  const nuevas = [...formData.variantes]
                                  nuevas[index].nombre = e.target.value
                                  setFormData({ ...formData, variantes: nuevas })
                                }} className={phantomInputClass} />
                             </div>
                             <div className="flex-1 space-y-1 relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">$</span>
                                <Input placeholder="Precio" type="number" step="0.01" min="0" value={variante.precio} onChange={(e) => {
                                  const nuevas = [...formData.variantes]
                                  nuevas[index].precio = e.target.value
                                  setFormData({ ...formData, variantes: nuevas })
                                }} className={cn(phantomInputClass, "pl-8 font-bold")} />
                             </div>
                             <Button type="button" variant="ghost" size="icon" className="h-14 w-14 shrink-0 rounded-2xl bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/30 dark:hover:bg-red-900/50" onClick={() => {
                                const nuevas = formData.variantes.filter((_, i) => i !== index)
                                setFormData({ ...formData, variantes: nuevas })
                             }}>
                                <Trash2 className="h-5 w-5" />
                             </Button>
                          </div>
                       ))}
                    </div>
                  )}
                </div>

                {/* Ingredientes */}
                <div className="space-y-3 p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-bold text-foreground">Ingredientes</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">El cliente podrá quitarlos (Ej: Sin Cebolla).</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setDialogIngredienteAbierto(true)} className="h-9 rounded-xl font-semibold border-zinc-300 dark:border-zinc-700">
                      <Plus className="h-4 w-4 mr-1" /> Nuevo
                    </Button>
                  </div>

                  {/* Buscador de ingredientes */}
                  {ingredientes.length > 5 && (
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={busquedaIngrediente}
                        onChange={(e) => setBusquedaIngrediente(e.target.value)}
                        placeholder="Buscar ingrediente..."
                        className="h-10 pl-10 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-[#FF7A00] focus:ring-2 focus:ring-[#FF7A00]/20 transition-all text-sm"
                      />
                      {busquedaIngrediente && (
                        <button type="button" onClick={() => setBusquedaIngrediente('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}

                  <div className="max-h-52 overflow-y-auto space-y-1.5 pr-2">
                    {ingredientes.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic py-4 text-center">No hay ingredientes creados.</p>
                    ) : (() => {
                      const ingredientesFiltrados = ingredientes.filter(ing =>
                        ing.nombre.toLowerCase().includes(busquedaIngrediente.toLowerCase())
                      )
                      // Show selected ingredients first, then unselected
                      const ordenados = [...ingredientesFiltrados].sort((a, b) => {
                        const aSelected = ingredientesSeleccionados.includes(a.id) ? 0 : 1
                        const bSelected = ingredientesSeleccionados.includes(b.id) ? 0 : 1
                        return aSelected - bSelected
                      })
                      if (ordenados.length === 0) {
                        return <p className="text-sm text-muted-foreground italic py-4 text-center">No se encontraron ingredientes.</p>
                      }
                      return ordenados.map((ing) => {
                        const isSelected = ingredientesSeleccionados.includes(ing.id)
                        return (
                          <div
                            key={ing.id}
                            className={cn(
                              "flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all",
                              isSelected ? "bg-orange-50/50 dark:bg-orange-950/20 border-[#FF7A00] shadow-sm shadow-orange-500/10" : "bg-white dark:bg-zinc-950 border-transparent hover:border-zinc-200 dark:hover:border-zinc-800"
                            )}
                            onClick={() => {
                              if (isSelected) setIngredientesSeleccionados(prev => prev.filter(id => id !== ing.id))
                              else setIngredientesSeleccionados(prev => [...prev, ing.id])
                            }}
                          >
                            <span className={cn("text-sm font-semibold", isSelected ? "text-[#FF7A00]" : "text-foreground")}>{ing.nombre}</span>
                            {isSelected && <CheckCircle2 className="h-5 w-5 text-[#FF7A00]" />}
                          </div>
                        )
                      })
                    })()}
                  </div>
                </div>

                {/* Agregados */}
                <div className="space-y-3 p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-bold text-foreground">Extras / Agregados</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">Opciones con costo adicional (Ej: Extra Cheddar).</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setDialogAgregadoAbierto(true)} className="h-9 rounded-xl font-semibold border-zinc-300 dark:border-zinc-700">
                      <Plus className="h-4 w-4 mr-1" /> Nuevo
                    </Button>
                  </div>

                  <div className="max-h-52 overflow-y-auto space-y-1.5 pr-2">
                    {agregados.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic py-4 text-center">No hay agregados creados.</p>
                    ) : (
                      agregados.map((ag) => {
                        const isSelected = agregadosSeleccionados.includes(ag.id)
                        return (
                          <div
                            key={ag.id}
                            className={cn(
                              "flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all",
                              isSelected ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500 shadow-sm shadow-emerald-500/10" : "bg-white dark:bg-zinc-950 border-transparent hover:border-zinc-200 dark:hover:border-zinc-800"
                            )}
                            onClick={() => {
                              if (isSelected) setAgregadosSeleccionados(prev => prev.filter(id => id !== ag.id))
                              else setAgregadosSeleccionados(prev => [...prev, ag.id])
                            }}
                          >
                            <span className={cn("text-sm font-semibold", isSelected ? "text-emerald-700 dark:text-emerald-400" : "text-foreground")}>
                              {ag.nombre} <span className="opacity-60 ml-1">+${ag.precio}</span>
                            </span>
                            {isSelected && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* Etiquetas */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-bold text-foreground">Etiquetas visuales</Label>
                    <span className="text-xs text-muted-foreground font-medium bg-zinc-100 dark:bg-zinc-900 px-2 py-1 rounded-md">
                      {etiquetasProducto.length} seleccionadas
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Input id="nuevaEtiqueta" value={nuevaEtiqueta} onChange={(e) => setNuevaEtiqueta(e.target.value)} placeholder="Ej: Vegano, Sin TACC..." disabled={isSubmitting} className="h-12 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border-transparent focus:border-[#FF7A00]" onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const tag = nuevaEtiqueta.trim().toLowerCase()
                        if (tag && !etiquetasProducto.includes(tag)) { setEtiquetasProducto([...etiquetasProducto, tag]); setNuevaEtiqueta('') }
                      }
                    }} />
                    <Button type="button" variant="secondary" className="h-12 px-6 rounded-xl font-bold bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700" disabled={!nuevaEtiqueta.trim() || etiquetasProducto.includes(nuevaEtiqueta.trim().toLowerCase())} onClick={() => {
                      const tag = nuevaEtiqueta.trim().toLowerCase()
                      if (tag && !etiquetasProducto.includes(tag)) { setEtiquetasProducto([...etiquetasProducto, tag]); setNuevaEtiqueta('') }
                    }}>
                      Agregar
                    </Button>
                  </div>
                  {etiquetasProducto.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {etiquetasProducto.map((tag) => (
                        <Badge key={tag} variant="secondary" className="h-8 px-3 gap-2 text-xs font-semibold cursor-pointer hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-950/30 transition-colors bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800" onClick={() => setEtiquetasProducto(etiquetasProducto.filter(t => t !== tag))}>
                          <Tag className="h-3 w-3" /> {tag} <X className="h-3 w-3 opacity-50" />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Sistema de puntos (Si está activo) */}
              {restaurante?.sistemaPuntos && (
                <div className="space-y-4 pt-4">
                  <h3 className="font-bold text-lg border-b border-zinc-100 dark:border-zinc-800 pb-2">Sistema de Puntos</h3>
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-1">
                      <Label htmlFor="puntosGanados" className={phantomLabelClass}>Puntos que otorga</Label>
                      <Input id="puntosGanados" type="number" min="0" step="1" value={formData.puntosGanados} onChange={(e) => setFormData({ ...formData, puntosGanados: e.target.value })} placeholder="0" disabled={isSubmitting} className={phantomInputClass} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="puntosNecesarios" className={phantomLabelClass}>Costo en puntos</Label>
                      <Input id="puntosNecesarios" type="number" min="0" step="1" value={formData.puntosNecesarios} onChange={(e) => setFormData({ ...formData, puntosNecesarios: e.target.value })} placeholder="0" disabled={isSubmitting} className={phantomInputClass} />
                    </div>
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* Footer Sticky */}
          <div className="px-6 sm:px-8 py-5 shrink-0 bg-white dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-3 z-10">
            <Button type="button" variant="ghost" onClick={() => setDialogAbierto(false)} disabled={isSubmitting} className="h-12 px-6 rounded-xl font-semibold text-muted-foreground hover:text-foreground">
              Cancelar
            </Button>
            <Button type="submit" form="productForm" disabled={isSubmitting} className="h-12 px-8 rounded-xl font-bold bg-[#FF7A00] hover:bg-[#E66E00] text-white shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-transform">
              {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
              {productoEditando ? 'Guardar Cambios' : 'Crear Producto'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────
          MODAL: NUEVO INGREDIENTE
      ───────────────────────────────────────────── */}
      <Dialog open={dialogIngredienteAbierto} onOpenChange={setDialogIngredienteAbierto}>
        <DialogContent className="max-w-sm rounded-[32px] p-8 border-zinc-200 dark:border-zinc-800">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold">Nuevo Ingrediente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input value={nuevoIngredienteNombre} onChange={(e) => setNuevoIngredienteNombre(e.target.value)} placeholder="Ej: Tomate, Cheddar..." disabled={isCreandoIngrediente} className={phantomInputClass} onKeyDown={(e) => { if (e.key === 'Enter') crearIngrediente() }} />
            <Button className="w-full h-14 rounded-2xl font-bold bg-[#FF7A00] hover:bg-[#E66E00] text-white" onClick={crearIngrediente} disabled={isCreandoIngrediente || !nuevoIngredienteNombre.trim()}>
              {isCreandoIngrediente ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Crear Ingrediente'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────
          MODAL: NUEVO AGREGADO
      ───────────────────────────────────────────── */}
      <Dialog open={dialogAgregadoAbierto} onOpenChange={setDialogAgregadoAbierto}>
        <DialogContent className="max-w-sm rounded-[32px] p-8 border-zinc-200 dark:border-zinc-800">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold text-emerald-600 dark:text-emerald-500">Nuevo Extra</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input value={nuevoAgregadoNombre} onChange={(e) => setNuevoAgregadoNombre(e.target.value)} placeholder="Nombre (Ej: Doble carne)" disabled={isCreandoAgregado} className={phantomInputClass} />
            <div className="relative">
              <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">$</span>
              <Input type="number" step="0.01" value={nuevoAgregadoPrecio} onChange={(e) => setNuevoAgregadoPrecio(e.target.value)} placeholder="Precio" disabled={isCreandoAgregado} className={cn(phantomInputClass, "pl-9 font-bold")} onKeyDown={(e) => { if (e.key === 'Enter') crearAgregado() }} />
            </div>
            <Button className="w-full h-14 rounded-2xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white" onClick={crearAgregado} disabled={isCreandoAgregado || !nuevoAgregadoNombre.trim() || !nuevoAgregadoPrecio}>
              {isCreandoAgregado ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Crear Extra'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────
          MODAL: GESTIONAR Y CREAR CATEGORÍAS
      ───────────────────────────────────────────── */}
      <Dialog open={dialogGestionCategoriasAbierto} onOpenChange={setDialogGestionCategoriasAbierto}>
        <DialogContent className="max-w-md max-h-[80dvh] overflow-hidden flex flex-col rounded-[32px] p-0 border-zinc-200 dark:border-zinc-800">
          <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 shrink-0 bg-zinc-50/50 dark:bg-zinc-950">
            <DialogTitle className="text-xl font-bold">Gestión de Categorías</DialogTitle>
            <DialogDescription className="mt-1 text-sm">Organiza tu menú. Al eliminar, los productos pasan a "Sin categoría".</DialogDescription>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-2">
            {categorias.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No hay categorías creadas.</p>
            ) : (
              categorias.map((categoria) => (
                <div key={categoria.id} className="flex items-center justify-between p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121212]">
                  <div className="font-semibold text-foreground">{categoria.nombre} <span className="text-xs font-normal text-muted-foreground ml-2">{contarProductosPorCategoria(categoria.id)} ítems</span></div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg" onClick={() => { setCategoriaAEliminar(categoria); setDialogEliminarCategoriaAbierto(true) }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
          <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-950">
            <Button className="w-full h-12 rounded-xl font-bold bg-[#FF7A00] hover:bg-[#E66E00] text-white" onClick={() => { setDialogGestionCategoriasAbierto(false); setDialogCategoriaAbierto(true) }}>
              <Plus className="h-5 w-5 mr-2" /> Nueva Categoría
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Crear Categoría */}
      <Dialog open={dialogCategoriaAbierto} onOpenChange={setDialogCategoriaAbierto}>
        <DialogContent className="max-w-sm rounded-[32px] p-8 border-zinc-200 dark:border-zinc-800">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold">Nueva Categoría</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input value={nuevaCategoriaNombre} onChange={(e) => setNuevaCategoriaNombre(e.target.value)} placeholder="Ej: Pizzas, Bebidas..." disabled={isCreandoCategoria} className={phantomInputClass} onKeyDown={(e) => { if (e.key === 'Enter') crearCategoria() }} />
            <Button className="w-full h-14 rounded-2xl font-bold bg-[#FF7A00] hover:bg-[#E66E00] text-white" onClick={crearCategoria} disabled={isCreandoCategoria || !nuevaCategoriaNombre.trim()}>
              {isCreandoCategoria ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Crear Categoría'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────
          MODALES DE CONFIRMACIÓN (ELIMINAR / TOGGLE)
      ───────────────────────────────────────────── */}
      <Dialog open={dialogEliminarAbierto} onOpenChange={setDialogEliminarAbierto}>
        <DialogContent className="max-w-sm rounded-[32px] p-8 border-none bg-white dark:bg-zinc-900 text-center">
          <div className="h-16 w-16 bg-red-100 dark:bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trash2 className="h-8 w-8 text-red-600 dark:text-red-500" />
          </div>
          <DialogTitle className="text-2xl font-bold mb-2">Eliminar Producto</DialogTitle>
          <DialogDescription className="text-base mb-8">
            ¿Eliminar <strong>{productoAEliminar?.nombre}</strong> permanentemente? Esta acción no se puede deshacer.
          </DialogDescription>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold border-zinc-200 dark:border-zinc-800" onClick={() => setDialogEliminarAbierto(false)}>Cancelar</Button>
            <Button variant="destructive" className="flex-1 h-12 rounded-xl font-bold" onClick={eliminarProducto} disabled={isEliminando}>
              {isEliminando ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Eliminar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogEliminarCategoriaAbierto} onOpenChange={setDialogEliminarCategoriaAbierto}>
        <DialogContent className="max-w-sm rounded-[32px] p-8 border-none bg-white dark:bg-zinc-900 text-center">
          <div className="h-16 w-16 bg-red-100 dark:bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-500" />
          </div>
          <DialogTitle className="text-xl font-bold mb-2">Eliminar Categoría</DialogTitle>
          <DialogDescription className="text-sm mb-8">
            Los {categoriaAEliminar && contarProductosPorCategoria(categoriaAEliminar.id)} productos en <strong>{categoriaAEliminar?.nombre}</strong> quedarán "Sin categoría".
          </DialogDescription>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={() => setDialogEliminarCategoriaAbierto(false)}>Cancelar</Button>
            <Button variant="destructive" className="flex-1 h-12 rounded-xl font-bold" onClick={eliminarCategoria} disabled={isEliminandoCategoria}>
              {isEliminandoCategoria ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Eliminar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogDesactivarAbierto} onOpenChange={setDialogDesactivarAbierto}>
        <DialogContent className="max-w-sm rounded-[32px] p-8 border-none bg-white dark:bg-zinc-900 text-center">
          <div className={cn("h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4", productoADesactivar?.activo ? "bg-orange-100 dark:bg-orange-500/10" : "bg-green-100 dark:bg-green-500/10")}>
            <Power className={cn("h-8 w-8", productoADesactivar?.activo ? "text-orange-600" : "text-green-600")} />
          </div>
          <DialogTitle className="text-2xl font-bold mb-2">
            {productoADesactivar?.activo ? '¿Ocultar producto?' : '¿Activar producto?'}
          </DialogTitle>
          <DialogDescription className="text-base mb-8">
            {productoADesactivar?.activo ? 'El producto desaparecerá del menú público, pero seguirá en el sistema.' : 'El producto volverá a estar disponible para la venta.'}
          </DialogDescription>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold border-zinc-200 dark:border-zinc-800" onClick={() => setDialogDesactivarAbierto(false)}>Cancelar</Button>
            <Button className={cn("flex-1 h-12 rounded-xl font-bold text-white shadow-sm", productoADesactivar?.activo ? "bg-orange-500 hover:bg-orange-600" : "bg-green-500 hover:bg-green-600")} onClick={toggleActivoProducto} disabled={isDesactivando}>
              {isDesactivando ? <Loader2 className="h-5 w-5 animate-spin" /> : (productoADesactivar?.activo ? 'Ocultar' : 'Activar')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Productos