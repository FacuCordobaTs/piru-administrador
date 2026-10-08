import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Pointer } from 'lucide-react'
import { EscenaActiva } from './animacion'
import './escenas.css'

/**
 * El lienzo de una ilustración: se diseña a `ancho × alto` px y se escala al ancho disponible.
 * Es decorativa (`inert`): lo que muestra va en `etiqueta`. Las animaciones arrancan cuando la
 * escena entra en pantalla y se pausan al salir.
 */
export function Escena({
  ancho,
  alto,
  etiqueta,
  children,
}: {
  ancho: number
  alto: number
  etiqueta: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  // Sin IntersectionObserver no hay cómo saber si se ve: queda andando.
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.25 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      role="img"
      aria-label={etiqueta}
      className="escena"
      data-pausada={visible ? undefined : ''}
      style={{ '--escala-w': ancho, '--escala-h': alto } as CSSProperties}
    >
      <div className="escena-lienzo" inert>
        <EscenaActiva.Provider value={visible}>{children}</EscenaActiva.Provider>
      </div>
    </div>
  )
}

/** El dedo que toca un botón: la onda se vuelve a disparar con cada `vez` distinta. */
export function Toque({ vez }: { vez: number }) {
  return (
    <>
      <span
        key={vez}
        className="e-onda pointer-events-none absolute left-1/2 top-1/2 -ml-5 -mt-5 size-10 rounded-full bg-white/70"
      />
      <Pointer
        size={22}
        strokeWidth={2}
        className="e-pop absolute -bottom-3 right-1 fill-white text-ink drop-shadow"
      />
    </>
  )
}
