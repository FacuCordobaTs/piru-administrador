// Dashboard real alimentado con muchos pedidos activos; las APIs se interceptan
// en Playwright, sin pedidos reales. Se usa para reproducir el scroll del listado.
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { Toaster } from 'sonner'
import Dashboard from '../src/pages/Dashboard'
import { AdminProvider } from '../src/context/AdminContext'
import { PrinterProvider } from '../src/context/PrinterContext'
import { useAuthStore } from '../src/store/authStore'
import { useRestauranteStore } from '../src/store/restauranteStore'
import '../src/index.css'

useAuthStore.getState().setAuth('test-token', { id: 1, nombre: 'Local fixture', email: 'test@example.test' })
useRestauranteStore.getState().setLocal({ id: 1, nombre: 'Local fixture', username: 'prueba', deliveryEnabled: true, takeawayEnabled: true })

createRoot(document.getElementById('root')!).render(
    <MemoryRouter><AdminProvider><PrinterProvider><Dashboard /><Toaster /></PrinterProvider></AdminProvider></MemoryRouter>,
)
