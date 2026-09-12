import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { puntosApi, type ConfiguracionPuntosData } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2, Sparkles, Gift, Truck, TicketPercent, Check } from 'lucide-react'

interface PuntosConfigEditorProps {
  onSaved?: () => void
}

export function PuntosConfigEditor({ onSaved }: PuntosConfigEditorProps) {
  const token = useAuthStore((s) => s.token)
  const fetchData = useRestauranteStore((s) => s.fetchData)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [config, setConfig] = useState<ConfiguracionPuntosData>({
    restauranteId: 0,
    activo: true,
    pesosPorPunto: 100,
    puntosPrimerPedido: 50,
    puntosMinimosCanje: 100,
    permiteCanjeEnvioGratis: true,
    puntosEnvioGratis: 300,
    permiteCanjeDescuento: true,
    descuentoPuntosCosto: 500,
    descuentoTipo: 'monto_fijo',
    descuentoValor: 1000,
    descuentoMontoMinimo: 5000,
  })

  useEffect(() => {
    if (!token) return
    setLoading(true)
    puntosApi
      .getConfig(token)
      .then((res) => {
        if (res.success && res.data) {
          const d = res.data as any
          setConfig({
            restauranteId: d.restauranteId || 0,
            activo: d.activo !== false,
            pesosPorPunto: Number(d.pesosPorPunto) || 100,
            puntosPrimerPedido: Number(d.puntosPrimerPedido) || 0,
            puntosMinimosCanje: Number(d.puntosMinimosCanje) || 0,
            permiteCanjeEnvioGratis: Boolean(d.permiteCanjeEnvioGratis ?? d.permitirCanjeEnvioGratis),
            puntosEnvioGratis: Number(d.puntosEnvioGratis) || 300,
            permiteCanjeDescuento: Boolean(d.permiteCanjeDescuento ?? d.permitirCanjeDescuento),
            descuentoPuntosCosto: Number(d.descuentoPuntosCosto) || 0,
            descuentoTipo: d.descuentoTipo === 'fijo' || d.descuentoTipo === 'monto_fijo' ? 'monto_fijo' : 'porcentaje',
            descuentoValor: Number(d.descuentoValor) || 0,
            descuentoMontoMinimo: Number(d.descuentoMontoMinimo) || 0,
          })
        }
      })
      .catch((err) => {
        toast.error('Error al cargar la configuración de puntos', {
          description: err.message,
        })
      })
      .finally(() => {
        setLoading(false)
      })
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return

    if (config.pesosPorPunto <= 0) {
      toast.error('El valor de pesos por punto debe ser mayor a 0')
      return
    }

    setSaving(true)
    try {
      const res = await puntosApi.updateConfig(token, {
        activo: config.activo,
        pesosPorPunto: Number(config.pesosPorPunto),
        puntosPrimerPedido: Number(config.puntosPrimerPedido),
        puntosMinimosCanje: Number(config.puntosMinimosCanje),
        permitirCanjeEnvioGratis: config.permiteCanjeEnvioGratis,
        permiteCanjeEnvioGratis: config.permiteCanjeEnvioGratis,
        puntosEnvioGratis: Number(config.puntosEnvioGratis),
        permitirCanjeDescuento: config.permiteCanjeDescuento,
        permiteCanjeDescuento: config.permiteCanjeDescuento,
        descuentoPuntosCosto: Number(config.descuentoPuntosCosto),
        descuentoTipo: config.descuentoTipo === 'monto_fijo' ? 'fijo' : 'porcentaje',
        descuentoValor: String(config.descuentoValor ?? 0),
        descuentoMontoMinimo: String(config.descuentoMontoMinimo ?? 0),
      } as any)

      if (res.success) {
        toast.success('Configuración de puntos guardada')
        await fetchData()
        onSaved?.()
      } else {
        toast.error(res.message || 'Error al guardar configuración')
      }
    } catch (err: any) {
      toast.error('Error al guardar configuración', { description: err.message })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-brand" />
        <span className="text-sm">Cargando configuración de puntos...</span>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-6">
      {/* ── Switch principal: Activo / Pausado ── */}
      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/40 p-4">
        <div className="space-y-0.5 pr-4">
          <Label htmlFor="puntos-activo" className="text-sm font-semibold cursor-pointer">
            Programa de puntos activo
          </Label>
          <p className="text-xs text-muted-foreground">
            Los clientes acumulan puntos con sus compras y pueden usarlos para canjes en tu tienda.
          </p>
        </div>
        <Switch
          id="puntos-activo"
          checked={config.activo}
          onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, activo: checked }))}
        />
      </div>

      {/* ── Regla de acumulación ── */}
      <div className="space-y-4 rounded-xl border border-border/60 p-4 bg-background">
        <div className="flex items-center gap-2 pb-2 border-b border-border/40 text-amber-600 dark:text-amber-400 font-semibold text-xs uppercase tracking-wider">
          <Sparkles className="w-4 h-4" />
          <span>Suma de puntos por compras</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="pesosPorPunto" className="text-xs font-semibold text-muted-foreground">
              Pesos por cada 1 punto ($)
            </Label>
            <Input
              id="pesosPorPunto"
              type="number"
              min="1"
              step="1"
              value={config.pesosPorPunto}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, pesosPorPunto: Math.max(1, parseInt(e.target.value, 10) || 1) }))
              }
              className="h-10"
            />
            <p className="text-[11px] text-muted-foreground">
              Ej: $100 significa que cada $100 gastados suma 1 punto.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="puntosPrimerPedido" className="text-xs font-semibold text-muted-foreground">
              Bono de bienvenida 1er pedido
            </Label>
            <Input
              id="puntosPrimerPedido"
              type="number"
              min="0"
              step="1"
              value={config.puntosPrimerPedido}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, puntosPrimerPedido: Math.max(0, parseInt(e.target.value, 10) || 0) }))
              }
              className="h-10"
            />
            <p className="text-[11px] text-muted-foreground">
              Puntos extra de regalo en la primera compra (0 para desactivar).
            </p>
          </div>
        </div>

        <div className="space-y-1.5 pt-1">
          <Label htmlFor="puntosMinimosCanje" className="text-xs font-semibold text-muted-foreground">
            Mínimo de puntos requeridos para canjear
          </Label>
          <Input
            id="puntosMinimosCanje"
            type="number"
            min="0"
            step="1"
            value={config.puntosMinimosCanje}
            onChange={(e) =>
              setConfig((prev) => ({ ...prev, puntosMinimosCanje: Math.max(0, parseInt(e.target.value, 10) || 0) }))
            }
            className="h-10"
          />
          <p className="text-[11px] text-muted-foreground">
            El cliente debe alcanzar este saldo antes de poder utilizar sus puntos.
          </p>
        </div>
      </div>

      {/* ── Canje: Envío Gratis ── */}
      <div className="space-y-4 rounded-xl border border-border/60 p-4 bg-background">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 font-semibold text-xs uppercase tracking-wider">
            <Truck className="w-4 h-4" />
            <span>Canje por Envío Gratis</span>
          </div>
          <Switch
            checked={config.permiteCanjeEnvioGratis}
            onCheckedChange={(checked) =>
              setConfig((prev) => ({ ...prev, permiteCanjeEnvioGratis: checked }))
            }
          />
        </div>

        {config.permiteCanjeEnvioGratis && (
          <div className="space-y-1.5 pt-2 border-t border-border/40">
            <Label htmlFor="puntosEnvioGratis" className="text-xs font-semibold text-muted-foreground">
              Costo en puntos para envío gratis
            </Label>
            <Input
              id="puntosEnvioGratis"
              type="number"
              min="1"
              step="1"
              value={config.puntosEnvioGratis}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, puntosEnvioGratis: Math.max(1, parseInt(e.target.value, 10) || 1) }))
              }
              className="h-10"
            />
            <p className="text-[11px] text-muted-foreground">
              Descuenta el 100% del costo de delivery a cambio de esta cantidad de puntos.
            </p>
          </div>
        )}
      </div>

      {/* ── Canje: Cupón de Descuento ── */}
      <div className="space-y-4 rounded-xl border border-border/60 p-4 bg-background">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-xs uppercase tracking-wider">
            <TicketPercent className="w-4 h-4" />
            <span>Canje por Cupón de Descuento</span>
          </div>
          <Switch
            checked={config.permiteCanjeDescuento}
            onCheckedChange={(checked) =>
              setConfig((prev) => ({ ...prev, permiteCanjeDescuento: checked }))
            }
          />
        </div>

        {config.permiteCanjeDescuento && (
          <div className="space-y-4 pt-2 border-t border-border/40">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="descuentoPuntosCosto" className="text-xs font-semibold text-muted-foreground">
                  Costo en puntos
                </Label>
                <Input
                  id="descuentoPuntosCosto"
                  type="number"
                  min="1"
                  step="1"
                  value={config.descuentoPuntosCosto}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, descuentoPuntosCosto: Math.max(1, parseInt(e.target.value, 10) || 1) }))
                  }
                  className="h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="descuentoTipo" className="text-xs font-semibold text-muted-foreground">
                  Tipo de descuento
                </Label>
                <Select
                  value={config.descuentoTipo}
                  onValueChange={(val: 'monto_fijo' | 'porcentaje') =>
                    setConfig((prev) => ({ ...prev, descuentoTipo: val }))
                  }
                >
                  <SelectTrigger id="descuentoTipo" className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monto_fijo">Monto fijo ($)</SelectItem>
                    <SelectItem value="porcentaje">Porcentaje (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="descuentoValor" className="text-xs font-semibold text-muted-foreground">
                  {config.descuentoTipo === 'monto_fijo' ? 'Monto a descontar ($)' : 'Porcentaje a descontar (%)'}
                </Label>
                <Input
                  id="descuentoValor"
                  type="number"
                  min="1"
                  step="1"
                  value={config.descuentoValor}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, descuentoValor: Math.max(1, parseInt(e.target.value, 10) || 1) }))
                  }
                  className="h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="descuentoMontoMinimo" className="text-xs font-semibold text-muted-foreground">
                  Pedido mínimo requerido ($)
                </Label>
                <Input
                  id="descuentoMontoMinimo"
                  type="number"
                  min="0"
                  step="100"
                  value={config.descuentoMontoMinimo}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, descuentoMontoMinimo: Math.max(0, parseInt(e.target.value, 10) || 0) }))
                  }
                  className="h-10"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Canje por Productos (Informativo) ── */}
      <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-2">
        <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400 font-semibold text-xs uppercase tracking-wider">
          <Gift className="w-4 h-4" />
          <span>Canje de productos de tu carta</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Podés asignar el costo en puntos de cualquier producto para canje directo desde{' '}
          <strong className="text-foreground">Menú &gt; Productos</strong>, editando el producto y completando el campo{' '}
          <strong className="text-foreground">Costo en puntos</strong> en la sección Sistema de Puntos.
        </p>
      </div>

      {/* ── Botón Guardar ── */}
      <Button
        type="submit"
        disabled={saving}
        className="w-full h-11 bg-brand text-brand-foreground font-semibold rounded-xl"
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Guardando cambios...
          </>
        ) : (
          <>
            <Check className="w-4 h-4 mr-2" />
            Guardar configuración de puntos
          </>
        )}
      </Button>
    </form>
  )
}
