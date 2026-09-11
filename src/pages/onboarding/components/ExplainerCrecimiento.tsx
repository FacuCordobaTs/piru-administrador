import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ExplainerCrecimientoProps {
  onContinue: () => void
}

export function ExplainerCrecimiento({ onContinue }: ExplainerCrecimientoProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 text-center py-4 space-y-8">
      {/* Encabezado limpio estilo Apple */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#FF7A00]">
          Paso 4 · El Sistema Completo
        </p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
          El Sistema de Crecimiento
        </h1>
        <p className="text-[15px] text-muted-foreground max-w-sm mx-auto leading-relaxed">
          Tener tu tienda es solo el punto de partida. Piru activa cuatro momentos coordinados para convertir cada pedido en un cliente habitual.
        </p>
      </div>

      {/* Lista flotante de los 4 pilares sin cajas */}
      <div className="max-w-sm mx-auto text-left space-y-4 py-3 border-y border-zinc-200/50 dark:border-zinc-800/50">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            01 <span className="text-foreground font-bold">· Adquisición</span>
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Seguimiento de links para saber cuál es el marketing que realmente le funciona exactamente a tu negocio.
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            02 <span className="text-foreground font-bold">· Activación</span>
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Compra rápida desde el celular sin descargar aplicaciones ni crear contraseñas.
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            03 <span className="text-foreground font-bold">· Monetización</span>
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            0% de comisiones y cobro directo acreditado en tu cuenta bancaria o Mercado Pago.
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            04 <span className="text-foreground font-bold">· Retención</span>
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Recompra automática calculando la cadencia de cada comensal con su plato favorito.
          </p>
        </div>

        <div className="pt-3 border-t border-zinc-200/40 dark:border-zinc-800/40 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#FF7A00]">
            Loop Viral · Pedido en Grupo
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            1 solo pedido a cocina, pero 4 o 5 comensales nuevos que dejan su número de WhatsApp para volver a invitarlos.
          </p>
        </div>
      </div>

      <Button
        onClick={onContinue}
        className="w-full h-14 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white active:scale-[0.985] transition-all"
      >
        Continuar <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  )
}
