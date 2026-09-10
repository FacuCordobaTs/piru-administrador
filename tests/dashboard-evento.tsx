// Dashboard y POS reales; las APIs se interceptan en Playwright, sin pedidos reales.
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
useRestauranteStore.getState().setProductos([{
    id: 1, restauranteId: 1, nombre: 'Alfajor de prueba', precio: '1500', activo: true,
    categoriaId: null, categoria: null, descripcion: null, imagenUrl: null, createdAt: '2026-09-09',
}, {
    id: 2, restauranteId: 1, nombre: 'Combo exclusivo feria', precio: '3500', activo: true,
    categoriaId: null, categoria: null, descripcion: null, imagenUrl: null, createdAt: '2026-09-09', eventoSucursalId: 20,
}, {
    id: 3, restauranteId: 1, nombre: 'Combo de otro evento', precio: '4500', activo: true,
    categoriaId: null, categoria: null, descripcion: null, imagenUrl: null, createdAt: '2026-09-09', eventoSucursalId: 21,
}])
createRoot(document.getElementById('root')!).render(
    <MemoryRouter><AdminProvider><PrinterProvider><Dashboard /><Toaster /></PrinterProvider></AdminProvider></MemoryRouter>,
)
