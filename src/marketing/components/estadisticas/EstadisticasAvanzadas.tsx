import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useLocal } from "../Layout";
import { Card, Chip, Empty, Estado, Stat, cn } from "../ui";
import { SkeletonPantalla } from "../SkeletonPantalla";
import { GraficoActividad, LeyendaActividad } from "./GraficoActividad";
import { GraficoSemana } from "./GraficoSemana";
import { datosLocal, query } from "../../lib/api";
import { useDatos } from "../../lib/useDatos";
import {
  completarDias,
  completarHoras,
  promedioPorDiaSemana,
  rankingPorCategoria,
  repartirMediosPago,
} from "../../lib/estadisticas";
import { hoyArgentina, pesos, rango } from "../../lib/formato";
import type { Metricas } from "../../lib/tipos";
const PERIODOS = [7, 30, 90];
const PRODUCTOS_VISIBLES = 10;
/** Una barra que muestra qué parte del total es esto. */
function Proporcion({
  porcentaje,
  clase = "bg-ink-2",
}: {
  porcentaje: number;
  clase?: string;
}) {
  return (
    <span
      className="block h-1.5 overflow-hidden rounded-full bg-sand"
      aria-hidden="true"
    >
      <span
        className={cn("block h-full rounded-full transition-[width] duration-500", clase)}
        style={{ width: `${Math.max(2, Math.min(100, porcentaje))}%` }}
      />
    </span>
  );
}
function FilaRanking({
  posicion,
  nombre,
  cantidad,
  total,
  porcentaje,
  fuerte = false,
}: {
  posicion?: number;
  nombre: string;
  cantidad: number;
  total: number;
  porcentaje: number;
  fuerte?: boolean;
}) {
  return (
    <span className="flex items-start gap-3">
      {posicion !== undefined && (
        <span className="w-5 shrink-0 pt-0.5 text-right text-xs tabular-nums text-ink-3">
          {posicion}
        </span>
      )}
      <span className="block min-w-0 flex-1">
        <span className="mb-2 flex items-baseline justify-between gap-3">
          <span
            className={cn(
              "truncate text-sm text-ink",
              fuerte ? "font-semibold" : "font-medium",
            )}
            title={nombre}
          >
            {nombre}
          </span>
          <span className="flex shrink-0 items-baseline gap-3 text-sm">
            <span className="text-xs text-ink-3 tabular-nums">
              {cantidad} u.
            </span>
            <span className="font-semibold tabular-nums">{pesos(total)}</span>
            <span className="w-11 text-right text-xs tabular-nums text-ink-3">
              {porcentaje.toFixed(1)}%
            </span>
          </span>
        </span>
        <Proporcion porcentaje={porcentaje} />
      </span>
    </span>
  );
}
/**
 * Las estadísticas de ventas del local entre las fechas que se elijan: lo que antes era la pantalla
 * Estadísticas, ahora dentro del Resumen, con gráficos de actividad por día y por hora.
 */
