import { Navigate, Outlet } from 'react-router'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { isTokenExpired } from '@/lib/api'
import { useEffect } from 'react'
import { AdminProvider } from '@/context/AdminContext'
import NotificationOverlay from '@/components/NotificationOverlay'

const ProtectedLayout = () => {
  const { isAuthenticated, token, logout } = useAuthStore()
  const restauranteStore = useRestauranteStore()

  // Verificar si el token está expirado al montar el componente
  useEffect(() => {
    if (token && isTokenExpired(token)) {
      logout()
      restauranteStore.reset()
    }
  }, [token, logout, restauranteStore])

  // Si no está autenticado o no hay token, redirigir al login
  if (!isAuthenticated || !token) {
    return <Navigate to="/login" replace />
  }

  // Si el token está expirado, redirigir al login
  if (isTokenExpired(token)) {
    return <Navigate to="/login" replace />
  }
  
  // Extraemos la información del restaurante si la página actual no es /onboarding
  // Asumimos que window.location.pathname servirá porque ProtectedLayout es el parent
  const currentPath = window.location.pathname
  const restaurante = restauranteStore.restaurante as any

  if (restaurante && !restaurante.completedOnboarding && currentPath !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }
  
  // Opcional: Si currentPath === '/onboarding' y YA COMPLETO el onboarding, lo enviamos al dashboard
  if (restaurante && restaurante.completedOnboarding && currentPath === '/onboarding') {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <AdminProvider>
      <NotificationOverlay />
      <Outlet />
    </AdminProvider>
  )
}

export default ProtectedLayout

