// Dashboard real dentro del DashboardLayout real, con un catálogo de prueba. Las APIs se
// interceptan en Playwright, sin datos reales. Sirve para validar el POS en celular y tablet.
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

const foto = (color: string, forma: string) => `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120"><rect width="160" height="120" fill="${color}"/>${forma}</svg>`,
)}`
const plato = (color: string) => foto(color, '<circle cx="80" cy="62" r="34" fill="#fff" opacity=".85"/><circle cx="80" cy="62" r="22" fill="#000" opacity=".12"/>')
const vaso = (color: string) => foto(color, '<path d="M58 22h44l-6 78H64z" fill="#fff" opacity=".85"/><rect x="62" y="52" width="36" height="42" fill="#000" opacity=".14"/>')

const CATEGORIAS = [
    { id: 1, nombre: 'Combos', orden: 0 },
    { id: 2, nombre: 'Hamburguesas', orden: 1 },
    { id: 3, nombre: 'Pizzas', orden: 2 },
    { id: 4, nombre: 'Empanadas', orden: 3 },
    { id: 5, nombre: 'Postres', orden: 4 },
    { id: 6, nombre: 'Bebidas', orden: 5, esBebida: true },
]

const INGREDIENTES = [{ id: 1, nombre: 'Pan' }, { id: 2, nombre: 'Carne' }, { id: 3, nombre: 'Cheddar' }, { id: 4, nombre: 'Lechuga' }, { id: 5, nombre: 'Tomate' }]
const AGREGADOS = [{ id: 1, nombre: 'Huevo', precio: '1200' }, { id: 2, nombre: 'Bacon', precio: '1800' }, { id: 3, nombre: 'Cheddar extra', precio: '1000' }]

type Semilla = { nombre: string; precio: number; cat: number; foto?: string; variantes?: Array<[string, number]>; extras?: boolean }
const SEMILLAS: Semilla[] = [
    { nombre: 'Combo Clásico', precio: 12500, cat: 1, foto: plato('#f59e0b') },
    { nombre: 'Combo Doble + Papas', precio: 15800, cat: 1, foto: plato('#ef4444') },
    { nombre: 'Clásica', precio: 8900, cat: 2, foto: plato('#f97316'), variantes: [['Simple', 8900], ['Doble', 11200], ['Triple', 13500]], extras: true },
    { nombre: 'Doble cheddar', precio: 11200, cat: 2, foto: plato('#eab308'), extras: true },
    { nombre: 'Bacon BBQ', precio: 11900, cat: 2, extras: true },
    { nombre: 'Veggie', precio: 9800, cat: 2, foto: plato('#22c55e') },
    { nombre: 'Pollo crispy', precio: 10400, cat: 2 },
    { nombre: 'Hamburguesa Completa con Huevo Frito, Panceta y Salsa Especial de la Casa', precio: 14900, cat: 2, extras: true },
    { nombre: 'Muzzarella', precio: 6800, cat: 3, foto: plato('#fb923c'), variantes: [['Chica', 6800], ['Mediana', 9800], ['Grande', 13200]] },
    { nombre: 'Napolitana', precio: 7400, cat: 3, variantes: [['Chica', 7400], ['Mediana', 10400], ['Grande', 14200]] },
    { nombre: 'Fugazzeta rellena', precio: 15900, cat: 3 },
    { nombre: 'Cuatro quesos', precio: 8200, cat: 3, foto: plato('#facc15') },
    { nombre: 'Empanada de carne', precio: 1800, cat: 4 },
    { nombre: 'Empanada de jamón y queso', precio: 1800, cat: 4 },
    { nombre: 'Empanada caprese', precio: 1900, cat: 4 },
    { nombre: 'Docena de empanadas', precio: 19800, cat: 4, foto: plato('#d97706') },
    { nombre: 'Flan casero', precio: 4200, cat: 5 },
    { nombre: 'Brownie con helado', precio: 5900, cat: 5, foto: plato('#78350f') },
    { nombre: 'Tiramisú', precio: 5400, cat: 5 },
    { nombre: 'Coca-Cola 500ml', precio: 2800, cat: 6, foto: vaso('#b91c1c') },
    { nombre: 'Sprite 500ml', precio: 2800, cat: 6, foto: vaso('#16a34a') },
    { nombre: 'Agua sin gas', precio: 1800, cat: 6 },
    { nombre: 'Cerveza IPA 473ml', precio: 4200, cat: 6, foto: vaso('#ca8a04') },
    { nombre: 'Limonada de la casa', precio: 3200, cat: 6, variantes: [['500cc', 3200], ['1 litro', 5400]] },
]

const productos = SEMILLAS.map((s, i) => ({
    id: i + 1,
    restauranteId: 1,
    categoriaId: s.cat,
    nombre: s.nombre,
    descripcion: null,
    precio: String(s.precio),
    activo: true,
    imagenUrl: s.foto ?? null,
    createdAt: '2026-09-09',
    categoria: CATEGORIAS.find(c => c.id === s.cat)!.nombre,
    categoriaEsBebida: CATEGORIAS.find(c => c.id === s.cat)!.esBebida === true,
    orden: i,
    tieneVariantes: !!s.variantes,
    variantes: s.variantes?.map(([nombre, precio], j) => ({ id: (i + 1) * 10 + j, nombre, precio: String(precio) })),
    ingredientes: s.extras ? INGREDIENTES : [],
    agregados: s.extras ? AGREGADOS : [],
    etiquetas: [],
}))

useAuthStore.getState().setAuth('test-token', { id: 1, nombre: 'Local fixture', email: 'test@example.test' })
// setLocal no hace nada mientras no hay restaurante en el store: se siembra completo (con el costo de envío fijo).
useRestauranteStore.getState().setRestaurante({ id: 1, nombre: 'Local fixture', username: 'prueba', deliveryEnabled: true, takeawayEnabled: true, deliveryFee: '1500' } as unknown as RestauranteData)
useRestauranteStore.getState().setCategorias(CATEGORIAS.map(c => ({ ...c, restauranteId: 1, createdAt: '2026-09-09' })))
useRestauranteStore.getState().setProductos(productos)

createRoot(document.getElementById('root')!).render(
    <MemoryRouter initialEntries={['/dashboard/']}>
        <AdminProvider><PrinterProvider>
            <Routes><Route path="/dashboard" element={<DashboardLayout />}><Route index element={<Dashboard />} /></Route></Routes>
            <Toaster />
        </PrinterProvider></AdminProvider>
    </MemoryRouter>,
)
