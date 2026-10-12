import { Check, Megaphone, Receipt, Ticket, Trash2, User, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Escena, Toque, type PropsEscena } from '@/components/guia/escenas/Escena'
import { d, useSecuencia } from '@/components/guia/escenas/animacion'

const TARJETAS: { Icono: LucideIcon; titulo: string; detalle: string }[] = [
  { Icono: User, titulo: 'Mateo EJEMPLO', detalle: 'Cliente · 4 pedidos' },
  { Icono: Receipt, titulo: 'Pedido de Camila EJEMPLO', detalle: 'Pedido · delivery' },
  { Icono: Megaphone, titulo: 'Historias de Instagram · EJEMPLO', detalle: 'Campaña · 132 visitas' },
  { Icono: Ticket, titulo: 'EJEMPLO10', detalle: 'Cupón · 10% de descuento' },
]

/**
 * Los datos de ejemplo y cómo se borran. Fases: 0 y 1 llegan las tarjetas marcadas EJEMPLO · 2 se
 * resalta "Borrar datos de ejemplo" · 3 lo toca y se van · 4 queda la tienda como estaba.
 */
export function DatosEjemplo({ siempreActiva }: PropsEscena) {
  const n = useSecuencia(1700, 1)
  const fase = n % 5
  const borrado = fase >= 3
  const resultado = fase === 4
  return (
    <Escena
      siempreActiva={siempreActiva}
      ancho={460}
      alto={340}
      etiqueta="Los datos de ejemplo: un cliente, un pedido, una campaña y un cupón marcados EJEMPLO. Con «Borrar datos de ejemplo» se van todos y la carta y la configuración quedan como estaban."
    >
      {/* La columna es `minmax(0, 1fr)`: sin eso, un título largo ensancha la grilla y pisa la tarjeta de al lado. */}
      <div className="absolute left-[16px] top-[18px] grid w-[266px] grid-cols-[minmax(0,1fr)] gap-[9px]">
        {TARJETAS.map((t, i) => (
          <div
            key={t.titulo}
            className={cn(
              'flex h-[56px] items-center gap-2.5 rounded-[14px] bg-white px-2.5 ring-1 ring-[#ECE4D8] transition-[opacity,transform] duration-500',
              borrado && 'translate-x-3 opacity-0',
              !borrado && 'e-sube',
            )}
            style={borrado ? undefined : d(i * 90)}
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#F6F0E6] text-ink-2">
              <t.Icono size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11.5px] font-bold text-ink">{t.titulo}</span>
              <span className="mt-0.5 block text-[9.5px] text-ink-3">{t.detalle}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="e-tarjeta absolute left-[294px] top-[18px] flex h-[251px] w-[154px] flex-col p-3">
        {resultado ? (
          <div key="listo" className="e-pop flex h-full flex-col items-center justify-center gap-2 text-center">
            <span className="grid size-10 place-items-center rounded-full bg-emerald-500/10 text-emerald-700">
              <Check size={20} strokeWidth={2.6} />
            </span>
            <p className="text-[12.5px] font-bold leading-tight text-ink">Listo: ya no hay datos de ejemplo</p>
            <p className="text-[10.5px] leading-snug text-ink-3">Tu carta y tu configuración siguen igual.</p>
          </div>
        ) : (
          <>
            <p className="text-[9px] font-bold uppercase tracking-[.12em] text-ink-3">Arriba de la pantalla</p>
            <p className="mt-1.5 text-[11.5px] leading-snug text-ink-2">
              Todo lo marcado <b className="font-semibold text-ink">EJEMPLO</b> se borra de una vez.
            </p>
            <ul className="mt-2.5 grid gap-1.5 text-[10.5px] text-ink-2">
              {['Clientes y sus pedidos', 'Campañas y visitas', 'El cupón de ejemplo'].map((x) => (
                <li key={x} className="flex items-center gap-1.5">
                  <Check size={11} className="text-ink-3" />
                  {x}
                </li>
              ))}
            </ul>
            <span
              className={cn(
                'relative mt-auto flex h-[42px] items-center justify-center gap-1.5 rounded-xl px-2 text-center text-[11.5px] font-bold leading-tight transition-[scale,background-color,color] duration-200',
                fase >= 2 ? 'bg-brand text-white' : 'bg-[#F6F0E6] text-ink-2',
                fase === 3 && 'scale-[.97]',
              )}
            >
              <Trash2 size={13} className="shrink-0" />
              Borrar datos de ejemplo
              {fase === 3 && <Toque vez={n} />}
            </span>
          </>
        )}
      </div>

      <p className="absolute bottom-[14px] left-[16px] right-[16px] text-center text-[10.5px] text-ink-3">
        Nada de esto es de un cliente real: sirve para ver el panel en marcha.
      </p>
    </Escena>
  )
}
