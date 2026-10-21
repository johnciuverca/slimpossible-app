import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PersonalWeightRecordCard } from './PersonalWeightRecordCard'

afterEach(cleanup)
const entry = {
  id: 'record',
  userId: 'author',
  date: '2026-10-01',
  weightKg: 82.4,
  sharedChallengeIds: [],
}

describe('PersonalWeightRecordCard', () => {
  it('renders weight, semantic date and private label without an empty note placeholder', () => {
    render(
      <ul>
        <PersonalWeightRecordCard
          entry={entry}
          groupName={() => 'Group'}
          onEdit={() => undefined}
          onDelete={() => undefined}
        />
      </ul>,
    )
    expect(screen.getByText('82.4 kg')).toBeInTheDocument()
    expect(screen.getByText(entry.date)).toHaveAttribute('datetime', entry.date)
    expect(screen.getByText('Private')).toBeInTheDocument()
    expect(screen.queryByText('—')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: `Edit weight ${entry.date}` }),
    ).toHaveAttribute('title', `Edit weight: 82.4 kg recorded ${entry.date}`)
  })
  it('shows the author note and group names and exposes labelled icon actions', () => {
    const edit = vi.fn()
    const remove = vi.fn()
    render(
      <ul>
        <PersonalWeightRecordCard
          entry={{
            ...entry,
            note: 'Author-only note',
            sharedChallengeIds: ['one', 'two'],
          }}
          groupName={(id) => (id === 'one' ? 'First' : 'Second')}
          onEdit={edit}
          onDelete={remove}
        />
      </ul>,
    )
    expect(screen.getByText('Author-only note')).toBeInTheDocument()
    expect(screen.getByText('Shared with First, Second')).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: `Edit weight ${entry.date}` }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: `Delete ${entry.date}` }),
    )
    expect(edit).toHaveBeenCalledOnce()
    expect(remove).toHaveBeenCalledOnce()
  })
  it('announces pending deletion and prevents duplicate actions', () => {
    const remove = vi.fn()
    render(
      <ul>
        <PersonalWeightRecordCard
          entry={entry}
          groupName={() => 'Group'}
          onEdit={() => undefined}
          onDelete={remove}
          deleting
        />
      </ul>,
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      'Deleting entry and group shares',
    )
    expect(
      screen.getByRole('button', { name: `Edit weight ${entry.date}` }),
    ).toBeDisabled()
    fireEvent.click(
      screen.getByRole('button', { name: `Delete ${entry.date}` }),
    )
    expect(remove).not.toHaveBeenCalled()
  })
})
