import 'fake-indexeddb/auto'
import { beforeEach, expect, mock, test } from 'bun:test'

class StoragePrueba {
    values = new Map<string, string>()
    get length() { return this.values.size }
    getItem(k: string) { return this.values.get(k) ?? null }
    setItem(k: string, v: string) { this.values.set(k, String(v)) }
    removeItem(k: string) { this.values.delete(k) }
    clear() { this.values.clear() }
    key(i: number) { return [...this.values.keys()][i] ?? null }
}
Object.defineProperty(globalThis, 'localStorage', { value: new StoragePrueba(), configurable: true })
Object.defineProperty(globalThis, 'sessionStorage', { value: new StoragePrueba(), configurable: true })
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true })
class ApiError extends Error { constructor(message: string, public status: number) { super(message) } }
const create = mock(async (_token: string, _body: any): Promise<any> => ({ success: true, data: { id: 1 } }))
const indice = mock(async (_token: string): Promise<any> => { throw new ApiError('Offline', 0) })
mock.module('../src/lib/api', () => ({ pedidoUnificadoApi: { create }, clientesApi: { indicePos: indice }, ApiError }))
const local = await import('../src/lib/posLocalDb')
const { useAuthStore } = await import('../src/store/authStore')
const queue = await import('../src/lib/posOffline')
const dir = await import('../src/lib/directorioClientesPos')

const contacto = (id: number, nombre = 'José Pérez') => ({ id, nombre, telefono: '341 5123456', telefonoNormalizado: '3415123456', updatedAt: '2026-09-01T00:00:00.000Z' })
const sesion = (id = 1) => useAuthStore.getState().setAuth(`token-${id}`, { id, nombre: 'Local', email: 'local@example.test' })
const pedido = (numero = 1): queue.PedidoPosPendiente => {
    const id = crypto.randomUUID()
    return { restauranteId: useAuthStore.getState().restaurante!.id, localId: id, localNumero: numero, creadoEn: new Date(2026, 8, numero).toISOString(), tipo: 'takeaway', estado: 'pendiente',
        draft: { items: [], nombreCliente: 'Cliente', telefono: '', total: 100 } as any,
        payload: { clientRequestId: id, tipo: 'takeaway', items: [{ productoId: 1, cantidad: 1 }] },
    }
}
beforeEach(async () => {
    create.mockReset(); indice.mockReset()
    create.mockImplementation(async () => ({ success: true, data: { id: 1 } }))
    indice.mockImplementation(async () => { throw new ApiError('Offline', 0) })
    localStorage.clear(); sessionStorage.clear()
    useAuthStore.getState().logout()
    await local.transaccionPos<void>(['clientes', 'pedidosPendientes', 'meta', 'productos', 'categorias', 'sucursales', 'mesas'], 'readwrite', tx => {
        for (const name of ['clientes', 'pedidosPendientes', 'meta', 'productos', 'categorias', 'sucursales', 'mesas']) tx.objectStore(name).clear()
    })
    sesion()
    await queue.usePosOfflineStore.getState().initPendientes(1)
})

