import { createRoot } from 'react-dom/client'
import CierreTurno from '../src/components/CierreTurno'
import { useAuthStore } from '../src/store/authStore'
import '../src/index.css'

useAuthStore.setState({ token: `test.${btoa(JSON.stringify({ exp: 9999999999 }))}.test`, isAuthenticated: true })

// `#claro` prueba el tema claro; sin hash queda el oscuro del `<html class="dark">`.
if (window.location.hash === '#claro') document.documentElement.classList.remove('dark')

/**
 * El cierre de turno tal cual lo monta el panel: la pantalla real, abierta, con la API mockeada
 * desde el spec. Sirve para revisar el ranking de productos (por unidades y por categoría).
 */
createRoot(document.getElementById('root')!).render(<CierreTurno open onClose={() => {}} />)
