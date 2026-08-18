import { useEffect, useMemo, useState } from 'react'
import { restauranteApi, zonasDeliveryApi, facturacionApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { usePrinter } from '@/context/PrinterContext'
import { resumirHorarios, type Horarios } from '../sections/horarios/resumirHorarios'

const apiBase = () => import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/**
 * Resumen por sección para la portada de Ajustes: una oración que describe lo ya
 * configurado + la lista de cosas que faltan (lo que antes vivía en "Primeros
 * pasos", ahora en naranja dentro de cada tarjeta). Junta el perfil del store con
 * horarios, zonas, WhatsApp, facturación e impresora.
 */
export interface ResumenSeccion {
  /** Oración en modo lectura de lo que hay configurado. */
  resumen: string
  /** Cosas pendientes de configurar (se muestran en naranja tras el resumen). */
  faltan: string[]
}

export function useResumenSecciones(): {
  data: Record<string, ResumenSeccion>
  loading: boolean
} {
  const restaurante = useRestauranteStore((s) => s.restaurante)
  const { selectedPrinter } = usePrinter()

  const [horarios, setHorarios] = useState<Horarios | null>(null)
  const [zonasCount, setZonasCount] = useState<number | null>(null)
  const [waConectado, setWaConectado] = useState<boolean | null>(null)
  const [waVencido, setWaVencido] = useState(false)
  const [facturacionOk, setFacturacionOk] = useState<boolean | null>(null)
  const [staffCount, setStaffCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = useAuthStore.getState().token
    if (!token) {
      setLoading(false)
      return
    }
    let cancel = false
    ;(async () => {
      const [hRes, zRes, wRes, fRes, staffRes] = await Promise.allSettled([
        restauranteApi.getHorarios(token),
        zonasDeliveryApi.getAll(token),
        fetch(`${apiBase()}/whatsapp-oauth/status`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json()),
        facturacionApi.getEstado(token),
        fetch(`${apiBase()}/staff/usuarios`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json()),
      ])
      if (cancel) return

      if (hRes.status === 'fulfilled') {
        const res = hRes.value as {
          success?: boolean
          horarios?: Array<{ diaSemana: number; horaApertura: string; horaCierre: string }>
        }
        const agrupado: Horarios = {}
        for (const h of res.horarios ?? []) {
          ;(agrupado[h.diaSemana] ??= []).push({
            horaApertura: h.horaApertura,
            horaCierre: h.horaCierre,
          })
        }
        setHorarios(agrupado)
      } else {
        setHorarios({})
      }

      setZonasCount(
        zRes.status === 'fulfilled' && (zRes.value as { success?: boolean; data?: unknown[] })?.success
          ? ((zRes.value as { data?: unknown[] }).data?.length ?? 0)
          : 0
      )

      if (wRes.status === 'fulfilled') {
        const w = wRes.value as { conectado?: boolean; tokenVencido?: boolean }
        setWaConectado(!!w?.conectado)
        setWaVencido(!!w?.conectado && !!w?.tokenVencido)
      } else {
        setWaConectado(false)
      }

      setFacturacionOk(
        fRes.status === 'fulfilled'
          ? !!(fRes.value as { data?: { habilitado?: boolean } })?.data?.habilitado
          : false
      )

      setStaffCount(
        staffRes.status === 'fulfilled'
          ? ((staffRes.value as { success?: boolean; data?: unknown[] })?.data?.length ?? 0)
          : 0
      )

      setLoading(false)
    })()
    return () => {
      cancel = true
    }
  }, [])

  const data = useMemo<Record<string, ResumenSeccion>>(() => {
    const nombre = restaurante?.nombre?.trim()
    const username = restaurante?.username?.trim()
    const tieneLogo = !!(restaurante?.imagenUrl || restaurante?.imagenLightUrl)
    const dirCorta = restaurante?.direccionTexto?.split(',')[0]?.trim()

    const mpOk = !!restaurante?.mpConnected
    const cucuruOk = !!restaurante?.cucuruConfigurado
    const taloOk = !!(restaurante?.taloClientId && restaurante?.taloClientSecret && restaurante?.taloUserId)
    const cobroOnline = mpOk || cucuruOk || taloOk

    const deliveryOn = restaurante?.deliveryEnabled !== false
    const takeawayOn = restaurante?.takeawayEnabled !== false

    const amigosOn = restaurante?.orderGroupEnabled !== false
    const codigosOn = restaurante?.codigoDescuentoEnabled !== false

    // ── General ──
    const generalFaltan: string[] = []
    if (!nombre) generalFaltan.push('Cargá el nombre de tu local')
    if (!username) generalFaltan.push('Elegí el alias de tu link')
    if (!tieneLogo) generalFaltan.push('Subí tu logo')

    // ── Pagos ──
    const pagosOnline: string[] = []
    if (mpOk) pagosOnline.push('Mercado Pago')
    if (cucuruOk) pagosOnline.push('Cucuru')
    if (taloOk) pagosOnline.push('Talo')
    const pagosResumen = pagosOnline.length
      ? `${pagosOnline.join(', ')} y efectivo`
      : 'Solo cobrás en efectivo'
    const pagosFaltan: string[] = []
    if (!cobroOnline) pagosFaltan.push('Sumá pagos online')
    if (waVencido) pagosFaltan.push('Reconectá tu WhatsApp')
    else if (!waConectado) pagosFaltan.push('Conectá tu WhatsApp')

    // ── Horarios ──
    const horariosResumen = horarios ? resumirHorarios(horarios) : 'Cargando…'
    const horariosVacios = horarios != null && Object.keys(horarios).length === 0
    const horariosFaltan = horariosVacios ? ['Definí tus horarios de atención'] : []

    // ── Entregas ──
    const tipos = deliveryOn && takeawayOn
      ? 'Delivery y takeaway'
      : deliveryOn
        ? 'Solo delivery'
        : takeawayOn
          ? 'Solo takeaway'
          : 'Sin tipos de pedido activos'
    const entregasResumen =
      deliveryOn && zonasCount != null && zonasCount > 0
        ? `${tipos} · ${zonasCount} ${zonasCount === 1 ? 'zona' : 'zonas'}`
        : tipos
    const entregasFaltan = deliveryOn && zonasCount === 0 ? ['Dibujá tus zonas de delivery'] : []

    // ── Experiencia ──
    const expParts: string[] = []
    if (amigosOn) expParts.push('pedidos entre amigos')
    if (codigosOn) expParts.push('códigos de descuento')
    const experienciaResumen =
      expParts.length > 0
        ? `${expParts.join(' y ')} ${expParts.length === 1 ? 'activo' : 'activos'}`.replace(/^./, (c) => c.toUpperCase())
        : 'Extras de la tienda desactivados'

    // ── Facturación ──
    const facturacionResumen =
      facturacionOk == null ? 'Cargando…' : facturacionOk ? 'Configurada con ARCA' : 'Sin configurar'

    // ── Impresión ──
    const impresionResumen = selectedPrinter || 'Sin impresora seleccionada'
    const impresionFaltan = isTauri && !selectedPrinter ? ['Seleccioná tu impresora'] : []

    // ── Mozos ──
    const mozosResumen = staffCount == null
      ? 'Cargando…'
      : staffCount === 1
        ? '1 usuario de staff'
        : `${staffCount} usuarios de staff`
    const mozosFaltan = staffCount === 0 ? ['Creá el primer código de acceso'] : []

    // ── Cuenta ──
    const cuentaResumen = restaurante?.email || 'Tu email y contraseña'

    return {
      general: {
        resumen: nombre
          ? `${nombre}${dirCorta ? ` · ${dirCorta}` : ''}`
          : 'Tu negocio, tu link y tu identidad visual',
        faltan: generalFaltan,
      },
      pagos: { resumen: pagosResumen, faltan: pagosFaltan },
      horarios: { resumen: horariosResumen, faltan: horariosFaltan },
      entregas: { resumen: entregasResumen, faltan: entregasFaltan },
      experiencia: { resumen: experienciaResumen, faltan: [] },
      facturacion: { resumen: facturacionResumen, faltan: [] },
      impresion: { resumen: impresionResumen, faltan: impresionFaltan },
      mozos: { resumen: mozosResumen, faltan: mozosFaltan },
      cuenta: { resumen: cuentaResumen, faltan: [] },
    }
  }, [
    restaurante,
    horarios,
    zonasCount,
    waConectado,
    waVencido,
    facturacionOk,
    staffCount,
    selectedPrinter,
  ])

  return { data, loading }
}
