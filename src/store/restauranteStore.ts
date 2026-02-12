import { create } from 'zustand'
import { restauranteApi } from '@/lib/api'
import { useAuthStore } from './authStore'

interface Mesa {
  id: number
  nombre: string
  restauranteId: number
  qrToken: string
  createdAt: string
}

interface Categoria {
  id: number
  restauranteId: number
  nombre: string
  createdAt: string
}

interface Producto {
  id: number
  restauranteId: number
  categoriaId: number | null
  nombre: string
  descripcion: string | null
  precio: string
  activo: boolean
  imagenUrl: string | null
  createdAt: string
  categoria: string | null
  etiquetas?: Array<{ id: number; nombre: string }>
}

interface RestauranteData {
  id: number
  email: string
  nombre: string
  direccion: string | null
  telefono: string | null
  imagenUrl: string | null
  mercadoPagoPublicKey: string | null
  mercadoPagoPrivateKey: string | null
  createdAt: string
  // Campos OAuth de MercadoPago
  mpConnected: boolean | null
  mpUserId: string | null
  // Modo carrito
  esCarrito: boolean | null
  // Configuraciones
  splitPayment: boolean | null
}

interface RestauranteState {
  restaurante: RestauranteData | null
  mesas: Mesa[]
  productos: Producto[]
  categorias: Categoria[]
  isLoading: boolean
  error: string | null
  fetchData: () => Promise<void>
  setRestaurante: (restaurante: RestauranteData) => void
  setMesas: (mesas: Mesa[]) => void
  setProductos: (productos: Producto[]) => void
  setCategorias: (categorias: Categoria[]) => void
  addMesa: (mesa: Mesa) => void
  updateMesa: (id: number, data: Partial<Mesa>) => void
  deleteMesa: (id: number) => void
  addProducto: (producto: Producto) => void
  updateProducto: (id: number, data: Partial<Producto>) => void
  deleteProducto: (id: number) => void
  addCategoria: (categoria: Categoria) => void
  updateCategoria: (id: number, data: Partial<Categoria>) => void
  deleteCategoria: (id: number) => void
  reset: () => void
}

export const useRestauranteStore = create<RestauranteState>((set) => ({
  restaurante: null,
  mesas: [],
  productos: [],
  categorias: [],
  isLoading: false,
  error: null,

  fetchData: async () => {
    const token = useAuthStore.getState().token
    if (!token) {
      set({ error: 'No hay token de autenticación' })
      return
    }

    set({ isLoading: true, error: null })
    try {
      const response = await restauranteApi.getProfile(token) as {
        success: boolean
        data?: {
          restaurante: RestauranteData[]
          mesas: Mesa[]
          productos: Producto[]
        }
      }

      // Obtener categorías por separado
      const { categoriasApi } = await import('@/lib/api')
      const categoriasResponse = await categoriasApi.getAll(token) as {
        success: boolean
        categorias?: Categoria[]
      }

      if (response.success && response.data) {
        set({
          restaurante: response.data.restaurante[0],
          mesas: response.data.mesas,
          productos: response.data.productos,
          categorias: categoriasResponse.success && categoriasResponse.categorias ? categoriasResponse.categorias : [],
          isLoading: false,
        })
      } else {
        set({ error: 'Error al cargar los datos', isLoading: false })
      }
    } catch (error) {
      console.error('Error fetching restaurante data:', error)
      set({ error: 'Error al conectar con el servidor', isLoading: false })
    }
  },

  setRestaurante: (restaurante) => set({ restaurante }),
  setMesas: (mesas) => set({ mesas }),
  setProductos: (productos) => set({ productos }),
  setCategorias: (categorias) => set({ categorias }),

  addMesa: (mesa) => set((state) => ({ mesas: [...state.mesas, mesa] })),

  updateMesa: (id, data) =>
    set((state) => ({
      mesas: state.mesas.map((m) => (m.id === id ? { ...m, ...data } : m)),
    })),

  deleteMesa: (id) =>
    set((state) => ({
      mesas: state.mesas.filter((m) => m.id !== id),
    })),

  addProducto: (producto) =>
    set((state) => ({ productos: [...state.productos, producto] })),

  updateProducto: (id, data) =>
    set((state) => ({
      productos: state.productos.map((p) => (p.id === id ? { ...p, ...data } : p)),
    })),

  deleteProducto: (id) =>
    set((state) => ({
      productos: state.productos.filter((p) => p.id !== id),
    })),

  addCategoria: (categoria) =>
    set((state) => ({ categorias: [...state.categorias, categoria] })),

  updateCategoria: (id, data) =>
    set((state) => ({
      categorias: state.categorias.map((c) => (c.id === id ? { ...c, ...data } : c)),
    })),

  deleteCategoria: (id) =>
    set((state) => ({
      categorias: state.categorias.filter((c) => c.id !== id),
    })),

  reset: () =>
    set({
      restaurante: null,
      mesas: [],
      productos: [],
      categorias: [],
      isLoading: false,
      error: null,
    }),
}))

