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

function dateOffset(offset: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
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

  it('orders history, keeps missing days absent, and edits an existing entry', () => {
    renderPage()

    const today = dateOffset(0)
    const missingDate = dateOffset(-1)
    const olderDate = dateOffset(-2)

    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '91.8' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save weigh-in' }))

    fireEvent.change(screen.getByLabelText('Date'), {
      target: { value: olderDate },
    })
    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '92.5' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save weigh-in' }))

    const historyItems = screen.getAllByRole('listitem')
    expect(historyItems[0]).toHaveTextContent(today)
    expect(historyItems[1]).toHaveTextContent(olderDate)
    expect(screen.queryByText(new RegExp(missingDate))).not.toBeInTheDocument()
    expect(
      screen.getByText(
        'Missing calendar days stay absent; no record or change is created for them.',
      ),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: `Edit ${today}` }))
    expect(
      screen.getByRole('button', { name: 'Update weigh-in' }),
    ).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '91.5' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Update weigh-in' }))

    expect(
      screen.getByText('Weigh-in updated in local state.'),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(
      screen.getByText(new RegExp(`${today}: 91.5 kg`)),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(new RegExp(`${today}: 91.8 kg`)),
    ).not.toBeInTheDocument()
  })
})
