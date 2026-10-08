import type { CSSProperties, ReactNode } from 'react'
import { Bike, Check, Clock, MapPin, Receipt, ShoppingBag, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Escena, Toque } from './Escena'
import { d, useSecuencia } from './animacion'
import { OTROS_PEDIDOS, PEDIDO_EJEMPLO as P, pesos } from './ejemplo'

function ChipPago({ texto, pendiente }: { texto: string; pendiente?: boolean }) {
  return (
    <span className="flex items-center gap-1">
      {pendiente && (
        <span className="rounded bg-[#F6F0E6] px-1 py-px text-[8.5px] font-semibold text-ink-3">Pendiente</span>
      )}
      <span className="rounded bg-[#F6F0E6] px-1 py-px text-[8.5px] font-semibold text-ink-2">{texto}</span>
    </span>
  )
}

function Tarjeta({
  id,
  tipo,
  cliente,
  total,
  hace,
  chips,
  className,
  style,
}: {
  id: number
  tipo: string
  cliente: string
  total: number
  /** Sólo en el que acaba de entrar: en los demás, el lugar es para los chips. */
  hace?: string
  chips: ReactNode
  className?: string
  style?: CSSProperties
}) {
  const Icono = tipo === 'Delivery' ? Bike : ShoppingBag
  return (
    <div
      className={cn('h-[50px] rounded-[13px] bg-white px-3 py-[7px] ring-1 ring-[#ECE4D8] transition-colors duration-300', className)}
      style={style}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <span className="text-[12px] font-bold text-ink">#{id}</span>
          <span className="flex items-center gap-0.5 text-[9.5px] font-medium text-ink-3">
            <Icono size={10} />
            {tipo}
          </span>
        </span>
        <span className="text-[12px] font-black tabular-nums text-ink">{pesos(total)}</span>
      </div>
      <div className="mt-[3px] flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[11px] font-semibold text-ink-2">{cliente}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          {chips}
          {hace && <span className="text-[8.5px] text-ink-3">{hace}</span>}
        </span>
      </div>
    </div>
  )
}

/**
 * Inicio, pedido por pedido. Fases: 0 la lista · 1 entra el #1284 · 2 se abre su detalle ·
 * 3 toca "Despachar pedido" · 4 pasó al historial.
 */
