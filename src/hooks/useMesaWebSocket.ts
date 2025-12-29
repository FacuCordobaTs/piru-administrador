import { useEffect, useRef, useState, useCallback } from 'react'

interface Cliente {
  id: string
  nombre: string
}

interface ItemPedido {
  id: number
  productoId: number
  clienteNombre: string
  cantidad: number
  precioUnitario: string
  nombreProducto?: string
  imagenUrl?: string | null
}

interface PedidoInfo {
  id: number
  estado: 'pending' | 'preparing' | 'delivered' | 'closed'
  total: string
  createdAt: string
  closedAt?: string | null
}

interface MesaState {
  mesaId: number
  pedidoId: number
  clientes: Cliente[]
  items: ItemPedido[]
  total: string
  estado: 'pending' | 'preparing' | 'delivered' | 'closed'
  pedido?: PedidoInfo | null
}

interface UseMesaWebSocketReturn {
  state: MesaState | null
  isConnected: boolean
  error: string | null
  sendMessage: (message: any) => void
  disconnect: () => void
}

const WS_URL = import.meta.env.VITE_WS_URL || 'wss://api.piru.app'

// Singleton para manejar conexiones de admin


export const useMesaWebSocket = (qrToken: string | null): UseMesaWebSocketReturn => {
  const [state, setState] = useState<MesaState | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isCleaningUpRef = useRef(false)
  const mountedRef = useRef(true)

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    }
  }, [])

  const disconnect = useCallback(() => {
    isCleaningUpRef.current = true
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect')
      wsRef.current = null
    }
    setIsConnected(false)
    setState(null)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    isCleaningUpRef.current = false

    if (!qrToken) {
      setState(null)
      setIsConnected(false)
      setError(null)
      return
    }

    // Generar ID único para esta instancia de admin
    const adminId = `admin-observer-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`

    const connect = () => {
      if (isCleaningUpRef.current || !mountedRef.current) {
        return
      }

      // Evitar conexiones duplicadas
      if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
        return
      }

      try {
        const ws = new WebSocket(`${WS_URL}/ws/${qrToken}`)
        wsRef.current = ws

        ws.onopen = () => {
          if (!mountedRef.current || isCleaningUpRef.current) {
            ws.close(1000, 'Component unmounted')
            return
          }

          setIsConnected(true)
          setError(null)

          // Enviar mensaje de identificación como observador admin
          // Usamos un prefijo especial para que el backend pueda filtrar estos clientes
          ws.send(JSON.stringify({
            type: 'CLIENTE_CONECTADO',
            payload: {
              clienteId: adminId,
              nombre: '🔍 Admin Observer'
            }
          }))
        }

        ws.onmessage = (event) => {
          if (!mountedRef.current) return

          try {
            const data = JSON.parse(event.data)

            // Filtrar clientes admin de la lista
            const filterAdminClients = (clientes: Cliente[]) => 
              (clientes || []).filter(
                (c: Cliente) => !c.id.startsWith('admin-') && 
                                !c.nombre.includes('Admin') && 
                                !c.nombre.includes('Observer')
              )

            switch (data.type) {
              case 'ESTADO_INICIAL':
                setState({
                  mesaId: data.payload.mesaId,
                  pedidoId: data.payload.pedidoId,
                  clientes: filterAdminClients(data.payload.clientes || []),
                  items: data.payload.items || [],
                  total: data.payload.total || data.payload.pedido?.total || '0.00',
                  estado: data.payload.estado || data.payload.pedido?.estado || 'pending',
                  pedido: data.payload.pedido || null
                })
                break

              case 'CLIENTE_UNIDO':
                setState((prev) => prev ? {
                  ...prev,
                  clientes: filterAdminClients(data.payload.clientes || prev.clientes)
                } : null)
                break

              case 'CLIENTE_DESCONECTADO':
                setState((prev) => prev ? {
                  ...prev,
                  clientes: filterAdminClients(data.payload.clientes || prev.clientes)
                } : null)
                break

              case 'PEDIDO_ACTUALIZADO':
                setState((prev) => prev ? {
                  ...prev,
                  items: data.payload.items || prev.items,
                  total: data.payload.pedido?.total || prev.total,
                  estado: data.payload.pedido?.estado || prev.estado,
                  pedido: data.payload.pedido || prev.pedido
                } : null)
                break

              case 'PEDIDO_CONFIRMADO':
                setState((prev) => prev ? {
                  ...prev,
                  items: data.payload.items || prev.items,
                  total: data.payload.pedido?.total || prev.total,
                  estado: 'preparing',
                  pedido: data.payload.pedido || prev.pedido
                } : null)
                break

              case 'PEDIDO_CERRADO':
                setState((prev) => prev ? {
                  ...prev,
                  items: data.payload.items || prev.items,
                  total: data.payload.pedido?.total || prev.total,
                  estado: 'closed',
                  pedido: data.payload.pedido || prev.pedido
                } : null)
                break

              case 'ERROR':
                setError(data.payload.message)
                break
            }
          } catch (err) {
            console.error('Error parseando mensaje WebSocket:', err)
          }
        }

        ws.onerror = () => {
          if (!mountedRef.current) return
          setError('Error de conexión WebSocket')
          setIsConnected(false)
        }

        ws.onclose = (event) => {
          if (!mountedRef.current || isCleaningUpRef.current) {
            return
          }

          setIsConnected(false)

          // Solo reconectar si no fue un cierre intencional y el componente sigue montado
          if (event.code !== 1000 && mountedRef.current && !isCleaningUpRef.current) {
            reconnectTimeoutRef.current = setTimeout(() => {
              if (mountedRef.current && !isCleaningUpRef.current) {
                connect()
              }
            }, 5000)
          }
        }
      } catch (err) {
        console.error('Error creando WebSocket:', err)
        setError('No se pudo conectar al servidor')
      }
    }

    connect()

    return () => {
      mountedRef.current = false
      isCleaningUpRef.current = true

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmount')
        wsRef.current = null
      }
    }
  }, [qrToken])

  return { state, isConnected, error, sendMessage, disconnect }
}
