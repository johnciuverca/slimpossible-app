import { useEffect, useState } from 'react'

const eventName = 'slimpossible:personal-weight-changed'
export function notifyPersonalWeightChange(userId: string) {
  window.dispatchEvent(new CustomEvent(eventName, { detail: userId }))
}
export function usePersonalWeightRevision(userId: string) {
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const refresh = (event: Event) => {
      if ((event as CustomEvent<string>).detail === userId)
        setRevision((value) => value + 1)
    }
    window.addEventListener(eventName, refresh)
    return () => window.removeEventListener(eventName, refresh)
  }, [userId])
  return revision
}
