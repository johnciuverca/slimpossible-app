import { useEffect, useMemo, useState } from 'react'
import { useOptionalAuth } from '../auth/useAuth'
import type { Challenge } from '../models/challenge'
import type { Participant } from '../models/participant'
import type { PersonalWeighIn } from '../models/personalWeighIn'
import { isEligibleSharingGroup } from '../models/groupSharingEligibility'
import { participantFixture } from '../models/fixtures'
import { createPersistence } from './persistence'
import {
  notifyPersonalWeightChange,
  usePersonalWeightRevision,
} from './personalWeightChanges'

type Snapshot<T> = {
  key: string
  state: 'loading' | 'ready' | 'error'
  data: T
  error: string
}
const emptyChallenges = {
  challenges: [] as Challenge[],
  participants: [] as Participant[],
}

// Personal history is independent from optional challenge/membership loading.
// Keyed snapshots hide prior-account data synchronously, before effects run.
export function usePersonalWorkspace({
  enabled = true,
}: { enabled?: boolean } = {}) {
  const { state: auth } = useOptionalAuth()
  const persistence = useMemo(() => createPersistence(auth), [auth])
  const userId =
    auth.user?.id ??
    (persistence.mode === 'local' ? participantFixture.userId : '')
  const ownerKey = `${auth.status}:${userId}:${auth.user?.email ?? ''}:${persistence.mode}`
  const revision = usePersonalWeightRevision(userId)
  const requestKey = `${ownerKey}:${revision}:${enabled}`
  const [personal, setPersonal] = useState<Snapshot<PersonalWeighIn[]>>({
    key: '',
    state: 'loading',
    data: [],
    error: '',
  })
  const [contexts, setContexts] = useState<Snapshot<typeof emptyChallenges>>({
    key: '',
    state: 'loading',
    data: emptyChallenges,
    error: '',
  })

  useEffect(() => {
    let current = true
    const personalBase = {
      key: requestKey,
      data: [] as PersonalWeighIn[],
      error: '',
    }
    const contextBase = { key: requestKey, data: emptyChallenges, error: '' }
    setPersonal({ ...personalBase, state: 'loading' })
    setContexts({ ...contextBase, state: 'loading' })
    if (
      !enabled ||
      auth.status !== 'signed-in' ||
      !userId ||
      persistence.mode === 'unavailable'
    ) {
      const error =
        persistence.mode === 'unavailable'
          ? persistence.message
          : 'Sign in to view your personal history.'
      setPersonal({ ...personalBase, state: 'error', error })
      setContexts({ ...contextBase, state: 'error', error })
      return () => {
        current = false
      }
    }
    void persistence.repositories.personalWeighIns
      .listForUser(userId)
      .then((result) => {
        if (!current) return
        setPersonal(
          result.state === 'error'
            ? {
                ...personalBase,
                state: 'error',
                error:
                  'Your personal history could not be loaded. Try refreshing.',
              }
            : { ...personalBase, state: 'ready', data: result.data },
        )
      })
      .catch(() => {
        if (current)
          setPersonal({
            ...personalBase,
            state: 'error',
            error: 'Your personal history could not be loaded. Try refreshing.',
          })
      })
    void Promise.all([
      persistence.repositories.challenges.listVisibleToUser(userId),
      persistence.repositories.participants.listForUser(userId),
    ])
      .then(([challenges, participants]) => {
        if (!current) return
        setContexts(
          challenges.state === 'error' || participants.state === 'error'
            ? {
                ...contextBase,
                state: 'error',
                error:
                  'Challenge choices could not be loaded. New entries can still be saved privately.',
              }
            : {
                ...contextBase,
                state: 'ready',
                data: {
                  challenges: challenges.data,
                  participants: participants.data,
                },
              },
        )
      })
      .catch(() => {
        if (current)
          setContexts({
            ...contextBase,
            state: 'error',
            error:
              'Challenge choices could not be loaded. New entries can still be saved privately.',
          })
      })
    return () => {
      current = false
    }
  }, [auth.status, persistence, requestKey, userId, enabled])

  const currentPersonal =
    personal.key === requestKey
      ? personal
      : { key: requestKey, state: 'loading' as const, data: [], error: '' }
  const currentContexts =
    contexts.key === requestKey
      ? contexts
      : {
          key: requestKey,
          state: 'loading' as const,
          data: emptyChallenges,
          error: '',
        }
  return {
    ownerKey,
    userId,
    persistence,
    personal: currentPersonal,
    contexts: currentContexts,
    groups: currentContexts.data.challenges.filter((challenge) =>
      isEligibleSharingGroup(
        challenge,
        userId,
        currentContexts.data.participants,
      ),
    ),
    refresh: () => notifyPersonalWeightChange(userId),
  }
}

export type PersonalWorkspace = ReturnType<typeof usePersonalWorkspace>
