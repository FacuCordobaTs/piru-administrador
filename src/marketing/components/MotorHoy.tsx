import { useState } from "react";
import { Link } from "react-router";
import { Settings2 } from "lucide-react";
import { useLocal } from "./Layout";
import { Button, Card, Modal, accion } from "./ui";
import { apiLocal } from "../lib/api";
import type { EstadoMotorRecompra } from "../lib/tipos";
import { GUIA } from "../lib/rutas";

/**
 * Cómo escribe el motor de recompra, explicado: el ritmo (cuántos mensajes y cada cuánto) es
 * automático, así que acá sólo se cuenta. Lo único que se elige es cómo salen los mensajes cuando
 * el local tiene el WhatsApp de Piru conectado.
 */
export function MotorHoy({
  config,
  onGuardado,
}: {
  config: EstadoMotorRecompra["config"];
  onGuardado: () => void;
}) {
  const l = useLocal();
  const [ajustes, setAjustes] = useState(false);
  const [busy, setBusy] = useState(false);
  const hasta = config.toqueHasta ?? 3;
  const pasos = [
    "El primer mensaje sale el día en que el cliente suele volver a pedir.",
    hasta >= 2 && `Si no vuelve, a los ${config.diasToque2} días le llega un recordatorio.`,
    hasta >= 3 && `Y si sigue sin volver, a los ${config.diasToque3} días, un último mensaje.`,
    "Si compra, sale de la agenda. Nunca se le escribe a quien pidió no recibir mensajes.",
  ].filter(Boolean) as string[];
  return (
    <Card className="mt-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h2>Así escribe Piru por vos</h2>
          <p className="muted mt-2">
            Todo es automático: la agenda se arma sola con los clientes que necesitan volver, sin
            configurar mensaje por mensaje.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {l.whatsappConectado && (
            <Button type="button" variant="secondary" onClick={() => setAjustes(true)}>
              <Settings2 size={16} />
              Ajustes de envío
            </Button>
          )}
          <Link className="btn btn-ghost" to={`${GUIA}#motor`}>
            Cómo funciona
          </Link>
        </div>
      </div>
      <ol className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        {pasos.map((p, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-sand text-xs font-bold">
              {i + 1}
            </span>
            <span className="pt-0.5">{p}</span>
          </li>
        ))}
      </ol>
      <p className="muted mt-5">
        Envío: {config.modo === "automatico" ? "automático desde el WhatsApp de Piru" : "manual, desde el WhatsApp del local"}
        {l.whatsappConectado && config.modo === "automatico" ? ` · hasta ${config.cupoDiario} mensajes por día` : ""}.
      </p>
      <Modal open={ajustes} onOpenChange={(o) => !busy && setAjustes(o)} title="Ajustes de envío">
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            const f = new FormData(e.currentTarget);
            setBusy(true);
            try {
              await accion(async () => {
                await apiLocal("/clientes/recompra/config", {
                  method: "PUT",
                  body: {
                    modo: String(f.get("modo") || config.modo),
                    ...(f.has("cupo") ? { cupoDiario: Number(f.get("cupo")) } : {}),
                  },
                });
                await apiLocal("/clientes/recompra/sincronizar", { method: "POST" });
                setAjustes(false);
                onGuardado();
              }, "Ajustes guardados");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Cómo salen los mensajes
            <select name="modo" defaultValue={config.modo}>
              <option value="manual">Manual · WhatsApp del local</option>
              <option value="automatico">Automático · Meta</option>
            </select>
          </label>
          <label>
            Máximo de envíos automáticos por día
            <input name="cupo" type="number" min={5} max={60} defaultValue={config.cupoDiario} />
          </label>
          <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setAjustes(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
