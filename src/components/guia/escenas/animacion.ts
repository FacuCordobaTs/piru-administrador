import { createContext, useContext, useEffect, useRef, useState, type CSSProperties } from 'react'

/**
 * Las piezas de las ilustraciones de la guía, las mismas que usa la app de marketing
 * (marketers/src/components/escenas/animacion.ts).
 */

/** Si la escena se está viendo: fuera de pantalla queda congelada. */
export const EscenaActiva = createContext(true)

export const movimientoReducido = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

/** Retraso de una animación de entrada (`style={d(300)}`), más otras variables de la pieza. */
export const d = (ms: number, extra: Record<string, string | number> = {}) =>
  ({ '--d': `${ms}ms`, ...extra }) as CSSProperties

/**
 * Un contador que avanza cada `ms` mientras la escena se ve: la escena usa `n % pasos` para saber
 * en qué fase está (y `n` entero cuando necesita no volver atrás, como una rotación). Con movimiento
 * reducido queda quieto en `quieto`, que conviene que sea la fase que mejor se explica sola.
 */
export function useSecuencia(ms: number, quieto = 0) {
  const activa = useContext(EscenaActiva)
  const [reducido] = useState(movimientoReducido)
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!activa || reducido) return
    const timer = window.setInterval(() => setN((v) => v + 1), ms)
    return () => window.clearInterval(timer)
  }, [activa, reducido, ms])
  return reducido ? quieto : n
}

/** Un número que cuenta de `desde` a `hasta` la primera vez que la escena se ve. */
export function useContador(hasta: number, ms = 1200, retraso = 0, desde = 0) {
  const activa = useContext(EscenaActiva)
  const [valor, setValor] = useState(() => (movimientoReducido() ? hasta : desde))
  const completo = useRef(false)
  useEffect(() => {
    if (!activa || completo.current || movimientoReducido()) return
    let cuadro = 0
    const inicio = performance.now() + retraso
    const paso = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - inicio) / ms))
      setValor(Math.round(desde + (hasta - desde) * (1 - (1 - p) ** 3)))
      if (p < 1) cuadro = requestAnimationFrame(paso)
      else completo.current = true
    }
    cuadro = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(cuadro)
  }, [activa, hasta, ms, retraso, desde])
  return valor
}
