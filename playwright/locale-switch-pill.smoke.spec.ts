import { expect, Page, test } from '@playwright/test';

/**
 * Layout and labelling contract for the public language switch (pill/circle).
 *
 * Owner defect: the open menu rendered its options visually collapsed and
 * top-aligned instead of vertically centered, and the touch target fell far
 * short of the 44px the stylesheet promises. On top of that the option labels
 * mixed the UI language with English fallbacks ("Deutsch, Englisch, Russian,
 * Tigrinya…"). A language menu must be readable by someone who cannot read
 * the current UI language, so options are labelled with endonyms — every
 * language named in itself.
 */

async function openMenu(page: Page, trigger: string) {
	const button = page.locator(trigger);
	await expect(button).toBeVisible();
	await button.click();
	const options = page.locator('.localeSwitchPill__menu [role="option"]');
	await expect(options.first()).toBeVisible();
	// Wait for the Menu grow transition to settle so boxes are final.
	await expect
		.poll(async () => {
			const a = await options.first().boundingBox();
			await page.waitForTimeout(80);
			const b = await options.first().boundingBox();
			return a && b && Math.abs(a.height - b.height) < 0.5
				? a.height
				: -1;
		})
		.toBeGreaterThan(0);
	return options;
}

async function optionMetrics(page: Page) {
	return page.evaluate(() => {
		const options = Array.from(
			document.querySelectorAll('.localeSwitchPill__menu [role="option"]')
		);
		return options.map((option) => {
			const rect = option.getBoundingClientRect();
			// Measure the label's actual line box (the text node), not the
			// union of all children — that is what the user sees centered or
			// not. The leading check column is measured separately.
			const textNode = Array.from(option.childNodes).find(
				(node) =>
					node.nodeType === Node.TEXT_NODE &&
					(node.textContent || '').trim().length > 0
			);
			const range = document.createRange();
			if (textNode) {
				range.selectNode(textNode);
			} else {
				range.selectNodeContents(option);
			}
			const textRect = range.getBoundingClientRect();
			const check = option.querySelector(
				'.localeSwitchPill__optionCheck'
			);
			const checkRect = check?.getBoundingClientRect();
			return {
				label: (option.textContent || '').trim(),
				height: rect.height,
				optionCenterY: rect.top + rect.height / 2,
				textCenterY: textRect.top + textRect.height / 2,
				checkCenterY: checkRect
					? checkRect.top + checkRect.height / 2
					: null
			};
		});
	});
}

for (const scenario of [
	{
		name: 'desktop pill (login header)',
		viewport: { width: 1440, height: 900 },
		trigger: 'button.localeSwitchPill--pill'
	},
	{
		name: 'mobile hero circle',
		viewport: { width: 390, height: 844 },
		trigger: 'button.localeSwitchPill--circle'
	}
] as const) {
	test(`${scenario.name}: options are 44px targets with centered content`, async ({
		page
	}) => {
		await page.setViewportSize(scenario.viewport);
		await page.goto('/login');
		await openMenu(page, scenario.trigger);

		const options = await optionMetrics(page);
		expect(options.length).toBeGreaterThan(1);

		for (const option of options) {
			// Real touch-target height, not just a declared min-height.
			expect
				.soft(option.height, `height of "${option.label}"`)
				.toBeGreaterThanOrEqual(44);
			// Vertically centered content: option center and text center match.
			expect
				.soft(
					Math.abs(option.optionCenterY - option.textCenterY),
					`vertical centering of "${option.label}"`
				)
				.toBeLessThanOrEqual(2);
			// The leading check column must sit on the same centerline.
			if (option.checkCenterY !== null) {
				expect
					.soft(
						Math.abs(option.optionCenterY - option.checkCenterY),
						`check column centering of "${option.label}"`
					)
					.toBeLessThanOrEqual(2);
			}
		}
	});
}

test('menu stays keyboard-operable: arrow keys walk the options', async ({
	page
}) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto('/login');
	const options = await openMenu(page, 'button.localeSwitchPill--pill');

	const first = options.first();
	await expect(first).toBeFocused();
	await page.keyboard.press('ArrowDown');
	await expect(options.nth(1)).toBeFocused();
	await page.keyboard.press('ArrowUp');
	await expect(first).toBeFocused();
});

test('options are endonyms — every language named in itself', async ({
	page,
	context
}) => {
	// Force a German UI so the old mixed "Deutsch, Englisch, Russian, …"
	// labelling would be caught red-handed.
	await context.addCookies([
		{ name: 'lang', value: 'de', domain: 'localhost', path: '/' }
	]);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto('/login');
	await openMenu(page, 'button.localeSwitchPill--pill');

	const labels = (await optionMetrics(page)).map((option) => option.label);

	// de and en are always part of the platform's locale set. Under the
	// endonym rule their labels are fixed regardless of the UI language.
	expect(labels).toContain('Deutsch');
	expect(labels).toContain('English');

	// The old behaviour fell back to English exonyms ("Russian", "Turkish")
	// for every locale the German catalogue never translated, and showed the
	// German exonym "Englisch" for en. None of these may appear: a language
	// must be named in itself so speakers who cannot read the current UI
	// language still find their own entry.
	for (const wrong of [
		'Englisch',
		'Russian',
		'Tigrinya',
		'Turkish',
		'French',
		'Ukrainian'
	]) {
		expect
			.soft(labels, `exonym "${wrong}" must not appear`)
			.not.toContain(wrong);
	}
});
