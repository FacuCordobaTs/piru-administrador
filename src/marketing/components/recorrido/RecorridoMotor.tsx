import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Link } from "react-router";
import { Dialog } from "radix-ui";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Hourglass,
  MessageCircle,
  ShieldCheck,
  Repeat2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../ui";
import { RitmoHabitual, FueraDeRitmo, DiaHabitual, SaleDeAgenda } from "../escenas/MotorRecompra";
import { Escalera } from "../escenas/Escalera";
import { EnvioHoy } from "../escenas/EnvioHoy";
import { GUIA } from "../../lib/rutas";
import { PortalMarketing } from "../portal";
import "./recorrido.css";

interface PasoMotor {
  id: string;
  etiqueta: string;
  icono: LucideIcon;
  titulo: string;
  texto: string;
  Escena: (p: { siempreActiva?: boolean }) => ReactNode;
}

/**
 * Cómo funciona el motor de recompra, paso a paso. Repite reglas de la guía (sección "motor") y de
 * backend/src/lib/clientes-rfm.ts y recetas-recompra.ts: si cambia una regla, se actualizan todas.
 */
const PASOS_MOTOR: PasoMotor[] = [
  {
    id: "ritmo",
    etiqueta: "Su ritmo",
    icono: Activity,
    titulo: "Cada cliente tiene su ritmo",
    texto:
      "Piru mira cuántos días pasan entre los pedidos de cada cliente y se queda con el punto medio: ese es su ritmo habitual. Martina pide cada 12 días; otro cliente, cada 25. Con un solo pedido todavía no hay ritmo: por eso esos clientes van aparte, como «Primer pedido».",
    Escena: RitmoHabitual,
  },
  {
    id: "fuera",
    etiqueta: "Se pasó",
    icono: Hourglass,
    titulo: "Cuando se pasa de su ritmo, Piru lo nota",
    texto:
      "Si pasa una vez y media su ritmo sin pedir, figura como «Se está yendo» y entra a la agenda. A las 3 veces, «Hace tiempo no viene»; a las 6, «Dejó de pedir». En la lista de Hoy ves cuántos días se pasó cada uno.",
    Escena: FueraDeRitmo,
  },
  {
    id: "dia",
    etiqueta: "Su día",
    icono: CalendarDays,
    titulo: "Le escribís el día que suele pedir",
    texto: "Cada mensaje se agenda el día de la semana y a la hora en que ese cliente suele pedir. Los que dejaron de pedir se reparten en los días con menos movimiento de tu local. Por eso Hoy es una semana: podés mirar Mañana y los días siguientes.",
    Escena: DiaHabitual,
  },
  {
    id: "escalera",
    etiqueta: "3 mensajes",
    icono: Repeat2,
    titulo: "Si no vuelve, llega el siguiente",
    texto:
      "Hasta tres mensajes: el primero sin descuento, el segundo con 10 % y el tercero con 20 % por 48 horas. El descuento viaja en el link y se aplica solo. Entre uno y otro pasan los días configurados, nunca menos de 48 horas.",
    Escena: Escalera,
  },
  {
    id: "sale",
    etiqueta: "Si vuelve",
    icono: ShieldCheck,
    titulo: "Si vuelve a pedir, sale de la agenda",
    texto:
      "Un pedido nuevo lo saca de la cola y su ritmo vuelve a contar desde ahí. Además, Piru cuida la base: nunca más de 4 mensajes en 30 días a la misma persona, 48 horas de descanso entre uno y otro, y quien pidió la baja no recibe más.",
    Escena: SaleDeAgenda,
  },
  {
    id: "hoy",
    etiqueta: "Mandar",
    icono: MessageCircle,
    titulo: "Vos sólo mandás y marcás",
    texto: "Abrí WhatsApp desde el dispositivo de tu local, mandá el mensaje en el chat de siempre y marcalo como enviado: eso agenda el siguiente. Arrancá por los mejores para escribirle, arriba de todo.",
    Escena: EnvioHoy,
  },
];

