import { createContext, type ReactNode } from 'react'
import type { ProfileAvatarPresetId } from './profileAvatar'

export type ProfileAvatarSelection = {
  avatarPath: string | null
  presetId: ProfileAvatarPresetId | null
}

export type ProfileAvatarState = ProfileAvatarSelection & { signedUrl?: string }

export type AuthUser = {
  displayName?: string
  email: string
  id?: string
}

export type AuthState =
  | { error: null; status: 'loading'; user: null }
  | { error: null; status: 'signed-out'; user: null }
  | {
      error: null
      profileError?: string
      status: 'signed-in'
      user: AuthUser
    }
  | { error: null; status: 'verification-pending'; user: null }
  | { error: null; status: 'recovery-requested'; user: null }
  | { error: null; status: 'recovery-ready'; user: AuthUser }
  | { error: null; status: 'recovery-invalid'; user: null }
  | { error: string; status: 'error'; user: null }

export type AuthContextValue = {
  changePassword: (
    currentPassword: string,
    password: string,
    nonce?: string,
  ) => Promise<'updated' | 'reauthentication-required' | false>
  getProfileAvatarUrl?: () => Promise<string | undefined>
  getProfileAvatar?: () => Promise<ProfileAvatarState | undefined>
  chooseProfileAvatar?: (presetId: ProfileAvatarPresetId) => Promise<boolean>
  saveProfileAvatar?: (file: File) => Promise<boolean>
  clearProfileAvatar?: () => Promise<boolean>
  requestEmailChange: (email: string) => Promise<boolean>
  saveProfileName: (name: string) => Promise<boolean>
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
  changePassword?: (
    user: AuthUser,
    currentPassword: string,
    password: string,
    nonce?: string,
  ) => Promise<'updated' | 'reauthentication-required'>
  getProfileAvatarUrl?: (user: AuthUser) => Promise<string | undefined>
  getProfileAvatar?: (user: AuthUser) => Promise<ProfileAvatarState | undefined>
  chooseProfileAvatar?: (
    user: AuthUser,
    presetId: ProfileAvatarPresetId,
  ) => Promise<void>
  saveProfileAvatar?: (user: AuthUser, file: File) => Promise<void>
  clearProfileAvatar?: (user: AuthUser) => Promise<void>
  requestEmailChange: (user: AuthUser, email: string) => Promise<void>
  saveProfileName: (user: AuthUser, name: string) => Promise<string>
  ensureProfile: (user: AuthUser) => Promise<string | undefined>
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
