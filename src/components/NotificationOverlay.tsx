import { useEffect, useState } from 'react'
import { useAdminContext } from '@/context/AdminContext'

const NotificationOverlay = () => {
    const { notifications, soundEnabled } = useAdminContext()
    const [lastNotificationId, setLastNotificationId] = useState<string | null>(null)

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


    return null // This component doesn't render DOM elements itself, it manages effects
}

export default NotificationOverlay
