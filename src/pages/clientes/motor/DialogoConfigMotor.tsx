import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useAuthStore } from '@/store/authStore'
import { clientesApi, ApiError, type ConfigMotorRecompra, type ModoRecompra } from '@/lib/api'
import { toast } from 'sonner'
import { Bot, Loader2, MessageSquare, Save } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CUPO_MAX, CUPO_MIN, CONTROL_MAX, CONTROL_MIN, DIAS_TOQUE_MAX, DIAS_TOQUE_MIN } from './comun'
import { Campo, Stepper } from './controles'

// =============================================================================
// CONFIGURACIÓN DEL MOTOR — los valores del LOCAL, no de una tanda
//
// El cupo es del local porque protege el número de WhatsApp y porque ahora pueden correr varias
// tandas a la vez: si cada una tuviera el suyo, el cupo no protegería nada. Los días entre toques y
// el % de control que se eligen acá son el DEFAULT de las tandas nuevas; una tanda puede pisarlos
// (el asistente los muestra al programar y los guarda con la tanda).
// =============================================================================

export default function DialogoConfigMotor({ config, onCerrar, onGuardado }: {
    config: ConfigMotorRecompra
    onCerrar: () => void
    onGuardado: () => void
}) {
    const token = useAuthStore(state => state.token)
    const [cupoDiario, setCupoDiario] = useState(config.cupoDiario)
    const [diasToque2, setDiasToque2] = useState(config.diasToque2)
    const [diasToque3, setDiasToque3] = useState(config.diasToque3)
    const [porcentajeControl, setPorcentajeControl] = useState(config.porcentajeControl)
    const [modo, setModo] = useState<ModoRecompra>(config.modo)
    const [guardando, setGuardando] = useState(false)

    const sinCambios = cupoDiario === config.cupoDiario
        && diasToque2 === config.diasToque2
        && diasToque3 === config.diasToque3
        && porcentajeControl === config.porcentajeControl
        && modo === config.modo

    const guardar = async () => {
        if (!token || guardando) return
        setGuardando(true)
        try {
            const res = await clientesApi.configRecompra(token, {
                cupoDiario, modo, diasToque2, diasToque3, porcentajeControl,
            })
            if (res.success) {
                // El backend acota lo que recibe (el piso de 48 hs, el tope del cupo). Si lo guardado
                // no es lo que se pidió, se dice: el dueño tiene que ver el número real, no el suyo.
                const guardado = res.data?.config
                const ajustado = guardado && (
                    guardado.cupoDiario !== cupoDiario
                    || guardado.diasToque2 !== diasToque2
                    || guardado.diasToque3 !== diasToque3
                    || guardado.porcentajeControl !== porcentajeControl
                )
                toast.success(ajustado
                    ? `Guardado con los límites del motor: ${guardado.diasToque2} días entre toques, ${guardado.porcentajeControl}% de control.`
                    : 'Configuración guardada')
                onGuardado()
            }
        } catch (err) {
            if (err instanceof ApiError && err.status === 403) toast.error('Activá el módulo Retención para configurar el motor')
            else toast.error('No se pudo guardar la configuración')
        } finally {
            setGuardando(false)
        }
    }

    return (
        <Dialog open onOpenChange={(abierto) => { if (!abierto && !guardando) onCerrar() }}>
            <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Configuración del motor</DialogTitle>
                    <DialogDescription>
                        Son los valores del local. Los días y el control valen para las tandas nuevas; el cupo
                        vale para todas, porque es el que cuida el número.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-1">
                    <Campo
                        titulo="Cupo diario"
                        accion={<span className="text-[11px] text-muted-foreground/70">mensajes por día, todas las tandas</span>}
                    >
                        <div className="flex flex-wrap items-center gap-2">
                            <Stepper value={cupoDiario} onChange={setCupoDiario} min={CUPO_MIN} max={CUPO_MAX} />
                            <span className="text-xs text-muted-foreground">
                                mensajes por día. Bajar el cupo alarga las tandas; subirlo las apura.
                            </span>
                        </div>
                    </Campo>

                    <Campo
                        titulo="Días entre toques"
                        accion={<span className="text-[11px] text-muted-foreground/70">de una tanda nueva</span>}
                    >
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="w-32 text-xs text-foreground">1º → 2º toque</span>
                                <Stepper value={diasToque2} onChange={setDiasToque2} min={DIAS_TOQUE_MIN} max={DIAS_TOQUE_MAX} paso={1} />
                                <span className="text-xs text-muted-foreground">días</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="w-32 text-xs text-foreground">2º → 3º toque</span>
                                <Stepper value={diasToque3} onChange={setDiasToque3} min={DIAS_TOQUE_MIN} max={DIAS_TOQUE_MAX} paso={1} />
                                <span className="text-xs text-muted-foreground">días</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground/70">
                                El mínimo son {DIAS_TOQUE_MIN} días (48 hs). No se puede bajar: es lo que evita
                                que dos mensajes salgan pegados. Se cuentan desde el toque anterior, así que el
                                2º sale {diasToque2} días después del 1º y no en una fecha fija.
                            </p>
                        </div>
                    </Campo>

                    <Campo
                        titulo="Grupo de control"
                        accion={<span className="text-[11px] text-muted-foreground/70">para medir el resultado</span>}
                    >
                        <div className="flex flex-wrap items-center gap-2">
                            <Stepper value={porcentajeControl} onChange={setPorcentajeControl} min={CONTROL_MIN} max={CONTROL_MAX} />
                            <span className="text-xs text-muted-foreground">
                                % de cada tanda que queda sin recibir nada. Es el que después dice cuánto
                                generó el motor de verdad y no lo que iba a pasar igual.
                            </span>
                        </div>
                    </Campo>

                    <Campo titulo="Modalidad de envío">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <button
                                type="button"
                                onClick={() => setModo('automatico')}
                                className={cn(
                                    "rounded-xl border p-3.5 text-left transition-all",
                                    modo === 'automatico'
                                        ? "border-foreground bg-foreground/5 ring-1 ring-foreground"
                                        : "border-border/60 bg-muted/20 hover:border-border",
                                )}
                            >
                                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                    <Bot className="h-4 w-4" /> Automático
                                </div>
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                    El motor manda los mensajes agendados solo, de a poco. Cada uno usa un crédito.
                                </p>
                            </button>
                            <button
                                type="button"
                                onClick={() => setModo('manual')}
                                className={cn(
                                    "rounded-xl border p-3.5 text-left transition-all",
                                    modo === 'manual'
                                        ? "border-foreground bg-foreground/5 ring-1 ring-foreground"
                                        : "border-border/60 bg-muted/20 hover:border-border",
                                )}
                            >
                                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                    <MessageSquare className="h-4 w-4" /> Manual
                                </div>
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                    El motor prepara los mensajes en la cola y los enviás vos, sin gastar créditos.
                                </p>
                            </button>
                        </div>
                    </Campo>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="ghost" onClick={onCerrar} disabled={guardando}>Cancelar</Button>
                    <Button onClick={guardar} disabled={guardando || sinCambios} className="gap-2">
                        {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Guardar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
