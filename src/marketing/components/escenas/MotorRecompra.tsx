import type { ReactNode } from "react";
import { Escena, type PropsEscena } from "./Escena";
import { d, useSecuencia } from "./animacion";
import { CLIENTA } from "./ejemplo";
import "./motor.css";

// Las escenas del diálogo de Hoy que explica el motor de recompra (RecorridoMotor.tsx). Repiten
// reglas de backend/src/lib/clientes-rfm.ts (ritmo = mediana de días entre pedidos; 1,5×, 3× y 6×)
// y de la guía: si cambia una regla, se actualizan las dos.

const C = {
  brand: "#FF7A00",
  deep: "#E66E00",
  soft: "#FFF2E3",
  ink: "#191512",
  ink2: "#4A433C",
  ink3: "#80776E",
  line: "#ECE4D8",
  sand: "#F6F0E6",
  verde: "#10B981",
  naranja: "#F97316",
  violeta: "#8B5CF6",
  rosa: "#F43F5E",
};

/** El lienzo SVG de 460 × 300 donde se dibujan las escenas del motor. */
function Lienzo({ children }: { children: ReactNode }) {
  return (
    <svg className="m-svg absolute inset-0" width={460} height={300} viewBox="0 0 460 300" fill="none" aria-hidden>
      {children}
    </svg>
  );
}

/** El encabezado de cada escena: la clienta y lo que pasa con ella. */
function Encabezado({ titulo, sub }: { titulo: string; sub: string }) {
  return (
    <g className="m-aparece">
      <circle cx={38} cy={36} r={16} fill={C.soft} />
      <text x={38} y={40} textAnchor="middle" fontSize={11} fontWeight={700} fill={C.deep}>
        {CLIENTA.iniciales}
      </text>
      <text x={64} y={32} fontSize={14} fontWeight={600} fill={C.ink}>
        {titulo}
      </text>
      <text x={64} y={50} fontSize={11.5} fill={C.ink3}>
        {sub}
      </text>
    </g>
  );
}

/** Una píldora con texto centrado en `x`. El ancho se estima por la cantidad de letras. */
function Pildora({
  x,
  y,
  texto,
  fondo = "#fff",
  color = C.ink2,
  tam = 10.5,
  borde = true,
}: {
  x: number;
  y: number;
  texto: string;
  fondo?: string;
  color?: string;
  tam?: number;
  borde?: boolean;
}) {
  const ancho = texto.length * tam * 0.56 + 18;
  const alto = tam + 10;
  return (
    <g>
      <rect
        x={x - ancho / 2}
        y={y - alto / 2}
        width={ancho}
        height={alto}
        rx={alto / 2}
        fill={fondo}
        stroke={borde ? C.line : "none"}
      />
      <text x={x} y={y + tam * 0.36} textAnchor="middle" fontSize={tam} fontWeight={600} fill={color}>
        {texto}
      </text>
    </g>
  );
}

// ── 1. Cada cliente tiene su ritmo ─────────────────────────────────────────────────────────────
const PEDIDOS = [
  { dia: 0, fecha: "2 sep" },
  { dia: 11, fecha: "13 sep" },
  { dia: 24, fecha: "26 sep" },
  { dia: 36, fecha: "8 oct" },
  { dia: 48, fecha: "20 oct" },
];
const xRitmo = (dia: number) => 50 + dia * (360 / 56);
const Y_RITMO = 168;

