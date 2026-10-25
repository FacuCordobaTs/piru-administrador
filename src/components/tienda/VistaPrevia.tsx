import type { CSSProperties } from 'react'
import type { TiendaConfig } from '@/lib/tiendaConfig'
import { mezclar, tintaSobre, type Marca, type PlantillaId } from '@/lib/tiendaPresets'
import { estiloTienda, type Estilo } from './estilo'


const titulo = (e: Estilo, extra: CSSProperties = {}): CSSProperties => ({
  fontFamily: e.titulos, fontWeight: e.peso,
  letterSpacing: e.plantilla === 'moderna' ? '-0.045em' : '-0.02em',
  fontVariationSettings: e.plantilla === 'artesanal' ? "'SOFT' 100, 'WONK' 1" : undefined, ...extra,
})

const dientes = (alto: number, sentido: 'abajo' | 'arriba', ancho = 18): CSSProperties => {
  const mask = `conic-gradient(from ${sentido === 'abajo' ? '-45deg at bottom' : '135deg at top'}, #0000, #000 1deg 89deg, #0000 90deg) 0 0 / ${ancho}px 100%`
  return { height: alto, WebkitMask: mask, mask }
}

/** La portada de la tienda en miniatura, con lo elegido hasta ahora. Es aproximada: la tienda real ajusta
 * contrastes y tamaños según la pantalla. */
export function VistaPrevia({ config, marca, nombre, plato }: { config: TiendaConfig; marca: Marca; nombre: string; plato?: string }) {
  const e = estiloTienda(config, marca)
  const frase = config.frase && config.frase !== nombre ? config.frase : undefined
  const cinta = config.cinta?.length ? config.cinta : ['Pedí online', 'Directo de la cocina']
  const sobrePrimario = tintaSobre(e.primario)
  const pizarra = mezclar(e.oscuro ? '#2a2420' : e.texto, e.primario, 0.06)
  return <div aria-label="Vista previa de la tienda" role="img" className="relative mx-auto w-full max-w-[300px] overflow-hidden rounded-[34px] border-[6px] border-zinc-900 bg-zinc-900 shadow-xl">
    <div className="h-[540px] overflow-hidden rounded-[28px]" style={{ background: e.fondo, color: e.texto, fontFamily: e.cuerpo }}>
      {e.plantilla === 'moderna' && <>
        <div className="m-1.5 rounded-[22px] p-4 pb-5" style={{ background: e.primario, color: sobrePrimario }}>
          <div className="flex gap-1 text-[8px] font-semibold">
            {['Abierto ahora', 'Delivery · Take away'].map(d => <span key={d} className="rounded-full px-2 py-1" style={{ background: `color-mix(in srgb, ${sobrePrimario} 14%, transparent)` }}>{d}</span>)}
          </div>
          <p className="mt-5 break-words text-[40px] leading-[0.86]" style={titulo(e)}>{nombre}</p>
          {frase && <p className="mt-4 text-[16px] leading-[1.05]" style={titulo(e)}>{frase}</p>}
          {config.bajada && <p className="mt-2 line-clamp-2 text-[10px] leading-snug opacity-85">{config.bajada}</p>}
          <span className="mt-4 inline-flex h-8 items-center gap-2 rounded-full pl-3.5 pr-1 text-[10px] font-bold" style={{ background: sobrePrimario, color: e.primario }}>Ver la carta <span className="grid size-6 place-items-center rounded-full text-[10px]" style={{ background: e.secundario, color: tintaSobre(e.secundario) }}>↓</span></span>
          {plato && <div className="mt-4 rotate-[1.5deg] rounded-2xl p-3 shadow-lg" style={{ background: e.superficie, color: e.texto }}>
            <span className="text-[8px] font-bold" style={{ color: e.legible }}>✦ Nuestro favorito</span>
            <p className="mt-1 text-[15px] leading-[1.05]" style={titulo(e)}>{plato}</p>
          </div>}
        </div>
        <div className="mx-1.5 overflow-hidden whitespace-nowrap rounded-[14px] py-2.5 text-[13px] uppercase leading-none" style={{ ...titulo(e), background: e.secundario, color: tintaSobre(e.secundario) }}>
          <span className="pl-3">{[...cinta, ...cinta].join('  ✦  ')}</span>
        </div>
        <div className="px-4 pt-5"><p className="text-[22px] leading-[0.92]" style={titulo(e)}>Elegí tu próximo favorito</p>
          <div className="mt-3 grid grid-cols-2 gap-2">{[0, 1].map(i => <span key={i} className="aspect-square rounded-2xl" style={{ background: mezclar(e.fondo, e.texto, 0.08) }} />)}</div>
        </div>
      </>}

      {e.plantilla === 'artesanal' && <>
        <div className="h-1.5" style={{ background: e.primario }} />
        <div style={{ ...dientes(30, 'abajo'), background: `repeating-linear-gradient(90deg, ${e.primario} 0 18px, ${e.superficie} 18px 36px)` }} />
        <div className="px-4 pt-3">
          <span className="inline-block -rotate-2 px-4 py-1 text-[11px] italic" style={{ ...titulo(e), background: e.secundario, color: tintaSobre(e.secundario), clipPath: 'polygon(0 0,100% 0,calc(100% - 8px) 50%,100% 100%,0 100%,8px 50%)' }}>Qué bueno tenerte por acá.</span>
          <p className="mt-3 break-words text-[40px] leading-[0.9]" style={titulo(e, { color: e.legible })}>{nombre}</p>
          <svg aria-hidden viewBox="0 0 220 14" className="mt-1 h-2.5 w-24" style={{ color: e.legible }}><path d="M3 9C24 3 40 3 58 8s34 5 52-1 36-6 54 0 32 5 53-2" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></svg>
          {frase && <p className="mt-3 text-[16px] italic leading-[1.1]" style={titulo(e)}>{frase}</p>}
          {config.bajada && <p className="mt-2 line-clamp-2 text-[10px] leading-snug opacity-80">{config.bajada}</p>}
          <span className="mt-4 inline-flex h-8 items-center rounded-[3px] px-4 text-[10px] font-bold" style={{ background: e.primario, color: sobrePrimario, boxShadow: `3px 3px 0 0 ${e.texto}` }}>Ver la carta ↓</span>
          {plato && <div className="mt-5 -rotate-2 rounded-[3px] border-[5px] p-3" style={{ background: pizarra, color: tintaSobre(pizarra), borderColor: mezclar('#6a4528', e.primario, 0.22) }}>
            <span className="text-[9px] italic opacity-80" style={titulo(e)}>Una recomendación para vos</span>
            <p className="mt-0.5 text-[17px] leading-[1.02]" style={titulo(e)}>{plato}</p>
          </div>}
        </div>
        <div className="mt-5 h-5" style={{ background: e.fondo, backgroundImage: `linear-gradient(90deg, color-mix(in srgb, ${e.primario} 28%, transparent) 50%, transparent 50%), linear-gradient(color-mix(in srgb, ${e.secundario} 28%, transparent) 50%, transparent 50%)`, backgroundSize: '12px 12px' }} />
        <p className="px-4 pt-4 text-center text-[22px] leading-[0.95]" style={titulo(e)}>Algo rico te espera</p>
      </>}

      {e.plantilla === 'elegante' && <div className="px-4 pt-5">
        <p className="break-words text-[46px] leading-[0.84]" style={titulo(e, { color: e.legible })}>{nombre}</p>
        <div className="mt-2 flex h-1"><span className="flex-[2]" style={{ background: e.primario }} /><span className="flex-1" style={{ background: e.secundario }} /></div>
        <div className="mt-2 border-y py-1.5 text-[7px] font-semibold uppercase tracking-[0.16em]" style={{ borderColor: e.texto }}>Abierto ahora ◆ Delivery · Take away</div>
        {frase && <p className="mt-5 text-[20px] leading-[0.98]" style={titulo(e)}>{frase}</p>}
        {config.bajada && <p className="mt-2 line-clamp-2 text-[10px] leading-snug opacity-80">{config.bajada}</p>}
        <span className="mt-4 inline-flex h-8 items-center gap-2 rounded-full pl-3.5 pr-1 text-[10px] font-semibold" style={{ background: e.texto, color: e.fondo }}>Ver la carta <span className="grid size-6 place-items-center rounded-full" style={{ background: e.primario, color: sobrePrimario }}>↓</span></span>
        {plato && <div className="relative mt-6 border-[1.5px] p-1" style={{ borderColor: e.secundario }}>
          <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 text-[6.5px] font-semibold uppercase tracking-[0.2em]" style={{ background: e.fondo }}>Recomendado de la casa</span>
          <div className="border p-3" style={{ borderColor: `color-mix(in srgb, ${e.texto} 40%, transparent)` }}><p className="text-[18px] leading-none" style={titulo(e)}>{plato}</p></div>
        </div>}
        <p className="mt-6 border-b pb-1 text-[30px] leading-[0.85]" style={titulo(e, { borderColor: e.texto })}>La carta</p>
      </div>}
    </div>
  </div>
}

