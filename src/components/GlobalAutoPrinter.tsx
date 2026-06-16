import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { pedidoUnificadoApi } from '@/lib/api'
import { useAdminContext } from '@/context/AdminContext'
import { usePrinter } from '@/context/PrinterContext'
import { formatComanda, commandsToBytes } from '@/utils/printerUtils'
import { toast } from 'sonner'

// ─────────────────────────────────────────────
// TIPOS (subset del UnifiedPedido del Dashboard, solo lo necesario para imprimir)
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
    horarioProgramado?: string | null; deliveryFee?: string | null; grupal?: boolean | null;
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

// Mismo cálculo que en Dashboard.tsx para el costo de envío
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

// Mismo criterio que en Dashboard.tsx: pedidos con pago online se imprimen recién al estar pagados
const deferComandaHastaPagado = (metodoPago: string | null | undefined, cucuruConfigurado: boolean | null | undefined): boolean => {
    const m = String(metodoPago || '').trim()
    if (['transferencia_automatica_cucuru', 'transferencia_automatica_talo', 'mercadopago', 'mercadopago_checkout', 'mercadopago_bricks'].includes(m)) return true
    if (cucuruConfigurado && (m === 'transferencia' || m === '')) return true
    return false
}

/**
 * Impresión automática de comandas GLOBAL.
 *
 * El Dashboard ya imprime los pedidos nuevos mientras está montado. Pero cuando el
 * usuario está en otra pantalla (Productos, Métricas, Clientes, etc.) el Dashboard
 * se desmonta y deja de imprimir. Este componente vive en el ProtectedLayout (siempre
 * montado) y replica la misma lógica de auto-impresión.
 *
 * Para NO romper ni duplicar lo que ya hace el Dashboard, este componente se inhibe de
 * imprimir mientras la ruta activa es la del Dashboard (índice). En esa ruta solo
 * registra los pedidos vistos (para no reimprimir el backlog al cambiar de pantalla),
 * y deja que el Dashboard haga la impresión como siempre.
 *
 * La doble impresión está además protegida server-side por `claimImpreso` (claim atómico).
 */
const GlobalAutoPrinter = () => {
    const location = useLocation()
    // Dashboard (índice) → el Dashboard imprime; acá NO imprimimos para no duplicar.
    const isDashboardRoute = location.pathname === '/dashboard' || location.pathname === '/dashboard/'

    const token = useAuthStore((state) => state.token)
    const restaurante = useAuthStore((state) => state.restaurante)
    const { restaurante: restauranteStore, productos: allProductos } = useRestauranteStore()

    const { printRaw, selectedPrinter } = usePrinter()
    const { lastUpdate } = useAdminContext()

    const [unifiedPedidos, setUnifiedPedidos] = useState<UnifiedPedido[]>([])
    const processedOrdersRef = useRef<Map<string, { status: string, itemIds: Set<number>, pagado?: boolean }>>(new Map())
    const initialLoadDoneRef = useRef(false)

    // ─────────────────────────────────────────────
    // FETCH (espejo del fetch inicial del Dashboard, sin paginación ni selección)
    // ─────────────────────────────────────────────
    const fetchPedidos = useCallback(async () => {
        if (!token) return
        try {
            const sucursalActivaId = readStoredSucursalId()
            const response = await pedidoUnificadoApi.getAll(
                token,
                'all',
                1,
                50,
                undefined,
                sucursalActivaId,
            ) as any
            if (response.success && response.data) {
                const validPedidos = response.data.filter((p: any) => p.tipo === 'delivery' || p.tipo === 'takeaway') as UnifiedPedido[]
                setUnifiedPedidos(validPedidos)
            }
        } catch (error) {
            console.error('Error fetching pedidos (GlobalAutoPrinter):', error)
        }
    }, [token])

    // Carga inicial al montar
    useEffect(() => {
        if (!token) return
        fetchPedidos()
    }, [token, fetchPedidos])

    // Refetch ante cualquier update de delivery/takeaway por WebSocket
    useEffect(() => {
        if (!lastUpdate) return
        if (lastUpdate.type !== 'delivery' && lastUpdate.type !== 'takeaway') return
        const sucursalActivaId = readStoredSucursalId()
        if (
            sucursalActivaId != null &&
            lastUpdate.sucursalId !== undefined &&
            lastUpdate.sucursalId !== null &&
            lastUpdate.sucursalId !== sucursalActivaId
        ) {
            return
        }
        fetchPedidos()
    }, [lastUpdate, fetchPedidos])

    // ─────────────────────────────────────────────
    // AUTO-IMPRESIÓN (espejo exacto del Dashboard)
    // ─────────────────────────────────────────────
    useEffect(() => {
        if (!selectedPrinter) return

        unifiedPedidos.forEach(pedido => {
            const pedidoKey = `${pedido.tipo}-${pedido.id}`
            const currentPagado = pedido.pagado
            const prevData = processedOrdersRef.current.get(pedidoKey)

            // Mientras estamos en el Dashboard, el Dashboard imprime. Acá solo registramos
            // para no reimprimir el backlog cuando el usuario cambie de pantalla.
            if (isDashboardRoute) {
                processedOrdersRef.current.set(pedidoKey, { status: pedido.estado, itemIds: new Set(pedido.items.map(i => i.id)), pagado: currentPagado })
                return
            }

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
    }, [unifiedPedidos, selectedPrinter, allProductos, restaurante, printRaw, token, restauranteStore, isDashboardRoute])

    return null
}

export default GlobalAutoPrinter
