import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CheckCircle, Loader2, QrCode, RefreshCw, TriangleAlert, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useCobroQr } from '@/hooks/useCobroQr'
import {
    ESPERA_CIERRE_COBRO_PAGADO_MS,
    formatoCuentaRegresiva,
    formatoMonto,
    segundosRestantes,
} from '@/lib/posCobro'

const BOTON_PRIMARIO = 'h-12 rounded-xl bg-[#FF7A00] text-base font-bold text-white hover:bg-[#E66E00]'

function Total({ total }: { total: number }) {
    return (
        <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Total a cobrar</p>
            <p data-testid="cobro-total" className="mt-1 text-5xl font-black tabular-nums tracking-tight text-[#FF7A00]">{formatoMonto(total)}</p>
        </div>
    )
}

function Pie({ children }: { children: ReactNode }) {
    return <div className="grid gap-2 sm:grid-cols-2 [&>*:only-child]:sm:col-span-2">{children}</div>
}

interface PropsCobroManual {
    total: number
    metodoLabel: string
    tipoLabel: string
    /** El cajero confirma que recibió el pago: el pedido se anota ya cobrado. */
    onCobrado: () => void
    onVolver: () => void
}

/** Efectivo, tarjeta y transferencia: no hay cómo verificarlos solos, así que se confirman a mano. */
export function PosCobroManualDialog({ total, metodoLabel, tipoLabel, onCobrado, onVolver }: PropsCobroManual) {
    return (
        <Dialog open onOpenChange={(abierto) => { if (!abierto) onVolver() }}>
            <DialogContent className="sm:max-w-sm" aria-describedby="cobro-manual-descripcion">
                <DialogHeader>
                    <DialogTitle>Confirmar cobro</DialogTitle>
                    <DialogDescription id="cobro-manual-descripcion">{tipoLabel} · {metodoLabel}</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-1">
                    <Total total={total} />
                    <p className="text-center text-sm text-muted-foreground">
                        Confirmá cuando hayas recibido el pago. El pedido se anota y la comanda se imprime recién ahí.
                    </p>
                </div>
                <Pie>
                    <Button type="button" variant="outline" className="h-12 rounded-xl" onClick={onVolver}>Volver</Button>
                    <Button type="button" autoFocus className={BOTON_PRIMARIO} onClick={onCobrado}>
                        <CheckCircle className="mr-2 h-5 w-5" /> Cobrado
                    </Button>
                </Pie>
            </DialogContent>
        </Dialog>
    )
}

interface PropsCobroQr {
    total: number
    tipoLabel: string
    token: string
    online: boolean
    cajaElegidaId: number | null
    /** Anota el pedido impago (o devuelve el ya anotado). `null` si no se pudo. */
    crearPedido: () => Promise<number | null>
    /** Pedido ya anotado si se retoma un cobro tras una recarga. */
    pedidoIdInicial: number | null
    /** Mercado Pago confirmó el pago: cerrar el alta (limpiar el borrador, imprimir). */
    onPagado: (pedidoId: number) => void | Promise<void>
    onCajaElegida: (cajaId: number) => void
    onConfigurarCajas: () => void
    onCerrar: () => void
}

/**
 * Cobro con el QR estático de Mercado Pago. El pago lo confirma el servidor contra Mercado Pago
 * (esta pantalla sólo consulta), por eso no hay un "ya pagó" manual: si algo falla se cancela
 * y se elige otro método.
 */
