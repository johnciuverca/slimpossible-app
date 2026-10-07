import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { PersonalWeighInsPage } from './PersonalWeighInsPage'

function dateOffset(offset: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  vi.restoreAllMocks()
})

function renderPage() {
  render(
    <MemoryRouter>
      <PersonalWeighInsPage />
    </MemoryRouter>,
  )
}

describe('PersonalWeighInsPage', () => {
  it('records a private weigh-in without a challenge', async () => {
    renderPage()

    await screen.findByRole('form', { name: 'Personal weigh-in form' })
    expect(
      screen.getByText(/You can still save this private weigh-in/),
    ).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '82.4' },
    })
    fireEvent.change(screen.getByLabelText(/Private note/), {
      target: { value: 'Only for me.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save weigh-in' }))

    await screen.findByText('Personal weigh-in saved in this browser.')
    expect(screen.getByText(/82.4 kg/)).toBeInTheDocument()
    expect(screen.getByText('Only for me.')).toBeInTheDocument()
    expect(
      screen.getByText('Private — not shared with a group'),
    ).toBeInTheDocument()
  })

  it('allows explicit sharing with multiple eligible groups and starts unchecked', async () => {
    window.localStorage.setItem(
      'slimpossible.local.challenges',
      JSON.stringify([
        {
          id: 'group-one',
          name: 'Group One',
          kind: 'group',
          ownerId: 'user-alex',
          createdBy: 'user-alex',
          createdAt: '2026-10-01T00:00:00.000Z',
          updatedAt: '2026-10-01T00:00:00.000Z',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          status: 'active',
        },
        {
          id: 'group-two',
          name: 'Group Two',
          kind: 'group',
          ownerId: 'user-alex',
          createdBy: 'user-alex',
          createdAt: '2026-10-01T00:00:00.000Z',
          updatedAt: '2026-10-01T00:00:00.000Z',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          status: 'active',
        },
      ]),
    )
    renderPage()
    await screen.findByRole('checkbox', { name: 'Group One' })

    const firstGroup = screen.getByRole('checkbox', { name: 'Group One' })
    const secondGroup = screen.getByRole('checkbox', { name: 'Group Two' })
    expect(firstGroup).not.toBeChecked()
    expect(secondGroup).not.toBeChecked()
    fireEvent.click(firstGroup)
    fireEvent.click(secondGroup)
    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '81.9' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save weigh-in' }))

    await screen.findByText(/81.9 kg/)
    expect(
      screen.getByText('Shared with Group One, Group Two'),
    ).toBeInTheDocument()
  })

  it('edits the canonical entry and confirms deletion', async () => {
    renderPage()
    await screen.findByRole('form', { name: 'Personal weigh-in form' })

    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '83.1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save weigh-in' }))
    await screen.findByText(/83.1 kg/)

    fireEvent.click(screen.getByRole('button', { name: /Edit/ }))
    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '82.9' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Update weigh-in' }))
    await screen.findByText(/82.9 kg/)

    vi.spyOn(window, 'confirm').mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: /Delete/ }))
    await waitFor(() => {
      expect(
        screen.getByText(/No personal weigh-ins saved yet/),
      ).toBeInTheDocument()
    })
  })

  it('keeps one entry per user/date and rejects a conflicting date edit', async () => {
    renderPage()
    await screen.findByRole('form', { name: 'Personal weigh-in form' })

    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '83.1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save weigh-in' }))
    await screen.findByText(/83.1 kg/)

    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '82.7' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save weigh-in' }))
    await screen.findByText(/82.7 kg/)
    expect(screen.getAllByRole('listitem')).toHaveLength(1)

    fireEvent.change(screen.getByLabelText('Date'), {
      target: { value: dateOffset(-1) },
    })
    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '82.2' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save weigh-in' }))
    await screen.findByText(/82.2 kg/)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)

    fireEvent.click(screen.getAllByRole('button', { name: /Edit/ })[1])
    fireEvent.change(screen.getByLabelText('Date'), {
      target: { value: dateOffset(0) },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Update weigh-in' }))
    await screen.findByText(/A weigh-in already exists for that date/)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText(/82.7 kg/)).toBeInTheDocument()
  })
})
