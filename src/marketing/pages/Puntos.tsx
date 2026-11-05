import { SkeletonPantalla } from "../components/SkeletonPantalla";
import { useState } from "react";
import { Link } from "react-router";
import { ChevronDown, Search } from "lucide-react";
import { useLocal } from "../components/Layout";
import { useModulo, BloqueoModulo } from "../components/Modulo";
import { Paginacion } from "../components/Paginacion";
import {
  Header,
  Card,
  Chip,
  Stat,
  Estado,
  Button,
  Modal,
  accion,
} from "../components/ui";
import { apiLocal, datosLocal, query } from "../lib/api";
import { useDatos } from "../lib/useDatos";
import { FilaPuntosProducto } from "../components/FilaPuntosProducto";
import { fecha } from "../lib/formato";
import type {
  ConfiguracionPuntosData,
  ResumenPuntosData,
  MovimientoPuntosData,
  PaginadoPuntos,
  Producto,
} from "../lib/tipos";
import { MARKETING } from "../lib/rutas";
export function Puntos() {
  const mod = useModulo("puntos_clientes");
  return (
    <>
      {mod.loading || mod.error ? (
        <Estado
          skeleton={<SkeletonPantalla tipo="puntos" />}
          loading={mod.loading}
          error={mod.error}
          reintentar={mod.recargar}
        />
      ) : mod.modulo?.activoAhora ? (
        <PuntosContenido />
      ) : (
        <>
          <Header
            title="El club del local"
            ayuda={{ seccion: "puntos", texto: "Cómo funciona el club" }}
          />
          <BloqueoModulo codigo="puntos_clientes" nombre="Puntos" />
        </>
      )}
    </>
  );
}
function PuntosContenido() {
  const l = useLocal();
  const [configurar, setConfigurar] = useState(false);
  const d = useDatos(async () => {
    const [config, resumen, productos] = await Promise.all([
      datosLocal<ConfiguracionPuntosData>("/puntos/config"),
      datosLocal<ResumenPuntosData>("/puntos/resumen"),
      apiLocal<{ productos: Producto[] }>("/producto"),
    ]);
    return { config, resumen, productos: productos.productos };
  }, [l.restauranteId]);
  return (
    <>
      <Header
        title="El club del local"
        sub="Cada pedido suma una razón para volver."
        ayuda={{ seccion: "puntos", texto: "Cómo funciona el club" }}
      />
      <Estado skeleton={<SkeletonPantalla tipo="puntos" />} loading={d.loading} error={d.error} reintentar={d.recargar} />
      {d.data && (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <Stat
              label="Clientes con puntos"
              value={d.data.resumen.clientesConPuntos}
            />
            <Stat
              label="Puntos en circulación"
              value={d.data.resumen.puntosEnCirculacion}
            />
            <Stat
              label="Canjes de 30 días"
              value={d.data.resumen.canjes30Dias}
            />
          </div>
          <Card>
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2>Cómo funciona el club</h2>
              <Button variant="secondary" onClick={() => setConfigurar(true)}>Modificar club</Button>
            </div>
            <dl className="grid gap-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Estado", d.data.config.activo ? "Activo" : "Pausado"],
                ["Cómo se suman", ({monto: "Por el monto del pedido", producto: "Por los productos", ambos: "Monto y productos"})[d.data.config.modoAcumulacion || "monto"]],
                ["Pesos por punto", "$" + d.data.config.pesosPorPunto],
                ["Bienvenida", d.data.config.puntosPrimerPedido + " puntos"],
                ["Mínimo para canjear", d.data.config.puntosMinimosCanje + " puntos"],
                ["Envío gratis", d.data.config.permiteCanjeEnvioGratis ? d.data.config.puntosEnvioGratis + " puntos" : "Desactivado"],
                ["Descuento", d.data.config.permiteCanjeDescuento ? d.data.config.descuentoValor + (d.data.config.descuentoTipo === "porcentaje" ? "%" : " pesos") + " por " + d.data.config.descuentoPuntosCosto + " puntos" : "Desactivado"],
                ["Compra mínima para descuento", "$" + d.data.config.descuentoMontoMinimo],
              ].map(([label, value]) => <div key={label}><dt className="text-ink-3">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>)}
            </dl>
          </Card>
          <Modal open={configurar} onOpenChange={setConfigurar} title="Modificar club">
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
                    },
                  });
                  setConfigurar(false);
                  d.recargar();
                }, "Club actualizado");
              }}
            >
              <label className="flex items-center gap-3">
                <input
                  className="size-5 min-h-0 w-5"
                  type="checkbox"
                  name="activo"
                  defaultChecked={d.data.config.activo}
                />
                Club activo
              </label>
              <label>
                Cómo se suman
                <select
                  name="acumulacion"
                  defaultValue={d.data.config.modoAcumulacion || "monto"}
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
                  defaultValue={d.data.config.pesosPorPunto}
                />
              </label>
              <label>
                Bienvenida (puntos)
                <input
                  required
                  name="bienvenida"
                  type="number"
                  min={0}
                  defaultValue={d.data.config.puntosPrimerPedido}
                />
              </label>
              <label>
                Mínimo para canjear
                <input
                  required
                  name="minimo"
                  type="number"
                  min={0}
                  defaultValue={d.data.config.puntosMinimosCanje}
                />
              </label>
              <label className="flex items-center gap-3">
                <input
                  className="size-5 min-h-0 w-5"
                  type="checkbox"
                  name="envio"
                  defaultChecked={d.data.config.permiteCanjeEnvioGratis}
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
                  defaultValue={d.data.config.puntosEnvioGratis}
                />
              </label>
              <label className="flex items-center gap-3">
                <input
                  className="size-5 min-h-0 w-5"
                  type="checkbox"
                  name="descuento"
                  defaultChecked={d.data.config.permiteCanjeDescuento}
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
                  defaultValue={d.data.config.descuentoPuntosCosto}
                />
              </label>
              <label>
                Tipo de descuento
                <select
                  name="tipo"
                  defaultValue={
                    d.data.config.descuentoTipo === "fijo"
                      ? "monto_fijo"
                      : d.data.config.descuentoTipo
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
                  defaultValue={d.data.config.descuentoValor}
                />
              </label>
              <label>
                Compra mínima ($)
                <input
                  required
                  type="number"
                  min={0}
                  name="montoMinimo"
                  defaultValue={d.data.config.descuentoMontoMinimo}
                />
              </label>
              <Button>Guardar configuración</Button>
            </form>
          </Modal>
          <PuntosPorProducto
            productos={d.data.productos}
            modo={d.data.config.modoAcumulacion || "monto"}
          />
          <Card className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2>Clientes del club</h2>
                <p className="muted mt-1">
                  Sus puntos, canjes y ajustes están en Clientes.
                </p>
              </div>
              <Link
                className="btn btn-secondary"
                to={`${MARKETING}/clientes?club=1`}
              >
                Ver clientes del club
              </Link>
            </div>
          </Card>
          <MovimientosClub />
        </>
      )}
    </>
  );
}

