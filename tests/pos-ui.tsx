// Harness de navegador; no forma parte de los entrypoints publicados del admin.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ClienteAutocomplete } from '../src/components/ClienteAutocomplete'
import { PosConfigDialog } from '../src/components/PosConfigDialog'
import { useAuthStore } from '../src/store/authStore'
import '../src/index.css'

useAuthStore.getState().setAuth('test-token', { id: 1, nombre: 'Local fixture', email: 'test@example.test' })
function Fixture() {
    const [datos, setDatos] = useState({ nombreCliente: '', telefono: '' })
    const [configOpen, setConfigOpen] = useState(false)
    return <main className="p-6 max-w-4xl mx-auto space-y-6">
        <h1 tabIndex={0}>Cliente POS — validación</h1>
        <div className="grid md:grid-cols-2 gap-10">
            <section aria-label="Móvil"><h2>Móvil</h2><ClienteAutocomplete nombre={datos.nombreCliente} telefono={datos.telefono} mostrarNombre mostrarTelefono onChange={setDatos} /></section>
            <section aria-label="Desktop"><h2>Desktop</h2><ClienteAutocomplete compacto nombre={datos.nombreCliente} telefono={datos.telefono} mostrarNombre mostrarTelefono={false} onChange={setDatos} /></section>
        </div>
        <output aria-label="Datos seleccionados">{JSON.stringify(datos)}</output>
        <button onClick={() => setConfigOpen(true)}>Configurar POS</button>
        <PosConfigDialog open={configOpen} onOpenChange={setConfigOpen} />
        <button onClick={() => useAuthStore.getState().logout()}>Salir</button>
    </main>
}
createRoot(document.getElementById('root')!).render(<Fixture />)
