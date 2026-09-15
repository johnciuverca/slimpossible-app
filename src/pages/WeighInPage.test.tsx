import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { WeighInPage } from './WeighInPage'

afterEach(() => {
  cleanup()
})

function renderPage() {
  render(
    <MemoryRouter>
      <WeighInPage />
    </MemoryRouter>,
  )
}

function fillValidWeight(weight: string) {
  fireEvent.change(screen.getByLabelText('Weight in kg'), {
    target: { value: weight },
  })
}

describe('WeighInPage', () => {
  it('handles an empty day without calculating a false change', () => {
    renderPage()

    expect(
      screen.getByText(
        'No weigh-in recorded for this date; no change is calculated.',
      ),
    ).toBeInTheDocument()
  })

  it('rejects missing weights and future dates accessibly', () => {
    renderPage()

    fireEvent.change(screen.getByLabelText('Date'), {
      target: { value: '2099-01-01' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save weigh-in' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Please correct the highlighted fields before saving.',
    )
    expect(
      screen.getByText('Weigh-in date cannot be in the future.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Weight must be a positive finite number.'),
    ).toBeInTheDocument()
  })

  it('prevents duplicate dates and supports editing a saved weigh-in', () => {
    renderPage()

    fillValidWeight('91.8')
    fireEvent.change(screen.getByLabelText('Note (optional)'), {
      target: { value: 'Morning reading.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save weigh-in' }))

    expect(
      screen.getByText('Weigh-in saved in the local preview.'),
    ).toBeInTheDocument()
    expect(screen.getByText(/91.8 kg/)).toBeInTheDocument()

    fillValidWeight('91.5')
    fireEvent.click(screen.getByRole('button', { name: 'Save weigh-in' }))
    expect(
      screen.getByText(
        'A weigh-in already exists for this participant on this date.',
      ),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Edit/ }))
    expect(
      screen.getByRole('button', { name: 'Update weigh-in' }),
    ).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '91.5' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Update weigh-in' }))

    expect(
      screen.getByText('Weigh-in updated in the local preview.'),
    ).toBeInTheDocument()
    expect(screen.getByText(/91.5 kg/)).toBeInTheDocument()
  })
})