test('snapshot completo, 3000 contactos, tildes, palabras, teléfono y máximo ocho', async () => {
    const lista = Array.from({ length: 3000 }, (_, i) => contacto(i + 1, `José Pérez ${i}`))
    await local.reemplazarDirectorio(1, lista)
    const clientes = await local.leerParticion<local.ClienteLocal>('clientes', 1)
    expect(clientes).toHaveLength(3000)
    expect(local.buscarClientes(clientes, 'j', 'nombre')).toHaveLength(0)
    expect(local.buscarClientes(clientes, '34', 'telefono')).toHaveLength(0)
    expect(local.buscarClientes(clientes, '  JOSE ', 'nombre')).toHaveLength(8)
    expect(local.buscarClientes(clientes, 'pér', 'nombre')).toHaveLength(8)
    expect(local.buscarClientes(clientes, '(341)', 'telefono')).toHaveLength(8)
    expect(indice).not.toHaveBeenCalled()
})
test('respuesta inválida y transacción abortada conservan el directorio anterior', async () => {
    await local.reemplazarDirectorio(1, [contacto(1)])
    await expect(local.reemplazarDirectorio(1, [{ id: 9 } as any])).rejects.toThrow()
    await expect(local.transaccionPos(['clientes'], 'readwrite', tx => { tx.objectStore('clientes').clear(); tx.abort() })).rejects.toThrow()
    expect(await local.leerParticion('clientes', 1)).toHaveLength(1)
    await local.reemplazarDirectorio(2, [contacto(2)])
    await local.reemplazarDirectorio(1, [])
    expect(await local.leerParticion('clientes', 1)).toHaveLength(0)
    expect(await local.leerParticion('clientes', 2)).toHaveLength(1)
})
test('migración legacy conserva UUID, contador, impresión y no resucita pedidos eliminados', async () => {
    const p = pedido(42)
    const raw = JSON.stringify([p])
    localStorage.setItem('piru:pos-pendientes:2', raw)
    sesion(2)
    await queue.usePosOfflineStore.getState().initPendientes(2)
    const [fila] = queue.usePosOfflineStore.getState().pendientes
    expect(fila.payload.clientRequestId).toBe(p.payload.clientRequestId)
    expect(fila.payload.impresoOffline).toBe(true)
    expect(fila.impresion).toBe('revisar')
    expect(localStorage.getItem('piru:pos-pendientes:2')).toBeNull()
    expect(await queue.nextLocalNumero(2)).toBe(43)
    await queue.usePosOfflineStore.getState().eliminarPendiente(fila.localId)
    localStorage.setItem('piru:pos-pendientes:2', raw)
    await queue.migrarColaLegacy(2)
    expect(await local.leerParticion('pedidosPendientes', 2)).toHaveLength(0)
})
test('JSON legacy corrupto nunca se borra', async () => {
    localStorage.setItem('piru:pos-pendientes:3', '{corrupto')
    await expect(queue.migrarColaLegacy(3)).rejects.toThrow()
    expect(localStorage.getItem('piru:pos-pendientes:3')).toBe('{corrupto')
})
test('cola durable sobrevive reinicio del store y elimina sólo tras confirmación válida', async () => {
    const p = pedido()
    await queue.usePosOfflineStore.getState().guardarPendiente(p)
    queue.usePosOfflineStore.setState({ restauranteId: null, pendientes: [] })
    await queue.usePosOfflineStore.getState().initPendientes(1)
    expect(queue.usePosOfflineStore.getState().pendientes[0].localId).toBe(p.localId)
    create.mockImplementationOnce(async () => ({ success: true, data: {} }))
    await queue.sincronizarPendientes()
    expect(await local.leerParticion('pedidosPendientes', 1)).toHaveLength(1)
    await queue.sincronizarPendientes()
    expect(create.mock.calls[0][1].clientRequestId).toBe(create.mock.calls[1][1].clientRequestId)
    expect(await local.leerParticion('pedidosPendientes', 1)).toHaveLength(0)
})
test('timeout después de crear reenvía el mismo UUID sin imprimir otra vez y respeta FIFO', async () => {
    const a = pedido(1), b = pedido(2)
    a.payload.impresoOffline = true
    await queue.usePosOfflineStore.getState().guardarPendiente(b)
    await queue.usePosOfflineStore.getState().guardarPendiente(a)
    const ventas = new Map<string, number>()
    let perder = true
    create.mockImplementation(async (_, body) => {
        if (!ventas.has(body.clientRequestId)) ventas.set(body.clientRequestId, ventas.size + 1)
        if (perder) { perder = false; throw new ApiError('Timeout', 0) }
        return { success: true, data: { id: ventas.get(body.clientRequestId) } }
    })
    await queue.sincronizarPendientes()
    expect(create.mock.calls[0][1].clientRequestId).toBe(a.localId)
    await Promise.all([queue.sincronizarPendientes(), queue.sincronizarPendientes()])
    expect(ventas.size).toBe(2)
    expect(create.mock.calls.map(x => x[1].clientRequestId)).toEqual([a.localId, a.localId, b.localId])
    expect(create.mock.calls[1][1].impresoOffline).toBe(true)
})
test('401 y logout conservan ventas, vacían memoria y no envían al nuevo tenant', async () => {
    await local.reemplazarDirectorio(1, [contacto(1)])
    const p = pedido()
    await queue.usePosOfflineStore.getState().guardarPendiente(p)
    create.mockImplementationOnce(async () => { useAuthStore.getState().logout(); throw new ApiError('Sesión vencida', 401) })
    await queue.sincronizarPendientes()
    expect(await local.leerParticion('pedidosPendientes', 1)).toHaveLength(1)
    expect(await local.leerParticion('clientes', 1)).toHaveLength(0)
    expect(queue.usePosOfflineStore.getState().pendientes).toHaveLength(0)
    sesion(2); await queue.usePosOfflineStore.getState().initPendientes(2)
    await queue.sincronizarPendientes()
    expect(create).toHaveBeenCalledTimes(1)
    sesion(1); await queue.usePosOfflineStore.getState().initPendientes(1)
    await queue.sincronizarPendientes()
    expect(await local.leerParticion('pedidosPendientes', 1)).toHaveLength(0)
})
test('422 queda visible, no se borra ni se reintenta automáticamente', async () => {
    await queue.usePosOfflineStore.getState().guardarPendiente(pedido())
    create.mockImplementation(async () => { throw new ApiError('Producto eliminado', 422) })
    await queue.sincronizarPendientes(); await queue.sincronizarPendientes()
    expect(create).toHaveBeenCalledTimes(1)
    expect(queue.usePosOfflineStore.getState().pendientes[0].estado).toBe('error_bloqueante')
})
test('dos claims concurrentes sólo permiten un envío; un claim vencido se recupera', async () => {
    const p = pedido()
    await queue.usePosOfflineStore.getState().guardarPendiente(p)
    const claims = await Promise.all([queue.reclamarPendiente(1, p.localId), queue.reclamarPendiente(1, p.localId)])
    expect(claims.filter(Boolean)).toHaveLength(1)
    await expect(queue.usePosOfflineStore.getState().eliminarPendiente(p.localId)).rejects.toThrow()
    await local.guardarRegistro('pedidosPendientes', { ...p, restauranteId: 1, estado: 'sincronizando', leaseHasta: Date.now() - 1 })
    await queue.sincronizarPendientes()
    expect(create).toHaveBeenCalledTimes(1)
})
test('una operación demorada de otra cuenta no puede escribir en la partición actual', async () => {
    const p = pedido()
    sesion(2); await queue.usePosOfflineStore.getState().initPendientes(2)
    await expect(queue.usePosOfflineStore.getState().guardarPendiente(p)).rejects.toThrow()
    expect(await local.leerParticion('pedidosPendientes', 2)).toHaveLength(0)
})
test('respuesta tardía del directorio no vuelve a llenar la partición después de logout', async () => {
    let resolver!: (value: any) => void
    indice.mockImplementation(() => new Promise(resolve => { resolver = resolve }))
    const cargar = dir.descargarDirectorioPos(1)
    const resultado = cargar.catch(error => error)
    while (!resolver) await new Promise(resolve => setTimeout(resolve, 1))
    useAuthStore.getState().logout()
    resolver({ success: true, data: [contacto(1)] })
    expect((await resultado).message).toContain('La sesión cambió')
    expect(await local.leerParticion('clientes', 1)).toHaveLength(0)
    expect(dir.useDirectorioPos.getState().clientes).toHaveLength(0)
})
test('un alta durante el snapshot no pierde la actualización de clienteIndice', async () => {
    let resolver!: (value: any) => void
    indice.mockImplementation(() => new Promise(resolve => { resolver = resolve }))
    const cargar = dir.descargarDirectorioPos(1)
    const resultado = cargar.catch(error => error)
    while (!resolver) await new Promise(resolve => setTimeout(resolve, 1))
    await dir.aplicarClienteRespuesta(1, { clienteIndice: contacto(8) })
    resolver({ success: true, data: [] })
    expect((await resultado).message).toContain('Los clientes cambiaron')
    expect(await local.leerParticion('clientes', 1)).toHaveLength(0)
    expect(dir.useDirectorioPos.getState().clientes.map(c => c.id)).toEqual([8])
})

