import { createRoot } from 'react-dom/client'
import { PuntosPanel } from '../src/pages/clientes/PuntosPanel'
import { useAuthStore } from '../src/store/authStore'
import '../src/index.css'

useAuthStore.setState({ token: `test.${btoa(JSON.stringify({ exp: 9999999999 }))}.test`, isAuthenticated: true })

// La mitad Puntos se monta como la monta `RetencionPanel`: columna flex de
// altura completa. Sin eso el layout de dos columnas no tiene contra qué medirse.
createRoot(document.getElementById('root')!).render(
  <div className="flex h-dvh min-h-0 flex-col">
    <PuntosPanel />
  </div>,
)
