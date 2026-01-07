import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useRestauranteStore } from '@/store/restauranteStore'
import { useAuthStore } from '@/store/authStore'
import { productosApi, categoriasApi, ingredientesApi, ApiError } from '@/lib/api'
import { toast } from 'sonner'
import ImageUpload from '@/components/ImageUpload'
import { Package, Plus, Edit, Trash2, Search, Loader2, UtensilsCrossed, X, Power, Settings2, AlertTriangle } from 'lucide-react'

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
  }>({
    nombre: '',
    descripcion: '',
    precio: '',
    categoriaId: '0', // Usar '0' en lugar de '' para evitar error de Radix UI
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

  useEffect(() => {
    if (!restaurante) {
      fetchData()
    }
  }, [])

  // Cargar ingredientes
  useEffect(() => {
    const cargarIngredientes = async () => {
      if (!token) return
      try {
        const response = await ingredientesApi.getAll(token) as {
          success: boolean
          ingredientes?: Array<{ id: number; nombre: string }>
        }
        if (response.success && response.ingredientes) {
          setIngredientes(response.ingredientes)
        }
      } catch (error) {
        console.error('Error cargando ingredientes:', error)
      }
    }
    cargarIngredientes()
  }, [token])

  const crearIngrediente = async () => {
    if (!token || !nuevoIngredienteNombre.trim()) {
      toast.error('El nombre del ingrediente es requerido')
      return
    }

    setIsCreandoIngrediente(true)
    try {
      const response = await ingredientesApi.create(token, {
        nombre: nuevoIngredienteNombre.trim()
      }) as { success: boolean; data?: any }

      if (response.success) {
        toast.success('Ingrediente creado')
        setNuevoIngredienteNombre('')
        setDialogIngredienteAbierto(false)
        // Recargar ingredientes
        const ingredientesResponse = await ingredientesApi.getAll(token) as {
          success: boolean
          ingredientes?: Array<{ id: number; nombre: string }>
        }
        if (ingredientesResponse.success && ingredientesResponse.ingredientes) {
          setIngredientes(ingredientesResponse.ingredientes)
        }
      }
    } catch (error) {
      console.error('Error al crear ingrediente:', error)
      if (error instanceof ApiError) {
        toast.error('Error al crear ingrediente', { description: error.message })
      } else {
        toast.error('Error de conexión')
      }
    } finally {
      setIsCreandoIngrediente(false)
    }
  }

  const crearCategoria = async () => {
    if (!token || !nuevaCategoriaNombre.trim()) {
      toast.error('El nombre de la categoría es requerido')
      return
    }

    setIsCreandoCategoria(true)
    try {
      const response = await categoriasApi.create(token, {
        nombre: nuevaCategoriaNombre.trim()
      }) as { success: boolean; data?: any }

      if (response.success) {
        toast.success('Categoría creada')
        setNuevaCategoriaNombre('')
        setDialogCategoriaAbierto(false)
        // Recargar categorías
        const categoriasResponse = await categoriasApi.getAll(token) as {
          success: boolean
          categorias?: any[]
        }
        if (categoriasResponse.success && categoriasResponse.categorias) {
          setCategorias(categoriasResponse.categorias)
        }
      }
    } catch (error) {
      console.error('Error al crear categoría:', error)
      if (error instanceof ApiError) {
        toast.error('Error al crear categoría', { description: error.message })
      } else {
        toast.error('Error de conexión')
      }
    } finally {
      setIsCreandoCategoria(false)
    }
  }

  const eliminarCategoria = async () => {
    if (!token || !categoriaAEliminar) {
      toast.error('Error: No se puede eliminar la categoría')
      return
    }

    setIsEliminandoCategoria(true)
    try {
      const response = await categoriasApi.delete(token, categoriaAEliminar.id) as { 
        success: boolean
        message?: string
        productosActualizados?: number
      }
      
      if (response.success) {
        const mensaje = response.productosActualizados && response.productosActualizados > 0
          ? `Categoría eliminada. ${response.productosActualizados} producto(s) movido(s) a "Sin categoría"`
          : 'Categoría eliminada correctamente'
        toast.success(mensaje)
        setDialogEliminarCategoriaAbierto(false)
        setCategoriaAEliminar(null)
        // Recargar datos para actualizar categorías y productos
        await fetchData()
      }
    } catch (error) {
      console.error('Error al eliminar categoría:', error)
      if (error instanceof ApiError) {
        toast.error('Error al eliminar categoría', { description: error.message })
      } else {
        toast.error('Error de conexión')
      }
    } finally {
      setIsEliminandoCategoria(false)
    }
  }

  // Contar productos por categoría
  const contarProductosPorCategoria = (categoriaId: number) => {
    return productos.filter(p => p.categoriaId === categoriaId).length
  }

  const productosFiltrados = productos.filter(p => 
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.descripcion && p.descripcion.toLowerCase().includes(busqueda.toLowerCase()))
  )

  const abrirDialogNuevo = () => {
    setProductoEditando(null)
    setFormData({ nombre: '', descripcion: '', precio: '', categoriaId: '0' })
    setImageBase64(null)
    setIngredientesSeleccionados([])
    setDialogAbierto(true)
  }

  const abrirDialogEditar = async (producto: typeof productos[0]) => {
    setProductoEditando(producto)
    setFormData({
      nombre: producto.nombre,
      descripcion: producto.descripcion || '',
      precio: producto.precio.toString(),
      categoriaId: producto.categoriaId ? producto.categoriaId.toString() : '0',
    })
    setImageBase64(producto.imagenUrl || null)
    
    // Cargar ingredientes del producto
    if (token) {
      try {
        const response = await ingredientesApi.getByProducto(token, producto.id) as {
          success: boolean
          ingredientes?: Array<{ id: number; nombre: string }>
        }
        if (response.success && response.ingredientes) {
          setIngredientesSeleccionados(response.ingredientes.map(ing => ing.id))
        } else {
          setIngredientesSeleccionados([])
        }
      } catch (error) {
        console.error('Error cargando ingredientes del producto:', error)
        setIngredientesSeleccionados([])
      }
    }
    
    setDialogAbierto(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!token) {
      toast.error('No hay sesión activa')
      return
    }

    // Validaciones
    if (!formData.nombre.trim()) {
      toast.error('El nombre es requerido')
      return
    }

    if (!formData.descripcion.trim()) {
      toast.error('La descripción es requerida')
      return
    }

    const precio = parseFloat(formData.precio)
    if (isNaN(precio) || precio <= 0) {
      toast.error('El precio debe ser mayor a 0')
      return
    }

    setIsSubmitting(true)

    try {
      // Convertir categoriaId: si es '0' o vacío, usar undefined/null
      const parsedCategoriaId = parseInt(formData.categoriaId)
      const categoriaId = (parsedCategoriaId && parsedCategoriaId > 0) 
        ? parsedCategoriaId 
        : undefined
      
      if (productoEditando) {
        // Editar producto existente
        await productosApi.update(token, {
          id: productoEditando.id,
          nombre: formData.nombre,
          descripcion: formData.descripcion,
          precio: precio,
          image: imageBase64 && imageBase64.startsWith('data:') ? imageBase64 : undefined,
          categoriaId: categoriaId !== undefined ? categoriaId : null,
          ingredienteIds: ingredientesSeleccionados,
        })
        toast.success('Producto actualizado')
        await fetchData()
      } else {
        // Crear nuevo producto
        await productosApi.create(token, {
          nombre: formData.nombre,
          descripcion: formData.descripcion,
          precio: precio,
          image: imageBase64 || undefined,
          categoriaId: categoriaId,
          ingredienteIds: ingredientesSeleccionados,
        })
        toast.success('Producto creado')
        await fetchData()
      }

      setDialogAbierto(false)
      setFormData({ nombre: '', descripcion: '', precio: '', categoriaId: '0' })
      setImageBase64(null)
      setIngredientesSeleccionados([])
    } catch (error) {
      console.error('Error al guardar producto:', error)
      if (error instanceof ApiError) {
        toast.error('Error al guardar', { description: error.message })
      } else {
        toast.error('Error de conexión')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const abrirDialogEliminar = (producto: typeof productos[0]) => {
    setProductoAEliminar(producto)
    setDialogEliminarAbierto(true)
  }

  const eliminarProducto = async () => {
    if (!token || !productoAEliminar) {
      toast.error('Error: No se puede eliminar el producto')
      return
    }

    setIsEliminando(true)
    try {
      await productosApi.delete(token, productoAEliminar.id)
      toast.success('Producto eliminado correctamente')
      setDialogEliminarAbierto(false)
      setProductoAEliminar(null)
      await fetchData()
    } catch (error) {
      console.error('Error al eliminar producto:', error)
      if (error instanceof ApiError) {
        // Verificar si el error es por pedidos asociados
        const errorMessage = error.message || error.response?.message || ''
        if (errorMessage.includes('pedidos asociados') || errorMessage.includes('pedido')) {
          toast.error('No se puede eliminar el producto', { 
            description: 'Este producto tiene pedidos asociados. Desactívalo en su lugar para ocultarlo del menú sin perder el historial.' 
          })
        } else {
          toast.error('Error al eliminar producto', { description: errorMessage })
        }
      } else {
        toast.error('Error de conexión')
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
    if (!token || !productoADesactivar) {
      toast.error('Error: No se puede cambiar el estado del producto')
      return
    }

    const nuevoEstado = !productoADesactivar.activo
    setIsDesactivando(true)
    try {
      await productosApi.update(token, {
        id: productoADesactivar.id,
        activo: nuevoEstado
      })
      toast.success(nuevoEstado ? 'Producto activado correctamente' : 'Producto desactivado correctamente')
      setDialogDesactivarAbierto(false)
      setProductoADesactivar(null)
      await fetchData()
    } catch (error) {
      console.error('Error al cambiar estado del producto:', error)
      if (error instanceof ApiError) {
        toast.error('Error al cambiar estado del producto', { description: error.message })
      } else {
        toast.error('Error de conexión')
      }
    } finally {
      setIsDesactivando(false)
    }
  }

  if (isLoading) {
    return (
      <div className="w-full max-w-7xl lg:max-w-[1600px] xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="w-full max-w-7xl lg:max-w-[1600px] xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 space-y-4 md:space-y-6 animate-in fade-in duration-500 pb-20 md:pb-0">
      
      {/* Header Sticky */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 py-4 md:py-6 md:static md:bg-transparent -mx-4 sm:-mx-6 lg:-mx-8 xl:-mx-12 px-4 sm:px-6 lg:px-8 xl:px-12 md:mx-0 md:px-0 border-b md:border-none">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Productos</h1>
              <p className="text-sm md:text-base text-muted-foreground">
                Gestiona el menú de tu restaurante
              </p>
            </div>
            {/* Botón Nuevo en Mobile (Compacto) */}
            <Button size="sm" onClick={abrirDialogNuevo} className="md:hidden h-8">
              <Plus className="mr-1 h-4 w-4" />
              Nuevo
            </Button>
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:flex-none">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar productos..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-10 w-full md:w-64"
              />
            </div>
            {/* Botón Nuevo en Desktop */}
            <Button onClick={abrirDialogNuevo} className="hidden md:flex cursor-pointer">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Producto
            </Button>
          </div>
        </div>
      </div>

      {productosFiltrados.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <UtensilsCrossed className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <p className="text-muted-foreground text-center mb-4">
              {busqueda ? 'No se encontraron productos' : 'No hay productos registrados'}
            </p>
            {productos.length === 0 && !busqueda && (
              <Button onClick={abrirDialogNuevo} variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Crear Primer Producto
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        /* GRID RESPONSIVO OPTIMIZADO */
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {productosFiltrados.map((producto) => (
            <Card 
              key={producto.id}
              className={`
                group overflow-hidden transition-all duration-300 hover:shadow-md border-muted
                flex flex-row md:flex-col
                ${!producto.activo ? 'opacity-60 bg-muted/20' : ''}
              `}
            >
              {/* IMAGEN: 
                  - Mobile: Cuadrada a la izquierda (w-28 o w-32)
                  - Desktop: Aspecto video arriba
              */}
              <div className="w-32 h-32 md:w-full md:h-48 md:aspect-video shrink-0 bg-muted relative overflow-hidden">
                {producto.imagenUrl ? (
                  <img 
                    src={producto.imagenUrl} 
                    alt={producto.nombre}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-secondary/50">
                    <Package className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                )}
                
                {/* Badge de estado (Desktop y Mobile superpuesto) */}
                <div className="absolute top-2 left-2 md:left-auto md:right-2">
                   <Badge 
                    variant={producto.activo ? 'default' : 'secondary'}
                    className={`shadow-sm backdrop-blur-sm h-5 text-[10px] px-1.5 ${producto.activo ? 'bg-primary/90' : 'bg-secondary/90'}`}
                  >
                    {producto.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
              </div>

              {/* CONTENIDO */}
              <div className="flex-1 flex flex-col justify-between p-3 min-w-0">
                <div className="space-y-1">
                  <h3 className="font-semibold text-base leading-tight truncate">
                    {producto.nombre}
                  </h3>
                  
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {producto.descripcion || 'Sin descripción'}
                  </p>
                </div>

                {/* Footer: Precio + Botones */}
                <div className="flex items-center justify-between mt-3">
                  <span className="text-lg font-bold text-primary">
                    ${parseFloat(producto.precio).toFixed(0)}
                  </span>
                  
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                      onClick={() => abrirDialogEditar(producto)}
                      title="Editar producto"
                    >
                      <Edit className="h-4 w-4" />
                      <span className="sr-only">Editar</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 ${
                        producto.activo 
                          ? 'hover:bg-orange-100 hover:text-orange-600 dark:hover:bg-orange-900/20 dark:hover:text-orange-400'
                          : 'hover:bg-green-100 hover:text-green-600 dark:hover:bg-green-900/20 dark:hover:text-green-400'
                      }`}
                      onClick={() => abrirDialogToggleActivo(producto)}
                      title={producto.activo ? 'Desactivar producto' : 'Activar producto'}
                    >
                      {producto.activo ? (
                        <Package className="h-4 w-4" />
                      ) : (
                        <Power className="h-4 w-4" />
                      )}
                      <span className="sr-only">{producto.activo ? 'Desactivar' : 'Activar'}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 ${producto.activo ? 'hover:bg-destructive/10 hover:text-destructive' : 'hover:bg-green-100 hover:text-green-600'}`}
                      onClick={() => producto.activo ? abrirDialogEliminar(producto) : null}
                      disabled={!producto.activo}
                      title={producto.activo ? 'Eliminar producto' : 'Producto inactivo'}
                    >
                      {producto.activo ? (
                        <Trash2 className="h-4 w-4" />
                      ) : (
                        <Package className="h-4 w-4" />
                      )}
                      <span className="sr-only">{producto.activo ? 'Eliminar' : 'Inactivo'}</span>
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* FAB (Floating Action Button) para Mobile */}
      <Button
        className="md:hidden fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-xl z-50 animate-in zoom-in duration-300"
        onClick={abrirDialogNuevo}
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Dialog Formulario */}
      <Dialog open={dialogAbierto} onOpenChange={setDialogAbierto}>
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto mx-4 rounded-lg">
          <DialogHeader>
            <DialogTitle>
              {productoEditando ? 'Editar Producto' : 'Nuevo Producto'}
            </DialogTitle>
            <DialogDescription>
              {productoEditando 
                ? 'Modifica los detalles del plato' 
                : 'Agrega un nuevo plato a tu menú'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                id="nombre"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Ej: Hamburguesa Doble"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Textarea
                id="descripcion"
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Ingredientes, detalles..."
                rows={3}
                required
                disabled={isSubmitting}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="precio">Precio</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="precio"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.precio}
                  onChange={(e) => setFormData({ ...formData, precio: e.target.value })}
                  placeholder="0.00"
                  required
                  disabled={isSubmitting}
                  className="pl-7"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="categoria">Categoría</Label>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDialogGestionCategoriasAbierto(true)}
                    className="h-7 text-xs"
                    title="Gestionar categorías"
                  >
                    <Settings2 className="h-3 w-3 mr-1" />
                    Gestionar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDialogCategoriaAbierto(true)}
                    className="h-7 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Nueva
                  </Button>
                </div>
              </div>
              <Select
                value={formData.categoriaId}
                onValueChange={(value) => setFormData({ ...formData, categoriaId: value })}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoría (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sin categoría</SelectItem>
                  {categorias.map((categoria) => (
                    <SelectItem key={categoria.id} value={categoria.id.toString()}>
                      {categoria.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Foto del plato</Label>
              <ImageUpload
                onImageChange={setImageBase64}
                currentImage={imageBase64}
                maxSize={5}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="ingredientes">Ingredientes</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDialogIngredienteAbierto(true)}
                  className="h-7 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Nuevo
                </Button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                {ingredientes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay ingredientes. Crea uno nuevo.
                  </p>
                ) : (
                  ingredientes.map((ingrediente) => {
                    const estaSeleccionado = ingredientesSeleccionados.includes(ingrediente.id)
                    return (
                      <div
                        key={ingrediente.id}
                        className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-colors ${
                          estaSeleccionado
                            ? 'bg-primary/10 border-primary'
                            : 'bg-background hover:bg-muted'
                        }`}
                        onClick={() => {
                          if (estaSeleccionado) {
                            setIngredientesSeleccionados(ingredientesSeleccionados.filter(id => id !== ingrediente.id))
                          } else {
                            setIngredientesSeleccionados([...ingredientesSeleccionados, ingrediente.id])
                          }
                        }}
                      >
                        <span className="text-sm font-medium">{ingrediente.nombre}</span>
                        {estaSeleccionado && (
                          <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                            <X className="h-3 w-3 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
              {ingredientesSeleccionados.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {ingredientesSeleccionados.length} ingrediente{ingredientesSeleccionados.length !== 1 ? 's' : ''} seleccionado{ingredientesSeleccionados.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t sticky bottom-0 bg-background pb-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDialogAbierto(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog para crear nuevo ingrediente */}
      <Dialog open={dialogIngredienteAbierto} onOpenChange={setDialogIngredienteAbierto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo Ingrediente</DialogTitle>
            <DialogDescription>
              Crea un nuevo ingrediente para usar en tus productos
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="ingredienteNombre">Nombre del ingrediente</Label>
              <Input
                id="ingredienteNombre"
                value={nuevoIngredienteNombre}
                onChange={(e) => setNuevoIngredienteNombre(e.target.value)}
                placeholder="Ej: Ketchup, Cebolla, Queso..."
                required
                disabled={isCreandoIngrediente}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isCreandoIngrediente) {
                    e.preventDefault()
                    crearIngrediente()
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setDialogIngredienteAbierto(false)
                  setNuevoIngredienteNombre('')
                }}
                disabled={isCreandoIngrediente}
              >
                Cancelar
              </Button>
              <Button 
                type="button" 
                onClick={crearIngrediente}
                disabled={isCreandoIngrediente || !nuevoIngredienteNombre.trim()}
              >
                {isCreandoIngrediente ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  'Crear'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para crear nueva categoría */}
      <Dialog open={dialogCategoriaAbierto} onOpenChange={setDialogCategoriaAbierto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Categoría</DialogTitle>
            <DialogDescription>
              Crea una nueva categoría para organizar tus productos
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="categoriaNombre">Nombre de la categoría</Label>
              <Input
                id="categoriaNombre"
                value={nuevaCategoriaNombre}
                onChange={(e) => setNuevaCategoriaNombre(e.target.value)}
                placeholder="Ej: Bebidas, Pizzas, Hamburguesas..."
                required
                disabled={isCreandoCategoria}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isCreandoCategoria) {
                    e.preventDefault()
                    crearCategoria()
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setDialogCategoriaAbierto(false)
                  setNuevaCategoriaNombre('')
                }}
                disabled={isCreandoCategoria}
              >
                Cancelar
              </Button>
              <Button 
                type="button" 
                onClick={crearCategoria}
                disabled={isCreandoCategoria || !nuevaCategoriaNombre.trim()}
              >
                {isCreandoCategoria ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  'Crear'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirmar Eliminación */}
      <Dialog open={dialogEliminarAbierto} onOpenChange={setDialogEliminarAbierto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>¿Eliminar producto?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. El producto <strong>{productoAEliminar?.nombre}</strong> será eliminado permanentemente, incluyendo su imagen.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDialogEliminarAbierto(false)
                setProductoAEliminar(null)
              }}
              disabled={isEliminando}
            >
              Cancelar
            </Button>
            <Button 
              type="button" 
              onClick={eliminarProducto}
              disabled={isEliminando}
              variant="destructive"
            >
              {isEliminando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Eliminar'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirmar Activar/Desactivar */}
      <Dialog open={dialogDesactivarAbierto} onOpenChange={setDialogDesactivarAbierto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {productoADesactivar?.activo ? '¿Desactivar producto?' : '¿Activar producto?'}
            </DialogTitle>
            <DialogDescription>
              {productoADesactivar?.activo ? (
                <>
                  El producto <strong>{productoADesactivar?.nombre}</strong> se ocultará del menú pero se mantendrá en el sistema. Podrás reactivarlo más tarde.
                </>
              ) : (
                <>
                  El producto <strong>{productoADesactivar?.nombre}</strong> volverá a estar visible en el menú para los clientes.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDialogDesactivarAbierto(false)
                setProductoADesactivar(null)
              }}
              disabled={isDesactivando}
            >
              Cancelar
            </Button>
            <Button 
              type="button" 
              onClick={toggleActivoProducto}
              disabled={isDesactivando}
              className={productoADesactivar?.activo 
                ? 'bg-orange-500 hover:bg-orange-600 text-white'
                : 'bg-green-500 hover:bg-green-600 text-white'
              }
            >
              {isDesactivando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {productoADesactivar?.activo ? 'Desactivando...' : 'Activando...'}
                </>
              ) : (
                productoADesactivar?.activo ? 'Desactivar' : 'Activar'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Gestionar Categorías */}
      <Dialog open={dialogGestionCategoriasAbierto} onOpenChange={setDialogGestionCategoriasAbierto}>
        <DialogContent className="max-w-md max-h-[80dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gestionar Categorías</DialogTitle>
            <DialogDescription>
              Administra las categorías de tu menú. Al eliminar una categoría, los productos asociados pasarán a "Sin categoría".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            {categorias.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No hay categorías creadas</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    setDialogGestionCategoriasAbierto(false)
                    setDialogCategoriaAbierto(true)
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Crear primera categoría
                </Button>
              </div>
            ) : (
              <>
                {categorias.map((categoria) => {
                  const cantidadProductos = contarProductosPorCategoria(categoria.id)
                  return (
                    <div
                      key={categoria.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{categoria.nombre}</p>
                        <p className="text-xs text-muted-foreground">
                          {cantidadProductos} producto{cantidadProductos !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                        onClick={() => {
                          setCategoriaAEliminar(categoria)
                          setDialogEliminarCategoriaAbierto(true)
                        }}
                        title="Eliminar categoría"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}
                <div className="pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setDialogGestionCategoriasAbierto(false)
                      setDialogCategoriaAbierto(true)
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Nueva categoría
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirmar Eliminación de Categoría */}
      <Dialog open={dialogEliminarCategoriaAbierto} onOpenChange={setDialogEliminarCategoriaAbierto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              ¿Eliminar categoría?
            </DialogTitle>
            <DialogDescription className="space-y-2">
              <span className="block">
                Estás a punto de eliminar la categoría <strong>"{categoriaAEliminar?.nombre}"</strong>.
              </span>
              {categoriaAEliminar && contarProductosPorCategoria(categoriaAEliminar.id) > 0 && (
                <span className="block text-amber-600 dark:text-amber-400">
                  ⚠️ Esta categoría tiene {contarProductosPorCategoria(categoriaAEliminar.id)} producto(s) asociado(s). 
                  Estos productos pasarán a "Sin categoría".
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDialogEliminarCategoriaAbierto(false)
                setCategoriaAEliminar(null)
              }}
              disabled={isEliminandoCategoria}
            >
              Cancelar
            </Button>
            <Button 
              type="button" 
              onClick={eliminarCategoria}
              disabled={isEliminandoCategoria}
              variant="destructive"
            >
              {isEliminandoCategoria ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Eliminar'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Productos