import { useState } from 'react'
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
import { authApi, ApiError } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

interface CambiarPasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const vacio = { currentPassword: '', newPassword: '', confirmPassword: '' }

/**
 * Cambio de contraseña: es transaccional, así que conserva sus botones
 * Guardar/Cancelar (excepción al autosave). Movido desde Perfil.tsx.
 */
export function CambiarPasswordDialog({ open, onOpenChange }: CambiarPasswordDialogProps) {
  const token = useAuthStore((s) => s.token)
  const [form, setForm] = useState(vacio)
  const [guardando, setGuardando] = useState(false)

  const cerrar = (o: boolean) => {
    onOpenChange(o)
    if (!o) setForm(vacio)
  }

  const cambiar = async () => {
    if (!token) return
    if (!form.currentPassword || !form.newPassword) {
      toast.error('Completá todos los campos')
      return
    }
    if (form.newPassword !== form.confirmPassword) {
      toast.error('Las contraseñas nuevas no coinciden')
      return
    }
    if (form.newPassword.length < 6) {
      toast.error('La nueva contraseña debe tener al menos 6 caracteres')
      return
    }
    setGuardando(true)
    try {
      const res = (await authApi.changePassword(
        token,
        form.currentPassword,
        form.newPassword
      )) as { success: boolean }
      if (res.success) {
        toast.success('Contraseña actualizada')
        cerrar(false)
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Error al cambiar la contraseña')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={cerrar}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">Cambiar contraseña</DialogTitle>
          <DialogDescription className="font-normal">
            Ingresá tu contraseña actual y la nueva para actualizarla.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="font-medium">Contraseña actual</Label>
            <Input
              type="password"
              placeholder="••••••••"
              className="h-11"
              value={form.currentPassword}
              onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="font-medium">Nueva contraseña</Label>
            <Input
              type="password"
              placeholder="••••••••"
              className="h-11"
              value={form.newPassword}
              onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="font-medium">Confirmar nueva contraseña</Label>
            <Input
              type="password"
              placeholder="••••••••"
              className="h-11"
              value={form.confirmPassword}
              onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') cambiar()
              }}
            />
          </div>
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => cerrar(false)}
            disabled={guardando}
            className="h-11 min-h-[44px] font-medium"
          >
            Cancelar
          </Button>
          <Button onClick={cambiar} disabled={guardando} className="h-11 min-h-[44px] font-medium">
            {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Cambiar contraseña
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
