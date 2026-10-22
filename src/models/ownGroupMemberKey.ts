import { md5 } from 'js-md5'

const canonicalUuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Compatibility with get_group_chart_history, never a replacement for author RLS. */
export function ownGroupMemberKey(
  challengeId: string,
  viewerId: string,
): string | null {
  if (!canonicalUuid.test(challengeId) || !canonicalUuid.test(viewerId))
    return null
  return md5(`${challengeId.toLowerCase()}:${viewerId.toLowerCase()}`)
}
