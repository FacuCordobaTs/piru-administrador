export interface SedeOperacion { id: number; activo: boolean; soloPos?: boolean }

export function posPermitidoEnSede(sedes: SedeOperacion[], id: number | null): boolean {
    const elegida = sedes.find(s => s.id === id)
    if (elegida?.soloPos && !elegida.activo) return false
    return !sedes.some(s => s.soloPos && s.activo) || !!elegida?.soloPos
}

/** Defensa de impresión frente a respuestas en vuelo y cambios de computadora. */
export function pedidoEnSede(pedido: { sucursalId?: number | null; sucursalSoloPos?: boolean }, id: number | null): boolean {
    return id == null ? !pedido.sucursalSoloPos : pedido.sucursalId === id
}
