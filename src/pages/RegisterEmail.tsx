import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/store/authStore'
import { authApi, ApiError } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const inputClass = "h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border-0 focus-visible:ring-0 focus-visible:bg-zinc-200/70 dark:focus-visible:bg-zinc-800 transition-colors text-base px-5 w-full shadow-none"

/**
 * Alta de cuenta por EMAIL + contraseña (sin verificar teléfono por WhatsApp). Es el camino
 * secundario para cuentas de prueba/manuales: reusa el endpoint legacy `/auth/register-restaurante`,
 * que crea el restaurante ya autenticado (setAuth) y con `requiereSuscripcion=true` (cae en el paywall
 * como cualquier alta nueva). El registro principal sigue siendo por WhatsApp (`/register`).
 */
const RegisterEmail = () => {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)

  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Tema del sistema + autofocus apenas entra (cero fricción).
  useEffect(() => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle('dark', isDark)
    const t = setTimeout(() => inputRef.current?.focus(), 350)
    return () => clearTimeout(t)
  }, [])

  const puedeEnviar =
    nombre.trim().length > 0 && /\S+@\S+\.\S+/.test(email) && password.length >= 3

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!puedeEnviar) {
      toast.error('Completá nombre, un email válido y una contraseña')
      return
    }

    setIsLoading(true)
    try {
      const response = await authApi.register(email.trim(), password, nombre.trim())

      // El endpoint devuelve { token, newRestaurante: [row], message }.
      if (typeof response === 'object' && response !== null && 'token' in response && 'newRestaurante' in response) {
        const { token, newRestaurante } = response as { token: string; newRestaurante: any[] }
        const restaurante = Array.isArray(newRestaurante) ? newRestaurante[0] : newRestaurante
        setAuth(token, restaurante)
        toast.success('Cuenta creada', { description: 'Ya estás adentro 🎉' })
        // Mismo destino que el login por email; el gate decide onboarding/paywall.
        navigate('/dashboard')
      } else {
        toast.error('Error en la respuesta del servidor')
      }
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error('No pudimos crear la cuenta', { description: error.message })
      } else {
        toast.error('Error de conexión', { description: 'No se pudo conectar con el servidor' })
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col w-full bg-background px-6 selection:bg-orange-500/10 selection:text-[#FF7A00]">
      {/* Barra superior: logo + acceso a "ya tengo cuenta" */}
      <header className="w-full max-w-md mx-auto flex items-center justify-between pt-7">
        <img src="/logopiru.jpeg" alt="Piru" className="h-9 w-auto rounded-xl" />
        <Link
          to="/login"
          className="group flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Iniciar sesión
          <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
        </Link>
      </header>

      <main className="flex-1 flex flex-col justify-center w-full max-w-md mx-auto pb-16">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-700">
          <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-tight text-balance">
            Creá tu cuenta<br />con email
          </h1>
          <p className="text-[15px] text-muted-foreground mt-3">
            Sin verificar el teléfono. Entrás directo.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-3">
            <Input
              ref={inputRef}
              id="nombre"
              type="text"
              placeholder="Nombre del local"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoComplete="organization"
              className={inputClass}
            />

            <Input
              id="email"
              type="email"
              placeholder="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
                autoComplete="new-password"
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
              disabled={isLoading || !puedeEnviar}
              className="w-full h-14 mt-1 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white shadow-none transition-all active:scale-[0.985] disabled:opacity-40"
            >
              {isLoading ? 'Creando cuenta…' : 'Crear cuenta'}
            </Button>
          </form>

          <Link
            to="/register"
            className="mt-6 block w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Prefiero registrarme con WhatsApp
          </Link>
        </div>
      </main>
    </div>
  )
}

export default RegisterEmail
