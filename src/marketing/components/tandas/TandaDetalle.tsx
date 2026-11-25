import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { DropdownMenu } from "radix-ui";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronDown,
  Copy,
  Eye,
  Gift,
  MessageCircle,
  MoreHorizontal,
  RotateCcw,
  ShoppingCart,
  Trash2,
  Send,
  ShoppingBag,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button, Confirmar, Estado, Sheet, cn, copiar } from "../ui";
import { PortalMenuMarketing } from "../portal";
import { SkeletonPantalla } from "../SkeletonPantalla";
import { useDatos } from "../../lib/useDatos";
import { pesos } from "../../lib/formato";
import { fechaTanda, tandasApi, type MensajeTanda, type PackMensajes, type Tanda } from "../../lib/tandas";
import { Packs } from "./Packs";
import { VistaPrevia } from "./VistaPrevia";

/** El segmento de una persona (la lista de Clientes los nombra en plural). */
const SEGMENTO: Record<string, string> = {
  nuevo: "Primer pedido",
  activo: "Habitual",
  vip: "VIP",
  en_riesgo: "Se está yendo",
  dormido: "Hace tiempo no viene",
  perdido: "Dejó de pedir",
};

const iniciales = (nombre: string) =>
  nombre.trim().split(/\s+/).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("") || "?";

function hechos(m: MensajeTanda): string[] {
  const d = m.datos;
  return [
    d.cadenciaDias ? `Pide cada ~${d.cadenciaDias} días` : d.pedidos === 1 ? "1 pedido" : `${d.pedidos} pedidos`,
    d.diasDesdeUltimo === 1 ? "pidió ayer" : `hace ${d.diasDesdeUltimo} días`,
    d.diaHabitual ? `los ${d.diaHabitual}` : null,
    `ticket ${pesos(d.ticketPromedio)}`,
    d.puntos != null && d.puntos > 0 ? `${d.puntos} puntos` : null,
  ].filter((x): x is string => !!x);
}

