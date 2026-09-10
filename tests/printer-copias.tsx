import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { mockIPC } from '@tauri-apps/api/mocks'
import { PrinterProvider, usePrinter } from '../src/context/PrinterContext'
import { PosConfigDialog } from '../src/components/PosConfigDialog'
import { useModulosStore } from '../src/store/modulosStore'
import { commandsToBytes, formatComanda } from '../src/utils/printerUtils'
import '../src/index.css'

// Transporte Tauri simulado: jamás envía bytes a una impresora real.
const jobs: number[][] = []
let rechazar = false
mockIPC((cmd, payload) => {
    if (cmd === 'get_printers') return ['Impresora fixture']
    if (cmd === 'send_print_job') {
        jobs.push((payload as { content: number[] }).content)
        if (rechazar) throw new Error('Impresora desconectada')
    }
})
const categorias = [{ modulos: [{ codigo: 'impresion_comandas', activoAhora: true }] }] as any
useModulosStore.setState({ categorias, cargar: async () => {} })
localStorage.setItem('tauri_printer_name', 'Impresora fixture')
const ticket = commandsToBytes(formatComanda({ id: 42, tipo: 'takeaway' }, [{ cantidad: 1, nombreProducto: 'Alfajor', precioUnitario: '1500' }], 'Local'))

function Fixture() {
    const { printComanda, printRaw } = usePrinter()
    const [open, setOpen] = useState(false)
    const [resultado, setResultado] = useState('')
    const [trabajos, setTrabajos] = useState<number[][]>([])
    const imprimir = async (raw = false) => {
        try {
            await (raw ? printRaw : printComanda)(ticket)
            setResultado('Impresión enviada')
        } catch (error) { setResultado((error as Error).message) }
        finally { setTrabajos([...jobs]) }
    }
    return <main className="p-6 space-y-4">
        <button onClick={() => setOpen(true)}>Configurar POS</button>
        <button onClick={() => imprimir()}>Imprimir comanda</button>
        <button onClick={() => imprimir(true)}>Imprimir prueba</button>
        <button onClick={() => { rechazar = true }}>Simular falla</button>
        <button onClick={() => useModulosStore.setState({ categorias: [] })}>Desactivar módulo</button>
        <output aria-label="Resultado">{resultado}</output>
        <output aria-label="Trabajos">{JSON.stringify(trabajos)}</output>
        <PosConfigDialog open={open} onOpenChange={setOpen} />
    </main>
}
createRoot(document.getElementById('root')!).render(<PrinterProvider><Fixture /></PrinterProvider>)
