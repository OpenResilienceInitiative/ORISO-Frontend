import { defineConfig, devices } from '@playwright/test';

// Verified in installed test runtime 1.58.2 and browser runtime 1.62.1:
// _takePageSnapshot returns before capturing DOM when this flag is set.
// Recheck that internal guard when upgrading Playwright.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';

export default defineConfig({
	testDir: './playwright',
	testMatch: 'password-recovery.e2e.spec.ts',
	fullyParallel: false,
	workers: 1,
	retries: 0,
	timeout: 180_000,
	expect: { timeout: 30_000 },
	outputDir: process.env.ORISO_RECOVERY_OUTPUT_DIR || 'test-results/recovery',
	reporter: [['list']],
	use: {
		locale: 'de-DE',
		baseURL: process.env.PLAYWRIGHT_BASE_URL,
		actionTimeout: 30_000,
		navigationTimeout: 30_000,
		trace: 'off',
		video: 'off',
		screenshot: 'off'
	},
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
		{ name: 'webkit', use: { ...devices['Desktop Safari'] } }
	]
});
