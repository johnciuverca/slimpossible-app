import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'group-dashboard.spec.ts',
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'on-first-retry',
  },
  webServer: {
    command:
      "VITE_SUPABASE_URL='https://group-preview.supabase.co' VITE_SUPABASE_ANON_KEY='e2e-public-anon-key' npm run dev -- --host 127.0.0.1 --port 4174 --strictPort",
    reuseExistingServer: false,
    url: 'http://127.0.0.1:4174',
  },
})
