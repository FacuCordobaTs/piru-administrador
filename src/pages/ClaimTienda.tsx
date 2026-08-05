import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Loader2, Check, CircleDashed, Store, MessageCircle, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/authStore'
import { claimApi, ApiError, type ClaimTienda as ClaimTiendaData, type ClaimInventario } from '@/lib/api'

const CODE_LENGTH = 6
const RESEND_COOLDOWN = 45 // segundos

/**
 * Claim de tienda (onboarding outbound) — ruta pública `/mi-tienda/:token`, SIN login.
 *
 * El dueño llega por el link que Facu le mandó por WhatsApp. La tienda ya está construida (Facu la
 * armó): esta pantalla no le pide "registrarse" (registrarse es de extraños; él ya tiene una tienda).
 * Es un RECLAMO en 2 pasos:
 *   1) "Esta tienda es de [Local]" — logo + nombre + inventario de lo ya cargado (efecto dotación).
 *      SIEMPRE le pedimos su WhatsApp: le mandamos un código al número que ingresa (y con el que entra).
 *   2) Ingresa el código de 6 dígitos → guardamos el token → entra a su panel.
 */
type Paso = 'preview' | 'codigo'

// Motivos de link no reclamable, para mostrar el mensaje correcto (y a dónde mandar al dueño).
type Bloqueo = { titulo: string; detalle: string; irALogin?: boolean } | null

