import type { TiendaConfig } from '@/lib/tiendaConfig'

// Las decisiones del editor de la tienda: cada opción escribe campos del contrato `tienda` (o los colores
// de marca del local). Nada de esto se guarda como tal: el backend sólo conoce el contrato.

export type PlantillaId = NonNullable<TiendaConfig['plantilla']>

/** Base visual de cada plantilla, igual que `web/src/lib/plantillas.ts`, para la vista previa. */
export const BASES: Record<PlantillaId, { fondo: string; texto: string; superficie: string; titulos: string; cuerpo: string; peso: number }> = {
  elegante: { fondo: '#f6f1e8', texto: '#17130f', superficie: '#fdfbf7', titulos: 'Bricolage Grotesque', cuerpo: 'Bricolage Grotesque', peso: 800 },
  moderna: { fondo: '#f5f7fa', texto: '#171d2b', superficie: '#ffffff', titulos: 'Unbounded', cuerpo: 'Manrope', peso: 700 },
  artesanal: { fondo: '#f4ead8', texto: '#392a20', superficie: '#fffaf1', titulos: 'Fraunces', cuerpo: 'Nunito Sans', peso: 700 },
}

export const PLANTILLAS: { id: PlantillaId; nombre: string; detalle: string }[] = [
  { id: 'moderna', nombre: 'Moderna', detalle: 'Un afiche: tu color de punta a punta, el nombre enorme y la carta en mosaico.' },
  { id: 'artesanal', nombre: 'Artesanal', detalle: 'Un almacén de barrio: toldo a rayas, pizarrón y fotos pegadas con cinta.' },
  { id: 'elegante', nombre: 'Elegante', detalle: 'Una carta impresa: tipografía de revista, filetes y platos enmarcados.' },
]

export type Tipografia = { id: string; nombre: string; detalle: string; titulos: string; cuerpo: string; peso: number }

/** Pares probados. `web/src/lib/tienda.ts` (PESOS_FUENTE) pide a Google Fonts los pesos que usan. */
export const TIPOGRAFIAS: Tipografia[] = [
  { id: 'callejera', nombre: 'Callejera', detalle: 'Gruesa y directa', titulos: 'Archivo Black', cuerpo: 'Archivo', peso: 400 },
  { id: 'cartel', nombre: 'Cartel', detalle: 'Alta y apretada, de marquesina', titulos: 'Anton', cuerpo: 'Barlow', peso: 400 },
  { id: 'bodegon', nombre: 'Bodegón', detalle: 'Serif de pizarra, cálida', titulos: 'Young Serif', cuerpo: 'Libre Franklin', peso: 400 },
  { id: 'italiana', nombre: 'Trattoria', detalle: 'Clásica, con contraste', titulos: 'Playfair Display', cuerpo: 'Source Sans 3', peso: 800 },
  { id: 'bistro', nombre: 'Bistró', detalle: 'Fina y elegante', titulos: 'Cormorant Garamond', cuerpo: 'Inter', peso: 600 },
  { id: 'cafe', nombre: 'Café', detalle: 'Serif liviana, de especialidad', titulos: 'Instrument Serif', cuerpo: 'Inter', peso: 400 },
  { id: 'fresca', nombre: 'Fresca', detalle: 'Geométrica y limpia', titulos: 'Outfit', cuerpo: 'Outfit', peso: 700 },
  { id: 'amable', nombre: 'Amable', detalle: 'Redonda y simpática', titulos: 'Fredoka', cuerpo: 'Nunito', peso: 600 },
  { id: 'retro', nombre: 'Retro', detalle: 'Golosa, de los setenta', titulos: 'Caprasimo', cuerpo: 'Rubik', peso: 400 },
  { id: 'vanguardia', nombre: 'Vanguardia', detalle: 'Ancha y con carácter', titulos: 'Syne', cuerpo: 'Work Sans', peso: 800 },
  { id: 'taberna', nombre: 'Taberna', detalle: 'Slab robusta, de cervecería', titulos: 'Zilla Slab', cuerpo: 'Work Sans', peso: 700 },
]

