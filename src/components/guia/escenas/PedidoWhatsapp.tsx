import { CheckCheck, LayoutDashboard, MessageCircle, SendHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Escena, Toque } from './Escena'
import { d, useSecuencia } from './animacion'
import { COLOR_LOCAL, LOCAL_EJEMPLO, PEDIDO_EJEMPLO as P, pesos } from './ejemplo'

const RUTA = 'M 206 150 C 226 150, 222 104, 240 96'
const MENSAJE = [
  `¡Hola ${LOCAL_EJEMPLO}! Te paso mi pedido:`,
  `Pedido #${P.id} · Delivery`,
  '1x Smash burger doble',
  '1x Papas con cheddar',
  '1x Gaseosa 1,5 L',
]

function Fila({
  titulo,
  detalle,
  extra,
  nueva,
  className,
}: {
  titulo: string
  detalle: string
  extra?: string
  nueva?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl px-2 py-1.5',
        nueva ? 'bg-brand-soft/70 ring-1 ring-brand/35' : '',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-semibold text-ink">{titulo}</p>
        <p className="truncate text-[9.5px] text-ink-3">{detalle}</p>
      </div>
      {extra && (
        <span
          className={cn(
            'shrink-0 rounded-full px-1.5 text-[9px] font-bold leading-[15px]',
            nueva ? 'bg-[#1FAF55] text-white' : 'text-ink-3',
          )}
        >
          {extra}
        </span>
      )}
    </div>
  )
}

/**
 * La tienda manda el pedido al WhatsApp del local. Fases: 0 el carrito · 1 toca "Confirmar
 * pedido" · 2 se abre WhatsApp con el pedido escrito · 3 enviado: llega al chat y al panel.
 */
