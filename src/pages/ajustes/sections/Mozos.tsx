import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Loader2, Plus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { staffApi, type UsuarioStaff } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useModuloActivo } from '@/store/modulosStore'
import { useSucursales } from '../hooks/useSucursales'

const ROL_LABEL: Record<UsuarioStaff['rol'], string> = {
  owner: 'Dueño',
  admin: 'Admin',
  mozo: 'Mozo',
}

const fmtFecha = (iso: string) => {
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return iso
  return fecha.toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function EstadoUsuario({ usuario }: { usuario: UsuarioStaff }) {
  if (!usuario.activo) return <Badge variant="secondary" className="font-normal">Inactivo</Badge>
  if (usuario.bloqueadoHasta) {
    return <Badge variant="outline" className="border-amber-400/40 bg-amber-50 font-normal text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">PIN bloqueado hasta {fmtFecha(usuario.bloqueadoHasta)}</Badge>
  }
  return <Badge variant="secondary" className="border-emerald-500/30 bg-emerald-50 font-normal text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">Activo</Badge>
}

export default function Mozos() {
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.token)
  const posActivo = useModuloActivo('pos')
  const mesasActivo = useModuloActivo('mesas')
  const { sucursales, loaded: sucursalesCargadas } = useSucursales()

  const [usuarios, setUsuarios] = useState<UsuarioStaff[] | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  // Dialog de creación: el backend asigna un numero corto dentro del local.
  const [crearAbierto, setCrearAbierto] = useState(false)
  const [form, setForm] = useState({ nombre: '', rol: 'mozo' as 'mozo' | 'admin', sucursalId: '' })
  const [numeroCreado, setNumeroCreado] = useState<{ nombre: string; numero: number } | null>(null)
  const [guardando, setGuardando] = useState(false)

  const [editando, setEditando] = useState<UsuarioStaff | null>(null)
  const [formEditar, setFormEditar] = useState({ nombre: '', sucursalId: '', activo: true })

  const cargar = useCallback(async () => {
    if (!token) return
    setCargando(true)
    setError('')
    try {
      const res = await staffApi.list(token)
      setUsuarios(res.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos cargar los usuarios de staff.')
    } finally {
      setCargando(false)
    }
  }, [token])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const abrirCrear = () => {
    setForm({ nombre: '', rol: 'mozo', sucursalId: sucursales.length === 1 ? String(sucursales[0].id) : '__ninguna__' })
    setNumeroCreado(null)
    setCrearAbierto(true)
  }

  const crear = async () => {
    if (!token) return
    const nombre = form.nombre.trim()
    if (!nombre) return toast.error('Ingresá el nombre del mozo')
    setGuardando(true)
    try {
      const res = await staffApi.create(token, {
        nombre,
        rol: form.rol,
        sucursalId: form.sucursalId && form.sucursalId !== '__ninguna__' ? Number(form.sucursalId) : null,
      })
      setNumeroCreado({ nombre, numero: res.data.numeroMozo })
      void cargar()
    } catch (e) {
      toast.error('No pudimos crear el usuario', { description: e instanceof Error ? e.message : 'Intentá de nuevo.' })
    } finally {
      setGuardando(false)
    }
  }

  const abrirEditar = (usuario: UsuarioStaff) => {
    setEditando(usuario)
    setFormEditar({
      nombre: usuario.nombre,
      sucursalId: usuario.sucursalId != null ? String(usuario.sucursalId) : '__ninguna__',
      activo: usuario.activo,
    })
  }

  const guardarEdicion = async () => {
    if (!editando || !token) return
    const nombre = formEditar.nombre.trim()
    if (!nombre) return toast.error('El nombre no puede quedar vacío')
    setGuardando(true)
    try {
      await staffApi.update(token, editando.id, {
        nombre,
        sucursalId: formEditar.sucursalId && formEditar.sucursalId !== '__ninguna__' ? Number(formEditar.sucursalId) : null,
        activo: formEditar.activo,
      })
      setEditando(null)
      toast.success('Mozo actualizado')
      void cargar()
    } catch (e) {
      toast.error('No pudimos actualizar el usuario', { description: e instanceof Error ? e.message : 'Intentá de nuevo.' })
    } finally {
      setGuardando(false)
    }
  }

  const hayCambiosSensibles = editando != null && !formEditar.activo
  const modulosFaltan = !posActivo || !mesasActivo
  // Owner primero, luego admins y mozos; por antigüedad dentro de cada rol.
  const ordenados = useMemo(() => (usuarios ?? []).slice().sort(ordenarStaff), [usuarios])
  const sucursalDe = (id: number) => sucursales.find((s) => s.id === id)?.nombre

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-lg font-medium text-foreground">Mozos</h2>
        <p className="text-sm font-normal text-muted-foreground">
          Cada mozo entra con su número y un código enviado al WhatsApp del local.
        </p>
      </header>

      {modulosFaltan && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-400/25 bg-amber-50 p-4 text-sm dark:bg-amber-950/30">
          <Users className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium text-foreground">La app de mozos requiere los módulos POS y Mesas activos</p>
            <p className="mt-0.5 text-muted-foreground">Podés crear los accesos igual, pero los mozos no van a poder operar hasta activarlos.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/dashboard/modulos')}>Ver módulos</Button>
          </div>
        </div>
      )}

      {cargando && usuarios == null ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : error && usuarios == null ? (
        <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-6 text-center">
          <p className="font-medium text-foreground">No pudimos cargar los usuarios de staff</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <Button className="mt-4" variant="outline" onClick={() => void cargar()}>Reintentar</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {ordenados.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-8 text-center">
              <Users className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-3 font-medium text-foreground">Todavía no hay mozos</p>
              <p className="mt-1 text-sm text-muted-foreground">Creá el primer acceso. Piru le asigna un número simple dentro de tu local.</p>
              <Button className="mt-4" onClick={abrirCrear}><Plus className="h-4 w-4" />Agregar mozo</Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">{ordenados.length} {ordenados.length === 1 ? 'usuario' : 'usuarios'} de staff</p>
                <Button onClick={abrirCrear}><Plus className="h-4 w-4" />Agregar mozo</Button>
              </div>
              <ul className="divide-y rounded-2xl border border-border/60 bg-white dark:bg-muted/40">
                {ordenados.map((usuario) => (
                  <li key={usuario.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 sm:flex-nowrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">{usuario.nombre}</p>
                        <Badge variant={usuario.rol === 'owner' ? 'default' : usuario.rol === 'admin' ? 'outline' : 'secondary'} className="font-normal">
                          {ROL_LABEL[usuario.rol]}
                        </Badge>
                        <EstadoUsuario usuario={usuario} />
                      </div>
                      {usuario.numeroMozo != null && (
                        <p className="mt-1 text-sm text-muted-foreground">Número de mozo <span className="font-mono font-semibold text-foreground">#{usuario.numeroMozo}</span></p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-0.5 text-xs text-muted-foreground">
                      <span>{usuario.sucursalId != null ? `Sucursal: ${sucursalDe(usuario.sucursalId) ?? `#${usuario.sucursalId}`}` : 'Sin sucursal'}</span>
                      <span>{usuario.ultimoAccesoAt ? `Último acceso: ${fmtFecha(usuario.ultimoAccesoAt)}` : 'Nunca ingresó'}</span>
                    </div>
                    {usuario.rol !== 'owner' && (
                      <Button variant="ghost" size="sm" onClick={() => abrirEditar(usuario)}>Editar</Button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* ── Crear: formulario ── */}
      <Dialog open={crearAbierto} onOpenChange={(abierto) => { if (!abierto && !guardando) { setCrearAbierto(false); setNumeroCreado(null) } }}>
        <DialogContent className="sm:max-w-md">
          {numeroCreado ? (
            <>
              <DialogHeader>
                <DialogTitle>{numeroCreado.nombre} ya puede entrar</DialogTitle>
                <DialogDescription>
                  Sólo necesita este número y el WhatsApp del local. Piru enviará un código de 6 dígitos al iniciar el turno.
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-2xl bg-muted/55 p-5 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Número de mozo</p>
                <p className="mt-2 font-mono text-4xl font-semibold text-foreground">#{numeroCreado.numero}</p>
              </div>
              <DialogFooter>
                <Button onClick={() => { setCrearAbierto(false); setNumeroCreado(null) }}>Listo</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Agregar mozo</DialogTitle>
                <DialogDescription>
                  Le asignaremos automáticamente el próximo número disponible en tu local.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="font-medium">Nombre</Label>
                  <Input
                    value={form.nombre}
                    onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                    placeholder="Ej: Juan Pérez"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-medium">Rol</Label>
                  <Select value={form.rol} onValueChange={(v) => setForm((p) => ({ ...p, rol: v as 'mozo' | 'admin' }))}>
                    <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mozo">Mozo</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {sucursalesCargadas && sucursales.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="font-medium">Sucursal</Label>
                    <Select value={form.sucursalId} onValueChange={(v) => setForm((p) => ({ ...p, sucursalId: v }))}>
                      <SelectTrigger className="h-11 w-full"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__ninguna__">Sin asignar</SelectItem>
                        {sucursales.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-xs font-normal text-muted-foreground">Sin sucursal, el mozo opera sobre todo el restaurante.</p>
                  </div>
                )}
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="outline" disabled={guardando} onClick={() => setCrearAbierto(false)}>Cancelar</Button>
                <Button disabled={guardando} onClick={() => void crear()}>{guardando && <Loader2 className="h-4 w-4 animate-spin" />}Crear acceso</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Editar ── */}
      <Dialog open={Boolean(editando)} onOpenChange={(abierto) => !guardando && !abierto && setEditando(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar {editando?.nombre}</DialogTitle>
            <DialogDescription>
              El número de mozo no cambia. El acceso se valida por WhatsApp en cada dispositivo nuevo.
            </DialogDescription>
          </DialogHeader>
          {editando && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="font-medium">Nombre</Label>
                <Input
                  value={formEditar.nombre}
                  onChange={(e) => setFormEditar((p) => ({ ...p, nombre: e.target.value }))}
                  className="h-11"
                />
              </div>
              {sucursalesCargadas && sucursales.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="font-medium">Sucursal</Label>
                  <Select value={formEditar.sucursalId} onValueChange={(v) => setFormEditar((p) => ({ ...p, sucursalId: v }))}>
                    <SelectTrigger className="h-11 w-full"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__ninguna__">Sin asignar</SelectItem>
                      {sucursales.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Acceso activo</p>
                  <p className="text-xs font-normal text-muted-foreground">
                    Al desactivar, el mozo no puede abrir turno y sus sesiones activas se cierran.
                  </p>
                </div>
                <Switch
                  checked={formEditar.activo}
                  onCheckedChange={(v) => setFormEditar((p) => ({ ...p, activo: v }))}
                />
              </div>
              {hayCambiosSensibles && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Al desactivar el acceso, las sesiones abiertas del mozo se revocan al instante.
                </p>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" disabled={guardando} onClick={() => setEditando(null)}>Cancelar</Button>
            <Button disabled={guardando} onClick={() => void guardarEdicion()}>{guardando && <Loader2 className="h-4 w-4 animate-spin" />}Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

const ordenarStaff = (a: UsuarioStaff, b: UsuarioStaff) => {
  const peso = { owner: 0, admin: 1, mozo: 2 } as const
  const porRol = peso[a.rol] - peso[b.rol]
  if (porRol !== 0) return porRol
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
}
