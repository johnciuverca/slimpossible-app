import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  webServer: {
    command:
      "VITE_SUPABASE_URL='' VITE_SUPABASE_ANON_KEY='' npm run dev -- --host 127.0.0.1 --port 4173",
    reuseExistingServer: false,
    url: 'http://127.0.0.1:4173',
  },
})
