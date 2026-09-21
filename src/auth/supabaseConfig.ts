export const missingSupabaseConfigurationMessage =
  'Remote authentication is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'

export const localAuthenticationLabel = 'Local preview'
export const remoteAuthenticationLabel = 'Remote authentication'

export type SupabaseEnvironment = {
  VITE_SUPABASE_ANON_KEY?: string
  VITE_SUPABASE_URL?: string
}

export type SupabaseConfiguration =
  | {
      anonKey: string
      state: 'configured'
      url: string
    }
  | {
      message: typeof missingSupabaseConfigurationMessage
      state: 'missing-configuration'
    }

function requiredValue(value: string | undefined) {
  return value?.trim() || null
}

export function getSupabaseConfiguration(
  environment: SupabaseEnvironment = import.meta.env as SupabaseEnvironment,
): SupabaseConfiguration {
  const url = requiredValue(environment.VITE_SUPABASE_URL)
  const anonKey = requiredValue(environment.VITE_SUPABASE_ANON_KEY)

  if (!url || !anonKey) {
    return {
      message: missingSupabaseConfigurationMessage,
      state: 'missing-configuration',
    }
  }

  return { anonKey, state: 'configured', url }
}

export function getAuthenticationEnvironmentLabel(
  environment: SupabaseEnvironment = import.meta.env as SupabaseEnvironment,
) {
  return getSupabaseConfiguration(environment).state === 'configured'
    ? remoteAuthenticationLabel
    : localAuthenticationLabel
}
