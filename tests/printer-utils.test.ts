import { describe, expect, test } from 'bun:test'
import { commandsToBytes, formatComanda } from '../src/utils/printerUtils'

describe('impresión ESC/POS', () => {
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
