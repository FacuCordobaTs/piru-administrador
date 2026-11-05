import { apiLocal } from "./api";
import { useDatos } from "./useDatos";
import type { SucursalGrowth } from "./tipos";
/** Las sucursales del local, para los filtros (`/marketing-local/sucursales`: nombre y estado). */
export function useSucursales() {
  const { data } = useDatos(
    () =>
      apiLocal<SucursalGrowth[]>("/marketing-local/sucursales").catch(() => []),
    [],
  );
  return data ?? [];
}
/** Sólo vale filtrar cuando el local tiene más de una sucursal abierta. */
export const sucursalesParaFiltrar = (sucursales: SucursalGrowth[]) => {
  const activas = sucursales.filter((s) => s.activo !== false);
  return activas.length > 1 ? activas : [];
};
