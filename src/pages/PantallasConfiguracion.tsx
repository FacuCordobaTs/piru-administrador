import { type ComponentType } from 'react'
import { SettingsNavigation } from '@/components/SettingsNavigation'
import MonetizacionSection from '@/pages/ajustes/sections/Monetizacion'
import EntregasSection from '@/pages/ajustes/sections/Entregas'
import HorariosSection from '@/pages/ajustes/sections/Horarios'
import MiPaginaSection from '@/pages/ajustes/sections/MiPagina'

/**
 * Métodos de pago, Entregas y zonas, Horarios y Tienda salieron de Ajustes: son pantallas propias
 * del navbar. El contenido sigue viviendo en `pages/ajustes/sections/` (como Impresión) para no
 * duplicar los editores.
 */
function pantalla(Section: ComponentType) {
  return function Pantalla() {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:py-12">
        <SettingsNavigation>
          <Section />
        </SettingsNavigation>
      </div>
    )
  }
}

export const MetodosPago = pantalla(MonetizacionSection)
export const Entregas = pantalla(EntregasSection)
export const Horarios = pantalla(HorariosSection)
export const Tienda = pantalla(MiPaginaSection)
