import { CheckCircle2, CupSoda, Hamburger, Search, ShoppingCart, Utensils, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Escena, Toque } from './Escena'
import { d, useSecuencia } from './animacion'
import { SMASH, pesos } from './ejemplo'

const PRODUCTOS: { nombre: string; precio: number; Icono: LucideIcon }[] = [
  { nombre: 'Smash burger', precio: 10500, Icono: Hamburger },
  { nombre: 'Cheeseburger', precio: 11500, Icono: Hamburger },
  { nombre: 'Papas con cheddar', precio: 6500, Icono: Utensils },
  { nombre: 'Gaseosa 1,5 L', precio: 4000, Icono: CupSoda },
]
const DOBLE = SMASH.variantes[1]
const PAPAS = PRODUCTOS[2]

function Segmento({ opciones, elegida }: { opciones: string[]; elegida: string }) {
  return (
    <div
      className="grid gap-0.5 rounded-lg bg-[#F6F0E6] p-0.5"
      style={{ gridTemplateColumns: `repeat(${opciones.length}, minmax(0, 1fr))` }}
    >
      {opciones.map((o) => (
        <span
          key={o}
          className={cn(
            'flex h-[20px] items-center justify-center rounded-md text-[9px] font-bold',
            o === elegida ? 'bg-white text-ink shadow-[0_1px_2px_rgb(40_24_8/.12)]' : 'text-ink-3',
          )}
        >
          {o}
        </span>
      ))}
    </div>
  )
}

/**
 * Un pedido del mostrador en el punto de venta. Fases: 0 comanda en blanco · 1 elige la variante
 * de la Smash · 2 queda en la comanda · 3 suma unas papas · 4 toca "Anotar pedido" · 5 anotado.
 */
