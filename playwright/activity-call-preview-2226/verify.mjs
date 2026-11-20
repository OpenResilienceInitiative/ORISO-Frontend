import { chromium, expect } from 'playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * #2226 Dev check after deploy: a counsellor's "Online-Termin geöffnet"
 * entry shows its conversation under the title / time / Join bar; selecting
 * it joins nothing; the Activity search is as tall as the Conversations one.
 *
 * STORAGE_STATE: a counsellor session from
 *   test-access playwright-login oriso/dev/<counsellor>
 * (a live session: never print or commit the file).
 */
const state = process.env.STORAGE_STATE;
if (!state) throw new Error('Set STORAGE_STATE to a counsellor session file');
const base = process.env.APP_URL || 'https://dev.oriso.org';
const output =
	process.env.EVIDENCE_DIR || join(tmpdir(), 'oriso-activity-call-2226');
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
	storageState: state,
	locale: 'de-DE',
	viewport: { width: 1440, height: 900 }
});
try {
	const page = await context.newPage();
	await page.goto(`${base}/sessions/consultant/sessionView`);
	const conversationsSearch = page
		.locator('.sessionsListToolbar__searchInner')
		.first();
	await conversationsSearch.waitFor({ timeout: 30000 });
	const conversationsHeight = (await conversationsSearch.boundingBox())
		.height;

	await page.goto(`${base}/notifications`);
	const entry = page.getByText('Online-Termin geöffnet').first();
	await entry.waitFor({ timeout: 30000 });
	await entry.click();
	const bar = page.locator('[data-cy="activity-event-bar"]');
	await expect(bar).toBeVisible();
	await expect(bar.getByRole('button', { name: 'Beitreten' })).toBeVisible();
	await expect(page.locator('.conversationPreview')).toBeVisible();
	// Selecting only shows: no call overlay.
	await expect(
		page.locator('.callOverlay, [data-cy="call-widget"]')
	).toHaveCount(0);
	const activityHeight = (
		await page
			.locator('.sessionsListToolbar__searchInner')
			.first()
			.boundingBox()
	).height;
	expect(Math.round(activityHeight)).toBe(Math.round(conversationsHeight));
	await page.screenshot({ path: join(output, 'after-dev-call-entry.png') });
	console.log(`#2226 verified on ${base}; evidence in ${output}`);
} finally {
	await context.close();
	await browser.close();
}
