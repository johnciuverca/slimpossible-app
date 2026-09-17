import { describe, expect, it } from 'vitest'

import { challengeFixture, createParticipantFixture } from './fixtures'
import { createActiveParticipantCards } from './activeParticipantCards'

describe('createActiveParticipantCards', () => {
  it('keeps source order while selecting only active participants in the challenge', () => {
    const firstActive = createParticipantFixture({
      displayName: 'Ava Active',
      id: 'participant-ava',
    })
    const secondActive = createParticipantFixture({
      displayName: 'Ben Active',
      id: 'participant-ben',
    })
    const inactive = createParticipantFixture({
      displayName: 'Casey Inactive',
      id: 'participant-casey',
      status: 'completed',
    })
    const otherChallenge = createParticipantFixture({
      challengeId: 'another-challenge',
      displayName: 'Dee Other',
      id: 'participant-dee',
    })

    expect(
      createActiveParticipantCards({
        challenge: challengeFixture,
        participants: [firstActive, inactive, secondActive, otherChallenge],
        weighIns: [],
      }).map(({ displayName, participantId }) => ({
        displayName,
        participantId,
      })),
    ).toEqual([
      { displayName: 'Ava Active', participantId: 'participant-ava' },
      { displayName: 'Ben Active', participantId: 'participant-ben' },
    ])
  })

  it('provides approved progress status and copy for an in-progress participant', () => {
    const participant = createParticipantFixture({
      displayName: 'Ava Active',
      id: 'participant-ava',
      startingWeightKg: 100,
      targetWeightKg: 80,
    })

    expect(
      createActiveParticipantCards({
        challenge: challengeFixture,
        participants: [participant],
        weighIns: [
          { date: '2026-09-15', participantId: participant.id, weightKg: 90 },
        ],
      }),
    ).toEqual([
      {
        completionPercentage: 50,
        displayName: 'Ava Active',
        message: 'You are 10 kg away from your target weight.',
        participantId: 'participant-ava',
        state: 'in-progress',
        statusLabel: 'In progress',
      },
    ])
  })

  it('keeps no-record, no-target, and reached-target states explicit', () => {
    const noRecords = createParticipantFixture({
      displayName: 'No Records',
      id: 'participant-no-records',
    })
    const noTarget = createParticipantFixture({
      displayName: 'No Target',
      id: 'participant-no-target',
      targetWeightKg: undefined,
    })
    const reachedTarget = createParticipantFixture({
      displayName: 'Reached Target',
      id: 'participant-reached',
      startingWeightKg: 100,
      targetWeightKg: 80,
    })

    expect(
      createActiveParticipantCards({
        challenge: challengeFixture,
        participants: [noRecords, noTarget, reachedTarget],
        weighIns: [
          { date: '2026-09-15', participantId: noTarget.id, weightKg: 90 },
          {
            date: '2026-09-15',
            participantId: reachedTarget.id,
            weightKg: 80,
          },
        ],
      }).map(({ state, statusLabel }) => ({ state, statusLabel })),
    ).toEqual([
      { state: 'first-record', statusLabel: 'First weigh-in needed' },
      { state: 'no-target', statusLabel: 'No target set' },
      { state: 'target-reached', statusLabel: 'Target reached' },
    ])
  })

  it('does not expose raw weights, targets, or private weigh-in history', () => {
    const participant = createParticipantFixture({ id: 'participant-ava' })
    const cards = createActiveParticipantCards({
      challenge: challengeFixture,
      participants: [participant],
      weighIns: [
        {
          date: '2026-09-15',
          note: 'Private note',
          participantId: participant.id,
          weightKg: 88,
        },
      ],
    })

    expect(cards[0]).not.toHaveProperty('currentWeightKg')
    expect(cards[0]).not.toHaveProperty('targetWeightKg')
    expect(cards[0]).not.toHaveProperty('history')
    expect(JSON.stringify(cards)).not.toContain('88')
    expect(JSON.stringify(cards)).not.toContain('Private note')
  })
})
