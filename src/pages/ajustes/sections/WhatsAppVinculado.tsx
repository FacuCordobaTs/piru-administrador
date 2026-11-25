import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Loader2, MessageCircle, RefreshCw, ShieldCheck, Smartphone, Unlink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { whatsappVinculadoApi, type EstadoWhatsappVinculado } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { ConfirmDialog } from '../components/ConfirmDialog'

/**
 * WhatsApp del local vinculado como dispositivo (como WhatsApp Web). Sólo para locales sin avisos
 * automáticos. Sirve para dos cosas: confirmar que el cliente mandó su pedido (y tomar su número
 * sin pedírselo en el checkout) y mandar solas las tandas de recompra con un tope diario.
 */
export default function WhatsAppVinculado() {
  const token = useAuthStore((s) => s.token)
  const [estado, setEstado] = useState<EstadoWhatsappVinculado | null>(null)
  const [error, setError] = useState('')
  const [pidiendo, setPidiendo] = useState(false)
  const [confirmarDesvincular, setConfirmarDesvincular] = useState(false)

  const leer = useCallback(async () => {
    if (!token) return
    try {
      const res = await whatsappVinculadoApi.estado(token)
      setEstado(res.data)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos leer el estado de tu WhatsApp.')
    }
  }, [token])

  useEffect(() => {
    void leer()
  }, [leer])

  // Mientras se espera el escaneo, el código rota cada ~20 segundos.
  const esperando = estado?.estado === 'esperando_qr' || estado?.estado === 'preparando'
  useEffect(() => {
    if (!esperando) return
    const t = window.setInterval(() => void leer(), 3000)
    return () => clearInterval(t)
  }, [esperando, leer])

  const vincular = async () => {
    if (!token) return
    setPidiendo(true)
    try {
      const res = await whatsappVinculadoApi.vincular(token)
      setEstado(res.data)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No pudimos generar el código.')
    } finally {
      setPidiendo(false)
    }
  }

  const desvincular = async () => {
    if (!token) return
    try {
      const res = await whatsappVinculadoApi.desvincular(token)
      setEstado(res.data)
      toast.success('Desvinculamos tu WhatsApp')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No pudimos desvincular tu WhatsApp.')
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">WhatsApp del local</h1>
        <p className="text-sm text-muted-foreground">
          Vinculá el WhatsApp donde te llegan los pedidos, igual que cuando abrís WhatsApp Web. Tu celular sigue andando como siempre.
        </p>
      </header>

      {error && <div role="alert" className="rounded-lg border border-amber-500/30 p-3 text-sm">{error}</div>}

      {!estado ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : !estado.aplica ? (
        <p className="rounded-2xl bg-muted/60 p-5 text-sm">
          Tu local tiene los <b>avisos automáticos</b> de WhatsApp: los pedidos y las tandas ya salen por ahí, así que no hace falta vincular nada.
        </p>
      ) : !estado.disponible ? (
        <p className="rounded-2xl bg-muted/60 p-5 text-sm">Esta función todavía no está disponible. Escribinos y te avisamos cuando esté.</p>
      ) : estado.estado === 'conectado' || estado.estado === 'desconectado' ? (
        <Conectado estado={estado} onDesvincular={() => setConfirmarDesvincular(true)} />
      ) : (
        <Vincular estado={estado} pidiendo={pidiendo} onVincular={vincular} />
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Para qué lo usamos</h2>
        <ul className="space-y-3 text-sm">
          <li className="flex gap-3">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            <span>
              <b>Confirmar pedidos sin pedir el celular.</b> Cuando el cliente te manda el mensaje del pedido («Pedido #123»), lo marcamos como recibido y
              guardamos su número. Así la tienda no le pregunta el celular en el checkout.
            </span>
          </li>
          <li className="flex gap-3">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            <span>
              <b>Mandar solas las tandas de recompra</b>, con la foto del producto, desde tu mismo número. Salen de a una, con pausas y como mucho{' '}
              {estado?.limiteDiario ?? 30} por día, para cuidar tu WhatsApp.
            </span>
          </li>
          <li className="flex gap-3">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground">
              No leemos ni guardamos tus otras conversaciones: sólo miramos si un mensaje trae el número de un pedido de tu tienda. Grupos, estados y lo que
              escribís vos quedan afuera.
            </span>
          </li>
        </ul>
      </section>

      <ConfirmDialog
        open={confirmarDesvincular}
        onOpenChange={setConfirmarDesvincular}
        titulo="¿Desvincular tu WhatsApp?"
        descripcion="La tienda vuelve a pedirle el celular al cliente y las tandas que estaban saliendo solas se frenan. Podés vincularlo de nuevo cuando quieras."
        confirmLabel="Desvincular"
        destructivo
        onConfirm={desvincular}
      />
    </div>
  )
}

function Conectado({ estado, onDesvincular }: { estado: EstadoWhatsappVinculado; onDesvincular: () => void }) {
  const conectado = estado.estado === 'conectado'
  return (
    <div className="space-y-4 rounded-2xl border border-border/60 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40">
          <MessageCircle className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">+{estado.telefono}</p>
          <p className="text-sm text-muted-foreground">{conectado ? 'Vinculado y funcionando' : 'Vinculado, reconectando…'}</p>
        </div>
        <Badge variant="secondary" className={conectado ? 'border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' : ''}>
          {conectado ? 'Conectado' : 'Sin conexión'}
        </Badge>
      </div>
      {!conectado && (
        <p className="text-sm text-muted-foreground">
          Revisá que el celular tenga internet. Si lo sacaste desde «Dispositivos vinculados», desvinculalo acá y volvé a escanear el código.
        </p>
      )}
      <Button variant="outline" onClick={onDesvincular} className="gap-2">
        <Unlink className="size-4" />
        Desvincular
      </Button>
    </div>
  )
}

function Vincular({ estado, pidiendo, onVincular }: { estado: EstadoWhatsappVinculado; pidiendo: boolean; onVincular: () => void }) {
  const qr = estado.estado === 'esperando_qr' ? estado.qr : undefined
  return (
    <div className="grid gap-6 rounded-2xl border border-border/60 p-5 md:grid-cols-[1fr_auto]">
      <ol className="space-y-4 text-sm">
        <Paso n={1}>
          Agarrá el celular del local y abrí <b>WhatsApp</b> o <b>WhatsApp Business</b>: el número donde te llegan los pedidos.
        </Paso>
        <Paso n={2}>
          <b>Android:</b> tocá los tres puntos <b>⋮</b> arriba a la derecha y entrá en <b>Dispositivos vinculados</b>.
          <br />
          <b>iPhone:</b> tocá <b>Configuración</b> abajo a la derecha y entrá en <b>Dispositivos vinculados</b>.
        </Paso>
        <Paso n={3}>
          Tocá <b>Vincular un dispositivo</b>. Si te pide la huella o el PIN del celular, ponelo.
        </Paso>
        <Paso n={4}>Apuntá la cámara del celular al código de esta pantalla. En unos segundos aparece «Piru» en la lista y listo.</Paso>
        <li className="flex gap-3 text-muted-foreground">
          <Smartphone className="mt-0.5 size-4 shrink-0" />
          <span>Tu celular tiene que conectarse a internet al menos una vez cada 14 días para que la vinculación no se corte.</span>
        </li>
      </ol>

      <div className="flex flex-col items-center justify-center gap-3 md:w-64">
        {qr ? (
          <>
            <img src={qr} alt="Código QR para vincular WhatsApp" className="size-56 rounded-xl bg-white p-2" />
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Esperando que lo escanees…
            </p>
          </>
        ) : estado.estado === 'preparando' || pidiendo ? (
          <div className="flex size-56 items-center justify-center rounded-xl bg-muted/60">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex size-56 flex-col items-center justify-center gap-3 rounded-xl bg-muted/60 p-4 text-center">
            <p className="text-sm text-muted-foreground">Cuando tengas el celular a mano, mostrá el código.</p>
            <Button onClick={onVincular} className="gap-2">
              <RefreshCw className="size-4" />
              Mostrar código
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function Paso({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">{n}</span>
      <span className="pt-0.5">{children}</span>
    </li>
  )
}