export function RitmoHabitual({ siempreActiva }: PropsEscena) {
  return (
    <Escena
      ancho={460}
      alto={300}
      etiqueta={`Los pedidos de ${CLIENTA.corto}: entre uno y otro pasan 11, 13, 12 y 12 días. El punto medio, 12 días, es su ritmo habitual.`}
      siempreActiva={siempreActiva}
    >
      <Lienzo>
        <Encabezado titulo={`¿Cada cuánto pide ${CLIENTA.corto}?`} sub="Piru cuenta los días entre sus pedidos" />
        <line x1={34} x2={426} y1={Y_RITMO} y2={Y_RITMO} stroke={C.ink} strokeOpacity={0.15} />

        {PEDIDOS.slice(1).map((p, i) => {
          const x1 = xRitmo(PEDIDOS[i].dia) + 9;
          const x2 = xRitmo(p.dia) - 9;
          const medio = (x1 + x2) / 2;
          return (
            <g key={p.dia}>
              <path
                d={`M ${x1} ${Y_RITMO - 8} Q ${medio} ${Y_RITMO - 62} ${x2} ${Y_RITMO - 8}`}
                pathLength={1}
                stroke={C.deep}
                strokeWidth={1.6}
                strokeLinecap="round"
                className="m-dibuja"
                style={d(700 + i * 260)}
              />
              <g className="m-pop" style={d(950 + i * 260)}>
                <Pildora x={medio} y={Y_RITMO - 40} texto={`${p.dia - PEDIDOS[i].dia} días`} />
              </g>
            </g>
          );
        })}

        {PEDIDOS.map((p, i) => (
          <g key={p.dia}>
            <circle
              cx={xRitmo(p.dia)}
              cy={Y_RITMO}
              r={7.5}
              fill="#fff"
              stroke={C.brand}
              strokeWidth={3.5}
              className="m-pop"
              style={d(120 + i * 130)}
            />
            <text
              x={xRitmo(p.dia)}
              y={Y_RITMO + 26}
              textAnchor="middle"
              fontSize={10.5}
              fill={C.ink3}
              className="m-aparece"
              style={d(200 + i * 130)}
            >
              {p.fecha}
            </text>
          </g>
        ))}
        <circle
          cx={xRitmo(48)}
          cy={Y_RITMO}
          r={7.5}
          stroke={C.brand}
          strokeWidth={2}
          className="m-latido"
          style={d(2800)}
        />

        <g className="m-pop" style={d(2100)}>
          <rect x={120} y={222} width={220} height={52} rx={16} fill={C.ink} />
          <text x={230} y={244} textAnchor="middle" fontSize={14} fontWeight={700} fill="#fff">
            Su ritmo: cada ~{CLIENTA.cadencia} días
          </text>
          <text x={230} y={262} textAnchor="middle" fontSize={10.5} fill="#fff" fillOpacity={0.7}>
            el punto medio de todas sus esperas
          </text>
        </g>
      </Lienzo>
    </Escena>
  );
}

// ── 2. Cuando se pasa de su ritmo ──────────────────────────────────────────────────────────────
const xPaso = (dia: number) => 40 + dia * 4.75;
const SIN_PEDIR = 21;
const Y_PASO = 150;
const ZONAS = [
  { desde: 0, hasta: 18, color: C.verde },
  { desde: 18, hasta: 36, color: C.naranja },
  { desde: 36, hasta: 72, color: C.violeta },
  { desde: 72, hasta: 80, color: C.rosa },
];
const MARCAS = [
  { dia: 18, texto: "1,5×" },
  { dia: 36, texto: "3×" },
  { dia: 72, texto: "6×" },
];
const LEYENDA = [
  { x: 40, texto: "En su ritmo", color: C.verde },
  { x: 128, texto: "Se está yendo", color: C.naranja },
  { x: 228, texto: "Hace tiempo no viene", color: C.violeta },
  { x: 362, texto: "Dejó de pedir", color: C.rosa },
];

