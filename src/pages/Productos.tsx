import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useRestauranteStore } from '@/store/restauranteStore'
import { useAuthStore } from '@/store/authStore'
import { productosApi, ApiError } from '@/lib/api'
import { toast } from 'sonner'
import ImageUpload from '@/components/ImageUpload'
import { Package, Plus, Edit, Trash2, Search, Loader2 } from 'lucide-react'

const Productos = () => {
  const { productos, isLoading, fetchData, restaurante } = useRestauranteStore()
  const token = useAuthStore((state) => state.token)
  const [busqueda, setBusqueda] = useState('')
  const [dialogAbierto, setDialogAbierto] = useState(false)
  const [productoEditando, setProductoEditando] = useState<typeof productos[0] | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    precio: '',
  })
  const [imageBase64, setImageBase64] = useState<string | null>(null)

  useEffect(() => {
    if (!restaurante) {
      fetchData()
    }
  }, [])

  const productosFiltrados = productos.filter(p => 
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.descripcion && p.descripcion.toLowerCase().includes(busqueda.toLowerCase()))
  )

  const abrirDialogNuevo = () => {
    setProductoEditando(null)
    setFormData({ nombre: '', descripcion: '', precio: '' })
    setImageBase64(null)
    setDialogAbierto(true)
  }

  const abrirDialogEditar = (producto: typeof productos[0]) => {
    setProductoEditando(producto)
    setFormData({
      nombre: producto.nombre,
      descripcion: producto.descripcion || '',
      precio: producto.precio.toString(),
    })
    setImageBase64(producto.imagenUrl || null)
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
      if (productoEditando) {
        // Editar producto existente
        await productosApi.update(token, {
          id: productoEditando.id,
          nombre: formData.nombre,
          descripcion: formData.descripcion,
          precio: precio,
          image: imageBase64 && imageBase64.startsWith('data:') ? imageBase64 : undefined,
        })
        toast.success('Producto actualizado', {
          description: 'El producto se actualizó correctamente',
        })
        // Refrescar datos
        await fetchData()
      } else {
        // Crear nuevo producto
        await productosApi.create(token, {
          nombre: formData.nombre,
          descripcion: formData.descripcion,
          precio: precio,
          image: imageBase64 || undefined,
        })

        toast.success('Producto creado', {
          description: 'El producto se creó correctamente',
        })

        // Refrescar datos para obtener el producto con su ID y URL de imagen
        await fetchData()
      }

      setDialogAbierto(false)
      setFormData({ nombre: '', descripcion: '', precio: '' })
      setImageBase64(null)
    } catch (error) {
      console.error('Error al guardar producto:', error)
      if (error instanceof ApiError) {
        toast.error('Error al guardar', {
          description: error.message,
        })
      } else {
        toast.error('Error de conexión', {
          description: 'No se pudo conectar con el servidor',
        })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleActivo = (id: number) => {
    // TODO: Conectar con el backend para cambiar estado
    console.log('Toggle activo:', id)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Productos</h1>
          <p className="text-muted-foreground">
            Gestiona el menú de tu restaurante
          </p>
        </div>
        <Button onClick={abrirDialogNuevo} className="cursor-pointer">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Producto
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar productos..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

{productosFiltrados.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center mb-2">
              {productos.length === 0 ? 'No hay productos registrados' : 'No se encontraron productos'}
            </p>
            {productos.length === 0 && (
              <>
                <p className="text-sm text-muted-foreground text-center mb-4">
                  Agrega productos a tu menú para comenzar
                </p>
                <Button onClick={abrirDialogNuevo} className="cursor-pointer">
                  <Plus className="mr-2 h-4 w-4" />
                  Crear Primer Producto
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {productosFiltrados.map((producto) => (
          <Card 
            key={producto.id}
            className={`transition-all duration-300 hover:shadow-lg ${
              !producto.activo ? 'opacity-60' : ''
            }`}
          >
            <div className="aspect-square w-full overflow-hidden rounded-t-lg bg-muted">
              {producto.imagenUrl ? (
                <img 
                  src={producto.imagenUrl} 
                  alt={producto.nombre}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </div>
            <CardHeader className="p-3 pb-1">
              <div className="flex items-start justify-between gap-1">
                <CardTitle className="text-sm font-medium line-clamp-1">{producto.nombre}</CardTitle>
                <Badge 
                  variant={producto.activo ? 'default' : 'secondary'}
                  className="text-[10px] px-1.5 py-0 h-4 shrink-0"
                >
                  {producto.activo ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
              <CardDescription className="text-xs line-clamp-1">
                {producto.descripcion || 'Sin descripción'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg font-bold text-primary">
                  ${parseFloat(producto.precio).toFixed(2)}
                </span>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-7 text-xs cursor-pointer"
                  onClick={() => abrirDialogEditar(producto)}
                >
                  <Edit className="mr-1 h-3 w-3" />
                  Editar
                </Button>
                <Button
                  className="h-7 w-7 cursor-pointer"
                  variant="outline"
                  size="icon"
                  onClick={() => toggleActivo(producto.id)}
                >
                  {producto.activo ? (
                    <Trash2 className="h-3 w-3" />
                  ) : (
                    <Package className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      )}

      <Dialog open={dialogAbierto} onOpenChange={setDialogAbierto}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="cursor-pointer">
              {productoEditando ? 'Editar Producto' : 'Nuevo Producto'}
            </DialogTitle>
            <DialogDescription className="cursor-pointer">
              {productoEditando 
                ? 'Modifica la información del producto' 
                : 'Agrega un nuevo producto al menú'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre del producto *</Label>
              <Input
                id="nombre"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Ej: Pizza Margarita"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción *</Label>
              <Textarea
                id="descripcion"
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Describe el producto..."
                rows={3}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="precio">Precio ($) *</Label>
              <Input
                id="precio"
                type="number"
                step="0.01"
                min="0.01"
                value={formData.precio}
                onChange={(e) => setFormData({ ...formData, precio: e.target.value })}
                placeholder="0.00"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label>Imagen del producto</Label>
              <ImageUpload
                onImageChange={setImageBase64}
                currentImage={imageBase64}
                maxSize={5}
              />
              <p className="text-xs text-muted-foreground">
                La imagen es opcional. Si no subes una, se mostrará un ícono predeterminado.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer"
                onClick={() => setDialogAbierto(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting} className="cursor-pointer">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {productoEditando ? 'Guardando...' : 'Creando...'}
                  </>
                ) : (
                  productoEditando ? 'Guardar Cambios' : 'Crear Producto'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Productos

