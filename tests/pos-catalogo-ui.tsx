import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import PuntoDeVenta, { type PosDraft } from '../src/components/PuntoDeVenta'
import { PosConfigDialog } from '../src/components/PosConfigDialog'
import { PrinterProvider } from '../src/context/PrinterContext'
import { usePosConfig } from '../src/lib/posConfig'
import { useRestauranteStore } from '../src/store/restauranteStore'
import '../src/index.css'

useRestauranteStore.setState({ productos: [{
    id: 1, restauranteId: 1, categoriaId: 1, nombre: 'Empanada de carne', precio: '8000',
    categoria: 'Empanadas', activo: true, imagenUrl: null, descripcion: null, createdAt: '',
}] })

function Fixture() {
    const config = usePosConfig()
    const [open, setOpen] = useState(false)
    const [draft, setDraft] = useState<PosDraft | null>(null)
    const [detalle, setDetalle] = useState(false)
    return <main className="mx-auto max-w-5xl p-8">
        <button onClick={() => setOpen(true)}>Configurar POS</button>
        <button onClick={() => setDetalle(!detalle)}>Cambiar vista</button>
        {config.catalogoEnColumna && <aside aria-label="Catálogo" className="h-[600px] w-[400px]"><div id="pos-catalogo-compacto" className="h-full" /></aside>}
        {!detalle && <section aria-label="Comanda" className="w-[550px]">
            <h1>Nuevo pedido</h1>
            {!config.catalogoEnColumna && <div id="pos-catalogo-compacto" />}
            <output>{draft?.items.length ?? 0} ítems</output>
        </section>}
        <PuntoDeVenta catalogoCompacto sucursalActivaId={null} onClose={() => {}} onCreated={() => {}} onDraftChange={setDraft} autoFocusSearch={!detalle} />
        <PosConfigDialog open={open} onOpenChange={setOpen} />
    </main>
}
createRoot(document.getElementById('root')!).render(<PrinterProvider><Fixture /></PrinterProvider>)
