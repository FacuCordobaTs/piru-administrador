import { useState } from 'react'
import { useNavigate } from 'react-router'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { AjusteRow } from '../components/AjusteRow'
import { CambiarPasswordDialog } from '../components/CambiarPasswordDialog'

export default function Cuenta() {
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)
  const reset = useRestauranteStore((s) => s.reset)
  const email = useRestauranteStore((s) => s.restaurante?.email)
  const [passwordOpen, setPasswordOpen] = useState(false)

  const cerrarSesion = () => {
    logout()
    reset()
    navigate('/login')
  }

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-lg font-medium text-foreground">Cuenta</h2>
        <p className="text-sm font-normal text-muted-foreground">
          Tu email, contraseña y sesión.
        </p>
      </header>

      <div>
        <AjusteRow
          titulo="Email"
          oracion={email || 'Sin email'}
          estado="configurado"
        />
        <AjusteRow
          titulo="Contraseña"
          oracion="Última actualización desconocida"
          estado="configurado"
          accionLabel="Cambiar"
          onAccion={() => setPasswordOpen(true)}
        />
      </div>

      {/* Zona separada visualmente */}
      <div className="border-t border-border pt-6">
        <Button
          variant="ghost"
          onClick={cerrarSesion}
          className="h-11 min-h-[44px] gap-2 font-medium text-red-600 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </Button>
      </div>

      <CambiarPasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </section>
  )
}
