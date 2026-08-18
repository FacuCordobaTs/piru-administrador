import { useState } from 'react'

export type PosTipo = 'delivery' | 'takeaway' | 'mesa'
export type PosMetodoPago = 'cash' | 'tarjeta' | 'manual_transfer' | 'mercadopago'

export interface PosConfig {
    tipos: Record<PosTipo, boolean>
    metodosPago: Record<PosMetodoPago, boolean>
    camposCliente: { nombre: boolean; telefono: boolean; direccion: boolean }
    notas: boolean
}

export const POS_CONFIG_KEY = 'piru:pos-config'

export const POS_TIPOS_ORDER: PosTipo[] = ['delivery', 'mesa', 'takeaway']
export const POS_METODOS_ORDER: PosMetodoPago[] = ['cash', 'tarjeta', 'manual_transfer', 'mercadopago']

export const DEFAULT_POS_CONFIG: PosConfig = {
    tipos: { delivery: true, takeaway: true, mesa: true },
    metodosPago: { cash: true, tarjeta: true, manual_transfer: true, mercadopago: true },
    camposCliente: { nombre: true, telefono: true, direccion: true },
    notas: true,
}

/** Fusiona lo guardado con los defaults: faltantes y valores inválidos quedan habilitados. */
const mergeConfig = (raw: unknown): PosConfig => {
    if (!raw || typeof raw !== 'object') return DEFAULT_POS_CONFIG
    const parsed = raw as Partial<PosConfig>
    return {
        tipos: {
            delivery: parsed.tipos?.delivery !== false,
            takeaway: parsed.tipos?.takeaway !== false,
            mesa: parsed.tipos?.mesa !== false,
        },
        metodosPago: {
            cash: parsed.metodosPago?.cash !== false,
            tarjeta: parsed.metodosPago?.tarjeta !== false,
            manual_transfer: parsed.metodosPago?.manual_transfer !== false,
            mercadopago: parsed.metodosPago?.mercadopago !== false,
        },
        camposCliente: {
            nombre: parsed.camposCliente?.nombre !== false,
            telefono: parsed.camposCliente?.telefono !== false,
            direccion: parsed.camposCliente?.direccion !== false,
        },
        notas: parsed.notas !== false,
    }
}

export const getPosConfig = (): PosConfig => {
    try {
        const raw = localStorage.getItem(POS_CONFIG_KEY)
        return raw ? mergeConfig(JSON.parse(raw)) : DEFAULT_POS_CONFIG
    } catch {
        return DEFAULT_POS_CONFIG
    }
}

export const setPosConfig = (config: PosConfig): void => {
    try {
        localStorage.setItem(POS_CONFIG_KEY, JSON.stringify(config))
    } catch {
        // localStorage puede estar deshabilitado; el POS sigue funcionando con los defaults.
    }
}

/**
 * Configuración del POS leída una sola vez al montar el componente. Se configura
 * desde Módulos y el POS (mobile y comanda desktop) la aplica al renderizar.
 */
export const usePosConfig = (): PosConfig => {
    const [config] = useState<PosConfig>(getPosConfig)
    return config
}
