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
import type { GroupMemberProgress } from '../models/groupMemberProgress'
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
  it('lists only challenge member names while keeping target and trend chart lines', async () => {
    const groupProgress: GroupMemberProgress[] = [
      {
        memberKey: 'a',
        displayName: 'Ava',
        targetWeightKg: 85,
        startingWeightKg: 90,
        completionPercentage: 50,
        progressState: 'in_progress',
        reachedTargetMilestones: [],
      },
      {
        memberKey: 'b',
        displayName: 'Nora',
        targetWeightKg: 74,
        startingWeightKg: 76,
        completionPercentage: 50,
        progressState: 'in_progress',
        reachedTargetMilestones: [],
      },
    ]
    const entries: GroupChartEntry[] = [
      ...rows,
      { memberKey: 'b', displayName: 'Nora', date: '2026-09-02', weightKg: 76 },
    ]
    render(
      <GroupChartHistory
        challengeId="group"
        viewerId="viewer"
        persistence={persistence(
          vi.fn().mockResolvedValue({ state: 'success', data: entries }),
        )}
        refreshVersion={0}
        memberProgress={groupProgress}
      />,
    )
    const chart = await screen.findByRole('img', {
      name: 'Weight (kg) — shared group history',
    })
    expect(
      chart.querySelector('[data-series="target-reference"]'),
    ).toHaveAttribute('stroke-dasharray', '9 5')
    expect(
      chart.querySelector('[data-series="derived-trend"]'),
    ).toHaveAttribute('stroke-dasharray', '3 6')
    expect(chart.querySelectorAll('circle')).toHaveLength(3)
    const legend = screen.getByRole('list', { name: 'Group chart legend' })
    expect(legend).toHaveClass('w-full', 'justify-center')
    expect(
      Array.from(legend.querySelectorAll('li'), (item) =>
        item.textContent?.trim(),
      ),
    ).toEqual(['Ava', 'Nora'])
    expect(legend).not.toHaveTextContent(
      /recorded weights|first shared|baseline|target\/reference|derived trend/i,
    )
    expect(screen.getByRole('rowheader', { name: '2026-09-03' })).toBeVisible()
  })
  it('uses the same view-only ranges for all members and an individual member chart', async () => {
    const entries: GroupChartEntry[] = [
      { memberKey: 'a', displayName: 'Ava', date: '2026-01-01', weightKg: 90 },
      { memberKey: 'a', displayName: 'Ava', date: '2026-02-01', weightKg: 89 },
      { memberKey: 'a', displayName: 'Ava', date: '2026-03-01', weightKg: 88 },
      { memberKey: 'a', displayName: 'Ava', date: '2026-04-01', weightKg: 87 },
      { memberKey: 'a', displayName: 'Ava', date: '2026-05-01', weightKg: 86 },
    ]
    const load = vi.fn().mockResolvedValue({ state: 'success', data: entries })
    render(
      <GroupChartHistory
        challengeId="group"
        viewerId="viewer"
        persistence={persistence(load)}
        refreshVersion={0}
        memberProgress={[
          {
            memberKey: 'a',
            displayName: 'Ava',
            targetWeightKg: 82,
            startingWeightKg: 90,
            completionPercentage: 50,
            progressState: 'in_progress',
            reachedTargetMilestones: [],
          },
        ]}
      />,
    )
    const chart = await screen.findByRole('img', {
      name: 'Weight (kg) — shared group history',
    })
    expect(chart.querySelectorAll('circle[data-date]')).toHaveLength(5)
    fireEvent.click(screen.getByRole('button', { name: 'Show last 1 month' }))
    expect(chart.querySelectorAll('circle[data-date]')).toHaveLength(2)
    expect(chart.querySelector('[data-chart-reference]')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show last 3 months' }))
    expect(chart.querySelectorAll('circle[data-date]')).toHaveLength(4)
    const allMembersTrack = screen.getByRole('group', {
      name: 'Adjust visible date range',
    })
    expect(allMembersTrack.querySelectorAll('[role="slider"]')).toHaveLength(2)
    fireEvent.keyDown(
      screen.getByRole('slider', { name: 'Visible range end' }),
      {
        key: 'ArrowLeft',
      },
    )
    expect(chart.querySelectorAll('circle[data-date]')).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: 'Show all dates' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Ava' }))
    const individual = screen.getByRole('img', {
      name: /Change from first shared weight \(kg\)/,
    })
    expect(individual.querySelectorAll('circle[data-date]')).toHaveLength(5)
    const individualLegend = screen.getByRole('list', {
      name: 'Group chart legend',
    })
    expect(individualLegend).toHaveClass('w-full', 'justify-center')
    expect(
      Array.from(individualLegend.querySelectorAll('li'), (item) =>
        item.textContent?.trim(),
      ),
    ).toEqual(['Ava'])
    expect(
      screen.getByRole('group', { name: 'Chart date range controls' }),
    ).toBeInTheDocument()
    expect(
      screen
        .getByRole('group', { name: 'Adjust visible date range' })
        .querySelectorAll('[role="slider"]'),
    ).toHaveLength(2)
    fireEvent.keyDown(
      screen.getByRole('slider', { name: 'Visible range end' }),
      {
        key: 'ArrowLeft',
      },
    )
    expect(individual.querySelectorAll('circle[data-date]')).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: 'Show all dates' }))
    expect(individual.querySelectorAll('circle[data-date]')).toHaveLength(5)
    expect(load).toHaveBeenCalledTimes(1)
    expect(load).toHaveBeenCalledWith('group')
  })
  it('plots four actual-kg member series with padded axes, preserves gaps and keeps individual change view', async () => {
    const records = [80, 100, 90, 110].map((weightKg, index) => ({
      memberKey: String(index),
      displayName: `Member ${index}`,
      date: '2026-09-01',
      weightKg,
    }))
    records.push({
      memberKey: '0',
      displayName: 'Member 0',
      date: '2026-09-02',
      weightKg: 79,
    })
    records.push({
      memberKey: '1',
      displayName: 'Member 1',
      date: '2026-09-03',
      weightKg: 98,
    })
    render(
      <GroupChartHistory
        challengeId="group"
        viewerId="viewer"
        persistence={persistence(
          vi.fn().mockResolvedValue({ state: 'success', data: records }),
        )}
        refreshVersion={0}
      />,
    )
    await screen.findByRole('table')
    const chart = screen.getByRole('img', {
      name: 'Weight (kg) — shared group history',
    })
    expect(chart).toHaveTextContent('Weight (kg)')
    const circles = Array.from(chart.querySelectorAll('circle'))
    const eighty = circles.find(
      (circle) => circle.textContent === 'Member 0: 2026-09-01, 80 kg',
    )!
    const hundred = circles.find(
      (circle) => circle.textContent === 'Member 1: 2026-09-01, 100 kg',
    )!
    expect(Number(hundred.getAttribute('cy'))).toBeLessThan(
      Number(eighty.getAttribute('cy')),
    )
    expect(Number(eighty.getAttribute('cy'))).toBeGreaterThan(36)
    for (const circle of circles) {
      expect(Number(circle.getAttribute('cy'))).toBeGreaterThan(25)
      expect(Number(circle.getAttribute('cy'))).toBeLessThan(215)
    }
    expect(
      chart.querySelectorAll('[data-series="recorded-connection"]'),
    ).toHaveLength(1)
    fireEvent.click(screen.getByRole('tab', { name: 'Member 0' }))
    const individual = screen.getByRole('img', {
      name: 'Change from first shared weight (kg)',
    })
    expect(individual.querySelector('circle title')).toHaveTextContent(
      'Member 0: 2026-09-01, 0 kg',
    )
    expect(individual).toHaveTextContent('-1 kg')
  })
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
    expect(table).not.toHaveTextContent('88.50 kg')
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
    expect(table).toHaveTextContent('88.50 kg')
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
    await screen.findByRole('table')
    expect(
      within(screen.getByRole('table')).getByText('91.00'),
    ).toBeInTheDocument()
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
    expect(table).toHaveTextContent('88.50 kg')
    expect(table).toHaveTextContent('-1.5 kg')
    expect(load).toHaveBeenCalledWith('group-a')
    const chart = screen.getByRole('img')
    expect(chart.querySelectorAll('circle')).toHaveLength(2)
    expect(
      chart.querySelectorAll('[data-series="recorded-connection"]'),
    ).toHaveLength(0)
    expect(
      screen.getByRole('region', { name: 'Scrollable shared group weights' }),
    ).toHaveAttribute('tabindex', '0')
    expect(
      Array.from(
        screen
          .getByRole('list', { name: 'Group chart legend' })
          .querySelectorAll('li'),
        (item) => item.textContent?.trim(),
      ),
    ).toEqual(['Ava'])
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
