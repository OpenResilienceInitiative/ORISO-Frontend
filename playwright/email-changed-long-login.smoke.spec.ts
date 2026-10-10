import { expect, test } from '@playwright/test';

const STORY_URL =
	'/iframe.html?id=email-pages-emailgeaendert--long-login&viewMode=story';

test('a long readable login stays within the 390 px changed-address mail', async ({
	page
}) => {
	await page.goto(STORY_URL);
	const mail = page.frameLocator('iframe[title="E-Mail-Vorschau"]');
	await expect(mail.locator('body')).toContainText(
		'readable-abcdefghijabcdefghij'
	);

	const bounds = await mail.locator('body').evaluate(() => ({
		contentWidth: Math.max(
			document.body.scrollWidth,
			document.documentElement.scrollWidth
		),
		viewportWidth: document.documentElement.clientWidth
	}));
	// The preview's one-pixel iframe borders leave a 388px document viewport.
	expect(bounds.viewportWidth).toBe(388);
	expect(bounds.contentWidth).toBeLessThanOrEqual(bounds.viewportWidth + 1);
});
