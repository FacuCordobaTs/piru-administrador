import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAuthStore } from '@/store/authStore'
import { mesasApi, pedidosApi, ApiError } from '@/lib/api'
import { useAdminWebSocket, type Notification, type MesaConPedido } from '@/hooks/useAdminWebSocket'
import { toast } from 'sonner'
import MesaQRCode from '@/components/MesaQRCode'
import { 
  Bell, BellOff, ShoppingCart, Users, Loader2, QrCode, Plus, 
  Wifi, WifiOff, Clock, CheckCircle, XCircle, Coffee, CreditCard, 
  Utensils, ChefHat, RefreshCw, Volume2, VolumeX, Trash2,
  ArrowRight, HandMetal, MoreVertical, LayoutGrid, History, Sparkles,
  RotateCcw
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// Helper para obtener el badge del estado
const getEstadoBadge = (estado: string | null | undefined) => {
  const estados: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
    pending: { label: 'Preparando pedido', variant: 'outline', icon: Clock },
    preparing: { label: 'Cocinando', variant: 'default', icon: ChefHat },
    delivered: { label: 'Entregado', variant: 'secondary', icon: Utensils },
    closed: { label: 'Cerrado', variant: 'secondary', icon: CheckCircle },
  }
  return estados[estado || 'pending'] || { label: 'Disponible', variant: 'outline', icon: Coffee }
}

// Helper para obtener info de notificación
const getNotificationInfo = (tipo: string) => {
  const tipos: Record<string, { 
    icon: any
    label: string
    // Color para el indicador/acento
    accentColor: string
    // Fondo opaco para NO leídas
    unreadBg: string
    // Fondo claro para iconos en dialogs
    bgColor: string
    // Color de texto/icono
    color: string
    priority: 'urgent' | 'high' | 'normal' | 'low'
  }> = {
    LLAMADA_MOZO: { 
      icon: HandMetal, 
      label: '¡MOZO!',
      accentColor: 'bg-red-500',
      unreadBg: 'bg-red-500',
      bgColor: 'bg-red-100',
      color: 'text-red-500',
      priority: 'urgent'
    },
    PEDIDO_CONFIRMADO: { 
      icon: ChefHat, 
      label: 'Nuevo pedido',
      accentColor: 'bg-emerald-500',
      unreadBg: 'bg-emerald-600',
      bgColor: 'bg-emerald-100',
      color: 'text-emerald-500',
      priority: 'high'
    },
    PAGO_RECIBIDO: { 
      icon: CreditCard, 
      label: 'Pago',
      accentColor: 'bg-violet-500',
      unreadBg: 'bg-violet-600',
      bgColor: 'bg-violet-100',
      color: 'text-violet-500',
      priority: 'high'
    },
    PRODUCTO_AGREGADO: { 
      icon: Plus, 
      label: 'Producto',
      accentColor: 'bg-amber-500',
      unreadBg: 'bg-amber-500',
      bgColor: 'bg-amber-100',
      color: 'text-amber-500',
      priority: 'normal'
    },
    NUEVO_PEDIDO: { 
      icon: ShoppingCart, 
      label: 'Mesa activa',
      accentColor: 'bg-blue-500',
      unreadBg: 'bg-blue-600',
      bgColor: 'bg-blue-100',
      color: 'text-blue-500',
      priority: 'normal'
    },
    PEDIDO_CERRADO: { 
      icon: CheckCircle, 
      label: 'Cerrado',
      accentColor: 'bg-slate-400',
      unreadBg: 'bg-slate-500',
      bgColor: 'bg-slate-100',
      color: 'text-slate-500',
      priority: 'low'
    },
  }
  return tipos[tipo] || { 
    icon: Bell, 
    label: 'Info',
    accentColor: 'bg-slate-400',
    unreadBg: 'bg-slate-500',
    bgColor: 'bg-slate-100',
    color: 'text-slate-500',
    priority: 'low' as const
  }
}

