import { useMemo, useState } from 'react'
import { Store } from 'lucide-react'
import { PaginaModulo } from '@/components/PaginaModulo'
import { SucursalesLista } from '@/pages/ajustes/components/SucursalesLista'
import { useSucursales } from '@/pages/ajustes/hooks/useSucursales'
import { MetricasPanel } from '@/pages/Metricas'

/**
 * Configuración de las sucursales y lectura de sus datos. La operación de cada
 * sede sigue en Inicio con "Cambiar sucursal".
 */
export default function Sucursales() {
  const { sucursales, recargar, loaded } = useSucursales()
  const [sucursalId, setSucursalId] = useState<number | null>(null)
  const locales = useMemo(() => sucursales.filter((sucursal) => !sucursal.soloPos), [sucursales])
  const seleccionada = locales.find((sucursal) => sucursal.id === sucursalId) ?? null

  return (
    <PaginaModulo
      titulo="Sucursales"
      descripcion="Administrá tus locales y mirá cómo vende cada uno. Para tomar pedidos en una sede, elegila desde Cambiar sucursal en Inicio."
      modulo="multisucursal"
      ancho="max-w-4xl"
    >
      <div className="space-y-10">
        <section className="space-y-4">
          <header className="space-y-1">
            <h2 className="text-lg font-medium text-foreground">Tus locales</h2>
            <p className="text-sm text-muted-foreground">
              Cada sucursal tiene su dirección, su alias de transferencia y su WhatsApp.
            </p>
          </header>
          {loaded && locales.length === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background p-5 text-sm text-muted-foreground">
              <Store className="size-5 shrink-0 text-brand" />
              Todavía no hay sucursales cargadas.
            </div>
          ) : null}
          <SucursalesLista sucursales={locales} onChanged={recargar} />
        </section>

        <section className="space-y-4">
          <header className="space-y-1">
            <h2 className="text-lg font-medium text-foreground">Datos por sucursal</h2>
            <p className="text-sm text-muted-foreground">
              Facturación, medios de pago y productos del período, acotados a la sede que elijas.
            </p>
          </header>

          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="sucursal-datos" className="text-sm font-medium text-foreground">
              Sucursal
            </label>
            <select
              id="sucursal-datos"
              value={sucursalId ?? ''}
              onChange={(event) => setSucursalId(event.target.value ? Number(event.target.value) : null)}
              className="h-10 min-w-52 rounded-xl border bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
            >
              <option value="">Todas las sucursales</option>
              {locales.map((sucursal) => (
                <option key={sucursal.id} value={sucursal.id}>
                  {sucursal.nombre}
                </option>
              ))}
            </select>
          </div>

          {seleccionada && (
            <p className="text-xs text-muted-foreground">
              Mostrando datos de {seleccionada.nombre}.
            </p>
          )}

          <MetricasPanel sucursalId={sucursalId} />
        </section>
      </div>
    </PaginaModulo>
  )
}
