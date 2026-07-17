import { useEffect, useRef, useState, useCallback } from 'react'
import { useRestauranteStore } from '@/store/restauranteStore'
import { useOptimisticUpdate } from './useOptimisticUpdate'

// Tipos mínimos de Google Places (evita `any`; la lib se carga por <script>).
interface PlaceResult {
  formatted_address?: string
  geometry?: { location?: { lat: () => number; lng: () => number } }
}
interface GAutocomplete {
  addListener: (evt: string, cb: () => void) => void
  getPlace: () => PlaceResult
}
interface GMaps {
  maps?: {
    places?: {
      Autocomplete: new (
        input: HTMLInputElement,
        opts: Record<string, unknown>
      ) => GAutocomplete
    }
  }
}
function gmaps(): GMaps | undefined {
  return (window as unknown as { google?: GMaps }).google
}

/**
 * Autocompletado de dirección con Google Places + autosave optimista de
 * dirección/lat/lng (los 3 juntos). Movido desde Perfil.tsx.
 *
 * Uso: enganchar `inputRef` a un <input>, `value={direccion}`, `onChange`
 * al `onChange` del input, y llamar `guardar()` en onBlur. `status` alimenta
 * al <SavedIndicator/>. `geocodificada` indica si hay coordenadas válidas.
 */
export function useDireccionAutocomplete() {
  const restaurante = useRestauranteStore((s) => s.restaurante)
  const { run, status } = useOptimisticUpdate()

  const [direccion, setDireccionState] = useState('')
  const latRef = useRef<number | null>(null)
  const lngRef = useRef<number | null>(null)
  const [geocodificada, setGeocodificada] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<GAutocomplete | null>(null)
  const initedRef = useRef(false)

  // Sembrar los valores actuales una sola vez, cuando carga el restaurante.
  useEffect(() => {
    if (!restaurante || initedRef.current) return
    initedRef.current = true
    setDireccionState(restaurante.direccionTexto || '')
    latRef.current = restaurante.direccionLat ? parseFloat(restaurante.direccionLat) : null
    lngRef.current = restaurante.direccionLng ? parseFloat(restaurante.direccionLng) : null
    setGeocodificada(latRef.current != null)
  }, [restaurante])

  // Cargar el script de Google Maps Places una vez.
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    if (!apiKey || gmaps()?.maps?.places) return
    if (document.querySelector('script[data-gmaps]')) return
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    script.async = true
    script.defer = true
    script.dataset.gmaps = '1'
    document.head.appendChild(script)
  }, [])

  // Inicializar el autocomplete cuando el input está montado y la lib lista.
  useEffect(() => {
    const init = () => {
      const places = gmaps()?.maps?.places
      if (!inputRef.current || !places || autocompleteRef.current) return
      const ac = new places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'ar' },
        fields: ['formatted_address', 'geometry'],
        types: ['address'],
      })
      ac.addListener('place_changed', () => {
        const place = ac.getPlace()
        const loc = place?.geometry?.location
        if (loc) {
          setDireccionState(place.formatted_address || '')
          latRef.current = loc.lat()
          lngRef.current = loc.lng()
          setGeocodificada(true)
        }
      })
      autocompleteRef.current = ac
    }

    if (gmaps()?.maps?.places) {
      init()
      return
    }
    const interval = setInterval(() => {
      if (gmaps()?.maps?.places) {
        clearInterval(interval)
        init()
      }
    }, 200)
    return () => clearInterval(interval)
  }, [])

  const onChange = useCallback((valor: string) => {
    setDireccionState(valor)
    latRef.current = null
    lngRef.current = null
    setGeocodificada(false)
  }, [])

  const guardar = useCallback(() => {
    const previoTexto = useRestauranteStore.getState().restaurante?.direccionTexto || ''
    const nuevoTexto = direccion.trim()
    if (nuevoTexto === previoTexto) return
    void run(
      {
        direccionTexto: nuevoTexto || null,
        direccionLat: latRef.current != null ? String(latRef.current) : null,
        direccionLng: lngRef.current != null ? String(lngRef.current) : null,
      },
      {
        direccionTexto: nuevoTexto || null,
        direccionLat: latRef.current,
        direccionLng: lngRef.current,
      }
    )
  }, [direccion, run])

  return { inputRef, direccion, onChange, geocodificada, guardar, status }
}
