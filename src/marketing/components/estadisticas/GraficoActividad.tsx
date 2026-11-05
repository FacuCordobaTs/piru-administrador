import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { abreviarPesos, type PuntoActividad } from "../../lib/estadisticas";
import { pesos } from "../../lib/formato";
const TINTA = "#191512";
const TENUE = "#80776e";
const NARANJA = "#FF7A00";
interface PropsDetalle {
  active?: boolean;
  payload?: readonly { payload?: PuntoActividad }[];
}
/** Lo que se ve al pasar por un punto: el día o la franja, los pedidos y lo facturado. */
function Detalle({ active, payload }: PropsDetalle) {
  const punto = payload?.[0]?.payload;
  if (!active || !punto) return null;
  return (
    <div className="space-y-1.5 rounded-xl bg-surface px-3.5 py-2.5 text-xs shadow-xl ring-1 ring-line">
      <p className="font-semibold text-ink">{punto.titulo}</p>
      <p className="flex items-center gap-2 text-ink-3">
        <span className="size-2 shrink-0 rounded-full bg-ink" />
        Pedidos:
        <span className="font-semibold text-ink tabular-nums">
          {punto.pedidos}
        </span>
      </p>
      <p className="flex items-center gap-2 text-ink-3">
        <span className="size-2 shrink-0 rounded-full bg-brand" />
        Facturado:
        <span className="font-semibold text-ink tabular-nums">
          {pesos(punto.total)}
        </span>
      </p>
    </div>
  );
}
/** Quienes pidieron menos movimiento ven el gráfico completo y quieto. */
const sinMovimiento = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
/**
 * Pedidos y facturación a lo largo de un eje (días o horas): el mismo gráfico de dos líneas que la
 * actividad por hora del cierre de caja del panel, con los pedidos a la izquierda y los pesos,
 * en naranja, a la derecha.
 */
export function GraficoActividad({
  datos,
  descripcion,
}: {
  datos: PuntoActividad[];
  /** Qué muestra, para quien no lo ve: queda como etiqueta de la figura. */
  descripcion: string;
}) {
  const techo = useMemo(
    () => Math.max(0, ...datos.map((d) => d.total)),
    [datos],
  );
  const animar = !sinMovimiento();
  return (
    <figure aria-label={descripcion} className="m-0">
      <ResponsiveContainer width="100%" height={200}>
        <LineChart
          data={datos}
          margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="4 4"
            stroke={TINTA}
            strokeOpacity={0.08}
            vertical={false}
          />
          <XAxis
            dataKey="etiqueta"
            tick={{ fontSize: 11, fill: TENUE }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            yAxisId="pedidos"
            orientation="left"
            tick={{ fontSize: 11, fill: TENUE }}
            axisLine={false}
            tickLine={false}
            width={30}
            allowDecimals={false}
          />
          <YAxis
            yAxisId="total"
            orientation="right"
            tick={{ fontSize: 11, fill: NARANJA }}
            axisLine={false}
            tickLine={false}
            width={52}
            tickFormatter={(v: number) => abreviarPesos(v, techo)}
          />
          <Tooltip
            content={<Detalle />}
            cursor={{ stroke: TINTA, strokeOpacity: 0.12, strokeWidth: 1 }}
          />
          <Line
            yAxisId="pedidos"
            type="monotone"
            dataKey="pedidos"
            stroke={TINTA}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
            isAnimationActive={animar}
            animationDuration={1000}
            animationEasing="ease-out"
          />
          <Line
            yAxisId="total"
            type="monotone"
            dataKey="total"
            stroke={NARANJA}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: NARANJA, strokeWidth: 0 }}
            isAnimationActive={animar}
            animationDuration={1300}
            animationEasing="ease-out"
          />
        </LineChart>
      </ResponsiveContainer>
    </figure>
  );
}
/** La referencia de colores de un gráfico de actividad. */
export function LeyendaActividad() {
  return (
    <div className="flex items-center gap-4 text-xs text-ink-3">
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-5 rounded-full bg-ink" />
        Pedidos
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-5 rounded-full bg-brand" />
        Facturado
      </span>
    </div>
  );
}
