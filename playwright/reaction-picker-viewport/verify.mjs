// Run against a local Storybook: STORYBOOK_URL=http://localhost:16010 node playwright/reaction-picker-viewport/verify.mjs
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.STORYBOOK_URL || 'http://localhost:6006';
const browser = await chromium.launch({ headless: true });
try {
	for (const reducedMotion of ['reduce', 'no-preference']) {
		const page = await browser.newPage({
			viewport: { width: 320, height: 844 },
			reducedMotion
		});
		await page.goto(
			`${base}/iframe.html?id=components-chat-messageitem--quick-reactions-outgoing-narrow&viewMode=story`
		);
		const more = page.locator('.messageItem__actionMenuReactionMore');
		await more.waitFor();
		// Allow the story's keyboard interaction to finish before reopening.
		await page.waitForTimeout(2000);
		const popup = page.getByTestId('emoji-picker-popup');
		if (await popup.count()) await more.click();
		await page.evaluate(() => {
			window.__pickerFrames = [];
			const started = performance.now();
			const sample = () => {
				const popup = document.querySelector(
					'[data-testid="emoji-picker-popup"]'
				);
				if (popup) {
					const box = popup.getBoundingClientRect();
					const picker = popup.querySelector('.EmojiPickerReact');
					window.__pickerFrames.push({
						left: box.left,
						top: box.top,
						right: box.right,
						bottom: box.bottom,
						rendered: Boolean(picker),
						transition: picker
							? getComputedStyle(picker).transition
							: ''
					});
				}
				if (performance.now() - started < 1600)
					requestAnimationFrame(sample);
			};
			requestAnimationFrame(sample);
		});
		await more.click();
		await popup.locator('.EmojiPickerReact').waitFor();
		await page.waitForTimeout(1650);
		const frames = await page.evaluate(() => window.__pickerFrames);
		const visible = frames.filter(
			(frame) => frame.top >= 0 && frame.rendered
		);
		assert.ok(visible.length > 0, 'rendered picker must be observed');
		assert.ok(
			visible.every(
				(frame) =>
					frame.left >= 0 && frame.right <= 320 && frame.bottom <= 844
			),
			`picker leaves viewport with ${reducedMotion}: ${JSON.stringify(visible.find((frame) => frame.left < 0 || frame.right > 320 || frame.bottom > 844))}`
		);
		if (reducedMotion === 'reduce') {
			assert.ok(
				visible.every((frame) => frame.transition === 'none'),
				'reduced motion disables the picker transition'
			);
		}
		const search = popup.locator('input');
		await search.fill('smile');
		assert.equal(await search.inputValue(), 'smile');
		const emoji = popup.locator('.epr-emoji').first();
		await emoji.waitFor({ state: 'visible' });
		await emoji.click();
		await popup.waitFor({ state: 'hidden' });
		console.log(
			`${reducedMotion}: ${visible.length} visible frames in bounds; search and emoji selection work`
		);
		await page.close();
	}
} finally {
	await browser.close();
}
