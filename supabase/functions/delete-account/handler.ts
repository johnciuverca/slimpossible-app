export type AvatarObject = { id: string | null; name: string }

export type AccountDeletionServices = {
  getUser(authorization: string): Promise<{ id: string } | null>
  beginErasure(userId: string): Promise<unknown | null>
  listAvatarObjects(
    userId: string,
    folder: string,
    limit: number,
    offset: number,
  ): Promise<{ objects: AvatarObject[] | null; error: unknown | null }>
  removeAvatarObjects(paths: string[]): Promise<{ error: unknown | null }>
  deleteAuthUser(userId: string): Promise<{ error: unknown | null }>
  configured: boolean
}

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

async function removeAvatarTree(
  services: AccountDeletionServices,
  userId: string,
): Promise<boolean> {
  const pageSize = 100
  const folders = [userId]
  const visitedFolders = new Set<string>()
  const objectPaths: string[] = []

  while (folders.length > 0) {
    const folder = folders.shift()!
    if (visitedFolders.has(folder)) continue
    visitedFolders.add(folder)
    let offset = 0
    for (;;) {
      const { objects, error } = await services.listAvatarObjects(
        userId,
        folder,
        pageSize,
        offset,
      )
      if (error || !objects) return false
      for (const object of objects) {
        if (
          !object.name ||
          object.name === '.' ||
          object.name === '..' ||
          object.name.includes('/')
        ) {
          return false
        }
        const objectPath = `${folder}/${object.name}`
        if (object.id === null) folders.push(objectPath)
        else objectPaths.push(objectPath)
      }
      if (objects.length < pageSize) break
      offset += objects.length
    }
  }

  for (let index = 0; index < objectPaths.length; index += pageSize) {
    const { error } = await services.removeAvatarObjects(
      objectPaths.slice(index, index + pageSize),
    )
    if (error) return false
  }
  return true
}

export function createDeleteAccountHandler(services: AccountDeletionServices) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }
    if (request.method !== 'POST') {
      return respond(405, { error: 'Method not allowed.' })
    }

    const authorization = request.headers.get('Authorization')
    if (!authorization?.startsWith('Bearer ') || !services.configured) {
      return respond(401, {
        error: 'Sign in again before deleting your account.',
      })
    }

    let user: { id: string } | null
    try {
      user = await services.getUser(authorization)
    } catch {
      user = null
    }
    if (!user?.id) {
      return respond(401, {
        error: 'Sign in again before deleting your account.',
      })
    }

    try {
      const beginError = await services.beginErasure(user.id)
      if (beginError) {
        return respond(503, {
          error: 'Account data could not be fully removed. Try again.',
        })
      }
      if (!(await removeAvatarTree(services, user.id))) {
        return respond(503, {
          error: 'Account data could not be fully removed. Try again.',
        })
      }
      const { error } = await services.deleteAuthUser(user.id)
      if (error) {
        return respond(503, {
          error: 'Account data could not be fully removed. Try again.',
        })
      }
    } catch {
      return respond(503, {
        error: 'Account data could not be fully removed. Try again.',
      })
    }
    return respond(200, { success: true })
  }
}
