import { useState } from "react";
import { ArrowLeft, ArrowRight, Minus, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button, cn } from "../ui";
import { pesos } from "../../lib/formato";
import { tandasApi, type PreparacionTanda, type Tanda } from "../../lib/tandas";

const redondear = (n: number) => Math.max(0, Math.round(n / 500) * 500);

/**
 * Las dos preguntas de una tanda, una por pantalla y centradas: a cuántos clientes escribirles
 * ahora y cuánto invertir en beneficios. Con eso el backend arma los mensajes.
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
  const [paso, setPaso] = useState<1 | 2>(1);
  const [cantidad, setCantidad] = useState(prep.recomendado);
  const sugerido = redondear((prep.presupuestoSugerido / Math.max(1, prep.recomendado)) * cantidad);
  const [monto, setMonto] = useState<number | null>(null);
  const presupuesto = monto ?? sugerido;
  const [armando, setArmando] = useState(false);

  async function armar() {
    setArmando(true);
    try {
      onCreada(await tandasApi.crear(cantidad, presupuesto));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos armar la tanda. Probá de nuevo.");
      setArmando(false);
    }
  }

  if (armando) {
    return (
      <div className="tanda-paso" role="status">
        <span className="tanda-armando" aria-hidden>
          {Array.from({ length: 5 }, (_, i) => <span key={i} style={{ animationDelay: `${i * 140}ms` }} />)}
        </span>
        <h2 className="mt-8 text-2xl font-bold tracking-tight sm:text-3xl">Armando {cantidad} mensajes</h2>
        <p className="muted mx-auto mt-3 max-w-sm">
          Leemos qué pide cada uno, cada cuánto y qué día, y le escribimos algo pensado para esa persona.
        </p>
      </div>
    );
  }

  return (
    <div className="tanda-paso">
      <div className="mb-10 flex items-center justify-between">
        <Button variant="ghost" className="px-3" onClick={paso === 1 ? onCancelar : () => setPaso(1)}>
          <ArrowLeft size={16} />
          {paso === 1 ? "Cancelar" : "Atrás"}
        </Button>
        <span className="text-xs font-semibold tracking-[.12em] text-ink-3 uppercase">Paso {paso} de 2</span>
      </div>

      {paso === 1 ? (
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

          <Button className="mt-10 min-w-48" onClick={() => setPaso(2)}>
            Seguir
            <ArrowRight size={16} />
          </Button>
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
          {prep.canal === "api" && (
            <p className="mx-auto mt-3 max-w-md text-xs text-ink-3">
              Salen por el WhatsApp automático de {prep.localNombre}, de a uno y sólo cuando apretás Enviar.
            </p>
          )}

          <Button className="mt-10 min-w-56" onClick={armar}>
            <Sparkles size={16} />
            Armar {cantidad} {cantidad === 1 ? "mensaje" : "mensajes"}
          </Button>
        </>
      )}
    </div>
  );
}
