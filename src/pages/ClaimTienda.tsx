import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router'
import {
  Loader2, Check, Store, MessageCircle, ArrowLeft, ArrowRight,
  Link2, UtensilsCrossed, Image as ImageIcon, Banknote, MapPin, Pencil,
  type LucideIcon,
} from 'lucide-react'
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
 *
 * A diferencia del onboarding self-serve (`Onboarding.tsx`), acá NO se le pregunta cada dato: se le
 * MUESTRA cada dato ya completado, una cosa por pantalla, con dos botones — "Continuar" (primario,
 * "está perfecto, seguí") y "Modificar" (secundario). Es el efecto dotación: recorre lo que ya
 * tiene hecho y lo aprueba. Recién al final verifica su WhatsApp para reclamar la tienda.
 *
 * "Modificar" no edita acá (no hay sesión todavía): recuerda qué sección quiso cambiar, manda a
 * verificar el WhatsApp y, una vez adentro, lo deja parado en esa pantalla de ajustes.
 *
 * Flujo:
 *   1) Recorrido de aprobación (`walk`): intro + una tarjeta por dato ya cargado.
 *   2) Verificación: ingresa su WhatsApp → le mandamos un código.
 *   3) Código (`codigo`): 6 dígitos → guardamos el token → entra a su panel (o a lo que quiso modificar).
 */
type Paso = 'walk' | 'codigo'

// Motivos de link no reclamable, para mostrar el mensaje correcto (y a dónde mandar al dueño).
type Bloqueo = { titulo: string; detalle: string; irALogin?: boolean } | null

// ── Tarjeta del recorrido de aprobación ──
// 'intro'     → portada: "esta tienda es de [Local]".
// 'data'      → un dato ya completado, con Continuar/Modificar.
// 'verificar' → el WhatsApp para reclamar (única pantalla que sí pide un dato).
type Card =
  | { kind: 'intro' }
  | {
      kind: 'data'
      id: string
      icon: LucideIcon
      titulo: string
      valor: string
      mono?: boolean
      editPath: string
    }
  | { kind: 'verificar' }

