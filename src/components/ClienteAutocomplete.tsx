import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/store/authStore'
import { cargarDirectorioPos, useDirectorioPos } from '@/lib/directorioClientesPos'
import { buscarClientes, type ClienteLocal } from '@/lib/posLocalDb'

/** Controlado: ambos campos cambian con un único callback al elegir un contacto. */
export function ClienteAutocomplete({ nombre, telefono, mostrarNombre, mostrarTelefono, onChange, compacto = false }: {
    nombre: string; telefono: string; mostrarNombre: boolean; mostrarTelefono: boolean; compacto?: boolean
    onChange: (datos: { nombreCliente: string; telefono: string }) => void
}) {
    const restauranteId = useAuthStore(s => s.restaurante?.id)
    const token = useAuthStore(s => s.token)
    const directorio = useDirectorioPos()
    const [campo, setCampo] = useState<'nombre' | 'telefono' | null>(null)
    const [activo, setActivo] = useState(-1)
    const root = useRef<HTMLDivElement>(null)
    const listId = useId()
    useEffect(() => {
        if (restauranteId == null || !token) return
        void cargarDirectorioPos(restauranteId)
    }, [restauranteId, token])
    useEffect(() => {
        const cerrar = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) { setCampo(null); setActivo(-1) } }
        document.addEventListener('pointerdown', cerrar)
        return () => document.removeEventListener('pointerdown', cerrar)
    }, [])
    const sugerencias = useMemo(() => campo && directorio.restauranteId === restauranteId && token
        ? buscarClientes(directorio.clientes, campo === 'nombre' ? nombre : telefono, campo) : [],
    [campo, directorio, restauranteId, token, nombre, telefono])
    const elegir = (c: ClienteLocal) => { onChange({ nombreCliente: c.nombre, telefono: c.telefono }); setCampo(null); setActivo(-1) }
    return <div ref={root} className="space-y-3" onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) { setCampo(null); setActivo(-1) }
    }}>
        {(['nombre', 'telefono'] as const).filter(c => c === 'nombre' ? mostrarNombre : mostrarTelefono).map(c => <div key={c} className="relative">
            <label htmlFor={`${listId}-${c}`} className="text-xs font-semibold text-muted-foreground">{c === 'nombre' ? 'Nombre' : 'Celular'}</label>
            <Input id={`${listId}-${c}`} value={c === 'nombre' ? nombre : telefono} autoComplete="off"
                role="combobox" aria-autocomplete="list" aria-expanded={campo === c && sugerencias.length > 0}
                aria-controls={campo === c && sugerencias.length ? listId : undefined}
                aria-activedescendant={campo === c && activo >= 0 && activo < sugerencias.length ? `${listId}-${sugerencias[activo].id}` : undefined}
                inputMode={c === 'telefono' ? 'tel' : 'text'} placeholder={c === 'nombre' ? 'Nombre del cliente' : 'Celular'}
                className={compacto ? 'h-11 border-0 border-b rounded-none bg-transparent dark:bg-transparent px-0' : 'h-11 rounded-xl bg-transparent dark:bg-transparent'}
                onFocus={() => { setCampo(c); setActivo(-1) }}
                onChange={event => {
                    setCampo(c); setActivo(-1)
                    onChange({ nombreCliente: c === 'nombre' ? event.target.value : nombre, telefono: c === 'telefono' ? event.target.value : telefono })
                }}
                onKeyDown={event => {
                    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setCampo(null); setActivo(-1) }
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                        event.preventDefault(); setCampo(c)
                        setActivo(prev => !sugerencias.length ? -1 : prev < 0
                            ? event.key === 'ArrowDown' ? 0 : sugerencias.length - 1
                            : (prev + (event.key === 'ArrowDown' ? 1 : -1) + sugerencias.length) % sugerencias.length)
                    }
                    if (event.key === 'Enter' && campo === c && sugerencias.length) {
                        event.preventDefault(); event.stopPropagation()
                        if (activo >= 0 && activo < sugerencias.length) elegir(sugerencias[activo])
                    }
                }} />
            {campo === c && sugerencias.length > 0 && <ul id={listId} role="listbox" aria-label="Clientes" className="absolute z-50 top-full mt-1 w-full max-h-64 overflow-auto rounded-xl border bg-popover text-popover-foreground shadow-lg">
                {sugerencias.map((cliente, i) => <li key={cliente.id} role="option" id={`${listId}-${cliente.id}`} aria-selected={activo === i}
                    className={`px-3 py-2 cursor-pointer ${activo === i ? 'bg-accent' : 'hover:bg-accent'}`}
                    onPointerDown={event => event.preventDefault()} onClick={event => { event.stopPropagation(); elegir(cliente) }}>
                    <span className="block text-sm font-medium">{cliente.nombre}</span><span className="block text-xs text-muted-foreground">{cliente.telefono}</span>
                </li>)}
            </ul>}
        </div>)}
    </div>
}
