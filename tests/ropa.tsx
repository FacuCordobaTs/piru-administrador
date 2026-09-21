import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { Toaster } from 'sonner'
import Ropa from '../src/pages/Ropa'
import { useAuthStore } from '../src/store/authStore'
import '../src/index.css'

// El local se elige por query para poder montar la pantalla como Alfajor (6) y como
// cualquier otro local (1), que es el caso que debe redirigir.
const restauranteId = Number(new URLSearchParams(location.search).get('restauranteId') ?? '6')

useAuthStore
  .getState()
  .setAuth('test-token', { id: restauranteId, nombre: 'Local fixture', email: 'test@example.test' })

createRoot(document.getElementById('root')!).render(
  <MemoryRouter initialEntries={['/dashboard/ropa']}>
    <Routes>
      <Route path="/dashboard/ropa" element={<Ropa />} />
      <Route path="/dashboard" element={<div>Panel general</div>} />
    </Routes>
    <Toaster />
  </MemoryRouter>
)
