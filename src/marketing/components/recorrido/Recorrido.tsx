import { useMemo, useRef, useState, type PointerEvent } from "react";
import { useLocation, useNavigate } from "react-router";
import { Dialog } from "radix-ui";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CircleCheck,
  Link2,
  MapPin,
  Repeat2,
  Route,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useRecorrido } from "../../store/recorrido";
import { marcarRecorridoVisto, useClaveRecorrido } from "../../lib/recorridoVisto";
import { GUIA } from "../../lib/rutas";
import { cn } from "../ui";
import { Circuito } from "../escenas/Circuito";
import { LinkMedido } from "../escenas/LinkMedido";
import { FichaCliente } from "../escenas/FichaCliente";
import { RitmoCliente } from "../escenas/RitmoCliente";
import { EnvioHoy } from "../escenas/EnvioHoy";
import { MapaDias } from "../escenas/MapaDias";
import { ClubPuntos } from "../escenas/ClubPuntos";
import { MapaApp } from "../escenas/MapaApp";
import { pasosDelRecorrido, type ClaveEscena, type PasoRecorrido } from "./pasos";
import { PortalMarketing } from "../portal";
import "./recorrido.css";

const ICONOS: Record<string, LucideIcon> = {
  circuito: Route,
  campanas: Link2,
  clientes: Users,
  segmentos: Activity,
  recompra: Repeat2,
  "dias-flojos": CalendarDays,
  puntos: Sparkles,
  listo: CircleCheck,
};

function EscenaDelPaso({ clave }: { clave: ClaveEscena }) {
  switch (clave) {
    case "circuito":
      return <Circuito siempreActiva />;
    case "link":
      return <LinkMedido siempreActiva />;
    case "ficha":
      return <FichaCliente siempreActiva />;
    case "ritmo":
      return <RitmoCliente siempreActiva />;
    case "hoy":
      return <EnvioHoy siempreActiva />;
    case "dias":
      return <MapaDias siempreActiva />;
    case "puntos":
      return <ClubPuntos siempreActiva />;
    case "app":
      return <MapaApp siempreActiva />;
  }
}

function Progreso({
  pasos,
  actual,
  ir,
  className,
}: {
  pasos: PasoRecorrido[];
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
 * El recorrido de bienvenida de Marketing: se abre desde la barra de secciones ("Ver el recorrido")
 * o desde la guía. Cerrarlo de cualquier forma lo marca como visto para ese local, en este navegador.
 */
export function Recorrido() {
  const { abierto, vez, cerrar, local } = useRecorrido();
  const clave = useClaveRecorrido();
  const pasos = useMemo(() => pasosDelRecorrido({ local }), [local]);
  const [i, setI] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  // Cada apertura empieza del principio (sin efecto: el reinicio ocurre antes de pintar).
  const [apertura, setApertura] = useState(vez);
  if (apertura !== vez) {
    setApertura(vez);
    setI(0);
    setDir(1);
  }
  const siguiente = useRef<HTMLButtonElement>(null);
  const toque = useRef<number | null>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const paso = pasos[i] ?? pasos[0];
  const ultimo = i === pasos.length - 1;
  const Icono = ICONOS[paso.id] ?? Route;

  function ir(j: number) {
    if (j < 0 || j >= pasos.length || j === i) return;
    setDir(j > i ? 1 : -1);
    setI(j);
  }
  function terminar() {
    if (clave) marcarRecorridoVisto(clave);
    cerrar();
  }
  function leerGuia() {
    terminar();
    if (pathname !== GUIA) navigate(GUIA);
  }
  // Deslizar con el dedo sobre la ilustración también avanza o vuelve.
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
    <Dialog.Root open={abierto} onOpenChange={(o) => !o && terminar()}>
      <PortalMarketing>
        <Dialog.Overlay className="recorrido-fondo fixed inset-0 z-[80] bg-[#120F0D]/60 backdrop-blur-[3px]" />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            siguiente.current?.focus({ preventScroll: true });
          }}
          onPointerDownOutside={(e) => e.preventDefault()}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") ir(i + 1);
            else if (e.key === "ArrowLeft") ir(i - 1);
          }}
          className="recorrido-caja fixed inset-0 z-[90] flex flex-col overflow-hidden bg-paper outline-none md:inset-auto md:left-1/2 md:top-1/2 md:h-[min(620px,calc(100dvh-48px))] md:w-[min(1000px,calc(100vw-48px))] md:-translate-x-1/2 md:-translate-y-1/2 md:flex-row md:rounded-[28px] md:shadow-[0_40px_100px_-30px_rgb(0_0_0/.55)]"
        >
          <Dialog.Title className="sr-only">
            Recorrido por Marketing
          </Dialog.Title>

          <div
            className="escenario relative h-[46dvh] min-h-[250px] shrink-0 overflow-hidden md:h-auto md:min-h-0 md:w-[54%]"
            style={{ touchAction: "pan-y" }}
            onPointerDown={empezarToque}
            onPointerUp={terminarToque}
            onPointerCancel={() => (toque.current = null)}
          >
            <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-3 px-4 pt-[max(12px,env(safe-area-inset-top))] md:hidden">
              <Progreso pasos={pasos} actual={i} ir={ir} />
              {!ultimo && (
                <button
                  type="button"
                  onClick={terminar}
                  className="min-h-9 rounded-full bg-surface/80 px-3 text-[13px] font-semibold text-ink-2 ring-1 ring-line backdrop-blur"
                >
                  Saltar
                </button>
              )}
            </div>
            <div className="r-marco absolute inset-x-0 bottom-7 top-14 px-5 md:inset-0 md:bottom-8 md:p-10">
              <div key={`${apertura}-${i}`} className="r-escena grid h-full place-items-center">
                <EscenaDelPaso clave={paso.escena} />
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
              {!ultimo && (
                <button
                  type="button"
                  onClick={terminar}
                  className="min-h-9 rounded-full px-3 text-sm font-semibold text-ink-3 hover:bg-sand hover:text-ink"
                >
                  Saltar
                </button>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto md:mt-8" aria-live="polite">
              <div key={`${apertura}-${i}`} data-dir={dir} className="r-texto">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-deep">
                    <Icono size={14} strokeWidth={2.3} />
                    {paso.etiqueta}
                  </span>
                  {paso.modulo && (
                    <span className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink-3 ring-1 ring-line">
                      {paso.modulo}
                    </span>
                  )}
                </p>
                <h2 className="mt-4 text-[26px] font-bold leading-[1.12] tracking-tight text-ink md:text-[34px]">
                  {paso.titulo}
                </h2>
                <p className="mt-3 text-[15.5px] leading-relaxed text-ink-2 md:mt-4 md:text-[17px]">
                  {paso.texto}
                </p>
                {paso.donde && (
                  <p className="mt-4 flex items-center gap-2 text-sm text-ink-3">
                    <MapPin size={15} className="shrink-0 text-brand" />
                    <span>
                      Lo encontrás en <strong className="font-semibold text-ink">{paso.donde}</strong>
                    </span>
                  </p>
                )}
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
                <button
                  type="button"
                  className="btn btn-secondary px-4 sm:px-5"
                  onClick={leerGuia}
                >
                  <BookOpen size={16} className="hidden sm:block" />
                  Leer la guía
                </button>
              )}
              <button
                ref={siguiente}
                type="button"
                className="btn min-w-[132px]"
                onClick={() => (ultimo ? terminar() : ir(i + 1))}
              >
                {ultimo ? "Empezar" : "Siguiente"}
                {!ultimo && <ArrowRight size={16} />}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </PortalMarketing>
    </Dialog.Root>
  );
}
