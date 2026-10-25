/** Espejo del contrato backend/src/lib/tienda-config.ts y web/src/lib/tienda.ts. */
export interface TiendaConfig {
  plantilla?: 'elegante' | 'moderna' | 'artesanal'
  colores?: { fondo?: string; texto?: string; acento?: string; superficie?: string }
  fuentes?: { titulos?: string; cuerpo?: string; cssUrl?: string; pesoTitulos?: number }
  productoDestacadoId?: number
  frase?: string
  bajada?: string
  portadaUrl?: string
  galeria?: string[]
  cinta?: string[]
  historia?: { titulo?: string; texto?: string }
  instagram?: string
  whatsapp?: string
}


export function leerTiendaConfig(raw: unknown): TiendaConfig {
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw
    return v && typeof v === 'object' && !Array.isArray(v) ? v as TiendaConfig : {}
  } catch { return {} }
}

export function validarTiendaConfig(t: TiendaConfig): string | null {
  for (const v of Object.values(t.colores ?? {})) {
    if (v && !/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(v)) return 'Usá colores hexadecimales de 3 o 6 dígitos, por ejemplo #FF7A00.'
  }
  for (const v of [t.fuentes?.titulos, t.fuentes?.cuerpo]) {
    if (v && !/^[\p{L}\p{N} ]+$/u.test(v)) return 'Escribí sólo el nombre de la fuente, sin comillas ni código.'
  }
  if (t.fuentes?.cssUrl && !/^https:\/\//.test(t.fuentes.cssUrl)) return 'La hoja de fuentes debe empezar con https://.'
  if (t.fuentes?.pesoTitulos !== undefined && (t.fuentes.pesoTitulos < 100 || t.fuentes.pesoTitulos > 900)) return 'El peso de los títulos debe estar entre 100 y 900.'
  for (const v of [t.portadaUrl, ...(t.galeria ?? [])]) {
    if (v && !/^(https:\/\/|\/(?!\/)|data:image\/)/i.test(v)) return 'Las fotos deben ser archivos subidos, enlaces https:// o rutas que empiecen con /.'
  }
  return null
}
