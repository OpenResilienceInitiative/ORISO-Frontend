import { expect, test } from '@playwright/test';

/**
 * Browser regression for the react-joyride consultant walkthrough (TOUR-01).
 *
 * Needs an authenticated consultant storageState (e.g. from the Dreambau
 * Test Access broker) because the tour only exists behind login:
 *
 *   ORISO_TOUR_STORAGE_STATE=/path/to/storage-state.json npm run test:smoke -- product-tour
 *
 * PreDev's cluster settings currently ship `enableWalkthrough=false`; the
 * spec overrides only that flag in the settings response so the tour surface
 * can run. Everything else — routes, targets, the walkThroughEnabled PATCH —
 * is exercised for real.
 */
const storageState = process.env.ORISO_TOUR_STORAGE_STATE;

test.describe('consultant product tour', () => {
	test.skip(
		!storageState,
		'set ORISO_TOUR_STORAGE_STATE to an authenticated consultant storage state'
	);

	test.use({ storageState });

	test('runs the migrated five-step walkthrough across its real routes', async ({
		page
	}) => {
		test.setTimeout(240_000);

		await page.route('**/service/settings', async (route) => {
			const response = await route.fetch();
			const body = await response.json();
			if (body.enableWalkthrough) {
				body.enableWalkthrough.value = true;
			}
			await route.fulfill({ response, json: body });
		});

		const tooltip = page.locator('.productTourTooltip');
		const title = tooltip.locator('.productTourTooltip__title');
		const next = () =>
			tooltip.getByRole('button', { name: 'Weiter' }).click();

		// Enable the walkthrough through the real profile switch.
		await page.goto('/profile/allgemeines', {
			waitUntil: 'domcontentloaded'
		});
		await page.waitForSelector('[data-tour-target="profile-overview"]', {
			timeout: 60_000
		});
		const switchEl = page
			.locator(
				'.twoFactorAuth__switch input[type="checkbox"], .twoFactorAuth__switch [role="switch"]'
			)
			.first();
		await switchEl.waitFor({ timeout: 30_000 });
		if (!(await switchEl.isChecked().catch(() => false))) {
			await switchEl.click({ force: true });
		}

		// Step 1: centered introduction.
		await expect(title).toHaveText(/Rundgang|Tour/, { timeout: 30_000 });

		// Step 2: enquiries on the sessionPreview route.
		await next();
		await page.waitForURL('**/sessions/consultant/sessionPreview**');
		await expect(title).toHaveText(/Erstanfragen|Initial inquiries/);

		// Step 3: my sessions.
		await next();
		await page.waitForURL('**/sessions/consultant/sessionView**');
		await expect(title).toHaveText(/Meine Beratungen|My consultations/);

		// Step 4: archive tab.
		await next();
		await page.waitForURL('**sessionListTab=archive**');
		await expect(title).toHaveText(/Archiv|Archive/);

		// Step 5: profile, then finish → the legacy boolean flips off.
		await next();
		await page.waitForURL('**/profile/allgemeines**');
		await expect(title).toHaveText(/Profil|Profile/);

		const finishPatch = page.waitForResponse(
			(r) =>
				r.url().includes('/service/users/data') &&
				r.request().method() === 'PATCH'
		);
		await tooltip.getByRole('button', { name: /Fertig|Done/ }).click();
		expect((await finishPatch).status()).toBeLessThan(300);
		await expect(tooltip).toBeHidden({ timeout: 15_000 });
	});
});
