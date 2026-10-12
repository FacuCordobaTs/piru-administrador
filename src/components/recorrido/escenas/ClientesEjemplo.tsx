import { MessageCircle, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Escena, type PropsEscena } from '@/components/guia/escenas/Escena'
import { d, useSecuencia } from '@/components/guia/escenas/animacion'

type Tono = 'verde' | 'azul' | 'naranja' | 'ambar' | 'gris'

const TONOS: Record<Tono, string> = {
  verde: 'bg-emerald-100 text-emerald-800',
  azul: 'bg-sky-100 text-sky-800',
  naranja: 'bg-brand-soft text-brand-deep',
  ambar: 'bg-amber-100 text-amber-800',
  gris: 'bg-[#ECE4D8] text-ink-2',
}

// Los mismos clientes (y la misma historia de Martina) que los datos de ejemplo del panel.
const CLIENTES: {
  nombre: string
  iniciales: string
  segmento: string
  tono: Tono
  pedidos: number
  ritmo: string
  ultimo: string
  nota: string
}[] = [
  { nombre: 'Camila EJEMPLO', iniciales: 'CE', segmento: 'VIP', tono: 'verde', pedidos: 9, ritmo: 'cada ~7 días', ultimo: 'hace 3 días', nota: 'Pide seguido: no hace falta escribirle.' },
  { nombre: 'Mateo EJEMPLO', iniciales: 'ME', segmento: 'Activo', tono: 'azul', pedidos: 4, ritmo: 'cada ~11 días', ultimo: 'hace 6 días', nota: 'Viene a su ritmo.' },
  { nombre: 'Bruno EJEMPLO', iniciales: 'BE', segmento: 'Nuevo', tono: 'naranja', pedidos: 1, ritmo: 'todavía no hay', ultimo: 'hace 1 día', nota: 'Llegó por una historia: falta el segundo pedido.' },
  { nombre: 'Martina EJEMPLO', iniciales: 'ME', segmento: 'Se está yendo', tono: 'ambar', pedidos: 7, ritmo: 'cada ~12 días', ultimo: 'hace 21 días', nota: 'Piru te deja el mensaje listo para escribirle.' },
  { nombre: 'Gonzalo EJEMPLO', iniciales: 'GE', segmento: 'Perdido', tono: 'gris', pedidos: 3, ritmo: 'cada ~7 días', ultimo: 'hace 55 días', nota: 'Hace mucho que no pide.' },
]

/**
 * Clientes, con la ficha de cada uno y quién se está yendo. Fases: una por cliente; con "Martina" el
 * detalle muestra el mensaje que Piru deja listo.
 */
export function ClientesEjemplo({ siempreActiva }: PropsEscena) {
  const n = useSecuencia(2200, 3)
  const fase = n % CLIENTES.length
  const c = CLIENTES[fase]
  const seVa = c.segmento === 'Se está yendo'
  return (
    <Escena
      siempreActiva={siempreActiva}
      ancho={460}
      alto={340}
      etiqueta="Clientes: la base de ejemplo con Camila VIP, Mateo activo, Bruno nuevo, Martina que se está yendo y Gonzalo que no vuelve. Con Martina, Piru deja el mensaje de recompra listo."
    >
      <div className="absolute left-[12px] top-[12px] w-[232px]">
        <p className="flex h-[24px] items-center gap-1.5 text-[13px] font-bold text-ink">
          <Users size={14} className="text-brand-deep" />
          Clientes
          <span className="rounded-full bg-[#ECE4D8] px-1.5 text-[10px] font-semibold leading-[16px] text-ink-2">16</span>
        </p>
        <div className="mt-[8px] grid gap-[7px]">
          {CLIENTES.map((cl, i) => (
            <div
              key={cl.nombre}
              className={cn(
                'e-sube flex h-[50px] items-center gap-2.5 rounded-[13px] bg-white px-2.5 ring-1 transition-[box-shadow,background-color] duration-300',
                i === fase ? 'bg-brand-soft/70 ring-brand/45 shadow-[inset_3px_0_0_#FF7A00]' : 'ring-[#ECE4D8]',
              )}
              style={d(i * 70)}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#F6F0E6] text-[10.5px] font-bold text-ink-2">
                {cl.iniciales}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11.5px] font-bold text-ink">{cl.nombre}</span>
                <span className="mt-0.5 block text-[9.5px] text-ink-3">
                  {cl.pedidos} {cl.pedidos === 1 ? 'pedido' : 'pedidos'}
                </span>
              </span>
              <span className={cn('shrink-0 rounded-full px-1.5 py-[2px] text-[8.5px] font-bold', TONOS[cl.tono])}>
                {cl.segmento}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="e-tarjeta absolute left-[256px] top-[12px] h-[316px] w-[192px] overflow-hidden">
        <div key={c.nombre} className="e-derecha flex h-full flex-col p-[14px]">
          <span className="grid size-11 place-items-center rounded-full bg-[#F6F0E6] text-[14px] font-bold text-ink-2">
            {c.iniciales}
          </span>
          <p className="mt-2 text-[14px] font-black leading-tight text-ink">{c.nombre}</p>
          <span className={cn('mt-1.5 w-fit rounded-full px-2 py-[2px] text-[9.5px] font-bold', TONOS[c.tono])}>
            {c.segmento}
          </span>
          <dl className="mt-3 grid gap-[5px] text-[10.5px]">
            <div className="flex justify-between gap-2">
              <dt className="text-ink-3">Pedidos</dt>
              <dd className="font-semibold text-ink">{c.pedidos}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-ink-3">Pide</dt>
              <dd className="font-semibold text-ink">{c.ritmo}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-ink-3">Último pedido</dt>
              <dd className="font-semibold text-ink">{c.ultimo}</dd>
            </div>
          </dl>
          <p className="mt-3 text-[10.5px] leading-snug text-ink-2">{c.nota}</p>
          {seVa && (
            <div className="e-burbuja e-pop mt-auto px-2.5 py-2 text-[10.5px] leading-snug" style={d(250)}>
              <span className="mb-1 flex items-center gap-1 text-[9px] font-bold text-emerald-700">
                <MessageCircle size={10} />
                Mensaje listo
              </span>
              Hola Martina, hace rato que no te vemos. Tu pedido de siempre te espera.
            </div>
          )}
        </div>
      </div>
    </Escena>
  )
}
