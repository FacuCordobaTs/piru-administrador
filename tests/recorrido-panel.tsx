import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import DashboardLayout from '../src/components/DashboardLayout'
import DemoPanel from '../src/pages/DemoPanel'
import { useAuthStore } from '../src/store/authStore'
import { useRestauranteStore } from '../src/store/restauranteStore'
import '../src/index.css'

/**
 * El panel real (`DashboardLayout`, con el recorrido y el aviso de datos de ejemplo) y la entrada de la
 * demo (`/demo/:username`). La API la responde la suite (`page.route`).
 *
 *   ?sesion=demo    sesión de la demo de prospección (por defecto)
 *   ?sesion=dueno   la sesión de un dueño de verdad
 *   ?sesion=otra    otra sesión abierta, para el caso de que la demo quiera reemplazarla
 *   ?sesion=no      sin sesión
 *   ?ruta=/demo/brasa   arranca en la entrada de la demo
 */
const params = new URLSearchParams(window.location.search)
const sesion = params.get('sesion') ?? 'demo'
const jwt = (payload: object) => `test.${btoa(JSON.stringify({ exp: 9999999999, ...payload }))}.test`

if (sesion !== 'no') {
  const demo = sesion === 'demo'
  const restaurante =
    sesion === 'otra'
      ? { id: 9, nombre: 'Otro Local', username: 'otrolocal' }
      : { id: 6, nombre: 'Brasa', username: 'brasa' }
  useAuthStore.setState({
    token: jwt(demo ? { id: 6, scope: 'restaurante', demo: true } : { id: restaurante.id, scope: 'restaurante' }),
    isAuthenticated: true,
    restaurante: { ...restaurante, email: '' },
  })
  // El perfil ya cargado: el layout no tiene que esperar a la API para pintar el nombre.
  useRestauranteStore.setState({ restaurante: { id: restaurante.id, nombre: restaurante.nombre, username: restaurante.username } as never })
}

function Destino() {
  const { pathname } = useLocation()
  return <p data-testid="destino">{pathname}</p>
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter initialEntries={[params.get('ruta') ?? '/dashboard']}>
    <Routes>
      <Route path="/demo/:username" element={<DemoPanel />} />
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<p data-testid="pantalla">Inicio del panel</p>} />
        <Route path="guia" element={<p data-testid="pantalla">La guía</p>} />
      </Route>
      <Route path="/dashboard/guia" element={<p data-testid="pantalla">La guía</p>} />
      <Route path="*" element={<Destino />} />
    </Routes>
  </MemoryRouter>,
)
