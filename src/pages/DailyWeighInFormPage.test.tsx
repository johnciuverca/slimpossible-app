import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { DailyWeighInFormPage } from './DailyWeighInFormPage'

afterEach(() => {
  cleanup()
})

function renderPage() {
  render(
    <MemoryRouter>
      <DailyWeighInFormPage />
    </MemoryRouter>,
  )
}

describe('DailyWeighInFormPage', () => {
  it('shows accessible errors for missing weight and future dates', () => {
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
    expect(screen.getByLabelText('Weight in kg')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })

  it('creates a local weigh-in and reports the created state', () => {
    renderPage()

    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '91.8' },
    })
    fireEvent.change(screen.getByLabelText('Note (optional)'), {
      target: { value: 'Morning reading.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save weigh-in' }))

    expect(
      screen.getByText('Weigh-in created in local state.'),
    ).toBeInTheDocument()
    expect(screen.getByText(/91.8 kg/)).toBeInTheDocument()
    expect(screen.getAllByText('Morning reading.')).toHaveLength(2)
  })

  it('updates the same date instead of adding a duplicate', () => {
    renderPage()

    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '91.8' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save weigh-in' }))

    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '91.5' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save weigh-in' }))

    expect(
      screen.getByText('Weigh-in updated in local state.'),
    ).toBeInTheDocument()
    expect(screen.getByText(/91.5 kg/)).toBeInTheDocument()
    expect(screen.queryByText(/91.8 kg/)).not.toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })
})
