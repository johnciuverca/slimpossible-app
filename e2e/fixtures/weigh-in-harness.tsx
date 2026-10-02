import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { AuthContext, type AuthContextValue } from '../../src/auth/context'
import { AppLayout } from '../../src/layout/AppLayout'
import {
  createChallengeFixture,
  createParticipantFixture,
} from '../../src/models/fixtures'
import { DailyWeighInFormPage } from '../../src/pages/DailyWeighInFormPage'
import '../../src/index.css'

const query = new URLSearchParams(window.location.search)
const challengeId = query.get('challenge') ?? 'challenge-1'
const challenge = createChallengeFixture({
  id: challengeId,
  status: 'active',
})
const participant = createParticipantFixture({ challengeId })

function seedLocalPreview(key: string, values: unknown[]) {
  if (localStorage.getItem(key) === null) {
    localStorage.setItem(key, JSON.stringify(values))
  }
}

seedLocalPreview('slimpossible.local.challenges', [challenge])
seedLocalPreview('slimpossible.local.participants', [participant])
seedLocalPreview('slimpossible.local.weigh-ins', [])

const authValue: AuthContextValue = {
  requestPasswordRecovery: async () => undefined,
  resetPassword: async () => false,
  retrySession: () => undefined,
  signIn: async () => undefined,
  signOut: async () => undefined,
  signUp: async () => undefined,
  state: {
    error: null,
    status: 'signed-in',
    user: { email: 'weigh-in-preview@example.invalid', id: participant.userId },
  },
}

createRoot(document.getElementById('root')!).render(
  <AuthContext.Provider value={authValue}>
    <MemoryRouter
      initialEntries={[
        `/weigh-ins?challenge=${encodeURIComponent(challengeId)}`,
      ]}
    >
      <AppLayout>
        <Routes>
          <Route path="/weigh-ins" element={<DailyWeighInFormPage />} />
          <Route path="/today" element={<p>Today fixture route</p>} />
        </Routes>
      </AppLayout>
    </MemoryRouter>
  </AuthContext.Provider>,
)
