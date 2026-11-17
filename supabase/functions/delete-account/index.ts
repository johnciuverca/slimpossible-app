import { createClient } from 'npm:@supabase/supabase-js@2.116.0'
import {
  type AccountDeletionServices,
  createDeleteAccountHandler,
} from './handler.ts'
import { readNamedKey } from './keyConfig.ts'

const projectUrl = Deno.env.get('SUPABASE_URL')
const publishableKey = readNamedKey(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS'))
const secretKey = readNamedKey(Deno.env.get('SUPABASE_SECRET_KEYS'))
const configured = Boolean(projectUrl && publishableKey && secretKey)

function callerFor(authorization: string) {
  return createClient(projectUrl!, publishableKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  })
}

function adminClient() {
  return createClient(projectUrl!, secretKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

const services: AccountDeletionServices = {
  configured,
  async getUser(authorization) {
    const { data, error } = await callerFor(authorization).auth.getUser()
    return error || !data.user ? null : { id: data.user.id }
  },
  async beginErasure(userId) {
    const { error } = await adminClient().rpc('begin_account_erasure', {
      target_user_id: userId,
    })
    return error
  },
  async listAvatarObjects(userId, folder, limit, offset) {
    const { data, error } = await adminClient()
      .storage.from('profile-avatars')
      .list(folder, { limit, offset })
    return { objects: data, error }
  },
  async removeAvatarObjects(paths) {
    const { error } = await adminClient()
      .storage.from('profile-avatars')
      .remove(paths)
    return { error }
  },
  async deleteAuthUser(userId) {
    const { error } = await adminClient().auth.admin.deleteUser(userId)
    return { error }
  },
}

Deno.serve(createDeleteAccountHandler(services))
