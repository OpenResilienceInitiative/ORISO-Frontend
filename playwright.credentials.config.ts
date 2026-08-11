import { defineConfig, devices } from '@playwright/test';

/**
 * The three-engine config for every check that needs a real browser.
 *
 * Separate from `playwright.config.ts` on purpose: that one boots the CRA dev server and needs a
 * reachable backend, so it is chromium-only and local-only. These specs run against a **Storybook
 * build**, need no backend at all, and their whole point is that they run in **all three engines**.
 *
 * Two things live here, and neither is provable in one engine or in jsdom:
 *
 * - **Credential saving** (ORISO-Frontend#825) — the Credential Management API is Chromium-only, so
 *   a chromium-only run would prove exactly nothing about Safari and Firefox.
 * - **Consent-gate focus containment** (ORISO-UserService#927) — jsdom does not move focus on Tab,
 *   so a simulated Tab passes against a dialog that leaks in a real browser.
 *
 * Serve a Storybook build first and point `STORYBOOK_URL` at it:
 *
 *   npm run build-storybook
 *   npx http-server storybook-static -p 6041 --silent &
 *   STORYBOOK_URL=http://localhost:6041 npx playwright test --config playwright.credentials.config.ts
 */
export default defineConfig({
	testDir: './playwright',
	testMatch: /\.crossbrowser\.spec\.ts$/,
	timeout: 30_000,
	expect: { timeout: 10_000 },
	fullyParallel: true,
	reporter: 'list',
	use: {
		baseURL: process.env.STORYBOOK_URL || 'http://localhost:6041'
	},
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
		{ name: 'firefox', use: { ...devices['Desktop Firefox'] } },
		// WebKit is the engine Safari ships; it is the strictest of the three
		// about autocomplete contracts, which is why it must not be skipped.
		{ name: 'webkit', use: { ...devices['Desktop Safari'] } }
	]
});
