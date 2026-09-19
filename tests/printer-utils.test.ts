import { describe, expect, test } from 'bun:test'
import { commandsToBytes, formatComanda, itemsParaComanda, prepararCopiasComanda } from '../src/utils/printerUtils'

describe('impresión ESC/POS', () => {
  test('dos copias conservan contenido, inicialización y corte de cada ticket sin modificar el original', () => {
    const original = commandsToBytes(formatComanda({
      id: 'LOCAL-42', tipo: 'takeaway', nombrePedido: 'José', sucursalNombre: 'Feria', metodoPago: 'cash',
    }, [{ cantidad: 2, nombreProducto: 'Alfajor', precioUnitario: '1500', varianteNombre: 'Chocolate' }], 'Local'))
    const snapshot = [...original]
    const doble = prepararCopiasComanda(original, 2)
    expect(doble).toHaveLength(original.length * 2)
    expect(doble.slice(0, original.length)).toEqual(original)
    expect(doble.slice(original.length)).toEqual(original)
    expect(doble.slice(original.length - 4, original.length + 2)).toEqual([0x1d, 0x56, 0x41, 0, 0x1b, 0x40])
    expect(doble.slice(-4)).toEqual([0x1d, 0x56, 0x41, 0])
    expect(original).toEqual(snapshot)
    expect(prepararCopiasComanda(original, 1)).toEqual(original)
  })
  test('codifica español y Unicode como bytes u8 válidos', () => {
    const bytes = commandsToBytes(['OROÑO 🛵 – José'])

    expect(bytes.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)).toBe(true)
    expect(bytes).toContain(0xa5) // Ñ en PC437
    expect(bytes).toContain(0x82) // é en PC437
    expect(bytes.filter((byte) => byte === 0x3f)).toHaveLength(1) // un emoji, un reemplazo
    expect(bytes).toContain(0x2d) // guión tipográfico normalizado
  })

  test('el pedido observado se puede serializar completo para Tauri', () => {
    const commands = formatComanda({
      id: 9247,
      tipo: 'delivery',
      nombrePedido: 'RAMIRO RAMIREZ',
      direccion: 'OROÑO 900 DEPTO C',
      metodoPago: 'cash',
      deliveryFee: 800,
    }, [
      { cantidad: 1, nombreProducto: 'Especial', varianteNombre: 'Simple', precioUnitario: '10300' },
      { cantidad: 1, nombreProducto: 'Panther', varianteNombre: 'Simple', precioUnitario: '10800' },
    ], 'Panther', { grandeMayusculas: true })

    const bytes = commandsToBytes(commands)
    expect(bytes.length).toBeGreaterThan(0)
    expect(bytes.every((byte) => byte >= 0 && byte <= 255)).toBe(true)
  })
})

describe('delta de comanda (claim de impresión)', () => {
  const pedido = {
    tipo: 'mesa' as const,
    items: [
      { id: 1, cantidad: 3, nombreProducto: 'Milanesa' },
      { id: 2, cantidad: 1, nombreProducto: 'Coca' },
    ],
  }

  test('una mesa imprime sólo los pendientes, con la cantidad reclamada', () => {
    const items = itemsParaComanda(pedido, { claimed: true, printFull: false, pendingItems: [{ id: 1, cantidad: 1 }] })

    // La mesa ya tenía 3 milanesas: lo que sale ahora es la cantidad nueva (1).
    expect(items).toEqual([{ id: 1, cantidad: 1, nombreProducto: 'Milanesa' }])
  })

  test('una mesa sin pendientes no imprime nada (null), aunque printFull venga en true', () => {
    expect(itemsParaComanda(pedido, { claimed: true, printFull: true, pendingItems: [] })).toBeNull()
    expect(itemsParaComanda(pedido, { claimed: true, printFull: true, pendingItems: [{ id: 99, cantidad: 1 }] })).toBeNull()
  })

  test('printFull reimprime la comanda entera sólo en delivery/takeaway', () => {
    const delivery = { tipo: 'delivery' as const, items: pedido.items }
    const claim = { claimed: true, printFull: true, pendingItems: [{ id: 2, cantidad: 1 }] }

    expect(itemsParaComanda(delivery, claim)).toEqual(delivery.items)
  })

  test('sin pendingItems (backend viejo) se imprime la comanda completa', () => {
    expect(itemsParaComanda(pedido, { claimed: true, printFull: false })).toEqual(pedido.items)
  })

  test('descarta pendientes inválidos en lugar de imprimirlos', () => {
    const items = itemsParaComanda(pedido, {
      claimed: true,
      printFull: false,
      pendingItems: [
        { id: 1, cantidad: 0 },
        { id: 2.5, cantidad: 1 },
        { id: 2, cantidad: 1 },
      ],
    })

    expect(items).toEqual([{ id: 2, cantidad: 1, nombreProducto: 'Coca' }])
  })

  test('el delta de delivery/takeaway sin coincidencias devuelve lista vacía, no null', () => {
    // El llamador decide ahí: lista vacía es un pedido sin productos imprimibles
    // (libera el claim y avisa), `null` es una mesa sin nada nuevo.
    expect(itemsParaComanda(
      { tipo: 'takeaway', items: pedido.items },
      { claimed: true, printFull: false, pendingItems: [{ id: 99, cantidad: 1 }] },
    )).toEqual([])
  })
})
