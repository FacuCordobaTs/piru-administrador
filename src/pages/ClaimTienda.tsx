import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router'
import {
  Loader2, Check, Store, MessageCircle, ArrowLeft,
  UtensilsCrossed, Banknote, MapPin, Pencil, ImagePlus,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/authStore'
import { claimApi, restauranteApi, ApiError, type ClaimTienda as ClaimTiendaData, type ClaimInventario } from '@/lib/api'

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
 * tiene hecho y lo aprueba.
 *
 * "Modificar" edita el dato ahí mismo, en la tarjeta. El cambio NO se guarda contra el backend en el
 * momento (todavía no hay sesión): queda en un borrador local (`draft`). Recién cuando el dueño
 * confirma su WhatsApp (y tenemos su token) se persiste TODO el borrador de una sola vez.
 *
 * Solo son editables inline los datos de identidad que el preview trae y `restauranteApi.update`
 * sabe guardar: nombre, link (username) y logo. El menú, los cobros y las zonas se muestran como
 * confirmación ("ya está listo") y se afinan en detalle adentro del panel.
 *
 * Flujo:
 *   1) Recorrido de aprobación (`walk`): intro editable + tarjetas de datos + confirmaciones.
 *   2) Verificación: ingresa su WhatsApp → le mandamos un código.
 *   3) Código (`codigo`): 6 dígitos → guardamos el token → persistimos el borrador → entra a su panel.
 */
type Paso = 'walk' | 'codigo'

// Motivos de link no reclamable, para mostrar el mensaje correcto (y a dónde mandar al dueño).
type Bloqueo = { titulo: string; detalle: string; irALogin?: boolean } | null

// ── Tarjeta del recorrido ──
// 'intro'     → portada + nombre (editable inline).
// 'link'      → link público (editable inline).
// 'logo'      → logo (editable inline, subiendo una imagen).
// 'reassure'  → dato agregado ya hecho (menú/cobros/delivery), solo confirmación.
// 'verificar' → el WhatsApp para reclamar (única pantalla que sí pide un dato nuevo).
type Card =
  | { kind: 'intro' }
  | { kind: 'link' }
  | { kind: 'logo' }
  | { kind: 'reassure'; id: string; icon: LucideIcon; titulo: string; valor: string }
  | { kind: 'verificar' }

// Borrador local de las ediciones. Vacío = sin cambios; se persiste al confirmar el WhatsApp.
type Draft = { nombre?: string; username?: string; logo?: string }

