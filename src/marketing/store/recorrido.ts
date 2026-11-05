import { create } from "zustand";

interface Recorrido {
  abierto: boolean;
  /** Cuántas veces se abrió: cada apertura empieza del primer paso. */
  vez: number;
  /** El nombre del local, para saludarlo. */
  local: string | null;
  abrir: (opciones?: { local?: string | null }) => void;
  cerrar: () => void;
}

/** El recorrido de bienvenida de Marketing: se abre desde la barra de secciones o la guía. */
export const useRecorrido = create<Recorrido>()((set) => ({
  abierto: false,
  vez: 0,
  local: null,
  abrir: (opciones = {}) =>
    set((s) => ({
      abierto: true,
      vez: s.vez + 1,
      local: opciones.local ?? s.local,
    })),
  cerrar: () => set({ abierto: false }),
}));
