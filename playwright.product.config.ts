import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
export default defineConfig({
	build: { external: ['**/playwright/product-vite/dev-fixture.mjs'] },
	testDir: 'playwright/product-vite',
	testMatch: 'dev-contract.spec.ts',
	workers: 1,
	retries: 0,
	timeout: 90000,
	outputDir:
		process.env.PRODUCT_BROWSER_OUTPUT ||
		resolve('test-results/product-dev'),
	use: {
		viewport: { width: 1440, height: 900 },
		locale: 'en-US',
		trace: 'retain-on-failure',
		launchOptions: { channel: 'chrome' }
	}
});
