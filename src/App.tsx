import { useEffect, useMemo, useState } from 'react'
import {
  createBrowserRouter,
  createRoutesFromElements,
  RouterProvider,
  Outlet,
  Route,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom'

import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppLayout } from './layout/AppLayout'
import { ChallengeSetupPage } from './pages/ChallengeSetupPage'
import { PersonalWeighInsPage } from './pages/PersonalWeighInsPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { LoginPage } from './pages/LoginPage'
import { ParticipantEnrollmentPage } from './pages/ParticipantEnrollmentPage'
import { ChallengeInvitesPage } from './pages/ChallengeInvitesPage'
import { InviteAcceptancePage } from './pages/InviteAcceptancePage'
import { RegisterPage } from './pages/RegisterPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { PersonalDashboardPage } from './pages/PersonalDashboardPage'
import { useOptionalAuth } from './auth/useAuth'
import { createPersistence } from './data/persistence'
import {
  GroupDashboardPage,
  HomePage,
  MilestonePreviewPage,
  NotFoundPage,
} from './pages/AppPages'

function RoutedLayout() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  )
}

function HomeRoute() {
  const { state } = useOptionalAuth()
  const [params] = useSearchParams()
  if (state.status !== 'signed-in') return <HomePage />
  return params.has('challenge') ? (
    <WorkspaceCompatibilityRoute destination="challenge" />
  ) : (
    <PersonalDashboardPage />
  )
}

export function WorkspaceCompatibilityRoute({
  destination,
}: {
  destination: 'challenge' | 'goals' | 'progress' | 'today'
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const { state } = useOptionalAuth()
  const persistence = useMemo(() => createPersistence(state), [state])
  const requestedChallenge = new URLSearchParams(location.search).get(
    'challenge',
  )
  const ownerId = state.user?.id ?? ''
  const key = JSON.stringify([
    destination,
    location.search,
    location.hash,
    state.status,
    ownerId,
    persistence.mode,
  ])

  useEffect(() => {
    let current = true
    const resolve = async () => {
      let eligibleChallenge: {
        kind: 'group' | 'personal'
        owner: boolean
      } | null = null
      if (
        requestedChallenge &&
        state.status === 'signed-in' &&
        ownerId &&
        persistence.mode !== 'unavailable'
      ) {
        const [challenges, participants] = await Promise.all([
          persistence.repositories.challenges.listVisibleToUser(ownerId),
          persistence.repositories.participants.listForUser(ownerId),
        ])
        if (challenges.state === 'success') {
          const challenge = challenges.data.find(
            ({ id }) => id === requestedChallenge,
          )
          const owner = challenge?.ownerId === ownerId
          const activeMember =
            participants.state === 'success' &&
            participants.data.some(
              (participant) =>
                participant.challengeId === requestedChallenge &&
                participant.status === 'active',
            )
          if (
            challenge &&
            (activeMember || (owner && destination === 'challenge'))
          ) {
            eligibleChallenge = {
              kind: challenge.kind,
              owner: owner && !activeMember,
            }
          }
        }
      }
      if (!current) return

      const params = new URLSearchParams(location.search)
      let path = '/dashboard'
      if (destination === 'today') params.set('tab', 'overview')
      if (destination === 'progress' || destination === 'goals') {
        path = '/dashboard'
        params.set('tab', 'overview')
      } else if (
        destination === 'challenge' &&
        eligibleChallenge?.kind === 'group'
      ) {
        path = '/group'
      } else if (
        destination === 'challenge' &&
        eligibleChallenge?.kind === 'personal'
      ) {
        if (eligibleChallenge.owner) {
          path = '/challenge/participants/enroll'
          params.set('self', 'owner')
        } else {
          params.set('tab', 'overview')
        }
      }

      if (requestedChallenge && !eligibleChallenge) {
        params.delete('challenge')
        params.set('navigation', 'challenge-unavailable')
      }
      const hash =
        destination === 'goals' && !location.hash ? '#goals' : location.hash
      const query = params.toString()
      navigate(`${path}${query ? `?${query}` : ''}${hash}`, { replace: true })
    }
    void resolve().catch(() => {
      if (!current) return
      const params = new URLSearchParams(location.search)
      if (requestedChallenge) {
        params.delete('challenge')
        params.set('navigation', 'challenge-unavailable')
      }
      if (destination === 'today') params.set('tab', 'overview')
      if (destination === 'progress' || destination === 'goals')
        params.set('tab', 'overview')
      const query = params.toString()
      navigate(
        `/dashboard${query ? `?${query}` : ''}${destination === 'goals' && !location.hash ? '#goals' : location.hash}`,
        { replace: true },
      )
    })
    return () => {
      current = false
    }
  }, [
    destination,
    key,
    location,
    navigate,
    ownerId,
    persistence,
    requestedChallenge,
    state,
  ])

  return <p role="status">Opening the current workspace…</p>
}

function App() {
  const [router] = useState(() =>
    createBrowserRouter(
      createRoutesFromElements(
        <Route element={<RoutedLayout />}>
          <Route index element={<HomeRoute />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
          <Route path="challenge/setup" element={<ChallengeSetupPage />} />
          <Route path="invite/:token" element={<InviteAcceptancePage />} />
          <Route path="weigh-ins" element={<PersonalWeighInsPage />} />
          <Route path="milestones-preview" element={<MilestonePreviewPage />} />
          <Route
            path="challenge/participants/enroll"
            element={<ParticipantEnrollmentPage />}
          />
          <Route element={<ProtectedRoute />}>
            <Route path="dashboard" element={<PersonalDashboardPage />} />
            <Route
              path="today"
              element={<WorkspaceCompatibilityRoute destination="today" />}
            />
            <Route
              path="challenges"
              element={<WorkspaceCompatibilityRoute destination="challenge" />}
            />
            <Route
              path="progress"
              element={<WorkspaceCompatibilityRoute destination="progress" />}
            />
            <Route path="group" element={<GroupDashboardPage />} />
            <Route
              path="goals"
              element={<WorkspaceCompatibilityRoute destination="goals" />}
            />
            <Route
              path="challenge/invites"
              element={<ChallengeInvitesPage />}
            />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>,
      ),
    ),
  )
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}

export default App
