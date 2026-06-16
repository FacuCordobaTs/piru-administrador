import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/store/authStore'
import { authApi, ApiError } from '@/lib/api'
import { toast } from 'sonner'

const inputClass = "h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border-0 focus-visible:ring-0 focus-visible:bg-zinc-200/70 dark:focus-visible:bg-zinc-800 transition-colors text-base px-5 w-full shadow-none"

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
    <div className="min-h-dvh flex items-center justify-center w-full bg-background px-6 selection:bg-orange-500/10 selection:text-[#FF7A00]">
      <div className="w-full max-w-sm animate-in fade-in duration-700">
        <div className="flex justify-center mb-12">
          <img src="/logopiru.jpeg" alt="Piru" className="h-12 w-auto rounded-2xl" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            id="nombre"
            type="text"
            placeholder="Nombre del local"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            minLength={3}
            className={inputClass}
          />

          <Input
            id="email"
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputClass}
          />

          <Input
            id="password"
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={3}
            className={inputClass}
          />

          <Input
            id="confirmPassword"
            type="password"
            placeholder="Confirmar contraseña"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={3}
            className={inputClass}
          />

          <Button
            type="submit"
            size="lg"
            disabled={isLoading}
            className="w-full h-12 mt-3 rounded-2xl text-sm font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white shadow-none transition-all active:scale-[0.98]"
          >
            {isLoading ? 'Creando...' : 'Crear cuenta'}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground mt-10">
          <Link to="/login" className="text-[#FF7A00] hover:text-[#E66E00] transition-colors font-medium">
            Ya tengo cuenta
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Register
