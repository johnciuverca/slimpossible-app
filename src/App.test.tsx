import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'

describe('App foundation screen', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  beforeEach(() => {
    window.history.pushState({}, '', '/')
  })

  it('shows the shared layout and foundation content', () => {
    render(<App />)

    expect(screen.getByRole('banner')).toHaveTextContent('Slimpossible')
    expect(
      screen.getByRole('navigation', { name: 'Primary navigation' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Your challenge starts here.' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Tailwind is working')
  })

  it('redirects signed-out users from protected pages to login', () => {
    vi.useFakeTimers()
    render(<App />)

    fireEvent.click(screen.getByRole('link', { name: 'Progress' }))

    expect(window.location.pathname).toBe('/progress')
    act(() => {
      vi.advanceTimersByTime(150)
    })

    expect(window.location.pathname).toBe('/login')
    expect(
      screen.getByRole('heading', { name: 'Welcome back.' }),
    ).toBeInTheDocument()
  })

  it('shows a useful fallback for unknown routes', () => {
    window.history.pushState({}, '', '/unknown')
    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'Page not found' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Return home' })).toHaveAttribute(
      'href',
      '/',
    )
  })
})
