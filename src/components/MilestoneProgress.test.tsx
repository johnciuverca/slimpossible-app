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

  it.each([
    ['loss', 'Weight-loss goal'],
    ['maintain', 'Maintenance goal'],
    ['gain', 'Weight-gain goal'],
  ] as const)(
    'labels %s progress and respects reduced motion',
    (direction, label) => {
      const { container } = render(
        <MilestoneProgress
          direction={direction}
          milestones={availableMilestones(50)}
        />,
      )

      expect(screen.getByText(label)).toBeInTheDocument()
      expect(
        container.querySelector('[data-testid="milestone-track-fill"]'),
      ).toHaveClass('motion-reduce:transition-none')
    },
  )

  it.each([
    [0, [0, 12.5, 37.5, 62.5, 87.5]],
    [25, [0, 12.5, 37.5, 62.5, 87.5]],
    [50, [33.33333333333333, 12.5, 37.5, 62.5, 87.5]],
    [75, [66.66666666666666, 12.5, 37.5, 62.5, 87.5]],
    [100, [100, 12.5, 37.5, 62.5, 87.5]],
  ])(
    'keeps the progress track and markers aligned at %s percent',
    (completionPercentage, [expectedFill, ...markerPositions]) => {
      const { container } = render(
        <MilestoneProgress
          milestones={availableMilestones(completionPercentage)}
        />,
      )

      expect(
        container.querySelector('[data-testid="milestone-track-fill"]'),
      ).toHaveStyle({ width: `${expectedFill}%` })
      expect(
        Array.from(container.querySelectorAll('[data-milestone-marker]')).map(
          (marker) => (marker as HTMLElement).style.left,
        ),
      ).toEqual(markerPositions.map((left) => `${left}%`))
    },
  )

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

  it('shows the selected participant goal metrics using concise kg labels', () => {
    render(
      <MilestoneProgress
        direction="gain"
        milestones={availableMilestones(50)}
        personalGoal={{
          currentWeightKg: 75,
          remainingWeightKg: 5,
          startingWeightKg: 70,
          statusLabel: 'In progress',
          targetWeightKg: 80,
        }}
      />,
    )

    expect(screen.getByText('72.5 kg')).toBeInTheDocument()
    expect(screen.getByText('77.5 kg')).toBeInTheDocument()
    expect(screen.getByText('70 kg')).toBeInTheDocument()
    expect(screen.getAllByText('75 kg')).toHaveLength(2)
    expect(screen.getAllByText('80 kg')).toHaveLength(2)
    expect(screen.getAllByRole('status')[0]).toHaveTextContent(
      'You are 5 kg away from your target weight.',
    )
  })

  it('shows maintenance distance without a loss-or-gain progress scale', () => {
    render(
      <MilestoneProgress
        direction="maintain"
        milestones={availableMilestones(0)}
        personalGoal={{
          currentWeightKg: 79.9,
          remainingWeightKg: 0.1,
          startingWeightKg: 80,
          statusLabel: 'In progress',
          targetWeightKg: 80,
        }}
      />,
    )

    expect(screen.getByText('Maintenance goal')).toBeInTheDocument()
    expect(screen.getAllByRole('status')[0]).toHaveTextContent(
      '0.1 kg from your maintenance target',
    )
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('list', { name: 'Milestone status' }),
    ).not.toBeInTheDocument()
  })

  it('retains start/current values and empty guidance when no personal target exists', () => {
    const noTarget: ParticipantMilestones = {
      challengeId: 'challenge-1',
      completionPercentage: null,
      milestones: [],
      participantId: 'participant-1',
      reason: 'no-target',
      state: 'unavailable',
    }

    render(
      <MilestoneProgress
        milestones={noTarget}
        personalGoal={{
          currentWeightKg: 90,
          remainingWeightKg: null,
          startingWeightKg: 100,
          statusLabel: 'No target set',
          targetWeightKg: null,
        }}
      />,
    )

    expect(screen.getAllByRole('status')[0]).toHaveTextContent(
      'Add a personal target weight to see goal progress.',
    )
    expect(screen.getByText('100 kg')).toBeInTheDocument()
    expect(screen.getByText('90 kg')).toBeInTheDocument()
    expect(screen.getByText('No target set')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
})
