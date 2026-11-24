import { useState } from "react";
import { ArrowLeft, ArrowRight, MessageCircle, Minus, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button, cn } from "../ui";
import { pesos } from "../../lib/formato";
import { useDatos } from "../../lib/useDatos";
import { tandasApi, type PackMensajes, type PreparacionTanda, type Tanda } from "../../lib/tandas";
import { Packs } from "./Packs";

const redondear = (n: number) => Math.max(0, Math.round(n / 500) * 500);

type Paso = "cantidad" | "mensajes" | "beneficios";

/**
 * Las preguntas de una tanda, una por pantalla y centradas: a cuántos clientes escribirles ahora y
 * cuánto invertir en beneficios. Con envío automático, entre las dos aparece el saldo de mensajes de
 * marketing: si no alcanza, se elige un pack y su precio entra en el costo de la tanda.
 */
export function NuevaTanda({
  prep,
  onCreada,
  onCancelar,
}: {
  prep: PreparacionTanda;
  onCreada: (tanda: Tanda) => void;
  onCancelar: () => void;
}) {
  const [paso, setPaso] = useState<Paso>("cantidad");
  const api = prep.canal === "api";
  const saldo = useDatos(() => (api ? tandasApi.mensajes() : Promise.resolve(null)), [api]);
  const [pack, setPack] = useState<PackMensajes | null>(null);
  // Sin comprar, los que no tengan saldo se mandan desde el WhatsApp del local.
  const [sinComprar, setSinComprar] = useState(false);
  const [cantidad, setCantidad] = useState(prep.recomendado);
  const sugerido = redondear((prep.presupuestoSugerido / Math.max(1, prep.recomendado)) * cantidad);
  const [monto, setMonto] = useState<number | null>(null);
  const presupuesto = monto ?? sugerido;
  const [armando, setArmando] = useState(false);
  const disponibles = saldo.data?.disponibles ?? 0;
  const faltanMensajes = api && !!saldo.data && disponibles < cantidad;
  const pasos: Paso[] = faltanMensajes ? ["cantidad", "mensajes", "beneficios"] : ["cantidad", "beneficios"];
  const indice = pasos.indexOf(paso);
  const costoMensajes = faltanMensajes && pack ? pack.precio : 0;

  async function armar() {
    setArmando(true);
    let tanda: Tanda;
    try {
      tanda = await tandasApi.crear(cantidad, presupuesto);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos armar la tanda. Probá de nuevo.");
      setArmando(false);
      return;
    }
    if (faltanMensajes && pack) {
      // La tanda ya quedó guardada: después de pagar, Mercado Pago vuelve directo a ella.
      try {
        const pago = await tandasApi.comprarPack(pack.id, `/dashboard/marketing/recompra?tanda=${tanda.id}`);
        window.location.assign(pago.url_pago);
        return;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "La tanda quedó armada, pero no pudimos abrir el pago del pack.");
      }
    }
    onCreada(tanda);
  }

  if (armando) {
    return (
      <div className="tanda-paso" role="status">
        <span className="tanda-armando" aria-hidden>
          {Array.from({ length: 5 }, (_, i) => <span key={i} style={{ animationDelay: `${i * 140}ms` }} />)}
        </span>
        <h2 className="mt-8 text-2xl font-bold tracking-tight sm:text-3xl">Armando {cantidad} mensajes</h2>
        {faltanMensajes && pack && <p className="mt-2 text-sm font-medium text-ink-2">Después te llevamos a pagar el pack.</p>}
        <p className="muted mx-auto mt-3 max-w-sm">
          Leemos qué pide cada uno, cada cuánto y qué día, y le escribimos algo pensado para esa persona.
        </p>
      </div>
    );
  }

  return (
    <div className="tanda-paso">
      <div className="mb-10 flex items-center justify-between">
        <Button variant="ghost" className="px-3" onClick={indice === 0 ? onCancelar : () => setPaso(pasos[indice - 1])}>
          <ArrowLeft size={16} />
          {indice === 0 ? "Cancelar" : "Atrás"}
        </Button>
        <span className="text-xs font-semibold tracking-[.12em] text-ink-3 uppercase">
          Paso {indice + 1} de {pasos.length}
        </span>
      </div>

      {paso === "cantidad" ? (
        <>
          <h2 className="text-2xl font-bold tracking-tight sm:text-[2rem] sm:leading-tight">
            ¿A cuántos clientes les escribís ahora?
          </h2>
          <p className="muted mx-auto mt-3 max-w-md">
            {prep.elegibles === 1
              ? "Hay 1 cliente al que le viene bien un mensaje hoy."
              : `Hay ${prep.elegibles} clientes a los que les viene bien un mensaje hoy. Empezamos por los que más conviene.`}
          </p>

          <div className="mt-10 flex items-center justify-center gap-5 sm:gap-8">
            <button
              type="button"
              className="tanda-mas-menos"
              aria-label="Uno menos"
              disabled={cantidad <= 1}
              onClick={() => setCantidad((c) => Math.max(1, c - 1))}
            >
              <Minus size={22} />
            </button>
            <output aria-live="polite" className="tanda-numero" aria-label={`${cantidad} clientes`}>
              {cantidad}
            </output>
            <button
              type="button"
              className="tanda-mas-menos"
              aria-label="Uno más"
              disabled={cantidad >= prep.maximo}
              onClick={() => setCantidad((c) => Math.min(prep.maximo, c + 1))}
            >
              <Plus size={22} />
            </button>
          </div>
          <p className="mt-1 text-sm font-medium text-ink-3">{cantidad === 1 ? "cliente" : "clientes"}</p>

          {prep.maximo > 1 && (
            <input
              type="range"
              min={1}
              max={prep.maximo}
              value={cantidad}
              onChange={(e) => setCantidad(Number(e.target.value))}
              aria-label="Cantidad de clientes"
              className="tanda-rango mx-auto mt-8 block w-full max-w-sm"
            />
          )}

          <button
            type="button"
            onClick={() => setCantidad(prep.recomendado)}
            className={cn("tanda-recomendado", cantidad === prep.recomendado && "tanda-recomendado--activo")}
          >
            <Sparkles size={15} />
            {cantidad === prep.recomendado ? `${prep.recomendado} es lo recomendado` : `Recomendado: ${prep.recomendado}`}
          </button>
          <p className="mx-auto mt-3 max-w-sm text-xs text-ink-3">
            Son los que están justo en su momento de volver a pedir. Mandarlos lleva unos minutos.
          </p>

          {api && saldo.data && (
            <p className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm ring-1 ring-line">
              <MessageCircle size={15} className="text-emerald-600" />
              Tenés <b className="tabular-nums">{disponibles}</b> mensajes de marketing
            </p>
          )}

          <div>
            <Button className="mt-8 min-w-48" disabled={api && saldo.loading} onClick={() => setPaso(faltanMensajes ? "mensajes" : "beneficios")}>
              Seguir
              <ArrowRight size={16} />
            </Button>
          </div>
        </>
      ) : paso === "mensajes" ? (
        <>
          <h2 className="text-2xl font-bold tracking-tight sm:text-[2rem] sm:leading-tight">
            {disponibles === 0 ? "No tenés mensajes de marketing" : `Te faltan ${cantidad - disponibles} mensajes de marketing`}
          </h2>
          <p className="muted mx-auto mt-3 max-w-md">
            Cada mensaje que sale por el WhatsApp automático usa 1 mensaje de marketing. Tenés {disponibles} y esta tanda
            necesita {cantidad}. Elegí un pack: su precio se suma al costo de la tanda.
          </p>
          <div className="mt-8 text-left">
            <Packs
              packs={saldo.data?.packs ?? []}
              elegido={pack?.id ?? null}
              necesarios={cantidad - disponibles}
              onElegir={(p) => {
                setPack(p);
                setSinComprar(false);
              }}
            />
          </div>
          {!saldo.data?.packs.length && <p className="muted mt-6">No hay packs disponibles ahora. Escribinos y te ayudamos.</p>}
          <div>
            <Button className="mt-10 min-w-48" disabled={!pack} onClick={() => setPaso("beneficios")}>
              Seguir
              <ArrowRight size={16} />
            </Button>
          </div>
          <button
            type="button"
            className="mt-4 text-sm font-medium text-ink-3 underline underline-offset-4"
            onClick={() => {
              setPack(null);
              setSinComprar(true);
              setPaso("beneficios");
            }}
          >
            Seguir sin comprar: los que no tengan saldo los mando desde mi WhatsApp
          </button>
        </>
      ) : (
        <>
          <h2 className="text-2xl font-bold tracking-tight sm:text-[2rem] sm:leading-tight">
            ¿Cuánto querés invertir en {prep.conPuntos ? "beneficios" : "descuentos"}?
          </h2>
          <p className="muted mx-auto mt-3 max-w-md">
            Es lo máximo que se puede ir si todos usan su beneficio. Lo repartimos donde más rinde: no a todos les
            toca y a nadie se le va todo.
          </p>

          <label className="tanda-monto mx-auto mt-10">
            <span className="sr-only">Monto a invertir</span>
            <span aria-hidden>$</span>
            <input
              inputMode="numeric"
              style={{ width: `${Math.max(1, (presupuesto ? presupuesto.toLocaleString("es-AR") : "0").length) + 0.4}ch` }}
              value={presupuesto ? presupuesto.toLocaleString("es-AR") : "0"}
              onChange={(e) => setMonto(Math.min(10_000_000, Number(e.target.value.replace(/\D/g, "")) || 0))}
              onFocus={(e) => e.target.select()}
            />
          </label>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {[
              { valor: 0, texto: "Sin beneficios" },
              ...(sugerido > 0 ? [{ valor: sugerido, texto: `${pesos(sugerido)} · sugerido` }] : []),
              ...(sugerido > 0 ? [{ valor: redondear(sugerido * 2), texto: pesos(redondear(sugerido * 2)) }] : []),
            ].map((o) => (
              <button
                key={o.valor}
                type="button"
                aria-pressed={presupuesto === o.valor}
                onClick={() => setMonto(o.valor)}
                className={cn("tanda-opcion", presupuesto === o.valor && "tanda-opcion--activa")}
              >
                {o.texto}
              </button>
            ))}
          </div>

          <p className="mx-auto mt-6 max-w-md rounded-2xl bg-surface px-4 py-3 text-sm text-ink-2 ring-1 ring-line">
            {presupuesto === 0
              ? prep.conPuntos
                ? "Sin bonus: cada mensaje le cuenta cuántos puntos suma con lo que más le gusta, o qué tan cerca está de un premio."
                : "Los mensajes van sin descuentos. Igual son personales y llevan su pedido armado."
              : prep.conPuntos
                ? "Como tenés el club de puntos, los beneficios son puntos extra con una compra mínima: premian la vuelta sin regalar margen."
                : "Puede tocar envío gratis, un monto de regalo o un porcentaje por tiempo limitado, según quién sea."}
          </p>
          {api && (
            <dl className="tanda-costo mx-auto mt-6 max-w-md">
              <p className="mb-2 text-left text-xs font-semibold tracking-[.12em] text-ink-3 uppercase">Costo de esta tanda</p>
              <div>
                <dt>Mensajes de marketing</dt>
                <dd>
                  {faltanMensajes && pack
                    ? `${pesos(pack.precio)} · pack de ${pack.cantidad}`
                    : faltanMensajes || sinComprar
                      ? disponibles
                        ? `Sin comprar · ${disponibles} automáticos, el resto desde tu WhatsApp`
                        : "Sin comprar · los mandás desde tu WhatsApp"
                      : `Incluidos · usa ${cantidad} de tus ${disponibles}`}
                </dd>
              </div>
              <div>
                <dt>Beneficios</dt>
                <dd>{presupuesto ? `hasta ${pesos(presupuesto)}` : "$0"}</dd>
              </div>
              <div className="tanda-costo-total">
                <dt>Total</dt>
                <dd>{costoMensajes + presupuesto ? `${presupuesto ? "hasta " : ""}${pesos(costoMensajes + presupuesto)}` : "$0"}</dd>
              </div>
              {faltanMensajes && pack && (
                <p className="mt-2 text-left text-xs text-ink-3">
                  El pack se paga ahora por Mercado Pago; los beneficios, sólo si los clientes los usan. Te sobran{" "}
                  {disponibles + pack.cantidad - cantidad} mensajes para las próximas tandas.
                </p>
              )}
            </dl>
          )}

          <Button className="mt-10 min-w-56" onClick={armar}>
            <Sparkles size={16} />
            {faltanMensajes && pack
              ? `Armar la tanda y pagar ${pesos(pack.precio)}`
              : `Armar ${cantidad} ${cantidad === 1 ? "mensaje" : "mensajes"}`}
          </Button>
          {api && (
            <p className="mx-auto mt-3 max-w-md text-xs text-ink-3">
              Salen por el WhatsApp automático de {prep.localNombre}, de a uno y sólo cuando apretás Enviar.
            </p>
          )}
        </>
      )}
    </div>
  );
}