/** Hoja de Google Fonts con todas las familias del catálogo, para mostrar cada opción con su letra. */
export const HOJA_TIPOGRAFIAS = `https://fonts.googleapis.com/css2?${[
  'Archivo+Black', 'Archivo:wght@400;600', 'Anton', 'Barlow:wght@400;600', 'Young+Serif', 'Libre+Franklin:wght@400;600',
  'Playfair+Display:wght@800', 'Source+Sans+3:wght@400;600', 'Cormorant+Garamond:wght@600', 'Inter:wght@400;600',
  'Instrument+Serif', 'Outfit:wght@400;700', 'Fredoka:wght@600', 'Nunito:wght@400;600', 'Caprasimo', 'Rubik:wght@400;600',
  'Syne:wght@800', 'Work+Sans:wght@400;600', 'Zilla+Slab:wght@700', 'Unbounded:wght@700', 'Manrope:wght@400;600',
  'Fraunces:wght@700', 'Nunito+Sans:wght@400;600', 'Bricolage+Grotesque:wght@400;800',
].map(f => `family=${f}`).join('&')}&display=swap`

export const tipografiaDe = (t: TiendaConfig) =>
  TIPOGRAFIAS.find(f => f.titulos === t.fuentes?.titulos && f.cuerpo === t.fuentes?.cuerpo && !t.fuentes?.cssUrl)

export type Ambiente = { id: string; nombre: string; detalle: string; colores?: TiendaConfig['colores']; tinte?: true }

/** El fondo de la tienda. Nunca tocan el acento: botones y detalles siguen con los colores de marca. */
export const AMBIENTES: Ambiente[] = [
  { id: 'diseno', nombre: 'El del diseño', detalle: 'El fondo propio de la plantilla' },
  { id: 'blanco', nombre: 'Blanco', detalle: 'Limpio y luminoso', colores: { fondo: '#ffffff', superficie: '#f4f4f1' } },
  { id: 'papel', nombre: 'Papel', detalle: 'Crema cálida', colores: { fondo: '#f5eee2', superficie: '#fffaf1' } },
  { id: 'tinte', nombre: 'Tu color', detalle: 'Un tono suave de tu color', tinte: true },
  { id: 'noche', nombre: 'Noche', detalle: 'Oscuro y elegante', colores: { fondo: '#111111', superficie: '#1d1d1d', texto: '#f5f1ea' } },
  { id: 'brasa', nombre: 'Brasa', detalle: 'Oscuro cálido, de parrilla', colores: { fondo: '#1c1613', superficie: '#29211c', texto: '#f4e9dc' } },
  { id: 'bosque', nombre: 'Bosque', detalle: 'Verde profundo', colores: { fondo: '#0f2b22', superficie: '#173b30', texto: '#eef4ea' } },
  { id: 'marino', nombre: 'Azul noche', detalle: 'Azul profundo', colores: { fondo: '#0d1628', superficie: '#16223a', texto: '#eef2fb' } },
]

export function mezclar(a: string, b: string, t: number) {
  const n = (h: string) => { const v = h.replace('#', ''); const x = v.length === 3 ? [...v].map(c => c + c).join('') : v; return [0, 2, 4].map(i => parseInt(x.slice(i, i + 2), 16)) }
  const [ca, cb] = [n(a), n(b)]
  return `#${ca.map((v, i) => Math.round(v + (cb[i] - v) * t).toString(16).padStart(2, '0')).join('')}`
}

