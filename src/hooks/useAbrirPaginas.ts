import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { sitiosApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

/**
 * Abre la app Páginas (`pages.piru.app`) en otra pestaña con un pase de dos minutos. La pestaña se
 * abre en el mismo click (antes de pedir el pase) para que el navegador no la bloquee; si igual la
 * bloquea, `bloqueada` trae el link para abrirlo a mano.
 */
export function useAbrirPaginas() {
  const token = useAuthStore((s) => s.token)
  const [abriendo, setAbriendo] = useState(false)
  const [bloqueada, setBloqueada] = useState<string | null>(null)

  const abrir = useCallback(async () => {
    if (!token) return
    const pestana = window.open('', '_blank')
    setAbriendo(true)
    setBloqueada(null)
    try {
      const { data } = await sitiosApi.entrada(token)
      if (pestana) pestana.location.href = data.url
      else setBloqueada(data.url)
    } catch (error) {
      pestana?.close()
      toast.error('No pudimos abrir Páginas', { description: error instanceof Error ? error.message : 'Intentá de nuevo.' })
    } finally {
      setAbriendo(false)
    }
  }, [token])

  return { abrir, abriendo, bloqueada, disponible: Boolean(token) }
}
