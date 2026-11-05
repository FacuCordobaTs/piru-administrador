import { Link } from "react-router";
import { useLocal, LocalChips } from "../components/Layout";
import { Card, Header, Estado } from "../components/ui";
import { useDatos } from "../lib/useDatos";
import { datosLocal, query } from "../lib/api";
import type {
  ClienteGrowth,
  EstadoMotorRecompra,
  ResumenCrecimiento,
  Metricas,
} from "../lib/tipos";
import { pesos, variacion, rango, rangoConHora, segmentoNombre } from "../lib/formato";
import { MARKETING } from "../lib/rutas";
export function Resumen() {
  const l = useLocal();
  const { data, error, loading, recargar } = useDatos(async () => {
    const [metricas, clientes] = await Promise.all([
      datosLocal<Metricas>(`/metricas${query(rango(30))}`),
      datosLocal<ClienteGrowth[]>("/clientes/list?soloDespachados=true",
      ),
    ]);
    const marketing = l.crecimientoActivo
      ? await datosLocal<ResumenCrecimiento>(`/marketing/resumen${query(rangoConHora(30))}`,
        ).catch((e: unknown) => ({
          error: e instanceof Error ? e.message : "No pudimos cargar campañas.",
        }))
      : null;
    const recompra = l.retencionActiva
      ? await datosLocal<EstadoMotorRecompra>("/clientes/recompra/estado",
        ).catch((e: unknown) => ({
          error: e instanceof Error ? e.message : "No pudimos cargar recompra.",
        }))
      : null;
    return { metricas, clientes, marketing, recompra };
  }, [l.restauranteId]);
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
        title={l.nombre}
        pantalla="resumen"
        sub="Lo que está pasando y lo que podés hacer hoy."
        ayuda={{ seccion: "numeros", texto: "Qué cuenta como venta cobrada" }}
      >
        {!l.baseTienda && (
          <p className="muted">
            Configurá tu tienda desde el panel de Piru.
          </p>
        )}
      </Header>
      <LocalChips local={l} />
      <section className="resumen-indicadores mt-5 mb-6 rounded-[20px] border border-line bg-surface" aria-label="Indicadores de los últimos 30 días">
        <div className="resumen-ventas">
          <p className="label">Ventas cobradas · últimos 30 días</p>
          <p className="mt-3 text-4xl sm:text-5xl font-bold tracking-tight tabular-nums break-words">{pesos(l.ventas30d)}</p>
          <p className="muted mt-3">{variacion(l.ventas30d, l.ventas30dAnterior)} contra los 30 días anteriores</p>
        </div>
        <div className="resumen-indicador">
          <p className="label">Clientes nuevos</p>
          <p className="stat mt-2">{l.clientesNuevos30d}</p>
          <p className="muted mt-2">En los últimos 30 días</p>
        </div>
        <Link to={`${MARKETING}/hoy`} className="resumen-indicador hover:bg-sand transition-colors">
          <p className="label">Mensajes para hoy</p>
          <p className="stat mt-2">{l.mensajesParaHoy}</p>
          <p className="mt-2 text-sm font-semibold text-brand-deep">Ir a Hoy →</p>
        </Link>
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
                <div>
                  <h2>Clientes para recuperar</h2>
                </div>
                <Link to={`${MARKETING}/hoy`} className="resumen-enlace">Ver la semana →</Link>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-4">
                {["nuevo", "en_riesgo", "dormido", "perdido"].map((s) => (
                  <div key={s} className="pt-3">
                    <strong className="block text-3xl font-semibold tabular-nums">{data.clientes.filter((c) => c.segmento === s).length}</strong>
                    <p className="mt-2 text-sm text-ink-2 leading-snug">{segmentoNombre[s]}</p>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="flex flex-col justify-between gap-5">
              <div>
                <p className="label">Dónde falta movimiento</p>
                <h2 className="mt-3 text-2xl">{l.diaMasFlojo?.nombre || "Todavía sin datos"}</h2>
                <p className="muted mt-2">{l.diaMasFlojo ? "El día con menos movimiento de tu local." : "Con más pedidos vamos a encontrar oportunidades."}</p>
              </div>
              <Link className="resumen-enlace self-start" to={`${MARKETING}/dias-flojos`}>Ver días flojos →</Link>
            </Card>
          </div>
          <section className="mt-6" aria-labelledby="resumen-resultados">
            <h2 id="resumen-resultados" className="mb-3">Resultados del marketing</h2>
            <div className="grid overflow-hidden rounded-[20px] border border-line bg-surface sm:grid-cols-2">
              <div className="flex flex-col p-5 sm:p-6 border-b border-line sm:border-b-0 sm:border-r">
                <div className="flex items-center justify-between gap-3">
                  <p className="label">Campaña que más vendió</p>
                  <Link className="resumen-enlace" to={`${MARKETING}/campanas`}>Ver campañas →</Link>
                </div>
                <p className="mt-4 text-3xl font-bold tracking-tight tabular-nums">{top ? pesos(top.metricas.ventas) : "—"}</p>
                <p className="mt-2 text-sm text-ink-2">{top?.nombre || "Todavía sin ventas atribuidas a campañas."}</p>
              </div>
              <div className="flex flex-col p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="label">Recompra por WhatsApp</p>
                  <Link className="resumen-enlace" to={`${MARKETING}/hoy`}>Ver Hoy →</Link>
                </div>
                {recompra?.campana ? <>
                  <p className="mt-4 text-3xl font-bold tracking-tight tabular-nums">{recompra.campana.volvieron} <span className="text-base font-medium text-ink-2">volvieron</span></p>
                  <p className="muted mt-2">{recompra.campana.totalEnviados} mensajes enviados</p>
                </> : <p className="muted mt-4">{l.retencionActiva ? "La agenda detecta los clientes que necesitan volver." : "Retención habilita mensajes y club de puntos."}</p>}
              </div>
            </div>
          </section>

        </>
      )}
    </>
  );
}
