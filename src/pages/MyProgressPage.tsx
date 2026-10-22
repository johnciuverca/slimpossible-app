import { PersonalDashboardPage } from './PersonalDashboardPage'

// Legacy personal links open the same author-only Dashboard workspace.
export function MyProgressPage() {
  return <PersonalDashboardPage initialTab="progress" />
}
