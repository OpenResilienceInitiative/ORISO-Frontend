import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import type axe from 'axe-core';

/** Local Storybook only: synthetic preferences; no Dev, mail or real account. */
const viewports = [
	{ name: 'mobile', width: 390, height: 844 },
	{ name: 'tablet', width: 820, height: 1180 },
	{ name: 'desktop', width: 1440, height: 900 }
];
for (const viewport of viewports) {
	for (const locale of ['de', 'en', 'ru']) {
		test(`internal-chat preference stays usable at ${viewport.name} in ${locale}`, async ({
			page
		}) => {
			await page.setViewportSize(viewport);
			await page.goto(
				`/iframe.html?id=organisms-emailnotificationsettings--counsellor-internal-chat-preference&viewMode=story&globals=locale:${locale}`
			);
			const row = page.locator(
				'[data-cy="notification-switch-internalChat"]'
			);
			const toggle = row.getByRole('switch');
			await expect(row).toHaveClass(/notifications__row--highlighted/);
			await expect(toggle).toBeChecked();
			await expect(page.getByRole('switch')).toHaveCount(10);
			await expect(
				page.locator('[data-cy="notification-switch-feedback"]')
			).toBeVisible();
			await row.scrollIntoViewIfNeeded();
			const bounds = await row.boundingBox();
			expect(bounds).not.toBeNull();
			expect(bounds!.x).toBeGreaterThanOrEqual(0);
			expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
				viewport.width
			);
			await toggle.focus();
			await expect(toggle).toBeFocused();
			await toggle.press('Space');
			await expect
				.poll(async () =>
					page.evaluate(
						() =>
							JSON.parse(
								sessionStorage.getItem(
									'storybook.internal-chat.preference'
								) || 'null'
							)?.emailNotifications.settings
								.internalChatNotificationEnabled
					)
				)
				.toBe(false);
			await page.reload();
			await expect(toggle).not.toBeChecked();
			await expect(row).toHaveClass(/notifications__row--highlighted/);
			const evidence = process.env.ORISO_LOCAL_EVIDENCE_DIR;
			if (evidence) {
				mkdirSync(evidence, { recursive: true });
				await row.scrollIntoViewIfNeeded();
				await page.screenshot({
					path: join(
						evidence,
						`02-after-local-${viewport.name}-${locale}-saved-opt-out.png`
					),
					fullPage: true
				});
			}
			await page.addScriptTag({
				path: require.resolve('axe-core/axe.min.js')
			});
			const violations = await page.evaluate(async () => {
				const browserAxe = (
					window as typeof window & { axe: typeof axe }
				).axe;
				let result: axe.AxeResults | undefined;
				// Storybook's accessibility addon can be scanning the same fresh
				// render. Wait only for that documented collision, never a violation.
				for (let attempt = 0; attempt < 50; attempt++) {
					try {
						result = await browserAxe.run(document.body, {
							runOnly: {
								type: 'tag',
								values: [
									'wcag2a',
									'wcag2aa',
									'wcag21aa',
									'wcag22aa'
								]
							}
						});
						break;
					} catch (error) {
						if (
							!(error instanceof Error) ||
							!error.message.includes('Axe is already running')
						)
							throw error;
						await new Promise((resolve) =>
							setTimeout(resolve, 100)
						);
					}
				}
				if (!result)
					throw new Error(
						'Storybook accessibility scan did not finish'
					);
				return result.violations.map(({ id, impact, nodes }) => ({
					id,
					impact,
					targets: nodes.map(({ target }) => target)
				}));
			});
			expect(violations).toEqual([]);
		});
	}
}
