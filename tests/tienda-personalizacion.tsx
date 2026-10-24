import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { PrinterProvider } from '../src/context/PrinterContext'
import { useRestauranteStore } from '../src/store/restauranteStore'
import { useAuthStore } from '../src/store/authStore'
import Tienda from '../src/pages/ajustes/sections/Tienda'
import Onboarding from '../src/pages/Onboarding'
import { Toaster } from '../src/components/ui/sonner'
import '../src/index.css'

const params = new URLSearchParams(location.search)
const existente = params.has('existente')
useAuthStore.setState({ token: `test.${btoa(JSON.stringify({ exp: 9999999999, accesoTemporalInterno: true }))}.test`, isAuthenticated: true })
useRestauranteStore.setState({ fetchData: async () => {}, restaurante: {
  id: 7, nombre: 'Casa Oliva', username: 'casaoliva', telefono: '5491112345678', whatsappNumber: '5491112345678', usarColorUnico: true,
  tienda: existente ? { plantilla: 'elegante', frase: 'La cocina de siempre', historia: { texto: 'Nuestra historia' }, galeria: ['/logopiru.jpeg', '/logopiru.jpeg?segunda'] } : null,
} as never })
if (params.has('onboarding') && !localStorage.getItem('piru_onboarding_data:7:phase')) localStorage.setItem('piru_onboarding_data:7:phase', 'preparativos')
createRoot(document.getElementById('root')!).render(<MemoryRouter><PrinterProvider><div className="mx-auto max-w-3xl p-4">{params.has('onboarding') ? <Onboarding /> : <Tienda />}</div><Toaster /></PrinterProvider></MemoryRouter>)
