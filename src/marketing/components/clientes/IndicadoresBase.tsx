import { cn } from "../ui";
import type { ResumenClientes, ResumenPuntosData } from "../../lib/tipos";
/**
 * Los números de la base de un vistazo: cuántos clientes hay y, si el local tiene Retención, cómo
 * va su club de puntos. Es la misma franja que el Resumen: lo grande a la izquierda y los demás
 * indicadores al lado.
 */
export function IndicadoresBase({
  resumen,
  nuevos30d,
  club,
}: {
  resumen: ResumenClientes;
  nuevos30d: number;
  /** Los números del club; null si el local no tiene Retención. */
  club: ResumenPuntosData | null;
}) {
  const habituales = resumen.porSegmento.activo + resumen.porSegmento.vip;
  const paraRecuperar =
    resumen.porSegmento.en_riesgo +
    resumen.porSegmento.dormido +
    resumen.porSegmento.perdido;
  return (
    <section
      aria-label="Tu base de clientes"
      className={cn(
        "resumen-indicadores mb-6 rounded-[20px] border border-line bg-surface",
        club && "resumen-indicadores--cuatro",
      )}
    >
      <div className="resumen-ventas">
        <p className="label">Clientes</p>
        <p className="mt-3 text-4xl font-bold tracking-tight tabular-nums sm:text-5xl">
          {resumen.total}
        </p>
        <p className="muted mt-3">
          {nuevos30d} {nuevos30d === 1 ? "nuevo" : "nuevos"} en los últimos 30
          días
        </p>
      </div>
      {club ? (
        <>
          <div className="resumen-indicador">
            <p className="label">Con puntos</p>
            <p className="stat mt-2">{club.clientesConPuntos}</p>
            <p className="muted mt-2">de {resumen.total} clientes</p>
          </div>
          <div className="resumen-indicador">
            <p className="label">En circulación</p>
            <p className="stat mt-2">
              {club.puntosEnCirculacion.toLocaleString("es-AR")}
            </p>
            <p className="muted mt-2">Puntos para canjear</p>
          </div>
          <div className="resumen-indicador">
            <p className="label">Canjes · 30 días</p>
            <p className="stat mt-2">{club.canjes30Dias}</p>
            <p className="muted mt-2">
              {club.puntosOtorgados30Dias.toLocaleString("es-AR")} puntos
              otorgados
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="resumen-indicador">
            <p className="label">Habituales y VIP</p>
            <p className="stat mt-2">{habituales}</p>
            <p className="muted mt-2">Los que siguen pidiendo a su ritmo</p>
          </div>
          <div className="resumen-indicador">
            <p className="label">Para recuperar</p>
            <p className="stat mt-2">{paraRecuperar}</p>
            <p className="muted mt-2">Se están yendo o dejaron de pedir</p>
          </div>
        </>
      )}
    </section>
  );
}
