import {
  CalendarDays,
  Check,
  LayoutDashboard,
  Link2,
  MessageCircle,
  Sparkles,
  Ticket,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "../ui";
import { Escena, type PropsEscena } from "./Escena";
import { d, useSecuencia } from "./animacion";
import { LOCAL_EJEMPLO } from "./ejemplo";

// Las secciones de Marketing, con los mismos íconos que su barra (components/Layout.tsx).
const SECCIONES = [
  { Icono: LayoutDashboard, nombre: "Resumen", texto: "Cómo viene" },
  { Icono: MessageCircle, nombre: "Hoy", texto: "Para mandar" },
  { Icono: CalendarDays, nombre: "Días flojos", texto: "A quién invitar" },
  { Icono: Link2, nombre: "Campañas", texto: "Links medidos" },
  { Icono: Users, nombre: "Clientes", texto: "La base" },
  { Icono: Sparkles, nombre: "Puntos", texto: "El club" },
  { Icono: Ticket, nombre: "Cupones", texto: "Beneficios" },
  { Icono: TrendingUp, nombre: "Estadísticas", texto: "Los números" },
];

export function MapaApp({
  siempreActiva,
}: PropsEscena) {
  const n = useSecuencia(900, 0);
  const resaltada = n % SECCIONES.length;
  return (
    <Escena
      ancho={460}
      alto={326}
      etiqueta="Las secciones de Marketing: Resumen, Hoy, Días flojos, Campañas, Clientes, Puntos, Cupones y Estadísticas de tu local."
      siempreActiva={siempreActiva}
    >
      <div className="e-baja absolute left-[18px] top-[14px] flex items-center gap-2" style={d(0)}>
        <span className="grid size-7 place-items-center rounded-lg bg-[#7A2E3F] text-[12px] font-bold text-white">
              {LOCAL_EJEMPLO.slice(0, 1)}
            </span>
            <span className="text-[13px] font-semibold text-ink">{LOCAL_EJEMPLO}</span>
            <span className="ml-1 flex h-7 items-center rounded-full bg-brand-soft px-2.5 text-[11px] font-semibold text-brand-deep">
              Marketing
            </span>
      </div>
      <p className="e-aparece absolute left-[18px] top-[50px] text-[10px] font-semibold uppercase tracking-[.08em] text-ink-3" style={d(200)}>
        Tu menú
      </p>

      <div className="absolute left-[18px] top-[70px] grid w-[424px] grid-cols-3 gap-[9px]">
        {SECCIONES.map((s, i) => (
          <div key={s.nombre} className="e-pop" style={d(250 + i * 70)}>
            <div
              className={cn(
                "flex h-[76px] flex-col justify-between rounded-[16px] bg-white p-3 ring-1 transition-[box-shadow,background-color] duration-300",
                i === resaltada
                  ? "bg-brand-soft/70 ring-2 ring-brand"
                  : "ring-[#ECE4D8] shadow-[0_8px_18px_-14px_rgb(40_24_8/.45)]",
              )}
            >
              <span
                className={cn(
                  "grid size-7 place-items-center rounded-lg transition-colors duration-300",
                  i === resaltada ? "bg-brand text-white" : "bg-[#F6F0E6] text-ink-2",
                )}
              >
                <s.Icono size={15} />
              </span>
              <div>
                <p className="text-[12.5px] font-semibold leading-tight text-ink">{s.nombre}</p>
                <p className="text-[10.5px] text-ink-3">{s.texto}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <span
        className="e-pop absolute left-[404px] top-[10px] grid size-10 place-items-center rounded-full bg-brand text-white shadow-[0_10px_22px_-8px_rgb(255_122_0/.8)]"
        style={d(1100)}
      >
        <Check size={20} strokeWidth={3} />
      </span>
    </Escena>
  );
}
