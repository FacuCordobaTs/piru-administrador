import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { LayoutGrid, Store } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SucursalListRow {
  id: number
  nombre: string
  activo: boolean
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sucursalesActivas: SucursalListRow[]
  onSelect: (id: number | null, nombreEtiqueta: string) => void
  /** Si true, no se cierra al clic fuera ni Escape (solo eligiendo opción) */
  requireChoice?: boolean
}

export function SucursalSelector({
  open,
  onOpenChange,
  sucursalesActivas,
  onSelect,
  requireChoice = false,
}: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (requireChoice && !next) return
        onOpenChange(next)
      }}
    >
      <DialogContent
        className="max-w-[380px] rounded-[28px] border-border bg-background p-6 sm:p-8 shadow-xl"
        onPointerDownOutside={(e) => {
          if (requireChoice) e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {
          if (requireChoice) e.preventDefault()
        }}
      >
        <DialogHeader className="text-left space-y-2">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FF7A00]/10 sm:mx-0 sm:inline-flex">
            <Store className="h-7 w-7 text-[#FF7A00]" />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight text-center sm:text-left">
            ¿Cuál es tu sucursal?
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground text-center sm:text-left">
            Elegí dónde estás operando para ver solo esos pedidos, o todas si sos el dueño.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 flex flex-col gap-2.5">
          {sucursalesActivas.map((s) => (
            <Button
              key={s.id}
              type="button"
              variant="outline"
              className={cn(
                'h-12 w-full justify-start rounded-xl border-border font-semibold text-foreground',
                'hover:bg-[#FF7A00]/10 hover:text-foreground hover:border-[#FF7A00]/30',
              )}
              onClick={() => onSelect(s.id, s.nombre)}
            >
              <Store className="mr-2 h-4 w-4 shrink-0 text-[#FF7A00]" />
              <span className="truncate">{s.nombre}</span>
            </Button>
          ))}

          <Button
            type="button"
            variant="outline"
            className={cn(
              'h-12 w-full justify-start rounded-xl border-dashed border-border font-semibold',
              'hover:bg-muted/60',
            )}
            onClick={() => onSelect(null, '')}
          >
            <LayoutGrid className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            Ver todas (dueño)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
