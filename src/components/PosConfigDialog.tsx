import { useState } from 'react'
import {
  Armchair,
  Banknote,
  CreditCard,
  Columns3,
  Copy,
  Download,
  Loader2,
  Landmark,
  MapPin,
  Phone,
  ShoppingBag,
  Smartphone,
  StickyNote,
  Truck,
  User,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { descargarDirectorioPos } from '@/lib/directorioClientesPos'
import { getPosConfig, POS_METODOS_ORDER, POS_TIPOS_ORDER, setPosConfig, type PosConfig, type PosMetodoPago, type PosTipo } from '@/lib/posConfig'

const TIPOS_POS: Array<{ id: PosTipo; label: string; icon: typeof Truck }> = [
  { id: 'delivery', label: 'Delivery', icon: Truck },
  { id: 'mesa', label: 'Mesa', icon: Armchair },
  { id: 'takeaway', label: 'Takeaway', icon: ShoppingBag },
]

const METODOS_POS: Array<{ id: PosMetodoPago; label: string; icon: typeof Banknote }> = [
  { id: 'cash', label: 'Efectivo', icon: Banknote },
  { id: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
  { id: 'manual_transfer', label: 'Transferencia', icon: Landmark },
  { id: 'mercadopago', label: 'Mercado Pago', icon: Smartphone },
]

function FilaConfig({
  icon: Icon,
  label,
  descripcion,
  checked,
  disabled,
  onCheckedChange,
}: {
  icon: typeof Truck
  label: string
  descripcion?: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3 rounded-2xl border p-3.5', checked ? 'border-border' : 'border-border/60 bg-muted/30', disabled && 'opacity-60')}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {descripcion && <p className="mt-0.5 text-xs text-muted-foreground">{descripcion}</p>}
        </div>
      </div>
      <Switch aria-label={label} size="sm" checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  )
}

function PosConfigForm({ onSaved }: { onSaved: () => void }) {
  const [config, setConfig] = useState<PosConfig>(getPosConfig)
  const restauranteId = useAuthStore(s => s.restaurante?.id)
  const token = useAuthStore(s => s.token)
  const [descargando, setDescargando] = useState(false)
  const [descargado, setDescargado] = useState(false)

  const descargarClientes = async () => {
    if (restauranteId == null || !token || descargando) return
    setDescargando(true)
    setDescargado(false)
    try {
      await descargarDirectorioPos(restauranteId)
      setDescargado(true)
      toast.success('Clientes guardados en este dispositivo para usar sin conexión')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron descargar los clientes. Intentá nuevamente.')
    } finally {
      setDescargando(false)
    }
  }

  const toggleTipo = (tipo: PosTipo) => {
    setConfig((prev) => {
      const quedan = POS_TIPOS_ORDER.some((t) => t !== tipo && prev.tipos[t])
      if (prev.tipos[tipo] && !quedan) {
        toast.error('Dejá al menos un tipo de pedido activo')
        return prev
      }
      const activo = !prev.tipos[tipo]
      return {
        ...prev,
        tipos: { ...prev.tipos, [tipo]: activo },
        camposCliente: {
          ...prev.camposCliente,
          direccion: tipo === 'delivery' && !activo ? false : prev.camposCliente.direccion,
        },
      }
    })
  }

  const toggleMetodoPago = (id: PosMetodoPago) => {
    setConfig((prev) => {
      const quedan = POS_METODOS_ORDER.some((m) => m !== id && prev.metodosPago[m])
      if (prev.metodosPago[id] && !quedan) {
        toast.error('Dejá al menos un método de pago activo')
        return prev
      }
      return { ...prev, metodosPago: { ...prev.metodosPago, [id]: !prev.metodosPago[id] } }
    })
  }

  const toggleCampo = (campo: keyof PosConfig['camposCliente']) => {
    setConfig((prev) => ({ ...prev, camposCliente: { ...prev.camposCliente, [campo]: !prev.camposCliente[campo] } }))
  }

  const guardar = () => {
    setPosConfig(config)
    toast.success('Configuración del punto de venta guardada')
    onSaved()
  }

  return (
    <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
      <FilaConfig
        icon={Columns3}
        label="Mostrar columna de pedidos"
        descripcion="En pantallas grandes, ocultala para darle más espacio al catálogo de productos."
        checked={config.mostrarColumnaPedidos}
        onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, mostrarColumnaPedidos: checked, catalogoEnColumna: checked ? prev.catalogoEnColumna : true }))}
      />
      <FilaConfig
        icon={Columns3}
        label="Catálogo en tercera columna"
        descripcion="En pantallas grandes, muestra todos los productos junto a la comanda. Desactivado, aparecen sólo al buscar."
        checked={config.catalogoEnColumna}
        disabled={!config.mostrarColumnaPedidos}
        onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, catalogoEnColumna: checked }))}
      />
      <FilaConfig
        icon={ShoppingBag}
        label="Sólo productos del evento"
        descripcion="Al seleccionar un evento, oculta los productos del catálogo web y muestra sólo los asignados a ese evento."
        checked={config.soloProductosEvento}
        onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, soloProductosEvento: checked }))}
      />
      <FilaConfig
        icon={Copy}
        label="Imprimir cada comanda dos veces"
        descripcion="Dos copias iguales: una para el cliente y otra para el local. Incluye impresión automática y reimpresiones en este dispositivo."
        checked={config.imprimirComandaDosVeces}
        onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, imprimirComandaDosVeces: checked }))}
      />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tipos de pedido</p>
        <div className="mt-2 space-y-2">
          {TIPOS_POS.map((t) => <FilaConfig key={t.id} icon={t.icon} label={t.label} checked={config.tipos[t.id]} onCheckedChange={() => toggleTipo(t.id)} />)}
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Métodos de pago</p>
        <div className="mt-2 space-y-2">
          {METODOS_POS.map((m) => <FilaConfig key={m.id} icon={m.icon} label={m.label} checked={config.metodosPago[m.id]} onCheckedChange={() => toggleMetodoPago(m.id)} />)}
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Datos del cliente</p>
        <div className="mt-2 space-y-2">
          <FilaConfig icon={User} label="Nombre" checked={config.camposCliente.nombre} onCheckedChange={() => toggleCampo('nombre')} />
          <FilaConfig icon={Phone} label="Celular" checked={config.camposCliente.telefono} onCheckedChange={() => toggleCampo('telefono')} />
          <FilaConfig icon={MapPin} label="Dirección" descripcion="Requiere el tipo de pedido Delivery" checked={config.camposCliente.direccion} disabled={!config.tipos.delivery} onCheckedChange={() => toggleCampo('direccion')} />
        </div>
      </div>
      <FilaConfig icon={StickyNote} label="Nota" checked={config.notas} onCheckedChange={() => setConfig((prev) => ({ ...prev, notas: !prev.notas }))} />
      <div className="space-y-3 rounded-2xl border p-3.5">
        <div>
          <p className="text-sm font-medium">Clientes sin conexión</p>
          <p className="mt-1 text-xs text-muted-foreground">Descargá los nombres y celulares en este dispositivo para buscar clientes sin internet. La copia se guarda al tocar este botón; volvé a descargarla cuando quieras actualizarla.</p>
        </div>
        <Button type="button" variant="outline" className="h-auto w-full whitespace-normal" disabled={descargando || restauranteId == null || !token} onClick={descargarClientes}>
          {descargando ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Download className="h-4 w-4 shrink-0" />}
          {descargando ? 'Descargando clientes…' : 'Descargar clientes para usar sin conexión'}
        </Button>
        <p role="status" className="text-xs text-muted-foreground">{descargado ? 'Copia de clientes guardada en este dispositivo.' : 'Requiere conexión a internet.'}</p>
      </div>
      <DialogFooter className="gap-2 sm:gap-2">
        <Button variant="outline" onClick={onSaved}>Cancelar</Button>
        <Button onClick={guardar}>Guardar</Button>
      </DialogFooter>
    </div>
  )
}

/** Configuración local del POS, compartida por Módulos y el flujo de venta. */
export function PosConfigDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar punto de venta</DialogTitle>
          <DialogDescription>Elegí qué datos y opciones se cargan al anotar un pedido. La configuración se guarda en este dispositivo.</DialogDescription>
        </DialogHeader>
        {open && <PosConfigForm onSaved={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}
