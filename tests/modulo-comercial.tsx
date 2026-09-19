import { createRoot } from 'react-dom/client'
import { MemoryRouter, Routes, Route } from 'react-router'
import MotorRecompra from '../src/pages/MotorRecompra'
import { PuntosPanel } from '../src/pages/clientes/PuntosPanel'
import { useAuthStore } from '../src/store/authStore'
import '../src/index.css'

useAuthStore.setState({ token: `test.${btoa(JSON.stringify({ exp: 9999999999 }))}.test`, isAuthenticated: true })

// La ruta entra por hash para poder montar los dos consumidores del estado
// bloqueado (motor y puntos) en la misma página.
createRoot(document.getElementById('root')!).render(
  <MemoryRouter initialEntries={[window.location.hash.slice(1) || '/motor']}>
    <Routes>
      <Route path="/motor" element={<MotorRecompra />} />
      <Route path="/puntos" element={<div className="flex h-dvh min-h-0 flex-col"><PuntosPanel /></div>} />
    </Routes>
  </MemoryRouter>,
)
