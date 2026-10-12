import { Navigate, Outlet } from 'react-router'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { esConstructorInterno, esSesionDemo, isTokenExpired } from '@/lib/api'
import { useEffect } from 'react'
import { AdminProvider } from '@/context/AdminContext'
import NotificationOverlay from '@/components/NotificationOverlay'
import GlobalAutoPrinter from '@/components/GlobalAutoPrinter'

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

  // Hard paywall: un local que ya completó el onboarding pero NO tiene suscripción activa
  // (accesoPanel === false) no entra al panel — sólo a /suscribir. Cuentas grandfathered
  // (requiereSuscripcion=false) traen accesoPanel=true, así que nunca caen acá.
  const suscripcion = restauranteStore.suscripcion as any
  // No aplica a la demo de prospección ni al fundador (alta o acceso temporal de interno): una tienda
  // recién armada no tiene suscripción hasta que el dueño la reclama y ahí arranca la prueba.
  const bloqueadoPorPaywall =
    restaurante && restaurante.completedOnboarding && suscripcion?.accesoPanel === false && !esSesionDemo(token) && !esConstructorInterno(token)

  if (bloqueadoPorPaywall && currentPath !== '/suscribir') {
    return <Navigate to="/suscribir" replace />
  }
  // Tras acreditar una alta self-serve, mostramos Módulos como siguiente paso
  // informativo. No activa ningún entitlement: las elecciones siguen siendo explícitas.
  if (currentPath === '/suscribir' && restaurante && suscripcion && suscripcion.accesoPanel !== false) {
    return <Navigate to="/dashboard/modulos?checkout=success&origen=suscripcion" replace />
  }

  return (
    <AdminProvider>
      <NotificationOverlay />
      <GlobalAutoPrinter />
      <Outlet />
    </AdminProvider>
  )
}

export default ProtectedLayout

