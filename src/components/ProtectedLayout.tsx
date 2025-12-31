import { Navigate, Outlet } from 'react-router'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { isTokenExpired } from '@/lib/api'
import { useEffect } from 'react'

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

  return <Outlet />
}

export default ProtectedLayout

