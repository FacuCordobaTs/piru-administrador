import { useState, useEffect, useMemo, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuthStore } from '@/store/authStore'
import { codigosDescuentoApi } from '@/lib/api'
import { toast } from 'sonner'
import {
  Search,
  Plus,
  Tag,
  Percent,
  DollarSign,
  Users,
  MoreVertical,
  Copy,
  Power,
  PowerOff,
  Trash2,
  Pencil,
  Ticket,
  Loader2,
} from 'lucide-react'

// --- Types ---
interface CodigoDescuento {
  id: number
  restauranteId: number
  codigo: string
  tipo: 'porcentaje' | 'monto_fijo'
  valor: string
  limiteUsos: number | null
  usosActuales: number
  montoMinimo: string
  fechaInicio: string | null
  fechaFin: string | null
  activo: boolean
  createdAt: string
}

// --- Utility functions ---
const formatCurrency = (value: number | string) => {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(num)
}

const formatValorDescuento = (c: CodigoDescuento) => {
  if (c.tipo === 'porcentaje') return `${c.valor}%`
  return formatCurrency(c.valor)
}

const isVigente = (c: CodigoDescuento) => {
  if (!c.activo) return false
  const now = new Date()
  if (c.fechaInicio && new Date(c.fechaInicio) > now) return false
  if (c.fechaFin && new Date(c.fechaFin) < now) return false
  if (c.limiteUsos !== null && c.usosActuales >= c.limiteUsos) return false
  return true
}

