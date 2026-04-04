import { defineConfig } from '@playwright/test';

const apiPort = Number(process.env.PLAYWRIGHT_API_PORT || '4100');
const webPort = Number(process.env.PLAYWRIGHT_WEB_PORT || '3100');

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    trace: 'retain-on-failure',
  },
  reporter: 'list',
  webServer: [
    {
      command: `./api/node_modules/.bin/tsx tests/e2e/fixture-api-server.ts`,
      port: apiPort,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        PLAYWRIGHT_API_PORT: String(apiPort),
      },
    },
    {
      command: `npm run dev -- --hostname 127.0.0.1 -p ${webPort}`,
      cwd: './web',
      port: webPort,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_API_URL: `http://127.0.0.1:${apiPort}/api/v1`,
        NEXT_PUBLIC_API_TOKEN: 'dev-local-token',
      },
    },
  ],
});
