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
		// Complete the external secret lookup before editing the live form.
		// An initial form remount must not erase an earlier username entry.
		let password: string | undefined = secret('get', record);
		await page
			.locator(admin ? '#basic_password' : '#passwordInput')
			.fill(password);
		password = undefined;
		const usernameInput = page.locator(
			admin ? '#basic_username' : '#username'
		);
		await usernameInput.fill(username);
		await expect(usernameInput).toHaveValue(username);
		await expect(
			page.getByRole('button', { name: /^(Anmelden|Sign in)$/ })
		).toBeEnabled();
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

export async function readHistoryGeometry(page: Page, messages: string[]) {
	return page.evaluate((expected) => {
		const container = document.querySelector('#session-scroll-container');
		if (!container) return null;
		const box = (element: Element) => {
			const r = element.getBoundingClientRect();
			return {
				top: r.top,
				bottom: r.bottom,
				left: r.left,
				right: r.right,
				width: r.width,
				height: r.height
			};
		};
		return {
			windowScroll: { x: scrollX, y: scrollY },
			viewport: { width: innerWidth, height: innerHeight },
			container: {
				...box(container),
				scrollTop: container.scrollTop,
				clientHeight: container.clientHeight,
				scrollHeight: container.scrollHeight
			},
			paragraphs: expected.map((text) => {
				const element = [...container.querySelectorAll('p')].find(
					(item) => item.textContent?.trim() === text
				);
				if (!element) return null;
				const r = element.getBoundingClientRect();
				const hit = document.elementFromPoint(
					(r.left + r.right) / 2,
					(r.top + r.bottom) / 2
				);
				return {
					...box(element),
					opacity: getComputedStyle(element).opacity,
					centerHit: hit?.tagName || null,
					centerUnobscured:
						!!hit && (element === hit || element.contains(hit))
				};
			})
		};
	}, messages);
}

export async function positionHistoryForScreenshot(
	page: Page,
	messages: string[]
) {
	if (!messages.length) return;
	const last = conversationMessage(page, messages[messages.length - 1]);
	await last.evaluate((element) =>
		element.scrollIntoView({
			block: 'center',
			inline: 'nearest',
			behavior: 'instant'
		})
	);
	await page
		.locator('#session-scroll-container')
		.evaluate((container, expected) => {
			const bounds = container.getBoundingClientRect();
			const paragraphs = expected.map((text) =>
				[...container.querySelectorAll('p')].find(
					(item) => item.textContent?.trim() === text
				)
			);
			if (paragraphs.some((item) => !item)) return;
			const rects = paragraphs.map((item) =>
				item.getBoundingClientRect()
			);
			const contentCenter =
				(Math.min(...rects.map((rect) => rect.top)) +
					Math.max(...rects.map((rect) => rect.bottom))) /
				2;
			const visibleCenter =
				(Math.max(0, bounds.top) +
					Math.min(innerHeight, bounds.bottom)) /
				2;
			container.scrollTop += contentCenter - visibleCenter;
		}, messages);
	await expect
		.poll(
			async () =>
				page
					.locator('#session-scroll-container')
					.evaluate((container, expected) => {
						const bounds = container.getBoundingClientRect();
						const top = Math.max(0, bounds.top);
						const bottom = Math.min(innerHeight, bounds.bottom);
						const left = Math.max(0, bounds.left);
						const right = Math.min(innerWidth, bounds.right);
						return expected.every((text) => {
							const element = [
								...container.querySelectorAll('p')
							].find((item) => item.textContent?.trim() === text);
							if (!element) return false;
							const rect = element.getBoundingClientRect();
							const center = document.elementFromPoint(
								(rect.left + rect.right) / 2,
								(rect.top + rect.bottom) / 2
							);
							return (
								rect.width > 0 &&
								rect.height > 0 &&
								rect.top >= top &&
								rect.bottom <= bottom &&
								rect.left >= left &&
								rect.right <= right &&
								!!center &&
								(element === center || element.contains(center))
							);
						});
					}, messages),
			{
				message:
					'Every captured history paragraph must fit inside the visible conversation viewport without an overlay'
			}
		)
		.toBe(true);
}

