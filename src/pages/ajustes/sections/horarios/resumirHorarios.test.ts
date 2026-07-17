import { test, expect } from 'bun:test'
import { resumirHorarios, type Horarios } from './resumirHorarios'

const t = (a: string, c: string) => ({ horaApertura: a, horaCierre: c })

test('todos los días con el mismo horario', () => {
  const h: Horarios = {}
  for (let d = 0; d <= 6; d++) h[d] = [t('09:00', '18:00')]
  expect(resumirHorarios(h)).toBe('Todos los días, 09:00 a 18:00')
})

test('días salteados con el mismo horario', () => {
  const h: Horarios = {
    1: [t('09:00', '18:00')],
    3: [t('09:00', '18:00')],
    5: [t('09:00', '18:00')],
  }
  expect(resumirHorarios(h)).toBe('Lunes, miércoles y viernes, 09:00 a 18:00')
})

test('dos turnos en un día', () => {
  const h: Horarios = { 2: [t('09:00', '14:00'), t('20:00', '23:00')] }
  expect(resumirHorarios(h)).toBe('Martes, 09:00 a 14:00 y 20:00 a 23:00')
})

test('sin horarios configurados', () => {
  expect(resumirHorarios({})).toBe('Sin horarios configurados')
})

test('rango consecutivo con un día cerrado (caso CLAUDE.md)', () => {
  const h: Horarios = {}
  for (const d of [2, 3, 4, 5, 6, 0]) h[d] = [t('19:00', '23:30')]
  expect(resumirHorarios(h)).toBe('Martes a domingo, 19:00 a 23:30 · Cerrado los lunes')
})
