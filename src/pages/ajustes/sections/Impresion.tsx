import { useState } from 'react'
import { Loader2, List, Printer, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usePrinter } from '@/context/PrinterContext'
import { commandsToBytes } from '@/utils/printerUtils'
import { AjusteRow } from '../components/AjusteRow'
import { AjusteEditor } from '../components/AjusteEditor'

const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
const DOWNLOAD_URL = 'https://piru.app'

export default function Impresion() {
  const [editor, setEditor] = useState(false)
  const { selectedPrinter } = usePrinter()

  // En web la impresión automática no existe: una línea + link de descarga.
  if (!isTauri) {
    return (
      <section className="space-y-6">
        <header className="space-y-1">
          <h2 className="text-lg font-medium text-foreground">Impresión</h2>
        </header>
        <p className="text-sm font-normal text-muted-foreground">
          La impresión automática funciona en la app de escritorio.{' '}
          <a
            href={DOWNLOAD_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
          >
            Descargar app <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-lg font-medium text-foreground">Impresión</h2>
        <p className="text-sm font-normal text-muted-foreground">
          Impresora térmica para tus comandas.
        </p>
      </header>

      <div>
        <AjusteRow
          titulo="Impresora"
          oracion={selectedPrinter || 'Sin impresora seleccionada'}
          estado={selectedPrinter ? 'configurado' : 'atencion'}
          onAccion={() => setEditor(true)}
        />
      </div>

      <AjusteEditor
        open={editor}
        onOpenChange={setEditor}
        titulo="Impresora"
        descripcion="Elegí la impresora térmica y probá una comanda."
      >
        <ImpresoraEditor />
      </AjusteEditor>
    </section>
  )
}

function ImpresoraEditor() {
  const { printers, selectedPrinter, setSelectedPrinter, refreshPrinters, printRaw } = usePrinter()
  const [buscando, setBuscando] = useState(false)
  const [imprimiendo, setImprimiendo] = useState(false)

  const buscar = async () => {
    setBuscando(true)
    try {
      await refreshPrinters()
    } finally {
      setBuscando(false)
    }
  }

  const imprimirPrueba = async () => {
    if (!selectedPrinter) return
    setImprimiendo(true)
    try {
      const data = [
        '\x1B\x40',
        '\x1B\x61\x01',
        '\x1B\x45\x01',
        'PRUEBA DE COMANDA\n',
        '\x1B\x45\x00',
        '\x1B\x61\x00',
        '--------------------------------\n',
        'Hamburguesa x1\n',
        '  SIN: Cebolla\n',
        'Papas Fritas x1\n',
        '--------------------------------\n',
        '\n\n\n',
        '\x1D\x56\x41',
      ]
      await printRaw(commandsToBytes(data))
    } finally {
      setImprimiendo(false)
    }
  }

  return (
    <div className="space-y-5">
      <Button
        variant="outline"
        onClick={buscar}
        disabled={buscando}
        className="h-11 min-h-[44px] w-full font-medium"
      >
        {buscando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <List className="mr-2 h-4 w-4" />}
        Buscar impresoras
      </Button>

      {printers.length > 0 && (
        <div className="space-y-1.5">
          <Label className="font-medium">Impresora</Label>
          <Select value={selectedPrinter || ''} onValueChange={setSelectedPrinter}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Elegí del listado…" />
            </SelectTrigger>
            <SelectContent>
              {[...printers].map((p, i) => (
                <SelectItem key={i} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Button
        variant="outline"
        onClick={imprimirPrueba}
        disabled={imprimiendo || !selectedPrinter}
        className="h-11 min-h-[44px] w-full font-medium"
      >
        {imprimiendo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
        Imprimir prueba
      </Button>
    </div>
  )
}
