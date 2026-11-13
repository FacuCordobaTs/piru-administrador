import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { repartidoresApi } from '@/lib/api'
import { parseImporte, type RepartidorStat } from '@/lib/repartidores'

const labelClass = 'text-xs font-semibold text-muted-foreground uppercase tracking-wide'
const inputClass = 'h-10 rounded-xl bg-muted/40'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  token: string | null
  repartidor: RepartidorStat | null
  onGuardado: () => void | Promise<void>
}

type CampoImporte = 'precioEnvio' | 'pagoDiaHabil' | 'pagoFinDeSemana' | 'pagoFeriado'

const CAMPOS: Array<{ campo: CampoImporte; label: string; ayuda: string; placeholder: string }> = [
  {
    campo: 'precioEnvio',
    label: 'Pago por envío',
    ayuda: 'Lo que le pagás por cada entrega asignada.',
    placeholder: '0',
  },
  {
    campo: 'pagoDiaHabil',
    label: 'Pago por día hábil',
    ayuda: 'Fijo por cada día trabajado de lunes a viernes.',
    placeholder: '0',
  },
  {
    campo: 'pagoFinDeSemana',
    label: 'Pago por sábado o domingo',
    ayuda: 'Fijo por cada día trabajado el fin de semana.',
    placeholder: '0',
  },
  {
    campo: 'pagoFeriado',
    label: 'Pago por feriado',
    ayuda: 'Fijo por cada feriado trabajado. Tiene prioridad sobre el fin de semana.',
    placeholder: '0',
  },
]

export function PagosRepartidorDialog({ open, onOpenChange, token, repartidor, onGuardado }: Props) {
  const [valores, setValores] = useState<Record<CampoImporte, string>>({
    precioEnvio: '',
    pagoDiaHabil: '',
    pagoFinDeSemana: '',
    pagoFeriado: '',
  })
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!open || !repartidor) return
    setValores({
      precioEnvio: repartidor.precioEnvio ? String(repartidor.precioEnvio) : '',
      pagoDiaHabil: repartidor.pagoDiaHabil ? String(repartidor.pagoDiaHabil) : '',
      pagoFinDeSemana: repartidor.pagoFinDeSemana ? String(repartidor.pagoFinDeSemana) : '',
      pagoFeriado: repartidor.pagoFeriado ? String(repartidor.pagoFeriado) : '',
    })
    setGuardando(false)
  }, [open, repartidor])

  const guardar = async () => {
    if (!token || !repartidor || guardando) return

    const importes = {} as Record<CampoImporte, number>
    for (const { campo, label } of CAMPOS) {
      const valor = parseImporte(valores[campo])
      if (valor == null) {
        toast.error(`${label} tiene que ser un importe válido`)
        return
      }
      importes[campo] = valor
    }

    setGuardando(true)
    try {
      await repartidoresApi.actualizarPagos(token, repartidor.id, importes)
      toast.success(`Pagos de ${repartidor.nombre} actualizados`)
      await onGuardado()
      onOpenChange(false)
    } catch (error) {
      toast.error('No se pudieron guardar los pagos', {
        description: error instanceof Error ? error.message : 'Intentá de nuevo.',
      })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pagos de {repartidor?.nombre ?? 'cadete'}</DialogTitle>
          <DialogDescription>
            La pantalla calcula la liquidación del período con estos importes. Un día cuenta como
            trabajado si el cadete tiene al menos una entrega asignada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {CAMPOS.map(({ campo, label, ayuda, placeholder }) => (
            <div key={campo} className="space-y-1.5">
              <Label htmlFor={`pago-${campo}`} className={labelClass}>{label}</Label>
              <Input
                id={`pago-${campo}`}
                inputMode="decimal"
                autoComplete="off"
                value={valores[campo]}
                onChange={(e) => setValores((prev) => ({ ...prev, [campo]: e.target.value }))}
                placeholder={placeholder}
                className={inputClass}
              />
              <p className="text-xs text-muted-foreground">{ayuda}</p>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void guardar()} disabled={guardando}>
            {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
            Guardar pagos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
