import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import {
  BellRing,
  Blocks,
  Check,
  Clock3,
  CreditCard,
  Rocket,
  Settings2,
  Sparkles,
  Loader2,
  MessageCircle,
  Wrench,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useModulosStore } from '@/store/modulosStore'
import type { Modulo } from '@/lib/api'

const fmtARS = (monto: string) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(Number(monto))

const ICONOS: Record<string, typeof Blocks> = {
  pos: Blocks,
  mesas: Blocks,
  puntos_clientes: Sparkles,
  codigos_descuento: Sparkles,
  mercadopago: CreditCard,
  talo: CreditCard,
  rapiboy: Rocket,
  facturacion_arca: Settings2,
  gestion_stock: Blocks,
  gestion_cadetes: Rocket,
  impresion_comandas: Settings2,
  multisucursal: Blocks,
  avisos_automaticos_whatsapp: BellRing,
  motor_recompra: Sparkles,
}

function ModuloIcono({ modulo }: { modulo: Modulo }) {
  const Icon = ICONOS[modulo.codigo] ?? Blocks
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
      <Icon className="h-5 w-5" />
    </span>
  )
}

function EstadoModulo({ modulo }: { modulo: Modulo }) {
  if (modulo.estadoProducto === 'proximamente') {
    return <Badge variant="outline" className="border-muted-foreground/25 text-muted-foreground">Próximamente</Badge>
  }
  if (modulo.estado === 'activo') {
    if (modulo.origen === 'legacy' && Number(modulo.precioMensualCongelado) === 0) {
      return <Badge className="bg-emerald-600 hover:bg-emerald-600">Bonificado</Badge>
    }
    return <Badge className="bg-emerald-600 hover:bg-emerald-600">Activo</Badge>
  }
  if (modulo.estado === 'cancelacion_programada') {
    return <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400">Baja programada</Badge>
  }
  if (modulo.estado === 'pendiente_pago') {
    return <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400">Pago pendiente</Badge>
  }
  if (modulo.estado === 'suspendido') {
    return <Badge variant="outline" className="border-destructive/30 text-destructive">Suspendido</Badge>
  }
  if (modulo.estadoProducto === 'beta') return <Badge variant="outline">Beta</Badge>
  return <Badge variant="secondary">Inactivo</Badge>
}

function requisitoConfiguracion(modulo: Modulo) {
  if (modulo.estadoProducto === 'proximamente') return 'Configuración en preparación'
  if (!modulo.activable) return 'Configuración en preparación'
  if (modulo.codigo === 'mercadopago') return 'Requiere conectar Mercado Pago'
  if (modulo.codigo === 'talo') return 'Requiere cargar tus credenciales de Talo'
  if (modulo.codigo === 'rapiboy') return 'Requiere configurar la integración de Rapiboy'
  if (modulo.codigo === 'facturacion_arca') return 'Requiere completar la configuración de ARCA'
  if (modulo.codigo === 'impresion_comandas') return 'Requiere configurar una impresora'
  return null
}

const RUTAS_CONFIGURACION: Partial<Record<string, string>> = {
  codigos_descuento: '/dashboard/codigos-descuento',
  mercadopago: '/dashboard/ajustes/pagos?config=mercadopago',
  talo: '/dashboard/ajustes/pagos?config=talo',
  rapiboy: '/dashboard/ajustes/entregas?config=rapiboy',
  gestion_cadetes: '/dashboard/repartidores',
  facturacion_arca: '/dashboard/ajustes/facturacion?config=arca',
  impresion_comandas: '/dashboard/ajustes/impresion?config=impresion',
  multisucursal: '/dashboard/ajustes/entregas?config=sucursales',
  avisos_automaticos_whatsapp: '/dashboard/ajustes/avisos',
}

/**
 * Los módulos pagos siempre muestran su próximo paso explícitamente: cobrar,
 * esperar acreditación, programar baja o revertirla. La activación real sigue
 * dependiendo exclusivamente del webhook aprobado.
 */