test('abrir POS sólo lee la copia local; guardar pedidos no persiste clientes', async () => {
    await local.reemplazarDirectorio(1, [contacto(1)])
    await dir.cargarDirectorioPos(1)
    expect(indice).not.toHaveBeenCalled()
    expect(dir.useDirectorioPos.getState().clientes.map(c => c.id)).toEqual([1])
    await dir.aplicarClienteRespuesta(1, { clienteIndice: contacto(8) })
    expect(await local.leerParticion('clientes', 1)).toHaveLength(1)
    expect(dir.useDirectorioPos.getState().clientes).toHaveLength(2)
})

test('descarga manual guarda el snapshot, comparte requests y conserva la copia ante fallos', async () => {
    indice.mockImplementation(async () => ({ success: true, data: [contacto(3)] }))
    await Promise.all([dir.descargarDirectorioPos(1), dir.descargarDirectorioPos(1)])
    expect(indice).toHaveBeenCalledTimes(1)
    expect(await local.leerParticion('clientes', 1)).toHaveLength(1)
    expect(dir.useDirectorioPos.getState().clientes.map(c => c.id)).toEqual([3])
    indice.mockImplementation(async () => ({ success: true, data: [{ id: 9 }] }))
    await expect(dir.descargarDirectorioPos(1)).rejects.toThrow('directorio completo')
    indice.mockImplementation(async () => { throw new ApiError('Offline', 0) })
    await expect(dir.descargarDirectorioPos(1)).rejects.toThrow('Offline')
    expect((await local.leerParticion<local.ClienteLocal>('clientes', 1)).map(c => c.id)).toEqual([3])
})

