import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

export class ApiError extends Error {
  status: number
  response?: any

  constructor(message: string, status: number, response?: any) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.response = response
  }
}

// Función para hacer logout cuando el token expira
function handleUnauthorized() {
  const authStore = useAuthStore.getState()
  const restauranteStore = useRestauranteStore.getState()

  // Solo hacer logout si el usuario estaba autenticado
  if (authStore.isAuthenticated) {
    authStore.logout()
    restauranteStore.reset()
    // Redirigir al login
    window.location.href = '/login'
  }
}

// Función para verificar si el token JWT está expirado
export function isTokenExpired(token: string): boolean {
  try {
    // El JWT tiene 3 partes separadas por puntos: header.payload.signature
    const payload = token.split('.')[1]
    if (!payload) return true

    // Decodificar el payload (base64url)
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))

    // Verificar expiración (exp está en segundos)
    if (!decoded.exp) return true

    // Agregar un margen de 60 segundos para evitar problemas de sincronización
    const now = Math.floor(Date.now() / 1000)
    return decoded.exp < now + 60
  } catch {
    return true
  }
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${endpoint}`

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      // Si es un error 401 (Unauthorized), hacer logout automático
      if (response.status === 401) {
        handleUnauthorized()
      }

      throw new ApiError(
        data.error || data.message || 'Error en la solicitud',
        response.status,
        data
      )
    }

    return data
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    throw new ApiError(
      'Error de conexión con el servidor',
      0,
      error
    )
  }
}

// Auth API
export const authApi = {
  login: async (email: string, password: string) => {
    return fetchApi('/auth/login-restaurante', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  },

  register: async (email: string, password: string, nombre: string) => {
    return fetchApi('/auth/register-restaurante', {
      method: 'POST',
      body: JSON.stringify({ email, password, nombre }),
    })
  },
}

// Restaurante API
export const restauranteApi = {
  getProfile: async (token: string) => {
    return fetchApi('/restaurante/profile', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },

  completeProfile: async (
    token: string,
    data: {
      nombre: string
      direccion: string
      telefono: string
      imagenUrl: string
    }
  ) => {
    return fetchApi('/restaurante/complete-profile', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })
  },

  update: async (
    token: string,
    data: {
      nombre?: string
      direccion?: string
      telefono?: string
      image?: string // Base64 de la imagen
    }
  ) => {
    return fetchApi('/restaurante/update', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })
  },

  toggleCarrito: async (token: string) => {
    return fetchApi('/restaurante/toggle-carrito', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },
}

// Categorías API
export const categoriasApi = {
  getAll: async (token: string) => {
    return fetchApi('/categoria', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },

  create: async (
    token: string,
    data: {
      nombre: string
    }
  ) => {
    return fetchApi('/categoria/create', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })
  },

  update: async (
    token: string,
    data: {
      id: number
      nombre?: string
    }
  ) => {
    return fetchApi('/categoria/update', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })
  },

  delete: async (token: string, id: number) => {
    return fetchApi(`/categoria/delete/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },
}

