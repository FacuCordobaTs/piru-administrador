import { agregadosApi, categoriasApi, ingredientesApi, productosApi } from '@/lib/api'

export type OpcionCarta = { id?: number; nombre: string; precio: number }
export type ProductoCarta = {
  localId: string
  id?: number
  guardado?: boolean
  nombre: string
  descripcion?: string | null
  precio?: number | null
  categoria?: string
  esBebida?: boolean
  ingredientes?: string[]
  variantes?: OpcionCarta[]
  variantesSecundarias?: OpcionCarta[]
  extras?: OpcionCarta[]
  extrasSecundarios?: OpcionCarta[]
  tituloVariantesPrimarias?: string
  tituloVariantesSecundarias?: string
  tituloExtrasPrimarios?: string
  tituloExtrasSecundarios?: string
  permiteNota?: boolean
  tituloNota?: string
  image?: string | null
  eliminarImagen?: boolean
  imagenUrl?: string | null
  activo?: boolean
  etiquetas?: string[]
  puntosGanados?: number
  puntosNecesarios?: number
  descuento?: number
  descuentoFechaInicio?: string | null
  descuentoFechaFin?: string | null
  eventoSucursalId?: number | null
}
export type CartaEditable = { categorias: { nombre: string; esBebida?: boolean; productos: ProductoCarta[] }[] }
type IdNombre = { id: number; nombre: string }
type ExtraCatalogo = IdNombre & { precio: string | number; activo?: boolean }
type OpcionServidor = Omit<OpcionCarta, 'precio'> & { precio: string | number }
type ProductoGuardado = { success: boolean; message?: string; data?: [{ insertId: number }]; productoId?: number; imagenUrl?: string | null; variantes?: OpcionServidor[]; variantesSecundarias?: OpcionServidor[]; etiquetaAutoGenerada?: string }

export function prepararCarta(carta: CartaEditable): CartaEditable {
  return { categorias: carta.categorias.map(cat => ({ ...cat, productos: cat.productos.map(p => ({
    ...p, localId: p.localId || crypto.randomUUID(), categoria: p.categoria ?? cat.nombre, esBebida: p.esBebida ?? cat.esBebida ?? false,
  })) })) }
}

const norm = (s: string) => s.trim().toLowerCase()

