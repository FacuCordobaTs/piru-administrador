import { SkeletonPantalla } from "../components/SkeletonPantalla";
import { useState } from "react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { useLocal } from "../components/Layout";
import { BloqueoModulo, useModulo } from "../components/Modulo";
import {
  Button,
  Card,
  Header,
  Empty,
  Estado,
  Sheet,
  CopyButton,
  Confirmar,
  accion,
} from "../components/ui";
import { apiLocal, datosLocal, query } from "../lib/api";
import { useDatos } from "../lib/useDatos";
import { sucursalesParaFiltrar, useSucursales } from "../lib/useSucursales";
import {
  FILTROS_CAMPANAS_VACIOS,
  esCampanaDelMotor,
  filtrarCampanas,
  type FiltrosCampanas,
} from "../lib/filtrosListas";
import { pesos, rangoConHora, hoyArgentina, fecha } from "../lib/formato";
import type {
  CampanaCrecimiento,
  CrearCampanaCrecimiento,
  CategoriaCampana,
  ConfiguracionPuntosData,
  ProductoGrowth,
  ResumenCrecimiento,
} from "../lib/tipos";
import { PortalMarketing } from "../components/portal";
const categorias: Record<CategoriaCampana, string> = {
  historias_instagram: "Historias de Instagram",
  reels_tiktok: "Reels y TikTok",
  pauta_digital: "Pauta digital",
  qr_salon_mostrador: "QR del local",
  volantes_packaging: "Volantes y packaging",
  whatsapp_difusion: "Estado de WhatsApp",
  influencers_colaboraciones: "Colaboraciones",
};
export function Campanas() {
  const mod = useModulo("crecimiento");
  return (
    <>
      {mod.loading || mod.error ? (
        <Estado
          skeleton={<SkeletonPantalla tipo="campanas" />}
          loading={mod.loading}
          error={mod.error}
          reintentar={mod.recargar}
        />
      ) : mod.modulo?.activoAhora ? (
        <CampanasContenido />
      ) : (
        <>
          <Header
            title="Cada historia, su link"
            ayuda={{ seccion: "campanas", texto: "Cómo se mide un link" }}
          />
          <BloqueoModulo codigo="crecimiento" nombre="Campañas" />
        </>
      )}
    </>
  );
}
function CampanasContenido() {
  const l = useLocal();
  const [search, setSearch] = useSearchParams();
  const [periodo, setPeriodo] = useState(30);
  const [open, setOpen] = useState(!!l.baseTienda && search.has("nuevo"));
  const [editar, setEditar] = useState<CampanaCrecimiento | null>(null);
  const [link, setLink] = useState("");
  const [detalleId, setDetalleId] = useState<number | null>(null);
  const sucursales = sucursalesParaFiltrar(
    useSucursales(),
  );
  const [sucursalId, setSucursalId] = useState<number | null>(null);
  const [filtrosC, setFiltrosC] = useState<FiltrosCampanas>(
    FILTROS_CAMPANAS_VACIOS,
  );
  const [borrar, setBorrar] = useState<CampanaCrecimiento | null>(null);
  const { data, error, loading, recargar } = useDatos(async () => {
    const filtros = query({ ...rangoConHora(periodo), sucursalId });
    const [campanas, resumen, organico, productos] = await Promise.all([
      datosLocal<CampanaCrecimiento[]>("/marketing/campanas"),
      datosLocal<ResumenCrecimiento>(`/marketing/resumen${filtros}`,
      ),
      datosLocal<ResumenCrecimiento>(`/marketing/organico/resultados${filtros}`,
      ),
      apiLocal<{ productos: ProductoGrowth[] }>("/producto"),
    ]);
    const puntos = await datosLocal<ConfiguracionPuntosData>("/puntos/config",
    ).catch(() => null);
    return { campanas, resumen, organico, productos: productos.productos, puntos };
  }, [l.restauranteId, periodo, sucursalId]);
  const filas = data?.campanas.map((c) => ({
    c,
    m: data.resumen.campanas.find((r) => r.id === c.id)?.metricas,
  }));
  const ranked = filas && filtrarCampanas(
    filas.map((f) => ({ ...f, ventas: f.m?.ventas ?? 0, clientesNuevos: f.m?.clientesNuevos ?? 0 })),
    filtrosC,
  );
  const maxNuevos = Math.max(0, ...(ranked ?? []).filter(({ c }) => !esCampanaDelMotor(c)).map(({ clientesNuevos }) => clientesNuevos));
  const lideres = maxNuevos > 0 ? ranked?.filter(({ c, clientesNuevos }) => !esCampanaDelMotor(c) && clientesNuevos === maxNuevos) ?? [] : [];
  const esLider = (id: number) => lideres.some(({ c }) => c.id === id);
  async function eliminar(c: CampanaCrecimiento) {
    try {
      const r = await apiLocal<{ desactivada?: boolean }>(`/marketing/campanas/${c.id}`,
        { method: "DELETE" },
      );
      toast.success(
        r.desactivada
          ? "Ya tenía ventas: la desactivamos para conservar sus resultados"
          : "Campaña eliminada",
      );
      setDetalleId(null);
      recargar();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No pudimos eliminar la campaña.",
      );
    }
  }
  return (
    <>
      <Header
        title="Cada historia, su link"
        sub="Medí qué campañas traen clientes nuevos y ventas cobradas."
        ayuda={{ seccion: "campanas", texto: "Cómo se mide un link" }}
      >
        <Button
          disabled={!l.baseTienda}
          onClick={() => {
            setEditar(null);
            setOpen(true);
          }}
        >
          Nuevo link
        </Button>
      </Header>
      {!l.baseTienda && (
        <p role="status" className="card mb-5">
          Configurá tu tienda desde el panel de Piru para compartir links.
        </p>
      )}
      <label className="mb-5 max-w-xs">
        Período
        <select
          value={periodo}
          onChange={(e) => setPeriodo(Number(e.target.value))}
        >
          <option value={7}>Últimos 7 días</option>
          <option value={30}>Últimos 30 días</option>
          <option value={90}>Últimos 90 días</option>
        </select>
      </label>
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label>
            Estado
            <select
              value={filtrosC.estado}
              onChange={(e) =>
                setFiltrosC({
                  ...filtrosC,
                  estado: e.target.value as FiltrosCampanas["estado"],
                })
              }
            >
              <option value="todas">Todas</option>
              <option value="activas">Activas</option>
              <option value="inactivas">Pausadas o en borrador</option>
            </select>
          </label>
          <label>
            Destino
            <select
              value={filtrosC.tipo}
              onChange={(e) =>
                setFiltrosC({
                  ...filtrosC,
                  tipo: e.target.value as FiltrosCampanas["tipo"],
                })
              }
            >
              <option value="todos">Todos</option>
              <option value="tienda">Tienda</option>
              <option value="producto">Producto y oferta</option>
              <option value="carrito">Carrito armado</option>
            </select>
          </label>
          <label>
            Ordenar por
            <select
              value={filtrosC.orden}
              onChange={(e) =>
                setFiltrosC({
                  ...filtrosC,
                  orden: e.target.value as FiltrosCampanas["orden"],
                })
              }
            >
              <option value="clientes_nuevos">Más clientes nuevos</option>
              <option value="ventas">Más ventas</option>
              <option value="recientes">Más recientes</option>
              <option value="compras">Más compras</option>
              <option value="visitas">Más visitas</option>
              <option value="nombre">Alfabético (A → Z)</option>
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
      <Estado skeleton={<SkeletonPantalla tipo="campanas" />} loading={loading} error={error} reintentar={recargar} />
      {data && (
        <>
          {link && (
            <Card className="mb-5 bg-brand-soft">
              <h2>Pegalo en el sticker de link de tu historia</h2>
              <p className="my-4 break-all text-lg font-semibold">{link}</p>
              <CopyButton value={link} />
            </Card>
          )}
          {!ranked?.length ? (
            <Empty
              title="Todavía no hay campañas"
              text="Creá un link para tu próxima historia."
            >
              <Button disabled={!l.baseTienda} onClick={() => setOpen(true)}>
                Crear un link
              </Button>
            </Empty>
          ) : (
            <div className="lista-sombra overflow-x-auto rounded-[20px] bg-surface" role="region" aria-label="Listado de campañas" tabIndex={0}>
              <table className="w-full min-w-[1050px] table-fixed text-sm">
                <colgroup><col className="w-[22%]" /><col className="w-[18%]" />{[1, 2, 3, 4, 5].map((i) => <col key={i} className="w-[12%]" />)}</colgroup>
                <caption className="sr-only">Campañas · resultados de los últimos {periodo} días</caption>
                <thead>
                  <tr className="text-xs font-medium text-ink-3">
                    {["Nombre", "Clientes nuevos", "Ventas cobradas", "Visitas", "Pedidos", "Inversión", "Retorno neto"].map((nombre, i) => (
                      <th key={nombre} scope="col" className={`px-4 py-4 ${i === 1 ? "font-bold text-ink" : "font-medium"} ${i <= 1 ? "text-left" : "text-right"}`}>{nombre}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ranked.map(({ c, m }) => (
                    <Dialog.Root key={c.id} open={detalleId === c.id} onOpenChange={(abierto) => setDetalleId(abierto ? c.id : null)}>
                      <tr className={`cursor-pointer transition-colors ${esLider(c.id) ? "campana-lider" : "hover:bg-sand/50"}`} onClick={() => setDetalleId(c.id)}>
                        <th scope="row" className="min-w-[220px] px-4 py-4 text-left font-semibold">
                          <Dialog.Trigger asChild>
                            <button type="button" className="w-full rounded-lg text-left break-words" aria-label={`Ver campaña ${c.nombre}`}>{c.nombre}</button>
                          </Dialog.Trigger>
                        </th>
                        <td className="px-4 py-4 text-left font-bold tabular-nums">{m?.clientesNuevos ?? "—"}</td>
                        {[
                          m ? pesos(m.ventas) : "—",
                          m ? m.visitas ?? m.sesiones : "—",
                          m?.pedidos ?? "—",
                          m ? pesos(m.inversionManual) : "—",
                          m ? pesos(m.retorno) : "—",
                        ].map((valor, i) => <td key={i} className="px-4 py-4 text-right whitespace-nowrap tabular-nums">{valor}</td>)}
                      </tr>
                      <PortalMarketing>
                        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
                        <Dialog.Content aria-describedby={undefined} className="campana-compacta fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[calc(100%-32px)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl bg-surface p-5 shadow-xl sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Dialog.Title className="text-xl font-bold leading-snug break-words">{c.nombre}</Dialog.Title>
                      <p className="muted mt-1">{c.categoria ? categorias[c.categoria] : "Link de campaña"} · {esCampanaDelMotor(c) ? "motor de recompra" : "adquisición"}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-full bg-sand px-2.5 py-1 text-xs font-medium">{c.estado}</span>
                      <Dialog.Close asChild><Button type="button" variant="ghost" className="px-3" aria-label="Cerrar"><X size={20} /></Button></Dialog.Close>
                    </div>
                  </div>
                  <section aria-label="Adquisición de clientes" className="mt-4">
                    <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
                      <div>
                        <h3 className="text-sm font-semibold">Clientes nuevos</h3>
                        <p className="mt-1 text-lg font-bold tabular-nums">{m?.clientesNuevos ?? "—"}</p>
                      </div>
                      <div className="pb-1 text-sm">
                        <p><span className="font-semibold tabular-nums">{m?.clientesRecurrentes ?? "—"}</span> {m?.clientesRecurrentes === 1 ? "cliente recurrente" : "clientes recurrentes"}</p>
                        {m && m.clientesNuevos + m.clientesRecurrentes > 0 && <p className="muted mt-1">El {Math.round(m.clientesNuevos / (m.clientesNuevos + m.clientesRecurrentes) * 100)}% de quienes compraron son nuevos.</p>}
                      </div>
                    </div>
                    <p className="muted mt-3">Primera compra pagada en el local, atribuida a esta campaña durante los últimos {periodo} días. Cada cliente se cuenta una sola vez.</p>
                  </section>
                  <dl className="campana-resultados mt-4 rounded-xl bg-sand/60" aria-label={`Resultados de ${c.nombre} · últimos ${periodo} días`}>
                    {[
                      ["Ventas cobradas", m ? pesos(m.ventas) : "—"],
                      ["Visitas", m ? m.visitas ?? m.sesiones : "—"],
                      ["Pedidos", m?.pedidos ?? "—"],
                      ["Inversión", m ? pesos(m.inversionManual) : "—"],
                      ["Retorno neto", m ? pesos(m.retorno) : "—"],
                    ].map(([nombre, valor], i) => <div key={nombre} className={i === 0 ? "campana-venta" : ""}>
                      <dt className="label">{nombre}</dt>
                      <dd className={`mt-1 font-semibold tabular-nums ${i === 0 ? "text-2xl" : "text-lg"}`}>{valor}</dd>
                    </div>)}
                  </dl>
                  <dl className="grid gap-x-6 gap-y-3 mt-4 text-sm sm:grid-cols-3">
                    <div><dt className="label">Destino</dt><dd className="mt-1 text-ink-2">{destinoCampana(c, data.productos)}</dd></div>
                    <div><dt className="label">Vigencia</dt><dd className="mt-1 text-ink-2">{c.fechaInicio ? `Desde ${fecha(c.fechaInicio)}` : "Sin fecha de inicio"}{c.fechaFin ? ` · Hasta ${fecha(c.fechaFin)}` : " · Sin vencimiento"}</dd></div>
                    <div><dt className="label">Beneficio y usos</dt><dd className="mt-1 text-ink-2">{c.beneficioTipo === "puntos" ? `+${c.puntosBeneficio ?? 0} puntos desde $${Number(c.puntosMontoMinimo ?? 0).toLocaleString("es-AR")}${c.puntosLimiteOtorgamientos != null ? ` · hasta ${c.puntosLimiteOtorgamientos} pedidos` : ""}` : c.descuentoProductoPorcentaje ? `${c.descuentoProductoPorcentaje}% de descuento` : c.codigoDescuentoId ? "Cupón vinculado" : "Sin descuento"} · {c.usosActuales ?? 0}{c.limiteUsos != null ? ` de ${c.limiteUsos} usos` : " usos · Sin límite"}</dd></div>
                  </dl>
                  {m && <p className="mt-3 text-xs text-ink-3">Retorno neto: ventas atribuidas menos inversión, descuentos y costo de mensajes.</p>}
                  {l.baseTienda && !esCampanaDelMotor(c) && <div className="mt-3 flex min-w-0 items-center gap-2 border-t border-line pt-3">
                    <span className="label shrink-0">Link</span>
                    <span className="truncate text-xs text-ink-2" title={`${l.baseTienda.replace(/\/$/, "")}/c/${c.slug}`}>{l.baseTienda.replace(/\/$/, "")}/c/{c.slug}</span>
                  </div>}
                  {[c.utmSource, c.utmMedium, c.utmCampaign, c.utmTerm, c.utmContent].some(Boolean) && <p className="mt-2 text-xs text-ink-3 [overflow-wrap:anywhere]">Seguimiento: {[c.utmSource, c.utmMedium, c.utmCampaign, c.utmTerm, c.utmContent].filter(Boolean).join(" · ")}</p>}
                  {esCampanaDelMotor(c) ? (
                    <p className="muted mt-2">
                      La usa el motor de recompra: arma un link distinto para
                      cada cliente, así que no se comparte ni se edita.
                    </p>
                  ) : (
                    <div className="mt-2 flex gap-1 flex-wrap">
                      {l.baseTienda && (
                        <CopyButton
                          value={`${l.baseTienda.replace(/\/$/, "")}/c/${c.slug}`}
                        />
                      )}
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setDetalleId(null);
                          setEditar(c);
                          setOpen(true);
                        }}
                      >
                        Editar
                      </Button>
                      {c.estado === "activa" && (
                        <Button
                          variant="ghost"
                          onClick={() =>
                            accion(async () => {
                              await apiLocal(`/marketing/campanas/${c.id}/desactivar`,
                                { method: "POST" },
                              );
                              setDetalleId(null);
                              recargar();
                            }, "Campaña desactivada")
                          }
                        >
                          Desactivar
                        </Button>
                      )}
                      <Button
                          variant="ghost"
                          className="text-rose-700"
                          onClick={() => setBorrar(c)}
                        >
                          Eliminar
                        </Button>
                    </div>
                  )}
                        </Dialog.Content>
                      </PortalMarketing>
                    </Dialog.Root>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 lista-sombra overflow-x-auto rounded-[20px] bg-surface" role="region" aria-label="Resultados orgánicos" tabIndex={0}>
            <table className="w-full min-w-[1050px] table-fixed text-sm">
                <colgroup><col className="w-[22%]" /><col className="w-[18%]" />{[1, 2, 3, 4, 5].map((i) => <col key={i} className="w-[12%]" />)}</colgroup>
              <caption className="sr-only">Orgánico · sin campaña · últimos {periodo} días</caption>
              <thead className="sr-only"><tr>{["Nombre", "Clientes nuevos", "Ventas cobradas", "Visitas", "Pedidos", "Inversión", "Retorno neto"].map((nombre) => <th key={nombre} scope="col">{nombre}</th>)}</tr></thead>
              <tbody><tr>
                <th scope="row" className="min-w-[220px] px-4 py-4 text-left font-semibold">Orgánico · sin campaña</th>
                <td className="px-4 py-4 text-left font-bold tabular-nums">{data.organico.metricas.clientesNuevos ?? "—"}</td>
                {[
                  pesos(data.organico.metricas.ventas),
                  data.organico.metricas.visitas ?? data.organico.metricas.sesiones ?? "—",
                  data.organico.metricas.pedidos,
                  "—",
                  "—",
                ].map((valor, i) => <td key={i} className="px-4 py-4 text-right whitespace-nowrap tabular-nums">{valor}</td>)}
              </tr></tbody>
            </table>
          </div>
          <Sheet
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (!o) setSearch({});
            }}
            title={editar ? "Editar link" : "Nuevo link"}
          >
            <FormCampana
              key={editar?.id || "new"}
              productos={data.productos}
              puntos={data.puntos}
              editando={editar}
              fechaDia={search.get("fecha") || ""}
              diaInicial={search.has("diaSemana") ? Number(search.get("diaSemana")) : null}
              onSave={(c) => {
                setLink(
                  `${l.baseTienda?.replace(/\/$/, "") || ""}/c/${c.slug}`,
                );
                setOpen(false);
                setSearch({});
                recargar();
              }}
            />
          </Sheet>
          <Confirmar
              open={!!borrar}
              onOpenChange={(o) => !o && setBorrar(null)}
              title={`¿Eliminar «${borrar?.nombre}»?`}
              text="Si ya trajo ventas, en lugar de borrarla la desactivamos, para no perder sus resultados."
              confirmLabel="Eliminar"
              onConfirm={() => eliminar(borrar!)}
            />
        </>
      )}
    </>
  );
}
function destinoCampana(c: CampanaCrecimiento, productos: ProductoGrowth[]): string {
  const nombre = (id: number) => productos.find((p) => p.id === id)?.nombre || `Producto #${id}`;
  if (c.destinoTipo === "producto") return c.productoId ? nombre(c.productoId) : "Producto y oferta";
  if (c.destinoTipo !== "carrito") return "Tienda completa";
  try {
    const items: { p: number; q: number }[] = c.carritoRep?.startsWith("v2:")
      ? JSON.parse(c.carritoRep.slice(3))
      : (c.carritoRep || "").split("-").filter(Boolean).map((item) => { const [p, q] = item.split("x").map(Number); return { p, q }; });
    return items.length ? items.map((item) => `${item.q} × ${nombre(item.p)}`).join(" · ") : "Carrito armado";
  } catch { return "Carrito armado"; }
}
function FormCampana({
  productos,
  puntos,
  editando,
  fechaDia,
  diaInicial,
  onSave,
}: {
  productos: ProductoGrowth[];
  puntos: ConfiguracionPuntosData | null;
  editando: CampanaCrecimiento | null;
  fechaDia: string;
  diaInicial: number | null;
  onSave: (c: CampanaCrecimiento) => void;
}) {
  const [tipo, setTipo] = useState(editando?.destinoTipo || "tienda");
  const [beneficio, setBeneficio] = useState<"ninguno" | "descuento" | "puntos">(
    editando?.beneficioTipo === "puntos"
      ? "puntos"
      : editando?.destinoTipo === "producto" && editando?.descuentoProductoPorcentaje
        ? "descuento"
        : "ninguno",
  );
  const [puntosBeneficio, setPuntosBeneficio] = useState(
    editando?.puntosBeneficio || 100,
  );
  const [puntosMinimo, setPuntosMinimo] = useState(
    Number(editando?.puntosMontoMinimo || 0),
  );
  const clubActivo = puntos?.activo === true;
  const valorPunto = (() => {
    if (!puntos) return 1;
    const costo = Number(puntos.descuentoPuntosCosto || 0);
    const valor = Number(puntos.descuentoValor || 0);
    return puntos.permiteCanjeDescuento && puntos.descuentoTipo === "fijo" && costo > 0 && valor > 0
      ? valor / costo
      : 1;
  })();
  const topePorcentaje = Number(puntos?.puntosBonusTopePorcentaje || 12);
  const maxPuntosPorMinimo = puntosMinimo > 0
    ? Math.min(
        Number(puntos?.puntosBonusMaximo || 500),
        Math.floor((puntosMinimo * topePorcentaje / 100) / valorPunto),
      )
    : 0;
  const [cart, setCart] = useState<
    { p: number; q: number; v?: number; s?: number }[]
  >(() => {
    try {
      return editando?.carritoRep?.startsWith("v2:")
        ? JSON.parse(editando.carritoRep.slice(3))
        : editando?.carritoRep &&
            /^\d+x\d+(?:-\d+x\d+)*$/.test(editando.carritoRep)
          ? editando.carritoRep.split("-").map((part) => {
              const [p, q] = part.split("x").map(Number);
              return { p, q };
            })
          : [];
    } catch {
      return [];
    }
  });
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="grid gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const nombre = String(f.get("nombre"));
        const inicio = String(f.get("fechaInicio"));
        const fin = String(f.get("fechaFin"));
        const descuento = Number(f.get("descuento"));
        const esPuntos = beneficio === "puntos";
        const body: CrearCampanaCrecimiento = {
          diaSemana: f.get("diaSemana") === "" ? null : Number(f.get("diaSemana")),
          slug:
            String(f.get("slug")) ||
            nombre
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, ""),
          nombre,
          tipo: editando?.tipo || "adquisicion",
          categoria: String(f.get("categoria")) as CategoriaCampana,
          estado: String(f.get("estado")) as CampanaCrecimiento["estado"],
          destinoTipo: tipo,
          productoId: tipo === "producto" ? Number(f.get("productoId")) : null,
          carritoRep: tipo === "carrito" ? `v2:${JSON.stringify(cart)}` : null,
          beneficioTipo: esPuntos ? "puntos" : "descuento",
          puntosBeneficio: esPuntos ? puntosBeneficio : 0,
          puntosMontoMinimo: esPuntos ? puntosMinimo : 0,
          puntosLimiteOtorgamientos:
            esPuntos && f.get("puntosCupo")
              ? Number(f.get("puntosCupo"))
              : null,
          puntosLimitePorCliente:
            esPuntos && f.get("puntosPorCliente")
              ? Number(f.get("puntosPorCliente"))
              : 1,
          descuentoProductoPorcentaje:
            tipo === "producto" && beneficio === "descuento" ? descuento : 0,
          limiteUsos:
            beneficio === "descuento" && f.get("cupo")
              ? Number(f.get("cupo"))
              : null,
          fechaInicio: inicio ? `${inicio}T00:00:00-03:00` : null,
          fechaFin: fin ? `${fin}T23:59:59-03:00` : null,
          inversionManual: Number(f.get("inversion") || 0),
        };
        setBusy(true);
        await accion(async () => {
          const c = await datosLocal<CampanaCrecimiento>(editando
              ? `/marketing/campanas/${editando.id}`
              : "/marketing/campanas",
            {
              method: editando ? "PUT" : "POST",
              body: editando
                ? (({ slug: _slug, ...edit }) => edit)(body)
                : body,
            },
          );
          onSave(c);
        }, "Link guardado");
        setBusy(false);
      }}
    >
      <label>
        Nombre
        <input
          name="nombre"
          required
          defaultValue={
            editando?.nombre ||
            `Historia ${hoyArgentina().split("-").reverse().slice(0, 2).join("/")}`
          }
        />
      </label>
      {!editando && (
        <label>
          Dirección del link
          <input
            name="slug"
            pattern="[a-z0-9-]+"
            placeholder="historia-martes"
          />
          <span className="muted">Si lo dejás vacío, usamos el nombre.</span>
        </label>
      )}
      <label>
        Canal
        <select
          name="categoria"
          defaultValue={editando?.categoria || "historias_instagram"}
        >
          {Object.entries(categorias).map(([id, n]) => (
            <option value={id} key={id}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label>
        Destino
        <select
          value={tipo}
          onChange={(e) => {
            const nuevo = e.target.value as typeof tipo;
            setTipo(nuevo);
            if (nuevo !== "producto" && beneficio === "descuento") {
              setBeneficio("ninguno");
            }
          }}
        >
          <option value="tienda">Tienda</option>
          <option value="producto">Producto y oferta</option>
          <option value="carrito">Carrito armado</option>
        </select>
      </label>
      {tipo === "producto" && (
        <label>
          Producto
          <select
            name="productoId"
            required
            defaultValue={editando?.productoId || ""}
          >
            <option value="">Elegí un producto</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Beneficio del link
        <select
          value={beneficio}
          onChange={(e) => {
            const valor = e.target.value as typeof beneficio;
            setBeneficio(valor);
            if (valor === "puntos" && puntosMinimo <= 0) {
              setPuntosMinimo(
                Math.max(1000, Math.ceil((puntosBeneficio * valorPunto) / (topePorcentaje / 100) / 100) * 100),
              );
            }
          }}
        >
          <option value="ninguno">Sin beneficio: sólo medir el link</option>
          {tipo === "producto" && (
            <option value="descuento">Descuento en el producto</option>
          )}
          <option value="puntos" disabled={!clubActivo}>
            Puntos extra al cobrarse el pedido
          </option>
        </select>
        {beneficio === "puntos" && !clubActivo && (
          <span className="muted text-sm">
            El Club de Puntos está pausado o no está disponible: activalo para
            usar este beneficio.
          </span>
        )}
      </label>
      {tipo === "producto" && beneficio === "descuento" && (
        <>
          <label>
            Descuento (%)
            <input
              name="descuento"
              type="number"
              min={0}
              max={100}
              defaultValue={editando?.descuentoProductoPorcentaje || 0}
            />
          </label>
          <label>
            Cupo de usos
            <input
              name="cupo"
              type="number"
              min={1}
              defaultValue={editando?.limiteUsos || ""}
            />
          </label>
        </>
      )}
      {beneficio === "puntos" && (
        <div className="grid gap-4 rounded-2xl bg-brand-soft p-4 sm:grid-cols-2">
          <label>
            Puntos extra
            <input
              type="number"
              min={1}
              max={Number(puntos?.puntosBonusMaximo || 500)}
              value={puntosBeneficio}
              onChange={(e) => setPuntosBeneficio(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
          <label>
            Compra mínima ($)
            <input
              type="number"
              min={1}
              value={puntosMinimo}
              onChange={(e) => setPuntosMinimo(Math.max(0, Number(e.target.value) || 0))}
            />
          </label>
          <label>
            Máximo de pedidos que lo reciben
            <input
              name="puntosCupo"
              type="number"
              min={1}
              defaultValue={editando?.puntosLimiteOtorgamientos || ""}
            />
            <span className="muted text-sm">Vacío = sin límite total.</span>
          </label>
          <label>
            Veces por cliente
            <input
              name="puntosPorCliente"
              type="number"
              min={1}
              max={50}
              defaultValue={editando?.puntosLimitePorCliente || 1}
            />
          </label>
          <p className="muted text-sm sm:col-span-2">
            El bonus se acredita cuando el pedido se cobra. Con esta compra
            mínima, el sistema admite hasta {maxPuntosPorMinimo.toLocaleString("es-AR")} puntos
            {puntosBeneficio > maxPuntosPorMinimo
              ? `: los ${puntosBeneficio.toLocaleString("es-AR")} se ajustan al cobrar para no superar el ${topePorcentaje}% del ticket.`
              : ` y cuida que no valgan más que el ${topePorcentaje}% del pedido.`}
          </p>
        </div>
      )}
      {tipo === "carrito" && (
        <div className="grid gap-3">
          <p className="text-sm font-semibold">Productos del carrito</p>
          {cart.map((item, i) => {
            const p = productos.find((p) => p.id === item.p);
            return (
              <div
                key={i}
                className="rounded-xl border border-line p-3 grid gap-2"
              >
                <div className="flex items-center gap-3">
                  <span className="flex-1 text-sm">{p?.nombre}</span>
                  <input
                    aria-label={`Cantidad de ${p?.nombre}`}
                    className="w-20"
                    type="number"
                    min={1}
                    max={99}
                    value={item.q}
                    onChange={(e) =>
                      setCart((c) =>
                        c.map((it, j) =>
                          j === i ? { ...it, q: Number(e.target.value) } : it,
                        ),
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setCart((c) => c.filter((_, j) => j !== i))}
                  >
                    Sacar
                  </Button>
                </div>
                {p?.variantes?.length ? (
                  <label>
                    Variante
                    <select
                      required
                      value={item.v || ""}
                      onChange={(e) =>
                        setCart((c) =>
                          c.map((it, j) =>
                            j === i ? { ...it, v: Number(e.target.value) } : it,
                          ),
                        )
                      }
                    >
                      <option value="">Elegí</option>
                      {p.variantes.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {p?.variantesSecundarias?.length ? (
                  <label>
                    Segunda variante
                    <select
                      required
                      value={item.s || ""}
                      onChange={(e) =>
                        setCart((c) =>
                          c.map((it, j) =>
                            j === i ? { ...it, s: Number(e.target.value) } : it,
                          ),
                        )
                      }
                    >
                      <option value="">Elegí</option>
                      {p.variantesSecundarias.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
            );
          })}
          <select
            aria-label="Agregar un producto"
            value=""
            onChange={(e) => {
              setCart((c) => [...c, { p: Number(e.target.value), q: 1 }]);
            }}
          >
            <option value="">Agregar producto…</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
      )}
      <label>Día exclusivo de la semana<select name="diaSemana" defaultValue={editando?.diaSemana ?? diaInicial ?? ""}>
        <option value="">Todos los días</option>{["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"].map((dia, i) => <option key={dia} value={i}>{dia}</option>)}
      </select><span className="muted text-sm">El mismo link se puede compartir cada semana. Fuera del día elegido abre la tienda sin activar la campaña.</span></label>
      <div className="grid grid-cols-2 gap-3">
        <label>
          Desde
          <input
            name="fechaInicio"
            type="date"
            defaultValue={fechaDia || editando?.fechaInicio?.slice(0, 10) || ""}
          />
        </label>
        <label>
          Hasta
          <input
            name="fechaFin"
            type="date"
            defaultValue={fechaDia || editando?.fechaFin?.slice(0, 10) || ""}
          />
        </label>
      </div>
      <label>
        Inversión en pauta ($)
        <input
          type="number"
          name="inversion"
          min={0}
          defaultValue={Number(editando?.inversionManual || 0)}
        />
      </label>
      <label>
        Estado
        <select name="estado" defaultValue={editando?.estado || "activa"}>
          <option value="activa">Activa</option>
          <option value="borrador">Borrador</option>
          <option value="inactiva">Inactiva</option>
        </select>
      </label>
      <Button
        disabled={busy || (tipo === "carrito" && !cart.length)}
        className="sticky bottom-0"
      >
        {busy ? "Guardando…" : "Guardar link"}
      </Button>
    </form>
  );
}
