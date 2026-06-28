import { test, expect, Page } from '@playwright/test';

/**
 * Public-route smoke for the react-router v7 migration. These routes render
 * without authentication, so they exercise the app.tsx <Routes>, the
 * registration wizard routing, and the legal pages end-to-end in a real browser.
 *
 * Assertion strategy: a route is "healthy" if navigating to it produces NO
 * uncaught page exception (the signal of a router/render crash) and mounts
 * content into #appRoot. This is independent of backend availability, so the
 * suite stays green in CI even when the dev API can't be reached.
 */

/** Attach an uncaught-exception collector; returns a getter for the errors. */
function trackPageErrors(page: Page): () => string[] {
	const errors: string[] = [];
	page.on('pageerror', (err) => errors.push(String(err)));
	return () => errors;
}

const PUBLIC_ROUTES = [
	'/login',
	'/registration',
	'/registration/topic-selection',
	'/impressum',
	'/datenschutz'
];

test.describe('public routes render without crashing (router v7)', () => {
	for (const route of PUBLIC_ROUTES) {
		test(`${route} mounts without an uncaught exception`, async ({
			page
		}) => {
			const getErrors = trackPageErrors(page);
			await page.goto(route, { waitUntil: 'domcontentloaded' });

			// App root must contain rendered output (not a blank/crashed tree).
			const appRoot = page.locator('#appRoot');
			await expect(appRoot).toBeAttached();
			await expect
				.poll(async () =>
					appRoot.evaluate((el) => el.childElementCount)
				)
				.toBeGreaterThan(0);

			expect(
				getErrors(),
				`uncaught exceptions on ${route}`
			).toEqual([]);
		});
	}
});

test('/login renders the sign-in form', async ({ page }) => {
	const getErrors = trackPageErrors(page);
	await page.goto('/login');
	// Password field is static (no backend needed) — proves the login route mounts.
	await expect(page.locator('input[type="password"]')).toBeVisible();
	expect(getErrors()).toEqual([]);
});

test('/registration/topic-selection renders the wizard step form', async ({
	page
}) => {
	await page.goto('/registration/topic-selection');
	// The step form carries data-cy="registration-form"; its presence proves the
	// migrated /registration/:step route resolves to the step (not the welcome
	// screen) and the activeStep conditional renders the form.
	await expect(page.locator('[data-cy="registration-form"]')).toBeVisible();
});
