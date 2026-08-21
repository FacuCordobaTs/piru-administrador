import { useState, useEffect, useCallback, useRef, Fragment, useMemo, type KeyboardEvent, type MouseEvent } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { useModuloActivo } from '@/store/modulosStore'
import { pedidoUnificadoApi, restauranteApi, sucursalesApi, repartidoresApi, mesasLocalesApi, type MesaLocal } from '@/lib/api'
import { SucursalSelector, type SucursalListRow } from '@/components/SucursalSelector'
import { useAdminContext } from '@/context/AdminContext'
import CierreTurno from '@/components/CierreTurno'
import PuntoDeVenta, { type PosDraft, type PosDraftUpdate, type PosEditablePedido, type PuntoDeVentaHandle } from '@/components/PuntoDeVenta'
import { MesasOperativas } from '@/components/MesasOperativas'
import {
    Loader2, Plus, Clock, Trash2,
    User, ArrowLeft, Printer, Truck, MapPin,
    Phone, ShoppingBag, CalendarDays, Tag, Settings,
    Receipt, Wallet, Zap, CreditCard, ChevronDown, ChevronUp, ChevronsUpDown, CheckCircle,
    MessageCircle, Store, Map as MapIcon, X, UserRound, UserCheck, UserX, List, ShoppingCart,
    Copy, ExternalLink, MoreVertical, Armchair,
} from 'lucide-react'
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { usePrinter } from '@/context/PrinterContext'
import { formatComanda, commandsToBytes } from '@/utils/printerUtils'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { POS_METODOS_ORDER, POS_TIPOS_ORDER, posDraftStorageKey, usePosConfig } from '@/lib/posConfig'
import { SaldoAlertaBanner } from '@/components/SaldoAlertaBanner'
import { TrialValorBanner } from '@/components/TrialValorBanner'

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
// Acorta una dirección: calle + número (1ª parte, se conserva siempre) y
// localidad (2ª parte) eliminando el código postal argentino (ej. "S3000BV0") que puede variar.
// El CPA solo se busca en la localidad: jamás en la calle, para no borrar la altura.
function formatDireccionCorta(direccion?: string | null): string {
    if (!direccion) return ''
    const partes = direccion.split(',')
    const calle = partes[0].trim()
    if (!partes[1]) return calle
    // Elimina el CPA argentino: 1 letra opcional + 4 dígitos + hasta 3 caracteres (ej. S3000BV0, 3000)
    const localidad = partes[1].replace(/\b[A-Za-z]?\d{4}[A-Za-z0-9]{0,3}\b/g, '').replace(/\s{2,}/g, ' ').trim()
    return localidad ? `${calle}, ${localidad}` : calle
}

// ─────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────
interface DeliveryItem {
    id: number; productoId: number; cantidad: number; precioUnitario: string;
    nombreProducto: string; imagenUrl: string | null;
    ingredientesExcluidos: number[]; ingredientesExcluidosNombres?: string[];
    agregados?: any; varianteNombre?: string; varianteSecundariaNombre?: string; clienteNombre?: string | null; nota?: string | null;
}
type PedidoTipo = 'delivery' | 'takeaway' | 'mesa'

interface UnifiedPedido {
    id: number; tipo: PedidoTipo; estado: string; total: string; createdAt: string;
    nombreCliente: string | null; telefono: string | null; direccion?: string | null; notas?: string | null;
    items: DeliveryItem[]; totalItems: number; pagado?: boolean; metodoPago?: string | null;
    montoDescuento?: string | number | null; codigoDescuentoCodigo?: string | null; impreso?: boolean;
    sucursalId?: number | null; sucursalNombre?: string | null;
    demoraMinutos?: number | null; notificarWhatsapp?: boolean | null;
    horarioProgramado?: string | null; latitud?: string | null; longitud?: string | null;
    deliveryFee?: string | null; repartidorId?: number | null; repartidorNombre?: string | null;
    grupal?: boolean | null; creadoPorIa?: boolean | null; anotadoManualmente?: boolean | null;
    mesaLocalId?: number | null; mesaNombre?: string | null; consumoEnLocal?: boolean | null;
    version?: number; editable?: boolean; motivosNoEditable?: string[];
}
interface TurnoCajaDashboard { id: number; aperturaAt: string; cierreAt: string | null; abierto: boolean }
interface Repartidor { id: number; nombre: string; estado: 'activo' | 'inactivo'; restauranteId: number }
interface ClienteContexto {
    identificado: boolean; matchedBy: 'telefono' | 'nombre'; nombre: string | null;
    totalPedidos: number; pedidoNumero: number; totalHistorico: number;
    ultimaVezAt: string | null; primeraVez: boolean;
    nivel: 'nuevo' | 'recurrente' | 'frecuente';
}

const STORAGE_SUCURSAL = 'sucursal_activa_id'

const pedidoTipoLabel = (pedido: Pick<UnifiedPedido, 'tipo' | 'mesaNombre'>) =>
    pedido.tipo === 'delivery' ? 'Delivery' : pedido.tipo === 'mesa' ? (pedido.mesaNombre || 'Mesa') : 'Takeaway'

const pedidoTitulo = (pedido: Pick<UnifiedPedido, 'id' | 'tipo' | 'mesaLocalId' | 'mesaNombre'>) =>
    pedido.tipo === 'mesa'
        ? (pedido.mesaNombre || (pedido.mesaLocalId != null ? `Mesa ${pedido.mesaLocalId}` : 'Mesa'))
        : `Pedido #${pedido.id}`

const PedidoTipoIcon = ({ tipo, className }: { tipo: PedidoTipo; className: string }) =>
    tipo === 'delivery' ? <Truck className={className} /> : tipo === 'mesa' ? <Armchair className={className} /> : <ShoppingBag className={className} />

const numeroMesa = (mesa: MesaLocal, index: number): string => {
    const numeroEnNombre = mesa.nombre.match(/\d+/)?.[0]
    return numeroEnNombre || String(mesa.orden || index + 1)
}

function MesasGrid({
    token,
    sucursalId,
    pedidos,
    refreshKey,
    onMesaLibre,
    onMesaOcupada,
    selectedMesaId,
}: {
    token: string | null
    sucursalId: number | null
    pedidos: UnifiedPedido[]
    refreshKey?: number
    onMesaLibre: (mesa: MesaLocal) => void
    onMesaOcupada: (pedido: UnifiedPedido) => void
    selectedMesaId?: number | null
}) {
    const [mesas, setMesas] = useState<MesaLocal[]>([])
    const [cargando, setCargando] = useState(true)
    const [error, setError] = useState<string | null>(null)
    // Las actualizaciones posteriores son silenciosas: la grilla ya tiene datos
    // útiles y no debe reemplazarse por un spinner al cambiar de pestaña.
    const tokenMesasCargadoRef = useRef<string | null>(null)

    const cargarMesas = useCallback(async () => {
        if (!token) {
            setMesas([])
            setCargando(false)
            tokenMesasCargadoRef.current = null
            return
        }
        const esPrimeraCarga = tokenMesasCargadoRef.current !== token
        if (esPrimeraCarga) setCargando(true)
        try {
            const response = await mesasLocalesApi.list(token, false)
            setMesas(response.data)
            setError(null)
            tokenMesasCargadoRef.current = token
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las mesas')
        } finally {
            if (esPrimeraCarga) setCargando(false)
        }
    }, [token])

    useEffect(() => { void cargarMesas() }, [cargarMesas, refreshKey])

    const mesasVisibles = useMemo(() => mesas
        .filter((mesa) => sucursalId == null || mesa.sucursalId == null || mesa.sucursalId === sucursalId)
        .sort((a, b) => a.orden - b.orden || a.id - b.id), [mesas, sucursalId])

    const pedidosPorMesa = useMemo(() => {
        const resultado = new Map<number, UnifiedPedido>()
        pedidos.forEach((pedido) => {
            if (pedido.mesaLocalId != null && (pedido.tipo === 'mesa' || pedido.consumoEnLocal)) {
                resultado.set(pedido.mesaLocalId, pedido)
            }
        })
        return resultado
    }, [pedidos])

    if (cargando) return <div className="flex h-32 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando mesas…</div>
    if (error) return <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-sm"><p>{error}</p><button type="button" onClick={() => void cargarMesas()} className="mt-2 font-medium underline">Reintentar</button></div>
    if (mesasVisibles.length === 0) return <div className="flex h-32 items-center justify-center rounded-2xl border-2 border-dashed border-border px-5 text-center text-sm text-muted-foreground">No hay mesas configuradas para esta sucursal.</div>

    return (
        <div className="grid grid-cols-5 gap-2">
            {mesasVisibles.map((mesa, index) => {
                const pedido = pedidosPorMesa.get(mesa.id)
                const ocupada = !!pedido
                return (
                    <button
                        key={mesa.id}
                        type="button"
                        aria-label={`${mesa.nombre}, ${ocupada ? `ocupada con el pedido ${pedido.id}` : 'libre'}`}
                        title={`${mesa.nombre} · ${ocupada ? `Ocupada · pedido #${pedido.id}` : 'Libre'}`}
                        onClick={() => pedido ? onMesaOcupada(pedido) : onMesaLibre(mesa)}
                        className={cn(
                            'aspect-square min-h-11 rounded-lg border text-base font-black tabular-nums shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7A00]',
                            ocupada
                                ? 'border-[#FF7A00]/35 bg-[#FF7A00]/15 text-[#C45F00] dark:text-orange-300'
                                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
                            selectedMesaId === mesa.id && 'ring-2 ring-[#FF7A00] ring-offset-2 ring-offset-background',
                        )}
                    >
                        {numeroMesa(mesa, index)}
                    </button>
                )
            })}
        </div>
    )
}

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

function useDesktopViewport() {
    const [isDesktop, setIsDesktop] = useState(() =>
        typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
    )

    useEffect(() => {
        const media = window.matchMedia('(min-width: 1024px)')
        const sync = () => setIsDesktop(media.matches)
        sync()
        media.addEventListener('change', sync)
        return () => media.removeEventListener('change', sync)
    }, [])

    return isDesktop
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

// ── Filtro por día (selector "Hoy" ▲▼) ──
// Un "día" es una fecha calendario YYYY-MM-DD en el huso AR.
const getArDayString = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: AR_TIMEZONE })
const shiftDayString = (day: string, delta: number) => {
    const [y, m, d] = day.split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d))
    dt.setUTCDate(dt.getUTCDate() + delta)
    return dt.toISOString().slice(0, 10)
}
const formatDayTitle = (day: string): string => {
    const today = getArDayString(new Date())
    if (day === today) return 'Hoy'
    if (day === shiftDayString(today, -1)) return 'Ayer'
    const [y, m, d] = day.split('-').map(Number)
    const label = new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
    return label.charAt(0).toUpperCase() + label.slice(1)
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
    let parsed: unknown = agregadosData
    if (typeof agregadosData === 'string') {
        try {
            parsed = JSON.parse(agregadosData)
        } catch { return [] }
    }
    if (!Array.isArray(parsed)) return []
    const vistos = new Set<string>()
    return parsed.filter((ag: any) => {
        if (!ag || typeof ag !== 'object' || typeof ag.nombre !== 'string' || !ag.nombre.trim()) return false
        const key = ag.id != null ? `id:${ag.id}` : `nombre:${ag.nombre.trim().toLowerCase()}:${ag.precio ?? ''}`
        if (vistos.has(key)) return false
        vistos.add(key)
        return true
    })
}

