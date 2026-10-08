import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import Guia, { GuiaPublica } from '../src/pages/Guia'
import { useAuthStore } from '../src/store/authStore'
import { useRestauranteStore } from '../src/store/restauranteStore'
import '../src/index.css'

/**
 * La guía real del panel. Con sesión (lo normal) se monta en `/dashboard/guia` como si se hubiera
 * abierto desde Menú; `?sesion=no` monta la pública, `/guia`. El `#seccion` de la URL de esta página
 * es el que lee la guía al llegar.
 */
const conSesion = new URLSearchParams(window.location.search).get('sesion') !== 'no'
if (conSesion) {
  useAuthStore.setState({ token: `test.${btoa(JSON.stringify({ exp: 9999999999 }))}.test`, isAuthenticated: true })
  useRestauranteStore.setState({ restaurante: { nombre: 'Brasa', username: 'brasa', baseTienda: 'https://my.piru.app/brasa/' } as never })
}

/** Adonde llevó un link de la guía hacia el panel. */
export function Destino() {
  const { pathname } = useLocation()
  return <p data-testid="destino">{pathname}</p>
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter
    initialEntries={[conSesion ? { pathname: '/dashboard/guia', state: { volver: '/dashboard/productos' } } : '/guia']}
  >
    <Routes>
      <Route path="/dashboard/guia" element={<Guia />} />
      <Route path="/guia" element={<GuiaPublica />} />
      <Route path="*" element={<Destino />} />
    </Routes>
  </MemoryRouter>,
)
