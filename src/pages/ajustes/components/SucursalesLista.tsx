import { useCallback, useState } from 'react'
import { Edit, Plus, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SucursalDialog } from './SucursalDialog'
import type { Sucursal } from '../hooks/useSucursales'

export function SucursalesLista({
  sucursales,
  onChanged,
  rapiboyActivo = false,
  soloPos = false,
}: {
  sucursales: Sucursal[]
  onChanged: () => void
  rapiboyActivo?: boolean
  soloPos?: boolean
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<Sucursal | null>(null)

  const abrir = useCallback((s: Sucursal | null) => {
    setEditando(s)
    setDialogOpen(true)
  }, [])

  return (
    <div className="space-y-4">
      <Button
        variant="outline"
        onClick={() => abrir(null)}
        className="h-11 min-h-[44px] w-full font-medium"
      >
        <Plus className="mr-2 h-4 w-4" /> {soloPos ? 'Nuevo evento' : 'Nueva sucursal'}
      </Button>
      <div className="divide-y divide-border">
        {sucursales.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-3 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <Store className={cn('h-5 w-5 shrink-0', s.activo ? 'text-brand' : 'text-muted-foreground')} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {s.nombre}
                  {!s.activo && <span className="font-normal text-muted-foreground"> · inactiva</span>}
                </p>
                {s.direccion && (
                  <p className="truncate text-xs font-normal text-muted-foreground">{s.direccion}</p>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => abrir(s)}>
              <Edit className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <SucursalDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editando={editando}
        onSaved={onChanged}
        rapiboyActivo={rapiboyActivo}
        crearSoloPos={soloPos}
      />
    </div>
  )
}
