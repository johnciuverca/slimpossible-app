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
const originalInnerWidth = window.innerWidth
afterEach(() => {
  cleanup()
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: originalInnerWidth,
  })
})
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
        signedDisplayPercentage: 50,
        negativeProgressCapped: false,
        progressState: 'in_progress',
        reachedTargetMilestones: [],
      },
      {
        memberKey: 'b',
        displayName: 'Nora',
        targetWeightKg: 74,
        startingWeightKg: 76,
        completionPercentage: 50,
        signedDisplayPercentage: 50,
        negativeProgressCapped: false,
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
    expect(chart).toHaveAttribute('viewBox', '0 0 760 278')
    expect(
      chart.querySelector('[data-series="target-reference"]'),
    ).toHaveAttribute('stroke-dasharray', '9 5')
    expect(
      chart.querySelector('[data-series="derived-trend"]'),
    ).toHaveAttribute('stroke-dasharray', '3 6')
    expect(
      chart.querySelectorAll('circle[data-point-kind="recorded"]'),
    ).toHaveLength(3)
    expect(
      chart.querySelectorAll('[data-chart-date-tick]')[0],
    ).toHaveTextContent('01.09.2026')
    const firstPoint = chart.querySelector(
      'circle[data-point-kind="recorded"][data-chart-point]',
    )!
    fireEvent.focus(firstPoint)
    expect(screen.getByRole('tooltip')).toHaveTextContent('01.09.2026')
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
  it('toggles comparison series without changing axes, dates, or source history', async () => {
    const entries: GroupChartEntry[] = [
      {
        memberKey: 'member-a',
        displayName: 'Ava',
        date: '2026-08-01',
        weightKg: 91,
      },
      {
        memberKey: 'member-a',
        displayName: 'Ava',
        date: '2026-09-01',
        weightKg: 90,
      },
      {
        memberKey: 'member-a',
        displayName: 'Ava',
        date: '2026-09-03',
        weightKg: 88,
      },
      {
        memberKey: 'member-b',
        displayName: 'Nora',
        date: '2026-08-01',
        weightKg: 71,
      },
      {
        memberKey: 'member-b',
        displayName: 'Nora',
        date: '2026-09-01',
        weightKg: 70,
      },
      {
        memberKey: 'member-b',
        displayName: 'Nora',
        date: '2026-09-03',
        weightKg: 72,
      },
    ]
    render(
      <GroupChartHistory
        challengeId="group"
        viewerId="viewer"
        persistence={persistence(
          vi.fn().mockResolvedValue({ state: 'success', data: entries }),
        )}
        refreshVersion={0}
      />,
    )

    const chart = await screen.findByRole('img', {
      name: 'Weight (kg) — shared group history',
    })
    const sharedHistory = screen.getByRole('table', {
      name: 'Shared group weight history',
    })
    const sourceHistoryBefore = sharedHistory.textContent
    const legend = screen.getByRole('list', { name: 'Group chart legend' })
    const avaToggle = within(legend).getByRole('button', {
      name: 'Ava chart series, currently visible',
    })
    const noraToggle = within(legend).getByRole('button', {
      name: 'Nora chart series, currently visible',
    })
    const weeklySummary = chart.querySelector(
      'circle[data-point-kind="weekly-summary"][data-chart-point]',
    )!
    fireEvent.click(weeklySummary)
    fireEvent.click(screen.getByRole('button', { name: 'Expand week' }))
    const backToAverages = screen.getByRole('button', {
      name: 'Back to weekly averages',
    })
    expect(backToAverages).toBeVisible()
    const ticksBefore = Array.from(
      chart.querySelectorAll('[data-chart-tick]'),
      (tick) => tick.getAttribute('data-chart-tick'),
    )
    const datesBefore = Array.from(
      chart.querySelectorAll('[data-chart-date-tick]'),
      (tick) => tick.getAttribute('data-chart-date-tick'),
    )
    const avaPoints = chart.querySelectorAll(
      '[data-series-id="member-a"][data-chart-point]',
    )
    expect(avaPoints.length).toBeGreaterThan(0)
    fireEvent.focus(avaPoints[0])
    expect(screen.getByRole('tooltip')).toHaveTextContent('Ava —')

    fireEvent.click(avaToggle)
    expect(avaToggle).toHaveAttribute('aria-pressed', 'false')
    expect(
      chart.querySelectorAll('[data-chart-series-id="member-a"]'),
    ).toHaveLength(0)
    expect(chart.querySelectorAll('[data-series-id="member-a"]')).toHaveLength(
      0,
    )
    expect(
      chart.querySelectorAll('[data-series-id="member-b"]'),
    ).not.toHaveLength(0)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    expect(backToAverages).toBeVisible()
    expect(
      Array.from(chart.querySelectorAll('[data-chart-tick]'), (tick) =>
        tick.getAttribute('data-chart-tick'),
      ),
    ).toEqual(ticksBefore)
    expect(
      Array.from(chart.querySelectorAll('[data-chart-date-tick]'), (tick) =>
        tick.getAttribute('data-chart-date-tick'),
      ),
    ).toEqual(datesBefore)

    fireEvent.click(noraToggle)
    expect(noraToggle).toHaveAttribute('aria-pressed', 'false')
    expect(
      screen.getByRole('status', { name: 'Chart visibility status' }),
    ).toHaveTextContent('All participants are hidden')
    expect(sharedHistory.textContent).toBe(sourceHistoryBefore)
    expect(legend).toBeVisible()
    expect(avaToggle).toBeVisible()
    fireEvent.click(avaToggle)
    expect(avaToggle).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.queryByRole('status', { name: 'Chart visibility status' }),
    ).not.toBeInTheDocument()
    expect(
      chart.querySelectorAll('[data-series-id="member-a"]'),
    ).not.toHaveLength(0)
    expect(chart.querySelectorAll('[data-series-id="member-b"]')).toHaveLength(
      0,
    )
  })
  it('keeps each identity color aligned across comparison, legend, member selection, and date filters', async () => {
    const entries: GroupChartEntry[] = [
      {
        memberKey: 'member-z',
        displayName: 'Zoe',
        date: '2026-09-01',
        weightKg: 80,
      },
      {
        memberKey: 'member-z',
        displayName: 'Zoe',
        date: '2026-09-02',
        weightKg: 79,
      },
      {
        memberKey: 'member-b',
        displayName: 'Bea',
        date: '2026-09-01',
        weightKg: 90,
      },
      {
        memberKey: 'member-b',
        displayName: 'Bea',
        date: '2026-09-02',
        weightKg: 89,
      },
      {
        memberKey: 'member-k',
        displayName: 'Kai',
        date: '2026-09-01',
        weightKg: 85,
      },
      {
        memberKey: 'member-k',
        displayName: 'Kai',
        date: '2026-09-02',
        weightKg: 84,
      },
    ]
    render(
      <GroupChartHistory
        challengeId="group"
        viewerId="viewer"
        persistence={persistence(
          vi.fn().mockResolvedValue({ state: 'success', data: entries }),
        )}
        refreshVersion={0}
      />,
    )

    const comparison = await screen.findByRole('img', {
      name: 'Weight (kg) — shared group history',
    })
    const initialColors = new Map<string, string>()
    for (const path of comparison.querySelectorAll(
      'path[data-series="recorded-connection"]',
    )) {
      const memberName = path.querySelector('title')?.textContent?.split(' ')[0]
      if (memberName)
        initialColors.set(memberName, path.getAttribute('stroke')!)
    }
    expect(initialColors.size).toBe(3)
    expect(new Set(initialColors.values()).size).toBe(3)

    const legend = screen.getByRole('list', { name: 'Group chart legend' })
    for (const [name, color] of initialColors) {
      const item = within(legend).getByText(name).closest('li')!
      expect(item.querySelector('span')).toHaveStyle({ borderColor: color })
    }

    fireEvent.click(screen.getByRole('button', { name: 'Show last 1 week' }))
    for (const [name, color] of initialColors) {
      const item = within(legend).getByText(name).closest('li')!
      expect(item.querySelector('span')).toHaveStyle({ borderColor: color })
    }

    for (const [name, color] of initialColors) {
      fireEvent.click(screen.getByRole('tab', { name }))
      const individual = screen.getByRole('img', {
        name: 'Weight (kg) — shared group history',
      })
      const line = individual.querySelector(
        'path[data-series="recorded-connection"]',
      )
      expect(line).toHaveAttribute('stroke', color)
      if (name === 'Bea') {
        const points = Array.from(
          individual.querySelectorAll(
            'circle[data-point-kind="recorded"][data-value]',
          ),
        )
        expect(points.map((point) => point.getAttribute('data-value'))).toEqual(
          ['90', '89'],
        )
        expect(individual).toHaveTextContent('Weight (kg)')
        expect(points[0].querySelector('title')).toHaveTextContent('90 kg')
        fireEvent.focus(points[1])
        expect(screen.getByRole('tooltip')).toHaveTextContent('89 kg')
      }
      const item = within(legend).getByText(name).closest('li')!
      expect(item.querySelector('span')).toHaveStyle({ borderColor: color })
    }
  })
  it('uses the same view-only ranges for all members and an individual member chart', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 430,
    })
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
            signedDisplayPercentage: 50,
            negativeProgressCapped: false,
            progressState: 'in_progress',
            reachedTargetMilestones: [],
          },
        ]}
      />,
    )
    const chart = await screen.findByRole('img', {
      name: 'Weight (kg) — shared group history',
    })
    expect(
      chart.querySelectorAll(
        'circle[data-point-kind]:not([data-point-kind="estimated"])[data-date]',
      ),
    ).toHaveLength(5)
    expect(chart.querySelectorAll('text.chart-value')).toHaveLength(2)
    expect(
      Array.from(chart.querySelectorAll('text.chart-value'), (label) =>
        label.textContent?.trim(),
      ),
    ).toEqual(['90', '86'])
    const firstPoint = chart.querySelector(
      'circle[data-point-kind="recorded"][data-chart-point]',
    )!
    fireEvent.focus(firstPoint)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Ava —')
    expect(firstPoint.querySelector('title')).toHaveTextContent('Ava:')
    expect(
      screen.getByRole('list', { name: 'Group chart legend' }),
    ).toHaveTextContent('Ava')
    expect(
      screen.getByRole('region', { name: 'Group comparison chart' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('region', {
        name: 'Scrollable group comparison chart',
      }),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show last 1 month' }))
    expect(
      chart.querySelectorAll(
        'circle[data-point-kind]:not([data-point-kind="estimated"])[data-date]',
      ),
    ).toHaveLength(2)
    expect(chart.querySelector('[data-chart-reference]')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show last 3 months' }))
    expect(
      chart.querySelectorAll(
        'circle[data-point-kind]:not([data-point-kind="estimated"])[data-date]',
      ),
    ).toHaveLength(4)
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
    expect(
      chart.querySelectorAll(
        'circle[data-point-kind]:not([data-point-kind="estimated"])[data-date]',
      ),
    ).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: 'Show all dates' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Ava' }))
    const individual = screen.getByRole('img', {
      name: 'Weight (kg) — shared group history',
    })
    expect(
      individual.querySelectorAll(
        'circle[data-point-kind="recorded"][data-date]',
      ),
    ).toHaveLength(5)
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
    expect(
      individual.querySelectorAll(
        'circle[data-point-kind="recorded"][data-date]',
      ),
    ).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: 'Show all dates' }))
    expect(
      individual.querySelectorAll(
        'circle[data-point-kind="recorded"][data-date]',
      ),
    ).toHaveLength(5)
    expect(load).toHaveBeenCalledTimes(1)
    expect(load).toHaveBeenCalledWith('group')
  })
  it('plots actual kg for all and individual member views with padded axes and preserves gaps', async () => {
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
    expect(chart).toHaveAttribute('viewBox', '0 0 760 302')
    expect(chart).toHaveTextContent('Weight (kg)')
    const circles = Array.from(
      chart.querySelectorAll('circle[data-point-kind="recorded"]'),
    )
    const extremaLabels = Array.from(
      chart.querySelectorAll<SVGTextElement>('text.chart-value'),
      (label) => label.textContent,
    )
    expect(extremaLabels).toEqual(
      expect.arrayContaining(['80', '79', '100', '98', '90', '110']),
    )
    expect(extremaLabels.every((label) => !label?.includes('Member'))).toBe(
      true,
    )
    const plotBottom =
      Number(chart.getAttribute('viewBox')?.split(/\s+/)[3]) - 36
    const eighty = circles.find(
      (circle) => circle.textContent === 'Member 0: 01.09.2026, 80 kg',
    )!
    const hundred = circles.find(
      (circle) => circle.textContent === 'Member 1: 01.09.2026, 100 kg',
    )!
    expect(Number(hundred.getAttribute('cy'))).toBeLessThan(
      Number(eighty.getAttribute('cy')),
    )
    expect(Number(eighty.getAttribute('cy'))).toBeGreaterThan(27)
    for (const circle of circles) {
      expect(Number(circle.getAttribute('cy'))).toBeGreaterThan(27)
      expect(Number(circle.getAttribute('cy'))).toBeLessThanOrEqual(plotBottom)
    }
    expect(
      chart.querySelectorAll('[data-series="recorded-connection"]'),
    ).toHaveLength(1)
    expect(
      chart.querySelectorAll('[data-series="estimated-connection"]').length,
    ).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('tab', { name: 'Member 0' }))
    const individual = screen.getByRole('img', {
      name: 'Weight (kg) — shared group history',
    })
    expect(
      individual.querySelector('circle[data-point-kind="recorded"] title'),
    ).toHaveTextContent('Member 0: 01.09.2026, 80 kg')
    expect(individual).toHaveTextContent('79 kg')
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
    expect(
      screen
        .getByRole('img')
        .querySelectorAll('circle[data-point-kind="recorded"]'),
    ).toHaveLength(1)
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
    expect(chart).toHaveAccessibleDescription(
      /latest 7 calendar dates stay detailed/,
    )
    expect(
      screen.getByText(/Explicitly shared dates and weights only/),
    ).toHaveClass('sr-only')
    expect(
      screen.getByText(/Hollow points estimate missing dates/),
    ).toHaveClass('sr-only')
    expect(
      chart.querySelectorAll('circle[data-point-kind="recorded"]'),
    ).toHaveLength(2)
    expect(
      chart.querySelectorAll('[data-series="recorded-connection"]'),
    ).toHaveLength(0)
    expect(
      chart.querySelectorAll('[data-series="estimated-connection"]'),
    ).toHaveLength(2)
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