export function FueraDeRitmo({ siempreActiva }: PropsEscena) {
  const ritmo = CLIENTA.cadencia;
  const exceso = SIN_PEDIR - ritmo;
  return (
    <Escena
      ancho={460}
      alto={300}
      etiqueta={`${CLIENTA.corto} pide cada ${ritmo} días y hace ${SIN_PEDIR} que no pide: se pasó ${exceso} días de su ritmo. A 1,5 veces su ritmo figura como «Se está yendo», a 3 veces «Hace tiempo no viene» y a 6 veces «Dejó de pedir».`}
      siempreActiva={siempreActiva}
    >
      <Lienzo>
        <Encabezado titulo={`${CLIENTA.corto} no volvió cuando solía`} sub={`Pide cada ~${ritmo} días`} />

        <line x1={34} x2={426} y1={Y_PASO} y2={Y_PASO} stroke={C.ink} strokeOpacity={0.15} />

        {/* Cuando debería haber vuelto. */}
        <g className="m-aparece" style={d(500)}>
          <line
            x1={xPaso(ritmo)}
            x2={xPaso(ritmo)}
            y1={Y_PASO - 40}
            y2={Y_PASO}
            stroke={C.ink3}
            strokeWidth={1.5}
            strokeDasharray="3 4"
          />
          <text x={xPaso(ritmo) - 6} y={Y_PASO - 30} textAnchor="end" fontSize={10.5} fill={C.ink3}>
            Volvía acá
          </text>
        </g>

        {/* Los días de más, entre su ritmo y hoy. */}
        <rect
          x={xPaso(ritmo)}
          y={Y_PASO - 7}
          width={xPaso(SIN_PEDIR) - xPaso(ritmo)}
          height={14}
          rx={4}
          fill={C.naranja}
          fillOpacity={0.22}
          className="m-crece-x"
          style={d(2300)}
        />
        <text
          x={(xPaso(ritmo) + xPaso(SIN_PEDIR)) / 2}
          y={Y_PASO + 28}
          textAnchor="middle"
          fontSize={12}
          fontWeight={700}
          fill={C.deep}
          className="m-pop"
          style={d(2600)}
        >
          +{exceso} días
        </text>

        <circle cx={xPaso(0)} cy={Y_PASO} r={7.5} fill="#fff" stroke={C.brand} strokeWidth={3.5} className="m-pop" style={d(150)} />
        <text x={xPaso(0)} y={Y_PASO + 28} textAnchor="middle" fontSize={10.5} fill={C.ink3} className="m-aparece" style={d(250)}>
          Último
        </text>

        {/* "Hoy": viaja desde el último pedido. */}
        <g className="m-avanza" style={d(800, { "--desde": `${xPaso(0) - xPaso(SIN_PEDIR)}px` })}>
          <line x1={xPaso(SIN_PEDIR)} x2={xPaso(SIN_PEDIR)} y1={Y_PASO - 62} y2={Y_PASO + 10} stroke={C.naranja} strokeWidth={2} strokeLinecap="round" />
          <Pildora x={xPaso(SIN_PEDIR) + 30} y={Y_PASO - 70} texto={`Hoy · ${SIN_PEDIR} días sin pedir`} fondo={C.naranja} color="#fff" tam={11} borde={false} />
        </g>

        {ZONAS.map((z, i) => (
          <rect
            key={z.desde}
            x={xPaso(z.desde) + 2}
            y={206}
            width={xPaso(z.hasta) - xPaso(z.desde) - 4}
            height={8}
            rx={4}
            fill={z.color}
            className="m-crece-x"
            style={d(1100 + i * 180)}
          />
        ))}
        {MARCAS.map((m, i) => (
          <text
            key={m.dia}
            x={xPaso(m.dia)}
            y={234}
            textAnchor="middle"
            fontSize={11}
            fontWeight={600}
            fill={C.ink3}
            className="m-aparece"
            style={d(1400 + i * 180)}
          >
            {m.texto}
          </text>
        ))}
        <text x={xPaso(0)} y={196} fontSize={10.5} fill={C.ink3} className="m-aparece" style={d(1300)}>
          Días sin pedir, en veces su ritmo
        </text>
        <g className="m-aparece" style={d(1700)}>
          {LEYENDA.map((l) => (
            <g key={l.texto}>
              <circle cx={l.x + 4} cy={266} r={4} fill={l.color} />
              <text x={l.x + 13} y={270} fontSize={11} fontWeight={500} fill={C.ink2}>
                {l.texto}
              </text>
            </g>
          ))}
        </g>

        <g className="m-pop" style={d(2900)}>
          <Pildora x={380} y={32} texto="Entra a la agenda" fondo={C.ink} color="#fff" tam={11} borde={false} />
        </g>
      </Lienzo>
    </Escena>
  );
}

