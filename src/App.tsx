import {
  BrowserRouter,
  Outlet,
  Route,
  Routes,
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
import { MyProgressPage } from './pages/MyProgressPage'
import { useOptionalAuth } from './auth/useAuth'
import {
  GroupDashboardPage,
  GoalsPage,
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
  return state.status === 'signed-in' && !params.has('challenge') ? (
    <PersonalDashboardPage />
  ) : (
    <HomePage />
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<RoutedLayout />}>
            <Route index element={<HomeRoute />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />
            <Route path="challenge/setup" element={<ChallengeSetupPage />} />
            <Route path="invite/:token" element={<InviteAcceptancePage />} />
            <Route path="weigh-ins" element={<PersonalWeighInsPage />} />
            <Route
              path="milestones-preview"
              element={<MilestonePreviewPage />}
            />
            <Route
              path="challenge/participants/enroll"
              element={<ParticipantEnrollmentPage />}
            />
            <Route element={<ProtectedRoute />}>
              <Route path="dashboard" element={<PersonalDashboardPage />} />
              <Route path="today" element={<PersonalDashboardPage />} />
              <Route path="challenges" element={<HomePage />} />
              <Route path="progress" element={<MyProgressPage />} />
              <Route path="group" element={<GroupDashboardPage />} />
              <Route path="goals" element={<GoalsPage />} />
              <Route
                path="challenge/invites"
                element={<ChallengeInvitesPage />}
              />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
