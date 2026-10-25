import type { TiendaConfig } from '@/lib/tiendaConfig'
import { BASES, luminancia, mezclar, tintaSobre, type Marca, type PlantillaId } from '@/lib/tiendaPresets'

const contraste = (a: string, b: string) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

/** Los colores y letras que va a usar la tienda, aproximados como en `web/src/lib/paletaTienda.ts`. */
export function estiloTienda(config: TiendaConfig, marca: Marca) {
  const plantilla: PlantillaId = config.plantilla ?? 'artesanal'
  const base = BASES[plantilla]
  const c = config.colores ?? {}
  const fondo = c.fondo ?? base.fondo
  const oscuro = luminancia(fondo) < 0.18
  const tintaBase = contraste(base.texto, fondo) >= 4.5 ? base.texto : tintaSobre(fondo) === '#ffffff' ? '#f5f1ea' : '#17130f'
  const texto = c.texto && contraste(c.texto, fondo) >= 4.5 ? c.texto : tintaBase
  const superficie = c.superficie ?? (c.fondo ? mezclar(fondo, '#ffffff', oscuro ? 0.06 : 0.5) : base.superficie)
  const primario = c.acento ?? marca.colorPrimario
  const secundario = marca.usarColorUnico ? primario : marca.colorSecundario
  const legible = contraste(primario, fondo) >= 3 ? primario : texto
  const titulos = `'${config.fuentes?.titulos ?? base.titulos}', ${plantilla === 'artesanal' ? 'Georgia, serif' : 'system-ui, sans-serif'}`
  const cuerpo = `'${config.fuentes?.cuerpo ?? base.cuerpo}', system-ui, sans-serif`
  const peso = config.fuentes?.pesoTitulos ?? (config.fuentes?.titulos ? 400 : base.peso)
  return { plantilla, fondo, oscuro, texto, superficie, primario, secundario, legible, titulos, cuerpo, peso }
}

export type Estilo = ReturnType<typeof estiloTienda>
