import { expect, test } from '@playwright/test';

/**
 * ORISO-UserService#927 — keyboard focus containment in the anonymous consent gate.
 *
 * <h3>Why this is a browser test and not a jsdom one</h3>
 *
 * jsdom does not move focus on Tab. A simulated Tab there passes against a dialog that leaks in a
 * real browser — a test that proves nothing while looking reassuring. Containment is a real
 * keyboard behaviour, so it is asserted where the keyboard is real, in all three engines.
 *
 * <h3>What is at stake</h3>
 *
 * The gate carries `aria-modal="true"`, which tells assistive technology that everything outside it
 * is inert. Without containment a keyboard user Tabs straight out into content the attribute claims
 * they cannot reach: the assertion is simply false, and the person ends up somewhere their screen
 * reader is no longer describing. This is the consent step for special-category data under §11 KDG,
 * so a dialog that lies about its own boundary is not a cosmetic problem.
 */

const STORY_URL =
	'/iframe.html?id=components-dialog-anonymousconsentgate--desktop-side-by-side&viewMode=story';

test.describe('anonymous consent gate — focus containment', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto(STORY_URL);
		await page.waitForSelector('[role="dialog"]');
	});

	test('starts with focus inside the dialog', async ({ page }) => {
		const inside = await page.evaluate(() => {
			const dialog = document.querySelector('[role="dialog"]');
			return Boolean(dialog && dialog.contains(document.activeElement));
		});

		expect(inside).toBe(true);
	});

	/**
	 * The invariant that actually matters, and the one `aria-modal` asserts:
	 * **focus never reaches interactive content outside the dialog.**
	 *
	 * Not "focus stays on a node inside the dialog". WebKit skips buttons in the
	 * tab order unless full keyboard access is on, so there Tab legitimately
	 * parks on `<body>` between the dialog's own links — a resting state, not an
	 * escape. Asserting the stricter form would have failed WebKit for a reason
	 * that has nothing to do with the trap, and "fixing" it would have meant
	 * weakening the dialog to satisfy a test.
	 *
	 * So a decoy control is injected outside the dialog first. If the trap ever
	 * lets go, focus lands on the decoy and this fails — in every engine.
	 */
	const addDecoyOutsideDialog = async (page) =>
		page.evaluate(() => {
			const decoy = document.createElement('a');
			decoy.id = 'decoy-outside-dialog';
			decoy.href = '#decoy';
			decoy.textContent = 'outside';
			document.body.appendChild(decoy);
		});

	const focusedDecoy = async (page) =>
		page.evaluate(
			() => document.activeElement?.id === 'decoy-outside-dialog'
		);

	test('never lets focus reach interactive content outside the dialog', async ({
		page
	}) => {
		await addDecoyOutsideDialog(page);

		// More presses than the dialog has controls, so the trap has to wrap.
		for (let step = 0; step < 10; step += 1) {
			await page.keyboard.press('Tab');
			expect(
				await focusedDecoy(page),
				`focus escaped to content outside the dialog after ${step + 1} Tab presses`
			).toBe(false);
		}
	});

	test('never lets focus escape backwards either', async ({ page }) => {
		await addDecoyOutsideDialog(page);

		for (let step = 0; step < 6; step += 1) {
			await page.keyboard.press('Shift+Tab');
			expect(
				await focusedDecoy(page),
				`focus escaped backwards after ${step + 1} Shift+Tab presses`
			).toBe(false);
		}
	});

	test('exposes an accessible name and description', async ({ page }) => {
		const dialog = page.locator('[role="dialog"]');

		await expect(dialog).toHaveAttribute('aria-modal', 'true');
		const labelledBy = await dialog.getAttribute('aria-labelledby');
		const describedBy = await dialog.getAttribute('aria-describedby');

		expect(labelledBy).toBeTruthy();
		expect(describedBy).toBeTruthy();
		await expect(page.locator(`#${labelledBy}`)).toBeVisible();
		await expect(page.locator(`#${describedBy}`)).toBeVisible();
	});
});
