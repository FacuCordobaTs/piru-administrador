import { createRoot } from 'react-dom/client'
import { MemoryRouter, Routes, Route } from 'react-router'
import { Toaster } from 'sonner'
import Ajustes from '../src/pages/ajustes'
import { PrinterProvider } from '../src/context/PrinterContext'
import { useAuthStore } from '../src/store/authStore'
import { useRestauranteStore } from '../src/store/restauranteStore'
import '../src/index.css'
useAuthStore.getState().setAuth('fixture-token', { id: 1, nombre: 'La Esquina', email: 'local@example.test' })
useRestauranteStore.setState({ restaurante: { id: 1, nombre: 'La Esquina', username: 'la-esquina', email: 'local@example.test', deliveryEnabled: true, takeawayEnabled: true, direccionSoloTexto: true, imagenUrl: 'fixture', mpConnected: true } as never })
createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={['/dashboard/ajustes']}><PrinterProvider><Routes><Route path="/dashboard/ajustes/:seccion?" element={<Ajustes />} /></Routes><Toaster /></PrinterProvider></MemoryRouter>)
