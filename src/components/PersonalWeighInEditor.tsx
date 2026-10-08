import type { FormEvent } from 'react'

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
}: PersonalWeighInEditorProps) {
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
      className="space-y-5"
      noValidate
      onSubmit={onSubmit}
    >
      <TextInput
        error={errors.date}
        id="personal-weigh-in-date"
        label="Date"
        max={today}
        onChange={(event) => onChange('date', event.target.value)}
        type="date"
        value={values.date}
      />
      <TextInput
        error={errors.weightKg}
        id="personal-weigh-in-weight"
        inputMode="decimal"
        label="Weight in kg"
        min="0"
        onChange={(event) => onChange('weightKg', event.target.value)}
        step="0.1"
        type="number"
        value={values.weightKg}
      />
      <div>
        <label
          className="text-sm font-semibold text-ink"
          htmlFor="personal-weigh-in-note"
        >
          Private note{' '}
          <span className="font-normal text-ink-muted">(optional)</span>
        </label>
        <textarea
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

      <div className="flex flex-wrap gap-3">
        <Button disabled={isSaving} type="submit">
          {isSaving ? 'Saving…' : submitLabel}
        </Button>
        {onCancel ? (
          <Button onClick={onCancel} type="button" variant="secondary">
            Cancel edit
          </Button>
        ) : null}
      </div>
    </form>
  )
}