/** Una tanda: los mensajes que faltan mandar arriba, con el porqué de cada uno. */
export function TandaDetalle({
  tandaId,
  inicial,
  local,
  onVolver,
}: {
  tandaId: number;
  inicial?: Tanda;
  local: string;
  onVolver: () => void;
}) {
  // La tanda recién creada llega armada; al recargar se lee de nuevo.
  const usarInicial = useRef(Boolean(inicial));
  const { data, error, loading, recargar } = useDatos(
    () => {
      if (usarInicial.current && inicial) {
        usarInicial.current = false;
        return Promise.resolve(inicial);
      }
      return tandasApi.leer(tandaId);
    },
    [tandaId],
    { conservar: true },
  );
  const [cambios, setCambios] = useState<Record<number, MensajeTanda>>({});
  const [enviando, setEnviando] = useState<number | null>(null);
  const [viendo, setViendo] = useState<MensajeTanda | null>(null);
  const [verDescartados, setVerDescartados] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [cambiandoVinculado, setCambiandoVinculado] = useState(false);
  // Mientras sale sola por el WhatsApp vinculado, la lista se actualiza cada medio minuto.
  const automatico = Boolean(data?.vinculado?.automatico);
  useEffect(() => {
    if (!automatico) return;
    const t = window.setInterval(() => {
      setCambios({});
      recargar();
    }, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [automatico]);
  // Envío automático: el saldo de mensajes de marketing manda. Sin saldo no sale ninguno.
  const esApi = data?.canal === "api";
  const saldo = useDatos(() => (esApi ? tandasApi.mensajes() : Promise.resolve(null)), [esApi], { conservar: true });
  const [comprando, setComprando] = useState(false);
  const [pack, setPack] = useState<PackMensajes | null>(null);
  const [pagando, setPagando] = useState(false);
  const [params, setParams] = useSearchParams();
  const recargaVuelta = params.get("recarga");
  useEffect(() => {
    if (!recargaVuelta) return;
    // Vuelta de Mercado Pago: el saldo se acredita por webhook en unos segundos.
    if (recargaVuelta === "success") toast.success("¡Pago recibido! Estamos acreditando tus mensajes…");
    const p = new URLSearchParams(params);
    p.delete("recarga");
    setParams(p, { replace: true });
    const timers = [1500, 4000, 8000, 15000].map((ms) => window.setTimeout(saldo.recargar, ms));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recargaVuelta]);

  if (!data) return <Estado skeleton={<SkeletonPantalla tipo="hoy" />} loading={loading} error={error} reintentar={recargar} />;

  const api = data.canal === "api";
  // Con sucursales, cada tanda sale desde el número de una sola: se muestra siempre cuál.
  const desde = data.envio
    ? `${data.envio.nombre}${data.envio.numero ? ` · ${data.envio.numero}` : ""}`
    : local;
  const disponibles = saldo.data?.disponibles ?? 0;
  const sinSaldo = api && !!saldo.data && disponibles <= 0;

  async function pagarPack() {
    if (!pack) return;
    setPagando(true);
    try {
      const pago = await tandasApi.comprarPack(pack.id, `/dashboard/marketing/recompra?tanda=${data!.id}`);
      window.location.assign(pago.url_pago);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos abrir el pago. Probá de nuevo.");
      setPagando(false);
    }
  }
  const mensajes = data.mensajes.map((m) => cambios[m.id] ?? m);
  const pendientes = mensajes.filter((m) => m.estado === "pendiente");
  const enviados = mensajes.filter((m) => m.estado === "enviado");
  const descartados = mensajes.filter((m) => m.estado === "descartado");
  const activos = mensajes.length - descartados.length;
  const volvieron = enviados.filter((m) => m.resultado);
  const actualizar = (m: MensajeTanda) => {
    setCambios((c) => ({ ...c, [m.id]: m }));
    setViendo((v) => (v?.id === m.id ? m : v));
  };

  async function accion(m: MensajeTanda, tipo: "abrir" | "deshacer" | "descartar" | "enviar") {
    try {
      const nuevo = await tandasApi.accion(data!.id, m.id, tipo);
      actualizar(nuevo);
      return nuevo;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos guardar el cambio.");
      return null;
    }
  }

  function abrir(m: MensajeTanda) {
    // El enlace abre WhatsApp en otra pestaña; acá queda registrado y el beneficio empieza a correr.
    actualizar({ ...m, estado: "enviado", canalEnvio: "wa_me", enviadoAt: new Date().toISOString() });
    void accion(m, "abrir").then((r) => {
      if (r) toast.success(`Listo, ${r.clienteNombre.split(" ")[0]} quedó como enviado`, {
        action: { label: "Deshacer", onClick: () => void accion(r, "deshacer") },
      });
    });
  }

  async function cambiarVinculado(activar: boolean) {
    setCambiandoVinculado(true);
    try {
      await tandasApi.envioVinculado(data!.id, activar);
      setCambios({});
      recargar();
      if (activar) toast.success("Listo: la tanda sale sola desde tu WhatsApp");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos cambiar el envío.");
    } finally {
      setCambiandoVinculado(false);
    }
  }

  async function enviar(m: MensajeTanda) {
    if (enviando !== null) return;
    setEnviando(m.id);
    const r = await accion(m, "enviar");
    setEnviando(null);
    saldo.recargar();
    if (r?.estado === "enviado") toast.success(`Enviado a ${r.clienteNombre.split(" ")[0]}`);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Button variant="ghost" className="-ml-3 px-3" onClick={onVolver}>
          <ArrowLeft size={16} />
          Tus tandas
        </Button>
        <Button variant="ghost" className="px-3 text-rose-700" onClick={() => setCancelando(true)}>
          <Trash2 size={16} />
          Cancelar tanda
        </Button>
      </div>
      <Confirmar
        open={cancelando}
        onOpenChange={setCancelando}
        title="¿Cancelar esta tanda?"
        text={enviados.length
          ? `Se borra la tanda y los mensajes que faltan mandar, con sus cupones. Los ${enviados.length} ya enviados conservan su beneficio.`
          : "Se borra la tanda con sus mensajes y cupones. Esos clientes vuelven a estar disponibles para otra tanda."}
        confirmLabel="Cancelar y borrar"
        onConfirm={async () => {
          try {
            await tandasApi.cancelar(data.id);
            toast.success("Tanda cancelada");
            onVolver();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "No pudimos cancelar la tanda.");
          }
        }}
      />

      <header className="mb-6">
        <p className="text-xs font-semibold tracking-[.12em] text-ink-3 uppercase">
          {api ? `Envío automático · ${desde}` : `Desde el WhatsApp de ${desde}`}
        </p>
        <h1 className="mt-1 first-letter:uppercase">Tanda del {fechaTanda(data.createdAt)}</h1>
        <p className="muted mt-2">
          {activos} {activos === 1 ? "cliente" : "clientes"}
          {data.presupuestoAsignado > 0
            ? ` · hasta ${pesos(data.presupuestoAsignado)} en beneficios si todos los usan`
            : " · sin beneficios"}
        </p>
      </header>

      {api && saldo.data && (
        <div className={cn("tanda-saldo mb-4", sinSaldo && "tanda-saldo--vacio")}>
          <MessageCircle size={18} className={sinSaldo ? "text-rose-600" : "text-emerald-600"} />
          <p className="min-w-0 flex-1 text-sm">
            {sinSaldo ? (
              <><b>No te quedan mensajes de marketing.</b> Sin saldo no se puede enviar ninguno por el WhatsApp automático.</>
            ) : (
              <>Te quedan <b className="tabular-nums">{disponibles}</b> mensajes de marketing{pendientes.length > disponibles ? `: alcanzan para ${disponibles} de los ${pendientes.length} que faltan` : ""}. Cada envío usa uno.</>
            )}
          </p>
          <Button variant={sinSaldo ? "primary" : "secondary"} className="min-h-10 px-4 text-sm" onClick={() => setComprando(true)}>
            <ShoppingCart size={15} />
            Comprar mensajes
          </Button>
        </div>
      )}

      {!api && data.vinculado && pendientes.length > 0 && (
        <div className="tanda-saldo mb-4">
          <MessageCircle size={18} className="text-emerald-600" />
          <p className="min-w-0 flex-1 text-sm">
            {!data.vinculado.disponible ? (
              <>Tu WhatsApp vinculado es otro número: esta tanda se manda a mano desde {data.envio?.nombre ?? local}.</>
            ) : data.vinculado.automatico ? (
              <>
                <b>Saliendo sola desde tu WhatsApp.</b> Hoy van <b className="tabular-nums">{data.vinculado.enviadosHoy}</b> de{" "}
                {data.vinculado.limiteDiario}; lo que no entre hoy sale mañana. Podés cerrar esta pantalla.
              </>
            ) : (
              <>
                Puede salir sola desde tu WhatsApp vinculado, con foto del producto: hasta {data.vinculado.limiteDiario} por día y
                con pausas, para cuidar tu número.
                {data.vinculado.enviadosHoy > 0 ? ` Hoy ya salieron ${data.vinculado.enviadosHoy}.` : ""}
              </>
            )}
          </p>
          {data.vinculado.disponible && (
            <Button
              variant={data.vinculado.automatico ? "secondary" : "primary"}
              className="min-h-10 px-4 text-sm"
              disabled={cambiandoVinculado}
              onClick={() => void cambiarVinculado(!data.vinculado!.automatico)}
            >
              {data.vinculado.automatico ? "Pausar" : "Mandar sola"}
            </Button>
          )}
        </div>
      )}

      <div className="card mb-6 !p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="text-lg font-semibold tabular-nums">
            {enviados.length} de {activos} enviados
          </p>
          {volvieron.length > 0 && (
            <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-600/15">
              <ShoppingBag size={15} />
              {volvieron.length} volvieron a pedir · {pesos(volvieron.reduce((s, m) => s + (m.resultado?.total ?? 0), 0))}
            </p>
          )}
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-sand">
          <div
            className="h-full rounded-full bg-emerald-500 transition-[width] duration-500"
            style={{ width: `${activos ? (enviados.length / activos) * 100 : 0}%` }}
          />
        </div>
        {!api && pendientes.length > 0 && (
          <p className="mt-3 text-xs text-ink-3">
            Abrí cada uno desde el celular o la compu que tiene el WhatsApp de {data.envio?.nombre ?? local}
            {data.envio?.numero ? ` (${data.envio.numero})` : ""}: se abre el chat con el mensaje escrito y sólo tenés que
            tocar enviar.
          </p>
        )}
      </div>

      {pendientes.length === 0 && (
        <div className="card mb-6 py-8 text-center">
          <CheckCheck className="mx-auto mb-3 text-emerald-600" size={28} />
          <h2>Tanda terminada</h2>
          <p className="muted mt-2">Abajo ves a quién le escribiste y quién ya volvió a pedir.</p>
        </div>
      )}

      {pendientes.length > 0 && (
        <ul aria-label="Mensajes por mandar" className="flex flex-col gap-3">
          {pendientes.map((m) => (
            <Tarjeta
              key={m.id}
              m={m}
              api={api}
              enviando={enviando}
              onVer={() => setViendo(m)}
              onAbrir={() => abrir(m)}
              onEnviar={() => void enviar(m)}
              sinSaldo={sinSaldo}
              onDescartar={() => void accion(m, "descartar")}
            />
          ))}
        </ul>
      )}

      {enviados.length > 0 && (
        <section className="mt-8" aria-labelledby="tanda-enviados">
          <h2 id="tanda-enviados" className="mb-3 text-sm font-semibold text-ink-3">Enviados · {enviados.length}</h2>
          <ul className="lista-sombra overflow-hidden rounded-[20px] bg-surface">
            {enviados.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-0 sm:px-5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-emerald-700">
                  <Check size={16} />
                </span>
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setViendo(m)}>
                  <span className="block font-semibold">{m.clienteNombre}</span>
                  <span className="block text-xs text-ink-3">
                    {m.canalEnvio === "api"
                      ? "Enviado por WhatsApp automático"
                      : m.canalEnvio === "vinculado"
                        ? "Enviado solo desde tu WhatsApp"
                        : "Abierto en tu WhatsApp"}
                    {m.beneficio.etiqueta ? ` · ${m.beneficio.etiqueta}` : ""}
                  </span>
                </button>
                {m.resultado ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                    Volvió · {pesos(m.resultado.total)}
                  </span>
                ) : (
                  m.canalEnvio === "wa_me" && (
                    <Button variant="ghost" className="min-h-9 px-3 text-sm" onClick={() => void accion(m, "deshacer")}>
                      <RotateCcw size={14} />
                      No lo mandé
                    </Button>
                  )
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {descartados.length > 0 && (
        <section className="mt-6 text-ink-3" aria-label="Descartados">
          <button
            type="button"
            className="text-sm font-medium underline underline-offset-4"
            aria-expanded={verDescartados}
            onClick={() => setVerDescartados((v) => !v)}
          >
            {verDescartados ? "Ocultar" : "Ver"} {descartados.length === 1 ? "el que no se manda" : `los ${descartados.length} que no se mandan`}
          </button>
          {verDescartados && (
            <ul className="mt-3">
              {descartados.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span>{m.clienteNombre}</span>
                  <Button variant="ghost" className="min-h-9 px-3 text-sm" onClick={() => void accion(m, "deshacer")}>
                    Volver a la lista
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <Sheet open={!!viendo} onOpenChange={(o) => !o && setViendo(null)} title={viendo ? `Para ${viendo.clienteNombre}` : ""}>
        {viendo && (
          <>
            <VistaPrevia mensaje={viendo} local={local} api={api} />
            <h3 className="mt-6 mb-2 text-sm font-semibold">Por qué este mensaje</h3>
            <ul className="space-y-1.5 text-sm text-ink-2">
              {viendo.motivos.map((t) => (
                <li key={t} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />{t}</li>
              ))}
            </ul>
            {viendo.estado === "pendiente" && (
              <div className="mt-6 flex flex-wrap gap-2">
                {api ? (
                  <Button disabled={enviando !== null || sinSaldo} onClick={() => void enviar(viendo)}>
                    <Send size={16} />
                    {enviando === viendo.id ? "Enviando…" : "Enviar ahora"}
                  </Button>
                ) : (
                  <a className="btn btn-wa" href={viendo.waMeUrl} target="_blank" rel="noreferrer" onClick={() => abrir(viendo)}>
                    <MessageCircle size={16} />
                    Abrir WhatsApp
                  </a>
                )}
                <Button variant="secondary" onClick={() => copiar(viendo.texto)}>
                  <Copy size={16} />
                  Copiar texto
                </Button>
              </div>
            )}
          </>
        )}
      </Sheet>

      <Sheet open={comprando} onOpenChange={setComprando} title="Mensajes de marketing">
        <p className="muted mb-6">
          Cada mensaje que sale por el WhatsApp automático usa 1. Te quedan {disponibles}
          {pendientes.length ? ` y faltan mandar ${pendientes.length}` : ""}. Se paga por Mercado Pago y volvés a esta tanda.
        </p>
        <Packs
          packs={saldo.data?.packs ?? []}
          elegido={pack?.id ?? null}
          necesarios={Math.max(0, pendientes.length - disponibles) || undefined}
          onElegir={setPack}
        />
        <Button className="mt-8 w-full" disabled={!pack || pagando} onClick={() => void pagarPack()}>
          {pagando ? "Abriendo el pago…" : pack ? `Pagar ${pesos(pack.precio)}` : "Elegí un pack"}
        </Button>
      </Sheet>
    </div>
  );
}

function Tarjeta({
  m,
  api,
  enviando,
  onVer,
  onAbrir,
  onEnviar,
  onDescartar,
  sinSaldo,
}: {
  sinSaldo: boolean;
  m: MensajeTanda;
  api: boolean;
  enviando: number | null;
  onVer: () => void;
  onAbrir: () => void;
  onEnviar: () => void;
  onDescartar: () => void;
}) {
  const [porque, setPorque] = useState(false);
  const item = "flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm outline-none data-[highlighted]:bg-sand";
  const cuerpo = api && m.plantilla ? m.plantilla.cuerpo : m.texto.replace(/\n?https?:\/\/\S+\s*$/, "");
  return (
    <li className="tanda-tarjeta">
      <div className="flex items-start gap-3">
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-full text-sm font-bold", m.datos.esVip ? "bg-ink text-white" : "bg-sand text-ink-2")}>
          {iniciales(m.clienteNombre)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="font-semibold break-words">{m.clienteNombre}</p>
            <span className="rounded-full bg-sand px-2 py-0.5 text-[11px] font-medium text-ink-2">
              {SEGMENTO[m.segmento] ?? m.segmento}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-ink-3">{hechos(m).join(" · ")}</p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
            m.beneficio.tipo === "ninguno" ? "text-ink-3 ring-1 ring-line" : "bg-brand-soft text-brand-deep",
          )}
        >
          {m.beneficio.tipo !== "ninguno" && <Gift size={13} />}
          {m.beneficio.etiqueta ?? "Sin beneficio"}
        </span>
      </div>

      <button type="button" onClick={onVer} className="tanda-burbuja" aria-label={`Ver cómo le llega a ${m.clienteNombre}`}>
        {api && m.plantilla?.imagenUrl && <img src={m.plantilla.imagenUrl} alt="" className="mb-2 h-24 w-full rounded-lg object-cover" />}
        <span className="line-clamp-4 whitespace-pre-line">{cuerpo}</span>
      </button>

      <div className="mt-3">
        <button
          type="button"
          className="inline-flex items-center gap-1 text-left text-[13px] text-ink-2"
          aria-expanded={porque}
          onClick={() => setPorque((v) => !v)}
        >
          <span className="font-semibold text-brand-deep">Por qué:</span>
          <span className={cn(!porque && "line-clamp-1")}>{m.motivos.at(-1)}</span>
          <ChevronDown size={14} className={cn("shrink-0 transition-transform", porque && "rotate-180")} />
        </button>
        {porque && (
          <ul className="mt-2 space-y-1 text-[13px] text-ink-2">
            {m.motivos.slice(0, -1).map((t) => (
              <li key={t} className="flex gap-2"><span className="mt-[7px] size-1 shrink-0 rounded-full bg-ink-3" />{t}</li>
            ))}
          </ul>
        )}
      </div>

      {m.errorEnvio && <p role="alert" className="mt-3 text-sm text-rose-700">{m.errorEnvio}. Probá de nuevo o mandalo desde tu WhatsApp.</p>}

      <div className="mt-4 flex items-center gap-2">
        {api ? (
          <Button className="flex-1" disabled={enviando !== null || sinSaldo} onClick={onEnviar}>
            <Send size={16} />
            {enviando === m.id ? "Enviando…" : sinSaldo ? "Sin mensajes" : "Enviar"}
          </Button>
        ) : (
          <a className="btn btn-wa flex-1" href={m.waMeUrl} target="_blank" rel="noreferrer" onClick={onAbrir}>
            <MessageCircle size={16} />
            Abrir WhatsApp
          </a>
        )}
        <Button variant="secondary" className="px-3.5" onClick={onVer} aria-label={`Vista previa para ${m.clienteNombre}`}>
          <Eye size={16} />
          <span className="hidden sm:inline">Vista previa</span>
        </Button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button variant="ghost" className="size-11 shrink-0 px-0" aria-label={`Más opciones para ${m.clienteNombre}`}>
              <MoreHorizontal size={18} />
            </Button>
          </DropdownMenu.Trigger>
          <PortalMenuMarketing>
            <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-60 rounded-2xl bg-surface p-1.5 shadow-xl ring-1 ring-line">
              <DropdownMenu.Item className={item} onSelect={() => copiar(m.texto)}><Copy size={16} />Copiar mensaje</DropdownMenu.Item>
              {api && (
                <DropdownMenu.Item className={item} asChild>
                  <a href={m.waMeUrl} target="_blank" rel="noreferrer" onClick={onAbrir}><MessageCircle size={16} />Mandarlo desde mi WhatsApp</a>
                </DropdownMenu.Item>
              )}
              <DropdownMenu.Separator className="my-1 h-px bg-line" />
              <DropdownMenu.Item className={`${item} text-rose-700`} onSelect={onDescartar}><XCircle size={16} />No mandar</DropdownMenu.Item>
            </DropdownMenu.Content>
          </PortalMenuMarketing>
        </DropdownMenu.Root>
      </div>
    </li>
  );
}
