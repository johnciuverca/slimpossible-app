import { createClient } from 'npm:@supabase/supabase-js@2.116.0'

const corsHeaders = {
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
}

function respond(status: number, body: { error?: string; success?: boolean }) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (request.method !== 'POST')
    return respond(405, { error: 'Method not allowed.' })

  const authorization = request.headers.get('Authorization')
  const projectUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (
    !authorization?.startsWith('Bearer ') ||
    !projectUrl ||
    !anonKey ||
    !serviceRoleKey
  ) {
    return respond(401, {
      error: 'Sign in again before deleting your account.',
    })
  }

  const caller = createClient(projectUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  })
  const { data: userData, error: userError } = await caller.auth.getUser()
  if (userError || !userData.user) {
    return respond(401, {
      error: 'Sign in again before deleting your account.',
    })
  }

  const admin = createClient(projectUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const bucket = admin.storage.from('profile-avatars')
  const pageSize = 100
  for (;;) {
    const { data: objects, error: listError } = await bucket.list(
      userData.user.id,
      {
        limit: pageSize,
        offset: 0,
      },
    )
    if (listError)
      return respond(503, {
        error: 'Account data could not be fully removed. Try again.',
      })
    const paths = (objects ?? [])
      .filter((object) => object.id !== null)
      .map((object) => `${userData.user.id}/${object.name}`)
    if (paths.length > 0) {
      const { error: removeError } = await bucket.remove(paths)
      if (removeError)
        return respond(503, {
          error: 'Account data could not be fully removed. Try again.',
        })
    }
    if (!objects || objects.length < pageSize || paths.length === 0) break
  }

  // The Auth deletion trigger scrubs relational personal/scoring evidence and
  // keeps each finalized challenge award under the generic Deleted member label.
  const { error: deleteError } = await admin.auth.admin.deleteUser(
    userData.user.id,
  )
  if (deleteError)
    return respond(503, {
      error: 'Account data could not be fully removed. Try again.',
    })
  return respond(200, { success: true })
})
