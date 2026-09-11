/** Única base local POS. Nunca comunicar éxito antes de transaction.oncomplete. */
export interface ClienteIndice {
    id: number; nombre: string; telefono: string; telefonoNormalizado: string | null; updatedAt: string
}
export interface ClienteLocal extends ClienteIndice { restauranteId: number; clienteId: number; nombreNormalizado: string }
export const normalizarNombre = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ')
let apertura: Promise<IDBDatabase> | undefined
export function abrirPosDb(): Promise<IDBDatabase> {
    if (apertura) return apertura
    apertura = new Promise<IDBDatabase>((resolve, reject) => {
        if (!globalThis.indexedDB) { reject(new Error('El almacenamiento local no está disponible')); return }
        const req = indexedDB.open('piru-pos-v2', 2)
        let descartada = false
        req.onupgradeneeded = () => {
            const db = req.result
            if (!db.objectStoreNames.contains('clientes')) {
                const clientes = db.createObjectStore('clientes', { keyPath: ['restauranteId', 'clienteId'] })
                clientes.createIndex('restaurante', 'restauranteId')
                clientes.createIndex('nombre', ['restauranteId', 'nombreNormalizado'])
                clientes.createIndex('telefono', ['restauranteId', 'telefonoNormalizado'])
            }
            if (!db.objectStoreNames.contains('pedidosPendientes')) {
                const pendientes = db.createObjectStore('pedidosPendientes', { keyPath: ['restauranteId', 'localId'] })
                pendientes.createIndex('restaurante', 'restauranteId')
                pendientes.createIndex('fecha', ['restauranteId', 'creadoEn'])
                pendientes.createIndex('estado', ['restauranteId', 'estado'])
            }
            if (!db.objectStoreNames.contains('meta')) {
                const meta = db.createObjectStore('meta', { keyPath: ['restauranteId', 'clave'] })
                meta.createIndex('restaurante', 'restauranteId')
            }
            if (!db.objectStoreNames.contains('productos')) {
                const productos = db.createObjectStore('productos', { keyPath: ['restauranteId', 'id'] })
                productos.createIndex('restaurante', 'restauranteId')
                productos.createIndex('categoria', ['restauranteId', 'categoriaId'])
            }
            if (!db.objectStoreNames.contains('categorias')) {
                const categorias = db.createObjectStore('categorias', { keyPath: ['restauranteId', 'id'] })
                categorias.createIndex('restaurante', 'restauranteId')
            }
            if (!db.objectStoreNames.contains('sucursales')) {
                const sucursales = db.createObjectStore('sucursales', { keyPath: ['restauranteId', 'id'] })
                sucursales.createIndex('restaurante', 'restauranteId')
            }
            if (!db.objectStoreNames.contains('mesas')) {
                const mesas = db.createObjectStore('mesas', { keyPath: ['restauranteId', 'id'] })
                mesas.createIndex('restaurante', 'restauranteId')
            }
        }
        req.onsuccess = () => {
            if (descartada) { req.result.close(); return }
            req.result.onversionchange = () => { req.result.close(); apertura = undefined }
            resolve(req.result)
        }
        req.onerror = () => reject(req.error)
        req.onblocked = () => { descartada = true; reject(new Error('Cerrá las otras ventanas para actualizar el almacenamiento POS')) }
    }).catch(error => { apertura = undefined; throw error })
    return apertura
}
export async function transaccionPos<T>(stores: string[], modo: IDBTransactionMode, ejecutar: (tx: IDBTransaction, resultado: (v: T) => void) => void): Promise<T> {
    const db = await abrirPosDb()
    return new Promise<T>((resolve, reject) => {
        const tx = db.transaction(stores, modo)
        let valor: T
        tx.oncomplete = () => resolve(valor)
        tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('No se pudo guardar en este dispositivo'))
        try { ejecutar(tx, v => { valor = v }) } catch (error) { tx.abort(); reject(error) }
    })
}
export function leerParticion<T>(store: string, restauranteId: number) {
    return transaccionPos<T[]>([store], 'readonly', (tx, done) => {
        const req = tx.objectStore(store).index('restaurante').getAll(restauranteId)
        req.onsuccess = () => done(req.result)
    })
}
export function guardarRegistro(store: string, registro: object) {
    return transaccionPos<void>([store], 'readwrite', tx => { tx.objectStore(store).put(registro) })
}
export function borrarRegistro(store: string, restauranteId: number, clave: string | number) {
    return transaccionPos<void>([store], 'readwrite', tx => { tx.objectStore(store).delete([restauranteId, clave]) })
}
export function leerMeta(restauranteId: number, clave: string) {
    return transaccionPos<{ valor?: unknown } | undefined>(['meta'], 'readonly', (tx, done) => {
        const req = tx.objectStore('meta').get([restauranteId, clave])
        req.onsuccess = () => done(req.result)
    })
}
function borrarParticion(tx: IDBTransaction, store: string, restauranteId: number) {
    tx.objectStore(store).delete(IDBKeyRange.bound([restauranteId], [restauranteId + 1], false, true))
}
/** Los pedidos sin confirmar se conservan: un logout (incluido 401) no pierde ventas.
 * Sólo el tenant autenticado puede cargarlos. El directorio y catálogo sí se purgan. */