const MOVIMIENTOS_POR_PAGINA = 10;
const TIPOS_MOVIMIENTO = [
  ["", "Todos"],
  ["ganancia", "Ganancias"],
  ["canje", "Canjes"],
] as const;
/** Los últimos movimientos del club, para ver sólo lo que se ganó o sólo lo que se canjeó. */
function MovimientosClub() {
  const [tipo, setTipo] = useState<(typeof TIPOS_MOVIMIENTO)[number][0]>("");
  const [pagina, setPagina] = useState(1);
  const m = useDatos(
    () =>
      datosLocal<PaginadoPuntos<MovimientoPuntosData>>(`/puntos/movimientos${query({ pagina, limite: MOVIMIENTOS_POR_PAGINA, tipo })}`,
      ),
    [pagina, tipo],
    { conservar: true },
  );
  return (
    <Card className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2>Últimos movimientos</h2>
        <div role="group" aria-label="Tipo de movimiento" className="flex gap-2">
          {TIPOS_MOVIMIENTO.map(([valor, texto]) => (
            <Chip
              key={valor || "todos"}
              className="min-h-9"
              activo={tipo === valor}
              onClick={() => {
                setTipo(valor);
                setPagina(1);
              }}
            >
              {texto}
            </Chip>
          ))}
        </div>
      </div>
      <Estado loading={m.loading && !m.data} error={m.error} reintentar={m.recargar} />
      {m.data && !m.data.items.length && (
        <p className="muted py-4">
          {tipo === "canje"
            ? "Todavía no hubo canjes."
            : tipo === "ganancia"
              ? "Todavía no hubo ganancias de puntos."
              : "Todavía no hay movimientos."}
        </p>
      )}
      {m.data && m.data.items.length > 0 && (
        <ul className={m.loading ? "opacity-60" : undefined} aria-busy={m.loading}>
          {m.data.items.map((mov) => (
            <li key={mov.id} className="border-b border-line py-3 text-sm last:border-b-0">
              <p className="font-semibold">
                {mov.clienteNombre} ·{" "}
                <span className={mov.puntos > 0 ? "text-emerald-700" : "text-brand-deep"}>
                  {mov.puntos > 0 ? "+" : ""}
                  {mov.puntos} puntos
                </span>
              </p>
              <p className="muted mt-1">
                {mov.motivo} · {fecha(mov.createdAt)} · Saldo {mov.saldoResultante}
              </p>
            </li>
          ))}
        </ul>
      )}
      {m.data && (
        <Paginacion
          pagina={m.data.pagina}
          paginas={m.data.paginas}
          total={m.data.total}
          limite={m.data.limite}
          nombre="movimientos"
          onCambiar={setPagina}
        />
      )}
    </Card>
  );
}
/**
 * Cuántos puntos suma y cuánto cuesta canjear cada producto. Es un ajuste fino que casi nadie
 * toca, así que arranca cerrado y, si el club suma por monto, avisa que no hace falta.
 */
