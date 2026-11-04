import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useUnsavedNavigation } from './navigationSafety'

import type { Challenge } from '../models/challenge'
import { personalWeighInToday } from '../models/personalWeighIn'
import { Button, TextInput } from './ui'

export type PersonalWeighInFormValues = {
  date: string
  note: string
  sharedChallengeIds: string[]
  weightKg: string
}

type PersonalWeighInEditorProps = {
  errors?: Partial<Record<keyof PersonalWeighInFormValues, string>>
  groups: Challenge[]
  isSaving: boolean
  onCancel?: () => void
  onChange: (
    field: keyof PersonalWeighInFormValues,
    value: string | string[],
  ) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  submitLabel: string
  values: PersonalWeighInFormValues
  compactMobile?: boolean
}

const today = personalWeighInToday()

export function PersonalWeighInEditor({
  errors = {},
  groups,
  isSaving,
  onCancel,
  onChange,
  onSubmit,
  submitLabel,
  values,
  compactMobile = false,
}: PersonalWeighInEditorProps) {
  const initial = useRef(JSON.stringify(values))
  const visualViewport = window.visualViewport
  const wideEnoughForColumns =
    window.matchMedia?.('(min-width: 768px) and (min-height: 501px)').matches ??
    (window.innerWidth >= 768 && window.innerHeight > 500)
  const zoomedIntoCompactViewport =
    !!visualViewport &&
    (visualViewport.width < 768 ||
      visualViewport.height <= 500 ||
      visualViewport.scale > 1.05)
  const [noteExpanded, setNoteExpanded] = useState(
    () =>
      !compactMobile || (wideEnoughForColumns && !zoomedIntoCompactViewport),
  )
  useUnsavedNavigation(
    isSaving
      ? 'saving'
      : JSON.stringify(values) !== initial.current
        ? 'dirty'
        : null,
  )
  useEffect(() => {
    if (!compactMobile || !window.matchMedia) return
    const breakpoint = window.matchMedia(
      '(min-width: 768px) and (min-height: 501px)',
    )
    const viewport = window.visualViewport
    const syncNoteVisibility = () =>
      setNoteExpanded(
        breakpoint.matches &&
          (!viewport ||
            (viewport.width >= 768 &&
              viewport.height > 500 &&
              viewport.scale <= 1.05)),
      )
    breakpoint.addEventListener('change', syncNoteVisibility)
    viewport?.addEventListener('resize', syncNoteVisibility)
    return () => {
      breakpoint.removeEventListener('change', syncNoteVisibility)
      viewport?.removeEventListener('resize', syncNoteVisibility)
    }
  }, [compactMobile])
  function toggleGroup(id: string, selected: boolean) {
    onChange(
      'sharedChallengeIds',
      selected
        ? [...values.sharedChallengeIds, id]
        : values.sharedChallengeIds.filter((value) => value !== id),
    )
  }

  return (
    <form
      aria-label="Personal weigh-in form"
      className={compactMobile ? 'space-y-4 md:space-y-5' : 'space-y-5'}
      noValidate
      onSubmit={onSubmit}
    >
      {compactMobile ? (
        <div className="record-weight-fields">
          <div className="min-w-0">
            <TextInput
              className="record-weight-shell-control"
              error={errors.date}
              disabled={isSaving}
              id="personal-weigh-in-date"
              label="Date"
              max={today}
              onChange={(event) => onChange('date', event.target.value)}
              shellClassName={`record-weight-field-shell${errors.date ? ' has-error' : ''}`}
              type="date"
              value={values.date}
            />
          </div>
          <div className="min-w-0">
            <TextInput
              className="record-weight-shell-control"
              error={errors.weightKg}
              disabled={isSaving}
              id="personal-weigh-in-weight"
              inputMode="decimal"
              label="Weight in kg"
              min="0"
              onChange={(event) => onChange('weightKg', event.target.value)}
              onWheel={(event) => event.currentTarget.blur()}
              shellClassName={`record-weight-field-shell${errors.weightKg ? ' has-error' : ''}`}
              step="0.01"
              type="number"
              value={values.weightKg}
            />
          </div>
        </div>
      ) : (
        <>
          <TextInput
            error={errors.date}
            disabled={isSaving}
            id="personal-weigh-in-date"
            label="Date"
            max={today}
            onChange={(event) => onChange('date', event.target.value)}
            type="date"
            value={values.date}
          />
          <TextInput
            error={errors.weightKg}
            disabled={isSaving}
            id="personal-weigh-in-weight"
            inputMode="decimal"
            label="Weight in kg"
            min="0"
            onChange={(event) => onChange('weightKg', event.target.value)}
            onWheel={(event) => event.currentTarget.blur()}
            step="0.01"
            type="number"
            value={values.weightKg}
          />
        </>
      )}
      <div>
        {compactMobile ? (
          <button
            aria-controls="personal-weigh-in-note-content"
            aria-expanded={noteExpanded}
            className="record-weight-note-toggle flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-line px-3 py-2 text-left"
            disabled={isSaving}
            onClick={() => setNoteExpanded((expanded) => !expanded)}
            type="button"
          >
            <span className="font-semibold text-ink">
              {noteExpanded ? 'Private note' : 'Private note (optional)'}
            </span>
            <span className="min-w-0 text-right text-xs text-ink-muted">
              {errors.note
                ? `Needs attention: ${errors.note}`
                : values.note.trim()
                  ? 'Saved note · tap to view or edit'
                  : noteExpanded
                    ? 'Stays private'
                    : 'Add note · stays private'}
            </span>
          </button>
        ) : null}
        <div
          className={
            compactMobile
              ? `record-weight-note-content${noteExpanded ? '' : ' is-collapsed'}`
              : undefined
          }
          id="personal-weigh-in-note-content"
        >
          <label
            className={
              compactMobile
                ? `record-weight-note-label${noteExpanded ? ' is-visible' : ''} text-sm font-semibold text-ink`
                : 'text-sm font-semibold text-ink'
            }
            htmlFor="personal-weigh-in-note"
          >
            Private note{' '}
            <span className="font-normal text-ink-muted">(optional)</span>
          </label>
          <textarea
            disabled={isSaving}
            aria-describedby={
              errors.note ? 'personal-weigh-in-note-error' : undefined
            }
            aria-invalid={errors.note ? true : undefined}
            className="mt-2 block min-h-28 w-full rounded-xl border border-line bg-panel px-4 py-3 text-ink outline-none focus:border-forest-700 focus:ring-2 focus:ring-forest-100"
            id="personal-weigh-in-note"
            maxLength={2000}
            onChange={(event) => onChange('note', event.target.value)}
            value={values.note}
          />
          <p className="mt-2 text-xs leading-5 text-ink-muted">
            This note is private to you and is never included in group views.
          </p>
          {errors.note ? (
            <p
              className="mt-2 text-sm text-red-700"
              id="personal-weigh-in-note-error"
            >
              {errors.note}
            </p>
          ) : null}
        </div>
      </div>

      <fieldset className="rounded-xl border border-line p-4">
        <legend className="px-1 text-sm font-semibold text-ink">
          Share date and weight with groups (optional)
        </legend>
        {groups.length === 0 ? (
          <p className="text-sm leading-6 text-ink-muted">
            No eligible groups. You can still save this private weigh-in.
          </p>
        ) : (
          <>
            <p className="mb-3 text-xs leading-5 text-ink-muted">
              Nothing is selected by default. Choose each group separately; your
              note is never shared.
            </p>
            <div className="space-y-3">
              {groups.map((group) => (
                <label
                  className="flex items-start gap-3 text-sm text-ink"
                  key={group.id}
                >
                  <input
                    disabled={isSaving}
                    checked={values.sharedChallengeIds.includes(group.id)}
                    className="mt-1 size-4 accent-forest-800"
                    onChange={(event) =>
                      toggleGroup(group.id, event.target.checked)
                    }
                    type="checkbox"
                  />
                  <span>{group.name}</span>
                </label>
              ))}
            </div>
          </>
        )}
        {errors.sharedChallengeIds ? (
          <p className="mt-2 text-sm text-red-700">
            {errors.sharedChallengeIds}
          </p>
        ) : null}
      </fieldset>

      <div
        className={
          compactMobile
            ? 'record-weight-actions sticky bottom-[-1.25rem] z-10 -mx-5 mt-1 flex flex-wrap gap-3 border-t border-line bg-panel px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)]'
            : 'flex flex-wrap gap-3'
        }
      >
        <Button disabled={isSaving} type="submit">
          {isSaving ? 'Saving…' : submitLabel}
        </Button>
        {onCancel ? (
          <Button
            disabled={isSaving}
            onClick={onCancel}
            type="button"
            variant="secondary"
          >
            Cancel edit
          </Button>
        ) : null}
      </div>
    </form>
  )
}