export default function EstadisticasAvanzadas() {
  const l = useLocal();
  const [desde, setDesde] = useState(rango(30).from);
  const [hasta, setHasta] = useState(hoyArgentina());
  const [modo, setModo] = useState<"productos" | "categorias">("productos");
  const [todos, setTodos] = useState(false);
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const d = useDatos(
    () =>
      datosLocal<Metricas>(`/metricas${query({ from: desde, to: hasta })}`,
      ),
    [l.restauranteId, desde, hasta],
    { conservar: true },
  );
  const m = d.data;
  const dias = useMemo(
    () => (m ? completarDias(m.porDia ?? [], desde, hasta) : []),
    [m, desde, hasta],
  );
  const semana = useMemo(
    () => (m ? promedioPorDiaSemana(m.porDia ?? [], desde, hasta) : []),
    [m, desde, hasta],
  );
  const horas = useMemo(() => (m ? completarHoras(m.porHora ?? []) : []), [m]);
  const medios = useMemo(
    () => (m ? repartirMediosPago(m.desgloseMetodoPago) : []),
    [m],
  );
  const categorias = useMemo(() => (m ? rankingPorCategoria(m) : []), [m]);
  const productos = m?.productosVendidos ?? m?.topProductos ?? [];
  const facturado = m?.ingresos.mensual ?? 0;
  const parte = (monto: number) => (facturado > 0 ? (monto / facturado) * 100 : 0);
  const web = m?.ingresos.mensualWeb ?? 0;
  const manual = m?.ingresos.mensualManual ?? 0;
  const sinVentas = !!m && m.pedidos.mensuales === 0 && facturado === 0;
  const alternar = (nombre: string) =>
    setAbiertas((previas) => {
      const siguientes = new Set(previas);
      if (siguientes.has(nombre)) siguientes.delete(nombre);
      else siguientes.add(nombre);
      return siguientes;
    });
  const visibles = todos ? productos : productos.slice(0, PRODUCTOS_VISIBLES);
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end">
        <div
          role="group"
          aria-label="Período"
          className="flex flex-wrap gap-2"
        >
          {PERIODOS.map((n) => {
            const r = rango(n);
            return (
              <Chip
                key={n}
                className="min-h-10"
                activo={desde === r.from && hasta === r.to}
                onClick={() => {
                  setDesde(r.from);
                  setHasta(r.to);
                }}
              >
                Últimos {n} días
              </Chip>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:max-w-md sm:justify-self-end">
          <label>
            Desde
            <input
              type="date"
              value={desde}
              max={hasta}
              onChange={(e) => e.target.value && setDesde(e.target.value)}
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              value={hasta}
              min={desde}
              onChange={(e) => e.target.value && setHasta(e.target.value)}
            />
          </label>
        </div>
      </div>
      <Estado
        skeleton={<SkeletonPantalla tipo="estadisticas" />}
        loading={d.loading && !m}
        error={d.error}
        reintentar={d.recargar}
      />
      {m && sinVentas && (
        <Empty
          title="Sin ventas cobradas en estas fechas"
          text="Elegí otro período para ver cómo se movió el local."
        />
      )}
      {m && !sinVentas && (
        <div
          className={cn("grid gap-4 transition-opacity", d.loading && "opacity-60")}
          aria-busy={d.loading}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Facturación" value={pesos(facturado)} />
            <Stat
              label="Pedidos"
              value={m.pedidos.mensuales}
              detail={`${m.pedidos.mensualesPagados} cobrados`}
            />
            <Stat
              label="Ticket cobrado"
              value={pesos(facturado / Math.max(m.pedidos.mensualesPagados, 1))}
            />
          </div>
          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2>Ventas por día</h2>
              <LeyendaActividad />
            </div>
            {dias.length > 1 ? (
              <GraficoActividad
                datos={dias}
                descripcion="Pedidos cobrados y facturación de cada día del período"
              />
            ) : (
              <p className="muted">Elegí un período de más de un día.</p>
            )}
          </Card>
          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2>Actividad por hora</h2>
              <LeyendaActividad />
            </div>
            {horas.length > 0 ? (
              <GraficoActividad
                datos={horas}
                descripcion="Pedidos cobrados y facturación en cada hora del día, sumando todo el período"
              />
            ) : (
              <p className="muted">Todavía no hay pedidos cobrados con hora.</p>
            )}
          </Card>
          <Card>
            <h2 className="mb-4">Qué días se vende más</h2>
            <GraficoSemana datos={semana} />
          </Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <h2>De dónde vienen</h2>
              <div
                className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-sand"
                role="img"
                aria-label={`Tienda ${Math.round(parte(web))}%, anotados a mano ${Math.round(parte(manual))}%`}
              >
                <div className="bg-brand" style={{ width: `${parte(web)}%` }} />
                <div className="bg-ink" style={{ width: `${parte(manual)}%` }} />
              </div>
              <dl className="mt-5 grid gap-4 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <dt className="flex items-center gap-2 text-ink-2">
                    <span className="size-2.5 rounded-full bg-brand" />
                    <span>
                      Tienda
                      <span className="muted block">
                        {m.pedidos.mensualesWeb}{" "}
                        {m.pedidos.mensualesWeb === 1 ? "pedido" : "pedidos"}
                      </span>
                    </span>
                  </dt>
                  <dd className="font-semibold tabular-nums">{pesos(web)}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="flex items-center gap-2 text-ink-2">
                    <span className="size-2.5 rounded-full bg-ink" />
                    <span>
                      Anotados a mano
                      <span className="muted block">
                        {m.pedidos.mensualesManual}{" "}
                        {m.pedidos.mensualesManual === 1 ? "pedido" : "pedidos"}
                      </span>
                    </span>
                  </dt>
                  <dd className="font-semibold tabular-nums">{pesos(manual)}</dd>
                </div>
              </dl>
            </Card>
            <Card>
              <h2>Medios de pago</h2>
              {medios.length ? (
                <ul className="mt-5 grid gap-4">
                  {medios.map((medio) => (
                    <li key={medio.nombre}>
                      <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
                        <span className="text-ink-2">{medio.nombre}</span>
                        <span className="flex items-baseline gap-3">
                          <strong className="tabular-nums">
                            {pesos(medio.total)}
                          </strong>
                          <span className="w-11 text-right text-xs tabular-nums text-ink-3">
                            {medio.porcentaje.toFixed(1)}%
                          </span>
                        </span>
                      </div>
                      <Proporcion porcentaje={medio.porcentaje} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted mt-4">Sin cobros en el período.</p>
              )}
            </Card>
          </div>
          <Card>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2>Los más vendidos</h2>
              <div role="group" aria-label="Ordenar por" className="flex gap-2">
                <Chip
                  className="min-h-9 px-3 text-xs"
                  activo={modo === "productos"}
                  onClick={() => setModo("productos")}
                >
                  Productos
                </Chip>
                <Chip
                  className="min-h-9 px-3 text-xs"
                  activo={modo === "categorias"}
                  onClick={() => setModo("categorias")}
                >
                  Categorías
                </Chip>
              </div>
            </div>
            {modo === "productos" ? (
              productos.length ? (
                <>
                  <ol className="grid gap-5">
                    {visibles.map((p, i) => (
                      <li key={`${p.productoId}-${p.nombre}`}>
                        <FilaRanking
                          posicion={i + 1}
                          nombre={p.nombre}
                          cantidad={p.cantidad}
                          total={p.totalVendido}
                          porcentaje={parte(p.totalVendido)}
                        />
                      </li>
                    ))}
                  </ol>
                  {productos.length > PRODUCTOS_VISIBLES && (
                    <button
                      type="button"
                      className="mt-5 text-sm font-semibold text-brand-deep"
                      onClick={() => setTodos(!todos)}
                    >
                      {todos
                        ? "Ver menos"
                        : `Ver los ${productos.length} productos`}
                    </button>
                  )}
                </>
              ) : (
                <p className="muted">Sin productos vendidos en el período.</p>
              )
            ) : categorias.length ? (
              <ul className="grid gap-1">
                {categorias.map((c) => {
                  const abierta = abiertas.has(c.nombre);
                  return (
                    <li key={c.nombre} className="border-b border-line last:border-0">
                      <button
                        type="button"
                        aria-expanded={abierta}
                        onClick={() => alternar(c.nombre)}
                        className="flex w-full items-start gap-3 py-4 text-left"
                      >
                        <ChevronDown
                          size={16}
                          aria-hidden="true"
                          className={cn(
                            "mt-0.5 shrink-0 text-ink-3 transition-transform",
                            !abierta && "-rotate-90",
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <FilaRanking
                            nombre={c.nombre}
                            cantidad={c.cantidad}
                            total={c.totalVendido}
                            porcentaje={parte(c.totalVendido)}
                            fuerte
                          />
                        </span>
                      </button>
                      {abierta && (
                        <ol className="mb-4 ml-7 grid gap-4 border-l border-line pl-4">
                          {c.productos.length ? (
                            c.productos.map((p) => (
                              <li key={p.nombre}>
                                <FilaRanking
                                  nombre={p.nombre}
                                  cantidad={p.cantidad}
                                  total={p.totalVendido}
                                  porcentaje={parte(p.totalVendido)}
                                />
                              </li>
                            ))
                          ) : (
                            <li className="muted">
                              Sus productos no están entre los más vendidos.
                            </li>
                          )}
                        </ol>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="muted">Sin ventas por categoría en el período.</p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
