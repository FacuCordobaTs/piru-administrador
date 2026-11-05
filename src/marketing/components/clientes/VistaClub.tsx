import { useState } from "react";
import { Button, Card, Estado, Modal, accion } from "../ui";
import { FilaPuntosProducto } from "../FilaPuntosProducto";
import { Paginacion } from "../Paginacion";
import { SkeletonPantalla } from "../SkeletonPantalla";
import { apiLocal, datosLocal, query } from "../../lib/api";
import { useDatos } from "../../lib/useDatos";
import { fecha } from "../../lib/formato";
import type {
  ConfiguracionPuntosData,
  MovimientoPuntosData,
  PaginadoPuntos,
  Producto,
} from "../../lib/tipos";
const MOVIMIENTOS_POR_PAGINA = 10;
const COMO_SE_SUMAN: Record<string, string> = {
  monto: "Por el monto del pedido",
  producto: "Por los productos",
  ambos: "Monto y productos",
};
function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="text-ink-3">{etiqueta}</dt>
      <dd className="text-right font-medium">{valor}</dd>
    </div>
  );
}
/**
 * El club de puntos del local, dentro de Clientes: cómo se suman y se canjean los puntos, cuántos
 * da cada producto y los últimos movimientos. Los puntos de cada cliente están en su fila y en su
 * ficha; acá vive lo que es de todo el club.
 */
