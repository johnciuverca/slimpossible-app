import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { AuthContext, type AuthContextValue } from '../../src/auth/context'
import { ProtectedRoute } from '../../src/auth/ProtectedRoute'
import { AppLayout } from '../../src/layout/AppLayout'
import { ChallengeSetupPage } from '../../src/pages/ChallengeSetupPage'
import { DailyWeighInFormPage } from '../../src/pages/DailyWeighInFormPage'
import { ParticipantEnrollmentPage } from '../../src/pages/ParticipantEnrollmentPage'
import { TodayPage } from '../../src/pages/AppPages'
import '../../src/index.css'

const fixtureUserId = 'e2e-user'
const scenario = new URLSearchParams(window.location.search).get('scenario')
const challengeId = 'e2e-challenge'
const isMember = scenario === 'member'
const hasChallenge = scenario !== 'no-challenge'

localStorage.setItem(
  'slimpossible.local.challenges',
  JSON.stringify(
    hasChallenge
      ? [
          {
            createdAt: '2026-09-17T10:00:00.000Z',
            createdBy: isMember ? 'e2e-owner' : fixtureUserId,
            endDate: '2026-10-17',
            id: challengeId,
            name: isMember ? 'E2E joined challenge' : 'E2E owner challenge',
            ownerId: isMember ? 'e2e-owner' : fixtureUserId,
            startDate: '2026-09-17',
            status: 'active',
            targetWeightKg: 80,
            updatedAt: '2026-09-17T10:00:00.000Z',
          },
        ]
      : [],
  ),
)
localStorage.setItem(
  'slimpossible.local.participants',
  JSON.stringify(
    isMember
      ? [
          {
            challengeId,
            createdAt: '2026-09-17T10:00:00.000Z',
            displayName: 'E2E member',
            id: 'e2e-participant',
            joinedAt: '2026-09-17T10:00:00.000Z',
            startingWeightKg: 92,
            status: 'active',
            targetWeightKg: 80,
            userId: fixtureUserId,
          },
          {
            challengeId,
            createdAt: '2026-09-17T10:00:00.000Z',
            displayName: 'Another E2E member',
            id: 'e2e-other-participant',
            joinedAt: '2026-09-17T10:00:00.000Z',
            startingWeightKg: 90,
            status: 'active',
            targetWeightKg: 75,
            userId: 'e2e-other-user',
          },
        ]
      : [],
  ),
)
localStorage.setItem(
  'slimpossible.local.weigh-ins',
  JSON.stringify(
    isMember
      ? [
          {
            date: '2026-09-20',
            note: 'Older fixture note',
            participantId: 'e2e-participant',
            weightKg: 90,
          },
          {
            date: '2026-09-28',
            note: 'E2E private note for the signed-in participant.',
            participantId: 'e2e-participant',
            weightKg: 88.4,
          },
          {
            date: '2026-09-28',
            note: 'Other participant private note must not appear.',
            participantId: 'e2e-other-participant',
            weightKg: 76.2,
          },
        ]
      : [],
  ),
)

const authValue: AuthContextValue = {
  requestPasswordRecovery: async () => undefined,
  resetPassword: async () => false,
  retrySession: () => undefined,
  signIn: async () => undefined,
  signOut: async () => undefined,
  signUp: async () => undefined,
  state: {
    error: null,
    status: 'signed-in',
    user: { email: 'e2e-user@example.invalid', id: fixtureUserId },
  },
}

createRoot(document.getElementById('root')!).render(
  <AuthContext.Provider value={authValue}>
    <MemoryRouter
      initialEntries={[isMember ? `/today?challenge=${challengeId}` : '/today']}
    >
      <AppLayout>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/today" element={<TodayPage />} />
          </Route>
          <Route
            path="/challenge/participants/enroll"
            element={<ParticipantEnrollmentPage />}
          />
          <Route path="/challenge/setup" element={<ChallengeSetupPage />} />
          <Route path="/weigh-ins" element={<DailyWeighInFormPage />} />
        </Routes>
      </AppLayout>
    </MemoryRouter>
  </AuthContext.Provider>,
)
