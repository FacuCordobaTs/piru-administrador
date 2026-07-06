import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useRestauranteStore } from '@/store/restauranteStore'
import { useAuthStore } from '@/store/authStore'
import { productosApi, categoriasApi, ingredientesApi, agregadosApi } from '@/lib/api'
import { toast } from 'sonner'
import ImageUpload from '@/components/ImageUpload'
import { cn } from '@/lib/utils'
import {
  Plus, Edit, Trash2, Search, Loader2, UtensilsCrossed, CheckCircle2,
  X, AlertTriangle, Percent, Image as ImageIcon,
  ChevronDown, GripVertical, ArrowUpDown, Check
} from 'lucide-react'

// ─────────────────────────────────────────────
// Helper: tiempo restante del descuento
// ─────────────────────────────────────────────
function formatTimeLeft(fechaFin: string | Date | null): string | null {
  if (!fechaFin) return null
  const now = Date.now()
  const end = new Date(fechaFin).getTime()
  const diff = end - now
  if (diff <= 0) return null
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return 'menos de 1h'
  if (hours < 24) return `${hours}h restantes`
  return `Vence ${new Date(fechaFin).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}`
}

// ─────────────────────────────────────────────
// Estilos base
// ─────────────────────────────────────────────
const panelInputClass = "h-12 rounded-lg bg-zinc-800 border-transparent focus:border-white/20 focus:ring-2 focus:ring-white/10 transition-all text-base px-4 w-full"
const panelLabelClass = "text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5 block"
const phantomInputClass = "h-14 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border-transparent focus:bg-background focus:border-[#FF7A00] focus:ring-2 focus:ring-[#FF7A00]/20 transition-all text-base px-5 w-full"

