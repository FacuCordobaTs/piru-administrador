import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
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
import { Package, Plus, Edit, Trash2, Search, Loader2, UtensilsCrossed } from 'lucide-react'

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
        toast.success('Producto actualizado')
        await fetchData()
      } else {
        // Crear nuevo producto
        await productosApi.create(token, {
          nombre: formData.nombre,
          descripcion: formData.descripcion,
          precio: precio,
          image: imageBase64 || undefined,
        })
        toast.success('Producto creado')
        await fetchData()
      }

      setDialogAbierto(false)
      setFormData({ nombre: '', descripcion: '', precio: '' })
      setImageBase64(null)
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

  const toggleActivo = (id: number) => {
    console.log('Toggle activo:', id)
    // Aquí iría la llamada a la API
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
                    >
                      <Edit className="h-4 w-4" />
                      <span className="sr-only">Editar</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 ${producto.activo ? 'hover:bg-destructive/10 hover:text-destructive' : 'hover:bg-green-100 hover:text-green-600'}`}
                      onClick={() => toggleActivo(producto.id)}
                    >
                      {producto.activo ? (
                        <Trash2 className="h-4 w-4" />
                      ) : (
                        <Package className="h-4 w-4" />
                      )}
                      <span className="sr-only">Cambiar estado</span>
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
              <Label>Foto del plato</Label>
              <ImageUpload
                onImageChange={setImageBase64}
                currentImage={imageBase64}
                maxSize={5}
              />
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
    </div>
  )
}

export default Productos