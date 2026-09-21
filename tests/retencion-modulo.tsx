import { createRoot } from 'react-dom/client'
import { MemoryRouter, Routes, Route } from 'react-router'
import Clientes from '../src/pages/Clientes'
import { ModuloComercial } from '../src/components/ModuloComercial'
import { TrendingUp } from 'lucide-react'
import { useAuthStore } from '../src/store/authStore'
import '../src/index.css'

useAuthStore.setState({ token: `test.${btoa(JSON.stringify({ exp: 9999999999 }))}.test`, isAuthenticated: true })

/**
 * Pantalla real de Clientes: el switch de mitades de Retención vive en el header
 * del workspace, así que sólo montando la página completa se puede verificar que
 * con el módulo apagado no hay navegación. La ruta `#/divergente` monta un
 * `ModuloComercial` que se declara `pago` contra un catálogo que dice `incluido`,
 * para cubrir esa precedencia sin depender de que exista un consumidor así.
 */
createRoot(document.getElementById('root')!).render(
  <MemoryRouter initialEntries={[window.location.hash.slice(1) || '/clientes?tab=retencion']}>
    <Routes>
      <Route path="/clientes" element={<Clientes />} />
      <Route
        path="/divergente"
        element={
          <div className="flex h-dvh min-h-0 flex-col p-6">
            <ModuloComercial
              codigo="motor_recompra"
              variante="plana"
              tipo="pago"
              titulo="Retención"
              descripcion="Prueba de precedencia del catálogo."
              icono={TrendingUp}
            />
          </div>
        }
      />
    </Routes>
  </MemoryRouter>,
)
