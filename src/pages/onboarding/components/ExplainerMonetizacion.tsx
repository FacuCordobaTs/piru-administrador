import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ExplainerMonetizacionProps {
  onContinue: () => void
}

export function ExplainerMonetizacion({ onContinue }: ExplainerMonetizacionProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 text-center py-4 space-y-8">
      {/* Encabezado limpio estilo Apple */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#FF7A00]">
          Paso 3 · Monetización directa
        </p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
          Cobro directo a tu cuenta
        </h1>
        <p className="text-[15px] text-muted-foreground max-w-sm mx-auto leading-relaxed">
          Piru nunca retiene tu dinero. Cada venta va directo a tu cuenta bancaria o Mercado Pago con acreditación inmediata.
        </p>
      </div>

      {/* Números flotantes estilo keynote */}
      <div className="flex items-center justify-center gap-8 max-w-xs mx-auto py-3">
        <div className="space-y-1">
          <p className="text-3xl font-light tracking-tight text-foreground">100%</p>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">A tu cuenta</p>
        </div>
        <div className="h-8 w-px bg-zinc-200/60 dark:border-zinc-800/60" />
        <div className="space-y-1">
          <p className="text-3xl font-light tracking-tight text-[#FF7A00]">0%</p>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Comisión Piru</p>
        </div>
        <div className="h-8 w-px bg-zinc-200/60 dark:border-zinc-800/60" />
        <div className="space-y-1">
          <p className="text-3xl font-light tracking-tight text-foreground">En vivo</p>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Acreditación</p>
        </div>
      </div>

      {/* Detalles flotantes */}
      <div className="max-w-sm mx-auto text-left py-3 border-y border-zinc-200/50 dark:border-zinc-800/50 text-xs text-muted-foreground leading-relaxed">
        <p>
          <span className="font-semibold text-foreground">Validación de cobertura:</span> El mapa calcula en milisegundos si la dirección del cliente entra en tu reparto y suma el costo de envío exacto. Cero pedidos fuera de zona.
        </p>
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
