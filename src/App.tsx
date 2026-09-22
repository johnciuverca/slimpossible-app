import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom'

import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppLayout } from './layout/AppLayout'
import { ChallengeSetupPage } from './pages/ChallengeSetupPage'
import { DailyWeighInFormPage } from './pages/DailyWeighInFormPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { LoginPage } from './pages/LoginPage'
import { ParticipantEnrollmentPage } from './pages/ParticipantEnrollmentPage'
import { ChallengeInvitesPage } from './pages/ChallengeInvitesPage'
import { InviteAcceptancePage } from './pages/InviteAcceptancePage'
import { RegisterPage } from './pages/RegisterPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import {
  GoalsPage,
  HomePage,
  MilestonePreviewPage,
  NotFoundPage,
  ProgressPage,
  TodayPage,
} from './pages/AppPages'

function RoutedLayout() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<RoutedLayout />}>
            <Route index element={<HomePage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />
            <Route path="challenge/setup" element={<ChallengeSetupPage />} />
            <Route path="invite/:token" element={<InviteAcceptancePage />} />
            <Route path="weigh-ins" element={<DailyWeighInFormPage />} />
            <Route
              path="milestones-preview"
              element={<MilestonePreviewPage />}
            />
            <Route
              path="challenge/participants/enroll"
              element={<ParticipantEnrollmentPage />}
            />
            <Route element={<ProtectedRoute />}>
              <Route path="today" element={<TodayPage />} />
              <Route path="progress" element={<ProgressPage />} />
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