// Convierte un texto en slug de URL: minúsculas, sin acentos, sólo alfanumérico.
const toSlug = (v: string) =>
  (v || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')

// Redimensiona una imagen a máx. 800px por lado y la exporta como JPEG (mantiene liviano el borrador).
async function fileToLogoDataUrl(file: File, maxDim = 800, quality = 0.85): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = dataUrl
  })
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', quality)
}

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

  // Borrador de ediciones inline (nombre/link/logo), se persiste al confirmar el WhatsApp.
  const [draft, setDraft] = useState<Draft>({})
  // Qué tarjeta está en modo edición (por kind: 'intro' | 'link' | 'logo'), y el buffer del editor.
  const [editing, setEditing] = useState<string | null>(null)
  const [tmpText, setTmpText] = useState('')
  const [tmpLogo, setTmpLogo] = useState<string | null>(null)
  const [subiendoLogo, setSubiendoLogo] = useState(false)

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

  // Valores mostrados: el borrador pisa lo que vino del backend.
  const dispNombre = draft.nombre ?? tienda?.nombre ?? ''
  const dispUsername = draft.username ?? tienda?.username ?? ''
  const dispLogo = draft.logo ?? tienda?.imagenUrl ?? tienda?.imagenLightUrl ?? null

  // ── Recorrido: portada + link + logo + una confirmación por dato agregado + verificación ──
  const cards = useMemo<Card[]>(() => {
    if (!tienda) return []
    const inv = inventario
    const list: Card[] = [{ kind: 'intro' }]

    if (inv?.tieneLink && tienda.username) list.push({ kind: 'link' })
    if (inv?.tieneImagen) list.push({ kind: 'logo' })

    if ((inv?.productos ?? 0) > 0) {
      const n = inv!.productos
      list.push({
        kind: 'reassure', id: 'menu', icon: UtensilsCrossed,
        titulo: 'Tu menú ya está cargado',
        valor: `${n} ${n === 1 ? 'producto listo' : 'productos listos'} para vender`,
      })
    }
    if (inv?.tieneCobros) {
      list.push({
        kind: 'reassure', id: 'cobros', icon: Banknote,
        titulo: 'Tus cobros están activados',
        valor: 'Podés cobrar online y en efectivo',
      })
    }
    if ((inv?.zonasDelivery ?? 0) > 0) {
      const n = inv!.zonasDelivery
      list.push({
        kind: 'reassure', id: 'delivery', icon: MapPin,
        titulo: 'Tu zona de delivery',
        valor: `${n} ${n === 1 ? 'zona de reparto' : 'zonas de reparto'} lista${n === 1 ? '' : 's'}`,
      })
    }

    list.push({ kind: 'verificar' })
    return list
  }, [tienda, inventario])

  const card = cards[cardIdx]

  const goCard = (i: number) => {
    setEditing(null)
    setCardIdx(Math.max(0, Math.min(i, cards.length - 1)))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const continuar = () => goCard(cardIdx + 1)

  // ── Editor inline ──
  const abrirEditor = (kind: 'intro' | 'link' | 'logo') => {
    if (kind === 'intro') setTmpText(dispNombre)
    if (kind === 'link') setTmpText(dispUsername)
    if (kind === 'logo') setTmpLogo(dispLogo)
    setEditing(kind)
  }
  const cancelarEditor = () => setEditing(null)

  const guardarNombre = () => {
    const v = tmpText.trim()
    if (v.length < 2) return toast.error('El nombre es muy corto')
    setDraft((d) => ({ ...d, nombre: v }))
    setEditing(null)
  }
  const guardarLink = () => {
    const slug = toSlug(tmpText)
    if (slug.length < 3) return toast.error('El link necesita al menos 3 letras o números')
    setDraft((d) => ({ ...d, username: slug }))
    setEditing(null)
  }
  const elegirLogo = async (files: FileList | null) => {
    const f = files?.[0]
    if (!f || !f.type.startsWith('image/')) return
    setSubiendoLogo(true)
    try {
      setTmpLogo(await fileToLogoDataUrl(f))
    } catch {
      toast.error('No se pudo procesar la imagen')
    } finally {
      setSubiendoLogo(false)
    }
  }
  const guardarLogo = () => {
    if (!tmpLogo) return toast.error('Elegí una imagen')
    setDraft((d) => ({ ...d, logo: tmpLogo }))
    setEditing(null)
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

  // Persiste el borrador de ediciones inline con el token recién obtenido. Best-effort: si algo
  // falla igual lo dejamos entrar (puede reintentar los cambios desde Ajustes).
  const persistirDraft = async (nuevoToken: string) => {
    const payload: Record<string, string> = {}
    if (draft.nombre !== undefined) payload.nombre = draft.nombre
    if (draft.username !== undefined) payload.username = draft.username
    if (draft.logo !== undefined) {
      payload.image = draft.logo
      payload.imageLight = draft.logo
    }
    if (Object.keys(payload).length === 0) return
    try {
      await restauranteApi.update(nuevoToken, payload)
    } catch {
      toast.error('Guardamos tu tienda, pero algún cambio no se aplicó', {
        description: 'Revisalo desde Ajustes cuando entres.',
      })
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
        // Con el token en mano, aplicamos todo lo que tocó en el recorrido, de una sola vez.
        await persistirDraft(r.token)
        // Copys del efecto dotación, nunca "cuenta creada".
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
    // persistirDraft depende de `draft`; lo incluimos vía closure con la referencia actual.
    [verificationId, token, setAuth, navigate, draft],
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

  const codigo = digits.join('')
  const progress = cards.length > 0 ? ((cardIdx + 1) / cards.length) * 100 : 0

  // Botones de una tarjeta editable: Continuar (primario) + Modificar (secundario).
  const AccionesDato = ({ onModificar, primary }: { onModificar: () => void; primary?: string }) => (
    <>
      <button
        onClick={continuar}
        className="w-full h-14 mt-7 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white active:scale-[0.985] transition-all"
      >
        {primary ?? 'Continuar'}
      </button>
      <button
        onClick={onModificar}
        className="w-full h-11 mt-2.5 rounded-2xl text-[14px] font-medium text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors flex items-center justify-center gap-1.5"
      >
        <Pencil className="h-3.5 w-3.5" /> Modificar
      </button>
    </>
  )

  // Botones del editor inline: Guardar (primario) + Cancelar (secundario).
  const AccionesEditor = ({ onGuardar, disabled }: { onGuardar: () => void; disabled?: boolean }) => (
    <>
      <button
        onClick={onGuardar}
        disabled={disabled}
        className="w-full h-14 mt-6 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white active:scale-[0.985] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
      >
        <Check className="h-4 w-4" /> Guardar cambio
      </button>
      <button
        onClick={cancelarEditor}
        className="w-full h-11 mt-2.5 rounded-2xl text-[14px] font-medium text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
      >
        Cancelar
      </button>
    </>
  )

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

            {/* ── Portada + nombre (editable) ── */}
            {card?.kind === 'intro' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-400 text-center flex flex-col items-center">
                {dispLogo ? (
                  <img
                    src={dispLogo}
                    alt={dispNombre || 'Tu tienda'}
                    className="h-20 w-20 rounded-2xl object-cover shadow-sm ring-1 ring-border"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
                    <Store className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}

                {editing === 'intro' ? (
                  <div className="w-full mt-6">
                    <p className="text-sm text-muted-foreground mb-2 text-left">El nombre de tu local</p>
                    <input
                      autoFocus
                      value={tmpText}
                      onChange={(e) => setTmpText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && guardarNombre()}
                      placeholder="Burger Bros"
                      className="w-full h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border-0 px-4 text-lg font-semibold outline-none focus:ring-2 focus:ring-[#FF7A00]/30 transition-shadow"
                    />
                    <AccionesEditor onGuardar={guardarNombre} disabled={tmpText.trim().length < 2} />
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground mt-6">Esta tienda es de</p>
                    <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-tight mt-1">
                      {dispNombre || 'tu local'}
                    </h1>
                    <p className="text-[15px] text-muted-foreground mt-4 max-w-xs">
                      Ya la dejamos armada y lista para vender. Mirá lo que hay hecho y, si algo no te
                      cierra, lo cambiás acá mismo.
                    </p>
                    <AccionesDato onModificar={() => abrirEditor('intro')} primary="Ver mi tienda" />
                  </>
                )}
              </div>
            )}

            {/* ── Link público (editable) ── */}
            {card?.kind === 'link' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-400 flex flex-col items-center text-center">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3.5 w-3.5" /> Ya está listo
                </span>
                <h1 className="text-[1.9rem] leading-[1.12] font-semibold tracking-tight mt-2">
                  Tu link para compartir
                </h1>

                {editing === 'link' ? (
                  <div className="w-full mt-6">
                    <div className="flex items-center h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-900 px-4 focus-within:ring-2 focus-within:ring-[#FF7A00]/30 transition-shadow font-mono">
                      <span className="text-muted-foreground/60 text-base select-none">my.piru.app/</span>
                      <input
                        autoFocus
                        value={tmpText}
                        onChange={(e) => setTmpText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && guardarLink()}
                        placeholder="tulocal"
                        className="flex-1 bg-transparent border-0 outline-none text-base font-semibold text-[#FF7A00] min-w-0"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 text-left">
                      Quedará como <span className="font-mono">my.piru.app/{toSlug(tmpText) || 'tulocal'}</span>
                    </p>
                    <AccionesEditor onGuardar={guardarLink} disabled={toSlug(tmpText).length < 3} />
                  </div>
                ) : (
                  <>
                    <div className="mt-6 w-full rounded-2xl bg-zinc-100 dark:bg-zinc-900 px-4 py-4 text-base font-mono">
                      <span className="text-muted-foreground/60">my.piru.app/</span>
                      <span className="font-semibold text-[#FF7A00]">{dispUsername}</span>
                    </div>
                    <AccionesDato onModificar={() => abrirEditor('link')} />
                  </>
                )}
              </div>
            )}

            {/* ── Logo (editable) ── */}
            {card?.kind === 'logo' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-400 flex flex-col items-center text-center">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3.5 w-3.5" /> Ya está listo
                </span>
                <h1 className="text-[1.9rem] leading-[1.12] font-semibold tracking-tight mt-2">
                  Tu logo
                </h1>

                {editing === 'logo' ? (
                  <div className="w-full mt-6 flex flex-col items-center">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => { elegirLogo(e.target.files); e.currentTarget.value = '' }}
                      />
                      <div className="relative h-28 w-28 rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-900 ring-1 ring-border flex items-center justify-center group">
                        {tmpLogo ? (
                          <img src={tmpLogo} alt="Nuevo logo" className="h-full w-full object-cover" />
                        ) : (
                          <ImagePlus className="h-7 w-7 text-muted-foreground" />
                        )}
                        {subiendoLogo && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <Loader2 className="h-5 w-5 animate-spin text-white" />
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-black/50 text-white text-[11px] py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          Cambiar
                        </div>
                      </div>
                    </label>
                    <p className="text-xs text-muted-foreground mt-3">Tocá la imagen para elegir otra · JPG o PNG</p>
                    <div className="w-full">
                      <AccionesEditor onGuardar={guardarLogo} disabled={!tmpLogo || subiendoLogo} />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mt-6 h-28 w-28 rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-900 ring-1 ring-border flex items-center justify-center">
                      {dispLogo ? (
                        <img src={dispLogo} alt="Logo" className="h-full w-full object-cover" />
                      ) : (
                        <Store className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-[15px] text-muted-foreground mt-4">Tu marca ya está puesta en la tienda.</p>
                    <AccionesDato onModificar={() => abrirEditor('logo')} />
                  </>
                )}
              </div>
            )}

            {/* ── Confirmación de datos agregados (menú/cobros/delivery) ── */}
            {card?.kind === 'reassure' && (
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
                <div className="mt-6 w-full rounded-2xl bg-zinc-100 dark:bg-zinc-900 px-4 py-4 text-base font-medium text-foreground">
                  {card.valor}
                </div>
                <p className="text-xs text-muted-foreground mt-3">Lo afinás en detalle cuando entres a tu panel.</p>
                <button
                  onClick={continuar}
                  className="w-full h-14 mt-7 rounded-2xl text-[15px] font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white active:scale-[0.985] transition-all"
                >
                  Continuar
                </button>
              </div>
            )}

            {/* ── Verificación del WhatsApp ── */}
            {card?.kind === 'verificar' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-400">
                <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-tight">
                  Reclamá tu tienda
                </h1>
                <p className="text-[15px] text-muted-foreground mt-3">
                  Poné tu WhatsApp: te mandamos un código y la tienda queda a tu nombre
                  {Object.keys(draft).length > 0 ? ', con tus cambios aplicados.' : '.'}
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
