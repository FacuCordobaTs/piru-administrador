import { createContext, useContext, type ReactNode } from "react";
import { Dialog, DropdownMenu } from "radix-ui";

/**
 * El contenedor `.marketing-app` de la pantalla. Los diálogos y menús de Marketing se montan
 * adentro, no en `body`, porque los estilos de `marketing.css` están acotados a ese contenedor
 * para no tocar el resto del panel.
 */
export const RaizMarketing = createContext<HTMLElement | null>(null);

export function PortalMarketing({ children }: { children: ReactNode }) {
  const raiz = useContext(RaizMarketing);
  return <Dialog.Portal container={raiz ?? undefined}>{children}</Dialog.Portal>;
}

export function PortalMenuMarketing({ children }: { children: ReactNode }) {
  const raiz = useContext(RaizMarketing);
  return (
    <DropdownMenu.Portal container={raiz ?? undefined}>
      {children}
    </DropdownMenu.Portal>
  );
}
