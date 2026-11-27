import { expect, test, type Page } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { writeFile } from 'node:fs/promises';
import settings from '../cypress/fixtures/service.settings.json';
import topics from '../cypress/fixtures/service.topics.json';
import users from '../cypress/fixtures/service.users.data.json';

test.skip(
	({ browserName }) => browserName !== 'chromium',
	'Capturing the pre-bundle first paint uses the Chromium compositor.'
);

const profile = users.find((user) => user.userId === 'asker')!;
const password = 'local-fixture-password';
const code = '729854';
const mark = 'oriso.loginHandover';

function latch() {
	let open!: () => void;
	const promise = new Promise<void>((resolve) => {
		open = resolve;
	});
	return { promise, open };
}

async function localLogin(page: Page, origin: string, rejectCode = false) {
	const tokenResponse = latch();
	const destinationScripts = latch();
	const listResponse = latch();
	const requestedList = latch();
	let isDestination = false;
	let grants = 0;
	const userData = { ...profile, preferredLanguage: 'de' };
	const encode = (part: object) =>
		Buffer.from(JSON.stringify(part)).toString('base64url');
	const token = [
		encode({ alg: 'none', typ: 'JWT' }),
		encode({
			sub: profile.userId,
			preferred_username: profile.userName,
			realm_access: { roles: ['user'] },
			exp: Math.floor(Date.now() / 1000) + 1800
		}),
		'local-fixture'
	].join('.');

	await page.addInitScript((base) => {
		localStorage.setItem('locale', 'de');
		localStorage.setItem('showDevTools', '0');
		Object.assign(window, {
			__ORISO_RUNTIME_CONFIG__: {
				REACT_APP_API_URL: base,
				REACT_APP_KEYCLOAK_ORIGIN: base,
				REACT_APP_KEYCLOAK_REALM: 'local',
				REACT_APP_MATRIX_HOMESERVER_URL: base,
				REACT_APP_ELEMENT_CALL_BASE_URL: base,
				REACT_APP_LIVEKIT_WS_URL: base.replace('http', 'ws')
			}
		});
	}, origin);
	await page.route('**/*', async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		const path = url.pathname;
		if (url.origin !== origin) return route.abort();
		if (request.isNavigationRequest() && path === '/app')
			isDestination = true;
		if (
			isDestination &&
			request.resourceType() === 'script' &&
			path !== '/config.js'
		) {
			await destinationScripts.promise;
		}
		if (path.endsWith('/protocol/openid-connect/token')) {
			grants++;
			if (grants === 1)
				return route.fulfill({
					status: 400,
					json: {
						error: 'invalid_grant',
						error_description: 'Missing totp',
						otpType: 'EMAIL'
					}
				});
			await tokenResponse.promise;
			if (rejectCode)
				return route.fulfill({
					status: 400,
					json: {
						error: 'invalid_grant',
						error_description: 'Invalid user credentials'
					}
				});
			return route.fulfill({
				json: {
					access_token: token,
					expires_in: 1800,
					refresh_token: token,
					refresh_expires_in: 1800
				}
			});
		}
		if (path === '/service/users/data') {
			if (request.method() === 'PATCH')
				Object.assign(userData, request.postDataJSON());
			return route.fulfill({ json: userData });
		}
		if (path === '/service/users/sessions/askers') {
			if (isDestination) {
				requestedList.open();
				await listResponse.promise;
			}
			return route.fulfill({ json: { sessions: [] } });
		}
		if (path === '/service/topic/public')
			return route.fulfill({ json: topics });
		if (path === '/service/settings')
			return route.fulfill({ json: settings });
		if (path === '/service/consultingtypes/basic')
			return route.fulfill({ json: [] });
		if (path === '/service/users/event-notifications')
			return route.fulfill({ json: { items: [], unreadCount: 0 } });
		// This journey ends at the inbox. The app supports booting that view
		// while its separate Matrix conversation service is unavailable.
		if (path === '/service/matrix/me/token')
			return route.fulfill({ status: 503, json: {} });
		if (path === '/p/api/settings' || path.startsWith('/service/'))
			return route.fulfill({ json: {} });
		return route.continue();
	});
	const submit = page.locator('.loginForm__actions button');
	await page.goto('/login');
	await page.locator('#username').fill(profile.userName);
	await page.locator('#passwordInput').fill(password);
	await submit.click();
	const otp = page.locator('.loginForm__otp--active #otp');
	await expect(otp).toBeFocused();
	await otp.fill(code);
	return {
		tokenResponse,
		destinationScripts,
		requestedList,
		listResponse,
		submit,
		otp
	};
}

