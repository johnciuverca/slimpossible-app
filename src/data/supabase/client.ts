import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import {
  getSupabaseConfiguration,
  type SupabaseEnvironment,
} from '../../auth/supabaseConfig'
import type { Database } from './database.types'

export type { SupabaseEnvironment } from '../../auth/supabaseConfig'

export const invalidSupabaseConfigurationMessage =
  'Supabase configuration is invalid. Check the public project URL and anonymous key.'

const clientCache = new Map<string, SupabaseClient<Database>>()

export type SupabaseBrowserClientResult =
  | {
      client: SupabaseClient<Database>
      state: 'configured'
    }
  | {
      message: string
      state: 'missing-configuration' | 'invalid-configuration'
    }

export function createSupabaseBrowserClient(
  environment: SupabaseEnvironment = import.meta.env as SupabaseEnvironment,
): SupabaseBrowserClientResult {
  const configuration = getSupabaseConfiguration(environment)

  if (configuration.state === 'missing-configuration') {
    return configuration
  }

  try {
    const cacheKey = `${configuration.url}\u0000${configuration.anonKey}`
    const cachedClient = clientCache.get(cacheKey)
    if (cachedClient) {
      return { client: cachedClient, state: 'configured' }
    }

    const client = createClient<Database>(
      configuration.url,
      configuration.anonKey,
    )
    clientCache.set(cacheKey, client)
    return {
      client,
      state: 'configured',
    }
  } catch {
    return {
      message: invalidSupabaseConfigurationMessage,
      state: 'invalid-configuration',
    }
  }
}
