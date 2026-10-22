import type { KeyboardEvent } from 'react'

// Keep Tab at the modal's boundaries in the page, including browser-chrome edges.
export function trapDialogFocus(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== 'Tab') return
  const controls = [
    ...event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
    ),
  ].filter((element) => !element.hidden && element.getClientRects().length > 0)
  const first = controls[0]
  const last = controls.at(-1)
  if (!first || !last) return
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

/** A refreshed/deleted row may disappear. Return to the stable page action once ready. */
export function focusAfterWeightMutation(
  trigger: HTMLElement | null,
  changed: () => void = () => undefined,
) {
  const button = trigger
    ?.closest('main')
    ?.querySelector<HTMLButtonElement>('[data-weight-page-header] button')
  // Resolve the stable action before refresh can detach the originating row.
  changed()
  if (!button) {
    if (trigger?.isConnected) trigger.focus()
    return
  }
  const owner = button.dataset.weightOwner
  // Let React commit refresh/loading first; don't focus a temporarily disabled action.
  window.setTimeout(() => {
    const observer = new MutationObserver(ready)
    let sawLoading = false
    const timeout = window.setTimeout(() => observer.disconnect(), 5000)
    function ready() {
      if (!button!.isConnected || button!.dataset.weightOwner !== owner) {
        observer.disconnect()
        window.clearTimeout(timeout)
        return
      }
      if (button!.disabled) {
        sawLoading = true
      } else {
        button!.focus()
        // A passive-effect refresh can begin after the first enabled render.
        // Keep watching until that loading cycle has finished.
        if (sawLoading) {
          observer.disconnect()
          window.clearTimeout(timeout)
        }
      }
    }
    observer.observe(button, {
      attributes: true,
      attributeFilter: ['disabled', 'data-weight-owner'],
    })
    ready()
  }, 0)
}
