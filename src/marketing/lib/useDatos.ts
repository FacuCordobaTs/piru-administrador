import { useCallback, useEffect, useState } from "react";
/**
 * `conservar`: al volver a pedir (otra página, otro filtro) se sigue viendo lo anterior, en vez de
 * vaciar la pantalla; `loading` indica que hay un pedido en camino.
 */
export function useDatos<T>(
  cargar: () => Promise<T>,
  deps: unknown[] = [],
  { conservar = false }: { conservar?: boolean } = {},
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    let activo = true;
    setLoading(true);
    setError(null);
    if (!conservar) setData(null);
    cargar()
      .then((d) => {
        if (activo) setData(d);
      })
      .catch((e) => {
        if (activo)
          setError(
            e instanceof Error ? e.message : "No pudimos cargar los datos.",
          );
      })
      .finally(() => {
        if (activo) setLoading(false);
      });
    return () => {
      activo = false;
    };
  }, [...deps, version]);
  return { data, error, loading, recargar };
}
