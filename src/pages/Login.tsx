import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
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
  const emailRef = useRef<HTMLInputElement>(null)

  const [isLoading, setIsLoading] = useState(false)

  // Apply system theme preference on mount + autofocus del correo
  useEffect(() => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle('dark', isDark)
    const t = setTimeout(() => emailRef.current?.focus(), 350)
    return () => clearTimeout(t)
  }, [])

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await authApi.login(email, password)

      if (typeof response === 'object' && response !== null && 'token' in response && 'restaurante' in response) {
        const { token, restaurante, message } = response as { token: string; restaurante: NonNullable<ReturnType<typeof useAuthStore.getState>['restaurante']>; message?: string }
        setAuth(token, restaurante)
        toast.success('¡Bienvenido de vuelta!', { description: message || 'Sesión iniciada correctamente' })
        navigate('/dashboard')
      } else {
        toast.error('Error en la respuesta del servidor')
      }
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error('Error al iniciar sesión', { description: error.message })
      } else {
        toast.error('Error de conexión', { description: 'No se pudo conectar con el servidor' })
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col w-full bg-background px-6 selection:bg-orange-500/10 selection:text-[#FF7A00]">
      {/* Barra superior: logo Piru */}
      <header className="w-full max-w-md mx-auto flex items-center justify-between pt-7">
        <img src="/logopiru.jpeg" alt="Piru" className="h-9 w-auto rounded-xl" />

      </header>

      <main className="flex-1 flex flex-col justify-center w-full max-w-md mx-auto pb-16">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-700">
          <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-tight text-balance">
            Entrá a tu local
          </h1>
          <p className="text-[15px] text-muted-foreground mt-3">
            Ingresá con tu correo y contraseña.
          </p>

          <form onSubmit={handleEmailSubmit} className="mt-8 space-y-3">
            <Input
              ref={emailRef}
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
              className="w-full h-14 mt-1 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white shadow-none transition-all active:scale-[0.985]"
            >
              {isLoading ? 'Ingresando…' : 'Entrar'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            ¿Todavía no tenés tienda?{' '}
            <a href="/crear-tienda" className="font-medium text-foreground underline underline-offset-2">Creala gratis</a>
          </p>
        </div>
      </main>
    </div>
  )
}

export default Login
