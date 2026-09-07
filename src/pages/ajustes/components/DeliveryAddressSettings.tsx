import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { restauranteApi } from '@/lib/api'
export function DeliveryAddressSettings() {
  const token = useAuthStore(s => s.token)
  const direccionSoloTexto = useRestauranteStore(s => s.restaurante?.direccionSoloTexto === true)
  const deliveryFeeActual = useRestauranteStore(s => s.restaurante?.deliveryFee)
  const setRestauranteLocal = useRestauranteStore(s => s.setLocal)
  const [guardandoDireccion, setGuardandoDireccion] = useState(false)
  const [costoEnvioFijo, setCostoEnvioFijo] = useState(String(deliveryFeeActual ?? '0'))
  const [guardandoCostoEnvio, setGuardandoCostoEnvio] = useState(false)
  const costoEnvioRef = useRef<HTMLInputElement>(null)
  useEffect(() => { setCostoEnvioFijo(String(deliveryFeeActual ?? '0')) }, [deliveryFeeActual])
  const cambiarDireccionSoloTexto = async (activo: boolean) => {
    if (!token || guardandoDireccion) return
    const anterior = direccionSoloTexto
    setGuardandoDireccion(true)
    setRestauranteLocal({ direccionSoloTexto: activo })
    try {
      await restauranteApi.update(token, { direccionSoloTexto: activo })
      toast.success(activo ? 'El checkout ahora pedirá la dirección escrita' : 'El checkout ahora usará Google Maps')
      if (activo) window.setTimeout(() => costoEnvioRef.current?.focus(), 0)
    } catch (error) {
      setRestauranteLocal({ direccionSoloTexto: anterior })
      toast.error('No pudimos guardar la configuración', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setGuardandoDireccion(false)
    }
  }

  const guardarCostoEnvioFijo = async () => {
    if (!token || guardandoCostoEnvio) return
    const normalizado = costoEnvioFijo.replace(',', '.').trim()
    const monto = Number(normalizado)
    if (!normalizado || !Number.isFinite(monto) || monto < 0) {
      toast.error('Ingresá un costo de envío válido')
      return
    }
    const valor = monto.toFixed(2)
    if (valor === deliveryFeeActual) return
    setGuardandoCostoEnvio(true)
    setRestauranteLocal({ deliveryFee: valor })
    try {
      await restauranteApi.update(token, { deliveryFee: valor })
      setCostoEnvioFijo(valor)
      toast.success('Costo fijo de envío guardado')
    } catch (error) {
      setRestauranteLocal({ deliveryFee: deliveryFeeActual })
      toast.error('No pudimos guardar el costo de envío', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setGuardandoCostoEnvio(false)
    }
  }

 return <details className="rounded-xl border p-4"><summary className="cursor-pointer text-sm font-medium">Dirección de entrega · {direccionSoloTexto ? "Escrita por el cliente, con tarifa fija" : "Con mapa y zonas de cobertura"} · Cambiar</summary><div className="mt-4">          <section aria-labelledby="direccion-checkout">
            <div>
              <h2 id="direccion-checkout" className="text-lg font-semibold tracking-tight text-foreground">Checkout delivery</h2>
              <p className="mt-1 text-sm text-muted-foreground">Elegí cómo tus clientes cargan la dirección de entrega.</p>
            </div>
            <div className="mt-5 max-w-xl rounded-3xl border bg-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-brand"><MapPin className="h-5 w-5" /></span>
                  <div>
                    <h3 className="font-semibold text-foreground">Pasar a dirección de solo texto</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {direccionSoloTexto
                        ? 'Activo: el cliente escribe la dirección sin sugerencias ni validación de Google Maps.'
                        : 'Desactivado: Google Maps sugiere y valida la dirección antes de confirmar el pedido.'}
                    </p>
                  </div>
                </div>
                <Switch checked={direccionSoloTexto} disabled={guardandoDireccion} onCheckedChange={cambiarDireccionSoloTexto} aria-label="Pasar a dirección de solo texto" />
              </div>
              {direccionSoloTexto && (
                <div className="mt-5 border-t pt-5">
                  <label htmlFor="costo-envio-texto" className="text-sm font-medium text-foreground">Costo fijo por envío</label>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Se aplicará a todos los pedidos delivery que ingresen con dirección escrita.</p>
                  <div className="mt-3 flex max-w-sm gap-2">
                    <div className="relative min-w-0 flex-1">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">$</span>
                      <Input
                        ref={costoEnvioRef}
                        id="costo-envio-texto"
                        value={costoEnvioFijo}
                        onChange={(event) => setCostoEnvioFijo(event.target.value.replace(/[^\d.,]/g, ''))}
                        onBlur={() => void guardarCostoEnvioFijo()}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            event.currentTarget.blur()
                          }
                        }}
                        inputMode="decimal"
                        placeholder="0"
                        className="h-11 pl-7"
                      />
                    </div>
                    <Button type="button" variant="outline" disabled={guardandoCostoEnvio} onClick={() => void guardarCostoEnvioFijo()}>
                      {guardandoCostoEnvio ? 'Guardando…' : 'Guardar'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </section></div></details>
}
