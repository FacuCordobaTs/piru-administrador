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

      const errorMessage = typeof data?.error === 'string'
        ? data.error
        : data?.message
        ? data.message
        : data?.error?.message
        ? data.error.message
        : data?.error?.issues
        ? data.error.issues.map((i: { message?: string; path?: string[] }) => i.message || i.path?.join('.')).join('; ') || 'Error de validación'
        : 'Error en la solicitud'

      throw new ApiError(errorMessage, response.status, data)
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

  // Registro por WhatsApp (self-serve): envía un código al celular y devuelve un verificationId único.
  // Sólo pide el teléfono; el resto de los datos se completan en el onboarding.
  registerTelefonoStart: async (telefono: string) => {
    return fetchApi('/auth/register-telefono/start', {
      method: 'POST',
      body: JSON.stringify({ telefono }),
    })
  },

  // Reenvía el código para una sesión de verificación existente.
  registerTelefonoResend: async (verificationId: string) => {
    return fetchApi('/auth/register-telefono/resend', {
      method: 'POST',
      body: JSON.stringify({ verificationId }),
    })
  },

  // Verifica el código de 6 dígitos y crea la cuenta.
  registerTelefonoVerify: async (verificationId: string, codigo: string) => {
    return fetchApi('/auth/register-telefono/verify', {
      method: 'POST',
      body: JSON.stringify({ verificationId, codigo }),
    })
  },

  // Login por WhatsApp (para cuentas registradas con celular, sin contraseña).
  // Envía un código a un número que YA tiene cuenta. El reenvío reutiliza registerTelefonoResend.
  loginTelefonoStart: async (telefono: string) => {
    return fetchApi('/auth/login-telefono/start', {
      method: 'POST',
      body: JSON.stringify({ telefono }),
    })
  },

  // Verifica el código y devuelve el token de la cuenta existente.
  loginTelefonoVerify: async (verificationId: string, codigo: string) => {
    return fetchApi('/auth/login-telefono/verify', {
      method: 'POST',
      body: JSON.stringify({ verificationId, codigo }),
    })
  },

  changePassword: async (token: string, currentPassword: string, newPassword: string) => {
    return fetchApi('/auth/change-password', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ currentPassword, newPassword }),
    })
  },
}

// Onboarding API
export const onboardingApi = {
  complete: async (token: string, data: any) => {
    return fetchApi('/onboarding/complete', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(data)
    })
  }
}

// Carta IA — extracción automática del menú desde imágenes con Claude
export const cartaIaApi = {
  // Envía las imágenes (data URLs base64) y devuelve la carta detectada
  extraer: async (token: string, imagenes: string[]) => {
    return fetchApi('/carta-ia/extraer', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ imagenes }),
    })
  },
  // Crea todos los productos (con categorías, ingredientes, variantes y extras)
  crear: async (token: string, carta: any) => {
    return fetchApi('/carta-ia/crear', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ carta }),
    })
  },
}

