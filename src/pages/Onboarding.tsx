import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { 
  ArrowRight, CheckCircle2, User, MapPin, Phone, 
  MessageSquare, Printer, Clock, Bike, Palette, 
  CreditCard, Plus, Trash2, ArrowLeft 
} from 'lucide-react'
import { cn } from '@/lib/utils'
import ImageUpload from '@/components/ImageUpload'
import { toast } from 'sonner'
import { onboardingApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useRestauranteStore } from '@/store/restauranteStore'

// Configuración de MercadoPago
const MP_APP_ID = 38638191854826 // Hardcoded temporal o desde env
const MP_REDIRECT_URI = import.meta.env.VITE_MP_REDIRECT_URI || 'https://api.piru.app/api/mp/callback'

const STEPS = [
    { id: 1, name: 'Info Principal', icon: User, required: true },
    { id: 2, name: 'Notificaciones', icon: MessageSquare, required: true },
    { id: 3, name: 'Configuración', icon: Clock, required: false },
    { id: 4, name: 'Personalización', icon: Palette, required: false },
    { id: 5, name: 'Pagos', icon: CreditCard, required: true },
]

const phantomInputClass = "h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border-transparent focus:bg-background focus:border-[#FF7A00] transition-all text-base px-5 w-full"
const phantomLabelClass = "text-sm font-medium text-muted-foreground ml-1"

