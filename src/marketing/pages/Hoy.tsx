import { SkeletonPantalla } from "../components/SkeletonPantalla";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { useLocal } from "../components/Layout";
import { BloqueoModulo, useModulo } from "../components/Modulo";
import { MensajeEnviadoHoy, type EnviadoHoy } from "../components/MensajeEnviadoHoy";
import { DiaFlojoHoy } from "../components/DiaFlojoHoy";
import { SelectorDiaHoy } from "../components/SelectorDiaHoy";
import { MensajeHoy } from "../components/MensajeHoy";
import { MotorHoy } from "../components/MotorHoy";
import { MensajesMotor } from "../components/MensajesMotor";
import { mejoresParaHoy } from "../lib/mejoresHoy";
import { DecisionesMensaje } from "../components/DecisionesMensaje";
import {
  Button,
  Card,
  Header,
  Empty,
  Estado,
  Sheet,
  accion,
} from "../components/ui";
import { datosLocal, apiLocal, query } from "../lib/api";
import { useDatos } from "../lib/useDatos";
import { hoyArgentina, segmentoNombre } from "../lib/formato";
import type {
  ColaRecompraItem,
  HistorialRecompraItem,
  EnvioManualRecompra,
  DecisionesRecompra,
  MensajeColaData,
  PaginadoRecompra,
  EstadoMotorRecompra,
} from "../lib/tipos";
const fechaArgentina = (fecha: string) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date(fecha));
function guardia(id: number): boolean | null {
  try {
    const v = localStorage.getItem(`piru-marketing-whatsapp:${id}`);
    return v === "si" ? true : v === "no" ? false : null;
  } catch {
    return null;
  }
}
const SUGERIDOS = [3, 5, 10];
function leerNumero(clave: string, defecto: number) {
  try {
    const n = Number(localStorage.getItem(clave));
    return SUGERIDOS.includes(n) ? n : defecto;
  } catch {
    return defecto;
  }
}
function leerDescartados(clave: string): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(clave) ?? "[]");
    return Array.isArray(v) ? v.filter((n) => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
}
export function Hoy() {
  const l = useLocal();
  const mod = useModulo("motor_recompra");
  return (
    <>
      <Header
        title="Tu semana de mensajes"
        sub="Desde el WhatsApp de tu local, en el chat de siempre."
        ayuda={{ seccion: "whatsapp", texto: "Cómo funcionan los mensajes" }}
      />
      {mod.loading || mod.error ? (
        <Estado
          skeleton={<SkeletonPantalla tipo="hoy" />}
          loading={mod.loading}
          error={mod.error}
          reintentar={mod.recargar}
        />
      ) : mod.modulo?.activoAhora ? (
        <HoyContenido key={l.restauranteId} />
      ) : (
        <BloqueoModulo codigo="motor_recompra" nombre="Recompra" />
      )}
    </>
  );
}
function HoyContenido() {
  const l = useLocal();
  const [tiene, setTiene] = useState<boolean | null>(() =>
    guardia(l.restauranteId),
  );
  const [busy, setBusy] = useState<number | null>(null);
  const [segmento, setSegmento] = useState("");
  const claveSugeridos = `piru-marketing-sugeridos:${l.restauranteId}`;
  const [cantidadSugeridos, setCantidadSugeridos] = useState(() => leerNumero(claveSugeridos, 5));
  // Lo que se descarta vale sólo por ese día y ese local: mañana la agenda vuelve a traerlo.
  const [verDescartados, setVerDescartados] = useState(false);
  const [enviados, setEnviados] = useState<Record<number, EnviadoHoy>>({});
  // La voz, el toque, el link y el descuento de cada mensaje. Sin decisiones, los mensajes se piden
  // y se registran con la escalera.
  const [decisiones, setDecisiones] = useState<
    Record<number, DecisionesRecompra>
  >({});
  const decisionesRef = useRef(decisiones);
  decisionesRef.current = decisiones;
  const conDecisiones = (id: number) => query({ ...decisionesRef.current[id] });
  const [eligiendo, setEligiendo] = useState<{
    fila: ColaRecompraItem;
    mensaje: MensajeColaData;
  } | null>(null);
  const [params] = useSearchParams();
  const [diaElegido, setDiaElegido] = useState(() => {
    const dia = Number(params.get("diaSemana"));
    return params.has("diaSemana") && Number.isInteger(dia) && dia >= 0 && dia <= 6
      ? (dia - new Date(`${hoyArgentina()}T12:00:00-03:00`).getUTCDay() + 7) % 7 : 0;
  });
  const hoyActual = hoyArgentina();
  const fechaDia = (offset: number) => new Date(Date.parse(`${hoyActual}T12:00:00-03:00`) + offset * 86400000).toISOString().slice(0, 10);
  const fechaElegida = fechaDia(diaElegido);
  const claveDescartados = `piru-marketing-descartados:${l.restauranteId}:${fechaElegida}`;
  const [descartados, setDescartados] = useState<number[]>(() => leerDescartados(claveDescartados));
  useEffect(() => setDescartados(leerDescartados(claveDescartados)), [claveDescartados]);
  function guardarDescartados(ids: number[]) {
    setDescartados(ids);
    try {
      localStorage.setItem(claveDescartados, JSON.stringify(ids));
    } catch {
      /* Se conserva mientras la pantalla siga abierta. */
    }
  }
  const nombreDia = (offset: number) => offset === 0 ? "Hoy" : offset === 1 ? "Mañana" : new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", weekday: "long" }).format(new Date(`${fechaDia(offset)}T12:00:00-03:00`));
  const { data, error, loading, recargar } = useDatos(async () => {
    await apiLocal("/clientes/recompra/sincronizar", { method: "POST" });
    const estado = await datosLocal<EstadoMotorRecompra>("/clientes/recompra/estado",
    );
    const cola: ColaRecompraItem[] = [];
    let p = 1;
    let paginas = 1;
    do {
      const page = await datosLocal<PaginadoRecompra<ColaRecompraItem>>(`/clientes/recompra/cola${query({ pagina: p, limite: 100 })}`,
      );
      cola.push(...page.items);
      paginas = page.paginas;
      p++;
    } while (p <= paginas);
    const hoy = fechaElegida;
    const vencidos = cola.filter(
      (c) =>
        c.fechaProyectada === hoy &&
        c.dueDate !== null &&
        Date.parse(c.dueDate) <= Date.parse(`${hoy}T23:59:59-03:00`),
    );
    const resultados: PromiseSettledResult<{ fila: ColaRecompraItem; mensaje: MensajeColaData }>[] = [];
    for (let inicio = 0; inicio < vencidos.length; inicio += 20) resultados.push(...await Promise.allSettled(
      vencidos.slice(inicio, inicio + 20).map(async (c) => ({
        fila: c,
        mensaje: await datosLocal<MensajeColaData>(`/clientes/recompra/cola/${c.id}/mensaje${conDecisiones(c.id)}`,
        ),
      })),
    ));
    const mensajes = resultados.flatMap((r) =>
      r.status === "fulfilled" ? [r.value] : [],
    );
    const avisos = resultados.flatMap((r, i) =>
      r.status === "rejected"
        ? [
            `${vencidos[i].clienteNombre}: ${r.reason instanceof Error ? r.reason.message : "No pudimos preparar este mensaje."}`,
          ]
        : [],
    );
    const historial: HistorialRecompraItem[] = [];
    try {
      let pagina = 1;
      let seguir = true;
      while (seguir) {
        const page = await datosLocal<PaginadoRecompra<HistorialRecompraItem>>(`/clientes/recompra/historial${query({ pagina, limite: 100, estado: "entregado" })}`,
        );
        historial.push(...page.items.filter((h) => h.estadoDespacho === "entregado" && h.fechaHora && fechaArgentina(h.fechaHora) === hoy));
        const ultima = page.items.at(-1)?.fechaHora;
        seguir = pagina < page.paginas && page.items.length > 0 && (!ultima || fechaArgentina(ultima) >= hoy);
        pagina++;
      }
    } catch {
      avisos.push("No pudimos cargar los mensajes ya enviados. Podés seguir mandando los pendientes.");
    }
    return { estado, mensajes, avisos, historial, cola };
  }, [l.restauranteId, fechaElegida]);
  useEffect(() => {
    const timer = window.setInterval(recargar, 5 * 60000);
    return () => window.clearInterval(timer);
  }, [recargar]);
  // Las vistas elegidas se conservan hasta la próxima actualización de la cola.
  const [frescos, setFrescos] = useState<Record<number, MensajeColaData>>({});
  useEffect(() => {
    setFrescos({});
  }, [data]);
  const coincideSegmento = (valor: string) => !segmento || (valor === "nuevo" ? "primer_pedido" : valor) === segmento;
  const semanaVisible = data ? Array.from({ length: 7 }, (_, i) => data.cola.filter((fila) => fila.fechaProyectada === fechaDia(i) && coincideSegmento(fila.segmento)).length) : undefined;
  const todosPendientes = data?.mensajes.filter(({ fila }) => !enviados[fila.id]) ?? [];
  const delSegmento = todosPendientes.filter(({ fila, mensaje }) => coincideSegmento(mensaje.segmentoCliente ?? fila.segmento));
  const pendientes = delSegmento.filter(({ fila }) => !descartados.includes(fila.id));
  const descartadosVisibles = delSegmento.filter(({ fila }) => descartados.includes(fila.id));
  const sePuede = ({ fila, mensaje }: (typeof pendientes)[number]) =>
    (mensaje.envio?.puedeEnviar ?? true) && !!mensaje.waMeUrl && fila.telefono !== null;
  // Con pocos mensajes no vale la pena separar: la selección aparece cuando hay de dónde elegir.
  const idsMejores = pendientes.length > 3
    ? mejoresParaHoy(
        pendientes.map((p) => ({ id: p.fila.id, segmento: p.mensaje.segmentoCliente ?? p.fila.segmento, totalGastado: p.fila.totalGastado, puntos: p.mensaje.puntosActivo ? p.mensaje.puntosSaldo : 0, puede: sePuede(p) })),
        cantidadSugeridos,
      )
    : [];
  const mejores = idsMejores.map((id) => pendientes.find((p) => p.fila.id === id)!);
  const resto = pendientes.filter((p) => !idsMejores.includes(p.fila.id));
  const yaEnviados = Array.from(new Map<number, EnviadoHoy>([
    ...(data?.historial ?? []).map((h) => [h.id, h] as const),
    ...Object.values(enviados).map((h) => [h.id, h] as const),
  ]).values()).filter(h => h.fechaHora && fechaArgentina(h.fechaHora) === fechaElegida && coincideSegmento(h.segmento)).sort((a, b) => Date.parse(b.fechaHora ?? "") - Date.parse(a.fechaHora ?? ""));
  const nuevosEnviados = Object.values(enviados).filter((h) => h.fechaHora && fechaArgentina(h.fechaHora) === fechaElegida && !data?.historial.some((previo) => previo.id === h.id)).length;
  const cantidadEnviados = segmento ? yaEnviados.length : Math.max(diaElegido === 0 ? data?.estado.campana?.enviadosHoy ?? 0 : 0, data?.historial.length ?? 0) + nuevosEnviados;
  function elegir(v: boolean | null) {
    setTiene(v);
    try {
      if (v === null)
        localStorage.removeItem(`piru-marketing-whatsapp:${l.restauranteId}`);
      else
        localStorage.setItem(
          `piru-marketing-whatsapp:${l.restauranteId}`,
          v ? "si" : "no",
        );
    } catch {
      /* guard applies in memory */
    }
  }
  function renderFila({ fila, mensaje: original }: (typeof pendientes)[number], ranking?: number) {
    const mensaje = frescos[fila.id] ?? original;
    // El servidor valida bajas, compras y frecuencia. El horario es una recomendación.
    const puede = mensaje.envio?.puedeEnviar ?? true;
    const motivo = !puede
      ? mensaje.envio?.motivo ?? "Todavía no se puede mandar."
      : !mensaje.waMeUrl
        ? "Este cliente no tiene un celular válido para WhatsApp."
        : null;
    return (
      <MensajeHoy
        key={fila.id}
        mensaje={mensaje}
        ultimoPedidoAt={fila.ultimoPedidoAt}
        cadenciaDias={fila.cadenciaDias ?? null}
        totalGastado={fila.totalGastado}
        ranking={ranking}
        tiene={tiene}
        puede={puede}
        motivo={motivo}
        busy={busy !== null}
        elegido={!!decisiones[fila.id]}
        onCambiar={mensaje.tipoMensaje !== "dia_flojo" && mensaje.opciones ? () => setEligiendo({ fila, mensaje }) : undefined}
        onDescartar={() => guardarDescartados([...descartados, fila.id])}
        onMarcar={async () => {
          if (busy !== null) return;
          setBusy(fila.id);
          await accion(async () => {
            const resultado = await apiLocal<EnvioManualRecompra>(`/clientes/recompra/cola/${fila.id}/marcar-enviado`,
              { method: "POST", body: decisiones[fila.id] ?? {} },
            );
            recargar();
            setEnviados((previos) => ({ ...previos, [fila.id]: {
              id: fila.id, clienteId: mensaje.clienteId, clienteNombre: mensaje.clienteNombre,
              telefono: mensaje.telefono ?? fila.telefono, segmento: fila.segmento, tipoMensaje: mensaje.tipoMensaje,
              poblacion: fila.poblacion, origenContacto: "manual", estadoDespacho: "entregado",
              plantillaWhatsapp: mensaje.plantillaWhatsapp,
              codigoDescuento: resultado.codigoDescuento ?? mensaje.codigoDescuento,
              nivel: resultado.nivel ?? mensaje.nivel, fechaHora: new Date().toISOString(), errorEnvio: null,
              toque: resultado.toque ?? mensaje.toque, linkModalidad: resultado.link ?? mensaje.link,
              descuentoEnviado: resultado.descuento ?? mensaje.descuento,
              puntosOtorgados: resultado.puntos ?? mensaje.puntos,
              beneficioTipo: resultado.beneficioTipo ?? mensaje.beneficioTipo,
              texto: mensaje.texto, mensaje,
            } }));
          }, "Registramos el mensaje enviado");
          setBusy(null);
        }}
      />
    );
  }
  return (
    <>
      {tiene === null ? (
        <Card className="mb-5">
          <h2>
            ¿Este dispositivo tiene el WhatsApp de{" "}
            {"tu local"}?
          </h2>
          <p className="muted mt-2 mb-5">
            El mensaje sale del número vinculado a este celular o computadora.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => elegir(true)}>
              Sí, tengo el WhatsApp del local
            </Button>
            <Button variant="secondary" onClick={() => elegir(false)}>
              No, está en otro dispositivo
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="mb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              {tiene
                ? `Este dispositivo tiene el WhatsApp de tu local.`
                : "Mandalos desde el celular o la compu que tiene el WhatsApp del local. Desde acá podés copiar el texto."}
            </p>
            <Button variant="ghost" onClick={() => elegir(null)}>
              Cambiar dispositivo
            </Button>
          </div>
        </Card>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SelectorDiaHoy
          dia={diaElegido}
          nombres={Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", weekday: "long" }).format(new Date(`${fechaDia(i)}T12:00:00-03:00`)))}
          pendientes={semanaVisible}
          onElegir={setDiaElegido}
        />
        <label className="mb-5 w-full sm:w-60">
          Segmento
          <select value={segmento} onChange={(e) => setSegmento(e.target.value)}>
            <option value="">Todos los segmentos</option>
            {["primer_pedido", "activo", "vip", "en_riesgo", "dormido", "perdido"].map((valor) => (
              <option key={valor} value={valor}>{segmentoNombre[valor]}</option>
            ))}
          </select>
        </label>
      </div>
      {l.diasFlojosActivo && (
        <DiaFlojoHoy key={fechaElegida} fecha={fechaElegida} onSumados={recargar} />
      )}
      <Estado skeleton={<SkeletonPantalla tipo="hoy" />} loading={loading} error={error} reintentar={recargar} />
      {data && (
        <>
          {data.avisos.map((a) => (
            <Card key={a} className="mb-3">
              <p role="alert">{a}</p>
              <Button className="mt-3" variant="secondary" onClick={recargar}>
                Actualizar mensajes
              </Button>
            </Card>
          ))}
          <p className="mb-5 text-lg font-semibold tabular-nums">
            {cantidadEnviados} de{" "}
            {cantidadEnviados + pendientes.length}{" "}
            enviados
          </p>
          {!pendientes.length ? (
            <Empty
              title={yaEnviados.length ? "No quedan mensajes pendientes" : segmento ? "No hay mensajes para este segmento" : `${nombreDia(diaElegido)} no hay mensajes`}
              text={yaEnviados.length ? "Los mensajes enviados están abajo." : segmento ? "Probá con otro segmento o revisá los otros días de la semana." : "La agenda se actualiza sola con los clientes que necesitan volver. Podés revisar los otros días de la semana."}
            />
          ) : (
            <>
              {mejores.length > 0 && (
                <section aria-labelledby="hoy-mejores" className="mb-8">
                  <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h2 id="hoy-mejores">Los mejores para escribirle {diaElegido === 0 ? "hoy" : nombreDia(diaElegido).toLowerCase()}</h2>
                      <p className="muted mt-1">Primero los que tienen puntos para aprovechar; después, los que más gastaron y más valen la pena recuperar.</p>
                    </div>
                    <label className="text-sm">
                      <span className="sr-only">Cuántos mostrar</span>
                      <select
                        aria-label="Cuántos clientes destacar"
                        value={cantidadSugeridos}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          setCantidadSugeridos(n);
                          try { localStorage.setItem(claveSugeridos, String(n)); } catch { /* Sólo esta sesión. */ }
                        }}
                      >
                        {SUGERIDOS.map((n) => <option key={n} value={n}>Destacar {n}</option>)}
                      </select>
                    </label>
                  </div>
                  <ul aria-label="Mejores clientes para escribirle" className="lista-sombra overflow-hidden rounded-[20px] bg-surface ring-1 ring-brand/30">
                    {mejores.map((p, i) => renderFila(p, i + 1))}
                  </ul>
                </section>
              )}
              {resto.length > 0 && (
                <section aria-labelledby="hoy-resto">
                  {mejores.length > 0 && <h2 id="hoy-resto" className="mb-3">El resto de la agenda · {resto.length}</h2>}
                  <ul aria-label="Mensajes para hoy" className="lista-sombra overflow-hidden rounded-[20px] bg-surface">
                    {resto.map((p) => renderFila(p))}
                  </ul>
                </section>
              )}
            </>
          )}
          {descartadosVisibles.length > 0 && (
            <section className="mt-6 text-ink-3" aria-label="Descartados por hoy">
              <button type="button" className="text-sm font-medium underline underline-offset-4" aria-expanded={verDescartados} onClick={() => setVerDescartados((v) => !v)}>
                {verDescartados ? "Ocultar" : "Ver"} los {descartadosVisibles.length} que no se mandan {diaElegido === 0 ? "hoy" : "ese día"}
              </button>
              {verDescartados && (
                <ul className="mt-3">
                  {descartadosVisibles.map(({ fila }) => (
                    <li key={fila.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span>{fila.clienteNombre}</span>
                      <Button variant="ghost" className="min-h-9 px-3 text-sm" onClick={() => guardarDescartados(descartados.filter((id) => id !== fila.id))}>Volver a la lista</Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          {yaEnviados.length > 0 && (
            <section className="mt-8 text-ink-3" aria-labelledby="hoy-ya-enviados">
              <h2 id="hoy-ya-enviados" className="mb-3 text-sm font-medium">Ya enviados · {yaEnviados.length}</h2>
              <ul aria-label="Ya enviados">
                {yaEnviados.map((enviado) => <MensajeEnviadoHoy key={enviado.id} enviado={enviado} />)}
              </ul>
            </section>
          )}
        </>
      )}
      {data && (
        <>
          <MotorHoy config={data.estado.config} onGuardado={recargar} />
          <section className="mt-2" aria-label="Todos los mensajes del motor">
            <MensajesMotor />
          </section>
        </>
      )}
      <Sheet
          open={!!eligiendo}
          onOpenChange={() => setEligiendo(null)}
          title={`Mensaje para ${eligiendo?.fila.clienteNombre ?? ""}`}
        >
          {eligiendo && (
            <DecisionesMensaje
              key={eligiendo.fila.id}
              fila={eligiendo.fila}
              mensaje={eligiendo.mensaje}
              decisiones={decisiones[eligiendo.fila.id]}
              onAplicar={(elegidas, vista) => {
                const id = eligiendo.fila.id;
                setDecisiones((d) => ({ ...d, [id]: elegidas }));
                setFrescos((f) => ({ ...f, [id]: vista }));
                setEligiendo(null);
              }}
              onRestablecer={() => {
                const id = eligiendo.fila.id;
                setDecisiones(({ [id]: _quitada, ...resto }) => resto);
                setEligiendo(null);
                datosLocal<MensajeColaData>(`/clientes/recompra/cola/${id}/mensaje`,
                )
                  .then((m) => setFrescos((f) => ({ ...f, [id]: m })))
                  .catch(() =>
                    toast.error(
                      "No pudimos volver al mensaje sugerido. Actualizá la pantalla.",
                    ),
                  );
              }}
            />
          )}
        </Sheet>
    </>
  );
}
