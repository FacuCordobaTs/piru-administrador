import { Check, Printer, Store } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Escena, Toque } from './Escena'
import { d, useSecuencia } from './animacion'
import { LOCAL_EJEMPLO, PEDIDO_EJEMPLO as P, pesos } from './ejemplo'

// Un QR de mentira, siempre igual: tres marcas de esquina y módulos al azar con semilla fija.
const N = 21
const QR = (() => {
  let semilla = P.id
  const azar = () => {
    semilla = (semilla * 1103515245 + 12345) % 2147483648
    return semilla / 2147483648
  }
  const m = Array.from({ length: N }, () => Array.from({ length: N }, () => azar() > 0.5))
  const marca = (ox: number, oy: number) => {
    for (let y = -1; y <= 7; y++)
      for (let x = -1; x <= 7; x++) {
        const fy = oy + y
        const fx = ox + x
        if (fy < 0 || fx < 0 || fy >= N || fx >= N) continue
        const borde = x === 0 || x === 6 || y === 0 || y === 6
        const centro = x >= 2 && x <= 4 && y >= 2 && y <= 4
        m[fy][fx] = x >= 0 && x <= 6 && y >= 0 && y <= 6 && (borde || centro)
      }
  }
  marca(0, 0)
  marca(N - 7, 0)
  marca(0, N - 7)
  let camino = ''
  m.forEach((fila, y) => fila.forEach((oscuro, x) => (camino += oscuro ? `M${x} ${y}h1v1h-1z` : '')))
  return camino
})()
const MP = '#009EE3'

/**
 * El cobro con el QR de la caja. Fases: 0 espera el pago · 1 el cliente escanea y paga ·
 * 2 Mercado Pago confirma · 3 el pedido queda cobrado y sale la comanda.
 */
export function CobroQr() {
  const n = useSecuencia(1900, 2)
  const fase = n % 4
  const pagado = fase >= 2
  return (
    <Escena
      ancho={460}
      alto={330}
      etiqueta={`Cobro con el QR de Mercado Pago: el punto de venta muestra el QR de la caja con el total, el cliente lo escanea y paga, y cuando Mercado Pago confirma el pedido queda cobrado y sale la comanda.`}
    >
      <div className="e-tarjeta e-sube absolute left-[22px] top-[14px] flex h-[302px] w-[244px] flex-col items-center p-4 text-center" style={d(0)}>
        <p className="text-[12.5px] font-bold text-ink">Cobrar con Mercado Pago</p>
        <p className="text-[9.5px] text-ink-3">Pedido #1285 · Takeaway · Caja Mostrador</p>
        <p className="mt-1.5 text-[26px] font-black leading-none tabular-nums tracking-tight text-ink">{pesos(P.total)}</p>
        <div className="relative mt-3 rounded-[14px] bg-white p-2.5 ring-1 ring-[#ECE4D8]">
          <svg
            width={126}
            height={126}
            viewBox={`0 0 ${N} ${N}`}
            shapeRendering="crispEdges"
            aria-hidden
            className={cn('transition-opacity duration-500', pagado && 'opacity-15')}
          >
            <path d={QR} fill="#191512" />
          </svg>
          {fase === 1 && (
            <span
              className="e-escanea absolute inset-x-1.5 top-2.5 h-[2px] rounded-full bg-[#009EE3] shadow-[0_0_10px_2px_rgb(0_158_227/.5)]"
              style={d(0, { '--recorrido': '124px' })}
            />
          )}
          {pagado && (
            <span key="ok" className="e-pop absolute inset-0 grid place-items-center">
              <span className="grid size-14 place-items-center rounded-full bg-emerald-500 text-white shadow-[0_12px_26px_-8px_rgb(16_185_129/.8)]">
                <Check size={30} strokeWidth={3} />
              </span>
            </span>
          )}
        </div>
        <p
          key={pagado ? 'si' : 'no'}
          className={cn(
            'e-aparece mt-3 flex items-center gap-1.5 text-[11.5px] font-semibold',
            pagado ? 'text-emerald-700' : 'text-ink-2',
          )}
        >
          {!pagado && <span className="e-latido size-2 rounded-full bg-brand" />}
          {pagado ? '¡Pago recibido!' : 'Esperando el pago…'}
        </p>
        {fase === 3 ? (
          <p
            key={n}
            className="e-sube mt-auto flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-[10.5px] font-semibold text-white"
          >
            <Printer size={12} />
            Pedido cobrado · sale la comanda
          </p>
        ) : (
          <p className="mt-auto text-[9.5px] text-ink-3">{pagado ? 'Lo confirmó Mercado Pago' : 'Cancelar cobro'}</p>
        )}
      </div>

      {fase === 0 ? (
        <p key="pista" className="e-aparece absolute left-[292px] top-[130px] w-[150px] text-[12px] font-medium leading-snug text-ink-2">
          El cliente escanea el QR de la caja con su celular.
        </p>
      ) : (
        <div key="cel" className="e-celular e-derecha absolute left-[292px] top-[34px] h-[262px] w-[150px]">
          <div className="e-celular-pantalla flex flex-col">
            <div className="px-3 pb-2 pt-3 text-white" style={{ backgroundColor: MP }}>
              <p className="text-[10.5px] font-bold">Mercado Pago</p>
            </div>
            <div className="flex flex-1 flex-col items-center px-3 pt-4 text-center">
              <span className="grid size-9 place-items-center rounded-full bg-[#F6F0E6] text-ink-2">
                <Store size={16} />
              </span>
              <p className="mt-1.5 text-[10px] text-ink-3">Pagar a {LOCAL_EJEMPLO}</p>
              <p className="text-[19px] font-black tabular-nums text-ink">{pesos(P.total)}</p>
              {pagado ? (
                <p key="listo" className="e-pop mt-3 flex items-center gap-1 text-[10.5px] font-bold text-emerald-700">
                  <Check size={13} strokeWidth={3} />
                  Listo, pagaste
                </p>
              ) : (
                <span
                  className="relative mt-auto mb-4 flex h-[30px] w-full items-center justify-center rounded-lg text-[11px] font-bold text-white"
                  style={{ backgroundColor: MP }}
                >
                  Pagar
                  <Toque vez={n} />
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </Escena>
  )
}
