import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'
import { notificacionesApi } from '@/lib/api'

// Types - Only important notifications (connect/disconnect are not shown)
export type NotificationType =
  | 'NUEVO_PEDIDO'
  | 'PEDIDO_CONFIRMADO'
  | 'PEDIDO_CERRADO'
  | 'LLAMADA_MOZO'
  | 'PAGO_RECIBIDO'
  | 'PRODUCTO_AGREGADO'

export interface Notification {
  id: string
  tipo: NotificationType
  mesaId: number
  mesaNombre?: string
  pedidoId?: number
  mensaje: string
  detalles?: string
  timestamp: string
  leida: boolean
}

export interface ItemPedido {
  id: number
  productoId: number
  clienteNombre: string
  cantidad: number
  precioUnitario: string
  nombreProducto?: string
  imagenUrl?: string | null
  ingredientesExcluidos?: number[]
  ingredientesExcluidosNombres?: string[]
  postConfirmacion?: boolean
}

export interface Pedido {
  id: number
  estado: 'pending' | 'preparing' | 'delivered' | 'closed'
  total: string
  createdAt: string
  closedAt?: string | null
}

export interface ClienteConectado {
  id: string
  nombre: string
}

export interface MesaConPedido {
  id: number
  nombre: string
  qrToken: string
  pedido: Pedido | null
  items: ItemPedido[]
  clientesConectados: ClienteConectado[]
  totalItems: number
  todosPagaron?: boolean // true si el pedido cerrado tiene todos los pagos completados
}

export interface SubtotalActualizado {
  clienteNombre: string
  monto: string
  estado: 'pending' | 'pending_cash' | 'paid' | 'failed'
  metodo: 'efectivo' | 'mercadopago' | null
}

export interface SubtotalesUpdate {
  pedidoId: number
  mesaId: number
  mesaNombre: string
  clientesPagados: string[]
  todosSubtotales: SubtotalActualizado[]
}

interface UseAdminWebSocketReturn {
  mesas: MesaConPedido[]
  notifications: Notification[]
  isConnected: boolean
  error: string | null
  unreadCount: number
  subtotalesUpdates: Map<number, SubtotalesUpdate>
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  deleteNotification: (id: string) => void
  clearNotifications: () => void
  refresh: () => void
}

const WS_URL = import.meta.env.VITE_WS_URL || 'wss://api.piru.app'

// Clean up old localStorage data from previous implementation
const cleanupOldStorage = () => {
  try {
    localStorage.removeItem('admin_notifications')
    localStorage.removeItem('admin_seen_notification_ids')
  } catch (e) {
    // Ignore errors
  }
}

// Run cleanup once when module loads
cleanupOldStorage()

