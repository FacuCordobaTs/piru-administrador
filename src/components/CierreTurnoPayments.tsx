// src/components/CierreTurnoPayments.tsx
import { Card, CardContent } from '@/components/ui/card'
import { DollarSign, Smartphone, Landmark, CheckCircle } from 'lucide-react'

interface Payments {
    efectivo: number
    mercadopago: number
    transferencia: number
}

interface CierreTurnoPaymentsProps {
    pagos: Payments
    totalVendido: number // por si lo calculás aparte
    pedidosPagados: number
    pedidosTotales: number
}

/**
 * CierreTurnoPayments
 *
 * - Barra apilada que muestra proporción de cada método.
 * - Leyenda compacta con icono y monto.
 * - Anillo de progreso con "Órdenes pagadas n/m" y porcentaje.
 * - Diseño minimalista, legible incluso en small screens.
 */
export default function CierreTurnoPayments({
    pagos,
    totalVendido,
    pedidosPagados,
    pedidosTotales
}: CierreTurnoPaymentsProps) {

    const { efectivo, mercadopago, transferencia } = pagos
    const total = Math.max(0, totalVendido || efectivo + mercadopago + transferencia)

    const pct = (v: number) => total > 0 ? (v / total) * 100 : 0

    const formatMoney = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`

    const paidPercent = pedidosTotales > 0 ? Math.round((pedidosPagados / pedidosTotales) * 100) : 0

    // progress ring params
    const radius = 18
    const stroke = 4
    const normalizedRadius = radius - stroke * 0.5
    const circumference = normalizedRadius * 2 * Math.PI
    const strokeDashoffset = circumference - (paidPercent / 100) * circumference

    return (
        <Card className="rounded-xl border shadow-sm">
            <CardContent className="p-3">
                <div className="flex items-center justify-between gap-3">
                    {/* Left: stacked bar + legend */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wide">Desglose de pagos</div>
                                <div className="text-lg font-semibold text-primary mt-1">{formatMoney(total)}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                    {pedidosTotales} pedido{pedidosTotales !== 1 ? 's' : ''} · {pedidosPagados} pagado{pedidosPagados !== 1 ? 's' : ''}
                                </div>
                            </div>
                            <div className="hidden sm:block text-right text-xs text-muted-foreground">
                                <div className="mb-1">Métodos</div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />
                                        <span className="min-w-[90px] truncate">Efectivo</span>
                                        <div className="ml-2 font-medium">{formatMoney(efectivo)}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-sm bg-sky-500 inline-block" />
                                        <span className="min-w-[90px] truncate">Mercado Pago</span>
                                        <div className="ml-2 font-medium">{formatMoney(mercadopago)}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" />
                                        <span className="min-w-[90px] truncate">Transferencia</span>
                                        <div className="ml-2 font-medium">{formatMoney(transferencia)}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Stacked bar (mobile + desktop) */}
                        <div className="mt-3">
                            <div className="h-3 w-full rounded-full bg-muted/20 overflow-hidden">
                                {/* Each segment: ensure a minimum visible width if >0 */}
                                <div
                                    role="progressbar"
                                    aria-label={`Efectivo ${Math.round(pct(efectivo))}%`}
                                    title={`Efectivo ${formatMoney(efectivo)} (${Math.round(pct(efectivo))}%)`}
                                    style={{ width: `${Math.max(efectivo > 0 ? pct(efectivo) : 0, efectivo > 0 && total === 0 ? 33 : (efectivo === 0 ? 0 : Math.max(3, pct(efectivo))))}%` }}
                                    className="h-full inline-block align-top bg-emerald-500 transition-all"
                                />
                                <div
                                    role="progressbar"
                                    aria-label={`Mercado Pago ${Math.round(pct(mercadopago))}%`}
                                    title={`Mercado Pago ${formatMoney(mercadopago)} (${Math.round(pct(mercadopago))}%)`}
                                    style={{ width: `${Math.max(mercadopago > 0 ? pct(mercadopago) : 0, mercadopago > 0 && total === 0 ? 33 : (mercadopago === 0 ? 0 : Math.max(3, pct(mercadopago))))}%` }}
                                    className="h-full inline-block align-top bg-sky-500 transition-all"
                                />
                                <div
                                    role="progressbar"
                                    aria-label={`Transferencia ${Math.round(pct(transferencia))}%`}
                                    title={`Transferencia ${formatMoney(transferencia)} (${Math.round(pct(transferencia))}%)`}
                                    style={{ width: `${Math.max(transferencia > 0 ? pct(transferencia) : 0, transferencia > 0 && total === 0 ? 33 : (transferencia === 0 ? 0 : Math.max(3, pct(transferencia))))}%` }}
                                    className="h-full inline-block align-top bg-amber-400 transition-all"
                                />
                            </div>

                            {/* Compact legend for mobile */}
                            <div className="mt-2 grid grid-cols-3 gap-2 sm:hidden text-xs">
                                <div className="flex items-center gap-2 justify-center">
                                    <DollarSign className="h-4 w-4 text-emerald-500" />
                                    <div className="text-center">
                                        <div className="text-[11px] text-muted-foreground">Efectivo</div>
                                        <div className="font-medium text-sm">{formatMoney(efectivo)}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 justify-center">
                                    <Smartphone className="h-4 w-4 text-sky-500" />
                                    <div className="text-center">
                                        <div className="text-[11px] text-muted-foreground">MP</div>
                                        <div className="font-medium text-sm">{formatMoney(mercadopago)}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 justify-center">
                                    <Landmark className="h-4 w-4 text-amber-400" />
                                    <div className="text-center">
                                        <div className="text-[11px] text-muted-foreground">Transfer.</div>
                                        <div className="font-medium text-sm">{formatMoney(transferencia)}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: progress ring (orders paid) */}
                    <div className="flex items-center gap-3">
                        <div className="relative w-16 h-16">
                            <svg height={radius * 2} width={radius * 2} className="block">
                                <circle
                                    stroke="rgba(0,0,0,0.06)"
                                    fill="transparent"
                                    strokeWidth={stroke}
                                    r={normalizedRadius}
                                    cx={radius}
                                    cy={radius}
                                />
                                <circle
                                    stroke="currentColor"
                                    fill="transparent"
                                    strokeWidth={stroke}
                                    strokeLinecap="round"
                                    r={normalizedRadius}
                                    cx={radius}
                                    cy={radius}
                                    strokeDasharray={`${circumference} ${circumference}`}
                                    style={{
                                        strokeDashoffset,
                                        transform: 'rotate(-90deg)',
                                        transformOrigin: '50% 50%',
                                        color: pedidosPagados === pedidosTotales && pedidosTotales > 0 ? '#10b981' : '#2563eb' // green if all paid else primary-ish
                                    }}
                                />
                            </svg>

                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <div className="text-sm font-semibold">{paidPercent}%</div>
                                <div className="text-[11px] text-muted-foreground">pagado</div>
                            </div>
                        </div>

                        <div className="hidden sm:flex flex-col text-sm">
                            <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-muted-foreground" />
                                <div className="leading-tight">
                                    <div className="text-xs text-muted-foreground">Órdenes pagadas</div>
                                    <div className="font-medium">{pedidosPagados} de {pedidosTotales}</div>
                                </div>
                            </div>

                            <div className="mt-2 text-xs text-muted-foreground max-w-[140px]">
                                <div>Haz click en una orden para ver métodos y detalles</div>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
