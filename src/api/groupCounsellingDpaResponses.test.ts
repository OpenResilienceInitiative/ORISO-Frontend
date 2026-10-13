// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiCreateGroupChat, apiUpdateGroupChat } from './apiGroupChatSettings';
import { apiPutGroupChat, GROUP_CHAT_API } from './apiPutGroupChat';
import { FETCH_ERRORS } from './fetchData';
import { setAppConfig } from '../utils/appConfig';
import type { AppConfigInterface } from '../globalState/interfaces';

const logout = vi.hoisted(() => vi.fn());
vi.mock('../components/logout/logout', () => ({ logout }));

// The fetch boundary remains real Request/Response; Node cannot consume jsdom's signal.
class BrowserRequest extends Request {
	constructor(input: RequestInfo | URL, init?: RequestInit) {
		super(input, { ...init, signal: undefined });
	}
}

beforeEach(() => {
	vi.stubGlobal('Request', BrowserRequest);
	window.history.replaceState(null, '', '/sessions/user/view');
	setAppConfig({ urls: { toLogin: '/login' } } as AppConfigInterface);
});
afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
	setAppConfig(null);
});

const settings = {
	topic: 'Synthetic support group',
	startDate: '2026-10-01',
	startTime: '10:00',
	duration: 60,
	agencyId: 42,
	hintMessage: 'Synthetic welcome',
	repetitive: false,
	repeatCount: 1,
	consultantIds: ['synthetic-colleague'],
	featureGroupChatV2Enabled: true
};

const failures = [
	[403, 'DPA_NEW_COUNSELLING_NOT_ALLOWED'],
	[502, 'DPA_POLICY_UNAVAILABLE']
] as const;

const commands = [
	GROUP_CHAT_API.START,
	GROUP_CHAT_API.JOIN,
	GROUP_CHAT_API.ASSIGN
];

describe('group AVV failures through the HTTP boundary', () => {
	it.each(failures)(
		'preserves creation HTTP%s for localized feedback',
		async (status, reason) => {
			const response = new Response('', {
				status,
				headers: { 'X-Reason': reason }
			});
			vi.stubGlobal(
				'fetch',
				vi.fn(async (request: Request) => {
					expect(new URL(request.url).pathname).toBe(
						'/service/users/chat/v2/new'
					);
					expect(request.method).toBe('POST');
					return response;
				})
			);
			await expect(apiCreateGroupChat(settings)).rejects.toBe(response);
		}
	);
	it.each(failures)(
		'preserves settings update HTTP%s when adding a co-moderator',
		async (status, reason) => {
			const response = new Response('', {
				status,
				headers: { 'X-Reason': reason }
			});
			vi.stubGlobal(
				'fetch',
				vi.fn(async (request: Request) => {
					expect(new URL(request.url).pathname).toBe(
						'/service/users/chat/42/update'
					);
					expect(request.method).toBe('PUT');
					return response;
				})
			);
			await expect(apiUpdateGroupChat(42, settings)).rejects.toBe(
				response
			);
		}
	);
	for (const command of commands) {
		it.each(failures)(
			`preserves ${command} HTTP%s for localized feedback`,
			async (status, reason) => {
				const response = new Response('', {
					status,
					headers: { 'X-Reason': reason }
				});
				vi.stubGlobal(
					'fetch',
					vi.fn(async (request: Request) => {
						expect(new URL(request.url).pathname).toBe(
							`/service/users/chat/42${command}`
						);
						expect(request.method).toBe('PUT');
						return response;
					})
				);
				await expect(apiPutGroupChat(42, command)).rejects.toBe(
					response
				);
			}
		);
	}

	it('also preserves the legacy creation restriction', async () => {
		const response = new Response('', {
			status: 403,
			headers: { 'X-Reason': failures[0][1] }
		});
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
		await expect(
			apiCreateGroupChat({
				...settings,
				featureGroupChatV2Enabled: false
			})
		).rejects.toBe(response);
	});

	it.each([401, 403, 409])(
		'preserves ordinary creation HTTP%s',
		async (status) => {
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue(new Response('', { status }))
			);
			await expect(apiCreateGroupChat(settings)).rejects.toMatchObject({
				message:
					status === 401
						? FETCH_ERRORS.UNAUTHORIZED
						: FETCH_ERRORS.CATCH_ALL
			});
			expect(logout).toHaveBeenCalledTimes(status === 401 ? 1 : 0);
		}
	);

	for (const command of commands) {
		it.each([401, 403, 409])(
			`preserves ordinary ${command} HTTP%s`,
			async (status) => {
				vi.stubGlobal(
					'fetch',
					vi.fn().mockResolvedValue(new Response('', { status }))
				);
				await expect(
					apiPutGroupChat(42, command)
				).rejects.toMatchObject({
					message:
						status === 409
							? FETCH_ERRORS.CONFLICT
							: FETCH_ERRORS.CATCH_ALL
				});
				expect(logout).not.toHaveBeenCalled();
			}
		);
	}

	it.each([
		[403, failures[1][1]],
		[502, failures[0][1]]
	] as const)(
		'does not classify mismatched HTTP%s as an AVV decision',
		async (status, reason) => {
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue(
					new Response('', {
						status,
						headers: { 'X-Reason': reason }
					})
				)
			);
			await expect(
				apiPutGroupChat(42, GROUP_CHAT_API.JOIN)
			).rejects.toThrow(FETCH_ERRORS.CATCH_ALL);
		}
	);
});
