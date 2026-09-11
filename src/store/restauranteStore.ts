import { create } from 'zustand'
import { restauranteApi } from '@/lib/api'
import { useAuthStore } from './authStore'
import { leerCatalogoLocal, reemplazarCatalogoLocal } from '@/lib/posLocalDb'

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
  esBebida?: boolean
  orden?: number | null
  createdAt: string
}

interface Producto {
  eventoSucursalId?: number | null
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
  categoriaEsBebida?: boolean
  orden?: number | null
  descuento?: number | null
  tieneVariantes?: boolean | null
  etiquetas?: Array<{ id: number; nombre: string }>
  ingredientes?: Array<{ id: number; nombre: string }>
  agregados?: Array<{ id: number; nombre: string; precio: string; grupo?: number }>
  agregadosPrimarios?: Array<{ id: number; nombre: string; precio: string; grupo?: number }>
  agregadosSecundarios?: Array<{ id: number; nombre: string; precio: string; grupo?: number }>
  variantes?: Array<{ id: number; nombre: string; precio: string }>
  variantesSecundarias?: Array<{ id: number; nombre: string; precio: string }>
  tituloVariantesPrimarias?: string
  tituloVariantesSecundarias?: string
  tituloExtrasPrimarios?: string
  tituloExtrasSecundarios?: string
  permiteNota?: boolean
  tituloNota?: string
}

export interface RestauranteData {
  id: number
  email: string
  nombre: string
  direccion: string | null
  telefono: string | null
  imagenUrl: string | null
  imagenLightUrl: string | null
  mercadoPagoPublicKey: string | null
  mercadoPagoPrivateKey: string | null
  username: string | null
  /** ID público de Google Tag Manager; los admins viejos pueden ignorarlo. */
  gtmContainerId?: string | null
  createdAt: string
  // Campos OAuth de MercadoPago
  mpConnected: boolean | null
  mpUserId: string | null
  // Modo carrito
  esCarrito: boolean | null
  splitPayment: boolean | null
  itemTracking: boolean | null
  soloCartaDigital: boolean | null
  deliveryFee: string | null
  cucuruCustomerId: string | null
  cucuruAccountNumber: string | null
  cucuruAlias: string | null
  cucuruConfigurado: boolean | null
  cucuruEnabled: boolean | null
  cardsPaymentsEnabled: boolean | null
  whatsappEnabled: boolean | null
  whatsappNumber: string | null
  comprobantesWhatsapp: string | null
  transferenciaAlias: string | null
  sistemaPuntos: boolean | null
  colorPrimario: string | null
  colorSecundario: string | null
  usarColorUnico: boolean | null
  disenoAlternativo: boolean | null
  direccionTexto?: string | null
  direccionLat?: string | null
  direccionLng?: string | null
  rapiboyToken: string | null
  proveedorPago: 'cucuru' | 'talo' | 'mercadopago' | 'manual' | null
  taloClientId: string | null
  taloClientSecret: string | null
  taloUserId: string | null
  codigoDescuentoEnabled: boolean | null
  notificarClientesWhatsapp: boolean | null
  modoConfirmacionManual: boolean | null
  orderGroupEnabled: boolean | null
  deliveryEnabled: boolean | null
  direccionSoloTexto: boolean | null
  takeawayEnabled: boolean | null
  permitirPedidosProgramados: boolean | null
  usarFranjasHorario: boolean | null
  soloPedidosProgramados: boolean | null
  metodosPagoConfig?: {
    mercadopagoCheckout?: boolean
    mercadopagoBricks?: boolean
    transferenciaAutomatica?: boolean
    transferenciaManual?: boolean
    efectivo?: boolean
  } | null
}

// Resumen de suscripción que viene en /restaurante/profile. Fuente del hard paywall en el admin.
export interface SuscripcionResumen {
  estado: string | null
  planCodigo: string | null
  planNombre: string | null
  conAccesoAPago: boolean
  sinSuscripcion: boolean
  features: string[]
  requiereSuscripcion?: boolean
  accesoPanel?: boolean
}

