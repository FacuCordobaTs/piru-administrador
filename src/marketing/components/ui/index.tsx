import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link } from "react-router";
import { Dialog } from "radix-ui";
import { cva } from "class-variance-authority";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { X, Copy, AlertCircle, BookOpen } from "lucide-react";
import { AyudaPantalla } from "../AyudaPantalla";
import type { Pantalla } from "../../lib/ayudaPantallas";
import { toast } from "sonner";
import { GUIA } from "../../lib/rutas";
import { PortalMarketing } from "../portal";
export const cn = (...v: Parameters<typeof clsx>) => twMerge(clsx(...v));
const button = cva("btn", {
  variants: {
    variant: {
      primary: "",
      secondary: "btn-secondary",
      ghost: "btn-ghost",
      danger: "btn-danger",
    },
  },
});
export function Button({
  variant = "primary",
  className,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return <button {...p} className={cn(button({ variant }), className)} />;
}
/** Una opción de un grupo que se elige con un toque (período, voz, toque). */
export function Chip({
  activo,
  className,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { activo: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      {...p}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium ring-1",
        activo
          ? "bg-ink text-white ring-ink"
          : "bg-surface text-ink-2 ring-line hover:bg-sand",
        className,
      )}
    />
  );
}
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={cn("card", className)}>{children}</section>;
}
export function Estado({
  skeleton,
  loading,
  error,
  reintentar,
}: {
  skeleton?: ReactNode;
  loading?: boolean;
  error?: string | null;
  reintentar?: () => void;
}) {
  if (loading && skeleton) return skeleton;
  if (loading)
    return (
      <div
        role="status"
        aria-label="Cargando"
        className="grid gap-4 sm:grid-cols-2"
      >
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card h-40 animate-pulse bg-sand" />
        ))}
      </div>
    );
  if (error)
    return (
      <Card>
        <AlertCircle className="mb-3 text-brand-deep" />
        <h2>No pudimos cargar esta pantalla</h2>
        <p role="alert" className="muted my-3">
          {error}
        </p>
        <Button onClick={reintentar}>Volver a intentar</Button>
      </Card>
    );
  return null;
}
export function Empty({
  title,
  text,
  children,
}: {
  title: string;
  text?: string;
  children?: ReactNode;
}) {
  return (
    <Card className="py-10 text-center">
      <h2>{title}</h2>
      {text && <p className="muted mt-2 mb-5">{text}</p>}
      {children}
    </Card>
  );
}
export function Header({
  title,
  sub,
  ayuda,
  pantalla,
  children,
}: {
  title: string;
  sub?: string;
  /** Con la clave de la pantalla, el título lleva un (?) que explica qué se hace ahí. */
  pantalla?: Pantalla;
  /** Un link a la sección de la guía que explica cómo funciona esta pantalla por dentro. */
  ayuda?: { seccion: string; texto: string };
  children?: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="flex items-center gap-3">
          <h1>{title}</h1>
          {pantalla && <AyudaPantalla pantalla={pantalla} />}
        </div>
        {sub && <p className="muted mt-2">{sub}</p>}
        {ayuda && (
          <Link
            to={`${GUIA}#${ayuda.seccion}`}
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 underline decoration-line underline-offset-4 hover:decoration-ink-3"
          >
            <BookOpen size={14} className="text-brand-deep" />
            {ayuda.texto}
          </Link>
        )}
      </div>
      {children}
    </header>
  );
}
export function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <Card>
      <p className="label">{label}</p>
      <p className="stat my-3">{value}</p>
      {detail && <p className="muted">{detail}</p>}
    </Card>
  );
}
export function Sheet({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <PortalMarketing>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed z-50 bottom-0 left-0 right-0 max-h-[90dvh] overflow-y-auto rounded-t-3xl bg-paper p-6 pb-10 sm:bottom-0 sm:top-0 sm:left-auto sm:w-[520px] sm:max-h-none sm:rounded-none"
        >
          <div className="mb-6 flex items-center justify-between gap-4">
            <Dialog.Title className="text-xl font-bold">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" aria-label="Cerrar">
                <X size={20} />
              </Button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </PortalMarketing>
    </Dialog.Root>
  );
}
export function Modal({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <PortalMarketing>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed z-50 top-1/2 left-1/2 w-[calc(100%-32px)] max-w-2xl max-h-[90dvh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl bg-paper p-6 shadow-xl"
        >
          <div className="mb-6 flex items-center justify-between gap-4">
            <Dialog.Title className="text-xl font-bold">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" aria-label="Cerrar">
                <X size={20} />
              </Button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </PortalMarketing>
    </Dialog.Root>
  );
}
/**
 * Confirmación de una acción que no se deshace. Va por encima de las hojas (z-60/70), así que se
 * puede abrir desde adentro de una. `onConfirm` maneja sus propios errores (por ejemplo con
 * `accion`): al terminar, el diálogo se cierra.
 */
export function Confirmar({
  open,
  onOpenChange,
  title,
  text,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  text: string;
  confirmLabel: string;
  onConfirm: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <PortalMarketing>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-ink/40 backdrop-blur-sm" />
        <Dialog.Content
          role="alertdialog"
          className="fixed top-1/2 left-1/2 z-[70] w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-paper p-6 shadow-xl"
        >
          <Dialog.Title className="text-lg font-bold">{title}</Dialog.Title>
          <Dialog.Description className="muted mt-2">{text}</Dialog.Description>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Dialog.Close asChild>
              <Button variant="secondary" disabled={busy}>
                Cancelar
              </Button>
            </Dialog.Close>
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                } finally {
                  setBusy(false);
                  onOpenChange(false);
                }
              }}
            >
              {busy ? "Un momento…" : confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </PortalMarketing>
    </Dialog.Root>
  );
}
export async function copiar(texto: string) {
  try {
    await navigator.clipboard.writeText(texto);
    toast.success("Copiado");
  } catch {
    toast.error("No pudimos copiar. Seleccioná el texto y copialo.");
  }
}
export function CopyButton({
  value,
  label = "Copiar",
}: {
  value: string;
  label?: string;
}) {
  return (
    <Button type="button" variant="secondary" onClick={() => copiar(value)}>
      <Copy size={16} />
      {label}
    </Button>
  );
}
export function Burbuja({ texto, acortarLinks = false }: { texto: string; acortarLinks?: boolean }) {
  return (
    <div className="wa-preview">
      <div className="wa-bubble min-w-0 [overflow-wrap:anywhere]">
        {acortarLinks ? texto.split(/(https?:\/\/[^\s]+)/g).map((parte, i) =>
          /^https?:\/\//.test(parte) ? (
            <span key={i} title={parte} className="inline-block max-w-full truncate align-bottom">{parte.length > 48 ? parte.slice(0, 45) + "..." : parte}</span>
          ) : parte,
        ) : texto}
      </div>
    </div>
  );
}
export function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const points = values
    .map(
      (v, i) =>
        `${(i / Math.max(values.length - 1, 1)) * 180},${55 - (v / max) * 45}`,
    )
    .join(" ");
  return (
    <svg
      role="img"
      aria-label="Ventas de las últimas ocho semanas"
      className="h-16 w-44"
      viewBox="0 0 180 65"
    >
      <polyline
        fill="none"
        stroke="#FF7A00"
        strokeWidth="3"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}
export async function accion(fn: () => Promise<unknown>, success = "Listo") {
  try {
    await fn();
    toast.success(success);
  } catch (e) {
    toast.error(
      e instanceof Error ? e.message : "No pudimos completar la acción.",
    );
  }
}
