import { createClient } from 'npm:@supabase/supabase-js@2.116.0'
import {
  type AccountDeletionServices,
  createDeleteAccountHandler,
} from './handler.ts'

const projectUrl = Deno.env.get('SUPABASE_URL')
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const configured = Boolean(projectUrl && anonKey && serviceRoleKey)

function callerFor(authorization: string) {
  return createClient(projectUrl!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  })
}

function adminClient() {
  return createClient(projectUrl!, serviceRoleKey!, {
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
