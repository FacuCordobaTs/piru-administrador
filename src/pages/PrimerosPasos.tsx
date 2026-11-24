import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import {
  Check,
  ChevronDown,
  Clock,
  CreditCard,
  ExternalLink,
  Gem,
  MessageCircle,
  Package,
  Palette,
  Store,
  Truck,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useRestauranteStore } from '@/store/restauranteStore'
import { useAuthStore } from '@/store/authStore'
import { nombrePlan, usePlanTienda, usePlanTiendaStore } from '@/store/planTiendaStore'
import type { PasoId } from '@/lib/api'

interface DefinicionPaso {
  titulo: string
  detalle: string
  Icon: LucideIcon
  accion?: { texto: string; ruta: string }
}

/** Textos y destino de cada paso. Qué está hecho lo decide el backend (`lib/primeros-pasos.ts`). */
const PASOS: Record<PasoId, DefinicionPaso> = {
  crear_tienda: {
    titulo: 'Crear tienda',
    detalle: '¡Tu tienda está creada! Dejá todo listo para empezar a vender.',
    Icon: Store,
  },
  productos: {
    titulo: 'Agregar productos',
    detalle: 'Cargá tu carta con categorías, fotos, precios y opciones. Podés importarla desde una foto o un archivo.',
    Icon: Package,
    accion: { texto: 'Agregar', ruta: '/dashboard/productos' },
  },
  whatsapp: {
    titulo: 'WhatsApp para recibir pedidos',
    detalle: 'Cada pedido de tu tienda llega a este número con todo el detalle, listo para confirmar.',
    Icon: MessageCircle,
    accion: { texto: 'Cargar número', ruta: '/dashboard/ajustes/general' },
  },
  horarios: {
    titulo: 'Definir horarios',
    detalle: 'Mientras no cargues tus horarios, la tienda figura cerrada y no toma pedidos.',
    Icon: Clock,
    accion: { texto: 'Cargar horarios', ruta: '/dashboard/ajustes/horarios' },
  },
  entregas: {
    titulo: 'Configurar formas de entrega',
    detalle: 'Retiro en el local con tu dirección, delivery con zonas y precios, o las dos.',
    Icon: Truck,
    accion: { texto: 'Configurar', ruta: '/dashboard/ajustes/entregas' },
  },
  pagos: {
    titulo: 'Configurar medios de pago',
    detalle: 'Conectá Mercado Pago o cargá tu alias para transferencias. El efectivo ya está habilitado.',
    Icon: CreditCard,
    accion: { texto: 'Configurar', ruta: '/dashboard/ajustes/monetizacion' },
  },
  diseno: {
    titulo: 'Personalizar diseño',
    detalle: 'Elegí una plantilla y ajustala con tu logo, tus colores y tus fotos.',
    Icon: Palette,
    accion: { texto: 'Personalizar', ruta: '/dashboard/ajustes/mi-pagina' },
  },
}

