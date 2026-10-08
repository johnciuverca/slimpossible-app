// Synthetic local browser coverage, not connected Supabase acceptance.
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { AuthContext, type AuthContextValue } from '../../src/auth/context'
import { AppLayout } from '../../src/layout/AppLayout'
import {
  createChallengeFixture,
  createParticipantFixture,
  participantFixture,
} from '../../src/models/fixtures'
import { PersonalWeighInsPage } from '../../src/pages/PersonalWeighInsPage'
import '../../src/index.css'

const scenario = new URLSearchParams(window.location.search).get('scenario')
const userId = participantFixture.userId
const hasGroups = scenario === 'groups'
const draftGroup = createChallengeFixture({
  id: 'canonical-draft-group',
  name: 'Synthetic draft group',
  ownerId: userId,
  createdBy: userId,
})
const activeGroup = createChallengeFixture({
  id: 'canonical-active-group',
  name: 'Synthetic active group',
  status: 'active',
})

function seedOnce(key: string, values: unknown[]) {
  if (localStorage.getItem(key) === null) {
    localStorage.setItem(key, JSON.stringify(values))
  }
}

seedOnce(
  'slimpossible.local.challenges',
  hasGroups ? [draftGroup, activeGroup] : [],
)
seedOnce(
  'slimpossible.local.participants',
  hasGroups ? [createParticipantFixture({ challengeId: activeGroup.id })] : [],
)
seedOnce('slimpossible.local.weigh-ins', [])
seedOnce('slimpossible.local.personal-weigh-ins', [])

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
    user: { email: 'canonical-preview@example.invalid', id: userId },
  },
}

createRoot(document.getElementById('root')!).render(
  <AuthContext.Provider value={authValue}>
    <MemoryRouter initialEntries={['/weigh-ins']}>
      <AppLayout>
        <Routes>
          <Route path="/weigh-ins" element={<PersonalWeighInsPage />} />
          <Route path="/today" element={<p>Synthetic Today route</p>} />
        </Routes>
      </AppLayout>
    </MemoryRouter>
  </AuthContext.Provider>,
)
