import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
const output = 'docs/agent-tasks/2026-10-07_notification-persistence-browser';
await mkdir(output, { recursive: true });
// Durable evidence must belong to a committed candidate, not a mutable
// provider/component/translation worktree. The parent freezes the revision.
const dirtyApplication = execFileSync(
	'git',
	['status', '--porcelain', '--', 'src'],
	{ encoding: 'utf8' }
).trim();
if (dirtyApplication)
	throw new Error('Commit/freeze application source before browser proof.');
const browser = await chromium.launch({ headless: true });
const results = [];
const fixtureLabel =
	'LOCAL SYNTHETIC API — actual provider and center; no Dev, accounts or received mail';
const row = (id) => ({
	id,
	eventType: id === 1 ? 'request.new' : 'conversation.finished',
	category: 'system',
	title: '',
	text: '',
	createdAt: new Date(Date.now() - id * 60000).toISOString(),
	readAt: null
});
const localeCatalogues = Object.fromEntries(
	['de', 'en'].map((locale) => [
		locale,
		JSON.parse(
			readFileSync(`src/resources/i18n/${locale}/common.json`, 'utf8')
		)
	])
);
const markAllLabel = (locale) =>
	localeCatalogues[locale].notifications.center.markAllRead;
const failureText = (locale, operation) =>
	localeCatalogues[locale].notifications.center[
		operation === 'read'
			? 'markReadFailed'
			: operation === 'read-all'
				? 'markAllReadFailed'
				: 'clearFailed'
	];
