import { Check, CircleMinus, CirclePlus, Hamburger, Layers, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Escena, Toque } from './Escena'
import { d, useSecuencia } from './animacion'
import { SMASH, pesos } from './ejemplo'

const NOTAS: { Icono: LucideIcon; titulo: string; texto: string; fase: number }[] = [
  { Icono: Layers, titulo: 'Variantes', texto: 'Ponen el precio: Simple, Doble o Triple.', fase: 1 },
  { Icono: CircleMinus, titulo: 'Ingredientes', texto: 'Los que el cliente puede sacar.', fase: 2 },
  { Icono: CirclePlus, titulo: 'Extras', texto: 'Se suman al precio, como el cheddar.', fase: 3 },
]
const QUITADO = SMASH.ingredientes[1]
const EXTRA = SMASH.extras[0]

function Etiqueta({ children }: { children: string }) {
  return <p className="text-[8.5px] font-bold uppercase tracking-[.11em] text-ink-3">{children}</p>
}

/**
 * La Smash burger como la ve el cliente, armada con lo que se carga en Menú. Fases: 0 Simple ·
 * 1 elige Doble · 2 saca la cebolla · 3 suma extra cheddar · 4 la agrega al pedido.
 */
export function ProductoOpciones() {
  const n = useSecuencia(1500, 3)
  const fase = n % 5
  const variante = SMASH.variantes[fase >= 1 ? 1 : 0]
  const conExtra = fase >= 3
  const precio = variante.precio + (conExtra ? EXTRA.precio : 0)
  return (
    <Escena
      ancho={460}
      alto={340}
      etiqueta={`La Smash burger como la ve el cliente: elige la variante Doble, saca la cebolla caramelizada y suma extra cheddar; el precio pasa a ${pesos(SMASH.variantes[1].precio + EXTRA.precio)}.`}
    >
      <div className="e-tarjeta e-sube absolute left-[22px] top-[12px] flex h-[316px] w-[262px] flex-col overflow-hidden" style={d(0)}>
        <div className="grid h-[56px] shrink-0 place-items-center bg-[linear-gradient(135deg,#FFE7CC,#FFC48A)] text-brand-deep">
          <Hamburger size={30} strokeWidth={1.8} />
        </div>
        <div className="flex flex-1 flex-col p-3">
          <p className="flex items-baseline justify-between text-[14px] font-bold leading-tight text-ink">
            {SMASH.nombre}
            <span key={precio} className="e-pop text-[12px] font-bold tabular-nums text-brand-deep">
              {pesos(precio)}
            </span>
          </p>

          <div className="mt-2">
            <Etiqueta>Elegí una opción</Etiqueta>
            <div className="mt-1 grid grid-cols-3 gap-1">
              {SMASH.variantes.map((v) => (
                <span
                  key={v.nombre}
                  className={cn(
                    'flex h-[30px] flex-col items-center justify-center rounded-lg ring-1 transition-colors duration-300',
                    v.nombre === variante.nombre ? 'bg-brand-soft ring-brand' : 'ring-[#ECE4D8]',
                  )}
                >
                  <span className="text-[9.5px] font-bold leading-tight text-ink">{v.nombre}</span>
                  <span className="text-[8px] tabular-nums text-ink-3">{pesos(v.precio)}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="mt-2">
            <Etiqueta>Ingredientes</Etiqueta>
            <div className="mt-1 flex flex-wrap gap-1">
              {SMASH.ingredientes.map((ing) => {
                const sin = ing === QUITADO && fase >= 2
                return (
                  <span
                    key={ing}
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[9px] font-semibold ring-1 transition-colors duration-300',
                      sin ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-white text-ink-2 ring-[#ECE4D8]',
                    )}
                  >
                    {sin ? `Sin ${ing.toLowerCase()}` : ing}
                  </span>
                )
              })}
            </div>
          </div>

          <div className="mt-2">
            <Etiqueta>Extras</Etiqueta>
            <div className="mt-1 grid gap-1">
              {SMASH.extras.map((x) => {
                const elegido = x.nombre === EXTRA.nombre && conExtra
                return (
                  <p key={x.nombre} className="flex items-center gap-1.5 text-[10px] text-ink-2">
                    <span
                      className={cn(
                        'grid size-3.5 place-items-center rounded ring-1 transition-colors duration-300',
                        elegido ? 'bg-brand text-white ring-brand' : 'bg-white ring-[#CFC6BA]',
                      )}
                    >
                      {elegido && <Check size={9} strokeWidth={3.5} />}
                    </span>
                    {x.nombre}
                    <span className="ml-auto tabular-nums text-ink-3">+{pesos(x.precio)}</span>
                  </p>
                )
              })}
            </div>
          </div>

          <span
            className={cn(
              'relative mt-auto flex h-[30px] items-center justify-center rounded-xl bg-brand text-[11px] font-bold text-white transition-[scale] duration-200',
              fase === 4 && 'scale-[.97]',
            )}
          >
            Agregar · {pesos(precio)}
            {fase === 4 && <Toque vez={n} />}
          </span>
        </div>
      </div>

      <div className="absolute left-[300px] top-[70px] grid w-[148px] gap-2.5">
        {NOTAS.map((x, i) => {
          const activa = fase === x.fase || (fase === 4 && i === 2)
          return (
            <div
              key={x.titulo}
              className={cn(
                'e-derecha rounded-[16px] p-2.5 ring-1 transition-[background-color,box-shadow] duration-300',
                activa ? 'bg-brand-soft ring-brand/50 shadow-[0_10px_22px_-14px_rgb(255_122_0/.7)]' : 'bg-white ring-[#ECE4D8]',
              )}
              style={d(250 + i * 140)}
            >
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-ink">
                <x.Icono size={13} className="text-brand-deep" />
                {x.titulo}
              </p>
              <p className="mt-0.5 text-[9.5px] leading-snug text-ink-2">{x.texto}</p>
            </div>
          )
        })}
      </div>
    </Escena>
  )
}
