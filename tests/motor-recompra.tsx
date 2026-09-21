import { createRoot } from 'react-dom/client'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router'
import MotorRecompra from '../src/pages/MotorRecompra'
import { useAuthStore } from '../src/store/authStore'
import '../src/index.css'

useAuthStore.setState({ token: `test.${btoa(JSON.stringify({ exp: 9999999999 }))}.test`, isAuthenticated: true })

/**
 * Destino del atajo "Entender cómo funciona el link": la tab de Campañas vive en Clientes
 * (`?tab=adquisicion&vista=campanas`). Acá no se monta la pantalla real —el router de la app la
 * resuelve— sino que se deja ver a dónde navegó.
 */
function DestinoClientes() {
  const { search } = useLocation()
  return <div data-testid="destino-clientes">{search}</div>
}

// El motor se monta como lo monta `RetencionPanel`: columna flex de altura
// completa. Sin eso el layout de dos columnas no tiene contra qué medirse.
createRoot(document.getElementById('root')!).render(
  <div className="flex h-dvh min-h-0 flex-col">
    <MemoryRouter initialEntries={['/motor']}>
      <Routes>
        <Route path="/motor" element={<MotorRecompra />} />
        <Route path="/dashboard/clientes" element={<DestinoClientes />} />
      </Routes>
    </MemoryRouter>
  </div>,
)
