import { useEffect, useRef, type ElementType, type FocusEvent, type ReactNode } from 'react'
import {
    Armchair, CheckCircle, ChevronDown, Loader2, MapPin, Minus, Pencil, Plus, Printer, ShoppingBag,
    ShoppingCart, StickyNote, Trash2, Truck, User,
} from 'lucide-react'
import { AddressAutocomplete } from '@/components/AddressAutocomplete'
import { ClienteAutocomplete } from '@/components/ClienteAutocomplete'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { formatoPesos, type PosItemVista, type PosPedidoAcciones, type PosPedidoDatos } from './posMovilLib'

// En un celular apaisado sobra ancho y falta alto: el panel se compacta para dejar lugar a los ítems.
const BAJO = '[@media(max-height:480px)]'

interface PosPedidoPanelProps {
    /** "hoja": ocupa la hoja inferior del celular. "lateral": columna fija de la tablet. */
    variante: 'hoja' | 'lateral'
    items: PosItemVista[]
    datos: PosPedidoDatos
    acciones: PosPedidoAcciones
    /** Sólo en la hoja: vuelve al catálogo. */
    onCerrar?: () => void
}

function Seccion({ titulo, icono: Icono, children }: { titulo: string; icono: ElementType; children: ReactNode }) {
    return (
        <section className="mt-5">
            <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                <Icono className="h-3.5 w-3.5" /> {titulo}
            </h3>
            {children}
        </section>
    )
}

function FilaPedido({ item, acciones, deshabilitado }: { item: PosItemVista; acciones: PosPedidoAcciones; deshabilitado: boolean }) {
    const variantes = [item.varianteNombre, item.varianteSecundariaNombre].filter(Boolean).join(' · ')
    return (
        <li className="py-3">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[15px] font-semibold leading-snug text-foreground">
                        {item.nombre}
                        {variantes && <span className="font-medium text-[#FF7A00]"> ({variantes})</span>}
                    </p>
                    {item.ingredientesExcluidosNombres.length > 0 && (
                        <p className="mt-0.5 text-xs font-medium text-orange-600 dark:text-orange-400">Sin: {item.ingredientesExcluidosNombres.join(', ')}</p>
                    )}
                    {item.agregadosNombres.length > 0 && (
                        <p className="mt-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">Extras: {item.agregadosNombres.join(', ')}</p>
                    )}
                </div>
                <span className="shrink-0 text-[15px] font-bold tabular-nums text-foreground">
                    {formatoPesos(item.precioUnitario * item.cantidad)}
                </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <div className="flex items-center rounded-xl bg-muted/70 p-1">
                        <button
                            type="button"
                            disabled={deshabilitado}
                            aria-label={`Quitar una unidad de ${item.nombre}`}
                            onClick={() => acciones.onCantidad(item.key, -1)}
                            className="flex h-10 w-10 touch-manipulation items-center justify-center rounded-lg text-foreground transition-colors hover:bg-background active:scale-95 active:bg-background disabled:opacity-40"
                        >
                            <Minus className="h-4 w-4" />
                        </button>
                        <span aria-label={`${item.cantidad} unidades`} className="w-9 text-center text-base font-bold tabular-nums">{item.cantidad}</span>
                        <button
                            type="button"
                            disabled={deshabilitado}
                            aria-label={`Sumar una unidad de ${item.nombre}`}
                            onClick={() => acciones.onCantidad(item.key, 1)}
                            className="flex h-10 w-10 touch-manipulation items-center justify-center rounded-lg text-foreground transition-colors hover:bg-background active:scale-95 active:bg-background disabled:opacity-40"
                        >
                            <Plus className="h-4 w-4" />
                        </button>
                    </div>
                    {item.cantidad > 1 && <span className="text-xs text-muted-foreground">{formatoPesos(item.precioUnitario)} c/u</span>}
                </div>
                <div className="flex items-center">
                    {item.editable && (
                        <button
                            type="button"
                            disabled={deshabilitado}
                            aria-label={`Editar ${item.nombre}`}
                            onClick={() => acciones.onEditar(item.key)}
                            className="flex h-10 w-10 touch-manipulation items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                        >
                            <Pencil className="h-[18px] w-[18px]" />
                        </button>
                    )}
                    <button
                        type="button"
                        disabled={deshabilitado}
                        aria-label={`Eliminar ${item.nombre}`}
                        onClick={() => acciones.onQuitar(item.key)}
                        className="flex h-10 w-10 touch-manipulation items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                    >
                        <Trash2 className="h-[18px] w-[18px]" />
                    </button>
                </div>
            </div>
        </li>
    )
}

