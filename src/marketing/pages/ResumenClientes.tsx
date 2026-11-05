import { Link } from "react-router";
import { LocalChips, MarketingShell, useLocal } from "../components/Layout";
import { Card, Header, Estado } from "../components/ui";
import { useDatos } from "../lib/useDatos";
import { datosLocal, query } from "../lib/api";
import type {
  ClienteGrowth,
  EstadoMotorRecompra,
  ResumenCrecimiento,
} from "../lib/tipos";
import { pesos, rangoConHora, segmentoNombre } from "../lib/formato";
import { MARKETING } from "../lib/rutas";

/**
 * El resumen de clientes que antes abría Marketing. Vive dentro de la tab
 * Estadísticas del panel para no duplicar las ventas que ya muestra esa
 * pantalla: acá sólo quedan la base, la recompra, los días flojos y campañas.
 */
function Contenido() {
  const l = useLocal();
  const { data, error, loading, recargar } = useDatos(async () => {
    const clientes = await datosLocal<ClienteGrowth[]>(
      "/clientes/list?soloDespachados=true",
    );
    const marketing = l.crecimientoActivo
      ? await datosLocal<ResumenCrecimiento>(
          `/marketing/resumen${query(rangoConHora(30))}`,
        ).catch((e: unknown) => ({
          error: e instanceof Error ? e.message : "No pudimos cargar campañas.",
        }))
      : null;
    const recompra = l.recompraActiva
      ? await datosLocal<EstadoMotorRecompra>("/clientes/recompra/estado").catch(
          (e: unknown) => ({
            error: e instanceof Error ? e.message : "No pudimos cargar recompra.",
          }),
        )
      : null;
    return { clientes, marketing, recompra };
  }, [l.restauranteId, l.crecimientoActivo, l.recompraActiva]);
  const marketing =
    data?.marketing && "campanas" in data.marketing ? data.marketing : null;
  const recompra =
    data?.recompra && "campana" in data.recompra ? data.recompra : null;
  const top = marketing?.campanas
    .slice()
    .sort((a, b) => b.metricas.ventas - a.metricas.ventas)[0];
  return (
    <>
      <Header
        title="Clientes"
        pantalla="resumen"
        sub="La base del local, la recompra y las campañas."
        ayuda={{ seccion: "numeros", texto: "Qué cuenta como venta cobrada" }}
      >
        <Link
          to={`${MARKETING}/clientes`}
          className="btn btn-secondary min-h-10 px-3 text-sm"
        >
          Ver todos los clientes
        </Link>
      </Header>
      <LocalChips local={l} />
      <section
        className="mt-5 mb-6 grid gap-4 sm:grid-cols-3"
        aria-label="Indicadores de clientes de los últimos 30 días"
      >
        <Card>
          <p className="label">Clientes nuevos</p>
          <p className="stat mt-2">{l.clientesNuevos30d}</p>
          <p className="muted mt-2">En los últimos 30 días</p>
        </Card>
        <Card>
          <p className="label">Mensajes para hoy</p>
          <p className="stat mt-2">{l.mensajesParaHoy}</p>
          {l.recompraActiva ? (
            <Link
              to={`${MARKETING}/hoy`}
              className="mt-2 inline-block text-sm font-semibold text-brand-deep"
            >
              Ir a Hoy →
            </Link>
          ) : (
            <p className="muted mt-2">Activá Recompra para prepararlos.</p>
          )}
        </Card>
        <Card>
          <p className="label">En la base</p>
          <p className="stat mt-2">{data?.clientes.length ?? "—"}</p>
          <p className="muted mt-2">Clientes con al menos un pedido</p>
        </Card>
      </section>
      <Estado loading={loading} error={error} reintentar={recargar} />
      {data && (
        <>
          {data.marketing && "error" in data.marketing && (
            <Card className="mb-4">
              <p role="alert">
                No pudimos cargar campañas: {data.marketing.error}
              </p>
              <button className="btn mt-3" onClick={recargar}>
                Volver a intentar
              </button>
            </Card>
          )}
          {data.recompra && "error" in data.recompra && (
            <Card className="mb-4">
              <p role="alert">
                No pudimos cargar recompra: {data.recompra.error}
              </p>
              <button className="btn mt-3" onClick={recargar}>
                Volver a intentar
              </button>
            </Card>
          )}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <Card className="flex flex-col">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2>Clientes para recuperar</h2>
                <Link to={`${MARKETING}/clientes`} className="resumen-enlace">
                  Ver la base →
                </Link>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-4">
                {["nuevo", "en_riesgo", "dormido", "perdido"].map((s) => (
                  <div key={s} className="pt-3">
                    <strong className="block text-3xl font-semibold tabular-nums">
                      {data.clientes.filter((c) => c.segmento === s).length}
                    </strong>
                    <p className="mt-2 text-sm text-ink-2 leading-snug">
                      {segmentoNombre[s]}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="flex flex-col justify-between gap-5">
              <div>
                <p className="label">Dónde falta movimiento</p>
                <h2 className="mt-3 text-2xl">
                  {l.diaMasFlojo?.nombre || "Todavía sin datos"}
                </h2>
                <p className="muted mt-2">
                  {l.diaMasFlojo
                    ? "El día con menos movimiento de tu local."
                    : "Con más pedidos vamos a encontrar oportunidades."}
                </p>
              </div>
              {l.diasFlojosActivo && (
                <Link
                  className="resumen-enlace self-start"
                  to={`${MARKETING}/dias-flojos`}
                >
                  Ver días flojos →
                </Link>
              )}
            </Card>
          </div>
          <section className="mt-6" aria-labelledby="resumen-resultados">
            <h2 id="resumen-resultados" className="mb-3">
              Resultados del marketing
            </h2>
            <div className="grid overflow-hidden rounded-[20px] border border-line bg-surface sm:grid-cols-2">
              <div className="flex flex-col p-5 sm:p-6 border-b border-line sm:border-b-0 sm:border-r">
                <div className="flex items-center justify-between gap-3">
                  <p className="label">Campaña que más vendió</p>
                  {l.crecimientoActivo && (
                    <Link
                      className="resumen-enlace"
                      to={`${MARKETING}/campanas`}
                    >
                      Ver campañas →
                    </Link>
                  )}
                </div>
                <p className="mt-4 text-3xl font-bold tracking-tight tabular-nums">
                  {top ? pesos(top.metricas.ventas) : "—"}
                </p>
                <p className="mt-2 text-sm text-ink-2">
                  {top?.nombre || "Todavía sin ventas atribuidas a campañas."}
                </p>
              </div>
              <div className="flex flex-col p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="label">Recompra por WhatsApp</p>
                  {l.recompraActiva && (
                    <Link className="resumen-enlace" to={`${MARKETING}/hoy`}>
                      Ver Hoy →
                    </Link>
                  )}
                </div>
                {recompra?.campana ? (
                  <>
                    <p className="mt-4 text-3xl font-bold tracking-tight tabular-nums">
                      {recompra.campana.volvieron}{" "}
                      <span className="text-base font-medium text-ink-2">
                        volvieron
                      </span>
                    </p>
                    <p className="muted mt-2">
                      {recompra.campana.totalEnviados} mensajes enviados
                    </p>
                  </>
                ) : (
                  <p className="muted mt-4">
                    {l.recompraActiva
                      ? "La agenda detecta los clientes que necesitan volver."
                      : "Recompra habilita la agenda de mensajes."}
                  </p>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </>
  );
}

export function ResumenClientes() {
  return (
    <MarketingShell>
      <Contenido />
    </MarketingShell>
  );
}