export default function ClaimTienda() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [loading, setLoading] = useState(true)
  const [bloqueo, setBloqueo] = useState<Bloqueo>(null)
  const [tienda, setTienda] = useState<ClaimTiendaData | null>(null)
  const [inventario, setInventario] = useState<ClaimInventario | null>(null)

  const [paso, setPaso] = useState<Paso>('preview')
  const [enviando, setEnviando] = useState(false)

  // El claim SIEMPRE pide el WhatsApp: el dueño escribe dónde recibir el código (y con qué entra).
  const [telefono, setTelefono] = useState('')

  // Estado del OTP (paso 2)
  const [verificationId, setVerificationId] = useState<string | null>(null)
  const [telefonoEnmascarado, setTelefonoEnmascarado] = useState<string | null>(null)
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''))
  const [verificando, setVerificando] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const inputsRef = useRef<Array<HTMLInputElement | null>>([])
  const submittingRef = useRef(false)

  // Tema del sistema (esta ruta vive fuera del layout que ya lo aplica)
  useEffect(() => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle('dark', isDark)
  }, [])

  // Preview de la tienda reclamable
  useEffect(() => {
    let cancel = false
    setLoading(true)
    claimApi
      .preview(token)
      .then((r) => {
        if (cancel) return
        setTienda(r.tienda)
        setInventario(r.inventario)
      })
      .catch((e) => {
        if (cancel) return
        setBloqueo(mapBloqueo(e))
      })
      .finally(() => !cancel && setLoading(false))
    return () => {
      cancel = true
    }
  }, [token])

  // Cuenta regresiva para reenviar el código
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  // Normaliza el WhatsApp tipeado: sólo dígitos + prefijo 54 si falta (igual que el registro).
  const normalizarTelefono = (raw: string): string | null => {
    let limpio = raw.replace(/\D/g, '')
    if (limpio.length < 8) return null
    if (!limpio.startsWith('54')) limpio = `54${limpio}`
    return limpio
  }

  const iniciarReclamo = async () => {
    const tel = normalizarTelefono(telefono)
    if (!tel) {
      toast.error('Ingresá un número de WhatsApp válido')
      return
    }
    setEnviando(true)
    try {
      const r = await claimApi.start(token, tel)
      setVerificationId(r.verificationId)
      setTelefonoEnmascarado(r.telefonoEnmascarado)
      setPaso('codigo')
      setCooldown(RESEND_COOLDOWN)
      setDigits(Array(CODE_LENGTH).fill(''))
      setTimeout(() => inputsRef.current[0]?.focus(), 50)
    } catch (e) {
      if (e instanceof ApiError && (e.response?.yaReclamada || e.response?.vencido)) {
        setBloqueo(mapBloqueo(e))
      } else {
        toast.error('No pudimos enviar el código', {
          description: e instanceof ApiError ? e.message : 'Probá de nuevo en un momento',
        })
      }
    } finally {
      setEnviando(false)
    }
  }

  const submitCodigo = useCallback(
    async (codigo: string) => {
      if (!verificationId || codigo.length !== CODE_LENGTH) return
      if (submittingRef.current) return
      submittingRef.current = true
      setVerificando(true)
      try {
        const r = await claimApi.verify(token, verificationId, codigo)
        setAuth(r.token, r.restaurante)
        // El token queda guardado: el ProtectedLayout lo lleva a su panel (o al inventario/onboarding
        // según lo que falte). Copys del efecto dotación, nunca "cuenta creada".
        toast.success('¡Tu tienda es tuya! 🎉')
        navigate('/dashboard', { replace: true })
      } catch (e) {
        setDigits(Array(CODE_LENGTH).fill(''))
        inputsRef.current[0]?.focus()
        toast.error('No pudimos verificar el código', {
          description: e instanceof ApiError ? e.message : 'Error de conexión',
        })
      } finally {
        setVerificando(false)
        submittingRef.current = false
      }
    },
    [verificationId, token, setAuth, navigate],
  )

  const handleChange = (index: number, value: string) => {
    const clean = value.replace(/\D/g, '')
    if (!clean) {
      setDigits((prev) => {
        const next = [...prev]
        next[index] = ''
        return next
      })
      return
    }
    setDigits((prev) => {
      const next = [...prev]
      const chars = clean.split('')
      let i = index
      for (const ch of chars) {
        if (i >= CODE_LENGTH) break
        next[i] = ch
        i++
      }
      inputsRef.current[Math.min(i, CODE_LENGTH - 1)]?.focus()
      const joined = next.join('')
      if (joined.length === CODE_LENGTH && !next.includes('')) submitCodigo(joined)
      return next
    })
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) inputsRef.current[index - 1]?.focus()
  }

  const reenviar = async () => {
    if (cooldown > 0) return
    const tel = normalizarTelefono(telefono)
    if (!tel) {
      toast.error('Ingresá un número de WhatsApp válido')
      return
    }
    try {
      const r = await claimApi.start(token, tel)
      setVerificationId(r.verificationId)
      setTelefonoEnmascarado(r.telefonoEnmascarado)
      setCooldown(RESEND_COOLDOWN)
      setDigits(Array(CODE_LENGTH).fill(''))
      inputsRef.current[0]?.focus()
      toast.success('Código reenviado', { description: 'Revisá tu WhatsApp 📲' })
    } catch (e) {
      toast.error('No pudimos reenviar el código', {
        description: e instanceof ApiError ? e.message : 'Error de conexión',
      })
    }
  }

  const logo = tienda?.imagenUrl || tienda?.imagenLightUrl || null
  const codigo = digits.join('')

  return (
    <div className="min-h-dvh flex items-center justify-center w-full bg-background px-6 selection:bg-orange-500/10 selection:text-[#FF7A00]">
      <div className="w-full max-w-sm animate-in fade-in duration-500">
        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : bloqueo ? (
          <BloqueoView bloqueo={bloqueo} onLogin={() => navigate('/login', { replace: true })} />
        ) : paso === 'preview' ? (
          <>
            <div className="flex justify-center mb-6">
              {logo ? (
                <img
                  src={logo}
                  alt={tienda?.nombre ?? 'Tu tienda'}
                  className="h-20 w-20 rounded-2xl object-cover shadow-sm ring-1 ring-border"
                />
              ) : (
                <div className="h-20 w-20 rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
                  <Store className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </div>

            <div className="text-center mb-7">
              <p className="text-sm text-muted-foreground">Esta tienda es de</p>
              <h1 className="text-2xl font-semibold tracking-tight mt-0.5">
                {tienda?.nombre ?? 'tu local'}
              </h1>
              <p className="text-sm text-muted-foreground mt-2">
                Ya está armada y lista para recibir pedidos.
              </p>
            </div>

            {inventario && <InventarioLista inv={inventario} />}

            <form
              onSubmit={(e) => {
                e.preventDefault()
                iniciarReclamo()
              }}
              className="mt-7"
            >
              <p className="mb-2 text-sm font-medium text-foreground">
                ¿A qué WhatsApp te mandamos el código?
              </p>
              <label
                htmlFor="claim-telefono"
                className="group flex items-center gap-3 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-900 px-4 transition-colors focus-within:bg-zinc-200/70 dark:focus-within:bg-zinc-800 focus-within:ring-2 focus-within:ring-[#FF7A00]/30"
              >
                <span className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500 select-none">
                  <MessageCircle className="h-4 w-4 shrink-0" />
                  <span className="text-base">+54</span>
                  <span className="h-5 w-px bg-zinc-300 dark:bg-zinc-700" />
                </span>
                <input
                  id="claim-telefono"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="9 351 123 4567"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className="flex-1 bg-transparent border-0 outline-none text-base placeholder:text-zinc-400 dark:placeholder:text-zinc-600 w-full min-w-0"
                />
              </label>

              <button
                type="submit"
                disabled={enviando || telefono.replace(/\D/g, '').length < 8}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl h-12 bg-[#FF7A00] hover:bg-[#E66E00] text-white text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-60"
              >
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reclamar mi tienda'}
              </button>
            </form>

            <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <MessageCircle className="h-3.5 w-3.5" />
              Te mandamos un código por WhatsApp para verificar el número.
            </p>
          </>
        ) : (
          <>
            <button
              onClick={() => setPaso('preview')}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
            >
              <ArrowLeft className="h-4 w-4" /> Volver
            </button>

            <div className="text-center mb-8">
              <h1 className="text-2xl font-semibold tracking-tight">Ingresá el código</h1>
              <p className="text-sm text-muted-foreground mt-2">
                Te lo enviamos por WhatsApp
                {telefonoEnmascarado ? (
                  <>
                    {' '}al <span className="font-medium text-foreground">{telefonoEnmascarado}</span>
                  </>
                ) : null}
              </p>
            </div>

            <div className="flex justify-center gap-2 mb-6" dir="ltr">
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    inputsRef.current[index] = el
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  maxLength={CODE_LENGTH}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  disabled={verificando}
                  className="w-12 h-14 text-center text-xl font-semibold rounded-2xl bg-zinc-100 dark:bg-zinc-900 border-0 focus:outline-none focus:ring-2 focus:ring-[#FF7A00] transition-all disabled:opacity-50"
                />
              ))}
            </div>

            <button
              type="button"
              disabled={verificando || codigo.length !== CODE_LENGTH}
              onClick={() => submitCodigo(codigo)}
              className="flex w-full items-center justify-center rounded-2xl h-12 bg-[#FF7A00] hover:bg-[#E66E00] text-white text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {verificando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Entrar a mi tienda'}
            </button>

            <div className="text-center text-sm text-muted-foreground mt-6">
              {cooldown > 0 ? (
                <span>Reenviar código en {cooldown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={reenviar}
                  className="text-[#FF7A00] hover:text-[#E66E00] transition-colors font-medium"
                >
                  Reenviar código
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** Checklist "esto ya está listo": lo que Facu completó tildado (reciprocidad + "faltan dos cositas"). */
function InventarioLista({ inv }: { inv: ClaimInventario }) {
  const items: Array<{ ok: boolean; label: string }> = [
    { ok: inv.productos > 0, label: inv.productos > 0 ? `Menú con ${inv.productos} productos` : 'Cargar el menú' },
    { ok: inv.tieneImagen, label: 'Logo y foto de portada' },
    { ok: inv.tieneCobros, label: 'Cobros activados' },
    { ok: inv.tieneLink, label: 'Tu link para compartir' },
    { ok: inv.zonasDelivery > 0, label: 'Zona de delivery' },
    { ok: inv.primerPedido, label: 'Primer pedido de prueba' },
  ]
  return (
    <ul className="space-y-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 p-4">
      {items.map((it, i) => (
        <li key={i} className="flex items-center gap-3 text-sm">
          {it.ok ? (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            </span>
          ) : (
            <CircleDashed className="h-5 w-5 shrink-0 text-muted-foreground/50" />
          )}
          <span className={it.ok ? 'text-foreground' : 'text-muted-foreground'}>{it.label}</span>
        </li>
      ))}
    </ul>
  )
}

function BloqueoView({ bloqueo, onLogin }: { bloqueo: NonNullable<Bloqueo>; onLogin: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <div className="h-14 w-14 rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
        <Store className="h-6 w-6 text-muted-foreground" />
      </div>
      <h1 className="text-xl font-semibold text-foreground">{bloqueo.titulo}</h1>
      <p className="max-w-[18rem] text-sm text-muted-foreground">{bloqueo.detalle}</p>
      {bloqueo.irALogin && (
        <button
          onClick={onLogin}
          className="mt-3 flex items-center justify-center rounded-2xl h-11 px-6 bg-[#FF7A00] hover:bg-[#E66E00] text-white text-sm font-semibold transition-all active:scale-[0.98]"
        >
          Ir a iniciar sesión
        </button>
      )}
    </div>
  )
}

/** Traduce el 404 con flags del backend al mensaje correcto (y a dónde mandar al dueño). */
function mapBloqueo(e: unknown): Bloqueo {
  if (e instanceof ApiError) {
    if (e.response?.yaReclamada) {
      return {
        titulo: 'Esta tienda ya es tuya',
        detalle: 'Ya reclamaste esta tienda antes. Entrá con tu WhatsApp desde el inicio de sesión.',
        irALogin: true,
      }
    }
    if (e.response?.vencido) {
      return {
        titulo: 'Este link venció',
        detalle: 'Escribinos por WhatsApp y te mandamos uno nuevo para reclamar tu tienda.',
      }
    }
    return { titulo: 'Este link no es válido', detalle: e.message || 'Revisá que el link esté completo.' }
  }
  return { titulo: 'No pudimos cargar la tienda', detalle: 'Probá de nuevo en un momento.' }
}
