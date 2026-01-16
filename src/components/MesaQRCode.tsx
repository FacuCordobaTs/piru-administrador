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

  const handleDownloadQR = async () => {
    const qrCanvas = qrRef.current?.querySelector('canvas')
    if (!qrCanvas) return
  
    const template = new Image()
    template.src = '/qr-template.png'
  
    template.onload = () => {
      const W = template.width
      const H = template.height
  
      const out = document.createElement('canvas')
      const ctx = out.getContext('2d')
      if (!ctx) return
  
      out.width = W
      out.height = H
  
      // 1️⃣ Dibujar plantilla
      ctx.drawImage(template, 0, 0, W, H)
  
      // 2️⃣ Dibujar QR encima
      const qrSize = 1000
      const qrX = (W - qrSize) / 2
      const qrY = 820
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize)
  
      // 3️⃣ Nombre de mesa
      ctx.fillStyle = '#8A8A8A'
      ctx.font = '14px system-ui, sans-serif'
      ctx.textAlign = 'center'
  
      // 4️⃣ Descargar
      out.toBlob(blob => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `qr-${mesaNombre.toLowerCase().replace(/\s+/g, '-')}.png`
        a.click()
        URL.revokeObjectURL(url)
  
        toast.success('QR descargado')
      })
    }
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
        {/* QR Code visible (UI) */}
        <div className="flex justify-center p-6 bg-white rounded-lg">
          <QRCodeCanvas
            value={mesaUrl}
            size={220}
            level="H"
            includeMargin={true}
          />
        </div>

        {/* QR Code oculto (solo para descarga en alta resolución) */}
        <div
          ref={qrRef}
          style={{
            position: 'absolute',
            left: '-9999px',
            top: '-9999px',
          }}
        >
          <QRCodeCanvas
            value={mesaUrl}
            size={1000}
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

