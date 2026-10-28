import { test, expect, type Locator } from '@playwright/test';

for (const locale of ['de', 'en', 'fr']) {
	for (const viewport of [
		{ width: 390, height: 844 },
		{ width: 820, height: 1180 },
		{ width: 1440, height: 900 },
		{ width: 390, height: 420 },
		{ width: 820, height: 480 },
		{ width: 1440, height: 480 },
		{ width: 320, height: 568 }
	]) {
		test(`protected wizard footer stays visible at ${viewport.width}×${viewport.height} (${locale})`, async ({
			page
		}) => {
			await page.setViewportSize(viewport);
			await page.goto(
				`http://127.0.0.1:6218/iframe.html?id=templates-sessions-protectedcaseresponsive--desktop&viewMode=story&globals=locale:${locale}`,
				{ waitUntil: 'domcontentloaded' }
			);
			await page
				.getByRole('button', {
					name: /Schritt für Schritt|step by step|Montrer étape par étape/
				})
				.click();
			const panel = (await page
				.locator('.contentWrapper__detail')
				.boundingBox())!;
			const back = page.getByRole('button', {
				name: /Zurück|Back|Retour/,
				exact: true
			});
			const next = page.getByRole('button', {
				name: /Weiter|Next|Continuer/,
				exact: true
			});
			const assertFooterVisible = async (forward: Locator) => {
				for (const control of [back, forward]) {
					const bounds = (await control.boundingBox())!;
					expect(bounds.y).toBeGreaterThanOrEqual(panel.y);
					expect(bounds.y + bounds.height).toBeLessThanOrEqual(
						Math.min(panel.y + panel.height, viewport.height)
					);
					expect(bounds.x).toBeGreaterThanOrEqual(panel.x);
					expect(bounds.x + bounds.width).toBeLessThanOrEqual(
						Math.min(panel.x + panel.width, viewport.width)
					);
				}
			};
			await assertFooterVisible(next);
			const restingFooter = (await next.boundingBox())!;
			await page.mouse.move(panel.x + panel.width / 2, panel.y + 150);
			await page.mouse.wheel(0, 1000);
			await assertFooterVisible(next);
			await expect
				.poll(async () =>
					Math.abs((await next.boundingBox())!.y - restingFooter.y)
				)
				.toBeLessThan(1);
			const reason = page.getByRole('radio', {
				name: /Rat erbeten|Advice requested|Conseil demandé/
			});
			await reason.click();
			await next.click();
			const request = page.getByRole('button', {
				name: /Zugriff anfragen|Request access|Demander l'accès/
			});
			await assertFooterVisible(request);
			await page.getByRole('textbox').fill('Fictional advice request.');
			await expect(request).toBeEnabled();
			await assertFooterVisible(request);
			await page.mouse.wheel(0, -1000);
			await assertFooterVisible(request);
			await expect
				.poll(async () =>
					Math.abs((await request.boundingBox())!.y - restingFooter.y)
				)
				.toBeLessThan(1);
			const topic = page.getByText('Schwangerschaftsberatung', {
				exact: true
			});
			await expect(topic).toBeVisible();
			await expect(topic).not.toHaveAttribute('role', 'button');
			await expect(topic).not.toHaveAttribute('tabindex');
			expect(
				await topic.evaluate(
					(element) => getComputedStyle(element).borderTopLeftRadius
				)
			).toBe('0px');
			// A request is deliberately not submitted; access behavior stays with the existing API tests.
		});
	}
}

