import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import ImageUpload from '@/components/ImageUpload'
import { Loader2, Plus, Trash2, X, Check } from 'lucide-react'
import type { OpcionCarta, ProductoCarta } from '../carta'

function Campo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return <label className="block text-sm font-medium space-y-1.5"><span>{titulo}</span>{children}</label>
}

function Opciones({ titulo, frase, opciones, onFrase, onChange, secundarias }: {
  titulo: string; frase: string; opciones: OpcionCarta[]; onFrase: (s: string) => void; onChange: (v: OpcionCarta[]) => void; secundarias?: boolean
}) {
  return <details open={opciones.length > 0} className="border-t border-border pt-4">
    <summary className="cursor-pointer font-medium text-sm">{titulo} <span className="text-muted-foreground font-normal">({opciones.length})</span></summary>
    <div className="mt-3 space-y-3">
      <Campo titulo={`Frase de ${titulo.toLowerCase()}`}><Input maxLength={120} value={frase} onChange={e => onFrase(e.target.value)} /></Campo>
      {secundarias && <p className="text-xs text-muted-foreground">El precio de la segunda elección se suma a la primera.</p>}
      {opciones.map((v, i) => <div key={i} className="flex items-end gap-2">
        <div className="min-w-0 flex-1"><Campo titulo="Opción"><Input maxLength={255} aria-label={`${titulo}: nombre ${i + 1}`} value={v.nombre} onChange={e => onChange(opciones.map((o, k) => k === i ? { ...o, nombre: e.target.value } : o))} /></Campo></div>
        <div className="w-24 shrink-0"><Campo titulo="Precio $"><Input aria-label={`${titulo}: precio ${i + 1}`} type="number" min="0" step="any" value={v.precio} onChange={e => onChange(opciones.map((o, k) => k === i ? { ...o, precio: Number(e.target.value) } : o))} /></Campo></div>
        <Button type="button" variant="ghost" size="icon" aria-label={`Quitar ${titulo.toLowerCase()} ${i + 1}`} onClick={() => onChange(opciones.filter((_, k) => k !== i))}><X className="h-4 w-4" /></Button>
      </div>)}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...opciones, { nombre: '', precio: 0 }])}><Plus className="h-4 w-4 mr-1" />Agregar opción</Button>
    </div>
  </details>
}

