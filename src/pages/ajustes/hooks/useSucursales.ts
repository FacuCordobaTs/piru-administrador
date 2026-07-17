import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/authStore'

export interface Sucursal {
  id: number
  nombre: string
  direccion: string | null
  whatsappEnabled: boolean
  whatsappNumber: string | null
  rapiboyToken: string | null
  activo: boolean
}

const apiBase = () => import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

/** Carga la lista de sucursales del restaurante (compartida por General y Entregas). */
export function useSucursales() {
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [loaded, setLoaded] = useState(false)

  const cargar = useCallback(async () => {
    const token = useAuthStore.getState().token
    if (!token) return
    try {
      const res = await fetch(`${apiBase()}/sucursales/list`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success && Array.isArray(data.data)) setSucursales(data.data)
    } catch {
      toast.error('Error al cargar sucursales')
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  return { sucursales, loaded, recargar: cargar }
}
