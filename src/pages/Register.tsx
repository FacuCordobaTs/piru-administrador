import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/store/authStore'
import { authApi, ApiError } from '@/lib/api'
import { toast } from 'sonner'
import { CheckCircle2 } from 'lucide-react'

const Register = () => {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Apply system theme preference on mount
  useEffect(() => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden')
      return
    }

    if (password.length < 3) {
      toast.error('La contraseña debe tener al menos 3 caracteres')
      return
    }

    setIsLoading(true)

    try {
      const response = await authApi.register(email, password, nombre)

      if (
        typeof response === 'object' &&
        response !== null &&
        'token' in response &&
        'newRestaurante' in response
      ) {
        const { token, newRestaurante, message } = response as { token: string; newRestaurante: any; message?: string };
        setAuth(token, newRestaurante[0])
        toast.success('¡Cuenta creada!', {
          description: message || 'Bienvenido a Piru',
        })
        navigate('/onboarding') // Redirigiremos al onboarding
      } else {
        toast.error('Error en la respuesta del servidor')
      }
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error('Error al registrarse', {
          description: error.message,
        })
      } else {
        toast.error('Error de conexión', {
          description: 'No se pudo conectar con el servidor',
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex w-full bg-background selection:bg-primary/20">

      {/* Panel Izquierdo - Branding & Valor (Oculto en móviles) */}
      <div className="hidden lg:flex w-1/2 bg-zinc-950 text-white flex-col justify-between p-12 relative overflow-hidden">
        {/* Efecto de fondo sutil */}
        <div className="absolute top-0 left-0 w-full h-full bg-linear-to-br from-[#FF7A00]/10 to-transparent pointer-events-none" />

        <div className="relative z-10">
          <img src="/logopiru.jpeg" alt="Piru Logo" className="h-12 w-auto mb-16" />

          <h1 className="text-4xl xl:text-5xl font-bold mb-6 leading-tight">
            Tu tienda de Delivery,<br />
            en el link de tu bio.
          </h1>

          <p className="text-lg text-zinc-400 mb-10 max-w-md leading-relaxed">
            Piru es la forma más simple de recibir pedidos. Sin aplicaciones pesadas. Tus clientes piden desde su celular, pagan online y vos recibís todo directo en tu cocina y por WhatsApp.
          </p>

          <ul className="space-y-5">
            <li className="flex items-center text-zinc-300 text-lg">
              <CheckCircle2 className="mr-4 h-6 w-6 text-[#FF7A00]" />
              Link único para tu Instagram
            </li>
            <li className="flex items-center text-zinc-300 text-lg">
              <CheckCircle2 className="mr-4 h-6 w-6 text-[#FF7A00]" />
              Pagos automáticos (MP, Cucuru, Talo)
            </li>
            <li className="flex items-center text-zinc-300 text-lg">
              <CheckCircle2 className="mr-4 h-6 w-6 text-[#FF7A00]" />
              Avisos por WhatsApp al instante
            </li>
          </ul>
        </div>

        <div className="relative z-10 text-sm text-zinc-500 font-medium">
          © {new Date().getFullYear()} Piru.app — Simple. Rápido. Rentable.
        </div>
      </div>

      {/* Panel Derecho - Formulario de Registro */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 animate-in fade-in duration-700">
        <div className="w-full max-w-md space-y-8">

          {/* Header Móvil */}
          <div className="text-center lg:text-left">
            <img src="/logopiru.jpeg" alt="Piru" className="h-12 w-auto mx-auto lg:hidden mb-8" />
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Crear tu tienda</h2>
            <p className="text-muted-foreground mt-2 text-lg">Ingresa los datos de tu local para empezar.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2.5">
              <Label htmlFor="nombre" className="text-sm font-medium">Nombre del local</Label>
              <Input
                id="nombre"
                type="text"
                placeholder="Ej: Burger Brothers"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                minLength={3}
                className="h-12 rounded-xl bg-muted/50 border-transparent focus:bg-background focus:border-primary transition-all text-base"
              />
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="email" className="text-sm font-medium">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="hola@tu-local.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 rounded-xl bg-muted/50 border-transparent focus:bg-background focus:border-primary transition-all text-base"
              />
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="password" className="text-sm font-medium">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={3}
                className="h-12 rounded-xl bg-muted/50 border-transparent focus:bg-background focus:border-primary transition-all text-base"
              />
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirmar contraseña</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={3}
                className="h-12 rounded-xl bg-muted/50 border-transparent focus:bg-background focus:border-primary transition-all text-base"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-14 rounded-xl text-lg font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98] mt-4"
              disabled={isLoading}
            >
              {isLoading ? 'Preparando tu tienda...' : 'Registrar mi local'}
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground font-medium">
            ¿Ya tienes una cuenta?{' '}
            <Link to="/login" className="text-[#FF7A00] hover:text-[#E66E00] hover:underline transition-colors">
              Inicia sesión
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Register