export function luminancia(hex: string) {
  const v = hex.replace('#', '')
  const x = v.length === 3 ? [...v].map(c => c + c).join('') : v
  const [r, g, b] = [0, 2, 4].map(i => { const c = parseInt(x.slice(i, i + 2), 16) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export const tintaSobre = (hex: string) => (luminancia(hex) > 0.36 ? '#17130f' : '#ffffff')

export const coloresAmbiente = (a: Ambiente, primario: string): TiendaConfig['colores'] =>
  a.tinte ? { fondo: mezclar(primario, '#ffffff', 0.9), superficie: '#ffffff' } : a.colores

export function ambienteDe(t: TiendaConfig, primario: string): string | undefined {
  const c = t.colores
  if (!c || !Object.values(c).some(Boolean)) return 'diseno'
  if (c.acento) return undefined
  return AMBIENTES.find(a => {
    const p = coloresAmbiente(a, primario)
    return p && p.fondo?.toLowerCase() === c.fondo?.toLowerCase() && (p.superficie ?? '') === (c.superficie ?? '') && (p.texto ?? '') === (c.texto ?? '')
  })?.id
}

export type Marca = { colorPrimario: string; colorSecundario: string; usarColorUnico: boolean }
export type Paleta = { nombre: string; primario: string; secundario: string }

/** Los colores con los que arranca un local nuevo: si siguen así, elegir un rubro propone su paleta. */
export const esMarcaInicial = (m: Marca) =>
  m.colorPrimario.toUpperCase() === '#FF7A00' && (m.usarColorUnico || m.colorSecundario.toUpperCase() === '#FFFFFF')

export type Historia = { titulo: string; texto: string }
export type Rubro = {
  id: string
  nombre: string
  icono: 'Hamburger' | 'Pizza' | 'Coffee' | 'Utensils' | 'Salad' | 'Flame' | 'IceCreamCone' | 'Fish' | 'Beer' | 'Croissant' | 'Store'
  plantilla: PlantillaId
  tipografia: string
  ambiente: string
  paletas: Paleta[]
  frases: string[]
  bajadas: string[]
  cinta: string[]
  /** Cuántas frases de la cinta quedan elegidas al aplicar el rubro. */
  cintaInicial: number
  historias: Historia[]
}

const NOMBRE = '{nombre}'

export const RUBROS: Rubro[] = [
  {
    id: 'hamburgueseria', nombre: 'Hamburguesería', icono: 'Hamburger', plantilla: 'moderna', tipografia: 'callejera', ambiente: 'blanco',
    paletas: [
      { nombre: 'Ketchup y mostaza', primario: '#E63A1E', secundario: '#FFC21A' },
      { nombre: 'Negro y amarillo', primario: '#141414', secundario: '#FFD400' },
      { nombre: 'Naranja smash', primario: '#FF6A13', secundario: '#2B1D14' },
      { nombre: 'Rojo diner', primario: '#D7263D', secundario: '#1B998B' },
    ],
    frases: ['Smash, cheddar y cero vueltas.', 'Hamburguesas de verdad.', 'Doble carne, doble felicidad.', 'Las que te dejan pensando.'],
    bajadas: [
      'Carne fresca aplastada en la plancha, pan de papa y papas que crujen. Pedí directo y te llega caliente.',
      'Hamburguesas hechas al momento, con ingredientes que se notan. Elegí la tuya y armala como quieras.',
      'Medallones de carne propia, cheddar que se derrite y salsas de la casa. Sin intermediarios.',
    ],
    cinta: ['Smash burgers', 'Pan de papa', 'Carne fresca', 'Papas crocantes', 'Salsas de la casa', 'Cheddar que se derrite', 'Doble o triple', 'Opciones veggie'],
    cintaInicial: 4,
    historias: [
      { titulo: 'Todo empezó con una plancha', texto: `${NOMBRE} nació de una obsesión: la hamburguesa perfecta. Probamos panes, cortes y puntos de cocción hasta dar con la nuestra.\nHoy la hacemos igual que el primer día: carne fresca, plancha bien caliente y nada de apuro.` },
      { titulo: 'Hechas como nos gustan', texto: `En ${NOMBRE} cocinamos las hamburguesas que nosotros mismos pediríamos un viernes a la noche.\nIngredientes frescos, salsas propias y porciones que llenan.` },
    ],
  },
  {
    id: 'pizzeria', nombre: 'Pizzería', icono: 'Pizza', plantilla: 'artesanal', tipografia: 'italiana', ambiente: 'diseno',
    paletas: [
      { nombre: 'Tomate y albahaca', primario: '#D7372A', secundario: '#3F7D3A' },
      { nombre: 'Horno de leña', primario: '#9C3D1C', secundario: '#E8A33D' },
      { nombre: 'Tricolor', primario: '#C8102E', secundario: '#00843D' },
      { nombre: 'Azul napolitano', primario: '#1D4E89', secundario: '#E63946' },
    ],
    frases: ['Masa madre y horno bien caliente.', 'Pizza como tiene que ser.', 'Una porción nunca alcanza.', 'De nuestro horno a tu mesa.'],
    bajadas: [
      'Masa de fermentación lenta, salsa de tomate propia y muzzarella de verdad. Pedila entera o por porción.',
      'Pizzas a la piedra, fainá y empanadas recién salidas del horno. Pedí directo y llegan calentitas.',
      'Masa estirada a mano, ingredientes frescos y el horno siempre encendido.',
    ],
    cinta: ['Masa madre', 'A la piedra', 'Horno de leña', 'Muzza de verdad', 'Fainá', 'Por porción', 'Salsa propia', 'Fermentación lenta'],
    cintaInicial: 4,
    historias: [
      { titulo: 'La receta de la familia', texto: `En ${NOMBRE} la masa se hace como nos enseñaron: harina, agua, sal y tiempo.\nLa dejamos fermentar sin apuro y la estiramos a mano, una por una.` },
      { titulo: 'Un horno que no se apaga', texto: `${NOMBRE} es una pizzería de barrio con el horno siempre encendido.\nSalsa propia, muzzarella generosa y las ganas de que cada pizza salga mejor que la anterior.` },
    ],
  },
  {
    id: 'cafeteria', nombre: 'Cafetería', icono: 'Coffee', plantilla: 'elegante', tipografia: 'cafe', ambiente: 'papel',
    paletas: [
      { nombre: 'Café con leche', primario: '#6B3E26', secundario: '#D9B48F' },
      { nombre: 'Verde especialidad', primario: '#2F4A3A', secundario: '#E9C46A' },
      { nombre: 'Negro y crema', primario: '#1D1A17', secundario: '#C8A27A' },
      { nombre: 'Terracota', primario: '#B5523B', secundario: '#264653' },
    ],
    frases: ['Buen café, sin apuro.', 'Tu pausa favorita del día.', 'Café de especialidad y algo rico.', 'Para empezar bien el día.'],
    bajadas: [
      'Café de especialidad, pastelería propia y desayunos para tomarte tu tiempo. Pedí para llevar o que te llegue a casa.',
      'Granos seleccionados, leche bien texturizada y medialunas recién horneadas.',
      'Desayunos, meriendas y el café que te gusta, preparado al momento.',
    ],
    cinta: ['Café de especialidad', 'Pastelería propia', 'Medialunas', 'Desayunos', 'Meriendas', 'Leches vegetales', 'Tostado al momento', 'Para llevar'],
    cintaInicial: 4,
    historias: [
      { titulo: 'Un lugar para frenar', texto: `${NOMBRE} nació para que el café vuelva a ser un momento y no un trámite.\nElegimos cada grano, horneamos todos los días y preparamos cada taza como si fuera la primera.` },
      { titulo: 'De la máquina a tu taza', texto: `En ${NOMBRE} nos tomamos el café en serio: tostadores cercanos, molienda al momento y baristas que lo disfrutan.\nY para acompañar, todo hecho en casa.` },
    ],
  },
  {
    id: 'bodegon', nombre: 'Restaurante tradicional', icono: 'Utensils', plantilla: 'artesanal', tipografia: 'bodegon', ambiente: 'diseno',
    paletas: [
      { nombre: 'Vino y mostaza', primario: '#7A1F2B', secundario: '#D9A441' },
      { nombre: 'Verde botella', primario: '#1F4D3A', secundario: '#E8C07D' },
      { nombre: 'Bordó y azul', primario: '#8C1C2E', secundario: '#24476B' },
      { nombre: 'Terracota y oliva', primario: '#A34B34', secundario: '#6B7F3A' },
    ],
    frases: ['Cocina de siempre, porciones de verdad.', 'Como en casa, pero mejor.', 'El sabor de toda la vida.', 'Platos que abrazan.'],
    bajadas: [
      'Milanesas, pastas caseras y guisos como los de antes. Porciones abundantes para compartir o no.',
      'Cocina casera, recetas de familia y el plato del día que siempre sale. Pedí directo y comé rico.',
      'Bodegón de barrio con cocina de verdad: lo que te gusta, bien hecho y en cantidad.',
    ],
    cinta: ['Pastas caseras', 'Milanesas', 'Plato del día', 'Porciones abundantes', 'Recetas de familia', 'Guisos', 'Postres caseros', 'Para compartir'],
    cintaInicial: 4,
    historias: [
      { titulo: 'Una cocina con raíces', texto: `Nos gusta cocinar como nos enseñaron: con las manos, con paciencia y con lo mejor de cada estación.\nDesde la cocina de ${NOMBRE}, llevamos ese espíritu a cada mesa.` },
      { titulo: 'La mesa de siempre', texto: `${NOMBRE} es de esos lugares donde el mozo te conoce y la milanesa no entra en el plato.\nRecetas de familia, cocina a la vista y ganas de que vuelvas.` },
    ],
  },
  {
    id: 'saludable', nombre: 'Comida saludable', icono: 'Salad', plantilla: 'moderna', tipografia: 'fresca', ambiente: 'blanco',
    paletas: [
      { nombre: 'Verde hoja', primario: '#2F9E44', secundario: '#FFD43B' },
      { nombre: 'Palta y mandarina', primario: '#5C8A2E', secundario: '#F4A259' },
      { nombre: 'Bosque y lima', primario: '#1B4332', secundario: '#B5E48C' },
      { nombre: 'Remolacha', primario: '#9D174D', secundario: '#84CC16' },
    ],
    frases: ['Rico, fresco y que te hace bien.', 'Comer bien nunca fue tan fácil.', 'Bowls de colores.', 'Comida real, todos los días.'],
    bajadas: [
      'Bowls, ensaladas y wraps armados al momento con ingredientes frescos. Opciones veganas y sin TACC.',
      'Comida casera y equilibrada, sin ultraprocesados. Elegí tu bowl o armalo a tu gusto.',
      'Vegetales de estación, proteínas magras y aderezos propios. Para comer rico y liviano.',
    ],
    cinta: ['Bowls', 'Opciones veganas', 'Sin TACC', 'Ingredientes de estación', 'Sin ultraprocesados', 'Proteína', 'Jugos naturales', 'Armalo a tu gusto'],
    cintaInicial: 4,
    historias: [
      { titulo: 'Comer bien, sin complicarse', texto: `${NOMBRE} nació de una idea simple: que comer sano sea rico y práctico.\nCompramos a productores cercanos y cocinamos todos los días con lo que da la estación.` },
      { titulo: 'Lo bueno de lo simple', texto: `En ${NOMBRE} creemos que la comida que te hace bien tiene que ser, antes que nada, rica.\nPor eso cada bowl tiene color, textura y mucho sabor.` },
    ],
  },
  {
    id: 'parrilla', nombre: 'Parrilla', icono: 'Flame', plantilla: 'moderna', tipografia: 'cartel', ambiente: 'brasa',
    paletas: [
      { nombre: 'Brasa', primario: '#C2410C', secundario: '#FACC15' },
      { nombre: 'Chimichurri', primario: '#B91C1C', secundario: '#4D7C0F' },
      { nombre: 'Sangre y humo', primario: '#9F1D20', secundario: '#D6A461' },
      { nombre: 'Malbec', primario: '#6D1A36', secundario: '#E9C46A' },
    ],
    frases: ['Fuego lento, carne de verdad.', 'La parrilla que estabas buscando.', 'Al carbón y sin apuro.', 'Un buen asado no se negocia.'],
    bajadas: [
      'Cortes seleccionados, achuras y provoleta a la parrilla, con leña y paciencia. Pedí tu parrillada para compartir.',
      'Asado, vacío y entraña al punto que te gusta. Con guarniciones y chimichurri de la casa.',
      'Parrilla al carbón, carnes de primera y el punto justo. Directo de nuestras brasas a tu mesa.',
    ],
    cinta: ['A la leña', 'Cortes de primera', 'Achuras', 'Provoleta', 'Chimichurri casero', 'Parrillada para compartir', 'Al punto', 'Ensaladas frescas'],
    cintaInicial: 4,
    historias: [
      { titulo: 'El fuego manda', texto: `En ${NOMBRE} la parrilla se prende temprano y se trabaja sin apuro.\nElegimos cada corte, cuidamos la brasa y servimos la carne al punto, como se hizo siempre.` },
      { titulo: 'Asado de domingo, todos los días', texto: `${NOMBRE} es una parrilla de las de antes: leña, sal gruesa y un parrillero que sabe.\nLo demás lo ponés vos.` },
    ],
  },
  {
    id: 'dulce', nombre: 'Pastelería y heladería', icono: 'IceCreamCone', plantilla: 'moderna', tipografia: 'retro', ambiente: 'tinte',
    paletas: [
      { nombre: 'Frutilla y menta', primario: '#E5487A', secundario: '#5CC8B0' },
      { nombre: 'Dulce de leche', primario: '#A8642D', secundario: '#F6C9D0' },
      { nombre: 'Pistacho y rosa', primario: '#6B9F3A', secundario: '#F48FB1' },
      { nombre: 'Chocolate y vainilla', primario: '#4A2C2A', secundario: '#F3D9A4' },
    ],
    frases: ['Algo dulce siempre viene bien.', 'Para darte un gustito.', 'Dulce, artesanal y hecho hoy.', 'La merienda que te merecés.'],
    bajadas: [
      'Tortas, alfajores y helado artesanal hechos todos los días. Pedí para la merienda o para sorprender a alguien.',
      'Pastelería casera con ingredientes de verdad: manteca, chocolate y dulce de leche del bueno.',
      'Helado artesanal, postres y tortas por encargo. Elegí tus sabores y te lo llevamos.',
    ],
    cinta: ['Helado artesanal', 'Tortas', 'Alfajores', 'Dulce de leche', 'Por encargo', 'Sin TACC', 'Hecho hoy', 'Para regalar'],
    cintaInicial: 4,
    historias: [
      { titulo: 'Hecho con manteca y paciencia', texto: `En ${NOMBRE} todo empieza temprano, con el horno caliente y la cocina oliendo a vainilla.\nHacemos cada torta, cada alfajor y cada helado como si fuera para nuestra familia.` },
      { titulo: 'Nuestro rincón dulce', texto: `${NOMBRE} nació de una receta de la abuela y muchas ganas de compartirla.\nHoy seguimos igual: ingredientes nobles y nada de apuro.` },
    ],
  },
  {
    id: 'oriental', nombre: 'Sushi y asiática', icono: 'Fish', plantilla: 'elegante', tipografia: 'vanguardia', ambiente: 'noche',
    paletas: [
      { nombre: 'Rojo laca', primario: '#E03C31', secundario: '#F2E8CF' },
      { nombre: 'Salmón', primario: '#F28C5A', secundario: '#2A9D8F' },
      { nombre: 'Wasabi', primario: '#9BB53A', secundario: '#E76F51' },
      { nombre: 'Dorado', primario: '#D4A24C', secundario: '#C1121F' },
    ],
    frases: ['Sushi fresco, armado al momento.', 'El viaje empieza en tu mesa.', 'Precisión en cada pieza.', 'Sabores de Oriente, cerca tuyo.'],
    bajadas: [
      'Piezas armadas al momento con pescado fresco y arroz en su punto. Combinados para uno o para compartir.',
      'Sushi, woks y ramen con recetas que respetan el origen. Pedí directo y llega listo para disfrutar.',
      'Rolls clásicos y de autor, sashimi y opciones calientes. Todo preparado cuando lo pedís.',
    ],
    cinta: ['Pescado fresco', 'Armado al momento', 'Combinados', 'Rolls de autor', 'Sashimi', 'Woks', 'Opciones veggie', 'Para compartir'],
    cintaInicial: 4,
    historias: [
      { titulo: 'El arroz es todo', texto: `En ${NOMBRE} aprendimos que el secreto está en lo que no se ve: el arroz, el corte, la temperatura.\nPor eso cada pieza se arma cuando la pedís.` },
      { titulo: 'Respeto por el origen', texto: `${NOMBRE} cocina con técnicas tradicionales y productos frescos.\nNos gusta sorprender, pero sin perder lo que hace grande a esta cocina.` },
    ],
  },
  {
    id: 'cerveceria', nombre: 'Cervecería y bar', icono: 'Beer', plantilla: 'elegante', tipografia: 'taberna', ambiente: 'marino',
    paletas: [
      { nombre: 'Ámbar', primario: '#E09F3E', secundario: '#9E2A2B' },
      { nombre: 'IPA', primario: '#F4A300', secundario: '#2D6A4F' },
      { nombre: 'Stout', primario: '#D4A373', secundario: '#E76F51' },
      { nombre: 'Neón', primario: '#FF4D6D', secundario: '#4CC9F0' },
    ],
    frases: ['Birra fría y algo para picar.', 'El after que te merecés.', 'Pintas, amigos y buena comida.', 'Siempre hay un motivo para brindar.'],
    bajadas: [
      'Cerveza tirada, tragos de autor y comida para compartir. Pedí tu picada y armá la previa en casa.',
      'Pintas artesanales, papas, alitas y hamburguesas. Todo lo que necesitás para una buena noche.',
      'Una barra con historia, cervezas de la casa y una cocina que acompaña. Pedí directo.',
    ],
    cinta: ['Cerveza tirada', 'Tragos de autor', 'Happy hour', 'Para picar', 'Alitas', 'Picadas', 'Cerveza artesanal', 'Para compartir'],
    cintaInicial: 4,
    historias: [
      { titulo: 'Detrás de la barra', texto: `${NOMBRE} empezó como un lugar para juntarse con amigos y terminó siendo eso mismo, pero para todo el barrio.\nCerveza bien tirada, comida rica y buena música.` },
      { titulo: 'Brindemos', texto: `En ${NOMBRE} elegimos cada canilla y cada plato pensando en compartir.\nVení, pedí y quedate.` },
    ],
  },
  {
    id: 'panaderia', nombre: 'Panadería y rotisería', icono: 'Croissant', plantilla: 'artesanal', tipografia: 'amable', ambiente: 'papel',
    paletas: [
      { nombre: 'Trigo', primario: '#B4451F', secundario: '#F2C14E' },
      { nombre: 'Azul almacén', primario: '#1D4E89', secundario: '#F4A261' },
      { nombre: 'Verde mostrador', primario: '#2D6A4F', secundario: '#E9C46A' },
      { nombre: 'Bordó', primario: '#8C1C2E', secundario: '#F1C27D' },
    ],
    frases: ['Recién salido del horno.', 'El sabor del barrio.', 'Comida casera, lista para llevar.', 'Todos los días, algo rico.'],
    bajadas: [
      'Pan del día, facturas, empanadas y comidas caseras listas para llevar. Pedí y pasá a buscar o te lo llevamos.',
      'Empanadas, tartas y platos del día hechos en casa. Como cocinar, pero sin cocinar.',
      'Panadería y rotisería de barrio: lo de siempre, bien hecho y recién hecho.',
    ],
    cinta: ['Pan del día', 'Facturas', 'Empanadas', 'Tartas', 'Plato del día', 'Para llevar', 'Pollo al spiedo', 'Comida casera'],
    cintaInicial: 4,
    historias: [
      { titulo: 'El horno de la esquina', texto: `${NOMBRE} abre temprano para que el pan llegue calentito a tu mesa.\nAmasamos todos los días y cocinamos como en casa, con recetas de siempre.` },
      { titulo: 'Hecho acá', texto: `En ${NOMBRE} todo se hace en nuestra cocina: el pan, las empanadas y cada plato del día.\nNada viene de afuera, todo sale de acá.` },
    ],
  },
]

/** Para el local que no entra en ningún rubro: textos que valen para cualquiera. */
export const GENERICO = {
  frases: ['El placer de comer bien.', 'Hecho acá, para vos.', 'Rico de verdad.', 'Tu lugar de siempre.'],
  bajadas: [
    'Cocina de estación, buenos ingredientes y tiempo para disfrutar. Tu mesa está donde estés.',
    'Pedí directo a nuestra cocina: sin intermediarios y con todo el sabor.',
  ],
  cinta: ['Pedí online', 'Directo de la cocina', 'Hecho al momento', 'Ingredientes frescos', 'Para compartir'],
  historias: [
    { titulo: 'Detrás de cada plato', texto: `En ${NOMBRE} cocinamos lo que nos gusta comer: con ingredientes frescos y sin apuro.\nGracias por elegirnos.` },
  ] as Historia[],
}

export const conNombre = (texto: string, nombre?: string) => texto.replaceAll(NOMBRE, nombre?.trim() || 'nuestro local')

/** Todos los textos que alguna decisión puede escribir: un texto así se puede reemplazar sin perder nada
 * escrito a mano. */
function textosConocidos(nombre?: string) {
  const todos = [...RUBROS, GENERICO]
  return {
    frases: new Set(todos.flatMap(r => r.frases)),
    bajadas: new Set(todos.flatMap(r => r.bajadas)),
    cinta: new Set(todos.flatMap(r => r.cinta)),
    historias: new Set(todos.flatMap(r => r.historias.flatMap(h => [h.titulo, conNombre(h.texto, nombre)]))),
  }
}

export function rubroDe(t: TiendaConfig): Rubro | undefined {
  return RUBROS.find(r => (t.frase && r.frases.includes(t.frase)) || (t.bajada && r.bajadas.includes(t.bajada)))
}

/** Aplica el punto de partida de un rubro. Los textos escritos a mano no se pisan. */
export function aplicarRubro(t: TiendaConfig, rubro: Rubro, primario: string, nombre?: string): TiendaConfig {
  const conocidos = textosConocidos(nombre)
  const libre = (v: string | undefined, set: Set<string>) => !v || set.has(v)
  const tipografia = TIPOGRAFIAS.find(f => f.id === rubro.tipografia)!
  const ambiente = AMBIENTES.find(a => a.id === rubro.ambiente)!
  const historia = rubro.historias[0]
  return {
    ...t,
    plantilla: rubro.plantilla,
    fuentes: { titulos: tipografia.titulos, cuerpo: tipografia.cuerpo, pesoTitulos: tipografia.peso },
    colores: coloresAmbiente(ambiente, primario),
    frase: libre(t.frase, conocidos.frases) ? rubro.frases[0] : t.frase,
    bajada: libre(t.bajada, conocidos.bajadas) ? rubro.bajadas[0] : t.bajada,
    cinta: !t.cinta?.length || t.cinta.every(c => conocidos.cinta.has(c)) ? rubro.cinta.slice(0, rubro.cintaInicial) : t.cinta,
    historia: libre(t.historia?.titulo, conocidos.historias) && libre(t.historia?.texto, conocidos.historias)
      ? { titulo: historia.titulo, texto: conNombre(historia.texto, nombre) }
      : t.historia,
  }
}
