import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ExplainerActivacionProps {
  onContinue: () => void
}

export function ExplainerActivacion({ onContinue }: ExplainerActivacionProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 text-center py-4 space-y-8">
      {/* Encabezado limpio estilo Apple */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#FF7A00]">
          Paso 2 · Activación sin fricción
        </p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
          Una carta pensada para no perder ventas
        </h1>
        <p className="text-[15px] text-muted-foreground max-w-sm mx-auto leading-relaxed">
          Si un cliente tarda más de 90 segundos o tiene que recordar una contraseña antes de ver la comida, el pedido se cae. En Piru, compra directo desde el navegador.
        </p>
      </div>

      {/* 3 pilares flotantes de la carta */}
      <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto text-center text-xs py-3 border-y border-zinc-200/50 dark:border-zinc-800/50">
        <div className="space-y-1">
          <p className="font-semibold text-foreground">Fotos claras</p>
          <p className="text-[11.5px] text-muted-foreground leading-tight">Sin textos confusos</p>
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-foreground">Variantes</p>
          <p className="text-[11.5px] text-muted-foreground leading-tight">Tamaño o cocción</p>
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-foreground">Extras</p>
          <p className="text-[11.5px] text-muted-foreground leading-tight">Suman al ticket</p>
        </div>
      </div>

      <Button
        onClick={onContinue}
        className="w-full h-14 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white active:scale-[0.985] transition-all"
      >
        Cargar mi carta <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  )
}