export default function PrimerosPasos() {
  const navigate = useNavigate()
  const { plan, pasos } = usePlanTienda()
  const recargar = usePlanTiendaStore((s) => s.cargar)
  const restaurante = useRestauranteStore((s) => s.restaurante) as { baseTienda?: string | null; username?: string | null } | null
  // `undefined` = el dueño todavía no abrió ni cerró nada: se muestra abierto el primer pendiente.
  const [abiertoElegido, setAbierto] = useState<PasoId | null | undefined>(undefined)
  const abierto = abiertoElegido === undefined
    ? pasos?.pasos.find((p) => !p.hecho && !p.opcional)?.id ?? null
    : abiertoElegido

  // Al volver de completar un paso, el checklist tiene que reflejarlo.
  useEffect(() => {
    void recargar(true)
  }, [recargar])

  // Recién creada la cuenta, el perfil puede no haber llegado: la sesión ya trae el link.
  const usernameSesion = useAuthStore((s) => s.restaurante?.username ?? null)
  const username = restaurante?.username ?? usernameSesion
  const urlTienda = restaurante?.baseTienda ?? (username ? `https://my.piru.app/${username}` : null)
  const planActual = plan ? nombrePlan(plan, plan.efectivo) : null

  // Los locales anteriores (Evolución) no tienen primeros pasos: ya estaban armados.
  if (plan?.esLegado) return <Navigate to="/dashboard" replace />

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Primeros pasos</h1>

      {plan && !plan.esLegado && plan.efectivo === 'inicial' && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <Gem className="mt-0.5 size-5 shrink-0 text-emerald-600" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold text-foreground">Estás en el plan Inicial, gratis y sin límite de pedidos.</p>
            <p className="mt-1 text-muted-foreground">Cuando quieras tu propio diseño y más herramientas, mirá los planes.</p>
            <button type="button" onClick={() => navigate('/dashboard/planes')} className="mt-2 font-medium text-foreground underline underline-offset-2">
              Ver planes
            </button>
          </div>
        </div>
      )}

      <div className="mt-8 flex items-baseline justify-between gap-4">
        <p className="text-sm font-medium text-foreground">
          {pasos?.terminado ? '¡Tu tienda está lista para vender!' : 'Chequeá los pasos para dejar tu tienda a tu manera.'}
        </p>
        {pasos && (
          <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
            {pasos.completados} de {pasos.total}
          </p>
        )}
      </div>
      {pasos && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${(pasos.completados / Math.max(1, pasos.total)) * 100}%` }} />
        </div>
      )}

      <div className="mt-5 overflow-hidden rounded-2xl border bg-background">
        {!pasos
          ? Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 border-b px-5 py-4 last:border-b-0">
                <Skeleton className="size-5 rounded-full" />
                <Skeleton className="h-4 w-48" />
              </div>
            ))
          : pasos.pasos.map((paso) => {
              const def = PASOS[paso.id]
              const expandido = abierto === paso.id
              const bloqueadoPorPlan = paso.id === 'diseno' && paso.opcional
              const Icono = def.Icon
              return (
                <div key={paso.id} className="border-b last:border-b-0">
                  <div className="flex items-center gap-3 px-5 py-4">
                    {paso.hecho ? (
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                        <Check className="size-3.5" strokeWidth={3} />
                      </span>
                    ) : (
                      <Icono className="size-5 shrink-0 text-muted-foreground" />
                    )}
                    <button
                      type="button"
                      aria-expanded={expandido}
                      onClick={() => setAbierto(expandido ? null : paso.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <span className={cn('text-sm font-medium', paso.hecho && 'text-muted-foreground line-through')}>{def.titulo}</span>
                      {paso.opcional && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">Opcional</span>}
                    </button>
                    {paso.id === 'crear_tienda' && urlTienda ? (
                      <a href={urlTienda} target="_blank" rel="noreferrer" className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline">
                        Ver tienda <ExternalLink className="size-3.5" />
                      </a>
                    ) : (
                      <button type="button" aria-label={expandido ? 'Cerrar' : 'Abrir'} onClick={() => setAbierto(expandido ? null : paso.id)} className="shrink-0 text-muted-foreground">
                        <ChevronDown className={cn('size-4 transition-transform', expandido && 'rotate-180')} />
                      </button>
                    )}
                  </div>
                  {expandido && paso.id !== 'crear_tienda' && (
                    <div className="px-5 pb-5 pl-[3.25rem]">
                      <p className="text-sm text-muted-foreground">
                        {bloqueadoPorPlan
                          ? `Tu tienda usa el diseño de Piru. Desde el plan ${nombrePlan(plan, 'esencial')} elegís una plantilla y la personalizás con tu marca.`
                          : def.detalle}
                      </p>
                      {bloqueadoPorPlan ? (
                        <Button size="sm" className="mt-3" onClick={() => navigate('/dashboard/planes')}>Ver planes</Button>
                      ) : def.accion ? (
                        <Button size="sm" className="mt-3" variant={paso.hecho ? 'outline' : 'default'} onClick={() => navigate(def.accion!.ruta)}>
                          {paso.hecho ? 'Revisar' : def.accion.texto}
                        </Button>
                      ) : null}
                    </div>
                  )}
                </div>
              )
            })}
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {planActual && <>Plan {planActual} · </>}
        <button type="button" onClick={() => navigate('/dashboard/guia', { state: { volver: '/dashboard/primeros-pasos' } })} className="underline underline-offset-2 hover:text-foreground">
          Cómo funciona el panel
        </button>
      </p>
    </div>
  )
}
