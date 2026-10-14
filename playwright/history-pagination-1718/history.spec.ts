import { expect, test, Page } from '@playwright/test';

const roomId = '!history:example.org';
const reader = '@history-reader:example.org';
const message = (number: number) => ({
	event_id: `$history-${number}`,
	room_id: roomId,
	sender: '@history-asker:example.org',
	type: 'm.room.message',
	origin_server_ts: Date.UTC(2026, 9, 14, 12, 0, number),
	content: {
		msgtype: 'm.text',
		body: `History message ${number}. ${'Synthetic counselling text. '.repeat(4)}`
	}
});
const state = [
	{
		type: 'm.room.member',
		state_key: reader,
		sender: reader,
		content: { membership: 'join', displayname: 'History reader' },
		event_id: '$member'
	},
	{
		type: 'm.room.name',
		state_key: '',
		sender: reader,
		content: { name: 'Synthetic counselling' },
		event_id: '$name'
	},
	{
		type: 'm.room.power_levels',
		state_key: '',
		sender: reader,
		content: {
			users: { [reader]: 100 },
			users_default: 0,
			events_default: 0
		},
		event_id: '$power'
	}
];

interface HistoryFixtureOptions {
	firstMessage?: number;
	historicalThread?: boolean;
	failFirstHistory?: boolean;
	coldStart?: boolean;
	firstHistoryGate?: Promise<void>;
}

