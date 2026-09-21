import { useState } from 'react'
import { Loader2, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { fmtARS, cn } from '@/lib/utils'
import { useModuloCatalogo, useModulosStore, precioModulo } from '@/store/modulosStore'

export type ModuloComercialVariante = 'tarjeta' | 'fila' | 'plana'

export interface ModuloComercialProps {
  /** Código del módulo en el catálogo. El estado, el precio y el nombre salen de ahí. */
  codigo: string
  titulo: string
  descripcion: string
  icono: React.ElementType
  /** `pago` cobra (checkout o link por WhatsApp); `incluido` se activa solo. El catálogo manda. */
  tipo: 'pago' | 'incluido'
  /** Nombre que usan los diálogos y los avisos. Por defecto, `titulo`. */
  nombreComercial?: string
  /** Párrafo del diálogo de pago. Por defecto, `descripcion`. */
  incluye?: string
  /** `tarjeta` y `fila` son cajas; `plana` es una línea suelta, sin caja. */
  variante?: ModuloComercialVariante
  /** Se dispara después de cada mutación confirmada, para que el consumidor recargue. */
  onCambioEstado?: () => void
}

/**
 * Estado comercial de un módulo donde la capacidad se usa, no donde se factura.
 *
 * Sólo cubre el módulo **apagado**: activación, pago pendiente y baja programada.
 * Con el módulo activo no renderiza nada — la baja se gestiona desde Mis módulos,
 * junto al resto de la suscripción.
 *
 * No decide el gating de la pantalla que lo hospeda: cada consumidor conserva el
 * suyo (`props.crecimientoActivo`, `bloqueadoPlan`, `bloqueado`). Las mutaciones
 * van contra `/modulos/*`, que sólo exige sesión; el gate real de la capacidad
 * sigue estando en los endpoints de la feature.
 */
export function ModuloComercial({
  codigo,
  titulo,
  descripcion,
  icono: Icon,
  tipo,
  nombreComercial,
  incluye,
  variante = 'tarjeta',
  onCambioEstado,
}: ModuloComercialProps) {
  const modulo = useModuloCatalogo(codigo)
  const { activar, checkoutModulo, enviarPagoLinkModulo, reactivar, cargar } = useModulosStore()

  const [procesando, setProcesando] = useState<string | null>(null)
  const [modalPago, setModalPago] = useState(false)

  const nombre = nombreComercial ?? titulo
  const activo = modulo?.activoAhora ?? false
  const estado = modulo?.estado ?? 'inactivo'
  // El catálogo gana sobre la prop: si un módulo pasó a incluido, la pantalla no
  // puede ofrecer un checkout que el backend rechaza. La prop queda como pista
  // para cuando el catálogo todavía no cargó.
  const tipoEfectivo = modulo?.tipo ?? tipo
  // Un incluido no tiene precio ni aunque le quede un monto en el catálogo: `fmtARS(0)`
  // devuelve "$ 0", que es un precio, y acá no corresponde ninguno.
  const precioTexto = tipoEfectivo === 'pago' ? fmtARS(precioModulo(modulo)) : null

  // El módulo prendido no tiene bloque comercial en esta superficie.
  if (activo) return null

  let estadoBadgeText = 'Sin activar'
  let estadoBadgeClass = 'bg-muted text-muted-foreground'
  if (estado === 'pendiente_pago') {
    estadoBadgeText = 'Pago pendiente'
    estadoBadgeClass = 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
  } else if (estado === 'cancelacion_programada') {
    estadoBadgeText = 'Baja programada'
    estadoBadgeClass = 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
  }

  // El consumidor decide qué recargar: acá sólo se limpia el estado de la mutación.
  const finalizarCambio = () => {
    setProcesando(null)
    onCambioEstado?.()
  }

  const activarIncluido = async () => {
    setProcesando('activar')
    try {
      await activar(codigo)
      toast.success(`${nombre} está activo`)
      finalizarCambio()
    } catch (error) {
      toast.error(`No pudimos activar ${nombre}`, {
        description: error instanceof Error ? error.message : 'Intentá de nuevo.',
      })
      setProcesando(null)
    }
  }

  const iniciarCheckout = async () => {
    setProcesando('checkout')
    try {
      const res = await checkoutModulo(codigo)
      if (res?.url_pago) {
        window.location.assign(res.url_pago)
        return
      }
      setProcesando(null)
    } catch (error) {
      toast.error('No se pudo iniciar el checkout', {
        description: error instanceof Error ? error.message : 'Intentá de nuevo.',
      })
      setProcesando(null)
    }
  }

  const enviarLinkPago = async () => {
    setProcesando('link')
    try {
      const res = await enviarPagoLinkModulo(codigo)
      setModalPago(false)
      toast.success(`Te enviamos el link de pago a WhatsApp (${res.telefono})`)
      finalizarCambio()
    } catch (error) {
      toast.error(`No pudimos enviar el link de ${nombre}`, {
        description: error instanceof Error ? error.message : 'Intentá de nuevo.',
      })
      setProcesando(null)
    }
  }

  const reactivarModulo = async () => {
    setProcesando('reactivar')
    try {
      const res = await reactivar(codigo)
      if (res && 'url_pago' in res && res.url_pago) {
        window.location.assign(res.url_pago)
        return
      }
      toast.success(`${nombre} sigue activo y no se dará de baja`)
      finalizarCambio()
    } catch (error) {
      toast.error('No pudimos reactivar el módulo', {
        description: error instanceof Error ? error.message : 'Intentá de nuevo.',
      })
      setProcesando(null)
    }
  }

  const verificarPago = async () => {
    setProcesando('verificar')
    toast.info('Verificando el estado del pago…')
    try {
      await cargar(true)
      finalizarCambio()
    } catch {
      toast.error('No se pudo verificar el pago')
      setProcesando(null)
    }
  }

  const ocupado = Boolean(procesando)
  // En `plana` el botón no ocupa el ancho: la línea no es una caja que lo contenga.
  const anchoCta = variante === 'plana' ? '' : 'w-full'

  const acciones = estado === 'pendiente_pago' ? (
    <>
      <Button variant="outline" size="sm" disabled={ocupado} onClick={verificarPago} className="font-medium">
        {procesando === 'verificar' ? <Loader2 className="size-4 animate-spin" /> : null}
        Ya pagué, verificar
      </Button>
      <Button size="sm" disabled={ocupado} onClick={() => setModalPago(true)} className="font-medium">
        Volver al pago
      </Button>
    </>
  ) : estado === 'cancelacion_programada' ? (
    <Button size="sm" disabled={ocupado} onClick={reactivarModulo} className="font-medium">
      {procesando === 'reactivar' ? 'Guardando…' : 'Reactivar módulo'}
    </Button>
  ) : tipoEfectivo === 'pago' ? (
    <Button size="sm" disabled={ocupado} onClick={() => setModalPago(true)} className={cn('font-medium', anchoCta)}>
      {precioTexto ? `Activar por ${precioTexto}/mes` : 'Activar módulo'}
    </Button>
  ) : (
    <Button size="sm" disabled={ocupado} onClick={activarIncluido} className={cn('font-medium', anchoCta)}>
      {procesando === 'activar' ? 'Activando…' : 'Activar gratis'}
    </Button>
  )

  const badge = (
    <span className={cn('inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium', estadoBadgeClass)}>
      {estadoBadgeText}
    </span>
  )

  return (
    <>
      {variante === 'plana' ? (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="flex min-w-0 items-center gap-2">
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <p className="min-w-0 truncate text-sm font-semibold text-foreground">{titulo}</p>
              {precioTexto && (
                <span className="shrink-0 text-xs font-medium text-muted-foreground">{precioTexto}/mes</span>
              )}
            </div>
            {badge}
            <div className="ml-auto flex flex-wrap items-center gap-2">{acciones}</div>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{descripcion}</p>
        </>
      ) : variante === 'fila' ? (
        <div className="rounded-2xl border border-border/70 bg-muted/20 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Icon className="size-4" />
              </span>
              <p className="min-w-0 truncate text-sm font-semibold text-foreground">{titulo}</p>
            </div>
            {badge}
          </div>
          {precioTexto && (
            <p className="mt-2 text-xs font-medium text-muted-foreground">{precioTexto}/mes</p>
          )}
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground line-clamp-3">{descripcion}</p>
          <div className="mt-3 flex flex-wrap gap-2">{acciones}</div>
        </div>
      ) : (
        <div className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card/60 p-5 shadow-xs transition-all">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-foreground">{titulo}</h3>
                  {precioTexto && (
                    <p className="mt-0.5 text-xs font-medium text-muted-foreground">+{precioTexto}/mes</p>
                  )}
                </div>
              </div>
              {badge}
            </div>
            <p className="mt-3.5 min-h-[36px] text-xs leading-relaxed text-muted-foreground">{descripcion}</p>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border/40 pt-4">{acciones}</div>
        </div>
      )}

      <Dialog open={modalPago} onOpenChange={(open) => !ocupado && setModalPago(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Activar {nombre}</DialogTitle>
            <DialogDescription>
              Se cobra sólo el período restante hasta tu próxima renovación. Después se suma a tu factura
              mensual{precioTexto ? ` (${precioTexto}/mes)` : ''}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-xl bg-muted/60 p-4 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{nombre}</span>
              <span className="font-medium">{precioTexto ? `+ ${precioTexto}/mes` : '—'}</span>
            </div>
            <p className="border-t border-border/50 pt-1 text-xs text-muted-foreground">{incluye ?? descripcion}</p>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" disabled={ocupado} onClick={enviarLinkPago} className="w-full gap-2 sm:w-auto">
              {procesando === 'link' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <MessageCircle className="size-4" />
              )}
              Enviar link a WhatsApp
            </Button>
            <Button disabled={ocupado} onClick={iniciarCheckout} className="w-full gap-2 sm:w-auto">
              {procesando === 'checkout' ? <Loader2 className="size-4 animate-spin" /> : null}
              Pagar ahora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
