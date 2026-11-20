import { test, expect } from '@playwright/test';

for (const locale of ['de', 'en', 'fr']) {
	for (const viewport of [
		{ width: 390, height: 844 },
		{ width: 820, height: 1180 },
		{ width: 1440, height: 900 },
		{ width: 320, height: 568 }
	]) {
		test(`protected request controls remain readable and reachable at ${viewport.width}px (${locale})`, async ({
			page
		}) => {
			await page.setViewportSize(viewport);
			await page.goto(
				`http://127.0.0.1:6218/iframe.html?id=templates-sessions-protectedcaseresponsive--desktop&viewMode=story&globals=locale:${locale}`,
				{ waitUntil: 'domcontentloaded' }
			);
			const curtain = page.locator('[data-cy="case-handover-curtain"]');
			const panel = page.locator('.contentWrapper__detail');
			await expect(curtain).toBeVisible();
			const assertFitsPanel = async () => {
				const bounds = await panel.boundingBox();
				const form = await curtain.boundingBox();
				expect(bounds).not.toBeNull();
				expect(form).not.toBeNull();
				expect(form!.x).toBeGreaterThanOrEqual(bounds!.x - 1);
				expect(form!.x + form!.width).toBeLessThanOrEqual(
					Math.min(viewport.width, bounds!.x + bounds!.width) + 1
				);
				expect(form!.width).toBeGreaterThan(280);
			};
			await assertFitsPanel();
			await page
				.getByRole('button', {
					name: /Schritt für Schritt|step by step|Montrer étape par étape/i
				})
				.click();
			const reason = page.getByRole('radio', {
				name: /Rat erbeten|Advice requested|Conseil demandé/i
			});
			await reason.click();
			await expect(reason).toHaveAttribute('aria-checked', 'true');
			await page
				.getByRole('button', { name: /Weiter|Next|Continuer/i })
				.click();
			await expect(page.getByRole('textbox')).toBeVisible();
			await assertFitsPanel();

			// A pointer user must reach the request button through normal scrolling;
			// locator.click()/focus would silently scroll overflow:hidden and hide this bug.
			const request = page.getByRole('button', {
				name: /Zugriff anfragen|Request access|Demander l'accès/i
			});
			const pane = (await panel.boundingBox())!;
			await page.mouse.move(
				pane.x + pane.width / 2,
				Math.min(pane.y + pane.height - 40, viewport.height - 100)
			);
			await page.mouse.wheel(0, 1000);
			await expect
				.poll(async () => {
					const button = (await request.boundingBox())!;
					return (
						button.y >= pane.y &&
						button.y + button.height <=
							Math.min(pane.y + pane.height, viewport.height)
					);
				})
				.toBe(true);
			await page
				.getByRole('textbox')
				.fill('Fictional request for advice.');
			await expect(request).toBeEnabled();
			await page.mouse.wheel(0, -1000);
			const protectionTitle = page.locator(
				'.caseHandoverCurtain__headerTitle'
			);
			await expect
				.poll(async () => {
					const title = (await protectionTitle.boundingBox())!;
					return (
						title.y >= pane.y &&
						title.y + title.height <=
							Math.min(pane.y + pane.height, viewport.height)
					);
				})
				.toBe(true);
			// No request is submitted and no protected conversation is revealed.
			await expect(curtain).toBeVisible();
		});
	}
}