for (const scenario of [
	'slow phone',
	'wrapped claim on phone',
	'tablet',
	'fast desktop',
	'reduced motion'
] as const) {
	test(`real login and document handover — ${scenario}`, async ({
		page,
		baseURL
	}, testInfo) => {
		const wrappedClaim = scenario === 'wrapped claim on phone';
		const phone = scenario === 'slow phone' || wrappedClaim;
		const tablet = scenario === 'tablet';
		const vertical = phone || tablet;
		await page.setViewportSize(
			phone
				? { width: 390, height: 844 }
				: tablet
					? { width: 820, height: 1180 }
					: { width: 1440, height: 900 }
		);
		await page.emulateMedia({
			reducedMotion:
				scenario === 'reduced motion' ? 'reduce' : 'no-preference'
		});
		const {
			submit,
			tokenResponse,
			destinationScripts,
			requestedList,
			listResponse
		} = await localLogin(page, new URL(baseURL!).origin);
		try {
			if (wrappedClaim) {
				await page
					.locator('.stageMobileHero__claim')
					.evaluate((claim) => {
						claim.textContent =
							'Wir beraten Sie online und vertraulich, auch wenn persönliche Fragen mehr Platz brauchen.';
						claim.style.maxWidth = '204px';
					});
			}
			await page.screenshot({ path: testInfo.outputPath('source.png') });
			const sourceTime = await page.evaluate(
				() => performance.timeOrigin
			);
			await submit.click();
			if (phone) {
				await expect(
					submit.locator('.loginMatrixGlyph[data-digit]').first()
				).toBeVisible();
				// Digits are decoration: the label stays readable to assistive tech.
				await expect(submit).toHaveAccessibleName(
					/anmelden|log ?in|sign in/i
				);
			}
			if (scenario === 'reduced motion')
				await expect(page.locator('.loginMatrixGlyph')).toHaveCount(0);
			tokenResponse.open();
			await page.waitForURL('**/app', { waitUntil: 'commit' });
			expect(await page.evaluate(() => performance.timeOrigin)).not.toBe(
				sourceTime
			);
			const bridge = page.locator(
				'#loginHandoverSplash[data-login-curtain]'
			);
			await expect(bridge).toBeVisible();
			await expect(page.locator('#appRoot')).toBeEmpty();
			const stored = await page.evaluate(
				(key) => sessionStorage.getItem(key),
				mark
			);
			expect(JSON.parse(stored!).curtain.axis).toBe(
				vertical ? 'vertical' : 'horizontal'
			);
			for (const value of [profile.userName, password, code])
				expect(stored).not.toContain(value);
			// page.screenshot waits for document.fonts.ready, which itself waits
			// for the deferred app bundle intentionally held by this test.
			const capture = await page.context().newCDPSession(page);
			const frame = await capture.send('Page.captureScreenshot');
			const copyLayout = await bridge
				.locator('[data-login-curtain-copy]')
				.evaluateAll((nodes) =>
					nodes.map((n) => {
						const range = document.createRange();
						range.selectNodeContents(n);
						return {
							text: n.textContent,
							lines: [...range.getClientRects()].filter(
								(rect) => rect.width > 0
							).length,
							rect: range.getBoundingClientRect().toJSON()
						};
					})
				);
			const stage = bridge.locator('[data-login-curtain-panel="stage"]');
			const bounds = (await stage.boundingBox())!;
			expect(copyLayout).toHaveLength(2);
			const [title, claim] = copyLayout;
			if (phone) expect(title.lines).toBe(1);
			if (wrappedClaim) {
				expect(claim.text).toContain('mehr Platz brauchen');
				expect(claim.lines).toBeGreaterThan(1);
				expect(claim.rect.bottom).toBeLessThanOrEqual(
					bounds.y + bounds.height + 1
				);
			}
			for (const copy of copyLayout) {
				expect(copy.rect.left).toBeGreaterThanOrEqual(bounds.x - 1);
				expect(copy.rect.right).toBeLessThanOrEqual(
					bounds.x + bounds.width + 1
				);
			}
			expect(title.rect.bottom).toBeLessThanOrEqual(claim.rect.top + 1);
			await capture.detach();
			await writeFile(
				testInfo.outputPath('before-app-scripts.png'),
				Buffer.from(frame.data, 'base64')
			);
			destinationScripts.open();
			await requestedList.promise;
			await expect(bridge).toBeVisible();
			await expect(bridge).not.toHaveAttribute('data-phase', 'revealing');
			const parts = bridge.locator('[data-login-curtain-panel]');
			const movement = parts.evaluateAll((panels) => {
				const root = panels[0].parentElement!;
				const starts = panels.map((el) => el.getBoundingClientRect());
				return new Promise<number[][]>((resolve) => {
					const watcher = new MutationObserver(() => {
						if (root.dataset.phase !== 'revealing') return;
						watcher.disconnect();
						window.setTimeout(
							() =>
								resolve(
									panels.map((el, i) => {
										const next = el.getBoundingClientRect();
										return [
											next.x - starts[i].x,
											next.y - starts[i].y
										];
									})
								),
							160
						);
					});
					watcher.observe(root, {
						attributes: true,
						attributeFilter: ['data-phase']
					});
					if (
						matchMedia('(prefers-reduced-motion: reduce)').matches
					) {
						watcher.disconnect();
						resolve([]);
					}
				});
			});
			// The matrix shell has mounted and the actual first session request is held.
			await page.screenshot({
				path: testInfo.outputPath('inbox-loading.png')
			});
			listResponse.open();
			const deltas = await movement;
			if (scenario !== 'reduced motion') {
				const axis = vertical ? 1 : 0;
				expect(deltas.some((delta) => delta[axis] > 5)).toBe(true);
				expect(deltas.some((delta) => delta[axis] < -5)).toBe(true);
				expect(
					deltas.every((delta) => Math.abs(delta[1 - axis]) < 1)
				).toBe(true);
			}
			await expect(page).toHaveURL(/\/sessions\/user\/view/);
			await expect(bridge).toHaveCount(0);
			await expect(
				page.getByText('Anfragen', { exact: true }).first()
			).toBeVisible();
			expect(
				await page.evaluate((key) => sessionStorage.getItem(key), mark)
			).toBeNull();
		} finally {
			tokenResponse.open();
			destinationScripts.open();
			listResponse.open();
		}
	});
}

test('rejected code restores the real OTP control and focus for retry', async ({
	page,
	baseURL
}) => {
	const { submit, tokenResponse, destinationScripts, otp } = await localLogin(
		page,
		new URL(baseURL!).origin,
		true
	);
	try {
		await submit.click();
		await expect(
			submit.locator('.loginMatrixGlyph[data-digit]').first()
		).toBeVisible();
		tokenResponse.open();
		await expect(page.locator('.loginForm__error')).toBeVisible();
		await expect(otp).toBeFocused();
		await expect(otp).toHaveValue(code);
		await expect(submit).toHaveText('Anmelden');
		await expect(submit).toBeEnabled();
		expect(
			await page.evaluate((key) => sessionStorage.getItem(key), mark)
		).toBeNull();
	} finally {
		tokenResponse.open();
		destinationScripts.open();
	}
});
