import { useState } from 'react'
import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Loader2, List, Printer, ExternalLink, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { describePrinterTarget, printerTargetKey, type PrinterTarget } from '@/utils/printerTypes'
import { esElMismoDestino } from '@/utils/printerTargetStorage'
import { AjusteRow } from '../components/AjusteRow'
import { AjusteEditor } from '../components/AjusteEditor'
import { useModuloActivo } from '@/store/modulosStore'
import {
  TIPOS_CONEXION,
  borradorInicial,
  destinosDisponibles,
  errorBaud,
  errorDeviceId,
  errorPuertoTcp,
  esTipoConexion,
  targetDelBorrador,
  type BorradorImpresora,
} from './impresionEditor'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
const DOWNLOAD_URL = 'https://piru.app'

export default function Impresion() {
  const [editor, setEditor] = useState(false)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const impresionActiva = useModuloActivo('impresion_comandas')
  const { selectedPrinter } = usePrinter()

  useEffect(() => {
    if (searchParams.get('config') === 'impresion' && impresionActiva) setEditor(true)
  }, [impresionActiva, searchParams])

  // En web la impresión automática no existe: una línea + link de descarga.
  if (!impresionActiva) {
    return (
      <section className="space-y-6">
        <header className="space-y-1">
          <h2 className="text-lg font-medium text-foreground">Impresión</h2>
        </header>
        <AjusteRow
          titulo="Impresión de comandas"
          oracion="Activala desde Módulos para elegir una impresora"
          estado="sin-configurar"
          accionLabel="Ver módulos"
          onAccion={() => navigate('/dashboard/ajustes/impresion#modulos-seccion')}
        />
      </section>
    )
  }

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
          oracion={selectedPrinter ? describePrinterTarget(selectedPrinter) : 'Sin impresora seleccionada'}
          estado={selectedPrinter ? 'configurado' : 'atencion'}
          onAccion={() => setEditor(true)}
        />
      </div>

      <AjusteEditor
        open={editor && impresionActiva}
        onOpenChange={setEditor}
        titulo="Impresora"
        descripcion="Elegí la impresora térmica y probá una comanda."
      >
        <ImpresoraEditor />
      </AjusteEditor>
    </section>
  )
}

interface CampoProps {
  id: string
  label: string
  value: string
  onChange: (valor: string) => void
  placeholder?: string
  inputMode?: 'text' | 'numeric'
  /** Problema del valor mientras se escribe: se muestra debajo, sin esperar a guardar. */
  error?: string | null
}

