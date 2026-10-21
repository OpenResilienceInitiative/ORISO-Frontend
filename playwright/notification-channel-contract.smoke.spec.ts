import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await page.goto('/playwright/notification-channel-browser-harness.html');
	await expect(page.locator('#result')).toHaveText('ready');
});

test('browser banner and sound remain independent from the legacy email flag', async ({
	page
}) => {
	await page
		.getByRole('button', { name: 'Emit message for advice seeker' })
		.click();
	await expect(page.locator('#result')).toContainText('"kind":"mapped"');
	await expect(page.locator('#result')).toContainText('"sounds":1');
	await expect(page.locator('#result')).toContainText(
		'"requireInteraction":true'
	);
	await page.getByLabel('Browser banner', { exact: true }).uncheck();
	await page.getByLabel('Legacy Matrix email flag').check();
	await page
		.getByRole('button', { name: 'Emit message for advice seeker' })
		.click();
	const output = JSON.parse(
		(await page.locator('#result').textContent()) || '{}'
	);
	expect(output.banners).toHaveLength(1);
	expect(output.sounds).toBe(2);
	await page.getByLabel('Browser banner', { exact: true }).check();
	await page.getByLabel('Notification sound').uncheck();
	await page
		.getByRole('button', { name: 'Emit message for advice seeker' })
		.click();
	const next = JSON.parse(
		(await page.locator('#result').textContent()) || '{}'
	);
	expect(next.banners).toHaveLength(2);
	expect(next.sounds).toBe(2);
});

test('mail-unmapped events and unknown recipients retain existing browser routing', async ({
	page
}) => {
	await page
		.getByRole('button', { name: 'Emit existing mail-unmapped event' })
		.click();
	await expect(page.locator('#result')).toContainText('"kind":"unmapped"');
	await page
		.getByRole('button', { name: 'Emit message for unknown recipient' })
		.click();
	await expect(page.locator('#result')).toContainText(
		'"kind":"unknown-recipient"'
	);
	const output = JSON.parse(
		(await page.locator('#result').textContent()) || '{}'
	);
	expect(output.banners).toHaveLength(2);
	expect(output.sounds).toBe(2);
});

test('browser permission does not mute sound, while device silence gates both', async ({
	page
}) => {
	await page.getByLabel('Browser permission').uncheck();
	await page
		.getByRole('button', { name: 'Emit message for advice seeker' })
		.click();
	let output = JSON.parse(
		(await page.locator('#result').textContent()) || '{}'
	);
	expect(output.banners).toHaveLength(0);
	expect(output.sounds).toBe(1);
	await page.getByLabel('Browser permission').check();
	await page.getByLabel('Mute this device').check();
	await page
		.getByRole('button', { name: 'Emit message for advice seeker' })
		.click();
	output = JSON.parse((await page.locator('#result').textContent()) || '{}');
	expect(output.banners).toHaveLength(0);
	expect(output.sounds).toBe(1);
});
