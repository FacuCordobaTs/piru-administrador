import { useState } from "react";
import { toast } from "sonner";
import { useLocal, useRecargarLocal } from "./Layout";
import { datosLocal, apiLocal } from "../lib/api";
import { useDatos } from "../lib/useDatos";
import type { CategoriaModulo } from "../lib/tipos";
import { Card, Button, Estado, accion } from "./ui";
export function useModulo(codigo: string) {
  const l = useLocal();
  const info = useDatos(
    () =>
      datosLocal<CategoriaModulo[]>("/modulos/mis-modulos"),
    [l.restauranteId],
  );
  return {
    ...info,
    modulo: info.data
      ?.flatMap((c) => c.modulos)
      .find((m) => m.codigo === codigo),
  };
}
/** El módulo pago se paga con Mercado Pago o con el link de pago al WhatsApp del dueño. */
function PagoModulo({
  codigo,
  pendiente,
  onActualizar,
}: {
  codigo: string;
  pendiente: boolean;
  onActualizar: () => void;
}) {
  const [busy, setBusy] = useState(false);
  async function pagar() {
    setBusy(true);
    try {
      const pago = await datosLocal<{ url_pago: string }>(`/modulos/${codigo}/checkout`,
        { method: "POST", body: {} },
      );
      window.location.assign(pago.url_pago);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No pudimos abrir Mercado Pago.",
      );
      setBusy(false);
    }
  }
  return (
    <>
      {pendiente && (
        <p className="mb-5 rounded-xl bg-brand-soft p-3 text-sm text-brand-deep">
          Tenés un pago pendiente. Si ya pagaste, puede tardar unos minutos en
          acreditarse.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button disabled={busy} onClick={pagar}>
          {busy
            ? "Abriendo Mercado Pago…"
            : pendiente
              ? "Volver al pago"
              : "Pagar con Mercado Pago"}
        </Button>
        {pendiente ? (
          <Button variant="secondary" onClick={onActualizar}>
            Ya pagué, actualizar
          </Button>
        ) : (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              accion(async () => {
                await apiLocal(`/modulos/${codigo}/pago-link-whatsapp`,
                  { method: "POST", body: {} },
                );
                onActualizar();
              }, "Te mandamos el link de pago a tu WhatsApp")
            }
          >
            Mandame el link por WhatsApp
          </Button>
        )}
      </div>
    </>
  );
}
export function BloqueoModulo({
  codigo,
  nombre,
  onActivo,
}: {
  codigo: string;
  nombre: string;
  onActivo?: () => void;
}) {
  const local = useLocal();
  const recargar = useRecargarLocal();
  const { modulo, loading, error, recargar: reload } = useModulo(codigo);
  if (loading || error)
    return <Estado loading={loading} error={error} reintentar={reload} />;
  if (!modulo)
    return (
      <Card>
        <h2>Herramienta no disponible</h2>
        <p className="muted mt-3">
          No encontramos este módulo en el catálogo. Volvé a intentar o contactá
          a Piru.
        </p>
        <Button onClick={reload}>Volver a cargar</Button>
      </Card>
    );
  return (
    <Card>
      <h2>
        {nombre} para {local.nombre}
      </h2>
      <p className="muted mt-3 mb-5">
        {codigo === "motor_recompra"
          ? "Recuperá clientes desde el WhatsApp de tu local con la agenda de recompra."
          : codigo === "dias_flojos"
            ? "Encontrá los días con menos movimiento y llevá clientes justo esos días."
            : codigo === "puntos_clientes"
              ? "Sumá puntos en cada compra y dale a tus clientes una razón para volver."
              : "Activá esta herramienta incluida para crear links y medir las ventas."}
      </p>
      {modulo?.tipo === "pago" && (
        <p className="text-lg font-semibold mb-5">
          {Number(
            modulo.precioMensualCongelado || modulo.precioMensual,
          ).toLocaleString("es-AR", {
            style: "currency",
            currency: "ARS",
            maximumFractionDigits: 0,
          })}{" "}
          / mes
        </p>
      )}
      {modulo.tipo === "pago" ? (
        <PagoModulo
          codigo={codigo}
          pendiente={modulo.estado === "pendiente_pago"}
          onActualizar={() => {
            reload();
            recargar();
          }}
        />
      ) : (
        <Button
          onClick={() =>
            accion(async () => {
              await apiLocal(`/modulos/${codigo}/activar`, { method: "PUT" });
              recargar();
              onActivo?.();
            }, "Herramienta activada")
          }
        >
          Activar gratis
        </Button>
      )}
    </Card>
  );
}