export function PosPedidoPanel({ variante, items, datos, acciones, onCerrar }: PosPedidoPanelProps) {
    const direccionRef = useRef<HTMLDivElement>(null)
    const unidades = items.reduce((suma, item) => suma + item.cantidad, 0)
    const guardadoAutomatico = datos.modoEdicion || datos.tipo === 'mesa'
    const conDatosDeCliente = datos.campos.nombre || datos.campos.telefono
    const entrega = datos.tipo === 'delivery'
    const columnasPago = datos.metodos.length === 3 ? 3 : 2
    const lateral = variante === 'lateral'
    // Recordatorio pasivo de lo que se va a confirmar: el tipo de pedido y cómo se cobra.
    const etiquetaTipo = datos.tipo === 'delivery' ? 'Delivery' : datos.tipo === 'mesa' ? (datos.mesaNombre || 'Mesa') : 'Takeaway'
    const etiquetaPago = datos.metodos.find((metodo) => metodo.id === datos.metodoPago)?.label
    const leyenda = [etiquetaTipo, etiquetaPago].filter(Boolean).join(' · ')
    // "Productos $X · Envío $Y · Descuento -$Z": sólo aparece si el total difiere de la suma de productos.
    const desglose = datos.envio > 0 || datos.descuento > 0
        ? [
            `Productos ${formatoPesos(datos.subtotal)}`,
            datos.envio > 0 ? `Envío ${formatoPesos(datos.envio)}` : null,
            datos.descuento > 0 ? `Descuento -${formatoPesos(datos.descuento)}` : null,
        ].filter(Boolean).join(' · ')
        : ''
    const estadoGuardado = items.length === 0 && !datos.modoEdicion
        ? 'Agregá un producto para abrir la mesa'
        : datos.guardando
            ? 'Guardando…'
            : datos.hayCambios
                ? 'Guardado pendiente…'
                : 'Guardado'

    // Si el intento de anotar un delivery falló por la dirección, el campo se lleva a la vista.
    useEffect(() => {
        if (datos.direccionFaltante) direccionRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, [datos.direccionFaltante])

    // Con el teclado en pantalla abierto, el campo enfocado no debe quedar tapado.
    const traerCampoALaVista = (event: FocusEvent<HTMLElement>) => {
        const campo = event.target
        if (!(campo instanceof HTMLInputElement || campo instanceof HTMLTextAreaElement)) return
        window.setTimeout(() => campo.scrollIntoView({ block: 'center', behavior: 'smooth' }), 280)
    }

    return (
        <div
            role="region"
            aria-label="Pedido"
            className={cn(
                'flex h-full min-h-0 flex-col bg-background',
                // 16 px evita el zoom automático de iOS al enfocar un campo.
                '[&_input]:text-base [&_textarea]:text-base',
            )}
        >
            <div className={cn('flex shrink-0 items-center justify-between gap-2 px-4 pb-2', lateral ? 'pt-4' : 'pt-1', `${BAJO}:pt-2`)}>
                <div className="flex min-w-0 items-center gap-2">
                    <h2 className="text-xl font-black tracking-tight text-foreground">
                        {datos.modoEdicion ? 'Pedido' : 'Tu pedido'}
                    </h2>
                    <span className="rounded-full bg-[#FF7A00]/15 px-2.5 py-0.5 text-xs font-bold tabular-nums text-[#C45F00] dark:text-orange-300">
                        {unidades} {unidades === 1 ? 'ítem' : 'ítems'}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    {items.length > 0 && !guardadoAutomatico && (
                        <button
                            type="button"
                            disabled={datos.guardando}
                            onClick={acciones.onVaciar}
                            className="h-9 rounded-lg px-3 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                        >
                            Vaciar
                        </button>
                    )}
                    {onCerrar && (
                        <button
                            type="button"
                            aria-label="Volver al menú"
                            onClick={onCerrar}
                            className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                            <ChevronDown className="h-5 w-5" />
                        </button>
                    )}
                </div>
            </div>

            <div onFocusCapture={traerCampoALaVista} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
                {datos.tipo === 'mesa' ? (
                    <div className="flex items-center gap-2.5 rounded-2xl bg-[#FF7A00]/10 px-4 py-3 text-[15px] font-bold text-foreground">
                        <Armchair className="h-5 w-5 text-[#FF7A00]" /> {datos.mesaNombre || 'Mesa'}
                    </div>
                ) : datos.tiposHabilitados.length > 1 && (
                    <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted/70 p-1">
                        {datos.tiposHabilitados.map((tipo) => {
                            const Icono = tipo === 'delivery' ? Truck : ShoppingBag
                            const activo = datos.tipo === tipo
                            return (
                                <button
                                    key={tipo}
                                    type="button"
                                    aria-pressed={activo}
                                    onClick={() => acciones.onTipo(tipo)}
                                    className={cn(
                                        'flex h-11 touch-manipulation items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all',
                                        `${BAJO}:h-9`,
                                        activo ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    <Icono className="h-4 w-4" /> {tipo === 'delivery' ? 'Delivery' : 'Takeaway'}
                                </button>
                            )
                        })}
                    </div>
                )}

                {entrega && (
                    <Seccion titulo="Entrega" icono={MapPin}>
                        <div className="space-y-3">
                            {datos.campos.direccion && (
                                <div ref={direccionRef} className="space-y-1.5">
                                    <label className="text-xs font-semibold text-muted-foreground">Dirección</label>
                                    {datos.direccionSoloTexto ? (
                                        <Input
                                            value={datos.direccion}
                                            onChange={(event) => acciones.onDireccion(event.target.value, null, null)}
                                            placeholder="Calle, número, barrio y ciudad..."
                                            autoComplete="street-address"
                                            aria-invalid={datos.direccionFaltante || undefined}
                                            className="h-12 rounded-xl bg-transparent dark:bg-transparent"
                                        />
                                    ) : (
                                        <AddressAutocomplete
                                            value={datos.direccion}
                                            onChange={(direccion, lat, lng) => acciones.onDireccion(direccion, lat, lng)}
                                            placeholder="Calle y número..."
                                            className={datos.direccionFaltante ? 'border-destructive' : undefined}
                                        />
                                    )}
                                    {datos.direccionFaltante && (
                                        <p role="alert" className="text-xs font-semibold text-destructive">Ingresá la dirección de entrega</p>
                                    )}
                                </div>
                            )}
                            <div className="space-y-1.5">
                                <label htmlFor="pos-costo-envio" className="text-xs font-semibold text-muted-foreground">Costo de envío</label>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">$</span>
                                    <Input
                                        id="pos-costo-envio"
                                        value={datos.costoEnvio}
                                        onChange={(event) => acciones.onCostoEnvio(event.target.value.replace(/[^\d.]/g, ''))}
                                        placeholder="0"
                                        inputMode="decimal"
                                        className="h-12 rounded-xl bg-transparent pl-8 dark:bg-transparent"
                                    />
                                </div>
                            </div>
                        </div>
                    </Seccion>
                )}

                {items.length === 0 ? (
                    <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-9 text-center text-muted-foreground">
                        <ShoppingCart className="h-7 w-7 opacity-40" />
                        <p className="text-sm font-medium">Tocá productos del menú para agregarlos</p>
                    </div>
                ) : (
                    <ul className="mt-2 divide-y divide-border/60">
                        {items.map((item) => (
                            <FilaPedido key={item.key} item={item} acciones={acciones} deshabilitado={datos.guardando} />
                        ))}
                    </ul>
                )}

                {conDatosDeCliente && (
                    <Seccion titulo="Cliente" icono={User}>
                        <ClienteAutocomplete
                            nombre={datos.nombre}
                            telefono={datos.telefono}
                            mostrarNombre={datos.campos.nombre}
                            mostrarTelefono={datos.campos.telefono}
                            onChange={acciones.onCliente}
                        />
                    </Seccion>
                )}

                {datos.mostrarNotas && (
                    <Seccion titulo="Nota" icono={StickyNote}>
                        <Textarea
                            aria-label="Nota del pedido"
                            value={datos.notas}
                            onChange={(event) => acciones.onNotas(event.target.value)}
                            placeholder="Aclaraciones del pedido"
                            rows={2}
                            className="min-h-[64px] resize-none rounded-xl bg-transparent dark:bg-transparent"
                        />
                    </Seccion>
                )}

                {/* Con un único método habilitado no hay nada para elegir: se guarda directo con ése. */}
                {datos.metodos.length > 1 && (
                    <section className="mt-5">
                        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Método de pago</h3>
                        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columnasPago}, minmax(0, 1fr))` }}>
                            {datos.metodos.map((metodo) => {
                                const Icono = metodo.icon
                                const activo = datos.metodoPago === metodo.id
                                return (
                                    <button
                                        key={metodo.id}
                                        type="button"
                                        aria-pressed={activo}
                                        onClick={() => acciones.onMetodoPago(metodo.id)}
                                        className={cn(
                                            'flex h-[60px] touch-manipulation flex-col items-center justify-center gap-1 rounded-xl border px-1 text-xs font-semibold transition-colors',
                                            activo
                                                ? 'border-[#FF7A00] bg-[#FF7A00]/10 text-foreground'
                                                : 'border-border bg-card text-muted-foreground hover:bg-muted',
                                        )}
                                    >
                                        <Icono className={cn('h-[18px] w-[18px]', activo && 'text-[#FF7A00]')} />
                                        {metodo.label}
                                    </button>
                                )
                            })}
                        </div>
                    </section>
                )}
            </div>

            <div className={cn('shrink-0 space-y-3 border-t border-border/70 bg-background px-4 pt-3', lateral ? 'pb-4' : 'pb-[max(0.875rem,env(safe-area-inset-bottom))]', `${BAJO}:space-y-1.5 ${BAJO}:pb-2 ${BAJO}:pt-2`)}>
                <div className="space-y-1">
                    {(desglose || guardadoAutomatico) && (
                        <div className="flex items-center justify-between gap-3 text-xs">
                            <span className="min-w-0 truncate text-muted-foreground">{desglose}</span>
                            {guardadoAutomatico && (
                                <span className="flex shrink-0 items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                                    {datos.guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                                    {estadoGuardado}
                                </span>
                            )}
                        </div>
                    )}
                    <div className="flex items-end justify-between gap-3">
                        <div className="min-w-0">
                            <span className="block text-sm font-semibold uppercase tracking-widest text-muted-foreground">Total</span>
                            {leyenda && <span className="block truncate text-xs text-muted-foreground">{leyenda}</span>}
                        </div>
                        <span className={cn('text-3xl font-black tabular-nums tracking-tight text-[#FF7A00]', `${BAJO}:text-2xl`)}>{formatoPesos(datos.total)}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {guardadoAutomatico ? (
                        <Button
                            type="button"
                            onClick={acciones.onConfirmar}
                            disabled={datos.guardando || !datos.hayCambios || items.length === 0}
                            className={cn('h-14 flex-1 rounded-2xl bg-[#FF7A00] text-base font-bold text-white hover:bg-[#E66E00] disabled:opacity-50', `${BAJO}:h-11`)}
                        >
                            {datos.guardando ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Guardando…</> : 'Guardar cambios'}
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            onClick={acciones.onConfirmar}
                            disabled={datos.guardando || items.length === 0}
                            className={cn('h-14 flex-1 rounded-2xl bg-[#FF7A00] text-base font-bold text-white hover:bg-[#E66E00] disabled:opacity-50', `${BAJO}:h-11`)}
                        >
                            {datos.guardando ? <Loader2 className="h-5 w-5 animate-spin" /> : (datos.confirmaCobro ? 'Cobrar' : 'Anotar pedido')}
                        </Button>
                    )}
                    {datos.modoEdicion && datos.tipo === 'mesa' && acciones.onDespacharMesa && (
                        <button
                            type="button"
                            onClick={acciones.onDespacharMesa}
                            disabled={items.length === 0 || datos.guardando}
                            aria-label="Despachar mesa"
                            title="Despachar mesa"
                            className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#FF7A00] text-white transition-colors hover:bg-[#E66E00] disabled:cursor-not-allowed disabled:opacity-50', `${BAJO}:h-11 ${BAJO}:w-11`)}
                        >
                            <Armchair className="h-5 w-5" />
                        </button>
                    )}
                </div>

                {datos.modoEdicion && (
                    <div className="grid grid-cols-2 gap-2">
                        <Button type="button" variant="outline" disabled={datos.guardando} onClick={acciones.onImprimirNuevos} aria-label="Imprimir productos nuevos" title="Imprimir productos nuevos" className={cn('h-10 min-w-0 rounded-xl px-2 text-xs font-bold', `${BAJO}:h-9`)}>
                            {!lateral && <Printer className="h-4 w-4 shrink-0" />} <span className="truncate">Imprimir nuevos</span>
                        </Button>
                        <Button type="button" variant="outline" disabled={datos.guardando} onClick={acciones.onReimprimirTodo} aria-label="Reimprimir comanda entera" title="Reimprimir comanda entera" className={cn('h-10 min-w-0 rounded-xl px-2 text-xs font-bold', `${BAJO}:h-9`)}>
                            {!lateral && <Printer className="h-4 w-4 shrink-0" />} <span className="truncate">Reimprimir todo</span>
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}
