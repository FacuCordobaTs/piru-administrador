import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { restauranteApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

export type FranjaHorario = {
  id: number
  nombre: string
  horaInicio: string
  horaFin: string
  activo: boolean
}

interface FranjaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Franja a editar; null = crear nueva. */
  editando: FranjaHorario | null
  onSaved: () => void
}

const vacio = { nombre: '', horaInicio: '09:00', horaFin: '18:00', activo: true }

/** Crear/editar franja de horario. Transaccional: conserva Guardar/Cancelar. */
export function FranjaDialog({ open, onOpenChange, editando, onSaved }: FranjaDialogProps) {
  const [form, setForm] = useState(vacio)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(
        editando
          ? {
              nombre: editando.nombre,
              horaInicio: editando.horaInicio,
              horaFin: editando.horaFin,
              activo: editando.activo,
            }
          : vacio
      )
    }
  }, [open, editando])

  const guardar = async () => {
    const token = useAuthStore.getState().token
    if (!token) return
    if (!form.nombre.trim()) {
      toast.error('Ingresá un nombre para la franja')
      return
    }
    setGuardando(true)
    try {
      const res = (editando
        ? await restauranteApi.updateFranjaHorario(token, editando.id, form)
        : await restauranteApi.createFranjaHorario(token, form)) as { success: boolean }
      if (res.success) {
        onOpenChange(false)
        onSaved()
      }
    } catch {
      toast.error('Error al guardar la franja')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">
            {editando ? 'Editar franja' : 'Nueva franja'}
          </DialogTitle>
          <DialogDescription className="font-normal">
            Nombre y rango de horas para esta franja.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="font-medium">Nombre</Label>
            <Input
              placeholder="Ej: almuerzo, cena…"
              className="h-11"
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="font-medium">Hora inicio</Label>
              <Input
                type="time"
                className="h-11"
                value={form.horaInicio}
                onChange={(e) => setForm((f) => ({ ...f, horaInicio: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-medium">Hora fin</Label>
              <Input
                type="time"
                className="h-11"
                value={form.horaFin}
                onChange={(e) => setForm((f) => ({ ...f, horaFin: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <Switch
              checked={form.activo}
              onCheckedChange={(v) => setForm((f) => ({ ...f, activo: v }))}
            />
            <Label className="font-normal">Franja activa</Label>
          </div>
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={guardando}
            className="h-11 min-h-[44px] font-medium"
          >
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando} className="h-11 min-h-[44px] font-medium">
            {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
