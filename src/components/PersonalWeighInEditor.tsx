import { useRef, useState, type FormEvent } from 'react'
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
      <div className="record-weight-fields">
        <fieldset className="record-weight-labeled-field record-weight-date-field">
          <legend>Date</legend>
          <TextInput
            className="record-weight-shell-control"
            error={errors.date}
            disabled={isSaving}
            id="personal-weigh-in-date"
            label="Date"
            labelClassName="sr-only"
            max={today}
            onChange={(event) => onChange('date', event.target.value)}
            shellClassName={`record-weight-field-shell${errors.date ? ' has-error' : ''}`}
            type="date"
            value={values.date}
          />
        </fieldset>
        <fieldset className="record-weight-labeled-field record-weight-weight-field">
          <legend>Weight in kg</legend>
          <TextInput
            className="record-weight-shell-control"
            error={errors.weightKg}
            disabled={isSaving}
            id="personal-weigh-in-weight"
            inputMode="decimal"
            label="Weight in kg"
            labelClassName="sr-only"
            min="0"
            onChange={(event) => onChange('weightKg', event.target.value)}
            shellClassName={`record-weight-field-shell${errors.weightKg ? ' has-error' : ''}`}
            step="0.01"
            type="text"
            value={values.weightKg}
          />
        </fieldset>
        <fieldset className="record-weight-labeled-field record-weight-sharing-field">
          <legend>Share record with groups</legend>
          {groups.length === 0 ? (
            <p className="text-sm leading-6 text-ink-muted">
              No eligible groups. You can still save this private weigh-in.
            </p>
          ) : (
            <div className="space-y-3">
              {groups.map((group) => (
                <label
                  className="flex items-center gap-3 text-sm text-ink"
                  key={group.id}
                >
                  <input
                    disabled={isSaving}
                    checked={values.sharedChallengeIds.includes(group.id)}
                    className="size-4 shrink-0 accent-forest-800"
                    onChange={(event) =>
                      toggleGroup(group.id, event.target.checked)
                    }
                    type="checkbox"
                  />
                  <span className="min-w-0 break-words">{group.name}</span>
                </label>
              ))}
            </div>
          )}
          {errors.sharedChallengeIds ? (
            <p className="mt-2 text-sm text-red-700">
              {errors.sharedChallengeIds}
            </p>
          ) : null}
        </fieldset>
        <fieldset className="record-weight-labeled-field record-weight-note-field">
          <legend>
            {compactMobile ? (
              <button
                aria-controls="personal-weigh-in-note-content"
                aria-expanded={noteExpanded}
                className="record-weight-note-toggle"
                disabled={isSaving}
                onClick={() => setNoteExpanded((expanded) => !expanded)}
                type="button"
              >
                <span>Private note (optional)</span>
                {errors.note ? (
                  <span className="text-xs text-danger-800">
                    Needs attention
                  </span>
                ) : null}
              </button>
            ) : (
              'Private note (optional)'
            )}
          </legend>
          <div
            className={
              compactMobile
                ? `record-weight-note-content${noteExpanded ? '' : ' is-collapsed'}`
                : 'record-weight-note-content'
            }
            id="personal-weigh-in-note-content"
          >
            <label className="sr-only" htmlFor="personal-weigh-in-note">
              Private note (optional)
            </label>
            <textarea
              disabled={isSaving}
              aria-describedby={
                errors.note ? 'personal-weigh-in-note-error' : undefined
              }
              aria-invalid={errors.note ? true : undefined}
              className="record-weight-note-input"
              id="personal-weigh-in-note"
              maxLength={2000}
              onChange={(event) => onChange('note', event.target.value)}
              value={values.note}
            />
          </div>
          {errors.note ? (
            <p
              className="mt-2 text-sm text-red-700"
              id="personal-weigh-in-note-error"
            >
              {errors.note}
            </p>
          ) : null}
        </fieldset>
        <div
          className={
            compactMobile
              ? 'record-weight-actions sticky bottom-[-1.25rem] z-10 -mx-5 mt-1 flex flex-wrap gap-3 border-t border-line bg-panel px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)]'
              : 'record-weight-actions flex flex-wrap gap-3'
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
      </div>
    </form>
  )
}