test('reemplazarCatalogoLocal guarda productos, categorías, mesas y sucursales aisladas por tenant', async () => {
    const productos1 = [
        { id: 101, nombre: 'Hamburguesa Clásica', precio: '5000', activo: true, categoriaId: 10 },
        { id: 102, nombre: 'Papas Fritas', precio: '2500', activo: true, categoriaId: 11 },
    ]
    const categorias1 = [
        { id: 10, nombre: 'Hamburguesas', esBebida: false },
        { id: 11, nombre: 'Guarniciones', esBebida: false },
    ]
    const sucursales1 = [{ id: 1, nombre: 'Local Centro', activo: true, soloPos: false }]
    const mesas1 = [{ id: 1, nombre: 'Mesa 1', orden: 1 }]

    await local.reemplazarCatalogoLocal(1, {
        productos: productos1,
        categorias: categorias1,
        sucursales: sucursales1,
        mesas: mesas1,
        restaurante: { id: 1, nombre: 'Piru Burger' },
        suscripcion: { accesoPanel: true, features: ['pos'] },
    })

    const cat1 = await local.leerCatalogoLocal(1)
    expect(cat1.productos).toHaveLength(2)
    expect(cat1.categorias).toHaveLength(2)
    expect(cat1.sucursales).toHaveLength(1)
    expect(cat1.mesas).toHaveLength(1)
    expect(cat1.restaurante?.nombre).toBe('Piru Burger')
    expect(cat1.suscripcion?.accesoPanel).toBe(true)
    expect(cat1.count).toBe(2)
    expect(typeof cat1.syncedAt).toBe('string')

    // Tenant 2 debe estar completamente vacío
    const cat2 = await local.leerCatalogoLocal(2)
    expect(cat2.productos).toHaveLength(0)
    expect(cat2.categorias).toHaveLength(0)

    // Purgar tenant 1 no afecta a la cola ni a otros tenants
    await local.purgarCatalogoLocal(1)
    const cat1Purgado = await local.leerCatalogoLocal(1)
    expect(cat1Purgado.productos).toHaveLength(0)
    expect(cat1Purgado.categorias).toHaveLength(0)
    expect(cat1Purgado.restaurante).toBeNull()
})

test('guardarModulosLocal y leerModulosLocal preservan módulos activos para POS offline', async () => {
    const modulosMock = [
        { codigo: 'pos', activoAhora: true, estado: 'activo' },
        { codigo: 'mesas', activoAhora: true, estado: 'activo' },
    ]
    await local.guardarModulosLocal(1, modulosMock, { accesoPanel: true })
    const cached = await local.leerModulosLocal(1)
    expect(cached.modulos).toHaveLength(2)
    expect(cached.modulos?.[0]?.codigo).toBe('pos')
    expect(cached.suscripcion?.accesoPanel).toBe(true)

    // Tenant 2 no ve los módulos de tenant 1
    const cached2 = await local.leerModulosLocal(2)
    expect(cached2.modulos).toBeNull()
})