// Helper para calcular tiempo transcurrido
const getTimeAgo = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 1) return 'Ahora'
  if (diffMins < 60) return `${diffMins}m`
  
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h`
  
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

// Helper para tiempo transcurrido detallado
const getTimeAgoDetailed = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 1) return 'Hace un momento'
  if (diffMins === 1) return 'Hace 1 minuto'
  if (diffMins < 60) return `Hace ${diffMins} minutos`
  
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours === 1) return 'Hace 1 hora'
  if (diffHours < 24) return `Hace ${diffHours} horas`
  
  return date.toLocaleDateString('es-ES', { 
    day: 'numeric', 
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const Dashboard = () => {
  const navigate = useNavigate()
  const token = useAuthStore((state) => state.token)
  const restaurante = useAuthStore((state) => state.restaurante)
  
  // Admin WebSocket for real-time updates
  const { 
    mesas: mesasWS, 
    notifications, 
    isConnected, 
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearNotifications,
    refresh 
  } = useAdminWebSocket()

  // Local state
  const [mesas, setMesas] = useState<MesaConPedido[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedMesa, setSelectedMesa] = useState<MesaConPedido | null>(null)
  const [verQR, setVerQR] = useState(false)
  const [crearMesaDialog, setCrearMesaDialog] = useState(false)
  const [nombreMesa, setNombreMesa] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [eliminarMesaDialog, setEliminarMesaDialog] = useState(false)
  const [mesaAEliminar, setMesaAEliminar] = useState<MesaConPedido | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)
  const [abrirMesaDialog, setAbrirMesaDialog] = useState(false)
  const [mesaAAbrir, setMesaAAbrir] = useState<MesaConPedido | null>(null)
  const [isOpening, setIsOpening] = useState(false)
  const [resetearMesaDialog, setResetearMesaDialog] = useState(false)
  const [mesaAResetear, setMesaAResetear] = useState<MesaConPedido | null>(null)
  const [isResetting, setIsResetting] = useState(false)
  const [eliminarTodasNotificacionesDialog, setEliminarTodasNotificacionesDialog] = useState(false)
  const [isDeletingAllNotifications, setIsDeletingAllNotifications] = useState(false)

  // MOBILE VIEW STATE: 'mesas' | 'notifications'
  const [mobileView, setMobileView] = useState<'mesas' | 'notifications'>('mesas')

  // Estado para guardar los últimos pedidos cerrados por mesa (usando notificaciones)
  const [ultimosPedidosCerrados, setUltimosPedidosCerrados] = useState<Map<number, number>>(new Map()) // mesaId -> pedidoId
  
  // Estado para guardar los datos del pedido cerrado cargado por mesa
  const [datosPedidoCerrado, setDatosPedidoCerrado] = useState<Map<number, {
    pedido: { id: number; estado: string; total: string; createdAt: string };
    items: { id: number; cantidad: number; nombreProducto: string; precioUnitario: string; clienteNombre: string; ingredientesExcluidosNombres?: string[] }[];
    totalItems: number;
  }>>(new Map())
  
  // Estado para controlar qué mesas están mostrando el pedido cerrado
  const [mostrandoPedidoCerrado, setMostrandoPedidoCerrado] = useState<Set<number>>(new Set())
  
  // Estado para indicar qué mesa está cargando datos
  const [cargandoPedido, setCargandoPedido] = useState<number | null>(null)
  
  // Ref para rastrear notificaciones procesadas (evitar sonido en carga inicial)
  const processedNotificationsRef = useRef<Set<string>>(new Set())
  const isInitialLoadRef = useRef(true)

  // Update mesas from WebSocket
  useEffect(() => {
    if (mesasWS.length > 0) {
      setMesas(mesasWS)
      setIsLoading(false)
      
      // Si una mesa que estaba mostrando pedido cerrado ahora tiene un pedido confirmado, quitar la vista del cerrado
      setMostrandoPedidoCerrado(prev => {
        const newSet = new Set(prev)
        mesasWS.forEach(mesa => {
          if (mesa.pedido?.estado === 'preparing' || mesa.pedido?.estado === 'delivered') {
            newSet.delete(mesa.id)
          }
        })
        return newSet
      })
    }
  }, [mesasWS])
  
  // Función para cargar y mostrar pedido cerrado
  const verPedidoCerrado = async (mesaId: number, pedidoId: number) => {
    if (!token) return
    
    setCargandoPedido(mesaId)
    
    try {
      const response = await pedidosApi.getById(token, pedidoId) as {
        success: boolean
        data: {
          id: number
          estado: string
          total: string
          createdAt: string
          items: { id: number; cantidad: number; nombreProducto: string; precioUnitario: string; clienteNombre: string; ingredientesExcluidosNombres?: string[] }[]
        }
      }
      
      if (response.success && response.data) {
        setDatosPedidoCerrado(prev => {
          const newMap = new Map(prev)
          newMap.set(mesaId, {
            pedido: {
              id: response.data.id,
              estado: response.data.estado,
              total: response.data.total,
              createdAt: response.data.createdAt
            },
            items: response.data.items,
            totalItems: response.data.items.reduce((sum, item) => sum + item.cantidad, 0)
          })
          return newMap
        })
        
        setMostrandoPedidoCerrado(prev => {
          const newSet = new Set(prev)
          newSet.add(mesaId)
          return newSet
        })
      }
    } catch (error) {
      console.error('Error cargando pedido cerrado:', error)
      toast.error('Error al cargar pedido anterior')
    } finally {
      setCargandoPedido(null)
    }
  }
  
  // Función para volver a mostrar el pedido actual
  const verPedidoActual = (mesaId: number) => {
    setMostrandoPedidoCerrado(prev => {
      const newSet = new Set(prev)
      newSet.delete(mesaId)
      return newSet
    })
  }

  // Detectar notificaciones de pedido cerrado para guardar el pedidoId
  useEffect(() => {
    if (notifications.length > 0) {
      const notifsCerrados = notifications.filter(n => n.tipo === 'PEDIDO_CERRADO' && n.mesaId && n.pedidoId)
      if (notifsCerrados.length > 0) {
        setUltimosPedidosCerrados(prev => {
          const newMap = new Map(prev)
          notifsCerrados.forEach(notif => {
            // Solo guardar si no hay ya uno guardado o si es más reciente
            if (notif.mesaId && notif.pedidoId) {
              const existing = newMap.get(notif.mesaId)
              if (!existing || notif.pedidoId > existing) {
                newMap.set(notif.mesaId, notif.pedidoId)
              }
            }
          })
          return newMap
        })
      }
    }
  }, [notifications])

  // Play sound on new important notifications
  useEffect(() => {
    if (notifications.length === 0) {
      // Reset on empty
      isInitialLoadRef.current = true
      return
    }
    
    // On initial load, just mark all current notifications as processed (no sound)
    if (isInitialLoadRef.current) {
      notifications.forEach(n => processedNotificationsRef.current.add(n.id))
      isInitialLoadRef.current = false
      return
    }
    
    // Find truly new notifications (not processed yet)
    const newNotifications = notifications.filter(
      n => !processedNotificationsRef.current.has(n.id) && 
           !n.leida && 
           ['PEDIDO_CONFIRMADO', 'LLAMADA_MOZO', 'PAGO_RECIBIDO', 'PRODUCTO_AGREGADO'].includes(n.tipo)
    )
    
    if (newNotifications.length > 0 && soundEnabled) {
      // Play notification sound for new notifications
      try {
        const audio = new Audio('/notification.mp3')
        audio.volume = 0.5
        audio.play().catch(() => {})
      } catch {}
      
      // Show toast for the most recent important notification
      const latestNotif = newNotifications[0]
      if (latestNotif.tipo === 'LLAMADA_MOZO') {
        toast.warning(latestNotif.mensaje, {
          description: latestNotif.detalles,
          duration: 10000,
        })
      } else if (latestNotif.tipo === 'PEDIDO_CONFIRMADO') {
        toast.success(latestNotif.mensaje, {
          description: latestNotif.detalles,
        })
      }
    }
    
    // Mark all current notifications as processed
    notifications.forEach(n => processedNotificationsRef.current.add(n.id))
  }, [notifications, soundEnabled])

  // Fetch mesas via REST API
  const fetchMesasREST = useCallback(async () => {
    if (!token) return
    
    try {
      const response = await mesasApi.getAllWithPedidos(token) as {
        success: boolean
        data: any[]
      }
      
      if (response.success && response.data) {
        // Transform to match WebSocket format
        const transformed = response.data.map(m => ({
          ...m,
          clientesConectados: [],
          totalItems: m.items?.reduce((sum: number, item: any) => sum + (item.cantidad || 1), 0) || 0
        }))
        setMesas(transformed)
      }
    } catch (error) {
      console.error('Error fetching mesas:', error)
    } finally {
      setIsLoading(false)
    }
  }, [token])

  // Combined refresh function (WebSocket + REST fallback)
  const handleRefresh = useCallback(async () => {
    if (isConnected) {
      refresh() // WebSocket refresh
    } else {
      await fetchMesasREST() // REST API fallback
    }
  }, [isConnected, refresh, fetchMesasREST])

  // Initial fetch - siempre cargar al montar el componente
  useEffect(() => {
    fetchMesasREST()
  }, [fetchMesasREST])

  const handleCrearMesa = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!token || !nombreMesa.trim()) {
      toast.error('El nombre de la mesa es requerido')
      return
    }

    setIsCreating(true)

    try {
      await mesasApi.create(token, nombreMesa)
      toast.success('Mesa creada correctamente')
      setCrearMesaDialog(false)
      setNombreMesa('')
      // Refresh both ways to ensure data is updated
      refresh()
      await fetchMesasREST()
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      }
    } finally {
      setIsCreating(false)
    }
  }

  const handleEliminarMesa = async () => {
    if (!token || !mesaAEliminar) return

    setIsDeleting(true)

    try {
      await mesasApi.delete(token, mesaAEliminar.id)
      toast.success('Mesa eliminada')
      setEliminarMesaDialog(false)
      setMesaAEliminar(null)
      setSelectedMesa(null)
      refresh()
      await fetchMesasREST()
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      }
    } finally {
      setIsDeleting(false)
    }
  }

  // Abrir mesa manualmente (crear pedido)
  const handleAbrirMesa = async () => {
    if (!token || !mesaAAbrir) return

    setIsOpening(true)

    try {
      const response = await pedidosApi.createManual(token, mesaAAbrir.id) as {
        success: boolean
        data: { pedidoId: number; existing: boolean }
      }
      
      if (response.success && response.data) {
        if (response.data.existing) {
          toast.info('Ya existe un pedido activo para esta mesa')
        } else {
          toast.success('Mesa abierta correctamente')
        }
        setAbrirMesaDialog(false)
        setMesaAAbrir(null)
        // Redirigir al pedido
        navigate(`/dashboard/pedidos/${response.data.pedidoId}`)
      }
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      }
    } finally {
      setIsOpening(false)
    }
  }

  // Resetear mesa (cerrar pedido actual y crear uno nuevo vacío)
  const handleResetearMesa = async () => {
    if (!token || !mesaAResetear) return

    setIsResetting(true)

    try {
      const response = await mesasApi.reset(token, mesaAResetear.id) as {
        success: boolean
        data: { pedidoAnteriorId: number | null; nuevoPedidoId: number }
      }
      
      if (response.success) {
        toast.success('Mesa reseteada correctamente')
        setResetearMesaDialog(false)
        setMesaAResetear(null)
        // Refrescar datos
        refresh()
        await fetchMesasREST()
      }
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      }
    } finally {
      setIsResetting(false)
    }
  }

  // Eliminar todas las notificaciones
  const handleEliminarTodasNotificaciones = async () => {
    if (!token) return

    setIsDeletingAllNotifications(true)

    try {
      await clearNotifications()
      toast.success('Todas las notificaciones eliminadas')
      setEliminarTodasNotificacionesDialog(false)
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error('Error al eliminar notificaciones')
      }
    } finally {
      setIsDeletingAllNotifications(false)
    }
  }

  // Manejar clic en tarjeta de mesa
  const handleMesaClick = (mesa: MesaConPedido) => {
    const hasActiveOrder = mesa.pedido && mesa.pedido.estado !== 'closed'
    const isConfirmed = mesa.pedido?.estado === 'preparing' || mesa.pedido?.estado === 'delivered'
    const isLibre = !isConfirmed && mesa.clientesConectados.length === 0 && !hasActiveOrder
    
    if (isLibre) {
      // Mesa libre - mostrar diálogo para abrir
      setMesaAAbrir(mesa)
      setAbrirMesaDialog(true)
    } else if (hasActiveOrder && mesa.pedido) {
      // Mesa con pedido activo - ir directamente al pedido
      navigate(`/dashboard/pedidos/${mesa.pedido.id}`)
    } else {
      // Mostrar detalles normales
      setSelectedMesa(mesa)
    }
  }

  // Calcular notificaciones sin leer por mesa
  const unreadNotificationsByMesa = useMemo(() => {
    const map = new Map<number, { count: number; hasUrgent: boolean; types: string[] }>()
    
    notifications.forEach(notif => {
      if (!notif.leida && notif.mesaId) {
        const current = map.get(notif.mesaId) || { count: 0, hasUrgent: false, types: [] }
        current.count++
        if (notif.tipo === 'LLAMADA_MOZO') current.hasUrgent = true
        if (!current.types.includes(notif.tipo)) current.types.push(notif.tipo)
        map.set(notif.mesaId, current)
      }
    })
    
    return map
  }, [notifications])

  // Sort mesas: active orders first, then by status
  const sortedMesas = [...mesas].sort((a, b) => {
    const aActive = a.pedido && a.pedido.estado !== 'closed'
    const bActive = b.pedido && b.pedido.estado !== 'closed'
    
    if (aActive && !bActive) return -1
    if (!aActive && bActive) return 1
    
    // Both active or both inactive, sort by status priority
    const statusPriority: Record<string, number> = {
      'preparing': 0,
      'pending': 1,
      'delivered': 2,
      'closed': 3
    }
    
    const aPriority = statusPriority[a.pedido?.estado || 'closed'] || 3
    const bPriority = statusPriority[b.pedido?.estado || 'closed'] || 3
    
    return aPriority - bPriority
  })

  if (isLoading && mesas.length === 0) {
    return (
      <div className="w-full max-w-7xl lg:max-w-[1600px] xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="w-full max-w-7xl lg:max-w-[1600px] xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-4 md:py-6">
      <div className="flex flex-col md:flex-row h-[calc(100dvh-4rem-2rem)] md:h-[calc(100dvh-7rem)] md:gap-4 animate-in fade-in duration-500 overflow-hidden">
      
      {/* MOBILE VIEW TOGGLE - Visible only on Mobile */}
      <div className="md:hidden flex p-2 gap-2 bg-background border-b shrink-0 z-10 -mx-4 sm:-mx-6 lg:-mx-8 xl:-mx-12 px-4 sm:px-6 lg:px-8 xl:px-12">
        <Button 
          variant={mobileView === 'mesas' ? 'default' : 'ghost'} 
          className="flex-1 rounded-full text-sm h-9"
          onClick={() => setMobileView('mesas')}
        >
          <LayoutGrid className="mr-2 h-4 w-4" />
          Mesas
        </Button>
        <Button 
          variant={mobileView === 'notifications' ? 'default' : 'ghost'} 
          className="flex-1 rounded-full text-sm h-9 relative"
          onClick={() => setMobileView('notifications')}
        >
          <Bell className="mr-2 h-4 w-4" />
          Alertas
          {unreadCount > 0 && (
            <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-[10px] absolute -top-1 -right-1 md:relative md:top-auto md:right-auto md:text-xs">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Notifications Sidebar */}
      {/* CORRECCIÓN:
         - 'flex-1' se mantiene para rellenar altura en móvil (flex-col).
         - 'md:flex-none' (NUEVO) evita que se ensanche en desktop.
         - 'md:w-80' mantiene el ancho fijo en desktop.
      */}
      <div className={`
        ${mobileView === 'mesas' ? 'hidden' : 'flex'} 
        md:flex flex-col w-full md:w-80 shrink-0 bg-card border md:rounded-lg overflow-hidden flex-1 min-h-0 md:flex-none md:h-full
      `}>
        {/* Sidebar Header */}
        <div className="p-4 border-b bg-muted/30 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              <h2 className="font-semibold">Notificaciones</h2>
              {/* Desktop Badge */}
              {unreadCount > 0 && (
                <Badge variant="destructive" className="h-5 px-1.5 text-xs hidden md:flex">
                  {unreadCount}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setSoundEnabled(!soundEnabled)}
                title={soundEnabled ? 'Silenciar' : 'Activar sonido'}
              >
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
              {notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setEliminarTodasNotificacionesDialog(true)}
                  title="Limpiar"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {isConnected ? (
              <>
                <Wifi className="h-3 w-3 text-green-500" />
                <span>Conectado en tiempo real</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 text-orange-500" />
                <span>Reconectando...</span>
              </>
            )}
          </div>
        </div>

        {/* Notifications List - Takes available space */}
        <ScrollArea className="flex-1">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <BellOff className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">Sin notificaciones</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Aparecerán aquí cuando haya actividad
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {notifications.map((notif) => {
                const info = getNotificationInfo(notif.tipo)
                const Icon = info.icon
                const isUnread = !notif.leida
                const isUrgent = info.priority === 'urgent' && isUnread
                
                return (
                  <div
                    key={notif.id}
                    className={`
                      relative group rounded-lg transition-all overflow-hidden
                      ${isUnread 
                        ? `${info.unreadBg} text-white shadow-md ${isUrgent ? ' ' : ''}` 
                        : 'bg-muted/50 hover:bg-muted'
                      }
                    `}
                  >
                    {/* Desktop: Botones que aparecen en hover */}
                    <div className={`
                      absolute top-1 right-1 z-10 hidden md:flex gap-1 transition-opacity
                      opacity-0 group-hover:opacity-100
                    `}>
                      {/* Marcar como leída - solo si no está leída */}
                      {isUnread && (
                        <button
                          className={`
                            p-1 rounded-full
                            bg-white/20 hover:bg-white/40 text-white
                          `}
                          onClick={(e) => {
                            e.stopPropagation()
                            markAsRead(notif.id)
                          }}
                          title="Marcar como leída"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {/* Eliminar */}
                      <button
                        className={`
                          p-1 rounded-full
                          ${isUnread 
                            ? 'bg-white/20 hover:bg-white/40 text-white' 
                            : 'bg-background border shadow-sm hover:bg-destructive hover:text-white hover:border-destructive'
                          }
                        `}
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteNotification(notif.id)
                        }}
                        title="Eliminar"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    
                    {/* Mobile: Dropdown menu siempre visible */}
                    <div className="absolute top-1 right-1 z-10 md:hidden">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className={`
                              p-1 rounded-full
                              ${isUnread 
                                ? 'bg-white/20 text-white' 
                                : 'bg-muted text-muted-foreground'
                              }
                            `}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          {isUnread && (
                            <DropdownMenuItem
                              onClick={() => markAsRead(notif.id)}
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Marcar como leída
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive focus:bg-destructive/10"
                            onClick={() => deleteNotification(notif.id)}
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    <div
                      className="p-2.5 cursor-pointer"
                      onClick={() => setSelectedNotification(notif)}
                    >
                      {/* Fila principal: Icono + Mesa + Tiempo */}
                      <div className="flex items-center gap-2">
                        {/* Icono */}
                        <div className={`
                          shrink-0 p-1.5 rounded-md
                          ${isUnread ? 'bg-white/20' : 'bg-background'}
                        `}>
                          <Icon className={`h-4 w-4 ${isUnread ? 'text-white' : 'text-muted-foreground'}`} />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          {/* Mesa - prominente */}
                          <div className="flex items-center gap-2">
                            <span className={`font-bold text-sm truncate ${isUnread ? 'text-white' : 'text-foreground'}`}>
                              {notif.mesaNombre || 'Sin mesa'}
                            </span>
                            <span className={`text-[10px] font-medium uppercase tracking-wide shrink-0 ${isUnread ? 'text-white/70' : 'text-muted-foreground'}`}>
                              {info.label}
                            </span>
                          </div>
                          
                          {/* Detalles (solo si hay) */}
                          {notif.detalles && (
                            <p className={`text-xs mt-0.5 truncate ${isUnread ? 'text-white/80' : 'text-muted-foreground'}`}>
                              {notif.detalles}
                            </p>
                          )}
                        </div>
                        
                        {/* Tiempo */}
                        <span className={`text-[11px] font-mono shrink-0 ${isUnread ? 'text-white/70' : 'text-muted-foreground'}`}>
                          {getTimeAgo(notif.timestamp)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Indicador de color para leídas */}
                    {!isUnread && (
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${info.accentColor}`} />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>

        {/* Sidebar Footer - Always visible at bottom of container */}
        {unreadCount > 0 && (
          <div className="p-2 border-t mt-auto shrink-0 bg-background">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={markAllAsRead}
            >
              Marcar todo como leído
            </Button>
          </div>
        )}
      </div>

      {/* Main Content - Mesas */}
      <div className={`
        ${mobileView === 'notifications' ? 'hidden' : 'flex'} 
        md:flex flex-1 flex-col overflow-hidden min-h-0
      `}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4 p-1 md:p-0 shrink-0">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              {restaurante?.nombre || 'Dashboard'}
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              {sortedMesas.length} mesa{sortedMesas.length !== 1 ? 's' : ''} • 
              {sortedMesas.filter(m => m.pedido && m.pedido.estado !== 'closed').length} activa{sortedMesas.filter(m => m.pedido && m.pedido.estado !== 'closed').length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} className="h-8 md:h-9">
              <RefreshCw className="mr-2 h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Actualizar</span>
            </Button>
            <Button size="sm" onClick={() => setCrearMesaDialog(true)} className="h-8 md:h-9">
              <Plus className="mr-2 h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Nueva Mesa</span>
              <span className="sm:hidden">Crear</span>
            </Button>
          </div>
        </div>

        {/* Mesas Grid */}
        <ScrollArea className="flex-1 -mx-2 px-2 md:mx-0 md:px-0">
          {sortedMesas.length === 0 ? (
            <Card className="mx-auto max-w-md">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Coffee className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center mb-4">
                  No hay mesas registradas
                </p>
                <Button onClick={() => setCrearMesaDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Crear Primera Mesa
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 pb-4">
              {sortedMesas.map((mesa) => {
                const hasActiveOrder = mesa.pedido && mesa.pedido.estado !== 'closed'
                const isConfirmed = mesa.pedido?.estado === 'preparing' || mesa.pedido?.estado === 'delivered'
                const mesaNotifs = unreadNotificationsByMesa.get(mesa.id)
                
                // Verificar si hay un pedido cerrado anterior para esta mesa
                const ultimoPedidoCerradoId = ultimosPedidosCerrados.get(mesa.id)
                const pedidoActualVacio = mesa.items.length === 0 && parseFloat(mesa.pedido?.total || '0') === 0
                const hayPedidoCerradoDisponible = ultimoPedidoCerradoId && pedidoActualVacio && (!mesa.pedido || mesa.pedido.id !== ultimoPedidoCerradoId)
                
                // ¿Estamos mostrando el pedido cerrado?
                const mostrandoCerrado = mostrandoPedidoCerrado.has(mesa.id)
                const datosCerrado = datosPedidoCerrado.get(mesa.id)
                const estaCargando = cargandoPedido === mesa.id
                
                // Determinar qué datos mostrar
                const itemsAMostrar = mostrandoCerrado && datosCerrado ? datosCerrado.items : mesa.items
                const totalAMostrar = mostrandoCerrado && datosCerrado ? datosCerrado.pedido.total : mesa.pedido?.total
                const totalItemsAMostrar = mostrandoCerrado && datosCerrado ? datosCerrado.totalItems : mesa.totalItems
                
                // Contar items post-confirmación (productos agregados después de confirmar)
                const itemsPostConfirmacion = itemsAMostrar.filter((item: any) => item.postConfirmacion).length
                
                // Si no hay clientes conectados y no hay pedido confirmado, mostrar "Libre"
                const estadoBase = getEstadoBadge(mesa.pedido?.estado)
                // Si el pedido está cerrado, verificar si todos pagaron
                const pedidoCerrado = mesa.pedido?.estado === 'closed'
                const todosPagaron = mesa.todosPagaron ?? false
                
                const estado = mostrandoCerrado 
                  ? { label: 'Cerrado', variant: 'secondary' as const, icon: CheckCircle }
                  : pedidoCerrado && !todosPagaron
                    ? { label: 'Cerrado (Pendiente pago)', variant: 'outline' as const, icon: CheckCircle }
                  : (!isConfirmed && mesa.clientesConectados.length === 0)
                    ? { label: 'Libre', variant: 'outline' as const, icon: Coffee }
                    : estadoBase
                const StatusIcon = estado.icon
                
                // Determinar si mostrar contenido (productos, total, etc)
                // Mostrar contenido si está mostrando pedido cerrado, está confirmado, o está cerrado (aunque falte pagar)
                const mostrarContenido = mostrandoCerrado || isConfirmed || pedidoCerrado
                
                return (
                  <Card 
                    key={mesa.id}
                    className={`transition-all duration-300 hover:shadow-lg cursor-pointer ${
                      hasActiveOrder && !mostrandoCerrado ? 'border-primary/30 shadow-sm' : ''
                    } ${mesa.pedido?.estado === 'preparing' && !mostrandoCerrado ? 'ring-2 ring-primary/20' : ''} ${
                      mostrandoCerrado ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20' : ''
                    }`}
                    onClick={() => mostrandoCerrado && datosCerrado 
                      ? navigate(`/dashboard/pedidos/${datosCerrado.pedido.id}`)
                      : handleMesaClick(mesa)
                    }
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          {mesa.nombre}
                          {!mostrandoCerrado && mesa.clientesConectados.length > 0 && (
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <Users className="h-3 w-3" />
                              {mesa.clientesConectados.length}
                            </Badge>
                          )}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          {/* Badge de items nuevos post-confirmación */}
                          {itemsPostConfirmacion > 0 && !mostrandoCerrado && (
                            <Badge 
                              variant="outline" 
                              className="gap-1 px-1.5 h-6 bg-amber-100 dark:bg-amber-900/50 border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-300 animate-pulse"
                            >
                              <Sparkles className="h-3 w-3" />
                              {itemsPostConfirmacion}
                            </Badge>
                          )}
                          {/* Badge de notificaciones sin leer */}
                          {mesaNotifs && mesaNotifs.count > 0 && !mostrandoCerrado && (
                            <Badge 
                              variant="destructive" 
                              className={`gap-1 px-1.5 h-6 ${mesaNotifs.hasUrgent ? 'bg-red-500' : 'bg-blue-500 hover:bg-blue-600'}`}
                            >
                              <Bell className="h-3 w-3" />
                              {mesaNotifs.count}
                            </Badge>
                          )}
                          {/* Badge indicador de pedido cerrado */}
                          {mostrandoCerrado && (
                            <Badge variant="outline" className="gap-1 px-1.5 h-6 bg-amber-100 dark:bg-amber-900/50 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300">
                              <History className="h-3 w-3" />
                              <span className="hidden sm:inline">Anterior</span>
                            </Badge>
                          )}
                          <Badge variant={estado.variant} className="gap-1 px-1.5 h-6">
                            <StatusIcon className="h-3 w-3" />
                            <span className="hidden sm:inline">{estado.label}</span>
                          </Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 -mr-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreVertical className="h-4 w-4" />
                                <span className="sr-only">Opciones de mesa</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                              {mostrandoCerrado ? (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    verPedidoActual(mesa.id)
                                  }}
                                >
                                  <ShoppingCart className="mr-2 h-4 w-4" />
                                  Ver pedido actual
                                </DropdownMenuItem>
                              ) : hayPedidoCerradoDisponible && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    verPedidoCerrado(mesa.id, ultimoPedidoCerradoId)
                                  }}
                                >
                                  <History className="mr-2 h-4 w-4" />
                                  Ver pedido anterior
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedMesa(mesa)
                                  setVerQR(true)
                                }}
                              >
                                <QrCode className="mr-2 h-4 w-4" />
                                Ver QR Code
                              </DropdownMenuItem>
                              {/* Solo mostrar opción de resetear si hay un pedido activo (no cerrado) */}
                              {mesa.pedido && mesa.pedido.estado !== 'closed' && (
                                <DropdownMenuItem
                                  className="text-orange-600 focus:text-orange-600 focus:bg-orange-50 dark:focus:bg-orange-950/20"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setMesaAResetear(mesa)
                                    setResetearMesaDialog(true)
                                  }}
                                >
                                  <RotateCcw className="mr-2 h-4 w-4" />
                                  Resetear Mesa
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setMesaAEliminar(mesa)
                                  setEliminarMesaDialog(true)
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Eliminar Mesa
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      {/* Descripción según el estado */}
                      {mostrandoCerrado && datosCerrado ? (
                        <CardDescription className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <History className="h-3 w-3" />
                          Pedido #{datosCerrado.pedido.id} (cerrado)
                        </CardDescription>
                      ) : pedidoCerrado && !todosPagaron ? (
                        <CardDescription className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                          <CheckCircle className="h-3 w-3" />
                          Cerrado - Pendiente pago
                        </CardDescription>
                      ) : hasActiveOrder && mesa.pedido?.createdAt && (
                        <CardDescription className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {getTimeAgo(mesa.pedido.createdAt)}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      {mostrarContenido ? (
                        <div className="space-y-3">
                          {/* Connected clients - solo si no estamos mostrando pedido cerrado */}
                          {!mostrandoCerrado && mesa.clientesConectados.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {mesa.clientesConectados.slice(0, 3).map((cliente) => (
                                <Badge key={cliente.id} variant="outline" className="text-[10px] h-5">
                                  {cliente.nombre}
                                </Badge>
                              ))}
                              {mesa.clientesConectados.length > 3 && (
                                <Badge variant="outline" className="text-[10px] h-5">
                                  +{mesa.clientesConectados.length - 3}
                                </Badge>
                              )}
                            </div>
                          )}

                          {/* Show products */}
                          {itemsAMostrar.length > 0 && (
                            <div className="space-y-1">
                              {itemsAMostrar.slice(0, 2).map((item) => (
                                <div key={item.id} className={`flex items-center justify-between text-sm ${(item as any).postConfirmacion ? 'text-amber-700 dark:text-amber-400' : ''}`}>
                                  <div className="truncate flex-1">
                                    <span className="flex items-center gap-1">
                                      {(item as any).postConfirmacion && <Sparkles className="h-3 w-3 text-amber-500 shrink-0" />}
                                      {item.cantidad}x {item.nombreProducto}
                                    </span>
                                    {(item as any).ingredientesExcluidosNombres && (item as any).ingredientesExcluidosNombres.length > 0 && (
                                      <p className="text-xs text-orange-600 dark:text-orange-400 font-medium mt-0.5">
                                        ⚠️ Sin: {(item as any).ingredientesExcluidosNombres.join(', ')}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                              {itemsAMostrar.length > 2 && (
                                <p className="text-xs text-muted-foreground">
                                  +{itemsAMostrar.length - 2} producto{itemsAMostrar.length - 2 !== 1 ? 's' : ''} más
                                </p>
                              )}
                            </div>
                          )}

                          {/* Total */}
                          <Separator />
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              <ShoppingCart className="h-4 w-4" />
                              {totalItemsAMostrar}
                            </span>
                            <span className="text-lg font-bold">
                              ${parseFloat(totalAMostrar || '0').toFixed(2)}
                            </span>
                          </div>
                          
                          {/* Botones de navegación entre pedidos */}
                          {mostrandoCerrado ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full text-xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                verPedidoActual(mesa.id)
                              }}
                            >
                              <ShoppingCart className="mr-1 h-3 w-3" />
                              Ver pedido actual
                            </Button>
                          ) : hayPedidoCerradoDisponible && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full text-xs border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300"
                              onClick={(e) => {
                                e.stopPropagation()
                                verPedidoCerrado(mesa.id, ultimoPedidoCerradoId)
                              }}
                              disabled={estaCargando}
                            >
                              {estaCargando ? (
                                <>
                                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                  Cargando...
                                </>
                              ) : (
                                <>
                                  <History className="mr-1 h-3 w-3" />
                                  Ver pedido anterior #{ultimoPedidoCerradoId}
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="py-4 text-center text-muted-foreground">
                          <Coffee className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Mesa disponible</p>
                        </div>
                      )}

                      {/* Quick Actions */}
                      <div className="flex gap-2 mt-4">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="flex-1"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedMesa(mesa)
                            setVerQR(true)
                          }}
                        >
                          <QrCode className="mr-1 h-4 w-4" />
                          <span className="hidden sm:inline">QR</span>
                        </Button>
                        <Button 
                          variant={hasActiveOrder ? "default" : "outline"}
                          size="sm"
                          className="flex-1"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (hasActiveOrder && mesa.pedido) {
                              navigate(`/dashboard/pedidos/${mesa.pedido.id}`)
                            } else {
                              setMesaAAbrir(mesa)
                              setAbrirMesaDialog(true)
                            }
                          }}
                        >
                          {hasActiveOrder ? 'Ver Pedido' : 'Abrir'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Mesa Detail Dialog */}
      {selectedMesa && !verQR && (
        <Dialog open={!!selectedMesa && !verQR} onOpenChange={() => setSelectedMesa(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedMesa.nombre}
                <Badge variant={getEstadoBadge(selectedMesa.pedido?.estado).variant}>
                  {getEstadoBadge(selectedMesa.pedido?.estado).label}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                Detalle del pedido actual
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Connected clients */}
              {selectedMesa.clientesConectados.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Clientes Conectados ({selectedMesa.clientesConectados.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {selectedMesa.clientesConectados.map((cliente) => (
                        <Badge key={cliente.id} variant="secondary">
                          {cliente.nombre}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Order Items */}
              {selectedMesa.items.length > 0 ? (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      Productos del Pedido
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {selectedMesa.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            {item.imagenUrl && (
                              <img 
                                src={item.imagenUrl} 
                                alt={item.nombreProducto} 
                                className="w-10 h-10 rounded object-cover"
                              />
                            )}
                            <div>
                              <p className="font-medium text-sm">{item.nombreProducto}</p>
                              <p className="text-xs text-muted-foreground">
                                ${parseFloat(item.precioUnitario).toFixed(2)} x {item.cantidad} • {item.clienteNombre}
                              </p>
                              {(item as any).ingredientesExcluidosNombres && (item as any).ingredientesExcluidosNombres.length > 0 && (
                                <div className="mt-1 p-1.5 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded text-xs">
                                  <p className="text-orange-700 dark:text-orange-300 font-medium">
                                    ⚠️ Sin: {(item as any).ingredientesExcluidosNombres.join(', ')}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                          <p className="font-semibold">
                            ${(parseFloat(item.precioUnitario) * (item.cantidad || 1)).toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No hay productos en el pedido</p>
                  </CardContent>
                </Card>
              )}

              {/* Total */}
              {selectedMesa.pedido && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Total del Pedido</p>
                        <p className="text-xs text-muted-foreground">
                          {selectedMesa.items.length} productos
                        </p>
                      </div>
                      <p className="text-3xl font-bold text-primary">
                        ${parseFloat(selectedMesa.pedido.total).toFixed(2)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setVerQR(true)}
                >
                  <QrCode className="mr-2 h-4 w-4" />
                  Ver QR Code
                </Button>
                <Button 
                  variant="destructive"
                  onClick={() => {
                    setMesaAEliminar(selectedMesa)
                    setEliminarMesaDialog(true)
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* QR Dialog */}
      {verQR && selectedMesa && (
        <Dialog open={verQR} onOpenChange={(open) => {
          setVerQR(open)
          if (!open) setSelectedMesa(null)
        }}>
          <DialogContent className="max-w-md">
            <MesaQRCode 
              qrToken={selectedMesa.qrToken}
              mesaNombre={selectedMesa.nombre}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={eliminarMesaDialog} onOpenChange={setEliminarMesaDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>¿Eliminar Mesa?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Se eliminará "{mesaAEliminar?.nombre}" y todos los pedidos asociados.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setEliminarMesaDialog(false)
                setMesaAEliminar(null)
              }}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleEliminarMesa}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Eliminar'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Mesa Confirmation Dialog */}
      <Dialog open={resetearMesaDialog} onOpenChange={setResetearMesaDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-orange-500" />
              ¿Resetear Mesa?
            </DialogTitle>
            <DialogDescription>
              Se cerrará el pedido actual de "{mesaAResetear?.nombre}" y se creará uno nuevo vacío. 
              {mesaAResetear?.pedido && mesaAResetear.items.length > 0 && (
                <span className="block mt-2 text-orange-600 dark:text-orange-400 font-medium">
                  ⚠️ Hay {mesaAResetear.items.length} producto(s) en el pedido actual que se perderán.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setResetearMesaDialog(false)
                setMesaAResetear(null)
              }}
              disabled={isResetting}
            >
              Cancelar
            </Button>
            <Button 
              className="bg-orange-500 hover:bg-orange-600 text-white"
              onClick={handleResetearMesa}
              disabled={isResetting}
            >
              {isResetting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reseteando...
                </>
              ) : (
                <>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Resetear
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Open Mesa Dialog */}
      <Dialog open={abrirMesaDialog} onOpenChange={setAbrirMesaDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coffee className="h-5 w-5" />
              Abrir Mesa Manualmente
            </DialogTitle>
            <DialogDescription>
              ¿Desea abrir "{mesaAAbrir?.nombre}" y crear un nuevo pedido? Esto le permitirá agregar productos manualmente como si fuera un mozo.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setAbrirMesaDialog(false)
                setMesaAAbrir(null)
              }}
              disabled={isOpening}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleAbrirMesa}
              disabled={isOpening}
            >
              {isOpening ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Abriendo...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Abrir Mesa
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Mesa Dialog */}
      <Dialog open={crearMesaDialog} onOpenChange={setCrearMesaDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Crear Nueva Mesa</DialogTitle>
            <DialogDescription>
              Agrega una nueva mesa a tu restaurante
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCrearMesa} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombreMesa">Nombre de la mesa *</Label>
              <Input
                id="nombreMesa"
                value={nombreMesa}
                onChange={(e) => setNombreMesa(e.target.value)}
                placeholder="Ej: Mesa 1, Mesa VIP, etc."
                required
                disabled={isCreating}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCrearMesaDialog(false)}
                disabled={isCreating}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Crear Mesa
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Notification Detail Dialog */}
      <Dialog 
        open={!!selectedNotification} 
        onOpenChange={(open) => {
          if (!open) setSelectedNotification(null)
        }}
      >
        <DialogContent className="max-w-md">
          {selectedNotification && (() => {
            const info = getNotificationInfo(selectedNotification.tipo)
            const Icon = info.icon
            const mesaInfo = mesas.find(m => m.id === selectedNotification.mesaId)
            
            // Contenido para LLAMADA_MOZO
            if (selectedNotification.tipo === 'LLAMADA_MOZO') {
              return (
                <>
                  <DialogHeader className="text-center pb-2">
                    <div className={`mx-auto p-4 rounded-full ${info.bgColor} mb-4`}>
                      <HandMetal className={`h-10 w-10 ${info.color}`} />
                    </div>
                    <DialogTitle className="text-2xl">¡Llamada de Mozo!</DialogTitle>
                    <DialogDescription className="text-base">
                      Un cliente necesita asistencia
                    </DialogDescription>
                  </DialogHeader>
                  
                  <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20">
                    <CardContent className="pt-6">
                      <div className="text-center space-y-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Mesa</p>
                          <p className="text-3xl font-bold text-red-600">
                            {selectedNotification.mesaNombre || 'Sin nombre'}
                          </p>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>{getTimeAgoDetailed(selectedNotification.timestamp)}</span>
                        </div>
                        {selectedNotification.detalles && (
                          <p className="text-sm text-muted-foreground">
                            {selectedNotification.detalles}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <DialogFooter className="flex-col sm:flex-col gap-2 pt-4">
                    <Button 
                      size="lg"
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        markAsRead(selectedNotification.id)
                        setSelectedNotification(null)
                        toast.success('Marcado como atendido')
                      }}
                    >
                      <CheckCircle className="mr-2 h-5 w-5" />
                      Marcar como Atendido
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => setSelectedNotification(null)}
                    >
                      Cerrar
                    </Button>
                  </DialogFooter>
                </>
              )
            }
            
            // Contenido para PAGO_RECIBIDO
            if (selectedNotification.tipo === 'PAGO_RECIBIDO') {
              return (
                <>
                  <DialogHeader className="text-center pb-2">
                    <div className={`mx-auto p-4 rounded-full ${info.bgColor} mb-4`}>
                      <CreditCard className={`h-10 w-10 ${info.color}`} />
                    </div>
                    <DialogTitle className="text-2xl">Pago Recibido</DialogTitle>
                    <DialogDescription className="text-base">
                      Se ha registrado un pago
                    </DialogDescription>
                  </DialogHeader>
                  
                  <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-950/20">
                    <CardContent className="pt-6 space-y-4">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Mesa</p>
                        <p className="text-2xl font-bold">
                          {selectedNotification.mesaNombre || 'Sin nombre'}
                        </p>
                      </div>
                      <Separator />
                      {selectedNotification.detalles && (
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Detalle</p>
                          <p className="font-medium">{selectedNotification.detalles}</p>
                        </div>
                      )}
                      <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
                        <Clock className="h-4 w-4" />
                        <span>{getTimeAgoDetailed(selectedNotification.timestamp)}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <DialogFooter className="flex-col sm:flex-col gap-2 pt-4">
                    {selectedNotification.pedidoId && (
                      <Button 
                        size="lg"
                        className="w-full"
                        onClick={() => {
                          markAsRead(selectedNotification.id)
                          navigate(`/dashboard/pedidos/${selectedNotification.pedidoId}`)
                          setSelectedNotification(null)
                        }}
                      >
                        <ArrowRight className="mr-2 h-5 w-5" />
                        Ver Pedido
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => {
                        markAsRead(selectedNotification.id)
                        setSelectedNotification(null)
                      }}
                    >
                      Cerrar
                    </Button>
                  </DialogFooter>
                </>
              )
            }
            
            // Contenido para NUEVO_PEDIDO, PEDIDO_CONFIRMADO, PEDIDO_CERRADO
            // Solo mostrar info del pedido de la mesa si coincide con el pedidoId de la notificación
            const isPedidoActual = mesaInfo?.pedido?.id === selectedNotification.pedidoId
            
            return (
              <>
                <DialogHeader className="text-center pb-2">
                  <div className={`mx-auto p-4 rounded-full ${info.bgColor} mb-4`}>
                    <Icon className={`h-10 w-10 ${info.color}`} />
                  </div>
                  <DialogTitle className="text-xl">{selectedNotification.mensaje}</DialogTitle>
                  <DialogDescription>
                    {getTimeAgoDetailed(selectedNotification.timestamp)}
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  {/* Info de la mesa */}
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Mesa</p>
                          <p className="text-xl font-bold">
                            {selectedNotification.mesaNombre || 'Sin nombre'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Detalles adicionales - contiene info del pedido como el total */}
                  {selectedNotification.detalles && (
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground mb-1">Detalles</p>
                        <p className="font-medium">{selectedNotification.detalles}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Preview de productos - solo si el pedido actual coincide con el de la notificación */}
                  {isPedidoActual && mesaInfo && mesaInfo.items.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <ShoppingCart className="h-4 w-4" />
                          Productos ({mesaInfo.totalItems})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {mesaInfo.items.slice(0, 4).map((item) => (
                            <div key={item.id} className="flex items-center justify-between text-sm">
                              <div>
                                <span>{item.cantidad}x {item.nombreProducto}</span>
                                {(item as any).ingredientesExcluidosNombres && (item as any).ingredientesExcluidosNombres.length > 0 && (
                                  <p className="text-xs text-orange-600 dark:text-orange-400 font-medium mt-0.5">
                                    ⚠️ Sin: {(item as any).ingredientesExcluidosNombres.join(', ')}
                                  </p>
                                )}
                              </div>
                              <span className="text-muted-foreground">{item.clienteNombre}</span>
                            </div>
                          ))}
                          {mesaInfo.items.length > 4 && (
                            <p className="text-xs text-muted-foreground text-center pt-1">
                              +{mesaInfo.items.length - 4} producto{mesaInfo.items.length - 4 !== 1 ? 's' : ''} más
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                <DialogFooter className="flex-col sm:flex-col gap-2 pt-4">
                  {selectedNotification.pedidoId && (
                    <Button 
                      size="lg"
                      className="w-full"
                      onClick={() => {
                        markAsRead(selectedNotification.id)
                        navigate(`/dashboard/pedidos/${selectedNotification.pedidoId}`)
                        setSelectedNotification(null)
                      }}
                    >
                      <ArrowRight className="mr-2 h-5 w-5" />
                      Ir al Pedido
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => {
                      markAsRead(selectedNotification.id)
                      setSelectedNotification(null)
                    }}
                  >
                    Cerrar
                  </Button>
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Eliminar Todas las Notificaciones Confirmation Dialog */}
      <Dialog open={eliminarTodasNotificacionesDialog} onOpenChange={setEliminarTodasNotificacionesDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              ¿Eliminar todas las notificaciones?
            </DialogTitle>
            <DialogDescription>
              Esta acción eliminará permanentemente todas las notificaciones de la base de datos. 
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setEliminarTodasNotificacionesDialog(false)
              }}
              disabled={isDeletingAllNotifications}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleEliminarTodasNotificaciones}
              disabled={isDeletingAllNotifications}
            >
              {isDeletingAllNotifications ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar todas
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  )
}

export default Dashboard