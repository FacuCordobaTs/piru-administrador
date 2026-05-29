import { useState, useEffect, useCallback, Fragment, useMemo } from 'react'
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
import { orderEventBus } from '@/hooks/useAdminWebSocket'
import CierreTurno from '@/components/CierreTurno'
import {
    Loader2, Plus, Clock, Trash2, AlertCircle,
    User, ArrowLeft, Printer, Truck, MapPin,
    Phone, ShoppingBag, CalendarDays, Tag, Settings, CheckCircle2,
    Receipt, Wallet, Zap, CreditCard, CheckCircle,
    MessageCircle, Store, Map as MapIcon, X, UserRound, UserCheck, UserX,
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
    grupal?: boolean | null;
}
interface Repartidor { id: number; nombre: string; estado: 'activo' | 'inactivo'; restauranteId: number }

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

const getMinutesAgo = (dateString: string) => {
    const t = parseDashboardDate(dateString).getTime() + PEDIDO_RELATIVE_TIME_OFFSET_MS
    if (Number.isNaN(t)) return 0
    return Math.floor((Date.now() - t) / 60000)
}

const formatTimeAgo = (dateString: string) => {
    const minutes = getMinutesAgo(dateString)
    if (minutes < 1) return 'Ahora'
    if (minutes < 60) return `hace ${minutes} min`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `hace ${hours}h ${minutes % 60}m`
    return parseDashboardDate(dateString).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: AR_TIMEZONE })
}