function PuntosPorProducto({
  productos,
  modo,
}: {
  productos: Producto[];
  modo: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [buscar, setBuscar] = useState("");
  const q = buscar.trim().toLocaleLowerCase();
  const visibles = productos.filter((p) => p.nombre.toLocaleLowerCase().includes(q));
  return (
    <section className="mt-6 rounded-[20px] bg-surface lista-sombra">
      <button
        type="button"
        aria-expanded={abierto}
        aria-controls="puntos-por-producto"
        onClick={() => setAbierto((a) => !a)}
        className="flex w-full items-center justify-between gap-4 rounded-[20px] p-5 text-left sm:px-6"
      >
        <span>
          <span className="block text-lg font-bold">Puntos por producto</span>
          <span className="muted mt-1 block">
            {modo === "monto"
              ? "El club suma por el monto del pedido: acá sólo definís cuánto cuesta canjear cada producto."
              : "Cuántos puntos suma cada producto y cuántos hacen falta para canjearlo."}
          </span>
        </span>
        <ChevronDown
          size={20}
          aria-hidden="true"
          className={`shrink-0 text-ink-3 transition-transform ${abierto ? "rotate-180" : ""}`}
        />
      </button>
      {abierto && (
        <div id="puntos-por-producto" className="border-t border-line">
          <label className="relative block p-4 sm:px-5">
            <span className="sr-only">Buscar producto</span>
            <Search size={18} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-8 -translate-y-1/2 text-ink-3" />
            <input
              type="search"
              className="w-full pl-11"
              placeholder="Buscar producto"
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
            />
          </label>
          {visibles.length ? (
            <ul className="divide-y divide-line" aria-label="Puntos por producto">
              {visibles.map((p) => (
                <FilaPuntosProducto key={p.id} producto={p} />
              ))}
            </ul>
          ) : (
            <p className="muted px-5 pb-5">Ningún producto coincide con la búsqueda.</p>
          )}
        </div>
      )}
    </section>
  );
}
