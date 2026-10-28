import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/settings-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authApi, ApiError } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'

interface CambiarEmailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * El email es la credencial de login del local, así que igual que la contraseña
 * conserva sus botones Guardar/Cancelar (excepción al autosave).
 */
export function CambiarEmailDialog({ open, onOpenChange }: CambiarEmailDialogProps) {
  const token = useAuthStore((s) => s.token)
  const emailActual = useRestauranteStore((s) => s.restaurante?.email)
  const setLocal = useRestauranteStore((s) => s.setLocal)
  const [email, setEmail] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (open) setEmail(emailActual ?? '')
  }, [open, emailActual])

  const cerrar = (o: boolean) => {
    onOpenChange(o)
    if (!o) setEmail(emailActual ?? '')
  }

  const guardar = async () => {
    if (!token) return
    const normalizado = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizado)) {
      toast.error('Ingresá un email válido')
      return
    }
    setGuardando(true)
    try {
      const res = await authApi.changeEmail(token, normalizado)
      if (res.success) {
        setLocal({ email: res.email })
        const auth = useAuthStore.getState().restaurante
        if (auth) useAuthStore.getState().updateRestaurante({ ...auth, email: res.email })
        toast.success('Email actualizado')
        cerrar(false)
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Error al cambiar el email')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={cerrar}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">Cambiar email</DialogTitle>
          <DialogDescription className="font-normal">
            Es el email con el que iniciás sesión en el panel.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label className="font-medium">Email</Label>
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="vos@tulocal.com"
            className="h-11"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') guardar()
            }}
          />
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
          <Button onClick={guardar} disabled={guardando} className="h-11 min-h-[44px] font-medium">
            {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar email
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