export function PosAnotar() {
  const n = useSecuencia(1600, 3)
  const fase = n % 6
  const items = [
    ...(fase >= 2 && fase <= 4 ? [{ nombre: `Smash burger · ${DOBLE.nombre}`, precio: DOBLE.precio }] : []),
    ...(fase >= 3 && fase <= 4 ? [{ nombre: PAPAS.nombre, precio: PAPAS.precio }] : []),
  ]
  const total = items.reduce((s, it) => s + it.precio, 0)
  return (
    <Escena
      ancho={460}
      alto={340}
      etiqueta="El punto de venta: se elige la Smash burger doble y unas papas, takeaway en efectivo, y al tocar Anotar pedido queda anotado como un pedido más."
    >
      <div className="e-tarjeta e-izquierda absolute left-[12px] top-[12px] h-[316px] w-[206px] p-3" style={d(0)}>
        <div className="flex h-[30px] items-center gap-2 rounded-xl bg-[#F6F0E6] px-2.5 text-[10.5px] text-ink-3">
          <Search size={13} />
          Buscar producto…
        </div>
        <div className="mt-2.5 flex gap-1.5 whitespace-nowrap">
          <span className="rounded-full bg-ink px-2 py-0.5 text-[9.5px] font-semibold text-white">Hamburguesas</span>
          <span className="rounded-full px-2 py-0.5 text-[9.5px] font-semibold text-ink-3 ring-1 ring-[#ECE4D8]">
            Para acompañar
          </span>
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          {PRODUCTOS.map((p, i) => {
            const tocado = (i === 0 && fase === 1) || (i === 2 && fase === 3)
            return (
              <div
                key={p.nombre}
                className={cn(
                  'e-pop relative flex h-[84px] flex-col justify-between rounded-[14px] bg-white p-2 ring-1 transition-[scale,box-shadow] duration-200',
                  tocado ? 'scale-[.97] ring-2 ring-brand' : 'ring-[#ECE4D8]',
                )}
                style={d(150 + i * 80)}
              >
                <span className="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand-deep">
                  <p.Icono size={16} />
                </span>
                <span>
                  <span className="block truncate text-[10px] font-semibold leading-tight text-ink">{p.nombre}</span>
                  <span className="text-[9.5px] tabular-nums text-ink-3">{pesos(p.precio)}</span>
                </span>
                {i === 2 && fase === 3 && <Toque vez={n} />}
              </div>
            )
          })}
        </div>

        {fase === 1 && (
          <div
            key={n}
            className="e-sube absolute inset-x-2 bottom-2 rounded-[16px] bg-white p-2.5 shadow-[0_0_0_1px_#ECE4D8,0_-14px_30px_-18px_rgb(40_24_8/.55)]"
            style={d(200)}
          >
            <p className="text-[10.5px] font-bold text-ink">{SMASH.nombre}</p>
            <p className="text-[9px] text-ink-3">Elegí una opción</p>
            <div className="mt-1.5 grid grid-cols-3 gap-1">
              {SMASH.variantes.map((v) => (
                <span
                  key={v.nombre}
                  className={cn(
                    'relative flex flex-col items-center rounded-lg py-1 ring-1',
                    v.nombre === DOBLE.nombre ? 'bg-brand-soft ring-brand' : 'ring-[#ECE4D8]',
                  )}
                >
                  <span className="text-[9.5px] font-bold text-ink">{v.nombre}</span>
                  <span className="text-[8.5px] tabular-nums text-ink-3">{pesos(v.precio)}</span>
                  {v.nombre === DOBLE.nombre && <Toque vez={n} />}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="e-tarjeta e-derecha absolute left-[230px] top-[12px] flex h-[316px] w-[218px] flex-col p-3.5" style={d(120)}>
        <p className="text-[20px] font-black leading-none tracking-tight text-ink">Nuevo pedido</p>
        <div className="my-2.5 h-px bg-[#ECE4D8]" />
        <p className="text-[8.5px] font-bold uppercase tracking-[.12em] text-ink-3">
          Comanda · {items.length} {items.length === 1 ? 'ítem' : 'ítems'}
        </p>
        {items.length === 0 ? (
          <div className="mt-2 flex h-[64px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[#DCD2C4] text-ink-3">
            <ShoppingCart size={15} />
            <span className="text-[10px] font-semibold">Comanda en blanco</span>
          </div>
        ) : (
          <div className="mt-1 grid grid-cols-1">
            {items.map((it, i) => (
              <div
                key={it.nombre}
                className={cn('e-derecha flex items-start justify-between gap-2 py-1.5', i > 0 && 'border-t border-[#ECE4D8]')}
                style={d(i === items.length - 1 ? 250 : 0)}
              >
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold text-ink">{it.nombre}</p>
                  <p className="text-[9px] tabular-nums text-ink-3">{pesos(it.precio)} c/u</p>
                </div>
                <span className="text-[11px] font-semibold tabular-nums text-ink">{pesos(it.precio)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-auto grid gap-1.5">
          <Segmento opciones={['Delivery', 'Takeaway']} elegida="Takeaway" />
          <Segmento opciones={['Efectivo', 'Tarjeta', 'Transf.', 'MP']} elegida="Efectivo" />
          <div className="mt-0.5 flex items-baseline justify-between">
            <span className="text-[8.5px] font-bold uppercase tracking-[.12em] text-ink-3">Total</span>
            <span key={total} className="e-pop text-[18px] font-black tabular-nums tracking-tight text-brand">
              {pesos(total)}
            </span>
          </div>
          <span
            className={cn(
              'relative flex h-[32px] items-center justify-center rounded-xl text-[12px] font-bold text-white transition-[scale,background-color] duration-200',
              items.length ? 'bg-brand' : 'bg-brand/45',
              fase === 4 && 'scale-[.97]',
            )}
          >
            Anotar pedido
            {fase === 4 && <Toque vez={n} />}
          </span>
        </div>

        {fase === 5 && (
          <div
            key={n}
            className="e-baja absolute inset-x-3 top-[46px] flex items-center gap-2 rounded-xl bg-white px-2.5 py-2 shadow-[0_0_0_1px_#ECE4D8,0_14px_28px_-14px_rgb(40_24_8/.5)]"
          >
            <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-bold text-ink">Pedido #1285 anotado</p>
              <p className="text-[9px] text-ink-3">Ya está en la lista y sale la comanda</p>
            </div>
            <span className="rounded bg-sky-500/10 px-1 text-[8.5px] font-bold text-sky-700">Manual</span>
          </div>
        )}
      </div>
    </Escena>
  )
}
