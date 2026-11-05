import { useState } from "react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button, Confirmar, Sheet, accion } from "../ui";
import { HistorialPuntos } from "../HistorialPuntos";
import { apiLocal, datosLocal } from "../../lib/api";
import { fecha, pesos } from "../../lib/formato";
import type { ClienteGrowth } from "../../lib/tipos";
import { PortalMarketing } from "../portal";
const fuente = (c: ClienteGrowth) =>
  c.fuenteAdquisicion === "organico"
    ? "Sin campaña (orgánico)"
    : (c.campanaAdquisicion?.nombre ??
      (c.fuenteAdquisicion === "receta"
        ? "Un mensaje de recompra"
        : "Sin datos"));
/**
 * La ficha de un cliente: su historial, sus favoritos y, con el club activo, sus puntos —saldo,
 * lo que ganó y canjeó, y el ajuste a mano—, sus datos, los movimientos de puntos y el borrado de
 * clientes y pedidos.
 *
 * `onCambio` avisa que algo cambió en el backend: la lista se vuelve a pedir y, si llega el
 * cliente actualizado, la ficha queda abierta con él.
 */
export function FichaDelCliente({
  cliente,
  club,
  nombreSucursal,
  onCerrar,
  onCambio,
}: {
  cliente: ClienteGrowth | null;
  /** El local tiene Puntos: hay club de puntos. */
  club: boolean;
  nombreSucursal: (id?: number | null) => string | null | undefined;
  onCerrar: () => void;
  onCambio: (actualizado?: ClienteGrowth) => void;
}) {
  const [ajustando, setAjustando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [movimientos, setMovimientos] = useState(false);
  const [borrarPedido, setBorrarPedido] = useState<number | null>(null);
  const [borrarCliente, setBorrarCliente] = useState(false);
  // Al cerrar, lo que quedó abierto adentro de la ficha no pasa al próximo cliente.
  function cerrar() {
    setAjustando(false);
    setMovimientos(false);
    onCerrar();
  }
  async function eliminar(ruta: string, ok: string, cerrarFicha = false) {
    try {
      await apiLocal(ruta, { method: "DELETE" });
      if (cerrarFicha) cerrar();
      toast.success(ok);
      onCambio();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos eliminarlo.");
    }
  }
  const actividad = cliente?.club;
  return (
    <>
      <Dialog.Root
        open={!!cliente}
        onOpenChange={(abierto) => {
          if (!abierto) cerrar();
        }}
      >
        <PortalMarketing>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[calc(100%-32px)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl bg-surface p-5 shadow-xl sm:p-6"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <Dialog.Title className="text-xl font-bold break-words">
                {cliente?.nombre || "Cliente"}
              </Dialog.Title>
              <Dialog.Close asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="shrink-0 px-3"
                  aria-label="Cerrar"
                >
                  <X size={20} />
                </Button>
              </Dialog.Close>
            </div>
            {cliente && (
              <div className="grid gap-6">
                <section>
                  <p className="muted">{cliente.telefono}</p>
                  <p className="stat my-3">{pesos(cliente.totalGastado)}</p>
                  <p className="muted">
                    {cliente.cantidadPedidos} pedidos · {cliente.puntos || 0}{" "}
                    puntos
                  </p>
                  <p className="muted mt-2">
                    {cliente.resumenCadencia ||
                      "Todavía no hay un hábito definido."}
                  </p>
                </section>
                <section>
                    <h2>Sus datos</h2>
                    <dl className="mt-3 grid gap-3 text-sm">
                      <div className="flex justify-between gap-3">
                        <dt className="text-ink-3">Dirección</dt>
                        <dd className="text-right">
                          {cliente.direccion || "Retira en el local"}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-ink-3">Primera compra</dt>
                        <dd className="text-right tabular-nums">
                          {cliente.primeraCompra
                            ? `${fecha(cliente.primeraCompra.fecha)} · ${pesos(cliente.primeraCompra.revenue)}`
                            : "Sin datos"}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-ink-3">Llegó por</dt>
                        <dd className="text-right">{fuente(cliente)}</dd>
                      </div>
                    </dl>
                  </section>
                {club && (
                  <section aria-labelledby="ficha-puntos">
                    <h2 id="ficha-puntos">Puntos</h2>
                    <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                      <p className="stat">
                        {(cliente.puntos || 0).toLocaleString("es-AR")}{" "}
                        <span className="text-base font-medium text-ink-3">
                          puntos
                        </span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          aria-expanded={ajustando}
                          onClick={() => setAjustando((a) => !a)}
                        >
                          Ajustar puntos
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setMovimientos(true)}
                          >
                            Ver movimientos de puntos
                          </Button>
                      </div>
                    </div>
                    <p className="muted mt-2">
                      {actividad?.movimientos
                        ? `Ganó ${actividad.puntosOtorgados.toLocaleString("es-AR")} · canjeó ${actividad.puntosCanjeados.toLocaleString("es-AR")} · ${actividad.canjes} ${actividad.canjes === 1 ? "canje" : "canjes"}${actividad.ultimoMovimientoAt ? ` · último movimiento ${fecha(actividad.ultimoMovimientoAt)}` : ""}`
                        : "Todavía no tiene movimientos de puntos."}
                    </p>
                    {ajustando && (
                      <form
                        className="mt-4 grid gap-4 rounded-2xl bg-sand/60 p-4"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const f = new FormData(e.currentTarget);
                          setGuardando(true);
                          await accion(async () => {
                            const r = await datosLocal<{
                              puntosActuales: number;
                            }>(`/puntos/cliente/${cliente.id}/ajuste`,
                              {
                                method: "POST",
                                body: {
                                  puntos: Number(f.get("puntos")),
                                  motivo: String(f.get("motivo")),
                                },
                              },
                            );
                            setAjustando(false);
                            onCambio({
                              ...cliente,
                              puntos: r.puntosActuales ?? cliente.puntos,
                            });
                          }, "Ajuste registrado");
                          setGuardando(false);
                        }}
                      >
                        <p className="muted">
                          Saldo actual: {cliente.puntos || 0} puntos. Un valor
                          negativo resta puntos.
                        </p>
                        <label>
                          Ajuste
                          <input
                            required
                            type="number"
                            step={1}
                            name="puntos"
                          />
                        </label>
                        <label>
                          Motivo
                          <textarea
                            required
                            minLength={3}
                            maxLength={255}
                            name="motivo"
                          />
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <Button disabled={guardando}>
                            {guardando ? "Guardando…" : "Registrar ajuste"}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setAjustando(false)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </form>
                    )}
                  </section>
                )}
                <section>
                  <h2>Sus favoritos</h2>
                  {cliente.productosTop?.map((p) => (
                    <p key={p.nombre} className="muted mt-3">
                      {p.nombre} · {p.cantidad}
                    </p>
                  ))}
                </section>
                <section>
                  <h2>Campañas y cupones</h2>
                  {cliente.campanasParticipadas?.map((c) => (
                    <p key={c.id} className="muted mt-3">
                      {c.nombre}: {c.pedidos} pedidos ·{" "}
                      {pesos(c.revenueAtribuido)}
                    </p>
                  ))}
                  {cliente.cuponesUsados?.map((c) => (
                    <p key={c.id} className="muted mt-3">
                      {c.codigo}: {c.usos} usos · {pesos(c.facturacion)}
                    </p>
                  ))}
                </section>
                <section>
                  <h2>Pedidos</h2>
                  {cliente.pedidos.map((p) => (
                    <div key={p.id} className="py-3 border-b border-line">
                      <p className="text-sm font-semibold">
                        {fecha(p.createdAt)} · {pesos(p.total)}
                      </p>
                      {p.items.map((item, i) => (
                        <p key={i} className="muted mt-1">
                          {item.cantidad} × {item.nombreProducto}
                        </p>
                      ))}
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <span className="muted">
                            Pedido #{p.id}
                            {nombreSucursal(p.sucursalId)
                              ? ` · ${nombreSucursal(p.sucursalId)}`
                              : ""}
                          </span>
                          <Button
                            variant="ghost"
                            className="min-h-9 px-3 text-rose-700"
                            aria-label={`Eliminar el pedido #${p.id}`}
                            onClick={() => setBorrarPedido(p.id)}
                          >
                            Eliminar
                          </Button>
                        </div>
                    </div>
                  ))}
                </section>
                <Button
                    variant="danger"
                    onClick={() => setBorrarCliente(true)}
                  >
                    Eliminar cliente
                  </Button>
              </div>
            )}
          </Dialog.Content>
        </PortalMarketing>
      </Dialog.Root>
      <>
          <Sheet
            open={movimientos && !!cliente}
            onOpenChange={() => setMovimientos(false)}
            title={`Puntos de ${cliente?.nombre || ""}`}
          >
            {cliente && (
              <HistorialPuntos
                clienteId={cliente.id}
              />
            )}
          </Sheet>
          <Confirmar
            open={borrarPedido !== null}
            onOpenChange={(o) => !o && setBorrarPedido(null)}
            title={`¿Eliminar el pedido #${borrarPedido}?`}
            text={`Se borra del historial de ${cliente?.nombre || "este cliente"} junto con su pago. No se puede deshacer.`}
            confirmLabel="Eliminar pedido"
            onConfirm={() =>
              eliminar(
                `/clientes/${cliente?.id}/pedidos/${borrarPedido}`,
                "Pedido eliminado",
              )
            }
          />
          <Confirmar
            open={borrarCliente}
            onOpenChange={setBorrarCliente}
            title={`¿Eliminar a ${cliente?.nombre || "este cliente"}?`}
            text="Se borran sus datos, sus pedidos y sus mensajes de recompra. No se puede deshacer."
            confirmLabel="Eliminar cliente"
            onConfirm={() =>
              eliminar(`/clientes/${cliente?.id}`, "Cliente eliminado", true)
            }
          />
        </>
    </>
  );
}
