import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { authApi, ApiError } from '@/lib/api'
import { toast } from 'sonner'

const Register = () => {
  const navigate = useNavigate()

  // Registro por WhatsApp (sólo teléfono; el resto se pide en el onboarding)
  const [telefono, setTelefono] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Apply system theme preference on mount + autofocus
  useEffect(() => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle('dark', isDark)
    // Enfocamos apenas entra: cero fricción, el teclado ya está listo
    const t = setTimeout(() => inputRef.current?.focus(), 350)
    return () => clearTimeout(t)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    let telefonoLimpio = telefono.replace(/\D/g, '')
    if (telefonoLimpio.length < 8) {
      toast.error('Ingresá un número de WhatsApp válido')
      return
    }
    // El prefijo +54 se muestra fijo en el input; lo anteponemos si el usuario no lo tipeó
    if (!telefonoLimpio.startsWith('54')) {
      telefonoLimpio = `54${telefonoLimpio}`
    }

    setIsLoading(true)
    try {
      const response = await authApi.registerTelefonoStart(telefonoLimpio)

      if (typeof response === 'object' && response !== null && 'verificationId' in response) {
        const { verificationId, telefono: telefonoNormalizado } = response as { verificationId: string; telefono?: string }
        toast.success('Código enviado', {
          description: 'Te lo mandamos por WhatsApp 📲',
        })
        // Navegamos a la pantalla de espera, única por verificationId (UUID)
        navigate(`/verificar/${verificationId}`, {
          state: { telefono: telefonoNormalizado || telefonoLimpio },
        })
      } else {
        toast.error('Error en la respuesta del servidor')
      }
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error('No pudimos enviar el código', { description: error.message })
      } else {
        toast.error('Error de conexión', { description: 'No se pudo conectar con el servidor' })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const puedeEnviar = telefono.replace(/\D/g, '').length >= 8

  return (
    <div className="min-h-dvh flex flex-col w-full bg-background px-6 selection:bg-orange-500/10 selection:text-[#FF7A00]">
      {/* Barra superior: logo + acceso discreto a "ya tengo cuenta" */}
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

      {/* El registro es la primera pantalla del onboarding, no un formulario */}
      <main className="flex-1 flex flex-col justify-center w-full max-w-md mx-auto pb-16">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-700">
          {/* Paso, para que se sienta un flujo y no un trámite */}
          <div className="flex items-center gap-2 mb-6">
            <span className="text-xs font-medium tracking-wide text-[#FF7A00]">PASO 1 DE 3</span>
            <span className="h-px flex-1 bg-gradient-to-r from-[#FF7A00]/40 to-transparent" />
          </div>

          <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-tight text-balance">
            ¿Cuál es el WhatsApp<br />de tu local?
          </h1>
          <p className="text-[15px] text-muted-foreground mt-3">
            Ahí te van a llegar los pedidos.
          </p>

          <form onSubmit={handleSubmit} className="mt-8">
            <label
              htmlFor="telefono"
              className="group flex items-center gap-3 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-900 px-5 transition-colors focus-within:bg-zinc-200/70 dark:focus-within:bg-zinc-800 focus-within:ring-2 focus-within:ring-[#FF7A00]/30"
            >
              <span className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500 select-none">
                {/* Ícono WhatsApp */}
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current shrink-0" aria-hidden>
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                <span className="text-base">+54</span>
                <span className="h-6 w-px bg-zinc-300 dark:bg-zinc-700" />
              </span>
              <input
                ref={inputRef}
                id="telefono"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="9 351 123 4567"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="flex-1 bg-transparent border-0 outline-none text-base placeholder:text-zinc-400 dark:placeholder:text-zinc-600 w-full min-w-0"
              />
            </label>

            <Button
              type="submit"
              size="lg"
              disabled={isLoading || !puedeEnviar}
              className="w-full h-14 mt-3 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white shadow-none transition-all active:scale-[0.985] disabled:opacity-40"
            >
              {isLoading ? 'Enviando código…' : 'Continuar'}
            </Button>
          </form>

          <p className="text-[13px] text-muted-foreground/80 mt-5 leading-relaxed">
            Te mandamos un código por WhatsApp para verificar el número.
            Sin contraseñas, sin tarjetas.
          </p>
        </div>
      </main>
    </div>
  )
}

export default Register
