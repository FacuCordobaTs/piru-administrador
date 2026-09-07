import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { purgarDirectorioPos } from '@/lib/posLocalDb'

interface Restaurante {
  id: number
  email: string
  nombre: string
  username?: string | null
  direccion?: string | null
  telefono?: string | null
  imagenUrl?: string | null
  itemTracking?: boolean | null
  deliveryFee?: string | null
  rapiboyToken?: string | null
}

interface AuthState {
  token: string | null
  restaurante: Restaurante | null
  isAuthenticated: boolean
  setAuth: (token: string, restaurante: Restaurante) => void
  logout: () => void
  updateRestaurante: (restaurante: Restaurante) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      restaurante: null,
      isAuthenticated: false,
      setAuth: (token, restaurante) =>
        set({
          token,
          restaurante,
          isAuthenticated: true,
        }),
      logout: () =>
        set({
          token: null,
          restaurante: null,
          isAuthenticated: false,
        }),
      updateRestaurante: (restaurante) =>
        set({
          restaurante,
        }),
    }),
    {
      name: 'piru-auth-storage',
    }
  )
)

useAuthStore.subscribe((state, anterior) => {
  const idAnterior = anterior.restaurante?.id
  if (idAnterior != null && (state.restaurante?.id !== idAnterior || !state.token)) {
    void purgarDirectorioPos(idAnterior).catch(() => { /* La partición queda inaccesible sin su sesión. */ })
    // Borradores legacy de la misma pestaña tampoco deben cruzar cuentas.
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i)
        if (key?.startsWith('piru:pos-draft:')) sessionStorage.removeItem(key)
      }
    } catch { /* El fallo de storage no debe impedir invalidar los stores de sesión. */ }
  }
})

