import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Package, Plus, Edit, Trash2, Search } from 'lucide-react'

// Datos de ejemplo (simulados)
const productosEjemplo = [
  {
    id: 1,
    nombre: 'Pizza Margarita',
    descripcion: 'Pizza clásica con tomate, mozzarella y albahaca',
    precio: 12.50,
    imagenUrl: 'https://via.placeholder.com/200',
    activo: true
  },
  {
    id: 2,
    nombre: 'Hamburguesa Clásica',
    descripcion: 'Carne, lechuga, tomate, cebolla y salsas especiales',
    precio: 8.75,
    imagenUrl: 'https://via.placeholder.com/200',
    activo: true
  },
  {
    id: 3,
    nombre: 'Coca Cola',
    descripcion: 'Refresco de 500ml',
    precio: 2.50,
    imagenUrl: 'https://via.placeholder.com/200',
    activo: true
  },
  {
    id: 4,
    nombre: 'Papas Fritas',
    descripcion: 'Porción grande de papas fritas caseras',
    precio: 4.00,
    imagenUrl: 'https://via.placeholder.com/200',
    activo: true
  },
  {
    id: 5,
    nombre: 'Ensalada César',
    descripcion: 'Lechuga, pollo, crutones y aderezo césar',
    precio: 9.50,
    imagenUrl: 'https://via.placeholder.com/200',
    activo: false
  },
]

const Productos = () => {
  const [productos, setProductos] = useState(productosEjemplo)
  const [busqueda, setBusqueda] = useState('')
  const [dialogAbierto, setDialogAbierto] = useState(false)
  const [productoEditando, setProductoEditando] = useState<typeof productosEjemplo[0] | null>(null)
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    precio: '',
    imagenUrl: ''
  })

  const productosFiltrados = productos.filter(p => 
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.descripcion.toLowerCase().includes(busqueda.toLowerCase())
  )

  const abrirDialogNuevo = () => {
    setProductoEditando(null)
    setFormData({ nombre: '', descripcion: '', precio: '', imagenUrl: '' })
    setDialogAbierto(true)
  }

  const abrirDialogEditar = (producto: typeof productosEjemplo[0]) => {
    setProductoEditando(producto)
    setFormData({
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      precio: producto.precio.toString(),
      imagenUrl: producto.imagenUrl
    })
    setDialogAbierto(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Aquí se conectaría con el backend
    if (productoEditando) {
      setProductos(productos.map(p => 
        p.id === productoEditando.id 
          ? { ...p, ...formData, precio: parseFloat(formData.precio) }
          : p
      ))
    } else {
      const nuevoProducto = {
        id: productos.length + 1,
        ...formData,
        precio: parseFloat(formData.precio),
        activo: true
      }
      setProductos([...productos, nuevoProducto as any])
    }
    setDialogAbierto(false)
  }

  const toggleActivo = (id: number) => {
    setProductos(productos.map(p => 
      p.id === id ? { ...p, activo: !p.activo } : p
    ))
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
        <Button onClick={abrirDialogNuevo}>
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {productosFiltrados.map((producto) => (
          <Card 
            key={producto.id}
            className={`transition-all duration-300 hover:shadow-lg ${
              !producto.activo ? 'opacity-60' : ''
            }`}
          >
            <div className="aspect-video w-full overflow-hidden rounded-t-lg bg-muted">
              <img 
                src={producto.imagenUrl} 
                alt={producto.nombre}
                className="w-full h-full object-cover"
              />
            </div>
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{producto.nombre}</CardTitle>
                <Badge variant={producto.activo ? 'default' : 'secondary'}>
                  {producto.activo ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
              <CardDescription className="line-clamp-2">
                {producto.descripcion}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <span className="text-2xl font-bold text-primary">
                  ${producto.precio.toFixed(2)}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => abrirDialogEditar(producto)}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleActivo(producto.id)}
                >
                  {producto.activo ? (
                    <Trash2 className="h-4 w-4" />
                  ) : (
                    <Package className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {productosFiltrados.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No se encontraron productos</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogAbierto} onOpenChange={setDialogAbierto}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {productoEditando ? 'Editar Producto' : 'Nuevo Producto'}
            </DialogTitle>
            <DialogDescription>
              {productoEditando 
                ? 'Modifica la información del producto' 
                : 'Agrega un nuevo producto al menú'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre del producto</Label>
              <Input
                id="nombre"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Ej: Pizza Margarita"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Textarea
                id="descripcion"
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Describe el producto..."
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="precio">Precio</Label>
                <Input
                  id="precio"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.precio}
                  onChange={(e) => setFormData({ ...formData, precio: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="imagenUrl">URL de imagen</Label>
                <Input
                  id="imagenUrl"
                  value={formData.imagenUrl}
                  onChange={(e) => setFormData({ ...formData, imagenUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogAbierto(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">
                {productoEditando ? 'Guardar Cambios' : 'Crear Producto'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Productos

