import { useEffect, useState } from 'react'

export type PosTipo = 'delivery' | 'takeaway' | 'mesa'
export type PosMetodoPago = 'cash' | 'tarjeta' | 'manual_transfer' | 'mercadopago'

export interface PosConfig {
    tipos: Record<PosTipo, boolean>
    metodosPago: Record<PosMetodoPago, boolean>
    camposCliente: { nombre: boolean; telefono: boolean; direccion: boolean }
    notas: boolean
    catalogoEnColumna: boolean
    mostrarColumnaPedidos: boolean
}

export const POS_CONFIG_KEY = 'piru:pos-config'
export const POS_CONFIG_CHANGED_EVENT = 'piru:pos-config-changed'

/** Clave del borrador POS en sessionStorage: una por sucursal, sin depender de
 *  la mesa asignada, para que asignar/desasignar mesa conserve el mismo borrador. */
export const posDraftStorageKey = (sucursalId: number | null, restauranteId?: number | null) =>
    `piru:pos-draft:${sucursalId ?? 'sin-sucursal'}${restauranteId != null ? `:restaurante:${restauranteId}` : ''}`

export const POS_TIPOS_ORDER: PosTipo[] = ['delivery', 'mesa', 'takeaway']
export const POS_METODOS_ORDER: PosMetodoPago[] = ['cash', 'tarjeta', 'manual_transfer', 'mercadopago']

export const DEFAULT_POS_CONFIG: PosConfig = {
    tipos: { delivery: true, takeaway: true, mesa: true },
    metodosPago: { cash: true, tarjeta: true, manual_transfer: true, mercadopago: true },
    camposCliente: { nombre: true, telefono: true, direccion: true },
    notas: true,
    catalogoEnColumna: false,
    mostrarColumnaPedidos: true,
}

/** Fusiona lo guardado con los defaults; la columna de catálogo requiere activación explícita. */
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
        catalogoEnColumna: parsed.mostrarColumnaPedidos === false || parsed.catalogoEnColumna === true,
        mostrarColumnaPedidos: parsed.mostrarColumnaPedidos !== false,
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
        window.dispatchEvent(new Event(POS_CONFIG_CHANGED_EVENT))
    } catch {
        // localStorage puede estar deshabilitado; el POS sigue funcionando con los defaults.
    }
}

/**
 * Configuración local del POS. Se actualiza en vivo si se guarda desde Módulos
 * o desde el propio flujo de venta, y también entre pestañas del mismo local.
 */
export const usePosConfig = (): PosConfig => {
    const [config, setConfig] = useState<PosConfig>(getPosConfig)
    useEffect(() => {
        const refresh = () => setConfig(getPosConfig())
        window.addEventListener(POS_CONFIG_CHANGED_EVENT, refresh)
        window.addEventListener('storage', refresh)
        return () => {
            window.removeEventListener(POS_CONFIG_CHANGED_EVENT, refresh)
            window.removeEventListener('storage', refresh)
        }
    }, [])
    return config
}