// ── 3. El día que suele pedir ──────────────────────────────────────────────────────────────────
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const PEDIDOS_POR_DIA = [0, 1, 1, 5, 2, 0, 0];
const SUYO = 3;
const xDia = (i: number) => 40 + i * 56;
const BASE = 214;

export function DiaHabitual({ siempreActiva }: PropsEscena) {
  const centro = xDia(SUYO) + 26;
  return (
    <Escena
      ancho={460}
      alto={300}
      etiqueta={`${CLIENTA.corto} pide casi siempre los jueves a la noche: su mensaje se agenda para el jueves a las 20:30. Los que dejaron de pedir se reparten en los días con menos movimiento.`}
      siempreActiva={siempreActiva}
    >
      <Lienzo>
        <Encabezado titulo="Le escribís el día que suele pedir" sub={`Los pedidos de ${CLIENTA.corto}, por día de la semana`} />

        {DIAS.map((dia, i) => {
          const suyo = i === SUYO;
          const alto = PEDIDOS_POR_DIA[i] * 17;
          return (
            <g key={dia}>
              <rect
                x={xDia(i)}
                y={112}
                width={52}
                height={BASE - 112 + 6}
                rx={12}
                fill={suyo ? C.soft : "#fff"}
                fillOpacity={suyo ? 1 : 0.7}
                stroke={suyo ? C.brand : C.line}
                strokeOpacity={suyo ? 0.5 : 1}
                className="m-aparece"
                style={d(i * 60)}
              />
              {alto > 0 && (
                <rect
                  x={xDia(i) + 12}
                  y={BASE - alto}
                  width={28}
                  height={alto}
                  rx={6}
                  fill={suyo ? C.brand : "#FFD3A8"}
                  className="m-crece-y"
                  style={d(450 + i * 90)}
                />
              )}
              <text
                x={xDia(i) + 26}
                y={BASE + 24}
                textAnchor="middle"
                fontSize={11.5}
                fontWeight={suyo ? 700 : 500}
                fill={suyo ? C.deep : C.ink2}
                className="m-aparece"
                style={d(i * 60)}
              >
                {dia}
              </text>
            </g>
          );
        })}

        {/* El mensaje cae en su día, y queda flotando. */}
        <g className="m-flota" style={d(2400)}>
          <g className="m-cae" style={d(1500)}>
            <rect x={centro - 96} y={64} width={192} height={32} rx={12} fill={C.ink} />
            <path d={`M ${centro - 7} 95 L ${centro} 103 L ${centro + 7} 95 Z`} fill={C.ink} />
            <circle cx={centro - 78} cy={80} r={8} fill="#1FAF55" />
            <path
              d={`M ${centro - 82} 80.5 l 2.6 2.6 l 5 -5.2`}
              stroke="#fff"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <text x={centro - 64} y={84.5} fontSize={11.5} fontWeight={600} fill="#fff">
              Jueves 20:30 · Mensaje 1
            </text>
          </g>
        </g>

        <g className="m-aparece" style={d(2300)}>
          <rect x={58} y={260} width={344} height={26} rx={13} fill={C.sand} />
          <text x={230} y={277} textAnchor="middle" fontSize={11} fill={C.ink2}>
            Los que dejaron de pedir van a los días más flojos
          </text>
        </g>
      </Lienzo>
    </Escena>
  );
}

// ── 4. Si vuelve, sale de la agenda ────────────────────────────────────────────────────────────
const FILAS = [
  { nombre: "Lucía Pérez", detalle: "Se está yendo · Mensaje 2", iniciales: "LP" },
  { nombre: CLIENTA.nombre, detalle: "Se está yendo · Mensaje 1", iniciales: CLIENTA.iniciales },
  { nombre: "Diego Ramos", detalle: "Hace tiempo no viene · Mensaje 3", iniciales: "DR" },
];
const CUIDADOS = [
  { x: 40, texto: "48 h entre mensajes" },
  { x: 168, texto: "Máx. 4 en 30 días" },
  { x: 296, texto: "Respeta la baja" },
];