export const clientesApi = {
  getAll: async (token: string) => {
    return fetchApi('/clientes/list', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },
  // Motor de Recompra · 4.2 — envía el próximo toque de la escalera de recupero al cliente.
  enviarRecupero: async (token: string, clienteId: number) => {
    return fetchApi(`/clientes/${clienteId}/recupero`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },
  // Motor de Recompra · goteo — estado del motor: PLAN de activación (apagado) o DASHBOARD (encendido).
  recompraEstado: async (token: string) => {
    return fetchApi('/clientes/recompra/estado', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
  },
  // Enciende el motor (una vez): detecta el stock, aparta el control y arranca el goteo. cupoDiario opcional.
  activarRecompra: async (token: string, cupoDiario?: number) => {
    return fetchApi('/clientes/recompra/activar', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cupoDiario != null ? { cupoDiario } : {}),
    })
  },
  pausarRecompra: async (token: string) => {
    return fetchApi('/clientes/recompra/pausar', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
  },
  reanudarRecompra: async (token: string) => {
    return fetchApi('/clientes/recompra/reanudar', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
  },
  configRecompra: async (token: string, cupoDiario: number) => {
    return fetchApi('/clientes/recompra/config', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cupoDiario }),
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
      imageLight?: string // Base64 del logo modo claro
      username?: string
      colorPrimario?: string
      colorSecundario?: string
      direccionTexto?: string | null
      direccionLat?: number | null
      direccionLng?: number | null
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

  toggleSplitPayment: async (token: string) => {
    return fetchApi('/restaurante/toggle-split-payment', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },

  toggleItemTracking: async (token: string) => {
    return fetchApi('/restaurante/toggle-item-tracking', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },

  toggleSoloCartaDigital: async (token: string) => {
    return fetchApi('/restaurante/toggle-solo-carta-digital', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },

  toggleSistemaPuntos: async (token: string) => {
    return fetchApi('/restaurante/toggle-sistema-puntos', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },

  toggleDisenoAlternativo: async (token: string) => {
    return fetchApi('/restaurante/toggle-diseno-alternativo', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },

  toggleOrderGroupEnabled: async (token: string) => {
    return fetchApi('/restaurante/toggle-order-group-enabled', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },

  toggleNotificarClientesWhatsapp: async (token: string) => {
    return fetchApi('/restaurante/toggle-notificar-clientes-whatsapp', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },

  toggleModoConfirmacionManual: async (token: string) => {
    return fetchApi('/restaurante/toggle-modo-confirmacion-manual', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },

  toggleCodigoDescuentoEnabled: async (token: string) => {
    return fetchApi('/restaurante/toggle-codigo-descuento-enabled', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },

  toggleWhatsappEnabled: async (token: string) => {
    return fetchApi('/restaurante/toggle-whatsapp-enabled', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },

  toggleCardsPaymentsEnabled: async (token: string) => {
    return fetchApi('/restaurante/toggle-cards-payments-enabled', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },

  toggleCucuruEnabled: async (token: string) => {
    return fetchApi('/restaurante/toggle-cucuru-enabled', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },

  toggleDeliveryEnabled: async (token: string) => {
    return fetchApi('/restaurante/toggle-delivery-enabled', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },

  toggleTakeawayEnabled: async (token: string) => {
    return fetchApi('/restaurante/toggle-takeaway-enabled', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },

  getHorarios: async (token: string) => {
    return fetchApi('/restaurante/horarios', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },

  updateHorarios: async (
    token: string,
    horarios: Array<{ diaSemana: number; horaApertura: string; horaCierre: string }>
  ) => {
    return fetchApi('/restaurante/horarios', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ horarios }),
    })
  },

  configurarRapiboy: async (token: string, rapiboyToken: string) => {
    return fetchApi('/restaurante/configurar-rapiboy', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ token: rapiboyToken })
    })
  },

  borrarRapiboy: async (token: string) => {
    return fetchApi('/restaurante/borrar-rapiboy', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
  },

  configurarTalo: async (token: string, taloClientId: string, taloClientSecret: string, taloUserId: string) => {
    return fetchApi('/restaurante/configurar-talo', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ taloClientId, taloClientSecret, taloUserId })
    })
  },

  updatePasarelaPago: async (
    token: string,
    data: {
      proveedorPago?: 'cucuru' | 'talo' | 'mercadopago' | 'manual'
      taloClientId?: string | null
      taloClientSecret?: string | null
      taloUserId?: string | null
    }
  ) => {
    return fetchApi('/restaurante/pasarela-pago', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })
  },

  updateMetodosPago: async (
    token: string,
    data: {
      mercadopagoCheckout?: boolean
      mercadopagoBricks?: boolean
      transferenciaAutomatica?: boolean
      transferenciaManual?: boolean
      efectivo?: boolean
      transferenciaAlias?: string
    }
  ) => {
    return fetchApi('/restaurante/metodos-pago', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })
  },

  togglePermitirPedidosProgramados: async (token: string) => {
    return fetchApi('/restaurante/toggle-permitir-pedidos-programados', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    })
  },

  toggleUsarFranjasHorario: async (token: string) => {
    return fetchApi('/restaurante/toggle-usar-franjas-horario', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    })
  },

  toggleSoloPedidosProgramados: async (token: string) => {
    return fetchApi('/restaurante/toggle-solo-pedidos-programados', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    })
  },

  getFranjasHorario: async (token: string) => {
    return fetchApi('/restaurante/franjas-horario', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
  },

  createFranjaHorario: async (token: string, data: { nombre: string; horaInicio: string; horaFin: string; activo?: boolean; cupo?: number | null }) => {
    return fetchApi('/restaurante/franjas-horario', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    })
  },

  updateFranjaHorario: async (token: string, id: number, data: { nombre?: string; horaInicio?: string; horaFin?: string; activo?: boolean; cupo?: number | null }) => {
    return fetchApi(`/restaurante/franjas-horario/${id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    })
  },

  deleteFranjaHorario: async (token: string, id: number) => {
    return fetchApi(`/restaurante/franjas-horario/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
  },

  resetCupoFranjaHorario: async (token: string, id: number) => {
    return fetchApi(`/restaurante/franjas-horario/${id}/reset-cupo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
  },
}

// Cucuru API
export const cucuruApi = {
  configurar: async (token: string, apiKey: string, collectorId: string) => {
    return fetchApi('/restaurante/configurar-cucuru', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ apiKey, collectorId })
    })
  },
  reconfigurarWebhook: async (token: string) => {
    return fetchApi('/restaurante/reconfigurar-webhook-cucuru', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
  }
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
      agregadoIds?: number[]
      etiquetas?: string[]
      puntosGanados?: number
      puntosNecesarios?: number
      descuento?: number
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
      agregadoIds?: number[]
      activo?: boolean
      etiquetas?: string[]
      puntosGanados?: number
      puntosNecesarios?: number
      descuento?: number
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

  backfillEtiquetas: async (token: string) => {
    return fetchApi('/producto/backfill-etiquetas', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },

  bulkDescuento: (token: string, data: { productoIds: number[], descuento: number, descuentoFechaInicio?: string | null, descuentoFechaFin?: string | null }) =>
    fetchApi('/producto/bulk-descuento', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    }),

  // Reordenar productos (drag & drop): productoIds en el orden deseado
  reorder: (token: string, productoIds: number[]) =>
    fetchApi('/producto/reorder', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ productoIds }),
    }),
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

// Agregados API
export const agregadosApi = {
  getAll: async (token: string) => {
    return fetchApi('/agregado', {
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
      precio: number
    }
  ) => {
    return fetchApi('/agregado/create', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })
  },

  update: async (token: string, id: number, data: { nombre?: string; precio?: number; activo?: boolean }) => {
    return fetchApi(`/agregado/${id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })
  },

  delete: async (token: string, id: number) => {
    return fetchApi(`/agregado/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },

  getByProducto: async (token: string, productoId: number) => {
    return fetchApi(`/agregado/producto/${productoId}`, {
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

  // Actualizar estado de un item específico
  updateItemEstado: async (token: string, pedidoId: number, itemId: number, estado: string) => {
    return fetchApi(`/pedido/${pedidoId}/items/${itemId}/estado`, {
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
      ingredientesExcluidos?: number[]
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
        clienteNombre: data.clienteNombre || 'Mozo',
        ingredientesExcluidos: data.ingredientesExcluidos
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

  // Cierre de turno - obtener resumen de ventas del día
  cierreTurno: async (token: string, fecha?: string) => {
    const params = new URLSearchParams()
    if (fecha) params.append('fecha', fecha)
    const query = params.toString() ? `?${params}` : ''
    return fetchApi(`/pedido/cierre-turno${query}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },

  // Marcar/desmarcar pedido como pagado
  marcarPagado: async (token: string, pedidoId: number, metodoPago?: string) => {
    return fetchApi(`/pedido/marcar-pagado/${pedidoId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ metodoPago }),
    })
  },

  marcarImpreso: async (token: string, tipo: 'mesa' | 'delivery' | 'takeaway', id: number) => {
    return fetchApi(`/pedido/${tipo}/${id}/marcar-impreso`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },
}

// Metricas API
export const metricasApi = {
  get: async (token: string, filters?: { month?: number; year?: number; from?: string; to?: string }) => {
    const params = new URLSearchParams()
    if (filters?.month) params.append('month', String(filters.month))
    if (filters?.year) params.append('year', String(filters.year))
    if (filters?.from) params.append('from', filters.from)
    if (filters?.to) params.append('to', filters.to)
    const query = params.toString() ? `?${params.toString()}` : ''

    return fetchApi(`/metricas${query}`, {
      method: 'GET',
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

  // Pagar en efectivo (o transferencia) (para admin - marca como pending_cash)
  pagarEfectivo: async (pedidoId: number, clientesAPagar: string[], qrToken: string, mozoItemIds?: number[], metodoPago: string = 'efectivo') => {
    return fetchApi('/mp/pagar-efectivo', {
      method: 'POST',
      body: JSON.stringify({
        pedidoId,
        clientesAPagar,
        qrToken,
        mozoItemIds,
        metodoPago
      }),
    })
  },

  // Confirmar pago en efectivo/transferencia (admin confirma que recibió el dinero)
  confirmarEfectivo: async (token: string, pedidoId: number, clienteNombre: string, metodoPago: string = 'efectivo') => {
    return fetchApi('/mp/confirmar-efectivo', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        pedidoId,
        clienteNombre,
        metodoPago
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

// Pedido Unificado API (delivery + takeaway) - backend único
export type PedidoUnificadoItemInput = {
  productoId: number
  varianteId?: number
  cantidad: number
  ingredientesExcluidos?: number[]
  agregados?: Array<{ id: number; nombre: string; precio: string | number }>
}

export const pedidoUnificadoApi = {
  getAll: async (
    token: string,
    tipo: 'delivery' | 'takeaway' | 'all' = 'all',
    page = 1,
    limit = 20,
    estado?: string,
    sucursalId?: number | null,
  ) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      tipo,
    })
    if (estado) params.append('estado', estado)
    if (sucursalId != null) params.append('sucursalId', String(sucursalId))
    return fetchApi(`/pedido-unificado/list?${params}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
  },
  getById: async (token: string, id: number) => {
    return fetchApi(`/pedido-unificado/${id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
  },
  clienteContexto: async (token: string, id: number) => {
    return fetchApi(`/pedido-unificado/${id}/cliente-contexto`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
  },
  create: async (
    token: string,
    data:
      | {
          tipo: 'delivery'
          direccion: string
          nombreCliente?: string
          telefono?: string
          notas?: string
          latitud?: string | number
          longitud?: string | number
          deliveryFee?: string | number
          anotadoManualmente?: boolean
          pagado?: boolean
          metodoPago?: string
          sucursalId?: number
          notificarWhatsappPrueba?: boolean
          items: Array<PedidoUnificadoItemInput>
        }
      | {
          tipo: 'takeaway'
          nombreCliente?: string
          telefono?: string
          notas?: string
          anotadoManualmente?: boolean
          pagado?: boolean
          metodoPago?: string
          sucursalId?: number
          notificarWhatsappPrueba?: boolean
          items: Array<PedidoUnificadoItemInput>
        }
  ) => {
    return fetchApi('/pedido-unificado/create', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    })
  },
  updateEstado: async (token: string, id: number, estado: string) => {
    return fetchApi(`/pedido-unificado/${id}/estado`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ estado }),
    })
  },
  marcarPagado: async (
    token: string,
    id: number,
    metodoPagoOrOpts?: string | { metodoPago?: string; pagado?: boolean }
  ) => {
    const opts =
      typeof metodoPagoOrOpts === 'string'
        ? { metodoPago: metodoPagoOrOpts }
        : metodoPagoOrOpts ?? {}
    const body: Record<string, unknown> = {}
    if (opts.metodoPago !== undefined) body.metodoPago = opts.metodoPago
    if (opts.pagado !== undefined) body.pagado = opts.pagado
    return fetchApi(`/pedido-unificado/${id}/pagado`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
  },
  delete: async (token: string, id: number) => {
    return fetchApi(`/pedido-unificado/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
  },
  asignarRapiboy: async (token: string, pedidoId: number) => {
    return fetchApi('/pedido-unificado/rapiboy/asignar', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ pedidoId }),
    })
  },
  notificarCliente: async (token: string, pedidoId: number) => {
    return fetchApi(`/pedido-unificado/${pedidoId}/notificar-cliente`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
  },
  confirmarConDemora: async (token: string, pedidoId: number, demoraMinutos: number) => {
    return fetchApi(`/pedido-unificado/${pedidoId}/confirmar-con-demora`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ demoraMinutos }),
    })
  },
  asignarRepartidor: async (token: string, pedidoId: number, repartidorId: number | null) => {
    return fetchApi(`/pedido-unificado/${pedidoId}/repartidor`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ repartidorId }),
    })
  },
  /** Claim atómico de impresión: solo un dispositivo "gana" y debe imprimir (claimed: true) */
  claimImpreso: async (token: string, pedidoId: number) => {
    return fetchApi(`/pedido-unificado/${pedidoId}/impreso`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    })
  },
}

