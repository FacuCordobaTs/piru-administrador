import { useCallback, useEffect, useMemo, useState } from 'react'
import { Armchair, Banknote, ChefHat, CircleDot, Loader2, UtensilsCrossed } from 'lucide-react'
import { mesasLocalesApi, type MesaLocal } from '@/lib/api'
import { cn } from '@/lib/utils'

export type PedidoMesa = {
  id: number
  estado: string
  pagado?: boolean
  mesaLocalId?: number | null
  consumoEnLocal?: boolean | null
}

type EstadoMesa = 'libre' | 'ocupada' | 'preparando' | 'lista' | 'pendiente_cobro'

const ESTADO_MESA: Record<EstadoMesa, { label: string; className: string; Icon: typeof CircleDot }> = {
  libre: { label: 'Libre', className: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', Icon: CircleDot },
  ocupada: { label: 'Ocupada', className: 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-400', Icon: UtensilsCrossed },
  preparando: { label: 'Preparando', className: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400', Icon: ChefHat },
  lista: { label: 'Lista', className: 'border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-400', Icon: Armchair },
  pendiente_cobro: { label: 'Pendiente de cobro', className: 'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-400', Icon: Banknote },
}

function estadoDerivado(pedido: PedidoMesa | undefined): EstadoMesa {
  if (!pedido) return 'libre'
  if (pedido.estado === 'ready') return 'lista'
  if (pedido.estado === 'preparing') return 'preparando'
  if (!pedido.pagado) return 'pendiente_cobro'
  return 'ocupada'
}

export function MesasOperativas({
  token,
  sucursalId,
  pedidos,
  refreshKey,
  onMesaLibre,
  onMesaOcupada,
}: {
  token: string | null
  sucursalId: number | null
  pedidos: PedidoMesa[]
  refreshKey?: number
  onMesaLibre: (mesa: MesaLocal) => void
  onMesaOcupada: (pedido: PedidoMesa) => void
}) {
  const [mesas, setMesas] = useState<MesaLocal[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!token) { setMesas([]); setCargando(false); return }
    setCargando(true)
    try {
      const respuesta = await mesasLocalesApi.list(token, false)
      setMesas(respuesta.data)
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos cargar las mesas')
    } finally { setCargando(false) }
  }, [token])

  useEffect(() => { void cargar() }, [cargar, refreshKey])

  const mesasVisibles = useMemo(
    () => mesas.filter((mesa) => sucursalId == null || mesa.sucursalId == null || mesa.sucursalId === sucursalId),
    [mesas, sucursalId],
  )
  const pedidosPorMesa = useMemo(() => {
    const mapa = new Map<number, PedidoMesa>()
    for (const pedido of pedidos) {
      const sigueAbierto = !['archived', 'cancelled', 'delivered'].includes(pedido.estado)
      if (sigueAbierto && pedido.mesaLocalId != null && pedido.consumoEnLocal) mapa.set(pedido.mesaLocalId, pedido)
    }
    return mapa
  }, [pedidos])

  if (cargando) return <section className="rounded-2xl border bg-card p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando mesas…</div></section>
  if (error) return <section className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-sm"><p>{error}</p><button type="button" onClick={() => void cargar()} className="mt-2 font-medium underline">Reintentar</button></section>
  if (mesasVisibles.length === 0) return <section className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">No hay mesas configuradas para esta sucursal. Configuralas desde el módulo Mesas.</section>

  return <section aria-label="Mesas operativas" className="rounded-2xl border bg-card p-3 shadow-sm">
    <div className="mb-3 flex items-center justify-between gap-3 px-1"><div><h2 className="font-semibold">Mesas</h2><p className="text-xs text-muted-foreground">Tocá una mesa para abrir su pedido.</p></div><span className="text-xs text-muted-foreground">{mesasVisibles.length} activas</span></div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
      {mesasVisibles.map((mesa) => {
        const pedido = pedidosPorMesa.get(mesa.id)
        const estado = estadoDerivado(pedido)
        const meta = ESTADO_MESA[estado]
        const Icon = meta.Icon
        return <button key={mesa.id} type="button" onClick={() => pedido ? onMesaOcupada(pedido) : onMesaLibre(mesa)} className={cn('min-h-24 rounded-xl border p-3 text-left transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', meta.className)}>
          <div className="flex items-start justify-between gap-2"><span className="font-semibold leading-tight">{mesa.nombre}</span><Icon className="h-4 w-4 shrink-0" /></div>
          <span className="mt-4 block text-xs font-medium">{meta.label}</span>
          <span className="mt-1 block text-[11px] opacity-75">{mesa.capacidad} personas{pedido ? ` · #${pedido.id}` : ''}</span>
        </button>
      })}
    </div>
  </section>
}
