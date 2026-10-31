import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { GroupMemberProgressBar } from './GroupMemberProgressBar'

afterEach(cleanup)

describe('GroupMemberProgressBar', () => {
  it('anchors positive green progress at the zero baseline', () => {
    const { getByRole } = render(
      <GroupMemberProgressBar label="Ava goal progress" percentage={48.5} />,
    )

    const bar = getByRole('progressbar', { name: 'Ava goal progress' })
    const fill = bar.querySelector('[data-progress-fill]')
    expect(bar).toHaveAttribute('aria-valuenow', '48.5')
    expect(bar).toHaveAttribute('aria-valuetext', '48.5%')
    expect(bar).toHaveAttribute('aria-valuemin', '-100')
    expect(fill).toHaveStyle({ left: '50%', width: '24.25%' })
    expect(fill).toHaveClass('bg-emerald-600')
    expect(bar.querySelector('[data-progress-baseline]')).toBeInTheDocument()
  })

  it('anchors negative red progress to the left of zero', () => {
    const { getByRole } = render(
      <GroupMemberProgressBar label="Member goal progress" percentage={-25} />,
    )

    const bar = getByRole('progressbar', { name: 'Member goal progress' })
    const fill = bar.querySelector('[data-progress-fill]')
    expect(bar).toHaveAttribute('aria-valuenow', '-25')
    expect(bar).toHaveAttribute('aria-valuetext', '-25%')
    expect(fill).toHaveStyle({
      left: '50%',
      transform: 'translateX(-100%)',
      width: '12.5%',
    })
    expect(fill).toHaveClass('bg-red-600')
  })

  it('labels gains beyond the negative scale cap while keeping the bar bounded', () => {
    const { getByRole } = render(
      <GroupMemberProgressBar
        label="Member goal progress"
        percentage={-100}
        negativeProgressCapped
      />,
    )

    const bar = getByRole('progressbar', { name: 'Member goal progress' })
    expect(bar).toHaveAttribute('aria-valuenow', '-100')
    expect(bar).toHaveAttribute('aria-valuetext', '≤ -100%')
    expect(bar.querySelector('[data-progress-fill]')).toHaveStyle({
      width: '50%',
    })
  })

  it('announces missing progress without presenting it as zero progress', () => {
    const { getByRole } = render(
      <GroupMemberProgressBar label="Member goal progress" percentage={null} />,
    )

    const bar = getByRole('progressbar', {
      name: 'Member goal progress',
    })
    expect(bar).not.toHaveAttribute('aria-valuenow')
    expect(bar).toHaveAttribute('aria-valuetext', 'Unavailable')
    expect(bar.querySelector('[data-progress-fill]')).not.toBeInTheDocument()
    expect(bar.querySelector('[data-progress-baseline]')).toBeInTheDocument()
  })
})
