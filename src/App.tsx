import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom'

import { AppLayout } from './layout/AppLayout'
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
