import { useState } from 'react'
import { Loader2, Printer, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PedidoPosPendiente } from '@/lib/posOffline'
import { formatoPesos } from './posMovilLib'

interface PosPendientesProps {
    pendientes: PedidoPosPendiente[]
    sincronizando: boolean
    onCerrar: () => void
    onReintentar: (pendiente: PedidoPosPendiente) => void
    onImprimir: (pendiente: PedidoPosPendiente) => void
    onEliminar: (pendiente: PedidoPosPendiente) => void
}

const ETIQUETA_TIPO = { delivery: 'Delivery', mesa: 'Mesa', takeaway: 'Takeaway' } as const

/** Pedidos anotados sin conexión que todavía no llegaron al servidor. */
export function PosPendientes({ pendientes, sincronizando, onCerrar, onReintentar, onImprimir, onEliminar }: PosPendientesProps) {
    // El panel se abre a demanda: alcanza con medir la antigüedad al abrirlo.
    const [ahora] = useState(() => Date.now())
    return (
        <div
            role="region"
            aria-label="Pedidos sin conexión"
            className="max-h-[65vh] w-full space-y-2 overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card p-2.5 shadow-2xl sm:w-[380px]"
        >
            <div className="flex items-center justify-between px-1.5 pt-1">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Pedidos sin conexión</p>
                <button
                    type="button"
                    aria-label="Cerrar pedidos sin conexión"
                    onClick={onCerrar}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
            {pendientes.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground/60">No hay pedidos sin conexión.</p>
            ) : (
                pendientes.map((pendiente) => {
                    const hora = new Date(pendiente.creadoEn).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                    const pendienteDeEnvio = pendiente.estado === 'pendiente'
                    return (
                        <div key={pendiente.localId} className="rounded-xl border border-border p-3">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-bold">#LOCAL-{pendiente.localNumero}</span>
                                <span className={cn(
                                    'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                                    pendienteDeEnvio ? 'bg-amber-500/10 text-amber-600' : 'bg-red-500/10 text-red-600',
                                )}>
                                    {pendienteDeEnvio ? 'Pendiente' : pendiente.estado === 'sincronizando' ? 'Confirmando' : 'Revisar'}
                                </span>
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                {hora} · {ETIQUETA_TIPO[pendiente.tipo] ?? 'Takeaway'} · {formatoPesos(pendiente.draft.total)}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {pendiente.draft.items.map((item) => `${item.cantidad}x ${item.nombre}`).join(', ')}
                            </p>
                            {(pendiente.impresion === 'revisar' || pendiente.impresion === 'iniciada') && (
                                <p className="mt-1 text-xs text-amber-600">Verificá si la comanda salió antes de reimprimir.</p>
                            )}
                            {ahora - Date.parse(pendiente.creadoEn) > 3_600_000 && (
                                <p className="mt-1 text-xs text-amber-600">Este pedido lleva más de una hora sin confirmar.</p>
                            )}
                            {pendiente.estado === 'error_bloqueante' && pendiente.errorMessage && (
                                <p className="mt-1 text-[11px] text-red-600">{pendiente.errorMessage}</p>
                            )}
                            <div className="mt-2.5 flex items-center gap-1.5">
                                {pendiente.estado === 'error_bloqueante' && (
                                    <button
                                        type="button"
                                        onClick={() => onReintentar(pendiente)}
                                        className="h-10 rounded-lg bg-muted px-3 text-xs font-semibold"
                                    >
                                        Reintentar
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => onImprimir(pendiente)}
                                    className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-muted text-xs font-semibold transition-colors hover:bg-accent"
                                >
                                    <Printer className="h-3.5 w-3.5" /> Imprimir
                                </button>
                                <button
                                    type="button"
                                    title="Eliminar pedido sin conexión"
                                    aria-label={`Eliminar #LOCAL-${pendiente.localNumero}`}
                                    onClick={() => onEliminar(pendiente)}
                                    className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    )
                })
            )}
            {sincronizando && (
                <p className="flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sincronizando…
                </p>
            )}
        </div>
    )
}
