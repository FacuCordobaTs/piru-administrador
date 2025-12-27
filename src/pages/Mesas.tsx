import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRestauranteStore } from '@/store/restauranteStore'
import { useAuthStore } from '@/store/authStore'
import { mesasApi, ApiError } from '@/lib/api'
import { useMesaWebSocket } from '@/hooks/useMesaWebSocket'
import { toast } from 'sonner'
import MesaQRCode from '@/components/MesaQRCode'
import { Table, Clock, Eye, Loader2, QrCode, Plus, Wifi, WifiOff } from 'lucide-react'

const Mesas = () => {
  const { mesas, isLoading, fetchData, restaurante } = useRestauranteStore()
  const token = useAuthStore((state) => state.token)
  const [selectedMesa, setSelectedMesa] = useState<typeof mesas[0] | null>(null)
  const [verQR, setVerQR] = useState(false)
  const [crearMesaDialog, setCrearMesaDialog] = useState(false)
  const [nombreMesa, setNombreMesa] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [eliminarMesaDialog, setEliminarMesaDialog] = useState(false)
  const [mesaAEliminar, setMesaAEliminar] = useState<typeof mesas[0] | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // WebSocket connection para la mesa seleccionada
  const { state: mesaState, isConnected } = useMesaWebSocket(
    selectedMesa?.qrToken || null
  )

  useEffect(() => {
    if (!restaurante) {
      fetchData()
    }
  }, [])

  const handleCrearMesa = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!token) {
      toast.error('No hay sesión activa')
      return
    }

    if (!nombreMesa.trim()) {
      toast.error('El nombre de la mesa es requerido')
      return
    }

    setIsCreating(true)

    try {
      await mesasApi.create(token, nombreMesa)

      toast.success('Mesa creada', {
        description: 'La mesa se creó correctamente',
      })

      // Refrescar datos
      await fetchData()
      setCrearMesaDialog(false)
      setNombreMesa('')
    } catch (error) {
      console.error('Error al crear mesa:', error)
      if (error instanceof ApiError) {
        toast.error('Error al crear mesa', {
          description: error.message,
        })
      } else {
        toast.error('Error de conexión', {
          description: 'No se pudo conectar con el servidor',
        })
      }
    } finally {
      setIsCreating(false)
    }
  }

  const handleVerQR = (mesa: typeof mesas[0]) => {
    setSelectedMesa(mesa)
    setVerQR(true)
  }

  const handleEliminarMesa = async () => {
    if (!token || !mesaAEliminar) {
      toast.error('No hay sesión activa o mesa seleccionada')
      return
    }

    setIsDeleting(true)

    try {
      await mesasApi.delete(token, mesaAEliminar.id)

      toast.success('Mesa eliminada', {
        description: 'La mesa se eliminó correctamente',
      })

      // Refrescar datos
      await fetchData()
      setEliminarMesaDialog(false)
      setMesaAEliminar(null)
      setSelectedMesa(null)
    } catch (error) {
      console.error('Error al eliminar mesa:', error)
      if (error instanceof ApiError) {
        toast.error('Error al eliminar mesa', {
          description: error.message,
        })
      } else {
        toast.error('Error de conexión', {
          description: 'No se pudo conectar con el servidor',
        })
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const handleAbrirEliminarDialog = (mesa: typeof mesas[0]) => {
    setMesaAEliminar(mesa)
    setEliminarMesaDialog(true)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mesas</h1>
          <p className="text-muted-foreground">
            Gestiona y monitorea todas las mesas de tu restaurante
          </p>
        </div>
        <Button onClick={() => setCrearMesaDialog(true)} className="cursor-pointer">
          <Plus className="mr-2 h-4 w-4" />
          Nueva Mesa
        </Button>
      </div>

      {mesas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Table className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center mb-2">No hay mesas registradas</p>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Crea tu primera mesa para comenzar a recibir pedidos
            </p>
            <Button onClick={() => setCrearMesaDialog(true)} className="cursor-pointer">
              <Plus className="mr-2 h-4 w-4" />
              Crear Primera Mesa
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {mesas.map((mesa) => (
            <Card 
              key={mesa.id}
              className="transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-pointer"
              onClick={() => setSelectedMesa(mesa)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">{mesa.nombre}</CardTitle>
                  <Badge variant="secondary">Disponible</Badge>
                </div>
                <CardDescription className="truncate">
                  Token: {mesa.qrToken}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center">
                      <QrCode className="mr-2 h-4 w-4" />
                      QR Token
                    </span>
                    <span className="font-mono text-xs truncate max-w-[120px]">
                      {mesa.qrToken.substring(0, 8)}...
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center">
                      <Clock className="mr-2 h-4 w-4" />
                      Creada
                    </span>
                    <span className="text-xs">
                      {new Date(mesa.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleVerQR(mesa)
                    }}
                    className="cursor-pointer"
                  >
                    <QrCode className="mr-2 h-4 w-4" />
                    Ver QR
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedMesa(mesa)
                    }}
                    className="cursor-pointer"
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Detalles
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de Detalles */}
      {selectedMesa && !verQR && (
        <Dialog open={!!selectedMesa && !verQR} onOpenChange={() => setSelectedMesa(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedMesa.nombre} - Detalles
                {isConnected ? (
                  <Badge variant="default" className="gap-1">
                    <Wifi className="h-3 w-3" />
                    Conectado
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <WifiOff className="h-3 w-3" />
                    Desconectado
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                Información y estado en tiempo real de la mesa
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Información Básica</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nombre:</span>
                    <span className="font-medium">{selectedMesa.nombre}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">QR Token:</span>
                    <span className="font-mono text-xs">{selectedMesa.qrToken}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Creada:</span>
                    <span className="text-sm">
                      {new Date(selectedMesa.createdAt).toLocaleString('es-ES')}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {mesaState && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Estado en Tiempo Real</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Clientes conectados:</span>
                      <span className="font-medium">{mesaState.clientes.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Items en pedido:</span>
                      <span className="font-medium">{mesaState.items.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total:</span>
                      <span className="font-bold text-lg">${parseFloat(mesaState.total).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Estado:</span>
                      <Badge variant={
                        mesaState.estado === 'pending' ? 'secondary' :
                        mesaState.estado === 'preparing' ? 'default' :
                        mesaState.estado === 'delivered' ? 'outline' : 'secondary'
                      }>
                        {mesaState.estado === 'pending' ? 'Pendiente' :
                         mesaState.estado === 'preparing' ? 'Preparando' :
                         mesaState.estado === 'delivered' ? 'Entregado' : 'Cerrado'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1 cursor-pointer"
                  onClick={() => {
                    setVerQR(true)
                  }}
                >
                  <QrCode className="mr-2 h-4 w-4" />
                  Ver QR Code
                </Button>
                <Button 
                  variant="destructive" 
                  className="flex-1 cursor-pointer"
                  onClick={() => handleAbrirEliminarDialog(selectedMesa)}
                >
                  Eliminar Mesa
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog de QR Code */}
      {verQR && selectedMesa && (
        <Dialog open={verQR} onOpenChange={(open) => {
          setVerQR(open)
          if (!open) setSelectedMesa(null)
        }}>
          <DialogContent className="max-w-md">
            <MesaQRCode 
              qrToken={selectedMesa.qrToken}
              mesaNombre={selectedMesa.nombre}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog de Confirmación de Eliminación */}
      <Dialog open={eliminarMesaDialog} onOpenChange={setEliminarMesaDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>¿Eliminar Mesa?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Se eliminará la mesa "{mesaAEliminar?.nombre}" y todos los pedidos cerrados asociados.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEliminarMesaDialog(false)
                setMesaAEliminar(null)
              }}
              disabled={isDeleting}
              className="cursor-pointer"
            >
              Cancelar
            </Button>
            <Button 
              type="button" 
              variant="destructive" 
              onClick={handleEliminarMesa}
              disabled={isDeleting}
              className="cursor-pointer"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Eliminar'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Crear Mesa */}
      <Dialog open={crearMesaDialog} onOpenChange={setCrearMesaDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Crear Nueva Mesa</DialogTitle>
            <DialogDescription>
              Agrega una nueva mesa a tu restaurante
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCrearMesa} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombreMesa">Nombre de la mesa *</Label>
              <Input
                id="nombreMesa"
                value={nombreMesa}
                onChange={(e) => setNombreMesa(e.target.value)}
                placeholder="Ej: Mesa 1, Mesa VIP, etc."
                required
                disabled={isCreating}
                minLength={3}
              />
              <p className="text-xs text-muted-foreground">
                Este nombre será visible para los clientes
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCrearMesaDialog(false)}
                disabled={isCreating}
                className="cursor-pointer"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isCreating} className="cursor-pointer">
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Crear Mesa
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  )
}

export default Mesas

