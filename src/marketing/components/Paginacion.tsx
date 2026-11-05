import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./ui";
/**
 * Anterior y siguiente de una lista que el backend entrega por páginas. No se muestra si todo entra
 * en una sola. `nombre` es lo que se pagina ("clientes"): va en la etiqueta de la navegación.
 */
export function Paginacion({
  pagina,
  paginas,
  total,
  limite,
  nombre,
  onCambiar,
}: {
  pagina: number;
  paginas: number;
  total: number;
  limite: number;
  nombre: string;
  onCambiar: (pagina: number) => void;
}) {
  if (paginas <= 1) return null;
  const desde = (pagina - 1) * limite + 1;
  const hasta = Math.min(total, pagina * limite);
  return (
    <nav
      aria-label={`Páginas de ${nombre}`}
      className="mt-5 flex flex-wrap items-center justify-between gap-3"
    >
      <p className="muted tabular-nums" aria-live="polite">
        {desde}–{hasta} de {total}
      </p>
      <div className="flex items-center gap-2 sm:gap-3">
        <Button
          variant="secondary"
          className="px-4"
          disabled={pagina <= 1}
          aria-label="Página anterior"
          onClick={() => onCambiar(pagina - 1)}
        >
          <ChevronLeft size={16} />
          Anterior
        </Button>
        <span className="muted min-w-12 text-center tabular-nums">
          <span className="hidden sm:inline">Página </span>
          {pagina} de {paginas}
        </span>
        <Button
          variant="secondary"
          className="px-4"
          disabled={pagina >= paginas}
          aria-label="Página siguiente"
          onClick={() => onCambiar(pagina + 1)}
        >
          Siguiente
          <ChevronRight size={16} />
        </Button>
      </div>
    </nav>
  );
}
