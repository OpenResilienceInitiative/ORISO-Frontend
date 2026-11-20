import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.STORYBOOK_URL || 'http://localhost:6029';
const browser = await chromium.launch({ headless: true });
try {
	const context = await browser.newContext({
		viewport: { width: 390, height: 844 },
		hasTouch: true
	});
	const page = await context.newPage();
	await page.goto(
		`${base}/iframe.html?id=templates-consultantsessionstage--phone-composer-drag-handle-is-reachable&viewMode=story`
	);
	const handle = page.locator('[data-cy="stage-main"] .dragHandle');
	const shell = page.locator(
		'[data-cy="stage-main"] .textarea__wrapper-send-message'
	);
	await handle.waitFor();
	// The story's own play function finishes before the native pointer check.
	await page.waitForFunction(
		() =>
			document
				.querySelector('.textarea__wrapper-send-message')
				?.getBoundingClientRect().height >= 140
	);
	const box = await handle.boundingBox();
	assert.ok(box);
	const x = box.x + box.width / 2;
	const y = box.y + box.height / 2;
	const before = (await shell.boundingBox()).height;
	const hit = await page.evaluate(
		({ x, y }) =>
			document.elementFromPoint(x, y)?.closest('.dragHandle') != null,
		{ x, y }
	);
	assert.ok(hit, 'the drag handle must be the browser hit target');
	const cdp = await context.newCDPSession(page);
	await cdp.send('Input.dispatchTouchEvent', {
		type: 'touchStart',
		touchPoints: [{ x, y }]
	});
	await cdp.send('Input.dispatchTouchEvent', {
		type: 'touchMove',
		touchPoints: [{ x, y: y - 48 }]
	});
	await cdp.send('Input.dispatchTouchEvent', {
		type: 'touchEnd',
		touchPoints: []
	});
	await page.waitForFunction(
		(height) =>
			document
				.querySelector('.textarea__wrapper-send-message')
				?.getBoundingClientRect().height > height,
		before
	);
	const after = (await shell.boundingBox()).height;
	console.log(
		`Native Chromium touch at 390x844: composer ${before}px -> ${after}px`
	);
	await context.close();
} finally {
	await browser.close();
}
