import { expect, test } from 'bun:test'
import { pedidoEnSede, posPermitidoEnSede } from '../src/lib/sucursalOperacion'

test('cada computadora imprime únicamente su sede, incluidos pedidos NULL del local', () => {
    const pedidos = [
        { id: 1, sucursalId: null },
        { id: 2, sucursalId: 10, sucursalSoloPos: false },
        { id: 3, sucursalId: 20, sucursalSoloPos: true },
    ]
    expect(pedidos.filter(p => pedidoEnSede(p, null)).map(p => p.id)).toEqual([1, 2])
    expect(pedidos.filter(p => pedidoEnSede(p, 20)).map(p => p.id)).toEqual([3])
    expect(pedidos.filter(p => pedidoEnSede(p, 10)).map(p => p.id)).toEqual([2])
    // Respuesta en vuelo de la sede anterior al cambiar de computadora/sucursal.
    expect(pedidoEnSede(pedidos[2], null)).toBe(false)
    expect(pedidoEnSede(pedidos[0], 20)).toBe(false)
})

test('POS por sede opt-in sin alterar restaurantes normales', () => {
    const normales = [{ id: 10, activo: true }, { id: 11, activo: true }]
    expect(posPermitidoEnSede([], null, true)).toBe(true)
    expect(posPermitidoEnSede(normales, null, true)).toBe(true)
    expect(posPermitidoEnSede(normales, 10, true)).toBe(true)
    const eventos = [...normales, { id: 20, activo: true, soloPos: true }]
    expect(posPermitidoEnSede(eventos, null, true)).toBe(false)
    expect(posPermitidoEnSede(eventos, 10, true)).toBe(false)
    expect(posPermitidoEnSede(eventos, 20, true)).toBe(true)
    eventos[2].activo = false
    expect(posPermitidoEnSede(eventos, 20, true)).toBe(false)
    expect(posPermitidoEnSede(eventos, null, true)).toBe(true)
})

test('evento activo habilita POS con módulo apagado; local e historial no', () => {
    const sedes = [
        { id: 10, activo: true, soloPos: false },
        { id: 20, activo: true, soloPos: true },
        { id: 21, activo: false, soloPos: true },
    ]
    expect(posPermitidoEnSede(sedes, 20, false)).toBe(true)
    for (const id of [null, 10, 21, 999]) expect(posPermitidoEnSede(sedes, id, false)).toBe(false)
    expect(posPermitidoEnSede([], null, false)).toBe(false)
})
