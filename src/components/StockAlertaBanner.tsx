import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { AlertTriangle, ChevronRight, X } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useModuloActivo } from '@/store/modulosStore'
import { stockApi, type InsumoStock } from '@/lib/api'
import { formatearStock } from '@/lib/stock'

/**
 * Aviso operativo de stock. Vive en el Dashboard porque es donde el local mira
 * los pedidos; sólo se monta si el módulo está activo y hay algún insumo en o
 * bajo su mínimo.
 */
export function StockAlertaBanner({ refreshKey }: { refreshKey?: number }) {
  const token = useAuthStore((state) => state.token)
  const activo = useModuloActivo('gestion_stock')
  const [insumos, setInsumos] = useState<InsumoStock[]>([])
  const [oculto, setOculto] = useState(false)

  useEffect(() => {
    if (!activo || !token || oculto) return
    let vigente = true
    // En horas pico llegan varios eventos de pedido seguidos: se agrupan en una
    // sola conciliación para no encolar sincronizaciones de stock.
    const timer = window.setTimeout(() => {
      stockApi.alertas(token)
        .then((respuesta) => {
          if (vigente) setInsumos(respuesta.data?.insumos ?? [])
        })
        .catch(() => {
          // El aviso es complementario: si falla, el Dashboard sigue operativo.
        })
    }, 700)
    return () => {
      vigente = false
      window.clearTimeout(timer)
    }
  }, [activo, token, refreshKey, oculto])

  if (!activo || oculto || insumos.length === 0) return null

  const nombres = insumos.slice(0, 2).map((insumo) => insumo.nombre)
  const resto = insumos.length - nombres.length
  const detalle = insumos.length <= 2
    ? insumos.map((insumo) => `${insumo.nombre} (${formatearStock(insumo.stockActual, insumo.unidad)})`).join(' · ')
    : `${nombres.join(' · ')}${resto > 0 ? ` y ${resto} más` : ''}`

  return (
    <div className="shrink-0 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5">
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-500/15">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-amber-800 dark:text-amber-200 sm:text-sm">
            {insumos.length === 1 ? 'Hay un insumo para reponer' : `${insumos.length} insumos para reponer`}
          </p>
          <p className="truncate text-[11px] text-amber-700/80 dark:text-amber-300/80">{detalle}</p>
        </div>
        <Link
          to="/dashboard/productos?tab=stock"
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-amber-500/15 px-2.5 py-1.5 text-[11px] font-bold text-amber-800 transition-colors hover:bg-amber-500/25 dark:text-amber-200"
        >
          Ver stock
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
        <button
          type="button"
          onClick={() => setOculto(true)}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-amber-700/70 transition-colors hover:bg-amber-500/15 hover:text-amber-900 dark:text-amber-300/70"
          aria-label="Ocultar alerta de stock"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
