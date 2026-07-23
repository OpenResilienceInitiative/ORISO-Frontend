import { expect, Page, test } from '@playwright/test';
import { resolve } from 'node:path';

const artifactPath = (name: string) =>
	resolve(process.cwd(), '../../_e2e-artifacts/self-help-group', name);

const proveReload = async (page: Page) => {
	await page.goto('/playwright/matrix-crypto-browser-harness.html');
	await expect(
		page.locator('[data-testid="matrix-crypto-status"]')
	).toHaveText('prepared', { timeout: 30_000 });

	await page.reload();

	await expect(
		page.locator('[data-testid="matrix-crypto-status"]')
	).toHaveText('recovered', { timeout: 30_000 });
};

test('keeps Megolm history decryptable after a desktop browser reload', async ({
	page
}) => {
	await proveReload(page);
	await page.screenshot({
		path: artifactPath('matrix-crypto-reload-desktop.png'),
		fullPage: true
	});
});

test('keeps Megolm history decryptable after a mobile browser reload', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await proveReload(page);
	await page.screenshot({
		path: artifactPath('matrix-crypto-reload-mobile.png'),
		fullPage: true
	});
});