function CtaModulo({
  modulo,
  procesando,
  onActivar,
  onDesactivar,
  onActivarPago,
  onReactivarPago,
  onActualizarPago,
  onConfigurar,
}: {
  modulo: Modulo
  procesando: boolean
  onActivar: () => void
  onDesactivar: () => void
  onActivarPago: () => void
  onReactivarPago: () => void
  onActualizarPago: () => void
  onConfigurar: () => void
}) {
  if (modulo.estadoProducto === 'proximamente' || !modulo.activable) {
    return <Button className="w-full" variant="secondary" disabled>Próximamente</Button>
  }
  if (modulo.estado === 'activo') {
    if (modulo.tipo === 'pago') {
      return <Button className="w-full" variant="ghost" disabled={procesando} onClick={onDesactivar}>{procesando ? 'Guardando…' : 'Desactivar al finalizar el período'}</Button>
    }
    return (
      <div className="grid grid-cols-2 gap-2">
        {RUTAS_CONFIGURACION[modulo.codigo] ? (
          <Button variant="outline" onClick={onConfigurar}>Configurar</Button>
        ) : <Button variant="outline" disabled>Activo</Button>}
        <Button variant="ghost" disabled={procesando} onClick={onDesactivar}>
          {procesando ? 'Guardando…' : 'Desactivar'}
        </Button>
      </div>
    )
  }
  if (modulo.estado === 'cancelacion_programada') {
    return <Button className="w-full" variant="outline" disabled={procesando} onClick={onReactivarPago}>{procesando ? 'Guardando…' : 'Reactivar módulo'}</Button>
  }
  if (modulo.estado === 'pendiente_pago') {
    return <Button className="w-full" variant="outline" disabled={procesando} onClick={onActualizarPago}>{procesando ? 'Actualizando…' : 'Ya pagué, actualizar'}</Button>
  }
  if (modulo.estado === 'suspendido') {
    return <Button className="w-full" variant="outline" disabled>Revisar suscripción</Button>
  }
  return modulo.tipo === 'pago'
    ? <Button className="w-full" disabled={procesando} onClick={onActivarPago}>Activar por {fmtARS(modulo.precioMensual)}/mes</Button>
    : <Button className="w-full" disabled={procesando} onClick={onActivar}>{procesando ? 'Activando…' : 'Activar gratis'}</Button>
}

function CardModulo({
  modulo,
  pago,
  procesando,
  onActivar,
  onDesactivar,
  onActivarPago,
  onReactivarPago,
  onActualizarPago,
  onConfigurar,
}: {
  modulo: Modulo
  pago?: boolean
  procesando: boolean
  onActivar: () => void
  onDesactivar: () => void
  onActivarPago: () => void
  onReactivarPago: () => void
  onActualizarPago: () => void
  onConfigurar: () => void
}) {
  const requisito = requisitoConfiguracion(modulo)
  return (
    <article className={cn(
      'flex min-h-[255px] flex-col rounded-2xl border bg-card p-5 shadow-sm',
      pago && 'border-brand/30 bg-gradient-to-br from-card via-card to-brand/[0.045]',
    )}>
      <div className="flex items-start justify-between gap-3">
        <ModuloIcono modulo={modulo} />
        <EstadoModulo modulo={modulo} />
      </div>
      <div className="mt-4">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h2 className="text-base font-semibold tracking-tight text-foreground">{modulo.nombre}</h2>
          {modulo.tipo === 'incluido' ? (
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Incluido</span>
          ) : (
            <span className="text-xs font-medium text-brand">+{fmtARS(modulo.precioMensual)}/mes</span>
          )}
        </div>
        <p className="mt-1.5 min-h-10 text-sm leading-relaxed text-muted-foreground">
          {modulo.descripcion || 'Sumá esta capacidad a la operación de tu local.'}
        </p>
      </div>
      <div className="mt-4 min-h-9">
        {requisito && (
          <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
            <Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {requisito}
          </p>
        )}
        {modulo.activoAhora && !requisito && (
          <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
            <Check className="h-3.5 w-3.5" /> Disponible para usar
          </p>
        )}
      </div>
      <div className="mt-auto pt-4">
        <CtaModulo modulo={modulo} procesando={procesando} onActivar={onActivar} onDesactivar={onDesactivar} onActivarPago={onActivarPago} onReactivarPago={onReactivarPago} onActualizarPago={onActualizarPago} onConfigurar={onConfigurar} />
      </div>
    </article>
  )
}

