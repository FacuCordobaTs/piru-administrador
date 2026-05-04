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
import { deliveryApi, takeawayApi, pedidoUnificadoApi, restauranteApi, sucursalesApi } from '@/lib/api'
import { SucursalSelector, type SucursalListRow } from '@/components/SucursalSelector'
import { useAdminContext } from '@/context/AdminContext'
import CierreTurno from '@/components/CierreTurno'
import {
  Loader2, Plus, Clock, Trash2, AlertCircle,
  User, ArrowLeft, Printer, Truck, MapPin,
  Phone, ShoppingBag, CalendarDays, Tag, Settings, CheckCircle2,
  Receipt, Wallet, Zap, CreditCard, ChevronDown, CheckCircle,
  MessageCircle, Store,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
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
  agregados?: any; varianteNombre?: string;
}
interface UnifiedPedido {
  id: number; tipo: 'delivery' | 'takeaway'; estado: string; total: string; createdAt: string;
  nombreCliente: string | null; telefono: string | null; direccion?: string | null; notas?: string | null;
  items: DeliveryItem[]; totalItems: number; pagado?: boolean; metodoPago?: string | null;
  montoDescuento?: string | number | null; codigoDescuentoCodigo?: string | null; impreso?: boolean;
  sucursalId?: number | null;
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

const getOrderDeliveryFee = (pedido: { total: string; items: any[] }) => {
  const total = parseFloat(pedido.total)
  const itemsSubtotal = pedido.items.reduce((sum, item) => {
    const basePrice = parseFloat(item.precioUnitario || '0')
    const agregadosTotal = formatAgregados(item.agregados).reduce((a, ag) => a + parseFloat(ag.precio || '0'), 0)
    return sum + ((basePrice + agregadosTotal) * item.cantidad)
  }, 0)
  return Math.max(0, Math.round((total - itemsSubtotal) * 100) / 100)
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

const pedidoTieneCuponDescuento = (p: { montoDescuento?: string | number | null }) =>
  p.montoDescuento != null && parseFloat(String(p.montoDescuento)) > 0

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
  const { isConnected, lastUpdate } = useAdminContext()

  // Estados Principales
  const [unifiedPedidos, setUnifiedPedidos] = useState<UnifiedPedido[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedUnifiedPedido, setSelectedUnifiedPedido] = useState<UnifiedPedido | null>(null)

  // Paginación y Lazy Loading
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const [updatingPago, setUpdatingPago] = useState<string | null>(null)
  const [dashboardMode, setDashboardMode] = useState<'orders' | 'nuevoPedido'>('orders')
  const [mobileView, setMobileView] = useState<'orders' | 'detail'>('orders')
  const [showCierreTurno, setShowCierreTurno] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [sendingNotification, setSendingNotification] = useState<string | null>(null)

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
    ;(async () => {
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
      lastUpdate.sucursalId !== sucursalActivaId
    ) {
      return
    }
    fetchPedidos(1, false)
  }, [lastUpdate, fetchPedidos, sucursalActivaId, prefsReady])

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

      if (shouldPrint) {
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
          }, itemsToPrint, restaurante?.nombre || 'Restaurante')

          printRaw(commandsToBytes(comandaData))
            .then(() => {
              setUnifiedPedidos(prev => prev.map(p => p.id === pedido.id ? { ...p, impreso: true } : p))
            })
            .catch(console.error)
        }
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

  const handleAprobarPago = async (pedido: UnifiedPedido, metodoOverrides?: 'efectivo' | 'transferencia') => {
    if (!token) return
    setUpdatingPago(pedido.id.toString())
    try {
      const mp = metodoOverrides ? (metodoOverrides === 'efectivo' ? 'cash' : 'manual_transfer') : (pedido.metodoPago === 'efectivo' ? 'cash' : 'manual_transfer')
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
            <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9 -ml-2" onClick={() => setMobileView('orders')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {mobileView === 'detail' && selectedUnifiedPedido ? `Pedido #${selectedUnifiedPedido.id}` : (restaurante?.nombre || 'Operaciones')}
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
                <Button variant="outline" size="sm" className="h-8 text-xs px-2 gap-1.5" onClick={openMetodosPagoModal}>
                  <Settings className="h-3.5 w-3.5" /> Pagos
                </Button>
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
                              </div>
                              <span className="font-black text-sm">${parseFloat(pedido.total).toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
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
                                    if (pedido.pagado) handleEstadoChange(pedido.tipo, pedido.id, 'archived');
                                    else handleAprobarPago(pedido);
                                  }}
                                  disabled={updatingPago === pedido.id.toString()}
                                >
                                  {updatingPago === pedido.id.toString() ? <Loader2 className="h-3 w-3 animate-spin" /> : (pedido.pagado ? 'Despachar' : 'Cobrar')}
                                </Button>
                              </div>
                            </div>
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
                              <span className="text-xs font-bold text-muted-foreground">${parseFloat(pedido.total).toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
                            </div>
                          </Fragment>
                        )
                      })}
                    </div>

                    {hasMore && (
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
              {selectedUnifiedPedido ? (
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
                            {selectedUnifiedPedido.items.map((item, idx) => (
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
                                  ${(() => {
                                    const base = parseFloat(item.precioUnitario || '0')
                                    const extras = formatAgregados(item.agregados).reduce((sum, ag) => sum + parseFloat(ag.precio || '0'), 0)
                                    return ((base + extras) * item.cantidad).toLocaleString('es-AR', { minimumFractionDigits: 0 })
                                  })()}
                                </span>
                              </div>
                            ))}
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
                            ${parseFloat(selectedUnifiedPedido.total).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
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
                          {selectedUnifiedPedido.pagado && metodoPagoListBadge(selectedUnifiedPedido.metodoPago) && (
                            <Badge variant="outline" className="self-start bg-background border-border/50 text-muted-foreground">
                              {metodoPagoListBadge(selectedUnifiedPedido.metodoPago)?.label}
                            </Badge>
                          )}
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
                                onClick={() => handleEstadoChange(selectedUnifiedPedido.tipo, selectedUnifiedPedido.id, 'archived')}
                              >
                                Despachar Pedido
                              </Button>
                            </div>
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
                          ${parseFloat(selectedUnifiedPedido.total).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
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
                      </div>

                      <Separator className="bg-border/60 mb-8" />

                      {/* Acciones de cobro (solo si no está pagado) */}
                      {!selectedUnifiedPedido.pagado && selectedUnifiedPedido.estado !== 'archived' && (
                        <div className="mb-8">
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Verificar y cobrar</p>
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
                          {selectedUnifiedPedido.items.map((item, idx) => {
                            const basePrice = parseFloat(item.precioUnitario || '0')
                            const agregadosTotal = formatAgregados(item.agregados).reduce((a, ag) => a + parseFloat(ag.precio || '0'), 0)
                            const lineTotal = (basePrice + agregadosTotal) * item.cantidad

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
                              ${parseFloat(selectedUnifiedPedido.total).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
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
                                    if (selectedUnifiedPedido.pagado) handleEstadoChange(selectedUnifiedPedido.tipo, selectedUnifiedPedido.id, 'archived')
                                    else toast.error('Debes verificar el pago primero')
                                  }}
                                  disabled={updatingPago === selectedUnifiedPedido.id.toString() || !selectedUnifiedPedido.pagado}
                                >
                                  {updatingPago === selectedUnifiedPedido.id.toString() ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : null}
                                  {selectedUnifiedPedido.pagado ? 'Despachar Pedido' : 'Pendiente de Cobro'}
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