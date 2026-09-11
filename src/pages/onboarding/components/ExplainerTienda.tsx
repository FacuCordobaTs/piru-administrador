import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ExplainerTiendaProps {
  slug: string
  onContinue: () => void
}

export function ExplainerTienda({ slug, onContinue }: ExplainerTiendaProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 text-center py-4 space-y-8">
      {/* Encabezado limpio estilo Apple */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#FF7A00]">
          Paso 1 · Tu tienda propia
        </p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
          Un canal directo para tu local
        </h1>
        <p className="text-[15px] text-muted-foreground max-w-sm mx-auto leading-relaxed">
          El punto de partida es tener una tienda online propia: que cargue al instante, tenga buena presentación y en la que tu cliente compre en 60 segundos.
        </p>
      </div>

      {/* Dirección flotante */}
      <div className="py-2">
        <span className="font-mono text-base text-foreground font-medium tracking-tight">
          <span className="text-muted-foreground/50">piru.app/</span>
          <span className="text-[#FF7A00]">{slug}</span>
        </span>
      </div>
      {/* Microflujo flotante */}
      <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground py-2.5 border-y border-zinc-200/50 dark:border-zinc-800/50 max-w-sm mx-auto">
        <span>Toca tu link</span>
        <span className="text-muted-foreground/30">→</span>
        <span>Menú en 1 segundo</span>
        <span className="text-muted-foreground/30">→</span>
        <span className="text-foreground font-medium">Pide en 60s</span>
      </div>

      <Button
        onClick={onContinue}
        className="w-full h-14 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white active:scale-[0.985] transition-all"
      >
        Comenzar <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  )
}
