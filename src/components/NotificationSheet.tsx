import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
    Bell, BellOff, Volume2, VolumeX, Trash2,
    HandMetal, ChefHat, CreditCard, Plus, ShoppingCart, CheckCircle, XCircle
} from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Notification } from '@/hooks/useAdminWebSocket'

interface NotificationSheetProps {
    notifications: Notification[]
    unreadCount: number
    soundEnabled: boolean
    setSoundEnabled: (enabled: boolean) => void
    markAsRead: (id: string) => void
    deleteNotification: (id: string) => void
    clearNotifications: () => void
}

// Helper para obtener info de notificación (Copied from Dashboard)
const getNotificationInfo = (tipo: string) => {
    const tipos: Record<string, {
        icon: any
        label: string
        accentColor: string
        unreadBg: string
        bgColor: string
        color: string
        priority: 'urgent' | 'high' | 'normal' | 'low'
    }> = {
        LLAMADA_MOZO: {
            icon: HandMetal,
            label: '¡MOZO!',
            accentColor: 'bg-red-500',
            unreadBg: 'bg-red-500',
            bgColor: 'bg-red-100',
            color: 'text-red-500',
            priority: 'urgent'
        },
        PEDIDO_CONFIRMADO: {
            icon: ChefHat,
            label: 'Nuevo pedido',
            accentColor: 'bg-emerald-500',
            unreadBg: 'bg-emerald-600',
            bgColor: 'bg-emerald-100',
            color: 'text-emerald-500',
            priority: 'high'
        },
        PAGO_RECIBIDO: {
            icon: CreditCard,
            label: 'Pago',
            accentColor: 'bg-violet-500',
            unreadBg: 'bg-violet-600',
            bgColor: 'bg-violet-100',
            color: 'text-violet-500',
            priority: 'high'
        },
        PRODUCTO_AGREGADO: {
            icon: Plus,
            label: 'Producto',
            accentColor: 'bg-amber-500',
            unreadBg: 'bg-amber-500',
            bgColor: 'bg-amber-100',
            color: 'text-amber-500',
            priority: 'normal'
        },
        NUEVO_PEDIDO: {
            icon: ShoppingCart,
            label: 'Mesa activa',
            accentColor: 'bg-blue-500',
            unreadBg: 'bg-blue-600',
            bgColor: 'bg-blue-100',
            color: 'text-blue-500',
            priority: 'normal'
        },
        PEDIDO_CERRADO: {
            icon: CheckCircle,
            label: 'Cerrado',
            accentColor: 'bg-slate-400',
            unreadBg: 'bg-slate-500',
            bgColor: 'bg-slate-100',
            color: 'text-slate-500',
            priority: 'low'
        },
    }
    return tipos[tipo] || {
        icon: Bell,
        label: 'Info',
        accentColor: 'bg-slate-400',
        unreadBg: 'bg-slate-500',
        bgColor: 'bg-slate-100',
        color: 'text-slate-500',
        priority: 'low' as const
    }
}

