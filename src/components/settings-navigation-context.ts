import { createContext, useContext } from 'react'

interface Navigation {
  host: HTMLDivElement | null
  active: string | undefined
  register: (id: string) => () => void
}

export const SettingsNavigationContext = createContext<Navigation | null>(null)
export const useSettingsNavigation = () => useContext(SettingsNavigationContext)

export function resetSettingsScroll(element: HTMLElement) {
  let parent: HTMLElement | null = element
  while (parent) {
    parent.scrollTop = 0
    parent = parent.parentElement
  }
}
