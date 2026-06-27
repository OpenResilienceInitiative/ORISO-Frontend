import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright smoke config for the react-router v7 migration. LOCAL-ONLY
 * (`npm run test:smoke`) — not a CI job: the app's bootstrap needs a reachable
 * backend to render, and CI runners can't reach the dev cluster (the same reason
 * the Cypress suite isn't wired to CI). Run it locally with the dev backend
 * reachable (the committed .env points at the dev cluster).
 *
 * Boots the real CRA dev server and asserts the public routes render without an
 * uncaught exception. CI coverage of the migration's routing lives in vitest
 * (src/components/app/SessionsZone.routing.test.tsx).
 */
export default defineConfig({
	testDir: './playwright',
	timeout: 30_000,
	expect: { timeout: 10_000 },
	fullyParallel: true,
	retries: process.env.CI ? 1 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI ? [['github'], ['list']] : 'list',
	use: {
		baseURL: 'http://localhost:9001',
		trace: 'on-first-retry'
	},
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }
	],
	webServer: {
		command:
			'cross-env BROWSER=none PORT=9001 WDS_SOCKET_PORT=9001 FAST_REFRESH=false npm run dev',
		url: 'http://localhost:9001',
		reuseExistingServer: !process.env.CI,
		timeout: 180_000
	}
});
