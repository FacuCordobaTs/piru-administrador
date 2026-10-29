import { useCallback, useEffect, useState } from 'react'
import {
  Clock,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  Send,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/settings-dialog'
import { useAuthStore } from '@/store/authStore'
import {
  zonasEspecialesApi,
  type DestinatarioZonaEspecial,
  type ZonaEspecial,
} from '@/lib/api'
import { cn, fmtARS } from '@/lib/utils'
import { useToggleAjuste } from '../hooks/useToggleAjuste'
import { SavedIndicator } from './SavedIndicator'

type FormZona = {
  nombre: string
  precio: string
  horaInicio: string
  horaFin: string
  activa: boolean
}

const FORM_VACIO: FormZona = {
  nombre: '',
  precio: '0',
  horaInicio: '17:00',
  horaFin: '20:00',
  activa: true,
}

const horaBonita = (hora: string) => hora.slice(0, 5)

function resumenZona(zona: ZonaEspecial) {
  const precio = fmtARS(zona.precio)
  const envio = precio === null || Number(zona.precio) === 0 ? 'Envío gratis' : `Envío ${precio}`
  return `${horaBonita(zona.horaInicio)} a ${horaBonita(zona.horaFin)} · ${envio}`
}

/**
 * Zonas especiales (countries / barrios cerrados). La sección entera sólo se
 * monta con el módulo de avisos automáticos activo: la plantilla de llegada es
 * parte de esa capacidad.
 */
export function ZonasEspecialesPanel() {
  const [zonas, setZonas] = useState<ZonaEspecial[]>([])
  const [cargando, setCargando] = useState(true)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editando, setEditando] = useState<ZonaEspecial | null>(null)
  const [form, setForm] = useState<FormZona>(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)

  const [avisoZona, setAvisoZona] = useState<ZonaEspecial | null>(null)
  const [destinatarios, setDestinatarios] = useState<DestinatarioZonaEspecial[]>([])
  const [cargandoAviso, setCargandoAviso] = useState(false)
  const [enviandoAviso, setEnviandoAviso] = useState(false)

  const habilitadas = useToggleAjuste(
    'zonasEspecialesHabilitadas',
    zonasEspecialesApi.toggleHabilitadas,
  )
  const prepedidos = useToggleAjuste(
    'permitirPrePedidosZonasEspeciales',
    zonasEspecialesApi.togglePrepedidos,
  )

  const cargar = useCallback(async () => {
    const token = useAuthStore.getState().token
    if (!token) return
    try {
      const res = await zonasEspecialesApi.getAll(token)
      if (res.success) setZonas(res.data)
    } catch {
      toast.error('No se pudieron cargar las zonas especiales')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  const abrirNueva = () => {
    setEditando(null)
    setForm(FORM_VACIO)
    setEditorOpen(true)
  }

  const abrirEdicion = (zona: ZonaEspecial) => {
    setEditando(zona)
    setForm({
      nombre: zona.nombre,
      precio: zona.precio,
      horaInicio: horaBonita(zona.horaInicio),
      horaFin: horaBonita(zona.horaFin),
      activa: zona.activa,
    })
    setEditorOpen(true)
  }

  const guardar = async () => {
    const token = useAuthStore.getState().token
    if (!token) return
    if (!form.nombre.trim()) {
      toast.error('Poné un nombre para la zona')
      return
    }
    const precio = Number(form.precio)
    if (!Number.isFinite(precio) || precio < 0) {
      toast.error('El precio de envío no es válido')
      return
    }
    if (!form.horaInicio || !form.horaFin) {
      toast.error('Completá el horario de entrega')
      return
    }
    if (form.horaInicio === form.horaFin) {
      toast.error('La hora de fin debe ser distinta a la de inicio')
      return
    }

    setGuardando(true)
    try {
      const payload = {
        nombre: form.nombre.trim(),
        precio: precio.toFixed(2),
        horaInicio: form.horaInicio,
        horaFin: form.horaFin,
        activa: form.activa,
      }
      const res = editando
        ? await zonasEspecialesApi.update(token, editando.id, payload)
        : await zonasEspecialesApi.create(token, payload)
      if (!res.success) {
        toast.error((res as { message?: string }).message || 'No se pudo guardar la zona')
        return
      }
      setEditorOpen(false)
      toast.success(editando ? 'Zona actualizada' : 'Zona creada')
      await cargar()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la zona')
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (zona: ZonaEspecial) => {
    if (!window.confirm(`¿Eliminar "${zona.nombre}"? Si no hay pedidos pendientes, los pedidos ya creados conservan su historial.`)) return
    const token = useAuthStore.getState().token
    if (!token) return
    try {
      const res = await zonasEspecialesApi.delete(token, zona.id)
      if (!res.success) {
        toast.error(res.message || 'No se pudo eliminar la zona')
        return
      }
      toast.success('Zona eliminada')
      await cargar()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar la zona')
    }
  }

  const alternarActiva = async (zona: ZonaEspecial) => {
    const token = useAuthStore.getState().token
    if (!token) return
    const activa = !zona.activa
    setZonas((prev) => prev.map((z) => z.id === zona.id ? { ...z, activa } : z))
    try {
      const res = await zonasEspecialesApi.update(token, zona.id, { activa })
      if (!res.success) throw new Error()
    } catch {
      setZonas((prev) => prev.map((z) => z.id === zona.id ? { ...z, activa: zona.activa } : z))
      toast.error('No se pudo cambiar el estado de la zona')
    }
  }

  const abrirAviso = async (zona: ZonaEspecial) => {
    setAvisoZona(zona)
    setDestinatarios([])
    setCargandoAviso(true)
    const token = useAuthStore.getState().token
    if (!token) return
    try {
      const res = await zonasEspecialesApi.destinatarios(token, zona.id)
      if (res.success) setDestinatarios(res.data.destinatarios)
      else toast.error('No se pudieron cargar los pedidos de la zona')
    } catch {
      toast.error('No se pudieron cargar los pedidos de la zona')
    } finally {
      setCargandoAviso(false)
    }
  }

  const enviarAviso = async () => {
    if (!avisoZona) return
    const token = useAuthStore.getState().token
    if (!token) return
    setEnviandoAviso(true)
    try {
      const res = await zonasEspecialesApi.enviarLlegada(token, avisoZona.id)
      if (!res.success) {
        toast.error(res.message || 'No se pudieron enviar los avisos')
        return
      }
      toast.success(res.message)
      setAvisoZona(null)
      await cargar()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron enviar los avisos')
    } finally {
      setEnviandoAviso(false)
    }
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/60 px-4 py-3.5">
        <div className="max-w-xl space-y-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">Mostrar countries en la tienda</p>
            <SavedIndicator status={habilitadas.status} />
          </div>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Apagado por defecto: no se muestra ninguna opción de country ni se consultan zonas en el checkout hasta que lo actives.
          </p>
        </div>
        <Switch
          checked={habilitadas.checked}
          onCheckedChange={habilitadas.toggle}
          aria-label="Mostrar countries en la tienda"
        />
      </div>

      {!habilitadas.checked && (
        <div className="rounded-xl bg-muted/50 px-4 py-3 text-[13px] text-muted-foreground">
          Countries está oculto en la tienda. Podés dejar las zonas configuradas y activarlo cuando quieras.
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-xl space-y-1">
          <p className="text-sm font-medium text-foreground">Countries y barrios cerrados</p>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Cada zona tiene su horario de entrega. El cliente elige el country en el checkout y el pedido se entrega en su puerta.
          </p>
        </div>
        <Button type="button" onClick={abrirNueva} className="gap-2">
          <Plus className="size-4" />
          Nueva zona
        </Button>
      </div>

      {cargando ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : zonas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-5 py-8 text-center">
          <p className="text-sm font-medium">Todavía no cargaste zonas especiales</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Creá el primer country con su horario de entrega y su costo de envío.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60">
          {zonas.map((zona) => (
            <div
              key={zona.id}
              className={cn(
                'flex flex-wrap items-center gap-3 border-b border-border/50 px-4 py-4 last:border-b-0',
                !zona.activa && 'opacity-60',
              )}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium">{zona.nombre}</p>
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-medium',
                    zona.enVentana ? 'bg-emerald-500/10 text-emerald-700' : 'bg-muted text-muted-foreground',
                  )}>
                    {zona.enVentana ? 'En ventana' : 'Fuera de ventana'}
                  </span>
                  {!zona.activa && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      Desactivada
                    </span>
                  )}
                </div>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-muted-foreground">
                  <Clock className="size-3.5 shrink-0" />
                  <span>{resumenZona(zona)}</span>
                  {zona.proximaVentana && <span className="text-muted-foreground/70">· Próxima: {zona.proximaVentana}</span>}
                </p>
                {(zona.pedidosPendientes ?? 0) > 0 && (
                  <p className="text-[12px] font-medium text-foreground/70">
                    {zona.pedidosPendientes} {zona.pedidosPendientes === 1 ? 'pedido pendiente' : 'pedidos pendientes'}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Switch
                  checked={zona.activa}
                  onCheckedChange={() => void alternarActiva(zona)}
                  aria-label={`Activar ${zona.nombre}`}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="gap-1.5"
                  onClick={() => void abrirAviso(zona)}
                  disabled={!zona.activa}
                >
                  <Send className="size-3.5" />
                  Enviar mensajes
                </Button>
                <Button type="button" size="icon" variant="ghost" onClick={() => abrirEdicion(zona)} aria-label={`Editar ${zona.nombre}`}>
                  <Pencil className="size-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" onClick={() => void eliminar(zona)} aria-label={`Eliminar ${zona.nombre}`}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/60 px-4 py-3.5">
        <div className="max-w-xl space-y-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">Permitir pedidos pre ordenados</p>
            <SavedIndicator status={prepedidos.status} />
          </div>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Deja armar el pedido fuera de la ventana de entrega (o con el local cerrado) para la próxima entrega del country.
          </p>
        </div>
        <Switch
          checked={prepedidos.checked}
          onCheckedChange={prepedidos.toggle}
          aria-label="Permitir pedidos pre ordenados"
        />
      </div>

      <p className="text-[12px] leading-relaxed text-muted-foreground">
        El botón “Enviar mensajes” usa la plantilla de utilidad <span className="font-mono">zona_especial_llegada_v1</span> (aprobada en Meta) desde el WhatsApp del local. También podés abrir cada chat y avisarle a mano.
      </p>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar zona especial' : 'Nueva zona especial'}</DialogTitle>
            <DialogDescription>
              El horario es la ventana en la que el local entrega en esa zona.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="zona-especial-nombre">Nombre</Label>
              <Input
                id="zona-especial-nombre"
                value={form.nombre}
                onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
                placeholder="Ej: Country Los Aromos"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="zona-especial-inicio">Entrega desde</Label>
                <Input
                  id="zona-especial-inicio"
                  type="time"
                  value={form.horaInicio}
                  onChange={(e) => setForm((prev) => ({ ...prev, horaInicio: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="zona-especial-fin">Entrega hasta</Label>
                <Input
                  id="zona-especial-fin"
                  type="time"
                  value={form.horaFin}
                  onChange={(e) => setForm((prev) => ({ ...prev, horaFin: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="zona-especial-precio">Costo de envío</Label>
              <Input
                id="zona-especial-precio"
                type="number"
                min="0"
                step="0.01"
                value={form.precio}
                onChange={(e) => setForm((prev) => ({ ...prev, precio: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between gap-4 py-1">
              <div>
                <p className="text-sm font-medium">Zona activa</p>
                <p className="text-[13px] text-muted-foreground">Si la apagás, no se ofrece en el checkout.</p>
              </div>
              <Switch
                checked={form.activa}
                onCheckedChange={(activa) => setForm((prev) => ({ ...prev, activa }))}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setEditorOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => void guardar()} disabled={guardando}>
                {guardando && <Loader2 className="mr-2 size-4 animate-spin" />}
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!avisoZona} onOpenChange={(open) => { if (!open) setAvisoZona(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Avisar llegada a {avisoZona?.nombre}</DialogTitle>
            <DialogDescription>
              Se avisa a los pedidos pendientes de esta zona que el pedido está en la puerta. Un mensaje por teléfono.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {cargandoAviso ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : destinatarios.length === 0 ? (
              <div className="rounded-xl bg-muted/50 px-4 py-5 text-center text-sm text-muted-foreground">
                No hay pedidos pendientes en esta zona.
              </div>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {destinatarios.map((destinatario) => (
                  <div key={destinatario.pedidoId} className="flex items-center justify-between gap-3 rounded-xl bg-secondary/50 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{destinatario.nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        Pedido #{destinatario.pedidoId} · {destinatario.telefono}
                        {destinatario.createdAt && ` · ${new Date(destinatario.createdAt).toLocaleDateString('es-AR')}`}
                      </p>
                    </div>
                    {destinatario.waLink ? (
                      <a
                        href={destinatario.waLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                      >
                        <MessageCircle className="size-3.5" />
                        WhatsApp
                      </a>
                    ) : (
                      <span className="shrink-0 text-xs text-muted-foreground">Sin WhatsApp válido</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Se avisa a todos los pedidos pendientes de la zona (incluidos los pre-pedidos). El envío automático usa la plantilla de Meta y descuenta un mensaje utility del saldo del local.
            </p>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setAvisoZona(null)}>
                Cerrar
              </Button>
              <Button
                type="button"
                className="gap-2"
                onClick={() => void enviarAviso()}
                disabled={cargandoAviso || enviandoAviso || destinatarios.length === 0}
              >
                {enviandoAviso ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Enviar avisos
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