export function NotificationSheet({
    notifications,
    unreadCount,
    soundEnabled,
    setSoundEnabled,
    markAsRead,
    deleteNotification,
    clearNotifications
}: NotificationSheetProps) {
    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="relative shrink-0">
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                        <Badge
                            variant="destructive"
                            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] rounded-full"
                        >
                            {unreadCount}
                        </Badge>
                    )}
                </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:w-[400px] p-0 flex flex-col">
                <SheetHeader className="p-4 border-b bg-muted/30">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Bell className="h-5 w-5" />
                            <SheetTitle>Notificaciones</SheetTitle>
                            {unreadCount > 0 && (
                                <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                                    {unreadCount}
                                </Badge>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setSoundEnabled(!soundEnabled)}
                                title={soundEnabled ? 'Silenciar' : 'Activar sonido'}
                            >
                                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                            </Button>
                            {notifications.length > 0 && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={clearNotifications}
                                    title="Limpiar"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                </SheetHeader>

                <ScrollArea className="flex-1">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                            <BellOff className="h-10 w-10 text-muted-foreground/50 mb-3" />
                            <p className="text-sm text-muted-foreground">Sin notificaciones</p>
                            <p className="text-xs text-muted-foreground/70 mt-1">
                                Aparecerán aquí cuando haya actividad
                            </p>
                        </div>
                    ) : (
                        <div className="p-2 space-y-1">
                            {notifications.map((notif) => {
                                const info = getNotificationInfo(notif.tipo)
                                const Icon = info.icon
                                const isUnread = !notif.leida
                                const isUrgent = info.priority === 'urgent' && isUnread

                                return (
                                    <div
                                        key={notif.id}
                                        className={`
                      relative group rounded-lg transition-all overflow-hidden p-3
                      ${isUnread
                                                ? `${info.unreadBg} text-white shadow-md ${isUrgent ? 'animate-pulse' : ''}`
                                                : 'bg-muted/50 hover:bg-muted'
                                            }
                    `}
                                    >
                                        <div className="flex gap-3">
                                            <div className={`
                        p-2 rounded-full shrink-0 h-fit
                        ${isUnread ? 'bg-white/20' : info.bgColor}
                      `}>
                                                <Icon className={`h-4 w-4 ${isUnread ? 'text-white' : info.color}`} />
                                            </div>

                                            <div className="flex-1 min-w-0 pr-6">
                                                <div className="flex items-center justify-between gap-2 mb-0.5">
                                                    <span className="font-semibold text-sm truncate">
                                                        {info.label}
                                                    </span>
                                                    <span className={`text-[10px] ${isUnread ? 'text-white/80' : 'text-muted-foreground'}`}>
                                                        {new Date(new Date(notif.timestamp).getTime() + 3 * 60 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>

                                                <p className={`text-sm font-medium leading-tight mb-1 ${isUnread ? 'text-white' : 'text-foreground'}`}>
                                                    {notif.mensaje}
                                                </p>

                                                {notif.detalles && (
                                                    <p className={`text-xs ${isUnread ? 'text-white/80' : 'text-muted-foreground'}`}>
                                                        {notif.detalles}
                                                    </p>
                                                )}

                                                {notif.mesaNombre && (
                                                    <div className={`mt-2 inline-flex py-0.5 px-1.5 rounded text-[10px] font-medium ${isUnread ? 'bg-white/20' : 'bg-background border'}`}>
                                                        {notif.mesaNombre}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Desktop: Botones que aparecen en hover */}
                                        <div className={`
                      absolute top-2 right-2 z-10 hidden md:flex flex-col gap-1 transition-opacity
                      opacity-0 group-hover:opacity-100
                    `}>
                                            {/* Marcar como leída - solo si no está leída */}
                                            {isUnread && (
                                                <button
                                                    className={`
                            p-1 rounded-full
                            bg-white/20 hover:bg-white/40 text-white
                          `}
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        markAsRead(notif.id)
                                                    }}
                                                    title="Marcar como leída"
                                                >
                                                    <CheckCircle className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                            {/* Eliminar */}
                                            <button
                                                className={`
                          p-1 rounded-full
                          ${isUnread
                                                        ? 'bg-white/20 hover:bg-white/40 text-white'
                                                        : 'hover:bg-destructive hover:text-white'
                                                    }
                        `}
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    deleteNotification(notif.id)
                                                }}
                                                title="Eliminar"
                                            >
                                                <XCircle className="h-3.5 w-3.5" />
                                            </button>
                                        </div>

                                        {/* Mobile: Dropdown menu */}
                                        <div className="absolute top-2 right-2 z-10 md:hidden">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button
                                                        className={`
                              p-1 rounded-full
                              ${isUnread
                                                                ? 'bg-white/20 text-white'
                                                                : 'text-muted-foreground'
                                                            }
                            `}
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <Bell className="h-3.5 w-3.5" />
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                                    {isUnread && (
                                                        <DropdownMenuItem
                                                            onClick={() => markAsRead(notif.id)}
                                                        >
                                                            <CheckCircle className="mr-2 h-4 w-4" />
                                                            Marcar como leída
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuItem
                                                        className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                                        onClick={() => deleteNotification(notif.id)}
                                                    >
                                                        <XCircle className="mr-2 h-4 w-4" />
                                                        Eliminar
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </ScrollArea>
            </SheetContent>
        </Sheet>
    )
}
