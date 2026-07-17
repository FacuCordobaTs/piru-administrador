import { useState, useEffect, useCallback, useRef, Fragment, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { deliveryApi, takeawayApi, pedidoUnificadoApi, restauranteApi, sucursalesApi, repartidoresApi } from '@/lib/api'
import { SucursalSelector, type SucursalListRow } from '@/components/SucursalSelector'
import { useAdminContext } from '@/context/AdminContext'
import CierreTurno from '@/components/CierreTurno'
import PuntoDeVenta from '@/components/PuntoDeVenta'
import {
    Loader2, Plus, Clock, Trash2,
    User, ArrowLeft, Printer, Truck, MapPin,
    Phone, ShoppingBag, CalendarDays, Tag, Settings, CheckCircle2,
    Receipt, Wallet, Zap, CreditCard, ChevronDown, CheckCircle,
    MessageCircle, Store, Map as MapIcon, X, UserRound, UserCheck, UserX, List, ShoppingCart,
    Copy, ExternalLink,
} from 'lucide-react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { usePrinter } from '@/context/PrinterContext'
import { formatComanda, commandsToBytes } from '@/utils/printerUtils'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────
interface DeliveryItem {
    id: number; productoId: number; cantidad: number; precioUnitario: string;
    nombreProducto: string; imagenUrl: string | null;
    ingredientesExcluidos: number[]; ingredientesExcluidosNombres?: string[];
    agregados?: any; varianteNombre?: string; clienteNombre?: string | null;
}
interface UnifiedPedido {
    id: number; tipo: 'delivery' | 'takeaway'; estado: string; total: string; createdAt: string;
    nombreCliente: string | null; telefono: string | null; direccion?: string | null; notas?: string | null;
    items: DeliveryItem[]; totalItems: number; pagado?: boolean; metodoPago?: string | null;
    montoDescuento?: string | number | null; codigoDescuentoCodigo?: string | null; impreso?: boolean;
    sucursalId?: number | null; sucursalNombre?: string | null;
    demoraMinutos?: number | null; notificarWhatsapp?: boolean | null;
    horarioProgramado?: string | null; latitud?: string | null; longitud?: string | null;
    deliveryFee?: string | null; repartidorId?: number | null; repartidorNombre?: string | null;
    grupal?: boolean | null; creadoPorIa?: boolean | null; anotadoManualmente?: boolean | null;
}
interface Repartidor { id: number; nombre: string; estado: 'activo' | 'inactivo'; restauranteId: number }
interface ClienteContexto {
    identificado: boolean; matchedBy: 'telefono' | 'nombre'; nombre: string | null;
    totalPedidos: number; pedidoNumero: number; totalHistorico: number;
    ultimaVezAt: string | null; primeraVez: boolean;
    nivel: 'nuevo' | 'recurrente' | 'frecuente';
}

const STORAGE_SUCURSAL = 'sucursal_activa_id'

function readStoredSucursalId(): number | null {
    try {
        const saved = localStorage.getItem(STORAGE_SUCURSAL)
        if (saved == null || saved === '' || saved === 'all') return null
        const n = parseInt(saved, 10)
        return Number.isNaN(n) ? null : n
    } catch {
        return null
    }
}

// ─────────────────────────────────────────────
// UTILIDADES FECHAS Y FORMATOS
// ─────────────────────────────────────────────
const AR_TIMEZONE = 'America/Argentina/Buenos_Aires'
const AR_OFFSET_SUFFIX = '-03:00'
const PEDIDO_RELATIVE_TIME_OFFSET_MS = 3 * 60 * 60 * 1000

function parseDashboardDate(value: string | undefined | null): Date {
    if (value == null || String(value).trim() === '') return new Date(NaN)
    const s = String(value).trim()
    if (/^\d+$/.test(s)) {
        const n = Number(s)
        return new Date(n > 1e12 ? n : n * 1000)
    }
    if (/[zZ]$/.test(s) || /[+-]\d{2}:\d{2}$/.test(s) || /[+-]\d{2}\d{2}$/.test(s)) return new Date(s)
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?/)
    if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${m[7] || ''}${AR_OFFSET_SUFFIX}`)
    return new Date(s)
}

// El backend envía timestamps con el horario local AR pero etiquetados como UTC (Z),
// por lo que parseDashboardDate devuelve un instante 3h atrasado respecto al real.
// getPedidoInstant() aplica la corrección para obtener el instante correcto.
const getPedidoInstant = (dateString: string): Date =>
    new Date(parseDashboardDate(dateString).getTime() + PEDIDO_RELATIVE_TIME_OFFSET_MS)

const getMinutesAgo = (dateString: string) => {
    const t = getPedidoInstant(dateString).getTime()
    if (Number.isNaN(t)) return 0
    return Math.floor((Date.now() - t) / 60000)
}

const formatTimeAgo = (dateString: string) => {
    const minutes = getMinutesAgo(dateString)
    if (minutes < 1) return 'Ahora'
    if (minutes < 60) return `hace ${minutes} min`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `hace ${hours}h ${minutes % 60}m`
    return getPedidoInstant(dateString).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: AR_TIMEZONE })
}

const formatPedidoTime = (dateString: string) =>
    getPedidoInstant(dateString).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: AR_TIMEZONE })

const getDateLabel = (dateString: string) => {
    const eventDate = getPedidoInstant(dateString)
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    // Comparar por día en el huso horario AR
    const arDay = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: AR_TIMEZONE })
    const isSameDay = (d1: Date, d2: Date) => arDay(d1) === arDay(d2)

    if (isSameDay(eventDate, today)) return 'Hoy'
    if (isSameDay(eventDate, yesterday)) return 'Ayer'
    return eventDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', timeZone: AR_TIMEZONE })
}

// ── Contexto del cliente ──
const ordinalEs = (n: number): string => {
    const map: Record<number, string> = {
        1: '1er', 2: '2do', 3: '3er', 4: '4to', 5: '5to',
        6: '6to', 7: '7mo', 8: '8vo', 9: '9no', 10: '10mo',
    }
    return map[n] || `${n}º`
}

const primerNombre = (nombre?: string | null): string | null => {
    const n = (nombre || '').trim().split(/\s+/)[0]
    return n || null
}

const formatUltimaVez = (iso: string): string => {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
    if (days <= 0) return 'hoy'
    if (days === 1) return 'ayer'
    if (days < 7) return `hace ${days} días`
    if (days < 30) { const w = Math.floor(days / 7); return `hace ${w} ${w === 1 ? 'semana' : 'semanas'}` }
    if (days < 365) { const m = Math.floor(days / 30); return `hace ${m} ${m === 1 ? 'mes' : 'meses'}` }
    const y = Math.floor(days / 365); return `hace ${y} ${y === 1 ? 'año' : 'años'}`
}

const formatAgregados = (agregadosData: any): any[] => {
    if (!agregadosData) return []
    if (Array.isArray(agregadosData)) return agregadosData
    if (typeof agregadosData === 'string') {
        try {
            const parsed = JSON.parse(agregadosData)
            return Array.isArray(parsed) ? parsed : []
        } catch { return [] }
    }
    return []
}

const getOrderDeliveryFee = (pedido: { total: string; items: any[]; montoDescuento?: string | number | null; deliveryFee?: string | null }) => {
    if (pedido.deliveryFee != null) {
        const stored = parseFloat(String(pedido.deliveryFee))
        if (!isNaN(stored)) return stored
    }
    const total = parseFloat(pedido.total)
    const montoDescuento = parseFloat(String(pedido.montoDescuento ?? 0)) || 0
    const itemsSubtotal = pedido.items.reduce((sum, item) => {
        return sum + (parseFloat(item.precioUnitario || '0') * item.cantidad)
    }, 0)
    return Math.max(0, Math.round((total + montoDescuento - itemsSubtotal) * 100) / 100)
}

const computeOrderTotal = (pedido: { total: string; tipo: string; items: any[]; montoDescuento?: string | number | null }) => {
    const montoDescuento = parseFloat(String(pedido.montoDescuento ?? 0)) || 0
    const itemsSubtotal = pedido.items.reduce((sum, item) => {
        return sum + (parseFloat(item.precioUnitario || '0') * item.cantidad)
    }, 0)
    const deliveryFee = pedido.tipo === 'delivery' ? getOrderDeliveryFee(pedido) : 0
    return itemsSubtotal + deliveryFee - montoDescuento
}

const deferComandaHastaPagado = (metodoPago: string | null | undefined, cucuruConfigurado: boolean | null | undefined): boolean => {
    const m = String(metodoPago || '').trim()
    if (['transferencia_automatica_cucuru', 'transferencia_automatica_talo', 'mercadopago', 'mercadopago_checkout', 'mercadopago_bricks'].includes(m)) return true
    if (cucuruConfigurado && (m === 'transferencia' || m === '')) return true
    return false
}

const metodoPagoListBadge = (metodoPago: string | null | undefined) => {
    const m = String(metodoPago || '').trim()
    if (m.includes('mercadopago')) return { label: 'MP', className: 'bg-[#009EE3]/10 text-[#009EE3] border-[#009EE3]/20', icon: '💳' }
    if (m.includes('transferencia_automatica_talo')) return { label: 'Talo', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/20', icon: '🏦' }
    if (m.includes('transferencia_automatica_cucuru')) return { label: 'Cucuru', className: 'bg-purple-500/10 text-purple-600 dark:text-purple-500 border-purple-500/20', icon: '🏦' }
    if (m.includes('manual_transfer') || m === 'transferencia') return { label: 'Transf. Manual', className: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20', icon: '🏦' }
    if (m === 'cash' || m === 'efectivo') return { label: 'Efectivo', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border-emerald-500/20', icon: '💵' }
    return null
}

/** Cliente ya eligió efectivo o transferencia manual en el checkout: el panel solo confirma el cobro, no el método. */
const pedidoCobroManualYaElegido = (metodoPago: string | null | undefined): boolean => {
    const m = String(metodoPago || '').trim()
    if (m === 'cash' || m === 'efectivo') return true
    if (m.includes('manual_transfer') || m === 'transferencia') return true
    return false
}

const resolveMetodoMarcarPagado = (
    metodoPago: string | null | undefined,
    override?: 'efectivo' | 'transferencia'
): 'cash' | 'manual_transfer' => {
    if (override) {
        return override === 'efectivo' ? 'cash' : 'manual_transfer'
    }
    const m = String(metodoPago || '').trim()
    if (m === 'cash' || m === 'efectivo') return 'cash'
    if (m.includes('manual_transfer') || m === 'transferencia') return 'manual_transfer'
    return 'manual_transfer'
}

const pedidoTieneCuponDescuento = (p: { montoDescuento?: string | number | null }) =>
    p.montoDescuento != null && parseFloat(String(p.montoDescuento)) > 0

// ─────────────────────────────────────────────
// MAPA DE PEDIDOS
// ─────────────────────────────────────────────
function MapBoundsController({ positions }: { positions: [number, number][] }) {
    const map = useMap()
    useEffect(() => {
        if (positions.length > 1) {
            map.fitBounds(positions as any, { padding: [60, 60] })
        } else if (positions.length === 1) {
            map.setView(positions[0], 15)
        }
    }, [])
    return null
}

function MapFlyTo({ coords }: { coords: { lat: number; lng: number; id: number } | null }) {
    const map = useMap()
    const mounted = useRef(false)
    useEffect(() => {
        if (!mounted.current) { mounted.current = true; return }
        if (!coords) return
        map.flyTo([coords.lat, coords.lng], Math.max(map.getZoom(), 15), { duration: 0.8 })
    }, [coords?.id])
    return null
}

const parseCoord = (v: string | null | undefined) => parseFloat(String(v || '').replace(',', '.'))

const OrderMapView = ({ orders, onClose, externalSelected, onSelectPedido, onAprobarPago, onNotificar, onDespachar, updatingPago, sendingNotification, asignandoRepartidor }: {
    orders: UnifiedPedido[]
    onClose: () => void
    externalSelected?: UnifiedPedido | null
    onSelectPedido?: (pedido: UnifiedPedido | null) => void
    onAprobarPago?: (pedido: UnifiedPedido, metodo?: 'efectivo' | 'transferencia') => void
    onNotificar?: (pedido: UnifiedPedido) => void
    onDespachar?: (pedido: UnifiedPedido) => void
    updatingPago?: string | null
    sendingNotification?: string | null
    asignandoRepartidor?: boolean
    onShowOrdersList?: () => void
}) => {
    const [selected, setSelected] = useState<UnifiedPedido | null>(null)

    const ordersWithCoords = orders.filter(p => {
        if (p.tipo !== 'delivery' || !p.latitud || !p.longitud) return false
        const lat = parseCoord(p.latitud)
        const lng = parseCoord(p.longitud)
        return !isNaN(lat) && !isNaN(lng) && !(lat === 0 && lng === 0)
    })

    const flyCoords = useMemo(() => {
        if (!externalSelected?.latitud || !externalSelected?.longitud) return null
        const lat = parseCoord(externalSelected.latitud)
        const lng = parseCoord(externalSelected.longitud)
        if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return null
        return { lat, lng, id: externalSelected.id }
    }, [externalSelected?.id])

    useEffect(() => {
        if (!externalSelected) return
        const inMap = ordersWithCoords.find(p => p.id === externalSelected.id)
        if (inMap) setSelected(inMap)
    }, [externalSelected?.id])

    // Clear selection when order is no longer in map (e.g. after archiving)
    useEffect(() => {
        if (selected && !ordersWithCoords.find(p => p.id === selected.id && p.tipo === selected.tipo)) {
            setSelected(null)
        }
    }, [orders])

    const handleMarkerClick = (pedido: UnifiedPedido) => {
        const next = selected?.id === pedido.id ? null : pedido
        setSelected(next)
        onSelectPedido?.(next)
    }

    const handleCloseSelected = () => {
        setSelected(null)
        onSelectPedido?.(null)
    }

    const handleMapDespachar = () => {
        if (!selected) return
        // Delega al flujo del padre, que abre el Dialog portaleado de selección
        // de repartidor (con z-index correcto por encima del mapa) cuando corresponde.
        onDespachar?.(selected)
    }

    const positions = ordersWithCoords.map(p => [parseCoord(p.latitud), parseCoord(p.longitud)] as [number, number])

    const center: [number, number] = positions.length > 0
        ? [positions.reduce((s, [lat]) => s + lat, 0) / positions.length, positions.reduce((s, [, lng]) => s + lng, 0) / positions.length]
        : [-34.6037, -58.3816]

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
            <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-border bg-background">
                <div className="flex items-center gap-2">
                    <MapIcon className="h-4 w-4 text-[#FF7A00]" />
                    <span className="font-bold text-sm">Mapa de pedidos</span>
                    {ordersWithCoords.length > 0 && (
                        <Badge className="bg-[#FF7A00] hover:bg-[#FF7A00] text-white rounded-full px-2 py-0 text-[10px]">
                            {ordersWithCoords.length}
                        </Badge>
                    )}
                </div>
                <div className="flex items-center gap-1.5">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {ordersWithCoords.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground p-8">
                    <MapPin className="h-12 w-12 opacity-20" />
                    <p className="text-sm font-medium text-center">Ningún pedido activo de delivery tiene ubicación guardada.</p>
                    <p className="text-xs text-center opacity-60">Las coordenadas se guardan cuando el cliente ingresa su dirección.</p>
                </div>
            ) : (
                <div className="flex-1 relative overflow-hidden isolate">
                    {/* Chips de pedidos — strip horizontal flotando sobre el mapa, solo mobile */}
                    {orders.length > 0 && (
                        <div className="absolute top-3 left-0 right-0 z-[1001] lg:hidden pointer-events-none">
                            <div className="flex gap-2 overflow-x-auto px-3 pointer-events-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                {orders.map(pedido => {
                                    const isChipSelected = selected?.id === pedido.id && selected?.tipo === pedido.tipo
                                    const hasCoords = !!(pedido.latitud && pedido.longitud && parseCoord(pedido.latitud) !== 0)
                                    return (
                                        <button
                                            key={`chip-${pedido.tipo}-${pedido.id}`}
                                            onClick={() => {
                                                if (hasCoords) {
                                                    handleMarkerClick(pedido)
                                                } else {
                                                    const next = isChipSelected ? null : pedido
                                                    setSelected(next)
                                                    onSelectPedido?.(next)
                                                }
                                            }}
                                            className={cn(
                                                "shrink-0 flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-bold shadow-lg border transition-all active:scale-95",
                                                isChipSelected
                                                    ? "bg-[#FF7A00] text-white border-[#FF7A00] shadow-[#FF7A00]/30"
                                                    : "bg-background/95 dark:bg-background/95 text-foreground border-border backdrop-blur-sm"
                                            )}
                                        >
                                            <span className="font-black">#{pedido.id}</span>
                                            {pedido.tipo === 'takeaway'
                                                ? <ShoppingBag className="h-3 w-3 opacity-70" />
                                                : <Truck className="h-3 w-3 opacity-70" />}
                                            {pedido.nombreCliente && (
                                                <span className={cn("max-w-[80px] truncate", isChipSelected ? "opacity-90" : "text-muted-foreground")}>
                                                    {pedido.nombreCliente.split(' ')[0]}
                                                </span>
                                            )}
                                            <span className={cn("font-black", isChipSelected ? "" : "text-[#FF7A00]")}>
                                                ${computeOrderTotal(pedido).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                            </span>
                                            {!pedido.pagado && (
                                                <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", isChipSelected ? "bg-white/70" : "bg-amber-500")} />
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                    <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} attributionControl={false}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <MapBoundsController positions={positions} />
                        <MapFlyTo coords={flyCoords} />
                        {ordersWithCoords.map(pedido => {
                            const lat = parseCoord(pedido.latitud)
                            const lng = parseCoord(pedido.longitud)
                            const isSelected = selected?.id === pedido.id
                            const icon = isSelected
                                ? L.divIcon({
                                    className: '',
                                    iconSize: [72, 48],
                                    iconAnchor: [36, 48],
                                    html: `<div style="background:white;color:#FF7A00;width:68px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;box-shadow:0 4px 16px rgba(255,122,0,0.5);border:2.5px solid #FF7A00;position:relative;margin:2px 2px 0"><span>#${pedido.id}</span><div style="position:absolute;bottom:-9px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:9px solid #FF7A00"></div></div>`,
                                })
                                : L.divIcon({
                                    className: '',
                                    iconSize: [56, 38],
                                    iconAnchor: [28, 38],
                                    html: `<div style="background:#FF7A00;color:white;width:52px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.35);border:2px solid white;position:relative;margin:2px 2px 0"><span>#${pedido.id}</span><div style="position:absolute;bottom:-8px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:8px solid #FF7A00"></div></div>`,
                                })
                            return (
                                <Marker
                                    key={`${pedido.tipo}-${pedido.id}`}
                                    position={[lat, lng]}
                                    icon={icon}
                                    eventHandlers={{ click: () => handleMarkerClick(pedido) }}
                                />
                            )
                        })}
                    </MapContainer>

                    {/* Order popup */}
                    {selected && (
                        <div className="absolute bottom-4 left-4 right-4 z-[1001] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
                            {/* Header */}
                            <div className="flex items-start justify-between p-4 pb-3 border-b border-border">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                        <p className="font-black text-base text-foreground">Pedido #{selected.id}</p>
                                        {selected.horarioProgramado && (
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center gap-0.5 font-bold">
                                                <Clock className="h-2.5 w-2.5 shrink-0" />{selected.horarioProgramado}
                                            </Badge>
                                        )}
                                        {selected.pagado ? (
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Pagado</Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-border bg-muted text-muted-foreground">Sin cobrar</Badge>
                                        )}
                                    </div>
                                    {selected.nombreCliente && (
                                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                                            <User className="h-3.5 w-3.5 shrink-0" />{selected.nombreCliente}
                                        </p>
                                    )}
                                    {selected.telefono && (
                                        <a href={`tel:${selected.telefono}`} className="text-xs text-muted-foreground hover:text-[#FF7A00] flex items-center gap-1 mt-0.5 transition-colors">
                                            <Phone className="h-3 w-3 shrink-0" />{selected.telefono}
                                        </a>
                                    )}
                                    {selected.direccion && (
                                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                            <MapPin className="h-3 w-3 shrink-0" />{selected.direccion}
                                        </p>
                                    )}
                                    {selected.notas && (
                                        <p className="text-xs text-orange-500 flex items-start gap-1 mt-1.5 italic">
                                            <Tag className="h-3 w-3 shrink-0 mt-0.5" />{selected.notas}
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-start gap-2 shrink-0 ml-3">
                                    <span className="font-black text-2xl text-[#FF7A00]">
                                        ${computeOrderTotal(selected).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                    </span>
                                    <button
                                        className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-accent text-muted-foreground cursor-pointer shrink-0"
                                        onClick={handleCloseSelected}
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Items list */}
                            <div className="overflow-y-auto max-h-36 p-4 pt-3 space-y-1.5">
                                {selected.items.map((item, idx) => (
                                    <div key={idx} className="flex justify-between gap-2">
                                        <div className="flex gap-2 flex-1 min-w-0">
                                            <span className="text-sm font-bold text-muted-foreground shrink-0">{item.cantidad}x</span>
                                            <span className="text-sm font-medium text-foreground truncate">
                                                {item.nombreProducto}{item.varianteNombre ? ` (${item.varianteNombre})` : ''}
                                            </span>
                                        </div>
                                        <span className="text-sm tabular-nums font-semibold text-foreground shrink-0">
                                            ${(parseFloat(item.precioUnitario || '0') * item.cantidad).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                        </span>
                                    </div>
                                ))}
                                {selected.tipo === 'delivery' && getOrderDeliveryFee(selected) > 0 && (
                                    <div className="flex justify-between pt-2 border-t border-dashed border-border">
                                        <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                                            <Truck className="h-3.5 w-3.5" />Envío
                                        </span>
                                        <span className="text-sm font-semibold text-muted-foreground">
                                            ${getOrderDeliveryFee(selected).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Action buttons */}
                            {selected.estado !== 'archived' && (
                                <div className="p-3 pt-0 flex gap-2">
                                    {onNotificar && selected.pagado && selected.telefono && (
                                        <button
                                            onClick={() => onNotificar(selected)}
                                            disabled={sendingNotification === selected.id.toString()}
                                            className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-muted border border-border text-muted-foreground hover:bg-accent transition-colors text-xs font-bold disabled:opacity-50 cursor-pointer shrink-0"
                                        >
                                            {sendingNotification === selected.id.toString()
                                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                : <MessageCircle className="h-3.5 w-3.5" />}
                                            Avisar
                                        </button>
                                    )}
                                    {!selected.pagado ? (
                                        pedidoCobroManualYaElegido(selected.metodoPago) ? (
                                            <button
                                                onClick={() => onAprobarPago?.(selected)}
                                                disabled={updatingPago === selected.id.toString()}
                                                className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                                            >
                                                {updatingPago === selected.id.toString() ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                                Cobrar
                                            </button>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => onAprobarPago?.(selected, 'efectivo')}
                                                    disabled={updatingPago === selected.id.toString()}
                                                    className="flex-1 flex items-center justify-center gap-1 h-9 rounded-xl bg-muted border border-border text-foreground hover:bg-accent text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                                                >
                                                    {updatingPago === selected.id.toString() ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span>💵</span>}
                                                    Efectivo
                                                </button>
                                                <button
                                                    onClick={() => onAprobarPago?.(selected, 'transferencia')}
                                                    disabled={updatingPago === selected.id.toString()}
                                                    className="flex-1 flex items-center justify-center gap-1 h-9 rounded-xl bg-muted border border-border text-foreground hover:bg-accent text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                                                >
                                                    {updatingPago === selected.id.toString() ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span>🏦</span>}
                                                    Transf.
                                                </button>
                                            </>
                                        )
                                    ) : (
                                        <button
                                            onClick={handleMapDespachar}
                                            disabled={updatingPago === selected.id.toString() || asignandoRepartidor}
                                            className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-[#FF7A00] hover:bg-[#E66E00] text-white text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                                        >
                                            {(updatingPago === selected.id.toString() || asignandoRepartidor)
                                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                : <Truck className="h-3.5 w-3.5" />}
                                            Despachar
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ─────────────────────────────────────────────
// MINI MAPA DE PEDIDOS
// Versión compacta que vive a la derecha de la comanda en desktop.
// Muestra los mismos markers que el mapa completo, resaltando el pedido
// seleccionado, pero sin popup de detalle, header ni chips.
// ─────────────────────────────────────────────
const OrderMiniMap = ({ orders, selected }: { orders: UnifiedPedido[]; selected?: UnifiedPedido | null }) => {
    // Cuando el pedido seleccionado es takeaway o está archivado, el minimapa no
    // aporta nada (no tiene ubicación de entrega relevante), así que no mostramos nada.
    const hideMap = selected?.tipo === 'takeaway' || selected?.estado === 'archived'

    const ordersWithCoords = orders.filter(p => {
        if (p.tipo !== 'delivery' || !p.latitud || !p.longitud) return false
        const lat = parseCoord(p.latitud)
        const lng = parseCoord(p.longitud)
        return !isNaN(lat) && !isNaN(lng) && !(lat === 0 && lng === 0)
    })

    const positions = ordersWithCoords.map(p => [parseCoord(p.latitud), parseCoord(p.longitud)] as [number, number])

    const center: [number, number] = positions.length > 0
        ? [positions.reduce((s, [lat]) => s + lat, 0) / positions.length, positions.reduce((s, [, lng]) => s + lng, 0) / positions.length]
        : [-34.6037, -58.3816]

    const flyCoords = useMemo(() => {
        if (!selected?.latitud || !selected?.longitud) return null
        const lat = parseCoord(selected.latitud)
        const lng = parseCoord(selected.longitud)
        if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return null
        return { lat, lng, id: selected.id }
    }, [selected?.id])

    if (hideMap) {
        return <div className="h-full w-full bg-background" />
    }

    if (ordersWithCoords.length === 0) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-muted-foreground p-6 text-center">
                <MapPin className="h-8 w-8 opacity-20" />
                <p className="text-xs font-medium">Ningún pedido de delivery tiene ubicación guardada.</p>
            </div>
        )
    }

    return (
        <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} attributionControl={false} zoomControl={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapBoundsController positions={positions} />
            <MapFlyTo coords={flyCoords} />
            {ordersWithCoords.map(pedido => {
                const lat = parseCoord(pedido.latitud)
                const lng = parseCoord(pedido.longitud)
                const isSelected = selected?.id === pedido.id && selected?.tipo === pedido.tipo
                const icon = isSelected
                    ? L.divIcon({
                        className: '',
                        iconSize: [72, 48],
                        iconAnchor: [36, 48],
                        html: `<div style="background:white;color:#FF7A00;width:68px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;box-shadow:0 4px 16px rgba(255,122,0,0.5);border:2.5px solid #FF7A00;position:relative;margin:2px 2px 0"><span>#${pedido.id}</span><div style="position:absolute;bottom:-9px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:9px solid #FF7A00"></div></div>`,
                    })
                    : L.divIcon({
                        className: '',
                        iconSize: [56, 38],
                        iconAnchor: [28, 38],
                        html: `<div style="background:#FF7A00;color:white;width:52px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.35);border:2px solid white;position:relative;margin:2px 2px 0"><span>#${pedido.id}</span><div style="position:absolute;bottom:-8px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:8px solid #FF7A00"></div></div>`,
                    })
                return (
                    <Marker
                        key={`mini-${pedido.tipo}-${pedido.id}`}
                        position={[lat, lng]}
                        icon={icon}
                    />
                )
            })}
        </MapContainer>
    )
}

// ─────────────────────────────────────────────
// CONTEXTO DEL CLIENTE
// Una sola línea discreta: quién es y su historia. Sin robarle foco a la comanda.
// ─────────────────────────────────────────────
const NIVEL_LABEL = { nuevo: 'primera vez', recurrente: 'ya volvió', frecuente: 'frecuente' } as const

const CtxDot = () => <span className="text-muted-foreground/35" aria-hidden>·</span>

const ClienteContextoLine = ({ ctx, center = false }: { ctx: ClienteContexto; center?: boolean }) => {
    const nombre = primerNombre(ctx.nombre)
    const monto = `$${ctx.totalHistorico.toLocaleString('es-AR', { minimumFractionDigits: 0 })}`

    return (
        <div className={cn('flex items-center gap-x-2.5 gap-y-1 flex-wrap text-sm', center && 'justify-center')}>
            <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />

            {ctx.primeraVez ? (
                <span className="text-foreground">
                    <span className="font-semibold">Primer pedido</span>
                    {nombre && <span className="text-muted-foreground"> de </span>}
                    {nombre && <span className="font-semibold">{nombre}</span>}
                </span>
            ) : (
                <>
                    <span>
                        <span className="font-semibold text-foreground tabular-nums">{ordinalEs(ctx.pedidoNumero)}</span>
                        <span className="text-muted-foreground"> pedido</span>
                        {nombre && <span className="text-muted-foreground"> de </span>}
                        {nombre && <span className="font-semibold text-foreground">{nombre}</span>}
                    </span>
                    <CtxDot />
                    <span>
                        <span className="font-semibold text-foreground tabular-nums">{monto}</span>
                        <span className="text-muted-foreground"> histórico</span>
                    </span>
                    {ctx.ultimaVezAt && (
                        <>
                            <CtxDot />
                            <span className="text-muted-foreground">
                                última vez <span className="font-medium text-foreground/90">{formatUltimaVez(ctx.ultimaVezAt)}</span>
                            </span>
                        </>
                    )}
                </>
            )}

            {!ctx.primeraVez && (
                <span className="rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {NIVEL_LABEL[ctx.nivel]}
                </span>
            )}
        </div>
    )
}

// ─────────────────────────────────────────────
// ONBOARDING CHECKLIST
// ─────────────────────────────────────────────
const CHECKLIST_STORAGE_KEY = 'piru_onboarding_dismissed'

type ChecklistItemId = 'link_bio' | 'primer_pedido' | 'conectar_mp' | 'verificar_transferencias' | '10_pedidos'

interface ChecklistItemDef {
    id: ChecklistItemId
    title: string
    impact: string
    actionLabel: string
    actionIcon: React.ReactNode
}

const CHECKLIST_ITEMS: ChecklistItemDef[] = [
    {
        id: 'link_bio',
        title: 'Compartí tu link de pedidos',
        impact: 'Los negocios que lo ponen en su bio de Instagram reciben el doble de pedidos la primera semana.',
        actionLabel: 'Copiar link',
        actionIcon: <Copy className="h-3.5 w-3.5" />,
    },
    {
        id: 'primer_pedido',
        title: 'Recibí tu primer pedido',
        impact: 'Es tu prueba de que todo funciona. Hacete un pedido a vos mismo para verificar el flujo.',
        actionLabel: 'Abrir link',
        actionIcon: <ExternalLink className="h-3.5 w-3.5" />,
    },
    {
        id: 'conectar_mp',
        title: 'Conectá Mercado Pago',
        impact: 'Cobrá con tarjeta y dinero en cuenta sin tocar nada. El 70% de tus clientes prefieren pagar online.',
        actionLabel: 'Pendiente',
        actionIcon: <CreditCard className="h-3.5 w-3.5" />,
    },
    {
        id: 'verificar_transferencias',
        title: 'Verificá transferencias automáticamente',
        impact: 'Con Cucuru o Talo verificás al instante. Sin verificación manual, cero errores de cobro.',
        actionLabel: 'Pendiente',
        actionIcon: <Zap className="h-3.5 w-3.5" />,
    },
    {
        id: '10_pedidos',
        title: '10 pedidos completados',
        impact: 'Después de 10, ya tenés clientes que vuelven. Tu negocio online ya está funcionando.',
        actionLabel: '',
        actionIcon: null,
    },
]

function getDismissedItems(restauranteId: number): Set<ChecklistItemId> {
    try {
        const raw = localStorage.getItem(`${CHECKLIST_STORAGE_KEY}_${restauranteId}`)
        if (!raw) return new Set()
        const parsed = JSON.parse(raw)
        return new Set(Array.isArray(parsed) ? parsed : [])
    } catch {
        return new Set()
    }
}

function saveDismissedItems(restauranteId: number, items: Set<ChecklistItemId>) {
    localStorage.setItem(`${CHECKLIST_STORAGE_KEY}_${restauranteId}`, JSON.stringify([...items]))
}

const OnboardingChecklist = ({
    totalPedidos,
    restauranteStore,
    restauranteId,
    publicUrl,
}: {
    totalPedidos: number
    restauranteStore: import('@/store/restauranteStore').RestauranteData | null
    restauranteId: number
    publicUrl: string | null
}) => {
    const [dismissed, setDismissed] = useState<Set<ChecklistItemId>>(() => getDismissedItems(restauranteId))

    // Auto-complete checks
    const autoCompleted = useMemo<Set<ChecklistItemId>>(() => {
        const s = new Set<ChecklistItemId>()
        if (totalPedidos >= 1) s.add('primer_pedido')
        if (totalPedidos >= 10) s.add('10_pedidos')
        if (restauranteStore?.mpConnected) s.add('conectar_mp')
        const hasCucuru = !!restauranteStore?.cucuruConfigurado
        const hasTalo = !!(restauranteStore?.taloClientId && restauranteStore?.taloClientSecret && restauranteStore?.taloUserId)
        if (hasCucuru || hasTalo) s.add('verificar_transferencias')
        return s
    }, [totalPedidos, restauranteStore?.mpConnected, restauranteStore?.cucuruConfigurado, restauranteStore?.taloClientId, restauranteStore?.taloClientSecret, restauranteStore?.taloUserId])

    // Save auto-completed items to localStorage too so they persist
    useEffect(() => {
        const newDismissed = new Set(dismissed)
        let changed = false
        autoCompleted.forEach(id => {
            if (!newDismissed.has(id)) {
                newDismissed.add(id)
                changed = true
            }
        })
        if (changed) {
            setDismissed(newDismissed)
            saveDismissedItems(restauranteId, newDismissed)
        }
    }, [autoCompleted, restauranteId])

    const handleDismiss = (id: ChecklistItemId) => {
        const next = new Set(dismissed)
        next.add(id)
        setDismissed(next)
        saveDismissedItems(restauranteId, next)
    }

    const handleAction = (id: ChecklistItemId) => {
        if (id === 'link_bio' && publicUrl) {
            navigator.clipboard.writeText(publicUrl)
            toast.success('Link copiado al portapapeles')
        } else if (id === 'primer_pedido' && publicUrl) {
            window.open(publicUrl, '_blank')
        }
        // conectar_mp and verificar_transferencias: buttons show "Pendiente" since the config page isn't available yet
    }

    // Filter out dismissed items
    const visibleItems = CHECKLIST_ITEMS.filter(item => !dismissed.has(item.id))
    const completedCount = CHECKLIST_ITEMS.filter(item => autoCompleted.has(item.id)).length

    if (visibleItems.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                    <CheckCircle2 className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <p className="text-lg font-bold text-foreground">Operaciones al día</p>
                <p className="text-sm mt-1">Seleccioná un pedido del panel izquierdo para ver el detalle.</p>
            </div>
        )
    }

    return (
        <div className="h-full flex items-center justify-center p-6 overflow-y-auto">
            <div className="w-full max-w-md space-y-6">
                {/* Header */}
                <div className="text-center space-y-2">
                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                        {completedCount}/{CHECKLIST_ITEMS.length} completados
                    </p>
                    <h2 className="text-2xl font-black text-foreground tracking-tight">
                        Prepará tu negocio para recibir pedidos
                    </h2>
                    {/* Progress bar */}
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-3">
                        <div
                            className="h-full bg-[#FF7A00] rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${(completedCount / CHECKLIST_ITEMS.length) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Items */}
                <div className="space-y-2">
                    {visibleItems.map(item => {
                        const isCompleted = autoCompleted.has(item.id)
                        const hasAction = item.id === 'link_bio' || item.id === 'primer_pedido'
                        const isPending = item.id === 'conectar_mp' || item.id === 'verificar_transferencias'

                        return (
                            <div
                                key={item.id}
                                className={cn(
                                    "group relative rounded-xl border p-4 transition-all",
                                    isCompleted
                                        ? "bg-emerald-500/5 border-emerald-500/20"
                                        : "bg-card border-border hover:border-[#FF7A00]/30"
                                )}
                            >
                                <div className="flex items-start gap-3">
                                    {/* Check indicator */}
                                    <div className={cn(
                                        "h-5 w-5 rounded-full shrink-0 mt-0.5 flex items-center justify-center transition-all",
                                        isCompleted
                                            ? "bg-emerald-500 text-white"
                                            : "border-2 border-border"
                                    )}>
                                        {isCompleted && <CheckCircle className="h-3.5 w-3.5" />}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0 space-y-1.5">
                                        <p className={cn(
                                            "text-sm font-bold",
                                            isCompleted ? "text-emerald-600 dark:text-emerald-400 line-through" : "text-foreground"
                                        )}>
                                            {item.title}
                                        </p>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            {item.impact}
                                        </p>
                                        {!isCompleted && hasAction && (
                                            <button
                                                onClick={() => handleAction(item.id)}
                                                className="inline-flex items-center gap-1.5 mt-1 h-7 px-3 rounded-lg bg-[#FF7A00] hover:bg-[#E66E00] text-white text-xs font-bold transition-colors cursor-pointer"
                                            >
                                                {item.actionIcon}
                                                {item.actionLabel}
                                            </button>
                                        )}
                                        {!isCompleted && isPending && (
                                            <span className="inline-flex items-center gap-1.5 mt-1 h-7 px-3 rounded-lg bg-muted border border-border text-muted-foreground text-xs font-bold">
                                                {item.actionIcon}
                                                {item.actionLabel}
                                            </span>
                                        )}
                                    </div>

                                    {/* Dismiss button */}
                                    <button
                                        onClick={() => handleDismiss(item.id)}
                                        className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted transition-all opacity-0 group-hover:opacity-100 cursor-pointer shrink-0"
                                        title="Ocultar"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────
const Dashboard = () => {
    const token = useAuthStore((state) => state.token)
    const restaurante = useAuthStore((state) => state.restaurante)
    const { restaurante: restauranteStore, productos: allProductos } = useRestauranteStore()

    const { printRaw, selectedPrinter } = usePrinter()
    const processedOrdersRef = useRef<Map<string, { status: string, itemIds: Set<number>, pagado?: boolean }>>(new Map())
    const initialLoadDoneRef = useRef(false)
    const { lastUpdate } = useAdminContext()

    // Estados Principales
    const [unifiedPedidos, setUnifiedPedidos] = useState<UnifiedPedido[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedUnifiedPedido, setSelectedUnifiedPedido] = useState<UnifiedPedido | null>(null)
    const [clienteContexto, setClienteContexto] = useState<ClienteContexto | null>(null)

    // Paginación y Lazy Loading
    const [page, setPage] = useState(1)
    const [hasMore, setHasMore] = useState(true)
    const [isLoadingMore, setIsLoadingMore] = useState(false)

    const [updatingPago, setUpdatingPago] = useState<string | null>(null)
    const [dashboardMode, setDashboardMode] = useState<'orders' | 'nuevoPedido'>('orders')
    const [showOrderMap, setShowOrderMap] = useState(false)
    const [showPOS, setShowPOS] = useState(false)
    const [mobileView, setMobileView] = useState<'orders' | 'detail'>('orders')
    const [showMobileOrdersSheet, setShowMobileOrdersSheet] = useState(false)
    const [showCierreTurno, setShowCierreTurno] = useState(false)
    const [showArchived, setShowArchived] = useState(false)
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    const [sendingNotification, setSendingNotification] = useState<string | null>(null)
    const [demoraInputs, setDemoraInputs] = useState<Record<string, string>>({})
    const [confirmandoDemora, setConfirmandoDemora] = useState<string | null>(null)

    const [sucursalActivaId, setSucursalActivaId] = useState<number | null>(() => readStoredSucursalId())
    const [sucursalNombre, setSucursalNombre] = useState<string>('')
    const [showSucursalSelector, setShowSucursalSelector] = useState(false)
    const [sucursalesList, setSucursalesList] = useState<SucursalListRow[]>([])
    const [sucursalesLoaded, setSucursalesLoaded] = useState(false)
    const [prefsReady, setPrefsReady] = useState(false)

    const sucursalNombrePorId = useMemo(() => {
        const m = new Map<number, string>()
        for (const s of sucursalesList) {
            m.set(s.id, s.nombre)
        }
        return m
    }, [sucursalesList])

    // Estados Repartidores
    const [repartidoresModalOpen, setRepartidoresModalOpen] = useState(false)
    const [repartidoresList, setRepartidoresList] = useState<Repartidor[]>([])
    const [loadingRepartidores, setLoadingRepartidores] = useState(false)
    const [nuevoRepartidorNombre, setNuevoRepartidorNombre] = useState('')
    const [creandoRepartidor, setCreandoRepartidor] = useState(false)
    const [pendingDispatchPedido, setPendingDispatchPedido] = useState<{ tipo: 'delivery' | 'takeaway'; id: number } | null>(null)
    const [repartidorSelectorOpen, setRepartidorSelectorOpen] = useState(false)
    const [asignandoRepartidor, setAsignandoRepartidor] = useState(false)

    // Estados Modal Pagos
    const [metodosPagoModalOpen, setMetodosPagoModalOpen] = useState(false)
    const [cfgMpCheckout, setCfgMpCheckout] = useState(true)
    const [cfgMpBricks, setCfgMpBricks] = useState(false)
    const [cfgTfAuto, setCfgTfAuto] = useState(true)
    const [cfgTfManual, setCfgTfManual] = useState(false)
    const [cfgEfectivo, setCfgEfectivo] = useState(true)
    const [cfgAlias, setCfgAlias] = useState('')
    const [savingMetodosPago, setSavingMetodosPago] = useState(false)

    // ─────────────────────────────────────────────
    // SUCURSALES + PREFS
    // ─────────────────────────────────────────────
    useEffect(() => {
        if (!token) {
            setPrefsReady(true)
            setSucursalesLoaded(true)
            return
        }
        setSucursalesLoaded(false)
        setPrefsReady(false)
        let cancelled = false
            ; (async () => {
                try {
                    const res: any = await sucursalesApi.list(token)
                    if (!cancelled && res.success && Array.isArray(res.data)) {
                        setSucursalesList(res.data as SucursalListRow[])
                    }
                } catch (e) {
                    console.error('Error cargando sucursales:', e)
                } finally {
                    if (!cancelled) setSucursalesLoaded(true)
                }
            })()
        return () => {
            cancelled = true
        }
    }, [token])

    useEffect(() => {
        if (!token || !sucursalesLoaded) return
        const activas = sucursalesList.filter((s) => s.activo)
        if (activas.length === 0) {
            setSucursalNombre('')
            setPrefsReady(true)
            setShowSucursalSelector(false)
            return
        }
        const raw = localStorage.getItem(STORAGE_SUCURSAL)
        if (raw == null || raw === '') {
            setShowSucursalSelector(true)
            return
        }
        if (raw === 'all') {
            setSucursalActivaId(null)
            setSucursalNombre('')
            setPrefsReady(true)
            setShowSucursalSelector(false)
            return
        }
        const id = parseInt(raw, 10)
        if (Number.isNaN(id) || !activas.some((s) => s.id === id)) {
            setShowSucursalSelector(true)
            return
        }
        setSucursalActivaId(id)
        setSucursalNombre(activas.find((s) => s.id === id)?.nombre ?? '')
        setPrefsReady(true)
        setShowSucursalSelector(false)
    }, [token, sucursalesLoaded, sucursalesList])

    const applySucursalChoice = useCallback((id: number | null, nombreVisual: string) => {
        setSucursalActivaId(id)
        setSucursalNombre(nombreVisual)
        if (id == null) localStorage.setItem(STORAGE_SUCURSAL, 'all')
        else localStorage.setItem(STORAGE_SUCURSAL, String(id))
        setShowSucursalSelector(false)
        setPrefsReady(true)
    }, [])

    useEffect(() => {
        setPage(1)
        setHasMore(true)
    }, [sucursalActivaId])

    // ─────────────────────────────────────────────
    // FETCH Y WEBSOCKETS
    // ─────────────────────────────────────────────
    const fetchPedidos = useCallback(async (pageNum = 1, append = false) => {
        if (!token) return
        if (!append) setIsLoading(true)
        else setIsLoadingMore(true)

        try {
            const response = await pedidoUnificadoApi.getAll(
                token,
                'all',
                pageNum,
                50,
                undefined,
                sucursalActivaId,
            ) as any
            if (response.success && response.data) {
                const validPedidos = response.data.filter((p: any) => p.tipo === 'delivery' || p.tipo === 'takeaway') as UnifiedPedido[]

                setUnifiedPedidos(prev => {
                    const combined: UnifiedPedido[] = append ? [...prev, ...validPedidos] : validPedidos
                    const uniqueMap = new Map<string, UnifiedPedido>()
                    combined.forEach((item: UnifiedPedido) => uniqueMap.set(`${item.tipo}-${item.id}`, item))
                    const unique = Array.from(uniqueMap.values())
                    return unique.sort((a: UnifiedPedido, b: UnifiedPedido) => parseDashboardDate(b.createdAt).getTime() - parseDashboardDate(a.createdAt).getTime())
                })

                setHasMore(response.pagination?.hasMore ?? false)

                if (!append) {
                    setSelectedUnifiedPedido((prevSelected) => {
                        if (!prevSelected) return prevSelected
                        const updated = validPedidos.find((p: any) => p.id === prevSelected.id && p.tipo === prevSelected.tipo)
                        return updated || prevSelected
                    })
                }
            }
        } catch (error) {
            console.error('Error fetching pedidos:', error)
        } finally {
            setIsLoading(false)
            setIsLoadingMore(false)
        }
    }, [token, sucursalActivaId])

    useEffect(() => {
        if (!token || !prefsReady) return
        fetchPedidos(1, false)
    }, [token, prefsReady, fetchPedidos])

    useEffect(() => {
        if (!prefsReady || !lastUpdate) return
        if (lastUpdate.type !== 'delivery' && lastUpdate.type !== 'takeaway') return
        if (
            sucursalActivaId != null &&
            lastUpdate.sucursalId !== undefined &&
            lastUpdate.sucursalId !== null &&
            lastUpdate.sucursalId !== sucursalActivaId
        ) {
            return
        }
        fetchPedidos(1, false)
    }, [lastUpdate, fetchPedidos, sucursalActivaId, prefsReady])

    // Contexto histórico del cliente detrás del pedido seleccionado.
    // Se re-consulta al cambiar de pedido; se limpia mientras carga para no mostrar datos ajenos.
    useEffect(() => {
        const pedidoId = selectedUnifiedPedido?.id
        if (!token || !pedidoId) { setClienteContexto(null); return }
        // Sin nombre ni teléfono no hay a quién identificar: evitamos el request.
        if (!selectedUnifiedPedido?.telefono && !selectedUnifiedPedido?.nombreCliente) {
            setClienteContexto(null); return
        }
        let cancelled = false
        setClienteContexto(null)
        pedidoUnificadoApi.clienteContexto(token, pedidoId)
            .then((res: any) => {
                if (cancelled) return
                setClienteContexto(res?.data ?? null)
            })
            .catch(() => { if (!cancelled) setClienteContexto(null) })
        return () => { cancelled = true }
    }, [token, selectedUnifiedPedido?.id, selectedUnifiedPedido?.telefono, selectedUnifiedPedido?.nombreCliente])

    const handleLoadMore = () => {
        if (!hasMore || isLoadingMore) return
        const nextPage = page + 1
        setPage(nextPage)
        fetchPedidos(nextPage, true)
    }

    // ─────────────────────────────────────────────
    // AUTO-IMPRESIÓN
    // ─────────────────────────────────────────────
    useEffect(() => {
        if (!selectedPrinter) return

        unifiedPedidos.forEach(pedido => {
            const pedidoKey = `${pedido.tipo}-${pedido.id}`
            const currentPagado = pedido.pagado
            const prevData = processedOrdersRef.current.get(pedidoKey)
            const deferUntilPaid = deferComandaHastaPagado(pedido.metodoPago, restauranteStore?.cucuruConfigurado)

            // Archivado → registrar y nunca imprimir
            if (pedido.estado === 'archived') {
                if (!prevData) processedOrdersRef.current.set(pedidoKey, { status: pedido.estado, itemIds: new Set(pedido.items.map(i => i.id)), pagado: currentPagado })
                return
            }

            // Ya impreso en la DB → registrar y saltar
            if (pedido.impreso) {
                if (!prevData) processedOrdersRef.current.set(pedidoKey, { status: pedido.estado, itemIds: new Set(pedido.items.map(i => i.id)), pagado: currentPagado })
                return
            }

            let shouldPrint = false

            if (!prevData) {
                // Primera vez que vemos este pedido
                if (!initialLoadDoneRef.current) {
                    // Carga inicial (F5, apertura): solo registrar, NO imprimir
                    processedOrdersRef.current.set(pedidoKey, { status: pedido.estado, itemIds: new Set(pedido.items.map(i => i.id)), pagado: currentPagado })
                    return
                }
                // Pedido NUEVO que llegó en vivo después de la carga inicial
                if (deferUntilPaid) {
                    // Método deferred (MP, Cucuru, Talo): solo imprimir si ya está pagado
                    shouldPrint = !!currentPagado
                } else {
                    // Método no-deferred (efectivo, transf manual): imprimir inmediatamente
                    shouldPrint = true
                }
            } else {
                // Pedido ya conocido: imprimir solo si acaba de pasar a pagado (para deferred)
                if (deferUntilPaid && currentPagado && !prevData.pagado) {
                    shouldPrint = true
                }
            }

            if (shouldPrint && token) {
                // Claim atómico contra el backend: si hay otro dispositivo/pestaña del mismo
                // restaurante conectado, solo uno de los dos debe ganar la carrera e imprimir.
                pedidoUnificadoApi.claimImpreso(token, pedido.id)
                    .then((res: any) => {
                        if (!res?.claimed) return

                        const itemsToPrint = pedido.items.map(item => {
                            const producto = allProductos.find(p => p.id === item.productoId)
                            return { ...item, producto }
                        })

                        if (itemsToPrint.length > 0) {
                            const deliveryFee = pedido.tipo === 'delivery' ? getOrderDeliveryFee(pedido) : 0;
                            const comandaData = formatComanda({
                                id: pedido.id, nombrePedido: pedido.nombreCliente, telefono: pedido.telefono,
                                direccion: pedido.tipo === 'delivery' ? (pedido as any).direccion : undefined,
                                tipo: pedido.tipo, total: pedido.total, deliveryFee, notas: pedido.notas,
                                metodoPago: pedido.metodoPago, sucursalNombre: pedido.sucursalNombre,
                                horarioProgramado: pedido.horarioProgramado, grupal: pedido.grupal,
                            }, itemsToPrint, restaurante?.nombre || 'Restaurante')

                            printRaw(commandsToBytes(comandaData)).catch((err) => {
                                // El claim ya quedó en true en el backend (no se reintentará solo),
                                // así que avisamos al local para que reimprima a mano desde el pedido.
                                console.error('Error imprimiendo comanda automática:', err)
                                toast.error(`No se pudo imprimir el pedido #${pedido.id}. Reimprimilo manualmente.`)
                            })
                        }

                        setUnifiedPedidos(prev => prev.map(p => p.id === pedido.id ? { ...p, impreso: true } : p))
                    })
                    .catch(console.error)
            }
            processedOrdersRef.current.set(pedidoKey, { status: pedido.estado, itemIds: new Set(pedido.items.map(i => i.id)), pagado: currentPagado })
        })

        // Después de procesar el primer batch, marcar carga inicial como completada
        if (!initialLoadDoneRef.current && unifiedPedidos.length > 0) {
            initialLoadDoneRef.current = true
        }
    }, [unifiedPedidos, selectedPrinter, allProductos, restaurante, printRaw, token, restauranteStore])

    // ─────────────────────────────────────────────
    // ACCIONES DE PEDIDO
    // ─────────────────────────────────────────────
    const handleEstadoChange = async (tipo: 'delivery' | 'takeaway', id: number, nuevoEstado: string) => {
        if (!token) return
        try {
            if (tipo === 'delivery') await deliveryApi.updateEstado(token, id, nuevoEstado)
            else await takeawayApi.updateEstado(token, id, nuevoEstado)
            setUnifiedPedidos(prev => prev.map(p => p.id === id && p.tipo === tipo ? { ...p, estado: nuevoEstado } : p))
            if (nuevoEstado === 'archived') {
                setSelectedUnifiedPedido(null)
                setMobileView('orders')
                toast.success('Pedido despachado')
            }
        } catch (error) { toast.error('Error al actualizar estado') }
    }

    const loadRepartidores = useCallback(async () => {
        if (!token) return
        setLoadingRepartidores(true)
        try {
            const res: any = await repartidoresApi.list(token)
            if (res.success) setRepartidoresList(res.data)
        } catch { } finally { setLoadingRepartidores(false) }
    }, [token])

    useEffect(() => {
        if (repartidoresModalOpen) loadRepartidores()
    }, [repartidoresModalOpen, loadRepartidores])

    useEffect(() => {
        if (token) loadRepartidores()
    }, [token, loadRepartidores])

    const handleDespachar = async (tipo: 'delivery' | 'takeaway', id: number) => {
        if (tipo === 'delivery') {
            const activos = repartidoresList.filter(r => r.estado === 'activo')
            if (activos.length >= 2) {
                setPendingDispatchPedido({ tipo, id })
                setRepartidorSelectorOpen(true)
                return
            }
        }
        await handleEstadoChange(tipo, id, 'archived')
    }

    const handleRepartidorSelected = async (tipo: 'delivery' | 'takeaway', id: number, repartidorId: number | null) => {
        if (!token) return
        setAsignandoRepartidor(true)
        try {
            if (repartidorId !== null) {
                try {
                    await pedidoUnificadoApi.asignarRepartidor(token, id, repartidorId)
                    setUnifiedPedidos(prev => prev.map(p =>
                        p.id === id && p.tipo === tipo
                            ? { ...p, repartidorId, repartidorNombre: repartidoresList.find(r => r.id === repartidorId)?.nombre ?? null }
                            : p
                    ))
                } catch { }
            }
            await handleEstadoChange(tipo, id, 'archived')
        } finally {
            setAsignandoRepartidor(false)
            setPendingDispatchPedido(null)
            setRepartidorSelectorOpen(false)
        }
    }

    const handleAprobarPago = async (pedido: UnifiedPedido, metodoOverrides?: 'efectivo' | 'transferencia') => {
        if (!token) return
        setUpdatingPago(pedido.id.toString())
        try {
            const mp = resolveMetodoMarcarPagado(pedido.metodoPago, metodoOverrides)
            const res: any = (pedido.tipo === 'delivery'
                ? await deliveryApi.marcarPagado(token, pedido.id, { pagado: true, metodoPago: mp })
                : await takeawayApi.marcarPagado(token, pedido.id, { pagado: true, metodoPago: mp }))

            if (res.success) {
                setUnifiedPedidos(prev => prev.map(p => p.id === pedido.id && p.tipo === pedido.tipo ? { ...p, pagado: true, metodoPago: mp } : p))
                toast.success('Pago verificado correctamente')
            }
        } catch (error) { toast.error('No se pudo verificar el pago') }
        finally { setUpdatingPago(null) }
    }

    const handleDeletePedido = async () => {
        if (!token || !selectedUnifiedPedido) return
        try {
            if (selectedUnifiedPedido.tipo === 'delivery') await deliveryApi.delete(token, selectedUnifiedPedido.id)
            else await takeawayApi.delete(token, selectedUnifiedPedido.id)
            setUnifiedPedidos(prev => prev.filter(p => !(p.id === selectedUnifiedPedido.id && p.tipo === selectedUnifiedPedido.tipo)))
            setShowDeleteDialog(false)
            setSelectedUnifiedPedido(null)
            setMobileView('orders')
            toast.success('Pedido eliminado')
        } catch (error) { toast.error('Error al eliminar') }
    }

    const handleNotificarCliente = async (pedido: UnifiedPedido) => {
        if (!token) return
        setSendingNotification(pedido.id.toString())
        try {
            const res: any = await pedidoUnificadoApi.notificarCliente(token, pedido.id)
            if (res.success) {
                toast.success('Mensaje de WhatsApp enviado al cliente')
            } else {
                toast.error(res.message || 'No se pudo enviar la notificación')
            }
        } catch (error) {
            toast.error('Error al enviar la notificación')
        } finally {
            setSendingNotification(null)
        }
    }

    const handleConfirmarConDemora = async (pedido: UnifiedPedido) => {
        if (!token) return
        const key = pedido.id.toString()
        const minutos = parseInt(demoraInputs[key] ?? '30', 10)
        if (isNaN(minutos) || minutos < 0) {
            toast.error('Ingresá una demora válida en minutos')
            return
        }
        setConfirmandoDemora(key)
        try {
            const res: any = await pedidoUnificadoApi.confirmarConDemora(token, pedido.id, minutos)
            if (res.success) {
                toast.success(pedido.telefono ? `Confirmación enviada (${minutos} min)` : `Demora guardada (${minutos} min)`)
                setUnifiedPedidos(prev => prev.map(p =>
                    p.id === pedido.id && p.tipo === pedido.tipo
                        ? { ...p, demoraMinutos: minutos }
                        : p
                ))
                setSelectedUnifiedPedido(prev =>
                    prev?.id === pedido.id && prev?.tipo === pedido.tipo
                        ? { ...prev, demoraMinutos: minutos }
                        : prev
                )
            } else {
                toast.error(res.message || 'No se pudo confirmar')
            }
        } catch (error) {
            toast.error('Error al confirmar con demora')
        } finally {
            setConfirmandoDemora(null)
        }
    }

    // ─────────────────────────────────────────────
    // MODAL MÉTODOS DE PAGO
    // ─────────────────────────────────────────────
    const openMetodosPagoModal = () => {
        const r = restauranteStore
        if (!r) return
        const c = r.metodosPagoConfig || {}
        const mpOk = !!r.mpConnected
        const taloCred = !!(r.taloClientId && r.taloClientSecret && r.taloUserId)
        const autoTf = !!(r.cucuruConfigurado || taloCred)
        setCfgMpCheckout(c.mercadopagoCheckout ?? (mpOk && r.cardsPaymentsEnabled !== false))
        setCfgMpBricks(c.mercadopagoBricks ?? false)
        setCfgTfAuto(c.transferenciaAutomatica ?? autoTf)
        setCfgTfManual(c.transferenciaManual ?? (!autoTf && !!(r.transferenciaAlias && String(r.transferenciaAlias).trim())))
        setCfgEfectivo(c.efectivo ?? true)
        setCfgAlias(r.transferenciaAlias || '')
        setMetodosPagoModalOpen(true)
    }

    const saveMetodosPago = async () => {
        if (!token) return
        setSavingMetodosPago(true)
        try {
            await restauranteApi.updateMetodosPago(token, {
                mercadopagoCheckout: cfgMpCheckout,
                mercadopagoBricks: cfgMpBricks,
                transferenciaAutomatica: cfgTfAuto,
                transferenciaManual: cfgTfManual,
                efectivo: cfgEfectivo,
                transferenciaAlias: cfgAlias,
            })
            await useRestauranteStore.getState().fetchData()
            toast.success('Métodos de pago guardados')
            setMetodosPagoModalOpen(false)
        } catch (e) {
            toast.error('No se pudieron guardar los métodos de pago')
        } finally {
            setSavingMetodosPago(false)
        }
    }

    // ─────────────────────────────────────────────
    // POS (anotar pedido manual)
    // ─────────────────────────────────────────────
    const openPOS = () => {
        setShowOrderMap(false)
        setSelectedUnifiedPedido(null)
        setShowPOS(true)
        setMobileView('detail')
    }

    const handlePedidoManualCreado = (_pedidoId: number) => {
        setShowPOS(false)
        setMobileView('orders')
        fetchPedidos(1, false)
    }

    // ─────────────────────────────────────────────
    // RENDER DE LISTAS
    // ─────────────────────────────────────────────
    const activeOrders = unifiedPedidos.filter(p => p.estado !== 'archived')
    const archivedOrders = unifiedPedidos.filter(p => p.estado === 'archived')

    // Onboarding checklist data
    const publicUrl = restauranteStore?.username ? `https://my.piru.app/${restauranteStore.username}` : null
    const totalPedidos = unifiedPedidos.length

    if (!prefsReady) {
        const activasParaModal = sucursalesList.filter((s) => s.activo)
        return (
            <div className="relative h-full flex flex-col items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-[#FF7A00]" />
                <SucursalSelector
                    open={showSucursalSelector && activasParaModal.length > 0}
                    onOpenChange={setShowSucursalSelector}
                    sucursalesActivas={activasParaModal}
                    onSelect={(id, nombreEtiqueta) => applySucursalChoice(id, nombreEtiqueta)}
                    requireChoice
                />
            </div>
        )
    }

    if (isLoading && unifiedPedidos.length === 0) {
        return <div className="h-full flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-[#FF7A00]" /></div>
    }

    return (
        <div className="h-full flex flex-col overflow-hidden bg-background">

            {/* ── HEADER PRINCIPAL ── */}
            <header className="shrink-0 bg-background border-b border-border px-4 py-3 flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                    {mobileView === 'detail' && (
                        <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9 -ml-2" onClick={() => { setMobileView('orders'); setShowOrderMap(false); setShowPOS(false) }}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    )}
                    <h1 className="text-xl font-bold tracking-tight text-foreground">
                        {mobileView === 'detail' && showPOS
                            ? 'Anotar pedido'
                            : mobileView === 'detail' && showOrderMap
                                ? 'Mapa de pedidos'
                                : 'Hoy'}
                    </h1>
                    {sucursalNombre ? (
                        <Badge variant="outline" className="hidden sm:flex text-xs border-[#FF7A00]/25 text-foreground">
                            <Store className="h-3 w-3 mr-1 text-[#FF7A00]" />
                            {sucursalNombre}
                        </Badge>
                    ) : null}
                    {sucursalesList.some((s) => s.activo) ? (
                        <button
                            type="button"
                            className="hidden sm:inline text-[11px] font-semibold text-muted-foreground underline-offset-4 hover:text-[#FF7A00] hover:underline cursor-pointer"
                            onClick={() => setShowSucursalSelector(true)}
                        >
                            Cambiar sucursal
                        </button>
                    ) : null}
                </div>

                <div className="flex items-center gap-2">
                    {mobileView === 'detail' && activeOrders.length > 0 && (
                        <button
                            onClick={() => setShowMobileOrdersSheet(true)}
                            className="lg:hidden flex items-center gap-1.5 h-8 px-3 rounded-xl bg-muted border border-border text-xs font-bold text-foreground hover:bg-accent transition-colors"
                        >
                            <List className="h-3.5 w-3.5" />
                            {activeOrders.length}
                        </button>
                    )}
                    <Button
                        variant="outline"
                        className={cn(
                            "h-10 rounded-xl flex",
                            showPOS && "border-[#FF7A00] text-[#FF7A00] bg-[#FF7A00]/10"
                        )}
                        onClick={openPOS}
                    >
                        <ShoppingCart className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Anotar pedido</span>
                    </Button>
                    <Button variant="outline" className="h-10 rounded-xl hidden sm:flex" onClick={() => setShowCierreTurno(true)}>
                        <CalendarDays className="mr-2 h-4 w-4" /> Caja
                    </Button>
                </div>
            </header>

            {/* ── MAIN CONTENT ── */}
            <div className="flex-1 flex overflow-hidden">

                {dashboardMode === 'orders' ? (
                    <>
                        {/* ── PANEL IZQUIERDO: LISTA COMPACTA DE PEDIDOS ── */}
                        <div className={cn(
                            "w-full lg:w-[380px] xl:w-[420px] flex-col border-r border-border shrink-0 bg-muted/10",
                            mobileView === 'orders' ? 'flex' : 'hidden lg:flex'
                        )}>
                            <div className="p-3 border-b border-border flex items-center justify-between bg-background/95 backdrop-blur">
                                <div className="flex items-center gap-2">
                                    <h2 className="font-bold text-base">Pedidos</h2>
                                    <Badge className="bg-[#FF7A00] hover:bg-[#FF7A00] text-white rounded-full px-2 py-0">{activeOrders.length}</Badge>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 text-xs px-2 gap-1.5"
                                        onClick={() => { setShowOrderMap(true); setShowPOS(false); setMobileView('detail') }}
                                    >
                                        <MapIcon className="h-3.5 w-3.5" /> Mapa
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-8 text-xs px-2 gap-1.5" onClick={openMetodosPagoModal}>
                                        <Settings className="h-3.5 w-3.5" /> Pagos
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-8 text-xs px-2 gap-1.5" onClick={() => setRepartidoresModalOpen(true)}>
                                        <UserRound className="h-3.5 w-3.5" /> Repartidores
                                    </Button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-3">
                                {activeOrders.length === 0 ? (
                                    <div className="h-32 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-2xl">
                                        <Receipt className="h-6 w-6 mb-2 opacity-40" />
                                        <p className="text-sm font-medium">No hay pedidos activos</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {activeOrders.map((pedido, index) => {
                                            const isSelected = selectedUnifiedPedido?.id === pedido.id && selectedUnifiedPedido?.tipo === pedido.tipo;
                                            const pagoBadge = metodoPagoListBadge(pedido.metodoPago);
                                            const dateLabel = getDateLabel(pedido.createdAt);
                                            const prevDateLabel = index > 0 ? getDateLabel(activeOrders[index - 1].createdAt) : null;
                                            const showDateSeparator = dateLabel !== prevDateLabel;

                                            return (
                                                <Fragment key={pedido.id}>
                                                    {showDateSeparator && (
                                                        <div className={`flex items-center gap-3 ${index === 0 ? 'pb-1' : 'pt-3 pb-1'}`}>
                                                            <span className="text-[10px] font-bold text-muted-foreground uppercase">{dateLabel}</span>
                                                            <Separator className="flex-1 bg-border" />
                                                        </div>
                                                    )}
                                                    <Card
                                                        onClick={() => {
                                                            setSelectedUnifiedPedido(pedido)
                                                            setShowPOS(false)
                                                            if (!showOrderMap) setMobileView('detail')
                                                        }}
                                                        className={cn(
                                                            "p-3 rounded-xl cursor-pointer transition-all flex flex-col gap-2 border-0",
                                                            isSelected
                                                                ? "bg-muted/20 border-r-[3px] border-r-[#FF7A00]"
                                                                : "bg-muted/20 hover:bg-muted/40"
                                                        )}
                                                    >
                                                        <div className="flex justify-between items-start gap-2">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="font-bold text-sm">#{pedido.id}</span>
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                                                                    {pedido.tipo === 'delivery' ? <Truck className="h-3 w-3" /> : <ShoppingBag className="h-3 w-3" />}
                                                                    {pedido.tipo === 'delivery' ? 'Delivery' : 'Takeaway'}
                                                                </span>
                                                                {pedido.creadoPorIa && (
                                                                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center gap-0.5">
                                                                        <MessageCircle className="h-2.5 w-2.5 shrink-0" />IA
                                                                    </Badge>
                                                                )}
                                                                {pedido.anotadoManualmente && (
                                                                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center gap-0.5">
                                                                        <ShoppingCart className="h-2.5 w-2.5 shrink-0" />Manual
                                                                    </Badge>
                                                                )}
                                                                {!pedido.pagado && (
                                                                    <Badge className="bg-muted text-muted-foreground text-[9px] px-1 border border-border hover:bg-muted/80">Pendiente</Badge>
                                                                )}
                                                                {pagoBadge && (
                                                                    <Badge variant="outline" className={cn("text-[9px] px-1 py-0 h-4 border-none", pagoBadge.className)}>
                                                                        {pagoBadge.icon && <span className="mr-1">{pagoBadge.icon}</span>}{pagoBadge.label}
                                                                    </Badge>
                                                                )}
                                                                {sucursalActivaId === null && pedido.sucursalId != null && (
                                                                    <Badge
                                                                        variant="outline"
                                                                        className="text-[9px] px-1 py-0 h-4 max-w-[120px] truncate border-[#FF7A00]/20 text-[#FF7A00]"
                                                                    >
                                                                        <Store className="h-2.5 w-2.5 mr-0.5 shrink-0" />
                                                                        {sucursalNombrePorId.get(pedido.sucursalId) ?? `Suc. #${pedido.sucursalId}`}
                                                                    </Badge>
                                                                )}
                                                                {pedido.horarioProgramado && (
                                                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-border bg-muted text-muted-foreground flex items-center gap-0.5 font-bold">
                                                                        <Clock className="h-2.5 w-2.5 shrink-0" />{pedido.horarioProgramado}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <span className="font-black text-sm">${computeOrderTotal(pedido).toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
                                                        </div>

                                                        <div className="flex justify-between items-end">
                                                            <div className="min-w-0">
                                                                {pedido.nombreCliente && <p className="text-xs font-semibold text-foreground truncate max-w-[180px]">{pedido.nombreCliente}</p>}
                                                                {pedido.tipo === 'delivery' && pedido.direccion && (
                                                                    <p className="text-[11px] text-muted-foreground truncate max-w-[180px] flex items-center gap-1 mt-0.5">
                                                                        <MapPin className="h-2.5 w-2.5 shrink-0" /> {pedido.direccion}
                                                                    </p>
                                                                )}
                                                                <div className="flex items-center gap-1 mt-1">
                                                                    <span className="text-[10px] text-muted-foreground">{formatTimeAgo(pedido.createdAt)}</span>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                {pedido.pagado && (
                                                                    <button
                                                                        className="h-7 px-2 rounded-md bg-muted border border-border flex items-center gap-1 text-muted-foreground hover:bg-accent transition-colors disabled:opacity-50 text-[10px] font-bold cursor-pointer"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleNotificarCliente(pedido);
                                                                        }}
                                                                        disabled={sendingNotification === pedido.id.toString()}
                                                                    >
                                                                        {sendingNotification === pedido.id.toString()
                                                                            ? <Loader2 className="h-3 w-3 animate-spin" />
                                                                            : <MessageCircle className="h-3 w-3" />}
                                                                        Notificar
                                                                    </button>
                                                                )}
                                                                <Button
                                                                    size="sm"
                                                                    className={cn("h-7 px-3 text-[10px] font-bold shrink-0", pedido.pagado ? "bg-[#FF7A00] hover:bg-[#E66E00] text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white")}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (pedido.pagado) void handleDespachar(pedido.tipo, pedido.id);
                                                                        else handleAprobarPago(pedido);
                                                                    }}
                                                                    disabled={updatingPago === pedido.id.toString()}
                                                                >
                                                                    {updatingPago === pedido.id.toString() ? <Loader2 className="h-3 w-3 animate-spin" /> : (pedido.pagado ? 'Despachar' : 'Cobrar')}
                                                                </Button>
                                                            </div>
                                                        </div>

                                                        {/* Indicador de confirmación en la tarjeta */}
                                                        {restauranteStore?.modoConfirmacionManual && pedido.notificarWhatsapp && pedido.telefono && pedido.demoraMinutos != null && (
                                                            <div className="mt-2 pt-2 border-t border-border flex items-center gap-1.5">
                                                                <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                                                    Confirmado · {pedido.demoraMinutos} min
                                                                </span>
                                                            </div>
                                                        )}
                                                    </Card>
                                                </Fragment>
                                            )
                                        })}
                                    </div>
                                )}

                                {/* Pedidos Archivados */}
                                {archivedOrders.length > 0 && (
                                    <div className="pt-6 pb-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowArchived(v => !v)}
                                            className="flex items-center gap-3 mb-3 w-full group"
                                        >
                                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest pl-1 group-hover:text-foreground transition-colors">Historial</span>
                                            <span className="text-[10px] font-bold text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 leading-none">{archivedOrders.length}</span>
                                            <ChevronDown className={cn("h-4 w-4 text-muted-foreground group-hover:text-foreground transition-all", showArchived && "rotate-180")} />
                                            <Separator className="flex-1 bg-border" />
                                        </button>

                                        {showArchived && (
                                            <div className="space-y-2">
                                                {archivedOrders.map((pedido, index) => {
                                                    const dateLabel = getDateLabel(pedido.createdAt);
                                                    const prevDateLabel = index > 0 ? getDateLabel(archivedOrders[index - 1].createdAt) : null;
                                                    const showDateSeparator = dateLabel !== prevDateLabel;

                                                    return (
                                                        <Fragment key={pedido.id}>
                                                            {showDateSeparator && index !== 0 && (
                                                                <div className="flex items-center gap-3 pt-3 pb-1">
                                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{dateLabel}</span>
                                                                </div>
                                                            )}
                                                            <div
                                                                onClick={() => { setSelectedUnifiedPedido(pedido); setShowPOS(false); setMobileView('detail'); }}
                                                                className="flex items-center justify-between p-3 rounded-xl bg-card border border-border opacity-60 hover:opacity-100 cursor-pointer active:scale-[0.99] transition-all"
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-semibold text-xs text-muted-foreground">#{pedido.id}</span>
                                                                    <span className="text-xs text-muted-foreground truncate max-w-[120px]">{pedido.nombreCliente || 'Sin nombre'}</span>
                                                                </div>
                                                                <span className="text-xs font-bold text-muted-foreground">${computeOrderTotal(pedido).toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
                                                            </div>
                                                        </Fragment>
                                                    )
                                                })}
                                            </div>
                                        )}

                                        {showArchived && hasMore && (
                                            <Button
                                                variant="ghost"
                                                className="w-full mt-4 text-xs font-semibold text-muted-foreground border border-dashed border-border rounded-xl h-10"
                                                onClick={handleLoadMore}
                                                disabled={isLoadingMore}
                                            >
                                                {isLoadingMore ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ChevronDown className="h-4 w-4 mr-2" />}
                                                Cargar más antiguos
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── PANEL DERECHO: DETALLE OPERATIVO ── */}
                        <div className={cn(
                            "flex-1 bg-background relative overflow-hidden",
                            mobileView === 'detail' ? 'flex flex-col' : 'hidden lg:flex lg:flex-col'
                        )}>
                            {showPOS ? (
                                <PuntoDeVenta
                                    onClose={() => { setShowPOS(false); setMobileView('orders') }}
                                    onCreated={handlePedidoManualCreado}
                                    sucursalActivaId={sucursalActivaId}
                                />
                            ) : showOrderMap ? (
                                <OrderMapView
                                    orders={activeOrders}
                                    onClose={() => { setShowOrderMap(false); setMobileView('orders') }}
                                    externalSelected={selectedUnifiedPedido}
                                    onSelectPedido={(pedido) => setSelectedUnifiedPedido(pedido)}
                                    onAprobarPago={handleAprobarPago}
                                    onNotificar={handleNotificarCliente}
                                    onDespachar={(pedido) => handleDespachar(pedido.tipo, pedido.id)}
                                    updatingPago={updatingPago}
                                    sendingNotification={sendingNotification}
                                    asignandoRepartidor={asignandoRepartidor}
                                    onShowOrdersList={() => setShowMobileOrdersSheet(true)}
                                />
                            ) : selectedUnifiedPedido ? (
                                <div className="flex h-full w-full overflow-hidden">
                                <div className="flex flex-col h-full relative flex-1 min-w-0 xl:flex-none xl:w-[640px]">

                                    {/* --- DETALLE UNIFICADO: ticket angosto en una sola columna (mobile y desktop) --- */}
                                    <div className="flex-1 overflow-y-auto">
                                        <div className="w-full max-w-[600px] px-5 lg:px-6 pt-6 pb-40">

                                            {/* Tipo */}
                                            <div className="flex items-center justify-between mb-6">
                                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                                    {selectedUnifiedPedido.tipo === 'delivery' ? <Truck className="h-3.5 w-3.5" /> : <ShoppingBag className="h-3.5 w-3.5" />}
                                                    {selectedUnifiedPedido.tipo === 'delivery' ? 'Delivery' : 'Takeaway'}
                                                </span>
                                            </div>

                                            {/* Identidad: quién y dónde — orden de lectura del ticket */}
                                            <div className="mb-6 text-left">
                                                <h2 className="text-4xl font-black text-foreground tracking-tight leading-none">Pedido #{selectedUnifiedPedido.id}</h2>
                                                {selectedUnifiedPedido.nombreCliente && (
                                                    <p className="mt-3 text-xl font-bold text-foreground leading-snug">{selectedUnifiedPedido.nombreCliente}</p>
                                                )}
                                                <div className="mt-2 space-y-1.5">
                                                    {selectedUnifiedPedido.tipo === 'delivery' ? (
                                                        selectedUnifiedPedido.direccion && (
                                                            <p className="flex items-start justify-start gap-2 text-base font-semibold text-foreground leading-snug">
                                                                <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                                                                <span>{selectedUnifiedPedido.direccion}</span>
                                                            </p>
                                                        )
                                                    ) : (
                                                        <p className="flex items-center justify-start gap-2 text-base font-semibold text-foreground">
                                                            <Store className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                            Retira en el local
                                                        </p>
                                                    )}
                                                    {selectedUnifiedPedido.telefono && (
                                                        <a href={`tel:${selectedUnifiedPedido.telefono}`} className="flex items-center justify-start gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
                                                            <Phone className="h-3.5 w-3.5 shrink-0" />{selectedUnifiedPedido.telefono}
                                                        </a>
                                                    )}
                                                    <p className="flex items-center justify-start gap-2 text-sm text-muted-foreground">
                                                        <Clock className="h-3.5 w-3.5 shrink-0" />
                                                        {getDateLabel(selectedUnifiedPedido.createdAt)}, {formatPedidoTime(selectedUnifiedPedido.createdAt)}
                                                        <span className="opacity-60">· {formatTimeAgo(selectedUnifiedPedido.createdAt)}</span>
                                                    </p>
                                                </div>

                                                {selectedUnifiedPedido.horarioProgramado && (
                                                    <div className="mt-4 inline-flex items-center gap-3 rounded-2xl bg-muted/40 border border-border/60 p-3 text-left">
                                                        <CalendarDays className="h-5 w-5 text-muted-foreground shrink-0" />
                                                        <div>
                                                            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Programado para las</p>
                                                            <p className="text-2xl font-black text-foreground leading-tight tracking-tight">{selectedUnifiedPedido.horarioProgramado}</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Contexto del cliente — solo hasta lg; en xl se muestra en la columna derecha, arriba del mapa */}
                                            {clienteContexto && (
                                                <div className="mb-6 space-y-4 xl:hidden">
                                                    <Separator className="bg-border/60" />
                                                    <ClienteContextoLine ctx={clienteContexto} />
                                                    <Separator className="bg-border/60" />
                                                </div>
                                            )}

                                            {/* Cobro (si no está pagado). El botón "Cobrar" para métodos ya elegidos vive
                                                solo en el footer; acá quedan únicamente las opciones de verificación manual. */}
                                            {!selectedUnifiedPedido.pagado && selectedUnifiedPedido.estado !== 'archived' && !pedidoCobroManualYaElegido(selectedUnifiedPedido.metodoPago) && (
                                                <div className="mb-6">
                                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
                                                        Verificar y cobrar
                                                    </p>
                                                    <div className="flex gap-3">
                                                        <Button
                                                            variant="outline"
                                                            className="flex-1 h-12 rounded-xl bg-transparent border-border hover:bg-muted text-sm font-semibold shadow-sm"
                                                            onClick={() => handleAprobarPago(selectedUnifiedPedido, 'efectivo')}
                                                            disabled={updatingPago === selectedUnifiedPedido.id.toString()}
                                                        >
                                                            {updatingPago === selectedUnifiedPedido.id.toString() ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <span className="mr-1.5 text-lg">💵</span>}
                                                            Efectivo
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            className="flex-1 h-12 rounded-xl bg-transparent border-border hover:bg-muted text-sm font-semibold shadow-sm"
                                                            onClick={() => handleAprobarPago(selectedUnifiedPedido, 'transferencia')}
                                                            disabled={updatingPago === selectedUnifiedPedido.id.toString()}
                                                        >
                                                            {updatingPago === selectedUnifiedPedido.id.toString() ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <span className="mr-1.5 text-lg">🏦</span>}
                                                            Transf.
                                                        </Button>
                                                    </div>
                                                    {(() => {
                                                        const b = metodoPagoListBadge(selectedUnifiedPedido.metodoPago)
                                                        if (!b) return null
                                                        return (
                                                            <p className="mt-2 text-xs text-muted-foreground">
                                                                Método elegido por el cliente: <span className="font-semibold text-foreground">{b.label}</span>
                                                            </p>
                                                        )
                                                    })()}
                                                </div>
                                            )}

                                            {/* Confirmar con demora — slider */}
                                            {restauranteStore?.modoConfirmacionManual && selectedUnifiedPedido.notificarWhatsapp && selectedUnifiedPedido.telefono && selectedUnifiedPedido.estado !== 'archived' && (
                                                <div className="mb-6 space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Confirmar al cliente</p>
                                                        {selectedUnifiedPedido.demoraMinutos != null && (
                                                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-muted px-2 py-0.5 rounded-full">
                                                                <CheckCircle className="h-3 w-3" /> {selectedUnifiedPedido.demoraMinutos} min
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-3">
                                                        <div className="flex items-baseline justify-between">
                                                            <span className="text-xs text-muted-foreground">Demora</span>
                                                            {(() => {
                                                                const val = parseInt(demoraInputs[selectedUnifiedPedido.id.toString()] ?? '30', 10)
                                                                return val === 0
                                                                    ? <span className="text-sm font-bold text-muted-foreground">Lo antes posible</span>
                                                                    : <span className="text-2xl font-black text-[#FF7A00] leading-none">{val}<span className="text-xs font-semibold ml-1 text-muted-foreground">min</span></span>
                                                            })()}
                                                        </div>
                                                        <Slider
                                                            min={0}
                                                            max={120}
                                                            step={5}
                                                            value={[parseInt(demoraInputs[selectedUnifiedPedido.id.toString()] ?? '30', 10)]}
                                                            onValueChange={([val]) => setDemoraInputs(prev => ({ ...prev, [selectedUnifiedPedido.id.toString()]: String(val) }))}
                                                            className="[&_[data-slot=slider-range]]:bg-[#FF7A00] [&_[data-slot=slider-thumb]]:border-[#FF7A00] [&_[data-slot=slider-thumb]]:size-5"
                                                        />
                                                        <div className="flex justify-between text-[10px] text-muted-foreground">
                                                            <span>0</span>
                                                            <span>60 min</span>
                                                            <span>120 min</span>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        className="w-full h-12 rounded-xl bg-[#FF7A00] hover:bg-[#E66E00] text-white font-bold"
                                                        onClick={() => handleConfirmarConDemora(selectedUnifiedPedido)}
                                                        disabled={confirmandoDemora === selectedUnifiedPedido.id.toString()}
                                                    >
                                                        {confirmandoDemora === selectedUnifiedPedido.id.toString()
                                                            ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                            : <MessageCircle className="h-4 w-4 mr-2" />}
                                                        {selectedUnifiedPedido.demoraMinutos != null ? 'Reenviar' : 'Confirmar y avisar por WhatsApp'}
                                                    </Button>
                                                </div>
                                            )}

                                            {/* Nota del cliente — fondo sutil, sin label naranja a gritos */}
                                            {selectedUnifiedPedido.notas && (
                                                <div className="mb-6 rounded-2xl bg-muted/50 border border-border/60 p-4">
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Nota del cliente</p>
                                                    <p className="text-sm text-foreground leading-snug">{selectedUnifiedPedido.notas}</p>
                                                </div>
                                            )}

                                            <Separator className="bg-border/60 mb-6" />

                                            {/* Comanda */}
                                            <div className="mb-6">
                                                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Comanda · {selectedUnifiedPedido.totalItems} ítems</h3>
                                                <div className="space-y-0">
                                                    {selectedUnifiedPedido.grupal ? (
                                                        Object.entries(
                                                            selectedUnifiedPedido.items.reduce((acc, item) => {
                                                                const key = item.clienteNombre || 'Sin nombre'
                                                                if (!acc[key]) acc[key] = []
                                                                acc[key].push(item)
                                                                return acc
                                                            }, {} as Record<string, DeliveryItem[]>)
                                                        ).map(([cliente, clienteItems], gIdx) => (
                                                            <div key={cliente} className={gIdx > 0 ? 'mt-4 pt-4 border-t border-border/60' : ''}>
                                                                <p className="text-[11px] font-bold text-foreground uppercase tracking-widest flex items-center gap-1 mb-2">
                                                                    <User className="h-3 w-3" />{cliente}
                                                                </p>
                                                                {clienteItems.map((item, idx) => {
                                                                    const lineTotal = parseFloat(item.precioUnitario || '0') * item.cantidad
                                                                    return (
                                                                        <div key={idx} className={`flex items-start justify-between gap-3 py-3 ${idx > 0 ? 'border-t border-border/40' : ''}`}>
                                                                            <div className="flex gap-3 flex-1 min-w-0">
                                                                                <span className="font-bold text-base text-muted-foreground w-6 shrink-0 tabular-nums">{item.cantidad}x</span>
                                                                                <div className="min-w-0">
                                                                                    <p className="font-semibold text-base text-foreground leading-snug">
                                                                                        {item.nombreProducto}{item.varianteNombre && <span className="text-muted-foreground font-medium"> ({item.varianteNombre})</span>}
                                                                                    </p>
                                                                                    {formatAgregados(item.agregados).length > 0 && (
                                                                                        <div className="mt-1 space-y-0.5">
                                                                                            {formatAgregados(item.agregados).map((ag: any, i: number) => (
                                                                                                <p key={i} className="text-sm text-muted-foreground"><span className="text-emerald-500 font-bold mr-1.5">+</span>{ag.nombre}</p>
                                                                                            ))}
                                                                                        </div>
                                                                                    )}
                                                                                    {item.ingredientesExcluidosNombres && item.ingredientesExcluidosNombres.length > 0 && (
                                                                                        <div className="mt-1 space-y-0.5">
                                                                                            {item.ingredientesExcluidosNombres.map((nombre, i) => (
                                                                                                <p key={i} className="text-sm text-muted-foreground">Sin {nombre}</p>
                                                                                            ))}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                            <span className="font-semibold text-base tabular-nums text-foreground shrink-0">
                                                                                ${lineTotal.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                                                            </span>
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        ))
                                                    ) : (
                                                        selectedUnifiedPedido.items.map((item, idx) => {
                                                            const lineTotal = parseFloat(item.precioUnitario || '0') * item.cantidad
                                                            return (
                                                                <div key={idx} className={`flex items-start justify-between gap-3 py-3 ${idx > 0 ? 'border-t border-border/40' : ''}`}>
                                                                    <div className="flex gap-3 flex-1 min-w-0">
                                                                        <span className="font-bold text-base text-muted-foreground w-6 shrink-0 tabular-nums">{item.cantidad}x</span>
                                                                        <div className="min-w-0">
                                                                            <p className="font-semibold text-base text-foreground leading-snug">
                                                                                {item.nombreProducto}{item.varianteNombre && <span className="text-muted-foreground font-medium"> ({item.varianteNombre})</span>}
                                                                            </p>
                                                                            {formatAgregados(item.agregados).length > 0 && (
                                                                                <div className="mt-1 space-y-0.5">
                                                                                    {formatAgregados(item.agregados).map((ag: any, i: number) => (
                                                                                        <p key={i} className="text-sm text-muted-foreground"><span className="text-emerald-500 font-bold mr-1.5">+</span>{ag.nombre}</p>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                            {item.ingredientesExcluidosNombres && item.ingredientesExcluidosNombres.length > 0 && (
                                                                                <div className="mt-1 space-y-0.5">
                                                                                    {item.ingredientesExcluidosNombres.map((nombre, i) => (
                                                                                        <p key={i} className="text-sm text-muted-foreground">Sin {nombre}</p>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <span className="font-semibold text-base tabular-nums text-foreground shrink-0">
                                                                        ${lineTotal.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                                                    </span>
                                                                </div>
                                                            )
                                                        })
                                                    )}

                                                    {selectedUnifiedPedido.tipo === 'delivery' && (
                                                        <div className="flex items-center justify-between gap-3 py-3 border-t border-border/40 text-muted-foreground">
                                                            <span className="text-sm flex items-center gap-2"><Truck className="h-4 w-4" /> Costo de envío</span>
                                                            <span className="text-sm font-medium tabular-nums">${getOrderDeliveryFee(selectedUnifiedPedido).toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
                                                        </div>
                                                    )}
                                                    {pedidoTieneCuponDescuento(selectedUnifiedPedido) && (
                                                        <div className="flex items-center justify-between gap-3 py-3 border-t border-border/40 text-muted-foreground">
                                                            <span className="text-sm flex items-center gap-2"><Tag className="h-4 w-4" /> {selectedUnifiedPedido.codigoDescuentoCodigo || 'Cupón de descuento'}</span>
                                                            <span className="text-sm font-medium tabular-nums">-${parseFloat(String(selectedUnifiedPedido.montoDescuento)).toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Reimprimir comprobante */}
                                            {selectedPrinter && (
                                                <div className="flex justify-center">
                                                    <Button variant="ghost" className="text-muted-foreground border border-border bg-background" onClick={() => {
                                                        const itemsToPrint = selectedUnifiedPedido.items.map((item: any) => ({ ...item, precioUnitario: item.precioUnitario || '0' }))
                                                        const deliveryFee = selectedUnifiedPedido.tipo === 'delivery' ? getOrderDeliveryFee(selectedUnifiedPedido) : 0
                                                        const data = formatComanda({
                                                            id: selectedUnifiedPedido.id,
                                                            nombrePedido: selectedUnifiedPedido.nombreCliente || '',
                                                            telefono: selectedUnifiedPedido.telefono,
                                                            direccion: selectedUnifiedPedido.tipo === 'delivery' ? selectedUnifiedPedido.direccion : undefined,
                                                            tipo: selectedUnifiedPedido.tipo,
                                                            total: selectedUnifiedPedido.total,
                                                            deliveryFee,
                                                            notas: selectedUnifiedPedido.notas,
                                                            montoDescuento: selectedUnifiedPedido.montoDescuento,
                                                            sucursalNombre: selectedUnifiedPedido.sucursalNombre,
                                                            horarioProgramado: selectedUnifiedPedido.horarioProgramado,
                                                            grupal: selectedUnifiedPedido.grupal,
                                                        }, itemsToPrint, restaurante?.nombre || 'Restaurante')
                                                        printRaw(commandsToBytes(data))
                                                    }}>
                                                        <Printer className="mr-2 h-4 w-4" /> Reimprimir Comprobante
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Footer sticky: total (única aparición) + acción. Anclado al panel, no fixed. */}
                                    <div className="absolute bottom-0 left-0 right-0 z-40 bg-background border-t border-border/50">
                                        <div className="w-full max-w-[600px] px-5 lg:px-6 pt-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] flex flex-col gap-3">
                                            <div className="flex items-baseline justify-between gap-3">
                                                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
                                                    {selectedUnifiedPedido.pagado ? 'Total cobrado' : 'Total a cobrar'}
                                                </span>
                                                <span className="text-3xl font-black tracking-tight text-[#FF7A00]">
                                                    ${computeOrderTotal(selectedUnifiedPedido).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                                </span>
                                            </div>
                                            {selectedUnifiedPedido.estado !== 'archived' && (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => setShowDeleteDialog(true)}
                                                        className="h-14 w-14 rounded-2xl bg-secondary/30 border border-border/50 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0 cursor-pointer"
                                                    >
                                                        <Trash2 className="h-5 w-5" />
                                                    </button>
                                                    {selectedUnifiedPedido.pagado && (
                                                        <button
                                                            onClick={() => handleNotificarCliente(selectedUnifiedPedido)}
                                                            disabled={sendingNotification === selectedUnifiedPedido.id.toString()}
                                                            className="h-14 w-14 rounded-2xl bg-secondary/30 border border-border/50 flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
                                                        >
                                                            {sendingNotification === selectedUnifiedPedido.id.toString()
                                                                ? <Loader2 className="h-5 w-5 animate-spin" />
                                                                : <MessageCircle className="h-5 w-5" />}
                                                        </button>
                                                    )}
                                                    <Button
                                                        className={cn("flex-1 h-14 rounded-2xl text-white font-bold text-lg transition-all active:scale-[0.98]", selectedUnifiedPedido.pagado ? "bg-[#FF7A00] hover:bg-[#E66E00]" : "bg-emerald-600 hover:bg-emerald-700")}
                                                        onClick={() => {
                                                            if (selectedUnifiedPedido.pagado) void handleDespachar(selectedUnifiedPedido.tipo, selectedUnifiedPedido.id)
                                                            else if (pedidoCobroManualYaElegido(selectedUnifiedPedido.metodoPago)) void handleAprobarPago(selectedUnifiedPedido)
                                                            else toast.error('Debes verificar el pago primero')
                                                        }}
                                                        disabled={
                                                            updatingPago === selectedUnifiedPedido.id.toString()
                                                            || (!selectedUnifiedPedido.pagado && !pedidoCobroManualYaElegido(selectedUnifiedPedido.metodoPago))
                                                        }
                                                    >
                                                        {updatingPago === selectedUnifiedPedido.id.toString() ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : null}
                                                        {selectedUnifiedPedido.pagado
                                                            ? 'Despachar Pedido'
                                                            : pedidoCobroManualYaElegido(selectedUnifiedPedido.metodoPago)
                                                                ? 'Cobrar'
                                                                : 'Pendiente de Cobro'}
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                </div>

                                {/* ── TERCERA COLUMNA: DETALLE DEL CLIENTE + MINI MAPA DE PEDIDOS (solo desktop amplio) ── */}
                                <div className="hidden xl:flex flex-1 flex-col items-center justify-center p-6 bg-background">
                                    <div className="w-full max-w-[560px]">
                                        {/* Detalle del cliente — arriba del mapa, con borde inferior separador */}
                                        {clienteContexto && (
                                            <div className="mb-5 pb-5 border-b border-border/60">
                                                <ClienteContextoLine ctx={clienteContexto} />
                                            </div>
                                        )}
                                        <h3 className="flex items-center gap-2 text-lg font-bold text-foreground mb-3">
                                            <span>📍</span> Ubicación
                                        </h3>
                                        <div className="w-full aspect-[16/10] rounded-2xl overflow-hidden border border-border shadow-lg relative bg-background">
                                            <OrderMiniMap orders={activeOrders} selected={selectedUnifiedPedido} />
                                        </div>

                                        {/* Checklist de Progreso */}
                                        <div className="mt-8">
                                            <h3 className="flex items-center gap-2 text-lg font-bold text-foreground mb-4">
                                                <span>📋</span> Seguimiento
                                            </h3>
                                            <div>
                                                <div className="flex flex-col gap-5">
                                                    {[
                                                        { label: 'Pedido tomado', checked: true },
                                                        { label: 'Pago confirmado', checked: !!selectedUnifiedPedido.pagado },
                                                        { label: 'Cliente notificado', checked: selectedUnifiedPedido.demoraMinutos != null || selectedUnifiedPedido.estado === 'archived' },
                                                        { label: 'Pedido despachado', checked: selectedUnifiedPedido.estado === 'archived' },
                                                    ].map((step, idx, arr) => (
                                                        <div key={idx} className="flex items-center gap-4 relative">
                                                            {idx !== arr.length - 1 && (
                                                                <div className={cn(
                                                                    "absolute left-[13px] top-7 h-5 w-[2px]",
                                                                    step.checked && arr[idx + 1].checked ? "bg-emerald-500" : "bg-border"
                                                                )} />
                                                            )}
                                                            
                                                            <div className={cn(
                                                                "h-7 w-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 z-10",
                                                                step.checked 
                                                                    ? "bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]" 
                                                                    : "bg-muted border border-border text-muted-foreground/30"
                                                            )}>
                                                                {step.checked ? <CheckCircle className="h-4 w-4" /> : <div className="h-1.5 w-1.5 rounded-full bg-current" />}
                                                            </div>
                                                            
                                                            <span className={cn(
                                                                "text-sm font-bold transition-colors duration-300",
                                                                step.checked ? "text-foreground" : "text-muted-foreground"
                                                            )}>
                                                                {step.label}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                </div>
                            ) : (
                                <OnboardingChecklist
                                    totalPedidos={totalPedidos}
                                    restauranteStore={restauranteStore}
                                    restauranteId={restaurante?.id ?? 0}
                                    publicUrl={publicUrl}
                                />
                            )}
                        </div>
                    </>
                ) : (
                    /* ── PANTALLA NUEVO PEDIDO MANUAL ── */
                    <div className="flex-1 p-4 flex flex-col items-center justify-center bg-background">
                        <div className="max-w-md w-full bg-card p-8 rounded-[32px] border border-border shadow-sm text-center">
                            <Plus className="h-12 w-12 text-[#FF7A00] mx-auto mb-4" />
                            <h2 className="text-2xl font-bold mb-2">Crear Pedido Manual</h2>
                            <p className="text-muted-foreground mb-8">Esta función es para cargar un pedido que tomaste por teléfono o mostrador rápidamente.</p>
                            <Button size="lg" className="w-full h-14 rounded-2xl bg-[#FF7A00] hover:bg-[#E66E00] text-white font-bold" onClick={() => toast.info('Abre el catálogo para agregar productos aquí')}>
                                Abrir Catálogo (Próximamente)
                            </Button>
                            <Button variant="ghost" className="w-full mt-2 h-14 rounded-2xl font-semibold" onClick={() => setDashboardMode('orders')}>
                                Volver a pedidos
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── MOBILE ORDERS BOTTOM SHEET ── */}
            {showMobileOrdersSheet && (
                <div className="fixed inset-0 z-[9999] lg:hidden" onClick={() => setShowMobileOrdersSheet(false)}>
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                    <div
                        className="absolute bottom-0 left-0 right-0 bg-background rounded-t-3xl flex flex-col"
                        style={{ maxHeight: '72vh' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex justify-center pt-3 pb-1 shrink-0">
                            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
                        </div>
                        <div className="px-5 py-3 border-b border-border flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-base">Pedidos activos</span>
                                <Badge className="bg-[#FF7A00] hover:bg-[#FF7A00] text-white rounded-full px-2 py-0 text-[10px]">
                                    {activeOrders.length}
                                </Badge>
                            </div>
                            <button
                                onClick={() => setShowMobileOrdersSheet(false)}
                                className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-accent text-muted-foreground"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-safe">
                            {activeOrders.length === 0 ? (
                                <div className="text-center py-10 text-muted-foreground text-sm">
                                    <Receipt className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                    No hay pedidos activos
                                </div>
                            ) : (
                                activeOrders.map(pedido => {
                                    const isSelected = selectedUnifiedPedido?.id === pedido.id && selectedUnifiedPedido?.tipo === pedido.tipo
                                    const pagoBadge = metodoPagoListBadge(pedido.metodoPago)
                                    return (
                                        <div
                                            key={`sheet-${pedido.tipo}-${pedido.id}`}
                                            onClick={() => {
                                                setSelectedUnifiedPedido(pedido)
                                                setShowMobileOrdersSheet(false)
                                            }}
                                            className={cn(
                                                "flex items-center justify-between p-3 rounded-xl border cursor-pointer active:scale-[0.99] transition-all",
                                                isSelected
                                                    ? "bg-[#FF7A00]/10 border-[#FF7A00]/30"
                                                    : "bg-muted/20 border-border hover:bg-muted/40"
                                            )}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-bold text-sm">#{pedido.id}</span>
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                                                        {pedido.tipo === 'delivery' ? <Truck className="h-3 w-3" /> : <ShoppingBag className="h-3 w-3" />}
                                                        {pedido.tipo === 'delivery' ? 'Delivery' : 'Takeaway'}
                                                    </span>
                                                    {!pedido.pagado && (
                                                        <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400">Sin cobrar</span>
                                                    )}
                                                    {pagoBadge && (
                                                        <Badge variant="outline" className={cn("text-[9px] px-1 py-0 h-4 border-none", pagoBadge.className)}>
                                                            {pagoBadge.icon && <span className="mr-0.5">{pagoBadge.icon}</span>}{pagoBadge.label}
                                                        </Badge>
                                                    )}
                                                </div>
                                                {pedido.nombreCliente && (
                                                    <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">{pedido.nombreCliente}</p>
                                                )}
                                                {pedido.tipo === 'delivery' && pedido.direccion && (
                                                    <p className="text-[11px] text-muted-foreground truncate max-w-[200px] flex items-center gap-1 mt-0.5">
                                                        <MapPin className="h-2.5 w-2.5 shrink-0" />{pedido.direccion}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="text-right shrink-0 ml-3">
                                                <span className="font-black text-sm">
                                                    ${computeOrderTotal(pedido).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                                </span>
                                                <p className="text-[10px] text-muted-foreground mt-0.5">{formatTimeAgo(pedido.createdAt)}</p>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── DIÁLOGO ELIMINAR ── */}
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent className="max-w-sm rounded-[32px] p-6 sm:p-8 border border-border bg-background text-center">
                    <div className="h-16 w-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Trash2 className="h-8 w-8 text-red-500" />
                    </div>
                    <DialogTitle className="text-2xl font-bold mb-2 text-center">¿Eliminar pedido?</DialogTitle>
                    <DialogDescription className="text-base text-center mb-8">
                        Esta acción es irreversible. El pedido desaparecerá del sistema.
                    </DialogDescription>
                    <div className="flex gap-3">
                        <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold border-border" onClick={() => setShowDeleteDialog(false)}>Cancelar</Button>
                        <Button variant="destructive" className="flex-1 h-12 rounded-xl font-bold" onClick={handleDeletePedido}>Eliminar</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── MODAL MÉTODOS DE PAGO ── */}
            <Dialog open={metodosPagoModalOpen} onOpenChange={setMetodosPagoModalOpen}>
                <DialogContent className="max-w-md mx-4 max-h-[90vh] overflow-y-auto rounded-[32px] p-6 sm:p-8 bg-background border border-border">
                    <DialogHeader className="mb-6 text-left">
                        <div className="h-12 w-12 bg-orange-500/10 rounded-2xl flex items-center justify-center mb-4">
                            <Settings className="h-6 w-6 text-[#FF7A00]" />
                        </div>
                        <DialogTitle className="text-2xl font-bold">Métodos de pago</DialogTitle>
                        <DialogDescription className="text-sm mt-1">
                            Configurá qué medios de pago ofreces en tu link en vivo.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6">
                        <div>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Automáticos (Mercado Pago)</p>
                            <div className="space-y-4">
                                <div className="flex items-start justify-between gap-4 p-4 rounded-2xl border border-border bg-muted/20">
                                    <div className="flex-1 space-y-1">
                                        <Label htmlFor="cfg-mp-co" className="text-sm font-bold flex items-center gap-2"><CreditCard className="h-4 w-4 text-[#009EE3]" /> Mercado Pago Checkout</Label>
                                        <p className="text-xs text-muted-foreground">Redirige a la app de MP. Ideal para pagar con dinero en cuenta.</p>
                                    </div>
                                    <Switch id="cfg-mp-co" checked={cfgMpCheckout} onCheckedChange={setCfgMpCheckout} />
                                </div>
                                <div className="flex items-start justify-between gap-4 p-4 rounded-2xl border border-border bg-muted/20">
                                    <div className="flex-1 space-y-1">
                                        <Label htmlFor="cfg-mp-br" className="text-sm font-bold flex items-center gap-2"><CreditCard className="h-4 w-4 text-[#009EE3]" /> Mercado Pago Tarjetas</Label>
                                        <p className="text-xs text-muted-foreground">Formulario embebido. El cliente paga con tarjeta sin salir de tu menú.</p>
                                    </div>
                                    <Switch id="cfg-mp-br" checked={cfgMpBricks} onCheckedChange={setCfgMpBricks} />
                                </div>
                            </div>
                        </div>

                        <div>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Automáticos (Transferencias)</p>
                            <div className="space-y-4">
                                <div className="flex items-start justify-between gap-4 p-4 rounded-2xl border border-border bg-muted/20">
                                    <div className="flex-1 space-y-1">
                                        <Label htmlFor="cfg-tf-au" className="text-sm font-bold flex items-center gap-2"><Zap className="h-4 w-4 text-amber-500" /> Transf. Automática</Label>
                                        <p className="text-xs text-muted-foreground">Vía Cucuru o Talo (si están configurados en Perfil).</p>
                                    </div>
                                    <Switch id="cfg-tf-au" checked={cfgTfAuto} onCheckedChange={setCfgTfAuto} />
                                </div>
                            </div>
                        </div>

                        <div>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Manuales</p>
                            <div className="space-y-4">
                                <div className="flex items-start justify-between gap-4 p-4 rounded-2xl border border-border bg-muted/20">
                                    <div className="flex-1 space-y-1">
                                        <Label htmlFor="cfg-tf-man" className="text-sm font-bold flex items-center gap-2"><Wallet className="h-4 w-4 text-muted-foreground" /> Transf. Manual (Alias)</Label>
                                        <p className="text-xs text-muted-foreground">Mostrás tu CBU/Alias y verificás a mano.</p>
                                        {cfgTfManual && (
                                            <Input id="cfg-alias" value={cfgAlias} onChange={(e) => setCfgAlias(e.target.value)} placeholder="Tu alias..." className="h-10 mt-3 rounded-xl bg-background font-mono text-sm" />
                                        )}
                                    </div>
                                    <Switch id="cfg-tf-man" checked={cfgTfManual} onCheckedChange={setCfgTfManual} />
                                </div>
                                <div className="flex items-start justify-between gap-4 p-4 rounded-2xl border border-border bg-muted/20">
                                    <div className="flex-1 space-y-1">
                                        <Label htmlFor="cfg-cash" className="text-sm font-bold">Efectivo</Label>
                                        <p className="text-xs text-muted-foreground">
                                            Podés ofrecerlo junto a Mercado Pago y transferencias automáticas. El cliente elige al pagar; el pedido entra en el panel para cobrar en caja.
                                        </p>
                                    </div>
                                    <Switch id="cfg-cash" checked={cfgEfectivo} onCheckedChange={setCfgEfectivo} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="mt-8 gap-3 sm:gap-0">
                        <Button type="button" variant="ghost" onClick={() => setMetodosPagoModalOpen(false)} disabled={savingMetodosPago} className="h-12 rounded-xl font-semibold border border-border">
                            Cancelar
                        </Button>
                        <Button type="button" onClick={() => void saveMetodosPago()} disabled={savingMetodosPago} className="h-12 rounded-xl font-bold bg-[#FF7A00] hover:bg-[#E66E00] text-white">
                            {savingMetodosPago ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Guardar Configuración
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── MODAL REPARTIDORES ── */}
            <Dialog open={repartidoresModalOpen} onOpenChange={setRepartidoresModalOpen}>
                <DialogContent className="max-w-md mx-4 max-h-[90vh] overflow-y-auto rounded-[32px] p-6 sm:p-8 bg-background border border-border">
                    <DialogHeader className="mb-6 text-left">
                        <div className="h-12 w-12 bg-orange-500/10 rounded-2xl flex items-center justify-center mb-4">
                            <UserRound className="h-6 w-6 text-[#FF7A00]" />
                        </div>
                        <DialogTitle className="text-2xl font-bold">Repartidores</DialogTitle>
                        <DialogDescription className="text-sm mt-1">
                            Gestioná los repartidores de tu negocio.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5">
                        {/* Crear nuevo */}
                        <div className="flex gap-2">
                            <Input
                                placeholder="Nombre del repartidor..."
                                value={nuevoRepartidorNombre}
                                onChange={e => setNuevoRepartidorNombre(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && nuevoRepartidorNombre.trim()) {
                                        void (async () => {
                                            if (!token || creandoRepartidor) return
                                            setCreandoRepartidor(true)
                                            try {
                                                const res: any = await repartidoresApi.create(token, nuevoRepartidorNombre.trim())
                                                if (res.success) {
                                                    setRepartidoresList(prev => [...prev, res.data])
                                                    setNuevoRepartidorNombre('')
                                                }
                                            } catch { toast.error('Error al crear repartidor') }
                                            finally { setCreandoRepartidor(false) }
                                        })()
                                    }
                                }}
                                className="flex-1 h-10 rounded-xl"
                            />
                            <Button
                                className="h-10 px-4 rounded-xl bg-[#FF7A00] hover:bg-[#E66E00] text-white font-bold"
                                disabled={creandoRepartidor || !nuevoRepartidorNombre.trim()}
                                onClick={async () => {
                                    if (!token || creandoRepartidor) return
                                    setCreandoRepartidor(true)
                                    try {
                                        const res: any = await repartidoresApi.create(token, nuevoRepartidorNombre.trim())
                                        if (res.success) {
                                            setRepartidoresList(prev => [...prev, res.data])
                                            setNuevoRepartidorNombre('')
                                        }
                                    } catch { toast.error('Error al crear repartidor') }
                                    finally { setCreandoRepartidor(false) }
                                }}
                            >
                                {creandoRepartidor ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            </Button>
                        </div>

                        {loadingRepartidores ? (
                            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                        ) : (
                            <>
                                {/* Activos */}
                                {repartidoresList.filter(r => r.estado === 'activo').length > 0 && (
                                    <div>
                                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                            <UserCheck className="h-3.5 w-3.5 text-emerald-500" /> Activos
                                        </p>
                                        <div className="space-y-2">
                                            {repartidoresList.filter(r => r.estado === 'activo').map(r => (
                                                <div key={r.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20">
                                                    <span className="font-semibold text-sm">{r.nombre}</span>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 text-xs text-muted-foreground hover:text-red-500"
                                                        onClick={async () => {
                                                            if (!token) return
                                                            try {
                                                                await repartidoresApi.toggleEstado(token, r.id, 'inactivo')
                                                                setRepartidoresList(prev => prev.map(x => x.id === r.id ? { ...x, estado: 'inactivo' } : x))
                                                            } catch { toast.error('Error al actualizar') }
                                                        }}
                                                    >
                                                        Desactivar
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Inactivos */}
                                {repartidoresList.filter(r => r.estado === 'inactivo').length > 0 && (
                                    <div>
                                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                            <UserX className="h-3.5 w-3.5 text-muted-foreground" /> Inactivos
                                        </p>
                                        <div className="space-y-2">
                                            {repartidoresList.filter(r => r.estado === 'inactivo').map(r => (
                                                <div key={r.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20 opacity-60">
                                                    <span className="text-sm">{r.nombre}</span>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 text-xs text-emerald-600 hover:text-emerald-700"
                                                        onClick={async () => {
                                                            if (!token) return
                                                            try {
                                                                await repartidoresApi.toggleEstado(token, r.id, 'activo')
                                                                setRepartidoresList(prev => prev.map(x => x.id === r.id ? { ...x, estado: 'activo' } : x))
                                                            } catch { toast.error('Error al actualizar') }
                                                        }}
                                                    >
                                                        Activar
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {repartidoresList.length === 0 && (
                                    <div className="text-center py-8 text-muted-foreground text-sm">
                                        No hay repartidores. Agregá el primero.
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── SELECTOR DE REPARTIDOR AL DESPACHAR ── */}
            <Dialog open={repartidorSelectorOpen} onOpenChange={(open) => {
                if (!open) { setPendingDispatchPedido(null); setRepartidorSelectorOpen(false) }
            }}>
                <DialogContent className="max-w-sm mx-4 rounded-[32px] p-6 bg-background border border-border">
                    <DialogHeader className="mb-4 text-left">
                        <div className="h-12 w-12 bg-orange-500/10 rounded-2xl flex items-center justify-center mb-3">
                            <Truck className="h-6 w-6 text-[#FF7A00]" />
                        </div>
                        <DialogTitle className="text-xl font-bold">¿Quién hace el envío?</DialogTitle>
                        <DialogDescription className="text-sm mt-1">
                            Seleccioná el repartidor o despachá sin asignar.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        {repartidoresList.filter(r => r.estado === 'activo').map(r => (
                            <button
                                key={r.id}
                                disabled={asignandoRepartidor}
                                onClick={() => {
                                    if (!pendingDispatchPedido) return
                                    const { tipo, id } = pendingDispatchPedido
                                    void handleRepartidorSelected(tipo, id, r.id)
                                }}
                                className="w-full flex items-center gap-3 p-4 rounded-2xl border border-border bg-card hover:bg-accent hover:border-[#FF7A00]/40 transition-all text-left font-semibold disabled:opacity-50 cursor-pointer"
                            >
                                <div className="h-9 w-9 rounded-full bg-[#FF7A00]/10 flex items-center justify-center shrink-0">
                                    <UserRound className="h-5 w-5 text-[#FF7A00]" />
                                </div>
                                {r.nombre}
                            </button>
                        ))}
                        <button
                            disabled={asignandoRepartidor}
                            onClick={() => {
                                if (!pendingDispatchPedido) return
                                const { tipo, id } = pendingDispatchPedido
                                void handleRepartidorSelected(tipo, id, null)
                            }}
                            className="w-full p-3 rounded-2xl border border-dashed border-border text-muted-foreground hover:bg-muted/40 transition-all text-sm font-medium disabled:opacity-50 cursor-pointer"
                        >
                            {asignandoRepartidor ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Despachar sin asignar repartidor'}
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            <CierreTurno open={showCierreTurno} onClose={() => setShowCierreTurno(false)} />

            <SucursalSelector
                open={showSucursalSelector && sucursalesList.filter((s) => s.activo).length > 0 && prefsReady}
                onOpenChange={setShowSucursalSelector}
                sucursalesActivas={sucursalesList.filter((s) => s.activo)}
                onSelect={(id, nombreEtiqueta) => applySucursalChoice(id, nombreEtiqueta)}
            />
        </div>
    )
}

export default Dashboard