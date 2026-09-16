import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { MilestoneProgress } from './MilestoneProgress'
import type { ParticipantMilestones } from '../models/participantMilestones'

afterEach(() => {
  cleanup()
})

function availableMilestones(
  completionPercentage: number,
): ParticipantMilestones {
  return {
    challengeId: 'challenge-1',
    completionPercentage,
    milestones: [25, 50, 75, 100].map((thresholdPercentage) => ({
      id: `challenge-1:participant-1:${thresholdPercentage}`,
      state:
        completionPercentage >= thresholdPercentage ? 'reached' : 'upcoming',
      thresholdPercentage: thresholdPercentage as 25 | 50 | 75 | 100,
    })),
    participantId: 'participant-1',
    state: 'available',
  }
}

describe('MilestoneProgress', () => {
  it('renders accessible in-progress milestone information', () => {
    render(<MilestoneProgress milestones={availableMilestones(50)} />)

    expect(
      screen.getByRole('progressbar', {
        name: 'Milestone progress: 50% complete',
      }),
    ).toHaveAttribute('aria-valuenow', '50')
    expect(screen.getByRole('status')).toHaveTextContent(
      '2 of 4 milestones reached',
    )
    expect(
      screen.getByRole('list', { name: 'Milestone status' }),
    ).toHaveTextContent('25%Reached')
    expect(screen.getByText('Current milestone')).toBeInTheDocument()
    expect(screen.getAllByText('Upcoming')).toHaveLength(2)
  })

  it('marks every milestone reached at full completion', () => {
    render(<MilestoneProgress milestones={availableMilestones(100)} />)

    expect(screen.getByRole('status')).toHaveTextContent(
      '4 of 4 milestones reached',
    )
    expect(screen.getAllByText('Reached')).toHaveLength(3)
    expect(screen.getByText('Current milestone')).toBeInTheDocument()
    expect(
      screen.getByRole('progressbar', {
        name: 'Milestone progress: 100% complete',
      }),
    ).toHaveAttribute(
      'aria-valuetext',
      '100% complete. 4 of 4 milestones reached.',
    )
  })

  it('explains unavailable milestone progress without a misleading progress bar', () => {
    const unavailableMilestones: ParticipantMilestones = {
      challengeId: 'challenge-1',
      completionPercentage: null,
      milestones: [],
      participantId: 'participant-1',
      reason: 'no-target',
      state: 'unavailable',
    }

    render(<MilestoneProgress milestones={unavailableMilestones} />)

    expect(screen.getByRole('status')).toHaveTextContent(
      'Not available.Add a target weight to begin milestone progress.',
    )
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
})
