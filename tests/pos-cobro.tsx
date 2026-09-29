// Dashboard real dentro del DashboardLayout real, con un catálogo mínimo. Las APIs se interceptan en
// Playwright, sin datos reales. Sirve para validar el cobro del POS ("Confirmar cobros manualmente").
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { Toaster } from 'sonner'
import Dashboard from '../src/pages/Dashboard'
import DashboardLayout from '../src/components/DashboardLayout'
import { AdminProvider } from '../src/context/AdminContext'
import { PrinterProvider } from '../src/context/PrinterContext'
import { useAuthStore } from '../src/store/authStore'
import { useRestauranteStore, type RestauranteData } from '../src/store/restauranteStore'
import '../src/index.css'

const CATEGORIAS = [
    { id: 1, nombre: 'Comidas', orden: 0 },
    { id: 2, nombre: 'Bebidas', orden: 1, esBebida: true },
]

const SEMILLAS: Array<{ nombre: string; precio: number; cat: number }> = [
    { nombre: 'Empanada de carne', precio: 1800, cat: 1 },
    { nombre: 'Combo Clásico', precio: 12500, cat: 1 },
    { nombre: 'Coca-Cola 500ml', precio: 2800, cat: 2 },
]

const productos = SEMILLAS.map((s, i) => ({
    id: i + 1,
    restauranteId: 1,
    categoriaId: s.cat,
    nombre: s.nombre,
    descripcion: null,
    precio: String(s.precio),
    activo: true,
    imagenUrl: null,
    createdAt: '2026-09-09',
    categoria: CATEGORIAS.find((c) => c.id === s.cat)!.nombre,
    categoriaEsBebida: CATEGORIAS.find((c) => c.id === s.cat)!.esBebida === true,
    orden: i,
    tieneVariantes: false,
    variantes: [],
    ingredientes: [],
    agregados: [],
    etiquetas: [],
}))

useAuthStore.getState().setAuth('test-token', { id: 1, nombre: 'Local fixture', email: 'test@example.test' })
useRestauranteStore.getState().setRestaurante({ id: 1, nombre: 'Local fixture', username: 'prueba', deliveryEnabled: true, takeawayEnabled: true, deliveryFee: '0' } as unknown as RestauranteData)
useRestauranteStore.getState().setCategorias(CATEGORIAS.map((c) => ({ ...c, restauranteId: 1, createdAt: '2026-09-09' })))
useRestauranteStore.getState().setProductos(productos)

createRoot(document.getElementById('root')!).render(
    <MemoryRouter initialEntries={['/dashboard/']}>
        <AdminProvider><PrinterProvider>
            <Routes><Route path="/dashboard" element={<DashboardLayout />}><Route index element={<Dashboard />} /></Route></Routes>
            <Toaster />
        </PrinterProvider></AdminProvider>
    </MemoryRouter>,
)
