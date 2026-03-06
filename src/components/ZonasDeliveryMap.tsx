import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Polygon, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'
import 'leaflet-draw'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuthStore } from '@/store/authStore'
import { zonasDeliveryApi } from '@/lib/api'
import { toast } from 'sonner'
import { Loader2, MapPin, Map as MapIcon } from 'lucide-react'

interface Coordenada {
    lat: number
    lng: number
}

interface ZonaDelivery {
    id: number
    restauranteId: number
    nombre: string
    precio: string
    poligono: Coordenada[]
    color: string | null
    createdAt: string
}

const ZONE_COLORS = [
    '#3b82f6', '#ef4444', '#22c55e', '#f59e0b',
    '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
]

function getNextColor(zonas: ZonaDelivery[]): string {
    const usedColors = zonas.map(z => z.color).filter(Boolean)
    const available = ZONE_COLORS.filter(c => !usedColors.includes(c))
    return available.length > 0 ? available[0] : ZONE_COLORS[zonas.length % ZONE_COLORS.length]
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
                    allowIntersection: true, // SOLUCIÓN: Permite cruzar líneas sin que se corte el dibujo
                    showArea: true,
                    shapeOptions: {
                        color: '#3b82f6',
                        weight: 2,
                        fillOpacity: 0.15,
                    },
                },
                polyline: false,
                rectangle: false,
                circle: false,
                marker: false,
                circlemarker: false,
            },
            edit: {
                featureGroup: drawnItems,
                remove: false,
                edit: false,
            },
        })

        map.addControl(drawControl)
        drawControlRef.current = drawControl

        map.on(L.Draw.Event.CREATED, (event: any) => {
            const layer = event.layer
            const latLngs = layer.getLatLngs()[0] as L.LatLng[]
            const coords: Coordenada[] = latLngs.map((ll: L.LatLng) => ({
                lat: ll.lat,
                lng: ll.lng,
            }))
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

export default function ZonasDeliveryMap() {
    const token = useAuthStore((state) => state.token)
    const [zonas, setZonas] = useState<ZonaDelivery[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)

    // Modal principal del mapa
    const [isMapModalOpen, setIsMapModalOpen] = useState(false)

    // Modales de formularios
    const [dialogOpen, setDialogOpen] = useState(false)
    const [pendingPolygon, setPendingPolygon] = useState<Coordenada[] | null>(null)
    const [formNombre, setFormNombre] = useState('')
    const [formPrecio, setFormPrecio] = useState('')
    const [formColor, setFormColor] = useState('')

    const [editingZona, setEditingZona] = useState<ZonaDelivery | null>(null)
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [editNombre, setEditNombre] = useState('')
    const [editPrecio, setEditPrecio] = useState('')
    const [editColor, setEditColor] = useState('')

    const defaultCenter: [number, number] = [-31.6333, -60.7]

    const fetchZonas = async () => {
        if (!token) return
        try {
            const res = await zonasDeliveryApi.getAll(token) as { success: boolean; data: ZonaDelivery[] }
            if (res.success) {
                setZonas(res.data)
            }
        } catch (error) {
            toast.error('Error al cargar zonas de delivery')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchZonas()
    }, [token])

    const handlePolygonCreated = (coords: Coordenada[]) => {
        const nextColor = getNextColor(zonas)
        setPendingPolygon(coords)
        setFormNombre('')
        setFormPrecio('')
        setFormColor(nextColor)
        setDialogOpen(true)
    }

    const handleSaveZona = async () => {
        if (!token || !pendingPolygon) return
        if (!formNombre.trim()) return toast.error('Ingresa un nombre para la zona')
        if (!formPrecio.trim()) return toast.error('Ingresa el precio de envío')

        setIsSaving(true)
        try {
            const res = await zonasDeliveryApi.create(token, {
                nombre: formNombre,
                precio: formPrecio,
                poligono: pendingPolygon,
                color: formColor || undefined,
            }) as { success: boolean; data: ZonaDelivery }

            if (res.success) {
                toast.success('Zona creada exitosamente')
                setZonas(prev => [...prev, res.data])
                setDialogOpen(false)
                setPendingPolygon(null)
            }
        } catch (error) {
            toast.error('Error al crear la zona')
        } finally {
            setIsSaving(false)
        }
    }

    const handleOpenEdit = (zona: ZonaDelivery) => {
        setEditingZona(zona)
        setEditNombre(zona.nombre)
        setEditPrecio(zona.precio)
        setEditColor(zona.color || '')
        setEditDialogOpen(true)
    }

    const handleUpdateZona = async () => {
        if (!token || !editingZona) return
        if (!editNombre.trim()) return toast.error('Ingresa un nombre')
        if (!editPrecio.trim()) return toast.error('Ingresa el precio')

        setIsSaving(true)
        try {
            const res = await zonasDeliveryApi.update(token, editingZona.id, {
                nombre: editNombre,
                precio: editPrecio,
                color: editColor || undefined,
            }) as { success: boolean; data: ZonaDelivery }

            if (res.success) {
                toast.success('Zona actualizada')
                setZonas(prev => prev.map(z => z.id === editingZona.id ? res.data : z))
                setEditDialogOpen(false)
                setEditingZona(null)
            }
        } catch (error) {
            toast.error('Error al actualizar la zona')
        } finally {
            setIsSaving(false)
        }
    }

    const handleDeleteZona = async (id: number) => {
        if (!token) return
        try {
            const res = await zonasDeliveryApi.delete(token, id) as { success: boolean }
            if (res.success) {
                toast.success('Zona eliminada')
                setZonas(prev => prev.filter(z => z.id !== id))
                if (editingZona?.id === id) {
                    setEditDialogOpen(false)
                    setEditingZona(null)
                }
            }
        } catch (error) {
            toast.error('Error al eliminar la zona')
        }
    }

    if (isLoading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        )
    }

    return (
        <>
            {/* Vista Principal Limpia */}
            <Card className="border-border">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="space-y-1">
                        <CardTitle className="text-xl flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-blue-500" />
                            Áreas de Reparto
                        </CardTitle>
                        <CardDescription>
                            Administra los radios de entrega y sus costos.
                        </CardDescription>
                    </div>
                    <Button onClick={() => setIsMapModalOpen(true)} className="gap-2">
                        <MapIcon className="h-4 w-4" />
                        Abrir Mapa de Zonas
                    </Button>
                </CardHeader>
                <CardContent className="pt-4">
                    {zonas.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {zonas.map((zona) => (
                                <div key={zona.id} className="flex flex-col p-4 rounded-xl border border-border bg-card shadow-sm">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div
                                            className="w-4 h-4 rounded-full shrink-0 shadow-inner"
                                            style={{ backgroundColor: zona.color || '#3b82f6' }}
                                        />
                                        <h4 className="font-semibold text-base truncate">{zona.nombre}</h4>
                                    </div>
                                    <div className="flex items-center justify-between mt-auto pt-2 border-t border-border">
                                        <span className="text-sm text-muted-foreground">Costo de envío</span>
                                        <span className="font-bold">${parseFloat(zona.precio).toFixed(0)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 border-2 border-dashed border-border rounded-xl bg-muted/30">
                            <MapPin className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
                            <h3 className="text-lg font-medium">Sin zonas definidas</h3>
                            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                                No tenés ningún área de delivery configurada. Abrí el mapa para delimitar tu primera zona.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Modal Grande para el Mapa */}
            <Dialog open={isMapModalOpen} onOpenChange={setIsMapModalOpen}>
                <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="p-4 px-6 border-b border-border bg-card shrink-0">
                        <DialogTitle className="flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <MapPin className="h-5 w-5 text-blue-500" />
                                Dibujar Zonas de Delivery
                            </span>
                        </DialogTitle>
                        <DialogDescription>
                            Hace clic en el ícono del polígono en la izquierda para empezar. Hace clic en el primer punto para cerrar la figura.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 w-full relative bg-muted/50">
                        {isMapModalOpen && (
                            <MapContainer
                                center={defaultCenter}
                                zoom={13}
                                style={{ height: '100%', width: '100%' }}
                                scrollWheelZoom={true}
                            >
                                <TileLayer
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                />

                                <DrawControl onPolygonCreated={handlePolygonCreated} />
                                <FitBounds zonas={zonas} />

                                {zonas.map((zona) => {
                                    const positions: [number, number][] = Array.isArray(zona.poligono)
                                        ? zona.poligono.map(c => [c.lat, c.lng])
                                        : []

                                    return (
                                        <Polygon
                                            key={zona.id}
                                            positions={positions}
                                            pathOptions={{
                                                color: zona.color || '#3b82f6',
                                                fillColor: zona.color || '#3b82f6',
                                                fillOpacity: 0.2,
                                                weight: 2,
                                            }}
                                            eventHandlers={{
                                                click: () => handleOpenEdit(zona),
                                            }}
                                        />
                                    )
                                })}

                                {pendingPolygon && (
                                    <Polygon
                                        positions={pendingPolygon.map(c => [c.lat, c.lng] as [number, number])}
                                        pathOptions={{
                                            color: formColor || '#3b82f6',
                                            fillColor: formColor || '#3b82f6',
                                            fillOpacity: 0.3,
                                            weight: 2,
                                            dashArray: '5 5',
                                        }}
                                    />
                                )}
                            </MapContainer>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal: Nueva Zona */}
            <Dialog open={dialogOpen} onOpenChange={(open) => {
                if (!open) setPendingPolygon(null)
                setDialogOpen(open)
            }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Guardar Área</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Nombre</Label>
                            <Input value={formNombre} onChange={(e) => setFormNombre(e.target.value)} disabled={isSaving} autoFocus />
                        </div>
                        <div className="space-y-2">
                            <Label>Precio del Envío ($)</Label>
                            <Input type="number" step="0.01" value={formPrecio} onChange={(e) => setFormPrecio(e.target.value)} disabled={isSaving} />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => { setDialogOpen(false); setPendingPolygon(null) }} disabled={isSaving}>Cancelar</Button>
                            <Button onClick={handleSaveZona} disabled={isSaving}>Guardar</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal: Editar Zona */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Editar Área</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Nombre</Label>
                            <Input value={editNombre} onChange={(e) => setEditNombre(e.target.value)} disabled={isSaving} />
                        </div>
                        <div className="space-y-2">
                            <Label>Precio ($)</Label>
                            <Input type="number" step="0.01" value={editPrecio} onChange={(e) => setEditPrecio(e.target.value)} disabled={isSaving} />
                        </div>
                        <div className="flex justify-between pt-2">
                            <Button variant="destructive" size="sm" onClick={() => editingZona && handleDeleteZona(editingZona.id)} disabled={isSaving}>
                                Eliminar
                            </Button>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={isSaving}>Cancelar</Button>
                                <Button onClick={handleUpdateZona} disabled={isSaving}>Actualizar</Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}