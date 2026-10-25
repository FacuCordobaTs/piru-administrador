import { useId, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import ImageUpload from '@/components/ImageUpload'
import type { TiendaConfig } from '@/lib/tiendaConfig'

const PLANTILLAS = [
  { id: 'artesanal', nombre: 'Artesanal', detalle: 'Crema y terracota, títulos con personalidad y fichas de mostrador.', fondo: '#fcf7ef', tinta: '#713d29', fuente: 'Georgia, serif' },
  { id: 'moderna', nombre: 'Moderna', detalle: 'Neutros fríos, logo protagonista y tarjetas con foto.', fondo: '#f5f7fa', tinta: '#21354a', fuente: 'sans-serif' },
  { id: 'elegante', nombre: 'Elegante', detalle: 'Papel claro, carta editorial y detalles enmarcados.', fondo: '#f7f5ef', tinta: '#24201d', fuente: 'sans-serif' },
] as const

export type ProductoDestacable = {
  id: number; nombre: string; activo?: boolean | null; soloCanjePuntos?: boolean; eventoSucursalId?: number | null
}

/** El mismo formulario en el alta y en Ajustes. No agrega defaults a la configuración. */
export function TiendaPersonalizacion({ value, onChange, productos = [], disabled = false }: {
  value: TiendaConfig; onChange: (v: TiendaConfig) => void; productos?: ProductoDestacable[]; disabled?: boolean
}) {
  const id = useId()
  const [fotoUrl, setFotoUrl] = useState('')
  const patch = (p: Partial<TiendaConfig>) => onChange({ ...value, ...p })
  const galeria = value.galeria ?? []
  const campo = (clave: string, label: string, valor: string | undefined, cambiar: (s: string | undefined) => void, max: number, multiline = false, placeholder?: string) => {
    const props = { id: `${id}-${clave}`, value: valor ?? '', maxLength: max, placeholder, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => cambiar(e.target.value || undefined) }
    return <div className="space-y-2">
      <label htmlFor={props.id} className="text-sm font-medium">{label}</label>
      {multiline ? <Textarea {...props} rows={4} /> : <Input {...props} />}
    </div>
  }
  const mover = (indice: number, paso: number) => {
    const fotos = [...galeria]
    ;[fotos[indice], fotos[indice + paso]] = [fotos[indice + paso], fotos[indice]]
    patch({ galeria: fotos })
  }
  return <fieldset disabled={disabled} className="min-w-0 space-y-7 disabled:opacity-60">
    <div className="space-y-3">
      <h3 className="text-base font-medium">Diseño de tu tienda</h3>
      <p className="text-sm text-muted-foreground">Todo es opcional. Sin personalización se usa Artesanal con los colores de tu local. Podés cambiar el diseño conservando el contenido.</p>
      <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Plantilla de la tienda">
        {PLANTILLAS.map(p => <label key={p.id} className={`min-w-0 cursor-pointer rounded-xl border p-3 ${value.plantilla === p.id ? 'border-primary ring-1 ring-primary' : 'border-border'}`}>
          <div aria-hidden className="mb-3 rounded-lg border p-3" style={{ background: p.fondo, color: p.tinta, fontFamily: p.fuente }}>
            <span className="block text-lg font-bold">Tu local</span><span className="mt-3 block border-t border-current pt-2 text-xs">La carta</span>
          </div>
          <span className="flex items-center gap-2 text-sm font-medium"><input type="radio" name={`${id}-plantilla`} aria-label={p.nombre} aria-describedby={`${id}-${p.id}-detalle`} value={p.id} checked={value.plantilla === p.id} onChange={() => patch({ plantilla: p.id })} />{p.nombre}</span>
          <span id={`${id}-${p.id}-detalle`} className="mt-2 block text-xs text-muted-foreground">{p.detalle}</span>
        </label>)}
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="radio" name={`${id}-plantilla`} checked={!value.plantilla} onChange={() => patch({ plantilla: undefined })} />Sin elegir · Artesanal por defecto</label>
    </div>

    <SelectorProductoDestacado productos={productos} value={value.productoDestacadoId} onChange={productoDestacadoId => patch({ productoDestacadoId })} />

    <div className="space-y-4 border-t pt-5">
      <h3 className="text-base font-medium">Presentación</h3>
      {campo('frase', 'Frase de tu local', value.frase, frase => patch({ frase }), 90, false, 'El placer de comer bien.')}
      {campo('bajada', 'Descripción breve', value.bajada, bajada => patch({ bajada }), 220, true)}
      {campo('cinta', 'Frases de la cinta (una por línea, hasta 10)', value.cinta?.join('\n'), s => patch({ cinta: s?.split('\n').slice(0, 10).map(v => v.slice(0, 40)) }), 409, true, 'Hecho en casa\nIngredientes de estación')}
    </div>

    <div className="space-y-4 border-t pt-5">
      <h3 className="text-base font-medium">Fotos del local</h3>
      <p className="text-sm text-muted-foreground">Portada y hasta 8 fotos en la galería. JPG, PNG o WebP, hasta 5 MB por foto. Las secciones vacías se omiten.</p>
      <div role="group" aria-label="Foto de portada" className="space-y-2">
        <p className="text-sm font-medium">Portada</p>
        <ImageUpload compact currentImage={value.portadaUrl} onImageChange={v => patch({ portadaUrl: v ?? undefined })} />
        {campo('portada', 'Enlace de la portada', value.portadaUrl?.startsWith('data:') ? undefined : value.portadaUrl, portadaUrl => patch({ portadaUrl }), 2048, false, 'https://… o /fotos/portada.jpg')}
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

    <div className="space-y-4 border-t pt-5">
      <h3 className="text-base font-medium">Historia y contacto</h3>
      {campo('historia-titulo', 'Título de la historia', value.historia?.titulo, titulo => patch({ historia: { ...value.historia, titulo } }), 80)}
      {campo('historia-texto', 'Historia de tu local', value.historia?.texto, texto => patch({ historia: { ...value.historia, texto } }), 1200, true)}
      {campo('instagram', 'Instagram', value.instagram, instagram => patch({ instagram }), 60, false, '@tulocal')}
      {campo('whatsapp', 'WhatsApp de contacto de la tienda', value.whatsapp, whatsapp => patch({ whatsapp }), 30, false, '5491112345678')}
      <p className="text-xs text-muted-foreground">Este contacto se muestra al pie de la tienda. El número que recibe los pedidos se configura por separado.</p>
    </div>

    <details className="rounded-xl border p-4">
      <summary className="cursor-pointer text-sm font-medium">Paleta y tipografías personalizadas (opcional)</summary>
      <div className="mt-5 space-y-5">
        <p className="text-sm text-muted-foreground">Dejá estos campos vacíos para usar la paleta y las fuentes del diseño. Los colores habituales de tu marca no necesitan una paleta personalizada.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {(['fondo', 'superficie', 'texto', 'acento'] as const).map(key => <div key={key}>
            {campo(`color-${key}`, `Color de ${key}`, value.colores?.[key], v => patch({ colores: { ...value.colores, [key]: v } }), 7, false, '#ffffff')}
          </div>)}
        </div>
        {campo('fuente-titulos', 'Fuente de los títulos', value.fuentes?.titulos, titulos => patch({ fuentes: { ...value.fuentes, titulos } }), 60, false, 'DM Sans')}
        {campo('fuente-cuerpo', 'Fuente del cuerpo', value.fuentes?.cuerpo, cuerpo => patch({ fuentes: { ...value.fuentes, cuerpo } }), 60, false, 'DM Sans')}
        {campo('fuente-css', 'Enlace a la hoja de fuentes', value.fuentes?.cssUrl, cssUrl => patch({ fuentes: { ...value.fuentes, cssUrl } }), 2048, false, 'https://fonts.googleapis.com/css2?…')}
        <p className="text-xs text-muted-foreground">Sin enlace, la tienda busca las familias elegidas en Google Fonts.</p>
        <div className="space-y-2">
          <label htmlFor={`${id}-peso`} className="text-sm font-medium">Peso de los títulos</label>
          <Input id={`${id}-peso`} type="number" min={100} max={900} step={1} placeholder="El del diseño" value={value.fuentes?.pesoTitulos ?? ''} onChange={e => patch({ fuentes: { ...value.fuentes, pesoTitulos: e.target.value ? Number(e.target.value) : undefined } })} />
        </div>
      </div>
    </details>
    <Button type="button" variant="ghost" className="h-auto min-h-11 max-w-full whitespace-normal text-left" onClick={() => onChange({})}>Quitar personalización y usar el diseño predeterminado</Button>
  </fieldset>
}


/** Se reutiliza al revisar la carta, cuando los productos nuevos ya tienen su ID. */
export function SelectorProductoDestacado({ productos, value, onChange, disabled = false }: {
  productos: ProductoDestacable[]; value?: number; onChange: (id: number | undefined) => void; disabled?: boolean
}) {
  const id = useId()
  const elegibles = productos.filter(p => p.activo !== false && !p.soloCanjePuntos && !p.eventoSucursalId)
  return <div className="space-y-2 border-t pt-5">
      <label htmlFor={`${id}-destacado`} className="text-sm font-medium">Producto destacado</label>
      <select id={`${id}-destacado`} disabled={disabled} value={value ?? ''} onChange={e => onChange(e.target.value ? Number(e.target.value) : undefined)} className="h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm">
        <option value="">Sin producto destacado</option>
        {value && !elegibles.some(p => p.id === value) && <option value={value}>Producto elegido ya no disponible</option>}
        {elegibles.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
      </select>
      <p className="text-xs text-muted-foreground">Se muestra en la portada de tu tienda. Si no elegís uno, no aparece ningún destacado.</p>
      {!elegibles.length && <p className="text-xs text-muted-foreground">Cuando tengas productos activos guardados en tu carta, vas a poder elegirlos acá.</p>}
    </div>
}
