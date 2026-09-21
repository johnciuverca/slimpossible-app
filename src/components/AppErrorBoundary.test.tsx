import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AppErrorBoundary } from './AppErrorBoundary'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('AppErrorBoundary', () => {
  it('shows a safe recovery screen and redacted diagnostic for render failures', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    function BrokenPage(): never {
      throw new Error('provider response contained private data')
    }

    render(
      <AppErrorBoundary>
        <BrokenPage />
      </AppErrorBoundary>,
    )

    expect(
      screen.getByRole('heading', { name: 'We could not load this page.' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Reload app' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Return home' })).toHaveAttribute(
      'href',
      '/',
    )
    expect(consoleError).toHaveBeenCalledWith('[Slimpossible] render failure', {
      errorName: 'Error',
    })
    expect(consoleError).not.toHaveBeenCalledWith(
      expect.stringContaining('provider response'),
    )
  })
})
