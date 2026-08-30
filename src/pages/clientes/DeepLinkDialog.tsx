import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ApiError, crecimientoApi, mensajesApi, type EnlaceCrecimiento, type OportunidadCrecimiento, type RecetaCrecimiento } from '@/lib/api'
import { CheckCircle2, Copy, ExternalLink, Loader2, Send, ShieldAlert, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { type ClienteGrowth, nuevaClave, RECETAS } from './types'

interface DeepLinkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  token: string
  cliente: ClienteGrowth | null
  onPrepared?: () => void
}

export default function DeepLinkDialog({ open, onOpenChange, token, cliente, onPrepared }: DeepLinkDialogProps) {
  const clienteId = cliente?.id
  const [recomendacion, setRecomendacion] = useState<OportunidadCrecimiento | null>(null)
  const [receta, setReceta] = useState<RecetaCrecimiento | null>(null)
  const [confirmoIncentivo, setConfirmoIncentivo] = useState(false)
  const [enlace, setEnlace] = useState<EnlaceCrecimiento | null>(null)
  const [tokenEnlace, setTokenEnlace] = useState<string | null>(null)
  const [saldo, setSaldo] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [accion, setAccion] = useState<'preparar' | 'copiar' | 'wa_me' | 'piru' | null>(null)
  const [error, setError] = useState('')
  const [claves, setClaves] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open || !clienteId) return
    setLoading(true)
    setError('')
    setEnlace(null)
    setTokenEnlace(null)
    setConfirmoIncentivo(false)
    setClaves({})
    Promise.all([
      crecimientoApi.recomendacion(token, clienteId),
      mensajesApi.saldo(token).catch(() => null),
    ]).then(([respuesta, wallet]) => {
      setRecomendacion(respuesta.data)
      setReceta(respuesta.data.receta.codigo)
      setSaldo(wallet?.data.marketing.disponible ?? null)
    }).catch((cause) => {
      setError(cause instanceof ApiError ? cause.message : 'No se pudo cargar la recomendación para este cliente.')
    }).finally(() => setLoading(false))
  }, [open, clienteId, token])

  const opcion = useMemo(() => RECETAS.find((item) => item.codigo === receta) ?? null, [receta])
  const recomendada = recomendacion?.receta.codigo ?? cliente?.recetaRecomendada?.codigo ?? null
  const bloqueos = recomendacion?.elegibilidad.bloqueos ?? []
  const puedeContactar = bloqueos.length === 0

  const clave = (paso: string) => {
    const existente = claves[paso]
    if (existente) return existente
    const nueva = nuevaClave()
    setClaves((actual) => ({ ...actual, [paso]: nueva }))
    return nueva
  }

  const seleccionarReceta = (codigo: RecetaCrecimiento) => {
    setReceta(codigo)
    setConfirmoIncentivo(false)
    setEnlace(null)
    setTokenEnlace(null)
    setClaves({})
    setError('')
  }

  const preparar = async () => {
    if (!cliente || !opcion) return
    if (opcion.descuentoPorcentaje > 0 && !confirmoIncentivo) {
      setError(`Confirmá el beneficio de ${opcion.descuentoPorcentaje}% antes de crear el cupón individual.`)
      return
    }
    setAccion('preparar'); setError('')
    try {
      const respuesta = await crecimientoApi.prepararEnlace(token, {
        clienteId: cliente.id,
        recetaCodigo: opcion.codigo,
        incentivo: { descuentoPorcentaje: opcion.descuentoPorcentaje, expiraHoras: opcion.expiraHoras },
        incentivoConfirmado: opcion.descuentoPorcentaje === 0 || confirmoIncentivo,
        idempotenciaClave: clave('preparar'),
      })
      setEnlace(respuesta.data.enlace)
      setTokenEnlace(respuesta.data.token ?? null)
      toast.success('Deep link creado. Todavía no se envió ningún mensaje.')
      onPrepared?.()
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'No se pudo crear el deep link.')
    } finally { setAccion(null) }
  }

  const compartir = async (canal: 'copiar' | 'wa_me' | 'piru') => {
    if (!enlace || !tokenEnlace) return
    setAccion(canal); setError('')
    try {
      const data = { token: tokenEnlace, idempotenciaClave: clave(canal) }
      if (canal === 'copiar') {
        const respuesta = await crecimientoApi.copiarEnlace(token, enlace.id, data)
        await navigator.clipboard.writeText(respuesta.data.url)
        toast.success('Deep link copiado.')
      } else if (canal === 'wa_me') {
        const respuesta = await crecimientoApi.abrirWaMe(token, enlace.id, data)
        window.open(respuesta.data.waMeUrl, '_blank', 'noopener,noreferrer')
      } else {
        const respuesta = await crecimientoApi.enviarConPiru(token, enlace.id, data)
        if (!respuesta.data.entregado) throw new Error('El proveedor no confirmó el envío.')
        setSaldo((actual) => actual == null ? actual : actual - 1)
        toast.success('Mensaje enviado con Piru.')
      }
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : cause instanceof Error ? cause.message : 'No se pudo completar la acción.')
    } finally { setAccion(null) }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>Crear deep link para {cliente?.nombre ?? 'este cliente'}</DialogTitle>
        <DialogDescription>Elegí cualquier receta. Piru marca la recomendada, pero la decisión final siempre es tuya.</DialogDescription>
      </DialogHeader>

      {loading ? <div className="flex items-center justify-center py-16 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analizando historial y cadencia…</div> : <div className="space-y-5">
        <div className="grid gap-2 sm:grid-cols-2">
          {RECETAS.map((item) => {
            const seleccionada = receta === item.codigo
            const esRecomendada = recomendada === item.codigo
            return <button key={item.codigo} type="button" onClick={() => seleccionarReceta(item.codigo)} className={`rounded-xl border p-4 text-left transition-colors ${seleccionada ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/15 dark:bg-emerald-950/20' : 'border-border bg-background hover:bg-muted/50'}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{item.nombre}</span>
                {esRecomendada && <Badge className="bg-emerald-600 text-white hover:bg-emerald-600"><Sparkles className="mr-1 h-3 w-3" />Recomendada para este cliente</Badge>}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{item.descripcion}</p>
              <p className="mt-2 text-xs font-medium">{item.descuentoPorcentaje ? `${item.descuentoPorcentaje}% OFF${item.expiraHoras ? ` · ${item.expiraHoras} h` : ''}` : 'Sin descuento sugerido'}</p>
            </button>
          })}
        </div>

        {opcion && <div className="rounded-xl bg-muted/50 p-4">
          <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">{opcion.nombre}</p><p className="mt-1 text-xs text-muted-foreground">Destino recomendado: {recomendacion?.destino.tipo === 'carrito' ? 'último carrito' : recomendacion?.destino.tipo === 'producto' ? recomendacion.destino.nombreProducto ?? 'producto favorito' : 'tienda'}.</p></div>{opcion.codigo === recomendada && <Badge variant="outline">Recomendada</Badge>}</div>
          {opcion.descuentoPorcentaje > 0 && <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border bg-background p-3 text-sm"><Checkbox checked={confirmoIncentivo} onChange={(event) => setConfirmoIncentivo(event.target.checked)} /><span>Confirmo crear un cupón individual de {opcion.descuentoPorcentaje}% OFF{opcion.expiraHoras ? ` con vencimiento en ${opcion.expiraHoras} horas` : ''}.</span></label>}
        </div>}

        {bloqueos.length > 0 && <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-medium">Podés crear el deep link, pero no contactar desde Piru.</p><p className="mt-1 text-xs">{bloqueos.map((bloqueo) => bloqueo.mensaje).join(' ')}</p></div></div>}

        {!enlace ? <Button onClick={() => void preparar()} disabled={!opcion || accion != null} className="w-full"><Sparkles className="mr-2 h-4 w-4" />{accion === 'preparar' ? 'Creando…' : 'Crear deep link'}</Button> : <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-900 dark:text-emerald-100"><CheckCircle2 className="h-4 w-4" />Deep link listo para compartir</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <Button variant="outline" disabled={!tokenEnlace || accion != null} onClick={() => void compartir('copiar')}><Copy className="mr-2 h-4 w-4" />Copiar</Button>
            <Button variant="outline" disabled={!tokenEnlace || accion != null || !puedeContactar} onClick={() => void compartir('wa_me')}><ExternalLink className="mr-2 h-4 w-4" />Abrir WhatsApp</Button>
            <Button disabled={!tokenEnlace || accion != null || !puedeContactar || saldo === 0} onClick={() => void compartir('piru')}><Send className="mr-2 h-4 w-4" />Enviar con Piru</Button>
          </div>
          <p className="text-xs text-emerald-900/70 dark:text-emerald-100/70">Copiar no consume mensajes. Enviar con Piru consume 1 crédito marketing; saldo: {saldo ?? '—'}.</p>
        </div>}
        {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      </div>}
      <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}
