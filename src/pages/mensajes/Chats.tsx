import { useEffect, useState } from 'react'
import { ArrowLeft, Bot, ExternalLink, Inbox, Loader2, Megaphone, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { mensajesApi, type ChatWhatsapp, type ResumenChatWhatsapp } from '@/lib/api'

const hora = (iso: string) => {
  const fecha = new Date(iso)
  const hoy = new Date()
  const mismoDia = fecha.toDateString() === hoy.toDateString()
  return new Intl.DateTimeFormat('es-AR', mismoDia
    ? { hour: '2-digit', minute: '2-digit' }
    : { day: 'numeric', month: 'short' }).format(fecha)
}

const horaCompleta = (iso: string) =>
  new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

const telefonoVisible = (t: string) => (t.startsWith('54') ? `+${t}` : t)

const ORIGEN = {
  cliente: null,
  bot: { icono: Bot, texto: 'Respuesta automática' },
  tanda: { icono: Megaphone, texto: 'Mensaje de Recompra' },
} as const

/**
 * Los chats de WhatsApp en los que un cliente le escribió al número del local: el mensaje de
 * campaña que recibió, lo que contestó y la respuesta automática. Es sólo para leer; para
 * responder se abre el chat en el WhatsApp del local.
 */
export function Chats() {
  const [chats, setChats] = useState<ResumenChatWhatsapp[] | null>(null)
  const [error, setError] = useState(false)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [chat, setChat] = useState<ChatWhatsapp | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const token = useAuthStore.getState().token
    if (!token) return
    mensajesApi.chats(token)
      .then((r) => {
        setChats(r.data)
        setAbierto((a) => a ?? (window.matchMedia('(min-width: 768px)').matches ? r.data[0]?.clave ?? null : null))
      })
      .catch(() => setError(true))
  }, [version])

  useEffect(() => {
    const token = useAuthStore.getState().token
    if (!token || !abierto) return
    let activo = true
    mensajesApi.chat(token, abierto).then((r) => activo && setChat(r.data)).catch(() => activo && setChat(null))
    return () => { activo = false }
  }, [abierto, version])

  if (error) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">No pudimos cargar los chats.</p>
        <Button variant="outline" className="mt-3" onClick={() => { setError(false); setVersion((v) => v + 1) }}>Volver a intentar</Button>
      </div>
    )
  }
  if (!chats) {
    return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
  }
  if (!chats.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
        <Inbox className="mx-auto h-8 w-8 text-muted-foreground/60" />
        <h3 className="mt-3 text-base font-medium">Todavía nadie respondió</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Cuando un cliente le escriba al WhatsApp automático del local, vas a ver acá la conversación completa.
        </p>
      </div>
    )
  }

  const resumen = chats.find((c) => c.clave === abierto)
  // El chat cargado puede ser el anterior mientras llega el nuevo.
  const actual = chat?.clave === abierto ? chat : null
  return (
    <div className="grid overflow-hidden rounded-2xl border border-border bg-card md:h-[620px] md:grid-cols-[300px_1fr]">
      <aside className={cn('min-h-0 border-border md:border-r', abierto && 'hidden md:block')}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-medium">{chats.length} {chats.length === 1 ? 'conversación' : 'conversaciones'}</p>
          <Button variant="ghost" size="icon" aria-label="Actualizar" onClick={() => setVersion((v) => v + 1)}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <ul className="max-h-[560px] overflow-y-auto md:max-h-none md:h-[calc(620px-53px)]">
          {chats.map((c) => (
            <li key={c.clave}>
              <button
                type="button"
                onClick={() => setAbierto(c.clave)}
                className={cn(
                  'flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-muted/50',
                  c.clave === abierto && 'bg-muted/70',
                )}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-600/10 text-sm font-semibold text-emerald-700">
                  {(c.nombre ?? '#').charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">{c.nombre ?? telefonoVisible(c.telefono)}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{hora(c.ultimoAt)}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
                    {c.ultimoOrigen !== 'cliente' && <span className="text-foreground/70">{c.ultimoOrigen === 'bot' ? 'Bot: ' : 'Vos: '}</span>}
                    {c.ultimoTexto}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className={cn('flex min-h-[520px] flex-col md:min-h-0', !abierto && 'hidden md:flex')}>
        {resumen ? (
          <>
            <header className="flex items-center gap-3 border-b border-border px-4 py-3">
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Volver a los chats" onClick={() => setAbierto(null)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{resumen.nombre ?? 'Sin nombre en Clientes'}</p>
                <p className="text-xs text-muted-foreground">{telefonoVisible(resumen.telefono)}</p>
              </div>
              <Button asChild variant="outline" size="sm">
                <a href={`https://wa.me/${resumen.telefono}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Abrir en WhatsApp
                </a>
              </Button>
            </header>
            <div className="flex-1 space-y-2 overflow-y-auto bg-[#efeae2] px-3 py-4 dark:bg-[#0b141a] sm:px-6">
              {!actual ? (
                <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : (
                actual.mensajes.map((m) => {
                  const origen = ORIGEN[m.origen]
                  const saliente = m.direccion === 'saliente'
                  return (
                    <div key={m.id} className={cn('flex', saliente ? 'justify-end' : 'justify-start')}>
                      <div
                        className={cn(
                          'max-w-[85%] rounded-xl px-3 py-2 text-[13.5px] leading-snug shadow-sm sm:max-w-[70%]',
                          saliente
                            ? 'rounded-tr-sm bg-[#d9fdd3] text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef]'
                            : 'rounded-tl-sm bg-white text-[#111b21] dark:bg-[#202c33] dark:text-[#e9edef]',
                        )}
                      >
                        {origen && (
                          <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-[#667781] dark:text-white/60">
                            <origen.icono className="h-3 w-3" />
                            {origen.texto}
                          </p>
                        )}
                        {m.imagenUrl && (
                          <div className="mb-1.5 overflow-hidden rounded-md bg-black/5">
                            <img src={m.imagenUrl} alt="" className="max-h-48 w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                          </div>
                        )}
                        <p className="whitespace-pre-line [overflow-wrap:anywhere]">{m.texto}</p>
                        <p className="mt-0.5 text-right text-[10.5px] text-[#667781] dark:text-white/50">{horaCompleta(m.createdAt)}</p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            <footer className="border-t border-border bg-muted/40 px-4 py-3 text-center text-xs text-muted-foreground">
              Sólo lectura. Para responderle, abrí el chat en el WhatsApp del local.
            </footer>
          </>
        ) : (
          <div className="m-auto p-8 text-center text-sm text-muted-foreground">Elegí una conversación para leerla.</div>
        )}
      </section>
    </div>
  )
}
