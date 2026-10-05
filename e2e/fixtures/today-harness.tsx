import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { AuthContext, type AuthContextValue } from '../../src/auth/context'
import { ProtectedRoute } from '../../src/auth/ProtectedRoute'
import { AppLayout } from '../../src/layout/AppLayout'
import { ChallengeSetupPage } from '../../src/pages/ChallengeSetupPage'
import { DailyWeighInFormPage } from '../../src/pages/DailyWeighInFormPage'
import { ParticipantEnrollmentPage } from '../../src/pages/ParticipantEnrollmentPage'
import {
  GoalsPage,
  GroupDashboardPage,
  HomePage,
  ProgressPage,
  TodayPage,
} from '../../src/pages/AppPages'
import '../../src/index.css'

const fixtureUserId = 'e2e-user'
const scenario = new URLSearchParams(window.location.search).get('scenario')
const challengeId = 'e2e-challenge'
const isProgress = scenario === 'progress'
const isGoals = scenario?.startsWith('goals') ?? false
const isGroup = scenario === 'group'
const isHome = scenario?.startsWith('home-') ?? false
const isHomeMulti = scenario === 'home-member-multi'
const isHomeOwner =
  scenario === 'home-owner' || scenario === 'home-owner-member'
const isHomeSignedOut = scenario === 'home-signed-out'
const homeChallengeIds = isHomeMulti
  ? [challengeId, 'e2e-challenge-2']
  : [challengeId]
const initialHomeSelection = new URLSearchParams(window.location.search).get(
  'selected',
)
const initialHomeRoute =
  new URLSearchParams(window.location.search).get('route') ?? '/'
const isMember =
  scenario === 'member' ||
  isProgress ||
  isGoals ||
  isGroup ||
  scenario === 'home-member' ||
  isHomeMulti ||
  scenario === 'home-owner-member'
const hasChallenge =
  scenario !== 'no-challenge' &&
  scenario !== 'home-no-challenge' &&
  !isHomeSignedOut
const challengeOwnerId = isHomeOwner
  ? fixtureUserId
  : isMember
    ? 'e2e-owner'
    : fixtureUserId
const goalScenarios = {
  goals: { current: 88.4, starting: 92, target: 80 },
  'goals-gain': { current: 75, starting: 70, target: 80 },
  'goals-maintenance': { current: 79.9, starting: 80, target: 80 },
  'goals-beyond': { current: 75, starting: 100, target: 80 },
  'goals-empty': { current: null, starting: 92, target: 80 },
} as const
const goalScenario = isGoals
  ? goalScenarios[scenario as keyof typeof goalScenarios]
  : null

function dateOnly(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const currentWeekEntryDate = dateOnly(new Date())
const previousWeekEntryDate = new Date()
previousWeekEntryDate.setDate(previousWeekEntryDate.getDate() - 7)

localStorage.setItem(
  'slimpossible.local.challenges',
  JSON.stringify(
    hasChallenge
      ? homeChallengeIds.map((id, index) => ({
          createdAt: '2026-09-17T10:00:00.000Z',
          createdBy: challengeOwnerId,
          endDate: '2026-10-17',
          id,
          name: isHomeMulti
            ? `E2E ${index === 0 ? 'Autumn' : 'Winter'} challenge`
            : isMember
              ? 'E2E joined challenge'
              : 'E2E owner challenge',
          ownerId: challengeOwnerId,
          startDate: '2026-09-17',
          status: 'active',
          targetWeightKg: isGoals ? 65 : 80,
          updatedAt: '2026-09-17T10:00:00.000Z',
        }))
      : [],
  ),
)
localStorage.setItem(
  'slimpossible.local.participants',
  JSON.stringify(
    isMember
      ? [
          ...homeChallengeIds.map((currentChallengeId, index) => ({
            challengeId: currentChallengeId,
            createdAt: '2026-09-17T10:00:00.000Z',
            displayName: 'E2E member',
            id: index === 0 ? 'e2e-participant' : 'e2e-participant-2',
            joinedAt: '2026-09-17T10:00:00.000Z',
            startingWeightKg: goalScenario?.starting ?? 92,
            status: 'active',
            targetWeightKg: goalScenario?.target ?? 80,
            userId: fixtureUserId,
          })),
          ...(!isHomeMulti
            ? [
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
            : []),
        ]
      : [],
  ),
)
localStorage.setItem(
  'slimpossible.local.weigh-ins',
  JSON.stringify(
    isMember
      ? isGoals
        ? goalScenario?.current === null
          ? []
          : [
              {
                date: currentWeekEntryDate,
                note: 'E2E private goal note.',
                participantId: 'e2e-participant',
                weightKg: goalScenario?.current ?? 88.4,
              },
            ]
        : [
            {
              date: isProgress ? dateOnly(previousWeekEntryDate) : '2026-09-20',
              note: 'Older fixture note',
              participantId: 'e2e-participant',
              weightKg: 90,
            },
            {
              date: isProgress ? currentWeekEntryDate : '2026-09-28',
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
    status: isHomeSignedOut ? 'signed-out' : 'signed-in',
    user: isHomeSignedOut
      ? null
      : { email: 'e2e-user@example.invalid', id: fixtureUserId },
  },
}

createRoot(document.getElementById('root')!).render(
  <AuthContext.Provider value={authValue}>
    <MemoryRouter
      initialEntries={
        isHome
          ? [
              `${initialHomeRoute}${initialHomeSelection ? `?challenge=${encodeURIComponent(initialHomeSelection)}` : ''}`,
            ]
          : isGoals
            ? [`/goals?challenge=${challengeId}`]
            : isProgress
              ? [`/progress?challenge=${challengeId}`]
              : isGroup
                ? [`/group?challenge=${challengeId}`]
                : [isMember ? `/today?challenge=${challengeId}` : '/today']
      }
    >
      <AppLayout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/today" element={<TodayPage />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="/goals" element={<GoalsPage />} />
            <Route path="/group" element={<GroupDashboardPage />} />
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
