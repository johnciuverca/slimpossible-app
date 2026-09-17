import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { ParticipantEnrollmentPage } from './ParticipantEnrollmentPage'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

function renderPage() {
  render(
    <MemoryRouter>
      <ParticipantEnrollmentPage />
    </MemoryRouter>,
  )
}

describe('ParticipantEnrollmentPage', () => {
  it('reports required fields and validation feedback accessibly', () => {
    renderPage()

    fireEvent.submit(
      screen.getByRole('form', { name: 'Participant enrollment form' }),
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Please correct the highlighted fields before enrolling.',
    )
    expect(screen.getByText('Display name is required.')).toBeInTheDocument()
    expect(screen.getByText('User id is required.')).toBeInTheDocument()
    expect(
      screen.getByText('Starting weight must be a positive finite number.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Target weight must be a positive finite number.'),
    ).toBeInTheDocument()
  })

  it('rejects a target above the starting weight', async () => {
    renderPage()

    fireEvent.change(screen.getByLabelText('Display name'), {
      target: { value: 'Alex Participant' },
    })
    fireEvent.change(screen.getByLabelText('Participant identifier'), {
      target: { value: 'alex-1' },
    })
    fireEvent.change(screen.getByLabelText('Starting weight in kg'), {
      target: { value: '80' },
    })
    fireEvent.change(screen.getByLabelText('Target weight in kg'), {
      target: { value: '90' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enroll participant' }))

    expect(
      screen.getByText('Target weight must be on or below starting weight.'),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(
        screen.getByText('No participants enrolled yet.'),
      ).toBeInTheDocument()
    })
  })

  it('enrolls a valid participant into local persisted state', async () => {
    renderPage()

    fireEvent.change(screen.getByLabelText('Display name'), {
      target: { value: 'Alex Participant' },
    })
    fireEvent.change(screen.getByLabelText('Participant identifier'), {
      target: { value: 'alex-1' },
    })
    fireEvent.change(screen.getByLabelText('Starting weight in kg'), {
      target: { value: '92.5' },
    })
    fireEvent.change(screen.getByLabelText('Target weight in kg'), {
      target: { value: '80' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enroll participant' }))

    await waitFor(() => {
      expect(
        screen.getByText(
          'Alex Participant was enrolled in the local challenge.',
        ),
      ).toBeInTheDocument()
    })
    expect(screen.getByText('Alex Participant')).toBeInTheDocument()
    expect(screen.getByText('92.5 kg → 80 kg')).toBeInTheDocument()
    expect(
      screen.queryByText('No participants enrolled yet.'),
    ).not.toBeInTheDocument()
  })
})
