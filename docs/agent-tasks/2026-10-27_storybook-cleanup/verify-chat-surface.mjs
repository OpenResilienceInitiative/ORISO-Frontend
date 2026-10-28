// Run from the repository root with Storybook on port 6017.
// Fresh browser contexts make each viewport independent of persisted UI state.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(`${process.cwd()}/package.json`);
const { chromium } = require('playwright');
const origin = process.env.STORYBOOK_URL || 'http://localhost:6017';
const output = process.env.CHAT_EVIDENCE_DIR || '/tmp/oriso-chat-surface';
const locale = process.env.CHAT_LOCALE || 'de';
const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
	encoding: 'utf8'
}).trim();
const dirty =
	execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()
		.length > 0;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
	for (const [width, height] of [
		[390, 844],
		[820, 1180],
		[1440, 900]
	]) {
		for (let pass = 1; pass <= 2; pass++) {
			const context = await browser.newContext({
				viewport: { width, height },
				timezoneId: 'Europe/Prague'
			});
			try {
				const page = await context.newPage();
				await page.goto(
					`${origin}/iframe.html?id=app-oriso-consultant-chat-surface--consultant-chat&viewMode=story&globals=locale:${locale}`
				);
				await page.locator('.appOrisoRuntimeRail').waitFor();
				await page
					.locator('.messageItem__messageTime')
					.nth(2)
					.waitFor();
				await page.evaluate(() => document.fonts.ready);
				await page.evaluate(async () => {
					await Promise.allSettled(
						document
							.getAnimations()
							.filter(
								(a) =>
									a.playState === 'running' &&
									Number.isFinite(
										a.effect?.getComputedTiming().endTime
									)
							)
							.map((a) => a.finished)
					);
				});
				await page
					.locator('[aria-label="Chatverlauf"]')
					.evaluate((el) => {
						el.scrollTop = 0;
					});
				await page.evaluate(
					() =>
						new Promise((resolve) => requestAnimationFrame(resolve))
				);
				const metrics = await page.evaluate(() => {
					const chat = document.querySelector(
						'[aria-label="Chatraum"]'
					);
					const title = chat.querySelector(
						'.sessionInfo__username h3'
					);
					const header = chat
						.querySelector('.sessionInfo')
						.getBoundingClientRect();
					const card = chat.getBoundingClientRect();
					const style = getComputedStyle(title);
					const nav = document.querySelector(
						'.appOrisoRuntimeRail .navigation__wrapper'
					);
					const links = nav.querySelectorAll(
						'.navigation__item__top a'
					);
					const first = links[0].getBoundingClientRect(),
						second = links[1].getBoundingClientRect();
					return {
						actualLocale: document.documentElement.lang,
						title: title.textContent,
						titleHeight: title.getBoundingClientRect().height,
						headerWidth: header.width,
						chatWidth: card.width,
						headerRight: header.right,
						chatRight: card.right,
						lineHeight: parseFloat(style.lineHeight),
						whiteSpace: style.whiteSpace,
						textOverflow: style.textOverflow,
						datePills: chat.querySelectorAll(
							'.messageDateDivider__pill'
						).length,
						times: [
							...chat.querySelectorAll(
								'.messageItem__timeRail .messageItem__messageTime'
							)
						].map((n) => n.textContent.trim()),
						avatarWidths: [
							...chat.querySelectorAll(
								'.messageItem__avatar [data-testid="user-avatar"]'
							)
						].map((n) => n.getBoundingClientRect().width),
						headerAvatarWidths: [
							...chat.querySelectorAll(
								'.sessionInfo [data-testid="user-avatar"]'
							)
						].map((n) => n.getBoundingClientRect().width),
						verticalNav:
							second.top > first.top &&
							Math.abs(second.left - first.left) < 1,
						horizontalNav:
							second.left > first.left &&
							Math.abs(second.top - first.top) < 1,
						chatBottom: chat.getBoundingClientRect().bottom,
						navTop: nav.getBoundingClientRect().top
					};
				});
				await page.screenshot({
					path: `${output}/chat-${width}x${height}-pass-${pass}.png`
				});
				console.log(
					JSON.stringify({
						revision,
						dirty,
						locale,
						width,
						height,
						pass,
						...metrics
					})
				);
				assert.ok(
					metrics.actualLocale.startsWith(locale),
					'Requested locale must actually be active'
				);
				assert.ok(
					metrics.headerWidth >= metrics.chatWidth - 64,
					'Header must fill the chat card'
				);
				assert.ok(
					metrics.headerRight <= metrics.chatRight + 1,
					'Header must not overflow the card'
				);
				assert.ok(
					metrics.titleHeight <= metrics.lineHeight + 1,
					'Header name must stay on one line'
				);
				assert.equal(metrics.whiteSpace, 'nowrap');
				assert.equal(metrics.textOverflow, 'ellipsis');
				assert.equal(metrics.datePills, 1);
				assert.deepEqual(metrics.times, ['09:18', '09:21', '09:24']);
				assert.ok(metrics.avatarWidths.length >= 2);
				assert.ok(metrics.avatarWidths.every((width) => width === 48));
				assert.ok(
					metrics.headerAvatarWidths.some((width) => width >= 40)
				);
				if (width < 900) {
					assert.ok(metrics.horizontalNav);
					assert.ok(metrics.chatBottom <= metrics.navTop + 1);
				} else assert.ok(metrics.verticalNav);
				await page
					.locator('[aria-label="Chatverlauf"]')
					.evaluate((el) => {
						el.scrollTop = el.scrollHeight;
					});
				await page.evaluate(
					() =>
						new Promise((resolve) => requestAnimationFrame(resolve))
				);
				const end = await page.evaluate(() => ({
					lastTimeBottom: document
						.querySelector(
							'[data-message-id="$consultant-chat-3"] .messageItem__messageTime'
						)
						.getBoundingClientRect().bottom,
					composerTop: document
						.querySelector(
							'[aria-label="Chatraum"] .textarea__wrapper-send-message'
						)
						.getBoundingClientRect().top
				}));
				assert.ok(
					end.lastTimeBottom <= end.composerTop,
					'Last timestamp must be reachable above the composer'
				);
				await page.screenshot({
					path: `${output}/chat-end-${width}x${height}-pass-${pass}.png`
				});
			} finally {
				await context.close();
			}
		}
	}
} finally {
	await browser.close();
}
