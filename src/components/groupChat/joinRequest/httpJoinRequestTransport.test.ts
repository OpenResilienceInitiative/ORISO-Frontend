// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FETCH_ERRORS } from '../../../api/fetchData';
import {
	createHttpJoinRequestTransport,
	JoinRequestApi
} from './httpJoinRequestTransport';
import {
	JoinRequestLinkInvalidError,
	JoinRequestsUnavailableError
} from './joinRequestTransport';
import type { GroupChatJoinRequest } from './joinRequestModel';

const pendingRequest = (id: number) =>
	({ id, seriesId: 7, status: 'PENDING' }) as GroupChatJoinRequest;

const fakeApi = (): JoinRequestApi & Record<string, ReturnType<typeof vi.fn>> =>
	({
		knock: vi.fn(),
		getMine: vi.fn().mockResolvedValue(null),
		cancelMine: vi.fn().mockResolvedValue(undefined),
		listPending: vi.fn().mockResolvedValue([]),
		admit: vi.fn().mockResolvedValue(undefined),
		decline: vi.fn().mockResolvedValue(undefined)
	}) as never;

const flush = async () => {
	for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('HTTP join-request transport', () => {
	it('reports her request only when it actually changed, and stops when told', async () => {
		const api = fakeApi();
		api.getMine
			.mockResolvedValueOnce({ id: 1, status: 'PENDING' })
			.mockResolvedValueOnce({ id: 1, status: 'PENDING' })
			.mockResolvedValue({ id: 1, status: 'ADMITTED' });
		const transport = createHttpJoinRequestTransport({
			api,
			mineIntervalMs: 1000
		});
		const onChange = vi.fn();

		const stop = transport.watchMine(7, onChange);
		await flush();
		await vi.advanceTimersByTimeAsync(1000);
		await vi.advanceTimersByTimeAsync(1000);

		expect(onChange.mock.calls.map(([status]) => status?.status)).toEqual([
			'PENDING',
			'ADMITTED'
		]);
		stop();
		const calls = api.getMine.mock.calls.length;
		await vi.advanceTimersByTimeAsync(5000);
		expect(api.getMine.mock.calls.length).toBe(calls);
	});

	it('looks again at once when the tab comes back into view', async () => {
		const api = fakeApi();
		const transport = createHttpJoinRequestTransport({
			api,
			pendingIntervalMs: 60_000
		});
		transport.watchPending(vi.fn());
		await flush();
		const before = api.listPending.mock.calls.length;

		document.dispatchEvent(new Event('visibilitychange'));
		await flush();

		expect(api.listPending.mock.calls.length).toBe(before + 1);
	});

	it('hands the moderator the open requests whenever the list changes', async () => {
		const api = fakeApi();
		api.listPending
			.mockResolvedValueOnce([pendingRequest(1)])
			.mockResolvedValueOnce([pendingRequest(1)])
			.mockResolvedValue([pendingRequest(1), pendingRequest(2)]);
		const transport = createHttpJoinRequestTransport({
			api,
			pendingIntervalMs: 1000
		});
		const onChange = vi.fn();

		transport.watchPending(onChange);
		await flush();
		await vi.advanceTimersByTimeAsync(1000);
		await vi.advanceTimersByTimeAsync(1000);

		expect(
			onChange.mock.calls.map(([list]) =>
				list.map((item: GroupChatJoinRequest) => item.id)
			)
		).toEqual([[1], [1, 2]]);
	});

	it('stops asking a server that has no knock endpoints', async () => {
		const api = fakeApi();
		api.listPending.mockRejectedValue(new Error(FETCH_ERRORS.NO_MATCH));
		api.getMine.mockRejectedValue(new Error(FETCH_ERRORS.NO_MATCH));
		const transport = createHttpJoinRequestTransport({
			api,
			pendingIntervalMs: 1000
		});

		transport.watchPending(vi.fn());
		await flush();
		await vi.advanceTimersByTimeAsync(10_000);

		expect(api.listPending).toHaveBeenCalledTimes(1);
		await expect(transport.getMine(7)).rejects.toBeInstanceOf(
			JoinRequestsUnavailableError
		);
	});

	it('knocks with the link’s token', async () => {
		const api = fakeApi();
		api.knock.mockResolvedValue({ id: 1, status: 'PENDING' });
		const transport = createHttpJoinRequestTransport({ api });

		await transport.knock(7, 'tok_EN-9');

		expect(api.knock).toHaveBeenCalledWith(7, 'tok_EN-9');
	});

	it('reports a refused link (403) as such, not as a failed send', async () => {
		const api = fakeApi();
		api.knock.mockRejectedValue(new Error(FETCH_ERRORS.FORBIDDEN));
		const transport = createHttpJoinRequestTransport({ api });

		await expect(transport.knock(7, 'old')).rejects.toBeInstanceOf(
			JoinRequestLinkInvalidError
		);
	});

	it('sends admit and decline for the request’s own group', async () => {
		const api = fakeApi();
		const transport = createHttpJoinRequestTransport({ api });

		await transport.admit(pendingRequest(3), 'CO_MODERATOR');
		await transport.decline(pendingRequest(4));

		expect(api.admit).toHaveBeenCalledWith(7, 3, 'CO_MODERATOR');
		expect(api.decline).toHaveBeenCalledWith(7, 4);
	});
});
