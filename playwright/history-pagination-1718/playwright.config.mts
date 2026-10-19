import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
export default defineConfig({
	testDir: '.',
	outputDir: resolve(process.cwd(), 'test-results/history1718'),
	testMatch: 'history.spec.ts',
	workers: 1,
	retries: 0,
	timeout: 90000,
	use: {
		baseURL: 'http://127.0.0.1:9021',
		viewport: { width: 1440, height: 900 },
		locale: 'en-US',
		trace: 'off',
		video: 'off',
		launchOptions: { channel: 'chrome' }
	},
	webServer: {
		cwd: process.cwd(),
		command:
			'node node_modules/vite/bin/vite.js --config playwright/history-pagination-1718/vite.config.mts',
		url: 'http://127.0.0.1:9021/playwright/history-pagination-1718/index.html',
		reuseExistingServer: false,
		timeout: 180000
	}
});
