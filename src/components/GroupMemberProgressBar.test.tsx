import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { GroupMemberProgressBar } from './GroupMemberProgressBar'

afterEach(cleanup)

describe('GroupMemberProgressBar', () => {
  it('renders proportional continuous green progress with accessible values', () => {
    const { getByRole } = render(
      <GroupMemberProgressBar label="Ava goal progress" percentage={48.5} />,
    )

    const bar = getByRole('progressbar', { name: 'Ava goal progress' })
    expect(bar).toHaveAttribute('aria-valuenow', '48.5')
    expect(bar).toHaveAttribute('aria-valuetext', '48.5%')
    expect(bar.firstElementChild).toHaveStyle({ width: '48.5%' })
    expect(bar.firstElementChild).toHaveClass('bg-emerald-600')
  })

  it.each([
    [-5, 0],
    [120, 100],
  ])(
    'keeps the progress scale within accepted bounds for %s%%',
    (input, expected) => {
      const { getByRole } = render(
        <GroupMemberProgressBar
          label="Member goal progress"
          percentage={input}
        />,
      )

      const bar = getByRole('progressbar', {
        name: 'Member goal progress',
      })
      expect(bar).toHaveAttribute('aria-valuenow', String(expected))
      expect(bar.firstElementChild).toHaveStyle({ width: `${expected}%` })
    },
  )

  it('announces missing progress without presenting it as zero progress', () => {
    const { getByRole } = render(
      <GroupMemberProgressBar label="Member goal progress" percentage={null} />,
    )

    const bar = getByRole('progressbar', {
      name: 'Member goal progress',
    })
    expect(bar).not.toHaveAttribute('aria-valuenow')
    expect(bar).toHaveAttribute('aria-valuetext', 'Unavailable')
    expect(bar.firstElementChild).toHaveStyle({ width: '0%' })
  })
})