export function purgarDirectorioPos(restauranteId: number) {
    return transaccionPos<void>(['clientes'], 'readwrite', tx => borrarParticion(tx, 'clientes', restauranteId))
}
export function purgarCatalogoLocal(restauranteId: number) {
    return transaccionPos<void>(['productos', 'categorias', 'sucursales', 'mesas', 'meta'], 'readwrite', tx => {
        borrarParticion(tx, 'productos', restauranteId)
        borrarParticion(tx, 'categorias', restauranteId)
        borrarParticion(tx, 'sucursales', restauranteId)
        borrarParticion(tx, 'mesas', restauranteId)
        // Purgar claves de catálogo en meta conservando contador y migración
        const meta = tx.objectStore('meta')
        for (const clave of ['catalogoSync', 'catalogoCount', 'perfilRestaurante', 'suscripcion', 'modulosCache']) {
            meta.delete([restauranteId, clave])
        }
    })
}
export function validarIndice(raw: unknown): raw is ClienteIndice[] {
    return Array.isArray(raw) && new Set(raw.map(x => x?.id)).size === raw.length && raw.every(x =>
        x && Number.isSafeInteger(x.id) && x.id > 0 && typeof x.nombre === 'string' && typeof x.telefono === 'string'
        && (x.telefonoNormalizado === null || (typeof x.telefonoNormalizado === 'string' && /^\d{8,20}$/.test(x.telefonoNormalizado)))
        && typeof x.updatedAt === 'string' && Number.isFinite(Date.parse(x.updatedAt)))
}
export const filaClienteLocal = (restauranteId: number, c: ClienteIndice): ClienteLocal => ({
    ...c, restauranteId, clienteId: c.id, nombreNormalizado: normalizarNombre(c.nombre),
})
export function reemplazarDirectorio(restauranteId: number, clientes: ClienteIndice[]) {
    if (!validarIndice(clientes)) return Promise.reject(new Error('Directorio incompleto o inválido'))
    return transaccionPos<void>(['clientes', 'meta'], 'readwrite', tx => {
        // Las operaciones de la transacción se ejecutan en orden.
        const store = tx.objectStore('clientes')
        borrarParticion(tx, 'clientes', restauranteId)
        clientes.forEach(c => store.put(filaClienteLocal(restauranteId, c)))
        tx.objectStore('meta').put({ restauranteId, clave: 'directorioSync', valor: new Date().toISOString() })
    })
}

export function buscarClientes(clientes: ClienteLocal[], consulta: string, campo: 'nombre' | 'telefono') {
    const nombre = normalizarNombre(consulta)
    const telefono = consulta.replace(/\D/g, '')
    if (campo === 'telefono' ? telefono.length < 3 : nombre.length < 2) return []
    return clientes.map(c => {
        const tel = c.telefonoNormalizado ?? c.telefono.replace(/\D/g, '')
        const rango = telefono.length >= 3 && tel === telefono ? 0
            : telefono.length >= 3 && tel.startsWith(telefono) ? 1
            : campo === 'nombre' && c.nombreNormalizado.startsWith(nombre) ? 2
            : campo === 'nombre' && c.nombreNormalizado.split(' ').some(p => p.startsWith(nombre)) ? 3 : 99
        return { c, rango }
    }).filter(x => x.rango < 99).sort((a, b) => a.rango - b.rango || a.c.nombreNormalizado.localeCompare(b.c.nombreNormalizado) || a.c.id - b.c.id)
        .slice(0, 8).map(x => x.c)
}

