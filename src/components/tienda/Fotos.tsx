import { useId, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import ImageUpload from '@/components/ImageUpload'
import type { TiendaConfig } from '@/lib/tiendaConfig'

/** Portada y galería: lo único del editor que no se elige de una lista, porque son las fotos del local. */
export function FotosTienda({ value, patch }: { value: TiendaConfig; patch: (p: Partial<TiendaConfig>) => void }) {
  const id = useId()
  const [fotoUrl, setFotoUrl] = useState('')
  const galeria = value.galeria ?? []
  const mover = (indice: number, paso: number) => {
    const fotos = [...galeria]
    ;[fotos[indice], fotos[indice + paso]] = [fotos[indice + paso], fotos[indice]]
    patch({ galeria: fotos })
  }
  return <div className="space-y-5">
    <div role="group" aria-label="Foto de portada" className="space-y-2">
      <p className="text-sm font-medium">Portada</p>
      <ImageUpload compact currentImage={value.portadaUrl} onImageChange={v => patch({ portadaUrl: v ?? undefined })} />
      <label htmlFor={`${id}-portada`} className="block text-xs text-muted-foreground">Enlace de la portada</label>
      <Input id={`${id}-portada`} value={value.portadaUrl?.startsWith('data:') ? '' : value.portadaUrl ?? ''} maxLength={2048} placeholder="https://… o /fotos/portada.jpg" onChange={e => patch({ portadaUrl: e.target.value || undefined })} />
    </div>
    <h4 className="text-sm font-medium">Galería · {galeria.length}/8 fotos</h4>
    <div className="grid gap-4 sm:grid-cols-2">
      {galeria.map((foto, i) => <div key={i} role="group" aria-label={`Foto de galería ${i + 1}`} className="space-y-2 rounded-xl border p-3">
        <p className="text-sm font-medium">Foto {i + 1}</p>
        <ImageUpload compact currentImage={foto} onImageChange={v => patch({ galeria: v ? galeria.map((u, j) => j === i ? v : u) : galeria.filter((_, j) => j !== i) })} />
        <div className="flex gap-1">
          <Button type="button" size="icon" variant="outline" disabled={i === 0} aria-label={`Subir foto ${i + 1}`} onClick={() => mover(i, -1)}><ArrowUp className="size-4" /></Button>
          <Button type="button" size="icon" variant="outline" disabled={i === galeria.length - 1} aria-label={`Bajar foto ${i + 1}`} onClick={() => mover(i, 1)}><ArrowDown className="size-4" /></Button>
          <Button type="button" size="icon" variant="ghost" aria-label={`Quitar foto ${i + 1}`} onClick={() => patch({ galeria: galeria.filter((_, j) => j !== i) })}><Trash2 className="size-4" /></Button>
        </div>
      </div>)}
    </div>
    {galeria.length < 8 && <div role="group" aria-label="Agregar foto a la galería" className="space-y-3">
      <ImageUpload key={`nueva-${galeria.length}`} compact currentImage={null} onImageChange={v => v && patch({ galeria: [...galeria, v] })} />
      <label htmlFor={`${id}-foto-url`} className="block text-sm font-medium">O agregá una foto por enlace</label>
      <div className="flex gap-2">
        <Input id={`${id}-foto-url`} value={fotoUrl} maxLength={2048} placeholder="https://… o /fotos/local.jpg" onChange={e => setFotoUrl(e.target.value)} />
        <Button type="button" variant="outline" disabled={!fotoUrl.trim()} onClick={() => {
          if (!/^(https:\/\/|\/(?!\/))/i.test(fotoUrl.trim())) { toast.error('Usá un enlace https:// o una ruta que empiece con /.'); return }
          patch({ galeria: [...galeria, fotoUrl.trim()] }); setFotoUrl('')
        }}><Plus className="size-4" /><span className="sr-only">Agregar foto por enlace</span></Button>
      </div>
    </div>}
  </div>
}
