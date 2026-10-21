import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Button } from './ui'

export function GroupActionsPopover({
  children,
  onOpen,
}: {
  children: ReactNode
  onOpen: () => void
}) {
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const trigger = () => root.current?.querySelector('button')
  const position = useCallback(() => {
    const button = trigger()
    const element = panel.current
    if (!button || !element) return
    const box = button.getBoundingClientRect()
    const width = Math.min(448, window.innerWidth - 32)
    const below = window.innerHeight - box.bottom - 24
    const above = box.top - 24
    const flip = below < 200 && above > below
    Object.assign(element.style, {
      width: `${width}px`,
      left: `${Math.max(16, Math.min(box.left, window.innerWidth - width - 16))}px`,
      top: flip ? 'auto' : `${box.bottom + 8}px`,
      bottom: flip ? `${window.innerHeight - box.top + 8}px` : 'auto',
      maxHeight: `${Math.max(0, flip ? above : below)}px`,
    })
  }, [])
  useEffect(() => {
    if (!open) return
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    return () => {
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
    }
  }, [open, position])
  function close() {
    panel.current?.hidePopover()
    trigger()?.focus()
  }
  return (
    <div ref={root} className="min-w-0">
      <Button
        variant="secondary"
        className="min-h-11"
        popoverTarget={id}
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="dialog"
      >
        Create or join a group
      </Button>
      <div
        id={id}
        ref={panel}
        popover="auto"
        role="dialog"
        aria-label="Create or join a group"
        className="fixed m-0 overflow-y-auto rounded-2xl border border-line bg-panel p-3 text-ink shadow-xl"
        onBeforeToggle={(event) => {
          if (event.newState === 'open') {
            position()
            onOpen()
          }
        }}
        onToggle={(event) => {
          const nextOpen = event.newState === 'open'
          setOpen(nextOpen)
          if (nextOpen) {
            panel.current
              ?.querySelector<HTMLElement>('a, button, input')
              ?.focus()
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            close()
          }
        }}
      >
        <Button variant="ghost" className="mb-2 min-h-11" onClick={close}>
          Close create/join
        </Button>
        {children}
      </div>
    </div>
  )
}
