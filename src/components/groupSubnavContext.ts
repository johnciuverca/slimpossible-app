import { createContext } from 'react'

// Undefined keeps page-only renders usable; null waits for the live shell slot.
export const GroupSubnavContext = createContext<HTMLElement | null | undefined>(
  undefined,
)