export const useAdminWebSocket = (): UseAdminWebSocketReturn => {
  const token = useAuthStore((state) => state.token)
  const [mesas, setMesas] = useState<MesaConPedido[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subtotalesUpdates, setSubtotalesUpdates] = useState<Map<number, SubtotalesUpdate>>(new Map())

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isConnectingRef = useRef(false)
  const connectionIdRef = useRef<string | null>(null)

  // Mark notification as read via API
  const markAsRead = useCallback(async (id: string) => {
    if (!token) return

    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n))

    try {
      await notificacionesApi.markAsRead(token, id)
    } catch (error) {
      console.error('Error marking notification as read:', error)
      // Revert on error - refetch from server
    }
  }, [token])

  // Mark all notifications as read via API
  const markAllAsRead = useCallback(async () => {
    if (!token) return

    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, leida: true })))

    try {
      await notificacionesApi.markAllAsRead(token)
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    }
  }, [token])

  // Delete notification via API
  const deleteNotification = useCallback(async (id: string) => {
    if (!token) return

    // Optimistic update
    setNotifications(prev => prev.filter(n => n.id !== id))

    try {
      await notificacionesApi.delete(token, id)
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  }, [token])

  // Clear all notifications via API
  const clearNotifications = useCallback(async () => {
    if (!token) return

    // Optimistic update
    setNotifications([])

    try {
      await notificacionesApi.deleteAll(token)
    } catch (error) {
      console.error('Error clearing notifications:', error)
    }
  }, [token])

  const refresh = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'REFRESH_MESAS' }))
    }
  }, [])

  // Cleanup function
  const cleanup = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
      heartbeatIntervalRef.current = null
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (wsRef.current) {
      // Remove all listeners to prevent callbacks after cleanup
      wsRef.current.onopen = null
      wsRef.current.onmessage = null
      wsRef.current.onerror = null
      wsRef.current.onclose = null

      if (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close(1000, 'Cleanup')
      }
      wsRef.current = null
    }

    isConnectingRef.current = false
    connectionIdRef.current = null
  }, [])

  useEffect(() => {
    if (!token) {
      cleanup()
      setMesas([])
      setNotifications([])
      setIsConnected(false)
      return
    }

    // Generate unique ID for this connection attempt
    const thisConnectionId = `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    connectionIdRef.current = thisConnectionId

    const connect = () => {
      // Prevent duplicate connections
      if (isConnectingRef.current) {
        console.log('⏳ Already connecting, skipping...')
        return
      }

      // Check if this connection attempt is still valid
      if (connectionIdRef.current !== thisConnectionId) {
        console.log('🚫 Stale connection attempt, aborting')
        return
      }

      // Close any existing connection first
      if (wsRef.current) {
        wsRef.current.onopen = null
        wsRef.current.onmessage = null
        wsRef.current.onerror = null
        wsRef.current.onclose = null
        if (wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING) {
          wsRef.current.close(1000, 'New connection')
        }
        wsRef.current = null
      }

      isConnectingRef.current = true

      try {
        const wsUrl = `${WS_URL}/ws/admin?token=${encodeURIComponent(token)}`
        console.log('🔌 Connecting to admin WebSocket...')
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
          // Verify this is still the current connection
          if (connectionIdRef.current !== thisConnectionId) {
            console.log('🚫 Connection opened but is stale, closing')
            ws.close(1000, 'Stale connection')
            return
          }

          console.log('🔑 Admin WebSocket connected')
          isConnectingRef.current = false
          setIsConnected(true)
          setError(null)
        }

        ws.onmessage = (event) => {
          // Verify this is still the current connection
          if (connectionIdRef.current !== thisConnectionId) {
            return
          }

          try {
            const data = JSON.parse(event.data)

            switch (data.type) {
              case 'ADMIN_ESTADO_MESAS':
                setMesas(data.payload.mesas || [])
                break

              case 'ADMIN_NOTIFICACIONES_INICIAL':
                // Initial notifications from database
                const initialNotifs = (data.payload.notificaciones || []).map((n: any) => ({
                  ...n,
                  // Ensure timestamp is in ISO format
                  timestamp: n.timestamp ? new Date(n.timestamp).toISOString() : new Date().toISOString()
                }))
                console.log(`📥 Received ${initialNotifs.length} initial notifications from server`)
                setNotifications(initialNotifs)
                break

              case 'ADMIN_NOTIFICACION':
                const newNotification = data.payload as Notification
                console.log('🔔 New notification:', newNotification.mensaje)

                setNotifications(prev => {
                  // Check if already exists (avoid duplicates)
                  if (prev.some(n => n.id === newNotification.id)) {
                    return prev
                  }
                  // Add to beginning, limit to 100
                  return [newNotification, ...prev].slice(0, 100)
                })
                break

              case 'PONG':
                // Heartbeat response
                break

              case 'ADMIN_SUBTOTALES_ACTUALIZADOS':
                // Actualización de subtotales pagados (split payment)
                const subtotalesUpdate = data.payload as SubtotalesUpdate
                console.log('📊 Subtotales actualizados:', subtotalesUpdate)
                setSubtotalesUpdates(prev => {
                  const newMap = new Map(prev)
                  newMap.set(subtotalesUpdate.pedidoId, subtotalesUpdate)
                  return newMap
                })
                break
            }
          } catch (err) {
            console.error('Error parsing admin WebSocket message:', err)
          }
        }

        ws.onerror = () => {
          if (connectionIdRef.current !== thisConnectionId) return

          console.error('❌ WebSocket error')
          setError('Error de conexión')
          setIsConnected(false)
          isConnectingRef.current = false
        }

        ws.onclose = (event) => {
          if (connectionIdRef.current !== thisConnectionId) {
            console.log('🔓 Stale connection closed, ignoring')
            return
          }

          console.log('🔓 Admin WebSocket disconnected, code:', event.code)
          setIsConnected(false)
          isConnectingRef.current = false

          // Don't reconnect for normal closure or invalid token
          if (event.code === 1000 || event.code === 1008) {
            if (event.code === 1008) {
              setError('Token inválido - Por favor inicia sesión nuevamente')
            }
            return
          }

          // Reconnect with delay
          console.log('🔄 Reconnecting in 3 seconds...')
          reconnectTimeoutRef.current = setTimeout(() => {
            if (connectionIdRef.current === thisConnectionId) {
              connect()
            }
          }, 3000)
        }
      } catch (err) {
        console.error('Error creating admin WebSocket:', err)
        setError('No se pudo conectar')
        isConnectingRef.current = false
      }
    }

    connect()

    // Heartbeat to keep connection alive
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'PING' }))
      }
    }, 30000)

    return () => {
      console.log('🧹 Cleaning up WebSocket connection')
      connectionIdRef.current = null // Invalidate this connection
      cleanup()
    }
  }, [token, cleanup])

  const unreadCount = notifications.filter(n => !n.leida).length

  return {
    mesas,
    notifications,
    isConnected,
    error,
    unreadCount,
    subtotalesUpdates,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearNotifications,
    refresh
  }
}
