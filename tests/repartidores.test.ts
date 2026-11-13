import { describe, expect, test } from 'bun:test'
import { parseImporte, tienePagoConfigurado } from '../src/lib/repartidores'

describe('importes de la liquidación de cadetes', () => {
  test('acepta el formato argentino y el decimal con punto', () => {
    expect(parseImporte('')).toBe(0)
    expect(parseImporte('   ')).toBe(0)
    expect(parseImporte('1500')).toBe(1500)
    expect(parseImporte('10.000')).toBe(10_000)
    expect(parseImporte('1.500,50')).toBe(1500.5)
    expect(parseImporte('1500.50')).toBe(1500.5)
    expect(parseImporte('$ 12.000')).toBe(12_000)
  })

  test('rechaza importes negativos o que no son números', () => {
    expect(parseImporte('-500')).toBeNull()
    expect(parseImporte('abc')).toBeNull()
    expect(parseImporte('1,2,3')).toBeNull()
  })

  test('un cadete sin importes configurados no muestra una liquidación', () => {
    expect(tienePagoConfigurado({
      precioEnvio: 0,
      pagoDiaHabil: 0,
      pagoFinDeSemana: 0,
      pagoFeriado: 0,
    })).toBe(false)
    expect(tienePagoConfigurado({
      precioEnvio: 0,
      pagoDiaHabil: 0,
      pagoFinDeSemana: 0,
      pagoFeriado: 20_000,
    })).toBe(true)
  })
})