export const repartidoresApi = {
  list: async (token: string) =>
    fetchApi('/repartidores/list', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    }),
  create: async (token: string, nombre: string) =>
    fetchApi('/repartidores/create', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ nombre }),
    }),
  toggleEstado: async (token: string, id: number, estado: 'activo' | 'inactivo') =>
    fetchApi(`/repartidores/${id}/estado`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ estado }),
    }),
  stats: async (token: string, filters?: { from?: string; to?: string }) => {
    const params = new URLSearchParams()
    if (filters?.from) params.append('from', filters.from)
    if (filters?.to) params.append('to', filters.to)
    const query = params.toString() ? `?${params.toString()}` : ''
    return fetchApi(`/repartidores/stats${query}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
  },
}

// Delivery API - usa pedidoUnificado por detrás (compatibilidad)
export const deliveryApi = {
  asignarRapiboy: (token: string, pedidoId: number) => pedidoUnificadoApi.asignarRapiboy(token, pedidoId),
  getAll: (token: string, page = 1, limit = 20, estado?: string) =>
    pedidoUnificadoApi.getAll(token, 'delivery', page, limit, estado),
  getById: (token: string, id: number) => pedidoUnificadoApi.getById(token, id),
  create: (token: string, data: { direccion: string; nombreCliente?: string; telefono?: string; notas?: string; items: Array<{ productoId: number; cantidad: number; ingredientesExcluidos?: number[] }> }) =>
    pedidoUnificadoApi.create(token, { tipo: 'delivery', ...data }),
  updateEstado: (token: string, id: number, estado: string) => pedidoUnificadoApi.updateEstado(token, id, estado),
  delete: (token: string, id: number) => pedidoUnificadoApi.delete(token, id),
  marcarPagado: (
    token: string,
    id: number,
    metodoPagoOrOpts?: string | { metodoPago?: string; pagado?: boolean }
  ) => pedidoUnificadoApi.marcarPagado(token, id, metodoPagoOrOpts),
}

// Takeaway API - usa pedidoUnificado por detrás (compatibilidad)
export const takeawayApi = {
  getAll: (token: string, page = 1, limit = 20, estado?: string) =>
    pedidoUnificadoApi.getAll(token, 'takeaway', page, limit, estado),
  getById: (token: string, id: number) => pedidoUnificadoApi.getById(token, id),
  create: (token: string, data: { nombreCliente?: string; telefono?: string; notas?: string; items: Array<{ productoId: number; cantidad: number; ingredientesExcluidos?: number[] }> }) =>
    pedidoUnificadoApi.create(token, { tipo: 'takeaway', ...data }),
  updateEstado: (token: string, id: number, estado: string) => pedidoUnificadoApi.updateEstado(token, id, estado),
  delete: (token: string, id: number) => pedidoUnificadoApi.delete(token, id),
  marcarPagado: (
    token: string,
    id: number,
    metodoPagoOrOpts?: string | { metodoPago?: string; pagado?: boolean }
  ) => pedidoUnificadoApi.marcarPagado(token, id, metodoPagoOrOpts),
}

export const sucursalesApi = {
  list: async (token: string) => {
    return fetchApi('/sucursales/list', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
  },
}

// Códigos de Descuento API
export const codigosDescuentoApi = {
  getAll: async (token: string) => {
    return fetchApi('/codigo-descuento', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },

  create: async (
    token: string,
    data: {
      codigo: string
      tipo: 'porcentaje' | 'monto_fijo'
      valor: string
      limiteUsos?: number | null
      montoMinimo?: string
      fechaInicio?: string | null
      fechaFin?: string | null
    }
  ) => {
    return fetchApi('/codigo-descuento/create', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })
  },

  update: async (
    token: string,
    id: number,
    data: {
      codigo?: string
      tipo?: 'porcentaje' | 'monto_fijo'
      valor?: string
      limiteUsos?: number | null
      montoMinimo?: string
      fechaInicio?: string | null
      fechaFin?: string | null
      activo?: boolean
    }
  ) => {
    return fetchApi(`/codigo-descuento/${id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })
  },

  toggle: async (token: string, id: number) => {
    return fetchApi(`/codigo-descuento/${id}/toggle`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },

  delete: async (token: string, id: number) => {
    return fetchApi(`/codigo-descuento/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },
}

// Zonas de Delivery API
export const zonasDeliveryApi = {
  getAll: async (token: string) => {
    return fetchApi('/zona-delivery', {
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
      precio: string
      poligono: Array<{ lat: number; lng: number }>
      color?: string
      sucursalId?: number | null
    }
  ) => {
    return fetchApi('/zona-delivery/create', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })
  },

  update: async (
    token: string,
    id: number,
    data: {
      nombre?: string
      precio?: string
      poligono?: Array<{ lat: number; lng: number }>
      color?: string
      sucursalId?: number | null
    }
  ) => {
    return fetchApi(`/zona-delivery/${id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })
  },

  delete: async (token: string, id: number) => {
    return fetchApi(`/zona-delivery/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },
}

export const facturacionApi = {
  getEstado: async (token: string) => {
    return fetchApi('/facturacion/estado', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
  },
  configurar: async (token: string, data: { afipCuit: string; afipClaveFiscal: string; afipCondicionIva: 'RI' | 'MO' }) => {
    return fetchApi('/facturacion/configurar', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    })
  },
  desactivar: async (token: string) => {
    return fetchApi('/facturacion/desactivar', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
  },
  facturarBatch: async (token: string, pedidoIds: number[]) => {
    return fetchApi('/facturacion/facturar-batch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ pedidoIds }),
    })
  },
  getPedidosSinFacturar: async (token: string) => {
    return fetchApi('/facturacion/pedidos-sin-facturar', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
  },
  getPdfUrl: async (token: string, pedidoId: number) => {
    return fetchApi(`/facturacion/pedidos/${pedidoId}/factura/pdf`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
  },
}

// ── Planes y suscripción ──────────────────────────────────────────────────
// Cobro de la cuota del plan vía Checkout Pro (pago único a la cuenta de Piru).
export interface PlanCatalogo {
  id: number
  codigo: string
  nombre: string
  descripcion: string | null
  precioMensual: string
  // Descuento porcentual al pagar por año (0-20). Se usa para mostrar el ahorro anual.
  descuentoAnual: number
  mensajesIncluidos: number
  // Mensajes de marketing (Motor de Recompra) incluidos por ciclo (Avanzado: 100).
  mensajesMarketingIncluidos: number
  // LEGACY: ya ningún plan es ilimitado; se conserva por retrocompat (siempre false).
  mensajesIlimitados: boolean
  orden: number
  activo: boolean
  features: string[]
}

export interface WalletResumen {
  ilimitado: boolean
  cicloRenuevaEn: string | null
  utility: {
    incluidosRestantes: number
    recargaSaldo: number
    disponible: number
    cupoPlan: number
    consumidoCupo: number
    pctConsumido: number
    negativo: boolean
    // Modo gracia (deuda acotada): campos aditivos, opcionales por retrocompat con backends viejos.
    enGracia?: boolean
    graciaAgotada?: boolean
    deudaMaxima?: number
  }
  marketing: {
    incluidosRestantes: number
    recargaSaldo: number
    disponible: number
    cupoPlan: number
    consumidoCupo: number
    negativo: boolean
  }
  alerta: '80' | '95' | null
  autoRecarga: { habilitada: boolean; umbral: number; cantidad: number; sugerida: boolean }
}

export interface MiSuscripcion {
  estado: string | null
  planId: number | null
  planCodigo: string | null
  planNombre: string | null
  conAccesoAPago: boolean
  sinSuscripcion: boolean
  // Hard paywall: si requiereSuscripcion y no hay acceso, el panel se bloquea (→ /suscribir).
  requiereSuscripcion?: boolean
  accesoPanel?: boolean
  fechaProximoCobro: string | null
  graciaHasta: string | null
  fechaCancelacion: string | null
  precioMensual: string | null
  ciclo: string | null
  features: string[]
  wallet: WalletResumen
}

export const planesApi = {
  catalogo: async (token: string) =>
    fetchApi<{ success: boolean; data: PlanCatalogo[] }>('/planes/catalogo', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    }),
  miSuscripcion: async (token: string) =>
    fetchApi<{ success: boolean; data: MiSuscripcion }>('/planes/mi-suscripcion', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    }),
  // Inicia el pago de la cuota del plan → devuelve url_pago para redirigir a MP.
  suscribir: async (token: string, planId: number, ciclo: 'mensual' | 'anual' = 'mensual') =>
    fetchApi<{ success: boolean; data: { pagoId: number; url_pago: string; monto: string; ciclo: string } }>(
      '/planes/suscribir',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planId, ciclo }),
      },
    ),
  cancelar: async (token: string) =>
    fetchApi<{ success: boolean; message: string }>('/planes/cancelar', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }),
  pagos: async (token: string) =>
    fetchApi<{ success: boolean; data: any[] }>('/planes/pagos', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    }),
}

// ── Wallet de mensajes de WhatsApp (consumible) ───────────────────────────
export interface PackRecarga {
  id: number
  categoria: string
  nombre: string
  cantidad: number
  precio: string
  orden: number
  activo: boolean
}

export const mensajesApi = {
  saldo: async (token: string) =>
    fetchApi<{ success: boolean; data: WalletResumen }>('/mensajes/saldo', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    }),
  transacciones: async (token: string, page = 1, limit = 50) =>
    fetchApi<{ success: boolean; data: any[]; pagination: { page: number; limit: number; hasMore: boolean } }>(
      `/mensajes/transacciones?page=${page}&limit=${limit}`,
      { method: 'GET', headers: { Authorization: `Bearer ${token}` } },
    ),
  packs: async (token: string, categoria?: 'utility' | 'marketing') =>
    fetchApi<{ success: boolean; data: PackRecarga[] }>(
      `/mensajes/packs${categoria ? `?categoria=${categoria}` : ''}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      },
    ),
  // Inicia la compra de un pack → devuelve url_pago para redirigir a MP.
  recargaCheckout: async (token: string, packId: number) =>
    fetchApi<{ success: boolean; data: { recargaId: number; url_pago: string; cantidad: number; monto: string } }>(
      '/mensajes/recarga/checkout',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ packId }),
      },
    ),
  setAutoRecarga: async (
    token: string,
    cfg: { habilitada: boolean; umbral?: number | null; cantidad?: number | null },
  ) =>
    fetchApi<{ success: boolean; data: WalletResumen }>('/mensajes/auto-recarga', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(cfg),
    }),
  // Auto-recarga asistida: el server elige el pack por config → devuelve url_pago.
  autoRecargaCheckout: async (token: string) =>
    fetchApi<{ success: boolean; data: { recargaId: number; url_pago: string; cantidad: number; monto: string } }>(
      '/mensajes/auto-recarga/checkout',
      { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
    ),
  // Genera un link/QR de pago para un pack (para pagar desde el celular, sin login).
  crearPagoQr: async (token: string, packId: number) =>
    fetchApi<{ success: boolean; data: { recargaId: number; token: string; url: string; expiraEn: string } }>(
      '/mensajes/pago-qr',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ packId }),
      },
    ),
}

// ── Link de pago público (/pago/:token) — SIN autenticación ───────────────
export interface PagoLinkInfo {
  estado: 'pending' | 'paid' | 'expired'
  restauranteNombre: string
  concepto: string
  cantidad: number
  categoria: 'utility' | 'marketing'
  unidad: string
  monto: string
}

export const pagoApi = {
  info: async (token: string) =>
    fetchApi<{ success: boolean; data: PagoLinkInfo }>(`/pago/${token}`, { method: 'GET' }),
  checkout: async (token: string) =>
    fetchApi<{ success: boolean; data: { url_pago: string } }>(`/pago/${token}/checkout`, {
      method: 'POST',
    }),
}