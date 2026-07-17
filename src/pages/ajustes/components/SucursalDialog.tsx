import { useEffect, useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useAuthStore } from '@/store/authStore'
import type { Sucursal } from '../hooks/useSucursales'

interface SucursalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Sucursal a editar; null = crear nueva. */
  editando: Sucursal | null
  onSaved: () => void
}

const vacio = {
  nombre: '',
  direccion: '',
  whatsappEnabled: false,
  whatsappNumber: '',
  rapiboyToken: '',
  activo: true,
}

const apiBase = () => import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

/** Crear/editar sucursal. Transaccional: conserva Guardar/Cancelar. */
export function SucursalDialog({ open, onOpenChange, editando, onSaved }: SucursalDialogProps) {
  const [form, setForm] = useState(vacio)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(
      editando
        ? {
            nombre: editando.nombre,
            direccion: editando.direccion || '',
            whatsappEnabled: editando.whatsappEnabled,
            whatsappNumber: editando.whatsappNumber || '',
            rapiboyToken: editando.rapiboyToken || '',
            activo: editando.activo,
          }
        : vacio
    )
  }, [open, editando])

  const authHeaders = () => {
    const token = useAuthStore.getState().token
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  }

  const guardar = async () => {
    if (!form.nombre.trim()) {
      toast.error('El nombre es requerido')
      return
    }
    setGuardando(true)
    try {
      const body = {
        ...form,
        direccion: form.direccion || null,
        whatsappNumber: form.whatsappNumber || null,
        rapiboyToken: form.rapiboyToken || null,
      }
      const url = editando ? `${apiBase()}/sucursales/${editando.id}` : `${apiBase()}/sucursales/create`
      const res = await fetch(url, {
        method: editando ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        onOpenChange(false)
        onSaved()
      } else {
        toast.error(data.message || 'Error al guardar')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async () => {
    if (!editando) return
    setGuardando(true)
    try {
      const res = await fetch(`${apiBase()}/sucursales/${editando.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      const data = await res.json()
      if (data.success) {
        onOpenChange(false)
        onSaved()
      } else {
        toast.error(data.message || 'Error al eliminar')
      }
    } catch {
      toast.error('Error al eliminar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">
            {editando ? 'Editar sucursal' : 'Nueva sucursal'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="font-medium">Nombre</Label>
            <Input
              value={form.nombre}
              onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
              placeholder="Ej: Sucursal Centro"
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="font-medium">Dirección</Label>
            <Input
              value={form.direccion}
              onChange={(e) => setForm((p) => ({ ...p, direccion: e.target.value }))}
              placeholder="Ej: San Martín 123"
              className="h-11"
            />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">WhatsApp propio</p>
              <p className="text-xs font-normal text-muted-foreground">
                Esta sucursal recibe sus pedidos por WhatsApp propio.
              </p>
            </div>
            <Switch
              checked={form.whatsappEnabled}
              onCheckedChange={(v) => setForm((p) => ({ ...p, whatsappEnabled: v }))}
            />
          </div>
          {form.whatsappEnabled && (
            <div className="space-y-1.5 duration-150 animate-in fade-in slide-in-from-top-1">
              <Label className="font-medium">Número de WhatsApp</Label>
              <Input
                value={form.whatsappNumber}
                onChange={(e) => setForm((p) => ({ ...p, whatsappNumber: e.target.value }))}
                placeholder="5491123456789"
                className="h-11"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="font-medium">
              Token Rapiboy <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              type="password"
              value={form.rapiboyToken}
              onChange={(e) => setForm((p) => ({ ...p, rapiboyToken: e.target.value }))}
              placeholder="Si esta sucursal usa Rapiboy propio"
              className="h-11"
            />
          </div>
          {editando && (
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Sucursal activa</p>
                <p className="text-xs font-normal text-muted-foreground">
                  Las inactivas no reciben pedidos.
                </p>
              </div>
              <Switch
                checked={form.activo}
                onCheckedChange={(v) => setForm((p) => ({ ...p, activo: v }))}
              />
            </div>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          {editando ? (
            <Button
              variant="ghost"
              onClick={eliminar}
              disabled={guardando}
              className="h-11 min-h-[44px] font-medium text-red-600 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Desactivar
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
