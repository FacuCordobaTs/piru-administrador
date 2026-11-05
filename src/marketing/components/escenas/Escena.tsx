import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { EscenaActiva } from "./animacion";
import "./escenas.css";

/**
 * El lienzo de una ilustración: se diseña a `ancho × alto` px y se escala al ancho disponible.
 * Es decorativa (`inert`): lo que muestra va en `etiqueta`. En la guía las animaciones arrancan
 * cuando la escena entra en pantalla y se pausan al salir; en el recorrido (`siempreActiva`)
 * corren desde que se monta.
 */
export function Escena({
  ancho,
  alto,
  etiqueta,
  siempreActiva = false,
  children,
}: {
  ancho: number;
  alto: number;
  etiqueta: string;
  siempreActiva?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(siempreActiva);
  useEffect(() => {
    if (siempreActiva) return setVisible(true);
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined")
      return setVisible(true);
    const io = new IntersectionObserver(
      ([e]) => setVisible(e.isIntersecting),
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [siempreActiva]);
  return (
    <div
      ref={ref}
      role="img"
      aria-label={etiqueta}
      className="escena"
      data-pausada={visible ? undefined : ""}
      style={{ "--escala-w": ancho, "--escala-h": alto } as CSSProperties}
    >
      <div className="escena-lienzo" inert>
        <EscenaActiva.Provider value={visible}>{children}</EscenaActiva.Provider>
      </div>
    </div>
  );
}

/** Las props comunes de cada escena. */
export interface PropsEscena {
  siempreActiva?: boolean;
}