test('short phone body scrolls normally in both directions while the footer stays fixed', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 420 });
	await page.goto(
		'http://127.0.0.1:6218/iframe.html?id=templates-sessions-protectedcaseresponsive--description-on-short-phone&viewMode=story&globals=locale:de',
		{ waitUntil: 'domcontentloaded' }
	);
	const body = page.locator('.scrollableSection__body');
	const next = page.getByRole('button', {
		name: 'Zugriff anfragen',
		exact: true
	});
	await expect(next).toBeVisible();
	await expect
		.poll(() => body.evaluate((element) => element.scrollTop))
		.toBe(0);
	if (process.env.FOOTER_SCROLL_NEGATIVE_CONTROL === '1') {
		// Explicit test-only negative control: a hidden body must fail the wheel oracle.
		await body.evaluate((element) => {
			element.style.overflowY = 'hidden';
		});
	}
	const footerBounds = (await next.boundingBox())!;
	const bodyBounds = (await body.boundingBox())!;
	await page.mouse.move(
		bodyBounds.x + bodyBounds.width / 2,
		bodyBounds.y + bodyBounds.height / 2
	);
	await page.mouse.wheel(0, 1000);
	await expect
		.poll(() => body.evaluate((element) => element.scrollTop))
		.toBeGreaterThan(0);
	await expect
		.poll(async () =>
			Math.abs((await next.boundingBox())!.y - footerBounds.y)
		)
		.toBeLessThan(1);
	await page.mouse.wheel(0, -1000);
	await expect
		.poll(() => body.evaluate((element) => element.scrollTop))
		.toBe(0);
	await expect
		.poll(async () =>
			Math.abs((await next.boundingBox())!.y - footerBounds.y)
		)
		.toBeLessThan(1);
});

test('each wizard step starts at the top and keyboard focus stays in the footer', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 568 });
	await page.goto(
		'http://127.0.0.1:6218/iframe.html?id=templates-sessions-protectedcaseresponsive--desktop&viewMode=story&globals=locale:de',
		{ waitUntil: 'domcontentloaded' }
	);
	await page.getByRole('button', { name: /Schritt für Schritt/ }).click();
	const body = page.locator('.scrollableSection__body');
	const assertStepStartsVisible = async () => {
		await expect
			.poll(() => body.evaluate((element) => element.scrollTop))
			.toBe(0);
		const viewport = (await body.boundingBox())!;
		const heading = (await page
			.getByRole('heading', { level: 3 })
			.boundingBox())!;
		expect(heading.y).toBeGreaterThanOrEqual(viewport.y);
		expect(heading.y + heading.height).toBeLessThanOrEqual(
			viewport.y + viewport.height
		);
	};
	const scrollBodyDown = async () => {
		const bounds = (await body.boundingBox())!;
		await page.mouse.move(
			bounds.x + bounds.width / 2,
			bounds.y + bounds.height / 2
		);
		await page.mouse.wheel(0, 1000);
		await expect
			.poll(() => body.evaluate((element) => element.scrollTop))
			.toBeGreaterThan(0);
	};
	await assertStepStartsVisible();
	await page.getByRole('radio', { name: /Rat erbeten/ }).click();
	await scrollBodyDown();
	await page.keyboard.press('Tab');
	await expect(
		page.getByRole('button', { name: 'Weiter', exact: true })
	).toBeFocused();
	await page.keyboard.press('Enter');
	await assertStepStartsVisible();
	await expect(
		page.getByRole('button', { name: 'Zurück', exact: true })
	).toBeFocused();
	await page.getByRole('textbox').fill('Fictional advice request.');
	await scrollBodyDown();
	await page.keyboard.press('Tab');
	await expect(
		page.getByRole('button', { name: 'Zurück', exact: true })
	).toBeFocused();
	await page.keyboard.press('Enter');
	await assertStepStartsVisible();
	await expect(
		page.getByRole('button', { name: 'Weiter', exact: true })
	).toBeFocused();
});

test('reason shortcut hints show the bare digits that select reasons', async ({
	page
}) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto(
		'http://127.0.0.1:6218/iframe.html?id=templates-sessions-protectedcaseresponsive--desktop&viewMode=story&globals=locale:en',
		{ waitUntil: 'domcontentloaded' }
	);
	await page.getByRole('button', { name: /step by step/ }).click();
	await expect(page.locator('kbd')).toHaveText(['1', '2', '3', '4']);
	await page.getByRole('radio', { name: 'Advice requested' }).click();
	await page.keyboard.press('1');
	await expect(
		page.getByRole('radio', { name: 'Planned absence', exact: true })
	).toBeChecked();
	await page.keyboard.press('2');
	await expect(
		page.getByRole('radio', { name: 'Unplanned absence', exact: true })
	).toBeChecked();
});
