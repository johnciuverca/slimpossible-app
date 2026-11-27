import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PersonalWeighInEditor } from './PersonalWeighInEditor'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('PersonalWeighInEditor', () => {
  it('keeps Date and Weight validation attached to their shared field shells', () => {
    const { container } = render(
      <PersonalWeighInEditor
        compactMobile
        errors={{ date: 'Choose a date.', weightKg: 'Enter a weight.' }}
        groups={[]}
        isSaving={false}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        submitLabel="Save weight"
        values={{
          date: '',
          note: '',
          sharedChallengeIds: [],
          weightKg: '',
        }}
      />,
    )

    for (const { id, message } of [
      { id: 'personal-weigh-in-date', message: 'Choose a date.' },
      { id: 'personal-weigh-in-weight', message: 'Enter a weight.' },
    ]) {
      const input = screen.getByLabelText(
        id === 'personal-weigh-in-date' ? 'Date' : 'Weight in kg',
      )
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(input.parentElement).toHaveClass(
        'record-weight-field-shell',
        'has-error',
      )
      expect(screen.getByText(message)).toBeVisible()
    }
    expect(
      container.querySelectorAll('.record-weight-field-shell'),
    ).toHaveLength(2)
  })

  it('keeps existing private notes and note errors discoverable when collapsed on mobile', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    )
    vi.stubGlobal('innerWidth', 390)

    const { container } = render(
      <PersonalWeighInEditor
        compactMobile
        errors={{ note: 'Note must be text when provided.' }}
        groups={[]}
        isSaving={false}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        submitLabel="Update weight"
        values={{
          date: '2026-11-03',
          note: 'Existing private note',
          sharedChallengeIds: [],
          weightKg: '82.3',
        }}
      />,
    )

    const toggle = screen.getByRole('button', {
      name: 'Private note (optional)Needs attention',
    })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle.querySelector('svg')).toBeNull()
    expect(screen.getByLabelText('Weight in kg')).toBeVisible()
    const note = screen.getByRole('textbox', {
      name: 'Private note (optional)',
    })
    expect(note.parentElement).toHaveClass(
      'record-weight-note-content',
      'is-collapsed',
    )
    expect(
      container.querySelector('label[for="personal-weigh-in-note"]'),
    ).toHaveClass('sr-only')

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(toggle).toHaveAccessibleName(
      'Private note (optional)Needs attention',
    )
    expect(toggle.querySelector('svg')).toBeNull()
    expect(note.parentElement).not.toHaveClass('is-collapsed')
    expect(note).toHaveValue('Existing private note')
    expect(screen.getByText('Note must be text when provided.')).toBeVisible()
  })

  it('keeps visible border legends and programmatic labels in the requested columns', () => {
    const { container } = render(
      <PersonalWeighInEditor
        compactMobile
        groups={[]}
        isSaving={false}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        submitLabel="Save weight"
        values={{
          date: '',
          note: '',
          sharedChallengeIds: [],
          weightKg: '',
        }}
      />,
    )
    const fieldsets = Array.from(container.querySelectorAll('fieldset'))
    expect(
      fieldsets.map(
        (fieldset) => fieldset.querySelector('legend')?.textContent,
      ),
    ).toEqual([
      'Date',
      'Weight in kg',
      'Share record with groups',
      expect.stringContaining('Private note (optional)'),
    ])
    expect(screen.getByLabelText('Date')).toBeVisible()
    expect(screen.getByLabelText('Weight in kg')).toBeVisible()
    expect(screen.getByLabelText('Private note (optional)')).toBeInTheDocument()
    expect(fieldsets[0]).toHaveClass('record-weight-date-field')
    expect(fieldsets[1]).toHaveClass('record-weight-weight-field')
    expect(fieldsets[2]).toHaveClass('record-weight-sharing-field')
    expect(fieldsets[3]).toHaveClass('record-weight-note-field')
  })
})
