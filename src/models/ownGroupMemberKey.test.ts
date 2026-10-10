import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { ownGroupMemberKey } from './ownGroupMemberKey'

const group = '00000000-0000-0000-0000-000000000001'
const viewer = '00000000-0000-0000-0000-000000000002'
describe('viewer opaque group key compatibility', () => {
  it.each([
    [group, viewer],
    [viewer, group],
    [
      'abcdefab-cdef-abcd-efab-cdefabcdefab',
      'ffffffff-ffff-ffff-ffff-ffffffffffff',
    ],
  ])(
    'matches Node MD5 and PostgreSQL UUID text projection for %s',
    (challenge, author) => {
      expect(ownGroupMemberKey(challenge, author)).toBe(
        createHash('md5').update(`${challenge}:${author}`).digest('hex'),
      )
    },
  )
  it('normalizes uppercase canonical UUIDs and isolates the group and viewer', () => {
    const author = 'abcdefab-cdef-abcd-efab-cdefabcdefab'
    expect(ownGroupMemberKey(group.toUpperCase(), author.toUpperCase())).toBe(
      ownGroupMemberKey(group, author),
    )
    expect(ownGroupMemberKey(group, viewer)).not.toBe(
      ownGroupMemberKey(viewer, group),
    )
  })
  it.each(['', 'e2e-user', 'null', `${viewer} `, viewer.replaceAll('-', '')])(
    'fails closed for uncertain UUID input %s',
    (invalid) => {
      expect(ownGroupMemberKey(group, invalid)).toBeNull()
      expect(ownGroupMemberKey(invalid, viewer)).toBeNull()
    },
  )
})
