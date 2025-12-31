import { Navigate, Outlet } from 'react-router'
import { useAuthStore } from '@/store/authStore'
import { isTokenExpired } from '@/lib/api'

const GuestLayout = () => {
  const { isAuthenticated, token } = useAuthStore()

  // Solo redirigir al dashboard si está autenticado Y el token es válido (no expirado)
  if (isAuthenticated && token && !isTokenExpired(token)) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}

export default GuestLayout

