import { expect, Page, test } from '@playwright/test';

/**
 * Fold contract for the asker login screen on phones.
 *
 * Owner requirement: a new asker must see the registration entry — the
 * "New here?" line with the "to the consulting topics" link — without
 * scrolling, even with Chrome's browser chrome eating the viewport
 * (390x664). Registration is the primary path for a new asker; password
 * recovery is the exception and moves below it.
 *
 * Also covered: the login layout centered its content with
 * `justify-content: center`, and a flex container that centers overflowing
 * content clips the overflow at BOTH ends — the top part above the
 * scrollport is unreachable by scrolling. On short viewports the whole card
 * must stay reachable.
 */

const FORGOT_PASSWORD = '.loginForm .button-as-link:not(.consulting-topics)';
const TOPICS_LINK = '.loginForm .consulting-topics';
const REGISTER_BLOCK = '.loginForm__register';

async function openLogin(page: Page) {
	await page.goto('/login');
	await expect(page.locator('input[type="password"]')).toBeVisible();
	await expect(page.locator(REGISTER_BLOCK)).toBeVisible();
}

for (const viewport of [
	{ width: 390, height: 664 },
	{ width: 390, height: 844 }
]) {
	test(`registration entry is fully visible without scrolling at ${viewport.width}x${viewport.height}`, async ({
		page
	}) => {
		await page.setViewportSize(viewport);
		await openLogin(page);

		const topics = page.locator(TOPICS_LINK);
		const box = await topics.boundingBox();
		expect(box, 'consulting-topics link renders').toBeTruthy();
		// Fully inside the viewport without any scrolling.
		expect(box!.y).toBeGreaterThanOrEqual(0);
		expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);

		const register = await page.locator(REGISTER_BLOCK).boundingBox();
		expect(register!.y + register!.height).toBeLessThanOrEqual(
			viewport.height
		);
	});
}

test('password recovery sits below the registration entry, in DOM and on screen', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await openLogin(page);

	const forgot = page.locator(FORGOT_PASSWORD);
	const topics = page.locator(TOPICS_LINK);
	await expect(forgot).toBeVisible();

	// Visual order: recovery below the registration entry.
	const forgotBox = await forgot.boundingBox();
	const topicsBox = await topics.boundingBox();
	expect(forgotBox!.y).toBeGreaterThan(topicsBox!.y + topicsBox!.height - 1);

	// DOM order matches the visual order, so tab order and screen-reader
	// sequence follow the screen (no CSS-order divergence).
	const domOrderMatches = await page.evaluate(
		([forgotSelector, topicsSelector]) => {
			const forgotEl = document.querySelector(forgotSelector);
			const topicsEl = document.querySelector(topicsSelector);
			if (!forgotEl || !topicsEl) return false;
			return Boolean(
				topicsEl.compareDocumentPosition(forgotEl) &
					Node.DOCUMENT_POSITION_FOLLOWING
			);
		},
		[FORGOT_PASSWORD, TOPICS_LINK] as const
	);
	expect(domOrderMatches).toBe(true);
});

test('the whole login card stays reachable by scrolling on very short viewports', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 500 });
	await openLogin(page);

	const scroll = async (top: number) =>
		page.evaluate((value) => {
			// The app scrolls inside .stageLayout, not the document.
			const scroller = document.querySelector('.stageLayout');
			if (scroller) scroller.scrollTop = value;
			window.scrollTo(0, value);
		}, top);

	// Scrolled to the very top, the top of the card must be inside the
	// viewport — not clipped above it where no scrollbar can reach.
	await scroll(0);
	const headline = await page.locator('.loginForm__headline').boundingBox();
	expect(headline!.y).toBeGreaterThanOrEqual(0);

	// Scrolled to the bottom, the registration entry must be reachable.
	await scroll(100000);
	const topics = await page.locator(TOPICS_LINK).boundingBox();
	expect(topics!.y + topics!.height).toBeLessThanOrEqual(500 + 1);
});
