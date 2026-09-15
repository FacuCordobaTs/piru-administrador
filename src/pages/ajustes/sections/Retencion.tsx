import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import {
  Users,
  Sparkles,
  ArrowRight,
  Loader2,
  MessageCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { puntosApi, type ConfiguracionPuntosData, type Modulo } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/settings-dialog'
import { useAuthStore } from '@/store/authStore'
import { useModulosStore } from '@/store/modulosStore'
import { cn } from '@/lib/utils'
import { AjusteEditor } from '../components/AjusteEditor'
import { PuntosConfigEditor } from './PuntosConfigEditor'

export default function Retencion() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = useAuthStore((s) => s.token)

  const {
    categorias,
    cargar,
    desactivar,
    checkoutModulo,
    enviarPagoLinkModulo,
    reactivar,
  } = useModulosStore()

  const [puntosEditor, setPuntosEditor] = useState(false)
  const [puntosConfig, setPuntosConfig] = useState<ConfiguracionPuntosData | null>(null)
  const [procesandoCodigo, setProcesandoCodigo] = useState<string | null>(null)
  const [modalPago, setModalPago] = useState(false)
  const [modalBaja, setModalBaja] = useState<{ codigo: string; nombre: string } | null>(null)

  useEffect(() => {
    void cargar().catch(() => {})
  }, [cargar])

  // Resolución del módulo unificado de retención
  const buscarModulo = (codigo: string): Modulo | undefined => {
    return categorias.flatMap((c) => c.modulos).find((m) => m.codigo === codigo)
  }

  const moduloRetencion = buscarModulo('motor_recompra')
  const retencionActiva = moduloRetencion?.activoAhora ?? false
  const estadoModulo = moduloRetencion?.estado ?? 'inactivo'

  // El módulo incluye Club de Puntos y la lógica de clientes/micro-campañas
  const puntosHabilitados = retencionActiva

  useEffect(() => {
    const config = searchParams.get('config')
    if (config === 'puntos' && puntosHabilitados) setPuntosEditor(true)
  }, [searchParams, puntosHabilitados])

  useEffect(() => {
    if (puntosHabilitados && token) {
      puntosApi
        .getConfig(token)
        .then((res) => {
          if (res.success && res.data) setPuntosConfig(res.data)
        })
        .catch(() => {})
    }
  }, [puntosHabilitados, token])

  const describirPuntos = () => {
    if (!puntosConfig) return 'Configurado · Acumulación y canjes activos'
    if (!puntosConfig.activo) return 'Pausado (no se acumulan ni canjean puntos)'
    const canjes: string[] = []
    if (puntosConfig.permiteCanjeEnvioGratis) canjes.push('envío gratis')
    if (puntosConfig.permiteCanjeDescuento) canjes.push('descuentos')
    canjes.push('productos')
    return `1 pt cada $${puntosConfig.pesosPorPunto} · Canjes: ${canjes.join(', ')}`
  }

  // Inicio de checkout para Herramientas de retención (+$20.000/mes)
  const handleIniciarCheckout = async () => {
    setProcesandoCodigo('checkout')
    try {
      const res = await checkoutModulo('motor_recompra')
      if (res?.url_pago) {
        window.location.assign(res.url_pago)
      }
    } catch (error) {
      toast.error('No se pudo iniciar el checkout', {
        description: error instanceof Error ? error.message : 'Intentá de nuevo.',
      })
      setProcesandoCodigo(null)
    }
  }

  // Enviar link de pago por WhatsApp
  const handleEnviarLinkPago = async () => {
    setProcesandoCodigo('link')
    try {
      const res = await enviarPagoLinkModulo('motor_recompra')
      setModalPago(false)
      toast.success(`Te enviamos el link de pago a WhatsApp (${res.telefono})`)
    } catch (error) {
      toast.error('No pudimos enviar el link de Herramientas de retención', {
        description: error instanceof Error ? error.message : 'Intentá de nuevo.',
      })
    } finally {
      setProcesandoCodigo(null)
    }
  }

  // Confirmar baja programada
  const handleProgramarBaja = async () => {
    if (!modalBaja) return
    setProcesandoCodigo('baja')
    try {
      await desactivar(modalBaja.codigo)
      setModalBaja(null)
      toast.success(`La baja de ${modalBaja.nombre} quedó programada`, {
        description: 'Va a seguir disponible hasta el final del período ya pagado.',
      })
    } catch (error) {
      toast.error(`No pudimos programar la baja de ${modalBaja.nombre}`, {
        description: error instanceof Error ? error.message : 'Intentá de nuevo.',
      })
    } finally {
      setProcesandoCodigo(null)
    }
  }

  // Reactivar módulo con baja programada
  const handleReactivar = async () => {
    setProcesandoCodigo('reactivar')
    try {
      const res = await reactivar('motor_recompra')
      if (res && 'url_pago' in res && res.url_pago) {
        window.location.assign(res.url_pago)
        return
      }
      toast.success('Herramientas de retención sigue activo y no se dará de baja')
    } catch (error) {
      toast.error('No pudimos reactivar el módulo', {
        description: error instanceof Error ? error.message : 'Intentá de nuevo.',
      })
    } finally {
      setProcesandoCodigo(null)
    }
  }

  // Verificar pago pendiente
  const handleVerificarPago = async () => {
    setProcesandoCodigo('verificar')
    try {
      await cargar(true)
      toast.info('Verificando estado del pago…')
    } catch {
      toast.error('No se pudo verificar el pago')
    } finally {
      setProcesandoCodigo(null)
    }
  }

  let estadoBadgeText = 'Sin activar'
  let estadoBadgeClass = 'bg-muted text-muted-foreground'

  if (retencionActiva) {
    estadoBadgeText = 'Activo'
    estadoBadgeClass = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
  } else if (estadoModulo === 'pendiente_pago') {
    estadoBadgeText = 'Pago pendiente'
    estadoBadgeClass = 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
  } else if (estadoModulo === 'cancelacion_programada') {
    estadoBadgeText = 'Baja programada'
    estadoBadgeClass = 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
  }

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-lg font-medium text-foreground">Retención</h2>
        <p className="text-sm font-normal text-muted-foreground">
          Fidelización y recompra recurrente para tus clientes.
        </p>
      </header>

      {/* Control principal del Módulo: Flotante, sin caja ni bordes gruesos */}
      <div className="border-b border-border/50 pb-5 pt-1">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-medium text-foreground">
                Herramientas de retención
              </h3>
              <span
                className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0',
                  estadoBadgeClass
                )}
              >
                {estadoBadgeText}
              </span>
            </div>
            <p className="text-[13px] text-muted-foreground">
              +$20.000/mes · Activa la inteligencia de clientes y el club de puntos
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {retencionActiva && (
              <Button
                variant="outline"
                size="sm"
                disabled={Boolean(procesandoCodigo)}
                onClick={() =>
                  setModalBaja({
                    codigo: 'motor_recompra',
                    nombre: 'Herramientas de retención',
                  })
                }
                className="text-xs text-muted-foreground hover:text-destructive h-9"
              >
                Programar baja
              </Button>
            )}

            {!retencionActiva && estadoModulo === 'cancelacion_programada' && (
              <Button
                onClick={handleReactivar}
                size="sm"
                disabled={Boolean(procesandoCodigo)}
                className="font-medium h-9"
              >
                {procesandoCodigo === 'reactivar' ? 'Guardando…' : 'Reactivar módulo'}
              </Button>
            )}

            {!retencionActiva && estadoModulo === 'pendiente_pago' && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={Boolean(procesandoCodigo)}
                  onClick={handleVerificarPago}
                  className="font-medium h-9"
                >
                  Ya pagué, verificar
                </Button>
                <Button
                  size="sm"
                  disabled={Boolean(procesandoCodigo)}
                  onClick={() => setModalPago(true)}
                  className="font-medium h-9"
                >
                  Volver al pago
                </Button>
              </div>
            )}

            {!retencionActiva &&
              estadoModulo !== 'cancelacion_programada' &&
              estadoModulo !== 'pendiente_pago' && (
                <Button
                  onClick={() => setModalPago(true)}
                  size="sm"
                  disabled={Boolean(procesandoCodigo)}
                  className="font-medium h-9"
                >
                  Activar por $20.000/mes
                </Button>
              )}
          </div>
        </div>
      </div>

      {/* Capacidades explicadas en formato lineal conciso */}
      <div className="space-y-6">
        {/* Capacidad 1: Motor de Recompra e Inteligencia de Clientes */}
        <div className="border-b border-border/50 pb-6 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-base font-medium text-foreground">
                Motor de Recompra e Inteligencia de Clientes
              </h4>
              <p className="text-xs text-muted-foreground">
                Inteligencia sobre tu base de clientes (sin bots externos) en la sección Clientes
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/dashboard/clientes?tab=retencion')}
              className="shrink-0 h-9 font-medium gap-1.5"
            >
              <Users className="size-4" />
              Abrir motor
              <ArrowRight className="size-3.5 opacity-60" />
            </Button>
          </div>

          <ul className="space-y-1.5 text-[13px] text-muted-foreground max-w-2xl">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-500" />
              <span>
                <strong className="font-medium text-foreground">Cadencia y segmentación:</strong>{' '}
                Calcula la frecuencia de compra de cada comensal y clasifica en tiempo real (Nuevos, Activos, En riesgo, Dormidos, VIP).
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-500" />
              <span>
                <strong className="font-medium text-foreground">Micro-campañas por WhatsApp:</strong>{' '}
                Genera enlaces directos con sus platos favoritos ya precargados en el carrito para pedir en un toque.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-500" />
              <span>
                <strong className="font-medium text-foreground">Escalera de incentivos:</strong>{' '}
                Sugerencias de reactivación progresiva (recordatorio, 10% o 20% OFF) según el tiempo de inactividad.
              </span>
            </li>
          </ul>
        </div>

        {/* Capacidad 2: Club de Puntos para Clientes */}
        <div className="border-b border-border/50 pb-6 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-base font-medium text-foreground">
                Club de Puntos para Clientes
              </h4>
              <p className="text-xs text-muted-foreground">
                {retencionActiva ? describirPuntos() : 'Fidelización automática por pedidos en la tienda web'}
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              disabled={!retencionActiva}
              onClick={() => setPuntosEditor(true)}
              className="shrink-0 h-9 font-medium gap-1.5"
            >
              <Sparkles className="size-4 text-amber-500" />
              Configurar puntos
            </Button>
          </div>

          <ul className="space-y-1.5 text-[13px] text-muted-foreground max-w-2xl">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500" />
              <span>
                <strong className="font-medium text-foreground">Acumulación configurable:</strong>{' '}
                Definí cuántos pesos equivalen a 1 punto y montos mínimos de compra.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500" />
              <span>
                <strong className="font-medium text-foreground">Canjes a medida:</strong>{' '}
                Recompensas en productos específicos de la carta, cupones de descuento o envío gratis.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500" />
              <span>
                <strong className="font-medium text-foreground">Autoservicio y gestión:</strong>{' '}
                El cliente canjea sus puntos directamente en la tienda y podés ajustar saldos desde el panel.
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* Editor de Club de Puntos */}
      <AjusteEditor
        open={puntosEditor}
        onOpenChange={setPuntosEditor}
        titulo="Club de Puntos"
        descripcion="Definí cuánto dinero equivale a un punto y qué recompensas pueden canjear tus comensales."
      >
        <PuntosConfigEditor
          onSaved={() => {
            if (token) {
              puntosApi
                .getConfig(token)
                .then((res) => {
                  if (res.success && res.data) setPuntosConfig(res.data)
                })
                .catch(() => {})
            }
            setPuntosEditor(false)
          }}
        />
      </AjusteEditor>

      {/* Dialog para activar Herramientas de retención */}
      <Dialog
        open={modalPago}
        onOpenChange={(open) => !procesandoCodigo && setModalPago(open)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Activar Herramientas de retención</DialogTitle>
            <DialogDescription>
              Se cobra sólo el período restante hasta tu próxima renovación. Después se suma a tu factura mensual (+ $20.000/mes).
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl bg-muted/60 p-4 text-sm space-y-2">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Módulo</span>
              <span className="font-medium">+ $20.000/mes</span>
            </div>
            <p className="text-xs text-muted-foreground pt-1 border-t border-border/50">
              Incluye Inteligencia de Recompra (segmentación y cadencia en Clientes) y Club de Puntos en tu tienda.
            </p>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              disabled={Boolean(procesandoCodigo)}
              onClick={handleEnviarLinkPago}
              className="gap-2 w-full sm:w-auto"
            >
              {procesandoCodigo === 'link' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <MessageCircle className="size-4" />
              )}
              Enviar link a WhatsApp
            </Button>
            <Button
              disabled={Boolean(procesandoCodigo)}
              onClick={handleIniciarCheckout}
              className="gap-2 w-full sm:w-auto"
            >
              {procesandoCodigo === 'checkout' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Pagar ahora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para confirmar baja programada */}
      <Dialog
        open={Boolean(modalBaja)}
        onOpenChange={(open) => !open && !procesandoCodigo && setModalBaja(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Programar baja de Herramientas de retención</DialogTitle>
            <DialogDescription>
              El módulo va a seguir activo hasta el final de tu período actual. No se emitirán nuevos cobros por este módulo en tu próxima factura.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              disabled={Boolean(procesandoCodigo)}
              onClick={() => setModalBaja(null)}
              className="w-full sm:w-auto"
            >
              Mantener activo
            </Button>
            <Button
              variant="destructive"
              disabled={Boolean(procesandoCodigo)}
              onClick={handleProgramarBaja}
              className="w-full sm:w-auto"
            >
              {procesandoCodigo === 'baja' ? 'Programando…' : 'Confirmar baja'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
