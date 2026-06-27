import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright smoke config for the react-router v7 migration.
 *
 * Boots the real CRA dev server (which serves the migrated app and proxies API
 * calls to the dev backend) and runs browser-level smoke specs against the
 * public routes. The specs assert that routes render without an uncaught
 * exception — a real router/render crash — independent of backend availability,
 * so they stay green in CI even when the dev API is unreachable.
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