// Productos API
export const productosApi = {
  getAll: async (token: string) => {
    return fetchApi('/producto', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },

  create: async (
    token: string,
    data: {
      nombre: string
      descripcion: string
      precio: number
      image?: string // Base64 string
      categoriaId?: number
      ingredienteIds?: number[]
    }
  ) => {
    return fetchApi('/producto/create', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })
  },

  update: async (
    token: string,
    data: {
      id: number
      nombre?: string
      descripcion?: string
      precio?: number
      image?: string // Base64 string
      categoriaId?: number | null
      ingredienteIds?: number[]
      activo?: boolean
    }
  ) => {
    return fetchApi('/producto/update', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })
  },

  delete: async (token: string, id: number) => {
    return fetchApi(`/producto/delete/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },
}

// Ingredientes API
export const ingredientesApi = {
  getAll: async (token: string) => {
    return fetchApi('/ingrediente', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },

  create: async (
    token: string,
    data: {
      nombre: string
    }
  ) => {
    return fetchApi('/ingrediente/create', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })
  },

  delete: async (token: string, id: number) => {
    return fetchApi(`/ingrediente/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },

  getByProducto: async (token: string, productoId: number) => {
    return fetchApi(`/ingrediente/producto/${productoId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },
}

// Pedidos API
export const pedidosApi = {
  // Obtener todos los pedidos con paginación
  getAll: async (token: string, page = 1, limit = 20, estado?: string) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString()
    })
    if (estado) params.append('estado', estado)

    return fetchApi(`/pedido/list?${params}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },

  // Obtener un pedido específico
  getById: async (token: string, id: number) => {
    return fetchApi(`/pedido/${id}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },

  // Actualizar estado del pedido
  updateEstado: async (token: string, id: number, estado: string) => {
    return fetchApi(`/pedido/${id}/estado`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ estado }),
    })
  },

  // ==================== GESTIÓN MANUAL DE PEDIDOS ====================

  // Crear pedido manual para una mesa
  createManual: async (token: string, mesaId: number) => {
    return fetchApi('/pedido/create-manual', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ mesaId }),
    })
  },

  // Agregar item a un pedido
  addItem: async (
    token: string,
    pedidoId: number,
    data: {
      productoId: number
      cantidad?: number
      clienteNombre?: string
    }
  ) => {
    return fetchApi(`/pedido/${pedidoId}/items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        productoId: data.productoId,
        cantidad: data.cantidad || 1,
        clienteNombre: data.clienteNombre || 'Mozo'
      }),
    })
  },

  // Eliminar item de un pedido
  deleteItem: async (token: string, pedidoId: number, itemId: number) => {
    return fetchApi(`/pedido/${pedidoId}/items/${itemId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },

  // Actualizar cantidad de un item
  updateItemCantidad: async (token: string, pedidoId: number, itemId: number, cantidad: number) => {
    return fetchApi(`/pedido/${pedidoId}/items/${itemId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ cantidad }),
    })
  },

  // Confirmar pedido (pasar a 'preparing')
  confirmar: async (token: string, pedidoId: number) => {
    return fetchApi(`/pedido/${pedidoId}/confirmar`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },

  // Cerrar pedido
  cerrar: async (token: string, pedidoId: number) => {
    return fetchApi(`/pedido/${pedidoId}/cerrar`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },

  // Eliminar pedido
  delete: async (token: string, pedidoId: number) => {
    return fetchApi(`/pedido/delete/${pedidoId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },
}

// MercadoPago API
export const mercadopagoApi = {
  // Obtener estado de conexión
  getEstado: async (token: string) => {
    return fetchApi('/mp/estado', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },

  // Obtener subtotales de un pedido (split payment)
  getSubtotales: async (pedidoId: number) => {
    return fetchApi(`/mp/subtotales/${pedidoId}`, {
      method: 'GET',
    })
  },

  // Pagar en efectivo (para admin - marca como pending_cash)
  pagarEfectivo: async (pedidoId: number, clientesAPagar: string[], qrToken: string) => {
    return fetchApi('/mp/pagar-efectivo', {
      method: 'POST',
      body: JSON.stringify({
        pedidoId,
        clientesAPagar,
        qrToken
      }),
    })
  },

  // Confirmar pago en efectivo (admin confirma que recibió el dinero)
  confirmarEfectivo: async (token: string, pedidoId: number, clienteNombre: string) => {
    return fetchApi('/mp/confirmar-efectivo', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        pedidoId,
        clienteNombre
      }),
    })
  },

  // Desconectar MercadoPago
  desconectar: async (token: string) => {
    return fetchApi('/mp/desconectar', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },
}

// Mesas API
export const mesasApi = {
  getAll: async (token: string) => {
    return fetchApi('/mesa/list', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },

  // Obtener todas las mesas con su pedido actual
  getAllWithPedidos: async (token: string) => {
    return fetchApi('/mesa/list-with-pedidos', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },

  // Obtener detalle de una mesa específica con su pedido
  getPedido: async (token: string, mesaId: number) => {
    return fetchApi(`/mesa/${mesaId}/pedido`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },

  create: async (token: string, nombre: string) => {
    return fetchApi('/mesa/create', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ nombre }),
    })
  },

  delete: async (token: string, id: number) => {
    return fetchApi(`/mesa/delete/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },

  // Resetear mesa: cierra el pedido actual y crea uno nuevo vacío
  reset: async (token: string, id: number) => {
    return fetchApi(`/mesa/${id}/reset`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },
}

// Notificaciones API
export const notificacionesApi = {
  // Obtener todas las notificaciones del restaurante
  getAll: async (token: string) => {
    return fetchApi('/notificacion', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },

  // Marcar una notificación como leída
  markAsRead: async (token: string, id: string) => {
    return fetchApi(`/notificacion/${id}/read`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },

  // Marcar todas las notificaciones como leídas
  markAllAsRead: async (token: string) => {
    return fetchApi('/notificacion/read-all', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },

  // Eliminar una notificación
  delete: async (token: string, id: string) => {
    return fetchApi(`/notificacion/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },

  // Eliminar todas las notificaciones
  deleteAll: async (token: string) => {
    return fetchApi('/notificacion/all', {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },
}

