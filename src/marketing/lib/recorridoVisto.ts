import { useAuthStore } from "@/store/authStore";

/**
 * La clave con la que se recuerda que este local ya vio el recorrido de Marketing, en este
 * navegador. Sin sesión no hay nada que recordar.
 */
export function useClaveRecorrido(): string | null {
  const id = useAuthStore((s) => s.restaurante?.id);
  return id != null ? claveRecorrido(id) : null;
}

// La v1 permite volver a mostrarlo a todos si un día el recorrido cambia de verdad.
export const claveRecorrido = (id: number) => `piru-marketing-recorrido-v1:${id}`;

// Si el navegador no deja guardar, se recuerda en memoria: se muestra una vez por carga de página.
const vistos = new Set<string>();

export function recorridoVisto(clave: string) {
  if (vistos.has(clave)) return true;
  try {
    return localStorage.getItem(clave) === "visto";
  } catch {
    return false;
  }
}

export function marcarRecorridoVisto(clave: string) {
  vistos.add(clave);
  try {
    localStorage.setItem(clave, "visto");
  } catch {
    /* Queda en memoria. */
  }
}
