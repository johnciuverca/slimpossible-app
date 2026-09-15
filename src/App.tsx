import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom'

import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppLayout } from './layout/AppLayout'
import { ChallengeSetupPage } from './pages/ChallengeSetupPage'
import { DailyWeighInFormPage } from './pages/DailyWeighInFormPage'
import { LoginPage } from './pages/LoginPage'
import { ParticipantEnrollmentPage } from './pages/ParticipantEnrollmentPage'
import { RegisterPage } from './pages/RegisterPage'
import {
  GoalsPage,
  HomePage,
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
            <Route path="challenge/setup" element={<ChallengeSetupPage />} />
            <Route path="weigh-ins" element={<DailyWeighInFormPage />} />
            <Route
              path="challenge/participants/enroll"
              element={<ParticipantEnrollmentPage />}
            />
            <Route element={<ProtectedRoute />}>
              <Route path="today" element={<TodayPage />} />
              <Route path="progress" element={<ProgressPage />} />
              <Route path="goals" element={<GoalsPage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
