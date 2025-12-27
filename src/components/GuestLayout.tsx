import { Navigate, Outlet } from 'react-router'
import { useAuthStore } from '@/store/authStore'

const GuestLayout = () => {
  const { isAuthenticated, token } = useAuthStore()

  // Si está autenticado, redirigir al dashboard
  if (isAuthenticated && token) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}

export default GuestLayout