const assertions = [];
function check(name, actual, expected) {
	const pass = actual === expected;
	assertions.push({ name, pass, actual, expected });
	if (!pass)
		console.error('FAIL', name, JSON.stringify({ actual, expected }));
}
async function mount({
	version = 'after',
	locale = 'de',
	viewport = { width: 390, height: 844 },
	mode = 'reject',
	trace = false,
	feedRows = [row(1), row(2)],
	loadedIds = null,
	readyId = '2'
} = {}) {
	const context = await browser.newContext({
		viewport,
		locale: locale === 'de' ? 'de-DE' : 'en-US'
	});
	if (trace)
		await context.tracing.start({
			screenshots: true,
			snapshots: true,
			sources: true
		});
	const page = await context.newPage();
	const api = {
		mode,
		rows: feedRows,
		loadedIds,
		replacementRows: [row(9)],
		requests: [],
		pending: [],
		pendingGets: [],
		holdNextGet: false
	};
	const errors = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await page.route('**/service/**', async (route) => {
		const req = route.request(),
			url = new URL(req.url());
		if (!url.pathname.includes('/event-notifications'))
			return route.fulfill({ json: { items: [], unreadCount: 0 } });
		let principal = 'local-synthetic-1665';
		try {
			principal = JSON.parse(
				Buffer.from(
					(req.headers().authorization || '')
						.split(' ')[1]
						.split('.')[1],
					'base64url'
				).toString()
			).sub;
		} catch {}
		const actorRows = () =>
			principal === 'replacement-fixture'
				? api.replacementRows
				: api.rows;
		const saveRows = (value) => {
			if (principal === 'replacement-fixture')
				api.replacementRows = value;
			else api.rows = value;
		};
		api.requests.push({
			method: req.method(),
			path: url.pathname,
			query: url.search,
			principal
		});
		if (req.method() === 'GET') {
			const payload = JSON.stringify(
				url.pathname.endsWith('/unread-count')
					? {
							unreadCount: actorRows().filter((x) => !x.readAt)
								.length
						}
					: {
							items: api.loadedIds
								? actorRows().filter((x) =>
										api.loadedIds.includes(x.id)
									)
								: actorRows(),
							unreadCount: actorRows().filter((x) => !x.readAt)
								.length,
							page: 0,
							perPage: 50
						}
			);
			if (api.holdNextGet) {
				api.holdNextGet = false;
				await new Promise((resolve) => api.pendingGets.push(resolve));
			}
			return route.fulfill({
				contentType: 'application/json',
				body: payload
			});
		}
		let mode = api.mode;
		if (mode === 'pending')
			mode = await new Promise((resolve) => api.pending.push(resolve));
		if (mode === 'reject')
			return route.fulfill({
				status: 503,
				json: { message: 'Synthetic unavailable' }
			});
		if (
			url.pathname.endsWith('/read') &&
			url.searchParams.has('eventTypes')
		) {
			const types = new Set(
				url.searchParams.get('eventTypes').split(',')
			);
			const updated = actorRows().filter(
				(x) => !x.readAt && types.has(x.eventType)
			).length;
			saveRows(
				actorRows().map((x) =>
					types.has(x.eventType)
						? { ...x, readAt: new Date().toISOString() }
						: x
				)
			);
			return route.fulfill({ json: { updated, eventTypes: [...types] } });
		}
		if (req.method() === 'DELETE') saveRows([]);
		else if (url.pathname.endsWith('/read-all'))
			saveRows(
				actorRows().map((x) => ({
					...x,
					readAt: new Date().toISOString()
				}))
			);
		else {
			const id = Number(url.pathname.split('/').at(-2));
			saveRows(
				actorRows().map((x) =>
					x.id === id ? { ...x, readAt: new Date().toISOString() } : x
				)
			);
		}
		return route.fulfill({ status: 204, body: '' });
	});
	await page.goto(
		`http://127.0.0.1:${version === 'base' ? 9018 : 9017}/playwright/notification-persistence-1665/index.html?locale=${locale}`
	);
	await page
		.locator(`[data-notification-id="${readyId}"]`)
		.waitFor({ timeout: 45000 });
	return {
		context,
		page,
		api,
		errors,
		state: () => page.getByTestId('state').textContent()
	};
}
async function waitState(f, expected) {
	await f.page.waitForFunction(
		(value) =>
			document.querySelector('[data-testid="state"]')?.textContent ===
			value,
		expected,
		{ timeout: 5000 }
	);
}
async function settle(f, result) {
	await f.page.waitForFunction(() => true);
	for (const resolve of f.api.pending.splice(0)) resolve(result);
	await f.page.waitForTimeout(100);
}
try {
	for (const viewport of [
		{ name: 'desktop', width: 1440, height: 900 },
		{ name: 'tablet', width: 820, height: 1180 },
		{ name: 'mobile', width: 390, height: 844 }
	])
		for (const locale of ['de', 'en'])
			for (const version of process.argv.includes('--after-only')
				? ['after']
				: ['base', 'after']) {
				const f = await mount({ version, locale, viewport });
				try {
					await f.page.locator('[data-notification-id="2"]').click();
					await f.page.waitForTimeout(120);
					const state = await f.state();
					const shot = `${version}-${viewport.name}-${locale}-rejected-read.png`;
					await f.page.screenshot({
						path: output + '/' + shot,
						fullPage: false
					});
					results.push({
						scenario: 'real-card-click rejected503',
						version,
						locale,
						viewport: {
							width: viewport.width,
							height: viewport.height
						},
						state,
						errors: f.errors,
						screenshot: shot
					});
					check(
						`${version}/${viewport.name}/${locale} rejected read`,
						state.includes('2:unread'),
						version === 'after'
					);
				} finally {
					await f.context.close();
				}
			}
	for (const operation of ['read', 'read-all', 'clear']) {
		const f = await mount({ mode: 'pending', trace: true });
		try {
			const button =
				operation === 'read'
					? f.page.locator('[data-notification-id="2"]')
					: f.page.getByRole('button', {
							name:
								operation === 'read-all'
									? 'Alle als gelesen markieren'
									: 'Fixture clear',
							exact: true
						});
			await button.click();
			await f.page.waitForTimeout(70);
			check(
				operation + ' keeps pending unread',
				await f.state(),
				'Unread 2 · 1:unread,2:unread'
			);
			await settle(f, 'reject');
			check(
				operation + ' keeps503 unread',
				await f.state(),
				'Unread 2 · 1:unread,2:unread'
			);
			// Dismiss through the actual alert's close control before retrying.
			for (const alert of await f.page.getByRole('alert').all())
				await alert
					.getByRole('button', {
						name: localeCatalogues.de.app.close,
						exact: true
					})
					.click();
			f.api.mode = 'success';
			await button.click();
			await waitState(
				f,
				operation === 'clear'
					? 'Unread 0 · '
					: operation === 'read-all'
						? 'Unread 0 · 1:read,2:read'
						: 'Unread 1 · 1:unread,2:read'
			);
			const success = await f.state();
			await f.page.reload();
			await waitState(f, success);
			check(
				operation + ' survives actual reload',
				await f.state(),
				success
			);
			const shot = `after-${operation}-confirmed-reload.png`;
			await f.page.screenshot({
				path: output + '/' + shot,
				fullPage: false
			});
			results.push({
				scenario: operation + ' pending/reject/retry/success/reload',
				version: 'after',
				state: success,
				errors: f.errors,
				requests: f.api.requests,
				screenshot: shot
			});
		} finally {
			await f.context.tracing.stop({
				path: output + '/trace-' + operation + '.zip'
			});
			await f.context.close();
		}
	}
	for (const operation of ['read-all', 'clear']) {
		const f = await mount({ mode: 'pending' });
		try {
			await f.page
				.getByRole('button', {
					name:
						operation === 'read-all'
							? 'Alle als gelesen markieren'
							: 'Fixture clear',
					exact: true
				})
				.click();
			await f.page.locator('[data-notification-id="2"]').click();
			await f.page.waitForTimeout(100);
			check(
				'independent read submitted during ' + operation,
				f.api.requests.filter(
					(x) => x.method === 'PATCH' && x.path.endsWith('/2/read')
				).length,
				1
			);
			const [bulk, individual] = f.api.pending.splice(0);
			bulk('reject');
			individual('success');
			await waitState(f, 'Unread 1 · 1:unread,2:read');
			check(
				'individual read survives failed ' + operation,
				await f.state(),
				'Unread 1 · 1:unread,2:read'
			);
			results.push({
				scenario: 'individual intent during rejected ' + operation,
				state: await f.state(),
				errors: f.errors,
				requests: f.api.requests
			});
		} finally {
			await f.context.close();
		}
	}
	const stale = await mount({ mode: 'success' });
	try {
		stale.api.holdNextGet = true;
		await stale.page
			.getByRole('button', { name: 'Fixture refresh', exact: true })
			.click();
		for (let i = 0; i < 100 && !stale.api.pendingGets.length; i++)
			await stale.page.waitForTimeout(10);
		check(
			'controlled stale GET parked at HTTP boundary',
			stale.api.pendingGets.length,
			1
		);
		await stale.page
			.getByRole('button', { name: 'Fixture clear', exact: true })
			.click();
		await waitState(stale, 'Unread 0 · ');
		for (const release of stale.api.pendingGets.splice(0)) release();
		await stale.page.waitForTimeout(100);
		check(
			'late old GET cannot resurrect acknowledged clear',
			await stale.state(),
			'Unread 0 · '
		);
		results.push({
			scenario: 'stale in-flight poll after acknowledged clear',
			state: await stale.state(),
			errors: stale.errors,
			requests: stale.api.requests
		});
	} finally {
		await stale.context.close();
	}
	const auth = await mount({ mode: 'pending', trace: true });
	try {
		await auth.page
			.getByRole('button', { name: 'Fixture clear', exact: true })
			.click();
		await auth.page.waitForTimeout(50);
		await auth.page.evaluate(() => {
			const token =
				btoa(JSON.stringify({ alg: 'none' })) +
				'.' +
				btoa(
					JSON.stringify({
						sub: 'replacement-fixture',
						sid: 'fixture-session-B',
						tenantId: 77,
						exp: 4102444800
					})
				) +
				'.fixture';
			document.cookie = 'keycloak=' + token + ';path=/';
			window.dispatchEvent(new Event('oriso:auth-session-change'));
		});
		await waitState(auth, 'Unread 1 · 9:unread');
		await settle(auth, 'success');
		check(
			'direct principal replacement protects new feed from old clear',
			await auth.state(),
			'Unread 1 · 9:unread'
		);
		results.push({
			scenario: 'direct A→B without null then late old clear',
			state: await auth.state(),
			errors: auth.errors,
			requests: auth.api.requests
		});
	} finally {
		await auth.context.tracing.stop({
			path: output + '/trace-principal-replacement.zip'
		});
		await auth.context.close();
	}
	const refresh = await mount({ mode: 'pending' });
	try {
		await refresh.page.locator('[data-notification-id="2"]').click();
		await refresh.page.waitForTimeout(50);
		await refresh.page.evaluate(() => {
			const token =
				btoa(JSON.stringify({ alg: 'none' })) +
				'.' +
				btoa(
					JSON.stringify({
						sub: 'local-synthetic-1665',
						sid: 'fixture-session-A',
						tenantId: 77,
						exp: 4102445000
					})
				) +
				'.renewed-fixture';
			document.cookie = 'keycloak=' + token + ';path=/';
			window.dispatchEvent(new Event('oriso:auth-session-change'));
		});
		check(
			'same-user refresh retains pending unread',
			await refresh.state(),
			'Unread 2 · 1:unread,2:unread'
		);
		await settle(refresh, 'success');
		await waitState(refresh, 'Unread 1 · 1:unread,2:read');
		check(
			'same principal/session refreshed JWT preserves pending read',
			await refresh.state(),
			'Unread 1 · 1:unread,2:read'
		);
		results.push({
			scenario:
				'same-principal/session JWT refresh preserves pending read',
			state: await refresh.state(),
			errors: refresh.errors,
			requests: refresh.api.requests
		});
	} finally {
		await refresh.context.close();
	}
	// New review regressions supplement, rather than replace, the original
	// 30 assertions above. The toolbar and alerts are real app components.
	for (const locale of ['de', 'en']) {
		for (const operation of ['read', 'read-all', 'clear']) {
			const f = await mount({ locale, mode: 'pending' });
			try {
				const toolbar = f.page.getByRole('button', {
					name: markAllLabel(locale),
					exact: true
				});
				const trigger =
					operation === 'read'
						? f.page.locator('[data-notification-id="2"]')
						: operation === 'read-all'
							? toolbar
							: f.page.getByRole('button', {
									name: 'Fixture clear',
									exact: true
								});
				await trigger.click();
				for (let i = 0; i < 100 && !f.api.pending.length; i++)
					await f.page.waitForTimeout(10);
				check(
					`${locale}/${operation} submitted at HTTP boundary`,
					f.api.pending.length,
					1
				);
				if (operation !== 'read') {
					check(
						`${locale}/${operation} disables real mark-all toolbar while pending`,
						await toolbar.isDisabled(),
						true
					);
					check(
						`${locale}/${operation} exposes real mark-all toolbar aria-busy`,
						await toolbar.getAttribute('aria-busy'),
						'true'
					);
					const pendingShot = `after-${operation}-${locale}-pending-toolbar.png`;
					await f.page.screenshot({
						path: output + '/' + pendingShot,
						fullPage: false
					});
					results.push({
						scenario: `${operation} real pending toolbar`,
						version: 'after',
						locale,
						state: await f.state(),
						errors: f.errors,
						requests: [...f.api.requests],
						screenshot: pendingShot
					});
				}
				await settle(f, 'reject');
				const alert = f.page
					.getByRole('alert')
					.filter({ hasText: failureText(locale, operation) });
				await alert.waitFor();
				check(
					`${locale}/${operation} shows existing localized error alert`,
					await alert.isVisible(),
					true
				);
				check(
					`${locale}/${operation} preserves unread after error feedback`,
					await f.state(),
					'Unread 2 · 1:unread,2:unread'
				);
				if (operation !== 'read') {
					check(
						`${locale}/${operation} enables real mark-all toolbar after failure`,
						await toolbar.isEnabled(),
						true
					);
					check(
						`${locale}/${operation} clears real mark-all toolbar aria-busy`,
						await toolbar.getAttribute('aria-busy'),
						'false'
					);
				}
				const shot = `after-${operation}-${locale}-localized-failure.png`;
				await f.page.screenshot({
					path: output + '/' + shot,
					fullPage: false
				});
				results.push({
					scenario: `${operation} pending toolbar/localized existing alert`,
					version: 'after',
					locale,
					state: await f.state(),
					errors: f.errors,
					requests: f.api.requests,
					screenshot: shot
				});
			} finally {
				await f.context.close();
			}
		}
	}
	for (const [operation, outcome] of [
		['read-all', 'reject'],
		['clear', 'reject'],
		['clear', 'success']
	]) {
		const f = await mount({
			mode: 'pending',
			readyId: '1',
			loadedIds: [1],
			feedRows: [
				{ ...row(1), eventType: 'message.new', category: 'message' },
				{ ...row(2), eventType: 'supervisor.added' }
			]
		});
		try {
			await f.page
				.getByRole('button', {
					name:
						operation === 'read-all'
							? markAllLabel('de')
							: 'Fixture clear',
					exact: true
				})
				.click();
			for (let i = 0; i < 100 && !f.api.pending.length; i++)
				await f.page.waitForTimeout(10);
			await f.page.evaluate(() =>
				window.fixture.hideSystemWithAutoRead()
			);
			await f.page.waitForTimeout(450);
			const hiddenRequests = () =>
				f.api.requests.filter(
					(x) =>
						x.method === 'PATCH' &&
						x.path.endsWith('/read') &&
						x.query.includes('eventTypes=')
				);
			check(
				`hidden read is deferred during pending ${operation}/${outcome}`,
				hiddenRequests().length,
				0
			);
			f.api.mode = 'success';
			await settle(f, outcome);
			for (let i = 0; i < 100 && !hiddenRequests().length; i++)
				await f.page.waitForTimeout(20);
			check(
				`hidden read wakes after ${operation}/${outcome} settles`,
				hiddenRequests().length,
				1
			);
			check(
				`hidden read carries unloaded eligible system type after ${operation}/${outcome}`,
				new URLSearchParams(hiddenRequests()[0]?.query)
					.get('eventTypes')
					?.split(',')
					.includes('supervisor.added'),
				true
			);
			await waitState(
				f,
				outcome === 'success' ? 'Unread 0 · ' : 'Unread 1 · 1:unread'
			);
			check(
				`hidden read reconciles real provider count after ${operation}/${outcome}`,
				await f.state(),
				outcome === 'success' ? 'Unread 0 · ' : 'Unread 1 · 1:unread'
			);
			results.push({
				scenario: `deferred hidden read after ${operation}/${outcome}`,
				version: 'after',
				locale: 'de',
				state: await f.state(),
				errors: f.errors,
				requests: f.api.requests
			});
		} finally {
			await f.context.close();
		}
	}
	check(
		'all actual-component browser scenarios have zero page errors',
		results.flatMap((x) => x.errors).length,
		0
	);
	const source = readFileSync(
		'src/globalState/provider/NotificationsProvider.tsx'
	);
	await writeFile(
		output + '/RESULTS.json',
		JSON.stringify(
			{
				fixtureLabel,
				sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
					encoding: 'utf8'
				}).trim(),
				providerWorkingTreeSha256: crypto
					.createHash('sha256')
					.update(source)
					.digest('hex'),
				baseline: 'b527b8bc6fea723b2ca59ec73f57127debb022f9',
				assertions,
				results
			},
			null,
			2
		)
	);
	console.log(
		JSON.stringify({
			passed: assertions.filter((x) => x.pass).length,
			total: assertions.length,
			screenshots: results.filter((x) => x.screenshot).length,
			output
		})
	);
	if (assertions.some((x) => !x.pass)) process.exitCode = 1;
} finally {
	await browser.close();
}
