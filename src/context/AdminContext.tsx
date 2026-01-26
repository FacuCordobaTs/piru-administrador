import React, { createContext, useContext } from 'react'
import { useAdminWebSocket, type UseAdminWebSocketReturn } from '@/hooks/useAdminWebSocket'

interface AdminContextValue extends UseAdminWebSocketReturn {
    soundEnabled: boolean
    setSoundEnabled: (enabled: boolean) => void
}

const AdminContext = createContext<AdminContextValue | null>(null)

export const AdminProvider = ({ children }: { children: React.ReactNode }) => {
    const adminData = useAdminWebSocket()
    const [soundEnabled, setSoundEnabled] = React.useState(true)

    const value = {
        ...adminData,
        soundEnabled,
        setSoundEnabled
    }

    return (
        <AdminContext.Provider value={value}>
            {children}
        </AdminContext.Provider>
    )
}

export const useAdminContext = () => {
    const context = useContext(AdminContext)
    if (!context) {
        throw new Error('useAdminContext must be used within AdminProvider')
    }
    return context
}
