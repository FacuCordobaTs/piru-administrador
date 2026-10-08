import { Armchair, Check, Printer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Escena, Toque } from './Escena'
import { d, useSecuencia } from './animacion'
import { COMANDA_MESA, MESAS_EJEMPLO, pesos } from './ejemplo'

// Del botón del mozo a la impresora de la cocina, que está en la compu del local.
const RUTA = 'M 352 300 C 330 330, 270 324, 222 300'
const VERDE = '#163B2B'

/**
 * La Mesa 4 desde la app de mozos. Fases: 0 unas papas "por confirmar" · 1 el mozo toca
 * "Confirmar pedido" · 2 en la cocina sale sólo lo nuevo y la mesa suma el total.
 */
export function MesasMozo() {
  const n = useSecuencia(2000, 2)
  const fase = n % 3
  const confirmado = fase === 2
  const nuevo = COMANDA_MESA.porConfirmar
  const totalMesa = 33000 + (confirmado ? nuevo.precio : 0)
  const items = confirmado ? [...COMANDA_MESA.confirmados, nuevo] : COMANDA_MESA.confirmados
  return (
    <Escena
      ancho={460}
      alto={360}
      etiqueta="Las mesas en el panel y la app de mozos: el mozo confirma unas papas para la Mesa 4, en la cocina se imprime sólo ese producto y la mesa suma el total."
    >
      <div className="e-tarjeta e-izquierda absolute left-[12px] top-[12px] w-[236px] p-3" style={d(0)}>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[12.5px] font-bold text-ink">
            <Armchair size={14} className="text-brand-deep" />
            Mesas
            <span className="rounded-full bg-brand px-1.5 text-[9.5px] font-semibold leading-[15px] text-white">4</span>
          </span>
          <span className="flex items-center gap-2 text-[8.5px] text-ink-3">
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-sm bg-emerald-500/30 ring-1 ring-emerald-500/50" />
              Libre
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-sm bg-brand/30 ring-1 ring-brand/50" />
              Ocupada
            </span>
          </span>
        </div>
        <div className="mt-2.5 grid grid-cols-3 gap-2">
          {MESAS_EJEMPLO.map((m, i) => {
            const ocupada = !!m.cliente
            const esLa4 = m.numero === 4
            return (
              <div
                key={m.numero}
                className={cn(
                  'e-pop relative flex h-[56px] flex-col items-center justify-center rounded-xl ring-1',
                  ocupada ? 'bg-brand/12 text-[#C45F00] ring-brand/35' : 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/30',
                  esLa4 && 'ring-2 ring-brand',
                )}
                style={d(100 + i * 55)}
              >
                <span className="text-[17px] font-black leading-none tabular-nums">{m.numero}</span>
                {ocupada && (
                  <>
                    <span className="mt-1 text-[8.5px] font-semibold leading-none">{m.cliente}</span>
                    <span
                      key={esLa4 ? totalMesa : m.total}
                      className={cn('mt-0.5 text-[8.5px] font-bold leading-none tabular-nums', esLa4 && confirmado && 'e-pop')}
                    >
                      {pesos(esLa4 ? totalMesa : m.total!)}
                    </span>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="absolute left-[30px] top-[262px] w-[200px]">
        <div className="flex h-[24px] items-center gap-1.5 rounded-t-lg bg-[#2B2520] px-2.5 text-[9.5px] font-semibold text-white/80">
          <Printer size={12} />
          Cocina · compu del local
        </div>
        <div className="h-[5px] rounded-b-sm bg-[#3A332D]" />
        <div className="mx-3 h-[66px] overflow-hidden">
          {confirmado && (
            <div key={n} className="e-imprime" style={d(500, { '--t': '1s' })}>
              <div className="e-ticket px-2.5 py-1.5 text-[9px] leading-[1.45]">
                <p className="font-bold">MESA 4 · PRODUCTOS NUEVOS</p>
                <p className="font-bold">
                  {nuevo.cantidad}x {nuevo.nombre.toUpperCase()}
                </p>
                <p className="text-ink-3">Mozo: Nico · 21:12</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <svg className="absolute inset-0" width={460} height={360} viewBox="0 0 460 360" fill="none" aria-hidden>
        <path d={RUTA} stroke="#FF7A00" strokeWidth={2} strokeLinecap="round" opacity={0.45} className="e-hormigas" />
      </svg>
      {confirmado && (
        <span
          key={n}
          className="e-vuela absolute left-0 top-0 size-3 rounded-full bg-brand shadow-[0_0_0_5px_rgb(255_122_0/.22)]"
          style={d(0, { '--ruta': `path("${RUTA}")` })}
        />
      )}

      <div className="e-celular e-derecha absolute left-[268px] top-[12px] h-[336px] w-[180px]" style={d(200)}>
        <div className="e-celular-pantalla flex flex-col bg-[#F6F7F3] text-[#19261E]">
          <div className="px-3 pt-3">
            <p className="text-[9.5px] font-bold text-[#315B43]">‹ Mesas</p>
            <p className="mt-1 text-center text-[24px] font-bold leading-none tracking-tight">Mesa 4</p>
          </div>
          <div className="mx-2 mt-3 overflow-hidden rounded-[14px] bg-white ring-1 ring-[#DAE1DA]">
            <p className="bg-[#FBFCFA] px-2.5 py-1.5 text-[8.5px] font-bold uppercase tracking-[.11em] text-[#67726A]">
              Comanda
            </p>
            {items.map((it, i) => (
              <p
                key={it.nombre}
                className={cn(
                  'flex justify-between gap-2 border-t border-[#EEF0ED] px-2.5 py-1.5 text-[9.5px]',
                  confirmado && i === items.length - 1 && 'e-sube',
                )}
              >
                <span className="truncate">
                  {it.cantidad}x {it.nombre}
                </span>
                <span className="shrink-0 tabular-nums">{pesos(it.precio)}</span>
              </p>
            ))}
            {!confirmado && (
              <>
                <p className="border-t border-[#EEF0ED] bg-[#FFF8EC] px-2.5 py-1 text-[8px] font-bold uppercase tracking-[.11em] text-[#765116]">
                  Por confirmar
                </p>
                <p className="flex justify-between gap-2 border-t border-[#EEF0ED] px-2.5 py-1.5 text-[9.5px]">
                  <span className="truncate">
                    {nuevo.cantidad}x {nuevo.nombre}
                  </span>
                  <span className="shrink-0 tabular-nums">{pesos(nuevo.precio)}</span>
                </p>
              </>
            )}
          </div>
          <div className="mt-auto border-t border-[#DBE2DB] bg-white/90 p-2.5">
            <p className="flex justify-between text-[9.5px] text-[#5E695F]">
              <span>Total</span>
              <b key={totalMesa} className={cn('tabular-nums text-[#19261E]', confirmado && 'e-pop')}>
                {pesos(totalMesa)}
              </b>
            </p>
            {confirmado ? (
              <span
                key="ok"
                className="e-pop mt-1.5 flex h-[30px] items-center justify-center gap-1 rounded-[10px] bg-[#E1E5E0] text-[10.5px] font-bold text-[#56635A]"
              >
                <Check size={12} strokeWidth={3} />
                Enviado a cocina
              </span>
            ) : (
              <span
                className={cn(
                  'relative mt-1.5 flex h-[30px] items-center justify-center rounded-[10px] text-[10.5px] font-bold text-white transition-[scale] duration-200',
                  fase === 1 && 'scale-[.97]',
                )}
                style={{ backgroundColor: VERDE }}
              >
                Confirmar pedido
                {fase === 1 && <Toque vez={n} />}
              </span>
            )}
          </div>
        </div>
      </div>
    </Escena>
  )
}