export function ProductoEditor({ p, onChange, onSave, onRemove, saving, disabled, sucursales }: {
  p: ProductoCarta; onChange: (p: Partial<ProductoCarta>) => void; onSave: () => void; onRemove: () => void
  saving: boolean; disabled: boolean; sucursales: { id: number; nombre: string }[]
}) {
  const [ingrediente, setIngrediente] = useState('')
  const agregarIngrediente = () => {
    if (ingrediente.trim()) onChange({ ingredientes: [...new Set([...p.ingredientes ?? [], ingrediente.trim()])] })
    setIngrediente('')
  }
  return <article data-testid="producto-editor" className="rounded-2xl border border-border bg-background p-4 sm:p-5">
    <fieldset disabled={saving || disabled} className="space-y-5 min-w-0">
      <div className="grid grid-cols-1 sm:grid-cols-[128px_1fr] gap-4">
        <div className="max-w-40 sm:max-w-none"><p className="text-sm font-medium mb-1.5">Imagen del producto</p><ImageUpload square compact currentImage={p.eliminarImagen ? null : p.image || p.imagenUrl} onImageChange={image => onChange({ image, eliminarImagen: image === null })} /></div>
        <div className="space-y-3 min-w-0">
          <Campo titulo="Nombre"><Input maxLength={255} value={p.nombre} onChange={e => onChange({ nombre: e.target.value })} /></Campo>
          <Campo titulo="Precio base $"><Input type="number" min="0" step="any" placeholder="Mínimo de las variantes" value={p.precio ?? ''} onChange={e => onChange({ precio: e.target.value === '' ? null : Number(e.target.value) })} /></Campo>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.activo !== false} onChange={e => onChange({ activo: e.target.checked })} />Disponible en la tienda</label>
        </div>
      </div>
      <Campo titulo="Descripción"><textarea maxLength={255} value={p.descripcion ?? ''} onChange={e => onChange({ descripcion: e.target.value })} rows={2} className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm" /></Campo>
      <div className="grid sm:grid-cols-2 gap-3 items-end">
        <Campo titulo="Categoría"><Input maxLength={255} value={p.categoria ?? ''} onChange={e => onChange({ categoria: e.target.value })} /></Campo>
        <label className="flex items-center gap-2 text-sm min-h-9"><input type="checkbox" checked={p.esBebida ?? false} onChange={e => onChange({ esBebida: e.target.checked })} />Es una categoría de bebidas</label>
      </div>
      <Opciones titulo="Variantes principales" frase={p.tituloVariantesPrimarias ?? 'Elegí una opción'} opciones={p.variantes ?? []} onFrase={s => onChange({ tituloVariantesPrimarias: s })} onChange={v => onChange({ variantes: v })} />
      <Opciones titulo="Segunda elección" secundarias frase={p.tituloVariantesSecundarias ?? 'Elegí también una segunda opción'} opciones={p.variantesSecundarias ?? []} onFrase={s => onChange({ tituloVariantesSecundarias: s })} onChange={v => onChange({ variantesSecundarias: v })} />
      <Opciones titulo="Extras principales" frase={p.tituloExtrasPrimarios ?? 'Extras'} opciones={p.extras ?? []} onFrase={s => onChange({ tituloExtrasPrimarios: s })} onChange={v => onChange({ extras: v })} />
      <Opciones titulo="Segundo grupo de extras" frase={p.tituloExtrasSecundarios ?? 'Extras'} opciones={p.extrasSecundarios ?? []} onFrase={s => onChange({ tituloExtrasSecundarios: s })} onChange={v => onChange({ extrasSecundarios: v })} />
      <details open={(p.ingredientes?.length ?? 0) > 0} className="border-t border-border pt-4">
        <summary className="text-sm font-medium cursor-pointer">Ingredientes que el cliente puede quitar</summary>
        <div className="mt-3 flex flex-wrap gap-2">
          {p.ingredientes?.map((ing, i) => <button key={i} type="button" onClick={() => onChange({ ingredientes: p.ingredientes!.filter((_, k) => k !== i) })} className="text-sm rounded-full bg-muted px-3 py-1 flex items-center gap-2" aria-label={`Quitar ${ing}`}>{ing}<X className="w-3 h-3" /></button>)}
        </div>
        <div className="flex gap-2 mt-3"><Input aria-label="Nuevo ingrediente" placeholder="Ingrediente" value={ingrediente} onChange={e => setIngrediente(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregarIngrediente() } }} /><Button type="button" variant="outline" onClick={agregarIngrediente}>Agregar</Button></div>
      </details>
      <details className="border-t border-border pt-4">
        <summary className="text-sm font-medium cursor-pointer">Notas, descuentos, puntos y etiquetas</summary>
        <div className="space-y-4 mt-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.permiteNota ?? false} onChange={e => onChange({ permiteNota: e.target.checked })} />Permitir aclaraciones del cliente</label>
          {p.permiteNota && <Campo titulo="Frase para las aclaraciones"><Input maxLength={120} value={p.tituloNota ?? '¿Querés aclarar algo?'} onChange={e => onChange({ tituloNota: e.target.value })} /></Campo>}
          <Campo titulo="Descuento %"><Input type="number" min="0" max="100" step="1" value={p.descuento ?? 0} onChange={e => onChange({ descuento: Number(e.target.value) })} /></Campo>
          <div className="grid sm:grid-cols-2 gap-3">
            <Campo titulo="Descuento desde"><Input type="datetime-local" value={p.descuentoFechaInicio ?? ''} onChange={e => onChange({ descuentoFechaInicio: e.target.value })} /></Campo>
            <Campo titulo="Descuento hasta"><Input type="datetime-local" value={p.descuentoFechaFin ?? ''} onChange={e => onChange({ descuentoFechaFin: e.target.value })} /></Campo>
            <Campo titulo="Puntos que gana"><Input type="number" min="0" step="1" value={p.puntosGanados ?? 0} onChange={e => onChange({ puntosGanados: Number(e.target.value) })} /></Campo>
            <Campo titulo="Puntos para canjear"><Input type="number" min="0" step="1" value={p.puntosNecesarios ?? 0} onChange={e => onChange({ puntosNecesarios: Number(e.target.value) })} /></Campo>
          </div>
          <Campo titulo="Etiquetas (separadas por coma)"><Input value={p.etiquetas?.join(',') ?? ''} onChange={e => onChange({ etiquetas: e.target.value.split(',') })} onBlur={() => onChange({ etiquetas: p.etiquetas?.map(s => s.trim()).filter(Boolean) })} /></Campo>
          {sucursales.length > 0 && <Campo titulo="Evento / sucursal sólo POS"><select value={p.eventoSucursalId ?? ''} onChange={e => onChange({ eventoSucursalId: e.target.value ? Number(e.target.value) : null })} className="w-full h-10 border border-input rounded-lg px-3 bg-background"><option value="">Carta general</option>{sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></Campo>}
        </div>
      </details>
      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="text-muted-foreground hover:text-red-500"><Trash2 className="h-4 w-4 mr-1" />Eliminar</Button>
        <Button type="button" onClick={onSave} disabled={p.guardado || saving || disabled} className="bg-[#FF7A00] hover:bg-[#E66E00] text-white">
          {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Guardando…</> : p.guardado ? <><Check className="h-4 w-4 mr-2" />Guardado</> : 'Guardar producto'}
        </Button>
      </div>
    </fieldset>
  </article>
}
