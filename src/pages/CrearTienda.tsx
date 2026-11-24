import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { authApi, ApiError, isTokenExpired } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const inputClass = "h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border-0 focus-visible:ring-0 focus-visible:bg-zinc-200/70 dark:focus-visible:bg-zinc-800 transition-colors text-base px-5 w-full shadow-none"

/**
 * "Crear tienda gratis": el registro self-serve, al estilo Tiendanube. Mail, nombre de la marca y
 * contraseña; la tienda nace en el plan Inicial y entra directo al panel, a "Primeros pasos".
 * Se llega desde info.piru.app (`/crear-tienda?email=` precarga el mail que escribió ahí).
 */
const CrearTienda = () => {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const setAuth = useAuthStore((state) => state.setAuth)
  const token = useAuthStore((state) => state.token)
  const resetRestaurante = useRestauranteStore((state) => state.reset)

  const [email, setEmail] = useState(() => params.get('email') ?? '')
  const [nombre, setNombre] = useState('')
  const [password, setPassword] = useState('')
  const [verPassword, setVerPassword] = useState(false)
  const [acepta, setAcepta] = useState(false)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle('dark', isDark)
  }, [])

  // Con una sesión abierta (y no recién creada acá) no hay nada que registrar.
  const [creada, setCreada] = useState(false)
  const conSesion = Boolean(token && !isTokenExpired(token))

  const listo = email.includes('@') && nombre.trim().length >= 2 && password.length >= 8 && acepta

  const crear = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!listo) return
    setEnviando(true)
    try {
      const res = await authApi.crearTienda({ email: email.trim(), nombre: nombre.trim(), password, aceptaTerminos: true })
      setCreada(true)
      resetRestaurante()
      setAuth(res.token, res.restaurante)
      toast.success('¡Tu tienda está creada!', { description: 'Te dejamos los pasos para dejarla lista.' })
      navigate('/dashboard/primeros-pasos', { replace: true })
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error('No pudimos crear tu tienda', { description: error.message })
      } else {
        toast.error('Error de conexión', { description: 'No se pudo conectar con el servidor' })
      }
    } finally {
      setEnviando(false)
    }
  }

  if (conSesion && !creada) return <Navigate to="/dashboard" replace />

  return (
    <div className="min-h-dvh flex flex-col w-full bg-background px-6 selection:bg-orange-500/10 selection:text-[#FF7A00]">
      <header className="w-full max-w-md mx-auto flex items-center justify-between pt-7">
        <img src="/logopiru.jpeg" alt="Piru" className="h-9 w-auto rounded-xl" />
        <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Ya tengo tienda
        </Link>
      </header>

      <main className="flex-1 flex flex-col justify-center w-full max-w-md mx-auto py-10">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-700">
          <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-tight text-balance">
            Creá tu tienda gratis
          </h1>
          <p className="text-[15px] text-muted-foreground mt-3">
            Sin tarjeta y sin límite de pedidos ni productos. Después elegís si querés un plan con más herramientas.
          </p>

          <form onSubmit={crear} className="mt-8 space-y-3">
            <label className="block">
              <span className="sr-only">E-mail</span>
              <Input
                type="email"
                placeholder="E-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="sr-only">Nombre de tu marca</span>
              <Input
                placeholder="Nombre de tu marca"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                maxLength={80}
                autoComplete="organization"
                className={inputClass}
              />
            </label>
            <div className="relative">
              <Input
                type={verPassword ? 'text' : 'password'}
                placeholder="Contraseña (8 caracteres o más)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className={cn(inputClass, 'pr-12')}
              />
              <button
                type="button"
                onClick={() => setVerPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center justify-center w-12 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {verPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>

            <label className="flex items-start gap-3 pt-2 text-sm text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={acepta}
                onChange={(e) => setAcepta(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#FF7A00]"
              />
              <span>
                Acepto los{' '}
                <a href="https://info.piru.app/terminos" target="_blank" rel="noreferrer" className="text-foreground underline underline-offset-2">
                  términos y condiciones
                </a>{' '}
                y la{' '}
                <a href="https://info.piru.app/privacidad" target="_blank" rel="noreferrer" className="text-foreground underline underline-offset-2">
                  política de privacidad
                </a>{' '}
                de Piru.
              </span>
            </label>

            <Button
              type="submit"
              size="lg"
              disabled={enviando || !listo}
              className="w-full h-14 mt-2 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white shadow-none transition-all active:scale-[0.985] disabled:opacity-40"
            >
              {enviando ? 'Creando tu tienda…' : 'Crear tienda gratis'}
            </Button>
          </form>
        </div>
      </main>
    </div>
  )
}

export default CrearTienda
