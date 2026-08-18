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
  ChevronRight,
  CircleCheck,
  CircleAlert,
  Truck,
  Armchair,
  ShoppingBag,
  Banknote,
  Landmark,
  Smartphone,
  User,
  Phone,
  MapPin,
  StickyNote,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { getPosConfig, POS_METODOS_ORDER, POS_TIPOS_ORDER, setPosConfig, type PosConfig, type PosMetodoPago, type PosTipo } from '@/lib/posConfig'
import { useModulosStore } from '@/store/modulosStore'
import type { Modulo } from '@/lib/api'

const fmtARS = (monto: string | number) =>
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
  mesas: '/dashboard/mesas',
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
function AccionModulo({
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
    // El POS no navega a una pantalla: abre su propia configuración en esta página.
    const conConfiguracion = RUTAS_CONFIGURACION[modulo.codigo] || modulo.codigo === 'pos'
    return (
      <div className={cn('grid gap-2', conConfiguracion && 'grid-cols-2')}>
        {conConfiguracion ? (
          <Button variant="outline" onClick={onConfigurar}>Configurar</Button>
        ) : null}
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
  onSeleccionar,
}: {
  modulo: Modulo
  onSeleccionar: () => void
}) {
  const requisito = requisitoConfiguracion(modulo)
  const proximamente = modulo.estadoProducto === 'proximamente' || !modulo.activable
  const activo = modulo.estado === 'activo'
  const pagoDisponible = modulo.tipo === 'pago' && !activo && !proximamente

  return (
    <button
      type="button"
      onClick={onSeleccionar}
      className={cn(
        'group flex min-h-[238px] w-full flex-col rounded-3xl p-5 text-left transition-[transform,background-color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 hover:-translate-y-0.5',
        proximamente
          ? 'bg-muted/55 text-muted-foreground hover:bg-muted/75'
          : activo
            ? 'bg-emerald-50/80 dark:bg-emerald-950/30 hover:bg-emerald-100/80 dark:hover:bg-emerald-950/45'
            : pagoDisponible
              ? 'bg-zinc-950 text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800'
              : 'bg-white dark:bg-muted/40 hover:bg-muted/60',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
          proximamente
            ? 'bg-muted-foreground/10 text-muted-foreground'
            : activo
              ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
              : pagoDisponible
                ? 'bg-white/12 text-white'
                : 'bg-brand/10 text-brand',
        )}>
          {(() => {
            const Icon = ICONOS[modulo.codigo] ?? Blocks
            return <Icon className="h-5 w-5" />
          })()}
        </span>
        <ChevronRight className={cn(
          'mt-1 h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5',
          pagoDisponible ? 'text-white/55' : 'text-muted-foreground/55',
        )} />
      </div>
      <div className="mt-4">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h2 className={cn('text-base font-semibold tracking-tight', pagoDisponible ? 'text-white' : 'text-foreground')}>{modulo.nombre}</h2>
          {modulo.tipo === 'pago' && <span className={cn('text-xs font-medium', pagoDisponible ? 'text-white/70' : 'text-brand')}>+{fmtARS(modulo.precioMensual)}/mes</span>}
        </div>
        <p className={cn('mt-1.5 min-h-10 text-sm leading-relaxed', pagoDisponible ? 'text-white/65' : 'text-muted-foreground')}>
          {modulo.descripcion || 'Sumá esta capacidad a la operación de tu local.'}
        </p>
      </div>
      <div className="mt-auto pt-5">
        {activo ? (
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
            <CircleCheck className="h-4 w-4" />
            <span>{requisito ? 'Activo · falta configurar' : 'Listo para usar'}</span>
          </div>
        ) : proximamente ? (
          <p className="text-sm font-medium text-muted-foreground">En preparación</p>
        ) : (
          <p className={cn('text-sm font-medium', pagoDisponible ? 'text-white/85' : 'text-muted-foreground')}>Ver detalles</p>
        )}
      </div>
    </button>
  )
}

const TIPOS_POS: Array<{ id: PosTipo; label: string; icon: typeof Truck }> = [
  { id: 'delivery', label: 'Delivery', icon: Truck },
  { id: 'mesa', label: 'Mesa', icon: Armchair },
  { id: 'takeaway', label: 'Takeaway', icon: ShoppingBag },
]

const METODOS_POS: Array<{ id: PosMetodoPago; label: string; icon: typeof Banknote }> = [
  { id: 'cash', label: 'Efectivo', icon: Banknote },
  { id: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
  { id: 'manual_transfer', label: 'Transferencia', icon: Landmark },
  { id: 'mercadopago', label: 'Mercado Pago', icon: Smartphone },
]

function FilaConfig({
  icon: Icon,
  label,
  descripcion,
  checked,
  disabled,
  onCheckedChange,
}: {
  icon: typeof Truck
  label: string
  descripcion?: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3 rounded-2xl border p-3.5', checked ? 'border-border' : 'border-border/60 bg-muted/30', disabled && 'opacity-60')}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {descripcion && <p className="mt-0.5 text-xs text-muted-foreground">{descripcion}</p>}
        </div>
      </div>
      <Switch size="sm" checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  )
}

/**
 * Configuración del punto de venta. Se guarda sólo en localStorage (este
 * dispositivo): el backend no participa y el POS lee esta misma información
 * para decidir qué componentes mostrar.
 */
function PosConfigForm({ onSaved }: { onSaved: () => void }) {
  const [config, setConfig] = useState<PosConfig>(getPosConfig)

  const toggleTipo = (tipo: PosTipo) => {
    setConfig((prev) => {
      const quedan = POS_TIPOS_ORDER.some((t) => t !== tipo && prev.tipos[t])
      if (prev.tipos[tipo] && !quedan) {
        toast.error('Dejá al menos un tipo de pedido activo')
        return prev
      }
      const activo = !prev.tipos[tipo]
      return {
        ...prev,
        tipos: { ...prev.tipos, [tipo]: activo },
        camposCliente: {
          ...prev.camposCliente,
          // Sin delivery la dirección queda sin sentido y se desactiva.
          direccion: tipo === 'delivery' && !activo ? false : prev.camposCliente.direccion,
        },
      }
    })
  }

  const toggleMetodoPago = (id: PosMetodoPago) => {
    setConfig((prev) => {
      const quedan = POS_METODOS_ORDER.some((m) => m !== id && prev.metodosPago[m])
      if (prev.metodosPago[id] && !quedan) {
        toast.error('Dejá al menos un método de pago activo')
        return prev
      }
      return { ...prev, metodosPago: { ...prev.metodosPago, [id]: !prev.metodosPago[id] } }
    })
  }

  const toggleCampo = (campo: keyof PosConfig['camposCliente']) => {
    setConfig((prev) => ({ ...prev, camposCliente: { ...prev.camposCliente, [campo]: !prev.camposCliente[campo] } }))
  }

  const guardar = () => {
    setPosConfig(config)
    toast.success('Configuración del punto de venta guardada')
    onSaved()
  }

  return (
    <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tipos de pedido</p>
        <div className="mt-2 space-y-2">
          {TIPOS_POS.map((t) => (
            <FilaConfig key={t.id} icon={t.icon} label={t.label} checked={config.tipos[t.id]} onCheckedChange={() => toggleTipo(t.id)} />
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Métodos de pago</p>
        <div className="mt-2 space-y-2">
          {METODOS_POS.map((m) => (
            <FilaConfig key={m.id} icon={m.icon} label={m.label} checked={config.metodosPago[m.id]} onCheckedChange={() => toggleMetodoPago(m.id)} />
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Datos del cliente</p>
        <div className="mt-2 space-y-2">
          <FilaConfig icon={User} label="Nombre" checked={config.camposCliente.nombre} onCheckedChange={() => toggleCampo('nombre')} />
          <FilaConfig icon={Phone} label="Celular" checked={config.camposCliente.telefono} onCheckedChange={() => toggleCampo('telefono')} />
          <FilaConfig
            icon={MapPin}
            label="Dirección"
            descripcion="Requiere el tipo de pedido Delivery"
            checked={config.camposCliente.direccion}
            disabled={!config.tipos.delivery}
            onCheckedChange={() => toggleCampo('direccion')}
          />
        </div>
      </div>
      <FilaConfig icon={StickyNote} label="Nota" checked={config.notas} onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, notas: checked }))} />
      <DialogFooter className="gap-2 sm:gap-2">
        <Button variant="outline" onClick={onSaved}>Cancelar</Button>
        <Button onClick={guardar}>Guardar</Button>
      </DialogFooter>
    </div>
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
  const [moduloSeleccionado, setModuloSeleccionado] = useState<Modulo | null>(null)
  const [moduloPagoSeleccionado, setModuloPagoSeleccionado] = useState<Modulo | null>(null)
  const [confirmandoBaja, setConfirmandoBaja] = useState<Modulo | null>(null)
  const [configurandoPos, setConfigurandoPos] = useState(false)
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
    if (modulo.codigo === 'pos') {
      setConfigurandoPos(true)
      return
    }
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
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
      <header className="mx-auto mb-12 max-w-2xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">Módulos</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
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
                    <CardModulo key={modulo.codigo} modulo={modulo} onSeleccionar={() => setModuloSeleccionado(modulo)} />
                  ))}
                </div>
              </section>
            )
          })}

          {pagos.length > 0 && (
            <section aria-labelledby="modulos-pagos">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950"><Sparkles className="h-5 w-5" /></span>
                <div>
                  <h2 id="modulos-pagos" className="text-lg font-semibold tracking-tight text-foreground">Módulos pagos</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Se suman a tu suscripción mensual. Elegís cuáles activar.</p>
                </div>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {pagos.map((modulo) => (
                  <CardModulo key={modulo.codigo} modulo={modulo} onSeleccionar={() => setModuloSeleccionado(modulo)} />
                ))}
              </div>
            </section>
          )}

          {error && <p className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400"><Clock3 className="h-4 w-4" /> Mostramos la última información disponible. {error}</p>}
        </div>
      )}

      <Sheet open={Boolean(moduloSeleccionado)} onOpenChange={(abierto) => !abierto && setModuloSeleccionado(null)}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
          {moduloSeleccionado && (() => {
            const requisito = requisitoConfiguracion(moduloSeleccionado)
            const configuracion = requisito ?? (moduloSeleccionado.codigo === 'pos'
              ? 'Podés elegir qué datos y opciones se muestran al anotar un pedido.'
              : RUTAS_CONFIGURACION[moduloSeleccionado.codigo]
                ? 'Podés dejar este módulo listo desde su pantalla de configuración.'
                : null)
            const proximamente = moduloSeleccionado.estadoProducto === 'proximamente' || !moduloSeleccionado.activable
            const activo = moduloSeleccionado.estado === 'activo'
            const estadoTexto = proximamente
              ? 'Este módulo está en preparación'
              : activo
                ? requisito ? 'Está activo y necesita una configuración final' : 'Está activo y listo para usar'
                : moduloSeleccionado.estado === 'cancelacion_programada'
                  ? 'La baja está programada al finalizar el período'
                  : moduloSeleccionado.estado === 'pendiente_pago'
                    ? 'Estamos esperando la acreditación del pago'
                    : moduloSeleccionado.estado === 'suspendido'
                      ? 'Este módulo está suspendido'
                      : 'Todavía no está activo'

            return <>
              <SheetHeader className="border-b px-6 py-6 pr-12 text-left">
                <div className="flex items-center gap-3">
                  <span className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
                    proximamente ? 'bg-muted text-muted-foreground' : activo ? 'bg-emerald-600 text-white' : moduloSeleccionado.tipo === 'pago' ? 'bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950' : 'bg-brand/10 text-brand',
                  )}>
                    {(() => { const Icon = ICONOS[moduloSeleccionado.codigo] ?? Blocks; return <Icon className="h-5 w-5" /> })()}
                  </span>
                  <div>
                    <SheetTitle className="text-xl font-semibold tracking-tight">{moduloSeleccionado.nombre}</SheetTitle>
                    {moduloSeleccionado.tipo === 'pago' && <p className="mt-0.5 text-sm font-medium text-muted-foreground">+{fmtARS(moduloSeleccionado.precioMensual)}/mes</p>}
                  </div>
                </div>
                <SheetDescription className="pt-3 text-sm leading-relaxed">
                  {moduloSeleccionado.descripcion || 'Sumá esta capacidad a la operación de tu local.'}
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
                <div className={cn(
                  'rounded-2xl p-4',
                  proximamente ? 'bg-muted/70' : activo ? 'bg-emerald-50 dark:bg-emerald-950/25' : 'bg-muted/55',
                )}>
                  <div className="flex items-start gap-3">
                    {activo ? <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />}
                    <div>
                      <p className="text-sm font-medium text-foreground">{estadoTexto}</p>
                    </div>
                  </div>
                </div>

                {configuracion && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Configuración</p>
                    <div className="flex gap-3 rounded-2xl bg-muted/55 p-4">
                      <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <p className="text-sm leading-relaxed text-muted-foreground">{configuracion}</p>
                    </div>
                  </div>
                )}

                {moduloSeleccionado.tipo === 'pago' && !proximamente && moduloSeleccionado.estado === 'inactivo' && (
                  <div className="rounded-2xl bg-muted/55 p-4 text-sm text-muted-foreground">
                    El primer cargo se prorratea hasta tu próxima renovación. Luego se integra a tu factura mensual.
                  </div>
                )}
              </div>

              <SheetFooter className="border-t px-6 py-5">
                <AccionModulo
                  modulo={moduloSeleccionado}
                  procesando={procesandoCodigo === moduloSeleccionado.codigo}
                  onActivar={() => void activarIncluido(moduloSeleccionado)}
                  onDesactivar={() => moduloSeleccionado.tipo === 'pago' ? setConfirmandoBaja(moduloSeleccionado) : void desactivarIncluido(moduloSeleccionado)}
                  onActivarPago={() => setModuloPagoSeleccionado(moduloSeleccionado)}
                  onReactivarPago={() => void reactivarPago(moduloSeleccionado)}
                  onActualizarPago={() => void cargar(true)}
                  onConfigurar={() => configurarModulo(moduloSeleccionado)}
                />
              </SheetFooter>
            </>
          })()}
        </SheetContent>
      </Sheet>

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

      <Dialog open={configurandoPos} onOpenChange={(abierto) => !abierto && setConfigurandoPos(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar punto de venta</DialogTitle>
            <DialogDescription>
              Elegí qué datos y opciones se cargan al anotar un pedido. La configuración se guarda en este dispositivo.
            </DialogDescription>
          </DialogHeader>
          {configurandoPos && <PosConfigForm onSaved={() => setConfigurandoPos(false)} />}
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