const Productos = () => {
  const { productos, categorias, isLoading, fetchData, restaurante, setCategorias } = useRestauranteStore()
  const token = useAuthStore((state) => state.token)
  const [busqueda, setBusqueda] = useState('')

  // ─── Panel states ───
  const [panelProductoId, setPanelProductoId] = useState<number | null>(null)
  const [activePanelType, setActivePanelType] = useState<'product' | 'discounts' | 'extras' | null>(null)
  const [panelModo, setPanelModo] = useState<'vista' | 'edicion'>('vista')
  const [panelNuevo, setPanelNuevo] = useState(false)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false)
  const [seccionesAbiertas, setSeccionesAbiertas] = useState<Set<string>>(new Set(['info']))
  const [isDirty, setIsDirty] = useState(false)
  const [isTogglingActivo, setIsTogglingActivo] = useState(false)
  const [isEliminando, setIsEliminando] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Derived
  const panelProducto = panelProductoId !== null ? productos.find(p => p.id === panelProductoId) ?? null : null

  // ─── Form state ───
  const [formData, setFormData] = useState<{
    nombre: string
    descripcion: string
    precio: string
    categoriaId: string
    puntosGanados: string
    puntosNecesarios: string
    descuento: string
    descuentoFechaInicio: string
    descuentoFechaFin: string
    variantes: Array<{ id?: number, nombre: string, precio: string }>
  }>({
    nombre: '',
    descripcion: '',
    precio: '',
    categoriaId: '0',
    puntosGanados: '',
    puntosNecesarios: '',
    descuento: '',
    descuentoFechaInicio: '',
    descuentoFechaFin: '',
    variantes: []
  })
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [etiquetasProducto, setEtiquetasProducto] = useState<string[]>([])

  // ─── Descuentos masivos ───
  const [descuentoMasivoPct, setDescuentoMasivoPct] = useState('')
  const [descuentoMasivoInicio, setDescuentoMasivoInicio] = useState('')
  const [descuentoMasivoFin, setDescuentoMasivoFin] = useState('')
  const [productosDescuentoSeleccionados, setProductosDescuentoSeleccionados] = useState<number[]>([])
  const [busquedaDescuento, setBusquedaDescuento] = useState('')
  const [aplicandoDescuento, setIsAplicandoDescuento] = useState(false)

  // ─── Categorias ───
  const [dialogCategoriaAbierto, setDialogCategoriaAbierto] = useState(false)
  const [nuevaCategoriaNombre, setNuevaCategoriaNombre] = useState('')
  const [isCreandoCategoria, setIsCreandoCategoria] = useState(false)
  const [dialogGestionCategoriasAbierto, setDialogGestionCategoriasAbierto] = useState(false)
  const [dialogEliminarCategoriaAbierto, setDialogEliminarCategoriaAbierto] = useState(false)
  const [categoriaAEliminar, setCategoriaAEliminar] = useState<typeof categorias[0] | null>(null)
  const [isEliminandoCategoria, setIsEliminandoCategoria] = useState(false)

  // ─── Ingredientes ───
  const [ingredientes, setIngredientes] = useState<Array<{ id: number; nombre: string }>>([])
  const [ingredientesSeleccionados, setIngredientesSeleccionados] = useState<number[]>([])
  const [nuevoIngredienteNombre, setNuevoIngredienteNombre] = useState('')
  const [dialogIngredienteAbierto, setDialogIngredienteAbierto] = useState(false)
  const [isCreandoIngrediente, setIsCreandoIngrediente] = useState(false)
  const [busquedaIngrediente, setBusquedaIngrediente] = useState('')

  // ─── Agregados ───
  const [agregados, setAgregados] = useState<Array<{ id: number; nombre: string; precio: string }>>([])
  const [agregadosSeleccionados, setAgregadosSeleccionados] = useState<number[]>([])
  const [nuevoAgregadoNombre, setNuevoAgregadoNombre] = useState('')
  const [nuevoAgregadoPrecio, setNuevoAgregadoPrecio] = useState('')
  const [dialogAgregadoAbierto, setDialogAgregadoAbierto] = useState(false)
  const [isCreandoAgregado, setIsCreandoAgregado] = useState(false)
  const [dialogEliminarAgregadoAbierto, setDialogEliminarAgregadoAbierto] = useState(false)
  const [agregadoAEliminar, setAgregadoAEliminar] = useState<{ id: number; nombre: string } | null>(null)
  const [isEliminandoAgregado, setIsEliminandoAgregado] = useState(false)
  const [extrasEditandoId, setExtrasEditandoId] = useState<number | null>(null)
  const [extrasEditNombre, setExtrasEditNombre] = useState('')
  const [extrasEditPrecio, setExtrasEditPrecio] = useState('')
  const [isGuardandoExtraInline, setIsGuardandoExtraInline] = useState(false)

  // ─── Backfill etiquetas ───
  const [isBackfillingEtiquetas, setIsBackfillingEtiquetas] = useState(false)

  // ─── Reordenar productos por categoría (drag & drop) ───
  const [reordenandoCategoria, setReordenandoCategoria] = useState<string | null>(null)
  const [ordenLocal, setOrdenLocal] = useState<typeof productos>([])
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [isGuardandoOrden, setIsGuardandoOrden] = useState(false)

  useEffect(() => {
    if (!restaurante) fetchData()
  }, [])

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

  // ─────────────────────────────────────────────
  // Panel actions
  // ─────────────────────────────────────────────
  const abrirPanel = (producto: typeof productos[0]) => {
    setPanelProductoId(producto.id)
    setActivePanelType('product')
    setPanelModo('vista')
    setPanelNuevo(false)
    setConfirmandoEliminar(false)
  }

  const cerrarPanel = () => {
    setActivePanelType(null)
    setConfirmandoEliminar(false)
    setPanelNuevo(false)
    setExtrasEditandoId(null)
  }

  const abrirPanelNuevo = () => {
    setPanelProductoId(null)
    setPanelNuevo(true)
    setActivePanelType('product')
    setPanelModo('edicion')
    setFormData({ nombre: '', descripcion: '', precio: '', categoriaId: '0', puntosGanados: '', puntosNecesarios: '', descuento: '', descuentoFechaInicio: '', descuentoFechaFin: '', variantes: [] })
    setImageBase64(null)
    setIngredientesSeleccionados([])
    setAgregadosSeleccionados([])
    setEtiquetasProducto([])
    setBusquedaIngrediente('')
    setSeccionesAbiertas(new Set(['info']))
    setIsDirty(false)
  }

  const entrarEdicion = async (producto: typeof productos[0]) => {
    setFormData({
      nombre: producto.nombre,
      descripcion: producto.descripcion || '',
      precio: producto.precio.toString(),
      categoriaId: producto.categoriaId ? producto.categoriaId.toString() : '0',
      puntosGanados: (producto as any).puntosGanados !== undefined && (producto as any).puntosGanados !== null ? (producto as any).puntosGanados.toString() : '',
      puntosNecesarios: (producto as any).puntosNecesarios !== undefined && (producto as any).puntosNecesarios !== null ? (producto as any).puntosNecesarios.toString() : '',
      descuento: (producto as any).descuento !== undefined && (producto as any).descuento !== null ? (producto as any).descuento.toString() : '',
      descuentoFechaInicio: (producto as any).descuentoFechaInicio ? new Date((producto as any).descuentoFechaInicio).toISOString().slice(0, 16) : '',
      descuentoFechaFin: (producto as any).descuentoFechaFin ? new Date((producto as any).descuentoFechaFin).toISOString().slice(0, 16) : '',
      variantes: (producto as any).variantes ? (producto as any).variantes.map((v: any) => ({ id: v.id, nombre: v.nombre, precio: v.precio.toString() })) : []
    })
    setImageBase64(producto.imagenUrl || null)
    setEtiquetasProducto(producto.etiquetas?.map(e => e.nombre) || [])
    setBusquedaIngrediente('')

    if (token) {
      try {
        const response = await ingredientesApi.getByProducto(token, producto.id) as any
        setIngredientesSeleccionados(response.success && response.ingredientes ? response.ingredientes.map((ing: any) => ing.id) : [])
      } catch { setIngredientesSeleccionados([]) }

      try {
        const response2 = await agregadosApi.getByProducto(token, producto.id) as any
        setAgregadosSeleccionados(response2.success && response2.agregados ? response2.agregados.map((ag: any) => ag.id) : [])
      } catch { setAgregadosSeleccionados([]) }
    }

    setPanelModo('edicion')
    setIsDirty(false)
    setSeccionesAbiertas(new Set(['info']))
  }

  const toggleSeccion = (id: string) => {
    setSeccionesAbiertas(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const markDirty = () => { if (!isDirty) setIsDirty(true) }

  // ─────────────────────────────────────────────
  // Toggle activo directo (sin dialog)
  // ─────────────────────────────────────────────
  const toggleActivoDirecto = async (producto: typeof productos[0]) => {
    if (!token) return
    const nuevoEstado = !producto.activo
    setIsTogglingActivo(true)
    try {
      await productosApi.update(token, { id: producto.id, activo: nuevoEstado })
      toast.success(nuevoEstado ? 'Producto activado' : 'Producto desactivado')
      await fetchData()
    } catch (error: any) {
      toast.error('Error al cambiar estado', { description: error.message || 'Error de conexión' })
    } finally {
      setIsTogglingActivo(false)
    }
  }

  // ─────────────────────────────────────────────
  // Eliminar directo (inline confirm)
  // ─────────────────────────────────────────────
  const eliminarProductoDirecto = async () => {
    if (!token || !panelProducto) return
    setIsEliminando(true)
    try {
      await productosApi.delete(token, panelProducto.id)
      toast.success('Producto eliminado correctamente')
      cerrarPanel()
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

  // ─────────────────────────────────────────────
  // Guardar producto (crear / actualizar)
  // ─────────────────────────────────────────────
  const handleSalvar = async (e: React.FormEvent) => {
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
        descuento: formData.descuento ? parseInt(formData.descuento, 10) : 0,
        descuentoFechaInicio: formData.descuentoFechaInicio || null,
        descuentoFechaFin: formData.descuentoFechaFin || null,
      }

      if (!panelNuevo && panelProductoId !== null) {
        await productosApi.update(token, { id: panelProductoId, ...payload } as any)
        toast.success('Producto actualizado')
        await fetchData()
        setIsDirty(false)
        setPanelModo('vista')
      } else {
        await productosApi.create(token, payload as any)
        toast.success('Producto creado')
        await fetchData()
        cerrarPanel()
      }
    } catch (error: any) {
      toast.error('Error al guardar', { description: error.message || 'Error de conexión' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─────────────────────────────────────────────
  // Ingredientes
  // ─────────────────────────────────────────────
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
        const r = await ingredientesApi.getAll(token) as any
        if (r.success && r.ingredientes) setIngredientes(r.ingredientes)
      }
    } catch (error: any) {
      toast.error('Error al crear ingrediente', { description: error.message || 'Error de conexión' })
    } finally {
      setIsCreandoIngrediente(false)
    }
  }

  // ─────────────────────────────────────────────
  // Agregados
  // ─────────────────────────────────────────────
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
        const r = await agregadosApi.getAll(token) as any
        if (r.success && r.agregados) setAgregados(r.agregados)
      }
    } catch (error: any) {
      toast.error('Error al crear agregado', { description: error.message || 'Error de conexión' })
    } finally {
      setIsCreandoAgregado(false)
    }
  }

  const iniciarEditInlineExtra = (ag: { id: number; nombre: string; precio: string }) => {
    setExtrasEditandoId(ag.id)
    setExtrasEditNombre(ag.nombre)
    setExtrasEditPrecio(ag.precio)
  }

  const guardarEditInlineExtra = async () => {
    if (!token || extrasEditandoId === null) return
    if (!extrasEditNombre.trim()) { toast.error('El nombre es requerido'); return }
    const precio = parseFloat(extrasEditPrecio)
    if (isNaN(precio) || precio < 0) { toast.error('El precio debe ser un número válido'); return }
    setIsGuardandoExtraInline(true)
    try {
      const response = await agregadosApi.update(token, extrasEditandoId, { nombre: extrasEditNombre.trim(), precio }) as { success: boolean }
      if (response.success) {
        toast.success('Extra actualizado')
        setExtrasEditandoId(null)
        const res = await agregadosApi.getAll(token) as any
        if (res.success && res.agregados) setAgregados(res.agregados)
      }
    } catch (error: any) {
      toast.error('Error al actualizar extra', { description: error.message || 'Error de conexión' })
    } finally {
      setIsGuardandoExtraInline(false)
    }
  }

  const confirmarEliminarAgregado = (ag: { id: number; nombre: string }) => {
    setAgregadoAEliminar(ag)
    setDialogEliminarAgregadoAbierto(true)
  }

  const eliminarAgregadoGlobal = async () => {
    if (!token || !agregadoAEliminar) return
    setIsEliminandoAgregado(true)
    try {
      const response = await agregadosApi.delete(token, agregadoAEliminar.id) as { success: boolean }
      if (response.success) {
        toast.success('Extra eliminado')
        setDialogEliminarAgregadoAbierto(false)
        setAgregadoAEliminar(null)
        const res = await agregadosApi.getAll(token) as any
        if (res.success && res.agregados) setAgregados(res.agregados)
        setAgregadosSeleccionados(prev => prev.filter(id => id !== agregadoAEliminar.id))
      }
    } catch (error: any) {
      toast.error('Error al eliminar extra', { description: error.message || 'Error de conexión' })
    } finally {
      setIsEliminandoAgregado(false)
    }
  }

  // ─────────────────────────────────────────────
  // Categorías
  // ─────────────────────────────────────────────
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
        const r = await categoriasApi.getAll(token) as any
        if (r.success && r.categorias) setCategorias(r.categorias)
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

  // ─────────────────────────────────────────────
  // Etiquetas backfill
  // ─────────────────────────────────────────────
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

  // ─────────────────────────────────────────────
  // Reordenar productos (drag & drop)
  // ─────────────────────────────────────────────
  const iniciarReorden = (categoriaNombre: string, productosCat: typeof productos) => {
    cerrarPanel()
    setReordenandoCategoria(categoriaNombre)
    setOrdenLocal(productosCat)
    setDragIndex(null)
  }

  const cancelarReorden = () => {
    setReordenandoCategoria(null)
    setOrdenLocal([])
    setDragIndex(null)
  }

  // Reordenado en vivo: al pasar por encima de otro item, el arrastrado toma su lugar
  const handleReorderDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === index) return
    setOrdenLocal(prev => {
      const next = [...prev]
      const [movido] = next.splice(dragIndex, 1)
      next.splice(index, 0, movido)
      return next
    })
    setDragIndex(index)
  }

  const guardarOrden = async () => {
    if (!token || ordenLocal.length === 0) return
    setIsGuardandoOrden(true)
    try {
      await productosApi.reorder(token, ordenLocal.map(p => p.id))
      toast.success('Orden actualizado')
      await fetchData()
      cancelarReorden()
    } catch (error: any) {
      toast.error('Error al guardar el orden', { description: error.message || 'Error de conexión' })
    } finally {
      setIsGuardandoOrden(false)
    }
  }

  // ─────────────────────────────────────────────
  // Filtered
  // ─────────────────────────────────────────────
  const productosFiltrados = productos.filter(p => {
    const term = busqueda.toLowerCase()
    return p.nombre.toLowerCase().includes(term) ||
      (p.descripcion && p.descripcion.toLowerCase().includes(term)) ||
      (p.etiquetas && p.etiquetas.some(e => e.nombre.toLowerCase().includes(term)))
  })

  const productosSinEtiqueta = productos.filter(p => !p.etiquetas || p.etiquetas.length === 0).length

  // ─────────────────────────────────────────────
  // Sección summaries
  // ─────────────────────────────────────────────
  const summaryDescuento = formData.descuento && parseInt(formData.descuento) > 0 ? `${formData.descuento}% activo` : 'Sin descuento'
  const summaryVariantes = formData.variantes.length > 0 ? `${formData.variantes.length} variante${formData.variantes.length !== 1 ? 's' : ''}` : 'Sin variantes'
  const summaryIngredientes = ingredientesSeleccionados.length > 0 ? `${ingredientesSeleccionados.length} ingrediente${ingredientesSeleccionados.length !== 1 ? 's' : ''}` : 'Sin ingredientes'
  const summaryExtras = agregadosSeleccionados.length > 0 ? `${agregadosSeleccionados.length} extra${agregadosSeleccionados.length !== 1 ? 's' : ''}` : 'Sin extras'
  const summaryImagen = (imageBase64 && imageBase64.length > 10) ? 'Con imagen' : 'Sin imagen'

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#0A0A0A]">
        <Loader2 className="h-8 w-8 animate-spin text-[#FF7A00]" />
      </div>
    )
  }

  return (
    <div className="bg-[#0A0A0A] selection:bg-[#FF7A00]/20 selection:text-[#FF7A00] flex">

      {/* ── Left: content area (shrinks when panel opens) ── */}
      <div className={cn(
        "transition-all duration-300 ease-out overflow-y-auto",
        activePanelType ? "w-full md:w-[60%]" : "w-full"
      )}>

        {/* ── Header (not sticky — flows with document) ── */}
        <div>
          <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-10 pb-8">
            {/* Line 1: title */}
            <div className="text-center">
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white">Catálogo</h1>
              <p className="text-sm text-zinc-500 mt-1">Gestiona el menú de tu restaurante</p>
            </div>

            {/* Line 2: search + secondary actions */}
            <div className="flex flex-col items-center gap-3 mt-4">
              <div className="relative w-full sm:w-1/2">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input
                  placeholder="Buscar productos..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="pl-10 h-10 rounded-lg bg-zinc-900 border-transparent focus:border-white/20 transition-colors text-white placeholder:text-zinc-500 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={abrirPanelNuevo}
                  className="h-9 px-4 rounded-lg text-sm font-bold bg-[#FF7A00] hover:bg-[#E66E00] text-white transition-colors flex items-center gap-1.5 shadow-md shadow-orange-500/20"
                >
                  <Plus className="h-4 w-4" />
                  Nuevo Plato
                </button>
                <button
                  onClick={() => setActivePanelType(activePanelType === 'extras' ? null : 'extras')}
                  className={cn("h-9 px-4 rounded-lg text-sm font-medium transition-colors", activePanelType === 'extras' ? "bg-zinc-700 text-white" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white")}
                >
                  Extras
                </button>
                <button
                  onClick={() => setActivePanelType(activePanelType === 'discounts' ? null : 'discounts')}
                  className={cn("h-9 px-4 rounded-lg text-sm font-medium transition-colors", activePanelType === 'discounts' ? "bg-zinc-700 text-white" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white")}
                >
                  Descuentos
                </button>
                {productosSinEtiqueta > 0 && (
                  <button
                    onClick={backfillEtiquetas}
                    disabled={isBackfillingEtiquetas}
                    className="h-9 px-4 rounded-lg text-sm font-medium bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isBackfillingEtiquetas && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Autocompletar ({productosSinEtiqueta})
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Grid ── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-8 pb-24">
          {productosFiltrados.length === 0 ? (
            <div className="bg-zinc-900 rounded-2xl flex flex-col items-center justify-center py-20 text-center">
              <div className="h-20 w-20 rounded-full bg-zinc-800 flex items-center justify-center mb-6">
                <UtensilsCrossed className="h-10 w-10 text-zinc-600" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-white">{busqueda ? 'No hay resultados' : 'Tu menú está vacío'}</h3>
              <p className="text-zinc-500 mb-8 max-w-sm">
                {busqueda ? 'Intenta buscar con otros términos.' : 'Comienza a agregar los deliciosos platos que ofreces a tus clientes.'}
              </p>
              {!busqueda && (
                <Button onClick={abrirPanelNuevo} className="h-12 rounded-lg px-8 bg-[#FF7A00] hover:bg-[#E66E00] text-white font-bold shadow-lg shadow-orange-500/20">
                  <Plus className="mr-2 h-5 w-5" /> Crear Primer Producto
                </Button>
              )}
            </div>
          ) : (
            <div>
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

                return categoriasOrdenadas.map((categoriaNombre) => {
                  const enReorden = reordenandoCategoria === categoriaNombre
                  return (
                  <div key={categoriaNombre}>
                    <div className="flex items-center justify-between gap-3 pt-10 mb-3">
                      <h2 className="text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-500">
                        {categoriaNombre} <span className="text-zinc-600">{porCategoria[categoriaNombre].length}</span>
                      </h2>
                      {enReorden ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={cancelarReorden}
                            disabled={isGuardandoOrden}
                            className="h-7 px-3 rounded-lg text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={guardarOrden}
                            disabled={isGuardandoOrden}
                            className="h-7 px-3 rounded-lg text-[11px] font-bold bg-[#FF7A00] hover:bg-[#E66E00] text-white transition-colors flex items-center gap-1.5 disabled:opacity-60"
                          >
                            {isGuardandoOrden ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            Guardar orden
                          </button>
                        </div>
                      ) : (
                        !busqueda && !reordenandoCategoria && porCategoria[categoriaNombre].length > 1 && (
                          <button
                            onClick={() => iniciarReorden(categoriaNombre, porCategoria[categoriaNombre])}
                            className="h-7 px-2.5 rounded-lg text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex items-center gap-1.5"
                          >
                            <ArrowUpDown className="h-3.5 w-3.5" />
                            Reordenar
                          </button>
                        )
                      )}
                    </div>

                    {enReorden ? (
                      <>
                        <p className="text-xs text-zinc-500 mb-3">
                          Arrastrá los platos para cambiar el orden en que se muestran a tus clientes.
                        </p>
                        <div className="space-y-2 max-w-2xl">
                          {ordenLocal.map((producto, index) => (
                            <div
                              key={producto.id}
                              draggable
                              onDragStart={() => setDragIndex(index)}
                              onDragOver={(e) => handleReorderDragOver(e, index)}
                              onDragEnd={() => setDragIndex(null)}
                              className={cn(
                                "flex items-center gap-3 p-2 pr-4 rounded-2xl bg-zinc-900 border transition-all select-none cursor-grab active:cursor-grabbing",
                                dragIndex === index ? "border-orange-500/70 opacity-60 shadow-lg" : "border-transparent hover:bg-zinc-800/70",
                                !producto.activo && "opacity-50"
                              )}
                            >
                              <GripVertical className="h-5 w-5 shrink-0 text-zinc-600" />
                              <div className="h-6 w-6 shrink-0 rounded-md bg-zinc-800 flex items-center justify-center text-[11px] font-bold text-zinc-400">
                                {index + 1}
                              </div>
                              <div className="h-11 w-11 shrink-0 rounded-xl overflow-hidden bg-zinc-800">
                                {producto.imagenUrl ? (
                                  <img src={producto.imagenUrl} alt={producto.nombre} className="w-full h-full object-cover pointer-events-none" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <ImageIcon className="h-4 w-4 text-zinc-600" />
                                  </div>
                                )}
                              </div>
                              <span className="flex-1 text-sm font-medium text-white truncate">{producto.nombre}</span>
                              <span className="text-sm font-bold text-zinc-400 shrink-0">${parseFloat(producto.precio).toFixed(0)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                    <div className={cn(
                      "grid gap-3 grid-cols-2 sm:grid-cols-3",
                      activePanelType ? "lg:grid-cols-4" : "lg:grid-cols-4 xl:grid-cols-5"
                    )}>
                      {porCategoria[categoriaNombre].map((producto) => {
                        const isSelected = activePanelType === 'product' && panelProductoId === producto.id
                        return (
                          <div
                            key={producto.id}
                            onClick={() => abrirPanel(producto)}
                            className={cn(
                              "bg-zinc-900 rounded-4xl overflow-hidden cursor-pointer transition-all hover:bg-zinc-800",
                              isSelected && "border-l-2 border-orange-500",
                              !producto.activo && "opacity-50"
                            )}
                          >
                            {/* Imagen */}
                            <div className="aspect-[3/2] w-full bg-zinc-800 relative overflow-hidden">
                              {producto.imagenUrl ? (
                                <img
                                  src={producto.imagenUrl}
                                  alt={producto.nombre}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <ImageIcon className="h-8 w-8 text-zinc-700" />
                                </div>
                              )}
                              {producto.descuento && producto.descuento > 0 && (
                                <div className="absolute top-2 left-2">
                                  <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold border-none shadow-sm text-[10px] px-1.5 py-0.5">
                                    -{producto.descuento}%
                                  </Badge>
                                </div>
                              )}
                            </div>

                            {/* Contenido */}
                            <div className="px-3 pt-2 pb-3">
                              <h3 className="text-xs font-semibold leading-tight pt-2 text-white truncate pl-2">{producto.nombre}</h3>
                              <p className="text-sm font-bold text-white mt-1 pl-2 pb-2">
                                ${producto.descuento && producto.descuento > 0
                                  ? (parseFloat(producto.precio) * (1 - producto.descuento / 100)).toFixed(0)
                                  : parseFloat(producto.precio).toFixed(0)}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    )}
                  </div>
                  )
                })
              })()}
            </div>
          )}
        </div>
      </div>

      {/* FAB (Mobile Only) */}
      <Button
        className="sm:hidden fixed bottom-6 right-6 h-14 w-14 rounded-full bg-[#FF7A00] hover:bg-[#E66E00] text-white shadow-xl shadow-orange-500/30 z-50"
        onClick={abrirPanelNuevo}
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* ─────────────────────────────────────────────
          SIDE PANEL (shared container)
      ───────────────────────────────────────────── */}
      <div
        className={cn(
          "fixed top-14 right-0 bottom-0 w-full md:w-[40%] z-30 bg-zinc-950 border-l border-white/5",
          "transition-transform duration-300 ease-out",
          activePanelType ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* X button */}
        <button
          onClick={cerrarPanel}
          className="absolute top-4 right-4 z-10 h-8 w-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors"
        >
          <X className="h-4 w-4 text-zinc-400" />
        </button>

        {/* ── PANEL: PRODUCT VISTA ── */}
        {activePanelType === 'product' && panelModo === 'vista' && panelProducto && (
          <div className="h-full flex flex-col overflow-y-auto">
            {/* Image */}
            <div className="h-48 w-full bg-zinc-800 shrink-0 overflow-hidden relative">
              {panelProducto.imagenUrl ? (
                <img src={panelProducto.imagenUrl} alt={panelProducto.nombre} className="w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                  <ImageIcon className="h-12 w-12 text-zinc-600" />
                </div>
              )}
            </div>

            <div className="p-6 flex flex-col gap-4 flex-1">
              <div>
                <span className="text-xs text-zinc-500">{panelProducto.categoria || 'Sin categoría'}</span>
                <h2 className="text-xl font-bold text-white mt-1">{panelProducto.nombre}</h2>
                {panelProducto.descripcion && (
                  <p className="text-sm text-zinc-400 mt-1">{panelProducto.descripcion}</p>
                )}
                <p className="text-2xl font-bold text-white mt-3">
                  ${parseFloat(panelProducto.precio).toFixed(0)}
                </p>
              </div>

              <div className="border-t border-white/5" />

              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-zinc-300">
                  {panelProducto.activo ? 'Activo' : 'Inactivo'}
                </span>
                <Switch
                  checked={panelProducto.activo}
                  onCheckedChange={() => toggleActivoDirecto(panelProducto)}
                  disabled={isTogglingActivo}
                />
              </div>

              <Button
                onClick={() => entrarEdicion(panelProducto)}
                className="w-full h-12 rounded-lg bg-[#FF7A00] hover:bg-[#E66E00] text-white font-bold"
              >
                <Edit className="h-4 w-4 mr-2" />
                Editar producto
              </Button>

              <div className="flex justify-center">
                {!confirmandoEliminar ? (
                  <button
                    onClick={() => setConfirmandoEliminar(true)}
                    className="text-sm text-red-500 hover:text-red-400 transition-colors"
                  >
                    Eliminar
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-zinc-300">¿Confirmar eliminación?</span>
                    <button
                      onClick={eliminarProductoDirecto}
                      disabled={isEliminando}
                      className="text-sm font-semibold text-red-500 hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      {isEliminando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sí, eliminar'}
                    </button>
                    <button
                      onClick={() => setConfirmandoEliminar(false)}
                      className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── PANEL: PRODUCT EDICION ── */}
        {activePanelType === 'product' && panelModo === 'edicion' && (
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 shrink-0 border-b border-white/5">
              {!panelNuevo && (
                <button
                  onClick={() => setPanelModo('vista')}
                  className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white transition-colors mb-3"
                >
                  <ChevronDown className="h-4 w-4 rotate-90" />
                  Volver
                </button>
              )}
              <h2 className="text-lg font-bold text-white pr-8">
                {panelNuevo ? 'Nuevo producto' : 'Editar producto'}
              </h2>
            </div>

            {/* Scrollable form */}
            <form id="panelForm" onSubmit={handleSalvar} className="flex-1 overflow-y-auto pb-24">

              {/* ── SECCIÓN: INFO ── */}
              <div
                className="px-6 py-3 cursor-pointer hover:bg-white/5 flex items-center justify-between border-b border-white/5"
                onClick={() => toggleSeccion('info')}
              >
                <span className="text-sm font-semibold text-white">Información</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">
                    {formData.nombre || 'Sin nombre'}
                  </span>
                  <ChevronDown className={cn("h-4 w-4 text-zinc-500 transition-transform", seccionesAbiertas.has('info') && "rotate-180")} />
                </div>
              </div>
              {seccionesAbiertas.has('info') && (
                <div className="px-6 py-4 space-y-4 border-b border-white/5">
                  <div>
                    <Label className={panelLabelClass}>Nombre <span className="text-red-500">*</span></Label>
                    <Input
                      value={formData.nombre}
                      onChange={(e) => { setFormData({ ...formData, nombre: e.target.value }); markDirty() }}
                      placeholder="Ej: Burger Triple Cheddar"
                      className={panelInputClass}
                    />
                  </div>
                  <div>
                    <Label className={panelLabelClass}>Descripción <span className="text-red-500">*</span></Label>
                    <Textarea
                      value={formData.descripcion}
                      onChange={(e) => { setFormData({ ...formData, descripcion: e.target.value }); markDirty() }}
                      placeholder="Describe el plato..."
                      rows={3}
                      className="rounded-lg bg-zinc-800 border-transparent focus:border-white/20 transition-all text-sm px-4 py-3 w-full resize-none"
                    />
                  </div>
                  <div>
                    <Label className={panelLabelClass}>Precio ($) <span className="text-red-500">*</span></Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-zinc-400 text-sm">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.precio}
                        onChange={(e) => { setFormData({ ...formData, precio: e.target.value }); markDirty() }}
                        placeholder="0.00"
                        className={cn(panelInputClass, "pl-8 font-bold")}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Label className={cn(panelLabelClass, "mb-0")}>Categoría</Label>
                      <button
                        type="button"
                        onClick={() => setDialogGestionCategoriasAbierto(true)}
                        className="text-xs text-orange-500 hover:text-orange-400 transition-colors"
                      >
                        Gestionar categorías
                      </button>
                    </div>
                    <Select
                      value={formData.categoriaId}
                      onValueChange={(value) => { setFormData({ ...formData, categoriaId: value }); markDirty() }}
                    >
                      <SelectTrigger className="h-12 rounded-lg bg-zinc-800 border-transparent focus:ring-2 focus:ring-white/10 text-sm px-4">
                        <SelectValue placeholder="Sin categoría" />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg border-zinc-700 bg-zinc-900">
                        <SelectItem value="0">Sin categoría</SelectItem>
                        {categorias.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id.toString()}>{cat.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* ── SECCIÓN: DESCUENTO ── */}
              <div
                className="px-6 py-3 cursor-pointer hover:bg-white/5 flex items-center justify-between border-b border-white/5"
                onClick={() => toggleSeccion('descuento')}
              >
                <span className="text-sm font-semibold text-white">Descuento</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">{summaryDescuento}</span>
                  <ChevronDown className={cn("h-4 w-4 text-zinc-500 transition-transform", seccionesAbiertas.has('descuento') && "rotate-180")} />
                </div>
              </div>
              {seccionesAbiertas.has('descuento') && (
                <div className="px-6 py-4 space-y-4 border-b border-white/5">
                  <div>
                    <Label className={panelLabelClass}>Porcentaje (%)</Label>
                    <div className="relative">
                      <Percent className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={formData.descuento}
                        onChange={(e) => { setFormData({ ...formData, descuento: e.target.value }); markDirty() }}
                        placeholder="0"
                        className={cn(panelInputClass, "pl-10")}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className={panelLabelClass}>Fecha inicio (opcional)</Label>
                    <Input
                      type="datetime-local"
                      value={formData.descuentoFechaInicio}
                      onChange={(e) => { setFormData({ ...formData, descuentoFechaInicio: e.target.value }); markDirty() }}
                      className={panelInputClass}
                    />
                  </div>
                  <div>
                    <Label className={panelLabelClass}>Fecha fin (opcional)</Label>
                    <Input
                      type="datetime-local"
                      value={formData.descuentoFechaFin}
                      onChange={(e) => { setFormData({ ...formData, descuentoFechaFin: e.target.value }); markDirty() }}
                      className={panelInputClass}
                    />
                  </div>
                  <p className="text-xs text-zinc-600">Si no defines fechas, el descuento es permanente.</p>
                </div>
              )}

              {/* ── SECCIÓN: VARIANTES ── */}
              <div
                className="px-6 py-3 cursor-pointer hover:bg-white/5 flex items-center justify-between border-b border-white/5"
                onClick={() => toggleSeccion('variantes')}
              >
                <span className="text-sm font-semibold text-white">Variantes</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">{summaryVariantes}</span>
                  <ChevronDown className={cn("h-4 w-4 text-zinc-500 transition-transform", seccionesAbiertas.has('variantes') && "rotate-180")} />
                </div>
              </div>
              {seccionesAbiertas.has('variantes') && (
                <div className="px-6 py-4 space-y-3 border-b border-white/5">
                  <p className="text-xs text-zinc-500">Múltiples opciones con distinto precio (Ej: Simple, Doble).</p>
                  {formData.variantes.map((variante, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Input
                        placeholder="Nombre"
                        value={variante.nombre}
                        onChange={(e) => {
                          const nuevas = [...formData.variantes]
                          nuevas[index].nombre = e.target.value
                          setFormData({ ...formData, variantes: nuevas })
                          markDirty()
                        }}
                        className={cn(panelInputClass, "flex-1")}
                      />
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-zinc-400 text-sm">$</span>
                        <Input
                          placeholder="Precio"
                          type="number"
                          step="0.01"
                          min="0"
                          value={variante.precio}
                          onChange={(e) => {
                            const nuevas = [...formData.variantes]
                            nuevas[index].precio = e.target.value
                            setFormData({ ...formData, variantes: nuevas })
                            markDirty()
                          }}
                          className={cn(panelInputClass, "pl-7 font-bold")}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const nuevas = formData.variantes.filter((_, i) => i !== index)
                          setFormData({ ...formData, variantes: nuevas })
                          markDirty()
                        }}
                        className="h-10 w-10 shrink-0 rounded-lg bg-red-950/30 hover:bg-red-900/50 text-red-500 flex items-center justify-center transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => { setFormData({ ...formData, variantes: [...formData.variantes, { nombre: '', precio: '' }] }); markDirty() }}
                    className="flex items-center gap-1 text-sm text-orange-500 hover:text-orange-400 transition-colors"
                  >
                    <Plus className="h-4 w-4" /> Agregar variante
                  </button>
                </div>
              )}

              {/* ── SECCIÓN: INGREDIENTES ── */}
              <div
                className="px-6 py-3 cursor-pointer hover:bg-white/5 flex items-center justify-between border-b border-white/5"
                onClick={() => toggleSeccion('ingredientes')}
              >
                <span className="text-sm font-semibold text-white">Ingredientes</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">{summaryIngredientes}</span>
                  <ChevronDown className={cn("h-4 w-4 text-zinc-500 transition-transform", seccionesAbiertas.has('ingredientes') && "rotate-180")} />
                </div>
              </div>
              {seccionesAbiertas.has('ingredientes') && (
                <div className="px-6 py-4 space-y-3 border-b border-white/5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-zinc-500">El cliente podrá quitarlos (Ej: Sin Cebolla).</p>
                    <button
                      type="button"
                      onClick={() => setDialogIngredienteAbierto(true)}
                      className="text-xs text-orange-500 hover:text-orange-400 transition-colors"
                    >
                      + Nuevo
                    </button>
                  </div>
                  {ingredientes.length > 5 && (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                      <Input
                        value={busquedaIngrediente}
                        onChange={(e) => setBusquedaIngrediente(e.target.value)}
                        placeholder="Buscar ingrediente..."
                        className="h-10 pl-9 rounded-lg bg-zinc-800 border-transparent text-sm"
                      />
                    </div>
                  )}
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {ingredientes.length === 0 ? (
                      <p className="text-sm text-zinc-600 italic py-2 text-center">No hay ingredientes creados.</p>
                    ) : (() => {
                      const filtrados = ingredientes.filter(ing =>
                        ing.nombre.toLowerCase().includes(busquedaIngrediente.toLowerCase())
                      )
                      const ordenados = [...filtrados].sort((a, b) => {
                        const aS = ingredientesSeleccionados.includes(a.id) ? 0 : 1
                        const bS = ingredientesSeleccionados.includes(b.id) ? 0 : 1
                        return aS - bS
                      })
                      if (ordenados.length === 0) return <p className="text-sm text-zinc-600 italic py-2 text-center">Sin resultados.</p>
                      return ordenados.map((ing) => {
                        const isSelected = ingredientesSeleccionados.includes(ing.id)
                        return (
                          <div
                            key={ing.id}
                            className={cn(
                              "flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer transition-all",
                              isSelected ? "bg-orange-950/20 border-orange-500/50" : "bg-zinc-800/50 border-transparent hover:border-white/10"
                            )}
                            onClick={() => {
                              if (isSelected) setIngredientesSeleccionados(prev => prev.filter(id => id !== ing.id))
                              else setIngredientesSeleccionados(prev => [...prev, ing.id])
                              markDirty()
                            }}
                          >
                            <span className={cn("text-sm font-medium", isSelected ? "text-orange-400" : "text-zinc-300")}>{ing.nombre}</span>
                            {isSelected && <CheckCircle2 className="h-4 w-4 text-orange-500" />}
                          </div>
                        )
                      })
                    })()}
                  </div>
                </div>
              )}

              {/* ── SECCIÓN: EXTRAS ── */}
              <div
                className="px-6 py-3 cursor-pointer hover:bg-white/5 flex items-center justify-between border-b border-white/5"
                onClick={() => toggleSeccion('extras')}
              >
                <span className="text-sm font-semibold text-white">Extras / Agregados</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">{summaryExtras}</span>
                  <ChevronDown className={cn("h-4 w-4 text-zinc-500 transition-transform", seccionesAbiertas.has('extras') && "rotate-180")} />
                </div>
              </div>
              {seccionesAbiertas.has('extras') && (
                <div className="px-6 py-4 space-y-3 border-b border-white/5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-zinc-500">Opciones con costo adicional (Ej: Extra Cheddar).</p>
                    <button
                      type="button"
                      onClick={() => setDialogAgregadoAbierto(true)}
                      className="text-xs text-orange-500 hover:text-orange-400 transition-colors"
                    >
                      + Nuevo
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {agregados.length === 0 ? (
                      <p className="text-sm text-zinc-600 italic py-2 text-center">No hay extras creados.</p>
                    ) : (
                      agregados.map((ag) => {
                        const isSelected = agregadosSeleccionados.includes(ag.id)
                        return (
                          <div
                            key={ag.id}
                            className={cn(
                              "flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer transition-all",
                              isSelected ? "bg-emerald-950/20 border-emerald-500/50" : "bg-zinc-800/50 border-transparent hover:border-white/10"
                            )}
                            onClick={() => {
                              if (isSelected) setAgregadosSeleccionados(prev => prev.filter(id => id !== ag.id))
                              else setAgregadosSeleccionados(prev => [...prev, ag.id])
                              markDirty()
                            }}
                          >
                            <span className={cn("text-sm font-medium", isSelected ? "text-emerald-400" : "text-zinc-300")}>
                              {ag.nombre} <span className="opacity-60 ml-1 text-xs">+${ag.precio}</span>
                            </span>
                            {isSelected && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}

              {/* ── SECCIÓN: IMAGEN ── */}
              <div
                className="px-6 py-3 cursor-pointer hover:bg-white/5 flex items-center justify-between border-b border-white/5"
                onClick={() => toggleSeccion('imagen')}
              >
                <span className="text-sm font-semibold text-white">Imagen</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">{summaryImagen}</span>
                  <ChevronDown className={cn("h-4 w-4 text-zinc-500 transition-transform", seccionesAbiertas.has('imagen') && "rotate-180")} />
                </div>
              </div>
              {seccionesAbiertas.has('imagen') && (
                <div className="px-6 py-4 border-b border-white/5">
                  <ImageUpload
                    onImageChange={(img) => { setImageBase64(img); markDirty() }}
                    currentImage={imageBase64}
                    maxSize={5}
                  />
                </div>
              )}

              {/* ── SISTEMA DE PUNTOS (si aplica) ── */}
              {restaurante?.sistemaPuntos && (
                <>
                  <div
                    className="px-6 py-3 cursor-pointer hover:bg-white/5 flex items-center justify-between border-b border-white/5"
                    onClick={() => toggleSeccion('puntos')}
                  >
                    <span className="text-sm font-semibold text-white">Sistema de Puntos</span>
                    <ChevronDown className={cn("h-4 w-4 text-zinc-500 transition-transform", seccionesAbiertas.has('puntos') && "rotate-180")} />
                  </div>
                  {seccionesAbiertas.has('puntos') && (
                    <div className="px-6 py-4 space-y-4 border-b border-white/5">
                      <div>
                        <Label className={panelLabelClass}>Puntos que otorga</Label>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={formData.puntosGanados}
                          onChange={(e) => { setFormData({ ...formData, puntosGanados: e.target.value }); markDirty() }}
                          placeholder="0"
                          className={panelInputClass}
                        />
                      </div>
                      <div>
                        <Label className={panelLabelClass}>Costo en puntos</Label>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={formData.puntosNecesarios}
                          onChange={(e) => { setFormData({ ...formData, puntosNecesarios: e.target.value }); markDirty() }}
                          placeholder="0"
                          className={panelInputClass}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

            </form>

            {/* Sticky footer — only when dirty */}
            {isDirty && (
              <div className="absolute bottom-0 left-0 right-0 px-6 py-4 bg-zinc-950 border-t border-white/5 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => { setIsDirty(false); if (panelNuevo) cerrarPanel(); else setPanelModo('vista') }}
                  className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Cancelar
                </button>
                <Button
                  type="submit"
                  form="panelForm"
                  disabled={isSubmitting}
                  className="h-10 px-6 rounded-lg bg-[#FF7A00] hover:bg-[#E66E00] text-white font-bold"
                >
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Guardar cambios
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── PANEL: DESCUENTOS MASIVOS ── */}
        {activePanelType === 'discounts' && (
          <div className="h-full flex flex-col">
            <div className="px-6 pt-6 pb-4 shrink-0 border-b border-white/5">
              <h2 className="text-lg font-bold text-white pr-8">Descuentos masivos</h2>
              <p className="text-xs text-zinc-500 mt-1">Aplicá un descuento a varios productos a la vez.</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-32">
              {/* Configurar */}
              <div className="space-y-4">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Configurar</p>
                <div>
                  <Label className={panelLabelClass}>Porcentaje (%) <span className="normal-case font-normal text-zinc-600">— 0 = quitar descuento</span></Label>
                  <div className="relative">
                    <Percent className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <Input type="number" min="0" max="100" step="1" value={descuentoMasivoPct} onChange={(e) => setDescuentoMasivoPct(e.target.value)} placeholder="0" className={cn(panelInputClass, "pl-10")} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className={panelLabelClass}>Inicio (opcional)</Label>
                    <Input type="datetime-local" value={descuentoMasivoInicio} onChange={(e) => setDescuentoMasivoInicio(e.target.value)} className={panelInputClass} />
                  </div>
                  <div>
                    <Label className={panelLabelClass}>Fin (opcional)</Label>
                    <Input type="datetime-local" value={descuentoMasivoFin} onChange={(e) => setDescuentoMasivoFin(e.target.value)} className={panelInputClass} />
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-wrap text-sm">
                  <span className="text-zinc-600 text-xs mr-1">Presets:</span>
                  {[{ label: '1h', ms: 3600000 }, { label: '8h', ms: 28800000 }, { label: '24h', ms: 86400000 }, { label: '7 días', ms: 604800000 }].map(({ label, ms }, i, arr) => (
                    <span key={label}>
                      <button type="button" className="text-zinc-400 hover:text-white transition-colors" onClick={() => setDescuentoMasivoFin(new Date(Date.now() + ms).toISOString().slice(0, 16))}>
                        {label}
                      </button>
                      {i < arr.length - 1 && <span className="mx-1.5 text-zinc-700">·</span>}
                    </span>
                  ))}
                  {descuentoMasivoFin && (
                    <>
                      <span className="mx-1.5 text-zinc-700">·</span>
                      <button type="button" className="text-zinc-500 hover:text-white transition-colors" onClick={() => setDescuentoMasivoFin('')}>quitar</button>
                    </>
                  )}
                </div>
              </div>

              {/* Productos */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Productos</p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input placeholder="Buscar producto..." value={busquedaDescuento} onChange={(e) => setBusquedaDescuento(e.target.value)} className="h-10 pl-9 rounded-lg bg-zinc-800 border-transparent text-sm" />
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <button type="button" className="text-[#FF7A00] hover:text-orange-400 transition-colors" onClick={() => setProductosDescuentoSeleccionados(productos.map(p => p.id))}>Seleccionar todos</button>
                  <span className="mx-1.5 text-zinc-700">·</span>
                  <button type="button" className="text-zinc-500 hover:text-white transition-colors" onClick={() => setProductosDescuentoSeleccionados([])}>Deseleccionar todos</button>
                  <span className="ml-auto text-zinc-500">{productosDescuentoSeleccionados.length} seleccionados</span>
                </div>
                <div className="space-y-1.5">
                  {productos.filter(p => p.nombre.toLowerCase().includes(busquedaDescuento.toLowerCase())).map((p) => {
                    const isSelected = productosDescuentoSeleccionados.includes(p.id)
                    return (
                      <div
                        key={p.id}
                        className={cn("flex items-center justify-between px-3 py-2.5 rounded-lg border cursor-pointer transition-all", isSelected ? "bg-orange-950/20 border-orange-500/50" : "bg-zinc-800/50 border-transparent hover:border-white/10")}
                        onClick={() => setProductosDescuentoSeleccionados(prev => isSelected ? prev.filter(id => id !== p.id) : [...prev, p.id])}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={cn("h-4 w-4 rounded border flex items-center justify-center shrink-0", isSelected ? "bg-[#FF7A00] border-[#FF7A00]" : "border-zinc-600")}>
                            {isSelected && <CheckCircle2 className="h-3 w-3 text-white" />}
                          </div>
                          <span className={cn("text-sm font-medium truncate", isSelected ? "text-orange-400" : "text-zinc-300")}>{p.nombre}</span>
                        </div>
                        <div className="shrink-0 ml-2 flex items-center gap-1">
                          {(p as any).descuento > 0 && <Badge className="bg-emerald-500 text-white text-[10px] border-none px-1.5">-{(p as any).descuento}%</Badge>}
                          {(p as any).descuentoFechaFin && formatTimeLeft((p as any).descuentoFechaFin) && (
                            <span className="text-[10px] text-amber-500">⏱ {formatTimeLeft((p as any).descuentoFechaFin)}</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Sticky footer */}
            <div className="absolute bottom-0 left-0 right-0 px-6 py-4 bg-zinc-950 border-t border-white/5 space-y-2">
              <Button
                disabled={productosDescuentoSeleccionados.length === 0 || descuentoMasivoPct === '' || aplicandoDescuento}
                onClick={async () => {
                  if (!token) return
                  setIsAplicandoDescuento(true)
                  try {
                    await productosApi.bulkDescuento(token, {
                      productoIds: productosDescuentoSeleccionados,
                      descuento: parseInt(descuentoMasivoPct, 10),
                      descuentoFechaInicio: descuentoMasivoInicio || null,
                      descuentoFechaFin: descuentoMasivoFin || null,
                    })
                    toast.success(`Descuento aplicado a ${productosDescuentoSeleccionados.length} producto(s)`)
                    await fetchData()
                    cerrarPanel()
                    setProductosDescuentoSeleccionados([])
                    setDescuentoMasivoPct('')
                    setDescuentoMasivoInicio('')
                    setDescuentoMasivoFin('')
                  } catch (error: any) {
                    toast.error('Error al aplicar descuento', { description: error.message || 'Error de conexión' })
                  } finally {
                    setIsAplicandoDescuento(false)
                  }
                }}
                className="w-full h-11 rounded-lg font-bold bg-[#FF7A00] hover:bg-[#E66E00] text-white"
              >
                {aplicandoDescuento ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Aplicar a {productosDescuentoSeleccionados.length} producto{productosDescuentoSeleccionados.length !== 1 ? 's' : ''}
              </Button>
              <button type="button" onClick={cerrarPanel} className="w-full text-sm text-zinc-500 hover:text-zinc-300 transition-colors text-center">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* ── PANEL: EXTRAS ── */}
        {activePanelType === 'extras' && (
          <div className="h-full flex flex-col">
            <div className="px-6 pt-6 pb-4 shrink-0 border-b border-white/5">
              <h2 className="text-lg font-bold text-white pr-8">Gestión de Extras</h2>
              <p className="text-xs text-zinc-500 mt-1">Los cambios se aplican a todos los productos que usen cada extra.</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-2 pb-28">
              {agregados.length === 0 ? (
                <p className="text-center text-zinc-600 py-8">No hay extras creados.</p>
              ) : (
                agregados.map((ag) => (
                  <div key={ag.id} className="rounded-lg border border-white/5 bg-zinc-900 overflow-hidden">
                    {extrasEditandoId === ag.id ? (
                      /* Inline edit form */
                      <div className="p-4 space-y-3">
                        <Input
                          value={extrasEditNombre}
                          onChange={(e) => setExtrasEditNombre(e.target.value)}
                          placeholder="Nombre del extra"
                          className={panelInputClass}
                          disabled={isGuardandoExtraInline}
                        />
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-zinc-400 text-sm">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={extrasEditPrecio}
                            onChange={(e) => setExtrasEditPrecio(e.target.value)}
                            placeholder="0.00"
                            className={cn(panelInputClass, "pl-8 font-bold")}
                            disabled={isGuardandoExtraInline}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={guardarEditInlineExtra} disabled={isGuardandoExtraInline || !extrasEditNombre.trim()} className="flex-1 h-9 rounded-lg bg-[#FF7A00] hover:bg-[#E66E00] text-white text-sm font-bold">
                            {isGuardandoExtraInline ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
                          </Button>
                          <button type="button" onClick={() => setExtrasEditandoId(null)} className="flex-1 h-9 rounded-lg text-sm text-zinc-500 hover:text-white transition-colors">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Normal row */
                      <div className="flex items-center justify-between px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{ag.nombre}</p>
                          <p className="text-xs text-zinc-500">+${ag.precio}</p>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <button
                            type="button"
                            onClick={() => iniciarEditInlineExtra(ag)}
                            className="text-zinc-400 hover:text-white transition-colors"
                          >
                            editar
                          </button>
                          <button
                            type="button"
                            onClick={() => confirmarEliminarAgregado(ag)}
                            className="text-red-500 hover:text-red-400 transition-colors"
                          >
                            eliminar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Sticky footer */}
            <div className="absolute bottom-0 left-0 right-0 px-6 py-4 bg-zinc-950 border-t border-white/5">
              <Button
                onClick={() => setDialogAgregadoAbierto(true)}
                className="w-full h-11 rounded-lg font-bold bg-[#FF7A00] hover:bg-[#E66E00] text-white"
              >
                <Plus className="mr-2 h-4 w-4" /> Nuevo Extra
              </Button>
            </div>
          </div>
        )}
      </div>

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
            <Button className="w-full h-14 rounded-2xl font-bold bg-zinc-700 hover:bg-zinc-600 text-white" onClick={crearAgregado} disabled={isCreandoAgregado || !nuevoAgregadoNombre.trim() || !nuevoAgregadoPrecio}>
              {isCreandoAgregado ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Crear Extra'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────
          MODAL: GESTIONAR CATEGORÍAS
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
            <Button className="w-full h-12 rounded-lg font-bold bg-[#FF7A00] hover:bg-[#E66E00] text-white" onClick={() => { setDialogGestionCategoriasAbierto(false); setDialogCategoriaAbierto(true) }}>
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
          MODAL: ELIMINAR CATEGORÍA
      ───────────────────────────────────────────── */}
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
            <Button variant="outline" className="flex-1 h-12 rounded-lg font-bold" onClick={() => setDialogEliminarCategoriaAbierto(false)}>Cancelar</Button>
            <Button variant="destructive" className="flex-1 h-12 rounded-lg font-bold" onClick={eliminarCategoria} disabled={isEliminandoCategoria}>
              {isEliminandoCategoria ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Eliminar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>


{/* Modal: Confirmar Eliminar Extra */}
      <Dialog open={dialogEliminarAgregadoAbierto} onOpenChange={setDialogEliminarAgregadoAbierto}>
        <DialogContent className="max-w-sm rounded-[32px] p-8 border-none bg-white dark:bg-zinc-900 text-center">
          <div className="h-16 w-16 bg-red-100 dark:bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trash2 className="h-8 w-8 text-red-600 dark:text-red-500" />
          </div>
          <DialogTitle className="text-xl font-bold mb-2">Eliminar Extra</DialogTitle>
          <DialogDescription className="text-sm mb-8">
            ¿Eliminar <strong>{agregadoAEliminar?.nombre}</strong>? Se quitará de todos los productos que lo tengan asignado.
          </DialogDescription>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-12 rounded-lg font-bold border-zinc-200 dark:border-zinc-800" onClick={() => setDialogEliminarAgregadoAbierto(false)}>Cancelar</Button>
            <Button variant="destructive" className="flex-1 h-12 rounded-lg font-bold" onClick={eliminarAgregadoGlobal} disabled={isEliminandoAgregado}>
              {isEliminandoAgregado ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Eliminar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>


    </div>
  )
}

export default Productos
