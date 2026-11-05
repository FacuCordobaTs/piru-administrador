import { SkeletonPantalla } from "../components/SkeletonPantalla";
import { useState } from "react";
import { toast } from "sonner";
import { useLocal } from "../components/Layout";
import { useModulo, BloqueoModulo } from "../components/Modulo";
import {
  Header,
  Button,
  Card,
  Estado,
  Empty,
  Sheet,
  Modal,
  Stat,
  Confirmar,
  accion,
} from "../components/ui";
import { apiLocal, datosLocal, query } from "../lib/api";
import { useDatos } from "../lib/useDatos";
import { sucursalesParaFiltrar, useSucursales } from "../lib/useSucursales";
import {
  FILTROS_CUPONES_VACIOS,
  filtrarCupones,
  type FiltrosCupones,
} from "../lib/filtrosListas";
import {
  pesos,
  fecha,
  hoyArgentina,
  rango,
  diaArgentina,
} from "../lib/formato";
import type {
  CodigoDescuentoGrowth,
  ResultadoCupon,
} from "../lib/tipos";
export function Cupones() {
  const mod = useModulo("codigos_descuento");
  return (
    <>
      {mod.loading || mod.error ? (
        <Estado
          skeleton={<SkeletonPantalla tipo="cupones" />}
          loading={mod.loading}
          error={mod.error}
          reintentar={mod.recargar}
        />
      ) : mod.modulo?.activoAhora ? (
        <CuponesContenido />
      ) : (
        <>
          <Header
            title="Cupones que traen pedidos"
            ayuda={{ seccion: "cupones", texto: "Cómo se miden los cupones" }}
          />
          <BloqueoModulo codigo="codigos_descuento" nombre="Cupones" />
        </>
      )}
    </>
  );
}
function CuponesContenido() {
  const l = useLocal();
  const [buscar, setBuscar] = useState("");
  const [open, setOpen] = useState(false);
  const [detalle, setDetalle] = useState<number | null>(null);
  const [tipo, setTipo] = useState("porcentaje");
  const [busy, setBusy] = useState(false);
  const sucursales = sucursalesParaFiltrar(
    useSucursales(),
  );
  const [filtrosCup, setFiltrosCup] = useState<FiltrosCupones>(
    FILTROS_CUPONES_VACIOS,
  );
  const [periodo, setPeriodo] = useState(0);
  const [sucursalId, setSucursalId] = useState<number | null>(null);
  const [editar, setEditar] = useState<CodigoDescuentoGrowth | null>(null);
  const [borrar, setBorrar] = useState<CodigoDescuentoGrowth | null>(null);
  const ventana = periodo ? rango(periodo) : null;
  const filtrosResultados = query({
    from: ventana && `${ventana.from}T00:00:00-03:00`,
    to: ventana && `${ventana.to}T23:59:59-03:00`,
    sucursalId,
  });
  const d = useDatos(async () => {
    const lista = await datosLocal<CodigoDescuentoGrowth[]>("/codigo-descuento",
    );
    const resultados = await Promise.all(
      lista.map((c) =>
        datosLocal<ResultadoCupon>(`/codigo-descuento/${c.id}/resultados${filtrosResultados}`,
        ),
      ),
    );
    return { lista, resultados };
  }, [l.restauranteId, filtrosResultados]);
  const lista =
    d.data &&
    (filtrarCupones(d.data.lista, filtrosCup)).filter(c => c.codigo.toLocaleLowerCase().includes(buscar.trim().toLocaleLowerCase()));
  async function eliminar(c: CodigoDescuentoGrowth) {
    try {
      await apiLocal(`/codigo-descuento/${c.id}`, {
        method: "DELETE",
      });
      toast.success("Cupón eliminado");
      d.recargar();
    } catch {
      toast.error(
        "No pudimos eliminarlo: si ya se usó en pedidos, pausalo en lugar de borrarlo.",
      );
    }
  }
  return (
    <>
      <Header
        title="Cupones que traen pedidos"
        sub="Beneficios claros, resultados medidos."
        ayuda={{ seccion: "cupones", texto: "Cómo se miden los cupones" }}
      >
        <Button onClick={() => setOpen(true)}>Crear cupón</Button>
      </Header>
      <label className="mb-5 block sm:max-w-md">
        Buscar cupón
        <input placeholder="Código del cupón" value={buscar} onChange={e => setBuscar(e.target.value)} />
      </label>
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <label>
            Estado
            <select
              value={filtrosCup.estado}
              onChange={(e) =>
                setFiltrosCup({
                  ...filtrosCup,
                  estado: e.target.value as FiltrosCupones["estado"],
                })
              }
            >
              <option value="todos">Todos</option>
              <option value="vigentes">Vigentes</option>
              <option value="pausados">Pausados</option>
              <option value="agotados">Agotados</option>
              <option value="vencidos">Vencidos</option>
            </select>
          </label>
          <label>
            Beneficio
            <select
              value={filtrosCup.tipo}
              onChange={(e) =>
                setFiltrosCup({
                  ...filtrosCup,
                  tipo: e.target.value as FiltrosCupones["tipo"],
                })
              }
            >
              <option value="todos">Todos</option>
              <option value="porcentaje">Porcentaje</option>
              <option value="monto_fijo">Monto fijo</option>
              <option value="envio_gratis">Envío gratis</option>
            </select>
          </label>
          <label>
            Ordenar por
            <select
              value={filtrosCup.orden}
              onChange={(e) =>
                setFiltrosCup({
                  ...filtrosCup,
                  orden: e.target.value as FiltrosCupones["orden"],
                })
              }
            >
              <option value="recientes">Más recientes</option>
              <option value="usos">Más usados</option>
              <option value="beneficio">Mayor beneficio</option>
              <option value="nombre">Alfabético (A → Z)</option>
            </select>
          </label>
          <label>
            Resultados de
            <select
              value={periodo}
              onChange={(e) => setPeriodo(Number(e.target.value))}
            >
              <option value={0}>Todo el historial</option>
              <option value={7}>Últimos 7 días</option>
              <option value={30}>Últimos 30 días</option>
              <option value={90}>Últimos 90 días</option>
            </select>
          </label>
          {sucursales.length > 0 && (
            <label>
              Sucursal
              <select
                value={sucursalId ?? ""}
                onChange={(e) =>
                  setSucursalId(e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">Todas las sucursales</option>
                {sucursales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      <Estado skeleton={<SkeletonPantalla tipo="cupones" />} loading={d.loading} error={d.error} reintentar={d.recargar} />
      {d.data && lista && (
        <>
          {d.data.lista.length > 0 && !lista.length && (
            <Empty
              title="Ningún cupón cumple estos filtros"
              text="Probá con otro código, estado o beneficio."
            >
              <Button
                variant="secondary"
                onClick={() => { setBuscar(""); setFiltrosCup(FILTROS_CUPONES_VACIOS); }}
              >
                Ver todos
              </Button>
            </Empty>
          )}
          {!d.data.lista.length ? (
            <Empty
              title="Todavía no hay cupones"
              text="Armá un código para tu próxima acción."
            >
              <Button onClick={() => setOpen(true)}>Crear cupón</Button>
            </Empty>
          ) : (
            <div className="lista-sombra overflow-x-auto rounded-[20px] bg-surface" role="region" aria-label="Listado de cupones" tabIndex={0}>
              <table className="w-full min-w-[1000px] text-sm">
                <thead><tr className="text-xs text-ink-3">
                  {["Código", "Beneficio", "Usos", "Estado", "Facturación"].map(t => <th key={t} scope="col" className="px-4 py-4 text-left font-medium">{t}</th>)}
                </tr></thead>
                <tbody>
              {lista.map((c) => (
                <tr key={c.id} className="cursor-pointer transition-colors hover:bg-sand/50" onClick={() => setDetalle(c.id)}>
                  <th scope="row" className="px-4 py-4 text-left font-semibold break-words"><button type="button" className="w-full rounded-lg text-left break-words" onClick={() => setDetalle(c.id)}>{c.codigo}</button></th>
                  <td className="px-4 py-4 whitespace-nowrap tabular-nums">{c.tipo === "envio_gratis" ? "Envío gratis" : c.tipo === "porcentaje" ? Number(c.valor) + "%" : pesos(c.valor)}</td>
                  <td className="px-4 py-4 whitespace-nowrap tabular-nums">{c.usosActuales}{c.limiteUsos ? " / " + c.limiteUsos : ""}</td>
                  <td className="px-4 py-4 text-ink-2">{c.activo ? "Activo" : "Pausado"}</td>
                  <td className="px-4 py-4 whitespace-nowrap tabular-nums">{pesos(d.data!.resultados.find(r => r.codigo.id === c.id)?.metricas.facturacionCobrada || 0)}</td>
                </tr>
              ))}
                </tbody>
              </table>
            </div>
          )}
          <Sheet open={open} onOpenChange={setOpen} title="Crear cupón">
            <form
              className="grid gap-5"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                setBusy(true);
                await accion(async () => {
                  await apiLocal("/codigo-descuento/create", {
                    method: "POST",
                    body: {
                      codigo: String(f.get("codigo")).toUpperCase(),
                      tipo,
                      valor: tipo === "envio_gratis" ? "0" : String(f.get("valor")),
                      limiteUsos: f.get("cupo") ? Number(f.get("cupo")) : null,
                      montoMinimo: String(f.get("minimo") || "0"),
                      fechaInicio: f.get("inicio")
                        ? `${f.get("inicio")}T00:00:00-03:00`
                        : null,
                      fechaFin: f.get("fin")
                        ? `${f.get("fin")}T23:59:59-03:00`
                        : null,
                    },
                  });
                  setOpen(false);
                  d.recargar();
                }, "Cupón creado");
                setBusy(false);
              }}
            >
              <label>
                Código
                <input
                  name="codigo"
                  required
                  maxLength={50}
                  placeholder="MARTES"
                />
              </label>
              <label>
                Beneficio
                <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                  <option value="porcentaje">Porcentaje</option>
                  <option value="monto_fijo">Monto fijo</option>
                  <option value="envio_gratis">Envío gratis</option>
                </select>
              </label>
              {tipo === "envio_gratis" ? (
                <p className="text-sm text-ink-2">
                  Bonifica el costo del envío según la zona. Sólo para delivery; la compra mínima se calcula sin envío.
                </p>
              ) : (
                <label>
                  {tipo === "porcentaje" ? "Porcentaje" : "Monto ($)"}
                  <input
                    name="valor"
                    required
                    type="number"
                    min={1}
                    max={tipo === "porcentaje" ? 100 : undefined}
                  />
                </label>
              )}
              <label>
                Usos máximos
                <input name="cupo" type="number" min={1} />
              </label>
              <label>
                Compra mínima ($)
                <input name="minimo" type="number" min={0} defaultValue={0} />
              </label>
              <label>
                Desde
                <input
                  name="inicio"
                  type="date"
                  defaultValue={hoyArgentina()}
                />
              </label>
              <label>
                Hasta
                <input name="fin" type="date" />
              </label>
              <Button disabled={busy}>
                {busy ? "Creando…" : "Crear cupón"}
              </Button>
            </form>
          </Sheet>
          <Modal
            open={detalle !== null}
            onOpenChange={() => setDetalle(null)}
            title={d.data.lista.find(c => c.id === detalle)?.codigo || "Cupón"}
          >
            {d.data.lista.filter(c => c.id === detalle).map(c => <div key={c.id}>
              <dl className="mb-5 grid grid-cols-2 gap-4 text-sm">
                <div><dt className="text-ink-3">Beneficio</dt><dd>{c.tipo === "envio_gratis" ? "Envío gratis" : c.tipo === "porcentaje" ? Number(c.valor) + "%" : pesos(c.valor)}</dd></div>
                <div><dt className="text-ink-3">Estado</dt><dd>{c.activo ? "Activo" : "Pausado"}</dd></div>
                <div><dt className="text-ink-3">Compra mínima</dt><dd>{pesos(c.montoMinimo)}</dd></div>
                <div><dt className="text-ink-3">Usos</dt><dd>{c.usosActuales}{c.limiteUsos ? " / " + c.limiteUsos : ""}</dd></div>
                <div><dt className="text-ink-3">Desde</dt><dd>{c.fechaInicio ? fecha(c.fechaInicio) : "Sin fecha"}</dd></div>
                <div><dt className="text-ink-3">Hasta</dt><dd>{c.fechaFin ? fecha(c.fechaFin) : "Sin vencimiento"}</dd></div>
              </dl>
<div className="mb-6 flex flex-wrap gap-2">

                    <Button
                      variant="secondary"
                      onClick={() =>
                        accion(async () => {
                          await apiLocal(`/codigo-descuento/${c.id}/toggle`,
                            { method: "PUT" },
                          );
                          setDetalle(null);
                          d.recargar();
                        }, "Estado actualizado")
                      }
                    >
                      {c.activo ? "Pausar" : "Activar"}
                    </Button>
                    <>
                        <Button variant="ghost" onClick={() => { setDetalle(null); setEditar(c); }}>
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          className="text-rose-700"
                          onClick={() => { setDetalle(null); setBorrar(c); }}
                        >
                          Eliminar
                        </Button>
                      </>
                  </div>

              <h2 className="mb-4">Resultados</h2>
              <Resultado id={c.id} filtros={filtrosResultados} />
            </div>)}
          </Modal>
          <>
              <Sheet
                open={!!editar}
                onOpenChange={() => setEditar(null)}
                title={`Editar ${editar?.codigo || "cupón"}`}
              >
                {editar && (
                  <EditarCupon
                    key={editar.id}
                    cupon={editar}
                    onGuardado={() => {
                      setEditar(null);
                      d.recargar();
                    }}
                  />
                )}
              </Sheet>
              <Confirmar
                open={!!borrar}
                onOpenChange={(o) => !o && setBorrar(null)}
                title={`¿Eliminar el cupón ${borrar?.codigo}?`}
                text="Deja de servir en la tienda. Si ya se usó en pedidos no se puede borrar: en ese caso, pausalo."
                confirmLabel="Eliminar"
                onConfirm={() => eliminar(borrar!)}
              />
            </>
        </>
      )}
    </>
  );
}
/** Edición de un cupón: los mismos campos que el alta. */
function EditarCupon({
  cupon,
  onGuardado,
}: {
  cupon: CodigoDescuentoGrowth;
  onGuardado: () => void;
}) {
  const [tipo, setTipo] = useState<string>(cupon.tipo);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="grid gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        await accion(async () => {
          await apiLocal(`/codigo-descuento/${cupon.id}`, {
            method: "PUT",
            body: {
              codigo: String(f.get("codigo")).toUpperCase(),
              tipo,
              valor: tipo === "envio_gratis" ? "0" : String(f.get("valor")),
              limiteUsos: f.get("cupo") ? Number(f.get("cupo")) : null,
              montoMinimo: String(f.get("minimo") || "0"),
              fechaInicio: f.get("inicio")
                ? `${f.get("inicio")}T00:00:00-03:00`
                : null,
              fechaFin: f.get("fin") ? `${f.get("fin")}T23:59:59-03:00` : null,
            },
          });
          onGuardado();
        }, "Cupón actualizado");
        setBusy(false);
      }}
    >
      <label>
        Código
        <input
          name="codigo"
          required
          maxLength={50}
          defaultValue={cupon.codigo}
        />
      </label>
      <label>
        Beneficio
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="porcentaje">Porcentaje</option>
          <option value="monto_fijo">Monto fijo</option>
          <option value="envio_gratis">Envío gratis</option>
        </select>
      </label>
      {tipo === "envio_gratis" ? (
        <p className="text-sm text-ink-2">
          Bonifica el costo del envío según la zona. Sólo para delivery; la compra mínima se calcula sin envío.
        </p>
      ) : (
        <label>
          {tipo === "porcentaje" ? "Porcentaje" : "Monto ($)"}
          <input
            name="valor"
            required
            type="number"
            min={1}
            max={tipo === "porcentaje" ? 100 : undefined}
            defaultValue={Number(cupon.valor)}
          />
        </label>
      )}
      <label>
        Usos máximos
        <input
          name="cupo"
          type="number"
          min={1}
          defaultValue={cupon.limiteUsos ?? ""}
        />
      </label>
      <label>
        Compra mínima ($)
        <input
          name="minimo"
          type="number"
          min={0}
          defaultValue={Number(cupon.montoMinimo) || 0}
        />
      </label>
      <label>
        Desde
        <input
          name="inicio"
          type="date"
          defaultValue={diaArgentina(cupon.fechaInicio)}
        />
      </label>
      <label>
        Hasta
        <input
          name="fin"
          type="date"
          defaultValue={diaArgentina(cupon.fechaFin)}
        />
      </label>
      <Button disabled={busy}>{busy ? "Guardando…" : "Guardar cambios"}</Button>
    </form>
  );
}
function Resultado({ id, filtros = "" }: { id: number; filtros?: string }) {
  const l = useLocal();
  const d = useDatos(
    () =>
      datosLocal<ResultadoCupon>(`/codigo-descuento/${id}/resultados${filtros}`,
      ),
    [l.restauranteId, id, filtros],
  );
  return (
    <>
      <Estado loading={d.loading} error={d.error} reintentar={d.recargar} />
      {d.data && (
        <div className="grid gap-4">
          <Stat
            label="Ventas cobradas"
            value={pesos(d.data.metricas.facturacionCobrada)}
          />
          <Stat label="Usos" value={d.data.metricas.usos} />
          <Stat label="Clientes" value={d.data.metricas.clientes} />
          {d.data.clientes.map((c) => (
            <Card key={c.id}>
              <h2>{c.nombre}</h2>
              <p className="muted mt-3">
                {c.usos} usos · {pesos(c.facturacion)} · Último{" "}
                {fecha(c.ultimoUsoAt)}
              </p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