/**
 * Un pedido nuevo saca al cliente de la agenda. Fases: 0 la agenda · 1 llega el pedido ·
 * 2 volvió a pedir · 3 sale y los demás suben · 4 queda afuera.
 */
export function SaleDeAgenda({ siempreActiva }: PropsEscena) {
  const n = useSecuencia(1300, 2);
  const fase = n % 5;
  const volvio = fase >= 2;
  const salio = fase >= 3;
  return (
    <Escena
      ancho={460}
      alto={300}
      etiqueta={`${CLIENTA.corto} volvió a pedir: sale de la agenda y no recibe más mensajes de recompra. Piru también cuida la base: 48 horas entre mensajes, como máximo 4 en 30 días y respeta las bajas.`}
      siempreActiva={siempreActiva}
    >
      <Lienzo>
        <g className="m-aparece">
          <text x={40} y={32} fontSize={14} fontWeight={600} fill={C.ink}>
            Si vuelve a pedir, sale de la agenda
          </text>
          <text x={40} y={50} fontSize={11.5} fill={C.ink3}>
            Y vuelve a contar su ritmo desde ese pedido
          </text>
        </g>

        <rect x={40} y={70} width={380} height={160} rx={18} fill="#fff" stroke={C.line} className="m-aparece" style={d(100)} />

        {FILAS.map((f, i) => {
          const esElla = i === 1;
          const y = 82 + i * 48 - (salio && i === 2 ? 48 : 0);
          const fuera = esElla && salio;
          return (
            <g
              key={f.nombre}
              className={fase === 0 ? undefined : "m-fila"}
              style={{ transform: `translate(${fuera ? 50 : 0}px, ${y}px)`, opacity: fuera ? 0 : 1 }}
            >
              <rect x={50} y={0} width={360} height={42} rx={12} fill={esElla && volvio ? "#ECFDF5" : "#fff"} />
              <circle cx={72} cy={21} r={13} fill={esElla && volvio ? "#D1FAE5" : C.sand} />
              <text x={72} y={25} textAnchor="middle" fontSize={10} fontWeight={700} fill={esElla && volvio ? "#047857" : C.ink2}>
                {f.iniciales}
              </text>
              <text x={94} y={18} fontSize={12.5} fontWeight={600} fill={C.ink}>
                {f.nombre}
              </text>
              <text x={94} y={33} fontSize={10.5} fill={C.ink3}>
                {esElla && volvio ? "Pidió hoy · vuelve a su ritmo" : f.detalle}
              </text>
              {esElla && volvio ? (
                <g key="volvio" className="m-pop">
                  <Pildora x={352} y={21} texto="Volvió a pedir" fondo="#D1FAE5" color="#047857" borde={false} />
                </g>
              ) : (
                <Pildora x={366} y={21} texto="Pendiente" />
              )}
            </g>
          );
        })}

        {/* El pedido nuevo que llega. */}
        {fase === 1 && (
          <g key={n} className="m-cae">
            <g transform="translate(398 96)">
              <rect x={-14} y={-10} width={28} height={26} rx={5} fill={C.brand} />
              <path d="M -6 -10 v -4 a 6 6 0 0 1 12 0 v 4" stroke={C.brand} strokeWidth={2.4} fill="none" />
              <circle r={14} cy={3} stroke={C.brand} strokeWidth={2} className="m-latido" />
            </g>
          </g>
        )}

        <g className="m-aparece" style={d(400)}>
          {CUIDADOS.map((c) => (
            <g key={c.texto}>
              <rect x={c.x} y={248} width={124} height={28} rx={14} fill={C.sand} />
              <text x={c.x + 62} y={266} textAnchor="middle" fontSize={11} fontWeight={600} fill={C.ink2}>
                {c.texto}
              </text>
            </g>
          ))}
        </g>
      </Lienzo>
    </Escena>
  );
}
