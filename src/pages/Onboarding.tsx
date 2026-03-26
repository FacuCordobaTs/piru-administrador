import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ArrowRight, CheckCircle2, User, MapPin, Phone, MessageSquare, Printer, Clock, Bike, Palette, CreditCard } from 'lucide-react'
import { cn } from '@/lib/utils'

// Definición de los pasos del onboarding
const STEPS = [
    { id: 1, name: 'Info Principal', icon: User, required: true },
    { id: 2, name: 'Notificaciones', icon: MessageSquare, required: true },
    { id: 3, name: 'Configuración', icon: Clock, required: false },
    { id: 4, name: 'Personalización', icon: Palette, required: false },
    { id: 5, name: 'Pagos', icon: CreditCard, required: true },
]

// Estilos compartidos estilo "Phantom"
const phantomInputClass = "h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border-transparent focus:bg-background focus:border-[#FF7A00] transition-all text-base px-5 w-full"
const phantomLabelClass = "text-sm font-medium text-muted-foreground ml-1"

const OnboardingMockup = () => {
    const navigate = useNavigate()

    const [currentStep, setCurrentStep] = useState(() => {
        const savedStep = localStorage.getItem('piru_onboarding_step')
        return savedStep ? parseInt(savedStep, 10) : 1
    })

    const [formData, setFormData] = useState({
        restauranteName: '',
        username: '',
        address: '',
        phone: '',
        notifyWhatsapp: false,
        notifyPrinter: false,
        deliveryPrice: '0',
        friendsOrdering: true,
    })

    useEffect(() => {
        localStorage.setItem('piru_onboarding_step', currentStep.toString())
    }, [currentStep])

    const handleNext = () => {
        if (currentStep < STEPS.length) {
            setCurrentStep(prev => prev + 1)
            window.scrollTo({ top: 0, behavior: 'smooth' })
        } else {
            localStorage.removeItem('piru_onboarding_step')
            navigate('/dashboard')
        }
    }

    const handleSkip = () => {
        if (!STEPS[currentStep - 1].required) {
            handleNext()
        }
    }

    // --- Renderizado de Pasos ---

    const renderStep1 = () => (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="restauranteName" className={phantomLabelClass}>Nombre de tu local</Label>
                <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input id="restauranteName" placeholder="Ej: Burger Brothers" className={cn(phantomInputClass, "pl-12")} value={formData.restauranteName} onChange={e => setFormData({ ...formData, restauranteName: e.target.value })} />
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="username" className={phantomLabelClass}>Tu link único (username)</Label>
                <div className="relative flex items-center overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-900 focus-within:ring-2 focus-within:ring-[#FF7A00] focus-within:bg-background transition-all">
                    <span className="pl-5 pr-1 text-muted-foreground font-mono text-sm sm:text-base select-none">piru.app/</span>
                    <Input id="username" placeholder="burgerbros" className="h-14 bg-transparent border-none focus-visible:ring-0 px-0 font-mono text-base w-full min-w-0" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} />
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="phone" className={phantomLabelClass}>Teléfono de contacto</Label>
                    <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input id="phone" type="tel" placeholder="+54 9..." className={cn(phantomInputClass, "pl-12")} value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="address" className={phantomLabelClass}>Dirección (para Takeaway)</Label>
                    <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input id="address" placeholder="Av. Siempreviva 742" className={cn(phantomInputClass, "pl-12")} value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                    </div>
                </div>
            </div>
        </div>
    )

    const renderStep2 = () => {
        const canContinue = formData.notifyWhatsapp || formData.notifyPrinter;
        return (
            <div className="space-y-6 sm:space-y-8">
                <p className="text-muted-foreground text-center max-w-sm mx-auto text-sm sm:text-base">¿Cómo quieres enterarte cuando entra un pedido pagado?</p>

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
                            <span className="text-xs sm:text-sm text-muted-foreground">Recibí el pedido y link de despacho directo en tu chat.</span>
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

                {!canContinue && (
                    <p className="text-xs text-center text-red-500 font-medium animate-in fade-in">Debes seleccionar al menos un método.</p>
                )}
            </div>
        )
    }

    const renderStep3 = () => (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label className={phantomLabelClass}>Horarios de atención (Hoy)</Label>
                <div className="flex items-center gap-2 sm:gap-4">
                    <div className="relative flex-1">
                        <Clock className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                        <Input type="time" defaultValue="19:00" className={cn(phantomInputClass, "pl-9 sm:pl-12 text-sm sm:text-base")} />
                    </div>
                    <span className="text-muted-foreground text-sm">a</span>
                    <div className="relative flex-1">
                        <Clock className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                        <Input type="time" defaultValue="23:30" className={cn(phantomInputClass, "pl-9 sm:pl-12 text-sm sm:text-base")} />
                    </div>
                </div>
                <p className="text-xs text-muted-foreground ml-1">Podrás configurar el resto de los días en tu panel.</p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="deliveryPrice" className={phantomLabelClass}>Costo de envío fijo ($)</Label>
                <div className="relative">
                    <Bike className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input id="deliveryPrice" type="number" placeholder="0 (Gratis)" className={cn(phantomInputClass, "pl-12")} value={formData.deliveryPrice} onChange={e => setFormData({ ...formData, deliveryPrice: e.target.value })} />
                </div>
                <p className="text-xs text-muted-foreground ml-1">Luego podrás dibujar áreas de reparto.</p>
            </div>
        </div>
    )

    const renderStep4 = () => (
        <div className="space-y-6 sm:space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-2 sm:space-y-3">
                    <Label className={phantomLabelClass}>Tu Logo (Modo Claro)</Label>
                    <div className="border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl h-24 sm:h-32 flex flex-col items-center justify-center gap-2 bg-muted/20 hover:border-zinc-300 active:bg-muted/40 cursor-pointer transition-colors">
                        <Palette className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">Subir PNG/JPG</span>
                    </div>
                </div>
                <div className="space-y-2 sm:space-y-3">
                    <Label className={phantomLabelClass}>Tu Logo (Modo Oscuro)</Label>
                    <div className="border-2 border-dashed border-zinc-700 rounded-2xl h-24 sm:h-32 flex flex-col items-center justify-center gap-2 bg-zinc-900/50 hover:border-zinc-500 active:bg-zinc-800 cursor-pointer transition-colors">
                        <Palette className="h-6 w-6 sm:h-8 sm:w-8 text-zinc-500" />
                        <span className="text-xs font-medium text-zinc-500">Subir PNG/JPG</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between p-5 sm:p-6 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <div className="pr-4">
                    <Label htmlFor="friendsOrdering" className="font-semibold text-sm sm:text-base block mb-1">Pedido entre amigos</Label>
                    <span className="text-xs sm:text-sm text-muted-foreground leading-tight block">Permitir que compartan el link del carrito.</span>
                </div>
                <Switch id="friendsOrdering" checked={formData.friendsOrdering} onCheckedChange={checked => setFormData({ ...formData, friendsOrdering: checked })} />
            </div>
        </div>
    )

    const renderStep5 = () => (
        <div className="space-y-6 sm:space-y-8">
            <p className="text-muted-foreground text-center max-w-sm mx-auto text-sm sm:text-base">Activá al menos un método de pago.</p>

            <div className="space-y-3 sm:space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 sm:p-6 gap-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-[#FF7A00]/50 transition-colors">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <div className="h-10 w-10 shrink-0 bg-[#009EE3] rounded-full flex items-center justify-center">
                            <span className="text-white font-bold text-xs">MP</span>
                        </div>
                        <div>
                            <span className="font-semibold text-base sm:text-lg block">MercadoPago</span>
                            <span className="text-xs sm:text-sm text-muted-foreground">Checkout Pro o Tarjetas.</span>
                        </div>
                    </div>
                    <Button variant="outline" className="rounded-xl h-10 w-full sm:w-auto">Conectar</Button>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 sm:p-6 gap-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 opacity-60">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <div className="h-10 w-10 shrink-0 bg-zinc-200 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                            <CreditCard className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                            <span className="font-semibold text-base sm:text-lg block">Cucuru / Talo</span>
                            <span className="text-xs sm:text-sm text-muted-foreground">Alias dinámicos. Próximamente.</span>
                        </div>
                    </div>
                    <Button variant="ghost" className="rounded-xl h-10 w-full sm:w-auto bg-zinc-100 dark:bg-zinc-800" disabled>Configurar</Button>
                </div>

                <div className="flex items-center justify-between p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-[#FF7A00]/50 transition-colors">
                    <div className="flex items-center gap-3 sm:gap-4 pr-4">
                        <div className="h-10 w-10 shrink-0 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <span className="font-semibold text-base sm:text-lg block">Transferencia</span>
                            <span className="text-xs sm:text-sm text-muted-foreground">Mostrá tu CBU/Alias.</span>
                        </div>
                    </div>
                    <Switch defaultChecked />
                </div>
            </div>
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
        if (currentStep === 2) return !(formData.notifyWhatsapp || formData.notifyPrinter)
        return false
    }

    return (
        <div className="min-h-dvh bg-background sm:bg-zinc-50 sm:dark:bg-background flex flex-col items-center sm:p-8 selection:bg-orange-500/10 selection:text-[#FF7A00]">

            {/* HEADER MOBILE: Barra de progreso superior compacta */}
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

            {/* HEADER DESKTOP: Stepper completo con iconos */}
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

            {/* MAIN CONTAINER: Full screen en móvil, Card en Desktop */}
            <main className="w-full flex-1 flex flex-col items-center justify-start sm:justify-center px-4 py-6 sm:p-0">
                <div className={cn(
                    "w-full max-w-2xl flex flex-col h-full sm:h-auto animate-in fade-in slide-in-from-bottom-4 duration-500",
                    "sm:bg-white sm:dark:bg-zinc-950 sm:p-10 sm:rounded-[32px] sm:shadow-2xl sm:shadow-zinc-200/40 sm:dark:shadow-none sm:border border-zinc-100 dark:border-zinc-800"
                )}>

                    <div className="text-left sm:text-center mb-8 sm:mb-10 space-y-1.5 sm:space-y-2 mt-2 sm:mt-0">
                        {!stepInfo.required && (
                            <span className="inline-block bg-zinc-100 dark:bg-zinc-900 text-muted-foreground px-3 py-1 rounded-full text-xs font-medium mb-2">
                                Paso Opcional
                            </span>
                        )}
                        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                            {stepInfo.name}
                        </h1>
                    </div>

                    <div className="flex-1 sm:flex-none">
                        {renderStepContent()}
                    </div>

                    {/* FOOTER ACTIONS: Sticky en móvil, normales en Desktop */}
                    <footer className="mt-10 sm:mt-12 pt-6 sm:pt-8 sm:border-t border-zinc-100 dark:border-zinc-800 flex flex-col-reverse sm:flex-row items-center justify-between gap-3 sm:gap-4 pb-4 sm:pb-0">
                        <div className="w-full sm:w-auto">
                            {!stepInfo.required && (
                                <Button variant="ghost" onClick={handleSkip} className="w-full sm:w-auto text-muted-foreground hover:text-foreground rounded-xl h-14 sm:h-12 px-6 font-medium">
                                    Saltar paso
                                </Button>
                            )}
                        </div>

                        <Button
                            onClick={handleNext}
                            disabled={isNextDisabled()}
                            className="w-full sm:w-auto h-14 rounded-xl text-lg font-semibold bg-[#FF7A00] hover:bg-[#E66E00] text-white shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98] sm:min-w-[180px]"
                        >
                            {isLastStep ? '¡Terminar!' : 'Continuar'}
                            {!isLastStep && <ArrowRight className="ml-2 h-5 w-5" />}
                            {isLastStep && <CheckCircle2 className="ml-2 h-5 w-5" />}
                        </Button>
                    </footer>

                </div>
            </main>
        </div>
    )
}

export default OnboardingMockup