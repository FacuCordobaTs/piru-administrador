import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { FileJson, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { altaInternaApi, altaJsonKey, ApiError, isTokenExpired } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { toast } from 'sonner'

const SESSION_KEY = 'piru:alta-interna'

/** Teléfono del JSON: misma normalización que el backend (54 + 9 + área + número). */
function normalizarTelefono(valor: string): string | null {
  let digitos = valor.replace(/\D/g, '')
  if (!digitos) return null
  if (digitos.startsWith('00')) digitos = digitos.slice(2)
  if (digitos.startsWith('0')) digitos = digitos.slice(1)
  if (!digitos.startsWith('54')) digitos = `54${digitos}`
  if (!digitos.startsWith('549')) digitos = `549${digitos.slice(2)}`
  return /^\d{12,13}$/.test(digitos) ? digitos : null
}

type JsonAlta = { texto: string; nombreArchivo: string; nombreLocal: string | null; telefono: string | null }

function leerJsonAlta(texto: string, nombreArchivo: string): JsonAlta {
  let parsed: unknown
  try { parsed = JSON.parse(texto) } catch { throw new Error('El archivo no es un JSON válido') }
  const raiz = parsed && typeof parsed === 'object' && 'carta' in parsed ? (parsed as { carta: unknown }).carta : parsed
  const negocio = (raiz as { negocio?: { nombre?: unknown; telefono?: unknown } } | null)?.negocio
  if (!raiz || typeof raiz !== 'object' || !Array.isArray((raiz as { categorias?: unknown }).categorias)) {
    throw new Error('El JSON no tiene "categorias". Usá el instructivo de la carta.')
  }
  return {
    texto, nombreArchivo,
    nombreLocal: typeof negocio?.nombre === 'string' ? negocio.nombre : null,
    telefono: typeof negocio?.telefono === 'string' ? normalizarTelefono(negocio.telefono) : null,
  }
}

export default function Register() {
  const navigate = useNavigate()
  const [internoToken, setInternoToken] = useState(() => {
    const saved = sessionStorage.getItem(SESSION_KEY)
    return saved && !isTokenExpired(saved) ? saved : null
  })
  const [password, setPassword] = useState('')
  const [telefono, setTelefono] = useState('')
  const [jsonAlta, setJsonAlta] = useState<JsonAlta | null>(null)
  // Sin JSON (o JSON sin teléfono) se carga el WhatsApp a mano.
  const [manual, setManual] = useState(false)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const salirPorToken = (error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      sessionStorage.removeItem(SESSION_KEY)
      setInternoToken(null)
    }
    toast.error(error instanceof Error ? error.message : 'No se pudo crear la tienda')
  }

  const crearTienda = async (numero: string, json: JsonAlta | null) => {
    if (!internoToken) return
    setLoading(true)
    try {
      const res = await altaInternaApi.crear(internoToken, numero)
      useRestauranteStore.getState().reset()
      useAuthStore.getState().setAuth(res.token, res.restaurante)
      sessionStorage.setItem(`piru:alta-claim:${res.restaurante.id}`, res.claimUrl)
      if (json) {
        try { sessionStorage.setItem(altaJsonKey(res.restaurante.id), json.texto) }
        catch { toast.warning('El JSON es muy grande para precargarlo; importalo en el paso de la carta') }
      }
      toast.success('Tienda lista para configurar')
      navigate('/onboarding', { replace: true })
    } catch (error) {
      salirPorToken(error)
    } finally { setLoading(false) }
  }

  const elegirArchivo = async (file: File | undefined) => {
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast.error('El archivo supera los 2 MB'); return }
    try {
      const json = leerJsonAlta(await file.text(), file.name)
      setJsonAlta(json)
      if (json.telefono) {
        await crearTienda(json.telefono, json)
      } else {
        setManual(true)
        toast.info('El JSON no trae teléfono', { description: 'Ingresá el WhatsApp del local para crear la tienda.' })
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo leer el archivo')
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (loading) return
    if (!internoToken) {
      setLoading(true)
      try {
        const res = await altaInternaApi.login(password)
        sessionStorage.setItem(SESSION_KEY, res.data.token)
        setInternoToken(res.data.token)
        setPassword('')
      } catch (error) {
        salirPorToken(error)
      } finally { setLoading(false) }
      return
    }
    const digits = telefono.replace(/\D/g, '')
    const numero = digits.startsWith('54') ? digits : `54${digits}`
    if (!/^\d{10,15}$/.test(numero)) { toast.error('Ingresá un WhatsApp válido con código de área'); return }
    await crearTienda(numero, jsonAlta)
  }

  const pidiendoJson = internoToken && !manual

  return (
    <div className="min-h-dvh bg-background px-6 flex flex-col">
      <header className="w-full max-w-md mx-auto flex items-center justify-between py-7">
        <img src="/logopiru.jpeg" alt="Piru" className="h-9 rounded-xl" />
        <Link to="/login" className="text-sm text-muted-foreground">Ir al login</Link>
      </header>
      <main className="w-full max-w-md mx-auto flex-1 flex flex-col justify-center pb-20">
        <p className="text-sm font-medium text-[#FF7A00] mb-4">Alta interna de tiendas</p>
        <h1 className="text-3xl font-semibold tracking-tight">{internoToken ? 'Creá la próxima tienda' : 'Entrá con tu acceso de interno'}</h1>
        <p className="mt-3 text-muted-foreground">
          {!internoToken
            ? 'Usá la misma contraseña de interno. Se pide una vez por sesión.'
            : pidiendoJson
              ? 'Subí el JSON del local. Si trae el WhatsApp, la tienda se crea sola con la carta, el logo y la dirección.'
              : 'Ingresá el WhatsApp del local y seguí con la configuración. El dueño verifica su número al entrar.'}
        </p>

        {pidiendoJson ? (
          <div className="mt-8 space-y-4">
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden"
              onChange={(e) => { void elegirArchivo(e.target.files?.[0]); e.currentTarget.value = '' }} />
            <button type="button" disabled={loading} onClick={() => fileRef.current?.click()}
              className="w-full rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-[#FF7A00]/60 px-6 py-10 flex flex-col items-center gap-3 transition-colors disabled:opacity-60">
              {loading ? <Loader2 className="h-7 w-7 animate-spin text-[#FF7A00]" /> : <FileJson className="h-7 w-7 text-[#FF7A00]" />}
              <span className="text-sm font-semibold">{loading ? 'Creando tienda…' : 'Subí el archivo .json del local'}</span>
              <span className="text-xs text-muted-foreground">El que armó la IA con el instructivo de la carta</span>
            </button>
            <button type="button" onClick={() => setManual(true)} className="w-full text-sm text-muted-foreground hover:text-foreground">
              No tengo JSON, cargar el WhatsApp a mano
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-4">
            {internoToken && jsonAlta && (
              <p className="rounded-2xl bg-zinc-100 dark:bg-zinc-900 px-4 py-3 text-sm">
                <span className="font-medium">{jsonAlta.nombreLocal || jsonAlta.nombreArchivo}</span>
                <span className="text-muted-foreground"> · se precarga al configurar</span>
              </p>
            )}
            <label className="block text-sm font-medium">
              {internoToken ? 'WhatsApp del local' : 'Contraseña de interno'}
              <Input key={internoToken ? 'phone' : 'password'} autoFocus type={internoToken ? 'tel' : 'password'}
                autoComplete={internoToken ? 'tel' : 'current-password'}
                placeholder={internoToken ? '+54 9 351 123 4567' : 'Contraseña'}
                value={internoToken ? telefono : password}
                onChange={(e) => internoToken ? setTelefono(e.target.value) : setPassword(e.target.value)}
                className="mt-2 h-14 rounded-2xl text-base" />
            </label>
            <Button type="submit" disabled={loading || (internoToken ? telefono.replace(/\D/g, '').length < 8 : !password)} className="w-full h-14 rounded-2xl bg-[#FF7A00] hover:bg-[#E66E00] text-white">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : internoToken ? 'Crear tienda y configurar' : 'Entrar'}
            </Button>
            {internoToken && (
              <button type="button" onClick={() => setManual(false)} className="w-full text-sm text-muted-foreground hover:text-foreground">
                {jsonAlta ? 'Elegir otro JSON' : 'Tengo el JSON del local'}
              </button>
            )}
          </form>
        )}
      </main>
    </div>
  )
}
