import { Copy, Printer, Receipt, RotateCcw, type LucideIcon } from 'lucide-react'
import { Escena } from './Escena'
import { d, useSecuencia } from './animacion'
import { LOCAL_EJEMPLO, PEDIDO_EJEMPLO as P, pesos } from './ejemplo'

const LINEA = '-'.repeat(32)
const fila = (izq: string, der: string) => izq + ' '.repeat(Math.max(1, 32 - izq.length - der.length)) + der
const PASOS: { Icono: LucideIcon; titulo: string; texto: string; ms: number }[] = [
  { Icono: Receipt, titulo: `${P.hora} · Entra el #${P.id}`, texto: 'Un delivery de la tienda, pagado.', ms: 0 },
  { Icono: Printer, titulo: 'Se imprime solo', texto: 'En la impresora de la cocina, sin tocar nada.', ms: 900 },
  { Icono: Copy, titulo: 'Una sola vez', texto: 'Aunque el panel esté abierto en varias compus.', ms: 2500 },
  { Icono: RotateCcw, titulo: '¿Hace falta otra?', texto: '«Reimprimir comprobante», en el detalle.', ms: 3300 },
]

/** La comanda del #1284 saliendo de la impresora térmica, con el formato real de 32 columnas. */
export function ComandaTicket() {
  const n = useSecuencia(7000)
  return (
    <Escena
      ancho={460}
      alto={360}
      etiqueta={`La comanda del pedido #${P.id} sale sola por la impresora térmica de la cocina, con los extras y los ingredientes quitados bien a la vista.`}
    >
      <div className="absolute left-[30px] top-[14px] w-[228px]">
        <div className="e-baja relative h-[46px] rounded-[14px] bg-[#2B2520] shadow-[0_14px_26px_-14px_rgb(40_24_8/.7)]" style={d(0)}>
          <span className="absolute left-3 top-3 text-[9.5px] font-semibold text-white/70">Cocina</span>
          <span className="e-latido absolute right-3 top-3.5 size-2 rounded-full bg-emerald-400" />
          <span className="absolute inset-x-5 bottom-2 h-[4px] rounded-full bg-black/60" />
        </div>
        <div className="mx-5 h-[298px] overflow-hidden">
          <div key={n} className="e-imprime" style={d(400, { '--t': '2.6s' })}>
            <div className="e-ticket whitespace-pre px-2.5 pb-1.5 pt-2 text-[8.5px] leading-[1.42]">
              <p className="text-center text-[11px] font-bold">{LOCAL_EJEMPLO.toUpperCase()}</p>
              <p>{LINEA}</p>
              <p>{`Fecha: 27/9/2026 ${P.hora}`}</p>
              <p>{LINEA}</p>
              <p className="font-bold">{`PEDIDO #${P.id}\nDELIVERY`}</p>
              <p>{LINEA}</p>
              <p>{`Cliente: ${P.cliente}`}</p>
              <p className="font-bold">{`Dir: ${P.direccion}`}</p>
              <p>{LINEA}</p>
              <p className="font-bold">PAGO: Transferencia</p>
              <p>{LINEA}</p>
              {P.items.map((it) => (
                <div key={it.nombre}>
                  {it.extras.length || it.sin.length ? (
                    <>
                      <p className="font-bold">{`${it.cantidad}x ${it.nombre.replace(' · ', ' - ')}`}</p>
                      <p className="text-right">{pesos(it.precio)}</p>
                      {it.extras.map((x) => (
                        <p key={x} className="text-[9.5px] font-bold">{`  CON: + ${x}`}</p>
                      ))}
                      {it.sin.map((x) => (
                        <p key={x} className="text-[9.5px] font-bold">{`  SIN: - ${x}`}</p>
                      ))}
                    </>
                  ) : (
                    <p>{fila(`${it.cantidad}x ${it.nombre}`, pesos(it.precio))}</p>
                  )}
                </div>
              ))}
              <p>{LINEA}</p>
              <p>{fila('Costo envío', pesos(P.envio))}</p>
              <p className="text-right text-[10px] font-bold">{`Total: ${pesos(P.total)}`}</p>
            </div>
            <div className="e-ticket-corte" />
          </div>
        </div>
      </div>

      <div className="absolute left-[282px] top-[30px] grid w-[166px] gap-2.5">
        {PASOS.map((p) => (
          <div key={`${p.titulo}-${n}`} className="e-derecha e-tarjeta flex gap-2.5 p-2.5" style={d(p.ms)}>
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-deep">
              <p.Icono size={14} />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-bold leading-tight text-ink">{p.titulo}</span>
              <span className="mt-0.5 block text-[9.5px] leading-snug text-ink-3">{p.texto}</span>
            </span>
          </div>
        ))}
      </div>
    </Escena>
  )
}
