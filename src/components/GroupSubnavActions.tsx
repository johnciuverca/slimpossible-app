import { useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { GroupSubnavContext } from './groupSubnavContext'

/** Keep the page's real action state while presenting it in the shared shell. */
export function GroupSubnavActions({ children }: { children: ReactNode }) {
  const target = useContext(GroupSubnavContext)
  if (target === undefined)
    return <div className="group-subnav-actions">{children}</div>
  return target ? createPortal(children, target) : null
}
