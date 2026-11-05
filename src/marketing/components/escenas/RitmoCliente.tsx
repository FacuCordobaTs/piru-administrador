import { Escena, type PropsEscena } from "./Escena";
import { d } from "./animacion";
import { CLIENTA } from "./ejemplo";

// La línea de tiempo de Martina, que pide cada ~12 días. Los umbrales son los de
// backend/src/lib/clientes-rfm.ts: se está yendo a 1,5 veces su ritmo, hace tiempo no viene a 3
// y dejó de pedir a 6, contados desde su último pedido.
const X0 = 26;
const ANCHO = 408;
const DIAS = 126;
const x = (dia: number) => X0 + (dia / DIAS) * ANCHO;
const PEDIDOS = [0, 12, 24, 36];
const ULTIMO = 36;
const HOY = 57;
const ZONAS = [
  { desde: 36, hasta: 54, clase: "bg-ink/10" },
  { desde: 54, hasta: 72, clase: "bg-orange-500" },
  { desde: 72, hasta: 108, clase: "bg-violet-500" },
  { desde: 108, hasta: 126, clase: "bg-rose-500" },
];
const MARCAS = [
  { dia: 54, texto: "1,5×" },
  { dia: 72, texto: "3×" },
  { dia: 108, texto: "6×" },
];
const LEYENDA = [
  { texto: "Se está yendo", clase: "bg-orange-500" },
  { texto: "Hace tiempo no viene", clase: "bg-violet-500" },
  { texto: "Dejó de pedir", clase: "bg-rose-500" },
];
const Y = 132;

export function RitmoCliente({ siempreActiva }: PropsEscena) {
  return (
    <Escena
      ancho={460}
      alto={250}
      etiqueta="La línea de tiempo de una clienta que pide cada 12 días. A los 21 días sin pedir ya pasó 1,5 veces su ritmo y figura como «Se está yendo»; a 3 veces, «Hace tiempo no viene»; a 6 veces, «Dejó de pedir»."
      siempreActiva={siempreActiva}
    >
      <div className="e-aparece absolute left-[24px] top-[16px] flex items-center gap-2.5">
        <span className="grid size-8 place-items-center rounded-full bg-brand-soft text-[11px] font-bold text-brand-deep">
          {CLIENTA.iniciales}
        </span>
        <p className="text-[13.5px] font-semibold text-ink">
          {CLIENTA.corto} pide cada ~{CLIENTA.cadencia} días
        </p>
      </div>
      <span
        className="e-pop absolute right-[24px] top-[20px] rounded-full bg-orange-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-[0_8px_18px_-8px_rgb(249_115_22/.8)]"
        style={d(2900)}
      >
        Hoy: se está yendo
      </span>

      <div
        className="absolute h-px bg-ink/15"
        style={{ left: X0, width: ANCHO, top: Y }}
      />

      {/* "cada ~12 días" entre dos pedidos */}
      <div
        className="e-aparece absolute"
        style={{ left: x(12), width: x(24) - x(12), top: Y - 30, ...d(800) }}
      >
        <div className="h-[7px] rounded-t-[4px] border-x-[1.5px] border-t-[1.5px] border-ink/30" />
        <span className="absolute -top-[20px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-2 py-0.5 text-[10.5px] font-semibold text-ink-2 shadow-[0_0_0_1px_#ECE4D8]">
          cada ~{CLIENTA.cadencia} días
        </span>
      </div>

      {PEDIDOS.map((dia, i) => (
        <span
          key={dia}
          className="e-pop absolute size-[15px] rounded-full border-[3.5px] border-brand bg-white"
          style={{ left: x(dia) - 7.5, top: Y - 7.5, ...d(150 + i * 150) }}
        />
      ))}

      {ZONAS.map((z, i) => (
        <div
          key={z.desde}
          className={`e-barra absolute h-2 rounded-full ${z.clase}`}
          style={{
            left: x(z.desde) + 2,
            width: x(z.hasta) - x(z.desde) - 4,
            top: Y + 20,
            ...d(1000 + i * 180),
          }}
        />
      ))}
      {MARCAS.map((m, i) => (
        <span
          key={m.dia}
          className="e-aparece absolute -translate-x-1/2 text-[11px] font-semibold tabular-nums text-ink-3"
          style={{ left: x(m.dia), top: Y + 34, ...d(1300 + i * 180) }}
        >
          {m.texto}
        </span>
      ))}
      <p
        className="e-aparece absolute text-[10.5px] text-ink-3"
        style={{ left: X0, top: Y + 34, ...d(1300) }}
      >
        Sin pedir, en veces su ritmo:
      </p>

      {/* "Hoy": viaja desde el último pedido hasta los 21 días sin pedir. */}
      <div
        className="e-avanza absolute w-[2px] rounded-full bg-orange-500"
        style={{
          left: x(HOY) - 1,
          top: Y - 58,
          height: 86,
          ...d(1700, { "--desde": `${x(ULTIMO) - x(HOY)}px` }),
        }}
      >
        <span className="absolute -top-[22px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-orange-500 px-2.5 py-1 text-[11px] font-bold text-white">
          Hoy · {HOY - ULTIMO} días sin pedir
        </span>
      </div>

      <div
        className="e-sube absolute flex gap-4"
        style={{ left: X0, top: Y + 70, ...d(1500) }}
      >
        {LEYENDA.map((l) => (
          <span
            key={l.texto}
            className="flex items-center gap-1.5 text-[11.5px] font-medium text-ink-2"
          >
            <span className={`size-2 rounded-full ${l.clase}`} />
            {l.texto}
          </span>
        ))}
      </div>
    </Escena>
  );
}