// Recursos compartidos se resuelven una vez. Los saves concurrentes de dos productos
// comparten la promesa de creación del ingrediente/categoría/extra, sin duplicarlos.
export function crearGuardadorCarta(token: string) {
  const categorias = new Map<string, Promise<number>>()
  const ingredientes = new Map<string, Promise<number>>()
  const extras = new Map<string, Promise<number>>()
  const extrasPorId = new Map<number, { nombre: string; precio: number }>()
  let carga: Promise<void> | undefined
  const extraKey = (nombre: string, precio: number) => `${norm(nombre)}:${precio}`
  const cargar = () => carga ??= Promise.all([
    categoriasApi.getAll(token), ingredientesApi.getAll(token), agregadosApi.getAll(token),
  ]).then(([cats, ings, ags]) => {
    for (const cat of (cats as { categorias: IdNombre[] }).categorias) categorias.set(norm(cat.nombre), Promise.resolve(cat.id))
    for (const ing of (ings as { ingredientes: IdNombre[] }).ingredientes) ingredientes.set(norm(ing.nombre), Promise.resolve(ing.id))
    for (const ag of (ags as { agregados: ExtraCatalogo[] }).agregados.filter(ag => ag.activo !== false)) {
      extras.set(extraKey(ag.nombre, Number(ag.precio)), Promise.resolve(ag.id))
      extrasPorId.set(ag.id, { nombre: ag.nombre, precio: Number(ag.precio) })
    }
  }).catch(error => { carga = undefined; throw error })

  function resolver(map: Map<string, Promise<number>>, key: string, crear: () => Promise<number>) {
    if (!map.has(key)) map.set(key, crear().catch(error => { map.delete(key); throw error }))
    return map.get(key)!
  }

  return async (p: ProductoCarta): Promise<ProductoCarta> => {
    if (!p.nombre.trim()) throw new Error('Completá el nombre del producto')
    const opciones = [...p.variantes ?? [], ...p.variantesSecundarias ?? [], ...p.extras ?? [], ...p.extrasSecundarios ?? []]
    if (opciones.some(v => !v.nombre.trim() || !Number.isFinite(v.precio) || v.precio < 0)) throw new Error('Completá el nombre y precio de todas las opciones')
    if (p.variantesSecundarias?.length && !p.variantes?.length) throw new Error('La segunda elección necesita variantes principales')
    const precio = p.precio ?? (p.variantes?.length ? Math.min(...p.variantes.map(v => v.precio)) : 0)
    if (!Number.isFinite(precio) || precio < 0) throw new Error('Revisá el precio del producto')
    for (const titulo of [p.tituloVariantesPrimarias, p.tituloVariantesSecundarias, p.tituloExtrasPrimarios, p.tituloExtrasSecundarios, p.tituloNota]) {
      if (titulo !== undefined && !titulo.trim()) throw new Error('Las frases de cada paso no pueden estar vacías')
    }
    await cargar()
    const categoriaId = p.categoria?.trim() ? await resolver(categorias, norm(p.categoria), async () => {
      const res = await categoriasApi.create(token, { nombre: p.categoria!.trim(), esBebida: p.esBebida }) as { data: [{ insertId: number }] }
      return Number(res.data[0].insertId)
    }) : null
    if (categoriaId) await categoriasApi.update(token, { id: categoriaId, esBebida: p.esBebida ?? false })
    const ingredienteIds = await Promise.all((p.ingredientes ?? []).map(nombre => resolver(ingredientes, norm(nombre), async () => {
      const res = await ingredientesApi.create(token, { nombre: nombre.trim() }) as { data: { id: number } }
      return res.data.id
    })))
    const crearExtra = async (ex: OpcionCarta) => {
      const res = await agregadosApi.create(token, { nombre: ex.nombre.trim(), precio: ex.precio }) as { data: { id: number } }
      extrasPorId.set(res.data.id, { nombre: ex.nombre.trim(), precio: ex.precio })
      return res.data.id as number
    }
    const idsExtras = (opciones: OpcionCarta[]) => Promise.all(opciones.map(ex => {
      const existente = ex.id ? extrasPorId.get(ex.id) : null
      return existente && extraKey(existente.nombre, existente.precio) === extraKey(ex.nombre, ex.precio)
        ? Promise.resolve(ex.id!) : resolver(extras, extraKey(ex.nombre, ex.precio), () => crearExtra(ex))
    }))
    const primarios = await idsExtras(p.extras ?? [])
    const secundarios = await idsExtras(p.extrasSecundarios ?? [])
    // producto_agregado admite una sola relación por ID. Si el mismo extra está
    // en ambos pasos, una segunda ficha conserva las dos elecciones independientes.
    for (let i = 0; i < secundarios.length; i++) if (primarios.includes(secundarios[i])) {
      const ex = p.extrasSecundarios![i]
      secundarios[i] = await resolver(extras, `${extraKey(ex.nombre, ex.precio)}:segundo-grupo`, () => crearExtra(ex))
    }
    const payload = {
      nombre: p.nombre.trim(), descripcion: p.descripcion?.trim() || '', precio, categoriaId,
      image: p.image?.startsWith('data:') ? p.image : undefined,
      eliminarImagen: p.eliminarImagen === true,
      ingredienteIds, agregadoIds: [...new Set(primarios)], agregadoIdsSecundarios: [...new Set(secundarios)],
      variantes: p.variantes ?? [], variantesSecundarias: p.variantesSecundarias ?? [],
      tituloVariantesPrimarias: p.tituloVariantesPrimarias ?? 'Elegí una opción',
      tituloVariantesSecundarias: p.tituloVariantesSecundarias ?? 'Elegí también una segunda opción',
      tituloExtrasPrimarios: p.tituloExtrasPrimarios ?? 'Extras', tituloExtrasSecundarios: p.tituloExtrasSecundarios ?? 'Extras',
      permiteNota: p.permiteNota ?? false, tituloNota: p.tituloNota ?? '¿Querés aclarar algo?',
      activo: p.activo ?? true, etiquetas: p.etiquetas,
      puntosGanados: p.puntosGanados ?? 0, puntosNecesarios: p.puntosNecesarios ?? 0,
      descuento: p.descuento ?? 0, descuentoFechaInicio: p.descuentoFechaInicio || null, descuentoFechaFin: p.descuentoFechaFin || null,
      eventoSucursalId: p.eventoSucursalId ?? null,
    }
    const res = (p.id ? await productosApi.update(token, { id: p.id, ...payload }) : await productosApi.create(token, payload)) as ProductoGuardado
    if (!res.success) throw new Error(res.message || 'No se pudo guardar el producto')
    const variantes = (opciones: OpcionServidor[]) => opciones.map(v => ({ ...v, precio: Number(v.precio) }))
    return { ...p, id: p.id ?? res.productoId ?? Number(res.data?.[0]?.insertId), guardado: true, image: null, eliminarImagen: false,
      imagenUrl: p.eliminarImagen ? null : res.imagenUrl ?? p.imagenUrl,
      extras: (p.extras ?? []).map((ex, i) => ({ ...ex, id: primarios[i] })),
      extrasSecundarios: (p.extrasSecundarios ?? []).map((ex, i) => ({ ...ex, id: secundarios[i] })),
      etiquetas: !p.id && res.etiquetaAutoGenerada ? [res.etiquetaAutoGenerada, ...p.etiquetas ?? []] : p.etiquetas,
      variantes: variantes(res.variantes ?? p.variantes ?? []), variantesSecundarias: variantes(res.variantesSecundarias ?? p.variantesSecundarias ?? []),
    }
  }
}
