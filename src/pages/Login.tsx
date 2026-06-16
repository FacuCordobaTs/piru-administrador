import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/store/authStore'
import { authApi, ApiError } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const inputClass = "h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border-0 focus-visible:ring-0 focus-visible:bg-zinc-200/70 dark:focus-visible:bg-zinc-800 transition-colors text-base px-5 w-full shadow-none"

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
    <div className="min-h-dvh flex items-center justify-center w-full bg-background px-6 selection:bg-orange-500/10 selection:text-[#FF7A00]">
      <div className="w-full max-w-sm animate-in fade-in duration-700">
        <div className="flex justify-center mb-12">
          <img src="/logopiru.jpeg" alt="Piru" className="h-12 w-auto rounded-2xl" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            id="email"
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className={inputClass}
          />

          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className={cn(inputClass, "pr-12")}
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

          <Button
            type="submit"
            size="lg"
            disabled={isLoading}
            className="w-full h-12 mt-3 rounded-2xl text-sm font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white shadow-none transition-all active:scale-[0.98]"
          >
            {isLoading ? 'Ingresando...' : 'Entrar'}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground mt-10">
          <Link
            to="/register"
            className="text-[#FF7A00] hover:text-[#E66E00] transition-colors font-medium"
          >
            Crear cuenta
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Login
