import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Local production-component Storybook: pass its root as an argument if not on 16008.
const base = process.argv[2] || 'http://localhost:16008';
const browser = await chromium.launch({ headless: true });
try {
	const page = await browser.newPage({
		viewport: { width: 390, height: 844 },
		reducedMotion: 'reduce'
	});
	await page.goto(
		`${base}/iframe.html?id=components-message-messagesubmitinterface--default&viewMode=story`
	);
	const shell = page.locator('.textarea__wrapper-send-message');
	await shell.waitFor();
	await shell.locator('[contenteditable="true"]').click();
	const handle = shell.locator('.dragHandle');
	await handle.focus();
	await handle.press('Home');
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.waitForTimeout(500);
	const geometry = await shell.evaluate((el) => {
		const editor = el.querySelector('[contenteditable="true"]');
		const outer = el.getBoundingClientRect();
		const text = editor.getBoundingClientRect();
		return {
			height: outer.height,
			editorHeight: text.height,
			editorBottom: text.bottom,
			outerBottom: outer.bottom
		};
	});
	console.log(JSON.stringify(geometry));
	assert.ok(
		geometry.height >= 138,
		'Desktop composer must retain space for its toolbar and text after a mobile resize'
	);
	assert.ok(
		geometry.editorHeight >= 20,
		'Editor must leave a readable text line'
	);
	assert.ok(
		geometry.editorBottom <= geometry.outerBottom + 1,
		'Editor must not be clipped below its frame'
	);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.waitForTimeout(300);
	const mobileEditor = await shell
		.locator('[contenteditable="true"]')
		.boundingBox();
	assert.ok(
		mobileEditor && mobileEditor.height >= 20,
		'The editor stays readable after returning to mobile'
	);
	await handle.focus();
	await handle.press('Home');
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.waitForTimeout(300);
	assert.ok(
		(await shell.boundingBox()).height >= 138,
		'Repeated mobile-to-desktop changes remain safe'
	);
} finally {
	await browser.close();
}
