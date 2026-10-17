// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	apiCreateInternalSubsetChat,
	InternalSubsetChatError,
	INTERNAL_SUBSET_REASON
} from './apiCreateInternalSubsetChat';

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
		[503, INTERNAL_SUBSET_REASON.ENCRYPTION_REQUIRED]
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

	it('reports a network failure as unknown', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockRejectedValue(new TypeError('offline'))
		);
		expect((await failure()).reason).toBe(INTERNAL_SUBSET_REASON.UNKNOWN);
	});
});
