import { createContext, type ReactNode } from 'react'

export type AuthUser = {
  email: string
}

export type AuthState =
  | { error: null; status: 'loading'; user: null }
  | { error: null; status: 'signed-out'; user: null }
  | { error: null; status: 'signed-in'; user: AuthUser }
  | { error: string; status: 'error'; user: null }

export type AuthContextValue = {
  retrySession: () => void
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => void
  state: AuthState
}

export type AuthProviderProps = {
  children: ReactNode
  initialState?: AuthState
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
)
