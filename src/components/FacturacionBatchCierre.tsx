import { useState, useMemo } from 'react'
import { useAuthStore } from '@/store/authStore'
import { facturacionApi } from '@/lib/api'
import { FileText, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

interface PedidoParaFacturar {
  id: number
  tipo: string
  nombreCliente?: string | null
  total: string
  estado: string
  afipFacturado?: boolean
  afipCae?: string | null
}

interface ResultadoFactura {
  pedidoId: number
  success: boolean
  cae?: string
  error?: string
  pdfUrl?: string
}

interface Props {
  pedidos: PedidoParaFacturar[]
}

export default function FacturacionBatchCierre({ pedidos }: Props) {
  const token = useAuthStore(s => s.token)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [resultados, setResultados] = useState<ResultadoFactura[] | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [pdfLoading, setPdfLoading] = useState<Set<number>>(new Set())

  const facturables = useMemo(() =>
    pedidos.filter(p =>
      p.tipo !== 'mesa' &&
      ['delivered', 'archived'].includes(p.estado) &&
      !p.afipFacturado
    ),
    [pedidos]
  )

  const yaFacturados = useMemo(() =>
    pedidos.filter(p => p.tipo !== 'mesa' && p.afipFacturado),
    [pedidos]
  )

  if (facturables.length === 0 && yaFacturados.length === 0) return null

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => setSelected(new Set(facturables.map(p => p.id)))
  const deselectAll = () => setSelected(new Set())
  const allSelected = facturables.length > 0 && selected.size === facturables.length

  const handleFacturar = async () => {
    if (!token || selected.size === 0) return
    setLoading(true)
    setResultados(null)
    try {
      const res: any = await facturacionApi.facturarBatch(token, Array.from(selected))
      if (res.success) {
        setResultados(res.data)
        setSelected(new Set())
      }
    } catch (e: any) {
      setResultados([{ pedidoId: -1, success: false, error: e?.message || 'Error de conexión' }])
    } finally {
      setLoading(false)
    }
  }

  const exitosos = resultados?.filter(r => r.success).length ?? 0
  const fallidos = resultados?.filter(r => !r.success).length ?? 0

  const handleVerPdf = async (pedidoId: number) => {
    if (!token) return
    setPdfLoading(prev => new Set(prev).add(pedidoId))
    try {
      const res: any = await facturacionApi.getPdfUrl(token, pedidoId)
      if (res.success && res.url) {
        window.open(res.url, '_blank')
      } else {
        toast.error('No se pudo obtener el PDF')
      }
    } catch {
      toast.error('Error al obtener el PDF')
    } finally {
      setPdfLoading(prev => { const s = new Set(prev); s.delete(pedidoId); return s })
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      {/* Header */}
      <button
        className="flex items-center justify-between w-full"
        onClick={() => setCollapsed(v => !v)}
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="h-4 w-4 text-blue-600" />
          <span>Facturación AFIP</span>
          {yaFacturados.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              ({yaFacturados.length} ya {yaFacturados.length === 1 ? 'facturado' : 'facturados'})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {facturables.length > 0 && (
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded-full">
              {facturables.length} sin facturar
            </span>
          )}
          {collapsed
            ? <ChevronRight className="h-4 w-4 text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground" />
          }
        </div>
      </button>

      {!collapsed && (
        <>
          {/* Resumen de ya facturados */}
          {yaFacturados.length > 0 && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
              <p className="text-xs text-green-800 dark:text-green-300 font-medium">
                {yaFacturados.length} {yaFacturados.length === 1 ? 'pedido facturado' : 'pedidos facturados'} en esta fecha.
              </p>
            </div>
          )}

          {/* Lista de facturables */}
          {facturables.length > 0 ? (
            <div className="space-y-2">
              {/* Controles de selección */}
              <div className="flex items-center justify-between">
                <button
                  onClick={allSelected ? deselectAll : selectAll}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  {allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
                </button>
                <span className="text-xs text-muted-foreground">{selected.size} seleccionados</span>
              </div>

              {/* Items */}
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {facturables.map(p => {
                  const label = p.nombreCliente || (p.tipo === 'delivery' ? 'Delivery' : 'Takeaway')
                  const isSelected = selected.has(p.id)
                  const resultado = resultados?.find(r => r.pedidoId === p.id)
                  return (
                    <div
                      key={p.id}
                      onClick={() => !loading && !resultado && toggleSelect(p.id)}
                      className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer select-none ${
                        resultado
                          ? resultado.success
                            ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900'
                            : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900'
                          : isSelected
                            ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-700'
                            : 'bg-muted/40 border-border hover:border-blue-300 dark:hover:border-blue-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {resultado ? (
                          resultado.success
                            ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                            : <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                        ) : (
                          <div className={`h-4 w-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-blue-600 border-blue-600'
                              : 'border-zinc-400 dark:border-zinc-600'
                          }`}>
                            {isSelected && <div className="h-2 w-2 bg-white rounded-sm" />}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">{label}</p>
                          {resultado?.success && resultado.cae && (
                            <div className="flex items-center gap-2">
                              <p className="text-[10px] text-green-700 dark:text-green-400 font-mono">CAE: {resultado.cae}</p>
                              <button
                                onClick={e => { e.stopPropagation(); void handleVerPdf(p.id) }}
                                disabled={pdfLoading.has(p.id)}
                                className="inline-flex items-center gap-1 text-[10px] border border-border rounded px-1.5 py-0.5 text-muted-foreground hover:text-blue-600 hover:border-blue-400 transition-colors disabled:opacity-50"
                              >
                                {pdfLoading.has(p.id)
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : <FileText className="h-3 w-3" />
                                }
                                PDF
                              </button>
                            </div>
                          )}
                          {resultado?.error && (
                            <p className="text-[10px] text-red-600 truncate">{resultado.error}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-xs font-bold tabular-nums shrink-0 ml-2">
                        ${parseFloat(p.total).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Resultado resumen */}
              {resultados && (
                <div className={`p-2.5 rounded-lg text-xs font-medium ${
                  fallidos === 0
                    ? 'bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-300'
                    : 'bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300'
                }`}>
                  {exitosos > 0 && `✅ ${exitosos} ${exitosos === 1 ? 'factura emitida' : 'facturas emitidas'}`}
                  {exitosos > 0 && fallidos > 0 && ' · '}
                  {fallidos > 0 && `❌ ${fallidos} ${fallidos === 1 ? 'error' : 'errores'}`}
                </div>
              )}

              {/* Botón facturar */}
              <button
                onClick={() => void handleFacturar()}
                disabled={loading || selected.size === 0}
                className="w-full h-10 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Facturando...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    Facturar ({selected.size})
                  </>
                )}
              </button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-2">
              Todos los pedidos de esta fecha ya están facturados.
            </p>
          )}
        </>
      )}
    </div>
  )
}
