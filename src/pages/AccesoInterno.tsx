import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { restauranteApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore, type RestauranteData } from '@/store/restauranteStore'

/** Consume el JWT corto emitido por interno/. El token sólo existe en el hash y se borra enseguida. */
export default function AccesoInterno() {
  const navigate = useNavigate()
  const ejecutado = useRef(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (ejecutado.current) return
    ejecutado.current = true

    const token = new URLSearchParams(window.location.hash.slice(1)).get('token')
    window.history.replaceState(null, '', '/acceso-interno')

    if (!token) {
      setError('El link temporal no contiene una sesión válida.')
      return
    }

    void (async () => {
      try {
        const response = await restauranteApi.getProfile(token) as {
          success: boolean
          data?: { restaurante?: RestauranteData[] }
        }
        const restaurante = response.data?.restaurante?.[0]
        if (!response.success || !restaurante) throw new Error('No se pudo cargar el local')

        useRestauranteStore.getState().reset()
        useAuthStore.getState().setAuth(token, restaurante)
        navigate('/dashboard', { replace: true })
      } catch {
        setError('El acceso temporal venció o no es válido. Generá uno nuevo desde interno.')
      }
    })()
  }, [navigate])

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6">
      <div className="max-w-sm text-center">
        <img src="/logopiru.jpeg" alt="Piru" className="mx-auto mb-5 h-12 w-auto rounded-xl" />
        {error ? (
          <>
            <h1 className="text-lg font-semibold">No se pudo ingresar</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold">Abriendo el local…</h1>
            <p className="mt-2 text-sm text-muted-foreground">Esta sesión se cierra automáticamente en 15 minutos.</p>
          </>
        )}
      </div>
    </main>
  )
}
