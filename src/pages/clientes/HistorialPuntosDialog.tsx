import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { puntosApi, type TransaccionPuntosData } from '@/lib/api'
import { Loader2, Plus, Minus, History, Sparkles, ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { formatDate } from './types'

interface HistorialPuntosDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  token: string
  clienteId: number
  clienteNombre: string
  puntosActuales: number
  onPuntosActualizados: (nuevosPuntos: number) => void
}

const tipoTransaccionLabel: Record<string, string> = {
  acumulacion_pedido: 'Suma por compra',
  bono_bienvenida: 'Bono primer pedido',
  canje_producto: 'Canje de producto',
  canje_envio: 'Canje envío gratis',
  canje_descuento: 'Canje cupón descuento',
  ajuste_manual: 'Ajuste manual',
  reversion_cancelacion: 'Reversión cancelación',
}

export function HistorialPuntosDialog({
  open,
  onOpenChange,
  token,
  clienteId,
  clienteNombre,
  puntosActuales,
  onPuntosActualizados,
}: HistorialPuntosDialogProps) {
  const [transacciones, setTransacciones] = useState<TransaccionPuntosData[]>([])
  const [loading, setLoading] = useState(false)
  const [puntos, setPuntos] = useState(puntosActuales)

  // Ajuste manual
  const [mostrarAjuste, setMostrarAjuste] = useState(false)
  const [tipoOperacion, setTipoOperacion] = useState<'sumar' | 'restar'>('sumar')
  const [cantidadPuntos, setCantidadPuntos] = useState('')
  const [motivo, setMotivo] = useState('')
  const [guardandoAjuste, setGuardandoAjuste] = useState(false)

  const cargarHistorial = async () => {
    if (!token || !clienteId) return
    setLoading(true)
    try {
      const res = await puntosApi.getHistorialCliente(token, clienteId)
      if (res.success && res.data) {
        setTransacciones(res.data.transacciones || [])
        if (res.data.cliente?.puntos !== undefined) {
          setPuntos(res.data.cliente.puntos)
          onPuntosActualizados(res.data.cliente.puntos)
        }
      }
    } catch (err: any) {
      toast.error('Error al cargar historial de puntos', { description: err.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      setPuntos(puntosActuales)
      setMostrarAjuste(false)
      setCantidadPuntos('')
      setMotivo('')
      void cargarHistorial()
    }
  }, [open, clienteId])

  const handleGuardarAjuste = async (e: React.FormEvent) => {
    e.preventDefault()
    const cant = parseInt(cantidadPuntos, 10)
    if (isNaN(cant) || cant <= 0) {
      toast.error('Ingresá una cantidad de puntos válida mayor a cero')
      return
    }
    const puntosAjuste = tipoOperacion === 'sumar' ? cant : -cant
    if (tipoOperacion === 'restar' && cant > puntos) {
      toast.error('No podés restar más puntos de los que el cliente posee')
      return
    }

    setGuardandoAjuste(true)
    try {
      const res = await puntosApi.ajusteManual(token, clienteId, {
        puntos: puntosAjuste,
        motivo: motivo.trim() || (tipoOperacion === 'sumar' ? 'Ajuste manual de cortesía' : 'Ajuste manual'),
      })
      if (res.success) {
        toast.success(res.message)
        setPuntos(res.data.puntosActuales)
        onPuntosActualizados(res.data.puntosActuales)
        setMostrarAjuste(false)
        setCantidadPuntos('')
        setMotivo('')
        await cargarHistorial()
      } else {
        toast.error(res.message || 'No se pudo realizar el ajuste')
      }
    } catch (err: any) {
      toast.error('Error al realizar ajuste', { description: err.message })
    } finally {
      setGuardandoAjuste(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-6 rounded-3xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>Puntos de Fidelización</span>
          </div>
          <DialogTitle className="text-xl font-bold flex items-center justify-between mt-1">
            <span className="truncate">{clienteNombre}</span>
            <span className="shrink-0 bg-amber-500/15 text-amber-700 dark:text-amber-300 px-3 py-1 rounded-full text-base font-black">
              {puntos} pts
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Auditoría y movimientos de puntos acumulados y canjeados.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between pt-2 pb-1 border-b border-border/40">
          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <History className="w-3.5 h-3.5" />
            Movimientos ({transacciones.length})
          </span>
          <Button
            size="sm"
            variant={mostrarAjuste ? 'secondary' : 'outline'}
            onClick={() => setMostrarAjuste(!mostrarAjuste)}
            className="h-7 text-xs rounded-full gap-1"
          >
            {mostrarAjuste ? 'Cancelar ajuste' : 'Ajustar puntos'}
          </Button>
        </div>

        {mostrarAjuste && (
          <form onSubmit={handleGuardarAjuste} className="p-4 rounded-2xl bg-muted/40 border border-border/50 space-y-3 animate-in fade-in">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTipoOperacion('sumar')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 ${
                  tipoOperacion === 'sumar'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                <Plus className="w-3 h-3" /> Sumar puntos
              </button>
              <button
                type="button"
                onClick={() => setTipoOperacion('restar')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 ${
                  tipoOperacion === 'restar'
                    ? 'bg-destructive text-white'
                    : 'bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                <Minus className="w-3 h-3" /> Restar puntos
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] text-muted-foreground font-semibold">Cantidad</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="ej. 100"
                  value={cantidadPuntos}
                  onChange={(e) => setCantidadPuntos(e.target.value)}
                  className="h-9 mt-1 rounded-xl text-sm font-semibold"
                  required
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground font-semibold">Motivo (opcional)</Label>
                <Input
                  type="text"
                  placeholder="ej. Cortesía del local"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  className="h-9 mt-1 rounded-xl text-sm"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={guardandoAjuste || !cantidadPuntos}
              className="w-full h-9 rounded-xl text-xs font-bold"
            >
              {guardandoAjuste ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirmar ajuste'}
            </Button>
          </form>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 py-1">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : transacciones.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              Sin movimientos registrados para este cliente.
            </div>
          ) : (
            transacciones.map((t) => {
              const esPositivo = t.puntos > 0
              return (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/40 text-xs"
                >
                  <div className="min-w-0 flex items-center gap-2.5">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        esPositivo ? 'bg-emerald-500/10 text-emerald-600' : 'bg-destructive/10 text-destructive'
                      }`}
                    >
                      {esPositivo ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {tipoTransaccionLabel[t.tipo] || t.tipo}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {t.motivo} · {formatDate(t.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className={`font-black ${esPositivo ? 'text-emerald-600' : 'text-destructive'}`}>
                      {esPositivo ? `+${t.puntos}` : t.puntos} pts
                    </p>
                    <p className="text-[10px] text-muted-foreground">Saldo: {t.saldoResultante}</p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
