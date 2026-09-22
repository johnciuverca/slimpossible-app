import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { useOptionalAuth } from '../auth/useAuth'
import {
  Button,
  Card,
  PageHeader,
  StatusPill,
  TextInput,
} from '../components/ui'
import { createPersistence } from '../data/persistence'
import type { Challenge } from '../models/challenge'
import type { ChallengeInvite } from '../models/challengeInvite'
import { getChallengeInviteStatus } from '../models/challengeInvite'

function defaultExpiryDate() {
  const date = new Date()
  date.setDate(date.getDate() + 7)
  return date.toISOString().slice(0, 10)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(value))
}

function inviteStatus(invite: ChallengeInvite) {
  return getChallengeInviteStatus(invite)
}

export function ChallengeInvitesPage() {
  const { state: authState } = useOptionalAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const persistence = useMemo(() => createPersistence(authState), [authState])
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [selectedChallengeId, setSelectedChallengeId] = useState(
    searchParams.get('challenge') ?? '',
  )
  const [invites, setInvites] = useState<ChallengeInvite[]>([])
  const [expiresOn, setExpiresOn] = useState(defaultExpiryDate)
  const [generatedLink, setGeneratedLink] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const selectedChallenge = challenges.find(
    ({ id }) => id === selectedChallengeId,
  )

  useEffect(() => {
    let isCurrent = true

    async function loadChallenges() {
      if (persistence.mode === 'unavailable') {
        setError(persistence.message)
        setIsLoading(false)
        return
      }

      const result = await persistence.repositories.challenges.listOwned(
        authState.user?.id,
      )
      if (!isCurrent) return
      if (result.state === 'error') {
        setError(result.error.message)
        setIsLoading(false)
        return
      }

      const nextChallenges = result.state === 'success' ? result.data : []
      setChallenges(nextChallenges)
      setSelectedChallengeId((currentId) => {
        const nextId = nextChallenges.some(({ id }) => id === currentId)
          ? currentId
          : (nextChallenges[0]?.id ?? '')
        if (nextId && nextId !== searchParams.get('challenge')) {
          setSearchParams({ challenge: nextId }, { replace: true })
        }
        return nextId
      })
      setIsLoading(false)
    }

    void loadChallenges()
    return () => {
      isCurrent = false
    }
  }, [authState.user?.id, persistence, searchParams, setSearchParams])

  useEffect(() => {
    let isCurrent = true

    async function loadInvites() {
      if (persistence.mode === 'unavailable' || !selectedChallengeId) {
        setInvites([])
        return
      }

      const result =
        await persistence.repositories.invites.listForChallenge(
          selectedChallengeId,
        )
      if (!isCurrent) return
      if (result.state === 'error') {
        setError(result.error.message)
        setInvites([])
      } else {
        setInvites(result.state === 'success' ? result.data : [])
        setError('')
      }
    }

    void loadInvites()
    return () => {
      isCurrent = false
    }
  }, [persistence, selectedChallengeId])

  async function createInvite() {
    if (persistence.mode === 'unavailable' || !selectedChallengeId) return

    const expiresAt = new Date(`${expiresOn}T23:59:59.000Z`)
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
      setError('Choose a future expiry date for the invitation.')
      return
    }

    setIsSaving(true)
    setError('')
    const result = await persistence.repositories.invites.create(
      selectedChallengeId,
      expiresAt.toISOString(),
    )
    setIsSaving(false)

    if (result.state === 'error') {
      setError(result.error.message)
      return
    }
    if (result.state === 'empty') {
      setError('The invitation could not be created.')
      return
    }

    setInvites((current) => [result.data.invite, ...current])
    setGeneratedLink(
      `${window.location.origin}/invite/${encodeURIComponent(result.data.token)}`,
    )
  }

  async function revokeInvite(id: string) {
    if (persistence.mode === 'unavailable') return
    setError('')
    const result = await persistence.repositories.invites.revoke(id)
    if (result.state === 'error') {
      setError(result.error.message)
      return
    }
    if (result.state === 'empty') {
      setError('The invitation was already unavailable.')
      return
    }
    setInvites((current) =>
      current.map((invite) =>
        invite.id === id
          ? { ...invite, revokedAt: new Date().toISOString() }
          : invite,
      ),
    )
  }

  return (
    <section aria-labelledby="challenge-invites-title" className="w-full">
      <Card className="mx-auto max-w-4xl p-8 sm:p-12">
        <PageHeader
          description="Create a revocable link for a person to join one of your challenges. The accepting account is bound on the server after sign-in."
          title="Invite participants."
          titleId="challenge-invites-title"
        >
          <StatusPill>Owner controls</StatusPill>
        </PageHeader>

        {isLoading ? (
          <p
            aria-live="polite"
            className="mt-8 text-sm text-slate-600"
            role="status"
          >
            Loading your challenges…
          </p>
        ) : error && challenges.length === 0 ? (
          <p
            aria-live="polite"
            className="mt-8 text-sm text-red-700"
            role="alert"
          >
            {error}
          </p>
        ) : challenges.length === 0 ? (
          <p className="mt-8 text-sm leading-6 text-slate-600">
            Create a challenge before issuing an invitation.
          </p>
        ) : (
          <div className="mt-8 space-y-8">
            <div>
              <label
                className="text-sm font-semibold text-slate-700"
                htmlFor="invite-challenge"
              >
                Challenge
              </label>
              <select
                className="mt-2 block w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                id="invite-challenge"
                onChange={(event) => {
                  setSelectedChallengeId(event.target.value)
                  setSearchParams({ challenge: event.target.value })
                  setGeneratedLink('')
                }}
                value={selectedChallengeId}
              >
                {challenges.map((challenge) => (
                  <option key={challenge.id} value={challenge.id}>
                    {challenge.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
              <h2 className="text-lg font-bold text-slate-950">
                {selectedChallenge?.name ?? 'Selected challenge'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Anyone with the link can request membership until you revoke it
                or it expires. Their Auth profile, not a typed identifier, is
                used for the membership.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                <TextInput
                  id="invite-expires-on"
                  label="Link expires on"
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => setExpiresOn(event.target.value)}
                  type="date"
                  value={expiresOn}
                />
                <Button disabled={isSaving} onClick={() => void createInvite()}>
                  {isSaving ? 'Creating link…' : 'Create invite link'}
                </Button>
              </div>
            </div>

            {error ? (
              <p
                aria-live="polite"
                className="text-sm text-red-700"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            {generatedLink ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="font-semibold text-emerald-900">
                  Invite link ready
                </p>
                <p className="mt-2 break-all text-sm text-emerald-900">
                  {generatedLink}
                </p>
                <p className="mt-2 text-xs leading-5 text-emerald-800">
                  Share this link privately. It is the only time the raw token
                  is shown.
                </p>
              </div>
            ) : null}

            <div>
              <h2 className="text-xl font-bold text-slate-950">Issued links</h2>
              {invites.length === 0 ? (
                <p className="mt-4 text-sm text-slate-600">
                  No links issued yet.
                </p>
              ) : (
                <ul
                  aria-label="Issued invitation links"
                  className="mt-4 space-y-3"
                >
                  {invites.map((invite) => {
                    const status = inviteStatus(invite)
                    return (
                      <li
                        className="flex flex-col gap-3 rounded-2xl border border-stone-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                        key={invite.id}
                      >
                        <div>
                          <p className="font-semibold text-slate-900">
                            Expires {formatDate(invite.expiresAt)}
                          </p>
                          <p className="mt-1 text-sm capitalize text-slate-600">
                            Status: {status}
                          </p>
                        </div>
                        {status === 'active' ? (
                          <Button
                            onClick={() => void revokeInvite(invite.id)}
                            type="button"
                            variant="secondary"
                          >
                            Revoke link
                          </Button>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        )}

        <Link
          className="mt-8 inline-block text-sm text-emerald-700 underline"
          to="/"
        >
          Back to home
        </Link>
      </Card>
    </section>
  )
}
