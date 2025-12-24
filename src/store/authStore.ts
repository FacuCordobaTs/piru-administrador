import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Restaurante {
  id: number
  email: string
  nombre: string
  direccion?: string | null
  telefono?: string | null
  imagenUrl?: string | null
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