export default function ClaimTienda() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [loading, setLoading] = useState(true)
  const [bloqueo, setBloqueo] = useState<Bloqueo>(null)
  const [tienda, setTienda] = useState<ClaimTiendaData | null>(null)
  const [inventario, setInventario] = useState<ClaimInventario | null>(null)

  const [paso, setPaso] = useState<Paso>('walk')
  const [cardIdx, setCardIdx] = useState(0)
  const [enviando, setEnviando] = useState(false)

  // Si el dueño tocó "Modificar" en algún dato, lo llevamos a esa pantalla apenas entre.
  const [pendingEdit, setPendingEdit] = useState<string | null>(null)

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

  // ── Recorrido: portada + una tarjeta por dato ya cargado (solo lo que existe) + verificación ──
  const cards = useMemo<Card[]>(() => {
    if (!tienda) return []
    const inv = inventario
    const list: Card[] = [{ kind: 'intro' }]

    if (inv?.tieneLink && tienda.username) {
      list.push({
        kind: 'data', id: 'link', icon: Link2,
        titulo: 'Tu link para compartir',
        valor: `my.piru.app/${tienda.username}`,
        mono: true,
        editPath: '/dashboard/ajustes/general',
      })
    }
    if ((inv?.productos ?? 0) > 0) {
      const n = inv!.productos
      list.push({
        kind: 'data', id: 'menu', icon: UtensilsCrossed,
        titulo: 'Tu menú ya está cargado',
        valor: `${n} ${n === 1 ? 'producto listo' : 'productos listos'} para vender`,
        editPath: '/dashboard/productos',
      })
    }
    if (inv?.tieneImagen) {
      list.push({
        kind: 'data', id: 'imagen', icon: ImageIcon,
        titulo: 'Tu logo y tu portada',
        valor: 'Tu marca ya está puesta en la tienda',
        editPath: '/dashboard/ajustes/general',
      })
    }
    if (inv?.tieneCobros) {
      list.push({
        kind: 'data', id: 'cobros', icon: Banknote,
        titulo: 'Tus cobros están activados',
        valor: 'Podés cobrar online y en efectivo',
        editPath: '/dashboard/ajustes/pagos',
      })
    }
    if ((inv?.zonasDelivery ?? 0) > 0) {
      const n = inv!.zonasDelivery
      list.push({
        kind: 'data', id: 'delivery', icon: MapPin,
        titulo: 'Tu zona de delivery',
        valor: `${n} ${n === 1 ? 'zona de reparto' : 'zonas de reparto'} lista${n === 1 ? '' : 's'}`,
        editPath: '/dashboard/ajustes/entregas',
      })
    }

    list.push({ kind: 'verificar' })
    return list
  }, [tienda, inventario])

  const verificarIdx = useMemo(() => cards.findIndex((c) => c.kind === 'verificar'), [cards])
  const card = cards[cardIdx]

  const goCard = (i: number) => {
    setCardIdx(Math.max(0, Math.min(i, cards.length - 1)))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const continuar = () => goCard(cardIdx + 1)
  // "Modificar": recordamos a dónde llevarlo adentro y saltamos directo a verificar su WhatsApp.
  const modificar = (editPath: string) => {
    setPendingEdit(editPath)
    goCard(verificarIdx)
  }

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
        // El token queda guardado. Si el dueño tocó "Modificar", lo dejamos parado en esa pantalla;
        // si no, va a su panel. Copys del efecto dotación, nunca "cuenta creada".
        toast.success('¡Tu tienda es tuya! 🎉')
        navigate(pendingEdit ?? '/dashboard', { replace: true })
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
    [verificationId, token, setAuth, navigate, pendingEdit],
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
  const progress = cards.length > 0 ? ((cardIdx + 1) / cards.length) * 100 : 0

  return (
    <div className="min-h-dvh flex items-center justify-center w-full bg-background px-6 selection:bg-orange-500/10 selection:text-[#FF7A00]">
      <div className="w-full max-w-sm animate-in fade-in duration-500">
        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : bloqueo ? (
          <BloqueoView bloqueo={bloqueo} onLogin={() => navigate('/login', { replace: true })} />
        ) : paso === 'walk' ? (
          <>
            {/* Barra de progreso del recorrido (sutil, no numerada) */}
            <div className="h-1 w-full rounded-full bg-zinc-100 dark:bg-zinc-900 mb-8 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#FF7A00] transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Volver, salvo en la portada */}
            {cardIdx > 0 && (
              <button
                onClick={() => goCard(cardIdx - 1)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
              >
                <ArrowLeft className="h-4 w-4" /> Volver
              </button>
            )}

            {card?.kind === 'intro' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-400 text-center flex flex-col items-center">
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

                <p className="text-sm text-muted-foreground mt-6">Esta tienda es de</p>
                <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-tight mt-1">
                  {tienda?.nombre ?? 'tu local'}
                </h1>
                <p className="text-[15px] text-muted-foreground mt-4 max-w-xs">
                  Ya la dejamos armada y lista para vender. Mirá lo que hay hecho y, si algo no te
                  cierra, lo cambiás.
                </p>

                <button
                  onClick={continuar}
                  className="w-full h-14 mt-8 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white active:scale-[0.985] transition-all flex items-center justify-center gap-2"
                >
                  Ver mi tienda <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {card?.kind === 'data' && (
              <div key={card.id} className="animate-in fade-in slide-in-from-bottom-2 duration-400 flex flex-col items-center text-center">
                <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center ring-1 ring-emerald-500/15">
                  <card.icon className="h-6 w-6 text-emerald-600 dark:text-emerald-400" strokeWidth={2} />
                </div>

                <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3.5 w-3.5" /> Ya está listo
                </span>
                <h1 className="text-[1.9rem] leading-[1.12] font-semibold tracking-tight mt-2">
                  {card.titulo}
                </h1>

                <div
                  className={`mt-6 w-full rounded-2xl bg-zinc-100 dark:bg-zinc-900 px-4 py-4 text-base ${
                    card.mono ? 'font-mono' : 'font-medium'
                  }`}
                >
                  {card.mono ? (
                    <>
                      <span className="text-muted-foreground/60">my.piru.app/</span>
                      <span className="font-semibold text-[#FF7A00]">
                        {card.valor.replace('my.piru.app/', '')}
                      </span>
                    </>
                  ) : (
                    <span className="text-foreground">{card.valor}</span>
                  )}
                </div>

                <button
                  onClick={continuar}
                  className="w-full h-14 mt-7 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white active:scale-[0.985] transition-all"
                >
                  {cardIdx === verificarIdx - 1 ? 'Está perfecto, reclamar mi tienda' : 'Está perfecto, seguir'}
                </button>
                <button
                  onClick={() => modificar(card.editPath)}
                  className="w-full h-11 mt-2.5 rounded-2xl text-[14px] font-medium text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Pencil className="h-3.5 w-3.5" /> Modificar
                </button>
              </div>
            )}

            {card?.kind === 'verificar' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-400">
                <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-tight">
                  Reclamá tu tienda
                </h1>
                <p className="text-[15px] text-muted-foreground mt-3">
                  {pendingEdit
                    ? 'Verificá tu WhatsApp y te llevamos directo a cambiar lo que quieras.'
                    : 'Poné tu WhatsApp: te mandamos un código y la tienda queda a tu nombre.'}
                </p>

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
                      autoFocus
                      placeholder="9 351 123 4567"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      className="flex-1 bg-transparent border-0 outline-none text-base placeholder:text-zinc-400 dark:placeholder:text-zinc-600 w-full min-w-0"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={enviando || telefono.replace(/\D/g, '').length < 8}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl h-14 bg-[#FF7A00] hover:bg-[#E66E00] text-white text-[15px] font-semibold transition-all active:scale-[0.985] disabled:opacity-40"
                  >
                    {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reclamar mi tienda'}
                  </button>
                </form>

                <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <MessageCircle className="h-3.5 w-3.5" />
                  Te mandamos un código por WhatsApp para verificar el número.
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            <button
              onClick={() => setPaso('walk')}
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
