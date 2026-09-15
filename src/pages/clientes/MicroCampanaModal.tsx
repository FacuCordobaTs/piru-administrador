import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useModuloActivo } from '@/store/modulosStore'
import { ApiError, crecimientoApi, mensajesApi, type EnlaceCrecimiento } from '@/lib/api'
import { CheckCircle2, Copy, ExternalLink, Gift, Loader2, Lock, Send, ShoppingBag, Sparkles, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { type ClienteGrowth, nuevaClave } from './types'

interface MicroCampanaModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  token: string
  cliente: ClienteGrowth | null
  username?: string
  onPrepared?: () => void
}

export default function MicroCampanaModal({
  open,
  onOpenChange,
  token,
  cliente,
  username,
  onPrepared,
}: MicroCampanaModalProps) {
  const navigate = useNavigate()
  const retencionActiva = useModuloActivo('motor_recompra')
  const clienteId = cliente?.id
  const segmento = cliente?.segmento ?? 'nuevo'

  // Determinar campaña recomendada según segmento
  const recomendacionSegmento = useMemo(() => {
    if (segmento === 'dormido') {
      return { tipo: 'reactivacion' as const, descuento: 10, expiraHoras: null }
    }
    if (segmento === 'perdido') {
      return { tipo: 'reactivacion' as const, descuento: 20, expiraHoras: 48 }
    }
    return { tipo: 'lo_mismo' as const, descuento: 0, expiraHoras: null }
  }, [segmento])

  const [tipoCampana, setTipoCampana] = useState<'lo_mismo' | 'reactivacion'>(recomendacionSegmento.tipo)
  const [descuento, setDescuento] = useState<10 | 20>(recomendacionSegmento.descuento === 20 ? 20 : 10)
  const [enlace, setEnlace] = useState<EnlaceCrecimiento | null>(null)
  const [tokenCifrado, setTokenCifrado] = useState<string | null>(null)
  const [campanaSlug, setCampanaSlug] = useState<string>('lo-mismo')
  const [saldo, setSaldo] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [accion, setAccion] = useState<'copiar' | 'wa_me' | 'piru' | null>(null)
  const [error, setError] = useState('')
  const [claves, setClaves] = useState<Record<string, string>>({})

  const clave = (paso: string) => {
    const existente = claves[paso]
    if (existente) return existente
    const nueva = nuevaClave()
    setClaves((actual) => ({ ...actual, [paso]: nueva }))
    return nueva
  }

  // Preparar enlace de micro-campaña
  const preparar = useCallback(async (tipo: 'lo_mismo' | 'reactivacion', dto: 10 | 20) => {
    if (!clienteId || !retencionActiva) return
    setLoading(true)
    setError('')
    try {
      const expiraHoras = tipo === 'reactivacion' && dto === 20 ? 48 : null
      const respuesta = await crecimientoApi.prepararEnlace(token, {
        clienteId,
        tipoCampana: tipo,
        descuentoPorcentaje: tipo === 'reactivacion' ? dto : 0,
        expiraHoras,
        idempotenciaClave: nuevaClave(),
      })

      setEnlace(respuesta.data.enlace)
      setTokenCifrado(respuesta.data.token ?? null)
      setCampanaSlug(respuesta.data.campanaSlug ?? (tipo === 'lo_mismo' ? 'lo-mismo' : 'reactivacion'))
      onPrepared?.()
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 403) {
        setError('El módulo Herramientas de retención (+ $20.000/mes) no está activo.')
      } else {
        setError(cause instanceof ApiError ? cause.message : 'No se pudo generar el enlace de la micro-campaña.')
      }
    } finally {
      setLoading(false)
    }
  }, [clienteId, token, onPrepared, retencionActiva])

  // Inicializar al abrir modal
  useEffect(() => {
    if (!open || !clienteId || !retencionActiva) return
    const recTipo = recomendacionSegmento.tipo
    const recDto = (recomendacionSegmento.descuento === 20 ? 20 : 10) as 10 | 20
    setTipoCampana(recTipo)
    setDescuento(recDto)
    setEnlace(null)
    setTokenCifrado(null)
    setClaves({})
    setError('')

    void mensajesApi.saldo(token).then((res) => {
      setSaldo(res.data.marketing.disponible ?? null)
    }).catch(() => {})

    void preparar(recTipo, recDto)
  }, [open, clienteId, token, recomendacionSegmento, preparar, retencionActiva])

  // Manejar cambio de micro-campaña
  const cambiarCampana = (nuevoTipo: 'lo_mismo' | 'reactivacion') => {
    setTipoCampana(nuevoTipo)
    setEnlace(null)
    setTokenCifrado(null)
    setClaves({})
    setError('')
    void preparar(nuevoTipo, descuento)
  }

  const cambiarDescuento = (nuevoDescuento: 10 | 20) => {
    setDescuento(nuevoDescuento)
    setEnlace(null)
    setTokenCifrado(null)
    setClaves({})
    setError('')
    void preparar('reactivacion', nuevoDescuento)
  }

  // Construir URL pública para el cliente
  const urlPublica = useMemo(() => {
    if (!tokenCifrado) return ''
    const u = username ? encodeURIComponent(username) : 'local'
    return `https://my.piru.app/${u}/c/${encodeURIComponent(campanaSlug)}?tk=${encodeURIComponent(tokenCifrado)}`
  }, [tokenCifrado, username, campanaSlug])

  // Compartir por canales
  const compartir = async (canal: 'copiar' | 'wa_me' | 'piru') => {
    if (!enlace || !tokenCifrado || !urlPublica) return
    setAccion(canal)
    setError('')

    try {
      if (canal === 'copiar') {
        // Copiar inmediatamente al portapapeles sin bloqueos ni demoras
        await navigator.clipboard.writeText(urlPublica)
        toast.success('Enlace de micro-campaña copiado al portapapeles.')
        try {
          const respuesta = await crecimientoApi.copiarEnlace(token, enlace.id, {
            token: tokenCifrado,
            idempotenciaClave: nuevaClave(),
          })
          if (respuesta?.data?.url && respuesta.data.url !== urlPublica) {
            await navigator.clipboard.writeText(respuesta.data.url)
          }
        } catch (backendError) {
          console.warn('Registro de copiado en backend:', backendError)
        }
        return
      }

      const data = { token: tokenCifrado, idempotenciaClave: clave(canal) }

      if (canal === 'wa_me') {
        const respuesta = await crecimientoApi.abrirWaMe(token, enlace.id, data)
        if (!respuesta.data.waMeUrl) throw new Error('El cliente no tiene un teléfono válido para WhatsApp.')
        window.open(respuesta.data.waMeUrl, '_blank', 'noopener,noreferrer')
        toast.success('Abriendo WhatsApp con el mensaje listo.')
      } else {
        const respuesta = await crecimientoApi.enviarConPiru(token, enlace.id, data)
        if (!respuesta.data.entregado) throw new Error('El proveedor no confirmó el envío.')
        setSaldo((actual) => (actual == null ? actual : actual - 1))
        toast.success('Mensaje enviado mediante WhatsApp de Piru.')
      }
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : cause instanceof Error ? cause.message : 'No se pudo completar la acción.')
    } finally {
      setAccion(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-h-[92vh] overflow-x-hidden overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base">
                Micro-Campaña para {cliente?.nombre ?? 'este cliente'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Generá un enlace cifrado que activa la experiencia de compra ideal para este cliente.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!retencionActiva ? (
          <div className="flex flex-col items-center justify-center py-6 px-2 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
              <Lock className="h-5 w-5" />
            </div>
            <h3 className="mt-3.5 text-sm font-semibold tracking-tight text-foreground">
              Herramientas de retención requeridas
            </h3>
            <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
              Las micro-campañas y enlaces inteligentes con carrito precargado forman parte del módulo <strong>Herramientas de retención</strong> (+ $20.000/mes).
            </p>
            <div className="mt-5 flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  onOpenChange(false)
                  navigate('/dashboard/ajustes/retencion')
                }}
                className="rounded-full bg-emerald-600 px-5 text-xs font-medium text-white hover:bg-emerald-700"
              >
                Activar módulo
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="rounded-full text-xs"
              >
                Cerrar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="min-w-0 max-w-full space-y-4 pt-1">
              {/* Selector de Micro-Campaña */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 min-w-0">
                {/* Opción 1: Lo mismo de siempre */}
                <button
                  type="button"
                  onClick={() => cambiarCampana('lo_mismo')}
                  disabled={loading}
                  className={`relative min-w-0 rounded-xl border p-4 text-left transition-all ${
                    tipoCampana === 'lo_mismo'
                      ? 'border-emerald-500 bg-emerald-50/70 shadow-xs ring-2 ring-emerald-500/15 dark:bg-emerald-950/20'
                      : 'border-border bg-background hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <ShoppingBag className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-sm font-semibold tracking-tight truncate">¿Lo mismo de siempre?</span>
                    </div>
                    {recomendacionSegmento.tipo === 'lo_mismo' && (
                      <Badge className="shrink-0 bg-emerald-600 text-white hover:bg-emerald-600 text-[10px] px-2 py-0">
                        <Sparkles className="mr-1 h-2.5 w-2.5" /> Recomendada
                      </Badge>
                    )}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    Abre la tienda con su pedido anterior precargado en el drawer para confirmar en 1 click.
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                    <Badge variant="secondary" className="text-[10px]">Drawer 1-Toque</Badge>
                    <span>Sin descuento</span>
                  </div>
                </button>

                {/* Opción 2: Reactivación con Descuento */}
                <button
                  type="button"
                  onClick={() => cambiarCampana('reactivacion')}
                  disabled={loading}
                  className={`relative min-w-0 rounded-xl border p-4 text-left transition-all ${
                    tipoCampana === 'reactivacion'
                      ? 'border-emerald-500 bg-emerald-50/70 shadow-xs ring-2 ring-emerald-500/15 dark:bg-emerald-950/20'
                      : 'border-border bg-background hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <Gift className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />
                      <span className="text-sm font-semibold tracking-tight truncate">Reactivación</span>
                    </div>
                    {recomendacionSegmento.tipo === 'reactivacion' && (
                      <Badge className="shrink-0 bg-emerald-600 text-white hover:bg-emerald-600 text-[10px] px-2 py-0">
                        <Sparkles className="mr-1 h-2.5 w-2.5" /> Recomendada
                      </Badge>
                    )}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    Abre la tienda con un banner de bienvenida y el beneficio aplicado directamente a su pedido.
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-[11px] font-medium text-violet-700 dark:text-violet-400">
                    <Badge variant="secondary" className="text-[10px]">Banner Promocional</Badge>
                    <span>Con descuento</span>
                  </div>
                </button>
              </div>

              {/* Selector de descuento si la campaña es Reactivación */}
              {tipoCampana === 'reactivacion' && (
                <div className="min-w-0 rounded-xl border border-violet-200/70 bg-violet-50/50 p-3.5 dark:border-violet-900/50 dark:bg-violet-950/20">
                  <span className="text-xs font-semibold text-foreground">Beneficio aplicado:</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={descuento === 10 ? 'default' : 'outline'}
                      onClick={() => cambiarDescuento(10)}
                      disabled={loading}
                      className={`text-xs ${descuento === 10 ? 'bg-violet-600 hover:bg-violet-700 text-white' : ''}`}
                    >
                      10% OFF
                      {segmento === 'dormido' && <span className="ml-1.5 opacity-80">(Sugerido para dormidos)</span>}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={descuento === 20 ? 'default' : 'outline'}
                      onClick={() => cambiarDescuento(20)}
                      disabled={loading}
                      className={`text-xs ${descuento === 20 ? 'bg-violet-600 hover:bg-violet-700 text-white' : ''}`}
                    >
                      20% OFF · 48hs
                      {segmento === 'perdido' && <span className="ml-1.5 opacity-80">(Sugerido para perdidos)</span>}
                    </Button>
                  </div>
                </div>
              )}

              {/* Estado del Enlace y Botones de Acción */}
              {loading ? (
                <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando micro-campaña cifrada…
                </div>
              ) : enlace && urlPublica ? (
                <div className="min-w-0 space-y-3.5 overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-900 dark:text-emerald-100">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Micro-Campaña lista para compartir
                    </p>
                    <Badge variant="outline" className="border-emerald-300 bg-emerald-100/50 text-[10px] text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                      Token AES-256
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 min-w-0">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={accion != null}
                      onClick={() => void compartir('copiar')}
                      className="w-full text-xs font-medium bg-background/80 hover:bg-background border-emerald-300/80 dark:border-emerald-800/80"
                    >
                      {accion === 'copiar' ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Copy className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Copiar Enlace
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={accion != null}
                      onClick={() => void compartir('wa_me')}
                      className="w-full text-xs font-medium bg-background/80 hover:bg-background border-emerald-300/80 dark:border-emerald-800/80"
                    >
                      {accion === 'wa_me' ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Abrir WhatsApp
                    </Button>

                    <Button
                      size="sm"
                      disabled={accion != null || saldo === 0}
                      onClick={() => void compartir('piru')}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium"
                    >
                      {accion === 'piru' ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Enviar con Piru
                    </Button>
                  </div>

                  <p className="text-[11px] leading-relaxed text-emerald-900/70 dark:text-emerald-100/70">
                    Copiar o abrir WhatsApp no consume mensajes. Enviar con Piru consume 1 crédito marketing (saldo disponible: {saldo ?? '—'}).
                  </p>
                </div>
              ) : null}

              {error && (
                <p className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                  {error}
                </p>
              )}
            </div>

            <DialogFooter className="mt-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