const prepareHistory = async (
	page: Page,
	{
		firstMessage = 121,
		historicalThread = false,
		failFirstHistory = false,
		coldStart = false,
		firstHistoryGate
	}: HistoryFixtureOptions = {}
) => {
	let deliverLiveReply = false;
	let liveReplyDelivered = false;
	const unexpected: string[] = [];
	const historyPages: string[] = [];
	const errors: string[] = [];
	const consoleErrors: string[] = [];
	page.on('console', (message) => {
		if (message.type() === 'error')
			consoleErrors.push(message.text().slice(0, 300));
	});
	page.on('pageerror', (error) => errors.push(error.message));
	await page.route('**/_matrix/**', async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		const path = decodeURIComponent(url.pathname);
		if (path.endsWith('/versions'))
			return route.fulfill({
				json: { versions: ['v1.11'], unstable_features: {} }
			});
		if (path.endsWith('/capabilities'))
			return route.fulfill({ json: { capabilities: {} } });
		if (path.endsWith('/pushrules/'))
			return route.fulfill({
				json: {
					global: {
						override: [],
						content: [],
						room: [],
						sender: [],
						underride: []
					}
				}
			});
		if (path.includes('/filter'))
			return route.fulfill({
				json:
					request.method() === 'POST'
						? { filter_id: 'history-filter' }
						: { room: { timeline: { limit: 20 } } }
			});
		if (path.endsWith('/keys/upload'))
			return route.fulfill({
				json: { one_time_key_counts: { signed_curve25519: 50 } }
			});
		if (path.endsWith('/keys/query'))
			return route.fulfill({
				json: {
					device_keys: {},
					master_keys: {},
					self_signing_keys: {},
					user_signing_keys: {}
				}
			});
		if (path.endsWith('/room_keys/version'))
			return route.fulfill({
				status: 404,
				json: { errcode: 'M_NOT_FOUND', error: 'No fixture backup' }
			});
		if (path.endsWith('/voip/turnServer'))
			return route.fulfill({
				json: { uris: [], username: '', password: '', ttl: 3600 }
			});
		if (path.endsWith('/sync')) {
			if (url.searchParams.has('since')) {
				await new Promise((resolve) => setTimeout(resolve, 2000));
				const appendReply = deliverLiveReply && !liveReplyDelivered;
				liveReplyDelivered ||= appendReply;
				return route.fulfill({
					json: {
						next_batch: 'history-ready',
						rooms: appendReply
							? {
									join: {
										[roomId]: {
											timeline: {
												events: [
													{
														...message(141),
														content: {
															...message(141)
																.content,
															'm.relates_to': {
																rel_type:
																	'm.thread',
																event_id:
																	'$history-100',
																is_falling_back: true
															}
														}
													}
												],
												limited: false
											}
										}
									}
								}
							: {},
						to_device: { events: [] },
						device_lists: { changed: [], left: [] },
						device_one_time_keys_count: { signed_curve25519: 50 }
					}
				});
			}
			if (coldStart)
				await new Promise((resolve) => setTimeout(resolve, 1500));
			return route.fulfill({
				json: {
					next_batch: 'history-ready',
					account_data: { events: [] },
					to_device: { events: [] },
					device_lists: { changed: [], left: [] },
					device_one_time_keys_count: { signed_curve25519: 50 },
					rooms: {
						join: {
							[roomId]: {
								state: { events: state },
								timeline: {
									events:
										firstMessage === 141
											? Array.from(
													{ length: 20 },
													(_, i) => ({
														...message(i),
														type: 'm.room.topic',
														state_key: '',
														content: {
															topic: `Synthetic room update ${i}`
														}
													})
												)
											: Array.from(
													{
														length:
															141 - firstMessage
													},
													(_, i) =>
														message(
															i + firstMessage
														)
												),
									prev_batch: `before-${firstMessage}`,
									limited: true
								},
								ephemeral: { events: [] },
								account_data: { events: [] },
								unread_notifications: {
									notification_count: 0,
									highlight_count: 0
								}
							}
						}
					}
				}
			});
		}
		if (path.endsWith('/members'))
			return route.fulfill({
				json: {
					chunk: state.filter(
						(event) => event.type === 'm.room.member'
					)
				}
			});
		if (path.includes('/typing/') && request.method() === 'PUT')
			return route.fulfill({ json: {} });
		if (path.endsWith('/messages')) {
			historyPages.push(url.searchParams.get('from') || '');
			if (historyPages.length === 1 && firstHistoryGate)
				await firstHistoryGate;
			if (failFirstHistory && historyPages.length === 1)
				return route.fulfill({
					status: 500,
					json: {
						errcode: 'M_UNKNOWN',
						error: 'Synthetic interrupted history request'
					}
				});
			const before = Number(
				url.searchParams.get('from')?.replace('before-', '')
			);
			const newest = before === 141 ? 140 : before;
			const first = Math.max(1, newest - 49);
			// A page overlaps the existing boundary; the SDK must retain it once.
			return route.fulfill({
				json: {
					start: `before-${before}`,
					end: first === 1 ? undefined : `before-${first}`,
					chunk: Array.from({ length: newest - first + 1 }, (_, i) =>
						newest - i === 110 && historicalThread
							? {
									...message(110),
									content: {
										...message(110).content,
										'm.relates_to': {
											rel_type: 'm.thread',
											event_id: '$history-100',
											is_falling_back: true
										}
									}
								}
							: message(newest - i)
					)
				}
			});
		}
		if (
			path.includes('/receipt/') ||
			path.endsWith('/read_markers') ||
			(path.includes('/account_data/') && request.method() === 'PUT')
		)
			return route.fulfill({ json: {} });
		unexpected.push(`${request.method()} ${path}`);
		return route.fulfill({
			status: 500,
			json: {
				errcode: 'M_UNKNOWN',
				error: 'Unexpected synthetic Matrix route'
			}
		});
	});
	await page.route('**/service/**', async (route) => {
		const path = new URL(route.request().url()).pathname;
		if (path.endsWith('/supervisors') || path.endsWith('/consultants'))
			return route.fulfill({ json: [] });
		if (path.includes('/sessions/room'))
			return route.fulfill({ json: { sessions: [] } });
		if (path.includes('/tenant/public'))
			return route.fulfill({
				json: { settings: { featureTeamDiscussionEnabled: false } }
			});
		if (
			path.includes('/drafts/') ||
			path.endsWith('/event-notifications/active-view') ||
			path.includes('/sync/register/') ||
			path === '/service/error-reports'
		)
			return route.fulfill({ status: 204 });
		unexpected.push(`${route.request().method()} ${path}`);
		return route.fulfill({
			status: 500,
			json: { error: 'Unexpected synthetic product route' }
		});
	});

	return {
		unexpected,
		errors,
		consoleErrors,
		historyPages,
		deliverThreadReply: () => {
			deliverLiveReply = true;
		}
	};
};

