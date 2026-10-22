import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../src/auth/AuthContext'
import { AuthSessionUI } from '../../src/auth/AuthSessionUI'
import type { AuthGateway } from '../../src/auth/context'
import '../../src/index.css'

const user = {
  id: 'fixture-profile-user',
  email: 'fixture@example.invalid',
  displayName: 'Fixture Alex',
}
const authGateway: AuthGateway = {
  ensureProfile: async () =>
    localStorage.getItem('fixture.profile.name') ?? user.displayName,
  getSession: async () => user,
  onAuthStateChange: () => () => undefined,
  saveProfileName: async (_user, name) => {
    localStorage.setItem('fixture.profile.name', name)
    return name
  },
  requestPasswordRecovery: async () => undefined,
  resetPassword: async () => undefined,
  signIn: async () => user,
  signOut: async () => undefined,
  signUp: async () => ({ needsVerification: true, user: null }),
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <AuthProvider authGateway={authGateway}>
      <main className="p-6">
        <AuthSessionUI />
      </main>
    </AuthProvider>
  </MemoryRouter>,
)
