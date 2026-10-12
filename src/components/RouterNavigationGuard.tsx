import { useEffect, useRef, type RefObject } from 'react'
import { useBlocker } from 'react-router-dom'
import type { NavigationBlock } from './navigationSafety'
import { UnsavedChangesDialog } from './UnsavedChangesDialog'

export function RouterNavigationGuard({
  blockers,
  owner,
}: {
  blockers: RefObject<Map<symbol, NavigationBlock>>
  owner: string
}) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      blockers.current.size > 0 &&
      !(
        currentLocation.pathname === '/weigh-ins' &&
        nextLocation.pathname === '/weigh-ins'
      ) &&
      `${currentLocation.pathname}${currentLocation.search}${currentLocation.hash}` !==
        `${nextLocation.pathname}${nextLocation.search}${nextLocation.hash}`,
  )
  const previousOwner = useRef(owner)
  useEffect(() => {
    if (previousOwner.current !== owner && blocker.state === 'blocked')
      blocker.reset()
    previousOwner.current = owner
  }, [owner, blocker])
  if (blocker.state !== 'blocked') return null
  return (
    <UnsavedChangesDialog
      saving={[...blockers.current.values()].includes('saving')}
      onStay={() => blocker.reset()}
      onDiscard={() => blocker.proceed()}
    />
  )
}