test('top-scroll reveals the complete earlier chat without duplicates or moving the reading anchor', async ({
	page
}) => {
	const { unexpected, errors, consoleErrors, historyPages } =
		await prepareHistory(page);
	await page.goto('/playwright/history-pagination-1718/index.html');
	const scroll = page.locator('#session-scroll-container');
	const rows = page.locator('[data-message-id^="$history-"]');
	await expect(scroll)
		.toBeVisible({ timeout: 20000 })
		.catch((error) => {
			console.log(
				'Synthetic fixture startup diagnostics',
				JSON.stringify({ unexpected, errors, consoleErrors })
			);
			throw error;
		});
	await expect(rows).toHaveCount(20);
	await expect
		.poll(() => scroll.evaluate((element) => element.scrollTop))
		.toBeGreaterThan(100);

	for (const [count, anchorId] of [
		[69, 121],
		[118, 72],
		[140, 23]
	] as const) {
		await scroll.evaluate((element) => {
			element.scrollTop = 0;
			element.dispatchEvent(new Event('scroll', { bubbles: true }));
		});
		const anchor = page.locator(`[data-message-id="$history-${anchorId}"]`);
		const before = (await anchor.boundingBox())!.y;
		await expect(rows).toHaveCount(count, { timeout: 10000 });
		await expect
			.poll(async () =>
				Math.abs((await anchor.boundingBox())!.y - before)
			)
			.toBeLessThanOrEqual(3);
	}
	await expect(
		page.getByText('History message 1.', { exact: false })
	).toBeVisible();
	expect(
		await rows.evaluateAll((elements) =>
			elements.map((element) => element.getAttribute('data-message-id'))
		)
	).toEqual(Array.from({ length: 140 }, (_, i) => `$history-${i + 1}`));
	await scroll.evaluate((element) => {
		element.scrollTop = 0;
		element.dispatchEvent(new Event('scroll', { bubbles: true }));
	});
	await expect(
		page.locator('[data-message-id="$history-1"]')
	).toBeInViewport();
	await page.waitForTimeout(250); // Longer than the public scroll handler's debounce.
	expect(historyPages).toEqual(['before-121', 'before-72', 'before-23']);
	const unreadDivider = page.locator('.messageItem__divider--lastRead');
	await expect(unreadDivider).toHaveCount(0);
	expect(unexpected).toEqual([]);
	expect(errors).toEqual([]);
});

test('a short initial window makes earlier messages accessible', async ({
	page
}) => {
	const { unexpected, errors, historyPages } = await prepareHistory(page, {
		firstMessage: 140
	});
	await page.goto('/playwright/history-pagination-1718/index.html');
	const scroll = page.locator('#session-scroll-container');
	await expect(scroll).toBeVisible({ timeout: 20000 });
	await expect(page.locator('[data-message-id^="$history-"]')).toHaveCount(
		50
	);
	await expect(
		page.locator('[data-message-id="$history-140"]')
	).toBeVisible();
	expect(historyPages).toEqual(['before-140']);
	expect(unexpected).toEqual([]);
	expect(errors).toEqual([]);
});

test('older thread replies appear in history without announcing a new reply', async ({
	page
}) => {
	const { unexpected, errors, historyPages, deliverThreadReply } =
		await prepareHistory(page, { historicalThread: true });
	await page.goto('/playwright/history-pagination-1718/index.html');
	const scroll = page.locator('#session-scroll-container');
	await expect(scroll).toBeVisible({ timeout: 20000 });
	await expect(page.locator('[data-message-id^="$history-"]')).toHaveCount(
		20
	);
	await expect
		.poll(() => scroll.evaluate((element) => element.scrollTop))
		.toBeGreaterThan(100);
	await scroll.evaluate((element) => {
		element.scrollTop = 0;
		element.dispatchEvent(new Event('scroll', { bubbles: true }));
	});
	await expect(
		page.locator('[data-message-id="$history-100"]')
	).toBeAttached();
	await page.waitForTimeout(250);
	await expect(page.getByLabel('Received event notifications')).toHaveText(
		''
	);
	deliverThreadReply();
	await expect(page.getByLabel('Received event notifications')).toHaveText(
		'thread.reply.new',
		{ timeout: 10000 }
	);
	expect(historyPages).toEqual(['before-121']);
	expect(unexpected).toEqual([]);
	expect(errors).toEqual([]);
});

