import { useCallback, useEffect, useState } from 'react'
import { Link2, Loader2, Plus, QrCode, Store, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ApiError, posQrApi } from '@/lib/api'
import type { CajaMpDto, CajaQrDto, EstadoPosQrDto, TiendaMpDto } from '@/lib/posCobro'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'

const mensajeDe = (error: unknown, porDefecto: string) => (error instanceof ApiError ? error.message : porDefecto)

function VerQrDialog({ caja, onCerrar }: { caja: CajaQrDto; onCerrar: () => void }) {
    return (
        <Dialog open onOpenChange={(abierto) => { if (!abierto) onCerrar() }}>
            <DialogContent className="sm:max-w-sm" aria-describedby="ver-qr-descripcion">
                <DialogHeader>
                    <DialogTitle>QR de «{caja.nombre}»</DialogTitle>
                    <DialogDescription id="ver-qr-descripcion">
                        Imprimilo y pegalo donde se cobra: es el QR fijo que escanean tus clientes.
                    </DialogDescription>
                </DialogHeader>
                <div className="mx-auto flex h-64 w-64 items-center justify-center rounded-2xl border border-border bg-white p-3">
                    {caja.qrUrl
                        ? <img src={caja.qrUrl} alt={`QR de la caja ${caja.nombre}`} className="h-full w-full object-contain" />
                        : <QrCode className="h-16 w-16 text-muted-foreground/50" />}
                </div>
                {caja.plantillaUrl && (
                    <a href={caja.plantillaUrl} target="_blank" rel="noreferrer" className="text-center text-sm font-medium text-[#FF7A00] underline underline-offset-2">
                        Abrir la plantilla para imprimir
                    </a>
                )}
                <DialogFooter>
                    <Button type="button" onClick={onCerrar}>Listo</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

type ModoAgregar = 'vincular' | 'crear'

function AgregarCajaDialog({ onAgregada, onCerrar }: { onAgregada: (caja: CajaQrDto) => void; onCerrar: () => void }) {
    const token = useAuthStore((s) => s.token)
    const [modo, setModo] = useState<ModoAgregar>('vincular')
    const [cajasMp, setCajasMp] = useState<CajaMpDto[] | null>(null)
    const [tiendas, setTiendas] = useState<TiendaMpDto[] | null>(null)
    const [cargando, setCargando] = useState(false)
    const [enviando, setEnviando] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [nombre, setNombre] = useState('')
    const [tiendaId, setTiendaId] = useState('')

    useEffect(() => {
        if (!token) return
        let cancelado = false
        const cargar = async () => {
            setCargando(true)
            setError(null)
            try {
                if (modo === 'vincular') {
                    const datos = (await posQrApi.cajasMp(token)).data
                    if (!cancelado) setCajasMp(datos)
                } else {
                    const datos = (await posQrApi.tiendasMp(token)).data
                    if (cancelado) return
                    setTiendas(datos)
                    setTiendaId((actual) => actual || datos[0]?.id || '')
                }
            } catch (e) {
                if (!cancelado) setError(mensajeDe(e, 'No se pudo consultar Mercado Pago'))
            } finally {
                if (!cancelado) setCargando(false)
            }
        }
        void cargar()
        return () => { cancelado = true }
    }, [modo, token])

    const vincular = async (caja: CajaMpDto) => {
        if (!token || enviando) return
        setEnviando(caja.mpPosId)
        setError(null)
        try {
            onAgregada((await posQrApi.vincularCaja(token, caja.mpPosId)).data)
            toast.success(`Caja «${caja.nombre}» vinculada`)
        } catch (e) {
            setError(mensajeDe(e, 'No se pudo vincular la caja'))
        } finally {
            setEnviando(null)
        }
    }

    const crear = async () => {
        if (!token || enviando || !nombre.trim() || !tiendaId) return
        setEnviando('crear')
        setError(null)
        try {
            const caja = (await posQrApi.crearCaja(token, { nombre: nombre.trim(), tiendaId })).data
            onAgregada(caja)
            toast.success(`Caja «${caja.nombre}» creada. Imprimí su QR y pegalo donde cobrás.`)
        } catch (e) {
            setError(mensajeDe(e, 'No se pudo crear la caja'))
        } finally {
            setEnviando(null)
        }
    }

    return (
        <Dialog open onOpenChange={(abierto) => { if (!abierto && !enviando) onCerrar() }}>
            <DialogContent className="sm:max-w-md" aria-describedby="agregar-caja-descripcion">
                <DialogHeader>
                    <DialogTitle>Agregar caja de Mercado Pago</DialogTitle>
                    <DialogDescription id="agregar-caja-descripcion">
                        Una caja tiene un QR fijo. El cliente lo escanea y Piru verifica el pago solo con Mercado Pago.
                    </DialogDescription>
                </DialogHeader>

                <div role="tablist" aria-label="Cómo agregar la caja" className="grid grid-cols-2 gap-1 rounded-2xl bg-muted/60 p-1">
                    {([['vincular', 'Ya tengo una'], ['crear', 'Crear una nueva']] as const).map(([id, etiqueta]) => (
                        <button
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={modo === id}
                            onClick={() => { setModo(id); setError(null) }}
                            className={cn('h-9 rounded-lg text-xs font-bold transition-colors', modo === id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                        >
                            {etiqueta}
                        </button>
                    ))}
                </div>

                <div className="max-h-[50vh] space-y-2 overflow-y-auto">
                    {cargando && (
                        <p role="status" className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" /> Consultando Mercado Pago…
                        </p>
                    )}

                    {!cargando && modo === 'vincular' && cajasMp && (
                        cajasMp.length === 0 ? (
                            <p className="py-4 text-center text-sm text-muted-foreground">No tenés cajas en Mercado Pago. Creá una nueva desde la otra pestaña.</p>
                        ) : (
                            <ul className="space-y-2">
                                {cajasMp.map((caja) => {
                                    const usable = !!caja.externalId && caja.activa
                                    return (
                                        <li key={caja.mpPosId} className="flex items-center justify-between gap-3 rounded-2xl border p-3">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium">{caja.nombre}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {!caja.activa ? 'Inactiva en Mercado Pago: activala allá para poder cobrar.' : !caja.externalId ? 'Sin ID externo: Mercado Pago no permite cobrarla por API. Creá una nueva.' : caja.vinculada ? 'Ya vinculada' : `ID ${caja.externalId}`}
                                                </p>
                                            </div>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                disabled={!usable || caja.vinculada || enviando != null}
                                                aria-label={`Vincular ${caja.nombre}`}
                                                onClick={() => void vincular(caja)}
                                            >
                                                {enviando === caja.mpPosId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="mr-1.5 h-3.5 w-3.5" />}
                                                Vincular
                                            </Button>
                                        </li>
                                    )
                                })}
                            </ul>
                        )
                    )}

                    {!cargando && modo === 'crear' && tiendas && (
                        tiendas.length === 0 ? (
                            <p className="py-4 text-center text-sm text-muted-foreground">
                                No tenés tiendas en Mercado Pago. Creá una desde la app de Mercado Pago (Tu negocio → Sucursales y cajas) y volvé.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                <div>
                                    <label htmlFor="caja-tienda" className="mb-1 block text-xs font-bold uppercase tracking-widest text-muted-foreground">Tienda</label>
                                    <select
                                        id="caja-tienda"
                                        value={tiendaId}
                                        onChange={(evento) => setTiendaId(evento.target.value)}
                                        className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                                    >
                                        {tiendas.map((tienda) => (
                                            <option key={tienda.id} value={tienda.id}>{tienda.nombre}{tienda.direccion ? ` — ${tienda.direccion}` : ''}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="caja-nombre" className="mb-1 block text-xs font-bold uppercase tracking-widest text-muted-foreground">Nombre de la caja</label>
                                    <Input id="caja-nombre" value={nombre} maxLength={80} onChange={(evento) => setNombre(evento.target.value)} placeholder="Ej.: Barra del evento" className="h-10 rounded-xl" />
                                </div>
                                <p className="text-xs text-muted-foreground">Se crea sobre una tienda que ya existe en tu cuenta. Después imprimís su QR y lo pegás donde cobrás.</p>
                            </div>
                        )
                    )}

                    {error && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">{error}</p>}
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onCerrar} disabled={enviando != null}>Cerrar</Button>
                    {modo === 'crear' && tiendas && tiendas.length > 0 && (
                        <Button type="button" onClick={() => void crear()} disabled={!nombre.trim() || !tiendaId || enviando != null}>
                            {enviando === 'crear' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                            Crear caja
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

interface PropsSeccion {
    /** Caja que usa este dispositivo (se guarda con el resto de la configuración del POS). */
    cajaElegidaId: number | null
    onElegir: (cajaId: number | null) => void
    /** Se llama justo antes de salir a autorizar en Mercado Pago: la pantalla se abandona, así que lo sin guardar se guarda. */
    antesDeConectar?: () => void
}

/** Cajas de Mercado Pago (QR estático) con las que se cobra: vincular, crear, elegir la de este equipo. */
export function PosCajasQrSection({ cajaElegidaId, onElegir, antesDeConectar }: PropsSeccion) {
    const token = useAuthStore((s) => s.token)
    const [estado, setEstado] = useState<EstadoPosQrDto | null>(null)
    const [cargando, setCargando] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [agregando, setAgregando] = useState(false)
    const [verQr, setVerQr] = useState<CajaQrDto | null>(null)
    const [quitando, setQuitando] = useState<number | null>(null)
    const [conectando, setConectando] = useState(false)
    const [desconectando, setDesconectando] = useState(false)

    const cargar = useCallback(async () => {
        if (!token) return
        setCargando(true)
        setError(null)
        try {
            setEstado((await posQrApi.estado(token)).data)
        } catch (e) {
            setError(mensajeDe(e, 'No se pudo consultar Mercado Pago'))
        } finally {
            setCargando(false)
        }
    }, [token])

    useEffect(() => { void cargar() }, [cargar])

    const cajas = estado?.cajas ?? []
    // Con una sola caja no hay nada que elegir; con varias, la de este equipo es la guardada.
    const efectiva = cajaElegidaId != null && cajas.some((caja) => caja.id === cajaElegidaId)
        ? cajaElegidaId
        : cajas.length === 1 ? cajas[0].id : null
    useEffect(() => {
        if (estado && efectiva !== cajaElegidaId) onElegir(efectiva)
    }, [estado, efectiva, cajaElegidaId, onElegir])

    const quitar = async (caja: CajaQrDto) => {
        if (!token || quitando != null) return
        if (!window.confirm(`¿Quitar la caja «${caja.nombre}» de Piru? Seguirá existiendo en tu cuenta de Mercado Pago.`)) return
        setQuitando(caja.id)
        try {
            await posQrApi.desvincularCaja(token, caja.id)
            await cargar()
        } catch (e) {
            toast.error(mensajeDe(e, 'No se pudo quitar la caja'))
        } finally {
            setQuitando(null)
        }
    }

    // Los cobros con QR usan su propia aplicación de Mercado Pago (pagos presenciales): el vendedor la autoriza
    // una vez en Mercado Pago y vuelve al admin. El servidor genera la URL con un `state` que sólo él puede firmar.
    const conectar = async () => {
        if (!token || conectando) return
        setConectando(true)
        setError(null)
        try {
            const { url } = (await posQrApi.iniciarConexion(token)).data
            // La opción "Confirmar cobros manualmente" suele encenderse justo antes de conectar: sin guardarla,
            // al volver la sección de cajas no aparecería hasta volver a encenderla.
            antesDeConectar?.()
            window.location.assign(url)
        } catch (e) {
            setError(mensajeDe(e, 'No se pudo iniciar la conexión con Mercado Pago'))
            setConectando(false)
        }
    }

    const desconectar = async () => {
        if (!token || desconectando) return
        if (!window.confirm('¿Desconectar Mercado Pago de los cobros con QR? Las cajas dejarán de usarse en Piru; seguirán existiendo en tu cuenta de Mercado Pago.')) return
        setDesconectando(true)
        try {
            await posQrApi.desconectar(token)
            onElegir(null)
            await cargar()
        } catch (e) {
            toast.error(mensajeDe(e, 'No se pudo desconectar Mercado Pago'))
        } finally {
            setDesconectando(false)
        }
    }

    const alAgregar = async (caja: CajaQrDto) => {
        setAgregando(false)
        await cargar()
        onElegir(caja.id)
    }

    return (
        <div className="space-y-3 rounded-2xl border p-3.5" data-testid="pos-cajas-qr">
            <div>
                <p className="text-sm font-medium">Mercado Pago · QR estático</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                    Elegí la caja con la que cobra este dispositivo. Al elegir Mercado Pago, el cliente escanea su QR y el pago se verifica solo.
                </p>
            </div>

            {cargando && (
                <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Consultando…
                </p>
            )}

            {!cargando && error && (
                <div role="alert" className="space-y-2 text-xs">
                    <p className="font-medium text-destructive">{error}</p>
                    <Button type="button" size="sm" variant="outline" onClick={() => void cargar()}>Reintentar</Button>
                </div>
            )}

            {!cargando && !error && estado && !estado.moduloMercadoPago && (
                <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
                    Para cobrar con QR necesitás activar el módulo Mercado Pago (Módulos).
                </p>
            )}

            {!cargando && !error && estado && estado.moduloMercadoPago && !estado.mpConectado && (
                estado.appConfigurada ? (
                    <div className="space-y-2.5">
                        <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
                            Los cobros con QR usan una conexión propia con Mercado Pago, aparte de la de pagos online. Se autoriza una sola
                            vez y volvés acá.
                        </p>
                        <Button type="button" size="sm" className="w-full" onClick={() => void conectar()} disabled={conectando}>
                            {conectando ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Link2 className="mr-1.5 h-3.5 w-3.5" />}
                            Conectar Mercado Pago
                        </Button>
                    </div>
                ) : (
                    <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
                        El cobro con QR todavía no está habilitado en Piru. Avisanos para activarlo.
                    </p>
                )
            )}

            {!cargando && !error && estado && estado.moduloMercadoPago && estado.mpConectado && (
                <>
                    {cajas.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Todavía no vinculaste ninguna caja.</p>
                    ) : (
                        <ul role="radiogroup" aria-label="Caja de este dispositivo" className="space-y-2">
                            {cajas.map((caja) => {
                                const elegida = caja.id === efectiva
                                return (
                                    <li key={caja.id} className={cn('flex items-center justify-between gap-2 rounded-2xl border p-2.5', elegida ? 'border-[#FF7A00] bg-[#FF7A00]/5' : 'border-border')}>
                                        <button
                                            type="button"
                                            role="radio"
                                            aria-checked={elegida}
                                            onClick={() => onElegir(caja.id)}
                                            className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                                        >
                                            <span aria-hidden className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded-full border', elegida ? 'border-[#FF7A00]' : 'border-muted-foreground/40')}>
                                                {elegida && <span className="h-2 w-2 rounded-full bg-[#FF7A00]" />}
                                            </span>
                                            <span className="truncate text-sm font-medium">{caja.nombre}</span>
                                        </button>
                                        <div className="flex shrink-0 items-center gap-1">
                                            <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs" aria-label={`Ver QR de ${caja.nombre}`} onClick={() => setVerQr(caja)}>
                                                <QrCode className="mr-1 h-3.5 w-3.5" /> QR
                                            </Button>
                                            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" aria-label={`Quitar ${caja.nombre}`} disabled={quitando != null} onClick={() => void quitar(caja)}>
                                                {quitando === caja.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                            </Button>
                                        </div>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                    <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setAgregando(true)}>
                        <Store className="mr-1.5 h-3.5 w-3.5" /> {cajas.length === 0 ? 'Vincular o crear una caja' : 'Agregar otra caja'}
                    </Button>
                    <button
                        type="button"
                        onClick={() => void desconectar()}
                        disabled={desconectando}
                        className="block w-full text-center text-xs text-muted-foreground underline underline-offset-2 hover:text-destructive disabled:opacity-50"
                    >
                        {desconectando ? 'Desconectando…' : 'Desconectar Mercado Pago de los cobros con QR'}
                    </button>
                </>
            )}

            {agregando && <AgregarCajaDialog onAgregada={(caja) => void alAgregar(caja)} onCerrar={() => setAgregando(false)} />}
            {verQr && <VerQrDialog caja={verQr} onCerrar={() => setVerQr(null)} />}
        </div>
    )
}
