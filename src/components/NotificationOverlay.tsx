import { useEffect, useState } from 'react'
import { useAdminContext } from '@/context/AdminContext'
import { toast } from 'sonner'
import {
    Bell, HandMetal, CreditCard, ShoppingCart, X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router'

// Note: We use the existing Toaster from main.tsx, but we trigger toasts here.
// However, the User wanted "un modal hermoso".
// If we want a global "Overlay" that is NOT just a toast, we can implement it here.
// But Sonner toasts are pretty nice and "beautiful" if styled.
// The user request "Mover las notificaciones" implies a list.
// The "Overlay" is for NEW notifications (alerts).
// The LIST should be in Pedidos (Sheet).
// This component handles the ALERT (Sound + Toast).

const NotificationOverlay = () => {
    const { notifications, soundEnabled } = useAdminContext()
    const [lastNotificationId, setLastNotificationId] = useState<string | null>(null)
    const navigate = useNavigate()

    useEffect(() => {
        // Check if we have a new notification at the top of the list
        if (notifications.length > 0) {
            const latest = notifications[0]
            // Only trigger if it's a new one we haven't processed in this session
            // (and it's recent, e.g. not loaded from DB history as "read" but unread)
            // Actually, unread notifications from DB will trigger this on mount.
            // We should probably only trigger for *real-time* events or if we track "seen" IDs locally?
            // For now, let's just tracking the ID.

            if (latest.id !== lastNotificationId && !latest.leida) {
                setLastNotificationId(latest.id)
                if (soundEnabled) {
                    playNotificationSound()
                }
                showNotificationToast(latest)
            }
        }
    }, [notifications, lastNotificationId, soundEnabled])

    const playNotificationSound = () => {
        try {
            const audio = new Audio('/notification.mp3')
            audio.play().catch(e => console.error('Error playing sound:', e))
        } catch (e) {
            console.error('Audio error:', e)
        }
    }

    const showNotificationToast = (n: any) => {
        // Custom toast content based on type
        const colors: Record<string, string> = {
            'LLAMADA_MOZO': 'bg-red-500',
            'PAGO_RECIBIDO': 'bg-purple-500',
            'NUEVO_PEDIDO': 'bg-green-500',
            'default': 'bg-blue-500'
        }

        const icons: Record<string, any> = {
            'LLAMADA_MOZO': HandMetal,
            'PAGO_RECIBIDO': CreditCard,
            'NUEVO_PEDIDO': ShoppingCart,
            'default': Bell
        }

        const typeColor = colors[n.tipo] || colors['default']
        const Icon = icons[n.tipo] || icons['default']

        toast.custom((t) => (
            <div className={`${typeColor} text-white p-4 rounded-lg shadow-lg flex items-start gap-4 min-w-[300px] animate-in slide-in-from-right-full`}>
                <div className="bg-white/20 p-2 rounded-full shrink-0">
                    <Icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-lg">{n.mesaNombre ? `Mesa ${n.mesaNombre}` : 'Notificación'}</h3>
                    <p className="font-medium text-white/90">{n.mensaje}</p>
                    {n.detalles && <p className="text-sm text-white/80 mt-1">{n.detalles}</p>}
                    <div className="mt-3 flex gap-2">
                        {n.pedidoId && (
                            <Button
                                size="sm"
                                variant="secondary"
                                className="text-xs h-7 bg-white text-black hover:bg-white/90"
                                onClick={() => {
                                    toast.dismiss(t)
                                    navigate(`/dashboard/pedidos/${n.pedidoId}`)
                                }}
                            >
                                Ver Pedido
                            </Button>
                        )}
                        <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs h-7 text-white hover:bg-white/20"
                            onClick={() => toast.dismiss(t)}
                        >
                            Cerrar
                        </Button>
                    </div>
                </div>
                <button
                    onClick={() => toast.dismiss(t)}
                    className="text-white/70 hover:text-white"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>
        ), { duration: 5000 })
    }

    return null // This component doesn't render DOM elements itself, it manages effects
}

export default NotificationOverlay
