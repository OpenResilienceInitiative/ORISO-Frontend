import { chromium, expect } from 'playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Clean browser: unlike SavedIconRail, FilledTimeline has no width-seeding
// hook. Only the first mount is seeded; a reload must read the product write.
const base = process.env.STORYBOOK_URL || 'http://localhost:6018';
const output =
	process.env.EVIDENCE_DIR || join(tmpdir(), 'oriso-activity-rail');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({
	locale: 'de-DE',
	viewport: { width: 1440, height: 900 },
	recordVideo: { dir: output, size: { width: 1440, height: 900 } }
});
const results = [];
try {
	const page = await context.newPage();
	const url = `${base}/iframe.html?id=organisms-notificationscenter--filled-timeline&viewMode=story`;
	const column = page.locator('.notificationsCenter__listColumn');
	const pills = page.locator('.sessionRailPill');
	const handle = page.getByRole('separator');
	const cards = page.locator('.notificationsCenter__card');
	const saved = () =>
		page.evaluate(() =>
			localStorage.getItem('notificationsTimeline_width')
		);
	const settled = async () => {
		await page.evaluate(async () => {
			await document.fonts.ready;
			const root = document.querySelector('.notificationsCenter');
			await Promise.all(
				root
					.getAnimations({ subtree: true })
					.filter(
						(a) =>
							a.playState === 'running' &&
							a.effect?.getTiming().iterations !== Infinity
					)
					.map((a) => a.finished.catch(() => {}))
			);
		});
	};
	const ready = async () => {
		await page.waitForFunction(
			() =>
				window.__STORYBOOK_PREVIEW__?.storyRenders?.length > 0 &&
				window.__STORYBOOK_PREVIEW__.storyRenders.some((r) =>
					['completing', 'completed'].includes(r.phase)
				)
		);
		await settled();
	};

	await page.goto(url);
	await ready();
	await page.evaluate(() =>
		localStorage.setItem('notificationsTimeline_width', '400')
	);
	await page.reload();
	await ready();
	await expect(cards.first()).toBeVisible();
	const grip = await handle.boundingBox();
	await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
	await page.mouse.down();
	await page.mouse.move(
		(await column.boundingBox()).x + 100,
		grip.y + grip.height / 2,
		{ steps: 12 }
	);
	await page.mouse.up();
	await expect(pills.first()).toBeVisible();
	await expect.poll(saved).toBe('80');
	await expect.poll(async () => (await column.boundingBox()).width).toBe(80);
	await page.reload();
	await ready();
	await expect(pills.first()).toBeVisible();
	await expect.poll(saved).toBe('80');
	results.push(
		'Actual drag saved80; reload restored80 without a fixture reseeding storage.'
	);
	await pills.nth(2).hover();
	await expect(page.getByRole('tooltip')).toContainText(
		'Neue Klient:innen-Anfrage'
	);
	await page.screenshot({
		path: join(output, 'rail-tooltip-1440x900.png'),
		animations: 'disabled'
	});
	await pills.nth(2).click();
	await expect(pills.nth(2)).toHaveAttribute('aria-current', 'true');
	await expect(pills.first()).not.toHaveAttribute('aria-current', 'true');
	await handle.focus();
	await page.keyboard.press('ArrowDown');
	await expect
		.poll(() =>
			page
				.locator('.notificationsCenter__list')
				.evaluate((e) => e.scrollTop)
		)
		.toBeGreaterThan(0);
	results.push('Tooltip, selection and keyboard vertical scrolling passed.');
	// Same persisted desktop preference must not collapse tablet/phone.
	for (const [width, height] of [
		[1199, 900],
		[1200, 900],
		[820, 1180],
		[390, 844],
		[1440, 900]
	]) {
		await page.setViewportSize({ width, height });
		if (width >= 1200) {
			await expect(pills.first()).toBeVisible();
			await expect(handle).toBeVisible();
			await expect(
				page.locator('.notificationsCenter__detail')
			).toBeVisible();
			await expect
				.poll(async () => (await column.boundingBox()).width)
				.toBe(80);
		} else {
			await expect(pills).toHaveCount(0);
			await expect(cards.first()).toBeVisible();
			await expect(handle).toHaveCount(0);
			await expect(
				page.locator('.notificationsCenter__detail')
			).toBeHidden();
		}
		await expect.poll(saved).toBe('80');
		await settled();
		await page.mouse.move(width - 2, height - 2);
		await page.evaluate(() => document.activeElement?.blur());
		await page.screenshot({
			path: join(output, `rail-responsive-${width}x${height}.png`),
			animations: 'disabled'
		});
		results.push(
			`${width}x${height}: ${width >= 1200 ? 'rail and detail' : 'normal cards'}; preference retained.`
		);
	}
	await handle.dblclick();
	await expect(pills).toHaveCount(0);
	await expect.poll(saved).toBe('397');
	await page.reload();
	await ready();
	await expect(cards.first()).toBeVisible();
	await expect(pills).toHaveCount(0);
	await expect.poll(saved).toBe('397');
	const seams = await page.evaluate(() => {
		const rows = [
			...document.querySelectorAll('.notificationsCenter__listRow')
		];
		const a = rows.at(-2).querySelector('.notificationsCenter__card');
		const z = rows.at(-1).querySelector('.notificationsCenter__card');
		return {
			before: getComputedStyle(a).borderBottomLeftRadius,
			top: getComputedStyle(z).borderTopLeftRadius,
			bottom: getComputedStyle(z).borderBottomLeftRadius,
			gap:
				z.getBoundingClientRect().top - a.getBoundingClientRect().bottom
		};
	});
	expect(seams).toEqual({
		before: '0px',
		top: '0px',
		bottom: '32px',
		gap: 0
	});
	results.push(
		'Double-click expands to397; reload restores expanded mode; contiguous group and rounded final edge preserved.'
	);
	await page.screenshot({
		path: join(output, 'rail-expanded-1440x900.png'),
		animations: 'disabled'
	});
	console.log(JSON.stringify(results, null, 2));
	await writeFile(
		join(output, 'verification.json'),
		JSON.stringify({ results, seams }, null, 2)
	);
} finally {
	await context.close();
	await browser.close();
}