export function PedidoWhatsapp() {
  const n = useSecuencia(1900, 3)
  const fase = n % 4
  const enWhatsapp = fase >= 2
  const enviado = fase === 3
  return (
    <Escena
      ancho={460}
      alto={340}
      etiqueta={`${P.corto} confirma el pedido en la tienda, se le abre WhatsApp con el pedido escrito y lo envía: llega al WhatsApp de ${LOCAL_EJEMPLO} y aparece en el panel.`}
    >
      <div className="e-celular e-izquierda absolute left-[18px] top-[12px] h-[316px] w-[186px]" style={d(0)}>
        <div className="e-celular-pantalla">
          {!enWhatsapp ? (
            <div key="tienda" className="e-aparece flex h-full flex-col">
              <div className="flex items-center gap-2 px-3 pb-2 pt-3">
                <span
                  className="grid size-8 shrink-0 place-items-center rounded-xl text-[13px] font-bold text-white"
                  style={{ backgroundColor: COLOR_LOCAL }}
                >
                  {LOCAL_EJEMPLO.slice(0, 1)}
                </span>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-bold leading-tight text-ink">{LOCAL_EJEMPLO}</p>
                  <p className="text-[9px] text-ink-3">my.piru.app/brasa</p>
                </div>
              </div>
              <div className="mx-3 h-px bg-[#ECE4D8]" />
              <p className="px-3 pt-2.5 text-[11px] font-bold text-ink">Tu pedido</p>
              <div className="mt-1 grid gap-1 px-3">
                {P.items.map((it) => (
                  <p key={it.nombre} className="flex justify-between gap-2 text-[9.5px] leading-tight text-ink-2">
                    <span className="truncate">
                      {it.cantidad}x {it.nombre}
                    </span>
                    <span className="shrink-0 tabular-nums">{pesos(it.precio)}</span>
                  </p>
                ))}
                <p className="flex justify-between text-[9.5px] text-ink-3">
                  <span>Envío · Zona Centro</span>
                  <span className="tabular-nums">{pesos(P.envio)}</span>
                </p>
              </div>
              <p className="px-3 pt-3 text-[9px] font-semibold uppercase tracking-[.1em] text-ink-3">Pagás con</p>
              <div className="mt-1 grid gap-1 px-3">
                {['Transferencia', 'Efectivo', 'Mercado Pago'].map((m, i) => (
                  <span
                    key={m}
                    className={cn(
                      'flex h-[22px] items-center gap-1.5 rounded-lg px-2 text-[9.5px] font-semibold ring-1',
                      i === 0 ? 'bg-brand-soft text-ink ring-brand/40' : 'text-ink-2 ring-[#ECE4D8]',
                    )}
                  >
                    <span
                      className={cn(
                        'size-2 rounded-full ring-1',
                        i === 0 ? 'bg-brand ring-brand' : 'bg-white ring-[#CFC6BA]',
                      )}
                    />
                    {m}
                  </span>
                ))}
              </div>
              <div className="mt-auto p-3">
                <span
                  className={cn(
                    'relative flex h-[34px] items-center justify-center rounded-xl text-[11px] font-bold text-white transition-[scale] duration-200',
                    fase === 1 && 'scale-[.97]',
                  )}
                  style={{ backgroundColor: COLOR_LOCAL }}
                >
                  Confirmar pedido · {pesos(P.total)}
                  {fase === 1 && <Toque vez={n} />}
                </span>
              </div>
            </div>
          ) : (
            <div key="whatsapp" className="e-aparece flex h-full flex-col bg-[#EFEAE2]">
              <div className="flex items-center gap-2 bg-[#0B6E5C] px-3 pb-2 pt-3 text-white">
                <span
                  className="grid size-7 place-items-center rounded-full text-[11px] font-bold"
                  style={{ backgroundColor: COLOR_LOCAL }}
                >
                  {LOCAL_EJEMPLO.slice(0, 1)}
                </span>
                <div>
                  <p className="text-[11.5px] font-semibold leading-tight">{LOCAL_EJEMPLO}</p>
                  <p className="text-[8.5px] text-white/70">en línea</p>
                </div>
              </div>
              <div className="flex-1 p-2">
                {enviado && (
                  <div className="e-burbuja e-sube ml-auto max-w-[150px] px-2 py-1.5 text-[9.5px] leading-[1.38]">
                    {MENSAJE.map((l, i) => (
                      <p key={l} className={i === 1 ? 'mt-0.5 font-semibold' : ''}>
                        {l}
                      </p>
                    ))}
                    <p className="mt-0.5">
                      Total: <b>{pesos(P.total)}</b>
                    </p>
                    <p className="flex items-center justify-end gap-0.5 text-[8px] text-[#667781]">
                      {P.hora}
                      <CheckCheck size={10} className="text-[#53BDEB]" />
                    </p>
                  </div>
                )}
              </div>
              <div className="flex items-end gap-1.5 p-2">
                <div className="min-h-[30px] flex-1 rounded-2xl bg-white px-2.5 py-1.5 text-[9px] leading-snug text-[#111b21]">
                  {enviado ? (
                    <span className="text-[#8696A0]">Mensaje</span>
                  ) : (
                    <span className="line-clamp-3">
                      {MENSAJE.join(' ')} Total: {pesos(P.total)}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    'grid size-[30px] shrink-0 place-items-center rounded-full bg-[#1FAF55] text-white',
                    fase === 2 && 'e-latido',
                  )}
                >
                  <SendHorizontal size={14} />
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <svg className="absolute inset-0" width={460} height={340} viewBox="0 0 460 340" fill="none" aria-hidden>
        <path d={RUTA} stroke="#FF7A00" strokeWidth={2} strokeLinecap="round" opacity={0.5} className="e-hormigas" />
        <path d="M 206 150 C 226 150, 222 236, 240 244" stroke="#FF7A00" strokeWidth={2} strokeLinecap="round" opacity={0.5} className="e-hormigas" />
      </svg>
      {enviado && (
        <span
          key={n}
          className="e-vuela absolute left-0 top-0 size-3 rounded-full bg-brand shadow-[0_0_0_5px_rgb(255_122_0/.22)]"
          style={d(0, { '--ruta': `path("${RUTA}")` })}
        />
      )}

      <div className="e-tarjeta e-derecha absolute left-[240px] top-[24px] w-[208px] overflow-hidden" style={d(250)}>
        <p className="flex items-center gap-1.5 bg-[#0B6E5C] px-3 py-1.5 text-[10.5px] font-semibold text-white">
          <MessageCircle size={12} />
          WhatsApp de {LOCAL_EJEMPLO}
        </p>
        <div className="grid grid-cols-1 gap-0.5 p-1.5">
          {enviado && (
            <Fila
              key="nueva"
              className="e-pop"
              titulo={P.cliente}
              detalle={`¡Hola ${LOCAL_EJEMPLO}! Te paso mi pedido…`}
              extra="1"
              nueva
            />
          )}
          <Fila titulo="Lucas Fernández" detalle="¡Gracias! Paso en 20 min" extra="20:52" />
        </div>
      </div>

      <div className="e-tarjeta e-derecha absolute left-[240px] top-[176px] w-[208px] overflow-hidden" style={d(400)}>
        <p className="flex items-center gap-1.5 px-3 pt-2 text-[10.5px] font-semibold text-ink">
          <LayoutDashboard size={12} className="text-brand-deep" />
          Panel · Inicio
        </p>
        <div className="grid grid-cols-1 gap-0.5 p-1.5">
          {enviado && (
            <Fila
              key="nuevo"
              className="e-pop"
              titulo={`#${P.id} · Delivery · ${pesos(P.total)}`}
              detalle={`${P.cliente} · hace 1 min`}
              nueva
            />
          )}
          <Fila titulo={`#1283 · Takeaway · ${pesos(11500)}`} detalle="Lucas Fernández · hace 4 min" />
        </div>
      </div>
    </Escena>
  )
}
