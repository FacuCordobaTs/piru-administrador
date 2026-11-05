import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { Toaster } from 'sonner'
import DashboardLayout from '../src/components/DashboardLayout'
import Metricas from '../src/pages/Metricas'
import { useAuthStore } from '../src/store/authStore'
import { useRestauranteStore } from '../src/store/restauranteStore'
import {
  Layout,
  ResumenClientes,
  Hoy,
  Dias,
  Campanas,
  Clientes,
  Puntos,
  Cupones,
  Guia,
} from '../src/marketing'
import '../src/index.css'

/**
 * Marketing dentro del panel real (`DashboardLayout`), con la sesión de un dueño. La API la
 * responde la suite (`page.route`). `?ruta=/dashboard/marketing/hoy` elige la pantalla.
 */
const params = new URLSearchParams(window.location.search)
const ruta = params.get('ruta') ?? '/dashboard/marketing'
const jwt = (payload: object) => `test.${btoa(JSON.stringify({ exp: 9999999999, ...payload }))}.test`

useAuthStore.setState({
  token: jwt({ id: 1, scope: 'restaurante' }),
  isAuthenticated: true,
  restaurante: { id: 1, nombre: 'Brasa', username: 'brasa', email: '' },
})
useRestauranteStore.setState({ restaurante: { id: 1, nombre: 'Brasa', username: 'brasa' } as never })

createRoot(document.getElementById('root')!).render(
  <MemoryRouter initialEntries={[ruta]}>
    <Routes>
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route path="metricas" element={<Metricas />} />
        <Route path="marketing" element={<Layout />}>
          <Route index element={<ResumenClientes />} />
          <Route path="hoy" element={<Hoy />} />
          <Route path="dias-flojos" element={<Dias />} />
          <Route path="campanas" element={<Campanas />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="puntos" element={<Puntos />} />
          <Route path="cupones" element={<Cupones />} />
        </Route>
      </Route>
      <Route path="/dashboard/marketing/guia" element={<Guia />} />
    </Routes>
    <Toaster position="top-center" richColors />
  </MemoryRouter>,
)