// --- Form default ---
type FormTipo = 'porcentaje' | 'monto_fijo'
const defaultForm: {
  codigo: string
  tipo: FormTipo
  valor: string
  limiteUsos: number | null
  montoMinimo: string
  fechaInicio: string
  fechaFin: string
} = {
  codigo: '',
  tipo: 'porcentaje',
  valor: '',
  limiteUsos: null,
  montoMinimo: '0',
  fechaInicio: '',
  fechaFin: '',
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================
export default function CodigosDescuento() {
  const token = useAuthStore((state) => state.token)
  const [codigos, setCodigos] = useState<CodigoDescuento[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(defaultForm)
  const [saving, setSaving] = useState(false)

  const fetchCodigos = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const response = (await codigosDescuentoApi.getAll(token)) as { success: boolean; data: CodigoDescuento[] }
      if (response.success && response.data) {
        setCodigos(response.data)
      }
    } catch (error) {
      console.error('Error fetching códigos:', error)
      toast.error('Error al cargar códigos de descuento')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchCodigos()
  }, [fetchCodigos])

  const filtered = useMemo(() => {
    if (!query.trim()) return codigos
    const q = query.toLowerCase()
    return codigos.filter(
      (c) =>
        c.codigo.toLowerCase().includes(q) ||
        formatValorDescuento(c).toLowerCase().includes(q)
    )
  }, [codigos, query])

  const stats = useMemo(() => {
    const total = codigos.length
    const activos = codigos.filter((c) => c.activo).length
    const vigentes = codigos.filter(isVigente).length
    const usosTotales = codigos.reduce((acc, c) => acc + (c.usosActuales || 0), 0)
    return { total, activos, vigentes, usosTotales }
  }, [codigos])

  const openCreate = () => {
    setEditingId(null)
    setForm(defaultForm)
    setDialogOpen(true)
  }

  const openEdit = (c: CodigoDescuento) => {
    setEditingId(c.id)
    setForm({
      codigo: c.codigo,
      tipo: c.tipo,
      valor: c.valor,
      limiteUsos: c.limiteUsos,
      montoMinimo: c.montoMinimo || '0',
      fechaInicio: c.fechaInicio ? c.fechaInicio.slice(0, 16) : '',
      fechaFin: c.fechaFin ? c.fechaFin.slice(0, 16) : '',
    })
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    if (!form.codigo.trim()) {
      toast.error('El código es obligatorio')
      return
    }
    if (!form.valor.trim()) {
      toast.error('El valor es obligatorio')
      return
    }
    setSaving(true)
    try {
      const payload = {
        codigo: form.codigo.trim().toUpperCase(),
        tipo: form.tipo,
        valor: form.valor,
        limiteUsos: form.limiteUsos,
        montoMinimo: form.montoMinimo || '0',
        fechaInicio: form.fechaInicio ? new Date(form.fechaInicio).toISOString() : null,
        fechaFin: form.fechaFin ? new Date(form.fechaFin).toISOString() : null,
      }
      if (editingId) {
        const res = (await codigosDescuentoApi.update(token, editingId, payload)) as { success: boolean }
        if (res.success) {
          toast.success('Código actualizado')
          setDialogOpen(false)
          fetchCodigos()
        } else {
          toast.error('Error al actualizar')
        }
      } else {
        const res = (await codigosDescuentoApi.create(token, payload)) as { success: boolean; message?: string }
        if (res.success) {
          toast.success('Código creado')
          setDialogOpen(false)
          fetchCodigos()
        } else {
          toast.error(res.message || 'Error al crear')
        }
      }
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Error'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (id: number) => {
    if (!token) return
    try {
      const res = (await codigosDescuentoApi.toggle(token, id)) as { success: boolean }
      if (res.success) {
        toast.success('Estado actualizado')
        fetchCodigos()
      }
    } catch {
      toast.error('Error al cambiar estado')
    }
  }

  const handleDelete = async (id: number) => {
    if (!token) return
    if (!confirm('¿Eliminar este código de descuento?')) return
    try {
      const res = (await codigosDescuentoApi.delete(token, id)) as { success: boolean }
      if (res.success) {
        toast.success('Código eliminado')
        fetchCodigos()
      }
    } catch {
      toast.error('Error al eliminar')
    }
  }

  const copyCodigo = (codigo: string) => {
    navigator.clipboard.writeText(codigo)
    toast.success('Código copiado')
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* TOP HEADER — KPI Strip */}
      <div className="border-b bg-background/80 backdrop-blur-xl sticky top-0 z-20">
        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">Códigos de Descuento</h1>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                {stats.total} códigos · {stats.usosTotales} usos totales
              </p>
            </div>
            <Button onClick={openCreate} className="h-9 gap-2">
              <Plus className="w-4 h-4" />
              Nuevo código
            </Button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KPICard
              label="Total"
              value={stats.total.toString()}
              icon={<Tag className="w-4 h-4" />}
              color="text-blue-600 dark:text-blue-400"
              bgColor="bg-blue-50 dark:bg-blue-950/50"
            />
            <KPICard
              label="Activos"
              value={stats.activos.toString()}
              icon={<Power className="w-4 h-4" />}
              color="text-emerald-600 dark:text-emerald-400"
              bgColor="bg-emerald-50 dark:bg-emerald-950/50"
            />
            <KPICard
              label="Vigentes"
              value={stats.vigentes.toString()}
              icon={<Ticket className="w-4 h-4" />}
              color="text-violet-600 dark:text-violet-400"
              bgColor="bg-violet-50 dark:bg-violet-950/50"
            />
            <KPICard
              label="Usos totales"
              value={stats.usosTotales.toString()}
              icon={<Users className="w-4 h-4" />}
              color="text-amber-600 dark:text-amber-400"
              bgColor="bg-amber-50 dark:bg-amber-950/50"
            />
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex flex-col border-r bg-background w-full max-w-2xl mx-auto lg:mx-0 lg:max-w-none shrink-0">
          <div className="px-4 py-3 border-b bg-muted/30">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por código..."
                className="w-full h-9 pl-9 pr-4 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 transition-all"
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            {loading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-[88px] w-full rounded-lg" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Tag className="w-5 h-5 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-medium text-foreground">Sin códigos</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
                  {query ? 'No hay códigos que coincidan con tu búsqueda.' : 'Creá tu primer código de descuento para promociones.'}
                </p>
                {!query && (
                  <Button onClick={openCreate} variant="outline" size="sm" className="mt-4">
                    <Plus className="w-4 h-4 mr-2" />
                    Crear código
                  </Button>
                )}
              </div>
            ) : (
              <div className="py-1">
                {filtered.map((c) => (
                  <CodigoRow
                    key={c.id}
                    codigo={c}
                    onEdit={() => openEdit(c)}
                    onToggle={() => handleToggle(c.id)}
                    onDelete={() => handleDelete(c.id)}
                    onCopy={() => copyCodigo(c.codigo)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar código' : 'Nuevo código de descuento'}</DialogTitle>
            <DialogDescription>
              Los clientes podrán usar este código al finalizar su pedido. El código se convierte automáticamente a mayúsculas.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="codigo">Código</Label>
              <Input
                id="codigo"
                value={form.codigo}
                onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                placeholder="Ej: ALFAJOROPEN"
                className="font-mono uppercase"
                maxLength={50}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={form.tipo}
                  onValueChange={(v) => setForm((f) => ({ ...f, tipo: v as FormTipo }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="porcentaje">Porcentaje</SelectItem>
                    <SelectItem value="monto_fijo">Monto fijo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="valor">Valor</Label>
                <Input
                  id="valor"
                  type={form.tipo === 'porcentaje' ? 'number' : 'text'}
                  min={form.tipo === 'porcentaje' ? 1 : undefined}
                  max={form.tipo === 'porcentaje' ? 100 : undefined}
                  value={form.valor}
                  onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
                  placeholder={form.tipo === 'porcentaje' ? '10' : '500'}
                />
                <p className="text-[11px] text-muted-foreground">
                  {form.tipo === 'porcentaje' ? 'Porcentaje (1-100)' : 'Monto en pesos'}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="limiteUsos">Límite de usos (opcional)</Label>
              <Input
                id="limiteUsos"
                type="number"
                min={0}
                value={form.limiteUsos ?? ''}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    limiteUsos: e.target.value === '' ? null : parseInt(e.target.value, 10) || 0,
                  }))
                }
                placeholder="Ilimitado"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="montoMinimo">Monto mínimo (opcional)</Label>
              <Input
                id="montoMinimo"
                type="text"
                value={form.montoMinimo}
                onChange={(e) => setForm((f) => ({ ...f, montoMinimo: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fechaInicio">Válido desde</Label>
                <Input
                  id="fechaInicio"
                  type="datetime-local"
                  value={form.fechaInicio}
                  onChange={(e) => setForm((f) => ({ ...f, fechaInicio: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fechaFin">Válido hasta</Label>
                <Input
                  id="fechaFin"
                  type="datetime-local"
                  value={form.fechaFin}
                  onChange={(e) => setForm((f) => ({ ...f, fechaFin: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {saving ? ' Guardando...' : editingId ? 'Guardar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function KPICard({
  label,
  value,
  icon,
  color,
  bgColor,
}: {
  label: string
  value: string
  icon: React.ReactNode
  color: string
  bgColor: string
}) {
  return (
    <div className="flex items-center gap-3 bg-background border border-border/50 rounded-xl px-4 py-3">
      <div className={`w-9 h-9 rounded-lg ${bgColor} flex items-center justify-center ${color} shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">{label}</p>
        <p className="text-base font-bold text-foreground tabular-nums truncate mt-0.5">{value}</p>
      </div>
    </div>
  )
}

function CodigoRow({
  codigo,
  onEdit,
  onToggle,
  onDelete,
  onCopy,
}: {
  codigo: CodigoDescuento
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
  onCopy: () => void
}) {
  const vigente = isVigente(codigo)
  const agotado = codigo.limiteUsos !== null && codigo.usosActuales >= codigo.limiteUsos

  return (
    <div className="w-full text-left px-4 py-3 flex items-center gap-3 border-b border-border/30 hover:bg-muted/50 transition-colors">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          vigente ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'
        }`}
      >
        {codigo.tipo === 'porcentaje' ? (
          <Percent className="w-5 h-5" />
        ) : (
          <DollarSign className="w-5 h-5" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold font-mono text-foreground">{codigo.codigo}</span>
          {!codigo.activo && (
            <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
              Inactivo
            </Badge>
          )}
          {codigo.activo && agotado && (
            <Badge variant="outline" className="text-[10px] bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400">
              Agotado
            </Badge>
          )}
          {vigente && (
            <Badge variant="outline" className="text-[10px] bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400">
              Vigente
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
          <span>{formatValorDescuento(codigo)}</span>
          {codigo.limiteUsos !== null && (
            <>
              <span className="text-border">·</span>
              <span>
                {codigo.usosActuales}/{codigo.limiteUsos} usos
              </span>
            </>
          )}
          {parseFloat(codigo.montoMinimo || '0') > 0 && (
            <>
              <span className="text-border">·</span>
              <span>Mín. {formatCurrency(codigo.montoMinimo)}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onCopy} title="Copiar código">
          <Copy className="w-3.5 h-3.5" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="w-4 h-4 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onToggle}>
              {codigo.activo ? (
                <>
                  <PowerOff className="w-4 h-4 mr-2" />
                  Desactivar
                </>
              ) : (
                <>
                  <Power className="w-4 h-4 mr-2" />
                  Activar
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