interface RestauranteState {
  restaurante: RestauranteData | null
  suscripcion: SuscripcionResumen | null
  mesas: Mesa[]
  productos: Producto[]
  categorias: Categoria[]
  isLoading: boolean
  error: string | null
  fetchData: () => Promise<void>
  setRestaurante: (restaurante: RestauranteData) => void
  setLocal: (partial: Partial<RestauranteData>) => void
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
  suscripcion: null,
  mesas: [],
  productos: [],
  categorias: [],
  isLoading: false,
  error: null,

  fetchData: async () => {
    const token = useAuthStore.getState().token
    const restauranteId = useAuthStore.getState().restaurante?.id
    if (!token) {
      set({ error: 'No hay token de autenticación' })
      return
    }

    // 1. Si no hay productos en memoria pero hay sesión, intentar hidratar inmediatamente desde IndexedDB
    if (restauranteId != null && useRestauranteStore.getState().productos.length === 0) {
      try {
        const local = await leerCatalogoLocal(restauranteId)
        if (local && (local.productos.length > 0 || local.restaurante)) {
          set({
            restaurante: local.restaurante || (useAuthStore.getState().restaurante as any),
            suscripcion: local.suscripcion || null,
            mesas: local.mesas || [],
            productos: local.productos || [],
            categorias: local.categorias || [],
            error: null,
            isLoading: false,
          })
        }
      } catch { /* Fallo silencioso de hidratación previa */ }
    }

    set({ isLoading: true, error: null })
    try {
      const response = await restauranteApi.getProfile(token) as {
        success: boolean
        data?: {
          restaurante: RestauranteData | RestauranteData[]
          mesas: Mesa[]
          productos: Producto[]
          suscripcion?: SuscripcionResumen
        }
      }

      // Obtener categorías por separado
      const { categoriasApi } = await import('@/lib/api')
      const categoriasResponse = await categoriasApi.getAll(token) as {
        success: boolean
        categorias?: Categoria[]
      }

      if (response.success && response.data) {
        const restauranteRespuesta = response.data.restaurante
        const restaurante = Array.isArray(restauranteRespuesta)
          ? restauranteRespuesta[0]
          : restauranteRespuesta

        if (!restaurante) {
          set({ error: 'El servidor no devolvió los datos del restaurante', isLoading: false })
          return
        }

        const categorias = categoriasResponse.success && categoriasResponse.categorias ? categoriasResponse.categorias : []
        const productos = response.data.productos || []
        const mesas = response.data.mesas || []
        const suscripcion = response.data.suscripcion ?? null

        set({
          restaurante,
          suscripcion,
          mesas,
          productos,
          categorias,
          isLoading: false,
          error: null,
        })

        // Guardar respaldo offline en IndexedDB de forma no bloqueante
        if (restauranteId != null) {
          void reemplazarCatalogoLocal(restauranteId, {
            productos,
            categorias,
            restaurante,
            suscripcion,
            mesas,
          }).catch(() => { /* Fallo no bloqueante de almacenamiento local */ })
        }
      } else {
        set({ error: 'Error al cargar los datos', isLoading: false })
      }
    } catch (error) {
      console.error('Error fetching restaurante data:', error)
      // Si falló la red o estamos offline, comprobar si tenemos copia en IndexedDB
      if (restauranteId != null) {
        try {
          const local = await leerCatalogoLocal(restauranteId)
          if (local && (local.productos.length > 0 || local.restaurante)) {
            set({
              restaurante: local.restaurante || (useAuthStore.getState().restaurante as any),
              suscripcion: local.suscripcion || null,
              mesas: local.mesas || [],
              productos: local.productos || [],
              categorias: local.categorias || [],
              isLoading: false,
              error: null,
            })
            return
          }
        } catch { /* Error leyendo copia local */ }
      }
      set({ error: 'Error al conectar con el servidor', isLoading: false })
    }
  },

  setRestaurante: (restaurante) => set({ restaurante }),

  // Merge local de campos del restaurante sin fetch. Base del autosave optimista:
  // la UI refleja el cambio al instante y el sync corre en background.
  setLocal: (partial) =>
    set((state) =>
      state.restaurante
        ? { restaurante: { ...state.restaurante, ...partial } }
        : {}
    ),

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
      suscripcion: null,
      mesas: [],
      productos: [],
      categorias: [],
      isLoading: false,
      error: null,
    }),
}))
