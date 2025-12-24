import { useEffect, useRef, useState } from 'react'

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
  nombre?: string
}

interface MesaState {
  mesaId: number
  pedidoId: number
  clientes: Cliente[]
  items: ItemPedido[]
  total: string
  estado: 'pending' | 'preparing' | 'delivered' | 'closed'
}

interface UseMesaWebSocketReturn {
  state: MesaState | null
  isConnected: boolean
  error: string | null
}

const WS_URL = import.meta.env.VITE_WS_URL || 'wss://api.piru.app'

export const useMesaWebSocket = (qrToken: string | null): UseMesaWebSocketReturn => {
  const [state, setState] = useState<MesaState | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!qrToken) return

    const connect = () => {
      try {
        const ws = new WebSocket(`${WS_URL}/ws/${qrToken}`)
        wsRef.current = ws

        ws.onopen = () => {
          console.log('WebSocket conectado para mesa:', qrToken)
          setIsConnected(true)
          setError(null)
        }

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            console.log('Mensaje WebSocket recibido:', data)

            switch (data.type) {
              case 'ESTADO_INICIAL':
                setState({
                  mesaId: data.payload.mesaId,
                  pedidoId: data.payload.pedidoId,
                  clientes: data.payload.clientes || [],
                  items: data.payload.items || [],
                  total: data.payload.total || '0.00',
                  estado: data.payload.estado || 'pending',
                })
                break

              case 'CLIENTE_UNIDO':
                setState((prev) => prev ? {
                  ...prev,
                  clientes: data.payload.clientes || prev.clientes,
                } : null)
                break

              case 'CLIENTE_DESCONECTADO':
                setState((prev) => prev ? {
                  ...prev,
                  clientes: data.payload.clientes || prev.clientes,
                } : null)
                break

              case 'ITEM_AGREGADO':
                setState((prev) => prev ? {
                  ...prev,
                  items: data.payload.items || prev.items,
                  total: data.payload.total || prev.total,
                } : null)
                break

              case 'ITEM_ELIMINADO':
                setState((prev) => prev ? {
                  ...prev,
                  items: data.payload.items || prev.items,
                  total: data.payload.total || prev.total,
                } : null)
                break

              case 'CANTIDAD_ACTUALIZADA':
                setState((prev) => prev ? {
                  ...prev,
                  items: data.payload.items || prev.items,
                  total: data.payload.total || prev.total,
                } : null)
                break

              case 'PEDIDO_CONFIRMADO':
                setState((prev) => prev ? {
                  ...prev,
                  estado: 'preparing',
                } : null)
                break

              case 'ERROR':
                console.error('Error del servidor:', data.payload)
                setError(data.payload.message)
                break
            }
          } catch (err) {
            console.error('Error parseando mensaje WebSocket:', err)
          }
        }

        ws.onerror = (event) => {
          console.error('Error WebSocket:', event)
          setError('Error de conexión WebSocket')
          setIsConnected(false)
        }

        ws.onclose = () => {
          console.log('WebSocket cerrado, intentando reconectar...')
          setIsConnected(false)
          
          // Intentar reconectar después de 3 segundos
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, 3000)
        }
      } catch (err) {
        console.error('Error creando WebSocket:', err)
        setError('No se pudo conectar al servidor')
      }
    }

    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [qrToken])

  return { state, isConnected, error }
}

