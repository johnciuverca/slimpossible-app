import { createSupabaseBrowserClient } from '../data/supabase/client'
import { createRepositories } from '../data/supabase/repositories'
import { getVerificationRedirectUrl } from './authRedirects'
import { normalizeProfileName, safeProfileDisplayName } from './profileName'
import type { AuthGateway, AuthUser } from './context'
import {
  isProfileAvatarPresetId,
  validateProfileAvatarFile,
} from './profileAvatar'

function mapUser(user: {
  id: string
  email?: string | null
  user_metadata?: { display_name?: unknown }
}): AuthUser {
  return {
    displayName: safeProfileDisplayName(
      user.user_metadata?.display_name,
      user.email ?? '',
    ),
    email: user.email ?? '',
    id: user.id,
  }
}

export function mapSupabaseAuthError(
  error: unknown,
  operation:
    | 'password-change'
    | 'password-recovery'
    | 'password-update'
    | 'sign-in'
    | 'sign-up',
) {
  const authError =
    error && typeof error === 'object'
      ? (error as { code?: string; message?: string; status?: number })
      : null
  const message = authError?.message?.toLowerCase() ?? ''

  if (operation === 'password-change') {
    if (authError?.code === 'reauthentication_not_valid')
      return 'That verification code did not work. Check it and try again.'
    if (authError?.status === 429 || message.includes('rate'))
      return 'Too many attempts. Wait a moment and try again.'
    if (message.includes('current password'))
      return 'Your current password could not be verified. Check it and try again.'
    if (
      authError?.code === 'weak_password' ||
      message.includes('weak password')
    )
      return 'Choose a stronger password that meets your account requirements.'
    if (authError?.status === undefined && message.includes('fetch'))
      return 'We could not reach authentication. Check your connection and try again.'
    return 'We could not change your password. Check your details and try again.'
  }

  if (authError?.status === 429 || message.includes('rate')) {
    return 'Too many attempts. Wait a moment and try again.'
  }
  if (operation === 'sign-in' && message.includes('invalid login')) {
    return 'The email or password is incorrect. Check them and try again.'
  }
  if (
    operation === 'password-update' &&
    (message.includes('expired') ||
      message.includes('invalid') ||
      message.includes('session'))
  ) {
    return 'This recovery link is invalid or expired. Request a new link.'
  }
  if (
    operation === 'sign-up' &&
    (message.includes('already registered') ||
      message.includes('already exists'))
  ) {
    return 'An account with this email already exists. Try signing in instead.'
  }
  if (authError?.status === undefined && message.includes('fetch')) {
    return 'We could not reach authentication. Check your connection and try again.'
  }
  if (operation === 'sign-in') {
    return 'We could not sign you in. Check your details and try again.'
  }
  if (operation === 'sign-up') {
    return 'We could not create your account. Check your details and try again.'
  }
  if (operation === 'password-recovery') {
    return 'We could not request a recovery link. Try again.'
  }
  return 'We could not update your password. Request a new recovery link.'
}

