import { defineConfig, devices } from '@playwright/test';

/**
 * ORISO-Frontend#825 — the three-engine config for the credential-saving check.
 *
 * Separate from `playwright.config.ts` on purpose: that one boots the CRA dev server and needs a
 * reachable backend, so it is chromium-only and local-only. This spec runs against a **Storybook
 * build**, needs no backend at all, and its whole point is that it runs in **all three engines** —
 * the Credential Management API is Chromium-only, so a chromium-only run would prove nothing.
 *
 * Serve a Storybook build first and point `STORYBOOK_URL` at it:
 *
 *   npm run build-storybook
 *   npx http-server storybook-static -p 6041 --silent &
 *   STORYBOOK_URL=http://localhost:6041 npx playwright test --config playwright.credentials.config.ts
 */
export default defineConfig({
	testDir: './playwright',
	testMatch: /credential-saving\.crossbrowser\.spec\.ts/,
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
