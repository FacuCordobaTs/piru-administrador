import { SkeletonPantalla } from "../components/SkeletonPantalla";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useLocal } from "../components/Layout";
import { Header, Estado, Empty, Button, Chip } from "../components/ui";
import { FiltrosClientesDialog } from "../components/FiltrosClientes";
import { Paginacion } from "../components/Paginacion";
import { FichaDelCliente } from "../components/clientes/FichaDelCliente";
import { IndicadoresBase } from "../components/clientes/IndicadoresBase";
import { TablaClientes } from "../components/clientes/TablaClientes";
import { datosLocal } from "../lib/api";
import { useDatos } from "../lib/useDatos";
import { useDebounce } from "../lib/useDebounce";
import { sucursalesParaFiltrar, useSucursales } from "../lib/useSucursales";
import {
  FILTROS_CLIENTES_VACIOS,
  consultaClientes,
  contarFiltrosClientes,
  type FiltrosClientes,
  type OrdenClientes,
} from "../lib/filtrosClientes";
import { segmentoNombre } from "../lib/formato";
import type {
  CampanaCrecimiento,
  ClienteGrowth,
  CodigoDescuentoGrowth,
  PaginadoClientes,
  ResumenPuntosData,
} from "../lib/tipos";
const POR_PAGINA = 25;
export function Clientes() {
  return <ClientesContenido />;
}
function ClientesContenido() {
  const l = useLocal();
  const [buscar, setBuscar] = useState("");
  const busqueda = useDebounce(buscar);
  // `?club=1` (desde Puntos) abre la lista ya filtrada a los clientes del club.
  const [params] = useSearchParams();
  const [filtros, setFiltros] = useState<FiltrosClientes>(() => ({
    ...FILTROS_CLIENTES_VACIOS,
    conPuntos: params.get("club") === "1" && l.puntosActivo,
  }));
  const [verFiltros, setVerFiltros] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [cliente, setCliente] = useState<ClienteGrowth | null>(null);
  const sucursales = useSucursales();
  // Cualquier cambio de búsqueda o filtros vuelve a la primera página.
  useEffect(() => setPagina(1), [busqueda, filtros]);
  const d = useDatos(
    () =>
      datosLocal<PaginadoClientes>(`/clientes/list${consultaClientes({ pagina, limite: POR_PAGINA, busqueda, filtros })}`,
      ),
    [l.restauranteId, pagina, busqueda, filtros],
    { conservar: true },
  );
  // Los números del club, para la franja de arriba. Sin Puntos no hay club.
  const club = useDatos(
    async () =>
      l.puntosActivo
        ? await datosLocal<ResumenPuntosData>("/puntos/resumen",
          ).catch(() => null)
        : null,
    [l.restauranteId, l.puntosActivo],
  );
  // Las campañas y los cupones para filtrar.
  const referencias = useDatos(
    async () => ({
      campanas:
        l.crecimientoActivo
          ? await datosLocal<CampanaCrecimiento[]>("/marketing/campanas",
            ).catch(() => [])
          : [],
      cupones:
        l.codigosDescuentoActivo
          ? await datosLocal<CodigoDescuentoGrowth[]>("/codigo-descuento",
            ).catch(() => [])
          : [],
    }),
    [l.restauranteId],
  );
  const cambiar = (parcial: Partial<FiltrosClientes>) =>
    setFiltros((f) => ({ ...f, ...parcial }));
  const cantidadFiltros = contarFiltrosClientes(filtros);
  const nombreSucursal = (id?: number | null) =>
    sucursales.length > 1 ? sucursales.find((s) => s.id === id)?.nombre : null;
  const pag = d.data;
  // Si se borró al último cliente de la última página, se vuelve a la anterior.
  useEffect(() => {
    if (pag && !pag.items.length && pag.total > 0 && pagina > 1)
      setPagina(Math.max(1, pag.paginas));
  }, [pag, pagina]);
  const hayFiltros = cantidadFiltros > 0 || busqueda.trim() !== "";
  return (
    <>
      <Header
        title="Tus clientes, con nombre"
        sub="Conocé sus hábitos y qué los hace volver."
        ayuda={{ seccion: "segmentos", texto: "Qué quiere decir cada segmento" }}
      />
      {pag && (
        <IndicadoresBase
          resumen={pag.resumen}
          nuevos30d={l.clientesNuevos30d}
          club={club.data ?? null}
        />
      )}
      <div className="mb-3 flex gap-3">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Buscar</span>
          <Search
            size={18}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-3"
          />
          <input
            type="search"
            className="w-full pl-11"
            placeholder="Buscar por nombre, teléfono, dirección, campaña o cupón"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
          />
        </label>
        <Button
          variant="secondary"
          className="shrink-0"
          onClick={() => setVerFiltros(true)}
        >
          <SlidersHorizontal size={16} />
          {cantidadFiltros ? `Filtros · ${cantidadFiltros}` : "Filtros"}
        </Button>
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {l.puntosActivo && (
          <>
            <Chip
              className="min-h-9"
              activo={!filtros.conPuntos}
              onClick={() => cambiar({ conPuntos: false })}
            >
              Todos
            </Chip>
            <Chip
              className="min-h-9"
              activo={filtros.conPuntos}
              onClick={() => cambiar({ conPuntos: true })}
            >
              Del club
            </Chip>
          </>
        )}
        {filtros.segmento && (
          <span className="inline-flex min-h-9 items-center gap-1 rounded-full bg-sand px-3 text-sm font-medium">
            {segmentoNombre[filtros.segmento]}
            <button
              type="button"
              aria-label="Quitar el filtro de segmento"
              onClick={() => cambiar({ segmento: "" })}
            >
              <X size={14} />
            </button>
          </span>
        )}
        {cantidadFiltros > 0 && (
          <Button
            variant="ghost"
            className="min-h-9 px-3 text-sm"
            onClick={() => setFiltros(FILTROS_CLIENTES_VACIOS)}
          >
            Limpiar filtros
          </Button>
        )}
        {pag && (
          <p className="muted ml-auto tabular-nums">
            {pag.total} {pag.total === 1 ? "cliente" : "clientes"}
          </p>
        )}
      </div>
      <Estado
        skeleton={<SkeletonPantalla tipo="clientes" />}
        loading={d.loading && !pag}
        error={d.error}
        reintentar={d.recargar}
      />
      {pag && !pag.items.length && pag.total === 0 && (
        <Empty
          title={
            hayFiltros
              ? "No hay clientes con estos filtros"
              : "Todavía no hay clientes acá"
          }
          text={
            hayFiltros
              ? "Probá con otra búsqueda o limpiá los filtros."
              : "Cada pedido de la tienda suma un cliente a la base."
          }
        />
      )}
      {pag && pag.items.length > 0 && (
        <>
          <TablaClientes
            clientes={pag.items}
            orden={filtros.orden}
            onOrden={(orden: OrdenClientes) => cambiar({ orden })}
            club={l.puntosActivo}
            cargando={d.loading}
            onElegir={setCliente}
          />
          <Paginacion
            pagina={pag.pagina}
            paginas={pag.paginas}
            total={pag.total}
            limite={pag.limite}
            nombre="clientes"
            onCambiar={setPagina}
          />
        </>
      )}
      <FiltrosClientesDialog
        open={verFiltros}
        onOpenChange={setVerFiltros}
        filtros={filtros}
        onChange={setFiltros}
        sucursales={sucursalesParaFiltrar(sucursales)}
        campanas={referencias.data?.campanas ?? []}
        cupones={referencias.data?.cupones ?? []}
        total={pag?.total ?? 0}
        club={l.puntosActivo}
      />
      <FichaDelCliente
        cliente={cliente}
        club={l.puntosActivo}
        nombreSucursal={nombreSucursal}
        onCerrar={() => setCliente(null)}
        onCambio={(actualizado) => {
          if (actualizado) setCliente(actualizado);
          d.recargar();
          club.recargar();
        }}
      />
    </>
  );
}
