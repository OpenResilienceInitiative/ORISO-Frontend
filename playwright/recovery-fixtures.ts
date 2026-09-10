import { execFileSync } from 'node:child_process';
import { expect, Page, TestInfo } from '@playwright/test';

export function phase(message: string) {
	console.log(`[recovery] ${message}`);
}

export type RecoveryActor = {
	record: string;
	username: string;
	conversationURL: string;
	securityURL: string;
};

export function required(name: string): string {
	const value = process.env[name];
	if (!value)
		throw new Error(`NOT_RUN: required fixture input ${name} is missing`);
	return value;
}

export function actor(
	engine: string,
	role: 'ASKER' | 'CONSULTANT'
): RecoveryActor {
	const prefix = `ORISO_RECOVERY_${engine.toUpperCase()}_${role}`;
	return {
		record: required(`${prefix}_RECORD`),
		username: required(`${prefix}_USERNAME`),
		conversationURL: required(`${prefix}_CONVERSATION_URL`),
		securityURL: required(`${prefix}_SECURITY_URL`)
	};
}

// Test Access get/otp return raw strings, not JSON. Never include their output
// or an exec/Playwright exception (which may contain a fill value) in evidence.
function secret(command: 'get' | 'otp', record: string): string {
	try {
		const value = execFileSync(
			process.env.ORISO_TEST_ACCESS_BIN || 'test-access',
			[
				'--identity',
				process.env.ORISO_TEST_ACCESS_IDENTITY || 'codex-m4-oriso',
				command,
				record
			],
			{
				encoding: 'utf8',
				stdio: ['ignore', 'pipe', 'pipe'],
				timeout: 30_000
			}
		).trim();
		if (!value) throw new Error();
		return value;
	} catch {
		throw new Error(
			'Test Access lookup failed; secret-bearing diagnostics suppressed'
		);
	}
}

export async function login(
	page: Page,
	record: string,
	username: string,
	admin = false
) {
	page.setDefaultTimeout(30_000);
	page.setDefaultNavigationTimeout(30_000);
	phase(admin ? 'Admin login started' : 'App login started');
	const base = required(
		admin ? 'ORISO_ADMIN_BASE_URL' : 'PLAYWRIGHT_BASE_URL'
	);
	await page.goto(base);
	try {
		await page
			.locator(admin ? '#basic_username' : '#username')
			.fill(username);
		let password: string | undefined = secret('get', record);
		await page
			.locator(admin ? '#basic_password' : '#passwordInput')
			.fill(password);
		password = undefined;
		phase('Login credentials entered');
		await page
			.getByRole('button', { name: /^(Anmelden|Sign in)$/ })
			.click();
		phase('Login credentials submitted');
		const otpInput = page.locator(admin ? '#basic_otp' : '#otp');
		await expect(otpInput).toBeVisible();
		phase('Login OTP form visible');
		let otp: string | undefined = secret('otp', record);
		await otpInput.fill(otp);
		otp = undefined;
		phase('Login OTP entered');
		await page
			.getByRole('button', { name: /^(Anmelden|Sign in)$/ })
			.click();
		await expect(otpInput).not.toBeVisible();
		// OTP unmounts before the authentication redirect finishes. Wait for the
		// real authenticated route and navigation before starting another goto.
		if (admin) {
			await page.waitForURL((url) =>
				/\/admin\/tenants\/?$/.test(url.pathname)
			);
			await expect(
				page.getByRole('link', { name: 'Einstellungen', exact: true })
			).toBeVisible();
		} else {
			await page.waitForURL((url) =>
				/^\/(sessions\/|profile(?:\/|$))/.test(url.pathname)
			);
			await expect(
				page.getByRole('tab', { name: 'Mein Profil', exact: true })
			).toBeVisible();
		}
		phase(admin ? 'Admin login completed' : 'App login completed');
	} catch {
		try {
			const buttons = await page
				.getByRole('button')
				.evaluateAll((elements) =>
					elements
						.filter(
							(element) => element.getClientRects().length > 0
						)
						.map((element) => {
							const label = (
								element.getAttribute('aria-label') ||
								element.textContent ||
								''
							).trim();
							// Only known UI labels leave the page; never arbitrary dynamic text.
							return /^(Anmelden|Sign in|Login|Log in|Einloggen|toggle password visibility|Passwort anzeigen|Passwort verbergen|Abbrechen|Cancel)$/.test(
								label
							)
								? label
								: '[other button]';
						})
				);
			phase(`Login failure visible buttons: ${buttons.join(', ')}`);
		} catch {
			phase('Login failure button diagnostics unavailable');
		}
		throw new Error(
			'Normal password plus OTP login failed; credential diagnostics suppressed'
		);
	}
}

async function maskedScreenshot(page: Page, testInfo: TestInfo, name: string) {
	const path = testInfo.outputPath(`${name}.png`);
	await page.screenshot({
		path,
		animations: 'disabled',
		fullPage: false,
		mask: [
			page.locator(
				'input:not([role="combobox"]), textarea, [contenteditable="true"], [data-cy="recovery-key-display"], [data-cy="optional-recovery-key"], .twoFactorSetupDialog__secret, .twoFactorSetupDialog__qr'
			)
		]
	});
	await testInfo.attach(name, { path, contentType: 'image/png' });
}

