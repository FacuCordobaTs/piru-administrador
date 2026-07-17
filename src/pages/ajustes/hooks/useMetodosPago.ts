import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { restauranteApi, ApiError } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore, type RestauranteData } from '@/store/restauranteStore'
import type { AjusteStatus } from './useAjuste'

export interface MetodosConfig {
  checkout: boolean
  bricks: boolean
  tfAuto: boolean
  tfManual: boolean
  efectivo: boolean
}
export type MetodoKey = keyof MetodosConfig

/** Deriva la config efectiva (con los defaults históricos de Perfil). */
function derivar(r: RestauranteData | null) {
  const c = r?.metodosPagoConfig || {}
  const mpOk = !!r?.mpConnected
  const cucuruOk = !!r?.cucuruConfigurado
  const taloOk = !!(r?.taloClientId && r?.taloClientSecret && r?.taloUserId)
  const autoTf = cucuruOk || taloOk
  const config: MetodosConfig = {
    checkout: c.mercadopagoCheckout ?? (mpOk && r?.cardsPaymentsEnabled !== false),
    bricks: c.mercadopagoBricks ?? false,
    tfAuto: c.transferenciaAutomatica ?? autoTf,
    tfManual: c.transferenciaManual ?? (!autoTf && !!(r?.transferenciaAlias && String(r.transferenciaAlias).trim())),
    efectivo: c.efectivo ?? true,
  }
  return { config, mpOk, cucuruOk, taloOk }
}

// Traduce la config a la forma que espera metodosPagoConfig del store.
function aStore(c: MetodosConfig): NonNullable<RestauranteData['metodosPagoConfig']> {
  return {
    mercadopagoCheckout: c.checkout,
    mercadopagoBricks: c.bricks,
    transferenciaAutomatica: c.tfAuto,
    transferenciaManual: c.tfManual,
    efectivo: c.efectivo,
  }
}

export function useMetodosPago() {
  const restaurante = useRestauranteStore((s) => s.restaurante)
  const setLocal = useRestauranteStore((s) => s.setLocal)
  const [status, setStatus] = useState<AjusteStatus>('idle')
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const derived = derivar(restaurante)
  const alias = restaurante?.transferenciaAlias ?? ''
  const proveedor: 'cucuru' | 'talo' =
    restaurante?.proveedorPago === 'talo' ? 'talo' : 'cucuru'

  const marcarGuardado = useCallback(() => {
    setStatus('saved')
    if (savedTimer.current) clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setStatus('idle'), 2000)
  }, [])

  // Guarda la config completa (updateMetodosPago sobrescribe todo).
  const persistir = useCallback(
    async (config: MetodosConfig, aliasValor: string) => {
      const token = useAuthStore.getState().token
      if (!token) return
      const prev = useRestauranteStore.getState().restaurante
      const prevPatch: Partial<RestauranteData> = {
        metodosPagoConfig: prev?.metodosPagoConfig ?? null,
        transferenciaAlias: prev?.transferenciaAlias ?? null,
      }
      setLocal({ metodosPagoConfig: aStore(config), transferenciaAlias: aliasValor })
      setStatus('saving')
      try {
        await restauranteApi.updateMetodosPago(token, {
          mercadopagoCheckout: config.checkout,
          mercadopagoBricks: config.bricks,
          transferenciaAutomatica: config.tfAuto,
          transferenciaManual: config.tfManual,
          efectivo: config.efectivo,
          transferenciaAlias: aliasValor,
        })
        marcarGuardado()
      } catch (e) {
        setLocal(prevPatch)
        setStatus('error')
        toast.error('No se pudieron guardar los métodos', {
          description: e instanceof ApiError ? e.message : 'Revisá tu conexión.',
          action: { label: 'Reintentar', onClick: () => void persistir(config, aliasValor) },
        })
      }
    },
    [setLocal, marcarGuardado]
  )

  const setMetodo = useCallback(
    (key: MetodoKey, value: boolean) => {
      const actual = derivar(useRestauranteStore.getState().restaurante).config
      void persistir({ ...actual, [key]: value }, useRestauranteStore.getState().restaurante?.transferenciaAlias ?? '')
    },
    [persistir]
  )

  const setAlias = useCallback(
    (valor: string) => {
      if (valor === (useRestauranteStore.getState().restaurante?.transferenciaAlias ?? '')) return
      const actual = derivar(useRestauranteStore.getState().restaurante).config
      void persistir(actual, valor)
    },
    [persistir]
  )

  const setProveedor = useCallback(async (p: 'cucuru' | 'talo') => {
    const token = useAuthStore.getState().token
    if (!token) return
    const prev = useRestauranteStore.getState().restaurante?.proveedorPago ?? null
    setLocal({ proveedorPago: p })
    setStatus('saving')
    try {
      await restauranteApi.updatePasarelaPago(token, { proveedorPago: p })
      marcarGuardado()
    } catch (e) {
      setLocal({ proveedorPago: prev })
      setStatus('error')
      toast.error('No se pudo cambiar el proveedor', {
        description: e instanceof ApiError ? e.message : 'Revisá tu conexión.',
      })
    }
  }, [setLocal, marcarGuardado])

  return {
    ...derived,
    alias,
    proveedor,
    status,
    setMetodo,
    setAlias,
    setProveedor,
  }
}
