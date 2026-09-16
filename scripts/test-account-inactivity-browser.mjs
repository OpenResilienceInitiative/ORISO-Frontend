import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const endpoint = '**/service/users/account-inactivity/activity';
const server = await createServer({
	configFile: false,
	envDir: false,
	define: {
		'process.env': JSON.stringify({
			NODE_ENV: 'test',
			REACT_APP_KEYCLOAK_REALM: 'browser-contract'
		})
	},
	plugins: [react()],
	server: { host: '127.0.0.1', port: 0 }
});
await server.listen();
// Use native headed tab focus; disable Playwright's default focus emulation below.
const browser = await chromium.launch({ headless: false });
const useNativeFocus = async (context, page) => {
	const session = await context.newCDPSession(page);
	await session.send('Emulation.setFocusEmulationEnabled', {
		enabled: false
	});
	await session.detach();
};
const scenario = async (name, check) => {
	const context = await browser.newContext();
	const requests = [];
	let status = 204;
	try {
		await context.route(endpoint, async (route) => {
			requests.push({
				method: route.request().method(),
				body: route.request().postData(),
				headers: route.request().headers()
			});
			await route.fulfill({ status });
		});
		const page = await context.newPage();
		page.on('pageerror', (error) => console.error(error));
		await page.goto(
			`${server.resolvedUrls.local[0]}src/test/account-inactivity.html`
		);
		await useNativeFocus(context, page);
		await page.bringToFront();
		await page
			.getByRole('button', { name: 'Use account A' })
			.click({ timeout: 10000 });
		assert.equal(
			requests.length,
			0,
			'Signing in alone must not report client activity'
		);
		await check({
			page,
			context,
			requests,
			setStatus: (next) => {
				status = next;
			}
		});
		console.log(`PASS: ${name}`);
	} finally {
		await context.close();
	}
};
const expectReport = (page, gesture) =>
	Promise.all([page.waitForResponse(endpoint, { timeout: 3000 }), gesture()]);
try {
	await scenario(
		'real pointer gesture reports authenticated self with no body',
		async ({ page, requests }) => {
			await expectReport(page, () =>
				page.getByRole('textbox', { name: 'Write a message' }).click()
			);
			assert.equal(requests.length, 1);
			assert.equal(requests[0].method, 'POST');
			assert.equal(
				requests[0].body,
				null,
				'The server supplies its own timestamp'
			);
			assert.match(requests[0].headers.authorization, /^Bearer header\./);
			assert.ok(requests[0].headers['x-csrf-token']);
		}
	);
	await scenario(
		'synthetic DOM input does not count as personal activity',
		async ({ page, requests }) => {
			await page.evaluate(() => {
				document.dispatchEvent(
					new PointerEvent('pointerdown', { bubbles: true })
				);
				document.dispatchEvent(
					new KeyboardEvent('keydown', { key: 'a', bubbles: true })
				);
			});
			await page.waitForTimeout(100);
			assert.equal(requests.length, 0);
		}
	);
	await scenario(
		'real foreground keyboard input reports activity',
		async ({ page, requests }) => {
			await page
				.getByRole('textbox', { name: 'Write a message' })
				.focus();
			await expectReport(page, () => page.keyboard.press('a'));
			assert.equal(requests.length, 1);
		}
	);
	await scenario(
		'genuine interaction in another tab does not count for the background app',
		async ({ page, context, requests }) => {
			const foreground = await context.newPage();
			await foreground.goto('about:blank');
			await useNativeFocus(context, foreground);
			await foreground.bringToFront();
			await foreground.setContent(
				'<input aria-label="Other application" />'
			);
			await foreground
				.getByRole('textbox', { name: 'Other application' })
				.click();
			assert.equal(await page.evaluate(() => document.hasFocus()), false);
			await foreground.evaluate(() => {
				document.addEventListener(
					'keydown',
					(event) => {
						document.body.dataset.gesture = JSON.stringify({
							trusted: event.isTrusted,
							focused: document.hasFocus(),
							visibility: document.visibilityState
						});
					},
					{ once: true }
				);
			});
			await foreground.keyboard.press('a');
			const state = JSON.parse(
				await foreground.locator('body').getAttribute('data-gesture')
			);
			assert.equal(
				state.trusted,
				true,
				'The test must use a real browser event'
			);
			assert.equal(
				state.focused,
				true,
				'The genuine key event belongs to the other tab'
			);
			assert.equal(await page.evaluate(() => document.hasFocus()), false);
			await page.waitForTimeout(100);
			assert.equal(requests.length, 0);
			console.log(`Background evidence: ${JSON.stringify(state)}`);
		}
	);

	await scenario(
		'successful reports throttle typing and survive token refresh for the same account',
		async ({ page, requests }) => {
			await expectReport(page, () =>
				page.getByRole('textbox', { name: 'Write a message' }).click()
			);
			await page.keyboard.type('abcd');
			await page
				.getByRole('button', { name: 'Refresh account A token' })
				.click();
			await page
				.getByRole('textbox', { name: 'Write a message' })
				.click();
			await page.waitForTimeout(100);
			assert.equal(requests.length, 1);
		}
	);

	await scenario(
		'account switches reset the successful-report throttle',
		async ({ page, requests }) => {
			await expectReport(page, () => page.getByRole('textbox').click());
			await page.getByRole('button', { name: 'Use account B' }).click();
			await expectReport(page, () => page.getByRole('textbox').click());
			assert.equal(requests.length, 2);
			const payload = JSON.parse(
				Buffer.from(
					requests[1].headers.authorization.split('.')[1],
					'base64'
				).toString()
			);
			assert.equal(payload.sub, 'person-b');
		}
	);
	for (const failureStatus of [401, 500, 200]) {
		await scenario(
			`HTTP ${failureStatus} does not throttle the next gesture or navigate`,
			async ({ page, requests, setStatus }) => {
				const originalUrl = page.url();
				setStatus(failureStatus);
				await expectReport(page, () =>
					page.getByRole('textbox').click()
				);
				setStatus(204);
				await expectReport(page, () => page.keyboard.press('a'));
				assert.equal(requests.length, 2);
				assert.equal(page.url(), originalUrl);
				assert.equal(await page.getByRole('alert').count(), 0);
			}
		);
	}
	await scenario(
		'logout stops reporting and unmount removes listeners',
		async ({ page, requests }) => {
			await expectReport(page, () => page.getByRole('textbox').click());
			await page.getByRole('button', { name: 'Log out' }).click();
			await page.getByRole('textbox').click();
			await page.keyboard.press('a');
			assert.equal(requests.length, 1);
			await page
				.getByRole('button', { name: 'Unmount tracking' })
				.click();
			await page.getByRole('button', { name: 'Use account B' }).click();
			await page
				.getByRole('textbox', { name: 'Tracking removed' })
				.click();
			await page.keyboard.press('a');
			await page.waitForTimeout(100);
			assert.equal(requests.length, 1);
		}
	);

	if (process.env.VERIFY_REAL_INTERVAL === '1') {
		await scenario(
			'60 seconds alone never reports; the next genuine gesture does',
			async ({ page, requests }) => {
				await expectReport(page, () =>
					page.getByRole('textbox').click()
				);
				await page.waitForTimeout(60_100);
				assert.equal(
					requests.length,
					1,
					'Elapsed time cannot extend personal activity'
				);
				await expectReport(page, () => page.keyboard.press('a'));
				assert.equal(requests.length, 2);
			}
		);
	}
} finally {
	await browser.close();
	await server.close();
}
