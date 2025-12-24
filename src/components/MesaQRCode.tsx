import { useRef } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Download, Copy, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

interface MesaQRCodeProps {
  qrToken: string
  mesaNombre: string
}

const MesaQRCode = ({ qrToken, mesaNombre }: MesaQRCodeProps) => {
  const qrRef = useRef<HTMLDivElement>(null)
  const mesaUrl = `https://my.piru.app/mesa/${qrToken}`

  const handleCopyLink = () => {
    navigator.clipboard.writeText(mesaUrl)
    toast.success('Link copiado', {
      description: 'El enlace se copió al portapapeles',
    })
  }

  const handleDownloadQR = () => {
    const canvas = qrRef.current?.querySelector('canvas')
    if (!canvas) return

    // Crear un canvas más grande con padding y texto
    const finalCanvas = document.createElement('canvas')
    const ctx = finalCanvas.getContext('2d')
    if (!ctx) return

    const padding = 40
    const textHeight = 60
    finalCanvas.width = canvas.width + padding * 2
    finalCanvas.height = canvas.height + padding * 2 + textHeight

    // Fondo blanco
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height)

    // Dibujar QR
    ctx.drawImage(canvas, padding, padding)

    // Agregar texto
    ctx.fillStyle = '#000000'
    ctx.font = 'bold 24px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(mesaNombre, finalCanvas.width / 2, canvas.height + padding + 35)

    // Descargar
    finalCanvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = `qr-${mesaNombre.toLowerCase().replace(/\s+/g, '-')}.png`
      link.href = url
      link.click()
      URL.revokeObjectURL(url)
      toast.success('QR descargado', {
        description: 'El código QR se descargó correctamente',
      })
    })
  }

  const handleOpenLink = () => {
    window.open(mesaUrl, '_blank')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Código QR - {mesaNombre}</CardTitle>
        <CardDescription>
          Escanea este código para acceder a la mesa
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* QR Code */}
        <div ref={qrRef} className="flex justify-center p-6 bg-white rounded-lg">
          <QRCodeCanvas
            value={mesaUrl}
            size={256}
            level="H"
            includeMargin={true}
          />
        </div>

        {/* URL */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Enlace directo:</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={mesaUrl}
              readOnly
              className="flex-1 px-3 py-2 text-sm border rounded-md bg-muted font-mono"
            />
            <Button
              size="icon"
              variant="outline"
              onClick={handleCopyLink}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={handleDownloadQR}
            className="w-full"
          >
            <Download className="mr-2 h-4 w-4" />
            Descargar QR
          </Button>
          <Button
            variant="outline"
            onClick={handleOpenLink}
            className="w-full"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Abrir Link
          </Button>
        </div>

        {/* Info */}
        <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t">
          <p>• Los clientes pueden escanear este QR con su celular</p>
          <p>• Serán redirigidos a la página de pedidos de esta mesa</p>
          <p>• Pueden agregar productos y ver el pedido en tiempo real</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default MesaQRCode

