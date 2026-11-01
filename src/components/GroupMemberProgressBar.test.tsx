import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { GroupMemberProgressBar } from './GroupMemberProgressBar'

afterEach(cleanup)

describe('GroupMemberProgressBar', () => {
  it('fills green from the left for weight loss toward the target', () => {
    const { getByRole } = render(
      <GroupMemberProgressBar label="Ava goal progress" percentage={10} />,
    )

    const bar = getByRole('progressbar', { name: 'Ava goal progress' })
    const fill = bar.querySelector('[data-progress-fill]')
    expect(bar).toHaveAttribute('aria-valuenow', '10')
    expect(bar).toHaveAttribute('aria-valuetext', '10%')
    expect(bar).toHaveAttribute('aria-valuemin', '-100')
    expect(fill).toHaveStyle({ width: '10%' })
    expect(fill).toHaveClass('left-0', 'bg-emerald-600')
    expect(
      bar.querySelector('[data-progress-baseline]'),
    ).not.toBeInTheDocument()
  })

  it('fills red from the left for weight gain above the starting point', () => {
    const { getByRole } = render(
      <GroupMemberProgressBar label="Member goal progress" percentage={-10} />,
    )

    const bar = getByRole('progressbar', { name: 'Member goal progress' })
    const fill = bar.querySelector('[data-progress-fill]')
    expect(bar).toHaveAttribute('aria-valuenow', '-10')
    expect(bar).toHaveAttribute('aria-valuetext', '-10%')
    expect(fill).toHaveStyle({ width: '10%' })
    expect(fill).toHaveClass('left-0', 'bg-red-600')
    expect(
      bar.querySelector('[data-progress-baseline]'),
    ).not.toBeInTheDocument()
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
      width: '100%',
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
    expect(
      bar.querySelector('[data-progress-baseline]'),
    ).not.toBeInTheDocument()
  })
})
