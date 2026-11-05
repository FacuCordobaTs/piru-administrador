import { Lock, Palette, ShoppingBag } from 'lucide-react'
import { Escena } from '@/marketing/components/escenas/Escena'
import { d, useSecuencia } from '@/marketing/components/escenas/animacion'

// Los colores que va probando el panel de preferencias; la tienda los toma al instante.
const ACENTOS = ['#FF7A00', '#7A2E3F', '#2F6B4F', '#2B4C9B']
const PRODUCTOS = [
  { nombre: 'Smash doble', precio: '$ 9.800' },
  { nombre: 'Papas cheddar', precio: '$ 5.200' },
  { nombre: 'Limonada', precio: '$ 2.900' },
]

/**
 * La tienda de Páginas armándose en una ventana del navegador: el sitio entra por bloques y el
 * panel de preferencias va cambiando el color de acento. Misma familia que las escenas de la landing.
 */
export function EscenaTienda() {
  const fase = useSecuencia(1800)
  const acento = ACENTOS[fase % ACENTOS.length]
  return (
    <Escena
      ancho={520}
      alto={300}
      etiqueta="Una tienda en tu-local.piru.app que se arma por bloques mientras el panel de preferencias le cambia el color."
    >
      <div className="escenario absolute inset-0" />
      <div className="e-sube e-tarjeta absolute left-[28px] top-[26px] h-[250px] w-[350px] overflow-hidden" style={d(0)}>
        <div className="flex h-[30px] items-center gap-2 border-b border-[#ece4d8] bg-[#F3EEE6] px-3">
          <span className="flex gap-[5px]">
            <span className="size-[8px] rounded-full bg-[#FF5F57]" />
            <span className="size-[8px] rounded-full bg-[#FEBC2E]" />
            <span className="size-[8px] rounded-full bg-[#28C840]" />
          </span>
          <span className="mx-auto flex h-[18px] items-center gap-1 rounded-[6px] bg-white/85 px-2 text-[9.5px] text-[#6b6258]">
            <Lock size={8} strokeWidth={2.6} />
            tu-local.piru.app
          </span>
        </div>
        <div
          className="e-aparece relative mx-3 mt-3 flex h-[78px] flex-col justify-end rounded-[12px] p-3 text-white transition-colors duration-700"
          style={{ ...d(350), backgroundColor: acento }}
        >
          <span className="text-[15px] font-black leading-none tracking-[-0.03em]">Brasa Burgers</span>
          <span className="mt-1 text-[9.5px] text-white/80">Abierto · delivery y takeaway</span>
        </div>
        <div className="mx-3 mt-3 grid grid-cols-3 gap-2">
          {PRODUCTOS.map((p, i) => (
            <div key={p.nombre} className="e-pop rounded-[10px] border border-[#ece4d8] p-1.5" style={d(650 + i * 140)}>
              <div className="h-[38px] rounded-[7px] bg-[#f3eadd]" />
              <p className="mt-1.5 truncate text-[9.5px] font-semibold text-[#191512]">{p.nombre}</p>
              <p className="text-[9px] font-bold transition-colors duration-700" style={{ color: acento }}>{p.precio}</p>
            </div>
          ))}
        </div>
        <div className="e-sube absolute bottom-3 right-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-[9.5px] font-semibold text-white transition-colors duration-700" style={{ ...d(1100), backgroundColor: acento }}>
          <ShoppingBag size={10} strokeWidth={2.6} />
          Ver pedido
        </div>
      </div>
      <div className="e-derecha absolute right-[24px] top-[70px] w-[150px]" style={d(900)}>
        <div className="e-flota e-tarjeta p-3">
          <p className="flex items-center gap-1.5 text-[10.5px] font-semibold text-[#191512]">
            <Palette size={12} strokeWidth={2.4} />
            Preferencias
          </p>
          <p className="mt-2 text-[9px] text-[#6b6258]">Color principal</p>
          <div className="mt-1.5 flex gap-1.5">
            {ACENTOS.map((c) => (
              <span
                key={c}
                className="size-[18px] rounded-full transition-shadow duration-300"
                style={{ backgroundColor: c, boxShadow: c === acento ? `0 0 0 2px #fff, 0 0 0 3.5px ${c}` : undefined }}
              />
            ))}
          </div>
          <p className="mt-3 text-[9px] text-[#6b6258]">Plantilla</p>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            <span className="h-[26px] rounded-[6px] bg-[#f3eadd] ring-[1.5px] ring-[#191512]" />
            <span className="h-[26px] rounded-[6px] bg-[#f3eadd]" />
          </div>
        </div>
      </div>
    </Escena>
  )
}
