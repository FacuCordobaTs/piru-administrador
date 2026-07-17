export type Turno = { horaApertura: string; horaCierre: string }
/** Clave = día de la semana (0 = Domingo … 6 = Sábado), como en Perfil. */
export type Horarios = Record<number, Turno[]>

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
// Semana empezada en lunes (así "martes a domingo" queda consecutivo).
const ORDEN = [1, 2, 3, 4, 5, 6, 0]

function firma(turnos: Turno[]): string {
  return [...turnos].map((t) => `${t.horaApertura}-${t.horaCierre}`).sort().join('|')
}

function turnosATexto(turnos: Turno[]): string {
  return [...turnos]
    .sort((a, b) => a.horaApertura.localeCompare(b.horaApertura))
    .map((t) => `${t.horaApertura} a ${t.horaCierre}`)
    .join(' y ')
}

/** Formatea una lista de días (valores 0-6) como frase legible. */
function nombresDias(dias: number[]): string {
  const idx = dias.map((d) => ORDEN.indexOf(d)).sort((a, b) => a - b)
  const consecutivos = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1)
  if (consecutivos && idx.length >= 3) {
    return `${DIAS[ORDEN[idx[0]]]} a ${DIAS[ORDEN[idx[idx.length - 1]]].toLowerCase()}`
  }
  const nombres = idx.map((v, i) => (i === 0 ? DIAS[ORDEN[v]] : DIAS[ORDEN[v]].toLowerCase()))
  if (nombres.length === 1) return nombres[0]
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`
}

/**
 * Convierte los horarios en una oración legible (regla 11: modo lectura).
 * Agrupa días consecutivos con el mismo horario y menciona los cerrados.
 */
export function resumirHorarios(horarios: Horarios): string {
  const abiertos = ORDEN.filter((d) => (horarios[d]?.length ?? 0) > 0)
  const cerrados = ORDEN.filter((d) => !(horarios[d]?.length))
  if (abiertos.length === 0) return 'Sin horarios configurados'

  // Agrupar días abiertos por firma de turnos (respetando orden de aparición).
  const grupos = new Map<string, number[]>()
  for (const d of abiertos) {
    const f = firma(horarios[d])
    const g = grupos.get(f)
    if (g) g.push(d)
    else grupos.set(f, [d])
  }

  const partes: string[] = []
  for (const dias of grupos.values()) {
    const etiqueta = dias.length === 7 ? 'Todos los días' : nombresDias(dias)
    partes.push(`${etiqueta}, ${turnosATexto(horarios[dias[0]])}`)
  }

  // Mencionar cerrados solo si son pocos (si no, ya se entiende por los abiertos).
  if (cerrados.length > 0 && cerrados.length <= 3) {
    partes.push(`Cerrado los ${nombresDias(cerrados).toLowerCase()}`)
  }

  return partes.join(' · ')
}
