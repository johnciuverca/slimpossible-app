import {
  type AccountDeletionServices,
  type AvatarObject,
  createDeleteAccountHandler,
} from './handler.ts'

const userId = 'caller-123'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function makeServices(
  overrides: Partial<AccountDeletionServices> = {},
  events: string[] = [],
): AccountDeletionServices {
  return {
    configured: true,
    async getUser(authorization) {
      events.push(`auth:${authorization}`)
      return { id: userId }
    },
    async beginErasure(id) {
      events.push(`begin:${id}`)
      return null
    },
    async listAvatarObjects(_id, folder) {
      events.push(`list:${folder}`)
      return { objects: [], error: null }
    },
    async removeAvatarObjects(paths) {
      events.push(`remove:${paths.length}`)
      return { error: null }
    },
    async deleteAuthUser(id) {
      events.push(`delete:${id}`)
      return { error: null }
    },
    ...overrides,
  }
}

function request(body = '{}', authorization = 'Bearer valid-caller-token') {
  return new Request('https://example.test/delete-account', {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json',
    },
    body,
  })
}

Deno.test(
  'rejects invalid authentication without starting erasure',
  async () => {
    const events: string[] = []
    const services = makeServices(
      {
        async getUser() {
          events.push('auth-rejected')
          return null
        },
      },
      events,
    )
    const response = await createDeleteAccountHandler(services)(request())
    assert(response.status === 401, 'expected an authentication failure')
    assert(
      events.join(',') === 'auth-rejected',
      'erasure continued after auth failure',
    )
  },
)

Deno.test(
  'removes only caller files across pages and nested folders before auth deletion',
  async () => {
    const events: string[] = []
    const removed: string[] = []
    const services = makeServices(
      {
        async listAvatarObjects(_id, folder, limit, offset) {
          events.push(`list:${folder}:${offset}`)
          let entries: AvatarObject[]
          if (folder === userId) {
            entries = Array.from({ length: 205 }, (_, index) => ({
              id: `file-${index}`,
              name: `avatar-${index}.png`,
            }))
            entries.push({ id: null, name: 'nested' })
          } else if (folder === `${userId}/nested`) {
            entries = [{ id: 'nested-file', name: 'old.webp' }]
          } else {
            entries = []
          }
          return { objects: entries.slice(offset, offset + limit), error: null }
        },
        async removeAvatarObjects(paths) {
          events.push(`remove:${paths.length}`)
          removed.push(...paths)
          return { error: null }
        },
        async deleteAuthUser(id) {
          events.push(`delete:${id}`)
          return { error: null }
        },
      },
      events,
    )
    const response = await createDeleteAccountHandler(services)(
      request('{"userId":"someone-else"}'),
    )
    assert(response.status === 200, 'expected successful account deletion')
    assert(
      removed.length === 206,
      `expected 206 avatar files, got ${removed.length}`,
    )
    assert(
      removed.every((path) => path.startsWith(`${userId}/`)),
      'removed another account file',
    )
    assert(
      removed.includes(`${userId}/nested/old.webp`),
      'nested avatar was not removed',
    )
    assert(
      events.indexOf(`delete:${userId}`) >
        events.findIndex((event) => event.startsWith('remove:')),
      'Auth deletion ran before Storage cleanup',
    )
    assert(
      events.includes(`begin:${userId}`),
      'erasure marker used another user',
    )
    assert(
      events.indexOf(`begin:${userId}`) <
        events.findIndex((event) => event.startsWith(`list:${userId}:`)),
      'Storage was scanned before upload blocking began',
    )
    assert(
      !events.some((event) => event.includes('someone-else')),
      'request body selected another user',
    )
    assert(
      events.filter((event) => event.startsWith(`list:${userId}:`)).length ===
        3,
      'root objects were not paged in 100-item batches',
    )
  },
)

Deno.test(
  'keeps Auth user when Storage cleanup fails and supports retry',
  async () => {
    const events: string[] = []
    let removeAttempts = 0
    const services = makeServices(
      {
        async listAvatarObjects(_id, folder) {
          events.push(`list:${folder}`)
          return { objects: [{ id: 'avatar', name: 'one.png' }], error: null }
        },
        async removeAvatarObjects() {
          removeAttempts += 1
          events.push(`remove:${removeAttempts}`)
          return removeAttempts === 1
            ? { error: new Error('Storage unavailable') }
            : { error: null }
        },
        async deleteAuthUser(id) {
          events.push(`delete:${id}`)
          return { error: null }
        },
      },
      events,
    )
    const response = await createDeleteAccountHandler(services)(request())
    assert(response.status === 503, 'expected a retryable cleanup failure')
    assert(
      !events.some((event) => event.startsWith('delete:')),
      'Auth deletion ran after Storage failure',
    )
    const retry = await createDeleteAccountHandler(services)(request())
    assert(
      retry.status === 200,
      'expected account deletion to succeed on retry',
    )
    assert(
      events.filter((event) => event.startsWith('begin:')).length === 2,
      'retry did not resume the existing erasure marker',
    )
    assert(
      events.includes('delete:caller-123'),
      'retry did not delete the authenticated caller',
    )
  },
)
