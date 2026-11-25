import { useState } from "react";
import { useSearchParams } from "react-router";
import { ArrowRight, Plus, ShoppingBag, Sparkles } from "lucide-react";
import { useLocal } from "../components/Layout";
import { BloqueoModulo, useModulo } from "../components/Modulo";
import { SkeletonPantalla } from "../components/SkeletonPantalla";
import { Button, Estado, cn } from "../components/ui";
import { ArmarTanda } from "../components/escenas/ArmarTanda";
import { NuevaTanda } from "../components/tandas/NuevaTanda";
import { TandaDetalle } from "../components/tandas/TandaDetalle";
import { useDatos } from "../lib/useDatos";
import { pesos } from "../lib/formato";
import {
  elegiblesTotales,
  fechaTanda,
  puntosDisponibles,
  tandasApi,
  type PreparacionTandas,
  type ResumenTanda,
  type Tanda,
} from "../lib/tandas";
import "../components/tandas/tandas.css";

export function Recompra() {
  const l = useLocal();
  const mod = useModulo("motor_recompra");
  if (mod.loading || mod.error) {
    return <Estado skeleton={<SkeletonPantalla tipo="hoy" />} loading={mod.loading} error={mod.error} reintentar={mod.recargar} />;
  }
  if (!mod.modulo?.activoAhora) return <BloqueoModulo codigo="motor_recompra" nombre="Recompra" />;
  return <RecompraContenido key={l.restauranteId} />;
}

function RecompraContenido() {
  const [params, setParams] = useSearchParams();
  const tandaId = Number(params.get("tanda")) || null;
  const [nueva, setNueva] = useState(false);
  const [recien, setRecien] = useState<Tanda | null>(null);
  const { data, error, loading, recargar } = useDatos(
    async () => {
      const [tandas, prep] = await Promise.all([tandasApi.listar(), tandasApi.preparacion()]);
      return { tandas, prep };
    },
    [tandaId, nueva],
    { conservar: true },
  );

  const irA = (id: number | null) => {
    const p = new URLSearchParams(params);
    if (id) p.set("tanda", String(id));
    else p.delete("tanda");
    setParams(p);
    window.scrollTo({ top: 0 });
  };

  if (tandaId) {
    return (
      <TandaDetalle
        key={tandaId}
        tandaId={tandaId}
        inicial={recien?.id === tandaId ? recien : undefined}
        local={data?.prep.localNombre ?? "Tu local"}
        onVolver={() => {
          setRecien(null);
          irA(null);
        }}
      />
    );
  }
  if (!data) return <Estado skeleton={<SkeletonPantalla tipo="hoy" />} loading={loading} error={error} reintentar={recargar} />;

  if (nueva) {
    return (
      <NuevaTanda
        prep={data.prep}
        onCancelar={() => setNueva(false)}
        onCreada={(t) => {
          setRecien(t);
          setNueva(false);
          irA(t.id);
        }}
      />
    );
  }

  return data.tandas.length === 0 ? (
    <Bienvenida prep={data.prep} onEmpezar={() => setNueva(true)} />
  ) : (
    <Listado tandas={data.tandas} prep={data.prep} onNueva={() => setNueva(true)} onAbrir={irA} />
  );
}

/** Por qué no se puede armar una tanda ahora, si no se puede. */
function bloqueo(prep: PreparacionTandas): string | null {
  if (!prep.tieneTienda) return "Configurá la dirección de tu tienda para que los mensajes lleven su link.";
  if (!prep.puntos.some((p) => p.motivo == null))
    return prep.puntos.length
      ? "Ninguna sucursal tiene un WhatsApp activo: cargalo en Sucursales para mandar desde ese número."
      : "Configurá el WhatsApp del local para poder mandar mensajes.";
  if (!puntosDisponibles(prep).length)
    return "Ahora no hay a quién escribirle: tus clientes pidieron hace poco o ya recibieron un mensaje estos días. Volvé en unos días.";
  return null;
}

