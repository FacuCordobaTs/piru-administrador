import { datosLocal } from "../lib/api";
import { useDatos } from "../lib/useDatos";
import { fechaHora } from "../lib/formato";
import type { TransaccionPuntosData } from "../lib/tipos";
import { Card, Estado } from "./ui";
const TIPOS: Record<string, string> = {
  suma_compra: "Compra",
  canje_producto: "Canje de producto",
  canje_envio: "Canje de envío",
  canje_descuento: "Canje de descuento",
  bonus_bienvenida: "Bienvenida",
  bonus_promocion: "Puntos extra de campaña",
  ajuste_manual: "Ajuste a mano",
  devolucion_cancelacion: "Devolución por cancelación",
  expiracion: "Vencimiento",
};
/** Los movimientos de puntos de un cliente, del más nuevo al más viejo. */
export function HistorialPuntos({
  clienteId,
}: {
  clienteId: number;
}) {
  const d = useDatos(
    () =>
      datosLocal<{
        cliente: { id: number; nombre: string; puntos: number };
        transacciones: TransaccionPuntosData[];
      }>(`/puntos/cliente/${clienteId}/historial`),
    [clienteId],
  );
  return (
    <>
      <Estado loading={d.loading} error={d.error} reintentar={d.recargar} />
      {d.data && (
        <div className="grid gap-4">
          <Card>
            <p className="label">Saldo</p>
            <p className="stat mt-3">{d.data.cliente.puntos} puntos</p>
          </Card>
          {!d.data.transacciones.length ? (
            <p className="muted">Todavía no tiene movimientos de puntos.</p>
          ) : (
            <Card>
              {d.data.transacciones.map((t) => (
                <div
                  key={t.id}
                  className="flex justify-between gap-3 border-b border-line py-3 text-sm last:border-0"
                >
                  <div>
                    <p className="font-semibold">{TIPOS[t.tipo] ?? t.tipo}</p>
                    <p className="muted mt-1">
                      {t.motivo ? `${t.motivo} · ` : ""}
                      {fechaHora(t.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-semibold tabular-nums ${t.puntos > 0 ? "text-green-700" : "text-rose-700"}`}
                    >
                      {t.puntos > 0 ? "+" : ""}
                      {t.puntos}
                    </p>
                    <p className="muted mt-1 tabular-nums">
                      Saldo {t.saldoResultante}
                    </p>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}
    </>
  );
}
