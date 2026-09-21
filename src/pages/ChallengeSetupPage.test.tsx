import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { ChallengeSetupPage } from './ChallengeSetupPage'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe('ChallengeSetupPage', () => {
  function renderPage() {
    render(
      <MemoryRouter>
        <ChallengeSetupPage />
      </MemoryRouter>,
    )
  }

  it('reports required and date-order errors accessibly', () => {
    render(
      <MemoryRouter>
        <ChallengeSetupPage />
      </MemoryRouter>,
    )

    fireEvent.submit(screen.getByRole('form', { name: 'Challenge setup form' }))

    expect(
      screen.getByRole('textbox', { name: 'Challenge name' }),
    ).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Enter a challenge name.')).toBeInTheDocument()
    expect(screen.getByText('Choose a start date.')).toBeInTheDocument()
    expect(screen.getByText('Choose an end date.')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox', { name: 'Challenge name' }), {
      target: { value: 'Autumn reset' },
    })
    fireEvent.change(screen.getByLabelText('Start date'), {
      target: { value: '2026-10-10' },
    })
    fireEvent.change(screen.getByLabelText('End date'), {
      target: { value: '2026-10-01' },
    })
    fireEvent.submit(screen.getByRole('form', { name: 'Challenge setup form' }))

    expect(
      screen.getByText('End date must be on or after the start date.'),
    ).toBeInTheDocument()
  })

  it('accepts valid challenge details and keeps the preview local', async () => {
    render(
      <MemoryRouter>
        <ChallengeSetupPage />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByRole('textbox', { name: 'Challenge name' }), {
      target: { value: 'Autumn reset' },
    })
    fireEvent.change(screen.getByLabelText('Description (optional)'), {
      target: { value: 'A steady challenge for the team.' },
    })
    fireEvent.change(screen.getByLabelText('Start date'), {
      target: { value: '2026-10-01' },
    })
    fireEvent.change(screen.getByLabelText('End date'), {
      target: { value: '2026-11-01' },
    })
    fireEvent.change(screen.getByLabelText('Target weight in kg (optional)'), {
      target: { value: '80' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save challenge' }))

    await waitFor(() => {
      expect(
        screen.getByText(/Nothing has been saved remotely\./),
      ).toBeInTheDocument()
    })
  })

  it('restores multiple local challenges and edits only the selected one', async () => {
    renderPage()

    fireEvent.change(screen.getByRole('textbox', { name: 'Challenge name' }), {
      target: { value: 'Autumn reset' },
    })
    fireEvent.change(screen.getByLabelText('Start date'), {
      target: { value: '2026-10-01' },
    })
    fireEvent.change(screen.getByLabelText('End date'), {
      target: { value: '2026-11-01' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save challenge' }))

    await waitFor(() => {
      expect(
        screen.getByText(/Nothing has been saved remotely\./),
      ).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'New challenge' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Challenge name' }), {
      target: { value: 'Winter reset' },
    })
    fireEvent.change(screen.getByLabelText('Start date'), {
      target: { value: '2026-12-01' },
    })
    fireEvent.change(screen.getByLabelText('End date'), {
      target: { value: '2027-01-01' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save challenge' }))

    await waitFor(() => {
      expect(
        screen.getByRole('option', { name: 'Autumn reset' }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('option', { name: 'Winter reset' }),
      ).toBeInTheDocument()
    })

    cleanup()
    renderPage()

    await waitFor(() => {
      expect(
        screen.getByRole('option', { name: 'Autumn reset' }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('option', { name: 'Winter reset' }),
      ).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Saved challenge'), {
      target: {
        value: screen
          .getByRole('option', { name: 'Autumn reset' })
          .getAttribute('value'),
      },
    })
    expect(screen.getByRole('textbox', { name: 'Challenge name' })).toHaveValue(
      'Autumn reset',
    )
  })
})
