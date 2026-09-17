import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { puntosApi, type TransaccionPuntosData } from '@/lib/api'
import { ArrowDownRight, ArrowUpRight, History, Loader2, Minus, Plus, Sparkles } from 'lucide-react'
import { formatFechaHora, formatPuntos, metaMovimientoPuntos } from './types'

/**
 * Fila de un movimiento de puntos. La comparten el historial por cliente, el
 * detalle del panel y el ledger global, así un movimiento se lee igual en los
 * tres lugares.
 */
export function FilaMovimientoPuntos({
  movimiento,
  onSeleccionarCliente,
  compacto = false,
}: {
  movimiento: TransaccionPuntosData | { id: number; tipo: string; puntos: number; saldoResultante: number; motivo: string; createdAt: string | null; clienteId?: number; clienteNombre?: string }
  onSeleccionarCliente?: (clienteId: number) => void
  compacto?: boolean
}) {
  const meta = metaMovimientoPuntos(movimiento.tipo)
  const esPositivo = movimiento.puntos > 0
  const nombre = (movimiento as { clienteNombre?: string }).clienteNombre
  const clienteId = (movimiento as { clienteId?: number }).clienteId
  const clickeable = Boolean(onSeleccionarCliente && clienteId)

  return (
    <div
      role={clickeable ? 'button' : undefined}
      tabIndex={clickeable ? 0 : undefined}
      onClick={clickeable ? () => onSeleccionarCliente?.(clienteId as number) : undefined}
      onKeyDown={clickeable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSeleccionarCliente?.(clienteId as number) } } : undefined}
      className={`flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-card p-3 text-xs ${clickeable ? 'cursor-pointer transition-colors hover:border-border hover:bg-muted/40' : ''} ${compacto ? 'p-2.5' : ''}`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${esPositivo ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-destructive/10 text-destructive'}`}>
          {esPositivo ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">
            {nombre ? <span>{nombre} · </span> : null}
            <span className="font-medium text-muted-foreground">{meta.label}</span>
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {movimiento.motivo} · {formatFechaHora(movimiento.createdAt)}
          </p>
        </div>
      </div>
      <div className="ml-2 shrink-0 text-right">
        <p className={`font-black tabular-nums ${esPositivo ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
          {esPositivo ? `+${formatPuntos(movimiento.puntos)}` : formatPuntos(movimiento.puntos)} pts
        </p>
        <p className="text-[10px] text-muted-foreground">Saldo: {formatPuntos(movimiento.saldoResultante)}</p>
      </div>
    </div>
  )
}

interface HistorialPuntosContenidoProps {
  token: string
  clienteId: number
  /** Saldo que ya conoce el contenedor; se usa mientras llega la respuesta. */
  puntosActuales: number
  onPuntosActualizados?: (nuevosPuntos: number) => void
  className?: string
}

/**
 * Cuerpo del historial de puntos de un cliente: movimientos + ajuste manual.
 * Lo usan el diálogo del directorio de clientes y la mitad Puntos de Retención.
 */
export function HistorialPuntosContenido({
  token,
  clienteId,
  puntosActuales,
  onPuntosActualizados,
  className,
}: HistorialPuntosContenidoProps) {
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
        setTransacciones(res.data.transacciones ?? [])
        if (res.data.cliente?.puntos !== undefined) {
          setPuntos(res.data.cliente.puntos)
          onPuntosActualizados?.(res.data.cliente.puntos)
        }
      }
    } catch (err) {
      toast.error('Error al cargar historial de puntos', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setPuntos(puntosActuales)
    setMostrarAjuste(false)
    setCantidadPuntos('')
    setMotivo('')
    void cargarHistorial()
    // `cargarHistorial` se rearma con cada cliente; el efecto depende sólo del cliente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, token])

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
        onPuntosActualizados?.(res.data.puntosActuales)
        setMostrarAjuste(false)
        setCantidadPuntos('')
        setMotivo('')
        await cargarHistorial()
      } else {
        toast.error(res.message || 'No se pudo realizar el ajuste')
      }
    } catch (err) {
      toast.error('Error al realizar ajuste', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setGuardandoAjuste(false)
    }
  }

  return (
    <div className={className ?? 'flex min-h-0 flex-1 flex-col'}>
      <div className="flex items-center justify-between border-b border-border/40 pb-1 pt-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <History className="h-3.5 w-3.5" />
          Movimientos ({transacciones.length})
        </span>
        <Button
          size="sm"
          variant={mostrarAjuste ? 'secondary' : 'outline'}
          onClick={() => setMostrarAjuste(!mostrarAjuste)}
          className="h-7 rounded-full text-xs gap-1"
        >
          {mostrarAjuste ? 'Cancelar ajuste' : 'Ajustar puntos'}
        </Button>
      </div>

      {mostrarAjuste && (
        <form onSubmit={handleGuardarAjuste} className="mt-2 animate-in fade-in space-y-3 rounded-2xl border border-border/50 bg-muted/40 p-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTipoOperacion('sumar')}
              className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-bold transition-colors ${
                tipoOperacion === 'sumar' ? 'bg-emerald-600 text-white' : 'bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              <Plus className="h-3 w-3" /> Sumar puntos
            </button>
            <button
              type="button"
              onClick={() => setTipoOperacion('restar')}
              className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-bold transition-colors ${
                tipoOperacion === 'restar' ? 'bg-destructive text-white' : 'bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              <Minus className="h-3 w-3" /> Restar puntos
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px] font-semibold text-muted-foreground">Cantidad</Label>
              <Input
                type="number"
                min="1"
                placeholder="ej. 100"
                value={cantidadPuntos}
                onChange={(e) => setCantidadPuntos(e.target.value)}
                className="mt-1 h-9 rounded-xl text-sm font-semibold"
                required
              />
            </div>
            <div>
              <Label className="text-[11px] font-semibold text-muted-foreground">Motivo (opcional)</Label>
              <Input
                type="text"
                placeholder="ej. Cortesía del local"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="mt-1 h-9 rounded-xl text-sm"
              />
            </div>
          </div>

          <Button type="submit" disabled={guardandoAjuste || !cantidadPuntos} className="h-9 w-full rounded-xl text-xs font-bold">
            {guardandoAjuste ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirmar ajuste'}
          </Button>
        </form>
      )}

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto py-2 pr-1">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : transacciones.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <Sparkles className="h-5 w-5 text-muted-foreground/60" />
            <p className="text-xs text-muted-foreground">Sin movimientos registrados para este cliente.</p>
          </div>
        ) : (
          transacciones.map((t) => <FilaMovimientoPuntos key={t.id} movimiento={t} />)
        )}
      </div>
    </div>
  )
}
