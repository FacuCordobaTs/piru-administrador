import { useEffect, useState } from "react";
/** El valor, pero sólo después de `ms` sin cambios: para no pedirle al backend en cada tecla. */
export function useDebounce<T>(valor: T, ms = 300): T {
  const [diferido, setDiferido] = useState(valor);
  useEffect(() => {
    const espera = setTimeout(() => setDiferido(valor), ms);
    return () => clearTimeout(espera);
  }, [valor, ms]);
  return diferido;
}
