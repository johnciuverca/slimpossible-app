# Standalone design preview

The interactive concept is a static page at `/design-preview/` from [`public/design-preview/index.html`](../public/design-preview/index.html). It is separate from React and does not import app code, contact external services, or read or write authentication, database, or browser storage.

Names, weights, dates, and notes are fictional. The proposed privacy model is labeled as a concept; notes are omitted from group history; and both challenge destinations start checked on the sample weigh-in. Controls only change the local illustration and saving is disabled.

Vite includes the page in its build output as a static asset. On a Vercel deployment, open `/design-preview/`; a PR Preview URL exists only if the repository's Vercel integration creates one. App routes and runtime are unchanged, though merging this static asset makes the standalone concept path available on deployments.