const getDateLabel = (dateString: string) => {
    const eventDate = parseDashboardDate(dateString)
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    const isSameDay = (d1: Date, d2: Date) =>
        d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear()

    if (isSameDay(eventDate, today)) return 'Hoy'
    if (isSameDay(eventDate, yesterday)) return 'Ayer'
    return eventDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', timeZone: AR_TIMEZONE })
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

const OrderMapView = ({ orders, onClose }: { orders: UnifiedPedido[]; onClose: () => void }) => {
    const [selected, setSelected] = useState<UnifiedPedido | null>(null)
    const parseCoord = (v: string | null | undefined) => parseFloat(String(v || '').replace(',', '.'))

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
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {ordersWithCoords.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground p-8">
                    <MapPin className="h-12 w-12 opacity-20" />
                    <p className="text-sm font-medium text-center">Ningún pedido activo de delivery tiene ubicación guardada.</p>
                    <p className="text-xs text-center opacity-60">Las coordenadas se guardan cuando el cliente ingresa su dirección.</p>
                </div>
            ) : (
                <div className="flex-1 relative overflow-hidden">
                    <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} attributionControl={false}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <MapBoundsController positions={positions} />
                        {ordersWithCoords.map(pedido => {
                            const lat = parseCoord(pedido.latitud)
                            const lng = parseCoord(pedido.longitud)
                            const isSelected = selected?.id === pedido.id
                            const bg = isSelected ? '#E66E00' : '#FF7A00'
                            const icon = L.divIcon({
                                className: '',
                                iconSize: [56, 38],
                                iconAnchor: [28, 38],
                                html: `<div style="background:${bg};color:white;width:52px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.35);border:2px solid white;position:relative;margin:2px 2px 0"><span>#${pedido.id}</span><div style="position:absolute;bottom:-8px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:8px solid ${bg}"></div></div>`,
                            })
                            return (
                                <Marker
                                    key={`${pedido.tipo}-${pedido.id}`}
                                    position={[lat, lng]}
                                    icon={icon}
                                    eventHandlers={{ click: () => setSelected(prev => prev?.id === pedido.id ? null : pedido) }}
                                />
                            )
                        })}
                    </MapContainer>

                    {selected && (
                        <div className="absolute bottom-4 left-4 right-4 z-[1001] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
                            <div className="flex items-start justify-between p-4 pb-3 border-b border-border">
                                <div>
                                    <p className="font-black text-base text-foreground">Pedido #{selected.id}</p>
                                    {selected.nombreCliente && (
                                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                                            <User className="h-3.5 w-3.5 shrink-0" />{selected.nombreCliente}
                                        </p>
                                    )}
                                    {selected.direccion && (
                                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                            <MapPin className="h-3 w-3 shrink-0" />{selected.direccion}
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="font-black text-2xl text-[#FF7A00]">
                                        ${computeOrderTotal(selected).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                    </span>
                                    <button
                                        className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-accent text-muted-foreground"
                                        onClick={() => setSelected(null)}
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="overflow-y-auto max-h-48 p-4 space-y-2">
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
                        </div>
                    )}
                </div>
            )}
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
    const { isConnected } = useAdminContext()

    // Estados Principales
    const [unifiedPedidos, setUnifiedPedidos] = useState<UnifiedPedido[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedUnifiedPedido, setSelectedUnifiedPedido] = useState<UnifiedPedido | null>(null)

    const [updatingPago, setUpdatingPago] = useState<string | null>(null)
    const [dashboardMode, setDashboardMode] = useState<'orders' | 'nuevoPedido'>('orders')
    const [showOrderMap, setShowOrderMap] = useState(false)
    const [mobileView, setMobileView] = useState<'orders' | 'detail'>('orders')
    const [showCierreTurno, setShowCierreTurno] = useState(false)
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
        // No pagination logic needed anymore since getActivos returns all active orders
    }, [sucursalActivaId])

    // ─────────────────────────────────────────────
    // FETCH Y WEBSOCKETS
    // ─────────────────────────────────────────────
    const tryImprimirPedido = useCallback(async (pedido: UnifiedPedido) => {
        if (!selectedPrinter) return
        if (pedido.impreso) return

        try {
            const claimRes = await pedidoUnificadoApi.claimImpresion(token!, pedido.id) as any;
            if (!claimRes.success) {
                // someone else claimed it
                return;
            }

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

                await printRaw(commandsToBytes(comandaData))
                setUnifiedPedidos(prev => prev.map(p => p.id === pedido.id ? { ...p, impreso: true } : p))
            }
        } catch (e) {
            console.error('Error auto-imprimiendo:', e)
        }
    }, [selectedPrinter, token, allProductos, restaurante, printRaw])

    const hydrateActivos = useCallback(async () => {
        if (!token) return
        setIsLoading(true)

        try {
            const response = await pedidoUnificadoApi.getActivos(
                token,
                'all',
                sucursalActivaId,
            ) as any
            if (response.success && response.data) {
                const validPedidos = response.data.filter((p: any) => p.tipo === 'delivery' || p.tipo === 'takeaway') as UnifiedPedido[]
                setUnifiedPedidos(validPedidos.sort((a, b) => parseDashboardDate(b.createdAt).getTime() - parseDashboardDate(a.createdAt).getTime()))
            }
        } catch (error) {
            console.error('Error hydrating pedidos activos:', error)
        } finally {
            setIsLoading(false)
        }
    }, [token, sucursalActivaId])

    useEffect(() => {
        if (!token || !prefsReady) return
        hydrateActivos()
    }, [token, prefsReady, hydrateActivos])

    useEffect(() => {
        const unsubscribe = orderEventBus.subscribe((event) => {
            if (sucursalActivaId != null && event.sucursalId !== undefined && event.sucursalId !== sucursalActivaId) {
                return; // ignore events from other branches
            }

            if (event.event === 'remove') {
                setUnifiedPedidos(prev => prev.filter(p => !(p.id === event.pedidoId && p.tipo === event.tipo)))
            } else if (event.event === 'upsert' && event.pedido) {
                setUnifiedPedidos(prev => {
                    const uniqueMap = new Map<string, UnifiedPedido>()
                    prev.forEach((item: UnifiedPedido) => uniqueMap.set(`${item.tipo}-${item.id}`, item))
                    uniqueMap.set(`${event.pedido.tipo}-${event.pedido.id}`, event.pedido)
                    const unique = Array.from(uniqueMap.values())
                    return unique.sort((a, b) => parseDashboardDate(b.createdAt).getTime() - parseDashboardDate(a.createdAt).getTime())
                })

                if (event.shouldPrint && !event.pedido.impreso) {
                    tryImprimirPedido(event.pedido)
                }
            }
        })

        return () => { unsubscribe(); };
    }, [sucursalActivaId, tryImprimirPedido])



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
                } catch {}
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
    // RENDER DE LISTAS
    // ─────────────────────────────────────────────
    const activeOrders = unifiedPedidos.filter(p => p.estado !== 'archived')
    const archivedOrders = unifiedPedidos.filter(p => p.estado === 'archived')

    if (!prefsReady) {
        const activasParaModal = sucursalesList.filter((s) => s.activo)
        return (
            <div className="relative h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-background">
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
        return <div className="h-[calc(100vh-4rem)] flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-[#FF7A00]" /></div>
    }

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden bg-background">

            {/* ── HEADER PRINCIPAL ── */}
            <header className="shrink-0 bg-background border-b border-border px-4 py-3 flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                    {mobileView === 'detail' && (
                        <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9 -ml-2" onClick={() => { setMobileView('orders'); setShowOrderMap(false) }}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    )}
                    <h1 className="text-xl font-bold tracking-tight text-foreground">
                        {mobileView === 'detail' && showOrderMap
                            ? 'Mapa de pedidos'
                            : mobileView === 'detail' && selectedUnifiedPedido
                                ? `Pedido #${selectedUnifiedPedido.id}`
                                : (restaurante?.nombre || 'Operaciones')}
                    </h1>
                    <Badge variant="outline" className={cn("hidden sm:flex items-center gap-1.5 text-xs font-medium border", isConnected ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20" : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20")}>
                        <div className={cn("h-2 w-2 rounded-full", isConnected ? "bg-green-500 animate-pulse" : "bg-red-500")} />
                        {isConnected ? 'En vivo' : 'Offline'}
                    </Badge>
                    {sucursalNombre ? (
                        <Badge variant="outline" className="hidden sm:flex text-xs border-[#FF7A00]/25 text-foreground">
                            <Store className="h-3 w-3 mr-1 text-[#FF7A00]" />
                            {sucursalNombre}
                        </Badge>
                    ) : null}
                    {sucursalesList.some((s) => s.activo) ? (
                        <button
                            type="button"
                            className="hidden sm:inline text-[11px] font-semibold text-muted-foreground underline-offset-4 hover:text-[#FF7A00] hover:underline"
                            onClick={() => setShowSucursalSelector(true)}
                        >
                            Cambiar sucursal
                        </button>
                    ) : null}
                </div>

                <div className="flex items-center gap-2">
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
                                        onClick={() => { setShowOrderMap(true); setMobileView('detail') }}
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
                                                        onClick={() => { setSelectedUnifiedPedido(pedido); setMobileView('detail'); }}
                                                        className={cn(
                                                            "p-3 rounded-xl cursor-pointer transition-all border flex flex-col gap-2",
                                                            isSelected
                                                                ? "border-[#FF7A00] bg-orange-500/10 dark:bg-orange-500/20"
                                                                : "border-border bg-card hover:bg-accent/50 shadow-sm"
                                                        )}
                                                    >
                                                        <div className="flex justify-between items-start gap-2">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="font-bold text-sm flex items-center gap-1.5">
                                                                    {pedido.tipo === 'delivery' ? <Truck className="h-3.5 w-3.5 text-[#FF7A00]" /> : <ShoppingBag className="h-3.5 w-3.5 text-[#FF7A00]" />}
                                                                    #{pedido.id}
                                                                </span>
                                                                {!pedido.pagado && (
                                                                    <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 text-[9px] px-1 border-none hover:bg-red-500/20">Pendiente</Badge>
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
                                                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center gap-0.5 font-bold">
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
                                                                        className="h-7 px-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50 text-[10px] font-bold"
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
                                        <div className="flex items-center gap-3 mb-3">
                                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest pl-1">Historial</span>
                                            <Separator className="flex-1 bg-border" />
                                        </div>

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
                                                            onClick={() => { setSelectedUnifiedPedido(pedido); setMobileView('detail'); }}
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


                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── PANEL DERECHO: DETALLE OPERATIVO ── */}
                        <div className={cn(
                            "flex-1 bg-background relative overflow-hidden",
                            mobileView === 'detail' ? 'flex flex-col' : 'hidden lg:flex lg:flex-col'
                        )}>
                            {showOrderMap ? (
                                <OrderMapView
                                    orders={activeOrders}
                                    onClose={() => { setShowOrderMap(false); setMobileView('orders') }}
                                />
                            ) : selectedUnifiedPedido ? (
                                <div className="flex flex-col h-full w-full relative">

                                    {/* --- DESKTOP LAYOUT (3 Secciones) --- */}
                                    <div className="hidden lg:flex flex-col h-full p-8 xl:p-10 w-full max-w-6xl mx-auto overflow-y-auto">
                                        {/* 1. Header Desktop (Ocupa todo el ancho superior) */}
                                        <div className="flex items-start justify-between border-b border-border pb-6 mb-8 shrink-0">
                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Badge variant="outline" className="uppercase tracking-widest text-[10px] font-bold bg-muted/50">
                                                        {selectedUnifiedPedido.tipo}
                                                    </Badge>
                                                    {selectedUnifiedPedido.estado === 'archived' && (
                                                        <Badge variant="secondary" className="bg-muted text-muted-foreground text-[10px]">Archivado</Badge>
                                                    )}
                                                </div>
                                                <h2 className="text-4xl font-black text-foreground tracking-tight">Pedido #{selectedUnifiedPedido.id}</h2>
                                                <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-2 font-medium">
                                                    <Clock className="h-4 w-4" />
                                                    {getDateLabel(selectedUnifiedPedido.createdAt)}, {parseDashboardDate(selectedUnifiedPedido.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                                    <span className="opacity-50 font-normal ml-1">({formatTimeAgo(selectedUnifiedPedido.createdAt)})</span>
                                                </p>
                                                {selectedUnifiedPedido.horarioProgramado && (
                                                    <div className="flex items-center gap-3 mt-4 px-5 py-3 bg-amber-500/10 rounded-2xl border-2 border-amber-500/40">
                                                        <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400 shrink-0" />
                                                        <div>
                                                            <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pedido programado para las</p>
                                                            <p className="text-3xl font-black text-amber-700 dark:text-amber-300 leading-none mt-0.5">{selectedUnifiedPedido.horarioProgramado}</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex gap-2">
                                                {selectedPrinter && (
                                                    <Button variant="outline" className="h-10 hover:bg-accent" onClick={() => {
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
                                                        <Printer className="h-4 w-4 mr-2" /> Imprimir
                                                    </Button>
                                                )}
                                                <Button variant="outline" className="h-10 text-red-600 hover:text-red-700 hover:bg-red-500/10 border-border" onClick={() => setShowDeleteDialog(true)}>
                                                    <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Contenido Desktop: Dos columnas */}
                                        <div className="flex flex-col lg:flex-row gap-10 xl:gap-16 pb-10">

                                            {/* Columna Izquierda: Datos + Comanda */}
                                            <div className="flex-1 space-y-10">
                                                {/* Datos de Entrega */}
                                                <div className="space-y-4">
                                                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Datos de Entrega</h3>
                                                    <div className="grid grid-cols-2 gap-4 text-sm font-medium">
                                                        {selectedUnifiedPedido.nombreCliente && (
                                                            <div className="flex gap-3 items-center">
                                                                <User className="h-5 w-5 text-[#FF7A00] shrink-0" />
                                                                <span className="text-base text-foreground">{selectedUnifiedPedido.nombreCliente}</span>
                                                            </div>
                                                        )}
                                                        {selectedUnifiedPedido.telefono && (
                                                            <div className="flex gap-3 items-center">
                                                                <Phone className="h-5 w-5 text-[#FF7A00] shrink-0" />
                                                                <span className="text-base text-foreground">{selectedUnifiedPedido.telefono}</span>
                                                            </div>
                                                        )}
                                                        {selectedUnifiedPedido.tipo === 'delivery' && selectedUnifiedPedido.direccion && (
                                                            <div className="flex gap-3 items-center col-span-2 mt-2">
                                                                <MapPin className="h-5 w-5 text-[#FF7A00] shrink-0" />
                                                                <span className="text-lg font-bold text-foreground">{selectedUnifiedPedido.direccion}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {selectedUnifiedPedido.notas && (
                                                        <div className="mt-4">
                                                            <p className="text-xs font-bold text-orange-500 mb-1 flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" />NOTAS DEL CLIENTE:</p>
                                                            <p className="italic text-sm text-foreground">{selectedUnifiedPedido.notas}</p>
                                                        </div>
                                                    )}
                                                </div>

                                                <Separator className="bg-border/60" />

                                                {/* Comanda */}
                                                <div className="space-y-4">
                                                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Comanda ({selectedUnifiedPedido.totalItems} ítems)</h3>
                                                    <div className="space-y-6 mt-4">
                                                        {selectedUnifiedPedido.grupal ? (
                                                            Object.entries(
                                                                selectedUnifiedPedido.items.reduce((acc, item) => {
                                                                    const key = item.clienteNombre || 'Sin nombre'
                                                                    if (!acc[key]) acc[key] = []
                                                                    acc[key].push(item)
                                                                    return acc
                                                                }, {} as Record<string, DeliveryItem[]>)
                                                            ).map(([cliente, clienteItems]) => (
                                                                <div key={cliente} className="space-y-4">
                                                                    <p className="text-xs font-bold text-[#FF7A00] uppercase tracking-widest flex items-center gap-1.5">
                                                                        <User className="h-3.5 w-3.5" />{cliente}
                                                                    </p>
                                                                    {clienteItems.map((item, idx) => (
                                                                        <div key={idx} className="flex justify-between items-start gap-4">
                                                                            <div className="flex gap-4">
                                                                                <span className="font-bold text-lg w-6 text-muted-foreground">{item.cantidad}x</span>
                                                                                <div>
                                                                                    <p className="font-bold text-lg text-foreground">
                                                                                        {item.nombreProducto} {item.varianteNombre && <span className="text-orange-500 text-sm font-semibold">({item.varianteNombre})</span>}
                                                                                    </p>
                                                                                    {formatAgregados(item.agregados).length > 0 && (
                                                                                        <div className="mt-1 space-y-0.5">
                                                                                            {formatAgregados(item.agregados).map((ag: any, i: number) => (
                                                                                                <p key={i} className="text-sm text-muted-foreground font-medium">
                                                                                                    <span className="text-emerald-500 font-bold mr-1.5">+</span>{ag.nombre}
                                                                                                </p>
                                                                                            ))}
                                                                                        </div>
                                                                                    )}
                                                                                    {item.ingredientesExcluidosNombres && item.ingredientesExcluidosNombres.length > 0 && (
                                                                                        <div className="mt-1 space-y-0.5">
                                                                                            {item.ingredientesExcluidosNombres.map((nombre, i) => (
                                                                                                <p key={i} className="text-sm text-muted-foreground font-medium">
                                                                                                    <span className="text-red-500 font-bold mr-1.5">-</span>Sin {nombre}
                                                                                                </p>
                                                                                            ))}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                            <span className="font-bold text-lg whitespace-nowrap text-foreground">
                                                                                ${(parseFloat(item.precioUnitario || '0') * item.cantidad).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ))
                                                        ) : (
                                                            selectedUnifiedPedido.items.map((item, idx) => (
                                                                <div key={idx} className="flex justify-between items-start gap-4">
                                                                    <div className="flex gap-4">
                                                                        <span className="font-bold text-lg w-6 text-muted-foreground">{item.cantidad}x</span>
                                                                        <div>
                                                                            <p className="font-bold text-lg text-foreground">
                                                                                {item.nombreProducto} {item.varianteNombre && <span className="text-orange-500 text-sm font-semibold">({item.varianteNombre})</span>}
                                                                            </p>
                                                                            {formatAgregados(item.agregados).length > 0 && (
                                                                                <div className="mt-1 space-y-0.5">
                                                                                    {formatAgregados(item.agregados).map((ag: any, i: number) => (
                                                                                        <p key={i} className="text-sm text-muted-foreground font-medium">
                                                                                            <span className="text-emerald-500 font-bold mr-1.5">+</span>{ag.nombre}
                                                                                        </p>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                            {item.ingredientesExcluidosNombres && item.ingredientesExcluidosNombres.length > 0 && (
                                                                                <div className="mt-1 space-y-0.5">
                                                                                    {item.ingredientesExcluidosNombres.map((nombre, i) => (
                                                                                        <p key={i} className="text-sm text-muted-foreground font-medium">
                                                                                            <span className="text-red-500 font-bold mr-1.5">-</span>Sin {nombre}
                                                                                        </p>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <span className="font-bold text-lg whitespace-nowrap text-foreground">
                                                                        ${(parseFloat(item.precioUnitario || '0') * item.cantidad).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                                                    </span>
                                                                </div>
                                                            ))
                                                        )}
                                                        <div className="space-y-2 pt-4 border-t border-dashed border-border/60">
                                                            {selectedUnifiedPedido.tipo === 'delivery' && (
                                                                <div className="flex justify-between items-center text-muted-foreground text-sm font-medium">
                                                                    <p className="flex items-center gap-2"><Truck className="h-4 w-4" />Costo de envío</p>
                                                                    <span>${getOrderDeliveryFee(selectedUnifiedPedido).toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
                                                                </div>
                                                            )}
                                                            {pedidoTieneCuponDescuento(selectedUnifiedPedido) && (
                                                                <div className="flex justify-between items-center text-violet-500 text-sm font-bold">
                                                                    <p className="flex items-center gap-2"><Tag className="h-4 w-4" />{selectedUnifiedPedido.codigoDescuentoCodigo || 'Cupón de descuento'}</p>
                                                                    <span>-${parseFloat(String(selectedUnifiedPedido.montoDescuento)).toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Columna Derecha: Total y Botones */}
                                            <div className="w-full lg:w-[320px] xl:w-[380px] shrink-0 space-y-6">
                                                <div className="flex justify-between items-end">
                                                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Total</span>
                                                    <span className="text-5xl font-black text-[#FF7A00]">
                                                        ${computeOrderTotal(selectedUnifiedPedido).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                                    </span>
                                                </div>

                                                <div className={cn(
                                                    "w-full flex flex-col gap-2 p-4 rounded-xl border",
                                                    selectedUnifiedPedido.pagado
                                                        ? "bg-emerald-500/10 border-emerald-500/20"
                                                        : "bg-red-500/10 border-red-500/20"
                                                )}>
                                                    <div className="flex items-center gap-2">
                                                        {selectedUnifiedPedido.pagado ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <AlertCircle className="h-5 w-5 text-red-500" />}
                                                        <span className={cn("font-bold text-sm", selectedUnifiedPedido.pagado ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                                                            {selectedUnifiedPedido.pagado ? 'PAGO VERIFICADO' : 'PAGO PENDIENTE'}
                                                        </span>
                                                    </div>
                                                    {(() => {
                                                        const b = metodoPagoListBadge(selectedUnifiedPedido.metodoPago)
                                                        if (!b) return null
                                                        return (
                                                            <Badge variant="outline" className={cn('self-start text-xs border-none', b.className)}>
                                                                {b.icon && <span className="mr-1">{b.icon}</span>}
                                                                {b.label}
                                                            </Badge>
                                                        )
                                                    })()}
                                                </div>

                                                {selectedUnifiedPedido.estado !== 'archived' && (
                                                    selectedUnifiedPedido.pagado ? (
                                                        <div className="flex gap-3">
                                                            <Button
                                                                variant="outline"
                                                                className="h-14 rounded-xl border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold active:scale-[0.98] transition-transform"
                                                                onClick={() => handleNotificarCliente(selectedUnifiedPedido)}
                                                                disabled={sendingNotification === selectedUnifiedPedido.id.toString()}
                                                            >
                                                                {sendingNotification === selectedUnifiedPedido.id.toString()
                                                                    ? <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                                                    : <MessageCircle className="h-5 w-5 mr-2" />}
                                                                Avisar Cliente
                                                            </Button>
                                                            <Button
                                                                className="flex-1 h-14 rounded-xl bg-[#FF7A00] hover:bg-[#E66E00] text-white text-lg font-bold shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-transform"
                                                                onClick={() => void handleDespachar(selectedUnifiedPedido.tipo, selectedUnifiedPedido.id)}
                                                            >
                                                                Despachar Pedido
                                                            </Button>
                                                        </div>
                                                    ) : pedidoCobroManualYaElegido(selectedUnifiedPedido.metodoPago) ? (
                                                        <Button
                                                            className="w-full h-14 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-bold active:scale-[0.98] transition-transform shadow-sm"
                                                            onClick={() => handleAprobarPago(selectedUnifiedPedido)}
                                                            disabled={updatingPago === selectedUnifiedPedido.id.toString()}
                                                        >
                                                            {updatingPago === selectedUnifiedPedido.id.toString() ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                                                            Cobrar
                                                        </Button>
                                                    ) : (
                                                        <div className="flex gap-3">
                                                            <Button
                                                                className="flex-1 h-[52px] rounded-xl bg-background border-border hover:bg-accent text-foreground text-sm font-bold active:scale-[0.98] transition-transform shadow-sm"
                                                                onClick={() => handleAprobarPago(selectedUnifiedPedido, 'efectivo')}
                                                                disabled={updatingPago === selectedUnifiedPedido.id.toString()}
                                                            >
                                                                {updatingPago === selectedUnifiedPedido.id.toString() ? <Loader2 className="h-5 w-5 animate-spin" /> : <span className="mr-1.5 text-lg">💵</span>}
                                                                Efectivo
                                                            </Button>
                                                            <Button
                                                                className="flex-1 h-[52px] rounded-xl bg-background border-border hover:bg-accent text-foreground text-sm font-bold active:scale-[0.98] transition-transform shadow-sm"
                                                                onClick={() => handleAprobarPago(selectedUnifiedPedido, 'transferencia')}
                                                                disabled={updatingPago === selectedUnifiedPedido.id.toString()}
                                                            >
                                                                {updatingPago === selectedUnifiedPedido.id.toString() ? <Loader2 className="h-5 w-5 animate-spin" /> : <span className="mr-1.5 text-lg">🏦</span>}
                                                                Transf.
                                                            </Button>
                                                        </div>
                                                    )
                                                )}

                                                {/* Confirmar con demora — slider */}
                                                {restauranteStore?.modoConfirmacionManual && selectedUnifiedPedido.notificarWhatsapp && selectedUnifiedPedido.telefono && selectedUnifiedPedido.estado !== 'archived' && (
                                                    <div className="space-y-3 p-4 rounded-2xl bg-muted/30 border border-border">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <div className="h-7 w-7 rounded-lg bg-[#FF7A00]/10 flex items-center justify-center shrink-0">
                                                                    <MessageCircle className="h-3.5 w-3.5 text-[#FF7A00]" />
                                                                </div>
                                                                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Confirmar al cliente</span>
                                                            </div>
                                                            {selectedUnifiedPedido.demoraMinutos != null && (
                                                                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full shrink-0">
                                                                    <CheckCircle className="h-3 w-3" /> {selectedUnifiedPedido.demoraMinutos} min
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="flex items-baseline justify-between px-1 py-1">
                                                            <span className="text-xs text-muted-foreground">Demora estimada</span>
                                                            {(() => {
                                                                const val = parseInt(demoraInputs[selectedUnifiedPedido.id.toString()] ?? '30', 10)
                                                                return val === 0
                                                                    ? <span className="text-sm font-bold text-muted-foreground">Lo antes posible</span>
                                                                    : <span className="text-3xl font-black text-[#FF7A00] leading-none">{val}<span className="text-sm font-semibold ml-1 text-muted-foreground">min</span></span>
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

                                                        <div className="flex justify-between text-[10px] text-muted-foreground px-0.5 -mt-1">
                                                            <span>0</span>
                                                            <span>30 min</span>
                                                            <span>60 min</span>
                                                            <span>90 min</span>
                                                            <span>120 min</span>
                                                        </div>

                                                        <Button
                                                            className="w-full h-11 rounded-xl bg-[#FF7A00] hover:bg-[#E66E00] text-white font-bold"
                                                            onClick={() => handleConfirmarConDemora(selectedUnifiedPedido)}
                                                            disabled={confirmandoDemora === selectedUnifiedPedido.id.toString()}
                                                        >
                                                            {confirmandoDemora === selectedUnifiedPedido.id.toString()
                                                                ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                                : <MessageCircle className="h-4 w-4 mr-2" />}
                                                            {selectedUnifiedPedido.demoraMinutos != null ? 'Reenviar confirmación' : 'Confirmar y avisar por WhatsApp'}
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>

                                        </div>
                                    </div>

                                    {/* --- MOBILE LAYOUT (Inspiración Phantom) --- */}
                                    <div className="flex lg:hidden flex-col h-full w-full relative">
                                        <div className="flex-1 overflow-y-auto px-5 pt-6 pb-36">
                                            {/* Top Badges */}
                                            <div className="flex items-center justify-end mb-6">
                                                <div className="flex items-center gap-2">
                                                    {selectedUnifiedPedido.estado === 'archived' && (
                                                        <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">Archivado</span>
                                                    )}
                                                    {selectedUnifiedPedido.pagado ? (
                                                        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full flex items-center gap-1">
                                                            <CheckCircle className="h-3 w-3" /> Pagado
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full">
                                                            Sin cobrar
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Hero Mobile */}
                                            <div className="text-center mb-8">
                                                <p className="text-sm text-muted-foreground mb-1 uppercase tracking-widest font-semibold">
                                                    {selectedUnifiedPedido.tipo === 'delivery' ? '🚚 Delivery' : '🛍️ Take Away'}
                                                </p>
                                                <p className="text-5xl font-black tracking-tight mb-3 text-foreground">
                                                    ${computeOrderTotal(selectedUnifiedPedido).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                                </p>
                                                <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
                                                    {selectedUnifiedPedido.tipo === 'delivery' && selectedUnifiedPedido.direccion && (
                                                        <span className="font-bold text-foreground text-center leading-snug max-w-xs text-base">
                                                            {selectedUnifiedPedido.direccion}
                                                        </span>
                                                    )}
                                                    <span className="text-xs mt-0.5">
                                                        {formatTimeAgo(selectedUnifiedPedido.createdAt)}
                                                    </span>
                                                </div>
                                                {selectedUnifiedPedido.horarioProgramado && (
                                                    <div className="flex items-center justify-center gap-2 mt-3 px-4 py-3 bg-amber-500/10 rounded-2xl border-2 border-amber-500/40 max-w-xs mx-auto">
                                                        <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                                                        <div className="text-left">
                                                            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">Programado para las</p>
                                                            <p className="text-2xl font-black text-amber-700 dark:text-amber-300 leading-none">{selectedUnifiedPedido.horarioProgramado}</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <Separator className="bg-border/60 mb-8" />

                                            {/* Acciones de cobro (solo si no está pagado) */}
                                            {!selectedUnifiedPedido.pagado && selectedUnifiedPedido.estado !== 'archived' && (
                                                <div className="mb-8">
                                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
                                                        {pedidoCobroManualYaElegido(selectedUnifiedPedido.metodoPago) ? 'Confirmar cobro' : 'Verificar y cobrar'}
                                                    </p>
                                                    {pedidoCobroManualYaElegido(selectedUnifiedPedido.metodoPago) ? (
                                                        <Button
                                                            className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm"
                                                            onClick={() => handleAprobarPago(selectedUnifiedPedido)}
                                                            disabled={updatingPago === selectedUnifiedPedido.id.toString()}
                                                        >
                                                            {updatingPago === selectedUnifiedPedido.id.toString() ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                                            Cobrar
                                                        </Button>
                                                    ) : (
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
                                                    )}
                                                </div>
                                            )}

                                            {/* Confirmar con demora — slider mobile */}
                                            {restauranteStore?.modoConfirmacionManual && selectedUnifiedPedido.notificarWhatsapp && selectedUnifiedPedido.telefono && selectedUnifiedPedido.estado !== 'archived' && (
                                                <div className="mb-8 space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Confirmar al cliente</p>
                                                        {selectedUnifiedPedido.demoraMinutos != null && (
                                                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
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

                                            {/* Notas Mobile */}
                                            {selectedUnifiedPedido.notas && (
                                                <div className="mb-8">
                                                    <p className="text-sm text-muted-foreground italic leading-snug">
                                                        📝 {selectedUnifiedPedido.notas}
                                                    </p>
                                                </div>
                                            )}

                                            {(selectedUnifiedPedido.notas || !selectedUnifiedPedido.pagado) && (
                                                <Separator className="bg-border/60 mb-8" />
                                            )}

                                            {/* Comanda Clean List Mobile */}
                                            <div className="mb-6">
                                                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Comanda</h3>
                                                <div className="space-y-0 px-2">
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
                                                                <p className="text-[11px] font-bold text-[#FF7A00] uppercase tracking-widest flex items-center gap-1 mb-2">
                                                                    <User className="h-3 w-3" />{cliente}
                                                                </p>
                                                                {clienteItems.map((item, idx) => {
                                                                    const basePrice = parseFloat(item.precioUnitario || '0')
                                                                    const lineTotal = basePrice * item.cantidad
                                                                    return (
                                                                        <div key={idx} className={`flex items-baseline justify-between py-3 ${idx > 0 ? 'border-t border-border/40' : ''}`}>
                                                                            <div className="flex items-baseline gap-3 flex-1 min-w-0">
                                                                                <span className="font-mono text-sm text-muted-foreground w-6 shrink-0">{item.cantidad}x</span>
                                                                                <div className="flex-1 min-w-0">
                                                                                    <span className="text-sm font-medium text-foreground">
                                                                                        {item.nombreProducto} {item.varianteNombre && <span className="text-orange-500 text-[11px] font-bold">({item.varianteNombre})</span>}
                                                                                    </span>
                                                                                    {formatAgregados(item.agregados).length > 0 && (
                                                                                        <div className="mt-1 space-y-0.5">
                                                                                            {formatAgregados(item.agregados).map((ag: any, i: number) => (
                                                                                                <p key={i} className="text-xs text-muted-foreground">
                                                                                                    <span className="text-emerald-500 font-bold mr-1">+</span>{ag.nombre}
                                                                                                </p>
                                                                                            ))}
                                                                                        </div>
                                                                                    )}
                                                                                    {item.ingredientesExcluidosNombres && item.ingredientesExcluidosNombres.length > 0 && (
                                                                                        <div className="mt-1 space-y-0.5">
                                                                                            {item.ingredientesExcluidosNombres.map((nombre, i) => (
                                                                                                <p key={i} className="text-[11px] text-orange-500">Sin: {nombre}</p>
                                                                                            ))}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                            <span className="text-sm font-medium tabular-nums shrink-0 ml-4">
                                                                                ${lineTotal.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                                                            </span>
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        ))
                                                    ) : (
                                                        selectedUnifiedPedido.items.map((item, idx) => {
                                                            const basePrice = parseFloat(item.precioUnitario || '0')
                                                            const lineTotal = basePrice * item.cantidad
                                                            return (
                                                                <div key={idx} className={`flex items-baseline justify-between py-3 ${idx > 0 ? 'border-t border-border/40' : ''}`}>
                                                                    <div className="flex items-baseline gap-3 flex-1 min-w-0">
                                                                        <span className="font-mono text-sm text-muted-foreground w-6 shrink-0">{item.cantidad}x</span>
                                                                        <div className="flex-1 min-w-0">
                                                                            <span className="text-sm font-medium text-foreground">
                                                                                {item.nombreProducto} {item.varianteNombre && <span className="text-orange-500 text-[11px] font-bold">({item.varianteNombre})</span>}
                                                                            </span>
                                                                            {formatAgregados(item.agregados).length > 0 && (
                                                                                <div className="mt-1 space-y-0.5">
                                                                                    {formatAgregados(item.agregados).map((ag: any, i: number) => (
                                                                                        <p key={i} className="text-xs text-muted-foreground">
                                                                                            <span className="text-emerald-500 font-bold mr-1">+</span>{ag.nombre}
                                                                                        </p>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                            {item.ingredientesExcluidosNombres && item.ingredientesExcluidosNombres.length > 0 && (
                                                                                <div className="mt-1 space-y-0.5">
                                                                                    {item.ingredientesExcluidosNombres.map((nombre, i) => (
                                                                                        <p key={i} className="text-[11px] text-orange-500">Sin: {nombre}</p>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <span className="text-sm font-medium tabular-nums shrink-0 ml-4">
                                                                        ${lineTotal.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                                                    </span>
                                                                </div>
                                                            )
                                                        })
                                                    )}

                                                    {selectedUnifiedPedido.tipo === 'delivery' && (
                                                        <div className="flex items-baseline justify-between py-3 border-t border-border/40 text-muted-foreground">
                                                            <div className="flex items-baseline gap-3 flex-1 min-w-0">
                                                                <span className="font-mono text-sm w-6 shrink-0">1x</span>
                                                                <span className="text-sm flex items-center gap-1.5">
                                                                    <Truck className="h-3.5 w-3.5 inline" /> Delivery
                                                                </span>
                                                            </div>
                                                            <span className="text-sm font-medium tabular-nums shrink-0 ml-4">
                                                                ${getOrderDeliveryFee(selectedUnifiedPedido).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {pedidoTieneCuponDescuento(selectedUnifiedPedido) && (
                                                        <div className="flex items-baseline justify-between py-3 border-t border-border/40 text-emerald-600 dark:text-emerald-400">
                                                            <div className="flex items-baseline gap-3 flex-1 min-w-0">
                                                                <span className="w-6 shrink-0"></span>
                                                                <span className="text-sm font-medium">Cupón</span>
                                                            </div>
                                                            <span className="text-sm font-medium shrink-0 ml-4">
                                                                -${parseFloat(String(selectedUnifiedPedido.montoDescuento)).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Info Extra Abajo */}
                                            <div className="mt-8 mb-4 p-4 rounded-2xl bg-muted/30 border border-border/40 flex flex-col gap-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-semibold text-muted-foreground uppercase">ID Pedido</span>
                                                    <span className="text-sm font-mono font-medium text-foreground">#{selectedUnifiedPedido.id}</span>
                                                </div>
                                                {selectedUnifiedPedido.nombreCliente && (
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-semibold text-muted-foreground uppercase">Cliente</span>
                                                        <span className="text-sm font-medium text-foreground">{selectedUnifiedPedido.nombreCliente}</span>
                                                    </div>
                                                )}
                                                {selectedUnifiedPedido.telefono && (
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-semibold text-muted-foreground uppercase">Teléfono</span>
                                                        <a href={`tel:${selectedUnifiedPedido.telefono}`} className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-orange-500">
                                                            <Phone className="h-3.5 w-3.5" />{selectedUnifiedPedido.telefono}
                                                        </a>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Print Button Mobile */}
                                            {selectedPrinter && (
                                                <div className="mt-4 flex justify-center mb-8">
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

                                        {/* Bottom Bar Mobile Fixed */}
                                        <div className="fixed bottom-0 left-0 w-full z-40">
                                            <div className="bg-background/90 backdrop-blur-xl border-t border-border/50 p-4 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
                                                <div className="max-w-xl mx-auto flex flex-col gap-3">

                                                    <div className="flex items-end justify-between px-1 mb-1">
                                                        <span className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
                                                            {selectedUnifiedPedido.pagado ? 'Total cobrado' : 'Total a cobrar'}
                                                        </span>
                                                        <span className="text-3xl font-black tracking-tight text-foreground">
                                                            ${computeOrderTotal(selectedUnifiedPedido).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                                        </span>
                                                    </div>

                                                    <div className="flex flex-col gap-2">
                                                        {selectedUnifiedPedido.estado !== 'archived' && (
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => setShowDeleteDialog(true)}
                                                                    className="h-14 w-14 rounded-2xl bg-secondary/30 border border-border/50 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                                                                >
                                                                    <Trash2 className="h-5 w-5" />
                                                                </button>
                                                                {selectedUnifiedPedido.pagado && (
                                                                    <button
                                                                        onClick={() => handleNotificarCliente(selectedUnifiedPedido)}
                                                                        disabled={sendingNotification === selectedUnifiedPedido.id.toString()}
                                                                        className="h-14 w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors shrink-0 disabled:opacity-50"
                                                                    >
                                                                        {sendingNotification === selectedUnifiedPedido.id.toString()
                                                                            ? <Loader2 className="h-5 w-5 animate-spin" />
                                                                            : <MessageCircle className="h-5 w-5" />}
                                                                    </button>
                                                                )}
                                                                <Button
                                                                    className={cn("flex-1 h-14 rounded-2xl text-white font-bold text-lg shadow-[0_0_20px_rgba(249,115,22,0.15)] transition-all active:scale-[0.98]", selectedUnifiedPedido.pagado ? "bg-[#F97316] hover:bg-[#EA580C]" : "bg-emerald-600 hover:bg-emerald-700 shadow-[0_0_20px_rgba(5,150,105,0.15)]")}
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
                                        </div>
                                    </div>

                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                                    <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                                        <CheckCircle2 className="h-8 w-8 text-muted-foreground/50" />
                                    </div>
                                    <p className="text-lg font-bold text-foreground">Operaciones al día</p>
                                    <p className="text-sm mt-1">Seleccioná un pedido del panel izquierdo para ver el detalle.</p>
                                </div>
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
                            <Button size="lg" className="w-full h-14 rounded-2xl bg-[#FF7A00] hover:bg-[#E66E00] text-white font-bold shadow-lg shadow-orange-500/20" onClick={() => toast.info('Abre el catálogo para agregar productos aquí')}>
                                Abrir Catálogo (Próximamente)
                            </Button>
                            <Button variant="ghost" className="w-full mt-2 h-14 rounded-2xl font-semibold" onClick={() => setDashboardMode('orders')}>
                                Volver a pedidos
                            </Button>
                        </div>
                    </div>
                )}
            </div>

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
                                                <div key={r.id} className="flex items-center justify-between p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
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
                                className="w-full flex items-center gap-3 p-4 rounded-2xl border border-border bg-card hover:bg-accent hover:border-[#FF7A00]/40 transition-all text-left font-semibold disabled:opacity-50"
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
                            className="w-full p-3 rounded-2xl border border-dashed border-border text-muted-foreground hover:bg-muted/40 transition-all text-sm font-medium disabled:opacity-50"
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