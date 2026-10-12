import { createContext, useContext, useLayoutEffect, useRef } from 'react'

export type NavigationBlock = 'dirty' | 'saving'
export const NavigationSafetyContext = createContext<{
  register: (token: symbol, state: NavigationBlock | null) => void
  unregister: (token: symbol) => void
} | null>(null)

export function useUnsavedNavigation(state: NavigationBlock | null) {
  const context = useContext(NavigationSafetyContext)
  const token = useRef(Symbol('editor'))
  useLayoutEffect(() => {
    const id = token.current
    context?.register(id, state)
    return () => context?.unregister(id)
  }, [context, state])
}
