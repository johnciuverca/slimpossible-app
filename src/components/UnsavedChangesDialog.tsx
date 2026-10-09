import { useEffect, useRef } from 'react'
import { Button } from './ui'
import { trapDialogFocus } from './dialogFocus'

export function UnsavedChangesDialog({
  saving = false,
  onStay,
  onDiscard,
}: {
  saving?: boolean
  onStay: () => void
  onDiscard: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  return (
    <dialog
      ref={dialog}
      onKeyDown={trapDialogFocus}
      aria-labelledby="discard-editor-title"
      onCancel={(event) => {
        event.preventDefault()
        onStay()
      }}
      className="m-auto max-w-sm rounded-2xl border border-line bg-panel p-6 text-ink backdrop:bg-black/40"
    >
      <h2 id="discard-editor-title" className="text-xl font-bold">
        {saving ? 'Save in progress' : 'Discard unsaved input?'}
      </h2>
      <p className="mt-3 text-sm text-ink-muted">
        {saving
          ? 'Stay here until the save or deletion finishes. It cannot be cancelled by switching contexts.'
          : 'Your unsaved input will not be carried to another view or saved. Stay here to keep editing, or discard it and leave.'}
      </p>
      <div className="mt-5 flex gap-3">
        <Button
          variant="secondary"
          autoFocus
          onClick={() => {
            dialog.current?.close()
            onStay()
          }}
        >
          Stay
        </Button>
        {!saving ? (
          <Button
            onClick={() => {
              dialog.current?.close()
              onDiscard()
            }}
          >
            Discard and leave
          </Button>
        ) : null}
      </div>
    </dialog>
  )
}
