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
        const req = indexedDB.open('piru-pos-v2', 1)
        let descartada = false
        req.onupgradeneeded = () => {
            const db = req.result
            const clientes = db.createObjectStore('clientes', { keyPath: ['restauranteId', 'clienteId'] })
            clientes.createIndex('restaurante', 'restauranteId')
            clientes.createIndex('nombre', ['restauranteId', 'nombreNormalizado'])
            clientes.createIndex('telefono', ['restauranteId', 'telefonoNormalizado'])
            const pendientes = db.createObjectStore('pedidosPendientes', { keyPath: ['restauranteId', 'localId'] })
            pendientes.createIndex('restaurante', 'restauranteId')
            pendientes.createIndex('fecha', ['restauranteId', 'creadoEn'])
            pendientes.createIndex('estado', ['restauranteId', 'estado'])
            const meta = db.createObjectStore('meta', { keyPath: ['restauranteId', 'clave'] })
            meta.createIndex('restaurante', 'restauranteId')
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
 * Sólo el tenant autenticado puede cargarlos. El directorio sí se purga. */
export function purgarDirectorioPos(restauranteId: number) {
    return transaccionPos<void>(['clientes'], 'readwrite', tx => borrarParticion(tx, 'clientes', restauranteId))
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
