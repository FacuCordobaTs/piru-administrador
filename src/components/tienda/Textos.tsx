import { useId, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { conNombre, type Historia } from '@/lib/tiendaPresets'
import { OpcionTexto } from './Opciones'

/** Un texto con propuestas para elegir y el campo para retocarlo o escribirlo de cero. */
export function ElegirTexto({ etiqueta, propuestas, opciones, valor, onCambiar, max, largo = false, placeholder }: {
  etiqueta: string; propuestas: string; opciones: string[]; valor?: string; onCambiar: (v: string | undefined) => void; max: number; largo?: boolean; placeholder?: string
}) {
  const id = useId()
  const propias = valor && !opciones.includes(valor)
  return <div className="space-y-2.5">
    <div role="radiogroup" aria-label={propuestas} className={largo ? 'grid gap-2' : 'flex flex-wrap gap-2'}>
      {opciones.map(o => largo
        ? <OpcionTexto key={o} nombre={`${id}-op`} texto={o} elegida={valor === o} onElegir={() => onCambiar(o)} />
        : <label key={o} className={`cursor-pointer rounded-full border px-3.5 py-2 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${valor === o ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted/60'}`}>
          <input type="radio" name={`${id}-op`} checked={valor === o} onChange={() => onCambiar(o)} className="sr-only" />{o}
        </label>)}
    </div>
    <label htmlFor={`${id}-campo`} className="block text-xs font-medium text-muted-foreground">{etiqueta}{propias ? ' · escrita por vos' : ''}</label>
    {largo
      ? <Textarea id={`${id}-campo`} rows={3} maxLength={max} value={valor ?? ''} placeholder={placeholder ?? 'O escribí la tuya'} onChange={e => onCambiar(e.target.value || undefined)} />
      : <Input id={`${id}-campo`} maxLength={max} value={valor ?? ''} placeholder={placeholder ?? 'O escribí la tuya'} onChange={e => onCambiar(e.target.value || undefined)} />}
  </div>
}

/** Las frases de la cinta: se prenden y apagan tocándolas; también se pueden sumar propias. */
export function ElegirCinta({ opciones, valor = [], onCambiar }: { opciones: string[]; valor?: string[]; onCambiar: (v: string[] | undefined) => void }) {
  const id = useId()
  const [nueva, setNueva] = useState('')
  const todas = [...new Set([...opciones, ...valor])]
  const alternar = (f: string) => {
    const lista = valor.includes(f) ? valor.filter(v => v !== f) : [...valor, f].slice(0, 10)
    onCambiar(lista.length ? lista : undefined)
  }
  const agregar = () => {
    const f = nueva.trim().slice(0, 40)
    if (!f) return
    if (!valor.includes(f)) onCambiar([...valor, f].slice(0, 10))
    setNueva('')
  }
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2">
      {todas.map(f => {
        const activa = valor.includes(f)
        return <button key={f} type="button" aria-pressed={activa} onClick={() => alternar(f)} disabled={!activa && valor.length >= 10}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition-colors disabled:opacity-40 ${activa ? 'border-primary bg-primary text-primary-foreground' : 'border-dashed border-border hover:bg-muted/60'}`}>
          {activa ? <X className="size-3.5" /> : <Plus className="size-3.5" />}{f}
        </button>
      })}
    </div>
    <div className="flex gap-2">
      <label htmlFor={`${id}-nueva`} className="sr-only">Agregar una frase a la cinta</label>
      <Input id={`${id}-nueva`} value={nueva} maxLength={40} placeholder="Sumá una frase tuya" onChange={e => setNueva(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregar() } }} />
      <Button type="button" variant="outline" disabled={!nueva.trim() || valor.length >= 10} onClick={agregar}>Agregar</Button>
    </div>
    <p className="text-xs text-muted-foreground">{valor.length}/10 elegidas. La plantilla Moderna las hace correr debajo de la portada.</p>
  </div>
}

/** La historia: se elige una de las propuestas y queda lista para retocar. */
export function ElegirHistoria({ opciones, nombre, valor, onCambiar }: {
  opciones: Historia[]; nombre?: string; valor?: { titulo?: string; texto?: string }; onCambiar: (v: { titulo?: string; texto?: string }) => void
}) {
  const id = useId()
  return <div className="space-y-3">
    <div role="radiogroup" aria-label="Propuestas de historia" className="grid gap-2 sm:grid-cols-2">
      {opciones.map(h => {
        const texto = conNombre(h.texto, nombre)
        const elegida = valor?.titulo === h.titulo && valor?.texto === texto
        return <label key={h.titulo} className={`cursor-pointer rounded-xl border p-3.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${elegida ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
          <input type="radio" name={`${id}-historia`} checked={elegida} onChange={() => onCambiar({ titulo: h.titulo, texto })} className="sr-only" />
          <span className="block text-sm font-semibold">{h.titulo}</span>
          <span className="mt-1 line-clamp-3 block text-xs leading-relaxed text-muted-foreground">{texto}</span>
        </label>
      })}
    </div>
    <div className="space-y-2">
      <label htmlFor={`${id}-titulo`} className="text-xs font-medium text-muted-foreground">Título de la historia</label>
      <Input id={`${id}-titulo`} maxLength={80} value={valor?.titulo ?? ''} onChange={e => onCambiar({ ...valor, titulo: e.target.value || undefined })} />
    </div>
    <div className="space-y-2">
      <label htmlFor={`${id}-texto`} className="text-xs font-medium text-muted-foreground">Historia de tu local</label>
      <Textarea id={`${id}-texto`} rows={5} maxLength={1200} value={valor?.texto ?? ''} onChange={e => onCambiar({ ...valor, texto: e.target.value || undefined })} />
    </div>
  </div>
}
