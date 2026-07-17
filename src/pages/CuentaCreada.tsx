import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/authStore'

/**
 * Pantalla de bienvenida post-verificación.
 * Confirma que la cuenta quedó creada y le explica al usuario que sus pedidos
 * van a llegar por WhatsApp, dejando la puerta abierta a sumar una impresora
 * u otros canales más adelante. Desde acá se entra al onboarding.
 */
const CuentaCreada = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const restaurante = useAuthStore((state) => state.restaurante)

  const state = (location.state || {}) as { telefono?: string }
  const telefono =
    state.telefono ||
    (restaurante && 'telefono' in restaurante ? (restaurante as any).telefono : undefined)

  useEffect(() => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle('dark', isDark)
  }, [])

  const continuar = () => navigate('/onboarding', { replace: true })

  return (
    <div className="min-h-dvh flex flex-col w-full bg-background px-6 selection:bg-orange-500/10 selection:text-[#FF7A00]">
      <main className="flex-1 flex flex-col justify-center w-full max-w-md mx-auto pb-10">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-700">
          {/* Check con pulso suave: momento de logro, sin ser estridente */}
          <div className="relative mb-8 w-16 h-16">
            <span className="absolute inset-0 rounded-2xl bg-[#FF7A00]/15 animate-ping [animation-duration:2s]" />
            <div className="relative w-16 h-16 rounded-2xl bg-[#FF7A00] flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-8 h-8 stroke-white" fill="none" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" className="animate-in fade-in zoom-in-50 duration-500" />
              </svg>
            </div>
          </div>

          <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-tight text-balance">
            Listo, ya tenés Piru
          </h1>
          <p className="text-[15px] text-muted-foreground mt-3">
            Tu local ya puede recibir pedidos. No hace falta nada más para arrancar.
          </p>

          {/* Canal principal: WhatsApp verificado */}
          <div className="mt-8 rounded-2xl bg-zinc-100 dark:bg-zinc-900 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#25D366]/15 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-[#25D366]" aria-hidden>
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">Recibís los pedidos por WhatsApp</p>
                {telefono ? (
                  <p className="text-sm text-muted-foreground truncate">+{String(telefono).replace(/^\+/, '')}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Al número que acabás de verificar</p>
                )}
              </div>
              <span className="ml-auto shrink-0 text-[11px] font-medium text-[#25D366] bg-[#25D366]/10 rounded-full px-2.5 py-1">
                Activo
              </span>
            </div>
          </div>

          {/* Puerta abierta a otros canales, sin obligar a nada ahora */}
          <p className="text-[13px] text-muted-foreground/90 mt-5 leading-relaxed flex items-start gap-2">
            <svg viewBox="0 0 24 24" className="h-4 w-4 mt-0.5 shrink-0 stroke-current" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="6" y="14" width="12" height="8" rx="1" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
              <path d="M6 9V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v5" />
            </svg>
            <span>
              Cuando quieras, sumás una <span className="text-foreground font-medium">impresora</span> u otras formas de recibir pedidos. Lo configurás en cualquier momento.
            </span>
          </p>

          <Button
            type="button"
            size="lg"
            onClick={continuar}
            className="w-full h-14 mt-8 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white shadow-none transition-all active:scale-[0.985]"
          >
            Terminá de armar tu local
          </Button>
        </div>
      </main>
    </div>
  )
}

export default CuentaCreada
