import type { SegmentoRecompra } from '@/lib/api'

// =============================================================================
// MOTOR DE RECOMPRA · EL VOCABULARIO
//
// Los segmentos, los topes y los formateadores que usan tanto la pantalla del motor como los módulos
// del asistente de programación (`DialogoProgramarEnvio`, `PanelProgramaciones`, `DialogoConfigMotor`).
// Viven acá y no en `MotorRecompra.tsx` para que los módulos no tengan que importar la pantalla que
// los monta: eso sería un ciclo de imports.
//
// Los topes de acá son los del backend, que los vuelve a acotar en `normalizarEspecificacion` y en
// `guardarConfigMotor`. Sirven para que el control no deje escribir un valor imposible, no para
// autorizar: si divergieran, manda el servidor.
//
// Los controles de UI (`Campo`, `ChipOpcion`, `Marca`, `Stepper`) están en `./controles`.
// =============================================================================

export type Segmento = SegmentoRecompra

export const SEG_META: Record<Segmento, { label: string; dot: string }> = {
    primer_pedido: { label: 'Primer pedido', dot: 'bg-emerald-500' },
    en_riesgo: { label: 'En riesgo', dot: 'bg-orange-500' },
    dormido: { label: 'Dormidos', dot: 'bg-violet-500' },
    perdido: { label: 'Perdidos', dot: 'bg-rose-500' },
}

/** Los segmentos que se pueden programar, en el orden en que se ofrecen. */
export const SEGMENTOS: Segmento[] = ['perdido', 'primer_pedido', 'en_riesgo', 'dormido']

export const CUPO_MIN = 5
export const CUPO_MAX = 60
export const CANTIDAD_MIN = 1
export const CANTIDAD_MAX = 500
export const DIAS_TOQUE_MIN = 2
export const DIAS_TOQUE_MAX = 30
export const CONTROL_MIN = 0
export const CONTROL_MAX = 30

/** El nombre del segmento de una tanda. `null` es una tanda "en general", de todos los segmentos. */
export function etiquetaSegmento(segmento: Segmento | null | undefined): string {
    return segmento ? SEG_META[segmento].label : 'En general'
}

/** Los tres toques del goteo: el ordinal con el que el dueño los nombra. */
const TOQUE_ORDINAL = ['1º', '2º', '3º']

/** "2º toque" · null si la fila no trae toque (las del grupo de control). */
export function etiquetaToque(toque: number | null | undefined): string | null {
    if (toque == null || !Number.isFinite(toque)) return null
    return `${TOQUE_ORDINAL[toque - 1] ?? `${toque}º`} toque`
}

export function toqueOrdinal(toque: number): string {
    return TOQUE_ORDINAL[toque - 1] ?? `${toque}º`
}

export const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value)

export const formatDateTime = (value: string | null) => value
    ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(value))
    : '—'

/**
 * "Sale el viernes 21:00" — el día y la hora que propone el motor para una fila o un candidato. Es
 * un texto ya armado por el backend (`horarioSugerido`), así que se muestra tal cual; esto es sólo
 * para el `proximoDespachoAt` de una tanda, que viene como fecha ISO.
 */
export const formatDiaHora = (value: string | null) => value
    ? new Intl.DateTimeFormat('es-AR', {
        weekday: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires',
    }).format(new Date(value))
    : null

/** "hace 3 días" · el número pelado, que es lo que se muestra al lado del nombre. */
export function etiquetaDias(dias: number | null): string {
    if (dias == null || !Number.isFinite(dias)) return 'sin pedidos'
    if (dias <= 0) return 'hoy'
    if (dias === 1) return 'ayer'
    return `hace ${dias} días`
}

/** Cuántos mensajes de control le tocan a un lote de N. Mismo redondeo que el backend. */
export function controlDeLote(contactados: number, porcentajeControl: number): number {
    return Math.round(contactados * porcentajeControl / 100)
}
