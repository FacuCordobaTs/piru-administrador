import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import { SucursalSelector } from '../src/components/SucursalSelector'
import { SucursalDialog } from '../src/pages/ajustes/components/SucursalDialog'
import { useAuthStore } from '../src/store/authStore'
import '../src/index.css'

useAuthStore.getState().setAuth('test-token', { id: 1, nombre: 'Local fixture', email: 'test@example.test' })
function Fixture() {
    const [selector, setSelector] = useState(false)
    const [crear, setCrear] = useState(false)
    const [eleccion, setEleccion] = useState('')
    const [guardado, setGuardado] = useState(false)
    const convencional = new URLSearchParams(location.search).has('convencional')
    return <main className="p-6">
        <button onClick={() => setSelector(true)}>Elegir sede</button>
        <button onClick={() => setCrear(true)}>Crear evento</button>
        <output aria-label="Sede elegida">{eleccion}</output>
        {guardado && <p>Evento guardado</p>}
        <SucursalSelector open={selector} onOpenChange={setSelector} tieneEventos={!convencional}
            sucursalesActivas={[{ id: 20, nombre: convencional ? 'Centro' : 'Fiesta', activo: true, soloPos: !convencional }]}
            onSelect={(id, nombre) => { setEleccion(`${id ?? 'local'}: ${nombre}`); setSelector(false) }} />
        <SucursalDialog open={crear} onOpenChange={setCrear} editando={null} crearSoloPos onSaved={() => setGuardado(true)} />
        <Toaster />
    </main>
}
createRoot(document.getElementById('root')!).render(<Fixture />)
