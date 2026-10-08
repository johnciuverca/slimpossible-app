import { act, cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GroupChartHistory } from './GroupChartHistory'
import type { Persistence } from '../data/persistence'
import type { GroupChartEntry } from '../models/groupChartHistory'
import type { RepositoryListResult } from '../data/supabase/repositories'
afterEach(cleanup)
const rows: GroupChartEntry[] = [
  { memberKey: 'a', displayName: 'Ava', date: '2026-09-01', weightKg: 90 },
  { memberKey: 'a', displayName: 'Ava', date: '2026-09-03', weightKg: 88.5 },
]
const persistence = (
  load: (id: string) => Promise<RepositoryListResult<GroupChartEntry>>,
) =>
  ({
    mode: 'remote',
    repositories: { groupProgress: { getChartHistory: load } },
  }) as unknown as Persistence
describe('Group chart history', () => {
  it('uses authorized projection, exact weights and missing-date gaps with accessible equivalents', async () => {
    const load = vi.fn().mockResolvedValue({ state: 'success', data: rows })
    render(
      <GroupChartHistory
        challengeId="group-a"
        viewerId="viewer"
        persistence={persistence(load)}
        refreshVersion={0}
      />,
    )
    const table = await screen.findByRole('table', {
      name: 'Shared group weight history',
    })
    expect(table).toHaveTextContent('88.5 kg')
    expect(table).toHaveTextContent('-1.5 kg')
    expect(load).toHaveBeenCalledWith('group-a')
    const chart = screen.getByRole('img')
    expect(chart.querySelectorAll('circle')).toHaveLength(2)
    expect(chart.querySelectorAll('g[stroke] line')).toHaveLength(0)
    expect(
      screen.getByRole('region', { name: 'Scrollable shared group weights' }),
    ).toHaveAttribute('tabindex', '0')
    expect(
      screen.getByRole('list', { name: 'Group chart legend' }),
    ).toHaveTextContent('baseline 2026-09-01')
  })
  it('hides old account/challenge data immediately and ignores late results', async () => {
    let resolveOld!: (result: RepositoryListResult<GroupChartEntry>) => void
    const load = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve
          }),
      )
      .mockResolvedValue({
        state: 'success',
        data: [{ ...rows[0], displayName: 'Second member', memberKey: 'b' }],
      })
    const remote = persistence(load)
    const { rerender } = render(
      <GroupChartHistory
        challengeId="old"
        viewerId="one"
        persistence={remote}
        refreshVersion={0}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Loading')
    rerender(
      <GroupChartHistory
        challengeId="new"
        viewerId="two"
        persistence={remote}
        refreshVersion={0}
      />,
    )
    const table = await screen.findByRole('table')
    expect(table).toHaveTextContent('Second member')
    await act(async () => resolveOld({ state: 'success', data: rows }))
    expect(table).not.toHaveTextContent('Ava')
  })
  it('refreshes corrections/removals and fails safely when RPC is missing', async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce({ state: 'success', data: rows })
      .mockResolvedValueOnce({ state: 'success', data: [] })
      .mockRejectedValueOnce(new Error('RPC missing'))
    const remote = persistence(load)
    const { rerender } = render(
      <GroupChartHistory
        challengeId="a"
        viewerId="one"
        persistence={remote}
        refreshVersion={0}
      />,
    )
    await screen.findByRole('table')
    rerender(
      <GroupChartHistory
        challengeId="a"
        viewerId="one"
        persistence={remote}
        refreshVersion={1}
      />,
    )
    await screen.findByText('No entries have been shared with this group.')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    rerender(
      <GroupChartHistory
        challengeId="a"
        viewerId="one"
        persistence={remote}
        refreshVersion={2}
      />,
    )
    await screen.findByText(/Shared group history is unavailable/)
    expect(
      within(
        screen.getByRole('region', {
          name: 'Group chart and weigh-in history',
        }),
      ).queryByRole('img'),
    ).not.toBeInTheDocument()
  })
})
