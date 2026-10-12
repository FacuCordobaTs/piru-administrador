import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { altaInternaApi, ApiError, isTokenExpired } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { toast } from 'sonner'

const SESSION_KEY = 'piru:alta-interna'

export default function Register() {
  const navigate = useNavigate()
  const [internoToken, setInternoToken] = useState(() => {
    const saved = sessionStorage.getItem(SESSION_KEY)
    return saved && !isTokenExpired(saved) ? saved : null
  })
  const [password, setPassword] = useState('')
  const [telefono, setTelefono] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (loading) return
    setLoading(true)
    try {
      if (!internoToken) {
        const res = await altaInternaApi.login(password)
        sessionStorage.setItem(SESSION_KEY, res.data.token)
        setInternoToken(res.data.token)
        setPassword('')
        return
      }
      const digits = telefono.replace(/\D/g, '')
      const numero = digits.startsWith('54') ? digits : `54${digits}`
      if (!/^\d{10,15}$/.test(numero)) throw new Error('Ingresá un WhatsApp válido con código de área')
      const res = await altaInternaApi.crear(internoToken, numero)
      useRestauranteStore.getState().reset()
      useAuthStore.getState().setAuth(res.token, res.restaurante)
      sessionStorage.setItem(`piru:alta-claim:${res.restaurante.id}`, res.claimUrl)
      toast.success('Tienda lista para configurar')
      navigate('/onboarding', { replace: true })
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        sessionStorage.removeItem(SESSION_KEY)
        setInternoToken(null)
      }
      toast.error(error instanceof Error ? error.message : 'No se pudo crear la tienda')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-dvh bg-background px-6 flex flex-col">
      <header className="w-full max-w-md mx-auto flex items-center justify-between py-7">
        <img src="/logopiru.jpeg" alt="Piru" className="h-9 rounded-xl" />
        <Link to="/login" className="text-sm text-muted-foreground">Ir al login</Link>
      </header>
      <main className="w-full max-w-md mx-auto flex-1 flex flex-col justify-center pb-20">
        <p className="text-sm font-medium text-[#FF7A00] mb-4">Alta interna de tiendas</p>
        <h1 className="text-3xl font-semibold tracking-tight">{internoToken ? 'Creá la próxima tienda' : 'Entrá con tu acceso de interno'}</h1>
        <p className="mt-3 text-muted-foreground">{internoToken ? 'Ingresá el WhatsApp del local y seguí con la configuración. El dueño verifica su número al entrar.' : 'Usá la misma contraseña de interno. Se pide una vez por sesión.'}</p>
        <form onSubmit={submit} className="mt-8 space-y-4">
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
        </form>
      </main>
    </div>
  )
}