const Onboarding = () => {
    const navigate = useNavigate()
    const { token } = useAuthStore()
    const restauranteStore = useRestauranteStore()
    const restaurante = restauranteStore.restaurante as any

    const [currentStep, setCurrentStep] = useState(1)
    const [submitting, setSubmitting] = useState(false)

    // Estado principal
    const [formData, setFormData] = useState(() => {
        const saved = localStorage.getItem('piru_onboarding_data')
        return saved ? JSON.parse(saved) : {
            username: restaurante?.username || '',
            address: restaurante?.direccion || '',
            phone: restaurante?.telefono || '',
            notifyWhatsapp: restaurante?.whatsappEnabled || false,
            whatsappNumber: restaurante?.whatsappNumber || '',
            notifyPrinter: false,
            turnos: [{ horaApertura: '19:00', horaCierre: '23:30' }],
            deliveryPrice: restaurante?.deliveryFee || '0',
            friendsOrdering: restaurante?.orderGroupEnabled ?? true,
            imageLight: null,
            imageDark: null,
            verifyPayments: 'manual', // 'auto' o 'manual'
            proveedorPago: restaurante?.proveedorPago || 'manual', // 'cucuru', 'mercadopago', 'manual', 'talo'
            metodosPago: {
                transferenciaManual: true,
                efectivo: true
            }
        }
    })

    // MP Auth redirect check
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search)
        const mpStatus = urlParams.get('mp_status')
        const mpError = urlParams.get('mp_error')

        if (mpStatus === 'success') {
            toast.success('¡MercadoPago conectado!')
            setFormData((prev: any) => ({ ...prev, verifyPayments: 'auto', proveedorPago: 'mercadopago' }))
            setCurrentStep(5)
            // Restore local storage if it existed
            const saved = localStorage.getItem('piru_onboarding_data')
            if (saved) {
              setFormData((prev: any) => ({ ...prev, ...JSON.parse(saved), verifyPayments: 'auto', proveedorPago: 'mercadopago' }))
            }
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
        if (!STEPS[currentStep - 1].required) {
            handleNext()
        }
    }

    const handleFinish = async () => {
        if (!token) return
        setSubmitting(true)

        // Limpieza de datos
        // Si no eligen Whatsapp, limpiamos el numero
        let cleanedWhatsappNumber = formData.whatsappNumber
        if (formData.notifyWhatsapp && cleanedWhatsappNumber) {
            cleanedWhatsappNumber = cleanedWhatsappNumber.replace(/\D/g, '')
        }

        try {
            const dataToSubmit = {
                username: formData.username,
                phone: formData.phone,
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
                toast.success('¡Onboarding completado!', { description: 'Bienvenido a tu panel.' })
                await restauranteStore.fetchData()
                navigate('/dashboard')
            }
        } catch (error: any) {
            toast.error('Error al finalizar onboarding', { description: error.message || 'Intente nuevamente' })
        } finally {
            setSubmitting(false)
        }
    }

    // Mercado Pago Auth URL
    const handleConnectMP = () => {
        if (!MP_APP_ID || !restaurante?.id) return
        localStorage.setItem('piru_onboarding_data', JSON.stringify(formData))
        const state = `${restaurante.id}_onboarding`
        const url = `https://auth.mercadopago.com.ar/authorization?client_id=${MP_APP_ID}&response_type=code&platform_id=mp&state=${state}&redirect_uri=${encodeURIComponent(MP_REDIRECT_URI)}`
        window.location.href = url
    }

    // Renderizado de Pasos
    const renderStep1 = () => (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="username" className={phantomLabelClass}>Tu link único (username)</Label>
                <div className="relative flex items-center overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-900 focus-within:ring-2 focus-within:ring-[#FF7A00] focus-within:bg-background transition-all">
                    <span className="pl-5 pr-1 text-muted-foreground font-mono text-sm sm:text-base select-none">my.piru.app/</span>
                    <Input 
                      id="username" 
                      placeholder="burgerbros" 
                      className="h-14 bg-transparent border-none focus-visible:ring-0 px-0 font-mono text-base w-full min-w-0" 
                      value={formData.username} 
                      onChange={e => setFormData({ ...formData, username: e.target.value })} 
                    />
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="phone" className={phantomLabelClass}>Teléfono de contacto</Label>
                    <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input 
                          id="phone" 
                          type="tel" 
                          placeholder="Tu teléfono" 
                          className={cn(phantomInputClass, "pl-12")} 
                          value={formData.phone} 
                          onChange={e => setFormData({ ...formData, phone: e.target.value })} 
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="address" className={phantomLabelClass}>Dirección (para Takeaway)</Label>
                    <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input 
                          id="address" 
                          placeholder="Av. Siempreviva 742" 
                          className={cn(phantomInputClass, "pl-12")} 
                          value={formData.address} 
                          onChange={e => setFormData({ ...formData, address: e.target.value })} 
                        />
                    </div>
                </div>
            </div>
        </div>
    )

    const renderStep2 = () => {
        const canContinue = formData.notifyWhatsapp || formData.notifyPrinter;
        const showWhatsappNumber = formData.notifyWhatsapp && !formData.notifyPrinter;

        return (
            <div className="space-y-6 sm:space-y-8">
                <p className="text-muted-foreground text-center max-w-sm mx-auto text-sm sm:text-base">¿Cómo quieres enterarte cuando entra un pedido?</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <label className={cn(
                        "flex flex-col items-center justify-center gap-3 sm:gap-4 p-6 sm:p-8 rounded-[24px] sm:rounded-3xl border-2 cursor-pointer transition-all",
                        formData.notifyWhatsapp
                            ? "border-[#FF7A00] bg-orange-50 dark:bg-orange-950/20 shadow-lg shadow-orange-500/10"
                            : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-muted/30"
                    )}>
                        <div className="flex items-center gap-3 w-full justify-between sm:justify-center">
                            <div className="flex items-center gap-3">
                                <MessageSquare className={cn("h-6 w-6 sm:h-8 sm:w-8", formData.notifyWhatsapp ? "text-[#FF7A00]" : "text-muted-foreground")} />
                                <span className="font-semibold text-base sm:text-lg sm:hidden">WhatsApp Bot</span>
                            </div>
                            <Switch checked={formData.notifyWhatsapp} onCheckedChange={checked => setFormData({ ...formData, notifyWhatsapp: checked })} />
                        </div>
                        <div className="text-left sm:text-center w-full">
                            <span className="font-semibold text-lg hidden sm:block mb-1">WhatsApp Bot</span>
                            <span className="text-xs sm:text-sm text-muted-foreground">Recibí el pedido directo en tu chat.</span>
                        </div>
                    </label>

                    <label className={cn(
                        "flex flex-col items-center justify-center gap-3 sm:gap-4 p-6 sm:p-8 rounded-[24px] sm:rounded-3xl border-2 cursor-pointer transition-all",
                        formData.notifyPrinter
                            ? "border-[#FF7A00] bg-orange-50 dark:bg-orange-950/20 shadow-lg shadow-orange-500/10"
                            : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-muted/30"
                    )}>
                        <div className="flex items-center gap-3 w-full justify-between sm:justify-center">
                            <div className="flex items-center gap-3">
                                <Printer className={cn("h-6 w-6 sm:h-8 sm:w-8", formData.notifyPrinter ? "text-[#FF7A00]" : "text-muted-foreground")} />
                                <span className="font-semibold text-base sm:text-lg sm:hidden">Comandera</span>
                            </div>
                            <Switch checked={formData.notifyPrinter} onCheckedChange={checked => setFormData({ ...formData, notifyPrinter: checked })} />
                        </div>
                        <div className="text-left sm:text-center w-full">
                            <span className="font-semibold text-lg hidden sm:block mb-1">Comandera Automática</span>
                            <span className="text-xs sm:text-sm text-muted-foreground">Imprimí el ticket directo en cocina (requiere app escritorio).</span>
                        </div>
                    </label>
                </div>

                {showWhatsappNumber && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-4">
                        <Label htmlFor="waNumber" className={phantomLabelClass}>Número de WhatsApp para recibir notificaciones</Label>
                        <div className="relative flex items-center overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-900 focus-within:ring-2 focus-within:ring-[#FF7A00] focus-within:bg-background transition-all">
                            <span className="pl-5 pr-1 text-muted-foreground font-mono text-sm sm:text-base select-none">+54</span>
                            <Input 
                                id="waNumber" 
                                type="tel"
                                placeholder="9112345678" 
                                className="h-14 bg-transparent border-none focus-visible:ring-0 px-0 font-mono text-base w-full min-w-0" 
                                value={formData.whatsappNumber} 
                                onChange={e => {
                                    // Remover el +54 si lo ingresan repetido
                                    let val = e.target.value.replace(/\D/g, '')
                                    if(val.startsWith('54')) val = val.slice(2)
                                    setFormData({ ...formData, whatsappNumber: val })
                                }} 
                            />
                        </div>
                    </div>
                )}

                {!canContinue && (
                    <p className="text-xs text-center text-red-500 font-medium animate-in fade-in">Debes seleccionar al menos un método.</p>
                )}
            </div>
        )
    }

    const renderStep3 = () => {
        const agregarTurno = () => {
            setFormData({
                ...formData,
                turnos: [...formData.turnos, { horaApertura: '09:00', horaCierre: '18:00' }]
            })
        }
        const actualizarTurno = (idx: number, field: string, value: string) => {
            const newTurnos = [...formData.turnos]
            newTurnos[idx] = { ...newTurnos[idx], [field]: value }
            setFormData({ ...formData, turnos: newTurnos })
        }
        const eliminarTurno = (idx: number) => {
            setFormData({
                ...formData,
                turnos: formData.turnos.filter((_: any, i: number) => i !== idx)
            })
        }

        return (
          <div className="space-y-6">
              <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className={phantomLabelClass}>Horarios de atención (Se configurará para toda la semana)</Label>
                    <Button type="button" variant="ghost" size="sm" onClick={agregarTurno} className="text-[#FF7A00]">
                        <Plus className="h-4 w-4 mr-1" /> Añadir
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {formData.turnos.map((turno: any, index: number) => (
                        <div key={index} className="flex items-center gap-2 sm:gap-4">
                            <div className="relative flex-1">
                                <Clock className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                                <Input 
                                    type="time" 
                                    value={turno.horaApertura} 
                                    onChange={(e) => actualizarTurno(index, 'horaApertura', e.target.value)}
                                    className={cn(phantomInputClass, "pl-9 sm:pl-12 text-sm sm:text-base")} 
                                />
                            </div>
                            <span className="text-muted-foreground text-sm">a</span>
                            <div className="relative flex-1">
                                <Clock className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                                <Input 
                                    type="time" 
                                    value={turno.horaCierre} 
                                    onChange={(e) => actualizarTurno(index, 'horaCierre', e.target.value)}
                                    className={cn(phantomInputClass, "pl-9 sm:pl-12 text-sm sm:text-base")} 
                                />
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => eliminarTurno(index)} className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 shrink-0">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                    {formData.turnos.length === 0 && (
                        <p className="text-xs text-muted-foreground bg-muted p-4 rounded-xl text-center">Sin horarios configurados.</p>
                    )}
                  </div>
              </div>

              <div className="space-y-2">
                  <Label htmlFor="deliveryPrice" className={phantomLabelClass}>Costo de envío fijo ($)</Label>
                  <div className="relative">
                      <Bike className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input 
                        id="deliveryPrice" 
                        type="number" 
                        placeholder="0 (Gratis)" 
                        className={cn(phantomInputClass, "pl-12")} 
                        value={formData.deliveryPrice} 
                        onChange={e => setFormData({ ...formData, deliveryPrice: e.target.value })} 
                      />
                  </div>
                  <p className="text-xs text-muted-foreground ml-1">Luego podrás dibujar áreas de reparto específicas.</p>
              </div>
          </div>
      )
    }

    const renderStep4 = () => (
        <div className="space-y-6 sm:space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-2 sm:space-y-3">
                    <Label className={phantomLabelClass}>Tu Logo (Modo Claro)</Label>
                    <ImageUpload 
                        onImageChange={(b64) => setFormData({ ...formData, imageLight: b64 })}
                        currentImage={formData.imageLight}
                    />
                </div>
                <div className="space-y-2 sm:space-y-3">
                    <Label className={phantomLabelClass}>Tu Logo (Modo Oscuro)</Label>
                    <ImageUpload 
                        onImageChange={(b64) => setFormData({ ...formData, imageDark: b64 })}
                        currentImage={formData.imageDark}
                    />
                </div>
            </div>

            <div className="flex items-center justify-between p-5 sm:p-6 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <div className="pr-4">
                    <Label htmlFor="friendsOrdering" className="font-semibold text-sm sm:text-base block mb-1">Pedido entre amigos</Label>
                    <span className="text-xs sm:text-sm text-muted-foreground leading-tight block">Permitir que tus clientes compartan el carrito con amigos.</span>
                </div>
                <Switch 
                  id="friendsOrdering" 
                  checked={formData.friendsOrdering} 
                  onCheckedChange={checked => setFormData({ ...formData, friendsOrdering: checked })} 
                />
            </div>
        </div>
    )

    const renderStep5 = () => (
        <div className="space-y-6 sm:space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className={cn(
                    "flex flex-col items-center justify-center p-6 rounded-3xl border-2 cursor-pointer transition-all text-center",
                    formData.verifyPayments === 'auto'
                        ? "border-[#FF7A00] bg-orange-50 dark:bg-orange-950/20 shadow-lg shadow-orange-500/10"
                        : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 bg-white dark:bg-zinc-900/50"
                )}>
                    <input type="radio" className="hidden" name="vp" checked={formData.verifyPayments === 'auto'} onChange={() => setFormData({ ...formData, verifyPayments: 'auto' })} />
                    <CheckCircle2 className={cn("h-8 w-8 mb-2", formData.verifyPayments === 'auto' ? "text-[#FF7A00]" : "text-muted-foreground")} />
                    <span className="font-bold text-lg">Verificación Automática</span>
                    <span className="text-xs text-muted-foreground mt-2">Los pagos de pedidos te llegarán solo cuando ya estén pagados confirmados por el proveedor.</span>
                </label>
                <label className={cn(
                    "flex flex-col items-center justify-center p-6 rounded-3xl border-2 cursor-pointer transition-all text-center",
                    formData.verifyPayments === 'manual'
                        ? "border-[#FF7A00] bg-orange-50 dark:bg-orange-950/20 shadow-lg shadow-orange-500/10"
                        : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 bg-white dark:bg-zinc-900/50"
                )}>
                    <input type="radio" className="hidden" name="vp" checked={formData.verifyPayments === 'manual'} onChange={() => setFormData({ ...formData, verifyPayments: 'manual' })} />
                    <CreditCard className={cn("h-8 w-8 mb-2", formData.verifyPayments === 'manual' ? "text-[#FF7A00]" : "text-muted-foreground")} />
                    <span className="font-bold text-lg">Pagos Manuales</span>
                    <span className="text-xs text-muted-foreground mt-2">Deberás verificar manualmente (Cuentas, CVU, efectivo) si el pedido fue pagado.</span>
                </label>
            </div>

            {formData.verifyPayments === 'auto' && (
                <div className="space-y-3 sm:space-y-4 animate-in fade-in slide-in-from-top-2">
                    <p className="font-semibold text-sm">Selecciona tu proveedor:</p>
                    
                    <div className={cn(
                        "flex flex-col sm:flex-row sm:items-center justify-between p-5 gap-4 rounded-2xl border transition-colors cursor-pointer",
                        formData.proveedorPago === 'mercadopago' ? "border-[#009EE3] bg-blue-50/50 dark:bg-blue-950/20" : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                    )} onClick={() => setFormData({ ...formData, proveedorPago: 'mercadopago' })}>
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 shrink-0 bg-[#009EE3] rounded-full flex items-center justify-center">
                                <span className="text-white font-bold text-xs">MP</span>
                            </div>
                            <div>
                                <span className="font-semibold text-base sm:text-lg block">MercadoPago</span>
                                <span className="text-xs sm:text-sm text-muted-foreground">Tarjetas y Dinero en cuenta.</span>
                            </div>
                        </div>
                        <Button 
                          variant={formData.proveedorPago === 'mercadopago' ? 'default' : 'outline'} 
                          className={cn("rounded-xl", formData.proveedorPago === 'mercadopago' && "bg-[#009EE3] hover:bg-[#0081C4] text-white")}
                          onClick={(e) => {
                              e.stopPropagation();
                              handleConnectMP();
                          }}
                        >
                          Conectar
                        </Button>
                    </div>

                    <div className={cn(
                        "flex flex-col sm:flex-row sm:items-center justify-between p-5 gap-4 rounded-2xl border transition-colors cursor-pointer",
                        formData.proveedorPago === 'cucuru' ? "border-[#FF7A00] bg-orange-50/50 dark:bg-orange-950/20" : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                    )} onClick={() => setFormData({ ...formData, proveedorPago: 'cucuru' })}>
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 shrink-0 bg-zinc-800 rounded-full flex items-center justify-center">
                                <span className="text-white font-bold text-xs">CQ</span>
                            </div>
                            <div>
                                <span className="font-semibold text-base sm:text-lg block">Cucuru</span>
                                <span className="text-xs sm:text-sm text-muted-foreground">Transferencias de bajo split.</span>
                            </div>
                        </div>
                        <Button 
                          variant={formData.proveedorPago === 'cucuru' ? 'default' : 'outline'} 
                          className={cn("rounded-xl")}
                          onClick={(e) => {
                              e.stopPropagation();
                              window.open('https://portalvendor.cucuru.com/registro', '_blank')
                              setFormData({ ...formData, proveedorPago: 'cucuru' })
                          }}
                        >
                          Registrarse
                        </Button>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 gap-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 opacity-60">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 shrink-0 bg-zinc-300 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                                <span className="text-white font-bold text-xs">TL</span>
                            </div>
                            <div>
                                <span className="font-semibold text-base sm:text-lg block">Talo</span>
                                <span className="text-xs sm:text-sm text-muted-foreground">Próximamente.</span>
                            </div>
                        </div>
                        <Button disabled variant="outline" className="rounded-xl">Registrarse</Button>
                    </div>
                </div>
            )}

            {formData.verifyPayments === 'manual' && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center justify-between p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-center gap-3 sm:gap-4 pr-4">
                            <div className="h-10 w-10 shrink-0 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                                <MapPin className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                                <span className="font-semibold text-base sm:text-lg block">Transferencia Manual</span>
                                <span className="text-xs sm:text-sm text-muted-foreground">Muestras tu CVU/Alias y avisas.</span>
                            </div>
                        </div>
                        <Switch 
                          checked={formData.metodosPago.transferenciaManual}
                          onCheckedChange={(c) => setFormData({ ...formData, metodosPago: { ...formData.metodosPago, transferenciaManual: c } })} 
                        />
                    </div>
                    
                    <div className="flex items-center justify-between p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-center gap-3 sm:gap-4 pr-4">
                            <div className="h-10 w-10 shrink-0 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                                <CreditCard className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                                <span className="font-semibold text-base sm:text-lg block">Efectivo</span>
                                <span className="text-xs sm:text-sm text-muted-foreground">Cobro al entregar el pedido.</span>
                            </div>
                        </div>
                        <Switch 
                          checked={formData.metodosPago.efectivo}
                          onCheckedChange={(c) => setFormData({ ...formData, metodosPago: { ...formData.metodosPago, efectivo: c } })} 
                        />
                    </div>
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
        if (currentStep === 1) return !formData.username.trim()
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

                    <div className="flex flex-row items-center gap-3 sm:gap-4 mb-4">
                        {currentStep > 1 && (
                            <Button variant="ghost" size="icon" onClick={handleBack} className="rounded-full shadow-sm border border-zinc-200 dark:border-zinc-800 shrink-0">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        )}
                        <div className="flex flex-col">
                            {!stepInfo.required && (
                                <span className="inline-block bg-zinc-100 dark:bg-zinc-900 text-muted-foreground px-3 py-1 rounded-full text-[10px] font-medium w-fit mb-1">
                                    Paso Opcional
                                </span>
                            )}
                            <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                                {stepInfo.name}
                            </h1>
                        </div>
                    </div>

                    <div className="flex-1 sm:flex-none mt-2 sm:mt-4">
                        {renderStepContent()}
                    </div>

                    {/* FOOTER ACTIONS */}
                    <footer className="mt-10 sm:mt-12 pt-6 sm:pt-8 sm:border-t border-zinc-100 dark:border-zinc-800 flex flex-col-reverse sm:flex-row items-center justify-between gap-3 sm:gap-4 pb-4 sm:pb-0">
                        <div className="w-full sm:w-auto">
                            {!stepInfo.required && (
                                <Button variant="ghost" onClick={handleSkip} disabled={submitting} className="w-full sm:w-auto text-muted-foreground hover:text-foreground rounded-xl h-14 sm:h-12 px-6 font-medium">
                                    Saltar paso
                                </Button>
                            )}
                        </div>

                        <Button
                            onClick={handleNext}
                            disabled={isNextDisabled() || submitting}
                            className="w-full sm:w-auto h-14 rounded-xl text-lg font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98] sm:min-w-[180px]"
                        >
                            {submitting ? 'Guardando...' : (isLastStep ? '¡Terminar!' : 'Continuar')}
                            {(!isLastStep && !submitting) && <ArrowRight className="ml-2 h-5 w-5" />}
                            {(isLastStep && !submitting) && <CheckCircle2 className="ml-2 h-5 w-5" />}
                        </Button>
                    </footer>
                </div>
            </main>
        </div>
    )
}

export default Onboarding