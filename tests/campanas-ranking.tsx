import { createRoot } from 'react-dom/client'
import { MemoryRouter, Routes, Route } from 'react-router'
import Clientes from '../src/pages/Clientes'
import { useAuthStore } from '../src/store/authStore'
import '../src/index.css'

useAuthStore.setState({ token: `test.${btoa(JSON.stringify({ exp: 9999999999 }))}.test`, isAuthenticated: true })

/**
 * Campañas con el diseño portado de la landing: la lista es un ranking de links con visitas,
 * pedidos y ventas. Se monta la pantalla real de Clientes —el orden por defecto, los filtros y
 * el detalle viven ahí— con la API mockeada desde el spec.
 */
createRoot(document.getElementById('root')!).render(
  <MemoryRouter initialEntries={[window.location.hash.slice(1) || '/clientes?tab=adquisicion&vista=campanas']}>
    <Routes>
      <Route path="/clientes" element={<Clientes />} />
    </Routes>
  </MemoryRouter>,
)