/** Campo de texto del formulario: misma etiqueta y alto que el resto de Ajustes. */
function Campo({ id, label, value, onChange, placeholder, inputMode = 'text', error = null }: CampoProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="font-medium">
        {label}
      </Label>
      <Input
        id={id}
        className="h-11"
        value={value}
        inputMode={inputMode}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(evento) => onChange(evento.target.value)}
      />
      {error && (
        <p id={`${id}-error`} className="text-xs font-normal text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

function ImpresoraEditor() {
  const {
    printers,
    manualPrinters,
    selectedPrinter,
    setSelectedPrinter,
    addManualPrinter,
    removeManualPrinter,
    refreshPrinters,
    printRaw,
  } = usePrinter()
  const [buscando, setBuscando] = useState(false)
  const [imprimiendo, setImprimiendo] = useState(false)
  const [borrador, setBorrador] = useState<BorradorImpresora>(borradorInicial)
  const [aviso, setAviso] = useState<{ error: boolean; texto: string } | null>(null)

  // Lo descubierto por el sistema + las cargadas a mano + la elegida (aunque no esté en ninguna).
  const destinos = destinosDisponibles(printers, manualPrinters, selectedPrinter)
  const ayudaTipo = TIPOS_CONEXION.find((info) => info.tipo === borrador.tipo)?.ayuda

  const editar = (campo: keyof BorradorImpresora) => (valor: string) => {
    setBorrador((previo) => ({ ...previo, [campo]: valor }))
    setAviso(null)
  }

  const buscar = async () => {
    setBuscando(true)
    try {
      await refreshPrinters()
    } finally {
      setBuscando(false)
    }
  }

  /**
   * Agregar a mano guarda la impresora en la lista del equipo y además la elige: es lo que se
   * quiere después de tipearla. Repetir la misma no la duplica, sólo la vuelve a elegir.
   */
  const agregar = () => {
    const resultado = targetDelBorrador(borrador)
    if (!resultado.ok) {
      setAviso({ error: true, texto: resultado.error })
      return
    }
    addManualPrinter(resultado.target)
    setSelectedPrinter(resultado.target)
    setAviso({ error: false, texto: `Elegida: ${describePrinterTarget(resultado.target)}` })
  }

  /**
   * Quitar una cargada a mano. Si era la elegida, el contexto suelta la elección: el equipo queda
   * sin impresora y el aviso lo dice, en vez de fallar recién al imprimir.
   */
  const quitar = (destino: PrinterTarget) => {
    const eraLaElegida = esElMismoDestino(selectedPrinter, destino)
    removeManualPrinter(destino)
    setAviso(
      eraLaElegida
        ? { error: true, texto: 'Quitaste la impresora elegida. Elegí otra para poder imprimir.' }
        : null,
    )
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

      <div className="space-y-1.5">
        <Label htmlFor="impresora-destino" className="font-medium">Impresora</Label>
        {destinos.length > 0 ? (
          <Select
            value={selectedPrinter ? printerTargetKey(selectedPrinter) : ''}
            onValueChange={(clave) => {
              const destino = destinos.find((candidato) => printerTargetKey(candidato) === clave)
              if (destino) {
                setSelectedPrinter(destino)
                setAviso(null)
              }
            }}
          >
            <SelectTrigger id="impresora-destino" className="h-11">
              <SelectValue placeholder="Elegí del listado…" />
            </SelectTrigger>
            <SelectContent>
              {destinos.map((destino) => (
                <SelectItem key={printerTargetKey(destino)} value={printerTargetKey(destino)}>
                  {describePrinterTarget(destino)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-[13px] font-normal text-muted-foreground">
            Todavía no hay ninguna. Buscá de nuevo o cargala a mano acá abajo.
          </p>
        )}
      </div>

      <div className="space-y-4 rounded-lg border border-border p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Agregar a mano</p>
          <p className="text-[13px] font-normal text-muted-foreground">
            Para una impresora que la búsqueda no encuentra. Queda guardada en este equipo.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="impresora-tipo" className="font-medium">Tipo de conexión</Label>
          <Select
            value={borrador.tipo}
            onValueChange={(tipo) => {
              if (!esTipoConexion(tipo)) return
              setBorrador((previo) => ({ ...previo, tipo }))
              setAviso(null)
            }}
          >
            <SelectTrigger id="impresora-tipo" className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_CONEXION.map((info) => (
                <SelectItem key={info.tipo} value={info.tipo}>
                  {info.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {ayudaTipo && <p className="text-[13px] font-normal text-muted-foreground">{ayudaTipo}</p>}
        </div>

        {borrador.tipo === 'spooler' && (
          <Campo
            id="impresora-nombre"
            label="Nombre en Windows"
            value={borrador.nombre}
            onChange={editar('nombre')}
            placeholder="EPSON TM-T20III"
          />
        )}

        {borrador.tipo === 'tcp' && (
          <>
            <Campo
              id="impresora-host"
              label="IP o nombre"
              value={borrador.host}
              onChange={editar('host')}
              placeholder="192.168.1.50"
            />
            <Campo
              id="impresora-puerto-tcp"
              label="Puerto"
              value={borrador.puertoTcp}
              onChange={editar('puertoTcp')}
              inputMode="numeric"
              error={errorPuertoTcp(borrador.puertoTcp)}
            />
          </>
        )}

        {borrador.tipo === 'serial' && (
          <>
            <Campo
              id="impresora-puerto-serie"
              label="Puerto serie"
              value={borrador.puertoSerie}
              onChange={editar('puertoSerie')}
              placeholder="COM3"
            />
            <Campo
              id="impresora-baud"
              label="Baudios"
              value={borrador.baud}
              onChange={editar('baud')}
              inputMode="numeric"
              error={errorBaud(borrador.baud)}
            />
          </>
        )}

        {borrador.tipo === 'bluetooth' && (
          <Campo
            id="impresora-mac"
            label="MAC"
            value={borrador.mac}
            onChange={editar('mac')}
            placeholder="AA:BB:CC:DD:EE:FF"
          />
        )}

        {borrador.tipo === 'usb-android' && (
          <Campo
            id="impresora-device-id"
            label="Dispositivo USB"
            value={borrador.deviceId}
            onChange={editar('deviceId')}
            inputMode="numeric"
            placeholder="0"
            error={errorDeviceId(borrador.deviceId)}
          />
        )}

        {aviso && (
          <p className={aviso.error ? 'text-xs font-normal text-destructive' : 'text-xs font-normal text-muted-foreground'}>
            {aviso.texto}
          </p>
        )}

        <Button
          variant="outline"
          onClick={agregar}
          className="h-11 min-h-[44px] w-full font-medium"
        >
          Agregar impresora
        </Button>
      </div>

      {manualPrinters.length > 0 && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Cargadas a mano</p>
            <p className="text-[13px] font-normal text-muted-foreground">
              Quedan guardadas en este equipo, aunque la búsqueda no las encuentre.
            </p>
          </div>
          <ul className="space-y-2">
            {manualPrinters.map((destino) => (
              <li key={printerTargetKey(destino)} className="flex items-center justify-between gap-3">
                <span className="text-sm font-normal text-foreground">
                  {describePrinterTarget(destino)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => quitar(destino)}
                  aria-label={`Quitar ${describePrinterTarget(destino)}`}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Quitar
                </Button>
              </li>
            ))}
          </ul>
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