export function ListaPedidos() {
  const n = useSecuencia(1800, 2)
  const fase = n % 5
  const entro = fase >= 1 && fase <= 3
  const abierto = fase >= 2
  const despachado = fase === 4
  return (
    <Escena
      ancho={460}
      alto={340}
      etiqueta={`Inicio del panel: entra el pedido #${P.id} de ${P.corto}, se abre su detalle con la comanda y se despacha; pasa al historial.`}
    >
      <div className="absolute left-[12px] top-[12px] w-[200px]">
        <div className="flex h-[24px] items-center justify-between">
          <span className="flex items-center gap-1.5 text-[13px] font-bold text-ink">
            Pedidos
            <span
              key={entro ? 'con' : 'sin'}
              className="e-pop rounded-full bg-brand px-1.5 text-[10px] font-semibold leading-[16px] text-white"
            >
              {entro ? 4 : 3}
            </span>
          </span>
          <span className="text-[10px] font-medium text-ink-3">Hoy</span>
        </div>

        <div className="mt-[8px] grid grid-cols-1 gap-[7px]">
          {entro && (
            <Tarjeta
              key="1284"
              id={P.id}
              tipo="Delivery"
              cliente={P.cliente}
              total={P.total}
              hace="hace 1 min"
              chips={<ChipPago texto="Transf." />}
              className={cn(
                'e-pop relative',
                abierto
                  ? 'bg-brand-soft/70 ring-brand/45 shadow-[inset_3px_0_0_#FF7A00]'
                  : 'ring-2 ring-brand/50 shadow-[0_10px_22px_-12px_rgb(255_122_0/.7)]',
              )}
            />
          )}
          {OTROS_PEDIDOS.map((p, i) => (
            <Tarjeta
              key={p.id}
              id={p.id}
              tipo={p.tipo}
              cliente={p.cliente}
              total={p.total}
              className="e-sube"
              style={d(i * 90)}
              chips={
                p.programado ? (
                  <span className="flex items-center gap-0.5 rounded bg-[#F6F0E6] px-1 py-px text-[8.5px] font-bold text-ink-2">
                    <Clock size={8} />
                    {p.programado}
                  </span>
                ) : (
                  <ChipPago texto={p.pago} pendiente={p.pendiente} />
                )
              }
            />
          ))}
        </div>

        <div className="mt-[12px] flex items-center gap-2 px-1">
          <span className="text-[9.5px] font-bold uppercase tracking-[.12em] text-ink-3">Historial</span>
          <span
            key={despachado ? 13 : 12}
            className={cn(
              'rounded-full px-1.5 text-[9.5px] font-bold leading-[15px]',
              despachado ? 'e-pop bg-emerald-500 text-white' : 'bg-[#ECE4D8] text-ink-3',
            )}
          >
            {despachado ? 13 : 12}
          </span>
        </div>
      </div>

      <div className="e-tarjeta absolute left-[222px] top-[12px] h-[316px] w-[226px] overflow-hidden">
        {!abierto ? (
          <div key="vacio" className="e-aparece flex h-full flex-col items-center justify-center gap-2.5 px-6 text-center">
            <span className="grid size-11 place-items-center rounded-2xl bg-[#F6F0E6] text-ink-3">
              <Receipt size={20} />
            </span>
            <p className="text-[12px] font-medium leading-snug text-ink-3">Tocá un pedido para ver su comanda</p>
          </div>
        ) : (
          <div key="detalle" className="e-derecha flex h-full flex-col p-[14px]">
            <p className="flex items-center gap-1 text-[10px] font-medium text-ink-3">
              <Bike size={11} />
              Delivery
            </p>
            <p className="mt-1 text-[24px] font-black leading-none tracking-tight text-ink">#{P.id}</p>
            <p className="mt-1.5 text-[13px] font-bold leading-tight text-ink">{P.cliente}</p>
            <p className="mt-0.5 flex items-center gap-1 text-[10.5px] font-semibold text-ink-2">
              <MapPin size={10} className="text-ink-3" />
              {P.direccion}
            </p>
            <p className="mt-1.5 flex items-center gap-1 text-[9.5px] text-ink-3">
              <UserRound size={10} className="shrink-0" />
              <span>
                <b className="font-semibold text-ink">{P.numero}</b> pedido de {P.corto} ·{' '}
                <b className="font-semibold text-ink">{pesos(P.historico)}</b> histórico
              </span>
            </p>
            <div className="my-2 h-px bg-[#ECE4D8]" />
            <p className="text-[8.5px] font-bold uppercase tracking-[.12em] text-ink-3">Comanda · 3 ítems</p>
            <div className="mt-1 grid gap-[5px]">
              {P.items.map((it) => (
                <div key={it.nombre}>
                  <p className="flex items-start justify-between gap-2 text-[10.5px] font-semibold leading-tight text-ink">
                    <span>
                      <span className="text-ink-3">{it.cantidad}x</span> {it.nombre}
                    </span>
                    <span className="tabular-nums">{pesos(it.precio)}</span>
                  </p>
                  {it.extras.map((x) => (
                    <p key={x} className="pl-4 text-[9.5px] leading-tight text-ink-3">
                      <b className="mr-1 font-bold text-emerald-600">+</b>
                      {x}
                    </p>
                  ))}
                  {it.sin.map((x) => (
                    <p key={x} className="pl-4 text-[9.5px] leading-tight text-ink-3">
                      Sin {x}
                    </p>
                  ))}
                </div>
              ))}
              <p className="flex justify-between text-[9.5px] text-ink-3">
                <span>Costo de envío</span>
                <span className="tabular-nums">{pesos(P.envio)}</span>
              </p>
            </div>
            <div className="mt-auto">
              <div className="flex items-baseline justify-between">
                <span className="text-[8.5px] font-bold uppercase tracking-[.12em] text-ink-3">Total cobrado</span>
                <span className="text-[19px] font-black tabular-nums tracking-tight text-brand">{pesos(P.total)}</span>
              </div>
              {despachado ? (
                <span
                  key="listo"
                  className="e-pop mt-2 flex h-[32px] items-center justify-center gap-1.5 rounded-xl bg-emerald-500/10 text-[11.5px] font-bold text-emerald-700"
                >
                  <Check size={14} strokeWidth={2.6} />
                  Despachado · pasó al historial
                </span>
              ) : (
                <span
                  className={cn(
                    'relative mt-2 flex h-[32px] items-center justify-center rounded-xl bg-brand text-[12px] font-bold text-white transition-[scale] duration-200',
                    fase === 3 && 'scale-[.97]',
                  )}
                >
                  Despachar pedido
                  {fase === 3 && <Toque vez={n} />}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </Escena>
  )
}
