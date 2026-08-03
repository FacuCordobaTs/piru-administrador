import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { CheckCircle2, Clock, Loader2, MessageSquare, ShieldCheck } from 'lucide-react'
import { pagoApi, ApiError, type PagoLinkInfo } from '@/lib/api'

const fmtARS = (n: number | string) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(
    typeof n === 'string' ? parseFloat(n) : n,
  )

/**
 * Página pública de pago por link/QR (`/pago/:token`) — SIN login. El dueño llega acá
 * escaneando el QR que le muestra el panel en la compu. Sólo muestra el concepto y el
 * botón para pagar con MercadoPago (único medio por ahora). El saldo se acredita solo
 * cuando MP confirma el pago (webhook).
 */
export default function PagoLink() {
  const { token = '' } = useParams()
  const [searchParams] = useSearchParams()
  const volviendoDeMp = searchParams.get('estado') === 'success'

  const [info, setInfo] = useState<PagoLinkInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagando, setPagando] = useState(false)

  useEffect(() => {
    let cancel = false
    pagoApi
      .info(token)
      .then((r) => !cancel && setInfo(r.data))
      .catch((e) => !cancel && setError(e instanceof ApiError ? e.message : 'No se pudo cargar el pago'))
      .finally(() => !cancel && setLoading(false))
    return () => {
      cancel = true
    }
  }, [token])

  const pagar = async () => {
    setPagando(true)
    try {
      const res = await pagoApi.checkout(token)
      window.location.href = res.data.url_pago
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo iniciar el pago')
      setPagando(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 text-brand">
          <MessageSquare className="h-5 w-5" />
          <span className="text-sm font-semibold tracking-tight">Piru · Recarga de avisos</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error && !info ? (
          <Estado
            icon={<Clock className="h-10 w-10 text-muted-foreground" />}
            titulo="No pudimos abrir este pago"
            detalle={error}
          />
        ) : info?.estado === 'paid' || volviendoDeMp ? (
          <Estado
            icon={<CheckCircle2 className="h-10 w-10 text-emerald-500" />}
            titulo="¡Pago recibido!"
            detalle={
              volviendoDeMp
                ? 'Estamos acreditando tu saldo. Ya podés volver al panel — se actualiza solo.'
                : 'Este pago ya fue realizado. Ya podés cerrar esta ventana.'
            }
          />
        ) : info?.estado === 'expired' ? (
          <Estado
            icon={<Clock className="h-10 w-10 text-amber-500" />}
            titulo="El link venció"
            detalle="Generá uno nuevo desde el panel (Ajustes → Plan y saldo) y volvé a escanear el QR."
          />
        ) : info ? (
          <>
            <div className="mt-6 space-y-1">
              <p className="text-sm text-muted-foreground">{info.restauranteNombre}</p>
              <h1 className="text-lg font-semibold text-foreground">{info.concepto}</h1>
              <p className="text-3xl font-bold tracking-tight text-foreground">{fmtARS(info.monto)}</p>
              <p className="text-[13px] text-muted-foreground">
                {info.cantidad} {info.unidad}
              </p>
            </div>

            {error && <p className="mt-4 text-[13px] text-red-500">{error}</p>}

            <button
              onClick={pagar}
              disabled={pagando}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#009EE3] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0089c7] disabled:opacity-60"
            >
              {pagando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Pagar con Mercado Pago'}
            </button>

            <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Pago seguro · el saldo se acredita al confirmarse
            </p>
          </>
        ) : null}
      </div>
    </div>
  )
}

function Estado({ icon, titulo, detalle }: { icon: React.ReactNode; titulo: string; detalle: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      {icon}
      <h1 className="text-lg font-semibold text-foreground">{titulo}</h1>
      <p className="max-w-[16rem] text-[13px] text-muted-foreground">{detalle}</p>
    </div>
  )
}
