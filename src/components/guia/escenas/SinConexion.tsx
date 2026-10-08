import { Check, Loader2, Printer, Wifi, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Escena } from './Escena'
import { d, useSecuencia } from './animacion'
import { LOCAL_EJEMPLO, pesos } from './ejemplo'

const GUARDADOS = [
  { local: 'LOCAL-1', numero: 1286, detalle: '2x Carne a cuchillo · 1x Napolitana', total: 34500 },
  { local: 'LOCAL-2', numero: 1287, detalle: '1x Smash burger · Doble', total: 13500 },
]
const LINEA = '-'.repeat(22)

/**
 * El punto de venta sin internet. Fases: 0 se corta · 1 se guarda LOCAL-1 e imprime su comanda ·
 * 2 se guarda LOCAL-2 · 3 vuelve internet y se suben · 4 tomaron su número.
 */
export function SinConexion() {
  const n = useSecuencia(1700, 2)
  const fase = n % 5
  const online = fase >= 3
  const guardados = GUARDADOS.slice(0, fase === 0 ? 0 : fase === 1 ? 1 : 2)
  return (
    <Escena
      ancho={460}
      alto={320}
      etiqueta="Sin internet, el punto de venta guarda los pedidos en el dispositivo como LOCAL-1 y LOCAL-2 e imprime la comanda igual; al volver la conexión se suben solos y toman su número."
    >
      <div
        key={online ? 'on' : 'off'}
        className={cn(
          'e-baja absolute left-[12px] top-[12px] flex h-[34px] w-[436px] items-center gap-2 rounded-xl px-3 text-[11px] font-semibold ring-1',
          online ? 'bg-emerald-50 text-emerald-800 ring-emerald-600/20' : 'bg-amber-50 text-amber-800 ring-amber-500/30',
        )}
      >
        {online ? <Wifi size={14} className="text-emerald-600" /> : <WifiOff size={14} className="text-amber-600" />}
        {fase === 4
          ? 'Volvió internet · todo sincronizado'
          : online
            ? 'Volvió internet · subiendo los pedidos guardados…'
            : 'Modo sin conexión: las ventas se guardan en este dispositivo'}
      </div>

      <div className="e-tarjeta e-izquierda absolute left-[12px] top-[58px] h-[250px] w-[262px] p-3.5" style={d(100)}>
        <p className="text-[12.5px] font-bold text-ink">Pedidos en este dispositivo</p>
        <p className="text-[9.5px] text-ink-3">Se suben solos cuando vuelve la conexión</p>
        <div className="mt-3 grid grid-cols-1 gap-2">
          {guardados.length === 0 && (
            <p className="rounded-xl border border-dashed border-[#DCD2C4] px-3 py-4 text-center text-[10.5px] leading-snug text-ink-3">
              Se cortó internet: seguí anotando como siempre.
            </p>
          )}
          {guardados.map((g) => {
            const subido = fase === 4
            return (
              <div key={g.local} className="e-sube flex items-center gap-2 rounded-xl bg-[#FBF7F1] px-2.5 py-2 ring-1 ring-[#ECE4D8]">
                <div className="min-w-0 flex-1">
                  <p key={subido ? 'n' : 'l'} className="e-aparece text-[11.5px] font-bold text-ink">
                    {subido ? `#${g.numero}` : g.local}
                  </p>
                  <p className="truncate text-[9.5px] text-ink-3">{g.detalle}</p>
                </div>
                <span className="text-[11px] font-bold tabular-nums text-ink">{pesos(g.total)}</span>
                <span
                  key={fase}
                  className={cn(
                    'e-pop flex h-[20px] shrink-0 items-center gap-1 rounded-full px-1.5 text-[9px] font-bold',
                    subido
                      ? 'bg-emerald-500/10 text-emerald-700'
                      : online
                        ? 'bg-sky-500/10 text-sky-700'
                        : 'bg-amber-500/15 text-amber-800',
                  )}
                >
                  {subido ? (
                    <>
                      <Check size={10} strokeWidth={3} />
                      Subido
                    </>
                  ) : online ? (
                    <>
                      <Loader2 size={10} className="animate-spin" />
                      Subiendo
                    </>
                  ) : (
                    'Guardado'
                  )}
                </span>
              </div>
            )
          })}
        </div>
        <p className="absolute inset-x-3.5 bottom-3 text-[9.5px] leading-snug text-ink-3">
          No se duplica: cada pedido se sube una sola vez, aunque se reintente.
        </p>
      </div>

      <div className="absolute left-[290px] top-[58px] w-[158px]">
        <div className="e-aparece flex h-[30px] items-center gap-1.5 rounded-t-xl bg-[#2B2520] px-2.5 text-[10px] font-semibold text-white/80" style={d(200)}>
          <Printer size={13} />
          Cocina
        </div>
        <div className="h-[6px] rounded-b-sm bg-[#3A332D]" />
        <div className="mx-2 h-[212px] overflow-hidden">
          {fase >= 1 && (
            <div key="ticket" className="e-imprime" style={d(150, { '--t': '1.5s' })}>
              <div className="e-ticket px-2.5 pb-1 pt-2 text-[8.5px] leading-[1.45]">
                <p className="text-center text-[11px] font-bold">{LOCAL_EJEMPLO.toUpperCase()}</p>
                <p>{LINEA}</p>
                <p className="font-bold">PEDIDO #LOCAL-1</p>
                <p className="font-bold">TAKEAWAY</p>
                <p className="font-bold">SIN CONEXIÓN</p>
                <p>{LINEA}</p>
                <p>2x Carne a cuchillo</p>
                <p className="text-right">{pesos(20000)}</p>
                <p>1x Napolitana</p>
                <p className="text-right">{pesos(14500)}</p>
                <p>{LINEA}</p>
                <p className="text-right font-bold">Total: {pesos(34500)}</p>
              </div>
              <div className="e-ticket-corte" />
            </div>
          )}
        </div>
      </div>
    </Escena>
  )
}