function Progreso({
  pasos,
  actual,
  ir,
  className,
}: {
  pasos: PasoMotor[];
  actual: number;
  ir: (i: number) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-1 items-center gap-1.5", className)}>
      {pasos.map((p, j) => (
        <button
          key={p.id}
          type="button"
          onClick={() => ir(j)}
          aria-label={`Paso ${j + 1}: ${p.etiqueta}`}
          aria-current={j === actual ? "step" : undefined}
          className="relative h-6 flex-1"
        >
          <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-ink/10">
            <span
              key={j === actual ? `actual-${actual}` : "fijo"}
              className={cn(
                "block h-full rounded-full bg-brand",
                j < actual ? "w-full" : j === actual ? "r-progreso w-full" : "w-0",
              )}
            />
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * El contenido del (?) de Hoy: un recorrido corto por el motor de recompra, con el mismo formato
 * que el de bienvenida. Va dentro de un `Dialog.Root` (AyudaPantalla) y empieza del principio cada
 * vez que se abre, porque el portal se desmonta al cerrar.
 */
export function RecorridoMotor({
  guia,
  cerrar,
}: {
  guia: string;
  cerrar: () => void;
}) {
  const pasos = PASOS_MOTOR;
  const [i, setI] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const siguiente = useRef<HTMLButtonElement>(null);
  const toque = useRef<number | null>(null);
  const paso = pasos[i];
  const ultimo = i === pasos.length - 1;
  const Icono = paso.icono;

  function ir(j: number) {
    if (j < 0 || j >= pasos.length || j === i) return;
    setDir(j > i ? 1 : -1);
    setI(j);
  }
  function empezarToque(e: PointerEvent) {
    if (e.pointerType !== "mouse") toque.current = e.clientX;
  }
  function terminarToque(e: PointerEvent) {
    if (toque.current === null) return;
    const dx = e.clientX - toque.current;
    toque.current = null;
    if (dx < -50) ir(i + 1);
    else if (dx > 50) ir(i - 1);
  }

  return (
    <PortalMarketing>
      <Dialog.Overlay className="recorrido-fondo fixed inset-0 z-[80] bg-[#120F0D]/60 backdrop-blur-[3px]" />
      <Dialog.Content
        aria-describedby={undefined}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          siguiente.current?.focus({ preventScroll: true });
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") ir(i + 1);
          else if (e.key === "ArrowLeft") ir(i - 1);
        }}
        className="recorrido-caja fixed inset-0 z-[90] flex flex-col overflow-hidden bg-paper outline-none md:inset-auto md:left-1/2 md:top-1/2 md:h-[min(620px,calc(100dvh-48px))] md:w-[min(1000px,calc(100vw-48px))] md:-translate-x-1/2 md:-translate-y-1/2 md:flex-row md:rounded-[28px] md:shadow-[0_40px_100px_-30px_rgb(0_0_0/.55)]"
      >
        <Dialog.Title className="sr-only">Cómo funciona el motor de recompra</Dialog.Title>

        <div
          className="escenario relative h-[46dvh] min-h-[250px] shrink-0 overflow-hidden md:h-auto md:min-h-0 md:w-[54%]"
          style={{ touchAction: "pan-y" }}
          onPointerDown={empezarToque}
          onPointerUp={terminarToque}
          onPointerCancel={() => (toque.current = null)}
        >
          <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-3 px-4 pt-[max(12px,env(safe-area-inset-top))] md:hidden">
            <Progreso pasos={pasos} actual={i} ir={ir} />
            <Dialog.Close className="min-h-9 rounded-full bg-surface/80 px-3 text-[13px] font-semibold text-ink-2 ring-1 ring-line backdrop-blur">
              Cerrar
            </Dialog.Close>
          </div>
          <div className="r-marco absolute inset-x-0 bottom-7 top-14 px-5 md:inset-0 md:bottom-8 md:p-10">
            <div key={i} className="r-escena grid h-full place-items-center">
              <paso.Escena siempreActiva />
            </div>
          </div>
          <span className="absolute bottom-2.5 right-4 text-[10.5px] font-medium text-ink-3">
            Datos de ejemplo
          </span>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-6 pb-[max(20px,env(safe-area-inset-bottom))] pt-5 md:px-10 md:pb-9 md:pt-9">
          <div className="hidden items-center justify-between md:flex">
            <p className="text-[13px] font-semibold tabular-nums text-ink-3">
              Paso {i + 1} de {pasos.length}
            </p>
            <Dialog.Close className="min-h-9 rounded-full px-3 text-sm font-semibold text-ink-3 hover:bg-sand hover:text-ink">
              Cerrar
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto md:mt-8" aria-live="polite">
            <div key={i} data-dir={dir} className="r-texto">
              <p className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-deep">
                  <Icono size={14} strokeWidth={2.3} />
                  {paso.etiqueta}
                </span>
                <span className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink-3 ring-1 ring-line">
                  Motor de recompra
                </span>
              </p>
              <h2 className="mt-4 text-[26px] font-bold leading-[1.12] tracking-tight text-ink md:text-[34px]">
                {paso.titulo}
              </h2>
              <p className="mt-3 text-[15.5px] leading-relaxed text-ink-2 md:mt-4 md:text-[17px]">
                {paso.texto}
              </p>
            </div>
          </div>
          <Progreso pasos={pasos} actual={i} ir={ir} className="mt-6 hidden flex-none md:flex" />
          <div className="mt-5 flex items-center gap-3">
            {i > 0 && (
              <button
                type="button"
                className="btn btn-ghost px-3"
                aria-label="Anterior"
                onClick={() => ir(i - 1)}
              >
                <ArrowLeft size={16} />
                <span className="hidden sm:inline">Anterior</span>
              </button>
            )}
            <span className="flex-1" />
            {ultimo && (
              <Link to={`${GUIA}#${guia}`} onClick={cerrar} className="btn btn-secondary px-4 sm:px-5">
                <BookOpen size={16} className="hidden sm:block" />
                Leer la guía
              </Link>
            )}
            <button
              ref={siguiente}
              type="button"
              className="btn min-w-[132px]"
              onClick={() => (ultimo ? cerrar() : ir(i + 1))}
            >
              {ultimo ? "Entendido" : "Siguiente"}
              {!ultimo && <ArrowRight size={16} />}
            </button>
          </div>
        </div>
      </Dialog.Content>
    </PortalMarketing>
  );
}
