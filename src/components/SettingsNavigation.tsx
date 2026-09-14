import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from './ui/button'
import { SettingsNavigationContext, resetSettingsScroll, useSettingsNavigation } from './settings-navigation-context'

/** One visible level, keeping its parents mounted for drafts and autosave. */
export function SettingsNavigation({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const [pages, setPages] = useState<string[]>([])
  const register = useCallback((id: string) => {
    setPages(current => [...current, id])
    return () => setPages(current => current.filter(page => page !== id))
  }, [])
  const value = useMemo(() => ({ host, active: pages.at(-1), register }), [host, pages, register])

  return <SettingsNavigationContext.Provider value={value}>
    <div hidden={pages.length > 0}>{children}</div>
    <div ref={setHost} />
  </SettingsNavigationContext.Provider>
}

/** Render in the section's viewport, never in a modal or a fixed overlay. */
export function SettingsDetail({ children, onBack }: { children: ReactNode; onBack: () => void }) {
  const navigation = useSettingsNavigation()
  const id = useId()
  const ref = useRef<HTMLElement>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const register = navigation?.register
  const active = navigation?.active === id

  useLayoutEffect(() => {
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    return register?.(id)
  }, [id, register])

  useLayoutEffect(() => {
    if (!active || !ref.current) return
    resetSettingsScroll(ref.current)
    ref.current.focus({ preventScroll: true })
  }, [active])

  useLayoutEffect(() => () => {
    requestAnimationFrame(() => {
      if (trigger.current?.isConnected) trigger.current.focus({ preventScroll: true })
    })
  }, [])

  const page = <section
    ref={ref}
    tabIndex={-1}
    hidden={navigation ? !active : false}
    data-settings-detail=""
    className="min-w-0 outline-none"
    onKeyDown={event => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.stopPropagation()
        onBack()
      }
    }}
  >
    <Button variant="ghost" onClick={onBack} className="mb-5 -ml-3 min-h-11 gap-2" aria-label="Volver a la pantalla anterior">
      <ArrowLeft className="size-4" />Volver
    </Button>
    {children}
  </section>

  return navigation ? navigation.host && createPortal(page, navigation.host) : page
}