async function captureReadableHistory(
	page: Page,
	testInfo: TestInfo,
	label: string,
	messages: string[]
) {
	if (!messages.length) {
		await maskedScreenshot(page, testInfo, label);
		return;
	}
	const geometry = await page
		.locator('#session-scroll-container')
		.evaluate((container, expected) => {
			const bounds = container.getBoundingClientRect();
			const rects = expected.map((text) =>
				[...container.querySelectorAll('p')]
					.find((item) => item.textContent?.trim() === text)
					?.getBoundingClientRect()
			);
			if (rects.some((rect) => !rect)) return null;
			return {
				visibleHeight:
					Math.min(innerHeight, bounds.bottom) -
					Math.max(0, bounds.top),
				combinedHeight:
					Math.max(...rects.map((rect) => rect.bottom)) -
					Math.min(...rects.map((rect) => rect.top))
			};
		}, messages);
	expect(geometry).not.toBeNull();
	if (geometry.combinedHeight <= geometry.visibleHeight) {
		await positionHistoryForScreenshot(page, messages);
		await maskedScreenshot(page, testInfo, label);
	} else {
		phase(
			`History paragraphs need separate captures: ${JSON.stringify(geometry)}`
		);
		for (const [index, message] of messages.entries()) {
			await positionHistoryForScreenshot(page, [message]);
			await maskedScreenshot(
				page,
				testInfo,
				`${label}-message-${index + 1}-${index === 0 ? 'asker' : 'consultant'}`
			);
		}
		await testInfo.attach(`${label}-separate-capture-geometry`, {
			body: JSON.stringify(geometry),
			contentType: 'application/json'
		});
	}
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
			await page.emulateMedia({ reducedMotion: 'reduce' });
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
			await captureReadableHistory(
				page,
				testInfo,
				`${label}-${name}`,
				messages
			);
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
					historyGeometry: await readHistoryGeometry(page, messages),
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

export async function assertLoginRejected(
	page: Page,
	testInfo: TestInfo,
	account: Pick<RecoveryActor, 'record' | 'username'>,
	mode: 'wrong-password' | 'missing-and-wrong-otp'
) {
	page.setDefaultTimeout(30_000);
	page.setDefaultNavigationTimeout(30_000);
	let matrixStartupRequests = 0;
	page.on('request', (request) => {
		const path = new URL(request.url()).pathname;
		if (
			path.includes('/_matrix/client/') &&
			/\/(sync|room_keys|account_data)(?:\/|$)/.test(path)
		)
			matrixStartupRequests++;
	});
	await page.goto(required('PLAYWRIGHT_BASE_URL'));
	const tokenResponse = () =>
		page.waitForResponse(
			(response) =>
				response.request().method() === 'POST' &&
				new URL(response.url()).pathname.endsWith(
					'/protocol/openid-connect/token'
				),
			{ timeout: 30_000 }
		);
	try {
		let password: string | undefined = secret('get', account.record);
		if (mode === 'wrong-password') password += '-deliberately-incorrect';
		await page.locator('#passwordInput').fill(password);
		password = undefined;
		await page.locator('#username').fill(account.username);
		await expect(page.locator('#username')).toHaveValue(account.username);
		const submit = page.getByRole('button', {
			name: /^(Anmelden|Sign in)$/
		});
		const [firstResponse] = await Promise.all([
			tokenResponse(),
			submit.click()
		]);
		phase(
			`Negative gate first auth response status: ${firstResponse.status()}`
		);
		if (mode === 'wrong-password') {
			expect([400, 401]).toContain(firstResponse.status());
		} else {
			expect(firstResponse.status()).toBe(400);
			await expect(page.locator('#otp')).toBeVisible();
			await expect(submit).toBeDisabled();
			await expect(
				page.getByRole('tab', { name: 'Mein Profil', exact: true })
			).toHaveCount(0);
			await maskedScreenshot(page, testInfo, 'missing-otp-blocked');
			let currentCode: string | undefined = secret('otp', account.record);
			// A single invalid submission, never a guessing/retry loop.
			if (!/^\d{6}$/.test(currentCode))
				throw new Error('OTP format unavailable');
			let incorrectCode: string | undefined = String(
				(Number(currentCode) + 1) % 1_000_000
			).padStart(6, '0');
			currentCode = undefined;
			await page.locator('#otp').fill(incorrectCode);
			incorrectCode = undefined;
			const [rejection] = await Promise.all([
				tokenResponse(),
				submit.click()
			]);
			phase(
				`Negative gate incorrect OTP response status: ${rejection.status()}`
			);
			expect([400, 401]).toContain(rejection.status());
		}
		await expect(submit).toBeEnabled();
		expect(matrixStartupRequests).toBe(0);
		await expect(page.locator('#username')).toBeVisible();
		await expect(
			page.getByRole('tab', { name: 'Mein Profil', exact: true })
		).toHaveCount(0);
		await expect(page.locator('#session-scroll-container')).toHaveCount(0);
		await maskedScreenshot(page, testInfo, `${mode}-rejected`);
		phase(
			`${mode}: server rejected; authenticated navigation and conversation absent`
		);
	} catch {
		throw new Error(
			`Negative login gate failed (${mode}); credential diagnostics suppressed`
		);
	}
}
