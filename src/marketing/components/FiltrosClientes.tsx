import {
  FILTROS_CLIENTES_VACIOS,
  SEGMENTOS_CLIENTES,
  periodoClientes,
  type FiltrosClientes,
  type OrdenClientes,
  type PeriodoClientes,
} from "../lib/filtrosClientes";
import { segmentoNombre } from "../lib/formato";
import type {
  CampanaCrecimiento,
  CodigoDescuentoGrowth,
  SucursalGrowth,
} from "../lib/tipos";
import { Button, Chip, Modal } from "./ui";
const PERIODOS: [PeriodoClientes, string][] = [
  ["todo", "Todo el historial"],
  ["7", "Últimos 7 días"],
  ["30", "Últimos 30 días"],
  ["mes", "Este mes"],
];
/**
 * Los filtros de la lista de clientes, en un diálogo: segmento, orden, período, sucursal, campaña
 * y cupón; con el club activo se pueden ver sólo los que tienen puntos.
 */
export function FiltrosClientesDialog({
  open,
  onOpenChange,
  filtros,
  onChange,
  sucursales,
  campanas,
  cupones,
  total,
  club,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  filtros: FiltrosClientes;
  onChange: (f: FiltrosClientes) => void;
  /** Ya filtradas por `sucursalesParaFiltrar`: vacío oculta el selector. */
  sucursales: SucursalGrowth[];
  campanas: CampanaCrecimiento[];
  cupones: CodigoDescuentoGrowth[];
  total: number;
  /** El local tiene Retención: hay clientes con puntos. */
  club: boolean;
}) {
  const cambiar = (parcial: Partial<FiltrosClientes>) =>
    onChange({ ...filtros, ...parcial });
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Filtros">
      <div className="grid gap-6">
        <label>
          Segmento
          <select
            value={filtros.segmento}
            onChange={(e) => cambiar({ segmento: e.target.value })}
          >
            <option value="">Todos los segmentos</option>
            {SEGMENTOS_CLIENTES.map((s) => (
              <option key={s} value={s}>
                {segmentoNombre[s]}
              </option>
            ))}
          </select>
        </label>
        {club && (
          <label className="flex items-center gap-3">
            <input
              className="size-5 min-h-0 w-5"
              type="checkbox"
              checked={filtros.conPuntos}
              onChange={(e) => cambiar({ conPuntos: e.target.checked })}
            />
            Sólo clientes del club (con puntos)
          </label>
        )}
        <label>
          Ordenar por
          <select
            value={filtros.orden}
            onChange={(e) =>
              cambiar({ orden: e.target.value as OrdenClientes })
            }
          >
            <option value="recientes">Más recientes</option>
            <option value="pedidos">Más pedidos</option>
            <option value="gasto">Mayor gasto</option>
            <option value="nombre">Alfabético (A → Z)</option>
            {club && <option value="puntos">Más puntos</option>}
          </select>
        </label>
        <>
        <fieldset className="grid gap-3">
          <legend className="mb-2 text-sm font-medium text-ink-2">
            Pidieron en este período
          </legend>
          <div className="flex flex-wrap gap-2">
            {PERIODOS.map(([periodo, texto]) => {
              const rango = periodoClientes(periodo);
              return (
                <Chip
                  key={periodo}
                  activo={
                    rango.desde === filtros.desde &&
                    rango.hasta === filtros.hasta
                  }
                  onClick={() => cambiar(rango)}
                >
                  {texto}
                </Chip>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label>
              Desde
              <input
                type="date"
                value={filtros.desde}
                max={filtros.hasta || undefined}
                onChange={(e) => cambiar({ desde: e.target.value })}
              />
            </label>
            <label>
              Hasta
              <input
                type="date"
                value={filtros.hasta}
                min={filtros.desde || undefined}
                onChange={(e) => cambiar({ hasta: e.target.value })}
              />
            </label>
          </div>
        </fieldset>
        {sucursales.length > 0 && (
          <label>
            Sucursal
            <select
              value={filtros.sucursalId ?? ""}
              onChange={(e) =>
                cambiar({
                  sucursalId: e.target.value ? Number(e.target.value) : null,
                })
              }
            >
              <option value="">Todas las sucursales</option>
              {sucursales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Pidieron por una campaña
          <select
            value={filtros.campana ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              cambiar(
                v
                  ? {
                      campana: v === "organico" ? "organico" : Number(v),
                      cuponId: null,
                    }
                  : { campana: null },
              );
            }}
          >
            <option value="">Todas</option>
            <option value="organico">Sin campaña (orgánico)</option>
            {campanas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Usaron un cupón
          <select
            value={filtros.cuponId ?? ""}
            onChange={(e) =>
              cambiar(
                e.target.value
                  ? { cuponId: Number(e.target.value), campana: null }
                  : { cuponId: null },
              )
            }
          >
            <option value="">Todos</option>
            {cupones.map((c) => (
              <option key={c.id} value={c.id}>
                {c.codigo}
              </option>
            ))}
          </select>
          <span className="muted">
            Campaña y cupón no se combinan: elegir uno limpia el otro.
          </span>
        </label>
        </>
        <div className="sticky bottom-0 grid gap-3 bg-paper pt-2 sm:grid-cols-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onChange(FILTROS_CLIENTES_VACIOS)}
          >
            Limpiar filtros
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Ver {total} {total === 1 ? "cliente" : "clientes"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
