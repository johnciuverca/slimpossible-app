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
