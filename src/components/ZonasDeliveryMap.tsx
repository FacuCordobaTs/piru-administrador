import { useEffect, useState, useRef, useMemo } from 'react'
import { MapContainer, TileLayer, Polygon, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'
import 'leaflet-draw'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuthStore } from '@/store/authStore'
import { zonasDeliveryApi } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Loader2, MapPin, Map as MapIcon, Trash2, Save, X, Pencil } from 'lucide-react'

// ─────────────────────────────────────────────
// Estilos base "Phantom"
// ─────────────────────────────────────────────
const phantomCardClass = ""
const phantomInputClass = "h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-transparent focus:ring-2 focus:ring-[#FF7A00]/30 transition-all text-base px-4 w-full"
const phantomLabelClass = "text-sm font-medium text-muted-foreground mb-2 block"

interface Coordenada { lat: number; lng: number }

interface ZonaDelivery {
    id: number
    restauranteId: number
    nombre: string
    precio: string
    poligono: Coordenada[]
    color: string | null
    sucursalId: number | null
    createdAt: string
}

interface Sucursal {
    id: number
    nombre: string
    activo: boolean
}

const ZONE_COLORS = ['#FF7A00', '#3b82f6', '#ef4444', '#22c55e', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

function getNextColor(zonas: ZonaDelivery[]): string {
    const usedColors = zonas.map(z => z.color).filter(Boolean)
    const available = ZONE_COLORS.filter(c => !usedColors.includes(c))
    return available.length > 0 ? available[0] : ZONE_COLORS[zonas.length % ZONE_COLORS.length]
}

// Helper para forzar el redibujado del mapa al abrir el modal (Fix clásico de Leaflet)
function MapResizer() {
    const map = useMap()
    useEffect(() => {
        const timer = setTimeout(() => { map.invalidateSize() }, 300)
        return () => clearTimeout(timer)
    }, [map])
    return null
}

// Recalcula el tamaño del mapa cuando cambia el layout (p. ej. al abrir/cerrar el
// panel lateral del formulario, que modifica el ancho disponible del mapa).
function MapResizeOnChange({ dep }: { dep: unknown }) {
    const map = useMap()
    useEffect(() => {
        const timer = setTimeout(() => { map.invalidateSize() }, 250)
        return () => clearTimeout(timer)
    }, [dep, map])
    return null
}

function DrawControl({ onPolygonCreated }: { onPolygonCreated: (coords: Coordenada[]) => void }) {
    const map = useMap()
    const drawControlRef = useRef<L.Control.Draw | null>(null)

    useEffect(() => {
        const drawnItems = new L.FeatureGroup()
        map.addLayer(drawnItems)

        const drawControl = new L.Control.Draw({
            draw: {
                polygon: {
                    allowIntersection: true,
                    showArea: true,
                    shapeOptions: { color: '#FF7A00', weight: 2, fillOpacity: 0.15 },
                },
                polyline: false, rectangle: false, circle: false, marker: false, circlemarker: false,
            },
            edit: { featureGroup: drawnItems, remove: false, edit: false },
        })

        map.addControl(drawControl)
        drawControlRef.current = drawControl

        map.on(L.Draw.Event.CREATED, (event: any) => {
            const layer = event.layer
            const latLngs = layer.getLatLngs()[0] as L.LatLng[]
            const coords: Coordenada[] = latLngs.map((ll: L.LatLng) => ({ lat: ll.lat, lng: ll.lng }))
            onPolygonCreated(coords)
        })

        return () => {
            map.removeControl(drawControl)
            map.removeLayer(drawnItems)
        }
    }, [map, onPolygonCreated])

    return null
}

function FitBounds({ zonas }: { zonas: ZonaDelivery[] }) {
    const map = useMap()
    useEffect(() => {
        if (zonas.length > 0) {
            const allCoords: L.LatLngExpression[] = []
            zonas.forEach(z => {
                if (Array.isArray(z.poligono)) {
                    z.poligono.forEach(c => allCoords.push([c.lat, c.lng]))
                }
            })
            if (allCoords.length > 0) {
                const bounds = L.latLngBounds(allCoords)
                map.fitBounds(bounds, { padding: [40, 40] })
            }
        }
    }, [zonas, map])
    return null
}

// Polígono de una zona ya creada. Cuando `isReshaping` está activo, habilita el modo
// edición de leaflet-draw sobre la capa: aparecen tiradores en cada vértice (y puntos
// medios) que el usuario puede arrastrar para reformar la zona sin redibujarla entera.
function EditablePolygon({
    positions,
    pathOptions,
    isReshaping,
    onClick,
    onLayerReady,
}: {
    positions: [number, number][]
    pathOptions: L.PathOptions
    isReshaping: boolean
    onClick?: () => void
    onLayerReady: (layer: L.Polygon) => void
}) {
    const layerRef = useRef<L.Polygon | null>(null)

    useEffect(() => {
        const layer = layerRef.current
        if (!layer) return
        const editing = (layer as any).editing
        if (!editing) return
        if (isReshaping) {
            editing.enable()
            onLayerReady(layer)
        } else {
            editing.disable()
        }
        return () => {
            try { editing.disable() } catch { /* noop */ }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isReshaping])

    return (
        <Polygon
            ref={(instance) => { layerRef.current = (instance as unknown as L.Polygon) || null }}
            positions={positions}
            pathOptions={pathOptions}
            eventHandlers={onClick ? { click: onClick } : {}}
        />
    )
}

export default function ZonasDeliveryMap() {
    const token = useAuthStore((state) => state.token)
    const [zonas, setZonas] = useState<ZonaDelivery[]>([])
    const [sucursales, setSucursales] = useState<Sucursal[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)

    // Modal principal del mapa
    const [isMapModalOpen, setIsMapModalOpen] = useState(false)

    // Estados para el Overlay flotante (en lugar de modales anidados)
    const [pendingPolygon, setPendingPolygon] = useState<Coordenada[] | null>(null)
    const [formNombre, setFormNombre] = useState('')
    const [formPrecio, setFormPrecio] = useState('')
    const [formColor, setFormColor] = useState('')
    const [formSucursalId, setFormSucursalId] = useState<number | null>(null)

    const [editingZona, setEditingZona] = useState<ZonaDelivery | null>(null)

    // Modo "reformar" (arrastrar vértices) de la zona que se está editando
    const [isReshaping, setIsReshaping] = useState(false)
    const [reshapedCoords, setReshapedCoords] = useState<Coordenada[] | null>(null)
    const editLayerRef = useRef<L.Polygon | null>(null)

    const defaultCenter: [number, number] = [-31.6333, -60.7]

    // Posiciones memoizadas por zona: mantienen una referencia estable entre renders
    // para que react-leaflet no reescriba la geometría (y descarte los vértices
    // arrastrados) cuando el usuario tipea en el formulario del overlay.
    const zonaPositions = useMemo(() => {
        const m = new Map<number, [number, number][]>()
        zonas.forEach((z) => {
            m.set(z.id, Array.isArray(z.poligono) ? z.poligono.map((c) => [c.lat, c.lng] as [number, number]) : [])
        })
        return m
    }, [zonas])

    // Lee las coordenadas actuales de la capa que se está reformando
    const readLayerCoords = (): Coordenada[] | null => {
        const layer = editLayerRef.current
        if (!layer) return null
        const latlngs = layer.getLatLngs()[0] as L.LatLng[]
        if (!Array.isArray(latlngs) || latlngs.length < 3) return null
        return latlngs.map((ll) => ({ lat: ll.lat, lng: ll.lng }))
    }

    const toggleReshape = () => {
        setIsReshaping((prev) => {
            if (prev) {
                // Salimos del modo edición: capturamos lo dibujado para no perderlo
                const coords = readLayerCoords()
                if (coords) setReshapedCoords(coords)
            } else {
                setReshapedCoords(null)
            }
            return !prev
        })
    }

    const fetchZonas = async () => {
        if (!token) return
        try {
            const res = await zonasDeliveryApi.getAll(token) as { success: boolean; data: ZonaDelivery[] }
            if (res.success) setZonas(res.data)
        } catch (error) {
            toast.error('Error al cargar zonas de delivery')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => { fetchZonas() }, [token])

    useEffect(() => {
        if (!token) return
        const fetchSucursales = async () => {
            try {
                const url = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
                const res = await fetch(`${url}/sucursales/list`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
                const data = await res.json()
                if (data.success) setSucursales(data.data.filter((s: Sucursal) => s.activo))
            } catch { /* ignore */ }
        }
        fetchSucursales()
    }, [token])

    const handlePolygonCreated = (coords: Coordenada[]) => {
        const nextColor = getNextColor(zonas)
        setIsReshaping(false)
        setReshapedCoords(null)
        setEditingZona(null) // Cerramos edición si estaba abierta
        setPendingPolygon(coords)
        setFormNombre('')
        setFormPrecio('')
        setFormColor(nextColor)
        setFormSucursalId(null)
    }

    const handleOpenEdit = (zona: ZonaDelivery) => {
        setPendingPolygon(null) // Cerramos creación si estaba abierta
        setIsReshaping(false)
        setReshapedCoords(null)
        editLayerRef.current = null
        setEditingZona(zona)
        setFormNombre(zona.nombre)
        setFormPrecio(zona.precio)
        setFormColor(zona.color || '')
        setFormSucursalId(zona.sucursalId ?? null)
    }

    const closeOverlay = () => {
        setPendingPolygon(null)
        setEditingZona(null)
        setFormSucursalId(null)
        setIsReshaping(false)
        setReshapedCoords(null)
        editLayerRef.current = null
    }

    const handleSaveZona = async () => {
        if (!token || (!pendingPolygon && !editingZona)) return
        if (!formNombre.trim()) return toast.error('Ingresa un nombre para la zona')
        if (!formPrecio.trim()) return toast.error('Ingresa el precio de envío')

        setIsSaving(true)
        try {
            if (editingZona) {
                // Si se reformó la zona (o se está reformando), enviamos el nuevo polígono
                let poligonoPayload: Coordenada[] | undefined
                if (isReshaping) {
                    const coords = readLayerCoords()
                    if (coords) poligonoPayload = coords
                } else if (reshapedCoords) {
                    poligonoPayload = reshapedCoords
                }

                // Actualizar
                const res = await zonasDeliveryApi.update(token, editingZona.id, {
                    nombre: formNombre,
                    precio: formPrecio,
                    color: formColor || undefined,
                    sucursalId: formSucursalId,
                    ...(poligonoPayload ? { poligono: poligonoPayload } : {}),
                }) as { success: boolean; data: ZonaDelivery }

                if (res.success) {
                    toast.success('Zona actualizada')
                    setZonas(prev => prev.map(z => z.id === editingZona.id ? res.data : z))
                    closeOverlay()
                }
            } else if (pendingPolygon) {
                // Crear
                const res = await zonasDeliveryApi.create(token, {
                    nombre: formNombre,
                    precio: formPrecio,
                    poligono: pendingPolygon,
                    color: formColor || undefined,
                    sucursalId: formSucursalId,
                }) as { success: boolean; data: ZonaDelivery }

                if (res.success) {
                    toast.success('Zona creada exitosamente')
                    setZonas(prev => [...prev, res.data])
                    closeOverlay()
                }
            }
        } catch (error) {
            toast.error('Error al guardar la zona')
        } finally {
            setIsSaving(false)
        }
    }

    const handleDeleteZona = async () => {
        if (!token || !editingZona) return
        setIsSaving(true)
        try {
            const res = await zonasDeliveryApi.delete(token, editingZona.id) as { success: boolean }
            if (res.success) {
                toast.success('Zona eliminada')
                setZonas(prev => prev.filter(z => z.id !== editingZona.id))
                closeOverlay()
            }
        } catch (error) {
            toast.error('Error al eliminar la zona')
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) {
        return (
            <div className={cn(phantomCardClass, "flex items-center justify-center py-20 h-full")}>
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className={cn(phantomCardClass, "h-full flex flex-col")}>

            {/* Vista Principal (Miniatura) */}
            <div className="p-6 flex flex-col h-full">
                <div className="mb-6 flex flex-col gap-4">
                    <div>
                        <h2 className="text-2xl font-bold mb-2 flex items-center gap-3">
                            <MapIcon className="h-6 w-6 text-[#FF7A00]" />
                            Áreas de Reparto
                        </h2>
                        <p className="text-muted-foreground text-sm">Administra los radios de entrega y sus costos.</p>
                    </div>
                    <Button onClick={() => setIsMapModalOpen(true)} className="shrink-0 h-12 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 font-bold px-5 w-full shadow-lg shadow-black/5">
                        <MapPin className="h-4 w-4 mr-2" /> Abrir Mapa
                    </Button>
                </div>

                <div className="flex-1 mt-2">
                    {zonas.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4">
                            {zonas.map((zona) => (
                                <div key={zona.id} className="flex flex-col p-4 rounded-[20px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 hover:border-[#FF7A00]/50 transition-colors">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div
                                            className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                                            style={{ backgroundColor: zona.color || '#3b82f6' }}
                                        />
                                        <h4 className="font-bold text-base truncate">{zona.nombre}</h4>
                                    </div>
                                    {zona.sucursalId != null && sucursales.length > 0 && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {sucursales.find(s => s.id === zona.sucursalId)?.nombre || ''}
                                        </p>
                                    )}
                                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-zinc-200/50 dark:border-zinc-800/50">
                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Costo</span>
                                        <span className="font-black text-lg text-foreground">${parseFloat(zona.precio).toFixed(0)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-[24px] bg-zinc-50/50 dark:bg-zinc-900/20 h-full flex flex-col items-center justify-center">
                            <div className="h-16 w-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4">
                                <MapPin className="h-8 w-8 text-blue-500" />
                            </div>
                            <h3 className="text-lg font-bold">Sin zonas definidas</h3>
                            <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                                No tenés ningún área configurada. Abrí el mapa y dibujá los radios donde realizás envíos.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Grande para el Mapa */}
            <Dialog open={isMapModalOpen} onOpenChange={(open) => {
                setIsMapModalOpen(open)
                if (!open) closeOverlay()
            }}>
                <DialogContent className="w-[97vw] max-w-[97vw] sm:max-w-[1600px] h-[92vh] flex flex-col p-0 overflow-hidden sm:rounded-[32px] border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                    <DialogHeader className="p-5 px-6 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 shrink-0">
                        <DialogTitle className="flex items-center justify-between text-xl font-bold">
                            <span className="flex items-center gap-3">
                                <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                                    <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-500" />
                                </div>
                                Dibujar Zonas de Delivery
                            </span>
                        </DialogTitle>
                        <DialogDescription className="text-sm mt-1">
                            Usa el ícono del polígono (⬟) a la izquierda para dibujar. Clic en las zonas ya creadas para editarlas.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 min-h-0 flex flex-col sm:flex-row">
                        <div className="relative flex-1 min-w-0 min-h-0 bg-zinc-100 dark:bg-zinc-900">
                        {isMapModalOpen && (
                            <MapContainer
                                center={defaultCenter}
                                zoom={13}
                                style={{ height: '100%', width: '100%', zIndex: 10 }}
                                scrollWheelZoom={true}
                            >
                                <TileLayer
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                />

                                <MapResizer />
                                <MapResizeOnChange dep={!!(pendingPolygon || editingZona)} />
                                <DrawControl onPolygonCreated={handlePolygonCreated} />
                                <FitBounds zonas={zonas} />

                                {zonas.map((zona) => {
                                    const positions = zonaPositions.get(zona.id) || []
                                    const isThisReshaping = editingZona?.id === zona.id && isReshaping

                                    return (
                                        <EditablePolygon
                                            key={zona.id}
                                            positions={positions}
                                            isReshaping={isThisReshaping}
                                            onLayerReady={(layer) => { editLayerRef.current = layer }}
                                            pathOptions={{
                                                color: zona.color || '#3b82f6',
                                                fillColor: zona.color || '#3b82f6',
                                                fillOpacity: 0.25,
                                                weight: isThisReshaping ? 3 : 2,
                                            }}
                                            onClick={isThisReshaping ? undefined : () => handleOpenEdit(zona)}
                                        />
                                    )
                                })}

                                {pendingPolygon && (
                                    <Polygon
                                        positions={pendingPolygon.map(c => [c.lat, c.lng] as [number, number])}
                                        pathOptions={{
                                            color: formColor || '#FF7A00',
                                            fillColor: formColor || '#FF7A00',
                                            fillOpacity: 0.3,
                                            weight: 2,
                                            dashArray: '5 5',
                                        }}
                                    />
                                )}
                            </MapContainer>
                        )}
                        </div>

                        {/* ── PANEL LATERAL FORMULARIO (a un costado del mapa, sin taparlo) ── */}
                        {(pendingPolygon || editingZona) && (
                            <div className="w-full sm:w-[400px] shrink-0 border-t sm:border-t-0 sm:border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 overflow-y-auto animate-in slide-in-from-right-8 fade-in">
                                <div className="flex justify-between items-center mb-5">
                                    <h3 className="text-xl font-bold flex items-center gap-2">
                                        <MapIcon className="h-5 w-5 text-[#FF7A00]" />
                                        {editingZona ? 'Editar Área' : 'Guardar Área'}
                                    </h3>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-900" onClick={closeOverlay}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <Label className={phantomLabelClass}>Nombre de la zona</Label>
                                        <Input
                                            value={formNombre}
                                            onChange={(e) => setFormNombre(e.target.value)}
                                            className={phantomInputClass}
                                            placeholder="Ej: Zona Norte"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className={phantomLabelClass}>Precio del Envío ($)</Label>
                                        <div className="relative">
                                            <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">$</span>
                                            <Input
                                                type="number" step="0.01"
                                                value={formPrecio}
                                                onChange={(e) => setFormPrecio(e.target.value)}
                                                className={cn(phantomInputClass, "pl-9 font-bold")}
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>
                                    {sucursales.length > 1 && (
                                        <div className="space-y-1">
                                            <Label className={phantomLabelClass}>Sucursal asignada</Label>
                                            <div className="flex flex-col gap-2">
                                                <div
                                                    onClick={() => setFormSucursalId(null)}
                                                    className={cn(
                                                        "flex items-center gap-3 px-4 py-3 rounded-2xl border-2 cursor-pointer transition-colors",
                                                        formSucursalId === null
                                                            ? "border-[#FF7A00] bg-orange-50/50 dark:bg-orange-950/20"
                                                            : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
                                                    )}
                                                >
                                                    <div className={cn("h-2 w-2 rounded-full shrink-0", formSucursalId === null ? "bg-[#FF7A00]" : "bg-zinc-300")} />
                                                    <span className="text-sm font-medium text-muted-foreground">Sin asignar (todas las sucursales)</span>
                                                </div>
                                                {sucursales.map(s => (
                                                    <div
                                                        key={s.id}
                                                        onClick={() => setFormSucursalId(s.id)}
                                                        className={cn(
                                                            "flex items-center gap-3 px-4 py-3 rounded-2xl border-2 cursor-pointer transition-colors",
                                                            formSucursalId === s.id
                                                                ? "border-[#FF7A00] bg-orange-50/50 dark:bg-orange-950/20"
                                                                : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
                                                        )}
                                                    >
                                                        <div className={cn("h-2 w-2 rounded-full shrink-0", formSucursalId === s.id ? "bg-[#FF7A00]" : "bg-zinc-300")} />
                                                        <span className="text-sm font-semibold text-foreground">{s.nombre}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {editingZona && (
                                    <div className="mt-5">
                                        <Button
                                            type="button"
                                            variant={isReshaping ? 'default' : 'outline'}
                                            onClick={toggleReshape}
                                            className={cn(
                                                "w-full h-12 rounded-2xl font-semibold",
                                                isReshaping
                                                    ? "bg-[#FF7A00] hover:bg-[#E66E00] text-white shadow-lg shadow-orange-500/20"
                                                    : "border-zinc-200 dark:border-zinc-800"
                                            )}
                                        >
                                            <Pencil className="h-4 w-4 mr-2" />
                                            {isReshaping ? 'Listo, dejar de editar forma' : 'Editar forma en el mapa'}
                                        </Button>
                                        {isReshaping && (
                                            <p className="text-xs text-muted-foreground mt-2 text-center">
                                                Arrastrá las puntas del área para modificarla. Tocá los puntos intermedios para agregar vértices.
                                            </p>
                                        )}
                                    </div>
                                )}

                                <div className="flex gap-2 mt-6">
                                    {editingZona && (
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-14 w-14 shrink-0 rounded-2xl text-red-500 border-red-200 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-900/20"
                                            onClick={handleDeleteZona}
                                            disabled={isSaving}
                                            title="Eliminar Zona"
                                        >
                                            <Trash2 className="h-5 w-5" />
                                        </Button>
                                    )}
                                    <Button
                                        className="flex-1 h-14 rounded-2xl bg-[#FF7A00] hover:bg-[#E66E00] text-white font-bold shadow-lg shadow-orange-500/20"
                                        onClick={handleSaveZona}
                                        disabled={isSaving}
                                    >
                                        {isSaving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
                                        {editingZona ? 'Actualizar' : 'Guardar Zona'}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}