export async function screenshots(
	page: Page,
	testInfo: TestInfo,
	label: string,
	messages: string[] = []
) {
	if (label.startsWith('fresh-')) {
		// Preserve the already-proven original viewport before a responsive reload.
		await maskedScreenshot(
			page,
			testInfo,
			`${label}-desktop-before-resize`
		);
		await testInfo.attach(`${label}-desktop-before-resize-viewport`, {
			body: JSON.stringify({
				viewport: page.viewportSize(),
				reloaded: false
			}),
			contentType: 'application/json'
		});
	}
	for (const [name, width, height] of [
		['mobile', 390, 844],
		['tablet', 820, 1180],
		['desktop', 1440, 900]
	] as const) {
		const before = new URL(page.url());
		try {
			await page.setViewportSize({ width, height });
			// The app chooses parts of its responsive layout during initialization.
			await page.reload();
			for (const message of messages) {
				await expect(conversationMessage(page, message)).toBeVisible();
			}
			if (label.startsWith('admin-')) {
				await page
					.getByRole('heading', {
						name: 'Chat-Wiederherstellung für neue Konten',
						exact: true
					})
					.evaluate((heading) =>
						heading.scrollIntoView({ block: 'start' })
					);
			}
			await maskedScreenshot(page, testInfo, `${label}-${name}`);
		} catch (failure) {
			// Capture only known state and masked pixels; never a DOM snapshot or
			// arbitrary body text, inputs, response bodies, query strings or fragments.
			try {
				await maskedScreenshot(
					page,
					testInfo,
					`${label}-${name}-failed`
				);
				const after = new URL(page.url());
				const diagnostic = {
					viewport: page.viewportSize(),
					beforeURL: before.origin + before.pathname,
					afterURL: after.origin + after.pathname,
					conversationContainers: await page
						.locator('#session-scroll-container')
						.count(),
					loginForms: await page
						.locator('#username, #basic_username')
						.count(),
					encryptionStatusOK: await page
						.locator('[data-cy="encryption-status-ok"]')
						.count(),
					priorMessageCounts: await Promise.all(
						messages.map((message) =>
							conversationMessage(page, message).count()
						)
					)
				};
				await testInfo.attach(`${label}-${name}-failed-state`, {
					body: JSON.stringify(diagnostic),
					contentType: 'application/json'
				});
				phase(
					`Responsive screenshot check failed: ${JSON.stringify(diagnostic)}`
				);
			} catch {
				phase(
					'Responsive failure evidence unavailable; original assertion remains failed'
				);
			}
			throw failure;
		}
	}
}

export function conversationMessage(page: Page, message: string) {
	return page
		.locator('#session-scroll-container')
		.getByText(message, { exact: true });
}

export async function sendMessage(page: Page, message: string) {
	const editor = page.locator('.ProseMirror[contenteditable="true"]');
	await expect(editor).toBeVisible();
	await editor.fill(message);
	await page.locator('button.sendButton').click();
	await expect(editor).toBeEmpty();
	await expect(conversationMessage(page, message)).toBeVisible();
}

export async function waitForRecoveryStartup(
	page: Page,
	account: RecoveryActor,
	role: 'asker' | 'consultant'
) {
	phase(`Waiting for ${role} session startup`);
	if (role === 'asker') {
		// Dedicated asker fixture has one accepted conversation. SessionsList
		// auto-opens it after its asynchronous initial list request completes.
		const expected = new URL(account.conversationURL);
		await page.waitForURL(
			(url) =>
				url.origin === expected.origin &&
				url.pathname === expected.pathname
		);
		await expect(page.locator('#session-scroll-container')).toBeVisible();
	} else {
		// Consultants can start on an empty enquiry list. Its skeleton exists
		// exactly while SessionsList.isLoading; do not require an asker route.
		await expect(
			page.locator('.sessionsList__scrollContainer')
		).toBeVisible();
		await expect(page.locator('.sessionsListItem.skeleton')).toHaveCount(0);
		await expect(page.locator('.sessionsList__reloadWrapper')).toHaveCount(
			0
		);
	}
	phase(`${role} session startup completed`);
}

export async function passwordReady(page: Page) {
	phase('Password recovery ready assertion started via SPA settings');
	// Preserve the one-use password verification held by this authenticated SPA.
	await page.getByRole('tab', { name: 'Mein Profil', exact: true }).click();
	await page.getByRole('tab', { name: 'Einstellungen', exact: true }).click();
	await page.waitForURL((url) =>
		url.pathname.startsWith('/profile/einstellungen')
	);
	await expect(
		page.locator('[data-cy="password-recovery-status"]')
	).toContainText(
		'Wiederherstellung mit dem Login-Passwort ist eingerichtet.'
	);
	await expect(
		page.locator('[data-cy="encryption-status-ok"]')
	).toBeVisible();
	phase('Password recovery ready assertion completed');
}
