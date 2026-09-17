import { createContext, type ReactNode } from 'react'

export type AuthUser = {
  email: string
  id?: string
}

export type AuthState =
  | { error: null; status: 'loading'; user: null }
  | { error: null; status: 'signed-out'; user: null }
  | { error: null; status: 'signed-in'; user: AuthUser }
  | { error: null; status: 'verification-pending'; user: null }
  | { error: string; status: 'error'; user: null }

export type AuthContextValue = {
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
  getSession: () => Promise<AuthUser | null>
  onAuthStateChange: (callback: (user: AuthUser | null) => void) => () => void
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
