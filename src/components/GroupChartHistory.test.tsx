import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
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
  it('shows a date/member matrix and keyboard-selects only one duplicate-name member without fetching personal data', async () => {
    const load = vi.fn().mockResolvedValue({
      state: 'success',
      data: [
        { ...rows[0], displayName: 'Same name' },
        { ...rows[1], displayName: 'Same name' },
        {
          ...rows[0],
          memberKey: 'b',
          displayName: 'Same name',
          date: '2026-09-02',
          weightKg: 70.25,
        },
      ],
    })
    render(
      <GroupChartHistory
        challengeId="group"
        viewerId="viewer"
        persistence={persistence(load)}
        refreshVersion={0}
      />,
    )
    const table = await screen.findByRole('table')
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual([
      'Date',
      'Same name (member 1) (kg)',
      'Same name (member 2) (kg)',
    ])
    const dateRow = within(table)
      .getByRole('rowheader', { name: '2026-09-02' })
      .closest('tr')!
    expect(within(dateRow).getByLabelText('No shared entry')).toHaveTextContent(
      '—',
    )
    expect(dateRow).toHaveTextContent('70.25 kg')
    const all = screen.getByRole('tab', { name: 'All members' })
    fireEvent.keyDown(all, { key: 'End' })
    expect(
      screen.getByRole('tab', { name: 'Same name (member 2)' }),
    ).toHaveFocus()
    expect(
      screen.getByRole('tab', { name: 'Same name (member 2)' }),
    ).toHaveAttribute('aria-selected', 'true')
    expect(table).not.toHaveTextContent('88.5 kg')
    expect(table).toHaveTextContent('70.25 kg')
    expect(screen.getByRole('img').querySelectorAll('circle')).toHaveLength(1)
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName(
      'Same name (member 2)',
    )
    fireEvent.keyDown(
      screen.getByRole('tab', { name: 'Same name (member 2)' }),
      { key: 'Home' },
    )
    expect(all).toHaveFocus()
    expect(table).toHaveTextContent('88.5 kg')
    expect(load).toHaveBeenCalledTimes(1)
    expect(load).toHaveBeenCalledWith('group')
  })
  it('retains a shared member on correction refresh but falls back to All members when its last share disappears', async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce({ state: 'success', data: rows })
      .mockResolvedValueOnce({
        state: 'success',
        data: [{ ...rows[0], weightKg: 91 }],
      })
      .mockResolvedValueOnce({
        state: 'success',
        data: [{ ...rows[0], memberKey: 'b', displayName: 'Ben' }],
      })
    const remote = persistence(load)
    const view = (version: number) => (
      <GroupChartHistory
        challengeId="group"
        viewerId="viewer"
        persistence={remote}
        refreshVersion={version}
      />
    )
    const { rerender } = render(view(0))
    fireEvent.click(await screen.findByRole('tab', { name: 'Ava' }))
    rerender(view(1))
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    await screen.findByText('91 kg')
    expect(screen.getByRole('tab', { name: 'Ava' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    rerender(view(2))
    await screen.findByRole('tab', { name: 'Ben' })
    expect(screen.queryByRole('tab', { name: 'Ava' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'All members' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })
  it('clears selected-member state across account or challenge changes even with the same opaque key', async () => {
    const load = vi.fn().mockResolvedValue({
      state: 'success',
      data: [rows[0], { ...rows[1], memberKey: 'b', displayName: 'Ben' }],
    })
    const remote = persistence(load)
    const view = (viewer: string, challenge: string) => (
      <GroupChartHistory
        challengeId={challenge}
        viewerId={viewer}
        persistence={remote}
        refreshVersion={0}
      />
    )
    const { rerender } = render(view('one', 'a'))
    fireEvent.click(await screen.findByRole('tab', { name: 'Ben' }))
    rerender(view('two', 'a'))
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    await screen.findByRole('table')
    expect(screen.getByRole('tab', { name: 'All members' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Ben' }))
    rerender(view('two', 'b'))
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    await screen.findByRole('table')
    expect(screen.getByRole('tab', { name: 'All members' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })
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