export interface CatalogoLocalData {
    productos: any[]
    categorias: any[]
    sucursales?: any[]
    mesas?: any[]
    restaurante?: any
    suscripcion?: any
}

export function reemplazarCatalogoLocal(restauranteId: number, data: CatalogoLocalData) {
    return transaccionPos<void>(['productos', 'categorias', 'sucursales', 'mesas', 'meta'], 'readwrite', tx => {
        const prodStore = tx.objectStore('productos')
        borrarParticion(tx, 'productos', restauranteId)
        if (Array.isArray(data.productos)) {
            data.productos.forEach(p => {
                if (p && Number.isSafeInteger(p.id)) {
                    prodStore.put({ ...p, restauranteId })
                }
            })
        }

        const catStore = tx.objectStore('categorias')
        borrarParticion(tx, 'categorias', restauranteId)
        if (Array.isArray(data.categorias)) {
            data.categorias.forEach(c => {
                if (c && Number.isSafeInteger(c.id)) {
                    catStore.put({ ...c, restauranteId })
                }
            })
        }

        if (Array.isArray(data.sucursales)) {
            const sucStore = tx.objectStore('sucursales')
            borrarParticion(tx, 'sucursales', restauranteId)
            data.sucursales.forEach(s => {
                if (s && Number.isSafeInteger(s.id)) {
                    sucStore.put({ ...s, restauranteId })
                }
            })
        }

        if (Array.isArray(data.mesas)) {
            const mesaStore = tx.objectStore('mesas')
            borrarParticion(tx, 'mesas', restauranteId)
            data.mesas.forEach(m => {
                if (m && Number.isSafeInteger(m.id)) {
                    mesaStore.put({ ...m, restauranteId })
                }
            })
        }

        const meta = tx.objectStore('meta')
        meta.put({ restauranteId, clave: 'catalogoSync', valor: new Date().toISOString() })
        meta.put({ restauranteId, clave: 'catalogoCount', valor: Array.isArray(data.productos) ? data.productos.length : 0 })
        if (data.restaurante) {
            meta.put({ restauranteId, clave: 'perfilRestaurante', valor: data.restaurante })
        }
        if (data.suscripcion) {
            meta.put({ restauranteId, clave: 'suscripcion', valor: data.suscripcion })
        }
    })
}

export async function leerCatalogoLocal(restauranteId: number) {
    const [productos, categorias, sucursales, mesas, syncMeta, countMeta, perfilMeta, subMeta] = await Promise.all([
        leerParticion<any>('productos', restauranteId),
        leerParticion<any>('categorias', restauranteId),
        leerParticion<any>('sucursales', restauranteId),
        leerParticion<any>('mesas', restauranteId),
        leerMeta(restauranteId, 'catalogoSync'),
        leerMeta(restauranteId, 'catalogoCount'),
        leerMeta(restauranteId, 'perfilRestaurante'),
        leerMeta(restauranteId, 'suscripcion'),
    ])
    return {
        productos,
        categorias,
        sucursales,
        mesas,
        restaurante: (perfilMeta?.valor as any) ?? null,
        suscripcion: (subMeta?.valor as any) ?? null,
        syncedAt: typeof syncMeta?.valor === 'string' ? syncMeta.valor : null,
        count: typeof countMeta?.valor === 'number' ? countMeta.valor : productos.length,
    }
}

export function guardarModulosLocal(restauranteId: number, modulos: any[], suscripcion?: any) {
    return transaccionPos<void>(['meta'], 'readwrite', tx => {
        const meta = tx.objectStore('meta')
        meta.put({ restauranteId, clave: 'modulosCache', valor: modulos })
        if (suscripcion) meta.put({ restauranteId, clave: 'suscripcionModulosCache', valor: suscripcion })
        meta.put({ restauranteId, clave: 'modulosSync', valor: new Date().toISOString() })
    })
}

export async function leerModulosLocal(restauranteId: number) {
    const [modulosMeta, subMeta] = await Promise.all([
        leerMeta(restauranteId, 'modulosCache'),
        leerMeta(restauranteId, 'suscripcionModulosCache'),
    ])
    return {
        modulos: Array.isArray(modulosMeta?.valor) ? (modulosMeta.valor as any[]) : null,
        suscripcion: (subMeta?.valor as any) ?? null,
    }
}
