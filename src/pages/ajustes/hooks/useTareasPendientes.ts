import { useEffect, useMemo, useState } from 'react'
import { restauranteApi, zonasDeliveryApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'

const apiBase = () => import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

/**
 * Un paso de configuración que le baja el time-to-value al local. Modo lectura:
 * `oracion` describe el estado actual; el `cta` (link a la sección/página que lo
 * resuelve) sólo aparece cuando está pendiente.
 */
export interface TareaItem {
  id: string
  titulo: string
  oracion: string
  hecha: boolean
  cta: string
  /** Ruta a la que salta el link para completarlo. */
  to: string
}

export interface TareasResumen {
  items: TareaItem[]
  pendientes: number
  total: number
  loading: boolean
}

/**
 * Centro de "próximos pasos": qué le falta al local para aprovechar Piru, con estado
 * hecho/pendiente y link directo a cada cosa. Fuente de datos: el perfil del restaurante
 * (store) + conteo de productos sin foto + zonas, horarios y WhatsApp por API. Lo consumen
 * la sección "Primeros pasos" de Ajustes y el badge discreto del navbar.
 */
export function useTareasPendientes(): TareasResumen {
  const restaurante = useRestauranteStore((s) => s.restaurante)
  const productos = useRestauranteStore((s) => s.productos)

  const [zonasCount, setZonasCount] = useState<number | null>(null)
  const [horariosCount, setHorariosCount] = useState<number | null>(null)
  const [waConectado, setWaConectado] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = useAuthStore.getState().token
    if (!token) {
      setLoading(false)
      return
    }
    let cancel = false
    ;(async () => {
      const [zRes, hRes, wRes] = await Promise.allSettled([
        zonasDeliveryApi.getAll(token),
        restauranteApi.getHorarios(token),
        fetch(`${apiBase()}/whatsapp-oauth/status`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json()),
      ])
      if (cancel) return
      setZonasCount(
        zRes.status === 'fulfilled' && (zRes.value as { success?: boolean; data?: unknown[] })?.success
          ? ((zRes.value as { data?: unknown[] }).data?.length ?? 0)
          : 0
      )
      setHorariosCount(
        hRes.status === 'fulfilled' && (hRes.value as { success?: boolean; horarios?: unknown[] })?.success
          ? ((hRes.value as { horarios?: unknown[] }).horarios?.length ?? 0)
          : 0
      )
      setWaConectado(
        wRes.status === 'fulfilled' ? !!(wRes.value as { conectado?: boolean })?.conectado : false
      )
      setLoading(false)
    })()
    return () => {
      cancel = true
    }
  }, [])

  const items = useMemo<TareaItem[]>(() => {
    const list: TareaItem[] = []
    const productosCount = productos.length
    const sinFoto = productos.filter((p) => !p.imagenUrl).length

    // 1. Menú cargado.
    list.push({
      id: 'menu',
      titulo: 'Cargá tu menú',
      oracion:
        productosCount === 0
          ? 'Tu carta todavía está vacía'
          : `${productosCount} ${productosCount === 1 ? 'producto' : 'productos'} en tu carta`,
      hecha: productosCount > 0,
      cta: 'Cargar productos',
      to: '/dashboard/productos',
    })

    // 2. Fotos de productos (sólo tiene sentido si ya hay productos).
    if (productosCount > 0) {
      list.push({
        id: 'fotos',
        titulo: 'Poné fotos a tus productos',
        oracion:
          sinFoto === 0
            ? 'Todos tus productos tienen foto'
            : `${sinFoto} ${sinFoto === 1 ? 'producto sin foto' : 'productos sin foto'}`,
        hecha: sinFoto === 0,
        cta: 'Subir fotos',
        to: '/dashboard/productos',
      })
    }

    // 3. Cobro online (efectivo viene por default, así que el paso valioso es sumar pagos online).
    const mpOk = !!restaurante?.mpConnected
    const cucuruOk = !!restaurante?.cucuruConfigurado
    const taloOk = !!(restaurante?.taloClientId && restaurante?.taloClientSecret && restaurante?.taloUserId)
    const cobroOnline = mpOk || cucuruOk || taloOk
    list.push({
      id: 'pagos',
      titulo: 'Elegí cómo cobrás',
      oracion: cobroOnline
        ? 'Aceptás pagos online'
        : 'Solo cobrás en efectivo — sumá pagos online',
      hecha: cobroOnline,
      cta: 'Configurar pagos',
      to: '/dashboard/ajustes/pagos',
    })

    // 4. Horarios de atención.
    const horariosOk = (horariosCount ?? 0) > 0
    list.push({
      id: 'horarios',
      titulo: 'Definí tus horarios',
      oracion: horariosOk ? 'Tus horarios de atención están cargados' : 'Todavía no cargaste tus horarios',
      hecha: horariosOk,
      cta: 'Configurar horarios',
      to: '/dashboard/ajustes/horarios',
    })

    // 5. Zonas de delivery (sólo si el delivery está activo).
    const deliveryOn = restaurante?.deliveryEnabled !== false
    if (deliveryOn) {
      const zonasOk = (zonasCount ?? 0) > 0
      list.push({
        id: 'zonas',
        titulo: 'Dibujá tus zonas de delivery',
        oracion: zonasOk
          ? `${zonasCount} ${zonasCount === 1 ? 'zona definida' : 'zonas definidas'}`
          : 'Sin zonas: nadie puede pedir envío a domicilio',
        hecha: zonasOk,
        cta: 'Definir zonas',
        to: '/dashboard/ajustes/entregas',
      })
    }

    // 6. WhatsApp / OAuth de Meta (recepción y avisos de pedidos por WhatsApp).
    const waOk = !!waConectado
    list.push({
      id: 'whatsapp',
      titulo: 'Conectá tu WhatsApp',
      oracion: waOk ? 'WhatsApp conectado' : 'Sin conectar — recibí y avisá pedidos por WhatsApp',
      hecha: waOk,
      cta: 'Conectar WhatsApp',
      to: '/dashboard/ajustes/pagos',
    })

    return list
  }, [restaurante, productos, zonasCount, horariosCount, waConectado])

  const pendientes = items.filter((i) => !i.hecha).length

  return { items, pendientes, total: items.length, loading }
}
