import { createRoot } from 'react-dom/client'
import { MemoryRouter, Routes, Route } from 'react-router'
import { Toaster } from 'sonner'
import ClientesMarketing from '../src/pages/ClientesMarketing'
import { useAuthStore } from '../src/store/authStore'
import '../src/index.css'

useAuthStore.setState({ token: 'token-del-panel', isAuthenticated: true })

/** La pantalla real de Clientes; `#/clientes?tab=…` simula los deep links de antes. */
createRoot(document.getElementById('root')!).render(
  <MemoryRouter initialEntries={[window.location.hash.slice(1) || '/clientes']}>
    <Routes>
      <Route path="/clientes" element={<ClientesMarketing />} />
    </Routes>
    <Toaster />
  </MemoryRouter>,
)