/** La miniatura de cada plantilla en el selector de diseño, con los colores elegidos. */
export function MiniPlantilla({ id, config, marca }: { id: PlantillaId; config: TiendaConfig; marca: Marca }) {
  const e = estiloTienda({ ...config, plantilla: id }, marca)
  return <div aria-hidden className="relative h-28 overflow-hidden rounded-xl" style={{ background: e.fondo, color: e.texto }}>
    {id === 'moderna' && <><div className="absolute inset-1.5 bottom-6 rounded-lg p-2" style={{ background: e.primario, color: tintaSobre(e.primario) }}><span className="block text-[22px] leading-[0.85]" style={titulo(e)}>Tu<br />local</span></div>
      <div className="absolute inset-x-1.5 bottom-1.5 h-3.5 rounded-md" style={{ background: e.secundario }} /></>}
    {id === 'artesanal' && <><div className="h-1" style={{ background: e.primario }} />
      <div style={{ ...dientes(16, 'abajo', 12), background: `repeating-linear-gradient(90deg, ${e.primario} 0 12px, ${e.superficie} 12px 24px)` }} />
      <span className="ml-2.5 mt-1.5 inline-block -rotate-2 px-2 text-[8px] italic" style={{ ...titulo(e), background: e.secundario, color: tintaSobre(e.secundario) }}>Qué bueno…</span>
      <span className="ml-2.5 block text-[22px] leading-none" style={titulo(e, { color: e.legible })}>Tu local</span></>}
    {id === 'elegante' && <div className="p-2.5"><span className="block text-[30px] leading-[0.85]" style={titulo(e, { color: e.legible })}>Tu local</span>
      <div className="mt-1.5 flex h-1"><span className="flex-[2]" style={{ background: e.primario }} /><span className="flex-1" style={{ background: e.secundario }} /></div>
      <div className="mt-1.5 h-2.5 border-y" style={{ borderColor: e.texto }} /><span className="mt-2 block h-1.5 w-2/3 rounded-full" style={{ background: mezclar(e.fondo, e.texto, 0.2) }} /></div>}
  </div>
}
