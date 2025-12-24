const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

// interface ApiResponse<T = any> {
//   success?: boolean
//   data?: T
//   message?: string
//   error?: string
// }

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
}

