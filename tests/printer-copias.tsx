import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { mockIPC } from '@tauri-apps/api/mocks'
import { PrinterProvider, usePrinter } from '../src/context/PrinterContext'
import { PosConfigDialog } from '../src/components/PosConfigDialog'
import { useModulosStore } from '../src/store/modulosStore'
import { commandsToBytes, formatComanda } from '../src/utils/printerUtils'
import { printerTargetKey, type PrinterTarget } from '../src/utils/printerTypes'
import '../src/index.css'

// Transporte Tauri simulado: jamás envía bytes a una impresora real.
const jobs: number[][] = []
const destinos: PrinterTarget[] = []
let rechazar = false

// Lo que el shell descubriría en el equipo de prueba.
const DESCUBIERTA: PrinterTarget = { kind: 'spooler', name: 'Impresora fixture' }

mockIPC((cmd, payload) => {
    if (cmd === 'get_printers') return [DESCUBIERTA]
    if (cmd === 'send_print_job') {
        const { target, content } = payload as { target: PrinterTarget; content: number[] }
        jobs.push(content)
        destinos.push(target)
        if (rechazar) throw new Error('Impresora desconectada')
    }
})

/**
 * Estado inicial del almacenamiento, elegido por el test:
 *   (sin parámetros)   clave vieja `tauri_printer_name` = "Impresora fixture"
 *   ?legacy=<nombre>   otra clave vieja (o vacía, para arrancar sin impresora)
 *   ?nueva=tcp         clave nueva con una impresora de red, además de la vieja
 *   ?nueva=rota        clave nueva con un JSON inválido, además de la vieja
 *   ?manual=2          dos impresoras cargadas a mano (cocina y barra, por TCP)
 */
const params = new URLSearchParams(window.location.search)
// Sólo las claves de impresora: la configuración del POS se persiste aparte y el test la recarga.
localStorage.removeItem('piru_printer_target')
localStorage.removeItem('piru_printer_targets_manual')
localStorage.removeItem('tauri_printer_name')
localStorage.setItem('tauri_printer_name', params.get('legacy') ?? 'Impresora fixture')
const nueva = params.get('nueva')
if (nueva === 'tcp') localStorage.setItem('piru_printer_target', JSON.stringify({ kind: 'tcp', host: '192.168.1.50', port: 9100 }))
if (nueva === 'rota') localStorage.setItem('piru_printer_target', '{"kind":"spooler"')
// La de cocina se elige con `?nueva=tcp`: es la misma que la primera manual.
if (params.get('manual') === '2') {
    localStorage.setItem('piru_printer_targets_manual', JSON.stringify([
        { kind: 'tcp', host: '192.168.1.50', port: 9100 },
        { kind: 'tcp', host: '192.168.1.51', port: 9100 },
    ]))
}

const categorias = [{ modulos: [{ codigo: 'impresion_comandas', activoAhora: true }] }] as any
useModulosStore.setState({ categorias, cargar: async () => {} })
const ticket = commandsToBytes(formatComanda({ id: 42, tipo: 'takeaway' }, [{ cantidad: 1, nombreProducto: 'Alfajor', precioUnitario: '1500' }], 'Local'))

function Fixture() {
    const { printComanda, printRaw, selectedPrinter, manualPrinters, removeManualPrinter } = usePrinter()
    const [open, setOpen] = useState(false)
    const [resultado, setResultado] = useState('')
    const [trabajos, setTrabajos] = useState<number[][]>([])
    const [enviados, setEnviados] = useState<PrinterTarget[]>([])
    const imprimir = async (raw = false) => {
        try {
            await (raw ? printRaw : printComanda)(ticket)
            setResultado('Impresión enviada')
        } catch (error) { setResultado((error as Error).message) }
        finally { setTrabajos([...jobs]); setEnviados([...destinos]) }
    }
    return <main className="p-6 space-y-4">
        <button onClick={() => setOpen(true)}>Configurar POS</button>
        <button onClick={() => imprimir()}>Imprimir comanda</button>
        <button onClick={() => imprimir(true)}>Imprimir prueba</button>
        <button onClick={() => { rechazar = true }}>Simular falla</button>
        <button onClick={() => useModulosStore.setState({ categorias: [] })}>Desactivar módulo</button>
        <output aria-label="Resultado">{resultado}</output>
        <button onClick={() => { if (selectedPrinter) removeManualPrinter(selectedPrinter) }}>Quitar la elegida</button>
        <output aria-label="Impresora">{selectedPrinter ? printerTargetKey(selectedPrinter) : 'sin-impresora'}</output>
        <output aria-label="Manuales">{JSON.stringify(manualPrinters.map(printerTargetKey))}</output>
        <output aria-label="Trabajos">{JSON.stringify(trabajos)}</output>
        <output aria-label="Destinos">{JSON.stringify(enviados)}</output>
        <PosConfigDialog open={open} onOpenChange={setOpen} />
    </main>
}
createRoot(document.getElementById('root')!).render(<PrinterProvider><Fixture /></PrinterProvider>)
