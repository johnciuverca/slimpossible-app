import { createContext, type ReactNode } from 'react'

export type AuthUser = {
  displayName?: string
  email: string
  id?: string
}

export type AuthState =
  | { error: null; status: 'loading'; user: null }
  | { error: null; status: 'signed-out'; user: null }
  | { error: null; status: 'signed-in'; user: AuthUser }
  | { error: null; status: 'verification-pending'; user: null }
  | { error: null; status: 'recovery-requested'; user: null }
  | { error: null; status: 'recovery-ready'; user: AuthUser }
  | { error: null; status: 'recovery-invalid'; user: null }
  | { error: string; status: 'error'; user: null }

export type AuthContextValue = {
  requestPasswordRecovery: (email: string) => Promise<void>
  resetPassword: (password: string) => Promise<boolean>
  retrySession: () => void
  signIn: (email: string, password: string) => Promise<void>
  signUp: (name: string, email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  state: AuthState
}

export type AuthProviderProps = {
  children: ReactNode
  authGateway?: AuthGateway
  initialState?: AuthState
}

export type AuthGateway = {
  ensureProfile: (user: AuthUser) => Promise<void>
  getSession: () => Promise<AuthUser | null>
  onAuthStateChange: (
    callback: (user: AuthUser | null, event?: string) => void,
  ) => () => void
  requestPasswordRecovery: (email: string, redirectTo: string) => Promise<void>
  resetPassword: (password: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<AuthUser>
  signUp: (
    name: string,
    email: string,
    password: string,
  ) => Promise<{
    user: AuthUser | null
    needsVerification: boolean
  }>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
)
