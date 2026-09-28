import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import {
  Button,
  Card,
  FeedbackPanel,
  PageHeader,
  ProgressBar,
  StatusPill,
  TextInput,
} from './index'

afterEach(() => {
  cleanup()
})

describe('shared UI primitives', () => {
  it('renders an accessible button and card', () => {
    render(
      <Card>
        <Button disabled>Save progress</Button>
      </Card>,
    )

    expect(screen.getByRole('button', { name: 'Save progress' })).toBeDisabled()
    expect(screen.getByRole('button').parentElement).toHaveClass(
      'rounded-panel',
    )
  })

  it('renders a page header and status pill', () => {
    render(
      <PageHeader description="A short description" title="Example page">
        <StatusPill tone="success">Ready</StatusPill>
      </PageHeader>,
    )

    expect(
      screen.getByRole('heading', { name: 'Example page' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Ready')
  })

  it.each([
    ['loading', 'Loading', 'status'],
    ['empty', 'No data', 'status'],
    ['error', 'Error', 'alert'],
    ['info', 'Notice', 'status'],
  ] as const)('labels the %s feedback state', (tone, label, role) => {
    render(<FeedbackPanel tone={tone}>State details</FeedbackPanel>)

    expect(screen.getByRole(role)).toHaveTextContent(label)
    expect(screen.getByRole(role)).toHaveTextContent('State details')
    if (tone === 'loading') {
      expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    }
    if (tone === 'error') {
      expect(screen.getByRole('alert')).toHaveAttribute(
        'aria-live',
        'assertive',
      )
    }
  })

  it('reports progress with accessible values', () => {
    render(<ProgressBar label="Weekly progress" max={100} value={25} />)

    expect(
      screen.getByRole('progressbar', { name: 'Weekly progress' }),
    ).toHaveAttribute('aria-valuenow', '25')
  })

  it('keeps a non-finite saved percentage out of the visual progress value', () => {
    const { container } = render(
      <ProgressBar label="Maintenance progress" value={Number.NaN} />,
    )

    expect(
      screen.getByRole('progressbar', { name: 'Maintenance progress' }),
    ).toHaveAttribute('aria-valuenow', '0')
    expect(container.querySelector('[role="progressbar"] > div')).toHaveStyle({
      width: '0%',
    })
  })

  it('connects an input label and validation message', () => {
    render(
      <TextInput
        error="Email is required"
        id="email"
        label="Email"
        type="email"
      />,
    )

    expect(screen.getByLabelText('Email')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(screen.getByText('Email is required')).toHaveAttribute(
      'id',
      'email-error',
    )
  })
})
