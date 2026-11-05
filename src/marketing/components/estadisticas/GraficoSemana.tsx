import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Chip } from "../ui";
import { abreviarPesos, type PuntoSemana } from "../../lib/estadisticas";
import { pesos } from "../../lib/formato";

const TENUE = "#80776e";
const NARANJA = "#FF7A00";
const SUAVE = "#F3C9A0";

/** Qué día de la semana vende más: barras de un solo color, con el mejor día destacado. */
export function GraficoSemana({ datos }: { datos: PuntoSemana[] }) {
  const [medida, setMedida] = useState<"pedidos" | "total">("pedidos");
  const maximo = Math.max(0, ...datos.map((d) => d[medida]));
  const mejor = maximo > 0 ? datos.find((d) => d[medida] === maximo) : undefined;
  const valor = (n: number) => (medida === "total" ? pesos(n) : `${n.toLocaleString("es-AR")} pedidos`);
  return (
    <figure className="m-0" aria-label="Promedio de ventas por día de la semana">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="muted">
          {mejor ? `${mejor.titulo} es tu mejor día: ${valor(mejor[medida])} en promedio.` : "Sin ventas en el período."}
        </p>
        <div role="group" aria-label="Medida" className="flex gap-2">
          <Chip className="min-h-9 px-3 text-xs" activo={medida === "pedidos"} onClick={() => setMedida("pedidos")}>Pedidos</Chip>
          <Chip className="min-h-9 px-3 text-xs" activo={medida === "total"} onClick={() => setMedida("total")}>Facturación</Chip>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={datos} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="4 4" stroke="#191512" strokeOpacity={0.08} vertical={false} />
          <XAxis dataKey="etiqueta" tick={{ fontSize: 11, fill: TENUE }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: TENUE }} axisLine={false} tickLine={false} width={52} allowDecimals={false}
            tickFormatter={(v: number) => (medida === "total" ? abreviarPesos(v, maximo) : String(v))}
          />
          <Tooltip
            cursor={{ fill: "#191512", fillOpacity: 0.05 }}
            content={({ active, payload }) => {
              const p = active ? (payload?.[0]?.payload as PuntoSemana | undefined) : undefined;
              if (!p) return null;
              return (
                <div className="space-y-1 rounded-xl bg-surface px-3.5 py-2.5 text-xs shadow-xl ring-1 ring-line">
                  <p className="font-semibold text-ink">{p.titulo}</p>
                  <p className="text-ink-3">Promedio: <span className="font-semibold text-ink tabular-nums">{valor(p[medida])}</span></p>
                  <p className="text-ink-3">{p.ocurrencias} {p.ocurrencias === 1 ? "día" : "días"} en el período</p>
                </div>
              );
            }}
          />
          <Bar dataKey={medida} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches}>
            {datos.map((d) => <Cell key={d.etiqueta} fill={d === mejor ? NARANJA : SUAVE} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}
