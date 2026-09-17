import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import {
  getSupabaseConfiguration,
  type SupabaseEnvironment,
} from '../../auth/supabaseConfig'
import type { Database } from './database.types'

export type { SupabaseEnvironment } from '../../auth/supabaseConfig'

export const invalidSupabaseConfigurationMessage =
  'Supabase configuration is invalid. Check the public project URL and anonymous key.'

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
    return {
      client: createClient<Database>(configuration.url, configuration.anonKey),
      state: 'configured',
    }
  } catch {
    return {
      message: invalidSupabaseConfigurationMessage,
      state: 'invalid-configuration',
    }
  }
}
