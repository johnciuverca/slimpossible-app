// Synthetic local-only integration: the target RPC is faked, never hosted SQL.
import { useMemo, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  createBrowserRouter,
  RouterProvider,
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { AuthContext, type AuthContextValue } from '../../src/auth/context'
import { AppLayout } from '../../src/layout/AppLayout'
import { PersonalDashboardWorkspace } from '../../src/pages/PersonalDashboardPage'
import { PersonalWeighInsPage } from '../../src/pages/PersonalWeighInsPage'
import { usePersonalWorkspace } from '../../src/data/usePersonalWorkspace'
import {
  createChallengeFixture,
  createParticipantFixture,
} from '../../src/models/fixtures'
import type { Participant } from '../../src/models/participant'
import type { ReachedTargetMilestone } from '../../src/models/targetMilestone'
import '../../src/index.css'

const params = new URLSearchParams(window.location.search)
const initialPath = params.get('path') ?? '/dashboard'
const native = params.get('native') === '1'
const today = new Date().toISOString().slice(0, 10)
const ago = (days: number) =>
  new Date(Date.parse(`${today}T00:00:00Z`) - days * 86400000)
    .toISOString()
    .slice(0, 10)
const groups = [
  createChallengeFixture({
    id: 'goal-one',
    name: 'Synthetic first group',
    ownerId: 'user-alex',
    status: 'active',
  }),
  createChallengeFixture({
    id: 'goal-two',
    name: 'Synthetic second group',
    ownerId: 'user-alex',
    status: 'active',
  }),
]
const members = groups.map((group) =>
  createParticipantFixture({
    id: `${group.id}-self`,
    challengeId: group.id,
    startingWeightKg: 100,
    targetWeightKg: 90,
    joinedAt: `${ago(5)}T00:00:00Z`,
  }),
)
function seed(key: string, value: unknown) {
  if (localStorage.getItem(key) === null)
    localStorage.setItem(key, JSON.stringify(value))
}
const personal = createChallengeFixture({
  id: 'personal-goal',
  name: 'Synthetic personal goal',
  kind: 'personal',
  ownerId: 'user-alex',
  status: 'active',
})
seed(
  'slimpossible.local.challenges',
  params.get('groupOnly') === '1' ? groups : [...groups, personal],
)
seed('slimpossible.local.participants', [
  ...members,
  ...(params.get('groupOnly') === '1'
    ? []
    : [
        createParticipantFixture({
          id: 'personal-self',
          challengeId: personal.id,
          startingWeightKg: 100,
          targetWeightKg: 90,
        }),
      ]),
  createParticipantFixture({
    id: 'peer',
    challengeId: 'goal-one',
    userId: 'peer',
  }),
])
seed('slimpossible.local.weigh-ins', [])
seed('slimpossible.local.personal-weigh-ins', [
  {
    id: 'own-shared',
    userId: 'user-alex',
    date: ago(2),
    weightKg: params.get('reached') === '1' ? 89 : 94.8,
    sharedChallengeIds: ['goal-one'],
    note: 'Synthetic own shared note',
  },
  {
    id: 'own-private',
    userId: 'user-alex',
    date: ago(1),
    weightKg: 60,
    sharedChallengeIds: [],
    note: 'Synthetic private latest note',
  },
  {
    id: 'peer-private',
    userId: 'peer',
    date: ago(1),
    weightKg: 33,
    sharedChallengeIds: [],
    note: 'Peer secret must stay hidden',
  },
  {
    id: 'second-private',
    userId: 'second-user',
    date: ago(1),
    weightKg: 75,
    sharedChallengeIds: [],
    note: 'Synthetic second account note',
  },
])
seed('synthetic.target-milestones', {
  'user-alex:goal-one': [
    { targetWeightKg: 95, achievedOn: ago(3), state: 'reached' },
  ],
})

export function FakeDashboard({
  initialTab = 'overview',
}: {
  initialTab?: 'overview' | 'progress'
}) {
  const workspace = usePersonalWorkspace()
  const persistence = useMemo(() => {
    if (workspace.persistence.mode === 'unavailable')
      return workspace.persistence
    return {
      ...workspace.persistence,
      repositories: {
        ...workspace.persistence.repositories,
        participants: {
          ...workspace.persistence.repositories.participants,
          async changeOwnGroupTarget(challengeId: string, target: number) {
            sessionStorage.setItem(
              'synthetic.target-calls',
              String(
                Number(sessionStorage.getItem('synthetic.target-calls') ?? 0) +
                  1,
              ),
            )
            await new Promise((resolve) =>
              setTimeout(resolve, Number(params.get('delay') ?? 30)),
            )
            const rows: Participant[] = JSON.parse(
              localStorage.getItem('slimpossible.local.participants') ?? '[]',
            )
            const member = rows.find(
              (row) =>
                row.userId === workspace.userId &&
                row.challengeId === challengeId &&
                row.status === 'active',
            )
            if (!member || target <= 0 || target >= member.startingWeightKg)
              return {
                state: 'error' as const,
                error: {
                  kind: 'request' as const,
                  message: 'Synthetic target rejected',
                },
              }
            const entries: {
              userId: string
              date: string
              weightKg: number
              sharedChallengeIds: string[]
            }[] = JSON.parse(
              localStorage.getItem('slimpossible.local.personal-weigh-ins') ??
                '[]',
            )
            const evidence = entries
              .filter(
                (entry) =>
                  entry.userId === workspace.userId &&
                  entry.sharedChallengeIds.includes(challengeId) &&
                  entry.date >= member.joinedAt!.slice(0, 10) &&
                  entry.date <= today &&
                  entry.weightKg <= member.targetWeightKg,
              )
              .sort((a, b) => a.date.localeCompare(b.date))[0]
            if (evidence && target >= member.targetWeightKg)
              return {
                state: 'error' as const,
                error: {
                  kind: 'request' as const,
                  message: 'Synthetic reached target must move lower',
                },
              }
            const previousTargetMilestone: ReachedTargetMilestone | null =
              evidence
                ? {
                    targetWeightKg: member.targetWeightKg,
                    achievedOn: evidence.date,
                    state: 'reached',
                  }
                : null
            if (previousTargetMilestone) {
              const milestones: Record<string, ReachedTargetMilestone[]> =
                JSON.parse(
                  localStorage.getItem('synthetic.target-milestones') ?? '{}',
                )
              const key = `${workspace.userId}:${challengeId}`
              milestones[key] = [
                ...(milestones[key] ?? []),
                previousTargetMilestone,
              ]
              localStorage.setItem(
                'synthetic.target-milestones',
                JSON.stringify(milestones),
              )
            }
            member.targetWeightKg = target
            localStorage.setItem(
              'slimpossible.local.participants',
              JSON.stringify(rows),
            )
            return {
              state: 'success' as const,
              data: {
                challengeId,
                startingWeightKg: member.startingWeightKg,
                targetWeightKg: target,
                previousTargetMilestone,
              },
            }
          },
          async listOwnGroupTargetMilestones(challengeId: string) {
            const rows: Record<string, ReachedTargetMilestone[]> = JSON.parse(
              localStorage.getItem('synthetic.target-milestones') ?? '{}',
            )
            return {
              state: 'success' as const,
              data: rows[`${workspace.userId}:${challengeId}`] ?? [],
            }
          },
        },
      },
    }
  }, [workspace.persistence, workspace.userId])
  return (
    <PersonalDashboardWorkspace
      workspace={{ ...workspace, persistence }}
      initialTab={initialTab}
    />
  )
}
export function CurrentRoute() {
  const location = useLocation()
  return (
    <output data-testid="fixture-route" className="sr-only">
      {location.pathname}
      {location.search}
      {location.hash}
    </output>
  )
}
export function Harness() {
  const [userId, setUserId] = useState('user-alex')
  const value: AuthContextValue = {
    state: {
      status: 'signed-in',
      error: null,
      user: {
        id: userId,
        email: `${userId}@example.invalid`,
        displayName: 'Synthetic account',
      },
    },
    saveProfileName: async () => false,
    requestPasswordRecovery: async () => undefined,
    resetPassword: async () => false,
    retrySession: () => undefined,
    signIn: async () => undefined,
    signOut: async () => undefined,
    signUp: async () => undefined,
  }
  const children = (
    <>
      <button
        onClick={() =>
          setUserId((current) =>
            current === 'user-alex' ? 'second-user' : 'user-alex',
          )
        }
      >
        Switch synthetic account
      </button>
      <AppLayout>
        <CurrentRoute />
        <Routes>
          <Route path="/dashboard" element={<FakeDashboard />} />
          <Route path="/weigh-ins" element={<PersonalWeighInsPage />} />
          <Route
            path="/progress"
            element={<FakeDashboard initialTab="progress" />}
          />
          <Route
            path="/goals"
            element={<FakeDashboard initialTab="progress" />}
          />
          <Route
            path="/invite/:token"
            element={<p>Existing invitation acceptance flow</p>}
          />
          <Route
            path="/group"
            element={<p>Authorized selected Group destination</p>}
          />
        </Routes>
      </AppLayout>
    </>
  )
  return (
    <AuthContext.Provider value={value}>
      {native ? (
        <NativeRouter>{children}</NativeRouter>
      ) : (
        <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>
      )}
    </AuthContext.Provider>
  )
}
export function NativeRouter({ children }: { children: ReactNode }) {
  const [router] = useState(() =>
    createBrowserRouter([{ path: '*', element: children }]),
  )
  return <RouterProvider router={router} />
}
if (native) window.history.replaceState({ idx: 0 }, '', initialPath)
createRoot(document.getElementById('root')!).render(<Harness />)
