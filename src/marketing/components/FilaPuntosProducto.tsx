import { useEffect, useRef, useState } from "react";
import { apiLocal } from "../lib/api";
import type { Producto } from "../lib/tipos";
export function FilaPuntosProducto({ producto }: { producto: Producto }) {
  const inicial = [String(producto.puntosGanados || 0), String(producto.puntosNecesarios || 0)];
  const [valores, setValores] = useState(inicial);
  const [estado, setEstado] = useState("");
  const actuales = useRef(inicial), guardados = useRef(inicial.join(","));
  const ocupado = useRef(false), montado = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const valido = (v: string[]) => v.every(n => n.trim() !== "" && Number.isInteger(Number(n)) && Number(n) >= 0 && Number(n) <= 2147483647);
  async function guardar() {
    if (timer.current) clearTimeout(timer.current);
    if (ocupado.current || !valido(actuales.current) || actuales.current.join(",") === guardados.current) return;
    ocupado.current = true;
    if (montado.current) setEstado("Guardando…");
    try {
      while (valido(actuales.current) && actuales.current.join(",") !== guardados.current) {
        const v = [...actuales.current];
        await apiLocal("/puntos/productos/" + producto.id, {
          method: "PUT", body: { puntosGanados: Number(v[0]), puntosNecesarios: Number(v[1]) },
        });
        guardados.current = v.join(",");
      }
      if (montado.current) setEstado(valido(actuales.current) ? "Guardado" : "Ingresá un entero válido");
    } catch {
      if (montado.current) setEstado("No se guardó. Volvé a editar para reintentar.");
    } finally { ocupado.current = false; }
  }
  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; if (timer.current) clearTimeout(timer.current); void guardar(); };
  }, []);
  function cambiar(i: number, value: string) {
    const next = [...actuales.current]; next[i] = value;
    actuales.current = next; setValores(next);
    if (timer.current) clearTimeout(timer.current);
    setEstado(valido(next) ? "Pendiente" : "Ingresá un entero válido");
    if (valido(next)) timer.current = setTimeout(() => void guardar(), 600);
  }
  const campo = (i: number, titulo: string) => (
    <label className="grid gap-1 text-xs text-ink-3">
      {titulo}
      <input aria-label={(i === 0 ? "Puntos que suma " : "Puntos para canjear ") + producto.nombre}
        className="min-h-10 w-24 text-sm text-ink" type="number" min={0} max={2147483647} step={1} value={valores[i]}
        onChange={e => cambiar(i, e.target.value)} onBlur={() => void guardar()} />
    </label>
  );
  return <li className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-5">
    <p className="min-w-0 flex-1 basis-48 text-sm font-semibold break-words">{producto.nombre}</p>
    <div className="flex items-end gap-4">
      {campo(0, "Suma")}
      {campo(1, "Canje")}
      <span className="w-20 pb-3 text-xs text-ink-3" aria-live="polite">{estado}</span>
    </div>
  </li>;
}
