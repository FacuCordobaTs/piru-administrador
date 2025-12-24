import { Navigate, Outlet } from 'react-router'
import { useAuthStore } from '@/store/authStore'

const ProtectedLayout = () => {
  const { isAuthenticated, token } = useAuthStore()

  // Si no está autenticado, redirigir al login
  if (!isAuthenticated || !token) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export default ProtectedLayout

