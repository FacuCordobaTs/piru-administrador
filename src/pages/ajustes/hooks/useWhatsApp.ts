import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/authStore'

export interface WhatsAppStatus {
  conectado: boolean
  phoneNumber: string | null
  tokenVencido: boolean
}

const apiBase = () => import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

/**
 * Estado y OAuth de WhatsApp Business (movido de Perfil.tsx).
 * Usa el flujo de redirect clásico (no el popup del SDK): el redirect_uri
 * apunta a /dashboard/perfil, que redirige a /ajustes/pagos conservando el
 * query, y acá se canjea el ?code=.
 */
export function useWhatsApp() {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const canjeadoRef = useRef(false)

  const cargarStatus = useCallback(async () => {
    const token = useAuthStore.getState().token
    if (!token) return
    try {
      const res = await fetch(`${apiBase()}/whatsapp-oauth/status`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) setStatus(data)
    } catch {
      /* silencioso: el estado queda null y la fila muestra "sin conectar" */
    }
  }, [])

  const canjearCode = useCallback(async (code: string) => {
    const token = useAuthStore.getState().token
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch(`${apiBase()}/whatsapp-oauth/connect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (data.success) {
        setStatus({ conectado: true, phoneNumber: data.phoneNumber, tokenVencido: false })
        toast.success(`WhatsApp conectado: ${data.phoneNumber}`)
      } else {
        toast.error(data.message || 'Error al conectar WhatsApp')
      }
    } catch {
      toast.error('Error al conectar WhatsApp')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void cargarStatus()
  }, [cargarStatus])

  // Captura el ?code= cuando Meta redirige de vuelta tras el OAuth.
  useEffect(() => {
    if (canjeadoRef.current) return
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    if (code && state === 'whatsapp') {
      canjeadoRef.current = true
      window.history.replaceState({}, '', window.location.pathname)
      void canjearCode(code)
    }
  }, [canjearCode])

  const conectar = useCallback(() => {
    // redirect_uri debe coincidir EXACTAMENTE con el registrado en Meta.
    const redirectUri = 'https://admin.piru.app/dashboard/perfil'
    const url =
      `https://www.facebook.com/v22.0/dialog/oauth?` +
      `client_id=939939975659282` +
      `&config_id=2543954492702386` +
      `&response_type=code` +
      `&override_default_response_type=true` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=whatsapp`
    window.location.href = url
  }, [])

  const desconectar = useCallback(async () => {
    const token = useAuthStore.getState().token
    await fetch(`${apiBase()}/whatsapp-oauth/disconnect`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    setStatus({ conectado: false, phoneNumber: null, tokenVencido: false })
  }, [])

  return { status, loading, conectar, desconectar }
}
