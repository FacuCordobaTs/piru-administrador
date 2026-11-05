import type { ReactNode } from "react";
import { Link } from "react-router";
import { Info, Lightbulb, type LucideIcon } from "lucide-react";
import { cn } from "../ui";
import "./guia.css";

/** Una ilustración de la guía sobre el escenario, con su epígrafe. */
export function Figura({ children, pie }: { children: ReactNode; pie?: ReactNode }) {
  return (
    <figure className="my-8">
      <div className="escenario overflow-hidden rounded-[24px] px-3 py-6 ring-1 ring-line sm:px-8 sm:py-8">
        <div className="mx-auto max-w-[540px]">{children}</div>
      </div>
      {pie && (
        <figcaption className="mt-3 text-sm leading-relaxed text-ink-3">
          {pie}
        </figcaption>
      )}
    </figure>
  );
}

/** El recuadro con lo que conviene llevarse de una sección. */
export function Clave({
  titulo = "Lo importante",
  children,
}: {
  titulo?: string;
  children: ReactNode;
}) {
  return (
    <aside className="rounded-[20px] bg-brand-soft/70 p-5 ring-1 ring-brand/15 sm:p-6">
      <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[.09em] text-brand-deep">
        <Lightbulb size={15} />
        {titulo}
      </p>
      <ul className="guia-puntos mt-3">{children}</ul>
    </aside>
  );
}

/** Una aclaración al margen. */
export function Nota({
  children,
  icono: Icono = Info,
}: {
  children: ReactNode;
  icono?: LucideIcon;
}) {
  return (
    <div className="flex gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line">
      <Icono size={18} className="mt-1 shrink-0 text-ink-3" />
      <div className="text-[15px] leading-relaxed text-ink-2">{children}</div>
    </div>
  );
}

/** Pasos numerados unidos por una línea: el orden en que pasan las cosas. */
export function Pasos({
  items,
}: {
  items: { titulo: string; texto: ReactNode; icono?: LucideIcon }[];
}) {
  return (
    <ol className="guia-pasos mt-6 grid gap-5">
      {items.map((p, i) => (
        <li key={p.titulo} className="relative flex gap-4">
          <span className="relative z-10 grid size-10 shrink-0 place-items-center rounded-2xl bg-surface text-[15px] font-bold text-ink shadow-[0_0_0_1px_#ECE4D8,0_6px_14px_-8px_rgb(40_24_8/.35)]">
            {p.icono ? <p.icono size={18} className="text-brand-deep" /> : i + 1}
          </span>
          <div className="pt-1.5">
            <p className="text-[16px] font-semibold text-ink">{p.titulo}</p>
            <div className="mt-1 text-[15px] leading-relaxed text-ink-2">
              {p.texto}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Dónde está en la app. Para el dueño (un solo local) es un link directo a la pantalla. */
export function Donde({
  texto,
  icono: Icono,
  ruta,
}: {
  texto: string;
  icono: LucideIcon;
  ruta?: string | null;
}) {
  const clase =
    "inline-flex min-h-9 items-center gap-2 rounded-full bg-surface px-3.5 text-[13.5px] font-semibold text-ink ring-1 ring-line";
  return ruta ? (
    <Link to={ruta} className={cn(clase, "hover:bg-sand")}>
      <Icono size={15} className="text-brand-deep" />
      {texto} →
    </Link>
  ) : (
    <span className={clase}>
      <Icono size={15} className="text-brand-deep" />
      {texto}
    </span>
  );
}

/** El módulo que hace falta para lo que explica la sección. */
export function ConModulo({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-surface px-2.5 py-1 text-[12px] font-semibold text-ink-3 ring-1 ring-line">
      {children}
    </span>
  );
}