function CatalogoSkeleton() {
  return (
    <div className="space-y-10">
      {[0, 1, 2].map((grupo) => (
        <section key={grupo}>
          <Skeleton className="h-6 w-44" />
          <Skeleton className="mt-2 h-4 w-72" />
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((card) => <Skeleton key={card} className="h-64 rounded-2xl" />)}
          </div>
        </section>
      ))}
    </div>
  )
}

export default function Modulos() {
  const navigate = useNavigate()
  const location = useLocation()
  const categorias = useModulosStore((state) => state.categorias)
  const cargando = useModulosStore((state) => state.cargando)
  const error = useModulosStore((state) => state.error)
  const cargar = useModulosStore((state) => state.cargar)
  const activar = useModulosStore((state) => state.activar)
  const desactivar = useModulosStore((state) => state.desactivar)
  const checkoutModulo = useModulosStore((state) => state.checkoutModulo)
  const enviarPagoLinkModulo = useModulosStore((state) => state.enviarPagoLinkModulo)
  const reactivar = useModulosStore((state) => state.reactivar)
  const [procesandoCodigo, setProcesandoCodigo] = useState<string | null>(null)
  const [moduloPagoSeleccionado, setModuloPagoSeleccionado] = useState<Modulo | null>(null)
  const [confirmandoBaja, setConfirmandoBaja] = useState<Modulo | null>(null)
  const vieneDeActivarSuscripcion = new URLSearchParams(location.search).get('origen') === 'suscripcion'

  useEffect(() => {
    void cargar().catch(() => undefined)
  }, [cargar])

  useEffect(() => {
    if (new URLSearchParams(location.search).get('checkout') !== 'success') return
    let cancelado = false
    const demoras = [0, 1500, 4000, 8000]
    const verificar = async (intento: number) => {
      try {
        await cargar(true)
        if (!cancelado && intento === 0) toast.info('Estamos verificando la acreditación de tu pago…')
      } catch { /* el próximo intento vuelve a consultar */ }
      if (!cancelado && intento + 1 < demoras.length) window.setTimeout(() => void verificar(intento + 1), demoras[intento + 1])
      if (!cancelado && intento + 1 === demoras.length) window.history.replaceState({}, '', '/dashboard/modulos')
    }
    void verificar(0)
    return () => { cancelado = true }
  }, [cargar, location.search])

  const categoriasNormales = categorias.filter((categoria) => categoria.modulos.some((modulo) => modulo.tipo === 'incluido'))
  const pagos = categorias.flatMap((categoria) => categoria.modulos).filter((modulo) => modulo.tipo === 'pago')

  const activarIncluido = async (modulo: Modulo) => {
    setProcesandoCodigo(modulo.codigo)
    try {
      await activar(modulo.codigo)
      const ruta = RUTAS_CONFIGURACION[modulo.codigo]
      toast.success(`${modulo.nombre} está activo`, ruta ? {
        description: 'Podés configurarlo ahora o volver más tarde desde Módulos.',
        action: { label: 'Configurar', onClick: () => navigate(ruta) },
      } : undefined)
    } catch (error) {
      toast.error(`No pudimos activar ${modulo.nombre}`, {
        description: error instanceof Error ? error.message : 'Intentá de nuevo.',
      })
    } finally {
      setProcesandoCodigo(null)
    }
  }

  const desactivarIncluido = async (modulo: Modulo) => {
    setProcesandoCodigo(modulo.codigo)
    try {
      await desactivar(modulo.codigo)
      toast.success(`${modulo.nombre} fue desactivado`)
    } catch (error) {
      toast.error(`No pudimos desactivar ${modulo.nombre}`, {
        description: error instanceof Error ? error.message : 'Intentá de nuevo.',
      })
    } finally {
      setProcesandoCodigo(null)
    }
  }

  const configurarModulo = (modulo: Modulo) => {
    const ruta = RUTAS_CONFIGURACION[modulo.codigo]
    if (ruta) navigate(ruta)
  }

  const totalMensualCon = (modulo: Modulo) => {
    const actual = Number(useModulosStore.getState().suscripcion?.montoTotalMensual ?? 0)
    return actual + Number(modulo.precioMensual)
  }

  const iniciarCheckout = async () => {
    const modulo = moduloPagoSeleccionado
    if (!modulo) return
    setProcesandoCodigo(modulo.codigo)
    try {
      const checkout = await checkoutModulo(modulo.codigo)
      window.location.assign(checkout.url_pago)
    } catch (error) {
      toast.error(`No pudimos iniciar el pago de ${modulo.nombre}`, { description: error instanceof Error ? error.message : 'Intentá de nuevo.' })
    } finally {
      setProcesandoCodigo(null)
    }
  }

  const enviarLinkPago = async () => {
    const modulo = moduloPagoSeleccionado
    if (!modulo) return
    setProcesandoCodigo(modulo.codigo)
    try {
      const resultado = await enviarPagoLinkModulo(modulo.codigo)
      setModuloPagoSeleccionado(null)
      toast.success(`Te enviamos el link de pago a WhatsApp (${resultado.telefono})`)
    } catch (error) {
      toast.error(`No pudimos enviar el link de ${modulo.nombre}`, { description: error instanceof Error ? error.message : 'Intentá de nuevo.' })
    } finally {
      setProcesandoCodigo(null)
    }
  }

  const programarBaja = async () => {
    const modulo = confirmandoBaja
    if (!modulo) return
    setProcesandoCodigo(modulo.codigo)
    try {
      await desactivar(modulo.codigo)
      setConfirmandoBaja(null)
      toast.success(`La baja de ${modulo.nombre} quedó programada`, { description: 'Va a seguir disponible hasta el final del período ya pagado.' })
    } catch (error) {
      toast.error(`No pudimos programar la baja de ${modulo.nombre}`, { description: error instanceof Error ? error.message : 'Intentá de nuevo.' })
    } finally {
      setProcesandoCodigo(null)
    }
  }

  const reactivarPago = async (modulo: Modulo) => {
    setProcesandoCodigo(modulo.codigo)
    try {
      const resultado = await reactivar(modulo.codigo)
      if (resultado && 'url_pago' in resultado) {
        window.location.assign(resultado.url_pago)
        return
      }
      toast.success(`${modulo.nombre} sigue activo y no se dará de baja`)
    } catch (error) {
      toast.error(`No pudimos reactivar ${modulo.nombre}`, { description: error instanceof Error ? error.message : 'Intentá de nuevo.' })
    } finally {
      setProcesandoCodigo(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-9">
      <header className="mb-9 max-w-2xl">
        <p className="text-sm font-medium text-brand">Personalizá Piru para tu local</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">Módulos</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Activá sólo las herramientas que necesitás. Los módulos incluidos no suman costo; los pagos se agregan a tu suscripción.
        </p>
      </header>

      {vieneDeActivarSuscripcion && (
        <div className="mb-8 flex items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm">
          <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div><p className="font-medium text-foreground">Tu suscripción está en proceso de acreditación.</p><p className="mt-1 text-muted-foreground">Cuando esté activa, podés elegir los módulos que necesitás. Los incluidos son gratis y los pagos se activan sólo si los confirmás.</p></div>
        </div>
      )}

      {cargando && categorias.length === 0 ? <CatalogoSkeleton /> : error && categorias.length === 0 ? (
        <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-6 text-center">
          <p className="font-medium text-foreground">No pudimos cargar tus módulos</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <Button className="mt-4" variant="outline" onClick={() => void cargar(true)}>Reintentar</Button>
        </div>
      ) : (
        <div className="space-y-11">
          {categoriasNormales.map((categoria) => {
            const modulos = categoria.modulos.filter((modulo) => modulo.tipo === 'incluido')
            if (!modulos.length) return null
            return (
              <section key={categoria.id} aria-labelledby={`categoria-${categoria.codigo}`}>
                <div>
                  <h2 id={`categoria-${categoria.codigo}`} className="text-lg font-semibold tracking-tight text-foreground">{categoria.nombre}</h2>
                  {categoria.descripcion && <p className="mt-1 text-sm text-muted-foreground">{categoria.descripcion}</p>}
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {modulos.map((modulo) => (
                    <CardModulo key={modulo.codigo} modulo={modulo}
                      procesando={procesandoCodigo === modulo.codigo}
                      onActivar={() => void activarIncluido(modulo)}
                      onDesactivar={() => void desactivarIncluido(modulo)}
                      onActivarPago={() => undefined}
                      onReactivarPago={() => undefined}
                      onActualizarPago={() => void cargar(true)}
                      onConfigurar={() => configurarModulo(modulo)}
                    />
                  ))}
                </div>
              </section>
            )
          })}

          {pagos.length > 0 && (
            <section aria-labelledby="modulos-pagos" className="rounded-3xl border border-brand/20 bg-brand/[0.035] p-4 sm:p-6">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white"><Sparkles className="h-5 w-5" /></span>
                <div>
                  <h2 id="modulos-pagos" className="text-lg font-semibold tracking-tight text-foreground">Módulos pagos</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Se suman a tu suscripción mensual. Elegís cuáles activar.</p>
                </div>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {pagos.map((modulo) => (
                  <CardModulo key={modulo.codigo} modulo={modulo} pago
                    procesando={procesandoCodigo === modulo.codigo}
                    onActivar={() => undefined}
                    onDesactivar={() => setConfirmandoBaja(modulo)}
                    onActivarPago={() => setModuloPagoSeleccionado(modulo)}
                    onReactivarPago={() => void reactivarPago(modulo)}
                    onActualizarPago={() => void cargar(true)}
                    onConfigurar={() => configurarModulo(modulo)}
                  />
                ))}
              </div>
            </section>
          )}

          {error && <p className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400"><Clock3 className="h-4 w-4" /> Mostramos la última información disponible. {error}</p>}
        </div>
      )}

      <Dialog open={Boolean(moduloPagoSeleccionado)} onOpenChange={(abierto) => !procesandoCodigo && !abierto && setModuloPagoSeleccionado(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Activar {moduloPagoSeleccionado?.nombre}</DialogTitle>
            <DialogDescription>
              Se cobra sólo el período restante hasta tu próxima renovación. Después se suma a tu factura habitual.
            </DialogDescription>
          </DialogHeader>
          {moduloPagoSeleccionado && <div className="rounded-xl bg-muted/60 p-4 text-sm">
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Módulo</span><span>+{fmtARS(moduloPagoSeleccionado.precioMensual)}/mes</span></div>
            <div className="mt-2 flex justify-between gap-4 border-t pt-2 font-medium"><span>Tu total mensual pasa a</span><span>{fmtARS(totalMensualCon(moduloPagoSeleccionado))}/mes</span></div>
          </div>}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" disabled={Boolean(procesandoCodigo)} onClick={() => setModuloPagoSeleccionado(null)}>Cancelar</Button>
            <Button variant="outline" disabled={Boolean(procesandoCodigo)} onClick={() => void enviarLinkPago()}><MessageCircle className="h-4 w-4" />Link por WhatsApp</Button>
            <Button disabled={Boolean(procesandoCodigo)} onClick={() => void iniciarCheckout()}>{procesandoCodigo ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Pagar ahora'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(confirmandoBaja)} onOpenChange={(abierto) => !procesandoCodigo && !abierto && setConfirmandoBaja(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Programar la baja de {confirmandoBaja?.nombre}?</DialogTitle>
            <DialogDescription>No se reintegra el período actual: el módulo seguirá activo hasta la fecha que ya tenés paga.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" disabled={Boolean(procesandoCodigo)} onClick={() => setConfirmandoBaja(null)}>Conservar módulo</Button>
            <Button variant="destructive" disabled={Boolean(procesandoCodigo)} onClick={() => void programarBaja()}>{procesandoCodigo ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Programar baja'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
