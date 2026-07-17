import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { ChevronDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { restauranteApi, mercadopagoApi, cucuruApi, ApiError } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import type { useWhatsApp } from '../../hooks/useWhatsApp'

const MP_APP_ID = 38638191854826
const MP_REDIRECT_URI =
  import.meta.env.VITE_MP_REDIRECT_URI || 'https://api.piru.app/api/mp/callback'

// ── Mercado Pago ──────────────────────────────────────────────────────────
export function MercadoPagoEditor({ conectado }: { conectado: boolean }) {
  const restauranteId = useRestauranteStore((s) => s.restaurante?.id)
  const fetchData = useRestauranteStore((s) => s.fetchData)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const authUrl =
    restauranteId != null
      ? `https://auth.mercadopago.com.ar/authorization?client_id=${MP_APP_ID}&response_type=code&platform_id=mp&state=${restauranteId}&redirect_uri=${encodeURIComponent(MP_REDIRECT_URI)}`
      : '#'

  const desconectar = async () => {
    const token = useAuthStore.getState().token
    if (!token) return
    try {
      await mercadopagoApi.desconectar(token)
      await fetchData()
    } catch {
      toast.error('Error al desconectar Mercado Pago')
    }
  }

  if (!conectado) {
    return (
      <div className="space-y-5">
        <p className="text-sm font-normal text-muted-foreground">
          Conectá tu cuenta para cobrar con tarjeta y dinero en cuenta desde tu menú.
        </p>
        <Button asChild className="h-11 min-h-[44px] w-full font-medium">
          <a href={authUrl}>Conectar Mercado Pago</a>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <p className="text-sm font-normal text-muted-foreground">
        Tu cuenta está conectada. Activá Mercado Pago en “Métodos de pago”.
      </p>
      <Button
        variant="ghost"
        onClick={() => setConfirmOpen(true)}
        className="h-11 min-h-[44px] font-medium text-red-600 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
      >
        Desconectar cuenta
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        titulo="Desconectar Mercado Pago"
        descripcion="Tus clientes dejarán de poder pagar con Mercado Pago."
        confirmLabel="Desconectar"
        destructivo
        onConfirm={desconectar}
      />
    </div>
  )
}

// ── Cucuru ────────────────────────────────────────────────────────────────
export function CucuruEditor({ conectado }: { conectado: boolean }) {
  const fetchData = useRestauranteStore((s) => s.fetchData)
  const [apiKey, setApiKey] = useState('')
  const [collectorId, setCollectorId] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [reenviando, setReenviando] = useState(false)
  const [avanzado, setAvanzado] = useState(false)

  const conectar = async () => {
    const token = useAuthStore.getState().token
    if (!token) return
    if (!apiKey.trim() || !collectorId.trim()) {
      toast.error('Ingresá API Key y Collector ID')
      return
    }
    setGuardando(true)
    try {
      await cucuruApi.configurar(token, apiKey, collectorId)
      await fetchData()
      setApiKey('')
      setCollectorId('')
    } catch {
      toast.error('Error al configurar Cucuru')
    } finally {
      setGuardando(false)
    }
  }

  const reenviarWebhook = async () => {
    const token = useAuthStore.getState().token
    if (!token) return
    setReenviando(true)
    try {
      await cucuruApi.reconfigurarWebhook(token)
      toast.success('Webhook reenviado')
    } catch {
      toast.error('No se pudo reenviar el webhook')
    } finally {
      setReenviando(false)
    }
  }

  if (conectado) {
    return (
      <div className="space-y-4">
        <p className="text-sm font-normal text-muted-foreground">
          Cucuru está conectado y sincronizado. Las transferencias se acreditan solas.
        </p>
        <Disclosure open={avanzado} onToggle={() => setAvanzado((v) => !v)} label="Avanzado">
          <p className="mb-3 text-[13px] font-normal text-muted-foreground">
            Si dejaste de recibir avisos de cobros, reenviá el aviso automático a Cucuru
            para que vuelva a notificar tus pagos.
          </p>
          <Button
            variant="outline"
            onClick={reenviarWebhook}
            disabled={reenviando}
            className="h-11 min-h-[44px] font-medium"
          >
            {reenviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reenviar aviso de cobros
          </Button>
        </Disclosure>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="font-medium">API Key</Label>
        <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="h-11" placeholder="Tu API Key de Cucuru" />
      </div>
      <div className="space-y-1.5">
        <Label className="font-medium">Collector ID</Label>
        <Input value={collectorId} onChange={(e) => setCollectorId(e.target.value)} className="h-11" placeholder="Tu Collector ID" />
      </div>
      <Button onClick={conectar} disabled={guardando} className="h-11 min-h-[44px] w-full font-medium">
        {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Conectar Cucuru
      </Button>
    </div>
  )
}

// ── Talo ──────────────────────────────────────────────────────────────────
export function TaloEditor({ conectado }: { conectado: boolean }) {
  const fetchData = useRestauranteStore((s) => s.fetchData)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [userId, setUserId] = useState('')
  const [guardando, setGuardando] = useState(false)

  const conectar = async () => {
    const token = useAuthStore.getState().token
    if (!token) return
    if (!clientId.trim() || !clientSecret.trim() || !userId.trim()) {
      toast.error('Ingresá Client ID, Client Secret y User ID')
      return
    }
    setGuardando(true)
    try {
      await restauranteApi.configurarTalo(token, clientId.trim(), clientSecret.trim(), userId.trim())
      await fetchData()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Error al configurar Talo')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-4">
      {conectado && (
        <p className="text-sm font-normal text-muted-foreground">
          Talo está conectado. Podés actualizar tus credenciales acá.
        </p>
      )}
      <div className="space-y-1.5">
        <Label className="font-medium">Client ID</Label>
        <Input type="password" value={clientId} onChange={(e) => setClientId(e.target.value)} className="h-11" />
      </div>
      <div className="space-y-1.5">
        <Label className="font-medium">Client Secret</Label>
        <Input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} className="h-11" />
      </div>
      <div className="space-y-1.5">
        <Label className="font-medium">User ID</Label>
        <Input value={userId} onChange={(e) => setUserId(e.target.value)} className="h-11" />
      </div>
      <Button onClick={conectar} disabled={guardando} className="h-11 min-h-[44px] w-full font-medium">
        {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Conectar Talo
      </Button>
    </div>
  )
}

// ── WhatsApp ──────────────────────────────────────────────────────────────
export function WhatsAppEditor({ wa }: { wa: ReturnType<typeof useWhatsApp> }) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const vencido = !!wa.status?.tokenVencido

  return (
    <div className="space-y-5">
      <p className="text-sm font-normal text-muted-foreground">
        Número conectado:{' '}
        <span className="font-medium text-foreground">{wa.status?.phoneNumber ?? '—'}</span>
      </p>
      {vencido && (
        <Button onClick={wa.conectar} disabled={wa.loading} className="h-11 min-h-[44px] w-full font-medium">
          {wa.loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Reconectar número
        </Button>
      )}
      <Button
        variant="ghost"
        onClick={() => setConfirmOpen(true)}
        className="h-11 min-h-[44px] font-medium text-red-600 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
      >
        Desconectar número
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        titulo="Desconectar WhatsApp"
        descripcion="El asistente dejará de atender pedidos por WhatsApp."
        confirmLabel="Desconectar"
        destructivo
        onConfirm={wa.desconectar}
      />
    </div>
  )
}

// ── Disclosure "Avanzado" ─────────────────────────────────────────────────
function Disclosure({
  open,
  onToggle,
  label,
  children,
}: {
  open: boolean
  onToggle: () => void
  label: string
  children: ReactNode
}) {
  return (
    <div className="border-t border-border pt-3">
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
        {label}
      </button>
      {open && <div className="pt-3 duration-150 animate-in fade-in slide-in-from-top-1">{children}</div>}
    </div>
  )
}
