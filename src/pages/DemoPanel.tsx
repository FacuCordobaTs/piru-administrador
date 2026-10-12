import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Loader2, MessageCircle } from 'lucide-react'
import { ApiError, demoPanelApi, esSesionDemo, isTokenExpired, restauranteApi } from '@/lib/api'
import { whatsappDemo } from '@/lib/recorridoPanel'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore, type RestauranteData } from '@/store/restauranteStore'

type Estado =
  | { tipo: 'cargando' }
  /** Ya hay una sesión de otro local abierta en este navegador: no se la pisa sin preguntar. */
  | { tipo: 'confirmar'; local: string | null }
  | { tipo: 'error'; codigo: string | null; mensaje: string }

const MENSAJES: Record<string, { titulo: string; texto: string }> = {
  demo_cerrada: {
    titulo: 'Esta tienda ya tiene dueño',
    texto: 'La demo terminó porque la tienda ya fue reclamada. Entrá con tu cuenta para ver tu panel.',
  },
  en_construccion: {
    titulo: 'Estamos terminando de armarla',
    texto: 'Tu tienda todavía no está lista para mostrarse. Volvé a probar en un rato.',
  },
  tienda_no_encontrada: {
    titulo: 'No encontramos esa tienda',
    texto: 'Revisá el link que te mandamos: puede que le falte una parte.',
  },
  demasiados_intentos: {
    titulo: 'Demasiados intentos',
    texto: 'Esperá unos minutos y volvé a abrir el link.',
  },
}

/**
 * La demo de prospección: el botón "Ver tu panel de administrador" de la tienda (`/:username?demo`)
 * abre esta pantalla. Pide la sesión de la demo de ese local —sin login— y entra al panel, donde el
 * recorrido de bienvenida se abre solo. Si el local ya tiene dueño, lo manda a entrar con su cuenta.
 * Fuera de ProtectedLayout y GuestLayout, igual que `/acceso-interno`: tiene que poder reemplazar una
 * sesión abierta (con confirmación).
 */
export default function DemoPanel() {
  const { username = '' } = useParams()
  const navigate = useNavigate()
  const ejecutado = useRef(false)
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' })

  async function entrar() {
    setEstado({ tipo: 'cargando' })
    try {
      const sesion = await demoPanelApi.sesion(username)
      const respuesta = (await restauranteApi.getProfile(sesion.token)) as {
        success: boolean
        data?: { restaurante?: RestauranteData | RestauranteData[] }
      }
      const delPerfil = respuesta.data?.restaurante
      const restaurante = Array.isArray(delPerfil) ? delPerfil[0] : delPerfil
      if (!respuesta.success || !restaurante) throw new Error('No se pudo cargar el local')
      useRestauranteStore.getState().reset()
      useAuthStore.getState().setAuth(sesion.token, restaurante)
      navigate('/dashboard', { replace: true })
    } catch (error) {
      const codigo = error instanceof ApiError && typeof error.response?.code === 'string' ? error.response.code : null
      setEstado({
        tipo: 'error',
        codigo,
        mensaje: error instanceof Error ? error.message : 'No pudimos abrir el panel.',
      })
    }
  }

  useEffect(() => {
    if (ejecutado.current) return
    ejecutado.current = true
    const { token, restaurante } = useAuthStore.getState()
    const vigente = Boolean(token) && !isTokenExpired(token!)
    if (vigente && esSesionDemo(token)) {
      // Ya está adentro de esta demo (o de otra, que se reemplaza sin preguntar: es de prueba).
      if (restaurante?.username?.toLowerCase() === username.toLowerCase()) {
        navigate('/dashboard', { replace: true })
        return
      }
    } else if (vigente) {
      setEstado({ tipo: 'confirmar', local: restaurante?.nombre ?? null })
      return
    }
    void entrar()
    // Una sola vez por visita: `username` no cambia mientras la pantalla está montada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const info = estado.tipo === 'error' ? (estado.codigo ? MENSAJES[estado.codigo] : undefined) : undefined

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6">
      <div className="max-w-sm text-center">
        <img src="/logopiru.jpeg" alt="Piru" className="mx-auto mb-5 h-12 w-auto rounded-xl" />

        {estado.tipo === 'cargando' && (
          <>
            <h1 className="text-lg font-semibold">Abriendo tu panel…</h1>
            <p className="mt-2 text-sm text-muted-foreground">Estamos preparando la demo con tu carta.</p>
            <Loader2 className="mx-auto mt-5 h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
          </>
        )}

        {estado.tipo === 'confirmar' && (
          <>
            <h1 className="text-lg font-semibold">Ya tenés una sesión abierta</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              En este navegador está abierto {estado.local ? <strong>{estado.local}</strong> : 'otro local'}. Abrir la
              demo cierra esa sesión.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => void entrar()}
                className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
              >
                Abrir la demo
              </button>
              <Link
                to="/dashboard"
                replace
                className="inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold text-muted-foreground hover:text-foreground"
              >
                Quedarme en mi sesión
              </Link>
            </div>
          </>
        )}

        {estado.tipo === 'error' && (
          <>
            <h1 className="text-lg font-semibold">{info?.titulo ?? 'No pudimos abrir el panel'}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{info?.texto ?? estado.mensaje}</p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
              {estado.codigo === 'demo_cerrada' ? (
                <Link
                  to="/login"
                  className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
                >
                  Entrar con mi cuenta
                </Link>
              ) : (
                estado.codigo !== 'tienda_no_encontrada' && (
                  <button
                    type="button"
                    onClick={() => void entrar()}
                    className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
                  >
                    Reintentar
                  </button>
                )
              )}
              <a
                href={whatsappDemo(null)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-muted-foreground hover:text-foreground"
              >
                <MessageCircle className="h-4 w-4" />
                Escribirle a Facu
              </a>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
