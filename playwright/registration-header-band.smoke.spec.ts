import { expect, Page, test } from '@playwright/test';

/**
 * Layout contract for the sticky registration header (the "stepper band").
 *
 * Owner defect: between the mobile hero (which only exists below $fromXLarge)
 * and the desktop header row (which only exists from `lg` = 1200px up), the
 * band pinned 72px below the top of the scroller, kept a semi-transparent
 * background, and stayed at column width — so list rows scrolled through the
 * gap above it, shone through it, and stayed visible in the gutters next to
 * it. The band must pin flush against whatever sits above it and must be
 * opaque and full-bleed wherever no header row exists.
 *
 * The topic list is mocked so the page has enough content to actually scroll;
 * the layout under test is independent of which topics come back.
 */

const TOPIC_FIXTURES = Array.from({ length: 14 }, (_, i) => ({
	id: i + 1,
	name: `Topic ${i + 1}`,
	slug: `topic-${i + 1}`,
	description:
		'Support for questions around ageing, care, and everyday life in a longer sentence so rows take real height.',
	internalIdentifier: `topic-${i + 1}`,
	status: 'ACTIVE',
	createDate: '2026-01-01T00:00:00Z',
	updateDate: '2026-01-01T00:00:00Z',
	fallbackUrl: '',
	titles: {
		short: `Topic ${i + 1}`,
		long: `Topic ${i + 1} — long title`,
		registrationDropdown: `Topic ${i + 1}`,
		welcome: `Topic ${i + 1}`
	}
}));

async function openTopicSelection(page: Page) {
	await page.route('**/service/topic/public*', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(TOPIC_FIXTURES)
		})
	);
	await page.goto('/registration/topic-selection');
	await expect(page.locator('[data-cy="registration-form"]')).toBeVisible();
	await expect(page.locator('.registrationStepperSticky')).toBeVisible();
}

/** The inner scroll container of the registration layout. */
const SCROLLER = '.stageLayout--registration';

async function scrollScroller(page: Page, top: number) {
	await page.evaluate(
		([selector, value]) => {
			const scroller = document.querySelector(selector as string);
			if (!scroller) throw new Error('scroller not found');
			scroller.scrollTop = value as number;
		},
		[SCROLLER, top] as const
	);
	// One frame so sticky positioning settles before measuring.
	await page.evaluate(
		() => new Promise((resolve) => requestAnimationFrame(resolve))
	);
}

async function bandMetrics(page: Page) {
	return page.evaluate(() => {
		const band = document.querySelector('.registrationStepperSticky');
		if (!band) throw new Error('band not found');
		const rect = band.getBoundingClientRect();
		const styles = getComputedStyle(band);
		const channels = styles.backgroundColor
			.match(/rgba?\(([^)]+)\)/)?.[1]
			.split(/[,/]/)
			.map((channel) => parseFloat(channel));
		const alpha = channels?.length === 4 ? channels[3] : 1;
		return {
			top: rect.top,
			left: rect.left,
			right: rect.right,
			computedTop: styles.top,
			position: styles.position,
			backgroundAlpha: alpha
		};
	});
}

for (const viewport of [
	{ width: 720, height: 1000 },
	{ width: 1000, height: 720 },
	{ width: 390, height: 844 }
]) {
	test(`band pins flush, opaque and full-bleed at ${viewport.width}x${viewport.height} (no header row below lg)`, async ({
		page
	}) => {
		await page.setViewportSize(viewport);
		await openTopicSelection(page);

		await scrollScroller(page, 400);
		const metrics = await bandMetrics(page);

		expect(metrics.position).toBe('sticky');
		// Below lg there is no in-flow header row above the band, so it must
		// pin at the very top of the scroller — no gap for rows to scroll
		// through.
		expect(metrics.computedTop).toBe('0px');
		expect(Math.abs(metrics.top)).toBeLessThanOrEqual(1);
		// Opaque: rows underneath must not shine through the band.
		expect(metrics.backgroundAlpha).toBe(1);
		// Full-bleed: no see-through gutters left or right of the band.
		expect(metrics.left).toBeLessThanOrEqual(0.5);
		expect(metrics.right).toBeGreaterThanOrEqual(viewport.width - 1);
	});
}

test('band pins flush under the 72px header row at 1440x900 (lg and up)', async ({
	page
}) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await openTopicSelection(page);

	const header = page.locator('.stageLayout__header');
	await expect(header).toBeVisible();

	await scrollScroller(page, 400);
	const metrics = await bandMetrics(page);
	const headerBottom = await header.evaluate(
		(el) => el.getBoundingClientRect().bottom
	);

	// The header row is sticky at the top and 72px tall; the band pins
	// directly beneath it — flush, no gap, nothing sliced between them.
	expect(metrics.computedTop).toBe('72px');
	expect(Math.abs(metrics.top - headerBottom)).toBeLessThanOrEqual(1);
	expect(metrics.backgroundAlpha).toBe(1);
});
