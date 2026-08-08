import { expect, test } from '@playwright/test';

/**
 * ORISO-Frontend#825 — the cross-browser check for credential saving.
 *
 * <h3>What this proves, and what it deliberately does not</h3>
 *
 * The acceptance criterion says the browser save prompt must be **verified** in Safari, Firefox and
 * Chromium rather than assumed. It cannot be fully automated: the native save prompt is browser
 * *chrome*, outside the page, and no automation driver can observe it. Claiming otherwise would be
 * exactly the "assumed, not verified" failure the criterion exists to prevent.
 *
 * So this spec verifies everything the browser needs in order to offer that prompt, in all three
 * engines, and the final human step is written down in the PR as an explicit manual check:
 *
 * 1. **The Credential Management API is not the mechanism.** It is Chromium-only. If the card ever
 *    starts calling `navigator.credentials.store`, the feature silently stops working for Safari
 *    and Firefox users while continuing to look correct in a Chromium-based review — the single
 *    most likely way this regresses.
 * 2. **The username field carries the contract a password manager keys off** — `name="username"`,
 *    `autocomplete="username"`, and a readable value — in every engine. WebKit and Gecko are
 *    stricter here than Blink, which is precisely why one-engine verification is not enough.
 * 3. **Nothing offers a file download.** A `zugangsdaten.txt` in the download folder is a lasting
 *    trace on a device somebody else may use.
 *
 * Runs against the Storybook build, not the app, because the card is reachable there without an
 * account, an enquiry and a backend — and this spec is about DOM contract, not about the flow.
 */

const STORY_URL =
	'/iframe.html?id=components-chat-erstantwort--save-credentials&viewMode=story';

test.describe('credential saving — cross-browser DOM contract', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto(STORY_URL);
		await page.waitForSelector('input[name="username"]');
	});

	test('never uses the Chromium-only Credential Management API', async ({
		page,
		browserName
	}) => {
		const storeCalls: string[] = [];
		await page.exposeFunction('__recordCredentialStore', (name: string) =>
			storeCalls.push(name)
		);
		await page.evaluate(() => {
			const credentials = (navigator as never as { credentials?: object })
				.credentials;
			if (!credentials) return;
			for (const method of ['store', 'create', 'get']) {
				const target = credentials as Record<string, unknown>;
				if (typeof target[method] !== 'function') continue;
				target[method] = () => {
					(
						window as never as {
							__recordCredentialStore: (n: string) => void;
						}
					).__recordCredentialStore(method);
					return Promise.resolve(null);
				};
			}
		});

		await page.getByRole('button', { name: /kopieren/i }).click();

		expect(
			storeCalls,
			`navigator.credentials was called in ${browserName}; it is Chromium-only and must not be the mechanism`
		).toEqual([]);
	});

	test('exposes the username contract a password manager keys off', async ({
		page
	}) => {
		const field = page.locator('input[name="username"]');

		await expect(field).toHaveAttribute('autocomplete', 'username');
		await expect(field).toHaveAttribute('readonly', '');
		await expect(field).toHaveValue('katze_mika_1234');
		// Visible and non-empty: a hidden field is ignored by every manager.
		await expect(field).toBeVisible();
	});

	test('offers no download of the credentials', async ({ page }) => {
		await expect(page.locator('a[download]')).toHaveCount(0);
		await expect(page.locator('a[href^="blob:"]')).toHaveCount(0);
		await expect(page.locator('a[href^="data:"]')).toHaveCount(0);
	});

	test('never renders a password field, because the app cannot know it', async ({
		page
	}) => {
		await expect(page.locator('input[type="password"]')).toHaveCount(0);
	});

	test('shows the shared-device warning', async ({ page }) => {
		await expect(
			page.getByText(/andere dieses Gerät mitbenutzen/i)
		).toBeVisible();
	});

	test('routes the password fallback rather than dead-ending', async ({
		page
	}) => {
		// The browser-independent fallback: the person sets a password they know,
		// and *that* form submission is what Safari and Firefox prompt off.
		await expect(
			page.getByRole('button', { name: /Passwort jetzt setzen/i })
		).toBeVisible();
	});
});
