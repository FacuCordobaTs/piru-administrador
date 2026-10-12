import { BookOpen, LayoutDashboard, MessageSquare, Package, Settings, TrendingUp, Users, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Escena, type PropsEscena } from '@/components/guia/escenas/Escena'
import { d, useSecuencia } from '@/components/guia/escenas/animacion'
import { LOCAL_EJEMPLO } from '@/components/guia/escenas/ejemplo'

const ITEMS: { Icono: LucideIcon; nombre: string; texto: string }[] = [
  { Icono: LayoutDashboard, nombre: 'Inicio', texto: 'Los pedidos del día, el punto de venta, las mesas y la caja.' },
  { Icono: Package, nombre: 'Menú', texto: 'Productos, categorías, variantes, extras y precios.' },
  { Icono: Users, nombre: 'Clientes', texto: 'Tu base, y la app de marketing: campañas, cupones, puntos y recompra.' },
  { Icono: MessageSquare, nombre: 'Mensajes', texto: 'Tus avisos por WhatsApp, tu saldo y las recargas.' },
  { Icono: TrendingUp, nombre: 'Estadísticas', texto: 'Lo cobrado por mes o entre dos fechas, y lo más pedido.' },
  { Icono: BookOpen, nombre: 'Guía', texto: 'Cómo funciona cada pantalla, con ejemplos y preguntas frecuentes.' },
  { Icono: Settings, nombre: 'Configuración', texto: 'Tu negocio, tu tienda, entregas, horarios, pagos y módulos.' },
]

function Fila({ Icono, nombre, activa }: { Icono: LucideIcon; nombre: string; activa: boolean }) {
  return (
    <span
      className={cn(
        'flex h-[34px] items-center gap-2.5 rounded-[10px] px-2.5 text-[12px] font-semibold transition-colors duration-300',
        activa ? 'bg-brand text-white shadow-[0_6px_14px_-8px_rgb(255_122_0/.8)]' : 'text-ink-2',
      )}
    >
      <Icono size={15} strokeWidth={2.2} className={activa ? 'text-white' : 'text-ink-3'} />
      {nombre}
    </span>
  )
}

/**
 * El menú de la izquierda del panel, con lo que hay detrás de cada entrada. Fases: una por entrada
 * (Inicio, Menú, Clientes, Mensajes, Estadísticas, Guía, Configuración).
 */
export function MenuLateral({ siempreActiva }: PropsEscena) {
  const n = useSecuencia(2100, 0)
  const fase = n % ITEMS.length
  const actual = ITEMS[fase]
  return (
    <Escena
      siempreActiva={siempreActiva}
      ancho={460}
      alto={340}
      etiqueta="El menú lateral del panel: Inicio, Menú, Clientes, Mensajes, Estadísticas, Guía y Configuración, con lo que hay detrás de cada una."
    >
      <div className="e-tarjeta e-sube absolute left-[12px] top-[12px] flex h-[316px] w-[168px] flex-col p-[10px]" style={d(0)}>
        <p className="px-1 pb-2 pt-1 text-[13px] font-extrabold tracking-tight text-ink">
          <span className="mr-1 text-brand">✳</span>
          {LOCAL_EJEMPLO}
        </p>
        <div className="grid gap-[3px]">
          {ITEMS.slice(0, 5).map((it, i) => (
            <Fila key={it.nombre} Icono={it.Icono} nombre={it.nombre} activa={fase === i} />
          ))}
        </div>
        <div className="mt-auto grid gap-[3px] border-t border-[#ECE4D8] pt-2">
          {ITEMS.slice(5).map((it, i) => (
            <Fila key={it.nombre} Icono={it.Icono} nombre={it.nombre} activa={fase === i + 5} />
          ))}
        </div>
      </div>

      <div className="e-tarjeta absolute left-[192px] top-[12px] h-[316px] w-[256px] overflow-hidden">
        <div key={actual.nombre} className="e-derecha flex h-full flex-col p-[16px]">
          <span className="grid size-11 place-items-center rounded-2xl bg-brand-soft text-brand-deep">
            <actual.Icono size={22} strokeWidth={2.1} />
          </span>
          <p className="mt-3 text-[20px] font-black leading-tight tracking-tight text-ink">{actual.nombre}</p>
          <p className="mt-1.5 text-[12.5px] leading-snug text-ink-2">{actual.texto}</p>
          <div className="mt-4 grid gap-[7px]" aria-hidden>
            <span className="h-[9px] w-[88%] rounded-full bg-[#F6F0E6]" />
            <span className="h-[9px] w-[64%] rounded-full bg-[#F6F0E6]" />
            <span className="h-[9px] w-[76%] rounded-full bg-[#F6F0E6]" />
          </div>
          <p className="mt-auto flex items-center gap-1.5 text-[10.5px] font-semibold text-ink-3">
            <span className="rounded-full bg-[#F6F0E6] px-2 py-0.5 text-ink-2">Menú lateral</span>→
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-brand-deep">{actual.nombre}</span>
          </p>
        </div>
      </div>
    </Escena>
  )
}
