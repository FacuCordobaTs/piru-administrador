import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  ArrowRight, CheckCircle2, User, Check, AlertCircle,
  MessageSquare, Printer, Clock, Palette,
  CreditCard, Plus, Trash2, ArrowLeft, Users,
  Banknote, ArrowDownToLine
} from 'lucide-react'
import { cn } from '@/lib/utils'
import ImageUpload from '@/components/ImageUpload'
import { toast } from 'sonner'
import { onboardingApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'
import { AddressAutocomplete } from '@/components/AddressAutocomplete'

const MP_APP_ID = 38638191854826
const MP_REDIRECT_URI = import.meta.env.VITE_MP_REDIRECT_URI || 'https://api.piru.app/api/mp/callback'

const STEPS = [
    { id: 1, name: 'Tu negocio', icon: User, required: true },
    { id: 2, name: 'Notificaciones', icon: MessageSquare, required: true },
    { id: 3, name: 'Horarios', icon: Clock, required: false },
    { id: 4, name: 'Branding', icon: Palette, required: false },
    { id: 5, name: 'Pagos', icon: CreditCard, required: true },
]

const inputClass = "h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-transparent focus:ring-2 focus:ring-[#FF7A00]/30 transition-all text-sm px-4 w-full"
const labelClass = "text-sm font-medium text-muted-foreground mb-1.5 block"

const usernameOk = (v: string) => /^[a-zA-Z0-9_-]+$/.test(v) && v.length >= 3

const ToggleRow = ({ icon: Icon, iconBg, title, description, checked, onCheckedChange }: {
  icon: any, iconBg: string, title: string, description: string, checked: boolean, onCheckedChange: (v: boolean) => void
}) => (
  <div className="flex items-center justify-between gap-4 py-3">
    <div className="flex items-center gap-3">
      <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0", iconBg)}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
    <Switch checked={checked} onCheckedChange={onCheckedChange} />
  </div>
)

const Onboarding = () => {
    const navigate = useNavigate()
    const { token } = useAuthStore()
    const restauranteStore = useRestauranteStore()
    const restaurante = restauranteStore.restaurante as any

    const [currentStep, setCurrentStep] = useState(1)
    const [submitting, setSubmitting] = useState(false)
    const [usernameTouched, setUsernameTouched] = useState(false)

    const [formData, setFormData] = useState(() => {
        const saved = localStorage.getItem('piru_onboarding_data')
        return saved ? JSON.parse(saved) : {
            username: restaurante?.username || '',
            address: restaurante?.direccion || '',
            notifyWhatsapp: restaurante?.whatsappEnabled || false,
            whatsappNumber: restaurante?.whatsappNumber || '',
            notifyPrinter: false,
            turnos: [{ horaApertura: '19:00', horaCierre: '23:30' }],
            deliveryPrice: restaurante?.deliveryFee || '0',
            friendsOrdering: restaurante?.orderGroupEnabled ?? true,
            imageLight: null,
            imageDark: null,
            verifyPayments: 'manual',
            proveedorPago: restaurante?.proveedorPago || 'manual',
            metodosPago: {
                transferenciaManual: true,
                efectivo: true
            }
        }
    })

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search)
        const mpStatus = urlParams.get('mp_status')
        const mpError = urlParams.get('mp_error')

        if (mpStatus === 'success') {
            toast.success('¡MercadoPago conectado!')
            const saved = localStorage.getItem('piru_onboarding_data')
            if (saved) {
              setFormData((prev: any) => ({ ...prev, ...JSON.parse(saved), verifyPayments: 'auto', proveedorPago: 'mercadopago' }))
            } else {
              setFormData((prev: any) => ({ ...prev, verifyPayments: 'auto', proveedorPago: 'mercadopago' }))
            }
            setCurrentStep(5)
            window.history.replaceState({}, '', window.location.pathname)
        } else if (mpStatus === 'error') {
            toast.error('Error al conectar MercadoPago', { description: mpError })
            setCurrentStep(5)
            window.history.replaceState({}, '', window.location.pathname)
        }
    }, [])

    useEffect(() => {
        localStorage.setItem('piru_onboarding_data', JSON.stringify(formData))
    }, [formData])

    const handleNext = () => {
        if (currentStep < STEPS.length) {
            setCurrentStep(prev => prev + 1)
            window.scrollTo({ top: 0, behavior: 'smooth' })
        } else {
            handleFinish()
        }
    }

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(prev => prev - 1)
            window.scrollTo({ top: 0, behavior: 'smooth' })
        }
    }

    const handleSkip = () => {
        if (!STEPS[currentStep - 1].required) handleNext()
    }

    const handleFinish = async () => {
        if (!token) return
        setSubmitting(true)

        let cleanedWhatsappNumber = formData.whatsappNumber
        if (formData.notifyWhatsapp && cleanedWhatsappNumber) {
            cleanedWhatsappNumber = cleanedWhatsappNumber.replace(/\D/g, '')
        }

        try {
            const dataToSubmit = {
                username: formData.username,
                address: formData.address,
                notifyWhatsapp: formData.notifyWhatsapp && !formData.notifyPrinter,
                whatsappNumber: cleanedWhatsappNumber ? `54${cleanedWhatsappNumber}` : '',
                notifyPrinter: formData.notifyPrinter,
                turnos: formData.turnos,
                deliveryPrice: formData.deliveryPrice,
                friendsOrdering: formData.friendsOrdering,
                imageLight: formData.imageLight,
                imageDark: formData.imageDark,
                proveedorPago: formData.verifyPayments === 'auto' ? formData.proveedorPago : 'manual',
                metodosPago: formData.metodosPago
            }

            const response = await onboardingApi.complete(token, dataToSubmit) as { success: boolean, message: string }
            if (response.success) {
                localStorage.removeItem('piru_onboarding_data')
                toast.success('¡Bienvenido a Piru!')
                await restauranteStore.fetchData()
                navigate('/dashboard')
            }
        } catch (error: any) {
            toast.error('Error al finalizar', { description: error.message || 'Intente nuevamente' })
        } finally {
            setSubmitting(false)
        }
    }

    const handleConnectMP = () => {
        if (!MP_APP_ID || !restaurante?.id) return
        localStorage.setItem('piru_onboarding_data', JSON.stringify(formData))
        const state = `${restaurante.id}_onboarding`
        const url = `https://auth.mercadopago.com.ar/authorization?client_id=${MP_APP_ID}&response_type=code&platform_id=mp&state=${state}&redirect_uri=${encodeURIComponent(MP_REDIRECT_URI)}`
        window.location.href = url
    }

    const renderStep1 = () => {
        const isValid = usernameOk(formData.username)
        const showValidation = usernameTouched && formData.username.length > 0

        return (
            <div className="space-y-5">
                <div className="space-y-1.5">
                    <Label htmlFor="username" className={labelClass}>Tu link único</Label>
                    <div className="relative flex items-center overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800 focus-within:ring-2 focus-within:ring-[#FF7A00]/30 transition-all">
                        <span className="pl-4 pr-1 text-muted-foreground font-mono text-sm select-none whitespace-nowrap">my.piru.app/</span>
                        <Input
                          id="username"
                          placeholder="burgerbros"
                          className="h-10 bg-transparent border-none focus-visible:ring-0 px-0 font-mono text-sm w-full min-w-0"
                          value={formData.username}
                          onChange={e => {
                              setUsernameTouched(true)
                              setFormData({ ...formData, username: e.target.value.toLowerCase() })
                          }}
                        />
                        {showValidation && (
                            <div className="pr-3">
                                {isValid
                                    ? <Check className="h-4 w-4 text-emerald-500" />
                                    : <AlertCircle className="h-4 w-4 text-amber-500" />
                                }
                            </div>
                        )}
                    </div>
                    {showValidation && (
                        <p className={cn("text-xs mt-1 transition-all animate-in fade-in", isValid ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                            {isValid
                                ? `✓ Tu menú estará en my.piru.app/${formData.username}`
                                : formData.username.length < 3
                                    ? 'Mínimo 3 caracteres'
                                    : 'Solo letras, números, guiones y guiones bajos'
                            }
                        </p>
                    )}
                    {!showValidation && formData.username.length === 0 && (
                        <p className="text-xs text-muted-foreground">Este es el link que compartís con tus clientes.</p>
                    )}
                </div>

                <div className="space-y-1.5">
                    <Label className={labelClass}>Dirección del local</Label>
                    <AddressAutocomplete
                        value={formData.address}
                        onChange={(address) => setFormData({ ...formData, address })}
                        placeholder="Av. Corrientes 1234, Buenos Aires"
                        className={inputClass}
                    />
                    <p className="text-xs text-muted-foreground">Usada para mostrar la ubicación en pedidos takeaway.</p>
                </div>
            </div>
        )
    }

    const renderStep2 = () => {
        const showWhatsappNumber = formData.notifyWhatsapp && !formData.notifyPrinter
        const waPreview = formData.whatsappNumber?.replace(/\D/g, '')
        const waFormatted = waPreview && waPreview.length >= 10 ? `+54 ${waPreview}` : null

        return (
            <div className="space-y-1">
                <p className="text-sm text-muted-foreground mb-4">¿Cómo querés recibir los pedidos?</p>

                <ToggleRow
                    icon={MessageSquare}
                    iconBg="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                    title="WhatsApp Bot"
                    description="Recibís cada pedido directo en tu chat."
                    checked={formData.notifyWhatsapp}
                    onCheckedChange={checked => setFormData({ ...formData, notifyWhatsapp: checked })}
                />

                {showWhatsappNumber && (
                    <div className="pb-2 pt-1 pl-12 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="relative flex items-center overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800 focus-within:ring-2 focus-within:ring-[#FF7A00]/30 transition-all">
                            <span className="pl-4 pr-1 text-muted-foreground font-mono text-sm select-none">+54</span>
                            <Input
                                type="tel"
                                placeholder="9112345678"
                                className="h-10 bg-transparent border-none focus-visible:ring-0 px-0 font-mono text-sm w-full min-w-0"
                                value={formData.whatsappNumber}
                                onChange={e => {
                                    let val = e.target.value.replace(/\D/g, '')
                                    if (val.startsWith('54')) val = val.slice(2)
                                    setFormData({ ...formData, whatsappNumber: val })
                                }}
                            />
                        </div>
                        {waFormatted && (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1.5 animate-in fade-in">
                                ✓ Pedidos al {waFormatted}
                            </p>
                        )}
                    </div>
                )}

                <div className="border-t border-zinc-100 dark:border-zinc-800 my-1" />

                <ToggleRow
                    icon={Printer}
                    iconBg="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                    title="Comandera automática"
                    description="Imprime el ticket en cocina (requiere app escritorio)."
                    checked={formData.notifyPrinter}
                    onCheckedChange={checked => setFormData({ ...formData, notifyPrinter: checked })}
                />

                {!(formData.notifyWhatsapp || formData.notifyPrinter) && (
                    <p className="text-xs text-center text-amber-600 dark:text-amber-400 pt-2 animate-in fade-in">
                        Seleccioná al menos un método para continuar.
                    </p>
                )}
            </div>
        )
    }

    const renderStep3 = () => {
        const agregarTurno = () => {
            setFormData({ ...formData, turnos: [...formData.turnos, { horaApertura: '09:00', horaCierre: '18:00' }] })
        }
        const actualizarTurno = (idx: number, field: string, value: string) => {
            const newTurnos = [...formData.turnos]
            newTurnos[idx] = { ...newTurnos[idx], [field]: value }
            setFormData({ ...formData, turnos: newTurnos })
        }
        const eliminarTurno = (idx: number) => {
            setFormData({ ...formData, turnos: formData.turnos.filter((_: any, i: number) => i !== idx) })
        }

        const deliveryNum = parseInt(formData.deliveryPrice) || 0
        const isGratis = deliveryNum === 0

        return (
            <div className="space-y-6">
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label className={labelClass + " mb-0"}>Horarios de atención</Label>
                        <Button type="button" variant="ghost" size="sm" onClick={agregarTurno} className="text-[#FF7A00] h-7 text-xs px-2">
                            <Plus className="h-3 w-3 mr-1" /> Añadir turno
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground -mt-1">Se aplica igual para todos los días de la semana.</p>
                    <div className="space-y-2 mt-2">
                        {formData.turnos.map((turno: any, index: number) => (
                            <div key={index} className="flex items-center gap-2">
                                <Input
                                    type="time"
                                    value={turno.horaApertura}
                                    onChange={(e) => actualizarTurno(index, 'horaApertura', e.target.value)}
                                    className={inputClass}
                                />
                                <span className="text-muted-foreground text-sm shrink-0">a</span>
                                <Input
                                    type="time"
                                    value={turno.horaCierre}
                                    onChange={(e) => actualizarTurno(index, 'horaCierre', e.target.value)}
                                    className={inputClass}
                                />
                                <Button variant="ghost" size="icon" onClick={() => eliminarTurno(index)} className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 shrink-0 h-10 w-10">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                        {formData.turnos.length === 0 && (
                            <p className="text-xs text-muted-foreground bg-zinc-100 dark:bg-zinc-800 p-3 rounded-xl text-center">
                                Sin horarios. Podés agregar después.
                            </p>
                        )}
                    </div>
                </div>

                <div className="border-t border-zinc-100 dark:border-zinc-800 pt-5 space-y-1.5">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="deliveryPrice" className={labelClass + " mb-0"}>Costo de envío</Label>
                        {isGratis && (
                            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full animate-in fade-in">
                                Gratis
                            </span>
                        )}
                    </div>
                    <div className="relative flex items-center overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800 focus-within:ring-2 focus-within:ring-[#FF7A00]/30 transition-all">
                        <span className="pl-4 pr-1 text-muted-foreground text-sm select-none">$</span>
                        <Input
                            id="deliveryPrice"
                            type="number"
                            placeholder="0"
                            className="h-10 bg-transparent border-none focus-visible:ring-0 px-1 text-sm w-full min-w-0"
                            value={formData.deliveryPrice}
                            onChange={e => setFormData({ ...formData, deliveryPrice: e.target.value })}
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">Podés crear zonas de reparto con precios distintos después.</p>
                </div>
            </div>
        )
    }

    const renderStep4 = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label className={labelClass}>Logo modo claro</Label>
                    <ImageUpload
                        onImageChange={(b64) => setFormData({ ...formData, imageLight: b64 })}
                        currentImage={formData.imageLight}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label className={labelClass}>Logo modo oscuro</Label>
                    <ImageUpload
                        onImageChange={(b64) => setFormData({ ...formData, imageDark: b64 })}
                        currentImage={formData.imageDark}
                    />
                </div>
            </div>
            {(formData.imageLight || formData.imageDark) && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 animate-in fade-in text-center">
                    ✓ Logo cargado — se verá en tu menú y pedidos
                </p>
            )}

            <div className="border-t border-zinc-100 dark:border-zinc-800 pt-5">
                <ToggleRow
                    icon={Users}
                    iconBg="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                    title="Pedido entre amigos"
                    description={formData.friendsOrdering
                        ? "Tus clientes pueden compartir el carrito con amigos."
                        : "Cada cliente ordena por separado."
                    }
                    checked={formData.friendsOrdering}
                    onCheckedChange={checked => setFormData({ ...formData, friendsOrdering: checked })}
                />
            </div>
        </div>
    )

    const renderStep5 = () => (
        <div className="space-y-5">
            <div>
                <p className="text-sm text-muted-foreground mb-3">¿Cómo querés cobrar los pedidos?</p>
                <div className="space-y-2">
                    <label className={cn(
                        "flex items-center gap-3 p-3.5 rounded-xl cursor-pointer transition-all border",
                        formData.verifyPayments === 'auto'
                            ? "border-[#FF7A00] bg-orange-50/60 dark:bg-orange-950/20"
                            : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                    )}>
                        <input type="radio" className="hidden" name="vp" checked={formData.verifyPayments === 'auto'} onChange={() => setFormData({ ...formData, verifyPayments: 'auto' })} />
                        <div className={cn("h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all",
                            formData.verifyPayments === 'auto' ? "border-[#FF7A00]" : "border-zinc-300 dark:border-zinc-600"
                        )}>
                            {formData.verifyPayments === 'auto' && <div className="h-2 w-2 rounded-full bg-[#FF7A00]" />}
                        </div>
                        <div>
                            <p className="text-sm font-semibold">Verificación automática</p>
                            <p className="text-xs text-muted-foreground">El pago se confirma solo — integrás con MercadoPago, Cucuru o Talo.</p>
                        </div>
                    </label>

                    <label className={cn(
                        "flex items-center gap-3 p-3.5 rounded-xl cursor-pointer transition-all border",
                        formData.verifyPayments === 'manual'
                            ? "border-[#FF7A00] bg-orange-50/60 dark:bg-orange-950/20"
                            : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                    )}>
                        <input type="radio" className="hidden" name="vp" checked={formData.verifyPayments === 'manual'} onChange={() => setFormData({ ...formData, verifyPayments: 'manual' })} />
                        <div className={cn("h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all",
                            formData.verifyPayments === 'manual' ? "border-[#FF7A00]" : "border-zinc-300 dark:border-zinc-600"
                        )}>
                            {formData.verifyPayments === 'manual' && <div className="h-2 w-2 rounded-full bg-[#FF7A00]" />}
                        </div>
                        <div>
                            <p className="text-sm font-semibold">Pagos manuales</p>
                            <p className="text-xs text-muted-foreground">Vos confirmás cada pago (transferencia, efectivo, etc.).</p>
                        </div>
                    </label>
                </div>
            </div>

            {formData.verifyPayments === 'auto' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                    <p className="text-xs font-medium text-muted-foreground">Seleccioná tu proveedor:</p>

                    <div className={cn(
                        "flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all",
                        formData.proveedorPago === 'mercadopago' ? "border-[#009EE3] bg-blue-50/40 dark:bg-blue-950/20" : "border-zinc-200 dark:border-zinc-800"
                    )} onClick={() => setFormData({ ...formData, proveedorPago: 'mercadopago' })}>
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 shrink-0 bg-[#009EE3] rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-[10px]">MP</span>
                            </div>
                            <div>
                                <p className="text-sm font-semibold">MercadoPago</p>
                                <p className="text-xs text-muted-foreground">Tarjetas y dinero en cuenta</p>
                            </div>
                        </div>
                        <Button
                            variant={formData.proveedorPago === 'mercadopago' ? 'default' : 'outline'}
                            size="sm"
                            className={cn("rounded-lg text-xs h-8", formData.proveedorPago === 'mercadopago' && "bg-[#009EE3] hover:bg-[#0081C4] text-white border-transparent")}
                            onClick={(e) => { e.stopPropagation(); handleConnectMP() }}
                        >
                            Conectar
                        </Button>
                    </div>

                    <div className={cn(
                        "flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all",
                        formData.proveedorPago === 'cucuru' ? "border-[#FF7A00] bg-orange-50/40 dark:bg-orange-950/20" : "border-zinc-200 dark:border-zinc-800"
                    )} onClick={() => setFormData({ ...formData, proveedorPago: 'cucuru' })}>
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 shrink-0 bg-zinc-800 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-[10px]">CQ</span>
                            </div>
                            <div>
                                <p className="text-sm font-semibold">Cucuru</p>
                                <p className="text-xs text-muted-foreground">Transferencias de bajo split</p>
                            </div>
                        </div>
                        <Button
                            variant={formData.proveedorPago === 'cucuru' ? 'default' : 'outline'}
                            size="sm"
                            className="rounded-lg text-xs h-8"
                            onClick={(e) => {
                                e.stopPropagation()
                                window.open('https://portalvendor.cucuru.com/registro', '_blank')
                                setFormData({ ...formData, proveedorPago: 'cucuru' })
                            }}
                        >
                            Registrarse
                        </Button>
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 opacity-50">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 shrink-0 bg-zinc-300 dark:bg-zinc-700 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-[10px]">TL</span>
                            </div>
                            <div>
                                <p className="text-sm font-semibold">Talo</p>
                                <p className="text-xs text-muted-foreground">Próximamente</p>
                            </div>
                        </div>
                        <Button disabled variant="outline" size="sm" className="rounded-lg text-xs h-8">Registrarse</Button>
                    </div>
                </div>
            )}

            {formData.verifyPayments === 'manual' && (
                <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Métodos de pago aceptados:</p>

                    <ToggleRow
                        icon={ArrowDownToLine}
                        iconBg="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                        title="Transferencia manual"
                        description="Mostrás tu CVU/Alias y el cliente te avisa."
                        checked={formData.metodosPago.transferenciaManual}
                        onCheckedChange={(c) => setFormData({ ...formData, metodosPago: { ...formData.metodosPago, transferenciaManual: c } })}
                    />
                    <div className="border-t border-zinc-100 dark:border-zinc-800" />
                    <ToggleRow
                        icon={Banknote}
                        iconBg="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                        title="Efectivo"
                        description="Cobrás al entregar el pedido."
                        checked={formData.metodosPago.efectivo}
                        onCheckedChange={(c) => setFormData({ ...formData, metodosPago: { ...formData.metodosPago, efectivo: c } })}
                    />
                </div>
            )}
        </div>
    )

    const renderStepContent = () => {
        switch (currentStep) {
            case 1: return renderStep1()
            case 2: return renderStep2()
            case 3: return renderStep3()
            case 4: return renderStep4()
            case 5: return renderStep5()
            default: return null
        }
    }

    const stepInfo = STEPS[currentStep - 1]
    const isLastStep = currentStep === STEPS.length

    const isNextDisabled = () => {
        if (currentStep === 1) return !usernameOk(formData.username)
        if (currentStep === 2) return !(formData.notifyWhatsapp || formData.notifyPrinter)
        return false
    }

    return (
        <div className="min-h-dvh bg-background sm:bg-zinc-50 sm:dark:bg-background flex flex-col items-center sm:p-8 selection:bg-orange-500/10 selection:text-[#FF7A00]">

            {/* HEADER MOBILE */}
            <div className="w-full sm:hidden bg-background sticky top-0 z-50 px-4 pt-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex justify-between items-center mb-3">
                    <img src="/logopiru.jpeg" alt="Piru Logo" className="h-7 w-auto" />
                    <span className="text-xs font-semibold text-[#FF7A00] bg-orange-50 dark:bg-orange-950/30 px-3 py-1 rounded-full">
                        Paso {currentStep} de {STEPS.length}
                    </span>
                </div>
                <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-[#FF7A00] transition-all duration-500 ease-out rounded-full"
                        style={{ width: `${(currentStep / STEPS.length) * 100}%` }}
                    />
                </div>
            </div>

            {/* HEADER DESKTOP */}
            <header className="hidden sm:flex w-full max-w-4xl flex-col items-center gap-8 mb-10 mt-4">
                <img src="/logopiru.jpeg" alt="Piru Logo" className="h-10 w-auto" />
                <div className="w-full flex items-center justify-between gap-1 px-2 relative">
                    <div className="absolute top-1/2 left-0 w-full h-1 bg-zinc-200 dark:bg-zinc-800 -translate-y-1/2 z-0 rounded-full" />
                    <div
                        className="absolute top-1/2 left-0 h-1 bg-[#FF7A00] -translate-y-1/2 z-0 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
                    />
                    {STEPS.map((step) => {
                        const Icon = step.icon
                        const isCompleted = currentStep > step.id
                        const isActive = currentStep === step.id
                        return (
                            <div key={step.id} className="flex flex-col items-center gap-2.5 z-10 relative">
                                <div className={cn(
                                    "h-12 w-12 rounded-full flex items-center justify-center border-4 transition-all duration-300 bg-background",
                                    isCompleted ? "border-[#FF7A00] text-[#FF7A00]" :
                                        isActive ? "border-[#FF7A00] text-[#FF7A00] scale-110 shadow-lg shadow-orange-500/20" :
                                            "border-zinc-200 dark:border-zinc-800 text-muted-foreground"
                                )}>
                                    {isCompleted ? <CheckCircle2 className="h-6 w-6" /> : <Icon className="h-5 w-5" />}
                                </div>
                                <span className={cn(
                                    "text-xs font-semibold hidden md:block absolute -bottom-6 w-max text-center",
                                    isActive || isCompleted ? "text-foreground" : "text-muted-foreground"
                                )}>
                                    {step.name}
                                </span>
                            </div>
                        )
                    })}
                </div>
            </header>

            {/* MAIN CONTAINER */}
            <main className="w-full flex-1 flex flex-col items-center justify-start sm:justify-center px-4 py-6 sm:p-0">
                <div className={cn(
                    "w-full max-w-2xl flex flex-col h-full sm:h-auto animate-in fade-in slide-in-from-bottom-4 duration-500",
                    "sm:bg-white sm:dark:bg-zinc-950 sm:p-10 sm:rounded-[32px] sm:shadow-2xl sm:shadow-zinc-200/40 sm:dark:shadow-none sm:border border-zinc-100 dark:border-zinc-800"
                )}>

                    <div className="flex flex-row items-center gap-3 sm:gap-4 mb-5">
                        {currentStep > 1 && (
                            <Button variant="ghost" size="icon" onClick={handleBack} className="rounded-full shadow-sm border border-zinc-200 dark:border-zinc-800 shrink-0">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        )}
                        <div className="flex flex-col">
                            {!stepInfo.required && (
                                <span className="inline-block bg-zinc-100 dark:bg-zinc-900 text-muted-foreground px-3 py-1 rounded-full text-[10px] font-medium w-fit mb-1">
                                    Paso opcional
                                </span>
                            )}
                            <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                                {stepInfo.name}
                            </h1>
                        </div>
                    </div>

                    <div className="flex-1 sm:flex-none mt-1 sm:mt-2">
                        {renderStepContent()}
                    </div>

                    <footer className="mt-10 sm:mt-12 pt-6 sm:pt-8 sm:border-t border-zinc-100 dark:border-zinc-800 flex flex-col-reverse sm:flex-row items-center justify-between gap-3 sm:gap-4 pb-4 sm:pb-0">
                        <div className="w-full sm:w-auto">
                            {!stepInfo.required && (
                                <Button variant="ghost" onClick={handleSkip} disabled={submitting} className="w-full sm:w-auto text-muted-foreground hover:text-foreground rounded-xl h-10 px-6 text-sm font-medium">
                                    Saltar paso
                                </Button>
                            )}
                        </div>

                        <Button
                            onClick={handleNext}
                            disabled={isNextDisabled() || submitting}
                            className="w-full sm:w-auto h-11 rounded-xl text-base font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98] sm:min-w-[160px]"
                        >
                            {submitting ? 'Guardando...' : (isLastStep ? '¡Terminar!' : 'Continuar')}
                            {(!isLastStep && !submitting) && <ArrowRight className="ml-2 h-4 w-4" />}
                            {(isLastStep && !submitting) && <CheckCircle2 className="ml-2 h-4 w-4" />}
                        </Button>
                    </footer>
                </div>
            </main>
        </div>
    )
}

export default Onboarding