export function PosCobroQrDialog({
    total: totalInicial, tipoLabel, token, online, cajaElegidaId, crearPedido, pedidoIdInicial, onPagado, onCajaElegida, onConfigurarCajas, onCerrar,
}: PropsCobroQr) {
    // El total se congela al abrir: cuando el pago se confirma el POS limpia su borrador y el total en
    // vivo pasaría a $0 mientras todavía se muestra "¡Pago recibido!".
    const [total] = useState(totalInicial)
    const { estado, sinRed, cancelando, errorAlCancelar, reintentar, elegirCaja, verificarAhora, cancelar } = useCobroQr({
        token, online, cajaElegidaId, crearPedido, pedidoIdInicial, onPagado, onCajaElegida,
    })
    // Siempre la última función del padre, sin reiniciar el temporizador de cierre en cada render.
    const cerrar = useRef(onCerrar)
    useEffect(() => { cerrar.current = onCerrar })

    const [ahora, setAhora] = useState(() => Date.now())
    const esperando = estado.fase === 'esperando'
    useEffect(() => {
        if (!esperando) return
        const intervalo = window.setInterval(() => setAhora(Date.now()), 1000)
        return () => window.clearInterval(intervalo)
    }, [esperando])

    useEffect(() => {
        if (estado.fase !== 'pagado') return
        const timer = window.setTimeout(() => cerrar.current(), ESPERA_CIERRE_COBRO_PAGADO_MS)
        return () => window.clearTimeout(timer)
    }, [estado.fase])

    const cancelarYCerrar = async () => {
        if ((await cancelar()) === 'cancelado') cerrar.current()
    }

    const cobro = estado.fase === 'esperando' || estado.fase === 'pagado' ? estado.cobro : null
    const restantes = estado.fase === 'esperando' ? segundosRestantes(estado.cobro.expiraAt, ahora) : null

    return (
        <Dialog open onOpenChange={() => undefined}>
            <DialogContent
                className="sm:max-w-sm"
                showCloseButton={false}
                // Mientras hay un cobro en curso sólo se sale con los botones: un toque afuera no debe soltarlo.
                onInteractOutside={(evento) => evento.preventDefault()}
                onEscapeKeyDown={(evento) => evento.preventDefault()}
                aria-describedby="cobro-qr-descripcion"
            >
                <DialogHeader>
                    <DialogTitle>Cobrar con Mercado Pago</DialogTitle>
                    <DialogDescription id="cobro-qr-descripcion">{tipoLabel} · QR estático</DialogDescription>
                </DialogHeader>

                {estado.fase === 'preparando' && (
                    <div role="status" className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin text-[#FF7A00]" />
                        <p className="text-sm font-medium">Preparando el cobro…</p>
                    </div>
                )}

                {estado.fase === 'sin_caja' && (
                    <div className="space-y-4">
                        <div className="flex flex-col items-center gap-2 text-center">
                            <QrCode className="h-9 w-9 text-muted-foreground" />
                            {estado.motivo === 'sin_cajas' ? (
                                <>
                                    <p className="text-sm font-semibold">Todavía no hay una caja de Mercado Pago vinculada</p>
                                    <p className="text-xs text-muted-foreground">Vinculá o creá una en «Configurar punto de venta» y volvé a cobrar.</p>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm font-semibold">¿Con qué caja cobrás en este dispositivo?</p>
                                    <p className="text-xs text-muted-foreground">Se recuerda para los próximos cobros.</p>
                                </>
                            )}
                        </div>
                        {estado.motivo === 'elegir' && (
                            <ul className="space-y-2">
                                {estado.cajas.map((caja) => (
                                    <li key={caja.id}>
                                        <Button type="button" variant="outline" className="h-12 w-full justify-start rounded-xl" onClick={() => elegirCaja(caja.id)}>
                                            <QrCode className="mr-2 h-4 w-4" /> {caja.nombre}
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <Pie>
                            <Button type="button" variant="outline" className="h-12 rounded-xl" onClick={cancelarYCerrar}>Volver</Button>
                            {estado.motivo === 'sin_cajas' && (
                                <Button type="button" className={BOTON_PRIMARIO} onClick={onConfigurarCajas}>Configurar QR</Button>
                            )}
                        </Pie>
                    </div>
                )}

                {estado.fase === 'esperando' && cobro && (
                    <div className="space-y-4">
                        <Total total={total} />
                        <div className="mx-auto flex h-56 w-56 items-center justify-center rounded-2xl border border-border bg-white p-3">
                            {cobro.qrUrl
                                ? <img src={cobro.qrUrl} alt={`QR de la caja ${cobro.cajaNombre ?? ''}`.trim()} className="h-full w-full object-contain" />
                                : <QrCode className="h-16 w-16 text-muted-foreground/50" />}
                        </div>
                        <p className="text-center text-sm text-muted-foreground">
                            Pedile al cliente que escanee el QR{cobro.cajaNombre ? <> de la caja <strong className="text-foreground">{cobro.cajaNombre}</strong></> : null} con la app de Mercado Pago.
                        </p>
                        <div role="status" className="flex items-center justify-center gap-2 text-sm font-medium text-foreground">
                            <Loader2 className="h-4 w-4 animate-spin text-[#FF7A00]" />
                            <span>Esperando el pago…</span>
                            {restantes != null && (
                                <span className="tabular-nums text-muted-foreground">
                                    · {restantes > 0 ? `vence en ${formatoCuentaRegresiva(restantes)}` : 'confirmando el vencimiento'}
                                </span>
                            )}
                        </div>
                        {sinRed && (
                            <p role="alert" className="flex items-center justify-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                                <WifiOff className="h-3.5 w-3.5" /> Sin conexión: seguimos intentando. Si el cliente ya pagó, se confirma solo al volver la red.
                            </p>
                        )}
                        {errorAlCancelar && <p role="alert" className="text-center text-xs font-medium text-destructive">{errorAlCancelar}</p>}
                        <Pie>
                            <Button type="button" variant="outline" className="h-12 rounded-xl" onClick={() => void verificarAhora()} disabled={cancelando}>
                                <RefreshCw className="mr-2 h-4 w-4" /> Verificar ahora
                            </Button>
                            <Button type="button" variant="outline" className="h-12 rounded-xl text-destructive hover:text-destructive" onClick={cancelarYCerrar} disabled={cancelando}>
                                {cancelando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Cancelar cobro
                            </Button>
                        </Pie>
                    </div>
                )}

                {estado.fase === 'pagado' && (
                    <div role="status" className="flex flex-col items-center gap-2 py-6 text-center">
                        <CheckCircle className="h-14 w-14 text-emerald-500" />
                        <p className="text-xl font-black">¡Pago recibido!</p>
                        <p className="text-sm text-muted-foreground">{formatoMonto(cobro?.monto ?? total)} · Mercado Pago</p>
                    </div>
                )}

                {estado.fase === 'fallido' && (
                    <div className="space-y-4">
                        <div className="flex flex-col items-center gap-2 text-center">
                            <TriangleAlert className="h-9 w-9 text-amber-500" />
                            <p role="alert" className="text-sm font-semibold">{estado.mensaje}</p>
                        </div>
                        {errorAlCancelar && <p role="alert" className="text-center text-xs font-medium text-destructive">{errorAlCancelar}</p>}
                        <Pie>
                            <Button type="button" variant="outline" className="h-12 rounded-xl" onClick={cancelarYCerrar} disabled={cancelando}>
                                {cancelando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} {estado.reintentable ? 'Cancelar' : 'Cerrar'}
                            </Button>
                            {estado.reintentable && (
                                <Button type="button" className={BOTON_PRIMARIO} onClick={reintentar} disabled={cancelando}>Reintentar</Button>
                            )}
                        </Pie>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