const formatNombreConVariantes = (
    nombreBase: string,
    varianteNombre?: string | null,
    varianteSecundariaNombre?: string | null,
): string => {
    const base = (nombreBase || 'Producto').trim()
    const baseNormalizado = base.toLocaleLowerCase('es-AR')
    const variantes = [varianteNombre, varianteSecundariaNombre]
        .map(nombre => nombre?.trim())
        .filter((nombre): nombre is string => !!nombre)
        .filter((nombre, index, all) => all.findIndex(v => v.toLocaleLowerCase('es-AR') === nombre.toLocaleLowerCase('es-AR')) === index)
        .filter(nombre => !baseNormalizado.includes(nombre.toLocaleLowerCase('es-AR')))
    return variantes.length > 0 ? `${base} (${variantes.join(' · ')})` : base
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
        <div className="flex-1 flex flex-col overflow-hidden bg-[#FFFBF0] dark:bg-background">
            <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-border bg-[#FFFBF0] dark:bg-background">
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
                                                    : "bg-[#FFFBF0]/95 dark:bg-background/95 text-foreground border-border backdrop-blur-sm"
                                            )}
                                        >
                                            <span className="font-black">#{pedido.id}</span>
                                            <PedidoTipoIcon tipo={pedido.tipo} className="h-3 w-3 opacity-70" />
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
                                        <p className="font-black text-base text-foreground">{pedidoTitulo(selected)}</p>
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
                                            <MapPin className="h-3 w-3 shrink-0" />{formatDireccionCorta(selected.direccion)}
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
                                            <div className="min-w-0">
                                                <span className="block text-sm font-medium text-foreground truncate">
                                                    {formatNombreConVariantes(item.nombreProducto, item.varianteNombre, item.varianteSecundariaNombre)}
                                                </span>
                                                {formatAgregados(item.agregados).length > 0 && (
                                                    <span className="block text-xs text-emerald-600 truncate">
                                                        Extras: {formatAgregados(item.agregados).map((ag: any) => ag.nombre).join(', ')}
                                                    </span>
                                                )}
                                            </div>
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
    const hideMap = (selected != null && selected.tipo !== 'delivery') || selected?.estado === 'archived'

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
        return <div className="h-full w-full bg-[#FFFBF0] dark:bg-background" />
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
// PANEL: COMPARTIR LINK DE LA TIENDA
// (se muestra cuando no hay ningún pedido seleccionado)
// ─────────────────────────────────────────────
const ShareLinkPanel = ({ publicUrl }: { publicUrl: string | null }) => {
    const [copied, setCopied] = useState(false)

    const displayUrl = publicUrl ? publicUrl.replace(/^https?:\/\//, '') : ''

    const handleCopy = () => {
        if (!publicUrl) return
        navigator.clipboard.writeText(publicUrl)
        setCopied(true)
        toast.success('Link copiado')
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="h-full flex items-center justify-center p-6">
            <div className="w-full max-w-sm flex flex-col items-center text-center">
                <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-5">
                    <Store className="h-6 w-6 text-muted-foreground" />
                </div>

                <h2 className="text-xl font-semibold text-foreground">
                    Empezá a recibir pedidos
                </h2>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                    Compartí el link de tu tienda con tus clientes. Lo abren, arman su pedido y te llega acá.
                </p>

                {publicUrl && (
                    <>
                        <div className="w-full mt-6 flex items-center gap-2 h-11 px-3 rounded-xl border border-border bg-muted/40">
                            <span className="flex-1 text-sm text-foreground text-left truncate">
                                {displayUrl}
                            </span>
                        </div>

                        <div className="w-full mt-2.5 flex items-center gap-2">
                            <button
                                onClick={handleCopy}
                                className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-[#FF7A00] hover:bg-[#E66E00] text-white text-sm font-semibold transition-colors cursor-pointer"
                            >
                                {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                {copied ? 'Copiado' : 'Copiar link'}
                            </button>
                            <a
                                href={publicUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-sm font-semibold transition-colors cursor-pointer"
                            >
                                <ExternalLink className="h-4 w-4" />
                                Abrir
                            </a>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────
// COMANDA DEL POS (borrador en vivo)
// Se muestra en el panel derecho mientras el POS flotante está abierto: espeja
// todo lo que se va anotando (datos del cliente + productos) sin tocarlo.
// ─────────────────────────────────────────────
const POS_METODO_LABEL: Record<string, string> = {
    cash: 'Efectivo',
    tarjeta: 'Tarjeta',
    manual_transfer: 'Transferencia',
    mercadopago: 'Mercado Pago',
}

const crearBorradorMesaVacio = (mesa: Pick<MesaLocal, 'id' | 'nombre'>): PosDraft => ({
    tipo: 'mesa',
    nombreCliente: '',
    telefono: '',
    direccion: '',
    notas: '',
    metodoPago: 'cash',
    pagado: false,
    deliveryFee: 0,
    items: [],
    subtotal: 0,
    total: 0,
    submitting: false,
    hasChanges: false,
    mesaLocalId: mesa.id,
    mesaNombre: mesa.nombre,
})

const PosComandaPreview = ({
    draft,
    onEditItem,
    onRemoveItem,
    onUpdate,
    onSubmit,
    onDispatchMesa,
    onClear,
    onClearMesa,
    editingPedidoId,
    mesaAsignada,
}: {
    draft: PosDraft | null
    onEditItem?: (key: string) => void
    onRemoveItem?: (key: string) => void
    onUpdate?: (changes: PosDraftUpdate) => void
    onSubmit?: () => void
    /** Guarda primero la comanda y luego despacha el pedido de la mesa. */
    onDispatchMesa?: () => void | Promise<void>
    onClear?: () => void
    onClearMesa?: () => void
    editingPedidoId?: number
    /** La mesa se actualiza antes que el snapshot del POS; evita un título transitorio. */
    mesaAsignada?: Pick<MesaLocal, 'id' | 'nombre'> | null
}) => {
    // Qué datos/opciones muestra la comanda según la configuración del POS.
    const config = usePosConfig()
    const tiposHabilitados = POS_TIPOS_ORDER.filter((tipo) => tipo !== 'mesa' && config.tipos[tipo])
    const metodosPagoHabilitados = POS_METODOS_ORDER.filter((id) => config.metodosPago[id])
    const nombreEditable = config.camposCliente.nombre
    const telefonoEditable = config.camposCliente.telefono

    const mesaTitulo = mesaAsignada?.nombre || (mesaAsignada?.id ? `Mesa ${mesaAsignada.id}` : null)

    if (!draft) {
        return (
            <div className="h-full flex flex-col">
                <div className="w-full max-w-[600px] mx-auto px-5 lg:px-6 pt-6">
                    <h2 className="text-4xl font-black text-foreground tracking-tight leading-none">{mesaTitulo || 'Nuevo pedido'}</h2>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
                    <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
                        <ShoppingCart className="h-7 w-7 text-muted-foreground/60" />
                    </div>
                    <p className="text-base font-bold text-foreground">Comanda en blanco</p>
                    <div id="pos-catalogo-compacto" className="mt-2 w-full max-w-[520px] text-left" />
                </div>
            </div>
        )
    }

    const totalItems = draft.items.reduce((s, it) => s + it.cantidad, 0)
    return (
        <div className="flex h-full w-full overflow-hidden">
            <div className="flex flex-col h-full relative flex-1 min-w-0">
                <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <div className="w-full max-w-[600px] mx-auto px-5 lg:px-6 pt-6 pb-[26rem]">

                        <div className="relative mb-6 text-left">
                            <h2 className="text-4xl font-black text-foreground tracking-tight leading-none">
                                {mesaTitulo || (editingPedidoId
                                    ? (draft.tipo === 'mesa' ? (draft.mesaNombre || (draft.mesaLocalId ? `Mesa ${draft.mesaLocalId}` : 'Mesa')) : `Pedido #${editingPedidoId}`)
                                    : draft.tipo === 'mesa'
                                        ? (draft.mesaNombre || (draft.mesaLocalId ? `Mesa ${draft.mesaLocalId}` : 'Mesa'))
                                        : 'Nuevo pedido')}
                            </h2>
                        </div>

                        <Separator className="bg-border/60 mb-6" />

                        {/* Comanda */}
                        <div className="mb-6">
                            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Comanda · {totalItems} ítems</h3>
                            <div id="pos-catalogo-compacto" className="mb-2" />
                            {draft.items.length === 0 ? (
                                <p className="text-sm text-muted-foreground/60 py-8 text-center border border-dashed border-border rounded-xl">
                                    Todavía no hay productos
                                </p>
                            ) : (
                                <div className="space-y-0">
                                    {draft.items.map((it, idx) => (
                                        <div
                                            key={it.key}
                                            role="button"
                                            tabIndex={-1}
                                            onClick={() => onEditItem?.(it.key)}
                                            onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault()
                                                    onEditItem?.(it.key)
                                                }
                                            }}
                                            className={`w-full flex items-center justify-between gap-3 py-3 text-left rounded-lg transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7A00] ${idx > 0 ? 'border-t border-border/40' : ''}`}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-base text-foreground leading-snug">
                                                    {formatNombreConVariantes(it.nombre, it.varianteNombre, it.varianteSecundariaNombre)}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-0.5">${it.precioUnitario.toLocaleString('es-AR', { minimumFractionDigits: 0 })} c/u</p>
                                                {it.ingredientesExcluidosNombres && it.ingredientesExcluidosNombres.length > 0 && (
                                                    <p className="text-xs font-medium text-orange-600 mt-1">Sin: {it.ingredientesExcluidosNombres.join(', ')}</p>
                                                )}
                                                {formatAgregados(it.agregados).length > 0 && (
                                                    <p className="text-xs font-medium text-emerald-600 mt-1">Extras: {formatAgregados(it.agregados).map((ag: any) => ag.nombre).join(', ')}</p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0">
                                                <span className="font-semibold text-base tabular-nums text-foreground">
                                                    ${(it.precioUnitario * it.cantidad).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                                </span>
                                                <button
                                                    type="button"
                                                    tabIndex={-1}
                                                    aria-label={`Eliminar ${it.nombre}`}
                                                    onClick={(event) => { event.stopPropagation(); onRemoveItem?.(it.key) }}
                                                    className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex items-center justify-center"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {draft.tipo === 'delivery' && draft.deliveryFee > 0 && (
                            <div className="flex items-center justify-between gap-3 py-3 border-t border-border/40 text-muted-foreground">
                                <span className="text-sm flex items-center gap-2"><Truck className="h-4 w-4" /> Costo de envío</span>
                                <span className="text-sm font-medium tabular-nums">${draft.deliveryFee.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
                            </div>
                        )}

                    </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 z-40 bg-[#FFFBF0] dark:bg-background">
                    <div className="w-full max-w-[600px] mx-auto px-5 lg:px-6 pt-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] flex flex-col gap-3">
                        {draft.tipo !== 'mesa' && tiposHabilitados.length > 0 && <div className="grid gap-1 rounded-2xl bg-muted/60 p-1" style={{ gridTemplateColumns: `repeat(${tiposHabilitados.length}, minmax(0, 1fr))` }}>
                            {tiposHabilitados.includes('delivery') && (
                                <button onClick={() => { onClearMesa?.(); onUpdate?.({ tipo: 'delivery' }) }} className={cn('h-12 w-full rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2', draft.tipo === 'delivery' ? 'bg-background text-black shadow-sm dark:text-white' : 'text-muted-foreground hover:text-foreground')}>
                                    <Truck className="h-4 w-4" />Delivery
                                </button>
                            )}
                            {tiposHabilitados.includes('takeaway') && (
                                <button onClick={() => { onClearMesa?.(); onUpdate?.({ tipo: 'takeaway' }) }} className={cn('h-12 w-full rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2', draft.tipo === 'takeaway' ? 'bg-background text-black shadow-sm dark:text-white' : 'text-muted-foreground hover:text-foreground')}>
                                    <ShoppingBag className="h-4 w-4" />Takeaway
                                </button>
                            )}
                        </div>}
                        {/* Con un único método habilitado no se muestra ningún botón:
                            el pedido se guarda directo con ese método. */}
                        {metodosPagoHabilitados.length > 1 && (
                            <div className="grid gap-1 rounded-2xl bg-muted/60 p-1" style={{ gridTemplateColumns: `repeat(${metodosPagoHabilitados.length}, minmax(0, 1fr))` }}>
                                {metodosPagoHabilitados.map((id) => (
                                    <button key={id} onClick={() => onUpdate?.({ metodoPago: id })} className={cn('h-12 w-full rounded-xl text-sm font-bold transition-colors flex items-center justify-center', draft.metodoPago === id ? 'bg-background text-black shadow-sm dark:text-white' : 'text-muted-foreground hover:text-foreground')}>
                                        {POS_METODO_LABEL[id]}
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className="relative text-left">
                            {nombreEditable && <div className="flex h-11 items-center gap-2 border-b border-border focus-within:border-[#FF7A00]">
                                <Input value={draft.nombreCliente} onChange={(event) => onUpdate?.({ nombreCliente: event.target.value })} placeholder="Nombre del cliente" className="h-11 min-w-0 flex-1 px-0 border-0 rounded-none bg-transparent dark:bg-transparent text-2xl font-black tracking-tight focus-visible:ring-0" />
                            </div>}
                            {draft.tipo !== 'mesa' && config.camposCliente.direccion && <div className={cn('flex h-9 items-center gap-2 border-b border-border/60 focus-within:border-[#FF7A00]', (nombreEditable || telefonoEditable) && 'mt-3')}>
                                <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <Input
                                    value={draft.direccion}
                                    onChange={(event) => onUpdate?.({ direccion: event.target.value })}
                                    placeholder="Dirección de entrega"
                                    disabled={draft.tipo !== 'delivery'}
                                    className="h-9 min-w-0 flex-1 px-0 border-0 rounded-none bg-transparent dark:bg-transparent focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-45"
                                />
                            </div>}
                            {telefonoEditable && <div className={cn('flex h-9 items-center gap-2 border-b border-border/60 focus-within:border-[#FF7A00]', nombreEditable && 'mt-3')}>
                                <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <Input value={draft.telefono} onChange={(event) => onUpdate?.({ telefono: event.target.value })} placeholder="Celular" inputMode="tel" className="h-9 min-w-0 flex-1 px-0 border-0 rounded-none bg-transparent dark:bg-transparent focus-visible:ring-0" />
                            </div>}
                        </div>
                        {config.notas && (
                            <div>
                                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 block">Nota</Label>
                                <Input value={draft.notas} onChange={(event) => onUpdate?.({ notas: event.target.value })} placeholder="Aclaraciones del pedido" className="h-10 rounded-xl" />
                            </div>
                        )}
                        <div className="flex items-baseline justify-between gap-3">
                            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Total</span>
                            <span className="text-3xl font-black tracking-tight text-[#FF7A00]">
                                ${draft.total.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                tabIndex={-1}
                                onClick={onClear}
                                disabled={draft.submitting}
                                aria-label={editingPedidoId ? `Eliminar pedido #${editingPedidoId}` : 'Limpiar borrador'}
                                title={editingPedidoId ? 'Eliminar pedido' : 'Limpiar borrador'}
                                className="h-14 w-14 rounded-2xl bg-secondary/30 border border-border/50 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
                            >
                                <Trash2 className="h-5 w-5" />
                            </button>
                            <Button
                                onClick={onSubmit}
                                disabled={draft.items.length === 0 || draft.submitting || (!!editingPedidoId && !draft.hasChanges)}
                                className="flex-1 h-14 rounded-2xl bg-[#FF7A00] text-lg font-bold text-white hover:bg-[#E66E00]"
                            >
                                {draft.submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : editingPedidoId ? 'Guardar cambios' : 'Anotar pedido'}
                            </Button>
                            {mesaAsignada && onDispatchMesa && (
                                <button
                                    type="button"
                                    onClick={() => void onDispatchMesa()}
                                    disabled={draft.items.length === 0 || draft.submitting}
                                    aria-label="Despachar pedido de la mesa"
                                    title="Despachar"
                                    className="h-14 w-14 shrink-0 rounded-2xl bg-[#FF7A00] text-white transition-colors hover:bg-[#E66E00] disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center"
                                >
                                    <Truck className="h-5 w-5" />
                                </button>
                            )}
                        </div>
                    </div>
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
    const { restaurante: restauranteStore, productos: allProductos, suscripcion } = useRestauranteStore()
    const posActivo = useModuloActivo('pos')
    const mesasActivo = useModuloActivo('mesas')
    const cierreManualActivo = useModuloActivo('cierre_turno_manual')
    const gestionCadetesActiva = useModuloActivo('gestion_cadetes')
    const puedeAvisarWhatsapp = useModuloActivo('avisos_automaticos_whatsapp')

    // Compatibilidad temporal de la UI de cobro. Gestión de cadetes se resuelve
    // exclusivamente con su módulo y no depende de este alias legacy.
    const esPlanBasico = suscripcion?.planCodigo === 'basico'

    const { printRaw, selectedPrinter, comandaGrandeMayusculas } = usePrinter()
    const isDesktopViewport = useDesktopViewport()
    const processedOrdersRef = useRef<Map<string, { status: string, itemIds: Set<number>, pagado?: boolean }>>(new Map())
    const initialLoadDoneRef = useRef(false)
    // Los pedidos creados desde el POS no deben depender de que el WebSocket y
    // el refetch lleguen en un orden particular. El id queda pendiente hasta
    // que el auto-printer lo reclama (o detecta que lo reclamó otro equipo).
    const posOrdersPendingPrintRef = useRef<Set<number>>(new Set())
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
    // Con el módulo POS activo el punto de venta queda siempre abierto: no hay
    // botón para abrirlo ni cierre posible. En móvil el overlay conserva su
    // propio estado para poder ver los pedidos detrás.
    const showPOS = posActivo
    const [showPosMovil, setShowPosMovil] = useState(false)
    const [pedidoPosEditando, setPedidoPosEditando] = useState<PosEditablePedido | null>(null)
    // Evita que el borrador activo se vea mientras se carga un pedido existente
    // (por ejemplo, al elegir una mesa ocupada).
    const [cargandoPedidoPos, setCargandoPedidoPos] = useState(false)
    const [mesaPosAsignada, setMesaPosAsignada] = useState<Pick<MesaLocal, 'id' | 'nombre'> | null>(null)
    const [posContext, setPosContext] = useState<'borrador' | 'pedidoExistente'>('borrador')
    // Borrador del pedido que se está anotando en el POS flotante: se espeja
    // en vivo en la comanda de la derecha (PosComandaPreview).
    const [draftPos, setDraftPos] = useState<PosDraft | null>(null)
    // Ref al POS (desktop) para que la comanda pueda quitar ítems del borrador.
    const posRef = useRef<PuntoDeVentaHandle>(null)
    // Marca la sesión de edición que fusionó el borrador con el pedido de una
    // mesa ocupada: al guardar, ese borrador ya quedó consumido y se limpia.
    const mesaMergeRef = useRef(false)
    const [mobileView, setMobileView] = useState<'orders' | 'detail'>('orders')
    const [showMobileOrdersSheet, setShowMobileOrdersSheet] = useState(false)
    const [showCierreTurno, setShowCierreTurno] = useState(false)
    const [turnoActual, setTurnoActual] = useState<{ id: number; aperturaAt: string; cierreAt: string | null } | null>(null)
    const [turnosCaja, setTurnosCaja] = useState<TurnoCajaDashboard[]>([])
    const [selectedTurnoId, setSelectedTurnoId] = useState<number | null>(null)
    const [showCerrarTurno, setShowCerrarTurno] = useState(false)
    const [cerrandoTurno, setCerrandoTurno] = useState(false)
    const [showArchived, setShowArchived] = useState(false)
    const [listadoActivo, setListadoActivo] = useState<'pedidos' | 'mesas'>('pedidos')
    const [selectedDay, setSelectedDay] = useState<string>(() => getArDayString(new Date()))
    const [showDayPicker, setShowDayPicker] = useState(false)
    const [pickerDay, setPickerDay] = useState<string>(() => getArDayString(new Date()))
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    const [pedidoAEliminar, setPedidoAEliminar] = useState<Pick<UnifiedPedido, 'id' | 'tipo'> | null>(null)
    // La lista principal respeta el día/turno elegido, pero la ocupación de una
    // mesa depende de todos los pedidos abiertos, incluso si nacieron ayer.
    const [pedidosMesaAbiertos, setPedidosMesaAbiertos] = useState<UnifiedPedido[]>([])
    const [sendingNotification, setSendingNotification] = useState<string | null>(null)
    const [demoraInputs, setDemoraInputs] = useState<Record<string, string>>({})
    const [confirmandoDemora, setConfirmandoDemora] = useState<string | null>(null)
    // Los avisos superiores son informativos: el local siempre puede quitarlos
    // durante esta visita, incluso cuando el estado de suscripción/saldo sigue vigente.
    const [showTrialBanner, setShowTrialBanner] = useState(true)
    const [showSaldoBanner, setShowSaldoBanner] = useState(true)
    // La ubicación se muestra en un mapa flotante (dialog), no inline.
    const [showMapaDialog, setShowMapaDialog] = useState(false)
    const [showMesasDialog, setShowMesasDialog] = useState(false)
    const [mesasDialogMode, setMesasDialogMode] = useState<'operar' | 'asignar-borrador'>('operar')

    useEffect(() => {
        if (!token || !cierreManualActivo) { setTurnoActual(null); setTurnosCaja([]); setSelectedTurnoId(null); return }
        pedidoUnificadoApi.turnos(token).then((res: any) => {
            if (res.success) {
                setTurnoActual(res.data.actual)
                setTurnosCaja(res.data.turnos)
                setSelectedTurnoId((actual) => actual ?? res.data.actual.id)
            }
        }).catch((error) => console.error('Error cargando turno:', error))
    }, [token, cierreManualActivo])

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
    const [pendingDispatchPedido, setPendingDispatchPedido] = useState<{ tipo: PedidoTipo; id: number } | null>(null)
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
    }, [sucursalActivaId, selectedDay])

    // Al cambiar de pedido, cerrar el mapa flotante.
    useEffect(() => {
        setShowMapaDialog(false)
    }, [selectedUnifiedPedido?.id, selectedUnifiedPedido?.tipo])

    // Si el día seleccionado no es "Hoy", abrir el Historial por defecto
    useEffect(() => {
        setShowArchived(cierreManualActivo
            ? selectedTurnoId != null && selectedTurnoId !== turnoActual?.id
            : selectedDay !== getArDayString(new Date()))
    }, [selectedDay, cierreManualActivo, selectedTurnoId, turnoActual?.id])

    // ─────────────────────────────────────────────
    // FETCH Y WEBSOCKETS
    // ─────────────────────────────────────────────
    const fetchPedidos = useCallback(async (pageNum = 1, append = false) => {
        if (!token) return
        if (!append) setIsLoading(true)
        else setIsLoadingMore(true)

        try {
            const response = await pedidoUnificadoApi.getByDia(
                token,
                selectedDay,
                'all',
                pageNum,
                50,
                undefined,
                sucursalActivaId,
                cierreManualActivo ? selectedTurnoId : null,
            ) as any
            if (response.success && response.data) {
                const validPedidos = response.data.filter((p: any) => p.tipo === 'delivery' || p.tipo === 'takeaway' || p.tipo === 'mesa') as UnifiedPedido[]

                // Con una lista inicial vacía no habrá un render con pedidos que
                // pueda cerrar la carga inicial. Sin esto, el primer pedido del
                // día se confundía con backlog y no se imprimía.
                if (!append && validPedidos.length === 0) {
                    initialLoadDoneRef.current = true
                }

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
    }, [token, sucursalActivaId, selectedDay, cierreManualActivo, selectedTurnoId])

    const fetchPedidosMesaAbiertos = useCallback(async () => {
        if (!token || !mesasActivo) {
            setPedidosMesaAbiertos([])
            return
        }
        try {
            const response = await pedidoUnificadoApi.getActivos(token, 'mesa', sucursalActivaId) as any
            if (!response.success || !Array.isArray(response.data)) return
            setPedidosMesaAbiertos(response.data.filter((pedido: UnifiedPedido) =>
                pedido.mesaLocalId != null
                && !['archived', 'cancelled', 'delivered'].includes(pedido.estado),
            ))
        } catch (error) {
            console.error('Error fetching pedidos abiertos de mesas:', error)
        }
    }, [token, mesasActivo, sucursalActivaId])

    const confirmarCierreTurno = async () => {
        if (!token || !turnoActual) return
        setCerrandoTurno(true)
        try {
            const res: any = await pedidoUnificadoApi.cerrarTurno(token)
            if (!res.success) throw new Error(res.message || 'No se pudo cerrar el turno')
            setTurnoActual(res.data.actual)
            setTurnosCaja((turnos) => [res.data.actual, res.data.cerrado, ...turnos.filter((turno) => turno.id !== res.data.cerrado.id)])
            setSelectedTurnoId(res.data.actual.id)
            setShowCerrarTurno(false)
            setSelectedUnifiedPedido(null)
            toast.success('Turno cerrado. Ya comenzó uno nuevo.')
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo cerrar el turno')
        } finally { setCerrandoTurno(false) }
    }

    useEffect(() => {
        if (!token || !prefsReady) return
        fetchPedidos(1, false)
        fetchPedidosMesaAbiertos()
    }, [token, prefsReady, fetchPedidos, fetchPedidosMesaAbiertos])

    useEffect(() => {
        if (!prefsReady || !lastUpdate) return
        if (lastUpdate.type !== 'delivery' && lastUpdate.type !== 'takeaway' && lastUpdate.type !== 'mesa') return
        if (
            sucursalActivaId != null &&
            lastUpdate.sucursalId !== undefined &&
            lastUpdate.sucursalId !== null &&
            lastUpdate.sucursalId !== sucursalActivaId
        ) {
            return
        }
        fetchPedidos(1, false)
        fetchPedidosMesaAbiertos()
    }, [lastUpdate, fetchPedidos, fetchPedidosMesaAbiertos, sucursalActivaId, prefsReady])

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
            const pendingFromPos = posOrdersPendingPrintRef.current.has(pedido.id)

            // Archivado → registrar y nunca imprimir
            if (pedido.estado === 'archived') {
                posOrdersPendingPrintRef.current.delete(pedido.id)
                if (!prevData) processedOrdersRef.current.set(pedidoKey, { status: pedido.estado, itemIds: new Set(pedido.items.map(i => i.id)), pagado: currentPagado })
                return
            }

            // Ya impreso en la DB → registrar y saltar
            if (pedido.impreso) {
                posOrdersPendingPrintRef.current.delete(pedido.id)
                if (!prevData) processedOrdersRef.current.set(pedidoKey, { status: pedido.estado, itemIds: new Set(pedido.items.map(i => i.id)), pagado: currentPagado })
                return
            }

            // Un alta confirmada por el POS es evidencia explícita de que el
            // pedido es nuevo, incluso si un refetch del WebSocket lo alcanzó
            // antes y ya lo registró en processedOrdersRef.
            let shouldPrint = pendingFromPos && (!deferUntilPaid || !!currentPagado)

            if (!shouldPrint && !prevData) {
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
            } else if (!shouldPrint) {
                // Pedido ya conocido: imprimir solo si acaba de pasar a pagado (para deferred)
                if (deferUntilPaid && currentPagado && !prevData?.pagado) {
                    shouldPrint = true
                }
            }

            if (shouldPrint && token) {
                // Claim atómico contra el backend: si hay otro dispositivo/pestaña del mismo
                // restaurante conectado, solo uno de los dos debe ganar la carrera e imprimir.
                pedidoUnificadoApi.claimImpreso(token, pedido.id)
                    .then((res: any) => {
                        if (!res?.claimed) {
                            posOrdersPendingPrintRef.current.delete(pedido.id)
                            return
                        }

                        const itemsToPrint = pedido.items.map(item => {
                            const producto = allProductos.find(p => p.id === item.productoId)
                            return { ...item, producto, categoriaEsBebida: producto?.categoriaEsBebida ?? false }
                        })

                        if (itemsToPrint.length > 0) {
                            const deliveryFee = pedido.tipo === 'delivery' ? getOrderDeliveryFee(pedido) : 0;
                            const comandaData = formatComanda({
                                id: pedido.id, nombrePedido: pedido.nombreCliente, telefono: pedido.telefono,
                                direccion: pedido.tipo === 'delivery' ? (pedido as any).direccion : undefined,
                                tipo: pedido.tipo, total: pedido.total, deliveryFee, notas: pedido.notas,
                                metodoPago: pedido.metodoPago, sucursalNombre: pedido.sucursalNombre,
                                horarioProgramado: pedido.horarioProgramado, grupal: pedido.grupal, mesaNombre: pedido.mesaNombre,
                                montoDescuento: pedido.montoDescuento,
                                codigoDescuentoCodigo: pedido.codigoDescuentoCodigo,
                            }, itemsToPrint, restaurante?.nombre || 'Restaurante', {
                                grandeMayusculas: comandaGrandeMayusculas,
                            })

                            printRaw(commandsToBytes(comandaData)).catch((err) => {
                                // El claim ya quedó en true en el backend (no se reintentará solo),
                                // así que avisamos al local para que reimprima a mano desde el pedido.
                                console.error('Error imprimiendo comanda automática:', err)
                                toast.error(`No se pudo imprimir el pedido #${pedido.id}. Reimprimilo manualmente.`)
                            })
                        }

                        posOrdersPendingPrintRef.current.delete(pedido.id)
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
    }, [unifiedPedidos, selectedPrinter, allProductos, restaurante, printRaw, token, restauranteStore, comandaGrandeMayusculas])

    // ─────────────────────────────────────────────
    // ACCIONES DE PEDIDO
    // ─────────────────────────────────────────────
    const handleEstadoChange = async (tipo: PedidoTipo, id: number, nuevoEstado: string) => {
        if (!token) return
        try {
            await pedidoUnificadoApi.updateEstado(token, id, nuevoEstado)
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
        if (gestionCadetesActiva && repartidoresModalOpen) loadRepartidores()
    }, [gestionCadetesActiva, repartidoresModalOpen, loadRepartidores])

    useEffect(() => {
        if (token && gestionCadetesActiva) {
            loadRepartidores()
        } else if (!gestionCadetesActiva) {
            setRepartidoresList([])
            setRepartidoresModalOpen(false)
            setRepartidorSelectorOpen(false)
            setPendingDispatchPedido(null)
        }
    }, [token, gestionCadetesActiva, loadRepartidores])

    const handleDespachar = async (tipo: PedidoTipo, id: number) => {
        // Sin Gestión de Cadetes el pedido se despacha directamente. Con el
        // módulo activo se ofrece asignación cuando hay equipo para elegir.
        if (gestionCadetesActiva && tipo === 'delivery') {
            const activos = repartidoresList.filter(r => r.estado === 'activo')
            if (activos.length >= 2) {
                setPendingDispatchPedido({ tipo, id })
                setRepartidorSelectorOpen(true)
                return
            }
        }
        await handleEstadoChange(tipo, id, 'archived')
    }

    const handleRepartidorSelected = async (tipo: PedidoTipo, id: number, repartidorId: number | null) => {
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
            const res: any = await pedidoUnificadoApi.marcarPagado(token, pedido.id, { pagado: true, metodoPago: mp })

            if (res.success) {
                setUnifiedPedidos(prev => prev.map(p => p.id === pedido.id && p.tipo === pedido.tipo ? { ...p, pagado: true, metodoPago: mp } : p))
                toast.success('Pago verificado correctamente')
            }
        } catch (error) { toast.error('No se pudo verificar el pago') }
        finally { setUpdatingPago(null) }
    }

    const abrirDialogoEliminarPedido = (pedido: Pick<UnifiedPedido, 'id' | 'tipo'>) => {
        setPedidoAEliminar(pedido)
        setShowDeleteDialog(true)
    }

    const handleDeletePedido = async () => {
        if (!token || !pedidoAEliminar) return
        const target = pedidoAEliminar
        try {
            await pedidoUnificadoApi.delete(token, target.id)
            setUnifiedPedidos(prev => prev.filter(p => !(p.id === target.id && p.tipo === target.tipo)))
            setPedidosMesaAbiertos(prev => prev.filter(p => p.id !== target.id))
            if (pedidoPosEditando?.id === target.id) {
                try { sessionStorage.removeItem(`piru:pos-edit:${target.id}`) } catch { /* noop */ }
                mesaMergeRef.current = false
                setPedidoPosEditando(null)
                setMesaPosAsignada(null)
                setDraftPos(null)
                setPosContext('borrador')
            }
            setShowDeleteDialog(false)
            setPedidoAEliminar(null)
            setSelectedUnifiedPedido((actual) => actual?.id === target.id && actual.tipo === target.tipo ? null : actual)
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
        if (!posActivo) return
        setShowOrderMap(false)
        setSelectedUnifiedPedido(null)
        setMesaPosAsignada(null)
        setPedidoPosEditando(null)
        setPosContext('borrador')
        setShowPosMovil(true)
        setMobileView('detail')
    }

    const closePOS = () => {
        // Con el módulo activo el POS no se cierra en desktop: esta función sólo
        // oculta el overlay móvil. Si la edición de fusión se cierra sin guardar,
        // el borrador queda intacto en sessionStorage; deja de estar pendiente la
        // limpieza post-guardado.
        mesaMergeRef.current = false
        setShowPosMovil(false)
        setMesaPosAsignada(null)
        setPedidoPosEditando(null)
        setPosContext('borrador')
        setMobileView('orders')
    }

    const requestClosePOS = () => {
        if (posRef.current) posRef.current.requestClose()
        else closePOS()
    }

    const openPedidoInPOS = (pedido: UnifiedPedido) => {
        // Sólo los pedidos anotados manualmente se editan desde el POS. Los de
        // la web se abren en el detalle operativo, donde también se eliminan.
        if (showPOS && pedido.anotadoManualmente) {
            void editarPedidoEnPos(pedido)
            return
        }
        setMesaPosAsignada(null)
        setSelectedUnifiedPedido(pedido)
        if (showPOS) setPosContext('pedidoExistente')
        if (!showOrderMap) setMobileView('detail')
    }

    const volverAlBorrador = () => {
        setSelectedUnifiedPedido(null)
        setPosContext('borrador')
        setMobileView('detail')
    }

    // El configurador del ítem se abre sobre la comanda para ajustar variantes,
    // ingredientes y extras sin perder el buscador permanente.
    const editarItemComanda = useCallback((key: string) => {
        posRef.current?.editItem(key)
    }, [])

    const abrirNuevoPedido = () => {
        if (!posActivo) return
        // El alta parte siempre de una comanda vacía, incluso si había un
        // borrador persistido o se estaba editando otro pedido.
        try { sessionStorage.removeItem(posDraftStorageKey(sucursalActivaId)) } catch { /* noop */ }
        posRef.current?.clearDraft()
        setDraftPos(null)
        setListadoActivo('pedidos')
        setShowOrderMap(false)
        setSelectedUnifiedPedido(null)
        setPedidoPosEditando(null)
        setMesaPosAsignada(null)
        setPosContext('borrador')
        setShowPosMovil(true)
        setMobileView('detail')
    }

    // Al estar viendo un pedido, el POS sigue visible detrás. Cualquier zona libre
    // del POS vuelve al borrador; los controles conservan su interacción normal.
    const handlePosBackgroundClick = (event: MouseEvent<HTMLDivElement>) => {
        const target = event.target as Element
        if (target.closest('button, input, textarea, select, a, [role="button"]')) return
        volverAlBorrador()
    }

    useEffect(() => {
        if (!showPOS) setDraftPos(null)
    }, [showPOS])

    // En móvil el POS arranca abierto cuando el módulo está activo: replica el
    // comportamiento de desktop, donde el panel no tiene cierre.
    useEffect(() => {
        if (posActivo) setShowPosMovil(true)
    }, [posActivo])

    const handlePedidoManualCreado = (pedidoId: number) => {
        // El POS es un flujo de carga continua: después de anotar un pedido el
        // componente ya limpió su borrador. Marcamos el id antes de sincronizar
        // para que siempre se imprima aunque el WebSocket haya llegado primero.
        posOrdersPendingPrintRef.current.add(pedidoId)
        setMesaPosAsignada(null)
        fetchPedidos(1, false)
        fetchPedidosMesaAbiertos()
    }

    const editarPedidoEnPos = async (pedido: UnifiedPedido) => {
        if (!token || !posActivo) return
        // Editar otro pedido abandona cualquier fusión de mesa pendiente de guardar.
        mesaMergeRef.current = false
        setCargandoPedidoPos(true)
        try {
            const response = await pedidoUnificadoApi.getById(token, pedido.id) as { success?: boolean; data?: PosEditablePedido & { editable?: boolean; motivosNoEditable?: string[] } }
            const editable = response.data
            if (!response.success || !editable) return toast.error('No se pudo cargar el pedido')
            if (!editable.editable) return toast.error(editable.motivosNoEditable?.[0] || 'Este pedido ya no se puede editar')
            setShowOrderMap(false)
            setSelectedUnifiedPedido(null)
            setPedidoPosEditando(editable)
            setMesaPosAsignada(editable.tipo === 'mesa' && editable.mesaLocalId
                ? { id: editable.mesaLocalId, nombre: editable.mesaNombre || `Mesa ${editable.mesaLocalId}` }
                : null)
            setPosContext('borrador')
            setShowPosMovil(true)
            setMobileView('detail')
        } catch (error) {
            toast.error('No se pudo abrir la edición', { description: error instanceof Error ? error.message : undefined })
        } finally {
            setCargandoPedidoPos(false)
        }
    }

    const handlePedidoManualActualizado = (pedido: PosEditablePedido) => {
        // Si la edición fusionó el borrador con el pedido de una mesa, ese
        // borrador ya quedó consumido: se limpia para que no resurja en el alta siguiente.
        if (mesaMergeRef.current) {
            mesaMergeRef.current = false
            try { sessionStorage.removeItem(posDraftStorageKey(sucursalActivaId)) } catch { /* noop */ }
        }
        const actualizado = pedido as UnifiedPedido
        setUnifiedPedidos((prev) => prev.map((item) => item.id === actualizado.id ? { ...item, ...actualizado } : item))
        setPedidoPosEditando(pedido)
        setMesaPosAsignada(actualizado.tipo === 'mesa' && actualizado.mesaLocalId
            ? { id: actualizado.mesaLocalId, nombre: actualizado.mesaNombre || `Mesa ${actualizado.mesaLocalId}` }
            : null)
        setShowPosMovil(true)
        setPosContext('borrador')
        setSelectedUnifiedPedido(null)
        setMobileView('detail')
        fetchPedidos(1, false)
        fetchPedidosMesaAbiertos()
    }

    // ─────────────────────────────────────────────
    // RENDER DE LISTAS
    // ─────────────────────────────────────────────
    // El backend ya devuelve solo los pedidos del día seleccionado (endpoint /list-dia),
    // así que acá solo separamos activos de archivados.
    const activeOrders = unifiedPedidos.filter(p => p.estado !== 'archived')
    // Los consumos de mesa se operan exclusivamente desde la pestaña Mesas.
    // Una vez archivados permanecen en el historial general para su consulta.
    const activeOrdersListado = activeOrders.filter(p => p.tipo !== 'mesa' && !p.consumoEnLocal)
    const mesasOcupadas = new Set(
        pedidosMesaAbiertos
            .filter(p => p.mesaLocalId != null)
            .map(p => p.mesaLocalId),
    ).size
    const archivedOrders = unifiedPedidos.filter(p => p.estado === 'archived')

    const hoyDay = getArDayString(new Date())
    const abrirMesaLibre = (mesa: MesaLocal) => {
        if (mesasDialogMode === 'asignar-borrador') {
            setMesaPosAsignada({ id: mesa.id, nombre: mesa.nombre })
            setShowMesasDialog(false)
            setSelectedUnifiedPedido(null)
            setPosContext('borrador')
            setMobileView('detail')
            return
        }
        if (!posActivo) return
        setShowMesasDialog(false)
        setShowOrderMap(false)
        setSelectedUnifiedPedido(null)
        setMesaPosAsignada({ id: mesa.id, nombre: mesa.nombre })
        setPosContext('borrador')
        setShowPosMovil(true)
        setMobileView('detail')
    }

    const abrirMesaLibreDesdeListado = (mesa: MesaLocal) => {
        if (!posActivo) return
        // Una mesa libre siempre empieza una comanda nueva. No se arrastran los
        // productos ni los datos del borrador general o de otra mesa.
        try { sessionStorage.removeItem(posDraftStorageKey(sucursalActivaId)) } catch { /* noop */ }
        posRef.current?.clearDraft()
        // El POS emite el snapshot vacío en el siguiente efecto. Lo anticipamos
        // para no mostrar el estado transitorio "Comanda en blanco".
        setDraftPos(crearBorradorMesaVacio(mesa))
        setShowOrderMap(false)
        setSelectedUnifiedPedido(null)
        setPedidoPosEditando(null)
        setMesaPosAsignada({ id: mesa.id, nombre: mesa.nombre })
        setPosContext('borrador')
        setShowPosMovil(true)
        setMobileView('detail')
    }

    const abrirPedidoMesaDesdeListado = (pedido: UnifiedPedido) => {
        setMesaPosAsignada(null)
        openPedidoInPOS(pedido)
    }
    const abrirPedidoMesa = async (pedidoMesa: { id: number }) => {
        if (mesasDialogMode === 'asignar-borrador') {
            // Mesa ocupada durante un borrador: el borrador se suma al pedido
            // abierto. Se carga ese pedido en el POS en modo edición, con los
            // ítems del borrador ya fusionados, y se guarda con "Guardar cambios".
            const itemsBorrador = posRef.current?.getCartItems() ?? []
            const pedido = pedidosMesaAbiertos.find((candidato) => candidato.id === pedidoMesa.id)
            if (itemsBorrador.length === 0) {
                // Sin productos en el borrador no hay nada que sumar: se abre el
                // pedido de la mesa como siempre.
                if (!pedido) return
                setShowMesasDialog(false)
                setMesaPosAsignada(null)
                openPedidoInPOS(pedido)
                return
            }
            if (!token) return
            try {
                const response = await pedidoUnificadoApi.getById(token, pedidoMesa.id) as { success?: boolean; data?: PosEditablePedido & { editable?: boolean; motivosNoEditable?: string[] } }
                const editable = response.data
                if (!response.success || !editable) return toast.error('No se pudo cargar el pedido de la mesa')
                if (!editable.editable) return toast.error(editable.motivosNoEditable?.[0] || 'Este pedido ya no se puede editar')
                mesaMergeRef.current = true
                setShowMesasDialog(false)
                setShowOrderMap(false)
                setSelectedUnifiedPedido(null)
                setPedidoPosEditando({ ...editable, items: [...editable.items, ...itemsBorrador], dirtyOnLoad: true })
                setMesaPosAsignada(editable.tipo === 'mesa' && editable.mesaLocalId
                    ? { id: editable.mesaLocalId, nombre: editable.mesaNombre || `Mesa ${editable.mesaLocalId}` }
                    : null)
                setPosContext('borrador')
                setShowPosMovil(true)
                setMobileView('detail')
            } catch (error) {
                toast.error('No se pudo abrir el pedido de la mesa', { description: error instanceof Error ? error.message : undefined })
            }
            return
        }
        const pedido = pedidosMesaAbiertos.find((candidato) => candidato.id === pedidoMesa.id)
        if (!pedido) return
        setShowMesasDialog(false)
        setMesaPosAsignada(null)
        openPedidoInPOS(pedido)
    }
    // El selector del día sigue disponible al abrir el POS; solo el mapa lo reemplaza.
    const isDayTitle = !(mobileView === 'detail' && showOrderMap)

    const pickDay = (day: string) => {
        if (!day) return
        setSelectedDay(day)
        setSelectedUnifiedPedido(null)
        setShowDayPicker(false)
        setMobileView('orders')
    }

    // Link público de la tienda (para compartir cuando no hay pedido seleccionado)
    const publicUrl = restauranteStore?.username ? `https://piru.app/${restauranteStore.username}` : null

    if (!prefsReady) {
        const activasParaModal = sucursalesList.filter((s) => s.activo)
        return (
            <div className="relative h-full flex flex-col items-center justify-center bg-[#FFFBF0] dark:bg-background">
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
        return <div className="h-full flex items-center justify-center bg-[#FFFBF0] dark:bg-background"><Loader2 className="h-8 w-8 animate-spin text-[#FF7A00]" /></div>
    }

    return (
        <div className="h-full flex flex-col overflow-hidden bg-[#FFFBF0] dark:bg-background">

            {/* ── HEADER PRINCIPAL ── */}
            <header className="shrink-0 bg-[#FFFBF0] dark:bg-background px-4 py-3 flex items-center justify-between gap-2 z-10">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    {mobileView === 'detail' && (
                        <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9 -ml-2" onClick={() => {
                            if (showPOS) requestClosePOS()
                            else { setMobileView('orders'); setShowOrderMap(false) }
                        }}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    )}
                    {sucursalNombre ? (
                        <Badge variant="outline" className="hidden sm:flex text-xs border-[#FF7A00]/25 text-foreground">
                            <Store className="h-3 w-3 mr-1 text-[#FF7A00]" />
                            {sucursalNombre}
                        </Badge>
                    ) : null}
                </div>

                {/* ── TÍTULO CENTRAL: día seleccionado + selector ▲▼, con el botón
                    de anotar pedido justo debajo (centrado, entre lista y comanda) ── */}
                <div className="flex flex-col items-center justify-center shrink-0 gap-1.5">
                    {isDayTitle ? (
                        <button
                            onClick={() => setShowDayPicker(true)}
                            className="flex items-center gap-1.5 rounded-xl px-2 py-1 -my-1 transition-colors hover:bg-accent cursor-pointer"
                        >
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">
                                {cierreManualActivo
                                    ? (selectedTurnoId === turnoActual?.id ? 'Turno actual' : 'Turno cerrado')
                                    : formatDayTitle(selectedDay)}
                            </h1>
                            <ChevronsUpDown className="h-5 w-5 text-muted-foreground" />
                        </button>
                    ) : (
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            {showPOS && !showOrderMap
                                ? (pedidoPosEditando
                                    ? (pedidoPosEditando.tipo === 'mesa'
                                        ? (pedidoPosEditando.mesaNombre || (pedidoPosEditando.mesaLocalId != null ? `Mesa ${pedidoPosEditando.mesaLocalId}` : 'Mesa'))
                                        : `Editar #${pedidoPosEditando.id}`)
                                    : 'Anotar pedido')
                                : 'Mapa de pedidos'}
                        </h1>
                    )}
                    {/* En desktop el POS queda siempre abierto con el módulo activo;
                        el botón sólo permite reabrir el overlay móvil. */}
                    {!isDesktopViewport && posActivo && isDayTitle && !showPosMovil && (
                        <Button
                            variant="outline"
                            onClick={openPOS}
                            className="h-8 rounded-full px-4 text-xs gap-1.5 flex items-center"
                        >
                            <ShoppingCart className="h-3.5 w-3.5" />
                            Anotar pedido
                        </Button>
                    )}
                </div>

                <div className="flex items-center gap-2 flex-1 justify-end">
                    {mobileView === 'detail' && activeOrdersListado.length > 0 && (
                        <button
                            onClick={() => setShowMobileOrdersSheet(true)}
                            className="lg:hidden flex items-center gap-1.5 h-8 px-3 rounded-xl bg-muted border border-border text-xs font-bold text-foreground hover:bg-accent transition-colors"
                        >
                            <List className="h-3.5 w-3.5" />
                            {activeOrdersListado.length}
                        </button>
                    )}
                    <Button variant="outline" className="h-10 rounded-xl hidden sm:flex" onClick={() => setShowCierreTurno(true)}>
                        <CalendarDays className="mr-2 h-4 w-4" /> Caja
                    </Button>
                    {cierreManualActivo && turnoActual && selectedTurnoId === turnoActual.id && (
                        <Button className="h-10 rounded-xl" onClick={() => setShowCerrarTurno(true)}>
                            <Clock className="mr-2 h-4 w-4" /> Cerrar turno
                        </Button>
                    )}
                    {mesasActivo && !posActivo && selectedDay === hoyDay && (
                        <Button variant="outline" className="h-10 rounded-xl" onClick={() => { setMesasDialogMode('operar'); setShowMesasDialog(true) }}>
                            <Armchair className="mr-2 h-4 w-4" /> Mesas
                        </Button>
                    )}
                    <Button variant="outline" className="h-10 rounded-xl" onClick={() => {
                        // En desktop el POS nunca se cierra: el mapa se abre en el
                        // panel derecho conviviendo con el POS. En móvil el overlay
                        // se cierra primero (paridad con el flujo anterior).
                        if (showPosMovil && !isDesktopViewport) { requestClosePOS(); return }
                        setShowOrderMap(true); setMobileView('detail')
                    }}>
                        <MapIcon className="mr-2 h-4 w-4" /> Mapa
                    </Button>
                </div>
            </header>

            {/* ── MODAL: elegir el día que se muestra (rueda estilo iOS) ── */}
            <Dialog
                open={showDayPicker}
                onOpenChange={(open) => {
                    if (open) setPickerDay(selectedDay)
                    setShowDayPicker(open)
                }}
            >
                <DialogContent className="max-w-xs">
                    <DialogHeader>
                        <DialogTitle className="text-center text-3xl font-bold">{cierreManualActivo ? 'Elegí el turno' : 'Elegí el día'}</DialogTitle>
                        <DialogDescription className="sr-only">Se muestran solo los pedidos del {cierreManualActivo ? 'turno' : 'día'} que elijas.</DialogDescription>
                    </DialogHeader>

                    {cierreManualActivo ? (
                        <div className="max-h-[60vh] space-y-1 overflow-auto">
                            {turnosCaja.map((turno) => {
                                const apertura = new Date(turno.aperturaAt); apertura.setHours(apertura.getHours() + 3)
                                const cierre = turno.cierreAt ? new Date(turno.cierreAt) : null; if (cierre) cierre.setHours(cierre.getHours() + 3)
                                const hora = (fecha: Date) => fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
                                const label = turno.abierto
                                    ? `Turno actual · desde ${hora(apertura)}`
                                    : `${apertura.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}, ${hora(apertura)} a ${cierre!.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}, ${hora(cierre!)}`
                                return <button key={turno.id} onClick={() => { setSelectedTurnoId(turno.id); setShowDayPicker(false) }} className={cn('w-full rounded-xl px-4 py-3 text-left text-sm', selectedTurnoId === turno.id ? 'bg-[#FF7A00] text-white font-semibold' : 'hover:bg-muted')}>{label}</button>
                            })}
                        </div>
                    ) : (() => {
                        const canNewer = pickerDay < hoyDay
                        const goNewer = () => { if (pickerDay < hoyDay) setPickerDay(shiftDayString(pickerDay, 1)) }
                        const goOlder = () => setPickerDay(shiftDayString(pickerDay, -1))
                        // offsets de arriba (futuro) hacia abajo (pasado): +2 .. -2
                        const rows = [2, 1, 0, -1, -2].map((offset) => {
                            const day = shiftDayString(pickerDay, offset)
                            const disabled = day > hoyDay // no hay días futuros
                            return { offset, day, disabled }
                        })
                        const styleFor = (offset: number) => {
                            const abs = Math.abs(offset)
                            if (abs === 0) return "text-3xl font-bold text-[#FF7A00] opacity-100"
                            if (abs === 1) return "text-xl font-semibold text-foreground opacity-60"
                            return "text-base font-medium text-foreground opacity-25"
                        }
                        return (
                            <div className="flex flex-col items-center gap-3 py-2">
                                <button
                                    type="button"
                                    onClick={goNewer}
                                    disabled={!canNewer}
                                    aria-label="Día siguiente"
                                    className="h-9 w-9 flex items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none"
                                >
                                    <ChevronUp className="h-6 w-6" />
                                </button>

                                <div
                                    onWheel={(e) => {
                                        e.preventDefault()
                                        if (e.deltaY > 0) goOlder()
                                        else if (e.deltaY < 0) goNewer()
                                    }}
                                    className="relative w-full select-none overflow-hidden"
                                    style={{ height: '13rem' }}
                                >
                                    {/* franja del elemento seleccionado */}
                                    <div className="pointer-events-none absolute inset-x-3 top-1/2 h-[2.6rem] -translate-y-1/2 rounded-xl bg-[#FF7A00]/10 border-y border-[#FF7A00]/30" />
                                    {/* degradados de desvanecido arriba/abajo */}
                                    <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-background to-transparent z-10" />
                                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent z-10" />

                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                                        {rows.map(({ offset, day, disabled }) => (
                                            <button
                                                key={offset}
                                                type="button"
                                                disabled={disabled}
                                                onClick={() => { if (!disabled) setPickerDay(day) }}
                                                className={cn(
                                                    "h-[2.6rem] w-full text-center leading-[2.6rem] transition-all duration-150",
                                                    disabled ? "opacity-0 pointer-events-none" : styleFor(offset),
                                                    offset !== 0 && !disabled && "hover:opacity-90"
                                                )}
                                            >
                                                {formatDayTitle(day)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={goOlder}
                                    aria-label="Día anterior"
                                    className="h-9 w-9 flex items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                                >
                                    <ChevronDown className="h-6 w-6" />
                                </button>

                                <Button
                                    onClick={() => pickDay(pickerDay)}
                                    className="mt-2 h-11 px-10 rounded-full bg-[#FF7A00] hover:bg-[#FF7A00]/90 text-white font-semibold"
                                >
                                    Confirmar
                                </Button>
                            </div>
                        )
                    })()}
                </DialogContent>
            </Dialog>

            {/* Los banners superiores son siempre descartables desde el Dashboard. */}
            {showTrialBanner && <TrialValorBanner onDismiss={() => setShowTrialBanner(false)} />}
            {showSaldoBanner && <SaldoAlertaBanner onDismiss={() => setShowSaldoBanner(false)} />}

            {/* ── MAIN CONTENT ── */}
            <div className="relative flex-1 flex overflow-hidden lg:justify-center lg:gap-4 lg:p-4">

                {dashboardMode === 'orders' && posActivo && (
                    <Button
                        type="button"
                        onClick={abrirNuevoPedido}
                        className="absolute left-3 right-3 top-2 z-[60] h-11 rounded-xl bg-[#FF7A00] text-base font-bold text-white hover:bg-[#E66E00] lg:left-auto lg:right-auto lg:top-4 lg:w-[calc(100%-2rem)] lg:max-w-[1016px] xl:w-[1136px] xl:max-w-none 2xl:w-[1216px]"
                    >
                        + Nuevo pedido
                    </Button>
                )}

                {dashboardMode === 'orders' ? (
                    <>
                        {/* ── PANEL IZQUIERDO: LISTA COMPACTA DE PEDIDOS ── */}
                        <div className={cn(
                            "mt-14 min-h-0 w-full flex-col shrink-0 bg-[#FFFBF0] dark:bg-background lg:rounded-2xl lg:overflow-hidden",
                            "lg:w-[400px] xl:w-[520px] 2xl:w-[600px]",
                            mobileView === 'orders' ? 'flex' : 'hidden lg:flex'
                        )}>
                            <div className="p-3 flex items-center justify-between bg-[#FFFBF0]/95 dark:bg-background/95 backdrop-blur">
                                {posActivo && mesasActivo ? (
                                    <div className="flex items-center gap-1 rounded-xl bg-muted/60 p-1">
                                        <button
                                            type="button"
                                            onClick={() => setListadoActivo('pedidos')}
                                            className={cn('flex h-8 items-center gap-2 rounded-lg px-3 text-sm font-bold transition-colors', listadoActivo === 'pedidos' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                                        >
                                            Pedidos
                                            <Badge className="bg-[#FF7A00] hover:bg-[#FF7A00] text-white rounded-full px-2 py-0">{activeOrdersListado.length}</Badge>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setListadoActivo('mesas')
                                                if (selectedDay !== hoyDay) setSelectedDay(hoyDay)
                                            }}
                                            className={cn('flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-bold transition-colors', listadoActivo === 'mesas' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                                        >
                                            <Armchair className="h-3.5 w-3.5" /> Mesas
                                            <Badge className="bg-[#FF7A00] hover:bg-[#FF7A00] text-white rounded-full px-2 py-0">{mesasOcupadas}</Badge>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <h2 className="font-bold text-base">Pedidos</h2>
                                        <Badge className="bg-[#FF7A00] hover:bg-[#FF7A00] text-white rounded-full px-2 py-0">{activeOrdersListado.length}</Badge>
                                    </div>
                                )}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                        {mesasActivo && (
                                            <DropdownMenuItem onClick={() => { setMesasDialogMode('operar'); setShowMesasDialog(true) }}>
                                                <Armchair className="h-4 w-4 mr-2" /> Ver mapa de mesas
                                            </DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem onClick={openMetodosPagoModal}>
                                            <Settings className="h-4 w-4 mr-2" /> Pagos
                                        </DropdownMenuItem>
                                        {gestionCadetesActiva && (
                                            <DropdownMenuItem onClick={() => setRepartidoresModalOpen(true)}>
                                                <UserRound className="h-4 w-4 mr-2" /> Repartidores
                                            </DropdownMenuItem>
                                        )}
                                        {sucursalesList.some((s) => s.activo) ? (
                                            <DropdownMenuItem onClick={() => setShowSucursalSelector(true)}>
                                                <Store className="h-4 w-4 mr-2" /> Cambiar sucursal
                                            </DropdownMenuItem>
                                        ) : null}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <div className="flex-1 overflow-y-auto p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                {posActivo && mesasActivo && (
                                    <div className={cn(listadoActivo !== 'mesas' && 'hidden')}>
                                        <MesasGrid
                                            token={token}
                                            sucursalId={sucursalActivaId}
            pedidos={pedidosMesaAbiertos}
                                            refreshKey={lastUpdate?.timestamp}
                                            onMesaLibre={abrirMesaLibreDesdeListado}
                                            onMesaOcupada={abrirPedidoMesaDesdeListado}
                                            selectedMesaId={mesaPosAsignada?.id}
                                        />
                                    </div>
                                )}
                                {!(posActivo && mesasActivo && listadoActivo === 'mesas') && (activeOrdersListado.length === 0 ? (
                                    <div className="h-32 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-2xl">
                                        <Receipt className="h-6 w-6 mb-2 opacity-40" />
                                        <p className="text-sm font-medium">No hay pedidos activos</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {activeOrdersListado.map((pedido, index) => {
                                            const isSelected = selectedUnifiedPedido?.id === pedido.id && selectedUnifiedPedido?.tipo === pedido.tipo;
                                            const pagoBadge = metodoPagoListBadge(pedido.metodoPago);
                                            const dateLabel = getDateLabel(pedido.createdAt);
                                            const prevDateLabel = index > 0 ? getDateLabel(activeOrdersListado[index - 1].createdAt) : null;
                                            const showDateSeparator = dateLabel !== prevDateLabel;

                                            return (
                                                <Fragment key={pedido.id}>
                                                    {showDateSeparator && (
                                                        <div className={`flex items-center gap-3 ${index === 0 ? 'pb-1' : 'pt-3 pb-1'}`}>
                                                            <span className="text-[10px] font-bold text-muted-foreground uppercase">{dateLabel}</span>
                                                        </div>
                                                    )}
                                                    <Card
                                                        onClick={() => openPedidoInPOS(pedido)}
                                                        className={cn(
                                                            "px-3.5 py-2.5 rounded-xl cursor-pointer transition-all flex flex-col gap-1.5 border-0",
                                                            isSelected
                                                                ? "bg-muted/40 border-l-[3px] border-l-[#FF7A00]"
                                                                : "bg-white dark:bg-muted/20 hover:bg-muted/40"
                                                        )}
                                                    >
                                                        <div className="flex justify-between items-start gap-2">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="font-bold text-sm">#{pedido.id}</span>
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                                                                    <PedidoTipoIcon tipo={pedido.tipo} className="h-3 w-3" />
                                                                    {pedidoTipoLabel(pedido)}
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
                                                                {!esPlanBasico && !pedido.pagado && (
                                                                    <Badge className="bg-muted text-muted-foreground text-[9px] px-1 border border-border hover:bg-muted/80">Pendiente</Badge>
                                                                )}
                                                                {!esPlanBasico && pagoBadge && (
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

                                                        <div className="flex justify-between items-center gap-3">
                                                            <div className="min-w-0 flex-1">
                                                                {pedido.nombreCliente && <p className="text-sm font-semibold text-foreground truncate">{pedido.nombreCliente}</p>}
                                                                {pedido.tipo === 'delivery' && pedido.direccion && (
                                                                    <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                                                                        <MapPin className="h-2.5 w-2.5 shrink-0" /> {formatDireccionCorta(pedido.direccion)}
                                                                    </p>
                                                                )}
                                                            </div>

                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatTimeAgo(pedido.createdAt)}</span>
                                                                {pedido.pagado && puedeAvisarWhatsapp && (
                                                                    <button
                                                                        title="Avisar al cliente"
                                                                        className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors disabled:opacity-50 cursor-pointer"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleNotificarCliente(pedido);
                                                                        }}
                                                                        disabled={sendingNotification === pedido.id.toString()}
                                                                    >
                                                                        {sendingNotification === pedido.id.toString()
                                                                            ? <Loader2 className="h-4 w-4 animate-spin" />
                                                                            : <MessageCircle className="h-4 w-4" />}
                                                                    </button>
                                                                )}
                                                                <button
                                                                    title="Despachar"
                                                                    className="h-8 w-8 rounded-lg flex items-center justify-center text-white shrink-0 transition-colors disabled:opacity-50 cursor-pointer bg-[#FF7A00] hover:bg-[#E66E00]"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        void handleDespachar(pedido.tipo, pedido.id);
                                                                    }}
                                                                >
                                                                    <Truck className="h-4 w-4" />
                                                                </button>
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
                                ))}

                                {/* Pedidos Archivados */}
                                {listadoActivo === 'pedidos' && archivedOrders.length > 0 && (
                                    <div className="pt-6 pb-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowArchived(v => !v)}
                                            className="flex items-center gap-3 mb-3 w-full group"
                                        >
                                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest pl-1 group-hover:text-foreground transition-colors">Historial</span>
                                            <span className="text-[10px] font-bold text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 leading-none">{archivedOrders.length}</span>
                                            <ChevronDown className={cn("h-4 w-4 text-muted-foreground group-hover:text-foreground transition-all", showArchived && "rotate-180")} />
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
                                                                onClick={() => openPedidoInPOS(pedido)}
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

                        {/* ── PANEL DERECHO: DETALLE OPERATIVO ──
                            Ancho fijo al del ticket (≈600px) para que el panel no sea más grande
                            que su contenido. El margen derecho en xl/2xl compensa el ensanche de la
                            lista: mantiene el centro del detalle en el mismo punto para que NO se
                            mueva a la derecha cuando la lista crece. El POS activo reutiliza este
                            mismo layout de dos columnas y despliega el catálogo dentro del borrador. */}
                        <div className={cn(
                            "mt-14 min-h-0 w-full bg-[#FFFBF0] dark:bg-background relative overflow-hidden lg:rounded-2xl",
                            "lg:flex-1 lg:max-w-[600px] xl:flex-none xl:w-[600px]",
                            mobileView === 'detail' ? 'flex flex-col' : 'hidden lg:flex lg:flex-col'
                        )}>
                            {showPOS && isDesktopViewport && (
                                <PuntoDeVenta
                                    key={pedidoPosEditando ? `pos-edit-${pedidoPosEditando.id}-${pedidoPosEditando.version}` : 'pos-activo'}
                                    ref={posRef}
                                    onClose={closePOS}
                                    onCreated={handlePedidoManualCreado}
                                    onUpdated={handlePedidoManualActualizado}
                                    onDeletePedido={() => pedidoPosEditando && abrirDialogoEliminarPedido(pedidoPosEditando)}
                                    sucursalActivaId={sucursalActivaId}
                                    sucursalNombre={sucursalNombre}
                                    onDraftChange={setDraftPos}
                                    onStartDraft={pedidoPosEditando ? undefined : volverAlBorrador}
                                    mesaAsignada={mesaPosAsignada}
                                    onClearMesa={() => setMesaPosAsignada(null)}
                                    onMesaOcupadaDetectada={fetchPedidosMesaAbiertos}
                                    autoFocusSearch={posContext === 'borrador'}
                                    initialPedido={pedidoPosEditando}
                                    mostrarBotonCerrar={false}
                                    catalogoCompacto
                                />
                            )}
                            {showPOS && posContext === 'borrador' ? (
                                cargandoPedidoPos ? (
                                    <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                                        <Loader2 className="h-6 w-6 animate-spin text-[#FF7A00]" />
                                        <span className="text-sm font-medium">Cargando pedido…</span>
                                    </div>
                                ) : (
                                    <PosComandaPreview
                                        draft={draftPos}
                                        onEditItem={editarItemComanda}
                                        onRemoveItem={(key) => posRef.current?.removeItem(key)}
                                        onUpdate={(changes) => posRef.current?.updateDraft(changes)}
                                        onSubmit={() => posRef.current?.submitDraft()}
                                        onDispatchMesa={async () => {
                                            const pedidoId = await posRef.current?.submitDraft()
                                            if (pedidoId) await handleDespachar('mesa', pedidoId)
                                        }}
                                        onClear={() => pedidoPosEditando
                                            ? abrirDialogoEliminarPedido(pedidoPosEditando)
                                            : posRef.current?.clearDraft()}
                                        onClearMesa={() => setMesaPosAsignada(null)}
                                        editingPedidoId={pedidoPosEditando?.id}
                                        mesaAsignada={mesaPosAsignada}
                                    />
                                )
                            ) : showOrderMap ? (
                                <OrderMapView
                                    orders={activeOrders}
                                    onClose={() => { setShowOrderMap(false); setMobileView('orders') }}
                                    externalSelected={selectedUnifiedPedido}
                                    onSelectPedido={(pedido) => {
                                        if (pedido) openPedidoInPOS(pedido)
                                        else setSelectedUnifiedPedido(null)
                                    }}
                                    onAprobarPago={handleAprobarPago}
                                    onNotificar={puedeAvisarWhatsapp ? handleNotificarCliente : undefined}
                                    onDespachar={(pedido) => handleDespachar(pedido.tipo, pedido.id)}
                                    updatingPago={updatingPago}
                                    sendingNotification={sendingNotification}
                                    asignandoRepartidor={asignandoRepartidor}
                                    onShowOrdersList={() => setShowMobileOrdersSheet(true)}
                                />
                            ) : selectedUnifiedPedido ? (
                                <div className="flex h-full w-full overflow-hidden">
                                <div className="flex flex-col h-full relative flex-1 min-w-0">

                                    {/* --- DETALLE UNIFICADO: ticket angosto en una sola columna (mobile y desktop) --- */}
                                    <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                        <div className="w-full max-w-[600px] mx-auto px-5 lg:px-6 pt-6 pb-40">

                                            {/* Tipo */}
                                            <div className="flex items-center justify-between mb-6">
                                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                                    <PedidoTipoIcon tipo={selectedUnifiedPedido.tipo} className="h-3.5 w-3.5" />
                                                    {pedidoTipoLabel(selectedUnifiedPedido)}
                                                </span>
                                            </div>

                                            {/* Identidad: quién y dónde — orden de lectura del ticket */}
                                            <div className="mb-6 text-left">
                                                <h2 className="text-4xl font-black text-foreground tracking-tight leading-none">{pedidoTitulo(selectedUnifiedPedido)}</h2>
                                                {selectedUnifiedPedido.nombreCliente && (
                                                    <p className="mt-3 text-xl font-bold text-foreground leading-snug">{selectedUnifiedPedido.nombreCliente}</p>
                                                )}
                                                <div className="mt-2 space-y-1.5">
                                                    {selectedUnifiedPedido.tipo === 'delivery' ? (
                                                        selectedUnifiedPedido.direccion && (
                                                            <p className="flex items-start justify-start gap-2 text-base font-semibold text-foreground leading-snug">
                                                                <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                                                                <span>{formatDireccionCorta(selectedUnifiedPedido.direccion)}</span>
                                                            </p>
                                                        )
                                                    ) : selectedUnifiedPedido.tipo === 'mesa' ? (
                                                        <p className="flex items-center justify-start gap-2 text-base font-semibold text-foreground">
                                                            <Armchair className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                            {selectedUnifiedPedido.mesaNombre || 'Mesa asignada'}
                                                        </p>
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
                                                    {(() => {
                                                        const metodoPago = metodoPagoListBadge(selectedUnifiedPedido.metodoPago)
                                                        if (!metodoPago) return null
                                                        return (
                                                            <p className="flex items-center justify-start gap-2 text-sm text-muted-foreground">
                                                                <CreditCard className="h-3.5 w-3.5 shrink-0" />
                                                                {metodoPago.label}
                                                            </p>
                                                        )
                                                    })()}
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

                                            {/* Contexto del cliente */}
                                            {clienteContexto && (
                                                <div className="mb-6 space-y-4">
                                                    <Separator className="bg-border/60" />
                                                    <ClienteContextoLine ctx={clienteContexto} />
                                                    <Separator className="bg-border/60" />
                                                </div>
                                            )}

                                            {/* Cobro (si no está pagado). El botón "Cobrar" para métodos ya elegidos vive
                                                solo en el footer; acá quedan únicamente las opciones de verificación manual. */}
                                            {!esPlanBasico && !selectedUnifiedPedido.pagado && selectedUnifiedPedido.estado !== 'archived' && !pedidoCobroManualYaElegido(selectedUnifiedPedido.metodoPago) && (
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
                                                </div>
                                            )}

                                            {/* Confirmar con demora — slider */}
                                            {puedeAvisarWhatsapp && restauranteStore?.modoConfirmacionManual && selectedUnifiedPedido.notificarWhatsapp && selectedUnifiedPedido.telefono && selectedUnifiedPedido.estado !== 'archived' && (
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
                                                                                        {formatNombreConVariantes(item.nombreProducto, item.varianteNombre, item.varianteSecundariaNombre)}
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
                                                                                    {item.nota && <p className="mt-1 text-sm font-semibold text-amber-700 dark:text-amber-400">Nota: {item.nota}</p>}
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
                                                                                {formatNombreConVariantes(item.nombreProducto, item.varianteNombre, item.varianteSecundariaNombre)}
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
                                                                            {item.nota && <p className="mt-1 text-sm font-semibold text-amber-700 dark:text-amber-400">Nota: {item.nota}</p>}
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

                                            {/* Ubicación — se abre en un mapa flotante (solo delivery) */}
                                            {selectedUnifiedPedido.tipo === 'delivery' && (
                                                <div className="mb-6">
                                                    <button
                                                        onClick={() => setShowMapaDialog(true)}
                                                        className="w-full flex items-center justify-between gap-2 h-12 px-4 rounded-2xl border border-border bg-muted/30 hover:bg-muted/50 transition-colors text-sm font-bold text-foreground cursor-pointer"
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <MapIcon className="h-4 w-4 text-muted-foreground" />
                                                            Ubicación
                                                        </span>
                                                    </button>
                                                </div>
                                            )}

                                            {/* Reimprimir comprobante */}
                                            {selectedPrinter && (
                                                <div className="flex justify-center">
                                                    <Button variant="ghost" className="text-muted-foreground border border-border bg-[#FFFBF0] dark:bg-background" onClick={() => {
                                                        const itemsToPrint = selectedUnifiedPedido.items.map((item: any) => {
                                                            const producto = allProductos.find((candidate) => candidate.id === item.productoId)
                                                            return {
                                                                ...item,
                                                                precioUnitario: item.precioUnitario || '0',
                                                                producto,
                                                                categoriaEsBebida: producto?.categoriaEsBebida ?? false,
                                                            }
                                                        })
                                                        const deliveryFee = selectedUnifiedPedido.tipo === 'delivery' ? getOrderDeliveryFee(selectedUnifiedPedido) : 0
                                                        const data = formatComanda({
                                                            id: selectedUnifiedPedido.id,
                                                            nombrePedido: selectedUnifiedPedido.nombreCliente || '',
                                                            telefono: selectedUnifiedPedido.telefono,
                                                            direccion: selectedUnifiedPedido.tipo === 'delivery' ? selectedUnifiedPedido.direccion : undefined,
                                                            tipo: selectedUnifiedPedido.tipo,
                                                            mesaNombre: selectedUnifiedPedido.mesaNombre,
                                                            total: selectedUnifiedPedido.total,
                                                            deliveryFee,
                                                            notas: selectedUnifiedPedido.notas,
                                                            metodoPago: selectedUnifiedPedido.metodoPago,
                                                            montoDescuento: selectedUnifiedPedido.montoDescuento,
                                                            codigoDescuentoCodigo: selectedUnifiedPedido.codigoDescuentoCodigo,
                                                            sucursalNombre: selectedUnifiedPedido.sucursalNombre,
                                                            horarioProgramado: selectedUnifiedPedido.horarioProgramado,
                                                            grupal: selectedUnifiedPedido.grupal,
                                                        }, itemsToPrint, restaurante?.nombre || 'Restaurante', {
                                                            grandeMayusculas: comandaGrandeMayusculas,
                                                        })
                                                        printRaw(commandsToBytes(data))
                                                    }}>
                                                        <Printer className="mr-2 h-4 w-4" /> Reimprimir Comprobante
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Footer sticky: total (única aparición) + acción. Anclado al panel, no fixed. */}
                                    <div className="absolute bottom-0 left-0 right-0 z-40 bg-[#FFFBF0] dark:bg-background">
                                        <div className="w-full max-w-[600px] mx-auto px-5 lg:px-6 pt-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] flex flex-col gap-3">
                                            <div className="flex items-baseline justify-between gap-3">
                                                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
                                                    {esPlanBasico ? 'Total' : selectedUnifiedPedido.pagado ? 'Total cobrado' : 'Total a cobrar'}
                                                </span>
                                                <span className="text-3xl font-black tracking-tight text-[#FF7A00]">
                                                    ${computeOrderTotal(selectedUnifiedPedido).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                                </span>
                                            </div>
                                                {/* Eliminar siempre disponible — también en el historial (archived/despachado) */}
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => abrirDialogoEliminarPedido(selectedUnifiedPedido)}
                                                        className="h-14 w-14 rounded-2xl bg-secondary/30 border border-border/50 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0 cursor-pointer"
                                                    >
                                                        <Trash2 className="h-5 w-5" />
                                                    </button>
                                                    {selectedUnifiedPedido.estado !== 'archived' && (
                                                        <>
                                                            {selectedUnifiedPedido.pagado && puedeAvisarWhatsapp && (
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
                                                                className="flex-1 h-14 rounded-2xl text-white font-bold text-lg transition-all active:scale-[0.98] bg-[#FF7A00] hover:bg-[#E66E00]"
                                                                onClick={() => void handleDespachar(selectedUnifiedPedido.tipo, selectedUnifiedPedido.id)}
                                                            >
                                                                Despachar Pedido
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                        </div>
                                    </div>

                                </div>
                                </div>
                            ) : (
                                <ShareLinkPanel publicUrl={publicUrl} />
                            )}
                        </div>

                        {/* ── POS (solo móvil) ──
                            En lg+ el POS es la columna inline del medio (arriba). En móvil, en
                            cambio, cubre la pantalla como overlay y la comanda queda detrás. */}
                        {showPosMovil && !isDesktopViewport && (
                            <div className="absolute inset-0 z-50 lg:hidden flex items-center justify-center px-3 pb-3 pt-16 sm:px-6 sm:pb-6 pointer-events-none">
                                <div
                                    onClick={handlePosBackgroundClick}
                                    className="pointer-events-auto w-full max-w-5xl h-full max-h-[860px] rounded-2xl bg-background shadow-2xl overflow-hidden"
                                >
                                    <PuntoDeVenta
                                        key={pedidoPosEditando ? `pos-edit-${pedidoPosEditando.id}-${pedidoPosEditando.version}` : 'pos-activo'}
                                        ref={posRef}
                                        onClose={closePOS}
                                        onCreated={handlePedidoManualCreado}
                                        onUpdated={handlePedidoManualActualizado}
                                        onDeletePedido={() => pedidoPosEditando && abrirDialogoEliminarPedido(pedidoPosEditando)}
                                        sucursalActivaId={sucursalActivaId}
                                        sucursalNombre={sucursalNombre}
                                        onDraftChange={setDraftPos}
                                        onStartDraft={pedidoPosEditando ? undefined : volverAlBorrador}
                                        mesaAsignada={mesaPosAsignada}
                                        onClearMesa={() => setMesaPosAsignada(null)}
                                        onMesaOcupadaDetectada={fetchPedidosMesaAbiertos}
                                        autoFocusSearch={posContext === 'borrador'}
                                        initialPedido={pedidoPosEditando}
                                    />
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    /* ── PANTALLA NUEVO PEDIDO MANUAL ── */
                    <div className="flex-1 p-4 flex flex-col items-center justify-center bg-[#FFFBF0] dark:bg-background">
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
                        className="absolute bottom-0 left-0 right-0 bg-[#FFFBF0] dark:bg-background rounded-t-3xl flex flex-col"
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
                                    {activeOrdersListado.length}
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
                            {activeOrdersListado.length === 0 ? (
                                <div className="text-center py-10 text-muted-foreground text-sm">
                                    <Receipt className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                    No hay pedidos activos
                                </div>
                            ) : (
                                activeOrdersListado.map(pedido => {
                                    const isSelected = selectedUnifiedPedido?.id === pedido.id && selectedUnifiedPedido?.tipo === pedido.tipo
                                    const pagoBadge = metodoPagoListBadge(pedido.metodoPago)
                                    return (
                                        <div
                                            key={`sheet-${pedido.tipo}-${pedido.id}`}
                                            onClick={() => {
                                                openPedidoInPOS(pedido)
                                                setShowMobileOrdersSheet(false)
                                            }}
                                            className={cn(
                                                "flex items-center justify-between p-3 rounded-xl border cursor-pointer active:scale-[0.99] transition-all",
                                                isSelected
                                                    ? "bg-[#FF7A00]/10 border-[#FF7A00]/30"
                                                    : "bg-white dark:bg-muted/20 border-border hover:bg-muted/40"
                                            )}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-bold text-sm">#{pedido.id}</span>
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                                                        <PedidoTipoIcon tipo={pedido.tipo} className="h-3 w-3" />
                                                        {pedidoTipoLabel(pedido)}
                                                    </span>
                                                    {!esPlanBasico && !pedido.pagado && (
                                                        <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400">Sin cobrar</span>
                                                    )}
                                                    {!esPlanBasico && pagoBadge && (
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
                                                        <MapPin className="h-2.5 w-2.5 shrink-0" />{formatDireccionCorta(pedido.direccion)}
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

            {/* ── MAPA FLOTANTE (ubicación del pedido) ── */}
            <Dialog open={showMapaDialog} onOpenChange={setShowMapaDialog}>
                <DialogContent className="max-w-lg p-0 overflow-hidden rounded-[28px] border border-border bg-background">
                    <DialogHeader className="px-5 pt-5 pb-3">
                        <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                            <MapIcon className="h-5 w-5 text-[#FF7A00]" /> Ubicación
                        </DialogTitle>
                        <DialogDescription className="sr-only">Mapa con la ubicación de entrega del pedido.</DialogDescription>
                    </DialogHeader>
                    <div className="w-full aspect-[4/3] relative bg-background">
                        {selectedUnifiedPedido && (
                            <OrderMiniMap orders={activeOrders} selected={selectedUnifiedPedido} />
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── PLANO OPERATIVO DE MESAS ── */}
            <Dialog open={showMesasDialog} onOpenChange={setShowMesasDialog}>
                <DialogContent className="flex h-[70vh] w-[60vw] max-w-[60vw] flex-col overflow-hidden rounded-[28px] border border-border bg-background p-0 sm:max-w-[60vw]">
                    <DialogHeader className="px-5 pt-5 pb-3">
                        <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                            <Armchair className="h-5 w-5 text-[#FF7A00]" /> {mesasDialogMode === 'asignar-borrador' ? 'Elegir mesa' : 'Mesas'}
                        </DialogTitle>
                        <DialogDescription className="sr-only">{mesasDialogMode === 'asignar-borrador' ? 'Elegí una mesa libre para asignarla al borrador, u ocupada para sumarle los productos del borrador.' : 'Plano operativo de mesas.'}</DialogDescription>
                    </DialogHeader>
                    <div className="min-h-0 flex-1 px-5 pb-5">
                        <MesasOperativas
                            token={token}
                            sucursalId={sucursalActivaId}
                            pedidos={pedidosMesaAbiertos}
                            refreshKey={lastUpdate?.timestamp}
                            onMesaLibre={abrirMesaLibre}
                            onMesaOcupada={abrirPedidoMesa}
                            selectionMode={mesasDialogMode === 'asignar-borrador'}
                            selectedMesaId={mesasDialogMode === 'asignar-borrador' ? mesaPosAsignada?.id : null}
                        />
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── DIÁLOGO ELIMINAR ── */}
            <Dialog open={showDeleteDialog} onOpenChange={(open) => {
                setShowDeleteDialog(open)
                if (!open) setPedidoAEliminar(null)
            }}>
                <DialogContent className="max-w-sm rounded-[32px] p-6 sm:p-8 border border-border bg-background text-center">
                    <div className="h-16 w-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Trash2 className="h-8 w-8 text-red-500" />
                    </div>
                    <DialogTitle className="text-2xl font-bold mb-2 text-center">¿Eliminar pedido?</DialogTitle>
                    <DialogDescription className="text-base text-center mb-8">
                        Esta acción es irreversible. El pedido desaparecerá del sistema.
                    </DialogDescription>
                    <div className="flex gap-3">
                        <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold border-border" onClick={() => {
                            setShowDeleteDialog(false)
                            setPedidoAEliminar(null)
                        }}>Cancelar</Button>
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

            <CierreTurno open={showCierreTurno} onClose={() => setShowCierreTurno(false)} fechaInicial={cierreManualActivo ? undefined : selectedDay} turnoIdInicial={cierreManualActivo ? selectedTurnoId ?? undefined : undefined} />
            <Dialog open={showCerrarTurno} onOpenChange={setShowCerrarTurno}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Cerrar el turno actual</DialogTitle>
                        <DialogDescription>Los pedidos recibidos desde la apertura quedarán agrupados en este turno. Se abrirá uno nuevo inmediatamente.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCerrarTurno(false)} disabled={cerrandoTurno}>Cancelar</Button>
                        <Button onClick={confirmarCierreTurno} disabled={cerrandoTurno}>{cerrandoTurno && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Cerrar turno</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