export function createSupabaseAuthGateway(): AuthGateway {
  const clientResult = createSupabaseBrowserClient()

  function getConfiguredClient() {
    if (clientResult.state !== 'configured')
      throw new Error(clientResult.message)
    return clientResult.client
  }

  async function getOrInitializeAvatarSelection(
    profiles: ReturnType<typeof createRepositories>['profiles'],
    userId: string,
  ) {
    const current = await profiles.getAvatarSelection(userId)
    if (current.state === 'success') return current.data
    if (current.state === 'error')
      throw new Error('We could not load your current avatar. Try again.')

    // Some older accounts have no profile row until they first save a name.
    // Create an owner row with a neutral label before storing avatar metadata.
    const initialized = await profiles.ensure({
      id: userId,
      displayName: 'Member',
    })
    if (initialized.state !== 'success')
      throw new Error(
        'We could not initialize your profile picture. Try again.',
      )
    return { avatarPath: null, presetId: null }
  }

  return {
    async getProfileAvatarUrl(user) {
      const client = getConfiguredClient()
      const { data: authData, error: authError } = await client.auth.getUser()
      if (authError || !user.id || authData.user?.id !== user.id) return
      const result = await createRepositories(
        client,
      ).profiles.getAvatarSelection(user.id)
      if (result.state !== 'success' || !result.data.avatarPath) return
      const { data, error } = await client.storage
        .from('profile-avatars')
        .createSignedUrl(result.data.avatarPath, 300)
      return error ? undefined : data.signedUrl
    },
    async getProfileAvatar(user) {
      const client = getConfiguredClient()
      const { data: authData, error: authError } = await client.auth.getUser()
      if (authError || !user.id || authData.user?.id !== user.id) return
      const result = await createRepositories(
        client,
      ).profiles.getAvatarSelection(user.id)
      if (result.state === 'error')
        throw new Error('We could not load your profile picture. Try again.')
      if (result.state === 'empty')
        return { avatarPath: null, presetId: null, signedUrl: undefined }
      let signedUrl: string | undefined
      if (result.data.avatarPath) {
        const { data, error } = await client.storage
          .from('profile-avatars')
          .createSignedUrl(result.data.avatarPath, 300)
        if (error)
          throw new Error('We could not load your profile picture. Try again.')
        signedUrl = data.signedUrl
      }
      return {
        avatarPath: result.data.avatarPath,
        presetId: isProfileAvatarPresetId(result.data.presetId)
          ? result.data.presetId
          : null,
        signedUrl,
      }
    },
    async chooseProfileAvatar(user, presetId) {
      if (!isProfileAvatarPresetId(presetId))
        throw new Error('Choose an available avatar.')
      const client = getConfiguredClient()
      const { data: authData, error: authError } = await client.auth.getUser()
      if (authError || !user.id || authData.user?.id !== user.id)
        throw new Error('Your account changed. Open Profile and try again.')
      const profiles = createRepositories(client).profiles
      const current = await getOrInitializeAvatarSelection(profiles, user.id)
      const saved = await profiles.setAvatarSelection({
        id: user.id,
        expectedAvatarPath: current.avatarPath,
        expectedPresetId: current.presetId,
        avatarPath: null,
        presetId,
      })
      if (saved.state !== 'success')
        throw new Error(
          'Your avatar changed elsewhere. Refresh Profile and try again.',
        )
      if (current.avatarPath?.startsWith(`${user.id}/`))
        await client.storage
          .from('profile-avatars')
          .remove([current.avatarPath])
    },
    async saveProfileAvatar(user, file) {
      if (!user.id)
        throw new Error('Sign in again to change your profile picture.')
      const type = await validateProfileAvatarFile(file)
      const client = getConfiguredClient()
      const accountIsCurrent = async () => {
        const { data, error } = await client.auth.getUser()
        return !error && data.user?.id === user.id
      }
      if (!(await accountIsCurrent()))
        throw new Error('Your account changed. Open Profile and try again.')
      const profiles = createRepositories(client).profiles
      const current = await getOrInitializeAvatarSelection(profiles, user.id)
      const path = `${user.id}/${crypto.randomUUID()}.${type.extension}`
      const { error: uploadError } = await client.storage
        .from('profile-avatars')
        .upload(path, file, { contentType: type.contentType, upsert: false })
      if (uploadError)
        throw new Error('We could not upload that picture. Try again.')
      if (!(await accountIsCurrent())) {
        await client.storage.from('profile-avatars').remove([path])
        throw new Error('Your account changed. Open Profile and try again.')
      }
      const saved = await profiles.setAvatarSelection({
        id: user.id,
        expectedAvatarPath: current.avatarPath,
        expectedPresetId: current.presetId,
        avatarPath: path,
        presetId: null,
      })
      if (saved.state !== 'success') {
        const latest = await profiles.getAvatarSelection(user.id)
        if (latest.state === 'success' && latest.data.avatarPath !== path)
          await client.storage.from('profile-avatars').remove([path])
        throw new Error('We could not save your picture. Try again.')
      }
      if (current.avatarPath?.startsWith(`${user.id}/`))
        await client.storage
          .from('profile-avatars')
          .remove([current.avatarPath])
    },
    async clearProfileAvatar(user) {
      if (!user.id)
        throw new Error('Sign in again to change your profile picture.')
      const client = getConfiguredClient()
      const { data: authData, error: authError } = await client.auth.getUser()
      if (authError || authData.user?.id !== user.id)
        throw new Error('Your account changed. Open Profile and try again.')
      const profiles = createRepositories(client).profiles
      const current = await getOrInitializeAvatarSelection(profiles, user.id)
      const saved = await profiles.setAvatarSelection({
        id: user.id,
        expectedAvatarPath: current.avatarPath,
        expectedPresetId: current.presetId,
        avatarPath: null,
        presetId: null,
      })
      if (saved.state !== 'success')
        throw new Error(
          'Your avatar changed elsewhere. Refresh Profile and try again.',
        )
      if (current.avatarPath?.startsWith(`${user.id}/`))
        await client.storage
          .from('profile-avatars')
          .remove([current.avatarPath])
    },
    async changePassword(user, currentPassword, password, nonce) {
      const client = getConfiguredClient()
      const accountIsCurrent = async () => {
        try {
          const { data, error } = await client.auth.getUser()
          return !error && Boolean(user.id) && data.user?.id === user.id
        } catch {
          return false
        }
      }
      if (!(await accountIsCurrent()))
        throw new Error('Your account changed. Open Profile and try again.')

      let error: { code?: string; message?: string; status?: number } | null
      try {
        ;({ error } = await client.auth.updateUser({
          current_password: currentPassword,
          nonce,
          password,
        }))
      } catch (updateError) {
        throw new Error(mapSupabaseAuthError(updateError, 'password-change'))
      }
      if (error?.code === 'reauthentication_needed' && !nonce) {
        if (!(await accountIsCurrent()))
          throw new Error('Your account changed. Open Profile and try again.')
        let reauthenticationError: {
          code?: string
          message?: string
          status?: number
        } | null
        try {
          ;({ error: reauthenticationError } =
            await client.auth.reauthenticate())
        } catch (reauthenticationFailure) {
          throw new Error(
            mapSupabaseAuthError(reauthenticationFailure, 'password-change'),
          )
        }
        if (reauthenticationError)
          throw new Error(
            mapSupabaseAuthError(reauthenticationError, 'password-change'),
          )
        return 'reauthentication-required'
      }
      if (error) throw new Error(mapSupabaseAuthError(error, 'password-change'))
      return 'updated'
    },
    async requestEmailChange(user, email) {
      const client = getConfiguredClient()
      const { data, error: sessionError } = await client.auth.getUser()
      if (sessionError || !user.id || data.user?.id !== user.id)
        throw new Error('Your account changed. Open Profile and try again.')
      const { error } = await client.auth.updateUser({ email })
      if (error) {
        const message = error.message?.toLowerCase() ?? ''
        if (error.status === 429 || message.includes('rate'))
          throw new Error('Too many attempts. Wait a moment and try again.')
        if (message.includes('email_exists') || message.includes('already'))
          throw new Error('That email cannot be used. Check it or try another.')
        if (message.includes('invalid') || message.includes('validation'))
          throw new Error('Enter a valid email address and try again.')
        if (error.status === undefined && message.includes('fetch'))
          throw new Error('Check your connection and try again.')
        throw new Error('We could not request the email change. Try again.')
      }
    },
    async saveProfileName(user, name) {
      const displayName = normalizeProfileName(name)
      if (!displayName)
        throw new Error('Enter a username between 1 and 80 characters.')
      const client = getConfiguredClient()
      const { data, error } = await client.auth.getUser()
      if (error || !user.id || data.user?.id !== user.id)
        throw new Error('Your account changed. Open Profile and try again.')
      const result = await createRepositories(client).profiles.saveName({
        id: user.id,
        displayName,
      })
      if (result.state !== 'success')
        throw new Error('We could not save your username. Try again.')
      return result.data.displayName
    },
    async ensureProfile(user) {
      const profile = await createRepositories(
        getConfiguredClient(),
      ).profiles.ensure({
        displayName: normalizeProfileName(user.displayName),
        id: user.id!,
      })
      if (profile.state === 'error') throw new Error(profile.error.message)
      return profile.state === 'success'
        ? safeProfileDisplayName(profile.data.displayName, user.email)
        : undefined
    },
    async getSession() {
      if (clientResult.state === 'missing-configuration') return null
      const { data, error } = await getConfiguredClient().auth.getSession()
      if (error)
        throw new Error('We could not restore your session. Try again.')
      return data.session?.user ? mapUser(data.session.user) : null
    },
    onAuthStateChange(callback) {
      if (clientResult.state !== 'configured') return () => undefined
      const { data } = clientResult.client.auth.onAuthStateChange(
        (event, session) => {
          callback(session?.user ? mapUser(session.user) : null, event)
        },
      )
      return () => data.subscription.unsubscribe()
    },
    async requestPasswordRecovery(email, redirectTo) {
      const { error } = await getConfiguredClient().auth.resetPasswordForEmail(
        email,
        { redirectTo },
      )
      if (error) {
        throw new Error(mapSupabaseAuthError(error, 'password-recovery'))
      }
    },
    async resetPassword(password) {
      const { error } = await getConfiguredClient().auth.updateUser({
        password,
      })
      if (error) {
        throw new Error(mapSupabaseAuthError(error, 'password-update'))
      }
    },
    async signIn(email, password) {
      const { data, error } =
        await getConfiguredClient().auth.signInWithPassword({
          email,
          password,
        })
      if (error || !data.user) {
        throw new Error(mapSupabaseAuthError(error, 'sign-in'))
      }
      return mapUser(data.user)
    },
    async signUp(name, email, password) {
      const { data, error } = await getConfiguredClient().auth.signUp({
        email,
        password,
        options: {
          data: { display_name: name.trim() },
          emailRedirectTo: getVerificationRedirectUrl(),
        },
      })
      if (error) throw new Error(mapSupabaseAuthError(error, 'sign-up'))
      return {
        needsVerification: !data.session,
        user: data.user ? mapUser(data.user) : null,
      }
    },
    async signOut() {
      if (clientResult.state === 'missing-configuration') return
      const { error } = await getConfiguredClient().auth.signOut()
      if (error) throw new Error('We could not sign you out. Try again.')
    },
  }
}
