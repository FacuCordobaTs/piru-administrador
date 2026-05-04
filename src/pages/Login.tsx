import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Eye, EyeOff, ArrowRight, ChefHat, LayoutDashboard, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/store/authStore'
import { authApi, ApiError } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// Clases consistentes con el resto de la app
const phantomInputClass = "h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border-transparent focus:bg-background focus:border-[#FF7A00] transition-all text-base px-5 w-full"
const phantomLabelClass = "text-sm font-medium text-foreground ml-1"

const Login = () => {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Apply system theme preference on mount
  useEffect(() => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle('dark', isDark)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await authApi.login(email, password)

      if (
        typeof response === 'object' &&
        response !== null &&
        'token' in response &&
        'restaurante' in response
      ) {
        const { token, restaurante, message } = response as {
          token: string
          restaurante: any
          message?: string
        }

        setAuth(token, restaurante)
        toast.success('¡Bienvenido de vuelta!', {
          description: message || 'Sesión iniciada correctamente',
        })
        navigate('/dashboard')
      } else {
        toast.error('Error en la respuesta del servidor')
      }
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error('Error al iniciar sesión', {
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
    <div className="min-h-dvh flex w-full bg-background selection:bg-orange-500/10 selection:text-[#FF7A00]">

      {/* Panel Izquierdo - Branding (Oculto en móviles) */}
      <div className="hidden lg:flex w-1/2 bg-zinc-950 text-white flex-col justify-between p-12 relative overflow-hidden">
        {/* Efecto de fondo sutil consistente con Register */}
        <div className="absolute top-0 left-0 w-full h-full bg-linear-to-br from-[#FF7A00]/10 to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col h-full">
          <img src="/logopiru.jpeg" alt="Piru Logo" className="h-10 w-auto self-start mb-auto" />

          <div className="my-auto space-y-8">
            <h1 className="text-4xl xl:text-5xl font-bold leading-tight">
              Volvé a operar <br /> tu local en segundos.
            </h1>

            <div className="space-y-6 max-w-md">
              <div className="flex items-start gap-4">
                <div className="mt-1 h-10 w-10 shrink-0 bg-white/10 rounded-2xl flex items-center justify-center">
                  <Zap className="h-5 w-5 text-[#FF7A00]" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Despacho rápido</h3>
                  <p className="text-sm text-zinc-400">Vé lo que llegó, revisá el pago y despachá con un solo botón.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="mt-1 h-10 w-10 shrink-0 bg-white/10 rounded-2xl flex items-center justify-center">
                  <LayoutDashboard className="h-5 w-5 text-[#FF7A00]" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Sin tableros raros</h3>
                  <p className="text-sm text-zinc-400">Una interfaz minimalista, ordenada y fácil de usar para todo tu equipo.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-sm text-zinc-600 font-medium">
          © {new Date().getFullYear()} Piru.app
        </div>
      </div>

      {/* Panel Derecho - Formulario de Login */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 py-12 sm:px-12 animate-in fade-in duration-700">
        <div className="w-full max-w-md mx-auto space-y-8">

          {/* Header del Formulario */}
          <div className="text-left">
            <img src="/logopiru.jpeg" alt="Piru" className="h-10 w-auto lg:hidden mb-8" />
            <div className="h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 dark:bg-orange-950/30 text-[#FF7A00] mb-6 hidden lg:flex">
              <ChefHat className="h-6 w-6" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Ingresar a Piru</h2>
            <p className="text-muted-foreground mt-2 text-base">
              Accedé a tu panel para gestionar tus pedidos de Delivery y Takeaway.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className={phantomLabelClass}>Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@tu-local.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className={phantomInputClass}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <Label htmlFor="password" className="text-sm font-medium text-foreground">Contraseña</Label>
                {/* Opcional: Link de recuperar contraseña */}
                {/* <Link to="/forgot-password" className="text-xs text-[#FF7A00] hover:underline font-medium">¿Olvidaste tu contraseña?</Link> */}
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className={cn(phantomInputClass, "pr-12")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-0 flex items-center justify-center w-12 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={isLoading}
              className="w-full h-14 mt-4 rounded-xl text-lg font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98]"
            >
              {isLoading ? 'Ingresando...' : 'Entrar al panel'}
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground font-medium pt-4 border-t border-zinc-100 dark:border-zinc-800">
            ¿Aún no tienes tu tienda?{' '}
            <Link
              to="/register"
              className="inline-flex items-center gap-1 text-[#FF7A00] hover:text-[#E66E00] hover:underline transition-colors"
            >
              Crear cuenta ahora
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}

export default Login