import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom'

import { AppLayout } from './layout/AppLayout'
import { LoginPage } from './pages/LoginPage'
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
    <BrowserRouter>
      <Routes>
        <Route element={<RoutedLayout />}>
          <Route index element={<HomePage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="today" element={<TodayPage />} />
          <Route path="progress" element={<ProgressPage />} />
          <Route path="goals" element={<GoalsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
