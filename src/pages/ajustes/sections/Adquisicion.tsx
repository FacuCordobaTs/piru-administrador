import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { TrendingUp, Sparkles, Loader2, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/settings-dialog'
import { useModulosStore } from '@/store/modulosStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { cn } from '@/lib/utils'
import { AjusteRow } from '../components/AjusteRow'
import { AjusteEditor } from '../components/AjusteEditor'
import { AjusteInput } from '../components/AjusteInput'
import type { Modulo } from '@/lib/api'

const formatoGtm = (value: string) => value.trim().toUpperCase()
const validarGtm = (value: string) => {
  if (value === '') return null
  return /^GTM-[A-Z0-9]{4,32}$/.test(value)
    ? null
    : 'Usá el ID del contenedor, por ejemplo GTM-ABC123.'
}

interface HerramientaModuloCardProps {
  modulo?: Modulo
  titulo: string
  descripcion: string
  icono: React.ElementType
  tipo: 'pago' | 'incluido'
  precioTexto: string
  accionLabel: string
  onAccion: () => void
  onActivarGratis?: () => void
  onActivarPago?: () => void
  onDesactivar?: () => void
  onReactivar?: () => void
  onVerificarPago?: () => void
  procesando: boolean
}

/**
 * Componente unificado que cumple doble función:
 * 1. Acceso y configuración operativa de la herramienta ("Ver campañas", "Gestionar cupones").
 * 2. Estado, precio y activación/desactivación del módulo comercial sin duplicar vistas.
 */
function HerramientaModuloCard({
  modulo,
  titulo,
  descripcion,
  icono: Icon,
  tipo,
  precioTexto,
  accionLabel,
  onAccion,
  onActivarGratis,
  onActivarPago,
  onDesactivar,
  onReactivar,
  onVerificarPago,
  procesando,
}: HerramientaModuloCardProps) {
  const activo = modulo?.activoAhora ?? false
  const estado = modulo?.estado ?? 'inactivo'

  let estadoBadgeText = 'Sin activar'
  let estadoBadgeClass = 'bg-muted text-muted-foreground'

  if (activo) {
    estadoBadgeText = 'Activo'
    estadoBadgeClass = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
  } else if (estado === 'pendiente_pago') {
    estadoBadgeText = 'Pago pendiente'
    estadoBadgeClass = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
  } else if (estado === 'cancelacion_programada') {
    estadoBadgeText = 'Baja programada'
    estadoBadgeClass = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
  }

  return (
    <div
      className={cn(
        'flex flex-col justify-between rounded-2xl border p-5 transition-all shadow-xs',
        activo ? 'border-border bg-card' : 'border-border/70 bg-card/60'
      )}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-xl',
                activo
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              <Icon className="size-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground truncate">{titulo}</h3>
              <p className="text-xs font-medium text-muted-foreground mt-0.5">{precioTexto}</p>
            </div>
          </div>
          <span
            className={cn(
              'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium shrink-0',
              estadoBadgeClass
            )}
          >
            {estadoBadgeText}
          </span>
        </div>

        <p className="mt-3.5 text-xs leading-relaxed text-muted-foreground min-h-[36px]">
          {descripcion}
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-4">
        {activo && (
          <>
            <Button onClick={onAccion} size="sm" className="font-medium">
              {accionLabel}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={procesando}
              onClick={onDesactivar}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              {tipo === 'pago' ? 'Programar baja' : 'Desactivar'}
            </Button>
          </>
        )}

        {!activo && estado === 'cancelacion_programada' && (
          <>
            <Button onClick={onAccion} size="sm" variant="outline" className="font-medium">
              {accionLabel}
            </Button>
            <Button
              onClick={onReactivar}
              size="sm"
              disabled={procesando}
              className="font-medium"
            >
              {procesando ? 'Guardando…' : 'Reactivar módulo'}
            </Button>
          </>
        )}

        {!activo && estado === 'pendiente_pago' && (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={procesando}
              onClick={onVerificarPago}
              className="font-medium"
            >
              Ya pagué, verificar
            </Button>
            <Button
              size="sm"
              disabled={procesando}
              onClick={onActivarPago}
              className="font-medium"
            >
              Volver al pago
            </Button>
          </>
        )}

        {!activo && estado !== 'cancelacion_programada' && estado !== 'pendiente_pago' && (
          tipo === 'pago' ? (
            <Button
              onClick={onActivarPago}
              size="sm"
              disabled={procesando}
              className="w-full font-medium"
            >
              Activar por $20.000/mes
            </Button>
          ) : (
            <Button
              onClick={onActivarGratis}
              size="sm"
              disabled={procesando}
              className="w-full font-medium"
            >
              {procesando ? 'Activando…' : 'Activar gratis'}
            </Button>
          )
        )}
      </div>
    </div>
  )
}

export default function Adquisicion() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const restaurante = useRestauranteStore((s) => s.restaurante)
  const gtmContainerId = restaurante?.gtmContainerId?.trim() || ''

  const {
    categorias,
    cargar,
    activar,
    desactivar,
    checkoutModulo,
    enviarPagoLinkModulo,
    reactivar,
  } = useModulosStore()

  const [gtmEditor, setGtmEditor] = useState(false)
  const [procesandoCodigo, setProcesandoCodigo] = useState<string | null>(null)
  const [modalPago, setModalPago] = useState(false)
  const [modalBaja, setModalBaja] = useState<{ codigo: string; nombre: string } | null>(null)

  useEffect(() => {
    void cargar().catch(() => {})
  }, [cargar])

  useEffect(() => {
    if (searchParams.get('config') === 'gtm') {
      setGtmEditor(true)
    }
  }, [searchParams])

  const buscarModulo = (codigo: string): Modulo | undefined => {
    return categorias.flatMap((c) => c.modulos).find((m) => m.codigo === codigo)
  }

  const moduloCrecimiento = buscarModulo('crecimiento')
  const moduloCodigos = buscarModulo('codigos_descuento')

  // Activación de módulo incluido (Códigos de descuento)
  const handleActivarGratis = async (codigo: string, nombre: string) => {
    setProcesandoCodigo(codigo)
    try {
      await activar(codigo)
      toast.success(`${nombre} está activo`)
    } catch (error) {
      toast.error(`No pudimos activar ${nombre}`, {
        description: error instanceof Error ? error.message : 'Intentá de nuevo.',
      })
    } finally {
      setProcesandoCodigo(null)
    }
  }

  // Desactivación de módulo incluido
  const handleDesactivarGratis = async (codigo: string, nombre: string) => {
    setProcesandoCodigo(codigo)
    try {
      await desactivar(codigo)
      toast.success(`${nombre} fue desactivado`)
    } catch (error) {
      toast.error(`No pudimos desactivar ${nombre}`, {
        description: error instanceof Error ? error.message : 'Intentá de nuevo.',
      })
    } finally {
      setProcesandoCodigo(null)
    }
  }

  // Inicio de checkout para Campañas de adquisición (+$20.000/mes)
  const handleIniciarCheckout = async () => {
    setProcesandoCodigo('checkout')
    try {
      const res = await checkoutModulo('crecimiento')
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
      const res = await enviarPagoLinkModulo('crecimiento')
      setModalPago(false)
      toast.success(`Te enviamos el link de pago a WhatsApp (${res.telefono})`)
    } catch (error) {
      toast.error('No pudimos enviar el link de Campañas de adquisición', {
        description: error instanceof Error ? error.message : 'Intentá de nuevo.',
      })
    } finally {
      setProcesandoCodigo(null)
    }
  }

  // Confirmar baja programada para Campañas de adquisición
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
  const handleReactivar = async (codigo: string, nombre: string) => {
    setProcesandoCodigo(codigo)
    try {
      const res = await reactivar(codigo)
      if (res && 'url_pago' in res && res.url_pago) {
        window.location.assign(res.url_pago)
        return
      }
      toast.success(`${nombre} sigue activo y no se dará de baja`)
    } catch (error) {
      toast.error(`No pudimos reactivar ${nombre}`, {
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

  return (
    <section className="space-y-8">
      <header className="space-y-3">
        <h2 className="text-xl font-medium tracking-tight text-foreground">
          Adquisición
        </h2>
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed max-w-2xl">
          <p>
            Herramientas y canales para captar pedidos directos hacia tu tienda web desde historias de Instagram, reels, anuncios digitales o folletos en la bolsa de entrega.
          </p>
          <p>
            Creá enlaces que lleven a tu menú completo, a un producto específico o con el carrito ya prearmado, administrá códigos de descuento y conectá Google Tag Manager para medir visitas y conversiones de cada canal.
          </p>
        </div>
      </header>

      {/* Componentes unificados de herramientas y módulos de adquisición */}
      <div className="grid gap-4 sm:grid-cols-2">
        <HerramientaModuloCard
          modulo={moduloCrecimiento}
          titulo="Campañas de adquisición"
          descripcion="Medí ventas desde Historias de Instagram, Reels, TikTok, Meta Ads y Packaging con enlaces y carritos precargados."
          icono={TrendingUp}
          tipo="pago"
          precioTexto="+$20.000/mes"
          accionLabel="Ver campañas"
          onAccion={() => navigate('/dashboard/clientes?tab=adquisicion&vista=campanas')}
          onActivarPago={() => setModalPago(true)}
          onDesactivar={() =>
            setModalBaja({ codigo: 'crecimiento', nombre: 'Campañas de adquisición' })
          }
          onReactivar={() => handleReactivar('crecimiento', 'Campañas de adquisición')}
          onVerificarPago={handleVerificarPago}
          procesando={Boolean(procesandoCodigo)}
        />

        <HerramientaModuloCard
          modulo={moduloCodigos}
          titulo="Códigos de descuento (Cupones)"
          descripcion="Cupones promocionales y de bienvenida para captar comensales en redes y folletería."
          icono={Sparkles}
          tipo="incluido"
          precioTexto="Incluido · sin costo extra"
          accionLabel="Gestionar cupones"
          onAccion={() => navigate('/dashboard/clientes?tab=adquisicion&vista=cupones')}
          onActivarGratis={() =>
            handleActivarGratis('codigos_descuento', 'Códigos de descuento')
          }
          onDesactivar={() =>
            handleDesactivarGratis('codigos_descuento', 'Códigos de descuento')
          }
          procesando={Boolean(procesandoCodigo)}
        />
      </div>

      {/* Medición y analítica */}
      <div className="space-y-3 pt-2">
        <div className="border-t border-border/50 pt-6">
          <h3 className="text-sm font-medium text-foreground mb-1">Medición y analítica</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Conectá tu contenedor de Google Tag Manager para medir visitas y conversiones de tus campañas en Meta y TikTok.
          </p>
          <AjusteRow
            titulo="Google Tag Manager (GTM) y Meta Pixel"
            oracion={
              gtmContainerId
                ? `Contenedor ${gtmContainerId} conectado · Medición de visitas y conversiones activa`
                : 'Sin contenedor configurado — conectá tu ID de GTM para medir pauta digital'
            }
            estado={gtmContainerId ? 'configurado' : 'sin-configurar'}
            accionLabel={gtmContainerId ? 'Editar' : 'Configurar'}
            onAccion={() => setGtmEditor(true)}
          />
        </div>
      </div>

      {/* Editor de GTM */}
      <AjusteEditor
        open={gtmEditor}
        onOpenChange={setGtmEditor}
        titulo="Google Tag Manager"
        descripcion="Pegá el ID de tu contenedor para medir visitas y conversiones de tu tienda."
      >
        <div className="space-y-3">
          <AjusteInput
            campo="gtmContainerId"
            label="ID del contenedor"
            placeholder="GTM-ABC123"
            mono
            transform={formatoGtm}
            validate={validarGtm}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Piru no inyecta scripts pesados por defecto para que la tienda cargue en milisegundos. Si utilizás Meta Pixel, Google Analytics 4 o TikTok Pixel, administralos de forma transparente dentro de tu contenedor GTM.
          </p>
        </div>
      </AjusteEditor>

      {/* Dialog para activar Campañas de adquisición */}
      <Dialog open={modalPago} onOpenChange={(open) => !procesandoCodigo && setModalPago(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Activar Campañas de adquisición</DialogTitle>
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
              Incluye enlaces con atribución para Historias, Reels, TikTok, Meta Ads y Packaging con carritos precargados.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              disabled={Boolean(procesandoCodigo)}
              onClick={() => setModalPago(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="outline"
              disabled={Boolean(procesandoCodigo)}
              onClick={handleEnviarLinkPago}
            >
              <MessageCircle className="h-4 w-4 mr-1.5" />
              Link por WhatsApp
            </Button>
            <Button
              disabled={Boolean(procesandoCodigo)}
              onClick={handleIniciarCheckout}
            >
              {procesandoCodigo === 'checkout' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : null}
              Pagar ahora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para confirmar baja programada */}
      <Dialog
        open={Boolean(modalBaja)}
        onOpenChange={(open) => !procesandoCodigo && !open && setModalBaja(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Programar la baja de {modalBaja?.nombre}?</DialogTitle>
            <DialogDescription>
              No se reintegra el período actual: el módulo seguirá activo hasta la fecha que ya tenés paga.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              disabled={Boolean(procesandoCodigo)}
              onClick={() => setModalBaja(null)}
            >
              Conservar módulo
            </Button>
            <Button
              variant="destructive"
              disabled={Boolean(procesandoCodigo)}
              onClick={handleProgramarBaja}
            >
              {procesandoCodigo === 'baja' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : null}
              Programar baja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
