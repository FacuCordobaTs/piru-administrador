import { createContext, lazy, Suspense, useContext, useEffect, useState, type ReactNode } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { BookOpen, CirclePlay } from "lucide-react";
import type { LocalMarketing } from "../lib/tipos";
import { localApi } from "../lib/api";
import { GUIA } from "../lib/rutas";
import { useRecorrido } from "../store/recorrido";
import { useDatos } from "../lib/useDatos";
import { Estado } from "./ui";
import { RaizMarketing } from "./portal";
import "../marketing.css";

const Context = createContext<{
  local: LocalMarketing;
  recargar: () => void;
} | null>(null);

/** El local de la sesión, con su tarjeta: ventas, módulos, día más flojo y mensajes de hoy. */
export const useLocal = () => {
  const c = useContext(Context);
  if (!c) throw new Error("Local no disponible");
  return c.local;
};

/** Vuelve a pedir la tarjeta del local (por ejemplo, después de activar un módulo). */
export const useRecargarLocal = () => {
  const c = useContext(Context);
  if (!c) throw new Error("Local no disponible");
  return c.recargar;
};

// El recorrido se carga aparte: el uso de todos los días no lo descarga.
const Recorrido = lazy(() =>
  import("./recorrido/Recorrido").then((m) => ({ default: m.Recorrido })),
);

/** Se monta la primera vez que se pide el recorrido, y queda para que pueda cerrarse animado. */
export function RecorridoDiferido() {
  const pedido = useRecorrido((s) => s.vez > 0);
  return pedido ? (
    <Suspense fallback={null}>
      <Recorrido />
    </Suspense>
  ) : null;
}

export function Monograma({ local }: { local: LocalMarketing }) {
  return local.imagenUrl ? (
    <img
      src={local.imagenUrl}
      className="size-11 shrink-0 rounded-2xl object-cover"
      alt=""
    />
  ) : (
    <span
      className="grid size-11 shrink-0 place-items-center rounded-2xl text-xl font-bold"
      style={{
        backgroundColor: local.colorPrimario || "#FFF2E3",
        color: local.colorPrimario ? "white" : "#191512",
      }}
    >
      {local.nombre.slice(0, 1)}
    </span>
  );
}

export function LocalChips({ local }: { local: LocalMarketing }) {
  return (
    <div className="flex flex-wrap gap-2 text-xs font-medium">
      {!local.recompraActiva && (
        <span className="rounded-full bg-sand px-2 py-1 text-ink-3">
          Sin recompra
        </span>
      )}
      {local.suscripcion?.estado === "trial" && (
        <span className="rounded-full bg-sky-50 px-2 py-1 text-sky-700">
          Prueba
        </span>
      )}
      {["pending", "pendiente_pago", "pago_pendiente", "past_due"].includes(
        local.suscripcion?.estado || "",
      ) && (
        <span className="rounded-full bg-brand-soft px-2 py-1 text-brand-deep">
          Pago pendiente
        </span>
      )}
    </div>
  );
}

/**
 * Envoltorio de las pantallas de clientes y crecimiento. Aporta la paleta de
 * Marketing y la tarjeta del local a cualquier pantalla, tenga o no la barra
 * de secciones. Las tabs viven ahora en el navbar del panel.
 */
export function MarketingShell({ children }: { children?: ReactNode }) {
  const location = useLocation();
  const [raiz, setRaiz] = useState<HTMLDivElement | null>(null);
  const { data: local, error, loading, recargar } = useDatos(
    () => localApi.tarjeta(),
    [],
  );
  const abrirRecorrido = useRecorrido((s) => s.abrir);
  const verRecorrido = () => abrirRecorrido({ local: local?.nombre ?? null });

  useEffect(() => {
    const anterior = document.title;
    document.title = "Piru · Marketing";
    return () => {
      document.title = anterior;
    };
  }, []);

  return (
    <div ref={setRaiz} className="marketing-app min-h-full bg-paper text-ink">
      <RaizMarketing.Provider value={raiz}>
        <div className="mx-auto w-full max-w-[1200px] px-4 pb-16 pt-6 sm:px-8 lg:pt-8">
          <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
            <Link
              to={GUIA}
              state={{ volver: location.pathname + location.search }}
              className="btn btn-ghost px-3"
            >
              <BookOpen size={16} />
              <span className="hidden sm:inline">Guía</span>
            </Link>
            <button
              type="button"
              onClick={verRecorrido}
              className="btn btn-ghost px-3"
            >
              <CirclePlay size={16} />
              <span className="hidden sm:inline">Ver el recorrido</span>
            </button>
          </div>
          <main className="min-w-0">
            {loading || error || !local ? (
              <Estado loading={loading} error={error} reintentar={recargar} />
            ) : (
              <Context.Provider value={{ local, recargar }}>
                {children ?? <Outlet />}
              </Context.Provider>
            )}
          </main>
        </div>
        <RecorridoDiferido />
      </RaizMarketing.Provider>
    </div>
  );
}

/** Layout de las rutas de Marketing: sólo aporta el contexto y la paleta. */
export function Layout() {
  return <MarketingShell />;
}
