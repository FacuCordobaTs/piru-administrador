import { Sparkles, Zap } from 'lucide-react'
import { ModuloComercial } from '@/components/ModuloComercial'

/**
 * Lo que ve Retención con el módulo apagado.
 *
 * Sin el módulo no hay nada que navegar —Puntos y motor no tienen contenido
 * propio— así que en vez del switch de mitades se explican las dos capacidades
 * que habilita. Mismo lenguaje que el resto de la sección: sin cajas, sobre la
 * franja `border-y` que ya usan los resúmenes, y con los dos iconos de la
 * tarjeta de entrada (Sparkles ámbar para puntos, Zap naranja para el motor).
 *
 * Sólo cubre el módulo apagado. Las pantallas de cada mitad conservan su propio
 * bloqueo por 403 (`bloqueado`, `bloqueadoPlan`) como respaldo por si el
 * entitlement del frontend quedó viejo.
 */
export function RetencionBloqueada() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-6 py-14">
      <div className="w-full max-w-lg">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          Retención
        </span>
        <h2 className="mt-1.5 text-xl font-bold tracking-tight text-foreground">
          Que tus clientes vuelvan
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Un solo módulo con dos capacidades sobre tu propia base de clientes.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-5 border-y border-border/30 py-5 sm:grid-cols-2">
          <Capacidad
            icono={Sparkles}
            titulo="Club de puntos"
            claseIcono="bg-amber-500/10 text-amber-600 dark:text-amber-400"
            descripcion="Tus clientes suman puntos por lo que compran y los canjean por premios."
          />
          <Capacidad
            icono={Zap}
            titulo="Motor de recompra"
            claseIcono="bg-orange-500/10 text-orange-600 dark:text-orange-400"
            descripcion="Detecta clientes inactivos y les manda campañas para que vuelvan a pedir."
          />
        </div>

        <div className="mt-5">
          <ModuloComercial
            codigo="motor_recompra"
            variante="plana"
            tipo="pago"
            titulo="Retención"
            nombreComercial="Retención"
            descripcion="Se activa desde acá y se factura junto a tu suscripción."
            icono={Sparkles}
          />
        </div>
      </div>
    </div>
  )
}

function Capacidad({
  icono: Icon,
  titulo,
  descripcion,
  claseIcono,
}: {
  icono: React.ElementType
  titulo: string
  descripcion: string
  claseIcono: string
}) {
  return (
    <div className="flex items-start gap-3">
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-2xl ${claseIcono}`}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{titulo}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{descripcion}</p>
      </div>
    </div>
  )
}
