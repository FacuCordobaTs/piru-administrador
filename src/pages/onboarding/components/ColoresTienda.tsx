import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

type Colores = { colorPrimario: string; colorSecundario: string; usarColorUnico: boolean }
export function ColoresTienda({ logo, colores, onChange }: { logo: string | null; colores: Colores; onChange: (v: Partial<Colores>) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [destino, setDestino] = useState<'colorPrimario' | 'colorSecundario'>('colorPrimario')
  useEffect(() => {
    if (!logo || !canvas.current) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    let vigente = true
    img.onload = () => {
      const node = canvas.current
      if (!node || !vigente) return
      const ratio = Math.min(1, 400 / Math.max(img.width, img.height))
      node.width = Math.round(img.width * ratio); node.height = Math.round(img.height * ratio)
      node.getContext('2d', { willReadFrequently: true })?.drawImage(img, 0, 0, node.width, node.height)
    }
    img.src = logo
    return () => { vigente = false }
  }, [logo])

  const tomarColor = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const node = e.currentTarget
    const bounds = node.getBoundingClientRect()
    try {
      const pixel = node.getContext('2d')!.getImageData(Math.min(node.width - 1, Math.floor((e.clientX - bounds.left) * node.width / bounds.width)), Math.min(node.height - 1, Math.floor((e.clientY - bounds.top) * node.height / bounds.height)), 1, 1).data
      if (pixel[3] === 0) { toast.error('Elegí una parte visible del logo'); return }
      const hex = `#${Array.from(pixel.slice(0, 3)).map(n => n.toString(16).padStart(2, '0')).join('').toUpperCase()}`
      onChange({ [destino]: hex })
      toast.success(`Color ${hex} seleccionado`)
    } catch { toast.error('No pudimos leer este logo. Podés subirlo de nuevo o escribir el color.') }
  }

  const campo = (key: 'colorPrimario' | 'colorSecundario', titulo: string) => <label className="block space-y-2 text-sm font-medium">
    {titulo}<div className="flex gap-3 items-center">
      <input aria-label={`Selector de ${titulo.toLowerCase()}`} type="color" value={/^#[0-9a-f]{6}$/i.test(colores[key]) ? colores[key] : '#FFFFFF'} onChange={e => onChange({ [key]: e.target.value.toUpperCase() })} className="h-11 w-12 rounded-lg cursor-pointer shrink-0" />
      <Input aria-label={`Hexadecimal de ${titulo.toLowerCase()}`} maxLength={7} value={colores[key]} onChange={e => onChange({ [key]: e.target.value.toUpperCase() })} className="font-mono" />
    </div>
  </label>
  return <div className="space-y-4">
    <h2 className="text-lg font-semibold">Colores de la tienda</h2>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={colores.usarColorUnico} onChange={e => { onChange({ usarColorUnico: e.target.checked }); if (e.target.checked) setDestino('colorPrimario') }} />Usar un solo color</label>
    <p className="text-xs text-muted-foreground">{colores.usarColorUnico ? 'Botones y detalles con tu color; cada diseño conserva sus fondos y textos.' : 'Elegí los colores de tu marca para botones, detalles y acentos.'}</p>
    {campo('colorPrimario', 'Color primario')}
    {!colores.usarColorUnico && campo('colorSecundario', 'Color secundario')}
    {logo && <div className="rounded-xl bg-muted/50 p-4 space-y-3">
      <p className="text-sm font-medium">Tomá un color del logo</p>
      {!colores.usarColorUnico && <select aria-label="Aplicar color del logo a" value={destino} onChange={e => setDestino(e.target.value as typeof destino)} className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"><option value="colorPrimario">Color primario</option><option value="colorSecundario">Color secundario</option></select>}
      <p className="text-xs text-muted-foreground">Tocá el punto del logo que querés usar. El hexadecimal se aplica arriba.</p>
      <canvas ref={canvas} onClick={tomarColor} aria-label="Logo para seleccionar color" className="block max-w-full max-h-56 w-auto mx-auto cursor-crosshair" />
    </div>}
  </div>
}
