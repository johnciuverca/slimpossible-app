// Synthetic local-only browser fixture; never a connected acceptance claim.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AuthContext, type AuthContextValue } from '../../src/auth/context'
import { AppLayout } from '../../src/layout/AppLayout'
import { PersonalDashboardPage } from '../../src/pages/PersonalDashboardPage'
import { MyProgressPage } from '../../src/pages/MyProgressPage'
import { PersonalWeighInsPage } from '../../src/pages/PersonalWeighInsPage'
import { ChallengeInvitesPage } from '../../src/pages/ChallengeInvitesPage'
import { ChallengeSetupPage } from '../../src/pages/ChallengeSetupPage'
import {
  GoalsPage,
  HomePage,
  GroupDashboardPage,
} from '../../src/pages/AppPages'
import {
  createChallengeFixture,
  createParticipantFixture,
} from '../../src/models/fixtures'
import { personalWeighInToday } from '../../src/models/personalWeighIn'
import '../../src/index.css'

const params = new URLSearchParams(window.location.search)
const scenario = params.get('scenario')
const hasGroups = ['groups', 'tabs', 'owned-one', 'owned-many'].includes(
  scenario ?? '',
)
const today = personalWeighInToday()
function dateOffset(days: number) {
  const date = new Date(`${today}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
function seedOnce(key: string, rows: unknown[]) {
  if (localStorage.getItem(key) === null)
    localStorage.setItem(key, JSON.stringify(rows))
}
const challenges = hasGroups
  ? [
      createChallengeFixture({
        id: 'dashboard-draft',
        name: 'Synthetic draft group',
        ownerId: 'user-alex',
        createdBy: 'user-alex',
        startDate: dateOffset(-30),
        endDate: dateOffset(30),
      }),
      createChallengeFixture({
        id: 'dashboard-active',
        name: 'Synthetic active group',
        ...(scenario === 'owned-many'
          ? { ownerId: 'user-alex', createdBy: 'user-alex' }
          : {}),
        status: 'active',
        startDate: dateOffset(-30),
        endDate: dateOffset(30),
      }),
      createChallengeFixture({
        id: 'dashboard-personal',
        name: 'Synthetic personal goal',
        kind: 'personal',
        ownerId: 'user-alex',
        createdBy: 'user-alex',
        status: 'active',
        startDate: dateOffset(-30),
        endDate: dateOffset(30),
      }),
    ]
  : []
if (scenario === 'tabs') {
  challenges.push(
    ...Array.from({ length: 12 }, (_, index) =>
      createChallengeFixture({
        id: `extra-${index}`,
        name: `Authorized personal context ${index + 1}`,
        kind: 'personal',
        ownerId: 'user-alex',
        status: 'active',
        startDate: dateOffset(-30),
        endDate: dateOffset(30),
      }),
    ),
  )
  challenges.push(
    createChallengeFixture({
      id: 'second-only',
      name: 'Second account goal',
      kind: 'personal',
      ownerId: 'synthetic-second',
      status: 'active',
    }),
  )
}
seedOnce('slimpossible.local.challenges', challenges)
seedOnce(
  'slimpossible.local.participants',
  hasGroups
    ? challenges.map(({ id, ownerId }) =>
        createParticipantFixture({
          id: `${id}-member`,
          challengeId: id,
          userId: id === 'second-only' ? ownerId : 'user-alex',
        }),
      )
    : [],
)
seedOnce('slimpossible.local.weigh-ins', [])
seedOnce(
  'slimpossible.local.personal-weigh-ins',
  scenario === 'accounts' || scenario === 'tabs'
    ? [
        {
          id: 'account-one-entry',
          userId: 'user-alex',
          date: dateOffset(-1),
          weightKg: 90,
          note: 'Synthetic first-account private note',
          sharedChallengeIds: [],
        },
        {
          id: 'account-two-entry',
          userId: 'synthetic-second',
          date: dateOffset(-1),
          weightKg: 75,
          note: 'Synthetic second-account private note',
          sharedChallengeIds: [],
        },
      ]
    : [],
)

export function Harness() {
  const [userId, setUserId] = useState('user-alex')
  const value: AuthContextValue = {
    state: {
      status: 'signed-in',
      error: null,
      user: {
        id: userId,
        email: `${userId}@example.invalid`,
        displayName:
          userId === 'user-alex' ? 'Synthetic Alex' : 'Synthetic Second',
      },
    },
    requestPasswordRecovery: async () => undefined,
    resetPassword: async () => false,
    retrySession: () => undefined,
    signIn: async () => undefined,
    signOut: async () => undefined,
    signUp: async () => undefined,
  }
  return (
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[params.get('path') ?? '/dashboard']}>
        {scenario === 'accounts' ||
        scenario === 'tabs' ||
        scenario === 'owned-many' ? (
          <div className="bg-panel p-3">
            <button
              className="rounded-xl border border-line px-4 py-3"
              onClick={() =>
                setUserId((current) =>
                  current === 'user-alex' ? 'synthetic-second' : 'user-alex',
                )
              }
            >
              Switch synthetic account
            </button>
          </div>
        ) : null}
        <AppLayout>
          <CurrentRoute />
          <Routes>
            <Route path="/" element={<PersonalDashboardPage />} />
            <Route path="/dashboard" element={<PersonalDashboardPage />} />
            <Route path="/today" element={<PersonalDashboardPage />} />
            <Route path="/progress" element={<MyProgressPage />} />
            <Route path="/weigh-ins" element={<PersonalWeighInsPage />} />
            <Route path="/group" element={<GroupDashboardPage />} />
            <Route path="/goals" element={<GoalsPage />} />
            <Route path="/challenges" element={<HomePage />} />
            <Route path="/challenge/setup" element={<ChallengeSetupPage />} />
            <Route
              path="/challenge/invites"
              element={<ChallengeInvitesPage />}
            />
          </Routes>
        </AppLayout>
      </MemoryRouter>
    </AuthContext.Provider>
  )
}
function CurrentRoute() {
  const location = useLocation()
  return (
    <output data-testid="fixture-route" className="sr-only">
      {location.pathname}
      {location.search}
    </output>
  )
}
createRoot(document.getElementById('root')!).render(<Harness />)