export function VistaClub({
  onConfigurado,
}: {
  /** Se cambiaron las reglas del club: la pantalla puede refrescar sus números. */
  onConfigurado: () => void;
}) {
  const [configurar, setConfigurar] = useState(false);
  const [buscar, setBuscar] = useState("");
  const [pagina, setPagina] = useState(1);
  const base = useDatos(async () => {
    const [config, productos] = await Promise.all([
      datosLocal<ConfiguracionPuntosData>("/puntos/config"),
      apiLocal<{ productos: Producto[] }>("/producto"),
    ]);
    return { config, productos: productos.productos };
  }, [], { conservar: true });
  const movimientos = useDatos(
    () =>
      datosLocal<PaginadoPuntos<MovimientoPuntosData>>(`/puntos/movimientos${query({ pagina, limite: MOVIMIENTOS_POR_PAGINA })}`,
      ),
    [pagina],
    { conservar: true },
  );
  const config = base.data?.config;
  const productos = base.data?.productos.filter((p) =>
    p.nombre.toLocaleLowerCase().includes(buscar.trim().toLocaleLowerCase()),
  );
  return (
    <>
      <Estado
        skeleton={<SkeletonPantalla tipo="puntos" />}
        loading={base.loading && !base.data}
        error={base.error}
        reintentar={base.recargar}
      />
      {base.data && config && productos && (
        <div className="space-y-8">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2>Cómo funciona el club</h2>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${config.activo ? "bg-emerald-50 text-emerald-700" : "bg-sand text-ink-3"}`}
                  >
                    {config.activo ? "Activo" : "Pausado"}
                  </span>
                </div>
                <p className="muted mt-2">
                  Cada pedido cobrado suma puntos y con los puntos se canjean
                  premios.
                </p>
              </div>
              <Button variant="secondary" onClick={() => setConfigurar(true)}>
                Modificar club
              </Button>
            </div>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="label">Cómo se suman</p>
                <dl className="mt-3 grid gap-3">
                  <Dato
                    etiqueta="Los puntos se suman"
                    valor={COMO_SE_SUMAN[config.modoAcumulacion || "monto"]}
                  />
                  <Dato
                    etiqueta="Pesos por punto"
                    valor={`$${config.pesosPorPunto}`}
                  />
                  <Dato
                    etiqueta="Bienvenida"
                    valor={`${config.puntosPrimerPedido} puntos`}
                  />
                  <Dato
                    etiqueta="Puntos extra por campaña"
                    valor={`hasta ${config.puntosBonusMaximo ?? 500} por pedido · ${config.puntosBonusPorCliente30Dias ?? 2} veces por cliente al mes`}
                  />
                </dl>
              </div>
              <div>
                <p className="label">Cómo se canjean</p>
                <dl className="mt-3 grid gap-3">
                  <Dato
                    etiqueta="Mínimo para canjear"
                    valor={`${config.puntosMinimosCanje} puntos`}
                  />
                  <Dato
                    etiqueta="Envío gratis"
                    valor={
                      config.permiteCanjeEnvioGratis
                        ? `${config.puntosEnvioGratis} puntos`
                        : "Desactivado"
                    }
                  />
                  <Dato
                    etiqueta="Descuento"
                    valor={
                      config.permiteCanjeDescuento
                        ? `${config.descuentoValor}${config.descuentoTipo === "porcentaje" ? "%" : " pesos"} por ${config.descuentoPuntosCosto} puntos`
                        : "Desactivado"
                    }
                  />
                  {config.permiteCanjeDescuento && (
                    <Dato
                      etiqueta="Compra mínima para descuento"
                      valor={`$${config.descuentoMontoMinimo}`}
                    />
                  )}
                </dl>
              </div>
            </div>
          </Card>
          <Modal
            open={configurar}
            onOpenChange={setConfigurar}
            title="Modificar club"
          >
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void accion(async () => {
                  await apiLocal("/puntos/config", {
                    method: "PUT",
                    body: {
                      activo: f.get("activo") === "on",
                      modoAcumulacion: String(f.get("acumulacion")),
                      pesosPorPunto: Number(f.get("pesos")),
                      puntosPrimerPedido: Number(f.get("bienvenida")),
                      puntosMinimosCanje: Number(f.get("minimo")),
                      permiteCanjeEnvioGratis: f.get("envio") === "on",
                      puntosEnvioGratis: Number(f.get("puntosEnvio")),
                      permiteCanjeDescuento: f.get("descuento") === "on",
                      descuentoPuntosCosto: Number(f.get("costo")),
                      descuentoTipo: String(f.get("tipo")),
                       descuentoValor: Number(f.get("valor")),
                       descuentoMontoMinimo: Number(f.get("montoMinimo")),
                       puntosBonusTopePorcentaje: Number(f.get("bonusTope")),
                       puntosBonusMaximo: Number(f.get("bonusMaximo")),
                       puntosBonusPorCliente30Dias: Number(f.get("bonusCupo")),
                     },
                  });
                  setConfigurar(false);
                  base.recargar();
                  onConfigurado();
                }, "Club actualizado");
              }}
            >
              <label className="flex items-center gap-3">
                <input
                  className="size-5 min-h-0 w-5"
                  type="checkbox"
                  name="activo"
                  defaultChecked={config.activo}
                />
                Club activo
              </label>
              <label>
                Cómo se suman
                <select
                  name="acumulacion"
                  defaultValue={config.modoAcumulacion || "monto"}
                >
                  <option value="monto">Por el monto del pedido</option>
                  <option value="producto">Por los productos</option>
                  <option value="ambos">Monto y productos</option>
                </select>
              </label>
              <label>
                Pesos por punto
                <input
                  required
                  name="pesos"
                  type="number"
                  min={1}
                  defaultValue={config.pesosPorPunto}
                />
              </label>
              <label>
                Bienvenida (puntos)
                <input
                  required
                  name="bienvenida"
                  type="number"
                  min={0}
                  defaultValue={config.puntosPrimerPedido}
                />
              </label>
              <label>
                Mínimo para canjear
                <input
                  required
                  name="minimo"
                  type="number"
                  min={0}
                  defaultValue={config.puntosMinimosCanje}
                />
              </label>
              <label className="flex items-center gap-3">
                <input
                  className="size-5 min-h-0 w-5"
                  type="checkbox"
                  name="envio"
                  defaultChecked={config.permiteCanjeEnvioGratis}
                />
                Canjear envío gratis
              </label>
              <label>
                Puntos por envío gratis
                <input
                  required
                  type="number"
                  min={1}
                  name="puntosEnvio"
                  defaultValue={config.puntosEnvioGratis}
                />
              </label>
              <label className="flex items-center gap-3">
                <input
                  className="size-5 min-h-0 w-5"
                  type="checkbox"
                  name="descuento"
                  defaultChecked={config.permiteCanjeDescuento}
                />
                Canjear descuento
              </label>
              <label>
                Puntos por descuento
                <input
                  required
                  name="costo"
                  type="number"
                  min={0}
                  defaultValue={config.descuentoPuntosCosto}
                />
              </label>
              <label>
                Tipo de descuento
                <select
                  name="tipo"
                  defaultValue={
                    config.descuentoTipo === "fijo"
                      ? "monto_fijo"
                      : config.descuentoTipo
                  }
                >
                  <option value="porcentaje">Porcentaje</option>
                  <option value="monto_fijo">Monto fijo</option>
                </select>
              </label>
              <label>
                Valor del descuento
                <input
                  required
                  type="number"
                  min={0}
                  name="valor"
                  defaultValue={config.descuentoValor}
                />
              </label>
              <label>
                Compra mínima ($)
                <input
                  required
                  type="number"
                  min={0}
                  name="montoMinimo"
                  defaultValue={config.descuentoMontoMinimo}
                />
              </label>
              <label>
                Techo del bonus de puntos (% del pedido)
                <input
                  required
                  type="number"
                  min={1}
                  max={50}
                  name="bonusTope"
                  defaultValue={config.puntosBonusTopePorcentaje ?? 12}
                />
                <span className="muted text-sm">
                  Cuánto puede valer, como máximo, un bonus de puntos sobre el
                  total del pedido.
                </span>
              </label>
              <label>
                Puntos extra máximos por pedido
                <input
                  required
                  type="number"
                  min={1}
                  max={10000}
                  name="bonusMaximo"
                  defaultValue={config.puntosBonusMaximo ?? 500}
                />
              </label>
              <label>
                Bonus por cliente cada 30 días
                <input
                  required
                  type="number"
                  min={0}
                  max={20}
                  name="bonusCupo"
                  defaultValue={config.puntosBonusPorCliente30Dias ?? 2}
                />
              </label>
              <Button>Guardar configuración</Button>
            </form>
          </Modal>
          <section>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2>Puntos por producto</h2>
                <p className="muted mt-2">
                  Cuántos puntos suma cada producto y cuántos hacen falta para
                  canjearlo.
                </p>
              </div>
              <label className="w-full sm:w-64">
                Buscar producto
                <input
                  placeholder="Nombre del producto"
                  value={buscar}
                  onChange={(e) => setBuscar(e.target.value)}
                />
              </label>
            </div>
            {!productos.length ? (
              <p className="muted">
                {base.data.productos.length
                  ? "Ningún producto coincide con la búsqueda."
                  : "Todavía no hay productos en la carta."}
              </p>
            ) : (
              <div
                tabIndex={0}
                role="region"
                aria-label="Puntos por producto"
                className="lista-sombra overflow-x-auto rounded-[20px] bg-surface"
              >
                <table className="w-full min-w-[700px] table-fixed text-left text-sm">
                  <thead className="text-xs text-ink-3">
                    <tr>
                      <th scope="col" className="px-4 py-4 font-medium">
                        Producto
                      </th>
                      <th scope="col" className="px-4 py-4 font-medium">
                        Puntos que suma
                      </th>
                      <th scope="col" className="px-4 py-4 font-medium">
                        Puntos para canjear
                      </th>
                      <th scope="col" className="px-4 py-4 font-medium">
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {productos.map((p) => (
                      <FilaPuntosProducto
                        key={p.id}
                        producto={p}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section>
            <h2 className="mb-5">Últimos movimientos</h2>
            <Estado
              loading={movimientos.loading && !movimientos.data}
              error={movimientos.error}
              reintentar={movimientos.recargar}
            />
            {movimientos.data &&
              (!movimientos.data.items.length ? (
                <p className="muted">Todavía no hay movimientos de puntos.</p>
              ) : (
                <>
                  <Card className={movimientos.loading ? "opacity-60" : ""}>
                    {movimientos.data.items.map((m) => (
                      <div
                        key={m.id}
                        className="border-b border-line py-3 text-sm last:border-0"
                      >
                        <p className="font-semibold">
                          {m.clienteNombre} · {m.puntos > 0 ? "+" : ""}
                          {m.puntos} puntos
                        </p>
                        <p className="muted mt-1">
                          {m.motivo} · {fecha(m.createdAt)} · Saldo{" "}
                          {m.saldoResultante}
                        </p>
                      </div>
                    ))}
                  </Card>
                  <Paginacion
                    nombre="movimientos"
                    pagina={movimientos.data.pagina || pagina}
                    paginas={movimientos.data.paginas}
                    total={movimientos.data.total}
                    limite={MOVIMIENTOS_POR_PAGINA}
                    onCambiar={setPagina}
                  />
                </>
              ))}
          </section>
        </div>
      )}
    </>
  );
}
