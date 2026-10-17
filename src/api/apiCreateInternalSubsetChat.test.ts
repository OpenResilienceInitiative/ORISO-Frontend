// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logout } from '../components/logout/logout';
import { appConfig, setAppConfig } from '../utils/appConfig';
import {
	apiCreateInternalSubsetChat,
	InternalSubsetChatError,
	INTERNAL_SUBSET_BUSY_RETRY_MS,
	INTERNAL_SUBSET_REASON
} from './apiCreateInternalSubsetChat';

vi.mock('../components/logout/logout', () => ({ logout: vi.fn() }));

vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: {
		internalSubsetChat:
			'https://api.test/service/users/chat/internal-subset'
	}
}));

// jsdom's AbortSignal is incompatible with Node's Request constructor.
// Replace only request construction; exercise the real fetchData response path.
class TestRequest {
	constructor(
		readonly url: string,
		readonly init: RequestInit
	) {}
}

const room = { matrixRoomId: '!abc:matrix.test', chatId: 123 };
const request = {
	consultantIds: ['colleague-1', 'colleague-2'],
	agencyId: 410,
	topic: 'Fallbesprechung'
};

const answer = (
	status: number,
	body?: unknown,
	headers?: Record<string, string>
) =>
	vi.stubGlobal(
		'fetch',
		vi.fn().mockResolvedValue(
			new Response(body === undefined ? null : JSON.stringify(body), {
				status,
				headers
			})
		)
	);

const failure = async () => {
	try {
		await apiCreateInternalSubsetChat(request);
	} catch (error) {
		return error as InternalSubsetChatError;
	}
	throw new Error('expected the request to fail');
};

