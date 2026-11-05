import { SettingsNavigation } from '@/components/SettingsNavigation'
import ImpresionSection from '@/pages/ajustes/sections/Impresion'

/**
 * La configuración de impresión salió de Ajustes: ahora es una pantalla propia
 * del navbar. El contenido sigue viviendo en la sección para no duplicar la
 * lógica del editor de impresoras.
 */
export default function Impresion() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:py-12">
      <SettingsNavigation>
        <ImpresionSection />
      </SettingsNavigation>
    </div>
  )
}
