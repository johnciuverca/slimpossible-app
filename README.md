# slimpossible-app

React weight-loss challenge app based on the Slimpossible tracker

The app uses Tailwind CSS v4 through the Vite plugin. Tailwind utility classes
are imported from `src/index.css` and are available throughout the React app.
`AppLayout` provides the shared page shell and a content slot for future routed
pages. Client-side routes use React Router and currently include Today, Progress,
Goals, and a not-found fallback.
Reusable UI primitives live in `src/components/ui` and currently include typed
buttons, cards, page headers, status pills, progress bars, and text inputs.

## Code style

ESLint checks TypeScript and React code. Prettier provides the shared formatting
conventions: no semicolons, single quotes, trailing commas, two-space
indentation, and an 80-character print width.

## Getting started

Install dependencies and start the Vite development server:

```bash
npm install
npm run dev
```

Available checks:

```bash
npm run lint
npm run typecheck
npm run format:check
npm test
npm run test:e2e
npm run build
```

Run `npm run format` to apply the formatting conventions automatically.

Run `npm test` to execute the Vitest unit tests once. The first test covers the
visible foundation screen so the initial React app has a regression check.

Run `npm run test:e2e` to run the Playwright smoke test against the local Vite
app. If Playwright has not been set up on the machine yet, install its Chromium
browser once with `npx playwright install chromium`.