test('a metadata-only initial window still reveals earlier counselling messages', async ({
	page
}) => {
	const { unexpected, errors, historyPages } = await prepareHistory(page, {
		firstMessage: 141
	});
	await page.goto('/playwright/history-pagination-1718/index.html');
	const scroll = page.locator('#session-scroll-container');
	await expect(scroll).toBeVisible({ timeout: 20000 });
	await expect(page.locator('[data-message-id^="$history-"]')).toHaveCount(
		50
	);
	expect(historyPages).toEqual(['before-141']);
	expect(unexpected).toEqual([]);
	expect(errors).toEqual([]);
});

test('a failed empty-window history load can retry through the normal mouse wheel', async ({
	page
}) => {
	const { unexpected, errors, historyPages } = await prepareHistory(page, {
		firstMessage: 141,
		failFirstHistory: true
	});
	await page.goto('/playwright/history-pagination-1718/index.html');
	const scroll = page.locator('#session-scroll-container');
	await expect(scroll).toBeVisible({ timeout: 20000 });
	await expect.poll(() => historyPages.length).toBe(1);
	await page.waitForTimeout(250);
	await expect(page.locator('[data-message-id^="$history-"]')).toHaveCount(0);
	await scroll.hover();
	await page.mouse.wheel(0, -500);
	await expect(page.locator('[data-message-id^="$history-"]')).toHaveCount(
		50,
		{ timeout: 10000 }
	);
	expect(historyPages).toEqual(['before-141', 'before-141']);
	expect(unexpected).toEqual([]);
	expect(errors).toEqual([]);
});

test('cold chat mount waits for initial Matrix sync before deciding history is exhausted', async ({
	page
}) => {
	const { unexpected, errors, historyPages } = await prepareHistory(page, {
		firstMessage: 141,
		coldStart: true
	});
	await page.goto('/playwright/history-pagination-1718/index.html?cold');
	await expect(page.locator('#session-scroll-container')).toBeVisible({
		timeout: 20000
	});
	await expect(page.locator('[data-message-id^="$history-"]')).toHaveCount(
		50,
		{ timeout: 10000 }
	);
	expect(historyPages).toEqual(['before-141']);
	expect(unexpected).toEqual([]);
	expect(errors).toEqual([]);
});

for (const navigateToNewest of [false, true]) {
	test(`delayed older history preserves ${navigateToNewest ? 'the reader’s new position at the newest message' : 'a stationary reading anchor'}`, async ({
		page
	}) => {
		let releaseHistory!: () => void;
		const firstHistoryGate = new Promise<void>((resolve) => {
			releaseHistory = resolve;
		});
		const { unexpected, errors, historyPages } = await prepareHistory(
			page,
			{ firstHistoryGate }
		);
		try {
			await page.goto('/playwright/history-pagination-1718/index.html');
			const scroll = page.locator('#session-scroll-container');
			const rows = page.locator('[data-message-id^="$history-"]');
			await expect(scroll).toBeVisible({ timeout: 20000 });
			await expect(rows).toHaveCount(20);
			await page.evaluate(async () => {
				await document.fonts.ready;
			});
			await expect
				.poll(() => scroll.evaluate((element) => element.scrollTop))
				.toBeGreaterThan(100);
			await scroll.hover();
			await page.mouse.wheel(0, -100000);
			await expect.poll(() => historyPages.length).toBe(1);
			if (navigateToNewest) await page.mouse.wheel(0, 100000);
			const chosenMessage = page.locator(
				`[data-message-id="$history-${navigateToNewest ? 140 : 121}"]`
			);
			await expect(chosenMessage).toBeInViewport();
			const chosenTop = (await chosenMessage.boundingBox())!.y;
			releaseHistory();
			await expect(rows).toHaveCount(69);
			await expect(chosenMessage).toBeInViewport();
			await expect
				.poll(async () =>
					Math.abs((await chosenMessage.boundingBox())!.y - chosenTop)
				)
				.toBeLessThanOrEqual(3);
			expect(historyPages).toEqual(['before-121']);
			expect(unexpected).toEqual([]);
			expect(errors).toEqual([]);
		} finally {
			releaseHistory();
		}
	});
}
