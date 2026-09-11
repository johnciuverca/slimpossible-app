import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import App from './App'

describe('App foundation screen', () => {
  it('shows the welcome message and Tailwind status', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'Your challenge starts here.' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Tailwind is working')
  })
})
