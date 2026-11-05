import { Receipt } from 'lucide-react'
import FacturacionAfipSection from '@/components/FacturacionAfipSection'
import { PaginaModulo } from '@/components/PaginaModulo'

/** Configuración fiscal y emisión de comprobantes ARCA (AFIP). */
export default function Facturacion() {
  return (
    <PaginaModulo
      titulo="Facturación"
      descripcion="Conectá tu CUIT y tu clave fiscal para emitir comprobantes electrónicos de ARCA (AFIP) desde el cierre de turno."
      modulo="facturacion_arca"
      ancho="max-w-3xl"
    >
      <div className="space-y-6">
        <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background p-5 text-sm text-muted-foreground">
          <Receipt className="mt-0.5 size-5 shrink-0 text-brand" />
          <p>
            Una vez configurada, la facturación se emite desde el cierre de turno para los pedidos
            entregados o archivados. Las mesas y los pedidos sin cobrar no se facturan.
          </p>
        </div>
        <FacturacionAfipSection />
      </div>
    </PaginaModulo>
  )
}
