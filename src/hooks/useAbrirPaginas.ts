import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { sitiosApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

/**
 * Abre la app Páginas (`pages.piru.app`) en otra pestaña con un pase de dos minutos. Si el navegador
 * bloquea la pestaña, `bloqueada` trae el link para abrirlo a mano.
 */
export function useAbrirPaginas() {
  const token = useAuthStore((s) => s.token)
  const [abriendo, setAbriendo] = useState(false)
  const [bloqueada, setBloqueada] = useState<string | null>(null)

  const abrir = useCallback(async () => {
    if (!token) return
    setAbriendo(true)
    setBloqueada(null)
    try {
      const { data } = await sitiosApi.entrada(token)
      if (!window.open(data.url, '_blank')) setBloqueada(data.url)
    } catch (error) {
      toast.error('No pudimos abrir Páginas', { description: error instanceof Error ? error.message : 'Intentá de nuevo.' })
    } finally {
      setAbriendo(false)
    }
  }, [token])

  return { abrir, abriendo, bloqueada, disponible: Boolean(token) }
}
