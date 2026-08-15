import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import FacturacionAfipSection from '@/components/FacturacionAfipSection'
import { facturacionApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { AjusteRow } from '../components/AjusteRow'
import { AjusteEditor } from '../components/AjusteEditor'
import { useModuloActivo } from '@/store/modulosStore'

export default function Facturacion() {
  const [editor, setEditor] = useState(false)
  const [habilitada, setHabilitada] = useState<boolean | null>(null)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const facturacionActiva = useModuloActivo('facturacion_arca')

  useEffect(() => {
    if (searchParams.get('config') === 'arca' && facturacionActiva) setEditor(true)
  }, [facturacionActiva, searchParams])

  // Solo para la oración de la fila; el formulario vive dentro del editor.
  useEffect(() => {
    const token = useAuthStore.getState().token
    if (!token) return
    facturacionApi
      .getEstado(token)
      .then((res) => {
        const data = res as { success: boolean; data?: { habilitado?: boolean } }
        setHabilitada(!!data.data?.habilitado)
      })
      .catch(() => setHabilitada(false))
  }, [])

  const configurada = habilitada === true

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-lg font-medium text-foreground">Facturación</h2>
        <p className="text-sm font-normal text-muted-foreground">
          Facturación electrónica con AFIP/ARCA.
        </p>
      </header>

      {!facturacionActiva ? (
        <div>
          <AjusteRow
            titulo="Facturación electrónica"
            oracion="Activala desde Módulos para configurar ARCA"
            estado="sin-configurar"
            accionLabel="Ver módulos"
            onAccion={() => navigate('/dashboard/modulos')}
          />
        </div>
      ) : <div>
        <AjusteRow
          titulo="Facturación electrónica"
          oracion={
            habilitada === null ? 'Cargando…' : configurada ? 'Configurada' : 'Sin configurar'
          }
          estado={configurada ? 'configurado' : 'sin-configurar'}
          accionLabel={configurada ? 'Cambiar' : 'Configurar'}
          onAccion={() => setEditor(true)}
        />
      </div>}

      <AjusteEditor
        open={editor && facturacionActiva}
        onOpenChange={setEditor}
        titulo="Facturación electrónica"
        descripcion="Conectá tu CUIT y clave fiscal de ARCA para emitir comprobantes."
      >
        <FacturacionAfipSection />
      </AjusteEditor>
    </section>
  )
}
