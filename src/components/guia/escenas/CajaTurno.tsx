import { Banknote, CheckCircle2, ChevronDown, Clock, Globe, Landmark, ShoppingBag, Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Escena, Toque } from './Escena'
import { d, useContador, useSecuencia } from './animacion'
import { CAJA_EJEMPLO as CAJA, pesos } from './ejemplo'

const ICONOS = [Banknote, Smartphone, Landmark]
const ANTERIORES = ['26 sep, 18:10 a 00:48', '25 sep, 18:05 a 23:59']

/**
 * La caja de un turno. Fases: 0 el resumen del turno actual · 1 toca "Cerrar turno" · 2 el turno
 * queda cerrado con su caja y empieza uno nuevo.
 */
export function CajaTurno() {
  const n = useSecuencia(2400)
  const fase = n % 3
  const cerrado = fase === 2
  const total = useContador(CAJA.total, 1400, 300)
  const maximo = Math.max(...CAJA.pagos.map((p) => p.monto))
  return (
    <Escena
      ancho={460}
      alto={330}
      etiqueta={`La caja de un turno: ${pesos(CAJA.total)} en total, separado en efectivo, Mercado Pago y transferencia, lo que entró por la web y lo anotado a mano. Al cerrar el turno empieza uno nuevo.`}
    >
      <div className="e-tarjeta e-sube absolute left-[12px] top-[12px] flex h-[306px] w-[300px] flex-col items-center p-4" style={d(0)}>
        <span
          key={cerrado ? 'c' : 'a'}
          className="e-aparece flex items-center gap-1 rounded-full bg-[#F6F0E6] px-2.5 py-1 text-[9.5px] font-medium text-ink-2"
        >
          {cerrado ? '27 sep, 18:02 a 01:15' : 'Turno actual · desde 18:02'}
          <ChevronDown size={10} />
        </span>
        <p className="mt-2 text-[8.5px] font-bold uppercase tracking-[.14em] text-ink">Total</p>
        <p className="text-[32px] font-bold leading-none tabular-nums tracking-tight text-ink">{pesos(total)}</p>
        <p className="mt-1.5 text-[10px] font-medium text-brand-deep">{CAJA.pendientes} órdenes pendientes de cobro</p>

        <div className="mt-3 grid w-full grid-cols-3 gap-1.5">
          {CAJA.pagos.map((p, i) => {
            const Icono = ICONOS[i]
            return (
              <div key={p.nombre} className="e-sube rounded-xl bg-[#F6F0E6] p-2" style={d(500 + i * 120)}>
                <p className="flex items-center gap-1 text-[8.5px] font-bold text-ink-2">
                  <Icono size={10} className="text-ink-3" />
                  {p.nombre}
                </p>
                <p className="mt-1 text-[11.5px] font-extrabold tabular-nums text-ink">{pesos(p.monto)}</p>
                <div className="mt-1 h-[4px] overflow-hidden rounded-full bg-white">
                  <div
                    className="e-barra h-full rounded-full bg-brand"
                    style={{ width: `${(p.monto / maximo) * 100}%`, ...d(800 + i * 120) }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-1.5 grid w-full grid-cols-2 gap-1.5">
          <div className="e-sube rounded-xl bg-[#F6F0E6] px-2 py-1.5" style={d(900)}>
            <p className="flex items-center gap-1 text-[8.5px] font-bold text-ink-2">
              <Globe size={10} className="text-ink-3" />
              Por la web
            </p>
            <p className="text-[11px] font-extrabold tabular-nums text-ink">{pesos(CAJA.web.monto)}</p>
            <p className="text-[8px] text-ink-3">{CAJA.web.pedidos} pedidos</p>
          </div>
          <div className="e-sube rounded-xl bg-sky-500/10 px-2 py-1.5 ring-1 ring-sky-500/20" style={d(1000)}>
            <p className="flex items-center gap-1 text-[8.5px] font-bold text-sky-800">
              <ShoppingBag size={10} />
              Anotados a mano
            </p>
            <p className="text-[11px] font-extrabold tabular-nums text-sky-900">{pesos(CAJA.manual.monto)}</p>
            <p className="text-[8px] text-sky-700/80">{CAJA.manual.pedidos} pedidos</p>
          </div>
        </div>

        <div className="mt-auto w-full">
          {cerrado ? (
            <p
              key={n}
              className="e-pop flex h-[30px] items-center justify-center gap-1.5 rounded-xl bg-emerald-500/10 text-[10.5px] font-bold text-emerald-700"
            >
              <CheckCircle2 size={13} />
              Turno cerrado. Ya comenzó uno nuevo.
            </p>
          ) : (
            <span
              className={cn(
                'relative flex h-[30px] items-center justify-center gap-1.5 rounded-xl bg-ink text-[11px] font-bold text-white transition-[scale] duration-200',
                fase === 1 && 'scale-[.97]',
              )}
            >
              <Clock size={13} />
              Cerrar turno
              {fase === 1 && <Toque vez={n} />}
            </span>
          )}
        </div>
      </div>

      <div className="e-tarjeta e-derecha absolute left-[324px] top-[12px] w-[124px] p-2.5" style={d(300)}>
        <p className="px-1 text-[9px] font-bold uppercase tracking-[.1em] text-ink-3">Turnos</p>
        <div className="mt-1.5 grid gap-1">
          {cerrado && (
            <span key={`nuevo${n}`} className="e-pop rounded-lg px-2 py-1.5 text-[9.5px] font-semibold text-ink-2 ring-1 ring-[#ECE4D8]">
              Turno actual
              <span className="block text-[8.5px] font-normal text-ink-3">desde 01:15</span>
            </span>
          )}
          <span className="rounded-lg bg-brand px-2 py-1.5 text-[9.5px] font-semibold text-white">
            {cerrado ? '27 sep, 18:02 a 01:15' : 'Turno actual'}
            <span className="block text-[8.5px] font-normal text-white/80">
              {cerrado ? pesos(CAJA.total) : 'desde 18:02'}
            </span>
          </span>
          {ANTERIORES.map((t) => (
            <span key={t} className="rounded-lg px-2 py-1.5 text-[9px] text-ink-3">
              {t}
            </span>
          ))}
        </div>
      </div>
    </Escena>
  )
}
