import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, Loader2, Edit, Sparkles, Power, PowerOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { restauranteApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { FranjaDialog, type FranjaHorario } from '../../components/FranjaDialog'
import { useToggleAjuste } from '../../hooks/useToggleAjuste'
import type { Horarios as HorariosData } from './resumirHorarios'

function nombreDeFranja(inicio: string): string {
  const hora = parseInt(inicio.slice(0, 2), 10)
  if (hora < 12) return 'Mañana'
  if (hora < 18) return 'Tarde'
  return 'Noche'
}

/** Propone franjas a partir de los turnos de apertura (propuesta corregible). */
function sugerirFranjas(horarios: HorariosData) {
  const unicos = new Map<string, { horaInicio: string; horaFin: string }>()
  for (const turnos of Object.values(horarios)) {
    for (const t of turnos) {
      unicos.set(`${t.horaApertura}-${t.horaCierre}`, {
        horaInicio: t.horaApertura,
        horaFin: t.horaCierre,
      })
    }
  }
  return [...unicos.values()].map((v) => ({
    nombre: nombreDeFranja(v.horaInicio),
    horaInicio: v.horaInicio,
    horaFin: v.horaFin,
    activo: true,
  }))
}

export function ProgramadosEditor({ horarios }: { horarios: HorariosData }) {
  const restaurante = useRestauranteStore((s) => s.restaurante)
  const programados = useToggleAjuste(
    'permitirPedidosProgramados',
    restauranteApi.togglePermitirPedidosProgramados
  )
  const solo = useToggleAjuste('soloPedidosProgramados', restauranteApi.toggleSoloPedidosProgramados)

  const [franjas, setFranjas] = useState<FranjaHorario[]>([])
  const [franjasLoaded, setFranjasLoaded] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<FranjaHorario | null>(null)
  const [generando, setGenerando] = useState(false)

  const cargarFranjas = useCallback(async () => {
    const token = useAuthStore.getState().token
    if (!token) return
    try {
      const res = (await restauranteApi.getFranjasHorario(token)) as {
        success: boolean
        franjas: FranjaHorario[]
      }
      if (res.success) setFranjas(res.franjas)
    } finally {
      setFranjasLoaded(true)
    }
  }, [])

  // Las franjas SOLO existen en la UI cuando pedidos programados está activo.
  useEffect(() => {
    if (programados.checked) void cargarFranjas()
    else {
      setFranjas([])
      setFranjasLoaded(false)
    }
  }, [programados.checked, cargarFranjas])

  const generarDesdeHorarios = async () => {
    const token = useAuthStore.getState().token
    if (!token) return
    const sugeridas = sugerirFranjas(horarios)
    if (sugeridas.length === 0) return
    setGenerando(true)
    try {
      for (const f of sugeridas) await restauranteApi.createFranjaHorario(token, f)
      await cargarFranjas()
    } finally {
      setGenerando(false)
    }
  }

  const alternarFranja = async (franja: FranjaHorario) => {
    const token = useAuthStore.getState().token
    if (!token) return
    const nuevoActivo = !franja.activo
    setFranjas((prev) => prev.map((f) => (f.id === franja.id ? { ...f, activo: nuevoActivo } : f)))
    try {
      await restauranteApi.updateFranjaHorario(token, franja.id, { activo: nuevoActivo })
    } catch {
      void cargarFranjas()
    }
  }

  const eliminarFranja = async (id: number) => {
    const token = useAuthStore.getState().token
    if (!token) return
    setFranjas((prev) => prev.filter((f) => f.id !== id))
    try {
      await restauranteApi.deleteFranjaHorario(token, id)
    } catch {
      void cargarFranjas()
    }
  }

  const soloOn = restaurante?.soloPedidosProgramados === true

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Permitir pedidos programados</p>
          <p className="text-[13px] font-normal text-muted-foreground">
            Los clientes eligen una franja para recibir su pedido.
          </p>
        </div>
        <Switch checked={programados.checked} onCheckedChange={programados.toggle} />
      </div>

      {programados.checked && (
        <div className="space-y-6 duration-150 animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Solo pedidos programados</p>
              <p className="text-[13px] font-normal text-muted-foreground">
                Obligar a elegir franja: no se puede pedir para ahora.
              </p>
            </div>
            <Switch checked={soloOn} onCheckedChange={solo.toggle} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="font-medium">Franjas</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 font-medium text-brand"
                onClick={() => {
                  setEditando(null)
                  setDialogOpen(true)
                }}
              >
                <Plus className="mr-1 h-4 w-4" /> Nueva
              </Button>
            </div>

            {!franjasLoaded ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : franjas.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-4 text-center">
                <p className="text-sm font-normal text-muted-foreground">Todavía no tenés franjas.</p>
                {sugerirFranjas(horarios).length > 0 && (
                  <Button
                    variant="outline"
                    onClick={generarDesdeHorarios}
                    disabled={generando}
                    className="mt-3 h-11 min-h-[44px] font-medium"
                  >
                    {generando ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    ¿Proponer franjas desde tus horarios?
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {franjas.map((f) => (
                  <div key={f.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className={cn('h-2 w-2 rounded-full', f.activo ? 'bg-green-500' : 'bg-muted-foreground/30')} />
                      <div>
                        <p className="text-sm font-medium text-foreground">{f.nombre}</p>
                        <p className="text-xs font-normal text-muted-foreground">
                          {f.horaInicio} – {f.horaFin}
                          {f.cupo != null && ` · cupo ${f.cupo}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          'h-9 w-9',
                          f.activo
                            ? 'text-muted-foreground hover:text-amber-600'
                            : 'text-muted-foreground hover:text-green-600'
                        )}
                        title={f.activo ? 'Desactivar franja' : 'Activar franja'}
                        onClick={() => alternarFranja(f)}
                      >
                        {f.activo ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => {
                          setEditando(f)
                          setDialogOpen(true)
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-red-500"
                        onClick={() => eliminarFranja(f.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <FranjaDialog open={dialogOpen} onOpenChange={setDialogOpen} editando={editando} onSaved={cargarFranjas} />
    </div>
  )
}
