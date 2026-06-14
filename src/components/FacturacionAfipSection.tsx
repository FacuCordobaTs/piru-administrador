import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuthStore } from '@/store/authStore'
import { facturacionApi } from '@/lib/api'
import { toast } from 'sonner'
import { FileText, Loader2, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

const phantomCardClass = ""
const phantomInputClass = "h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-transparent focus:ring-2 focus:ring-[#FF7A00]/30 transition-all text-base px-4 w-full"
const phantomLabelClass = "text-sm font-medium text-muted-foreground mb-2 block"

interface EstadoAfip {
  habilitado: boolean
  cuit: string | null
  puntoDeVenta: number | null
  condicionIva: 'RI' | 'MO' | null
  tieneCert: boolean
}

function formatCuit(cuit: string) {
  if (!cuit || cuit.length !== 11) return cuit
  return `${cuit.slice(0, 2)}-${cuit.slice(2, 10)}-${cuit.slice(10)}`
}

export default function FacturacionAfipSection() {
  const token = useAuthStore(s => s.token)
  const [loadingEstado, setLoadingEstado] = useState(true)
  const [estado, setEstado] = useState<EstadoAfip | null>(null)
  const [saving, setSaving] = useState(false)
  const [desactivando, setDesactivando] = useState(false)

  const [formCuit, setFormCuit] = useState('')
  const [formClave, setFormClave] = useState('')
  const [formCondicion, setFormCondicion] = useState<'RI' | 'MO'>('RI')

  useEffect(() => {
    if (!token) return
    setLoadingEstado(true)
    facturacionApi.getEstado(token)
      .then((res: any) => {
        if (res.success) setEstado(res.data)
      })
      .catch(() => toast.error('No se pudo cargar el estado de facturación'))
      .finally(() => setLoadingEstado(false))
  }, [token])

  const handleActivar = async () => {
    if (!token) return
    if (formCuit.length !== 11 || !/^\d+$/.test(formCuit)) {
      toast.error('El CUIT debe ser de 11 dígitos numéricos sin guiones')
      return
    }
    if (!formClave.trim()) {
      toast.error('Ingresá tu Clave Fiscal de ARCA')
      return
    }

    setSaving(true)
    try {
      const res: any = await facturacionApi.configurar(token, {
        afipCuit: formCuit,
        afipClaveFiscal: formClave,
        afipCondicionIva: formCondicion,
      })
      if (res.success) {
        toast.success('Facturación AFIP activada correctamente')
        const estadoRes: any = await facturacionApi.getEstado(token)
        if (estadoRes.success) setEstado(estadoRes.data)
        setFormCuit(''); setFormClave('')
      } else {
        toast.error(res.message || 'Error al configurar AFIP')
      }
    } catch (e: any) {
      toast.error('Error al conectar con AFIP', { description: e?.message })
    } finally {
      setSaving(false)
    }
  }

  const handleDesactivar = async () => {
    if (!token) return
    setDesactivando(true)
    try {
      const res: any = await facturacionApi.desactivar(token)
      if (res.success) {
        toast.success('Facturación AFIP desactivada')
        setEstado(prev => prev ? { ...prev, habilitado: false } : prev)
      }
    } catch {
      toast.error('Error al desactivar')
    } finally {
      setDesactivando(false)
    }
  }

  if (loadingEstado) {
    return (
      <div className={cn(phantomCardClass, "max-w-2xl")}>
        <div className="p-6 sm:p-8 flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Cargando estado de facturación...</span>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(phantomCardClass, "max-w-2xl")}>
      <div className="p-6 sm:p-8">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-3">
            <FileText className="h-6 w-6 text-blue-600" />
            Facturación Electrónica
          </h2>
          <p className="text-muted-foreground text-sm">
            Emití facturas electrónicas ARCA (AFIP) automáticamente desde el cierre de turno.
          </p>
        </div>

        {estado?.habilitado ? (
          /* ── Estado activo ── */
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-5 bg-blue-50 dark:bg-blue-950/20 border-2 border-blue-500/20 rounded-3xl">
              <div className="h-12 w-12 rounded-[18px] bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-base font-bold text-blue-900 dark:text-blue-100">Facturación activa</p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-0.5">
                  CUIT {formatCuit(estado.cuit ?? '')} · Punto de venta #{estado.puntoDeVenta ?? '—'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <p className="text-xs text-muted-foreground mb-1">CUIT</p>
                <p className="font-semibold text-sm">{formatCuit(estado.cuit ?? '')}</p>
              </div>
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <p className="text-xs text-muted-foreground mb-1">Punto de venta</p>
                <p className="font-semibold text-sm">#{estado.puntoDeVenta ?? '—'}</p>
              </div>
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <p className="text-xs text-muted-foreground mb-1">Condición IVA</p>
                <p className="font-semibold text-sm">{estado.condicionIva === 'MO' ? 'Monotributista' : 'Resp. Inscripto'}</p>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => void handleDesactivar()}
              disabled={desactivando}
              className="h-12 rounded-2xl border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 font-semibold"
            >
              {desactivando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Desactivar Facturación
            </Button>
          </div>
        ) : (
          /* ── Formulario de configuración ── */
          <div className="space-y-6">
            {/* Aviso */}
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
              <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900 dark:text-blue-200">
                <p className="font-semibold mb-1">El proceso tarda ~30 segundos</p>
                <p className="text-blue-700 dark:text-blue-300">
                  Se crea el certificado digital, se autoriza el servicio WSFE en ARCA y se registra el punto de venta automáticamente.
                </p>
              </div>
            </div>

            {/* CUIT */}
            <div>
              <Label className={phantomLabelClass}>CUIT (sin guiones)</Label>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={11}
                placeholder="20XXXXXXXXX"
                value={formCuit}
                onChange={e => setFormCuit(e.target.value.replace(/\D/g, '').slice(0, 11))}
                className={phantomInputClass}
              />
              {formCuit.length > 0 && formCuit.length !== 11 && (
                <p className="text-xs text-red-500 mt-1 ml-1">{formCuit.length}/11 dígitos</p>
              )}
            </div>

            {/* Clave Fiscal */}
            <div>
              <Label className={phantomLabelClass}>Clave Fiscal ARCA</Label>
              <Input
                type="password"
                placeholder="Tu clave fiscal"
                value={formClave}
                onChange={e => setFormClave(e.target.value)}
                className={phantomInputClass}
              />
            </div>

            {/* Condición IVA */}
            <div>
              <Label className={phantomLabelClass}>Condición IVA</Label>
              <Select value={formCondicion} onValueChange={(v: 'RI' | 'MO') => setFormCondicion(v)}>
                <SelectTrigger className={cn(phantomInputClass, "cursor-pointer")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RI">Responsable Inscripto</SelectItem>
                  <SelectItem value="MO">Monotributista</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Botón */}
            <Button
              onClick={() => void handleActivar()}
              disabled={saving}
              className="w-full h-14 rounded-2xl font-bold text-base bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20"
            >
              {saving ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Configurando AFIP (~30 seg)...
                </>
              ) : (
                'Activar Facturación'
              )}
            </Button>

            {saving && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
                <AlertCircle className="h-4 w-4" />
                No cierres esta página, el proceso puede tardar hasta 30 segundos.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
