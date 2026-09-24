import type { ConfigMotorRecompra, ModoRecompra, SegmentoRecompra } from '@/lib/api'

// =============================================================================
// MOTOR DE RECOMPRA · EL VOCABULARIO
//
// Los segmentos, los topes, los formateadores y los pasos del flujo de envío, que usan tanto la
// pantalla del motor como los módulos del flujo (`FlujoEnvioTanda`, `PanelProgramaciones`).
// Viven acá y no en `MotorRecompra.tsx` para que los módulos no tengan que importar la pantalla que
// los monta: eso sería un ciclo de imports. Y son datos y funciones, sin JSX, para que los pueda
// importar también un archivo que no sea de React —los controles de UI (`Campo`, `ChipOpcion`,
// `Marca`, `Stepper`, `CampoModo`) están en `./controles`—.
//
// Los topes de acá son los del backend, que los vuelve a acotar en `normalizarEspecificacion` y en
// `guardarConfigMotor`. Sirven para que el control no deje escribir un valor imposible, no para
// autorizar: si divergieran, manda el servidor.
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

/**
 * Cómo se llama la acción según el modo. En automático el motor agenda y envía, así que "programar"
 * es literal. En manual no se agenda ningún envío —el motor deja el mensaje preparado en la cola y
 * lo manda el dueño desde su WhatsApp—, y por eso la misma acción se llama "preparar": prometer un
 * envío programado sería mentir sobre quién lo manda.
 *
 * Una sola fuente para el panel de tandas y el flujo por pasos: si cada pantalla eligiera su copy, el
 * modo manual terminaría diciendo "Programar envío" en alguna.
 *
 * No hay copy del resultado: confirmar cierra el flujo y la pantalla vuelve al tablero, así que lo que
 * quedó agendado se lee ahí y no en una pantalla intermedia que lo repita.
 */
export const COPY_ENVIO: Record<ModoRecompra, {
    /** El botón que confirma el paso final. */
    final: (cantidad: number) => string
    /** El verbo en infinitivo, para las frases del resumen ("Vas a programar 6 mensajes"). */
    infinitivo: 'programar' | 'preparar'
    vacioTitulo: string
    vacioSubtexto: string
}> = {
    automatico: {
        final: (n) => `Programar ${n} mensaje${n === 1 ? '' : 's'}`,
        infinitivo: 'programar',
        vacioTitulo: 'No hay nada programado',
        vacioSubtexto: 'El motor no manda mensajes por su cuenta: los que salen son los que programás vos.',
    },
    manual: {
        final: (n) => `Preparar ${n} mensaje${n === 1 ? '' : 's'}`,
        infinitivo: 'preparar',
        vacioTitulo: 'No hay nada preparado',
        vacioSubtexto: 'El motor no manda mensajes por su cuenta: los prepara y los enviás vos desde tu WhatsApp.',
    },
}

/** El copy del modo, con el automático como fallback si el backend mandara un valor inesperado. */
export const copyEnvio = (modo: ModoRecompra) => COPY_ENVIO[modo] ?? COPY_ENVIO.automatico

// ── Los pasos del flujo de envío ────────────────────────────────────────────────
//
// Un valor por paso, en el orden en que se deciden. Los títulos son los que se leen en el riel: el
// flujo los usa además como `data-paso`, así que cambiar uno es cambiar el ancla de los tests.

export type PasoId = 'modo' | 'cupo' | 'dias' | 'a-quienes' | 'lista' | 'toques' | 'control' | 'resumen'

export const PASOS: { id: PasoId; titulo: string }[] = [
    { id: 'modo', titulo: 'Modo' },
    { id: 'cupo', titulo: 'Cupo diario' },
    { id: 'dias', titulo: 'Días entre toques' },
    { id: 'a-quienes', titulo: 'A quiénes' },
    { id: 'lista', titulo: 'La lista' },
    { id: 'toques', titulo: 'Toques' },
    { id: 'control', titulo: 'Grupo de control' },
    { id: 'resumen', titulo: 'Resumen' },
]

// ── Los cinco valores del LOCAL ─────────────────────────────────────────────────

/**
 * Los cinco valores del local que se editan juntos, en los pasos del flujo. El modo va con ellos
 * porque también es del local: se guarda en el mismo `PUT`.
 */
export interface ValoresConfig {
    cupoDiario: number
    diasToque2: number
    diasToque3: number
    porcentajeControl: number
    modo: ModoRecompra
}

export const valoresDeConfig = (config: ConfigMotorRecompra): ValoresConfig => ({
    cupoDiario: config.cupoDiario,
    diasToque2: config.diasToque2,
    diasToque3: config.diasToque3,
    porcentajeControl: config.porcentajeControl,
    modo: config.modo,
})

/** ¿Hay algo para guardar? Si no cambió nada, el `PUT` de la config no se hace. */
export function hayCambios(valores: ValoresConfig, config: ConfigMotorRecompra): boolean {
    const guardado = valoresDeConfig(config)
    return (Object.keys(guardado) as (keyof ValoresConfig)[]).some(k => valores[k] !== guardado[k])
}

/**
 * El toast de la config guardada. El backend acota lo que recibe (el piso de 48 hs, el tope del
 * cupo): si lo guardado no es lo que se pidió, se dice —el dueño tiene que ver el número real—.
 */
export function mensajeDeAjuste(pedido: ValoresConfig, guardado: ConfigMotorRecompra | undefined): string {
    const ajustado = guardado && (
        guardado.cupoDiario !== pedido.cupoDiario
        || guardado.diasToque2 !== pedido.diasToque2
        || guardado.diasToque3 !== pedido.diasToque3
        || guardado.porcentajeControl !== pedido.porcentajeControl
    )
    return ajustado
        ? `Guardado con los límites del motor: ${guardado!.diasToque2} días entre toques, ${guardado!.porcentajeControl}% de control.`
        : 'Configuración guardada'
}