function Bienvenida({ prep, onEmpezar }: { prep: PreparacionTandas; onEmpezar: () => void }) {
  const motivo = bloqueo(prep);
  return (
    <section className="tanda-bienvenida">
      <p className="text-xs font-semibold tracking-[.14em] text-brand-deep uppercase">Recompra</p>
      <h1 className="mx-auto mt-3 max-w-xl text-[2rem] leading-[1.1] font-bold tracking-tight sm:text-[2.75rem]">
        Que tus clientes vuelvan a pedir
      </h1>
      <p className="muted mx-auto mt-4 max-w-lg text-base">
        Cuando quieras mover las ventas, armamos una tanda de mensajes: elegimos a quién escribirle hoy y a cada uno le
        decimos algo distinto, con su pedido de siempre a un toque.
      </p>
      <div className="mx-auto mt-8 max-w-[560px]">
        <ArmarTanda siempreActiva />
      </div>
      <Button className="tanda-cta mt-9" disabled={!!motivo} onClick={onEmpezar}>
        <Sparkles size={18} />
        Armar una tanda de mensajes
      </Button>
      <p className="mx-auto mt-4 max-w-md text-sm text-ink-3">
        {motivo ?? "Vos elegís a cuántos y cuánto invertir. Nada se manda solo."}
      </p>
    </section>
  );
}

function Listado({
  tandas,
  prep,
  onNueva,
  onAbrir,
}: {
  tandas: ResumenTanda[];
  prep: PreparacionTandas;
  onNueva: () => void;
  onAbrir: (id: number) => void;
}) {
  const motivo = bloqueo(prep);
  const elegibles = elegiblesTotales(prep);
  const sucursales = prep.puntos.some((p) => p.alcance === "sucursal");
  return (
    <>
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>Recompra</h1>
          <p className="muted mt-2">
            {motivo ??
              `Hoy hay ${elegibles} ${elegibles === 1 ? "cliente" : "clientes"} a los que les viene bien un mensaje${sucursales ? ", entre todas tus sucursales" : ""}.`}
          </p>
        </div>
        <Button disabled={!!motivo} onClick={onNueva}>
          <Plus size={18} />
          Nueva tanda
        </Button>
      </header>

      <ul aria-label="Tus tandas" className="grid gap-3 sm:grid-cols-2">
        {tandas.map((t) => {
          const activos = t.total - t.descartados;
          const terminada = t.enviados >= activos;
          return (
            <li key={t.id}>
              <button type="button" className="tanda-resumen" onClick={() => onAbrir(t.id)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold first-letter:uppercase">{fechaTanda(t.createdAt)}</p>
                    <p className="mt-0.5 text-xs text-ink-3">
                      {activos} {activos === 1 ? "cliente" : "clientes"}
                      {t.presupuestoAsignado > 0 ? ` · hasta ${pesos(t.presupuestoAsignado)}` : " · sin beneficios"}
                      {t.canal === "api" ? " · automático" : ""}
                      {sucursales && t.envio.alcance !== "todo" ? ` · desde ${t.envio.nombre}` : ""}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
                      terminada ? "bg-emerald-50 text-emerald-800" : "bg-brand-soft text-brand-deep",
                    )}
                  >
                    {terminada ? "Terminada" : `Faltan ${activos - t.enviados}`}
                  </span>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {t.nombres.map((n, i) => (
                      <span key={i} className="grid size-7 place-items-center rounded-full bg-sand text-[11px] font-bold text-ink-2 ring-2 ring-surface">
                        {n.charAt(0) || "?"}
                      </span>
                    ))}
                  </div>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sand">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${activos ? (t.enviados / activos) * 100 : 0}%` }} />
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-ink-2">{t.enviados}/{activos}</span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                  {t.volvieron > 0 ? (
                    <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                      <ShoppingBag size={15} />
                      {t.volvieron} {t.volvieron === 1 ? "volvió" : "volvieron"} · {pesos(t.ventas)}
                    </span>
                  ) : (
                    <span className="text-ink-3">{t.enviados ? "Esperando que vuelvan" : "Lista para mandar"}</span>
                  )}
                  <ArrowRight size={16} className="text-ink-3" />
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
