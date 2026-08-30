import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useModuloActivo } from '@/store/modulosStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { AjusteEditor } from '../components/AjusteEditor'
import { AjusteInput } from '../components/AjusteInput'
import { AjusteRow } from '../components/AjusteRow'

const formatoGtm = (value: string) => value.trim().toUpperCase()
const validarGtm = (value: string) => {
  if (value === '') return null
  return /^GTM-[A-Z0-9]{4,32}$/.test(value)
    ? null
    : 'Usá el ID del contenedor, por ejemplo GTM-ABC123.'
}

/** Configuración opcional de analítica: GTM se carga recién en el storefront (T28). */
export default function CrecimientoAjustes() {
  const [editorAbierto, setEditorAbierto] = useState(false)
  const navigate = useNavigate()
  const crecimientoActivo = useModuloActivo('crecimiento')
  const gtmContainerId = useRestauranteStore((state) => state.restaurante?.gtmContainerId?.trim() || '')

  if (!crecimientoActivo) {
    return (
      <section className="space-y-6">
        <header className="space-y-1">
          <h2 className="text-lg font-medium text-foreground">Crecimiento</h2>
        </header>
        <AjusteRow
          titulo="Medición de tu tienda"
          oracion="Activá Crecimiento desde Módulos para configurar tu medición."
          estado="sin-configurar"
          accionLabel="Ver módulos"
          onAccion={() => navigate('/dashboard/modulos')}
        />
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-lg font-medium text-foreground">Crecimiento</h2>
        <p className="text-sm font-normal text-muted-foreground">
          Medí las visitas y conversiones de tu tienda con tus propias herramientas.
        </p>
      </header>

      <AjusteRow
        titulo="Google Tag Manager"
        oracion={gtmContainerId ? `Contenedor ${gtmContainerId} configurado` : 'Sin contenedor configurado'}
        estado={gtmContainerId ? 'configurado' : 'sin-configurar'}
        onAccion={() => setEditorAbierto(true)}
      />

      <AjusteEditor
        open={editorAbierto}
        onOpenChange={setEditorAbierto}
        titulo="Google Tag Manager"
        descripcion="Pegá el ID de tu contenedor. Podés dejarlo vacío para desactivarlo."
      >
        <div className="space-y-3">
          <AjusteInput
            campo="gtmContainerId"
            label="ID del contenedor"
            placeholder="GTM-ABC123"
            mono
            transform={formatoGtm}
            validate={validarGtm}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Piru no instala Meta Pixel globalmente. Si lo usás, administralo desde tu contenedor de GTM.
          </p>
        </div>
      </AjusteEditor>
    </section>
  )
}
