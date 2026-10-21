import { defineConfig } from '@playwright/test';
export default defineConfig({
	testDir: '.',
	fullyParallel: false,
	workers: 1,
	use: {
		browserName: 'chromium',
		channel: 'chrome',
		headless: true,
		deviceScaleFactor: 1
	},
	webServer: {
		command: 'node_modules/.bin/storybook dev -p 6218 --ci',
		url: 'http://127.0.0.1:6218',
		reuseExistingServer: true,
		timeout: 120_000
	},
	outputDir: '../../test-results/responsive-handover-1187'
});