beforeEach(() => {
	vi.mocked(logout).mockClear();
	setAppConfig({ urls: { toLogin: '/login' } } as never);
	vi.useFakeTimers();
	vi.stubGlobal('Request', TestRequest);
});
afterEach(() => {
	vi.clearAllTimers();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('apiCreateInternalSubsetChat', () => {
	it('posts exactly the selected colleagues, the centre and the name', async () => {
		answer(201, room);

		await apiCreateInternalSubsetChat(request);

		const sent = vi.mocked(fetch).mock
			.calls[0][0] as unknown as TestRequest;
		expect(sent.url).toBe(
			'https://api.test/service/users/chat/internal-subset'
		);
		expect(sent.init.method).toBe('POST');
		expect(JSON.parse(sent.init.body as string)).toEqual({
			consultantIds: ['colleague-1', 'colleague-2'],
			agencyId: 410,
			topic: 'Fallbesprechung'
		});
	});

	it('reports a newly created room', async () => {
		answer(201, room);
		await expect(apiCreateInternalSubsetChat(request)).resolves.toEqual({
			...room,
			reused: false
		});
	});

	it('reports a reused room with the same ids', async () => {
		answer(200, room);
		await expect(apiCreateInternalSubsetChat(request)).resolves.toEqual({
			...room,
			reused: true
		});
	});

	it.each([
		[400, INTERNAL_SUBSET_REASON.RECIPIENTS_REQUIRED],
		[400, INTERNAL_SUBSET_REASON.RECIPIENT_UNKNOWN],
		[403, INTERNAL_SUBSET_REASON.RECIPIENT_OUT_OF_SCOPE],
		[502, INTERNAL_SUBSET_REASON.MEMBERSHIP_FAILED],
		[503, INTERNAL_SUBSET_REASON.ENCRYPTION_REQUIRED],
		[403, INTERNAL_SUBSET_REASON.RECIPIENT_OUT_OF_SCOPE]
	])(
		'names the reason of a %i refusal (%s) from the X-Reason header',
		async (status, reason) => {
			answer(status, undefined, { 'X-Reason': reason });
			const error = await failure();
			expect(error).toBeInstanceOf(InternalSubsetChatError);
			expect(error.reason).toBe(reason);
			expect(error.status).toBe(status);
		}
	);

	it('falls back to the reason in the JSON body', async () => {
		answer(403, { reason: INTERNAL_SUBSET_REASON.RECIPIENT_OUT_OF_SCOPE });
		expect((await failure()).reason).toBe(
			INTERNAL_SUBSET_REASON.RECIPIENT_OUT_OF_SCOPE
		);
	});

	it('reads a 403 without a reason as "internal chats are switched off"', async () => {
		answer(403);
		expect((await failure()).reason).toBe(INTERNAL_SUBSET_REASON.DISABLED);
	});

	it.each([
		['an unknown reason code', 400, { reason: 'SOMETHING_NEW' }],
		['a server error without reason', 500, undefined]
	])('reports %s as unknown', async (_label, status, body) => {
		answer(status, body);
		expect((await failure()).reason).toBe(INTERNAL_SUBSET_REASON.UNKNOWN);
	});

	it.each([404, 405, 501])(
		'reads a %i from an UserService without the endpoint as "not available yet"',
		async (status) => {
			answer(status);
			const error = await failure();
			expect(error.reason).toBe(INTERNAL_SUBSET_REASON.NOT_AVAILABLE);
			expect(error.status).toBe(status);
		}
	);

	it('retries once when the same people are still being set up, then succeeds', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(null, {
					status: 503,
					headers: { 'X-Reason': INTERNAL_SUBSET_REASON.BUSY }
				})
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify(room), { status: 200 })
			);
		vi.stubGlobal('fetch', fetchMock);

		const result = apiCreateInternalSubsetChat(request);
		await vi.advanceTimersByTimeAsync(INTERNAL_SUBSET_BUSY_RETRY_MS);

		await expect(result).resolves.toEqual({ ...room, reused: true });
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('names the busy refusal after one automatic retry and does not retry again', async () => {
		const busy = () =>
			new Response(null, {
				status: 503,
				headers: { 'X-Reason': INTERNAL_SUBSET_REASON.BUSY }
			});
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(busy())
			.mockResolvedValueOnce(busy());
		vi.stubGlobal('fetch', fetchMock);

		const result = apiCreateInternalSubsetChat(request).catch(
			(error) => error as InternalSubsetChatError
		);
		await vi.advanceTimersByTimeAsync(INTERNAL_SUBSET_BUSY_RETRY_MS * 3);

		expect((await result).reason).toBe(INTERNAL_SUBSET_REASON.BUSY);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('does not retry any other refusal', async () => {
		answer(502, undefined, {
			'X-Reason': INTERNAL_SUBSET_REASON.MEMBERSHIP_FAILED
		});
		await failure();
		expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
	});

	it('sends the counsellor to the login on a 401, like every other authenticated call', async () => {
		answer(401);
		const error = await failure();
		expect(logout).toHaveBeenCalledWith(true, appConfig.urls.toLogin);
		expect(error.reason).toBe(INTERNAL_SUBSET_REASON.UNKNOWN);
		expect(error.status).toBe(401);
		expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
	});

	it('does not log out on any other refusal', async () => {
		answer(403, undefined, {
			'X-Reason': INTERNAL_SUBSET_REASON.RECIPIENT_OUT_OF_SCOPE
		});
		await failure();
		expect(logout).not.toHaveBeenCalled();
	});

	it.each([
		['no body', undefined],
		['an empty object', {}],
		['no room id', { chatId: 123 }],
		['no chat id', { matrixRoomId: '!abc:matrix.test' }],
		['a room id of the wrong type', { matrixRoomId: 7, chatId: 123 }]
	])('does not report success for a 201 with %s', async (_label, body) => {
		answer(201, body);
		const error = await failure();
		expect(error.reason).toBe(INTERNAL_SUBSET_REASON.UNKNOWN);
		expect(error.status).toBe(201);
	});

	it('reports a network failure as unknown', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockRejectedValue(new TypeError('offline'))
		);
		expect((await failure()).reason).toBe(INTERNAL_SUBSET_REASON.UNKNOWN);
	});
});
