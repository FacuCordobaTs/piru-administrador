import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, useLocation, Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/authStore'
import { authApi, ApiError } from '@/lib/api'
import { toast } from 'sonner'

const CODE_LENGTH = 6
const RESEND_COOLDOWN = 45 // segundos

/**
 * Pantalla de espera del código de WhatsApp, única por verificationId (UUID en la URL).
 * El usuario ingresa el código de 6 dígitos que le llegó por WhatsApp; al verificarlo
 * se crea la cuenta y entra al onboarding.
 */
const VerificarCodigo = () => {
  const navigate = useNavigate()
  const { id: verificationId } = useParams<{ id: string }>()
  const location = useLocation()
  const setAuth = useAuthStore((state) => state.setAuth)

  const state = (location.state || {}) as { telefono?: string; mode?: 'register' | 'login' }
  const telefono = state.telefono
  const isLogin = state.mode === 'login'

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''))
  const [isLoading, setIsLoading] = useState(false)
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN)
  const inputsRef = useRef<Array<HTMLInputElement | null>>([])

  // Aplicar tema del sistema
  useEffect(() => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle('dark', isDark)
  }, [])

  // Sin verificationId no tiene sentido esta pantalla
  useEffect(() => {
    if (!verificationId) navigate('/register', { replace: true })
  }, [verificationId, navigate])

  // Cuenta regresiva para reenviar
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  // Foco inicial
  useEffect(() => {
    inputsRef.current[0]?.focus()
  }, [])

  const submitCodigo = useCallback(async (codigo: string) => {
    if (!verificationId || codigo.length !== CODE_LENGTH) return

    setIsLoading(true)
    try {
      if (isLogin) {
        // Login por WhatsApp: la cuenta ya existe, sólo obtenemos el token.
        const response = await authApi.loginTelefonoVerify(verificationId, codigo)
        if (typeof response === 'object' && response !== null && 'token' in response && 'restaurante' in response) {
          const { token, restaurante } = response as { token: string; restaurante: any }
          setAuth(token, restaurante)
          // El ProtectedLayout redirige a /onboarding si aún no lo completó.
          navigate('/dashboard', { replace: true })
        } else {
          toast.error('Error en la respuesta del servidor')
        }
        return
      }

      const response = await authApi.registerTelefonoVerify(verificationId, codigo)

      if (
        typeof response === 'object' &&
        response !== null &&
        'token' in response &&
        'newRestaurante' in response
      ) {
        const { token, newRestaurante } = response as { token: string; newRestaurante: any; message?: string }
        setAuth(token, newRestaurante[0])
        // Pantalla intermedia de bienvenida antes del onboarding
        navigate('/bienvenida', { replace: true, state: { telefono } })
      } else {
        toast.error('Error en la respuesta del servidor')
      }
    } catch (error) {
      // Limpiar el input para reintentar
      setDigits(Array(CODE_LENGTH).fill(''))
      inputsRef.current[0]?.focus()
      if (error instanceof ApiError) {
        toast.error('No pudimos verificar el código', { description: error.message })
      } else {
        toast.error('Error de conexión', { description: 'No se pudo conectar con el servidor' })
      }
    } finally {
      setIsLoading(false)
    }
  }, [verificationId, setAuth, navigate, isLogin, telefono])

  const handleChange = (index: number, value: string) => {
    const clean = value.replace(/\D/g, '')
    if (!clean) {
      // Borrado
      setDigits((prev) => {
        const next = [...prev]
        next[index] = ''
        return next
      })
      return
    }

    setDigits((prev) => {
      const next = [...prev]
      // Si pegaron varios dígitos, distribuirlos
      const chars = clean.split('')
      let i = index
      for (const ch of chars) {
        if (i >= CODE_LENGTH) break
        next[i] = ch
        i++
      }
      const focusIndex = Math.min(i, CODE_LENGTH - 1)
      inputsRef.current[focusIndex]?.focus()

      const joined = next.join('')
      if (joined.length === CODE_LENGTH && !next.includes('')) {
        submitCodigo(joined)
      }
      return next
    })
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus()
    }
  }

  const handleResend = async () => {
    if (!verificationId || cooldown > 0) return
    try {
      await authApi.registerTelefonoResend(verificationId)
      toast.success('Código reenviado', { description: 'Revisá tu WhatsApp 📲' })
      setCooldown(RESEND_COOLDOWN)
      setDigits(Array(CODE_LENGTH).fill(''))
      inputsRef.current[0]?.focus()
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error('No pudimos reenviar el código', { description: error.message })
      } else {
        toast.error('Error de conexión')
      }
    }
  }

  const codigo = digits.join('')

  return (
    <div className="min-h-dvh flex items-center justify-center w-full bg-background px-6 selection:bg-orange-500/10 selection:text-[#FF7A00]">
      <div className="w-full max-w-sm animate-in fade-in duration-700">
        <div className="flex justify-center mb-10">
          <img src="/logopiru.jpeg" alt="Piru" className="h-12 w-auto rounded-2xl" />
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Ingresá el código</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Te lo enviamos por WhatsApp
            {telefono ? (
              <>
                {' '}al <span className="font-medium text-foreground">+{telefono}</span>
              </>
            ) : null}
          </p>
        </div>

        <div className="flex justify-center gap-2 mb-6" dir="ltr">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(el) => { inputsRef.current[index] = el }}
              type="text"
              inputMode="numeric"
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              maxLength={CODE_LENGTH}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              disabled={isLoading}
              className="w-12 h-14 text-center text-xl font-semibold rounded-2xl bg-zinc-100 dark:bg-zinc-900 border-0 focus:outline-none focus:ring-2 focus:ring-[#FF7A00] transition-all disabled:opacity-50"
            />
          ))}
        </div>

        <Button
          type="button"
          size="lg"
          disabled={isLoading || codigo.length !== CODE_LENGTH}
          onClick={() => submitCodigo(codigo)}
          className="w-full h-12 rounded-2xl text-sm font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white shadow-none transition-all active:scale-[0.98]"
        >
          {isLoading ? 'Verificando...' : 'Verificar'}
        </Button>

        <div className="text-center text-sm text-muted-foreground mt-6">
          {cooldown > 0 ? (
            <span>Reenviar código en {cooldown}s</span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              className="text-[#FF7A00] hover:text-[#E66E00] transition-colors font-medium"
            >
              Reenviar código
            </button>
          )}
        </div>

        <div className="text-center text-sm text-muted-foreground mt-8">
          <Link to={isLogin ? '/login' : '/register'} className="hover:text-foreground transition-colors">
            ← Cambiar número
          </Link>
        </div>
      </div>
    </div>
  )
}

export default VerificarCodigo
