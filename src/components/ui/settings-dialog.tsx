import { createContext, useContext, useId, useState, type ComponentProps } from 'react'
import * as Modal from './dialog'
import * as Drawer from './sheet'
import { cn } from '@/lib/utils'
import { SettingsDetail } from '../SettingsNavigation'
import { useSettingsNavigation } from '../settings-navigation-context'

const DetailContext = createContext<{ open: boolean; close: () => void; titleId: string } | null>(null)

/** Opt-in adapter: shared components retain their modal behavior outside Settings. */
export function Dialog({ open, defaultOpen = false, onOpenChange, children, ...props }: ComponentProps<typeof Modal.Dialog>) {
  const navigation = useSettingsNavigation()
  const [localOpen, setLocalOpen] = useState(defaultOpen)
  const titleId = useId()
  const change = (value: boolean) => { setLocalOpen(value); onOpenChange?.(value) }
  if (!navigation) return <Modal.Dialog open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange} {...props}>{children}</Modal.Dialog>
  return <DetailContext.Provider value={{ open: open ?? localOpen, close: () => change(false), titleId }}>{children}</DetailContext.Provider>
}

export function DialogContent({ children, className, ...props }: ComponentProps<typeof Modal.DialogContent>) {
  const detail = useContext(DetailContext)
  if (!detail) return <Modal.DialogContent className={className} {...props}>{children}</Modal.DialogContent>
  if (!detail.open) return null
  return <SettingsDetail onBack={detail.close}>
    <div role="region" aria-labelledby={detail.titleId} className="grid min-w-0 gap-5">{children}</div>
  </SettingsDetail>
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof Modal.DialogTitle>) {
  const detail = useContext(DetailContext)
  return detail ? <h2 {...props} id={detail.titleId} className={cn('text-lg font-medium', className)} /> : <Modal.DialogTitle className={className} {...props} />
}

export function DialogDescription(props: ComponentProps<typeof Modal.DialogDescription>) {
  const detail = useContext(DetailContext)
  return detail ? <p {...props} className={cn('text-sm text-muted-foreground', props.className)} /> : <Modal.DialogDescription {...props} />
}

export function DialogHeader(props: ComponentProps<typeof Modal.DialogHeader>) {
  const detail = useContext(DetailContext)
  return detail ? <header {...props} className={cn('space-y-2 text-left', props.className)} /> : <Modal.DialogHeader {...props} />
}

export const DialogFooter = Modal.DialogFooter
export const Sheet = Dialog
export const SheetTitle = DialogTitle
export const SheetDescription = DialogDescription
export const SheetHeader = DialogHeader
export const SheetFooter = Drawer.SheetFooter

export function SheetContent({ children, ...props }: ComponentProps<typeof Drawer.SheetContent>) {
  const detail = useContext(DetailContext)
  if (!detail) return <Drawer.SheetContent {...props}>{children}</Drawer.SheetContent>
  if (!detail.open) return null
  return <SettingsDetail onBack={detail.close}>
    <div role="region" aria-labelledby={detail.titleId} className="flex min-w-0 flex-col gap-5">{children}</div>
  </SettingsDetail>
}
