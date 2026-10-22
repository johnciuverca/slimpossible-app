// Local-only visual fixture of the production component, never connected evidence.
import { createRoot } from 'react-dom/client'
import { GroupChartHistory } from '../../src/components/GroupChartHistory'
import type { Persistence } from '../../src/data/persistence'
import '../../src/index.css'
const persistence = {
  mode: 'remote',
  repositories: {
    groupProgress: {
      getChartHistory: async () => ({
        state: 'success',
        data: [
          {
            memberKey: 'one',
            displayName: 'Synthetic Alex',
            date: '2026-09-20',
            weightKg: 90,
          },
          {
            memberKey: 'one',
            displayName: 'Synthetic Alex',
            date: '2026-09-21',
            weightKg: 89.5,
          },
          {
            memberKey: 'one',
            displayName: 'Synthetic Alex',
            date: '2026-09-23',
            weightKg: 89,
          },
          {
            memberKey: 'two',
            displayName: 'Synthetic Sam',
            date: '2026-09-20',
            weightKg: 70,
          },
          {
            memberKey: 'two',
            displayName: 'Synthetic Sam',
            date: '2026-09-21',
            weightKg: 70.25,
          },
          {
            memberKey: 'two',
            displayName: 'Synthetic Sam',
            date: '2026-09-23',
            weightKg: 70.5,
          },
        ],
      }),
    },
  },
} as unknown as Persistence
createRoot(document.getElementById('root')!).render(
  <main className="mx-auto max-w-6xl p-4 sm:p-8">
    <p className="mb-4 font-semibold">
      Synthetic local-only chart fixture — not connected acceptance
    </p>
    <GroupChartHistory
      challengeId="synthetic-group"
      viewerId="synthetic-viewer"
      persistence={persistence}
      refreshVersion={0}
    />
  </main>,
)
